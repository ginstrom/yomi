# Step 03: Runes and ids

[Plan index](index.md) · [Stage design](../../designs/long-campaign/stage-04-runes.md) (§2 "Runes and sockets", "New stats"; S4-R1, S4-R2) · [Reference](../../designs/long-campaign/reference/gear-and-runes.md) §4.4, §5.1, §5.2 · [Stages index](../../designs/long-campaign/index.md)

**Difficulty:** judgement-heavy (the item model and id grammar every later step builds on). Engineer and reviewer on the session's model (opus).

## 1. Objective

Make runes exist as data and make items carry them:
- a new `src/inventory/runes.ts` with the ten runes, four ranks, their effects by slot class, sockets and the pouch helpers (contract C1);
- the `OnHit` type and two new `CombatantStats` fields in `combat.ts`, types and `sameCombatStats` only (C2);
- `ItemStats.wards`, `onHit` and `maxHp`, and `Item.runes` and `sockets` (C2);
- the id grammar's `#<rune>(.<rune>)*` part, built by `itemById`, with runed names, `withRunes`, `unruned` and `craftedItem` keeping runes;
- the sockets of the three unique items that have them;
- the tooltip's words for the new stats.

Nothing derives or resolves the new stats yet: step 04 derives wards, `onHit` and `maxHp`; step 05 resolves on-hit effects in battle. So the guard must be **identical** to step 01's.

## 2. Requirements and context

- **S4-R1:** sockets by tier, grade and unique; ids with runes. **S4-R2:** ten runes at four ranks, with effects by slot class (reference §4.4).
- **Sockets** (reference §4.4, stage §2): tier 1 has 0, tier 2 has 1; Masterwork (grade 3) adds 1; at most 3; a small-slot item (head, gloves, boots) at most 1. Unique items name their own: the Emberblade 1, the Wand of Storms 1, the Hawkeye Bow 1, and 0 for the rest. So a tier-1 Masterwork longsword (`iron_sword@3`) has one socket, a tier-2 Masterwork one two.
- **Rank names:** "Lesser Ember Rune", "Ember Rune", "Greater Ember Rune", "Grand Ember Rune" (`RANK_NAMES`).
- **Corrections from the index this step carries out:**
  - **1. Runes sit compact in their sockets.** The runes are written in socket order and an empty socket is never written, so filled sockets are always the first. (`embed`, `extract` and `fuse` are step 06; this step only makes the ids and `withRunes` that they use.)
  - **2. On-hit bonus damage is flat and draws nothing.** `OnHit.damage` is a flat number. Nothing in this step draws from any RNG.
  - **3 (the type only).** `CombatantStats` gains `blightborn?: true`, and `baneApplies(stats)` is `(stats.regeneration ?? 0) > 0 || stats.blightborn === true`. Setting it on `BLIGHT_HORROR_STATS` is step 05's.
  - **7. A Mind rune fits a weapon only if the weapon strikes with Magic** (`stats.skill === 'magic'`: a wand or a staff). Anywhere else `runeFits` is false and `itemById` returns undefined for such an id.
  - **10. Rank numerals go to IV.** `gradeNumeral` stops at III, so `rankNumeral` gives I to IV. Names read "Masterwork Iron Longsword ⟨Ember I⟩", and several runes "⟨Ember I, Storm II⟩".
  - **15. A runed plain item carries `base`.** A runed item keeps every field of the item it was made from (`family`, `material`, `tier`, `grade`, `mod`). A plain one gets `base` set to its plain id even at grade 1 (`unruned.base ?? unruned.id`), so `baseItem` still finds it. An enchanted one has no `base`, so `baseItem` stays null. `unruned(item)` gives the item without runes. Crafting a modifier onto a runed item keeps the runes (`craftedItem` gains a `runes` argument).
  - **17 (quoting).** Wherever an id with `#` goes on a command line (`--player-weapon`, the debug console is fine), quote it: `'iron_sword@3#ember1'`.
