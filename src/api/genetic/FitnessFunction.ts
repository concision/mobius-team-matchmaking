export interface IIndividualFitness<I> {
    readonly individual: I;
    readonly fitness: number;
}

/**
 * A fitness function receives a population of individuals and returns a list of individuals with their fitness scores.
 * Some fitness functions may require the entire population to be evaluated to return any fitness scores (e.g. when a
 * fitness score is not absolute, but relative).
 */
export abstract class FitnessFunction<I> {
    public constructor(
        public readonly name: string,
    ) {
    }

    public abstract evaluate(population: readonly I[]): readonly IIndividualFitness<I>[];
}

export class IndividualFitnessFunction<I> extends FitnessFunction<I> {
    /**
     * A fitness functions that evaluates the fitness of an individual independent of the population. This is useful for fitness functions that return absolute
     * fitness scores.
     * @param name A human-readable name for the fitness function.
     * @param fitnessFunction A function that takes an individual and returns a number fitness score.
     */
    public constructor(
        name: string,
        public readonly fitnessFunction: (individual: I) => number,
    ) {
        super(name);
    }

    public override evaluate(population: readonly I[]): readonly IIndividualFitness<I>[] {
        return population.map(individual => ({individual, fitness: this.fitnessFunction(individual)}));
    }
}

export interface IFitnessFunctionWeighting<I> {
    weighting: number;
    // TODO: account for gaussian, linear unbounded distributions, normal distributions, etc
    // normalizer: "linear" | "gaussian" | "normal" | "exponential" | "logarithmic" | "sigmoid" | "tanh" | "none";
    normalizer: "gaussian";
    fitnessFunction: FitnessFunction<I>;
    // TODO: implement predicate for fitness functions?
}

export class MultivariateFitnessFunction<I> extends FitnessFunction<I> {
    public readonly fitnessFunctions: IFitnessFunctionWeighting<I>[];

    public constructor(name: string, fitnessFunctions: readonly IFitnessFunctionWeighting<I>[]) {
        super(name);
        this.fitnessFunctions = [...fitnessFunctions];
    }

    public override evaluate(population: readonly I[]): readonly IIndividualFitness<I>[] {
        // TODO: implement weighting for fitness functions
        const fitnessFunctionValues: ReadonlyArray<ReadonlyArray<number>> = this.fitnessFunctions.map(
            ({fitnessFunction}) => fitnessFunction.evaluate(population).map(({fitness}) => fitness)
        );

        const fitness: IIndividualFitness<I>[] = [];
        for (let i = 0; i < population.length; i++) {
            const individualFitness = Array.from({length: this.fitnessFunctions.length}, (_, f) => fitnessFunctionValues[f][i]);

            fitness.push({
                individual: population[i],
                // TODO: actually implement multivariate fitness function, this is just a placeholder
                fitness: individualFitness.reduce((sum, fitness) => sum + fitness, 0) / individualFitness.length,
            });
        }
        return fitness;
    }
}
