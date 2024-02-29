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
        // TODO: determine better aggregation function
        .reduce((sum, eloDiff) => sum + eloDiff, 0)
);

export const MaximizeAverageGamesPlayedPerTeam = new IndividualFitnessFunction<ITeamMatchupsIndividual>(
    "maximizeAverageGamesPlayedPerTeam",
    individual => {
        type TeamType = { team: ITeam; joinTime: Date; matchesPlayed: number; };
        const x: TeamType[] = [];
        // teams.map(team => {
        //     x.push({
        //         team,
        //         joinTime: new Date(), // TODO: get join time
        //         matchesPlayed: individual.matchups.filter(matchup => matchup.teams.includes(team)).length,
        //     });
        // });

        return 0;
    }
);

export function MinimizeRecentDuplicateMatchups(date: Date, recentWeeks: number = 2) {
    const sunday = new Date(date);
    sunday.setDate(sunday.getDate() - sunday.getDay());
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
                                .sort()
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
