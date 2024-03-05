import {Day, ITimeSlot} from "../api/ITimeSlot";
import {TimeSlotToDateTranslator} from "../api/TeamMatchmaking";
import {ITeam} from "../api/ITeam";
import {IScheduledMatchup} from "../api/ITeamMatchup";
import {Writeable} from "../api/genetic/TypescriptTypes";

export interface ITeamsPartitionedByTimeSlot {
    teamsByTimeSlot: ReadonlyMap<ITimeSlot, readonly ITeam[]>;
    unavailableTeams: readonly ITeam[];
}

export function partitionTeamsByTimeSlots(
    scheduledDate: Date,
    dateTranslator: TimeSlotToDateTranslator,
    teams: readonly ITeam[],
): ITeamsPartitionedByTimeSlot {
    const currentTime = Date.now();
    const timeSlotCache = new Map<string, ITimeSlot>();

    const uniqueTimeSlots: Set<Writeable<ITimeSlot>> = teams
        .flatMap((team: ITeam) => (<Day[]>Object.keys(team.availability))
            .flatMap(day => team.availability[day]!
                .map((isAvailable: boolean, ordinal: number) => isAvailable ? ofTimeSlot(timeSlotCache, day, ordinal) : null)
                .filter((timeSlot): timeSlot is Writeable<ITimeSlot> => timeSlot !== null)
            )
        )
        .reduce((map, timeSlot) => map.add(timeSlot), new Set<ITimeSlot>());
    for (const uniqueTimeSlot of uniqueTimeSlots)
        uniqueTimeSlot.date = dateTranslator(uniqueTimeSlot, scheduledDate);

    const teamsByTimeSlot = new Map<ITimeSlot, ITeam[]>();
    for (const timeSlot of uniqueTimeSlots.values())
        teamsByTimeSlot.set(timeSlot, []);
    const unavailableTeams: ITeam[] = [];

    for (const team of teams) {
        const teamTimeSlots = (<Day[]>Object.keys(team.availability))
            .flatMap(day => team.availability[day]!
                .map((isAvailable: boolean, ordinal: number) => isAvailable ? ofTimeSlot(timeSlotCache, day, ordinal) : null)
                .filter((timeSlot): timeSlot is ITimeSlot => timeSlot !== null)
            )
            .filter(timeSlot => currentTime < (timeSlot.date?.getTime() ?? Infinity));

        if (teamTimeSlots.length !== 0)
            for (const teamTimeSlot of teamTimeSlots)
                teamsByTimeSlot.get(teamTimeSlot)!.push(team);
        else
            unavailableTeams.push(team);
    }

    return {teamsByTimeSlot, unavailableTeams};
}


function ofTimeSlot(cache: Map<string, ITimeSlot>, day: Day, ordinal: number): Writeable<ITimeSlot> {
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
