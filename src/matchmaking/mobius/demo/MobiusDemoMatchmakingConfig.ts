import {IMobiusMatchmakingOptions, IMobiusTeam, MobiusMatchmakingConfig} from "../MobiusMatchmakingConfig";
import {IMatchmakingParameters} from "../../api/IMatchmakingOptions";
import {IMatchupSchedule} from "../../api/MatchmakingGeneticTypes";
import {IMutableGeneticParameters} from "../../../genetic/api/IGeneticParameters";

// This is an example of extending an existing matchmaking configuration to tweak parameters

export class MobiusDemoMatchmakingConfig extends MobiusMatchmakingConfig {
    public constructor(parameters: IMobiusMatchmakingOptions) {
        super(parameters);
    }

    public configure(parameters: IMatchmakingParameters<IMobiusTeam, string>): IMutableGeneticParameters<IMatchupSchedule<IMobiusTeam>> {
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
    hardEloDifferentialLimit: 250,

    preventDuplicateMatchupsInLastXDays: 14,
    countGamesPlayedInLastXDays: 21,
    permittedBackToBackRecency: 1,
});
