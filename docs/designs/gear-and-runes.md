# Gear for the long campaign: materials, families, forging and runes

## 1. Purpose and status

Heroes barely get stronger through their gear. There are eight plain items: five melee weapons, a bow, a shield and a breastplate. They come in three grades, can carry one modifier, and a few unique items are found as loot. A ready-made fighter swings 1d8+6 at level 1 and 1d8+9 at level 20. Their armour class and resistance hardly move.

[`campaign-to-level-20.md`](campaign-to-level-20.md) §6.4 names this the main risk of a campaign to level 20. Battles at level 18 feel like battles at level 5, and well-armoured foes wall off the party.

This design gives gear its own path from level 1 to 20, in four parts:

1. **Materials.** Every base item comes in five material tiers (iron to adamant for metal, with ladders for wood and hide), each tier for a stretch of the campaign.
2. **Families.** Many more kinds of weapon and armour, each with a different trade-off:
   - weapons: maces, war hammers, spears, halberds, rapiers, crossbows, longbows and staves;
   - armour: robes, leather, plate, helms, gauntlets and boots;
   - shields: bucklers and tower shields.
3. **Forging.** The workshop forges the higher tiers from rare ores and from trophies taken off slain monsters. The trading post only sells the first two tiers.
4. **Runes.** Gear gets sockets. Runes are looted from nests or bought, then embedded at the workshop. They can also be fused into higher ranks, or taken out for a fee. A rune does one thing in a weapon and another in armour.

   Runes bring in elements: fire, frost, lightning, acid, poison and blight. They add elemental damage to weapon hits and wards against breath and spells.

**Status: ready for planning, with assumptions.** Nothing blocks the first step. Section 8 lists the decisions taken on the user's behalf, each with its default. Two of them change the game's rules beyond gear and are worth a look before step 3:
- elements and wards (8.1);
- extracting runes (8.3).

The numbers are first values; the retune moves them (R15).

It builds on two designs:
- [`expeditions-and-encampment.md`](expeditions-and-encampment.md): grades, modifiers, the trading post and the workshop. This design keeps all four and extends them.
- [`campaign-to-level-20.md`](campaign-to-level-20.md): rings, the foe yardstick, special attacks and the long-campaign simulator. Where the two overlap, this design changes that one's yardstick (R14).

Where any of these documents and the code differ, the code is right.

## 2. Requirements and scope

### Functional requirements

| ID | Requirement |
| --- | --- |
| R1 | **Materials.** Every base item is a **family** in a **material** of a tier from 1 to 5. A tier adds to the family's stats by a table of its kind (metal, wood or hide). Tier never changes attack AP, range or two-handedness. |
| R2 | **Families.** The weapon, shield and armour families of §4.1 exist, each a trade-off, not a strict upgrade. The head, hands and feet slots, which exist but have no plain items today, get armour families. |
| R3 | **Weight.** Heavy families ask a **strength** the wearer may lack. Each point short costs 5 to hit. Plate and tower shields cost 1 action point. Heavy armour lowers spell skill. |
| R4 | **Grades and modifiers carry over.** Fine and Masterwork apply to every family in every material. Modifiers extend to the new families. A tier, a grade, a modifier and runes may all sit on one item. |
| R5 | **The trading post** sells tiers 1 and 2 in every family, up to the grade its level allows. A filter by slot and family keeps the list usable. |
| R6 | **Forging.** The workshop's new levels 4 to 6 forge tiers 3, 4 and 5 from gold, an ore or wood of that tier, and for hide a **trophy**. Forging makes a plain item of that tier, which can then be graded at the workshop. |
| R7 | **New materials.** Ores and woods for the higher tiers come from new resource sites in the outer rings. Trophies come from beating certain monster kinds. All of them sit in the stock as materials do. |
| R8 | **Sockets.** An item has 0 to 3 sockets, set by its tier and grade. A unique (enchanted) item has the sockets its catalog entry names. |
| R9 | **Runes.** A rune is a **kind** (§4.4) at a **rank** from 1 to 4. It has one effect in a weapon and another in armour or a shield, growing with rank. Runes sit in the party's **rune pouch**, not in backpacks. |
| R10 | **Getting runes.** Runes are found as loot after a won battle, more and of higher rank in further rings. The trading post sells rank 1 and 2 runes of some kinds. Fusing turns three of one kind and rank into one of the next rank. |
| R11 | **Runecraft** at the workshop: embed a rune from the pouch into an empty socket, fuse runes, and extract a rune back to the pouch for a fee. None of it takes time. Embedding rank 1 runes also works in the field and takes a day. |
| R12 | **Elements and wards.** Spells, area attacks and status ticks may carry an **element**. A combatant may have **wards**, which are points taken off damage of that element, as resistance is for weapons. Weapon runes add elemental **bonus damage** to hits. Bonus damage ignores resistance but is warded. |
| R13 | The **inventory, crafting and trading screens** show sockets, runes, the pouch, forging and fusing. An item's tooltip lists its tier, grade, modifier and runes. |
| R14 | **The yardstick follows the gear.** A table of expected kit at each level (§5.8) sets the hero side of the foe yardstick in [`campaign-to-level-20.md`](campaign-to-level-20.md) §5.2. The simulator's careful party buys, forges, grades and runes its gear by a stated policy, and takes rune and trophy loot. |
| R15 | **Retune.** The long campaign is retuned with gear in play. The early game, at `--ready-level 7`, stays near its figure. |

