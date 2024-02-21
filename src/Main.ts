import {readFileSync} from "fs";

const teams = JSON.parse(readFileSync('data/teams.json'));

console.log(teams);