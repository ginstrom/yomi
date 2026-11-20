# Step 05: The encampment and the debug console

[Plan index](index.md) · [Stage design](../../designs/long-campaign/stage-07-site-improvements-and-markets.md) (§2 Scenes: "The encampment gets the Lodge"; §4 "Market Hall 5/6: 3 gold every 5 days"; §6 play script) · [Reference](../../designs/long-campaign/reference/economy-and-trade-routes.md) §4.2 (the Lodge, the trading post's upper levels), §4.5 (the encampment screen) · [Stages index](../../designs/long-campaign/index.md) ("Docs", "Gameplay verification")

**Difficulty:** sonnet / opus. The engineer follows fixed contracts and existing patterns in the encampment screen and the debug console, so `model: "sonnet"` will do. The reviewer should be opus (model unset): it judges the sixth plot's placement on screen and whether the debug commands serve the play script.

## 1. Objective

Show the Builders' Lodge and the trading post's new levels on the encampment screen, and give the debug console what the stage's play script needs:
- the Lodge on its own (sixth) plot, built and raised from the screen, its level 3 refused with "Roads come with trade routes.";
- the trading post named by its level (Market, Market Hall, Trading House) on its plot, in its details and in the Trading Post scene's header;
- `stock` with several material pairs, a new `blight` command, and `days` telling the yields by source.

## 2. Requirements and context

- **S7-R2** (the Lodge, levels 1 and 2 active) and **S7-R3** (market income at trading post levels 4 to 6; names follow the level) on screen. The design's line: **"At the encampment, the trading post reads 'Market Hall 5/6: 3 gold every 5 days'."** The plot's label (`facilityLabel`) reads "Market Hall 5/6"; the facility's effect line (from step 02) carries "3 gold every 5 days".
- **The play script** (design §6) uses `facility builders_lodge 2`, `stock gold 300 stone 50 iron 50`, `days 200`, pushing a fort's hex to blight 3, `facility trading_post 6` then `days 25` ("see five market yields of 5 gold"), and tainting the encampment's hex to see them halved.

### Decisions (copied unchanged from the index)

7. **The Builders' Lodge** has `maxLevel` 3 and all three costs, but `raiseLodge` refuses at level 2 with "Roads come with trade routes." (`LODGE_LEVEL_LIMIT` 2, lifted in stage 8). The debug console may still set level 3, which does nothing yet. It is the sixth facility, on a sixth plot of the encampment screen.

14. **Debug commands for the play script.** `stock` takes several pairs (`stock gold 300 stone 50 iron 50`); a new `blight <level> [here | <location id> | <col> <row>]` sets a hex's level with its shift counter at 0 (to push a fort's hex to 3 or taint the encampment); `days` adds a line totalling the yields by source over the days passed. `facility builders_lodge 2` works through `FACILITIES`.

### Contracts consumed (copied unchanged from the index)

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

From C1 (step 01), used here: `MAX_LODGE_LEVEL = 3`, `LODGE_LEVEL_LIMIT = 2`, `ROADS_REFUSAL = 'Roads come with trade routes.'`, `LODGE_COSTS`, `lodgeCost`, `raiseLodge(game, party)`, `world.lodge`, `lossLevel`, `MAX_BLIGHT` (blight.ts).

**C3. Sprites (step 03)**

- `camp_lodge`, on the 48px `building` canvas: frames `level_1`, `level_2`, `level_3` (a builders' yard, then with a crane or scaffold and stone, then grander with a road-mason's mark for roads).
- `camp_trading_post` gains `level_5` (Market Hall) and `level_6` (Trading House), grander than `level_4`, same canvas and footprint.
- `map_fort`, on the `map` canvas: a palisade ring drawn over a resource's icon, with frame `base` and an `idle` animation (map sprites have one), transparent where the resource icon should show through.

**C4. The world map's Improve (step 04)**, the part used here:

