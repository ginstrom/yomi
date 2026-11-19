# Step 05: The estimate in battle

[Plan index](index.md) · [Design](../../designs/auto-resolve.md) (§4.2, §4.6 "The estimate", §5.3 last bullet, §7.2 A9) · [Feature record](../../features/auto-resolve.md)

**Suggested engineer:** opus (leave the model unset). The estimate is tied to the battle's control flow, which is easy to get subtly wrong: it must restart only when the battle moved, never run while the board plays back, and never touch the real engine but to read `snapshot()`.

## 1. Objective

The battle screen's Auto button carries the estimate of auto-resolving from where the battle stands: "Auto (…)" while it is worked out, then "Auto (90%)" or the like. Hovering the button puts the whole estimate in the header's hint line. The estimate is worked in slices of at most `FORECAST_SLICE_MS` a frame while the player has control, restarted after each of the player's actions, and thrown away when control is lost.

## 2. Requirements and context

- **R12:** wherever Auto-resolve is offered, its estimate is shown: the win chance on the button's label, and on hovering a line in the hint giving the win chance, the chance a hero dies, and that it is the AI's odds. Until ready the label says "…".
- **R13:** the estimate is `FORECAST_SAMPLES` (40) battles played out from the battle as it stands; mid-battle from the engine's `snapshot()`, restored with another stream.
- **R14:** estimating never draws from, steps or changes the real engine, its streams (`enemyRng`), the world's RNG, `Math.random` or the page's seed.
- **R15:** never freezes the screen: one engine step at a time, at most 10 ms a frame, only while the screen is idle (in battle: the player has control); thrown away and restarted when the state it was for changes. Auto may be pressed before it is ready.
- **Design §4.6, battle:** worked out each time the player is given control (each player turn's start and after each of the player's actions has played), mid-turn included. Thrown away when the state changes, when the player presses Auto-resolve, Attack (an action) or End Turn, or when the scene is left. Pressing Auto does not wait for it: the real battle is resolved by its own engine and streams.
- **§8.6 (decided):** re-estimate after every action.
- **Button width:** the battle's buttons are 140 px; "Auto (90%)", "Auto (>95%)" and "Auto (…)" fit, "Auto-resolve" with a figure does not, so the hint names it in full.

### Decision 5 (from the index, unchanged)

The battle restarts its estimate only when the battle moved: `setPlayerControl(true)` is also called on selecting a hero or aiming, so a new `Forecaster` is started only when `battleForecastBase(engine.getLog())` differs from the one in hand (the log grows with every action, so every action restarts it, §8.6).

### Contract C2 (consumed; copied unchanged from the index)

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

- **Hint words** (`f` non-null): `` `Estimate from ${f.samples} trial battles with the AI playing your side: it wins ${about(f.wins)} of them, and a hero dies in ${about(f.heroLost)}${f.stalled > 0 ? `; ${f.stalled} of ${f.samples} drag on past ${AUTO_ROUND_LIMIT} rounds` : ''}. Your own play may do better.` ``, where `about(n)` is "over 95%" when `forecastFigure(n, f.samples)` is ">95%", "under 5%" when it is "<5%", else "about " + the figure.
- **A sample** from a snapshot: `BattleEngine.restore({ ...snapshot, rng: s })`; the snapshot is taken once per estimate by the caller and shared read-only.

### Contract C3 (consumed; copied unchanged from the index)

