import {IFitness} from "./IGeneticParameters";

export abstract class FitnessFunction<I> {
    public constructor(
        public readonly name: string,
    ) {
    }

    public abstract evaluate(population: readonly I[]): readonly IFitness<I>[];
}


export class IndividualFitnessFunction<I> extends FitnessFunction<I> {
    public constructor(
        name: string,
        public readonly fitnessFunction: (individual: I) => number,
    ) {
        super(name);
    }

    public override evaluate(population: readonly I[]): readonly IFitness<I>[] {
        return population.map(individual => ({solution: individual, fitness: this.fitnessFunction(individual)}));
    }
}


export enum Normalizer {
    NONE = "none",
    // TODO: implement various normalizers, e.g. linear, exponential, logarithmic, sigmoid, tanh
}

type NormalizerFunction = (scores: readonly number[]) => readonly number[];
const normalizers: ReadonlyMap<Normalizer, NormalizerFunction> = new Map()
    .set(Normalizer.NONE, (scores: readonly number[]) => scores);

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
    normalizer?: Normalizer;
    fitnessFunction: FitnessFunction<I>;
}

export class MultivariateFitnessFunction<I> extends FitnessFunction<I> {
    public readonly reducer: WeightedFitnessReducer;
    public readonly fitnessFunctions: IWeightedFitnessFunction<I>[];

    public constructor(name: string, reducer: WeightedFitnessReducer, fitnessFunctions: readonly IWeightedFitnessFunction<I>[]) {
        super(name);
        this.reducer = reducer;
        this.fitnessFunctions = [...fitnessFunctions];
    }

    public override evaluate(population: readonly I[]): readonly IFitness<I>[] {
        const fitnessFunctionWeights = this.fitnessFunctions.map(({weighting}) => weighting);
        const populationFitnessScores: ReadonlyArray<ReadonlyArray<number>> = this.fitnessFunctions.map(
            ({fitnessFunction, normalizer}) => {
                let scores: readonly number[] = fitnessFunction.evaluate(population).map(({fitness}) => fitness);
                if (normalizer !== undefined) {
                    const normalizerFunction = normalizers.get(normalizer);
                    if (normalizerFunction)
                        scores = normalizerFunction(scores);
                }
                return scores;
            }
        );

        const fitness: IFitness<I>[] = [];
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
