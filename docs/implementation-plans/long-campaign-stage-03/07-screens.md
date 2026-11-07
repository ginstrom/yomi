# Step 07: The screens

[Plan index](index.md) · [Stage design](../../designs/long-campaign/stage-03-gear-families.md) (§2 "The trading post", "Icons", "gearCompare and the inventory tooltip"; §4 "What the player sees"; §7 risks) · [Reference](../../designs/long-campaign/reference/gear-and-runes.md) §5.7

**Difficulty:** moderate. This is pattern-following scene work over helpers that already exist (`gearCompare.ts`, `itemIcons.ts`, the trading post's paged list). Engineer `model: "sonnet"`; reviewer on the session's model (opus), because layout at 840×560 and probe design need judgement.

## 1. Objective

The player sees what steps 04 to 06 built:
- the trading post's Buy tab has a slot and family filter, opening on weapons;
- the inventory tooltip, the trading post's details and the crafting screen's comparison show strength (with the shortfall where a wearer is known), the AP penalty, reach, ranged piercing, spell skill and mana;
- tier-2 items' icons are tinted by material in the inventory, the trading post and the crafting screen.

No rule changes. The campaign summary is untouched (the simulator does not load scenes).

## 2. Requirements and context

- **Design requirements:**
  - S3-R4: the wares filter. Design §7: "The trading post list is long. The filter must default to the slot of the hero selected, or to weapons."
  - S3-R5: icons, tints and tooltips for all of it. Design §2: "gearCompare and the inventory tooltip show strength, shortfall, AP penalty, reach and spell-skill penalty."
- **The list is long.** At level 4 the post sells 28 families × 2 tiers × 3 grades, about 168 rows. Without a filter that is 16 pages of 11.
- **The play script** (design §6, walked in step 10) runs through these screens:
  1. `facility trading_post 4`, then `stock gold 500`; open the trading post, filter to weapons and then to the war hammer, and buy a steel war hammer and a steel helm.
  2. Equip the hammer on the mage, and see the strength shortfall in the comparison.
  3. Equip plate on the fighter, and see 7 AP.

  This step makes steps 1 and 2 possible on screen.

### Correction 14 (from the index, unchanged)

> **The trading post has no selected hero** (no party column). Its filter defaults to weapons (`mainHand`). The strength shortfall is shown only where a wearer is known: the inventory tooltip for the member whose panel is open, and the crafting screen for an item worn or carried by a member. Elsewhere it shows the bare requirement, "Strength: 6".

### Contract C6, the tints (from the index, unchanged)

```ts
// src/scenes/itemIcons.ts (step 04)
/** A tier-2 material's tint over its family's icon; tier 1 is drawn untinted. */
export const MATERIAL_TINTS: Readonly<Record<string, number>>   // steel, ironwood, wolfhide, silk
export function iconTint(item: Item): number | undefined
```

### Contract C7, the words (from the index, unchanged)

| Stat | Tooltip line (`describeItemStats`) | Comparison label: words (`statWords`) | List summary (`statSummary`) |
| --- | --- | --- | --- |
| reach | `Reach: 2 hexes` (in place of `Range:`) | `Range: 2 hexes, reach` | `reach 2` |
| rangedPierce | `Pierces 2 resistance, even at range` | `Pierces: 2 resistance, even at range` | `pierces 2` |
| strength | `Strength: 6`; short: `Strength: 6 (you have 3): to hit −15%` | `Strength: 6`, or `6 (you have 3): to hit −15%` | `str 6` |
| apPenalty | `Action Points: −1` | `AP: −1` | `AP −1` |
| spellSkill | `Spell Skill: −15%` (signed, correction 21) | `Spell Skill: −15%` | `spell −15%` |
| maxMana | `Mana: +4` (as now) | `Mana: +4` | `mana +4` |

Also from the index (step 04): `SHORTFALL_TO_HIT = 5`, `strengthShortfall(strength, stats)` and `describeItemStats(stats?, wearerStrength?)` in `src/inventory/inventory.ts`. Step 04 already writes the tooltip column; this step only passes the strength.

### Contract C8, the scene (from the index, unchanged)

```ts
// src/testHook.ts — TradingPostProbe gains:
filter: { slot: EquipmentSlot; family: FamilyId | null }
/** One per slot the post sells for, in the order mainHand, offHand, armor, head, gloves, boots. */
slotButtons: Array<ButtonProbe & { slot: EquipmentSlot }>
/** "All" (family null), then each family of the slot shown, in FAMILIES order. */
familyButtons: Array<ButtonProbe & { family: FamilyId | null }>
```

- The Buy tab opens on `{ slot: 'mainHand', family: null }` (correction 14).
- Changing the filter goes back to page 1. The Sell tab is not filtered.
- It all fits the 840×560 minimum.

The domain side, from step 06 (C8):

```ts
export interface WaresFilter { slot?: EquipmentSlot; family?: FamilyId }
/** What the post sells, narrowed by `filter`: by tier, then grade, then FAMILIES order. */
export function wares(world: WorldState, filter?: WaresFilter): Item[]
```

### Shared constraints (from the index)

- Local Node 26: prefix commands with `PATH=/opt/homebrew/opt/node@26/bin:$PATH`, or use the podman `make` targets.
- `npm test` is the gate before the commit.
- After a scene change, run the in-browser tests: `npm run test:browser` (or `make test-browser`). Read `e2e/CLAUDE.md` before adding one.
- Test layout:
  - `src/scenes/*Scene.test.ts` run under jsdom and are smoke tests;
  - Phaser-free helpers (`gearCompare.ts`, `itemIcons.ts`) are tested in the `domain` project and must not import Phaser at runtime;
  - real behaviour is tested through the helpers.
- Game code must not read the test hook or the probes. A control a test clicks goes in its scene's probe.
- A scene that redraws itself after a change does so on the next tick, as the redraw destroys the button whose handler asked for it. Its new buttons take clicks only from the frame after (CLAUDE.md, the scene layer). The filter buttons redraw the list, so they follow this rule.
- One commit, on `long-campaign-stage-03`, without pushing. Never switch branches. The message ends with the repo's `Co-Authored-By` attribution line.
- CLAUDE.md stays current: update the lines this change makes wrong or incomplete.

## 3. Dependencies and prerequisites

- **Step 04** (done before this): `catalog.ts` (`FAMILIES`, `FamilyId`), `Item.family`, `Item.material` and `Item.tier`, and the new `ItemStats` fields. Also these, which this step consumes:
  - `describeItemStats(stats?, wearerStrength?)`, already writing the tooltip column of C7;
  - `strengthShortfall` and `SHORTFALL_TO_HIT`;
  - `MATERIAL_TINTS` and `iconTint` in `itemIcons.ts`;
  - `ITEM_ICON_KEYS` with the 19 new icons.
- **Step 05:** `deriveCombatStats` applies the shortfall and `apPenalty`, so the character panel's AP and the battle's hit chances already show them. This step adds no derivation.
- **Step 06:** `wares(world, filter?)`, `sells`, level 4 (`MAX_TRADING_POST_LEVEL` 4), and the encampment's level-4 line.
- **Existing code** (at `866f732`; inspected):
  - `src/scenes/TradingPostScene.ts`: Buy and Sell tabs; `ROWS_PER_PAGE = 11`; `rows()` builds the Buy lines from `wares(game.world)` with `statSummary`; details from `statLines(row.item, row.ap)`; icons drawn with `this.add.image(..., ITEM_ICON_KEYS[row.item.icon])`; `show(tab)` resets the page; `probe()` returns `TradingPostProbe`.
  - `src/scenes/gearCompare.ts`: `statWords(stats, ap)` (private), `statLines(item, ap)`, `statSummary(item)`, `compareLines(before, after, ap)`. Tested in `src/scenes/gearCompare.test.ts`.
  - `src/scenes/CraftingScene.ts`: `apAt(place)` uses `deriveCombatStats(party[place.member])` for a worn or carried item, else `TYPICAL_AP`; `preview` calls `compareLines(item, option.result, this.apAt(place))`; icons are at line ~217.
  - `src/scenes/InventoryScene.ts`: the tooltip (around line 1181) is `[item.name, item.description, ...describeItemStats(item.stats)]`; item icons are at line ~959 (`ITEM_ICON_KEYS[item.icon]`, `ITEM_ICON_SCALE`); the open member is `this.character`.
  - `src/testHook.ts`: `TradingPostProbe` (line ~196).
  - `e2e/encampment.test.ts`: the trading post test (lines ~140 to 170) buys `iron_sword`, sells, and pages to `material:salt`.
- **Produces for later steps:** step 10 retakes the manual's trading-post screenshot (`e2e/manual.shots.ts` clicks `iron_sword@2`, which must stay reachable on the default filter at level 2) and walks the play script through these screens.

## 4. Scope and implementation guidance

### 4.1 `gearCompare.ts` (Phaser-free)

- `statWords(stats, ap, strength?)` gains the rows of C7's comparison column, in a fixed order. Put them after the existing weapon rows and before `Critical`: Range (with reach), Pierces (with "even at range"), Strength, AP, Armor Class, Resistance, To Hit, Spell Skill, Mana, Critical. The implementer may choose the exact order, but it must be fixed.
  - **Strength:** `6` when `strength` is undefined or the item asks no more. With a known wearer short of it, `6 (you have 3): to hit −15%`, the penalty being `strengthShortfall(strength, stats) × SHORTFALL_TO_HIT`.
  - **Range for reach weapons:** `2 hexes, reach`.
- **Exported signatures** (the new parameter is optional, so today's callers keep working):

  ```ts
  export function statLines(item: Item, ap = TYPICAL_AP, strength?: number): string[]
  export function statSummary(item: Item): string            // adds C7's summary column
  export function compareLines(before: Item, after: Item, ap = TYPICAL_AP, strength?: number): string[]
  ```

- `attacksPerTurn` is unchanged. An armour's `apPenalty` shows as its own `AP: −1` row; it does not recompute the holder's attacks. That is the character panel's job, through `deriveCombatStats`.

### 4.2 `TradingPostScene.ts`

- **State:** `filter: { slot: EquipmentSlot; family: FamilyId | null }`, set to `{ slot: 'mainHand', family: null }` whenever the scene starts and whenever the Buy tab is shown.
- **Rows:** the Buy lines come from `wares(game.world, { slot, family: family ?? undefined })`. The Sell tab ignores the filter and is unchanged.
- **Controls:** on the Buy tab only:
  - a row of slot buttons (Weapons, Shields, Armor, Head, Hands, Feet; labels from `EQUIPMENT_SLOT_LABELS`, or short words of the implementer's);
  - under it, "All" and the families of the chosen slot, from `FAMILIES` filtered by slot.
  - Weapons have 15 families. They will not fit as one row of wide buttons at 840 px, so lay them out compactly: two rows of small buttons, or a scrolling or paged strip. The implementer chooses, as long as every family button is reachable and within the scene's frame at 840×560. Give the probe the real positions.
- **A click** on a slot sets `{ slot, family: null }`; a click on a family sets the family; a click on "All" sets null. Each resets `page` to 0, clears the selection, and redraws on the next tick. The pressed filter buttons are drawn selected, as the tabs are.
- **The list area** may need `ROWS_PER_PAGE` or `LIST_TOP` adjusted to make room. Keep everything within 840×560.
- **Details:** `statLines(row.item, row.ap)` with no strength (correction 14), so a strength line reads `Strength: 6`.
- **Icons:** after `this.add.image(...)`, apply `iconTint(item)` when it is defined (`setTint`).
- **Probe:** fill `filter`, `slotButtons` and `familyButtons` (C8) in `src/testHook.ts` and `probe()`. While the Sell tab shows, `slotButtons` and `familyButtons` are empty, or marked not visible, in the form `ButtonProbe` already uses. Say which in the probe's doc comment.

### 4.3 `InventoryScene.ts`

- **The tooltip:** `describeItemStats(item.stats, attributeLevel(this.character, 'strength'))`. The strength is the open member's, perks included (`attributeLevel` from `src/character/perks.ts`). This works in battle and on the world map alike: a ground or baggage item hovered while a member's panel is open is judged for that member.
- **Icons:** apply `iconTint(item)` to every item icon the panel draws (equipment slots, backpack, ground or baggage).

### 4.4 `CraftingScene.ts`

- **The comparison:** pass the wearer's strength for an item worn or carried by a member, `attributeLevel(party[place.member], 'strength')`, and none for the baggage, beside `apAt`. Name the helper as `apAt` is named, for example `strengthAt(place)`.
- **Icons:** apply `iconTint(item)` to the list's icons.

### 4.5 CLAUDE.md

Update the scene-layer lines this changes:
- `TradingPost`: "has Buy and Sell tabs of paged lines; the Buy tab filtered by slot and family, opening on weapons";
- the helpers' line for `gearCompare.ts`: the strength, AP, reach and spell lines, with the shortfall where a wearer is known;
- the assets paragraph: `InventoryScene`, `TradingPostScene` and `CraftingScene` tint a tier-2 item's icon by `MATERIAL_TINTS`.

Search CLAUDE.md for every name changed here before committing.

### 4.6 Out of scope

- Any rule, price or derivation (steps 04 to 06).
- The manual and its screenshots (step 10).
- Socket pips and rune lines (stage 4).
- Tinting gear sprites on the body (correction 10: a tier tints only the icon).

## 5. Verification

1. **`src/scenes/gearCompare.test.ts`** gains cases:
   - a steel war hammer's lines with no strength show `Strength: 6`; with strength 3 they show `Strength: 6 (you have 3): to hit −15%`; with strength 6 or more they show no shortfall;
   - an iron plate shows `AP: −1` and `Spell Skill: −15%`;
   - an iron spear's range reads `2 hexes, reach`; a crossbow's piercing reads `2 resistance, even at range`;
   - an ash staff shows `Mana: +4` and `Spell Skill: +5%`;
   - `statSummary` gives the summary column (`str 6`, `AP −1`, `reach 2`, `spell −15%`, `mana +4`);
   - `compareLines` with a strength reports the strength row changing when the requirement changes, and leaves equal rows out (as now);
   - today's lines for the eight legacy items are unchanged (keep or extend the existing assertions).
2. **`src/scenes/TradingPostScene.test.ts`** (smoke): at level 4 the scene starts with `filter` `{ slot: 'mainHand', family: null }`, every row a main-hand item, and `slotButtons` with six entries. A family filter (by calling the scene's handler, as the existing smoke tests drive it) leaves only that family's rows, tier 1 and tier 2. Switching to Sell shows the unfiltered sell lines.
3. **`src/scenes/InventoryScene.test.ts` and `CraftingScene.test.ts`:** keep passing. Add a smoke assertion only if those files already check tooltip or comparison text; the words are tested in `gearCompare.test.ts`.
4. **`e2e/encampment.test.ts`:**
   - The existing trading-post test still passes. `iron_sword` is on the default (weapons) filter. Its sell steps are on the Sell tab, which is unfiltered.
   - A new test: set the post to level 4 and the stock's gold (through the debug console as `debug.test.ts` does, or by planting a save, whichever `e2e/CLAUDE.md`'s patterns favour), open the trading post, and check the probe's `filter` is weapons. Click the war hammer's family button with `settled`, check every row is a war hammer and one is `steel_war_hammer`, and buy it. Click the Head slot and buy `steel_helm`. Use probe positions only, never pixels.
   - No console errors (the driver fails the test on any, and a missing icon texture would show here).
5. **Run** `npm run test:browser -- -t "trading post"` (or the new test's name), then the full `npm run test:browser`.
6. **Look at it:** take one screenshot of the Buy tab at 840×560 with the weapons filter and one with a family selected (the driver's page, or `make dev` and a browser), to confirm nothing overflows the frame. Note in the record where they are (scratchpad; not committed).
7. `npm test` passes.

## 6. Completion criteria

- [ ] The Buy tab filters by slot and family, opens on weapons, resets to page 1 on a change, and leaves Sell unfiltered; it fits 840×560.
- [ ] `TradingPostProbe` has `filter`, `slotButtons` and `familyButtons` as C8 gives them.
- [ ] The inventory tooltip shows the open member's shortfall. The crafting comparison shows the holder's shortfall for worn or carried items, and the bare requirement for baggage. The trading post shows the bare requirement.
- [ ] `gearCompare.ts` produces C7's comparison and summary columns, with tests.
- [ ] Tier-2 icons are tinted in `InventoryScene`, `TradingPostScene` and `CraftingScene`.
- [ ] Scene smoke tests and the new in-browser filter test pass; the full in-browser run passes, or its failures are shown to be unrelated.
- [ ] CLAUDE.md's scene-layer lines are updated.
- [ ] `npm test` passes; committed on `long-campaign-stage-03` without pushing. The index's step 07 row is set to `done` with the commit.

## Execution record

### Execution record (step 07)

**Built.** `gearCompare.ts`: `statWords`, `statLines` and `compareLines` take the wearer's strength; rows for reach ("2 hexes, reach"), ranged piercing, Strength (with "(you have N): to hit −X%" on a shortfall), AP, Spell Skill and Mana; `statSummary` gains `reach N`, `str N`, `AP −N`, `spell ±N%`, `mana +N` (str and AP after resists). `TradingPostScene`: Buy tab filter (six slot buttons across the frame, "All" and the slot's families under them, eight to a row), opening on weapons and reset whenever Buy is shown; every filter click goes to page 1 and clears the selection. Geometry: frame 720x520 (was 500, still unscaled at 840x560), Buy list from y 194 with 8 rows a page, Sell unchanged at 11 rows from y 122; the details' confirm buttons now sit at fixed y (432, and 392 for a material's second) and the summary line may wrap, the stats going under its height. Probe: `filter`, `slotButtons`, `familyButtons` (empty on Sell). `InventoryScene`: tooltip with `attributeLevel(character, 'strength')`; tints on equipment and backpack/ground icons. `CraftingScene`: `strengthAt(place)` (none for baggage), tinted list icons. CLAUDE.md's three lines updated.

**Records folded in (from step 06's review).** `tradingPost.test.ts` "prices tier 2" asserts `steel_longsword@3` at 240; the index's step 05 and Q1 lines carry "strength 3 since the follow-up 7ed89c6; guard 231"; step 06's row names 2ea4b87.

**Verification.** `npx vitest run` gearCompare and tradingPost tests green; `npm run test:browser -- -t "trading post"`: 2 passed (the existing buy/sell test unchanged, and the new filter test: weapons default, 16 family buttons, war hammer filter, buy `steel_war_hammer`, Head slot, buy `steel_helm`, Sell shows no filter buttons). Screenshots (scratch, not committed) in `/private/tmp/claude-501/-Users-ryan-personal-yomi/9864f087-b236-4a3d-9319-44800c0a8111/scratchpad/shots/`: `1_weapons`, `2_hammer`, `3_plate`, each `_840.png` and `_1600.png`. A first look found the details summary (two lines for a plate) overprinting the stats; fixed by placing the stats under the summary's height.

**Departures.** (1) No jsdom smoke assertions on the scene's filter: the scene test file only checks registration (the scenes project has no harness that creates a running scene), so the filter is covered by the in-browser test through the probe. (2) The drag ghost in `InventoryScene` is not tinted (tier only tints icons in slots). (3) The inventory tooltip's and crafting comparison's strength lines were checked through `gearCompare.test.ts` and typecheck, not by eye in a browser. (4) Frame height 500 to 520 and Buy rows 11 to 8 to make room for the filter.

**Final runs.** `npm test`: 73 files, 1050 tests passed. Full `npm run test:browser`: 78 of 80 passed; `saves` ("deletes the slot of a party that falls", timeout) and `world` ("ignores Home while the party walks") failed while another engineer's work shared the machine, and both files pass on rerun (38 of 38).
