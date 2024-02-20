<h1 align="center">
    Mobius - Competitive Team Matchmaking
</h1>

<p align="center">
    <i>A competitive team-matchmaking algorithm for the melee game [Mobius](https://store.steampowered.com/app/1766450/Mobius/) that utilizes a genetic algorithm to optimize for balanced team match-ups.</i>.
</p>

## Table of Contents

- [Motivations](#motivations)
- [Build Instructions](#build-instructions)
- [Usage](#usage)
- [Disclaimers](#disclaimers)

<hr>

## Motivations

The upcoming multiplayer game [Mobius](https://store.steampowered.com/app/1766450/Mobius/) features a competitive
tournament scene for teams of 5 players each. Each week, teams submit their availability in the game's
[Discord server](https://discord.gg/H7D8CJPNxt) to be scheduled to compete against another team in a match-up.
Two teams will compete against each other for up to an hour, where the winning team takes
[Elo rating](https://en.wikipedia.org/wiki/Elo_rating_system) from the losing team.

Team matchmaking is a difficult problem, since several factors must be considered to ensure a fair and balanced
match-up. These factors include:

1. **(Required)** Each team can only be scheduled once per time slot to avoid double-booking.
2. **(Required)** Teams cannot play back-to-back matches to prevent fatigue (e.g. a team cannot play a 8pm match and
   then subsequently a 9pm match on the same day).
3. **(Required)** Teams cannot compete against a team from another geographic region in the interest of minimizing
   latency for fairness (e.g. a NA team cannot compete against an EU team).
4. **(Soft)** The skill-level between competing teams should be minimal to ensure balanced wins/losses. Teams will be
   assigned [Elo rating](https://en.wikipedia.org/wiki/Elo_rating_system) that will be used to estimate their skill
   level; winning teams will take Elo from losing teams. The Elo differential between two teams should not exceed a
   certain threshold, by default 200.
5. **(Soft)** Teams should avoid being match-made with other teams they have competed against in the last 2 weeks.
6. **(Soft)** The amount of games each team plays should be roughly equal (relative to their join time).

> A **required constraint** is a constraint that must be satisfied for the match-up to be valid. A **soft constraint**
> is a constraint that is desirable to optimize and satisfy, but not strictly required for a valid match-up.

There is no obvious algorithm to solve this problem optimally, as the search space is massive and the constraints are
complex to optimize for. Further, an algorithm should optimize for fairness across every team, not just for a single
team.

This repository uses a genetic algorithm implementation for Mobius's competitive team matchmaking that aims to optimize
for balanced team match-ups for all teams.

## Build Instructions

TODO

## Usage

TODO

## Disclaimers

TODO