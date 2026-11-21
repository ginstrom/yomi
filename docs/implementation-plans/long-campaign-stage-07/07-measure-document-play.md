# Step 07: Measure, document, play

[Plan index](index.md) · [Stage design](../../designs/long-campaign/stage-07-site-improvements-and-markets.md) (§6 Verification, §7 Risks) · [Reference](../../designs/long-campaign/reference/economy-and-trade-routes.md) §4.1, §4.2, §4.6 (the waiting check), §7.2 · [Stages index](../../designs/long-campaign/index.md) ("The early-game guard", "Docs", "Gameplay verification")

**Difficulty:** opus / opus. The engineer (model unset) runs the simulator and makes a balance judgment: if forts and works move the early-game figure past about 5 points, it decides between explaining the move and retuning the fort's strength, and writes it up. It also writes the stage's documentation and walks the play script in a browser. The reviewer (opus) judges whether the docs are true to the code, whether the figures support the claims, and whether the play script was really walked.

## 1. Objective

Close the stage:
- measure the early-game guard (`--parties 1`) against step 01's baseline, and the default company against its band;
- read the waiting check, the improvements and Lodge levels reached, and gold by source;
- retune the fort's strength only if the figure moved too far and the cause is the land ending too clean (design §7);
- bring the CLAUDE.md files, `docs/reference/`, the manual and its screenshots, the blight design, the stage design and the stages index up to date;
- delete any outpost wrappers step 06 left;
- walk the design's play script in the real game and record what was seen.

## 2. Requirements and context

- **Design §6, simulator checks:**
  1. *The early-game guard.* Forts and works make the land stickier and give more stock. Expect the figure to rise a little; record by how much.
  2. *The waiting check:* gold (income) per day waiting at home is below the campaign's average.
- **Design §7 risk:** *the blight balance.* Forts are strong. If the early land ends too clean, lower the fort's strength (`IMPROVEMENT_STRENGTH[3]`, 7) before its loss level (`lossLevel`, `MAX_BLIGHT`).
- **Done when** (design): all tests pass, the guard holds (or the change is explained), the waiting check passes, and the play script has been walked.
- **Design §6, play script** (walked in this step):
  1. Run `facility builders_lodge 2` and `stock gold 300 stone 50 iron 50`, then walk to a held site with an outpost. Improve it to a works, then a fort. See the yield and strength in the hex info.
  2. Run `days 200` with the party away. Watch a fort survive blight level 2. Use the debug console to push it to 3 and see it lost with "fort razed".
  3. Run `facility trading_post 6`, then `days 25`. See five market yields of 5 gold. Taint the encampment's hex in debug and see them halved.
  4. Load a save from before the stage. Its outposts show as level 1.
- **Decisions from the index this step documents** (unchanged):
  1. **Signatures follow the code's patterns.** `improveRefusal(world, party)` and `raiseLodge(game, party)` take the party.
  2. **The day action** `{ kind: 'outpost' }` becomes `{ kind: 'improve' }`; a saved day order `outpost` migrates to `improve`.
  3. **Events.** `site_improved { site, name, level, building }` replaces `outpost_built`; `site_lost`'s `outpost?: true` becomes `improvement?: ImprovementLevel`; messages "its outpost razed", "its works razed", "its fort razed". `LOG_SCHEMA_VERSION` is unchanged.
  4. **Yield source.** `yield` gains `source?: YieldSource` (`'site' | 'market'`); absent means a site; the market's yield carries `source: 'market'`, `site: ENCAMPMENT_ID` and the encampment's name.
  5. **Market income on tainted ground** is halved, rounded down: 2 → 1, 3 → 1, 5 → 2.
  6. **The Improve button**: "Build a Mine: 30 gold, 15 stone", or "A Mine needs the Builders' Lodge" when the Lodge is too low (a click says why).
  7. **The Builders' Lodge** has `maxLevel` 3, but `raiseLodge` refuses at level 2 with "Roads come with trade routes." (`LODGE_LEVEL_LIMIT` 2). Sixth facility, sixth plot.
  8. **The waiting check** is the reference's twin: the same seed's world run forward with the company idle at home, against the campaign; income is yields as value (gold, plus other materials at `MATERIALS_PER_GOLD`), sales excluded on both sides; `incomePerDay` and `waitingIncomePerDay` per campaign; behind `--waiting` only if step 06 found the twin adds more than 10% to a run's time.
  9. **The simulator's Lodge** is raised in `visitFacilities` after the infirmary, to its limit; `materialNeeds` keeps its costs and the allowed improvement levels' costs.
  10. **Determinism through step 02**; step 06 re-recorded the fixture once.
  11. **Wrappers** (`outpostSite`, `outpostSiteRefusal`, `canBuildOutpost`, `buildOutpost`, `OUTPOST_COST`) are deleted by step 06, or by this step for any step 06 left (its record says which).
  12. **Art beyond the design:** `camp_trading_post/level_5`, `level_6` and `map_fort`.
  13. **What the world map shows:** "Mine: 5 iron every 5 days.", "Strength 6 against the blight.", a fort's "Lost only when corrupted."; the map label's building line; the stock panel's "Last yield: …" line (not saved).
  14. **Debug commands:** `stock` with several pairs; `blight <level> [here | <location id> | <col> <row>]`; `days` totals yields by source.
  15. **Saves.** `SAVE_VERSION` 27 with `migrateFrom26`.
  16. **Out of scope:** partners, routes, roads (stage 8); partners' goods for sale (stage 10); upkeep.
