# Step 07: A faster auto-resolve estimate

[Plan index](index.md) · [Stage design](../../designs/long-campaign/stage-10-forging-and-high-tiers.md) · [Auto-resolve design](../../designs/auto-resolve.md) · [Feature record](../../features/long-campaign-stage-10.md) ("Carried forward") · [Stage 9 log](../long-campaign-stage-09/log.md) (the carried estimate note) · [Plan log](log.md)

**Difficulty:** opus / opus. The engineer (model unset) profiles a hot spot whose cause is unknown, makes only changes it can prove leave every estimate and every battle byte-identical, and judges whether to stop at the checkpoint; the reviewer (opus) checks the proof (fixture, snapshot, guard, 50-check) and that nothing result-changing slipped in.

> ## CHECKPOINT
>
> **If, after the byte-identical changes, the estimate for a level-15 party is not shown within about 1 second in the browser, record the figures and the profile in `log.md` and STOP: report to the orchestrator with options and their measured effect (fewer samples, stopping a run of samples once the shown figure is decided, …). Do not change what any estimate says without the orchestrator's (and so the user's) go-ahead.**
>
> Under the target: record the timings and commit.

## 1. Objective

The carried item (feature record, from stage 9): the battle screen's Auto button reads "Auto (…)" for about 2 seconds for parties of level 12 and up, and higher-tier gear (this stage) will make that more common. Stage 9's log notes the estimate runs in 10 ms slices and restarts on each action. This step:
- adds a timing script and a fixture of estimates (before any change);
- profiles where an estimate's time goes;
- makes it faster by changes that keep every estimate byte-identical;
- stops at the checkpoint if that is not enough.

The simulator runs the same engine and policies, so a speed-up there speeds the simulations too: record the 50-campaign check's wall time before and after.

## 2. Requirements and context

- **Carried item 4** (index, "Scope and shared constraints"): the auto-resolve estimate's "(…)" for about 2 s at level 12+. Investigate whether it can be made faster, byte-identical results unless the user agrees otherwise.
- **How the estimate works today** (`src/game/forecast.ts`, inspected): `FORECAST_SAMPLES` (40) sample battles, each a `BattleEngine` built from the setup (world map) or restored from a `snapshot()` (in battle), played by `playStep` with `AUTO_POLICY` against `ENEMY_POLICY` on seeds from `forecastSeed(base, i)`; `workFor` steps it for `FORECAST_SLICE_MS` (10) a frame from `BattleScene.update`; the scene starts a new `Forecaster` whenever `battleForecastBase` (seed, log length) changes, so every action restarts it. Reference: `docs/reference/game.md`, "The auto-resolve estimate"; `docs/reference/scenes.md`, "Auto-resolve".
- **Contracts that must hold** (`src/scenes/CLAUDE.md`): estimates are worked in idle slices from `update`, never in a handler; the estimate reads the engine only through `snapshot()` and draws only from its samples' own seeds; tests wait on the probe's `forecast !== null`.

### Contract produced (copied unchanged from the index)

**C6. A faster auto-resolve estimate (step 07)**

```ts
// Every Forecast is byte-identical to today's for the same (start, base, samples): a fixture of estimates recorded before any change
//   (src/game/forecast.test.ts) holds them; the refactor guard, the policy snapshot and the 50-campaign check stay identical.
// scripts/forecastCost.ts (new, committed): `node scripts/forecastCost.ts [--samples N]` prints the ms an estimate takes
//   for fixed starts: the ready-made party raised to 6, 12, 15 and 18 (as `raisedParty`), each member's worn weapon, shield and armour
//   the same family at tier 2, 3, 4 and 5 (Fine), against bandit_company 9, bandit_company 12, freebooter_host 15, freebooter_host 18.
// Anything that would change an estimate is brought to the orchestrator with figures (decision 15).
```

### Decisions from the index this step applies (unchanged)

14. **The refactor guard** stays identical through steps 02, 03, 04 and 07 (no tier-3+ item, workshop above 3, good or bandit above threat 8 reaches the early campaign); **step 09 re-records it once** (its new record fields and the policy), with old and new figures; step 10 only for a retune the orchestrator approved. **The policy snapshot** is re-recorded in step 02 (bandits at threats 9 and up), only those lines changing.
15. **The auto-resolve estimate is made faster only in ways that keep every estimate byte-identical** (step 07, carried item); a change that alters an estimate (fewer samples, stopping early) is brought to the user with figures, not made.

### Shared constraints (from the index)

