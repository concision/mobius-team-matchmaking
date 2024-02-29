import {
    IMatchmakingOptions,
    ITeamMatchups,
    ITeamMatchupsIndividual,
    type matchmakeTeams,
    type matchmakeTeamsByRegion
} from "../api/TeamMatchmaking";
import {ITeam} from "../api/ITeam";
import {IScheduledMatchup} from "../api/ITeamMatchup";
import {ITeamNotYetPlayed, TeamMatchResult} from "../api/ITeamParticipant";
import {
    CrossOverCombineMatchups,
    MutationAddNewMatchup,
    MutationRemoveMatchup,
    MutationSwapMatchupAcrossTimeSlots,
    MutationSwapMatchupInTimeSlot
} from "./MatchupIndividualMutators";
import {Day, ITimeSlot} from "../api/ITimeSlot";
import {WeightedRandomIndividualMutator} from "../api/genetic/IndividualMutator";
import {geneticAlgorithm} from "./GeneticAlgorithm";
import {MultivariateFitnessFunction} from "../api/genetic/FitnessFunction";
import {
    MaximizeAverageGamesPlayedPerTeam,
    MaximizeTotalMatchups,
    MinimizeEloDifferential,
    MinimizeRecentDuplicateMatchups
} from "./MatchupFitnessFunctions";
import {
    ChainedPopulationSelector,
    DeduplicatePopulationSelector,
    ElitistPopulationSelector,
    KillInvalidPopulationSelector,
    ProportionalPopulationSelector,
    RepopulatePopulationSelector,
    RouletteWheelPopulationSelector,
    TournamentPopulationSelector
} from "../api/genetic/PopulationSelector";
import {IGeneticOptions} from "../api/genetic/GeneticAlgorithm";
import {TimeSlot, translateTimeSlotToDate} from "./TimeSlot";
import {EnsureGrowthEarlyStopEvaluator} from "./MatchupEarlyStoppingEvaluator";
import {invalidIndividualEvaluator, uniqueTeamMatchupIdentity} from "./MatchupPopulationSelectors";

export {matchmakeTeams, matchmakeTeamsByRegion};

const matchmakeTeamsByRegion: matchmakeTeamsByRegion = (options: IMatchmakingOptions): ITeamMatchups => {
    let {teams, maximumGames, scheduledWeek} = options;
    if (!maximumGames || maximumGames < 1)
        throw new Error("The maximum number of games must be at least 1.");
    scheduledWeek ??= new Date();

    const timeSlotsByRegion = teams.reduce((map, team) => {
        if (map.has(team.region)) {
            map.get(team.region)!.push(team);
        } else {
            map.set(team.region, [team]);
        }
        return map;
    }, new Map<string, ITeam[]>());

    let matchups: IScheduledMatchup[] = [];
    let unmatched: ITeam[] = [];
    for (const [region, regionTeams] of timeSlotsByRegion) {
        const regionMatchups = matchmakeTeams({...options, teams: regionTeams});
        matchups = matchups.concat(regionMatchups.matchups);
        unmatched = unmatched.concat(regionMatchups.unmatched);
    }
    return {matchups, unmatched};
}

