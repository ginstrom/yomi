# Step 11: Document and play

[Plan index](index.md) · [Stage design](../../designs/long-campaign/stage-10-forging-and-high-tiers.md) (§4 What the player sees, §6 Verification, "Done when") · [Gear reference](../../designs/long-campaign/reference/gear-and-runes.md) §4.2, §4.3, §5.4, §5.8 · [Economy reference](../../designs/long-campaign/reference/economy-and-trade-routes.md) §4.3 · [Stages index](../../designs/long-campaign/index.md) ("Docs", "Gameplay verification", "The early-game guard") · [Plan log](log.md)

**Difficulty:** sonnet / opus. By this step every rule, constant and figure is decided (steps 01–10), so the engineer (`model: "sonnet"`) writes them down and walks the play script; it judges no balance. The reviewer (opus) checks the docs against the code, the figures against step 10's record and `log.md`, and that the play script was really walked.

## 1. Objective

Close the stage:
- bring the CLAUDE.md files, `docs/reference/`, the balance and add-content skills, the manual and its screenshots up to date with steps 01–10;
- write the stage design's "Implementation notes" (step 10's figures, step 07's timings, the departures) and mark stage 10 in the stages index;
- walk the design's play script in the real game and record what was seen.

No rule, constant or band changes here. If the docs or the play script show a bug, fix it test-first only if it is small and in this stage's code; otherwise stop and report it. A part of the play script that disagrees with the design (for example a fight that is not fair) is recorded and brought to the orchestrator, not tuned.

## 2. Requirements and context

