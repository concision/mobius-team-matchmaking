import {ITeamMatchupsIndividual} from "../../api/TeamMatchmaking";
import {DeduplicatePopulationSelector, DeduplicationIdentityFunction, KillPredicate} from "../../api/genetic/PopulationSelector";
import {IIndividualFitness} from "../../api/genetic/FitnessFunction";
import {ITeam} from "../../api/ITeam";
import {ITimeSlot} from "../../api/ITimeSlot";

export const uniqueTeamMatchupIdentity: DeduplicationIdentityFunction<ITeamMatchupsIndividual> =
    (individual: ITeamMatchupsIndividual): string => {
        return JSON.stringify(individual.matchups
            .map(matchup => matchup.teams.map(team => team.snowflake).sort().join(","))
            .sort())
    };

export function maximumGamesKillPredicate(maximumGames: number): KillPredicate<ITeamMatchupsIndividual> {
    return ({solution}: IIndividualFitness<ITeamMatchupsIndividual>): boolean => {
        const scheduledMatchupsPerTeam: Map<ITeam, number> = solution.matchups
            .flatMap(matchup => matchup.teams)
            .reduce((map, team) => map.set(team, (map.get(team) ?? 0) + 1), new Map<ITeam, number>());

        for (const scheduledMatchups of scheduledMatchupsPerTeam.values())
            if (maximumGames < scheduledMatchups)
                return true;
        return false;
    };
}

// TODO: kill matchups less than minimum games?

export function backToBackMatchupKillPredicate(ordinalRecency: number = 1): KillPredicate<ITeamMatchupsIndividual> {
    return ({solution}: IIndividualFitness<ITeamMatchupsIndividual>): boolean => {
        const teamTimeSlots  = new Map<ITeam, ITimeSlot[]>();
        for (const matchup of solution.matchups) {
            for (const team of matchup.teams) {
                const timeSlots = teamTimeSlots.get(team) ?? [];
                timeSlots.push(matchup.timeSlot);
                teamTimeSlots.set(team, timeSlots);
            }
        }

        for (const timeSlots of teamTimeSlots.values())
            timeSlots.sort((a, b) =>  {
                const compare = a.day.localeCompare(b.day);
                return compare === 0 ? a.ordinal - b.ordinal : compare;
            });

        for (const timeSlots of teamTimeSlots.values()) {
            for (let i = 0; i < timeSlots.length - 1; i++) {
                if (timeSlots[i].day === timeSlots[i + 1].day && Math.abs(timeSlots[i + 1].ordinal - timeSlots[i].ordinal) <= ordinalRecency)
                    return true;
            }
        }

        return false;
    };
}
