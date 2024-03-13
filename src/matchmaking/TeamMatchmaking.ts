import {geneticAlgorithm} from "../genetic/GeneticAlgorithm";
import {assignDefinedProperties, groupBy} from "../utilities/CollectionUtilities";
import {KeysOfType} from "../utilities/TypescriptTypes";
import {
    IConfiguredMatchmakingOptions,
    IMatchmakingOptions,
    IPartitionedMatchmakingOptions,
    IUnpartitionedMatchmakingOptions
} from "./api/IMatchmakingOptions";
import {IMatchmakingResults, IPartitionedMatchmakingResults, MatchupFailureReason} from "./api/IMatchmakingResults";
import {ITeam} from "./api/ITeam";
import {IScheduledMatchup} from "./api/ITeamMatchup";
import {ITeamNotYetPlayed, TeamMatchResult} from "./api/ITeamParticipant";
import {ITimeSlot} from "./api/ITimeSlot";
import {IMatchupSchedule} from "./api/MatchmakingGeneticTypes";
import {selectBestMatchupSchedule} from "./mobius/operators/MatchupPopulationSelectors";
import {
    filterTimeSlotsThatAlreadyOccurred,
    partitionTeamsByTimeSlots,
    sortScheduledMatchupsByTime,
    translateTimeSlotToDate
} from "./TimeSlot";

const defaultPartitionKey = {};

export function matchmakeTeams<TTeam extends ITeam = ITeam, TPartitionKey = string>(
    teams: readonly TTeam[],
    options: IUnpartitionedMatchmakingOptions<TTeam, TPartitionKey>,
): Promise<IMatchmakingResults<TTeam>>;

export function matchmakeTeams<TTeam extends ITeam = ITeam, TPartitionKey = string>(
    teams: readonly TTeam[],
    options: IPartitionedMatchmakingOptions<TTeam, TPartitionKey>,
): Promise<IPartitionedMatchmakingResults<TTeam, TPartitionKey>>;

// TODO: update documentation
/**
 * Performs the matchmaking algorithm on a set of teams, automatically partitioning them by region. This is a
 * convenience method computing matchups for all regions in the league at once. If a specific region needs to be
 * recomputed due to changes, use {@link matchmakeTeams} directly or invoke this with a subset of the teams.
 *
 * @param teams An array of teams that are competing in the season's league. These teams will attempt to be paired up by the
 * matchmaking algorithm, referred to as a "matchup".
 * @param options The input options for the matchmaking algorithm. See {@link IMatchmakingOptions}.
 * @template TTeam
 * @template TPartitionKey
 * @exception Error If {@link options.maximumGames} is not a positive integer, then an exception will be thrown.
 */
export async function matchmakeTeams<TTeam extends ITeam = ITeam, TPartitionKey = string>(
    teams: readonly TTeam[],
    options: IMatchmakingOptions<TTeam, TPartitionKey>,
): Promise<IMatchmakingResults<TTeam> | IPartitionedMatchmakingResults<TTeam, TPartitionKey>> {
    const parameters: IConfiguredMatchmakingOptions<TTeam, TPartitionKey> = addDefaultsAndValidateParameters(options);

    const partitioningFunction = parameters.partitionBy === undefined ? (() => <TPartitionKey>defaultPartitionKey)
        : typeof parameters.partitionBy === 'function' ? parameters.partitionBy
            : ((team: TTeam) => team[<keyof KeysOfType<ITeam, TPartitionKey>>parameters.partitionBy]);
    const partitionedTeams: ReadonlyMap<TPartitionKey, readonly TTeam[]> = groupBy<TPartitionKey, TTeam>(teams, partitioningFunction);

    type PartitionResult = { partitionKey: TPartitionKey; result: IMatchmakingResults<TTeam>; }
    const promises: Promise<PartitionResult>[] = [];
    for (const [partitionKey, partitionTeams] of partitionedTeams.entries()) {
        promises.push((async () => ({
            partitionKey,
            result: await matchmakeTeamPartition<TTeam, TPartitionKey>(partitionTeams, partitionKey, parameters),
        }))());
    }
    const partitionedResults = groupBy(await Promise.all(promises), result => result.partitionKey);

    const unmatchedTeams = new Map<ITeam, MatchupFailureReason>();
    const results = new Map<TPartitionKey, IMatchmakingResults<TTeam>>();
    for (const [partitionKey, [{result}]] of partitionedResults.entries()) {
        results.set(partitionKey, result);
        for (const [team, reason] of result.unmatchedTeams.entries())
            unmatchedTeams.set(team, reason);
    }
    return {results: results, unmatchedTeams};
}

