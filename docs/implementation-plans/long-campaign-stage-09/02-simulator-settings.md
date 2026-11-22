# Step 02: The simulator's long-campaign settings

[Plan index](index.md) · [Stage design](../../designs/long-campaign/stage-09-outer-rings.md) (§2 "The simulator", §6 Simulator, §7 Risks) · [Campaign reference](../../designs/long-campaign/reference/campaign-to-level-20.md) §5.7 (the simulator), §6.3 (performance), §6.5 (tuning), A3 · [Stages index](../../designs/long-campaign/index.md) ("The early-game guard") · [Plan log](log.md)

> **Blocked on open question 1** (index, "Open questions"). This file is written for answer (a). Do not start until the orchestrator has settled it; if the answer is (b) or (c), this step is rewritten.
>
> **Question 1.** How are the early figures measured once the Source is at threat 20, 122 hexes out? (a) *Recommended:* `--near-source`, a simulator-only stand-in that puts the Source where it stood before this stage at threat 5, with the early figures, the refactor guard and the 50-campaign check run with it, and `bands.md`'s measure names (`one`, `company`, `rl10`, `rl12`) gaining `--ready-level 7` or `10` and `--near-source` (band values unchanged), decision 2; (b) keep the real Source and redefine the early figure (for example "the vanguard reaches level 7 without losing the encampment"), with new bands set by the user; (c) drop the early figures until stage 12.

**Difficulty:** opus / opus. The engineer changes what the refactor guard and the early-game bands mean, adds a world option to the domain that must leave play byte-for-byte the same, and adds record fields that later steps measure the carried route items with: judgment about determinism, so leave the model unset. The reviewer (opus) checks that nothing played moved: the event hash and the 50-campaign hash identical, the fixture changed only by the new fields' values.

## 1. Objective

Give the simulator the long campaign's settings before the map grows, so that the guard keeps its meaning through steps 04 and 05:
- `SOURCE_READY_LEVEL` 18 and `MAX_CAMPAIGN_DAYS` 6000 (campaign §5.7);
- `--log none`, which writes no JSONL (campaign §5.7);
- `--near-source` and the domain's `SourcePlace`: a campaign world whose Source stands where it stood before stage 9, at threat 5 (decision 2);
- four record fields: the vanguard's walking days and three route-raid counts (decision 13), printed in the summary;
- the refactor guard and the 50-campaign check pinned to `--ready-level 7 --near-source`;
- the measure names in the balance skill, the `yomi-measure` agent and the docs brought to the new flags.

Play does not move in this step: on today's map `NEAR_SOURCE` is the Source's own place, and the guard pins the ready level it always had.

## 2. Requirements and context