- **Existing code** (inspected at `7d32a0a`):
  - `src/inventory/inventory.ts`: `ItemStats`, `Item`, `describeItemStats`, `BASE_ITEMS`, the enchanted items (`STORM_WAND`, `EMBERBLADE`, `HAWK_BOW`, …), `ID_GRAMMAR = /^([a-z_]+)(?:@([23]))?(?:\+([a-z]+)([123]))?$/`, `itemById` (with the `BUILT` cache and `LEGACY_ALIASES`, resolved by replacing the base id and recursing), `baseItem`, `unmodified`, `craftedItem(base, grade, mod?)`.
  - `src/inventory/catalog.ts`: `Tier`, `gearClass` (`'weapon' | 'shield' | 'armour' | 'small'`), `LEGACY_ALIASES`. Its header notes that catalog.ts and inventory.ts import each other and neither calls the other as it loads; runes.ts joins that rule.
  - `src/inventory/grades.ts`: `Grade`, `gradeNumeral` (I to III), `gradedItem`.
  - `src/inventory/modifiers.ts`: `modifiedItem` sets `base: graded.base ?? graded.id`.
  - `src/combat/combat.ts`: `ELEMENTS`, `Element`, `CombatantStats` (already has `wards` and `regeneration`), `sameCombatStats`, `warded`. It already imports types from `spells.ts`, where `StatusLaid` lives (`{ id: StatusId; turns: number; images?: number }`).
  - `src/game/crafting.ts` `options()`: `result: craftedItem(base, item.grade ?? 1, { id: modifier.id, grade })`, which today drops nothing because no item has runes; with runes it must pass `item.runes`.
  - `src/combat/spells.ts` `STATUSES`: `seared` (stops regeneration), `chilled`, `poisoned` exist with names for the words.
- **Shared constraints (from the index):**
  - `npm test` (`tsc && vitest run`) passes before the commit (local Node 26: `PATH=/opt/homebrew/opt/node@26/bin:$PATH`, or `make test`). `tsc` is the lint: `noUnusedLocals`, `erasableSyntaxOnly` (no enums), `verbatimModuleSyntax` (`import type` for types), explicit `.ts` import extensions.
  - Tests: `src/**/*.test.ts` run in the Node `domain` project.
  - Determinism: no step adds, drops or reorders a draw of the battle or world RNG.
  - One commit for this step on `long-campaign-stage-04`, without pushing; never switch branches; the message ends with the repo's `Co-Authored-By` attribution line.
  - CLAUDE.md stays current: update the lines this step makes wrong (below).
  - No version bump here: `SAVE_VERSION` goes to 18 in step 04 and `LOG_SCHEMA_VERSION` to 23 in step 05.

## 3. Dependencies and prerequisites

- **Step 01** is done: its guard summary, in its execution record, is what this step's run must equal.
- **Not needed:** step 02's art (the icons are wired in step 08).
- **Consumed by later steps:**
  - step 04 derives `wards`, `onHit` and `maxHp` from the item stats, and saves ids with runes;
  - step 05 resolves `OnHit` in the engine and sets `blightborn` on the Horror;
  - step 06 calls `withRunes`, `unruned`, `socketsOf`, `runeFits` and the pouch helpers;
  - step 07 prices runes (`RuneKey`, `Rank`, `unruned`);
  - steps 08 and 09 show `socketLines`, `runeName`, `runeLabel` and draw pips from `item.runes` and `socketsOf`;
  - step 10 uses `RUNE_IDS`, `SlotClass` and `slotClass`.

## 4. Contracts (copied unchanged from the index)

### C1. Runes (step 03)

