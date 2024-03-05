import {ITeamMatchupsIndividual} from "../api/TeamMatchmaking";
import {IndividualMutator} from "../api/genetic/IndividualMutator";

export class MutationAddNewMatchup extends IndividualMutator<ITeamMatchupsIndividual> {
    public constructor(name: string = "addNewMatchup") {
        super(name);
    }

    public override mutate(
        parent: ITeamMatchupsIndividual,
        population: readonly ITeamMatchupsIndividual[],
    ): ITeamMatchupsIndividual | undefined {
        // find a timeslot to add a new matchup
        const possiblePairingsByTimeSlots = [...parent.unmatchedTeams.entries()]
            .filter(([, teams]) => 2 <= teams.length)
            .map(([timeSlot, teams]) => ({timeSlot, pairs: teams.length * (teams.length + 1) / 2}));
        const totalPossiblePairings = possiblePairingsByTimeSlots.reduce((sum, slot) => sum + slot.pairs, 0);
        if (totalPossiblePairings <= 0)
            return;
        let chosenPair;
        let random = Math.floor(Math.random() * totalPossiblePairings);
        for (let pairing of possiblePairingsByTimeSlots) {
            random -= pairing.pairs;
            if (random <= 0) {
                chosenPair = pairing;
                break;
            }
        }
        const timeSlot = chosenPair!.timeSlot;
        const possibleTeams = parent.unmatchedTeams.get(timeSlot)!;

        // choose 2 random teams
        const first: number = Math.floor(Math.random() * possibleTeams.length);
        let second: number;
        do {
            second = Math.floor(Math.random() * possibleTeams.length);
        } while (first === second);

        return {
            // remove the teams from the unmatched list
            unmatchedTeams: new Map(parent.unmatchedTeams)
                .set(timeSlot, possibleTeams.filter((_, index) => index !== first && index !== second)),
            // add new matchup
            matchups: [...parent.matchups, {timeSlot, teams: [possibleTeams[first], possibleTeams[second]]}],
        };
    }
}

export class MutationRemoveMatchup extends IndividualMutator<ITeamMatchupsIndividual> {
    public constructor(name: string = "removeMatchup") {
        super(name);
    }

    public override mutate(
        parent: ITeamMatchupsIndividual,
        population: readonly ITeamMatchupsIndividual[],
    ): ITeamMatchupsIndividual | undefined {
        if (0 < parent.matchups.length) {
            const matchups = [...parent.matchups];
            const removedMatchup = matchups.splice(Math.floor(Math.random() * matchups.length), 1)[0];

            const unmatchedTeams = new Map(parent.unmatchedTeams);
            unmatchedTeams.set(removedMatchup.timeSlot, [...parent.unmatchedTeams.get(removedMatchup.timeSlot)!, ...removedMatchup.teams]);
            return {unmatchedTeams, matchups};
        }
    }
}

export class MutationSwapMatchupInTimeSlot extends IndividualMutator<ITeamMatchupsIndividual> {
    public constructor(name: string = "swapTimeSlotMatchup") {
        super(name);
    }

    public override mutate(
        parent: ITeamMatchupsIndividual,
        population: readonly ITeamMatchupsIndividual[],
    ): ITeamMatchupsIndividual | undefined {
        return undefined; // TODO
    }
}

export class MutationSwapMatchupAcrossTimeSlots extends IndividualMutator<ITeamMatchupsIndividual> {
    public constructor(name: string = "swapTeamMatchupAcrossTimeSlots") {
        super(name);
    }

    public override mutate(
        parent: ITeamMatchupsIndividual,
        population: readonly ITeamMatchupsIndividual[],
    ): ITeamMatchupsIndividual | undefined {
        return undefined; // TODO
    }
}

export class CrossOverCombineMatchups extends IndividualMutator<ITeamMatchupsIndividual> {
    public constructor(name: string = "crossOverMatchups") {
        super(name);
    }

    public override mutate(
        parent: ITeamMatchupsIndividual,
        population: readonly ITeamMatchupsIndividual[],
    ): ITeamMatchupsIndividual | undefined {
        return undefined; // TODO
    }
}
