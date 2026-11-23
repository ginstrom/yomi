# Step 10: Document and play

[Plan index](index.md) · [Stage design](../../designs/long-campaign/stage-09-outer-rings.md) (§4 What the player sees, §6 Verification, "Done when") · [Campaign reference](../../designs/long-campaign/reference/campaign-to-level-20.md) §4.1, §5.1, §5.7, §6.2–§6.3 · [Economy reference](../../designs/long-campaign/reference/economy-and-trade-routes.md) §4.3 · [Gear reference](../../designs/long-campaign/reference/gear-and-runes.md) §4.3, §4.5 · [Stages index](../../designs/long-campaign/index.md) ("Docs", "Gameplay verification", "The early-game guard") · [Plan log](log.md)

**Difficulty:** sonnet / opus. By this step every rule, constant and figure is decided (steps 01–09), so the engineer (`model: "sonnet"`) writes them down and walks the play script; it judges no balance. The reviewer (opus) checks the docs against the code, the figures against step 09's record, and that the play script was really walked.

## 1. Objective

Close the stage:
- bring the CLAUDE.md files, `docs/reference/`, the balance skill, the blight design, the manual and its screenshots up to date with steps 01–09;
- write the stage design's "Implementation notes" (step 09's figures, and the long-campaign baseline for stages 10 to 12) and mark stage 9 in the stages index;
- walk the design's play script in the real game and record what was seen.

No rule, constant or band changes here. If the docs or the play script show a bug, fix it test-first only if it is small and in this stage's code; otherwise stop and report it.

## 2. Requirements and context

- **Stages index, "Docs":** each stage updates CLAUDE.md (architecture, rules of scaling, simulator flags) and the player's manual for what it adds, and on completion adds a short "Implementation notes" section to its own design doc, with the figures measured.
- **Stages index, "Gameplay verification":** a stage is done when its tests pass, its simulator checks hold and its play script has been walked in the game.
- **Design "Done when":** all tests pass, the guard holds, a 100-campaign long run completes in reasonable time with its baseline recorded in the stage's notes, and the play script has been walked.
- **Design §6, play script** (walked here; the debug commands named are existing ones, `spawn` widened in step 07):
  1. Start a new game. The home country looks and plays as before.
  2. Run `reveal` and inspect the rings and threats with `locations all`.
  3. Run `xp 50000 all` and `goto` a threat-9 Bandit Company, then fight it. See bandits of level 9 in steel (Masterwork steel, decision 5).
  4. Contact Stonehollow and open a route (`facility trading_post 5`). See the long road and its exposure.
  5. Hold the Mithril Lode and see mithril in the stock.
- **Design §4, what the player sees:** past the Troll Lairs the land runs on; bandit camps and spider nests at threat 7, bandit companies at 9, freebooter hosts and the far partners further out; a Mithril Lode yields an ore the trading post buys; the long walk is where the Second Company earns its keep.

### Decisions from the index this step documents (unchanged)

