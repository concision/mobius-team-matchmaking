import {readFileSync} from "fs";
import {ITeam, matchmakeTeamsByRegion, MatchupFailureReason, Writeable} from "../../index";
import {debugLog, formatTeam, groupBy, rangedRandom, seededRandom} from "./DemoUtilities";
import {blueBright, bold, gray, greenBright, magentaBright, red, redBright, yellow, yellowBright} from "ansi-colors";

// load dataset containing teams data structure
const teams: readonly ITeam[] = JSON.parse(readFileSync('data/teams.json', 'utf8'));

// randomize team ELOs
const random = seededRandom(42);
for (const team of <Writeable<ITeam>[]>teams)
    team.elo = Math.floor(rangedRandom(random, 1200, 1900));


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
        console.log(`   - ${formatTeam(team)}: ${reason}`);
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
            + teams.map(({team}) => formatTeam(team)).join(" vs ")
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
            `   - ${greenBright(matchups.length.toString())} matches for ${formatTeam(scheduledTeam)}: `
            + matchups.map(({time, teams}) => {
                const competingTeam = teams.filter(team => team.team !== scheduledTeam)[0].team;
                return `${formatTeam(competingTeam, red)} ${gray(`(${time.day}:${time.ordinal})`)}`;
            }).join(gray(", "))
        );
    }
}
