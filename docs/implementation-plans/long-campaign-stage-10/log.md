# Log: long campaign, stage 10 (forging and the high tiers)

Append-only history for [the plan](index.md) and [the feature record](../../features/long-campaign-stage-10.md): baselines and measurements, run histories, timings, review summaries, and anything else the plan accumulates as steps finish. The orchestrator does not read this file on resume.

## Step 01: the stage's baseline

2026-11-23, code `f3a1102` (no `src/` or `scripts/` change since; `f2b7193` and later are docs). Seed 1, label `s10-01`, logs under `logs/s10-01-*` (gitignored). Run one at a time through `yomi-measure`; nothing else ran beside them except the orchestrating session idling. Every figure is identical to stage 9's final figures.

| Measure | Flags | Source wins | Days | Battles | Heroes dead | Stage 9 | Wall time |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 50-campaign check | `--campaign --battles 50 --parties 1 --ready-level 7 --near-source` | 26 of 50 | | | | hash identical | 19 s |
| `one` | `--campaign --battles 500 --parties 1 --ready-level 7 --near-source` | 288 of 500 (212 fell) | 331 | 18.8 | 1.2 | 288 / 331 | 4:19 |
| `company` | `--campaign --battles 500 --ready-level 7 --near-source` | 289 of 500 (211 fell) | 334 | 18.9 | 1.2 | 289 | 5:07 |
| `rl10` | `--campaign --battles 500 --ready-level 10 --near-source` | 409 of 500 (91 fell) | 530 | 33.9 | 1.3 | 409 / 530 | 9:41 |
| `long` | `--campaign --battles 100 --log none` | 15 of 100 (85 fell) | 1272 | 46.4 | 3.3 | 15 / 1272 / 46.4 | 3:48 |

50-campaign SHA-256: `57fdea1553a35b1af0e33b74a11ea9fe0a0e2f62ef9e5c80972af59276e53e75` (identical to stage 9 step 09).

`one` also: 33.3 spawns, 3.5 sites captured and 0.1 lost, 27% of the land blighted; gold sites 263, market 0, routes 0, sales 41; 0.0 tier-2 items; guard 0.0 battles. `company`: 0.0 promotions, 0.0 guard battles, 33.6 spawns. `rl10`: 62.8 spawns, 3.2 guard battles.

### Long baseline (100, `--log none`)

