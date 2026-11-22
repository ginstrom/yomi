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

## Step 08: the runtime gate (2026-11-22/23)

All at `22407a9` (step 05's review round), the only dirty file the plan index (row 08 marked in progress). Each run alone: no other simulation of this repository (`pgrep -f "node.*scripts/simulate.ts"` empty before each), the orchestrator running nothing else here. Unrelated jobs from other projects (Steam, a podman VM, another project's vitest runs, two `while :; do :; done` shells) loaded the 10-core machine throughout: load averages, sampled each minute, are given with every figure. Node 26; the simulator run as `node scripts/simulate.ts …` (what `npm run simulate` runs) under `/usr/bin/time -l`.

- **50-campaign check at the start:** SHA-256 `57fdea1553a35b1af0e33b74a11ea9fe0a0e2f62ef9e5c80972af59276e53e75`, equal to step 05's; 26 of 50. Wall 1:50 (load 7.3 to 7.6).
- **Day cost after** (`node scripts/dayCost.ts`, 1000 days, seed 1; board 140 × 72, 60 monster locations at the end). Two sets of three:

  | Set | Load (1 min) | `passTurn` ms a day | `advanceDay` ms a day |
  | --- | --- | --- | --- |
  | First (23:18) | 7.3 → 13.8 (rising) | 2.438, 4.029, 6.506 | 2.277, 5.755, 6.290 |
  | Second (23:46) | 6.8 → 6.1 | 2.149, 2.005, 2.099 | 1.854, 1.970, 1.809 |

  The first set ran into a load spike and is discarded. **After (second set, median): `passTurn` 2.099 ms, `advanceDay` 1.854 ms a day**, against step 01's stage-8 0.666 and 0.628 ms: **3.2 × and 3.0 ×** (the board is 4.2 × the hexes; step 01's 60 × 40 world ended with 24 monster locations, this one with 60).
- **The `one` run** (`--campaign --battles 500 --seed 1 --parties 1 --ready-level 7 --near-source --log none`, `logs/s9-08-one.txt`): **21:08 wall** (1268 s; user 1344 s), 23:20:00 to 23:41:08, load (1 min) 5.1 to 32.8, mostly 6 to 14 (`logs/s9-08-one.load`). Peak RSS 316 MB. Figures, not judged here (step 09): 288 of 500 beat the Source (the band `one` is 215 to 250, Now 233), 331 days, 18.8 battles, 33.3 spawns, 27% blighted at the end.
- **A 20-campaign long run under the profiler** (`node --cpu-prof --cpu-prof-dir=logs/s9-08-prof scripts/simulate.ts --campaign --battles 20 --seed 1 --log none`, `logs/s9-08-prof20.txt`): 4:04 wall (244 s), load 7.6 to 17.8; peak RSS 342 MB.
- **The long run** (`--campaign --battles 100 --seed 1 --log none`, `logs/s9-08-long.txt`): **20:15 wall** (1214.5 s; user 1291 s), 23:46:48 to 00:07:03, load (1 min) 5.6 to 24.1, mostly 6 to 13 (`logs/s9-08-long.load`). **Peak RSS 352 MB** (`maximum resident set size` 352,223,232 bytes). × 5 projects 500 long campaigns to about **101 minutes**. Figures (report only): 0 of 100 beat the Source, 99 fell, 1 out of days; 1602 days, 50.3 battles, 60.1 spawns a campaign; 9.7 parties wiped a campaign; battles won by threat: 7 0.956, 9 0.808, 12 0.485, 15 0.739, 18 0.038 (79 fought), 20 0 (18 fought); levels at the end 4.8 lowest, 5.9 highest on average.
- **The gate: over.** The long run's time × 5 (about 101 minutes) is five times the gate's "about 20 minutes"; the `one` run (21:08 under load) is at the gate, a little over. Profiled; stopped for the orchestrator.

### Step 08: the profile

`logs/s9-08-prof/CPU.20261122.234137.18481.0.001.cpuprofile` (the 20-campaign long run above; 243.8 s sampled). Shares are of the whole run; "inclusive" counts a sample once if the function is anywhere on its stack. Summed by a script over the profile's JSON (kept outside the repository).

