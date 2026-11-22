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

## Step 04: the board and the rings (2026-11-22)

- 50-campaign check before (`--campaign --battles 50 --seed 1 --parties 1 --ready-level 7 --near-source`, at `df71427`, no source edit): SHA-256 `b50f7b50626d6e2832deb18c44a808b9be0521002698dc97c1fa8216db904e52`, matching step 02's. 22 of 50; 281 days, 19.3 battles, 27.8 spawns, 3.2 sites captured and 0.1 lost, 38% of the land blighted at the end. Wall 0:31.
- After: SHA-256 `3ed0dd1ca43cc237951d4a7c86c4b80d3658dca2f43c6a2dd875135c741d2396`. **28 of 50** (+6); 317 days, 18.5 battles, 31.1 spawns, 3.3 sites captured and 0.1 lost, 26% of the land blighted at the end (a share of a board 4.2 times the size). Wall 2:01, on a machine loaded by unrelated jobs (load average 14 to 30; the before run's was not recorded): an upper bound, not step 08's figure.
- Battles by threat, before → after: 1: 102 → 100; 2: 185 → 184; 3: 214 → 138; 4: 305 → 263; 5: 159 → 242 (won 0.868 → 0.938). No battle above threat 5. The vanguard walked 249.5 → 288.0 days a campaign.
- Attribution run (not committed: `SPAWN_DIVISOR` put back to 200 for one run, `--log none`): 24 of 50, 268 days, 18.6 battles, 56.8 spawns, 33% blighted; threat 3: 196, 4: 268, 5: 188 battles (won 0.904). So the board alone (land past stage 8's edges, the threat 7 ring behind the near Source) moves the figure by about 2, and the divisor (840, the same pressure per hex) by about 4 more: fewer spawns in the home country, so fewer threat 3 and 4 nests to fight, longer walks, more threat 5 nests fought before the Source and so a stronger party at it. Brought to the orchestrator (more than about 5 of 50); 50 campaigns carry about ±3.5 of noise; step 09 measures 500.
- Refactor guard re-recorded (old and new figures above `GUARD_RECORDS`): outcomes unchanged (three Source, two fallen); days 457, 383, 331, 346, 29 → 433, 416, 328, 359, 29; events hash `e638f2a4…6f1180` → `31f97ff2…d70f9f`.

## Step 05: the outer rings' content (2026-11-22)

- 50-campaign check before (`--campaign --battles 50 --seed 1 --parties 1 --ready-level 7 --near-source`, at `eda15e0`, no source edit): SHA-256 `3ed0dd1ca43cc237951d4a7c86c4b80d3658dca2f43c6a2dd875135c741d2396`, matching step 04's. 28 of 50; 317 days, 18.5 battles, 31.1 spawns, 3.3 sites captured and 0.1 lost, 26% of the land blighted at the end, 0.60 partners contacted. Wall 1:42.
- After: SHA-256 `70bff34b22f01f7f8597a777b9d8dc274ede03cf58f9523a8ec7ef3c8af5dd4c`. **28 of 50** (unchanged); 356 days, 17.3 battles, 36.3 spawns, 3.0 sites captured and 0.1 lost, **65%** of the land blighted at the end, 0.60 partners contacted; the vanguard walked 288.0 → 328.2 days. Wall 1:46.
- Battles by threat, before → after: 1: 100 → 100; 2: 184 → 183; 3: 138 → 112; 4: 263 → 172; 5: 242 → 258 (won 0.938 → 0.946); 7: 0 → 36 (won 35); 9: 0 → 2. The threat 7 battles: 14 Spider Broods and 9 other spawns, and 13 at the fixed threat-7 nests (Webwood Nest 5, Hollow Spiders 5, Moorland Bandits 2, Wildland Bandits 1); the threat 9: Smoking Mere and a spawn.
- Cause: the 24 outer nests corrupt the outer rings (pushing as threat 5's), so the corrupted share of the board rises (26% → 65% at the end), spawn pressure grows with it and more spawns land far out. And `nextTarget` marches on the Source when every member reaches the ready level *or no other nest is left*: with fixed outer nests that a near-Source party never clears, the second never holds, so a party left with no nest at its level walks to the nearest threat 7 nest instead, late in the campaign (days 420 to 470), which lengthens campaigns. Wins did not move. No simulator change (out of scope); step 09 judges.
- Roads on `newWorld(1)` under the strict rule (each partner contacted, `raiders` empty for each): Millbrook 14, Saltmere 30, Stonehollow 61, Elder Glade 88, Emberwatch 100 hexes (each a straight walk, its hex distance).
- Refactor guard re-recorded (old and new figures above `GUARD_RECORDS`): outcomes Source, Source, Source, fallen, fallen → fallen, Source, fallen, Source, fallen; days 433, 416, 328, 359, 29 → 498, 467, 363, 377, 29; battles 26, 24, 18, 22, 4 → 19, 20, 17, 21, 4; spawns 46, 43, 31, 35, 0 → 41, 42, 39, 43, 3; partners contacted 1, 1, 1, 0, 0 unchanged; events hash `31f97ff2…d70f9f` → `5bd8d01f…baf96e`.

## Step 05, review round 1 (2026-11-22)

- **The cause above is wrong** (the reviewer's finding). `nextTarget`'s "nothing else is left" branch fired in 0 of 50 campaigns at step 04 too, so its loss explains nothing. The real cause: the spawn draw moved outward. With the outer nests in the world, the outer rings were 88% corrupted, so most spawns were drawn far out, and home-ring spawns fell from 13.3 to 5.7 a campaign (the reviewer's probe). With fewer home nests at its level, the vanguard walked out to threat 7.
- **The user's decision:** under `--near-source` the simulator's world leaves out the fixed nests above threat 5 (`nearSourceWorld`; the far sites and partners stay; the land, held sites and sight seeded without them). Simulator only, no rule change.
- 50-campaign check after the fix: SHA-256 `57fdea1553a35b1af0e33b74a11ea9fe0a0e2f62ef9e5c80972af59276e53e75`. **26 of 50** (step 04: 28; the step's first version: 28); 325 days (317; 356), 18.9 battles (18.5; 17.3), 32.5 spawns (31.1; 36.3), 3.4 sites captured and 0.1 lost, 27% of the land blighted at the end (26%; 65%), 0.60 partners contacted. The vanguard walked 294.1 days (288.0). Battles by threat: 1: 101, 2: 184, 3: 134, 4: 279, 5: 247 (won 0.931); none above 5. Step 04's profile is back; the reviewer's probe gave home-ring spawns 14.5 a campaign and home blight 25.1% on the same 50 (not re-measured here). The 2-win drop from step 04 is within 50 campaigns' noise (about ±3.5); the far partners' and sites' land is the remaining change.
- Refactor guard re-recorded again (decision 11's second re-record, the same step), against step 04's figures: outcomes unchanged (Source, Source, Source, fallen, fallen); days 433, 416, 328, 359, 29 → 417, 414, 351, 362, 29; battles 26, 24, 18, 22, 4 → 19, 24, 19, 22, 4; spawns 46, 43, 31, 35, 0 → 52, 50, 34, 36, 0; sites captured 6, 4, 3, 5, 0 → 3, 4, 3, 5, 0; blighted at the end 0.299, 0.285, 0.272, 0.280, 0.118 → 0.374, 0.355, 0.274, 0.299, 0.118; partners contacted unchanged; events hash `31f97ff2…d70f9f` → `e4dd3391…6cb394`.
- **For step 09 (a design question, not to tune):** in the real long campaign (no `--near-source`) the outer rings' fixed nests stand and corrupt the far land, so the home country will see about half the spawns it did (home-ring spawns 13.3 → 5.7 a campaign in the near-Source figures before the fix).
