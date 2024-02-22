import {type ITeam} from './ITeam';
import {IScheduledMatchup} from './ITeamMatchup';

/**
 * Represents the input options for the matchmaking algorithm.
 */
export interface IMatchmakingOptions {
    /**
     * The teams that are competing in the league, and are to be matched up by the matchmaking algorithm.
     */
    readonly teams: readonly ITeam[];
    /**
     * The week in which the match-ups are to be scheduled. Any output {@link IScheduledMatchup.time} will be set to
     * a time slot in this specified week. If not provided, then the current date will be used. Any time slots that have
     * already occurred will be ignored and no matches will be made; e.g. if the input day of the week is a wednesday,
     * then no matches will be scheduled for sunday through tuesday.
     */
    readonly week?: Date;
    /**
     * The maximum number of games that a team can play during the week.
     */
    readonly maximumGames?: number;
}

/**
 * Represents the result of executing the matchmaking algorithm on a set of teams. This structure contains the match-ups
 * that have been scheduled, as well as any teams that were unable to be matched.
 */
export interface ITeamMatchups {
    /**
     * A list of paired team match-ups that have been scheduled by the matchmaking algorithm. Any teams that are unable
     * to be matched with another competing team will be placed in {@link #unmatched}.
     */
    readonly matchups: readonly IScheduledMatchup[];
    /**
     * A list of teams that were unable to be matched. This could have occurred for a variety of reasons, such as
     * lack of team availability, or lack of teams in the region. This is a subset of the input teams.
     */
    readonly unmatched: readonly ITeam[];
}

/**
 * Performs the matchmaking algorithm on a set of teams that are all in the same region. This may be useful for
 * computing match-ups for a single region (e.g. in case a specific region needs to be recomputed due to changes).
 *
 * @param options The input options for the matchmaking algorithm. See {@link IMatchmakingOptions}.
 * @exception Error If input teams are not all in the same region, then an exception will be thrown.
 * @exception Error If {@link options.maximumGames} is not a positive integer, then an exception will be thrown.
 */
export type matchmakeTeams = (options: IMatchmakingOptions) => ITeamMatchups;

/**
 * Performs the matchmaking algorithm on a set of teams, automatically partitioning them by region. This is a
 * convenience method computing match-ups for all regions in the league at once. If a specific region needs to be
 * recomputed due to changes, use {@link matchmakeTeams} directly or invoke this with a subset of the teams.
 *
 * @param options The input options for the matchmaking algorithm. See {@link IMatchmakingOptions}.
 * @exception Error If {@link options.maximumGames} is not a positive integer, then an exception will be thrown.
 */
export type matchmakeTeamsByRegion = (options: IMatchmakingOptions) => ITeamMatchups;
