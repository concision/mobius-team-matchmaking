import {Writeable} from "../utilities/TypescriptTypes";
import {MatchupFailureReason} from "./api/IMatchmakingResults";
import {ITeam} from "./api/ITeam";
import {IScheduledMatchup} from "./api/ITeamMatchup";
import {Day, ITimeSlot, TimeSlotToDateTranslator} from "./api/ITimeSlot";

export interface ITeamsPartitionedByTimeSlot<TTeam extends ITeam> {
    teamsByTimeSlot: ReadonlyMap<ITimeSlot, readonly TTeam[]>;
    unavailableTeams: ReadonlyMap<TTeam, MatchupFailureReason>;
}

export function partitionTeamsByTimeSlots<TTeam extends ITeam>(
    scheduledDate: Date,
    dateTranslator: TimeSlotToDateTranslator,
    teams: readonly TTeam[],
): ITeamsPartitionedByTimeSlot<TTeam> {
    // compute all unique time slots
    const timeSlotCache = new Map<string, ITimeSlot>();
    const uniqueTimeSlots: Set<Writeable<ITimeSlot>> = teams
        .flatMap((team: ITeam) => (<Day[]>Object.keys(team.availability))
            .flatMap(day => team.availability[day]!
                .map((isAvailable: boolean, ordinal: number) => isAvailable ? newTimeSlot(timeSlotCache, day, ordinal) : null)
                .filter((timeSlot): timeSlot is Writeable<ITimeSlot> => timeSlot !== null)
            )
        )
        .reduce((map, timeSlot) => map.add(timeSlot), new Set<ITimeSlot>());
    for (const uniqueTimeSlot of uniqueTimeSlots)
        uniqueTimeSlot.date = dateTranslator(uniqueTimeSlot, scheduledDate);

    // prepare partition containers
    const teamsByTimeSlot = new Map<ITimeSlot, TTeam[]>();
    for (const timeSlot of uniqueTimeSlots.values())
        teamsByTimeSlot.set(timeSlot, []);
    const unavailableTeams: TTeam[] = [];

    // partition teams by time slot
    for (const team of teams) {
        const teamTimeSlots = (<Day[]>Object.keys(team.availability))
            .flatMap(day => team.availability[day]!
                .map((isAvailable: boolean, ordinal: number) => isAvailable ? newTimeSlot(timeSlotCache, day, ordinal) : null)
                .filter((timeSlot): timeSlot is ITimeSlot => timeSlot !== null)
            );

        if (teamTimeSlots.length !== 0)
            for (const teamTimeSlot of teamTimeSlots)
                teamsByTimeSlot.get(teamTimeSlot)!.push(team);
        else
            unavailableTeams.push(team);
    }

    return {
        teamsByTimeSlot,
        unavailableTeams: unavailableTeams.reduce(
            (map, team) => map.set(team, MatchupFailureReason.UNSCHEDULED_AVAILABILITY),
            new Map<TTeam, MatchupFailureReason>()
        ),
    };
}

export function filterTimeSlotsThatAlreadyOccurred<TTeam extends ITeam>(
    {teamsByTimeSlot, unavailableTeams}: ITeamsPartitionedByTimeSlot<TTeam>
): ITeamsPartitionedByTimeSlot<TTeam> {
    const currentTime = Date.now();

    const removedTeams = new Set<ITeam>(); // keep track of any teams that have been removed from the time slots
    const newTeamsByTimeSlot = new Map<ITimeSlot, readonly ITeam[]>();
    for (const [timeSlot, teams] of teamsByTimeSlot.entries())
        if (currentTime <= (timeSlot.date?.getTime() ?? Infinity))
            newTeamsByTimeSlot.set(timeSlot, teams);
        else
            for (const team of teams)
                removedTeams.add(team);

    // filter out any teams that are still available in at least 1 time slot
    for (const teams of newTeamsByTimeSlot.values())
        for (const team of teams)
            removedTeams.delete(team);
    // mark any removed teams (with no other availability) as unavailable
    const newUnavailableTeams = new Map<ITeam, MatchupFailureReason>(unavailableTeams);
    for (const team of removedTeams)
        newUnavailableTeams.set(team, MatchupFailureReason.ALL_AVAILABILITY_ALREADY_OCCURRED);

    return {teamsByTimeSlot, unavailableTeams};
}


function newTimeSlot(cache: Map<string, ITimeSlot>, day: Day, ordinal: number): Writeable<ITimeSlot> {
    const key: string = JSON.stringify({day: day.toLowerCase(), ordinal});
    if (cache.has(key)) {
        return cache.get(key)!;
    } else {
        const timeSlot = {day, ordinal};
        cache.set(key, timeSlot);
        return timeSlot;
    }
}


const days: readonly Day[] = Object.freeze(["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"]);

export const translateTimeSlotToDate: TimeSlotToDateTranslator =
    (timeSlot: Omit<ITimeSlot, 'date'>, scheduledDate: Date): Date => {
        const dayOfWeekIndex = days.indexOf(timeSlot.day.toLowerCase());
        if (0 <= dayOfWeekIndex) {
            const date = new Date(scheduledDate);
            date.setDate(date.getDate() + (dayOfWeekIndex - date.getDay()));
            return date;
        }
        throw new Error(`Invalid day of the week: ${timeSlot.day}`);
    }


export function sortScheduledMatchupsByTime(a: IScheduledMatchup, b: IScheduledMatchup): number {
    const result = (a.time.date?.getTime() ?? Infinity) - (b.time.date?.getTime() ?? Infinity);
    return result === 0 ? a.time.ordinal - b.time.ordinal : result;
}