- **Contracts this step documents** (C1–C6 of the index, as built by steps 01–06, copied unchanged):

  ```ts
  // C1 (step 01)
  // WorldState: improvements: Record<string, ImprovementLevel> (replaces outposts); lodge: number (0..MAX_LODGE_LEVEL)
  export type ImprovementLevel = 1 | 2 | 3
  export const IMPROVEMENT_YIELD: readonly number[] = [0, 1, 3, 3]
  export const WORKS_NAMES: Record<Material, string>   // Mine, Lumber Camp, Quarry, Saltworks, Peat Cuttings
  export function siteImprovement(world: WorldState, id: string): 0 | ImprovementLevel
  export function improvementName(site: QuietLocation, level: ImprovementLevel): string
  export function withArticle(name: string): string
  export function lossLevel(world: WorldState, id: string): number   // MAX_BLIGHT for a fort, else LOSS_LEVEL
  export function daysToFall(world: WorldState, presences: readonly PartyPresence[], site: { id: string; position: Hex }): number | null
  export const IMPROVEMENT_STRENGTH: readonly number[] = [0, 3, 3, 7]   // blight.ts
  // WorldEvent: site_improved { site, name, level, building }; site_lost { site, name, improvement? }
  export const IMPROVEMENT_COSTS: readonly Stock[] = [{ gold: 15, timber: 10 }, { gold: 30, stone: 15 }, { gold: 50, iron: 20, stone: 10 }]
  export const IMPROVEMENT_LODGE: readonly number[] = [0, 1, 2]
  export const LODGE_COSTS: readonly Stock[] = [{ gold: 30, timber: 20 }, { gold: 60, stone: 25 }, { gold: 100, iron: 20, stone: 20 }]
  export const MAX_LODGE_LEVEL = 3
  export const LODGE_LEVEL_LIMIT = 2
  export const ROADS_REFUSAL = 'Roads come with trade routes.'
  // improvementSite, nextImprovement, improveSiteRefusal, improveRefusal, raiseImprovement, improveSite, lodgeCost, raiseLodge
  // DayAction { kind: 'improve' }; SAVE_VERSION = 27; migrateFrom26
  // C2 (step 02)
  // TRADING_POST_COSTS adds { gold: 160, silver: 30, stone: 20 }, { gold: 220, silver: 40, crystal: 10 } (MAX_TRADING_POST_LEVEL 6)
  export function tradingPostName(level: number): string   // 1–3 Trading Post, 4 Market, 5 Market Hall, 6 Trading House
  export const MARKET_INCOME: readonly number[] = [0, 0, 0, 2, 3, 5]
  export function marketIncome(world: WorldState): number
  export type YieldSource = 'site' | 'market'
  // FacilityId adds 'builders_lodge'; Facility.refusal?; SIM_TRADING_POST_CAP (removed in step 06)
  // C3 (step 03): camp_lodge level_1..3; camp_trading_post level_5, level_6; map_fort (base, idle)
  // C4 (step 04): improveLabel (src/scenes/improveButton.ts); yieldSummary (worldEvents.ts); WorldProbe.buttons.improve, WorldProbe.improveLabel
  // C5 (step 05): FACILITY_SPRITES.builders_lodge = 'camp_lodge'; a sixth plot; the Trading Post header by tradingPostName; debug stock, blight, days
  // C6 (step 06)
  export const FORT_FIRST_DAYS = 30
  export function improveErrand(world: WorldState, party: Expedition): QuietLocation | null
  // CampaignRecord: improvementsBuilt: number[]; improvementLevels: number[]; lodgeLevel: number;
  //   goldBySource: { sites: number; market: number; sales: number }; incomePerDay: number; waitingIncomePerDay: number
  ```

