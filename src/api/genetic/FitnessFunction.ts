export interface IIndividualFitness<I> {
    readonly solution: I;
    readonly fitness: number;
}

export abstract class FitnessFunction<I> {
    public constructor(
        public readonly name: string,
    ) {
    }

    public abstract evaluate(population: readonly I[]): readonly IIndividualFitness<I>[];
}


export class IndividualFitnessFunction<I> extends FitnessFunction<I> {
    public constructor(
        name: string,
        public readonly fitnessFunction: (individual: I) => number,
    ) {
        super(name);
    }

    public override evaluate(population: readonly I[]): readonly IIndividualFitness<I>[] {
        return population.map(individual => ({solution: individual, fitness: this.fitnessFunction(individual)}));
    }
}


export enum Normalizer {
    GAUSSIAN = "gaussian",
    LINEAR = "linear",
    EXPONENTIAL = "exponential",
    LOGARITHMIC = "logarithmic",
    SIGMOID = "sigmoid",
    TANH = "tanh",
}

type NormalizerFunction = (scores: readonly number[]) => readonly number[];
const normalizers: ReadonlyMap<Normalizer, NormalizerFunction> = new Map()
    .set(Normalizer.GAUSSIAN, (scores: readonly number[]) => {
        return scores; // TODO: absolute
        const mean = scores.reduce((sum, fitness) => sum + fitness, 0) / scores.length;
        const variance = scores.reduce((sum, fitness) => sum + (fitness - mean) ** 2, 0) / scores.length;
        const standardDeviation = Math.sqrt(variance);
        return scores.map(fitness => (fitness - mean) / (standardDeviation !== 0 ? standardDeviation : 1));
    })
    .set(Normalizer.LINEAR, (scores: readonly number[]) => {
        const max = scores.reduce((max, fitness) => Math.max(max, fitness), 0);
        const min = scores.reduce((min, fitness) => Math.min(min, fitness), max);
        return scores.map(fitness => (fitness - min) / (max - min));
    })
    .set(Normalizer.EXPONENTIAL, (scores: readonly number[]) => {
        const max = scores.reduce((max, fitness) => Math.max(max, fitness), 0);
        return scores.map(fitness => Math.exp(fitness / max));
    });

export abstract class WeightedFitnessReducer {
    public constructor(
        public readonly name: string,
    ) {
    }

    public abstract reduce(weightings: number[], fitnessScores: number[]): number;
}

export class LinearWeightedFitnessReducer extends WeightedFitnessReducer {
    public constructor() {
        super("linear");
    }

    public override reduce(weightings: number[], fitnessScores: number[]): number {
        return weightings.map((weight, index) => weight * fitnessScores[index])
            .reduce((sum, fitness) => sum + fitness, 0) / weightings.length;
    }
}

export interface IWeightedFitnessFunction<I> {
    weighting: number;
    normalizer: Normalizer;
    fitnessFunction: FitnessFunction<I>;
}

export class MultivariateFitnessFunction<I> extends FitnessFunction<I> {
    public readonly fitnessFunctions: IWeightedFitnessFunction<I>[];

    public constructor(
        name: string,
        public readonly reducer: WeightedFitnessReducer,
        fitnessFunctions: readonly IWeightedFitnessFunction<I>[]
    ) {
        super(name);
        this.fitnessFunctions = [...fitnessFunctions];
    }

    public override evaluate(population: readonly I[]): readonly IIndividualFitness<I>[] {
        const fitnessFunctionWeights = this.fitnessFunctions.map(({weighting}) => weighting);
        const populationFitnessScores: ReadonlyArray<ReadonlyArray<number>> = this.fitnessFunctions.map(
            ({fitnessFunction, normalizer}) => {
                let scores: readonly number[] = fitnessFunction.evaluate(population).map(({fitness}) => fitness);
                const normalizerFunction = normalizers.get(normalizer);
                if (normalizerFunction)
                    scores = normalizerFunction(scores);
                return scores;
            }
        );

        const fitness: IIndividualFitness<I>[] = [];
        for (let i = 0; i < population.length; i++) {
            const fitnessScores = Array.from({length: this.fitnessFunctions.length}, (_, f) => populationFitnessScores[f][i]);
            const aggregatedFitness = this.reducer.reduce(fitnessFunctionWeights, fitnessScores);

            fitness.push({
                solution: population[i],
                fitness: aggregatedFitness,
            });
        }
        return fitness;
    }
}
