import {
    FailedMatchupReason,
    IDefaultMatchmakingParameters,
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
import {LinearWeightedFitnessReducer, MultivariateFitnessFunction, Normalizer} from "../api/genetic/FitnessFunction";
import {
    maximizeAverageGamesPlayedPerTeam,
    maximizeTotalMatchups,
    minimizeEloDifferential,
    minimizeRecentDuplicateMatchups
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
import {ensureGrowthEarlyStopEvaluator} from "./MatchupEarlyStoppingEvaluator";
import {invalidIndividualEvaluator, uniqueTeamMatchupIdentity} from "./MatchupPopulationSelectors";

export {matchmakeTeams, matchmakeTeamsByRegion};

const matchmakeTeamsByRegion: matchmakeTeamsByRegion = ({teams, defaultParameters, ...options}: IMatchmakingOptions): ITeamMatchups => {
    const parameters = validateAndCreateParameters(defaultParameters);

    const teamsByRegion: ReadonlyMap<string, ITeam[]> = teams.reduce((map, team) => {
        if (map.has(team.region)) {
            map.get(team.region)!.push(team);
        } else {
            map.set(team.region, [team]);
        }
        return map;
    }, new Map<string, ITeam[]>());

    let matchups: IScheduledMatchup[] = [];
    let unmatchedTeams: Map<ITeam, FailedMatchupReason> = new Map<ITeam, FailedMatchupReason>();
    for (const [region, regionTeams] of teamsByRegion) {
        const regionalMatchups = matchmakeTeams({
            ...options,
            teams: regionTeams,
            defaultParameters: parameters,
        });

        matchups = matchups.concat(regionalMatchups.scheduledMatchups);
        for (const [team, reason] of regionalMatchups.unmatchedTeams.entries())
            unmatchedTeams.set(team, reason);
    }
    return {
        scheduledMatchups: matchups.sort(sortScheduledMatchupsByTime),
        unmatchedTeams,
    };
}


const matchmakeTeams: matchmakeTeams = ({teams, defaultParameters, ...options}: IMatchmakingOptions): ITeamMatchups => {
    if (0 < teams.length && teams.some(team => team.region !== teams[0].region))
        throw new Error("All teams must be in the same region, encountered unique regions: "
            + `[${[...new Set(teams.map((team) => team.region))].join(", ")}]; `);

    const parameters = validateAndCreateParameters(defaultParameters);
    const {teamsByTimeSlot, unavailableTeams} = partitionTeamsByTimeSlots(teams);
    // TODO: remove time slots that have already occurred

    let constraints: IGeneticOptions<ITeamMatchupsIndividual> = {
        maximumGenerations: [...teamsByTimeSlot.values()]
            .reduce((sum, teams) => sum + teams.length * (teams.length + 1) / 2, 0),
        maximumPopulationSize: 1000,
        individualGenerator: () => ({unmatchedTeams: teamsByTimeSlot, matchups: []}),
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
        fitnessFunction: new MultivariateFitnessFunction("fitness", new LinearWeightedFitnessReducer(), [
            // maximize total matchups
            {weighting: 1, normalizer: Normalizer.GAUSSIAN, fitnessFunction: maximizeTotalMatchups}, // TODO: better normalized formula, S-curve like, maybe 1 - 1/(ln(x + e)) or  1/(1 + e^(-x))
            // minimize ELO differential in team matchups
            {weighting: 2, normalizer: Normalizer.LOGARITHMIC, fitnessFunction: minimizeEloDifferential}, // TODO: inverse weight this - a higher score is worse
            // favor scheduling games to teams who have played fewer games relative to their season join date
            {
                weighting: 10,
                normalizer: Normalizer.GAUSSIAN, // TODO: implement better normalizer
                fitnessFunction: maximizeAverageGamesPlayedPerTeam(parameters.scheduledDate, parameters.countGamesPlayedInLastXDays)
            },
            // strong penalty for matchups that have occurred in the last options.preventDuplicateMatchupsInLastXWeeks weeks
            {
                weighting: parameters.preventDuplicateMatchupsInLastXDays !== 0 ? 3 : 0,
                normalizer: Normalizer.GAUSSIAN, // TODO: inverse weight this - a higher score is worse
                fitnessFunction: minimizeRecentDuplicateMatchups(parameters.scheduledDate, parameters.preventDuplicateMatchupsInLastXDays ?? 2),
            },
        ]),
        populationSelector: new ChainedPopulationSelector("chainedSelector", [
            new DeduplicatePopulationSelector("deduplicate", uniqueTeamMatchupIdentity),
            // kill invalid matchups (i.e. back to back scheduling)
            new KillInvalidPopulationSelector("killInvalids", invalidIndividualEvaluator(parameters.maximumGames), 1),
            // apply selective pressure
            new ProportionalPopulationSelector("selectivePressure", [
                // randomly select the best matchups
                {weight: .75, selector: new TournamentPopulationSelector("tournament", 10)},
                // preserve some of the best matchups without selective pressure
                {weight: .05, selector: new ElitistPopulationSelector("elitism", 1)},
                // preserve random individuals to maintain diversity
                {weight: .20, selector: new RouletteWheelPopulationSelector("roulette")},
            ]),
            new KillInvalidPopulationSelector("killInvalids", invalidIndividualEvaluator(parameters.maximumGames), 1),
            // regrow the population cloned from selected individuals
            new RepopulatePopulationSelector("repopulate"),
        ]),
        // stop early if the fitness is not improving
        earlyStopping: ensureGrowthEarlyStopEvaluator(10),
    };
    if (typeof options.configure === 'function')
        constraints = options.configure(constraints) ?? constraints;

    const [{solution}] = geneticAlgorithm<ITeamMatchupsIndividual>(constraints, 1);

    // translate solution's matchups into a format that is more useful for the consumer
    const scheduledMatchups = solution.matchups
        .map(({timeSlot, teams}) => <IScheduledMatchup>({
            time: <ITimeSlot>{
                day: timeSlot.day,
                ordinal: timeSlot.ordinal,
                date: parameters.timeSlotToDateTranslator(timeSlot, parameters.scheduledDate),
            },
            teams: <[ITeamNotYetPlayed, ITeamNotYetPlayed]>teams.map(team => ({
                team: team,
                snowflake: team.snowflake,
                status: TeamMatchResult.NotYetPlayed,
            })),
            played: false,
        }))
        .toSorted(sortScheduledMatchupsByTime);
    // translate solution's unmatched teams into a format that is more useful for the consumer
    const unmatchedTeamsMap = new Map<ITeam, FailedMatchupReason>();
    const matchedTeams = new Set<ITeam>(solution.matchups.flatMap(matchup => matchup.teams));
    const unmatchedTeams = Array.from(teams
        .flatMap(teams => teams)
        .filter(team => !matchedTeams.has(team))
        .reduce((uniqueTeams, team) => !uniqueTeams.has(team.snowflake) ? uniqueTeams.set(team.snowflake, team) : uniqueTeams, new Map<string, ITeam>())
        .values()
    );
    for (const unmatchedTeam of unmatchedTeams)
        unmatchedTeamsMap.set(unmatchedTeam, FailedMatchupReason.NO_IDEAL_MATCHUPS);
    for (const unavailableTeam of unavailableTeams)
        unmatchedTeamsMap.set(unavailableTeam, FailedMatchupReason.UNSCHEDULED_AVAILABILITY);

    return {scheduledMatchups, unmatchedTeams: unmatchedTeamsMap};
}


function validateAndCreateParameters(defaultParameters?: IDefaultMatchmakingParameters): Required<IDefaultMatchmakingParameters> {
    const parameters: Required<IDefaultMatchmakingParameters> = Object.assign({
        scheduledDate: new Date(),
        timeSlotToDateTranslator: translateTimeSlotToDate,

        minimumGames: 0,
        maximumGames: 5,

        preventDuplicateMatchupsInLastXDays: 14,
        countGamesPlayedInLastXDays: 21,
    }, <Partial<IDefaultMatchmakingParameters>>Object.fromEntries(Object.entries(defaultParameters ?? {}).filter(([, value]) => value !== undefined)));

    if (parameters.scheduledDate === undefined)
        throw new Error("The scheduling date must be defined.");
    if (typeof parameters.timeSlotToDateTranslator !== "function")
        throw new Error("The time slot to date translator must be a function.");

    if (parameters.minimumGames < 0)
        throw new Error("The minimum number of games must be at least 0.");
    if (parameters.maximumGames < 1)
        throw new Error("The maximum number of games must be at least 1.");

    if (parameters.preventDuplicateMatchupsInLastXDays < 0)
        throw new Error("The duplicate matchup day recency must be greater than 0 to be enabled, or 0 to be disabled.");
    if (parameters.countGamesPlayedInLastXDays < 0)
        throw new Error("The games played day recency must be greater than 0 to be enabled, or 0 to be disabled.");

    return parameters;
}

function partitionTeamsByTimeSlots(teams: readonly ITeam[]):
    { teamsByTimeSlot: ReadonlyMap<ITimeSlot, readonly ITeam[]>, unavailableTeams: readonly ITeam[] } {
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
    const unavailableTeams: ITeam[] = [];

    for (const team of teams) {
        const teamTimeSlots = (<Day[]>Object.keys(team.availability))
            .flatMap(day => team.availability[day]!
                .map((isAvailable: boolean, ordinal: number) => isAvailable ? TimeSlot.of(day, ordinal) : null)
                .filter((timeSlot): timeSlot is ITimeSlot => timeSlot !== null)
            );

        if (teamTimeSlots.length !== 0)
            for (const teamTimeSlot of teamTimeSlots)
                teamsByTimeSlot.get(teamTimeSlot)!.push(team);
        else
            unavailableTeams.push(team);
    }

    return {teamsByTimeSlot, unavailableTeams};
}

function sortScheduledMatchupsByTime(a: IScheduledMatchup, b: IScheduledMatchup): number {
    const result = (a.time.date?.getTime() ?? Infinity) - (b.time.date?.getTime() ?? Infinity);
    return result === 0 ? a.time.ordinal - b.time.ordinal : result;
}
