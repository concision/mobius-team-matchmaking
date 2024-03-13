import {EnsureGrowthEarlyStoppingEvaluator} from "../../genetic/api/EarlyStoppingEvaluator";
import {
    FitnessNormalizer,
    IWeightedFitnessFunction,
    LinearWeightedFitnessReducer,
    MultivariateFitnessFunction
} from "../../genetic/api/FitnessFunction";
import {GeneticParameters} from "../../genetic/api/GeneticParameters";
import {LambdaIndividualGenerator} from "../../genetic/api/IndividualGenerator";
import {WeightedRandomIndividualMutator} from "../../genetic/api/IndividualMutator";
import {
    ChainedPopulationSelector,
    DeduplicatePopulationSelector,
    ElitismPopulationSelector,
    KillInvalidPopulationSelector,
    ProportionalPopulationSelector,
    RepopulatePopulationSelector,
    RouletteWheelPopulationSelector,
    TournamentPopulationSelector
} from "../../genetic/api/PopulationSelector";
import {assignDefinedProperties} from "../../utilities/CollectionUtilities";
import {IMatchmakingParameters, MatchmakingConfig} from "../api/IMatchmakingOptions";
import {ITeam} from "../api/ITeam";
import {IMatchupSchedule} from "../api/MatchmakingGeneticTypes";
import {
    averageGamesPlayedPerTeamVariance,
    countRecentDuplicateMatchups,
    countTotalMatchups,
    eloDifferentialStandardDeviation
} from "./operators/MatchupFitnessFunctions";
import {MutationAddNewMatchup, MutationRemoveMatchup, MutationSwapMatchupInTimeSlot} from "./operators/MatchupIndividualMutators";
import {
    backToBackMatchupKillPredicate,
    hardEloDifferentialLimitKillPredicate,
    maximumGamesPerTeamKillPredicate,
    uniqueTeamMatchupIdentity
} from "./operators/MatchupPopulationSelectors";

export interface IMobiusTeam extends ITeam {
    // TODO: implement team-specific parameter overrides
    readonly parameterOverrides?: IMobiusTeamMatchmakingParameters;
}

/**
 * TODO
 * All options are optional and have default values if unspecified.
 */
export interface IMobiusMatchmakingOptions extends IMobiusTeamMatchmakingParameters {
    /**
     * The number of best matchups to keep in the "hall of fame" from the genetic algorithm's population. At the end of
     * the genetic algorithm's execution, the matchup schedule with the minimal amount of unmatched teams will be
     * selected from the hall of fame. Moderate numbers will increase the likelihood of finding a better matchup
     * schedule; however, larger numbers will provide potentially worse results.
     *
     * By default, this value is 32.
     */
    readonly hallOfFame?: number;
}

export interface IMobiusTeamMatchmakingParameters {
    /**
     * The maximum number of games that a team can play during the week.
     */
    readonly maximumGamesPerTeam?: number;

    /**
     * The maximum permitted difference between the ELO ratings of two teams in a matchup.
     *
     * By default, this value is 300.
     */
    readonly hardEloDifferentialLimit?: number;

    /**
     * The number of days in which a rematch is considered a duplicate. If a team has played another team within this
     * number of days, then the rematch will be considered a duplicate and will be significantly less likely to occur.
     *
     * By default, this value is 14. Setting to 0 will disable this feature.
     */
    readonly preventDuplicateMatchupsInLastXDays?: number;

    /**
     * The number of days in which to consider a team's recent matchups when attempting to minimize the differences in
     * the number of games played by each team.
     *
     * By default, this value is 21. Setting to 0 will disable this feature.
     */
    readonly countGamesPlayedInLastXDays?: number;

    /**
     * TODO
     */
    readonly permittedBackToBackRecency?: number;
}

