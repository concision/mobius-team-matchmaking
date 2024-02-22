import {readFileSync} from "fs";
import {ITeam, matchmakeTeams} from "./index";

const teams: ITeam[] = JSON.parse(readFileSync('data/teams.json', 'utf8'));

matchmakeTeams({teams: teams.filter(team => team.region === 'NA'), maximumGames: 1});
