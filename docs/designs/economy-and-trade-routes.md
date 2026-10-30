# The economy: site improvements, income buildings and trade routes

## 1. Purpose and status

Today the encampment earns in only two ways. Every 5 days each held site yields 2 of its material (3 with an outpost), and the encampment yields 2 gold. Tainted land halves a yield, and the blight takes a site at level 2.

The other designs add big sinks:
- forging, tempering and runes ([`gear-and-runes.md`](gear-and-runes.md));
- a campaign three or four times as long ([`campaign-to-level-20.md`](campaign-to-level-20.md)).

The simulator's record already notes that gold is too scarce, after the hall and recruits, to buy much gear.

This design gives the encampment an economy that grows with the campaign and is tied to the land the party protects. It has three parts:

1. **Site improvements.** A held resource site is raised from an outpost to **works** (more yield) and then to a **fort** (harder to lose). Higher levels are unlocked by a new encampment building, the **Builders' Lodge**.
2. **Income buildings.** The trading post's upper levels become a **Market** and a **Trading House**, which bring in **passive gold**.
3. **Trade routes.** Once the party has reached a distant **trade partner**, the Trading House can open a **route** to it: a fixed road of hexes from the encampment. Every yield day it brings gold and the partner's goods, scaled by how much of the road is clean. Blight on the road cuts the income. Nests near it raid the road. A road raided for too long is abandoned.

It keeps a rule from [`blight.md`](blight.md) §4.7: **waiting is not free money.** Every new source of income stands on land the blight contests, and the blight grows with time. Sitting at home lets the routes and sites that pay decay.

**Status: ready for planning, with assumptions.** Nothing blocks the first step. Section 8 lists the decisions taken on the user's behalf. The numbers are first values for the retune (R12).

Where this design and the code differ, the code is right.

## 2. Requirements and scope

### Functional requirements

| ID | Requirement |
| --- | --- |
| R1 | **Improvement levels.** A held resource site has an improvement level from 0 to 3. Level 1 is today's outpost. Level 2, **works**, adds yield. Level 3, a **fort**, adds strength and is lost only at `MAX_BLIGHT`, not `LOSS_LEVEL`. Each level is built by the party standing on the site and takes a day, as an outpost does. When a site is lost, all of its levels are razed. |
| R2 | **The Builders' Lodge**, a new encampment facility with levels 1 to 3: works (1), forts (2) and **roads** (3, R10). |
| R3 | **Works by material.** A works is a Mine, Lumber Camp, Quarry, Saltworks or Peat Cuttings, named by the site's material. The name is cosmetic; the rule is the same for all. |
| R4 | **Market income.** Trading post levels 4 to 6 bring passive gold every yield day. This extends the trading post table in [`gear-and-runes.md`](gear-and-runes.md) §4.3. The income is halved while the encampment's hex is tainted, as a site's yield is. |
| R5 | **Trade partners.** These are a new kind of world location: neutral settlements, placed on the map, which the party **contacts** by walking onto them once. A partner is never held. It falls **silent** while its hex is at `LOSS_LEVEL` or worse, and wakes when the hex is cleansed. |
| R6 | **Establishing a route.** At the encampment, the trading post opens a route to a contacted partner, up to its level's route limit. It costs gold and a material. The road is fixed at that moment: the shortest path over the world map from the encampment to the partner, avoiding monster locations. Reopening a route recomputes the road. |
| R7 | **Route income.** Every yield day each open route pays gold, set by the length of its road and its **security**, and every second yield day 1 of the partner's good. Security is the share of road hexes that are clean, counting tainted hexes as half, blighted or worse as none, and a hex **guarded** by a watchtower as clean. |
| R8 | **Raids.** A route is **raided** on a yield day when any road hex is corrupted, or any monster location stands within `RAID_RADIUS` of the road, or its partner is silent. It then pays nothing, and an event names the cause. After `ABANDON_AFTER` raided yield days in a row, the route is **abandoned** and must be reopened at full cost. |
| R9 | **Warnings.** Like a threatened site, a route is reported once when it becomes raided and once when it is restored. The world map draws every road coloured by its security, and marks raiders. |
| R10 | **Roads (Lodge 3).** Each open route's road becomes a weak clean source in the blight's contest, so a protected route helps hold the land it crosses. |
| R11 | **The simulator** builds improvements, raises the Lodge, opens routes and protects them. Its `nextTarget` weighs nests that raid a route as it weighs nests that threaten a site. It records income by source. |
| R12 | **Retune.** The early game stays near its figure. The long campaign's gold supports roughly the expected kit of [`gear-and-runes.md`](gear-and-runes.md) §5.8. A party that only waits earns less a day than one that fights. |

