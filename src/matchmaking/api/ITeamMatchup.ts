import {ITeam} from "./ITeam";
import {ITeamNotYetPlayed, ITeamParticipant, ITeamPlayed} from "./ITeamParticipant";
import {ITimeSlot} from "./ITimeSlot";

/**
 * See {@link ITeamMatchup}.
 */
export interface ITeamMatchupBase {
    /**
     * The time at which the matchup occurred or is scheduled to occur.
     */
    readonly time: ITimeSlot;
    /**
     * The teams participating in the matchup. The length of this array should always be 2 and the order of the teams is
     * arbitrary and should not be relied upon.
     */
    readonly teams: readonly [ITeamParticipant, ITeamParticipant];
    /**
     * Indicates whether the game has occurred or not; if true, additional properties are available on
     * {@link IScheduledMatchup} (e.g. winner, loser, team elo changes).
     */
    readonly played: boolean;
}

/**
 * A scheduled matchup that has not yet occurred (i.e. {@link #played} is false). See {@link ITeamMatchup}.
 */
export interface IScheduledMatchup<TTeam extends ITeam = ITeam> extends ITeamMatchupBase {
    readonly teams: readonly [ITeamNotYetPlayed<TTeam>, ITeamNotYetPlayed<TTeam>];
    readonly played: false;
}

/**
 * A matchup that has already occurred (i.e. {@link #played} is true). See {@link ITeamMatchup}.
 */
export interface IPlayedMatchup extends ITeamMatchupBase {
    /**
     * The time at which the matchup occurred or is scheduled to occur. Note that {@link ITimeSlot.date} should be set
     * with the exact date and time of the matchup.
     */
    readonly time: ITimeSlot;
    readonly teams: readonly [ITeamPlayed, ITeamPlayed];
    readonly played: true;
}

/**
 * A matchup between two teams. If {@link ITeamMatchupBase.played} is true, then this is a {@link IPlayedMatchup}
 * (a matchup that has already been played). Otherwise, it is a {@link IScheduledMatchup} (a matchup that is scheduled
 * in the future).
 */
export type ITeamMatchup = IPlayedMatchup | IScheduledMatchup;