```ts
// src/scenes/worldEvents.ts
export function yieldSummary(events: readonly WorldEvent[]): string | null
//   the yields in `events` summed by source: 'Last yield: sites 4 gold, 5 iron; market 3 gold'; null when there are none
```

### Contract produced (copied unchanged from the index)

**C5. The encampment and the debug console (step 05)**

- `FACILITY_SPRITES.builders_lodge = 'camp_lodge'` (already added by step 02); `PLOTS` gains a sixth plot for it.
- The Trading Post scene's header names the post by `tradingPostName`.
- Debug: decision 14.

### Shared constraints (from the index)

- **Commands** (local Node 26: prefix `PATH=/opt/homebrew/opt/node@26/bin:$PATH`; or the podman `make` targets):
  - `npm test` (`tsc && vitest run`) is the gate before every commit;
  - `npx vitest run <file>` for one file; `npx vitest run --project domain`;
  - `npm run test:browser` (or `-- -t <name>`) after any scene change; read `e2e/CLAUDE.md` before adding an in-browser test.
- **The refactor guard** (`scripts/simulate.test.ts`, `describe('the refactor guard')`): steps 01–05 must not edit the fixture and must keep it green. This step changes no rule, so the 50-campaign check need not be run (say so in the record).
- **Determinism.** No step adds, drops or reorders a draw of the world RNG or a battle's RNG. The debug commands run only on the world map, in dev builds.
- **Commits.** One commit for this step once `npm test` passes, on `long-campaign-stage-07`, without pushing. Never switch branches. Message "Stage 7 step 05: the encampment and the debug console". No attribution lines.
- **Docs.** CLAUDE.md files stay current: fix the lines this change makes wrong. Scene steps update the manual's text for their screens; step 07 retakes the screenshots (this step does not).
- **Sprites:** never edit an exported PNG; this step draws nothing (step 03 did).

## 3. Dependencies and prerequisites

