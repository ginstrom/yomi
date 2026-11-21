# Step 02: Routes, raids and guards

[Plan index](index.md) · [Stage design](../../designs/long-campaign/stage-08-trade-routes.md) (§2 Routes, route slots, guards, events; §5 technical notes) · [Reference](../../designs/long-campaign/reference/economy-and-trade-routes.md) §4.4 (routes, income, raids), §4.6 (edge cases), §5.1, §5.2 (`trade.ts`) · [Company reference](../../designs/long-campaign/reference/multiple-parties.md) R10, A8 (parties guard roads) · [Stages index](../../designs/long-campaign/index.md) (the early-game guard, versions)

**Difficulty:** opus / opus. The engineer should be opus (model unset): the step writes the stage's core rules (the road, security, income, raids, abandonment) and must leave the refactor guard and the 50-campaign check identical. The reviewer should be opus, to check the formulas against the design and that no simulated campaign moves.

## 1. Objective

Give `src/game/trade.ts` the routes:
- `roadTo`, a deterministic road from the encampment to a partner, clear of `RAID_RADIUS` of every nest where it can be, else avoiding nests and their neighbours (decision 6);
- `openRouteRefusal` and `openRoute`, with route slots by trading post level and the cost;
- `guarded`, `hexSecurity`, `routeSecurity` and `routeIncome`, with watchtowers and parties guarding road hexes;
- `raiders` and `raidCause`, by their three causes;
- `tradeDay`, run on yield days: income and goods, raids, abandonment after `ABANDON_AFTER`, restoration;
- the route events, `yield`'s `source: 'route'`, and `isNotable` for the first raid of a run and abandonment;
- `towerHexRefusal` in `buildings.ts`, a refactor the simulator (step 07) needs.

Play does not change: the simulator builds its worlds without partners (`SIM_PARTNERS`, step 01), so no simulated campaign has a route. The refactor guard and the 50-campaign check stay identical. The world map's overlay and lines (step 05) and the Routes tab (step 06) are later steps; this step only keeps the scenes compiling and their tests green.

## 2. Requirements and context