// TODO: implement worker multithreading; current async signature is a placeholder
async function matchmakeTeamPartition<TTeam extends ITeam = ITeam, TPartitionKey = string>(
    teams: readonly TTeam[],
    partitionKey: TPartitionKey,
    options: IConfiguredMatchmakingOptions<TTeam, TPartitionKey>,
): Promise<IMatchmakingResults<TTeam>> {
    // partition teams by availability
    let teamsPartitionedByTimeSlot = partitionTeamsByTimeSlots(
        options.scheduledDate, options.timeSlotToDateTranslator,
        teams
    );
    if (options.excludeTimeSlotsThatAlreadyOccurred)
        teamsPartitionedByTimeSlot = filterTimeSlotsThatAlreadyOccurred(teamsPartitionedByTimeSlot);
    const {teamsByTimeSlot, unavailableTeams} = teamsPartitionedByTimeSlot;

    // if all teams are unavailable, no matchups can be scheduled
    if (unavailableTeams.size === teams.length)
        return Promise.resolve<IMatchmakingResults<TTeam>>({
            teams,
            scheduledMatchups: [],
            unmatchedTeams: unavailableTeams,
            teamAvailability: teamsByTimeSlot,
        });

    // prepare genetic algorithm constraints
    const geneticParameters = options.configure.configure({options, partitionKey, teamsByTimeSlot});

    // run the genetic algorithm to compute matchmaking results
    const solutions = geneticAlgorithm<IMatchupSchedule<TTeam>>(geneticParameters);
    const solution = selectBestMatchupSchedule<TTeam>(solutions.map(({solution}) => solution));

    // translate matchups into a format that is more useful for the consumer
    return convertToMatchmakingResults<TTeam>(teams, teamsByTimeSlot, unavailableTeams, solution);
}


function addDefaultsAndValidateParameters<TTeam extends ITeam = ITeam, TPartitionKey = string>(
    optionOverrides: IMatchmakingOptions<TTeam, TPartitionKey>,
): IConfiguredMatchmakingOptions<TTeam, TPartitionKey> {
    const parameters = assignDefinedProperties<IMatchmakingOptions<TTeam, TPartitionKey>>({
        configure: undefined!, // validated later
        scheduledDate: new Date(),
        timeSlotToDateTranslator: translateTimeSlotToDate,
        excludeTimeSlotsThatAlreadyOccurred: true,
    }, optionOverrides);

    if (parameters.configure === undefined)
        throw new Error("Matchmaking options must have a 'configure' property for the genetic algorithm.");

    return <IConfiguredMatchmakingOptions<TTeam, TPartitionKey>>parameters;
}


function convertToMatchmakingResults<TTeam extends ITeam>(
    teams: readonly TTeam[],
    teamsByTimeSlot: ReadonlyMap<ITimeSlot, readonly TTeam[]>,
    unavailableTeams: ReadonlyMap<TTeam, MatchupFailureReason>,
    solution: IMatchupSchedule<TTeam>,
): IMatchmakingResults<TTeam> {
    const scheduledMatchups = solution.matchups
        .map(({timeSlot, teams}) => <IScheduledMatchup<TTeam>>({
            time: timeSlot,
            teams: <[ITeamNotYetPlayed<TTeam>, ITeamNotYetPlayed<TTeam>]>teams.map(team => ({
                team: team,
                snowflake: team.snowflake,
                status: TeamMatchResult.NotYetPlayed,
            })),
            played: false,
        }))
        .toSorted(sortScheduledMatchupsByTime);

    const unmatchedTeamReasons = new Map<TTeam, MatchupFailureReason>(unavailableTeams);
    const matchedTeams = new Set<TTeam>(solution.matchups.flatMap(matchup => matchup.teams));
    const unmatchedTeams = Array.from(teams
        .flatMap(teams => teams)
        .filter(team => !matchedTeams.has(team) && !unmatchedTeamReasons.has(team))
        .reduce((uniqueTeams, team) => !uniqueTeams.has(team.snowflake) ? uniqueTeams.set(team.snowflake, team) : uniqueTeams, new Map<string, TTeam>())
        .values()
    );
    for (const unmatchedTeam of unmatchedTeams)
        unmatchedTeamReasons.set(unmatchedTeam, MatchupFailureReason.NO_IDEAL_MATCHUPS);

    return {
        teams,
        scheduledMatchups,
        unmatchedTeams: unmatchedTeamReasons,
        teamAvailability: teamsByTimeSlot,
    };
}
