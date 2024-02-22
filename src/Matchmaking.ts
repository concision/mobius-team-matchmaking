import {IMatchmakingOptions, ITeamMatchups, type matchmakeTeams, type matchmakeTeamsByRegion} from "./api/Matchmaking";
import {Day, ITeam} from "./api/ITeam";
import {IScheduledMatchup} from "./api/ITeamMatchup";

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

    return {matchups: [], unmatched: [...teams]};
}


class TimeSlot {
    public readonly region: string;
    public readonly day: Day;
    public readonly ordinal: number;
    public readonly identifier: Symbol;
    private _teams: ITeam[] | undefined;

    public get teams() {
        return this._teams ??= [];
    }

    constructor(region: string, day: Day, ordinal: number) {
        this.region = region;
        this.day = <Day>day.toLowerCase();
        this.ordinal = ordinal;
        this.identifier = Symbol(JSON.stringify({region, day, ordinal}));
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
