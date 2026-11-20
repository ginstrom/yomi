# Step 01: battle cost line

Part of [the plan](index.md); source [design](../../designs/battle-cost.md). Engineer tier: sonnet. Reviewer tier: sonnet.

## Objective

A won battle's result screen (played, restored or auto-resolved) shows one summary line of the net hit points the party lost, and who lost them, between the `+N XP` line and the fallen and level lines. Nothing for a defeat or a battle that cost nothing.

## Requirements (restated)

- R1: extra line group after the experience line: net HP lost, and by whom.
- R2: measured before `rewardVictory`, from the battle's start (`battle_start` event, `log[0]`, `units[].hp` of `side === 'player'`) to the final `engine.getState().units`. `getLog()` survives `snapshot()`/`restore`, so a reloaded battle gives the same figure.
- R3: nothing lost (no hero ended below their start HP) means no line. R4: a defeat adds nothing.
- R5: fits 840x560 with a full party (assume up to 6 heroes); no line wider than 72 characters.
- R6: no rule, balance, event, log or save change.

Decisions: HP only, no mana. A hero who fell counts for the HP they started with, unmarked (the "fell and will not rise again" line names them). Heroes ordered most lost first, ties in party (start-snapshot) order via a stable sort. Net: each hero contributes `max(0, startHp - endHp)`; a hero ending above their start costs 0 and is not listed.

## Context (inspected)

- `src/scenes/BattleScene.ts` `endBattle()` (about line 2406): calls `syncUnitsFromEngine()`, then `rewardVictory(...)`, `describeRewards(reward)` giving `xpLines = [xp, ...mourned, ...levelLines]` (may be empty, e.g. every hero fell), builds `[first, ...autoLines, ...rest].join('\n')` where for a win `rest = [...xpLines, ...lootLines]`. `this.names` is the id-to-name map (set near line 409). `battleSeed(this.engine.getLog())` (in `battleSetup.ts`) already reads `log[0]`; model the `battle_start` lookup on it.
- `layout()` (about line 977): `resultText` at `height/2 - 60`, `menuButton` at `resultText.y + resultText.height + 46`, `bannerText` at `height/2 - 100`, `resultShade` full-screen. Text is 16 px monospace, `lineSpacing: 6`, no word wrap. A full party's block already overflows the bottom at minimum height 560.
- `UnitSnapshot` and the `battle_start` event are in `src/engine/battleEngine.ts`; `UnitId` is exported there or from the engine's types (check the import).
- The `Battle` probe already exposes `result` (the text's lines) and the log; no new probe field is needed.
- Tests: `src/scenes/*.test.ts` helper tests run under the `domain` project. In-browser: `e2e/battle.test.ts` (auto-resolve block at about line 575; `autoResolvedLine`, `game.enterBattle`, `game.fightBattle`, `game.waitFor('Battle', ...)`), `e2e/manual.shots.ts` (`battle-victory` shot at about line 156).

## Implementation

1. **Test first**: `src/scenes/battleCost.test.ts` (no Phaser), covering:
   - A1: `battle_start` of 3 heroes (hp 30/30/20) and final units (18/30/20 plus a variant where one is at 0): per-hero and total losses right, most lost first, ties in party order; a hero who ends above their start costs 0 and is dropped; enemy units ignored; a fallen hero counts their start HP.
   - A2: nothing lost gives `battleCost` `[]` and `costLines([])` `[]`.
   - A3: 6 heroes with long names give at most 2 lines, each at most 72 characters, ending `and N more.`; the total in the sentence is the full sum.
   - Format: `The battle cost 23 HP: Aiko 12, Ren 8, Mia 3.` (singular unit is still `HP`). Wrap onto at most one more line; heroes that still do not fit collapse to `and N more.`
2. **`src/scenes/battleCost.ts`**: implement the contract above. `battleCost` finds `battle_start` as `log[0]` (return `[]` if it is not one). `costLines(costs, width = 72)` returns `[]` for no costs.
3. **`endBattle`**: only when `playerWon`, compute `costLines(battleCost(this.engine.getLog(), state.units, this.names))` **before** the `rewardVictory` call, then insert it into the lines after the first experience line: `xpLines` with the cost lines spliced in at index 1 (when `xpLines` is empty, the cost lines stand after the first line on their own). Resulting order: `first`, auto line, `+N XP`, cost, fallen, level lines, loot. Do not edit `describeRewards`.
4. **`layout()`**: after positioning, if `menuButton.y + 30 > height - 16`, shift the banner, `resultText` and `menuButton` up together by the excess, limited so the banner stays at `y >= 40`. General rule, not a cap on lines.
5. **Docs, same commit**:
   - `docs/manual/README.md`, "Victory and defeat": one sentence that the victory screen says what the battle cost in hit points, counted before any level-up healed the party.
   - Retake the screenshots with `npm run manual:screenshots` (needs the in-browser setup; it needs the host's Chromium as `npm run test:browser` does); commit only images that changed.
   - `docs/reference/scenes.md`: the result screen's lines gain the cost line (placement, HP-only, net, fallen counted, before rewards, none on defeat or nothing lost, the layout shift), near the auto-resolve paragraph on `endBattle`; and the `battleSetup.ts`-style module list entry for `battleCost.ts`.
   - `src/scenes/CLAUDE.md`: one line for `battleCost.ts` next to the other helper modules.
   - Search the docs for any list of the result screen's lines and update it.

## Verification

- `npx vitest run src/scenes/battleCost.test.ts`, then `npm test` (typecheck and all tests).
- e2e (`e2e/battle.test.ts`), A4/A5: extend the auto-resolve test (or add one) so that after an auto-resolve, if any hero lost HP, `over.result` has a line `The battle cost N HP: ...` positioned after the `+N XP` line and before any `reaches level` line, and N equals the sum over heroes of `max(0, start hp - final hp)` computed from `over.log[0]` and `over.state.units`; if nothing was lost, no such line. If the existing party always ends unhurt, start the auto-resolve from a state where a hero is hurt (before the fight, or choose the move that takes damage) so the case is really exercised; do not weaken the assertion to vacuous. Extend an existing defeat test (around line 506) to assert no result line contains `cost`.
- A6: with a viewport of 840x560 and a victory that levels a full party (as far as the driver can arrange it; otherwise the largest party it can), assert in an e2e that the OK button's bottom is within the screen height. If the driver cannot arrange this, say so in the record and rely on the existing battle victory shot, which the reviewer inspects.
- `npm run test:browser`, then `npm run manual:screenshots`; view `docs/manual/images/battle-victory.png` to confirm it is sensible.

## Completion criteria

- [ ] `battleCost.ts` and its tests; `endBattle` and `layout()` changed; no change to `describeRewards`, the engine, `LOG_SCHEMA_VERSION` or `SAVE_VERSION`.
- [ ] `npm test` and `npm run test:browser` pass (record results below).
- [ ] Manual sentence, retaken screenshots, `docs/reference/scenes.md` and `src/scenes/CLAUDE.md` updated in the same commit.
- [ ] One commit on `main`; this step's status and hash set in [index.md](index.md).

## Execution record
