import {readFileSync} from "fs";
import {matchmakeTeamsByRegion} from "./index";

const teams = JSON.parse(readFileSync('data/teams.json', 'utf8'));

matchmakeTeamsByRegion({teams, maximumGames: 1});