### Quality constraints

- Items stay plain data, identified by an id that rebuilds them (`itemById`). Saves keep storing ids.
- Every derived number comes from tables (`MATERIALS`, `FAMILIES`, `RUNES`), so the catalog grows without new code paths.
- The battle engine knows only `CombatantStats`. Gear folds into stats in `deriveCombatStats`, as now.
- The early game's gear (tier 1 and the eight items of today) plays as now. Old item ids still load.

### Non-goals

- **Random affixes on loot** (Diablo-style rolls). Loot stays catalog items and runes.
- **Item durability, weight limits or encumbrance** beyond R3's strength rule.
- **Gear on foes.** Monsters do not use the item model. Bandits ([`campaign-to-level-20.md`](campaign-to-level-20.md) R6) do, through `deriveCombatStats`, and so get tiers and runes by ring for free.
- **Changing hero sprites for gear.** Item icons get tier tints. Unit sprites stay as they are.
- **New weapon skills.** All melee families use Melee, bows and crossbows Archery, and wands and staves Magic.
- **Runewords**, where a named set of runes in one item gives a bonus. These are deferred to §8.6, and the data leaves room for them.

### Acceptance criteria

| ID | Criterion | Requirements |
| --- | --- | --- |
| A1 | `itemById` builds every family × material × grade × modifier × runes id, round-trips it through `id`, and still resolves the eight legacy ids to the same stats as today. | R1, R2, R4, R8 |
| A2 | A tier-1 item of a legacy family has today's stats exactly. | R1, R15 |
| A3 | A wearer short of strength loses 5 to hit a point. Plate costs 1 AP. Heavy armour lowers spell skill by the family's amount. | R3 |
| A4 | Forging is refused without the workshop level, the stock or the tier's material. When it succeeds it spends exactly the cost and puts the item in the baggage. | R6, R7 |
| A5 | Embedding, fusing and extracting move runes between pouch and sockets exactly as specified, and each refusal is tested. | R9–R11 |
| A6 | A weapon's rune bonus damage is rolled on a hit, ignores resistance and is reduced by the target's ward of its element. The log shows it. | R12 |
| A7 | An Ember rank 3 weapon lays Seared, so it stops a troll's regeneration. | R9, R12 |
| A8 | A Rime-warded hero takes less from a frost area attack, by the ward per unit. | R12 |
| A9 | Scene tests cover sockets in the tooltip, the pouch, the embed, fuse and extract flows, forging, and the trading-post filter. | R13 |
| A10 | `make simulate ARGS="--campaign --ready-level 7 ..."` stays near the early-game figure. A long campaign's record shows its gear at each level near the §5.8 table. | R14, R15 |

## 3. Current system (inspected)

- **Items.** In [`src/inventory/inventory.ts`](../../src/inventory/inventory.ts):
  - An `Item` has an `id`, `slot`, `stats: ItemStats`, an `icon`, and optional `base`, `grade` and `mod`.
  - `ItemStats` covers damage, attack AP, range, piercing, two-handed, armour class, resistance, to hit, skill, mana, spell skill and critical chance.
  - The eight plain items are `BASE_ITEMS`; the unique items are `MAGIC_ITEMS`.
  - `itemById` parses `<base>[@<grade>][+<modifier><grade>]` (`ID_GRAMMAR`) and caches what it builds.
  - The slots head, neck, cloak, gloves, belt, boots and rings exist, but only unique items fill them.
- **Grades.** In [`src/inventory/grades.ts`](../../src/inventory/grades.ts), grade 1 is plain, 2 is Fine and 3 is Masterwork.
  - Weapons get damage +1 / +2, and +5 to hit at Masterwork.
  - Shields get armour class +3 / +6.
  - Armour gets resistance +1 / +2.
- **Modifiers.** In [`src/inventory/modifiers.ts`](../../src/inventory/modifiers.ts), there are eight, each fitting listed base ids. An item holds one modifier.
- **Crafting.** In [`src/game/crafting.ts`](../../src/game/crafting.ts):
  - Crafting in the field makes field modifiers at grade 1 and takes a day.
  - The workshop (levels 1 to 3) unlocks modifiers and higher grades.
  - `craftCost` is gold plus iron or timber at grade 1, copper at grade 2 and crystal at grade 3.
- **The trading post.** In [`src/game/tradingPost.ts`](../../src/game/tradingPost.ts), levels 1 to 3 sell grades 1 to 3. `PRICES` gives each base's price, and `GRADE_PRICE` multiplies it by 1, 3 or 8. Items sell for half. Materials sell at 1 gold for 2.
- **Materials.** In [`src/game/territory.ts`](../../src/game/territory.ts), the `Material` type is gold, iron, timber, silver, stone, salt, copper, crystal and peat. Each resource site yields one material.
- **Stats.** In [`src/character/character.ts`](../../src/character/character.ts), `deriveCombatStats` sums worn stats.
  - Strength adds `floor((str − 5) / 2)` to melee damage.
  - Piercing counts only for melee: "ranged" is decided by range greater than 1.
  - `weaponSkill` picks Archery for anything with range.
