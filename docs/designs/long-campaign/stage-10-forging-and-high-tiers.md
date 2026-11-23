# Stage 10: Forging and the high tiers

Part of [the long campaign](index.md). Reference:
- [`reference/gear-and-runes.md`](reference/gear-and-runes.md) §4.2 (tiers 3–5), §4.3 (forging and trophies), §5.4 and §5.8 (expected kit);
- [`reference/economy-and-trade-routes.md`](reference/economy-and-trade-routes.md) §4.3 (partners' goods for sale).

## 1. Purpose and status

Gear reaches the far rings. Tiers 3 to 5 (Mithril, Adamant and Starmetal, with their woods and hides) are forged at the workshop's new levels 4 to 6, from ores and woods held in the outer rings and from trophies taken off slain monsters.

The workshop tempers high-tier items to Fine and Masterwork, and fuses runes to ranks 3 and 4. The Market Hall sells partners' goods, so rare materials have a gold price.

**Status:** done (see [Implementation notes](#implementation-notes)); the "Done when" clause on the expected kit is unmet, accepted by the user until stage 12.

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

## Implementation notes

Built as eleven steps (`docs/implementation-plans/long-campaign-stage-10/`; every figure below is in its `log.md`, seed 1, one run at a time through `yomi-measure`).

**Commits by step.** 01 the baseline `40ef314`; 02 tiers 3 to 5 and bandit gear `31e4612`; 03 the workshop `68bf135`; 04 partners' goods `6e62d7d`; 05 workshop sprites `7f9610a`, `8aa5deb`, `169a9ff` (merged `dd96b2c`); 06 the debug `level` command `beebb44` (merged `32b401d`); 07 a faster estimate `2cdd885` (fixture and timing script, before any change), `d81c555`, `96afb16`; 08 the scenes `d63b426`, `ed99a2f` (merged `9c0f04c`); 09 the simulator's gear policy `400c9db` (the kit record), `7e14b45`, `82a7969`; 10 measure and judge `6c81ab7`, `ddbb69c`, `6730d44`; 11 this step.

**Where the plan departed from the design, and why** (the plan index's decisions, by number; those marked for the user were answered 2026-11-23, all as the plan's default unless said):
1. Cloth gets tiers 3 to 5, forged from the tier's ore: Mithrilweave, Adamantweave, Starweave (decision 1, the default). 3. Mithril and Starmetal also halve their families' spell-skill penalties, toward 0 (the default). 8. Trophies are data and a path with no entries: `TROPHIES` is empty and granting is tested with an injected table; Elder Glade sells wyvern hide as the stand-in, and basilisk and drake scale have no source in play until stage 11 (debug `stock` only), so hide tiers 4 and 5 cannot be forged in play this stage (the default). 9. Partners' goods: each contacted, not silent partner sells its good at 3 gold a unit from the Market Hall, bought in any whole amount; the simulator never buys (the default). 10. Bandit gear by ring: Mithril Fine at threats 9 to 11, Adamant Fine 12 to 17, Starmetal Masterwork from 18 (the default). 12. The gear policy applies families by role only from tier 3, so the early figure does not move (the user's answer, not the plan's default). 21. The long campaign's kit lag is accepted until stage 12 (below).
- Not asked: 2 hide materials' ids hold no underscore (`wyvern`, `basilisk`, `drake`); 4 a tier's piercing is real from tier 4 (`armorPierce` +1 on a weapon, which tells only in a melee weapon or the crossbow); 5 `forge` and `temper` take the party; 6 tempering goes straight to the grade at level 3 or more, `highestGrade` clamped to 3; 7 a forged item's worth is 1.5 times its forge and temper gold, sold for half; 11 workshop sprites for levels 4 to 6 (step 05); 13 the policy's details (the hammer when the lead foe resists 4 or more, the crossbow from tier 3, the body-armour rule, fusing any rank the workshop allows, no same-tier family switch); 14 the guard was not re-recorded (play did not move); 15 the estimate made faster only in byte-identical ways; 16 `level <n> [member|all] [auto]` in the debug console; 17 stock text by `materialName`; 18 the world map header's stock at 840 x 560 with every material held shows three lines ending "+4 more", clear of the party column: left as it is.
- `SAVE_VERSION` 31, no migration; `LOG_SCHEMA_VERSION` unchanged.

**The early figures** (`--ready-level 7 --near-source`, seed 1, 500 campaigns; step 10, code `82a7969`):

| Run | Step 01 | Final | Band | Days |
| --- | --- | --- | --- | --- |
| `one` (`--parties 1`) | 288 | **288** (1.2 heroes dead, 18.8 battles) | 215-250 | **331** (band 243-297) |
| `company` | 289 | **289** | 220-260 | 334 |
| `rl10` | 409 | **409** (34.0 battles) | 370-420, in | 533 (530) |

Identical to stage 9's accepted figures in wins: nothing stage 10 adds reaches the early campaign (the gear policy starts at tier 3; the far bandits, the workshop above level 3 and the partners' goods lie beyond it). The 50-campaign check hash `57fdea15...6e53e75` is the same at every step that ran it. The standard cells equal their "Now" figures; `one`, `company` and `one`'s days stay out of band, accepted until stage 12.

**The long run** (100 campaigns, `--log none`, ready level 18; step 10, 4:07 alone, against step 01's baseline, which is stage 9's):

| | Step 01 | Step 02 (bandits only) | Step 10 |
| --- | --- | --- | --- |
| Source beaten / fell | 15 / 85 | 2 / 96 | **1** / 97 (2 out of days) |
| Days, battles | 1272, 46.4 | 1390, 41.7 | 1414, 42.3 |
| Battles to level 5, 10, 15 | 6.8, 28.5, 54.3 (84, 55, 44 campaigns) | 6.8, 28.3, 53.6 (84, 53, 18) | 6.8, 28.4, 55.9 (84, 53, 16) |
| Win rate at threat 9, 12, 15 | 0.828, 0.601, 0.868 | 0.712, 0.395, 0.391 | 0.785, 0.367, 0.295 |

Gold a campaign on forging and tempering 2271 (451 on gear, 381 on runes); workshop at the end 2.3, trading post 3.3; 8.3 parties wiped, 40.7 recruits. The Source share fell from 15 to 1 because the far bandits now wear tiers 3 to 5 (step 02: 15 to 2) while the simulated party seldom forges. No site yield or forge cost was retuned.

**The kit against `expectedKit`** (main-hand tier, runes worn; campaigns that reached the mark):

| Mark | Fighter / archer / mage | Expected tier (floor) | Verdict |
| --- | --- | --- | --- |
| 5 (84) | 1.0 / 1.0 / 1.0, 0 runes | 2 (1) | within a tier |
| 10 (53) | 1.0 / 1.0 / 1.0, 0 runes | 3 (2) | lags by 2 |
| 15 (16) | 1.5 / 1.5 / 1.3, 0.3 / 0.3 / 0.4 runes | 4 (3) | lags by 2.5 to 2.7 |
| 20 (0) | none reached | 5 | not reached |

Over only the forge-ready campaigns (the workshop at 4 or more at the mark): none at 5 or 10 (0 of 84, 0 of 53); at 15 fighter 1.9 / 0.6 runes, archer 1.9 / 0.6, mage 1.7 / 1.0 (8 of 16), against tier 4 and 3 to 4 runes.

**The design's "Done when" kit clause is unmet.** The gear policy does not track the expected kit within a tier at levels 10 and 15. The user accepted this until stage 12 (index decision 21), because the cause is the simulator's targeting and spend order, not the economy's constants. A trace of every home visit in 100 long campaigns (temporary, reverted) found: the workshop sits at level 1 in 52 of 100 campaigns for want of stone (Old Quarry is held in 51, from about day 682, mostly blighted, and the trading post takes its 15 stone first); level 4, which forges, comes in 37 campaigns around day 1176, after the vanguards that reach level 10 (about day 848) got there, and those vanguards hardly come home between levels 9 and 16; and 739 of 742 forging visits arm parties whose lowest member is at level 4 to 6, which then meet threat 12 bandit companies (win rate 0.367) and wipe, so the forging gold re-arms recruits. Site yields and forge costs act only after the workshop reaches 4, so no trial of them could move the kit at 10. **Stage 12's first candidates**, to be measured: (a) send no party whose lowest level is more than a few under the target's threat; (b) forge and temper only for the vanguard, or only from level 9; (c) raise the workshop before the trading post; (d) a workshop level 2 without stone, or Old Quarry's yield 2 to 4 (a rule change that moves the early game: measure `one` first).

**The far bandit cells** (report only, 500 battles, a party in the starting iron kit at the nest's level): `bco9` 2 (stage 9: 1), `bco12` 0, `fh15` 0, `fh18` 0, `sg20-18` 28, `sg20` 71. `fh15` is 0 because the cell's party wears iron; the play script below fights the same nest in Fine adamant and wins about half.

**The estimate** (step 07): `legalActions`, `areaTouches` and the pathfinder were 80% of an estimate; kept, all byte-identical (the estimate fixture, the policy snapshot, the refactor guard and the 50-campaign hash all unchanged), about 6 times faster at level 15 (`scripts/forecastCost.ts`: 3038 to 459 ms of CPU at one load). In the browser the estimate took 367 to 466 frames before and 50 to 98 after. See the play script for its wall time in the real dev build.

**Known issue, accepted by the user (stage 10 decision):** the Auto-resolve estimate's "Auto (…)" wait of 2.6 to 4.7 s at level 15 in the dev build (the play script, below) stays as it is for now.

**The header stock** (decision 18): left as it is. **Docs** brought up to date over steps 02 to 11; the manual's screenshots retaken, with the Forge tab and the Market Hall's Goods added.

**The play script** (design §6), walked in the real game: the dev server (`npm run dev`), headless Chromium driven by a throwaway script kept outside the repository, and one headed Chromium window for the timing; the debug console for setup. Machine load average 5 to 7 on 10 cores (other sessions running) for parts 3's timings; 1.4 to 3.5 at the start.
1. `facility workshop 6`, `stock gold 500 mithril 30 adamant 30 starmetal 20`. The Forge tab (Weapons slot) offered "longsword:mithril, 30 gold, 8 mithril", the adamant at 50 gold, 10 adamant and the starmetal at 80 gold, 12 starmetal; the greatsword and halberd double (16, 20, 24). One longsword of each tier was forged into the baggage (stock after: 22 mithril, 20 adamant, 8 starmetal); sockets on the Runes tab: mithril 1, adamant 2, starmetal 2. The fighter's preview read "Iron Longsword to Mithril Longsword: damage 1d8+3 to 1d8+7". The Mithril Longsword tempered to Masterwork ("Gains a socket: 2 in all", 90 gold and 12 mithril) and its two sockets filled with a Lesser Ember and a Lesser Storm rune (5 gold each), then wielded through the character screen: the fighter's sheet went from damage 1d8+7 to 1d8+13 and to hit 65% to 78%, with "+1 fire" on a hit (the design guessed 1d8+6 to 1d8+12; the iron fighter is 1d8+7 here).
2. Fusing: `give ember1 3`, `ember2 6`, `ember3 5` and fuse at a level 6 workshop: rank 1 to 2 for 20 gold, 2 to 3 for 30, 3 to 4 for 40 (a Grand Ember Rune). At workshop 3 both rank 2 to 3 and 3 to 4 were greyed with "Fusing to a Greater Ember Rune needs a level 4 workshop." and "... a Grand Ember Rune needs a level 5 workshop."; at 4, 2 to 3 fused and 3 to 4 was still refused for level 5.
3. `level 15 all auto`, `heal all`, `fight freebooter_host 15` (Captain 119 hp, Brute 121, Crossbowman 74, Hedge-Mage 73; Aldric 119, Brenna 74, Delwyn 73), each fight auto-resolved with the battle's Auto button, not fought by hand, each from a fresh load of the same save (a defeat ends the game). The kit was forged and equipped honestly: at a level 6 workshop each hero's adamant or wyrmwood kit forged on the Forge tab and tempered to Fine (fighter: adamant longsword, wyrmwood shield, adamant breastplate, AC 49; archer: wyrmwood bow, adamant breastplate, AC 33; mage: wyrmwood staff, Adamantweave robe, AC 12), then worn through the Inventory panel (the debug console cannot equip).
   - **Fine adamant kit, five fights:** estimates 60%, 50%, 70%, 55%, 60% (wins of 40 samples 24, 20, 27, 21, 23); outcomes won in 12 rounds (Aldric 53 hp, Brenna 40, Delwyn 73 left), **lost** in 16 (all three heroes fell; the Captain had 1 hp), won in 12, won in 14, **lost** in 9 (all heroes fell, foes at 96, 57, 20, 32 hp). Three wins of five, the foes beaten at a cost of 74 to 100 hp: a fair fight.
   - **Iron (the ready-made kit), five fights:** estimate under 5% every time (0 wins of 40); all five lost in 6 to 8 rounds, the foes left at 13 to 119 hp each (one foe, the Hedge-Mage or the Crossbowman, fell in four of the five): a rout of the party. It matches the `fh15` cell (0 of 500 in the same kit).
   - **The estimate's wait**, "Auto (...)" to the figure, timed in the page from the first frame the battle takes control: headless Chromium, 3 to 5 fights each, game frames about 15 a second during the work: iron 2.8 to 3.2 s (42 to 45 frames), Fine adamant 4.1 to 4.7 s (61 to 66 frames). Headed Chromium (rAF 61 a second idle, still 60 in the battle once the estimate is done): iron 2.6 s (44 frames), adamant 4.0 and 3.7 s (60 to 63 frames). Machine load average 5.2 to 7.2 on 10 cores. So the placeholder shows for 2.6 to 4.7 s here, not the "about 1 s" step 07 inferred from frame counts at 60 frames a second: the frame counts agree (42 to 66, within step 07's 50 to 98) but a frame costs about 60 ms while the estimate works, not 17.
4. `contact stonehollow`, `facility trading_post 5`, `stock gold 100`: the Goods filter showed one row, "Mithril, from Stonehollow: 3 gold a unit"; Buy 1 took the gold from 100 to 97 ("Bought 1 mithril for 3 gold."), Buy 5 to 82 ("Bought 5 mithril for 15 gold."), the stock holding 6 mithril. With 2 gold left, Buy 1 said "It costs 3 gold, more than the stock holds." At trading post level 4 the Goods button is not drawn (the slot filters and Runes are), so the level refusal ("A level 5 trading post sells partners' goods.") is reached only through the domain, as its test does.

