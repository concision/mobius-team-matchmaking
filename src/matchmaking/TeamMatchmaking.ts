import {geneticAlgorithm} from "../genetic/GeneticAlgorithm";
import {assignDefinedProperties, groupBy} from "../utilities/CollectionUtilities";
import {factorial} from "../utilities/MathUtil";
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
import {
    filterTimeSlotsThatAlreadyOccurred,
    partitionTeamsByTimeSlots,
    sortScheduledMatchupsByTime,
    translateTimeSlotToDate
} from "./TimeSlot";

const defaultPartitionKey = Object.freeze({});

export function matchmakeTeams<TTeam extends ITeam = ITeam, TPartitionKey = string>(
    teams: readonly TTeam[],
    options: IUnpartitionedMatchmakingOptions<TTeam, TPartitionKey>,
): Promise<IMatchmakingResults<TTeam>>;

export function matchmakeTeams<TTeam extends ITeam = ITeam, TPartitionKey = string>(
    teams: readonly TTeam[],
    options: IPartitionedMatchmakingOptions<TTeam, TPartitionKey>,
): Promise<IPartitionedMatchmakingResults<TTeam, TPartitionKey>>;

/**
 * Performs the matchmaking algorithm on a set of teams, automatically partitioning them by
 * {@link IMatchmakingOptions.partitionBy} if defined.
 *
 * @param teams An array of teams that are competing in the season's league. These teams will attempt to be paired up
 * by the matchmaking algorithm, referred to as a "matchup".
 * @param options The input options for the matchmaking algorithm; see {@link IMatchmakingOptions}.
 * @template TTeam A derived type of {@link ITeam}; this is useful for consumers to extend the base {@link ITeam} with
 * additional properties that are specific to their domain.
 * @template TPartitionKey The type of the partition key that is used to partition the teams into separate groups; e.g.
 * a string "region".
 */
export async function matchmakeTeams<TTeam extends ITeam = ITeam, TPartitionKey = string>(
    teams: readonly TTeam[],
    options: IMatchmakingOptions<TTeam, TPartitionKey>,
): Promise<IMatchmakingResults<TTeam> | IPartitionedMatchmakingResults<TTeam, TPartitionKey>> {
    const parameters: IConfiguredMatchmakingOptions<TTeam, TPartitionKey> = addDefaultsAndValidateParameters(options);

    // partition all teams by the partitioning function
    const partitioningFunction = parameters.partitionBy === undefined ? (() => <TPartitionKey>defaultPartitionKey)
        : typeof parameters.partitionBy === 'function' ? parameters.partitionBy
            : ((team: TTeam) => team[<keyof KeysOfType<ITeam, TPartitionKey>>parameters.partitionBy]);
    const partitionedTeams: ReadonlyMap<TPartitionKey, readonly TTeam[]> = groupBy<TPartitionKey, TTeam>(teams, partitioningFunction);

    // matchmake each partition of teams
    type PartitionResult = { partitionKey: TPartitionKey; result: IMatchmakingResults<TTeam>; }
    const promises: Promise<PartitionResult>[] = [];
    for (const [partitionKey, partitionTeams] of partitionedTeams.entries()) {
        promises.push((async () => ({
            partitionKey,
            result: await matchmakeTeamPartition<TTeam, TPartitionKey>(partitionTeams, partitionKey, parameters),
        }))());
    }
    const partitionedResults = groupBy(await Promise.all(promises), result => result.partitionKey);

    // combine partitioned results into a single result structure
    const unmatchedTeams = new Map<ITeam, MatchupFailureReason>();
    const results = new Map<TPartitionKey, IMatchmakingResults<TTeam>>();
    for (const [partitionKey, [{result}]] of partitionedResults.entries()) {
        results.set(partitionKey, result);
        for (const [team, reason] of result.unmatchedTeams.entries())
            unmatchedTeams.set(team, reason);
    }
    const searchSpace = Array.from(results.values())
        .filter(({searchSpace}) => 0 < searchSpace)
        .reduce((sum, {searchSpace}) => sum * searchSpace, BigInt(10));
    return {results, unmatchedTeams, searchSpace};
}

