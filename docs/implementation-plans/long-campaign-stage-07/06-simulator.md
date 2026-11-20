# Step 06: The simulator's improvements and record

[Plan index](index.md) · [Stage design](../../designs/long-campaign/stage-07-site-improvements-and-markets.md) (§2 "The simulator", §6 Simulator) · [Reference](../../designs/long-campaign/reference/economy-and-trade-routes.md) §5.4 (the simulator), A9 (the waiting check), R11, R12 · [Stages index](../../designs/long-campaign/index.md) ("The early-game guard")

**Difficulty:** opus / opus. The engineer changes the careful party's economy (what it builds, keeps and buys), re-records the refactor guard and designs the waiting twin, all judgment about determinism and balance: leave the model unset. The reviewer should be opus too, checking that the fixture moved for the stated reasons only.

## 1. Objective

The simulated company uses what steps 01 and 02 added: it raises held sites to works and forts (`improveErrand`), raises the Builders' Lodge and the trading post's market levels, and its record shows improvements by level, the Lodge, gold by source and a **waiting check**: the same seed's world with the company idle at home, against the campaign. The step-01 wrappers go, and the refactor guard's fixture is re-recorded once.

## 2. Requirements and context

- **S7-R4** (design §2): `outpostErrand` becomes `improveErrand`, with forts first on sites under 30 days to fall; `visitFacilities` raises the Lodge and the trading post's market levels; the record gains gold by source (sites, market and sales) and improvement levels at the end; the waiting check is a summary line.
- **Economy R11 (part):** the simulator builds improvements and raises the Lodge, and records income by source. Routes, partners and raiders are stage 8.
- **Economy R12 (part) / A9:** a party that only waits earns less a day than one that fights. Reference §5.4: "a test-only helper that runs a fixed seed's world forward N days with the party at home, then compares its gold with the same N days of the campaign. It lives in `simulate.test.ts` at a small N, and as a summary line in long runs."
- **Design §6 Simulator:** the guard is expected to rise a little (forts and works make the land stickier and give more stock); that is measured in step 07, not here.

### Decisions (from the index, unchanged)

