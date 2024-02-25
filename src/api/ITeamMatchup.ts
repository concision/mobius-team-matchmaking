import {ITeamNotYetPlayed, ITeamParticipant, ITeamPlayed, TeamMatchResult} from "./ITeamParticipant";

/**
 * Represents a time slot for a match-up. A time slot is composed of a day and an ordinal referring to which time slot
 * in the day.
 * @example
 * If there are 3 time slots in a day, 8pm, 9pm, and 10pm, then the ordinal for 8pm is 0, 9pm is 1, and 10pm is 2. E.g.,
 * ["2021-09-01T00:00:00.000Z", 2]
 * represents the 10pm time slot on September 1st, 2021. Note that the day is ISO 8601 UTC, but the ordinal typically
 * refers to a local time for a specific region.
 */
export type ITimeSlot = [day: Date, ordinal: number];

/**
 * See {@link ITeamMatchup}.
 */
export interface ITeamMatchupBase {
    /**
     * The day and the ordinal of the time slot in which the match-up occurred or is scheduled to occur.
     */
    readonly time: ITimeSlot;
    /**
     * The teams participating in the match-up. The length of this array should always be 2. The order of the teams is
     * arbitrary and should not be relied upon.
     */
    readonly teams: readonly [ITeamParticipant, ITeamParticipant];
    /**
     * Indicates whether the game has occurred or not; if true, additional properties are available on
     * {@link IScheduledMatchup} (e.g. winner, loser, team elo changes)
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
 */
export interface IPlayedMatchup extends ITeamMatchupBase {
    readonly teams: readonly [ITeamPlayed, ITeamPlayed];
    readonly played: true;

    /**
     * Indicates whether the game was a draw or not. If true, then the game was a draw for both teams.
     */
    get IsDraw(): boolean;

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
 * Consumer implementation of {@link IPlayedMatchup} due to dynamic get properties.
 */
export class PlayedMatchup implements IPlayedMatchup {
    readonly time: ITimeSlot;
    readonly teams: readonly [ITeamPlayed, ITeamPlayed];
    readonly played: true;

    constructor(time: ITimeSlot, teams: readonly [ITeamPlayed, ITeamPlayed]) {
        if (time === undefined || time.length !== 2)
            throw new Error(`A time slot must be an array of length 2`);
        if (teams.length !== 2)
            throw new Error(`A played matchup must have exactly 2 teams; however, received ${teams.length} team(s)`);
        this.time = time;
        this.teams = teams;
        this.played = true;
    }

    get IsDraw(): boolean {
        return this.teams.find(team => team.status === TeamMatchResult.Draw) !== undefined;
    }

    get winner(): ITeamPlayed | undefined {
        return this.teams.find(team => team.status === TeamMatchResult.Won);
    }

    get loser(): ITeamPlayed | undefined {
        return this.teams.find(team => team.status === TeamMatchResult.Lost);
    }
}

/**
 * A matchup between two teams. If {@link ITeamMatchupBase.played} is true, then this is a {@link PlayedMatchup}
 * (a matchup that has already been played). Otherwise, it is a {@link IScheduledMatchup} (a matchup that is scheduled in
 * the future).
 */
export type ITeamMatchup = IPlayedMatchup | IScheduledMatchup;
