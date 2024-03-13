import {IFitness} from "../../../genetic/api/FitnessFunction";
import {IndividualIdentityFunction} from "../../../genetic/api/IndividualIdentityFunction";
import {KillPredicate} from "../../../genetic/api/PopulationSelector";
import {ITeam} from "../../api/ITeam";
import {ITimeSlot} from "../../api/ITimeSlot";
import {IMatchupSchedule} from "../../api/MatchmakingGeneticTypes";

export function uniqueTeamMatchupIdentity<TTeam extends ITeam>(): IndividualIdentityFunction<IMatchupSchedule<TTeam>> {
    return (individual: IMatchupSchedule<TTeam>): string => {
        return JSON.stringify(individual.matchups
            .map(matchup => matchup.teams.map(team => team.snowflake).sort().join(","))
            .sort())
    };
}

export function backToBackMatchupKillPredicate<TTeam extends ITeam>(ordinalRecency: number = 1): KillPredicate<IMatchupSchedule<TTeam>> {
    return ({solution}: IFitness<IMatchupSchedule<TTeam>>): boolean => {
        const teamTimeSlots = new Map<TTeam, ITimeSlot[]>();
        for (const matchup of solution.matchups) {
            for (const team of matchup.teams) {
                const timeSlots = teamTimeSlots.get(team) ?? [];
                timeSlots.push(matchup.timeSlot);
                teamTimeSlots.set(team, timeSlots);
            }
        }

        for (const timeSlots of teamTimeSlots.values())
            timeSlots.sort((a, b) => {
                const compare = a.day.localeCompare(b.day);
                return compare === 0 ? a.ordinal - b.ordinal : compare;
            });

        for (const timeSlots of teamTimeSlots.values()) {
            for (let i = 0; i < timeSlots.length - 1; i++) {
                if (timeSlots[i].day === timeSlots[i + 1].day && Math.abs(timeSlots[i + 1].ordinal - timeSlots[i].ordinal) <= ordinalRecency)
                    return true;
            }
        }

        return false;
    };
}

export function maximumGamesPerTeamKillPredicate<TTeam extends ITeam>(maximumGames: number): KillPredicate<IMatchupSchedule<TTeam>> {
    return ({solution}: IFitness<IMatchupSchedule<TTeam>>): boolean => {
        const scheduledMatchupsPerTeam: Map<TTeam, number> = solution.matchups
            .flatMap(matchup => matchup.teams)
            .reduce((map, team) => map.set(team, (map.get(team) ?? 0) + 1), new Map<TTeam, number>());

        for (const scheduledMatchups of scheduledMatchupsPerTeam.values())
            if (maximumGames < scheduledMatchups)
                return true;

        return false;
    };
}

export function hardEloDifferentialLimitKillPredicate<TTeam extends ITeam>(hardEloDifferentialLimit: number): KillPredicate<IMatchupSchedule<TTeam>> {
    return ({solution: {matchups}}: IFitness<IMatchupSchedule<TTeam>>): boolean => {
        for (const matchup of matchups) {
            if (hardEloDifferentialLimit < Math.abs(matchup.teams[0].elo - matchup.teams[1].elo))
                return true;
        }
        return false;
    };
}


export function selectBestMatchupSchedule<TTeam extends ITeam>(solutions: readonly IMatchupSchedule<TTeam>[]): IMatchupSchedule<TTeam> {
    const solutionsRankedByMinimalUnmatchedTeams = solutions
        .map(solution => {
            const matchmadeTeams = new Set(solution.matchups.flatMap(matchup => matchup.teams));
            const unmatchedTeamCount = new Set(Array.from(solution.unmatchedTeams.values())
                .flatMap(teams => teams)
                .filter(team => !matchmadeTeams.has(team))
            ).size;
            return {solution, unmatchedTeamCount};
        });
    // select solution that has the fewest unmatched teams
    return solutionsRankedByMinimalUnmatchedTeams
        .reduce((minimalUnmatched, current) =>
            minimalUnmatched === undefined || current.unmatchedTeamCount < minimalUnmatched.unmatchedTeamCount ? current : minimalUnmatched
        ).solution;
}
