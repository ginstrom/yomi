# Step 08: Measure, document, play

[Plan index](index.md) · [Stage design](../../designs/long-campaign/stage-08-trade-routes.md) (§6 Verification, §7 Risks) · [Reference](../../designs/long-campaign/reference/economy-and-trade-routes.md) §4.3–§4.6, §5.4, §7.2 · [Company reference](../../designs/long-campaign/reference/multiple-parties.md) R10, A8 · [Stages index](../../designs/long-campaign/index.md) ("The early-game guard", "Docs", "Gameplay verification") · [Plan log](log.md)

**Difficulty:** opus / opus. The engineer (model unset) runs the simulator and makes a balance judgment: if partners, routes and roads move the early-game figure past about 5 points, it decides between explaining the move and retuning `ROAD_STRENGTH`, `RAID_RADIUS` or `ABANDON_AFTER`, and writes it up. It also writes the stage's documentation and walks the play script in a browser. The reviewer (opus) judges whether the docs are true to the code, whether the figures support the claims, and whether the play script was really walked.

## 1. Objective

Close the stage:
- measure the early-game guard (`--parties 1`) and the default company against step 01's baseline, and the company at `--ready-level 10` for routes;
- read the route counts (partners contacted, routes opened, raided, abandoned), route gold's share of income, the Lodge level reached, and the land blighted at the end;
- retune only if the figure moved too far for a cause the design names (§7), with the levers it names;
- bring the CLAUDE.md files, `docs/reference/`, the manual and its screenshots, the blight design, the stage design and the stages index up to date;
- walk the design's play script in the real game and record what was seen.

## 2. Requirements and context

- **Design §6, simulator checks:**
  1. *The early-game guard.* Routes need trading post level 4, which the early game rarely reaches, so expect little change. Record the route counts. (Partners as clean sources and the contact detour do act from day one; expect any move to come from them.)
  2. *`--ready-level 10` with the company:* routes are opened, raided sometimes, and rarely abandoned. Route gold is a visible share of income.
- **Design §7 risks:**
  - *Roads tipping the blight:* `ROAD_STRENGTH` (1, `blight.ts`) is the lever.
  - *The party pulled back to defend roads:* `RAID_RADIUS` (2) and `ABANDON_AFTER` (6, `trade.ts`) are the levers.
