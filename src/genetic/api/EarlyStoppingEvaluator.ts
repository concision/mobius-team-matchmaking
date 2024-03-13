import {GeneticOperator} from "./GeneticOperator";
import {IGeneration} from "./PopulationSelector";

export abstract class EarlyStoppingEvaluator<I, TChildrenType extends GeneticOperator<I> | undefined = undefined>
    extends GeneticOperator<TChildrenType> {
    public abstract shouldStopEarly(generation: IGeneration<I>): boolean;
}


export class EnsureGrowthEarlyStoppingEvaluator<I> extends EarlyStoppingEvaluator<I> {
    private _maximumGrowthFailures: number;

    private previousMaximumFitness: number | undefined;
    private _growthFailures: number = 0;

    public constructor(maximumGrowthFailures: number);

    public constructor(name: string, maximumGrowthFailures: number);

    public constructor(nameOrMaximumGrowthFailures: string | number, maximumGrowthFailures?: number) {
        super(typeof nameOrMaximumGrowthFailures === "string" ? nameOrMaximumGrowthFailures : EnsureGrowthEarlyStoppingEvaluator.name);
        this._maximumGrowthFailures = typeof nameOrMaximumGrowthFailures === "string" ? maximumGrowthFailures! : nameOrMaximumGrowthFailures;

        this.validateIfConsumerInstantiation(EnsureGrowthEarlyStoppingEvaluator, arguments);
    }

    public get maximumGrowthFailures(): number {
        return this._maximumGrowthFailures;
    }

    public set maximumGrowthFailures(value: number) {
        if (!Number.isInteger(value) || value <= 0)
            throw new Error(`${EnsureGrowthEarlyStoppingEvaluator.name}.maximumGrowthFailures must be a positive integer`);
        this._maximumGrowthFailures = value;
    }

    public get growthFailures(): number {
        return this._growthFailures;
    }

    public get growthFailureProportion(): number {
        return this.growthFailures / this.maximumGrowthFailures;
    }

    public override shouldStopEarly(generation: IGeneration<I>): boolean {
        const newMaximumFitness = generation.population
            .filter(({fitness}) => Number.isFinite(fitness) && !Number.isNaN(fitness))
            .reduce((max, {fitness}) => Math.max(max, fitness), 0);
        try {
            if (this.previousMaximumFitness === undefined) {
                return false;
            } else if (this.previousMaximumFitness < newMaximumFitness) {
                this._growthFailures = 0;
                return false;
            } else {
                this._growthFailures++;
                return this._maximumGrowthFailures <= this._growthFailures;
            }
        } finally {
            this.previousMaximumFitness = newMaximumFitness
        }
    }
}