### Quality constraints

- The territory and blight rules stay Phaser-free and deterministic. Route paths and income draw on no RNG.
- The blight's daily cost stays near linear in the map's hexes. Roads are sources, recomputed only when routes change, through the existing `fields` memo.
- Everything is paid from the stock, as now. Refusals are strings, as in the other facility modules.

### Non-goals

- **Caravan battles or ambush encounters on the road.** A raid is economic only. Encounters on the road are a later idea.
- **Prices that vary over time, supply and demand, or taxes.**
- **Building routes between two sites, or between partners.** A route always runs from the encampment.
- **Food, upkeep or wages.** Improvements cost nothing once built.
- **Refining chains,** such as smelting ore into ingots. Partners' goods supply rare materials instead.
- **Towns the party holds.** Partners are neutral and never yield as sites do.

### Acceptance criteria

| ID | Criterion | Requirements |
| --- | --- | --- |
| A1 | A site raised to 1, 2 and 3 yields and pushes as in §4.1. A fort is not lost at level 2 and is lost at level 3. All of its levels are razed on loss. Old saves' `outposts` load as level 1. | R1, R3 |
| A2 | Lodge levels gate works, forts and roads. Each refusal is tested. | R2 |
| A3 | Market income appears in the yield events at trading post levels 4 to 6, and is halved on tainted ground. | R4 |
| A4 | A partner is contacted by stepping on it, falls silent at `LOSS_LEVEL` and wakes at 0. | R5 |
| A5 | Establishing a route checks the level, the limit, the cost and contact, and computes a deterministic road. The road avoids monster locations and is recomputed on reopening. | R6 |
| A6 | Route income matches the formula on fixed boards: all clean, half tainted, guarded by a tower. A raid has each of its three causes. A route is abandoned after `ABANDON_AFTER` raided days. | R7, R8 |
| A7 | Events and the map's road overlay show raided, restored and abandoned routes. Scene tests cover the Routes tab. | R9 |
| A8 | With Lodge 3, a road hex's net influence includes the road source. Without it, nothing changes. | R10 |
| A9 | The simulator opens and protects routes. Its record shows gold by source. A **waiting check**, the careful party camping at home for N days against fighting for them, shows waiting earns less. | R11, R12 |
| A10 | `--ready-level 7` stays near the early-game figure. The long campaign's gear tracks the expected kit. | R12 |

## 3. Current system (inspected)

- **Territory.** In [`src/game/territory.ts`](../../src/game/territory.ts):
  - `Material` lists nine materials, and `RESOURCE_YIELDS` gives each site's material and amount (2).
  - `siteYield` adds `OUTPOST_YIELD` (1) for an outpost.
  - `updateTerritory` captures a site at level 0 and loses it at `LOSS_LEVEL` (2), razing its outpost.
  - It reports threatened sites once (`site_threatened`, `daysToFall`).
  - Every `YIELD_DAYS` (5) it adds yields, halved on tainted ground, and emits `yield` events.
- **Buildings.** In [`src/game/buildings.ts`](../../src/game/buildings.ts):
  - An outpost (`OUTPOST_COST`: 15 gold, 10 timber) is built by the party on a held resource and takes a day. It is kept as `world.outposts: string[]`.
  - Watchtowers are clean sources, kept `TOWER_SPACING` (4) apart, and are lost as sites are.
  - The shrine adds `SHRINE_STRENGTH` to the encampment.
