import {IndividualGenerator} from "./IndividualGenerator";
import {IndividualMutator} from "./IndividualMutator";
import {FitnessFunction, IIndividualFitness} from "./FitnessFunction";
import {PopulationSelector} from "./PopulationSelector";

export interface IGeneticOptions<I> {
    readonly maximumGenerations?: number;
    readonly maximumPopulationSize: number;

    readonly firstGeneration?: readonly I[];
    readonly individualGenerator?: IndividualGenerator<I>;
    readonly individualMutator: IndividualMutator<I>;
    readonly fitnessFunction: FitnessFunction<I>;
    readonly populationSelector: PopulationSelector<I>;
    // TODO: implement early stopping criteria
}

export interface IGeneration<I> {
    readonly generation: number;
    readonly population: readonly IIndividualFitness<I>[];
}
