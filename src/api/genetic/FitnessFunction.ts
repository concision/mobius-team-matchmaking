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

export interface IWeightedFitnessFunction<I> {
    weighting: number;
    normalizer: Normalizer;
    fitnessFunction: FitnessFunction<I>;
}

export abstract class WeightedFitnessReducer<I> {
    public constructor(
        public readonly name: string,
    ) {
    }

    public abstract reduce(weightings: number[], fitnessScores: number[]): number;
}

export class LinearWeightedFitnessReducer<I> extends WeightedFitnessReducer<I> {
    public constructor() {
        super("linear");
    }

    public override reduce(weightings: number[], fitnessScores: number[]): number {
        return weightings.map((weight, index) => weight * fitnessScores[index])
            .reduce((sum, fitness) => sum + fitness, 0) / weightings.length;
    }
}


export class MultivariateFitnessFunction<I> extends FitnessFunction<I> {
    public readonly fitnessFunctions: IWeightedFitnessFunction<I>[];

    public constructor(
        name: string,
        public readonly reducer: WeightedFitnessReducer<I>,
        fitnessFunctions: readonly IWeightedFitnessFunction<I>[]
    ) {
        super(name);
        this.fitnessFunctions = [...fitnessFunctions];
    }

    public override evaluate(population: readonly I[]): readonly IIndividualFitness<I>[] {
        const fitnessFunctionWeights = this.fitnessFunctions.map(({weighting}) => weighting);
        const populationFitnessScores: ReadonlyArray<ReadonlyArray<number>> = this.fitnessFunctions.map(
            ({fitnessFunction}) => fitnessFunction.evaluate(population).map(({fitness}) => fitness)
        );
        // TODO

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
