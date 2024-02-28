type ReplaceReturnType<T extends (...args: any) => any, TNewReturn> = (...args: Parameters<T>) => TNewReturn;


export type IndividualGenerator<I> = () => I;

export type IndividualMutator<I> = (individual: I, population: readonly I[]) => I;
export type OptionalIndividualMutator<I> = ReplaceReturnType<IndividualMutator<I>, I | undefined | null | void>;

export interface IWeightedIndividualMutator<I> {
    weight: number;
    predicate?: ReplaceReturnType<IndividualMutator<I>, boolean>;
    mutator: OptionalIndividualMutator<I>;
}

export function WeightedRandomIndividualMutator<I>(...mutations: IWeightedIndividualMutator<I>[]): IndividualMutator<I> {
    return (individual, population) => {
        const enabledGenerators = mutations.filter(({predicate}) => predicate?.(individual, population) ?? true);
        const totalWeight: number = mutations.reduce((sum, {weight}) => sum + Math.max(0, weight), 0);

        let choice = Math.floor(Math.random() * totalWeight); // unlikely to need a binary search optimization
        for (const enabledGenerator of enabledGenerators) {
            choice -= enabledGenerator.weight;
            if (choice < 0)
                return enabledGenerator.mutator(individual, population) ?? individual;
        }

        return individual;
    }
}


export interface IIndividualFitness<I> {
    readonly individual: I;
    readonly fitness: number;
}

/**
 * A fitness function is a function that takes a population of individuals and returns a list of individuals with their fitness scores. Some fitness functions
 * may require the entire population to be evaluated to return any fitness scores (e.g. when a fitness score is not absolute, but relative).
 */
export type FitnessFunction<I> = (population: readonly I[]) => readonly IIndividualFitness<I>[];

/**
 * A fitness functions that evaluates the fitness of an individual independent of the population. This is useful for fitness functions that return absolute
 * fitness scores.
 * @param fitnessFunction A function that takes an individual and returns a number fitness score.
 */
export function IndividualFitnessFunction<I>(fitnessFunction: (individual: I) => number): FitnessFunction<I> {
    return (population: readonly I[]) => {
        return population.map(individual => ({individual, fitness: fitnessFunction(individual)}));
    }
}

export interface IFitnessFunctionWeighting<I> {
    name?: string;
    weighting: number;
    fitnessFunction: FitnessFunction<I>;
    normalizer: "gaussian";
    // normalizer: "linear" | "gaussian" | "normal" | "exponential" | "logarithmic" | "sigmoid" | "tanh" | "none";

    // TODO: implement weighting for fitness functions
    // TODO: account for gaussian, linear unbounded distributions, normal distributions, etc
    // TODO: implement predicate for fitness functions
}

export function MultivariateFitnessFunction<I>(...fitnessFunctions: readonly IFitnessFunctionWeighting<I>[]): FitnessFunction<I> {
    return (population: readonly I[]) => {
        const fitnessFunctionValues: ReadonlyArray<ReadonlyArray<number>> = fitnessFunctions.map(
            ({fitnessFunction}) => fitnessFunction(population).map(({fitness}) => fitness)
        );

        const fitness: IIndividualFitness<I>[] = [];
        for (let i = 0; i < population.length; i++) {
            const individualFitness: number[] = Array.from({length: fitnessFunctions.length}, (_, f) => fitnessFunctionValues[f][i]);

            fitness.push({
                individual: population[i],
                // TODO: actually implement multivariate fitness function, this is just a placeholder
                fitness: individualFitness.reduce((sum, fitness) => sum + fitness, 0) / individualFitness.length
            });
        }
        return fitness;
    }
}


// chained selection: deduplication, then another selection
// proportional selection: fill X% of the next generation with the results from Z selection
// raw selectors: roulette wheel selection, tournament selection, rank selection, steady state, elitist, kill invalid individuals % of the time
export type PopulationSelector<I> = (population: readonly IIndividualFitness<I>[], maximumPopulation: number) => readonly IIndividualFitness<I>[];

// maybe TODO: implement a population selector that only culls/selects every N generations to allow more state transitions for a population before selective pressure is applied

export function ChainedPopulationSelector<I>(...selectors: PopulationSelector<I>[]): PopulationSelector<I> & {
    selectors: readonly PopulationSelector<I>[]
} {
    const selector = function (population: readonly IIndividualFitness<I>[], maximumPopulation: number) {
        for (const selector of selectors) {
            population = selector(population, maximumPopulation);
        }
        return population;
    };
    selector.selectors = selectors;
    return selector;
}

export function RepopulatePopulationSelector<I>(): PopulationSelector<I> {
    return (population: readonly IIndividualFitness<I>[], maximumPopulation: number) => {
        const newPopulation: IIndividualFitness<I>[] = [...population];
        while (newPopulation.length < maximumPopulation)
            newPopulation.push(population[Math.floor(Math.random() * population.length)]);
        return population;
    };
}

