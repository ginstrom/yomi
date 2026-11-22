# Step 05: The world map's roads and partners

[Plan index](index.md) · [Stage design](../../designs/long-campaign/stage-08-trade-routes.md) (§2 "Scenes": the roads overlay, partner icons greyed when silent, the road tooltip, event lines, the stock panel's income by source; §4 What the player sees) · [Reference](../../designs/long-campaign/reference/economy-and-trade-routes.md) §4.5 (how the player sees it), §5.3 (scenes) · [Stages index](../../designs/long-campaign/index.md) ("Docs", "Sprites")

**Difficulty:** sonnet / opus. The engineer can be `model: "sonnet"`: the contracts (C5) fix every name, line and colour, and the work follows the patterns stage 7 step 04 set on the same scene (the palisade, the Improve label, the yield summary). The reviewer should be opus (model unset): it judges whether the overlay reads at the 840×560 minimum and over the blight's tints, and whether the probe and the in-browser test really exercise the drawing.

## 1. Objective

Show the stage's trade on the world map, deciding nothing:
- a **roads layer** under the locations: each open route drawn from the encampment as a dashed line, each segment gold, amber or red by its hex's security, the whole road red while it is raided;
- **partner icons** (Millbrook's village, Saltmere's port, from step 04's sprites), tinted grey with a grey label while silent;
- the **hex info panel** telling a partner's state and, on a road hex, the road's security, expected income and any raid's cause (the design's "road tooltip");
- **event lines** for the partner and route events, a route's yield line, and routes in the stock panel's yield summary;
- **sounds** for the new events, from existing cues;
- the manual's text for what the map now shows.

No rule changes. The Routes tab and the debug commands `spawn` and `contact` are step 06's.

## 2. Requirements and context

- **S8-R1** (economy R5, A4): partners on the map, contacted by stepping on them, silent at `LOSS_LEVEL`; the map shows them, greyed when silent.
- **S8-R3** (economy R7; company R10): security by clean, guarded (a watchtower or a party within `GUARD_RADIUS`), tainted, blighted or worse; the overlay and the road lines show it.
- **S8-R4** (economy R8): raids by three causes, abandonment, restoration; their lines here.
- **S8-R6** (economy R9, A7): "The world map draws every road coloured by its security, and marks raiders"; "Events and the map's road overlay show raided, restored and abandoned routes"; the stock panel's income by source includes routes.
- **Design §4:** "a gold dashed road runs from the encampment to Millbrook. When a Goblin Brood spawns two hexes from it, the road turns red: 'Raiders on the Millbrook road'. … Once the nest is cleared, 'The Millbrook road is safe again'. A tainted stretch shows amber, and the income drops. A watchtower beside it turns the stretch gold again." And "Walking into Millbrook: 'Millbrook will trade with Oakvale.'"

### Decisions from the index this step applies (unchanged)

2. **Contact and silence are daily, in a new `partnerDay`.** The design names `contactPartner` "called from the travel step"; the plan instead contacts in the world's day (`updateTerritory` calls `partnerDay`), for every presence standing on an uncontacted partner's hex. Each walked hex ends a day with the party on it, so this is the same for walking and covers garrisons and debug moves too. `contactPartner(world, id)` stays exported for `partnerDay` and the debug console. Contact is not notable (the design's `isNotable` list leaves it out); its line shows in the day's events like a capture.
3. **Silence is tracked for every partner, told only for contacted ones.** `WorldState.silent` holds the partners silent now (entered at `LOSS_LEVEL`, left at 0). `partner_silent` and `partner_restored` are emitted only for contacted partners. A partner is a clean source of `PARTNER_STRENGTH` (3) whether silent or not: it is never lost, and its strength never changes, so the fields memo is untouched by silence.
5. **Raid messages and repeats** (for the user's eye). `route_raided` is emitted on every raided yield day, carrying `days` (the run's count, 1 on the first). Only `days === 1` is notable and has a message line ("Raiders on the Millbrook road: the Goblin Brood."); later days describe as `''` (economy R9: told once when raided and once when restored). On the sixth raided day the event is followed by `route_abandoned`, and the route is removed (its slot freed). *Revised in verification round 2 (the user's decision, 2026-11-22):* the raid is told the day the road turns raided, yield day or not: `tradeDay` checks every day and emits `route_raided` with `days` 0 (notable, the message line, the cue) when a route becomes raided and `route_restored` when it stops, once each (`TradeRoute.raided`, saved: `SAVE_VERSION` 29); the yield days' `route_raided` (`days` 1, 2, …) still count the run and abandon at the sixth, but are not notable and have no line. *Round 3 (the user's decision):* `route_restored` resets `raidedDays` to 0 on whatever day it fires, so abandonment needs six raided yield days in a row after the last "safe again".
8. **The preview's income counts towers, not parties.** The Routes tab's "about N gold every 5 days" uses `routeIncome(world, road, [])`, so the party standing at home does not inflate it; the map's overlay, the road hover and the real yields count every presence. *(Revised in verification round 2, the user's decision: the road hover counted towers only too; it now counts parties, so it agrees with the overlay and today's pay.)*
10. **The road overlay** colours each segment by its far hex's security, live: gold (`1`), amber (`½`), red (`0`); a route that `raidCause` says is raided today is red throughout, so the road turns red the day a nest spawns beside it, while the event and the lost income come on the next yield day. Roads are the company's own and are drawn through the fog. The road tooltip is lines in the existing hover info panel (`hexInfo`), not a new tooltip.
17. **Sounds reuse cues**, no new sound: `route_raided` (days 0 since verification round 2), `partner_silent` → `world.threatened`; `route_abandoned` → `world.lost`; `route_restored`, `partner_restored` → `world.captured`; `partner_contacted`, `route_opened` → `world.build`.

### Contract (copied unchanged from the index)

**C5. The world map (step 05)**

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
//   or, when raided today, "The Millbrook road: security 75%, pays nothing while raided." then "Raided: <raidWords>."
export function raidWords(raid: { cause: RaidCause; raider?: MonsterLocation }, partner: PartnerLocation): string
//   raiders "the Goblin Brood is within 2 hexes" (theName, RAID_RADIUS; "are" for a plural name such as "the Goblin Raiders");
//   corrupted "the blight has overrun it"; silent "Millbrook is silent"
export function partnerInfoLines(world: WorldState, partner: PartnerLocation): string[]
//   (silence told only when contacted or the hex is in sight: `partnerInfoLines(world, partner, inSight = true)`)
//   "Trade partner: <good>."; "Not yet contacted: walk here to trade." | "Trades with <encampment name>." ; "Silent while the blight holds its land." when silent;
//   "Route open: security N%." when routed
// src/scenes/worldEvents.ts describeWorldEvent:
//   partner_contacted "Millbrook will trade with Oakvale."; partner_silent "Millbrook has fallen silent under the blight.";
//   partner_restored "Millbrook is trading again."; route_opened "A road is opened to Millbrook.";
//   route_raided (days 0 since verification round 2; days 1 before) raiders "Raiders on the Millbrook road: the Goblin Brood." | corrupted "The blight has overrun the Millbrook road." |
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

### What this step consumes (copied unchanged from the index; built by steps 01–04)

**From C1 (step 01):**

```ts
// src/game/worldMap.ts
export interface PartnerLocation extends LocationBase { kind: 'partner'; good: Material }   // a neutral settlement: never held, never lost
export type WorldLocation = MonsterLocation | QuietLocation | PartnerLocation                // LocationKind gains 'partner'
export const PARTNERS: readonly PartnerLocation[] = [
  { id: 'millbrook', kind: 'partner', name: 'Millbrook', position: offsetToHex(18, 30), good: 'timber' },   // threat 2 ring
  { id: 'saltmere', kind: 'partner', name: 'Saltmere', position: offsetToHex(30, 38), good: 'salt' },       // threat 3 ring, south edge
]
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
// src/game/blight.ts, WorldEvent gains:
//   | { type: 'partner_contacted'; partner: string; name: string; home: string }   // home: the encampment's name
//   | { type: 'partner_silent'; partner: string; name: string }
//   | { type: 'partner_restored'; partner: string; name: string }
// src/scenes/WorldScene.ts: LOCATION_SPRITES.partner = 'map_resource' (temporary, for tsc; step 05 draws the partner sprites)
```

**From C2 (step 02):**

```ts
// src/game/trade.ts
export const ROUTE_BASE = 1
export const ROUTE_HEXES_PER_GOLD = 10
export const GUARD_RADIUS = 3
export const RAID_RADIUS = 2
export type RaidCause = 'silent' | 'corrupted' | 'raiders'
export function routeOf(world: WorldState, partnerId: string): TradeRoute | null
export function guarded(world: WorldState, at: Hex, presences: readonly PartyPresence[]): boolean
export function hexSecurity(world: WorldState, at: Hex, presences: readonly PartyPresence[]): 0 | 0.5 | 1
export function routeSecurity(world: WorldState, road: readonly Hex[], presences: readonly PartyPresence[]): number   // the mean of hexSecurity, 0..1
export function routeIncome(world: WorldState, road: readonly Hex[], presences: readonly PartyPresence[]): number
export function raiders(world: WorldState, road: readonly Hex[]): MonsterLocation[]
export function raidCause(world: WorldState, route: Pick<TradeRoute, 'partner' | 'road'>): { cause: RaidCause; raider?: MonsterLocation } | null
// src/game/blight.ts, WorldEvent gains:
//   | { type: 'route_opened'; route: string; partner: string; name: string; length: number }
//   | { type: 'route_raided'; route: string; partner: string; name: string; cause: RaidCause; raider?: string; raiderName?: string; days: number }
//   | { type: 'route_restored'; route: string; partner: string; name: string }
//   | { type: 'route_abandoned'; route: string; partner: string; name: string }
//   'yield' gains route?: string; a route's yields are { site: <partner id>, name: <partner name>, material, amount, source: 'route', route: <route id> }
// src/game/territory.ts: YieldSource = 'site' | 'market' | 'route'
// src/game/worldMap.ts: isNotable(route_raided) is days === 0 (the day it turns raided; days === 1 before verification round 2); isNotable(route_abandoned) is true
```

**From C3 (step 03):** roads push at Lodge 3 (nothing for this step to draw; the map's blight tints already show it).

**From C4 (step 04):** `map_partner_village` and `map_partner_port`, each on the 24px `map` canvas with frame `base` and an `idle` animation, readable when tinted grey. Read step 04's execution record for the exact names and any offset over a hex.

### Shared constraints (from the index)

- **Commands** (local Node 26: prefix `PATH=/opt/homebrew/opt/node@26/bin:$PATH`; or the podman `make` targets): `npm test` (`tsc && vitest run`) is the gate before the commit; `npx vitest run <file>` for one file; `npm run test:browser` (or `-- -t <name>`) after any scene change, and read `e2e/CLAUDE.md` before adding an in-browser test.
- **The refactor guard** (`scripts/simulate.test.ts`, `describe('the refactor guard')`) must stay green and its fixture is not edited. This step changes no rule, so the 50-campaign check need not be run: say so in the record.
- **Scenes decide nothing** (`src/scenes/CLAUDE.md`): every figure comes from the domain (`trade.ts`, `blight.ts`, `territory.ts`); scene logic goes in Phaser-free helpers with tests (`roadsView.ts`), and only the listed view helpers import Phaser. Layout must fit at 840×560.
- **Content.** A location kind's sprite: `.claude/skills/yomi-add-content/location-kind.md` (`LOCATION_SPRITES` is a full `Record` of `LocationKind`; the `idle` animation is checked by hand). Manual: `.claude/skills/yomi-manual/` (text here; screenshots are step 08's).
- **Determinism.** No RNG is drawn; the scene reads the state only.
- **Commits.** One commit once `npm test` and `npm run test:browser` pass, on `long-campaign-stage-08`, without pushing, files staged by path. Message "Stage 8 step 05: the world map's roads and partners". No attribution lines.
- **Docs.** CLAUDE.md files stay current: `src/scenes/CLAUDE.md` names its helper modules only through the reference; add `roadsView.ts` to `docs/reference/scenes.md`'s "Helper modules in detail" (and the world map's section), and fix any line this step makes wrong. Search the CLAUDE.md files and `.claude/` for `LOCATION_SPRITES` and the old `map_resource` stand-in.

## 3. Dependencies and prerequisites

- **Step 03** (and so 01 and 02) must be done: partners, `contacted`, `silent`, `routes`, the partner and route events, `hexSecurity`, `routeSecurity`, `routeIncome`, `raidCause`, `raiders` and `yield`'s `source: 'route'` exist as above. Check their execution records for any deviation from the contracts.
- **Step 04** must be merged into the stage branch: the frames `map_partner_village/base`, `map_partner_port/base` and their `idle` animations are in `public/assets/sprites/atlas.json` and `atlas.anims.json`. Without them the in-browser tests fail on a missing frame.
- **Existing (at `42cde46`, plus steps 01–04):**
  - `src/scenes/WorldScene.ts`: `LOCATION_SPRITES: Record<LocationKind, string>` (step 01 added `partner: 'map_resource'`); `TOWER_SPRITE`, `FORT_SPRITE`; `knowledgeOf` (a non-monster location is known once its hex is seen, so partners follow resources through the fog with no change); `refreshLocations`, which redraws only when its key changes (locations by knowledge, towers, forts): the key must also cover each partner's silence so a partner falling silent is redrawn grey; `refreshLabels` and `labelColor(location, held, threatened)` (monsters reddish, the Source violet, held green, threatened orange): partners need their own colour and grey when silent; `refreshBlight` and its `blightMarks` Graphics (redrawn when the land changes); the layers (`mapLayer` terrain, the blight marks, `siteSprites`, `siteLabels`, the route and party marks): the roads go above the blight and below `siteSprites`; `refreshInfo` / `refreshHover` (the hover panel from `hexInfo`); `noteYield` and the stock panel's "Last yield" line (from `yieldSummary`); `probe()`.
  - `src/scenes/hexInfo.ts`: `hexInfo(game, party, visible, at)` builds a title and lines; a location branch for monsters and quiet locations (encampment, resources). A partner now falls into the non-monster branch: give it its own branch (title its name, `partnerInfoLines`), and add `roadInfoLines` for any hex on an open road (after the location's lines, before the blight line).
  - `src/scenes/worldEvents.ts`: `describeWorldEvent(event)` is an exhaustive `switch` over `WorldEvent['type']` (tsc fails until every new type has a case, which steps 01–02 may have stubbed: check); `describeWorldEvents` leaves out `yield` events and events described as `''`; `yieldSummary(events, heading)` sums sites and market.
  - `src/scenes/sounds.ts`: `WORLD_SOUND_KINDS`, highest priority first (`stings.defeat`, `world.confront`, `world.source`, `world.lost`, `world.sighted`, `world.threatened`, `world.captured`, `world.build`, `world.arrive`); `worldSounds(events)` plays the two highest kinds present.
  - `src/testHook.ts`: `WorldProbe` (it already carries `world: WorldState`, so a test can read `contacted`, `silent` and `routes`; the new fields say what is drawn).
  - Tests: `src/scenes/worldEvents.test.ts`, `hexInfo.test.ts`, `sounds.test.ts`, `WorldScene.test.ts` (jsdom smoke), `e2e/world.test.ts`, `e2e/driver.ts`.
  - Debug commands available now: `goto <col> <row> | goto <location>`, `reveal`, `facility`, `stock`, `blight <level> [here | <location id> | <col> <row>]`, `days <count>`. (`spawn` and `contact` arrive in step 06.)

## 4. Scope and guidance

1. **`src/scenes/roadsView.ts`** (new, Phaser-free) with `RoadShade`, `ROAD_COLORS`, `RoadSegment`, `roadSegments`, `roadInfoLines`, `raidWords` and `partnerInfoLines` exactly as C5:
   - `roadSegments`: for each route in `world.routes`, the segments encampment → `road[0]`, `road[0]` → `road[1]`, …; if `raidCause(world, route)` is not null every segment is `'raided'`, else each by `hexSecurity(world, to, presences)`.
   - `roadInfoLines`: "The Millbrook road: security 75%, about 2 gold every 5 days." with `Math.round(routeSecurity(world, road, presences) * 100)` and `routeIncome(world, road, presences)` (towers and parties, as revised in verification round 2; it counted towers only before), `YIELD_DAYS` for the 5; when `raidCause` holds today the first line reads "…security 75%, pays nothing while raided." (no income quoted), followed by "Raided: <raidWords>." One pair of lines per route through the hex.
   - `raidWords` uses `theName` (and the plural "are" for a name ending in s, as `isPluralName`) and `RAID_RADIUS`. Step 06's Routes tab reuses it; keep it exported and pure.
   - `partnerInfoLines`: as C5; the encampment's name from `encampmentName`.
2. **`WorldScene.ts`:**
   - `LOCATION_SPRITES.partner = 'map_partner_village'` and `PARTNER_SPRITES` as C5; `refreshLocations` picks `PARTNER_SPRITES[location.id] ?? LOCATION_SPRITES.partner` for a partner, tints a silent one `0x9e9e9e` (on top of the remembered fade), and adds each partner's silence to its redraw key.
   - `refreshLabels`/`labelColor`: a partner's label in its own colour (a warm trade gold, distinct from held green; the engineer's choice), `'#9e9e9e'` while silent. A partner is never "held", so no star.
   - A **roads layer**: one Graphics drawn from `roadSegments(world, presences)`, dashed (dashes along each segment between hex centres, `boardHexCenter`), in `ROAD_COLORS`, with a thin dark edge so it reads over every blight tint; above the blight marks and the terrain, below `siteSprites`. Redraw it when the roads' shades change (key it on the segments) after every refresh that can change the land, the towers or the parties (the same places `refreshLocations` runs). Drawn through the fog (decision 10).
   - The hover panel: `hexInfo` gains the partner branch and the road lines (point 3); nothing else in the scene changes for it.
   - `noteYield`/the stock panel: nothing beyond `yieldSummary`'s new part.
   - `probe()`: `roads` (each route's id and its segments' shades in order, as drawn) and `partners` (each partner's id, `contacted`, `silent`, and `drawn`: its sprite is on the map now, i.e. not hidden by the fog).
3. **`hexInfo.ts`:** a partner branch (title its name; `partnerInfoLines`); for every hex, known or not, on an open road, `roadInfoLines` (the road is the company's own). Keep the rule that nothing the fog hides is told: a partner's lines only once its hex is seen; the road lines always.
4. **`worldEvents.ts`:** the `describeWorldEvent` cases as C5 (replacing any stub steps 01–02 left); a route `yield` line "The Millbrook road brings 2 gold." (and "… brings 1 timber." for its good); `yieldSummary`'s routes part (gold first, then materials in order of first appearance, after sites and market: "Last yield: sites 4 gold; market 3 gold; routes 2 gold, 1 timber"). `describeWorldEvents` already skips `''` and yields.
5. **`sounds.ts`:** add the new event types to the existing kinds' predicates per decision 17 (`route_raided` with `days === 1` only).
6. **`src/testHook.ts`:** the two `WorldProbe` fields as C5, documented.
7. **The manual** (`docs/manual/README.md`, via `.claude/skills/yomi-manual/`): §3 "Places" gains trade partners (Millbrook and Saltmere, contact by walking on, silence under the blight, never held); a short passage on roads on the map (gold, amber, red; the hover lines; raids by a silent partner, a corrupted hex or a nest within 2 hexes; abandoned after 30 raided days; guarded by a watchtower or a party within 3 hexes); §8 "The blight" a line on partners as clean sources (and roads at Lodge 3, if not left to step 06's §9 text: say which in the record). The Routes tab itself is step 06's. Screenshots: none here (step 08 retakes them); note in the record which images now show something stale.
8. **Exclusions:** no domain rule or constant changes (if a contract is missing or wrong, stop and record it as a blocker rather than changing the rule); no Routes tab; no debug commands; no new sounds or sprites.

## 5. Verification

- **Unit tests (domain project):**
  - `src/scenes/roadsView.test.ts` (new): on a small fixed world with an open route: all clean → every segment `'secure'`; a tainted hex → `'tainted'`, and a watchtower within `GUARD_RADIUS` of it (or a presence) → `'secure'` again; a blighted unguarded hex → `'raided'` for that segment only; a nest within `RAID_RADIUS`, a corrupted hex, or a silent partner → every segment `'raided'`; segments start at the encampment's hex and follow the road. `roadInfoLines` for a road hex (security, income from towers only: a presence beside the road does not change it), for a raided road (each cause's words, singular and plural raider names), and `[]` off the road. `partnerInfoLines` for uncontacted, contacted, silent and routed partners.
  - `src/scenes/worldEvents.test.ts`: every new line in C5, `route_raided` with `days > 1` → `''`, the route yield lines, `yieldSummary` with routes alone and with all three sources.
  - `src/scenes/hexInfo.test.ts`: a partner's title and lines (hidden while its hex is unexplored); road lines on a road hex, including an unexplored one.
  - `src/scenes/sounds.test.ts`: the cues of decision 17 (and that a repeat raid sounds nothing new).
- **Scene smoke:** `src/scenes/WorldScene.test.ts` still passes; add a case that a world with a contacted, routed and a silent partner creates and probes (`roads`, `partners`) without error.
- **In-browser** (`e2e/world.test.ts`; read `e2e/CLAUDE.md` first): one test that starts a game, plants a route and reads the map. With no Routes tab or `contact` command yet, set it up through the save: save the game, edit the slot's JSON with `page.evaluate` (add `'millbrook'` to `contacted` and a route `{ id: 'route_millbrook', partner: 'millbrook', road, opened, raidedDays: 0 }` whose `road` is adjacent hexes from the encampment to Millbrook, worked out in the test from the probe's world), reload and continue. Then check: the probe's `roads` has the route with one shade per hex; `partners` shows Millbrook contacted and, after `reveal`, drawn; hovering a road hex shows the road line in the info panel; `blight 2 millbrook` then `days 1` turns Millbrook silent (`partners[...].silent`) and the road `'raided'` throughout. No console errors (the driver fails the test on any, which is how a missing sprite frame shows). If planting a save proves impractical, use whatever existing debug commands reach the state and record the set-up; step 06 adds `contact` and can extend the test.
- `npm test` and `npm run test:browser` pass; `npm run build` passes.
- **Look at it:** run the game (`npm run dev`), plant or reach a route, and view the map at 840×560 and at a larger size: the dashes read over clean, tainted and blighted land, the colours are distinct, partners show their own icons and grey when silent. Record how it was checked (screenshots kept outside the repository, for example the scratchpad).

## 6. Completion criteria

- [x] `roadsView.ts` exports exactly C5's names and shapes, with tests.
- [x] The world map draws open roads dashed by security (red throughout when raided), partner icons from `PARTNER_SPRITES`, greyed with grey labels when silent; the hover panel tells partners and roads.
- [x] Every new event has its line (`route_raided` only on `days === 1`), the route yield line, routes in `yieldSummary`, and sounds per decision 17.
- [x] `WorldProbe.roads` and `WorldProbe.partners` as C5; an in-browser test uses them.
- [x] The manual's world map text covers partners and roads; stale screenshots listed for step 08.
- [x] `npm test`, `npm run test:browser` and `npm run build` pass; the refactor guard untouched and green; the record says the 50-campaign check was not needed (no rule changed).
- [x] `docs/reference/scenes.md` names `roadsView.ts`; CLAUDE.md files and `.claude/` searched for lines made wrong.
- [x] One commit, "Stage 8 step 05: the world map's roads and partners", no attribution lines; the index's row 05 updated with status and commit.

## 7. Execution record

Test-first for the Phaser-free parts: `sounds.test.ts` (trade cues, repeat raids silent), `worldEvents.test.ts` (route lines, route yields, `yieldSummary` with routes), `roadsView.test.ts` (new), `hexInfo.test.ts` (partner branch, road lines through the fog); each written before its code. The scene and probe were then built, and `e2e/world.test.ts` gained "draws an open road by its security, a partner greyed when silent, and tells of them on hover".

Done: `roadsView.ts` as C5 (`roadInfoLines` keeps the contract's `presences` parameter, unused by decision 8, named `_presences`); the four route events' lines, the route yield line and `yieldSummary`'s routes part (route yields now count under routes, no longer sites); sounds per decision 17; `WorldScene`: `LOCATION_SPRITES.partner = 'map_partner_village'`, `PARTNER_SPRITES`, silent partners tinted `0x9e9e9e` with a grey label (silence is in the redraw key), partner label colour `#ffe082`, a `roadMarks` Graphics (dashed, dark edge, redrawn when a shade changes, drawn through the fog) between the blight sprites and the hover marks (so below the site sprites); `WorldProbe.roads` and `.partners`; `hexInfo` gives a partner `partnerInfoLines` and every road hex `roadInfoLines` (through the fog).

Deviations: (1) the jsdom `WorldScene.test.ts` case ("a world with a contacted, routed and silent partner creates and probes") was not added: the file only registers the scene key (a jsdom smoke cannot create the Phaser scene), so the e2e test, which reads the probe's `roads` and `partners` and fails on any console error, covers it. (2) The e2e plants the route through the save as planned; to reach Millbrook (off the view from home) it uses the existing debug `reveal` and `goto millbrook`, then `blight 2 millbrook` and `days 1` for the silence. (3) Manual: partners in §3 "Places", a "Trade roads" subsection, partners as clean sources in §8; the Lodge-3 road text was step 03's and is left as it is.

Stale manual screenshots for step 08: every `world-*.png` (start, travelling, confront, parties, blight, improve, after-victory) was taken with the stand-in `map_resource` icon where Millbrook and Saltmere now show their own icons; a shot with a road is new.

Checked by eye (screenshots kept outside the repo, in the scratchpad: `roads-1280.png`, `roads-840.png`, `roads-silent-840.png`): dashes read over clean and darker land in gold; red throughout when the partner is silent; partner icon shows. At 840x560 the map view is short, so a partner near the footer can sit under the buttons (the existing layout). No amber stretch was captured; the colour is checked by `roadsView.test.ts`.

Results: `npm test` 101 files, 2489 tests pass; `npm run build` passes; `npm run test:browser` ran three times under heavy machine load (step 07's simulator running): runs 1 and 2 failed on timeouts in "fights any encounter at any threat..." (debug.test.ts) and, in run 3, "drags gear between the equipment, the backpack and the baggage" (character.test.ts); each passed when rerun alone (debug.test.ts whole file 4 of 4, the gear drag alone). No rule changed: the refactor guard is untouched and green, the 50-campaign check was not needed.

Searched `CLAUDE.md`, `.claude/` and `docs/reference` for `LOCATION_SPRITES` and the `map_resource` stand-in: none left (only the scenes reference now names `roadsView.ts`).

Review round 1 (clean, four non-blocking findings), all fixed: (1) the probe's `partners[].grey` reads the drawn sprite's tint and label colour, asserted in the e2e test; (2) a silent partner is greyed, and its "Silent while the blight holds its land." line told, only when it is contacted or in sight (`silenceShown`, `partnerInfoLines`' `inSight`), with unit tests; (3) a raided road's first line is "The Millbrook road: security 75%, pays nothing while raided." (C5 wording updated here); (4) the manual says gold is "clean, or tainted or blighted but guarded (corrupted land cannot be guarded)" and that the hover's income counts watchtowers, not parties.

