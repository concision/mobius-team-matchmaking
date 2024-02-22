import {IMatchmakingOptions, ITeamMatchups, type matchmakeTeams, type matchmakeTeamsByRegion} from "../api/Matchmaking";
import {Day, ITeam} from "../api/ITeam";
import {IScheduledMatchup} from "../api/ITeamMatchup";
import {TeamMatchResult} from "../api/ITeamParticipant";

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
    if (0 < teams.length && teams.some((team) => team.region !== teams[0].region))
        throw new Error("All teams must be in the same region, encountered unique regions: " +
            `[${[...new Set(teams.map((team) => team.region))].join(", ")}]`);
    if (!maximumGames || maximumGames < 1)
        throw new Error("The maximum number of games must be at least 1.");
    week ??= new Date();

    const timeSlots: TimeSlot[] = partitionTeamsByTimeSlots(teams);
    if (0 < timeSlots.length)
        console.log(`Time slots: ${timeSlots.length}`);
    for (const timeSlot of timeSlots.values()) {
        if (2 <= timeSlot.teams.length)
            console.log(`Time slot (${timeSlot.region}, ${timeSlot.day}, ${timeSlot.ordinal}) has ${timeSlot.teams.length} team(s) available`);
    }

    const generations: number = 50;
    const newPopulation: number = 1000;
    let population: Pairings[] = [new Pairings(timeSlots)];
    for (let g = 0; g < generations && 0 < population.length; g++) {

        // create new population
        const newGeneration: Pairings[] = [];
        for (let i = 0; i < newPopulation && 0 < population.length; i++) {
            // make new matchup: extend from previous generation: add new valid matchup, swaps (swaps 2 teams for a time slot), crossover
            const parent = population[Math.floor(Math.random() * population.length)];

            // mutation: add new valid matchup
            const newTimeSlots = parent.timeSlots.map((timeSlot) => timeSlot.clone());
            const possiblePairings = newTimeSlots
                .filter((timeSlot) => 2 <= timeSlot.teams.length)
                .map((timeSlot) => {
                    let count = timeSlot.teams.length - 2 * timeSlot.matchups.length;
                    return {timeSlot, pairCount: count * (count + 1) / 2};
                });
            const possiblePairs = possiblePairings.reduce((sum, slot) => sum + slot.pairCount, 0);
            if (0 < possiblePairs) {
                let random = Math.floor(Math.random() * possiblePairs);

                let chosenPair = undefined;
                for (let pairing of possiblePairings) {
                    random -= pairing.pairCount;
                    if (random < 0) {
                        chosenPair = pairing;
                        break;
                    }
                }
                if (!chosenPair) {
                    throw new Error();
                }

                const timeSlot = chosenPair.timeSlot;
                const first: number = Math.floor(Math.random() * timeSlot.teams.length);
                let second: number;
                do {
                    second = Math.floor(Math.random() * timeSlot.teams.length);
                } while (first === second);

                const matchup: IScheduledMatchup = {
                    time: [timeSlot.day, timeSlot.ordinal],
                    teams: [
                        {snowflake: timeSlot.teams[first].snowflake, status: TeamMatchResult.NotYetPlayed},
                        {snowflake: timeSlot.teams[second].snowflake, status: TeamMatchResult.NotYetPlayed},
                    ],
                    played: false
                };

                timeSlot.teams = timeSlot.teams.filter((team, index) => index !== first && index !== second);

                let individual: Pairings = new Pairings(newTimeSlots, [...parent.matchups, matchup]);

                newGeneration.push(individual);
            } else {
                newGeneration.push(parent);
            }
        }

        const max = Math.max(...newGeneration.map(o => o.score));
        const min = Math.min(...newGeneration.map(o => o.score));
        const fittest = newGeneration.find(o => o.score === max);
        console.log(`Generation ${g}, current population: ${population.length}, new generation: ${newGeneration.length}; maximum matches: ${max}, minimum: ${min}`)
        population = newGeneration;
        if (!fittest)
            continue;
        console.log("Matches: \n" + fittest?.matchups.map(matchup =>
            " - (" + matchup.time[0] + ", " + matchup.time[1] + "): ["
            + teams.find(team => team.snowflake === matchup.teams[0].snowflake)?.name
            + " vs "
            + teams.find(team => team.snowflake === matchup.teams[1].snowflake)?.name
            + "]"
        ).join("\n"));
    }

    return {matchups: [], unmatched: [...teams]};
}


class Pairings {
    public readonly timeSlots: TimeSlot[];
    public readonly matchups: IScheduledMatchup[];

    public get teams(): string[] {
        return this.matchups.flatMap((matchup) => matchup.teams.map((team) => team.snowflake));
    }

    public get score(): number {
        return this.matchups?.length ?? 0;
    }

    public constructor(timeSlots: TimeSlot[], matchups: IScheduledMatchup[] = []) {
        this.timeSlots = timeSlots;
        this.matchups = matchups;
    }
}

class TimeSlot {
    public readonly region: string;
    public readonly day: Day;
    public readonly ordinal: number;
    public readonly identifier: Symbol;
    private _teams: ITeam[] | undefined;
    private _matchups: IScheduledMatchup[] | undefined;

    public get teams() {
        return this._teams ??= [];
    }

    public set teams(teams: ITeam[]) {
        this._teams = teams;
    }

    public get matchups() {
        return this._matchups ??= [];
    }

    public set matchups(matchups: IScheduledMatchup[]) {
        this._matchups = matchups;
    }

    constructor(region: string, day: Day, ordinal: number) {
        this.region = region;
        this.day = <Day>day.toLowerCase();
        this.ordinal = ordinal;
        this.identifier = Symbol(JSON.stringify({region, day, ordinal}));
    }

    public clone(): TimeSlot {
        const clone = new TimeSlot(this.region, this.day, this.ordinal);
        clone._teams = this._teams?.slice();
        return clone;
    }
}

const partitionTeamsByTimeSlots = (teams: readonly ITeam[]): TimeSlot[] => {
    const allTimeSlots = teams
        .flatMap((team: ITeam) => (<Day[]>Object.keys(team.availability))
            .flatMap(day => team.availability[day]!
                .map((isAvailable: boolean, ordinal: number) => isAvailable ? new TimeSlot(team.region, day, ordinal) : null)
                .filter((timeSlot): timeSlot is TimeSlot => timeSlot !== null)
            )
        )
        .reduce((map, timeSlot) => map.set(timeSlot.identifier.description!, timeSlot), new Map<string, TimeSlot>());
    // console.log(`Discovered ${allTimeSlots.size} used time slots: [${[...allTimeSlots.values()].map(timeSlot => `(${timeSlot.day}, ${timeSlot.ordinal})`).join(", ")}]`);

    for (const team of teams) {
        const teamTimeSlots = (<Day[]>Object.keys(team.availability))
            .flatMap(day => team.availability[day]!
                .map((isAvailable: boolean, ordinal: number) => isAvailable ? new TimeSlot(team.region, day, ordinal) : null)
                .filter((timeSlot): timeSlot is TimeSlot => timeSlot !== null)
            ).map(timeSlot => allTimeSlots.get(timeSlot.identifier.description!)!);

        // if (0 < teamTimeSlots.length) {
        //     console.log(`Team '${team.name}' is available at ${teamTimeSlots.length} time slots: [${teamTimeSlots.map(timeSlot => `(${timeSlot.day}, ${timeSlot.ordinal})`).join(", ")}]`);
        // }

        for (const timeSlot of teamTimeSlots) {
            timeSlot.teams.push(team);
        }
    }

    return [...allTimeSlots.values()];
}
