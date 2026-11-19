# Step 02: The estimate's domain module

[Plan index](index.md) · [Design](../../designs/auto-resolve.md) (§4.6 "The estimate", §5.5, §7.1 `forecast.test.ts`; R13, R14, R15; A10, A11) · [Feature record](../../features/auto-resolve.md)

**Suggested engineer:** opus (leave the model unset). This module decides that the estimate is deterministic and never touches the real battle, its streams, the world's RNG or `Math.random`; the tests that prove it are the step's substance.

## 1. Objective

A Phaser-free module, `src/game/forecast.ts`, that estimates how auto-resolve would go: it plays `FORECAST_SAMPLES` (40) copies of a battle to their end with `playStep`, each on dice of its own, and counts the wins, the samples in which a hero fell, and the samples that dragged past the round limit. It works one engine step at a time (`Forecaster.step`), so that a scene can run it in slices of a few milliseconds a frame (`workFor`), and it gives the words the scenes show (`forecastFigure`, `forecastLabel`, `forecastHint`). No scene uses it yet: steps 05 and 06 wire it into the battle screen and the world map.

## 2. Requirements and context

- **R13.** The estimate is computed by a Phaser-free domain module from `FORECAST_SAMPLES` (40) battles played out with the shared loop from the battle as it stands: on the world map from the encounter's setup, mid-battle from an engine `snapshot()` restored with another stream.
- **R14.** Estimating never draws from, steps or changes the real battle's engine, its streams, the world's RNG, `Math.random` or the page's seed, and does not change which seed the real battle gets. Its sample seeds are derived by hashing from the battle (mid-battle: its seed and how far it has gone; on the world map: the location, the party and the day) with a salt, so the figure is deterministic for a given battle state.
- **R15** (this step's part). Work is done one engine step at a time; how it is sliced never changes the figure. `FORECAST_SLICE_MS` (10) is the budget a frame the scenes will pass to `workFor`.
- **A10.** The same battle state gives the same estimate every time; the real engine's snapshot is identical before and after an estimate; the real battle stepped afterwards gives the log it gives with no estimate made.
- **A11.** An estimate's win share matches the share of its samples won, counted independently in a test by stepping each sample's engine by hand.
- **What is shown** (design §4.6): the win chance (share of samples won) and the chance a hero dies (share of samples that ended with at least one hero fallen: losses, and wins that cost a hero). Both rounded to the nearest 5%, ">95%" only when every sample came out that way, "<5%" only when none did, otherwise clamped to 5%–95%, so that 40 samples never claim certainty.
- **Feature record decisions:** 40 samples; show the chance a hero dies (not an average of heroes lost).
- **Index decision 2 (unchanged):** `forecastFigure(share, of)`: `share` is a count of samples (wins, or samples with a hero lost), `of` the samples. The design's name is kept; its meaning is fixed here (C2).
- **Index decision 3 (unchanged):** `battleForecastBase` reads `battle_start`'s seed itself (0 when the log has none); `src/game/` must not import `battleSetup.ts`'s `battleSeed` from the scenes.

### Contract C1, consumed (copied unchanged from the index; produced by step 01)

```ts
import type { BattleEngine, BattleEvent, Side } from './battleEngine.ts'
import { POLICIES, type PolicyName } from './policies.ts'
import type { RNG } from '../combat/combat.ts'

/** The policy the player's side is played by when a battle is auto-resolved. */
export const AUTO_POLICY: PolicyName = 'aggressive'
/** The policy the game's enemy plays (moved here from BattleScene). */
export const ENEMY_POLICY: PolicyName = 'aggressive'
/** Rounds auto-resolve plays before handing an unfinished battle back to the player. */
export const AUTO_ROUND_LIMIT = 50

export interface PlayOutOptions {
  policies: Record<Side, PolicyName>
  /** Each side's policy stream; the simulator passes one stream for both. */
  rngs: Record<Side, RNG>
  /** No step is taken once the round is past this one. */
  lastRound: number
}
export interface PlayOut {
  /** Every event the steps produced, in order. */
  events: BattleEvent[]
  /** True when the battle ended; false when it stopped past `lastRound`. */
  over: boolean
}

/** One step: false (and nothing done) when the phase is 'over' or the round is past `lastRound`; else steps the side's policy and returns true. */
export function playStep(engine: BattleEngine, options: PlayOutOptions): boolean
/** Steps `engine` with each side's policy until the battle is over or the round passes `lastRound`. */
export function playOut(engine: BattleEngine, options: PlayOutOptions): PlayOut
```

- `playStep`'s body is the simulator's: `state = engine.getState()`; stop if `state.phase === 'over'` or `state.round > lastRound`; else `engine.step(POLICIES[policies[state.phase]]({ state, legal: engine.legalActions(), rng: rngs[state.phase] }))`. It never abandons and draws nothing itself.
- `playOut` loops `playStep`; `over` is `engine.getState().phase === 'over'` when it stops.

### Contract C2, produced (copied unchanged from the index)

```ts
/** Sample battles an estimate plays. */
export const FORECAST_SAMPLES = 40
/** The most time an estimate takes a frame, in ms. */
export const FORECAST_SLICE_MS = 10

/** Where the samples start: a battle not yet begun (the world map) or one in progress. */
export type ForecastStart = { setup: BattleSetup } | { snapshot: BattleSnapshot }

export interface Forecast {
  samples: number
  /** Samples the player's side won. */
  wins: number
  /** Samples that ended with at least one player-side unit at hp <= 0. */
  heroLost: number
  /** Samples stopped past the round limit (counted as not won). */
  stalled: number
}

/** Sample `i`'s seed: a 32-bit unsigned hash of `base`, `i` and a fixed salt. */
export function forecastSeed(base: number, i: number): number
/** The base for a battle in progress: a hash of battle_start's seed (0 if none) and the log's length. */
export function battleForecastBase(log: readonly BattleEvent[]): number
/** The battle Attack would start for `party` where it stands, and a hash of the location's id, the party's id and world.turn; null when it stands on no monster location. */
export function worldForecastStart(game: GameState, party: Expedition): { start: ForecastStart; base: number } | null

/** An estimate worked one engine step at a time. */
export class Forecaster {
  constructor(start: ForecastStart, base: number, samples?: number) // samples defaults to FORECAST_SAMPLES
  /** Takes one engine step, beginning the next sample as one ends; the forecast once all are done (and on every call after), else null. */
  step(): Forecast | null
}
/** Steps `forecaster` until it is done or `budgetMs` has passed by `now` (default performance.now). */
export function workFor(forecaster: Forecaster, budgetMs: number, now?: () => number): Forecast | null
/** Runs an estimate to its end at once (tests, tools). */
export function forecast(start: ForecastStart, base: number, samples?: number): Forecast

/** "90%" (share/of rounded to the nearest 5, clamped to 5..95), ">95%" when share === of, "<5%" when share === 0, "…" for null. */
export function forecastFigure(share: number | null, of: number): string
/** short: "Auto (90%)" / "Auto (…)"; long: "Auto-resolve (win 90%)" / "Auto-resolve (…)". */
export function forecastLabel(forecast: Forecast | null, short: boolean): string
/** The hint line (below); "Estimating how auto-resolve would go…" for null. */
export function forecastHint(forecast: Forecast | null): string
```

- **Hint words** (`f` non-null): `` `Estimate from ${f.samples} trial battles with the AI playing your side: it wins ${about(f.wins)} of them, and a hero dies in ${about(f.heroLost)}${f.stalled > 0 ? `; ${f.stalled} of ${f.samples} drag on past ${AUTO_ROUND_LIMIT} rounds` : ''}. Your own play may do better.` ``, where `about(n)` is "over 95%" when `forecastFigure(n, f.samples)` is ">95%", "under 5%" when it is "<5%", else "about " + the figure. Example: "Estimate from 40 trial battles with the AI playing your side: it wins about 90% of them, and a hero dies in about 15%. Your own play may do better."
- **A sample:** seed `s = forecastSeed(base, i)`. From a setup: `new BattleEngine(setup, { seed: s, meta: { source: 'forecast' } })`; from a snapshot: `BattleEngine.restore({ ...snapshot, rng: s })` (the snapshot is taken once per estimate by the caller and shared read-only). Policies `{ player: AUTO_POLICY, enemy: ENEMY_POLICY }`, streams `{ enemy: mulberry32(s + 1), player: mulberry32(s + 2) }`, `lastRound` the start's round (setup: 1; snapshot: `snapshot.round`) plus `AUTO_ROUND_LIMIT`. Stepped with `playStep` (C1).
- **Outcome when a sample stops:** won when `getState().winner === 'player'`; hero lost when any `side === 'player'` unit has `hp <= 0`; stalled when its phase is not `'over'`.
- **`worldForecastStart`:** `monstersHere(game.world, party)`; the setup is `ENCOUNTERS[location.encounter](partyFighters(party.members), location.threat).setup`, exactly as `BattleScene.create` builds it for that location.
- Pure: imports the engine, `autoPlay.ts`, `ENCOUNTERS`, `partyFighters`, `monstersHere`, `mulberry32`; never a scene; draws from nothing but each sample's own streams.

### Shared constraints (from the index)

- **Versions:** `LOG_SCHEMA_VERSION` stays 26 and `SAVE_VERSION` stays 26. This step changes no event or saved shape; the estimate is never saved.
- **The refactor guard** (`scripts/simulate.test.ts`, `describe('the refactor guard')`) is never edited and must stay green. This step touches no simulator code, so it passes unchanged.
- **Randomness.** Nothing outside the engine draws from a battle's stream. The real battle's seed is decided exactly as before. The estimate draws only from its samples' own streams; never `Math.random`, `randomSeed`, the world's RNG or the registry's seed.
- **Commands** (local Node 26: prefix `PATH=/opt/homebrew/opt/node@26/bin:$PATH`, or use the podman `make` targets): `npm test` (`tsc && vitest run`) is the gate before the commit; `npx vitest run src/game/forecast.test.ts` for this file. No scene changes, so no `npm run test:browser` is needed.
- **Test-first.** Write the failing tests first, then the code.
- **Commits.** One commit on `main` once `npm test` passes, without pushing. Message "Auto-resolve step 02: the estimate's domain module".
- **Docs.** Fix the CLAUDE.md lines this change makes incomplete, in the same commit (root `CLAUDE.md` under 16 KB, each directory's under 12 KB: `scripts/claudeMd.test.ts`).

## 3. Dependencies and prerequisites

- **Step 01** must be done: it produces `src/engine/autoPlay.ts` with `playStep`, `playOut`, `AUTO_POLICY`, `ENEMY_POLICY` and `AUTO_ROUND_LIMIT` (C1 above). If it is not yet committed, stop: do not write a private copy of the loop.
- **Existing code at `002457c`** (inspected):
  - `src/engine/battleEngine.ts`: `BattleEngine` (constructor `(setup, options = {}, restored?)`, options take `seed` and `meta`), `snapshot(): BattleSnapshot` (structured clone; `rng` is the battle stream's `mulberry32` state, and `mulberry32(s).state()` is `s`), `static restore(snapshot)` (clones what it is given), `getState()`, `getLog()`, `legalActions()`, `step()`. Types `BattleSetup` (l. 160), `BattleSnapshot` (l. 675), `BattleEvent`, `Side`. The `battle_start` event carries `seed`.
  - `src/combat/rng.ts`: `mulberry32(seed): SeededRng`; `src/combat/combat.ts`: `type RNG = () => number`. The only `Math.imul` hashing in `src/` is inside `mulberry32`; `src/game/loot.ts`'s `lootRng` salts a battle seed with XOR (`RUNE_LOOT_SALT`), a pattern to follow for the salt (pick a distinct constant).
  - `src/game/encounters.ts`: `ENCOUNTERS` keyed by id (`goblin_raid`, `kobold_scouts`, `hobgoblin_warband`, `troll_lair`, `source_guardians`, `bandit_camp`, `spider_nest`, `salamander_pool`), each `(party: Fighter[], threat) => Encounter` with `setup`; building one draws nothing.
  - `src/game/party.ts`: `partyFighters(party)`; `src/game/worldMap.ts`: `monstersHere(world, party): MonsterLocation | null`, `WorldState.turn`; `src/game/gameState.ts`: `GameState`, `newGame`, `selectedParty`; `src/game/expedition.ts`: `Expedition` (`id`, `members`, `position`).
  - `scripts/simulate.ts`'s `raisedParty` and `src/game/party.ts`'s ready-made party are how tests elsewhere build a party; level-1 tests can use the ready-made party (`readyMadeParty`) or `newGame()`'s first party.
- No step consumes anything here but steps 05 (battle) and 06 (world map), which import C2 exactly as written.

## 4. Scope and guidance

New files (proposed): `src/game/forecast.ts`, `src/game/forecast.test.ts`.

1. **Tests first** (`src/game/forecast.test.ts`, `domain` project). Use small sample counts where the test is about mechanics (e.g. 6–10) and the default 40 where it is about the figure.
   - **Deterministic (A10):** the same start and base give a deep-equal `Forecast` twice; and the same whether worked by `step()` to the end, by `forecast(...)`, or by `workFor` with a fake clock that lets one step through per slice (`now` returning a value that passes the budget after each call) called repeatedly until done.
   - **`step()` contract:** returns null until done, then the same `Forecast` on every later call; `samples` equals the count given.
   - **Independent of the real battle (A10):** build a seeded engine from a setup, step it a few actions with the game's policies; take `snapshot()`; run an estimate from `{ snapshot }`; the engine's `snapshot()` is deep-equal to the one before; then step the real engine on with its policies and streams, and compare its log to a second, identically built engine stepped the same way with no estimate made: equal.
   - **Honest (A11):** for each `i`, rebuild sample `i` by hand from `forecastSeed(base, i)` (engine seeded `s`, streams `s + 1` enemy and `s + 2` player, `lastRound` as in C2) and run it with `playOut`; sum wins, hero-lost and stalled; they equal the `Forecast`'s `wins`, `heroLost`, `stalled`. Do this once from a setup and once from a snapshot.
   - **Sensible:** a level-1 ready-made party against `goblin_raid` at threat 1 wins every sample or all but one or two (the simulator's cell gives 500/500); the same party against `source_guardians` at threat 5 wins none.
   - **Seeds:** for a few bases (0, 1, a large one, the base of a real log), the 40 `forecastSeed(base, i)` are distinct 32-bit unsigned integers, and none equals the battle's seed, seed + 1 or seed + 2 for the battle that base came from (for the world base, none equals a chosen fixed battle seed and its +1, +2). `battleForecastBase` changes when the log grows by an event and is equal for equal logs; `worldForecastStart`'s base changes with the location, the party id and `world.turn`.
   - **No `Math.random`:** `vi.spyOn(Math, 'random')` across a whole `forecast(...)` call: not called. Restore the spy.
   - **Mid-battle, a hero already fallen:** a snapshot in which one player-side unit has `hp <= 0` and no living player unit can revive (a party with no Revive, e.g. one without the cleric's node; or set the fallen unit's hp to 0 in a cloned snapshot of a party with no reviver) gives `heroLost === samples`.
   - **`worldForecastStart`:** null when the party stands on no monster location; at a monster location, its setup deep-equals `ENCOUNTERS[location.encounter](partyFighters(party.members), location.threat).setup`. Reading it leaves `game.world.rng` (and the whole `GameState`) unchanged (deep-equal before and after).
   - **Words:** `forecastFigure`: `(40, 40)` ">95%", `(0, 40)` "<5%", `(39, 40)` "95%" (97.5 rounds to 95 or 100, then clamps to 95: pin it), `(1, 40)` "5%", `(36, 40)` "90%", `(null, 40)` "…". `forecastLabel` short and long, finished and null ("Auto (90%)", "Auto (…)", "Auto-resolve (win 90%)", "Auto-resolve (…)"). `forecastHint`: null → "Estimating how auto-resolve would go…"; the example line exactly; "over 95%" / "under 5%" at the ends; with `stalled: 3` the "; 3 of 40 drag on past 50 rounds" clause.
2. **`forecast.ts`.**
   - A private 32-bit hash (e.g. a `Math.imul` mix of each number, and FNV-1a or the like for the two id strings in the world base), returning `>>> 0`. A fixed salt in `forecastSeed`, distinct from `RUNE_LOOT_SALT`.
   - `Forecaster` holds the start, base and count; for the current sample an engine, its options and its stop round; `step()` takes one `playStep`, and when it returns false records the outcome and builds the next sample on the following call (or in the same call: either, so long as slicing cannot change the result). It never holds a reference that lets a sample write into the caller's snapshot (`restore` clones).
   - `workFor` checks the clock between steps and always takes at least one step per call.
   - `battleForecastBase(log)`: seed from `log[0]` when it is `battle_start`, else 0, hashed with `log.length`.
3. **Docs** (same commit):
   - `src/game/CLAUDE.md`, "The modules": one line, e.g. "`forecast.ts`: the auto-resolve estimate: sample battles played headless on seeds of their own, worked a step at a time, and its words."
   - `src/game/CLAUDE.md`, the "Two RNG streams" contract: add the estimate's rule: its samples' seeds are hashed from the battle (seed and log length) or, on the world map, the location, party and day, with a salt; each sample has its own engine and policy streams; nothing in it draws from the real battle, the world's RNG or `Math.random`.
   - Root `CLAUDE.md`'s `src/game/` line: add "the auto-resolve estimate" to its list if it fits in a few words (keep the file under 16 KB).

**Exclusions:** no scene, probe or `testHook.ts` change (steps 05, 06); no change to `autoPlay.ts` beyond what step 01 made (if C1 turns out wrong, record it and stop rather than change it); no balance change.

## 5. Verification

- `npx vitest run src/game/forecast.test.ts`: every test above passes (and failed before the code was written).
- `npm test` passes; the refactor guard is green and unedited; `scripts/claudeMd.test.ts` passes.
- Record in the execution record the figure the "sensible" tests saw (wins out of samples for both cells) and how long `forecast(...)` of 40 samples took for each, as a check on the design's cost estimate (6 ms a battle at threat 1).

## 6. Completion criteria

- [ ] `src/game/forecast.ts` exports exactly C2, Phaser-free and scene-free.
- [ ] Tests for determinism and slicing (A10), independence of the real engine (A10), the hand recount (A11), the sensible cells, seeds, `Math.random`, the fallen hero, `worldForecastStart` and the words, all passing.
- [ ] `src/game/CLAUDE.md` (module line, RNG contract) and, if apt, root `CLAUDE.md` updated.
- [ ] `npm test` green; guard unedited.
- [ ] One commit on `main`; the index's row 02 updated with status and hash.

## 7. Execution record
