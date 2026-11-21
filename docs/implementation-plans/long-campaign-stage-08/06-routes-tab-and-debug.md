# Step 06: The Routes tab and the debug console

[Plan index](index.md) · [Stage design](../../designs/long-campaign/stage-08-trade-routes.md) (§2 "Scenes": the trading post's Routes tab, with a road preview, its length, expected income and cost; §4 "What the player sees"; §6 play script) · [Reference](../../designs/long-campaign/reference/economy-and-trade-routes.md) §4.4 (opening a route), §4.6 ("No safe road to …"), §5.3 (the trading post scene) · [Stages index](../../designs/long-campaign/index.md) ("Docs", "Gameplay verification")

**Difficulty:** sonnet / opus. The engineer (`model: "sonnet"`) builds a tab and two debug commands over fixed contracts and existing patterns (the Buy and Sell tabs, the `blight` and `facility` commands). The reviewer should be opus (model unset): it judges whether the tab reads well and fits at 840×560, and whether the preview's words match the rules.

## 1. Objective

Give the player the trading post's **Routes** tab, and the debug console the commands the play script and the in-browser tests need:
- the Routes tab lists every contacted partner: a closed one with its offer ("Open a route to Millbrook: 14 hexes, about 2 gold every 5 days, costs 27 gold, 10 timber"), an Open button and its road on a minimap; an open one with its security, expected income and raided count;
- `spawn` places a nest at a hex, drawing no RNG; `contact` contacts a partner or all of them.

No rule changes. The refactor guard and the 50-campaign check are untouched (this step need not run the 50-campaign check; say so in the record).

## 2. Requirements and context

- **S8-R2** (economy R6, A5): opening a route at the trading post, the road previewed, its length, its cost; its refusals shown.
- **S8-R6** (economy R9, A7): "Scene tests cover the Routes tab."
- **S8-R1, S8-R4** (play script): the debug console must let the player contact a partner and place a nest near a road (design §6, play script step 3: "Use the debug console to place a spawn near the road").
- **Design §4:** "At the Market, the Routes tab offers 'Open a route to Millbrook: 26 hexes, about 3 gold every 5 days, costs 33 gold and 10 timber', with the road drawn on a minimap." Those figures are illustrative (index decision 7): on today's map Millbrook's road is 14 hexes, 27 gold and 10 timber, about 2 gold when clean. Tests use the formulas, never §4's numbers.
- **Decisions from the index** (unchanged):
  1. **Signatures follow the code's patterns.** `openRouteRefusal(game, party, partnerId)` and `openRoute(game, party, partnerId)` take the party (every encampment action checks `atEncampment`), and `openRoute` is the time-free apply that assumes its refusal said null and returns the `route_opened` event (as `raiseImprovement` does). `routeSecurity` and `routeIncome` take a road (`readonly Hex[]`) and the presences, not a route, so the Routes tab can preview a road not yet opened; `raidCause` takes `{ partner, road }`.
  8. **The preview's income counts towers, not parties.** The Routes tab and the road tooltip's "about N gold every 5 days" use `routeIncome(world, road, [])`, so the party standing at home does not inflate it; the map's overlay and the real yields count every presence.
  11. **The Routes tab's open routes** show security, expected income now (decision 8's figure) and the raided count, not "last income" (which would need new saved state). The tab is always present; below trading post 4 it says why routes cannot open. It lists contacted partners only, in contact order.
  18. **Debug commands for the play script and the in-browser tests:** `spawn <goblin_raid|kobold_scouts|bandit_camp> [here | <location id> | <col> <row>]` places a nest by `SPAWN_KINDS` (exported from `blight.ts`) at the hex's `threatAt`, drawing no RNG; `contact <partner id | all>` contacts partners. `facility builders_lodge 3`, `facility trading_post 4`, `stock` and `days` exist; `days`' yield totals gain routes through `yieldSummary`.
- **Open question 1's default (taken):** a new road can be raided the day it opens (it avoids monster hexes and their neighbours, but raids count nests within `RAID_RADIUS`, 2). The design's rule stands, and the Routes tab's preview names any raider before the player pays: `RouteRow.raid` and the offer's "Raided at once: …" tail. If the orchestrator chooses otherwise (`roadTo` preferring a road clear of `RAID_RADIUS`), the preview's tail simply never shows for such roads; nothing here changes.

### Contract (copied unchanged from the index)

**C6. The Routes tab and the debug console (step 06)**

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

### What this step consumes (copied unchanged from the index)

From **C1** (step 01):

