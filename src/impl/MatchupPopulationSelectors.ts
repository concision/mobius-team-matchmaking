import {ITeamMatchupsIndividual} from "../api/TeamMatchmaking";
import {DeduplicatePopulationSelector, KillInvalidPopulationSelector} from "../api/genetic/PopulationSelector";
import {IIndividualFitness} from "../api/genetic/FitnessFunction";

export const uniqueTeamMatchupIdentity: DeduplicatePopulationSelector<ITeamMatchupsIndividual>["identity"] =
    (individual: ITeamMatchupsIndividual): string => {
        return JSON.stringify(individual.matchups
            .map(matchup => matchup.teams.map(team => team.snowflake).sort().join(","))
            .sort())
    };

export const invalidIndividualEvaluator: KillInvalidPopulationSelector<ITeamMatchupsIndividual>["killPredicate"] =
    (individual: IIndividualFitness<ITeamMatchupsIndividual>): boolean => {
        // TODO: kill matchups with back-to-back time slot matches
        return false;
    };
