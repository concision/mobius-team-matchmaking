import {groupBy, GroupingBehavior} from "../../utilities/CollectionUtilities";
import {Exception} from "../../utilities/Exception";
import {randomIndex, selectRandomElement, selectUniqueRandomElements} from "../../utilities/Random";
import {ReplaceReturnType} from "../../utilities/TypescriptTypes";
import {IFitness} from "./FitnessFunction";
import {GeneticOperator, IGeneticOperatorChildren} from "./GeneticOperator";
import {IndividualIdentityFunction} from "./IndividualIdentityFunction";

export interface IGeneration<I> {
    readonly generation: number;
    readonly population: readonly IFitness<I>[];
}


export abstract class PopulationSelector<TIndividual, TChildrenType = undefined>
    extends GeneticOperator<TIndividual, TChildrenType> {
    public abstract select(population: IGeneration<TIndividual>, maximumPopulation: number): readonly IFitness<TIndividual>[];
}


export class ChainedPopulationSelector<I> extends PopulationSelector<I, PopulationSelector<I, any>> {
    private readonly selectors: PopulationSelector<I, any>[];

    public constructor(name: string, selectors: readonly PopulationSelector<I, any>[]) {
        super(name);
        this.selectors = Array.isArray(selectors) ? [...selectors] : selectors;

        this.validateIfConsumerInstantiation(ChainedPopulationSelector, arguments);
    }


    protected get provideChildren(): IGeneticOperatorChildren<I, PopulationSelector<I, any>> {
        return Object.freeze({children: this.selectors});
    }

    protected validateChild(child: PopulationSelector<I, any>, index?: number) {
        if (!(child instanceof PopulationSelector))
            throw new Error(`${ChainedPopulationSelector.name}.children[${index ?? "i"}] must be an instance of ${PopulationSelector.name}`);
    }


    public override select({generation, population}: IGeneration<I>, maximumPopulation: number): readonly IFitness<I>[] {
        for (const selector of this.selectors) {
            try {
                population = selector.select({generation, population}, maximumPopulation);
            } catch (error) {
                throw new Exception(`An error occurred invoking ${PopulationSelector.name}`
                    + `'${selector.name}' (${Object.getPrototypeOf(selector).name})`, error);
            }
        }
        return population;
    }
}


export interface IWeightedPopulationSelector<I> {
    readonly weight: number;
    readonly predicate?: ReplaceReturnType<PopulationSelector<I>["select"], boolean>;
    readonly selector: PopulationSelector<I, any>;
}

export class ProportionalPopulationSelector<I> extends PopulationSelector<I, IWeightedPopulationSelector<I>> {
    private readonly selectors: IWeightedPopulationSelector<I>[];

    public constructor(name: string, selectors: readonly IWeightedPopulationSelector<I>[]) {
        super(name);
        this.selectors = Array.isArray(selectors) ? [...selectors] : selectors;

        this.validateIfConsumerInstantiation(ProportionalPopulationSelector, arguments);
    }


    protected get provideChildren(): IGeneticOperatorChildren<I, IWeightedPopulationSelector<I>> {
        return Object.freeze({
            children: this.selectors,
            operatorExtractor: ({selector}: IWeightedPopulationSelector<I>) => selector,
        });
    }

    protected validateChild(child: IWeightedPopulationSelector<I>, index?: number) {
        if (typeof child.weight !== "number" || !Number.isFinite(child.weight) || Number.isNaN(child.weight) || child.weight <= 0)
            throw new Error(`${ProportionalPopulationSelector.name}.children[${index ?? "i"}].weight must be a number greater than or equal to 0`);
        if (child.predicate !== undefined && typeof child.predicate !== "function")
            throw new Error(`${ProportionalPopulationSelector.name}.children[${index ?? "i"}].predicate must be a function (if defined)`);
        if (!(child.selector instanceof PopulationSelector))
            throw new Error(`${ProportionalPopulationSelector.name}.children[${index ?? "i"}].selector must be an instance of ${PopulationSelector.name}`);
    }


