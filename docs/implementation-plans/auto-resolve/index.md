# Implementation plan: auto-resolve for battles

Any battle can be auto-resolved, from the world map beside Attack or from the battle screen during the player's turn. The engine plays the battle to its end at once with the AI's policy on both sides, as the simulator does, and the played battle's result screen and settlement follow unchanged. Beside each button an estimate, from 40 sample battles played headless in idle frames, gives the AI's chance of winning and the chance a hero dies.

**Source design:** [`docs/designs/auto-resolve.md`](../../designs/auto-resolve.md) (approved 2026-11-20; 8a818e0, estimate added in caae9e3). Feature record: [`docs/features/auto-resolve.md`](../../features/auto-resolve.md), whose decision log settles §8.4–8.6 with the designer's defaults: 40 samples, the chance a hero dies, re-estimate after every action. Written against `002457c` on `main`.

## Decisions taken for the orchestrator

None blocks a step. The plan follows the design; where it left a choice or was silent, these hold:

1. **`ENEMY_POLICY` moves to `autoPlay.ts`** (exported, still `'aggressive'`), so that the estimate in `src/game/` plays the game's enemy policy without importing a scene. `BattleScene` imports it (step 01).
2. **`forecastFigure(share, of)`**: `share` is a count of samples (wins, or samples with a hero lost), `of` the samples. The design's name is kept; its meaning is fixed here (C2).
3. **`battleForecastBase` reads `battle_start`'s seed itself** (0 when the log has none); `src/game/` must not import `battleSetup.ts`'s `battleSeed` from the scenes.
4. **The world map restarts its estimate only when the start changes**: it keeps a key, `` `${base}:${JSON.stringify(start)}` ``, and `refresh()` starts a new `Forecaster` only when the key differs (design §5.4 left the choice to the planner).
5. **The battle restarts its estimate only when the battle moved**: `setPlayerControl(true)` is also called on selecting a hero or aiming, so a new `Forecaster` is started only when `battleForecastBase(engine.getLog())` differs from the one in hand (the log grows with every action, so every action restarts it, §8.6).
6. **An auto-resolve from the world map** logs the battle's opening events as lines without playing them (as `showRestored` does), then resolves; a played battle's opening is unchanged.
7. **Probes** gain `autoLabel: string` beside `forecast`, since `ButtonProbe` carries no label (C4).
8. **Scene smoke tests**: the `scenes` project's smoke tests only check that a scene registers (`BattleScene.test.ts`); they cannot run `create`. The design's smoke cases (§7.1, "a scene started with `auto: true` ends with the result screen") are covered by the in-browser tests of steps 03 and 04 instead. Departure from the design's test list, not from its behaviour.
9. **The world footer's widest row fits.** Scout, Wait, Attack (96 px each, `MIN_FOOTER_BUTTON_W`) and "Auto-resolve (win >95%)" (24 characters: 264 px) with three 12 px gaps make 588 px, inside the 760 px right of the party column at 840 wide. A world footer button's width is fixed when built, so step 06 adds a way to relabel and resize one and re-run `layout()`; steps 04 and 06 keep the least-window footer test green.
10. **A forced loss** (A6, step 04): no driver helper loses an auto-resolved battle; the step uses the debug console's `hp` command (or a planted save) and a seed that loses, recorded in the test.
11. **Manual text** is written once, in step 07, when the estimate's words are final; scene steps update `docs/reference/scenes.md` and the CLAUDE.md files as they go.

## Scope and shared constraints

- **In:** R1–R15 and A1–A11 of the design; the docs of §7.3.
- **Out:** the design's non-goals (playback, confirmation, other estimates, policy choice, automatic gear or points, any balance change); unifying `fightAt`'s settlement with `endBattle`.
- **Versions:** `LOG_SCHEMA_VERSION` stays 26 and `SAVE_VERSION` stays 26. `battle_start.meta.playerPolicy` is a free-form meta key, not a shape change. No step edits either constant.
- **The refactor guard** (`scripts/simulate.test.ts`, `describe('the refactor guard')`, `GUARD_RECORDS` and `GUARD_EVENTS_SHA256`) is never edited by any step and must stay green. A mismatch means the step changed play: fix the code, not the guard.
- **Randomness.** Nothing outside the engine draws from a battle's stream. The real battle's seed is decided exactly as before (page `?seed=` or `randomSeed()`). The estimate draws only from its samples' own streams; never `Math.random`, `randomSeed`, the world's RNG or the registry's seed.
- **Commands** (local Node 26: prefix `PATH=/opt/homebrew/opt/node@26/bin:$PATH`, or use the podman `make` targets):
  - `npm test` (`tsc && vitest run`) is the gate before every commit;
  - `npx vitest run <file>`; `npx vitest run --project domain`;
  - `npm run test:browser` (or `-- -t <name>`) after any scene change; read `e2e/CLAUDE.md` before adding an in-browser test;
  - `npm run manual:screenshots` (step 07);
  - simulator runs each write their own `--out` under `logs/` (gitignored); never two at once.