- `BattleData` gains `auto?: boolean`. A fresh battle with `auto` adds `playerPolicy: AUTO_POLICY` to `battle_start`'s meta (beside `source`, `enemyPolicy`, `party`), logs its opening events as lines with no playback (decision 6), then calls `autoResolve()` in place of `continueBattle()`. A restored battle ignores `auto`.
- `autoButton`: a fourth battle button, labelled "Auto" (step 05 adds the figure), in the row Attack, Skills, End Turn, Auto at `BUTTON_SPACING`, the row centred where the three are today (x = `centreX + (i - 1.5) * BUTTON_SPACING`). Enabled exactly when End Turn is (`setPlayerControl`), hidden in `endBattle` with the others, no key binding.
- `autoResolve()`: `setPlayerControl(false)`, clear `targeting`; `playerRng = mulberry32((battleSeed(log) ?? 0) + 2)`; `startRound = round`; `playOut(engine, { policies: { player: AUTO_POLICY, enemy: ENEMY_POLICY }, rngs: { player: playerRng, enemy: this.enemyRng }, lastRound: startRound + AUTO_ROUND_LIMIT })`; push every returned event's `formatEvent` line but a final `battle_end` and render the log; bring the board to the engine's state (a helper shared with `showRestored`: fallen faded, `syncUnitsFromEngine`, ground marks); then, if over, `showEvent(battle_end)` (its line, cues, music stop, `endShownAt`), set `autoRounds = finalRound - startRound + 1`, and `endBattle()`; else push `AUTO_DRAG_ON_LINE` and `continueBattle()`.
- `autoRounds: number | null`, reset in `create`; `endBattle` puts `autoResolvedLine(autoRounds)` second in the result (after "<Foes> are beaten." or the first defeat line) when non-null.
- `src/scenes/battleSetup.ts`: `export function autoResolvedLine(rounds: number): string` → "Auto-resolved in 1 round." / "Auto-resolved in N rounds."; `export const AUTO_DRAG_ON_LINE = 'The battle drags on. It is yours to finish.'`
- `BattleProbe.buttons.auto: ButtonProbe`.

### Contract C4 (produced for the battle; copied unchanged from the index)

