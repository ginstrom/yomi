# Step 02: Tiers 3 to 5 and bandit gear

[Plan index](index.md) · [Stage design](../../designs/long-campaign/stage-10-forging-and-high-tiers.md) (§2 "Materials", "Bandit gear by ring", §5, §6) · [Gear reference](../../designs/long-campaign/reference/gear-and-runes.md) §4.2 (tiers and their bonuses), §4.4 (sockets), §5.1 (the item model) · [Stages index](../../designs/long-campaign/index.md) ("The early-game guard") · [Plan log](log.md)

**Difficulty:** opus / opus. The engineer (model unset) widens the item model's tier and adds 84 plain items whose tier-1 and -2 stats must stay byte-for-byte today's, and moves the far bandits' gear, which re-records the policy snapshot and must be proved narrow: judgment about exactness and balance. The reviewer (opus) checks that tiers 1 and 2 are unchanged, that the snapshot moved only where meant, and that the guard and the 50-campaign check are identical.

Skill files: `.claude/skills/yomi-add-content/item.md` (plain items come from the catalog, so `BASE_ITEMS` grows by itself; nothing new for `MAGIC_ITEMS`, no new icon), `.claude/skills/yomi-balance/guards.md` (the refactor guard, the 50-campaign check, the policy snapshot).

## 1. Objective

Give every family tiers 3 to 5, and dress the far bandits in them:
- `Tier` becomes 1 to 5; `MATERIALS` gains the twelve tier-3+ materials (metal, wood, hide and cloth);
- `TIER_BONUS` for tiers 3 to 5, `SMALL_RESISTANCE`, and the materials' strength relief and caster-friendliness, folded by `tierStats`;
- sockets at tiers 3 to 5 (1, 2, 2; +1 at Masterwork);
- `BASE_ITEMS` covers all five tiers (140 plain items); the trading post never sells tier 3 and up;
- `banditGear` uses tiers 3 to 5 by ring: Mithril from threat 9, Adamant from 12, Starmetal from 18.