- **The blight.** In [`src/game/blight.ts`](../../src/game/blight.ts):
  - Influence is a sum of fields from sources: monsters, the Source, held sites, towers and the party.
  - `fields` is memoised on the list of sources, and `siteStrength` adds `OUTPOST_STRENGTH` (3).
  - World events include `yield`, `site_threatened`, `site_lost` and `outpost_built`.
  - `isNotable` in [`worldMap.ts`](../../src/game/worldMap.ts) decides what interrupts travel.
- **Facilities.** In [`src/game/encampment.ts`](../../src/game/encampment.ts), `FacilityId` covers five facilities, read through the `FACILITIES` table and drawn by `encampmentView.ts` with one sprite per facility level.
- **The trading post.** In [`src/game/tradingPost.ts`](../../src/game/tradingPost.ts), it has levels 1 to 3. The gear design adds a level 4.
- **Settlements.** Earlier towns were taken off the map, leaving the encampment as the only settlement (CLAUDE.md, rules of scaling). That lowered gold income and made the shrine and outposts rarer. No neutral location kind exists: `LocationKind` is `monsters`, `encampment` or `resource`.
- **The simulator.** In [`scripts/simulate.ts`](../../scripts/simulate.ts):
  - It builds towers where it stops, and outposts within `OUTPOST_ERRAND_RADIUS` (`outpostErrand`).
  - It goes home by `hallErrand`.
  - `nextTarget` weighs nests pushing on threatened sites.
  - Its record has `goldOnGear` and `goldFromSales`, but no income by source.

## 4. Proposed behaviour

### 4.1 Site improvements

| Level | Name | Unlocked by | Cost | Yield (on top of 2) | Strength (on top of 3) | Lost at |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Outpost | — | 15 gold, 10 timber (today) | +1 | +3 | level 2 |
| 2 | Works (Mine, Lumber Camp, …) | Lodge 1 | 30 gold, 15 stone | +3 | +3 | level 2 |
| 3 | Fort | Lodge 2 | 50 gold, 20 iron, 10 stone | +3 | +7 | level 3 (corrupted) |

**Building.** The party stands on the held site and builds the next level, which takes a day. This uses the outpost's existing flow and button, which become **Improve**.

**Losing a fort.** Because it is lost only at corrupted, a fort turns the blight's slow creep into a siege the party has time to answer. The `site_threatened` warning uses `daysToFall` with the site's own loss level.

**The works' names** come from the site's material:

| Works | Materials |
| --- | --- |
| Mine | iron, gold, silver, copper, crystal, and the gear design's ores |
| Lumber Camp | timber and the woods |
| Quarry | stone |
| Saltworks | salt |
| Peat Cuttings | peat |

### 4.2 Encampment buildings

**The Builders' Lodge** is a new facility:

| Level | Cost | Unlocks |
| --- | --- | --- |
| 1 | 30 gold, 20 timber | Works on held sites |
| 2 | 60 gold, 25 stone | Forts |
| 3 | 100 gold, 20 iron, 20 stone | Roads: open routes push back the blight (§4.4) |

**The trading post's upper levels** extend the gear design's level 4:

| Level | Name | Cost | Sells (gear design) | Passive gold every yield day | Routes |
| --- | --- | --- | --- | --- | --- |
| 1–3 | Trading Post | as today | as today | — | 0 |
| 4 | Market | 120 gold, 20 silver | tier 2, rank 2 runes | 2 | 1 |
| 5 | Market Hall | 160 gold, 30 silver, 20 stone | as 4, plus partners' goods for sale (§4.3) | 3 | 2 |
| 6 | Trading House | 220 gold, 40 silver, 10 crystal | as 5 | 5 | 4 |

Passive gold arrives with the yields, as `yield` events from the encampment, and is halved when the encampment's hex is tainted.

### 4.3 Trade partners

Partners are neutral settlements, each with a **good**:
- Its route pays some of that good.
- From the Market Hall, the trading post also sells it, at 3 gold a unit.

