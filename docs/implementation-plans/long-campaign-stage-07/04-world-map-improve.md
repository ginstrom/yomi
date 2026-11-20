# Step 04: The world map's Improve

[Plan index](index.md) · [Stage design](../../designs/long-campaign/stage-07-site-improvements-and-markets.md) (§2 Scenes, §4 What the player sees) · [Reference](../../designs/long-campaign/reference/economy-and-trade-routes.md) §4.1, §4.5, §5.3 · [Stages index](../../designs/long-campaign/index.md) ("Docs", "Gameplay verification")

**Difficulty:** sonnet / opus. The engineer's work follows fixed contracts and the world map's existing patterns (the Build Outpost button, hex info, the map labels, the event lines), so `model: "sonnet"` will do. The reviewer should be opus (model unset): it judges the footer's fit, the words on screen and whether the scene really moved off the wrappers.

## 1. Objective

Show the player what steps 01–02 made possible on the world map:
- the Build Outpost button becomes **Improve**, labelled with the site's next level and its cost, or with why the Lodge is too low;
- the hex info of an improved site gives its building, yield and strength; a fort says it is lost only when corrupted;
- a site's map label names its building; a fort shows a palisade (`map_fort`);
- the message line tells of improvements, of an improved site razed, and of market income; the stock panel sums the last yield day by source;
- the build sound plays on `site_improved`.

The world map stops using the outpost wrappers (`outpostSite`, `outpostSiteRefusal`), so step 06 may delete them.

## 2. Requirements and context

- **S7-R1** (improvement levels, building them) and **S7-R3** (market income) as the player sees them. Design §4: "On a held Iron Vein with an outpost and Lodge 1, the Improve button reads 'Build a Mine: 30 gold, 15 stone'. Built, the yield line reads 'Mine: 5 iron every 5 days'." "A fort on the Copper Pit shows a palisade. When the blight reaches level 2 around it, it holds, and a warning gives the days until corruption takes it."
- **Design §6:** scene tests for the Improve button.
- **LOG_SCHEMA_VERSION** is unchanged (world events are not in the battle log).

### Decisions (from the index, unchanged)

