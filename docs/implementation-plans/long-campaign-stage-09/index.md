# Implementation plan: long campaign, stage 9 (the outer rings)

The world map grows from 60 × 40 to **140 × 72**, with home at (9, 36) and today's locations moved with it, so the home country plays as before. Its threat comes from a **ring table** (threats 1 to 5 as today, then 7, 9, 12, 15 and 18 out to 122 hexes), and the **Source** stands at about (131, 36), fought at **threat 20** by a provisional block. The outer rings are filled with foes that exist: bandit camps, spider nests and salamander pools widened to their new bands, and two new bandit encounters, the **Bandit Company** (8–13) and the **Freebooter Host** (14–20). Seven ore and wood **resource sites** and three far **trade partners** (Stonehollow, Elder Glade, Emberwatch) are placed. The blight's push is capped at threat 5's, monster locations may number 60, and spawn pressure is rescaled to the board. Rune loot uses the full table. The simulator gets the long-campaign settings (ready level 18, 6000 days, `--log none`), and its runtime is gated before anything is measured.

**Source design:** [`docs/designs/long-campaign/stage-09-outer-rings.md`](../../designs/long-campaign/stage-09-outer-rings.md) (status "ready for planning"). It cuts from [`reference/campaign-to-level-20.md`](../../designs/long-campaign/reference/campaign-to-level-20.md) §4.1, §5.1, §5.7, §6.2–§6.3 (rings, map, spawns, blight cap, simulator, performance), [`reference/economy-and-trade-routes.md`](../../designs/long-campaign/reference/economy-and-trade-routes.md) §4.3 (far partners) and [`reference/gear-and-runes.md`](../../designs/long-campaign/reference/gear-and-runes.md) §4.3 (resource sites) and §4.5 (rune loot). Conventions: [`docs/designs/long-campaign/index.md`](../../designs/long-campaign/index.md). Previous stage: [stage 8's plan](../long-campaign-stage-08/index.md) and [feature record](../../features/long-campaign-stage-08.md) (decisions in force: roads avoid nests by `RAID_RADIUS` where they can; no save migration, only a `SAVE_VERSION` bump). Feature record: [`docs/features/long-campaign-stage-09.md`](../../features/long-campaign-stage-09.md). History: [`log.md`](log.md). Written against `08854d3` on branch `long-campaign-stage-09`.

## Decisions taken for the orchestrator

The plan follows the stage design, then the references, then the code (where they disagree the code is right, per the stages index). Items marked *(for the user's eye)* change no band but read the design one way where it is silent or loose; item 2 was open question 1, answered by the user: `--near-source`. The user accepted decisions 4, 5, 7 and 8 as written.

1. **The +17-row shift is an axial translation** (q −9, r +17). The map is odd-r, so adding 17 to every offset row is not a translation: it changes distances by one between locations on rows of different parity (Gold Seam 7 → 8 hexes from home, Timber Stand 10 → 9, Salt Flats 32 → 33, which crosses from the threat-3 ring into the threat-4 ring). The translation keeps every distance exactly: a location on an odd stage-8 row keeps its column, one on an even row moves one column west; home (9, 19) becomes (9, 36), as the design says. `earlyHex(col, row)` (C4) places today's locations from their stage-8 offsets.
2. **A stand-in Source for the early figures (open question 1, answered by the user: option (a), `--near-source`).** The design keeps `--ready-level 7` as the early-game guard, but its Source is 122 hexes out at threat 20, which a level-7 party walks to through five rings and cannot beat: the guard, the bands `one`, `company` and `rl10` and the refactor guard would all collapse. The plan adds `--near-source` to the simulator (C2): the campaign's world puts the Source where it stood before this stage (stage 8's (58, 19), shifted to (58, 36)), fought at threat 5 as today; everything else is the stage-9 world. The early figures, the refactor guard and the 50-campaign check run with `--ready-level 7 --near-source` (`rl10` with `--ready-level 10 --near-source`), so they keep their meaning and the bands their values; `bands.md`'s measure names gain the flags (step 02). The long campaign runs without it.
3. **The Source's band is 1 to 20**, with today's counts at 1 to 5 and 5 foes (every slot) at 6 to 20, so the near Source and the `SG7`, `SG10` cells (threat 5) fight as today and the Source at 20 fields the Horror and its four guards at level 20 (design: "native level 1 rules, clamped" read as the encounter's level clamped to its band). Step 09 may lower the count at 20 to make it winnable, which the design allows; nothing else about the Source is tuned.
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

## Scope and shared constraints

- **In:** S9-R1 to S9-R5, rune loot's full table, bandit gear by ring, the design's tests (§6), its simulator checks and play script, the docs the stages index asks for, and the carried items below.
- **Carried forward** (feature record): (1) the Routes tab's four rows: step 03; (2) a raid that comes and goes between yield days never abandons: measured in step 09 with C2's fields, no rule change; (3) raids and abandonment unjudged: step 09 reports raided and abandoned counts on the new map; (4) the company against one party: step 09 reports both at `--ready-level 10 --near-source` and on the long campaign; (5) `src/game/CLAUDE.md` at its 8 KB cap: step 04 makes room before any line is added; (6) market income, spend order, full route figures: stage 12, out.
- **Commands** (local Node 26: prefix `PATH=/opt/homebrew/opt/node@26/bin:$PATH`; or the podman `make` targets):
  - `npm test` (`tsc && vitest run`) is the gate before every commit; `npx vitest run <file>` for one file;
  - `npm run test:browser` (or `-- -t <name>`) after any scene change and after step 04's coordinate shift; read `e2e/CLAUDE.md` before adding an in-browser test;
  - `npm run simulate -- <flags>`: each run its own `--out` under `logs/` (gitignored), or `--log none` once step 02 adds it. **Never run two simulations at once.** Measurements go through the `yomi-measure` agent where a step says so.
- **The refactor guard.** `scripts/simulate.test.ts`, `describe('the refactor guard')`: 5 campaigns from seed 1, each `CampaignRecord` and a SHA-256 of every battle event, against `GUARD_RECORDS`. Rules: `.claude/skills/yomi-balance/guards.md`. From step 02 its args are `--campaign --battles 5 --seed 1 --parties 1 --ready-level 7 --near-source`.
  - Steps 01, 03, 06, 07 and 08 must not edit the fixture and keep it green; a mismatch means the step changed play: find the cause and fix it. Step 02 only adds its new fields' values to the records. **Steps 04 and 05 each re-record it** with the old and new figures in the doc comment above `GUARD_RECORDS`. Step 09 may re-record only for a retune the orchestrator approved.
  - **The 50-campaign check** before committing a domain or simulator step (01, 02, 04, 05, 08, 09), against a hash taken before the step, recorded as "identical" or the diff in `log.md`:

    ```sh
    # step 01 (before --near-source exists):
    npm run simulate -- --campaign --battles 50 --seed 1 --parties 1 --out logs/guard-50.jsonl > logs/guard-50.txt
    # from step 02:
    npm run simulate -- --campaign --battles 50 --seed 1 --parties 1 --ready-level 7 --near-source --out logs/guard-50.jsonl > logs/guard-50.txt
    shasum -a 256 logs/guard-50.jsonl
    ```

    Steps 01 and 02 must be identical; 04 and 05 record the new hash and figures; 03, 06 and 07 change no rule and need not run it (say so).
- **The policy snapshot** (`src/engine/policies.test.ts`, "the choices of today's encounters"): re-recorded in step 01 only (decision 12), and in step 09 if the Source's count at 20 changes.
- **The early-game figure.** Stage 8 ended at 233 of 500 (`--parties 1`) and 232 (company), `rl10` 433. **Step 01 re-measures `one`, `company` and `rl10` before any change**: the stage's baseline. Step 09 measures again with `--near-source`. A move of more than about 5 points is explained in the commit and in `src/game/CLAUDE.md`'s scaling line, or retuned; **an out-of-band figure is brought to the orchestrator with options, never tuned away silently.** The design allows retuning `SPAWN_DIVISOR` (only with the orchestrator's go-ahead, as it moves the guard) and making the Source winnable (step 09, decision 3). The user's bands (`.claude/skills/yomi-balance/bands.md`) are never changed.
- **The runtime gate** (design §2, campaign §6.3) is **step 08, an explicit checkpoint**: if a 500-campaign run takes, or a 100-campaign long run projects to, more than about 20 minutes, profile `advanceDay` and stop for the orchestrator before measuring. Step 09 does not start until step 08 is done.
- **Determinism.** No step adds, drops or reorders a draw of the world RNG or a battle's RNG except where play is meant to move (steps 04, 05). New `SPAWN_KINDS` entries go after today's three, and the eligible list at threats up to 5 is today's. The near-Source world draws nothing extra.
- **Import cycles.** `blight.ts`, `territory.ts`, `worldMap.ts`, `trade.ts` and `buildings.ts` import one another; `loot.ts` gains an import of `worldMap.ts`. Nothing may call across, or read an imported `const` into a top-level table, at module load.
- **Versions.** `SAVE_VERSION` 29 → 30 in step 04, no migration (stage 8's practice: older saves read as unreadable; the captured fixtures stay as tests of that). `LOG_SCHEMA_VERSION` unchanged: no battle event changes shape.
- **Content.** `.claude/skills/yomi-add-content/`: `encounter.md` (steps 01, 04), `debug-command.md` (step 07). No new foe kind, location kind, item or rune. Sprites: `.claude/skills/yomi-sprites/` (`art/CLAUDE.md`, `docs/designs/sprite-drawing-guidance.md`); never edit an exported PNG; `npm run sprites` then `npm run sprites:check`, then the `yomi-asset-check` agent. Manual: `.claude/skills/yomi-manual/`. Balance: `.claude/skills/yomi-balance/`.
- **Commits.** One commit per step once `npm test` passes (and the guard holds as above), on `long-campaign-stage-09`, without pushing; files staged by path. A step run in a worktree commits on its own branch, merged by the orchestrator. Messages "Stage 9 step NN: <title>". No attribution lines.
- **Docs.** Each step fixes the CLAUDE.md lines its change makes wrong and searches the CLAUDE.md files, `.claude/` and `docs/reference/` for every name it renames or removes (`THREAT_BAND`, `MAX_THREAT`, …). `scripts/claudeMd.test.ts` caps `src/game/CLAUDE.md` at 8 KB: it is at 7,977 bytes, so step 04 moves detail to `docs/reference/game.md` first. Scene steps update the manual's text for their screens; step 10 retakes the screenshots and writes the rest.

## Contracts

The task files hold each contract's full text, copied verbatim (C1, C2, C4 and C5 are summarised here to keep this index under its cap); a step that changes a contract updates every task file that copies it.

Each task file copies its contracts unchanged. "Existing" means at `08854d3`.

### C1. The far encounters, bandit gear and rune loot (step 01)

`encounters.ts`: `banditCompany` (8–13, 4 foes) and `freebooterHost` (14–20, 4 then 5 from 17), after `salamander_pool` in `ENCOUNTERS`; bands widened: Spider Nest 4–9, Salamander Pool 5–9, Source Guardians 1–20 (5 foes from 6), threats 1–5 unchanged; `MAX_THREAT` stays until step 04. `bandits.ts`: `banditGear` Masterwork steel (tier 2, grade 3) from threat 8. `worldMap.ts`: `SOURCE_THREAT = 20`. `loot.ts`: `rollRunes` by row (≤ 8 drawing exactly as today; 9–13, 14–19, ≥ `SOURCE_THREAT`). `scripts/dayCost.ts`: ms a day of `passTurn` and `advanceDay`. Full text: the task files of steps 01, 04, 05, 10.

### C2. The simulator's long-campaign settings and the Source's place (step 02)

`worldMap.ts`: `SourcePlace`, `SOURCE_PLACE` (today's place at step 02, `SOURCE_THREAT` far out from step 04), `newWorld(..., source)`. `simulate.ts`: `SOURCE_READY_LEVEL = 18`, `MAX_CAMPAIGN_DAYS = 6000`, `NEAR_SOURCE`, `--log none`, `--near-source`; `CampaignRecord` gains `vanguardWalkDays`, `routeRaidsTold`, `routeFlickers`, `routesRaidedLong`; the refactor guard's args gain `--ready-level 7 --near-source`; `bands.md`'s measure names gain the flags and the long-campaign measures and report-only cells. Full text: the task files of steps 02, 04, 08, 09, 10.

### C3. The Routes tab pages (step 03)

```ts
// src/scenes/routesTab.ts: ROUTE_ROWS (4) is the rows a page shows; routeRows is unchanged
// src/scenes/TradingPostScene.ts: the Routes tab shows rows page by page with the pager the other tabs use ("Page N of M", Prev, Next)
//   once there are more than ROUTE_ROWS; turning a page selects that page's first row, and the minimap and notes follow the selection
// The Routes tab's probe lists the rows of the page shown, and the pager's buttons as the other tabs' probes do.
// routesTab.test.ts: the `PARTNERS.length <= ROUTE_ROWS` assertion goes.
```

### C4. The board and the rings (step 04)

`worldMap.ts`: `THREAT_RINGS` and `threatAt` by ring (`THREAT_BAND` and `MAX_THREAT` go), `WORLD_SIZE` 140 × 72, `EARLY_SHIFT` and `earlyHex` (decision 1), `SOURCE_PLACE` at (131, 36), threat 20. `blight.ts`: `BLIGHT_THREAT_CAP = 5`, `SPAWN_DIVISOR = 840`, `MAX_MONSTER_LOCATIONS = 60`, `SPAWN_KINDS` gains the four new kinds with `fromThreat: 7`. `SAVE_VERSION` 30; `NEAR_SOURCE` at `earlyHex(58, 19)`. Full text: the task files of steps 04, 05, 07, 10.

### C5. The outer rings' content (step 05)

`territory.ts`: seven new materials and resource sites (rings 7 to 18) and their works names. `worldMap.ts`: partners Stonehollow (ring 7), Elder Glade (12), Emberwatch (15); fixed outer nests, 4 to 6 a ring, by ring; `newWorld`'s location order. `debugCommands.ts`: `MATERIALS` gains the seven. Full text: the task files of steps 05, 07, 10.

### C6. Partner sprites (step 06)

`map_partner_hold` (Stonehollow, a mountain hold), `map_partner_glade` (Elder Glade, a forest people's glade), `map_partner_pass` (Emberwatch, a fortified pass), each in `art/map/` with the frames and animations `map_partner_village` has, at its size. Step 07 maps them in `PARTNER_SPRITES`.

### C7. The world map at the new size (step 07)

```ts
// src/scenes/WorldScene.ts
// PARTNER_SPRITES gains stonehollow: 'map_partner_hold', elder_glade: 'map_partner_glade', emberwatch: 'map_partner_pass'
//   (only for sprites step 06 delivered; without them the fallback stands)
// The blight layer is drawn as render-texture tiles no larger than BLIGHT_TILE_PX (2048) a side, covering the map; nothing else changes in how it looks
// The view scrolls and drags to every edge of the 140 × 72 map (mapScroll.ts)
// src/scenes/debugCommands.ts: `spawn` takes any SPAWN_KINDS encounter (its usage built from SPAWN_KINDS) and refuses one whose band, or fromThreat, does not hold the hex's threat
```

## Tasks

| Step | Task | Outcome | Depends on | Engineer / reviewer | Status |
| --- | --- | --- | --- | --- | --- |
| 01 | [Baseline and the far encounters](01-baseline-and-encounters.md) | Stage baseline (`one`, `company`, `rl10`, 50-check, day cost by a new `scripts/dayCost.ts`, rerun in step 08); Bandit Company, Freebooter Host, widened bands, the Source's band, bandit gear, rune loot rows, `SOURCE_THREAT` (C1); policy snapshot re-recorded; guard identical | — | opus / opus | done (8badf43, 0796d4a) |
| 02 | [The simulator's long-campaign settings](02-simulator-settings.md) | `--log none`, `--near-source` and `SourcePlace`, ready level 18, 6000 days, walk and route-flicker fields, guard args, measure names (C2); guard identical | 01 | opus / opus | done (3ac2548, ec13cd8) |
| 03 | [The Routes tab pages](03-routes-tab-paging.md) | Routes tab paging (C3); manual text; in-browser test | — | sonnet / opus | done (0820d94, 69d5ebc, af27c27; 3 review rounds) |
| 04 | [The board and the rings](04-board-and-rings.md) | 140 × 72, ring table, the shift, the Source at 20, blight cap, spawns by band, `SPAWN_DIVISOR`, save 30, coordinates in tests and `e2e/` (C4); room made in `src/game/CLAUDE.md`; guard re-recorded | 02 | opus / opus | done (fa4782e; awaiting review; 50-check 22 → 28 of 50, brought to the orchestrator) |
| 05 | [The outer rings' content](05-outer-content.md) | Outer nests, seven sites and their materials, three far partners (C5); guard re-recorded | 03, 04 | opus / opus | pending |
| 06 | [Partner sprites](06-partner-sprites.md) | `map_partner_hold`, `map_partner_glade`, `map_partner_pass` (C6) | — | sonnet / opus | done (f5f1ce0; 1 review round, clean) |
| 07 | [The world map at the new size](07-world-map.md) | Tiled blight layer, scrolling to every edge, fog and growth cost checked, partner sprites mapped, debug `spawn` by band (C7); manual text; in-browser tests | 05, 06 | sonnet / opus | pending |
| 08 | [The runtime gate](08-runtime-gate.md) | Day cost after; 500-campaign early run and 100-campaign long run timed; **checkpoint**: over about 20 minutes, `advanceDay` profiled and the orchestrator decides | 05 | opus / opus | pending |
| 09 | [Measure and judge](09-measure.md) | Early figures with `--near-source` against the baseline, long-campaign baseline (100), company against one party, routes raided, abandoned and flickering, new cells, the Source made winnable | 08 | opus / opus | pending |
| 10 | [Document and play](10-document-and-play.md) | CLAUDE.md files, `docs/reference/`, the balance skill, the manual and its screenshots, the blight design, implementation notes, stages index; play script walked | 07, 09 | sonnet / opus | pending |

**Tiers.** "opus" means leave the model unset; "sonnet" means `model: "sonnet"`. Every reviewer is opus.
- 01: new encounters and loot draws that must keep today's RNG order and re-record a snapshot only where meant.
- 02: the guard's meaning and the simulator's determinism; a new world option in the domain.
- 03: a pager that exists on the other tabs, under a fixed contract.
- 04: the map, the rings and the blight constants, the shift's exactness, and a guard re-record that must be explained.
- 05: authoring placements that hold the rings and bands, with a guard re-record.
- 06: tool work with a judged look.
- 07: fixed contracts on existing patterns; escalate to opus if the frame-time check fails for an unknown cause.
- 08: profiling and a go/no-go judgment.
- 09: balance judgment against the user's bands.
- 10: the content is decided by then; the reviewer checks the docs against the code and the play script against what was seen.

## Execution order

01 → 02 → 04 → 05 → then two tracks: **scenes** 07, and **simulator** 08 → 09; 10 after both.

- **03** touches only `src/scenes/`, `src/testHook.ts`, `e2e/` and the manual: run it any time before 05 (it may run beside 01 and 02, on the stage branch or in its own worktree).
- **06** touches only `art/` and `public/assets/sprites/`: any time, in its own worktree, merged before 07.
- **07** may run beside 08 and 09: it touches `src/scenes/`, `src/testHook.ts`, `e2e/` and the manual; 08 and 09 touch `scripts/`, `logs/` and the plan (and, in 09, possibly `encounters.ts`). The index's table is the only shared file (update your row only).
- **Checkpoints:** after 02 the guard has its stage-9 meaning; after 05 the domain is complete; **after 08 the orchestrator decides whether to go on** if the runtime is over the gate; 09 measures on the code as 08 left it.
- **Open question 1** is answered (`--near-source`); nothing is blocked on it.

## Requirement map

| Design item | Steps |
| --- | --- |
| S9-R1 the ring table, `SOURCE_THREAT`, the Source at 20 (campaign R1, A1) | 01 (`SOURCE_THREAT`, the Source's band), 04 (rings, `threatAt`, the Source's place), 09 (winnable) |
| S9-R2 the bigger map, early geometry kept, outer nests and spawns by band (campaign R2, A2) | 04 (board, shift, spawns), 05 (nests), 07 (the map drawn), 01 (encounters) |
| S9-R3 blight strength capped (campaign R3) | 04 |
| S9-R4 resource sites and far partners (gear R7 sites, economy §4.3) | 05 (rules), 06 (sprites), 07 (map), 03 (Routes tab) |
| S9-R5 simulator settings and runtime (campaign R14 part) | 02, 08, 09 |
| §2 Bandit Company, Freebooter Host, widened bands, bandit gear by ring | 01 |
| §2 rune loot's full table (gear §4.5) | 01 |
| §2 the world map: camera, minimap, vision and fog | 07 (the Routes minimap keeps the aspect by `minimapBoard`; checked in 03 and 07) |
| §5 the shift in tests, tutorial and story | 04 (story and tutorial have none, decision 16) |
| §5 `advanceDay` per day before and after | 01 (before), 08 (after) |
| §5 `SAVE_VERSION` | 04 |
| §6 tests: `worldMap.test.ts` (rings 04; shift 04; nest bands 05; partners and sites 05), `blight.test.ts` (cap 04; spawn kinds by band 04), `simulate.test.ts` `--log none` (02) | as listed |
| §6 simulator checks 1 (early guard) and 2 (long campaign, 100 first) | 01 (baseline), 09 |
| §6 play script | 07 (debug `spawn`), 10 (walked) |
| §7 risks: runtime, blight, pacing | 08, 09 |
| Carried 1–6 | 03; 09 (with 02's fields); 09; 09; 04; out (decision 17) |
| Cross-stage: docs, manual, implementation notes | each step; 10 |

## Completion criteria

- `npm test`, `npm run test:browser`, `npm run build` and `npm run sprites:check` pass.
- The guard fixture was edited only by steps 02 (new fields), 04 and 05 (and 09 only for an approved retune), and passes.
- The early figures (`one`, `company`, `rl10`, with `--near-source`) are within about 5 points of step 01's baseline and in band, or the move is explained (or retuned with the orchestrator's go-ahead); out-of-band figures were brought to the orchestrator.
- A 100-campaign long run completed in reasonable time (step 08's gate), its baseline (levels reached, battles to level, days, walking days, Source share, deaths by level) recorded in the stage design's implementation notes, and the Source won at least sometimes.
- Routes raided, abandoned and flickering, and the company against one party, reported with figures.
- CLAUDE.md files, `docs/reference/`, the balance skill, the manual and its screenshots are current; the stage design has its implementation notes; the stages index shows stage 9's status. The play script has been walked, with what was seen recorded in step 10.

## Open questions

1. **(Answered: (a), `--near-source`, the user's choice; step 02 builds it.) How are the early figures measured once the Source is at threat 20, 122 hexes out?** Options: (a) *recommended:* `--near-source`, a simulator-only stand-in that puts the Source where it stood before this stage at threat 5, with the early figures, the refactor guard and the 50-campaign check run with it, and `bands.md`'s measure names (`one`, `company`, `rl10`, `rl12`) gaining `--ready-level 7` or `10` and `--near-source` (band values unchanged) — decision 2; (b) keep the real Source and redefine the early figure (for example "the vanguard reaches level 7 without losing the encampment"), with new bands set by the user; (c) drop the early figures until stage 12. The plan is written for (a).

Accepted by the user as written: decisions 4 (new spawn kinds from threat 7), 5 (Masterwork steel from threat 8), 7 (the loot rows), 8 (partner sprites).

## For implementers

When you start or finish a step, update its status and commits in the table above. Record evidence (commands and output, the guard's result, timings), deviations and blockers in your task file's "Execution record", and anything the plan as a whole accumulates (measurements, run histories, review summaries) in [`log.md`](log.md). Keep this index short; every implementer reads it.
