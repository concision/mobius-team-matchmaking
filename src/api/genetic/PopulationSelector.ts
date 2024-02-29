import {IIndividualFitness} from "./FitnessFunction";
import {ReplaceReturnType} from "./TypescriptTypes";

export abstract class PopulationSelector<I> {
    public constructor(
        public readonly name: string,
    ) {
    }

    public abstract select(population: readonly IIndividualFitness<I>[], maximumPopulation: number): readonly IIndividualFitness<I>[];
}

export class ChainedPopulationSelector<I> extends PopulationSelector<I> {
    public readonly selectors: PopulationSelector<I>[];

    public constructor(name: string, selectors: readonly PopulationSelector<I>[]) {
        super(name);
        this.selectors = [...selectors];
    }

    public override select(population: readonly IIndividualFitness<I>[], maximumPopulation: number): readonly IIndividualFitness<I>[] {
        for (const selector of this.selectors)
            population = selector.select(population, maximumPopulation);
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

    public override select(population: readonly IIndividualFitness<I>[], maximumPopulation: number): readonly IIndividualFitness<I>[] {
        const nextPopulation: IIndividualFitness<I>[] = [];

        const enabledSelectors = this.selectors.filter(({predicate}) => predicate?.(population, maximumPopulation) ?? true);
        const totalWeight = enabledSelectors.reduce((sum, {weight}) => sum + Math.max(0, weight), 0);
        for (const enabledSelector of enabledSelectors) {
            const selectedPopulation = enabledSelector.selector.select(population, maximumPopulation);
            const individualCount = Math.min(selectedPopulation.length, Math.max(1, Math.ceil(maximumPopulation * enabledSelector.weight / totalWeight)));

            for (let i = 0; i < individualCount; i++) {
                const individual = selectedPopulation[Math.floor(Math.random() * selectedPopulation.length)];
                nextPopulation.push(individual);
            }
        }

        // remove any excess individuals
        while (maximumPopulation < nextPopulation.length)
            nextPopulation.splice(Math.floor(Math.random() * nextPopulation.length), 1);

        return nextPopulation;
    }
}

export class RepopulatePopulationSelector<I> extends PopulationSelector<I> {
    public constructor(name: string) {
        super(name);
    }

    public override select(population: readonly IIndividualFitness<I>[], maximumPopulation: number): readonly IIndividualFitness<I>[] {
        const selectedPopulation: IIndividualFitness<I>[] = [...population];
        while (selectedPopulation.length < maximumPopulation)
            selectedPopulation.push(population[Math.floor(Math.random() * population.length)]);
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

    public override select(population: readonly IIndividualFitness<I>[], maximumPopulation: number): readonly IIndividualFitness<I>[] {
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

    public override select(population: readonly IIndividualFitness<I>[], maximumPopulation: number): readonly IIndividualFitness<I>[] {
        const selectedPopulation: IIndividualFitness<I>[] = [];

        if (this.proportional) {
            const totalFitness = population.reduce((sum, individual) => sum + individual.fitness, 0);
            for (let i = 0; i < maximumPopulation; i++) {
                let choice = Math.random() * totalFitness;
                // TODO: implement a binary search optimization for large populations
                for (const individual of population) {
                    choice -= individual.fitness;
                    if (choice <= 0) {
                        selectedPopulation.push(individual);
                        break;
                    }
                }
            }
        } else {
            for (let i = 0; i < maximumPopulation; i++)
                selectedPopulation.push(population[Math.floor(Math.random() * population.length)]);
        }

        return selectedPopulation;
    }
}

export class TournamentPopulationSelector<I> extends PopulationSelector<I> {
    public constructor(
        name: string,
        public readonly tournamentSize: number,
    ) {
        super(name);
    }

    public override select(population: readonly IIndividualFitness<I>[], maximumPopulation: number): readonly IIndividualFitness<I>[] {
        const selectedPopulation: IIndividualFitness<I>[] = [];
        for (let i = 0; i < maximumPopulation; i++) {
            const tournament: IIndividualFitness<I>[] = Array.from(
                {length: Math.max(2, this.tournamentSize < 1 ? Math.ceil(Math.random() * population.length) : this.tournamentSize)},
                () => population[Math.floor(Math.random() * population.length)]
            );
            const winner = tournament.reduce((max, individual) => max.fitness < individual.fitness ? individual : max, tournament[0]);
            selectedPopulation.push(winner);
        }
        return selectedPopulation;
    }
}

export class DeduplicatePopulationSelector<I> extends PopulationSelector<I> {
    public constructor(
        name: string,
        public readonly identity: (individual: I) => string,
    ) {
        super(name);
    }

    public override select(population: readonly IIndividualFitness<I>[], maximumPopulation: number): readonly IIndividualFitness<I>[] {
        const seen = new Map<string, IIndividualFitness<I>>();
        for (const individual of population) {
            // all individual with the same key should be identical
            const key = this.identity(individual.individual);
            if (!seen.has(key))
                seen.set(key, individual);
        }
        return <const>[...seen.values()];
    }
}

export class KillInvalidPopulationSelector<I> extends PopulationSelector<I> {
    public constructor(
        name: string,
        public readonly killPredicate: (individual: IIndividualFitness<I>) => boolean,
        public readonly killProbability: number = 1,
    ) {
        super(name);
    }

    public override select(population: readonly IIndividualFitness<I>[], maximumPopulation: number): readonly IIndividualFitness<I>[] {
        return population.filter(individual => !this.killPredicate(individual) || Math.random() <= this.killProbability);
    }
}