8. **The waiting check** (decision for the user's eye). The stage design asks for "gold per day at home against the campaign's average"; the reference (A9, §5.4) defines it as a twin: the same seed's world run forward with the company idle at home, against the campaign. The plan takes the reference's twin, because income on the days a campaigning party happens to stand at home is the same land's income and would not show what waiting costs. **Income** is the stock's yields as value: gold, plus every other material at the trading post's rate (`MATERIALS_PER_GOLD`, 2 for a gold piece), from `yield` events, sales excluded on both sides. Each campaign records `incomePerDay` and `waitingIncomePerDay` (the twin over the campaign's own days); the summary prints both averages and whether waiting earns less. If the twin adds more than 10% to a 500-campaign run's time, it moves behind a `--waiting` flag (step 06 measures and says which).
9. **The simulator's Lodge** is raised in `visitFacilities` after the infirmary (the trading post, the workshop, the infirmary, then the Lodge), to its limit (2), so it competes last for gold with the buildings the careful party already buys. `materialNeeds` keeps the Lodge's costs up to `LODGE_LEVEL_LIMIT` and the cost of each improvement level the Lodge allows in place of `OUTPOST_COST`.
10. **Determinism through step 02.** Steps 01 and 02 must not move the refactor guard: in step 01 the Lodge is 0 in every simulated campaign, so only outposts are built, at today's cost, strength and yield; in step 02 the simulator is held at trading post level 4 (`SIM_TRADING_POST_CAP`, temporary) so the new levels' costs do not enter `materialNeeds`. Market income at level 4 is a rule change and may move the 50-campaign check (never the 5-campaign fixture, whose campaigns reach level 2): step 02 proves any move is market income alone. Step 06 lifts the cap and re-records the fixture, once.
11. **Wrappers.** Step 01 keeps `outpostSite`, `outpostSiteRefusal`, `canBuildOutpost`, `buildOutpost` and `OUTPOST_COST` as wrappers with today's behaviour (a site with any improvement is refused "already has an outpost"), so the world map (step 04) and the simulator (step 06) can move to the new names in parallel. Step 06, the last caller to move, deletes the wrappers and their tests' uses.

### Shared constraints (from the index)

- **Commands** (local Node 26: prefix `PATH=/opt/homebrew/opt/node@26/bin:$PATH`; or the podman `make` targets):
  - `npm test` (`tsc && vitest run`) is the gate before every commit;
  - `npx vitest run <file>` for one file; `npx vitest run --project domain`;
  - `npm run simulate -- <flags>`: each run its own `--out` under `logs/` (gitignored). Never run two campaign simulations at once. A 500-campaign run takes about five minutes alone and writes some 70 MB.
- **The refactor guard.** `scripts/simulate.test.ts`, `describe('the refactor guard')`: 5 campaigns from seed 1 with `--parties 1`, each `CampaignRecord` and a SHA-256 of every battle event, against a fixture. **Step 06 re-records the fixture once** (new record fields, and play moved by the Lodge, works, forts and the market levels), recording the old and new figures in the doc comment above `GUARD_RECORDS`.
- **Determinism.** No step adds, drops or reorders a draw of the world RNG or a battle's RNG. Market income is added after the sites' yields, so the order of a day's existing events is unchanged. The waiting twin runs its own world: it must not touch the campaign's game, RNG or battle ids.
- **Commits.** One commit per step once `npm test` passes, on `long-campaign-stage-07`, without pushing. A step run in a worktree commits on its own branch, merged into the stage branch by the orchestrator. Message "Stage 7 step 06: the simulator's improvements and record". No attribution lines.
- **Docs.** CLAUDE.md files stay current: fix the lines this change makes wrong and search them (and `docs/reference/`) for every name renamed or removed (`outpostErrand`, `outpostsBuilt`, `buildOutpost`, `canBuildOutpost`, `outpostSite`, `outpostSiteRefusal`, `OUTPOST_COST`, `SIM_TRADING_POST_CAP`, the `'outpost'` phase).

## 3. Dependencies and prerequisites

- **Step 02** (and through it 01) must be done. **May run in its own worktree in parallel with steps 04 and 05.**
- **Wrapper coordination with step 04.** Step 04 moves `WorldScene` off `outpostSite` and `outpostSiteRefusal`. Merge 04 before 06 deletes them; if 06 runs first, delete only the wrappers no scene uses (`canBuildOutpost`, `buildOutpost`, `OUTPOST_COST` if unused outside the simulator) and leave the rest for step 07; record which in the execution record. Check with `grep -rn "outpostSite\|outpostSiteRefusal\|canBuildOutpost\|buildOutpost\|OUTPOST_COST" src scripts e2e`.

### Contracts consumed (copied unchanged from the index)

**C1. Improvements and the Lodge's rules (step 01)**

```ts
// src/game/worldMap.ts: WorldState
improvements: Record<string, ImprovementLevel>  // replaces outposts: a held resource's id → its level; deleted when the site is lost
lodge: number                                    // the Builders' Lodge, 0 (none) to MAX_LODGE_LEVEL; newWorld: 0

// src/game/territory.ts
export type ImprovementLevel = 1 | 2 | 3
export const IMPROVEMENT_YIELD: readonly number[] = [0, 1, 3, 3]   // by level 0..3, on top of the site's own; replaces OUTPOST_YIELD
export const WORKS_NAMES: Record<Material, string>
//   iron, gold, silver, copper, crystal: 'Mine'; timber: 'Lumber Camp'; stone: 'Quarry'; salt: 'Saltworks'; peat: 'Peat Cuttings'
export function siteImprovement(world: WorldState, id: string): 0 | ImprovementLevel
export function improvementName(site: QuietLocation, level: ImprovementLevel): string   // 1 'Outpost', 2 WORKS_NAMES[its material], 3 'Fort'
export function withArticle(name: string): string   // 'an Outpost', 'a Mine', 'a Lumber Camp', 'a Quarry', 'a Fort'; 'Saltworks', 'Peat Cuttings' bare
export function lossLevel(world: WorldState, id: string): number   // MAX_BLIGHT for a fort (level 3), else LOSS_LEVEL (towers and the encampment too)
export function daysToFall(world: WorldState, presences: readonly PartyPresence[], site: { id: string; position: Hex }): number | null
//   as today, with lossLevel(world, site.id) in place of LOSS_LEVEL

// src/game/blight.ts
export const IMPROVEMENT_STRENGTH: readonly number[] = [0, 3, 3, 7]   // by level 0..3, on top of SITE_STRENGTH; replaces OUTPOST_STRENGTH
// WorldEvent:
//   | { type: 'site_improved'; site: string; name: string; level: ImprovementLevel; building: string }   // replaces outpost_built
//   | { type: 'site_lost'; site: string; name: string; improvement?: ImprovementLevel }                // replaces outpost?: true

// src/game/buildings.ts
export const IMPROVEMENT_COSTS: readonly Stock[] = [{ gold: 15, timber: 10 }, { gold: 30, stone: 15 }, { gold: 50, iron: 20, stone: 10 }]  // index level - 1
export const IMPROVEMENT_LODGE: readonly number[] = [0, 1, 2]   // the Lodge level each improvement level needs, index level - 1
export const LODGE_COSTS: readonly Stock[] = [{ gold: 30, timber: 20 }, { gold: 60, stone: 25 }, { gold: 100, iron: 20, stone: 20 }]
export const MAX_LODGE_LEVEL = 3
export const LODGE_LEVEL_LIMIT = 2   // the highest level raiseLodge builds until stage 8's roads
export const ROADS_REFUSAL = 'Roads come with trade routes.'
export function improvementSite(world: WorldState, party: Expedition): QuietLocation | null   // the held resource (not the encampment) the party stands on
export function nextImprovement(world: WorldState, site: QuietLocation): { level: ImprovementLevel; name: string; cost: Stock; lodge: number } | null   // null at level 3
export function improveSiteRefusal(world: WorldState, party: Expedition): string | null   // the place alone: active, no monsters, a held resource, below level 3
export function improveRefusal(world: WorldState, party: Expedition): string | null       // improveSiteRefusal, then the Lodge, then the stock
export function raiseImprovement(world: WorldState, party: Expedition): WorldEvent        // time-free; assumes improveRefusal said null; site_improved
export function improveSite(game: GameState, party: Expedition): WorldEvent[] | null     // the one-day order on the day loop (act), as buildOutpost was
export function lodgeCost(world: WorldState): Stock | null                                // the next level's, null at MAX_LODGE_LEVEL
export function raiseLodge(game: GameState, party: Expedition): string | null             // at the encampment; ROADS_REFUSAL at LODGE_LEVEL_LIMIT; else the stock
// Wrappers kept, today's behaviour exactly, until step 06: OUTPOST_COST (= IMPROVEMENT_COSTS[0]), outpostSite, outpostSiteRefusal
//   (refuses a site with any improvement: "<site> already has an outpost."), canBuildOutpost, buildOutpost.

// src/game/expedition.ts: DayAction { kind: 'improve' } replaces { kind: 'outpost' }; orderLabel 'Building'
// src/game/save.ts: SAVE_VERSION = 27; migrateFrom26 (decision 15)
```

**C2. Market income and the encampment's facilities (step 02)**

```ts
// src/game/tradingPost.ts
export const TRADING_POST_COSTS: readonly Stock[] = [{}, { gold: 40, stone: 15 }, { gold: 80, copper: 15 }, { gold: 120, silver: 20 },
  { gold: 160, silver: 30, stone: 20 }, { gold: 220, silver: 40, crystal: 10 }]   // MAX_TRADING_POST_LEVEL 6
export function tradingPostName(level: number): string   // 1–3 'Trading Post', 4 'Market', 5 'Market Hall', 6 'Trading House'
// levels 5 and 6 sell as level 4 does

// src/game/territory.ts
export const MARKET_INCOME: readonly number[] = [0, 0, 0, 2, 3, 5]   // gold each yield day, by trading post level - 1
export function marketIncome(world: WorldState): number             // at full strength, before taint
export type YieldSource = 'site' | 'market'
// WorldEvent 'yield' gains source?: YieldSource (absent: a site's). On a yield day, after the sites' yields: the market's
//   amount (halved, rounded down, while the encampment's hex is above 0), when above 0, goes to stock.gold with
//   { type: 'yield', site: ENCAMPMENT_ID, name: <the encampment's name>, material: 'gold', amount, source: 'market' }

// src/game/encampment.ts
export type FacilityId = 'guild_hall' | 'shrine' | 'trading_post' | 'workshop' | 'infirmary' | 'builders_lodge'   // the Lodge last
// Facility gains refusal?: (game: GameState) => string | null, checked before the stock; the Lodge's says ROADS_REFUSAL at LODGE_LEVEL_LIMIT
// The trading post's FacilityView.name is tradingPostName(level) (level 1 when shown unbuilt); its effect at 4–6 adds
//   "; brings N gold every 5 days, half while <encampment>'s land is tainted"
// setFacilityLevel maps builders_lodge to world.lodge

// scripts/simulate.ts (temporary, removed in step 06)
export const SIM_TRADING_POST_CAP = 4   // visitFacilities raises the post only below it; materialNeeds counts its levels only up to it
```

### Contract produced (copied unchanged from the index)

**C6. The simulator's improvements and record (step 06)**

```ts
// scripts/simulate.ts
export const FORT_FIRST_DAYS = 30
export function improveErrand(world: WorldState, party: Expedition): QuietLocation | null   // replaces outpostErrand
//   held resources within OUTPOST_ERRAND_RADIUS whose next level the Lodge allows and the stock affords (improveRefusal's
//   rules); first the nearest whose next level is a fort and whose daysToFall (the party's presence) is under FORT_FIRST_DAYS;
//   else the nearest. The plan phase 'outpost' becomes 'improve'; the act is { kind: 'improve' }.
// CampaignRecord: outpostsBuilt is replaced by
improvementsBuilt: number[]          // site_improved events by level, index level - 1 (length 3)
improvementLevels: number[]          // held resources at each level 0..3 at the end (length 4)
lodgeLevel: number
goldBySource: { sites: number; market: number; sales: number }   // gold from yield events by source; sales = goldFromSales
incomePerDay: number                 // yields as value (gold + other materials / MATERIALS_PER_GOLD) / days
waitingIncomePerDay: number          // the waiting twin's, over the same days (decision 8)
```

- `visitFacilities` raises the Lodge after the infirmary (decision 9) and the trading post to 6; `SIM_TRADING_POST_CAP` goes.
- The summary prints improvements built and held by level, the Lodge, gold by source, and the waiting check line ("Waiting check: income 3.1 a day campaigning, 1.4 waiting at home: waiting earns less").

### Existing code (at `81bdbeb`, before steps 01 and 02)

- `scripts/simulate.ts`: `materialNeeds` (~line 626; adds `OUTPOST_COST` and `TRADING_POST_COSTS.slice(world.tradingPost)`), `visitFacilities` (~line 723; `while (raiseTradingPost …)`, workshop, infirmary, gear, runes, crafts, shrine), `OUTPOST_ERRAND_RADIUS` and `outpostErrand` (~line 787), `afterBattle`'s `'outpost'` and `'build'` phases (~line 1082), `AFTER_BATTLE` (~line 1326), `tally` (~line 1329; counts `outpost_built`, which step 01 turned into `site_improved` level 1), `startCampaign` (~line 948; `game = newGame(startingParty(args), null, seed)`), `finishCampaign` (~line 1626), `runCampaign` (~line 1667), the summary (`avgOutpostsBuilt`, ~line 1932, 2042, 2155). Steps 01 and 02 will have edited some of these minimally (the `improve` act, `siteImprovement`, `SIM_TRADING_POST_CAP`); read the file as it stands.
- `scripts/simulate.test.ts`: `describe('the campaign’s policy on the day loop')` with `campaignOf` (fixed states built from `newGame(undefined, null, 1)`), and `describe('the refactor guard')` with `GUARD_RECORDS` and `GUARD_EVENTS_SHA256` under a long doc comment of its re-recordings.
- `src/game/tradingPost.ts`: `MATERIALS_PER_GOLD` (2).

## 4. Scope and guidance

1. **`improveErrand`** replaces `outpostErrand` (keep `OUTPOST_ERRAND_RADIUS`, or rename it `IMPROVE_ERRAND_RADIUS`, same value 6). Candidates: held resources other than the encampment within the radius whose `nextImprovement` exists, whose Lodge gate is met and whose cost the stock affords. Use the domain's rules (`nextImprovement`, `IMPROVEMENT_LODGE`, `canAfford`) rather than restating them; `improveRefusal` needs the party on the site, so check the site's own conditions directly. Order: the nearest candidate whose next level is 3 and whose `daysToFall(world, [presenceOf(party)], site)` is non-null and under `FORT_FIRST_DAYS`; else the nearest candidate. Ties as `outpostErrand` breaks them today (the first in `sites` order).
2. **Phases.** `'outpost'` becomes `'improve'` in `Phase`, `afterBattle` and `AFTER_BATTLE`; the `'build'` phase acts `{ kind: 'improve' }` when `improveRefusal(world, party) === null` on arrival. One level per errand (the next errand, after the next battle, may raise it again).
3. **`visitFacilities`.** Remove `SIM_TRADING_POST_CAP`: raise the post to 6 as the stock allows. After the infirmary, `while (raiseLodge(game, party) === null);` (it stops at `LODGE_LEVEL_LIMIT` by `ROADS_REFUSAL`). Keep the rest of the order as it is.
4. **`materialNeeds`.** `TRADING_POST_COSTS.slice(world.tradingPost)` in full; `LODGE_COSTS.slice(world.lodge, LODGE_LEVEL_LIMIT)`; in place of `add(OUTPOST_COST)`, add `IMPROVEMENT_COSTS[level - 1]` once for each improvement level the Lodge allows now (level 1 always, 2 from Lodge 1, 3 from Lodge 2). Update the doc comment.
5. **The record** (C6). `tally` counts `site_improved` into `improvementsBuilt[level - 1]` and `yield` events into `goldBySource` (gold material only: `source ?? 'site'`) and into the income value (gold + other materials / `MATERIALS_PER_GOLD`). `goldBySource.sales` equals `goldFromSales` (keep both). `finishCampaign` sets `lodgeLevel`, `improvementLevels` (held resources, not the encampment, counted at levels 0..3), `incomePerDay` (the value over `days`, 0 for 0 days) and `waitingIncomePerDay`. `outpostsBuilt` is removed (and from the summary).
6. **The waiting twin.** An exported helper, for example `waitingIncome(seed: number, args: CliArgs, days: number): number`, that builds the same starting game `startCampaign` would for that seed (`newGame(startingParty(args), null, seed)`, with whatever `startCampaign` does to it before the first day that the world depends on), leaves every party idle at the encampment, passes days with `passDay` until `days` have passed or the world is no longer active (the encampment lost), and returns the yields' value per day over the days requested. It buys nothing, sells nothing and fights nothing. It runs a separate game: it must not share the campaign's game, battle id counter or RNG. `finishCampaign` (or `runCampaign`) calls it with the campaign's `days`. **Measure its cost:** time `--campaign --battles 100 --seed 1 --parties 1` with and without the twin (one run at a time, alone); if it adds more than 10%, put it behind a `--waiting` flag (`waitingIncomePerDay` 0 or absent without it, the summary line printed only with it, the flag in scripts/CLAUDE.md's flags) and record the timings either way.
7. **The summary** prints, a campaign on average: improvements built by level ("Improvements: 2.1 outposts, 0.8 works, 0.3 forts built a campaign"), held at the end by level, the Lodge's level, gold by source ("Gold by source: sites 40, market 12, sales 35 a campaign"), and the waiting check line as in C6, saying "waiting earns less" or "waiting earns as much or more".
8. **Tests** (`scripts/simulate.test.ts`, on fixed states as the policy tests build them):
   - `improveErrand`: none without stock; an outpost at Lodge 0 on an unimproved site; no works at Lodge 0 on a level-1 site; works at Lodge 1; the nearest when several qualify; **fort first**: at Lodge 2, a level-2 site under `FORT_FIRST_DAYS` to fall chosen over a nearer level-1 site; a site beyond the radius ignored; the encampment never.
   - `visitFacilities` raises the Lodge to 2 and no further given ample stock, and the trading post to 6.
   - `materialNeeds` includes the Lodge's remaining costs and the allowed improvement levels' costs.
   - `tally`/the record: `improvementsBuilt`, `goldBySource` (a market yield counted as market), `improvementLevels` at the end.
   - **The waiting check (A9):** on seed 1 at a small N (for example 60 to 120 days: the smallest at which it honestly holds), the twin's income per day is below the campaign's over the same N days; within the test timeout. If no N under the timeout shows it, record that as a finding rather than weaken the assertion.
