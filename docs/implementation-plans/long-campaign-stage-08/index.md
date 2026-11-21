# Implementation plan: long campaign, stage 8 (trade partners and routes)

Two neutral **trade partners**, Millbrook (timber) and Saltmere (salt), stand on today's map. The party **contacts** one by stepping on it; a partner falls **silent** while its hex is at `LOSS_LEVEL` or worse and wakes when it is clean. From trading post level 4 the post opens **routes** to contacted partners: a fixed road from the encampment that pays gold every yield day by its length and its **security** (clean, guarded by a watchtower or a party, tainted, or worse), and the partner's good every second yield day. A route is **raided** when its partner is silent, a road hex is corrupted, or a nest stands within `RAID_RADIUS`; raided for `ABANDON_AFTER` yield days in a row, it is **abandoned**. At Builders' Lodge level 3, open roads are weak clean sources in the blight's contest. The world map draws the roads by security, the trading post gains a Routes tab, and the simulator contacts, opens and protects routes.

**Source design:** [`docs/designs/long-campaign/stage-08-trade-routes.md`](../../designs/long-campaign/stage-08-trade-routes.md) (status "ready for planning"). It cuts from [`reference/economy-and-trade-routes.md`](../../designs/long-campaign/reference/economy-and-trade-routes.md) §4.3–§4.6 and §5 (partners, routes, raids, roads; economy R5–R10, A4–A8) and [`reference/multiple-parties.md`](../../designs/long-campaign/reference/multiple-parties.md) R10 and A8 (parties guard roads). Conventions: [`docs/designs/long-campaign/index.md`](../../designs/long-campaign/index.md). Previous stage: [stage 7's plan](../long-campaign-stage-07/index.md). Feature record: [`docs/features/long-campaign-stage-08.md`](../../features/long-campaign-stage-08.md). History: [`log.md`](log.md). Written against `42cde46` on branch `long-campaign-stage-08`.

## Decisions taken for the orchestrator

The plan follows the stage design, then the reference, then the code (where they disagree, the code is right, per the stages index). None of these changes the approved design or a band. **Items 5, 9, 12 and 15 shape what the player or the simulator sees and are worth the user's eye before steps 05–07.**

1. **Signatures follow the code's patterns.** `openRouteRefusal(game, party, partnerId)` and `openRoute(game, party, partnerId)` take the party (every encampment action checks `atEncampment`), and `openRoute` is the time-free apply that assumes its refusal said null and returns the `route_opened` event (as `raiseImprovement` does). `routeSecurity` and `routeIncome` take a road (`readonly Hex[]`) and the presences, not a route, so the Routes tab can preview a road not yet opened; `raidCause` takes `{ partner, road }`.
2. **Contact and silence are daily, in a new `partnerDay`.** The design names `contactPartner` "called from the travel step"; the plan instead contacts in the world's day (`updateTerritory` calls `partnerDay`), for every presence standing on an uncontacted partner's hex. Each walked hex ends a day with the party on it, so this is the same for walking and covers garrisons and debug moves too. `contactPartner(world, id)` stays exported for `partnerDay` and the debug console. Contact is not notable (the design's `isNotable` list leaves it out); its line shows in the day's events like a capture.
3. **Silence is tracked for every partner, told only for contacted ones.** `WorldState.silent` holds the partners silent now (entered at `LOSS_LEVEL`, left at 0). `partner_silent` and `partner_restored` are emitted only for contacted partners. A partner is a clean source of `PARTNER_STRENGTH` (3) whether silent or not: it is never lost, and its strength never changes, so the fields memo is untouched by silence.
4. **Partners' goods.** The stage design lists only gold, but cites economy R7, which pays 1 of the partner's good every second yield day when security is at least ½. The plan pays it: on a yield day whose `world.turn / YIELD_DAYS` is even, from the world's turn (no new state). Its `yield` event has `source: 'route'`.
5. **Raid messages and repeats** (for the user's eye). `route_raided` is emitted on every raided yield day, carrying `days` (the run's count, 1 on the first). Only `days === 1` is notable and has a message line ("Raiders on the Millbrook road: the Goblin Brood."); later days describe as `''` (economy R9: told once when raided and once when restored). On the sixth raided day the event is followed by `route_abandoned`, and the route is removed (its slot freed).
6. **The road** is `reachableHexes` from the encampment over the board, every monster location's hex and its neighbours impassable (all monsters, sighted or not: the rules run on the true state, `vision.ts` is knowledge only), the partner's own hex always passable. That breadth-first search is deterministic with ties broken by neighbour order; the design's "`hexKey` tie-breaks" is read as "deterministic for a seed", which it is. The world map has no movement costs (a hex a day), so length is the hex count. The road excludes the encampment's hex and includes the partner's.
7. **The road's figures in design §4 are illustrative.** On today's map Millbrook's road is 14 hexes (cost 27 gold and 10 timber, about 2 gold a yield day when clean), not 26; Saltmere's is 30. Tests use the formulas, not §4's numbers.
8. **The preview's income counts towers, not parties.** The Routes tab and the road tooltip's "about N gold every 5 days" use `routeIncome(world, road, [])`, so the party standing at home does not inflate it; the map's overlay and the real yields count every presence.
9. **Watchtowers keep needing clean land** (for the user's eye). The design's play script says "build a watchtower on a tainted road hex", and its simulator "towers preferred on unguarded tainted road hexes"; the code refuses a tower on any land above 0 (`towerSiteRefusal`), and the code is right. Both are read as "a watchtower within `GUARD_RADIUS` of a tainted road hex": the play script's step 5 builds on clean land beside the stretch, and the simulator's tower errand walks to a clean hex that guards an unguarded tainted or blighted road hex.
10. **The road overlay** colours each segment by its far hex's security, live: gold (`1`), amber (`½`), red (`0`); a route that `raidCause` says is raided today is red throughout, so the road turns red the day a nest spawns beside it, while the event and the lost income come on the next yield day. Roads are the company's own and are drawn through the fog. The road tooltip is lines in the existing hover info panel (`hexInfo`), not a new tooltip.
11. **The Routes tab's open routes** show security, expected income now (decision 8's figure) and the raided count, not "last income" (which would need new saved state). The tab is always present; below trading post 4 it says why routes cannot open. It lists contacted partners only, in contact order.
12. **The simulator's Lodge reaches 3** (for the user's eye). The stage design's simulator list does not say; the reference (§5.4) raises the Lodge "when routes are possible". The plan raises it to 2 as today and to 3 once a route is open, so roads are measured. Routes are opened in `visitFacilities` after the infirmary and before the Lodge; the order of the works, forts and market levels is untouched (carried forward to stage 12).
13. **The simulator's contact detour** is the vanguard's (and a lone party's) only, at its `choose` phase: the nearest uncontacted partner within `CONTACT_DETOUR` (8) hexes of the party (the reference's "of its path" read as "of the party"), when no held site is threatened. Raiders are weighed after threatened sites and before the nearest nest, nearest raider first, in both `nextTarget` and the guard's defend branch.
14. **Determinism through step 06.** Steps 01–06 must not move the refactor guard or the 50-campaign check. The simulator builds its worlds without partners (`SIM_PARTNERS`, temporary, step 01) and keeps the Lodge at 2 (`SIM_LODGE_CAP`, temporary, step 03), so no simulated campaign has a partner, route or road until step 07, which removes both holds and re-records the fixture once.
15. **Saves migrate** (for the user's eye). `SAVE_VERSION` 27 → 28 in step 01, one bump for the stage (contacts, silence, routes and the partner locations together). The stages index says a stage "migrates where it can"; this one can, cheaply, so `migrateFrom27` adds empty `contacted`, `silent`, `routes`, `routesOpened: 0` and the two partners (each only if no location stands on its hex), keeping the chain from 18 readable. The land around them is not reseeded; their strength pushes from the next day.
16. **Routes pay nothing once the encampment is lost** (`tradeDay` returns nothing when `world.status === 'lost'`). The market's payment on the day of the fall (stage 7's note) is left as it is.
17. **Sounds reuse cues**, no new sound: `route_raided` (days 1), `partner_silent` → `world.threatened`; `route_abandoned` → `world.lost`; `route_restored`, `partner_restored` → `world.captured`; `partner_contacted`, `route_opened` → `world.build`.
18. **Debug commands for the play script and the in-browser tests:** `spawn <goblin_raid|kobold_scouts|bandit_camp> [here | <location id> | <col> <row>]` places a nest by `SPAWN_KINDS` (exported from `blight.ts`) at the hex's `threatAt`, drawing no RNG; `contact <partner id | all>` contacts partners. `facility builders_lodge 3`, `facility trading_post 4`, `stock` and `days` exist; `days`' yield totals gain routes through `yieldSummary`.
19. **Out of scope:** the far partners and their rings (stage 9); partners' goods for sale at the Market Hall (stage 10); market income and the simulator's spend order for works, forts and market levels (stage 12, carried forward from stage 7); caravan battles on the road (reference non-goal).

## Scope and shared constraints

- **In:** S8-R1 to S8-R7, the design's tests (§6: economy A4–A8, company A8), its two simulator checks and its play script, the Lodge level 3 sprite redraw carried from stage 7, and the docs the stages index asks for.
- **Out:** decision 19.
- **Commands** (local Node 26: prefix `PATH=/opt/homebrew/opt/node@26/bin:$PATH`; or the podman `make` targets):
  - `npm test` (`tsc && vitest run`) is the gate before every commit;
  - `npx vitest run <file>` for one file; `npx vitest run --project domain`;
  - `npm run test:browser` (or `-- -t <name>`) after any scene change; read `e2e/CLAUDE.md` before adding an in-browser test;
  - `npm run simulate -- <flags>`: each run its own `--out` under `logs/` (gitignored). **Never run two campaign simulations at once.** A 500-campaign run takes about five minutes alone.
- **The refactor guard.** `scripts/simulate.test.ts`, `describe('the refactor guard')`: 5 campaigns from seed 1 with `--parties 1`, each `CampaignRecord` and a SHA-256 of every battle event, against `GUARD_RECORDS`. Shape and rules: `.claude/skills/yomi-balance/guards.md`.
  - **Steps 01–06 must not edit the fixture** and must keep it green. A mismatch means the step changed play: find the cause and fix it.
  - Steps 01–03 (domain) also run the **50-campaign check** before committing, against step 01's baseline, and record "identical" or the diff:

    ```sh
    npm run simulate -- --campaign --battles 50 --seed 1 --parties 1 --out logs/guard-50.jsonl > logs/guard-50.txt
    shasum -a 256 logs/guard-50.jsonl
    ```

    It must be identical (decision 14). Steps 04–06 change no rule and need not run it (say so).
  - **Step 07 re-records the fixture once** (new record fields; play moved by partners as sources, contact detours, routes, raiders, tower errands and Lodge 3), with the old and new figures in the doc comment above `GUARD_RECORDS`, and records its new 50-campaign hash.
- **The early-game figure.** Stage 7 ended at 239 of 500 with `--parties 1` (`--ready-level` 7, seed 1) and 239 with the default company. **Step 01 re-measures both on the branch before any change**, and the company at `--ready-level 10`; that is the stage's baseline. Step 08 measures again. A move of more than about 5 points must be explained in the commit and in CLAUDE.md's rules of scaling, or retuned away (design §7: `ROAD_STRENGTH` if roads tip the blight; `RAID_RADIUS` and `ABANDON_AFTER` if the party is pulled back to defend roads). The user's bands (`.claude/skills/yomi-balance/bands.md`) still hold and are never changed.
- **Determinism.** No step adds, drops or reorders a draw of the world RNG or a battle's RNG. Roads, security, income and raids draw no RNG. New territory events come after the day's existing ones (partners after the market's yield, routes after the partners), so a day's existing events keep their order.
- **Import cycles.** `trade.ts` imports `blight.ts`, `territory.ts`, `worldMap.ts` and `buildings.ts`; `territory.ts` and `blight.ts` import it back. Safe only while nothing calls across at module load; add `trade` to the cycle lists in the root and `src/game/` CLAUDE.md files.
- **Versions.** `SAVE_VERSION` 28 in step 01 (decision 15). `LOG_SCHEMA_VERSION` is unchanged: world events are not in the battle log.
- **Content.** New content follows `.claude/skills/yomi-add-content/`: `location-kind.md` (partners, step 01 and 05), `debug-command.md` (step 06), `facility.md` (the Lodge's level 3 text, step 03). Sprites follow `.claude/skills/yomi-sprites/` (`art/CLAUDE.md`, `docs/designs/sprite-drawing-guidance.md`); never edit an exported PNG; `npm run sprites` then `npm run sprites:check`, then the `yomi-asset-check` agent. Manual: `.claude/skills/yomi-manual/`. Balance: `.claude/skills/yomi-balance/`; measurements through the `yomi-measure` agent where a step says so.
- **Commits.** One commit per step once `npm test` passes (and the guard holds), on `long-campaign-stage-08`, without pushing; files staged by path. A step run in a worktree commits on its own branch, merged into the stage branch by the orchestrator. Messages "Stage 8 step NN: <title>". No attribution lines.
- **Docs.** CLAUDE.md files stay current: each step fixes the lines its change makes wrong and searches them, `.claude/` and `docs/reference/` for every name it renames or removes (`LODGE_LEVEL_LIMIT`, `ROADS_REFUSAL`, `SIM_PARTNERS`, `SIM_LODGE_CAP`, …). Scene steps update the manual's text for their screens; step 08 retakes the screenshots, updates `docs/reference/`, and writes the stage's implementation notes.

## Contracts

Task files copy these unchanged. "Existing" means at `42cde46`.

### C1. Partners, contact and silence (step 01)

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
// src/game/save.ts: SAVE_VERSION = 28; migrateFrom27 (decision 15); the strict check covers partners (kind, a Material good),
//   contacted and silent (ids of partner locations), routes (TradeRoute's shape, partner a location id) and routesOpened
// src/scenes/WorldScene.ts: LOCATION_SPRITES.partner = 'map_resource' (temporary, for tsc; step 05 draws the partner sprites)
// scripts/simulate.ts (temporary, removed in step 07):
export const SIM_PARTNERS: readonly PartnerLocation[] = []   // every simulated world (campaigns and the waiting twin) is newWorld(seed, undefined, SIM_PARTNERS)
```

### C2. Routes, raids and guards (step 02)

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
export function roadTo(world: WorldState, partnerId: string): Hex[] | null     // decision 6; null when no road
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

### C3. Roads and the Lodge's level 3 (step 03)

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

### C4. Sprites (step 04)

- `map_partner_village` (Millbrook, a farming village: thatched cottages, a granary or windmill, a strip of field) and `map_partner_port` (Saltmere, a fishing port on the coast: a quay, a boat, salt pans), each on the 24px `map` canvas with frame `base` and an `idle` animation, distinct at a glance from `map_encampment` and `map_resource`, and readable when tinted grey (silent).
- `camp_lodge/level_3` redrawn (stage 7's note: the milestone reads as a bottle, the paving is faint, the 2 → 3 step is weak at 1x): a clearly paved road and a milestone that reads as stone, a plain step up from `level_2`, same canvas, footprint and anchor.

### C5. The world map (step 05)

```ts
// src/scenes/roadsView.ts (new, Phaser-free, with tests)
export type RoadShade = 'secure' | 'tainted' | 'raided'
export const ROAD_COLORS: Record<RoadShade, number> = { secure: 0xffd54f, tainted: 0xffa726, raided: 0xe53935 }
export interface RoadSegment { route: string; from: Hex; to: Hex; shade: RoadShade }
export function roadSegments(world: WorldState, presences: readonly PartyPresence[]): RoadSegment[]
//   every open route, from the encampment's hex along its road; a route with a raidCause today is 'raided' throughout,
//   else each segment by hexSecurity of its `to` hex: 1 'secure', 0.5 'tainted', 0 'raided'
export function roadInfoLines(world: WorldState, presences: readonly PartyPresence[], at: Hex): string[]
//   for each open route whose road holds `at`: "The Millbrook road: security 75%, about 2 gold every 5 days." (income as decision 8),
//   and when raided today "Raided: <raidWords>."
export function raidWords(raid: { cause: RaidCause; raider?: MonsterLocation }, partner: PartnerLocation): string
//   raiders "the Goblin Brood is within 2 hexes" (theName, RAID_RADIUS; "are" for a plural name such as "the Goblin Raiders");
//   corrupted "the blight has overrun it"; silent "Millbrook is silent"
export function partnerInfoLines(world: WorldState, partner: PartnerLocation): string[]
//   "Trade partner: <good>."; "Not yet contacted: walk here to trade." | "Trades with <encampment name>." ; "Silent while the blight holds its land." when silent;
//   "Route open: security N%." when routed
// src/scenes/worldEvents.ts describeWorldEvent:
//   partner_contacted "Millbrook will trade with Oakvale."; partner_silent "Millbrook has fallen silent under the blight.";
//   partner_restored "Millbrook is trading again."; route_opened "A road is opened to Millbrook.";
//   route_raided (days 1) raiders "Raiders on the Millbrook road: the Goblin Brood." | corrupted "The blight has overrun the Millbrook road." |
//     silent "The Millbrook road is idle: Millbrook is silent."; (days > 1) '';
//   route_restored "The Millbrook road is safe again."; route_abandoned "The Millbrook road is abandoned.";
//   a route yield "The Millbrook road brings 2 gold."
// yieldSummary: a third part "routes 3 gold, 1 timber" (gold first), after sites and market
// src/scenes/sounds.ts: decision 17
// src/scenes/WorldScene.ts: a roads layer under the locations, dashed segments in ROAD_COLORS; LOCATION_SPRITES.partner = 'map_partner_village';
//   PARTNER_SPRITES: Record<string, string> = { millbrook: 'map_partner_village', saltmere: 'map_partner_port' } (a partner without one uses LOCATION_SPRITES.partner);
//   a silent partner's sprite and label tinted grey (0x9e9e9e / '#9e9e9e'); hexInfo adds partnerInfoLines and roadInfoLines
// src/testHook.ts WorldProbe gains:
roads: { route: string; shades: RoadShade[] }[]
partners: { id: string; contacted: boolean; silent: boolean; drawn: boolean }[]
```

### C6. The Routes tab and the debug console (step 06)

```ts
// src/scenes/routesTab.ts (new, Phaser-free, with tests)
export type RouteStatus = 'open' | 'raided' | 'closed'
export interface RouteRow {
  partner: string; name: string; good: Material; silent: boolean
  status: RouteStatus            // open (a route, not raided today), raided (a route with a raidCause today), closed (no route)
  road: Hex[] | null             // the open route's road, or roadTo's preview for a closed one (null when none)
  length: number | null
  income: number | null          // routeIncome(world, road, [])
  security: number | null        // routeSecurity(world, road, [])
  cost: Stock | null             // routeCost(length) for a closed one
  raidedDays: number
  refusal: string | null         // openRouteRefusal for a closed one, else null
  raid: string | null            // for a closed row with a road: what would raid it today (raidCause on the preview), in words, else null
}
export function routeRows(game: GameState, party: Expedition): RouteRow[]   // one per contacted partner, in contact order
export function routeOffer(row: RouteRow): string
//   "Open a route to Millbrook: 14 hexes, about 2 gold every 5 days, costs 27 gold, 10 timber"
//   (+ ". Raided at once: the Goblin Raiders are within 2 hexes" when row.raid; the cause words as roadInfoLines')
export function routeState(row: RouteRow): string
//   "Millbrook road: security 75%, about 2 gold every 5 days" (+ "; raided 2 yield days" when raidedDays > 0)
export function minimapPoints(board: BoardSize, road: readonly Hex[], from: Hex, rect: { x: number; y: number; width: number; height: number }): Point[]
// src/scenes/TradingPostScene.ts: Tab = 'buy' | 'sell' | 'routes'; a Routes tab button; per row its line, an Open button for a closed row
//   (a refused one faint but clickable, sounding the refusal), and the selected row's road on a minimap of the board
// src/testHook.ts TradingPostProbe gains: buttons.routesTab: ButtonProbe; routes: { partner: string; status: RouteStatus; line: string; open: ButtonProbe | null }[]
// src/game/blight.ts: SPAWN_KINDS exported (unchanged)
// src/scenes/debugCommands.ts: spawn <encounter> [here | <location id> | <col> <row>]; contact <partner id | all>   (decision 18)
```

### C7. The simulator's trade (step 07)

```ts
// scripts/simulate.ts
// SIM_PARTNERS and SIM_LODGE_CAP are removed: every simulated world has PARTNERS
export const CONTACT_DETOUR = 8
export function contactErrand(world: WorldState, party: Expedition): PartnerLocation | null
//   the nearest uncontacted partner within CONTACT_DETOUR of the party, when no held site is threatened; ties in locations order
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

## Tasks

| Step | Task | Outcome | Depends on | Engineer / reviewer | Status |
| --- | --- | --- | --- | --- | --- |
| 01 | [Partners, contact and silence](01-partners-domain.md) | Baseline figures; `PartnerLocation`, Millbrook and Saltmere, `contacted`, `silent`, `routes`, `partnerDay`, partner events, partners as sources; save 28 with migration; `SIM_PARTNERS` (C1); guard identical | — | opus / opus | pending |
| 02 | [Routes, raids and guards](02-routes-domain.md) | `trade.ts` routes: `roadTo`, `openRoute` and its refusal, security with tower and party guards, income and goods, raid causes, `tradeDay`, abandonment and restoration, route events, `towerHexRefusal` (C2); guard identical | 01 | opus / opus | pending |
| 03 | [Roads and the Lodge's level 3](03-roads-and-lodge.md) | Lodge 3 buildable; road sources at Lodge 3; the Lodge's effect line; `SIM_LODGE_CAP` (C3); guard identical | 02 | sonnet / opus | pending |
| 04 | [Sprites: partners and the Lodge](04-sprites.md) | `map_partner_village`, `map_partner_port`, `camp_lodge/level_3` redrawn (C4) | — | sonnet / opus | pending |
| 05 | [The world map's roads and partners](05-world-map.md) | Roads overlay, partner icons and greying, hex info and road lines, event lines, yield summary, sounds (C5); manual text; in-browser tests | 03, 04 | sonnet / opus | pending |
| 06 | [The Routes tab and the debug console](06-routes-tab-and-debug.md) | The trading post's Routes tab with preview and minimap; debug `spawn` and `contact` (C6); manual text; in-browser tests | 05 | sonnet / opus | pending |
| 07 | [The simulator's trade](07-simulator.md) | Holds removed; contact detour, routes opened, Lodge 3, raiders weighed, tower errand, guard defends roads, record and summary (C7); fixture re-recorded once | 03 | opus / opus | pending |
| 08 | [Measure, document, play](08-measure-document-play.md) | Guard and company figures, `--ready-level 10` routes check; CLAUDE.md, reference docs, manual and screenshots; implementation notes; play script walked | 06, 07 | opus / opus | pending |

**Tiers.** "opus" means leave the model unset (the session's); "sonnet" means `model: "sonnet"`. Steps 01, 02 and 07 decide state, saves, rules and the simulator's play; 08 measures and judges balance. Steps 03, 05 and 06 follow fixed contracts and existing patterns; 04 is tool work with a judged look. Every reviewer is opus.

## Execution order

01 → 02 → 03 → then two tracks: **scenes** 05 → 06, and **simulator** 07; 08 after both.

- **04** touches only `art/` and `public/assets/sprites/`; it may run at any time in its own worktree, and must be merged before 05 (partner sprites) and 08 (screenshots of the Lodge).
- **07** may run in its own worktree in parallel with 05 and 06: it touches only `scripts/` (and `scripts/CLAUDE.md`, `docs/reference/simulator.md`). 05 and 06 touch `src/scenes/`, `src/testHook.ts`, `e2e/` and the manual; run them in order on the stage branch. 06's one domain edit is exporting `SPAWN_KINDS`.
- **Checkpoints:** after 03 the domain is complete and the fixture untouched; after 07 the fixture is re-recorded; 08 measures on the merged branch.

## Requirement map

| Design item | Steps |
| --- | --- |
| S8-R1 partners (Millbrook, Saltmere), contact, silence, partners as sources; economy R5, A4 | 01 (rules), 04 (sprites), 05 (icons, greying, hex info, lines), 06 (`contact` debug) |
| S8-R2 opening routes, `roadTo`, slots 1/2/4 at post 4/5/6, cost; economy R6, A5 | 02 (rules), 06 (Routes tab) |
| S8-R3 income by security, partners' goods; guards by towers and parties; economy R7, A6; company R10, A8 | 02 (rules), 05 (overlay, road lines) |
| S8-R4 raids by three causes, abandonment, restoration; economy R8, A6 | 02 (rules), 05 (event lines), 06 (`spawn` debug) |
| S8-R5 roads push back the blight at Lodge 3; economy R10, A8 | 03 (rules), 04 (Lodge sprite), 08 (measured) |
| S8-R6 the roads overlay, partner icons, road tooltip, Routes tab, event lines, stock panel by source, partner sprites; economy R9, A7 | 04, 05, 06 |
| S8-R7 the simulator's contact, routes, `nextTarget` raiders, towers on roads, guard defend, record | 07, 08 (measured) |
| §2 events (`partner_*`, `route_*`, `yield` `source: 'route'`, `isNotable`) | 01, 02 (rules), 05 (lines, sounds) |
| §5 `roadTo` determinism; road sources only at Lodge 3; memo key; `SAVE_VERSION` | 02, 03, 01 |
| §6 tests: `trade.test.ts` (01, 02), `blight.test.ts` (01, 03), save (01), scene tests (05, 06), company A8 (02) | as listed |
| §6 simulator checks 1 (early-game guard, route counts) and 2 (`--ready-level 10`) | 01 (baseline), 07, 08 |
| §6 play script | 06 (debug commands it needs), 08 (walked) |
| §7 risks (`ROAD_STRENGTH`; `RAID_RADIUS`, `ABANDON_AFTER`) | 08 |
| Carried from stage 7: the Lodge level 3 sprite | 04 |
| Cross-stage: docs, manual, sprites, implementation notes | each step; 04; 08 |

## Completion criteria

- `npm test`, `npm run test:browser`, `npm run build` and `npm run sprites:check` pass.
- The guard fixture was edited only by step 07 and passes.
- The early-game figure (`--parties 1`) is within about 5 points of step 01's baseline, or the move is explained in the commit and CLAUDE.md's rules of scaling (or retuned); the default company stays in its band.
- At `--ready-level 10` with the company, routes are opened, raided sometimes and rarely abandoned, and route gold is a visible share of income (recorded with figures).
- CLAUDE.md files, `docs/reference/`, the manual and its screenshots are current; the stage design has its implementation notes; the stages index shows stage 8's status.
- The play script has been walked, with what was seen recorded in step 08.

## Open questions

None blocks a step; each has a default taken, which the step implements unless the orchestrator says otherwise.

1. **A new road can be raided the day it opens** (affects 02, 06; default: the design's letter). `roadTo` avoids only monster hexes and their neighbours (distance 1), but a raid counts nests within `RAID_RADIUS` (2). On today's map, from a new world, Millbrook's road passes 2 hexes from the Goblin Raiders and Saltmere's from three nests, so a route opened while they stand pays nothing until they are cleared. Options: (a) keep the design (protecting the road means clearing its nests) and have the Routes tab's preview name any raider before the player pays; (b) have `roadTo` prefer a road clear of `RAID_RADIUS` where one exists, falling back to the design's road. **Recommendation: (a)**, as planned in step 06 (the preview line shows "Raided at once: <cause>" when `raidCause` holds for the previewed road): it keeps the design's rule, and the party usually clears the home nests long before trading post 4. Choosing (b) changes `roadTo` in step 02 and the simulator's figures in step 07.
2. **Decisions 9, 12 and 15** depart from the design's letter for reasons given there (towers need clean land; the simulator's Lodge 3; the migration). They are decisions, not questions, but the user may prefer otherwise; each is local to its step.

## For implementers

When you start or finish a step, update its status and commits in the table above. Record evidence (commands and output, the guard's result), deviations and blockers in your task file's "Execution record", and anything the plan as a whole accumulates (measurements, run histories, review summaries) in [`log.md`](log.md). Keep this index short; every implementer reads it.
