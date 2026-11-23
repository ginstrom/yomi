# Step 09: The simulator's gear policy

[Plan index](index.md) · [Stage design](../../designs/long-campaign/stage-10-forging-and-high-tiers.md) (§2 "The simulator", §6 Simulator, §7 Risks) · [Gear reference](../../designs/long-campaign/reference/gear-and-runes.md) §5.8 (expected kit, the careful party's gear policy, the record), §4.3 (forging), §5.4 · [Stages index](../../designs/long-campaign/index.md) ("The early-game guard") · [Balance skill](../../../.claude/skills/yomi-balance/SKILL.md) · [Plan log](log.md)

**Difficulty:** opus / opus. The engineer (model unset) writes a policy with judgment calls the design leaves open (decision 13), re-records the refactor guard with an explanation, and runs the early-figure gate (decision 12), which may stop the step; the reviewer (opus) checks the policy against gear §5.8 steps 1 and 2, that the guard was first extended by values only and then re-recorded once, and that the gate was honoured.

## 1. Objective

Teach the simulator's careful party to use the high tiers, and record how far its gear keeps up:
- `kitRole` and `expectedKit(role, level)` (gear §5.8's table);
- the record's `goldOnForging` and `kitAtLevel`, averaged and printed as a "Kit:" line against `expectedKit`;
- the gear policy of gear §5.8 steps 1 and 2 in `visitFacilities`, **from tier 3 only** (decision 12 as the user settled it, 2026-11-23): below tier 3 today's buying is kept unchanged (the dearest of the same family the post sells); from tier 3, families by role, forge (3–5) the highest tier affordable, slot by slot; then temper, modify and fill sockets (fusing any rank the workshop allows);
- trophies taken after each win (`takeTrophies`; none drop yet);
- the refactor guard re-recorded once, the 50-campaign check's new hash, and the early-figure gate on `one`.

## 2. Requirements and context

- **S10-R6** (design §2, "The simulator"): the gear policy (gear §5.8, steps 1 and 2): families by role, forge and temper on home visits, with the war hammer and crossbow switches; `expectedKit(role, level)`; the record gains each member's main-hand tier and filled sockets at levels 5, 10, 15 and 20, and the gold spent on forging.
- **Gear §5.8, the careful party's gear policy**, steps 1 and 2 as written:
  1. **Families by role.** Fighter: longsword, then the war hammer when the ring's lead kind has resistance 4 or more. Archer: bow, then crossbow from tier 3. Mage: staff and robe. Everyone: the best body armour their strength allows without a shortfall, plus the small slots. The roles are those of the ready-made party; a recruit takes the role of its pre-roll.
  2. **On each home visit:** buy or forge the highest tier affordable for each member's main hand, then body armour, then shield, then the small slots. Then temper, modify, and fill sockets.
- **Gear §5.8, the record:** gold spent on forging; each member's main-hand tier and filled sockets at levels 5, 10, 15 and 20. The summary prints these against the expected-kit table, so a starved economy shows up as gear falling behind.
- **Design §6 tests:** `scripts/simulate.test.ts`: the gear policy on fixed states; `expectedKit`.
- **Design §6 Simulator** (measured in step 10; this step's gate is the first look): (1) the early-game guard; (2) the long campaign, gear tiers at levels 5, 10, 15 and 20 against the expected kit.

### Decisions from the index this step applies (unchanged)

8. **Trophies this stage are data and a path, with no entries** *(settled by the user, 2026-11-23: the default)*: no wolf, wyvern, basilisk or dragon exists until stage 11, so `TROPHIES` is empty, and granting is wired (the victory screen, the simulator) and tested with an injected table. Elder Glade sells **wyvern hide** at the Market Hall as the design's stand-in; **basilisk scale and drake scale have no source in play until stage 11** (debug `stock` only), so hide tiers 4 and 5 cannot be forged in play this stage.
9. **Partners' goods** *(settled by the user, 2026-11-23: the default)*: from the Market Hall (trading post 5 and up), each **contacted partner not silent** sells its good (and Elder Glade its stand-in) at 3 gold a unit, bought into the stock in any whole amount. The design says only "for sale at the Market Hall"; silence is read as the route's rule (a silent partner pays nothing). The simulator does not buy goods (the spend order is stage 12's).
12. **The gear policy applies families by role only from tier 3** *(settled by the user, 2026-11-23, **not** the plan's default "from tier 1, gated")*: below tier 3 the simulator keeps today's policy (in-family buying at tiers 1 and 2), so the early figure should not move. Step 09's gate stays as a check: if `one` still moves more than about 5 points from step 01's baseline, it stops and reports. Step 09's task file says so.
13. **The policy's details the design leaves open** (step 09; first values, recorded): the fighter switches to the war hammer when the lead foe (the first enemy unit) of the vanguard's next target, built at its threat, has resistance 4 or more; the archer's crossbow from tier 3; "the best body armour their strength allows" is the engineer's documented rule; fusing any rank the workshop allows (gear §5.8 step 3, which "fill sockets" needs at ranks 3–4); tier-3+ ores, woods and trophies are never sold as surplus; trophies are taken (none drop yet); no partner goods.
14. **The refactor guard** stays identical through steps 02, 03, 04 and 07 (no tier-3+ item, workshop above 3, good or bandit above threat 8 reaches the early campaign); **step 09 re-records it once** (its new record fields and the policy), with old and new figures; step 10 only for a retune the orchestrator approved. **The policy snapshot** is re-recorded in step 02 (bandits at threats 9 and up), only those lines changing.
20. **Out of scope:** market income, the simulator's spend order, the company's long-campaign policy skew and home-country spawns (stage 12); the Source's guardians stay at `SOURCE_FOE_LEVEL` 6 (stage 11); trophies from kills and `--player-kit` (stage 11); gear §5.8's step 3 ring-element wards and step 4 unique items by `gearScore`; the trading post selling tier 3+.

### Contract produced (copied unchanged from the index)

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

### Contracts consumed (copied unchanged from the index)

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

**C2. The workshop: forging, tempering, fusing, trophies (step 03)** — the parts this step calls:

```ts
// src/game/territory.ts
export type Material = /* today's sixteen */ | 'wolfhide' | 'wyvern_hide' | 'basilisk_scale' | 'drake_scale'   // trophies

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

// src/game/tradingPost.ts: salePrice of a tier-3+ item = floor((forgedValue + its runes' prices) / 2)
// src/game/runecraft.ts: FUSE_LEVELS unchanged ({ 2: 1, 3: 4, 4: 5 }); with MAX_WORKSHOP_LEVEL 6, fusing to rank 3 (level 4) and rank 4 (level 5) now succeeds

// src/game/encounters.ts
export interface Trophy { material: Material; amount: number }
export const TROPHIES: Partial<Record<FoeKind, Trophy>> = {}   // stage 11 adds gear §4.3's kinds (decision 8)
// src/game/loot.ts
export function takeTrophies(game: GameState, kinds: Record<UnitId, UnitKind>, table: Partial<Record<FoeKind, Trophy>> = TROPHIES): Stock
//   adds the foes' trophies (every unit whose kind is not 'warrior') to world.stock and returns what it added; draws nothing
```

**C3. Partners' goods at the Market Hall (step 04)**: `goodsForSale`, `buyGoodRefusal`, `buyGood` exist; **this step never calls them** (decision 9: the simulator buys no goods; the spend order is stage 12's).

### Shared constraints (from the index)

- **Commands** (local Node 26: prefix `PATH=/opt/homebrew/opt/node@26/bin:$PATH`; or the podman `make` targets):
  - `npm test` (`tsc && vitest run`) is the gate before every commit; `npx vitest run <file>` for one file;
  - `npm run simulate -- <flags>`: each run its own `--out` under `logs/` (gitignored) or `--log none`. **Never run two simulations at once** (steps 01, 02, 03, 04, 07, 09 and 10 run them, in that order). Measurements go through the `yomi-measure` agent where a step says so. Long runs: 100 campaigns take about 10 minutes alone, up to 20 under load.
- **The refactor guard.** `scripts/simulate.test.ts`, `describe('the refactor guard')`, args `--campaign --battles 5 --seed 1 --parties 1 --ready-level 7 --near-source`; `GUARD_RECORDS`, `GUARD_EVENTS_SHA256`. Rules: `.claude/skills/yomi-balance/guards.md`. Steps 02, 03, 04, 06, 07 and 08 must not edit it and keep it green (a mismatch means the step changed play: find the cause and fix it, or, in step 02 only, if the cause is a battle at threat 9 or more, bring it to the orchestrator). **Step 09 re-records it** with old and new figures in the doc comment above `GUARD_RECORDS`. Step 10 only for a retune the orchestrator approved.
- **The 50-campaign check** before committing a domain or simulator step (02, 03, 04, 07, 09, 10 if it retunes), against a hash taken before the step (step 01's for step 02), recorded as "identical" or the diff in `log.md`:

  ```sh
  npm run simulate -- --campaign --battles 50 --seed 1 --parties 1 --ready-level 7 --near-source --out logs/guard-50.jsonl > logs/guard-50.txt
  shasum -a 256 logs/guard-50.jsonl
  ```

  Steps 02, 03, 04 and 07 must be identical; 09 records the new hash and figures; 05, 06, 08 and 11 change no rule the campaign plays and need not run it (say so).
- **The policy snapshot** (`src/engine/policies.test.ts`): re-recorded in step 02 only. The gear policy moves no foe's choice: if the snapshot fails here, something else changed; find it.
- **The early-game figure.** Stage 9 ended at `one` 288 (days 331), `company` 289, `rl10` 409, accepted by the user until stage 12 (`bands.md`). **Step 01 re-measures `one`, `company`, `rl10` and the long baseline before any change** (code moved after stage 9's measuring step). Steps 09 and 10 measure again with `--near-source`. A move of more than about 5 points from step 01's figure is explained in the commit and in `src/game/CLAUDE.md`'s scaling line, or retuned; **any figure out of the user's bands, or further out than accepted, is brought to the orchestrator with options, never tuned away silently.** The user's bands (`.claude/skills/yomi-balance/bands.md`) are never changed; only "Now".
- **Determinism.** No step adds, drops or reorders a draw of the world RNG or a battle's RNG. Forging, tempering, goods and trophies draw nothing. Step 07's changes leave every battle and every estimate byte-identical.
- **Import cycles.** `crafting.ts`, `runecraft.ts` and `company.ts` are in a cycle (`src/game/CLAUDE.md`), as are `blight.ts`, `territory.ts`, `worldMap.ts`, `trade.ts` and `buildings.ts`; `tradingPost.ts` may call `crafting.ts`'s `forgedValue` and `trade.ts`'s readers only inside functions. `catalog.ts` and `inventory.ts` import each other: nothing at module load. `catalog.ts` imports nothing from `src/game/`.
- **Versions.** `SAVE_VERSION` 31 (step 03), no migration; `LOG_SCHEMA_VERSION` unchanged. This step changes neither.
- **Commits.** One commit for this step once `npm test` passes and the guard holds as re-recorded, on `long-campaign-stage-10`, without pushing; files staged by path. Message "Stage 10 step 09: the simulator's gear policy". No attribution lines.
- **Docs.** Fix the CLAUDE.md lines this change makes wrong; search the CLAUDE.md files, `.claude/` and `docs/reference/` for `PREFERRED_MODIFIERS`, `GEAR_SLOTS`, `tierTwoBought`, "the dearest item" and the summary's gear line, and fix every statement this step makes false. `scripts/claudeMd.test.ts` caps each directory's `CLAUDE.md` at 8 KB.

## 3. Dependencies and prerequisites

- **Steps 01 to 04 and 07 are done** (01's baseline in `log.md`; 02's catalog and bandits; 03's workshop, `forge`, `temper`, `takeTrophies`; 04's goods, which this step leaves alone; 07's byte-identical speed-ups, if any). Step 08 (scenes) may run beside this step: no file overlap but the index's table (update your row only).
- **Step 01's figures** (`log.md`, "Step 01"): `one` (Source wins of 500, days, battles, heroes dead) and the 50-campaign hash. If step 07 changed code, its 50-campaign check was identical, so step 01's figures still hold as this step's baseline.
- **The hash before this step:** the last identical 50-campaign hash recorded in `log.md` (step 07's, else 04's).
- **Existing code** (`scripts/simulate.ts`, inspected at `f3a1102`): `visitFacilities` (sells the baggage and the materials beyond `materialNeeds`; raises the trading post, workshop and infirmary greedily; opens routes; raises the Lodge; for each member over `GEAR_SLOTS` (main hand, off hand, armour) buys the dearest item of the worn family the post sells that the gold affords, extracting the old one's runes where it can and selling it; `runecraftGear`; `craftGear` by `PREFERRED_MODIFIERS`; raises the shrine); `materialNeeds`; `RUNE_ORDER`, `nextRune`, `runecraftGear` (fuses only Lesser triples: `if (!key.endsWith('1')) continue`); `eachWantedCraft`, `craftGear`, `fieldCraft`; `fightAt` (calls `takeRunes`); `LEVEL_MARKS` and `battlesToLevel`; `Trade` (`goldOnGear`, `tierTwoBought`, …); `CampaignRecord`; `socketsFilled`; `summarizeCampaigns` and the printed lines; `nextTarget`; `playerPlan` and `planFor`.
- **`yomi-measure`** is spawned per the engineer role (`.claude/roles/engineer.md`): if the spawn is refused, a `general-purpose` agent briefed with the body of `.claude/agents/yomi-measure.md`. One spawn at a time; it refuses to start beside another simulation.

## 4. Scope and guidance

### 4.1 Kit roles and the expected kit

- `kitRole(character)` from the character's first tagged skill (C8). The ready-made three are fighter, archer and mage; a recruit takes the role of its pre-roll's tag.
- `expectedKit(role, level)` exactly as C8's table (levels below 1 count as 1, above 20 as 20). Export it from `scripts/simulate.ts` (stage 11's yardstick and `--player-kit` will read it).

### 4.2 The record

- `goldOnForging`: the gold of every `forge` and `temper` made (count it in `Trade`, as `goldOnRunes` is, and add it up in the record).
- `kitAtLevel`: when the vanguard's lowest level first reaches a mark of `LEVEL_MARKS` (the same moment `battlesToLevel` notes), one entry per vanguard member: `kitRole`, the main hand's `tier` (0 for an enchanted item or none) and the runes embedded across its worn gear (the count `socketsFilled` sums for the company).
- `summarizeCampaigns`: by mark and `KitRole`, the mean tier and mean filled sockets and how many campaigns reached the mark. The printed summary gains a "Kit:" line (or a short table) per mark: each role's mean tier and sockets beside `expectedKit`'s tier and socket range, e.g. `Kit at 10 (55 campaigns): fighter tier 2.4, 1.1 runes; archer …; expected tier 3, 2–3 runes`. The gear line gains the forging gold.
- **Guard, part 1:** add the two fields and the summary first, with no policy change. Re-run the guard: the event hash (`GUARD_EVENTS_SHA256`) must not move; add only the new fields' values to `GUARD_RECORDS` (as stage 9 step 02 did). Record "hash unchanged" in the execution record.

### 4.3 The gear policy (gear §5.8 steps 1 and 2, decision 13)

Write it as small exported helpers in `scripts/simulate.ts` so the tests can call them on fixed states (names are the engineer's; for example `wantedFamily(hero, slot, world, party)`, `forgeOrBuy(game, party, member, slot)`):

1. **Families by role** (from tier 3 only, decision 12 as settled; at tiers 1 and 2 every slot keeps today's buying: the dearest item of the worn family the post sells, dearer than the worn one, and the small slots untouched as today).
   - Fighter: longsword; the war hammer instead when the lead foe (the first enemy unit of the encounter at the vanguard's next target, `nextTarget`, built for the party at the target's threat) has resistance 4 or more. Its off hand: a shield (wood) as today's ready-made fighter carries.
   - Archer: bow at tiers 1 and 2, crossbow from tier 3.
   - Mage: staff and robe.
   - Body armour (fighter, archer): the engineer's documented rule for "the best body armour their strength allows without a shortfall" (strength after the material's relief, `strengthShortfall` 0), for example the highest armour class plus a stated weight on resistance among the families with no shortfall; written in the helper's doc comment and in `docs/reference/simulator.md`.
   - Small slots (head, gloves, boots), for everyone: the family of the slot with no shortfall by the same rule (the mage's cap, gloves and boots in hide).
   - A guard party's members follow the same roles.
2. **On each home visit**, slot by slot in the order main hand, body armour, shield, head, gloves, boots, each member in party order:
   - the highest tier of the wanted family the party can get now: tiers 1–2 bought at the trading post as today (the worn family, the best grade the gold affords, dearer than the worn one; decision 12 as settled), tiers 3–5 of the role's family forged (`forgeRefusal` null) at the workshop; a forged item is plain, so it replaces a worn item only if it is better on the policy's measure (a higher tier, or the same tier at a higher grade after tempering is not reached by forging: compare tier first);
   - the replaced item's runes extracted where the workshop can, the old item sold (as today);
   - then **temper** each worn tier-3+ item to the best grade the stock affords (`temperRefusal` null), main hand first;
   - then **modify** (`craftGear`): `PREFERRED_MODIFIERS` kept for today's families; a family it does not name gets none, or first values the engineer documents (decision 13); `eachWantedCraft` walks every slot the policy fills;
   - then **fill sockets** (`runecraftGear`) over every worn slot (`RUNE_ORDER` by slot class, small slots as armour), **fusing any rank the workshop allows** (lift the Lesser-only filter: try each pouch key in ascending rank so rank 2 fused from 1 can be fused again).
3. **Materials:** `materialNeeds` keeps today's terms; additionally tier-3+ ores and woods (mithril, adamant, starmetal, elderwood, wyrmwood, heartwood) and the trophies are never sold as surplus (they are for forging, tempering and the workshop's levels).
4. **No partner goods** (decision 9) and no change to the spend order of buildings (stage 12): the workshop is still raised greedily as today, so it reaches level 4 once 100 gold and 20 mithril are spare.
5. **Trophies:** in `fightAt`, after a win and beside `takeRunes`, `takeTrophies(game, encounter.kinds)`; none drop this stage (decision 8), so it changes nothing played.
6. **Guard the post's prices against forged gear** (step 02 review): `visitFacilities`' buying loop (`scripts/simulate.ts`, about lines 889–896 at `31e4612`) asserts `buyPrice(...)!` for the worn item, each candidate and the item bought; `buyPrice` is null for tier 3 and up, so once a member wears a forged item that loop must skip it (or the slot) rather than read a null price as a number. Test it on a fixed state with a forged item worn.
7. `Trade.tierTwoBought` may stay (it is in `GUARD_RECORDS` history) or give way to a count by tier; if renamed, search the docs.

### 4.4 Tests (`scripts/simulate.test.ts`)

On fixed states built from `newGame` or the ready-made party (deterministic, no RNG):
- a fighter at home with the workshop at 4, 100 gold and 20 mithril forges a Mithril Longsword and wears it (the old sold), and `goldOnForging` counts 30;
- the hammer switch: with a next target whose lead foe has resistance 4 or more, the fighter's wanted family is the war hammer; with less, the longsword;
- the archer wants the bow at tier 2 and the crossbow at tier 3;
- the mage wants the staff and the robe (from tier 3);
- below tier 3 nothing changes: a party whose workshop cannot forge buys at the trading post exactly as today (same family, same items), the mage keeping its worn families (decision 12 as settled);
- after forging, tempering runs before the sockets (a Masterwork mithril weapon gains its second socket and it is filled);
- refusal paths: a workshop below 4 forges nothing; too little mithril forges nothing and leaves the stock untouched; tier-3+ materials are not sold as surplus;
- fusing: three rank-2 runes at a level-4 workshop fuse into a rank 3;
- `expectedKit` at levels 1, 5, 9, 13, 17 and 20 returns C8's rows; `kitRole` of the ready-made three;
- a short campaign's record has `kitAtLevel` where `battlesToLevel` has the mark, and the summary prints the Kit line.

### 4.5 The guard, part 2, the 50-campaign check, and the gate

1. With the policy in, the refactor guard fails (play moves): **re-record it once**, with the old and new figures (Source wins, days, battles, gold on gear, items bought, sockets filled) in the doc comment above `GUARD_RECORDS`, saying why (the gear policy, decision 12).
2. The 50-campaign check: new hash and figures (Source wins of 50, days, gold on gear and forging) against the hash before this step, in `log.md` ("Step 09").
3. **The gate (decision 12, as settled: families by role only from tier 3):** run `one` (500, seed 1, `--near-source`, via `yomi-measure`, label `s10-09`). Compare with step 01's `one`:
   - within about 5 points: go on and commit; record the figure in `log.md`;
   - **more than about 5 points either way: stop before committing the re-record**, and report to the orchestrator with the figures and the cause as far as diagnostic 50-campaign runs show it (with tier 1–2 buying left as today, a move would come from forging, tempering, fusing or the materials kept), with options. Since the policy leaves tiers 1 and 2 as today, the guard and the 50-campaign check may not move at all beyond the new record fields; say so if they do not.

### 4.6 Exclusions

No change to a rule of the game (`src/`), to the bands, or to the spend order of buildings; no partner goods; no ring-element wards (gear §5.8 step 3) or unique items by `gearScore` (step 4); no `--player-kit` (stage 11); no long-campaign tuning (step 10).

## 5. Verification

- `npx vitest run scripts/simulate.test.ts`: the new tests pass; then `npm test` (includes the refactor guard as re-recorded and the policy snapshot unchanged).
- The guard's part 1 (fields only) shown with the event hash unchanged; part 2 re-recorded once with the figures in the doc comment.
- The 50-campaign check's new hash and figures in `log.md`.
- `one` (500, `--near-source`) through `yomi-measure`, within about 5 points of step 01's (expected, as tiers 1–2 buying is today's), or the step stopped at the gate and reported.
- A short smoke run of the long campaign, e.g. `npm run simulate -- --campaign --battles 5 --seed 1 --log none`, prints the Kit line with tiers above 2 where levels 10+ are reached (say what it showed; step 10 measures properly).

## 6. Completion criteria

- [ ] `kitRole`, `expectedKit`, `goldOnForging`, `kitAtLevel`, the summary's Kit line (C8).
- [ ] The gear policy in `visitFacilities` with decision 13's details, its rules for body armour and new families' modifiers documented; trophies taken in `fightAt`.
- [ ] Tests on fixed states as §4.4; `npm test` passes.
- [ ] The guard extended by values only, then re-recorded once with old and new figures; the 50-campaign hash and figures in `log.md`.
- [ ] `one` measured at the gate; within about 5 points, or the orchestrator's answer applied.
- [ ] `docs/reference/simulator.md` (the policy, the record fields, the Kit line), `.claude/skills/yomi-balance/running.md` ("Which line carries each figure": the Kit line and the forging gold), `scripts/CLAUDE.md` only if a line is wrong.
- [ ] One commit, "Stage 10 step 09: the simulator's gear policy", files staged by path, no attribution lines; the index's row 09 updated with status and commit.

## 7. Execution record

2026-11-23, engineer (opus). Commits: `400c9db` (part 1, the kit record) and the step's final commit "Stage 10 step 09: the simulator's gear policy".

**What was built.** `kitRole`, `expectedKit`, `KitNote`/`kitNote`, `goldOnForging`, `kitAtLevel`, the summary's `kit` and `avgGoldOnForging`, `kitLines` (printed `Kit at <mark> ...` lines) and the forging gold in the gear line. The gear policy (`scripts/simulate.ts`): `FORGE_SLOTS`, `HAMMER_RESISTANCE` 4, `leadFoeResistance`, `armourScore`, `wantsFamily`, `forgeChoice`, `forgeGear`, `temperGear`, `NEVER_SOLD`; `visitFacilities` forges (tiers 3–5, slot-major: every member's main hand, then armour, shield, head, gloves, boots), then buys tiers 1–2 exactly as before (its loop, order and rule unchanged; a worn item with no post price, tier 3+, is skipped: the `buyPrice(...)!` guard), sells, tempers (every main hand first, the best grade affordable), then runes and crafts. `runecraftGear` fuses rank by rank (any rank the workshop allows) and, like `eachWantedCraft`, walks every worn slot (`WORN_SLOTS`: the three old slots first, then the small slots, so the old order is kept). `fightAt` calls `takeTrophies`. `PREFERRED_MODIFIERS` gains `crossbow: ['long']` (the one modifier that fits it); war hammer, staff, robe and the small slots get none.

**Decision 13's details, as built** (documented in the helpers' doc comments and `docs/reference/simulator.md`):
- the hammer: the lead foe is the first enemy unit of the encounter at `nextTarget` (with the run's ready level and taken targets), built for the party at its threat; read once a visit, only when the workshop can forge;
- body armour (fighter, archer): any family with no strength shortfall after the material's relief and no AP penalty, ranked by `armourScore` = armour class + 5 × resistance + to hit; this makes it the breastplate (plate excluded, leather needs wyvern hide). Small slots by the same score (helm, gauntlets, greaves); the mage's are hide (none forgeable this stage);
- replacement: a forged item is worn when of a higher tier than the worn one, or of the same tier in a wanted family when the worn one is plain and of an unwanted family (no ping-pong of tempered items);
- a two-handed main hand puts the worn shield into the baggage (runes out first), not met by the ready-made roles.

**The guard and the 50-campaign check.** Part 1: `GUARD_RECORDS` extended by the two fields' values only; events hash `e4dd3391...fb6394` unchanged. Part 2: with the policy in, **the guard did not fail and was not re-recorded**: play did not move (none of the five reaches a level 4 workshop; `goldFromSales` unchanged, so no tier-3+ material was sold before). The doc comment above `GUARD_RECORDS` says so. 50-campaign check `57fdea15...6e53e75`, **identical** to the hash before the step (26 of 50), taken after part 2 and again after the last edit. The policy snapshot is untouched and green.

**The gate.** `one` (500, seed 1, `--near-source`, `yomi-measure`, label `s10-09`): 288 of 500, 331 days, 18.8 battles, 1.2 heroes dead: identical to step 01. Passed.

**Long run (informational, 100, `--log none`):** Source 1 of 100 (step 01: 15; step 02: 2), fell 97, out of days 2; 1369 days, 41.7 battles. Gear: 448 gold on gear, 2114 on forging and tempering, 1.9 tier-2 items bought (step 01: 4.3). Kit at 5 (84) tier 1.0 for every role; at 10 (53) tier 1.0; at 15 (16) tier 1.3–1.5, 0.3–0.4 runes, against expected 2, 3, 4. A diagnostic run (10 long campaigns, temporary stderr lines, reverted) found forging in only 2 of 10 campaigns, first on days 1111 and 1468, with the heroes at levels 4–6: the workshop reaches 4 (20 mithril) long after the vanguard's level marks, and each reformed party of recruits is re-forged after each wipe (963 forges and tempers in those two). So the kit lag is the economy's (when level 4 is reached), not the policy's: step 10's lever (site yields, then forge costs). The smoke run (`--battles 5 --log none`) prints the Kit lines; it shows no tier above 2 at levels 10+ for the same reason.

**Verification.** `npx vitest run scripts/simulate.test.ts` 202 pass (13 new policy tests and 5 kit tests; each of four mutations, dropping the buy guard, the tempering, the rank-by-rank fusing or `NEVER_SOLD`, fails at least one). `npm test` 107 files, 2,736 tests pass; `npm run build` ok.

**Deviations.** Two commits instead of one, so that the guard's part 1 (values only, hash unchanged) is shown on its own. The guard needed no re-record. One existing test renamed (`materialNeeds`' outer-ring materials: `NEVER_SOLD` now keeps them) and one expectation changed deliberately (`PREFERRED_MODIFIERS`' keys gain `crossbow`). `visitFacilities` gains a fourth parameter, the next-target reader (defaults to `nextTarget(world, party)`).

**For step 10.** The early figures should not move from this step. The long kit lags by one to three tiers because forging starts too late; re-forging a reformed party's gear after every wipe spends most of the forging gold.
