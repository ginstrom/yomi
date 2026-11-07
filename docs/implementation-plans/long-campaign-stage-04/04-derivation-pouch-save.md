# Step 04: Derivation, the pouch and the save

[Plan index](index.md) · [Stage design](../../designs/long-campaign/stage-04-runes.md) (§2 "New stats", "The pouch"; §5 versions; §6 `character.test.ts`) · [Reference](../../designs/long-campaign/reference/gear-and-runes.md) §5.2 (the pouch), §5.3 (`deriveCombatStats`) · [Stages index](../../designs/long-campaign/index.md) ("Versions", "Docs")

**Difficulty:** judgement in one place, the hit-point rule (correction 4), and routine elsewhere. Engineer opus, reviewer opus.

## 1. Objective

Make the rune stats that step 03 put on items count for a character, and give the party a saved rune pouch:
- `maxHp` adds the items' `maxHp` (Life runes in armour and shields);
- `deriveCombatStats` sums wards over everything worn, and takes on-hit effects from the main hand only;
- `clampHp` keeps `hp <= maxHp` whenever gear comes off outside battle, keeping the hero's share of its hit points when the maximum drops (the user's answer to D1);
- `GameState.runes`, the pouch, is saved and loaded, and `SAVE_VERSION` goes to 18;
- the debug console's `give` puts runes in the pouch, `items` lists the rune keys, and a new `runes` command shows the pouch.

The simulator's party carries no runes yet, so the guard must stay identical to step 01's.

## 2. Requirements and context