- **Loot.** Locations carry fixed `loot` items, and spawns sometimes carry a `MAGIC_ITEMS` entry (`takeLoot`). The simulator ignores loot.
- **Saves.** In [`src/game/save.ts`](../../src/game/save.ts), equipment, backpacks and baggage are stored as item ids.
- **The simulator's gear.** In [`scripts/simulate.ts`](../../scripts/simulate.ts), `visitFacilities` buys the best grade of each member's weapon, shield and armour (`GEAR_SLOTS`), then crafts by `PREFERRED_MODIFIERS`. The record notes that gold is too scarce after the hall and recruits to buy much.
- **Elements.** Elements do not exist. Spells and status ticks ignore resistance, and nothing reduces them except armour class against the spell's roll to hit.

## 4. Proposed behaviour

### 4.1 Families

Each family is listed at tier 1, plain. The `*` marks today's eight items, which keep their stats.

**Weapons**

| Family | Slot | Damage | AP | Range | Pierce | Other | Str |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Dagger* | main | 1d4 | 3 | 1 | 0 | | — |
| Shortsword* | main | 1d3+1 | 4 | 1 | 0 | | — |
| Rapier | main | 1d6 | 4 | 1 | 0 | critical +5 | — |
| Longsword* | main | 1d8+3 | 5 | 1 | 1 | | — |
| Mace | main | 1d6+3 | 5 | 1 | 2 | | 5 |
| Spear | main | 1d8+1 | 5 | 2 (reach) | 1 | | — |
| Battle axe* | main | 1d12+2 | 6 | 1 | 2 | | 5 |
| War hammer | main | 1d10+3 | 6 | 1 | 3 | to hit −5 | 6 |
| Greatsword* | main, 2H | 2d6+3 | 7 | 1 | 2 | | 6 |
| Halberd | main, 2H | 1d12+3 | 7 | 2 (reach) | 2 | | 6 |
| Bow* (yew) | main, 2H | 1d6 | 4 | 5 | 0 | | — |
| Longbow | main, 2H | 1d8 | 5 | 7 | 0 | | 5 |
| Crossbow | main, 2H | 1d10 | 6 | 5 | 2 | piercing counts though ranged | — |
| Wand (spark) | main | 1d6 | 5 | 4 | 0 | strikes with Magic | — |
| Staff | main, 2H | 1d6+1 | 5 | 1 | 0 | strikes with Magic; spell skill +5, mana +4 | — |

**Shields, armour and the small slots**

| Family | Slot | Armour class | Resistance | Other | Str |
| --- | --- | --- | --- | --- | --- |
| Buckler | off | 6 | 0 | | — |
| Shield* (oak) | off | 10 | 0 | | — |
| Tower shield | off | 16 | 1 | AP −1 | 6 |
| Robe | armour | 0 | 0 | mana +6, spell skill +5 | — |
| Leather | armour | 12 | 1 | | — |
| Breastplate* (steel) | armour | 10 | 2 | spell skill −5 | 4 |
| Plate | armour | 6 | 4 | AP −1, spell skill −15 | 6 |
| Cap | head | 3 | 0 | | — |
| Helm | head | 2 | 1 | spell skill −5 | 4 |
| Gloves | gloves | 0 | 0 | to hit +2 | — |
| Gauntlets | gloves | 0 | 1 | spell skill −5 | 4 |
| Boots | boots | 3 | 0 | | — |
| Greaves | boots | 0 | 1 | | 4 |

These are the choices each family offers:
- **The spear and the halberd** strike from two hexes away, so they reach over an ally or past a zone of control. They do not use Archery, and strength still adds to their damage.
- **The crossbow** is the archer's answer to armour. **The war hammer** and **the mace** are the melee answers.
- **Plate against leather** is resistance against armour class. Plate costs an action point, which matters against the 4-AP threshold for two attacks a turn.
- **Robes, staves and caps** are the caster's kit. The metal families lower spell skill.

### 4.2 Materials

| Tier | Metal | Wood (bows, staves, shields of oak) | Hide (leather, cap, gloves, boots) | Level band | Ring (threat) |
| --- | --- | --- | --- | --- | --- |
| 1 | Iron | Yew / Oak / Ash | Leather | 1–4 | 1–3 |
| 2 | Steel | Ironwood | Wolfhide | 5–8 | 4–7 |
| 3 | Mithril | Elderwood | Wyvern hide | 9–12 | 9 |
| 4 | Adamant | Wyrmwood | Basilisk scale | 13–16 | 12–15 |
| 5 | Starmetal | Heartwood | Drake scale | 17–20 | 18 |

**What a tier adds, over tier 1** (provisional):

| Tier | Weapons | Shields | Body armour | Small slots |
| --- | --- | --- | --- | --- |
| 2 | damage +2 | AC +2 | AC +2, resistance +1 | AC +1 |
| 3 | damage +4, to hit +5 | AC +4 | AC +4, resistance +1 | AC +1, resistance +1 when it has any |
| 4 | damage +6, to hit +5, pierce +1 | AC +6, resistance +1 | AC +6, resistance +2 | AC +2, resistance +1 when it has any |
| 5 | damage +8, to hit +10, pierce +1 | AC +8, resistance +1 | AC +8, resistance +3 | AC +3, resistance +2 when it has any |

- Mithril and Starmetal also lower the strength the family asks, by 1 and 2. Their metal families' spell-skill penalty is halved.
- Damage grows only through the flat bonus, so light weapons gain proportionally more from a tier, as they do from a grade. The bow and dagger keep their many small hits, and with the bonus those hits pass more resistance than they do today.
- **Names.** "Mithril Longsword", "Steel Breastplate", "Drake-scale Leather". Today's names are the tier-1 names: "Iron Longsword", "Yew Bow", "Oak Shield". So are today's ids (§5.1).

