# Design: battle cost on the result screen

**Slug:** battle-cost. **Status:** ready for planning (no blocking questions). Small change; one step.

## 1. Purpose

After a battle the heroes' hit points are the world's: a level-up heals ("wounds healed"), so the party's HP after the result screen understates what the battle took. An auto-resolve user could not tell what it had cost. The result screen should say it, for every battle (played or auto-resolved), from the HP the heroes lost before any reward is applied.

## 2. Requirements

| ID | Requirement |
|---|---|
| R1 | A won battle's result screen has one extra line group after the experience and level lines' first line: the net hit points the party lost in the battle, and who lost them. |
| R2 | The figure is measured before `rewardVictory` (so before level-up healing), from the battle's own start and end. It is the same for a played, restored (reloaded mid-battle) and auto-resolved battle. |
| R3 | A battle that cost nothing (no hero ended below the HP they started on) adds no line. |
| R4 | A defeat adds nothing: the party is wiped and the existing defeat lines say so. |
| R5 | The result block still fits at 840x560 with a full party, and no line is wider than the screen. |
| R6 | No change to any rule, balance, event shape, log schema or save shape. |

Non-goals: mana cost, damage dealt, per-round breakdown, a cost line on the world map, a record of it in the save.

## 3. Current system (inspected)

- `BattleScene.endBattle` (`src/scenes/BattleScene.ts`) runs for played and auto-resolved battles alike: `syncUnitsFromEngine` writes the engine's final HP onto the characters, `rewardVictory` then applies XP and levels (a level heals), `describeRewards` (`src/game/party.ts`) gives the lines, and `resultText` shows `[first, autoLine, ...rest]` joined with newlines.
- The engine's log starts with a `battle_start` event whose `units: UnitSnapshot[]` holds each unit's `side`, `id` and `hp` at the start. `getLog()` survives `snapshot()`/`restore` (the scene already reads `battleSeed(getLog())` from it), so the start HP is available without the scene storing anything. The final HP is `getState().units`.
- `resultText` is 16 px monospace, centred, `lineSpacing: 6`, no word wrap, positioned at `height/2 - 60`; the OK button sits `46` px under its bottom (`layout()`). Under it the shade is black at 0.7 alpha, so the sprites show dimly through the text.
- There is no retreat in battle: it ends in a win or a defeat.

## 4. Proposed behavior

**What it shows (R1).** Hit points only, one summary line, heroes ordered by loss:

`The battle cost 23 HP: Aiko 12, Ren 8, Mia 3.`

- The total is the sum of each hero's `max(0, startHp - endHp)`. Net, so a heal cast mid-battle reduces it; a hero ending above where they began costs 0 and is not listed.
- A hero who fell counts for the HP they started with (it is HP the battle took). The "X fell and will not rise again" line already names the dead, so they are not marked again.
- If the heroes do not fit on one line (about 72 characters, so it stays inside 840 px at 16 px monospace, about 9.6 px a character), the list wraps onto at most one more line; heroes that still do not fit collapse to `and N more.` The total is always shown in full.
- Placement: straight after the `+N XP` line and before the fallen and level lines, so the reader sees `+120 XP`, the cost, then `Aiko reaches level 3 ... wounds healed`, which reads as cause and effect.

**Mana: not shown.** Mana is a per-battle resource that a level or a camp day refills, so it is also hidden by level-ups, but the request and the friction were about wounds, the number that decides whether to heal or rest. Adding it doubles the line and the layout risk for little. See open question Q1.

**Defeat (R4) and nothing-lost (R3):** no line. Auto-resolve changes nothing else: the same `endBattle` path, the cost line then the "Auto-resolved in N rounds." line placement is unchanged (the auto line stays second, under the first line).

## 5. Technical design

New Phaser-free module `src/scenes/battleCost.ts` (proposed; no Phaser import, per `src/scenes/CLAUDE.md`):

```ts
export interface HeroCost { id: UnitId; name: string; lost: number }
/** Net HP each player unit lost between the log's battle_start and the final state; heroes that lost nothing are left out; most lost first. */
export function battleCost(log: BattleEvent[], finalUnits: UnitSnapshot[], names: Record<UnitId, string>): HeroCost[]
/** The result screen's lines for it (empty when nothing was lost), each at most `width` characters. */
export function costLines(costs: HeroCost[], width?: number): string[]
```

