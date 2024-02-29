import {IndividualFitnessFunction} from "../api/genetic/FitnessFunction";
import {ITeamMatchupsIndividual} from "../api/TeamMatchmaking";
import {ITeam} from "../api/ITeam";

export const MaximizeTotalMatchups = new IndividualFitnessFunction<ITeamMatchupsIndividual>(
    "maximizeTotalMatchups",
    individual => individual.matchups.length
);

export const MinimizeEloDifferential = new IndividualFitnessFunction<ITeamMatchupsIndividual>(
    "minimizeEloDifferential",
    individual => individual.matchups
        .map(matchup => Math.abs(matchup.teams[0].elo - matchup.teams[1].elo))
        .reduce((sum, eloDiff) => sum + eloDiff, 0),
);

export const MaximizeAverageGamesPlayedPerTeam = new IndividualFitnessFunction<ITeamMatchupsIndividual>(
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
                // count the number of matchups the team is scheduled for in addition to the current season's matchups
                matchesPlayed: scheduledMatchups + (team.history?.length ?? 0),
            }));
        const averageMatchupsCount = metrics.reduce((sum, metric) => sum + metric.matchesPlayed, 0) / metrics.length;

        // for each team, count the deviation from the average number of matchups
        return metrics
            .map(metric => Math.abs(metric.matchesPlayed - averageMatchupsCount))
            .reduce((sum, deviation) => sum + deviation, 0);
    },
);

export function MinimizeRecentDuplicateMatchups(date: Date, recentWeeks: number = 2) {
    const sunday = new Date(date);
    sunday.setDate(sunday.getDate() - sunday.getDay()); // TODO: verify this works
    sunday.setHours(0);
    sunday.setMinutes(0);
    sunday.setSeconds(0);
    const sundayXWeeksAgo = new Date(sunday.getTime() - 1000 * 60 * 60 * 24 * 7 * Math.max(0, recentWeeks));

    return new IndividualFitnessFunction<ITeamMatchupsIndividual>(
        "minimizeRecentDuplicateMatchups",
        individual => individual.matchups
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
                            .filter(playedMatchup => sundayXWeeksAgo.getTime() <= playedMatchup.time.date!.getTime()) // TODO
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
