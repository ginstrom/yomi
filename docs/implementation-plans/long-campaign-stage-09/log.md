# Log: long campaign, stage 9 (the outer rings)

Append-only history for [the plan](index.md) and [the feature record](../../features/long-campaign-stage-09.md): baselines and measurements, run histories, timings, review summaries, and anything else the plan accumulates as steps finish. The orchestrator does not read this file on resume.

## Verification

## Step 01: the stage's baseline (2026-11-22)

Measured by the `yomi-measure` agent at `5664289` (no code change since `08854d3`), seed 1, 500 campaigns, one at a time. `one` ran in the main tree before any source edit (Node loads its modules at start); `company` and `rl10` in a clean worktree at `5664289`. Logs: `logs/s9-base-{one,company,rl10}.*` (gitignored; the worktree's logs moved there and the worktree removed).

| Run | Flags | Source wins | Mean days | Battles | Heroes dead | Gold by source (a campaign) | Wall time |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 50-campaign check | `--campaign --battles 50 --seed 1 --parties 1` | 22 of 50 | — | — | — | sites 223, market 0, routes 0, sales 38 | 0:56 |
| `one` | `--campaign --battles 500 --seed 1 --parties 1` | 233 of 500 | 284 | 19.3 | 1.2 | sites 226, market 0, routes 0, sales 42 | 11:06 |
| `company` | `--campaign --battles 500 --seed 1` | 232 of 500 | 285 | 19.3 | 1.2 | sites 226, market 0, routes 0, sales 42 | 12:07 |
| `rl10` | `--campaign --battles 500 --seed 1 --ready-level 10` | 433 of 500 | 509 | 42.2 | 1.0 | sites 406, market 3, routes 1, sales 147 | 16:42 |

- 50-campaign SHA-256: `b50f7b50626d6e2832deb18c44a808b9be0521002698dc97c1fa8216db904e52`.
- `rl10` is 433, above its 370–420 band (accepted up to 445), unchanged from the bands' "Now". `one` and `company` in band, unchanged from "Now".
- Wall times are not clean: other work ran beside every run (this step's unit tests and the policy snapshot during `one`; steps 03 and 06 in their worktrees). Step 08 should compare against a clean rerun, or treat these as upper bounds.
- Day cost before (`node scripts/dayCost.ts`, 1000 days, seed 1, 60 × 40, 24 monster locations at the end; three runs, median): `passTurn` 0.666 ms a day (0.666, 0.672, 0.665), `advanceDay` 0.628 ms a day (0.628, 0.593, 0.631).

## Step 01: after the change

- 50-campaign check on the step's tree: SHA-256 `b50f7b50626d6e2832deb18c44a808b9be0521002698dc97c1fa8216db904e52`, **identical** to the baseline (22 of 50).
- The refactor guard passes with `GUARD_RECORDS` untouched.
- Policy snapshot re-recorded: 5439 → 14096 lines; the 5439 old lines are the same lines in the same order (each old (encounter, threat) group identical, and the old list a subsequence of the new); the 37 new groups are `source_guardians` 6–20, `spider_nest` 4 and 6–9, `salamander_pool` 6–9, `bandit_company` 8–13, `freebooter_host` 14–20.

## Step 01 review

Step 01 review: reviewer opus, clean in 1 round; 50-check identical (b50f7b50…); index trimmed to 27,518 bytes.

## Step 03

Step 03: engineer sonnet, reviewer opus; Routes tab pages with the shared pager, 4 rows a page, paged rows 69 px from y 142, pager at y 431; review rounds 3 (4 findings, then 1, then clean); commits 0820d94, 69d5ebc, af27c27.

## Step 06

Step 06: engineer sonnet, reviewer opus; three partner sprites (map_partner_hold, map_partner_glade, map_partner_pass); review clean in 1 round; accepted non-blocking: the glade's sway is faint, Emberwatch's rock shoulders read a little like towers; commit f5f1ce0.

## Step 02: the simulator's long-campaign settings (2026-11-22)

- 50-campaign check before (step 01's command, at `c07152a`, no source edit): SHA-256 `b50f7b50626d6e2832deb18c44a808b9be0521002698dc97c1fa8216db904e52`, matching step 01's.
- After (`--campaign --battles 50 --seed 1 --parties 1 --ready-level 7 --near-source`): SHA-256 `b50f7b50626d6e2832deb18c44a808b9be0521002698dc97c1fa8216db904e52`, **identical** (22 of 50; 0 out of days, so the 6000-day limit touched none). 0:30 wall each.
- The after run's new lines: `Trade: 0.50 partners contacted; routes 0.00 opened, 0.00 raided, 0.00 abandoned a campaign; 0.00 raids told, 0.00 flickers (raided again within 30 days of safe), 0.00 routes raided 6+ yield days and kept` and `Walking: the vanguard walked 249.5 days a campaign, 55.6 of them walking home`.
- Refactor guard: args pinned to `--ready-level 7 --near-source`; only the four new fields added (`vanguardWalkDays` 412, 341, 300, 303, 26; the route fields 0); `GUARD_EVENTS_SHA256` unchanged.
- Review round 1 fix: a reopened route starts its tally afresh (`route_opened`); the 50-check rerun after the fix, below.
- 50-check after the review fix: `b50f7b50626d6e2832deb18c44a808b9be0521002698dc97c1fa8216db904e52`, identical; `npm test` 102 files, 2589 tests passed.
