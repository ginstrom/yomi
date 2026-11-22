# Step 05: The outer rings' content

[Plan index](index.md) · [Stage design](../../designs/long-campaign/stage-09-outer-rings.md) (§2 "Fixed nests per outer ring", "New resource sites", "Partners"; §4; §6 tests) · [Campaign reference](../../designs/long-campaign/reference/campaign-to-level-20.md) §4.1, §5.1 ("The fixed locations") · [Economy reference](../../designs/long-campaign/reference/economy-and-trade-routes.md) §4.3 (far partners) · [Gear reference](../../designs/long-campaign/reference/gear-and-runes.md) §4.2, §4.3 (new resource sites) · [Plan log](log.md)

**Difficulty:** opus / opus. The engineer (model unset) authors some 25 nest, 7 site and 3 partner placements that must hold the rings, the encounter bands and the clearances below, and re-records the refactor guard with an explanation of the move. The reviewer (opus) checks the placements against the rules, the tests' strength, and that the guard moved for this step's reasons only.

## 1. Objective

Fill the outer rings that step 04 opened:
- 4 to 6 fixed nests in each of the rings of threat 7, 9, 12, 15 and 18, fighting the ring's encounters;
- seven resource sites (gear §4.3), their seven materials added to `Material`, `WORKS_NAMES` and `RESOURCE_YIELDS`; they have no use until stage 10 and sell at the trading post meanwhile;
- three far trade partners, Stonehollow, Elder Glade and Emberwatch, after Millbrook and Saltmere.

The refactor guard is re-recorded once, here.

## 2. Requirements and context

- **S9-R2 (part):** outer nests by band; the early geometry is step 04's and must not change here (today's locations stay at `earlyHex` of their stage-8 offsets).
- **S9-R4:** the new resource sites (gear R7, §4.3: ores, a Mithril Lode in ring 9, an Adamant Deep in ring 12, a Fallen Star in ring 18; woods, an Ironwood Grove in ring 7, an Elder Grove in ring 9, a Wyrmwood Thicket in ring 15, the Heartwood in ring 18), each yielding its material as today's sites do; and the far partners (economy §4.3: Stonehollow, a mountain hold, ring 7, mithril; Elder Glade, a forest people, ring 12, elderwood; Emberwatch, a fortified pass, ring 15, adamant).
- **Design §2, fixed nests per outer ring (4 to 6):**

  | Encounter | Band | Counts |
  | --- | --- | --- |
  | Bandit Camp | 3–7 | 4 at 6 and 7 (already so) |
  | Bandit Company | 8–13 | 4 |
  | Freebooter Host | 14–20 | 4–5, with a Captain |
  | Spider Nest | 4–9 | — |
  | Salamander Pool | 5–9 | — |

