# Step 01: Improvements and the Lodge's rules

[Plan index](index.md) · [Stage design](../../designs/long-campaign/stage-07-site-improvements-and-markets.md) (§2 Improvements, the Builders' Lodge; §5 technical notes) · [Reference](../../designs/long-campaign/reference/economy-and-trade-routes.md) §4.1, §4.2 (the Lodge), §5.1, §5.2 · [Stages index](../../designs/long-campaign/index.md) (the early-game guard, versions)

**Difficulty:** opus / opus. The engineer should be opus (model unset): the step replaces a saved field with a migration, changes the loss rule and must leave the refactor guard and the 50-campaign check identical. The reviewer should be opus, to check the migration chain and that no simulated campaign moves.

## 1. Objective

Measure the stage's baseline, then give the domain site improvements and the Builders' Lodge's rules:
- `WorldState.improvements` (levels 1 to 3) replaces `outposts`, and `lodge` is added; `SAVE_VERSION` 27 migrates older saves.
- Yields, strength and the loss level read the improvement level; a fort is lost only when corrupted; every level is razed with the site.
- `improveSite` / `improveRefusal` build the next level, gated by the Lodge; `raiseLodge` / `lodgeCost` raise the Lodge (to level 2; level 3 refused until stage 8).
- `site_improved` replaces `outpost_built`; `site_lost` carries the level razed.

Play does not change: in every simulated campaign the Lodge stays 0, so only outposts are built, at today's cost, strength and yield. The refactor guard and the 50-campaign check stay identical. The world map's Improve button, hex info and event lines are step 04's; this step only keeps the scenes compiling and their tests green.

## 2. Requirements and context

- **S7-R1** (economy R1, R3, A1): levels 1 to 3 with their yields, strength and loss level, building and razing; works names by material.
- **S7-R2** (economy R2, A2): the Lodge's levels gate works (1) and forts (2). (Its facility entry on the encampment screen is step 02's.)
- **Design §5:** `siteStrength` adds +3 at levels 1 and 2 and +7 at level 3; the blight's memo key includes improvements; `SAVE_VERSION` bumped with the migration from `outposts`; `LOG_SCHEMA_VERSION` unchanged (world events are not in the battle log).

The table (reference §4.1):

| Level | Name | Needs | Cost | Yield (on top of 2) | Strength (on top of 3) | Lost at |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Outpost | — | 15 gold, 10 timber | +1 | +3 | level 2 |
| 2 | Works (by material) | Lodge 1 | 30 gold, 15 stone | +3 | +3 | level 2 |
| 3 | Fort | Lodge 2 | 50 gold, 20 iron, 10 stone | +3 | +7 | level 3 (corrupted) |

The Lodge (reference §4.2): level 1 30 gold, 20 timber; level 2 60 gold, 25 stone; level 3 100 gold, 20 iron, 20 stone (roads; refused in this stage).

### Contract (copied unchanged from the index)

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

### Decisions from the index that bind this step (unchanged)

