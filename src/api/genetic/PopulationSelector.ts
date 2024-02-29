import {IIndividualFitness} from "./FitnessFunction";
import {ReplaceReturnType} from "./Types";

// proportional selection: fill X% of the next generation with the results from Z selection
// raw selectors: roulette wheel selection, tournament selection, rank selection, steady state, elitist, kill invalid individuals % of the time

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
        for (const selector of this.selectors) {
            population = selector.select(population, maximumPopulation);
        }
        return population;
    }
}

export interface IWeightedPopulationSelector<I> {
    weight: number;
    predicate?: ReplaceReturnType<PopulationSelector<I>["select"], boolean>;
    selector: PopulationSelector<I>;
}

export class ProportionalPopulationSelector<I> extends PopulationSelector<I> {
    public readonly selectors: IWeightedPopulationSelector<I>[];

    public constructor(name: string, selectors: readonly IWeightedPopulationSelector<I>[]) {
        super(name);
        this.selectors = [...selectors];
    }

    public override select(population: readonly IIndividualFitness<I>[], maximumPopulation: number): readonly IIndividualFitness<I>[] {
        // TODO: implement proportional selection
        return this.selectors[0].selector.select(population, maximumPopulation);
    }
}

// maybe TODO: implement a population selector that only culls/selects every N generations to allow more state transitions for a population before selective pressure is applied

export class RepopulatePopulationSelector<I> extends PopulationSelector<I> {
    public constructor(name: string) {
        super(name);
    }

    public override select(population: readonly IIndividualFitness<I>[], maximumPopulation: number): readonly IIndividualFitness<I>[] {
        const newPopulation: IIndividualFitness<I>[] = [...population];
        while (newPopulation.length < maximumPopulation)
            newPopulation.push(population[Math.floor(Math.random() * population.length)]);
        return population;
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
                    if (choice < 0) {
                        selectedPopulation.push(individual);
                        break;
                    }
                }
            }
        } else {
            for (let i = 0; i < maximumPopulation; i++) {
                selectedPopulation.push(population[Math.floor(Math.random() * population.length)]);
            }
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
            const winner = tournament.reduce((max, individual) => individual.fitness > max.fitness ? individual : max, tournament[0]);
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
        public readonly predicate: (individual: IIndividualFitness<I>) => boolean,
        public readonly chanceToKill: number = 1,
    ) {
        super(name);
    }

    public override select(population: readonly IIndividualFitness<I>[], maximumPopulation: number): readonly IIndividualFitness<I>[] {
        return population.filter(individual => this.predicate(individual) || Math.random() <= this.chanceToKill);
    }
}
