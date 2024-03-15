import {blueBright, bold, cyan, gray, greenBright, magentaBright, red, redBright, yellow, yellowBright} from "ansi-colors";
import {promises as fs} from "fs";
import {
    groupBy,
    GroupingBehavior,
    IMobiusTeam,
    IPartitionedMatchmakingResults,
    ITeam,
    matchmakeTeams,
    MatchupFailureReason,
    SeededRandom,
    Writeable
} from "../../../index";
import {mobiusDemoMatchmakingConfig} from "./MobiusDemoMatchmakingConfig";

class MobiusMatchmakingDemo {
    private loadedTeams?: readonly IMobiusTeam[];
    private results?: IPartitionedMatchmakingResults<IMobiusTeam>;

    public async performMatchmaking(): Promise<void> {
        await this.loadTeams();
        await this.matchmake();
        this.printResults();
    }

    private async loadTeams(): Promise<void> {
        // load dataset containing teams data structure
        this.loadedTeams = JSON.parse(await fs.readFile('data/teams.json', 'utf8'));

        // simulate random team ELOs for demonstration purposes
        const random = new SeededRandom(42);
        for (const team of this.loadedTeams as Writeable<IMobiusTeam>[])
            team.elo = Math.floor(random.next(1200, 1900)); // a smaller ELO range results in more matchups

        // list team counts by region
        console.log(bold(`Loaded ${greenBright(this.loadedTeams!.length.toString())} teams from dataset:`));
        for (const [region, regionTeams] of groupBy(this.loadedTeams!, team => team.region).entries())
            console.log(` - Region ${magentaBright(region)} has ${greenBright(regionTeams.length.toString())} teams`);
    }

    private async matchmake(): Promise<void> {
        // change this date to adjust scheduling week
        const date = new Date();
        date.setDate(date.getDate() - date.getDay()); // set to sunday of this week
        // date.setDate(date.getDate() + 7 * 2); // uncomment this for 2 weeks from now
        console.log(bold("Scheduling matchmaking on the week of ") + yellowBright(date.toString()));
        console.log();

        const originalLogger = console.log;
        console.log = (...args: any[]) => originalLogger(...[gray("[DEBUG]")].concat(args.map(arg => gray(arg))));
        try {
            this.results = await matchmakeTeams<IMobiusTeam>(this.loadedTeams!, {
                partitionBy: 'region',
                scheduledDate: date,
                excludeTimeSlotsThatAlreadyOccurred: false,
                config: mobiusDemoMatchmakingConfig,
            });
        } finally {
            console.log = originalLogger;
        }
    }

    private printResults(): void {
        const {results, unmatchedTeams} = this.results!;

        // list all unmatched teams
        const unavailableTeamCount: number = Array.from(unmatchedTeams.values())
            .reduce((sum, reason) => sum + (reason === MatchupFailureReason.UNSCHEDULED_AVAILABILITY ? 1 : 0), 0);
        console.log(`${bold("Unmatched teams:")} (${redBright(unmatchedTeams.size.toString())} unmatched ${bold('/')} ${greenBright(this.loadedTeams!.length.toString())} total; ${redBright(unavailableTeamCount.toString())} teams lack availability and are omitted for brevity)`);
        for (const [region, {teams, unmatchedTeams}] of results.entries()) {
            console.log(`${bold(` - Region ${magentaBright(region)}`)} (${redBright(`${unmatchedTeams.size}`)} unmatched ${bold('/')} ${greenBright(teams.length.toString())} total)`);
            for (const [team, unmatchedReason] of unmatchedTeams.entries()) {
                if (unmatchedReason === MatchupFailureReason.UNSCHEDULED_AVAILABILITY)
                    continue;
                const reason = ["No matchups found", "Unscheduled availability", "All availability already occurred"][unmatchedReason] ?? `Code ${unmatchedReason}`;
                console.log(`   - ${formatTeam(team)}: ${reason}`);
            }
        }
        console.log();

        // list all scheduled matchups
        const totalMatchups = Array.from(results.values())
            .reduce((sum, {scheduledMatchups}) => sum + scheduledMatchups.length, 0);
        console.log(`${bold("Matches:")} (${greenBright(`${totalMatchups}`)} total)`)
        for (const [region, {scheduledMatchups}] of results.entries()) {
            console.log(`${bold(` - Region ${magentaBright(region)}`)} (${greenBright(`${scheduledMatchups.length}`)} total)`);
            for (const {time, teams} of scheduledMatchups)
                console.log(
                    `   - (${blueBright(time.day)}, ${yellow(time.ordinal.toString())}): `
                    + teams.map(({team}) => formatTeam(team)).join(" vs ")
                    + ` (${redBright(Math.abs(teams[0].team.elo - teams[1].team.elo).toString())} ELO differential)`
                );
        }
        console.log();

        // list all teams and their scheduled matchups
        const totalTeamsMatched = Array.from(results.values())
            .reduce((sum, {teams, unmatchedTeams}) => sum + teams.length - unmatchedTeams.size, 0);
        console.log(`${bold("Team metrics:")} (${greenBright(totalTeamsMatched.toString())} total teams scheduled)`);
        for (const [region, {teams, scheduledMatchups}] of results.entries()) {
            const matchupsByTeam = new Map(
                Array.from(groupBy(
                    scheduledMatchups,
                    matchup => matchup.teams.map(team => team.team),
                    GroupingBehavior.MULTI_KEY_MULTI_VALUE
                ).entries())
                    .sort(([, a], [, b]) => b.length - a.length) // number of matchups, ordered descending
            );
            console.log(`${bold(` - Region ${magentaBright(region)}`)} (${greenBright(`${matchupsByTeam.size}`)} total)`);

            for (const [scheduledTeam, matchups] of matchupsByTeam.entries()) {
                console.log(
                    `   - ${greenBright(matchups.length.toString())} matches for ${formatTeam(scheduledTeam)}: `
                    + matchups.map(({time, teams}) => {
                        const competingTeam = teams.filter(team => team.team !== scheduledTeam)[0].team;
                        return `${formatTeam(competingTeam, red)} ${gray(`(${time.day}:${time.ordinal})`)}`;
                    }).join(gray(", "))
                );
            }
        }
    }
}

// The project is configured as CommonJS, so top-level await is not supported - this is a workaround
(async () => (new MobiusMatchmakingDemo()).performMatchmaking())();

export function formatTeam(team: ITeam, color?: (text: string) => string) {
    color ??= cyan;
    return `[${yellowBright(team.elo.toString())}]${color(team.name)}`;
}
