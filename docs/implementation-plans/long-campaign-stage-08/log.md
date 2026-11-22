# Log: long campaign, stage 8 (trade partners and routes)

Append-only history for [the plan](index.md) and [the feature record](../../features/long-campaign-stage-08.md): baselines and measurements, run histories, review summaries, and anything else the plan accumulates as steps finish. The orchestrator does not read this file on resume.

## Verification

## Step 01: the stage's baseline (2026-11-21)

Measured by the `yomi-measure` agent on a clean worktree at `b28bba1` (no code change since `42cde46`), seed 1, one run at a time. Logs in `logs/s8-base-*` (gitignored).

| Run | Flags | Source wins | Mean days | Battles | Heroes dead | Gold by source (a campaign) |
| --- | --- | --- | --- | --- | --- | --- |
| 50-campaign check | `--campaign --battles 50 --seed 1 --parties 1` | 23 of 50 | — | — | — | — |
| `one` | `--campaign --battles 500 --seed 1 --parties 1` | 239 of 500 | 286 | 19.5 | 1.1 | sites 228, market 0, sales 42 |
| `company` | `--campaign --battles 500 --seed 1` | 239 of 500 | 286 | 19.5 | 1.1 | sites 227, market 0, sales 42 |
| `rl10` | `--campaign --battles 500 --seed 1 --ready-level 10` | 434 of 500 | 509 | 42.1 | 1.0 | sites 406, market 3, sales 144 |

- 50-campaign SHA-256: `1ceefe633e71c0326c0c5b261c77e1c010c49e30303a85286a782589e74400d1`.
- No income line: it prints only with `--waiting`, which the baseline did not pass.
- `rl10` is 434, above its 370–420 band (accepted up to 445), unchanged from the bands' "Now".

## Step 01: after the change

- 50-campaign check on the step's tree: SHA-256 `1ceefe633e71c0326c0c5b261c77e1c010c49e30303a85286a782589e74400d1`, **identical** to the baseline (23 of 50).
- The refactor guard (`scripts/simulate.test.ts`) passes with the fixture untouched.

## Step 01 outcome

