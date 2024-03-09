<h1 align="center">
    Mobius: Competitive Team Matchmaking
</h1>

<p align="center">
    <i>A competitive team-matchmaking algorithm for the melee game <a href="https://store.steampowered.com/app/1766450/Mobius/">Mobius</a> that utilizes a genetic algorithm to optimize for balanced team match-ups.</i>
</p>

## Table of Contents

- [Motivations](#motivations)
- [Build Instructions](#build-instructions)
- [Usage](#usage)
- [License](#license)

<hr>

## Motivations

The early-access multiplayer game [Mobius](https://store.steampowered.com/app/1766450/Mobius/) features a competitive
tournament scene for teams of exactly 5 players. Team captains submit their team's availability in the game's
[Discord server](https://discord.gg/mobiuscompetitive) to be scheduled to compete against another team in a match-up.
Two teams will compete against each other for up to an hour, where the winning team takes
[Elo rating](https://en.wikipedia.org/wiki/Elo_rating_system) from the losing team.

Team matchmaking is a difficult problem, since several factors must be considered to ensure a fair and balanced
match-up. These factors include:

1. **(Required)** Teams cannot compete against a team from another geographic region in the interest of minimizing
   latency for fairness (e.g. a NA team cannot compete against an EU team).
2. **(Required)** Each team can only be scheduled once per time slot to avoid double-booking.
3. **(Required)** Teams cannot play back-to-back matches to prevent fatigue (e.g. a team cannot play a 8pm match and
   then subsequently a 9pm match on the same day).
4. **(Soft)** The skill-level between competing teams should be minimal to ensure balanced wins/losses. Teams will be
   assigned [Elo rating](https://en.wikipedia.org/wiki/Elo_rating_system) that will be used to estimate their skill
   level; winning teams will take Elo from losing teams. The Elo differential between two teams should not exceed a
   certain threshold, by default 200.
5. **(Soft)** Teams should avoid being match-made with other teams they have competed against in the last 2 weeks.
6. **(Soft)** The amount of games each team plays should be roughly equal (relative to their join time in the current
   season).

> A **required constraint** is a constraint that must be satisfied for the match-up to be valid. A **soft constraint**
> is a constraint that is desirable to optimize and satisfy, but not strictly required for a valid match-up.

There is no obvious algorithm to solve this problem optimally, as the search space is massive and the constraints are
complex to optimize for. Further, an algorithm should optimize for fairness across every team, not just for a single
team.

This repository uses a genetic algorithm implementation for Mobius's competitive team matchmaking that aims to optimize
for balanced team match-ups for all teams.

## Build Instructions

This project uses [Node.js v20](https://nodejs.org/en/download)
and [Yarn v2](https://yarnpkg.com/getting-started/install) for development. To build the project, run the following
commands:

```bash
corepack enable
yarn install --immutable --immutable-cache --check-cache
yarn run build
```

> Note: You may need to run `corepack enable` in a terminal with elevated permissions.

See the [Releases](https://github.com/concision/mobius-team-matchmaking/releases)
and [Packages](https://github.com/concision?tab=packages&repo_name=mobius-team-matchmaking) pages for pre-built
Node.js/NPM packages.

## Usage

There are two "entrypoint" API functions that are exported from this module:

- [`matchmakeTeams(options: IMatchmakingOptions): IMatchmakingResult`](./src/api/TeamMatchmaking.ts#L141C1-L149C78):
  Matchmakes teams without partitioning by region - all teams must be from the same region.
- [`matchmakeTeamsByRegion(options: IMatchmakingOptions): IMatchmakingResult`](./src/api/TeamMatchmaking.ts#L151C1-L159C86):
  Partitions teams by region and matchmakes each region separately.

See [`./src/demo/MatchmakingDemo`](./src/demo/MatchmakingDemo.ts#L11C1-L19C5) for an example usage of these functions
with the existing dataset in `./data/teams.json`. To run the matchmaking demo with the existing dataset
in `./data/teams.json`, follow the [build instructions](#build-instructions) and then run the following command:

```bash
yarn run demo
```

## TODO
- [ ] Improve code quality (improve/add documentation, separate classes into separate files)
- [ ] Add `eslint` linter and `prettier` formatter
- [ ] Improve documentation (e.g. explain algorithm criteria / format, add GitHub badges)
- [ ] Add unit tests

## License

This repository is licensed under the [GNU GPLv3 License](LICENSE).
