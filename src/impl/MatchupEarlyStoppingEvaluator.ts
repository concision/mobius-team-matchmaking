import {EarlyStopEvaluator} from "../api/genetic/EarlyStopEvaluator";
import {IGeneration} from "../api/genetic/GeneticAlgorithm";

export function EnsureGrowthEarlyStopEvaluator<I>(maximumGrowthFailures: number): EarlyStopEvaluator<I> {
    let previousMaximumFitness: number | undefined;
    let growthFailures = 0;

    return (generation: IGeneration<I>) => {
        const newMaximumFitness = generation.population
            .map(individual => individual.fitness)
            .reduce((max, fitness) => Math.max(max, fitness), 0);
        try {
            if (typeof previousMaximumFitness === 'undefined') {
                return false;
            } else {
                if (previousMaximumFitness < newMaximumFitness) {
                    growthFailures = 0;
                    return false;
                } else {
                    growthFailures++;
                    return maximumGrowthFailures <= growthFailures;
                }
            }
        } finally {
            previousMaximumFitness = newMaximumFitness
        }
    }
}
