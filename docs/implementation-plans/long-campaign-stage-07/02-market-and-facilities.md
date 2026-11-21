# Step 02: Market income and the facilities

[Plan index](index.md) · [Stage design](../../designs/long-campaign/stage-07-site-improvements-and-markets.md) (§2 "The Builders' Lodge", "Market income"; §4 "Market Hall 5/6: 3 gold every 5 days") · [Reference](../../designs/long-campaign/reference/economy-and-trade-routes.md) §4.2 (the Lodge's and the trading post's tables), §5.2 (territory.ts, encampment.ts) · [Stages index](../../designs/long-campaign/index.md)

**Difficulty:** sonnet / opus. The engineer's work is table entries and a yield line in existing patterns, with contracts fixed, so `model: "sonnet"` will do. The reviewer should be opus (model unset), because the 50-campaign check's proof (that any move is market income alone) needs judgment.

## 1. Objective

Make the trading post's upper levels pay, and put the Builders' Lodge among the encampment's facilities:

- trading post levels 5 and 6 (costs as in reference §4.2), named Market (4), Market Hall (5) and Trading House (6);
- levels 4 to 6 bring 2, 3 and 5 gold every yield day, halved (rounded down) while the encampment's hex is tainted, as a `yield` event with `source: 'market'`;
- the Lodge as a sixth facility in `FACILITIES`, built and raised through the encampment like the others, refusing past level 2 with "Roads come with trade routes.";
- the simulator held at trading post level 4 for now (`SIM_TRADING_POST_CAP`), so the refactor guard does not move.

