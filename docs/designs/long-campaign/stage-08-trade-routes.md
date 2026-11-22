# Stage 8: Trade partners and routes

Part of [the long campaign](index.md). Reference:
- [`reference/economy-and-trade-routes.md`](reference/economy-and-trade-routes.md) §4.3 to §4.6, §5 (partners, routes and roads) and §5.4 (routes);
- [`reference/multiple-parties.md`](reference/multiple-parties.md) R10 (road guards).

## 1. Purpose and status

Neutral **trade partners** appear on the map. Once the party has visited one, the trading post can open a **route** to it: a fixed road from the encampment, which pays every yield day by its length and by how clean it is.

The blight on the road cuts the income. A nest near the road, or a silent partner, raids it. A route raided for 30 days is abandoned. Watchtowers and parties near the road guard it. At Builders' Lodge level 3, open roads push back the blight.

**Status:** done (see [Implementation notes](#implementation-notes)).

## 2. Scope

**In:**
- **Partners.**
  - `PartnerLocation` (kind `partner`, with a `good`).
  - On today's map:
    - **Millbrook** (timber) at (18, 30), in the threat 2 ring;
    - **Saltmere** (salt) at (30, 38), on the south edge in the threat 3 ring.

    Stage 9 moves them into the new rings and adds the far partners.
  - Contact by stepping on a partner, and silence at `LOSS_LEVEL`.
  - Partners are clean sources of strength 3.
- **Routes.** `src/game/trade.ts`:
  - `roadTo` (deterministic, avoiding monsters and their neighbours);
  - `openRoute` and its refusal;
  - `routeSecurity` and `routeIncome`;
  - `raidCause`;
  - `tradeDay`, called on yield days, which handles raids, `ABANDON_AFTER` and restoration.
- **Route slots** by trading post level: 1, 2 and 4 at levels 4, 5 and 6.
- **Guards.** Watchtowers within `GUARD_RADIUS` (3), and parties within it (company R10), guard road hexes.
- **Roads.** Builders' Lodge level 3 is now active: road sources of `ROAD_STRENGTH` (1) in the blight's fields.
- **Events.** `partner_contacted`, `partner_silent`, `partner_restored`, `route_opened`, `route_raided` (with a cause), `route_restored` and `route_abandoned`. `yield` gains `source: 'route'`. `isNotable` adds the first raid of a run, abandonment and silence.
- **Scenes.**
  - The roads overlay, with each segment coloured by its hex's security.
  - Partner icons, greyed when silent.
  - The road tooltip.
  - The trading post's Routes tab, with a road preview, its length, expected income and cost.
  - Event lines.
  - The stock panel's income by source includes routes.
  - Partner sprites (two settlements).
- **The simulator.**
  - The party detours to uncontacted partners within 8 hexes.
  - It opens routes on home visits.
  - `nextTarget` weighs raiders like threats to sites.
  - Towers are preferred on unguarded tainted road hexes.
  - The guard role's "defend" branch includes raiders.
  - The record gains routes opened, raided and abandoned, and route gold.

**Out:**
- the far partners (stage 9);
- partners' goods for sale at the Market Hall (stage 10, when the goods are rare materials).

## 3. Requirements

Economy R5 to R10, A4 to A8; company R10 and A8.

| ID | Requirement |
| --- | --- |
| S8-R1 | Partners, contact and silence. |
| S8-R2 | Opening routes, road computation, slots and cost. |
| S8-R3 | Route income by security; guards by towers and parties. |
| S8-R4 | Raids by their three causes; abandonment; restoration. |
| S8-R5 | Roads push back the blight at Lodge 3. |
| S8-R6 | The roads overlay, the Routes tab and events. |
| S8-R7 | The simulator's contact, routes, protection and record. |

## 4. What the player sees

- **Walking into Millbrook:** "Millbrook will trade with Oakvale." At the Market, the Routes tab offers "Open a route to Millbrook: 26 hexes, about 3 gold every 5 days, costs 33 gold and 10 timber", with the road drawn on a minimap.
- **On the world map,** a gold dashed road runs from the encampment to Millbrook. When a Goblin Brood spawns two hexes from it, the road turns red: "Raiders on the Millbrook road". The player sends the Second Company. Once the nest is cleared, "The Millbrook road is safe again".
- **A tainted stretch** shows amber, and the income drops. A watchtower beside it turns the stretch gold again.

## 5. Technical notes

- `roadTo` uses the world map's own passability and `hexKey` tie-breaks, so it is the same for a seed.
- Road sources join the fields only at Lodge 3. The memo key covers routes.
- **Versions:** `SAVE_VERSION` is bumped (routes, contacts and partners).

## 6. Verification

**Tests:** economy A4 to A8 (`trade.test.ts`, `blight.test.ts`, the save, scene tests); company A8.

**Simulator:**
1. The early-game guard. Routes need trading post level 4, which the early game rarely reaches, so expect little change. Record the route counts.
2. `--ready-level 10` with the company: routes are opened, raided sometimes, and rarely abandoned. Route gold is a visible share of income.

**Play script:**
1. Walk to Millbrook and see contact. Run `facility trading_post 4` and `stock gold 100 timber 20`, then open a route. See the road overlay and the cost spent.
2. Run `days 20` and see route yields in the stock panel.
3. Use the debug console to place a spawn near the road, or wait for one. See the raid warning and zero income. Clear it and see the route restored.
4. Leave a raider for 30 days. See the route abandoned and its slot freed.
5. Build a watchtower on a tainted road hex and see its stretch turn gold. Garrison a party on another stretch and see the same.
6. Run `facility builders_lodge 3`, then `days 60`. See the blight retreat along the road.

## 7. Risks

- **Roads tipping the blight.** `ROAD_STRENGTH` is the lever.
- **The party pulled back to defend roads.** `RAID_RADIUS` and `ABANDON_AFTER` are the levers.

**Done when:** all tests pass, the guard holds, and the play script has been walked.

## Implementation notes

Built as eight steps (`docs/implementation-plans/long-campaign-stage-08/`).

**The figures** (500 campaigns from seed 1 each; "start" is step 01's measure before any change, "end" step 08's on the final tree):

| Run | Source beaten | Days | Battles | Heroes dead in won battles | Sites captured, lost | Land blighted at the end | Gold a campaign (sites, market, routes, sales) | Partners contacted; routes opened, raided, abandoned |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| The guard, `--parties 1`, start | 239 | 286 | 19.5 | 1.1 | 3.4, 0.1 | 38% | 228, 0, —, 42 | — |
| The guard, `--parties 1`, end | 233 | 284 | 19.3 | 1.2 | 3.3, 0.1 | 38% | 226, 0, 0, 42 | 0.47; 0, 0, 0 |
| The default company, start | 239 | 286 | 19.5 | 1.1 | 3.4, 0.1 | 38% | 227, 0, —, 42 | — |
| The default company, end | 232 | 285 | 19.3 | 1.2 | 3.3, 0.1 | 38% | 226, 0, 0, 42 | 0.47; 0, 0, 0 |
| `--ready-level 10`, start | 434 | 509 | 42.1 | 1.0 | 5.4, 0.5 | 26% | 406, 3, —, 144 | — |
| `--ready-level 10`, end | 433 | 509 | 42.2 | 1.0 | 5.4, 0.5 | 26% | 406, 3, 1, 147 | 0.54; 0.03, 0, 0 |
| `--ready-level 10 --trading-post 4` (measuring only, no band) | 487 | 624 | 58.3 | 0.9 | 6.7, 0.7 | 14% | 497, 257, 39, 190 | 1.82; 0.47, 0, 0 |

- *Check 1, the early-game guard:* 233 of 500 with one party, 6 below the start, and the company 232, 7 below; both inside the user's bands (215–250, 220–260; days 284 in 243–297; deaths 1.2, at most 2.0). The move is the partners alone: they stand on the map from day one as clean sources of `PARTNER_STRENGTH` (3), which reshuffles where corrupted land and so the spawns fall; with them taken out of the simulated world the 50-campaign log is byte for byte the start's, and no route opens in these runs (the post never reaches 4), so roads, raids and tower errands are not in it. The contact detour is gated on the post allowing routes (decision 13 as revised by the user): ungated, it moved the guard to 304 of 500 on its own. Not retuned: the design's levers (`ROAD_STRENGTH`, `RAID_RADIUS`, `ABANDON_AFTER`) act on roads and raids, which do not occur here, and the partners' strength is the design's. Explained in `src/game/CLAUDE.md`.
- *Check 2, `--ready-level 10` with the company:* 433 of 500 (the band 370–420, accepted by the user up to 445; unchanged from 434). Routes open only 0.03 a campaign, as the careful party raises the trading post past 2 almost never under the spend order kept until stage 12 (post 2.1 at the end). By the user's decision (2026-11-22) the check was made targeted: the measuring flag `--trading-post 4` starts the post at the Market. With it, routes open 0.47 a campaign (1.82 partners contacted), route gold is 39 a campaign, 4% of all gold (5% of the yields' gold, beside sites 497 and the market's 257), and no route was raided or abandoned in 500 campaigns: the road keeps out of raid range where it can (decision 6), and the simulated parties weigh raiders near a road before other nests, which likely clears them before a yield day finds them. The Lodge reaches 3 rarely (0.2 at the end), so roads seldom push. The flag moves everything a post level moves (tier-2 gear, market gold), hence the 487 wins, and no band is read with it. Full-campaign route figures, and whether raids happen often enough for `RAID_RADIUS` and `ABANDON_AFTER` to matter, wait for stage 12's spend-order retune.

**Decisions that differ from the design** (the plan index's, in brief, as built): `openRouteRefusal`/`openRoute` take the party and `openRoute` returns `route_opened` (1); contact and silence run daily in `partnerDay` from `updateTerritory`, for any party standing on a partner, and contact is not notable (2); silence is kept for every partner but told, and shown grey on the map, only for one contacted or in sight; a partner is a clean source silent or not (3); partners' goods every second yield day at security ½ or more, as a `source: 'route'` yield (4); `route_raided` every raided yield day with its count, told once, abandoned at the sixth (5); the road keeps more than `RAID_RADIUS` from every nest where it can, else only off nests and their neighbours, and the Routes tab warns "Raided at once" when it cannot (6, the user's decision; this answers the design's open question of a road raided the day it opens); the design's road figures are illustrative: Millbrook's is 14 hexes, Saltmere's 30 (7); previews count towers, not parties (8); watchtowers still need clean land, so "a tower on a tainted road hex" reads as one within 3 hexes of it (9); the overlay colours each segment by its far hex, red throughout while raided, through the fog, and a raided road's hover says it pays nothing (10); the Routes tab shows security, income now and raided days, always present (11); the simulator raises the Lodge to 3 once a route is open (12) and detours to contact only once the post allows routes (13, the user's); `SAVE_VERSION` 28 with no migration, older saves unreadable and the old migration chain removed (15, the user's); routes pay nothing once the encampment is lost (16); sounds reuse cues (17); debug `spawn` and `contact` (18). The Lodge's level 3 sprite was redrawn (carried from stage 7).

**The play script** was walked headless (step 08's record has each part): contact on arrival at Millbrook ("Millbrook will trade with Oakvale."; the party was put two hexes short, as the full walk outlasts a test's time limit), the Routes tab's preview and the cost spent, route yields in `days` and the stock panel, a spawned Brood turning the road red at once, the raid told on the next yield day and "safe again" after it was beaten, abandonment after 30 days with the slot free, a watchtower and a standing party each turning their stretches gold, and at Lodge 3 "The blight is receding here." on the tainted road hexes, none tainted 60 days later.

