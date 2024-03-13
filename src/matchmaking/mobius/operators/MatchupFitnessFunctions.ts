import {IndividualFitnessFunction} from "../../../genetic/api/FitnessFunction";
import {ITeam} from "../../api/ITeam";
import {IMatchupSchedule} from "../../api/MatchmakingGeneticTypes";
import {IMobiusTeam} from "../MobiusMatchmakingConfig";

export function countTotalMatchups<TTeam extends IMobiusTeam = IMobiusTeam>(): IndividualFitnessFunction<IMatchupSchedule<TTeam>> {
    return new IndividualFitnessFunction<IMatchupSchedule<TTeam>>(
        "minimizeUnmatchedTeams",
        ({matchups}) => matchups.length,
    );
}

export function eloDifferentialStandardDeviation<TTeam extends IMobiusTeam = IMobiusTeam>(): IndividualFitnessFunction<IMatchupSchedule<TTeam>> {
    return new IndividualFitnessFunction<IMatchupSchedule<TTeam>>("minimizeEloDifferential",
        ({matchups}) => {
            const eloDifferentials = matchups.map(({teams: [a, b]}) => Math.abs(a.elo - b.elo));
            const averageEloDifferentials = eloDifferentials.reduce((sum, eloDiff) => sum + eloDiff, 0) / matchups.length;
            return Math.sqrt(
                eloDifferentials
                    .map(eloDiff => Math.pow(Math.abs(eloDiff - averageEloDifferentials), 2))
                    .reduce((sum, deviation) => sum + deviation, 0)
                / Math.max(1, eloDifferentials.length)
            );
        },
    );
}

export function averageGamesPlayedPerTeamVariance<TTeam extends IMobiusTeam = IMobiusTeam>(date: Date, recentDays: number): IndividualFitnessFunction<IMatchupSchedule<TTeam>> {
    const xDaysAgo = new Date(date);
    xDaysAgo.setDate(xDaysAgo.getDate() - recentDays);

    return new IndividualFitnessFunction<IMatchupSchedule<TTeam>>(
        "maximizeAverageGamesPlayedPerTeam",
        ({matchups, unmatchedTeams}) => {
            const scheduledMatchupsPerTeam: Map<ITeam, number> = Array.from(matchups.values())
                .flatMap(matchup => matchup.teams)
                .reduce((map, team) => map.set(team, (map.get(team) ?? 0) + 1), new Map<ITeam, number>());
            Array.from(unmatchedTeams.values())
                .flatMap(teams => teams)
                .filter(team => !scheduledMatchupsPerTeam.has(team))
                .forEach(team => scheduledMatchupsPerTeam.set(team, 0));

            type TeamMetrics = { team: ITeam; joinTime: Date; matchesPlayed: number; };
            const metrics: TeamMetrics[] = Array.from(scheduledMatchupsPerTeam.entries())
                .map(([team, scheduledMatchups]) => ({
                    team,
                    // convert the team's snowflake to a join timestamp with Discord's epoch
                    joinTime: new Date(Number(BigInt(team.snowflake) >> 22n) + 1420070400000),
                    // count the number of matchups the team is scheduled for
                    // in addition, count the current season's matchups in the last X days
                    matchesPlayed: scheduledMatchups + (team.history
                        ?.filter(playedMatchup => xDaysAgo.getTime() <= (playedMatchup.time.date?.getTime() ?? 0))
                        .length ?? 0),
                }));

            // compute variance of the number of matchups played by each team
            const averageMatchupsCount = metrics.reduce((sum, metric) => sum + metric.matchesPlayed, 0)
                / Math.max(1, metrics.length);
            return metrics
                .map(metric => Math.pow(Math.abs(metric.matchesPlayed - averageMatchupsCount), 2))
                .reduce((sum, deviation) => sum + deviation, 0) / Math.max(1, metrics.length);
        },
    );
}

export function countRecentDuplicateMatchups<TTeam extends IMobiusTeam = IMobiusTeam>(date: Date, recentDays: number): IndividualFitnessFunction<IMatchupSchedule<TTeam>> {
    const xDaysAgo = new Date(date);
    xDaysAgo.setDate(xDaysAgo.getDate() - recentDays);

    return new IndividualFitnessFunction<IMatchupSchedule<TTeam>>(
        "minimizeRecentDuplicateMatchups",
        ({matchups}) => {
            let duplicateMatchups = 0;

            const matchupCounts = matchups.reduce((map, matchup) => {
                const key = matchup.teams.map(team => team.snowflake).sort().join(",");
                map.set(key, (map.get(key) ?? 0) + 1);
                return map;
            }, new Map<string, number>());
            duplicateMatchups += Array.from(matchupCounts.values()).reduce((sum, count) => sum + count - 1, 0);

            // count historical matchups that have occurred in the last recentDays days
            for (const {teams} of matchups) {
                let teamDuplicateMatchups = 0;

                const matchupTeamIds = teams.map(team => team.snowflake).sort();
                for (const team of teams.filter(team => "history" in team && Array.isArray(team.history))) {
                    teamDuplicateMatchups = Math.max(
                        teamDuplicateMatchups,
                        team.history!
                            .filter(playedMatchup => xDaysAgo.getTime() <= playedMatchup.time.date!.getTime())
                            // only historical matches that have the same teams as a new matchup
                            .filter(playedMatchup => playedMatchup.teams.map(playedTeam => playedTeam.snowflake)
                                // compare ids to this matchup's team ids
                                .toSorted().every((snowflake, index) => snowflake === matchupTeamIds[index])
                            )
                            .length
                    );
                }
                duplicateMatchups += teamDuplicateMatchups;
            }

            return duplicateMatchups;
        }
    );
}