- Outcomes: Source 15, fallen 85, encampment lost 0, out of days 0. 59.8 spawns, 8.1 sites captured and 1.5 lost, 57% blighted. Walking: 1129.0 days, 171.3 walking home.
- Final levels (vanguard's): lowest 6.7, highest 7.9 on average; over the 15 campaigns ending with a vanguard 18.1 / 19.1.
- Battles to level: 5 6.8 (84 campaigns), 10 28.5 (55), 15 54.3 (44), 20 none (0).
- Heroes died at level: 2 (12), 3 (40), 4 (18), 5 (39), 6 (37), 7 (36), 8 (28), 9 (15), 10 (16), 11 (3), 12 (3), 13 (7), 14 (2), 15 (21), 16 (29), 17 (16), 18 (4), 20 (1), 21 (1).
- Threat table (battles, win rate): 1 200 1.0; 2 367 0.992; 3 313 0.958; 4 459 0.998; 5 516 0.998; 7 778 0.956; 9 827 0.828; 12 903 0.601; 15 250 0.868; 18 4 0.75; 20 18 0.833.
- Gold a campaign: sites 1016, market 557, routes 552, sales 2039; 2234 on gear, 179 on runes.
- Trading post / workshop / infirmary levels at the end: 3.5 / 1.8 / 1.8; 20.1 items crafted; tier-2 items bought 4.3.
- Runes a campaign: 44.6 found, 3.4 bought, 2.4 fused; 1.7 sockets filled at the end.
- Guild hall level 3.7; 30.4 recruits; 5.9 parties wiped; 1.8 guard battles; capstones in 17 campaigns.

Outcome (step 01): engineer sonnet, reviewer sonnet, clean, 1 review round.

## Step 02: tiers 3 to 5 and bandit gear

2026-11-23, on `39a2a01` plus the step's change.

- 50-campaign check: `57fdea1553a35b1af0e33b74a11ea9fe0a0e2f62ef9e5c80972af59276e53e75`, **identical** to step 01.
- Refactor guard: untouched, green.
- Tier-1/-2 items: the 56, hashed in order before and after, identical (`bf524dffcf0fedee03d889f3264fe263c2b7300d7c419faa1411406425e2f6e1`, held in `catalog.test.ts`).
- Policy snapshot re-recorded: 69 (encounter, threat) groups before and after, same order; changed exactly `bandit_company` 9–13 and `freebooter_host` 14–20 (12 groups; 3,153 lines → 2,559); the other 57 groups' 11,683 lines identical, `bandit_company` 8 among them. Total 14,836 → 14,242 lines; hash `639fea308b2473b4c4a24719ff0ad711a6097c6258decd8ba25dcfadc3676f48` → `b9cef6e182080a3fa26d796534ec1b631e6628d6a140c11525ebee8fabb728ac`.
- Long run, informational (100, `--log none`, seed 1, ~4 min alone, `logs/s10-02-long.txt`): Source 2 of 100 (step 01: 15), fell 96, out of days 2; 1390 days, 41.7 battles; battles to level 5 6.8 (84), 10 28.3 (53), 15 53.6 (18; was 44), 20 none. Threat win rates: 9 0.712 (was 0.828), 12 0.395 (0.601), 15 0.391 (0.868), 18 2/2, 20 2/3. The far bandits' tiers 3–5 with the party still unable to forge (steps 03, 09).

Outcome (step 02): engineer opus, reviewer opus, clean, 1 review round.

## Step 03: the workshop

2026-11-23, on `7c2084e` plus the step's change.

- 50-campaign check: `57fdea1553a35b1af0e33b74a11ea9fe0a0e2f62ef9e5c80972af59276e53e75`, **identical** to step 02 (about 21 s alone).
- Refactor guard and policy snapshot: untouched, green.
- `npm test`: before step 05's merge every test but one passed (`encampmentView.test.ts` asks the atlas for `camp_workshop/level_4`–`6`); after the merge (`dd96b2c`), 105 files, 2,669 tests, all pass.
- Long campaign, unmeasured: `materialNeeds` now keeps 20 mithril, 20 adamant and 10 starmetal instead of selling them, and the simulator raises the workshop to levels 4 to 6 greedily when the stock affords them (100, 150, 200 gold a level). No forging follows until step 09. Step 10 should read its long figures with that in mind.

Outcome (step 03): engineer opus, reviewer opus, clean, 1 review round.

Step 05 workshop sprites: engineer sonnet, reviewer opus, clean, 1 review round, plus two look passes the orchestrator asked for (level 6 banner moved to the roof with a gold chevron, orange rim on the star-metal glow, level 4 bellows pipe); sprites:check pass, yomi-asset-check pass; no simulation.

## Step 04: partners' goods

2026-11-23. 50-campaign check `57fdea1553a35b1af0e33b74a11ea9fe0a0e2f62ef9e5c80972af59276e53e75`, **identical** to step 03. Guard and policy snapshot untouched, green. `npm test`: 105 files, 2,676 tests pass.

Outcome (step 04): engineer sonnet, reviewer opus, clean, 1 review round (cycle comment, one refusal-order test, wording).

06 high levels in the debug console: engineer sonnet, reviewer sonnet, clean, 1 review round; npm test 2674 passed, browser debug 5 passed; no simulation (dev tool, moves no rule).

## Step 07: a faster auto-resolve estimate

2026-11-23, on `6de80da`. The fixture and `scripts/forecastCost.ts` committed first (`2cdd885`), recorded from the code before any change (recorded twice, the same both times). **The machine was loaded throughout** (other sessions' in-browser tests and services: load averages 5 to 45), so every figure below is noisy; old and new were run back to back (old from a detached worktree of `2cdd885`) and the ratio is the steadier figure.

**Identity.** Every change keeps every estimate and every battle byte-identical:
- the estimate fixture (`forecast.test.ts`, 18 starts: levels 1 to 18 in tier 1 to 5 kits, all ten encounters, four mid-battle snapshots, one where every sample stalls; the exact `Forecast` and a sha256 of every sample's event log) passes unchanged;
- the policy snapshot and the refactor guard pass, unedited;
- the 50-campaign check: `57fdea1553a35b1af0e33b74a11ea9fe0a0e2f62ef9e5c80972af59276e53e75`, **identical** to step 04 (taken at the start of the step and again at the end).

**Profile** (`node --cpu-prof`, 40 samples, the level-15 party in tier 4 against freebooter_host 15; total time, of the estimate's):

| | before | after |
| --- | --- | --- |
| `legalActions` | 84% | 53% (through `legalFor`) |
| `canCast` (area spells: each board hex as a centre) | 47% | 3% (`castAimSuits`) |
| `statsOf` (read twice per hex per area spell) | 25% | 4% |
| `areaTouches` (a Set of hex-key strings per centre) | 28% | 3% |
| `reachable` / `reachableHexes` (the pathfinder) | 26% / 22% | 44% / 40% |
| the `aggressive` policy's own scoring | 8% | about 20% (`bestStrike` 9%, `expectedHarm` 6%) |

Level 6 (tier 2, bandit_company 9) has the same shape: `legalActions` 79%, area abilities (`canAim`) 24%, casts 18%, the pathfinder 36%. What grows with level: the mage's spell list (more area spells, each tried at every hex of the board, `statsOf` read twice for each), and samples last longer (4.4 rounds at level 6, 14.2 at level 15).

**The changes kept** (each checked against the fixture as it was made):
1. `legalActions` reads the actor's stats once and checks each aim past the pay check (`castAimSuits`, `areaAimSuits`); `canCast` and `canAim` are those plus their own checks. About 2.3×.
2. `areaTouches` answers a burst by distance (`areaCovers`) instead of a Set of hex keys; cones and lines as before. (New test: the same units as `areaOf`'s hexes for bursts of radius 0 to 3.)
3. `reachableHexes` keeps a route as a link to the one before (spelled out once per hex kept), shares the provoked set when a step provokes no one new, a subset test without spreading, and numeric keys (`hexIndex`) inside the search; `reachable` finds the blocked hexes and the foes that could react (`canReact`) once a search, `reactorsAt` reading the same rule (`leavesSideOf`).
4. `PolicyContext.legalFor(unit)`: `autoPlay`'s step lists `legal` only if a policy reads it (a getter), and `aggressive`, which weighs one unit at a time and acts with the first that has a choice, reads `legalFor` (new tests: `legalFor` equals `legal` filtered at every step of ten battles; `aggressive` chooses the same from either and never lists `legal`). The largest gain: about 2.5× on its own.

Tried and dropped: a plain breadth-first path in `reachableHexes` when no foe within reach could react (no measurable gain). Not tried: memoising `reachable` across a step's `legalFor` and `move` (needs an invalidation key the engine does not have), a larger slice, a worker.

**`node scripts/forecastCost.ts`** (40 samples, median of 5; CPU ms an estimate, the steadier figure; wall clock close to it):

| start | before | after | before (heavier load) | after (heavier load) |
| --- | --- | --- | --- | --- |
| level 6, tier 2 vs bandit_company 9 | 1111 | 222 | 618 | 390 |
| level 12, tier 3 vs bandit_company 12 | 1951 | 254 | 871 | 506 |
| level 15, tier 4 vs freebooter_host 15 | 3038 | 459 | 4097 | 870 |
| level 18, tier 5 vs freebooter_host 18 | 2810 | 451 | 4387 | 879 |
| level 15, 6 steps in | 2375 | 416 | 4399 | 871 |

The first measurement, before any change and at load 7 (wall ms only): 856, 1028, 2206, 2436, 2426. In one process, old and new alternated (level 15): 4804 → 891 ms, 5.4×; level 6: 1388 → 332, 4.2×.

**The browser** (a throwaway in-browser test, kept out of the repository and deleted: a new game, the save's kit set to tier 4 Fine (adamant longsword, wyrmwood shield and bow and wand, adamant breastplates), reload and Continue, debug `level 15 all auto`, `heal all`, `fight freebooter_host 15`; timed in the page from the first frame the battle screen has control to the frame its probe's `forecast` is set; then again from End Turn's return of control). Headless Chromium drew 12 to 20 frames a second on this loaded machine (50 to 115 ms a frame, before and after alike), and the estimate works 10 ms a frame, so its wall clock is not a player's: the frames it takes are the measure, about 16.7 ms each at 60 frames a second.

| | before: frames (headless wall) | after: frames (headless wall) |
| --- | --- | --- |
| battle start | 466 (47.0 s), 367 (25.3 s), 416 (47.9 s) | 98 (8.4 s), 84 (6.5 s), 50 (2.5 s), 92 (7.6 s) |
| after End Turn | 239 (19.0 s), 134 (6.7 s), 185 (11.3 s) | 49 (4.2 s), 46 (4.4 s), 40 (3.2 s), 43 (3.5 s) |

At 60 frames a second the after figures are 0.7 to 1.6 s from the battle's start (the quietest run 0.83 s) and 0.7 to 0.8 s after an action, against 6 to 8 s before; a quiet machine's 0.45 s of work is about 45 frames, 0.75 s. The estimate the battle showed was the same before and after (24 wins, 23 heroes lost, of 40). Judged under about 1 s; a stopwatch in a real browser on a quiet machine would confirm it.

**50-campaign check's wall time**, back to back, `--log none`, load 7 to 11: 37.3 s before, 25.3 s after (the campaign's world turns are most of the rest).

Verification: `npx vitest run src/game/forecast.test.ts` 41 pass (before and after every change); `npm test` 105 files, 2,702 tests pass; `npm run test:browser -- -t "Auto|auto-resolve|estimate"` 19 pass.

Step 07 review: the reviewer (opus) found the fixture blind to the pathfinder's tie order (flipping the reduce's `<` to `<=`, or `push` to `unshift` for the routes kept at a hex, left all 18 fixture entries passing; only the refactor guard caught it). Fixed with a test in `hex.test.ts` comparing `reachableHexes` with a copy of its version at `2cdd885` on 400 seeded boards with walls and foes (zones of control), 400 with seeded provokers that tie (over 1,000 tied hexes counted), and 100 with none; both mutations fail it.

Outcome (step 07): engineer opus, reviewer opus, clean, 1 review round.

Step 08 scenes: engineer sonnet, reviewer opus, clean, 1 review round (five notes fixed in ed99a2f: forge materials first in the workshop stock line and the preview, probe doc, a temper test, a refused-row e2e, trophies full stop); header stock at 840 checked and left (three lines, '+4 more', clear); npm test 2693 at the branch, 2715 after merge; e2e 13 files 190 tests; no simulation.

## Step 09: the simulator's gear policy

2026-11-23, on `96afb16` plus the step's change (load about 3.5–4.5).

- Refactor guard: part 1 (fields `goldOnForging` 0, `kitAtLevel`) by value, events hash `e4dd3391...fb6394` unchanged; with the policy in, still unchanged, so not re-recorded.
- 50-campaign check: `57fdea1553a35b1af0e33b74a11ea9fe0a0e2f62ef9e5c80972af59276e53e75`, **identical** (26 of 50; 0 gold on gear, 0 on forging; about 24 s).
- `one` (500, `--near-source`, `yomi-measure`, `s10-09`): 288 of 500 (212 fell), 331 days, 18.8 battles, 1.2 heroes dead; identical to step 01; about 4 min. Kit at 5 (443): tier 1.0 every role, 0 runes.
- `long` (100, `--log none`, about 3:45): Source 1 of 100 (fell 97, out of days 2); 1369 days, 41.7 battles, 53.5 spawns; gold sites 1094, market 676, routes 660, sales 2198; 448 on gear, 2114 on forging and tempering; tier-2 bought 1.9; runes 34.5 found, 9.0 bought, 6.1 fused, 1.8 sockets filled; post / workshop / infirmary 3.3 / 2.3 / 1.8; battles to level 5 6.8 (84), 10 28.4 (53), 15 55.9 (16). Kit at 5: tier 1.0 all; at 10: 1.0 all; at 15: fighter 1.5 / 0.3 runes, archer 1.5 / 0.3, mage 1.3 / 0.4 (expected 2, 3, 4). Threat win rates: 7 0.939, 9 0.783, 12 0.384, 15 0.298 (141 battles), 18 0/1, 20 1/1.
- Diagnostic (10 long campaigns, temporary stderr): forging in 2 of 10, first on days 1111 and 1468 with heroes at levels 4–6; 963 forges and tempers (230 breastplates, 172 war hammers, 169 staffs).
- **Corrected in review round 1** (the reviewer's visit-by-visit diagnostic): the workshop is held at level 1–2 by stone and gold, not mithril (level 2 needs 15 stone; campaign 2 sat at level 1 from day 308 to 1063 with 927 gold and 70 mithril but 0 stone); mithril and elderwood pile into the hundreds. The re-forging is of replacement parties of level 4–5 recruits sent at threat-12 bandit companies about every 85 days (40 and 55 wipes in the two forging campaigns): the company's long-campaign policy skew the user deferred to stage 12. For step 10: stone (or the workshop's level 2 cost) is the lever on the kit's lag, not mithril.
- Review round 1 fixes (no same-tier family switch; diagnosis corrected): `npm test` 2,736 pass; 50-campaign check `57fdea15...6e53e75`, identical.

Outcome (step 09): engineer opus, reviewer opus, clean, 1 review round.

## Step 10: measure and judge

2026-11-23, code `82a7969` (unchanged through the step; nothing retuned, so the 50-campaign check was not needed). Seed 1, label `s10-10`, logs `logs/s10-10-*` (gitignored), run one at a time through `yomi-measure`; the machine was quiet (load 2.2–3.8, the step's own runs only).

| Measure | Flags | Figure | Band | Step 01 | Wall time |
| --- | --- | --- | --- | --- | --- |
| `one` | `--campaign --battles 500 --parties 1 --ready-level 7 --near-source` | 288 of 500, 331 days, 18.8 battles, 1.2 dead | 215–250 (288 / 331 days accepted until stage 12) | 288, 331 | 2:54 |
| `company` | `--campaign --battles 500 --ready-level 7 --near-source` | 289, 334 days | 220–260 (289 accepted) | 289, 334 | 3:49 |
| `rl10` | `--campaign --battles 500 --ready-level 10 --near-source` | 409, 533 days, 34.0 battles, 1.3 dead | 370–420 | 409, 530, 33.9 | 8:26 |
| `long` | `--campaign --battles 100 --log none` | 1 of 100 (fell 97, out of days 2), 1414 days, 42.3 battles | report only | 15, 1272, 46.4 | 4:07 |
| `gr3` `bc3` `bc4` `bc5` `sn5` `sp5` | cells | 500, 455, 454, 494, 451, 475 | bands.md | = Now | 9–10 s each |
| `sg7` `sg10` `tl5` | cells | 0, 1, 0 | = Now | = Now | 10–17 s |
| `bco9` `bco12` `fh15` `fh18` | report only | 2, 0, 0, 0 | report only | stage 9: 1, 0, 0, 0 | 13–25 s |
| `sg20-18` `sg20` | report only | 28, 71 | report only | stage 9: 28, 71 | 30, 37 s |

Early figures: every one identical to step 01 in wins; `rl10`'s days 530 → 533 and battles 33.9 → 34.0 (the gear policy's late home visits; wins unchanged). Gear in `one`/`company`: 1 gold on gear, 0 on forging, 0.0 tier-2 items, 0.0 runes worn; workshop 0.7 and post 1.1 at the end. `rl10`: 26 on gear, 0 on forging, 0.1 tier-2, workshop 1.2, post 2.0.

### Long run (100, `--log none`, 4:07, load 3.1–3.8)

Against step 09's long run (before its review round 1): kit, battles to level and outcomes identical; 1369 → 1414 days, 41.7 → 42.3 battles, forging 2114 → 2271 gold (review round 1's no-same-tier-switch).

- Outcomes: Source 1, fallen 97, encampment lost 0, out of days 2. 53.6 spawns; 7.4 sites captured, 1.6 lost; 64% blighted. Walking 1255.2 days (170.6 home).
- Final levels: lowest 5.1, highest 6.2.
- Battles to level: 5 6.8 (84 campaigns), 10 28.4 (53), 15 55.9 (16), 20 none.
- Deaths by level: 2 (12), 3 (41), 4 (18), 5 (67), 6 (54), 7 (41), 8 (33), 9 (10), 10 (9), 11 (9), 12 (16), 13 (14), 14 (15), 15 (15), 16 (6), 17 (5), 19 (1).
- Threat table (battles, win rate): 1 200 1.0; 2 369 0.992; 3 287 0.955; 4 441 0.998; 5 489 1.0; 7 754 0.939; 9 767 0.785; 12 768 0.367; 15 156 0.295; 18 1 0; 20 1 1.
- Gold a campaign: sites 1130, market 721, routes 689, sales 2300; 451 on gear, **2271 on forging and tempering**, 381 on runes. Post / workshop / infirmary 3.3 / 2.3 / 1.8. Tier-2 bought 2.0. Runes 34.6 found, 9.6 bought, 6.3 fused, 1.9 sockets filled. Guild hall 3.6, 40.7 recruits, 8.3 parties wiped.

**Kit against `expectedKit`** (main-hand tier, runes worn; judged where ≥ 10 campaigns):

| Mark (campaigns) | fighter | archer | mage | expected tier (−1 floor) | sockets expected | Verdict |
| --- | --- | --- | --- | --- | --- | --- |
| 5 (84) | 1.0, 0.0 | 1.0, 0.0 | 1.0, 0.0 | 2 (1) | 1–2 | within a tier |
| 10 (53) | 1.0, 0.0 | 1.0, 0.0 | 1.0, 0.0 | 3 (2) | 2–3 | **lags by 2** |
| 15 (16) | 1.5, 0.3 | 1.5, 0.3 | 1.3, 0.4 | 4 (3) | 3–4 | **lags by 2.5–2.7** |
| 20 (0) | — | — | — | 5 | 4–6 | not reached |

### The diagnosis check (temporary trace, not committed)

A stderr line at each home visit (`carryOut`'s `hall` case, after `visitFacilities`), 100 long campaigns, seed 1, `--log none`; identical summary to the `long` run (draws untouched); trace reverted. 2,126 visits.

- **The workshop is held at level 1 by stone.** 52 of 100 campaigns never pass level 1 (18 never build it). At 307 of 323 level-1 visits the stock held under 15 stone (and under 40 gold at 204); never both enough. Stone comes only from Old Quarry: held in 51 campaigns, first on about day 682 (median), and blighted at 215 of those 323 visits (half yield). Every campaign that reached level 2 held the quarry; in all 51 that raised the post to 2 it did so first (`visitFacilities` raises the post before the workshop; both cost 15 stone).
- **Level 3 → 4 (forging) is held by mithril and gold:** of 182 level-3 visits, mithril under 20 at 161 (Mithril Lode held at 24), gold under 100 at all 182. Level 4 reached in 37 campaigns, median day 1176.
- **The vanguard that reaches 10 does so before the forge exists, and rarely comes home on the way.** Median day the vanguard is first seen home at level 10+: 848; the workshop at 4 before it in 1 of 8. Visits by a vanguard at lowest level 9–12: 10 in 100 campaigns; 13–16: 3. The kit at 10 and 15 is what it left home with at 5–8.
- **The forging gold re-arms recruits.** 742 visits forged or tempered (227,110 gold, 35 campaigns): 739 of them with the party's lowest level 4–6 (676 at 5); 232 by guards. Those parties then meet threat-12 bandit companies (win rate 0.367) and wipe (8.3 a campaign).
- Verdict: the step 09 reviewer's diagnosis holds. Outer-site yields and forge/temper costs act only after the workshop reaches 4 (day ~1176, after the vanguards that reach 10 got there), and the gold they would free is spent on wiped recruits. No trial was run (the brief allows one where a lever could plausibly help; none could, above).

Not retuned; `npm test` 107 files, 2,736 tests pass on `82a7969`. Stopped for the orchestrator.
