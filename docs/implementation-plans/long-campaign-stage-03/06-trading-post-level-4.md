# Step 06: Trading post level 4 and the simulator

[Plan index](index.md) · [Stage design](../../designs/long-campaign/stage-03-gear-families.md) (§2 "The trading post", "The simulator"; §6 simulator check 1) · [Reference](../../designs/long-campaign/reference/gear-and-runes.md) §4.3, §5.5

**Engineer / reviewer:** sonnet / opus. The domain rules are routine. The simulator's buy rule moves the guard, so the review needs judgement.

## 1. Objective

The trading post gains a level 4 (120 gold, 20 silver) that sells tier 2 (steel, ironwood, wolfhide, silk) at every grade. `wares` takes a slot and family filter, which step 07's Buy tab will use. The simulator's careful party buys tier 2 when the post sells it and its gold allows, and the summary reports how many tier-2 items it bought. The guard is measured afterwards. Step 10 judges it.

## 2. Requirements and context

- **S3-R4:** trading post level 4 sells tier 2, and the wares filter. **Design §2:**
  - level 4 costs 120 gold and 20 silver;
  - tier 1 sells at grade 3 from level 3, and tier 2 at grades 1 to 3 at level 4;
  - per-family prices with the ×2.5 tier multiplier;
  - `visitFacilities` buys tier 2 when the post allows.

  Market income at levels 4 to 6 waits for stage 7.
- **Correction 16** (from the index, unchanged): **A trading post's level stops being its highest grade.** Levels 1 to 3 sell tier 1 at grades up to the level. Level 4 adds tier 2 at every grade (design §2).
- **Correction 20** (from the index, unchanged): **"Buys tier 2 when the post allows" needs a rule.** The simulator buys, for each member's weapon, shield and armour, the dearest item of the same family that the post sells and the gold affords, if it costs more than what is worn (unmodified). Price stands in for worth across tier and grade.

### Contract C5. Prices (step 04; level 4 and the filter in this step)

```ts
// src/game/tradingPost.ts
export const PRICES: Readonly<Record<FamilyId, number>>   // tier 1, grade 1
export const TIER_PRICE: Record<Tier, number>             // { 1: 1, 2: 2.5 }
// buyPrice(item) = PRICES[family] × TIER_PRICE[tier] × GRADE_PRICE[grade]; null for an enchanted item.
// VALUES loses spark_wand.
```

| Family | Price | Family | Price | Family | Price | Family | Price |
| --- | --- | --- | --- | --- | --- | --- | --- |
| dagger | 6 | battle_axe | 14 | wand | 30 | robe | 10 |
| shortsword | 8 | war_hammer | 18 | staff | 16 | leather | 14 |
| rapier | 10 | greatsword | 20 | buckler | 6 | breastplate | 20 |
| longsword | 12 | halberd | 22 | shield | 10 | plate | 30 |
| mace | 12 | bow | 12 | tower_shield | 18 | cap, gloves, boots | 4 |
| spear | 12 | longbow | 16 | | | helm, gauntlets, greaves | 6 |
| | | crossbow | 18 | | | | |

Today's eight keep today's prices. In step 04, `wares(world)` lists tier 1 only (every family, at grades up to the level), so a level-1 to 3 post sells no steel before step 06.

### Contract C8. The trading post's level 4 and filter (domain part; the scene is step 07)

```ts
// src/game/tradingPost.ts
// TRADING_POST_COSTS gains level 4: { gold: 120, silver: 20 }; MAX_TRADING_POST_LEVEL becomes 4.
/** The level from which the post sells tier 2. */
export const TIER_TWO_LEVEL = 4
/** Whether the post at its level sells `item`: tier 1 at grades up to min(level, 3); tier 2 at every grade from TIER_TWO_LEVEL. */
export function sells(world: WorldState, item: Item): boolean
export interface WaresFilter { slot?: EquipmentSlot; family?: FamilyId }
/** What the post sells, narrowed by `filter`: by tier, then grade, then FAMILIES order. */
export function wares(world: WorldState, filter?: WaresFilter): Item[]
```

- `buyRefusal` refuses an item the post does not sell at its level: "A level N trading post sells that.", where N is the lowest level that does.
- The encampment's trading post `effect` line names level 4: "Sells plain, Fine and Masterwork gear, in iron and steel."
- **The simulator** (`scripts/simulate.ts` `visitFacilities`) follows correction 20. `Trade` gains `tierTwoBought: number`, and the summary prints the tier-2 items bought a campaign.