```ts
// src/game/worldMap.ts
export interface PartnerLocation extends LocationBase { kind: 'partner'; good: Material }   // a neutral settlement: never held, never lost
export const PARTNERS: readonly PartnerLocation[] = [
  { id: 'millbrook', kind: 'partner', name: 'Millbrook', position: offsetToHex(18, 30), good: 'timber' },   // threat 2 ring
  { id: 'saltmere', kind: 'partner', name: 'Saltmere', position: offsetToHex(30, 38), good: 'salt' },       // threat 3 ring, south edge
]
// WorldState gains (newWorld: [], [], [], 0):
contacted: string[]        // partner ids contacted, in the order contacted; permanent
silent: string[]           // partner ids silent now: entered when the hex reaches LOSS_LEVEL, left when it is 0
routes: TradeRoute[]       // open routes, in the order opened (filled from step 02)
routesOpened: number       // routes ever opened

// src/game/trade.ts
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
```

From **C2** (step 02):

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
export function routeSecurity(world: WorldState, road: readonly Hex[], presences: readonly PartyPresence[]): number   // the mean of hexSecurity, 0..1
export function routeIncome(world: WorldState, road: readonly Hex[], presences: readonly PartyPresence[]): number
//   floor(floor(ROUTE_BASE + road.length / ROUTE_HEXES_PER_GOLD) * routeSecurity)
export function raidCause(world: WorldState, route: Pick<TradeRoute, 'partner' | 'road'>): { cause: RaidCause; raider?: MonsterLocation } | null
//   the first that holds: the partner is silent; a road hex is corrupted; raiders(world, road)[0]
// src/game/blight.ts, WorldEvent gains:
//   | { type: 'route_opened'; route: string; partner: string; name: string; length: number }
```

- **Refusal words** (`openRouteRefusal`, in order): "Routes are opened at <encampment name>." (not `atEncampment`); `No partner "<id>".`; "<name> has not been contacted: walk there first."; "<name> is silent while the blight holds its land."; "A route to <name> is already open."; "Routes need the Market (trading post level 4)." (limit 0); "The <tradingPostName> keeps <n> route(s) open at most." ("1 route", "2 routes"); "No safe road to <name>."; "The route costs <describeCost>, more than the stock holds."

From **C5** (step 05, `src/scenes/roadsView.ts`):

```ts
export function raidWords(raid: { cause: RaidCause; raider?: MonsterLocation }, partner: PartnerLocation): string
//   raiders "the Goblin Brood is within 2 hexes" (theName, RAID_RADIUS; "are" for a plural name such as "the Goblin Raiders");
//   corrupted "the blight has overrun it"; silent "Millbrook is silent"
```

### Shared constraints (from the index)

- **Commands** (local Node 26: prefix `PATH=/opt/homebrew/opt/node@26/bin:$PATH`; or the podman `make` targets):
  - `npm test` (`tsc && vitest run`) is the gate before every commit;
  - `npx vitest run <file>` for one file;
  - `npm run test:browser` (or `-- -t <name>`) after any scene change; read `e2e/CLAUDE.md` before adding an in-browser test.
- **The refactor guard** (`scripts/simulate.test.ts`, `describe('the refactor guard')`): steps 01–06 must not edit the fixture and must keep it green. This step changes no rule (exporting `SPAWN_KINDS` changes nothing), so it need not run the 50-campaign check; say so in the record.
- **Determinism.** Nothing here draws from the world RNG or `Math.random` (sound variants aside, through `soundPlayer.ts`). `spawn` must not touch `world.rng` or `spawnPressure`.
- **Scenes decide nothing** (`src/scenes/CLAUDE.md`): the tab asks `openRouteRefusal`, calls `openRoute`, and shows what they return. Its logic lives in the Phaser-free `routesTab.ts`; the scene only draws.
- **Content.** Debug commands follow `.claude/skills/yomi-add-content/debug-command.md` (an entry in `COMMANDS`; a command that changes the game runs only on the world map; `debugCommands.test.ts`'s `help` test checks its usage text). Manual: `.claude/skills/yomi-manual/` (text here; screenshots are step 08's).
- **Commits.** One commit for this step once `npm test` and `npm run test:browser` pass, on `long-campaign-stage-08`, without pushing; files staged by path. Message "Stage 8 step 06: the Routes tab and the debug console", no attribution lines.
- **Docs.** CLAUDE.md files stay current: fix any line this change makes wrong (`src/scenes/CLAUDE.md` names helper modules only through the reference; check), and update `docs/reference/scenes.md` (the trading post screen, the helper module `routesTab.ts`, the debug console's `spawn` and `contact`).

## 3. Dependencies and prerequisites

- **Step 05** (and through it 01–04) must be on the branch. It produces `src/scenes/roadsView.ts` with `raidWords`, and its edits to `src/testHook.ts`, `e2e/` and the manual come first (both steps touch them; they run in order on the stage branch).
- **Produced by earlier steps** (not existing at `42cde46`): `PartnerLocation`, `PARTNERS`, `WorldState.contacted`, `silent`, `routes`, `routesOpened` (01); `src/game/trade.ts`'s partner functions (01) and route functions and constants (02); `route_opened` (02); Lodge 3 and roads (03, not used here).
- **Existing (at `42cde46`), inspected:**
  - `src/scenes/TradingPostScene.ts` (500 lines): `type Tab = 'buy' | 'sell'`; a 720×520 frame (`FRAME_W`, `FRAME_H`) scaled by `overlayScale`; tab buttons drawn at `TAB_Y` (96) through `this.button(key, rect, label, onClick, enabled, active)` (`buyTab` at x 140, `sellTab` at x 280, 120×30); `show(tab)` sets `this.tab` and redraws (on the next tick, per the scenes contract); the list, details and confirm buttons; the message line at `MESSAGE_Y`; `probe()` returning `TradingPostProbe`; tab buttons sound `ui.tab`, refused confirms sound through `refusalCue`, the rest `buttonCue(label)`. The header names the post by `tradingPostName(level)`.
  - `src/testHook.ts`: `TradingPostProbe` (`tab: 'buy' | 'sell'`, `rows`, `buttons`, …), `ButtonProbe`.
  - `src/scenes/debugCommands.ts`: `COMMANDS` (each `{ usage, summary, acts?, changes?, run(args, context) }`, `DebugError` for bad input), the `blight` command's hex argument parsing (`here | <location id> | <col> <row>`, `@party`), `locations`, `facility`, `stock`, `days`; `gameOf(context)`.
  - `src/game/blight.ts`: `SPAWN_KINDS` (a module-private `ReadonlyArray<{ encounter: EncounterId; name: string }>`: Goblin Brood, Kobold Nest, Bandit Gang), `MAX_BLIGHT`, `boardIndex`; `src/game/worldMap.ts`: `threatAt`, `locationAt`, `MonsterLocation`.
  - `src/scenes/panelButton.ts` (`addPanelButton`, `fitText`), `src/scenes/overlayScale.ts`, `src/scenes/sounds.ts` (`buttonCue`, `refusalCue`), `src/scenes/boardGeometry.ts` (`Point`).
  - `e2e/encampment.test.ts`, `e2e/debug.test.ts`, `e2e/driver.ts`, `e2e/CLAUDE.md`.
  - `docs/manual/README.md` §9 "Building", "The trading post".

## 4. Scope and guidance

1. **`src/scenes/routesTab.ts`** (new, Phaser-free) per C6:
   - `routeRows`: for each id in `world.contacted` that is a partner, a row. Open route (`routeOf`): `road` its road, `status` `'raided'` when `raidCause(world, route)` is not null else `'open'`, `income`/`security` with no presences (decision 8), `cost` null, `refusal` null, `raid` null, `raidedDays` the route's. Closed: `road = roadTo(world, id)`, `length`, `income`, `security` and `cost` from it (null without a road), `refusal = openRouteRefusal(game, party, id)`, `raid = raidWords(cause, partner)` when `raidCause(world, { partner: id, road })` holds on the previewed road, else null.
   - `routeOffer`: the design's wording with today's figures, "costs" then `describeCost`; with no road, the refusal ("No safe road to Saltmere.") stands in. Percentages are whole (`Math.round(security * 100)`).
   - `routeState` per C6; `minimapPoints`: each hex (the encampment's `from` first, then the road) to its centre in the board's offset grid scaled into `rect`, keeping the board's aspect.
2. **`TradingPostScene.ts`:**
   - `Tab` gains `'routes'`; a third tab button `routesTab` beside Sell (keep the three inside the frame at its scale); `show('routes')`.
   - The tab's body: a heading line with the slots ("Routes: 1 of 1 open"; below post 4 "Routes need the Market (trading post level 4)."); one line per row (`routeOffer` for closed, `routeState` for open or raided, raided in red); an Open button per closed row, enabled-looking only when its refusal is null but always clickable, a refused click setting the message to the refusal and sounding `refusalCue`; a successful Open calls `openRoute`, sets the message (the route's `describeWorldEvent` line from step 05, "A road is opened to Millbrook.") and redraws. With no contacted partner: "No partner trades with <encampment> yet: walk to one on the map."
   - The minimap: a small panel (for example the details area) showing the board's outline, the encampment and the partner as marks, and the selected row's road as a polyline from `minimapPoints` (the first row selected by default; clicking a row selects it). Tinting the board by `seen` blight is optional.
   - It must fit the 720×520 frame and the game's 840×560 minimum (`MIN_GAME_SIZE`), and relay out on resize as the other tabs do.
   - `probe()`: `tab` may be `'routes'`; `buttons.routesTab`; `routes` per C6 (`open` null for an open or raided row). Update `TradingPostProbe` in `src/testHook.ts`.
3. **`src/game/blight.ts`:** export `SPAWN_KINDS` (no other change).
4. **`src/scenes/debugCommands.ts`:**
   - `spawn <encounter> [here | <location id> | <col> <row>] [@party]`: `<encounter>` one of `SPAWN_KINDS`' encounters; the hex as `blight` parses it (default `here`, the party's hex). Refused (`DebugError`) off the map or on a hex any location already stands on. Pushes a `MonsterLocation` `{ id: spawn_<world.spawns + 1>, kind: 'monsters', name: <the kind's name>, position, encounter, threat: threatAt(position), loot: [] }`, increments `world.spawns`, sets the hex to `MAX_BLIGHT` (as a real spawn does), and adds it to `sighted` so it shows. No RNG drawn; `spawnPressure` untouched. Changes the game, so world map only.
   - `contact <partner id | all>`: `contactPartner` for the partner or every partner; lists what was contacted (or that it was already). Unknown id: `DebugError` naming the partners.
   - Both reply with a line the tests can read.
5. **Tests:**
   - `src/scenes/routesTab.test.ts` (domain project): rows only for contacted partners, in contact order; a closed row's length, income, cost and offer from the formulas on a fixed world; the refusal below post 4, at full slots, with no road ("No safe road to …"), and when the stock is short; `raid` set when a nest stands 2 hexes from the previewed road and the offer's "Raided at once" tail; an open row's `routeState` with and without raided days; a raided row's status; `minimapPoints` inside the rect, first point the encampment.
   - `src/scenes/TradingPostScene.test.ts` (jsdom): the Routes tab button switches the tab; a refused Open leaves the stock and sets the refusal message; a permitted Open spends the cost and turns the row open.
   - `src/scenes/debugCommands.test.ts`: `spawn` places a nest with the next id at the hex's threat and leaves `world.rng` and `spawnPressure` as they were, and refuses an occupied or off-map hex; `contact millbrook` and `contact all`; `help` lists both.
   - **In-browser** (`e2e/encampment.test.ts` or `e2e/debug.test.ts`, per `e2e/CLAUDE.md`): `contact millbrook`, `facility trading_post 4`, `stock gold 100 timber 20`, open the trading post, the Routes tab, click Open, and see the route open in the probe and the stock spent; then `spawn goblin_raid <col> <row>` beside the road and see the row raided.
6. **Manual:** `docs/manual/README.md` §9, "The trading post": the Routes tab (from the Market, how many routes each level keeps, the cost, what a route pays and that security and raids cut it, the preview naming raiders). Screenshots are step 08's; say in the record which ones will need retaking.
7. **Reference:** `docs/reference/scenes.md`: the trading post's Routes tab, `routesTab.ts` among the helper modules, `spawn` and `contact` in the debug console.
8. **Exclusions:** no rule change; no road overlay or event lines (step 05); no simulator change (step 07); no screenshots (step 08).

## 5. Verification

- `npx vitest run src/scenes/routesTab.test.ts src/scenes/TradingPostScene.test.ts src/scenes/debugCommands.test.ts` passes.
- `npm test` passes, the refactor guard included and its fixture untouched (`git diff --stat scripts/simulate.test.ts` empty).
- `npm run test:browser` passes, including the new test (`npm run test:browser -- -t <its name>`).
- At 840×560 (the minimum) the Routes tab's lines, buttons and minimap fit the frame (look, or the probe's button rects inside the frame); record how this was checked.

## 6. Completion criteria

- [ ] `routesTab.ts` per C6, with tests.
- [ ] The trading post has a Routes tab: offers, open routes' state, Open with its refusals, the minimap; the probe per C6.
- [ ] `SPAWN_KINDS` exported; `spawn` and `contact` in `COMMANDS`, tested, drawing no RNG.
- [ ] `npm test` and `npm run test:browser` pass; the guard fixture untouched; the 50-campaign check not run (no rule changed), said in the record.
- [ ] The manual's trading post text and `docs/reference/scenes.md` updated; the screenshots step 08 must retake named in the record.
- [ ] One commit, "Stage 8 step 06: the Routes tab and the debug console", no attribution lines; the index's row 06 updated with status and commit.

## 7. Execution record