That gives the party a way to buy the rare materials of [`gear-and-runes.md`](gear-and-runes.md), at a price, rather than only holding the far sites that yield them.

**First placements**, in the rings of [`campaign-to-level-20.md`](campaign-to-level-20.md) §4.1:

| Partner | Ring (threat) | Good |
| --- | --- | --- |
| Millbrook (a farming village) | 2 | timber |
| Saltmere (a fishing port on the south coast) | 5 | salt |
| Stonehollow (a mountain hold) | 7 | mithril |
| Elder Glade (a forest people) | 12 | elderwood |
| Emberwatch (a fortified pass) | 15 | adamant |

On today's 60 × 40 map, before the campaign design's map exists, only Millbrook and Saltmere are placed.

**Contact.** The party contacts a partner by walking onto its hex. This uses the confrontation flow without a fight, and the walk takes no extra day. Contact is permanent.

**Silence.** A partner falls silent while its hex is at `LOSS_LEVEL` or worse. A partner is a clean source of strength 3, like a site, so it holds its own land a little. It is not a held site: it yields nothing directly and is never lost.

### 4.4 Routes

**Opening a route.** At the trading post's new **Routes** tab:
1. The player picks a contacted, non-silent partner.
2. The tab shows the road the route would take, its length, its expected income and its cost.
3. The player confirms, and the route opens.

The road is the shortest path on the world map from the encampment to the partner. It avoids monster locations' hexes and their neighbours, and uses the world map's movement costs. It is fixed from then on.

The cost is 20 gold + 1 gold per 2 hexes of road, plus 10 timber.

**Income on each yield day** (every `YIELD_DAYS`):

```
security  = (clean + guarded + ½ · tainted) / length          // blighted or corrupted count 0
gold      = floor(ROUTE_BASE + length / ROUTE_HEXES_PER_GOLD) × security, rounded down
good      = 1 of the partner's good, on every second yield day, if security ≥ ½
```

- A **guarded** hex is a tainted or blighted hex within `GUARD_RADIUS` (3) of a standing watchtower. It counts as clean for security, though it may still be raided.
- First values: `ROUTE_BASE` = 1 and `ROUTE_HEXES_PER_GOLD` = 10. A clean 30-hex route to Saltmere pays 4 gold a yield day, about as much as two sites.

**Raids.** A route is raided on a yield day for the first of these causes that holds:
1. its partner is silent;
2. any road hex is corrupted;
3. a monster location stands within `RAID_RADIUS` (2) of the road.

A raided route pays nothing that day and emits `route_raided` with the cause. The first time it is raided in a row, the event is notable and interrupts travel and camping.

After `ABANDON_AFTER` (6, which is 30 days) raided yield days in a row, the route is abandoned: `route_abandoned`, notable. Its slot is freed. The first yield day without a raid emits `route_restored` and resets the count.

**Roads (Lodge 3).** Each open route's road hexes become clean sources of strength `ROAD_STRENGTH` (1), counted as one source per road hex, with the usual fall-off of [`blight.md`](blight.md) §4.2. They stop at an abandoned route.

**Protecting a route** uses tools the party already has:
- clearing the nests near the road;
- building watchtowers along it;
- holding, improving and fortifying the sites beside it;
- the shrine for the first hexes out of the encampment.

### 4.5 How the player sees it

- **The world map:**
  - Each road is drawn as a dashed line: gold where it is secure, amber where tainted, red where raided.
  - Partners have their own icon, and a silent partner is greyed.
  - Hovering a road shows its security, its income and any raid's cause.
- **The world events list** reports raids, restorations and abandonments as it reports threatened sites.
- **The encampment screen** shows the Builders' Lodge, and the trading post with its Market name at levels 4 to 6.
- **Income.** A "this yield" line in the stock panel (`worldEvents.ts`) sums the last yield day by source: sites, market and routes.

### 4.6 Edge cases

