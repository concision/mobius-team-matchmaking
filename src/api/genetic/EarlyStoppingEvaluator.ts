import {IGeneration} from "./GeneticAlgorithm";

export type EarlyStoppingEvaluator<I> = (generation: IGeneration<I>) => boolean;