    public override select(population: IGeneration<I>, maximumPopulation: number): readonly IFitness<I>[] {
        const nextPopulation: IFitness<I>[] = [];

        const enabledSelectors = this.selectors.filter(({predicate}) => predicate?.(population, maximumPopulation) ?? true);
        const totalWeight = enabledSelectors.reduce((sum, {weight}) => sum + Math.max(0, weight), 0);
        for (const enabledSelector of enabledSelectors) {
            const selectedPopulation = enabledSelector.selector.select(population, maximumPopulation);
            const individualCount = Math.min(selectedPopulation.length, Math.max(1, Math.ceil(maximumPopulation * enabledSelector.weight / totalWeight)));

            for (let i = 0; i < individualCount; i++) {
                nextPopulation.push(selectRandomElement(selectedPopulation)!);
            }
        }

        // remove any excess individuals
        while (maximumPopulation < nextPopulation.length)
            nextPopulation.splice(randomIndex(nextPopulation), 1);

        return Object.freeze(nextPopulation);
    }
}


export class RepopulatePopulationSelector<I> extends PopulationSelector<I> {
    public constructor(name: string) {
        super(name);
    }

    public override select({population}: IGeneration<I>, maximumPopulation: number): readonly IFitness<I>[] {
        const selectedPopulation: IFitness<I>[] = [...population];
        while (selectedPopulation.length < maximumPopulation)
            selectedPopulation.push(selectRandomElement(population)!);
        return Object.freeze(population);
    }
}

export class ElitismPopulationSelector<I> extends PopulationSelector<I> {
    private _proportion: number;

    public constructor(name: string, proportion: number) {
        super(name);
        this._proportion = proportion;

        this.validateIfConsumerInstantiation(ElitismPopulationSelector, arguments);
    }

    public get proportion(): number {
        return this._proportion;
    }

    public set proportion(value: number) {
        if (typeof value !== 'number' || !(0 <= value && value <= 1))
            throw new Error(`${ElitismPopulationSelector.name}.proportion must be a number between 0 and 1`);
        this._proportion = value;
    }

    public override select({population}: IGeneration<I>, maximumPopulation: number): readonly IFitness<I>[] {
        return Object.freeze(
            population
                .toSorted((a, b) => b.fitness - a.fitness)
                .slice(0, Math.max(1, Math.ceil(maximumPopulation * this._proportion)))
        );
    }
}

export class RouletteWheelPopulationSelector<I> extends PopulationSelector<I> {
    private _proportional: boolean;

    public constructor(
        name: string,
        proportional: boolean = true,
    ) {
        super(name);
        this._proportional = proportional;

        this.validateIfConsumerInstantiation(RouletteWheelPopulationSelector, arguments);
    }

    public get proportional(): boolean {
        return this._proportional;
    }

    public set proportional(value: boolean) {
        if (typeof value !== "boolean")
            throw new Error(`${RouletteWheelPopulationSelector.name}.proportional must be a boolean`);
        this._proportional = value;
    }

    public override select({population}: IGeneration<I>, maximumPopulation: number): readonly IFitness<I>[] {
        const selectedPopulation: IFitness<I>[] = [];

        if (this._proportional) {
            const minFitness: number = population
                .filter(({fitness}) => Number.isFinite(fitness) && !Number.isNaN(fitness))
                .reduce((min, {fitness}) => Math.min(min, fitness), 0);
            const cumulativeFitness: number[] = [];
            for (let i = 0; i < selectedPopulation.length; i++)
                cumulativeFitness[i] = (cumulativeFitness[i - 1] ?? 0) + (selectedPopulation[i].fitness - minFitness);
            const aggregateFitness: number = cumulativeFitness[cumulativeFitness.length - 1] ?? 0;

            for (let i = 0; i < maximumPopulation; i++) {
                let choiceIndex = RouletteWheelPopulationSelector.binarySearch(cumulativeFitness, Math.random() * aggregateFitness);
                if (choiceIndex < 0)
                    choiceIndex = ~choiceIndex;

                selectedPopulation.push(population[choiceIndex]);
            }
        } else {
            for (let i = 0; i < maximumPopulation; i++)
                selectedPopulation.push(selectRandomElement(population)!);
        }

        return selectedPopulation;
    }

    /**
     * {@link https://stackoverflow.com/a/29018745/14352161}
     */
    private static binarySearch(array: number[], value: number): number {
        let min = 0;
        let max = array.length - 1;
        while (min <= max) {
            const index = (max + min) >> 1;
            const cmp = value - array[index];
            if (0 < cmp) {
                min = index + 1;
            } else if (cmp < 0) {
                max = index - 1;
            } else {
                return index;
            }
        }
        return ~min;
    }
}