### 4.3 Getting gear

| How | What | Where |
| --- | --- | --- |
| Buy | every family in tiers 1 and 2, at grades the post allows | Trading post. Level 3 already sells Masterwork. New level 4 (120 gold, 20 silver) sells tier 2 at all grades. |
| Forge | tier 3, 4 or 5 plain item of any family | Workshop levels 4, 5 and 6 (below) |
| Grade | Fine or Masterwork of an owned tier 3+ item | Workshop at any level 3+. It costs the item's tier material and gold (§5.4). |
| Modify | as today, at the grades the workshop makes | Workshop or field |
| Loot | unique items, runes, trophies | won battles (§4.5) |

**Workshop levels** (levels 1 to 3 unchanged):

| Level | Cost | Unlocks |
| --- | --- | --- |
| 4 | 100 gold, 20 mithril | Forge tier 3. Fuse runes to rank 3. |
| 5 | 150 gold, 20 adamant | Forge tier 4. Fuse to rank 4. |
| 6 | 200 gold, 10 starmetal | Forge tier 5 |

**Forge costs.** A forge costs gold plus that tier's material:

| Tier | Gold | Material (metal, wood or hide) |
| --- | --- | --- |
| 3 | 30 | 8 |
| 4 | 50 | 10 |
| 5 | 80 | 12 |

- Two-handed families and plate double the material.
- For hide, the material is the trophy itself, so drake-scale gear asks for a slain dragon.

**New resource sites**, placed in the rings of [`campaign-to-level-20.md`](campaign-to-level-20.md) §4.1:
- **Ores:** a Mithril Lode (ring 9), an Adamant Deep (ring 12), a Fallen Star (ring 18).
- **Woods:** an Ironwood Grove (ring 7), an Elder Grove (ring 9), a Wyrmwood Thicket (ring 15), the Heartwood (ring 18).

Each yields its material as today's sites do. They give the party a reason to hold far land and not merely pass through it.

**Trophies** are stock materials gained after a win over certain kinds:

| Trophy | Monsters | Amount |
| --- | --- | --- |
| Wolfhide | wolves and worgs | 1 per foe |
| Wyvern hide | wyverns | 3 |
| Basilisk scale | basilisks | 3 |
| Drake scale | young dragons | 6 |
| Drake scale | elder wyrms | 10 |

### 4.4 Runes

Runes come in four ranks, named Lesser, plain, Greater and Grand: for example "Lesser Ember Rune" or "Grand Stone Rune".

| Rune | Element | In a weapon (rank 1 / 2 / 3 / 4) | In armour, head, hands or feet (1 / 2 / 3 / 4) | In a shield |
| --- | --- | --- | --- | --- |
| Ember | fire | +1 / 2 / 3 / 5 fire on a hit; rank 3+ lays Seared (stops regeneration) | fire ward 2 / 4 / 6 / 9 | fire ward as armour |
| Rime | frost | +1 / 2 / 3 / 5 frost; rank 3+ lays Chilled on a critical | frost ward 2 / 4 / 6 / 9 | as armour |
| Storm | lightning | to hit +3 / 6 / 9 / 12 | lightning ward 2 / 4 / 6 / 9 | as armour |
| Venom | poison | +1 / 2 / 3 / 4 poison; rank 2+ lays Poisoned on a critical | poison ward 2 / 4 / 6 / 9 | as armour |
| Acid | acid | pierce +1 / 1 / 2 / 3 | acid ward 2 / 4 / 6 / 9 | as armour |
| Stone | — | damage +1 / 1 / 2 / 3 | resistance +1 / 1 / 2 / 3 | armour class +3 / 5 / 7 / 10 |
| Wind | — | critical +3 / 6 / 9 / 12 | armour class +3 / 5 / 7 / 10 | armour class +2 / 4 / 6 / 8 |
| Life | — | heals the wielder 1 / 1 / 2 / 3 per hit | max HP +4 / 8 / 12 / 18 | max HP as armour |
| Mind | — | spell skill +3 / 6 / 9 / 12 (wands and staves only) | mana +3 / 6 / 9 / 12 | mana as armour |
| Dawn | blight | +2 / 3 / 5 / 7 blight-bane damage, against kinds with regeneration or the blight's own only | blight ward 2 / 4 / 6 / 9 | as armour |

**Sockets:**

| Tier | 1 | 2 | 3 | 4 | 5 |
| --- | --- | --- | --- | --- | --- |
| Sockets | 0 | 1 | 1 | 2 | 2 |

- A Masterwork grade adds 1, up to 3.
- Small-slot items have at most 1 socket.
- Unique items name their own count: the Emberblade has 1, for example.

A tier-1 Masterwork longsword therefore has one socket, so runes reach the early game through the trading post's top grade.

**Runecraft:**

| Action | Rule | Where | Cost |
| --- | --- | --- | --- |
| Embed | a rune from the pouch into an empty socket of an item worn, carried or in the baggage | workshop, any level; in the field for rank 1, taking a day | 5 gold × rank |
| Fuse | three runes of one kind and rank become one of the next rank | workshop; rank 2 needs level 1, rank 3 level 4, rank 4 level 5 | 10 gold × the new rank |
| Extract | a rune leaves its socket for the pouch, intact | workshop, level 2+ | 10 gold × rank |
| Overwrite | embedding into a full item is refused; extract first | — | — |

