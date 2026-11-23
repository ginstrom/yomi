# Step 08: The scenes

[Plan index](index.md) · [Stage design](../../designs/long-campaign/stage-10-forging-and-high-tiers.md) (§2 "Scenes", §4 What the player sees, §6 Verification) · [Gear reference](../../designs/long-campaign/reference/gear-and-runes.md) §4.2, §4.3, §5.7 · [Economy reference](../../designs/long-campaign/reference/economy-and-trade-routes.md) §4.3 · [Stages index](../../designs/long-campaign/index.md) ("Sprites", "Docs") · [Plan log](log.md)

**Difficulty:** sonnet / opus. The engineer builds screens on fixed domain contracts and the scenes' existing patterns (tabs, filters, pagers, probes); set `model: "sonnet"`. **Escalate to opus** (model unset) if the Forge tab or the Goods rows cannot be made to fit 840 × 560 without redesigning the screen. The reviewer (opus) checks that the scenes decide nothing (every cost, refusal and option comes from the domain), that the probes carry what the tests click, and that nothing else on the screens moved.

## 1. Objective

The player can see and use what steps 02 to 05 built:
- the workshop screen (`CraftingScene`) gains a **Forge** tab between Modify and Runes: families by slot, the tiers the workshop allows, each one's cost, and its stats against what a chosen member wears;
- the **Modify** tab offers **Temper** for a tier-3+ item;
- items of tiers 3 to 5 are **tinted** by their material, as tier 2's are today;
- the trading post's **Buy** tab lists **partners' goods** from the Market Hall;
- a won battle's **victory lines** list trophies (none drop until stage 11; the path is wired and tested);
- **stock text** names materials by `materialName` ("wyvern hide");
- the encampment draws the workshop at levels 4 to 6 with step 05's frames;
- the world map header's stock stays clear of the party column at 840 × 560 (carried item, low priority).

No rule changes here.

## 2. Requirements and context

- **Design §2, Scenes:** CraftingScene's Forge tab (families by slot, the allowed tiers, the cost, and stats against what is worn); Temper, inside the Modify tab; material tints for tiers 3 to 5; the trading post's partners' goods.
- **Design §4, what the player sees:** at workshop level 4 with 20 mithril, the Forge tab offers a Mithril Longsword for 30 gold and 8 mithril. Forged, it has one socket; tempered to Masterwork it has two. The fighter's damage line rises from 1d8+6 to about 1d8+12. At the Market Hall, Stonehollow's mithril sells for 3 gold a unit.
- **Design §6 tests:** scene tests for the Forge tab and Temper.
- **Gear §5.7:** the Forge tab lists families by slot, the tiers the workshop allows, the cost, and the stats against the item worn; `gearCompare.ts` compares.
- **Scenes decide nothing** (`src/scenes/CLAUDE.md`): the options, costs and refusals come from `forgeOptions`, `forgeRefusal`, `temperCost`, `temperRefusal`, `goodsForSale` and `buyGoodRefusal`. Logic that can be Phaser-free (rows, labels, which temper options an item has, the trophies line) goes in a sibling helper module with tests, in the `domain` project.
- **Carried item 6** (stage 9 PR): the world map header's stock can run to three lines at 840 wide, partly under the party column; the new materials make the stock longer. Low priority.

### Decisions from the index this step applies (unchanged)