- **Done when** (design): all tests pass, the guard holds (or the move is explained), and the play script has been walked.
- **Design §6, play script** (walked in this step; step 5 as decision 9 reads it, step 3 with step 06's debug `spawn`):
  1. Walk to Millbrook and see contact ("Millbrook will trade with Oakvale."; `contact millbrook` if the walk is cut short by events, and say so). Run `facility trading_post 4` and `stock gold 100 timber 20`, then open a route on the trading post's Routes tab. See the preview (road on the minimap, length, expected income, cost), the road overlay on the world map, and the cost spent from the stock.
  2. Run `days 20` and see route yields in the stock panel's last-yield line and `days`' yield line ("routes … gold").
  3. Place a nest near the road with `spawn goblin_raid <col> <row>` (a hex within 2 of a road hex, not on it), or wait for one. See the road turn red, the raid warning on the next yield day ("Raiders on the Millbrook road: …") and zero route income. Clear it (fight it, or auto-resolve) and see "The Millbrook road is safe again" on the next yield day.
  4. Leave a raider for 30 days (`days 30`). See the route abandoned ("The Millbrook road is abandoned.") and its slot free on the Routes tab.
  5. Build a watchtower on clean land within 3 hexes of a tainted road stretch (towers need clean land) and see that stretch turn gold. Garrison a party within 3 hexes of another tainted stretch and see the same.
  6. Run `facility builders_lodge 3`, then `days 60`. See the blight retreat along the road (hex info "The blight is receding here." on road hexes, fewer tainted road hexes, security up).
- **Decisions from the index this step documents** (unchanged, in brief):
  1. Signatures take the party (`openRouteRefusal(game, party, id)`, `openRoute(game, party, id)` returns `route_opened`); `routeSecurity`/`routeIncome` take a road and presences; `raidCause` takes `{ partner, road }`.
  2. Contact and silence are daily in `partnerDay` (from `updateTerritory`), for any presence on a partner's hex; contact is not notable.
  3. Silence is tracked for every partner (`silent`, in at `LOSS_LEVEL`, out at 0), told only for contacted ones; a partner is a clean source of `PARTNER_STRENGTH` (3) silent or not.
  4. Partners' goods: 1 of the good on yield days whose `world.turn / YIELD_DAYS` is even, when security ≥ ½, as a `source: 'route'` yield.
  5. `route_raided` is emitted on every raided yield day with `days`; only `days === 1` is notable and has a line; at the sixth, `route_abandoned` follows and the route is removed.
  6. The road is `reachableHexes` from the encampment, every monster hex and its neighbours impassable (true state), the partner's hex passable; deterministic; length is the hex count.
  7. Design §4's figures are illustrative: Millbrook's road is 14 hexes (27 gold, 10 timber, about 2 gold clean), Saltmere's 30.
  8. Previews and the road tooltip count towers, not parties (`routeIncome(world, road, [])`).
  9. Watchtowers keep needing clean land; "on a tainted road hex" is read as "within `GUARD_RADIUS` of" one, in the play script and the simulator's tower errand.
  10. The overlay is live: gold / amber / red by the far hex's security, all red while `raidCause` holds; drawn through the fog; the road tooltip is lines in the hover info panel.
  11. The Routes tab shows open routes' security, expected income now and raided count; always present; contacted partners only, in contact order.
  12. The simulator's Lodge reaches 2 as before, and 3 once a route is open; routes open after the infirmary, before the Lodge.
  13. The contact detour is the vanguard's (or a lone party's), within `CONTACT_DETOUR` (8) of the party, when no held site is threatened; raiders are weighed after threatened sites, nearest first, in `nextTarget` and the guard's defend.
  14. Determinism through step 06 (`SIM_PARTNERS`, `SIM_LODGE_CAP`); step 07 removed both and re-recorded the fixture once.
  15. No save migration: `SAVE_VERSION` 28; older saves read as unreadable (the old migrations removed).
  16. Routes pay nothing once the encampment is lost.
  17. Sounds reuse cues (`world.threatened`, `world.lost`, `world.captured`, `world.build`).
  18. Debug `spawn <encounter> [here | <location id> | <col> <row>]` and `contact <partner id | all>`; `days`' totals include routes.
  19. Out of scope: far partners (stage 9), goods for sale (stage 10), market income and the simulator's spend order (stage 12), caravan battles.
- **Contracts this step documents** (C1–C7 of the index, as built by steps 01–07, copied unchanged in short):

  ```ts
  // C1 (step 01)
  export interface PartnerLocation extends LocationBase { kind: 'partner'; good: Material }
  export type WorldLocation = MonsterLocation | QuietLocation | PartnerLocation
  export const PARTNERS: readonly PartnerLocation[]   // millbrook (18, 30) timber; saltmere (30, 38) salt
  export function newWorld(seed?: number, encampmentName?: string, partners: readonly PartnerLocation[] = PARTNERS): WorldState
  // WorldState: contacted: string[]; silent: string[]; routes: TradeRoute[]; routesOpened: number
  export interface TradeRoute { id: string; partner: string; road: Hex[]; opened: number; raidedDays: number }
  // trade.ts: partners, partnerById, isContacted, isSilent, contactPartner, partnerDay
  export const PARTNER_STRENGTH = 3   // blight.ts
  // WorldEvent: partner_contacted { partner, name, home }; partner_silent { partner, name }; partner_restored { partner, name }
  // sites() excludes partners; isNotable(partner_silent); SAVE_VERSION = 28 (no migration); SIM_PARTNERS (removed in step 07)
  // C2 (step 02)
  // ROUTE_BASE 1, ROUTE_HEXES_PER_GOLD 10, ROUTE_COST_GOLD 20, ROUTE_HEXES_PER_COST_GOLD 2, ROUTE_TIMBER 10,
  // ROUTE_SLOTS [0, 0, 0, 1, 2, 4], GUARD_RADIUS 3, RAID_RADIUS 2, ABANDON_AFTER 6; RaidCause 'silent' | 'corrupted' | 'raiders'
  // routeLimit, routeOf, roadTo, routeCost, openRouteRefusal, openRoute, guarded, hexSecurity, routeSecurity, routeIncome,
  // raiders, raidCause, tradeDay; towerHexRefusal (buildings.ts)
  // WorldEvent: route_opened { route, partner, name, length }; route_raided { route, partner, name, cause, raider?, raiderName?, days };
  //   route_restored; route_abandoned; yield gains route?, YieldSource adds 'route'; isNotable(route_raided days 1, route_abandoned)
  // C3 (step 03)
  export const ROAD_LODGE_LEVEL = 3   // buildings.ts; LODGE_LEVEL_LIMIT and ROADS_REFUSAL removed
  export const ROAD_STRENGTH = 1      // blight.ts: each open road hex a clean source at Lodge 3
  // the Lodge's effect at 3 stays "Roads: open trade routes push back the blight."; SIM_LODGE_CAP (removed in step 07)
  // C4 (step 04): map_partner_village, map_partner_port (base, idle); camp_lodge/level_3 redrawn
  // C5 (step 05): roadsView.ts (RoadShade, ROAD_COLORS, roadSegments, roadInfoLines, raidWords, partnerInfoLines);
  //   event lines and yieldSummary's routes part; PARTNER_SPRITES; WorldProbe.roads, WorldProbe.partners
  // C6 (step 06): routesTab.ts (RouteRow, routeRows, routeOffer, routeState, minimapPoints); TradingPostScene Tab 'routes';
  //   TradingPostProbe.buttons.routesTab, .routes; SPAWN_KINDS exported; debug spawn, contact
  // C7 (step 07)
  // CONTACT_DETOUR 8, contactErrand; TOWER_ERRAND_RADIUS 6, towerErrand; routeRaiders; phases 'contact', 'road_tower'
  // CampaignRecord: partnersContacted, routesOpened, routesRaided, routesAbandoned; goldBySource.routes
  ```