3. **Events.** `site_improved { site, name, level, building }` replaces `outpost_built` (`building` is the level's name, "Outpost", "Mine", "Fort", for the message). `site_lost`'s `outpost?: true` becomes `improvement?: ImprovementLevel` (the level razed). The message says "its outpost razed", "its works razed", "its fort razed". The design's "outpost_built kept as an alias in the log" is not needed: world events are not in the battle log, so `outpost_built` is removed outright. `LOG_SCHEMA_VERSION` is unchanged (design §5).
4. **Yield source.** `yield` gains `source?: YieldSource` (`'site' | 'market'`; stage 8 adds `'route'`). A site's yield leaves it out (absent means a site), so existing events keep their shape; the market's yield carries `source: 'market'`, `site: ENCAMPMENT_ID` and the encampment's name.
6. **The Improve button** stands where Build Outpost did, shown on a held resource below level 3 whenever the party could build there but for the Lodge and the stock. Its label is the next level and its cost, "Build a Mine: 30 gold, 15 stone", or, when the Lodge is too low, "A Mine needs the Builders' Lodge" (enabled: a click says why in the message, as a stock refusal does). The label comes from a Phaser-free helper (`improveLabel`, C4).
11. **Wrappers.** Step 01 keeps `outpostSite`, `outpostSiteRefusal`, `canBuildOutpost`, `buildOutpost` and `OUTPOST_COST` as wrappers with today's behaviour (a site with any improvement is refused "already has an outpost"), so the world map (step 04) and the simulator (step 06) can move to the new names in parallel. Step 06, the last caller to move, deletes the wrappers and their tests' uses.
13. **What the world map shows.** The hex info of an improved site reads "Mine: 5 iron every 5 days." (the design's line) and "Strength 6 against the blight." (`siteStrength`), and a fort adds "Lost only when corrupted."; an unimproved site keeps "Yields 2 iron." The map label's line under a site's name says its building ("Mine", "Fort") where it said "outpost". The stock panel gains a third line, "Last yield: sites …; market 3 gold", from the last yield day the scene saw (not saved: blank after a load until the next yield day).

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

- **Refusal words** (improveRefusal, in order): "Nothing can be built here now." (game over or among monsters); "Improvements go on a held resource."; "<site> is as strong as it gets." (level 3); "<withArticle(name), capitalised> needs the Builders' Lodge." (level 2 at Lodge 0) or "… needs the Builders' Lodge at level 2." (level 3 at Lodge below 2); "<withArticle(name), capitalised> costs <describeCost>, more than the stock holds."
- **updateTerritory:** a held site is lost at `lossLevel`; its improvement is deleted and `site_lost` carries the level razed. Towers keep `LOSS_LEVEL`. Yields read `IMPROVEMENT_YIELD`; `siteStrength` reads `IMPROVEMENT_STRENGTH` (the fields memo key follows, as it already includes each source's strength).

**C2. Market income and the encampment's facilities (step 02)** (the parts this step reads)

```ts
// src/game/tradingPost.ts
export function tradingPostName(level: number): string   // 1–3 'Trading Post', 4 'Market', 5 'Market Hall', 6 'Trading House'

// src/game/territory.ts
export const MARKET_INCOME: readonly number[] = [0, 0, 0, 2, 3, 5]   // gold each yield day, by trading post level - 1
export function marketIncome(world: WorldState): number             // at full strength, before taint
export type YieldSource = 'site' | 'market'
// WorldEvent 'yield' gains source?: YieldSource (absent: a site's). On a yield day, after the sites' yields: the market's
//   amount (halved, rounded down, while the encampment's hex is above 0), when above 0, goes to stock.gold with
//   { type: 'yield', site: ENCAMPMENT_ID, name: <the encampment's name>, material: 'gold', amount, source: 'market' }
```

**C3. Sprites (step 03)** (the part this step reads)

- `map_fort`, on the `map` canvas: a palisade ring drawn over a resource's icon, with frame `base` and an `idle` animation (map sprites have one), transparent where the resource icon should show through.

### Contract produced (copied unchanged from the index)

**C4. The world map's Improve (step 04)**

```ts
// src/scenes/improveButton.ts (new, Phaser-free, with tests)
export function improveLabel(world: WorldState, party: Expedition): string | null
//   null when improveSiteRefusal refuses (no button); 'A Mine needs the Builders' Lodge' (or '… at level 2') when the Lodge
//   is too low; else 'Build a Mine: 30 gold, 15 stone' (withArticle, describeCost)
// src/scenes/worldEvents.ts
export function yieldSummary(events: readonly WorldEvent[]): string | null
//   the yields in `events` summed by source: 'Last yield: sites 4 gold, 5 iron; market 3 gold'; null when there are none
// src/testHook.ts: WorldProbe.buttons.improve: ButtonProbe replaces buildOutpost; WorldProbe gains improveLabel: string | null
```

- The button calls `this.built({ kind: 'improve' })`; it is visible when `improveLabel` is not null (and the party may camp and is not walking, as Build Outpost was).
- `describeWorldEvent`: `site_improved` "A Mine stands at Iron Vein." ("stand" for a name ending in s: "Saltworks stand at Salt Flats."); `site_lost` with `improvement` "<site> is lost to the blight, and its outpost razed." (`works`, `fort` for levels 2 and 3); a market `yield` "The market at <name> brings 3 gold.".
- Hex info and map labels: decision 13. The map draws `map_fort` (its `idle`) over a fort's resource icon.
- `sounds.ts`: the `world.build` cue plays on `site_improved`.

Step 05 consumes `yieldSummary` (the debug `days` line) and the probe; step 07 retakes the screenshots.

### Shared constraints (from the index)

- **Commands** (local Node 26: prefix `PATH=/opt/homebrew/opt/node@26/bin:$PATH`; or the podman `make` targets):
  - `npm test` (`tsc && vitest run`) is the gate before every commit;
  - `npx vitest run <file>` for one file; `npx vitest run --project domain`;
  - `npm run test:browser` (or `-- -t <name>`) after any scene change; read `e2e/CLAUDE.md` before adding an in-browser test.
- **The refactor guard** (`scripts/simulate.test.ts`, `describe('the refactor guard')`): steps 01–05 must not edit the fixture and must keep it green. This step changes no rule, so the 50-campaign check need not be run (say so in the record).
- **Determinism.** No step adds, drops or reorders a draw of the world RNG or a battle's RNG.
- **Commits.** One commit once `npm test` passes, on `long-campaign-stage-07`, without pushing. Never switch branches. Message "Stage 7 step 04: the world map's Improve". No attribution lines.
- **Docs.** CLAUDE.md files stay current: fix the lines this change makes wrong and search them (and `docs/reference/`) for every name it renames or removes (`buildOutpost` in the probe, `outposts`, `outpost_built`, "Build Outpost"). Update the manual's text for the screen; step 07 retakes the screenshots.

## 3. Dependencies and prerequisites

- **Step 01** (C1): `world.improvements`, `world.lodge`, `siteImprovement`, `improvementName`, `withArticle`, `nextImprovement`, `improvementSite`, `improveSiteRefusal`, `improveRefusal`, the `improve` day action, `site_improved` and `site_lost.improvement`, the new `daysToFall` signature. Step 01 will already have made the scenes compile against the changed event and day-action types (minimal edits in `worldEvents.ts`, `sounds.ts`, `partyList.ts`, `hexInfo.ts`); this step gives them their final words and behaviour. Check what step 01's execution record says it left.
- **Step 02** (C2): `tradingPostName`, `marketIncome`, `YieldSource` and the market's `yield` event.
- **Step 03** (C3): `map_fort` in the atlas, with `idle`. Step 03 runs in a worktree: it must be merged into the stage branch before this step starts (check `grep -o '"map_fort/[a-z_0-9]*"' public/assets/sprites/atlas.json`).
- **Existing (at `81bdbeb`):**
  - `src/scenes/WorldScene.ts`: `outpostButton` (created ~l.364 as "Build Outpost", `onBuildOutpost` ~l.1473 calls `this.built({ kind: 'outpost' })`), its visibility (~l.1055, `outpostSiteRefusal(world, expedition) === null`), the garrison button's visibility (~l.1050, `outpostSite(...) !== null`), the footer layout (~l.858–863: the camp row holds at most one of the tower's, the outpost's and the encampment's buttons), the hide-all list (~l.1319), the map labels (~l.664–690, the `'outpost'` line at ~l.677), location sprites (`LOCATION_SPRITES`, ~l.70; `TOWER_SPRITE` ~l.75), the status text (~l.1034–1042: blight line and "Stock: …").
  - `src/scenes/hexInfo.ts`: the resource's yield line (~l.50) and `fallsIn` (passes `{ position }` to `daysToFall`).
  - `src/scenes/worldEvents.ts`: `describeWorldEvent` (`site_lost`, `yield`, `outpost_built` cases), `describeWorldEvents` (leaves yields to the map).
  - `src/scenes/sounds.ts` ~l.498: `world.build` on `tower_built` or `outpost_built`.
  - `src/testHook.ts` ~l.207: `buildOutpost: ButtonProbe`; `ButtonProbe` has `visible`, `enabled`, `width?`, no label.
  - `e2e/world.test.ts` ~l.1029: "builds an outpost on a held site with the stock, and marks the site".
  - `docs/manual/README.md`: §3 "Camping and other actions" (~l.195, "**Build Watchtower** or **Build Outpost**"), §8 (~l.524, "stronger with an outpost"), §9 Building table (~l.544, the Outpost row).

## 4. Scope and guidance

1. **`src/scenes/improveButton.ts`** (new, Phaser-free: import only domain modules, type-only where possible): `improveLabel(world, party)` per C4. Use `improvementSite`, `nextImprovement`, `improveSiteRefusal` and `withArticle` (capitalise its first letter for the label). The Lodge-gated label has no trailing full stop ("A Mine needs the Builders' Lodge", "A Fort needs the Builders' Lodge at level 2"). Tests beside it (`improveButton.test.ts`): no button off a resource, on the encampment, on an unheld site, among monsters, at level 3; "Build an Outpost: 15 gold, 10 timber" at level 0 (Lodge needs nothing); "A Mine needs the Builders' Lodge" at level 1 with Lodge 0; "Build a Mine: 30 gold, 15 stone" at Lodge 1 (stock or not: the stock is the click's refusal); "A Fort needs the Builders' Lodge at level 2" at level 2 with Lodge 1; "Build a Fort: 50 gold, 20 iron, 10 stone" at Lodge 2; a Peat Bog's "Build Peat Cuttings: 30 gold, 15 stone".
2. **`WorldScene.ts`:**
   - rename the field to `improveButton`, created with an initial label and set to `improveLabel(...)` on every refresh (the button's text changes with the site; make sure its width, and so `buttonProbe`'s `width` and the footer layout, follow the new text);
   - visible when `campable && !this.walking && improveLabel(world, expedition) !== null`;
   - its click runs `this.built({ kind: 'improve' })`, so a refusal (Lodge or stock, `improveRefusal`) is said in the message as Build Outpost's stock refusal was (check `built`'s refusal path reads the day action's refusal, which step 01 points at `improveRefusal`);
   - the garrison button's visibility uses `improvementSite` in place of `outpostSite`; remove every import of `outpostSite` and `outpostSiteRefusal` from the scenes (`grep -rn "outpostSite\|canBuildOutpost\|buildOutpost" src/scenes` must be empty), so step 06 may delete the wrappers;
   - **the footer at 840 wide:** the longest labels are "Build a Fort: 50 gold, 20 iron, 10 stone" and "Build Peat Cuttings: 30 gold, 15 stone". With the camp buttons beside it, the row must fit inside the window at 840 × 560 (and not run under the party strip). If it does not, shorten by dropping the cost from the label only when it would overflow, keeping it in the hex info, and say so in the record (that is a deviation from decision 6 for the orchestrator to see);
   - map labels: the line under an improved site's name is `improvementName(site, level)` ("Outpost", "Mine", "Fort"), where it was "outpost";
   - the palisade: for a site at level 3, draw `map_fort` playing its `idle` over the resource's icon, at the same depth order as the location sprites (above the resource, below labels and party figures); refreshed with the locations, so a fort razed loses its palisade;
   - the stock panel: keep the last yield day's events from the day reports the scene receives (every path that passes days: Next day, Until something happens, a walk, Scout, Wait, Camp, buildings), and show `yieldSummary` of them as a third status line when not null. Not saved: a load starts blank (decision 13). Check the header's height still fits at 840 × 560 with three lines.
3. **`hexInfo.ts`:** for a resource (not the encampment):
   - level 0: "Yields 2 iron." (plus " once held" when not held), as today without the outpost clause;
   - improved: "<Name>: <amount> <material> every 5 days." (`siteYield`, `YIELD_DAYS`) and "Strength <siteStrength> against the blight."; a fort adds "Lost only when corrupted.";
   - `fallsIn` passes the site's (or tower's) id to `daysToFall`, so a fort's threat line counts the days to corruption.
   Tests in `hexInfo.test.ts` for each level and the fort's line, and a fort's "falls in" on a hex at level 2.
4. **`worldEvents.ts`:** the `describeWorldEvent` lines of C4 (`site_improved`, `site_lost` with each level, a market `yield`; a site's `yield` as today); `yieldSummary(events)` per C4: sites' yields summed by material (gold first, then the material's first appearance), then the market's gold; "Last yield: sites 4 gold, 5 iron; market 3 gold", "Last yield: sites 2 gold" with no market, "Last yield: market 2 gold" with only the market; null with no yields. `describeWorldEvents` keeps leaving yields to the panel. Tests in `worldEvents.test.ts`.
5. **`sounds.ts`:** the `world.build` cue on `tower_built` or `site_improved`; update `sounds.test.ts`.
6. **`src/testHook.ts`:** `WorldProbe.buttons.improve` replaces `buildOutpost` (its doc comment: shown on a held resource below level 3; a click without the Lodge or the stock says why); `WorldProbe.improveLabel: string | null` (the button's text when shown, else null). Fill both in `WorldScene.probe()`.
7. **`e2e/world.test.ts`:** rewrite the outpost test (read `e2e/CLAUDE.md` first for how state is set up): on a held resource with stock and the Lodge set through the game state (as the existing test sets the stock), build an Outpost, then a works ("Build a Mine: 30 gold, 15 stone" before; the message "A Mine stands at Iron Vein."; `world.improvements` level 2), then a fort (palisade: the probe or an exposed flag shows `map_fort` drawn there, if the probe can show it; else assert `improvements` level 3 and the label line); then at level 3 the button is hidden. A second case: at level 1 with Lodge 0, the label reads "A Mine needs the Builders' Lodge" and a click leaves the level at 1 with the message "A Mine needs the Builders' Lodge.". A third: at 840 × 560 with the fort's label shown, the improve button's edges lie inside the window (`x ± width / 2`).
8. **Docs:**
   - `docs/manual/README.md`: §3's footer line ("**Build Watchtower** or **Improve**, where the land allows"); §8's "stronger with an outpost" becomes "stronger with an outpost, works or fort"; §9's table: the Outpost row becomes rows for Outpost (15 gold, 10 timber; +1 yield, stronger), works (Mine, Lumber Camp, Quarry, Saltworks or Peat Cuttings by the material; Builders' Lodge 1; 30 gold, 15 stone; +3 yield), Fort (Lodge 2; 50 gold, 20 iron, 10 stone; +3 yield, much stronger, lost only when corrupted), each "A day", all razed when the site is lost; a sentence on the Improve button's label. (The Lodge's and the market's rows are step 05's.)
   - `src/scenes/CLAUDE.md`: the module line for `improveButton.ts`; any line naming Build Outpost or the outpost probe.
   - `docs/reference/scenes.md`: the world map's footer (Improve and its label), hex info lines, map labels and the palisade, the stock panel's yield line, the event lines.
9. **Exclusions:** no rule changes (any rule gap belongs to steps 01–02: note it in the record instead); no encampment screen, trading post scene or debug command (step 05); no simulator code; no screenshot retakes (step 07); do not delete the wrappers in `buildings.ts` (step 06).

## 5. Verification

- Unit tests: `npx vitest run src/scenes/improveButton.test.ts src/scenes/hexInfo.test.ts src/scenes/worldEvents.test.ts src/scenes/sounds.test.ts` pass, with the cases above.
- `grep -rn "outpostSite\|outpostSiteRefusal\|canBuildOutpost\|buildOutpost\|outpost_built" src/scenes src/testHook.ts e2e` prints nothing.
- `npm test` passes, the refactor guard included and its fixture untouched.
- `npm run test:browser` passes (the world tests at least: `npm run test:browser -- -t <name>` while iterating, the whole run before committing).
- Screenshots viewed at 840 × 560: the footer with "Build a Fort: 50 gold, 20 iron, 10 stone" and with "Build Peat Cuttings: 30 gold, 15 stone", a fort's palisade on the map, the hex info of a works and a fort, and the stock panel with its yield line. Record how they were taken (a throwaway e2e or the in-browser harness, kept out of the commit unless it is a real test) and what was seen.
- The 50-campaign check is not run (no rule change): say so.

## 6. Completion criteria

- [ ] `improveLabel` and `yieldSummary` exist as in C4, tested.
- [ ] The Improve button replaces Build Outpost: visible per C4, labelled per decision 6, refusals in the message; fits at 840 wide (or the deviation recorded).
- [ ] Hex info, map labels, the palisade and the stock panel's yield line per decision 13.
- [ ] Event lines and the build sound per C4.
- [ ] `WorldProbe.buttons.improve` and `WorldProbe.improveLabel`; the e2e tests above pass.
- [ ] No scene uses an outpost wrapper.
- [ ] Manual text, `src/scenes/CLAUDE.md` and `docs/reference/scenes.md` updated.
- [ ] `npm test` and `npm run test:browser` pass; screenshots viewed.
- [ ] One commit, "Stage 7 step 04: the world map's Improve", no attribution lines; the index's row 04 updated with status and commit.

## 7. Execution record

Step 04, on `long-campaign-stage-07`, local Node 26. User confirmed decisions 6 and 13 as written.

**Built:** `src/scenes/improveButton.ts` (`improveLabel(world, party, compact = false)`), `yieldSummary` and the new event lines in `worldEvents.ts` (plural works "stand"; the old step-01 "stands" for Saltworks is fixed), hex info lines (`hexInfo.ts`), `WorldScene` (the Improve button with a label that follows the site, the palisade via `map_fort`/`idle`, the map label's building line, the stock panel's third line from `noteYield`, the garrison button on `improvementSite`), `testHook.ts` (`buttons.improve`, `improveLabel`, plus `status` and `palisades` for the tests), manual §3/§8/§9, `docs/reference/scenes.md`, `src/scenes/CLAUDE.md`. `sounds.ts` already played `world.build` on `site_improved` (step 01). Carried items: `pending` set emptied in `encampmentView.test.ts`; the duplicated `wares` sentence removed from `docs/reference/game.md`.

**Deviations (for the orchestrator):**

- **Footer overflow.** At 840 wide the camp row (Camp, Camp until healed, Craft) leaves room for about 30 label characters, so almost every full label overflows. The button therefore shows the full label (decision 6) whenever the row fits the window beside the party column, else a compact one: "Build a Mine" (no cost) or "A Fort needs Lodge 2". The cost then lives in the hex info, where I added one line for a held resource below a fort: "Next: a Mine, 30 gold, 15 stone (needs Lodge 1)." (not in decision 13). `improveLabel` has an optional third parameter for the compact form.
- Plural names in the label read "Peat Cuttings need Lodge 1" / "need the Builders' Lodge"; step 01's refusal still says "needs" for every name (out of scope: "Peat Cuttings needs the Builders' Lodge.").
- With three status lines the header's status block starts at y 3 (not 16) so its third line clears the hint text.

**Verification:** `npx vitest run` on improveButton, hexInfo, worldEvents: pass. `npm test`: 97 files, 2374 tests passed (guard fixture untouched). The step's grep (`outpostSite|canBuildOutpost|buildOutpost|outpost_built|Build Outpost`) over `src/scenes`, `src/testHook.ts`, `e2e`: empty. In-browser: `-t Improve` 3 passed (outpost, works, fort with palisade; the Lodge refusal; the 840 x 560 fit). The 50-campaign check was not run (no rule change).

**Screenshots** (throwaway e2e, deleted, at 840 x 560, planting the saved game): `/private/tmp/claude-501/-Users-ryan-personal-yomi/c29fd0f8-7769-4320-b391-0ba24583f291/scratchpad/` `works-fort-label.png` (works hex info, "Build a Fort" compact), `fort-hexinfo.png`, `fort-yield.png` (stock panel's yield line), `palisade.png` (map_fort over Iron Vein), `peat-label.png` ("Build Peat Cuttings" full label fits). Seen: no overlaps in the footer or header; the info panel over the goblin sprite is as before.

**For later steps:** step 05 reads `yieldSummary` and the probe. Step 06 may delete the wrappers: no scene uses them.