**Buying runes.** The trading post sells rank-1 runes from level 2, of Ember, Rime, Storm, Stone, Wind and Life, at 15 gold. From level 4 it sells rank 2 of those kinds at 45 gold. Venom, Acid, Mind and Dawn come only from loot and fusing.

### 4.5 Loot after a win

`takeLoot` keeps a location's fixed loot. A win also rolls runes, seeded from the battle's seed so it can be reproduced:

| Ring threat | Runes after a win | Ranks |
| --- | --- | --- |
| 1–3 | 0–1 (50%) | 1 |
| 4–7 | 1 | 1 (70%), 2 |
| 9–12 | 1–2 | 2 (60%), 3 |
| 15–18 | 2 | 2, 3 (60%), 4 (15%) |
| Source | 3 | 3, 4 |

The kind is drawn uniformly from the ten. A nest led by an elemental kind favours its element: a dragon's nest gives Ember at 50%. Trophies are added to the stock (§4.3). The victory screen lists runes and trophies with the experience.

### 4.6 Elements in battle

**Elements:** fire, frost, lightning, acid, poison and blight. Each existing hostile spell and status takes one:

| Spell or status | Element |
| --- | --- |
| Flame Arrow, Fireball | fire |
| Frost Blast | frost |
| Acid Arrow, Corroded's tick | acid |
| Death Cloud, Poisoned's tick | poison |
| Magic Arrow | none |

Monster abilities in [`campaign-to-level-20.md`](campaign-to-level-20.md) §5.4 name theirs: Fire Breath is fire, Lightning Bolt is lightning, and Blight Breath is blight.

**Wards.** A unit's ward against an element is subtracted from each instance of damage of that element: a spell's hit, an area's outcome (after half on a miss), a status tick, and a weapon rune's bonus. The floor is 0, not 1. A ward can fully stop a small tick, while a breath still lands most of its damage. Monster kinds can have wards: a fire drake has fire 10, and the golem has poison 99.

**Bonus damage.** A weapon's rune bonus is rolled only when the weapon hits. It is added after resistance and reduced by the target's ward, so a hit's total damage is:

```
damageThrough(rolled, effective resistance) + Σ max(0, bonus_e − ward_e)
```

A critical hit doubles the weapon's roll as today, but not the bonus. The log reads like this: "HITS Troll for 9 dmg (armour stops 1) +3 fire. Troll is seared."

## 5. Technical design

### 5.1 The item model and ids

**Tables.** *Proposed* in a new [`src/inventory/catalog.ts`](../../src/inventory/catalog.ts):

```ts
export type MaterialKind = 'metal' | 'wood' | 'hide'
export type Tier = 1 | 2 | 3 | 4 | 5
export interface MaterialDef { id: string; name: string; kind: MaterialKind; tier: Tier; strengthRelief?: number; casterFriendly?: true }
export interface FamilyDef {
  id: string                 // 'longsword', 'plate', …
  name: string               // 'Longsword'
  slot: EquipmentSlot
  kind: MaterialKind
  icon: ItemIcon
  stats: ItemStats           // at tier 1
  strength?: number          // the strength it asks (R3)
  /** A tier-1 name or id that differs from `<material>_<family>`: today's items. */
  tier1?: { id?: string; name?: string }
}
export const MATERIALS: readonly MaterialDef[]   // 15 rows: §4.2
export const FAMILIES: readonly FamilyDef[]      // §4.1
export const TIER_BONUS: Record<MaterialKind | 'shield' | 'small', Record<Tier, ItemStats>>
```

`ItemStats` gains several fields:
- `strength?: number`;
- `apPenalty?: number`;
- `reach?: true`, a melee weapon with range above 1;
- `rangedPierce?: true` (the crossbow);
- `wards?: Partial<Record<Element, number>>`;
- `onHit?: readonly OnHit[]`, where `OnHit = { element?: Element; bane?: 'regenerating'; damage: number; status?: StatusLaid; onCrit?: true; heal?: number }`;
- `maxHp?: number`.

`describeItemStats` covers each of them.

**Item.** `Item` gains three fields:
- `material?: string`, the material id;
- `sockets?: number`, the count;
- `runes?: readonly RuneKey[]`, embedded in socket order, with `RuneKey = \`${RuneId}${Rank}\``, e.g. `ember3`.

**Ids.** *Proposed* grammar:

```
<base>[@<grade>][+<modifier><grade>][#<rune>(.<rune>)*]
base   = <material>_<family> | legacy id | unique id
rune   = <runeId><rank>
```

For example: `mithril_longsword@3+keen2#ember3.storm2`, and `emberblade#dawn1`.
- A unique item may carry only a `#` part.
- An empty socket is not written. The runes are written in socket order.
- `itemById` builds the base from the tables (`<material>_<family>`), or from a legacy id or a unique id, and then applies the grade, the modifier and the runes in that order.

**Legacy ids** map to tier-1 rows, so they load unchanged and build exactly today's stats (A1, A2). These are:
- `iron_sword`, `iron_dagger`, `iron_shortsword` and `iron_battle_axe`;
- `steel_greatsword`, which is tier 1 although named steel; its `tier1` row keeps the name;
- `yew_bow`, `oak_shield`, `steel_armor` and `spark_wand`.

`BASE_ITEMS` becomes every `FamilyDef` × the `MATERIALS` of its kind.