- **S9-R5 (part)** (design §2, "The simulator"): `SOURCE_READY_LEVEL` is 18; `MAX_CAMPAIGN_DAYS` is 6000; the threat table runs to 20 (already: `ThreatTally` prints every threat seen; add a test that a threat-20 battle gets a row); `--log none` is added. Runtime is measured in step 08, not here.
- **Design §6 tests:** `scripts/simulate.test.ts`: `--log none`.
- **Design §6 Simulator:** (1) `--ready-level 7`, the early-game guard; (2) the long campaign, `--battles 100` first: levels reached, battles to level, days, walking days, Source share. This step makes both measurable (the walking days are `vanguardWalkDays`); step 09 measures them.
- **Campaign A3:** "A campaign run with `--ready-level 7` and the new code behaves like today's within noise. The early game's results do not depend on the outer rings." Answer (a) to open question 1 keeps this measurable.
- **Carried items (feature record) this step prepares, step 09 measures:** (2) a route whose raid comes and goes between yield days is never abandoned, because `route_restored` resets the count (the user's rule; no rule change); (3) raids and abandonment are unjudged by the simulator; (4) the company against one party on the new map.

### Decisions from the index this step applies (unchanged)

2. **A stand-in Source for the early figures (open question 1, recommended answer).** The design keeps `--ready-level 7` as the early-game guard, but its Source is 122 hexes out at threat 20, which a level-7 party walks to through five rings and cannot beat: the guard, the bands `one`, `company` and `rl10` and the refactor guard would all collapse. The plan adds `--near-source` to the simulator (C2): the campaign's world puts the Source where it stood before this stage (stage 8's (58, 19), shifted to (58, 36)), fought at threat 5 as today; everything else is the stage-9 world. The early figures, the refactor guard and the 50-campaign check run with `--ready-level 7 --near-source` (`rl10` with `--ready-level 10 --near-source`), so they keep their meaning and the bands their values; `bands.md`'s measure names gain the flags (step 02). The long campaign runs without it.
3. **The Source's band is 1 to 20**, with today's counts at 1 to 5 and 5 foes (every slot) at 6 to 20, so the near Source and the `SG7`, `SG10` cells (threat 5) fight as today and the Source at 20 fields the Horror and its four guards at level 20 (design: "native level 1 rules, clamped" read as the encounter's level clamped to its band). Step 09 may lower the count at 20 to make it winnable, which the design allows; nothing else about the Source is tuned.
11. **The refactor guard is re-recorded twice**, in step 04 (the board, rings and blight constants) and in step 05 (the outer nests, sites and partners), each with its old and new figures, rather than once: both move play unavoidably and splitting them keeps each reviewable. Every other step keeps it green.
13. **Measuring the carried route items needs record fields** (step 02, C2): `routeRaidsTold`, `routeFlickers` (a road told safe and raided again within 30 days, the case that is never abandoned) and `routesRaidedLong`; and `vanguardWalkDays` for the design's "walking days". Step 02 adds their values to `GUARD_RECORDS` only (no other value and not the event hash moves).
17. **Out of scope:** the high roster (stage 11); tiers 3 to 5, forging and partners' goods for sale (stage 10); market income, the simulator's spend order and full-campaign route figures (stage 12, carried); any rule change to raids or abandonment (the "safe again" reset is the user's rule: step 09 measures it, carried item 2).

### Shared constraints (from the index)

- **Commands** (local Node 26: prefix `PATH=/opt/homebrew/opt/node@26/bin:$PATH`; or the podman `make` targets):
  - `npm test` (`tsc && vitest run`) is the gate before every commit; `npx vitest run <file>` for one file;
  - `npm run simulate -- <flags>`: each run its own `--out` under `logs/` (gitignored), or `--log none` once this step adds it. **Never run two simulations at once.**
- **The refactor guard.** `scripts/simulate.test.ts`, `describe('the refactor guard')`: 5 campaigns from seed 1, each `CampaignRecord` and a SHA-256 of every battle event, against `GUARD_RECORDS`. Rules: `.claude/skills/yomi-balance/guards.md`. From this step its args are `--campaign --battles 5 --seed 1 --parties 1 --ready-level 7 --near-source`. **This step only adds its new fields' values to the records**; every existing value and `GUARD_EVENTS_SHA256` stay as they are. A mismatch elsewhere means the step changed play: find the cause and fix it.
- **The 50-campaign check**, before committing, against a hash taken before the step, recorded as "identical" or the diff in `log.md`. It must be identical:

  ```sh
  # before the change (step 01's command):
  npm run simulate -- --campaign --battles 50 --seed 1 --parties 1 --out logs/guard-50.jsonl > logs/guard-50.txt
  # after the change:
  npm run simulate -- --campaign --battles 50 --seed 1 --parties 1 --ready-level 7 --near-source --out logs/guard-50.jsonl > logs/guard-50.txt
  shasum -a 256 logs/guard-50.jsonl
  ```

- **The early-game figure.** Stage 8 ended at 233 of 500 (`--parties 1`) and 232 (company), `rl10` 433; step 01 re-measured the stage's baseline (`log.md`). An out-of-band figure is brought to the orchestrator with options, never tuned away silently. The user's bands (`.claude/skills/yomi-balance/bands.md`) are never changed: this step edits only the measure names' flags column and adds report-only names.
- **Determinism.** No draw of the world RNG or a battle's RNG is added, dropped or reordered. The near-Source world draws nothing extra.
- **Import cycles.** `blight.ts`, `territory.ts`, `worldMap.ts`, `trade.ts` and `buildings.ts` import one another. Nothing may call across, or read an imported `const` into a top-level table, at module load: `SOURCE_PLACE` may be a top-level const in `worldMap.ts` built from `offsetToHex` (hex.ts) and a literal, not from `threatAt`.
- **Versions.** No `SAVE_VERSION` change here (`WorldState`'s shape is unchanged); `LOG_SCHEMA_VERSION` unchanged.
- **Commits.** One commit once `npm test` passes and the guard holds, on `long-campaign-stage-09`, without pushing; files staged by path. Message "Stage 9 step 02: the simulator's long-campaign settings". No attribution lines.
- **Docs.** Fix the CLAUDE.md lines this change makes wrong; search the CLAUDE.md files, `.claude/` and `docs/reference/` for `SOURCE_READY_LEVEL`, `MAX_CAMPAIGN_DAYS`, "ready level 7", "(7)", "`--out`" and the measure names, and fix every statement this step makes false.

## 3. Dependencies and prerequisites

- **Step 01** must be done (its baseline and 50-campaign hash are in `log.md`; `SOURCE_THREAT` exists in `worldMap.ts`). **Open question 1** must be answered (a).
- Steps 04 and 05 consume this step's `SourcePlace`, `NEAR_SOURCE` and the pinned guard args; step 04 changes `SOURCE_PLACE` and `NEAR_SOURCE.position`. Step 09 consumes the record fields and measure names.

### Contracts consumed (copied unchanged from the index)

From **C1** (step 01):

```ts
// src/game/worldMap.ts
export const SOURCE_THREAT = 20   // the Source's threat; on the map from step 04
```

and the Source's band: `source_guardians { 1, 20 }  [2, 3, 3, 3, 4, then 5 at each of 6 to 20]   threats 1–5 unchanged`.

From **C4** (step 04, for what comes after this step; not built here):

```ts
export const SOURCE_PLACE: SourcePlace = { position: offsetToHex(131, 36), threat: SOURCE_THREAT }   // 122 hexes from home
// scripts/simulate.ts: NEAR_SOURCE.position = earlyHex(58, 19) (offsetToHex(58, 36))
```

### Contract produced (copied unchanged from the index)

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

### Existing code (at `08854d3`; line numbers approximate)

- **`src/game/worldMap.ts`:** `newWorld(seed, encampmentName, partners = PARTNERS)` (~210) builds `locations` with the Source last: `{ ...(monsters(SOURCE_ID, 'The Blight Source', 58, 19, 'source_guardians', [STORM_WAND]) as MonsterLocation), source: true }`, whose `threat` is `threatAt(offsetToHex(58, 19))` = 5; then `seedBlight`, `initialHeld`, `seedBlight`, `seedSight`. `newGame` (`gameState.ts` ~45) calls `newWorld(seed, encampmentName)`.
- **`scripts/simulate.ts`:** `parseArgs` (~200–305; `--trading-post` is the pattern for a campaign-only flag and its refusal ~302); `CliArgs` (~130); `MAX_CAMPAIGN_DAYS = 2000` and `SOURCE_READY_LEVEL = 7` (~368); `CampaignRecord` (~375–455) and its literal in `startCampaign` (~1132); `campaignGame(seed, args)` (~1899: `newGame(startingParty(args), null, seed)`, then the trading post); the waiting twin (`waitingIncome`, after `campaignGame`: "from the same start as `startCampaign`'s") — it must build the same world, near Source included; `tally` (world events into the record; stage 8's `partnersContacted`, `routesRaided` and `goldBySource.routes` are the pattern); `vanguardWalkHomeDays` counted at ~1814 (`days.filter((day) => day?.walked)` while the vanguard's phase is `home`): `vanguardWalkDays` counts the same walked days whatever the phase; `summarizeCampaigns` (~2297) and the printed summary in `main` (~2418–2515: `openSync(args.outPath)`, `writeSync` per battle, `tally.add` and `threats.add` per event, `closeSync`; the header line prints `-> ${args.outPath}`).
- **`scripts/simulate.test.ts`:** `describe('the refactor guard')` (~2447) with `parseArgs(['--campaign', '--battles', '5', '--seed', '1', '--parties', '1'])`, `GUARD_RECORDS` and `GUARD_EVENTS_SHA256`.
- **Docs:** `.claude/skills/yomi-balance/bands.md` ("Measure names for `yomi-measure`", "Cell codes"), `running.md`, `.claude/agents/yomi-measure.md` and its copy `.codex/agents/yomi-measure.toml`, the root `CLAUDE.md` Commands table ("Battle simulator / campaign balance measure" row), `docs/reference/simulator.md` (the flags paragraph names `--ready-level`'s default 7), `scripts/CLAUDE.md`.

## 4. Scope and guidance

1. **Baseline first.** Before any change run the 50-campaign check with step 01's command and confirm it matches step 01's hash in `log.md` (if not, stop and report). Keep the hash.
2. **`SourcePlace` in the domain.** Add `SourcePlace`, `SOURCE_PLACE` (today's place: `offsetToHex(58, 19)`, threat 5, a literal, not `threatAt`) and `newWorld`'s fourth parameter as C2. The Source location takes `source.position` and `source.threat`; its id, name, encounter, loot and place in `locations` (last) are unchanged; the blight is seeded after, as now. With the default every world is byte-for-byte today's. Callers that pass nothing (`newGame`, tests) are untouched.
3. **`NEAR_SOURCE` and `--near-source`.** `NEAR_SOURCE` as C2 (exported; step 04 moves its position). `--near-source` sets `nearSource`; refused without `--campaign`, with a message in the style of `--trading-post`'s. In `campaignGame`, with `nearSource`, replace the new game's world with `newWorld(seed, undefined, PARTNERS, NEAR_SOURCE)` before anything else touches it (the `--trading-post` level after), drawing nothing more; the party already stands at the encampment, whose place is the same. The waiting twin must get the same world (build it through the same function). Today `NEAR_SOURCE` equals `SOURCE_PLACE`, so nothing moves yet; it parts from it in step 04.
4. **`SOURCE_READY_LEVEL` 18, `MAX_CAMPAIGN_DAYS` 6000.** Change both. The guard pins `--ready-level 7`. A longer day limit changes only a campaign that timed out at 2000 days: if the 50-campaign check is not identical, find the campaigns that differ and confirm each timed out before (`out of days` in the before summary); say so in the record. Any other difference is a bug.
5. **`--log none`.** `--log jsonl|none` (default `jsonl`; anything else refused). With `none`, `main` opens no file and writes nothing, but still feeds every event to `tally` and `threats`, so every printed line is the same as with `jsonl`; the header says where the log went (for example `-> no log`). `--out` is accepted and ignored with `none` (or refused: your choice; say which in `simulator.md`). Single battles honour it too.
6. **The record fields** (C2), with doc comments, in `CampaignRecord`, the literal in `startCampaign`, `tally` and `summarizeCampaigns`:
   - `vanguardWalkDays`: every walked day of the vanguard, any phase (beside the existing `vanguardWalkHomeDays` count; a lone party is the vanguard).
   - `routeRaidsTold`: `route_raided` with `days === 0`.
   - `routeFlickers`: a `route_restored` for a route, followed by a `route_raided` with `days === 0` on the same route (by `route` id) within `ABANDON_AFTER * YIELD_DAYS` days of it (world turn of each event; import both constants, never hard-code 30).
   - `routesRaidedLong`: at the campaign's end, the routes (by id) with `ABANDON_AFTER` or more `route_raided` events of `days >= 1` in all that had no `route_abandoned`.
   Keep per-route state in the run (a map by route id), not in the record. The printed summary: the trade line gains raids told, flickers and long-raided routes (averages); a walking line gives walked days and days walking home a campaign. Wording is yours, a line or two.
7. **Pin the guard.** The refactor guard's args become C2's. Run it: only the four new fields should fail. Add their values to each record of `GUARD_RECORDS` (with today's map and no route, expect 0 for the route fields) and nothing else; `GUARD_EVENTS_SHA256` must pass unchanged. Note in the doc comment above `GUARD_RECORDS`: "stage 9 step 02: args pinned to `--ready-level 7 --near-source`; four fields added, play unchanged".
8. **Tests** in `scripts/simulate.test.ts` (deterministic, small):
   - parsing: the defaults (`readyLevel` 18, `log` `'jsonl'`, `nearSource` false); `--log none`; `--log` with any other value refused; `--near-source` refused without `--campaign`; `SOURCE_READY_LEVEL` 18 and `MAX_CAMPAIGN_DAYS` 6000;
   - `--log none`: a small run (a few single battles, or one short campaign through the function `main` uses, if it can be reached without spawning a process; otherwise a spawned `node scripts/simulate.ts` with a tiny `--battles`) writes no file at the `--out` path and prints the same summary lines as the same run with `jsonl` (minus the header's destination);
   - `--near-source`: the campaign world's Source stands at `NEAR_SOURCE.position` with threat 5, and on today's map the world equals the default `newWorld(seed)` (deep equality of the world);
   - in `worldMap.test.ts`: `newWorld(seed, undefined, PARTNERS, { position, threat })` puts the Source there with that threat; the default equals `newWorld(seed)`;
   - the record fields from hand-built event lists through `tally` (or whatever function counts world events): days 0 raids told; a restore then a raid within 30 days is one flicker, after 31 days none, on another route none; six `days >= 1` raids of one route without abandonment counts one long-raided route, with `route_abandoned` none; walked days counted in every phase;
   - the threat table: a threat-20 battle start gets its own row (`ThreatTally`).
9. **Docs.**
   - `.claude/skills/yomi-balance/bands.md`: the "Measure names" table takes C2's flags for `one`, `company`, `rl10`, `rl12` and adds `rl10-one`, `long`, `long-one`, `long-tp4`; "Cell codes" adds the report-only cells of C2 (no band). Change **no band value** and no "Now" figure. Say in one line under the table that the early measures run with the near Source (decision 2).
   - `.claude/skills/yomi-balance/running.md`: the default ready level (18), `--log none`, `--near-source`, the guard's and the early figure's flags; the "about 5 minutes" line stays until step 08 measures.
   - `.claude/agents/yomi-measure.md` and its copy `.codex/agents/yomi-measure.toml` (change both, the same way): every campaign measure runs detached and is waited on as the long ones are now (the board grows in step 04); a `--log none` measure has no `.jsonl`, only its `.txt`; the measure names include the new ones.
   - The root `CLAUDE.md` Commands table: the balance measure command gains `--ready-level 7 --near-source`, and a note that the default campaign is the long one (ready level 18); keep the file under its cap.
   - `docs/reference/simulator.md`: `--ready-level`'s default 18, `--near-source` (what it places, why: decision 2), `--log`, `MAX_CAMPAIGN_DAYS`, the new record fields and summary lines.
   - `scripts/CLAUDE.md`: only if a line becomes wrong.
10. **Exclusions:** no change to the map, the rings, the Source's real place or threat, or any rule of play; no measurement beyond the 50-campaign check (steps 08 and 09); no band value.

## 5. Verification

- `npm test` passes, the refactor guard with its pinned args included; `GUARD_EVENTS_SHA256` unchanged.
- `npx vitest run scripts/simulate.test.ts src/game/worldMap.test.ts` passes with the tests of §4.8.
- The 50-campaign check before (step 01's command) and after (the new command) give the same SHA-256, recorded in `log.md` under "Step 02" and in the execution record; if not, every differing campaign shown to be a former timeout.
- The after run's printed summary shows the new trade and walking lines (quote them in the record).
- `grep -rn "SOURCE_READY_LEVEL\|MAX_CAMPAIGN_DAYS\|ready-level" CLAUDE.md scripts/CLAUDE.md .claude docs/reference .codex` shows no stale default.

## 6. Completion criteria

- [ ] `SourcePlace`, `SOURCE_PLACE` (today's place) and `newWorld`'s fourth parameter, as C2; default worlds unchanged.
- [ ] `NEAR_SOURCE`, `--near-source` (campaign only; the twin shares the world), `--log jsonl|none`, `SOURCE_READY_LEVEL` 18, `MAX_CAMPAIGN_DAYS` 6000.
- [ ] `vanguardWalkDays`, `routeRaidsTold`, `routeFlickers`, `routesRaidedLong` in the record, averaged and printed.
- [ ] The refactor guard's args pinned; the fixture changed only by the four fields' values; the event hash unchanged.
- [ ] The 50-campaign check identical (or every difference a former timeout), recorded in `log.md` and the execution record.
- [ ] Tests of §4.8 pass; `npm test` passes.
- [ ] `bands.md` (flags and report-only names; no band value changed), `running.md`, `yomi-measure` in `.claude/agents/` and `.codex/agents/`, the root `CLAUDE.md`, `docs/reference/simulator.md` current.
- [ ] One commit, "Stage 9 step 02: the simulator's long-campaign settings", no attribution lines, files staged by path; the index's row 02 updated with status and commit.

## 7. Execution record

Engineer: model unset (opus), 2026-11-22, at `c07152a`.

**Built.** `SourcePlace`, `SOURCE_PLACE` (`offsetToHex(58, 19)`, threat 5, a literal) and `newWorld`'s fourth parameter (the Source location keeps its id, name, encounter, loot, key order and last place; its `position` and `threat` come from `source`). `simulate.ts`: `SOURCE_READY_LEVEL` 18, `MAX_CAMPAIGN_DAYS` 6000, `NEAR_SOURCE`, `--log jsonl|none`, `--near-source` (campaign only), `campaignGame` (now exported) rebuilding the world with `NEAR_SOURCE` (so the waiting twin shares it), the four record fields with `CampaignRun.routes` (`RouteTally` by route id), `summarizeCampaigns` averages, the trade line extended and a new `walkingLine`. The guard pinned and its records given the new fields. Docs: `bands.md`, `running.md`, `guards.md`, `yomi-measure` (`.claude` and `.codex`), root `CLAUDE.md`, `docs/reference/simulator.md`; `scripts/CLAUDE.md` had no wrong line.

**Verification.**
- 50-campaign check before: `b50f7b50…904e52` (matches step 01). After, with `--ready-level 7 --near-source`: `b50f7b50626d6e2832deb18c44a808b9be0521002698dc97c1fa8216db904e52`, identical; 0 campaigns out of days. Recorded in `log.md`.
- Printed lines after: `Trade: 0.50 partners contacted; routes 0.00 opened, 0.00 raided, 0.00 abandoned a campaign; 0.00 raids told, 0.00 flickers (raided again within 30 days of safe), 0.00 routes raided 6+ yield days and kept`; `Walking: the vanguard walked 249.5 days a campaign, 55.6 of them walking home`.
- `npx vitest run scripts/simulate.test.ts src/game/worldMap.test.ts`: 230 passed. `npm test`: tsc clean, 102 files, 2588 tests passed.
- The guard: only the four new fields added (`vanguardWalkDays` 412, 341, 300, 303, 26; route fields 0); `GUARD_EVENTS_SHA256` unchanged.
- `grep -rn "SOURCE_READY_LEVEL\|MAX_CAMPAIGN_DAYS\|ready-level" CLAUDE.md scripts/CLAUDE.md .claude docs/reference .codex`: no stale default.

**Choices and departures.**
- `tally` takes the events' world turn (default the world's turn now); `takeDays` passes each report's turn (the last report on the world's turn, each earlier one a day before). World events carry no turn, so this is how the 30-day window is measured.
- A flicker is counted at most once per `route_restored` (a second raid before another restoring is not another flicker). `routesRaidedLong` is kept current in `tally` rather than computed in `finishCampaign`, so the hand-built tests reach it through `tally`.
- `--out` is accepted and ignored with `--log none` (said in `simulator.md`); the header reads `-> no log`.
- The `--log none` test spawns `node scripts/simulate.ts` with 3 single battles (`main` is not reachable without a process).
- A line `Source near (--near-source): at threat 5, where it stood before stage 9` is printed with `--near-source`, as `--trading-post` prints its own: not asked for in §4.6.
- `guards.md` (not named in §4.9) also took the pinned guard args and the 50-check command: it stated the old ones.
- The other existing simulator tests that parse `--campaign` alone now run at ready level 18; all pass unchanged.

**For later steps.** Step 04 changes `SOURCE_PLACE` and `NEAR_SOURCE.position`; the near-Source world is `newWorld(seed, undefined, PARTNERS, NEAR_SOURCE)` in `campaignGame`. Step 09 reads `routeRaidsTold`, `routeFlickers`, `routesRaidedLong` and `vanguardWalkDays` from the `Trade:` and `Walking:` lines.

**Review round 1** (reviewer opus: changes needed, 1 blocking, 2 smaller; all fixed, none disputed).
1. Blocking: a reopened route (same id `route_${partner}`) carried its old tally, `abandoned` stuck, so it was never long-raided. Fixed: `route_opened` goes to `tallyRoute` and starts the route afresh; "since it was last opened" in the doc comments and `simulator.md`. Test "starts a route's count afresh when it is opened again after being abandoned" seen failing before the fix, passing after. Guard values stay 0.
2. `simulator.md`'s Campaigns paragraph still gave the `--ready-level` default as 7: now 18.
3. Note for step 04 (its §4.6): the near-Source tests cannot tell `NEAR_SOURCE` from `SOURCE_PLACE` yet; step 04 changes the equality test and checks the tests fail without `campaignGame`'s rebuild.
Index row 02 given its commit 3ac2548.
Rerun after the fix: `npm test` 102 files, 2589 tests passed; 50-check `b50f7b50…904e52`, identical.
