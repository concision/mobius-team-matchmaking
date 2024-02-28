import {
    IMatchmakingOptions,
    ITeamMatchups,
    ITeamMatchupsIndividual,
    type matchmakeTeams,
    type matchmakeTeamsByRegion
} from "../api/Matchmaking";
import {ITeam} from "../api/ITeam";
import {IScheduledMatchup} from "../api/ITeamMatchup";
import {ITeamNotYetPlayed, TeamMatchResult} from "../api/ITeamParticipant";
import {
    ChainedPopulationSelector,
    geneticAlgorithm,
    IndividualFitnessFunction,
    KillInvalidPopulationSelector,
    MultivariateFitnessFunction,
    RepopulatePopulationSelector,
    TournamentPopulationSelector,
    WeightedRandomIndividualMutator
} from "./GeneticAlgorithms";
import {mutationAddNewMatchup, mutationRemoveMatchup, mutationSwapTimeSlotMatchup} from "./Mutators";
import {Day} from "../api/ITimeSlot";

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
    const sunday = getSunday(week);
    const recencyWeek = new Date(sunday.getTime() - 1000 * 60 * 60 * 24 * 7 * (options.preventDuplicateMatchupsInLastXWeeks ?? 2));

    const teamsByTimeSlots = partitionTeamsByTimeSlots(teams);
    // TODO: remove time slots that have already occurred
    if (0 < teamsByTimeSlots.size)
        console.log(`Time slots: ${teamsByTimeSlots.size}`);
    for (const [timeSlot, teams] of teamsByTimeSlots.entries()) {
        if (2 <= teams.length)
            console.log(`Time slot (${timeSlot.region}, ${timeSlot.day}, ${timeSlot.ordinal}) has ${teams.length} team(s) available`);
    }

    const [{individual: {matchups, unmatchedTeams}}] = geneticAlgorithm<ITeamMatchupsIndividual>({
        maximumGenerations: [...teamsByTimeSlots.values()].reduce((sum, teams) => sum + teams.length * (teams.length + 1) / 2, 0),
        maximumPopulationSize: 1000,
        individualGenerator: () => ({unmatchedTeams: teamsByTimeSlots, matchups: []}),
        individualMutator: WeightedRandomIndividualMutator<ITeamMatchupsIndividual>(
            // add new valid team matchup
            {weight: 2, mutator: mutationAddNewMatchup},
            // remove a team matchup
            {weight: 1, predicate: args => 1 <= args.matchups.length, mutator: mutationRemoveMatchup},
            // TODO: swap pairing (from the same time slot)
            {weight: 1, predicate: args => 1 <= args.matchups.length, mutator: mutationSwapTimeSlotMatchup},
            // TODO: swap pairing (team swap with 2 different timeslots)
            // TODO: crossover pairings (combine pairings from 2 different timeslots)
        ),
        fitnessFunction: MultivariateFitnessFunction(
            // maximize total matchups
            {
                name: "totalMatchups",
                weighting: 1,
                normalizer: "gaussian", // TODO: better normalized formula, S-curve like, maybe 1 - 1/(ln(x + e)) or  1/(1 + e^(-x))
                fitnessFunction: IndividualFitnessFunction(individual => individual.matchups.length),
            },
            // minimize ELO differential in team matchups
            {
                weighting: 2,
                normalizer: "gaussian", // TODO: inverse weight this - a higher score is worse
                fitnessFunction: IndividualFitnessFunction(individual => individual.matchups
                    .map(matchup => Math.abs(matchup.teams[0].elo - matchup.teams[1].elo))
                    // TODO: determine better aggregation function
                    .reduce((sum, eloDiff) => sum + eloDiff, 0)),
            },
            // strong penalty for matchups that have occurred in the last 2 weeks
            {
                // If options.duplicateMatchupRecencyInWeeks is 0, then this fitness function is disabled by a weight of 0
                weighting: 0 < (options.preventDuplicateMatchupsInLastXWeeks ?? 0) ? 3 : 0,
                normalizer: "gaussian", // TODO: inverse weight this - a higher score is worse
                // count duplicate matchups
                fitnessFunction: IndividualFitnessFunction(individual => individual.matchups
                    .map(matchup => {
                        const matchupTeamIds = matchup.teams.map(team => team.snowflake).sort();

                        let duplicateMatchups = 0;
                        for (const team of matchup.teams) {
                            if (!("history" in team && Array.isArray(team.history)))
                                continue;
                            duplicateMatchups = Math.max(
                                duplicateMatchups,
                                team.history
                                    // only games that have occurred in the last options.duplicateMatchupRecencyInWeeks weeks
                                    .filter(playedMatchup => recencyWeek.getTime() <= playedMatchup.time.date!.getTime()) // TODO
                                    // only historical matches that have the same teams as a new matchup
                                    .filter(playedMatchup => playedMatchup.teams
                                        .map(playedTeam => playedTeam.snowflake)
                                        .sort()
                                        .every((snowflake, index) => snowflake === matchupTeamIds[index])
                                    )
                                    .length
                            );
                        }
                        return duplicateMatchups;
                    })
                    .reduce((sum, duplicateMatchups) => sum + duplicateMatchups, 0)
                ),
            },
            // favor scheduling games to teams who have played fewer games relative to their season join date
            {
                weighting: 1,
                normalizer: "gaussian", // TODO: implement better normalizer
                fitnessFunction: IndividualFitnessFunction(individual => {
                    type X = { team: ITeam; joinTime: Date; matchesPlayed: number; };
                    const x: X[] = [];
                    teams.map(team => {
                        x.push({
                            team,
                            joinTime: new Date(), // TODO: get join time
                            matchesPlayed: individual.matchups.filter(matchup => matchup.teams.includes(team)).length,
                        });
                    });

                    return 0;
                })
            },
        ),
        populationSelector: ChainedPopulationSelector(
            // DeduplicatePopulationSelector(individual => Math.random().toString()),
            // TODO: kill invalid matchups (i.e. back to back scheduling)
            KillInvalidPopulationSelector(individual => true),
            TournamentPopulationSelector(.01),
            // DeduplicatePopulationSelector(individual => Math.random().toString()),
            RepopulatePopulationSelector(),
        ),
    }, 1);
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