**Stats order** in `itemStats(item)`: family at tier 1, then the tier bonus, the grade (`gradedStats`, unchanged, extended to the small slots as armour class +1 / +2), the modifier (unchanged in form; `Modifier.fits` becomes family ids) and the runes (`runeStats(rune, rank, slotClass)` from `RUNES`). It is computed once per id and cached, as `BUILT` does today.

### 5.2 Runes

*Proposed:* [`src/inventory/runes.ts`](../../src/inventory/runes.ts).

```ts
export type RuneId = 'ember' | 'rime' | 'storm' | 'venom' | 'acid' | 'stone' | 'wind' | 'life' | 'mind' | 'dawn'
export type Rank = 1 | 2 | 3 | 4
export type SlotClass = 'weapon' | 'armour' | 'shield'
export interface RuneDef { id: RuneId; name: string; element?: Element; effect: Record<SlotClass, (rank: Rank) => ItemStats>; describe: Record<SlotClass, (rank: Rank) => string> }
export const RUNES: Record<RuneId, RuneDef>
export function socketsOf(item: Item): number      // §4.4 table + unique catalog
export const RANK_NAMES: Record<Rank, string>       // 'Lesser ', '', 'Greater ', 'Grand '
```

**The pouch.** `GameState` gains `runes: Partial<Record<RuneKey, number>>`, the party's pouch. It is saved as is.

*Proposed* in a new [`src/game/runecraft.ts`](../../src/game/runecraft.ts), following the `crafting.ts` pattern (refusal strings, `ItemPlace`, `passTurn` in the field):
- `embed(game, place, socketIndex?, rune)` fills the first empty socket by default;
- `extract(game, place, socketIndex)`;
- `fuse(game, rune, rank)`;
- the `…Refusal` functions for each.

### 5.3 Elements and wards

*Proposed:* `Element` and `ELEMENTS` live in [`src/combat/combat.ts`](../../src/combat/combat.ts).
- `CombatantStats` gains `wards?: Partial<Record<Element, number>>` and `onHit?: readonly OnHit[]`.
- `sameCombatStats` compares both.
- `Spell`, `StatusRule` (for ticks) and the campaign design's `Ability.area` gain `element?: Element`.

**In the engine** ([`src/engine/battleEngine.ts`](../../src/engine/battleEngine.ts)):
- `warded(damage, element, unit)` = `max(0, damage − ward)`. It applies to cast outcomes, area outcomes, status ticks, and each `onHit` part of an attack.
- `AttackEvent` gains `bonus: { element?: Element; bane?: true; rolled: number; damage: number }[]` and `healed?: number` (Life).
- `CastOutcome` and `StatusTickEvent` gain `warded: number`.
- Statuses from `onHit` are laid after the damage, as spell statuses are.
- Bump `LOG_SCHEMA_VERSION`.

**In `deriveCombatStats`:**
- Wards and on-hit effects come from worn items: wards sum, and on-hit effects are concatenated from the main hand only.
- `maxHp` adds the items' `maxHp`.
- The strength shortfall lowers `toHit` by 5 a point (R3).
- `apPenalty` comes off action points.
- `ranged` is decided by `reach` and the skill, no longer by range: a weapon with `reach` is melee. Piercing counts for melee and for `rangedPierce`.
- `weaponSkill` follows the same rule.

**In the engine and policies,** a reach weapon's range 2 is an ordinary melee range. Opportunity attacks and zones of control stay at 1 hex, so a spear does not lock two hexes.

**In policies,** `expectedHarm` adds the expected warded bonus, and casting and area scoring subtract wards.

### 5.4 Forging and the workshop

In [`src/game/crafting.ts`](../../src/game/crafting.ts):
- `WORKSHOP_COSTS` grows to six levels (§4.3).
- *Proposed:* `forge(game, family, material)` and `forgeRefusal`, which put a plain item in the baggage.
- *Proposed:* `temper(game, place, grade)` raises a tier 3+ item's grade at the workshop. The cost is gold (tier × 10 × grade) plus the tier's material (4 × grade). The trading post's Fine and Masterwork stop at tier 2.
- `craftCost` for modifiers on tier 3+ items asks that tier's material in place of iron, copper or crystal.

**Materials.** `Material` in [`src/game/territory.ts`](../../src/game/territory.ts) gains:
- the ores and woods: `mithril`, `adamant`, `starmetal`, `ironwood`, `elderwood`, `wyrmwood` and `heartwood`;
- the trophies: `wolfhide`, `wyvern_hide`, `basilisk_scale` and `drake_scale`.

`RESOURCE_YIELDS` gains the new sites. Trophies come from a new `TROPHIES: Partial<Record<UnitKind, { material; amount }>>` in [`src/game/encounters.ts`](../../src/game/encounters.ts). They are granted in `rewardVictory`, or beside it in `GameState`, so the scene and the simulator share one path.

### 5.5 The trading post

- `TRADING_POST_COSTS` gains level 4.
- `wares(world)` lists the families in tiers 1 and 2 at the allowed grades, plus runes for sale.
- `PRICES` becomes per family at tier 1, with a tier multiplier of 1 for tier 1 and 2.5 for tier 2. A forged item sells for half of `forge cost × 1.5`.
- An embedded rune adds half its shop price to an item's sale price. A rune from the pouch sells for a third of its price.
- *Proposed:* `wares(world, filter: { slot?: EquipmentSlot; family?: string })` backs the scene's filter.

### 5.6 Loot

