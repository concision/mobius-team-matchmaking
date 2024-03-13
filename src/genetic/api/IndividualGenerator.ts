import {GeneticOperator} from "./GeneticOperator";
import {GeneticParameters} from "./GeneticParameters";

export abstract class IndividualGenerator<I> extends GeneticOperator<I> {
    public abstract generate(parameters: GeneticParameters<I>): I;
}


export class LambdaIndividualGenerator<I> extends IndividualGenerator<I> {
    private _generator: () => I;

    public constructor(generator: () => I);

    public constructor(name: string, generator: () => I);

    public constructor(nameOrGenerator: string | (() => I), generator?: () => I) {
        super(typeof nameOrGenerator === "string" ? nameOrGenerator : LambdaIndividualGenerator.name);
        this._generator = typeof nameOrGenerator === "string" ? generator! : nameOrGenerator;

        this.validateIfConsumerInstantiation(LambdaIndividualGenerator, arguments);
    }

    public get generator(): () => I {
        return this._generator;
    }

    public set generator(value: () => I) {
        if (typeof value !== "function")
            throw new Error(`${LambdaIndividualGenerator.name}.generator must be a serializable pure function without any closures`);
        this._generator = value;
    }

    public override generate(parameters: GeneticParameters<I>): I {
        return this._generator();
    }
}
