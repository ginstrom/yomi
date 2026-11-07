# Implementation plan: long campaign, stage 4 (runes)

Gear gets sockets and the party a rune pouch:
- ten runes (Ember, Rime, Storm, Venom, Acid, Stone, Wind, Life, Mind, Dawn) at four ranks, each doing one thing in a weapon, another in armour and another in a shield;
- sockets by tier and grade (and a count on three unique items), and ids that name the runes (`iron_sword@3#ember1`);
- hero wards, on-hit elemental damage and statuses, and Life's healing and hit points;
- the pouch, saved; runecraft (embed, extract, fuse) at the workshop, and rank-1 embedding in the field;
- rune loot after a win, and runes at the trading post;
- a Runes tab in crafting, a Runes section at the trading post, sockets and runes in tooltips, wards on the character panel, "+3 fire" in battle, rune icons and socket pips;
- the simulator taking rune loot, fusing, buying and embedding, with a record of it.

**Source design:** [`docs/designs/long-campaign/stage-04-runes.md`](../../designs/long-campaign/stage-04-runes.md) (status "ready for planning", committed in `9c740ae`). Its reference is [`reference/gear-and-runes.md`](../../designs/long-campaign/reference/gear-and-runes.md) §4.4, §4.5, §4.6, §5.2, §5.3, §5.6, §5.7 and §5.8 (step 3). The conventions every stage follows are in [`docs/designs/long-campaign/index.md`](../../designs/long-campaign/index.md). The plan was written against commit `7d32a0a` on branch `long-campaign-stage-04` (off `long-campaign-stage-03`). Stage 3's plan ([`../long-campaign-stage-03/`](../long-campaign-stage-03/index.md)) is the model.

## Corrections to the design

The plan follows the stage design except where it contradicts itself or the code, or leaves a name, number or rule open. Where the stage and the reference differ, the stage wins; where either differs from the code, the code wins. These are the only departures; every task file repeats the ones it touches. **Corrections 4, 8 and 11 change what the player sees or how the simulator plays, and are worth the user's eye.**

