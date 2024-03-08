import {readFileSync} from "fs";
import {ITeam, matchmakeTeamsByRegion} from "../index";
import {MatchupFailureReason} from "../api/TeamMatchmaking";
import {blueBright, bold, cyan, gray, greenBright, magentaBright, red, redBright, yellow, yellowBright} from "ansi-colors";
import {debugLog, groupBy, seededRandom} from "./DemoUtilities";

// load teams from dataset file
const teams: ITeam[] = JSON.parse(readFileSync('data/teams.json', 'utf8'));

// randomize team ELOs
for (const team of teams)
    (<any>team).elo = 1500 + Math.floor(400 * (seededRandom() - .5));


// list team counts by region
const teamsByRegion = groupBy(teams, team => team.region);
console.log(bold(`Loaded ${greenBright(teams.length.toString())} teams from dataset:`));
for (const [region, regionTeams] of teamsByRegion.entries())
    console.log(` - Region ${magentaBright(region)} has ${greenBright(regionTeams.length.toString())} teams`);


// change this date to adjust scheduling week
const date = new Date();
date.setDate(date.getDate() - date.getDay()); // set to sunday of this week
// date.setDate(date.getDate() + 7 * 2); // uncomment this for 2 weeks from now
console.log(bold("Scheduling matchmaking on the week of ") + yellowBright(date.toString()));
console.log();

// perform matchmaking algorithm
const {scheduledMatchups, unmatchedTeams} = debugLog(() => matchmakeTeamsByRegion({
    teams: teams,
    defaultParameters: {
        scheduledDate: date,
        excludeTimeSlotsThatAlreadyOccurred: false,

        hallOfFame: 32,

        maximumGamesPerTeam: 3,
        hardEloDifferentialLimit: 300,

        preventDuplicateMatchupsInLastXDays: 14,
        countGamesPlayedInLastXDays: 21,
    },
    configure: constraints => {
        constraints.debugLogging = false;
    },
}));


// partition scheduled matchups by region and team
const matchupsByRegion = groupBy(scheduledMatchups, matchup => matchup.teams[0].team.region);
const matchupsByTeam = groupBy(scheduledMatchups, matchup => matchup.teams.map(team => team.team));

// list all unmatched teams
const unavailableTeamCount: number = [...unmatchedTeams.entries()]
    .filter(([, reasonOrdinal]) => reasonOrdinal === MatchupFailureReason.UNSCHEDULED_AVAILABILITY)
    .length;
console.log(`${bold("Unmatched teams:")} (${redBright(unmatchedTeams.size.toString())}/${greenBright(teams.length.toString())} total; ${redBright(unavailableTeamCount.toString())} teams lack availability and are omitted for brevity)`);
for (const [region, regionTeams] of teamsByRegion.entries()) {
    const notableUnmatchedTeams = regionTeams.filter(team => unmatchedTeams.has(team));
    console.log(bold(` - Region ${magentaBright(region)}`) + ` (${redBright(`${notableUnmatchedTeams.length}`)}/${greenBright(regionTeams.length.toString())} total)`);
    for (const team of notableUnmatchedTeams) {
        const reasonOrdinal = unmatchedTeams.get(team)!;
        if (reasonOrdinal === MatchupFailureReason.UNSCHEDULED_AVAILABILITY)
            continue;
        const reason = ["No matchups found", "Unscheduled availability", "All availability already occurred"][reasonOrdinal] ?? `Code ${reasonOrdinal}`;
        console.log(`   - [${yellowBright(team.elo.toString())}]${cyan(team.name)}: ${reason}`);
    }
}
console.log();


// list all scheduled matchups
console.log(`${bold("Matches:")} (${greenBright(`${scheduledMatchups.length}`)} total)`)
for (const [region, matchups] of matchupsByRegion.entries()) {
    console.log(bold(` - Region ${magentaBright(region)}`) + ` (${greenBright(`${matchups.length}`)} total)`);
    for (const {time, teams} of matchups)
        console.log(
            `   - (${blueBright(time.day)}, ${yellow(time.ordinal.toString())}): `
            + teams.map(({team}) => `[${yellowBright(team.elo.toString())}]${cyan(team.name)}`).join(" vs ")
            + ` (${redBright(Math.abs(teams[0].team.elo - teams[1].team.elo).toString())} ELO differential)`
        );
}
console.log();


// list all teams and their scheduled matchups
console.log(`${bold("Team metrics:")} (${greenBright(`${matchupsByTeam.size}`)} total teams scheduled)`);
for (const [region, regionTeams] of teamsByRegion.entries()) {
    const matchmadeTeams = regionTeams.filter(team => matchupsByTeam.has(team))
        .sort((a, b) => matchupsByTeam.get(b)!.length - matchupsByTeam.get(a)!.length);
    if (matchmadeTeams.length === 0)
        continue;

    console.log(bold(` - Region ${magentaBright(region)}`) + ` (${greenBright(`${matchmadeTeams.length}`)} total)`);
    for (const scheduledTeam of matchmadeTeams) {
        const matchups = matchupsByTeam.get(scheduledTeam)!;
        console.log(
            `   - ${greenBright(matchups.length.toString())} matches for [${yellowBright(scheduledTeam.elo.toString())}]${cyan(scheduledTeam.name)}: `
            + matchups.map(({time, teams}) => {
                const competingTeam = teams.filter(team => team.team !== scheduledTeam)[0].team;
                return `[${yellowBright(competingTeam.elo.toString())}]${red(competingTeam.name)} (${gray(`${time.day}:${time.ordinal}`)})`;
            }).join(gray(", "))
        );
    }
}
