import {IndividualGenerator} from "./IndividualGenerator";
import {IndividualMutator} from "./IndividualMutator";
import {FitnessFunction} from "./FitnessFunction";
import {PopulationSelector} from "./PopulationSelector";
import {EarlyStoppingEvaluator} from "./EarlyStoppingEvaluator";
import {IndividualIdentityFunction} from "./IndividualIdentityFunction";

export declare function geneticAlgorithm<I>(options: IGeneticOptions<I>, individuals: number): readonly IFitness<I>[];

export declare function geneticAlgorithmGenerator<I>(constraints: I extends any[] ? never : IGeneticOptions<I>): Generator<IGeneration<I>>;

export type IGeneticOptions<I> = { // TODO: make everything a genetic operator
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
    readonly population: readonly IFitness<I>[];
}

export interface IFitness<I> {
    readonly solution: I;
    readonly fitness: number;
}
