# Step 07: Manual, screenshots and records

[Plan index](index.md) · [Design](../../designs/auto-resolve.md) (§7.3 Docs; R11; A8) · [Feature record](../../features/auto-resolve.md) (read only; the orchestrator keeps it)

**Suggested engineer:** sonnet (docs and screenshots, following fixed words). The reviewer should check every sentence against the code as it stands, since the manual is what the player trusts.

## 1. Objective

The player's manual describes auto-resolve and its estimate, its screenshots show the new buttons with a finished estimate on them, the long campaign's open question about auto-resolve reads answered, and every code-map and reference doc says truthfully what steps 01–06 built. After this step the feature is complete (A8).

## 2. Requirements and context

- **R11:** the manual describes auto-resolve; its screenshots are retaken; the long campaign's open question is marked answered.
- **A8:** the manual's Monsters and Battle chapters describe auto-resolve and its estimate, and its screenshots show the new buttons; the long campaign's open-questions row reads answered.
- **What the player sees** (copied from the index's contracts; the manual must match these words, and the code is right where they differ):
  - World map footer, among monsters: Scout, Wait, Attack, **Auto-resolve**, the last shown by the same rule as Attack (C5). Its label is "Auto-resolve (win 90%)" once the estimate is done, "Auto-resolve (…)" while it is worked out (C2 `forecastLabel(f, false)`).
  - Battle screen: a fourth button after Attack, Skills and End Turn, labelled "Auto (90%)" or "Auto (…)" (C2 `forecastLabel(f, true)`; C3). Enabled exactly when End Turn is, hidden when the battle ends, **no key binding**.
  - Hovering either button puts the estimate in the screen's hint line (C4): "Estimate from 40 trial battles with the AI playing your side: it wins about 90% of them, and a hero dies in about 15%. Your own play may do better." At the ends the figures read "over 95%" / "under 5%"; when samples stalled it adds "; 3 of 40 drag on past 50 rounds". While working: "Estimating how auto-resolve would go…".
  - Figures are rounded to the nearest 5%, never claiming certainty (">95%", "<5%" at the ends).
  - Resolving is at once: the board shows the battle's end and the log every action; the result screen is the played battle's, with "Auto-resolved in N rounds." added after its first line (C3 `autoResolvedLine`).
  - If the battle has not ended 50 rounds (`AUTO_ROUND_LIMIT`) after pressing, the log says "The battle drags on. It is yours to finish." and the player has control again (C3 `AUTO_DRAG_ON_LINE`).
  - In battle the estimate is worked out again after each of the player's actions; on the world map whenever something changes (a heal, gear, another party selected, a day passed).
  - Rewards, deaths, loot, runes and the location cleared are exactly a played battle's; heroes who fall are dead. No confirmation is asked.
- **Design §7.3, the manual's text:**
  - Chapter 3, "Monsters" (`docs/manual/README.md`, the `### Monsters` heading near line 165): a fourth bullet beside Scout, Wait and Attack: **Auto-resolve** fights the battle for you at once, the heroes played by the same rules as the monsters; the result is final, and heroes who fall are dead as in any battle. Mention the figure on the button.
  - Chapter 5, "Battle" (near line 254): a short `### Auto-resolve` section: the button; that it finishes the battle from where it stands, mid-turn included; the 50-round hand-back; the estimate (the figure on the button is the AI's chance of winning, from 40 trial battles; hovering adds the chance a hero dies; it is the AI's odds, not a promise, and a careful player usually does better).
  - "Victory and defeat" (near line 389): a line that an auto-resolved battle's rewards and losses are the same as a played one's.
  - "Battle keys" table: unchanged (Auto has no key).

### Shared constraints (from the index)

- **Versions:** `LOG_SCHEMA_VERSION` stays 26 and `SAVE_VERSION` stays 26. No step edits either constant.
- **The refactor guard** (`scripts/simulate.test.ts`, `describe('the refactor guard')`, `GUARD_RECORDS` and `GUARD_EVENTS_SHA256`) is never edited by any step and must stay green.
- **Commands** (local Node 26: prefix `PATH=/opt/homebrew/opt/node@26/bin:$PATH`, or use the podman `make` targets): `npm test` (`tsc && vitest run`) is the gate before every commit; `npm run test:browser` after any scene or e2e change (read `e2e/CLAUDE.md` first); `npm run manual:screenshots`; `npm run build`.
- **Commits.** One commit on `main` (or two: text, then screenshots), once `npm test` passes, without pushing. Message "Auto-resolve step 07: manual, screenshots and records".
- **Docs.** Root `CLAUDE.md` under 16 KB, each directory's under 12 KB (`scripts/claudeMd.test.ts`); move detail to `docs/reference/` rather than raising a limit. History belongs in `docs/implementation-plans/`, not in CLAUDE.md.

## 3. Dependencies and prerequisites

- **Steps 05 and 06 done** (and through them 01–04). This step relies on what they built:
  - `BattleProbe.forecast: Forecast | null` and `autoLabel: string`; `BattleProbe.buttons.auto` (C3, C4).
  - `WorldProbe.forecast: Forecast | null`, `autoLabel: string` and `WorldProbe.buttons.autoResolve` (C4, C5).
  - The final words of `forecastLabel`, `forecastHint`, `autoResolvedLine` and `AUTO_DRAG_ON_LINE` in `src/game/forecast.ts` and `src/scenes/battleSetup.ts`. Read them there and quote what the code says.
- **Existing at `002457c`:**
  - `docs/manual/README.md`: chapters `## 3. The world map` (with `### Monsters`), `## 5. Battle` (with `### Battle keys`, `### Victory and defeat`).
  - `e2e/manual.shots.ts`: `world-confront` is shot after `travelTo(RAIDERS.position)` and `hover({ x: 0, y: 0 })`; `battle-start` after waiting for `playerControl`; later shots (`battle-move`, `battle-attack`, `battle-spell-menu`, `battle-targeting`, `battle-victory`, `battle-bandits`, `battle-salamander`, …) also show the button row.
  - `docs/designs/long-campaign/index.md`, open-questions table, row "Auto-resolve for lesser parties' battles (company §8.3)" (line 76), still open.
  - `docs/designs/long-campaign/stage-06-multiple-parties.md` (stage 6's notes, which raised the question).

## 4. Scope and guidance

1. **Manual text** (`docs/manual/README.md`), as in §2. Keep the manual's voice (second person, plain, short). Check whether the "Monsters" section's existing sentences list the footer's buttons ("Scout, wait or attack") and widen them.
2. **Screenshots** (`e2e/manual.shots.ts`):
   - Before `world-confront`, wait until the world probe's `forecast` is non-null so the label is a figure, not "…" (`game.waitFor('World', (w) => w.forecast !== null)`). Optionally hover `buttons.autoResolve` for this shot so the hint line shows the estimate; if so, take it after the wait and keep the hover off the map.
   - Before each battle shot taken while the player has control (`battle-start`, `battle-move`, `battle-attack`, `battle-spell-menu`, `battle-targeting`, `battle-bandits`, `battle-salamander` and any other), wait for the battle probe's `forecast` to be non-null. Wait on state, never on time.
   - Run `npm run manual:screenshots`. Look at every changed PNG in `docs/manual/` by eye: the four battle buttons fit and do not overlap at the shot's size, the world footer's row fits, labels show figures. Commit only PNGs that changed for this feature; if an unrelated shot changed (a nondeterminism), say so in the record.
3. **The long campaign's open question** (`docs/designs/long-campaign/index.md`): mark the row answered: every battle, from the world map or the battle screen, with an estimate of the AI's odds, per [`docs/designs/auto-resolve.md`](../../designs/auto-resolve.md). Optionally a one-line pointer to the same design in stage 6's notes where they leave the question open.
4. **Final docs sweep** (fix only what is wrong or missing; earlier steps should have done most):
   - Root `CLAUDE.md`: the module map names `src/engine/autoPlay.ts` (the loop shared by auto-resolve, the estimate and the simulator) and the estimate in `src/game/` (`forecast.ts`).
   - `src/engine/CLAUDE.md`: one line on `autoPlay.ts` (`playStep`, `playOut`, `AUTO_POLICY`, `ENEMY_POLICY`, `AUTO_ROUND_LIMIT`; never abandons, draws nothing).
   - `src/game/CLAUDE.md`: `forecast.ts` in the module list, and its seed rule under the "RNG streams" contract (samples draw only from their own seeds via `forecastSeed`; never `Math.random`, the world's RNG or a battle's stream).
   - `src/scenes/CLAUDE.md`: the battle's Auto button and the world footer's Auto-resolve, and that the estimate is worked in idle slices.
   - `docs/reference/scenes.md`: "Footer" (world) and "The battle screen" describe the buttons, the labels, the hover hint, the drag-on hand-back, the result line and when the estimate restarts.
   - `docs/reference/simulator.md`: `fight` plays through `playOut`, abandoning past `--max-rounds`.
   - Search every CLAUDE.md and `docs/reference/` for "Scout, Wait and Attack", "Attack, Skills and End Turn" and `ENEMY_POLICY` and correct what is now incomplete.
   - `e2e/CLAUDE.md`: only if steps 03–06 added a driver journey (e.g. an auto-resolve helper) not mentioned.

**Exclusions:** no code changes beyond `e2e/manual.shots.ts`; do not edit `docs/features/auto-resolve.md` (the orchestrator's); no implementation notes in the design beyond the open-question row.

## 5. Verification

- `npx vitest run scripts/claudeMd.test.ts` passes (size limits).
- `npm test` passes; the refactor guard unedited and green.
- `npm run manual:screenshots` completes; the changed PNGs reviewed by eye, listed in the record.
- `npm run test:browser` passes in full (the feature's last check).
- `npm run build` passes.
- `grep -n "SAVE_VERSION = \|LOG_SCHEMA_VERSION = " src/game/save.ts src/engine/battleEngine.ts` still shows 26 for both.

## 6. Completion criteria

- [ ] Manual chapter 3 bullet, chapter 5 "Auto-resolve" section and "Victory and defeat" line written, matching the code's words; "Battle keys" unchanged.
- [ ] `manual.shots.ts` waits for the estimate; screenshots retaken and checked by eye.
- [ ] Long campaign open-questions row reads answered, linking the design.
- [ ] CLAUDE.md files and `docs/reference/scenes.md`, `docs/reference/simulator.md` current; `claudeMd.test.ts` green.
- [ ] `npm test`, `npm run test:browser`, `npm run build` pass.
- [ ] Commit(s) on `main`; the index's row 07 updated with status and hashes.

## 7. Execution record

- **Built:** manual chapter 3 bullet (four actions), a `### Auto-resolve` section in chapter 5 (the button, mid-turn, the 50-round hand-back, the estimate), a line in "Victory and defeat"; "Battle keys" unchanged. Design status set to implemented; the long campaign's open-question row marked answered, with a pointer in stage 6's notes. Step 06's record corrected (the forecaster survives a walk's start; `refresh()` does not run there; the `walking` guard in `update()` is redundant). `src/scenes/CLAUDE.md` gained an Auto-resolve line. The sweep found the root map, `src/engine/CLAUDE.md`, `src/game/CLAUDE.md`, `docs/reference/scenes.md` and `docs/reference/simulator.md` already current; `e2e/CLAUDE.md` needed nothing.
- **Screenshots:** `e2e/manual.shots.ts` waits for `forecast !== null` before `world-confront` and every battle shot taken under player control. Retaken and checked by eye: `world-confront` ("Auto-resolve (win >95%)" fits in the footer row), `battle-start`, `battle-move`, `battle-attack`, `battle-spell-menu`, `battle-targeting`, `battle-bandits`, `battle-salamander` (four buttons fit, "Auto (>95%)"). The run also re-encoded 14 unrelated PNGs by a few bytes (nondeterminism); they were reverted and not committed.
- **Verification:** `npm run manual:screenshots` 7 passed; `npm test` 95 files, 2310 tests passed (guard unedited); `npm run test:browser` 12 files, 156 tests passed; `npm run build` passed; `SAVE_VERSION` and `LOG_SCHEMA_VERSION` both 26.

