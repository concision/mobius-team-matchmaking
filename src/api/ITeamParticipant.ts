/**
 * Represents the status of a team in a match-up. This is used to indicate whether the team has won, lost, or even
 * drawn. See {@link ITeamBase.status}.
 */
export enum TeamMatchResult {
    /**
     * The team has not yet played in the match-up, i.e. {@link ITeamNotYetPlayed}.
     */
    NotYetPlayed = 0,
    /**
     * The team has lost the match-up. This implies the other competing team in the matchup has won.
     */
    Lost = 1,
    /**
     * The team has won the match-up. This implies the other competing team in the matchup has lost.
     */
    Won = 2,
    /**
     * The team has drawn the match-up (i.e. tied). This implies the other competing team in the matchup has also drawn.
     */
    Draw = 3,
}

/**
 * See {@link ITeamParticipant}.
 */
export interface ITeamBase {
    /**
     * A Discord snowflake identifier that uniquely identifies a team.
     * @example
     * "1181363728239841310"
     */
    readonly snowflake: string;
    /**
     * The team's status in the match-up. For example, if the matchup has not yet occurred, then this will be
     * {@link TeamMatchResult.NotYetPlayed}. If the match-up has occurred, then this could be {@link TeamMatchResult.Lost},
     * {@link TeamMatchResult.Won}, or {@link TeamMatchResult.Draw}.
     */
    readonly status: TeamMatchResult;
}

/**
 * See {@link ITeamParticipant}.
 */
export interface ITeamNotYetPlayed extends ITeamBase {
    readonly status: TeamMatchResult.NotYetPlayed;
}

/**
 * See {@link ITeamParticipant}.
 */
export interface ITeamPlayed extends ITeamBase {
    readonly status: Exclude<TeamMatchResult, TeamMatchResult.NotYetPlayed>;
    /**
     * The team's Elo rating before the match occurred.
     */
    readonly preMatchElo: number;
    /**
     * The team's Elo rating after the match occurred. This may be the same as {@link #preMatchElo} if the game was a
     * tie or cancelled in some way.
     */
    readonly postMatchElo: number;

    /**
     * A derived property calculated by {@link #postMatchElo} minus {@link #preMatchElo}.
     */
    get eloChange(): number;
}

/**
 * Consumer implementation of {@link ITeamPlayed} due to dynamic get properties.
 */
export class TeamPlayed implements ITeamPlayed {
    readonly snowflake: string;
    readonly status: Exclude<TeamMatchResult, TeamMatchResult.NotYetPlayed>;
    readonly preMatchElo: number;
    readonly postMatchElo: number;

    constructor(snowflake: string, status: Exclude<TeamMatchResult, TeamMatchResult.NotYetPlayed>, preMatchElo: number, postMatchElo: number) {
        this.snowflake = snowflake;
        this.status = status;
        this.preMatchElo = preMatchElo;
        this.postMatchElo = postMatchElo;
    }

    get eloChange(): number {
        return this.postMatchElo - this.preMatchElo;
    }
}

/**
 * Represents a data container for a specific team's match results for a specific matchup (i.e. a {@link ITeamMatchup}).
 * This type contains the team's unique identifier, and some additional properties if the game has match-up has already
 * been played.
 *
 * These types should not be used directly, but a refined type will be provided by other APIs. If the matchup has not
 * yet occurred, then this will be a {@link ITeamNotYetPlayed}, otherwise it will be a {@link ITeamPlayed} with additional
 * properties.
 */
export type ITeamParticipant = ITeamNotYetPlayed | ITeamPlayed;
