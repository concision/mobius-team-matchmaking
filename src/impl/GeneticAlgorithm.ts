import {IIndividualFitness} from "../api/genetic/FitnessFunction";
import {IGeneration, IGeneticOptions} from "../api/genetic/GeneticAlgorithm";

export function geneticAlgorithm<I>(constraints: I extends any[] ? never : IGeneticOptions<I>, individuals: number): readonly IIndividualFitness<I>[] {
    let lastGeneration: readonly IIndividualFitness<I>[] | undefined;
    for (const {generation, population} of geneticAlgorithmGenerator(constraints)) {
        if (constraints.debugMode) {
            const fittestIndividual = population.reduce((max, individual) => individual.fitness > max.fitness ? individual : max, population[0]);
            console.log(`Generation ${generation}: ${population.length} individuals; maximum fitness: ${fittestIndividual?.fitness}`);
        }

        lastGeneration = population;
    }

    return lastGeneration
        ? lastGeneration.toSorted((a, b) => b.fitness - a.fitness).slice(0, individuals)
        : [];
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

    // generate initial population
    const population: readonly IIndividualFitness<I>[] = fitnessFunction.evaluate(
        firstGeneration
        || (typeof individualGenerator === 'function' ? Array.from({length: maximumPopulationSize}, constraints.individualGenerator!) : [])
    );
    let generation: IGeneration<I> = {generation: 0, population};
    // iterate generations
    for (let generationIndex = 1; maximumGenerations ? generationIndex <= maximumGenerations : true; generationIndex++) {
        // perform selection of individuals for the next generation
        let selectedPopulation: readonly IIndividualFitness<I>[] = populationSelector.select(generation, maximumPopulationSize);
        if (selectedPopulation.length === 0)
            throw new Error(`PopulationSelector provided no individuals for next generation ${generationIndex + 1}`);
        // limit population size to maximumPopulationSize
        if (maximumPopulationSize < selectedPopulation.length) {
            const culledPopulation = [...selectedPopulation];
            while (maximumPopulationSize < selectedPopulation.length)
                culledPopulation.splice(Math.floor(Math.random() * selectedPopulation.length), 1);
            selectedPopulation = culledPopulation;
        }

        // modify selected population via mutations (individual state transitions)
        const selectedIndividuals: I[] = selectedPopulation.map(individual => individual.solution);
        const nextGeneration: I[] = selectedPopulation.map(individual =>
            // attempt to mutate individual, otherwise keep it as is
            individualMutator.mutate(individual.solution, selectedIndividuals) ?? individual.solution
        );
        if (nextGeneration.length === 0)
            throw new Error(`No individuals spawned in next generation ${generationIndex}`);

        // compute fitness of the next generation
        let population = fitnessFunction.evaluate(nextGeneration);
        generation = {generation: generationIndex, population};

        // compute updates
        yield generation;
        if (typeof earlyStopping === 'function' && earlyStopping(generation))
            break;
    }
}
