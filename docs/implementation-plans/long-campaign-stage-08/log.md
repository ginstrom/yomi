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

- Step 05 (the world map's roads and partners): engineer sonnet, reviewer opus; verdict clean after 1 review round. Commits `75603ad` and the round 1 follow-ups (a `grey` probe field from the drawn tint and label, silence told only when contacted or in sight, "pays nothing while raided" on a raided road, manual wording).

- Step 06 (the Routes tab and the debug console): engineer sonnet, reviewer opus; verdict clean after 2 review rounds. Commits `ba4b82b`, the round 1 follow-ups `a04d476` and the round 2 follow-ups (`spawn` takes a named hex, never a party's).

## Step 07: the simulator's trade (2026-11-22)

- 50-campaign check before `1ceefe63…74400d1` (23/50, identical to step 01); after `b50f7b50626d6e2832deb18c44a808b9be0521002698dc97c1fa8216db904e52` (22/50, 281 days, 0.50 partners contacted, no route). The ungated detour was measured first: `one` 304/500, 359 days, out of band; the user chose to gate it on trading post 4 (decision 13). Gated, 500 campaigns: `one` 233 (284 days), `company` 232 (285 days), `rl10` 433 (509 days; 0.54 partners contacted, 0.03 routes opened, 1 route gold, none raided or abandoned). The refactor guard re-recorded once (events `e638f2a4…6f1180`).
- Ungated against gated, 50 campaigns (seed 1, `--parties 1`): partners and no detour 22/50; the detour as first specified 35/50 (375 days); the nest chosen before the detour 31/50; the detour gated on `routeLimit(world) > 0` 22/50. Ungated `one`, 500: 304/500, 359 days, 24.8 battles, 1.2 dead, 1.56 partners contacted, no route.
- 500 campaigns, seed 1, gated, measured by `yomi-measure` one at a time (logs `logs/s8-07-{one,company,rl10}.*` in the step's worktree):

  | Run | Source wins | Mean days | Partners contacted | Routes opened | Route gold (a campaign) |
  | --- | --- | --- | --- | --- | --- |
  | `one`, baseline | 239 | 286 | — | — | — |
  | `one` | 233 (band 215 to 250) | 284 | 0.47 | 0.00 | 0 |
  | `company`, baseline | 239 | 286 | — | — | — |
  | `company` | 232 (band 220 to 260) | 285 | 0.47 | 0.00 | 0 |
  | `rl10`, baseline | 434 | 509 | — | — | — |
  | `rl10` | 433 (370 to 420, accepted up to 445) | 509 | 0.54 | 0.03 | 1 |

  The early game's 6 and 7 points come from the partners' land as clean sources reshuffling the spawns (no detour and no road in it), within the 500-campaign sampling spread.

## Step 07 outcome

- Step 07 (the simulator's trade): engineer opus, reviewer opus; verdict clean after 1 review round. The review's only blocking item was these records (this section and the index row), held back on purpose until the merge; its follow-ups (N2 to N5) are in `9ce59b9`. Commits `1dfbd59`, `9ce59b9`, merged into the stage branch in `c94e05f`.
