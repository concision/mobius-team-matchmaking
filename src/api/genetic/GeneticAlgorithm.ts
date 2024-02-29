import {IndividualGenerator} from "./IndividualGenerator";
import {IndividualMutator} from "./IndividualMutator";
import {FitnessFunction, IIndividualFitness} from "./FitnessFunction";
import {PopulationSelector} from "./PopulationSelector";
import {EarlyStopEvaluator} from "./EarlyStopEvaluator";

export interface IGeneticOptions<I> {
    readonly maximumGenerations?: number;
    readonly maximumPopulationSize: number;

    readonly firstGeneration?: readonly I[];
    readonly individualGenerator?: IndividualGenerator<I>;

    readonly individualMutator: IndividualMutator<I>;
    readonly fitnessFunction: FitnessFunction<I>;
    readonly populationSelector: PopulationSelector<I>;
    readonly earlyStopping?: EarlyStopEvaluator<I>;
}

export interface IGeneration<I> {
    readonly generation: number;
    readonly population: readonly IIndividualFitness<I>[];
}