- **Step 02** (C2): `builders_lodge` in `FACILITIES` with its `refusal`, `tradingPostName`, the trading post's names and income line, `setFacilityLevel` for the Lodge. **Step 01** (C1): the Lodge's rules and `world.lodge`.
- **Step 03** (C3), merged into the stage branch: `camp_lodge/level_1..3` and `camp_trading_post/level_5`, `level_6` in the atlas. Without them the encampment would draw a missing frame. Check with `grep -o '"camp_lodge/level_[0-9]"\|"camp_trading_post/level_[56]"' public/assets/sprites/atlas.json | sort -u`.
- **Step 04** (C4): `yieldSummary` in `worldEvents.ts`.
- **Existing (at `81bdbeb`), inspected:**
  - `src/scenes/encampmentView.ts`: `FACILITY_SPRITES: Record<FacilityId, string>` (a missing key fails `tsc` once `FacilityId` gains `builders_lodge`), `facilityFrame`, `PLOTS` (five points in the 720×500 frame: two front either side of the campfire at y 312, three at the back at y 236/236/222), `plotAt` (falls back to the last plot), `facilityLabel` (`${name} ${level}/${maxLevel}` or `${name}: empty plot`).
  - `src/scenes/EncampmentScene.ts`: draws every facility from `facilities()` on `plotAt(index)`, tents and the fire between; the details panel (name, level, about, effect, next and cost in REFUSED colour when `refusal` is set, the improve button enabled only when `refusal === null`, Enter for facilities that open); `improve` messages "The X is built." / "The X is raised to level N."; `probe()` lists facilities with `id`, `level`, `frame`.
  - `src/scenes/TradingPostScene.ts` line ~301: the header `${actingFor(...)}Level ${world.tradingPost}.  Gold in the stock: …`.
  - `src/scenes/debugCommands.ts`: `stock [material amount]` (one pair), `facility [id level]` (lowest level 1 for guild_hall and trading_post, else 0: the Lodge's lowest is 0), `days <count>` (passes days with `passDay`, telling notable events and spawns), `goto <col> <row> | goto <location>` (a pattern for parsing a hex or a location), `help`.
  - Tests: `src/scenes/encampmentView.test.ts`, `src/scenes/debugCommands.test.ts` (if present; else the debug console's existing test file — find it with `grep -rl debugCommands src`), `e2e/encampment.test.ts`.

## 4. Scope and guidance

1. **The Lodge on screen** (`encampmentView.ts`):
   - `FACILITY_SPRITES.builders_lodge = 'camp_lodge'` (step 02 added it; check it is there).
   - A sixth entry in `PLOTS` for the Lodge (the sixth in `facilities` order). Place it in the clearing where it overlaps no building, tent, the fire or its label, and its label stays inside the 720×500 frame (for example a back corner, or the front row moved outward to make room). Look at the screen at 840×560 and at 1280 wide before settling; the reviewer will.
   - Update the module's comment on the plots' layout. Add tests in `encampmentView.test.ts`: `facilityFrame({ id: 'builders_lodge', level: 2 })` is `camp_lodge/level_2`, `level: 0` is the empty plot; `plotAt(5)` is a new point distinct from the other five; `facilityLabel` for the trading post at level 5 named "Market Hall" reads "Market Hall 5/6".
2. **The encampment scene** (`EncampmentScene.ts`): nothing in the details panel should need special-casing; check that:
   - an unbuilt Lodge shows "Builders' Lodge: empty plot" and a Build button with its cost (30 gold, 20 timber); built, "Builders' Lodge 1/3" on its frame;
   - at level 2 the next line shows level 3's text and cost in the refused colour and the Raise button is disabled; the refusal "Roads come with trade routes." is visible (shown where the stock's refusal would be, or as the next line's reason; add it to the panel if the panel shows only the cost's colour today);
   - the trading post at 4–6 shows its name in the plot label and the details title, and the income in its effect line;
   - the messages after building read well with the new names ("The Builders' Lodge is built.", "The Market Hall is raised to level 6." would be wrong: the message names the facility as it was; prefer "The trading post is raised to level 6: the Trading House." or the name after the raise. Choose and test).
   - The probe's facility list carries the Lodge (it is driven by `facilities()`).
3. **The Trading Post scene's header** (`TradingPostScene.ts`): `Level ${world.tradingPost}` becomes `${tradingPostName(level)}, level ${level}` (for example "Market Hall, level 5."); keep `actingFor` and the gold. Check its title too (`Trading Post`), naming the post by `tradingPostName` where it is the screen's title.
4. **Debug console** (`debugCommands.ts`):
   - **`stock [material amount]...`**: any number of pairs, each checked before any is applied (an unknown material or a bad amount refuses the whole command, nothing changed); usage and summary updated.
   - **`blight <level> [here | <location id> | <col> <row>]`** (new, `changes: true`): sets that hex's blight level (0 to `MAX_BLIGHT`) and its shift counter to 0 (`boardIndex`; `world.blight`, `world.shift`); default `here`, the selected party's hex. Refuse a level out of range and a hex off the map. Then run what makes the world consistent without passing a day, if anything is needed for the map to redraw (sight, the threatened list); the next day's `updateTerritory` captures or loses the site by its `lossLevel` as usual. Its reply names the hex and the level ("Iron Vein (12, 20) is now blighted."). Its summary should warn that the day's influence moves it on: **the encampment's clean push undoes a taint within a few days**, so the play script taints it on the day before a yield day (`days` to a turn one short of a multiple of 5, then `blight 1 encampment`, then `days 1`).
   - **`days <count>`**: after the lines it prints today, one more: the yields of the days passed summed by source, built from every report's `yield` events with `yieldSummary` (C4), worded for a stretch of days (for example "Yields over 25 days: sites 10 gold, 25 iron; market 25 gold"); left out when there were none. Keep its other output unchanged.
   - `facility builders_lodge 2` needs no change beyond step 02 (check: its lowest level is 0, its highest 3).
   - Tests for each, in the debug console's test file: several stock pairs and a refused bad pair changing nothing; `blight` by `here`, by location id and by col/row, the range refusal, the shift reset; `days` printing the yield line (set the trading post to 4 and pass to a yield day: the market's 2 gold appear under "market").