1. **Runes sit compact in their sockets.** The reference writes the runes in socket order and never writes an empty socket, so the filled sockets are always the first ones. `embed` therefore takes no socket index: it fills the next empty socket. `extract` takes the index of the rune in `item.runes`, and the rest close up. `fuse` takes the rune key being fused from (`fuse(game, 'storm1')` makes a `storm2`), not a kind and a rank.
2. **On-hit bonus damage is flat and draws nothing.** The reference's numbers (+1 / 2 / 3 / 5 fire) are flat. "Rolled on a hit" means "applied only on a hit". So no on-hit effect draws from the battle RNG, and a battle without runes draws exactly as before. `AttackEvent.bonus[].rolled` is the bonus before the ward.
3. **"The blight's own" needs a stat.** The engine knows only `CombatantStats`. `CombatantStats` gains `blightborn?: true`, set on `BLIGHT_HORROR_STATS`. A bane effect (the Dawn rune) applies against a unit whose stats have `regeneration > 0` or `blightborn`. Its element is blight, so a blight ward takes it down.
4. **Life runes break CLAUDE.md's rule that no item changes maximum hit points** (stage 3's correction 7 left this to stage 4). The engine already clamps hit points on an `equip` action. Outside battle, every change to what a character wears now ends with `clampHp(character, maxBefore)`, given the maximum read before the change: `equipFromBackpack`, `unequipToBackpack`, `dropEquipped`, runecraft on a worn item, and the simulator's direct gear writes. **The user's choice (D1, amended in step 03's commit):** when the maximum drops, the hero keeps the same share of its hit points, `hp = min(max, max(1, round(hp × max / maxBefore)))` for `hp > 0`, never above the new maximum and never to 0 from a positive value; so a hero at full health stays at full health, and one at half at about half. **Applied both ways (orchestrator, step 04):** when the maximum rises (Life-runed armour put on) the hero keeps its share too, by the same formula, so taking Life gear off and putting it back leaves `hp` where it was (within rounding) and a full hero stays full. In battle the engine's `equip` still clamps (`hp = min(hp, maxHp)`); the user's rule is for gear taken off outside battle. The rule in CLAUDE.md is rewritten to say this.
5. **The attack event keeps `damage` as the weapon's damage.** `AttackEvent.damage` stays the weapon's damage through resistance. The bonus is in `bonus[]`, so the hit points lost are `damage + Σ bonus[].damage`, and `defenderHpAfter` is what is left after both. On-hit statuses go in a new `onHitStatuses`, and a routine strike's own `status` is unchanged. Code that adds up `damage` (the simulator's tally, the engine's `wake`) uses the total.
6. **Rune prices exist for every kind and rank**, because a sale and an embedded rune's value need one. They are first values: `RUNE_PRICES` 15, 45, 135 and 405 for ranks 1 to 4, whatever the kind. The post still sells only the six kinds at ranks 1 and 2 (stage design §2).
7. **A Mind rune fits a weapon only if the weapon strikes with Magic** (a wand or a staff; the reference: "wands and staves only"). Anywhere else it is refused: `runeFits` is false, `itemById` returns undefined for such an id, and `embed` says why. This avoids a rune that does nothing.
8. **Loot rows.** Only the rows for threats 1 to 7 are used. Threats 1 to 3 roll a 50% chance of one rank-1 rune. Threats 4 to 7, and anything above until stage 9, roll one rune, rank 1 at 70% and otherwise rank 2. **The Source** (threat 5) rolls threat 5's row; the reference's Source row (3 runes of ranks 3 and 4) waits for stage 9 with the rows past threat 7. Following reference §4.5, a nest led by an elemental kind favours its element at 50%: the Salamander Pool favours Ember, the Spider Nest Venom. A battle the debug console's `fight` starts rolls no runes, since CLAUDE.md says such a win takes no loot.
9. **The loot seed.** Runes are drawn from `lootRng(battleSeed)`, a stream of their own (`mulberry32((battleSeed ^ RUNE_LOOT_SALT) >>> 0)`), so the battle's and the enemy's dice are untouched. The game reads the seed from the battle's `battle_start` event, which survives a save and reload in the snapshot's events, so a reloaded battle rolls the same runes. The simulator uses the seed it passes to `fight`.
10. **Rank numerals go to IV.** `gradeNumeral` stops at III, so runes get `rankNumeral` (I to IV) in names: "Masterwork Iron Longsword ⟨Ember I⟩", and several as "⟨Ember I, Storm II⟩".
11. **The simulator's rune policy.**
    - *Order.* Weapons get Ember, then Storm, then Stone; shields and armour get Stone, then Life. The reference puts "the ward of the next ring's dominant element" first for armour, but today's map has no ring with a single element, so that table waits for stage 9.
    - *Where.* It embeds only at a workshop (level 1 or more) on a home visit. It does not embed in the field, which would spend days the same as field crafts.
    - *Fusing and buying.* It fuses whenever three runes match and the workshop allows. It buys rank-1 runes, after gear, only for empty sockets that the pouch cannot fill.
    - *Replacing gear.* Before it replaces a runed item, it extracts the runes if extracting is allowed and affordable. Otherwise they are sold with the item.
12. **The aggressive policy counts the on-hit bonus.** `expectedHarm` adds the chance to hit times the warded, bane-filtered bonus (reference §5.3). The stage design does not list it, but without it an Ember weapon would not change whom a hero strikes. It changes nothing until a unit has `onHit`.
13. **One icon per rune kind; the rank is a numeral.** There are ten rune icons and two socket pips (empty and filled, the filled one tinted with the rune's colour at runtime). The pips need a new `pip` canvas class in `art/sprite-tool.toml`.
14. **The trading post never sells or prices a runed item as a ware.** `sells` and `buyRefusal` refuse an item with runes. `buyPrice` of a runed item is its plain price, with the runes priced on their own. `salePrice` is `floor((item price + Σ RUNE_PRICES of its runes) / 2)`, which is the stage's "an embedded rune adds half its price".
15. **A runed plain item carries `base`.** A runed item keeps every field of the item it was made from (`family`, `material`, `tier`, `grade`, `mod`). A plain one gets `base` set to its plain id even at grade 1, so `baseItem` still finds it; an enchanted one has no `base`, so `baseItem` stays null. `unruned(item)` gives the item without its runes. Crafting a modifier onto a runed item keeps the runes (`craftedItem` gains a `runes` argument).
16. **A field embed reports as a field craft does.** It closes the crafting screen and resumes `World` with `CraftedData` (`crafted.item` is the new item's name, and `events` the day's).
17. **Check 2's party level is 5**, as in stage 3's Troll Lair cell. `--player-weapon` takes the id in quotes, `'iron_sword@3#ember1'`, so that no shell reads the `#`.
18. **Fusing checks the workshop level before the count.** The play script expects a fuse to rank 3 to be refused naming workshop level 4, with only one rank-2 rune in the pouch.
19. **`give` takes rune keys.** The play script's "give them via debug" needs it. `give storm1 3` puts three Lesser Storm Runes in the pouch, and `items` lists the rune keys.

## Scope and shared constraints

- **In:** design S4-R1 to S4-R6 and the simulator line of design §2 (see the requirement map).
- **Out:**
  - fusing to ranks 3 and 4 (stage 10 adds workshop levels 4 and 5; until then the refusal names the level);
  - the loot rows past threat 7, and the Source's own row (stage 9; correction 8);
  - runewords (reference §8.6);
  - trophies and forging (stage 10);
  - the ward-by-ring table in the simulator's policy (stage 9; correction 11).
- **Commands** (local Node 26, prefix `PATH=/opt/homebrew/opt/node@26/bin:$PATH`, or the podman `make` targets):
  - `npm test` (`tsc && vitest run`) is the gate before every commit (`make test` in podman is the same).
  - `npx vitest run --project domain` for quick domain checks; `npx vitest run <file>` for one file.
  - `npm run test:browser -- -t <name>` (or `make test-browser ARGS="-t <name>"`): in-browser tests, after any scene change. Read `e2e/CLAUDE.md` before adding one.
  - The simulator: `npm run simulate -- <flags>` (or `make -s simulate ARGS="<flags>"`). A 500-campaign run takes about a minute and writes about 70 MB under `logs/` (gitignored).
    - Locally, give concurrent runs distinct `--out` files.
    - Never run two `make simulate` at once: both build the same image, and the loser prints nothing.
  - `npm run sprites` and `npm run sprites:check` for art. The `sprite` CLI is on the host.
- **The guard command** (exactly this, so checkpoints compare byte for byte): `npm run simulate -- --campaign --ready-level 7 --battles 500 --seed 1`.
- **Test layout:**
  - `src/**/*.test.ts` and `scripts/**/*.test.ts` run in the Node `domain` project;
  - `src/scenes/*Scene.test.ts` run under jsdom with Phaser (smoke tests);
  - the in-browser tests are in `e2e/`.
- **The early-game guard.** It was 233 of 500 after stage 3. Step 01 re-measures it before any change. A move of more than about 5 points from step 01's figure must be explained in CLAUDE.md's rules of scaling and the stage's notes, or retuned away. Step 11 judges it. The design expects rune loot and Masterwork sockets to lift it a few points at most.
- **Versions:**
  - `SAVE_VERSION` (`src/game/save.ts`, now 17) goes to **18** in step 04 (the pouch, and ids with runes);
  - `LOG_SCHEMA_VERSION` (`src/engine/battleEngine.ts`, now 22) goes to **23** in step 05 (`AttackEvent.bonus`, `healed`, `onHitStatuses`).
- **Determinism.** No step adds, drops or reorders a draw of the battle or world RNG (correction 2). Rune loot draws from its own stream (correction 9). Steps 03, 04, 05, 06 and 07 must leave the guard's summary identical to step 01's, because the simulator neither loots nor embeds runes until step 10.
- **Commits.** One commit per step (art steps commit sources and exports together), once `npm test` passes, on `long-campaign-stage-04`, without pushing. Never switch branches. Messages end with the repo's `Co-Authored-By` attribution line.
- **Docs.** CLAUDE.md must stay current (its "Keeping this file current" section). Each step updates the lines its own change makes wrong. Watch for:
  - the id grammar;
  - "No item changes maximum hit points" (correction 4);
  - `ItemStats`, the trading post's and the workshop's rules, and `takeLoot`;
  - the simulator's flags and record;
  - the module list (`runes.ts`, `runecraft.ts`, `loot.ts`).

  Step 11 does the stage's documentation pass: the manual and its screenshots, the stage design's "Implementation notes", and the stages index's status line.

## Contracts

Every task file copies these unchanged. "Existing" means in the code at `7d32a0a`; "new" means produced by the step named.

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

### C3. Derivation and hit points (step 04)

```ts
// src/character/character.ts (existing file)
// maxHp(character) adds Σ stats.maxHp of every item worn (wornStats: an off-hand item under a two-handed weapon counts for nothing).
// deriveCombatStats adds:
//   wards: summed by element over every item worn; left out when every element is 0
//   onHit: the main hand's stats.onHit, exactly; left out when it has none
/**
 * Keeps hit points within the maximum after a change to what is worn (correction 4, D1 as the user chose):
 * if the maximum changed from `maxBefore` and hp > 0, the hero keeps the same share of its hit points,
 * hp = min(max, max(1, round(hp × max / maxBefore))); otherwise hp = min(hp, max).
 * (Applies to a rise as well as a fall, so an off-and-on swap is reversible. Amended in step 03's commit, recording the user's answer to D1; it was hp = min(hp, maxHp).)
 */
export function clampHp(character: Character, maxBefore: number): void
// equipFromBackpack, unequipToBackpack and dropEquipped read maxHp(character) before the change and end with clampHp(character, before) when they changed anything.
```

### C4. The pouch and the save (step 04)

```ts
// src/game/gameState.ts (existing file)
// GameState gains:
/** The party's rune pouch (runes.ts): runes found, bought and fused, waiting to be embedded or sold. */
runes: Pouch                                                // newGame: {}
```

- `src/game/save.ts`:
  - the pouch is written as is;
  - a load checks that every key `isRuneKey` with a whole count of 1 or more, and is unreadable otherwise;
  - item ids with runes need nothing new (`itemById`);
  - `SAVE_VERSION` goes from 17 to **18**.
- Debug (`src/scenes/debugCommands.ts`):
  - `give <item|rune> [count]` puts an item in the baggage, as now, or, given a rune key, that many runes in the pouch (correction 19);
  - `items` also lists the rune keys and the `#` grammar;
  - a new `runes` command lists the pouch.

### C5. The engine (step 05)

```ts
// src/engine/battleEngine.ts (existing file); LOG_SCHEMA_VERSION 22 → 23
export interface AttackBonus {
  element?: Element
  bane?: true
  /** The on-hit damage before the defender's ward. */
  rolled: number
  /** What came through the ward: max(0, rolled − ward). */
  damage: number
}
// AttackEvent gains:
/** One per on-hit entry with damage that applied (a bane only where baneApplies), on a hit that struck no image; empty otherwise. */
bonus: AttackBonus[]
/** On a hit that struck no image, by a weapon with an on-hit heal: hit points the attacker regained (0 at full health); absent otherwise. */
healed?: number
/** The on-hit statuses laid, as they stand after; absent if none. */
onHitStatuses?: ActiveStatus[]
// `damage` is unchanged: the weapon's damage through resistance (correction 5). The defender loses damage + Σ bonus[].damage.
```

**Order on a hit that strikes no image:**
1. The weapon's damage, as today (the same draws).
2. Each on-hit entry with `damage > 0`, in order, skipping a bane entry unless `baneApplies(defender stats)`. Its damage is `warded(entry.damage, entry.element, defender effective stats)`. A critical does not double it.
3. The defender loses the total.
4. The attacker heals the sum of the entries' `heal`, up to its maximum (`healed`).
5. The routine strike's own status, as today. Then each on-hit status, if the defender still stands: an `onCrit` status only on a critical. They are laid with the existing `layStatus`.
6. Then `imagesSpent`, `wake(target, total)` and `fell`, as today.

- This holds for every attack, free attacks included.
- No step draws from the RNG.
- `BLIGHT_HORROR_STATS` gains `blightborn: true`. `foeAtLevel` keeps it, since it spreads the base.

**The log line** (`formatEvent`): after `for N dmg` and the armour note:
- each bonus with damage > 0 as ` +<damage> <element>`, and ` (warded <w>)` when the ward took some;
- the statuses with the existing laid phrase;
- then `<Attacker> heals <n>.` when `healed > 0`.

For example: "HITS Troll for 8 dmg (armour stops 1) +1 fire, seared."

**The policy** (`src/engine/policies.ts`, `expectedHarm`, correction 12): it adds `hitChance × Σ` of the warded, bane-filtered on-hit damage.

**The simulator's tally** (`scripts/simulate.ts`, `Tally.add`):
- an attack's damage is `damage + Σ bonus[].damage`;
- `healed` counts as the side's healing;
- each on-hit status counts as one of the side's statuses laid.

### C6. Runecraft (step 06)

```ts
// src/game/runecraft.ts (new); follows crafting.ts: refusal strings, ItemPlace, checks everything before changing anything
export const EMBED_GOLD_PER_RANK = 5          // gold × the rune's rank
export const FUSE_GOLD_PER_RANK = 10          // gold × the new rank
export const EXTRACT_GOLD_PER_RANK = 10       // gold × the rune's rank
export const FUSE_COUNT = 3
/** The workshop level that fuses to each rank; 4 and 5 are stage 10's levels, beyond MAX_WORKSHOP_LEVEL (3), so they are always refused for now. */
export const FUSE_LEVELS: Record<2 | 3 | 4, number>     // { 2: 1, 3: 4, 4: 5 }
export const EXTRACT_LEVEL = 2
export function embedCost(key: RuneKey): Stock
export function fuseCost(from: RuneKey): Stock          // the new rank's
export function extractCost(key: RuneKey): Stock
export type RuneResult = { refusal: string } | { refusal: null; item: Item; events: WorldEvent[] }
/** Every item the party has with a socket (allPlaces order), with its sockets. */
export function socketables(game: GameState): Array<{ place: ItemPlace; item: Item; sockets: number }>
export function embedRefusal(game: GameState, place: ItemPlace, key: RuneKey): string | null
/** Takes `key` from the pouch into the item's next empty socket, spending the cost; in the field (rank 1 only) the day passes (passTurn) and its events come back. */
export function embed(game: GameState, place: ItemPlace, key: RuneKey): RuneResult
export function extractRefusal(game: GameState, place: ItemPlace, index: number): string | null
/** Takes the rune at `index` of item.runes back into the pouch, intact, for the fee; the rest close up. No time passes. */
export function extract(game: GameState, place: ItemPlace, index: number): RuneResult
export function fuseRefusal(game: GameState, from: RuneKey): string | null
/** Three of `from` become one of the next rank, in the pouch, for the fee. No time passes. */
export function fuse(game: GameState, from: RuneKey): string | null
```

- **Where.** Each uses `craftTier(world)` (existing, `crafting.ts`).
  - Embedding at a workshop (any level) works for any rank. In the field (`'field'`, which includes the encampment without a workshop), it works for rank 1 only, where `canCamp`, and takes a day.
  - Fusing needs the workshop at `FUSE_LEVELS[new rank]`. It checks the level before the count (correction 18). From rank 4 it is refused: "A Grand rune is the highest rank."
  - Extracting needs the workshop at level 2.
- **The refusals,** each a sentence. The messages are the implementer's, but each must name what is needed:
  - the place is stale (`STALE`);
  - the item has no sockets;
  - its sockets are full ("extract one first"; the reference: overwriting is refused);
  - the rune is not in the pouch, or the pouch holds fewer than three for a fuse;
  - the rune does not fit (`runeFits`);
  - a rank above 1 in the field;
  - nothing can be done here (the field where `canCamp` is false);
  - the workshop's level, named ("Fusing to a Greater rune needs a level 4 workshop.");
  - no rune at that index;
  - the stock cannot afford it.
- After a change to a worn item, `clampHp(wearer, maxBefore)` runs on its wearer (C3), with the maximum read before the change.

### C7. Loot (step 07)

```ts
// src/game/loot.ts (new)
export const RUNE_LOOT_SALT: number                    // a fixed 32-bit constant, e.g. 0x52554e45
/** The rune loot's own stream for a battle (correction 9). */
export function lootRng(battleSeed: number): RNG       // mulberry32((battleSeed ^ RUNE_LOOT_SALT) >>> 0)
/** The element a nest's leader favours, at FAVOURED_CHANCE: { salamander_pool: 'ember', spider_nest: 'venom' }. */
export const FAVOURED_RUNES: Partial<Record<EncounterId, RuneId>>
export const FAVOURED_CHANCE = 0.5
/** The runes a won battle at `threat` against `encounter` yields (correction 8). */
export function rollRunes(threat: number, encounter: EncounterId, rng: RNG): RuneKey[]
/** Rolls the runes of a won battle at a monster location into the game's pouch and returns them. */
export function takeRunes(game: GameState, threat: number, encounter: EncounterId, battleSeed: number): RuneKey[]
```

**The draws, in this order:**
1. At threat 3 or lower, `rng() < 0.5` gives one rune, and otherwise none. At threat 4 or higher there is always one.
2. For each rune:
   - if the encounter has a favoured rune, `rng() < FAVOURED_CHANCE` takes it;
   - otherwise the kind is `RUNE_IDS[Math.floor(rng() * 10)]`;
   - at threat 4 or higher, `rng() < 0.7` gives rank 1, and otherwise rank 2. At threat 3 or lower the rank is 1, with no draw.

### C8. The trading post's runes (step 07)

```ts
// src/game/tradingPost.ts (existing file)
/** What a rune is worth by rank, any kind (correction 6). */
export const RUNE_PRICES: Record<Rank, number>              // { 1: 15, 2: 45, 3: 135, 4: 405 }
/** The kinds the post sells. */
export const SHOP_RUNES: readonly RuneId[]                  // ['ember', 'rime', 'storm', 'stone', 'wind', 'life']
/** The post level that sells each rank. */
export const RUNE_RANK_LEVELS: Partial<Record<Rank, number>>  // { 1: 2, 2: 4 }
export function runePrice(key: RuneKey): number
/** What the post pays for a rune from the pouch: a third of its price, rounded down. */
export function runeSalePrice(key: RuneKey): number
/** The runes the post sells at its level: SHOP_RUNES at rank 1 from level 2, then rank 2 from level 4. */
export function runeWares(world: WorldState): RuneKey[]
export function buyRuneRefusal(game: GameState, key: RuneKey): string | null
/** Buys one rune into the pouch for gold. */
export function buyRune(game: GameState, key: RuneKey): string | null
/** Sells one rune from the pouch. */
export function sellRune(game: GameState, key: RuneKey): string | null
```

- `salePrice(item)` becomes `Math.floor(((buyPrice(unruned(item)) ?? VALUES[unruned(item).id] ?? 0) + Σ runePrice(rune)) / 2)` (correction 14).
- `sells` and `buyRefusal` refuse an item with `runes`.

### C9. Icons and scene tables (art in step 02; wired in step 08)

| What | Names | Made in | Wired in |
| --- | --- | --- | --- |
| Rune icons (20px `icon` canvas) | `icon_rune_<id>` for each of the ten `RUNE_IDS` | step 02 (`art/icons/`) | step 08: `RUNE_ICON_KEYS` |
| Socket pips (new `pip` canvas, about 6×6) | `icon_socket_empty`, `icon_socket_filled` (the filled one drawn light, to take a tint) | step 02 | step 08: `SOCKET_PIP_KEYS` |

```ts
// src/scenes/itemIcons.ts (existing file, Phaser-free; step 08)
export const RUNE_ICON_KEYS: Record<RuneId, string>                         // 'icon_rune_ember', …
export const SOCKET_PIP_KEYS: { empty: string; filled: string }             // 'icon_socket_empty', 'icon_socket_filled'
/** Each rune's colour, for its filled pip's tint and its rows' text. */
export const RUNE_COLOURS: Record<RuneId, number>
/** An item's pips, socket by socket: the rune's id where one sits, null where empty; empty for an item with no sockets. */
export function socketPips(item: Item): Array<RuneId | null>
```

- `InventoryScene`, `TradingPostScene` and `CraftingScene` load every `RUNE_ICON_KEYS` and `SOCKET_PIP_KEYS` image from `assets/sprites/<key>.png`.
- They draw an item's pips in a row along the bottom of its icon.

### C10. The screens (steps 08 and 09)

```ts
// src/scenes/battleEffects.ts (existing file, Phaser-free; step 08)
/** The floating text of an attack's on-hit damage: "+3 fire", several joined by a space ("+1 fire +2 blight"); null when none came through. */
export function bonusText(event: AttackEvent): string | null
```

- **Step 08 (the inventory and the battle):**
  - *The tooltip.* `InventoryScene` adds `socketLines(item)` after `describeItemStats`.
  - *The character tab.* It gains `Wards: fire 2, frost 4` (`ELEMENTS` order) when any ward is above 0.
  - *Pips.* Items show socket pips in the slots, the backpack and the ground.
  - *Floating text.* `BattleScene` shows `bonusText` rising from the defender at impact.
  - *The victory screen.* `BattleScene.endBattle` calls `takeRunes` for a won battle at a location. It names the runes on the existing "Found:" line, the items first, then `runeName` of each: "Found: Lesser Ember Rune."
  - *The probe.* `InventoryProbe` gains `tooltip: string[]` (the lines shown, empty when hidden) if it lacks one.
- **Step 09 (the Runes tab and the trading post):**
  - *Crafting.* `CraftingScene` gains a Modify tab (today's screen) and a Runes tab.
    - The Runes tab lists `socketables`. A click on one shows its sockets: each filled one with Extract and its cost, or the refusal. The pouch is listed with Embed (into the selected item) and Fuse for each key. A click on an action shows its cost and effect, and Confirm does it. This is the select, act and confirm flow of design §7.
    - A field embed closes the screen and resumes `World` with `CraftedData` (correction 16).
  - *The trading post.* `TradingPostScene` gains a Runes filter on the Buy tab, after the slot buttons, which lists `runeWares` with prices. The Sell tab lists the pouch's runes after the materials, at `runeSalePrice`.
  - *The encampment.* `encampment.ts` adds the rune lines to the descriptions:
    - the workshop: embedding at any level, fusing to rank 2 from level 1, extracting from level 2;
    - the trading post: rank-1 runes from level 2, rank 2 from level 4.
  - *The probes.*
    - `CraftingProbe` gains `tab: 'modify' | 'runes'`, `sockets: Array<ButtonProbe & { index: number; rune: RuneKey | null }>`, `pouch: Array<{ key: RuneKey; count: number; embed: ButtonProbe; fuse: ButtonProbe }>` and the buttons `modifyTab`, `runesTab`, `confirm`.
    - `TradingPostProbe.rows[].kind` gains `'rune'` (id `rune:<key>`), `filter.slot` may be `'runes'`, and it gains a `runesButton: ButtonProbe`.

### C11. The simulator (step 10)

```ts
// scripts/simulate.ts (existing file)
/** The careful party's rune order by slot class (correction 11). */
export const RUNE_ORDER: Record<SlotClass, readonly RuneId[]>   // { weapon: ['ember', 'storm', 'stone'], shield: ['stone', 'life'], armour: ['stone', 'life'] }
/** At a workshop: fuses every rank-1 triple it may, buys rank-1 runes for empty sockets the pouch cannot fill, and embeds by RUNE_ORDER, highest rank first, in each member's weapon, shield and armour. */
export function runecraftGear(game: GameState): { embedded: number; fused: number; bought: number; gold: number }
// CampaignRecord gains: runesFound, runesBought, runesFused, socketsFilled (filled sockets in the party's worn gear at the end), goldOnRunes
```

- After each win, `takeRunes(game, next.threat, next.encounter, battleSeed)` runs, with the seed passed to `fight` (`(seed + battles.length) >>> 0`, before the battle is pushed).
- `visitFacilities`:
  - before it replaces a runed worn item, it extracts the runes when `extractRefusal` is null;
  - it calls `runecraftGear` after the gear is bought and before `craftGear`;
  - then it sells the baggage again, and raises the shrine.
- The summary prints the five new fields.

## Tasks

| Step | Task | Outcome | Depends on | Engineer / reviewer | Status |
| --- | --- | --- | --- | --- | --- |
| 01 | [Baseline measurement](01-baseline-measurement.md) | The guard and the Troll Lair cell measured on this tree before any change; recorded here, and in CLAUDE.md if moved | — | sonnet / sonnet | done (`6ad6ab4`) |
| 02 | [Rune icons and socket pips](02-rune-icons.md) | Ten `icon_rune_<id>` icons, two socket pips and the `pip` canvas exported; README | — | opus / opus (art) | done (`7dab325`) |
| 03 | [Runes and ids](03-runes-and-ids.md) | `runes.ts` (C1), `OnHit` and the new stat fields (C2), the `#` grammar, runed names and words, unique sockets, `craftedItem` with runes; the guard identical | 01 | opus / opus | done (`1e51399`) |
| 04 | [Derivation, the pouch and the save](04-derivation-pouch-save.md) | Wards, `onHit` and `maxHp` derived; `clampHp`; `GameState.runes`; save 18; debug `give`, `items` and `runes`; the guard identical | 03 | opus / opus | done (`724a09a`) |
| 05 | [The engine](05-engine.md) | On-hit damage, statuses, Life healing and bane; `blightborn`; `AttackEvent` fields and the log line; policy harm; the simulator's tally; LOG 23; the guard identical | 03 | opus / opus | done (`9b46d64`) |
| 06 | [Runecraft](06-runecraft.md) | `runecraft.ts` (C6) with every refusal and the field day | 04 | opus / opus | done (`b1eeef1`) |
| 07 | [Loot and the trading post's runes](07-loot-and-trading-post.md) | `loot.ts` (C7); rune wares, prices and sales (C8); runed items' sale price | 04 | sonnet / opus | done (`2d7d130`) |
| 08 | [Tooltips, pips, wards and battle text](08-inventory-and-battle-screens.md) | The icon tables (C9), the tooltip's socket lines, the wards line, the pips, `bonusText` and floating text, runes on the victory screen; scene and in-browser tests | 02, 05, 07 | sonnet / opus | done (`4c55ee9`) |
| 09 | [The Runes tab and the trading post's Runes](09-runes-tab-and-trading-post.md) | Crafting's Modify and Runes tabs, the field embed, the post's Runes filter and rune sales, the encampment lines, the probes; scene and in-browser tests | 06, 07, 08 | opus / opus | pending |
| 10 | [The simulator](10-simulator.md) | Rune loot taken, `runecraftGear`, extraction before replacement, the record and summary; the guard measured | 05, 06, 07 | opus / opus | done |
| 11 | [Measure, tune and document](11-measure-tune-document.md) | The guard judged against 01, check 2's cells, any tuning, CLAUDE.md, the manual and screenshots, the stage notes and index status, the play script | 08, 09, 10 | opus / opus | pending |

## Execution order

1. **01** first, on the tree as it stands, before any code changes. **02** may run alongside it, since it is art only.
2. **03** after 01.
3. **04 and 05** in parallel after 03:
   - 04 touches `character.ts`, `gameState.ts`, `save.ts`, `debugCommands.ts` and their tests;
   - 05 touches `battleEngine.ts`, `policies.ts`, `combat.ts` (the Horror's flag), `simulate.ts`'s `Tally` and their tests.
4. **06 and 07** in parallel after 04. They may also run alongside 05:
   - 06 touches the new `runecraft.ts`;
   - 07 touches the new `loot.ts` and `tradingPost.ts`.
5. **08** after 02, 05 and 07. **10** after 05, 06 and 07, and it may run alongside 08 and 09:
   - 10 touches `scripts/`;
   - 08 and 09 touch `src/scenes/`, `src/testHook.ts`, `encampment.ts` and `e2e/`.
6. **09** after 06, 07 and 08, because it uses 08's icon tables and pips.
7. **11** last.

Parallel steps each edit only their own lines of CLAUDE.md, and the second to commit rebases its CLAUDE.md edit on the first.

**Checkpoints** (the guard command, compared with step 01's summary):
- **After 03, 04, 05, 06 and 07:** identical to step 01's, because the simulator neither loots nor embeds runes, and nothing draws differently (correction 2). Any difference is a bug. Steps 06 and 07 add only new functions, so their run may be skipped if they do not touch `simulate.ts` or anything it calls.
- **Baseline (step 01), tree at `7dab325` (step 02's art commit, no code changed since `205f76c`), unchanged from stage 3:** the guard is **233 of 500** (46.6%; party fell 267, encampment lost 0), 269 days, 18.2 battles, 1.8 heroes dead a campaign. Troll Lair threat 5, party level 5, 500 battles from seed 1: `iron_sword@3` 0 wins (7.12 rounds, damage 49.8 to 148.0, hit rates 0.243 and 0.799); `iron_sword` 0 wins (7.09 rounds, damage 42.3 to 147.8, hit rates 0.201 and 0.801). The full summary is in step 01's execution record.
- **After 10:** measured, with the runes found, bought and fused and the sockets filled. Step 11 judges it. **Measured (step 10): 230 of 500** (46.0%; party fell 270, encampment lost 0), 270 days, 18.2 battles, 1.8 heroes dead a campaign; 1 gold on gear and 51 from sales; runes 13.1 found, 0.0 bought and 0.1 fused a campaign, 3 gold on runes, 0.0 sockets filled at the end. Threat 5 won 1333 of 1493 (1349 of 1506 at step 01). Within 3 points of step 01's 233: the party almost never wears a socketed item (tier 2 never bought, Masterwork rare), so the runes found sit in the pouch, and the change is the gold of the few fuses moving purchases.

## Requirement map

| Design requirement | Steps |
| --- | --- |
| S4-R1 sockets by tier, grade and unique; ids with runes | 03 |
| S4-R2 ten runes, four ranks, effects by slot class | 03 (data), 04 (derived), 05 (on-hit in battle) |
| S4-R3 runes from loot, the trading post and fusing (to rank 2) | 07 (loot, post), 06 (fusing), 08 (victory line), 09 (post screen) |
| S4-R4 embed, extract and fuse; field embedding for rank 1 | 06, 09 |
| S4-R5 on-hit damage and statuses, Life healing, hero wards | 04 (wards, Life `maxHp`), 05 |
| S4-R6 the UI for sockets, the pouch and runecraft | 02 (art), 08, 09 |
| Design §2 the pouch saved | 04 |
| Design §2 simulator: loot, embedding, fusing, buying, the record | 10 |
| Design §5 versions | 04 (save 18), 05 (log 23) |
| Design §6 tests | 03 to 10, each with its own |
| Design §6 simulator checks 1 and 2, the play script, "Done when" | 01, 11 |
| Stages-index conventions: the guard, versions, docs, sprites, the play script | 01, 02, 04, 05, 11 |

## Overall completion criteria

- [ ] Every step done, `npm test` passing at each commit, and the in-browser tests passing after 08 and 09.
- [ ] The guard measured at 01, checked identical after 03 to 07, measured after 10, and judged in 11: within about 5 points of step 01's figure, or the move explained in CLAUDE.md's rules of scaling and the stage notes.
- [ ] Check 2 recorded at `--encounter troll_lair --threat 5 --party-level 5` for `'iron_sword@3'`, `'iron_sword@3#ember1'` and `'iron_sword@3#ember3'`: a modest gain at rank 1, a large one at rank 3.
- [ ] Every rune icon and pip is a finished drawing, and `sprites:check` is clean.
- [ ] `SAVE_VERSION` is 18 and `LOG_SCHEMA_VERSION` 23.
- [ ] CLAUDE.md describes runes, sockets, the id grammar, wards and on-hit effects, the hit-point rule (correction 4), runecraft, rune loot, the trading post's runes, the new modules and tables, and the simulator's record. The manual describes them, and its screenshots are retaken.
- [ ] The stage design has "Implementation notes" with the figures, and the stages index's stage 4 row says done.
- [ ] The design's play script has been walked in the game (`make dev`), or the steps not walked are listed for the user in step 11's record.

## Open questions

No question blocks a step. These were the defaults taken; the user has answered all four (D1 changed, D2 to D4 accepted):

| # | Decision | Default taken | Where |
| --- | --- | --- | --- |
| D1 | Hit points when Life-runed gear comes off or goes on | **Answered by the user (changed from the default):** the hero keeps the same share of its hit points, rounded to the nearest, never above the new maximum and never to 0 from a positive value (correction 4, C3); the orchestrator applies it to a rise too. The default was to lose the excess. | 04 |
| D2 | The Source's rune loot | Threat 5's row; the reference's Source row waits for stage 9 (correction 8). **Accepted by the user.** | 07 |
| D3 | The simulator's rune policy | Ember, Storm, Stone for weapons; Stone, Life for armour and shields; embeds only at a workshop (correction 11). **Accepted by the user.** | 10 |
| D4 | Rune prices at ranks 3 and 4 | 135 and 405 (correction 6). **Accepted by the user.** | 07 |

## For implementers

After working on a step, update its row's status here (`in progress`, `done` or `blocked`) with the commit. Fill the task file's execution record: the commit, the checks run and their results, deviations, and anything left for a later step. If a step is blocked, say on what. A contract changed by a step is amended here, marked with the step, as stage 3's plan did.
