import {ITeamMatchupsIndividual} from "../api/TeamMatchmaking";
import {DeduplicatePopulationSelector, KillPredicate} from "../api/genetic/PopulationSelector";
import {IIndividualFitness} from "../api/genetic/FitnessFunction";
import {ITeam} from "../api/ITeam";

export const uniqueTeamMatchupIdentity: DeduplicatePopulationSelector<ITeamMatchupsIndividual>["identity"] =
    (individual: ITeamMatchupsIndividual): string => {
        return JSON.stringify(individual.matchups
            .map(matchup => matchup.teams.map(team => team.snowflake).sort().join(","))
            .sort())
    };

export function invalidIndividualEvaluator(maximumGames: number): KillPredicate<ITeamMatchupsIndividual> {
    return ({solution}: IIndividualFitness<ITeamMatchupsIndividual>): boolean => {
        const scheduledMatchupsPerTeam: Map<ITeam, number> = Array.from(solution.matchups.values())
            .flatMap(matchup => matchup.teams)
            .reduce((map, team) => map.set(team, (map.get(team) ?? 0) + 1), new Map<ITeam, number>());

        for (const scheduledMatchups of scheduledMatchupsPerTeam.values())
            if (maximumGames < scheduledMatchups)
                return true;

        // TODO: kill matchups with back-to-back time slot matches

        // TODO: kill matchups less than minimum games

        return false;
    };
}