- **Shared constraints (from the index):**
  - **Commands** (local Node 26: prefix `PATH=/opt/homebrew/opt/node@26/bin:$PATH`; or the podman `make` targets):
    - `npm test` (`tsc && vitest run`) is the gate before every commit;
    - `npm run test:browser` (or `-- -t <name>`) after any scene change; read `e2e/CLAUDE.md` before adding an in-browser test;
    - `npm run manual:screenshots` retakes the manual's screenshots;
    - `npm run simulate -- <flags>`: each run its own `--out` under `logs/` (gitignored). Never run two campaign simulations at once. A 500-campaign run takes about five minutes alone and writes some 70 MB.
  - **The refactor guard.** Step 06 re-recorded the fixture once. This step leaves it alone unless it retunes (§4.2), in which case it re-records it and says so in the doc comment above `GUARD_RECORDS` and in the commit. If it fails without a retune, an earlier step broke it: report it, do not re-fixture.
  - **The early-game figure.** Step 01 re-measured it on the branch before any change: that is the stage's baseline. A move of more than about 5 points must be explained in the commit and in CLAUDE.md's rules of scaling, or retuned away. The user's bands (scripts/CLAUDE.md) still hold: one party 215–250, default company 220–260, days 243–297, deaths at most 2.0.
  - **Determinism.** No step adds, drops or reorders a draw of the world RNG or a battle's RNG.
  - **Commits.** One commit per step once `npm test` passes, on `long-campaign-stage-07`, without pushing. Messages "Stage 7 step 07: measure, document, play" (a retune, if any, may be its own commit before it, "Stage 7 step 07: retune the fort's strength"). No attribution lines.
  - **Docs.** CLAUDE.md files stay current: search them and `docs/reference/` for every name the stage renamed or removed (`outposts`, `outpost_built`, `OUTPOST_YIELD`, `OUTPOST_STRENGTH`, `OUTPOST_COST`, `outpostErrand`, `buildOutpost`, `canBuildOutpost`, `outpostSite`, `outpostSiteRefusal`, `raiseOutpost`, `outpostsBuilt`, `buildOutpost` in `testHook.ts`, `SIM_TRADING_POST_CAP`). `scripts/claudeMd.test.ts` holds the root file under 16 KB and each directory's under 12 KB: move detail to `docs/reference/` rather than raise the limit.
  - **Sprites** are drawn with sprite-tool by following `art/CLAUDE.md` and `docs/designs/sprite-drawing-guidance.md`; this step draws none, but `npm run sprites:check` must pass.

## 3. Dependencies and prerequisites

