import {
    IDefaultMatchmakingParameters,
    IMatchmakingOptions,
    IMatchmakingResults,
    IMatchupSchedule,
    type matchmakeTeams as matchmakeTeamsApi,
    type matchmakeTeamsByRegion as matchmakeTeamsByRegionApi,
    MatchupFailureReason
} from "./api/TeamMatchmaking";
import {ITeam} from "./api/ITeam";
import {IScheduledMatchup} from "./api/ITeamMatchup";
import {ITeamNotYetPlayed, TeamMatchResult} from "./api/ITeamParticipant";
import {geneticAlgorithm} from "../genetic/GeneticAlgorithm";
import {IGeneticOptions} from "../genetic/api/GeneticAlgorithm";
import {
    filterTimeSlotsThatAlreadyOccurred,
    partitionTeamsByTimeSlots,
    sortScheduledMatchupsByTime,
    translateTimeSlotToDate
} from "./TimeSlot";
import {selectBestMatchupSchedule} from "./operators/MatchupPopulationSelectors";
import {defaultConstraints} from "./GeneticConstraints";

export {matchmakeTeams, matchmakeTeamsByRegion};

const matchmakeTeamsByRegion: typeof matchmakeTeamsByRegionApi = (
    {teams, defaultParameters, ...options}: IMatchmakingOptions
): IMatchmakingResults => {
    const parameters = validateAndCreateParameters(defaultParameters);

    const teamsByRegion: ReadonlyMap<string, ITeam[]> = teams.reduce((map, team) => {
        if (map.has(team.region)) {
            map.get(team.region)!.push(team);
        } else {
            map.set(team.region, [team]);
        }
        return map;
    }, new Map<string, ITeam[]>());

    let matchups: IScheduledMatchup[] = [];
    let unmatchedTeams: Map<ITeam, MatchupFailureReason> = new Map<ITeam, MatchupFailureReason>();
    for (const regionTeams of teamsByRegion.values()) {
        const regionalMatchups = matchmakeTeams({
            ...options,
            teams: regionTeams,
            defaultParameters: parameters,
        });

        matchups = matchups.concat(regionalMatchups.scheduledMatchups);
        for (const [team, reason] of regionalMatchups.unmatchedTeams.entries())
            unmatchedTeams.set(team, reason);
    }
    return {
        scheduledMatchups: matchups.sort(sortScheduledMatchupsByTime),
        unmatchedTeams,
    };
}


const matchmakeTeams: typeof matchmakeTeamsApi = (
    {teams, defaultParameters, ...options}: IMatchmakingOptions
): IMatchmakingResults => {
    if (0 < teams.length && teams.some(team => team.region !== teams[0].region))
        throw new Error("All teams must be in the same region, encountered unique regions: "
            + `[${[...new Set(teams.map(team => team.region))].join(", ")}]; `);

    const parameters = validateAndCreateParameters(defaultParameters);

    // partition teams by availability
    let teamsPartitionedByTimeSlot = partitionTeamsByTimeSlots(
        parameters.scheduledDate, parameters.timeSlotToDateTranslator,
        teams
    );
    if (parameters.excludeTimeSlotsThatAlreadyOccurred)
        teamsPartitionedByTimeSlot = filterTimeSlotsThatAlreadyOccurred(teamsPartitionedByTimeSlot);
    const {teamsByTimeSlot, unavailableTeams} = teamsPartitionedByTimeSlot;

    // if all teams are unavailable, no matchups can be scheduled
    if (unavailableTeams.size === teams.length)
        return {scheduledMatchups: [], unmatchedTeams: unavailableTeams};

    // prepare genetic algorithm constraints
    let constraints: IGeneticOptions<IMatchupSchedule> = defaultConstraints(parameters, teamsByTimeSlot);
    if (typeof options.configure === 'function')
        constraints = options.configure(constraints) ?? constraints;

    // run the genetic algorithm to compute matchmaking results
    const solutions = geneticAlgorithm<IMatchupSchedule>(constraints, parameters.hallOfFame);
    const solution = selectBestMatchupSchedule(solutions.map(({solution}) => solution));

    // translate matchups into a format that is more useful for the consumer
    return convertToMatchmakingResults(teams, unavailableTeams, solution);
}


function validateAndCreateParameters(parameterOverrides?: IDefaultMatchmakingParameters): Required<IDefaultMatchmakingParameters> {
    const defaultParameters: Required<IDefaultMatchmakingParameters> = {
        scheduledDate: new Date(),
        timeSlotToDateTranslator: translateTimeSlotToDate,
        excludeTimeSlotsThatAlreadyOccurred: true,

        hallOfFame: 32,

        maximumGamesPerTeam: 3,
        hardEloDifferentialLimit: 300,

        preventDuplicateMatchupsInLastXDays: 14,
        countGamesPlayedInLastXDays: 21,
    };
    const defineParameterOverrides: Partial<IDefaultMatchmakingParameters> = Object.fromEntries(
        Object.entries(parameterOverrides ?? {})
            .filter(([, value]) => value !== undefined)
    );
    const parameters: typeof defaultParameters = Object.assign(defaultParameters, defineParameterOverrides);

    if (parameters.scheduledDate === undefined)
        throw new Error("The scheduling date must be defined.");
    if (typeof parameters.timeSlotToDateTranslator !== "function")
        throw new Error("The time slot to date translator must be a function.");

    if (parameters.maximumGamesPerTeam < 1)
        throw new Error("The maximum number of games must be at least 1.");
    if (parameters.hardEloDifferentialLimit < 1)
        throw new Error("The hard elo differential limit must be at least 1 (however recommended to be much higher).");

    if (parameters.preventDuplicateMatchupsInLastXDays < 0)
        throw new Error("The duplicate matchup day recency must be greater than 0 to be enabled, or 0 to be disabled.");
    if (parameters.countGamesPlayedInLastXDays < 0)
        throw new Error("The games played day recency must be greater than 0 to be enabled, or 0 to be disabled.");

    return parameters;
}


function convertToMatchmakingResults(
    teams: readonly ITeam[],
    unavailableTeams: ReadonlyMap<ITeam, MatchupFailureReason>,
    solution: IMatchupSchedule,
): IMatchmakingResults {
    const scheduledMatchups = solution.matchups
        .map(({timeSlot, teams}) => <IScheduledMatchup>({
            time: timeSlot,
            teams: <[ITeamNotYetPlayed, ITeamNotYetPlayed]>teams.map(team => ({
                team: team,
                snowflake: team.snowflake,
                status: TeamMatchResult.NotYetPlayed,
            })),
            played: false,
        }))
        .toSorted(sortScheduledMatchupsByTime);

    const unmatchedTeamReasons = new Map<ITeam, MatchupFailureReason>(unavailableTeams);
    const matchedTeams = new Set<ITeam>(solution.matchups.flatMap(matchup => matchup.teams));
    const unmatchedTeams = Array.from(teams
        .flatMap(teams => teams)
        .filter(team => !matchedTeams.has(team) && !unmatchedTeamReasons.has(team))
        .reduce((uniqueTeams, team) => !uniqueTeams.has(team.snowflake) ? uniqueTeams.set(team.snowflake, team) : uniqueTeams, new Map<string, ITeam>())
        .values()
    );
    for (const unmatchedTeam of unmatchedTeams)
        unmatchedTeamReasons.set(unmatchedTeam, MatchupFailureReason.NO_IDEAL_MATCHUPS);

    return {scheduledMatchups, unmatchedTeams: unmatchedTeamReasons};
}
