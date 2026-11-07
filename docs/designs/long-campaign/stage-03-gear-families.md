# Stage 3: Gear families and the first two tiers

Part of [the long campaign](index.md). Reference: [`reference/gear-and-runes.md`](reference/gear-and-runes.md) §4.1, §4.2, §4.3 (buying), §5.1, §5.5 and §5.3 (stat derivation only).

## 1. Purpose and status

Many more kinds of weapon and armour, each a trade-off, now come in two material tiers: iron (today's items) and steel. The empty head, hands and feet slots get plain items. Heavy gear asks for strength and costs action points or spell skill. The trading post gains a level that sells steel, and a filter so its longer list stays usable.

**Status:** ready for planning.

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