- **Shared constraints (from the index):**
  - **Commands** (local Node 26: prefix `PATH=/opt/homebrew/opt/node@26/bin:$PATH`; or the podman `make` targets):
    - `npm test` (`tsc && vitest run`) is the gate before every commit;
    - `npm run test:browser` (or `-- -t <name>`) after any scene change; read `e2e/CLAUDE.md` before adding an in-browser test;
    - `npm run manual:screenshots` retakes the manual's screenshots (`.claude/skills/yomi-manual/screenshots.md`);
    - `npm run simulate -- <flags>`: each run its own `--out` under `logs/` (gitignored). **Never run two campaign simulations at once.** A 500-campaign run takes about five minutes alone.
  - **Measurements go through the `yomi-measure` agent** (`.claude/agents/yomi-measure.md`), one run at a time; it returns one table of figures against the user's bands.
  - **The refactor guard.** Step 07 re-recorded the fixture once. This step leaves it alone unless it retunes (§4.2), in which case it re-records it and says so in the doc comment above `GUARD_RECORDS` and in the commit. If it fails without a retune, an earlier step broke it: report it, do not re-fixture.
  - **The early-game figure.** Step 01 re-measured it on the branch before any change (its record and `log.md`): that is the stage's baseline. A move of more than about 5 points must be explained in the commit and in CLAUDE.md's rules of scaling, or retuned away. The user's bands (`.claude/skills/yomi-balance/bands.md`) are never changed; a figure outside them is reported, not accepted silently.
  - **Determinism.** No step adds, drops or reorders a draw of the world RNG or a battle's RNG.
  - **Commits.** One commit for this step once `npm test` passes, on `long-campaign-stage-08`, without pushing, files staged by path. Message "Stage 8 step 08: measure, document, play" (a retune, if any, may be its own commit before it, "Stage 8 step 08: retune <lever>"). No attribution lines.
  - **Docs.** CLAUDE.md files stay current: search them, `.claude/` and `docs/reference/` for every name the stage removed or renamed (`LODGE_LEVEL_LIMIT`, `ROADS_REFUSAL`, `SIM_PARTNERS`, `SIM_LODGE_CAP`, "Roads come with trade routes"). `scripts/claudeMd.test.ts` caps the root `CLAUDE.md` at 16 KB, each directory's at 8 KB, and the `.claude/` skills, agents and always-loaded total: move detail into `docs/reference/` or a skill rather than raise a cap.
  - **Sprites:** this step draws none, but `npm run sprites:check` must pass.

## 3. Dependencies and prerequisites

