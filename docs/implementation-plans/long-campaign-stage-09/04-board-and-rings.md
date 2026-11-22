# Step 04: The board and the rings

[Plan index](index.md) · [Stage design](../../designs/long-campaign/stage-09-outer-rings.md) (§2 "The rings", "The map", "The blight"; §5; §6 Tests) · [Campaign reference](../../designs/long-campaign/reference/campaign-to-level-20.md) §4.1, §5.1, §6.1 · [Stages index](../../designs/long-campaign/index.md) ("The early-game guard", "Versions") · [Plan log](log.md)

**Difficulty:** opus / opus. The engineer (model unset) replaces the threat rule and the board, moves every location by an exact translation, sets the blight constants for a board 4.2 times the size, and re-records the refactor guard with an explanation of why play moved. The reviewer (opus) checks that the shift is exact, that the early rings' threats and spawns are today's, and that the guard moved for the stated reasons only.

## 1. Objective

The world map becomes the stage's board, still without its outer content:
- the threat comes from the ring table (`THREAT_RINGS`), and `THREAT_BAND` and `MAX_THREAT` go;
- the board is 140 × 72, home is at (9, 36), and every location of stage 8's map stands where the translation by `EARLY_SHIFT` puts it, so every distance among them is today's;
- the Source stands at (131, 36), 122 hexes from home, at threat 20;
- a nest's push on the blight is capped at threat 5's, `MAX_MONSTER_LOCATIONS` is 60, `SPAWN_DIVISOR` keeps today's pressure per hex, and the outer rings spawn the new kinds from threat 7;
- `SAVE_VERSION` is 30;
- every fixed world coordinate in the tests and the in-browser tests is shifted.

The outer rings have no fixed nests, sites or partners yet (step 05). The refactor guard is re-recorded once, here.

## 2. Requirements and context