- **Design §4, what the player sees:** at threat 7 bandit camps and spider nests appear, at 9 bandit companies, further out freebooter hosts and the far partners; a Mithril Lode yields an unfamiliar ore that the trading post buys.
- **Design §6 tests (this step's part):** `worldMap.test.ts`: every fixed nest's band holds its threat; partners and sites placed.
- **Reference §5.1:** "4 to 6 nests and 2 to 3 resources a ring" is the reference's; the stage design places only the seven sites of gear §4.3, which this step follows.

### Decisions from the index (unchanged)

1. **The +17-row shift is an axial translation** (q −9, r +17). The map is odd-r, so adding 17 to every offset row is not a translation: it changes distances by one between locations on rows of different parity (Gold Seam 7 → 8 hexes from home, Timber Stand 10 → 9, Salt Flats 32 → 33, which crosses from the threat-3 ring into the threat-4 ring). The translation keeps every distance exactly: a location on an odd stage-8 row keeps its column, one on an even row moves one column west; home (9, 19) becomes (9, 36), as the design says. `earlyHex(col, row)` (C4) places today's locations from their stage-8 offsets.
4. **New spawn kinds spawn only from threat 7** *(for the user's eye)*. Spider Nest's band now reaches down to 4 and Salamander Pool's to 5, so "spawns by band" would let them spawn in the home rings and change the early game, which the design keeps unchanged. `SPAWN_KINDS` entries gain `fromThreat`; the four new kinds take 7. The home rings spawn as today.
6. **Counts for the widened bands** (the design gives none; first values, measured as report-only cells in step 09): Spider Nest 3 at threat 4, 4 at 5 to 9 (it has four slots); Salamander Pool 3 at 5 to 9 (three slots); Bandit Company 4 at 8 to 13; Freebooter Host 4 at 14 to 16 and 5 at 17 to 20. The Bandit Camp already fields 4 at 6 and 7, as the design asks: no change.
8. **Partner sprites are added** *(for the user's eye)*: the design lists no sprites, but stage 8 gave each partner its own, and without new ones a mountain hold, a forest people and a fortified pass would wear Millbrook's village. Step 06 draws three (C6); the orchestrator may drop the step, and the map then falls back to `map_partner_village`. Resource sites share `map_resource` and foes are existing bandit kinds, so no other sprite is needed.
10. **The Routes tab pages** (carried from stage 8): with five partners its four rows are not enough, and `routesTab.test.ts` asserts `PARTNERS.length <= ROUTE_ROWS`. Step 03 adds paging and must land before step 05 adds the partners.
11. **The refactor guard is re-recorded twice**, in step 04 (the board, rings and blight constants) and in step 05 (the outer nests, sites and partners), each with its old and new figures, rather than once: both move play unavoidably and splitting them keeps each reviewable. Every other step keeps it green.
15. **Saltmere** keeps its place relative to home, so it is no longer on the map's south edge (flavour only).
17. **Out of scope:** the high roster (stage 11); tiers 3 to 5, forging and partners' goods for sale (stage 10); market income, the simulator's spend order and full-campaign route figures (stage 12, carried); any rule change to raids or abandonment (the "safe again" reset is the user's rule: step 09 measures it, carried item 2).

### Stage 8 rules in force (existing code, unchanged here)

- A partner (`PartnerLocation`, `kind: 'partner'`, a `good: Material`) is a neutral settlement, never held, never lost; `sources()` makes every partner a clean source of `PARTNER_STRENGTH` (3), silent or not. It is contacted by a presence standing on its hex (`partnerDay`, daily) and falls silent while its hex is at `LOSS_LEVEL` or worse. `newWorld(seed, encampmentName, partners = PARTNERS, source)` places copies of `partners` after the resources, before the monsters.
- `roadTo(world, partnerId)` is `reachableHexes` from the encampment with every hex within `RAID_RADIUS` (2) of a monster location impassable (all monsters, sighted or not), the partner's hex always passable; only when that finds no road does it fall back to keeping off nests' hexes and their neighbours. A route is raided when its partner is silent, a road hex is corrupted, or a nest stands within `RAID_RADIUS` of a road hex (the partner's included). The user's decision: roads avoid nests by `RAID_RADIUS` where they can.
- The simulator's contact detour (`contactErrand`): the vanguard walks to the nearest uncontacted partner within `CONTACT_DETOUR` (8) hexes, only once the trading post allows routes (level 4) and no held site is threatened. Untouched here.
- `save.ts`'s strict check accepts a partner whose `good` is a key of `WORKS_NAMES` (a full `Record<Material, string>`), so a new material is accepted once it is in `WORKS_NAMES`.

### Contract produced (copied unchanged from the index)

**C5. The outer rings' content (step 05)**

```ts
// src/game/territory.ts
export type Material = 'gold' | 'iron' | 'timber' | 'silver' | 'stone' | 'salt' | 'copper' | 'crystal' | 'peat'
  | 'ironwood' | 'mithril' | 'elderwood' | 'adamant' | 'wyrmwood' | 'starmetal' | 'heartwood'
// WORKS_NAMES: mithril, adamant, starmetal 'Mine'; ironwood, elderwood, wyrmwood, heartwood 'Lumber Camp'
// RESOURCE_YIELDS, amount 2 each (id, name, material, ring by threat):
//   ironwood_grove 'Ironwood Grove' ironwood 7 · mithril_lode 'Mithril Lode' mithril 9 · elder_grove 'Elder Grove' elderwood 9
//   adamant_deep 'Adamant Deep' adamant 12 · wyrmwood_thicket 'Wyrmwood Thicket' wyrmwood 15
//   fallen_star 'Fallen Star' starmetal 18 · heartwood 'The Heartwood' heartwood 18

// src/game/worldMap.ts: PARTNERS gains, after saltmere (positions the implementer's, inside the ring):
//   { id: 'stonehollow', name: 'Stonehollow', good: 'mithril' }   ring 7
//   { id: 'elder_glade', name: 'Elder Glade', good: 'elderwood' } ring 12
//   { id: 'emberwatch', name: 'Emberwatch', good: 'adamant' }     ring 15
// Fixed nests, 4 to 6 in each outer ring, by ring: 7 bandit_camp, spider_nest, salamander_pool (each at least once);
//   9 spider_nest, salamander_pool, bandit_company (each at least once); 12 bandit_company; 15 and 18 freebooter_host.
//   Threat by threatAt; ids and names the implementer's; loot from today's unique items.
// newWorld's locations order: the encampment, today's resources, the new resources (ring order), the partners (PARTNERS order),
//   today's nests, the outer nests (ring order), the Source last.
// src/scenes/debugCommands.ts: MATERIALS gains the seven (tsc enforces)
```

### Contracts consumed (copied unchanged from the index)

**C1. The far encounters, bandit gear and rune loot (step 01)**

```ts
// src/game/encounters.ts
export function banditCompany(party: readonly Fighter[], threat = 8): Encounter
export function freebooterHost(party: readonly Fighter[], threat = 14): Encounter
// ENCOUNTERS gains bandit_company and freebooter_host, after salamander_pool, so EncounterId gains them.
// ENCOUNTER_BANDS / ENCOUNTER_COUNTS, from each definition (counts from band.min up):
//   goblin_raid, kobold_scouts, hobgoblin_warband, troll_lair  { 1, 5 }   [2, 3, 3, 3, 4]          unchanged
//   bandit_camp      { 3, 7 }   [2, 2, 2, 4, 4]                                                   unchanged
//   spider_nest      { 4, 9 }   [3, 4, 4, 4, 4, 4]                                                threat 5 unchanged
//   salamander_pool  { 5, 9 }   [3, 3, 3, 3, 3]                                                   threat 5 unchanged
//   bandit_company   { 8, 13 }  [4, 4, 4, 4, 4, 4]
//   freebooter_host  { 14, 20 } [4, 4, 4, 5, 5, 5, 5]
//   source_guardians { 1, 20 }  [2, 3, 3, 3, 4, then 5 at each of 6 to 20]                       threats 1–5 unchanged
// Slots (existing bandit kinds; no new FoeKind; names are the implementer's to polish):
//   BANDIT_COMPANY_SLOTS:  sergeant (bandit_brute), crossbowman (bandit_crossbowman), mage (bandit_mage), archer (bandit_archer), cutthroat (bandit_cutthroat)
//   FREEBOOTER_HOST_SLOTS: captain (bandit_captain, 'Freebooter Captain'), brute (bandit_brute), crossbowman, mage, archer
// MAX_THREAT stays until step 04.

// src/game/bandits.ts
export function banditGear(threat: number): BanditGear
//   threat >= 8: { tier: 2, grade: 3 } (Masterwork steel); 6–7: { tier: 2, grade: 2 }; 4: { tier: 1, grade: 1 }; else { tier: 1, grade: 2 }

// src/game/worldMap.ts
export const SOURCE_THREAT = 20   // the Source's threat; on the map from step 04

// src/game/loot.ts: rollRunes(threat, encounter, rng), by row; each rune draws its kind (the favoured one at FAVOURED_CHANCE, else uniform) and then its rank:
//   threat <= 3:            unchanged (0 or 1 rune, rank 1)
//   4 to 8:                 unchanged (1 rune; rank 1 at 70%, else 2)
//   9 to 13:                1 rune, and a second at 50% (drawn first); each rank 2 at 60%, else 3
//   14 to SOURCE_THREAT-1:  2 runes; each rank 4 at 15%, rank 3 at 60%, else 2 (one draw: < 0.15 → 4, < 0.75 → 3, else 2)
//   >= SOURCE_THREAT:       3 runes; each rank 3 at 50%, else 4
// For threats up to 8 every draw is today's, in today's order. SOURCE_THREAT is read inside rollRunes only.

// scripts/dayCost.ts (new, committed; step 08 reruns it): `node scripts/dayCost.ts [--days N] [--seed S]` prints the ms a day of
//   passTurn and of advanceDay over N days (default 1000) of newWorld(seed) with the ready-made party at home
```

**C3. The Routes tab pages (step 03)**

```ts
// src/scenes/routesTab.ts: ROUTE_ROWS (4) is the rows a page shows; routeRows is unchanged
// src/scenes/TradingPostScene.ts: the Routes tab shows rows page by page with the pager the other tabs use ("Page N of M", Prev, Next)
//   once there are more than ROUTE_ROWS; turning a page selects that page's first row, and the minimap and notes follow the selection
// The Routes tab's probe lists the rows of the page shown, and the pager's buttons as the other tabs' probes do.
// routesTab.test.ts: the `PARTNERS.length <= ROUTE_ROWS` assertion goes.
```

**C4. The board and the rings (step 04)**

```ts
// src/game/worldMap.ts
export const THREAT_RINGS: readonly { upTo: number; threat: number }[] = [
  { upTo: 10, threat: 1 }, { upTo: 21, threat: 2 }, { upTo: 32, threat: 3 }, { upTo: 43, threat: 4 }, { upTo: 54, threat: 5 },
  { upTo: 67, threat: 7 }, { upTo: 80, threat: 9 }, { upTo: 94, threat: 12 }, { upTo: 108, threat: 15 }, { upTo: 122, threat: 18 },
]
export function threatAt(position: Hex): number   // the first ring whose upTo >= the distance from home; beyond the table, the last ring's threat (18)
// THREAT_BAND goes; MAX_THREAT (encounters.ts) goes, its tests using their own bounds.
export const WORLD_SIZE: BoardSize = { cols: 140, rows: 72 }
export const EARLY_SHIFT: Hex = { q: -9, r: 17 }
export function earlyHex(col: number, row: number): Hex   // stage 8's offset (col, row), translated by EARLY_SHIFT (decision 1)
// HOME = earlyHex(9, 19), which is offsetToHex(9, 36); every location of stage 8's map stands at earlyHex(its stage-8 col, row):
//   PARTNERS: millbrook earlyHex(18, 30) = offsetToHex(17, 47); saltmere earlyHex(30, 38) = offsetToHex(29, 55)
export const SOURCE_PLACE: SourcePlace = { position: offsetToHex(131, 36), threat: SOURCE_THREAT }   // 122 hexes from home

// src/game/blight.ts
export const BLIGHT_THREAT_CAP = 5
// monsterStrength(l) = l.source ? SOURCE_STRENGTH : BLIGHT_PER_THREAT * Math.min(l.threat, BLIGHT_THREAT_CAP)
export const SPAWN_DIVISOR = 840          // 200 × (140 × 72) / (60 × 40): the same pressure per hex
export const MAX_MONSTER_LOCATIONS = 60
export const SPAWN_KINDS: ReadonlyArray<{ encounter: EncounterId; name: string; fromThreat?: number }> = [
  { encounter: 'goblin_raid', name: 'Goblin Brood' },
  { encounter: 'kobold_scouts', name: 'Kobold Nest' },
  { encounter: 'bandit_camp', name: 'Bandit Gang' },
  { encounter: 'spider_nest', name: 'Spider Brood', fromThreat: 7 },
  { encounter: 'salamander_pool', name: 'Salamander Spring', fromThreat: 7 },
  { encounter: 'bandit_company', name: 'Bandit Troop', fromThreat: 7 },
  { encounter: 'freebooter_host', name: 'Freebooter Band', fromThreat: 7 },
]
// spawn: a kind is eligible where its band holds threatAt(at) and threat >= (fromThreat ?? 1); order and draws otherwise as today

// src/game/save.ts: SAVE_VERSION = 30, no migration
// scripts/simulate.ts: NEAR_SOURCE.position = earlyHex(58, 19) (offsetToHex(58, 36))
```

### Shared constraints (from the index)

- **Commands** (local Node 26: prefix `PATH=/opt/homebrew/opt/node@26/bin:$PATH`; or the podman `make` targets): `npm test` (`tsc && vitest run`) is the gate before every commit; `npx vitest run <file>` for one file; `npm run test:browser` after a scene change (this step changes no scene, but the world gains locations: run `npm run test:browser -- -t world` and `-- -t encampment` once to see nothing in-browser broke, and record it); `npm run simulate -- <flags>`, each run its own `--out` under `logs/` or `--log none`. **Never run two simulations at once.**
- **The refactor guard.** `scripts/simulate.test.ts`, `describe('the refactor guard')`: 5 campaigns from seed 1 with `--campaign --battles 5 --seed 1 --parties 1 --ready-level 7 --near-source`, each `CampaignRecord` and a SHA-256 of every battle event, against `GUARD_RECORDS`. Rules: `.claude/skills/yomi-balance/guards.md`. **This step re-records it once** (decision 11), with the old and new figures in the doc comment above `GUARD_RECORDS`.
- **The 50-campaign check**, before (on the branch after step 04, which must match step 04's recorded hash; if not, stop and report) and after:

  ```sh
  npm run simulate -- --campaign --battles 50 --seed 1 --parties 1 --ready-level 7 --near-source --out logs/guard-50.jsonl > logs/guard-50.txt
  shasum -a 256 logs/guard-50.jsonl
  ```

- **The early-game figure.** Stage 8 ended at 233 of 500 (`--parties 1`) and 232 (company), `rl10` 433; step 01 re-measured the stage's baseline (`log.md`). Step 09 measures the 500-campaign figures; this step records the 50-campaign figures only. An out-of-band figure is brought to the orchestrator, never tuned away silently; the user's bands are never changed.
- **Determinism.** No world-RNG or battle-RNG draw is added or reordered except through the meant move: the new locations change the land and so the spawns. Placements are fixed data; nothing here draws.
- **Import cycles.** `blight.ts`, `territory.ts`, `worldMap.ts`, `trade.ts` and `buildings.ts` import one another; nothing may call across, or read an imported `const` into a top-level table, at module load. (The location helpers in `newWorld` run inside the function; keep it so.)
- **Versions.** `SAVE_VERSION` is 30 from step 04; this step adds no new state shape (new locations and materials are data), so no further bump. `LOG_SCHEMA_VERSION` unchanged.
- **Commits.** One commit for this step once `npm test` passes, on `long-campaign-stage-09`, without pushing; files staged by path. Message "Stage 9 step 05: the outer rings' content". No attribution lines.
- **Docs.** Fix the CLAUDE.md lines this change makes wrong; `src/game/CLAUDE.md` is capped at 8 KB (`scripts/claudeMd.test.ts`; step 04 made room): add nothing there unless a rule needs it. `docs/reference/game.md`: the outer nests by ring, the new sites and materials, the far partners. The manual waits for step 10.

## 3. Dependencies and prerequisites

- **Step 04** done: the 140 × 72 board, `THREAT_RINGS`, `threatAt`, `earlyHex`, the Source at (131, 36), `SPAWN_KINDS` with `fromThreat`, `SAVE_VERSION` 30, and its guard re-record and 50-campaign hash in `log.md`.
- **Step 03** done: `routesTab.test.ts` no longer asserts `PARTNERS.length <= ROUTE_ROWS` (it would fail with five partners). If 03 is not merged, stop and report.
- **Step 01** done: `bandit_company` and `freebooter_host` exist, with the bands above.
- Steps 06 and 07 do not matter here (the map falls back to `map_partner_village` for the new partners until step 07 maps their sprites).

### Existing code (at `08854d3`, before steps 01–04)

- `src/game/worldMap.ts`: `newWorld` builds `locations` with the helpers `resource(id, name, col, row)` and `monsters(id, name, col, row, encounter, loot)` (threat from `threatAt`), then `...partners.map(...)` between the resources and the monsters, the Source last with `source: true`. After step 04 today's entries take `earlyHex` and the Source its `SourcePlace`; read what step 04 wrote and follow its helpers (an outer location is placed by its new offset, `offsetToHex(col, row)`, not `earlyHex`).
- `src/game/territory.ts`: `Material`, `WORKS_NAMES` (a full `Record<Material, string>`), `RESOURCE_YIELDS` (by location id), `initialHeld` (sites held at the start while clean; the far sites will not be).
- `src/game/tradingPost.ts`: `sellMaterial` sells any material but gold in lots of `MATERIALS_PER_GOLD` (2): the new materials sell with no change.
- `src/game/trade.ts`: `roadTo`, `raiders`, `raidCause`; `PARTNERS` is read by the Routes tab and by `newWorld`.
- `src/scenes/debugCommands.ts`: `MATERIALS` built from a `satisfies Record<Material, number>` literal, so `tsc` fails until the seven are added.
- `scripts/simulate.ts`: `materialNeeds` (what the stock keeps rather than sells) and the encampment's selling in `visitFacilities`.
- `src/inventory/inventory.ts`: `MAGIC_ITEMS` (today's uniques: `RING_PROTECTION`, `AMULET_FOCUS`, `RING_FORTUNE`, `SAGE_CIRCLET`, `SPARK_WAND`, `SHADOW_CLOAK`, `EMBERBLADE`, `HAWK_BOW`, `STORM_WAND`, …) for the nests' loot.

## 4. Scope and guidance

1. **Baseline first.** Before any change, run the 50-campaign check and confirm it matches step 04's hash in `log.md`.
2. **Materials** (C5). Add the seven to `Material`, `WORKS_NAMES` and (through the sites) `RESOURCE_YIELDS`; add them to `debugCommands.ts`'s `MATERIALS`. Search the repository for other enumerations of materials (`grep -rn "crystal" src scripts e2e`) and extend any that list every material (stock panels, sale lists, the simulator's needs); a list that names only some materials on purpose stays.
3. **Placement.** Author offsets on the 140 × 72 board (cols 0–139, rows 0–71); home is (9, 36). The rings by hex distance from home: threat 7 is 55–67, 9 is 68–80, 12 is 81–94, 15 is 95–108, 18 is 109–122; the Source is at (131, 36), 122 hexes out. Rules every placement keeps (and the tests check):
   - every location on the board, and no two on one hex; ids unique across `locations`;
   - each outer nest's `threatAt` is its ring's threat and its encounter's band holds it; 4 to 6 nests a ring, with the ring's encounters as C5 lists (each at least once where C5 says so);
   - spread each ring's nests north, east and south across the ring (not all on row 36), so the party's route outward meets them and the blight's spawns are not all on one side;
   - fixed nests at least `SPAWN_CLEARANCE` (4) apart from one another;
   - every partner at least `RAID_RADIUS` + 2 (4) hexes from every fixed nest (today's included), so `roadTo` can reach it under its strict rule;
   - every new site at least 5 hexes from every fixed nest, so it can be held once its land is cleaned;
   - nothing within 4 hexes of the Source's hex but the Source;
   - sites and partners in the ring C5 names.
   Loot: one of today's uniques per nest (repeats allowed), any order. Names: plain and in keeping ("Wildland Bandits", "Ashen Pool", "Ironhold Company", "The Red Freebooters"); ids snake_case.
4. **Partners** (C5): append the three to `PARTNERS` after Saltmere. Keep `PartnerLocation`'s shape. Contact, silence, roads and routes need nothing new.
5. **Location order** as C5 says; the Source stays last.
6. **Tests.**
   - `worldMap.test.ts`: every fixed nest (not the Source) has `ENCOUNTER_BANDS[encounter]` holding its threat and `threat === threatAt(position)`; 4 to 6 nests in each of the rings 7, 9, 12, 15, 18 with the encounters C5 names (each required one present); the seven sites and three new partners each in their ring (by `threatAt`); every location on the board and on a hex of its own; ids unique; the clearances of §4.3 (nests ≥ 4 apart, partners ≥ 4 from nests, sites ≥ 5 from nests, nothing within 4 of the Source); the early locations' pairwise distances unchanged (step 04's test still passes).
   - `territory.test.ts`: each new site yields 2 of its material on a yield day while held (hold one by hand in the test); `WORKS_NAMES` names each new material (a `Mine` or a `Lumber Camp`).
   - `save.test.ts`: a fresh world with the five partners round-trips through `serializeSave` and `parseSave`; a partner whose good is a new material (`mithril`) is accepted by the strict check, and an unknown good still refused.
   - `trade.test.ts`: on a fresh world (`newWorld(1)`), `roadTo` finds a road to each of the five partners (contact them in the test), and `raiders(world, road)` is empty for each (the strict rule held); record each road's length in `log.md`.
   - `tradingPost.test.ts` (or where sales are tested): `sellMaterial` sells `mithril` in lots of 2.
   - `scripts/simulate.test.ts`: `materialNeeds` keeps none of the seven new materials (so the careful party sells them; check, no policy change).
7. **Re-record the refactor guard once.** Run `npx vitest run scripts/simulate.test.ts -t "refactor guard"`, expect it to fail, and confirm the move is this step's: the outer nests push the blight (capped at threat 5's) and fill the spawn count toward `MAX_MONSTER_LOCATIONS`; the partners and sites change the land; the near Source and the early rings are as step 04 left them. Re-record `GUARD_RECORDS` and the event hash, with the old and new figures (outcomes, days, battles, spawns, partners contacted) of the 5 campaigns in the doc comment above `GUARD_RECORDS`. If the move looks larger than outer content explains (for example an early location moved), stop and find why.
8. **The 50-campaign check** after; record in `log.md` under a "Step 05" heading: the hash before and after, Source wins of 50, average days, battles, spawns, the land blighted at the end, partners contacted. If the wins move by more than about 5 of 50 from step 04's figure, say so with the cause as far as you can tell; judging and retuning are step 09's (an out-of-band figure goes to the orchestrator).
9. **Docs.** `docs/reference/game.md` (the outer rings' nests, the sites and materials, the far partners); `.claude/skills/yomi-add-content/` only if a checklist line became wrong. Search for `PARTNERS` counts or "two partners" wording in CLAUDE.md files, `.claude/` and `docs/reference/` and fix it.
10. **Exclusions:** no scene work (step 07 maps the sprites; the Routes tab pager is step 03's); no change to encounters, bands, counts, spawn kinds or blight constants (steps 01, 04; retuning is step 09's); no simulator policy change; no manual text (step 10); no new foe kind or sprite.

**Skill files:** `.claude/skills/yomi-add-content/encounter.md` (fixed nests use existing encounters; its checks apply), `.claude/skills/yomi-balance/guards.md`. `location-kind.md` is not needed (no new kind).

## 5. Verification

- `npm test` passes, with the re-recorded guard and the tests of §4.6.
- `npm run test:browser -- -t world` and `-- -t encampment` pass (record the result).
- The 50-campaign check before (matching step 04) and after, recorded in `log.md` and the execution record.
- Road lengths to the five partners on `newWorld(1)` recorded in `log.md`.

## 6. Completion criteria

- [ ] The seven materials in `Material`, `WORKS_NAMES`, `RESOURCE_YIELDS` (via the sites) and `debugCommands.ts`'s `MATERIALS`.
- [ ] 4 to 6 fixed nests in each outer ring with the ring's encounters; the seven sites and three partners placed in their rings; the clearances hold; location order as C5.
- [ ] The tests of §4.6 pass; `npm test` passes.
- [ ] The refactor guard re-recorded once, old and new figures in the doc comment above `GUARD_RECORDS`.
- [ ] The 50-campaign check's hashes and figures, and the road lengths, in `log.md` and the execution record.
- [ ] `docs/reference/game.md` current; no stale partner counts in the CLAUDE.md files, `.claude/` or `docs/reference/`.
- [ ] One commit, "Stage 9 step 05: the outer rings' content", no attribution lines, files staged by path; the index's row 05 updated with status and commit.

## 7. Execution record

**Step 05, 2026-11-22 (engineer, opus).**

- Baseline: the 50-check at `eda15e0` matched step 04's hash (`3ed0dd1c…2d2396`, 28 of 50).
- Built: the seven materials in `Material`, `WORKS_NAMES`, `RESOURCE_YIELDS` and `debugCommands.ts`'s `MATERIALS`; 24 outer nests (5, 5, 5, 5, 4 in rings 7, 9, 12, 15, 18), seven sites and three far partners at today's offsets through new helpers `farResource` and `farMonsters` (`resourceAt`, `monstersAt` underneath); location order as C5 (today's locations keep their own order; the new resources after Crystal Cave, the outer nests after the Spider Nest). Placements and clearances in `docs/reference/game.md` ("The outer rings").
- Other material lists: `CraftingScene`'s stock line and `materialNeeds`' crafting list name only some materials on purpose and stay; the simulator's sale loop walks the stock, so the new materials sell with no change.
- Tests: `worldMap.test.ts` (new describe: bands and threats, 4 to 6 a ring with the required encounters and spread above and below home's row by 10+, sites and partners by ring, clearances, order); `territory.test.ts` (each outer site yields 2 while held on clean land, none held at the start, works names); `save.test.ts` (five partners round-trip; `mithril` good accepted, `unobtainium` refused); `trade.test.ts` (roads to all five, no raiders, lengths pinned); `tradingPost.test.ts` (mithril sells in lots of 2); `simulate.test.ts` (`materialNeeds` keeps none of the seven).
- Deliberately re-recorded, each with a comment: the guard (above `GUARD_RECORDS`); `worldMap.test.ts`'s seeded session (turn 150 → 146, new hash), its no-partners land digest, the bandit-camp and loot lists, the furthest threat (5 → 18), and "places every location of stage 8's map" now checks every other location lies past 54 hexes; `blight.test.ts`'s low-threat spawn capture (seeds 2 to 4 now draw their other spawns at threat 18) and the two pinned 30-day runs (962 → 4970 and 944 → 4952 events, five spawns rather than two, the party's neighbouring cells moved by a threat-4 spawn; the net influence test unchanged); `debugCommands.test.ts` (`contact all` gives five; `mithril` is no longer the unknown material, `unobtainium` is).
- Step 04's review findings folded in: `game.md`'s Partners bullet (with the far partners); `blight.test.ts` "the rules over several parties" through `moved(q, r)`; the guard's first row indented.
- Departures: `e2e/encampment.test.ts`'s Routes-tab test contacted with `contact all` and waited for 2 contacts; it now contacts Millbrook and Saltmere by name, keeping its one-page case. Red-first held for the worldMap tests; the territory, save and trade-post tests were written after `Material` grew (they pass on the new data, and the save one flipped an old assertion that `mithril` was refused).
- 50-check after: `70bff34b…f5dd4c`, 28 of 50 (unchanged), 356 days, 36.3 spawns, 65% blighted; figures and cause in `log.md`. The cause worth step 09's eye: `nextTarget`'s "or nothing else is left" no longer fires with fixed outer nests, so a party with no nest at its level walks out to threat 7.
- For later steps: the manual's "Trade partners (Millbrook and Saltmere)" line (docs/manual/README.md:164) waits for step 10. Step 07 maps the partner sprites for `stonehollow`, `elder_glade`, `emberwatch`.
- Verification: `npm test` 102 files, 2610 tests passed. `npm run test:browser -- -t world`: first run 77 passed, 1 failed (name hidden by a `tail`); rerun 78 passed (a timeout on a loaded machine, not persistent). `-- -t encampment`: 29 passed, the Routes-tab test among them.