export function DeduplicatePopulationSelector<I>(identity: (individual: I) => string): PopulationSelector<I> {
    return (population: readonly IIndividualFitness<I>[], maximumPopulation: number) => {
        const seen = new Map<string, IIndividualFitness<I>>();
        for (const individual of population) {
            const key = identity(individual.individual);
            if (!seen.has(key))
                seen.set(key, individual);
        }
        return <const>[...seen.values()];
    };
}

export function KillInvalidPopulationSelector<I>(predicate: (individual: IIndividualFitness<I>) => boolean, chance: number = 1): PopulationSelector<I> {
    return (population: readonly IIndividualFitness<I>[], maximumPopulation: number) => {
        return population.filter(individual => predicate(individual) || Math.random() <= chance);
    };
}

export interface IWeightedSelector<I> {
    weight: number;
    predicate?: ReplaceReturnType<IndividualMutator<I>, boolean>;
    mutator: ReplaceReturnType<IndividualMutator<I>, I | undefined | null | void>;
}

export function ProportionalPopulationSelector<I>(...selectors: readonly IWeightedSelector<I>[]): PopulationSelector<I> {
    return (population: readonly IIndividualFitness<I>[], maximumPopulation: number) => {
        return null!;
    }
}

export function TournamentPopulationSelector<I>(tournamentSize: number): PopulationSelector<I> {
    return (population: readonly IIndividualFitness<I>[], maximumPopulation: number) => {
        const selectedPopulation: IIndividualFitness<I>[] = [];
        for (let i = 0; i < maximumPopulation; i++) {
            const tournament: IIndividualFitness<I>[] = Array.from(
                {length: Math.max(2, tournamentSize < 1 ? Math.ceil(Math.random() * population.length) : tournamentSize)},
                () => population[Math.floor(Math.random() * population.length)]
            );
            // michelle is a nerd
            const winner = tournament.reduce((max, individual) => individual.fitness > max.fitness ? individual : max, tournament[0]);
            selectedPopulation.push(winner);
        }
        return selectedPopulation;
    }
}


export interface IConstraints<I> {
    readonly maximumGenerations: number;
    readonly maximumPopulationSize: number;

    firstGeneration?: readonly I[];
    individualGenerator?: IndividualGenerator<I>;
    individualMutator: IndividualMutator<I>;
    fitnessFunction: FitnessFunction<I>;
    populationSelector: PopulationSelector<I>;
    // TODO: implement early stopping criteria
}

export interface IGeneration<I> {
    generation: number;
    population: readonly IIndividualFitness<I>[];
}

export function geneticAlgorithm<I>(constraints: I extends any[] ? never : IConstraints<I>, individuals: number): readonly IIndividualFitness<I>[] {
    let lastGeneration: readonly IIndividualFitness<I>[] | undefined;
    for (const {generation, population} of geneticAlgorithms(constraints)) {
        const fittestIndividual = population.reduce((max, individual) => individual.fitness > max.fitness ? individual : max, population[0]);
        console.log(`Generation ${generation}: ${population.length} individuals; fittest: ${fittestIndividual?.fitness}`);

        lastGeneration = population;
    }

    return lastGeneration
        ? lastGeneration.toSorted((a, b) => b.fitness - a.fitness).slice(0, individuals)
        : [];
}

/**
 *
 * @param constraints
 * @template I The type of the individual in the population.
 */
export function* geneticAlgorithms<I>(constraints: I extends any[] ? never : IConstraints<I>): Generator<IGeneration<I>> {
    const {
        maximumGenerations,
        maximumPopulationSize,
        firstGeneration,
        individualGenerator,
        individualMutator,
        fitnessFunction,
        populationSelector,
    } = constraints;

    // generate initial population
    let population: readonly IIndividualFitness<I>[] = fitnessFunction(
        firstGeneration
        || (typeof individualGenerator == 'function' ? Array.from({length: maximumPopulationSize}, constraints.individualGenerator!) : [])
    );
    // iterate generations
    for (let generation = 1; generation <= maximumGenerations; generation++) {
        // perform selection of individuals for the next generation
        let selectedPopulation: readonly IIndividualFitness<I>[] = populationSelector(population, maximumPopulationSize);
        if (selectedPopulation.length == 0)
            throw new Error(`PopulationSelector provided no individuals for next generation ${generation + 1}`);
        // limit population size to maximumPopulationSize
        if (maximumPopulationSize < selectedPopulation.length) {
            const culledPopulation = [...selectedPopulation];
            while (maximumPopulationSize < selectedPopulation.length)
                culledPopulation.splice(Math.floor(Math.random() * selectedPopulation.length), 1);
            selectedPopulation = culledPopulation;
        }

        // modify selected population via mutations (individual state transitions)
        const selectedIndividuals: I[] = selectedPopulation.map(individual => individual.individual);
        const nextGeneration: I[] = selectedPopulation.map(individual => individualMutator(individual.individual, selectedIndividuals));
        if (nextGeneration.length == 0)
            throw new Error(`No individuals spawned in next generation ${generation}`);

        // compute fitness of the next generation
        population = fitnessFunction(nextGeneration);

        // compute updates
        yield {generation, population};
    }
}