```ts
// src/inventory/runes.ts (new). Plain data and functions, called by nothing of inventory.ts as it loads.
import type { Element, OnHit } from '../combat/combat.ts'
export const RUNE_IDS = ['ember', 'rime', 'storm', 'venom', 'acid', 'stone', 'wind', 'life', 'mind', 'dawn'] as const
export type RuneId = (typeof RUNE_IDS)[number]
export type Rank = 1 | 2 | 3 | 4
export const RANKS: readonly Rank[]                       // [1, 2, 3, 4]
export const MAX_RANK: Rank                               // 4
export type RuneKey = `${RuneId}${Rank}`                  // 'ember1', 'storm2'
/** How a rune acts by where it sits: mainHand a weapon, offHand a shield, every other slot armour. */
export type SlotClass = 'weapon' | 'shield' | 'armour'
export function slotClass(slot: EquipmentSlot): SlotClass
export interface RuneDef {
  id: RuneId
  name: string                                            // 'Ember'
  /** The element of its weapon bonus and its ward; none for Stone, Wind, Life, Mind. */
  element?: Element
  effect: Record<SlotClass, (rank: Rank) => ItemStats>
  /** One short line of what it does there at a rank: "+1 fire on a hit", "Frost ward 2". */
  describe: Record<SlotClass, (rank: Rank) => string>
}
export const RUNES: Record<RuneId, RuneDef>
export const RANK_NAMES: Record<Rank, string>             // { 1: 'Lesser ', 2: '', 3: 'Greater ', 4: 'Grand ' }
export function rankNumeral(rank: Rank): string           // 'I' to 'IV'
export function runeKey(id: RuneId, rank: Rank): RuneKey
export function parseRuneKey(text: string): { id: RuneId; rank: Rank } | null
export function isRuneKey(text: string): text is RuneKey
export function runeName(key: RuneKey): string            // 'Lesser Ember Rune', 'Storm Rune', 'Grand Stone Rune'
export function runeLabel(key: RuneKey): string           // 'Ember I', as in an item's name
export function runeStats(rune: RuneId, rank: Rank, cls: SlotClass): ItemStats
/** Sockets: by tier (SOCKETS_BY_TIER), +1 at Masterwork, at most MAX_SOCKETS, a small slot (head, gloves, boots) at most 1; an enchanted item its own `sockets`, else 0. Of the unruned item. */
export function socketsOf(item: Item): number
export const SOCKETS_BY_TIER: Record<Tier, number>       // { 1: 0, 2: 1 }
export const MAX_SOCKETS = 3
/** Whether `rune` may sit in `item`: false for Mind in a weapon whose stats do not strike with Magic (correction 7), true otherwise. */
export function runeFits(rune: RuneId, item: Item): boolean
/** The tooltip's socket lines: "Sockets: 1 of 2", then one line a rune, "Ember I: +1 fire on a hit". Empty for an item with no sockets. */
export function socketLines(item: Item): string[]
/** The party's rune pouch: a count for each rune key held; a key at 0 is left out. */
export type Pouch = Partial<Record<RuneKey, number>>
export function pouchCount(pouch: Pouch, key: RuneKey): number
export function addToPouch(pouch: Pouch, key: RuneKey, n?: number): void          // n defaults to 1
export function takeFromPouch(pouch: Pouch, key: RuneKey, n?: number): boolean    // false, and nothing taken, if fewer
/** The keys held, in RUNE_IDS order then rank. */
export function pouchKeys(pouch: Pouch): RuneKey[]
```

**The runes** (rank 1 / 2 / 3 / 4). A number adds to the field. "Ward" is `wards: { [element]: n }`. An on-hit entry is an `OnHit` (C2).

| Rune | Element | Weapon (mainHand) | Armour (every slot but mainHand and offHand) | Shield (offHand) |
| --- | --- | --- | --- | --- |
| `ember` | fire | onHit `{ damage: 1/2/3/5, element: 'fire' }`, from rank 3 with `status: { id: 'seared', turns: 1 }` | fire ward 2/4/6/9 | as armour |
| `rime` | frost | onHit `{ damage: 1/2/3/5, element: 'frost' }`, from rank 3 with `status: { id: 'chilled', turns: 1 }, onCrit: true` | frost ward 2/4/6/9 | as armour |
| `storm` | lightning | `toHit` 3/6/9/12 | lightning ward 2/4/6/9 | as armour |
| `venom` | poison | onHit `{ damage: 1/2/3/4, element: 'poison' }`, from rank 2 with `status: { id: 'poisoned', turns: 3 }, onCrit: true` | poison ward 2/4/6/9 | as armour |
| `acid` | acid | `armorPierce` 1/1/2/3 | acid ward 2/4/6/9 | as armour |
| `stone` | none | `damage.bonus` +1/1/2/3 | `resistance` 1/1/2/3 | `acBonus` 3/5/7/10 |
| `wind` | none | `critChance` 3/6/9/12 | `acBonus` 3/5/7/10 | `acBonus` 2/4/6/8 |
| `life` | none | onHit `{ damage: 0, heal: 1/1/2/3 }` | `maxHp` 4/8/12/18 | as armour |
| `mind` | none | `spellSkill` 3/6/9/12 (only in a weapon with `skill: 'magic'`, correction 7) | `maxMana` 3/6/9/12 | as armour |
| `dawn` | blight | onHit `{ damage: 2/3/5/7, element: 'blight', bane: true }` | blight ward 2/4/6/9 | as armour |

