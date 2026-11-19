# Step 06: The estimate on the world map

[Plan index](index.md) · [Design](../../designs/auto-resolve.md) (§4.1, §4.6 "The estimate", §5.4 "The world map", §7.2) · [Feature record](../../features/auto-resolve.md)

**Suggested engineer:** sonnet. The domain module (step 02) and the battle's pattern (step 05) are in place; this step wires the same pattern into `WorldScene`, with one choice of its own (decision 4, the keyed restart) already made.

## 1. Objective

While the selected party stands among monsters and the footer shows Auto-resolve, the world map works out the estimate of auto-resolving that location's battle in idle frames, a slice of at most `FORECAST_SLICE_MS` a frame, and shows it: the button reads "Auto-resolve (…)" while it works and then "Auto-resolve (win 90%)" or the like; hovering the button puts the full estimate in the header's hint line. The estimate is kept while nothing changes, restarted when the battle Attack would start changes, and never touches the seed the real battle gets.

## 2. Requirements and context

- **R12:** wherever Auto-resolve is offered, the estimate is shown with it: the win chance on the button's label, the whole estimate in the screen's hint on hover, "…" until it is ready.
- **R14:** estimating never draws from, steps or changes a real battle's engine or streams, the world's RNG, `Math.random` or the page's seed, and does not change which seed the real battle gets. On the world map the samples' base is a hash of the location's id, the party's id and the day.
- **R15:** it runs one engine step at a time in slices of at most 10 ms a frame, only while the screen is idle (on the world map: nothing walking), and is thrown away and restarted when the state it was for changes. Auto-resolve (and Attack) may be pressed before it is ready.
- **Design §4.6, "When it is worked out", world map:** whenever the footer shows Auto-resolve and nothing is walking, from the battle Attack would start (the location's encounter built for the party as it stands). Worked out again whenever the map redraws after a change (a heal cast, gear changed, another party selected, a day passed), and kept while nothing changes. Thrown away when the party presses Auto-resolve or Attack, or the scene is left.
- **A9 (world half):** confronting a lair, the footer's button reads "Auto-resolve (…)" and then, within a few seconds and with the map still responsive, "Auto-resolve (win 90%)" or the like; hovering it shows the full estimate line.
- **A10 (in-browser half):** the real battle started after an estimate has the seed and log it would have had without one.

### Decision 4 (copied unchanged from the index)

**The world map restarts its estimate only when the start changes**: it keeps a key, `` `${base}:${JSON.stringify(start)}` ``, and `refresh()` starts a new `Forecaster` only when the key differs (design §5.4 left the choice to the planner).

### Contract C2 (copied unchanged from the index; consumed)

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
- **`worldForecastStart`:** `monstersHere(game.world, party)`; the setup is `ENCOUNTERS[location.encounter](partyFighters(party.members), location.threat).setup`, exactly as `BattleScene.create` builds it for that location.
- Pure: draws from nothing but each sample's own streams.

### Contract C4 (copied unchanged from the index)

- `BattleProbe` gains `forecast: Forecast | null` (the finished estimate for the battle as it stands, else null) and `autoLabel: string` (the Auto button's label).
- `WorldProbe.buttons` gains `autoResolve: ButtonProbe` (step 04); `WorldProbe` gains `forecast: Forecast | null` and `autoLabel: string` (step 06).
- Battle label `forecastLabel(f, true)`; world label `forecastLabel(f, false)`. Hovering the button sets the screen's hint to `forecastHint(f)` in the hint's normal colour, not the warning colour; leaving it restores the hint. The scene's `update` calls `workFor(forecaster, FORECAST_SLICE_MS)` while a forecaster is unfinished and the screen is idle (battle: `playerControl`; world: not walking, an Auto-resolve button shown); a finished one updates the label (and the hint if hovered).

### Contract C5 (copied unchanged from the index; produced by step 04)

- `this.buttons` becomes Scout, Wait, Attack, Auto-resolve (label "Auto-resolve" until step 06), shown by the same rule as Attack. `onAutoResolve()` starts `Battle` with `{ game, location: here.id, party: this.selectedParty, auto: true }`. `WorldProbe.buttons.autoResolve` (C4).

### Shared constraints (from the index)

- **Versions:** `LOG_SCHEMA_VERSION` and `SAVE_VERSION` stay 26. The estimate is not saved; it is worked out again after a load.
- **The refactor guard** (`scripts/simulate.test.ts`) is never edited and must stay green; this step does not touch the simulator.
- **Randomness.** The real battle's seed is decided exactly as before (page `?seed=` or `randomSeed()`). The estimate draws only from its samples' own streams; never `Math.random`, `randomSeed`, the world's RNG or the registry's seed.
- **Commands** (local Node 26: prefix `PATH=/opt/homebrew/opt/node@26/bin:$PATH`, or the podman `make` targets): `npm test` (`tsc && vitest run`) is the gate; `npm run test:browser` (or `-- -t <name>`) after this scene change; read `e2e/CLAUDE.md` before adding an in-browser test.
- **Test-first.** Write the failing in-browser tests first, then the code.
- **Commits.** One commit on `main` once `npm test` and the in-browser tests pass, without pushing. Message "Auto-resolve step 06: the estimate on the world map".
- **Docs.** Fix the CLAUDE.md lines and `docs/reference/` text this change makes wrong or incomplete, in this commit (root `CLAUDE.md` under 16 KB, each directory's under 12 KB: `scripts/claudeMd.test.ts`).

## 3. Dependencies and prerequisites

- **Step 02** (`src/game/forecast.ts`, C2 above): `Forecaster`, `workFor`, `worldForecastStart`, `forecastLabel`, `forecastHint`, `FORECAST_SLICE_MS`, all tested in the `domain` project. Import them; do not reimplement.
- **Step 04** (C5 above): the footer's fourth button, Auto-resolve, in `this.buttons`, with `onAutoResolve()` and `WorldProbe.buttons.autoResolve`.
- **Step 05** (C4, battle half): `BattleScene` already runs a `Forecaster` in its `update`, with the label, the hover hint and `BattleProbe.forecast` / `autoLabel`. Follow its pattern (and any small helper it made for the hover hint) so the two screens behave alike. Step 05 also edited `src/testHook.ts`; build on its commit.
- **Existing code at `002457c`** (inspected; line numbers approximate, steps 03–05 shift them):
  - `src/scenes/WorldScene.ts`:
    - `update()` (~424) only calls `applyOrigin()` while walking.
    - `refresh()` (~916) redraws everything after a change and sets the footer rows' visibility; the monster row is `here !== null && !this.walking && world.status !== 'lost'`; it ends with `layout()` and `refreshHover()`. It runs after every change the design lists (a day, a heal, gear, selecting a party, the debug console's `changed`).
    - `refreshHint()` (~1003) writes `hintText` from the hovered hex and the party's standing; the hint has a single colour today.
    - `createButton(label, onClick, width = footerWidth(label))` (~731) builds a container `[bg, text]` of a fixed width; `footerWidth` is `max(MIN_FOOTER_BUTTON_W, label.length * LABEL_CHAR_W + LABEL_PAD)`. A label that changes ("Auto-resolve (…)" → "Auto-resolve (win >95%)") must also resize the button's `bg` and container, and `layout()` must re-centre the row (it centres the visible buttons of each row by their widths).
    - `onAttack()` (~1419) starts `Battle` for the location; step 04's `onAutoResolve()` beside it.
    - `probe()` (~445) builds `WorldProbe`.
    - `walking`, `outcomeShade.visible` (the victory/defeat screen), `world.status`.
  - `src/testHook.ts`: `WorldProbe` (~146), `ButtonProbe` (no label).
  - `e2e/world.test.ts`: "starts a battle when the party attacks" (~364: asserts `battle_start` has `seed: 1` under the default `WINNING_SEED`), "holds the party among monsters until it answers them" (~344), "fits the footer and the order line in the least window" (~628). `e2e/driver.ts`: `travelTo`, `enterBattle`, `hover`, `waitFor`, `settled`, `drag`.

## 4. Scope and guidance

1. **Forecaster state in `WorldScene`.** Fields `forecaster: Forecaster | null`, `forecastKey: string | null`, `forecastResult: Forecast | null`, reset in `create` (Phaser reuses the scene instance).
2. **Start or keep it in `refresh()`.** When the monster row's Auto-resolve is shown (same rule as Attack: among monsters, not walking, game not lost) and the outcome screen is not shown, call `worldForecastStart(this.gameState, this.expedition())`. If non-null, compute the key of decision 4; if it differs from `forecastKey`, start a new `Forecaster(start, base)`, set the key, clear the result. Otherwise (button hidden, or null) drop all three. Never call it while walking.
3. **Work it in `update()`.** Besides `applyOrigin()` while walking: when a forecaster is unfinished, nothing walks, the Auto-resolve button is visible and the outcome screen is not, call `workFor(forecaster, FORECAST_SLICE_MS)`. When it returns a forecast, keep it, set the label and, if the button is hovered, the hint. Do no work while walking: a walk started mid-estimate pauses it, and the `refresh()` after the walk decides whether to keep it (same key) or restart. A paused scene (an overlay over the map) gets no `update`, which pauses it too.
4. **Label.** The Auto-resolve button's label is `forecastLabel(this.forecastResult, false)`: "Auto-resolve (…)" while working or not yet started, the figure once done. Add a small way to change a footer button's label that resizes it by `footerWidth` and re-runs `layout()` (only when the label changed, to avoid churn every frame).
5. **Hover hint.** Hovering the Auto-resolve button sets the header hint to `forecastHint(this.forecastResult)` ("Estimating how auto-resolve would go…" while working), in the hint's normal colour; leaving it restores `refreshHint()`'s line. `refreshHint` must not overwrite the estimate while the button is hovered (e.g. keep a `hoveringAuto` flag that `refreshHint` respects). When the estimate finishes during a hover, the hint updates.
6. **Throw it away on leaving.** `onAttack()` and `onAutoResolve()` drop the forecaster before starting `Battle`. Starting `Battle` reads only the registry's seed or `randomSeed()` as before; the estimate must not read or touch either (it does not, by C2; do not add any call that would).
7. **Probe.** `WorldProbe` gains `forecast: Forecast | null` (the finished estimate for the start in hand, else null) and `autoLabel: string` (the button's label as shown), with doc comments in `src/testHook.ts` (import `Forecast` as a type). Update the `buttons` doc comment that lists what shows among monsters.
8. **Least window.** "Auto-resolve (win >95%)" is the longest label; at 840×560 the monster row (Scout, Wait, Attack, Auto-resolve) must fit right of the party column and clear of the party list. Check it in the in-browser test below; if it does not fit, shorten nothing in the contract's words without recording it as a deviation and telling the orchestrator.
9. **Docs.**
   - `docs/reference/scenes.md`, "The world map" → "Footer": the monster row is Scout, Wait, Attack, Auto-resolve; the button's label carries the estimate, worked out in idle frames from the battle Attack would start, restarted when that battle (the party, its state, the location or the day) changes, and kept otherwise; hovering it gives the estimate's line; it is thrown away on leaving the map. Name `forecast.ts` and the base (location, party, day).
   - `src/scenes/CLAUDE.md`: only if a contract changed (e.g. a line under "Seeds" that the estimate never reads the page's seed nor draws from a game stream), within its 12 KB limit.

**Exclusions:** no change to `forecast.ts`'s behaviour (if it needs one, record it and tell the orchestrator); no battle-screen change (step 05); no manual text or screenshots (step 07).

## 5. Verification

Write these in `e2e/world.test.ts` first (a `describe('the auto-resolve estimate')` or beside the attack tests), with the default `WINNING_SEED` unless a test says otherwise:

- **A9, label and hover:** a new game travels to the nearest lair (as "holds the party among monsters until it answers them" does); the probe's `buttons.autoResolve` is visible and `autoLabel` is "Auto-resolve (…)" or already a figure; `waitFor('World', (w) => w.forecast !== null)`; then `autoLabel` matches `/^Auto-resolve \(win (>95%|<5%|\d{1,2}%)\)$/` and `forecast.samples` is 40 with `wins + (samples - wins) === samples`. Hovering `buttons.autoResolve` gives a `hint` starting "Estimate from 40 trial battles with the AI playing your side"; moving the pointer away gives the standing hint back ("Monsters! …" or "Scout, wait or attack, …").
- **A9, responsive:** while the estimate works (right after arriving, `forecast === null`), a hover over another hex updates the probe's `info` (or a drag pans the map, `origin` moving) before the estimate is done or soon after: the map answers while it works. Wait on state, not time.
- **A9, kept and restarted:** after the estimate is done, a refresh that changes nothing (e.g. clicking a portrait to mark another member) keeps `forecast` non-null with the same value; Scout (a day passes) gives `forecast === null` or a new estimate, then a figure again.
- **A10, the seed:** two games opened with the same `?seed=` (e.g. `WINNING_SEED`): one presses Attack as soon as the button shows; the other waits for `forecast !== null`, then presses Attack. Both battles' `log[0]` (`battle_start`) have the same `seed`, and their first player turns' logs are identical (compare `battle.log` at the first `playerControl`).
- **Least window:** at 840×560, before a lair, Scout, Wait, Attack and Auto-resolve (with its figure, after the estimate) are visible, `x` between 80 and 840 − 80, not overlapping one another (each button's centre at least the sum of half-widths apart; use `x` spacing, not pixels hard-coded), and `y < 560`.

Then:

- `npm test` passes (tsc included); the guard is green and unedited.
- `npm run test:browser -- -t "auto-resolve"` (or the describe's name), then the whole `npm run test:browser`, passes, with no console error.

## 6. Completion criteria

- [ ] The world map works out the estimate in slices only while idle (not walking, button shown, no outcome screen), keyed by decision 4, dropped on leaving.
- [ ] The button's label and the hover hint follow C4; the row lays out again when the label's width changes.
- [ ] `WorldProbe.forecast` and `autoLabel` (C4) with doc comments.
- [ ] In-browser tests for A9 (label, hover, responsive, kept/restarted), A10 (the seed) and the least window pass; `npm test` passes; guard unedited.
- [ ] `docs/reference/scenes.md` footer text (and `src/scenes/CLAUDE.md` if a contract changed) updated.
- [ ] One commit on `main`; the index's row 06 updated with status and hash.

## 7. Execution record

**2026-11-20, engineer.** Done.

- **Built:** `WorldScene` gains `forecaster`, `forecastKey`, `forecastResult`, `autoHovered` (reset in `create`). `refresh()` ends with `refreshForecast()`: a new `Forecaster` only when the key `base:JSON(start)` differs (decision 4), dropped when the Auto-resolve button is hidden, while walking, or the game is over. `update()` works `workFor(…, FORECAST_SLICE_MS)` only when not walking, the button shows and no outcome screen. `setAutoLabel()` sets the label (`forecastLabel(…, false)`), resizes the button and its `bg` by `footerWidth` and runs `layout()` only when the label changed (`createButton` now keeps `bg` and `text` as container data). Hover on the button sets `autoHovered`; `refreshHint()` shows `forecastHint` while it is set and the button shows. `onAttack`/`onAutoResolve` call `dropForecast()` first. `WorldProbe.forecast` and `autoLabel` added; `ButtonProbe` gained an optional `width` (from `buttonProbe`) so tests can bound a button's edges.
- **Tests (`e2e/world.test.ts`, `describe('the auto-resolve estimate')`):** label and hover hint, responsive while it works, kept after marking a member and restarted after Scout's day, and A10 (two games with the same seed, one pressing Attack at once and one after the estimate: same `battle_start` seed 1 and identical first-turn log). Written after the code, so no red run was seen; they were not checked against a broken implementation.
- **Review nits folded in:** (1) "fits the monster row in the least window" now waits for the estimate, then bounds each button's left edge by the party column (`view.x`), its right edge by the screen (840), and each button clear of the previous one. (2) `showHint()`'s doc comment moved back above it in `BattleScene.ts`. (3) The A9 battle test asserts `forecast` null and `autoLabel` "Auto (…)" right after the move click.
- **Verification:** `npm test` 95 files, 2310 tests passed (guard unedited); `npm run test:browser -- -t "auto-resolve|least window|labels Auto"` 20 passed; the full browser suite result is in the commit report.
- **Deviations:** none to the contract's words. Docs: `docs/reference/scenes.md` (footer) and the "Seeds" line of `src/scenes/CLAUDE.md`.
- **Known and unchanged:** if the pointer leaves the hovered button while it hides during a walk, `autoHovered` stays set until the next drop; harmless (the hint shows it only while the button shows, and `dropForecast` clears it).
- **For step 07:** the footer shows "Auto-resolve (win NN%)" only after the estimate is ready (seconds), so screenshots must wait on `forecast !== null`.

