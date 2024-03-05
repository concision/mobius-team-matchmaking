import {ITeam} from './ITeam';
import {IScheduledMatchup} from './ITeamMatchup';
import {ITimeSlot} from "./ITimeSlot";
import {IGeneticOptions} from "./genetic/GeneticAlgorithm";
import {Writeable} from "./genetic/TypescriptTypes";

/**
 * Configurable options for the matchmaking algorithm for {@link matchmakeTeams} and {@link matchmakeTeamsByRegion}.
 *
 * {@link teams} and {@link configure} are the main components for the matchmaking algorithm. The other properties are
 * parameters that affect the default implementation behavior of the algorithm.
 */
export interface IMatchmakingOptions {
    /**
     * An array of teams that are competing in the season's league. These teams will attempt to be paired up by the
     * matchmaking algorithm, referred to as a "matchup".
     */
    readonly teams: readonly ITeam[];

    /**
     * This property configures the genetic algorithm implementation that is used to compute the matchups. This is an
     * optional property, and may be omitted if the default genetic algorithm is sufficient. If provided, then the
     * supplied function will be invoked to override the genetic algorithm's default configuration.
     *
     * {@link options} is the default configuration for the genetic algorithm. The consumer may override any
     * configuration properties to customize the genetic algorithm's behavior. Or, the consumer may return an entirely
     * different custom configuration object.
     */
    readonly configure?: (options: Writeable<IGeneticOptions<ITeamMatchupsIndividual>>) => IGeneticOptions<ITeamMatchupsIndividual> | void;

    /**
     * Configures the default parameters for the default implementation of the matchmaking algorithm. This may be useful
     * for tweaking the default behavior of the matchmaking algorithm without having to provide a fully custom genetic
     * algorithm configuration. Note that if {@link configure} provides a new genetic algorithm configuration, then this
     * property will have no effect.
     */
    readonly defaultParameters?: IDefaultMatchmakingParameters;
}

/**
 * The supported parameters that customize the default matchmaking algorithm's behavior, settable in
 * {@link IMatchmakingOptions.defaultParameters}. All options are optional and have default values if unspecified.
 */
export interface IDefaultMatchmakingParameters {
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
    readonly timeSlotToDateTranslator?: (timeSlot: Omit<ITimeSlot, 'date'>, week: Date) => Date | undefined;

    /**
     * The minimum number of games that a team can play during the week.
     */
    readonly minimumGames?: number;
    /**
     * The maximum number of games that a team can play during the week.
     */
    readonly maximumGames?: number;

    /**
     * The number of days in which a rematch is considered a duplicate. If a team has played another team within this
     * number of days, then the rematch will be considered a duplicate and will be significantly less likely to occur.
     *
     * By default, this value is 14. Setting to 0 will disable this feature.
     */
    readonly preventDuplicateMatchupsInLastXDays?: number;
    /**
     * The number of days in which to consider a team's recent matchups when attempting to minimize the differences in
     * the number of games played by each team.
     *
     * By default, this value is 21. Setting to 0 will disable this feature.
     */
    readonly countGamesPlayedInLastXDays?: number;
}


/**
 * Indicates the reason why a team was unable to be matched with any other competing team.
 */
export enum FailedMatchupReason {
    /**
     * Indicates that the team has no ideal matchups available. This could be due to a variety of reasons that the
     * matchmaking implementation decided not to match-make the team.
     */
    NO_IDEAL_MATCHUPS = 0,
    /**
     * Indicates the team has no scheduled availability.
     */
    UNSCHEDULED_AVAILABILITY = 1,
    /**
     * Indicates that there are not enough competing teams in the time slots to match with the team.
     */
    NOT_ENOUGH_COMPETITION_IN_TIME_SLOTS = 3,
}

/**
 * Represents the result of executing the matchmaking algorithm on a set of teams. This structure contains the matchups
 * that have been scheduled, as well as any teams that were unable to be matched.
 */
export interface ITeamMatchups {
    /**
     * A list of paired team matchups that have been scheduled by the matchmaking algorithm. Any teams that are unable
     * to be matched with another competing team will be placed in {@link #unmatchedTeams}.
     */
    readonly scheduledMatchups: readonly IScheduledMatchup[];

    /**
     * A map of teams that were unable to be matched against a team in any time slot. This could have occurred for a
     * variety of reasons, such as lack of team availability, or lack of teams in the region. The keys are a subset of
     * the input teams {@link IMatchmakingOptions.teams}, and the values are the reasons that matchmaking failed.
     */
    readonly unmatchedTeams: ReadonlyMap<ITeam, FailedMatchupReason>;
}


/**
 * Performs the matchmaking algorithm on a set of teams that are all in the same region. This may be useful for
 * computing matchups for a single region (e.g. in case a specific region needs to be recomputed due to changes).
 *
 * @param options The input options for the matchmaking algorithm. See {@link IMatchmakingOptions}.
 * @exception Error If input teams are not all in the same region, then an exception will be thrown.
 * @exception Error If {@link options.maximumGames} is not a positive integer, then an exception will be thrown.
 */
export type matchmakeTeams = (options: IMatchmakingOptions) => ITeamMatchups;

/**
 * Performs the matchmaking algorithm on a set of teams, automatically partitioning them by region. This is a
 * convenience method computing matchups for all regions in the league at once. If a specific region needs to be
 * recomputed due to changes, use {@link matchmakeTeams} directly or invoke this with a subset of the teams.
 *
 * @param options The input options for the matchmaking algorithm. See {@link IMatchmakingOptions}.
 * @exception Error If {@link options.maximumGames} is not a positive integer, then an exception will be thrown.
 */
export type matchmakeTeamsByRegion = (options: IMatchmakingOptions) => ITeamMatchups;


// matchmaking genetic algorithm types

export interface ITeamMatchupGene {
    readonly timeSlot: ITimeSlot;
    readonly teams: readonly ITeam[];
}

export interface ITeamMatchupsIndividual {
    readonly unmatchedTeams: ReadonlyMap<ITimeSlot, readonly ITeam[]>;
    readonly matchups: readonly ITeamMatchupGene[];
}
