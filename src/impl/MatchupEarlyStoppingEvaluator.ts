import {IGeneration} from "../api/genetic/GeneticAlgorithm";
import {EarlyStoppingEvaluator} from "../api/genetic/EarlyStoppingEvaluator";

export function ensureGrowthEarlyStopEvaluator<I>(maximumGrowthFailures: number): EarlyStoppingEvaluator<I> {
    let previousMaximumFitness: number | undefined;
    let growthFailures = 0;

    return (generation: IGeneration<I>): boolean => {
        const newMaximumFitness = generation.population
            .map(individual => individual.fitness)
            .reduce((max, fitness) => Math.max(max, fitness), 0);
        try {
            if (previousMaximumFitness === undefined) {
                return false;
            } else if (previousMaximumFitness < newMaximumFitness) {
                growthFailures = 0;
                return false;
            } else {
                growthFailures++;
                return maximumGrowthFailures <= growthFailures;
            }
        } finally {
            previousMaximumFitness = newMaximumFitness
        }
    }
}
