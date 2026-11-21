# Step 03: Roads and the Lodge's level 3

[Plan index](index.md) · [Stage design](../../designs/long-campaign/stage-08-trade-routes.md) (§2 "Roads. Builders' Lodge level 3 is now active: road sources of `ROAD_STRENGTH` (1) in the blight's fields"; §5 "Road sources join the fields only at Lodge 3. The memo key covers routes"; §7 risk "Roads tipping the blight") · [Reference](../../designs/long-campaign/reference/economy-and-trade-routes.md) §4.4 "Roads (Lodge 3)", §4.6 "Lodge 3 is built while routes are open", §5.2 (`blight.ts`), economy R10 and A8 · [Stages index](../../designs/long-campaign/index.md) (the early-game guard)

**Difficulty:** sonnet / opus. The engineer can be sonnet (`model: "sonnet"`): the change is small and fixed by the contract, in modules with clear patterns (a new source kind in `sources()`, a removed limit, a temporary simulator cap like stage 7's `SIM_TRADING_POST_CAP`). The reviewer should be opus (model unset), to check that the fields memo follows the routes and the Lodge, and that no simulated campaign moves.

## 1. Objective

Make the Builders' Lodge's level 3 real:
- `raiseLodge` builds up to `MAX_LODGE_LEVEL` (3); `LODGE_LEVEL_LIMIT` and `ROADS_REFUSAL` go, everywhere;
- with the Lodge at `ROAD_LODGE_LEVEL` (3), every hex of every open route's road is a clean source of `ROAD_STRENGTH` (1) in the blight's contest; without it, nothing changes;
- the encampment's Lodge has no refusal any more, and its level-3 effect line (already "Roads: open trade routes push back the blight.") stays;
- the simulator keeps its Lodge at 2 (`SIM_LODGE_CAP`, temporary) so play is unchanged.

The refactor guard and the 50-campaign check stay identical: no simulated world has partners (step 01's `SIM_PARTNERS`), so no routes, and the simulator's Lodge stops at 2 as it did.

## 2. Requirements and context

- **S8-R5** (economy R10, A8): "Each open route's road becomes a weak clean source in the blight's contest, so a protected route helps hold the land it crosses." A8: "With Lodge 3, a road hex's net influence includes the road source. Without it, nothing changes."
- **Reference §4.4:** "Each open route's road hexes become clean sources of strength `ROAD_STRENGTH` (1), counted as one source per road hex, with the usual fall-off. They stop at an abandoned route." With strength 1, the usual fall-off (`strength - distance`, kept when above 0) pushes only on the road hex itself.
- **Reference §4.6:** "Lodge 3 is built while routes are open. Their roads start pushing on the next day." This follows from `fields()` being worked out again when the source list changes.
- **Design §5 / reference quality constraints:** "Roads are sources, recomputed only when routes change, through the existing `fields` memo." The memo key is `JSON.stringify` of the source list (existing), so a route opened or abandoned, or the Lodge reaching 3, changes the key.
- **Design §7 risk:** roads tipping the blight; `ROAD_STRENGTH` is the lever (tuned, if at all, in step 08).
- **Stage 7's hold, now lifted:** stage 7 gave the Lodge `maxLevel` 3 and all three costs (`LODGE_COSTS[2]` = 100 gold, 20 iron, 20 stone) but refused level 3 with `ROADS_REFUSAL` ("Roads come with trade routes.") at `LODGE_LEVEL_LIMIT` (2).

### Contract (copied unchanged from the index)

**C3. Roads and the Lodge's level 3 (step 03)**

```ts
// src/game/buildings.ts
export const ROAD_LODGE_LEVEL = 3   // the Lodge level at which open roads push
// LODGE_LEVEL_LIMIT and ROADS_REFUSAL are removed; raiseLodge builds up to MAX_LODGE_LEVEL
// src/game/blight.ts
export const ROAD_STRENGTH = 1
// sources(): when world.lodge >= ROAD_LODGE_LEVEL, each hex of each open route's road is a clean source of ROAD_STRENGTH
//   (one per hex per route; an abandoned route is gone from world.routes, so stops). The memo key follows (it is the source list).
// src/game/encampment.ts: the Lodge's `refusal` goes; its existing level 3 effect line, "Roads: open trade routes push back the blight.", stays
// scripts/simulate.ts (temporary, removed in step 07):
export const SIM_LODGE_CAP = 2   // visitFacilities raises the Lodge only below it; materialNeeds counts LODGE_COSTS only up to it (where it read LODGE_LEVEL_LIMIT)
```

### What this step consumes (copied unchanged from the index, C1 and C2)

From step 01 (C1):

```ts
// WorldState gains (newWorld: [], [], [], 0):
contacted: string[]        // partner ids contacted, in the order contacted; permanent
silent: string[]           // partner ids silent now: entered when the hex reaches LOSS_LEVEL, left when it is 0
routes: TradeRoute[]       // open routes, in the order opened (filled from step 02)
routesOpened: number       // routes ever opened

// src/game/trade.ts (new)
export interface TradeRoute {
  id: string               // 'route_<partner id>'
  partner: string
  road: Hex[]              // the encampment's hex excluded, the partner's included; fixed when opened
  opened: number           // the world turn it opened
  raidedDays: number       // raided yield days in a row
}
// scripts/simulate.ts (temporary, removed in step 07):
export const SIM_PARTNERS: readonly PartnerLocation[] = []   // every simulated world (campaigns and the waiting twin) is newWorld(seed, undefined, SIM_PARTNERS)
```

From step 02 (C2):

```ts
export function openRoute(game: GameState, party: Expedition, partnerId: string): WorldEvent
//   assumes the refusal said null: spends routeCost, pushes { id: `route_${partnerId}`, partner, road, opened: world.turn, raidedDays: 0 },
//   routesOpened += 1, returns route_opened
export function tradeDay(world: WorldState, presences: readonly PartyPresence[]): WorldEvent[]
//   ... at ABANDON_AFTER route_abandoned and the route removed; ...
export const ABANDON_AFTER = 6                  // raided yield days in a row (30 days)
```

### Shared constraints (from the index)

- **Commands** (local Node 26: prefix `PATH=/opt/homebrew/opt/node@26/bin:$PATH`; or the podman `make` targets):
  - `npm test` (`tsc && vitest run`) is the gate before every commit;
  - `npx vitest run <file>` for one file; `npx vitest run --project domain`;
  - `npm run test:browser` (or `-- -t <name>`) after any scene change; read `e2e/CLAUDE.md` before changing an in-browser test;
  - `npm run simulate -- <flags>`: each run its own `--out` under `logs/` (gitignored). **Never run two campaign simulations at once.**
- **The refactor guard.** `scripts/simulate.test.ts`, `describe('the refactor guard')`. **This step must not edit the fixture** (`GUARD_RECORDS`) and must keep it green. A mismatch means the step changed play: find the cause and fix it. This step also runs the **50-campaign check** before committing, against step 01's baseline (in step 01's execution record and `log.md`), and records "identical" or the diff:

  ```sh
  npm run simulate -- --campaign --battles 50 --seed 1 --parties 1 --out logs/guard-50.jsonl > logs/guard-50.txt
  shasum -a 256 logs/guard-50.jsonl
  ```

  It must be identical (index decision 14).
- **Determinism.** No world-RNG or battle-RNG draw is added, dropped or reordered. Road sources draw no RNG.
- **Import cycles.** `blight.ts` imports `trade.ts` (types only here: `TradeRoute` is reached through `WorldState.routes`, so a type import may suffice) and `buildings.ts` (for `ROAD_LODGE_LEVEL`; or read it through a type-free constant). Nothing may call across these modules at load: `ROAD_LODGE_LEVEL` read inside `sources()` is fine, a top-level use is not. If importing `buildings.ts` from `blight.ts` adds a new cycle, prefer importing nothing new and defining the comparison in `sources()` against the constant imported lazily (inside the function body is still a load-safe import); keep it simple and say what you did.
- **Versions.** No `SAVE_VERSION` change (the Lodge's level and the routes are already saved since step 01). `LOG_SCHEMA_VERSION` unchanged.
- **Commits.** One commit once `npm test` passes and the guard holds, on `long-campaign-stage-08`, without pushing, files staged by path. Message "Stage 8 step 03: roads and the Lodge's level 3", no attribution lines.
- **Docs.** Fix every line this change makes wrong, and search the CLAUDE.md files, `.claude/` and `docs/reference/` for `LODGE_LEVEL_LIMIT`, `ROADS_REFUSAL` and "Roads come with trade routes".

## 3. Dependencies and prerequisites

- **Step 02** (and so step 01) must be done: `WorldState.routes` and `TradeRoute` (C1), `openRoute` and `tradeDay`'s abandonment (C2), so the tests can open and abandon a route; `SIM_PARTNERS` (C1), so no simulated world has a route.
- **Existing (at `42cde46`), inspected:**
  - `src/game/buildings.ts`: `LODGE_COSTS` (three levels), `MAX_LODGE_LEVEL = LODGE_COSTS.length` (3), `LODGE_LEVEL_LIMIT = 2`, `ROADS_REFUSAL = 'Roads come with trade routes.'`, `lodgeCost(world)`, `raiseLodge(game, party)`, which returns `ROADS_REFUSAL` when `!cost || world.lodge >= LODGE_LEVEL_LIMIT`.
  - `src/game/blight.ts`: `sources(world)` (monster locations push blight; held sites by `siteStrength`; towers by `TOWER_STRENGTH`; step 01 adds partners by `PARTNER_STRENGTH`), `addSource` (push `strength - distance` where above 0), `fields(world)` memoised in `fieldMemo` by `JSON.stringify([blight, clean])`.
  - `src/game/encampment.ts`: the `builders_lodge` entry of `FACILITIES`, with `refusal: (game) => (game.world.lodge >= LODGE_LEVEL_LIMIT ? ROADS_REFUSAL : null)` and an effect line per level whose third already reads "Roads: open trade routes push back the blight."; `Facility.refusal?` and `FacilityView.barred` (shown by `EncampmentScene.ts` "at once, as its Raise greys"); `facilityRefusal` checks `facility.refusal` before the stock.
  - `scripts/simulate.ts`: imports `LODGE_LEVEL_LIMIT`; `materialNeeds` adds `LODGE_COSTS.slice(world.lodge, LODGE_LEVEL_LIMIT)`; `visitFacilities` runs `while (raiseLodge(game, party) === null);` last of the buildings, with the comment "it stops at `LODGE_LEVEL_LIMIT`, refused until roads come"; the doc comment above `materialNeeds` names `LODGE_LEVEL_LIMIT`.
  - Every other reference (grep at `42cde46`): `src/game/buildings.test.ts` (lines ~476–494: the limit is 2, level 3 refused with `ROADS_REFUSAL`), `src/game/encampment.test.ts` (~179–196: the Lodge's `refusal`/`barred` at level 2), `scripts/simulate.test.ts` (~14, ~799, ~891–892: imports and asserts `LODGE_LEVEL_LIMIT`), `e2e/encampment.test.ts` (~143, ~155: "The Builders' Lodge is raised to level 2. Roads come with trade routes." and the shown refusal), `docs/manual/README.md` (~552: the Lodge's third level "comes with trade routes: the game says 'Roads come with trade routes.'"), `docs/reference/game.md` (~149, ~180), `docs/reference/scenes.md` (~35), `docs/reference/simulator.md` (~13). Re-grep; lines move.
- **Skill file:** `.claude/skills/yomi-add-content/facility.md` (the facility checklist: `FACILITIES`, `setFacilityLevel` already map the Lodge; `encampment.test.ts` and the in-browser `e2e/encampment.test.ts` catch misses). No new facility, plot or sprite here (the level-3 sprite is step 04's).

## 4. Scope and guidance

1. **`buildings.ts`.** Add `ROAD_LODGE_LEVEL = 3`. Delete `LODGE_LEVEL_LIMIT` and `ROADS_REFUSAL`. `raiseLodge` refuses at the top level with a top-level refusal in the shrine's words ("The Builders' Lodge is as great as it gets."), then the stock as now. Update the module's doc comment (works, forts and roads).
2. **`blight.ts`.** Add `ROAD_STRENGTH = 1`. In `sources()`, after the towers, when `world.lodge >= ROAD_LODGE_LEVEL`, push `[hex, ROAD_STRENGTH]` onto `clean` for each hex of each route in `world.routes`, in route order then road order (one source per hex per route, so two roads sharing a hex give two). The memo key is the source list, so it changes exactly when a route opens or goes, or the Lodge reaches 3; do not add a separate key. Update the module's doc comment (roads at Lodge 3 among the clean side).
3. **`encampment.ts`.** Remove the Lodge's `refusal` and the imports it used. Keep `Facility.refusal?` / `FacilityView.barred` as the generic hook (no facility now uses it; `barred` is then always null), unless `tsc` objects; say which in the record. The level-3 effect line already reads "Roads: open trade routes push back the blight." (the contract keeps it); leave it, and check `encampment.test.ts` covers it.
4. **`scripts/simulate.ts`** (temporary hold, so play is unchanged). Add `export const SIM_LODGE_CAP = 2` with a comment "temporary, removed in stage 8 step 07". `materialNeeds` slices `LODGE_COSTS` up to `SIM_LODGE_CAP`; `visitFacilities` raises the Lodge only while `world.lodge < SIM_LODGE_CAP` (for example `while (world.lodge < SIM_LODGE_CAP && raiseLodge(game, party) === null);`). Fix the comments that named `LODGE_LEVEL_LIMIT`.
5. **Tests.**
   - `blight.test.ts` (economy A8): on a small fixed board with one open route (pushed onto `world.routes` directly, or by `openRoute` from a contacted partner):
     - with `world.lodge = 3`, `netInfluence` at a road hex is lower by `ROAD_STRENGTH` (per route through it) than the same world at Lodge 2, and a hex off the road is unchanged (strength 1 reaches only its own hex);
     - with Lodge 2, or no routes, the fields are exactly as before (compare `netInfluence` over every hex with a world that has no routes);
     - the memo is worked out again when a route opens, when one is abandoned (removed by `tradeDay` at `ABANDON_AFTER`, or spliced), and when the Lodge rises from 2 to 3 (observe through `netInfluence` changing on the next call, not through the private memo);
     - two routes sharing a hex push twice there.
   - `buildings.test.ts`: `raiseLodge` raises 2 → 3 for `LODGE_COSTS[2]`, refuses at 3 with the top-level words, and refuses a short stock at 2 with the stock's words; delete the `LODGE_LEVEL_LIMIT` / `ROADS_REFUSAL` assertions.
   - `encampment.test.ts`: the Lodge at level 2 is not barred, its Raise to level 3 works through `improveFacility`, and its level-3 effect line names roads.
   - `scripts/simulate.test.ts`: replace the `LODGE_LEVEL_LIMIT` uses with `SIM_LODGE_CAP` (the simulated Lodge stops at 2); keep the assertion that it is 2.
   - `e2e/encampment.test.ts`: the Lodge raised to level 2 no longer says "Roads come with trade routes."; raising it to 3 works. Run `npm run test:browser -- -t <the encampment tests' name>` and then the whole browser suite once.
6. **Docs.** `docs/manual/README.md` (the Lodge's row: level 3 costs 100 gold, 20 iron, 20 stone and makes open roads push back the blight; no screenshot retake here, step 08 retakes), `docs/reference/game.md` (Buildings and Builders' Lodge sections: level 3 roads, `ROAD_LODGE_LEVEL`, `ROAD_STRENGTH`; road sources in the blight section's list of clean sources), `docs/reference/scenes.md` (the barred refusal no longer shown for the Lodge), `docs/reference/simulator.md` (the Lodge raised to `SIM_LODGE_CAP` until step 07), and `src/game/CLAUDE.md` if a line it holds becomes wrong. Grep `.claude/` too.
7. **Exclusions:** no road overlay or Lodge sprite (steps 05, 04); no simulator raising the Lodge to 3 (step 07 removes `SIM_LODGE_CAP`); no change to `ROAD_STRENGTH`'s value (step 08's lever).

## 5. Verification

- `npm test` passes; the refactor guard is green with `GUARD_RECORDS` untouched.
- The new and changed tests above pass, and each fails on the old code (say how you checked one, for example the A8 test with the road sources commented out).
- `grep -rn "LODGE_LEVEL_LIMIT\|ROADS_REFUSAL\|Roads come with trade routes" src scripts e2e docs/reference docs/manual .claude CLAUDE.md` finds nothing outside `docs/implementation-plans/` and `docs/features/`.
- `npm run test:browser` passes (the encampment tests changed).
- The 50-campaign check is identical to step 01's baseline hash (record both).

## 6. Completion criteria

- [ ] `ROAD_LODGE_LEVEL`, `ROAD_STRENGTH` and road sources in `sources()` as C3; `LODGE_LEVEL_LIMIT` and `ROADS_REFUSAL` gone; `raiseLodge` builds level 3.
- [ ] The Lodge's encampment refusal removed; its level-3 effect line names roads.
- [ ] `SIM_LODGE_CAP` (2) holds the simulator's Lodge, in `visitFacilities` and `materialNeeds`.
- [ ] Tests for economy A8, `raiseLodge` to 3, the encampment's Lodge, and the in-browser encampment test updated; `npm test` and `npm run test:browser` pass.
- [ ] Refactor guard green and untouched; 50-campaign check identical (hashes recorded).
- [ ] Manual text and `docs/reference/` updated; no stale name left (grep recorded).
- [ ] One commit, "Stage 8 step 03: roads and the Lodge's level 3", no attribution lines; the index's row 03 updated with status and commit.

## 7. Execution record
