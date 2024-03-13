import {GeneticOperator, IGeneticOperatorChild} from "./GeneticOperator";

export interface IFitness<I> {
    readonly solution: I;
    readonly fitness: number;
}


export abstract class FitnessFunction<I, TChildrenType = undefined>
    extends GeneticOperator<I, TChildrenType> {
    public abstract evaluate(population: readonly I[]): readonly IFitness<I>[];
}


export class IndividualFitnessFunction<I> extends FitnessFunction<I> {
    private _fitnessFunction: (individual: I) => number;

    public constructor(name: string, fitnessFunction: (individual: I) => number) {
        super(name);
        this._fitnessFunction = fitnessFunction;

        this.validateIfConsumerInstantiation(IndividualFitnessFunction, arguments);
    }

    public get fitnessFunction(): (individual: I) => number {
        return this._fitnessFunction;
    }

    public set fitnessFunction(value: (individual: I) => number) {
        if (typeof value !== "function")
            throw new Error(`${IndividualFitnessFunction.name}.fitnessFunction must be a serializable pure function without any closures`);
        this._fitnessFunction = value;
    }

    public override evaluate(population: readonly I[]): readonly IFitness<I>[] {
        return Object.freeze(population.map(individual => Object.freeze({
            solution: individual,
            fitness: this._fitnessFunction(individual),
        })));
    }
}

export class MultivariateFitnessFunction<I> extends FitnessFunction<I, IWeightedFitnessFunction<I>> {
    public _reducer: WeightedFitnessReducer;
    private readonly fitnessFunctions: IWeightedFitnessFunction<I>[];

    public constructor(
        name: string,
        reducer: WeightedFitnessReducer,
        fitnessFunctions: readonly IWeightedFitnessFunction<I>[],
    ) {
        super(name);
        this._reducer = reducer;
        this.fitnessFunctions = Array.isArray(fitnessFunctions) ? [...fitnessFunctions] : fitnessFunctions;

        this.validateIfConsumerInstantiation(MultivariateFitnessFunction, arguments);
    }

    public get geneticOperatorChildren(): readonly IGeneticOperatorChild<I, IWeightedFitnessFunction<I>>[] {
        return Object.freeze(this.fitnessFunctions.map(child => ({child, operator: child.fitnessFunction})));
    }

    public get reducer(): WeightedFitnessReducer {
        return this._reducer;
    }

    public set reducer(value: WeightedFitnessReducer) {
        if (!(value instanceof WeightedFitnessReducer))
            throw new Error(`${MultivariateFitnessFunction.name}.reducer must be an instance of ${WeightedFitnessReducer.name}`);
        this._reducer = value;
    }

    public override evaluate(population: readonly I[]): readonly IFitness<I>[] {
        const fitnessFunctionWeights = this.fitnessFunctions.map(({weight}) => weight);
        const populationFitnessScores: ReadonlyArray<ReadonlyArray<number>> = this.fitnessFunctions.map(
            ({fitnessFunction, normalizer}) => {
                let scores: readonly number[] = fitnessFunction.evaluate(population)
                    .filter(({fitness}) => Number.isFinite(fitness) && !Number.isNaN(fitness))
                    .map(({fitness}) => fitness);
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
            const aggregatedFitness = this._reducer.reduce(fitnessFunctionWeights, fitnessScores);

            fitness.push(Object.freeze({
                solution: population[i],
                fitness: aggregatedFitness,
            }));
        }
        return Object.freeze(fitness);
    }
}

export interface IWeightedFitnessFunction<I> {
    weight: number;
    normalizer?: FitnessNormalizer;
    fitnessFunction: FitnessFunction<I>;
}

export enum FitnessNormalizer {
    NONE = "none",
    // TODO: implement various normalizers, e.g. linear, exponential, logarithmic, sigmoid, tanh
}

type NormalizerFunction = (scores: readonly number[]) => readonly number[];
const normalizers: ReadonlyMap<FitnessNormalizer, NormalizerFunction> = new Map()
    .set(FitnessNormalizer.NONE, (scores: readonly number[]) => scores);

export abstract class WeightedFitnessReducer {
    public abstract reduce(weightings: number[], fitnessScores: number[]): number;
}

export class LinearWeightedFitnessReducer extends WeightedFitnessReducer {
    public override reduce(weightings: number[], fitnessScores: number[]): number {
        return weightings.map((weight, index) => weight * fitnessScores[index])
            .reduce((sum, fitness) => sum + fitness, 0) / Math.max(1, weightings.length);
    }
}
