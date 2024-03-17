<h1 align="center">
    Mobius's Competitive Team Matchmaking Algorithm
</h1>

<p align="center">
    <a href="https://github.com/concision/mobius-team-matchmaking/blob/master/LICENSE"><img alt="Repository license" src="https://img.shields.io/github/license/concision/mobius-team-matchmaking?style=for-the-badge"/></a>
    <a href="https://github.com/concision/mobius-team-matchmaking/pkgs/npm/mobius-team-matchmaking"><img alt="npm package: esm-loader-chaining-polyfill" src="https://img.shields.io/github/package-json/v/concision/mobius-team-matchmaking?color=red&logo=npm&style=for-the-badge"/></a>
    <a href="https://github.com/concision/mobius-team-matchmaking/blob/master/package.json#L29C5-L29C23"><img alt="Node.js engine compatibility" src="https://img.shields.io/node/v/mobius-team-matchmaking?color=green&logo=node.js&logoColor=green&style=for-the-badge"/></a>
</p>

<p align="center">
    <i>A competitive team-matchmaking algorithm for the melee game <a href="https://store.steampowered.com/app/1766450/Mobius/">Mobius</a> 
        that utilizes genetic programming to optimize for balanced team matchup schedules.</i>
</p>

## Table of Contents

- [Motivations](#motivations)
- [Usage](#usage)
    - [Releases](#releases)
    - [Build Instructions](#build-instructions)
    - [API](#api)
- [Planned TODOs](#planned-todos)
- [License](#license)

<hr>

## Motivations

The early-access multiplayer PvP game [Mobius](https://store.steampowered.com/app/1766450/Mobius/) features a
competitive tournament league for teams to compete against each other on a weekly basis. Whereas traditional tournaments
run on scheduled dates, Mobius's competitive scene permits teams to schedule their availability throughout the week on
the game's [Discord server](https://discord.gg/mobiuscompetitive) and are to be automatically scheduled to compete
against other teams.

While randomly scheduling teams to compete against each other is a simple solution, it is not a fair solution. Mobius's
competitive scene aims to be fair and balanced which is important for the competitive integrity of the game and for the
enjoyment of the players. Unfortunately, there is no obvious algorithm to solve this problem optimally, as the search
space is massive and the constraints are complex to optimize for. Further, an algorithm should optimize for fairness
across every team, not just for a single team.

**This repository implements a competitive team matchmaking algorithm for Mobius that strives for fair and balanced
team matchup schedules by utilizing genetic programming to optimize for desirable matchmaking criteria.** The algorithm
is designed to be extensible and configurable for other competitive games and leagues, or for optimization of other
criteria.

## Usage

## Releases

Prebuilt NPM packages are available for this repository
via [Releases](https://github.com/concision/mobius-team-matchmaking/releases)
and [GitHub Packages](https://github.com/concision?tab=packages&repo_name=mobius-team-matchmaking).

### Build Instructions

This project uses [Node.js v20](https://nodejs.org/en/download) and
[Yarn v2](https://yarnpkg.com/getting-started/install) for development. To build the project locally, run the following
commands:

```bash
corepack enable
yarn install --immutable --immutable-cache --check-cache
yarn run build
```

> Note: `corepack enable` will likely need to be executed in a terminal with elevated permissions.

### API

There is a single public API function for performing matchmaking:
[`matchmakeTeams(teams: ITeam[], options: IMatchmakingOptions): IMatchmakingResult`](src/matchmaking/TeamMatchmaking.ts#L26-L51).

An example implementation can be found in
the [matchmaking demo](src/matchmaking/mobius/demo/MobiusDemoMatchmakingConfig.ts) with
the [default genetic configuration](src/matchmaking/mobius/MobiusMatchmakingConfig.ts). To run the matchmaking demo with
the existing dataset in `./data/teams.json`, follow the [build instructions](#build-instructions) and then run the
following CLI command:

```bash
yarn run demo
```

## Planned TODOs

<details>
  <summary>A non-exhaustive list of tasks (in no particular order) to maybe be completed</summary>

- [x] Initial experimental matchmaking API v0.1.0
    - [x] Implement genetic programming library
    - [x] Implement matchmaking API contracts (i.e. inputs, outputs, constraints/options, etc.)
    - [x] Implement default matchmaking algorithm with custom genetic operators
    - [x] Implement matchmaking API
    - [x] Implement demonstration example with existing Mobius dataset
    - [x] Automated CI/CD:
        - [x] Automatic build validation on new commits
        - [x] Publish to GitHub NPM Packages on new semver tags

- Significantly improve repository quality
    - [x] Document TypeScript types and functions
    - [x] Abstract complex data aggregations and mathematical operations to separate library functions
    - [x] Improve README documentation
        - [x] Shorten ['Motivations'](#motivations) section
        - [x] Explain matchmaking criteria and difficulty
        - [x] Explain genetic algorithm approach and optimization criteria
        - [x] Explain the API and its supported options
        - [x] Add silly GitHub badges and ✨flair✨

- Implement new library features
    - [x] Permit any derived type of `ITeam` to be used in the matchmaking API

    - [x] Merge the region-partitioned matchmaking API with the non-partitioned API; expose a configuration option
      lambda for partitioning (defaulting to team region for Mobius)

    - [x] Rewrite all genetic algorithm types to be more modular, extensible, and serializable
        - [x] Abstract all genetic algorithm types to a tree-traversable `GeneticOperator` class (including
          root `IGeneticOptions`)
        - [x] Implement various helpful functions for tweaking `GeneticOperator` properties/weights without needing to
          rewrite an entire genetic operator configuration

    - [ ] Implement configurable asynchronous multithreading pool using Node.js workers
        - [ ] Implement configuration option for asynchronous and worker pool size
        - [ ] Determine how to pass consumer genetic operators to worker threads (e.g. pure functions and class
          definitions that are serializable? scoped closures would not be supported)
        - [ ] Auto-parallelize matchmaking partitions to different workers

- [ ] Improve Node.js project architecture
    - [ ] Integrate `eslint` linter for TypeScript
    - [ ] Integrate `prettier` formatter for TypeScript with IDE integration
    - [ ] Integrate unit test framework
        - [ ] Implement unit tests for all trivial library functions

</details>

## License

This repository is licensed under the [GNU GPLv3 License](LICENSE).