const matchmakeTeams: matchmakeTeams = ({teams, ...options}: IMatchmakingOptions): ITeamMatchups => {
    if (0 < teams.length && teams.some(team => team.region !== teams[0].region))
        throw new Error("All teams must be in the same region, encountered unique regions: " +
            `[${[...new Set(teams.map((team) => team.region))].join(", ")}]`);
    if (!options.maximumGames || options.maximumGames < 1)
        throw new Error("The maximum number of games must be at least 1.");
    if (options.preventDuplicateMatchupsInLastXWeeks && options.preventDuplicateMatchupsInLastXWeeks < 0)
        throw new Error("The duplicate matchup week recency must be greater than 0 to be enabled, or 0 to be disabled.");

    const week = options.scheduledWeek ?? new Date();
    const timeSlotToDateTranslator = typeof options.availabilityTranslator === 'function'
        ? options.availabilityTranslator
        : translateTimeSlotToDate;

    const teamsByTimeSlots = partitionTeamsByTimeSlots(teams);
    // TODO: remove time slots that have already occurred

    const constraints: IGeneticOptions<ITeamMatchupsIndividual> = {
        maximumGenerations: [...teamsByTimeSlots.values()]
            .reduce((sum, teams) => sum + teams.length * (teams.length + 1) / 2, 0),
        maximumPopulationSize: 1000,
        individualGenerator: () => ({unmatchedTeams: teamsByTimeSlots, matchups: []}),
        individualMutator: new WeightedRandomIndividualMutator("", 0.75, [
            // add new valid team matchup
            {weight: 2, mutator: new MutationAddNewMatchup()},
            // remove a team matchup
            {weight: 1, predicate: args => 1 <= args.matchups.length, mutator: new MutationRemoveMatchup()},
            // swap pairing (from the same time slot)
            {weight: 1, predicate: args => 1 <= args.matchups.length, mutator: new MutationSwapMatchupInTimeSlot()},
            // swap pairing (team swap with 2 different timeslots)
            {weight: 1, predicate: args => 2 <= args.matchups.length, mutator: new MutationSwapMatchupAcrossTimeSlots()},
            // crossover pairings (combine pairings from 2 different timeslots)
            {weight: 1, mutator: new CrossOverCombineMatchups()},
        ]),
        fitnessFunction: new MultivariateFitnessFunction("", [
            // maximize total matchups
            {weighting: 1, normalizer: "gaussian", fitnessFunction: MaximizeTotalMatchups}, // TODO: better normalized formula, S-curve like, maybe 1 - 1/(ln(x + e)) or  1/(1 + e^(-x))
            // minimize ELO differential in team matchups
            {weighting: 2, normalizer: "gaussian", fitnessFunction: MinimizeEloDifferential}, // TODO: inverse weight this - a higher score is worse
            // favor scheduling games to teams who have played fewer games relative to their season join date
            {weighting: 1, normalizer: "gaussian", fitnessFunction: MaximizeAverageGamesPlayedPerTeam}, // TODO: implement better normalizer
            // strong penalty for matchups that have occurred in the last options.preventDuplicateMatchupsInLastXWeeks weeks
            {
                weighting: 0 < (options.preventDuplicateMatchupsInLastXWeeks ?? 0) ? 3 : 0,
                normalizer: "gaussian", // TODO: inverse weight this - a higher score is worse
                fitnessFunction: MinimizeRecentDuplicateMatchups(week, options.preventDuplicateMatchupsInLastXWeeks),
            },
        ]),
        populationSelector: new ChainedPopulationSelector("chainedSelector", [
            new DeduplicatePopulationSelector("deduplicate", uniqueTeamMatchupIdentity),
            // kill invalid matchups (i.e. back to back scheduling)
            new KillInvalidPopulationSelector("killInvalids", invalidIndividualEvaluator, .30),
            // apply selective pressure
            new ProportionalPopulationSelector("selectivePressure", [
                // randomly select the best matchups
                {weight: .75, selector: new TournamentPopulationSelector("tournament", 10)},
                // preserve some of the best matchups without selective pressure
                {weight: .05, selector: new ElitistPopulationSelector("elitism", 1)},
                // preserve random individuals to maintain diversity
                {weight: .20, selector: new RouletteWheelPopulationSelector("roulette")},
            ]),
            // regrow the population cloned from selected individuals
            new RepopulatePopulationSelector("repopulate"),
        ]),
        // stop early if the fitness is not improving
        earlyStopping: EnsureGrowthEarlyStopEvaluator(10),
    };
    if (typeof options.configure === 'function')
        options.configure(constraints);

    const [{individual}] = geneticAlgorithm<ITeamMatchupsIndividual>(constraints, 1);

    const teamMatchups = individual.matchups
        .map(({timeSlot, teams}) => <IScheduledMatchup>({
            time: {day: timeSlot.day, ordinal: timeSlot.ordinal, date: timeSlotToDateTranslator(timeSlot, week)},
            teams: <[ITeamNotYetPlayed, ITeamNotYetPlayed]>teams.map(team => ({
                team: team,
                snowflake: team.snowflake,
                status: TeamMatchResult.NotYetPlayed,
            })),
            played: false,
        }))
        .toSorted((a, b) => {
            const result = (a.time.date?.getTime() ?? Infinity) - (b.time.date?.getTime() ?? Infinity);
            return result === 0 ? a.time.ordinal - b.time.ordinal : result;
        });
    const unmatchedTeams = Array.from([...individual.unmatchedTeams.values()]
        .flatMap(teams => teams)
        .reduce((uniqueTeams, team) => uniqueTeams.has(team.snowflake) ? uniqueTeams : uniqueTeams.set(team.snowflake, team), new Map<string, ITeam>())
        .values()
    );
    return {matchups: teamMatchups, unmatched: unmatchedTeams};
}


function partitionTeamsByTimeSlots(teams: readonly ITeam[]): ReadonlyMap<ITimeSlot, readonly ITeam[]> {
    const uniqueTimeSlots: Set<ITimeSlot> = teams
        .flatMap((team: ITeam) => (<Day[]>Object.keys(team.availability))
            .flatMap(day => team.availability[day]!
                .map((isAvailable: boolean, ordinal: number) => isAvailable ? TimeSlot.of(day, ordinal) : null)
                .filter((timeSlot): timeSlot is ITimeSlot => timeSlot !== null)
            )
        )
        .reduce((map, timeSlot) => map.add(timeSlot), new Set<ITimeSlot>());

    const teamsByTimeSlot = new Map<ITimeSlot, ITeam[]>();
    for (const timeSlot of uniqueTimeSlots.values())
        teamsByTimeSlot.set(timeSlot, []);

    for (const team of teams) {
        const teamTimeSlots = (<Day[]>Object.keys(team.availability))
            .flatMap(day => team.availability[day]!
                .map((isAvailable: boolean, ordinal: number) => isAvailable ? TimeSlot.of(day, ordinal) : null)
                .filter((timeSlot): timeSlot is ITimeSlot => timeSlot !== null)
            );

        for (const teamTimeSlot of teamTimeSlots)
            teamsByTimeSlot.get(teamTimeSlot)!.push(team);
    }

    return teamsByTimeSlot;
}
