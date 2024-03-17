import {Exception} from "../../utilities/Exception";
import {Type} from "../../utilities/TypescriptTypes";
import {GeneticParameters} from "./GeneticParameters";

export abstract class GeneticOperator<I, TChildType = undefined> {
    public readonly name: string;

    private _parameters?: GeneticParameters<TChildType, any>;

    public constructor(name: string) {
        this.name = name;

        this.validateIfConsumerInstantiation(GeneticOperator, arguments);
    }

    protected get parameters(): GeneticParameters<TChildType, any> | undefined {
        return this._parameters;
    }


    public validate(recursive: boolean = true): void {
        this.internalValidate();

        const seenNames = new Map<string, GeneticOperator<I, any>>();
        for (const {operator} of this.walk(true)) {
            if (operator === undefined)
                continue;

            if (seenNames.has(operator.name))
                throw new Error(`Encountered a duplicate ${GeneticOperator.name} name '${operator.name}' from `
                    + `${seenNames.get(operator.name)!.constructor.name} and ${operator.constructor.name}`);
            seenNames.set(operator.name, operator);
            operator.validate(false);
        }
    }

    protected validateIfConsumerInstantiation(
        type: Type<GeneticOperator<I, TChildType>>,
        args: IArguments,
    ): void {
        if (0 < args.length)
            this.internalValidate(type);
    }

    protected validateSelf(): void {
        if (this.name === undefined || this.name === null || this.name.trim() === "")
            throw new Error(`${GeneticOperator.name}.name cannot be empty`);
    }