Nothing forges, tempers or sells these items yet (step 03 forges them; step 04 sells partners' goods). The early campaign does not move.

## 2. Requirements and context

- **S10-R1** (design §3): tiers 3 to 5 in every family, with their bonuses and sockets (gear R1, R8).
- **Design §2, "Materials":** `MATERIALS` tiers 3 to 5 and `TIER_BONUS` for them; strength relief for Mithril and Starmetal; sockets at tiers 3 to 5 (1, 2 and 2, with +1 at Masterwork).
- **Design §2, "Bandit gear by ring":** bandits use tiers 3 to 5: Mithril from threat 9, Adamant from 12, Starmetal from 18.
- **Design §5:** `BASE_ITEMS` now covers all five tiers. The trading post still lists only tiers 1 and 2.
- **Design §6 tests:** `catalog.test.ts`: tiers 3 to 5.
- **Design §4, what the player sees** (made possible here, forged in step 03): a Mithril Longsword has one socket, two when Masterwork; the fighter's damage line rises from 1d8+6 to about 1d8+12.
- **Gear §4.2:** the tier table (metal Mithril, Adamant, Starmetal; wood Elderwood, Wyrmwood, Heartwood; hide Wyvern hide, Basilisk scale, Drake scale) and "what a tier adds"; "Mithril and Starmetal also lower the strength the family asks, by 1 and 2. Their metal families' spell-skill penalty is halved."
- **Carried item** (feature record): far bandits wear Masterwork steel from threat 8 (`banditGear`) as a stand-in; this step replaces it with tiers 3 to 5 by ring.

### Decisions from the index this step applies (unchanged)

1. **Cloth gets tiers 3 to 5** *(settled by the user, 2026-11-23: the default)*. S10-R1 asks tiers 3 to 5 "in every family", but gear §4.2's ladders are metal, wood and hide only, and stage 3 added a fourth kind, cloth (Linen, Silk), for the robe. Default: **Mithrilweave** (3), **Adamantweave** (4) and **Starweave** (5), forged from the tier's ore (mithril, adamant, starmetal), so the mage's robe follows the staff. Alternative: the robe stops at Silk (tier 2), an exception to R1. Either is a few data rows in C1.
2. **Hide materials' catalog ids hold no underscore** (`wyvern`, `basilisk`, `drake`; names "Wyvern-hide", "Basilisk-scale", "Drake-scale", so "Drake-scale Leather"): a plain id splits at its first underscore. `MaterialDef.stock` names the stock material each tier-3+ material spends (`wyvern_hide`, …), keeping `catalog.ts` free of game imports.
3. **Mithril and Starmetal also halve their families' spell-skill penalties** *(settled by the user, 2026-11-23: the default)*. The stage lists only "strength relief"; gear §4.2's same bullet adds the halving (`casterFriendly`). Default: both, as the reference says (toward 0: −5 → −2, −15 → −7). Alternative: strength relief only.
4. **Tier bonuses as gear §4.2's table**, read: a small-slot item's "resistance when it has any" goes to a family whose tier-1 stats have resistance (helm, gauntlets, greaves); every weapon's tier-4 and -5 "pierce +1" is `armorPierce` +1 (a tier now touches piercing: the catalog's and the inventory guide's "a tier never changes piercing" are corrected).
10. **Bandit gear grades by ring** *(settled by the user, 2026-11-23: the default)*: Mithril **Fine** at threats 9–11, Adamant **Fine** at 12–17, Starmetal **Masterwork** from 18 (the expected kit's grades at those levels, gear §5.8); threat 8 keeps Masterwork steel, below as today. The design gives the tiers and thresholds only.
14. **The refactor guard** stays identical through steps 02, 03, 04 and 07 (no tier-3+ item, workshop above 3, good or bandit above threat 8 reaches the early campaign); **step 09 re-records it once** (its new record fields and the policy), with old and new figures; step 10 only for a retune the orchestrator approved. **The policy snapshot** is re-recorded in step 02 (bandits at threats 9 and up), only those lines changing.
20. **Out of scope:** market income, the simulator's spend order, the company's long-campaign policy skew and home-country spawns (stage 12); the Source's guardians stay at `SOURCE_FOE_LEVEL` 6 (stage 11); trophies from kills and `--player-kit` (stage 11); gear §5.8's step 3 ring-element wards and step 4 unique items by `gearScore`; the trading post selling tier 3+.

If the orchestrator relays the user's other answer to decision 1 (no cloth past Silk) or 3 (strength relief only), drop the three cloth rows or the `casterFriendly` flags and their tests; nothing else in this step changes.

### Contract produced (copied unchanged from the index)

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

Step 03 consumes `MaterialDef.stock` (forge and temper costs), `Tier` and the tier-3+ plain ids; step 08 consumes the material ids (its tints); step 09 the ids and tiers.

### Shared constraints (from the index)

- **Commands** (local Node 26: prefix `PATH=/opt/homebrew/opt/node@26/bin:$PATH`; or the podman `make` targets):
  - `npm test` (`tsc && vitest run`) is the gate before every commit; `npx vitest run <file>` for one file;
  - `npm run simulate -- <flags>`: each run its own `--out` under `logs/` (gitignored) or `--log none`. **Never run two simulations at once** (steps 01, 02, 03, 04, 07, 09 and 10 run them, in that order).
- **The refactor guard.** `scripts/simulate.test.ts`, `describe('the refactor guard')`, args `--campaign --battles 5 --seed 1 --parties 1 --ready-level 7 --near-source`; `GUARD_RECORDS`, `GUARD_EVENTS_SHA256`. Rules: `.claude/skills/yomi-balance/guards.md`. This step must not edit it and keeps it green: a mismatch means the step changed play: find the cause and fix it, or, if the cause is a battle at threat 9 or more (a bandit dressed by the new rows), bring it to the orchestrator with the battle and the figures before re-recording anything.
- **The 50-campaign check** before committing, against step 01's hash (`log.md`, "Step 01"), recorded as "identical" or the diff in `log.md`. It must be identical:

  ```sh
  npm run simulate -- --campaign --battles 50 --seed 1 --parties 1 --ready-level 7 --near-source --out logs/guard-50.jsonl > logs/guard-50.txt
  shasum -a 256 logs/guard-50.jsonl
  ```

- **The policy snapshot** (`src/engine/policies.test.ts`, "the choices of today's encounters"): re-recorded in this step only, proving only `bandit_company` and `freebooter_host` lines at threats 9 and up changed, and its title extended to say so, as earlier re-recordings do.
- **The early-game figure.** Not measured here (step 01 has the baseline; steps 09 and 10 measure); the guard and the 50-campaign check being identical is this step's proof that the early game did not move. The user's bands are never changed.
- **Determinism.** No draw of the world RNG or a battle's RNG is added, dropped or reordered. A tier-3+ bandit draws exactly as a tier-2 one does (its stats differ, not its draws).
- **Import cycles.** `catalog.ts` and `inventory.ts` import each other: nothing at module load may call across (the `MATERIALS` and `TIER_BONUS` tables are literals). `catalog.ts` imports nothing from `src/game/` (hence `stock?: string`, not `Material`).
- **Versions.** No `SAVE_VERSION` change here (items save by id; every new id is in `BASE_ITEMS`); step 03 raises it to 31. `LOG_SCHEMA_VERSION` unchanged.
- **Commits.** One commit once `npm test` passes and the guard holds, on `long-campaign-stage-10`, without pushing; files staged by path. Message "Stage 10 step 02: tiers 3 to 5 and bandit gear". No attribution lines.
- **Docs.** Fix the CLAUDE.md lines this change makes wrong and search the CLAUDE.md files, `.claude/` and `docs/reference/` for "tier 2", "two tiers", "a tier never changes", "Masterwork steel" and `SOCKETS_BY_TIER`, fixing every statement this step makes false.

## 3. Dependencies and prerequisites

- **Step 01** done: its 50-campaign hash in `log.md` (the hash this step compares against), and no code changed since.
- Existing code (inspected at `f3a1102`):
  - `src/inventory/catalog.ts`: `Tier = 1 | 2`; eight `MATERIALS` rows (iron, steel, yew, ironwood, leather, wolfhide, linen, silk); `TIER_BONUS: Record<GearClass, Record<Tier, ItemStats>>` with tier 2 only; `tierStats(stats, cls, tier)`; its doc says "A tier never changes attack AP, range, piercing, two-handedness, strength or a penalty".
  - `src/inventory/inventory.ts`: `plainItem(family, material)` calls `tierStats(family.stats, gearClass(family.slot), material.tier)`; `BASE_ITEMS = FAMILIES.flatMap(...)` (56 items today); `ID_GRAMMAR` splits a plain id at its first underscore.
  - `src/inventory/runes.ts`: `SOCKETS_BY_TIER: Record<Tier, number> = { 1: 0, 2: 1 }`, `MAX_SOCKETS = 3`, `socketsOf`.
  - `src/game/tradingPost.ts`: `sells(world, item)` returns `grade <= min(level, 3)` for anything not tier 2, so **today a tier-3 item would be sold at any level** (and `buyRefusal` would let `mithril_longsword` be bought by id): this step closes it. `TIER_PRICE: Record<Tier, number>`, `buyPrice`, `salePrice`, `wares` (loops tiers 1 and 2).
  - `src/game/bandits.ts`: `GearIds = readonly [tier1, tier2]`; `GEAR` per role; `equipmentFor` picks `ids[tier - 1]`; `banditGear(threat)`; `BanditGear { tier: Tier; grade: Grade }`.
- No blocker. Decisions 1 and 3 were settled by the user on 2026-11-23: the defaults.

## 4. Scope and guidance

### 4.1 The catalog (`src/inventory/catalog.ts`)

- Widen `Tier`, add `MaterialDef`'s three optional fields and the twelve rows of C1 after today's eight, in C1's order. Keep the doc's rule "no material id holds an underscore".
- `TIER_BONUS` for tiers 3 to 5 as C1; `SMALL_RESISTANCE` as C1, added in `tierStats` only to a small-slot family whose tier-1 stats have `resistance` (helm, gauntlets, greaves; not cap, gloves, boots).
- `tierStats(stats, cls, material)`: the tier's bonus, then `strengthRelief` off `strength` (never below 0; a family asking no strength is untouched), then for `casterFriendly` a negative `spellSkill` halved with `Math.trunc` (−5 → −2, −15 → −7; a positive one untouched). Tiers 1 and 2 have neither flag, so they give today's stats exactly. Its callers (`plainItem`) pass the `MaterialDef`.
- Rewrite the doc comments that say a tier never changes piercing: tiers 4 and 5 add `armorPierce` (decision 4); a tier still never changes attack AP, range, two-handedness, or a penalty other than through a material's relief.
- `tsc` points at every `Record<Tier, …>`: `SOCKETS_BY_TIER` (C1's values), `TIER_PRICE` (keep it tiers 1 and 2: type it with a shop-tier type such as `Extract<Tier, 1 | 2>`, or make it `Partial`, the engineer's choice, as long as `buyPrice` is null for tier 3+), and any other.

### 4.2 The items (`src/inventory/inventory.ts`, `runes.ts`)

- `BASE_ITEMS` is generated: it becomes 140 items (28 families × 5 tiers), each family's tier 1 and tier 2 first. **Every tier-1 and tier-2 item is byte-identical to today's** in id, name, stats and its place among the tier-1/-2 items; prove it in a test (e.g. a list of today's 56 ids, names and stats, or a JSON snapshot taken before the change).
- Names: "<Material name> <Family name>" ("Wyvern-hide Leather", "Drake-scale Cap", "Elderwood Wand", "Starweave Robe"); `tier1` names only at tier 1.
- `itemById` needs no change: `mithril_longsword@3+keen2#ember3` parses, as the grammar splits at the first underscore. A tier-3+ item takes grades, modifiers (where `MODIFIERS[...].fits` has its family) and runes like any plain item; check it round-trips.
- `SOCKETS_BY_TIER` as C1: a Mithril Longsword has 1 socket, 2 at Masterwork; an Adamant one 2, 3 at Masterwork; a tier-5 cap 1 (small-slot cap).

### 4.3 The trading post (`src/game/tradingPost.ts`)

- `sells()` false and `buyPrice()` null for tier 3 and up; `buyRefusal` for such an id: 'The trading post does not sell that; the workshop forges it.' `wares()` stays tiers 1 and 2 (unchanged code; a test that no listed item is tier 3+ at level 6).
- `salePrice` of a tier-3+ item stays 0 (no `buyPrice`, no `VALUES` entry) until step 03 adds `forgedValue`; say so in a comment. No tier-3+ item can reach the party in play before step 03 but by debug `give`.

### 4.4 Bandit gear (`src/game/bandits.ts`)

- `GearIds` becomes a 5-tuple per role, the same family in each tier's material: cutthroat dagger (iron … starmetal), archer bow (`yew_bow`, `ironwood_bow`, `elderwood_bow`, `wyrmwood_bow`, `heartwood_bow`), brute battle axe and breastplate, mage wand (`spark_wand`, `ironwood_wand`, `elderwood_wand`, …), captain longsword, shield (`oak_shield` … `heartwood_shield`) and breastplate, crossbowman crossbow (`yew_crossbow` … `heartwood_crossbow`). Every id must resolve (a test).
- `banditGear` as C1; its doc comment records the rows and decision 10 (replacing "their proper tiers wait for stage 10").
- Mithril's and Starmetal's strength relief and halved spell skill reach bandits through `deriveCombatStats`, as for heroes; nothing bandit-specific.
- `banditStats`' cache key already holds tier and grade.

### 4.5 The policy snapshot

`src/engine/policies.test.ts` iterates every encounter over its band, so the `bandit_company` (9–13) and `freebooter_host` (14–20) lines change; `bandit_camp` (to 7), `spider_nest`, `salamander_pool` and the rest must not. Re-record it, then prove it: the lines of every (encounter, threat) group outside those two encounters at 9 and up are the same lines in the same order (diff the old and new snapshot by group, as stage 9 step 01 did), and record the counts in `log.md`. Extend the describe's title: "… and in long-campaign stage 10 step 02, when bandits from threat 9 took tiers 3 to 5".

### 4.6 Exclusions

No forging, tempering, workshop level, `Material` or stock change (step 03); no partners' goods (step 04); no tints or scenes (step 08); no simulator policy (step 09); the trading post never sells tier 3+ (decision 20).

## 5. Verification

- **`src/inventory/catalog.test.ts`:**
  - every family × every material of its kind builds through `itemById`, 140 in all, ids and names as C1 (`mithril_longsword` "Mithril Longsword", `drake_leather` "Drake-scale Leather", `elderwood_shield` "Elderwood Shield", `starweave_robe` "Starweave Robe");
  - tier-3, -4 and -5 stats per C1 for a weapon (longsword: damage bonus, to hit, `armorPierce` +1 at 4 and 5), a shield, body armour, a small slot with resistance (helm: `SMALL_RESISTANCE`) and one without (cap: armour class only);
  - strength relief: Mithril and Starmetal plate ask 5 and 4 (from 6), a breastplate 2 and 1 (from 3), a family asking none still none; the halved spell skill on Mithril and Starmetal metal families (breastplate −2, plate −7, helm −2), Adamant's unhalved;
  - today's 56 tier-1 and tier-2 items unchanged (ids, names, stats, order among themselves); legacy ids (`steel_armor`, `iron_sword`, …) still resolve as today;
  - ids round-trip with grades, modifiers and runes (`mithril_longsword@3#ember1.storm1`, `adamant_breastplate@2+reinforced2`); a tier-3+ id with too many runes or a bad material/family pair returns `undefined`.
- **`src/inventory/runes.test.ts`:** `socketsOf` by tier: 1, 2, 2 at tiers 3, 4, 5; +1 at Masterwork (3 at most); a tier-4 or -5 small-slot item 1 at most.
- **`src/game/tradingPost.test.ts`:** at level 6 no ware is tier 3+; `sells` false and `buyPrice` null for a tier-3 item; `buyRefusal(…, 'mithril_longsword')` says 'The trading post does not sell that; the workshop forges it.'.
- **`src/game/bandits.test.ts`** (and `encounters.test.ts` where the bands are checked): `banditGear` at threats 3, 4, 5, 6, 7, 8, 9, 11, 12, 17, 18, 20 gives C1's rows; every `GEAR` id at every tier resolves; a bandit at threat 9 wears Fine mithril, at 12 Fine adamant, at 18 Masterwork starmetal.
- `npm test` passes, with the refactor guard **untouched and green** and the policy snapshot re-recorded as §4.5.
- The 50-campaign check **identical** to step 01's hash, recorded in `log.md`.

## 6. Completion criteria

- [x] C1 built: `Tier` 1–5, the twelve materials, `TIER_BONUS`, `SMALL_RESISTANCE`, relief and caster-friendliness in `tierStats`, `SOCKETS_BY_TIER`, 140 plain items, the post refusing tier 3+, bandits by ring.
- [x] Tiers 1 and 2 byte-identical to today's, proved in a test.
- [x] Policy snapshot re-recorded, only `bandit_company` and `freebooter_host` lines at 9 and up changed (proof and counts in `log.md`); refactor guard untouched and green; 50-campaign check identical (`log.md`).
- [x] Docs: `src/inventory/CLAUDE.md` (the `catalog.ts` line: five tiers of each kind and what tiers 2–5 add; "Tier 1 has no sockets, tier 2 one, Masterwork one more" → tiers 3, 4, 5 have 1, 2, 2; the grades line, now that a tier touches piercing at 4 and 5), `docs/reference/characters.md` ("The gear catalog", "Runes and sockets": the materials table, tier bonuses, relief, halving, names), `docs/reference/game.md` (the bandit gear line: tiers 3 to 5 by ring, decision 10, the stand-in sentence removed); the searches of §2 done.
- [x] One commit, "Stage 10 step 02: tiers 3 to 5 and bandit gear", files staged by path, no attribution lines; the index's row 02 updated with status and commit.

## 7. Execution record

2026-11-23, engineer (opus). Built on `39a2a01`; the user's answers to the plan's six questions relayed by the orchestrator (decisions 1, 3, 10 the defaults: built as written).

**Built (C1, unchanged):** `Tier` 1–5; `MaterialDef.strengthRelief`, `casterFriendly`, `stock`; the twelve materials in C1's order; `TIER_BONUS` tiers 3–5; `SMALL_RESISTANCE`; `tierStats(stats, cls, material)` (bonus, small resistance only for a small family with tier-1 resistance, then relief, then halving with `Math.trunc`); `SOCKETS_BY_TIER` { 1: 0, 2: 1, 3: 1, 4: 2, 5: 2 }; `BASE_ITEMS` 140; the post: `ShopTier = Extract<Tier, 1 | 2>` types `TIER_PRICE`, `buyPrice` null and `sells` false for tier 3+, `buyRefusal` 'The trading post does not sell that; the workshop forges it.' (checked before the generic refusal, for any id whose item is tier 3+); `salePrice` of a tier-3+ item 0 but its runes (comment points at step 03's `forgedValue`); `GEAR` 5-tuples, `banditGear` by ring.

**Proofs.**
- Tiers 1–2 byte-identical: the 56 tier-1/-2 items of `BASE_ITEMS`, `JSON.stringify`'d in order, hashed before the change (`bf524dff…f6e1`) and after: identical; the hash is a test in `catalog.test.ts`.
- Policy snapshot: lines dumped before and after (a local, reverted env hook in the test), compared by (encounter, threat) group: 69 groups, same keys in the same order; exactly 12 changed, `bandit_company` 9–13 and `freebooter_host` 14–20; `bandit_company` 8 and every other group identical (11,683 lines). Lines 14,836 → 14,242; hash `639fea30…6f48` → `b9cef6e1…28ac`; title extended.
- Refactor guard untouched and green (`npm test`).
- 50-campaign check: `57fdea1553a35b1af0e33b74a11ea9fe0a0e2f62ef9e5c80972af59276e53e75`, **identical** to step 01 (34 s).

**Commands.** `npm test` baseline green (105 files, 2,634 tests); final `npm test` 105 files, 2,646 tests passed. `npm run test:browser -- e2e/encampment.test.ts -t "Lesser runes|embeds, extracts and fuses|crafts in the field|filters the trading post"`: 4 passed. Red runs seen for the trading post (2 failing) and bandit (4 failing) tests before their code; the catalog and socket tests were written after the catalog change (they cannot compile against `Tier = 1 | 2`); the item hash was taken before.

**Deviations.**
- `src/scenes/runecraftView.ts` (not in the task's file list): `socketSources` read every socketed tier, so the Runes tab's hints would have listed sixteen materials and "tier-2, tier-3, tier-4 or tier-5". Now `materials` are the lowest socketed tier's, and the words say "steel, ironwood, wolfhide and silk gear and anything finer" and "tier-2 and finer or Masterwork gear"; its test and the three e2e strings in `e2e/encampment.test.ts` follow. Step 08 may reword.
- `encounters.test.ts`'s far-bandit test expected Masterwork steel at every threat: now C1's rows (threat 8 still steel). `encounters.ts`'s `banditCompany`/`freebooterHost` doc comments updated.
- The manual's bandit and sockets lines (`docs/manual/README.md`) corrected (no screenshot shows them).
- Decision markers in the other task files and the index marked settled; step 09's task file rewritten for decision 12 as the user settled it (families by role only from tier 3).

**Informational long run** (not required by this step; `--campaign --battles 100 --seed 1 --log none`, ~4 min alone, `logs/s10-02-long.txt`): the far bandits' new gear, with no way yet for heroes to forge, cuts the long campaign hard: Source 15 → **2** of 100 (96 fell, 2 out of days), threat 9 win rate 0.828 → 0.712, 12 0.601 → 0.395, 15 0.868 → 0.391; battles to 15 reached in 18 campaigns (was 44). Expected until steps 03 and 09 give the party forging; step 10 judges it.

**For later steps.** Step 03: `MaterialDef.stock` holds the stock material (`wyvern_hide`, …; the weaves their ore); tier-3+ `salePrice` is 0 until `forgedValue`. Step 08: tier-3+ materials have no tint yet (`iconTint` tints tier 2 only); the Runes tab hint wording above. Step 09/10: the long baseline above is the far bandits' effect alone.