| Where | Inclusive | Notes |
| --- | --- | --- |
| The world's day (`passDay` in `company.ts`) | 46.7% | |
| · `advanceDay` (blight) | 32.8% | self 12.0% (the per-hex loop: `pinned.has`, the level and shift update, `before` copy) |
| · · `netAt` | 17.3% | self 8.5%; calls `geometry(world.board)` once a hex (6.3%, building the key string `${cols}x${rows}` and a `Map` lookup 10,080 times a day) and `hexDistance` once a hex per party (4.2% all callers) |
| · · `fields` (memo key and rebuilds) | 6.0% | `addSource` rebuilds 4.1%, the rest the `JSON.stringify` key and `sources` (self 1.5%) |
| · · `spawn` (corrupted scan) | 1.8% | |
| · `updateTerritory` (with `daysToFall`) | 4.5% | `daysToFall` 4.2% |
| · `partyDay` | 5.2% | |
| · `updateSight` | 0.8% | |
| The simulator's orders (`carryOut`) | 46.4% | |
| · `routeTo` (`worldMap.ts`) | 17.4% | a full-board breadth-first search (`reachableHexes` with `maxSteps` the board's size, a path array kept for every hex) each time a party is given a walking order (`setOrder` ← `startTravel`); `reachableHexes`' self time 19.0% is mostly this (13.8% + 1.0%) |
| · battles (`playOut` in `autoPlay.ts`) | 19.4% | of which `legalActions` 15.8%, `reachable` (the battle's move search, also `reachableHexes`) 9.1% |
| · `roadTo` (trade) | 1.3% | |
| · `nextTarget` | 0.0% | |
| Garbage collection | 5.2% | |

Top self time: `reachableHexes` 19.0%, `advanceDay` 12.0%, `netAt` 8.5%, `geometry` 6.3%, GC 5.2%, `hexDistance` 4.2%, `passTurn` 3.1%, `routeTo` 2.4%, `partyDay` 2.0%, `perkBonus` 1.7%, `fields` 1.5%, `passable` 1.5%, `addSource` 1.5%.

So the time goes to the world's day (about 47%, two thirds of it `advanceDay`), the walking orders' route search (about 17%) and the battles (about 19%).

### Step 08: the approved optimisations (2026-11-23)

The user chose option 1: the optimisations that leave every result byte-identical, then go on with 100-campaign long runs in step 09.

- **Made:** `routeTo` uses a new `shortestPath` (`hex.ts`): a breadth-first search with a parent per hex, in `HEX_DIRECTIONS` order, stopping at the target (the path `reachableHexes` gave; a test compares the two on 300 boards with random walls). `advanceDay` works the day's geometry, fields, party strengths, neutral hexes and growth out once (`dayOf`) and passes them to `netAt`; pinned and neutral hexes are `Uint8Array`s. The fields memo compares the sources list element by element instead of a `JSON.stringify` key.
- **Changed from the brief:** not a version counter. A counter would have to be bumped at every place that changes a source (locations, their threat, held sites, improvements, the shrine, towers, the lodge, roads; tests change some directly), and one missed bump would leave stale fields silently, so it cannot be byte-identical by construction. The element-wise comparison is identical by construction (two finite numbers stringify alike exactly when they are equal). A test checks that the fields follow each kind of source change, against a world never memoised.
- **Identity:** `npm test` passes the refactor guard and the policy snapshot with `scripts/simulate.test.ts` and `src/engine/policies.test.ts` untouched (the only failure is `scripts/records.test.ts` on the feature record's State section, from commit `60d1a5f`, not this step). 50-campaign check `57fdea1553a35b1af0e33b74a11ea9fe0a0e2f62ef9e5c80972af59276e53e75`, **identical** (0:44 wall, load 7.4 to 9.5). The 20-long-campaign summary, the 100-campaign long summary and the 500 `one` summary are each byte-identical (`diff`) to the runs before.
- **After** (at `60d1a5f` plus the change; load averages sampled each minute):

  | Measure | Before | After | Load (1 min) after |
  | --- | --- | --- | --- |
  | `passTurn`, ms a day (median of three) | 2.099 | **0.833** (0.836, 0.833, 0.720) | 9.8 to 10.3 |
  | `advanceDay`, ms a day | 1.854 | **0.712** (0.746, 0.712, 0.616) | 9.8 to 10.3 |
  | 50-campaign check | 1:50 | 0:44 | 7.4 to 9.5 |
  | 20 long campaigns, profiled | 4:04 | 1:51 | 7.1 to 10.8 |
  | 100 long campaigns (`logs/s9-08-long-after.txt`) | 20:15, 352 MB | **10:21, 360 MB** | 6.8 to 15.1, mostly 7 to 10 |
  | 500 `one` (`logs/s9-08-one-after.txt`) | 21:08, 316 MB | **7:44, 225 MB** | 5.9 to 8.2 |

  Against step 01's stage-8 0.666 and 0.628 ms a day: 1.25 × and 1.13 ×. The long run × 5 still projects 500 long campaigns to about 52 minutes; step 09 runs 100, as the user chose.
- **The profile after** (`logs/s9-08-prof-after/CPU.20261123.001530.37798.0.001.cpuprofile`, 110.9 s sampled): the world's day 37.4% (`advanceDay` 20.9%: `netAt` 11.0%, `fields` 9.3% of which `addSource` rebuilds 8.0%, `spawn` 3.5%; `updateTerritory` 6.6%; `partyDay` 8.0%; `updateSight` 1.3%); `routeTo` 2.4%; battles (`playOut`) 37.7%, where most of `reachableHexes`' remaining 13.1% self time now is (the battle's move search); garbage collection 1.5% (5.2% before).
- `running.md`'s run-time line and the root `CLAUDE.md`'s command table corrected (about 8 minutes for 500 early campaigns, about 10 for 100 long ones).

### Step 08 review round 1 (2026-11-23)

Clean, with three non-blocking findings, all fixed in one commit: (1) the fields memo kept the world's own source hexes, so a position changed in place would have gone unnoticed (the old string key caught it); it now keeps copies, and `blight.test.ts`'s memo test, which now probes beside every lair, changes a position in place (red before the fix); (2) `running.md`: 500 early campaigns log some 300 MB (the 50-campaign check writes 30.6 MB), not 70 MB; (3) the root `CLAUDE.md`'s command table: about 8 minutes for 500 early campaigns and 10 for 100 long ones. After: `npm test` 102 files, 2614 tests passed, fixtures untouched; 50-campaign hash `57fdea1553a35b1af0e33b74a11ea9fe0a0e2f62ef9e5c80972af59276e53e75`, identical (0:50, load 17.2).

Step 08 re-review: clean (ee3a675); the full npm test timed out under load (5 s timeouts in encounters/party tests), and the files pass alone or with a longer timeout.

## Step 07

07 | engineer sonnet, reviewer opus | blight layer tiled (8 × ≤2048 px, redraw per changed tile), far partners' sprites mapped, spawn by band, scroll to the far edge verified | refresh ~42 ms, frame ~46 ms vs 48 ms before at 140 × 72 (headless, loaded) | review clean (screenshot diff: 0 pixels differ at home, no seam), 1 round, 3 non-blocking fixes | df460bc, aafea7d

## Step 09: measure and judge (2026-11-23)

Seed 1, one run at a time. No code changed since step 08's runs at `22407a9` but the byte-identical review fix (`ee3a675`) and step 07's scenes (`d628e7a`), so step 08's `one` and `long` runs are reused. Runs by `yomi-measure` at `ee3a675` (early) and `d628e7a` (long, cells); the diagnostics (not kept) by the engineer. Logs under `logs/` (gitignored). Wall times on a machine loaded by other work (load 6 to 30).

### The early figures (`--near-source`), against step 01's baseline

| Measure | Figure | Band | Baseline (step 01) | Change | Days | Battles | Heroes dead | Spawns | Blighted at end | Sites captured / lost | Wall | Log |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `one` (reused) | **288** | 215–250, **out by 38** | 233 | +55 | **331** (band 243–297, **out by 34**) | 18.8 | 1.2 | 33.3 | 27% | 3.5 / 0.1 | 7:44 | `s9-08-one-after.txt` |
| `company` | **289** | 220–260, **out by 29** | 232 | +57 | 334 | 18.9 | 1.2 | 33.6 | 27% | 3.5 / 0.1 | 19:09 | `s9-09-company.txt` |
| `rl10` | 409 | 370–420, in | 433 | −24 | 530 | 33.9 | 1.3 | 62.8 | 32% | 5.3 / 0.6 | 23:03 | `s9-09-rl10.txt` |
| `rl10-one` | 409 | report only | — | — | 496 | 30.7 | 1.0 | 55.8 | 32% | 5.0 / 0.5 | 14:40 | `s9-09-rl10-one.txt` |
| `rl12` | 407 | report only | — | — | 644 | 45.9 | 1.6 | 78.0 | 33% | 6.6 / 1.0 | 18:24 | `s9-09-rl12.txt` |

- `rl10` and `rl12` fight spawns past the home rings (`rl10`: 2378 battles at threat 7, 233 at 9; `rl12`: 4537 at 7, 1757 at 9, 4 at 12): under `--near-source` the outer rings have no fixed nests but blight spreads there and spawns land there.
- **Cause of the rise in `one` and `company`** (diagnostics, `one` with `SPAWN_DIVISOR` changed locally and put back, `--log none`): step 04 attributed about +2 of 50 to the bigger board and +4 to the divisor (200 → 840). At 500 campaigns:

  | `SPAWN_DIVISOR` | Campaigns | Source wins | Days | Spawns | Blighted at end | Heroes dead | Log |
  | --- | --- | --- | --- | --- | --- | --- | --- |
  | 840 (today) | 500 | 288 (57.6%) | 331 | 33.3 | 27% | 1.2 | `s9-08-one-after.txt` |
  | 400 | 500 | 244 (48.8%) | 303 | 53.2 | 32% | 1.1 | `s9-09-div400-500.txt` |
  | 300 | 500 | 248 (49.6%) | 298 | 56.1 | 33% | 1.2 | `s9-09-div300-500.txt` |
  | 840 | 200 | 119 (59.5%) | 335 | 34.0 | 28% | — | `s9-09-div840.txt` |
  | 400 | 200 | 100 (50.0%) | 302 | 52.6 | 32% | — | `s9-09-div400.txt` |
  | 200 | 200 | 107 (53.5%) | 295 | 59.2 | 34% | — | `s9-09-div200.txt` |

  So most of the rise is the divisor (fewer spawns, so fewer home nests and longer walks, the party levelling on threat 5 nests before the Source); 300 to 400 brings wins into the band, but days stay at or above its top (the board's longer walks). Not retuned (the user's decision).

### The long campaign (100, ready level 18, `--log none`)

| Measure | Source | Fell | Out of days | Days | Battles | Spawns | Blighted | Sites cap. / lost | Walked (home) | Wipes | Recruits; hall | Levels at end (lowest, highest) | Wall | Log |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `long` (reused) | 0 | 99 | 1 | 1602 | 50.3 | 60.1 | 62% | 8.1 / 1.8 | 1457.8 (172.2) | 9.7 | 47.5; 3.7 | 4.8, 5.9 | 10:21 | `s9-08-long-after.txt` |
| `long-one` | 0 | 100 | 0 | 1322 | 52.8 | 71.2 | 43% | 10.5 / 2.8 | 1058.1 (253.8) | 1.0 | 5.4; 2.7 | 11.0, 14.1 | ~8:04 | `s9-09-long-one.txt` |
| `long-tp4` | 0 | 88 | 12 | 2469 | 76.8 | 84.7 | 60% | 12.3 / 3.8 | 2284.3 (207.8) | 14.9 | 75.5; 4.5 | 6.0, 6.5 | 11:55 | `s9-09-long-tp4.txt` |

Battles to level (campaigns reaching it): `long` 5: 6.8 (84), 10: 28.5 (55), 15: 54.3 (44), 20: — (0); `long-one` 6.8 (84), 28.9 (55), 53.8 (51), — (0); `long-tp4` 7.0 (99), 28.6 (83), 50.8 (76), 93.0 (1).

Deaths by level: `long` 2 (12), 3 (40), 4 (18), 5 (48), 6 (40), 7 (40), 8 (30), 9 (15), 10 (17), 11 (3), 12 (3), 13 (7), 14 (2), 15 (21), 16 (29), 17 (16), 18 (3), 20 (1), 21 (1); `long-one` 2 (12), 3 (101), 4 (16), 5 (26), 6 (44), 7 (39), 8 (31), 9 (13), 10 (11), 11 (8), 12 (2), 13 (12), 14 (3), 15 (20), 16 (23), 17 (9), 18 (6), 19 (4), 21 (2).

Threat table (battles, win rate):

| Threat | `long` | `long-one` | `long-tp4` |
| --- | --- | --- | --- |
| 1 | 200, 1.000 | 201, 1.000 | 200, 1.000 |
| 2 | 367, 0.992 | 370, 0.992 | 462, 1.000 |
| 3 | 316, 0.959 | 317, 0.959 | 421, 0.998 |
| 4 | 461, 0.998 | 455, 0.998 | 582, 0.998 |
| 5 | 517, 0.998 | 498, 1.000 | 672, 0.997 |
| 7 | 780, 0.956 | 764, 0.970 | 1057, 0.965 |
| 9 | 863, 0.808 | 747, 0.992 | 1235, 0.893 |
| 12 | 1133, 0.485 | 855, 0.996 | 1657, 0.619 |
| 15 | 295, 0.739 | 863, 0.997 | 1242, 0.558 |
| 18 | 79, 0.038 | 164, 0.982 | 93, 0.108 |
| 20 | 18, 0 | 45, 0 | 58, 0 |

Diagnostic probe of `long` (the simulator's own loop, the same 100 campaigns: 60.1 spawns, 0 wins, as the run): spawns by threat a campaign 2: 0.12, 3: 1.34, 4: 3.02, 5: 3.78, 7: 6.04, 9: 6.71, 12: 8.21, 15: 9.41, 18: 21.45; **home rings (threat ≤ 5) 8.3 a campaign** over 1602 days (the near-Source `one`: about 14.5 over 325 days, step 05's probe). The vanguard's first loss: threat 7 Bandit Camp 23, threat 15 Freebooter Host 20, the Source 15, threat 3 Bandit Camp 13, threat 12 Bandit Company 13, threat 9 Bandit Company 8, others 8; its lowest level then 10.0 on average. Lost of fought, vanguard: threat 9 166/863, 12 584/1133, 15 77/295, 18 76/79, 20 18/18. `long-one`'s losses (one each) are its first losses: the Source 45, threat 7 23, threat 3 13, threat 9 6, 2/12/15/18 3 each, 4 1.

### Routes (`long-tp4`, carried items 2 and 3)

3.42 partners contacted, 3.87 routes opened, 2.57 raided (runs), 2.57 raids told, 2.48 abandoned a campaign; **0.00 flickers, 0.00 routes raided 6+ yield days and kept**. Gold by source a campaign: sites 1973, market 1922, routes 3307 (26% of 12,671), sales 5469. `long`: 1.53 contacted, 1.45 opened, 0.85 raided, 0.83 abandoned, 0 flickers, 0 raided long; routes 953 of 6217 gold (15%). `long-one`: 1.77 contacted, 0.83 opened, 0.10 raided, 0.10 abandoned, 0, 0. Which partners were contacted is not in the summary (not counted).

### The cells (500 battles, seed 1)

| Cell | Wins | Band | Now | | Cell | Wins (report only) |
| --- | --- | --- | --- | --- | --- | --- |
| gr3 | 500 | ≥ 470 | 500 | | bc7 | 1 |
| bc3 | 455 | 400–470 | 455 | | sn7 | 99 |
| bc4 | 454 | 430–490 | 454 | | sn9 | 29 |
| bc5 | 494 | 420–490 (Now above) | 494 | | sp7 | 290 |
| sn5 | 451 | 410–480 | 451 | | sp9 | 73 |
| sp5 | 475 | 410–480 | 475 | | bco9 | 1 |
| sg7 | 0 | 0 within 40 | 0 | | bco12 | 0 |
| sg10 | 1 | above 2 (accepted) | 1 | | fh15, fh18 | 0, 0 |
| tl5 | 0 | report only | 0 | | sg20-18, sg20 | 0, 0 |

Every standard cell equals "Now".

### The Source at 20 (decision 3)

Unwinnable at the stage's count (0 of 100 `long`, 0 of 500 `sg20-18`). Tried locally, then put back:

| Count at 20 | `sg20-18` | 50 long campaigns (`--campaign --battles 50 --seed 1 --log none`) | Log |
| --- | --- | --- | --- |
| 5 (stage) | 0 of 500 | — (100: 0) | `s9-09-sg20-18.txt` |
| 4 | 0 of 500 (party hit rate 0.26, deals 47, takes 380) | 0 of 50 (10 battles at 20, all lost) | `s9-09-sg20-18-c4.txt`, `s9-09-long50-c4.txt` |
| 3 | 0 of 500 (hit rate 0.24, deals 52) | 0 of 50 | `s9-09-sg20-18-c3.txt`, `s9-09-long50-c3.txt` |

Cause: foe scaling, not the count. At threat 20 each guardian is raised from its native level 1 by `FOE_AC_PER_LEVEL` and `FOE_TO_HIT_PER_LEVEL` (5 each a level): the Horror has AC 110, to-hit 165 and 1440 HP, its guards AC 105 to 115, against a level-18 ready-made party's to-hit 100 to 109 and AC 16 to 34. The Freebooter Host at 18 (bandits, scaled by gear) has AC 6 to 54. Even the Horror alone could not be hit. Stopped at 3 and brought to the orchestrator; the count is unchanged (5).

- No code changed; `npm test` 103 files, 2621 tests passed. The 50-campaign check not rerun (no code change since step 08's identical `57fdea15…`).