    private internalValidate(type?: Type<GeneticOperator<I, TChildType>>) {
        const prototype = type?.prototype ?? Object.getPrototypeOf(this);

        if (prototype.hasOwnProperty(this.validateSelf.name))
            prototype.validateSelf.call(this);

        const children = this.provideChildren?.children;
        if (Array.isArray(children))
            for (let i = 0; i < children.length; i++)
                this.validateChild(children[i], i);

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


    protected get provideChildren(): IGeneticOperatorChildren<I, TChildType> | undefined {
        return undefined;
    }

    protected validateChild(child: TChildType, index?: number): void {
    }

    public get children(): readonly TChildType[] | undefined {
        return this.provideChildren?.children;
    }

    protected get geneticOperatorChildren(): readonly GeneticOperator<I, any>[] {
        const children = this.provideChildren;
        return children?.children
                ?.map(child => children.operatorExtractor?.(child))
                .filter((operator): operator is GeneticOperator<I, TChildType> => operator !== undefined)
            ?? [];
    }

    public add(child: TChildType, index?: number): void {
        const children = this.provideChildren?.children;
        if (!Array.isArray(children) || Object.isFrozen(children))
            throw new Error(`This ${GeneticOperator.name} '${Object.getPrototypeOf(this).constructor.name}' does not support adding children`);
        this.validateChild(child);
        if (index === undefined)
            children.push(child);
        else
            children.splice(index, 0, child);
    }

    public remove(child: TChildType): void {
        const children = this.provideChildren?.children;
        if (!Array.isArray(children) || Object.isFrozen(children))
            throw new Error(`This ${GeneticOperator.name} does not support removing children`);
        const index = children.indexOf(child);
        if (index < 0)
            throw new Error(`Cannot remove child from ${GeneticOperator.name} '${Object.getPrototypeOf(this).constructor.name}'  because it does not exist`);
        children.splice(index, 1);
    }

    public removeAtIndex(index: number): void {
        const children = this.provideChildren?.children;
        if (!Array.isArray(children) || Object.isFrozen(children))
            throw new Error(`This ${GeneticOperator.name} '${Object.getPrototypeOf(this).constructor.name}' does not support removing children`);
        if (index < 0 || children.length <= index)
            throw new Error(`Cannot remove child from ${GeneticOperator.name} '${Object.getPrototypeOf(this).constructor.name}' because it does not exist`);
        children.splice(index, 1);
    }


    public* walk(recursive: boolean, onlyOperatorChildren: boolean = true): Generator<IGeneticOperatorChild> {
        const children = this.provideChildren;
        if (Array.isArray(children?.children)) {
            for (const child of children?.children) {
                let operator = children?.operatorExtractor?.(child);
                if (!(operator instanceof GeneticOperator) && child instanceof GeneticOperator)
                    operator = child;
                if (onlyOperatorChildren && operator === undefined)
                    continue;

                yield new GeneticOperatorChild(this, child, operator);
                if (recursive && operator instanceof GeneticOperator)
                    for (const nestedOperator of operator.walk(true, onlyOperatorChildren))
                        yield nestedOperator;
            }
        }
    }


    public findByName<TChild = any, TParent = any, TOperator extends GeneticOperator<any, any> = GeneticOperator<any, any>>(
        name: string, recursive: boolean = true
    ): IGeneticOperatorChild<TChild, TParent, TOperator> | undefined {
        return this.findByPredicate(({operator}) => operator?.name === name, recursive);
    }

    public findByOperatorType<TChild = any, TParent = any, TOperator extends GeneticOperator<any, any> = GeneticOperator<any, any>>(
        type: Type<TOperator>, recursive: boolean = true
    ): IGeneticOperatorChild<TChild, TParent, TOperator> | undefined {
        return <IGeneticOperatorChild<TChild, TParent, TOperator>>this.findByPredicate(({operator}) => operator instanceof type, recursive);
    }

    public findByPredicate<TChild = any, TParent = any, TOperator extends GeneticOperator<any, any> = GeneticOperator<any, any>>(
        predicate: (child: IGeneticOperatorChild) => boolean, recursive: boolean = true
    ): IGeneticOperatorChild<TChild, TParent, TOperator> | undefined {
        for (const child of this.walk(recursive, false))
            if (predicate(child))
                return <IGeneticOperatorChild<TChild, TParent, TOperator>>child;
        return undefined;
    }

    public findAllByName<TChild = any, TParent = any, TOperator extends GeneticOperator<any, any> = GeneticOperator<any, any>>(
        name: string, recursive: boolean = true
    ): readonly IGeneticOperatorChild<TChild, TParent, TOperator>[] {
        return this.findAllByPredicate(({operator}) => operator?.name === name, recursive);
    }

    public findAllByOperatorType<TChild = any, TParent = any, TOperator extends GeneticOperator<any, any> = GeneticOperator<any, any>>(
        type: Type<TOperator>, recursive: boolean = true
    ): readonly  IGeneticOperatorChild<TChild, TParent, TOperator>[] {
        return this.findAllByPredicate(({operator}) => operator instanceof type, recursive);
    }

    public findAllByPredicate<TChild = any, TParent = any, TOperator extends GeneticOperator<any, any> = GeneticOperator<any, any>>(
        predicate: (child: IGeneticOperatorChild) => boolean, recursive: boolean = true
    ): readonly IGeneticOperatorChild<TChild, TParent, TOperator>[] {
        const results: IGeneticOperatorChild<TChild, TParent, TOperator>[] = [];
        for (const child of this.walk(recursive, false))
            if (predicate(child))
                results.push(<IGeneticOperatorChild<TChild, TParent, TOperator>>child);
        return results;
    }

    public replaceByName(name: string, replacement: TChildType, recursive: false): void;
    public replaceByName(name: string, replacement: any, recursive: true): void;
    public replaceByName(name: string, replacement: any, recursive: boolean = true): void {
        this.internalReplaceByPredicate(({operator}) => operator?.name === name, replacement, recursive);
    }

    public replaceByType<TOperator extends GeneticOperator<I>>(type: Type<TOperator>, replacement: TOperator, recursive: boolean = true): void {
        this.internalReplaceByPredicate(({operator}) => operator instanceof type, <any>replacement, recursive);
    }

    public replaceByPredicate<T extends TChildType>(predicate: (child: IGeneticOperatorChild) => boolean, replacement: TChildType, recursive: false): void;
    public replaceByPredicate(predicate: (child: IGeneticOperatorChild) => boolean, replacement: any, recursive: true): void;
    public replaceByPredicate(
        predicate: (child: IGeneticOperatorChild) => boolean,
        replacement: any,
        recursive: boolean = true,
    ): void {
        this.internalReplaceByPredicate(predicate, replacement, recursive);
    }

    private internalReplaceByPredicate(predicate: (child: IGeneticOperatorChild) => boolean, replacement: any, recursive: boolean = true): void {
        const provideChildren = this.provideChildren;
        const children = provideChildren?.children;
        if (!Array.isArray(children))
            throw new Error(`This ${GeneticOperator.name} '${Object.getPrototypeOf(this).constructor.name}' does not support replacing children`);

        if (recursive) {
            for (const child of this.walk(true, false)) {
                if (predicate(child)) {
                    const parentChildren = child.parent.provideChildren?.children!;
                    if (Object.isFrozen(parentChildren))
                        throw new Error(`This ${GeneticOperator.name} '${Object.getPrototypeOf(this).constructor.name}' `
                            + `does not support replacing children`);
                    child.parent.validateChild(replacement);
                    (<any[]>parentChildren)[parentChildren.indexOf(child)] = replacement;

                    break;
                }
            }
        } else {
            const index = children.findIndex(child => predicate(new GeneticOperatorChild(this, child, provideChildren?.operatorExtractor?.(child))));
            if (index < 0)
                throw new Error(`Cannot replace child from ${GeneticOperator.name} '${Object.getPrototypeOf(this).constructor.name}' because it does not exist`);
            this.validateChild(replacement);
            children[index] = replacement;
        }
    }
}

export interface IGeneticOperatorChildren<I, TChildType = undefined> {
    readonly children: TChildType[] | readonly TChildType[];
    readonly operatorExtractor?: (child: TChildType) => GeneticOperator<I, any> | undefined;
}

export interface IGeneticOperatorChild<TChild = any, TParent = any, TOperator extends GeneticOperator<any, any> = GeneticOperator<any, any>> {
    parent: TParent;
    child: TChild;
    operator?: TOperator;

    remove(): void;
}

class GeneticOperatorChild<TChild, TParent, TOperator extends GeneticOperator<any, any>> implements IGeneticOperatorChild<TChild, TParent, TOperator> {
    public readonly parent: TParent;
    public readonly child: TChild;
    public readonly operator?: TOperator;

    public constructor(parent: TParent, child: TChild, operator?: TOperator) {
        this.parent = parent;
        this.child = child;
        this.operator = operator;
    }

    public remove(): void {
        if (!(this.parent instanceof GeneticOperator))
            throw new Error(`Cannot remove child from ${Object.getPrototypeOf(this.parent).constructor.name} because it does not support removing children`);
        this.parent.remove(this.child);
    }
}