- **S8-R2** (economy R6, A5): opening routes, the road's computation, slots and cost.
- **S8-R3** (economy R7, A6; company R10, A8): income by security; guards by towers and parties.
- **S8-R4** (economy R8, A6): raids by their three causes; abandonment; restoration.
- **Design §2 events:** `route_opened`, `route_raided` (with a cause), `route_restored`, `route_abandoned`; `yield` gains `source: 'route'`; `isNotable` adds the first raid of a run and abandonment (silence is step 01's).
- **Design §5:** `roadTo` uses the world map's own passability and is the same for a seed. `LOG_SCHEMA_VERSION` is unchanged (world events are not in the battle log). `SAVE_VERSION` was bumped once for the stage in step 01 (it already holds `routes` and `routesOpened`); this step changes no saved shape.

### The rules (reference §4.4, with the plan's decisions)

- **Slots:** routes allowed by trading post level 1–6: 0, 0, 0, 1, 2, 4.
- **Cost:** `ROUTE_COST_GOLD` (20) + floor(length / `ROUTE_HEXES_PER_COST_GOLD` (2)) gold, and `ROUTE_TIMBER` (10) timber. A 14-hex road costs 27 gold, 10 timber; 26 hexes cost 33.
- **Security** of a road: the mean over its hexes of `hexSecurity`: 1 for a clean hex or a guarded one; 0.5 for a tainted (level 1) unguarded hex; 0 for a blighted (level 2) unguarded hex or a corrupted (level 3) one. A **guarded** hex is at level 1 or 2 and within `GUARD_RADIUS` (3) of a standing watchtower or of a presence (any party, company R10).
- **Income** each yield day (`YIELD_DAYS`, 5): floor(floor(`ROUTE_BASE` (1) + length / `ROUTE_HEXES_PER_GOLD` (10)) × security). A clean 30-hex road pays 4; a clean 14-hex road 2; a 14-hex road half tainted (security 0.75) floor(2 × 0.75) = 1.
- **Goods** (decision 4): on a yield day whose `world.turn / YIELD_DAYS` is even, a route not raided whose security is at least 0.5 also yields 1 of its partner's good (Millbrook timber, Saltmere salt).
- **Raids**, the first cause that holds: (1) the partner is silent (`world.silent`, step 01); (2) any road hex is corrupted (`MAX_BLIGHT`); (3) a monster location stands within `RAID_RADIUS` (2) of any road hex. A raided route pays nothing that day.
- **Abandonment:** after `ABANDON_AFTER` (6) raided yield days in a row (30 days), the route is abandoned and removed from `world.routes` (its slot freed); it must be reopened at full cost, and reopening recomputes the road.
- **Restoration:** the first yield day without a raid emits `route_restored` and resets `raidedDays`.
- **A monster spawning on the road** raids it by `RAID_RADIUS`; the road is never re-routed (reference §4.6).

### Decisions from the index (restated)

1. **Signatures follow the code's patterns.** `openRouteRefusal(game, party, partnerId)` and `openRoute(game, party, partnerId)` take the party (every encampment action checks `atEncampment`), and `openRoute` is the time-free apply that assumes its refusal said null and returns the `route_opened` event (as `raiseImprovement` does). `routeSecurity` and `routeIncome` take a road (`readonly Hex[]`) and the presences, not a route, so the Routes tab can preview a road not yet opened; `raidCause` takes `{ partner, road }`.
4. **Partners' goods.** Paid 1 of the partner's good every second yield day when security is at least ½: on a yield day whose `world.turn / YIELD_DAYS` is even, from the world's turn (no new state). Its `yield` event has `source: 'route'`.
5. **Raid messages and repeats.** `route_raided` is emitted on every raided yield day, carrying `days` (the run's count, 1 on the first). Only `days === 1` is notable (its message line is step 05's). On the sixth raided day the event is followed by `route_abandoned`, and the route is removed (its slot freed).
6. **The road keeps out of raid range where it can** (the user's decision, 2026-11-21; was open question 1). `roadTo` is `reachableHexes` from the encampment over the board with every hex within `RAID_RADIUS` (2) of a monster location impassable (all monsters, sighted or not: the rules run on the true state, `vision.ts` is knowledge only), the partner's own hex always passable; only when that finds no road does it fall back to the looser rule, every monster location's hex and its neighbours impassable. A fallback road (or a nest within 2 of the partner itself) can be raided the day it opens, which the Routes tab's preview names ("Raided at once: …", step 06). Each breadth-first search is deterministic with ties broken by neighbour order; the design's "`hexKey` tie-breaks" is read as "deterministic for a seed", which it is. The world map has no movement costs (a hex a day), so length is the hex count. The road excludes the encampment's hex and includes the partner's.
7. **The road's figures in design §4 are illustrative.** On today's map, under the looser rule, Millbrook's road is 14 hexes (cost 27 gold and 10 timber, about 2 gold a yield day when clean), not 26; Saltmere's is 30. Decision 6's road keeps clear of the home nests and may be longer while they stand. Tests use the formulas, not these numbers.
8. **The preview's income counts towers, not parties.** The Routes tab and the road tooltip use `routeIncome(world, road, [])` (steps 05, 06); the real yields in `tradeDay` count every presence. This step provides the signature that allows it.
14. **Determinism through step 06.** Steps 01–06 must not move the refactor guard or the 50-campaign check. The simulator builds its worlds without partners (`SIM_PARTNERS`, step 01), so no simulated campaign has a partner or route until step 07.
16. **Routes pay nothing once the encampment is lost** (`tradeDay` returns nothing when `world.status === 'lost'`). The market's payment on the day of the fall (stage 7's note) is left as it is.

**Open question 1 is settled (decision 6, the user's):** `roadTo` prefers a road more than `RAID_RADIUS` from every nest and falls back to the looser rule only when there is none.

### Contract (copied unchanged from the index)

**C2. Routes, raids and guards (step 02)**

```ts
// src/game/trade.ts
export const ROUTE_BASE = 1
export const ROUTE_HEXES_PER_GOLD = 10
export const ROUTE_COST_GOLD = 20               // a route costs ROUTE_COST_GOLD + floor(length / ROUTE_HEXES_PER_COST_GOLD) gold and ROUTE_TIMBER timber
export const ROUTE_HEXES_PER_COST_GOLD = 2
export const ROUTE_TIMBER = 10
export const ROUTE_SLOTS: readonly number[] = [0, 0, 0, 1, 2, 4]   // open routes allowed, by trading post level - 1
export const GUARD_RADIUS = 3
export const RAID_RADIUS = 2
export const ABANDON_AFTER = 6                  // raided yield days in a row (30 days)
export type RaidCause = 'silent' | 'corrupted' | 'raiders'
export function routeLimit(world: WorldState): number                          // ROUTE_SLOTS[world.tradingPost - 1] ?? 0
export function routeOf(world: WorldState, partnerId: string): TradeRoute | null
export function roadTo(world: WorldState, partnerId: string): Hex[] | null     // decision 6: clear of RAID_RADIUS where it can, else clear of nests' neighbours; null when no road
export function routeCost(length: number): Stock                               // { gold: 20 + floor(length / 2), timber: 10 }
export function openRouteRefusal(game: GameState, party: Expedition, partnerId: string): string | null
export function openRoute(game: GameState, party: Expedition, partnerId: string): WorldEvent
//   assumes the refusal said null: spends routeCost, pushes { id: `route_${partnerId}`, partner, road, opened: world.turn, raidedDays: 0 },
//   routesOpened += 1, returns route_opened
export function guarded(world: WorldState, at: Hex, presences: readonly PartyPresence[]): boolean
//   the hex is at level 1 or 2 and within GUARD_RADIUS of a standing watchtower or a presence
export function hexSecurity(world: WorldState, at: Hex, presences: readonly PartyPresence[]): 0 | 0.5 | 1
//   1 clean or guarded; 0.5 tainted; 0 blighted (unguarded) or corrupted
export function routeSecurity(world: WorldState, road: readonly Hex[], presences: readonly PartyPresence[]): number   // the mean of hexSecurity, 0..1
export function routeIncome(world: WorldState, road: readonly Hex[], presences: readonly PartyPresence[]): number
//   floor(floor(ROUTE_BASE + road.length / ROUTE_HEXES_PER_GOLD) * routeSecurity)
export function raiders(world: WorldState, road: readonly Hex[]): MonsterLocation[]
//   monster locations within RAID_RADIUS of any road hex, nearest to the road first, ties in locations order
export function raidCause(world: WorldState, route: Pick<TradeRoute, 'partner' | 'road'>): { cause: RaidCause; raider?: MonsterLocation } | null
//   the first that holds: the partner is silent; a road hex is corrupted; raiders(world, road)[0]
export function tradeDay(world: WorldState, presences: readonly PartyPresence[]): WorldEvent[]
//   on yield days, called by updateTerritory after partnerDay; nothing when world.status is 'lost' (decision 16). For each route in order:
//   raided: raidedDays += 1, route_raided { days: raidedDays }, and at ABANDON_AFTER route_abandoned and the route removed;
//   else: route_restored if raidedDays > 0 (reset to 0); the gold (when > 0) to stock as a yield; and on a yield day whose
//   world.turn / YIELD_DAYS is even, if routeSecurity >= 0.5, 1 of the partner's good as a yield
// src/game/blight.ts, WorldEvent gains:
//   | { type: 'route_opened'; route: string; partner: string; name: string; length: number }
//   | { type: 'route_raided'; route: string; partner: string; name: string; cause: RaidCause; raider?: string; raiderName?: string; days: number }
//   | { type: 'route_restored'; route: string; partner: string; name: string }
//   | { type: 'route_abandoned'; route: string; partner: string; name: string }
//   'yield' gains route?: string; a route's yields are { site: <partner id>, name: <partner name>, material, amount, source: 'route', route: <route id> }
// src/game/territory.ts: YieldSource = 'site' | 'market' | 'route'
// src/game/worldMap.ts: isNotable(route_raided) is days === 1; isNotable(route_abandoned) is true
// src/game/buildings.ts: towerHexRefusal(world: WorldState, at: Hex): string | null   // towerSiteRefusal's place rules for any hex (towerSiteRefusal calls it); same words
```

- **Refusal words** (`openRouteRefusal`, in order): "Routes are opened at <encampment name>." (not `atEncampment`); `No partner "<id>".`; "<name> has not been contacted: walk there first."; "<name> is silent while the blight holds its land."; "A route to <name> is already open."; "Routes need the Market (trading post level 4)." (limit 0); "The <tradingPostName> keeps <n> route(s) open at most." ("1 route", "2 routes"); "No safe road to <name>."; "The route costs <describeCost>, more than the stock holds."

**Consumed from C1 (step 01), copied unchanged:**

```ts
// src/game/worldMap.ts
export interface PartnerLocation extends LocationBase { kind: 'partner'; good: Material }   // a neutral settlement: never held, never lost
export type WorldLocation = MonsterLocation | QuietLocation | PartnerLocation                // LocationKind gains 'partner'
export const PARTNERS: readonly PartnerLocation[] = [
  { id: 'millbrook', kind: 'partner', name: 'Millbrook', position: offsetToHex(18, 30), good: 'timber' },   // threat 2 ring
  { id: 'saltmere', kind: 'partner', name: 'Saltmere', position: offsetToHex(30, 38), good: 'salt' },       // threat 3 ring, south edge
]
export function newWorld(seed?: number, encampmentName?: string, partners: readonly PartnerLocation[] = PARTNERS): WorldState
//   copies of `partners` placed in `locations` after the resources, before the monsters, before the blight is seeded
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
export function partners(world: WorldState): PartnerLocation[]                 // in locations order
export function partnerById(world: WorldState, id: string): PartnerLocation | null
export function isContacted(world: WorldState, id: string): boolean
export function isSilent(world: WorldState, id: string): boolean
export function contactPartner(world: WorldState, id: string): WorldEvent | null   // partner_contacted, or null (not a partner, or contacted already)
export function partnerDay(world: WorldState, presences: readonly PartyPresence[]): WorldEvent[]
//   every day, called by updateTerritory after the yields: first contact (partners in locations order, each with a presence on its hex),
//   then silence (a partner not silent whose hex is >= LOSS_LEVEL joins `silent`; a silent one whose hex is 0 leaves it);
//   partner_silent / partner_restored only for contacted partners

// scripts/simulate.ts (temporary, removed in step 07):
export const SIM_PARTNERS: readonly PartnerLocation[] = []   // every simulated world (campaigns and the waiting twin) is newWorld(seed, undefined, SIM_PARTNERS)
```

### Shared constraints (from the index)

- **Commands** (local Node 26: prefix `PATH=/opt/homebrew/opt/node@26/bin:$PATH`; or the podman `make` targets):
  - `npm test` (`tsc && vitest run`) is the gate before every commit;
  - `npx vitest run <file>` for one file; `npx vitest run --project domain`;
  - `npm run test:browser` after any scene change (this step changes no scene's behaviour; run it only if a scene file is edited beyond types);
  - `npm run simulate -- <flags>`: each run its own `--out` under `logs/` (gitignored). **Never run two campaign simulations at once.**
- **The refactor guard.** `scripts/simulate.test.ts`, `describe('the refactor guard')`: this step must not edit the fixture (`GUARD_RECORDS`) and must keep it green. A mismatch means the step changed play: find the cause and fix it.
- **The 50-campaign check**, before committing, against step 01's baseline hash (in step 01's execution record and `log.md`); it must be **identical**:

  ```sh
  npm run simulate -- --campaign --battles 50 --seed 1 --parties 1 --out logs/guard-50.jsonl > logs/guard-50.txt
  shasum -a 256 logs/guard-50.jsonl
  ```

- **Determinism.** No world or battle RNG draw is added, dropped or reordered. Roads, security, income and raids draw no RNG. `tradeDay`'s events come after `partnerDay`'s, which come after the market's yield, so a day's existing events keep their order.
- **Import cycles.** `trade.ts` imports `blight.ts`, `territory.ts`, `worldMap.ts` and `buildings.ts`; `territory.ts` and `blight.ts` import it back. Safe only while nothing calls across at module load: no top-level call into another of these modules (constants of plain literals only). Step 01 added `trade` to the cycle lists in the root and `src/game/` CLAUDE.md files; check `buildings.ts` is named among them now that `trade.ts` imports it.
- **Refusals.** Return why it was refused (a string) or null, and check everything before changing anything; a refused action leaves the game untouched. Words are shown to the player.
- **Versions.** `SAVE_VERSION` is not bumped again (step 01's 28 holds routes already). `LOG_SCHEMA_VERSION` unchanged.
- **Commits.** One commit once `npm test` passes and the guard holds, on `long-campaign-stage-08`, without pushing; files staged by path. Message: "Stage 8 step 02: routes, raids and guards", no attribution lines.
- **Docs.** Fix the CLAUDE.md lines this change makes wrong (`src/game/CLAUDE.md`'s module list: `trade.ts` now also routes, raids and guards; `territory.ts` runs `tradeDay`); the full rule text in `docs/reference/game.md` is step 08's, but add a short "Trade routes" note there if a section it already has (Territory, Buildings) becomes untrue.

## 3. Dependencies and prerequisites

- **Step 01 (required, produces):** `PartnerLocation`, `PARTNERS` in `newWorld`, `WorldState.contacted`, `silent`, `routes`, `routesOpened`, `src/game/trade.ts` with `TradeRoute`, `partners`, `partnerById`, `isContacted`, `isSilent`, `contactPartner`, `partnerDay` (called by `updateTerritory` after the yields), the partner events, `PARTNER_STRENGTH`, `SAVE_VERSION` 28 and the strict check of `routes`, and `SIM_PARTNERS = []` in the simulator. If any of these differ from C1 as built, read step 01's execution record and follow what it built, recording the difference.
- **Existing (at `42cde46`):**
  - `src/grid/hex.ts`: `reachableHexes(start, maxSteps, passable)` (breadth-first, deterministic, neighbour order), `HexBoard`, `hexDistance`, `hexNeighbors`, `hexKey`, `hexEquals`.
  - `src/game/worldMap.ts`: `routeTo` (the passability pattern to follow: board-contained, known monster hexes blocked but the target), `encampment`, `encampmentName`, `isNotable`, `ENCAMPMENT_ID`.
  - `src/game/territory.ts`: `updateTerritory` (yields every `YIELD_DAYS`, then the market's gold with `source: 'market'`), `YieldSource = 'site' | 'market'`, `LOSS_LEVEL`, `YIELD_DAYS`, `Stock`, `Material`.
  - `src/game/blight.ts`: `blightAt`, `MAX_BLIGHT`, the `WorldEvent` union, `yield`'s `source?`.
  - `src/game/buildings.ts`: `towerSiteRefusal(world, party)` (place rules on `party.position`), `canAfford`, `spend`, `describeCost`, `atEncampment`.
  - `src/game/tradingPost.ts`: `tradingPostName(level)` ('Trading Post', 'Market', 'Market Hall', 'Trading House').
  - `src/scenes/worldEvents.ts`: `describeWorldEvent`'s `switch` over `WorldEvent['type']` (tsc will ask for the new types; return `''` for them in this step, step 05 writes the lines), `yieldSummary` (a route yield may be counted under sites for now; step 05 adds its part). Any other exhaustive `switch` or `Record` over event types `tsc` flags gets a minimal entry.
- **No blockers.**

## 4. Scope and guidance

1. **Baseline first.** Before any change, confirm the 50-campaign hash equals step 01's recorded value (rerun only if the branch moved since step 01).
2. **Constants and small readers** in `trade.ts`: as C2 (`routeLimit`, `routeOf`, `routeCost`).
3. **`roadTo(world, partnerId)`**: null if `partnerId` is not a partner. First search: blocked are every hex within `RAID_RADIUS` of a monster location (all monster locations, sighted or not) and off-board hexes. If it finds no road, the fallback search: blocked are every monster location's hex and each of its `hexNeighbors`, and off-board hexes. In both the partner's own hex is always passable. Each search is `reachableHexes(encampment(world).position, board.hexes.length, passable)`, taking the partner's entry; null when neither finds it. The result excludes the encampment's hex, includes the partner's.
4. **Opening.** `openRouteRefusal` checks in the order of the refusal words above, computing `roadTo` only after the cheaper checks and before the cost (the cost depends on the road's length). `openRoute` assumes null and does what C2 says; it computes the road again (or the same way) so the route holds exactly what the refusal checked.
5. **Guards and security.** `guarded`: level 1 or 2 and within `GUARD_RADIUS` of any `world.towers` position or any presence's position. `hexSecurity` per the rules. `routeSecurity`: mean; an empty road can't occur (a road always holds the partner's hex) but return 0 rather than divide by zero.
6. **Raids.** `raiders(world, road)`: distance to the road is the minimum `hexDistance` to any road hex; keep those `<= RAID_RADIUS`; sort by that distance, ties by index in `world.locations`. `raidCause`: silent (`isSilent`), then corrupted (`blightAt(...) >= MAX_BLIGHT` on any road hex), then `raiders[0]` as `{ cause: 'raiders', raider }`.
7. **`tradeDay(world, presences)`**: return `[]` when `world.status === 'lost'` or `world.turn % YIELD_DAYS !== 0`. Iterate a copy of `world.routes` in order; for each, with its partner's name:
   - raided: `raidedDays += 1`; push `route_raided` with `cause`, `raider` / `raiderName` (the raider's id and name, for 'raiders'), `days`; if `raidedDays >= ABANDON_AFTER`, push `route_abandoned` and remove the route from `world.routes`;
   - not raided: if `raidedDays > 0`, push `route_restored` and set 0; gold = `routeIncome(world, route.road, presences)`, when > 0 add to `world.stock.gold` and push the route `yield` (material 'gold'); then if `(world.turn / YIELD_DAYS) % 2 === 0` and `routeSecurity(...) >= 0.5`, add 1 of the partner's good to stock and push its `yield`.
8. **Wiring.** `updateTerritory` calls `partnerDay` (step 01) then, on yield days, `tradeDay`, appending their events after the market's. `YieldSource` gains `'route'`; `yield` gains `route?: string`.
9. **`isNotable`:** `route_raided` when `event.days === 1`; `route_abandoned` always. `route_opened` and `route_restored` are not notable.
10. **`towerHexRefusal(world, at)`** in `buildings.ts`: move `towerSiteRefusal`'s place rules into it, keyed on a hex; `towerSiteRefusal(world, party)` keeps its monsters-here check and calls it with `party.position`, returning exactly the same words in the same order as today. (Its "cannot stand on the encampment or a resource" message may say "on a location" now that partners exist; if you change the words, update every test and the manual line that quotes them, and say so in the record.)
11. **The save's route check** (from step 01's review). `isRoute` in `src/game/save.ts` (with the strict check around it) also refuses a route whose `id` is not `'route_' + partner`, a second route to the same partner, and a route to a partner not in `contacted`. No new field, so `SAVE_VERSION` stays 28.
12. **Exclusions:** no scene lines, overlay or Routes tab (steps 05, 06); no road sources or Lodge 3 (step 03); no simulator change (step 07; `SIM_PARTNERS` stays `[]`); no new saved field.

## 5. Verification

- **`src/game/trade.test.ts`** (extend step 01's file), on small fixed boards (a world from `newWorld(seed, undefined, PARTNERS)` with locations, blight, towers and stock set by hand, or a hand-built small `WorldState`), seeded or RNG-free:
  - `roadTo`: the same road twice and for two worlds built from the same seed (determinism); it keeps more than `RAID_RADIUS` from every nest, sighted or not, where it can, and falls back to avoiding only a nest's hex and neighbours when a nest walls the clear road off (then `raidCause` says raiders); the partner's hex is passable even next to a nest; it excludes the encampment's hex and ends on the partner; null when walled in, and `openRouteRefusal` then says "No safe road to <name>.".
  - Every refusal, one test each, in the listed order (a setup that fails only that check): not at the encampment, unknown id, not contacted, silent, already open, trading post below 4, slots full (1 at level 4, 2 at 5, 4 at 6), no road, the stock short of gold or of timber. A refused open leaves the world unchanged (deep-equal before and after).
  - `openRoute`: spends `routeCost` (27 gold, 10 timber for a 14-hex road), pushes the route as C2 says, `routesOpened` +1, returns `route_opened` with the length; reopening after abandonment recomputes the road (a nest placed since changes it).
  - Income formula: all clean; half tainted (security 0.75 on a road half level 1); a blighted stretch counted 0; tainted and blighted hexes guarded by a watchtower within 3 count 1, at 4 do not; guarded by a party presence within 3 (company A8), not without it; a corrupted hex is never guarded.
  - Each raid cause, with its precedence: silent beats corrupted beats raiders; a nest at distance 2 raids, at 3 does not; `raiders` ordering by distance, then locations order; the raider's id and name on the event.
  - `tradeDay`: nothing on non-yield days; a raided route pays nothing and counts `days` 1, 2, …; after `ABANDON_AFTER` raided yield days `route_abandoned` follows the sixth `route_raided` and the route is gone (slot freed: `openRouteRefusal` no longer says full); the first clear yield day after a raid emits `route_restored` and resets; gold `yield` with `source: 'route'`, `route`, `site` the partner's id; the good on a yield day with `turn / YIELD_DAYS` even and security ≥ 0.5, not on odd ones, not below 0.5; nothing at all when `world.status === 'lost'`.
- **`src/game/worldMap.test.ts`:** `isNotable` true for `route_raided` with `days: 1`, false with `days: 2`; true for `route_abandoned`; false for `route_opened`, `route_restored`.
- **`src/game/territory.test.ts`:** on a yield day, route events come after the sites' and the market's yields; a world with no routes yields exactly as before.
- **`src/game/save.test.ts`:** a version-28 save is unreadable with a route whose `id` is not `route_<partner>`, with two routes to one partner, or with a route to an uncontacted partner; one opened by `openRoute` round-trips.
- **`src/game/buildings.test.ts`:** `towerHexRefusal` gives each of today's tower refusals for a hex; `towerSiteRefusal`'s existing tests pass unchanged.
- `npm test` passes; the refactor guard is green and its fixture untouched.
- The 50-campaign check (command above): hash **identical** to step 01's baseline; record both values.

## 6. Completion criteria

- [ ] `trade.ts` exports everything in C2 with those signatures; `YieldSource` has `'route'`; the four route events are in `WorldEvent`; `isNotable` as C2; `towerHexRefusal` in `buildings.ts`.
- [ ] The save's strict check refuses a route with the wrong id, a duplicate partner or an uncontacted partner (§4 item 11).
- [ ] `updateTerritory` runs `partnerDay` then, on yield days, `tradeDay`, after the market's yield.
- [ ] The tests in §5 exist and pass; `npm test` passes.
- [ ] The refactor guard is green with its fixture unedited; the 50-campaign hash is identical to step 01's (both recorded).
- [ ] `src/game/CLAUDE.md` (and the root cycle list if needed) current.
- [ ] The execution record names any departure from C2 as built (exact names and words, especially refusal words and event fields that steps 05–07 consume).
- [ ] One commit, "Stage 8 step 02: routes, raids and guards", no attribution lines; the index's row 02 updated with status and commit.

## 7. Execution record

Engineer: opus (model unset), 2026-11-21, on `long-campaign-stage-08` after `c4bc8fa`; commit `615a263`.

**Built as C2**, every name, signature and refusal word as written. Details later steps consume:

- `trade.ts` now imports `buildings.ts` (`atEncampment`, `canAfford`, `describeCost`, `spend`) and `tradingPost.ts` (`tradingPostName`); `trade.ts` joins the second cycle list in `src/game/CLAUDE.md` (with `company.ts`, `buildings.ts`, …). `blight.ts` imports `RaidCause` from it as a type only.
- `route_raided` carries `raider` and `raiderName` only for `cause: 'raiders'` (the keys are absent, not undefined, otherwise).
- A route's yields are `{ type: 'yield', site: <partner id>, name: <partner name>, material, amount, source: 'route', route: <route id> }`, gold first, then the good.
- `openRoute(game, _party, partnerId)` ignores the party (the refusal checks it); it recomputes `roadTo`, which the refusal also computed, so the route holds the checked road.
- `towerHexRefusal(world, here)` also says "Nothing can be built here now." when the game is over (as `towerSiteRefusal` did), so it stands alone; `towerSiteRefusal` keeps that and its monsters-here check first. Words unchanged ("A watchtower cannot stand on a location." was already the wording); no manual or test edit needed.
- The save's check (§4 item 11): `isRoute` takes the set of contacted partners and asks `id === 'route_' + partner`; `isRoutes` adds one route at most per partner. A route to a contacted partner that is silent now still reads.
- `describeWorldEvent` returns `''` for the four route events (step 05 writes the lines); `yieldSummary` counts a route's yields under sites for now (it only singles out `source: 'market'`). Note for step 05: while a notable `route_raided` or `route_abandoned` interrupts a journey, the message line is empty until step 05's lines land; no player can open a route before step 06's tab, so nothing shows it.

**Fresh world (any seed: the locations are fixed):** Millbrook's road is 14 hexes (cost 27 gold, 10 timber; security 0.857, `routeIncome(world, road, [])` 1 gold), Saltmere's 30 (cost 35 gold, 10 timber; security 0.667, income 2). Neither is raided: the nearest nest to either road is 3 hexes away, so decision 6's clear search finds roads as short as the looser rule's (the plan's decision 7 figures hold). Income is below decision 7's "about 2 when clean" for Millbrook because 4 of its 14 hexes start tainted.

**Deviation from test-first.** The `trade.ts` routes were written before their tests in one pass; to show the tests bind, each key rule was then mutated by hand and the trade tests rerun: dropping the clear search, the fallback, the partner's-hex exception, `<=` on `GUARD_RADIUS`, party guards, the raider sort, the lost check, the even-day goods, the `ABANDON_AFTER` boundary, the silent refusal and the corrupted-never-guarded rule each failed 1 to 4 tests; `>= 0.5` → `> 0.5` passed, so a test at security ½ exactly was added and then failed that mutant. The save check was written red first (the new test failed, then passed).

**Tests added:** `trade.test.ts` (the road: determinism, shape, clear of `RAID_RADIUS` with an unsighted nest, the fallback through a gap in a ring of nests, the partner's hex beside a nest, walled in; cost and slots; `openRoute`; all thirteen refusals in order, each leaving the game deep-equal; security, income, tower and party guards at 3 and 4; raid causes, distance 2 and 3, ordering, precedence; `tradeDay`: other days, gold and goods, ½ exactly, below ½, raids counted and restored, silence and corruption, abandonment freeing the slot, reopening on a fresh road, nothing once lost), `worldMap.test.ts` (`isNotable` for the four route events), `territory.test.ts` (order after sites, market and partners; no routes as before), `save.test.ts` (wrong id, duplicate, uncontacted; `openRoute` round-trips), `buildings.test.ts` (`towerHexRefusal`'s words).

**Verification:**

- `npm test`: 100 files, 2463 tests passed (2417 before the step).
- The refactor guard: green, `GUARD_RECORDS` untouched.
- 50-campaign check (`npm run simulate -- --campaign --battles 50 --seed 1 --parties 1 --out logs/guard-50.jsonl`): SHA-256 `1ceefe633e71c0326c0c5b261c77e1c010c49e30303a85286a782589e74400d1`, **identical** to step 01's baseline (23 of 50). The baseline was not rerun before the change: the branch had moved only by step 01's review follow-up (save checks), and the identical hash after the change shows it held.
- `npm run test:browser` not run: no scene changed beyond the four `''` cases in `worldEvents.ts`' `switch`.

**Docs:** `src/game/CLAUDE.md` (the `trade.ts` line; `trade.ts` in the second cycle list), `docs/reference/game.md` (a short "Trade routes" item under the world map; `partnerDay` no longer "called last"; `isNotable`'s list; Territory; `towerHexRefusal`; the save's route check). The root CLAUDE.md cycle line already named `trade`.

**Review round 1 (tests only; no code defect found).** All fixed in `trade.test.ts`, no change to `trade.ts`:

1. Fixed: a tainted hex guarded by a watchtower 3 away counts 1, and 0.5 with the tower 4 away; the party-guard test gains a tainted hex. Each failed the reviewer's two mutants (`guarded` false below level 2; `hexSecurity` counting a guard only at level 2).
2. Fixed: Saltmere uncontacted and silent is refused as uncontacted. Failed with the two checks swapped.
3. Fixed: a nest 2 hexes from Millbrook (offset 18,28), off the road and 1 hex from it. The road bends to 15 hexes, ends on Millbrook and keeps every other hex more than `RAID_RADIUS` from every nest; the nest raids it through the partner's hex. Failed with the partner's hex passable only in the fallback search, the break written as `search(clear, false) ?? search(looser, true)` with `passable` honouring the exception only when told to: the fallback's road then comes within 2 hexes of a nest ("expected 2 to be greater than 2").
4. Fixed: dropped the unread `told`; the silence-and-corruption test now sets up silence too (and checks no raider keys); the restoration test's `isNotable` reads `second[0]`.

`npm test` green after the round (100 files, 2465 tests); the code is unchanged, so the 50-campaign check was not rerun.

**Review round 2.** The reviewer found that the partner-hex test (item 3) passed under `search(new Set([...clear, hexKey(partner.position)])) ?? search(looser)` and asked for a second nest. Disputed, with no test change: that edit is the same code. `passable` lets the partner's hex through before it reads the blocked set (`hexEquals(h, partner.position) || !blocked.has(...)`). So adding the partner's key to a blocked set changes no hex's passability. In this setup the key is already in `clear` anyway, because Millbrook is 2 hexes from the nest. No setup, with any number of nests, can tell that edit apart from the current code. The break the test targets, the partner's hex passable only in the fallback search, needs the exception taken out of the first search's `passable`. Against that break the test fails (run again in round 2, output above), and it passes on the code as committed. Round 1's note is corrected to name that break exactly. `npm test` green (100 files, 2465 tests).
