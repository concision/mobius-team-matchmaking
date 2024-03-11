import {IGeneration} from "./IGeneticParameters";

export type EarlyStoppingEvaluator<I> = (generation: IGeneration<I>) => boolean;
