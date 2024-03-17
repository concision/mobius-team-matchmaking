import {ITeam} from "./ITeam";
import {ITimeSlot} from "./ITimeSlot";

/**
 * A transient data structure used during the genetic algorithm, representing a schedule of matchups between teams.
 */
export interface IMatchupSchedule<TTeam extends ITeam = ITeam> {
    readonly unmatchedTeams: ReadonlyMap<ITimeSlot, readonly TTeam[]>;
    readonly matchups: readonly ITeamMatchupGene<TTeam>[];
}

/**
 * A matchup between two teams at a specific time slot.
 */
export interface ITeamMatchupGene<TTeam extends ITeam = ITeam> {
    readonly timeSlot: ITimeSlot;
    readonly teams: readonly TTeam[];
}
