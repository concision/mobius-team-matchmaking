import {ITeam} from "./ITeam";
import {ITimeSlot} from "./ITimeSlot";

export interface IMatchupSchedule<TTeam extends ITeam = ITeam> {
    readonly unmatchedTeams: ReadonlyMap<ITimeSlot, readonly TTeam[]>;
    readonly matchups: readonly ITeamMatchupGene<TTeam>[];
}

export interface ITeamMatchupGene<TTeam extends ITeam = ITeam> {
    readonly timeSlot: ITimeSlot;
    readonly teams: readonly TTeam[];
}