9. **Delete the wrappers** (decision 11, with the coordination in §3) and their uses in `buildings.test.ts` and elsewhere; the domain's tests of the new names stay.
10. **Re-record the refactor guard** once, after everything above is final: new `GUARD_RECORDS` and `GUARD_EVENTS_SHA256`, with a sentence in the doc comment: "Re-recorded in stage 7 step 06: the Lodge, works, forts and the trading post's levels 5 and 6 in the careful party's economy, and the record's improvement, income and waiting fields." Note in the execution record how the 5 campaigns' outcomes and days moved (old → new).
11. **Docs.** `scripts/CLAUDE.md` (the campaign's errands line, any flag), `docs/reference/simulator.md` (the improve errand, the Lodge in the facilities, `materialNeeds`, every new record field and summary line, the waiting twin), and any CLAUDE.md line naming a removed name. The balance figures in the bands table are step 07's.
12. **Exclusions:** no 500-campaign run (step 07); no retune of the game's constants (step 07); no routes, partners or raiders (stage 8); no scene changes.

## 5. Verification

- `npm test` passes, the re-recorded guard included.
- `npx vitest run scripts/simulate.test.ts` passes alone; the waiting-check test's run time is recorded.
- A 50-campaign run, its summary kept and its new lines quoted in the execution record:

  ```sh
  npm run simulate -- --campaign --battles 50 --seed 1 --parties 1 --out logs/s7-06-50.jsonl > logs/s7-06-50.txt
  ```

  (add `--waiting` if the twin went behind the flag). Record the wins, days, improvements by level, Lodge level, gold by source and the waiting line, beside step 02's 50-campaign values.
- The twin's timing on 100 campaigns, with and without it, and the decision taken.
- `grep -rn "outpostErrand\|outpostsBuilt\|SIM_TRADING_POST_CAP\|canBuildOutpost\|buildOutpost" src scripts e2e docs/reference '*CLAUDE.md'` finds nothing (or only what §3's coordination leaves for step 07, named).

## 6. Completion criteria

- [ ] `improveErrand` with fort first (C6); the `'improve'` phase and act.
- [ ] `visitFacilities` raises the trading post to 6 and the Lodge to 2 after the infirmary; `SIM_TRADING_POST_CAP` gone; `materialNeeds` per decision 9.
- [ ] The record's fields (C6) filled; the summary prints them and the waiting check line.
- [ ] The waiting twin built, timed, and behind `--waiting` only if over 10%.
- [ ] The tests of §4.8 pass; `npm test` passes.
- [ ] The wrappers deleted (or the remainder named for step 07).
- [ ] The guard fixture re-recorded once, with its doc comment.
- [ ] `scripts/CLAUDE.md` and `docs/reference/simulator.md` current.
- [ ] One commit, "Stage 7 step 06: the simulator's improvements and record", no attribution lines; the index's row 06 updated with status and commit.

## 7. Execution record
