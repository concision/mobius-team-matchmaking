import {IScheduledMatchup} from "./ITeamMatchup";
import {ITeam} from "./ITeam";
import {ITimeSlot} from "./ITimeSlot";

export interface IPartitionedMatchmakingResults<TTeam extends ITeam = ITeam, TPartitionKey = string>
    extends Pick<IMatchmakingResults, 'unmatchedTeams'> {
    readonly results: ReadonlyMap<TPartitionKey, IMatchmakingResults<TTeam>>;
}

/**
 * Represents the result of executing the matchmaking algorithm on a set of teams. This structure contains the matchups
 * that have been scheduled, as well as any teams that were unable to be matched.
 */
export interface IMatchmakingResults<TTeam extends ITeam = ITeam> {
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
     * TODO
     */
    readonly teamAvailability: ReadonlyMap<ITimeSlot, readonly TTeam[]>;
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
