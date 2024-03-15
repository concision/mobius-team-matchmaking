import {Exception} from "../utilities/Exception";
import {randomIndex} from "../utilities/Random";
import {EarlyStoppingEvaluator} from "./api/EarlyStoppingEvaluator";
import {IFitness} from "./api/FitnessFunction";
import {GeneticParameters} from "./api/GeneticParameters";
import {IndividualGenerator} from "./api/IndividualGenerator";
import {MetricCollector} from "./api/MetricCollector";
import {IGeneration, PopulationSelector} from "./api/PopulationSelector";

export interface IGeneticAlgorithmResults<I, TMetricCollector> extends IGeneration<I> {
    readonly metrics?: TMetricCollector;
}

export function geneticAlgorithm<I, TMetricCollector>(
    parameters: I extends any[] ? never : GeneticParameters<I, TMetricCollector>
): IGeneticAlgorithmResults<I, TMetricCollector> {
    try {
        for (const operator of parameters.walk(true))
            Object.defineProperty(operator, "_parameters", {value: parameters});
        parameters.validate();

        let lastGeneration: IGeneration<I> | undefined;
        for (const nextGeneration of geneticAlgorithmGenerator(parameters)) {
            if (parameters.debugLogging) {
                const {generation, population} = nextGeneration;
                const fittestIndividual = population
                    .filter(({fitness}) => Number.isFinite(fitness) && !Number.isNaN(fitness))
                    .reduce((max, individual) => max.fitness < individual.fitness ? individual : max, population[0]);
                console.log(`Generation ${generation}: ${population.length} individuals; maximum fitness: ${fittestIndividual?.fitness}`);
            }

            lastGeneration = nextGeneration;
        }

        return {
            generation: lastGeneration?.generation ?? 0,
            population: lastGeneration?.population ?? [],
            metrics: parameters.metricCollector?.finalize(),
        };
    } finally {
        for (const operator of parameters.walk(true))
            Object.defineProperty(operator, "_parameters", {value: undefined});
    }
}

export function* geneticAlgorithmGenerator<I, TMetricCollector>(
    parameters: I extends any[] ? never : GeneticParameters<I, TMetricCollector>
): Generator<IGeneration<I>> {
    const {
        maximumGenerations,
        maximumPopulationSize,
        firstGeneration,
        individualGenerator,
        individualMutator,
        fitnessFunction,
        populationSelector,
        earlyStopping,
        metricCollector,
    } = parameters;

    // generate initial population and compute fitness
    let population: readonly IFitness<I>[] = fitnessFunction.evaluate(
        firstGeneration
        || (individualGenerator instanceof IndividualGenerator ?
            Array.from({length: maximumPopulationSize}, individualGenerator.generate.bind(individualGenerator))
            : [])
    );
    // iterate generations
    for (let generationIndex = 1; maximumGenerations ? generationIndex <= maximumGenerations : true; generationIndex++) {
        // modify selected population via mutations (individual state transitions)
        const currentIndividuals: readonly I[] = Object.freeze(population.map(individual => individual.solution));
        const nextGeneration: readonly I[] = Object.freeze(population.map(individual =>
            // attempt to mutate individual; if mutation fails, use original individual
            individualMutator.mutate(individual.solution, currentIndividuals) ?? individual.solution
        ));
        if (nextGeneration.length === 0)
            throw new Error(`No individuals spawned in next generation ${generationIndex}`);

        // compute fitness of the next generation
        const populationFitness = Object.freeze(fitnessFunction.evaluate(nextGeneration));
        for (const individual of populationFitness)
            Object.freeze(individual);

        // perform selection of individuals for the next generation
        population = populationSelector.select(
            Object.freeze({generation: generationIndex, population: populationFitness}),
            maximumPopulationSize
        );
        if (population.length === 0)
            throw new Error(`${PopulationSelector.name} provided no individuals for next generation ${generationIndex + 1}`);
        // limit population size to maximumPopulationSize
        if (maximumPopulationSize < population.length) {
            const culledPopulation = [...population];
            while (maximumPopulationSize < population.length)
                culledPopulation.splice(randomIndex(population), 1);
            population = culledPopulation;
        }
        population = Object.freeze(population);

        // compute updates
        const generation = Object.freeze({generation: generationIndex, population: population});
        if (metricCollector instanceof MetricCollector) {
            try {
                metricCollector.update(generation);
            } catch (error) {
                throw new Exception(`An error occurred invoking ${MetricCollector.name} `
                    + `'${metricCollector.name}' (${Object.getPrototypeOf(metricCollector).name})`, error);
            }
        }
        yield generation;

        if (earlyStopping instanceof EarlyStoppingEvaluator && earlyStopping.shouldStopEarly(generation))
            break;
    }
}
