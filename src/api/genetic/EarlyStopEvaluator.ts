import {IGeneration} from "./GeneticAlgorithm";

export type EarlyStopEvaluator<I> = (generation: IGeneration<I>) => boolean;