// TODO: possibly implement worker multithreading; current async signature is a placeholder
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

    // run the genetic algorithm to compute matchmaking results
    let solution: IMatchupSchedule<TTeam>;
    if (Array.from(teamsByTimeSlot.values()).some(teams => 2 <= teams.length)) { // at least two teams are available
        // prepare genetic algorithm constraints
        const geneticParameters = options.config.configure({options, partitionKey, teamsByTimeSlot});

        // run the genetic algorithm to compute matchmaking results
        const results = geneticAlgorithm(geneticParameters);
        solution = options.config.selectSolution(results);
    } else { // no teams are available
        solution = {matchups: [], unmatchedTeams: new Map()};
    }

    // translate matchups into a format that is more useful for the consumer
    return convertToMatchmakingResults<TTeam>(teams, teamsByTimeSlot, unavailableTeams, solution);
}


function addDefaultsAndValidateParameters<TTeam extends ITeam = ITeam, TPartitionKey = string>(
    optionOverrides: IMatchmakingOptions<TTeam, TPartitionKey>,
): IConfiguredMatchmakingOptions<TTeam, TPartitionKey> {
    const parameters = assignDefinedProperties<IMatchmakingOptions<TTeam, TPartitionKey>>({
        config: undefined!, // validated later
        scheduledDate: new Date(),
        timeSlotToDateTranslator: translateTimeSlotToDate,
        excludeTimeSlotsThatAlreadyOccurred: true,
    }, optionOverrides);

    if (parameters.config === undefined)
        throw new Error("Matchmaking options must have a 'configure' property for the genetic algorithm.");

    return <IConfiguredMatchmakingOptions<TTeam, TPartitionKey>>parameters;
}


function convertToMatchmakingResults<TTeam extends ITeam>(
    teams: readonly TTeam[],
    teamsByTimeSlot: ReadonlyMap<ITimeSlot, readonly TTeam[]>,
    unavailableTeams: ReadonlyMap<TTeam, MatchupFailureReason>,
    solution?: IMatchupSchedule<TTeam>,
): IMatchmakingResults<TTeam> {
    const scheduledMatchups = solution?.matchups
        .map(({timeSlot, teams}) => <IScheduledMatchup<TTeam>>({
            time: timeSlot,
            teams: <[ITeamNotYetPlayed<TTeam>, ITeamNotYetPlayed<TTeam>]>teams.map(team => ({
                team: team,
                snowflake: team.snowflake,
                status: TeamMatchResult.NotYetPlayed,
            })),
            played: false,
        }))
        .toSorted(sortScheduledMatchupsByTime) ?? [];

    const unmatchedTeamReasons = new Map<TTeam, MatchupFailureReason>(unavailableTeams);
    const matchedTeams = new Set<TTeam>(solution?.matchups.flatMap(matchup => matchup.teams) ?? []);
    const unmatchedTeams = Array.from(teams
        .flatMap(teams => teams)
        .filter(team => !matchedTeams.has(team) && !unmatchedTeamReasons.has(team))
        .reduce((uniqueTeams, team) => !uniqueTeams.has(team.snowflake)
                ? uniqueTeams.set(team.snowflake, team)
                : uniqueTeams,
            new Map<string, TTeam>()
        ).values()
    );
    for (const unmatchedTeam of unmatchedTeams)
        unmatchedTeamReasons.set(unmatchedTeam, MatchupFailureReason.NO_IDEAL_MATCHUPS);

    return {
        teams,
        scheduledMatchups,
        unmatchedTeams: unmatchedTeamReasons,
        teamAvailability: teamsByTimeSlot,
        searchSpace: computeSearchSpace(teamsByTimeSlot),
    };
}

function computeSearchSpace<TTeam extends ITeam>(teamsByTimeSlot: ReadonlyMap<ITimeSlot, readonly TTeam[]>): bigint {
    const solutions: bigint = Array.from(teamsByTimeSlot.values())
        .filter(teams => 2 <= teams.length)
        .map(teams => {
            const teamFactorial = factorial(2 * Math.floor(teams.length / 2));
            let sum = BigInt(1);
            for (let t = 1; t <= Math.floor(teams.length / 2); t++)
                // (|totalTeams| multi-choose 2, 2, ...) / |chosenTeamCount|
                sum += teamFactorial / ((BigInt(2) ** BigInt(t)) * factorial(t));
            return sum;
        })
        .reduce((sum, searchSpace) => sum * searchSpace, BigInt(1));
    return solutions == BigInt(1) ? BigInt(0) : solutions;
}