- **Steps 05 and 06 are done and merged** into the stage branch (and through them 01–04, and 03's sprites).
- **From step 01's execution record:** the baseline 500-campaign summaries (`--parties 1` and the default company) and the 50-campaign summary and hash.
- **From step 02's execution record:** whether market income at trading post 4 moved the 50-campaign check, and by how much.
- **From step 06's execution record:** the re-recorded fixture's old and new figures; whether the waiting twin runs by default or behind `--waiting`; which wrappers, if any, were left for this step.
- **Environment:** Node 26, Playwright's Chromium, a dev server (`npm run dev`, http://localhost:5173) for the play script.

## 4. Scope and guidance

### 4.1 Measure

Run each from seed 1, one at a time, each with its own `--out`; keep each printed summary in the execution record (in full for the first, the lines that matter for the rest). Add `--waiting` if step 06 put the twin behind it.

1. **The early-game guard** (`--parties 1`):

   ```sh
   npm run simulate -- --campaign --battles 500 --seed 1 --parties 1 --out logs/s7-guard.jsonl > logs/s7-guard.txt
   ```

   Compare with step 01's baseline: the Source share, days, battles, heroes dead, the share of land blighted at the end, sites captured and lost. Expected to rise a little.
2. **The default company** (`--parties` default 3):

   ```sh
   npm run simulate -- --campaign --battles 500 --seed 1 --out logs/s7-company.jsonl > logs/s7-company.txt
   ```

   Compare with step 01's company baseline and its band (220–260).
3. **From both runs, record:**
   - **the waiting check:** the summary's line, average `incomePerDay` against `waitingIncomePerDay`, and whether waiting earns less (it must; if not, stop and report: it is a finding against the design, not something to tune here without the user);
   - **improvements:** built a campaign by level (`improvementsBuilt`), held at each level at the end (`improvementLevels`), and the Lodge's level at the end (`lodgeLevel`), with how many campaigns reach Lodge 1 and 2;
   - **the trading post:** its level at the end, and how many campaigns reach 4, 5 and 6;
   - **gold by source** (`goldBySource`: sites, market, sales) a campaign.

### 4.2 Judge the figure, and retune only if the land ends too clean

- **Within about 5 points of the baseline:** record the move and its likely cause (more stock, stickier land). No retune.
- **More than about 5 points:** look first at whether the land ends too clean (the blighted share at the end, sites lost, forts held). If forts are the cause, lower the fort's strength (`IMPROVEMENT_STRENGTH[3]`, from 7 toward the works' 3) before touching its loss level (design §7), rerun the guard, and repeat in small steps. A retune is a balance change:
  - it moves play, so re-record the refactor guard's fixture (`GUARD_RECORDS`, `GUARD_EVENTS_SHA256`) and say why in its doc comment;
  - update the constant's tests, `docs/reference/game.md` and the manual's numbers if they state it;
  - record each try's figures in the execution record, and the final one in the stage's implementation notes.
- If the cause is not the forts (the market's gold, the Lodge's spending), do not retune: explain it in CLAUDE.md's rules of scaling and the commit, and report it with the figures for the orchestrator to take to the user.
- Either way, a final figure outside the user's bands (one party 215–250, company 220–260, days 243–297, deaths at most 2.0) is reported, not accepted silently.

### 4.3 Delete any wrappers left

If step 06's record says it left any of `outpostSite`, `outpostSiteRefusal`, `canBuildOutpost`, `buildOutpost` or `OUTPOST_COST` (because step 04 had not yet moved `WorldScene` off them when 06 ran), move the last callers to the C1 names and delete them now, with their tests' uses. `grep -rn "outpostSite\|canBuildOutpost\|buildOutpost\|OUTPOST_COST" src scripts e2e` should find nothing but the word "outpost" in improvement names and messages.

### 4.4 Document

