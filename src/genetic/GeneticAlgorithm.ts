import {IFitness, IGeneration, IGeneticOptions} from "./api/GeneticAlgorithm";
import {randomIndex} from "./library/Random";

export function geneticAlgorithm<I>(constraints: I extends any[] ? never : IGeneticOptions<I>, individuals: number): readonly IFitness<I>[] {
    let fittest: IFitness<I>[] = [];
    for (const {generation, population} of geneticAlgorithmGenerator(constraints)) {
        if (constraints.debugLogging) {
            const fittestIndividual = population.reduce((max, individual) => individual.fitness > max.fitness ? individual : max, population[0]);
            console.log(`Generation ${generation}: ${population.length} individuals; maximum fitness: ${fittestIndividual?.fitness}`);
        }

        // keep track of the fittest individuals across all generations
        const seen = new Map<string, IFitness<I>>();
        for (const individual of fittest.concat(population)) {
            // all individual with the same key should be identical
            const key = constraints.individualIdentity(individual.solution);
            if (!seen.has(key))
                seen.set(key, individual);
        }
        fittest = Array.from(seen.values())
            .toSorted((a, b) => b.fitness - a.fitness)
            .slice(0, individuals);
    }

    return fittest;
}

export function* geneticAlgorithmGenerator<I>(constraints: I extends any[] ? never : IGeneticOptions<I>): Generator<IGeneration<I>> {
    const {
        maximumGenerations,
        maximumPopulationSize,
        firstGeneration,
        individualGenerator,
        individualMutator,
        fitnessFunction,
        populationSelector,
        earlyStopping,
    } = constraints;

    let generation: IGeneration<I> = {
        generation: 0,
        // generate initial population
        population: fitnessFunction.evaluate(
            firstGeneration
            || (typeof individualGenerator === 'function' ? Array.from({length: maximumPopulationSize}, constraints.individualGenerator!) : [])
        ),
    };
    // iterate generations
    for (let generationIndex = 1; maximumGenerations ? generationIndex <= maximumGenerations : true; generationIndex++) {
        // modify selected population via mutations (individual state transitions)
        const currentIndividuals: I[] = generation.population.map(individual => individual.solution);
        const nextGeneration: I[] = generation.population.map(individual =>
            // attempt to mutate individual; if mutation fails, use original individual
            individualMutator.mutate(individual.solution, currentIndividuals) ?? individual.solution
        );
        if (nextGeneration.length === 0)
            throw new Error(`No individuals spawned in next generation ${generationIndex}`);

        // compute fitness of the next generation
        const populationFitness = fitnessFunction.evaluate(nextGeneration);

        // perform selection of individuals for the next generation
        let selectedPopulation: readonly IFitness<I>[] = populationSelector.select(
            {generation: generationIndex, population: populationFitness},
            maximumPopulationSize
        );
        if (selectedPopulation.length === 0)
            throw new Error(`PopulationSelector provided no individuals for next generation ${generationIndex + 1}`);
        // limit population size to maximumPopulationSize
        if (maximumPopulationSize < selectedPopulation.length) {
            const culledPopulation = [...selectedPopulation];
            while (maximumPopulationSize < selectedPopulation.length)
                culledPopulation.splice(randomIndex(selectedPopulation), 1);
            selectedPopulation = culledPopulation;
        }

        // compute updates
        generation = {generation: generationIndex, population: selectedPopulation};
        yield generation;

        if (typeof earlyStopping === 'function' && earlyStopping(generation))
            break;
    }
}