- **Stages index, "Docs":** each stage updates CLAUDE.md (architecture, rules of scaling, simulator flags) and the player's manual for what it adds, and on completion adds a short "Implementation notes" section to its own design doc, with the figures measured.
- **Stages index, "Gameplay verification":** a stage is done when its tests pass, its simulator checks hold and its play script has been walked in the game.
- **Design "Done when":** all tests pass, the guard holds, the gear policy tracks the expected kit within a tier, and the play script has been walked.
- **Design §6, play script** (walked here; `level` is step 06's command):
  1. Run `facility workshop 6` and `stock gold 500 mithril 30 adamant 30 starmetal 20`. Forge one item of each tier, temper one to Masterwork, and fill its sockets.
  2. Fuse ranks up to 4.
  3. With `xp` to level 15 and an adamant kit, fight a threat 15 Freebooter Host. It should be a fair fight. With iron, it should be a rout.
  4. Buy mithril at the Market Hall.
- **Design §4, what the player sees:** at workshop level 4 with 20 mithril, the Forge tab offers a Mithril Longsword for 30 gold and 8 mithril; forged, it has one socket; tempered to Masterwork it has two. The fighter's damage line rises from 1d8+6 to 1d8+12 or so. At the Market Hall, Stonehollow's mithril sells for 3 gold a unit.

### Decisions from the index this step documents (unchanged)

1. **Cloth gets tiers 3 to 5** *(settled by the user, 2026-11-23: the default)*. S10-R1 asks tiers 3 to 5 "in every family", but gear §4.2's ladders are metal, wood and hide only, and stage 3 added a fourth kind, cloth (Linen, Silk), for the robe. Default: **Mithrilweave** (3), **Adamantweave** (4) and **Starweave** (5), forged from the tier's ore (mithril, adamant, starmetal), so the mage's robe follows the staff. Alternative: the robe stops at Silk (tier 2), an exception to R1. Either is a few data rows in C1.
2. **Hide materials' catalog ids hold no underscore** (`wyvern`, `basilisk`, `drake`; names "Wyvern-hide", "Basilisk-scale", "Drake-scale", so "Drake-scale Leather"): a plain id splits at its first underscore. `MaterialDef.stock` names the stock material each tier-3+ material spends (`wyvern_hide`, …), keeping `catalog.ts` free of game imports.
3. **Mithril and Starmetal also halve their families' spell-skill penalties** *(settled by the user, 2026-11-23: the default)*. The stage lists only "strength relief"; gear §4.2's same bullet adds the halving (`casterFriendly`). Default: both, as the reference says (toward 0: −5 → −2, −15 → −7). Alternative: strength relief only.
4. **Tier bonuses as gear §4.2's table**, read: a small-slot item's "resistance when it has any" goes to a family whose tier-1 stats have resistance (helm, gauntlets, greaves); every weapon's tier-4 and -5 "pierce +1" is `armorPierce` +1 (a tier now touches piercing: the catalog's and the inventory guide's "a tier never changes piercing" are corrected).
5. **`forge` and `temper` take the party** (the project's `(game, party)` convention; the design writes `forge(game, family, material)` and `temper(game, place, grade)`, and `temper` keeps its place, which names the party).
6. **Tempering** goes straight to the asked grade at that grade's cost (gold tier × 10 × grade, the tier's material 4 × grade), at workshop level 3 and up (gear §4.3: "at any level 3+"), only for a tier-3+ plain item; it keeps the modifier and runes. Modifiers at workshop levels 4 to 6 stay at grade 3 at most (`highestGrade` clamped: without it level 4 would offer a grade 4).
7. **A forged item's worth** is 1.5 × (its forge gold + the temper gold of its grade), sold for half (gear §5.5); the material is not counted.
8. **Trophies this stage are data and a path, with no entries** *(settled by the user, 2026-11-23: the default)*: no wolf, wyvern, basilisk or dragon exists until stage 11, so `TROPHIES` is empty, and granting is wired (the victory screen, the simulator) and tested with an injected table. Elder Glade sells **wyvern hide** at the Market Hall as the design's stand-in; **basilisk scale and drake scale have no source in play until stage 11** (debug `stock` only), so hide tiers 4 and 5 cannot be forged in play this stage.
9. **Partners' goods** *(settled by the user, 2026-11-23: the default)*: from the Market Hall (trading post 5 and up), each **contacted partner not silent** sells its good (and Elder Glade its stand-in) at 3 gold a unit, bought into the stock in any whole amount. The design says only "for sale at the Market Hall"; silence is read as the route's rule (a silent partner pays nothing). The simulator does not buy goods (the spend order is stage 12's).
10. **Bandit gear grades by ring** *(settled by the user, 2026-11-23: the default)*: Mithril **Fine** at threats 9–11, Adamant **Fine** at 12–17, Starmetal **Masterwork** from 18 (the expected kit's grades at those levels, gear §5.8); threat 8 keeps Masterwork steel, below as today. The design gives the tiers and thresholds only.
11. **Workshop sprites for levels 4 to 6** (step 05): the design lists none, but the encampment draws a facility by `camp_<facility>/level_<n>`, and the stages index says a stage is not done while something falls back to a placeholder.
12. **The gear policy applies families by role only from tier 3** *(settled by the user, 2026-11-23, **not** the plan's default "from tier 1, gated")*: below tier 3 the simulator keeps today's policy (in-family buying at tiers 1 and 2), so the early figure should not move. Step 09's gate stays as a check: if `one` still moves more than about 5 points from step 01's baseline, it stops and reports. Step 09's task file says so.
13. **The policy's details the design leaves open** (step 09; first values, recorded): the fighter switches to the war hammer when the lead foe (the first enemy unit) of the vanguard's next target, built at its threat, has resistance 4 or more; the archer's crossbow from tier 3; "the best body armour their strength allows" is the engineer's documented rule; fusing any rank the workshop allows (gear §5.8 step 3, which "fill sockets" needs at ranks 3–4); tier-3+ ores, woods and trophies are never sold as surplus; trophies are taken (none drop yet); no partner goods.
14. **The refactor guard** stays identical through steps 02, 03, 04 and 07 (no tier-3+ item, workshop above 3, good or bandit above threat 8 reaches the early campaign); **step 09 re-records it once** (its new record fields and the policy), with old and new figures; step 10 only for a retune the orchestrator approved. **The policy snapshot** is re-recorded in step 02 (bandits at threats 9 and up), only those lines changing.
15. **The auto-resolve estimate is made faster only in ways that keep every estimate byte-identical** (step 07, carried item); a change that alters an estimate (fewer samples, stopping early) is brought to the user with figures, not made.
16. **High levels in the debug console** (step 06, carried item): a `level <n>` command, with `auto` to spend points along `planFor`'s plan, rather than a bigger `xp` (whose 50000 reaches about level 12 only because each level costs more).
17. **Stock text names materials** by `materialName` (`wyvern_hide` reads "wyvern hide"); `describeCost` uses it.
18. **The world map header's stock** (carried, low priority): step 08 checks it at 840 × 560 with a stock holding every material; a layout fix within `headerLines` and the header is in scope, anything larger is recorded and left.
19. **Versions:** `SAVE_VERSION` 30 → 31 in step 03 (the trophies in `Material`, as the design asks), no migration (older saves read as unreadable, stages 8–9's practice). `LOG_SCHEMA_VERSION` unchanged: no battle event changes shape.
20. **Out of scope:** market income, the simulator's spend order, the company's long-campaign policy skew and home-country spawns (stage 12); the Source's guardians stay at `SOURCE_FOE_LEVEL` 6 (stage 11); trophies from kills and `--player-kit` (stage 11); gear §5.8's step 3 ring-element wards and step 4 unique items by `gearScore`; the trading post selling tier 3+.

How the user answered the decisions marked *(for the user)* is in the index and the feature record; where an answer, or a step's execution record, departed from a decision or contract, **document the code as built, not the decision's wording.**

### Contracts this step documents (copied unchanged from the index)

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

**C5. The debug console reaches high levels (step 06)**

```ts
// src/scenes/debugCommands.ts, COMMANDS gains:
//   level: usage 'level <n> [member|all] [auto] [@party]'
//   raises each member named (all by default) to level n, a level at a time (levelUp), its experience toward the next level set to 0;
//   with `auto`, after each level autoAdvance(member, planFor(member)) spends its points as the simulator's raised party does;
//   refuses n not above a member's level ('<name> is level L already.') or above 20; changes the game (world map only).
// `xp` is unchanged.
```

**C6. A faster auto-resolve estimate (step 07)**

```ts
// Every Forecast is byte-identical to today's for the same (start, base, samples): a fixture of estimates recorded before any change
//   (src/game/forecast.test.ts) holds them; the refactor guard, the policy snapshot and the 50-campaign check stay identical.
// scripts/forecastCost.ts (new, committed): `node scripts/forecastCost.ts [--samples N]` prints the ms an estimate takes
//   for fixed starts: the ready-made party raised to 6, 12, 15 and 18 (as `raisedParty`), each member's worn weapon, shield and armour
//   the same family at tier 2, 3, 4 and 5 (Fine), against bandit_company 9, bandit_company 12, freebooter_host 15, freebooter_host 18.
// Anything that would change an estimate is brought to the orchestrator with figures (decision 15).
```

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

**C8. The simulator's gear policy, expected kit and record (step 09)**

```ts
// scripts/simulate.ts
export type KitRole = 'fighter' | 'archer' | 'mage'
export function kitRole(character: Character): KitRole   // its first tagged skill: melee → fighter, archery → archer, magic → mage
export interface ExpectedKit { tier: Tier; grades: readonly [Grade, Grade]; sockets: readonly [number, number]; ranks: readonly [Rank, Rank] }
export function expectedKit(role: KitRole, level: number): ExpectedKit   // gear §5.8's table, the same for every role:
//   1–4 { 1, [1, 2], [0, 0], [1, 1] }   5–8 { 2, [2, 3], [1, 2], [1, 2] }   9–12 { 3, [2, 2], [2, 3], [2, 2] }
//   13–16 { 4, [2, 3], [3, 4], [2, 3] }  17–20 { 5, [3, 3], [4, 6], [3, 4] }   (sockets: runes filled across the member's worn gear)
// CampaignRecord gains:
goldOnForging: number   // gold spent forging and tempering
kitAtLevel: Partial<Record<LevelMark, Array<{ role: KitRole; tier: number; sockets: number }>>>
//   the vanguard's members when its lowest level first reaches the mark (as battlesToLevel): main-hand tier (0 for an enchanted or no weapon)
//   and runes embedded across worn gear
// summarizeCampaigns averages them by mark and KitRole (with the campaigns reaching each mark); the printed summary gains a
//   "Kit:" line or table against expectedKit's tier and sockets, and goldOnForging in the gear line.
// visitFacilities: the gear policy of gear §5.8 steps 1 and 2 (families by role; for every member, main hand, then body armour, then shield,
//   then head, gloves, boots: buy (tiers 1–2) or forge (3–5) the highest tier affordable; then temper, modify (craftGear), fill sockets
//   (runecraftGear, fusing any rank the workshop allows)), with decision 13's details. The fighter's war hammer and the archer's crossbow
//   switches as decision 13. takeTrophies after each win (fightAt).
```

The code as built is the reference: where a step's execution record says it departed from a contract or a decision (for example the robe kept at tier 2, the halving dropped, the gear policy applied only from tier 3 after step 09's gate, a site yield or forge cost retuned in step 10, or the workshop's level 4 to 6 sprites dropped), document the code.

### Shared constraints (from the index)

- **Commands** (local Node 26: prefix `PATH=/opt/homebrew/opt/node@26/bin:$PATH`; or the podman `make` targets):
  - `npm test` (`tsc && vitest run`) is the gate before every commit; `npx vitest run <file>` for one file;
  - `npm run test:browser` (or `-- -t <name>`) after any scene change; read `e2e/CLAUDE.md` before adding an in-browser test;
  - `npm run simulate -- <flags>`: **never run two simulations at once**. This step runs none (it documents step 10's figures); if a figure is missing, say so rather than measure it here.
- **The refactor guard and the policy snapshot** are not touched by this step and must stay green (`scripts/simulate.test.ts`, `src/engine/policies.test.ts`). This step changes no rule the campaign plays, so it need not run the 50-campaign check (say so in the record).
- **Balance.** The user's bands (`.claude/skills/yomi-balance/bands.md`) are never changed; only its "Now" column is updated, from step 10's figures. Out-of-band figures were already brought to the orchestrator in steps 09 and 10; document what was decided.
- **Determinism.** No draw of the world RNG or a battle's RNG is added, dropped or reordered.
- **Versions.** `SAVE_VERSION` 31 (step 03), no migration; `LOG_SCHEMA_VERSION` unchanged.
- **Content.** `.claude/skills/yomi-add-content/` (`item.md`, `facility.md`, `debug-command.md`), `.claude/skills/yomi-manual/` for the manual and its screenshots.
- **Docs.** Fix every line the stage made wrong; search the CLAUDE.md files, `.claude/` and `docs/reference/` for every renamed or removed name or stale value. `scripts/claudeMd.test.ts` caps the root `CLAUDE.md` at 16 KB, each directory's at 8 KB (`src/game/CLAUDE.md` was at 7,765 bytes before step 03 made room), and the `.claude/` totals; when it fails, move detail into `docs/reference/` or a skill. `.claude/agents/*.md` and `.codex/agents/*.toml` are copies: change both if an agent changes.
- **Commits.** One commit, "Stage 10 step 11: document and play", on `long-campaign-stage-10`, without pushing; files staged by path; no attribution lines. Do not edit the feature record (`docs/features/long-campaign-stage-10.md`): the orchestrator does.

## 3. Dependencies and prerequisites

- **Steps 06, 08 and 10 are done** (and through them 01–05, 07 and 09), merged into the stage branch, step 05's sprites among them.
- **From `log.md` and step 01's execution record:** the stage's baseline (`one`, `company`, `rl10`, the 50-campaign hash, the long baseline of 100).
- **From step 02:** the policy snapshot's re-recorded lines and the answers to decisions 1, 3 and 10 as built.
- **From step 03:** the room made in `src/game/CLAUDE.md`, the refusal wordings, the workshop's effect lines, the answer to decision 8.
- **From step 04:** the goods as built and the answer to decision 9.
- **From step 06:** the `level` command's exact usage.
- **From step 07:** the estimate's times at levels 6, 12, 15 and 18 before and after (`scripts/forecastCost.ts`), what changed, and any option brought to the user and its answer.
- **From step 08:** the manual text it wrote, the probe fields (Forge tab, temper options, Goods rows), and what it did about the header stock.
- **From step 09:** the gear policy as built (the body-armour rule, the hammer and crossbow switches), the guard's old and new figures (doc comment above `GUARD_RECORDS`), the gate's result and the user's answer if it stopped.
- **From step 10's execution record and `log.md`:** every figure to document (early figures against step 01; the long run's kit at levels 5, 10, 15, 20 by role against `expectedKit`; Source share, battles to level, days against stage 9 and step 01; gold on forging; the far bandit cells; any site-yield or forge-cost retune and why; runtime).
- **Environment:** Node 26, Playwright's Chromium, a dev server (`npm run dev`, http://localhost:5173) for the play script.

## 4. Scope and guidance

### 4.1 Document

Read the code as it stands before writing; the contracts above say what was planned, the code what was built.

- **Root `CLAUDE.md`:** only lines the stage made wrong (for example a simulator row or a contract naming the workshop's levels). Keep it a map (16 KB).
- **`src/inventory/CLAUDE.md`:** the `catalog.ts` line ("a tier 1 and a tier 2 of each kind" → five tiers, strength relief and caster-friendliness, `MaterialDef.stock`); "What changes what" (a tier now adds piercing at 4 and 5, decision 4); "Rune fitting" (sockets by tier 1 to 5).
- **`src/game/CLAUDE.md`** (8 KB cap; step 03 made room): the scaling line replaced with "Scaling (stage 10, `--near-source`): …" with the early figure's move from step 01's baseline and its cause in a sentence; the `crafting.ts` line (forging and tempering, not only modifiers), `tradingPost.ts` (partners' goods), `loot.ts` (trophies), `bandits.ts` if it names tiers. Detail goes to `docs/reference/game.md`.
- **`scripts/CLAUDE.md`:** only if a line is wrong.
- **`docs/reference/characters.md`:** the materials table at five tiers (decisions 1, 2), `TIER_BONUS` and `SMALL_RESISTANCE` (decision 4), strength relief and the spell-skill halving (decision 3), sockets by tier, the 140 plain items, the forged items' names and ids.
- **`docs/reference/game.md`:** the workshop's levels 4 to 6 and costs; forging (`FORGE_LEVEL`, `FORGE_GOLD`, `FORGE_MATERIAL`, doubling, refusals); tempering (decision 6) and `highestGrade`'s clamp; `craftCost` at tier 3+; forged worth and sale (decision 7); fusing to ranks 3 and 4; trophies (`TROPHIES` empty, `takeTrophies`, gear §4.3's table for stage 11, decision 8); the four trophy materials and `materialName`; partners' goods (decision 9, `STAND_IN_GOODS`); bandit gear by ring (decision 10, replacing stage 9's stand-in); `SAVE_VERSION` 31, no migration.
- **`docs/reference/simulator.md`:** the gear policy (families by role, slot order, forge and temper on home visits, the switches, the body-armour rule, fusing, never-sold materials, no goods, trophies taken; decisions 12, 13), `kitRole`, `expectedKit`, the record's `goldOnForging` and `kitAtLevel`, the summary's "Kit:" line; `scripts/forecastCost.ts`.
- **`docs/reference/scenes.md`:** the Forge tab, Temper in the Modify tab, `MATERIAL_TINTS` at tiers 2 to 5, the Buy tab's Goods, the victory screen's trophies, stock names, the header stock (what step 08 did), the debug `level` command; the estimate's changes from step 07 where they touch "Auto-resolve".
- **`.claude/skills/yomi-balance/`:**
  - `levers.md`: the economy's levers for gear, in the design's order (gear §6): outer site yields (`RESOURCE_YIELDS`), then forge costs (`FORGE_GOLD`, `FORGE_MATERIAL`, temper costs); bandit gear by ring (`banditGear`); the long campaign's figures with gear as context.
  - `bands.md`: the "Now" column from step 10's figures, marked "(stage 10)"; never a band value. Add the "Kit:" line to the measure notes only if `running.md` does not carry it.
  - `running.md`: where the kit figures and gold on forging are printed ("Which line carries each figure"), timings if step 10 found them changed.
- **`.claude/skills/yomi-add-content/item.md`:** if forging adds a place to touch for a new family or material (for example `MATERIAL_TINTS`, `FORGE_*`, `MaterialDef.stock`), add the lines; `facility.md` if a facility's new level now has a place to touch (effect lines, sprite frames).
- **The manual** (`docs/manual/README.md`, via `.claude/skills/yomi-manual/`): the material tiers and what each adds; the workshop's levels 4 to 6; forging (the Forge tab, costs, where the ores come from); tempering; fusing to ranks 3 and 4; trophies to come (stage 11's monsters) and Elder Glade's wyvern hide; partners' goods at the Market Hall; bandits' gear by ring. Read step 08's text again against the code.
- **Screenshots:** `npm run manual:screenshots` (`e2e/manual.shots.ts`), then look at every retaken image. Add a shot of the Forge tab (workshop 4 or more, a Mithril Longsword chosen) and of the Buy tab's Goods (Market Hall, a contacted partner), in `e2e/manual.shots.ts`, and link them in the manual.
- **The stage design** (`docs/designs/long-campaign/stage-10-forging-and-high-tiers.md`): an "Implementation notes" section at its end, as stages 1–9 have: commits by step; departures (the index's decisions by number, and how the user answered those marked for the user); the early figures (step 01's baseline and step 10's, with `--near-source`); the long run's kit against `expectedKit` by level and role, gold on forging, Source share, battles to level and days against stage 9's and step 01's; any retune of site yields or forge costs and why; the far bandit cells; step 07's estimate times before and after; the header stock; what the play script showed. Set its status to done.
- **The stages index** (`docs/designs/long-campaign/index.md`): stage 10's row marked done with a link to its implementation notes and the guard's figure; the early-game guard convention's history sentence gains stage 10's figure (with `--near-source`) and its cause.
- **Stale names:** after the edits,

  ```sh
  grep -rn "tier 1 and a tier 2 of each kind\|a tier 1 and a tier 2\|Masterwork steel from threat 8\|no use until stage 10\|MAX_WORKSHOP_LEVEL = 3\|SAVE_VERSION = 30\|levels 1 to 3 unchanged\|never changes attack AP, range, piercing" src scripts e2e docs/reference docs/manual .claude CLAUDE.md
  ```

  should find nothing but history (plans, feature records and the designs' own history are left as history; "Masterwork steel from threat 8" may remain only as threat 8's own gear).

### 4.2 Walk the play script

Walk §2's four parts in the real game, with the dev server, headless (Playwright's Chromium through a temporary in-browser script kept outside the repository, as stages 6–9 did) or by hand, with the debug console (`~`). Record each part's commands and what was seen (messages, probe fields such as the Crafting probe's forge rows and temper options, the Trading Post probe's Goods rows, the stock before and after, the battle's units), with screenshots kept outside the repository (the scratchpad or `logs/`). Name anything not seen, and why.

1. New game, tutorial off, at the encampment: `facility workshop 6`, `stock gold 500 mithril 30 adamant 30 starmetal 20`. On the Forge tab, see the Mithril Longsword offered for 30 gold and 8 mithril (design §4); forge one item of each tier (mithril, adamant, starmetal); see it in the baggage, with one socket at tier 3 and two at 4 and 5. Temper one to Masterwork (its socket count rising by one), then fill its sockets (`give` runes, embed on the Runes tab). Note the fighter's damage line before and after (design §4: about 1d8+6 to 1d8+12).
2. Fuse ranks up to 4: `give` triples (for example `give ember1 9`), fuse at the workshop to rank 2, 3 (level 4) and 4 (level 5), and see each refused at a lower workshop level (`facility workshop 3`, then back).
3. `level 15 all auto`, an adamant kit for each member by `give` and equipping (weapon, shield or second weapon, armour, and the small slots if wanted), then `fight freebooter_host 15`: read the auto-resolve estimate and how long it took to show (step 07), then fight it or auto-resolve it (say which): it should be a fair fight. Then the same party in iron (the ready-made kit or `give iron_…`): it should be a rout. Record the estimate and outcome of each. If either disagrees with the design, record it and bring it to the orchestrator; do not tune.
4. `contact stonehollow`, `facility trading_post 5`, `stock gold 100`: on the trading post's Buy tab, Goods, see "Mithril, from Stonehollow: 3 gold a unit"; buy 1 and 5, the gold falling by 3 and 15 and the mithril rising; see a refusal below level 5 (`facility trading_post 4`) and with too little gold.

If a part shows a bug, fix it test-first if it is small and in this stage's code, else stop and report it.

### 4.3 Final checks

`npm test`, `npm run test:browser`, `npm run build` and `npm run sprites:check`, all passing; `scripts/claudeMd.test.ts` within its caps; §4.1's grep finds nothing stale.

### 4.4 Exclusions

No rule, constant, count or band changes; no simulator runs (figures come from step 10); no feature-record edits.

## 5. Verification

- The docs named in §4.1 are updated and true to the code; `scripts/claudeMd.test.ts` passes; the grep of §4.1 finds nothing stale.
- `bands.md`'s "Now" column matches step 10's figures; no band value changed (`git diff` of the file shows only "Now" cells).
- The screenshots are retaken and were looked at; the Forge tab and Goods shots are added and linked.
- The stage design's Implementation notes carry the early figures, the long run's kit against `expectedKit`, the Source share and battles to level, step 07's timings, with their sources in `log.md`.
- The play script's four parts were walked, each with what was seen; any disagreement with the design was brought to the orchestrator.
- `npm test`, `npm run test:browser`, `npm run build` and `npm run sprites:check` pass.

## 6. Completion criteria

- [ ] CLAUDE.md files (root if wrong, `src/inventory/`, `src/game/`, `scripts/` if wrong), `docs/reference/` (characters, game, simulator, scenes), `.claude/skills/yomi-balance/` (`levers.md`, `bands.md` "Now", `running.md`), `.claude/skills/yomi-add-content/` if needed, the manual and its screenshots current.
- [ ] The stage design's Implementation notes written and its status set to done; the stages index's stage-10 row and guard history updated.
- [ ] The play script walked, recorded part by part.
- [ ] `npm test`, `npm run test:browser`, `npm run build`, `npm run sprites:check` pass.
- [ ] One commit, "Stage 10 step 11: document and play", no attribution lines, files staged by path; the index's row 11 updated with status and commit.

## 7. Execution record

Engineer (sonnet-class), 2026-11-23, on `96a3b83`.

**Docs.** Steps 02 to 10 had already brought most of §4.1 up to date (`src/inventory/CLAUDE.md`, `docs/reference/` characters, game, scenes, simulator, the manual's text, `running.md`); read against the code, they were true. Changed here: `src/game/CLAUDE.md` (the scaling line: stage 10 leaves `one` 288 and `company` 289 where stage 9 put them, and why); `docs/reference/game.md` (the estimate as seen in the dev build) and `simulator.md` (`scripts/forecastCost.ts`); `.claude/skills/yomi-balance/` (`levers.md` the gear levers in gear §6's order and the kit lag's cause; `bands.md` "Now" marked stage 10, `rl10` 533 days and 34.0 battles, the far cells and the long figures; no band value changed); `.claude/skills/yomi-add-content/` (`item.md` the places a new family or material touches, `facility.md` a new level of a facility); the manual (temper gold corrected: 30, 40 or 50 a grade for tiers 3 to 5, not 10, 20 or 30; the Forge and Goods shots linked); the stage design's Implementation notes (status done, the "Done when" kit clause recorded unmet and accepted, stage 12's candidates, the play script); the stages index (stage 10's row, the guard's history sentence). Root `CLAUDE.md` and `scripts/CLAUDE.md` had nothing wrong. The §4.1 stale-names grep finds only `docs/reference/characters.md`'s corrected sentence (it names the old rule to say a tier now touches piercing) and history in plans, designs and feature records (and the stale copies in `.claude/worktrees/`, not tracked).

**Screenshots.** `npm run manual:screenshots` retaken in full; two shots added in `e2e/manual.shots.ts` ("forging at a level 4 workshop and the Market Hall's Goods"): `crafting-forge.png` (the Forge tab, level 4, a Mithril Longsword chosen) and `trading-post-goods.png` (the Goods filter, Stonehollow's mithril chosen), both linked in the manual and looked at. `crafting.png` and `crafting-runes.png` show the new Forge tab button and were kept retaken. The other 31 retaken images differ from the committed ones by 44 to 290,000 pixels, but the ones looked at (`panel-character`, `trading-post`, `world-outer-rings`, `crafting`, `crafting-runes`, `trading-post-routes-page2`) show the same content, so their committed bytes were restored rather than commit noise.

**Play script**, walked in the real dev build (`npm run dev`), headless Chromium driven by a throwaway script outside the repository (`scratchpad/walk`), plus one headed window for timing; recorded in the stage design's Implementation notes. A fair fight with an adamant kit: yes (3 of 5 won, estimates 50 to 70%); iron a rout (0 of 5, under 5%). The estimate took 2.6 to 4.7 s of wall clock (42 to 66 frames at about 15 frames a second while it worked; load 5 to 7 on 10 cores), over step 07's "about 1 s" inference. The kit was forged and equipped honestly (Forge tab, Modify tab's Temper, the Inventory panel), the debug console doing only `level`, `stock`, `give` runes, `facility` and `contact`. The fh15 cell (0 of 500) is iron against the bandits' Fine adamant; the real adamant party is not that party.

**Checks.** `npm test` 107 files, 2,738 tests pass (tsc clean, `scripts/claudeMd.test.ts` within its caps); `npm run build` passes; `npm run sprites:check` up to date (131 sprites, 268 frames); `npm run test:browser` 13 files, 191 tests: the full run, with the machine's load average at 13 to 28 from other sessions, passed 186 and timed out 5 (60 s each: debug "fights any encounter", party "removes a member", saves "deletes the slot of a party that falls", character "takes a tier-2 node", world "drags to the far east edge"); each of the five passes when rerun alone at load 7 (two runs, five tests, all green).

**For the user.** The estimate's wait (above), and the kit lag, are the two things to read.

**Review round 1 (opus):** one blocking finding, fixed: `scripts/records.test.ts` (plan index under 32,000 bytes; it was 32,115 because of my row 11 text; shortened). Notes fixed: headed adamant times ("4.0 and 3.7 s", also in `log.md`), the shot's page comment, "every step that ran it", `levers.md`'s "below the forge". The user accepted the estimate's 2.6 to 4.7 s wait for now; listed as a known issue in the design notes. `npm test` full pass after the fixes.
