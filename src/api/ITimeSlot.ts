import {IDefaultMatchmakingParameters} from "./TeamMatchmaking";

/**
 * Represents a day of the week, which is used to indicate the availability of a team in {@link ITeam.availability}
 * and the time slot in {@link ITimeSlot.day}.
 *
 * Note that these values should typically be a day of the week in lowercase, but may be any string.
 */
export type Day = 'sunday' | 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | string;

/**
 * Represents a time slot for a matchup. A time slot is composed of a day and an ordinal referring to which time slot
 * in the day.
 * @example
 * If there are 3 time slots in a day, 8pm, 9pm, and 10pm, then the ordinal for 8pm is 0, 9pm is 1, and 10pm is 2. E.g.,
 * {day: "2021-09-01T00:00:00.000Z", ordinal: 2}
 * represents the 10pm time slot on September 1st, 2021. Note that the day is ISO 8601 UTC, but the ordinal typically
 * refers to a local time for a specific region.
 */
export interface ITimeSlot {
    /**
     * The day of the week for the time slot.
     * @example
     * "sunday"
     * "monday"
     */
    readonly day: Day;
    /**
     * The ordinal of the time slot for the specified day. This is a number that represents the position of the time
     * slot in the day. This typically represents a local time for a specific region.
     *
     * @example
     * 0 refers to the first time slot in the day, 8pm
     * 1 refers to the second time slot in the day, 9pm
     * 2 refers to the third time slot in the day, 10pm
     */
    readonly ordinal: number;

    /**
     * The exact date and time of the time slot, or null if not yet set.
     *
     * Consumers should set this value with the exact time for any {@link IPlayedMatchup.time}.
     *
     * This property may be provided by the output of the matchmaking API for {@link IScheduledMatchup.time} and is
     * computed by {@link IDefaultMatchmakingParameters.timeSlotToDateTranslator}. By default, this translates all known
     * days of the week to the first moment of the day (at UTC time, not local time). This callback may be overridden to
     * provide an exact date and time for the time slot.
     */
    readonly date?: Date | null;
}