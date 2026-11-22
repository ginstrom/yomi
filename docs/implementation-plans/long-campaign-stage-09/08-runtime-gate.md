# Step 08: The runtime gate

[Plan index](index.md) · [Stage design](../../designs/long-campaign/stage-09-outer-rings.md) (§2 "The simulator", §5 "Performance", §7 Risks) · [Reference](../../designs/long-campaign/reference/campaign-to-level-20.md) §5.7 (the simulator), §6.3 (performance) · [Plan log](log.md)

**Difficulty:** opus / opus. The engineer (model unset) times the simulator on the stage-9 world and, if it is over the gate, profiles `advanceDay` and judges where the time goes and what the options are: a go/no-go judgment. The reviewer (opus) checks that the timings were taken alone and honestly, that the gate was applied as written, and that nothing was optimised without the orchestrator's go-ahead.

> ## CHECKPOINT
>
> **If the 500-campaign `one` run takes more than about 20 minutes, or the 100-campaign long run projects (× 5) to more than about 20 minutes, profile `advanceDay`, write the findings to `log.md`, and STOP: report to the orchestrator with options. Do not optimise, and do not let step 09 start, until the orchestrator decides.**
>
> Under the gate: record the timings and go on (step 09 may start).

## 1. Objective

Decide whether the simulator is fast enough on the 140 × 72 map to measure the stage:
- the cost of a world day (`advanceDay`, and `passTurn` as a whole) on the stage-9 world, against step 01's figure on the stage-8 world;
- the wall-clock time of the 500-campaign early run (`one` with `--near-source`) and of a 100-campaign long run, each alone;
- the long run's peak memory;
- over the gate, a profile naming where the time goes, and the orchestrator's decision before anything else.

## 2. Requirements and context

- **Design §2, "The simulator":** "Runtime is measured. If a 500-campaign run takes more than about 20 minutes, profile `advanceDay` before going on (campaign §6.3)."
- **Design §5, "Performance":** about 4.2 × the hexes. "Measure `advanceDay` per day before and after." Step 01 measured before; this step measures after.
- **Campaign §6.3:** the map is about 4.2 × the hexes and campaigns 3 to 4 × the days and battles; a 500-campaign run "would grow from about a minute to some 15 to 20 minutes". "If it is too slow, the cost is in `advanceDay`'s per-hex loop: the next lever is skipping hexes far from any source of influence, a separate change." That lever changes the rule (what the blight does on far hexes): it is a design question for the user, not this step's.
- **Design §7 risk:** runtime. **Done when** (design): "a 100-campaign long run completes in reasonable time".

### Decisions from the index this step applies (unchanged)