### Shared constraints (from the index)

- Local Node 26: prefix commands with `PATH=/opt/homebrew/opt/node@26/bin:$PATH`, or use the podman `make` targets. `npm test` (`tsc && vitest run`) is the gate before the commit.
- The guard command, exactly: `npm run simulate -- --campaign --ready-level 7 --battles 500 --seed 1` (or `make -s simulate ARGS="..."`).
  - About a minute and some 70 MB of logs under `logs/` (gitignored, never committed).
  - Locally, give concurrent runs distinct `--out` files. Never run two `make simulate` at once.
- Test layout: `src/**/*.test.ts` and `scripts/**/*.test.ts` run in the Node `domain` project.
- Determinism: add, drop or reorder no RNG draw in a battle. This step changes only the world map's spending.
- One commit on `long-campaign-stage-03`, without pushing; never switch branches. The message ends with the repo's `Co-Authored-By` attribution line.
- CLAUDE.md stays current. Update the lines this change makes wrong, and search it for every name renamed or deleted.

## 3. Dependencies and prerequisites

- **Step 05 done** (and, through it, step 04).
- **Existing from step 04** (check it is in the code before starting):
  - `src/inventory/catalog.ts`, with `FamilyId`, `Tier`, `FAMILIES` (order matters for `wares`) and `MATERIALS`;
  - `Item.family`, `Item.tier` and `Item.grade` on every plain item;
  - `BASE_ITEMS`: 56 items, each family's tier 1 before its tier 2;
  - `itemById` and `craftedItem(base, grade)`;
  - C5's `PRICES`, `TIER_PRICE` and `buyPrice`;
  - `wares(world)` limited to tier 1;
  - `PREFERRED_MODIFIERS` keyed by family.
- **Existing in the code at `866f732`:**
  - `TRADING_POST_COSTS` (three entries: `{}`, `{gold 40, stone 15}`, `{gold 80, copper 15}`), `raiseTradingPost`, `buyRefusal` and `buy`;
  - `encampment.ts` `FACILITIES`: the trading post's `effect: (_, level) => ...`, indexed `[level - 1]` over three strings;
  - `debugCommands.ts` `facility`, which checks against `facility.maxLevel` (`MAX_TRADING_POST_LEVEL`), so `facility trading_post 4` works once the constant is 4;
  - `scripts/simulate.ts`: `Trade` (`goldOnGear`, `goldFromSales`, `crafted`), `visitFacilities` (`while (raiseTradingPost(game) === null);`, then the grade-only buy loop over `GEAR_SLOTS`), `materialNeeds` (adds `TRADING_POST_COSTS.slice(world.tradingPost)`, so the 20 silver is kept from sale with no extra code), the per-campaign record (`tradingPostLevel`, `goldOnGear`, …) and the summary (`avgGoldOnGear`, …).
- **The `Material` stock type** already has `silver`.
- **Produces for step 07:** `wares(world, filter)`, `WaresFilter`, `sells` and `TIER_TWO_LEVEL`. **For step 10:** the guard figure after this step, tier-2 items bought a campaign, and the trading post's final level.

## 4. Scope and implementation guidance

**`src/game/tradingPost.ts`:**
1. Append `{ gold: 120, silver: 20 }` to `TRADING_POST_COSTS`, so `MAX_TRADING_POST_LEVEL` is 4. Fix the doc comment that says the level is the highest grade sold (correction 16).
2. Add `TIER_TWO_LEVEL = 4` and `sells(world, item)`:
   - a plain item only (`baseItem(item)` non-null, no `mod`);
   - tier 1 when `grade ≤ min(world.tradingPost, 3)`;
   - tier 2 when `world.tradingPost ≥ TIER_TWO_LEVEL`, at any grade.
