import {GeneticParameters} from "../../genetic/api/GeneticParameters";
import {IGeneticAlgorithmResults} from "../../genetic/GeneticAlgorithm";
import {KeysOfType, UndefinedValues} from "../../utilities/TypescriptTypes";
import {ITeam} from './ITeam';
import {IScheduledMatchup} from './ITeamMatchup';
import {ITimeSlot, TimeSlotToDateTranslator} from "./ITimeSlot";
import {IMatchupSchedule} from "./MatchmakingGeneticTypes";

/**
 * Configurable options for the matchmaking algorithm for {@link matchmakeTeams}.
 */
export interface IMatchmakingOptions<TTeam extends ITeam = ITeam, TPartitionKey = string> {
    /**
     * This property configures the genetic algorithm implementation that is used to compute the matchups.
     *
     * There exists a default implementation {@link MobiusMatchmakingConfig}.
     */
    readonly config: MatchmakingConfig<TTeam, TPartitionKey>;

    /**
     * If some subsets of teams are mutually exclusive (e.g. region), then this property may be used to partition the
     * teams into separate groups that will be match-made independently. If this property is not provided, then the
     * teams will be match-made together in a single group.
     *
     * This property may be a key of {@link ITeam} that is used to partition the teams, or a function that returns the
     * partition key for a given team.
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
     * Ignores any time slots that have already occurred. If true, then any time slots that have already occurred will
     * be ignored and no matches will be made for those time slots. If false, then the algorithm will attempt to match
     * teams for all time slots, regardless of whether they have already occurred.
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


/**
 * Partitions teams into a mutually exclusive groups. Each team is partitioned by the key returned by this function.
 */
export type TeamPartitioner<TTeam extends ITeam = ITeam, TPartitionKey = string> = (team: TTeam) => TPartitionKey;


export interface IMatchmakingParameters<TTeam extends ITeam = ITeam, TPartitionKey = string> {
    readonly options: IConfiguredMatchmakingOptions<TTeam, TPartitionKey>;
    readonly partitionKey: TPartitionKey | undefined;

    readonly teamsByTimeSlot: ReadonlyMap<ITimeSlot, readonly TTeam[]>;
}

/**
 * Configures the genetic algorithm implementation that is used to compute the matchups.
 */
export abstract class MatchmakingConfig<TTeam extends ITeam = ITeam, TPartitionKey = string, TMetricCollector = any> {
    /**
     * Provides a genetic algorithm configuration that is used to compute the matchups.
     * @param parameters The requested matchmaking API parameters.
     */
    public abstract configure(parameters: IMatchmakingParameters<TTeam, TPartitionKey>): GeneticParameters<IMatchupSchedule<TTeam>, TMetricCollector>;

    /**
     * Selects a desired solution from the genetic algorithm results.
     * @param matchups The genetic algorithm results.
     */
    public selectSolution(matchups: IGeneticAlgorithmResults<IMatchupSchedule<TTeam>, TMetricCollector>): IMatchupSchedule<TTeam> {
        return matchups.population[0].solution;
    }
}
