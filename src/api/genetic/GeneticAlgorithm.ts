import {IndividualGenerator} from "./IndividualGenerator";
import {IndividualMutator} from "./IndividualMutator";
import {FitnessFunction, IIndividualFitness} from "./FitnessFunction";
import {PopulationSelector} from "./PopulationSelector";
import {EarlyStoppingEvaluator} from "./EarlyStoppingEvaluator";
import {IndividualIdentityFunction} from "./IndividualIdentityFunction";

export type IGeneticOptions<I> = {
    readonly debugLogging?: boolean;

    readonly maximumGenerations?: number;
    readonly maximumPopulationSize: number;

    readonly individualIdentity: IndividualIdentityFunction<I>;

    readonly individualMutator: IndividualMutator<I>;
    readonly fitnessFunction: FitnessFunction<I>;
    readonly populationSelector: PopulationSelector<I>;
    readonly earlyStopping?: EarlyStoppingEvaluator<I>;
} & ({
    readonly firstGeneration: readonly I[];
    readonly individualGenerator?: undefined;
} | {
    readonly firstGeneration?: undefined;
    readonly individualGenerator: IndividualGenerator<I>;
});

export interface IGeneration<I> {
    readonly generation: number;
    readonly population: readonly IIndividualFitness<I>[];
}
