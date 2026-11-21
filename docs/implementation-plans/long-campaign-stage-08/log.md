# Log: long campaign, stage 8 (trade partners and routes)

Append-only history for [the plan](index.md) and [the feature record](../../features/long-campaign-stage-08.md): baselines and measurements, run histories, review summaries, and anything else the plan accumulates as steps finish. The orchestrator does not read this file on resume.

## Verification

## Step 01: the stage's baseline (2026-11-21)

Measured by the `yomi-measure` agent on a clean worktree at `b28bba1` (no code change since `42cde46`), seed 1, one run at a time. Logs in `logs/s8-base-*` (gitignored).

| Run | Flags | Source wins | Mean days | Battles | Heroes dead | Gold by source (a campaign) |
| --- | --- | --- | --- | --- | --- | --- |
| 50-campaign check | `--campaign --battles 50 --seed 1 --parties 1` | 23 of 50 | — | — | — | — |
| `one` | `--campaign --battles 500 --seed 1 --parties 1` | 239 of 500 | 286 | 19.5 | 1.1 | sites 228, market 0, sales 42 |
| `company` | `--campaign --battles 500 --seed 1` | 239 of 500 | 286 | 19.5 | 1.1 | sites 227, market 0, sales 42 |
| `rl10` | `--campaign --battles 500 --seed 1 --ready-level 10` | 434 of 500 | 509 | 42.1 | 1.0 | sites 406, market 3, sales 144 |

- 50-campaign SHA-256: `1ceefe633e71c0326c0c5b261c77e1c010c49e30303a85286a782589e74400d1`.
- No income line: it prints only with `--waiting`, which the baseline did not pass.
- `rl10` is 434, above its 370–420 band (accepted up to 445), unchanged from the bands' "Now".

## Step 01: after the change

- 50-campaign check on the step's tree: SHA-256 `1ceefe633e71c0326c0c5b261c77e1c010c49e30303a85286a782589e74400d1`, **identical** to the baseline (23 of 50).
- The refactor guard (`scripts/simulate.test.ts`) passes with the fixture untouched.

## Step 01 outcome

- Step 01 (partners, contact and silence): engineer opus, reviewer opus; verdict clean after 1 review round. Commits `a2df674`, `5916f52`, and the review follow-up (two small save fixes, step 02's route save check, the index trimmed under its cap).

## Step 02: after the change (2026-11-21)

- 50-campaign check: SHA-256 `1ceefe633e71c0326c0c5b261c77e1c010c49e30303a85286a782589e74400d1`, **identical** to the baseline (23 of 50; gold by source: sites 234, market 0, sales 40 a campaign).
- The refactor guard passes with the fixture untouched.
- Roads on a fresh world (`roadTo`, any seed): Millbrook 14 hexes (27 gold, 10 timber; security 0.857, 1 gold a yield day), Saltmere 30 (35 gold, 10 timber; security 0.667, 2 gold); neither raided, the nearest nest 3 hexes from either road.

## Step 02 outcome

- Step 02 (routes, raids and guards): engineer opus, reviewer opus; verdict clean after 2 review rounds. Commits `615a263`, `9d0507a`, `8d2eabe` (tests from round 1) and the round 2 record. In round 2 the engineer disputed the reviewer's partner-hex break: the edit is the same code, because `passable` lets the partner's hex through before it reads the blocked set (see the step's execution record).

## Step 04 outcome

- Step 04 (sprites: partners and the Lodge): engineer sonnet, reviewer opus; verdict clean after 3 review rounds. Commits `15d13ff..861be38`, merged into the stage branch in `07451c5`.

- Step 03 (roads and the Lodge's level 3): engineer sonnet, reviewer opus; verdict clean after 1 review round. Commits `d851174` and the round 1 follow-ups.
