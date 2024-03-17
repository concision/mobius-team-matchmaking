import {IWeightedFitnessFunction} from "../../../genetic/api/FitnessFunction";
import {GeneticParameters} from "../../../genetic/api/GeneticParameters";
import {HallOfFameResult} from "../../../genetic/api/MetricCollector";
import {IMatchmakingParameters} from "../../api/IMatchmakingOptions";
import {IMatchupSchedule} from "../../api/MatchmakingGeneticTypes";
import {IMobiusMatchmakingOptions, IMobiusTeam, MobiusMatchmakingConfig} from "../MobiusMatchmakingConfig";
import {CountDecentDuplicateMatchupsFitnessFunction, CountTotalMatchupsFitnessFunction} from "../operators/MatchupFitnessFunctions";
import {HardEloDifferentialLimitKillPredicate} from "../operators/MatchupPopulationSelectors";

// This is an example of extending an existing matchmaking configuration to tweak parameters

export class MobiusDemoMatchmakingConfig extends MobiusMatchmakingConfig {
    public constructor(parameters?: IMobiusMatchmakingOptions) {
        super(parameters);
    }

    public configure(
        parameters: IMatchmakingParameters<IMobiusTeam>
    ): GeneticParameters<IMatchupSchedule<IMobiusTeam>, HallOfFameResult<IMatchupSchedule<IMobiusTeam>>> {
        const options = super.configure(parameters);

        options.debugLogging = false;

        options.maximumGenerations = 1000;
        options.maximumPopulationSize = 100;

        // example of tweaking configuration for optimizing maximum matches (permitting duplicates)
        const maximizeMatches: boolean = false; // e.g., toggle this to 'true'
        if (maximizeMatches) {
            // increase weighting for maximizing total matches
            options.findByOperatorType<IWeightedFitnessFunction<IMatchupSchedule<IMobiusTeam>>>(CountTotalMatchupsFitnessFunction)!
                .child.weight = 1000;
            // remove the fitness function that penalizes duplicate matchups
            options.findByOperatorType(CountDecentDuplicateMatchupsFitnessFunction)!.remove();
            options.findByOperatorType(HardEloDifferentialLimitKillPredicate)!.remove();
        }

        return options;
    }
}

export const mobiusDemoMatchmakingConfig = new MobiusDemoMatchmakingConfig({
    hallOfFame: 32,

    maximumGamesPerTeam: 3,
    hardEloDifferentialLimit: 200,

    preventDuplicateMatchupsInLastXDays: 14,
    countGamesPlayedInLastXDays: 21,
    minimumPermittedBackToBackRecency: 1,
});