1. **Signatures follow the code's patterns.** `improveRefusal(world, party)` and `raiseLodge(game, party)` take the party (the design wrote `improveRefusal(world)` and `raiseLodge(world)`): an improvement is built by the party standing on the site, as an outpost is, and every encampment facility's raise checks that a party is at home (`atEncampment`).
2. **The day action** `{ kind: 'outpost' }` becomes `{ kind: 'improve' }` (builds the site's next level). A saved day order `outpost` migrates to `improve`.
3. **Events.** `site_improved { site, name, level, building }` replaces `outpost_built` (`building` is the level's name, "Outpost", "Mine", "Fort", for the message). `site_lost`'s `outpost?: true` becomes `improvement?: ImprovementLevel` (the level razed). The message says "its outpost razed", "its works razed", "its fort razed". The design's "outpost_built kept as an alias in the log" is not needed: world events are not in the battle log, so `outpost_built` is removed outright. `LOG_SCHEMA_VERSION` is unchanged (design §5).
7. **The Builders' Lodge** has `maxLevel` 3 and all three costs, but `raiseLodge` refuses at level 2 with "Roads come with trade routes." (`LODGE_LEVEL_LIMIT` 2, lifted in stage 8). The debug console may still set level 3, which does nothing yet. It is the sixth facility, on a sixth plot of the encampment screen. (The `FACILITIES` entry is step 02's.)
10. **Determinism through step 02.** Steps 01 and 02 must not move the refactor guard: in step 01 the Lodge is 0 in every simulated campaign, so only outposts are built, at today's cost, strength and yield.
11. **Wrappers.** Step 01 keeps `outpostSite`, `outpostSiteRefusal`, `canBuildOutpost`, `buildOutpost` and `OUTPOST_COST` as wrappers with today's behaviour (a site with any improvement is refused "already has an outpost"), so the world map (step 04) and the simulator (step 06) can move to the new names in parallel. Step 06, the last caller to move, deletes the wrappers and their tests' uses.
15. **Saves.** `SAVE_VERSION` 26 → 27 in step 01, with `migrateFrom26`: every id in a saved `outposts` becomes level 1 in `improvements`, `lodge` is 0, and a party's day order `outpost` becomes `improve`. Every older readable version (25, 24, 23, 22, 18) goes through the chain and then `migrateFrom26`. One bump for the stage.

### Shared constraints (from the index)

- **Commands** (local Node 26: prefix `PATH=/opt/homebrew/opt/node@26/bin:$PATH`; or the podman `make` targets):
  - `npm test` (`tsc && vitest run`) is the gate before every commit;
  - `npx vitest run <file>` for one file; `npx vitest run --project domain`;
  - `npm run test:browser` (or `-- -t <name>`) after any scene change; read `e2e/CLAUDE.md` before adding an in-browser test;
  - `npm run simulate -- <flags>`: each run its own `--out` under `logs/` (gitignored). Never run two campaign simulations at once. A 500-campaign run takes about five minutes alone and writes some 70 MB.
- **The refactor guard.** `scripts/simulate.test.ts`, `describe('the refactor guard')`: 5 campaigns from seed 1 with `--parties 1`. **This step must not edit the fixture** and must keep it green; a mismatch means the step changed play: find the cause and fix it. It also runs the **50-campaign check**, before its change (the baseline) and before committing, and records "identical" or the diff:

  ```sh
  npm run simulate -- --campaign --battles 50 --seed 1 --parties 1 --out logs/guard-50.jsonl > logs/guard-50.txt
  shasum -a 256 logs/guard-50.jsonl
  ```

- **The early-game figure.** The cross-stage rule's 230 of 500 (`--parties 1`, `--ready-level` 7, seed 1) was stage 6's; main has since gained the skill trees' retune (scripts/CLAUDE.md's bands table says 234) and auto-resolve. **This step re-measures it on the branch before any change**, with the default company too; that is the stage's baseline, which step 07 compares against.
- **Determinism.** Add, drop or reorder no draw of the world RNG or a battle's RNG, and keep the order of a day's events.
- **Commits.** One commit once `npm test` passes and the guard holds, on `long-campaign-stage-07`, without pushing. Never switch branches. Message "Stage 7 step 01: improvements and the Lodge's rules". No attribution lines.
- **Docs.** CLAUDE.md files stay current: fix the lines this change makes wrong and search them (and `docs/reference/`) for every name renamed or removed (`outposts`, `outpost_built`, `OUTPOST_YIELD`, `OUTPOST_STRENGTH`, `raiseOutpost`, `{ kind: 'outpost' }`, …). The manual is step 04's.

## 3. Dependencies and prerequisites