3. Rewrite `wares(world, filter = {})`. List every `BASE_ITEMS` base at every grade that `sells` allows, narrowed by `filter.slot` (`item.slot`) and `filter.family` (`item.family`), ordered by tier, then grade, then `FAMILIES` order. So "plain first" holds within a tier, and an unfiltered level-3 post lists what step 04's did. Items come from `craftedItem(base, grade)`, so each is the object `itemById` gives.
4. `buyRefusal`: replace the grade-only check with `sells`. When it fails, name the lowest level that would sell the item: for tier 1, its grade; for tier 2, `TIER_TWO_LEVEL`. Use the words "A level N trading post sells that." Keep the other refusals and their order (away from home, not sold at all, not enough gold).
5. `buy`, `salePrice`, `sellables` and `sellMaterial` are unchanged. Tier-2 prices follow from step 04's `buyPrice`.

**`src/game/encampment.ts`:**
- The trading post's `effect` covers level 4, "Sells plain, Fine and Masterwork gear, in iron and steel.", and keeps levels 1 to 3's words.
- Check the facility's `about` line still reads true.
- Extend `encampment.test.ts` if it pins the effect strings or `maxLevel`.

**`scripts/simulate.ts`:**
1. `Trade` gains `tierTwoBought: number`, initialised to 0.
2. In `visitFacilities`, replace the grade-only purchase. For each member and each slot of `GEAR_SLOTS` (unchanged: main hand, off hand, armour; no small slots, as the ready-made families do not change):
   - the worn item's family is `worn.family`; skip enchanted or familyless items;
   - the candidates are `wares(world, { family: worn.family })`;
   - keep those with `buyPrice(candidate) > buyPrice(unmodified(worn))` and `buyPrice(candidate) ≤ gold`;
   - take the dearest. On a tie, take the later in `wares` order, which is the higher tier, then the higher grade.
   - Buy it as today: `buy`, pop it from the baggage, wear it, and put the old one in the baggage. Add to `goldOnGear`, and to `tierTwoBought` when the bought item's `tier` is 2.
   - The raise loop (`while (raiseTradingPost(game) === null);`) stays where it is, so the post rises to 4 as soon as the stock affords it. That is the design's behaviour and a new gold sink; measure it, don't change it here.
3. `materialNeeds` needs no change: `TRADING_POST_COSTS.slice(world.tradingPost)` now includes level 4's silver. Confirm it with a test.
4. The per-campaign record and the `Summary` gain the tier-2 count. Its average a campaign is printed on its own line beside the gold spent on gear, in the summary's style ("tier-2 items bought").
5. Update the header comment and help text if they list what is reported.

**CLAUDE.md** (only the lines this step makes wrong):
- The `tradingPost.ts` line in "Domain layer": its levels and the grades and tiers they sell; `wares` takes a filter.
- The simulator paragraph: `visitFacilities` "buys each member the best grade it can of its weapon, shield and armour" becomes the dearest of the same family the post sells (tier 2 from level 4), and the summary also prints the tier-2 items bought.
- The rules of the encampment's gear, if they say the post sells only up to Masterwork.

**Out of scope:**
- the Buy tab's filter buttons and probe (step 07);
- bandits' gear (step 09);
- tuning the price or the level 4 cost (step 10, if the guard needs it);
- the manual (step 10).

## 5. Verification

- **`src/game/tradingPost.test.ts`**, new or extended:
  - level 4 costs `{ gold: 120, silver: 20 }`;
  - `raiseTradingPost` from 3 to 4 spends exactly that;
  - at 4 it refuses with "as great as it gets", and without the stock it refuses with the cost;
  - `sells`: tier 1 at grades 1..level for levels 1 to 3, and grade 3 at level 4; tier 2 never below 4, and every grade at 4;
  - `wares` at levels 1 and 3 lists no tier-2 item, and at 4 lists every tier-2 base at grades 1 to 3 (56 bases × 3 grades = 168 items unfiltered);
  - the filter by slot: `{ slot: 'head' }` gives only cap and helm, both tiers;
  - the filter by family: `{ family: 'longsword' }` at level 4 is exactly `iron_sword`, `iron_sword@2`, `iron_sword@3`, `steel_longsword`, `steel_longsword@2`, `steel_longsword@3`, in that order (tier, grade, family order);
  - the ordering of an unfiltered list: every tier-1 item before any tier-2 one, and grade ascending within a tier;
  - the refusal text: buying `steel_longsword` at level 3 gives "A level 4 trading post sells that.", and `iron_sword@3` at level 2 gives "A level 3 trading post sells that.";
  - prices: `buyPrice(steel_longsword)` is 30 (12 × 2.5), `steel_longsword@3` is 240, `ironwood_shield` is 25, and `silk_robe` is 25; every tier-2 price is a whole number (the existing "prices every plain item" test, run over all `BASE_ITEMS`).
