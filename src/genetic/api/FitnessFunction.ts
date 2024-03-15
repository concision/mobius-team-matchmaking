import {GeneticOperator, IGeneticOperatorChildren} from "./GeneticOperator";

export interface IFitness<I> {
    readonly solution: I;
    readonly fitness: number;
}


export abstract class FitnessFunction<I, TChildrenType = undefined>
    extends GeneticOperator<I, TChildrenType> {
    public abstract evaluate(population: readonly I[]): readonly IFitness<I>[];
}

export abstract class IndividualFitnessFunction<I> extends FitnessFunction<I> {
    public override evaluate(population: readonly I[]): readonly IFitness<I>[] {
        return Object.freeze(population.map(solution => Object.freeze({
            solution,
            fitness: this.evaluateIndividual(solution),
        })));
    }

    public abstract evaluateIndividual(individual: I): number;
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

    public get reducer(): WeightedFitnessReducer {
        return this._reducer;
    }

    public set reducer(value: WeightedFitnessReducer) {
        if (!(value instanceof WeightedFitnessReducer))
            throw new Error(`${MultivariateFitnessFunction.name}.reducer must be an instance of ${WeightedFitnessReducer.name}`);
        this._reducer = value;
    }


    public get provideChildren(): IGeneticOperatorChildren<I, IWeightedFitnessFunction<I>> {
        return {
            children: this.fitnessFunctions,
            operatorExtractor: ({fitnessFunction}) => fitnessFunction,
        };
    }

    protected validateChild(child: IWeightedFitnessFunction<I>, index?: number) {
        if (typeof child.weight !== "number" || !Number.isFinite(child.weight) || Number.isNaN(child.weight))
            throw new Error(`${MultivariateFitnessFunction.name}.fitnessFunctions[${index ?? "i"}].weight must be a finite number`);
        if (child.normalizer !== undefined && !normalizers.has(child.normalizer))
            throw new Error(`${MultivariateFitnessFunction.name}.fitnessFunctions[${index ?? "i"}].normalizer must be a valid FitnessNormalizer (if defined)`);
        if (!(child.fitnessFunction instanceof FitnessFunction))
            throw new Error(`${MultivariateFitnessFunction.name}.fitnessFunctions[${index ?? "i"}].fitnessFunction must be an instance of ${FitnessFunction.name}`);
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
    fitnessFunction: FitnessFunction<I, any>;
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
