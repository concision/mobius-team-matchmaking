import {Exception} from "../../utilities/Exception";
import {GeneticParameters} from "./GeneticParameters";

export interface IGeneticOperatorChild<I, TChildType = undefined, TOperatorChildType = unknown> {
    readonly child: TChildType,
    readonly operator?: GeneticOperator<I, TOperatorChildType>
}

export abstract class GeneticOperator<I, TChildType = undefined> {
    public readonly name: string;
    private _parameters: GeneticParameters<TChildType> | undefined;

    public constructor(name: string) {
        this.name = name;

        this.validateIfConsumerInstantiation(GeneticOperator, arguments);
    }

    protected get parameters(): GeneticParameters<TChildType> | undefined {
        return this._parameters;
    }


    public validate(recursive: boolean = true): void {
        this.internalValidate();

        if (recursive)
            for (const operator of this.walk(true))
                operator.validate(recursive);
    }

    protected validateIfConsumerInstantiation(
        type: abstract new(...args: any[]) => GeneticOperator<I, TChildType>,
        args: IArguments,
    ): void {
        if (0 < args.length)
            this.internalValidate(type);
    }

    protected validateSelf(): void {
        if (this.name === undefined || this.name === null || this.name.trim() === "")
            throw new Error(`${GeneticOperator.name}.name cannot be empty`);
    }

    private internalValidate(type?: abstract new(...args: any[]) => GeneticOperator<I, TChildType>) {
        const prototype = type?.prototype ?? Object.getPrototypeOf(this);

        if (prototype.hasOwnProperty(this.validateSelf.name))
            prototype.validateSelf.call(this);

        for (const [fieldName, {set, get}] of Object.entries(Object.getOwnPropertyDescriptors(prototype))) {
            if (typeof set !== "function" || typeof get !== "function")
                continue;
            try {
                set.call(this, get.call(this));
            } catch (error) {
                throw new Exception(`An error occurred validating property '${prototype.constructor.name}.${fieldName}'`, error);
            }
        }
    }


    protected get geneticOperatorChildren(): readonly IGeneticOperatorChild<I, TChildType>[] | undefined {
        return undefined;
    }

    public get children(): readonly TChildType[] | undefined {
        return this.geneticOperatorChildren?.map(({child}) => child);
    }

    public get supportsChildren(): boolean {
        return Array.isArray(this.children);
    }

    public* walk(recursive: boolean): Generator<GeneticOperator<I, unknown>> {
        for (const {child, operator} of this.geneticOperatorChildren ?? []) {
            const childOperator = (operator ?? (child instanceof GeneticOperator ? child : undefined));
            if (childOperator === undefined)
                continue;

            yield childOperator;
            if (recursive)
                for (const nestedOperator of childOperator.walk(true))
                    yield nestedOperator;
        }
    }

    // public find<T>(type: abstract new (...args: any[]) => T, recursive: boolean = true): T | undefined {
    //     for (const operator of this.walk(recursive))
    //         if (operator instanceof type)
    //             return operator;
    // }
    //
    // public find<T>(name: string, recursive: boolean = true) {
    //
    // }
    //
    // public find(predicate: (operator: GeneticOperator<I>) => boolean, recursive: boolean = true): GeneticOperator<I> | undefined {}
    //
    // public

    //
    // findAll<T extends { new(): T }>(type: T): T[];


    public add(child: TChildType): boolean {
        throw new Error("Not implemented");
    }

    public remove(child: TChildType): boolean {
        throw new Error("Not implemented");
    }

    // replace<TOperator extends IGeneticOperator<T>>(id: string, replacement: TOperator): void;
    // remove(): void;
}