- **`scripts/CLAUDE.md`:** the bands table's "Now" column (one party, default company, days, dead) with this step's figures and "(stage 7, seed 1)"; the Campaigns paragraph's errands (improvements, the Lodge, the market levels); the waiting check and `--waiting` if it exists.
- **Root `CLAUDE.md`:** the module map's `src/game/` line if it names outposts; keep it a map, not detail.
- **`src/game/CLAUDE.md`:** the `buildings.ts`, `territory.ts`, `encampment.ts` and `tradingPost.ts` lines (improvements, the Lodge, market income); any "if you add a facility" checklist (a `FacilityId`, a `FACILITIES` entry, `setFacilityLevel`'s field, a `camp_<facility>` sprite in `FACILITY_SPRITES` and a plot); the saving contract's version (27, `migrateFrom26`); the rules of scaling, with the figure's move explained if over 5 points.
- **`src/scenes/CLAUDE.md`:** the world map's Improve button (`improveLabel`), the stock panel's last-yield line, the encampment's six plots, the debug commands (`stock` pairs, `blight`, `days`' yield line).
- **`docs/reference/game.md`:** outposts become improvements (levels, yields, strength, loss level, costs, the Lodge's gates, refusals, razing, `site_improved`, `site_lost`'s `improvement`); the Builders' Lodge (costs, level 3 refused until stage 8); market income (levels 4–6, amounts, taint, the `yield` event's `source`); the trading post's levels 5 and 6 and names; the constants by name.
- **`docs/reference/simulator.md`:** `improveErrand` and `FORT_FIRST_DAYS`, the Lodge in `visitFacilities`, `materialNeeds`, the record's new fields and the summary's lines, the waiting twin.
- **`docs/reference/scenes.md`:** the Improve button, the hex info lines, the map's palisade, the stock panel line, the Lodge's plot.
- **`docs/designs/blight.md`** §4.6 and §4.7: where they state the outpost as the only building on a site, or that waiting is not free money, add a line pointing to the improvements and market income (the code is right; keep the design's history, do not rewrite it).
- **The manual** (`docs/manual/README.md`): §3's footer actions (Improve in place of Build Outpost), §8 (the blight: improved sites push harder; a fort falls only when corrupted), §9's Building table (Outpost, works, Fort rows with costs and the Lodge's gates; the Builders' Lodge row; the trading post row with levels 5 and 6 and the market's gold). Steps 04 and 05 wrote the screens' text; check it against the code.
- **Screenshots:** `npm run manual:screenshots`, then look at every retaken image the stage touches (the encampment with six plots, the world map). If the manual describes the Improve button or an improved site, add a shot of it in `e2e/manual.shots.ts` (a held site with a works or fort, the Improve button showing) and link it from the manual.
- **The stage design:** add an "Implementation notes" section at its end, as stages 1–6 have: the figures measured (baseline and final, both runs), the waiting check's two numbers, improvements and Lodge levels reached, gold by source, any retune and why, the departures the plan took (the index's decisions 1–4, 6–8, 12–14), and what the play script showed.
- **The stages index** (`docs/designs/long-campaign/index.md`): stage 7's row marked done with a link to its implementation notes and the guard's figure; the early-game guard convention's history sentence gains stage 7's figure.

### 4.5 Walk the play script

Walk it in the real game with the dev server, headless (Playwright's Chromium, as stage 6 did) or by hand, with the debug console (`~`). Record each part's commands and what was seen, with screenshots kept outside the repository (the scratchpad or `logs/`).

1. `facility builders_lodge 2`, `stock gold 300 stone 50 iron 50`; walk to a held site with an outpost (build one first if none: the Improve button reads "Build an Outpost: 15 gold, 10 timber" with timber in the stock). Improve it to a works, then a fort. See the button's labels, the messages ("A Mine stands at …"), the map label's building line, the palisade on the fort, and the hex info's yield ("Mine: 5 iron every 5 days.") and strength lines.
2. Send the party away (out of the fort's reach), `days 200`. Watch the fort hold at blight level 2 with a warning of the days to corruption (use `blight 2 <site>` if the land never gets there by itself, and say so). Then `blight 3 <site>`, `days 1`: see it lost with "… and its fort razed."
3. `facility trading_post 6`, `days 25`: five market yields of 5 gold (the `days` yield line, the stock panel's last-yield line, the stock's gold). **Taint timing:** the encampment's clean push cleanses its hex within days, so taint it just before a yield day: pass days until the turn is one short of a multiple of 5, `blight 1 encampment`, `days 1`, and see the market's yield halved to 2.
4. Load a save from before the stage (version 26, with an outpost: from `src/game/fixtures/` if step 01 added one with an outpost, through the menu's load, or written into the browser's storage by the test hook). Its outposts show as level 1: the hex info and the map label say "Outpost", and the Improve button offers the works.

If a part shows a bug, fix it test-first if it is small and in this stage's code, else stop and report it.

### 4.6 Final checks

`npm test`, `npm run test:browser`, `npm run build`, `npm run sprites:check`, all passing; and the `grep` of §4.3.

## 5. Verification

- The two 500-campaign summaries are in the execution record with the baseline beside them; the waiting check shows waiting earns less.
- The figure is within about 5 points of the baseline, or the move is explained (or retuned, with the fixture re-recorded and each try recorded).
- The docs named in §4.4 are updated; `scripts/claudeMd.test.ts` passes; the `grep` for the removed names finds nothing stale in `CLAUDE.md` files, `docs/reference/`, the manual or the code.
- The screenshots are retaken and were looked at.
- The play script's four parts were walked, each with what was seen.
- `npm test`, `npm run test:browser`, `npm run build` and `npm run sprites:check` pass.

## 6. Completion criteria

- [ ] Both measurements recorded against step 01's baseline; the waiting check passes; improvements, Lodge and trading post levels and gold by source recorded.
- [ ] The figure's move judged: explained, or the fort's strength retuned (fixture re-recorded and said so).
- [ ] Any wrappers left by step 06 deleted.
- [ ] CLAUDE.md files, `docs/reference/` (game, simulator, scenes), `docs/designs/blight.md`, the manual and its screenshots current.
- [ ] The stage design's Implementation notes and the stages index's stage-7 row written.
- [ ] The play script walked, recorded part by part.
- [ ] `npm test`, `npm run test:browser`, `npm run build`, `npm run sprites:check` pass.
- [ ] One commit (or a retune commit and this one), "Stage 7 step 07: measure, document, play", no attribution lines; the index's row 07 updated with status and commits.

## 7. Execution record

On `long-campaign-stage-07` from `cc03a58`, local Node 26. The machine was loaded (load 5–12); runs one simulation at a time.

**Measured** (seed 1, 500 campaigns, without `--waiting`, as the baseline was; summaries in `logs/s7-guard.txt` and `logs/s7-company.txt`):

| Run | Source | Days | Battles | Dead | Captured, lost | Blighted | Shrine, Lodge, post at end | Built (outpost, works, fort) | Gold: sites, market, sales |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `--parties 1`, step 01 baseline | 234 | 286 | 19.4 (9709) | 1.1 | 3.3, 0.1 | 38% | 1.0, —, 1.1 | 0.6 outposts | —, 0, 46 |
| `--parties 1`, now (`logs/s7-guard.jsonl`, 6 min 37 s) | **239** | 286 | 19.5 (9730) | 1.1 | 3.4, 0.1 | 38% | 0.9, 0.2, 1.1 | 0.6, 0.0, 0.0 | 228, 0, 42 |
| default company, step 01 baseline | 236 | 286 | 19.5 (9730) | 1.1 | 3.3, 0.1 | 38% | 1.0, —, 1.1 | 0.5 outposts | —, 0, 45 |
| default company, now (`logs/s7-company.jsonl`) | **239** | 286 | 19.5 (9729) | 1.1 | 3.4, 0.1 | 38% | 0.9, 0.2, 1.1 | 0.6, 0.0, 0.0 | 227, 0, 42 |

Full first summary lines (`--parties 1`): "Beat the Source: 239 of 500 (47.8%); party fell: 261 (52.2%); encampment lost: 0"; "A campaign: 286 days, 19.5 battles, 28.0 spawns, 3.4 sites captured and 0.1 lost, 38% of the land blighted at the end"; "Shrine: level 0.9 at the end; Builders' Lodge: level 0.2 at the end"; "Improvements: 0.6 outposts, 0.0 works, 0.0 forts built a campaign; held resources at the end: 4.7 bare, 0.5 outposts, 0.0 works, 0.0 forts"; "Gold by source: sites 228, market 0, sales 42 a campaign"; "Trading post, workshop, infirmary: levels 1.1, 0.6, 0.5 at the end; 0 gold on gear and 42 from sales, 4.4 items crafted".

**The waiting check and the distributions** came from a scratch script (`scratchpad/records.ts`, not committed) that runs `runCampaign` exactly as `--campaign` does, with `--waiting`, and dumps every `CampaignRecord` (`logs/s7-guard-waiting-records.json`, `logs/s7-company-waiting-records.json`): its Source count and battles equal the runs above, so `--waiting` changes no play.

- One party: "Waiting check: income 1.3 a day campaigning, 1.0 waiting at home: waiting earns less" (1.298 against 0.984; the twin below in 438 campaigns, equal in 62, above in none). Lodge at the end ≥1 in 105 campaigns, 2 in 2; trading post at the end 1 in 451, 2 in 49, never 3 or higher (no market gold in any campaign); built a campaign 0.55 outposts, 0.01 works, 0 forts (works in 7 campaigns); held at the end 4.71 bare, 0.53 outposts, 0.01 works, 0 forts; gold by source 227.5 sites, 0 market, 42.5 sales.
- Company: the same line, 1.298 against 0.984 (below in 438, equal in 62, above in none); Source 239 and 9729 battles, as without `--waiting`. Lodge ≥1 in 105, 2 in 1; post 1 in 452, 2 in 48, never higher; built 0.55 outposts, 0.01 works, 0 forts; gold 227.5 sites, 0 market, 42.4 sales. The company of three plays as one party here: the hall never reaches level 4 by the ready level of 7 (0 campaigns, 1 at the baseline).

**Judgement.** +5 with one party (234 → 239), +3 with the company (236 → 239): within about 5 points, and inside the bands (215–250, 220–260; days 286; deaths 1.1). The land does not end cleaner (38% blighted, 0.1 lost, no forts held), so the fort's strength is not retuned. Works, forts and the market barely occur, so the move is not theirs; it is step 06's simulated economy (materials kept for the Lodge and the post's upper levels, so less sold: 42 against 46 gold; the Lodge raised in a fifth of campaigns), which changes buys, crafts and walks home and so the battles, as step 06's 50-campaign run (22 → 23) and its guard decomposition showed. No rule changed in this step; the refactor guard is untouched and green.

**Carried-in fixes.**
- Encampment details (step 05's review): every attempt now wraps at `FRAME_W - 2 * left`; the line gap is 3 (was 4); `Facility.next` lets a facility word its next level as what it adds, and the trading post's does ("Adds Fine gear and Lesser runes.", "Adds Masterwork gear.", "Adds iron and steel gear, runes of the second rank and 2 gold every 5 days.", "Brings 3 gold every 5 days, up from 2.", "Brings 5 gold every 5 days, up from 3."), so levels 3–5 fit at 12 px with the flavour line. The probe gains `detailsSize`. Tests: `encampment.test.ts` "says only what the next level adds…" and e2e "fits the trading post's details at level 3/4/5 at full size…", which failed on the old wording (the flavour line dropped at all three) and, with only the wording changed, still failed at 11 px (the three lines ended at 439.3 against the 438 limit) until the gap went to 3. The duplicated JSDoc above `detailLines` is gone. The index's row 05 names b6c9bf2.
- World header (step 04's review): no retaken screenshot shows a map label behind the status block, so it could not be seen; the status text is now outlined in the bar's colour (`stroke`, 4) so a label dimmed under the header cannot muddle it. Recorded in `docs/reference/scenes.md`.

**Wrappers.** None left: step 06's merge clean-up (f6c2416) deleted `outpostSite` and `outpostSiteRefusal`; the §4.3 grep finds only the doc comment above the guard records saying `outpostsBuilt` went.

**Docs.** `scripts/CLAUDE.md` (bands "Now" with stage 7's figures, the waiting check); `docs/reference/scenes.md` (encampment details wording and fit, the status outline); the manual §8 (a fort lost only when corrupted, a lost site razes its building, the market's gold and its taint) and §9 (works' strength, the fort's yield and palisade, a new screenshot `world-improve.png` of a Mine with the Improve button offering the fort, added to `e2e/manual.shots.ts`); `docs/designs/blight.md` §4.6 and §4.7 (pointers to stage 7); the stage design (status done, Implementation notes); the stages index (row 7, the guard's history). The CLAUDE.md files, `docs/reference/game.md` and `simulator.md` were already current from steps 01–06 (checked).

**Screenshots.** `npm run manual:screenshots`: 8 passed; every image retaken. Looked at `encampment.png` (six plots, the Lodge's empty plot), `world-blight.png` (the three-line status with "Last yield: sites 4 gold, 2 iron"), `world-parties.png`, `world-travelling.png` and the new `world-improve.png`.

**Play script.** Walked headless through a temporary in-browser test (`scratchpad/zz-walk.test.ts`, not committed) at 1280×800; what was seen is in the stage design's Implementation notes, part by part; screenshots in `scratchpad/walk/`. Not seen: the fort's days-to-corruption warning at level 2 (the fort pushed its hex back from 2 to 1, so it was "receding"); the land never reached the fort by itself in 200 days, so `blight 2` set it.

**Verification.**
- `npx tsc` clean; `npx vitest run --maxWorkers=3` (`npm test`'s second half; under load): 97 files, 2392 tests passed, the refactor guard and `claudeMd.test.ts` among them.
- `npm run test:browser -- --maxWorkers=2`: 12 files, 171 tests passed (168 before, plus the three trading-post fit tests).
- `npm run build`: built (the usual chunk-size warning). `npm run sprites:check`: up to date, 126 sprites.
- The §4.3 grep over `src scripts e2e`: only the doc comment above `GUARD_RECORDS`.
- Budgets: two 500-campaign CLI runs and two 500-campaign `--waiting` record runs, one at a time.

**For the orchestrator / later stages.** The simulated party's economy barely reaches works, forts or a Market, so this stage's buildings are not exercised by the balance figure; if the user wants the simulator to measure them, the careful party's spending order (the Lodge last, the post raised only with spare silver and crystal) is the lever. The two record runs' JSON stays in `logs/` (gitignored).

### Verification fix round (overall review, QA, simulated user)

1. **Fixed (blocking): the last yield carried into another game.** `WorldScene.create` now clears `lastYield` when the game it is given is not the one it had (kept back from a battle of the same game; blank after Continue on a load or a new game). Test: e2e "is not carried into another game started from the menu" (a yield day, Esc, New game: no "Last yield"), red before the fix.
2. **Fixed: the three-line stock panel ran into the hint at 840×560.** `fitStatus` places the panel and, when its three lines would still meet the hint's box, sets them at 11 px with line spacing −2 from y 1 (they end at about y 43, the hint starting at 44); at 1280 nothing changes. It runs on layout, after the status's text and after the hint's. The probe gains `hintRect`. Test: e2e "stays clear of the header hint at 840 by 560…" (trading post 6, a yield day with "market 5 gold"), red before (the boxes met: status 3–55, hint 44–57), and red once more at 11 px alone (still 3–49) until the spacing and position.
3. **Fixed: the Lodge's roads reason only after reselecting.** `FacilityView.barred` is the facility's own refusal (the Lodge's `ROADS_REFUSAL` at 2), never the stock's; a successful raise that leaves one appends it to the message: "The Builders' Lodge is raised to level 2. Roads come with trade routes.". Tests: `encampment.test.ts` (`barred` set at Lodge 2, null for a stock shortfall) and e2e "says why the Lodge goes no higher as soon as it is raised to 2…", red before.
4. **Fixed: no word of the market's gold below level 3.** The trading post's effect at levels 1 and 2 ends "From level 4: 2 to 5 gold every 5 days." (from `MARKET_INCOME`); level 3's Next line already says "2 gold every 5 days". The fit tests now cover levels 1 to 5, all at 12 px with the flavour line.
5. **Fixed:** `src/game/CLAUDE.md`'s "A new facility" checklist names `setFacilityLevel`'s field.

Docs: `docs/reference/scenes.md` (the barred message, the trading post's market line, `fitStatus`, the last yield's reset), the manual §9 (the Lodge's reason at once, the market's line, the panel smaller in a narrow window and blank after a load). No manual screenshot shows these (the shots are at 1280, the encampment's selects the guild hall), so none was retaken.

Verification: `npx tsc` clean; `npx vitest run --maxWorkers=3` 97 files, 2393 tests passed; `npm run test:browser -- --maxWorkers=2 e2e/world.test.ts e2e/encampment.test.ts e2e/debug.test.ts` 3 files, 90 tests passed; `npm run build` built.