- **None.** This is the first step. Steps 02, 04 and 06 consume C1.
- **Existing (at `81bdbeb`), inspected:**
  - `src/game/territory.ts`: `LOSS_LEVEL`, `OUTPOST_YIELD`, private `RESOURCE_YIELDS` (material by site id), `sites`, `siteYield` (reads `world.outposts`), `daysToFall(world, presences, { position })` (fixed `LOSS_LEVEL`), `updateTerritory` (loses at `LOSS_LEVEL`, razes the outpost with `site_lost` `outpost: true`).
  - `src/game/blight.ts`: `MAX_BLIGHT` 3, `OUTPOST_STRENGTH`, `siteStrength` (reads `world.outposts`), `WorldEvent` with `outpost_built` and `site_lost.outpost`, the `fields` memo keyed on `JSON.stringify` of the sources' strengths.
  - `src/game/buildings.ts`: `OUTPOST_COST`, `outpostSite`, `outpostSiteRefusal`, `canBuildOutpost`, `raiseOutpost`, `buildOutpost` (over `act(game, id, { kind: 'outpost' })`), `atEncampment`, `canAfford`, `spend`, `describeCost`, the shrine's `raiseShrine` (the pattern `raiseLodge` follows).
  - `src/game/company.ts`: `actionRefusal` case `'outpost'` (`canBuildOutpost`), `runAction` case `'outpost'` (`raiseOutpost`), the garrison refusal over `outpostSite` ("Only a held resource can be garrisoned.").
  - `src/game/expedition.ts`: `DayAction` `{ kind: 'outpost' }`.
  - `src/scenes/partyList.ts`: `orderLabel` case `'outpost'` → "Building".
  - `src/game/worldMap.ts`: `WorldState.outposts`, `newWorld` (`outposts: []`).
  - `src/game/save.ts`: `SAVE_VERSION` 26; `parseSave` reads 26, 25, 24, 23, 22, 18 (`migrateFrom18`, `migrateFrom22`, `migrateFrom25`); `isDayAction` accepts `'outpost'`; the world check `Array.isArray(world.outposts)`. Fixtures in `src/game/fixtures/` (`save-v18.json`, `save-v22.json`, `save-v25.json`).
  - Other readers of `outposts` / `outpost_built` / `site_lost.outpost`: `src/scenes/WorldScene.ts` (map label "outpost", button visibility via `outpostSiteRefusal`, garrison via `outpostSite`), `src/scenes/hexInfo.ts` ("with an outpost", `fallsIn` passing `{ position }` to `daysToFall`), `src/scenes/worldEvents.ts` (`site_lost`, `outpost_built` lines), `src/scenes/sounds.ts` (`world.build` cue), `src/debug…`/`src/testHook.ts` (`buildOutpost` probe), `scripts/simulate.ts` (`outpostErrand` reads `world.outposts`; `tally` counts `outpost_built` into `outpostsBuilt`; the `'build'` phase acts `{ kind: 'outpost' }`; `daysToFall` calls in `nextTarget`), and the tests `buildings.test.ts`, `company.test.ts`, `save.test.ts`, `partyList.test.ts`, `sounds.test.ts`, `scripts/simulate.test.ts`, `e2e/world.test.ts` (the outpost test reads the probe's `world.outposts`).
  - Find them all with `grep -rn "outpost\|Outpost" src scripts e2e`.

## 4. Scope and guidance

1. **Baseline first, before any edit.** On the clean branch, run and record in the execution record (figures and the command lines):
   - `npm run simulate -- --campaign --battles 500 --seed 1 --parties 1 --out logs/base-p1.jsonl > logs/base-p1.txt`: the Source wins of 500, days, battles, deaths, trading post level reached (the summary's line), outposts built;
   - `npm run simulate -- --campaign --battles 500 --seed 1 --out logs/base-p3.jsonl > logs/base-p3.txt` (the default company);
   - the 50-campaign check above, its `shasum` and the summary.
   Run them one at a time. Compare the one-party figure with the cross-stage 230 and scripts/CLAUDE.md's 234, and say which it matches.
2. **State.** `WorldState.improvements` and `lodge` (C1) in place of `outposts`; `newWorld` gives `{}` and 0. Doc comments as the neighbours'.
3. **territory.ts.** `ImprovementLevel`, `IMPROVEMENT_YIELD` (remove `OUTPOST_YIELD`), `WORKS_NAMES`, `siteImprovement`, `improvementName` (from the site's material in `RESOURCE_YIELDS`; the encampment is never improved), `withArticle`, `lossLevel`, `daysToFall` with the site's id (general formula: `ceil((SHIFT_COST - shift) / net) + (loss - 1 - level) * ceil(SHIFT_COST / net)`, and 0 at or above `loss`). `updateTerritory`: lose at `lossLevel(world, site.id)`, delete the improvement and push `site_lost` with `improvement` when there was one; towers stay at `LOSS_LEVEL`; the threatened check passes each site's or tower's id. Update the module's doc comment.
4. **blight.ts.** `IMPROVEMENT_STRENGTH` (remove `OUTPOST_STRENGTH`), `siteStrength` reading `siteImprovement`; the `WorldEvent` changes (C1). The memo key needs no change (it serialises each source's strength); add a test that it changes when a site is improved.
5. **buildings.ts.** Everything in C1's buildings block, with the refusal words above. `raiseImprovement` spends `nextImprovement`'s cost, sets the level and returns `site_improved` with `building: improvementName(site, level)`. `improveSite` acts `{ kind: 'improve' }` on the day loop, returning null and doing nothing when `improveRefusal` refuses. `raiseLodge` follows `raiseShrine`: not at the encampment → "The Builders' Lodge is at <encampment>." (use `encampmentName`); at `LODGE_LEVEL_LIMIT` or above → `ROADS_REFUSAL`; the stock → "The next level costs …, more than the stock holds."; else spends and raises. The wrappers (decision 11) keep today's behaviour and words exactly: `outpostSite` = `improvementSite`; `outpostSiteRefusal` refuses any improved site with "<site> already has an outpost."; `canBuildOutpost` adds the `OUTPOST_COST` stock check with today's words; `buildOutpost` acts `{ kind: 'improve' }` when `canBuildOutpost` allows. Mark them `/** @deprecated until step 06 … */` in a comment.
6. **The day loop.** `DayAction` `{ kind: 'improve' }`; `company.ts` `actionRefusal` → `improveRefusal`, `runAction` → `raiseImprovement`, the garrison check → `improvementSite`; `partyList.ts` `orderLabel` → "Building".
7. **Saves.** `SAVE_VERSION` 27 and `migrateFrom26` (decision 15), applied to every older version after the existing chain; `parseSave` checks `improvements` is an object whose values are 1, 2 or 3 naming resource locations, and `lodge` an integer from 0 to `MAX_LODGE_LEVEL`; `isDayAction` accepts `'improve'` (an `'outpost'` is migrated before the check). Add `src/game/fixtures/save-v26.json` (a version-26 save with an outpost and a party whose order is the `outpost` day action; write it with the current code before the bump, for example from a test helper or by hand from `save-v25.json`'s shape) and tests that it loads as level 1, `lodge` 0 and an `improve` order; that the older fixtures still load; and that a version-27 save round-trips improvements at levels 2 and 3 and a Lodge level.
8. **Minimal moves elsewhere, play unchanged:**
   - `scripts/simulate.ts`: `outpostErrand` reads `siteImprovement(world, site.id) === 0` in place of `!world.outposts.includes`; the `'build'` phase acts `{ kind: 'improve' }` (still gated by the `canBuildOutpost` wrapper); `tally` counts `site_improved` at level 1 into `outpostsBuilt`; `daysToFall` calls pass the site (with its id). No other simulator change (step 06 owns `improveErrand`, the Lodge and the record).
   - Scenes, compile and tests only (step 04 does the real work): `worldEvents.ts` gives `site_improved` "An outpost stands at <name>." at level 1 (and "<withArticle(building), capitalised> stands at <name>." otherwise) and `site_lost` "…, and its outpost razed." for any `improvement`; `sounds.ts` cues `world.build` on `site_improved`; `hexInfo.ts` reads `siteImprovement(...) >= 1` for ", with an outpost" and passes ids to `daysToFall`; `WorldScene.ts` reads `siteImprovement` for its label line. The world probe (`src/testHook.ts`) and `e2e/world.test.ts`'s outpost test: keep the test meaning the same, reading `improvements` (`{ iron_vein: 1 }`) where it read `outposts`.
9. **Tests** (domain, economy A1 and A2; write them first):
   - `territory.test.ts`: yield at levels 0–3 (2, 3, 5, 5), halved on taint; `lossLevel`; a fort held at blight level 2 and lost at 3, a works lost at 2; every level razed on loss with `site_lost.improvement`; `daysToFall` for a fort counts to level 3; `improvementName` for every material and `withArticle` for each name.
   - `blight.test.ts`: `siteStrength` 3, 6, 6, 10 by level; the fields change (the memo key) when a site is improved.
   - `buildings.test.ts`: `nextImprovement` costs and names; `improveRefusal` for each refusal in order (not held, the encampment, among monsters, level 3, Lodge 0 for works, Lodge 1 for a fort, the stock); `raiseImprovement` spends and raises 1 → 2 → 3; `improveSite` takes a day; `lodgeCost` and `raiseLodge` (away from home, the stock, levels 1 and 2, `ROADS_REFUSAL` at 2); the wrappers' behaviour is as before.
   - `company.test.ts`: an `improve` day order builds and passes the day; a garrison on an improved site.
   - `save.test.ts`: as in 7.
10. **Docs.** `src/game/CLAUDE.md` (the buildings line: improvements and the Lodge), `docs/reference/game.md` (the outpost lines become improvements, the fort's loss level, the Lodge's costs), and every other line naming a removed identifier.
11. **Exclusions:** no market income, trading post levels or `FACILITIES` entry (step 02); no Improve button, hex info lines or map sprite (step 04); no `improveErrand`, Lodge raising or record fields in the simulator (step 06); no manual edits (step 04).

## 5. Verification

- `npm test` passes, including the new tests and the untouched refactor guard fixture.
- The 50-campaign check after the change has the same `shasum` as the baseline in 1 ("identical").
- `npm run test:browser -- -t outpost` (or the world file) passes, as the scene and probe were touched.
- `grep -rn "world.outposts\|outpost_built\|OUTPOST_YIELD\|OUTPOST_STRENGTH\|kind: 'outpost'" src scripts e2e docs/reference src/*/CLAUDE.md` finds nothing but the save migration and its fixture.

## 6. Completion criteria

- [ ] Baseline recorded: one party and default company of 500 from seed 1, and the 50-campaign hash, before any change.
- [ ] C1 implemented as written, with the refusal words above; wrappers keep today's behaviour.
- [ ] `SAVE_VERSION` 27 with `migrateFrom26`, a `save-v26.json` fixture and its tests; older fixtures still load.
- [ ] Domain tests for economy A1 and A2's rules pass; `npm test` passes; the guard fixture is untouched and green; the 50-campaign check is identical.
- [ ] CLAUDE.md files and `docs/reference/game.md` current for the renamed names.
- [ ] One commit, "Stage 7 step 01: improvements and the Lodge's rules", no attribution lines; the index's row 01 updated with status and commit.

## 7. Execution record