1. **The +17-row shift is an axial translation** (q −9, r +17). The map is odd-r, so adding 17 to every offset row is not a translation: it changes distances by one between locations on rows of different parity (Gold Seam 7 → 8 hexes from home, Timber Stand 10 → 9, Salt Flats 32 → 33, which crosses from the threat-3 ring into the threat-4 ring). The translation keeps every distance exactly: a location on an odd stage-8 row keeps its column, one on an even row moves one column west; home (9, 19) becomes (9, 36), as the design says. `earlyHex(col, row)` (C4) places today's locations from their stage-8 offsets.
2. **A stand-in Source for the early figures (open question 1, recommended answer).** The design keeps `--ready-level 7` as the early-game guard, but its Source is 122 hexes out at threat 20, which a level-7 party walks to through five rings and cannot beat: the guard, the bands `one`, `company` and `rl10` and the refactor guard would all collapse. The plan adds `--near-source` to the simulator (C2): the campaign's world puts the Source where it stood before this stage (stage 8's (58, 19), shifted to (58, 36)), fought at threat 5 as today; everything else is the stage-9 world. The early figures, the refactor guard and the 50-campaign check run with `--ready-level 7 --near-source` (`rl10` with `--ready-level 10 --near-source`), so they keep their meaning and the bands their values; `bands.md`'s measure names gain the flags (step 02). The long campaign runs without it. **Amended in step 05 (the user's decision, 2026-11-22):** the near-Source world also leaves out the fixed nests above threat 5 (the outer rings'), keeping the far sites and partners, and its land is seeded without them; left in, their corruption drew the spawns away from the home country.
3. **The Source's band is 1 to 20**, with today's counts at 1 to 5 and 5 foes (every slot) at 6 to 20, so the near Source and the `SG7`, `SG10` cells (threat 5) fight as today and the Source at 20 fields the Horror and its four guards at level 20 (design: "native level 1 rules, clamped" read as the encounter's level clamped to its band). Step 09 may lower the count at 20 to make it winnable, which the design allows; nothing else about the Source is tuned. **Amended in step 09 (the user's decision, 2026-11-23):** the count could not make it winnable (foe scaling at level 20), so the guardians are raised to `SOURCE_FOE_LEVEL` (6) at most past threat 5; the count stays 5.
4. **New spawn kinds spawn only from threat 7** *(for the user's eye)*. Spider Nest's band now reaches down to 4 and Salamander Pool's to 5, so "spawns by band" would let them spawn in the home rings and change the early game, which the design keeps unchanged. `SPAWN_KINDS` entries gain `fromThreat`; the four new kinds take 7. The home rings spawn as today.
5. **Bandit gear** *(for the user's eye)*: Masterwork steel (tier 2, grade 3) from threat 8; Fine steel at 6 and 7 as today; below as today. The design's "steel from threat 7" already holds, and "far bandits wear Masterwork steel" is read as the rings whose proper tier (gear §4.2: tier 3 from threat 9) waits for stage 10.
6. **Counts for the widened bands** (the design gives none; first values, measured as report-only cells in step 09): Spider Nest 3 at threat 4, 4 at 5 to 9 (it has four slots); Salamander Pool 3 at 5 to 9 (three slots); Bandit Company 4 at 8 to 13; Freebooter Host 4 at 14 to 16 and 5 at 17 to 20. The Bandit Camp already fields 4 at 6 and 7, as the design asks: no change.
7. **Rune loot rows** *(for the user's eye)*, gear §4.5 read as: threats 9–13, one rune and a second at 50%, each rank 2 at 60% else 3; 14–19, two, each rank 4 at 15%, 3 at 60%, else 2; 20 and up (the Source), three, each rank 3 at 50% else 4. Threats up to 8 draw exactly as today. The rows go by threat, so the near Source (threat 5) rolls today's row.
8. **Partner sprites are added** *(for the user's eye)*: the design lists no sprites, but stage 8 gave each partner its own, and without new ones a mountain hold, a forest people and a fortified pass would wear Millbrook's village. Step 06 draws three (C6); the orchestrator may drop the step, and the map then falls back to `map_partner_village`. Resource sites share `map_resource` and foes are existing bandit kinds, so no other sprite is needed.
9. **The world map's blight layer is tiled.** The design asks for camera bounds; the map's blight is one render texture the map's size, which at 140 × 72 is about 7,800 × 3,500 px, past the 4,096 px many GPUs allow. Step 07 tiles it (C7) and checks the cost of the fog and growth sprites over the larger board.
10. **The Routes tab pages** (carried from stage 8): with five partners its four rows are not enough, and `routesTab.test.ts` asserts `PARTNERS.length <= ROUTE_ROWS`. Step 03 adds paging and must land before step 05 adds the partners.
11. **The refactor guard is re-recorded twice**, in step 04 (the board, rings and blight constants) and in step 05 (the outer nests, sites and partners), each with its old and new figures, rather than once: both move play unavoidably and splitting them keeps each reviewable. Every other step keeps it green.
12. **The policy snapshot is re-recorded in step 01**: it iterates every encounter over its band, so the new encounters and widened bands add lines; the lines of today's (encounter, threat) pairs must be unchanged.
13. **Measuring the carried route items needs record fields** (step 02, C2): `routeRaidsTold`, `routeFlickers` (a road told safe and raided again within 30 days, the case that is never abandoned) and `routesRaidedLong`; and `vanguardWalkDays` for the design's "walking days". Step 02 adds their values to `GUARD_RECORDS` only (no other value and not the event hash moves).
14. **`SOURCE_THREAT` lives in `worldMap.ts`** (reference §5.1), added in step 01 for the loot rows; `loot.ts` reads it only inside `rollRunes` (the import cycle rule).
15. **Saltmere** keeps its place relative to home, so it is no longer on the map's south edge (flavour only).
16. **No fixed coordinates in the story or tutorial** (inspected: `src/story/` has none); the shift touches `src/` tests, `e2e/` and `e2e/manual.shots.ts`.
17. **Out of scope:** the high roster (stage 11); tiers 3 to 5, forging and partners' goods for sale (stage 10); market income, the simulator's spend order and full-campaign route figures (stage 12, carried); any rule change to raids or abandonment (the "safe again" reset is the user's rule: step 09 measures it, carried item 2).

How open question 1 was answered is in the index and the feature record; if it was answered other than (a), document what was built, not decision 2's wording.

### Contracts this step documents (copied unchanged from the index)

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

**C2. The simulator's long-campaign settings and the Source's place (step 02)**

```ts
// src/game/worldMap.ts
export interface SourcePlace { position: Hex; threat: number }
export const SOURCE_PLACE: SourcePlace
//   step 02: { position: offsetToHex(58, 19), threat: 5 } (today's); step 04: { position: offsetToHex(131, 36), threat: SOURCE_THREAT }
export function newWorld(seed?: number, encampmentName?: string, partners: readonly PartnerLocation[] = PARTNERS, source: SourcePlace = SOURCE_PLACE): WorldState
//   the Source location ('blight_source', its name, encounter and loot unchanged) stands at source.position with source.threat, before the blight is seeded

// scripts/simulate.ts
export const SOURCE_READY_LEVEL = 18
export const MAX_CAMPAIGN_DAYS = 6000
export const NEAR_SOURCE: SourcePlace = { position: offsetToHex(58, 19), threat: 5 }   // step 04 changes the position to earlyHex(58, 19), i.e. offsetToHex(58, 36)
// CliArgs gains:
//   log: 'jsonl' | 'none'   (--log jsonl|none, default 'jsonl'; 'none' opens and writes no file; every printed figure is the same)
//   nearSource: boolean     (--near-source; refused without --campaign)
// With nearSource, a campaign's world and its waiting twin's are newWorld(seed, undefined, PARTNERS, NEAR_SOURCE).
// Amended in step 05 (the user's decision): the near-Source world (`nearSourceWorld(seed)`) also leaves out the fixed nests
//   above NEAR_SOURCE.threat (5), keeping the far sites and partners, and seeds its land, held sites and sight without them.
// CampaignRecord gains:
vanguardWalkDays: number     // days the vanguard (a lone party is the vanguard) walked, on any errand; vanguardWalkHomeDays counts those walking home
routeRaidsTold: number       // route_raided events with days 0 (a road turned raided)
routeFlickers: number        // route_restored events after which the same route turns raided again (route_raided, days 0) within ABANDON_AFTER * YIELD_DAYS days
routesRaidedLong: number     // routes raided on ABANDON_AFTER or more yield days in all (route_raided, days >= 1) and not abandoned by the end
// summarizeCampaigns averages them; the printed summary shows them in the trade line and a walking line.
// The refactor guard's args: --campaign --battles 5 --seed 1 --parties 1 --ready-level 7 --near-source.
// .claude/skills/yomi-balance/bands.md, measure names (flags only; no band value changes):
//   one: --campaign --parties 1 --ready-level 7 --near-source · company: --campaign --ready-level 7 --near-source
//   rl10: --campaign --ready-level 10 --near-source · rl12: --campaign --ready-level 12 --near-source
//   rl10-one: --campaign --parties 1 --ready-level 10 --near-source (report only)
//   long: --campaign --log none (count 100 unless told; report only) · long-one: long with --parties 1 · long-tp4: long with --trading-post 4
//   report-only cells: bc7 (bandit_camp 7, L7), sn7, sn9 (spider_nest), sp7, sp9 (salamander_pool), bco9, bco12 (bandit_company),
//   fh15, fh18 (freebooter_host), sg20-18 and sg20 (source_guardians 20 at L18 and L20); each --encounter E --threat T --party-level T unless named
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

**C6. Partner sprites (step 06)**

`map_partner_hold` (Stonehollow, a mountain hold), `map_partner_glade` (Elder Glade, a forest people's glade), `map_partner_pass` (Emberwatch, a fortified pass), each in `art/map/` with the frames and animations `map_partner_village` has, at its size. Step 07 maps them in `PARTNER_SPRITES`.

**C7. The world map at the new size (step 07)**

```ts
// src/scenes/WorldScene.ts
// PARTNER_SPRITES gains stonehollow: 'map_partner_hold', elder_glade: 'map_partner_glade', emberwatch: 'map_partner_pass'
//   (only for sprites step 06 delivered; without them the fallback stands)
// The blight layer is drawn as render-texture tiles no larger than BLIGHT_TILE_PX (2048) a side, covering the map; nothing else changes in how it looks
// The view scrolls and drags to every edge of the 140 × 72 map (mapScroll.ts)
// src/scenes/debugCommands.ts: `spawn` takes any SPAWN_KINDS encounter (its usage built from SPAWN_KINDS) and refuses one whose band, or fromThreat, does not hold the hex's threat
```

The code as built is the reference: where a step's execution record says it departed from a contract (for example the Source's count at 20 lowered in step 09, or partner sprites dropped), document the code.

### Shared constraints (from the index)

- **Commands** (local Node 26: prefix `PATH=/opt/homebrew/opt/node@26/bin:$PATH`; or the podman `make` targets):
  - `npm test` (`tsc && vitest run`) is the gate before every commit; `npx vitest run <file>` for one file;
  - `npm run test:browser` (or `-- -t <name>`) after any scene change; read `e2e/CLAUDE.md` before adding an in-browser test;
  - `npm run simulate -- <flags>`: **never run two simulations at once**. This step runs none (it documents step 09's figures); if a figure is missing, say so rather than measure it here.
- **The refactor guard and the policy snapshot** are not touched by this step and must stay green (`scripts/simulate.test.ts`, `src/engine/policies.test.ts`). This step changes no rule, so it need not run the 50-campaign check (say so in the record).
- **Balance.** The user's bands (`.claude/skills/yomi-balance/bands.md`) are never changed; only its "Now" column is updated, from step 09's figures. Out-of-band figures were already brought to the orchestrator in step 09; document what was decided.
- **Versions.** `SAVE_VERSION` 30 (step 04), no migration; `LOG_SCHEMA_VERSION` unchanged.
- **Docs.** Fix every line the stage made wrong; search the CLAUDE.md files, `.claude/` and `docs/reference/` for every renamed or removed name (`THREAT_BAND`, `MAX_THREAT`, the old `SPAWN_DIVISOR` 200 and `MAX_MONSTER_LOCATIONS` 24 values, `SOURCE_READY_LEVEL` 7, `MAX_CAMPAIGN_DAYS` 2000, the 60 × 40 map size). `scripts/claudeMd.test.ts` caps the root `CLAUDE.md` at 16 KB, each directory's at 8 KB, and the `.claude/` totals; when it fails, move detail into `docs/reference/` or a skill. `.claude/agents/*.md` and `.codex/agents/*.toml` are copies: change both if an agent changes.
- **Commits.** One commit, "Stage 9 step 10: document and play", on `long-campaign-stage-09`, without pushing; files staged by path; no attribution lines. Do not edit the feature record (`docs/features/long-campaign-stage-09.md`): the orchestrator does.

## 3. Dependencies and prerequisites

- **Steps 07 and 09 are done** (and through them 01–06 and 08), merged into the stage branch, step 06's sprites among them if it ran.
- **From `log.md` and step 01's execution record:** the stage's baseline (`one`, `company`, `rl10`, the 50-campaign hash, the day cost on the 60 × 40 map).
- **From steps 04 and 05:** the refactor guard's old and new figures (doc comment above `GUARD_RECORDS`), the outer nests' ids, names, encounters and positions, the sites' and partners' positions, the room made in `src/game/CLAUDE.md`.
- **From step 08:** the day cost after, the timings, any profile and the orchestrator's decision on it.
- **From step 09's execution record and `log.md`:** every figure to document (early figures with `--near-source` against the baseline; the long-campaign baseline: levels reached, battles to level 5/10/15/20, days, walking days, Source share, deaths by level; company against one party at `--ready-level 10` and on the long campaign; routes opened, raided, abandoned, `routeRaidsTold`, `routeFlickers`, `routesRaidedLong`; the report-only cells; any Source retune at 20 and any `SPAWN_DIVISOR` decision).
- **From steps 03 and 07:** the manual text they wrote, the probe fields and the debug commands' exact usage (`spawn` by `SPAWN_KINDS`).
- **Open question 1's answer** (index, feature record).
- **Environment:** Node 26, Playwright's Chromium, a dev server (`npm run dev`, http://localhost:5173) for the play script.

## 4. Scope and guidance

### 4.1 Document

Read the code as it stands before writing; the contracts above say what was planned, the code what was built.

- **Root `CLAUDE.md`:** only lines the stage made wrong. The Commands table's simulator row (default ready level now 18, so the balance measure needs `--ready-level 7 --near-source`; long runs with `--log none`; the "~5 min" timing from step 08) if step 02 did not already fix it. Keep it a map (16 KB).
- **`src/game/CLAUDE.md`** (8 KB cap; step 04 made room): the scaling line replaced with stage 9's ("Scaling (stage 9): …" with the early figure's move and cause in a sentence); the `worldMap.ts` line (the ring table and `earlyHex`), the `blight.ts` line (push capped at threat 5, spawn kinds by band from `fromThreat`) where they now mislead. Detail goes to `docs/reference/game.md`, not here.
- **`scripts/CLAUDE.md`:** only if a line is wrong (it points to `running.md` and the bands).
- **`docs/reference/game.md`:** the world map's size (140 × 72) and home (9, 36); the shift (`EARLY_SHIFT`, `earlyHex`, decision 1, why a row shift would not do); `THREAT_RINGS` as a table and `threatAt`; `SOURCE_THREAT` and the Source's place (`SOURCE_PLACE`, (131, 36), 122 hexes); the outer nests list by ring (id, name, encounter, threat); the new encounters (Bandit Company, Freebooter Host: bands, counts, slots) and the widened bands and counts (decision 6), the Source's band and count at 20 (decision 3, and step 09's retune if any); bandit gear by threat (decision 5); the blight cap (`BLIGHT_THREAT_CAP`, `monsterStrength`); spawns by band with `fromThreat` (decision 4) and the spawned names; `MAX_MONSTER_LOCATIONS` 60 and `SPAWN_DIVISOR` 840 (or as step 09 left it) with why; the seven materials, their sites and rings, `WORKS_NAMES`, that they sell at the post until stage 10; the five partners, rings and goods; rune loot's rows (decision 7); `SAVE_VERSION` 30, no migration. Remove `THREAT_BAND` and `MAX_THREAT`.
- **`docs/reference/simulator.md`:** fill what steps 02, 08 and 09 left: `--log none`, `--near-source` (decision 2, what it moves and what not), the defaults (`SOURCE_READY_LEVEL` 18, `MAX_CAMPAIGN_DAYS` 6000), the new record fields and summary lines, runtime figures from step 08.
- **`docs/reference/scenes.md`:** fill what steps 03 and 07 left: the Routes tab's paging, the tiled blight layer (`BLIGHT_TILE_PX`), scrolling to every edge, the partner sprites, `spawn`'s kinds.
- **`docs/reference/sprites.md`:** the three partner sprites, if it lists map sprites and step 06 did not.
- **`.claude/skills/yomi-balance/`:**
  - `levers.md`: `BLIGHT_THREAT_CAP` (5; how hard the outer rings push), `SPAWN_DIVISOR` (840; spawn pressure per hex), `MAX_MONSTER_LOCATIONS` (60; when far spawns crowd out home spawns), the Source's count at threat 20 (its lever until stage 11), and the long campaign's first figures as context; the near Source for the early figures.
  - `bands.md`: the "Now" column from step 09's figures, marked "(stage 9)"; never a band value. The measure names were set in step 02: check they match the code.
  - `running.md`: the defaults, `--near-source`, `--log none` and timings, where step 02 or 08 left them stale.
- **`docs/designs/blight.md`:** where it states numbers set for the 60 × 40 map (`SPAWN_DIVISOR`, `MAX_MONSTER_LOCATIONS`, strength by threat), add a line for the stage-9 values and the cap (the code is right; keep the design's history, do not rewrite it).
- **The manual** (`docs/manual/README.md`, via `.claude/skills/yomi-manual/`): the threat rings table (rings 1–5 as before, then 7, 9, 12, 15, 18, the Source at 20) and the map's size; the far rings' foes (bandit camps, spider nests and salamander pools from threat 7, bandit companies from 9, freebooter hosts from 15); the far partners and their goods; the new resource sites, their materials and that the trading post buys them; the blight's push no stronger than threat 5's; the Routes tab's pages (step 03 wrote its text: check it). Read steps 03's and 07's text again against the code.
- **Screenshots:** `npm run manual:screenshots` (`e2e/manual.shots.ts`, coordinates shifted in step 04), then look at every retaken image. Add a shot of the outer rings (for example the world map after `reveal`, scrolled east to a far partner or nest) and of the Routes tab with a second page, if the manual shows those screens, and link them.
- **The stage design** (`docs/designs/long-campaign/stage-09-outer-rings.md`): add an "Implementation notes" section at its end, as stages 1–8 have: the early figures (baseline and final, with `--near-source`); the long-campaign baseline for stages 10 to 12 (levels reached, battles to level, days, walking days, Source share, deaths by level), with the runtime; company against one party; routes raided, abandoned and flickering (carried items 2–4); the new cells; any retune (the Source at 20; `SPAWN_DIVISOR`) and why; the departures the plan took (the index's decisions by number, especially 1–5, 7–9 and 11); open question 1's answer; what the play script showed. Set its status to done.
- **The stages index** (`docs/designs/long-campaign/index.md`): stage 9's row marked done with a link to its implementation notes and the guard's figure; the early-game guard convention's history sentence gains stage 9's figure and says it is measured with `--near-source` from stage 9 on.
- **Removed names:** after the edits,

  ```sh
  grep -rn "THREAT_BAND\|MAX_THREAT\|60 × 40\|60x40\|SPAWN_DIVISOR = 200\|MAX_MONSTER_LOCATIONS = 24" src scripts e2e docs/reference docs/manual .claude CLAUDE.md
  ```

  should find nothing but history (plans, features and the designs' own history are not searched or are left as history).

### 4.2 Walk the play script

Walk §2's five parts in the real game, with the dev server, headless (Playwright's Chromium through a temporary in-browser test kept outside the repository, as stages 6–8 did) or by hand, with the debug console (`~`). Record each part's commands and what was seen (messages, probe fields such as `WorldProbe.roads` and the Routes tab's rows and pager, the stock before and after), with screenshots kept outside the repository (the scratchpad or `logs/`). Name anything not seen, and why.

1. New game, tutorial off. The home country looks and plays as before: the encampment, Iron Vein, Goblin Raiders and Kobold Scouts where they were relative to home; walk a hex or two.
2. `reveal`, then `locations all`: the rings and threats (1–5 near home, 7, 9, 12, 15, 18 outward, the Source at 20 far east); scroll the map to its east edge.
3. `xp 50000 all`, `goto` a threat-9 Bandit Company (its id from `locations all`), fight it (or auto-resolve, and say so): bandits of level 9 in Masterwork steel (decision 5), seen in the battle's units or the character panel of a foe.
4. `contact stonehollow`, `facility trading_post 5`, `stock gold 200 timber 20`; open the route to Stonehollow on the trading post's Routes tab (turn to page 2 if its row is there): see the preview (long road on the minimap, length, income, cost), then the road on the world map and its exposure (security, any raid).
5. Hold the Mithril Lode: `goto mithril_lode`, `blight 0 mithril_lode`, `days 5`: the site captured, mithril in the stock after a yield day, and offered for sale at the trading post.

If a part shows a bug, fix it test-first if it is small and in this stage's code, else stop and report it.

### 4.3 Final checks

`npm test`, `npm run test:browser`, `npm run build` and `npm run sprites:check`, all passing; `scripts/claudeMd.test.ts` within its caps; §4.1's grep finds nothing stale.

### 4.4 Exclusions

No rule, constant, count or band changes; no simulator runs (figures come from step 09); no feature-record edits.

## 5. Verification

- The docs named in §4.1 are updated and true to the code; `scripts/claudeMd.test.ts` passes; the grep of §4.1 finds nothing stale.
- `bands.md`'s "Now" column matches step 09's figures; no band value changed (`git diff` of the file shows only "Now" cells).
- The screenshots are retaken and were looked at.
- The stage design's Implementation notes carry the long baseline and the early figures with their sources in `log.md`.
- The play script's five parts were walked, each with what was seen.
- `npm test`, `npm run test:browser`, `npm run build` and `npm run sprites:check` pass.

## 6. Completion criteria

- [ ] CLAUDE.md files (root if wrong, `src/game/`, `scripts/` if wrong), `docs/reference/` (game, simulator, scenes, sprites), `.claude/skills/yomi-balance/` (`levers.md`, `bands.md` "Now", `running.md`), `docs/designs/blight.md`, the manual and its screenshots current.
- [ ] The stage design's Implementation notes written and its status set to done; the stages index's stage-9 row and guard history updated.
- [ ] The play script walked, recorded part by part.
- [ ] `npm test`, `npm run test:browser`, `npm run build`, `npm run sprites:check` pass.
- [ ] One commit, "Stage 9 step 10: document and play", no attribution lines, files staged by path; the index's row 10 updated with status and commit.

## 7. Execution record