2. **A stand-in Source for the early figures (open question 1, recommended answer).** The design keeps `--ready-level 7` as the early-game guard, but its Source is 122 hexes out at threat 20, which a level-7 party walks to through five rings and cannot beat: the guard, the bands `one`, `company` and `rl10` and the refactor guard would all collapse. The plan adds `--near-source` to the simulator (C2): the campaign's world puts the Source where it stood before this stage (stage 8's (58, 19), shifted to (58, 36)), fought at threat 5 as today; everything else is the stage-9 world. The early figures, the refactor guard and the 50-campaign check run with `--ready-level 7 --near-source` (`rl10` with `--ready-level 10 --near-source`), so they keep their meaning and the bands their values; `bands.md`'s measure names gain the flags (step 02). The long campaign runs without it. **Amended in step 05 (the user's decision, 2026-11-22):** the near-Source world also leaves out the fixed nests above threat 5 (the outer rings'), keeping the far sites and partners, and its land is seeded without them; left in, their corruption drew the spawns away from the home country.

### Shared constraints (from the index)

- **Commands** (local Node 26: prefix `PATH=/opt/homebrew/opt/node@26/bin:$PATH`; or the podman `make` targets):
  - `npm test` (`tsc && vitest run`) is the gate before every commit; `npx vitest run <file>` for one file;
  - `npm run simulate -- <flags>`: each run its own `--out` under `logs/` (gitignored), or `--log none`. **Never run two simulations at once.** Measurements go through the `yomi-measure` agent where a step says so.
- **The refactor guard.** `scripts/simulate.test.ts`, `describe('the refactor guard')`: 5 campaigns from seed 1, each `CampaignRecord` and a SHA-256 of every battle event, against `GUARD_RECORDS`; its args are `--campaign --battles 5 --seed 1 --parties 1 --ready-level 7 --near-source`. **This step must not edit the fixture** and keeps it green; a mismatch means play changed: find the cause and fix it.
- **The 50-campaign check**, before committing (against a hash taken at the start of this step, which must equal step 05's in `log.md`), recorded as "identical" or the diff:

  ```sh
  npm run simulate -- --campaign --battles 50 --seed 1 --parties 1 --ready-level 7 --near-source --out logs/guard-50.jsonl > logs/guard-50.txt
  shasum -a 256 logs/guard-50.jsonl
  ```

  It must be identical: this step changes no rule.
- **The runtime gate** (design §2, campaign §6.3) is **this step, an explicit checkpoint**: if a 500-campaign run takes, or a 100-campaign long run projects to, more than about 20 minutes, profile `advanceDay` and stop for the orchestrator before measuring. Step 09 does not start until this step is done.
- **Determinism.** No step adds, drops or reorders a draw of the world RNG or a battle's RNG except where play is meant to move (steps 04, 05). An approved optimisation here must keep every result byte-identical.
- **Import cycles.** `blight.ts`, `territory.ts`, `worldMap.ts`, `trade.ts` and `buildings.ts` import one another; `loot.ts` imports `worldMap.ts`. Nothing may call across, or read an imported `const` into a top-level table, at module load (a cache added by an optimisation is filled lazily).
- **Commits.** One commit once `npm test` passes and the guard and 50-check are identical, on `long-campaign-stage-09`, without pushing; files staged by path. Message "Stage 9 step 08: the runtime gate". No attribution lines.
- **Docs.** If an approved optimisation renames or removes a name, search the CLAUDE.md files, `.claude/` and `docs/reference/` for it. `.claude/skills/yomi-balance/running.md` says "500 campaigns take about 5 minutes alone": correct it with this step's figures.

## 3. Dependencies and prerequisites

- **Step 05** (and through it 01, 02, 04) must be done: the stage-9 world is complete (board, rings, blight constants, outer nests, sites, partners) and the simulator has `--near-source`, `--log none`, `SOURCE_READY_LEVEL` 18 and `MAX_CAMPAIGN_DAYS` 6000 (C2).
- **Step 01's day-cost figure** and its timing script: step 01 recorded the stage-8 world's cost of a day in `log.md` with `scripts/dayCost.ts` (`newWorld(1)` with the company at home, timing `passTurn` and `advanceDay` over a fixed number of days). Read its execution record for the exact command and arguments; use the same here. If step 01 left the script out of the repository, re-create the same timing as its record describes (outside the repository) and say so.
- Steps 06 and 07 (scenes) do not matter here and may run beside this step; never run a simulation beside another one, theirs included.
- No other simulation may be running: check `pgrep -f scripts/simulate.ts` before each run.

### What this step consumes (copied unchanged from the index)

**C2. The simulator's long-campaign settings and the Source's place (step 02)**

```ts
// src/game/worldMap.ts
export interface SourcePlace { position: Hex; threat: number }
export const SOURCE_PLACE: SourcePlace
//   step 02: { position: offsetToHex(58, 19), threat: 5 } (today's); step 04: { position: offsetToHex(131, 36), threat: SOURCE_THREAT }
export function newWorld(seed?: number, encampmentName?: string, partners: readonly PartnerLocation[] = PARTNERS, source: SourcePlace = SOURCE_PLACE): WorldState
//   the Source location ('blight_source', its name, encounter and loot unchanged) stands at source.position with source.threat, before the blight is seeded

// scripts/simulate.ts
export const SOURCE_READY_LEVEL = 18
export const MAX_CAMPAIGN_DAYS = 6000
export const NEAR_SOURCE: SourcePlace = { position: offsetToHex(58, 19), threat: 5 }   // step 04 changes the position to earlyHex(58, 19), i.e. offsetToHex(58, 36)
// CliArgs gains:
//   log: 'jsonl' | 'none'   (--log jsonl|none, default 'jsonl'; 'none' opens and writes no file; every printed figure is the same)
//   nearSource: boolean     (--near-source; refused without --campaign)
// With nearSource, a campaign's world and its waiting twin's are newWorld(seed, undefined, PARTNERS, NEAR_SOURCE).
// Amended in step 05 (the user's decision): the near-Source world (`nearSourceWorld(seed)`) also leaves out the fixed nests
//   above NEAR_SOURCE.threat (5), keeping the far sites and partners, and seeds its land, held sites and sight without them.
// CampaignRecord gains:
vanguardWalkDays: number     // days the vanguard (a lone party is the vanguard) walked, on any errand; vanguardWalkHomeDays counts those walking home
routeRaidsTold: number       // route_raided events with days 0 (a road turned raided)
routeFlickers: number        // route_restored events after which the same route turns raided again (route_raided, days 0) within ABANDON_AFTER * YIELD_DAYS days
routesRaidedLong: number     // routes raided on ABANDON_AFTER or more yield days in all (route_raided, days >= 1) and not abandoned by the end
// summarizeCampaigns averages them; the printed summary shows them in the trade line and a walking line.
// The refactor guard's args: --campaign --battles 5 --seed 1 --parties 1 --ready-level 7 --near-source.
// .claude/skills/yomi-balance/bands.md, measure names (flags only; no band value changes):
//   one: --campaign --parties 1 --ready-level 7 --near-source · company: --campaign --ready-level 7 --near-source
//   rl10: --campaign --ready-level 10 --near-source · rl12: --campaign --ready-level 12 --near-source
//   rl10-one: --campaign --parties 1 --ready-level 10 --near-source (report only)
//   long: --campaign --log none (count 100 unless told; report only) · long-one: long with --parties 1 · long-tp4: long with --trading-post 4
//   report-only cells: bc7 (bandit_camp 7, L7), sn7, sn9 (spider_nest), sp7, sp9 (salamander_pool), bco9, bco12 (bandit_company),
//   fh15, fh18 (freebooter_host), sg20-18 and sg20 (source_guardians 20 at L18 and L20); each --encounter E --threat T --party-level T unless named
```

### Existing code to know (inspected at `08854d3`; steps 02–05 change it)

- `src/game/worldMap.ts`, `passTurn(world, presences)`: the world's whole day, `advanceDay` (blight) then `updateTerritory` then `updateSight`.
- `src/game/blight.ts`: `advanceDay` loops every hex (`netAt` per hex, then the level and shift update) and ends with `spawn`, which scans every hex for corrupted land; `fields(world)` rebuilds the fixed sources' fields (`addSource` over every hex per source) whenever the source list changes, keyed by `JSON.stringify` of the whole source list every day; `geometry(board)` is cached per board size.
- `src/game/vision.ts` (`updateSight`), `src/game/territory.ts` (`updateTerritory`, `daysToFall`), `src/game/trade.ts` (`roadTo`, a breadth-first search over the board), and the simulator's `nextTarget` (which sorts threatened sites by `daysToFall`) are the other per-day costs that grow with the board.

## 4. Scope and guidance

### 4.1 Time it

Run everything alone, one at a time, the machine otherwise idle; note the head SHA and `git status --short` with each figure.

1. **The day's cost after.** Run step 01's day-cost script on the stage-9 world with the same arguments; record ms a day for `advanceDay` and for `passTurn`, beside step 01's stage-8 figures, and the ratio.
2. **The 500-campaign early run** (the `one` measure):

   ```sh
   npm run simulate -- --campaign --battles 500 --seed 1 --parties 1 --ready-level 7 --near-source --log none > logs/s9-08-one.txt
   ```

3. **The 100-campaign long run** (the `long` measure):

   ```sh
   npm run simulate -- --campaign --battles 100 --seed 1 --log none > logs/s9-08-long.txt
   ```

   Its peak memory: run it under `/usr/bin/time -l` (macOS; `maximum resident set size`) or `/usr/bin/time -v` (Linux), and record it.

Each run may pass 9 minutes: start it detached and wait on it in the foreground, as `.claude/agents/yomi-measure.md` says (`nohup … &`, note the PID, `caffeinate -w <PID>` at a 590,000 ms timeout, repeated until the process is gone; never end the turn while a run is alive). You may hand the runs to the `yomi-measure` agent (measures `one` and `long`, label `s9-08`), but ask it for the wall-clock time and the long run's peak memory, and still run them one at a time. Keep both `.txt` outputs: step 09 may reuse them as its `one` and `long` figures if no code changed between them.

### 4.2 Apply the gate

- **Under the gate** (the `one` run within about 20 minutes, and the long run's time × 5 within about 20 minutes): record the timings in `log.md` and this file's record, correct `running.md`'s run-time line, and finish the step.
- **Over the gate:** profile, then stop.
  1. Profile a short long-campaign run:

     ```sh
     node --cpu-prof --cpu-prof-dir=logs/s9-08-prof scripts/simulate.ts --campaign --battles 20 --seed 1 --log none
     ```

     (or the day-cost script under `--cpu-prof`, to isolate the world's day). Read the profile (Chrome DevTools, or a small script over the `.cpuprofile` JSON summing self time by function).
  2. Name the hot functions with their share of the time: in particular `advanceDay`'s per-hex loop, `netAt`, the fields memo key (`JSON.stringify` of the source list each day) and `addSource` rebuilds, `spawn`'s corrupted scan, `updateSight`, `updateTerritory` and `daysToFall`, `nextTarget`, `roadTo`; and how the cost splits between the world's day and the battles.
  3. Write the findings to `log.md` (a "Step 08" heading: timings, the profile's top functions with shares, the profile's path under `logs/`) and to this file's execution record.
  4. **STOP and report to the orchestrator** with options and a recommendation, for example:
     - **identical-result optimisations** (caching, a cheaper memo key such as a version counter bumped when a source changes, typed arrays, precomputed neighbour or distance tables, an incremental corrupted-hex count), each with the time it is expected to save; they keep the refactor guard and the 50-campaign check byte-identical;
     - **a rule change**, such as skipping hexes far from any source of influence (campaign §6.3's lever): it changes what the blight does, so it is a design question for the user, not this step's;
     - **going on as is**, with longer measuring runs (fewer campaigns, or 100 in place of 500, in step 09).
- **No optimisation without the orchestrator's go-ahead.** If one is approved: make it, keep the refactor guard green with the fixture untouched and the 50-campaign check identical, add a test where it adds logic (a cache's invalidation, say), and time the day's cost and the long run again, before and after, in `log.md`.

### 4.3 Exclusions

- No rule or balance change (if a rule looks wrong, report it). No measurement against the bands: that is step 09 (this step's `one` figure may be read by it, not judged here).
- No scene work. No change to the fixture, the policy snapshot or `bands.md`.

## 5. Verification

- The day-cost figures, stage 8 against stage 9, ms a day for `advanceDay` and `passTurn`, in `log.md`.
- The wall-clock times of the 500-campaign `one` run and the 100-campaign long run, taken alone, and the long run's peak memory, in `log.md`; the two `.txt` outputs kept under `logs/`.
- The gate's verdict stated in words ("under the gate" or "over the gate: profiled, stopped for the orchestrator").
- Over the gate: the profile and its top functions in `log.md`; the orchestrator's decision quoted in the record before anything else is done.
- `npm test` passes; the refactor guard passes with the fixture untouched; the 50-campaign check is identical to step 05's hash.

## 6. Completion criteria

- [ ] Day cost after, against step 01's before, recorded.
- [ ] The 500-campaign `one` run and the 100-campaign long run timed alone, with peak memory for the long run; outputs kept for step 09.
- [ ] The gate applied: under it, timings recorded; over it, `advanceDay` profiled, findings in `log.md`, and the orchestrator's decision obtained before going on.
- [ ] Any optimisation made only with the orchestrator's go-ahead, keeping the guard and the 50-campaign check identical, with before and after timings.
- [ ] `.claude/skills/yomi-balance/running.md`'s run-time line corrected.
- [ ] `npm test` passes; the 50-campaign check identical.
- [ ] One commit, "Stage 9 step 08: the runtime gate" (the log, this record, `running.md` and any approved optimisation), no attribution lines, files staged by path; the index's row 08 updated with status and commit.

## 7. Execution record

**Status: stopped at the checkpoint (over the gate), awaiting the orchestrator's decision.** Figures, loads and the profile in [`log.md`](log.md), "Step 08: the runtime gate" and "Step 08: the profile".

- **Start:** at `22407a9`; `npm test` 102 files, 2611 tests passed; the 50-campaign check's hash `57fdea15…76e53e75`, equal to step 05's (26 of 50).
- **Timed alone** (no other simulation of this repository; other projects' jobs loaded the machine, load averages sampled each minute and recorded):
  - day cost after: `passTurn` 2.099, `advanceDay` 1.854 ms a day (median of three at load about 6.5), against step 01's 0.666 and 0.628: 3.2 × and 3.0 ×; a first set of three, taken as a load spike began (2.4 to 6.5 ms), discarded and recorded;
  - `one` (500): 21:08 wall, peak RSS 316 MB, `logs/s9-08-one.txt` (288 of 500, against the band's 215 to 250: for step 09 to judge);
  - long (100): 20:15 wall, peak RSS 352 MB, `logs/s9-08-long.txt` (0 of 100 beat the Source);
  - a profiled 20-campaign long run: 4:04, `logs/s9-08-prof/`.
- **The gate: over.** The long run × 5 is about 101 minutes; the `one` run is at the gate (21 minutes under load). `advanceDay` profiled: the world's day is about 47% of a long run (`advanceDay` 33%, of which `netAt` 17%, its per-hex `geometry` lookup 6%, the fields memo and rebuilds 6%, `spawn` 2%; `updateTerritory` 4.5%; `updateSight` 1%); the simulator's walking orders' full-board route search (`routeTo`) 17%; battles 19%.
- **No optimisation made.** `running.md`'s run-time line is not yet corrected: it waits for the decision (an approved optimisation changes the figures).
- **Departures:** the runs used `node scripts/simulate.ts` directly (what `npm run simulate` runs) so `/usr/bin/time -l` measures the simulator itself; the 20-campaign profile run doubles as the long run's first projection; this progress commit is separate from the step's final one, so the record of the stop is in git.
- **Orchestrator's decision:** (pending)
