import {IMatchmakingOptions, ITeamMatchups, type matchmakeTeams, type matchmakeTeamsByRegion} from "../api/Matchmaking";
import {Day, ITeam} from "../api/ITeam";
import {IScheduledMatchup} from "../api/ITeamMatchup";
import {ITeamNotYetPlayed, TeamMatchResult} from "../api/ITeamParticipant";
import {
    ChainedPopulationSelector,
    DeduplicatePopulationSelector,
    geneticAlgorithm,
    IIndividualFitness, IndividualFitnessFunction,
    KillInvalidPopulationSelector,
    MultivariateFitnessFunction,
    RepopulatePopulationSelector,
    TournamentPopulationSelector,
    WeightedRandomIndividualMutator
} from "./GeneticAlgorithms";

export {matchmakeTeams, matchmakeTeamsByRegion};

const matchmakeTeamsByRegion: matchmakeTeamsByRegion = (options: IMatchmakingOptions): ITeamMatchups => {
    let {teams, maximumGames, week} = options;
    if (!maximumGames || maximumGames < 1)
        throw new Error("The maximum number of games must be at least 1.");
    week ??= new Date();

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

const matchmakeTeams: matchmakeTeams = ({teams, maximumGames, week}: IMatchmakingOptions): ITeamMatchups => {
    if (0 < teams.length && teams.some(team => team.region !== teams[0].region))
        throw new Error("All teams must be in the same region, encountered unique regions: " +
            `[${[...new Set(teams.map((team) => team.region))].join(", ")}]`);
    if (!maximumGames || maximumGames < 1)
        throw new Error("The maximum number of games must be at least 1.");
    week ??= new Date();

    const teamsByTimeSlots = partitionTeamsByTimeSlots(teams);
    // TODO: remove time slots that have already occurred
    if (0 < teamsByTimeSlots.size)
        console.log(`Time slots: ${teamsByTimeSlots.size}`);
    for (const [timeSlot, teams] of teamsByTimeSlots.entries()) {
        if (2 <= teams.length)
            console.log(`Time slot (${timeSlot.region}, ${timeSlot.day}, ${timeSlot.ordinal}) has ${teams.length} team(s) available`);
    }

    const [{individual: {matchups, unmatchedTeams}}] = geneticAlgorithm<IGeneticMatchups>({
        maximumGenerations: [...teamsByTimeSlots.values()].reduce((sum, teams) => sum + teams.length * (teams.length + 1) / 2, 0),
        maximumPopulationSize: 1000,
        individualGenerator: () => ({unmatchedTeams: teamsByTimeSlots, matchups: []}),
        individualMutator: WeightedRandomIndividualMutator<IGeneticMatchups>(
            // add new valid team matchup
            {weight: 2, mutator: mutationAddNewMatchup},
            // remove a team matchup
            {weight: 1, predicate: args => 1 < args.matchups.length, mutator: mutationRemoveMatchup},
            // TODO: swap pairing (from the same time slot)
            // TODO: swap pairing (team swap with 2 different timeslots)
            // TODO: crossover pairings (combine pairings from 2 different timeslots)
            // TODO: add default fallback to returning individual?
        ),
        fitnessFunction: MultivariateFitnessFunction(
            {
                fitnessFunction: (population: readonly IGeneticMatchups[]) => {
                    const fitness: IIndividualFitness<IGeneticMatchups>[] = [];
                    for (const individual of population) {
                        fitness.push({individual, fitness: 1});
                    }
                    return fitness;
                }
            },
            // maximizes total matchups; TODO: normalized formula, maybe 1 - 1/(ln(x + e)) or  1/(1 + e^(-x))
            {fitnessFunction: IndividualFitnessFunction(individual => individual.matchups.length)},
            // TODO: minimize ELO differential
            // TODO: strong penalty for matchups that have occurred in the last 2 weeks
            // TODO: favor games who have played less games relative to their season join date
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
            time: [<Date><any>timeSlot.day, timeSlot.ordinal], // TODO: translate date
            teams: <[ITeamNotYetPlayed, ITeamNotYetPlayed]>teams.map(team => ({snowflake: team.snowflake, status: TeamMatchResult.NotYetPlayed})),
            played: false,
        })), // TODO sort by date
        unmatched: [...unmatchedTeams.values()].flatMap(teams => teams)
    };
}

class TimeSlot {
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


interface IMatchup {
    readonly timeSlot: TimeSlot;
    readonly teams: readonly ITeam[];
}

interface IGeneticMatchups {
    readonly unmatchedTeams: ReadonlyMap<TimeSlot, readonly ITeam[]>;
    readonly matchups: readonly IMatchup[];
}

export function mutationAddNewMatchup(parent: IGeneticMatchups) {
    // find a timeslot to add a new matchup
    const possiblePairings = [...parent.unmatchedTeams.entries()]
        .filter(([timeSlot, teams]) => 2 <= teams.length)
        .map(([timeSlot, teams]) => ({timeSlot, pairs: teams.length * (teams.length + 1) / 2}));
    const possiblePairs = possiblePairings.reduce((sum, slot) => sum + slot.pairs, 0);
    if (possiblePairs <= 0)
        return;
    let chosenPair;
    let random = Math.floor(Math.random() * possiblePairs);
    for (let pairing of possiblePairings) {
        random -= pairing.pairs;
        if (random < 0) {
            chosenPair = pairing;
            break;
        }
    }

    const timeSlot = chosenPair!.timeSlot;
    const teams = parent.unmatchedTeams.get(timeSlot)!;

    // choose 2 random teams
    const first: number = Math.floor(Math.random() * teams.length);
    let second: number;
    do {
        second = Math.floor(Math.random() * teams.length);
    } while (first === second);

    // add the new matchup, and remove the teams from the unmatched list
    const unmatchedTeams: Map<TimeSlot, readonly ITeam[]> = new Map(parent.unmatchedTeams);
    unmatchedTeams.set(timeSlot, teams.filter((_, index) => index !== first && index !== second));
    return {
        unmatchedTeams,
        matchups: [...parent.matchups, {timeSlot, teams: [teams[first], teams[second]]}],
    };
}

export function mutationRemoveMatchup(parent: IGeneticMatchups) {
    if (0 < parent.matchups.length) {
        const matchups = [...parent.matchups];
        const removedMatchup = matchups.splice(Math.floor(Math.random() * matchups.length), 1)[0];

        const unmatchedTeams = new Map(parent.unmatchedTeams);
        unmatchedTeams.set(removedMatchup.timeSlot, [...parent.unmatchedTeams.get(removedMatchup.timeSlot)!, ...removedMatchup.teams]);
        return {unmatchedTeams, matchups};
    }
}