- **S9-R1** (part): the ring table; the Source at 20 (campaign R1, A1). The table is campaign §4.1's; `threatAt` reads it, and `MAX_THREAT` as a map cap goes (design §2).
- **S9-R2** (part): the bigger map, with the early geometry preserved; spawns by band (campaign R2, A2). "Today's locations are shifted by +17 rows, so the early geometry is unchanged" (design §2), read as decision 1.
- **S9-R3:** blight strength capped: `BLIGHT_THREAT_CAP = 5`, `MAX_MONSTER_LOCATIONS = 60`, `SPAWN_DIVISOR` retuned for the same pressure per hex (design §2; campaign §5.1). `SOURCE_STRENGTH` is unchanged.
- **Design §5:** the shift also applies to fixed coordinates in tests, the tutorial and the story (decision 16: the story and tutorial have none); `SAVE_VERSION` is bumped, a new map meaning old saves can't continue.
- **Design §6 tests (this step's part):** `worldMap.test.ts`, the ring table and the shift preserving distances among the home locations; `blight.test.ts`, the capped strength and spawn kinds by band over many seeds. (Every fixed nest's band, and partners and sites placed, are step 05's.)
- **Carried item 5:** `src/game/CLAUDE.md` is at 7,977 of its 8,192-byte cap (`scripts/claudeMd.test.ts`); make room before any line is added.

### Decisions (from the index, unchanged)

1. **The +17-row shift is an axial translation** (q −9, r +17). The map is odd-r, so adding 17 to every offset row is not a translation: it changes distances by one between locations on rows of different parity (Gold Seam 7 → 8 hexes from home, Timber Stand 10 → 9, Salt Flats 32 → 33, which crosses from the threat-3 ring into the threat-4 ring). The translation keeps every distance exactly: a location on an odd stage-8 row keeps its column, one on an even row moves one column west; home (9, 19) becomes (9, 36), as the design says. `earlyHex(col, row)` (C4) places today's locations from their stage-8 offsets.
2. **A stand-in Source for the early figures (open question 1, recommended answer).** The design keeps `--ready-level 7` as the early-game guard, but its Source is 122 hexes out at threat 20, which a level-7 party walks to through five rings and cannot beat: the guard, the bands `one`, `company` and `rl10` and the refactor guard would all collapse. The plan adds `--near-source` to the simulator (C2): the campaign's world puts the Source where it stood before this stage (stage 8's (58, 19), shifted to (58, 36)), fought at threat 5 as today; everything else is the stage-9 world. The early figures, the refactor guard and the 50-campaign check run with `--ready-level 7 --near-source` (`rl10` with `--ready-level 10 --near-source`), so they keep their meaning and the bands their values; `bands.md`'s measure names gain the flags (step 02). The long campaign runs without it.
4. **New spawn kinds spawn only from threat 7** *(for the user's eye)*. Spider Nest's band now reaches down to 4 and Salamander Pool's to 5, so "spawns by band" would let them spawn in the home rings and change the early game, which the design keeps unchanged. `SPAWN_KINDS` entries gain `fromThreat`; the four new kinds take 7. The home rings spawn as today.
11. **The refactor guard is re-recorded twice**, in step 04 (the board, rings and blight constants) and in step 05 (the outer nests, sites and partners), each with its old and new figures, rather than once: both move play unavoidably and splitting them keeps each reviewable. Every other step keeps it green.
14. **`SOURCE_THREAT` lives in `worldMap.ts`** (reference §5.1), added in step 01 for the loot rows; `loot.ts` reads it only inside `rollRunes` (the import cycle rule).
15. **Saltmere** keeps its place relative to home, so it is no longer on the map's south edge (flavour only).
16. **No fixed coordinates in the story or tutorial** (inspected: `src/story/` has none); the shift touches `src/` tests, `e2e/` and `e2e/manual.shots.ts`.

### Shared constraints (from the index)

- **Commands** (local Node 26: prefix `PATH=/opt/homebrew/opt/node@26/bin:$PATH`; or the podman `make` targets):
  - `npm test` (`tsc && vitest run`) is the gate before every commit; `npx vitest run <file>` for one file;
  - `npm run test:browser` (or `-- -t <name>`) after this step's coordinate shift; read `e2e/CLAUDE.md` before touching an in-browser test;
  - `npm run simulate -- <flags>`: each run its own `--out` under `logs/` (gitignored), or `--log none`. **Never run two simulations at once.**
- **The refactor guard.** `scripts/simulate.test.ts`, `describe('the refactor guard')`: 5 campaigns from seed 1, each `CampaignRecord` and a SHA-256 of every battle event, against `GUARD_RECORDS`, with args `--campaign --battles 5 --seed 1 --parties 1 --ready-level 7 --near-source` (from step 02). Rules: `.claude/skills/yomi-balance/guards.md`. **This step re-records it once**, with the old and new figures in the doc comment above `GUARD_RECORDS`.
- **The 50-campaign check**, before and after, recorded in `log.md`:

  ```sh
  npm run simulate -- --campaign --battles 50 --seed 1 --parties 1 --ready-level 7 --near-source --out logs/guard-50.jsonl > logs/guard-50.txt
  shasum -a 256 logs/guard-50.jsonl
  ```

- **The policy snapshot** (`src/engine/policies.test.ts`) must not move here: this step changes no encounter.
- **The early-game figure.** Step 01's baseline is in `log.md`. This step does not measure 500 campaigns (step 09 does, after step 08's runtime gate); it records the 50-campaign figures. An out-of-band figure is brought to the orchestrator with options, never tuned away silently; `SPAWN_DIVISOR` is retuned only with the orchestrator's go-ahead.
- **Determinism.** New `SPAWN_KINDS` entries go after today's three, and the eligible list at threats up to 5 is today's. The near-Source world draws nothing extra.
- **Import cycles.** `blight.ts`, `territory.ts`, `worldMap.ts`, `trade.ts` and `buildings.ts` import one another; `loot.ts` imports `worldMap.ts`. Nothing may call across, or read an imported `const` into a top-level table, at module load. `THREAT_RINGS`, `EARLY_SHIFT` and `SOURCE_PLACE` are defined in `worldMap.ts`; `blight.ts` may read them only inside functions.
- **Versions.** `SAVE_VERSION` 29 → 30, no migration: older saves read as unreadable, and the captured fixtures (`src/game/fixtures/save-v18.json` to `save-v27.json`) stay as tests of that. `LOG_SCHEMA_VERSION` unchanged.
- **Commits.** One commit for this step once `npm test` passes and the guard is re-recorded, on `long-campaign-stage-09`, without pushing; files staged by path. Message "Stage 9 step 04: the board and the rings". No attribution lines.
- **Docs.** Fix the CLAUDE.md lines this change makes wrong and search the CLAUDE.md files, `.claude/` and `docs/reference/` for every name removed (`THREAT_BAND`, `MAX_THREAT`).