- **No road can be found.** The partner may be walled in by monsters or off the map's reach. The route is refused with "No safe road to Stonehollow."
- **A monster spawns on the road.** This raids the route, by `RAID_RADIUS`. The road is not re-routed, because a fixed road is what makes protecting it meaningful.
- **The encampment is lost.** The game ends as today.
- **Lodge 3 is built while routes are open.** Their roads start pushing on the next day.
- **A site loses its improvements at `LOSS_LEVEL`,** or at `MAX_BLIGHT` for a fort. All levels go, with `site_lost` and an `improvement` field saying how much was razed.
- **The waiting check.** Market income, 5 gold a yield day at most, is the only income that needs no land beyond the encampment. Raising the trading post to 6 costs more than 100 yield days of that, so waiting is never a strategy, even counted on its own.

## 5. Technical design

### 5.1 State

*Proposed* changes to `WorldState`:
- `improvements: Record<string, 1 | 2 | 3>` replaces `outposts: string[]`. `outposts` becomes a derived helper, `siteImprovement(world, id) >= 1`. Saves migrate it: each id in a saved `outposts` becomes level 1.
- `lodge: number`, from 0 to `MAX_LODGE_LEVEL` (3).
- `contacted: string[]`, the partner ids.
- `routes: TradeRoute[]`, where:

```ts
export interface TradeRoute {
  id: string            // 'route_<partner>'
  partner: string
  road: Hex[]           // encampment's hex excluded, partner's included; fixed
  opened: number        // world turn
  raidedDays: number    // consecutive raided yield days
}
```

- `routesOpened: number`, for naming and the record.

`MonsterLocation`, `QuietLocation` and a new `PartnerLocation { kind: 'partner'; good: Material }` make up `WorldLocation`. `sites()` excludes partners. The `Material` type gains whatever the gear design adds; partners' goods use it.

Bump `SAVE_VERSION`. If they land together, one bump can serve this design, the gear design and the campaign design.

### 5.2 Modules

**[`src/game/territory.ts`](../../src/game/territory.ts):**
- `siteYield` reads the improvement level: +1, +3, +3.
- `lossLevel(world, site)` is `MAX_BLIGHT` for a fort, else `LOSS_LEVEL`. `updateTerritory` and `daysToFall` use it.
- Market income is added in the yield step, with an encampment `yield` event of `source: 'market'`.

**[`src/game/blight.ts`](../../src/game/blight.ts):**
- `siteStrength` reads the improvement level: +3, +3, +7.
- Partners are clean sources of `PARTNER_STRENGTH` (3).
- With Lodge 3, `sources()` adds a road source for each hex of every open route.
- The `fields` memo key already covers the source list, so routes change it only when opened, abandoned or when the Lodge is raised.
- `WorldEvent` gains:
  - `site_improved { site, name, level }`, which replaces `outpost_built` (kept as an alias for level 1 in the log);
  - `partner_contacted`;
  - `partner_silent` and `partner_restored`;
  - `route_opened`;
  - `route_raided { route, partner, cause: 'silent' | 'corrupted' | 'raiders', raider? }`;
  - `route_restored`;
  - `route_abandoned`;
  - `yield` gains an optional `source: 'site' | 'market' | 'route'` and `route?`.

**[`src/game/buildings.ts`](../../src/game/buildings.ts):**
- `improveSite(world, party)` and `improveRefusal(world)` replace `buildOutpost` and `canBuildOutpost`, at the next level with its cost and Lodge gate. The old names stay as wrappers for level 1 until callers move.
- `LODGE_COSTS`, `raiseLodge(world)` and `lodgeCost(world)` are added.

*Proposed* new module, [`src/game/trade.ts`](../../src/game/trade.ts):
- `partners(world)` and `contactPartner(world, id)`, called from the travel step when the party enters a partner's hex;
- `routeLimit(world)`;
- `roadTo(world, partner)`, a deterministic path over the world board. It uses the same passability as `travel`, treats monster hexes and their neighbours as blocked, and breaks ties by `hexKey`;
- `openRouteRefusal(game, partnerId)` and `openRoute(game, partnerId)`;
- `routeSecurity(world, route)`, `routeIncome(world, route)` and `raidCause(world, route)`;
- `tradeDay(world)`, called by `updateTerritory` on yield days. It pays routes, counts raids, abandons routes and returns events.

