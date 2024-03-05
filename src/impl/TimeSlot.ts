import {Day, ITimeSlot} from "../api/ITimeSlot";
import {IDefaultMatchmakingParameters} from "../api/TeamMatchmaking";

export class TimeSlot implements ITimeSlot {
    private static readonly Cache = new Map<string, TimeSlot>();

    public readonly day: Day;
    public readonly ordinal: number;

    public readonly date?: never;

    private constructor(day: Day, ordinal: number) {
        this.day = day;
        this.ordinal = ordinal;
    }

    public static of(day: Day, ordinal: number): ITimeSlot {
        const key: string = JSON.stringify({day: day.toLowerCase(), ordinal});
        if (this.Cache.has(key)) {
            return this.Cache.get(key)!;
        } else {
            const timeSlot = new TimeSlot(day, ordinal);
            this.Cache.set(key, timeSlot);
            return timeSlot;
        }
    }
}


const days: readonly Day[] = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

export const translateTimeSlotToDate: Exclude<IDefaultMatchmakingParameters["timeSlotToDateTranslator"], undefined> =
    (timeSlot: Omit<ITimeSlot, 'date'>, scheduledDate: Date): Date | undefined => {
        const dayOfWeekIndex = days.indexOf(timeSlot.day.toLowerCase());
        if (0 <= dayOfWeekIndex) {
            const date = new Date(scheduledDate);
            date.setDate(date.getDate() + (dayOfWeekIndex - date.getDay()));
            return date;
        }
    }
