import {ReplaceReturnType} from "./TypescriptTypes";
import {selectRandomWeightedElement} from "../../impl/lib/Random";

export abstract class IndividualMutator<I> {
    public constructor(
        public readonly name: string,
    ) {
    }

    public abstract mutate(parent: I, population: readonly I[]): I | undefined;
}


export interface IWeightedIndividualMutator<I> {
    weight: number;
    predicate?: ReplaceReturnType<IndividualMutator<I>["mutate"], boolean>;
    mutator: IndividualMutator<I>;
}

export class WeightedRandomIndividualMutator<I> extends IndividualMutator<I> {
    public readonly mutators: IWeightedIndividualMutator<I>[];

    constructor(
        name: string,
        public readonly mutationProbability: number,
        mutators: readonly IWeightedIndividualMutator<I>[]
    ) {
        super(name);
        this.mutators = [...mutators];
    }

    public override mutate(individual: I, population: readonly I[]): I {
        if (this.mutationProbability <= Math.random()) {
            const enabledMutators = this.mutators.filter(({predicate}) => predicate?.(individual, population) ?? true);
            const chosenMutator = selectRandomWeightedElement(enabledMutators, ({weight}) => weight);
            if (chosenMutator)
                return chosenMutator.mutator.mutate(individual, population) ?? individual;
        }

        return individual;
    }
}
