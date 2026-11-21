# Step 07: The simulator's trade

[Plan index](index.md) · [Stage design](../../designs/long-campaign/stage-08-trade-routes.md) (§2 "The simulator", §6 Simulator, §7 Risks) · [Reference](../../designs/long-campaign/reference/economy-and-trade-routes.md) §5.4 (the simulator), R11 · [Company reference](../../designs/long-campaign/reference/multiple-parties.md) R10, R14 · [Stages index](../../designs/long-campaign/index.md) ("The early-game guard")

**Difficulty:** opus / opus. The engineer changes the careful company's policy (where it walks, what it builds and buys), removes two determinism holds and re-records the refactor guard: judgment about determinism and balance, so leave the model unset. The reviewer should be opus too, checking that the fixture moved for the stated reasons only.

## 1. Objective

The simulated company plays the stage's trade:
- every simulated world has Millbrook and Saltmere (the `SIM_PARTNERS` hold goes) and the Lodge may reach level 3 (the `SIM_LODGE_CAP` hold goes);
- the vanguard detours to contact a partner within 8 hexes;
- home visits open routes and raise the Lodge to 3 once a route is open;
- `nextTarget` and the guard's defend branch weigh nests raiding a route after threatened sites;
- after a win, a watchtower is preferred on clean land that guards an unguarded tainted road hex;
- the record and summary gain partners contacted, routes opened, raided and abandoned, and route gold.

The refactor guard's fixture is re-recorded once, here.

## 2. Requirements and context

