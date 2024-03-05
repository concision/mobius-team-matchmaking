import {IndividualGenerator} from "./IndividualGenerator";
import {IndividualMutator} from "./IndividualMutator";
import {FitnessFunction, IIndividualFitness} from "./FitnessFunction";
import {PopulationSelector} from "./PopulationSelector";
import {EarlyStoppingEvaluator} from "./EarlyStoppingEvaluator";

export type IGeneticOptions<I> = {
    readonly debugMode?: boolean;

    readonly maximumGenerations?: number;
    readonly maximumPopulationSize: number;

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
