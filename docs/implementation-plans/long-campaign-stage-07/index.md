# Implementation plan: long campaign, stage 7 (site improvements and market income)

Held resource sites can be raised past an outpost to a **works** (more yield) and a **fort** (stronger, lost only when corrupted), unlocked by a new encampment facility, the **Builders' Lodge**. The trading post gains levels 5 and 6, and levels 4 to 6 (Market, Market Hall, Trading House) bring **passive gold** every yield day. The world map's Build Outpost button becomes **Improve**; the simulator builds improvements, raises the Lodge and the market, and records income by source and a waiting check.

**Source design:** [`docs/designs/long-campaign/stage-07-site-improvements-and-markets.md`](../../designs/long-campaign/stage-07-site-improvements-and-markets.md) (status "ready for planning"). It cuts from [`reference/economy-and-trade-routes.md`](../../designs/long-campaign/reference/economy-and-trade-routes.md) §4.1, §4.2, §5.1, §5.2, §5.4 (improvements, the Lodge, market income; no partners, routes or roads). Conventions: [`docs/designs/long-campaign/index.md`](../../designs/long-campaign/index.md). Previous stage: [stage 6's plan](../long-campaign-stage-06/index.md) and [feature record](../../features/long-campaign-stage-06.md). Feature record: [`docs/features/long-campaign-stage-07.md`](../../features/long-campaign-stage-07.md). Written against `81bdbeb` on branch `long-campaign-stage-07` (off `main`, which has auto-resolve, the skill trees and battle cost since stage 6).

## Decisions taken for the orchestrator

The plan follows the stage design, then the reference, then the code (where they differ, the code is right). None blocks a step. **Items 6, 8 and 13 shape what the player or the simulator sees and are worth the user's eye before steps 04 and 06.**

1. **Signatures follow the code's patterns.** `improveRefusal(world, party)` and `raiseLodge(game, party)` take the party (the design wrote `improveRefusal(world)` and `raiseLodge(world)`): an improvement is built by the party standing on the site, as an outpost is, and every encampment facility's raise checks that a party is at home (`atEncampment`).
2. **The day action** `{ kind: 'outpost' }` becomes `{ kind: 'improve' }` (builds the site's next level). A saved day order `outpost` migrates to `improve`.
3. **Events.** `site_improved { site, name, level, building }` replaces `outpost_built` (`building` is the level's name, "Outpost", "Mine", "Fort", for the message). `site_lost`'s `outpost?: true` becomes `improvement?: ImprovementLevel` (the level razed). The message says "its outpost razed", "its works razed", "its fort razed". The design's "outpost_built kept as an alias in the log" is not needed: world events are not in the battle log, so `outpost_built` is removed outright. `LOG_SCHEMA_VERSION` is unchanged (design §5).
4. **Yield source.** `yield` gains `source?: YieldSource` (`'site' | 'market'`; stage 8 adds `'route'`). A site's yield leaves it out (absent means a site), so existing events keep their shape; the market's yield carries `source: 'market'`, `site: ENCAMPMENT_ID` and the encampment's name.
5. **Market income on tainted ground** is halved as a site's yield is, rounded down: 2 → 1, 3 → 1, 5 → 2.
6. **The Improve button** (decision for the user's eye) stands where Build Outpost did, shown on a held resource below level 3 whenever the party could build there but for the Lodge and the stock. Its label is the next level and its cost, "Build a Mine: 30 gold, 15 stone", or, when the Lodge is too low, "A Mine needs the Builders' Lodge" (enabled: a click says why in the message, as a stock refusal does). The label comes from a Phaser-free helper (`improveLabel`, C4).
7. **The Builders' Lodge** has `maxLevel` 3 and all three costs, but `raiseLodge` refuses at level 2 with "Roads come with trade routes." (`LODGE_LEVEL_LIMIT` 2, lifted in stage 8). The debug console may still set level 3, which does nothing yet. It is the sixth facility, on a sixth plot of the encampment screen.
8. **The waiting check** (decision for the user's eye). The stage design asks for "gold per day at home against the campaign's average"; the reference (A9, §5.4) defines it as a twin: the same seed's world run forward with the company idle at home, against the campaign. The plan takes the reference's twin, because income on the days a campaigning party happens to stand at home is the same land's income and would not show what waiting costs. **Income** is the stock's yields as value: gold, plus every other material at the trading post's rate (`MATERIALS_PER_GOLD`, 2 for a gold piece), from `yield` events, sales excluded on both sides. Each campaign records `incomePerDay` and `waitingIncomePerDay` (the twin over the campaign's own days); the summary prints both averages and whether waiting earns less. If the twin adds more than 10% to a 500-campaign run's time, it moves behind a `--waiting` flag (step 06 measures and says which).
9. **The simulator's Lodge** is raised in `visitFacilities` after the infirmary (the trading post, the workshop, the infirmary, then the Lodge), to its limit (2), so it competes last for gold with the buildings the careful party already buys. `materialNeeds` keeps the Lodge's costs up to `LODGE_LEVEL_LIMIT` and the cost of each improvement level the Lodge allows in place of `OUTPOST_COST`.
10. **Determinism through step 02.** Steps 01 and 02 must not move the refactor guard: in step 01 the Lodge is 0 in every simulated campaign, so only outposts are built, at today's cost, strength and yield; in step 02 the simulator is held at trading post level 4 (`SIM_TRADING_POST_CAP`, temporary) so the new levels' costs do not enter `materialNeeds`. Market income at level 4 is a rule change and may move the 50-campaign check (never the 5-campaign fixture, whose campaigns reach level 2): step 02 proves any move is market income alone. Step 06 lifts the cap and re-records the fixture, once.
11. **Wrappers.** Step 01 keeps `outpostSite`, `outpostSiteRefusal`, `canBuildOutpost`, `buildOutpost` and `OUTPOST_COST` as wrappers with today's behaviour (a site with any improvement is refused "already has an outpost"), so the world map (step 04) and the simulator (step 06) can move to the new names in parallel. Step 06, the last caller to move, deletes the wrappers and their tests' uses.
12. **Art beyond the design.** The design names only `camp_lodge`. The encampment draws each facility by `camp_<facility>/level_<n>`, so trading post levels 5 and 6 need `camp_trading_post/level_5` and `level_6`; and design §4's "a fort shows a palisade" needs a map sprite, `map_fort`, drawn over a fort's resource icon. Step 03 draws all three.
13. **What the world map shows** (decision for the user's eye). The hex info of an improved site reads "Mine: 5 iron every 5 days." (the design's line) and "Strength 6 against the blight." (`siteStrength`), and a fort adds "Lost only when corrupted."; an unimproved site keeps "Yields 2 iron." The map label's line under a site's name says its building ("Mine", "Fort") where it said "outpost". The stock panel gains a third line, "Last yield: sites …; market 3 gold", from the last yield day the scene saw (not saved: blank after a load until the next yield day).
14. **Debug commands for the play script.** `stock` takes several pairs (`stock gold 300 stone 50 iron 50`); a new `blight <level> [here | <location id> | <col> <row>]` sets a hex's level with its shift counter at 0 (to push a fort's hex to 3 or taint the encampment); `days` adds a line totalling the yields by source over the days passed. `facility builders_lodge 2` works through `FACILITIES`.
15. **Saves.** `SAVE_VERSION` 26 → 27 in step 01, with `migrateFrom26`: every id in a saved `outposts` becomes level 1 in `improvements`, `lodge` is 0, and a party's day order `outpost` becomes `improve`. Every older readable version (25, 24, 23, 22, 18) goes through the chain and then `migrateFrom26`. One bump for the stage.
16. **Out of scope:** partners, routes, roads, road strength and route slots (stage 8); partners' goods for sale (stage 10); improvement upkeep (reference 8.8: none).

## Scope and shared constraints

- **In:** S7-R1 to S7-R4, the design's tests (§6, economy A1–A3), its two simulator checks and its play script, and the docs the stages index asks for.
- **Out:** decision 16.
- **Commands** (local Node 26: prefix `PATH=/opt/homebrew/opt/node@26/bin:$PATH`; or the podman `make` targets):
  - `npm test` (`tsc && vitest run`) is the gate before every commit;
  - `npx vitest run <file>` for one file; `npx vitest run --project domain`;
  - `npm run test:browser` (or `-- -t <name>`) after any scene change; read `e2e/CLAUDE.md` before adding an in-browser test;
  - `npm run simulate -- <flags>`: each run its own `--out` under `logs/` (gitignored). Never run two campaign simulations at once. A 500-campaign run takes about five minutes alone and writes some 70 MB.
- **The refactor guard.** `scripts/simulate.test.ts`, `describe('the refactor guard')`: 5 campaigns from seed 1 with `--parties 1`, each `CampaignRecord` and a SHA-256 of every battle event, against a fixture.
  - **Steps 01–05 must not edit the fixture** and must keep it green. A mismatch means the step changed play: find the cause and fix it.
  - Steps 01–05 that touch the domain or the simulator (01, 02) also run the **50-campaign check** before committing and record "identical" or the diff:

    ```sh
    npm run simulate -- --campaign --battles 50 --seed 1 --parties 1 --out logs/guard-50.jsonl > logs/guard-50.txt
    shasum -a 256 logs/guard-50.jsonl
    ```

    Step 01 records the baseline (before its change) and must match it. Step 02 may differ only through market income at trading post level 4 (decision 10), shown by rerunning with `MARKET_INCOME[3]` set to 0 for the check alone (identical to step 01's), and records its own new values. Steps 03–05 change no rule and need not run it (say so).
  - **Step 06 re-records the fixture once** (new record fields, and play moved by the Lodge, works, forts and the market levels), recording the old and new figures in the doc comment above `GUARD_RECORDS`.
- **The early-game figure.** The cross-stage rule's 230 of 500 (`--parties 1`, `--ready-level` 7, seed 1) was stage 6's; main has since gained the skill trees' retune (scripts/CLAUDE.md's bands table says 234) and auto-resolve. **Step 01 re-measures it on the branch before any change**, with the default company too; that is the stage's baseline. Step 07 measures again. A move of more than about 5 points must be explained in the commit and in CLAUDE.md's rules of scaling, or retuned away (design §7: if forts leave the land too clean, lower the fort's strength before its loss level). The user's bands (scripts/CLAUDE.md) still hold: one party 215–250, default company 220–260, days 243–297, deaths at most 2.0.
- **Determinism.** No step adds, drops or reorders a draw of the world RNG or a battle's RNG. Market income is added after the sites' yields, so the order of a day's existing events is unchanged.
- **Commits.** One commit per step once `npm test` passes (and the guard holds), on `long-campaign-stage-07`, without pushing. A step run in a worktree commits on its own branch, merged into the stage branch by the orchestrator. Messages "Stage 7 step NN: <title>". No attribution lines.
- **Docs.** CLAUDE.md files stay current: each step fixes the lines its change makes wrong and searches them (and `docs/reference/`) for every name it renames or removes (`outposts`, `outpost_built`, `OUTPOST_YIELD`, `OUTPOST_STRENGTH`, `outpostErrand`, `buildOutpost`, …). Scene steps update the manual's text for their screens; step 07 retakes the screenshots and writes the stage's implementation notes.
- **Sprites** are drawn with sprite-tool by following `art/CLAUDE.md` and `docs/designs/sprite-drawing-guidance.md`; never edit an exported PNG; `npm run sprites` then `npm run sprites:check`.

## Contracts

Task files copy these unchanged. "Existing" means at `81bdbeb`.

### C1. Improvements and the Lodge's rules (step 01)

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

### C2. Market income and the encampment's facilities (step 02)

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
// src/scenes/encampmentView.ts: FACILITY_SPRITES.builders_lodge = 'camp_lodge' (added here: tsc needs every FacilityId; the frames arrive with step 03)

// scripts/simulate.ts (temporary, removed in step 06)
export const SIM_TRADING_POST_CAP = 4   // visitFacilities raises the post only below it; materialNeeds counts its levels only up to it
```

### C3. Sprites (step 03)

- `camp_lodge`, on the 48px `building` canvas: frames `level_1`, `level_2`, `level_3` (a builders' yard, then with a crane or scaffold and stone, then grander with a road-mason's mark for roads).
- `camp_trading_post` gains `level_5` (Market Hall) and `level_6` (Trading House), grander than `level_4`, same canvas and footprint.
- `map_fort`, on the `map` canvas: a palisade ring drawn over a resource's icon, with frame `base` and an `idle` animation (map sprites have one), transparent where the resource icon should show through.

### C4. The world map's Improve (step 04)

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

### C5. The encampment and the debug console (step 05)

- `FACILITY_SPRITES.builders_lodge = 'camp_lodge'` (already added by step 02); `PLOTS` gains a sixth plot for it.
- The Trading Post scene's header names the post by `tradingPostName`.
- Debug: decision 14.

### C6. The simulator's improvements and record (step 06)

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

## Tasks

| Step | Task | Outcome | Depends on | Engineer / reviewer | Status |
| --- | --- | --- | --- | --- | --- |
| 01 | [Improvements and the Lodge's rules](01-improvements-domain.md) | Baseline figures; `improvements`, `lodge`, levels 1–3 yields, strength and loss level, razing, `site_improved`, `improveSite`, `raiseLodge`; save 27 with migration (C1); guard identical | — | opus / opus | pending |
| 02 | [Market income and the facilities](02-market-and-facilities.md) | Trading post 5–6, market income with `source: 'market'`, the post's names, the Lodge in `FACILITIES` (C2); guard fixture green, 50-check moved only by market income | 01 | sonnet / opus | pending |
| 03 | [Sprites: Lodge, market and fort](03-sprites.md) | `camp_lodge` ×3, `camp_trading_post` 5–6, `map_fort` (C3) | — | sonnet / opus | done (branch `long-campaign-stage-07-sprites`) |
| 04 | [The world map's Improve](04-world-map-improve.md) | Improve button, hex info, labels, palisade, event lines, yield summary, sound (C4); manual text; in-browser tests | 02, 03 | sonnet / opus | pending |
| 05 | [The encampment and the debug console](05-encampment-and-debug.md) | The Lodge's plot, the post's names on screen, debug `stock`, `blight`, `days` (C5); manual text; in-browser tests | 04 | sonnet / opus | pending |
| 06 | [The simulator's improvements and record](06-simulator.md) | `improveErrand`, Lodge and market raised, record and summary, the waiting twin (C6); wrappers gone; fixture re-recorded once | 02 | opus / opus | pending |
| 07 | [Measure, document, play](07-measure-document-play.md) | The guard and the company figure, the waiting check; CLAUDE.md, reference docs, manual and screenshots; implementation notes; play script walked | 05, 06 | opus / opus | pending |

**Tiers.** "opus" means leave the model unset (the session's); "sonnet" means `model: "sonnet"`; no step needs "fable". Steps 01 and 06 decide the guard, the save migration and the simulator's economy; 07 is measurement and a balance judgment. Steps 02, 04 and 05 follow fixed contracts and existing patterns; 03 is tool work with a judged look. Every reviewer is opus.

## Execution order

01 → 02 → then two tracks: **scenes** 04 → 05, and **simulator** 06; 07 after both.

- **03** touches only `art/` and `public/assets/sprites/`; it may run at any time in its own worktree, and must be merged before 04 (the palisade) and 05 (the Lodge and market frames).
- **06** may run in its own worktree in parallel with 04 and 05: it touches `scripts/` (and `scripts/CLAUDE.md`, `docs/reference/simulator.md`) and, to delete the wrappers, `src/game/buildings.ts` and `buildings.test.ts`; 04 must have moved `WorldScene` off `outpostSite`/`outpostSiteRefusal` before 06 deletes them, so **merge 04 before 06**, or 06 deletes only the wrappers no scene uses and step 07 deletes the rest (say which in the record).
- 04 and 05 both touch `src/testHook.ts`, `e2e/`, the manual and `src/scenes/CLAUDE.md`: run them in order on the stage branch.
- **Checkpoints:** after 02, the domain is done and the fixture untouched; after 06, the fixture is re-recorded; 07 measures on the merged branch.

## Requirement map

| Design item | Steps |
| --- | --- |
| S7-R1 improvement levels 1–3: yields, strength, loss level, building, razing; works names | 01 (rules), 04 (Improve button, hex info, map) |
| S7-R2 the Builders' Lodge, levels 1 and 2 active, level 3 refused; `camp_lodge` | 01 (rules), 02 (facility), 03 (sprite), 05 (screen) |
| S7-R3 market income at trading post levels 4–6; levels 5–6; names | 02 (rules), 03 (frames), 04 (event lines, yield summary), 05 (screen) |
| S7-R4 the simulator's improvements, income by source, waiting check | 06, 07 (measured) |
| §5 `SAVE_VERSION` with the migration; `LOG_SCHEMA_VERSION` unchanged | 01 |
| §6 tests: economy A1 (01), A2 (01, 02), A3 (02); scene tests for Improve (04) and the Lodge (05); `improveErrand` (06) | as listed |
| §6 simulator checks 1 (guard) and 2 (waiting) | 01 (baseline), 07 |
| §6 play script | 05 (debug commands it needs), 07 (walked) |
| Cross-stage: docs, manual, sprites, implementation notes | each step; 03; 07 |

## Completion criteria

- `npm test`, `npm run test:browser`, `npm run build` and `npm run sprites:check` pass.
- The guard fixture was edited only by step 06 and passes.
- The early-game figure (`--parties 1`) is within about 5 points of step 01's baseline, or the move is explained in the commit and CLAUDE.md's rules of scaling (or retuned); the default company stays in its band.
- The waiting check shows waiting at home earns less a day than campaigning.
- CLAUDE.md files, `docs/reference/`, the manual and its screenshots are current; the stage design has its implementation notes; the stages index shows stage 7's status.
- The play script has been walked, with what was seen recorded in step 07.

## Open questions

None blocks a step. Decisions 6 (the Improve button's label when the Lodge is too low), 8 (the waiting check as a twin, by income value) and 13 (the hex info and stock panel lines) are defaults taken for the user to confirm before steps 04 and 06.

## For implementers

When you start or finish a step, update its status and commits in the table above. Record evidence (commands and output, the guard's result), deviations and blockers in your task file's "Execution record". Keep this index short; every implementer reads it.