- `BattleProbe` gains `forecast: Forecast | null` (the finished estimate for the battle as it stands, else null) and `autoLabel: string` (the Auto button's label).
- `WorldProbe.buttons` gains `autoResolve: ButtonProbe` (step 04); `WorldProbe` gains `forecast: Forecast | null` and `autoLabel: string` (step 06).
- Battle label `forecastLabel(f, true)`; world label `forecastLabel(f, false)`. Hovering the button sets the screen's hint to `forecastHint(f)` in the hint's normal colour, not the warning colour; leaving it restores the hint. The scene's `update` calls `workFor(forecaster, FORECAST_SLICE_MS)` while a forecaster is unfinished and the screen is idle (battle: `playerControl`; world: not walking, an Auto-resolve button shown); a finished one updates the label (and the hint if hovered).

This step does the battle's half of C4; step 06 does the world's.

### Shared constraints (from the index)

- **Versions:** `LOG_SCHEMA_VERSION` stays 26 and `SAVE_VERSION` stays 26. The estimate is not saved; it is worked out again after a load.
- **The refactor guard** (`scripts/simulate.test.ts`) is never edited and must stay green.
- **Randomness.** Nothing outside the engine draws from a battle's stream. The estimate draws only from its samples' own streams; never `Math.random`, `randomSeed`, the world's RNG or the registry's seed. The real engine is only read through `snapshot()`; it is never stepped, restored into or given an rng by the estimate, and `enemyRng` is never handed to a `Forecaster`.
- **Commands** (local Node 26: prefix `PATH=/opt/homebrew/opt/node@26/bin:$PATH`, or the podman `make` targets): `npm test` is the gate; `npx vitest run <file>`; `npm run test:browser` (or `-- -t <name>`) after this scene change; read `e2e/CLAUDE.md` before adding an in-browser test.
- **Test-first.** Write the failing in-browser test first, then the code.
- **Commits.** One commit on `main` once `npm test` and the browser tests pass, without pushing. Message "Auto-resolve step 05: the estimate in battle".
- **Docs.** Fix the CLAUDE.md lines and `docs/reference/` text this change makes wrong or incomplete, in the same commit (directory `CLAUDE.md` files under 12 KB).

## 3. Dependencies and prerequisites

- **Step 02** (produces `src/game/forecast.ts`, C2, with its domain tests): `Forecaster`, `workFor`, `battleForecastBase`, `forecastLabel`, `forecastHint`, `FORECAST_SLICE_MS`, `Forecast`.
- **Step 03** (produces C3 in `BattleScene`): the `autoButton` in the row, enabled with End Turn in `setPlayerControl`, hidden in `endBattle`; `autoResolve()`; `BattleProbe.buttons.auto`. Its label is plain "Auto" until this step.
- **Run after step 04 and before step 06** (index: 05 and 06 both touch `src/testHook.ts`; 05 first).
- **Existing code at `002457c`** (inspected), `src/scenes/BattleScene.ts`:
  - `setPlayerControl(enabled)` (around line 1968) closes the Skills list, sets `playerControl`, enables or greys Attack, Skills and End Turn. It is called with `true` not only when control is handed over (`continueBattle`'s player branch) but also on selecting a hero (`onBoardClick`, the portrait click around line 621) and by `setTargeting` (aiming and cancelling), and with `false` by `playerAct`, `goFor`, `onEndTurn` (through `playerAct`) and `endBattle`.
  - Hint plumbing: `baseHint` (the turn's hint, set around line 1057), `hoverHint: string | null`, and `showHint()` (line 1236), which shows `hoverHint ?? baseHint` and colours a non-null `hoverHint` in the warning colour `#ffb74d`. The hint is visible only while `playerControl` (line 1047). The Skills list's rows write `hintText` directly on `pointerover` and call `showHint()` on `pointerout`.
  - `createButton(label, onClick)` (line 807): 140 × 44, `pointerover`/`pointerout` change only the fill; `pointerdown` ignores a disabled button. `setButtonLabel` sets a button's text.
  - The scene has no `update()` today. Phaser does not call `update` on a paused scene, so under the character panel, the menu or a story overlay no work is done, which is what R15 wants.
  - `this.events.once(Phaser.Scenes.Events.SHUTDOWN, …)` (line 501) is where per-scene cleanup goes.
  - `engine.snapshot()` returns a deep copy (it `structuredClone`s) and throws only for an engine given its own rng; the game's engines are always seeded.
- `src/testHook.ts`: `BattleProbe` (line 362), `ButtonProbe` (no label).

## 4. Scope and guidance

1. **State on the scene.** `forecaster: Forecaster | null`, `forecastBase: number | null` (the base it was started for) and `shownForecast: Forecast | null` (the finished estimate for the battle as it stands). Reset all three in `create` (Phaser reuses the scene instance) and drop them in the `SHUTDOWN` handler.
2. **Starting (decision 5).** In `setPlayerControl(true)`: compute `base = battleForecastBase(this.engine.getLog())`; if it differs from `forecastBase` (or there is no forecaster and no finished estimate for it), start `new Forecaster({ snapshot: this.engine.snapshot() }, base)`, set `forecastBase = base`, `shownForecast = null`. If it is the same base, keep what is in hand, finished or not: selecting a hero or aiming must not throw work away.
3. **Dropping.** In `setPlayerControl(false)`: `forecaster = null`, `forecastBase = null`, `shownForecast = null`, label back to `forecastLabel(null, true)`. This covers every action (`playerAct`, `goFor`), End Turn, Auto (`autoResolve` starts with `setPlayerControl(false)`) and the battle's end. The state the dropped estimate was for no longer stands after any of those, so it is never kept across them. Check that no path steps the engine while `playerControl` is still true; if one does (e.g. an `equip` action sent as the character panel closes), it must drop or restart the estimate, which the base check in 2 does once `setPlayerControl(true)` follows.
4. **Working.** Add `update()`: if `playerControl` and a forecaster is unfinished, `const f = workFor(this.forecaster, FORECAST_SLICE_MS)`; when `f` arrives, set `shownForecast = f`, the label `forecastLabel(f, true)`, and the hint if the Auto button is hovered. Do no other work in `update`.
5. **Label.** The Auto button reads `forecastLabel(shownForecast, true)` whenever it is visible: "Auto (…)" until the estimate is ready, "Auto (90%)" after. Use `setButtonLabel`; the text must stay within 140 px at 16 px monospace (">95%" is the longest figure).
6. **Hover hint.** Give the Auto button its own `pointerover`/`pointerout` handlers (or let `createButton` take optional hover callbacks): over, set the hint to `forecastHint(shownForecast)` in the hint's normal grey (`#9e9e9e`), not via `hoverHint` as `showHint` would paint it in the warning colour; out, `showHint()` to restore. While hovered and the estimate arrives, the hint updates to the finished words. Hovering a disabled Auto (no control) changes nothing visible, since the hint is hidden then.
7. **Probe** (`src/testHook.ts` and `probe()`): `forecast: this.shownForecast` and `autoLabel` (the Auto button's text). Document both in `BattleProbe`'s doc comments.
8. **Never touch the real battle.** The scene hands the `Forecaster` only a snapshot. It never passes `this.engine`, `this.enemyRng` or the registry's seed to it, and the estimate never changes what `autoResolve` does (the real resolve does not wait for or reuse it).
9. **In-browser tests** (`e2e/battle.test.ts`, a new `it` in `describe('a battle')`, or a small `describe` of its own; read `e2e/CLAUDE.md` first): with the default `WINNING_SEED`, `enterBattle()`, then:
   - `waitFor('Battle', (b) => b.forecast !== null)`: the label matches `/^Auto \((>95%|<5%|\d+%)\)$/` and the forecast's `samples` is 40;
   - make a move (as the existing "moves a hero to a clicked hex" test does); right after the click the probe's `forecast` is null (and `autoLabel` is "Auto (…)") while control is away; once `playerControl` is true again, `waitFor` the forecast to be non-null again;
   - `hover` the Auto button: the probe's `hint` equals the forecast's words (starts with "Estimate from 40 trial battles", ends with "Your own play may do better."); move the pointer away and the turn's hint returns.
   - Optional: the probe keeps answering while the estimate works (a `waitFor` on the forecast succeeding is evidence enough that frames came).
   - The page must log no console error (the `useGames` harness fails the test otherwise).
10. **Docs.**
    - `docs/reference/scenes.md`, "The battle screen": the Auto button's label carries the estimate ("Auto (…)", then "Auto (90%)"), hovering it shows the whole estimate in the hint, worked in 10 ms slices while the player has control, restarted after each action (`battleForecastBase`), dropped when control goes; the probe's `forecast` and `autoLabel`.
    - `src/scenes/CLAUDE.md`: only if a contract changes (e.g. a line under "Seeds" that the estimate draws only from its samples' own streams and reads the engine through `snapshot()`); keep it under 12 KB.

**Exclusions:** no world-map estimate (step 06), no manual text or screenshots (step 07), no change to `forecast.ts`'s behaviour (if a C2 function is missing or wrong, record it as a blocker or a deviation rather than redesigning it).

## 5. Verification

- `npx vitest run src/game/forecast.test.ts` still passes (unchanged).
- `npm test` passes; the refactor guard is green and unedited.
- `npm run test:browser -- -t "<the new test's name>"`, then the whole `npm run test:browser` (all of `e2e/battle.test.ts` included: the button row moved in step 03 and its label now changes) passes.
- By hand or in the test: a battle at a high threat (debug console `fight bandit_camp 7` or the like) stays responsive while "Auto (…)" shows.

## 6. Completion criteria

- [ ] The Auto button reads "Auto (…)" then "Auto (NN%)"; hovering it shows `forecastHint`'s words in the normal colour.
- [ ] A new estimate starts only when `battleForecastBase` changes; selecting and aiming keep it; every action, End Turn, Auto and the battle's end drop it.
- [ ] Work is done only in `update`, in slices of `FORECAST_SLICE_MS`, only while the player has control; the real engine is only read through `snapshot()`.
- [ ] `BattleProbe.forecast` and `autoLabel` added and documented; the A9 (battle) in-browser test passes, with the rest of the browser suite.
- [ ] `docs/reference/scenes.md` updated (and `src/scenes/CLAUDE.md` if a contract changed).
- [ ] One commit on `main`; the index's row 05 updated with status and hash.

## 7. Execution record
