# Step 03: Auto-resolve on the battle screen

[Plan index](index.md) · [Design](../../designs/auto-resolve.md) (§4.2 From the battle screen, §4.3 What resolving does, §4.4 What the player sees, §4.5 Edge cases, §5.3 The battle scene) · [Feature record](../../features/auto-resolve.md)

**Suggested engineer:** opus (leave the model unset). The step reworks the battle's control flow: it bypasses event playback, must still play the end sting through the usual path, hands an unfinished battle back through `continueBattle`, and must not disturb saving or the tutorial.

## 1. Objective

The battle screen gains a fourth button, **Auto**, enabled exactly when End Turn is. Pressing it resolves the rest of the battle at once from the state it is in (mid-turn included) with `playOut`: the heroes played by `AUTO_POLICY`, the foes by `ENEMY_POLICY` on the scene's existing enemy stream. The log gets every event's line, the board jumps to the final state, and the played battle's `endBattle` runs unchanged, with one added result line "Auto-resolved in N rounds." If the battle is not over after `AUTO_ROUND_LIMIT` rounds, it is handed back to the player. The scene also accepts `auto: true` in its data, so that step 04's world-map button can start a battle that resolves from its first moment. No estimate yet (step 05 adds the figure to the label).

## 2. Requirements and context

- **R2:** an Auto-resolve button on the battle screen resolves the rest of the battle from where it stands; enabled exactly when End Turn is (the player has control); hidden once the battle is over.
- **R3:** every battle the game fights: a battle taken up from a save and a debug console `fight` included. The world map's battles arrive through `auto: true` (step 04).
- **R4:** the player's side by `AUTO_POLICY` (`'aggressive'`), the enemy by the battle's enemy policy on its own seeded stream, exactly as in a played battle.
- **R5:** at once: no per-event animation or sound. The board then shows the final state (positions, facing, hit points, the fallen faded) and the log holds every event's line, as a battle taken up from a save shows its past.
- **R6:** the played battle's result screen, with one line added saying it was auto-resolved and over how many rounds; the victory or defeat sting and the level-up sting play as for a played battle.
- **R7:** everything downstream is the played battle's (`takeLoot`, `takeRunes`, `clearLocation`, mana and hit points carried, `rewardVictory`, `wipeParty`, the save). No new code path settles a battle.
- **R8:** deterministic; a battle auto-resolved from its start records `playerPolicy: AUTO_POLICY` in `battle_start`'s `meta`.
- **R9:** if not over `AUTO_ROUND_LIMIT` (50) rounds after auto-resolve began, stop, say so in the log, hand the battle back to the player.
- **Design §4.2:** no key binding (a stray key must not commit a battle). Pressing it closes the Skills list and any aiming. Heroes that already acted keep what they did; the policy plays the rest of the turn with the AP they have left.
- **Design §4.5:** a side already down at the start (`playOut` returns at once, over); the limit reached in the enemy's phase (control returns through `runEnemyAction`, played and animated as normal); a debug `fight` (no location: a win gives experience but clears nothing, takes no loot, rolls no runes, and is not saved mid-battle, as today); `?seed=` used as for any battle; reloading: the run is synchronous between the turn's save and the end's save, so no reload sees a half-resolved battle.
- **Design §4.1:** a battle auto-resolved from its start plays no turn by hand, so no `battle_turn` story moment is raised and the battle tutorial's tips wait for the first battle the player plays.
- **Design §5.3:** the player's policy stream is not saved; a later press seeds a fresh one from the battle's seed.

### Contract C3 (copied unchanged from the index)

