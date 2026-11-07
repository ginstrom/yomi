# Stage 8: Trade partners and routes

Part of [the long campaign](index.md). Reference:
- [`reference/economy-and-trade-routes.md`](reference/economy-and-trade-routes.md) §4.3 to §4.6, §5 (partners, routes and roads) and §5.4 (routes);
- [`reference/multiple-parties.md`](reference/multiple-parties.md) R10 (road guards).

## 1. Purpose and status

Neutral **trade partners** appear on the map. Once the party has visited one, the trading post can open a **route** to it: a fixed road from the encampment, which pays every yield day by its length and by how clean it is.

The blight on the road cuts the income. A nest near the road, or a silent partner, raids it. A route raided for 30 days is abandoned. Watchtowers and parties near the road guard it. At Builders' Lodge level 3, open roads push back the blight.

**Status:** ready for planning.

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