- *Proposed:* `rollRunes(threat, encounter, rng)` in a new [`src/game/loot.ts`](../../src/game/loot.ts). It draws from the battle's own RNG stream, a fixed salt of the battle seed, so replays stay identical.
- `takeLoot` also returns the runes and trophies, and `VictoryReward` grows to show them.
- Spawned locations keep `SPAWN_LOOT_CHANCE` for uniques. Unique items gain a `sockets` entry in their catalog (Emberblade 1, Storm Wand 1, Hawkeye Bow 1, the rest 0).

### 5.7 Scenes

- **[`InventoryScene.ts`](../../src/scenes/InventoryScene.ts):** the tooltip shows tier, grade, modifier, sockets (filled and empty) and each rune's line. The character panel shows wards when there are any.
- **[`CraftingScene.ts`](../../src/scenes/CraftingScene.ts):** three tabs, Modify (today's), Forge and Runes.
  - Forge lists families by slot, the tiers the workshop allows, the cost, and the stats against the item worn.
  - Runes shows the pouch, the chosen item's sockets, and the embed, extract and fuse actions with their costs and refusals.
- **Trading post scene:** a slot and family filter, and a Runes section.
- **[`gearCompare.ts`](../../src/scenes/gearCompare.ts):** compares wards, on-hit effects, strength shortfall and AP penalty.
- **Item icons:** one new icon per new family in `itemIcons.ts`, tinted by material (a `MATERIAL_TINTS` table). A small socket pip row sits on the icon.
- **Battle log and floating text:** "+3 fire", and "warded 4" on spells.

### 5.8 The yardstick and the simulator

**Expected kit.** *Proposed:* `expectedKit(role, level)` in [`scripts/simulate.ts`](../../scripts/simulate.ts), shared with the yardstick test. It is the gear the careful party should own at a level when the economy works:

| Level | Tier, grade | Sockets filled (rank) |
| --- | --- | --- |
| 1–4 | 1, plain to Fine | 0 |
| 5–8 | 2, Fine to Masterwork | 1–2 (rank 1–2) |
| 9–12 | 3, Fine | 2–3 (rank 2) |
| 13–16 | 4, Fine to Masterwork | 3–4 (rank 2–3) |
| 17–20 | 5, Masterwork | 4–6 (rank 3–4) |

From it, the hero side of [`campaign-to-level-20.md`](campaign-to-level-20.md) §5.2's yardstick is measured, rather than taken from the bare table in that design's §3. For the fighter, a provisional reading is:

| Level | Damage a hit | Armour class | Resistance |
| --- | --- | --- | --- |
| 10 | about 1d8+15 | about 40 | about 5 |
| 20 | about 1d8+22 with +5 fire | about 55 | about 8, with wards against the ring's element |

That design's foe blocks are written against this.

**The careful party's gear policy**, replacing `PREFERRED_MODIFIERS` with one per family:
1. **Families by role.** Fighter: longsword, then the war hammer when the ring's lead kind has resistance 4 or more. Archer: bow, then crossbow from tier 3. Mage: staff and robe. Everyone: the best body armour their strength allows without a shortfall, plus the small slots. The roles are those of the ready-made party; a recruit takes the role of its pre-roll.
2. **On each home visit:** buy or forge the highest tier affordable for each member's main hand, then body armour, then shield, then the small slots. Then temper, modify, and fill sockets.
3. **Runes.** Weapon sockets get Ember (it stops regeneration), then Storm, then Stone. Armour sockets get the ward of the next ring's dominant element (a table by ring), then Stone, then Life. Fuse whenever three match and the workshop allows.
4. **Loot is taken:** runes and trophies. Unique items are equipped when they beat what is worn on `gearCompare`'s total, a new `gearScore` helper.

**The record** gains:
- gold spent on forging and runes;
- runes found, bought and fused;
- each member's main-hand tier and filled sockets at levels 5, 10, 15 and 20.

The summary prints these against the expected-kit table, so a starved economy shows up as gear falling behind.

## 6. Consequences

- **Saves.** The id grammar is a superset of today's, and legacy ids still resolve. `GameState.runes` and the new materials need `SAVE_VERSION` bumped. The campaign design bumps it too, and one bump can serve both if they land together.
- **Logs.** `AttackEvent.bonus`, `healed` and `warded` need `LOG_SCHEMA_VERSION` bumped.
- **The early game.** Tier 1 is today's gear, and runes before the trading post's Masterwork are rare. The early game moves only by:
  - rank-1 rune loot (50% at rings 1 to 3), with a socket only on Masterwork;
  - elements and wards on statuses, which no early hero has.

  A3 of the campaign design (`--ready-level 7`) re-checks it.
- **Economy.** The record shows gold is already scarce after the hall and recruits. Forging, tempering and runes add sinks, so the outer resource sites and trophies are their sources, and selling found runes is a gold source. If the long campaign starves, the levers are, in order:
  1. site yields;
  2. rune sale prices;
  3. forge costs.
- **Item count.** There are 25 families over 5 tiers, × 3 grades × modifiers × runes. Building is lazy and cached by id, as today, so nothing enumerates the full space. Only the trading post lists, and only tiers 1 and 2: 25 families × 2 tiers × up to 3 grades, about 150 rows, so the filter is not optional.
- **Balance hazards to watch:**
  - **Life runes** on all six sockets of a tank: capped by sockets and rank.
  - **Ember and Seared versus regeneration:** intended, and the trolls' answer.
  - **Stone runes and resistance on everyone:** this could wall monsters' weapon damage. That is why the campaign design moves high-level danger into area attacks and spells, which wards (not resistance) answer.
  - **The spear's reach** letting a second rank strike over the first.

## 7. Verification

### 7.1 Tests

Tests run under `make test` (podman). The domain project can be run locally with `npx vitest run --project domain`.

- **`catalog.test.ts` (new):**
  - every family × material builds;
  - tier-1 legacy rows equal today's constants (A2);
  - `itemById` round-trips the full grammar, including runes and uniques (A1);
  - malformed ids return `undefined`.
- **`runes.test.ts` (new):**
  - each rune's effect per slot class and rank;
  - `socketsOf` by tier, grade and unique.
- **`runecraft.test.ts` (new):**
  - embed, extract and fuse, with each refusal;
  - the field embed passes a day (A5).
- **`crafting.test.ts`:** forge and temper, levels 4 to 6, material costs (A4).
- **`tradingPost.test.ts`:** level 4, tier-2 wares, rune wares, prices, the filter.
- **`character.test.ts`:**
  - strength shortfall, AP penalty and spell-skill penalty (A3);
  - reach weapons count as melee for strength and piercing; crossbow piercing;
  - wards sum; `onHit` comes from the main hand only.
- **`battleEngine.test.ts`:**
  - bonus damage on hit only, unaffected by resistance, warded (A6);
  - Ember 3 lays Seared and stops regeneration (A7);
  - warded spells, area attacks and ticks (A8);
  - Life heals the wielder;
  - the schema version.
- **`policies.test.ts`:** targeting prefers the foe whose wards do not cover the weapon's element.
- **`loot.test.ts` (new):** rune rolls by ring are deterministic for a seed; trophies by kind.
- **Scene tests:** the tooltip lines, the three crafting tabs and their refusals, the trading-post filter, and the log text (A9).
- **`scripts/simulate.test.ts`:** the gear policy's choices on fixed states, and the record fields.

### 7.2 Simulator acceptance

1. The early game at `--ready-level 7` stays near its figure (A10, R15).
2. Single cells: `--party-level L` with `expectedKit` gear, against each ring's encounters. A party of the ring's level with that kit wins most battles, and loses clearly without it.
3. The long campaign: gear tiers and sockets at levels 5, 10, 15 and 20 track the §5.8 table within a tier. If they lag, tune the economy, not the foes.

### 7.3 Suggested order (for the planner)

1. **The catalog.** `catalog.ts` with all families and materials, the id grammar with legacy aliases, the new `ItemStats` fields and their derivation (strength, AP, reach, crossbow), icons and tints. The trading post sells tiers 1 and 2 with a filter. Check A1 to A3 and the early game.
2. **Materials and forging.** The new materials, resource sites (needs the campaign design's bigger map, or placeholder sites at today's size), trophies, workshop levels 4 to 6, forge and temper.
3. **Elements and wards.** Elements on spells, statuses and abilities; wards; and `onHit` in the engine and the log.
4. **Runes.** The runes and sockets, the pouch, runecraft, rune loot, the trading-post runes, and the scenes.
5. **The simulator.** The gear policy, loot taken, the record, `expectedKit`, and the yardstick update in the campaign design.
6. **The retune** with [`campaign-to-level-20.md`](campaign-to-level-20.md) step 5, then CLAUDE.md, the manual and the designs' tables.

Steps 1 to 3 do not depend on the campaign design's outer rings. Steps 2 and 5 are where the two designs meet.

## 8. Open questions and assumptions

None of these block step 1. They are recorded with the default taken.

| # | Question | Default taken |
| --- | --- | --- |
| 8.1 | Add elements and wards (R12)? It is a battle-rules change, but it is what makes runes and breath interesting together. | Yes. Points, not percentages, as with resistance, with a floor of 0. |
| 8.2 | Runes in a pouch rather than as backpack items? | Pouch. Runes are many and small, and the backpack has 12 places. |
| 8.3 | Can runes be extracted, and do they survive? | Yes, intact, for a fee, at workshop level 2+. The alternative, where extraction destroys the rune (Diablo-like), makes embedding a commitment. That is easy to switch: drop `extract` and allow overwriting. |
| 8.4 | Tiers forged at the workshop rather than a new Forge building? | The workshop's levels 4 to 6, so there is one building to raise and one screen. |
| 8.5 | Strength requirements as a to-hit penalty, not a hard lock? | A penalty: a weak hero may still choose plate and pay for it. |
| 8.6 | Runewords (named combinations)? | Deferred. `RuneDef` and the ordered `runes` array leave room for them as a later table. |
| 8.7 | Reach weapons (spear, halberd) need no zone-of-control change? | Yes. Reach is only attack range. Revisit if a second rank of spears proves too strong. |
| 8.8 | Unique items: sockets, but no tier, grade or modifier? | Yes, as today, plus their catalog sockets. |
| 8.9 | Do bandits use tiers and runes? | Yes, by ring, through `deriveCombatStats`: the campaign design's gear tier by ring becomes material tier by ring. |

**Risks:**
- **The economy:** gold is already the bottleneck.
- **The scope of the UI:** there are three crafting tabs, a filtered trading post and a pouch.
- **Resistance creep** making monster weapon damage negligible. The campaign design's area attacks and spells are the counterweight, and they rely on wards staying below the damage of a ring's attacks.
- **The trading post list** at about 150 rows.