- `BattleData` gains `auto?: boolean`. A fresh battle with `auto` adds `playerPolicy: AUTO_POLICY` to `battle_start`'s meta (beside `source`, `enemyPolicy`, `party`), logs its opening events as lines with no playback (decision 6), then calls `autoResolve()` in place of `continueBattle()`. A restored battle ignores `auto`.
- `autoButton`: a fourth battle button, labelled "Auto" (step 05 adds the figure), in the row Attack, Skills, End Turn, Auto at `BUTTON_SPACING`, the row centred where the three are today (x = `centreX + (i - 1.5) * BUTTON_SPACING`). Enabled exactly when End Turn is (`setPlayerControl`), hidden in `endBattle` with the others, no key binding.
- `autoResolve()`: `setPlayerControl(false)`, clear `targeting`; `playerRng = mulberry32((battleSeed(log) ?? 0) + 2)`; `startRound = round`; `playOut(engine, { policies: { player: AUTO_POLICY, enemy: ENEMY_POLICY }, rngs: { player: playerRng, enemy: this.enemyRng }, lastRound: startRound + AUTO_ROUND_LIMIT })`; push every returned event's `formatEvent` line but a final `battle_end` and render the log; bring the board to the engine's state (a helper shared with `showRestored`: fallen faded, `syncUnitsFromEngine`, ground marks); then, if over, `showEvent(battle_end)` (its line, cues, music stop, `endShownAt`), set `autoRounds = finalRound - startRound + 1`, and `endBattle()`; else push `AUTO_DRAG_ON_LINE` and `continueBattle()`.
- `autoRounds: number | null`, reset in `create`; `endBattle` puts `autoResolvedLine(autoRounds)` second in the result (after "<Foes> are beaten." or the first defeat line) when non-null.
- `src/scenes/battleSetup.ts`: `export function autoResolvedLine(rounds: number): string` → "Auto-resolved in 1 round." / "Auto-resolved in N rounds."; `export const AUTO_DRAG_ON_LINE = 'The battle drags on. It is yours to finish.'`
- `BattleProbe.buttons.auto: ButtonProbe`.

### Decisions from the index that apply

- **Decision 6:** an auto-resolve from the world map logs the battle's opening events as lines without playing them (as `showRestored` does), then resolves; a played battle's opening is unchanged.
- **Decision 8:** the `scenes` project's smoke tests only check that a scene registers; they cannot run `create`. The design's smoke case ("a scene started with `auto: true` ends with the result screen") is covered by in-browser tests instead (this step and step 04).

### Shared constraints (from the index)

