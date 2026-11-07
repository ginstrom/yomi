# Stage 10: Forging and the high tiers

Part of [the long campaign](index.md). Reference:
- [`reference/gear-and-runes.md`](reference/gear-and-runes.md) §4.2 (tiers 3–5), §4.3 (forging and trophies), §5.4 and §5.8 (expected kit);
- [`reference/economy-and-trade-routes.md`](reference/economy-and-trade-routes.md) §4.3 (partners' goods for sale).

## 1. Purpose and status

Gear reaches the far rings. Tiers 3 to 5 (Mithril, Adamant and Starmetal, with their woods and hides) are forged at the workshop's new levels 4 to 6, from ores and woods held in the outer rings and from trophies taken off slain monsters.

The workshop tempers high-tier items to Fine and Masterwork, and fuses runes to ranks 3 and 4. The Market Hall sells partners' goods, so rare materials have a gold price.

**Status:** ready for planning.

## 2. Scope

**In:**
- **Materials.**
  - `MATERIALS` tiers 3 to 5, and `TIER_BONUS` for them.
  - Strength relief for Mithril and Starmetal.
  - Sockets at tiers 3 to 5 (1, 2 and 2, with +1 at Masterwork).
- **The workshop.** Levels 4 to 6 (gear §4.3), with these functions:
  - `forge(game, family, material)` and its refusal;
  - `temper(game, place, grade)` and its refusal;
  - `craftCost` takes tier materials for tier 3 and up.
- **Fusing** to rank 3 at workshop level 4, and to rank 4 at level 5.
- **Trophies.** `TROPHIES` by kind, granted beside `rewardVictory`. Their materials are added to `Material`.

  Until stage 11 adds their monsters, wolfhide, wyvern hide, basilisk scale and drake scale come only from the trading post's partners' goods. Elder Glade sells wyvern hide as a stand-in, and the stage's notes record this.
- **Partners' goods** are for sale at the Market Hall at 3 gold a unit.
- **Bandit gear by ring** now uses tiers 3 to 5: Mithril from threat 9, Adamant from 12, Starmetal from 18.
- **Scenes.**
  - CraftingScene's Forge tab: families by slot, the allowed tiers, the cost, and stats against what is worn.
  - Temper, inside the Modify tab.
  - Material tints for tiers 3 to 5.
  - The trading post's partners' goods.
- **The simulator.**
  - The gear policy (gear §5.8, steps 1 and 2): families by role, forge and temper on home visits, with the war hammer and crossbow switches.
  - `expectedKit(role, level)`.
  - The record gains each member's main-hand tier and filled sockets at levels 5, 10, 15 and 20, and the gold spent on forging.

**Out:** monster trophies from real kills (stage 11).

## 3. Requirements

| ID | Requirement | Reference |
| --- | --- | --- |
| S10-R1 | Tiers 3 to 5 in every family, with their bonuses and sockets. | gear R1, R8 |
| S10-R2 | Workshop levels 4 to 6, forging and tempering. | gear R6, A4 |
| S10-R3 | Trophies by kind (data, and granting). | gear R7 |
| S10-R4 | Fusing to ranks 3 and 4. | gear R10 |
| S10-R5 | Partners' goods for sale. | economy §4.3 |
| S10-R6 | The simulator's gear policy, expected kit and record. | gear R14 |

## 4. What the player sees

- **At workshop level 4** with 20 mithril, the Forge tab offers a Mithril Longsword for 30 gold and 8 mithril. Forged, it has one socket. Tempered to Masterwork it has two.
- **The fighter's damage line** rises from 1d8+6 to 1d8+12 or so.
- **At the Market Hall,** Stonehollow's mithril sells for 3 gold a unit.

## 5. Technical notes

- `BASE_ITEMS` now covers all five tiers. The trading post still lists only tiers 1 and 2.
- **Versions:** `SAVE_VERSION` is bumped (the new materials in the stock).

## 6. Verification

**Tests:**
- `catalog.test.ts`: tiers 3 to 5.
- `crafting.test.ts`:
  - forge and temper, including refusals;
  - workshop levels 4 to 6.
- `runecraft.test.ts`: fusing to ranks 3 and 4.
- `tradingPost.test.ts`: partners' goods.
- `scripts/simulate.test.ts`: the gear policy on fixed states; `expectedKit`.
- Scene tests: the Forge tab and Temper.

**Simulator:**
1. The early-game guard.
2. The long campaign (100 campaigns): gear tiers at levels 5, 10, 15 and 20 against the expected kit. If gear lags, tune site yields, then forge costs. Compare the Source share and the battles to level with stage 9's baseline.

**Play script:**
1. Run `facility workshop 6` and `stock gold 500 mithril 30 adamant 30 starmetal 20`. Forge one item of each tier, temper one to Masterwork, and fill its sockets.
2. Fuse ranks up to 4.
3. With `xp` to level 15 and an adamant kit, fight a threat 15 Freebooter Host. It should be a fair fight. With iron, it should be a rout.
4. Buy mithril at the Market Hall.

## 7. Risks

- **The economy.** Measure it, and tune its sources before the gear's costs.

**Done when:** all tests pass, the guard holds, the gear policy tracks the expected kit within a tier, and the play script has been walked.