- **Steps 06 and 07 are done and merged** into the stage branch (and through them 01–05, and 04's sprites).
- **From step 01's execution record and `log.md`:** the baseline 500-campaign summaries (`--parties 1`, the default company, and the company at `--ready-level 10`), and the 50-campaign hash.
- **From step 07's execution record:** the re-recorded fixture's old and new figures, its 50-campaign hash, and anything it left (for example a summary line it judged out of scope).
- **From steps 05 and 06's execution records:** the manual text they wrote, any in-browser test hooks the play script can use, and the debug commands' exact usage.
- **Environment:** Node 26, Playwright's Chromium, a dev server (`npm run dev`, http://localhost:5173) for the play script.

## 4. Scope and guidance

### 4.1 Measure

Run each from seed 1, one at a time, each with its own `--out`, through the `yomi-measure` agent (or directly, if it is unavailable, and say so). Keep each printed summary's lines that matter in the execution record, and the table in `log.md`.

1. **The early-game guard** (`--parties 1`):

   ```sh
   npm run simulate -- --campaign --battles 500 --seed 1 --parties 1 --out logs/s8-guard.jsonl > logs/s8-guard.txt
   ```

   Compare with step 01's baseline: the Source share, days, battles, heroes dead, the share of land blighted at the end, sites captured and lost. Record partners contacted, routes opened, raided and abandoned a campaign (expected near zero opened), and the Lodge's level at the end.
2. **The default company:**

   ```sh
   npm run simulate -- --campaign --battles 500 --seed 1 --out logs/s8-company.jsonl > logs/s8-company.txt
   ```

   Compare with step 01's company baseline and its band.
3. **The long check, the company at `--ready-level 10`** (design §6 check 2):

   ```sh
   npm run simulate -- --campaign --battles 500 --seed 1 --ready-level 10 --out logs/s8-ready10.jsonl > logs/s8-ready10.txt
   ```

   Compare with step 01's `--ready-level 10` baseline. Record: campaigns with a route opened; routes opened, raided (raid runs) and abandoned a campaign; gold by source (sites, market, routes, sales) and route gold's share of gold income; the trading post and Lodge levels reached (how many campaigns reach post 4 and Lodge 3); the land blighted at the end. The check passes when routes are opened, raided some of the time, abandoned rarely (well under their raids), and route gold is a visible share. If routes are never opened (the post never reaches 4), that is a finding about the simulated economy, not a fault in this stage: record it, say what the careful party spends instead, and report it for the orchestrator (stage 12's retune owns the spend order).
4. **The waiting check** line, if the summary prints it (behind `--waiting` per stage 7), need not be rerun; if any run above includes it, record it.

### 4.2 Judge the figure, and retune only for the design's causes

- **Within about 5 points of the baseline:** record the move and its likely cause (partners' clean push near Millbrook and Saltmere, the contact detour's walks, raids interrupting walks). No retune.
- **More than about 5 points:** find the cause first (compare the blighted share, sites lost, battles and days, contact detours and route counts against the baseline).
  - If roads tip the blight (the land ends much cleaner in campaigns with Lodge 3 and open routes), lower `ROAD_STRENGTH` (design §7).
  - If the party is pulled back to defend roads (more walking days, fewer battles toward the Source, raiders chosen often), lower `RAID_RADIUS` or raise `ABANDON_AFTER`.
  - A retune is a balance change: it moves play, so re-record the refactor guard's fixture (`GUARD_RECORDS`, `GUARD_EVENTS_SHA256`) and say why in its doc comment; update the constant's tests, `docs/reference/game.md` and the manual's numbers if they state it; record each try's figures in the execution record and `log.md`, and the final one in the stage's implementation notes. Rerun the measurements after each try, one at a time.
- If the cause is none of these (for example partners as sources, which the design fixes at 3), do not retune: explain it in CLAUDE.md's rules of scaling and the commit, and report it with the figures for the orchestrator to take to the user.
- Either way, a final figure outside the user's bands is reported, not accepted silently. The bands are never changed.

### 4.3 Document

- **Root `CLAUDE.md`:** the import-cycle line gains `trade` (`blight`/`territory`/`worldMap`/`trade`); the map's `src/game/` line names trade partners and routes if it lists the world's parts. Keep it a map, not detail (16 KB cap).
- **`src/game/CLAUDE.md`:** a `trade.ts` line in the modules list (partners, contact and silence, routes, roads' security, raids, `tradeDay`); the import-cycle contract gains `trade.ts`; `blight.ts` (partners and roads as sources), `territory.ts` (`partnerDay` and `tradeDay` after the yields), `buildings.ts` (the Lodge to 3, `towerHexRefusal`), `worldMap.ts` (partners in `newWorld`) lines; the saving contract's version (28, no migration); the rules of scaling, with any move over 5 points explained (8 KB cap).
- **`src/scenes/CLAUDE.md`:** only if a contract or the helper-module list needs it (`roadsView.ts`, `routesTab.ts` are ordinary helpers; the full detail goes in `docs/reference/scenes.md`).
- **`scripts/CLAUDE.md`:** the bands table's "Now" column, if the file keeps one, with this step's figures and "(stage 8, seed 1)"; otherwise only what a tuner needs (route levers) by pointer to `.claude/skills/yomi-balance/levers.md` (add `ROAD_STRENGTH`, `RAID_RADIUS`, `ABANDON_AFTER` there if it lists levers).
- **`docs/reference/game.md`:** partners (placements, contact, silence, strength); routes (slots, cost, the road rule, security and guards by towers and parties, income and goods, raid causes, abandonment, restoration, refusals); roads at Lodge 3 (`ROAD_STRENGTH`); the Builders' Lodge's level 3; the new events and `yield`'s `source: 'route'`; `isNotable`'s additions; save version 28 and `migrateFrom27`; the constants by name.
- **`docs/reference/scenes.md`:** the roads overlay and its colours, partner icons and greying, the hex info's partner and road lines, the event lines, the stock panel's routes part, the Routes tab (rows, preview, minimap, Open), the debug commands `spawn` and `contact`, the probes' new fields.
- **`docs/reference/simulator.md`:** `contactErrand`, `towerErrand`, `routeRaiders`, the new phases, raiders in `nextTarget` and the guard's defend, routes and the Lodge in `visitFacilities`, `materialNeeds`, the record's new fields and the summary's lines.
- **`docs/reference/sprites.md`:** the two partner sprites if it lists map sprites; the Lodge's level 3.
- **`docs/designs/blight.md`** §4.6 and §4.7: where they state the clean sources, add a line pointing to partners and roads (the code is right; keep the design's history, do not rewrite it).
- **The manual** (`docs/manual/README.md`, via `.claude/skills/yomi-manual/`): §3 Places (trade partners, contact, silence; roads on the map and their colours, the road lines in the hover panel); §8 the blight (partners and, at Lodge 3, roads push back); §9 Building (the Builders' Lodge's level 3; the trading post's Routes tab, slots by level, cost, income, raids, abandonment, guarding with watchtowers and parties). Steps 05 and 06 wrote the screens' text; check it against the code and read it again for truth.
- **Screenshots:** `npm run manual:screenshots`, then look at every retaken image the stage touches (the world map with a road and partners, the encampment with the Lodge's redrawn level 3 if shown). Add shots in `e2e/manual.shots.ts` for the world map with an open road (and a partner) and for the Routes tab with a preview, and link them from the manual.
- **The stage design:** add an "Implementation notes" section at its end, as stages 1–7 have: the figures measured (baseline and final, all three runs), the route counts and route gold's share, the Lodge levels reached, any retune and why, the departures the plan took (the index's decisions, by number, especially 2, 4–6, 8–12 and 15), the open question's answer (the road raided at once, and the preview's warning), and what the play script showed. Set its status to done.
- **The stages index** (`docs/designs/long-campaign/index.md`): stage 8's row marked done with a link to its implementation notes and the guard's figure; the early-game guard convention's history sentence gains stage 8's figure.

### 4.4 Walk the play script

Walk §2's six parts in the real game with the dev server, headless (Playwright's Chromium, as stages 6 and 7 did, through a temporary in-browser test kept outside the repository) or by hand, with the debug console (`~`). Record each part's commands and what was seen (messages, probe fields such as `WorldProbe.roads` and `TradingPostProbe.routes`, the stock before and after), with screenshots kept outside the repository (the scratchpad or `logs/`). Name anything not seen, and why.

If a part shows a bug, fix it test-first if it is small and in this stage's code, else stop and report it.

### 4.5 Final checks

`npm test`, `npm run test:browser`, `npm run build`, `npm run sprites:check`, all passing; and a grep for the removed names:

```sh
grep -rn "LODGE_LEVEL_LIMIT\|ROADS_REFUSAL\|SIM_PARTNERS\|SIM_LODGE_CAP\|Roads come with trade routes" src scripts e2e docs/reference docs/manual .claude CLAUDE.md
```

It should find nothing but history (plan and feature files are not searched).

## 5. Verification

- The three 500-campaign summaries are in the execution record and `log.md` with the baseline beside them; the route counts and route gold's share are recorded.
- The figure is within about 5 points of the baseline, or the move is explained (or retuned, with the fixture re-recorded and each try recorded).
- The `--ready-level 10` check shows routes opened, raided sometimes and rarely abandoned, with a visible route gold share, or the finding is reported with figures.
- The docs named in §4.3 are updated; `scripts/claudeMd.test.ts` passes; the grep of §4.5 finds nothing stale.
- The screenshots are retaken and were looked at.
- The play script's six parts were walked, each with what was seen.
- `npm test`, `npm run test:browser`, `npm run build` and `npm run sprites:check` pass.

## 6. Completion criteria

- [ ] All three measurements recorded against step 01's baseline (execution record and `log.md`); route counts, route gold, post and Lodge levels recorded.
- [ ] The figure's move judged: explained, or retuned with the design's levers (fixture re-recorded and said so); bands untouched.
- [ ] CLAUDE.md files (root, `src/game/`, `scripts/`, `src/scenes/` if needed), `docs/reference/` (game, scenes, simulator, sprites), `docs/designs/blight.md`, the manual and its screenshots current.
- [ ] The stage design's Implementation notes and the stages index's stage-8 row written.
- [ ] The play script walked, recorded part by part.
- [ ] `npm test`, `npm run test:browser`, `npm run build`, `npm run sprites:check` pass.
- [ ] One commit (or a retune commit and this one), "Stage 8 step 08: measure, document, play", no attribution lines; the index's row 08 updated with status and commits.

## 7. Execution record

### The route check's flag (commit 8256690)

- `--trading-post N` (campaign only, 1 to `MAX_TRADING_POST_LEVEL`, unset by default) starts each campaign's world, and its waiting twin's, with the trading post at level N (`campaignGame` in `scripts/simulate.ts`, drawing nothing), and prints a line saying the run is read against no band. The user's decision of 2026-11-22: routes open 0.03 a campaign at `--ready-level 10` because the careful party rarely raises the post to 4 under the spend order kept until stage 12, so the plan's "routes opened, sometimes raided, a visible share of gold" criterion is replaced by this targeted check, and full-campaign route figures wait for stage 12.
- Tests first (`scripts/simulate.test.ts`): `parseArgs` takes and refuses the flag (red: "Unknown argument"); `startCampaign` with it starts at level 4 with `routeLimit` 1, without it at 1 with 0; the twin starts from the same post (its market pays, so it earns more than the plain twin; my first guess, that the twins would be equal, was wrong for that reason); four campaigns at `--ready-level 10` open no route from post 1 and at least one from post 4.
- Default runs untouched: the 50-campaign check `b50f7b50626d6e2832deb18c44a808b9be0521002698dc97c1fa8216db904e52` (22 of 50), identical to step 07's; the refactor guard passes with the fixture untouched.

### The play script, walked (2026-11-22)

Walked headless in Playwright's Chromium through a temporary in-browser test (`e2e/zz-playscript.tmp.test.ts`, deleted after; its notes and screenshots in the session scratchpad `walk/`), seed 1, the debug console for the commands.

1. **Contact and opening.** The whole walk from Oakvale to Millbrook (14 hexes, with stops at sightings) passes the test's time limit, so the party was put two hexes short (`goto 16 30`) and walked the rest by clicks: on arrival, turn 3, the message "Millbrook will trade with Oakvale." and `contacted: ["millbrook"]`. `facility trading_post 4`, `stock gold 100 timber 20`, `goto encampment`, then the Routes tab: one row, selected, "Open a route to Millbrook: 14 hexes, about 1 gold every 5 days, costs 27 gold, 10 timber", its road on the minimap. Open: "A road is opened to Millbrook.", gold 100 → 73, timber 20 → 10, the row "Millbrook road: security 86%, about 1 gold every 5 days". On the map, `roads` gave 14 segments, gold but for four amber ones where the land was tainted.
2. **Yields.** `days 20`: "Yields over 20 days: sites 16 gold, 8 iron; market 8 gold; routes 4 gold, 2 timber". On the next yield day (turn 25, by Next day) the stock panel's last line read "Last yield: sites 4 gold, 2 iron; market 2 gold; routes 1 gold".
3. **Raiders.** `spawn goblin_raid 19 28` (two hexes from the road): every segment turned red at once (`raided` throughout). On the next yield day (turn 30) the message "Raiders on the Millbrook road: the Goblin Brood." and a last-yield line without routes. The party (raised with `xp 3000 all`) was put before the Brood and auto-resolved it ("The Goblin Brood are beaten."); the road was gold and amber again at once, and on the next yield day (turn 35) "The Millbrook road is safe again." with "routes 1 gold" back in the last-yield line.
4. **Abandonment.** Another Brood on the same hex, `days 30`: "day 40: Raiders on the Millbrook road: the Goblin Brood." once, then "day 65: The Millbrook road is abandoned."; the Routes tab showed Millbrook closed again, its Open offered (the slot free), with "Raided at once: the Goblin Brood is within 2 hexes" while the Brood stood.
5. **Guards.** The Brood cleared and the route reopened, road hexes 8 to 10 tainted with `blight 1`: segments 7 to 10 amber. A watchtower built on clean land at (19, 26), three hexes from road hex 9 ("A watchtower rises over the land."): with the party back home, segments 9 and 10 (within 3 of the tower) turned gold, 7 and 8 (farther than 3 from it) stayed amber. Road hexes 5 and 6 tainted, the party home: segments 5 to 8 amber; the party put at (12, 23), two hexes from both: segments 5 to 7 gold at once, 8 still amber. (The design's "garrison" is read as a party standing: a lone party guards wherever it stands; no second party was formed.)
6. **Roads at Lodge 3.** Road hexes 4 to 7, 11 and 12 tainted (9 of 14 road hexes tainted or worse); the party put beside the road's middle so its hexes were in sight, `facility builders_lodge 3`, `days 2`: the hover on road hexes 4, 5, 7 and 11 each read "Blight: tainted. | The blight is receding here." with "The Millbrook road: security 82%, about 1 gold every 5 days.". After 58 more days (turn 126) no road hex was tainted, every segment gold, and the hover read "security 100%, about 2 gold every 5 days"; `days` totalled "routes 16 gold, 6 timber" over the 58 days. The walk did not separate the roads' push from the encampment's, the tower's and the party's (all clean sources near this road); `blight.test.ts` (step 03) is what shows the road's own push.

Not seen: the whole walk to Millbrook in one go (cut short for time, as said); a partner falling silent (covered by step 05's in-browser test).

### Measurements (2026-11-22)

By `yomi-measure` at `8256690`, seed 1, 500 campaigns, one at a time; the table is in `log.md` ("Step 08: the final figures"). In brief: `one` 233 (baseline 239; band 215–250), 284 days, 1.2 dead; `company` 232 (239; 220–260); `rl10` 433 (434; 370–420, accepted to 445), 0.03 routes a campaign; `rl10 --trading-post 4` 487 (no band), 0.47 routes opened, 0 raided, 0 abandoned, route gold 39 a campaign (4% of gold). All three banded figures equal step 07's.

- **Judgement.** The early-game moves are 6 (`one`) and 7 (`company`) points, past "about 5". The cause is none of the design's: the partners as clean sources from day one reshuffle spawns (step 07 showed the 50-campaign log identical to the baseline with partners removed; no route opens in these runs, so roads, raids and tower errands are absent). Not retuned (§4.2: partners' strength is fixed by the design); explained in `src/game/CLAUDE.md` ("The rules"), the stage design's implementation notes and the commit. Both stay in their bands. For the orchestrator to take to the user with the figures.
- **The route check.** Routes open with the post at 4, give a small but visible share of gold, and were never raided in 500 campaigns, so "raided sometimes" is not met and `RAID_RADIUS`/`ABANDON_AFTER` cannot be judged from the simulator yet; the likely causes are decision 6's road (kept clear of nests) and the simulated parties clearing raiders first. Reported, not tuned: full-campaign route figures wait for stage 12.

### Docs

- Root `CLAUDE.md`: `trade` in the import-cycle line; the map's `src/game/` line names trade partners and routes.
- `src/game/CLAUDE.md`: `blight.ts` and `buildings.ts` lines (partners and roads as sources, Lodge 3); the scaling move in "The rules" (at 7,998 of 8,000 bytes).
- `docs/reference/game.md`: a "Trade partners and routes" section (constants, partners, contact and silence, opening and refusals, the road rule as decision 6 now stands, security and guards, income and goods, raids, abandonment, roads at Lodge 3); `scenes.md`: roads and partners on the map, the probes' new fields; `simulator.md`: `--trading-post`; `sprites.md`: the partner sprites and the Lodge's level 3.
- `.claude/skills/yomi-balance/`: bands' "Now" (stage 8), `--trading-post` in `running.md`, the route check in `levers.md`.
- `docs/designs/blight.md` §4.6, §4.7: stage 8 pointers. The stage design: status done, implementation notes. The stages index: stage 8's row and the guard's history.
- The manual: silence greying only when contacted or in sight; route income and goods, abandonment freeing the slot, restoration; roads in §8's clean sources; the Routes tab's minimap sentence; two new shots embedded.
- `src/game/worldMap.ts`: a stale comment on `newWorld`'s partners ("the simulator passes none until step 07").

### Screenshots

`npm run manual:screenshots` (9 passed). New: `trading-post-routes.png` (Market Hall: Millbrook open, Saltmere's offer selected with its road on the minimap) and `world-road.png` (Millbrook's road, a save planting taint on road hexes 5–7 and blight 2 on 9–10 and levels 2–3 beside the far half, the land near the road seen, the view panned: gold, amber and red stretches over the blight's tints, Millbrook at the end). `trading-post.png` and `trading-post-runes.png` now show the Routes tab. Retaken but pixel-identical: `world-start`, `world-travelling`, `world-blight`, `world-improve` (no partner is in view in any world shot; the brief's "old icon where the partners stand" was not seen in them). Changed by re-rendering only: the battle shots, `exchange`, `panel-level-up`, `world-after-victory`, `world-confront`, `world-parties` (looked at; no partner or breakage).

- **Amber against gold** (looked at by eye, at 1x and cropped at 4x): `0xffd54f` against `0xffa726` on the dashed line. Side by side, where one stretch meets the other, they can be told apart (a pale yellow against an orange); a lone amber stretch, or one seen at a glance over the green, reads close to gold. Red over the blight's purple tints stands out plainly. A judgement for the orchestrator: a stronger amber (more orange) would help; not changed here.
- Outside this stage: `world-blight.png` ("Corrupted land") shows no corrupted land, the party never leaving home in the shot (unchanged since stage 7).

### Final checks

- `npm test`: 102 files, 2,536 tests passed (before the commit; rerun green on the final tree).
- `npm run build`: built (the existing chunk-size warning only). `npm run sprites:check`: up to date, 128 sprites. `scripts/claudeMd.test.ts`: 17 passed. The removed-names grep (§4.5): nothing.
- `npm run test:browser`, in full, nothing else running:
  - First run: the vitest main process (which hosts the Vite dev server, `e2e/globalSetup.ts`) hit a V8 abort before any file finished, "abort: Lazy deopt after a fast API call with return value is unsupported" in `Buffer.byteLength` under Vite's `send` (Node 26.13.0), then spun at 100% CPU printing its dump with every worker idle: a stall, killed after 7 minutes. This matches the earlier "stalled, ~34 min" runs on this branch (log kept as `logs/s8-08-browser-crash1.txt`). A Node/V8 fault, not this stage's code; `node --no-turbo-fast-api-calls` would likely avoid it (not tried).
  - Second run: 176 of 179 passed in 488 s; 3 timed out at 60 s: `character.test.ts` "drags gear between the equipment, the backpack and the baggage", `debug.test.ts` "fights any encounter at any threat from the world map, clearing nothing and taking no loot", `saves.test.ts` "deletes the slot of a party that falls". Each rerun alone passed (10 s, 16 s, 21 s). None is a stage 8 test.
