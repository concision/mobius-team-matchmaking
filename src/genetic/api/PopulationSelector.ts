import {ReplaceReturnType} from "../../utilities/TypescriptTypes";
import {IndividualIdentityFunction} from "./IndividualIdentityFunction";
import {IFitness, IGeneration} from "./IGeneticParameters";
import {randomIndex, selectRandomElement, selectUniqueRandomElements} from "../../utilities/Random";

export abstract class PopulationSelector<I> {
    public constructor(
        public readonly name: string,
    ) {
    }

    public abstract select(population: IGeneration<I>, maximumPopulation: number): readonly IFitness<I>[];
}

export class ChainedPopulationSelector<I> extends PopulationSelector<I> {
    public readonly selectors: PopulationSelector<I>[];

    public constructor(name: string, selectors: readonly PopulationSelector<I>[]) {
        super(name);
        this.selectors = [...selectors];
    }

    public override select({generation, population}: IGeneration<I>, maximumPopulation: number): readonly IFitness<I>[] {
        for (const selector of this.selectors)
            population = selector.select({generation, population}, maximumPopulation);
        return population;
    }
}

export interface IWeightedPopulationSelector<I> {
    readonly weight: number;
    readonly predicate?: ReplaceReturnType<PopulationSelector<I>["select"], boolean>;
    readonly selector: PopulationSelector<I>;
}

export class ProportionalPopulationSelector<I> extends PopulationSelector<I> {
    public readonly selectors: IWeightedPopulationSelector<I>[];

    public constructor(name: string, selectors: readonly IWeightedPopulationSelector<I>[]) {
        super(name);
        this.selectors = [...selectors];
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

        return nextPopulation;
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
        return population;
    }
}

export class ElitistPopulationSelector<I> extends PopulationSelector<I> {
    public constructor(
        name: string,
        public readonly elitismProportion: number,
    ) {
        super(name);
    }

    public override select({population}: IGeneration<I>, maximumPopulation: number): readonly IFitness<I>[] {
        return population.toSorted((a, b) => b.fitness - a.fitness)
            .slice(0, Math.max(1, Math.ceil(maximumPopulation * this.elitismProportion)));
    }
}

export class RouletteWheelPopulationSelector<I> extends PopulationSelector<I> {
    public constructor(
        name: string,
        public readonly proportional: boolean = true,
    ) {
        super(name);
    }

    public override select({population}: IGeneration<I>, maximumPopulation: number): readonly IFitness<I>[] {
        const selectedPopulation: IFitness<I>[] = [];

        if (this.proportional) {
            const minFitness: number = population.reduce((min, individual) => Math.min(min, individual.fitness), 0);
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
    public constructor(
        name: string,
        public readonly tournamentSize: number,
    ) {
        super(name);
    }

    public override select({population}: IGeneration<I>, maximumPopulation: number): readonly IFitness<I>[] {
        const tournamentSize = Math.max(2, this.tournamentSize < 1 ? Math.ceil(Math.random() * population.length) : this.tournamentSize);

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
    public constructor(
        name: string,
        public readonly identity: IndividualIdentityFunction<I>,
    ) {
        super(name);
    }

    public override select({population}: IGeneration<I>, maximumPopulation: number): readonly IFitness<I>[] {
        const seen = new Map<string, IFitness<I>>();
        for (const individual of population) {
            // all individual with the same key should be identical
            const key = this.identity(individual.solution);
            if (!seen.has(key))
                seen.set(key, individual);
        }
        return <const>[...seen.values()];
    }
}

export type KillPredicate<I> = (individual: IFitness<I>) => boolean;

export class KillInvalidPopulationSelector<I> extends PopulationSelector<I> {
    public readonly killPredicates: KillPredicate<I>[];

    public constructor(
        name: string,
        killPredicate: KillPredicate<I> | readonly KillPredicate<I>[],
        public readonly killProbability: number | ((generation: number) => number) = 1,
    ) {
        super(name);
        this.killPredicates = Array.isArray(killPredicate) ? killPredicate : [killPredicate];
    }

    public override select({population, generation}: IGeneration<I>, maximumPopulation: number): readonly IFitness<I>[] {
        return population.filter(individual =>
            this.killPredicates.filter(predicate => predicate(individual)).length === 0
            || (typeof this.killProbability === "function" ? this.killProbability(generation) : this.killProbability) <= Math.random()
        );
    }
}