- Acid's piercing follows the existing rule: it counts for melee weapons and the crossbow (`rangedPierce`), and not for a bow or a wand.
- Each rune adds its own on-hit entry. Two Ember runes make two entries, each warded on its own (the reference: a ward comes off "each instance of damage").

### C2. The item model and ids (step 03)

```ts
// src/combat/combat.ts (existing file; new type and fields)
/** What a weapon does on a hit besides its dice (runes): flat damage after resistance, warded by its element; a status; healing. Draws nothing. */
export interface OnHit {
  /** Flat damage added after resistance, less the defender's ward of `element`; 0 for an effect that only heals or lays. */
  damage: number
  element?: Element
  /** Only against a unit with regeneration or `blightborn` (the Dawn rune). */
  bane?: true
  /** Laid on the defender after all the damage, if it still stands: on every hit, or with `onCrit` on a critical only. */
  status?: StatusLaid
  onCrit?: true
  /** Hit points the wielder regains on a hit, up to its maximum (Life). */
  heal?: number
}
// CombatantStats gains:
onHit?: readonly OnHit[]           // the main hand's (step 04 derives it; step 05 resolves it)
blightborn?: true                  // the blight's own: a Dawn rune's bane applies (correction 3)
// sameCombatStats compares onHit (deeply, in order) and blightborn.
export function baneApplies(stats: CombatantStats): boolean   // (stats.regeneration ?? 0) > 0 || stats.blightborn === true
```

```ts
// src/inventory/inventory.ts (existing file)
// ItemStats gains:
/** Points off each instance of damage of an element its wearer takes (runes). */
wards?: Partial<Record<Element, number>>
/** What the weapon does on a hit besides its dice; counted from the main hand only. */
onHit?: readonly OnHit[]
/** What the item adds to its wearer's maximum hit points (Life runes); see clampHp. */
maxHp?: number
// Item gains:
/** The runes embedded, in socket order, filled sockets first (correction 1). */
runes?: readonly RuneKey[]
/** On an enchanted item: its sockets (Emberblade, Wand of Storms, Hawkeye Bow 1; the rest none). Plain items' come from socketsOf. */
sockets?: number

/** The item without its runes: itself if it has none. */
export function unruned(item: Item): Item
/** `item` (runed or not) with exactly `runes`: the same object itemById gives for that id; undefined if they do not fit. */
export function withRunes(item: Item, runes: readonly RuneKey[]): Item | undefined
/** As before, with the runes kept (correction 15). */
export function craftedItem(base: Item, grade: Grade, mod?: { id: ModifierId; grade: Grade }, runes?: readonly RuneKey[]): Item
```

**Ids:**

```
<plain>[@<grade>][+<modifier><grade>][#<rune>(.<rune>)*]     a plain item, runes last
<unique>[#<rune>(.<rune>)*]                                  an enchanted item takes runes only
rune = <RuneId><Rank>                                        ember1 … dawn4
```

- Examples: `iron_sword@3#ember1`, `steel_longsword@3+light1#ember2.storm1`, `emberblade#dawn1`.
- `itemById` builds the unruned item as today, then the runes in order. It returns undefined if:
  - the item has more runes than `socketsOf` of the unruned item;
  - a rune does not parse;
  - `runeFits` is false;
  - the `#` part is empty.
- Legacy aliases work with runes: `steel_armor#stone1` builds the same object as `iron_breastplate#stone1`.
- The same runes in another order make another id, and an equal item.

**A runed item** is the unruned item with these changes:
- `id`: the unruned id, then `#` and the keys joined by `.`;
- `name`: `<unruned name> ⟨<runeLabel>, …⟩`, for example "Masterwork Iron Longsword ⟨Ember I⟩";
- `stats`: the unruned stats, then each rune's `runeStats(id, rank, slotClass(slot))` folded in order. Numbers add, a missing field counting 0. `damage.bonus` adds. `wards` add by element. `onHit` entries concatenate;
- `runes`: the keys;
- `base`: `unruned.base ?? unruned.id` for a plain item (correction 15), and absent for an enchanted one;
- every other field as the unruned item's.

