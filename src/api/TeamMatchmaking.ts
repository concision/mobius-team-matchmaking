import {ITeam} from './ITeam';
import {IScheduledMatchup} from './ITeamMatchup';
import {ITimeSlot} from "./ITimeSlot";
import {IGeneticOptions} from "./genetic/GeneticAlgorithm";

/**
 * Configurable options for the matchmaking algorithm for {@link matchmakeTeams} and {@link matchmakeTeamsByRegion}.
 */
export interface IMatchmakingOptions {
    /**
     * An array of teams that are competing in the season's league. These teams will attempt to be paired up by the
     * matchmaking algorithm, referred to as a "matchup".
     */
    readonly teams: readonly ITeam[];

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
     * {@link availabilityTranslator} to handle these non-standard keys.
     */
    readonly scheduledWeek?: Date;
    /**
     * Translates a time slot to an exact date and time. This is useful for consumers to override the default behavior
     * of setting the date to the first moment of the day, or for using non-standard keys in {@link ITeam.availability}.
     */
    readonly availabilityTranslator?: (timeSlot: Omit<ITimeSlot, 'date'>, week: Date) => Date | undefined;

    /**
     * The maximum number of games that a team can play during the week.
     */
    readonly maximumGames?: number;
    /**
     * The number of weeks in which a rematch is considered a duplicate. If a team has played another team within this
     * number of weeks, then the rematch will be considered a duplicate and will be significantly less likely to occur.
     * By default, this is 2.
     *
     * This is an optional property, and may be omitted if the default value of 2 is sufficient.
     */
    readonly preventDuplicateMatchupsInLastXWeeks?: number;

    /**
     * These matchmaking options are used to configure the genetic algorithm that is used to compute the matchups. This
     * is an optional property, and may be omitted if the default genetic algorithm is sufficient. If provided, then the
     * supplied function will be invoked to override the genetic algorithm's default configuration.
     */
    readonly configure?: (options: IGeneticOptions<ITeamMatchupsIndividual>) => void;
}

/**
 * Represents the result of executing the matchmaking algorithm on a set of teams. This structure contains the matchups
 * that have been scheduled, as well as any teams that were unable to be matched.
 */
export interface ITeamMatchups {
    /**
     * A list of paired team matchups that have been scheduled by the matchmaking algorithm. Any teams that are unable
     * to be matched with another competing team will be placed in {@link #unmatched}.
     */
    readonly matchups: readonly IScheduledMatchup[];
    /**
     * A list of teams that were unable to be matched against a team in any time slot. This could have occurred for a
     * variety of reasons, such as lack of team availability, or lack of teams in the region. This is a subset of the
     * input teams {@link IMatchmakingOptions.teams}.
     */
    readonly unmatched: readonly ITeam[];
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