**[`src/game/encampment.ts`](../../src/game/encampment.ts)** gains the `builders_lodge` facility in `FACILITIES`. The trading post's effect line names Market, Market Hall or Trading House and the income.

**[`src/game/worldMap.ts`](../../src/game/worldMap.ts):**
- partners in `newWorld`;
- `isNotable` gains `route_raided` (first of a run), `route_abandoned` and `partner_silent`.

### 5.3 Scenes

- **[`WorldScene.ts`](../../src/scenes/WorldScene.ts):**
  - a roads overlay layer under the locations, with segments coloured per hex;
  - partner icons;
  - the Improve button where the Build Outpost button was, showing the next level and its cost or refusal;
  - a hover tooltip on roads.
- **The trading post scene:** a **Routes** tab listing contacted partners with their status. A partner not yet routed has an Open button, the road previewed on a minimap strip with its length and expected income. An open route shows its security, its last income and a raided count.
- **[`encampmentView.ts`](../../src/scenes/encampmentView.ts):** a plot and sprite frames for the Lodge (`camp_lodge`, `level_1..3`), drawn by a subagent per [`sprite-drawing-guidance.md`](sprite-drawing-guidance.md).
- **`worldEvents.ts`:** lines for the new events, and the yield summary by source.

### 5.4 The simulator

*Proposed* in [`scripts/simulate.ts`](../../scripts/simulate.ts):

- **Improvements.** `outpostErrand` becomes `improveErrand`: the nearest held site within `OUTPOST_ERRAND_RADIUS` below the highest level the Lodge allows, if the stock affords it. Forts go first on sites with `daysToFall` under 30.
- **Home visits.** `visitFacilities` raises the Lodge after the trading post's market levels when routes are possible, and opens routes to every contacted partner while slots allow, nearest first.
- **Contact.** The careful party detours to an uncontacted partner within 8 hexes of its path. This is a new branch of `nextTarget`, taken when no site is threatened.
- **Protection.** `nextTarget` treats a monster location raiding a route as pushing on a threatened site: it is weighed with the same rule, nearest raider first. After a win, a watchtower is preferred on a road hex that is tainted and unguarded.
- **The record** gains:
  - gold by source (sites, market, routes, sales);
  - routes opened, raided and abandoned;
  - improvement levels at the end;
  - gold per day while camped at home, against the campaign's average.

  The summary prints them.
- **The waiting check** (A9): a test-only helper that runs a fixed seed's world forward N days with the party at home, then compares its gold with the same N days of the campaign. It lives in `simulate.test.ts` at a small N, and as a summary line in long runs.

## 6. Consequences

- **Saves.** `outposts` is migrated to `improvements`, and the new fields have defaults. `SAVE_VERSION` is bumped, shared with the companion designs if they land together.
- **The early game.** Before Lodge 1 and trading post 4, nothing changes except Millbrook and Saltmere, which the party may contact. Opening their routes needs trading post 4, which the early game rarely reaches. The `--ready-level 7` check confirms the early game.
- **The blight.**
  - Partners and roads are new clean sources, and forts make sites stickier. All of these push the contest toward the party, mostly in the middle rings.
  - Roads are on only at Lodge 3, and `ROAD_STRENGTH` is the lever.
  - If the long campaign's land ends too clean (the trial already ended at 3% blighted), lower `ROAD_STRENGTH` or the forts' strength, or raise the blight's growth late on.
- **Performance.**
  - Routes add up to 4 × ~60 road sources to the field computation, but only when the source list changes.
  - `tradeDay` runs every fifth day, over at most 4 roads.
  - `roadTo` runs only when a route opens.
- **Pacing.** Routes reward a party that holds a corridor. That fits the campaign design's rings: the corridor out to Stonehollow is the corridor the party fights along. The risk is a party pulled back too often to defend roads. `ABANDON_AFTER` and `RAID_RADIUS` are the levers.

## 7. Verification

### 7.1 Tests

