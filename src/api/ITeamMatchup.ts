import {ITeamNotYetPlayed, ITeamParticipant, ITeamPlayed, TeamMatchResult} from "./ITeamParticipant";
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
export interface IScheduledMatchup extends ITeamMatchupBase {
    readonly teams: readonly [ITeamNotYetPlayed, ITeamNotYetPlayed];
    readonly played: false;
}

/**
 * A matchup that has already occurred (i.e. {@link #played} is true). See {@link ITeamMatchup}.
 *
 * A default implementation for consumers to supply history on {@link ITeam.history} is provided by
 * {@link PlayedMatchup}.
 */
export interface IPlayedMatchup extends ITeamMatchupBase {
    /**
     * The time at which the matchup occurred or is scheduled to occur. Note that {@link ITimeSlot.date} should be set
     * with the exact date and time of the matchup.
     */
    readonly time: ITimeSlot;
    readonly teams: readonly [ITeamPlayed, ITeamPlayed];
    readonly played: true;

    /**
     * Indicates whether the matchup was a draw. If true, then the matchup was a draw for both teams; otherwise, one
     * team won and the other lost. Note that this property is derived from {@link #teams}.
     */
    get isDraw(): boolean;

    /**
     * A shorthand property to grab the winning team reference in {@link #teams}. If the game was a draw, then this will
     * be undefined. Note that this property is derived from {@link #teams}.
     */
    get winner(): ITeamPlayed | undefined;

    /**
     * A shorthand property to grab the losing team reference in {@link #teams}. If the game was a draw, then this will
     * be undefined. Note that this property is derived from {@link #teams}.
     */
    get loser(): ITeamPlayed | undefined;
}

/**
 * Consumer implementation of {@link IPlayedMatchup} for dynamic get properties.
 */
export class PlayedMatchup implements IPlayedMatchup {
    public readonly time: ITimeSlot;
    public readonly teams: readonly [ITeamPlayed, ITeamPlayed];
    public readonly played: true;

    constructor(time: ITimeSlot, teams: readonly ITeamPlayed[]);

    constructor(time: ITimeSlot, teams: readonly [ITeamPlayed, ITeamPlayed]) {
        if (time === undefined)
            throw new Error(`A played matchup must have a time slot`);
        if (teams.length !== 2)
            throw new Error(`A played matchup must have exactly 2 teams; however, received ${teams.length} team(s)`);
        this.time = time;
        this.teams = teams;
        this.played = true;
    }

    public get isDraw(): boolean {
        return this.teams.find(team => team.status === TeamMatchResult.Draw) !== undefined;
    }

    public get winner(): ITeamPlayed | undefined {
        return this.teams.find(team => team.status === TeamMatchResult.Won);
    }

    public get loser(): ITeamPlayed | undefined {
        return this.teams.find(team => team.status === TeamMatchResult.Lost || team.status === TeamMatchResult.NoShow);
    }
}

/**
 * A matchup between two teams. If {@link ITeamMatchupBase.played} is true, then this is a {@link PlayedMatchup}
 * (a matchup that has already been played). Otherwise, it is a {@link IScheduledMatchup} (a matchup that is scheduled
 * in the future).
 */
export type ITeamMatchup = IPlayedMatchup | IScheduledMatchup;
