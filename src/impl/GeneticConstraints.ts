import {ensureGrowthEarlyStopEvaluator} from "./geneticHooks/MatchupEarlyStoppingEvaluator";
import {IGeneticOptions} from "../api/genetic/GeneticAlgorithm";
import {IDefaultMatchmakingParameters, IMatchupScheduleIndividual} from "../api/TeamMatchmaking";
import {
    backToBackMatchupKillPredicate,
    hardEloDifferentialLimitKillPredicate,
    maximumGamesPerTeamKillPredicate,
    uniqueTeamMatchupIdentity
} from "./geneticHooks/MatchupPopulationSelectors";
import {WeightedRandomIndividualMutator} from "../api/genetic/IndividualMutator";
import {MutationAddNewMatchup, MutationRemoveMatchup, MutationSwapMatchupInTimeSlot} from "./geneticHooks/MatchupIndividualMutators";
import {LinearWeightedFitnessReducer, MultivariateFitnessFunction, Normalizer} from "../api/genetic/FitnessFunction";
import {
    averageGamesPlayedPerTeamVariance,
    countRecentDuplicateMatchups,
    countTotalMatchups,
    eloDifferentialStandardDeviation
} from "./geneticHooks/MatchupFitnessFunctions";
import {
    ChainedPopulationSelector,
    DeduplicatePopulationSelector,
    ElitistPopulationSelector,
    KillInvalidPopulationSelector,
    ProportionalPopulationSelector,
    RepopulatePopulationSelector,
    RouletteWheelPopulationSelector,
    TournamentPopulationSelector
} from "../api/genetic/PopulationSelector";
import {ITimeSlot} from "../api/ITimeSlot";
import {ITeam} from "../api/ITeam";

export function defaultConstraints(
    parameters: Required<IDefaultMatchmakingParameters>,
    teamsByTimeSlot: ReadonlyMap<ITimeSlot, readonly ITeam[]>,
): IGeneticOptions<IMatchupScheduleIndividual> {
    const earlyStoppingEvaluator = ensureGrowthEarlyStopEvaluator(16);
    return {
        // an upper bound estimate of the number of generations needed to find a decent solution
        maximumGenerations: 2 * [...teamsByTimeSlot.values()]
            .reduce((sum, teams) => sum + teams.length * (teams.length + 1) / 2, 0),
        maximumPopulationSize: 2500,

        individualIdentity: uniqueTeamMatchupIdentity,

        individualGenerator: () => ({unmatchedTeams: teamsByTimeSlot, matchups: []}),
        individualMutator: new WeightedRandomIndividualMutator("mutator", 0.75, [
            // add new valid team matchup
            {weight: 2, mutator: new MutationAddNewMatchup()},
            // remove a team matchup
            {weight: 1, predicate: args => 1 <= args.matchups.length, mutator: new MutationRemoveMatchup()},
            // swap pairing (from the same time slot)
            {weight: 1, predicate: args => 1 <= args.matchups.length, mutator: new MutationSwapMatchupInTimeSlot()},
        ]),
        fitnessFunction: new MultivariateFitnessFunction("fitness", new LinearWeightedFitnessReducer(), [
            // maximize total matchups
            {weighting: 2, normalizer: Normalizer.NONE, fitnessFunction: countTotalMatchups},
            // minimize ELO differential in team matchups
            // elo standard deviation is likely proportional to parameters.hardEloDifferentialLimit
            {
                weighting: -1 / Math.pow(parameters.hardEloDifferentialLimit, .5),
                normalizer: Normalizer.NONE,
                fitnessFunction: eloDifferentialStandardDeviation,
            },
            // favor scheduling games to teams who have played fewer games in the last options.countGamesPlayedInLastXDays days
            {
                weighting: -1,
                normalizer: Normalizer.NONE,
                fitnessFunction: averageGamesPlayedPerTeamVariance(parameters.scheduledDate, parameters.countGamesPlayedInLastXDays),
            },
            // strong penalty for matchups that have occurred in the last options.preventDuplicateMatchupsInLastXWeeks weeks
            ...(0 < parameters.preventDuplicateMatchupsInLastXDays ? [{
                weighting: -100,
                normalizer: Normalizer.NONE,
                fitnessFunction: countRecentDuplicateMatchups(parameters.scheduledDate, parameters.preventDuplicateMatchupsInLastXDays),
            }] : []),
        ]),
        populationSelector: new ChainedPopulationSelector("chainedSelector", [
            // remove any duplicate matchup schedules
            new DeduplicatePopulationSelector("deduplicate", uniqueTeamMatchupIdentity),
            // kill any matchups that are invalid, i.e. violate hard rules
            new KillInvalidPopulationSelector("killMatchupsExceedingMaximumGames", [
                // remove any matchups that are bac k-to-back scheduled (teams need a break)
                backToBackMatchupKillPredicate(),
                // enforce a maximum number of games for each team
                maximumGamesPerTeamKillPredicate(parameters.maximumGamesPerTeam),
                // enforce a maximum ELO differential between teams
                hardEloDifferentialLimitKillPredicate(parameters.hardEloDifferentialLimit),
            ]),
            // apply selective pressure
            new ProportionalPopulationSelector("selectivePressure", [
                // randomly select the best matchups
                {weight: .50, selector: new TournamentPopulationSelector("tournament", 10)},
                // preserve some of the best matchups without selective pressure
                {weight: .10, selector: new ElitistPopulationSelector("elitism", 1)},
                // preserve individuals to maintain diversity (proportional by fitness)
                {weight: .20, selector: new RouletteWheelPopulationSelector("roulette")},
                // preserve random-selected individuals to maintain diversity
                {weight: .20, selector: new RouletteWheelPopulationSelector("roulette", false)},
            ]),
            // always regrow the population if necessary
            new RepopulatePopulationSelector("repopulate"),
        ]),
        // stop early if the fitness is not improving within XYZ generations
        earlyStopping: earlyStoppingEvaluator,
    };
}
