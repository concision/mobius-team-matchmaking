import {IndividualFitnessFunction} from "../../api/genetic/FitnessFunction";
import {ITeamMatchupsIndividual} from "../../api/TeamMatchmaking";
import {ITeam} from "../../api/ITeam";

export const maximizeTotalMatchups = new IndividualFitnessFunction<ITeamMatchupsIndividual>(
    "maximizeTotalMatchups",
    individual => individual.matchups.length,
);

export const minimizeEloDifferential = new IndividualFitnessFunction<ITeamMatchupsIndividual>(
    "minimizeEloDifferential",
    individual => individual.matchups
        .map(matchup => Math.abs(matchup.teams[0].elo - matchup.teams[1].elo))
        .reduce((sum, eloDiff) => sum + eloDiff, 0),
);

export function maximizeAverageGamesPlayedPerTeam(date: Date, recentDays: number): IndividualFitnessFunction<ITeamMatchupsIndividual> {
    const xDaysAgo = new Date(date);
    xDaysAgo.setDate(xDaysAgo.getDate() - recentDays);

    return new IndividualFitnessFunction<ITeamMatchupsIndividual>(
        "maximizeAverageGamesPlayedPerTeam",
        individual => {
            const scheduledMatchupsPerTeam: Map<ITeam, number> = Array.from(individual.matchups.values())
                .flatMap(matchup => matchup.teams)
                .reduce((map, team) => map.set(team, (map.get(team) ?? 0) + 1), new Map<ITeam, number>());
            for (const matchup of individual.unmatchedTeams.values())
                for (const team of matchup)
                    scheduledMatchupsPerTeam.set(team, 0);

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
            const averageMatchupsCount = metrics.reduce((sum, metric) => sum + metric.matchesPlayed, 0) / metrics.length;

            // compute variance of the number of matchups played by each team
            return -metrics
                .map(metric => Math.pow(Math.abs(metric.matchesPlayed - averageMatchupsCount), 2))
                .reduce((sum, deviation) => sum + deviation, 0) / metrics.length;
        },
    );
}

export function minimizeRecentDuplicateMatchups(date: Date, recentDays: number): IndividualFitnessFunction<ITeamMatchupsIndividual> {
    const xDaysAgo = new Date(date);
    xDaysAgo.setDate(xDaysAgo.getDate() - recentDays);

    return new IndividualFitnessFunction<ITeamMatchupsIndividual>(
        "minimizeRecentDuplicateMatchups",
        individual => -individual.matchups
            .map(matchup => {
                const matchupTeamIds = matchup.teams.map(team => team.snowflake).sort();

                let duplicateMatchups = 0;
                for (const team of matchup.teams) {
                    if (!("history" in team && Array.isArray(team.history)))
                        continue;
                    duplicateMatchups = Math.max(
                        duplicateMatchups,
                        team.history
                            // only games that have occurred in the last options.duplicateMatchupRecencyInWeeks weeks
                            .filter(playedMatchup => xDaysAgo.getTime() <= playedMatchup.time.date!.getTime()) // TODO
                            // only historical matches that have the same teams as a new matchup
                            .filter(playedMatchup => playedMatchup.teams
                                .map(playedTeam => playedTeam.snowflake)
                                .toSorted()
                                .every((snowflake, index) => snowflake === matchupTeamIds[index])
                            )
                            .length
                    );
                }
                return duplicateMatchups;
            })
            .reduce((sum, duplicateMatchups) => sum + duplicateMatchups, 0)
    );
}
