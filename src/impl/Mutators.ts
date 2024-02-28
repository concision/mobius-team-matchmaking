import {ITeam} from "../api/ITeam";
import {OptionalIndividualMutator} from "./GeneticAlgorithms";
import {ITeamMatchupsIndividual} from "../api/Matchmaking";
import {ITimeSlot} from "../api/ITimeSlot";

export const mutationAddNewMatchup: OptionalIndividualMutator<ITeamMatchupsIndividual> = (parent) => {
    // find a timeslot to add a new matchup
    const possiblePairingsByTimeSlots = [...parent.unmatchedTeams.entries()]
        .filter(([timeSlot, teams]) => 2 <= teams.length)
        .map(([timeSlot, teams]) => ({timeSlot, pairs: teams.length * (teams.length + 1) / 2}));
    const totalPossiblePairings = possiblePairingsByTimeSlots.reduce((sum, slot) => sum + slot.pairs, 0);
    if (totalPossiblePairings <= 0)
        return;
    let chosenPair;
    let random = Math.floor(Math.random() * totalPossiblePairings);
    for (let pairing of possiblePairingsByTimeSlots) {
        random -= pairing.pairs;
        if (random < 0) {
            chosenPair = pairing;
            break;
        }
    }

    const timeSlot = chosenPair!.timeSlot;
    const teams = parent.unmatchedTeams.get(timeSlot)!;

    // choose 2 random teams
    const first: number = Math.floor(Math.random() * teams.length);
    let second: number;
    do {
        second = Math.floor(Math.random() * teams.length);
    } while (first === second);

    // add the new matchup, and remove the teams from the unmatched list
    const unmatchedTeams: Map<ITimeSlot, readonly ITeam[]> = new Map(parent.unmatchedTeams);
    unmatchedTeams.set(timeSlot, teams.filter((_, index) => index !== first && index !== second));

    return {
        unmatchedTeams,
        matchups: [...parent.matchups, {timeSlot, teams: [teams[first], teams[second]]}],
    };
}

export const mutationRemoveMatchup: OptionalIndividualMutator<ITeamMatchupsIndividual> = (parent) => {
    if (0 < parent.matchups.length) {
        const matchups = [...parent.matchups];
        const removedMatchup = matchups.splice(Math.floor(Math.random() * matchups.length), 1)[0];

        const unmatchedTeams = new Map(parent.unmatchedTeams);
        unmatchedTeams.set(removedMatchup.timeSlot, [...parent.unmatchedTeams.get(removedMatchup.timeSlot)!, ...removedMatchup.teams]);
        return {unmatchedTeams, matchups};
    }
}

export const mutationSwapTimeSlotMatchup: OptionalIndividualMutator<ITeamMatchupsIndividual> = (parent) => {
    if (1 < parent.matchups.length) {
        // TODO
    }
}