- `battleCost` reads `log[0]` (the `battle_start`), matches `side === 'player'` units by id, ties broken by party order (stable sort).
- `costLines` builds the sentence above and wraps/collapses as in section 4 (default `width` 72).
- In `endBattle`, **before** `rewardVictory`, and only when `playerWon`: `const costLinesOut = costLines(battleCost(this.engine.getLog(), state.units, this.names))`; spliced into the lines after the experience line. `describeRewards` returns `[xp, ...mourned, ...levelLines]`, so the scene inserts the cost lines at index 1 of `xpLines` (when `xpLines` is empty, e.g. every hero fell, the cost lines go after the first line on their own). `describeRewards` itself is not touched.
- No data stored, no save change (`SAVE_VERSION` stays), no event change (`LOG_SCHEMA_VERSION` stays), no engine change. Computed from state the scene already holds, so `Battle` probe's existing `result` lines expose it to e2e with no new probe field.

**Layout (R5).** Worst case now: first line, auto line, XP, mourned, one level line per hero (party size up to the guild hall's limit, treat as 6), loot = about 11 lines at about 22 px = 242 px starting at y=220 (540 at the minimum 560 height) before the button 46 px under: the block already overflows the bottom in that corner, and the cost's 1 to 2 lines would worsen it. Fix with a small, general rule in `layout()` rather than a cap: after sizing the text, if `menuButton.y + 30 > height - 16`, shift the banner, text and button up together by the excess, limited so the banner stays at `y >= 40`. Sprites showing under the text are dimmed by the 0.7 shade and the text is light on it; this change adds lines to the same block and does not add anything over the sprites that was not already there, so it does not worsen the QA note beyond the vertical growth the shift handles. A row of 6 level lines plus cost is the case to check at 840x560.

## 6. Consequences

- No rule, balance, event, log or save change: the simulator's refactor guard is unaffected (scene-only change).
- Docs: `docs/manual/README.md`, "Victory and defeat" (line ~402), gains one sentence: the victory screen says what the battle cost in hit points, before any level healed the party. The `battle-victory.png` screenshot shows the victory screen, so retake with `npm run manual:screenshots` (it changes only if that shot's heroes lost HP). `docs/reference/scenes.md` (result screen) gets the line and `src/scenes/CLAUDE.md` one line for `battleCost.ts`. Update the auto-resolve design/manual lines only where they list the result screen's lines (manual line ~276 says the result is the played battle's, still true).

## 7. Verification

| Scenario | Check |
|---|---|
| A1 (R1, R2) | Unit test `battleCost.test.ts`: a log with a `battle_start` of 3 heroes (hp 30/30/20) and final units (18/30/20 and one at 0) gives the right per-hero and total losses, most lost first; a hero who ends above their start costs 0 and is dropped. |
| A2 (R3) | No hero lost HP: `battleCost` returns `[]`, `costLines([])` returns `[]`. |
| A3 (R5) | `costLines`: 6 heroes with long names produce at most 2 lines, each at most 72 characters, ending `and N more.`; the total is complete. |
| A4 (R2) | Scene smoke test (`BattleScene.test.ts`) or e2e `battle.test.ts`: an auto-resolved battle from a party below full HP shows the cost line in the probe's `result` before any "reaches level" line, and the line's total equals the party's HP at the start minus the engine's final HP. |
| A5 (R4) | A defeat's result lines contain no "cost" line (existing defeat test extended). |
| A6 (R5) | In-browser at 840x560 (`npm run test:browser` viewport) with a victory that levels a full party: the OK button's bottom is within the screen. A screenshot check by QA. |

Run `npm test` (typecheck and all tests); `npm run test:browser` after the scene edit.

## 8. Open questions and assumptions

- **Q1 (not blocking): mana.** Recommend HP only, as above.
- **Q2 (not blocking): do the dead count in the total?** Recommend yes (they lost their start HP), unmarked, since the fallen line names them.
- **Q3 (not blocking): sort by loss or party order?** Recommend most lost first.
- Assumption: the guild hall's party limit is at most 6 (not verified; the worst case in section 5 holds for any size because the layout shift is general).
- Assumption: `getLog()[0]` is always the `battle_start` with the starting HP, including after `restore` (the scene's `battleSeed(getLog())` relies on the same).
