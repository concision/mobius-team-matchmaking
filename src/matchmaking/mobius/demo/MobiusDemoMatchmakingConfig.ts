import {GeneticParameters} from "../../../genetic/api/GeneticParameters";
import {IMatchmakingParameters} from "../../api/IMatchmakingOptions";
import {IMatchupSchedule} from "../../api/MatchmakingGeneticTypes";
import {IMobiusMatchmakingOptions, IMobiusTeam, MobiusMatchmakingConfig} from "../MobiusMatchmakingConfig";

// This is an example of extending an existing matchmaking configuration to tweak parameters

export class MobiusDemoMatchmakingConfig extends MobiusMatchmakingConfig {
    public constructor(parameters?: IMobiusMatchmakingOptions) {
        super(parameters);
    }

    public configure(parameters: IMatchmakingParameters<IMobiusTeam>): GeneticParameters<IMatchupSchedule<IMobiusTeam>> {
        const options = super.configure(parameters);

        options.debugLogging = false;

        options.maximumGenerations = 1000;
        options.maximumPopulationSize = 2500;

        return options;
    }
}

export const mobiusDemoMatchmakingConfig = new MobiusDemoMatchmakingConfig({
    hallOfFame: 32,

    maximumGamesPerTeam: 3,
    hardEloDifferentialLimit: 100,

    preventDuplicateMatchupsInLastXDays: 14,
    countGamesPlayedInLastXDays: 21,
    permittedBackToBackRecency: 1,
});
