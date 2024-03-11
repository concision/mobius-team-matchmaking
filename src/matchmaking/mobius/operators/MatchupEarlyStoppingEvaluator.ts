
import {EarlyStoppingEvaluator} from "../../../genetic/api/EarlyStoppingEvaluator";
import {IGeneration} from "../../../genetic/api/IGeneticParameters";

export type EnsureGrowthEarlyStopEvaluator<I> = EarlyStoppingEvaluator<I> & {
    growthFailureProportion: number,
};

export function ensureGrowthEarlyStopEvaluator<I>(maximumGrowthFailures: number): EnsureGrowthEarlyStopEvaluator<I> {
    let previousMaximumFitness: number | undefined;
    let growthFailures = 0;

    const earlyStoppingEvaluator = function (generation: IGeneration<I>): boolean {
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
    Object.defineProperty(earlyStoppingEvaluator.prototype, 'proportion', {
        get: () => growthFailures / maximumGrowthFailures,
    });
    return <EnsureGrowthEarlyStopEvaluator<I>>earlyStoppingEvaluator;
}
