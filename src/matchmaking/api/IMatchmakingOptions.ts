import {ITeam} from './ITeam';
import {IScheduledMatchup} from './ITeamMatchup';
import {ITimeSlot} from "./ITimeSlot";
import {IMatchupSchedule} from "./MatchmakingGeneticTypes";
import {KeysOfType, UndefinedValues} from "../../utilities/TypescriptTypes";
import {IMutableGeneticParameters} from "../../genetic/api/IGeneticParameters";

/**
 * Configurable options for the matchmaking algorithm for {@link matchmakeTeams}.
 *
 * {@link teams} and {@link configure} are the main components for the matchmaking algorithm. The other properties are
 * parameters that affect the default implementation behavior of the algorithm.
 */
export interface IMatchmakingOptions<TTeam extends ITeam = ITeam, TPartitionKey = string> {
    /**
     * This property configures the genetic algorithm implementation that is used to compute the matchups. This is an
     * optional property, and may be omitted if the default genetic algorithm is sufficient. If provided, then the
     * supplied function will be invoked to override the genetic algorithm's default configuration.
     *
     * {@link options} is the default configuration for the genetic algorithm. The consumer may override any
     * configuration properties to customize the genetic algorithm's behavior. Or, the consumer may return an entirely
     * different custom configuration object.
     */
    readonly configure: MatchmakingConfig<TTeam, TPartitionKey>;

    /**
     * TODO
     */
    readonly partitionBy?: KeysOfType<TTeam, TPartitionKey> | TeamPartitioner<TTeam, TPartitionKey>;

    /**
     * The matchmaking algorithm currently operates on a weekly basis with a fixed number of time slots per day. This
     * property specifies the week in which the matchups are to be scheduled. If not provided, then the current date
     * will be used.
     *
     * Any time slots that have already occurred will be ignored and no matches will be made for those time slots; e.g.
     * if the input day of the week is a wednesday, then no matches will be scheduled for sunday through tuesday.
     * Consider setting the date to the first instant on a sunday.
     *
     * By default, any output {@link IScheduledMatchup.time}'s {@link ITimeSlot.date} will be set to a date in the
     * specified week.  Note that this is just a default implementation and may be overridden by the consumer. For
     * example, {@link ITeam.availability} may contain non-standard keys, and the consumer may need to provide a custom
     * {@link timeSlotToDateTranslator} to handle these non-standard keys.
     */
    readonly scheduledDate?: Date;
    /**
     * Translates a time slot to an exact date and time. This is useful for consumers to override the default behavior
     * of setting the date to the first moment of the day, or for using non-standard keys in {@link ITeam.availability}.
     */
    readonly timeSlotToDateTranslator?: TimeSlotToDateTranslator;
    /**
     * Ignores any time slots that have already occurred. If true, then any time slots that have already occurred will be
     * ignored and no matches will be made for those time slots. If false, then the algorithm will attempt to match teams
     * for all time slots, regardless of whether they have already occurred.
     *
     * By default, this value is true.
     */
    readonly excludeTimeSlotsThatAlreadyOccurred?: boolean;
}

export type IUnpartitionedMatchmakingOptions<TTeam extends ITeam = ITeam, TPartitionKey = string> =
    IMatchmakingOptions<TTeam, TPartitionKey> & UndefinedValues<Pick<IMatchmakingOptions<TTeam, TPartitionKey>, 'partitionBy'>>;

export type IPartitionedMatchmakingOptions<TTeam extends ITeam = ITeam, TPartitionKey = string> =
    IMatchmakingOptions<TTeam, TPartitionKey> & Required<Pick<IMatchmakingOptions<TTeam, TPartitionKey>, 'partitionBy'>>;

export type IConfiguredMatchmakingOptions<TTeam extends ITeam = ITeam, TPartitionKey = string> =
    Required<IMatchmakingOptions<TTeam, TPartitionKey>>;

export type TeamPartitioner<TTeam extends ITeam = ITeam, TPartitionKey = string> = (team: TTeam) => TPartitionKey;

/**
 * Translates a consumer time slot to an exact date and time. See
 * {@link IMatchmakingOptions.timeSlotToDateTranslator}.
 */
export type TimeSlotToDateTranslator = (timeSlot: Omit<ITimeSlot, 'date'>, week: Date) => Date;


export interface IMatchmakingParameters<TTeam extends ITeam = ITeam, TPartitionKey = string> {
    options: IConfiguredMatchmakingOptions<TTeam, TPartitionKey>;
    partitionKey: TPartitionKey | undefined;

    teamsByTimeSlot: ReadonlyMap<ITimeSlot, readonly TTeam[]>;
}

export abstract class MatchmakingConfig<TTeam extends ITeam = ITeam, TPartitionKey = string> {
    public abstract configure(parameters: IMatchmakingParameters<TTeam, TPartitionKey>): IMutableGeneticParameters<IMatchupSchedule<TTeam>>;
}
