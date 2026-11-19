# Step 04: Auto-resolve on the world map

[Plan index](index.md) · [Design](../../designs/auto-resolve.md) (§4.1 "From the world map", §5.4 "The world map", §7.2) · [Feature record](../../features/auto-resolve.md)

**Suggested engineer:** sonnet. The button follows the footer's existing Attack button and starts the battle path step 03 built; the work is mostly in-browser tests.

## 1. Objective

On the world map, while the selected party stands among monsters, the footer offers **Auto-resolve** beside Scout, Wait and Attack. A click starts `Battle` with `auto: true`, and the battle scene opens on the battle's final board with the result screen over it (step 03). After this step auto-resolve works end to end from the map, with no estimate yet. The label is the plain "Auto-resolve"; step 06 adds the figure.

## 2. Requirements and context

- **R1:** on the world map, while the selected party stands among monsters, the footer offers Auto-resolve beside Scout, Wait and Attack, under the same rule as Attack. It fights that location's battle without the player playing it.
- **R3:** every battle the game fights, the vanguard's and a lesser party's alike, every encounter. The button acts for the **selected** party, as Attack does (`blockingParty` already selects a lesser party whose monsters block the days).
- **R7:** everything after the battle is the played battle's (`takeLoot`, `takeRunes`, `clearLocation`, `rewardVictory`, `wipeParty`, the save). This step adds no settlement code. It only starts the battle.
- **R8:** with the same seed and state, the same battle. An auto-resolved battle from its start has `meta.playerPolicy: 'aggressive'` in `battle_start` (written by step 03).
- §4.1: the button acts at once, with no confirmation (§8.2, answered). No `battle_turn` story moment is raised for a battle auto-resolved from its start (step 03 handles this: `autoResolve` replaces `continueBattle`).
- **Acceptance criteria this step proves in the browser:**
  - **A1:** a party confronting a threat-1 lair presses Auto-resolve on the world map. The battle screen shows the final board and the result screen at once, with the auto-resolved line. OK returns to the world map with the location cleared, the experience given and the loot in the baggage.
  - **A3:** the same seed and the same press give the identical event log twice. A battle auto-resolved from its start has `meta.playerPolicy: 'aggressive'` in its `battle_start`.
  - **A6:** a lost auto-resolved battle wipes the party exactly as a lost played battle does. With heroes left elsewhere it saves and returns to the world map. With none left it deletes the slot and offers Main Menu.

### Contract C5 (copied unchanged from the index)

- `this.buttons` becomes Scout, Wait, Attack, Auto-resolve (label "Auto-resolve" until step 06), shown by the same rule as Attack. `onAutoResolve()` starts `Battle` with `{ game, location: here.id, party: this.selectedParty, auto: true }`. `WorldProbe.buttons.autoResolve` (C4).

### Contract C4 (copied unchanged from the index; this step adds only `WorldProbe.buttons.autoResolve`)