**Words.** `describeItemStats` gains:
- one line a ward, `<Element> ward <n>` ("Frost ward 2"), in `ELEMENTS` order;
- `Max HP: +<n>`;
- for each on-hit entry:
  - `On a hit: +<n> <element>`, and for bane `On a hit: +<n> blight to the regenerating and the blighted`;
  - `On a hit: heals <n>`;
  - `On a hit: lays <Status name>`, or `On a critical: lays <Status name>`.

The socket lines are `socketLines` (C1), which the tooltip adds.

## 5. Scope and implementation guidance

### 5.1 `src/inventory/runes.ts` (new)

- Implement C1 exactly: the table of the ten runes is the data. Write it as `RUNES` entries whose `effect` and `describe` functions read a rank ladder (for example a `[1, 2, 3, 5]` tuple indexed by `rank - 1`), not as code per rank.
- `slotClass`: `mainHand` → `'weapon'`, `offHand` → `'shield'`, every other slot → `'armour'` (this is not `gearClass`, which splits off `'small'`; the rune table treats the small slots as armour).
- `socketsOf(item)` works on `unruned(item)`:
  - an item without `family` (enchanted) → `item.sockets ?? 0`;
  - else `SOCKETS_BY_TIER[tier] + (grade === 3 ? 1 : 0)`, capped at `MAX_SOCKETS`, and at 1 for a `gearClass` of `'small'`.
  - Plain items do not store `sockets`; only the enchanted ones carry it.
- `runeFits(rune, item)`: false only for `mind` in a `mainHand` item whose stats lack `skill: 'magic'` (correction 7).
- `socketLines(item)`: `[]` when `socketsOf` is 0; otherwise `Sockets: <filled> of <n>` and one line a rune, `<runeLabel>: <describe[slotClass](rank)>`.
- Pouch helpers: a count of 0 is deleted from the record, never stored; `takeFromPouch` takes nothing when there are fewer than `n`.
- Imports: types from `inventory.ts` (`Item`, `ItemStats`, `EquipmentSlot`), `catalog.ts` (`Tier`, `gearClass`) and `combat.ts` (`Element`, `OnHit`); `StatusLaid` ids as plain data. Nothing runs at module load that calls into `inventory.ts` (the two import each other, as `catalog.ts` and `inventory.ts` already do).

### 5.2 `src/combat/combat.ts` (existing)

