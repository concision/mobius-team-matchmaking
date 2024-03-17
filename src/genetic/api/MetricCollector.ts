import {groupBy, GroupingBehavior} from "../../utilities/CollectionUtilities";
import {Exception} from "../../utilities/Exception";
import {IFitness} from "./FitnessFunction";
import {GeneticOperator} from "./GeneticOperator";
import {IndividualIdentityFunction} from "./IndividualIdentityFunction";
import {IGeneration} from "./PopulationSelector";

export abstract class MetricCollector<I, TReturnType, TChildType = undefined>
    extends GeneticOperator<I, TChildType> {
    public abstract update(generation: IGeneration<I>): void;

    public abstract finalize(): TReturnType;
}


export type HallOfFameResult<I> = readonly IFitness<I>[];

export class HallOfFameMetricCollector<I> extends MetricCollector<I, HallOfFameResult<I>> {
    private _individuals: number;
    private _identityFunction: IndividualIdentityFunction<I>;

    private fittest: IFitness<I>[] = [];

    public constructor(individuals: number, identityFunction: IndividualIdentityFunction<I>);
    public constructor(name: string, individuals: number, identityFunction: IndividualIdentityFunction<I>);
    public constructor(
        name: string | number,
        individuals: number | IndividualIdentityFunction<I>,
        identityFunction?: IndividualIdentityFunction<I>
    ) {
        super(3 <= arguments.length ? <string>name : HallOfFameMetricCollector.name);
        this._individuals = <number>(arguments.length <= 2 ? name : individuals);
        this._identityFunction = <IndividualIdentityFunction<I>>(arguments.length <= 2 ? individuals : identityFunction);

        this.validateIfConsumerInstantiation(HallOfFameMetricCollector, arguments);
    }

    public get individuals(): number {
        return this._individuals;
    }

    public set individuals(value: number) {
        if (value < 1)
            throw new Error(`${HallOfFameMetricCollector.name}.individuals must be a positive integer`);
        this._individuals = value;
    }

    public get identityFunction(): IndividualIdentityFunction<I> {
        return this._identityFunction;
    }

    public set identityFunction(value: IndividualIdentityFunction<I>) {
        if (typeof value !== "function")
            throw new Error(`${HallOfFameMetricCollector.name}.identityFunction must be a serializable pure function without any closures`);
        this._identityFunction = value;
    }


    public override update({population}: IGeneration<I>): void {
        const uniqueIndividuals = Array.from(groupBy(
            this.fittest.concat(population),
            individual => this._identityFunction(individual.solution),
            GroupingBehavior.SINGLE_KEY_SINGLE_VALUE
        ).values());

        this.fittest = uniqueIndividuals
            .toSorted((a, b) => b.fitness - a.fitness)
            .slice(0, this._individuals);
    }

    public override finalize(): HallOfFameResult<I> {
        return Object.freeze(this.fittest);
    }
}

export class AggregateMetricCollector<I> extends MetricCollector<I, ReadonlyMap<string, any>, MetricCollector<I, any>> {
    private readonly collectors: MetricCollector<I, any>[];

    public constructor(name: string, collectors: readonly MetricCollector<I, any>[]) {
        super(name);
        this.collectors = [...(collectors ?? [])];
    }

    public get children(): readonly MetricCollector<I, any>[] {
        return this.collectors;
    }

    public override update(generation: IGeneration<I>): void {
        for (const collector of this.collectors) {
            try {
                collector.update(generation);
            } catch (error) {
                throw new Exception(`An error occurred invoking ${MetricCollector.name}`
                    + `'${collector.name}' (${Object.getPrototypeOf(collector).name})`, error);
            }
        }
    }

    public override finalize(): ReadonlyMap<string, object> {
        return groupBy(
            this.collectors,
            collector => collector.name,
            GroupingBehavior.SINGLE_KEY_SINGLE_VALUE
        );
    }
}