- Step 01 (partners, contact and silence): engineer opus, reviewer opus; verdict clean after 1 review round. Commits `a2df674`, `5916f52`, and the review follow-up (two small save fixes, step 02's route save check, the index trimmed under its cap).

## Step 02: after the change (2026-11-21)

- 50-campaign check: SHA-256 `1ceefe633e71c0326c0c5b261c77e1c010c49e30303a85286a782589e74400d1`, **identical** to the baseline (23 of 50; gold by source: sites 234, market 0, sales 40 a campaign).
- The refactor guard passes with the fixture untouched.
- Roads on a fresh world (`roadTo`, any seed): Millbrook 14 hexes (27 gold, 10 timber; security 0.857, 1 gold a yield day), Saltmere 30 (35 gold, 10 timber; security 0.667, 2 gold); neither raided, the nearest nest 3 hexes from either road.

## Step 02 outcome

- Step 02 (routes, raids and guards): engineer opus, reviewer opus; verdict clean after 2 review rounds. Commits `615a263`, `9d0507a`, `8d2eabe` (tests from round 1) and the round 2 record. In round 2 the engineer disputed the reviewer's partner-hex break: the edit is the same code, because `passable` lets the partner's hex through before it reads the blocked set (see the step's execution record).

## Step 04 outcome

- Step 04 (sprites: partners and the Lodge): engineer sonnet, reviewer opus; verdict clean after 3 review rounds. Commits `15d13ff..861be38`, merged into the stage branch in `07451c5`.

- Step 03 (roads and the Lodge's level 3): engineer sonnet, reviewer opus; verdict clean after 1 review round. Commits `d851174` and the round 1 follow-ups.

- Step 05 (the world map's roads and partners): engineer sonnet, reviewer opus; verdict clean after 1 review round. Commits `75603ad` and the round 1 follow-ups (a `grey` probe field from the drawn tint and label, silence told only when contacted or in sight, "pays nothing while raided" on a raided road, manual wording).

- Step 06 (the Routes tab and the debug console): engineer sonnet, reviewer opus; verdict clean after 2 review rounds. Commits `ba4b82b`, the round 1 follow-ups `a04d476` and the round 2 follow-ups (`spawn` takes a named hex, never a party's).

## Step 07: the simulator's trade (2026-11-22)

- 50-campaign check before `1ceefe63…74400d1` (23/50, identical to step 01); after `b50f7b50626d6e2832deb18c44a808b9be0521002698dc97c1fa8216db904e52` (22/50, 281 days, 0.50 partners contacted, no route). The ungated detour was measured first: `one` 304/500, 359 days, out of band; the user chose to gate it on trading post 4 (decision 13). Gated, 500 campaigns: `one` 233 (284 days), `company` 232 (285 days), `rl10` 433 (509 days; 0.54 partners contacted, 0.03 routes opened, 1 route gold, none raided or abandoned). The refactor guard re-recorded once (events `e638f2a4…6f1180`).
- Ungated against gated, 50 campaigns (seed 1, `--parties 1`): partners and no detour 22/50; the detour as first specified 35/50 (375 days); the nest chosen before the detour 31/50; the detour gated on `routeLimit(world) > 0` 22/50. Ungated `one`, 500: 304/500, 359 days, 24.8 battles, 1.2 dead, 1.56 partners contacted, no route.
- 500 campaigns, seed 1, gated, measured by `yomi-measure` one at a time (logs `logs/s8-07-{one,company,rl10}.*` in the step's worktree):

  | Run | Source wins | Mean days | Partners contacted | Routes opened | Route gold (a campaign) |
  | --- | --- | --- | --- | --- | --- |
  | `one`, baseline | 239 | 286 | — | — | — |
  | `one` | 233 (band 215 to 250) | 284 | 0.47 | 0.00 | 0 |
  | `company`, baseline | 239 | 286 | — | — | — |
  | `company` | 232 (band 220 to 260) | 285 | 0.47 | 0.00 | 0 |
  | `rl10`, baseline | 434 | 509 | — | — | — |
  | `rl10` | 433 (370 to 420, accepted up to 445) | 509 | 0.54 | 0.03 | 1 |

  The early game's 6 and 7 points come from the partners' land as clean sources reshuffling the spawns (no detour and no road in it), within the 500-campaign sampling spread.

## Step 07 outcome

- Step 07 (the simulator's trade): engineer opus, reviewer opus; verdict clean after 1 review round. The review's only blocking item was these records (this section and the index row), held back on purpose until the merge; its follow-ups (N2 to N5) are in `9ce59b9`. Commits `1dfbd59`, `9ce59b9`, merged into the stage branch in `c94e05f`.

## Step 08: the final figures (2026-11-22)

Measured by the `yomi-measure` agent at `8256690` (the `--trading-post` flag committed; doc edits uncommitted), seed 1, 500 campaigns, one run at a time. Logs `logs/s8-08-*` (gitignored). The 50-campaign check at `8256690`: `b50f7b50…e52`, identical to step 07's.

| Run | Source wins | Band | Days | Battles | Heroes dead | Blighted at end | Gold (sites, market, routes, sales) | Partners; routes opened, raided, abandoned | Post, Lodge at end |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `one`, baseline | 239 | 215–250 | 286 | 19.5 | 1.1 | 38% | 228, 0, —, 42 | — | 1.1, 0.2 |
| `one` | 233 | in | 284 | 19.3 | 1.2 | 38% | 226, 0, 0, 42 | 0.47; 0, 0, 0 | 1.1, 0.2 |
| `company`, baseline | 239 | 220–260 | 286 | 19.5 | 1.1 | 38% | 227, 0, —, 42 | — | 1.1, 0.2 |
| `company` | 232 | in | 285 | 19.3 | 1.2 | 38% | 226, 0, 0, 42 | 0.47; 0, 0, 0 | 1.1, 0.2 |
| `rl10`, baseline | 434 | 370–420 (accepted to 445) | 509 | 42.1 | 1.0 | 26% | 406, 3, —, 144 | — | 2.1, 0.5 |
| `rl10` | 433 | accepted | 509 | 42.2 | 1.0 | 26% | 406, 3, 1, 147 | 0.54; 0.03, 0, 0 | 2.1, 0.5 |
| `rl10 --trading-post 4` | 487 | none (measuring) | 624 | 58.3 | 0.9 | 14% | 497, 257, 39, 190 | 1.82; 0.47, 0, 0 | 4.3, 0.2 |

- The same as step 07's figures for `one`, `company` and `rl10`: nothing after step 07 moved play.
- The route check (the user's decision of 2026-11-22): with the post started at 4, routes open 0.47 a campaign; route gold 39 a campaign is 4.0% of all gold (983) and 4.9% of the yields' (793); no route raided or abandoned. Campaigns with a route opened: not countable from the outputs (the log holds battle events only).

## Step 08 outcome

- Step 08 (measure, document, play): engineer opus, reviewer opus; verdict clean after 1 review round. Commits `8256690`, `7ac5a98` and the round 1 follow-ups (the scaling sentence with both moves, the amber road colour deepened to `0xfb8c00` and `world-road.png` retaken, blight design and manual wording).

## Verification notes (moved from the feature record, 2026-11-22)

- Full in-browser suite: Node 26.13 V8 crash ('Lazy deopt after a fast API call', in Buffer.byteLength under Vite) hung it at 100% CPU once in step 08; the overall review's full run had no crash (177/179, 2 load timeouts that pass alone). Not stage 8 code.
- Done: step 08 screenshots show amber and blight tints; index decision 13 and C5 wording updated; the Lodge level 3 sprite redrawn in step 04.

## Verification round 1 (2026-11-22)

Fixes for the verification findings, on `d546dfe`; tests first where there was logic.

1. **A raid named an unsighted nest** (QA). `describeWorldEvent` and `describeWorldEvents` take `known` (the world's `sighted`); `route_raided` names its nest only when sighted, else "Raiders on the Millbrook road." (none named without `known`). Every scene caller passes the world (`describeDays`, `describeWalk`, `describeOthers`, the interrupt, `WorldScene`, debug `days`). `roadInfoLines` tells an unsighted raider as "Raided: raiders are within 2 hexes." `raiderName` stays in the event. Tests: `worldEvents.test.ts`, `roadsView.test.ts` (red first).
2. **A refusal shown twice on the Routes tab** (QA). The refusal under the minimap is drawn only while the message line does not already say it. New probe field `TradingPostProbe.routeRefusal`; `e2e/encampment.test.ts` checks it shows for a chosen row and is gone once Open's click puts it in the message.
3. **A shared stretch drawn red over a paying road** (simulated player). `roadSegments` lists raided routes first, the rest in route order, so the paying road is drawn on top. Test: `roadsView.test.ts` (red first).
4. **The plan's `spawn` text** (review): decision 18 in `index.md`, and C6's copy in `06-routes-tab-and-debug.md` (decision 18, the contract line, the command's spec) and step 08's copy, now give the required-hex form.
5. **The dead facility hook** (review): `Facility.refusal`, `FacilityView.barred`, their use in `facilityRefusal` and `EncampmentScene.improve`, and the "(the Lodge's roads)" comment removed; `encampment.test.ts`'s `barred` expectations and the `scenes.md` sentence go with them (`game.md` did not mention it).
6. **The standing route's colour** (review): `ORDER_ROUTE_COLOR` is pale blue `0x81d4fa`, apart from the white hover route and the roads' gold; `scenes.md` and the manual said "amber", now "pale blue". `world-travelling.png` retaken and looked at (the only shot with a standing route): a pale blue line, plainly not a road. The other images that shot run re-rendered were left as they were.
7. **`spawn` and sight** (review): `spawn` ends with `updateSight`. Test: `debugCommands.test.ts`, a nest placed in sight shows its hex seen at 3 (red first).

Docs: `scenes.md`'s helper lines (raider naming, draw order, the refusal shown once).

## Verification round 2: the user's UX decisions (2026-11-22)

Round 1 is `f853663`. Tests first throughout.

- **A. The road hover counts parties.** `roadInfoLines` passes the real presences to `routeSecurity` and `routeIncome`, so the hover agrees with the overlay and today's pay; the Routes tab's preview still counts towers only (decision 8, now scoped to the preview, revised in the index and the 05 and 06 task files' copies; C5's `roadInfoLines` line revised). Test: `roadsView.test.ts` (a guard on the road makes the hover say 100%; red first). Manual: the hover counts watchtowers and parties.
- **B. A raid told the day the road turns red.** `tradeDay` runs its route check every day: the day `raidCause` starts to hold it emits `route_raided` with `days` 0 (notable: stops a journey, has the line and the `world.threatened` cue), the day it stops `route_restored` (not notable), once each, by a new saved flag `TradeRoute.raided`. Yield days keep the count (`route_raided` with `days` 1, 2, …, no longer notable and without a line), the pay and abandonment; a clear yield day ends the count silently. `isNotable`, `describeWorldEvent` and `sounds.ts` read `days === 0`. The simulator's `routesRaided` still counts `days === 1` (raid runs reaching a yield day). Decision 5 and 17 and C2's `isNotable` line revised in the index (and the 05 task file's copies); `docs/reference/game.md`, the manual.
  - **Save:** `TradeRoute` gains `raided`, so `SAVE_VERSION` 28 → 29 by the project rule (no migration; `save.ts` checks the flag; tests: version 29, a route without `raided` unreadable, 28 refused). `LOG_SCHEMA_VERSION` unchanged (world events are not in the battle log).
  - **Simulated outcomes unchanged:** the 50-campaign check `b50f7b50626d6e2832deb18c44a808b9be0521002698dc97c1fa8216db904e52` (identical) and the refactor guard passes (default runs open no route). A `--trading-post` run could now stop walks on a raid between yield days; not measured (no band reads it).
- **C. The Routes tab explains its offers; Open stays allowed.** The offer names the good ("… about 2 gold every 5 days and 1 timber every 10, costs …"). New `routeNotes(row)`, drawn stacked under the minimap: "Raided at once: <cause>." (moved out of the row, which now ends "Raided at once.", so a row fits at 840 × 560), a corrupted road saying how far out ("the blight has overrun it 6 hexes out", only when that hex is explored); "Security 79%: 4 of 14 hexes tainted, 1 corrupted." from a new `RouteRow.weak` (the hexes `hexSecurity` with towers only does not count safe); "1 timber every 10 days while security is 50% or more" (+ " (not now)"). The minimap's length caption went (the row has the length) to make room. New probe field `routeNotes`; `e2e/encampment.test.ts` checks the good in the offer and the note. The worst case (raid, three kinds of unsafe hex, the refusal) looked at at 840 × 560 seemed to fit, but only with the message line empty: with a message showing, the stack ran into it (QA reproduced it; fixed in round 3). C6 revised in the 06 task file; `scenes.md`, the manual; `trading-post-routes.png` retaken and looked at.
- The user accepted that overlay colours on fogged road hexes show the true blight (decision 10); no change.

## Verification round 3 (2026-11-22)

Round 2 is `0c45352`. Tests first; each new test was seen to fail first.

1. **The raid count resets when the road is told safe** (the user's decision). `tradeDay` sets `raidedDays` to 0 with `route_restored`, on whatever day it fires. Test (`trade.test.ts`): raided five yield days, clear on day 26 ("safe again", count 0), red on day 29, only 1 on day 30 and not abandoned. Round 2's test that the count was kept until the yield day now expects 0. Decision 5's revision (index, 05 copy), `game.md` and the manual say so.
2. **Abandonment wins the interrupt.** `interruptOf` (`company.ts`): when the first notable event is a `route_raided` notice and the same day holds a `route_abandoned`, the abandonment is the interrupt, so a walk's stop message tells it. Test (`company.test.ts`): Millbrook's road turns red (a corrupted hex) on the yield day Saltmere's is abandoned; the interrupt is the abandonment. (With item 1, one route cannot be abandoned the day it turns red, so the case is two routes.)
3. **The Routes tab's stack overran the message line** (QA). The stack under the minimap now ends at `STACK_BOTTOM` (`MESSAGE_Y` − 20, above a message of up to two lines): with a refusal to tell, the good's note is left out (`routeNotes(row, { good: false })`), and if the stack is still too tall the notes give way from the last (never the refusal). New probe field `routeStack` (`bottom`, `messageTop`). Test (`e2e/encampment.test.ts`, 840 × 560): Saltmere's road corrupted far out, blighted and tainted below 50% security, refused for the stock, with "A road is opened to Millbrook." in the message line; the stack's bottom is above the message's top (without the fix: 495.5 against 474, failing). Looked at at 840 × 560: the notes ("Raided at once: the blight has overrun it 16 hexes out.", "Security 47%: 10 of 30 hexes tainted, 10 blighted, 1 corrupted.") and the refusal end clear above the message line; fixed.
4. **Stale docs.** `src/game/CLAUDE.md` and `territory.ts`'s header: `tradeDay` runs daily. `scripts/simulate.ts`: `routesRaided` counts `route_raided` with `days` 1, the first raided yield day of a run.

Checks: `npm test` 2,546 passed; `e2e/world.test.ts` and `e2e/encampment.test.ts` 88 passed; the 50-campaign hash `b50f7b50626d6e2832deb18c44a808b9be0521002698dc97c1fa8216db904e52`, identical.
