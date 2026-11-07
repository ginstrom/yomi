# Implementation plan: long campaign, stage 3 (gear families and the first two tiers)

Gear gets many more kinds, each a trade-off, in two material tiers:
- a catalog of 28 families (weapons, shields, body armour, and the head, hands and feet slots) in tier 1 (iron and its wood, hide and cloth twins, today's items among them) and tier 2 (steel, ironwood, wolfhide, silk);
- ids that name a material and a family, with today's ids kept where they can be;
- weight: strength asked, action points and spell skill taken;
- reach (the spear and the halberd strike from two hexes) and crossbow piercing;
- grades and modifiers on every family;
- trading post level 4, which sells tier 2, and a slot and family filter on its Buy tab;
- icons, gear sprites and tints for all of it, and the new stat lines in the tooltip and the comparisons;
- bandits in crossbows and steel (blocked on Q2);
- the simulator's gear policy keyed by family, buying tier 2 when the post sells it.

**Source design:** [`docs/designs/long-campaign/stage-03-gear-families.md`](../../designs/long-campaign/stage-03-gear-families.md) (status "ready for planning", committed with the stage designs in `9c740ae`). Its reference is [`reference/gear-and-runes.md`](../../designs/long-campaign/reference/gear-and-runes.md) §4.1, §4.2, §4.3 (buying), §5.1, §5.5 and §5.3 (stat derivation only). The conventions every stage follows are in [`docs/designs/long-campaign/index.md`](../../designs/long-campaign/index.md). The plan was written against commit `866f732` on branch `long-campaign-stage-03` (off `armor-resistance`). Stage 2's plan ([`../long-campaign-stage-02/`](../long-campaign-stage-02/index.md)) and feature record (`docs/features/long-campaign-stage-02.md`) are the model.

## Corrections to the design

The plan follows the design except where the design contradicts itself or the code, or leaves a name or number open. These are the only departures; every task file repeats the ones it touches. Corrections 1, 3, 4 and 18 change names or items the player sees and are worth the user's eye.

1. **Two legacy ids collide with tier 2.** `<material>_<family>` makes the tier-2 greatsword `steel_greatsword`, today's tier-1 id, and makes the tier-2 breastplate "Steel Breastplate", today's tier-1 name. So the tier-1 greatsword becomes **`iron_greatsword`, "Iron Greatsword"**, and `steel_greatsword` names the tier-2 item; the tier-1 breastplate becomes **`iron_breastplate`, "Iron Breastplate"**, and `steel_armor` stays as an alias of it. Their stats are unchanged. Every other legacy id keeps its id and name. In code, `STEEL_GREATSWORD` becomes `IRON_GREATSWORD` and `STEEL_ARMOR` becomes `IRON_BREASTPLATE`.
2. **The tier-1 wood has three names** (reference §4.2: "Yew / Oak / Ash"), but `MATERIALS` has one row per kind and tier. The wood tier-1 row is `yew`. Families whose tier-1 wood is not yew name it in `tier1`: the shield is `oak_shield` "Oak Shield", the staff `ash_staff` "Ash Staff", and the wand `spark_wand` "Wand of Sparks". The bow, longbow and crossbow are yew.
3. **The robe has no material ladder** in the design (metal, wood and hide list no cloth). A fourth kind, `cloth`, has two rows: Linen (tier 1) and Silk (tier 2). So it is "Linen Robe" and "Silk Robe".
4. **"Leather Leather".** The hide tier-1 material is Leather, and so is the body-armour family. Its tier 1 is `leather_armor`, "Leather Armor" (by `tier1`). Its tier 2 is `wolfhide_leather`, "Wolfhide Leather", following the design's "Drake-scale Leather". The code spells it "Armor", as it does everywhere.
5. **`TIER_BONUS` is keyed by gear class, not material kind.** Reference §5.1 types it `Record<MaterialKind | 'shield' | 'small', …>`, but its table (§4.2) is by weapons, shields, body armour and small slots. The key is `GearClass` (`'weapon' | 'shield' | 'armour' | 'small'`), worked out from the slot.
6. **A grade is judged by gear class, not by which stats an item has.** `gradedStats` gives resistance to anything with `resistance` and armour class to anything else. That would give the tower shield (resistance 1) and the helm resistance, and give nothing to the robe and gloves. A grade now adds by class: a weapon damage (and to hit at Masterwork), as now; a shield armour class +3 / +6, as now; body armour resistance +1 / +2, as now, the robe included; and a small-slot item armour class +1 / +2 (design §2). Today's eight items grade exactly as before.
7. **`ItemStats.maxHp` waits for stage 4.** No stage-3 family uses it. CLAUDE.md requires that no item change maximum hit points, which is what keeps `hp <= maxHp` true when gear is changed outside battle. The field comes with the Life rune, which must deal with that rule.
8. **`WEAPONS` stays today's six.** It is what a new hero carries (`createCharacter`, a backpack of 12). `BASE_ITEMS` grows to every family in both tiers (56 items); `WEAPONS` does not.
9. **"Legacy ids load" means `itemById` resolves them.** `SAVE_VERSION` is raised (design §5), and under the project's rule an older save then reads as unreadable. So no old save loads. The legacy ids still resolve, in code, tests, `--player-weapon` and the debug console's `give`. `steel_greatsword` cannot be one (correction 1). An alias builds the same object as its canonical id, and that object carries the canonical id.
10. **New icons need gear sprites.** The reference says unit sprites stay as they are, but CLAUDE.md and `unitLook.test.ts` require a `GEAR_SPRITES` entry and sprite for every icon that can be held, and a `WORN_SPRITES` entry and sprite for every armour, head or cloak icon. So the ten new held icons and the five new worn icons (robe, leather, plate, cap, helm) each get a gear sprite. Gloves and boots are not drawn on the body (`WORN_SLOTS` is armour, cloak and head), so they get icons only. A tier tints only the icon, never a sprite on the body. The trading post's new level 4 also needs a `camp_trading_post/level_4` frame, since the encampment screen draws `level_<n>`.
11. **The engine judges melee by `attackRange === 1`** (zones of control, a defender turning to meet a blow, `arcStruck`). A spear has range 2. So `CombatantStats` gains `reach?: true`, and the engine asks `isMelee(stats)` instead: a reach weapon is melee everywhere, its zone of control and free attacks staying at 1 hex (design §2). The battle screen tells a blow from a shot by distance, so `AttackEvent` gains `melee: boolean`. That raises `LOG_SCHEMA_VERSION`, which the design does not mention.
12. **Strength shortfall is counted per item and only against weapon attacks.** Each worn item that asks more strength than the wearer has costs 5 to hit a point short, and the items add up. A mage in plate (6) and a helm (4) with strength 3 loses 15 + 5 = 20. Spells are unaffected; heavy gear lowers them through its `spellSkill` instead.
13. **The crossbow's piercing is its own.** `rangedPierce` lets the weapon's `armorPierce` count at range. The strength perks' piercing (Armour Breaker, Sunder) stays melee only, as they are melee blows.
14. **The trading post has no selected hero** (no party column). Its filter defaults to weapons (`mainHand`). The strength shortfall is shown only where a wearer is known: the inventory tooltip for the member whose panel is open, and the crafting screen for an item worn or carried by a member. Elsewhere it shows the bare requirement, "Strength: 6".
15. **The new families' prices are first values** (contract C5), as the design names none. Tier 2 is ×2.5. Every price is even, so the product is a whole number.
16. **A trading post's level stops being its highest grade.** Levels 1 to 3 sell tier 1 at grades up to the level. Level 4 adds tier 2 at every grade (design §2).
17. **The buckler and the tower shield are metal.** The design names only the oak shield as wood.
18. **The Wand of Sparks becomes a plain item**, as the design's family table and legacy-id list make it: the `wand` family's tier 1. It leaves `MAGIC_ITEMS` for `BASE_ITEMS`, so:
    - the trading post sells it and grades it (price 30, today's `VALUES` entry, so it still sells for 15);
    - the blight's spawns no longer draw it as loot (`MAGIC_ITEMS`; the world RNG draws the same number of times);
    - `bandits.ts` drops its no-grade special case (the Hedge-Mage fields at threat 4, plain, and at 6 and 7, off today's map);
    - the simulator's mage may buy a graded wand, which step 04's checkpoint isolates.

    The Wand of Storms stays enchanted.
19. **Simulator check 3 names no party level.** It is run at `--party-level 3`, the threat's own level, as the other cells are.
20. **"Buys tier 2 when the post allows" needs a rule.** The simulator buys, for each member's weapon, shield and armour, the dearest item of the same family that the post sells and the gold affords, if it costs more than what is worn (unmodified). Price stands in for worth across tier and grade. On a tie it takes the later in `wares` order: the higher tier, then the higher grade.
21. **`describeItemStats` signs spell skill.** Today it writes "+N%", which a penalty would make "+−15%".

## Scope and shared constraints

- **In:** design S3-R1 to S3-R5, the bandits line and the simulator line of design §2 (see the requirement map).
- **Out:**
  - tiers 3 to 5, forging, tempering and trophies (stage 10);
  - sockets and runes (stage 4);
  - hero wards, on-hit effects and `ItemStats.maxHp` (stage 4; correction 7);
  - trading post market income (stage 7);
  - the simulator's heroes changing families: the ready-made party keeps its families, and buys no small-slot items.
- **Commands** (local Node 26, prefix `PATH=/opt/homebrew/opt/node@26/bin:$PATH`, or the podman `make` targets):
  - `npm test` (`tsc && vitest run`) is the gate before every commit (`make test` in podman is the same).
  - `npx vitest run --project domain` for quick domain checks; `npx vitest run <file>` for one file.
  - `npm run test:browser -- -t <name>` (or `make test-browser ARGS="-t <name>"`): in-browser tests, after any scene change. Read `e2e/CLAUDE.md` before adding one.
  - The simulator: `npm run simulate -- <flags>` (or `make -s simulate ARGS="<flags>"`). A 500-campaign run takes about a minute and writes about 70 MB under `logs/` (gitignored).
    - Locally, give concurrent runs distinct `--out` files.
    - Never run two `make simulate` at once: both build the same image, and the loser prints nothing.
  - `npm run sprites`, `npm run sprites:check` for art. The `sprite` CLI is on the host.
- **The guard command** (exactly this, so checkpoints compare byte for byte): `npm run simulate -- --campaign --ready-level 7 --battles 500 --seed 1`.
- **Test layout:** `src/**/*.test.ts` and `scripts/**/*.test.ts` run in the Node `domain` project; `src/scenes/*Scene.test.ts` under jsdom with Phaser (smoke tests); in-browser tests in `e2e/`.
- **The early-game guard.** It was 248 of 500 after stage 2. Step 01 re-measures it before any change. A move of more than about 5 points from step 01's figure must be explained in CLAUDE.md's rules of scaling and the stage's notes, or retuned away. Step 10 judges it.
- **Versions:**
  - `SAVE_VERSION` (`src/game/save.ts`, now 15) goes to 16 in step 04 (item ids), and to 17 in step 09 if it changes the Bandit Camp's slots (a saved battle rebuilds its encounter).
  - `LOG_SCHEMA_VERSION` (`src/engine/battleEngine.ts`, now 21) goes to 22 in step 05 (`AttackEvent.melee`).
- **Determinism.** No step adds, drops or reorders an RNG draw in today's battles. Steps 04 and 05 must leave the campaign summary as their checkpoints say.
- **Commits:** one commit per step (art steps may commit sources and exports together), once `npm test` passes, on `long-campaign-stage-03`, without pushing. Never switch branches, and never commit on `armor-resistance` or `encampment-gear-and-resistance`. Messages end with the repo's `Co-Authored-By` attribution line.
- **Docs:** CLAUDE.md must stay current (its "Keeping this file current" section). Each step updates the lines its own change makes wrong. Before committing, it searches CLAUDE.md for every name it renamed or deleted (`STEEL_ARMOR`, `steel_armor`, `STEEL_GREATSWORD`, "steel breastplate", `PRICES`, the id grammar, `SPARK_WAND` and "the wand, an enchanted item"). Step 10 does the stage's documentation pass: the manual and its screenshots, the stage design's "Implementation notes", and the stages index's status line.

## Contracts

Every task file copies these unchanged. "Existing" means in the code at `866f732`; "new" means produced by the step named.

### C1. The catalog (step 04)

```ts
// src/inventory/catalog.ts (new)
export type MaterialKind = 'metal' | 'wood' | 'hide' | 'cloth'
export type Tier = 1 | 2
/** How a tier and a grade treat an item: by its slot (gearClass). */
export type GearClass = 'weapon' | 'shield' | 'armour' | 'small'
export interface MaterialDef { id: string; name: string; kind: MaterialKind; tier: Tier }
export type FamilyId =
  | 'dagger' | 'shortsword' | 'rapier' | 'longsword' | 'mace' | 'spear' | 'battle_axe' | 'war_hammer'
  | 'greatsword' | 'halberd' | 'bow' | 'longbow' | 'crossbow' | 'wand' | 'staff'
  | 'buckler' | 'shield' | 'tower_shield'
  | 'robe' | 'leather' | 'breastplate' | 'plate'
  | 'cap' | 'helm' | 'gloves' | 'gauntlets' | 'boots' | 'greaves'
export interface FamilyDef {
  id: FamilyId
  /** In an item's name after the material's: "Longsword" makes "Steel Longsword". */
  name: string
  slot: EquipmentSlot            // 'mainHand' | 'offHand' | 'armor' | 'head' | 'gloves' | 'boots'
  kind: MaterialKind
  icon: ItemIcon
  description: string
  /** At tier 1, plain; `strength`, `apPenalty`, `reach` and `rangedPierce` included. */
  stats: ItemStats
  /** Tier 1's id and name where they are not `<material>_<family>` and "<Material> <Name>" (corrections 1 to 4). */
  tier1?: { id: string; name: string }
}
export const MATERIALS: readonly MaterialDef[]         // the 8 rows below, in that order
export const FAMILIES: readonly FamilyDef[]            // the 28 rows below, in that order
export const TIER_BONUS: Record<GearClass, Record<Tier, ItemStats>>
export function gearClass(slot: EquipmentSlot): GearClass   // mainHand weapon; offHand shield; armor armour; head, gloves, boots small
/** Old ids that resolve to a canonical one (correction 9). */
export const LEGACY_ALIASES: Readonly<Record<string, string>>  // { steel_armor: 'iron_breastplate' }
```

| Material id | Name | Kind | Tier |
| --- | --- | --- | --- |
| `iron` | Iron | metal | 1 |
| `steel` | Steel | metal | 2 |
| `yew` | Yew | wood | 1 |
| `ironwood` | Ironwood | wood | 2 |
| `leather` | Leather | hide | 1 |
| `wolfhide` | Wolfhide | hide | 2 |
| `linen` | Linen | cloth | 1 |
| `silk` | Silk | cloth | 2 |

**Families** (tier 1, plain). Str is `stats.strength`. "Q1" marks a value the user decides (open question Q1). Until then it is left out, which gives today's stats exactly.

| Family | Name | Slot | Kind | Icon | Damage | AP | Range | Pierce | Other stats | Str | Tier-1 id, name |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `dagger` | Dagger | mainHand | metal | `dagger` | 1d4 | 3 | | | | | `iron_dagger` Iron Dagger |
| `shortsword` | Shortsword | mainHand | metal | `shortsword` | 1d3+1 | 4 | | | | | `iron_shortsword` Iron Shortsword |
| `rapier` | Rapier | mainHand | metal | `rapier` | 1d6 | 4 | | | critChance 5 | | `iron_rapier` Iron Rapier |
| `longsword` | Longsword | mainHand | metal | `sword` | 1d8+3 | 5 | | 1 | | | **`iron_sword`** Iron Longsword (tier1) |
| `mace` | Mace | mainHand | metal | `mace` | 1d6+3 | 5 | | 2 | | 5 | `iron_mace` Iron Mace |
| `spear` | Spear | mainHand | metal | `spear` | 1d8+1 | 5 | 2 | 1 | reach | | `iron_spear` Iron Spear |
| `battle_axe` | Battle Axe | mainHand | metal | `axe` | 1d12+2 | 6 | | 2 | | Q1 (5) | `iron_battle_axe` Iron Battle Axe |
| `war_hammer` | War Hammer | mainHand | metal | `war_hammer` | 1d10+3 | 6 | | 3 | toHit −5 | 6 | `iron_war_hammer` Iron War Hammer |
| `greatsword` | Greatsword | mainHand | metal | `greatsword` | 2d6+3 | 7 | | 2 | twoHanded | Q1 (6) | `iron_greatsword` Iron Greatsword |
| `halberd` | Halberd | mainHand | metal | `halberd` | 1d12+3 | 7 | 2 | 2 | twoHanded, reach | 6 | `iron_halberd` Iron Halberd |
| `bow` | Bow | mainHand | wood | `bow` | 1d6 | 4 | 5 | | twoHanded | | `yew_bow` Yew Bow |
| `longbow` | Longbow | mainHand | wood | `longbow` | 1d8 | 5 | 7 | | twoHanded | 5 | `yew_longbow` Yew Longbow |
| `crossbow` | Crossbow | mainHand | wood | `crossbow` | 1d10 | 6 | 5 | 2 | twoHanded, rangedPierce | | `yew_crossbow` Yew Crossbow |
| `wand` | Wand | mainHand | wood | `wand` | 1d6 | 5 | 4 | | skill magic | | **`spark_wand`** Wand of Sparks (tier1) |
| `staff` | Staff | mainHand | wood | `staff` | 1d6+1 | 5 | | | twoHanded, skill magic, spellSkill 5, maxMana 4 | | **`ash_staff`** Ash Staff (tier1) |
| `buckler` | Buckler | offHand | metal | `buckler` | | | | | acBonus 6 | | `iron_buckler` Iron Buckler |
| `shield` | Shield | offHand | wood | `shield` | | | | | acBonus 10 | | **`oak_shield`** Oak Shield (tier1) |
| `tower_shield` | Tower Shield | offHand | metal | `tower_shield` | | | | | acBonus 16, resistance 1, apPenalty 1 | 6 | `iron_tower_shield` Iron Tower Shield |
| `robe` | Robe | armor | cloth | `robe` | | | | | maxMana 6, spellSkill 5 | | `linen_robe` Linen Robe |
| `leather` | Leather | armor | hide | `leather` | | | | | acBonus 12, resistance 1 | | **`leather_armor`** Leather Armor (tier1) |
| `breastplate` | Breastplate | armor | metal | `armor` | | | | | acBonus 10, resistance 2; Q1 (spellSkill −5) | Q1 (4) | `iron_breastplate` Iron Breastplate |
| `plate` | Plate | armor | metal | `plate` | | | | | acBonus 6, resistance 4, apPenalty 1, spellSkill −15 | 6 | `iron_plate` Iron Plate |
| `cap` | Cap | head | hide | `cap` | | | | | acBonus 3 | | `leather_cap` Leather Cap |
| `helm` | Helm | head | metal | `helm` | | | | | acBonus 2, resistance 1, spellSkill −5 | 4 | `iron_helm` Iron Helm |
| `gloves` | Gloves | gloves | hide | `gloves` | | | | | toHit 2 | | `leather_gloves` Leather Gloves |
| `gauntlets` | Gauntlets | gloves | metal | `gauntlets` | | | | | resistance 1, spellSkill −5 | 4 | `iron_gauntlets` Iron Gauntlets |
| `boots` | Boots | boots | hide | `boots` | | | | | acBonus 3 | | `leather_boots` Leather Boots |
| `greaves` | Greaves | boots | metal | `greaves` | | | | | resistance 1 | 4 | `iron_greaves` Iron Greaves |

- Today's eight keep their descriptions; a new family's description is one short line of the implementer's.
- "Range" left blank means `attackRange` is left out (melee 1). `reach` is `reach: true`, `rangedPierce` is `rangedPierce: true`, and `skill magic` is `skill: 'magic'`.
- A tier-2 item is `<tier-2 material>_<family>`, "<Material> <Name>": `steel_longsword` "Steel Longsword", `ironwood_shield` "Ironwood Shield", `ironwood_wand` "Ironwood Wand", `wolfhide_leather` "Wolfhide Leather", `silk_robe` "Silk Robe".

**`TIER_BONUS`** (tier 1 is `{}` in every class). A number adds to the field, a missing field counting 0. `damage` adds to `damage.bonus`. A tier never changes attack AP, range, piercing, two-handedness, strength or a penalty.

| Class | Tier 2 |
| --- | --- |
| weapon | damage +2 |
| shield | acBonus +2 |
| armour | acBonus +2, resistance +1 |
| small | acBonus +1 |

**Item and ItemStats** (`src/inventory/inventory.ts`, step 04):

```ts
// ItemStats gains (declared and described in step 04; derived in step 05):
/** The strength the item asks; each point its wearer lacks costs SHORTFALL_TO_HIT to hit (step 05). */
strength?: number
/** Action points it takes from its wearer every turn. */
apPenalty?: number
/** A melee weapon that strikes beyond the next hex: melee for skill, strength, piercing and the engine. */
reach?: true
/** A ranged weapon whose armorPierce counts though it is shot (the crossbow). */
rangedPierce?: true
// Item gains, on every plain item and its graded and modified copies:
family?: FamilyId
material?: string   // a MATERIALS id
tier?: Tier
// (`base`, `grade` and `mod` are unchanged: `base` is the plain item's id at its tier.)

export const SHORTFALL_TO_HIT = 5
/** Points of strength `stats` asks beyond `strength`: max(0, (stats?.strength ?? 0) − strength). */
export function strengthShortfall(strength: number, stats: ItemStats | undefined): number
/** Tooltip lines; with `wearerStrength`, the strength line tells the shortfall (C7). */
export function describeItemStats(stats?: ItemStats, wearerStrength?: number): string[]
```

- `BASE_ITEMS` is every `FamilyDef` × the `MATERIALS` of its kind, in `FAMILIES` order and tier 1 before tier 2 within a family (56 items).
- `MAGIC_ITEMS` is today's nine without `SPARK_WAND` (correction 18). `WEAPONS` is today's six: `IRON_DAGGER`, `IRON_SHORTSWORD`, `IRON_SWORD`, `IRON_BATTLE_AXE`, `IRON_GREATSWORD`, `YEW_BOW` (correction 8).
- The exported constants `IRON_SWORD`, `IRON_DAGGER`, `IRON_SHORTSWORD`, `IRON_BATTLE_AXE`, `IRON_GREATSWORD` (was `STEEL_GREATSWORD`), `YEW_BOW`, `OAK_SHIELD`, `IRON_BREASTPLATE` (was `STEEL_ARMOR`) and `SPARK_WAND` are the catalog's tier-1 items: the same objects `itemById` gives.

### C2. Ids (step 04)

```
id     = <plain>[@<grade>][+<modifier><grade>]   |   <enchanted id>
plain  = <material>_<family>                     (tier 2; tier 1 of a family without `tier1`)
       | <tier1.id>                              (tier 1 of a family with `tier1`)
       | <legacy alias>                          (LEGACY_ALIASES)
grade  = 2 | 3        (grade 1 is never written)
```

- `ID_GRAMMAR` is unchanged (`/^([a-z_]+)(?:@([23]))?(?:\+([a-z]+)([123]))?$/`). A plain id is split at its first `_` into material and family; no material id holds an underscore.
- `itemById(id)` builds the plain item from the tables, then applies the grade and then the modifier, and caches by id as `BUILT` does today. An alias resolves to the canonical base, so `itemById('steel_armor@2')` is the same object as `itemById('iron_breastplate@2')`, whose `id` is `'iron_breastplate@2'`.
- **Undefined** for:
  - an unknown material or family;
  - a material of the wrong kind (`iron_bow`, `yew_longsword`);
  - tier 1 of a family with `tier1` written by the rule (`iron_longsword`, `yew_shield`, `yew_wand`, `yew_staff`, `leather_leather`);
  - a grade or modifier on an enchanted item;
  - a modifier that does not fit the family.
- `baseItem(item)` is the plain item at its tier (`steel_longsword` for `steel_longsword@3+light1`). `craftedItem(base, grade, mod?)` and `unmodified` work as now.

### C3. Grades (step 04)

```ts
// src/inventory/grades.ts
export function gradedStats(stats: ItemStats, grade: Grade, cls: GearClass): ItemStats
// GRADE_DEFS gains `small`: 0 / 1 / 2.
```

| Class | Fine (2) | Masterwork (3) |
| --- | --- | --- |
| weapon | damage +1 | damage +2, toHit +5 |
| shield | acBonus +3 | acBonus +6 |
| armour | resistance +1 | resistance +2 (from 0 for the robe) |
| small | acBonus +1 | acBonus +2 |

`gradedItem(base, grade)` takes the class from `gearClass(base.slot)` (correction 6).

### C4. Modifiers (step 04)

`Modifier.fits` becomes `readonly FamilyId[]`, and `modifiersFor(family: FamilyId)` takes a family. A modifier fits every tier of its families. Each modifier's effects, unlocks and words are unchanged.

| Modifier | Fits (families) |
| --- | --- |
| balanced | shortsword, longsword, greatsword, **spear** |
| recurve | bow |
| bearded | battle_axe, **mace** |
| keen | dagger, shortsword, longsword |
| braced | shield |
| light | longsword, battle_axe |
| long | bow, **crossbow** |
| reinforced | breastplate, **leather** |

`craftCost(item, grade)` at grade 1 asks timber for a wood family and iron for any other (as today: the bow and the shield are wood).

### C5. Prices (step 04; level 4 and the filter in step 06)

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

### C6. Icons, sprites and tints (art in steps 02 and 03; wired in step 04; tints shown in step 07)

`ItemIcon` gains these 19 icons: `rapier`, `mace`, `spear`, `war_hammer`, `halberd`, `longbow`, `crossbow`, `staff`, `buckler`, `tower_shield`, `robe`, `leather`, `plate`, `cap`, `helm`, `gloves`, `gauntlets`, `boots`, `greaves`.

| What | Names | Made in | Wired in |
| --- | --- | --- | --- |
| Item icons (20px `icon` canvas) | `icon_<icon>` for all 19 | step 02 (`art/icons/`) | step 04: `ITEM_ICON_KEYS` |
| The trading post's level 4 | frame `level_4` of `camp_trading_post` | step 02 (`art/encampment/`) | none: `facilityFrame` already names `level_<n>` |
| Held gear (32px `unit` canvas, over `warrior`) | `gear_rapier`, `gear_mace`, `gear_spear`, `gear_war_hammer`, `gear_halberd`, `gear_longbow`, `gear_crossbow`, `gear_staff`, `gear_buckler`, `gear_tower_shield` | step 03 (`art/gear/`) | step 04: `GEAR_SPRITES`, and `SWUNG_GEAR` for the six melee ones (rapier, mace, spear, war_hammer, halberd, staff) |
| Worn gear | `gear_robe`, `gear_leather`, `gear_plate` (armour), `gear_cap`, `gear_helm` (head) | step 03 | step 04: `WORN_SPRITES` |

```ts
// src/scenes/itemIcons.ts (step 04)
/** A tier-2 material's tint over its family's icon; tier 1 is drawn untinted. */
export const MATERIAL_TINTS: Readonly<Record<string, number>>   // steel, ironwood, wolfhide, silk
export function iconTint(item: Item): number | undefined
```

`unitLook.test.ts`'s "has a sprite for everything that can be held" covers every held item of `BASE_ITEMS` and `MAGIC_ITEMS`, not only `WEAPONS`.

### C7. Derivation and reach (step 05)

```ts
// src/combat/combat.ts — CombatantStats gains:
/** Its weapon is melee though it strikes beyond the next hex (a spear); none when left out. */
reach?: true
// sameCombatStats compares it (left out equals false).

// src/engine/battleEngine.ts
/** A weapon that strikes as melee: range 1, or reach. */
export function isMelee(stats: Pick<CombatantStats, 'attackRange' | 'reach'>): boolean
export function arcStruck(defender: Pick<UnitSnapshot, 'position' | 'facing' | 'turnReady'>, from: Hex, melee: boolean): Arc  // was attackRange: number
// AttackEvent gains:
/** The blow was struck with a melee weapon, reach included; false for a shot. */
melee: boolean
```

- **`deriveCombatStats`** (`src/character/character.ts`), with `strength = attributeLevel(character, 'strength')` and the main hand's stats as `weapon`:
  - `ranged = attackRange > 1 && !weapon.reach`;
  - `toHit −= SHORTFALL_TO_HIT × Σ strengthShortfall(strength, s)` over `wornStats` (an off-hand item under a two-handed weapon does not count; correction 12);
  - `actionPoints −= Σ apPenalty` over `wornStats`;
  - `spellSkill` adds every worn `spellSkill`, negatives included (as today);
  - `pierce = ranged ? (weapon.rangedPierce ? armorPierce : 0) : armorPierce + perkBonus('armorPierce')` (correction 13);
  - `might` and the melee or ranged damage perk follow `ranged`, and the `range` perk adds only when `ranged`;
  - `reach: true` is set when the weapon has it.
- **`weaponSkill(weapon)`** is `stats.skill`, else Archery when `attackRange > 1 && !reach`, else Melee Weapons.
- **The engine** uses `isMelee` wherever it asks `attackRange === 1` today:
  - `reactorsAt` (zones of control and free attacks, still at 1 hex);
  - a defender turning to meet a side or rear blow;
  - `arcStruck`.

  `policies.ts` and `scenes/attackPlan.ts` pass `isMelee(stats)` to `arcStruck`. A reach attack needs no other change: range 2 is an ordinary range.
- **The battle screen:** `attackLook` returns `'swing'` when `event.melee`. `impactMs` times a melee event as a swing.
- `LOG_SCHEMA_VERSION` 21 → 22.

**Words** (`describeItemStats` in step 04; `gearCompare.ts` in step 07):

| Stat | Tooltip line (`describeItemStats`) | Comparison label: words (`statWords`) | List summary (`statSummary`) |
| --- | --- | --- | --- |
| reach | `Reach: 2 hexes` (in place of `Range:`) | `Range: 2 hexes, reach` | `reach 2` |
| rangedPierce | `Pierces 2 resistance, even at range` | `Pierces: 2 resistance, even at range` | `pierces 2` |
| strength | `Strength: 6`; short: `Strength: 6 (you have 3): to hit −15%` | `Strength: 6`, or `6 (you have 3): to hit −15%` | `str 6` |
| apPenalty | `Action Points: −1` | `AP: −1` | `AP −1` |
| spellSkill | `Spell Skill: −15%` (signed, correction 21) | `Spell Skill: −15%` | `spell −15%` |
| maxMana | `Mana: +4` (as now) | `Mana: +4` | `mana +4` |

### C8. The trading post's level 4 and filter (step 06; the scene in step 07)

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

**The scene** (step 07):

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

### C9. Bandits (steps 08 and 09; blocked on Q2)

What Q2 decides: whether a Crossbowman role takes the field, and where, and whether bandit gear is steel from threat 5. Whatever the answer, any bandit stays a legal draft whose hero twin has the same stats (the existing test in `bandits.test.ts`). With option (a) of Q2:

```ts
// src/game/bandits.ts
export type BanditRole = /* existing */ | 'crossbowman'
/** The tier and grade of bandit gear at a threat: tier 2 from threat 5 (Q2), grade as banditGrade. */
export function banditGear(threat: number): { tier: Tier; grade: Grade }
/** Was (role, level, grade); the tier joins the cache key. */
export function banditStats(role: BanditRole, level: number, gear: { tier: Tier; grade: Grade }): CombatantStats
// src/game/encounters.ts
export type BanditKind = /* existing */ | 'bandit_crossbowman'     // FOE_XP 100; sprite `bandit_crossbowman` (step 08)
```

## Tasks

| Step | Task | Outcome | Depends on | Engineer / reviewer | Status |
| --- | --- | --- | --- | --- | --- |
| 01 | [Baseline measurement](01-baseline-measurement.md) | The guard and the reference cells measured on this tree before any change; recorded here and in CLAUDE.md if moved | — | sonnet / sonnet | pending |
| 02 | [Item icons and the trading post's level 4](02-icons.md) | 19 `icon_<icon>` sprites and `camp_trading_post/level_4` exported; README | — | opus / opus (art) | pending |
| 03 | [Gear sprites](03-gear-sprites.md) | 15 `gear_<icon>` sprites in the atlas over `warrior`; README | 02 (the atlas is rebuilt by each, so one after the other) | opus / opus (art) | pending |
| 04 | [The catalog and ids](04-catalog-and-ids.md) | `catalog.ts`, the new `Item`/`ItemStats` fields and words, ids and aliases, `BASE_ITEMS` generated, grades by class, modifiers by family, prices, renames, the wand made plain, icon and sprite tables, `PREFERRED_MODIFIERS` by family; SAVE 16. Guard identical but for the wand. | 01, 02, 03 | opus / opus | pending (Q1 sets three family rows before commit; `blocked (Q1)` if still unanswered then) |
| 05 | [Weight and reach](05-weight-and-reach.md) | Strength shortfall, AP penalty, reach as melee, crossbow piercing, `isMelee`, `AttackEvent.melee`, the swing look; LOG 22. Summary identical to step 04's. | 04 | opus / opus | pending |
| 06 | [Trading post level 4 and the simulator](06-trading-post-level-4.md) | Level 4, tier-2 wares, `sells`, `wares` filter, refusals, the encampment line, the simulator's tier-2 buying and tally; guard measured | 05 | sonnet / opus | pending |
| 07 | [The screens](07-screens.md) | Trading post filter and probe, tooltip and comparison lines with the shortfall, tints in three scenes, scene and in-browser tests | 06 | sonnet / opus | pending |
| 08 | [Crossbowman sprite](08-crossbowman-sprite.md) | `bandit_crossbowman` unit sprite (only if Q2 adds the role) | Q2; may run after 03 | opus / opus (art) | blocked (Q2) |
| 09 | [Bandits in crossbows and steel](09-bandits.md) | Bandit gear by tier and grade, the Crossbowman role and kind, the camp's slots, as Q2 decides; cells measured | 06, 08; Q2 | sonnet / sonnet | blocked (Q2) |
| 10 | [Measure, tune and document](10-measure-tune-document.md) | The guard against step 01, checks 2 and 3, the spear and halberd cells, tuning, CLAUDE.md, the manual and screenshots, the stage notes and index status, the play script | 07, 09 | opus / opus | pending |

## Execution order

1. **01** first, on the tree as it stands, before any code changes. **02 then 03** may run alongside it (art only, no code), one after the other, since each rebuilds the atlas.
2. **04 → 05 → 06 → 07** in a line. Each builds on the item model and the one before it, and each checkpoint compares against the last.
3. **08** as soon as Q2 is answered (art only), after 03. **09** after 06 and 08. It may run alongside 07: 09 touches `bandits.ts`, `encounters.ts` and their tests, while 07 touches `src/scenes/` and `e2e/`. Each edits only its own lines of CLAUDE.md, and the second to commit rebases its CLAUDE.md edit on the first.
4. **10** last.

**Checkpoints** (the guard command, compared with step 01's summary):
- **After 04:** identical but for the mage's wand, which the simulator may now buy graded. The engineer confirms this with a scratch run in which `visitFacilities` skips the wand, which must be identical to step 01 and is not committed. Record the guard and the gold spent on gear. Under Q1 (b), the breastplate's strength and spell-skill rows also move it; record both runs.
- **After 05:** identical to step 04's. No simulated hero holds a reach weapon or a crossbow; Q1 decides any strength penalty.
- **After 06:** the guard measured, with tier-2 items bought and the trading post's final level. Step 10 judges it.
- **After 09:** the guard measured, and the Bandit Camp cells at threats 3 to 5 against step 01's.

## Requirement map

| Design requirement | Steps |
| --- | --- |
| S3-R1 every family in tiers 1 and 2; tier 1 of a legacy family equals today's; legacy ids load | 04 (corrections 1, 9; Q1) |
| S3-R2 strength, AP and spell-skill penalties; reach; crossbow piercing | 04 (fields), 05 |
| S3-R3 grades and modifiers on every family | 04 |
| S3-R4 trading post level 4 sells tier 2; the filter | 06 (rules), 07 (scene) |
| S3-R5 icons, tints and tooltips | 02, 03 (art), 04 (tables, words), 07 (scenes) |
| Design §2 bandits | 08, 09 (Q2) |
| Design §2 simulator: `PREFERRED_MODIFIERS` by family; tier 2 bought | 04, 06 |
| Design §6 tests | 04 to 07, 09, each with its own |
| Design §6 simulator checks 1 to 3, the play script; §7 risks (reach win rates); "Done when" | 01, 10 |
| Stages-index conventions: guard, versions, docs, sprites | 01, 02, 03, 04, 05, 08, 10 |

## Overall completion criteria

- [ ] Every step done (08 and 09 as Q2 decides), `npm test` passing at each commit, and the in-browser tests after 05 and 07.
- [ ] The guard measured at 01, after 04, 06 and 09, and judged in 10: within about 5 points of step 01's figure, or the move explained in CLAUDE.md's rules of scaling and the stage notes.
- [ ] Checks 2 and 3 recorded: `steel_war_hammer` beats `iron_sword` at `--encounter troll_lair --threat 5 --party-level 5`; `iron_spear` is comparable to `iron_sword` at `--encounter goblin_raid --threat 3 --party-level 3`. The spear and halberd cells are watched (design §7).
- [ ] Every new icon and gear sprite is a finished drawing; `sprites:check` is clean.
- [ ] `SAVE_VERSION` is 16 (17 if step 09 changes the camp's slots), and `LOG_SCHEMA_VERSION` is 22.
- [ ] CLAUDE.md describes the catalog, ids, weight, reach, the trading post's level 4 and filter, and the new tables. The manual describes them, and its screenshots are retaken.
- [ ] The stage design has "Implementation notes" with the figures, and the stages index's stage 3 row says done.
- [ ] The design's play script has been walked in the game (`make dev`), or the steps not walked are listed for the user in step 10's record.

## Open questions

| # | Question | Options | Recommendation | Blocks |
| --- | --- | --- | --- | --- |
| Q1 | **Do the legacy families take the weight the reference's family table gives them?** §4.1 gives the breastplate strength 4 and spell skill −5, the battle axe strength 5 and the greatsword strength 6. S3-R1 and reference A2 say tier 1 of a legacy family equals today's item exactly, and the design expects the guard to move only from steel. Every hero starts in the breastplate, and the ready-made archer and mage have strength 3. | (a) none: today's stats exactly; (b) all four values: the archer and mage lose 5 to hit and the mage 5 spell skill, so the guard falls; (c) the axe and greatsword only: no simulated hero wields them under strength (the Brute has 10), and the breastplate stays as it is | (c): heavy weapons ask strength, as the design's point is, while the armour every hero starts in stays exact, which keeps the guard | Step 04's commit (three rows of C1) and the expectation at step 05's checkpoint. The rest of step 04 can be built first. |
| Q2 | **Bandits: "may now use the crossbow (a Crossbowman role) and steel at threat 5."** A new role is a new unit kind, which needs a sprite, an experience value and a slot in the Bandit Camp. Steel at threat 5 strengthens the threat-5 Bandit Gangs that spawn on today's map, so the guard moves. | (a) a Crossbowman kind as a slot from threat 6 (off today's map; checked by cells), and steel (tier 2) from threat 5, measured and retuned in step 10; (b) the Crossbowman in the Archer's place at threat 5, with steel from 5; (c) steel only, no Crossbowman; (d) defer both to stage 9, when the rings beyond threat 5 exist | (a): it builds the role the design names, without reshaping today's threat-5 fight, and steel at 5 follows the design. Under (a) the Crossbowman's slot goes after the Hedge-Mage and before the Brute, so threats 6 and 7 field the Captain, Archer, Hedge-Mage and Crossbowman, and the Brute waits for a count of 5; the user confirms that order with the answer | Steps 08 and 09 |

## For implementers

After working on a step, update its row's status here (`in progress`, `done` or `blocked`) with the commit. Fill the task file's execution record: the commit, the checks run and their results, deviations, and anything left for a later step. If a step is blocked, say on what. A contract changed by a step is amended here, marked with the step, as stage 2's plan did.
