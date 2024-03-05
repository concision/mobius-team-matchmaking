import {readFileSync} from "fs";
import {IGeneticOptions, ITeam, ITeamMatchupsIndividual, matchmakeTeams, Writeable} from "./index";
import {FailedMatchupReason} from "./api/TeamMatchmaking";

const teams: ITeam[] = JSON.parse(readFileSync('data/teams.json', 'utf8'));

let naTeams = teams.filter(({region}) => region === 'NA');
console.log(`Loaded ${naTeams.length} teams from the NA region`)
const {scheduledMatchups, unmatchedTeams} = matchmakeTeams({
    teams: naTeams,
    defaultParameters: {
        maximumGames: 3,
    },
    configure: constraints => {
        constraints.debugMode = true;
    },
});

console.log(`Matches (${scheduledMatchups.length}):`)
console.log(scheduledMatchups.map(matchup =>
    ` - (${matchup.time.day}, ${matchup.time.ordinal}): [${matchup.teams[0].team!.name} vs ${matchup.teams[1].team!.name}]`
).join("\n"));
console.log();

const unavailableTeamCount: number = [...unmatchedTeams.entries()]
    .filter(([team, reasonOrdinal]) => reasonOrdinal === FailedMatchupReason.UNSCHEDULED_AVAILABILITY)
    .length;
console.log(`Unmatched teams (${unmatchedTeams.size} total; ${unavailableTeamCount} teams lack availability):`);
console.log([...unmatchedTeams.entries()]
    .filter(([team, reasonOrdinal]) => reasonOrdinal !== FailedMatchupReason.UNSCHEDULED_AVAILABILITY)
    .map(([team, reasonOrdinal]) => {
        const reason: string = ["No matchups found", "Unscheduled availability"][reasonOrdinal] ?? `Code ${reasonOrdinal}`
        return ` - ${team.name}: ${reason}`;
    }).join("\n"));
console.log();

console.log("Matchup metrics:");
const playedMatches = scheduledMatchups.flatMap(matchup => matchup.teams)
    .reduce((map, team) => map.set(team.team, (map.get(team.team) ?? 0) + 1), new Map<ITeam, number>())
    .entries();
for (const [team, matchupCount] of playedMatches)
    console.log(` - ${team.name} is scheduled for ${matchupCount} matches`);
