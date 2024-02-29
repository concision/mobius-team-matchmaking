import {ReplaceReturnType} from "./Types";
import {IndividualMutator2} from "../../../dist/api/genetic/IndividualMutator";

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

export class WeightedRandomIndividualMutator<I> extends IndividualMutator2<I> {
    public readonly mutations: IWeightedIndividualMutator<I>[];

    constructor(name: string, mutations: readonly IWeightedIndividualMutator<I>[]) {
        super(name);
        this.mutations = [...mutations];
    }

    public override mutate(individual: I, population: readonly I[]): I {
        const enabledGenerators = this.mutations.filter(({predicate}) => predicate?.(individual, population) ?? true);
        const totalWeight: number = this.mutations.reduce((sum, {weight}) => sum + Math.max(0, weight), 0);

        let choice = Math.floor(Math.random() * totalWeight);
        for (const enabledGenerator of enabledGenerators) { // unlikely to need a binary search optimization
            choice -= enabledGenerator.weight;
            if (choice < 0)
                return enabledGenerator.mutator.mutate(individual, population) ?? individual;
        }

        return individual;
    }
}