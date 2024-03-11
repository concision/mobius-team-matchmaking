import {IndividualGenerator} from "./IndividualGenerator";
import {IndividualMutator} from "./IndividualMutator";
import {FitnessFunction} from "./FitnessFunction";
import {PopulationSelector} from "./PopulationSelector";
import {EarlyStoppingEvaluator} from "./EarlyStoppingEvaluator";
import {IndividualIdentityFunction} from "./IndividualIdentityFunction";
import {Writeable} from "../../utilities/TypescriptTypes";

export type IGeneticParameters<I> = { // TODO: make everything a genetic operator
    readonly debugLogging?: boolean;

    readonly maximumGenerations?: number;
    readonly maximumPopulationSize: number;
} & ({
    readonly firstGeneration: readonly I[];
    readonly individualGenerator?: undefined;
} | {
    readonly firstGeneration?: undefined;
    readonly individualGenerator: IndividualGenerator<I>;
}) & {
    readonly individualIdentity: IndividualIdentityFunction<I>;

    readonly individualMutator: IndividualMutator<I>;
    readonly fitnessFunction: FitnessFunction<I>;
    readonly populationSelector: PopulationSelector<I>;
    readonly earlyStopping?: EarlyStoppingEvaluator<I>;

    readonly statistics?: readonly Statistic<I>[];
};

export type IMutableGeneticParameters<I> = Writeable<IGeneticParameters<I>>;

export type Statistic<I> = (generation: IGeneration<I>) => void;

export interface IGeneration<I> {
    readonly generation: number;
    readonly population: readonly IFitness<I>[];
}

export interface IFitness<I> {
    readonly solution: I;
    readonly fitness: number;
}