- **Versions:** `LOG_SCHEMA_VERSION` stays 26 and `SAVE_VERSION` stays 26. `battle_start.meta.playerPolicy` is a free-form meta key, not a shape change. Do not edit either constant.
- **The refactor guard** (`scripts/simulate.test.ts`, `describe('the refactor guard')`) is never edited and must stay green. This step does not touch the simulator.
- **Randomness.** Nothing outside the engine draws from a battle's stream. The real battle's seed is decided exactly as before (page `?seed=` or `randomSeed()`). The player's policy stream is a stream of its own (`seed + 2`), beside the enemy's (`seed + 1`).
- **Commands** (local Node 26: prefix `PATH=/opt/homebrew/opt/node@26/bin:$PATH`, or use the podman `make` targets): `npm test` (`tsc && vitest run`) is the gate before every commit; `npx vitest run src/scenes/battleSetup.test.ts`; `npm run test:browser` (or `-- -t <name>`) after the scene change; read `e2e/CLAUDE.md` before adding an in-browser test.
- **Test-first.** Write the failing tests first, then the code.
- **Commits.** One commit on `main`, once `npm test` passes, without pushing. Message "Auto-resolve step 03: auto-resolve on the battle screen".
- **Docs.** Fix the CLAUDE.md lines and `docs/reference/` text this change makes wrong or incomplete, in the same commit (each directory's `CLAUDE.md` under 12 KB: `scripts/claudeMd.test.ts`).

## 3. Dependencies and prerequisites

- **Step 01** (required) produces `src/engine/autoPlay.ts` (contract C1). This step consumes:

  ```ts
  export const AUTO_POLICY: PolicyName = 'aggressive'
  export const ENEMY_POLICY: PolicyName = 'aggressive'   // moved here from BattleScene; BattleScene imports it
  export const AUTO_ROUND_LIMIT = 50
  export interface PlayOutOptions {
    policies: Record<Side, PolicyName>
    rngs: Record<Side, RNG>
    /** No step is taken once the round is past this one. */
    lastRound: number
  }
  export interface PlayOut {
    events: BattleEvent[]   // every event the steps produced, in order
    over: boolean           // true when the battle ended; false when it stopped past lastRound
  }
  export function playOut(engine: BattleEngine, options: PlayOutOptions): PlayOut
  ```

  `playOut` never abandons and draws nothing itself. If step 01 is not done, stop: this step is blocked.
- **Not needed:** step 02 (`forecast.ts`); the estimate arrives in step 05. Step 04 (the world button) depends on this step.
- **Existing code at `002457c` (inspected):**
  - `src/scenes/BattleScene.ts`:
    - `interface BattleData` (around line 97): `game`, `party`, `location`, `encounter`, `threat`, `saved`.
    - `const ENEMY_POLICY: PolicyName = 'aggressive'` (around line 233); after step 01 it is imported from `autoPlay.ts`.
    - `create` (around 352–533): a restored battle (`BattleEngine.restore(saved.engine)`, `enemyRng = mulberry32(saved.enemyRng)`), else `new BattleEngine(setup, { seed, meta: { source: 'game', enemyPolicy: ENEMY_POLICY, party: this.expedition.id } })` and `enemyRng = mulberry32(seed + 1)`. Per-battle fields are reset explicitly (Phaser reuses the scene instance: `endShownAt`, `savedRound`, `playerControl`, `targeting`, …). It ends with `if (saved) this.showRestored(); else this.applyEvents(this.engine.getLog())`, then `this.continueBattle()`.
    - `showRestored()` (around 540): pushes `formatEvent` of every logged event, `renderLog`, fades the fallen (`showFallen`), `refreshGroundMarks`, `syncUnitsFromEngine`.
    - `createButton(label, onClick)` (around 807): 140×44, keeps input enabled when disabled, `getData('enabled')`.
    - `layout()` (around 862): `attackButton` at `centreX - BUTTON_SPACING`, `castButton` at `centreX`, `endTurnButton` at `centreX + BUTTON_SPACING` (`BUTTON_SPACING` 160).
    - `showEvent(event)` (around 1444): pushes the line; on `battle_end` stops `music_battle` and sets `endShownAt`; plays `eventSounds`.
    - `setPlayerControl(enabled)` (around 1968): closes the Skills list, clears stale targeting, enables Attack/Skills, `setButtonEnabled(this.endTurnButton, enabled)`.
    - `playerAct`, `onEndTurn`, `continueBattle()` (around 2176: `'over'` → `endBattle`; `'enemy'` → `runEnemyAction`; else on a new round raises the `battle_turn` story moment and `save()`s, then `setPlayerControl(true)`).
    - `save()`: no mid-battle save without a location (a debug fight).
    - `endBattle()` (around 2256): hides Attack, Skills, End Turn; settlement; result text `[`${foes} are beaten.`, ...xpLines, ...lootLines]` on a win, `this.defeatLines(wipe)` on a loss; level-up sting timed from `endShownAt`.
    - `probe()` (around 564): `buttons: { attack, cast, endTurn, result }`.
  - `src/scenes/battleSetup.ts`: `battleSeed(log)`, `chooseBattle`, `foundNames`; tests in `src/scenes/battleSetup.test.ts`.
  - `src/testHook.ts`: `BattleProbe` (around line 362), `ButtonProbe { x, y, visible, enabled }`.
  - `src/scenes/WorldScene.ts` `debugSource().fight` starts `Battle` with `{ game, encounter, threat, party }` (no `auto`).
  - `e2e/battle.test.ts`, `e2e/driver.ts` (`enterBattle`, `fightBattle`, `loseBattle`, `awaitTurn`, `reload`), `e2e/saves.test.ts` (the "saved in battle" reload test).

## 4. Scope and guidance

1. **`battleSetup.ts`** (test-first in `battleSetup.test.ts`): `autoResolvedLine(rounds)` and `AUTO_DRAG_ON_LINE` exactly as C3.
2. **Scene data and meta.** `BattleData.auto?: boolean`. In `create`, for a fresh battle (`!saved`) with `data.auto`, add `playerPolicy: AUTO_POLICY` to the `BattleEngine` meta. Reset `autoRounds = null` with the other per-battle fields.
3. **The opening.** Factor the board part of `showRestored` into a helper (say `showBoardAsItStands()`: fade the fallen, ground marks, `syncUnitsFromEngine`); `showRestored` = log refill + `renderLog` + that helper. For a fresh `auto` battle, refill the log from the opening events and show the board with no playback (decision 6), then call `autoResolve()` instead of `continueBattle()`. A saved battle ignores `auto` and takes the existing path. A played battle's opening (`applyEvents`) is unchanged.
4. **The button.** `autoButton = this.createButton('Auto', () => this.onAutoResolve())`. `onAutoResolve` does nothing without `playerControl` (as `onEndTurn`). `setPlayerControl` sets its enabled state with End Turn's; `endBattle` hides it with the others; `layout` places the row of four at `centreX + (i - 1.5) * BUTTON_SPACING` (Attack, Skills, End Turn, Auto). Check the Skills list (`openSkillMenu` places itself over `castButton`) and the tutorial anchors still sit right, and that the row fits right of the party column at 840 wide (620 px in 760). No key binding.
5. **`autoResolve()`** exactly as C3. Notes:
   - `setPlayerControl(false)` closes the Skills list; also set `targeting = null` and clear any selection highlight state that would otherwise linger.
   - Push lines through the log without `showEvent` (no floats, no cues) for every event except a final `battle_end`; then `renderLog`, then the board helper; then, if over, `showEvent(battle_end)` so its line, the sting cue, the music stop and `endShownAt` happen as in a played battle (the level-up sting in `endBattle` times itself from `endShownAt`). Make sure no tween started by the opening or by earlier playback fights the jump to the final state (in a mid-battle press nothing is playing, since control is only given once playback ends).
   - `autoRounds = engine.getState().round - startRound + 1` when over.
   - Not over (limit reached): push `AUTO_DRAG_ON_LINE`, render, `continueBattle()`. In the enemy's phase that runs `runEnemyAction`, played and animated as normal; at the player's new round `continueBattle` raises the story moment and saves as any turn does. Do not save inside `autoResolve`: the turn's save (already made as the turn began) and `endBattle`'s save bracket the synchronous run.
   - The player's stream is created on each press and never saved.
6. **`endBattle`:** when `autoRounds !== null`, insert `autoResolvedLine(autoRounds)` as the second result line (after "<Foes> are beaten." on a win, after the first of `defeatLines(wipe)` on a loss). Nothing else in the settlement changes.
7. **Story.** A from-start auto battle never calls `continueBattle` before the end (unless handed back), so no `battle_turn` moment is raised; check that `endBattle` and the result screen raise none either.
8. **Probe:** `buttons.auto: buttonProbe(this.autoButton, enabled(this.autoButton))`; add `auto: ButtonProbe` to `BattleProbe.buttons` in `src/testHook.ts`, with a doc comment.
9. **Docs:** `docs/reference/scenes.md`, "The battle screen": the Auto button (where it sits, when it is enabled, no key), what resolving does (lines, final board, sting, the result line, the 50-round hand-back with its line), the `auto` scene data and `meta.playerPolicy`. `src/scenes/CLAUDE.md`: add the new control only if a contract line needs it (the "Seeds" contract may gain "the auto-resolve player's policy stream is the seed plus two"); keep under 12 KB.

**Exclusions:** no world-map button (step 04); no estimate, figure on the label, hover hint or `forecast` probe (step 05); no change to `endBattle`'s settlement, to the simulator, to events or saves.

### Reaching the code in tests

Debug `fight` cannot pass `auto`, and the world button arrives in step 04, so the from-start path (`auto: true`, `meta.playerPolicy`) is tested in the browser by step 04. Here, test it at least by hand (dev server, `?seed=1`, temporarily or through the debug console starting a fight then pressing Auto at round 1) and record what you did. The mid-battle press, which covers the same `autoResolve`, is tested in the browser below.

## 5. Verification

- **Unit:** `npx vitest run src/scenes/battleSetup.test.ts`: `autoResolvedLine(1)` is "Auto-resolved in 1 round.", `autoResolvedLine(4)` "Auto-resolved in 4 rounds."; `AUTO_DRAG_ON_LINE` is the exact text.
- **`npm test`** passes; the refactor guard is green and unedited.
- **In-browser** (`e2e/battle.test.ts`, test-first; follow `e2e/CLAUDE.md`: probes only, wait on state, no sleeps):
  - **A2:** `enterBattle`, make one played move (as the existing "moves a hero to a clicked hex" test does), wait for control, click `buttons.auto`; the probe's `state.phase` is `'over'` and `result` has `autoResolvedLine` as its second line (VICTORY with `WINNING_SEED`, or adapt the assertion to the outcome); the log ends with `battle_end`; `buttons.auto`, `attack`, `endTurn` are hidden. Read the slot back from `localStorage` (`yomi.save.1`) with `page.evaluate`: no saved battle, the location gone on a win (or the party wiped on a loss) and the members' experience as the result says.
  - **Disabled when not in control:** after End Turn, while the enemy plays (`playerControl` false, phase `'enemy'`), `buttons.auto.enabled` is false; it is enabled again when control returns.
  - **A battle taken up from a save auto-resolves (R3):** enter a battle, `reload()` (the turn's save restores it, as `e2e/saves.test.ts`'s "saved in battle" test does), then Auto; the result shows with the auto-resolved line.
  - The existing battle, saves and story tests still pass (the button row moved): `npm run test:browser -- e2e/battle.test.ts`, then the whole `npm run test:browser`.
- **By hand:** a from-start auto battle (as above) shows the final board and the result at once, the sting plays, and no tutorial tip appears.

## 6. Completion criteria

- [x] `autoResolvedLine` and `AUTO_DRAG_ON_LINE` in `battleSetup.ts`, unit-tested.
- [x] `BattleData.auto`, `meta.playerPolicy` on a from-start auto battle, the opening logged with no playback, `autoResolve()` in place of `continueBattle()`; a restored battle ignores `auto`.
- [x] The Auto button in a row of four, enabled with End Turn, hidden at the end, no key; `buttons.auto` in the probe and `BattleProbe`.
- [x] `autoResolve()` per C3: lines, final board, `battle_end` through `showEvent`, unchanged `endBattle` plus the result line; the drag-on hand-back through `continueBattle`; no save inside the run.
- [x] In-browser tests for A2, the disabled state and the reloaded battle pass; the whole `npm run test:browser` passes; `npm test` passes with the guard unedited.
- [x] `docs/reference/scenes.md` (and `src/scenes/CLAUDE.md` if needed) updated.
- [x] One commit on `main`; the index's row 03 updated with status and hash.

## 7. Execution record

### Execution record (2026-11-20)

**Built.** `autoResolvedLine` and `AUTO_DRAG_ON_LINE` in `battleSetup.ts`; in `BattleScene`: `BattleData.auto`, `meta.playerPolicy: AUTO_POLICY` on a fresh `auto` battle, `autoRounds`, the Auto button (row of four at `centreX + (i - 1.5) * BUTTON_SPACING`, enabled in `setPlayerControl` with End Turn, hidden in `endBattle`, no key), `onAutoResolve` (needs `playerControl`), `autoResolve(lead = [])` per C3, and `showBoardAsItStands()` shared with `showRestored`; `endBattle` puts `autoResolvedLine` second; `buttons.auto` in the probe and `BattleProbe`.

**Choices within the contract.**
- `autoResolve` takes the fresh battle's opening events as `lead`, so the opening's lines and the run's go into the log together and a final `battle_end` is split off whichever list it is in (covers a side already down at the start: `playOut` returns at once, `autoRounds` 1).
- `showBoardAsItStands` also places every unit at its engine position (`placeUnit`) and stands up a unit with a hidden plate that is standing again (`standUp`), since a mid-battle press jumps over moves and revivals that `showRestored` never had to undo.
- `autoResolve` clears `targeting` and the hovered hex before `setPlayerControl(false)`, so no aiming, path arrow or Skills list lingers.

**Verification.**
- Red first: `npx vitest run src/scenes/battleSetup.test.ts` failed 2 (`autoResolvedLine is not a function`, `expected undefined`); green after: 9 passed.
- Red first: `npm run test:browser -- -t "auto-resolve on the battle screen"`: 3 failed (`buttons.auto` undefined); green after: 3 passed. Tests in `e2e/battle.test.ts`, `describe('auto-resolve on the battle screen')`:
  - **A2** "resolves the rest of a battle at once from a played move, to the played battle’s result and save (A2)": one hand move, Auto; phase over, VICTORY with `WINNING_SEED`, log ends `battle_end`, result `[ "The Goblin Raiders are beaten.", autoResolvedLine(rounds), … ]`, Auto/Attack/End Turn hidden; slot has `battle: null`, the raiders gone, levels as the result; from the press on, only `ui.click`, `stings.victory`, then `stings.level_up` are heard (no `battle.*` playback cue).
  - "is greyed while the enemy plays, and enabled again when control returns".
  - "resolves a battle taken up from a save" (reload, Continue, Auto: result with the auto-resolved line).
- `npm test`: 95 files, 2309 tests passed (refactor guard green, `scripts/simulate.test.ts` untouched).
- `npm run test:browser` (whole suite, foreground): 12 files, 145 tests passed.
- `npm run build`: passes (the usual chunk-size warning only).
- `LOG_SCHEMA_VERSION` and `SAVE_VERSION` still 26.
- **By hand (from-start path):** a throwaway in-browser script with `WorldScene`'s Attack temporarily passing `auto: true` (reverted; not committed), tutorial ticked on, seed 1: `battle_start.meta` was `{ source: 'game', enemyPolicy: 'aggressive', party: 'party_1', playerPolicy: 'aggressive' }`; the result showed at once with "Auto-resolved in 4 rounds." second; cues after the click were `stings.victory`, `stings.level_up`; only `Battle` running, no `Story` overlay (no tutorial tip). The world button and its in-browser test come in step 04.

**Docs.** `docs/reference/scenes.md`: new "Auto-resolve" section under the battle screen, `battleSetup.ts` line, Seeds (plus two). `src/scenes/CLAUDE.md`: Seeds contract and `battleSetup.ts` line (9552 bytes).

**For later steps.** Step 04 starts `Battle` with `auto: true`; its in-browser test should wait on `buttons.result.visible`, not `playerControl` (`enterBattle` would time out). Step 05: the Auto button is `this.autoButton` (140 px wide, label "Auto"); `setPlayerControl(true)` runs on every selection and aim, as decision 5 says.

