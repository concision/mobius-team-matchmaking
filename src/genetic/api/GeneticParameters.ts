import {EarlyStoppingEvaluator} from "./EarlyStoppingEvaluator";
import {FitnessFunction} from "./FitnessFunction";
import {GeneticOperator, IGeneticOperatorChildren} from "./GeneticOperator";
import {IndividualGenerator} from "./IndividualGenerator";
import {IndividualMutator} from "./IndividualMutator";
import {MetricCollector} from "./MetricCollector";
import {PopulationSelector} from "./PopulationSelector";

export interface IGeneticParameters<I, TMetricCollector> {
    debugLogging?: boolean;

    maximumGenerations: number;
    maximumPopulationSize: number;

    firstGeneration?: readonly I[];
    individualGenerator?: IndividualGenerator<I>;

    individualMutator: IndividualMutator<I, any>;
    fitnessFunction: FitnessFunction<I, any>;
    populationSelector: PopulationSelector<I, any>;
    earlyStopping?: EarlyStoppingEvaluator<I>;

    metricCollector?: MetricCollector<I, TMetricCollector>;
}

type RequiredGeneticParameters<I, TMetricCollector> = IGeneticParameters<I, TMetricCollector>
    & Required<Pick<IGeneticParameters<I, TMetricCollector>, "debugLogging">>;

export class GeneticParameters<I, TMetricCollector> extends GeneticOperator<I, GeneticOperator<I, any>>
    implements RequiredGeneticParameters<I, TMetricCollector> {
    private _debugLogging: boolean;

    private _maximumGenerations: number;
    private _maximumPopulationSize: number;

    private _firstGeneration?: readonly I[] | undefined;
    private _individualGenerator?: IndividualGenerator<I> | undefined;

    private _individualMutator: IndividualMutator<I, any>;
    private _fitnessFunction: FitnessFunction<I, any>;
    private _populationSelector: PopulationSelector<I, any>;
    private _earlyStopping?: EarlyStoppingEvaluator<I> | undefined;

    private _metricCollector?: MetricCollector<I, TMetricCollector> | undefined;

    public constructor(parameters: IGeneticParameters<I, TMetricCollector>) {
        super(GeneticParameters.name);

        this._debugLogging = parameters.debugLogging ?? false;

        this._maximumGenerations = parameters.maximumGenerations;
        this._maximumPopulationSize = parameters.maximumPopulationSize;

        this._firstGeneration = parameters.firstGeneration;
        this._individualGenerator = parameters.individualGenerator;

        this._individualMutator = parameters.individualMutator;
        this._fitnessFunction = parameters.fitnessFunction;
        this._populationSelector = parameters.populationSelector;
        this._earlyStopping = parameters.earlyStopping;

        this._metricCollector = parameters.metricCollector;

        this.validateIfConsumerInstantiation(GeneticParameters, arguments);
    }

    public get debugLogging(): boolean {
        return this._debugLogging;
    }

    public set debugLogging(value: boolean) {
        if (typeof value !== "boolean")
            throw new Error(`${GeneticParameters.name}.debugLogging must be a boolean`);
        this._debugLogging = value;
    }

    public get maximumGenerations(): number {
        return this._maximumGenerations;
    }

    public set maximumGenerations(value: number) {
        if (!Number.isInteger(value) || value < 1)
            throw new Error(`${GeneticParameters.name}.maximumGenerations must be a positive integer`);
        this._maximumGenerations = value;
    }

    public get maximumPopulationSize(): number {
        return this._maximumPopulationSize;
    }

    public set maximumPopulationSize(value: number) {
        if (!Number.isInteger(value) || value < 1)
            throw new Error(`${GeneticParameters.name}.maximumPopulationSize must be a positive integer`);
        this._maximumPopulationSize = value;
    }

    public get firstGeneration(): readonly I[] | undefined {
        return this._firstGeneration;
    }

    public set firstGeneration(value: readonly I[] | undefined) {
        if (this._individualGenerator !== undefined && value !== undefined)
            throw new Error(`${GeneticParameters.name}.firstGeneration cannot be set if ${GeneticParameters.name}.individualGenerator is set`);
        if (value !== undefined && !Array.isArray(value))
            throw new Error(`${GeneticParameters.name}.firstGeneration must be an array of individuals`);
        this._firstGeneration = value;
    }

    public get individualGenerator(): IndividualGenerator<I> | undefined {
        return this._individualGenerator;
    }

    public set individualGenerator(value: IndividualGenerator<I> | undefined) {
        if (this._firstGeneration !== undefined && value !== undefined)
            throw new Error(`${GeneticParameters.name}.individualGenerator cannot be set if ${GeneticParameters.name}.firstGeneration is set`);
        if (value !== undefined && !(value instanceof IndividualGenerator))
            throw new Error(`${GeneticParameters.name}.individualGenerator must be an instance of ${IndividualMutator.name}`);
        this._individualGenerator = value;
    }

    public get individualMutator(): IndividualMutator<I, any> {
        return this._individualMutator;
    }

    public set individualMutator(value: IndividualMutator<I, any>) {
        if (!(value instanceof IndividualMutator))
            throw new Error(`${GeneticParameters.name}.individualMutator must be an instance of ${IndividualMutator.name}`);
        this._individualMutator = value;
    }

    public get fitnessFunction(): FitnessFunction<I, any> {
        return this._fitnessFunction;
    }

    public set fitnessFunction(value: FitnessFunction<I, any>) {
        if (!(value instanceof FitnessFunction))
            throw new Error(`${GeneticParameters.name}.fitnessFunction must be an instance of ${FitnessFunction.name}`);
        this._fitnessFunction = value;
    }

    public get populationSelector(): PopulationSelector<I, any> {
        return this._populationSelector;
    }

    public set populationSelector(value: PopulationSelector<I, any>) {
        if (!(value instanceof PopulationSelector))
            throw new Error(`${GeneticParameters.name}.populationSelector must be an instance of ${PopulationSelector.name}`);
        this._populationSelector = value;
    }

    public get earlyStopping(): EarlyStoppingEvaluator<I> | undefined {
        return this._earlyStopping;
    }

    public set earlyStopping(value: EarlyStoppingEvaluator<I> | undefined) {
        if (value !== undefined && !(value instanceof EarlyStoppingEvaluator))
            throw new Error(`${GeneticParameters.name}.earlyStopping must be an instance of ${EarlyStoppingEvaluator.name}`);
        this._earlyStopping = value;
    }

    public get metricCollector(): MetricCollector<I, TMetricCollector> | undefined {
        return this._metricCollector;
    }

    public set metricCollector(value: MetricCollector<I, TMetricCollector> | undefined) {
        if (value !== undefined && !(value instanceof MetricCollector))
            throw new Error(`${GeneticParameters.name}.metricCollector must be an instance of ${MetricCollector.name}`);
        this._metricCollector = value;
    }


    protected get provideChildren(): IGeneticOperatorChildren<I, GeneticOperator<I, any>> {
        return Object.freeze({
            children: Object.freeze(<GeneticOperator<I, any>[]>[
                this._individualMutator,
                this._fitnessFunction,
                this._populationSelector,
                this._individualGenerator,
                this._earlyStopping,
                this._metricCollector,
            ]),
        });
    }
}
