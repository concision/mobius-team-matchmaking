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
import {Day} from "../api/ITimeSlot";
import {WeightedRandomIndividualMutator} from "../api/genetic/IndividualMutator";
import {geneticAlgorithm} from "./GeneticAlgorithmGenerator";
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
    KillInvalidPopulationSelector,
    ProportionalPopulationSelector,
    RepopulatePopulationSelector,
    RouletteWheelPopulationSelector,
    TournamentPopulationSelector
} from "../api/genetic/PopulationSelector";
import {IGeneticOptions} from "../api/genetic/GeneticAlgorithm";

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

    const teamsByTimeSlots = partitionTeamsByTimeSlots(teams);
    // TODO: remove time slots that have already occurred
    if (0 < teamsByTimeSlots.size)
        console.log(`Time slots: ${teamsByTimeSlots.size}`);
    for (const [timeSlot, teams] of teamsByTimeSlots.entries()) {
        if (2 <= teams.length)
            console.log(`Time slot (${timeSlot.region}, ${timeSlot.day}, ${timeSlot.ordinal}) has ${teams.length} team(s) available`);
    }

    const constraints: IGeneticOptions<ITeamMatchupsIndividual> = {
        maximumGenerations: [...teamsByTimeSlots.values()]
            .reduce((sum, teams) => sum + teams.length * (teams.length + 1) / 2, 0),
        maximumPopulationSize: 1000,
        individualGenerator: () => ({unmatchedTeams: teamsByTimeSlots, matchups: []}),
        individualMutator: new WeightedRandomIndividualMutator<ITeamMatchupsIndividual>("bruhsuhv", [
            // add new valid team matchup
            {weight: 2, mutator: new MutationAddNewMatchup()},
            // remove a team matchup
            {weight: 1, predicate: args => 1 <= args.matchups.length, mutator: new MutationRemoveMatchup()},
            // TODO: swap pairing (from the same time slot)
            {weight: 1, predicate: args => 1 <= args.matchups.length, mutator: new MutationSwapMatchupInTimeSlot()},
            // TODO: swap pairing (team swap with 2 different timeslots)
            {weight: 1, predicate: args => 2 <= args.matchups.length, mutator: new MutationSwapMatchupAcrossTimeSlots()},
            // TODO: crossover pairings (combine pairings from 2 different timeslots)
            {weight: 1, mutator: new CrossOverCombineMatchups()},
        ]),
        fitnessFunction: new MultivariateFitnessFunction<ITeamMatchupsIndividual>("", [
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
        populationSelector: new ChainedPopulationSelector<ITeamMatchupsIndividual>("", [
            new DeduplicatePopulationSelector("", individual => Math.random().toString()),
            // TODO: kill invalid matchups (i.e. back to back scheduling)
            new KillInvalidPopulationSelector("", individual => true, .30),
            new ProportionalPopulationSelector("", [
                {weight: .70, selector: new TournamentPopulationSelector("", 10)},
                {weight: .30, selector: new RouletteWheelPopulationSelector("")},
            ]),
            new DeduplicatePopulationSelector("", individual => Math.random().toString()),
            new RepopulatePopulationSelector(""),
        ]),
    };
    if (typeof options.configure == 'function') {
        options.configure(constraints);
    }

    const [{individual: {matchups, unmatchedTeams}}] = geneticAlgorithm<ITeamMatchupsIndividual>(constraints, 1);
    console.log(`Matches (${matchups.length}): \n${matchups.map(matchup =>
        ` - (${matchup.timeSlot.day}, ${matchup.timeSlot.ordinal}): [${matchup.teams[0].name} vs ${matchup.teams[1].name}]`
    ).join("\n")}`);

    return {
        matchups: matchups.map(({timeSlot, teams}) => (<IScheduledMatchup>{
            time: {
                day: timeSlot.day,
                ordinal: timeSlot.ordinal,
                date: null,
            }, // TODO: translate date
            teams: <[ITeamNotYetPlayed, ITeamNotYetPlayed]>teams.map(team => ({
                team: team,
                snowflake: team.snowflake,
                status: TeamMatchResult.NotYetPlayed,
            })),
            played: false,
        })), // TODO sort by date
        // TODO: distinct by snowflake
        unmatched: [...unmatchedTeams.values()].flatMap(teams => teams)
    };
}


function getSunday(startDate: Date) {
    const sunday = new Date(startDate);
    sunday.setDate(sunday.getDate() - sunday.getDay());
    sunday.setHours(0);
    sunday.setSeconds(0);
    return sunday;
}

const partitionTeamsByTimeSlots = (teams: readonly ITeam[]): ReadonlyMap<TimeSlot, readonly ITeam[]> => {
    const allTimeSlots = teams
        .flatMap((team: ITeam) => (<Day[]>Object.keys(team.availability))
            .flatMap(day => team.availability[day]!
                .map((isAvailable: boolean, ordinal: number) => isAvailable ? new TimeSlot(team.region, day, ordinal) : null)
                .filter((timeSlot): timeSlot is TimeSlot => timeSlot !== null)
            )
        )
        .reduce((map, timeSlot) => map.set(timeSlot.identifier.description!, timeSlot), new Map<string, TimeSlot>());
    // console.log(`Discovered ${allTimeSlots.size} used time slots: [${[...allTimeSlots.values()].map(timeSlot => `(${timeSlot.day}, ${timeSlot.ordinal})`).join(", ")}]`);

    const teamsByTimeSlot = new Map<TimeSlot, ITeam[]>();
    for (const timeSlot of allTimeSlots.values())
        teamsByTimeSlot.set(timeSlot, []);

    for (const team of teams) {
        const teamTimeSlots = (<Day[]>Object.keys(team.availability))
            .flatMap(day => team.availability[day]!
                .map((isAvailable: boolean, ordinal: number) => isAvailable ? new TimeSlot(team.region, day, ordinal) : null)
                .filter((timeSlot): timeSlot is TimeSlot => timeSlot !== null)
            ).map(timeSlot => allTimeSlots.get(timeSlot.identifier.description!)!);

        // if (0 < teamTimeSlots.length) {
        //     console.log(`Team '${team.name}' is available at ${teamTimeSlots.length} time slots: [${teamTimeSlots.map(timeSlot => `(${timeSlot.day}, ${timeSlot.ordinal})`).join(", ")}]`);
        // }

        for (const teamTimeSlot of teamTimeSlots)
            teamsByTimeSlot.get(teamTimeSlot)!.push(team);
    }

    return teamsByTimeSlot;
}


export class TimeSlot {
    public readonly region: string;
    public readonly day: Day;
    public readonly ordinal: number;
    public readonly identifier: symbol;

    constructor(region: string, day: Day, ordinal: number) {
        this.region = region;
        this.day = <Day>day.toLowerCase();
        this.ordinal = ordinal;
        this.identifier = Symbol(JSON.stringify({region, day, ordinal}));
    }
}
