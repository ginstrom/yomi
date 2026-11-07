# Step 04: The catalog and ids

[Plan index](index.md) · [Stage design](../../designs/long-campaign/stage-03-gear-families.md) (§2 "The catalog", "Ids", "Grades"; §5) · [Reference](../../designs/long-campaign/reference/gear-and-runes.md) §4.1, §4.2, §5.1 · [Stages index](../../designs/long-campaign/index.md) ("Versions", "The early-game guard")

**Difficulty:** intricate data modelling across the item model, grades, modifiers, the trading post, bandits, the simulator and the scenes' tables. Engineer opus, reviewer opus.

**Status note:** the step can be built before Q1 is answered. Three rows of C1 (`battle_axe`, `greatsword` and `breastplate`, the values marked "Q1") are set from the user's answer before the commit (see §3).

## 1. Objective

Replace the hand-written plain items with a catalog of 28 families in two material tiers, built from tables. Today's eight items must keep their stats, though two of them change id and name (correction 1). By the end of the step:

- `itemById` builds every family × tier × grade × modifier;
- `BASE_ITEMS` is generated from the catalog;
- grades and modifiers work on every family;
- the trading post prices every family (tier 1 still the only tier it lists);
- the scenes' icon and sprite tables name the art from steps 02 and 03;
- the simulator's gear policy is keyed by family.

The new `ItemStats` fields (`strength`, `apPenalty`, `reach`, `rangedPierce`) are declared and described in the tooltip words, but **nothing derives them yet**: `deriveCombatStats`, `weaponSkill` and the engine are step 05.

## 2. Requirements and context

### Design requirements this step serves

- **S3-R1** Every family exists in tiers 1 and 2. Tier 1 of a legacy family equals today's item exactly, and legacy ids load (as corrected below).
- **S3-R2** (fields only) The fields that carry strength, AP penalty, reach and crossbow piercing.
- **S3-R3** Grades and modifiers carry over to every family.
- **S3-R5** (tables and words) Icons and tints for every family, and the tooltip words for the new stats.
- **Design §2, simulator line:** `PREFERRED_MODIFIERS` is keyed by family.
- **Design §5:** `BASE_ITEMS` is generated from `FAMILIES` × `MATERIALS` of the family's kind, limited to tiers 1 and 2. `itemById` caches as now. `SAVE_VERSION` is bumped.

### Corrections to the design that this step carries out (from the index, unchanged)

