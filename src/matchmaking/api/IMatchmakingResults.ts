import {ITeam} from "./ITeam";
import {IScheduledMatchup} from "./ITeamMatchup";
import {ITimeSlot} from "./ITimeSlot";

/**
 * Represents the result of executing the matchmaking algorithm on a set of teams. This structure contains the matchups
 * that have been scheduled, teams that were unable to be matched, as well as various other statistics and data.
 */
export interface IMatchmakingResults<TTeam extends ITeam = ITeam> {
    /**
     * A list of all teams that were input into the matchmaking algorithm. If team partitioning was set via
     * {@link IMatchmakingOptions.partitionBy}, then this list will be a subset of teams for the current partition.
     */
    readonly teams: readonly TTeam[];

    /**
     * A list of paired team matchups that have been scheduled by the matchmaking algorithm. Any teams that are unable
     * to be matched with another competing team will be placed in {@link #unmatchedTeams}.
     */
    readonly scheduledMatchups: readonly IScheduledMatchup<TTeam>[];

    /**
     * A map of teams that were unable to be matched against a team in any time slot. This could have occurred for a
     * variety of reasons, such as lack of team availability, or lack of teams in the region. The keys are a subset of
     * the input teams {@link IMatchmakingOptions.teams}, and the values are the reasons that matchmaking failed.
     */
    readonly unmatchedTeams: ReadonlyMap<TTeam, MatchupFailureReason>;

    /**
     * A map of time slots to the teams that are available to compete in that time slot.
     */
    readonly teamAvailability: ReadonlyMap<ITimeSlot, readonly TTeam[]>;

    /**
     * The total possible number of unique matchup schedules (i.e. "search space") that the matchmaking algorithm
     * must explore through in order to find the best possible matchups. Note that this does not represent the number
     * of explored schedules, but rather the total number of possible schedules that could be explored.
     */
    readonly searchSpace: bigint;
}

export interface IPartitionedMatchmakingResults<TTeam extends ITeam = ITeam, TPartitionKey = string>
    extends Pick<IMatchmakingResults, 'unmatchedTeams' | 'searchSpace'> {
    readonly results: ReadonlyMap<TPartitionKey, IMatchmakingResults<TTeam>>;
}

/**
 * Indicates the reason why a team was unable to be matched with any other competing team.
 */
export enum MatchupFailureReason {
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
     * Indicates that the team has some availability, but all of their available time slots are in the past.
     */
    ALL_AVAILABILITY_ALREADY_OCCURRED = 2,
}
