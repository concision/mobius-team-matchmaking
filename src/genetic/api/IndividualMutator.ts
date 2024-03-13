import {selectRandomWeightedElement} from "../../utilities/Random";
import {ReplaceReturnType} from "../../utilities/TypescriptTypes";
import {GeneticOperator, IGeneticOperatorChild} from "./GeneticOperator";

export abstract class IndividualMutator<I, TChildType = undefined> extends GeneticOperator<I, TChildType> {
    public abstract mutate(parent: I, population: readonly I[]): I | undefined;
}


export interface IWeightedIndividualMutator<I> {
    weight: number;
    predicate?: ReplaceReturnType<IndividualMutator<I>["mutate"], boolean>;
    mutator: IndividualMutator<I>;
}

export class WeightedRandomIndividualMutator<I> extends IndividualMutator<I, IWeightedIndividualMutator<I>> {
    private _mutationProbability: number;
    private readonly mutators: IWeightedIndividualMutator<I>[];

    public constructor(
        name: string,
        mutationProbability: number,
        mutators: readonly IWeightedIndividualMutator<I>[],
    ) {
        super(name);
        this._mutationProbability = mutationProbability;
        this.mutators = Array.isArray(mutators) ? [...mutators] : mutators;

        this.validateIfConsumerInstantiation(WeightedRandomIndividualMutator, arguments);
    }

    public get mutationProbability(): number {
        return this._mutationProbability;
    }

    public set mutationProbability(value: number) {
        if (!(0 <= value && value <= 1))
            throw new Error(`${WeightedRandomIndividualMutator.name}.mutationProbability must be a number between 0 and 1`);
        this._mutationProbability = value;
    }

    public get geneticOperatorChildren(): readonly IGeneticOperatorChild<I, IWeightedIndividualMutator<I>>[] {
        return Object.freeze(this.mutators.map(child => ({child, operator: child.mutator})));
    }

    public override mutate(individual: I, population: readonly I[]): I {
        if (this._mutationProbability <= Math.random()) {
            const enabledMutators = this.mutators.filter(({predicate}) => predicate?.(individual, population) ?? true);
            const chosenMutator = selectRandomWeightedElement(enabledMutators, ({weight}) => weight);
            if (chosenMutator)
                return chosenMutator.mutator.mutate(individual, population) ?? individual;
        }

        return individual;
    }
}