- Add `OnHit`, `CombatantStats.onHit` and `blightborn`, and `baneApplies` (C2).
- `sameCombatStats` compares `onHit` deeply and in order (every field of every entry, the status's `id` and `turns` included; absent and empty count as the same) and `blightborn` (absent and false the same).
- Do **not** set `blightborn` on `BLIGHT_HORROR_STATS` here (step 05), and do not touch the engine.

### 5.3 `src/inventory/inventory.ts` (existing)

- `ItemStats` gains `wards`, `onHit` and `maxHp`; `Item` gains `runes` and `sockets` (C2), with the doc comments given.
- **The enchanted items' sockets:** `EMBERBLADE`, `STORM_WAND` and `HAWK_BOW` get `sockets: 1`. The rest get none (left out).
- **The grammar.** Extend `ID_GRAMMAR` with an optional final `#` group, for example `(?:#([a-z]+[1-4](?:\.[a-z]+[1-4])*))?$`, and handle an enchanted id followed by `#` only (`emberblade#dawn1`). Grade and modifier parts on an enchanted id stay undefined, as today.
- **`itemById`:**
  1. Look up `ITEMS_BY_ID` and `BUILT` first, as now.
  2. Split off the `#` part. Build the unruned item from the rest by today's rules (aliases included), then apply the runes.
  3. Return undefined for an empty rune part (`iron_sword@3#`), a key that does not parse, more runes than `socketsOf(unruned)`, or a rune where `runeFits` is false.
  4. Cache the result in `BUILT` under the id asked for, so one id is one object; an alias with runes (`steel_armor#stone1`) gives the same object as its canonical id (`iron_breastplate#stone1`), which carries the canonical id.
- **A runed item** is built as C2's "A runed item" list says: id, name with `⟨…⟩` (the characters U+27E8 and U+27E9) and `rankNumeral`, stats folded rune by rune with `runeStats(id, rank, slotClass(slot))`, `runes`, `base` by correction 15.
  - Folding: numbers add (a missing field counts 0), `damage.bonus` adds when there is a `damage`, `wards` add by element, `onHit` entries concatenate.
  - Write the fold as one small helper (for example `addStats(a, b)`), so step 04's and later readers see one rule.
- **`unruned(item)`**: `item.runes?.length ? itemById(id before '#')! : item`.
- **`withRunes(item, runes)`**: `itemById(unruned(item).id + (runes.length ? '#' + runes.join('.') : ''))`.
- **`craftedItem(base, grade, mod?, runes?)`**: builds the id as now, then appends the runes when given and non-empty.
- **`unmodified(item)`** drops the modifier only, keeping any runes.
- **`baseItem`** needs no change if `base` is set as correction 15 says; check that `baseItem(itemById('iron_sword@3#ember1')!)` is `IRON_SWORD`, and `baseItem(itemById('emberblade#ember1'))` is null.
- **`describeItemStats`** gains the C2 "Words" lines, after today's lines:
  - `<Element> ward <n>` in `ELEMENTS` order, the element capitalised ("Fire ward 2");
  - `Max HP: +<n>`;
  - per on-hit entry, in order: `On a hit: +<n> <element>` (no element: `+<n> damage`), bane: `On a hit: +<n> blight to the regenerating and the blighted`; `On a hit: heals <n>`; `On a hit: lays <Status name>` or `On a critical: lays <Status name>` (the name from `STATUSES`).

### 5.4 `src/game/crafting.ts` (existing)

- In `options()`, pass the item's runes: `craftedItem(base, item.grade ?? 1, { id: modifier.id, grade }, item.runes)`, so a craft keeps the runes (correction 15). Nothing else changes here.
- Check `craftables` and `itemRefusal` still find a runed plain item through `baseItem`.

### 5.5 Elsewhere to check, not to change

- `src/game/save.ts` writes and reads item ids through `itemById`, so runed ids already round-trip; the version bump is step 04's.
- `src/game/tradingPost.ts` `sells`, `buyRefusal` and `salePrice` learn about runes in step 07. No simulated item has runes before step 10, so nothing moves.
- `scripts/simulate.ts` `--player-weapon` uses `itemById`, so `'iron_sword@3#ember1'` is accepted from this step on (it does nothing in battle until step 05).

### 5.6 CLAUDE.md

Update the lines this step makes wrong:
- the `src/inventory/` paragraph: add `runes.ts` (the ten runes, their effects by slot class, sockets, the pouch's helpers), one line;
- the id grammar: `<plain>[@<grade>][+<modifier><grade>][#<rune>(.<rune>)*]`, an enchanted item taking `#` only, and that `itemById` refuses an id with more runes than sockets or a rune that does not fit;
- the sockets rule (by tier, +1 at Masterwork, small slots 1, three uniques 1);
- the `ItemStats` fields (`wards`, `onHit`, `maxHp`), saying that step 04 derives them. Leave the "No item changes maximum hit points" rule for step 04, which changes it with `clampHp`.

### 5.7 Out of scope

- Deriving the new stats (`deriveCombatStats`, `maxHp`, `clampHp`), `GameState.runes`, the save and debug commands: step 04.
- The engine, `blightborn` on the Horror, the log, the policy: step 05.
- Runecraft, loot, prices, scenes, the simulator's policy: steps 06 to 10.

## 6. Verification

1. **`src/inventory/runes.test.ts` (new):**
   - every rune in every slot class at every rank gives exactly C1's table (a table-driven test over all 10 × 3 × 4 cells), including Ember's Seared from rank 3, Rime's Chilled on a critical from rank 3, Venom's Poisoned on a critical from rank 2, Dawn's `bane`, Life's `heal` and `maxHp`, Mind's `spellSkill` and `maxMana`;
   - `runeName` for each rank ("Lesser Ember Rune", "Ember Rune", "Greater Ember Rune", "Grand Ember Rune"), `runeLabel`, `rankNumeral` I to IV, `parseRuneKey` and `isRuneKey` on good and bad keys (`ember0`, `ember5`, `fire1`, `ember`);
   - `socketsOf`: `iron_sword` 0, `iron_sword@2` 0, `iron_sword@3` 1, `steel_longsword` 1, `steel_longsword@3` 2, a small-slot tier-2 Masterwork (`steel_helm@3`) 1, `emberblade` 1, `storm_wand` 1, `hawk_bow` 1, `ring_protection` 0; and a runed item's sockets equal its unruned item's;
   - `runeFits`: Mind in `spark_wand` and `ash_staff@3` true, in `iron_sword@3` false, in armour true;
   - `socketLines` for an empty-socketed and a runed item; the pouch helpers (add, take, refused take, zero deleted, `pouchKeys` order).
2. **`src/inventory/catalog.test.ts` (existing; extend):**
   - round trips: `itemById(id)!.id === id` for `iron_sword@3#ember1`, `steel_longsword@3+light1#ember2.storm1`, `emberblade#dawn1`, `iron_breastplate@3#life1`;
   - the same object twice for one id; an alias with runes (`steel_armor@3#stone1`) is the object of `iron_breastplate@3#stone1`;
   - names: `itemById('iron_sword@3#ember1')!.name === 'Masterwork Iron Longsword ⟨Ember I⟩'`, and two runes "⟨Ember II, Storm I⟩";
   - stats: `iron_sword@3#stone1` has its damage bonus one above `iron_sword@3`; `iron_breastplate@3#rime2` has `wards.frost` 4; `iron_sword@3#ember3` has one `onHit` entry with Seared; two Ember runes give two entries;
   - `base`, `family`, `tier`, `grade`, `mod` kept; `baseItem` of a runed plain item is its plain item, of a runed unique null; `unruned`, `withRunes` (also back to none), `craftedItem` with runes, `unmodified` keeping runes;
   - undefined for: `iron_sword#ember1` (no socket), `iron_sword@3#ember1.storm1` (too many), `iron_sword@3#mind1` (does not fit), `iron_sword@3#`, `iron_sword@3#ember5`, `iron_sword@3#fire1`, `ring_protection#ember1`, `emberblade@2#ember1`.
3. **`src/combat/combat.test.ts` (existing; extend):** `sameCombatStats` tells apart stats differing only in `onHit` (an entry, an order, a status) or in `blightborn`, and treats absent and empty `onHit` as the same; `baneApplies` for regeneration, `blightborn`, and neither.
4. **`src/game/crafting.test.ts` (existing; extend):** crafting a modifier onto a runed item (worn or in the baggage) leaves an item with the same runes and the new modifier.
5. **Tooltip words:** a test of `describeItemStats` for wards, `maxHp` and each kind of on-hit line (in `inventory.test.ts` or `catalog.test.ts`).
6. `PATH=/opt/homebrew/opt/node@26/bin:$PATH npm test` passes.
7. **The guard checkpoint:** `PATH=/opt/homebrew/opt/node@26/bin:$PATH npm run simulate -- --campaign --ready-level 7 --battles 500 --seed 1 --out logs/s4-step03-guard.jsonl`. Its printed summary must be **identical** to step 01's (in step 01's execution record). Any difference is a bug in this step; find it before committing.
8. A smoke check that the simulator takes a runed id: `npm run simulate -- --player-weapon 'iron_sword@3#ember1' --encounter troll_lair --threat 5 --party-level 5 --battles 20 --seed 1 --out logs/s4-step03-smoke.jsonl` runs (its figures equal `'iron_sword@3'`'s, since nothing resolves the rune yet; record both).

## 7. Completion criteria

- [ ] `runes.ts` exists with every export of C1; `combat.ts` and `inventory.ts` have C2's types, fields and functions; the three uniques have `sockets: 1`.
- [ ] `itemById` builds, names and caches runed ids, refuses the malformed and over-socketed ones, and resolves aliases with runes.
- [ ] Crafting keeps runes.
- [ ] The tests of §6 pass, and `npm test` passes.
- [ ] The guard's summary is identical to step 01's (recorded).
- [ ] CLAUDE.md updated as §5.6 says.
- [ ] One commit on `long-campaign-stage-04`; the index's step 03 row set to `done` with the commit, and the execution record below filled.

## Execution record

