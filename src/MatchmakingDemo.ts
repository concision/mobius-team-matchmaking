import {readFileSync} from "fs";
import {ITeam, matchmakeTeams} from "./index";

const teams: ITeam[] = JSON.parse(readFileSync('data/teams.json', 'utf8'));
const {matchups, unmatched} = matchmakeTeams({teams: teams.filter(({region}) => region === 'NA'), maximumGames: 1});

console.log(`Matches (${matchups.length}): \n${matchups.map(matchup =>
    ` - (${matchup.time.day}, ${matchup.time.ordinal}): [${matchup.teams[0].team!.name} vs ${matchup.teams[1].team!.name}]`
).join("\n")}`);
console.log();

console.log(`Unmatched teams (${unmatched.length}):\n${unmatched.map(team => ` - ${team.name}`).join("\n")}`);
console.log();

console.log("Matchup statistics:");
const playedMatches = matchups.flatMap(matchup => matchup.teams)
    .reduce((map, team) => map.set(team.team, (map.get(team.team) ?? 0) + 1), new Map<ITeam, number>())
    .entries();
for (const [team, matchupCount] of playedMatches)
    console.log(` - ${team.name} is scheduled for ${matchupCount} matches`);
