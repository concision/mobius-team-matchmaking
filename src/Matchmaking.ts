import {IMatchmakingOptions, ITeamMatchups, type matchmakeTeamsByRegion, type matchmakeTeamsInRegion} from "./api/Matchmaking";

const matchmakeTeamsInRegion: matchmakeTeamsInRegion = ({teams, maximumGames, week}: IMatchmakingOptions): ITeamMatchups => {
    if (0 < teams.length && teams.some((team) => team.region !== teams[0].region))
        throw new Error("All teams must be in the same region, encountered unique regions: " +
            `[${[...new Set(teams.map((team) => team.region))].join(", ")}]`);
    if (!maximumGames || maximumGames < 1)
        throw new Error("The maximum number of games must be at least 1.");
    week ??= new Date();

    console.log(`${teams.length} teams`);

    return {matchups: [], unmatched: [...teams]};
}

const matchmakeTeamsByRegion: matchmakeTeamsByRegion = ({teams, maximumGames, week}: IMatchmakingOptions): ITeamMatchups => {
    if (!maximumGames || maximumGames < 1)
        throw new Error("The maximum number of games must be at least 1.");
    week ??= new Date();

    console.log(`${teams.length} teams`);

    return {matchups: [], unmatched: [...teams]};
}

export {matchmakeTeamsInRegion, matchmakeTeamsByRegion};