5. **In-browser tests** (`e2e/encampment.test.ts`; read `e2e/CLAUDE.md` first): set up through the existing helpers (debug commands or the test hook as the file's other tests do):
   - the Lodge's empty plot is drawn; with the stock, Build makes it level 1 (`camp_lodge/level_1` frame in the probe);
   - at Lodge 2, its Raise is disabled and the details say "Roads come with trade routes.";
   - with the trading post at 5, its label reads "Market Hall 5/6" and its effect contains "3 gold every 5 days";
   - at 840×560 the sixth plot's building and label lie inside the frame and overlap no other plot's (bound them from the probe's positions, adding to the probe if needed).
6. **Docs:**
   - **The manual** (`docs/manual/README.md`): the encampment section names the Builders' Lodge and what its levels unlock (works at 1, forts at 2; roads later); §9's table gains a Builders' Lodge row (30 gold + 20 timber, then 60 gold + 25 stone; level 3, 100 gold + 20 iron + 20 stone, comes with trade routes) and the trading post row gains levels 4 to 6 (Market 120 gold + 20 silver, Market Hall 160 gold + 30 silver + 20 stone, Trading House 220 gold + 40 silver + 10 crystal) with their 2, 3 and 5 gold every 5 days, halved on tainted ground. Step 04 owns the Improve rows (outpost, works, fort); do not duplicate them. Screenshots are retaken in step 07.
   - **`src/scenes/CLAUDE.md`**: the debug console's lines (`stock` pairs, `blight`, `days`' yields), and any line on the encampment's plots or `FACILITY_SPRITES`.
   - **`docs/reference/scenes.md`**: the encampment screen's six plots and the Lodge's details, the Trading Post header, and the debug commands' full text.
7. **Exclusions:** no rule changes (the Lodge's and market's rules are step 01's and 02's); no simulator changes; no sprites; no world-map changes (step 04).

## 5. Verification

- `npx vitest run src/scenes/encampmentView.test.ts` and the debug console's test file pass with the new cases.
- `npm test` passes (the refactor guard untouched and green).
- `npm run test:browser -- -t <the encampment tests' names>` passes, then the full `npm run test:browser` (note any timeout that passes alone, as the browser tests are load-sensitive).
- `npm run build` passes.
- In the dev server (`npm run dev`), by hand or headless: `facility builders_lodge 2`, open the encampment: the Lodge stands on its plot at level 2, Raise disabled with the roads line; `facility trading_post 5`: "Market Hall 5/6"; `stock gold 300 stone 50 iron 50` adds all three; `blight 1 encampment` taints the encampment's hex; `days 25` with the trading post at 6 prints a market line totalling 25 gold (fewer when tainted on a yield day). Record what was seen, with a screenshot of the encampment at 840×560 in the scratchpad.
- The 50-campaign check is not run: this step changes no rule (say so).

## 6. Completion criteria

- [ ] The Lodge is drawn on a sixth plot that fits the frame at 840×560, with `camp_lodge` frames; built and raised from its details; level 3 refused with "Roads come with trade routes.".
- [ ] The trading post is named by its level on its plot, in its details and in the Trading Post scene's header; its effect shows the market income.
- [ ] `stock` takes several pairs; `blight` sets a hex's level with its shift at 0; `days` totals the yields by source; each tested.
- [ ] In-browser tests for the Lodge plot, building it, level 2's refusal and the Market Hall pass; `npm test`, `npm run test:browser` and `npm run build` pass.
- [ ] The manual, `src/scenes/CLAUDE.md` and `docs/reference/scenes.md` updated.
- [ ] One commit, "Stage 7 step 05: the encampment and the debug console", no attribution lines; the index's row 05 updated with status and commit.

## 7. Execution record