Tests run under `make test` (podman). The domain project can be run locally with `npx vitest run --project domain`.

- **`territory.test.ts`:**
  - yields and strength by improvement level;
  - a fort's loss level;
  - razing;
  - market income and taint;
  - `daysToFall` with a fort (A1, A3).
- **`buildings.test.ts`:**
  - `improveSite` levels, costs, Lodge gates and refusals;
  - `raiseLodge` (A1, A2).
- **`trade.test.ts` (new):**
  - contact;
  - `roadTo` determinism and avoidance;
  - refusals;
  - the income formula on small boards;
  - each raid cause;
  - abandonment and restoration;
  - partners' goods every second yield day (A4–A6).
- **`blight.test.ts`:**
  - partners and roads as sources;
  - road sources only with Lodge 3;
  - the memo key changes when a route opens (A8).
- **`save.test.ts`:** migrating `outposts` to `improvements`, and round-tripping routes.
- **`encampment.test.ts`:** the Lodge facility, and the trading post's names and income lines.
- **Scene tests:**
  - the Improve button;
  - the road overlay colours;
  - the Routes tab;
  - the event lines (A7).
- **`scripts/simulate.test.ts`:**
  - `improveErrand`;
  - the route-opening choice;
  - raiders weighed in `nextTarget`;
  - the waiting check (A9).

### 7.2 Simulator acceptance

1. `--ready-level 7` stays near the early-game figure (A10).
2. On the long campaign:
   - gold by source shows routes and markets becoming the main income past the middle rings;
   - routes are raided some of the time, and abandoned rarely;
   - the gear design's expected kit is reached within a tier (A10).
3. The waiting summary line shows camping at home earns less a day than the campaign's average (A9).

### 7.3 Suggested order (for the planner)

1. **Improvements.** The state migration, levels 1 to 3, the Builders' Lodge, the Improve flow, and the simulator's `improveErrand`.
2. **Market income.** Trading post levels 4 to 6 with passive gold. Coordinate with the gear design's level 4.
3. **Partners.** The location kind, contact and silence, Millbrook and Saltmere on today's map.
4. **Routes.** `trade.ts`, the Routes tab, the road overlay, events, and the simulator opening and protecting routes.
5. **Roads.** Lodge 3 and road sources.
6. **Retune and docs.** CLAUDE.md (territory, buildings, the simulator), the manual, and [`blight.md`](blight.md) §4.6 and §4.7.

Steps 1 to 4 work on today's map. The campaign design's bigger map adds the outer partners.

## 8. Open questions and assumptions

None of these block step 1. They are recorded with the default taken.

| # | Question | Default taken |
| --- | --- | --- |
| 8.1 | Do improvements need the party on site? | Yes, as outposts do. Building is a reason to walk the land. |
| 8.2 | Is a raid purely economic, or a battle the party can fight on the road? | Economic. Road encounters are a later idea. |
| 8.3 | Is the road fixed at opening, or re-routed daily around trouble? | Fixed. That is what makes it something to protect. Reopening recomputes it. |
| 8.4 | Does income go only into the encampment's stock? | Yes, as yields do, whatever the party's location. |
| 8.5 | Are partners neutral, never held and never lost, only silenced? | Yes. Bringing back held towns would undo the earlier decision that the encampment is the only settlement. |
| 8.6 | Do partners sell their good at the Market Hall? | Yes, at 3 gold a unit, so rare materials have a gold price as well as a site. |
| 8.7 | Do watchtowers guard road hexes? | Yes, within 3 hexes, for security only. They do not stop raids. |
| 8.8 | Do improvements cost upkeep? | No. Upkeep would add a drain the simulator's economy can't yet carry. |
| 8.9 | Does the gear design's trading post level 4 become the Market? | Yes. One table, levels 4 to 6, both designs' effects. |

**Risks:**
- **The blight's balance** with new clean sources (§6).
- **A party pulled home and back to defend roads,** with the long walks of the campaign design.
- **The UI cost** of the road overlay and the Routes tab.
- **The early game.** It must not reach market income early enough to change the 64% figure.