1. **Two legacy ids collide with tier 2.** `<material>_<family>` makes the tier-2 greatsword `steel_greatsword`, today's tier-1 id, and makes the tier-2 breastplate "Steel Breastplate", today's tier-1 name. So the tier-1 greatsword becomes **`iron_greatsword`, "Iron Greatsword"**, and `steel_greatsword` names the tier-2 item; the tier-1 breastplate becomes **`iron_breastplate`, "Iron Breastplate"**, and `steel_armor` stays as an alias of it. Their stats are unchanged. Every other legacy id keeps its id and name. In code, `STEEL_GREATSWORD` becomes `IRON_GREATSWORD` and `STEEL_ARMOR` becomes `IRON_BREASTPLATE`.
2. **The tier-1 wood has three names** (reference §4.2: "Yew / Oak / Ash"), but `MATERIALS` has one row per kind and tier. The wood tier-1 row is `yew`. Families whose tier-1 wood is not yew name it in `tier1`: the shield is `oak_shield` "Oak Shield", the staff `ash_staff` "Ash Staff", and the wand `spark_wand` "Wand of Sparks". The bow, longbow and crossbow are yew.
3. **The robe has no material ladder** in the design (metal, wood and hide list no cloth). A fourth kind, `cloth`, has two rows: Linen (tier 1) and Silk (tier 2). So it is "Linen Robe" and "Silk Robe".
4. **"Leather Leather".** The hide tier-1 material is Leather, and so is the body-armour family. Its tier 1 is `leather_armor`, "Leather Armor" (by `tier1`). Its tier 2 is `wolfhide_leather`, "Wolfhide Leather", following the design's "Drake-scale Leather". The code spells it "Armor", as it does everywhere.
5. **`TIER_BONUS` is keyed by gear class, not material kind.** Reference §5.1 types it `Record<MaterialKind | 'shield' | 'small', …>`, but its table (§4.2) is by weapons, shields, body armour and small slots. The key is `GearClass` (`'weapon' | 'shield' | 'armour' | 'small'`), worked out from the slot.
6. **A grade is judged by gear class, not by which stats an item has.** `gradedStats` gives resistance to anything with `resistance` and armour class to anything else. That would give the tower shield (resistance 1) and the helm resistance, and give nothing to the robe and gloves. A grade now adds by class: a weapon damage (and to hit at Masterwork), as now; a shield armour class +3 / +6, as now; body armour resistance +1 / +2, as now, the robe included; and a small-slot item armour class +1 / +2 (design §2). Today's eight items grade exactly as before.
7. **`ItemStats.maxHp` waits for stage 4.** No stage-3 family uses it. CLAUDE.md requires that no item change maximum hit points, which is what keeps `hp <= maxHp` true when gear is changed outside battle. The field comes with the Life rune, which must deal with that rule.
8. **`WEAPONS` stays today's six.** It is what a new hero carries (`createCharacter`, a backpack of 12). `BASE_ITEMS` grows to every family in both tiers (56 items); `WEAPONS` does not.
9. **"Legacy ids load" means `itemById` resolves them.** `SAVE_VERSION` is raised (design §5), and under the project's rule an older save then reads as unreadable. So no old save loads. The legacy ids still resolve, in code, tests, `--player-weapon` and the debug console's `give`. `steel_greatsword` cannot be one (correction 1). An alias builds the same object as its canonical id, and that object carries the canonical id.
15. **The new families' prices are first values** (contract C5), as the design names none. Tier 2 is ×2.5. Every price is even, so the product is a whole number.
16. **A trading post's level stops being its highest grade** (from step 06). Levels 1 to 3 sell tier 1 at grades up to the level; level 4 adds tier 2. In this step `wares` lists tier 1 only.
17. **The buckler and the tower shield are metal.** The design names only the oak shield as wood.
18. **The Wand of Sparks becomes a plain item**, as the design's family table and legacy-id list make it: the `wand` family's tier 1. It leaves `MAGIC_ITEMS` for `BASE_ITEMS`, so:
    - the trading post sells it and grades it (price 30, today's `VALUES` entry, so it still sells for 15);
    - the blight's spawns no longer draw it as loot (`MAGIC_ITEMS`; the world RNG draws the same number of times);
    - `bandits.ts` drops its no-grade special case (the Hedge-Mage fields at threat 4, plain, and at 6 and 7, off today's map);
    - the simulator's mage may buy a graded wand, which this step's checkpoint isolates.

    The Wand of Storms stays enchanted.
21. **`describeItemStats` signs spell skill.** Today it writes "+N%", which a penalty would make "+−15%".

### Open question Q1 (the user's; it sets three rows before the commit)

Do the legacy families take the weight that reference §4.1 gives them?
- **The question.** §4.1 gives the breastplate strength 4 and spell skill −5, the battle axe strength 5 and the greatsword strength 6. S3-R1 and reference A2 say tier 1 of a legacy family equals today's item exactly.
- **The options:**
  - (a) none: today's stats exactly;
  - (b) all four values;
  - (c) the axe and greatsword only (the plan's recommendation).
- **Building before the answer.** Build with the "Q1" values left out (option (a)), and set them from the answer before committing. The legacy-equality test then compares the `ItemStats` fields of today's items (damage, AP, range, pierce, two-handed, AC, resistance, to hit, skill, mana, spell skill, crit) exactly. Under (b) or (c) it allows only the answered `strength` and `spellSkill` additions, and says so.
- **If the answer has not arrived** when the rest is done, mark the step `blocked (Q1)` in the index and stop before committing.

### Shared constraints (from the index)

- **Gate and local commands.** `npm test` (`tsc && vitest run`) is the gate before the commit. Locally, prefix `PATH=/opt/homebrew/opt/node@26/bin:$PATH`; `make test` in podman is equivalent.
  - `npx vitest run --project domain` and `npx vitest run <file>` for quick checks.
  - After the scene tables change, run `npm run test:browser` (at least `-t "trading"` or the encampment and character tests) to see that the icons load.
- **The guard command** (exactly this): `npm run simulate -- --campaign --ready-level 7 --battles 500 --seed 1`.
  - Give concurrent local runs distinct `--out` files.
  - Never run two `make simulate` at once.
  - Logs go to `logs/` (gitignored); never commit them.
- **Determinism.** Add, drop or reorder no RNG draw in today's battles or world turns.
- **Commit.** One commit, on `long-campaign-stage-03`, without pushing. Never switch branches; never commit on `armor-resistance` or `encampment-gear-and-resistance`. The message ends with the repo's `Co-Authored-By` attribution line.
- **CLAUDE.md** must stay current. Before committing, search it for every name this step renames or deletes: `STEEL_ARMOR`, `steel_armor`, `STEEL_GREATSWORD`, `steel_greatsword`, "steel breastplate", "Steel Greatsword", `PRICES`, the id grammar `<base>[@<grade>][+<modifier><grade>]`, `SPARK_WAND`, "the wand, an enchanted item", `BASE_ITEMS`, `WEAPONS`. Fix each line it makes wrong.

## 3. Dependencies and prerequisites

- **Step 01 (done before this):** the baseline guard summary, verbatim, in `01-baseline-measurement.md`'s execution record, and the baseline note in the index.
- **Steps 02 and 03 (art):** they produce the exported PNGs and atlas entries this step's tables name:
  - `public/assets/sprites/icon_<icon>.png` for the 19 new icons;
  - the atlas sprites `gear_rapier`, `gear_mace`, `gear_spear`, `gear_war_hammer`, `gear_halberd`, `gear_longbow`, `gear_crossbow`, `gear_staff`, `gear_buckler`, `gear_tower_shield`, `gear_robe`, `gear_leather`, `gear_plate`, `gear_cap` and `gear_helm`, each with an `idle` animation (and `walk` rest).

  `unitLook.test.ts` checks that every held or worn icon names an atlas sprite, so this step cannot pass its tests before 02 and 03 are committed.
- **Q1** (above) sets three rows before the commit.
- **Existing code this step changes** (inspected at `866f732`):
  - `src/inventory/inventory.ts`: `ItemIcon`, `ItemStats`, `Item`, `describeItemStats`, the item constants, `WEAPONS`, `MAGIC_ITEMS`, `BASE_ITEMS`, `ID_GRAMMAR`, `itemById`, `baseItem`, `unmodified` and `craftedItem`;
  - `src/inventory/grades.ts`: `GRADE_DEFS`, `gradedStats` and `gradedItem`;
  - `src/inventory/modifiers.ts`: `Modifier.fits` and `modifiersFor`; `isModifierId`;
  - `src/game/tradingPost.ts`: `PRICES`, `VALUES`, `buyPrice` and `wares`;
  - `src/game/crafting.ts`: `craftCost`, which tests `['yew_bow', 'oak_shield']`, and `itemRefusal`/options, which call `modifiersFor(base.id)`;
  - `src/character/character.ts`: imports `STEEL_ARMOR`, `SPARK_WAND`, `WEAPONS`; `STARTING_KIT`; `createCharacter` dresses heroes in `STEEL_ARMOR`;
  - `src/game/bandits.ts`: `GEAR` (`STEEL_ARMOR`); `atGrade`, which skips `SPARK_WAND`;
  - `src/game/blight.ts:308`: draws spawn loot from `MAGIC_ITEMS`;
  - `src/scenes/itemIcons.ts`: `ITEM_ICON_KEYS`;
  - `src/scenes/unitLook.ts`: `GEAR_SPRITES`, `SWUNG_GEAR` and `WORN_SPRITES`;
  - `src/scenes/debugCommands.ts:191`: the `items` summary example, `iron_sword@2+light1`, which stays valid;
  - `scripts/simulate.ts`: `PREFERRED_MODIFIERS` (keyed by base id), `modifierRank` and `craftGear` (by `base.id`), and `--player-weapon`'s help text;
  - `src/game/save.ts`: `SAVE_VERSION = 15`.
- **Tests that name the renamed items:**
  - `src/scenes/unitLook.test.ts`, which imports `STEEL_ARMOR` and `STEEL_GREATSWORD` and uses `itemById('steel_armor@2')`;
  - `src/game/bandits.test.ts`, whose `GEAR` uses `STEEL_ARMOR` and comments that the wand is never graded;
  - `src/game/tradingPost.test.ts`, `src/inventory/*.test.ts`, `src/character/*.test.ts` and `scripts/simulate.test.ts`.

  `grep -rn "STEEL_ARMOR\|STEEL_GREATSWORD\|steel_armor\|steel_greatsword\|SPARK_WAND\|spark_wand" src scripts e2e` lists them all. `e2e/manual.shots.ts:202` uses `iron_sword@2`, which stays valid.
- **Produces for later steps:**
  - C1 to C6 as written, in particular the `ItemStats` fields, `strengthShortfall`, `SHORTFALL_TO_HIT`, `gearClass`, `FAMILIES`, `FamilyId`, `Tier` and `MATERIAL_TINTS`/`iconTint`;
  - `Item.family`, `Item.material` and `Item.tier` on every plain item;
  - `buyPrice` for tier-2 items (step 06 lists them);
  - `describeItemStats(stats, wearerStrength?)` (step 07 passes the strength).

## 4. Contracts (copied unchanged from the index)

### C1. The catalog

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

**Item and ItemStats** (`src/inventory/inventory.ts`):

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

### C2. Ids

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

### C3. Grades

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

### C4. Modifiers

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

### C5. Prices

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

### C6. Icons, sprites and tints

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

### The tooltip words (C7's tooltip column; `describeItemStats` in this step)

| Stat | Tooltip line (`describeItemStats`) |
| --- | --- |
| reach | `Reach: 2 hexes` (in place of `Range:`) |
| rangedPierce | `Pierces 2 resistance, even at range` |
| strength | `Strength: 6`; with `wearerStrength` short: `Strength: 6 (you have 3): to hit −15%` |
| apPenalty | `Action Points: −1` |
| spellSkill | `Spell Skill: −15%` (signed, correction 21; `+5%` stays `+5%`) |
| maxMana | `Mana: +4` (as now) |

The comparison and list words (`gearCompare.ts`) are step 07's; do not change `gearCompare.ts` here.

## 5. Scope and implementation guidance

1. **`src/inventory/catalog.ts` (new).** Write C1's types and tables exactly as given.
   - `catalog.ts` imports types from `inventory.ts` (`EquipmentSlot`, `ItemIcon`, `ItemStats`), and `inventory.ts` builds items from `catalog.ts`. Keep the cycle safe the way CLAUDE.md requires of `skills.ts`/`perks.ts`: `catalog.ts` holds plain data and functions and calls nothing of `inventory.ts` as it loads (type-only imports are erased; `import type`). If a cycle causes a load-order problem, move the shared types to a small module rather than calling across the cycle.
   - Helpers may be added as the implementer sees fit (for example `familyById`, `materialById`, a `plainItem(family, material)` builder, or a `tierStats` that adds `TIER_BONUS`). Keep the exported contract names as C1.
2. **`src/inventory/inventory.ts`.**
   - Extend `ItemIcon` with the 19 icons (C6). Extend `ItemStats` and `Item` (C1). Do **not** add `maxHp` (correction 7).
   - Add `SHORTFALL_TO_HIT` and `strengthShortfall`.
   - `describeItemStats(stats, wearerStrength?)` gives the words table's lines:
     - `Reach:` replaces `Range:` when `reach` is set;
     - the pierce line gains ", even at range" with `rangedPierce`;
     - the strength line appears when `strength` is set, with the shortfall text only when `wearerStrength` is given and short (to hit = `SHORTFALL_TO_HIT` × shortfall, written `−15%`);
     - `Action Points: −N` for `apPenalty`;
     - spell skill is signed with the existing `signed` helper.

     Keep today's order for today's lines, and place the new lines sensibly (strength after two-handed, AP after it).
   - Build the plain items from the catalog. `BASE_ITEMS` is generated (C1). The named constants are lookups of the generated items, so that `IRON_SWORD === itemById('iron_sword')`.
   - Remove the hand-written plain constants, and delete `SPARK_WAND`'s enchanted definition; it is now the `wand` family's tier 1, with id `spark_wand`, name "Wand of Sparks", today's stats and description "Spits stinging sparks.".
   - Today's descriptions to keep: longsword "A well-balanced blade.", dagger "Short, light and quick.", shortsword "A handy stabbing blade.", battle axe "A heavy head on a long haft.", greatsword "A blade as tall as its wielder.", bow "Strikes from across the field.", shield "Iron-banded oak shield.", breastplate "Sturdy plate armor.".
   - `WEAPONS` is the six of C1; `MAGIC_ITEMS` drops `SPARK_WAND`.
   - Move or keep the comment about weapons trading damage against AP beside the catalog's weapon rows.
   - `itemById` follows C2:
     - resolve aliases via `LEGACY_ALIASES` before building;
     - cache both the requested id and the canonical id to the same object, so one id is always one object;
     - return `undefined` for each malformed case listed in C2;
     - check a modifier by `MODIFIERS[modId].fits.includes(base.family)`.
   - `baseItem` resolves through the plain items by id (`item.base ?? item.id`), aliases included if given an alias id.
   - Update the doc comments that describe the grammar.
3. **`src/inventory/grades.ts`.** Implement C3: `gradedStats(stats, grade, cls)` by class, `GRADE_DEFS` gains `small`, and `gradedItem` passes `gearClass(base.slot)`. A graded or modified item keeps `family`, `material` and `tier` through its spread. Update the module comment ("a grade adds damage to a weapon, armour class to a shield or a small-slot item, and resistance to body armour").
4. **`src/inventory/modifiers.ts`.**
   - Apply C4: `fits` becomes family ids with the four new fits, and `modifiersFor(family: FamilyId)`.
   - Update callers: `src/game/crafting.ts` (`itemRefusal` and the options, by `baseItem(item).family`) and any test.
   - `craftCost` asks timber when the item's family is of kind `wood`, else iron.
5. **`src/game/tradingPost.ts`.**
   - Apply C5: `PRICES` by `FamilyId`, `TIER_PRICE`, and `buyPrice` from `family`, `tier` and `grade` (null for an item without a `family`, so enchanted).
   - `VALUES` loses `spark_wand`.
   - `wares(world)` lists tier-1 base items at grades up to `world.tradingPost`, plain first as today. The signature stays `wares(world)` in this step (step 06 adds the filter).
   - `buyRefusal` refuses a tier-2 item ("The trading post does not sell that." is acceptable until step 06 words it).
6. **Renames (correction 1) and the wand (correction 18).** Replace `STEEL_ARMOR` with `IRON_BREASTPLATE` and `STEEL_GREATSWORD` with `IRON_GREATSWORD` in every importer:
   - `src/character/character.ts`: imports; `createCharacter` dresses in `IRON_BREASTPLATE`; update its doc comment "in a steel breastplate".
   - `src/game/bandits.ts`: `GEAR`. Remove `atGrade`'s `SPARK_WAND` special case (every bandit item is now plain, so `gradedItem` applies to all) and update its comments.
   - `src/game/worldMap.ts`: its `SPARK_WAND` loot import still works, the constant now being plain.
   - Every test that names them.
   - Search `e2e/` too (`manual.shots.ts` uses `iron_sword@2`, which is unchanged).

   The bandits' hero-twin test must still pass. Update `bandits.test.ts`'s `GEAR` and its comment that the wand is never graded.
7. **`src/game/blight.ts`.** Nothing to change: it draws from `MAGIC_ITEMS`, now eight items. Check that `blight.test.ts`'s captured spawn table (which records loot) still passes. If it captured a Wand of Sparks as loot, its expectation changes by the item only (same draws). Update it and say so in the record.
8. **Scene tables (C6).**
   - `ITEM_ICON_KEYS` gains the 19 `icon_<icon>` keys.
   - `GEAR_SPRITES` gains the ten held ones; `SWUNG_GEAR` gains `gear_rapier`, `gear_mace`, `gear_spear`, `gear_war_hammer`, `gear_halberd` and `gear_staff`.
   - `WORN_SPRITES` gains `robe: 'gear_robe'`, `leather: 'gear_leather'`, `plate: 'gear_plate'`, `cap: 'gear_cap'` and `helm: 'gear_helm'`.
   - Add `MATERIAL_TINTS` (first colours of the implementer's: a cool blue-grey for steel, a dark brown-grey for ironwood, a grey for wolfhide, a pale violet for silk) and `iconTint(item)` (`MATERIAL_TINTS[item.material]` when the item's tier is 2, else undefined) to `src/scenes/itemIcons.ts`.
   - Do not apply tints in scenes (step 07).
   - The scenes load one icon per `ItemIcon` from `ITEM_ICON_KEYS`, so check that each new key's PNG exists in `public/assets/sprites/`.
9. **`src/scenes/unitLook.test.ts`.**
   - The held check covers `[...BASE_ITEMS, ...MAGIC_ITEMS]` held items (C6).
   - Fix its imports for the renames.
   - The test "dresses a graded breastplate as the plain one" may keep `itemById('steel_armor@2')` (an alias) or use `iron_breastplate@2`; prefer the canonical id and keep a separate alias assertion in `catalog.test.ts`.
10. **`scripts/simulate.ts`.**
    - `PREFERRED_MODIFIERS: Readonly<Partial<Record<FamilyId, readonly ModifierId[]>>>` is keyed by family with today's lists: dagger [keen], shortsword [keen, balanced], longsword [light, balanced, keen], battle_axe [light, bearded], greatsword [balanced], bow [recurve, long], shield [braced], breastplate [reinforced].
    - New families get none in this step. Step 10 may add spear, mace, crossbow and leather if a cell shows a use, but the ready-made party never holds them.
    - `modifierRank` and `craftGear` look up by `base.family`.
    - The `--player-weapon` help text example stays valid.
    - Update `scripts/simulate.test.ts` for the new keys.
11. **`src/scenes/debugCommands.ts`.**
    - The `items` command lists `BASE_ITEMS` and `MAGIC_ITEMS` (now 56 + 8). Keep it, and widen the id column if 18 characters is too narrow for the longest base id (`steel_tower_shield`, `iron_tower_shield` and `wolfhide_leather` are near it; measure).
    - The `give` example `iron_sword@2+light1` stays.
12. **`src/game/save.ts`.** `SAVE_VERSION` 15 → 16. Items are already saved as ids, so the format code needs no other change. A save test that asserts the version, or round-trips items, is updated. Add one round-trip case with a tier-2 graded, modified item (`steel_longsword@2+light1`) if `save.test.ts` has a place for it.
13. **CLAUDE.md.** Rewrite the lines this step makes wrong:
    - the `src/character/ and src/inventory/` bullet (the catalog, families and tiers, the id grammar with material, aliases, `BASE_ITEMS` generated, the wand plain, "no grade or modifier touches maximum hit points");
    - the `bandits.ts` bullet ("the wand, an enchanted item, takes no grade");
    - "Rules of creation" ("wears a steel breastplate" → an iron breastplate);
    - "Rules of the encampment's gear" (grades by class, small slots);
    - the trading post bullet (prices by family and tier);
    - the `GEAR_SPRITES`/`WORN_SPRITES` assets line if it enumerates;
    - add `catalog.ts` with one line.

    Do not describe derivation (step 05) or the trading post's level 4 (step 06). The manual's pass is step 10's; do not edit `docs/manual/` here.
14. **Out of scope:**
    - `deriveCombatStats`, `weaponSkill`, the engine, policies and battle effects (step 05);
    - trading post level 4, `sells` and the filter (step 06);
    - `gearCompare.ts`, the tooltip's caller passing strength, and tints in scenes (step 07);
    - bandit tiers and the Crossbowman (step 09);
    - any balance tuning.

## 6. Verification

- **New `src/inventory/catalog.test.ts`:**
  - **Every family × tier builds:** each of the 56 `BASE_ITEMS` has its `family`, `material`, `tier`, `slot` and icon from the tables; its name is "<Material> <Name>" or the `tier1` name; its stats are the family's plus `TIER_BONUS[gearClass(slot)][tier]`. Spot-check exact values:
    - `steel_longsword` damage 1d8+5, AP 5, pierce 1;
    - `steel_breastplate` AC 12, resistance 3;
    - `ironwood_shield` AC 12;
    - `steel_helm` AC 3, resistance 1;
    - `silk_robe` AC 2, resistance 1, mana 6, spell skill 5;
    - `steel_tower_shield` AC 18, resistance 1, apPenalty 1, strength 6.
  - **Legacy equality (A2):** `iron_sword`, `iron_dagger`, `iron_shortsword`, `iron_battle_axe`, `iron_greatsword`, `yew_bow`, `oak_shield`, `iron_breastplate` and `spark_wand` have exactly today's literal stats and names (written out in the test, not read from the module). The exceptions are the renamed two's names and ids, and the Q1-answered fields (see §2).
  - **Round-trips:** for every base item, every grade, and every fitting modifier at every grade, `itemById(id)!.id === id`, and `itemById(id) === itemById(id)`.
  - **Aliases:** `itemById('steel_armor') === itemById('iron_breastplate')`, and `itemById('steel_armor@2+reinforced1')!.id === 'iron_breastplate@2+reinforced1'`. `itemById('steel_greatsword')` is the tier-2 greatsword (damage 2d6+5).
  - **Malformed:** `undefined` for `iron_longsword`, `yew_shield`, `yew_wand`, `yew_staff`, `leather_leather`, `iron_bow`, `yew_longsword`, `mithril_longsword`, `iron_pike`, `storm_wand@2`, `iron_sword+recurve1`, `iron_sword@4` and `steel_longsword+bearded1`.
  - `BASE_ITEMS.length === 56`; `WEAPONS` is the six in order; `MAGIC_ITEMS` has eight and no `spark_wand`.
  - `strengthShortfall(3, { strength: 6 }) === 3`, `strengthShortfall(7, { strength: 6 }) === 0`, `strengthShortfall(3, undefined) === 0`.
  - `describeItemStats` gives each new line of the words table, the shortfall line with and without `wearerStrength`, and `Spell Skill: −15%` / `+5%`.
- **`src/inventory/grades.test.ts`:**
  - each class at Fine and Masterwork (C3);
  - the tower shield gains armour class, not resistance;
  - the robe gains resistance from 0;
  - gloves and a cap gain AC +1/+2;
  - today's eight grade exactly as before (the existing expectations).
- **Modifiers** (in `catalog.test.ts` or a `modifiers.test.ts`):
  - `modifiersFor('spear')` is [balanced], `mace` [bearded], `crossbow` [long] and `leather` [reinforced];
  - `itemById('steel_spear+balanced2')` builds, and so does `steel_crossbow@3+long1`;
  - `craftCost(itemById('yew_crossbow')!, 1)` asks timber; `craftCost(itemById('leather_armor')!, 1)` asks iron.
- **`src/game/tradingPost.test.ts`:**
  - every `BASE_ITEMS` item has a finite, positive whole price;
  - `buyPrice(steel_longsword) === 30`, `buyPrice(steel_longsword@3) === 240`, `buyPrice(spark_wand) === 30`, `salePrice(spark_wand) === 15`, `buyPrice(storm_wand) === null`;
  - `wares` at levels 1 to 3 lists only tier 1, every family, grades up to the level;
  - buying a tier-2 item is refused.
- **Existing suites** (`bandits.test.ts`, `character.test.ts`, `creation`, `crafting.test.ts`, `save.test.ts`, `blight.test.ts`, `unitLook.test.ts`, `scripts/simulate.test.ts` and the scene smoke tests) pass after the renames.
- **The gate:** `PATH=/opt/homebrew/opt/node@26/bin:$PATH npm test` passes. `npm run test:browser` passes, the encampment and character tests at least, so that the new icons load without a missing-texture warning.
- **The checkpoint** (the guard command, against step 01's verbatim summary):
  1. Run `npm run simulate -- --campaign --ready-level 7 --battles 500 --seed 1` and record the summary: the guard, days, battles, heroes dead, gold spent on gear.
  2. A **scratch** run in which `visitFacilities` skips buying for an item of family `wand` (an edit you revert, never committed) must print a summary **identical** to step 01's. This proves that the only move is the mage's wand. If it is not identical, find the cause before committing (a renamed key in `PREFERRED_MODIFIERS`, a price, a changed grade rule or the alias are the usual suspects).
  3. Under Q1 (b), also record the run with the breastplate's values, and say how much they move it.

## 7. Completion criteria

- [ ] `catalog.ts` with C1 exactly; `Item`/`ItemStats` fields, `strengthShortfall`, `SHORTFALL_TO_HIT` and the tooltip words; `itemById` per C2; grades per C3; modifiers per C4; prices per C5; tables per C6.
- [ ] The renames done everywhere; the wand plain; `bandits.ts`'s special case gone.
- [ ] `PREFERRED_MODIFIERS` keyed by family.
- [ ] `SAVE_VERSION` 16.
- [ ] Q1's answer applied to the three rows, and named in the record.
- [ ] The new and changed tests pass; `npm test` passes; the in-browser tests checked.
- [ ] The checkpoint recorded: the guard, and the scratch run identical to step 01.
- [ ] CLAUDE.md lines fixed; a search for every renamed or deleted name comes up clean.
- [ ] Committed on `long-campaign-stage-03` without pushing, the message ending with the `Co-Authored-By` line; the index's step 04 row set to `done` with the commit.

## Execution record

Commit `__SHA__` on `long-campaign-stage-03` (Node 26). Q1 was answered (b): `battle_axe` strength 5, `greatsword` strength 6, `breastplate` strength 4 and spell skill −5, as written in `catalog.ts`; the legacy-equality test in `catalog.test.ts` names those additions.

**Built:** `src/inventory/catalog.ts` (C1, with helpers `familyById` and `tierStats`); `ItemStats.strength`/`apPenalty`/`reach`/`rangedPierce`, `Item.family`/`material`/`tier`, `SHORTFALL_TO_HIT`, `strengthShortfall`, the new `describeItemStats` lines (spell skill signed); `BASE_ITEMS` generated (56), the named constants lookups of it, `WEAPONS` the six, `MAGIC_ITEMS` eight; `itemById` per C2 with `LEGACY_ALIASES` (aliases cached to the canonical object; `Object.hasOwn` so `constructor` and the like are no alias); grades by class (C3, `GRADE_DEFS.small`); modifiers by family (C4); `PRICES` by family, `TIER_PRICE`, `wares` tier 1 only, tier 2 refused (C5); `ITEM_ICON_KEYS` +19, `GEAR_SPRITES` +10, `SWUNG_GEAR` +6, `WORN_SPRITES` +5, `MATERIAL_TINTS` (pale: steel `0xc8d8f0`, ironwood `0xd8c8b8`, wolfhide `0xd0d0d0`, silk `0xe8d8f8`, after step 03's warning that dark tints muddy) and `iconTint`; renames everywhere; `bandits.ts`'s wand special case gone; `PREFERRED_MODIFIERS` by family; `SAVE_VERSION` 16; CLAUDE.md (the inventory bullet with `catalog.ts`, the bandit, trading post, encampment-gear, creation and assets lines). The debug `items` column (`padEnd(18)`) fits the longest id, `steel_tower_shield` (18), as it is followed by a space.

**Tests:** new `src/inventory/catalog.test.ts` and `src/scenes/itemIcons.test.ts` (every item's icon PNG exists; tints); additions to `grades.test.ts`, `tradingPost.test.ts`, `inventory.test.ts`, `save.test.ts` (a `steel_longsword@2+light1` round trip), `scripts/simulate.test.ts`. Expectations changed deliberately:
- `blight.test.ts` spawn table: the same places, kinds and draws; the loot names change as `MAGIC_ITEMS` has eight items (seed 2 Ring of Protection → Ring of Fortune; seed 3 Wand of Storms, Wand of Sparks → Emberblade, Wand of Storms; seed 4 Wand of Sparks → Wand of Storms).
- `character.test.ts` (a caster's spell skill 8 → 3, 22 → 17) and `party.test.ts` (Delwyn 63 → 58): the breastplate's spell skill −5 (Q1 b). `deriveCombatStats` already summed worn spell skill, so this part of Q1 takes effect now, not at step 05.
- `grades.test.ts`'s refusal list: `spark_wand@2` is now an item, so `storm_wand@2` stands in; `crafting.test.ts` and `tradingPost.test.ts` use the Wand of Storms as the enchanted wand (it sells for 25).

**Commands:** `npm test` 1016 passed (997 at baseline); `npm run test:browser -- -t "encampment|character|trading"` 8 passed; full `npm run test:browser` 79 passed.

**Checkpoint** (the guard command with `--out` per run; seed 1, 500 campaigns):

| Run | Code | Source | Days | Battles | Heroes dead | Gold on gear |
| --- | --- | --- | --- | --- | --- | --- |
| step 01 | baseline | 248 | 274 | 18.7 | 1.7 | 2 |
| A (committed) | Q1 (b), wand buyable | **231** | 269 | 18.2 | 1.8 | 2 |
| B (scratch) | Q1 values out, wand skipped | 248, **identical to step 01** line for line (run with step 01's `--out` path) | 274 | 18.7 | 1.7 | 2 |
| C (scratch) | Q1 (b), wand skipped | 231, identical to A | 269 | 18.2 | 1.8 | 2 |

So the wand moves nothing (the simulator's mage never affords a Fine wand: the post averages level 1.1 and 2 gold goes on gear a campaign), and the whole fall of 17 is the breastplate's spell skill −5 on the ready-made mage (Q1 b). Threat 5 won 1349 of 1508 (0.895) against 1416 of 1573; threat 3 0.968 against 0.973. Run A's summary, verbatim:

```
Simulated 500 campaigns, 9107 battles in all (seed 1, player aggressive vs enemy aggressive) -> logs/s3-step04-guard.jsonl
Beat the Source: 231 of 500 (46.2%); party fell: 269 (53.8%); encampment lost: 0 (0.0%); out of days: 0
A campaign: 269 days, 18.2 battles, 26.0 spawns, 3.1 sites captured and 0.1 lost, 38% of the land blighted at the end
Watchtowers: 1.8 built a campaign, 0.0 lost
Shrine: level 1.0 at the end; outposts: 0.5 built a campaign
Trading post, workshop, infirmary: levels 1.1, 0.6, 0.5 at the end; 2 gold on gear and 53 from sales, 4.4 items crafted (2.7 days in the field) a campaign
Guild hall: level 2.4 at the end, 2.1 recruits and 1.8 heroes dead a campaign
Hit points healed between battles: 130.9 a campaign, in 22.0 days of camping
Levels at the end: lowest 6.7, highest 7.2 on average (ready level 7); heroes died at level 2 (35), 3 (190), 4 (38), 5 (114), 6 (17), 7 (260), 8 (220), 9 (24)
Battles to level 5: 6.8 (412 campaigns); 10: — (0 campaigns); 15: — (0 campaigns); 20: — (0 campaigns)
┌─────────┬────────┬─────────┬──────┬─────────┐
│ (index) │ threat │ battles │ won  │ winRate │
├─────────┼────────┼─────────┼──────┼─────────┤
│ 0       │ 1      │ 1007    │ 1007 │ 1       │
│ 1       │ 2      │ 1756    │ 1732 │ 0.986   │
│ 2       │ 3      │ 1991    │ 1928 │ 0.968   │
│ 3       │ 4      │ 2845    │ 2822 │ 0.992   │
│ 4       │ 5      │ 1508    │ 1349 │ 0.895   │
└─────────┴────────┴─────────┴──────┴─────────┘
┌───────────────────────┬──────────────────────┐
│ (index)               │ Values               │
├───────────────────────┼──────────────────────┤
│ battles               │ 9107                 │
│ playerWins            │ 8838                 │
│ enemyWins             │ 269                  │
│ unresolved            │ 0                    │
│ avgRounds             │ 5.023937630394202    │
│ avgPlayerDamageDealt  │ 98.18710881739321    │
│ avgEnemyDamageDealt   │ 28.930712638629625   │
│ playerHitRate         │ 0.666345836146586    │
│ enemyHitRate          │ 0.6012084592145015   │
│ playerCritRate        │ 0.04446136386490641  │
│ enemyCritRate         │ 0.04871433366901645  │
│ avgOpportunityAttacks │ 0                    │
│ avgSideAttacks        │ 1.216207313055891    │
│ avgRearAttacks        │ 0.16009662896672888  │
│ avgPlayerCasts        │ 4.747227407488745    │
│ avgEnemyCasts         │ 2.1565828483584055   │
│ avgPlayerAreaAttacks  │ 0                    │
│ avgEnemyAreaAttacks   │ 0.024706269902272978 │
│ avgPlayerHealing      │ 2.4552542000658835   │
│ avgEnemyHealing       │ 6.626990227297683    │
│ avgPlayerStatuses     │ 2.932030306357747    │
│ avgEnemyStatuses      │ 0.7785220160316241   │
└───────────────────────┴──────────────────────┘
```

**Deviations:**
- The plan's modifier check `itemById('steel_crossbow@3+long1')` cannot build: the crossbow is a wood family (C1), so its tier 2 is `ironwood_crossbow`. The test asserts `steel_crossbow@3+long1` is undefined and `ironwood_crossbow@3+long1` builds.
- The legacy-equality test reads the expected stats from literals, with Q1's additions written in, as §2 said.
- Not strictly red-first: the catalog test was written before the code but run first against the finished catalog.

**For later steps:**
- **Step 05's checkpoint is amended** (here, in the index and in step 05 §5): under Q1 (b) step 05 moves the guard again, since the breastplate's strength 4 costs the strength-3 archer and mage 5 to hit. Its scratch run, with the breastplate's `strength` removed, must equal run A (231).
- `catalog.ts` exports `familyById` and `tierStats` besides C1. `modifiersFor` takes a `FamilyId`; callers pass `baseItem(item).family!`.
- Step 10 judges the fall to 231; the breastplate's spell skill is the lever (C, against B).