- **Design S4-R5 (part):** hero wards and Life's hit points. Wards sum over everything worn, on-hit effects come from the main hand only, and `maxHp` comes from Life runes in armour (stage design §2 "New stats").
- **Design §2 "The pouch":** `GameState.runes` is saved.
- **Design §5:** `SAVE_VERSION` is bumped (the pouch, and ids with runes). The project does not migrate: older saves read as unreadable (CLAUDE.md, "Rules of saving").
- **Correction 4 (index):** Life runes break CLAUDE.md's rule that no item changes maximum hit points. The engine already clamps hit points on an `equip` action (`battleEngine.ts`, `equip`: `actor.hp = Math.min(actor.hp, stats.maxHp)`). Outside battle, every change to what a character wears now ends with `clampHp(character, maxBefore)`, the maximum read before the change. This step covers `equipFromBackpack`, `unequipToBackpack` and `dropEquipped`; step 06 covers runecraft on a worn item, and step 10 the simulator's direct gear writes. **The user's answer to D1** (it replaces the plan's first default, which lost the excess): when the maximum drops, the hero keeps the same share of its hit points, `hp = min(max, max(1, round(hp × max / maxBefore)))` for `hp > 0`: never above the new maximum, never to 0 from a positive value, so a hero at full health stays full and one at 20 of 40 is at 18 of 36. When the maximum rises (Life armour put on), `hp` is left as it is. A hero at 0 stays at 0. In battle the engine's `equip` still clamps as it does; the rule is for gear changed outside battle. Rewrite the rule in CLAUDE.md to say this.
- **Correction 19 (index):** `give` takes rune keys. `give storm1 3` puts three Lesser Storm Runes in the pouch (the play script's "give them via debug"), and `items` lists the rune keys.
- **Contract C3** (index, copied unchanged):

  ```ts
  // src/character/character.ts (existing file)
  // maxHp(character) adds Σ stats.maxHp of every item worn (wornStats: an off-hand item under a two-handed weapon counts for nothing).
  // deriveCombatStats adds:
  //   wards: summed by element over every item worn; left out when every element is 0
  //   onHit: the main hand's stats.onHit, exactly; left out when it has none
  /**
   * Keeps hit points within the maximum after a change to what is worn (correction 4, D1 as the user chose):
   * if the maximum fell below `maxBefore` and hp > 0, the hero keeps the same share of its hit points,
   * hp = min(max, max(1, round(hp × max / maxBefore))); otherwise hp = min(hp, max).
   */
  export function clampHp(character: Character, maxBefore: number): void
  // equipFromBackpack, unequipToBackpack and dropEquipped read maxHp(character) before the change and end with clampHp(character, before) when they changed anything.
  // (C3 as amended in step 03's commit for the user's answer to D1.)
  ```

- **Contract C4** (index, copied unchanged):

  ```ts
  // src/game/gameState.ts (existing file)
  // GameState gains:
  /** The party's rune pouch (runes.ts): runes found, bought and fused, waiting to be embedded or sold. */
  runes: Pouch                                                // newGame: {}
  ```

  - `src/game/save.ts`:
    - the pouch is written as is;
    - a load checks that every key `isRuneKey` with a whole count of 1 or more, and is unreadable otherwise;
    - item ids with runes need nothing new (`itemById`);
    - `SAVE_VERSION` goes from 17 to **18**.
  - Debug (`src/scenes/debugCommands.ts`):
    - `give <item|rune> [count]` puts an item in the baggage, as now, or, given a rune key, that many runes in the pouch (correction 19);
    - `items` also lists the rune keys and the `#` grammar;
    - a new `runes` command lists the pouch.

- **Shared constraints (from the index):**
  - `npm test` (`tsc && vitest run`) passes before the commit (local Node 26: `PATH=/opt/homebrew/opt/node@26/bin:$PATH`, or `make test`).
  - One commit for this step on `long-campaign-stage-04`, without pushing. Never switch branches. The message ends with the repo's `Co-Authored-By` attribution line.
  - **Determinism.** Nothing here draws from the battle or world RNG. The guard's summary must be identical to step 01's.
  - CLAUDE.md stays current: update the lines this change makes wrong, in this commit.
  - `tsc` is the lint step (`noUnusedLocals`, `noUnusedParameters`, `erasableSyntaxOnly`, `verbatimModuleSyntax`): no enums, and `import type` for type-only imports.

## 3. Dependencies and prerequisites

- **Step 03 (done before this one) produces**, and this step consumes:

  ```ts
  // src/inventory/runes.ts (step 03)
  export type RuneKey = `${RuneId}${Rank}`                  // 'ember1', 'storm2'
  export function isRuneKey(text: string): text is RuneKey
  export function runeName(key: RuneKey): string            // 'Lesser Ember Rune', 'Storm Rune', 'Grand Stone Rune'
  export const RUNE_IDS, RANKS                              // for listing keys
  /** The party's rune pouch: a count for each rune key held; a key at 0 is left out. */
  export type Pouch = Partial<Record<RuneKey, number>>
  export function pouchCount(pouch: Pouch, key: RuneKey): number
  export function addToPouch(pouch: Pouch, key: RuneKey, n?: number): void          // n defaults to 1
  export function takeFromPouch(pouch: Pouch, key: RuneKey, n?: number): boolean    // false, and nothing taken, if fewer
  /** The keys held, in RUNE_IDS order then rank. */
  export function pouchKeys(pouch: Pouch): RuneKey[]

  // src/combat/combat.ts (step 03)
  export interface OnHit { damage: number; element?: Element; bane?: true; status?: StatusLaid; onCrit?: true; heal?: number }
  // CombatantStats gains onHit?: readonly OnHit[] and blightborn?: true; sameCombatStats compares both.

  // src/inventory/inventory.ts (step 03): ItemStats gains
  wards?: Partial<Record<Element, number>>
  onHit?: readonly OnHit[]
  maxHp?: number
  // and itemById builds ids with runes: iron_sword@3#ember1, iron_breastplate@3#life1, emberblade#dawn1
  ```

  A rune in armour or a shield gives `wards` or `maxHp`, and a weapon rune gives `onHit` entries (contract C1's table). This step reads those fields and does not build them.
- **Parallel with step 05.** Step 05 touches `battleEngine.ts`, `policies.ts`, `combat.ts` and `simulate.ts`'s `Tally`; this step touches `character.ts`, `gameState.ts`, `save.ts`, `debugCommands.ts` and their tests. Each edits only its own lines of CLAUDE.md, and the second to commit rebases its edit on the first.
- **Consumed by later steps:**
  - step 06 (runecraft) calls `clampHp` after changing a worn item, and takes from and adds to `game.runes`;
  - step 07 (loot, the trading post) adds to and takes from `game.runes`;
  - steps 08 and 09 show wards (`deriveCombatStats(...).wards`) and the pouch;
  - step 10 (the simulator) uses the pouch and `clampHp`.

## 4. Scope and implementation guidance

**Inspected paths** (at `7d32a0a`): `src/character/character.ts` (`maxHp`, `wornStats`, `deriveCombatStats`, `equipFromBackpack`, `unequipToBackpack`, `dropEquipped`), `src/game/gameState.ts` (`GameState`, `newGame`), `src/game/save.ts` (`SAVE_VERSION = 17`, the write and the `check(...)` chain on load), `src/scenes/debugCommands.ts` (`give`, `items`, `COMMANDS`).

1. **`maxHp`** (`character.ts`): add `Σ stats.maxHp` over `wornStats(character)`. This is the same set `maxMana` sums gear over, so an off-hand item under a two-handed weapon counts for nothing. `maxHp` is derived and never stored, so a level's `maxHpGained` and the camp's healing need no change.
2. **`deriveCombatStats`:**
   - **`wards`:** sum `stats.wards` by element over `wornStats` (the loop that sums resistance). Put `wards` on the result only when some element is above 0, as `resistance` is left out at 0. Iterate `ELEMENTS` (`combat.ts`) so the object's keys are in a fixed order.
   - **`onHit`:** `character.equipment.mainHand?.stats?.onHit`, exactly, put on the result only when it is non-empty. Ignore `onHit` on every other slot. No rune gives one there, but the rule is the main hand only.
   - Nothing else changes: Stone, Wind, Storm, Acid and Mind already fold into `damage`, `acBonus`, `resistance`, `toHit`, `critChance`, `armorPierce`, `spellSkill` and `maxMana`, which the loop sums today.
3. **`clampHp(character, maxBefore)`:** export it (C3 as amended). `equipFromBackpack`, `unequipToBackpack` and `dropEquipped` read `maxHp(character)` before they change anything and call it on every path that changed the equipment. `pickUp` and `dropFromBackpack` touch only the backpack and need nothing.
   - In battle, the inventory edits the `Character` and `BattleScene` sends an `equip` action that the engine clamps. Clamping the character too is harmless: the battle's own hit points are the engine's, copied back at the end.
   - Raising the maximum (putting Life armour on) leaves `hp` as it is.
   - Lowering it keeps the share (the user's D1): `hp = min(max, max(1, round(hp × max / maxBefore)))` when `hp > 0`. `Math.round` is the rounding (halves up).
4. **CLAUDE.md's hit-point rule.** It is under "On the world map the same panel changes gear at no cost": "No item changes maximum hit points, which is what keeps `hp <= maxHp` true however gear is changed outside battle; keep it so." Rewrite it to say:
   - only a Life rune's `maxHp` changes maximum hit points;
   - every change to what is worn ends with `clampHp`, so when the maximum drops the hero keeps the same share of its hit points (never above the new maximum, never to 0 from a positive value), and when it rises its hit points stay as they were;
   - a new way of changing what a character wears must call `clampHp`.

   Also fix the other places CLAUDE.md says no item touches maximum hit points (search for "maximum hit points" and "maxHp"). For example, the inventory line "no tier, grade or modifier touches maximum hit points" stays true, but add that a Life rune does.
5. **`GameState.runes: Pouch`:** add it to the interface, with a doc comment, and `runes: {}` in `newGame`. Find every other place that builds a `GameState` literal (tests, `save.ts`'s load, `debugCommands.test.ts` fixtures) and let `tsc` show them.
6. **`save.ts`:**
   - Write `runes` as is.
   - On load, add a `check` that `game.runes` is a plain object whose every entry has a key that `isRuneKey` accepts and a value that `Number.isInteger` and is ≥ 1. Return `runes` with the rest of the game.
   - Raise `SAVE_VERSION` from 17 to **18**, and update its comment's history if it keeps one.
   - Ids with runes need nothing new: `itemId` writes `item.id`, and `itemById` rebuilds it (step 03).
7. **Debug commands** (`debugCommands.ts`):
   - **`give <item|rune> [count]`:** if the first argument `isRuneKey`, add `count` (default 1, at least 1) of it to `gameOf(context).runes` with `addToPouch`, and answer, for example, `3 × Lesser Storm Rune put in the pouch.` (`runeName`). Otherwise keep today's behaviour. Its `usage` and `summary` mention runes. It still `changes: true`.
   - **`items`:** after today's lines, add the rune keys (each `RUNE_IDS` × `RANKS` key with its `runeName`, or one compact line per kind) and a line on the grammar: `Runes: <id>#<rune>[.<rune>…], as iron_sword@3#ember1; a unique item takes runes only, as emberblade#dawn1.`
   - **`runes`** (new entry in `COMMANDS`): lists `pouchKeys(game.runes)` with counts and names, or `The pouch is empty.` It reads only, so no `changes`.
   - Keep `help` complete: `help` builds its list from `COMMANDS`.
8. **CLAUDE.md** also needs:
   - `GameState` gains the pouch: the `gameState.ts` line in "Domain layer" lists what it holds;
   - the rules of saving, if they name what `GameState` holds;
   - the debug console's paragraph only if it names `give`'s behaviour.
9. **Out of scope:**
   - the engine's handling of `onHit` and `blightborn` (step 05);
   - runecraft (step 06), loot and the trading post (step 07), every scene's display (steps 08 and 09);
   - the simulator (step 10).

## 5. Verification

1. **`src/character/character.test.ts`** (existing), new cases, building items with `itemById` ids from step 03 (or `withRunes`):
   - **wards summed:** a hero in `iron_breastplate@3#ember1` (fire ward 2) with a socketed shield carrying another fire ward has `deriveCombatStats(...).wards.fire` equal to the sum. Build the shield from a tier-2 shield id such as `ironwood_shield#ember1`; check `socketsOf` in step 03 if the id is refused. A character with no wards has no `wards` key.
   - **shield under a two-handed weapon:** the same shield's ward counts for nothing while a two-handed weapon is in the main hand. Set `equipment` directly, as `wornStats` does for gear put together some other way.
   - **`onHit` from the main hand only:** `iron_sword@3#ember1` in the main hand gives `onHit` equal to that item's `stats.onHit`. With a plain main hand, `onHit` is absent.
   - **Life `maxHp`:** `iron_breastplate@3#life1` raises `maxHp(character)` and `deriveCombatStats(...).maxHp` by 4 over the plain `iron_breastplate@3`.
   - **`clampHp` after unequipping:** a character at full health in Life armour, after `unequipToBackpack(c, 'armor')`, has `hp === maxHp(c)`, 4 lower than before. A wounded one keeps its share, rounded to the nearest (for example 20 of 40 becomes 18 of 36), and one at 1 stays at 1 however far the maximum falls. Equipping it again leaves `hp` unchanged. Also cover `dropEquipped`, and an `equipFromBackpack` that replaces Life armour with plain. Test `clampHp` directly too: a fall keeps the share, a rise or no change leaves `hp` (at most the maximum), and `hp` 0 stays 0.
2. **`src/game/save.test.ts`** (existing):
   - a game with `runes: { ember1: 2, storm2: 1 }` and an item `iron_sword@3#ember1` in the baggage and worn round-trips: the same pouch, and the identical item object (`toBe` against `itemById`);
   - a save whose pouch holds a bad key (`fire1`, `ember5`) or a count of 0, −1 or 1.5 reads as unreadable (`null`);
   - a save of version 17 reads as unreadable. Raise any version literal the tests use.
3. **`src/scenes/debugCommands.test.ts`** (existing): `give storm1 3` adds 3 to `game.runes.storm1` and answers with the rune's name; `give iron_sword@3#ember1` puts that item in the baggage; `runes` lists the pouch; `items` includes a rune key line.
4. **Commands:**

   ```sh
   PATH=/opt/homebrew/opt/node@26/bin:$PATH npx vitest run src/character/character.test.ts src/game/save.test.ts src/scenes/debugCommands.test.ts
   PATH=/opt/homebrew/opt/node@26/bin:$PATH npm test
   ```

5. **The guard, identical to step 01's summary** (copy step 01's fenced block from its execution record and `diff` it):

   ```sh
   PATH=/opt/homebrew/opt/node@26/bin:$PATH npm run simulate -- --campaign --ready-level 7 --battles 500 --seed 1 --out logs/s4-step04-guard.jsonl
   ```

   Any difference is a bug, because the simulator's heroes carry no runes. `logs/` is gitignored; never commit a log.
6. **CLAUDE.md:** `grep -n "maximum hit points\|maxHp" CLAUDE.md` shows no line that still says no item changes maximum hit points.

## 6. Completion criteria

- [ ] `maxHp` adds worn items' `maxHp`. `deriveCombatStats` gives `wards` (summed, left out at 0) and `onHit` (main hand only, left out when none).
- [ ] `clampHp(character, maxBefore)` exported, keeping the share on a fall (D1), and called by `equipFromBackpack`, `unequipToBackpack` and `dropEquipped`.
- [ ] `GameState.runes` with `newGame` giving `{}`. The pouch is saved and validated on load. `SAVE_VERSION` is 18.
- [ ] `give` takes rune keys, `items` lists them and the grammar, and `runes` shows the pouch.
- [ ] Tests for all of the above pass. `npm test` passes.
- [ ] The guard is identical to step 01's, recorded in the execution record.
- [ ] CLAUDE.md's hit-point rule rewritten (correction 4), and the `gameState.ts` and debug lines updated.
- [ ] One commit on `long-campaign-stage-04`. The index's step 04 row is set to `done` with the commit, and the execution record below is filled.

## Execution record
