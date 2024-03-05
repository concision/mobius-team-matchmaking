import {readFileSync} from "fs";
import {IScheduledMatchup, ITeam, matchmakeTeams} from "./index";
import {FailedMatchupReason} from "./api/TeamMatchmaking";
import {bold, cyan, gray, greenBright, red, redBright} from "ansi-colors";

const teams: ITeam[] = JSON.parse(readFileSync('data/teams.json', 'utf8'));

const naTeams = teams.filter(({region}) => region === 'NA');
console.log(bold(`Loaded ${greenBright(naTeams.length.toString())} teams from the NA region`));

const {scheduledMatchups, unmatchedTeams} = debugLog(() => matchmakeTeams({
    teams: naTeams,
    defaultParameters: {
        maximumGames: 3,
    },
    configure: constraints => {
        constraints.debugMode = true;
    },
}));

console.log(`${bold("Matches:")} (${greenBright(`${scheduledMatchups.length}`)} total)`)
for (const {time, teams} of scheduledMatchups)
    console.log(` - (${time.day}, ${time.ordinal}): [${cyan(teams[0].team!.name)} vs ${cyan(teams[1].team!.name)}]`);
console.log();

const unavailableTeamCount: number = [...unmatchedTeams.entries()]
    .filter(([team, reasonOrdinal]) => reasonOrdinal === FailedMatchupReason.UNSCHEDULED_AVAILABILITY)
    .length;
console.log(`${bold("Unmatched teams:")} (${greenBright(unmatchedTeams.size.toString())} total; ${redBright(unavailableTeamCount.toString())} teams lack availability)`);
for (const [team, reasonOrdinal] of unmatchedTeams) {
    if (reasonOrdinal === FailedMatchupReason.UNSCHEDULED_AVAILABILITY)
        continue;
    const reason= ["No matchups found", "Unscheduled availability"][reasonOrdinal] ?? `Code ${reasonOrdinal}`;
    console.log(` - ${cyan(team.name)}: ${reason}`);
}
console.log();

console.log(bold("Matchup metrics:"));
const matchupsByTeam = new Map<ITeam, IScheduledMatchup[]>();
for (const scheduledMatchup of scheduledMatchups) {
    for (const team of scheduledMatchup.teams) {
        const matchups = matchupsByTeam.get(team.team) ?? [];
        matchups.push(scheduledMatchup);
        matchupsByTeam.set(team.team, matchups);
    }
}
for (const [scheduledTeam, matchups] of Array.from(matchupsByTeam.entries()).sort(([, a], [, b]) => b.length - a.length)) {
    const matches = matchups.map(({time, teams}) =>
        `${red(teams.filter(team => team.team !== scheduledTeam)[0].team.name)} (${gray(`${time.day}:${time.ordinal}`)})`
    ).join(gray(", "))
    console.log(` - ${cyan(scheduledTeam.name)} is scheduled for ${greenBright(matchups.length.toString())} matches: ${matches}`);
}


function debugLog<T>(action: () => T): T {
    const originalLogger = console.log;
    console.log = (...args: any[]) => originalLogger(...[gray("[DEBUG]")].concat(args.map(arg => gray(arg))));
    try {
        return action();
    } finally {
        console.log = originalLogger;
    }
}
