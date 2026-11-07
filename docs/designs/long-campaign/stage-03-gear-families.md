# Stage 3: Gear families and the first two tiers

Part of [the long campaign](index.md). Reference: [`reference/gear-and-runes.md`](reference/gear-and-runes.md) §4.1, §4.2, §4.3 (buying), §5.1, §5.5 and §5.3 (stat derivation only).

## 1. Purpose and status

Many more kinds of weapon and armour, each a trade-off, now come in two material tiers: iron (today's items) and steel. The empty head, hands and feet slots get plain items. Heavy gear asks for strength and costs action points or spell skill. The trading post gains a level that sells steel, and a filter so its longer list stays usable.

**Status:** done; see the [implementation notes](#implementation-notes).

## 2. Scope

**In:**
- **The catalog.** `src/inventory/catalog.ts`: `MATERIALS` (all three kinds' tier 1 and 2 rows only), `FAMILIES` (gear §4.1, every family), `TIER_BONUS` for tiers 1 and 2.
- **Ids.** `<material>_<family>`, with the legacy aliases (gear §5.1). The id grammar gains the material, while grades and modifiers work as now. The rune part of the grammar waits for stage 4.
- **`ItemStats`** gains `strength`, `apPenalty`, `reach`, `rangedPierce` and `maxHp` (gear §5.1). `describeItemStats` covers them.
- **`deriveCombatStats`:**
  - a strength shortfall costs 5 to hit a point;
  - `apPenalty` comes off action points;
  - spell-skill penalties apply;
  - reach weapons count as melee for strength, piercing and skill;
  - crossbow piercing counts.

  `weaponSkill` follows the same rule.
- **The engine.** A melee reach of 2 is an ordinary attack range. Zones of control and opportunity attacks stay at 1 hex.
- **Grades** extend to every family, and to the small slots as AC +1 / +2. Modifiers' `fits` change to family ids. The new families get a modifier each, where one makes sense (spear: Balanced; mace: Bearded; crossbow: Long; leather: Reinforced). This is a short table in the stage's plan.
- **The trading post:**
  - level 4: 120 gold, 20 silver;
  - it sells tier 2 at grades the level allows: tier 1 at grade 3 from level 3, tier 2 at grades 1 to 3 at level 4;
  - per-family prices with the ×2.5 tier multiplier;
  - the slot and family filter.

  Market income at levels 4 to 6 waits for stage 7.
- **Icons.** One new icon per new family, and `MATERIAL_TINTS` for steel.
- **gearCompare and the inventory tooltip** show strength, shortfall, AP penalty, reach and spell-skill penalty.
- **Bandits.** Stage 1's roles may now use the crossbow (a Crossbowman role) and steel at threat 5.
- **The simulator.** `PREFERRED_MODIFIERS` is keyed by family. `visitFacilities` buys tier 2 when the post allows. The ready-made party's families are unchanged.

**Out:**
- tiers 3 to 5, forging and trophies (stage 10);
- sockets and runes (stage 4);
- wards and on-hit stats (stage 4).

## 3. Requirements

| ID | Requirement | Reference |
| --- | --- | --- |
| S3-R1 | Every family exists in tiers 1 and 2. Tier 1 of a legacy family equals today's item exactly, and legacy ids load. | gear R1, R2, A1, A2 |
| S3-R2 | Strength, AP and spell-skill penalties; reach; crossbow piercing. | gear R3, §5.3 |
| S3-R3 | Grades and modifiers carry over to every family. | gear R4 |
| S3-R4 | Trading post level 4 sells tier 2; the wares filter. | gear R5 |
| S3-R5 | Icons, tints and tooltips for all of it. | gear R13 (part) |

## 4. What the player sees

- **The trading post's Buy tab** has slot and family filters. At level 3 it lists maces, rapiers, spears, war hammers, halberds, longbows, crossbows and staves, plus robes, leather, plate, helms, caps, gloves, gauntlets, boots and greaves, in iron or the tier-1 wood or hide, at the grades allowed. At level 4, steel versions appear.
- **Heavy gear asks for strength.** A mage in plate sees "Strength 6 (you have 3): to hit −15%", "AP −1" and "Spell skill −15" in the comparison.
- **The spear** lets a hero strike from the second hex, behind an ally.

## 5. Technical notes

- `BASE_ITEMS` is generated from `FAMILIES` × `MATERIALS` of the family's kind, limited to tiers 1 and 2.
- `itemById` caches as now. The tradingPost `wares` takes a filter.
- **Versions:** `SAVE_VERSION` is bumped. Ids are a superset, but the bump flags the catalog change; legacy ids still load.

## 6. Verification

**Tests:**
- `catalog.test.ts`:
  - every family and tier builds;
  - legacy equality;
  - id round-trips;
  - malformed ids.
- `character.test.ts`:
  - strength shortfall;
  - AP penalty;
  - spell-skill penalty;
  - reach as melee;
  - crossbow piercing.
- `battleEngine.test.ts`: a reach-2 melee attack, and no zone of control at 2.
- `tradingPost.test.ts`: level 4; tier-2 wares; prices; the filter.
- `grades.test.ts` and modifier tests on new families.
- Scene tests:
  - the filter;
  - the new tooltip lines;
  - gearCompare's new rows.

**Simulator:**
1. The early-game guard. Expect small movement, from tier 2 bought at level 4 if the party affords it.
2. `--player-weapon steel_war_hammer --encounter troll_lair --threat 5 --party-level 5` against the iron longsword: the hammer should win more against the armoured troll.
3. `--player-weapon iron_spear` on Goblin Raid at threat 3, against the longsword: comparable.

**Play script:**
1. Run `facility trading_post 4` and `stock gold 500`, then open the trading post. Filter to weapons, then to the war hammer. Buy a steel war hammer and a steel helm.
2. Equip the hammer on the mage. See the strength shortfall in the comparison and the lower hit chance in battle.
3. Give the fighter a spear and attack from the second rank in `fight goblin_raid 3`.
4. Equip plate on the fighter. See 7 AP, not 8, and one attack fewer with a 4-AP weapon.

## 7. Risks

- **The trading post list is long.** The filter must default to the slot of the hero selected, or to weapons.
- **Reach weapons in the second rank may be strong.** Watch spear and halberd win rates in the simulator.

**Done when:** all tests pass, the guard holds, the matchups in check 2 favour the right weapons, and the play script has been walked.

## Implementation notes

Built from the plan in [`docs/implementation-plans/long-campaign-stage-03/`](../../implementation-plans/long-campaign-stage-03/index.md), on branch `long-campaign-stage-03` (off `armor-resistance`).

**Commits:**
- Step 01, the baseline: `864d9f0`.
- Step 02, icons and the trading post's level 4: `d6212f2`.
- Step 03, gear sprites: `2814cc1`, `cab3a4d`.
- Step 04, the catalog and ids: `1945673`.
- Step 05, weight and reach: `6514b5c`; the breastplate's strength 3, `7ed89c6`.
- Step 06, the trading post's level 4 and the simulator: `2ea4b87`.
- Step 07, the screens: `0ddaa77`, `ccebdb1`.
- Step 08, the Crossbowman's sprite: `a3b34ba`.
- Step 09, bandits in crossbows and steel: `0dc549b`.
- Step 10, measure, tune and document: the commits titled "Stage 3 step 10".

**Departures from this design** (the plan's corrections and the user's answers, in brief):
1. Two legacy ids collided with tier 2: the tier-1 greatsword and breastplate are `iron_greatsword` and `iron_breastplate` (Iron Greatsword, Iron Breastplate), `steel_greatsword` is tier 2, and `steel_armor` is an alias of `iron_breastplate`.
2. Tier-1 wood is `yew`, with the shield (`oak_shield`) and staff (`ash_staff`) named by their family's `tier1`. A fourth material kind, cloth (Linen, Silk), carries the robe. The leather body armour is `leather_armor` and `wolfhide_leather`.
3. `TIER_BONUS` and grades are by gear class (weapon, shield, body armour, small slot); the small slots' grades add armour class +1 / +2.
4. No item changes maximum hit points yet (`maxHp` waits for stage 4). `WEAPONS` stays the six a new hero carries; `BASE_ITEMS` is every family in both tiers (56).
5. A reach weapon is melee in the engine (`CombatantStats.reach`, `isMelee`, `AttackEvent.melee`); its zone of control is still its neighbouring hexes.
6. The strength shortfall is counted per item and against weapon attacks only; the crossbow's own piercing counts at range, the strength perks' does not.
7. The trading post's levels 1 to 3 sell tier 1 at grades up to the level and level 4 (120 gold, 20 silver) adds tier 2 at every grade; its filter opens on weapons; the shortfall shows only where a wearer is known.
8. The new families' prices are first values; tier 2 is ×2.5.
9. The Wand of Sparks is a plain item (the wand family's tier 1).
10. The simulator buys the dearest item of each worn family the post sells and the gold affords; check 3 is run at party level 3.
11. **Q1 (b):** the breastplate, battle axe and greatsword take the reference's weight; after step 05 the user lowered the breastplate's strength from 4 to 3 (the guard was 175 with 4), keeping its spell skill −5.
12. **Q2 (a), amended at step 10:** the Bandit Crossbowman takes the field from threat 6, after the Hedge-Mage and before the Brute; bandit gear is tier 2 (steel and ironwood, Fine) from threat 6, not 5, the user's choice after steel at threat 5 took the threat-5 camp cell from 469 to 256 of 500. Threat 5 keeps Fine iron, as before the stage.

**The early-game guard** (`npm run simulate -- --campaign --ready-level 7 --battles 500 --seed 1`):

| | Step 01 (baseline) | Step 04 | Step 05 | Step 05 follow-up (strength 3) | Step 06 | Step 09 | Step 10 (final) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Beat the Source | 248 | 231 | 175 | 231 | 233 | 233 | **233 (46.6%)** |
| Days, battles a campaign | 274, 18.7 | 269, 18.2 | 249, 17.1 | 269, 18.2 | | 272, 18.3 | 269, 18.2 |
| Heroes dead a campaign | 1.7 | 1.8 | 1.4 | 1.8 | | 1.8 | 1.8 |

The final run: the party fell in 267 campaigns, the encampment never; 26.0 spawns; won at threats 1 to 5: 1.000, 0.986, 0.968, 0.992, 0.896; trading post, workshop, infirmary 1.1, 0.6, 0.5 at the end; 2 gold on gear and 51 from sales a campaign; 0.0 tier-2 items bought.

The fall of 15 is accepted by the user (not retuned). Its whole cause is the iron breastplate's spell skill −5 on the ready-made mage: step 04's run with it removed matched step 01's line for line, as did step 05's with the breastplate's strength removed; the plain wand, reach, the crossbow and weight elsewhere move nothing, as no simulated hero holds them. The +2 at step 06 is the trading post's level 4 keeping 20 silver from sales (an isolating run gave 231). Bandit steel at threat 5 (step 09) left the guard at 233 and its removal here leaves it there. **No tuning:** the economy levers (§4.2 of the step) were not touched, as the move has no gear or economy cause; tier 2 is never bought because the post ends at level 1.1, long before 120 gold and 20 silver come spare, which the stage design expected to move the guard only a little if at all. Tier 2 is a player's purchase, and a sink for gold later stages bring.

**Check 2** (Troll Lair, threat 5, party level 5, `--player-weapon` in every hand): the Steel War Hammer wins 0 of 500 (7.09 rounds, 48.1 damage dealt, hit rate 0.222), the Iron Longsword 0 (7.09, 42.3, 0.201), the Steel Longsword control 0 (7.09, 46.6, 0.200). The hammer does more harm, but the cell is lost whatever the weapon (it was 0 at step 01 too), and the archer and mage swing the hammer 3 strength short (−15 to hit), as the check was written. The design's "the hammer wins more" is not met in wins; recorded for the user, not tuned.

**Check 3** (Goblin Raid, threat 3, party level 3): the Iron Spear wins 443 of 500 in 14.3 rounds, the Iron Longsword 486 in 12.0. The gap of 43 is beyond the "comparable" bar of about 25: the spear is weaker (1d8+1 to the longsword's 1d8+3), and the simulator's heroes do not seek the second rank. Recorded for the user.

**The reach cells** (design §7), wins of 500 and rounds:

| Weapon | Goblin Raid t3 / L3 | Bandit Camp t4 / L4 |
| --- | --- | --- |
| Iron Longsword | 486 (12.0) | 433 (13.1) |
| Iron Spear | 443 (14.3) | 283 (15.1) |
| Iron Halberd | 476 (11.3) | 349 (12.4) |
| Steel Longsword | 494 (10.7) | 466 (11.5) |
| Steel Spear | 472 (12.1) | 371 (13.3) |
| Steel Halberd | 486 (10.2) | 395 (10.8) |

No reach weapon wins more than the longsword of its tier, so §7's risk did not show in the simulator, whose policy never places a hero in the second rank on purpose. A player who does may find them stronger.

**The bandit cells** (Bandit Camp, party level = threat): threat 3 429 (444 at step 01, the breastplate's spell skill), 4 473 (473), 5 469 (470; 256 with steel at step 09), 6 2, 7 1. Threats 6 and 7 are off today's map (`MAX_THREAT` 5): four bandits in Fine steel there, the Crossbowman among them, are a first guess for stage 9, which brings those rings, to tune.

**The play script**, walked in headless Chromium with a scratch script on the in-browser test driver (not committed), with screenshots looked at:
1. With the post at level 4 and 500 gold, the Buy tab opened on weapons; the War Hammer family showed iron and steel at three grades (18, 54, 144; 45, 135, 360: ×2.5 for steel); the Steel War Hammer (45) and, under Head and Helm, the Steel Helm (15) were bought into the baggage. The steel icons' tint is pale and hard to tell from iron at the list's size.
2. Delwyn (the mage, strength 3) took the hammer from the baggage and equipped it; its tooltip read "Strength: 6 (you have 3): to hit −15%", and the panel's To Hit −11%. In `fight goblin_raid 1` the mage's stats carried the hammer and that to-hit; the nameplate's percentage was not seen, as the mage stood out of reach.
3. Aldric took an Iron Spear (`give iron_spear`); in `fight goblin_raid 3` he stepped to a hex beside Brenna, two from a kobold she stood next to, and struck over her: the attack event had `melee: true`, at distance 2, hit for 12. A goblin's free attack on Aldric stepping away was seen; Aldric making one at 1 hex, and the blow playing as a swing rather than an arrow, were not seen (a still screenshot cannot show the animation).
4. In a new game, Aldric in Iron Plate with the Iron Shortsword had 7 AP in battle (`actionPoints` 7), so one 4-AP attack standing still, not two.

Left for the user to walk: the spear's swing animation, a spearman's free attack at 1 hex and none at 2, and the mage's lower hit chance on the nameplate's preview.