export class TournamentPopulationSelector<I> extends PopulationSelector<I> {
    private _tournamentSize: number;

    public constructor(name: string, tournamentSize: number) {
        super(name);
        this._tournamentSize = tournamentSize;

        this.validateIfConsumerInstantiation(TournamentPopulationSelector, arguments);
    }

    public get tournamentSize(): number {
        return this._tournamentSize;
    }

    public set tournamentSize(value: number) {
        if (!Number.isInteger(value) || value <= 0)
            throw new Error(`${TournamentPopulationSelector.name}.tournamentSize must be a positive integer`);
        this._tournamentSize = value;
    }

    public override select({population}: IGeneration<I>, maximumPopulation: number): readonly IFitness<I>[] {
        const tournamentSize = Math.max(2, this._tournamentSize < 1 ? Math.ceil(Math.random() * population.length) : this._tournamentSize);

        const selectedPopulation: IFitness<I>[] = [];
        for (let i = 0; i < maximumPopulation; i++) {
            const tournament = selectUniqueRandomElements(population, Math.min(population.length, tournamentSize));
            const winner = tournament.reduce((max, individual) => max.fitness < individual.fitness ? individual : max, tournament[0]);
            selectedPopulation.push(winner);
        }
        return selectedPopulation;
    }
}


export class DeduplicatePopulationSelector<I> extends PopulationSelector<I> {
    private _identityFunction: IndividualIdentityFunction<I>;

    public constructor(name: string, identityFunction: IndividualIdentityFunction<I>) {
        super(name);
        this._identityFunction = identityFunction;

        this.validateIfConsumerInstantiation(DeduplicatePopulationSelector, arguments);
    }

    public get identityFunction(): IndividualIdentityFunction<I> {
        return this._identityFunction;
    }

    public set identityFunction(value: IndividualIdentityFunction<I>) {
        if (typeof value !== "function")
            throw new Error(`${DeduplicatePopulationSelector.name}.identityFunction must be a serializable pure function without any closures`);
        this._identityFunction = value;
    }

    public override select({population}: IGeneration<I>, maximumPopulation: number): readonly IFitness<I>[] {
        return Object.freeze(Array.from(groupBy(
            population,
            individual => this._identityFunction(individual.solution),
            GroupingBehavior.SINGLE_KEY_SINGLE_VALUE
        ).values()));
    }
}

export abstract class KillPredicate<I> extends GeneticOperator<I, KillPredicate<I>> {
    public constructor(name: string) {
        super(name);

        this.validateIfConsumerInstantiation(KillPredicate, arguments);
    }

    public abstract shouldKill(individual: IFitness<I>): boolean;
}

export class KillInvalidPopulationSelector<I> extends PopulationSelector<I, KillPredicate<I>> {
    private readonly killPredicates: KillPredicate<I>[];
    private _probability: number | ((generation: number) => number) = 1;

    public constructor(
        name: string,
        killPredicate: KillPredicate<I> | readonly KillPredicate<I>[],
        probability: number | ((generation: number) => number) = 1,
    ) {
        super(name);
        this._probability = probability;
        this.killPredicates = Array.isArray(killPredicate) ? killPredicate : [killPredicate];

        this.validateIfConsumerInstantiation(KillInvalidPopulationSelector, arguments);
    }

    public get probability(): number | ((generation: number) => number) {
        return this._probability;
    }

    public set probability(value: number | ((generation: number) => number)) {
        if (typeof value !== "number" && typeof value !== "function")
            throw new Error(`${KillInvalidPopulationSelector.name}.probability must be a number or a function`);
        this._probability = value;
    }


    protected get provideChildren(): IGeneticOperatorChildren<I, KillPredicate<I>> {
        return Object.freeze({children: this.killPredicates});
    }

    protected validateChild(child: KillPredicate<I>, index?: number) {
        if (!(child instanceof KillPredicate))
            throw new Error(`${KillInvalidPopulationSelector.name}.children[${index ?? "i"}] must be an instance of ${KillPredicate.name}`);
    }


    public override select({population, generation}: IGeneration<I>, maximumPopulation: number): readonly IFitness<I>[] {
        return population.filter(individual =>
            this.killPredicates.filter(predicate => predicate.shouldKill(individual)).length === 0
            || (typeof this._probability === "function" ? this._probability(generation) : this._probability) <= Math.random()
        );
    }
}
