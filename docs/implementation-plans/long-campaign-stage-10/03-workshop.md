# Step 03: The workshop: forging, tempering, fusing, trophies

[Plan index](index.md) · [Stage design](../../designs/long-campaign/stage-10-forging-and-high-tiers.md) (§2 "The workshop", "Fusing", "Trophies"; §4; §5; §6 Tests) · [Gear reference](../../designs/long-campaign/reference/gear-and-runes.md) §4.3 (getting gear, workshop levels, forge costs, trophies), §4.4 (fusing), §5.4 (forging and the workshop), §5.5 (a forged item's worth) · [Stages index](../../designs/long-campaign/index.md) ("Versions") · [Plan log](log.md)

**Difficulty:** opus / opus. Many refusals and costs under one contract, a save bump, an import cycle (`crafting.ts` ↔ `company.ts`, `tradingPost.ts` reading `crafting.ts`) and a full `src/game/CLAUDE.md` to make room in: leave the model unset. The reviewer (opus) checks every refusal's order and words against C2, that tiers 1 and 2 cost and sell exactly as before, that nothing draws, and that the guard and the 50-campaign check are identical.

Skill files: `.claude/skills/yomi-add-content/item.md` (plain items come from the catalog; a forged item is an id `itemById` builds), `.claude/skills/yomi-add-content/facility.md` (the workshop's new levels: its entry in `encampment.ts`; the sprites are step 05's and the screen step 08's), `.claude/skills/yomi-balance/guards.md`.

## 1. Objective

Give the workshop its levels 4 to 6 and what they do, all in the domain, with no scene work but the debug console's material list:
- `WORKSHOP_COSTS` to six levels, `forge` (tiers 3 to 5, from gold and the tier's ore, wood or trophy, into the baggage) and `temper` (a tier-3+ item to Fine or Masterwork), each with its refusal;
- `craftCost` asking the tier's material for tier 3 and up, and modifiers capped at grade 3 at levels 4 to 6;
- a forged item's worth at the trading post (`forgedValue`);
- fusing to rank 3 (level 4) and rank 4 (level 5), which `FUSE_LEVELS` already names;
- trophies: four new stock materials, `TROPHIES` (empty this stage) and the granting path `trophiesFor` / `takeTrophies`;
- `materialName` for stock text, used by `describeCost`;
- `SAVE_VERSION` 31.

Play does not move: no early-campaign party reaches a workshop above 3, a tier-3 item or a trophy.

## 2. Requirements and context

- **S10-R2** (gear R6, A4): workshop levels 4 to 6, forging and tempering. A4: "Forging is refused without the workshop level, the stock or the tier's material. When it succeeds it spends exactly the cost and puts the item in the baggage."
- **S10-R3** (gear R7): trophies by kind, data and granting. "`TROPHIES` by kind, granted beside `rewardVictory`. Their materials are added to `Material`." Until stage 11 adds their monsters, wolfhide, wyvern hide, basilisk scale and drake scale come only from partners' goods (step 04); Elder Glade sells wyvern hide as a stand-in.
- **S10-R4** (gear R10): fusing to rank 3 at workshop level 4, and to rank 4 at level 5.
- **Design §2:** `forge(game, family, material)` and its refusal; `temper(game, place, grade)` and its refusal; `craftCost` takes tier materials for tier 3 and up.
- **Design §4, what the player sees:** at workshop level 4 with 20 mithril, the Forge tab offers a Mithril Longsword for 30 gold and 8 mithril. Forged, it has one socket. Tempered to Masterwork it has two.
- **Design §5:** `SAVE_VERSION` is bumped (the new materials in the stock).
- **Design §6 tests:** `crafting.test.ts` (forge and temper, including refusals; workshop levels 4 to 6), `runecraft.test.ts` (fusing to ranks 3 and 4).
- **Gear §4.3 workshop levels:** 4: 100 gold, 20 mithril (forge tier 3, fuse to rank 3); 5: 150 gold, 20 adamant (forge tier 4, fuse to rank 4); 6: 200 gold, 10 starmetal (forge tier 5). Forge costs: tier 3 30 gold and 8 material, tier 4 50 and 10, tier 5 80 and 12; two-handed families and plate double the material; for hide the material is the trophy. Grading a tier 3+ item: at the workshop, level 3+.
- **Gear §5.4:** temper cost is gold (tier × 10 × grade) plus the tier's material (4 × grade); the trading post's Fine and Masterwork stop at tier 2; `craftCost` for modifiers on tier 3+ items asks that tier's material in place of iron, copper or crystal.
- **Gear §5.5:** a forged item sells for half of `forge cost × 1.5`.

### Decisions from the index this step applies (unchanged)

2. **Hide materials' catalog ids hold no underscore** (`wyvern`, `basilisk`, `drake`; names "Wyvern-hide", "Basilisk-scale", "Drake-scale", so "Drake-scale Leather"): a plain id splits at its first underscore. `MaterialDef.stock` names the stock material each tier-3+ material spends (`wyvern_hide`, …), keeping `catalog.ts` free of game imports.
5. **`forge` and `temper` take the party** (the project's `(game, party)` convention; the design writes `forge(game, family, material)` and `temper(game, place, grade)`, and `temper` keeps its place, which names the party).
6. **Tempering** goes straight to the asked grade at that grade's cost (gold tier × 10 × grade, the tier's material 4 × grade), at workshop level 3 and up (gear §4.3: "at any level 3+"), only for a tier-3+ plain item; it keeps the modifier and runes. Modifiers at workshop levels 4 to 6 stay at grade 3 at most (`highestGrade` clamped: without it level 4 would offer a grade 4).
7. **A forged item's worth** is 1.5 × (its forge gold + the temper gold of its grade), sold for half (gear §5.5); the material is not counted.
8. **Trophies this stage are data and a path, with no entries** *(for the user, before step 03)*: no wolf, wyvern, basilisk or dragon exists until stage 11, so `TROPHIES` is empty, and granting is wired (the victory screen, the simulator) and tested with an injected table. Elder Glade sells **wyvern hide** at the Market Hall as the design's stand-in; **basilisk scale and drake scale have no source in play until stage 11** (debug `stock` only), so hide tiers 4 and 5 cannot be forged in play this stage.
14. **The refactor guard** stays identical through steps 02, 03, 04 and 07 (no tier-3+ item, workshop above 3, good or bandit above threat 8 reaches the early campaign); **step 09 re-records it once** (its new record fields and the policy), with old and new figures; step 10 only for a retune the orchestrator approved. **The policy snapshot** is re-recorded in step 02 (bandits at threats 9 and up), only those lines changing.
17. **Stock text names materials** by `materialName` (`wyvern_hide` reads "wyvern hide"); `describeCost` uses it.
19. **Versions:** `SAVE_VERSION` 30 → 31 in step 03 (the trophies in `Material`, as the design asks), no migration (older saves read as unreadable, stages 8–9's practice). `LOG_SCHEMA_VERSION` unchanged: no battle event changes shape.
20. **Out of scope:** market income, the simulator's spend order, the company's long-campaign policy skew and home-country spawns (stage 12); the Source's guardians stay at `SOURCE_FOE_LEVEL` 6 (stage 11); trophies from kills and `--player-kit` (stage 11); gear §5.8's step 3 ring-element wards and step 4 unique items by `gearScore`; the trading post selling tier 3+.

### Contracts consumed (copied unchanged from the index)

From **C1. Tiers 3 to 5 and bandit gear (step 02)**, the parts this step reads:

```ts
// src/inventory/catalog.ts
export type Tier = 1 | 2 | 3 | 4 | 5
export interface MaterialDef {
  id: string
  name: string
  kind: MaterialKind
  tier: Tier
  /** Points off the strength each of its families asks, never below 0: Mithril 1, Starmetal 2. */
  strengthRelief?: number
  /** Its families' spell-skill penalties are halved toward 0 (Math.trunc): Mithril, Starmetal (decision 3). */
  casterFriendly?: true
  /** Tiers 3 to 5: the stock material (src/game/territory.ts `Material`) forging and tempering it spends. */
  stock?: string
}
// MATERIALS keeps today's eight rows first, then, in this order:
//   { id: 'mithril',      name: 'Mithril',        kind: 'metal', tier: 3, strengthRelief: 1, casterFriendly: true, stock: 'mithril' }
//   { id: 'adamant',      name: 'Adamant',        kind: 'metal', tier: 4, stock: 'adamant' }
//   { id: 'starmetal',    name: 'Starmetal',      kind: 'metal', tier: 5, strengthRelief: 2, casterFriendly: true, stock: 'starmetal' }
//   { id: 'elderwood',    name: 'Elderwood',      kind: 'wood',  tier: 3, stock: 'elderwood' }
//   { id: 'wyrmwood',     name: 'Wyrmwood',       kind: 'wood',  tier: 4, stock: 'wyrmwood' }
//   { id: 'heartwood',    name: 'Heartwood',      kind: 'wood',  tier: 5, stock: 'heartwood' }
//   { id: 'wyvern',       name: 'Wyvern-hide',    kind: 'hide',  tier: 3, stock: 'wyvern_hide' }
//   { id: 'basilisk',     name: 'Basilisk-scale', kind: 'hide',  tier: 4, stock: 'basilisk_scale' }
//   { id: 'drake',        name: 'Drake-scale',    kind: 'hide',  tier: 5, stock: 'drake_scale' }
//   { id: 'mithrilweave', name: 'Mithrilweave',   kind: 'cloth', tier: 3, stock: 'mithril' }     // decision 1
//   { id: 'adamantweave', name: 'Adamantweave',   kind: 'cloth', tier: 4, stock: 'adamant' }
//   { id: 'starweave',    name: 'Starweave',      kind: 'cloth', tier: 5, stock: 'starmetal' }
// A plain item's id stays `<material>_<family>` (tier1's id and name only at tier 1): mithril_longsword "Mithril Longsword",
//   drake_leather "Drake-scale Leather", elderwood_shield "Elderwood Shield", starweave_robe "Starweave Robe".

// src/inventory/inventory.ts: BASE_ITEMS = every family × every material of its kind, FAMILIES order, then MATERIALS order
//   (so each family's tiers 1 and 2 come first, as today): 28 families × 5 tiers = 140. Item.tier is the 1–5 Tier.
// src/inventory/runes.ts: SOCKETS_BY_TIER: Record<Tier, number> = { 1: 0, 2: 1, 3: 1, 4: 2, 5: 2 }; Masterwork +1, at most MAX_SOCKETS (3); a small-slot item at most 1 (unchanged)

// src/game/tradingPost.ts: the post never sells tier 3 and up: sells() false and buyPrice() null for tier >= 3;
//   buyRefusal says 'The trading post does not sell that; the workshop forges it.'; wares() and TIER_PRICE stay tiers 1 and 2
```

### Contract produced (copied unchanged from the index)

**C2. The workshop: forging, tempering, fusing, trophies (step 03)**

```ts
// src/game/territory.ts
export type Material = /* today's sixteen */ | 'wolfhide' | 'wyvern_hide' | 'basilisk_scale' | 'drake_scale'   // trophies
// WORKS_NAMES gains an entry for each trophy (never shown: no site yields one)
export function materialName(material: Material): string   // the id with '_' read as ' ': 'wyvern hide'
// src/game/buildings.ts: describeCost names each material by materialName

// src/game/crafting.ts
export const WORKSHOP_COSTS: readonly Stock[]   // today's three, then { gold: 100, mithril: 20 }, { gold: 150, adamant: 20 }, { gold: 200, starmetal: 10 }; MAX_WORKSHOP_LEVEL 6
export type HighTier = 3 | 4 | 5
export const FORGE_LEVEL: Record<HighTier, number> = { 3: 4, 4: 5, 5: 6 }
export const FORGE_GOLD: Record<HighTier, number> = { 3: 30, 4: 50, 5: 80 }
export const FORGE_MATERIAL: Record<HighTier, number> = { 3: 8, 4: 10, 5: 12 }   // doubled for a two-handed family and for plate
export const TEMPER_LEVEL = 3
export function forgeCost(family: FamilyId, material: string): Stock   // { gold: FORGE_GOLD[tier], [MaterialDef.stock]: FORGE_MATERIAL[tier] (× 2) }
export interface ForgeOption { family: FamilyId; material: string; tier: HighTier; item: Item; cost: Stock; refusal: string | null }
export function forgeOptions(game: GameState, party: Expedition, slot?: EquipmentSlot): ForgeOption[]
//   every family (of `slot`, if given) in FAMILIES order, each with its kind's tier-3+ materials in MATERIALS order whose FORGE_LEVEL the workshop has reached
export function forgeRefusal(game: GameState, party: Expedition, family: FamilyId, material: string): string | null
//   in order: not at the encampment; no such family or material, or not of the family's kind; a tier below 3 ('The trading post sells tiers 1 and 2.');
//   the workshop below FORGE_LEVEL[tier] ('Forging <material> needs a level N workshop.'); the stock short ('It costs …, more than the stock holds.')
export function forge(game: GameState, party: Expedition, family: FamilyId, material: string): string | null
//   spends forgeCost and pushes the plain item itemById(`${material}_${family}`) onto party.baggage; no time passes
export function temperCost(item: Item, grade: Grade): Stock   // { gold: tier × 10 × grade, [the tier's stock material]: 4 × grade }
export function temperRefusal(game: GameState, place: ItemPlace, grade: Grade): string | null
//   stale place; not at the encampment; workshop below TEMPER_LEVEL; enchanted, or a tier below 3 ('The trading post sells the grades of tiers 1 and 2.');
//   grade not above the item's; the stock short
export function temper(game: GameState, place: ItemPlace, grade: Grade): string | null
//   the item at `grade`, its modifier and runes kept (craftedItem), in its place (replaceAt, so clampHp); no time passes
export function forgedValue(item: Item): number   // tier 3+: 1.5 × (FORGE_GOLD[tier] + (grade > 1 ? temperCost(item, grade).gold : 0)); 0 below tier 3
// craftCost(item, grade): for a tier-3+ item, today's gold for the grade and 5 of the tier's stock material in place of iron, timber, copper or crystal; tiers 1–2 unchanged
// highestGrade(tier): Math.min(3, Math.max(1, level)) — workshop levels 4 to 6 make modifiers to grade 3, never 4
// craftables lists every tier-3+ plain item the party has (it can be tempered), even where no modifier fits

// src/game/tradingPost.ts: salePrice of a tier-3+ item = floor((forgedValue + its runes' prices) / 2)
// src/game/runecraft.ts: FUSE_LEVELS unchanged ({ 2: 1, 3: 4, 4: 5 }); with MAX_WORKSHOP_LEVEL 6, fusing to rank 3 (level 4) and rank 4 (level 5) now succeeds
// src/game/encampment.ts: the workshop's effect lines for levels 4 to 6 (forges tier 3, 4, 5; fuses to rank 3, 4; tempers)

// src/game/encounters.ts
export interface Trophy { material: Material; amount: number }
export const TROPHIES: Partial<Record<FoeKind, Trophy>> = {}   // stage 11 adds gear §4.3's kinds (decision 8)
// src/game/loot.ts
export function trophiesFor(kinds: Iterable<UnitKind>, table: Partial<Record<FoeKind, Trophy>> = TROPHIES): Stock   // each foe its kind's trophy, summed
export function takeTrophies(game: GameState, kinds: Record<UnitId, UnitKind>, table: Partial<Record<FoeKind, Trophy>> = TROPHIES): Stock
//   adds the foes' trophies (every unit whose kind is not 'warrior') to world.stock and returns what it added; draws nothing

// src/game/save.ts: SAVE_VERSION = 31, no migration
// src/scenes/debugCommands.ts: MATERIALS gains the four trophies (tsc enforces)
```

Consumers: step 04 (`Material`'s trophies, `materialName`, the trading post as this step leaves it), step 06 (`debugCommands.ts` as this step leaves it), step 08 (the Forge tab and Temper read `forgeOptions`, `forgeRefusal`, `forge`, `temperCost`, `temperRefusal`, `temper`; the victory screen calls `takeTrophies`; stock text uses `materialName`), step 09 (the simulator forges, tempers, fuses and calls `takeTrophies`).

### Shared constraints (from the index)

- **Commands** (local Node 26: prefix `PATH=/opt/homebrew/opt/node@26/bin:$PATH`; or the podman `make` targets):
  - `npm test` (`tsc && vitest run`) is the gate before every commit; `npx vitest run <file>` for one file;
  - `npm run simulate -- <flags>`: each run its own `--out` under `logs/` (gitignored) or `--log none`. **Never run two simulations at once** (steps 01, 02, 03, 04, 07, 09 and 10 run them, in that order).
- **The refactor guard.** `scripts/simulate.test.ts`, `describe('the refactor guard')`, args `--campaign --battles 5 --seed 1 --parties 1 --ready-level 7 --near-source`; `GUARD_RECORDS`, `GUARD_EVENTS_SHA256`. Rules: `.claude/skills/yomi-balance/guards.md`. Steps 02, 03, 04, 06, 07 and 08 must not edit it and keep it green (a mismatch means the step changed play: find the cause and fix it).
- **The 50-campaign check** before committing, against step 02's hash (in `log.md`), recorded as "identical" or the diff in `log.md`. It must be identical:

  ```sh
  npm run simulate -- --campaign --battles 50 --seed 1 --parties 1 --ready-level 7 --near-source --out logs/guard-50.jsonl > logs/guard-50.txt
  shasum -a 256 logs/guard-50.jsonl
  ```

- **The policy snapshot** (`src/engine/policies.test.ts`) is not touched by this step and must stay green.
- **The early-game figure.** Any figure out of the user's bands, or further out than accepted, is brought to the orchestrator with options, never tuned away silently. The user's bands (`.claude/skills/yomi-balance/bands.md`) are never changed. This step moves no figure.
- **Determinism.** No step adds, drops or reorders a draw of the world RNG or a battle's RNG. Forging, tempering, goods and trophies draw nothing.
- **Import cycles.** `crafting.ts`, `runecraft.ts` and `company.ts` are in a cycle (`src/game/CLAUDE.md`), as are `blight.ts`, `territory.ts`, `worldMap.ts`, `trade.ts` and `buildings.ts`; `tradingPost.ts` may call `crafting.ts`'s `forgedValue` and `trade.ts`'s readers only inside functions. `catalog.ts` and `inventory.ts` import each other: nothing at module load. `catalog.ts` imports nothing from `src/game/`.
- **Versions.** `SAVE_VERSION` 31 in this step, no migration; `LOG_SCHEMA_VERSION` unchanged.
- **Content.** `.claude/skills/yomi-add-content/`: `item.md` (plain items come from the catalog, so `BASE_ITEMS` grows by itself), `facility.md` (a facility's new levels, sprites and manual).
- **Commits.** One commit once `npm test` passes and the guard holds, on `long-campaign-stage-10`, without pushing; files staged by path. Message "Stage 10 step 03: the workshop". No attribution lines.
- **Docs.** Fix the CLAUDE.md lines this change makes wrong and search the CLAUDE.md files, `.claude/` and `docs/reference/` for every name it renames or removes. `scripts/claudeMd.test.ts` caps each directory's `CLAUDE.md` at 8 KB: **`src/game/CLAUDE.md` is at 7,765 bytes**, so this step moves detail to `docs/reference/game.md` before adding a line.

## 3. Dependencies and prerequisites

- **Step 02 is done:** C1 is in the code (`Tier` 1–5, the material rows with `stock`, 140 plain items, `SOCKETS_BY_TIER` to 5, the post refusing tier 3+), and its 50-campaign hash is in `log.md`. If `MaterialDef.stock` or a tier-3+ id is missing, stop and report: do not add it here.
- **Existing code (inspected at `f3a1102`):**
  - `src/game/crafting.ts`: `WORKSHOP_COSTS` (three levels), `MAX_WORKSHOP_LEVEL = WORKSHOP_COSTS.length`, `upgradeWorkshop`, `craftTier` (the workshop's level, or `'field'`), `highestGrade` (`Math.max(1, level) as Grade`: at level 4 it would give 4, an invalid grade), `craftCost` (iron or timber at grade 1, copper at 2, crystal at 3), `itemRefusal`, `craftables` (lists only items some modifier fits), `options`, `craftRefusal`, `applyCraft`, `craft`. Every action returns a refusal or null and checks before it changes anything; at the workshop no time passes.
  - `src/game/runecraft.ts`: `FUSE_LEVELS = { 2: 1, 3: 4, 4: 5 }` with a comment that 4 and 5 are "beyond MAX_WORKSHOP_LEVEL (3), so they are always refused for now": update the comment; `fuseRefusal` / `fuse` need no other change.
  - `src/game/tradingPost.ts`: `salePrice` (half of `buyPrice` or `VALUES`, plus half each embedded rune's price); after step 02 `buyPrice` is null for tier 3+.
  - `src/game/territory.ts`: `Material` (sixteen), `WORKS_NAMES: Record<Material, string>`.
  - `src/game/buildings.ts`: `describeCost` writes `${amount} ${material}`.
  - `src/game/encampment.ts`: the workshop's `effect` lines, one per level 1 to 3; `maxLevel: MAX_WORKSHOP_LEVEL`.
  - `src/game/encounters.ts`: `FoeKind`, `UnitKind`; no trophy-bearing kind exists (decision 8).
  - `src/game/loot.ts`: `takeRunes` (the pattern for `takeTrophies`, which draws nothing).
  - `src/game/itemPlace.ts`: `ItemPlace`, `itemAt`, `replaceAt` (ends with `clampHp`), `STALE`.
  - `src/inventory/inventory.ts`: `craftedItem(base, grade, mod?, runes?)`, `baseItem`, `itemById`.
  - `src/game/save.ts`: `SAVE_VERSION = 30`; fixtures `src/game/fixtures/save-v*.json` stay as tests that old saves are refused.
  - `src/scenes/debugCommands.ts`: `MATERIALS` built `satisfies Record<Material, number>`.
  - `scripts/simulate.ts`: `materialNeeds` adds `WORKSHOP_COSTS.slice(world.workshop)` and `visitFacilities` raises the workshop `while (upgradeWorkshop(...) === null)`.

## 4. Scope and guidance

### 4.1 Make room in `src/game/CLAUDE.md` first

It is at 7,765 bytes of its 8,192 cap. Before adding anything, move detail to `docs/reference/game.md` (for example the long "Contracts" bullets' examples or the import-cycle list's detail, keeping the rule), so that after this step's edits it stays under the cap with room for later steps (aim for at most about 7,400 bytes). Then fix the modules list: `crafting.ts` ("modifiers on items, in the field or at the workshop; forging and tempering tiers 3 to 5"), `loot.ts` (rune loot and trophies), `territory.ts` if its line names the materials.

### 4.2 Materials and names (`territory.ts`, `buildings.ts`)

- `Material` gains `'wolfhide' | 'wyvern_hide' | 'basilisk_scale' | 'drake_scale'` after today's sixteen, with a comment (trophies, stage 10; no site yields one). `WORKS_NAMES` gains an entry each (tsc asks; any name, never shown).
- `materialName(material)`: the id with `_` read as a space. `describeCost` uses it, so every cost line with a trophy reads naturally; lines without one are unchanged.
- `debugCommands.ts`'s `MATERIALS` gains the four (tsc enforces; the only scene file this step touches).

### 4.3 Workshop levels, forging, tempering (`crafting.ts`)

- `WORKSHOP_COSTS` to six levels as C2; `MAX_WORKSHOP_LEVEL` follows.
- `highestGrade` clamped to 3 (decision 6). `craftCost` for tier 3+ as C2 (the tier's `MaterialDef.stock` via the item's material; tiers 1–2 byte-for-byte as today).
- `craftables` (and `itemRefusal`): a tier-3+ plain item is listed even when no modifier fits; its refusal for modifiers is then null only where a modifier is possible, so define how such an item reads (for example `itemRefusal` returning "No modifier fits it." while the item is still listed because it can be tempered). Keep today's list for tiers 1–2 exactly.
- `forgeCost`, `forgeOptions`, `forgeRefusal`, `forge` as C2. The material's tier comes from `MATERIALS`; two-handed is the family's `stats.twoHanded`, plate is `family.id === 'plate'`. `forgeOptions` lists only the materials whose `FORGE_LEVEL` the workshop has reached (none below level 4), each with its refusal (encampment, stock). `forge` checks `forgeRefusal` first, then spends and pushes into `party.baggage`.
- `temperCost`, `temperRefusal`, `temper` as C2: the result is `craftedItem(baseItem(item)!, grade, item.mod, item.runes)` put back with `replaceAt`. A Masterwork temper adds a socket (`socketsOf`, step 02); runes already embedded stay in their sockets.
- `forgedValue` as C2 (0 below tier 3).

### 4.4 The trading post and fusing

- `tradingPost.ts`'s `salePrice`: for a tier-3+ item, `floor((forgedValue(bare) + runes) / 2)`, calling `forgedValue` inside the function only (import cycle rule). Tiers 1–2 and enchanted items unchanged.
- `runecraft.ts`: update the `FUSE_LEVELS` comment; no rule change. Fusing to rank 3 at workshop level 4 and rank 4 at level 5 now works through today's `fuseRefusal`.

### 4.5 The encampment's workshop entry (`encampment.ts`)

Three more `effect` lines, for levels 4 to 6: what each forges and fuses, and that tier 3+ items are tempered from level 3 (fix level 3's line to say so). Keep them short (they show on the encampment screen at 840 × 560; step 08 checks the layout).

### 4.6 Trophies (`encounters.ts`, `loot.ts`)

- `Trophy` and an empty `TROPHIES` as C2, with a comment naming gear §4.3's table for stage 11 (wolves and worgs wolfhide 1 a foe, wyverns wyvern hide 3, basilisks basilisk scale 3, young dragons drake scale 6, elder wyrms drake scale 10).
- `trophiesFor` and `takeTrophies` in `loot.ts` as C2: no RNG, no events. Nothing calls `takeTrophies` yet: the victory screen is step 08's, the simulator step 09's.

### 4.7 The save

`SAVE_VERSION` 31, no migration; update the doc comment's history line if it lists versions. The captured fixtures stay as tests that older saves are refused.

### 4.8 Docs

- `docs/reference/game.md`: the workshop's six levels and costs; forging (costs, levels, doubling, the stock material per catalog material, refusals); tempering (cost, level, what it keeps); `craftCost` for tier 3+; the modifier grade cap; a forged item's worth; fusing to ranks 3 and 4; the trophies (`Material`, `TROPHIES` empty until stage 11, `takeTrophies`); `materialName`; `SAVE_VERSION` 31. Plus what 4.1 moves there.
- `docs/reference/characters.md`: where an item's worth or sale price is stated, add the forged item's.
- `src/inventory/CLAUDE.md`: only if a line is now wrong (for example a statement that the workshop makes nothing above tier 2).
- Search the CLAUDE.md files, `.claude/` and `docs/reference/` for "MAX_WORKSHOP_LEVEL", "three levels", "levels 1 to 3", "rank 3", "beyond MAX_WORKSHOP_LEVEL" and fix what this step makes false. The manual and the screens are step 08's and 11's.

### 4.9 Exclusions

No scene beyond `debugCommands.ts`'s `MATERIALS`; no partners' goods (step 04); no simulator policy (step 09: do not make the simulator forge, temper or take trophies here); no change to the trading post's wares; no balance change.

## 5. Verification

Tests, each with the refusals in the order C2 gives:
- **`src/game/crafting.test.ts`:**
  - workshop levels 4 to 6: costs, `upgradeWorkshop` to 6 and refused beyond, `MAX_WORKSHOP_LEVEL` 6;
  - the design's example: at workshop level 4 with 30 gold and 20 mithril, `forge(game, party, 'longsword', 'mithril')` spends exactly 30 gold and 8 mithril and puts a Mithril Longsword (`mithril_longsword`) in the baggage, with one socket; tempered to Masterwork it has two;
  - `forgeCost`: each tier's gold and material; doubled for a two-handed family (greatsword, bow) and for plate; the stock material for hide (`wyvern_hide`) and cloth (decision 1's rows);
  - `forgeOptions`: none below level 4; tier 3 at 4, tiers 3–4 at 5, 3–5 at 6; the slot filter; FAMILIES then MATERIALS order;
  - `forgeRefusal`, each case in order: away from the encampment, an unknown family or material, a material of the wrong kind, a tier-1 or -2 material, the workshop too low, the stock short (gold, then material); a refused forge leaves the stock and baggage untouched;
  - `temperCost`, `temperRefusal` (stale, away, workshop below 3, enchanted, tier 1–2, grade not above, stock short), `temper` straight to grade 3, keeping a modifier and runes, worn (`clampHp` path) and in the baggage;
  - `craftCost` for a tier-3 item at grades 1–3 (the tier's material, 5); tiers 1–2 unchanged;
  - `highestGrade` at levels 4 to 6 is 3, and `options` offers no grade 4;
  - `craftables` lists a tier-3 cap (no modifier fits) and still lists exactly today's items for tiers 1–2;
  - `forgedValue` for a plain and a Masterwork tier-3 item; 0 below tier 3.
- **`src/game/runecraft.test.ts`:** three rank-2 runes fuse to rank 3 at workshop level 4, refused at 3 (with the level in the refusal); three rank-3 runes fuse to rank 4 at level 5, refused at 4; costs as `fuseCost`.
- **`src/game/loot.test.ts`:** `trophiesFor` with an injected table (one kind, two kinds, a hero ignored, an empty table gives `{}`); `takeTrophies` adds to the stock and returns what it added, and draws nothing (a scripted or counting RNG untouched, or simply no RNG argument); with the default (empty) `TROPHIES` it adds nothing.
- **`src/game/tradingPost.test.ts`:** a forged item's and a tempered one's sale price, with and without a rune; tier 1–2 sale prices unchanged.
- **`src/game/encampment.test.ts`:** the workshop goes to level 6, with an effect line at each level.
- **`src/game/buildings.test.ts`** (or where `describeCost` is tested): a cost with `wyvern_hide` reads "wyvern hide"; `materialName`.
- **`src/game/save.test.ts`:** version 31; a stock holding mithril and a trophy, and a tier-3+ item in the baggage (and a tempered, runed one worn), round-trip; the old fixtures are refused.

Then:
- `npm test` passes (`tsc`, every test, `scripts/claudeMd.test.ts` within its caps, the refactor guard and the policy snapshot untouched).
- **The 50-campaign check** identical to step 02's hash. Why it should be: `materialNeeds` now adds levels 4 to 6's gold, mithril, adamant and starmetal to the materials kept, but the early campaign never holds those ores (the near-Source world's far sites are not captured), gold is never sold, and the workshop is raised greedily only when the stock affords a level, which levels 4 to 6 never are. If the hash differs, find the cause (for example a material sold differently, or `craftables`' order) and fix it; do not re-record.

## 6. Completion criteria

- [ ] `src/game/CLAUDE.md` made room in first (detail moved to `docs/reference/game.md`), then its lines fixed; under 8 KB.
- [ ] C2 in the code as written: `Material`'s trophies and `materialName`, `describeCost`, six workshop levels, `forge*`, `temper*`, `forgedValue`, `craftCost`, `highestGrade`, `craftables`, `salePrice`, the `FUSE_LEVELS` comment, the encampment's lines, `TROPHIES`, `trophiesFor`, `takeTrophies`, `SAVE_VERSION` 31, the debug `MATERIALS`.
- [ ] §5's tests written and passing; `npm test` passes.
- [ ] Refactor guard untouched and green; 50-campaign check identical, recorded in `log.md` ("Step 03").
- [ ] `docs/reference/game.md`, `docs/reference/characters.md` (and `src/inventory/CLAUDE.md` if wrong) updated.
- [ ] One commit, "Stage 10 step 03: the workshop", files staged by path, no attribution lines; the index's row 03 updated with status and commit.

## 7. Execution record