- **Commands** (local Node 26: prefix `PATH=/opt/homebrew/opt/node@26/bin:$PATH`; or the podman `make` targets):
  - `npm test` (`tsc && vitest run`) is the gate before every commit; `npx vitest run <file>` for one file;
  - `npm run test:browser` (or `-- -t <name>`) after any scene change; read `e2e/CLAUDE.md` before adding an in-browser test;
  - `npm run simulate -- <flags>`: each run its own `--out` under `logs/` (gitignored) or `--log none`. **Never run two simulations at once** (steps 01, 02, 03, 04, 07, 09 and 10 run them, in that order). Long runs: 100 campaigns take about 10 minutes alone, up to 20 under load.
- **The refactor guard.** `scripts/simulate.test.ts`, `describe('the refactor guard')`, args `--campaign --battles 5 --seed 1 --parties 1 --ready-level 7 --near-source`; `GUARD_RECORDS`, `GUARD_EVENTS_SHA256`. Rules: `.claude/skills/yomi-balance/guards.md`. Steps 02, 03, 04, 06, 07 and 08 must not edit it and keep it green (a mismatch means the step changed play: find the cause and fix it). **Step 09 re-records it** with old and new figures in the doc comment above `GUARD_RECORDS`.
- **The 50-campaign check** before committing, against a hash taken before the step (step 04's, recorded in `log.md`), recorded as "identical" or the diff in `log.md`:

  ```sh
  npm run simulate -- --campaign --battles 50 --seed 1 --parties 1 --ready-level 7 --near-source --out logs/guard-50.jsonl > logs/guard-50.txt
  shasum -a 256 logs/guard-50.jsonl
  ```

  This step must be identical.
- **The policy snapshot** (`src/engine/policies.test.ts`, "the choices of today's encounters"): re-recorded in step 02 only. This step must leave it green and unedited.
- **Determinism.** No step adds, drops or reorders a draw of the world RNG or a battle's RNG. Step 07's changes leave every battle and every estimate byte-identical.
- **Import cycles.** `catalog.ts` and `inventory.ts` import each other: nothing at module load. A cache added here is filled lazily, never at module load.
- **Versions.** `SAVE_VERSION` 31 (step 03), unchanged here; `LOG_SCHEMA_VERSION` unchanged: no event changes shape. A field added to the engine's snapshot would be a save-shape change: avoid it (a cache lives outside `snapshot()`).
- **Commits.** One commit once `npm test` passes and the guard and 50-check are identical, on `long-campaign-stage-10`, without pushing; files staged by path. Message "Stage 10 step 07: a faster auto-resolve estimate". No attribution lines.
- **Docs.** Each step fixes the CLAUDE.md lines its change makes wrong and searches the CLAUDE.md files, `.claude/` and `docs/reference/` for every name it renames or removes. `scripts/claudeMd.test.ts` caps each directory's `CLAUDE.md` at 8 KB (`src/game/CLAUDE.md` is near it).

## 3. Dependencies and prerequisites

- **Step 02** (tiers 3 to 5 in the catalog, C1): the timing starts dress parties at tiers 3 to 5 (`mithril_longsword`, `adamant_breastplate`, `elderwood_shield`, …, via `itemById`).
- **Step 04** done: simulations run one at a time, and 07 is next in the order (01, 02, 03, 04, 07, 09, 10). Take the 50-campaign hash at the start of this step; it must equal step 04's in `log.md`.
- Step 08 (scenes) may run beside this step and loads the machine with in-browser tests: take timings when nothing else heavy runs (check `pgrep -f "simulate|vitest|playwright"`), and say if they were not clean.
- Existing code (inspected at `f3a1102`): `src/game/forecast.ts` (`Forecaster`, `workFor`, `forecast`, `FORECAST_SAMPLES`, `FORECAST_SLICE_MS`, `forecastSeed`, `battleForecastBase`, `worldForecastStart`), `src/engine/autoPlay.ts` (`playStep`, `AUTO_POLICY`, `ENEMY_POLICY`), `src/engine/battleEngine.ts` (`snapshot`, `restore`, `legalActions`, previews, `statsIn`), `src/engine/policies.ts` (`aggressive` and its scoring), `src/scenes/BattleScene.ts` (the forecaster in `update`, its probe's `forecast`), `scripts/simulate.ts` (`raisedParty`, `startingParty`).

## 4. Scope and guidance

### 4.1 Before any change: the fixture and the timings

1. **`scripts/forecastCost.ts`** (C6): for each of the four starts, build the setup with `ENCOUNTERS[id](partyFighters(party), threat)`, run `forecast(start, base)` a few times (after a warm-up), and print the median ms per estimate and per sample, plus the rounds a sample lasts on average. `--samples N` overrides `FORECAST_SAMPLES`. Also time a mid-battle start (a snapshot after a few steps of the level-15 battle). Run it with Node 26, as the other scripts (`node scripts/forecastCost.ts`).
2. **The fixture** (`src/game/forecast.test.ts`, a new `describe`): the exact `Forecast` (samples, wins, heroLost, stalled) for a set of starts and bases covering world-map setups and mid-battle snapshots, parties at levels 6 to 18 in tier kits, several encounters (bandits, a monster nest with abilities and statuses, the Source), and at least one estimate where samples stall. Record the values from today's code, before any change, and commit them with the step. If the fixture runs too long for the domain project, use fewer samples per estimate (`forecast(start, base, samples)`) for most entries and keep one or two at 40. The fixture's strength is its coverage: it must exercise every engine path the changes touch.
3. **Baselines**, in `log.md` under "Step 07": the script's figures; the browser time for a level-15 party (below); the 50-campaign check's wall time and hash.
4. **The browser time:** in a dev build, a level-15 party (debug `level 15 all auto` if step 06 has landed, else `xp` repeated) in a tier-4 kit (`give` and equip) on a threat-15 Freebooter Host (`fight freebooter_host 15`): the time from the battle screen's start (and from an action) to its probe's `forecast` going non-null. A throwaway in-browser test kept outside the repository (as stage 9's play script was) or a stopwatch on the dev server; say which.

### 4.2 Profile

`node --cpu-prof scripts/forecastCost.ts` (or `--cpu-prof` on a vitest run of one estimate), and read where the time goes: the aggressive policy's scoring (`techniqueScore`, `expectedHarm`, area and cast scoring), `legalActions`, the previews it calls, `statsIn` and the aura and trait helpers, `snapshot`/`restore` and cloning, the pathfinder. Write the top entries (self and total time) to `log.md`. Compare a level-6 and a level-15 profile: what grows with level (more abilities and spells to weigh, longer battles, more units).

### 4.3 Byte-identical changes

Candidates, to try in order of measured gain, each kept only if it helps:
- **Memoising pure computations** within a step or a turn in the policies and engine (e.g. effective stats, reachable hexes, a unit's legal targets) where the inputs cannot change in between; caches keyed so that no stale value can be read, never stored in `snapshot()`.
- **Avoiding repeated cloning** (state copies a policy or preview makes and throws away; `restore` per sample cloning more than it needs).
- **A cheaper start per sample:** restore once and copy, if equivalent.
- **A larger slice while the battle screen is idle** (`FORECAST_SLICE_MS`): fewer wall seconds at the cost of frame time; measure the frame rate on the battle screen and say what the trade is. Results are unchanged by construction.
- **Samples in a Web Worker** (a Vite worker): the estimate runs at full speed off the main thread. Weigh it: the worker must receive the snapshot as plain data, the tests in jsdom and the in-browser tests must still see `forecast` on the probe, and `src/scenes/CLAUDE.md`'s "worked in idle slices from `update`" would need rewording. Bring it to the orchestrator as an option rather than build it if the other changes reach the target.

**Not allowed without the orchestrator's go-ahead** (decision 15): fewer samples, a different seed derivation, stopping a run of samples early, a different policy for the samples, anything that can change a `Forecast`.

Each kept change is proved by: the fixture equal; `src/engine/policies.test.ts` and the refactor guard green and unedited; at the end, the 50-campaign check identical. Add focused tests for any cache's invalidation.

### 4.4 Judge, and record

- Under about 1 s for the level-15 party in the browser: commit, with the before and after figures in `log.md` (script, browser, 50-check wall time) and the execution record.
- Over it: the checkpoint. Report the figures, the profile and the options with their measured effect on time and on the estimate (e.g. at 20 samples, the figure shown differs from 40's in N of the fixture's estimates).

### 4.5 Exclusions

No rule change, no new policy, no change to how many samples or which seeds, no change to the forecast's words or the Auto button, no engine snapshot field. No balance work.

### 4.6 Docs

`docs/reference/game.md`, "The auto-resolve estimate", and `docs/reference/scenes.md`, "Auto-resolve": the timing script, the fixture, any cache or slice change and the timings. `src/scenes/CLAUDE.md` and `src/game/CLAUDE.md` only if a line becomes wrong (a worker or slice change would touch the scenes' "Auto-resolve" contract line).

## 5. Verification

- `npx vitest run src/game/forecast.test.ts`: the fixture passes before and after every change (recorded before any change).
- `npm test`: the policy snapshot and the refactor guard pass, unedited.
- The 50-campaign check identical to step 04's hash; its wall time before and after in `log.md`.
- `node scripts/forecastCost.ts` before and after; the browser time for the level-15 party before and after.
- `npm run test:browser -- -t <battle auto-resolve tests>` if a scene file changed (the slice, a worker).

## 6. Completion criteria

- [ ] `scripts/forecastCost.ts` committed; the estimate fixture committed and recorded before any change.
- [ ] The profile's findings and the timings before and after in `log.md`.
- [ ] Every kept change byte-identical: fixture, policy snapshot, refactor guard and 50-campaign check unchanged.
- [ ] The level-15 estimate under about 1 s in the browser, or the checkpoint reached and the options reported to the orchestrator.
- [ ] Docs updated where they describe the estimate.
- [ ] One commit, "Stage 10 step 07: a faster auto-resolve estimate", files staged by path, no attribution lines; the index's row 07 updated with status and commit.

## 7. Execution record

**Engineer (opus), 2026-11-23.** Status: done; the checkpoint was not reached (under about 1 s, judged from the frames the estimate takes; see below).

- **Before any change:** `scripts/forecastCost.ts` and the estimate fixture (`forecast.test.ts`, "the estimate fixture (stage 10 step 07)": 18 starts, each its exact `Forecast` and a sha256 of every sample's event log, recorded twice from the unchanged code, the same both times) committed as `2cdd885`. 50-campaign hash at the start: `57fdea15…e75`, equal to step 04's.
- **Profile:** `legalActions` was 84% of an estimate (area spells tried at every board hex with `statsOf` read twice a hex; `areaTouches` building a Set of hex keys; the pathfinder); the figures, and level 6 against level 15, in `log.md`.
- **Kept, all byte-identical:** stats read once in `legalActions` (`castAimSuits`, `areaAimSuits`); a burst's touch by distance (`areaCovers`); `reachableHexes` with linked routes, shared provoked sets and numeric keys (`hexIndex`, exported); `reachable` reading the blockers and the foes that could react once (`canReact`, `leavesSideOf`); `PolicyContext.legalFor`, given by `autoPlay` (whose `legal` is now a getter) and read by `aggressive`. Dropped: a plain-BFS path for searches no foe could provoke (no gain).
- **Results:** about 6× on the level-15 estimate (`forecastCost.ts` CPU 3038 → 459 ms at one load, 4097 → 870 at a heavier one); in the browser 367–466 frames → 50–98 from the battle's start, 134–239 → 40–49 after an action (0.7 to 1.6 s at 60 fps; headless Chromium itself drew only 12 to 20 fps on the loaded machine, so its wall clock, 2.5 to 8 s after, is not a player's). The 50-campaign check 37.3 → 25.3 s.
- **Identity proof:** fixture unchanged; policy snapshot and refactor guard green, unedited; 50-campaign hash identical at the end. `npm test` 105 files, 2,702 tests; `npm run test:browser -- -t "Auto|auto-resolve|estimate"` 19 pass.
- **Tests added** (after their code, the fixture being the guard while it changed): `legalFor` equals `legal` filtered at every step of ten battles, and `aggressive` chooses the same from either without listing `legal` (`autoPlay.test.ts`); a burst touches exactly the units on `areaOf`'s hexes (`battleEngine.test.ts`).
- **Deviations:** `forecastCost.ts` also prints CPU time (`process.cpuUsage`), and `--runs` (default 5), as the machine's load made wall clock alone unreadable. The browser timing was a throwaway in-browser test (kept out of the repository) with the save's kit edited before Continue, since the debug console has no equip; it measured frames, not a stopwatch.
- **For later steps:** the simulator is faster too (step 09 and 10's long runs). `legalFor(u)` must stay `legal`'s actions of `u` without end_turn, in order (`src/engine/CLAUDE.md`). `hexIndex` is exact only within 32767 of the origin, ample for both maps. A further option if the estimate grows again: a larger `FORECAST_SLICE_MS`, or a worker; and a policy that weighs moves lazily would skip most pathfinding.
- **Docs:** `docs/reference/game.md` ("The auto-resolve estimate": cost, script, fixture), `docs/reference/scenes.md` (the battle's estimate cost), `docs/reference/battle.md` (`aggressive`'s `legalFor`, `reachable`'s reactors), `src/engine/CLAUDE.md` (the policy signature).

**Review round 1 (opus): clean**, with one note acted on. The fixture did not see the pathfinder's tie order: the reviewer flipped the reduce's `<` to `<=` and `push` to `unshift` for the routes kept at a hex, and all 18 entries still passed (the refactor guard caught it). Added to `src/grid/hex.test.ts`: `reachableHexes` against a copy of its version at `2cdd885` (`reachableHexesBefore`), the whole map compared in order, on 400 seeded 14 × 10 boards with walls and 1 to 6 foes provoking on leaving their side (3, 6 and 10 steps), 400 with seeded provokers of overlapping, repeated and unordered ids so that routes tie (more than 1,000 tied hexes, counted by the old algorithm), and 100 with no provokers. Both of the reviewer's mutations fail it (checked by hand, then restored). `npm test` after: 107 files, 2,718 tests pass.