## 3. Dependencies and prerequisites

- **Step 02** (and through it step 01) must be done, and with it open question 1 answered. If it was answered other than (a), stop and report: the guard args and `NEAR_SOURCE` below assume (a).
- **Step 03** (Routes tab paging) is not needed here; step 05 needs it.

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

### Contract produced (copied unchanged from the index)

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

### Existing code (at `08854d3`, before steps 01–02; line numbers approximate)

- **`src/game/worldMap.ts`:** `WORLD_SIZE` (~147, 60 × 40); `HOME = offsetToHex(9, 19)` (~150, not exported); `THREAT_BAND = 11` and `threatAt` (~165–170, `min(MAX_THREAT, 1 + floor(d / THREAT_BAND))`); the `resource` and `monsters` helpers (~172–192, taking offset `col, row`, the monster's threat from `threatAt`); `PARTNERS` (~199); `newWorld` (~210) with its `locations` list, the Source last (`monsters(SOURCE_ID, …, 58, 19, …)` with `source: true`). After step 02, `newWorld` takes `source: SourcePlace` and `SOURCE_PLACE` is today's place; read what step 02 wrote.
- **`src/game/encounters.ts`:** `MAX_THREAT = 5` (~105), imported by `worldMap.ts` (~17) for `threatAt`.
- **`src/game/blight.ts`:** the constants (~26–68: `BLIGHT_PER_THREAT`, `SOURCE_STRENGTH`, `SPAWN_DIVISOR = 200`, `SPAWN_COST`, `SPAWN_CLEARANCE`, `MAX_MONSTER_LOCATIONS = 24`); `monsterStrength` (~131); `SPAWN_KINDS` (~305) and `spawn` (~311), whose `eligible` filter is by band and whose comment at ~340 ("Unreachable on today's map, as threatAt stops at MAX_THREAT…") becomes wrong: with the ring table every ring threat has a kind, so reword it (the guard against an empty list stays).
- **`THREAT_BAND` and `MAX_THREAT` uses (inspected):** `src/game/blight.test.ts` 34 (import), 263 (`hexDistance(home, l.position) < THREAT_BAND`); `src/game/party.test.ts` 16 (import), 147 (loop to `MAX_THREAT`); `src/game/worldMap.test.ts` 5, 15 (imports), 140 (`threats.at(-1)` is `MAX_THREAT`), 154 (the Source's threat), 342–345 (`threatAt` by `THREAT_BAND`); `src/game/encounters.test.ts` 31 (import), 130, 138, 144, 156 (loops and `sourceGuardians` at `MAX_THREAT`), 390 (`MAX_THREAT` is 5); `src/game/blight.ts` 340 (the comment). These tests keep their meaning with their own bound (for example a local `const HOME_THREATS = 5`, "today's encounters' band") or the ring table; the Source tests expect `SOURCE_THREAT`.
- **`src/game/save.ts`:** `SAVE_VERSION = 29` (~35); `save.test.ts` (~470) has the older fixtures as "reads as unreadable" (`save-v18.json` … `save-v27.json`): they stay. A test that builds a v29 save from a fixture or asserts 29 follows the bump.
- **`scripts/simulate.ts`:** `NEAR_SOURCE` (from step 02).
- **Fixed world coordinates in tests** (`offsetToHex(` appears 187 times in tests; most are battle-board hexes, which stay): world ones in `src/game/*.test.ts` (`worldMap`, `blight`, `company`, `expedition`, `guildHall`, `buildings`, `trade`, `vision` tests), `src/scenes/*.test.ts` (`debugCommands`, `roadsView`, `routesTab`, and any scene helper test placing a world hex), `scripts/simulate.test.ts`. A hex is a world hex when it is used with a `WorldState`, a party's position, a location, `travel`/`walkTo`/`goto`, or the blight. `src/scenes/attackPlan.test.ts` and `src/grid/hex.test.ts` are battle-board or pure maths: leave them.
- **`e2e/`:** `driver.ts:15` `RAIDERS = { id: 'goblin_raiders', position: offsetToHex(13, 18) }`; `world.test.ts` (18 `partyAt` is `(9, 19)`, 21/97/110/136/211/307/354/362/529 `(11, 19)`, 35 `(9, 23)`, 599/669 `(19, 19)`, and any others); `exchange.test.ts` 27 `(7, 19)`, 112 `(11, 21)`; `character.test.ts` ~547 `hops`; `manual.shots.ts` 71 `(19, 19)`, 499 `(8, 17)` and 323 (`hexAt` over `WORLD_SIZE`, which follows the board by itself). Battle-board hexes (`battle.test.ts`, `manual.shots.ts` 120 `battleHexOnScreen`) stay.

## 4. Scope and guidance

1. **Baseline first.** Before any change, run the 50-campaign check (the command above) on the branch as step 02 left it; it must match step 02's hash in `log.md` (if not, stop and report). Note its wall-clock time (`time`), for step 08's comparison.
2. **Make room in `src/game/CLAUDE.md`** (carried item 5), as its own edit before anything else in it: move detail into `docs/reference/game.md` (which already holds the full rules), for example the longer module descriptions or the auto-resolve sentences of "RNG streams", until at least about 600 bytes are free. Keep every contract line a reader needs to avoid breaking the directory; say where the detail went. `npx vitest run scripts/claudeMd.test.ts` passes.
3. **The rings** (C4). `THREAT_RINGS` and `threatAt` as C4; `SOURCE_THREAT` exists from step 01. Remove `THREAT_BAND` and `MAX_THREAT` and fix every use listed in §3 (and any `grep -rn "THREAT_BAND\|MAX_THREAT" src scripts e2e docs/reference .claude` finds). The doc comments on `threatAt` and `MonsterLocation.threat` say the ring table.
4. **The board and the shift** (C4, decision 1). `WORLD_SIZE` 140 × 72; `EARLY_SHIFT` and `earlyHex` exported; `HOME = earlyHex(9, 19)`. Write today's locations with their stage-8 offsets through `earlyHex` (change the `resource` and `monsters` helpers to take a `Hex`, or add early variants; your choice, kept readable), so the stage-8 coordinates stay legible in the code. `PARTNERS` likewise (millbrook `earlyHex(18, 30)`, saltmere `earlyHex(30, 38)`); their doc comment drops "on the south edge" (decision 15). `SOURCE_PLACE` becomes `{ position: offsetToHex(131, 36), threat: SOURCE_THREAT }`; the Source location is last in `locations`, as today. No other location is added (step 05).
5. **The blight** (C4). `BLIGHT_THREAT_CAP` and the capped `monsterStrength`; `SPAWN_DIVISOR = 840` (with the formula in its comment); `MAX_MONSTER_LOCATIONS = 60`; `SPAWN_KINDS` gains `fromThreat` and the four new entries after today's three, and `spawn`'s `eligible` filter adds `threat >= (k.fromThreat ?? 1)`. At threats 1 to 5 the eligible list (and so every draw) is today's. Reword the comment at ~340. Update `blight.ts`'s module comment if a number in it changes.
6. **`NEAR_SOURCE`** in `scripts/simulate.ts` becomes `{ position: earlyHex(58, 19), threat: 5 }` (C4), so the early figures' Source stands where stage 8's did relative to home. Step 02's `--near-source` tests (`scripts/simulate.test.ts`, "--near-source") could not tell `NEAR_SOURCE` from `SOURCE_PLACE` (equal until now): change the one asserting the near world equals `newWorld(seed)` to assert it differs only in the Source's position and threat, and check that the tests fail with `campaignGame`'s `--near-source` rebuild removed (then restore it); say so in the execution record.
7. **`SAVE_VERSION` 30**, no migration; the strict check needs no new rule (the board size is data, and the blight's length is already checked against it). Follow any save test that names 29.
8. **Shift every fixed world coordinate in the tests** (§3): use `earlyHex(col, row)` with the stage-8 numbers where a test is about today's geometry (it reads best), or the rule (an odd stage-8 row keeps its column, an even row's column drops by one; the row gains 17). A test that walked off the old map's edge, or counted hexes of the old board (2,400), follows the new board. Never change a battle-board hex. `e2e/` imports `earlyHex` from `src/game/worldMap.ts` as it imports `offsetToHex`.
9. **Tests** (design §6, this step's part), each deterministic:
   - `worldMap.test.ts`: `threatAt` at both edges of every ring of `THREAT_RINGS` (distances 0, 10, 11, …, 122) and beyond 122 (18); the shift: every pairwise distance among home and stage 8's locations (a table of their stage-8 offsets in the test) equals the distance between their `newWorld` positions, and each one's `threatAt` is what stage 8's `threatAt` gave (1 to 5, unchanged); home is `offsetToHex(9, 36)`; the Source is 122 hexes from home, at threat 20, last in `locations`; every location is on the board; no two share a hex.
   - `blight.test.ts`: the capped strength (a threat-18 nest pushes with `BLIGHT_PER_THREAT * 5`, a threat-5 nest as before, the Source with `SOURCE_STRENGTH`); spawn kinds by band over many seeds (for example 200 seeded worlds, or `spawn` driven on chosen corrupted hexes): no new kind at threats 1 to 5, the home rings' kinds as today, and at each outer ring threat (7, 9, 12, 15, 18) only kinds whose band holds it, at least one eligible at every one; `MAX_MONSTER_LOCATIONS` still stops spawning at 60.
   - Keep the existing tests' meaning where they named `THREAT_BAND` or `MAX_THREAT` (§3).
10. **The in-browser tests.** Run `npm run test:browser` in full: the world tests after the shift (the map draws at the new size as it is; step 07 handles the drawing's limits; if a test fails only because the blight layer is too large for the headless GPU, record it and tell the orchestrator, as step 07 owns that fix). Do not change any scene code here beyond what tsc forces.
11. **Re-record the refactor guard once** (decision 11). Run `npx vitest run scripts/simulate.test.ts -t "refactor guard"`, expect it to fail, and confirm the moves are this step's: the larger board (more land for the blight, no edges near the home country), the outer rings at threat 7 and up with their spawn kinds, `SPAWN_DIVISOR` and `MAX_MONSTER_LOCATIONS`, the stand-in Source at its shifted place (the real one is 122 hexes out, so its push no longer reaches home). Re-record `GUARD_RECORDS` and the event hash; in the doc comment above `GUARD_RECORDS`, write the old and new figures of the 5 campaigns (outcomes, days, battles, spawns, sites captured and lost, land blighted). Raise the test's timeout if the larger board needs it, and say so.
12. **The 50-campaign check after**, alone: record in `log.md` (a dated line under a "Step 04" heading) the hash before and after, Source wins of 50, average days, battles, spawns, the land blighted at the end, and the run's wall-clock time against step 1's (a first look at the runtime; step 08 is the gate). If the Source wins move by more than about 5 of 50 from the baseline, say so with the cause as far as you can tell, and bring it to the orchestrator in your report; retuning is step 09's and needs the orchestrator's go-ahead.
13. **Docs.** `src/game/CLAUDE.md` (the room made, and any line made wrong: `threatAt`, the board), `docs/reference/game.md` (world map: the board, home, the ring table, the shift, the Source's place and threat; blight: the cap, `SPAWN_DIVISOR`, `MAX_MONSTER_LOCATIONS`, `SPAWN_KINDS` with `fromThreat`; saving: version 30), `.claude/skills/yomi-add-content/encounter.md` (a `SPAWN_KINDS` entry may take `fromThreat`), `.claude/skills/yomi-balance/levers.md` (add `BLIGHT_THREAT_CAP`, `SPAWN_DIVISOR`, `MAX_MONSTER_LOCATIONS` as levers, with what each moves; change no band). The manual and its screenshots are step 10's.
14. **Exclusions:** no outer nests, sites, materials or partners (step 05); no scene drawing work (step 07); no 500-campaign measurement (step 09); no change to encounters, loot or the simulator's policy.

## 5. Verification

- `npm test` passes, the re-recorded refactor guard and the new tests of §4.9 included; the policy snapshot is unchanged.
- `npm run test:browser` passes (or the one drawing-size failure is recorded for step 07, §4.10).
- `grep -rn "THREAT_BAND\|MAX_THREAT" src scripts e2e .claude docs/reference` finds nothing.
- `npx vitest run scripts/claudeMd.test.ts` passes, with the byte count of `src/game/CLAUDE.md` recorded.
- The 50-campaign check before and after, with hashes, figures and wall-clock times in `log.md` and the execution record.

## 6. Completion criteria

- [ ] `src/game/CLAUDE.md` has room (count recorded); detail moved to `docs/reference/game.md`.
- [ ] `THREAT_RINGS`, `threatAt`, `WORLD_SIZE`, `EARLY_SHIFT`, `earlyHex`, `SOURCE_PLACE`, `BLIGHT_THREAT_CAP`, `SPAWN_DIVISOR`, `MAX_MONSTER_LOCATIONS`, `SPAWN_KINDS` with `fromThreat`, `SAVE_VERSION` 30 and `NEAR_SOURCE` as C4; `THREAT_BAND` and `MAX_THREAT` gone.
- [ ] Every fixed world coordinate in `src/` tests, `scripts/simulate.test.ts` and `e2e/` shifted; battle-board hexes untouched.
- [ ] The tests of §4.9 pass; `npm test` and `npm run test:browser` pass.
- [ ] The refactor guard re-recorded once, with old and new figures in the doc comment above `GUARD_RECORDS`.
- [ ] The 50-campaign check's before and after hashes, figures and times in `log.md` and the execution record.
- [ ] `src/game/CLAUDE.md`, `docs/reference/game.md`, `encounter.md` and `levers.md` current.
- [ ] One commit, "Stage 9 step 04: the board and the rings", no attribution lines, files staged by path; the index's row 04 updated with status and commit.

## 7. Execution record

**Engineer (opus), 2026-11-22.** Built on `df71427`.

Done, in the task's order:
1. **Baseline:** the 50-campaign check before any edit gave `b50f7b50…e52`, matching step 02 (22 of 50), in 0:31.
2. **Room in `src/game/CLAUDE.md`:** 7,977 → 7,575 bytes by moving the auto-resolve estimate's seeding detail and three long module descriptions (`blight.ts`'s clean sources, `forecast.ts`, `tradingPost.ts`'s levels) to `docs/reference/game.md` (a new "The auto-resolve estimate" section; the rest was already there). After this step's one added rule line (the home country moved by `EARLY_SHIFT`, tests use `earlyHex`): **7,743 bytes**; `scripts/claudeMd.test.ts` passes.
3. **The rings, the board and the shift** as C4: `THREAT_RINGS`, `threatAt` by ring, `WORLD_SIZE` 140 × 72, `EARLY_SHIFT`, `earlyHex`, `HOME = earlyHex(9, 19)`, the `resource` and `monsters` helpers take stage 8's offsets through `earlyHex`, `PARTNERS` likewise (no "south edge"), `SOURCE_PLACE` at offset (131, 36), `SOURCE_THREAT`. `THREAT_BAND` and `MAX_THREAT` are gone (`grep` finds nothing in `src scripts e2e .claude docs/reference`); tests use a local `HOME_THREATS = 5`, the ring table, or (party.test) each encounter's own band.
4. **The blight:** `BLIGHT_THREAT_CAP`, the capped `monsterStrength`, `SPAWN_DIVISOR = 840`, `MAX_MONSTER_LOCATIONS = 60`, `SPAWN_KINDS` with `fromThreat` and the four new kinds after today's three; the "unreachable" comment reworded.
5. **`NEAR_SOURCE`** = `{ position: earlyHex(58, 19), threat: 5 }`. Review note (§4.6): the test that asserted the near world equals `newWorld(seed)` now asserts `NEAR_SOURCE` is offset (58, 36), and a new test that the near world differs from the default only in the Source's place and threat (and the land and sight they seed). With `campaignGame`'s `--near-source` rebuild removed both fail (2 failed, 2 passed), and pass with it restored. The waiting-twin test is unchanged.
6. **`SAVE_VERSION` 30**, no migration; save tests follow (29 now among the refused versions).
7. **Shifted coordinates:** every world `offsetToHex(col, row)` in `src/game/*` tests, `debugCommands.test.ts` and `e2e/` (driver, world, exchange, character, saves, manual.shots) became `earlyHex(col, row)`, except the off-board (−1, 0) and the corner (0, 0); raw axial hexes in pinned tests are moved by `EARLY_SHIFT`; debug commands' typed offsets were shifted by hand (e.g. `spawn goblin_raid 19 37`). Battle-board hexes untouched.
8. **Tests added** (§4.9): `worldMap.test.ts` (the ring table at both edges of every ring in two directions, 18 beyond; the shift as a translation, every pairwise distance and every threat among home and stage 8's 23 locations kept; home at (9, 36); the Source at (131, 36), 122 hexes, threat 20, last); `blight.test.ts` (the cap; spawn kinds over 80 seeds for the home rings and for the outer rings, each kind's band and `fromThreat`, every outer threat 7 to 18 reached, every new kind spawned; the eligible lists by threat; `MAX_MONSTER_LOCATIONS` is 60 and stops spawning).

Re-recorded for this step's board (each with a note in the test): the blight's pinned numbers of one party (on a world with the Source at `earlyHex(58, 19)` and the party's hex moved by `EARLY_SHIFT`: the net influence and the pinned cells came out **identical**; events, spawns, pressure and RNG re-pinned), the low-threat spawn places, the vision pin (identical once moved), the seeded session hash (153 → 150 turns) and the partners-left-out hash. Other test changes: `hexInfo.test.ts`'s fort besieger, `threat: 40`, now pushes as the Source does (a nest's push is capped); `worldEvents.test.ts` names the Source at threat 20; `simulate.test.ts`'s `byThreat` order now sorts numerically (it sorted as strings, wrong from threat 10), its improve-errand hex is moved by `EARLY_SHIFT`, and the trading-post route test runs with `--near-source` (without it one of the four level-1 campaigns, now walking toward the far Source, raised the post and opened a route).

**Refactor guard** re-recorded once; old and new figures in its doc comment and in `log.md`. Outcomes unchanged; days, battles, spawns, sites and land moved for the board, the threat 7 ring behind the near Source and the spawn constants.

**50-campaign check after:** `3ed0dd1c…2396`, **28 of 50** (22 before), 317 days, 18.5 battles, 31.1 spawns, 3.3 captured, 0.1 lost, 26% blighted; 2:01 wall on a loaded machine. More than about 5 of 50: brought to the orchestrator. Attribution (one uncommitted run with `SPAWN_DIVISOR` 200): 24 of 50, so the board about +2 and the divisor about +4: fewer home-country spawns, fewer threat 3 and 4 nests, more threat 5 nests fought (159 → 242 battles) before the Source. Details in `log.md`. No retune (step 09's, with a go-ahead).

**In-browser tests:** all pass, but not in one run. On this machine, loaded by unrelated jobs (load average 25 to 77), full runs timed out 5, 20 and 5 tests, a different set each time, all 60 s timeouts or timing waits but for one real failure, `world.test.ts` "opens on the home valley", whose blight indexes were stage 8's offsets (fixed). Every test that failed passed on a rerun (the five of the last full run alone with one worker: 6 passed). The larger map makes world-map tests slower: `exchange.test.ts` and `debug.test.ts` took 59 s against 42 s at `df71427`, run one after the other. No error from the 7,800 × 3,500 blight render texture was seen; its cost is step 07's (decision 9).

**Policy snapshot** unchanged (its file untouched; it passes). **`npm test`** (tsc and vitest): 102 files, 2,600 tests passed. `npm run build` passes. Under the same load two earlier `npm test` runs timed out (5 and 3 tests, all timeouts): the default campaign is now the real long one, which walks to the far Source (`runCampaign(3, 1, --campaign --parties 1)` takes 19.5 s alone: 2,582 days, 89 battles). The tests that needed only some campaign's record (`summarizeCampaigns` levels, runes, improvements; the company's record's vanguard battles) now run the early game's one-party campaign (`EARLY_ONE`: `--ready-level 7 --near-source`), and the long campaign's determinism test has a 120 s timeout (20 s).

Deviations: the trading-post route test gained `--near-source`; `EARLY_ONE` for four record-shape tests and the 120 s timeout (above); the `byThreat` sort fix; the spawn-kind test's first case has a 30 s timeout (it builds both sets). The scenes reference's `spawn` usage (`docs/reference/scenes.md`) still names three kinds: step 07 builds it from `SPAWN_KINDS`.
