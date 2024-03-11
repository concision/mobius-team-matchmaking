import {IndividualMutator} from "../../../genetic/api/IndividualMutator";
import {ITimeSlot} from "../../api/ITimeSlot";
import {randomIndex, selectRandomWeightedElement, selectUniqueRandomElements} from "../../../utilities/Random";
import {IMatchupSchedule, ITeamMatchupGene} from "../../api/MatchmakingGeneticTypes";
import {IMobiusTeam} from "../MobiusMatchmakingConfig";

export class MutationAddNewMatchup<TTeam extends IMobiusTeam = IMobiusTeam> extends IndividualMutator<IMatchupSchedule<TTeam>> {
    public constructor(name: string = "addNewMatchup") {
        super(name);
    }

    public override mutate(
        parent: IMatchupSchedule<TTeam>,
        population: readonly IMatchupSchedule<TTeam>[],
    ): IMatchupSchedule<TTeam> | undefined {
        // find a timeslot to add a new matchup
        const chosen = selectRandomWeightedElement(
            [...parent.unmatchedTeams.entries()].filter(([, teams]) => 2 <= teams.length),
            ([, teams]) => teams.length * (teams.length + 1) / 2
        );
        if (!chosen)
            return;
        const [timeSlot, possibleTeams] = chosen;
        const [firstTeam, secondTeam] = selectUniqueRandomElements(possibleTeams, 2);

        return {
            // remove the teams from the unmatched list
            unmatchedTeams: new Map(parent.unmatchedTeams)
                .set(timeSlot, possibleTeams.filter(team => team !== firstTeam && team !== secondTeam)),
            // add new matchup
            matchups: [...parent.matchups, {timeSlot, teams: [firstTeam, secondTeam]}],
        };
    }
}

export class MutationRemoveMatchup<TTeam extends IMobiusTeam = IMobiusTeam> extends IndividualMutator<IMatchupSchedule<TTeam>> {
    public constructor(name: string = "removeMatchup") {
        super(name);
    }

    public override mutate(
        parent: IMatchupSchedule<TTeam>,
        population: readonly IMatchupSchedule<TTeam>[],
    ): IMatchupSchedule<TTeam> | undefined {
        if (0 < parent.matchups.length) {
            const matchups = [...parent.matchups];
            const removedMatchup = matchups.splice(randomIndex(matchups), 1)[0];

            const unmatchedTeams = new Map<ITimeSlot, readonly TTeam[]>(parent.unmatchedTeams);
            unmatchedTeams.set(removedMatchup.timeSlot, [...parent.unmatchedTeams.get(removedMatchup.timeSlot)!, ...removedMatchup.teams]);
            return {unmatchedTeams, matchups};
        }
    }
}

export class MutationSwapMatchupInTimeSlot<TTeam extends IMobiusTeam = IMobiusTeam> extends IndividualMutator<IMatchupSchedule<TTeam>> {
    public constructor(name: string = "swapTimeSlotMatchup") {
        super(name);
    }

    public override mutate(
        parent: IMatchupSchedule<TTeam>,
        population: readonly IMatchupSchedule<TTeam>[],
    ): IMatchupSchedule<TTeam> | undefined {
        const matchupsByTimeSlot: ReadonlyMap<ITimeSlot, ITeamMatchupGene<TTeam>[]> = parent.matchups.reduce((map, matchup) => {
            const teams = map.get(matchup.timeSlot);
            if (teams)
                teams.push(matchup);
            else
                map.set(matchup.timeSlot, [matchup]);
            return map;
        }, new Map<ITimeSlot, ITeamMatchupGene<TTeam>[]>());

        const chosen = selectRandomWeightedElement(
            Array.from(matchupsByTimeSlot.entries()).filter(([, matchups]) => 2 <= matchups.length),
            ([, matchups]) => matchups.length * (matchups.length - 1) / 2
        );
        if (!chosen)
            return;
        const [timeSlot, matchups] = chosen;
        const [firstTeam, secondTeam] = selectUniqueRandomElements(matchups, 2);
        return {
            unmatchedTeams: parent.unmatchedTeams,
            // swap teams in the time slot
            matchups: parent.matchups
                .filter(team => team !== firstTeam && team !== secondTeam)
                .concat(<ITeamMatchupGene<TTeam>[]>[
                    {timeSlot, teams: [firstTeam.teams[0], secondTeam.teams[0]]},
                    {timeSlot, teams: [firstTeam.teams[1], secondTeam.teams[1]]}
                ]),
        };
    }
}