- **S8-R7** (design §2, "The simulator"): the party detours to uncontacted partners within 8 hexes; it opens routes on home visits; `nextTarget` weighs raiders like threats to sites; towers are preferred on unguarded tainted road hexes; the guard role's "defend" branch includes raiders; the record gains routes opened, raided and abandoned, and route gold.
- **Economy R11 (part):** the simulator opens routes and protects them; its `nextTarget` weighs nests that raid a route as it weighs nests that threaten a site; it records income by source.
- **Company R14 (part), R10:** the home guard defends; a party near a road guards it (already in the domain's `guarded`, step 02: no simulator code needed for it).
- **Design §6 Simulator:** (1) the early-game guard: routes need trading post 4, which the early game rarely reaches, so expect little change; record the route counts. (2) `--ready-level 10` with the company: routes opened, raided sometimes, rarely abandoned, route gold a visible share. Both are measured in step 08, not here; this step records the 50-campaign figures only.
- **Design §7 Risks:** roads tipping the blight (`ROAD_STRENGTH`); the party pulled back to defend roads (`RAID_RADIUS`, `ABANDON_AFTER`). Retuning is step 08's call; this step only reports what it sees.

### Decisions (from the index, unchanged)

9. **Watchtowers keep needing clean land** (for the user's eye). The design's play script says "build a watchtower on a tainted road hex", and its simulator "towers preferred on unguarded tainted road hexes"; the code refuses a tower on any land above 0 (`towerSiteRefusal`), and the code is right. Both are read as "a watchtower within `GUARD_RADIUS` of a tainted road hex": the play script's step 5 builds on clean land beside the stretch, and the simulator's tower errand walks to a clean hex that guards an unguarded tainted or blighted road hex.
12. **The simulator's Lodge reaches 3** (for the user's eye). The stage design's simulator list does not say; the reference (§5.4) raises the Lodge "when routes are possible". The plan raises it to 2 as today and to 3 once a route is open, so roads are measured. Routes are opened in `visitFacilities` after the infirmary and before the Lodge; the order of the works, forts and market levels is untouched (carried forward to stage 12).
13. **The simulator's contact detour** is the vanguard's (and a lone party's) only, at its `choose` phase: the nearest uncontacted partner within `CONTACT_DETOUR` (8) hexes of the party (the reference's "of its path" read as "of the party"), once the trading post allows routes (level 4, `routeLimit` above 0) and when no held site is threatened; each partner is sought once a campaign (`Plan.contactsTried`). (Gated on the post by the user's decision, 2026-11-22: ungated, the detour alone moved `one` from 239 to 304 of 500.) Raiders are weighed after threatened sites and before the nearest nest, nearest raider first, in both `nextTarget` and the guard's defend branch.
14. **Determinism through step 06.** Steps 01–06 must not move the refactor guard or the 50-campaign check. The simulator builds its worlds without partners (`SIM_PARTNERS`, temporary, step 01) and keeps the Lodge at 2 (`SIM_LODGE_CAP`, temporary, step 03), so no simulated campaign has a partner, route or road until step 07, which removes both holds and re-records the fixture once.

### Shared constraints (from the index)

- **Commands** (local Node 26: prefix `PATH=/opt/homebrew/opt/node@26/bin:$PATH`; or the podman `make` targets):
  - `npm test` (`tsc && vitest run`) is the gate before every commit;
  - `npx vitest run <file>` for one file; `npx vitest run --project domain`;
  - `npm run simulate -- <flags>`: each run its own `--out` under `logs/` (gitignored). **Never run two campaign simulations at once.** A 500-campaign run takes about five minutes alone.
- **The refactor guard.** `scripts/simulate.test.ts`, `describe('the refactor guard')`: 5 campaigns from seed 1 with `--parties 1`, each `CampaignRecord` and a SHA-256 of every battle event, against `GUARD_RECORDS`. Shape and rules: `.claude/skills/yomi-balance/guards.md`. **Step 07 re-records the fixture once** (new record fields; play moved by partners as sources, contact detours, routes, raiders, tower errands and Lodge 3), with the old and new figures in the doc comment above `GUARD_RECORDS`, and records its new 50-campaign hash.
- **The 50-campaign check:**

  ```sh
  npm run simulate -- --campaign --battles 50 --seed 1 --parties 1 --out logs/guard-50.jsonl > logs/guard-50.txt
  shasum -a 256 logs/guard-50.jsonl
  ```

- **The early-game figure.** Stage 7 ended at 239 of 500 with `--parties 1` and 239 with the default company; step 01 re-measured the stage's baseline (see `log.md`). Step 08 measures the 500-campaign figures. A move of more than about 5 points must be explained in the commit and in CLAUDE.md's rules of scaling, or retuned away; the user's bands (`.claude/skills/yomi-balance/bands.md`) are never changed.
- **Determinism.** No step adds, drops or reorders a draw of the world RNG or a battle's RNG. Roads, security, income and raids draw no RNG. Every new choice in the policy breaks ties by a fixed order (locations order, contact order, board index), never by `Math.random`. The waiting twin runs its own world and must not touch the campaign's game, RNG or battle ids.
- **Import cycles.** `trade.ts` imports `blight.ts`, `territory.ts`, `worldMap.ts` and `buildings.ts`; `territory.ts` and `blight.ts` import it back. The simulator imports `trade.ts` like any domain module; nothing it adds may run domain code at module load.
- **Commits.** One commit for this step once `npm test` passes, on `long-campaign-stage-08` or on this step's worktree branch (merged by the orchestrator), without pushing; files staged by path. Message "Stage 8 step 07: the simulator's trade". No attribution lines.
- **Docs.** CLAUDE.md files stay current: fix the lines this change makes wrong and search the CLAUDE.md files, `.claude/` and `docs/reference/` for every name removed (`SIM_PARTNERS`, `SIM_LODGE_CAP`).

## 3. Dependencies and prerequisites

- **Step 03** (and through it 01 and 02) must be done. **May run in its own worktree in parallel with steps 05 and 06**: it touches only `scripts/` (and `scripts/CLAUDE.md`, `docs/reference/simulator.md`, `.claude/skills/yomi-balance/`, the plan's `log.md` and this task file). Steps 05 and 06 touch `src/scenes/`, `src/testHook.ts`, `e2e/` and the manual, so no file overlaps; the index's task table is the only shared file (update your row only).
- **Step 04** (sprites) does not matter here.

### Contracts consumed (copied unchanged from the index)

**C1. Partners, contact and silence (step 01)**

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

// src/game/blight.ts
export const PARTNER_STRENGTH = 3   // sources(): every partner location a clean source of this, silent or not
// WorldEvent gains:
//   | { type: 'partner_contacted'; partner: string; name: string; home: string }   // home: the encampment's name
//   | { type: 'partner_silent'; partner: string; name: string }
//   | { type: 'partner_restored'; partner: string; name: string }

// src/game/territory.ts: sites(world) returns only 'encampment' and 'resource' locations (partners excluded)
// src/game/worldMap.ts: isNotable(partner_silent) is true
// src/game/save.ts: SAVE_VERSION = 28, no migration (decision 15: older saves unreadable); the strict check covers partners (kind, a Material good),
//   contacted and silent (ids of partner locations), routes (TradeRoute's shape, partner a location id) and routesOpened
// src/scenes/WorldScene.ts: LOCATION_SPRITES.partner = 'map_resource' (temporary, for tsc; step 05 draws the partner sprites)
// scripts/simulate.ts (temporary, removed in step 07):
export const SIM_PARTNERS: readonly PartnerLocation[] = []   // every simulated world (campaigns and the waiting twin) is newWorld(seed, undefined, SIM_PARTNERS)
```

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

### Contract produced (copied unchanged from the index)

**C7. The simulator's trade (step 07)**

```ts
// scripts/simulate.ts
// SIM_PARTNERS and SIM_LODGE_CAP are removed: every simulated world has PARTNERS
export const CONTACT_DETOUR = 8
export function contactErrand(world: WorldState, party: Expedition, skip?: ReadonlySet<string>): PartnerLocation | null
//   the nearest uncontacted partner within CONTACT_DETOUR of the party, none of `skip` (Plan.contactsTried), once routeLimit(world) > 0 (trading post 4)
//   and when no held site is threatened; ties in locations order
export const TOWER_ERRAND_RADIUS = 6
export function towerErrand(world: WorldState, party: Expedition): Hex | null
//   if the stock affords TOWER_COST: the nearest hex within TOWER_ERRAND_RADIUS of the party with towerHexRefusal null that lies within
//   GUARD_RADIUS of a hex of an open road at level 1 or 2 with no watchtower within GUARD_RADIUS; ties by board index
export function routeRaiders(world: WorldState): MonsterLocation[]   // raiders() of every open route, once each, in route order
// Phases gain 'contact' (the vanguard's walk to contactErrand's partner, from 'choose', back to 'choose' on arrival)
//   and 'road_tower' (the walk to towerErrand's hex from 'tower', then a tower act if canBuildTower); 'tower' prefers the errand
// nextTarget and the guard's defend branch: after the threatened sites, the nearest routeRaiders() nest the party is up to (not taken)
// visitFacilities: after the infirmary, open routes to every contacted partner while openRouteRefusal says null, shortest road first
//   (ties in contact order); then the Lodge, to 2, or 3 once world.routes is not empty (decision 12)
// materialNeeds: LODGE_COSTS up to that cap; ROUTE_TIMBER for each free slot while a contacted partner has no route
// CampaignRecord gains:
partnersContacted: number
routesOpened: number          // route_opened events
routesRaided: number          // raid runs: route_raided with days 1
routesAbandoned: number
// goldBySource gains routes: number (gold from yields with source 'route')
// The summary prints partners contacted, routes opened, raided and abandoned (averages), and routes in gold by source.
```

### Existing code (at `42cde46`, before steps 01–03)

All in `scripts/simulate.ts` unless named; line numbers are approximate and will have shifted after steps 01 and 03.

- **The holds to remove.** Step 01 adds `SIM_PARTNERS` and makes every simulated world `newWorld(seed, undefined, SIM_PARTNERS)`: in `startCampaign` (~995, whose default `game = newGame(startingParty(args), null, seed)`) and in `waitingIncome` (~1730, the waiting twin's world). Step 03 adds `SIM_LODGE_CAP`, read by `visitFacilities` (where `while (raiseLodge(game, party) === null);` runs last of the buildings) and `materialNeeds` (`LODGE_COSTS.slice(world.lodge, …)`). Read what steps 01 and 03 actually wrote (their execution records and the code) and remove both, so every simulated world is the default `newWorld` with `PARTNERS`. The twin must stay the campaign's own world from the same seed, so it also has partners (it never contacts them: its company stays at home).
- **`decide`** (~1045), the vanguard's (and a lone party's) policy: phases `start` → `home` → `hall` → `choose` (`nextTarget(world, party, args.readyLevel, takenTargets(run, party))`, then `walk(plan, 'target', …)`) → `target` → `fight`, then `afterBattle`. The contact detour goes at `choose`, before `nextTarget`.
- **`afterBattle`** (~1115), shared by the vanguard and a guard: `fight` → `won` → `tower` (`canBuildTower(world, party) === null` builds a tower where the party stands, `{ kind: 'act', action: { kind: 'tower' } }`) → `improve` → `build` → `craft` → `crafted` → `heal` → `camp`. The road tower errand goes at `tower`, before the tower-here rule.
- **`walk(plan, phase, to)`** and **`walking(world, party, plan)`** (true arrived, false given up, `'go'` a fresh travel order wanted): the pattern every walking phase uses (see `build`).
- **`Phase`** (~896) and its doc comment; **`AFTER_BATTLE`** (~1375), the set of phases `decideGuard` hands to `afterBattle`: `'road_tower'` belongs in it (it comes after a battle); `'contact'` does not (it is the vanguard's `decide` only).
- **`nextTarget`** (~860): the Source when ready; else the nests the party is up to (`upTo`, threat ≤ its lowest level, at least 1, not taken); the threatened held sites sorted by `daysToFall`, each returning the `upTo` nest pushing hardest on it; else the nearest of `upTo` (or of all nests). Raiders go after the threatened loop, before the nearest.
- **`guardChoice`** (~1238): reinforce; home to refill; `defend` (the threatened sites' loop over the guard's `nests`, sorted `byId`); `train` (nearest nest); `garrison`; `home`. Raiders join `defend` after the threatened loop, before `train`.
- **`visitFacilities`** (~757): sells baggage and surplus materials (`materialNeeds`), then raises the trading post, the workshop, the infirmary, then the Lodge, then gear, runes, crafts, the shrine. Routes go after the infirmary and before the Lodge.
- **`materialNeeds`** (~657): what the stock keeps rather than sells.
- **`tally`** (~1387): counts world events into the record; `goldBySource` today counts `market` or else `sites`. A route's gold must go to `routes`, not `sites`.
- **`CampaignRecord`** (~355), its literal in **`startCampaign`** (~995), **`finishCampaign`** (~1687), **`summarizeCampaigns`** (~2108, `goldBySource` averages at ~2145) and the printed summary in `main` (~2218).
- **`yieldValue`** already counts every `yield`, so route gold and goods enter `incomePerDay` with no change.
- Domain (from steps 01–03): `trade.ts` (`partners`, `isContacted`, `routeLimit`, `roadTo`, `openRouteRefusal`, `openRoute`, `raiders`, `GUARD_RADIUS`, `ROUTE_TIMBER`), `buildings.ts` (`towerHexRefusal`, `canBuildTower`, `TOWER_COST`, `canAfford`, `raiseLodge`), `blight.ts` (`blightAt`, `boardIndex`).

## 4. Scope and guidance

1. **Baseline first.** Before any change, run the 50-campaign check on the branch as it stands after step 03 (it must match step 01's baseline in `log.md`; if not, stop and report) and keep the hash for the comparison below.
2. **Remove the holds.** Delete `SIM_PARTNERS` and `SIM_LODGE_CAP` and their uses; every simulated world (campaigns and the twin) is the default `newWorld`. Search the repository for both names (`grep -rn "SIM_PARTNERS\|SIM_LODGE_CAP" src scripts docs .claude`) and fix every mention.
3. **The contact detour** (decision 13). `CONTACT_DETOUR` and `contactErrand` as C7. "No held site is threatened": no id in `world.threatened` that is a held site (towers in `threatened` do not count). In `decide`'s `choose` phase, before `nextTarget`: if `contactErrand` gives a partner, `walk(plan, 'contact', partner.position)`; the `contact` phase walks (`'go'` → a travel order; given up → back to `choose`, as an unreachable partner must not end the campaign) and on arrival returns to `choose`. Contact itself happens in the world's day (`partnerDay`), so arriving is enough; check `isContacted` in a test. A partner contacted on the way drops out of `contactErrand` by itself. Guards do not detour.
4. **Routes opened at home** (decision 12; `roadTo` keeps clear of `RAID_RADIUS` where it can, decision 6, the user's, so the route counts, lengths and raids measured reflect that). In `visitFacilities`, after the infirmary: the contacted partners (`world.contacted` order) with `openRouteRefusal(game, party, id) === null`, sorted by `roadTo` length, ties in contact order; open them one by one (`openRoute`), re-checking the refusal each time (the stock and slots change), and add each returned `route_opened` event to what the run tallies (the record's `routesOpened`). Then raise the Lodge while `raiseLodge` says null and `world.lodge` is below the cap: 2, or `MAX_LODGE_LEVEL` (3) when `world.routes.length > 0`. Export a small helper for the choice (for example `routeChoices(game, party): string[]`, the openable partner ids in the order tried) if it makes the test simpler; its name is yours.
5. **`materialNeeds`.** The Lodge's costs up to the same cap as step 4; and `ROUTE_TIMBER` timber for each free slot (`routeLimit(world) - world.routes.length`, at least 0) while some contacted partner has no route, so the party does not sell the timber a route needs. Gold is not kept by `materialNeeds` (it never sells gold).
6. **Raiders weighed** (decision 13). `routeRaiders` as C7 (one place, exported, tested). In `nextTarget`, after the threatened-site loop: among `upTo`, the `routeRaiders` nests, nearest to the party first (ties in `routeRaiders` order); if any, return it. In `guardChoice`, after the threatened-site loop: among the guard's `nests` (threat ≤ its level, not taken, not the Source), the `routeRaiders` nest nearest to the guard (ties `byId`) as `{ kind: 'defend', target }`. The Source is never a raider target.
7. **The road tower errand** (decision 9). `TOWER_ERRAND_RADIUS` and `towerErrand` as C7: candidate hexes on the board within the radius of the party whose `towerHexRefusal` is null; keep those within `GUARD_RADIUS` of some open road hex at level 1 or 2 that has no watchtower within `GUARD_RADIUS` (parties do not count: they leave); nearest to the party, ties by `boardIndex`. In `afterBattle`'s `tower` phase: if `towerErrand` gives a hex and it is not where the party stands, `walk(plan, 'road_tower', hex)`; `road_tower` walks and, arrived, acts `{ kind: 'tower' }` if `canBuildTower` says null, then goes on to `improve`; given up, goes on to `improve`. If the errand's hex is where the party stands, build there. Otherwise today's rule (a tower where the party stands if one can go there). Keep the scan cheap: only when `world.routes` is not empty, and over the hexes within the radius, not the whole board.
8. **The record** (C7). Add the fields to `CampaignRecord` (with doc comments), the literal in `startCampaign`, and `goldBySource.routes`. In `tally`: `partner_contacted` → `partnersContacted`; `route_raided` with `days === 1` → `routesRaided`; `route_abandoned` → `routesAbandoned`; a gold `yield` with `source: 'route'` → `goldBySource.routes`. `routesOpened` counts the `route_opened` events `visitFacilities` returns (they come from the encampment, not the day loop; make sure they reach the record once each, and check against `world.routesOpened` at the end in a test).
9. **The summary.** `summarizeCampaigns` averages the four counts and `goldBySource.routes`; the printed summary shows a trade line (for example "Trade: 1.4 partners contacted; routes 0.6 opened, 0.2 raided, 0.0 abandoned a campaign") and routes in the gold-by-source line. Wording is yours; keep it to a line or two.
10. **Tests** in `scripts/simulate.test.ts`, on small hand-built worlds (`newWorld` plus edits, as the existing `improveErrand` and `nextTarget` tests do), each deterministic:
    - `contactErrand`: the nearest uncontacted partner within 8; none beyond 8; none once contacted; none while a held site is threatened; a tie in locations order.
    - the vanguard walks to a partner at `choose` and back to choosing a nest once contacted (a `decide` sequence, as the existing phase tests drive it).
    - `towerErrand`: a clean hex guarding an unguarded tainted road hex is chosen; none when the hex is already guarded by a tower, when no route is open, when the stock cannot afford `TOWER_COST`, or when the only candidates are refused by `towerHexRefusal`; the tie by board index.
    - `routeRaiders`: every raider of every route once, in route order.
    - `nextTarget` weighs a raider after a threatened site's pusher and before a nearer non-raider nest; a raider above the party's level is not chosen; `guardChoice` defends against a raider before training.
    - the route-opening choice: shortest road first, a refused partner skipped, slots respected, the Lodge raised to 3 only once a route is open (and to 2 without one).
    - `materialNeeds` keeps `ROUTE_TIMBER` per free slot while a contacted partner has no route, and none otherwise.
    - the record's tallies from a list of events (`partner_contacted`, `route_raided` days 1 and 2, `route_abandoned`, route yields of gold and of a good).
11. **Re-record the refactor guard once.** Run `npx vitest run scripts/simulate.test.ts -t "refactor guard"`, expect it to fail, and confirm the moves are this step's (new fields; partners as clean sources from day 1, which change the land and so the spawns; contact detours; routes and Lodge 3 if any of the 5 campaigns reaches trading post 4). Re-record `GUARD_RECORDS` and the event hash, and write the old and new figures (outcomes, days, battles, spawns and the new trade fields of the 5 campaigns) in the doc comment above `GUARD_RECORDS`.
12. **The 50-campaign check** after the change; record in `log.md` (a dated line under a "Step 07" heading): the hash before and after, Source wins of 50, average days, and the new trade averages (partners contacted, routes opened, raided, abandoned, route gold). Run it alone, never beside another simulation. If the Source wins move by more than about 5 of 50 from the baseline, say so in the record with the cause as far as you can tell; retuning is step 08's.
13. **Docs.** `scripts/CLAUDE.md` (if a line becomes wrong), `docs/reference/simulator.md` (the contact detour, routes opened at home, the Lodge to 3, raiders in `nextTarget` and the guard's defend, the road tower errand, the record's new fields and the summary's trade line; remove the holds' mention), `.claude/skills/yomi-balance/levers.md` (add `ROAD_STRENGTH`, `RAID_RADIUS`, `ABANDON_AFTER` and `CONTACT_DETOUR`, `TOWER_ERRAND_RADIUS` as levers, with what each moves), and `bands.md` / `running.md` only where a statement becomes wrong (never change a band).
14. **Exclusions:** no domain rule changes (if a rule looks wrong, report it rather than change it); no scene, manual or sprite work; no 500-campaign measurement (step 08); no change to the order of the works, forts or market levels in `visitFacilities` (stage 12).

## 5. Verification

- `npm test` passes, the re-recorded refactor guard included.
- `npx vitest run scripts/simulate.test.ts` passes, with the new tests listed in §4.10.
- `grep -rn "SIM_PARTNERS\|SIM_LODGE_CAP" src scripts docs .claude` finds nothing.
- The 50-campaign check, before and after, as in the shared constraints; its figures and hashes recorded in `log.md` and the execution record.
- The printed summary of the 50-campaign run shows the trade line and routes in gold by source (quote it in the record).

## 6. Completion criteria

- [ ] `SIM_PARTNERS` and `SIM_LODGE_CAP` are gone; every simulated world has Millbrook and Saltmere.
- [ ] `contactErrand`, `towerErrand`, `routeRaiders`, `CONTACT_DETOUR` and `TOWER_ERRAND_RADIUS` as C7, with the `contact` and `road_tower` phases; routes opened in `visitFacilities` after the infirmary; the Lodge to 3 once a route is open; `materialNeeds` keeps route timber.
- [ ] `nextTarget` and the guard's defend branch weigh raiders after threatened sites.
- [ ] `CampaignRecord` has `partnersContacted`, `routesOpened`, `routesRaided`, `routesAbandoned` and `goldBySource.routes`; the summary prints them.
- [ ] The tests of §4.10 pass; `npm test` passes.
- [ ] The refactor guard re-recorded once, with old and new figures in the doc comment above `GUARD_RECORDS`.
- [ ] The 50-campaign check's before and after hashes and figures in `log.md` and the execution record.
- [ ] `scripts/CLAUDE.md`, `docs/reference/simulator.md` and `.claude/skills/yomi-balance/levers.md` current.
- [ ] One commit, "Stage 8 step 07: the simulator's trade", no attribution lines, files staged by path; the index's row 07 updated with status and commit.

## 7. Execution record

**First pass** (2026-11-22, worktree branch `long-campaign-stage-08-sim` from `00a40ff`): blocked on a balance decision, nothing committed.

- C2 re-synced from the index (the refusal-words line was missing from this file's copy).
- Built as §4 says, uncommitted in the worktree: the holds gone (every simulated world, campaigns and the twin, is `newGame`'s default world with `PARTNERS`); `CONTACT_DETOUR`, `contactErrand(world, party, skip?)` (the optional `skip`, fed from a new `Plan.contactsTried`, keeps a partner the walk reached or gave up on from being sought again, which would otherwise loop), the `contact` phase; `routeChoices`, `lodgeCap`, routes opened in `visitFacilities` after the infirmary, the `route_opened` events carried on `Trade.events` and tallied by `carryOut`; `materialNeeds` with the Lodge to `lodgeCap` and route timber; `routeRaiders` in `nextTarget` and `guardChoice`; `TOWER_ERRAND_RADIUS`, `towerErrand`, the `road_tower` phase (in `AFTER_BATTLE`); the record's four counts and `goldBySource.routes`; `tradeLine` in the summary. 16 new tests (§4.10) pass; every other test passes; only the refactor guard fails, not yet re-recorded. Docs: `docs/reference/simulator.md`, `.claude/skills/yomi-balance/levers.md`; `scripts/CLAUDE.md` needed no change.
- 50-campaign check before: SHA-256 `1ceefe63...74400d1`, identical to step 01's baseline (23 of 50, 294 days).
- **The early-game figure moved far out of band.** 50-campaign check after: SHA-256 `aa837343...191796`, 35 of 50, 375 days, 25.8 battles, 1.54 partners contacted, no route opened. `one` (500, seed 1, `--parties 1`): **304 of 500** (band 215 to 250; baseline 239), **359 days** (band 243 to 297), 24.8 battles, 1.2 heroes dead, 1.56 partners contacted, routes 0 opened. Logs `logs/s8-07A-one.*`, `logs/guard-50*`.
- Cause, by diagnostic 50-campaign runs (not kept): partners as clean sources with no detour give 22 of 50 (`CONTACT_DETOUR` set below 0); the full step gives 35; picking the nest before the detour and walking to it after contact gives 31; the detour only while `routeLimit(world) > 0` gives 22 (0.5 partners contacted, as without a detour). So the contact detour alone moves the early game: no route opens (the post stays at 1 or 2), so `ROAD_STRENGTH`, `RAID_RADIUS` and `ABANDON_AFTER` cannot retune it. Its walks add days and move the vanguard before its next nest; in campaign 4, for one, the party that died at the bandit camp on day 29 instead walks to Millbrook after the kobold diggers and fights two threat-2 nests near it first.
- Decision needed: gate the detour on routes being possible, accept the move, or another rule.

**Second pass** (2026-11-22, the user's decision, option 1): the detour runs only once the trading post allows routes.

- `contactErrand` returns null while `routeLimit(world)` is 0 (decision 13 and C7 above reworded; `skip` and `Plan.contactsTried` accepted as a C7 change). Two tests (none below post 4 at each of levels 1 to 3; the vanguard chooses its nest at once below post 4) fail with the gate removed and pass with it; the other contact tests set the post to 4.
- The refactor guard re-recorded once (old and new figures in the doc comment above `GUARD_RECORDS`): no route opens in the five campaigns, so the move is the partners' land as clean sources from day 1 (and 1, 1, 1, 0, 0 contacts made on the way): days 390, 385, 310, 423, 29 became 457, 383, 331, 346, 29; outcomes four Source and one fallen became three and two. Events SHA-256 `e638f2a4...6f1180`.
- 50-campaign check after: SHA-256 `b50f7b50626d6e2832deb18c44a808b9be0521002698dc97c1fa8216db904e52`, 22 of 50 (baseline 23), 281 days (294), 0.50 partners contacted, no route.
- Measured through `yomi-measure`, 500 campaigns, seed 1, one at a time (logs `logs/s8-07-{one,company,rl10}.*`; 335 s, 499 s, 960 s):

  | Run | Source wins | Mean days | Partners contacted | Routes opened | Route gold |
  | --- | --- | --- | --- | --- | --- |
  | `one`, baseline | 239 | 286 | — | — | — |
  | `one` | 233 (band 215 to 250) | 284 | 0.47 | 0.00 | 0 |
  | `company`, baseline | 239 | 286 | — | — | — |
  | `company` | 232 (band 220 to 260) | 285 | 0.47 | 0.00 | 0 |
  | `rl10`, baseline | 434 | 509 | — | — | — |
  | `rl10` | 433 (370 to 420, accepted up to 445) | 509 | 0.54 | 0.03 | 1 |

  Heroes dead 1.2 (`one`; at most 2.0). The early game moved 6 and 7 of 500, just past "about 5": with no detour and no route in it, the cause is the partners' land (clean sources of `PARTNER_STRENGTH`, step 01's rule) reshuffling where the blight and the spawns fall, a seed-for-seed reshuffle the size of the 500-campaign sampling spread (about 11 wins); the 50-campaign check moved 1. No design lever (`ROAD_STRENGTH`, `RAID_RADIUS`, `ABANDON_AFTER`) touches it, since no road exists.
- For step 08: at `--ready-level 10` routes barely open (0.03 a campaign, route gold 1): the trading post rarely reaches 4 under the untouched spend order (stage 12's), so the completion criterion "routes opened, raided sometimes, route gold a visible share" is not met by the simulator as it stands; that is step 08's call to report.
- `npm test`: 100 files, 2,489 tests pass. `grep -rn "SIM_PARTNERS\|SIM_LODGE_CAP" src scripts .claude docs/reference` finds nothing (only the plan's own history files name them).

**Review round 1** (2026-11-22): the review confirmed the code, tests, guard re-record and the attribution; its blocking item (the `log.md` and index records) is held by the orchestrator until after the merge. Fixed: N2, the `contact` phase goes back to `choose` when its partner was contacted on the way or a held site is threatened (test fails without the fix); N3, `guardChoice`'s local `raiders` renamed `raidingNests` (it shadowed the trade.ts import); N4, the contact test asserts null exactly (Saltmere is 14 hexes off); N5, a double space in `docs/reference/simulator.md` and the ungated baseline in `levers.md` (23, not 22). Disputed: none. `npm test` 100 files, 2,490 tests pass; the guard records and the 50-campaign hash (`b50f7b50...904e52`) are unchanged.
