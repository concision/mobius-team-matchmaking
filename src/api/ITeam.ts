import {type PlayedMatchup} from './ITeamMatchup';
import {Day} from "./ITimeSlot";

/**
 * Represents a team of players competing in the league. This data structure is used as the input to the matchmaking
 * algorithm; see {@link IMatchmakingOptions.teams}.
 */
export interface ITeam {
    /**
     * A Discord snowflake identifier that uniquely identifies the team. Note that this also contains the timestamp of
     * when the team was created.
     *
     * @example
     * "1181363728239841310"
     * @example
     * The date may be computed by converting the snowflake using the Discord epoch:
     * const discordEpoch = 1420070400000
     * const date = new Date(Number(BigInt(snowflake) >> 22n) + discordEpoch);
     */
    readonly snowflake: string;
    /**
     * A human-readable display name, selected by the team owner.
     */
    readonly name: string;
    /**
     * The geographic region in which the team is located. This is used by the matchmaking algorithm to prevent
     * scheduling teams across different regions (due to latency fairness concerns).
     * @example
     * "NA"
     * "EU"
     */
    readonly region: string;

    /**
     * The team's current Elo rating, which is used for skill-based-matchmaking (see
     * {@link https://en.wikipedia.org/wiki/Elo_rating_system}).
     */
    readonly elo: number;

    /**
     * Represents the availability of the team for each day of the week. The outer object is keyed by {@link Day}, and the
     * inner array is a boolean array representing the team's availability for each time slot of the day. Any non-boolean
     * values will be coerced to a boolean.
     *
     * The inner array represents "back-to-back" games, e.g. index 0 might refer to 8pm and index 1 might
     * refer to 9pm. By default, a team cannot be scheduled for back-to-back games, but this may be overridden in
     * {@link IMatchmakingOptions}.
     *
     * Note that while the index of this dictionary is a {@link Day}, any string is permitted as a key. This may be
     * useful if the league has a different weekly schedule, e.g. matches start on a thursday and end on next week's
     * wednesday. If non-standard keys are used, then {@link ITimeSlot.date} will be null in the matchmaking output.
     *
     * @example
     * For example, the following availability
     * {"tuesday": [true, false, true], "friday": [0, 0, 1]}
     * is equivalent to a team being available at the following times:
     * [("tuesday", 0), ("tuesday", 2), ("friday", 2)]
     */
    readonly availability: { [D in Day]?: readonly boolean[]; };

    /**
     * A history of matchups in which the team has participated. The game history should be ordered in ascending time
     * order, e.g. the last element is the most recent. By default, this is used by the matchmaking algorithm to prevent
     * rematches, or to provide a more balanced matchup.
     *
     * This is an optional property, and may be omitted if the history is not available or not needed.
     */
    readonly history?: PlayedMatchup[];
}