No scene layout work (step 05 adds the Lodge's plot) and no art (step 03).

## 2. Requirements and context

- **S7-R2** (economy R2, A2): the Builders' Lodge, levels 1 and 2 active; level 3 (roads) in the cost table but refused until stage 8.
- **S7-R3** (economy R4, A3): market income at trading post levels 4 to 6, halved on tainted ground; the trading post's names follow its level.
- **Acceptance (reference §2):** A2 "Lodge levels gate works, forts and roads. Each refusal is tested." (works and forts gates were tested in step 01; this step tests the facility's level-3 refusal); A3 "Market income appears in the yield events at trading post levels 4 to 6, and is halved on tainted ground."
- **Design §4:** "At the encampment, the trading post reads 'Market Hall 5/6: 3 gold every 5 days'." The label under the building (`facilityLabel`, existing) is `"<name> <level>/<max>"`, so it reads "Market Hall 5/6" once the name follows the level; the income is in the effect line.

### Decisions from the index (unchanged)

- **4. Yield source.** `yield` gains `source?: YieldSource` (`'site' | 'market'`; stage 8 adds `'route'`). A site's yield leaves it out (absent means a site), so existing events keep their shape; the market's yield carries `source: 'market'`, `site: ENCAMPMENT_ID` and the encampment's name.
- **5. Market income on tainted ground** is halved as a site's yield is, rounded down: 2 → 1, 3 → 1, 5 → 2.
- **7. The Builders' Lodge** has `maxLevel` 3 and all three costs, but `raiseLodge` refuses at level 2 with "Roads come with trade routes." (`LODGE_LEVEL_LIMIT` 2, lifted in stage 8). The debug console may still set level 3, which does nothing yet. It is the sixth facility, on a sixth plot of the encampment screen.
- **10. Determinism through step 02.** Steps 01 and 02 must not move the refactor guard: in step 01 the Lodge is 0 in every simulated campaign, so only outposts are built, at today's cost, strength and yield; in step 02 the simulator is held at trading post level 4 (`SIM_TRADING_POST_CAP`, temporary) so the new levels' costs do not enter `materialNeeds`. Market income at level 4 is a rule change and may move the 50-campaign check (never the 5-campaign fixture, whose campaigns reach level 2): step 02 proves any move is market income alone. Step 06 lifts the cap and re-records the fixture, once.

### Contract consumed (C1, from step 01, copied unchanged from the index)

```ts
// src/game/worldMap.ts: WorldState
improvements: Record<string, ImprovementLevel>  // replaces outposts: a held resource's id → its level; deleted when the site is lost
lodge: number                                    // the Builders' Lodge, 0 (none) to MAX_LODGE_LEVEL; newWorld: 0

// src/game/buildings.ts
export const LODGE_COSTS: readonly Stock[] = [{ gold: 30, timber: 20 }, { gold: 60, stone: 25 }, { gold: 100, iron: 20, stone: 20 }]
export const MAX_LODGE_LEVEL = 3
export const LODGE_LEVEL_LIMIT = 2   // the highest level raiseLodge builds until stage 8's roads
export const ROADS_REFUSAL = 'Roads come with trade routes.'
export function lodgeCost(world: WorldState): Stock | null                                // the next level's, null at MAX_LODGE_LEVEL
export function raiseLodge(game: GameState, party: Expedition): string | null             // at the encampment; ROADS_REFUSAL at LODGE_LEVEL_LIMIT; else the stock
```

(C1 also defines the improvement levels, `site_improved` and the save at version 27; this step uses only the Lodge's part and `world.lodge`. Step 01's `site_lost`/`site_improved` event shapes are untouched here.)

### Contract produced (C2, copied unchanged from the index)

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

### Shared constraints (from the index)

- **Commands** (local Node 26: prefix `PATH=/opt/homebrew/opt/node@26/bin:$PATH`; or the podman `make` targets):
  - `npm test` (`tsc && vitest run`) is the gate before every commit;
  - `npx vitest run <file>` for one file; `npx vitest run --project domain`;
  - `npm run test:browser` (or `-- -t <name>`) after any scene change; read `e2e/CLAUDE.md` before adding an in-browser test;
  - `npm run simulate -- <flags>`: each run its own `--out` under `logs/` (gitignored). Never run two campaign simulations at once.
- **The refactor guard** (`scripts/simulate.test.ts`, `describe('the refactor guard')`, 5 campaigns from seed 1 with `--parties 1`): this step **must not edit the fixture** and must keep it green. A mismatch means the step changed play: find the cause and fix it.
- **The 50-campaign check** (procedure in §5): this step's result may differ from step 01's only through market income at trading post level 4.
- **Determinism.** No step adds, drops or reorders a draw of the world RNG or a battle's RNG. Market income is added after the sites' yields, so the order of a day's existing events is unchanged.
- **Commits.** One commit once `npm test` passes and the guard holds, on `long-campaign-stage-07`, without pushing. Never switch branches. Message "Stage 7 step 02: market income and the facilities". No attribution lines.
- **Docs.** CLAUDE.md files stay current: fix the lines this change makes wrong (`src/game/CLAUDE.md`'s module lines for `tradingPost.ts`, `encampment.ts`, `territory.ts` if they describe levels or yields; `docs/reference/game.md`'s trading post and yield text) and search them for `MAX_TRADING_POST_LEVEL`, "levels 1 to 4" and similar. The manual's text for the encampment is step 05's; its building table (§9) may be updated here or in step 05 (say which).

## 3. Dependencies and prerequisites

- **Step 01** (done before this one) produces C1: `world.lodge`, `LODGE_COSTS`, `MAX_LODGE_LEVEL`, `LODGE_LEVEL_LIMIT`, `ROADS_REFUSAL`, `lodgeCost`, `raiseLodge` in `src/game/buildings.ts`, the save at version 27 with `lodge`. Check its execution record for the 50-campaign baseline (line counts and SHA-256 of `logs/guard-50.jsonl`), which this step compares against.
- **Step 03** (sprites, possibly in parallel) produces `camp_lodge/level_1..3` and `camp_trading_post/level_5`, `level_6`. Until it is merged, the encampment screen draws a missing frame for the Lodge and for the post at 5–6 (Phaser's missing-texture placeholder). That is expected and not this step's to fix.
- **Step 05** adds the Lodge's plot. Until then the Lodge, as the sixth entry of `facilities`, is drawn at `plotAt(5)`, which falls back to the last plot (`PLOTS[4]`, the infirmary's): the two overlap on screen. Expected; do not add the plot here.
- **Existing (at `81bdbeb`):**
  - `src/game/tradingPost.ts`: `TRADING_POST_COSTS` (4 levels), `MAX_TRADING_POST_LEVEL`, `TIER_TWO_LEVEL` 4, `RUNE_RANK_LEVELS`, `sells`, `raiseTradingPost`, `tradingPostCost`. Every "from level 4" rule uses `>=`, so levels 5 and 6 sell as 4 does; check `sells`, `wares`, `runeWares` and `RUNE_RANK_LEVELS` for any `===` or a table indexed by level that would need two more entries.
  - `src/game/territory.ts`: `updateTerritory`'s yield step (every `YIELD_DAYS`, over `sites(world)`, halved where `blightAt > 0`).
  - `src/game/blight.ts`: `WorldEvent`'s `yield` member.
  - `src/game/encampment.ts`: `FacilityId`, `Facility`, `FACILITIES`, `facilities`, `improveFacility`, `setFacilityLevel`, the private `improveRefusal(game, party, cost)` (not to be confused with step 01's `improveRefusal` in buildings.ts; rename the private one, e.g. `facilityRefusal`, if the names clash in reading).
  - `src/scenes/encampmentView.ts`: `FACILITY_SPRITES: Record<FacilityId, string>`. Adding `builders_lodge` to `FacilityId` makes `tsc` require an entry: add `builders_lodge: 'camp_lodge'` here (the sprite name C3 fixes). Step 05 owns the rest of the screen's change (C5 restates this entry; it will find it already there).
  - `src/scenes/debugCommands.ts`'s `facility` command: lists `facilities` and calls `setFacilityLevel`; its lowest level is 1 for the guild hall and trading post, else 0, so `facility builders_lodge 2` works once the Lodge is in `FACILITIES`.
  - `scripts/simulate.ts`: `materialNeeds` (`TRADING_POST_COSTS.slice(world.tradingPost)`), `visitFacilities` (`while (raiseTradingPost(game, party) === null);`).

## 4. Scope and guidance

1. **Trading post levels** (`tradingPost.ts`): extend `TRADING_POST_COSTS` per C2; add `tradingPostName`. Update the module's doc comment ("levels 1 to 6; 4 to 6 are the Market, Market Hall and Trading House, and bring gold (territory.ts)").
2. **Market income** (`territory.ts`): `MARKET_INCOME`, `marketIncome(world)` (`MARKET_INCOME[world.tradingPost - 1] ?? 0`), `YieldSource`. In `updateTerritory`'s yield step, after the loop over sites, add the market's yield per C2: halved, rounded down, while `blightAt(world, <encampment's position>) > 0`; nothing when the amount is 0. The name is the encampment's (`encampmentName(world)` or the encampment location's `name`; use what the site events already use for it). Add `source?: YieldSource` to the `yield` member of `WorldEvent` in `blight.ts` with a comment ("absent: a site's").
   - Taint cannot fire while the encampment is lost (the game ends), so no special case.
   - Existing consumers of `yield` (`worldEvents.ts` "<name> yields 3 gold.", the simulator's tally, sounds) keep working; step 04 gives the market its own line.
3. **The encampment** (`encampment.ts`):
   - `FacilityId` gains `'builders_lodge'`; `FACILITIES` gains the Lodge, last. Suggested text (adjust wording freely, keep the facts):
     - name "Builders' Lodge"; `maxLevel: MAX_LODGE_LEVEL`; `level: game.world.lodge`; `cost: lodgeCost(game.world)`; `improve: raiseLodge`; `opens: false`;
     - about: "Builders who raise works and forts on the land the company holds.";
     - effect by level: 1 "Works can be built on held sites (a Mine, Lumber Camp, Quarry, Saltworks or Peat Cuttings), for 3 more yield."; 2 "Forts too: stronger against the blight, and lost only when corrupted."; 3 "Roads: open trade routes push back the blight.";
     - `refusal`: `ROADS_REFUSAL` when `world.lodge >= LODGE_LEVEL_LIMIT`, else null.
   - `Facility` gains `refusal?: (game: GameState) => string | null`; `facilities()` reports it (after "no party at home", before the stock) as the view's `refusal`, so the screen's button is disabled with that reason. `raiseLodge` refuses the same way, so `improveFacility` agrees.
   - The trading post's `name` becomes `tradingPostName(level)` per view (the `Facility.name` field becomes a function, or `facilities()` maps it for the trading post; the engineer's choice). Its `effect` at levels 4–6 adds the income per C2, e.g. "Sells plain, Fine and Masterwork gear, in iron and steel, and runes of the first two ranks; brings 3 gold every 5 days, half while Thornwick's land is tainted." (use `YIELD_DAYS`, `MARKET_INCOME`, `encampmentName`). `next` at level 4 reads level 5's effect, so the Raise button shows the new income.
   - `setFacilityLevel`'s map gains `builders_lodge: 'lodge'`.
   - `encampmentView.ts`: `FACILITY_SPRITES.builders_lodge = 'camp_lodge'` (needed by `tsc`, see §3).
4. **The simulator, held at level 4** (`scripts/simulate.ts`): `export const SIM_TRADING_POST_CAP = 4` with a comment "temporary: removed in stage 7 step 06". `visitFacilities` raises the post only while `world.tradingPost < SIM_TRADING_POST_CAP`; `materialNeeds` adds `TRADING_POST_COSTS.slice(world.tradingPost, SIM_TRADING_POST_CAP)`. The simulator does not raise the Lodge (step 06).
5. **Exclusions:** no scene layout (plot), no `yieldSummary` or market event line (step 04), no art, no debug command changes (step 05), no simulator record fields (step 06).

## 5. Verification

- **Tests** (domain project):
  - `territory.test.ts`: a yield day at trading post levels 1–3 has no market yield; at 4, 5, 6 a `yield` of 2, 3, 5 gold with `source: 'market'`, `site: ENCAMPMENT_ID`, added to `stock.gold`, after the sites' yields in the event list; with the encampment's hex tainted (set `world.blight` at its index to 1), 1, 1, 2; a site's yield has no `source`; no market yield on a non-yield day (A3).
  - `tradingPost.test.ts`: `MAX_TRADING_POST_LEVEL` 6; raising from 4 to 5 to 6 costs C2's stock; refused at 6 ("as great as it gets"); `sells` and `wares` at 5 and 6 equal level 4's; `tradingPostName` for 1 to 6.
  - `encampment.test.ts`: the Lodge is the sixth facility, "Build" at 0 with `LODGE_COSTS[0]`, raised to 1 and 2 through `improveFacility` with the stock; at 2 its view's `refusal` and `improveFacility` both say "Roads come with trade routes." even with a full stock; without the stock, the stock refusal; `setFacilityLevel(game, 'builders_lodge', 2)` sets `world.lodge` (A2). The trading post's view is named "Market", "Market Hall", "Trading House" at 4–6, "Trading Post" at 1–3, and its effect at 5 contains "3 gold every 5 days".
  - `encampmentView.test.ts`: `facilityFrame({ id: 'builders_lodge', level: 1 })` is `camp_lodge/level_1`.
  - `save.test.ts`: still green (the trading post's level is a number; a saved level 5 round-trips).
  - `scripts/simulate.test.ts`: `materialNeeds` at trading post level 1 still counts levels 2–4 only; the refactor guard green, fixture unedited.
- `npm test` passes. `npm run test:browser -- -t encampment` (the encampment screen gains a sixth facility; fix any test that counts five, recording it), then the full browser run if time allows.
- **The 50-campaign check:**

  ```sh
  npm run simulate -- --campaign --battles 50 --seed 1 --parties 1 --out logs/guard-50.jsonl > logs/guard-50.txt
  shasum -a 256 logs/guard-50.jsonl
  ```

  - If the hash and summary match step 01's record, record "identical".
  - If not: set `MARKET_INCOME[3]` to 0 (level 4's income) for the check alone, rerun to a different `--out` (e.g. `logs/guard-50-nomarket.jsonl`), and confirm it is identical to step 01's; restore the value. Record both hashes, how many of the 50 campaigns reached level 4 (`tradingPostLevel` in the records, or the summary), and the summary lines that moved (wins, days, gold). Any other difference is a bug in this step: find and fix it.
  - These are the values steps 03–05 inherit and step 06's re-record replaces.

## 6. Completion criteria

- [ ] Trading post levels 5 and 6 with C2's costs; `tradingPostName`; levels 5–6 sell as 4.
- [ ] Market income on yield days at 4–6, halved on taint, `source: 'market'`, after the sites' yields.
- [ ] The Lodge in `FACILITIES` with its refusal at level 2; `setFacilityLevel` and the debug `facility builders_lodge 2` work; `FACILITY_SPRITES.builders_lodge` set.
- [ ] `SIM_TRADING_POST_CAP` holds the simulator at 4.
- [ ] Tests above; `npm test` passes; the refactor guard fixture unedited and green; the 50-campaign check recorded (identical, or moved by market income alone, proven).
- [ ] CLAUDE.md and `docs/reference/game.md` lines this change makes wrong are fixed.
- [ ] One commit, "Stage 7 step 02: market income and the facilities", no attribution lines; the index's row 02 updated with status and commit.

## 7. Execution record

Step 02, on `long-campaign-stage-07` from `64d0cd2`, local Node 26.

**Built** (C2 as written): `TRADING_POST_COSTS` to level 6 and `tradingPostName`; `MARKET_INCOME`, `marketIncome`, `YieldSource` and the market's `yield` (`source: 'market'`, after the sites' yields, halved on taint) in `territory.ts`; `FacilityId` `builders_lodge`, `Facility.refusal` (checked after "no party at home", before the stock), `Facility.name` as a string or a function of level, the trading post's income in its effect line, `setFacilityLevel`'s `lodge`; `FACILITY_SPRITES.builders_lodge`; `SIM_TRADING_POST_CAP` 4 in `visitFacilities` and `materialNeeds`. The private `improveRefusal` in `encampment.ts` became `facilityRefusal`. Docs: `docs/reference/game.md` (trading post levels and income, a Lodge section) and `src/game/CLAUDE.md`'s module lines.

Also carried from step 01's review, in `save.test.ts`: a save labelled 26 in the current shape keeps a hero's `perkPoints` (derived + 3), so `migrateFrom25` running on it would fail; and a version-25 fixture given a real outpost (`iron_vein`) migrates to `improvements {iron_vein: 1}`, Lodge 0.

**Verification:**
- `npm test`: 96 files, 2367 tests passed. One run timed out in `forecast.test.ts` ("a level-1 party wins no fight with the Source at threat 5", 5000 ms) under full-suite load; it passes alone (23 of 23) and the next full run was green.
- 50-campaign check, `--campaign --battles 50 --seed 1 --parties 1 --out logs/guard-50-s2.jsonl`: `shasum` `5f92e363577e3216cd2fb233421d6ab2b514031b8c51b6c58f52db944cc8e2cb`, **identical** to step 01's; the printed summary differs from step 01's only in the output path. The simulator is held at level 4 and its campaigns average trading post level 1.1, so market income did not change play; no `MARKET_INCOME[3] = 0` rerun was needed.
- The refactor guard fixture is unedited and green. `npm run build` built. `npm run test:browser -- -t encampment`: 15 passed after the encampment test learned the sixth facility.

**Deviations:**
- `encampmentView.test.ts`: the atlas test lists every facility level's frame, and the Lodge's three and the post's 5 and 6 have no art until step 03, so those five names are in a `pending` set it skips (step 03 empties it). The "every facility a plot of its own" test checks the first five facilities only until step 05 adds the Lodge's plot (step 05 drops the `slice`).
- `debugCommands.test.ts` (`from 1 to 4` became `from 1 to 6`) and `e2e/encampment.test.ts` (the sixth facility, the Lodge's plot frame `camp_plot/base`) changed expectations the new facility and levels deliberately change. In the encampment screen the Lodge draws at the last plot, over the infirmary, until step 05.
- The manual's building table (§9) is left to step 05.