- `BattleProbe` gains `forecast: Forecast | null` (the finished estimate for the battle as it stands, else null) and `autoLabel: string` (the Auto button's label).
- `WorldProbe.buttons` gains `autoResolve: ButtonProbe` (step 04); `WorldProbe` gains `forecast: Forecast | null` and `autoLabel: string` (step 06).
- Battle label `forecastLabel(f, true)`; world label `forecastLabel(f, false)`. Hovering the button sets the screen's hint to `forecastHint(f)` in the hint's normal colour, not the warning colour; leaving it restores the hint. The scene's `update` calls `workFor(forecaster, FORECAST_SLICE_MS)` while a forecaster is unfinished and the screen is idle (battle: `playerControl`; world: not walking, an Auto-resolve button shown); a finished one updates the label (and the hint if hovered).

### Contract C3 (copied unchanged from the index; produced by step 03, consumed here)

- `BattleData` gains `auto?: boolean`. A fresh battle with `auto` adds `playerPolicy: AUTO_POLICY` to `battle_start`'s meta (beside `source`, `enemyPolicy`, `party`), logs its opening events as lines with no playback (decision 6), then calls `autoResolve()` in place of `continueBattle()`. A restored battle ignores `auto`.
- `autoButton`: a fourth battle button, labelled "Auto" (step 05 adds the figure), in the row Attack, Skills, End Turn, Auto at `BUTTON_SPACING`, the row centred where the three are today (x = `centreX + (i - 1.5) * BUTTON_SPACING`). Enabled exactly when End Turn is (`setPlayerControl`), hidden in `endBattle` with the others, no key binding.
- `autoResolve()`: `setPlayerControl(false)`, clear `targeting`; `playerRng = mulberry32((battleSeed(log) ?? 0) + 2)`; `startRound = round`; `playOut(engine, { policies: { player: AUTO_POLICY, enemy: ENEMY_POLICY }, rngs: { player: playerRng, enemy: this.enemyRng }, lastRound: startRound + AUTO_ROUND_LIMIT })`; push every returned event's `formatEvent` line but a final `battle_end` and render the log; bring the board to the engine's state (a helper shared with `showRestored`: fallen faded, `syncUnitsFromEngine`, ground marks); then, if over, `showEvent(battle_end)` (its line, cues, music stop, `endShownAt`), set `autoRounds = finalRound - startRound + 1`, and `endBattle()`; else push `AUTO_DRAG_ON_LINE` and `continueBattle()`.
- `autoRounds: number | null`, reset in `create`; `endBattle` puts `autoResolvedLine(autoRounds)` second in the result (after "<Foes> are beaten." or the first defeat line) when non-null.
- `src/scenes/battleSetup.ts`: `export function autoResolvedLine(rounds: number): string` → "Auto-resolved in 1 round." / "Auto-resolved in N rounds."; `export const AUTO_DRAG_ON_LINE = 'The battle drags on. It is yours to finish.'`
- `BattleProbe.buttons.auto: ButtonProbe`.

### Shared constraints (from the index)

- **Versions:** `LOG_SCHEMA_VERSION` stays 26 and `SAVE_VERSION` stays 26. `battle_start.meta.playerPolicy` is a free-form meta key, not a shape change. Do not edit either constant.
- **The refactor guard** (`scripts/simulate.test.ts`, `describe('the refactor guard')`) is never edited and must stay green. This step does not touch the simulator.
- **Randomness.** Nothing outside the engine draws from a battle's stream. The real battle's seed is decided exactly as before (the page's `?seed=` or `randomSeed()`). This step adds no draw anywhere.
- **Commands** (local Node 26: prefix `PATH=/opt/homebrew/opt/node@26/bin:$PATH`, or use the podman `make` targets): `npm test` (`tsc && vitest run`) is the gate before the commit; `npx vitest run <file>` for one file; `npm run test:browser` (or `-- -t <name>`) after this scene change. Read `e2e/CLAUDE.md` before adding an in-browser test.
- **Test-first.** Write the failing in-browser tests first, then the button.
- **Commits.** One commit on `main`, once `npm test` and `npm run test:browser` pass, without pushing. Message "Auto-resolve step 04: auto-resolve on the world map".
- **Docs.** Fix the CLAUDE.md lines and `docs/reference/` text this change makes wrong or incomplete, in the same commit (root `CLAUDE.md` under 16 KB, each directory's under 12 KB: `scripts/claudeMd.test.ts`).

## 3. Dependencies and prerequisites

- **Step 03 (required, done first).** It provides `BattleData.auto` and the whole auto-resolve path in `BattleScene` (C3): `battle_start.meta.playerPolicy`, `autoResolve()`, the "Auto-resolved in N rounds." result line, and `endBattle` run unchanged, with its loot, runes, `clearLocation`, `rewardVictory`, `wipeParty`, save and slot deletion. If step 03 is not in the log (`git log --oneline | grep "Auto-resolve step 03"`), stop: this step has nothing to start.
- **Not needed:** steps 01–02 are behind step 03 already. Step 06 later builds on this button (label with the figure, hover hint, `forecast` and `autoLabel` in the probe). Do not add those here.
- **Existing code at `002457c`** (inspected; line numbers approximate):
  - `src/scenes/WorldScene.ts`:
    - `create`, around line 311: `this.buttons = [Scout, Wait, Attack]`, each `this.createButton(label, onClick)`, whose width is `WorldScene.footerWidth(label)` (the label's length × `LABEL_CHAR_W` + `LABEL_PAD`, at least `MIN_FOOTER_BUTTON_W`).
    - `refresh()`, around lines 916–960: `for (const button of this.buttons) button.setVisible(here !== null && !this.walking && world.status !== 'lost')`, followed by the comment "Among monsters, confronting them or not, the footer offers only Scout, Wait and Attack." `layout()` lays out `[this.buttons, buttonY]` as a centred row of the visible buttons.
    - `probe()`, around line 445: `const [scout, wait, attack] = this.buttons.map((button) => buttonProbe(button))`, then `buttons: { scout, wait, attack, ... }`.
    - `onAttack()`, around line 1419: `const here = monstersHere(this.world, this.expedition()); if (here) this.scene.start('Battle', { game: this.gameState, location: here.id, party: this.selectedParty })`.
    - `refreshHint()`: "Monsters! Scout them, wait, or attack." and "Scout, wait or attack, or click a hex to move away."
  - `src/testHook.ts`: `WorldProbe.buttons` (around line 172), with `scout`, `wait` and `attack` documented together in the comment above `buttons` ("Scout, Wait and Attack show among monsters ...").
  - `e2e/driver.ts`: `RAIDERS` (`goblin_raiders` at `offsetToHex(13, 18)`), `newGame`, `travelTo`, `enterBattle` (newGame, travelTo RAIDERS, click Attack, wait for `Battle`), `loseBattle` (End Turn until over), `WINNING_SEED = 1`, `open({ seed })`.
  - `e2e/world.test.ts`: "starts a battle when the party attacks" (asserts `battle_start` with `seed: 1, meta: { source: 'game', party: 'party_1' }`); "fits the footer and the order line in the least window" (resizes to 840×560 and checks the time and camp rows lie within 80 px of each side).
  - `e2e/battle.test.ts`: "returns a victorious party to the world map, with the monsters gone"; "ends the game at the main menu when the party falls" (single party: `loseBattle`, result, `Menu`, Continue disabled); "goes on at the world map when a party falls while another lives, its baggage left at the nest (A9)" (plants a second party in slot `yomi.save.1` with `page.evaluate`, then reloads).
  - Debug console (`debugCommands.ts`): `hp <amount> [member|all] [@party]` sets hit points on the world map.

## 4. Scope and guidance

1. **The button** (`WorldScene.ts`).
   - Add `this.createButton('Auto-resolve', () => this.onAutoResolve())` as the fourth of `this.buttons`. Its visibility follows from the existing loop in `refresh()`. Update the comment to "Scout, Wait, Attack and Auto-resolve".
   - `onAutoResolve()`, beside `onAttack`: `const here = monstersHere(this.world, this.expedition()); if (here) this.scene.start('Battle', { game: this.gameState, location: here.id, party: this.selectedParty, auto: true })`. Do not add a confirmation or a key binding.
   - Check the row still fits the least window. Four buttons ("Scout", "Wait", "Attack", "Auto-resolve") are narrower than the time row, which already fits, but step 06's longer label "Auto-resolve (win >95%)" must fit too. Measure it now with `footerWidth` and record the row's width at 840 wide. If it would not fit right of the party column, say so in the execution record for step 06 and do not redesign the footer here.
   - The header hint among monsters may mention auto-resolving ("Monsters! Scout them, wait, attack or auto-resolve."). Keep it short and on one line at 840 wide. Leave the hover hint to step 06.
2. **The probe.** `probe()` destructures four buttons (`[scout, wait, attack, autoResolve]`) and returns `buttons.autoResolve`. In `src/testHook.ts`, add `autoResolve: ButtonProbe` to `WorldProbe.buttons` and extend the comment: "Scout, Wait, Attack and Auto-resolve show among monsters ...". Do not add `forecast` or `autoLabel` (step 06).
3. **In-browser tests** (write them first; `e2e/world.test.ts` for the hand-over from the map, or `e2e/battle.test.ts` if it reads better beside the loss tests; follow `e2e/CLAUDE.md`: probes only, wait on state, no sleeps, no hard-coded pixels).
   - **A1, a victory from the map:** `newGame`, `travelTo(RAIDERS.position)`; expect `buttons.autoResolve.visible` with `attack`. Note each member's experience (`party` portraits, or the slot read through `localStorage`). Click Auto-resolve and wait for `Battle` with `buttons.result.visible`. Expect `state.winner === 'player'`, a `battle_end` last in `log`, no turn handed to the player (wait with a predicate of `buttons.result.visible || playerControl` and expect the first probe it returns to have the result up, not control), the result lines to include "Auto-resolved in" (second line), and the auto button hidden. Click OK, wait for `World`: `goblin_raiders` gone from `world.locations`, `confronting` null, the members' experience raised, and the baggage holding any item the result's "Found:" line named. With `WINNING_SEED` the policy must win this threat-1 lair. If it does not, pick another seed and say why in a comment, as `e2e/CLAUDE.md` advises.
   - **A3, determinism and meta:** open two games with the same `?seed=` (`games.open({ seed })`), auto-resolve the same lair in each, and expect `log` to be equal (deep equality of the events). Expect `log[0]` to match `{ type: 'battle_start', meta: { source: 'game', party: 'party_1', playerPolicy: 'aggressive' } }`. Also assert that a battle started by Attack has no `playerPolicy` in its meta (extend the existing "starts a battle when the party attacks" or assert in a new test).
   - **A6, a defeat wipes as a played one does:** make the loss certain. For example, set the party's hit points to 1 with the debug console (`hp 1 all`, see `debug.test.ts` for how a test types into it) before Auto-resolve, or plant a weakened party in the slot as the A9 test does. Find a seed where it loses and keep the test deterministic. Two cases, mirroring the existing played-loss tests:
     - one party: DEFEAT, the auto-resolved line among the result lines, the button reads Main Menu, and the slot is deleted (`Menu`'s Continue disabled);
     - with a second party planted (reuse the A9 test's set-up): DEFEAT, OK back to `World` with the other party selected, and the saved game read back has the fallen party gone and its baggage at the nest.
   - **R3, a lesser party's battle:** if the A9 set-up makes it cheap, select the second party at a lair and auto-resolve its battle. Expect `battle_start.meta.party` to be that party's id. Skip it if it needs new helpers, and say so in the record.
   - **Least window:** extend "fits the footer and the order line in the least window", or add a test beside it: at 840×560 among monsters, Scout, Wait, Attack and Auto-resolve are all visible and within 80 px of each side and on screen.
4. **Docs** (same commit):
   - `docs/reference/scenes.md`, "Footer": the monster row is Scout, Wait, Attack and Auto-resolve, shown by the same rule. "Battles and the game's end": Auto-resolve starts `Battle` with `auto: true`, which opens on the battle resolved (see "The battle screen"), and the victory and defeat follow as for Attack.
   - `src/scenes/CLAUDE.md`: only if a line there names the footer's buttons or the ways a battle starts. Search it for "Attack" and "Scout".
   - Leave the manual to step 07.

**Exclusions:** no estimate, no label figure, no hover hint for the button (step 06); no change to `BattleScene` (step 03), except a fix that a test here exposes in step 03's work (record it as a deviation); no confirmation, no key binding.

## 5. Verification

- `npm test` passes (`tsc` with the new probe field; the refactor guard green and unedited).
- `npm run test:browser -- -t "uto-resolve"` (or the new tests' names) passes, then the whole `npm run test:browser`, including the existing world, battle, saves and debug tests.
- By hand, optionally: `npm run dev`, open `http://localhost:5173/?seed=1`, walk to the raiders, press Auto-resolve, and see the result screen at once with the auto-resolved line.

## 6. Completion criteria

- [ ] Auto-resolve shows in the world footer exactly when Attack does, and starts `Battle` with `auto: true` for the selected party at its location.
- [ ] `WorldProbe.buttons.autoResolve` in the probe and in `src/testHook.ts`.
- [ ] In-browser tests for A1, A3 (identical logs, `meta.playerPolicy`), A6 (both the last party's and a lesser party's defeat), the footer at 840×560, and R3's second party if cheap. All pass, as does the whole in-browser run.
- [ ] The width of step 06's label "Auto-resolve (win >95%)" in the row at 840 wide is recorded below.
- [ ] `docs/reference/scenes.md` updated; CLAUDE.md checked.
- [ ] `npm test` passes; the guard is green and unedited; `LOG_SCHEMA_VERSION` and `SAVE_VERSION` still 26.
- [ ] One commit on `main`; the index's row 04 updated with status and hash.

## 7. Execution record
