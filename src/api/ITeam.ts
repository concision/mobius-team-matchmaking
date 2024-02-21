import {type PlayedMatchup} from './ITeamMatchup';

/**
 * Represents a day of the week, which is used to indicate the availability of a team in {@link ITeam.availability}.
 */
export type Day = 'sunday' | 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday';

/**
 * Represents a team competing in the league. This data structure is used as the input to the matchmaking algorithm.
 */
export interface ITeam {
    /**
     * A Discord snowflake identifier that uniquely identifies the team.
     */
    readonly snowflake: string;
    /**
     * A human-readable name for the team.
     */
    readonly name: string;
    /**
     * The region in which the team is geographically located. Matchmaking is partitioned by region.
     * @example
     * "NA"
     * @example
     * "EU"
     */
    readonly region: string;

    /**
     * The team's current Elo rating, which is used in skill-based-matchmaking
     * (see {@link https://en.wikipedia.org/wiki/Elo_rating_system}).
     */
    readonly elo: number;
    /**
     * Represents the availability of the team for each day of the week. The outer object is keyed by {@link Day}, and the
     * inner array is a boolean array representing the team's availability for each time slot of the day. Any non-boolean
     * values will be coerced to a boolean.
     * @example
     * For example, the following availability
     * {"tuesday": [true, false, true], "friday": [0, 0, 1]}
     * is equivalent to a team being available at the following times:
     * [("tuesday", 0), ("tuesday", 2), ("friday", 2)]
     */
    readonly availability: { [D in Day]?: readonly boolean[]; };

    /**
     * A history of match-ups in which the team has participated. The game history should be ordered in ascending time
     * order, e.g. the last element is the most recent.
     *
     * This may be used by the matchmaking algorithm to prevent rematches, or to provide a more balanced match-up. This
     * is an optional property, and may be omitted if the history is not available or not needed.
     */
    readonly history?: PlayedMatchup[];
}