- **Test-first.** Each step writes its failing tests first, then the code.
- **Commits.** One commit per step (more if a step says so) on `main`, once `npm test` passes, without pushing. Message "Auto-resolve step NN: <title>".
- **Docs.** Each step fixes the CLAUDE.md lines and `docs/reference/` text its change makes wrong or incomplete, in its own commit (root `CLAUDE.md` under 16 KB, each directory's under 12 KB: `scripts/claudeMd.test.ts`).

## Contracts

Task files copy these unchanged. "Existing" means at `002457c`.

### C1. The loop: `src/engine/autoPlay.ts` (step 01)

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
- **The simulator's `fight`** (`scripts/simulate.ts`): `const { over } = playOut(engine, { policies: args.policies, rngs: { player: policyRng, enemy: policyRng }, lastRound: args.maxRounds }); if (!over) engine.abandon()`.

### C2. The estimate: `src/game/forecast.ts` (step 02)

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

### C3. The battle screen's auto-resolve (step 03)

- `BattleData` gains `auto?: boolean`. A fresh battle with `auto` adds `playerPolicy: AUTO_POLICY` to `battle_start`'s meta (beside `source`, `enemyPolicy`, `party`), logs its opening events as lines with no playback (decision 6), then calls `autoResolve()` in place of `continueBattle()`. A restored battle ignores `auto`.
- `autoButton`: a fourth battle button, labelled "Auto" (step 05 adds the figure), in the row Attack, Skills, End Turn, Auto at `BUTTON_SPACING`, the row centred where the three are today (x = `centreX + (i - 1.5) * BUTTON_SPACING`). Enabled exactly when End Turn is (`setPlayerControl`), hidden in `endBattle` with the others, no key binding.
- `autoResolve()`: `setPlayerControl(false)`, clear `targeting`; `playerRng = mulberry32((battleSeed(log) ?? 0) + 2)`; `startRound = round`; `playOut(engine, { policies: { player: AUTO_POLICY, enemy: ENEMY_POLICY }, rngs: { player: playerRng, enemy: this.enemyRng }, lastRound: startRound + AUTO_ROUND_LIMIT })`; push every returned event's `formatEvent` line but a final `battle_end` and render the log; bring the board to the engine's state (a helper shared with `showRestored`: fallen faded, `syncUnitsFromEngine`, ground marks); then, if over, `showEvent(battle_end)` (its line, cues, music stop, `endShownAt`), set `autoRounds = finalRound - startRound + 1`, and `endBattle()`; else push `AUTO_DRAG_ON_LINE` and `continueBattle()`.
- `autoRounds: number | null`, reset in `create`; `endBattle` puts `autoResolvedLine(autoRounds)` second in the result (after "<Foes> are beaten." or the first defeat line) when non-null.
- `src/scenes/battleSetup.ts`: `export function autoResolvedLine(rounds: number): string` → "Auto-resolved in 1 round." / "Auto-resolved in N rounds."; `export const AUTO_DRAG_ON_LINE = 'The battle drags on. It is yours to finish.'`
- `BattleProbe.buttons.auto: ButtonProbe`.

### C4. Probes and labels for the estimate (steps 05, 06)

- `BattleProbe` gains `forecast: Forecast | null` (the finished estimate for the battle as it stands, else null) and `autoLabel: string` (the Auto button's label).
- `WorldProbe.buttons` gains `autoResolve: ButtonProbe` (step 04); `WorldProbe` gains `forecast: Forecast | null` and `autoLabel: string` (step 06).
- Battle label `forecastLabel(f, true)`; world label `forecastLabel(f, false)`. Hovering the button sets the screen's hint to `forecastHint(f)` in the hint's normal colour, not the warning colour; leaving it restores the hint. The scene's `update` calls `workFor(forecaster, FORECAST_SLICE_MS)` while a forecaster is unfinished and the screen is idle (battle: `playerControl`; world: not walking, an Auto-resolve button shown); a finished one updates the label (and the hint if hovered).

### C5. The world map's button (step 04)

- `this.buttons` becomes Scout, Wait, Attack, Auto-resolve (label "Auto-resolve" until step 06), shown by the same rule as Attack. `onAutoResolve()` starts `Battle` with `{ game, location: here.id, party: this.selectedParty, auto: true }`. `WorldProbe.buttons.autoResolve` (C4).

## Tasks

| Step | Task | Outcome | Depends on | Engineer (suggested) | Status |
| --- | --- | --- | --- | --- | --- |
| 01 | [The shared loop](01-shared-loop.md) | `autoPlay.ts` (C1) with tests (A4, A3, A5 at the domain level); the simulator's `fight` on `playOut`; `ENEMY_POLICY` moved; guard unchanged (A7) | — | sonnet | pending |
| 02 | [The estimate's domain module](02-forecast-module.md) | `forecast.ts` (C2) with tests (A10, A11, words) | 01 | opus | pending |
| 03 | [Auto-resolve on the battle screen](03-battle-auto-resolve.md) | Auto button, `autoResolve`, `auto` scene data and meta, result line, drag-on hand-back (C3); in-browser A2 | 01 | opus | pending |
| 04 | [Auto-resolve on the world map](04-world-auto-resolve.md) | Footer button (C5); in-browser A1, A6, A3 | 03 | sonnet | pending |
| 05 | [The estimate in battle](05-battle-estimate.md) | Sliced `Forecaster` in `BattleScene`, label, hover hint, probe (C4); in-browser A9 (battle) | 02, 03 | opus | pending |
| 06 | [The estimate on the world map](06-world-estimate.md) | Sliced `Forecaster` in `WorldScene`, keyed restart, label, hover hint, probe (C4); in-browser A9 (world), A10 (seed) | 02, 04 | sonnet | pending |
| 07 | [Manual, screenshots and records](07-manual-and-docs.md) | Manual chapters 3 and 5, screenshots retaken (waiting on the estimate), long-campaign open question answered, docs checked (A8) | 05, 06 | sonnet | pending |

**Tiers.** "opus" means leave the model unset (the session's); "sonnet" means `model: "sonnet"`. Step 02 decides determinism and the estimate's independence from the real battle; 03 reworks the battle's control flow (playback bypass, sting, hand-back); 05 ties the estimate to that flow. 01 is an extraction the guard proves; 04 and 06 follow 03's and 05's patterns; 07 is docs and screenshots, reviewed for truth.

## Execution order

01 → then two tracks: **domain** 02 and **scenes** 03 → 04 (02 may run beside 03 or 04; they share no file). Then 05 (needs 02, 03) and 06 (needs 02, 04); 05 and 06 both touch `src/testHook.ts`, so run them one after the other (05 first). 07 last.

- Commit one step at a time on `main`; a step that runs beside another rebases its work on the other's commit if both touched a file.
- **Checkpoints:** after 01, the guard is green and `fight` plays through `playOut`; after 04, auto-resolve works end to end with no estimate; after 06, the feature is complete but for the manual.

## Requirement map

| Design item | Steps |
| --- | --- |
| R1 world map button | 04 |
| R2 battle button | 03 |
| R3 every battle (vanguard and lesser parties, every encounter, a saved battle, debug `fight`) | 03 (saved battle, debug fight), 04 (world map, a second party) |
| R4 policies and streams | 01 (loop), 03 (the game's streams) |
| R5 at once, final board, full log | 03 |
| R6 result screen and auto-resolved line | 03 |
| R7 the played battle's settlement | 03, 04 |
| R8 determinism, `meta.playerPolicy` | 01 (domain), 03 (meta), 04 (in-browser) |
| R9 the 50-round hand-back | 01 (domain), 03 (scene) |
| R10 one loop for scene and simulator | 01 |
| R11 manual, screenshots, open question | 07 |
| R12 estimate shown, label and hint | 05, 06 |
| R13 the estimate's domain module | 02 |
| R14 independence and seeds | 02 (domain), 06 (in-browser seed check) |
| R15 sliced, idle only, restarted on change | 02 (`workFor`), 05, 06 |
| A1 | 04 · A2 | 03 · A3 | 01, 04 · A4 | 01 · A5 | 01 (scene hand-back: 03) · A6 | 04 · A7 | 01 (every step) · A8 | 07 · A9 | 05, 06 · A10 | 02, 06 · A11 | 02 |

## Completion criteria

- `npm test`, `npm run test:browser` and `npm run build` pass; the refactor guard is unedited and green.
- Every acceptance criterion A1–A11 has a passing test named in its step's execution record.
- `LOG_SCHEMA_VERSION` and `SAVE_VERSION` are still 26.
- The CLAUDE.md files, `docs/reference/scenes.md`, `docs/reference/simulator.md`, the manual and its screenshots are current; the long campaign's open-questions row reads answered.

## Open questions

None blocks a step. Decisions 1–11 above are the planner's; decision 8 drops the design's two scene smoke cases in favour of in-browser tests.

## For implementers

When you start or finish a step, update its status and commits in the table above. Record evidence (commands and output, the guard's result), deviations and blockers in your task file's "Execution record". Keep this index short; every implementer reads it.