- **`src/game/encampment.test.ts`:** the trading post's `maxLevel` is 4, and its level-4 effect line.
- **`scripts/simulate.test.ts`:** `visitFacilities` on fixed states:
  - at post level 3 with ample gold, a hero in `iron_sword` gets `iron_sword@3`, and `tierTwoBought` stays 0;
  - at level 4 with ample gold, it gets `steel_longsword@3`, and `tierTwoBought` counts it;
  - at level 4 with 35 gold, it buys `steel_longsword` (30), the dearest it affords, since `iron_sword@2` costs 36;
  - nothing is bought when nothing dearer than the worn item is affordable;
  - the old item is sold back (it is in the baggage, which `sellAll` empties);
  - `materialNeeds` at post level 3 includes 20 silver, and at level 4 none for the post.
- **`npm test`** passes, and `npm run typecheck` is clean.
- **The guard:** run the guard command once.
  - Record the full summary in the execution record: the Source beaten of 500, days, battles, heroes dead, gold spent on gear, the new tier-2 count, and the trading post's final level.
  - Compare with step 01's and step 05's figures.
  - Do not tune. Step 10 judges a move of more than about 5 points.
  - If the run is far off (more than 20 points), say so in the record and in the index row, so step 10 starts with it in view.

## 6. Completion criteria

- [ ] `TRADING_POST_COSTS` has level 4, `MAX_TRADING_POST_LEVEL` is 4, and `TIER_TWO_LEVEL`, `sells`, `WaresFilter` and `wares(world, filter)` are as in C8.
- [ ] `buyRefusal` uses `sells` and names the lowest selling level.
- [ ] The encampment's trading post line covers level 4; `facility trading_post 4` is accepted by the debug console.
- [ ] `visitFacilities` follows correction 20; `Trade.tierTwoBought` is tallied and printed in the summary.
- [ ] The tests above pass; `npm test` is green.
- [ ] The guard measured and recorded here with tier-2 items bought and the post's final level, and summarised in the index's step 06 row.
- [ ] The CLAUDE.md lines updated.
- [ ] One commit on `long-campaign-stage-03`, not pushed, with the attribution line; the index row set to `done` with the commit.

## Execution record

### Done (engineer, sonnet)

- `tradingPost.ts`: level 4 `{ gold: 120, silver: 20 }` (max level 4), `TIER_TWO_LEVEL`, `sells`, `WaresFilter`, `wares(world, filter)` (tier, grade, family order), `buyRefusal` uses `sells` ("A level N trading post sells that."). `encampment.ts` effect line for level 4. `simulate.ts`: `visitFacilities` buys per correction 20 (dearest of the family the post sells, dearer than the worn item unmodified and affordable; a tie goes to the later in `wares`), `Trade.tierTwoBought`, tallied and printed on its own line. CLAUDE.md's tradingPost and simulator lines updated.
- Tests: `tradingPost.test.ts` (level 4, `sells`, `wares` count/order/filters, refusals, prices), `encampment.test.ts` (max level 4, effect line; the raise loop now needs silver), `simulate.test.ts` (buying at levels 3 and 4, 35 gold buys `steel_longsword`, nothing dearer affordable, old item sold, silver kept), `debugCommands.test.ts` (facility range text "1 to 4"). `npm test`: 73 files, 1047 tests pass.
- **Guard** (`npm run simulate -- --campaign --ready-level 7 --battles 500 --seed 1`, against step 04's and the follow-up's 231): **233 of 500 (46.6%)**, 269 days, 18.2 battles, 1.8 heroes dead, 26.0 spawns, 2 gold on gear and 51 from sales, **tier-2 items bought 0.0 a campaign**, trading post final level 1.1 (workshop 0.6, infirmary 0.5), threat 5 won 0.896, threat 3 0.968. Step 01's was 248; the move from 231 is +2, within noise: no campaign gets near level 4 (the post averages 1.1 because gold goes to the hall and recruits first), so the only live change is that `materialNeeds` now keeps 20 silver, which shifts a few sales by a gold piece or two and, through the world RNG's later draws, a few campaigns. No tuning.
- Departure: the tier-2 line is printed as its own `console.log` (the first draft passed it as a second argument and printed on the same line as the trading post's).

