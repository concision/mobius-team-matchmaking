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

export class BackToBackMatchupKillPredicate<TTeam extends ITeam> extends KillPredicate<IMatchupSchedule<TTeam>> {
    private _ordinalRecency: number;

    public constructor(ordinalRecency: number);
    public constructor(name: string, ordinalRecency: number);
    public constructor(name: string | number, ordinalRecency?: number) {
        super(2 <= arguments.length ? <string>name : BackToBackMatchupKillPredicate.name);
        this._ordinalRecency = <number>(arguments.length === 1 ? name : ordinalRecency);
    }

    public get ordinalRecency(): number {
        return this._ordinalRecency;
    }

    public set ordinalRecency(value: number) {
        if (value < 0)
            throw new Error(`${BackToBackMatchupKillPredicate.name}.ordinalRecency must be a non-negative integer`);
        this._ordinalRecency = value;
    }

    public shouldKill({solution}: IFitness<IMatchupSchedule<TTeam>>): boolean {
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
                if (timeSlots[i].day === timeSlots[i + 1].day && Math.abs(timeSlots[i + 1].ordinal - timeSlots[i].ordinal) <= this._ordinalRecency)
                    return true;
            }
        }

        return false;
    }
}

export class MaximumGamesPerTeamKillPredicate<TTeam extends ITeam> extends KillPredicate<IMatchupSchedule<TTeam>> {
    private _maximumGames: number;

    public constructor(maximumGames: number);
    public constructor(name: string, maximumGames: number);
    public constructor(name: string | number, maximumGames?: number) {
        super(2 <= arguments.length ? <string>name : MaximumGamesPerTeamKillPredicate.name);
        this._maximumGames = <number>(arguments.length === 1 ? name : maximumGames);
    }

    public get maximumGames(): number {
        return this._maximumGames;
    }

    public set maximumGames(value: number) {
        if (value < 0)
            throw new Error(`${MaximumGamesPerTeamKillPredicate.name}.maximumGames must be a non-negative integer`);
        this._maximumGames = value;
    }

    public shouldKill({solution}: IFitness<IMatchupSchedule<TTeam>>): boolean {
        const scheduledMatchupsPerTeam: Map<TTeam, number> = solution.matchups
            .flatMap(matchup => matchup.teams)
            .reduce((map, team) => map.set(team, (map.get(team) ?? 0) + 1), new Map<TTeam, number>());

        for (const scheduledMatchups of scheduledMatchupsPerTeam.values())
            if (this._maximumGames < scheduledMatchups)
                return true;

        return false;
    }
}

export class HardEloDifferentialLimitKillPredicate<TTeam extends ITeam> extends KillPredicate<IMatchupSchedule<TTeam>> {
    private _hardEloDifferentialLimit: number;

    public constructor(hardEloDifferentialLimit: number);
    public constructor(name: string, hardEloDifferentialLimit: number);
    public constructor(name: string | number, hardEloDifferentialLimit?: number) {
        super(2 <= arguments.length ? <string>name : HardEloDifferentialLimitKillPredicate.name);
        this._hardEloDifferentialLimit = <number>(arguments.length === 1 ? name : hardEloDifferentialLimit);
    }

    public get hardEloDifferentialLimit(): number {
        return this._hardEloDifferentialLimit;
    }

    public set hardEloDifferentialLimit(value: number) {
        if (value < 0)
            throw new Error(`${HardEloDifferentialLimitKillPredicate.name}.hardEloDifferentialLimit must be a non-negative number`);
        this._hardEloDifferentialLimit = value;
    }

    public shouldKill({solution}: IFitness<IMatchupSchedule<TTeam>>): boolean {
        for (const matchup of solution.matchups) {
            if (this._hardEloDifferentialLimit < Math.abs(matchup.teams[0].elo - matchup.teams[1].elo))
                return true;
        }
        return false;
    }
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