1. **Cloth gets tiers 3 to 5** *(settled by the user, 2026-11-23: the default)*. S10-R1 asks tiers 3 to 5 "in every family", but gear §4.2's ladders are metal, wood and hide only, and stage 3 added a fourth kind, cloth (Linen, Silk), for the robe. Default: **Mithrilweave** (3), **Adamantweave** (4) and **Starweave** (5), forged from the tier's ore (mithril, adamant, starmetal), so the mage's robe follows the staff. Alternative: the robe stops at Silk (tier 2), an exception to R1. Either is a few data rows in C1.
6. **Tempering** goes straight to the asked grade at that grade's cost (gold tier × 10 × grade, the tier's material 4 × grade), at workshop level 3 and up (gear §4.3: "at any level 3+"), only for a tier-3+ plain item; it keeps the modifier and runes. Modifiers at workshop levels 4 to 6 stay at grade 3 at most (`highestGrade` clamped: without it level 4 would offer a grade 4).
8. **Trophies this stage are data and a path, with no entries** *(settled by the user, 2026-11-23: the default)*: no wolf, wyvern, basilisk or dragon exists until stage 11, so `TROPHIES` is empty, and granting is wired (the victory screen, the simulator) and tested with an injected table. Elder Glade sells **wyvern hide** at the Market Hall as the design's stand-in; **basilisk scale and drake scale have no source in play until stage 11** (debug `stock` only), so hide tiers 4 and 5 cannot be forged in play this stage.
9. **Partners' goods** *(settled by the user, 2026-11-23: the default)*: from the Market Hall (trading post 5 and up), each **contacted partner not silent** sells its good (and Elder Glade its stand-in) at 3 gold a unit, bought into the stock in any whole amount. The design says only "for sale at the Market Hall"; silence is read as the route's rule (a silent partner pays nothing). The simulator does not buy goods (the spend order is stage 12's).
11. **Workshop sprites for levels 4 to 6** (step 05): the design lists none, but the encampment draws a facility by `camp_<facility>/level_<n>`, and the stages index says a stage is not done while something falls back to a placeholder.
17. **Stock text names materials** by `materialName` (`wyvern_hide` reads "wyvern hide"); `describeCost` uses it.
18. **The world map header's stock** (carried, low priority): step 08 checks it at 840 × 560 with a stock holding every material; a layout fix within `headerLines` and the header is in scope, anything larger is recorded and left.
20. **Out of scope:** market income, the simulator's spend order, the company's long-campaign policy skew and home-country spawns (stage 12); the Source's guardians stay at `SOURCE_FOE_LEVEL` 6 (stage 11); trophies from kills and `--player-kit` (stage 11); gear §5.8's step 3 ring-element wards and step 4 unique items by `gearScore`; the trading post selling tier 3+.

### Contract produced (copied unchanged from the index)

**C7. The scenes (step 08)**

```ts
// src/scenes/CraftingScene.ts: tabs Modify, Forge, Runes.
//   Forge: a slot filter (weapon, shield, armour, head, gloves, boots), the slot's forgeOptions rows (family, material, cost),
//     a member picker (the party's members, the first by default), the chosen row's stats against that member's worn item
//     in the slot (gearCompare), its refusal, and a Forge button (forge(); the item to the baggage; a message).
//   Modify: a tier-3+ item also offers "Temper to Fine" and "Temper to Masterwork", with temperCost and temperRefusal.
//   Probe: tab 'forge', control forgeTab, the forge rows (family, material, tier, cost text, refusal), the member picker,
//     the Forge button; temper options among the modify options.
// src/scenes/itemIcons.ts: MATERIAL_TINTS gains every tier-3+ material id of C1; iconTint tints every tier from 2 by its material.
// src/scenes/TradingPostScene.ts: from GOODS_LEVEL the Buy tab's filter row gains "Goods", listing goodsForSale rows
//   ("Mithril, from Stonehollow: 3 gold a unit") with Buy 1 and Buy 5 and the refusal; the probe lists them.
// src/scenes/BattleScene.ts: on a win, takeTrophies beside takeRunes; the victory lines list trophies ('Trophies: 3 wyvern hide') when any.
// Stock text in the scenes names materials by materialName.
// src/scenes/WorldScene.ts: at 840 × 560 with a stock of every material, the header's stock stays clear of the party column (decision 18).
```

### Contracts consumed (copied unchanged from the index; built by steps 02, 03, 04, 05)

**C1. Tiers 3 to 5 and bandit gear (step 02)**

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
// TIER_BONUS: Record<GearClass, Record<Tier, ItemStats>>, tiers 1 and 2 unchanged; a damage entry adds to the roll's bonus:
//   weapon: 3 { damage +4, toHit +5 }      4 { damage +6, toHit +5, armorPierce +1 }   5 { damage +8, toHit +10, armorPierce +1 }
//   shield: 3 { acBonus +4 }               4 { acBonus +6, resistance +1 }             5 { acBonus +8, resistance +1 }
//   armour: 3 { acBonus +4, resistance +1 } 4 { acBonus +6, resistance +2 }            5 { acBonus +8, resistance +3 }
//   small:  3 { acBonus +1 }               4 { acBonus +2 }                            5 { acBonus +3 }
export const SMALL_RESISTANCE: Record<Tier, number> = { 1: 0, 2: 0, 3: 1, 4: 1, 5: 2 }   // added only to a small-slot family whose tier-1 stats have resistance
export function tierStats(stats: ItemStats, cls: GearClass, material: MaterialDef): ItemStats
//   the tier's bonus (and SMALL_RESISTANCE), then the material's strength relief and caster-friendliness; tiers 1 and 2 give exactly today's stats
// A plain item's id stays `<material>_<family>` (tier1's id and name only at tier 1): mithril_longsword "Mithril Longsword",
//   drake_leather "Drake-scale Leather", elderwood_shield "Elderwood Shield", starweave_robe "Starweave Robe".

// src/inventory/inventory.ts: BASE_ITEMS = every family × every material of its kind, FAMILIES order, then MATERIALS order
//   (so each family's tiers 1 and 2 come first, as today): 28 families × 5 tiers = 140. Item.tier is the 1–5 Tier.
// src/inventory/runes.ts: SOCKETS_BY_TIER: Record<Tier, number> = { 1: 0, 2: 1, 3: 1, 4: 2, 5: 2 }; Masterwork +1, at most MAX_SOCKETS (3); a small-slot item at most 1 (unchanged)

// src/game/tradingPost.ts: the post never sells tier 3 and up: sells() false and buyPrice() null for tier >= 3;
//   buyRefusal says 'The trading post does not sell that; the workshop forges it.'; wares() and TIER_PRICE stay tiers 1 and 2

// src/game/bandits.ts
// GEAR: each role's ids at tiers 1 to 5, the same family in each tier's material
//   (cutthroat iron_dagger … starmetal_dagger; archer yew_bow, ironwood_bow, elderwood_bow, wyrmwood_bow, heartwood_bow; captain's shield oak_shield … heartwood_shield; …)
export function banditGear(threat: number): BanditGear
//   >= 18: { tier: 5, grade: 3 }   12–17: { tier: 4, grade: 2 }   9–11: { tier: 3, grade: 2 }   (decision 10)
//   8: { tier: 2, grade: 3 }   6–7: { tier: 2, grade: 2 }   4: { tier: 1, grade: 1 }   else { tier: 1, grade: 2 }   (unchanged)
```

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

**C3. Partners' goods at the Market Hall (step 04)**

```ts
// src/game/tradingPost.ts
export const GOODS_LEVEL = 5   // the Market Hall
export const GOOD_PRICE = 3    // gold a unit
/** Goods a partner sells besides its own until stage 11 brings their monsters (decision 8). */
export const STAND_IN_GOODS: Readonly<Record<string, readonly Material[]>> = { elder_glade: ['wyvern_hide'] }
export interface GoodOffer { partner: string; name: string; material: Material }
export function goodsForSale(world: WorldState): GoodOffer[]
//   from GOODS_LEVEL: each contacted partner that is not silent, in PARTNERS order, its good then its stand-ins; empty below GOODS_LEVEL
export function buyGoodRefusal(game: GameState, party: Expedition, material: Material, amount: number): string | null
//   in order: not at the encampment; below GOODS_LEVEL ('A level 5 trading post sells partners' goods.'); no partner offers it;
//   amount not a whole number of at least 1; gold short ('It costs N gold, more than the stock holds.')
export function buyGood(game: GameState, party: Expedition, material: Material, amount: number): string | null
//   spends GOOD_PRICE × amount gold and adds `amount` to the stock
```

**C4. Workshop sprites (step 05)**

`camp_workshop` (`art/encampment/`) gains frames `level_4`, `level_5`, `level_6`, at the size and in the style of `level_1` to `level_3`, each grander (a forge with a stack and bellows at 4, a second hearth at 5, a star-lit great forge at 6, or as the sprite guidance suits). `facilityFrame` already names them; nothing in `src/` changes.

The code as built is the reference: where a prior step's execution record says it departed from a contract (for example decision 1's cloth rows dropped by the user), build on the code and say so.

### Shared constraints (from the index)

- **Commands** (local Node 26: prefix `PATH=/opt/homebrew/opt/node@26/bin:$PATH`; or the podman `make` targets):
  - `npm test` (`tsc && vitest run`) is the gate before every commit; `npx vitest run <file>` for one file;
  - `npm run test:browser` (or `-- -t <name>`) after any scene change; read `e2e/CLAUDE.md` before adding an in-browser test;
  - `npm run simulate -- <flags>`: **never run two simulations at once**. **This step runs none**: it changes no rule the campaign plays (say so in the record).
- **The refactor guard** (`scripts/simulate.test.ts`, `describe('the refactor guard')`) and **the policy snapshot** (`src/engine/policies.test.ts`): this step must not edit them and keeps them green (part of `npm test`). A mismatch means the step changed play: find the cause and fix it. The 50-campaign check need not run (no rule changes; say so).
- **Determinism.** No draw of the world RNG or a battle's RNG is added, dropped or reordered. `takeTrophies` draws nothing; it is called beside `takeRunes`, after it, and never changes what `takeRunes` draws.
- **Import cycles.** `crafting.ts`, `runecraft.ts` and `company.ts` are in a cycle (`src/game/CLAUDE.md`), as are `blight.ts`, `territory.ts`, `worldMap.ts`, `trade.ts` and `buildings.ts`; `tradingPost.ts` may call `crafting.ts`'s `forgedValue` and `trade.ts`'s readers only inside functions. `catalog.ts` and `inventory.ts` import each other: nothing at module load. `catalog.ts` imports nothing from `src/game/`.
- **Versions.** `SAVE_VERSION` 31 (step 03), no migration; `LOG_SCHEMA_VERSION` unchanged. This step changes neither.
- **Content.** `.claude/skills/yomi-add-content/facility.md` (the workshop's new levels on the encampment screen and in the manual); no new item icon (tiers 3 to 5 share their family's icon, tinted). Manual: `.claude/skills/yomi-manual/`. Sprites are step 05's; never edit an exported PNG.
- **Commits.** One commit once `npm test` and `npm run test:browser` pass, on `long-campaign-stage-10`, without pushing; files staged by path. Message "Stage 10 step 08: the scenes". No attribution lines.
- **Docs.** Fix the CLAUDE.md lines this change makes wrong (`src/scenes/CLAUDE.md` if a helper module is a new view helper; it lists only the Phaser-importing ones) and `docs/reference/scenes.md` (the workshop screen's three tabs, Temper, the Goods filter, the tints, the trophies line, the probe fields). `scripts/claudeMd.test.ts` caps each directory's `CLAUDE.md` at 8 KB. Write the manual's text for these screens; step 11 retakes the screenshots.

## 3. Dependencies and prerequisites

- **Steps 02, 03 and 04 done** on the stage branch: C1, C2 and C3 exist (`forgeOptions`, `forge`, `temperCost`, `temperRefusal`, `temper`, `takeTrophies`, `materialName`, `goodsForSale`, `buyGood`, `buyGoodRefusal`, `GOODS_LEVEL`, `GOOD_PRICE`). Read their execution records for any departure.
- **Step 05 merged** (C4): `public/assets/sprites/camp_workshop__level_4.png` to `__level_6.png` exist. Without them the encampment at level 4 asks a missing frame, which the in-browser tests fail on (console errors); if 05 was dropped by the orchestrator, map levels 4 to 6 to `level_3` in `facilityFrame`'s caller and say so.
- Steps 07, 09 and 10 may run beside this one (the simulator track): no file overlaps but the index's table (update your row only). This step's in-browser runs load the machine: tell the orchestrator when they run, so timings in 07 and 10 are read with care.
- **Environment:** Node 26; Playwright's Chromium (`npx playwright install chromium` if missing).

### Existing code (at `f3a1102`; line numbers approximate)

- `src/scenes/CraftingScene.ts`: `type Tab = 'modify' | 'runes'` (line 85); tab buttons at `TAB_Y` (`modifyTab` at x 140, `runesTab` at x 280, width 120, line 288); `show(tab)` resets selection, message and pages (line 534); `craftables` / `options` feed the Modify list; the `ui.tab` cue for tab buttons, `buttonCue` / `refusalCue` for the rest (line 518); redraw on the next tick (`src/scenes/CLAUDE.md`).
- `src/scenes/gearCompare.ts`: `statLines(item, ap, strength)`, `compareLines(before, after, ap, strength)`, `attackCostWarning`, `wardsLines`.
- `src/scenes/runecraftView.ts`: the Runes tab's Phaser-free helper; follow its shape for a Forge helper.
- `src/scenes/itemIcons.ts`: `MATERIAL_TINTS` (steel, ironwood, wolfhide, silk) and `iconTint(item)`, tier 2 only (line 52–62).
- `src/scenes/TradingPostScene.ts`: `type Tab = 'buy' | 'sell' | 'routes'`; the Buy tab's filter `{ slot: EquipmentSlot | 'runes'; family }` (slot buttons and Runes across the frame, families under them), rows paged; `TAB_Y` 96.
- `src/scenes/BattleScene.ts`: at the victory (around line 2439) `takeRunes(this.gameState, threat, encounter, seed)` then `rewardVictory` and `describeRewards`, `foundNames(found, foundRunes)`.
- `src/scenes/WorldScene.ts`: the header's stock from `statusLines`, wrapped by `headerLines(lines, chars, maxLines)` (`headerLines.ts`) and placed by the method near line 1308.
- `src/scenes/encampmentView.ts`: `facilityFrame` draws `camp_<facility>/level_<n>`; `EncampmentScene.ts` shows "Next: … Cost: describeCost(…)".
- `src/testHook.ts`: `CraftingProbe` (`tab: 'modify' | 'runes'`, `items`, `options`, `chosen`, `preview`, …), the trading post's probe.
- `e2e/encampment.test.ts`: the trading post and workshop flows, `plant` by dotted path (`'world.workshop'`), "every facility at its top" (plants `'world.workshop': 3`: becomes 6), the Runes tab test.

## 4. Scope and guidance

### 4.1 The Forge tab

- `Tab` gains `'forge'`, its button between Modify and Runes (re-place the three at `TAB_Y`, each as wide as fits the frame); the `ui.tab` cue.
- A slot filter (Weapon, Shield, Armour, Head, Gloves, Boots), as the trading post's Buy filter does, opening on Weapon.
- The rows: `forgeOptions(game, party, slot)`, one a family and material ("Mithril Longsword — 30 gold, 8 mithril"), paged as the screen's lists are. Below workshop level 4 the list is empty: say why ("A level 4 workshop forges mithril, elderwood, wyvern-hide and mithrilweave.").
- A member picker (the party's members, the first by default; their names or portraits as fits); the chosen row's preview: `compareLines(worn, item, member's AP, member's strength)` against that member's worn item in the slot (or `statLines` when the slot is empty), the sockets the item would have, and the refusal last if any.
- A Forge button, greyed with a refusal; on click `forge(game, party, family, material)`; a message ("The Mithril Longsword is in the baggage."), the stock text redrawn; a refusal sounds through `refusalCue`.
- The rows, labels and preview lines come from a Phaser-free helper (for example `forgeView.ts`, beside `runecraftView.ts`), with tests.

### 4.2 Temper in the Modify tab

- `craftables` now lists tier-3+ items even where no modifier fits (C2). For a selected tier-3+ item, the options gain "Temper to Fine" and "Temper to Masterwork" (only grades above the item's), each with `temperCost` and greyed by `temperRefusal`; on confirm `temper(game, place, grade)`. The item keeps its modifier and runes; a Masterwork item shows its extra socket.
- The temper options' ids in the probe: `temper2`, `temper3`, beside the modifiers' `<modifier><grade>`.
- The helper decides which temper options an item has and their labels; tested.

### 4.3 Tints for tiers 3 to 5

`MATERIAL_TINTS` gains every tier-3+ material id of C1 (mithril, adamant, starmetal, elderwood, wyrmwood, heartwood, wyvern, basilisk, drake, mithrilweave, adamantweave, starweave), each distinct from tier 2's and readable on the panels' dark brown; `iconTint` tints every tier from 2. Stage 3 found steel's tint hard to tell from iron at list size: choose tiers 3 to 5 so the ladder reads at a glance (a test that each tier-3+ material has a tint and that the twelve plus tier 2's four are distinct).

### 4.4 Partners' goods on the Buy tab

- From `GOODS_LEVEL` the Buy filter row gains "Goods" (after Runes). Its rows: `goodsForSale(world)`, "Mithril, from Stonehollow: 3 gold a unit" (`materialName`, `GOOD_PRICE`), each with Buy 1 and Buy 5, greyed by `buyGoodRefusal`; on click `buyGood(...)` and a message; the stock redrawn. With no partner contacted the list says so ("No contacted partner trades here yet.").
- Below `GOODS_LEVEL` the Goods button is absent (or greyed with "A level 5 trading post sells partners' goods."; the implementer's choice, recorded).
- The trading post's probe lists the goods rows (partner, material, label) and their buttons.

### 4.5 Trophies on the victory screen

In `BattleScene`'s victory, after `takeRunes`, call `takeTrophies(this.gameState, encounter kinds)` on a win at a location (not for debug `fight`, which takes no loot); the victory lines gain "Trophies: 3 wyvern hide" (amounts by `materialName`) when it returned any. The line comes from a Phaser-free helper (for example beside `describeRewards`), tested with a stock as `trophiesFor` would return from an injected table, since `TROPHIES` is empty this stage (decision 8).

### 4.6 Stock names and the header (decisions 17, 18)

- Every stock line the scenes write (the world map header, the encampment's stock line and "Cost:", the trading post's Sell materials, the workshop's costs) names materials by `materialName` or through `describeCost`.
- The header (carried item, low priority): plant a stock of every material (the twenty of C2) and look at the world map at 840 × 560. If the stock text runs under the party column (`PARTY_PANEL_W`) or past the header, fix it within `headerLines` and the header's placement (for example a "+N more" cut, which `headerLines` already knows, or fewer materials named), with a test of `headerLines` at that width. Anything larger (a stock panel of its own) is recorded in the execution record and left.

### 4.7 The encampment

The workshop at levels 4 to 6 draws `camp_workshop/level_4`–`6` (step 05); its effect lines come from `encampment.ts` (step 03). Check the labels at 840 × 560 (the overlap test in `e2e/encampment.test.ts`).

### 4.8 Probes

`src/testHook.ts`: `CraftingProbe.tab` gains `'forge'`; controls gain `forgeTab`; the Forge tab's fields: the slot filter's buttons, `forgeRows` (family, material, tier, cost text, refusal, button), the member picker's buttons and the chosen member, the Forge button. The trading post's probe gains the goods rows. Plain JSON data, as the others.

### 4.9 Tests

- **Helper tests** (`domain` project): the Forge rows and preview for a fixed game (workshop 4, 20 mithril, 500 gold: a Mithril Longsword row costing "30 gold, 8 mithril"; a Mithril Greatsword costing 16 mithril; at workshop 3 no rows and the reason); the temper options of a tier-3 plain, Fine and Masterwork item, and none for a tier-2 one; the goods rows' labels; the trophies line from an injected table; tints.
- **Scene smoke tests** (`src/scenes/CraftingScene.test.ts`, `TradingPostScene.test.ts`, jsdom): the Forge tab opens and lists; the Modify tab lists temper options; the Buy tab's Goods filter at level 5.
- **In-browser tests** (`e2e/encampment.test.ts`; read `e2e/CLAUDE.md`): plant workshop 4, 500 gold and 20 mithril; open the workshop's Forge tab, forge a Mithril Longsword (the stock down 30 gold and 8 mithril, the item in the baggage); equip it or temper it from the baggage on the Modify tab to Masterwork; see two sockets (the Runes tab lists it with two). Plant the post at 5 and Stonehollow contacted (`world.contacted`); buy 5 mithril on Goods (the stock up 5, gold down 15). Update "every facility at its top" to workshop 6, and check the workshop's labels at 840 × 560.

### 4.10 Manual

`docs/manual/README.md` (`.claude/skills/yomi-manual/`): the workshop's levels 4 to 6 and what each unlocks; the Forge tab (families by slot, tiers, costs, the comparison); tempering on the Modify tab (tiers 3 to 5 only; the trading post grades tiers 1 and 2); the materials of tiers 3 to 5 and where they come from (far sites, the Market Hall's goods, trophies from stage 11); partners' goods at the Market Hall. Text only: step 11 retakes the screenshots and adds a Forge tab shot.

### 4.11 Exclusions

No rule, cost or constant change (they are steps 02–04's); no simulator change; no new debug command (step 06); no screenshots (step 11); no new icon or sprite.

## 5. Verification

- `npm test` passes (helper tests, scene smoke tests, the refactor guard and the policy snapshot unchanged).
- `npm run test:browser` passes, with the new Forge, Temper and Goods tests; a console error fails a test, so a missing frame shows.
- Looked at, at 840 × 560: the workshop's three tabs, a Forge row's comparison, Temper on the Modify tab, the Buy tab's Goods, the encampment at workshop 6, the world map header with every material in the stock. Screenshots kept outside the repository (the scratchpad or `logs/`), named in the record.
- No simulation was run (no rule changed).

## 6. Completion criteria

- [ ] The Forge tab, Temper, tints, Goods, trophies line, stock names and encampment levels 4–6 built on C1–C4, as C7.
- [ ] Probes typed in `src/testHook.ts`; helpers Phaser-free with tests.
- [ ] Scene smoke tests and in-browser tests for the Forge tab, Temper and Goods pass; "every facility at its top" at workshop 6.
- [ ] The header's stock at 840 × 560 checked; fixed within `headerLines`, or recorded and left (decision 18).
- [ ] Manual text and `docs/reference/scenes.md` updated.
- [ ] One commit, "Stage 10 step 08: the scenes", files staged by path, no attribution lines; the index's row 08 updated with status and commit.

## 7. Execution record