export class MobiusMatchmakingConfig<TTeam extends IMobiusTeam = IMobiusTeam, TPartitionKey = string>
    extends MatchmakingConfig<TTeam, TPartitionKey> {
    private readonly options: Required<IMobiusMatchmakingOptions>;

    public constructor(parameters?: IMobiusMatchmakingOptions) {
        super();
        this.options = assignDefinedProperties({
            hallOfFame: 32,

            maximumGamesPerTeam: 3,
            hardEloDifferentialLimit: 300,

            preventDuplicateMatchupsInLastXDays: 14,
            countGamesPlayedInLastXDays: 21,
            permittedBackToBackRecency: 1,
        }, parameters ?? {});
        this.validateOptions(this.options);
    }

    public override configure(
        {teamsByTimeSlot, options}: IMatchmakingParameters<TTeam, TPartitionKey>,
    ): GeneticParameters<IMatchupSchedule<TTeam>> {
        return new GeneticParameters({
            // an upper bound estimate of the number of generations needed to find a decent solution
            maximumGenerations: 2 * [...teamsByTimeSlot.values()]
                .reduce((sum, teams) => sum + teams.length * (teams.length + 1) / 2, 0),
            maximumPopulationSize: 2500,

            individualGenerator: new LambdaIndividualGenerator(() => ({unmatchedTeams: teamsByTimeSlot, matchups: []})),
            individualMutator: new WeightedRandomIndividualMutator("mutator", 0.75, [
                // add new valid team matchup
                {weight: 2, mutator: new MutationAddNewMatchup()},
                // remove a team matchup
                {weight: 1, predicate: args => 1 <= args.matchups.length, mutator: new MutationRemoveMatchup()},
                // swap pairing (from the same time slot)
                {weight: 1, predicate: args => 1 <= args.matchups.length, mutator: new MutationSwapMatchupInTimeSlot()},
            ]),
            fitnessFunction: new MultivariateFitnessFunction<IMatchupSchedule<TTeam>>("fitness", new LinearWeightedFitnessReducer(), [
                // maximize total matchups
                {weight: 2, normalizer: FitnessNormalizer.NONE, fitnessFunction: countTotalMatchups()},
                // minimize ELO differential in team matchups
                // elo standard deviation is likely proportional to parameters.hardEloDifferentialLimit
                {
                    weight: Math.pow(this.options.hardEloDifferentialLimit, -.4),
                    normalizer: FitnessNormalizer.NONE,
                    fitnessFunction: eloDifferentialStandardDeviation(),
                },
                // favor scheduling games to teams who have played fewer games in the last options.countGamesPlayedInLastXDays days
                {
                    weight: -1,
                    normalizer: FitnessNormalizer.NONE,
                    fitnessFunction: averageGamesPlayedPerTeamVariance(options.scheduledDate, this.options.countGamesPlayedInLastXDays),
                },
                // strong penalty for matchups that have occurred in the last options.preventDuplicateMatchupsInLastXWeeks weeks
                ...(0 < this.options.preventDuplicateMatchupsInLastXDays ? [<IWeightedFitnessFunction<IMatchupSchedule<TTeam>>>{
                    weight: -100,
                    normalizer: FitnessNormalizer.NONE,
                    fitnessFunction: countRecentDuplicateMatchups(options.scheduledDate, this.options.preventDuplicateMatchupsInLastXDays),
                }] : []),
            ]),
            populationSelector: new ChainedPopulationSelector("chainedSelector", [
                // remove any duplicate matchup schedules
                new DeduplicatePopulationSelector("deduplicate", uniqueTeamMatchupIdentity()),
                // kill any matchups that are invalid, i.e. violate hard rules
                new KillInvalidPopulationSelector("killMatchupsExceedingMaximumGames", [
                    // remove any matchups that are bac k-to-back scheduled (teams need a break)
                    backToBackMatchupKillPredicate(),
                    // enforce a maximum number of games for each team
                    maximumGamesPerTeamKillPredicate(this.options.maximumGamesPerTeam),
                    // enforce a maximum ELO differential between teams
                    hardEloDifferentialLimitKillPredicate(this.options.hardEloDifferentialLimit),
                ]),
                // apply selective pressure
                new ProportionalPopulationSelector("selectivePressure", [
                    // randomly select the best matchups
                    {weight: .50, selector: new TournamentPopulationSelector("tournament", 10)},
                    // preserve some of the best matchups without selective pressure
                    {weight: .10, selector: new ElitismPopulationSelector("elitism", 1)},
                    // preserve individuals to maintain diversity (proportional by fitness)
                    {weight: .20, selector: new RouletteWheelPopulationSelector("roulette")},
                    // preserve random-selected individuals to maintain diversity
                    {weight: .20, selector: new RouletteWheelPopulationSelector("roulette", false)},
                ]),
                // always regrow the population if necessary
                new RepopulatePopulationSelector("repopulate"),
            ]),
            // stop early if the fitness is not improving within XYZ generations
            earlyStopping: new EnsureGrowthEarlyStoppingEvaluator(16),
        });
    }

    public validateOptions(options: Required<IMobiusMatchmakingOptions>): void {
        if (options.maximumGamesPerTeam < 1)
            throw new Error("The maximum number of games must be at least 1.");
        if (options.hardEloDifferentialLimit < 1)
            throw new Error("The hard elo differential limit must be at least 1 (however recommended to be much higher).");

        if (options.preventDuplicateMatchupsInLastXDays < 0)
            throw new Error("The duplicate matchup day recency must be greater than 0 to be enabled, or 0 to be disabled.");
        if (options.countGamesPlayedInLastXDays < 0)
            throw new Error("The games played day recency must be greater than 0 to be enabled, or 0 to be disabled.");

        if (options.permittedBackToBackRecency < 0)
            throw new Error("The back-to-back scheduling protection must be greater than 0 to be enabled, or 0 to be disabled.");
    }
}
