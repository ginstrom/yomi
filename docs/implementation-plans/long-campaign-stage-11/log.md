# Log: long campaign, stage 11 (the high roster)

Append-only history for [the plan](index.md) and [the feature record](../../features/long-campaign-stage-11.md): baselines and measurements, cells, tuning trials, run histories, timings, review summaries, and anything else the plan accumulates as steps finish. The orchestrator does not read this file on resume.

## Plan written

2026-11-26, against `1a008af` on `long-campaign-stage-11`. Fifteen steps; ten open questions, each with a default (index, "Open questions").


## Step 01: the stage's baseline

2026-11-26, code `36cf131` (no `src`/`scripts` change since `c138d83`; `git log c138d83..HEAD -- src scripts` empty). Seed 1, label `s11-01`, logs `logs/s11-01-*` (gitignored). Run by `yomi-measure`, one at a time; its first pass failed on a shell word-splitting slip (every run but `long` exited with "Unknown argument") and was rerun in full, so all recorded figures are from the rerun (`logs/s11-01-times2.txt`; `long` ran once, in the first pass). Beside the runs: a Python process at about 70% CPU and the podman VM at about 30%; no other simulation, build or browser test.

**50-campaign check:** `57fdea1553a35b1af0e33b74a11ea9fe0a0e2f62ef9e5c80972af59276e53e75`, identical to stage 10's; 26 of 50, 325 days, 18.9 battles.

| Measure | Flags | Source wins | Days | Battles | Heroes dead | Other | vs stage 10 | Wall | Log |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| guard-50 | `--campaign --battles 50 --parties 1 --ready-level 7 --near-source` | 26 of 50 | 325 | 18.9 | 1.1 | hash identical | none | 16 s | `s11-01-guard-50.txt/.jsonl` |
| one | `--campaign --parties 1 --ready-level 7 --near-source` | 288 | 331 | 18.8 | 1.2 | 33.3 spawns, 27% blighted, 3.5 sites captured, 0.1 lost; gold sites 263, sales 41 | identical | 218 s | `s11-01-one.txt` |
| company | `--campaign --ready-level 7 --near-source` | 289 | 334 | 18.9 | 1.2 | 0.0 guard battles, 0.0 promotions | identical | 183 s | `s11-01-company.txt` |
| rl10 | `--campaign --ready-level 10 --near-source` | 409 | 533 | 34.0 | 1.3 | 3.2 guard battles | identical | 484 s | `s11-01-rl10.txt` |
| long | `--campaign --log none` (100) | 1 (fell 97, out of days 2, encampment lost 0) | 1414 | 42.3 | 3.7 | see below | identical | 166 s | `s11-01-long.txt` |

**Long (100):** walking 1255.2 days (170.6 home); 53.6 spawns; 7.4 sites captured, 1.6 lost; 64% blighted; 8.3 parties wiped; final levels lowest 5.1, highest 6.2; battles to level 5/10/15/20 6.8/28.4/55.9/none in 84/53/16/0 campaigns; gold by source sites 1130, market 721, routes 689, sales 2300; 451 on gear, 2271 on forging and tempering; trading post, workshop, infirmary 3.3, 2.3, 1.8; trophies: no trophy line in the output (`TROPHIES` is empty); Trade 1.34 partners, 1.30 routes opened, 0.82 raided, 0.80 abandoned; Tier-2 bought 2.0; runes 34.6 found, 9.6 bought, 6.3 fused; capstones in 6 of 100 (unbreakable 7, deadeye 5, meteor 4).

Heroes died at level 2 (12), 3 (41), 4 (18), 5 (67), 6 (54), 7 (41), 8 (33), 9 (10), 10 (9), 11 (9), 12 (16), 13 (14), 14 (15), 15 (15), 16 (6), 17 (5), 19 (1).

| Threat | Battles | Won | Win rate |
| --- | --- | --- | --- |
| 1 | 200 | 200 | 1.000 |
| 2 | 369 | 366 | 0.992 |
| 3 | 287 | 274 | 0.955 |
| 4 | 441 | 440 | 0.998 |
| 5 | 489 | 489 | 1.000 |
| 7 | 754 | 708 | 0.939 |
| 9 | 767 | 602 | 0.785 |
| 12 | 768 | 282 | 0.367 |
| 15 | 156 | 46 | 0.295 |
| 18 | 1 | 0 | 0 |
| 20 | 1 | 1 | 1.000 |

Kit lines (all / forge-ready): at 5 (84): fighter, archer, mage tier 1.0, 0.0 runes (expected tier 2, 1-2 runes) / none (0 of 84); at 10 (53): tier 1.0, 0.0 runes (expected 3, 2-3) / none (0 of 53); at 15 (16): fighter 1.5/0.3, archer 1.5/0.3, mage 1.3/0.4 (expected 4, 3-4) / fighter 1.9/0.6, archer 1.9/0.6, mage 1.7/1.0 (8 of 16).

**Cells (500 each; all identical to stage 10):**

| Cell | Wins | Hit rate | Rounds | Wall |
| --- | --- | --- | --- | --- |
| GR3 | 500 | 0.660 | 7.02 | 8 s |
| BC3 | 455 | 0.536 | 11.87 | 9 s |
| BC4 | 454 | 0.612 | 8.33 | 10 s |
| BC5 | 494 | 0.516 | 8.72 | 20 s |
| SN5 | 451 | 0.647 | 9.00 | 16 s |
| SP5 | 475 | 0.637 | 7.12 | 11 s |
| SG7 | 0 | 0.679 | 9.29 | 15 s |
| SG10 | 1 | 0.685 | 13.35 | 20 s |
| TL5 (report) | 0 | 0.705 | 9.09 | 12 s |
| BCO9 (report) | 2 | 0.801 | 5.64 | 15 s |
| BCO12 (report) | 0 | 0.880 | 5.53 | 17 s |
| FH15 (report) | 0 | 0.882 | 7.46 | 20 s |
| FH18 (report) | 0 | 0.806 | 5.50 | 24 s |
| SG20-18 (report) | 28 | 0.760 | 19.12 | 26 s |
| SG20 (report) | 71 | 0.763 | 21.91 | 49 s |

Step 01 outcome: engineer sonnet, reviewer sonnet, verdict clean, 1 review round; commits `42eaff0`, `d113dbf`; `npm test` gate runlog #15 (exit 0, 2740 passed, clean head `d113dbf`, reviewer, Node 26).

## Step 04 outcome

Step 04 (sprites, ring 7): engineer sonnet, reviewer opus, verdict clean, 2 review rounds. Commits `21834ec`, `5619234`, `d4d6402`, `e5e6b6b`; clean-tree checks `npm test` runlog #7 and `npm run sprites:check` runlog #8. No simulation run.

## Step 02: expected kit and the kitted yardstick

2026-11-26, code `67a6f0d` (clean tree). Seed 1, label `s11-02`, logs `logs/s11-02-*` (gitignored). Run by `yomi-measure`, one at a time, no other simulation running.

**50-campaign check:** `57fdea1553a35b1af0e33b74a11ea9fe0a0e2f62ef9e5c80972af59276e53e75`, **identical** to step 01's; 26 of 50, 325 days, 18.9 battles (14 s). The refactor guard is unedited and green.

**`KITTED_FIGHTER_GROWTH`** (the ready-made fighter, `raisedParty` then `expectedGear(fighter, level, 0)`, read by `kittedFighterRow`), beside the same fighter bare today and the bare table `FIGHTER_GROWTH` (measured for campaign §3, not re-measured since):

| Level | Kit worn | Hit | Hit points | Damage a hit | Damage a turn | Armour class | Resistance | Bare today (hit / HP / AC / res) | `FIGHTER_GROWTH` (hit / HP / turn) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 5 | tier 2 Fine, Ember I | 83 | 59 | 1d8+10, +1 fire | 15.5 | 41 | 7 | 83 / 59 / 26 / 2 | 82 / 58 / 10.5 |
| 10 | tier 3 Fine, Ember II, Stone II | 98 | 89 | 1d8+12, +2 fire | 18.5 | 53 | 11 | 93 / 89 / 34 / 2 | 104 / 83 / 12.5 |
| 15 | tier 4 Fine, Ember II, Stone II ×2 | 105 | 119 | 1d8+15, +2 fire | 21.5 | 60 | 13 | 100 / 119 / 34 / 2 | 114 / 108 / 12.5 |
| 20 | tier 5 Masterwork, Ember III, Stone III ×3 | 115 | 149 | 1d8+21, +3 fire (Seared) | 28.5 | 73 | 21 | 100 / 149 / 34 / 4 | 124 / 133 / 13.5 |

One attack a turn at every level (8 action points, a longsword's 5). The fighter wears longsword, shield, breastplate, helm, gauntlets and greaves at every tier (the policy's `armourScore` picks the metal small slots, each with resistance).

**The kitted yardstick's bands** (`foeYardstick(level, 'expected')`; `'bare'` in brackets):

| Level | Armour class | Hit points | Damage a turn |
| --- | --- | --- | --- |
| 7 | 34–54 (35.8–55.8) | 50–100 (34–68) | 7.1–11.8 (6.8–11.3) |
| 9 | 40–60 (44.6–64.6) | 54–107 (36–73) | 8.3–13.8 (7.8–13.0) |
| 12 | 45.8–65.8 (53–73) | 59–118 (37.5–75) | 10.1–16.8 (9.3–15.5) |
| 15 | 50–70 (59–79) | 64.5–129 (37.5–75) | 11.9–19.8 (10.8–18) |
| 18 | 56–76 (65–85) | 77–154 (39–78) | 13.7–22.8 (12.3–20.5) |
| 20 | 60–80 (69–89) | 85.5–171 (40.5–81) | 14.9–24.8 (13.3–22.2) |

**Plausibility (task §4.7).** Against gear §5.8's provisional reading: damage is close (level 10 1d8+12 +2 fire against "about 1d8+15"; level 20 1d8+21 +3 fire against "about 1d8+22 with +5 fire"); armour class is higher (53 and 73 against "about 40" and "about 55"); **resistance is far higher (11 and 21 against "about 5" and "about 8")**. Against campaign §5.2's Elder Wyrm sketch at 18 (about 80 hit points, armour class 80, about 20 a turn): 80 hit points is inside the band at its low end (77–154), 20 a turn is inside (13.7–22.8), armour class 80 is 4 above the band (56–76). So the four yardstick fields are plausible; what the yardstick does not see is the kitted fighter's resistance, which takes 21 off every weapon hit at 17–20 (13 at 13–16, 11 at 9–12): a routine "of about 20 a turn" in two or three strikes does next to nothing to it. `sgk20` shows it: today's Source at 20 lands 34% of its attacks for 14.7 damage a battle. Recorded and reported to the orchestrator; neither the kit nor the bands were adjusted.

**Kitted far cells** (500 each, `--player-kit expected`, report only) beside step 01's bare figures:

| Cell | Kit | Wins | Bare (step 01) | Hit rate (player / enemy) | Rounds | Damage dealt / taken a battle | Wall |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `bco9k` | tier 3 Fine, 2 runes of rank 2 | 499 | BCO9 2 | 0.820 / 0.604 | 8.89 | 313.6 / 111.7 | 13 s |
| `bco12k` | tier 3 Fine, 2 runes of rank 2 | 254 | BCO12 0 | 0.845 / 0.792 | 10.74 | 355.7 / 231.5 | 19 s |
| `fh15k` | tier 4 Fine, 3 runes of rank 2 | 477 | FH15 0 | 0.624 / 0.586 | 13.63 | 518.8 / 200.6 | 26 s |
| `fh18k` | tier 5 Masterwork, 4 runes of rank 3 | 500 | FH18 0 | 0.713 / 0.665 | 15.26 | 707.8 / 259.3 | 26 s |
| `sgk20` (today's Source) | tier 5 Masterwork, 4 runes of rank 3 | 500 | SG20 71 | 0.855 / 0.342 | 9.55 | 789.9 / 14.7 | 26 s |

Own kit unchanged: `bc3` 455, 0.536, 11.87 and `bco9` 2, 0.801, 5.64, both identical to step 01.

## Step 05 outcome

Step 05 (sprites, rings 9 and 12): engineer sonnet, reviewer opus, verdict clean, 2 review rounds. Commits `5bc31dc`, `3d0e480` (records `b46e518`, `5f0f703`); clean-tree checks `npm test` runlog #18 and `npm run sprites:check` runlog #20. No simulation run.

## Step 02 outcome

Step 02 (expected kit and the kitted yardstick): engineer opus, reviewer opus, verdict clean, 1 review round, no blocking finding. Commits `67a6f0d`, `4c5569a`; clean-tree gates at `67a6f0d`: `npm test` runlog #22, `npm run build` runlog #23; the reviewer's reruns #27 and #28 at `2cd7aca`. Two decisions are with the user: the rune-order reading (socket by socket) and the kitted resistance.

**Correction to "Step 02" above: where the kitted fighter's resistance comes from** (the reviewer's breakdown; the small slots carry no rune). Level 10 / level 20:

| Source | Level 10 | Level 20 |
| --- | --- | --- |
| Breastplate: base + grade + one Stone rune | 5 (3+1+1) | 9 (5+2+2) |
| Helm, gauntlets, greaves: base only | 6 | 9 |
| Shield | 0 | 1 |
| Innate (nodes) | 0 | 2 |
| Total | 11 | 21 |

The breastplate alone gives gear §5.8's "about 5" and "about 8"; the rest is the metal small slots the policy's `armourScore` picks, the shield and the fighter's own nodes.

**Also noted in review:** `expectedGear` reads `BASE_ITEMS`, not what a workshop can forge, so the mage wears hide small slots at tiers 3 to 5 and the archer at tier 4, where a campaign party forges none.

## Step 06 outcome

Step 06 (sprites, ring 15): engineer sonnet, reviewer opus, verdict clean, 1 review round. Commits `7ebb9c6`, `943e193`; clean-tree checks `npm test` runlog #30 and `npm run sprites:check` runlog #31 (both at `943e193`). No simulation run.


## Step 03: the golem's immunity

**The log schema's bump to 27 moves every events hash, and nothing else does.** Every `battle_start` writes `schemaVersion`. Approved by the orchestrator: `GUARD_EVENTS_SHA256` and the 18 `logs` digests of `src/game/forecast.test.ts` re-recorded in this step; `GUARD_RECORDS` and the policy snapshot untouched and green.

| Run | Result |
| --- | --- |
| `npm test`, schema 27, before the re-record (runlog #33) | 19 failed: `GUARD_EVENTS_SHA256` (`e4dd3391…fb6394` → `0b0f4c20e93ec2b2ebbb30710c4ce04989dd8e1168a75fff487b66d376e961af`) and the 18 forecast `logs` digests; `GUARD_RECORDS`, the forecast tallies and the policy snapshot pass |
| `npm test`, the same tree with `LOG_SCHEMA_VERSION` held at 26 (runlog #34) | the guard, the policy snapshot and all 18 digests pass against the old constants; only the 5 assertions that the version is 27 fail |
| 50-campaign check, schema held at 26 (`logs/s11-03-guard-50-schema26.jsonl`) | `57fdea1553a35b1af0e33b74a11ea9fe0a0e2f62ef9e5c80972af59276e53e75`, **identical** to step 01's |
| 50-campaign check, schema 27 (`logs/s11-03-guard-50.jsonl`) | `1e85d023a1b58697ec36724720f6ad5ba8b4a5dc2362f4ff6b22605ce37ed216`; 73,274 lines in both; the 945 `battle_start` lines differ in `"schemaVersion":27` only (`sed 's/"schemaVersion":27/"schemaVersion":26/'` of it hashes to `57fdea15…e53e75`); no `"immune"` in it; the summaries equal but for the `--out` name; 26 of 50, 325 days, 18.9 battles |

**The 50-campaign reference from here on is `1e85d023a1b58697ec36724720f6ad5ba8b4a5dc2362f4ff6b22605ce37ed216`** (schema 27; equal to `57fdea15…` at schema 26). Both runs took about 15 s each, run directly.

## Step 07 outcome

Step 07 (sprites, ring 18 and the Source): engineer sonnet, reviewer opus, verdict clean, 1 review round. Commits `95e5046`, `651a4c7` (review fixes); clean-tree checks `npm run sprites:check` runlog #49 and `npm test` runlog #50 (plain, 5 timeouts under load) then #51 (`--testTimeout=120000`, 2740 passed), all at `651a4c7`. No simulation run.

## Step 03 outcome

Step 03 (the golem's immunity): engineer opus, reviewer opus, verdict clean, 1 review round, no blocking finding. Commits `d94188b`, `85eaefd` (record); clean-tree gates at `d94188b`: `npm test` runlog #58, `npm run build` runlog #59; the reviewer's reruns #62 and #63 at `dd09f70`. The events-hash re-record (schema 27 only, above) was verified independently by the reviewer: the schema-27 50-campaign log equals the baseline byte for byte with the version put back to 26.

## Step 08: ring 7

2026-11-26 to 27. Code `b0fbe7d` (first values), `4ca43d2` (tuned: the final code). Cells: 500 battles from seed 1, `--encounter E --threat T --party-level T --player-kit expected`, run by `yomi-measure` one at a time, read against the working reading 300–475 (report only). Logs `logs/s11-08-*` (gitignored): `s11-08-<cell>` the first values, `s11-08-t1-…`, `-t2-…`, `-t3-…` the trials, measured on the dirty tree of each trial over `b0fbe7d`; `s11-08-final-…` the six again on the clean tree at `4ca43d2`.

**50-campaign check:** `1e85d023a1b58697ec36724720f6ad5ba8b4a5dc2362f4ff6b22605ce37ed216`, **identical** to the reference, at the first values and again at the tuned tree (`logs/s11-08-guard-50.jsonl`; 26 of 50, 325 days, 18.9 battles). The refactor guard is unedited and green.

**The kitted party the cells fight** (`expectedGear`, read from `deriveCombatStats`): at 6 and 7 the fighter has resistance 7, armour class 41, 65–71 hit points; the archer resistance 4, armour class 41; the mage resistance 2, armour class 20. At 9 and 10 the fighter and the archer both have resistance 11 (armour class 53 and 39), the mage 3 (armour class 22).

**The blocks** at their native levels against `foeYardstick(native, 'expected')` (no exception needed):

| Kind | Native | Armour class (band) | To hit (80–100) | Hit points (band) | Mean damage a turn (band) | Besides |
| --- | --- | --- | --- | --- | --- | --- |
| Wolf | 6 | 40 (31–51) | 85 | 55 (48.3–96.6) | 10: one bite 2d6+3 at 6 AP of 10 (6.5–10.8) | `armorPierce` 4, no resistance |
| Worg Rider | 7 | 44 (34–54) | 85 | 80, first 62 (50.1–100.2) | 11: `worg_strikes` Spear 1d8+2 and Bite 1d6+1, 6 AP of 8, no recharge (7.1–11.8); spear alone 1d8+2 at 5 AP | resistance 1, `armorPierce` 6, first 4 |
| Ogre | 7 | 34 (34–54) | 85 | 90 (50.1–100.2) | 11: club 2d8+2 at 6 AP of 8 (7.1–11.8) | resistance 2, `armorPierce` 5; `ogre_sweep` 2d8+2, 6 AP, recharge 1 |

**What each kind needed to tell through the kit's resistance** (the yardstick does not see it): each is one heavy blow a turn, not several light ones, and each pierces: the Wolf 4 (a bite of 10 does 7 to the fighter at 6 and 4 at 9), the Ogre 5 (its club and its Sweep, which goes *through* resistance as C4 has it, so less the piercing), the Worg Rider 6 after the first measurement (at 4, its two light strikes did about 1 each to resistance 11, and `wr9` was won 500 of 500 taking 53 damage a battle). No element was used. Even so the foes' damage at 9 and 10 falls mostly on the mage: the cells at the top of each band are held in the reading by numbers (five foes at `wp9` and `wr9`, four at `oc10`).

**Cells and trials** (wins of 500; player / enemy hit rate; rounds; damage dealt / taken a battle):

| Trial | Change | wp6 | wp9 | wr7 | wr9 | oc7 | oc10 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| First values (`b0fbe7d`) | C5's counts: wolf pack 3, 4, 4, 5; worg riders 3, 3, 4 (rider, wolf, rider, wolf); ogre camp 2, 3, 3, 4; rider 62 hit points, pierce 4 | **497** (0.52 / 0.51; 6.9; 184 / 44) | 358 (0.59 / 0.73; 12.9; 428 / 138) | **499** (0.51 / 0.52; 8.0; 208 / 45) | **500** (0.57 / 0.58; 10.4; 360 / 53) | **500** (0.56 / 0.44; 6.2; 165 / 25) | 385 (0.64 / 0.67; 14.2; 452 / 150) |
| 1 | wolf pack counts 4, 4, 4, 5; the Worg Rider's block (80 hit points, pierce 6), which the Ogre Camp's rider shares; ogre camp counts 3, 3, 3, 4 | 418 (0.55 / 0.58; 9.1; 232 / 90) | 358 (unchanged) | **476** (0.52 / 0.53; 9.9; 241 / 80) | **498** (0.59 / 0.58; 11.8; 407 / 77) | 405 (0.57 / 0.53; 11.3; 268 / 108) | 308 (0.65 / 0.68; 14.8; 457 / 169) |
| 2 | worg riders: a fifth slot (a third wolf), counts 4, 4, 5 | — | — | **184** (0.54 / 0.62; 11.3; 249 / 158) | 326 (0.60 / 0.70; 13.9; 456 / 148) | — | — |
| 3 | worg riders: counts 3, 3, 5; the wolves `fromThreat` 8 and a third rider (the Outrider) last, so 7 fields three riders and 9 the same five as trial 2 | — | — | 463 (0.52 / 0.52; 11.0; 252 / 86) | 326 (the log identical to trial 2's, sha256 `94137485…46a6`) | — | — |
| **Final (`4ca43d2`)** | | **418** | **358** | **463** | **326** | **405** | **308** |

All six end inside 300–475. Trials used: wolf pack 1, ogre camp 1, worg riders 3. Bold in a trial row marks a cell outside the reading. Notes for the reader of the table:

- Trial 1 changed one lever of each encounter's own (the pack's counts, the riders' kind, the camp's counts); the Ogre Camp also fields a Worg Rider, so `oc7` and `oc10` moved by its own counts and by the rider's block together and the two are not told apart (`oc10` has no count change, so its 385 → 308 is the rider's block alone).
- A fourth foe at threat 7 is a cliff for the riders (476 with three, 184 with four), as a fifth foe was at threat 5 in the home rings; trial 3 swaps the wolf of the three for a third rider instead.
- `oc10` at 308 and `wr9` at 326 sit near the bottom of the reading: a later step that strengthens the Wolf, the Worg Rider or the Ogre will push them out (ring 9 places an Ogre Camp at threat 9 and must not change `ogre_camp`'s data).
- Threat 8 of `worg_riders` (the Chief, a wolf and a rider: trial 1's `wr7` line-up) is in the band but no ring has threat 8, so no cell reads it.

**The policy snapshot:** re-recorded with ring 7's lines only. The test now asserts it: the first 14,242 lines hash to stage 10 step 02's `b9cef6e1…28ac` unchanged, every line after them begins `wolf_pack`, `worg_riders` or `ogre_camp`, 16,403 lines in all, `08248429…ebc1`.

**Characterization pins on the far world, re-pinned with the change proven confined** (the digested JSON dumped before and after and diffed): `blight.test.ts`'s two pinned 30-day runs (two spawns at threat 9 are a Bandit Troop where they were a Salamander Spring: with six eligible kinds where three were, the same draw picks another; the event counts, the world RNG, the spawn places and the blight's hash are unchanged) and `worldMap.test.ts`'s seeded session (the three renamed nests' id, name and encounter and ten far spawns' name and encounter; `SESSION_TURN` unchanged). Neither is the refactor guard, and neither runs `--near-source`.

**Follow-up outside this stage (found in step 08's browser runs):** `src/scenes/soundPlayer.ts`, `stopVoice` tweens a voice clip's volume while the clip's `complete` handler destroys it, so under load the tween sets `volume` on a destroyed sound (`Cannot set properties of null (setting 'volume')`) and a browser test's "no uncaught errors" check fails (runlog #74, `saves.test.ts`). There before this stage; not fixed here.

**Corrected for steps 10 to 13:** an area with `throughResistance` is cut by the target's resistance less the attacker's `armorPierce`, as a blow; without the flag resistance is ignored and only the element's ward cuts it. The plan had it backwards (index decision 11 and C4, `10-ring-12.md`, `02-expected-kit.md`, amended).

## Step 08 outcome

Step 08 (ring 7: wolves, worg riders, ogres): engineer opus, reviewer opus, verdict clean, 1 review round, no blocking finding. Commits `b0fbe7d`, `4ca43d2`, `79d678f` (record); clean-tree gates at `4ca43d2`: `npm test` runlog #69, `npm run build` #70, `npm run sprites:check` #71; the reviewer's `npm test` #77 at `79d678f`; browser: the reviewer's #78, 190 passed and 2 timeouts, both passing on the rerun #79. Cells wp6 418, wp9 358, wr7 463, wr9 326, oc7 405, oc10 308, all inside 300–475; 50-campaign hash identical; departures 1 to 6 of the execution record accepted.

## Step 09: ring 9

2026-11-27. The index trimmed first (`d901faf`, 31,534 → 28,361 bytes before this step's own lines). Cells: 500 battles from seed 1, `--encounter wyvern_roost --threat T --party-level T --player-kit expected`, run by `yomi-measure` one at a time on the dirty tree of each trial over `d901faf`, read against 300–475 (report only). Logs `logs/s11-09-<cell>` (first values), `logs/s11-09-t1-…`, `-t2-…`, `-t3-…` (gitignored).

**50-campaign check:** `1e85d023a1b58697ec36724720f6ad5ba8b4a5dc2362f4ff6b22605ce37ed216`, **identical**, at the first values, at trial 3's tree and at the final tree (`logs/s11-09-guard-50.jsonl`). The refactor guard is unedited and green.

**Yardstick at 9** (`foeYardstick(9, 'expected')`): armour class 40–60, to hit 80–100, hit points 53.7–107.4, damage a turn 8.3–13.8. Every block tried sits inside it, no exception.

**Cells and trials** (wins of 500; player / enemy hit rate; rounds; damage dealt / taken a battle). Bold is outside the reading.

| Trial | Change (one lever) | Block | Counts 9–12 | wy9 | wy12 |
| --- | --- | --- | --- | --- | --- |
| First values | C5's counts | 100 hit points, armour class 50, 90 to hit, pierce 7, 10 AP; Bite 2d8+2, Tail Sting 1d4 + Poisoned 3 turns (6 AP, no recharge; 13.5 a turn) | 2, 2, 3, 3 | **500** (0.635 / 0.358; 6.6; 216 / 41) | **175** (0.641 / 0.664; 12.9; 355 / 236) |
| 1 | counts: three at every threat | as above | 3, 3, 3, 3 | 459 (0.635 / 0.466; 10.2; 321 / 111) | **175** (the log identical, sha256 `c7e589ca…4ddc`) |
| 2 | the block reshaped to depend less on level (hits more often, through all the kit's resistance, fewer hit points) | 66 hit points, 100 to hit, pierce 11; dice as above | 3, 3, 3, 3 | 455 (0.652 / 0.574; 7.3; 217 / 120) | **159** (0.658 / 0.779; 8.8; 217 / 246) |
| 3 | the block weakened | 56 hit points, 100 to hit, pierce 11; Bite 2d6+2 (11.5 a turn) | 3, 3, 3, 3 | **498** (0.632 / 0.531; 6.0; 194 / 74) | 399 (0.626 / 0.739; 8.5; 238 / 177) |

| 4 (the user's, 2026-11-27) | counts: a fourth wyvern (the Old Wyvern) at 9 and 10 | as trial 3 | 4, 4, 3, 3 | 312 (0.670 / 0.665; 7.3; 227 / 160) | 399 (the log identical to trial 3's, sha256 `48dda298…2aa3`) |
| **Final (`cecd65f`)** | | 56 hit points, armour class 50, resistance 2, 100 to hit, pierce 11, 10 AP; Bite 2d6+2, Tail Sting 1d4 + Poisoned | 4, 4, 3, 3 | **312** | **399** |

Three trials used with `wy9` outside (498) at the third, so the step stopped for the orchestrator at `2b35cb9` (trial 3). **The user decided one more trial, four wyverns at 9 and 10 with trial 3's block; both cells landed inside (312, 399) and it is kept.** The Wyvern Roost is the one encounter whose numbers fall as the threat rises: threat 11 fields three where 10 fields four and is worth less experience (3 × 11 × 150 of `FOE_XP` against 4 × 10 × 150); `encounters.test.ts` names it as the exception to "never fewer than before" and "worth more the higher the threat". Trial 4's two cells were run twice at once by mistake (the measuring agent and the engineer, after a lost notification); both gave 312 and 399 and the `wy9` log's hash is the agent's (`ddfec562…4456`). For stage 12: four at 9 is near the reading's floor (312) and four was a cliff for the Worg Riders at 7.

**Why no one block fits both ends.** The expected kit is the same row at 9 and 12 (tier 3 Fine, two runes of rank 2; fighter and archer resistance 11, the fighter's armour class 53), while a foe gains 15 to hit, a third more hit points and a point of damage over the three levels. So the same three wyverns are far harder at 12 than at 9: 459 against 175, 455 against 159, 498 against 399. Between trials 2 and 3 (one block lever) `wy12` reaches 300 only where `wy9` is already about 480. Two wyverns are no battle at 9 (500, 41 damage taken: the fighter's Taunt holds both, at 37% to hit and 11 resistance) and three at 12 are a cliff, as a fourth foe was for the Worg Riders at 7. The step 02 bandit cells show the same slope (`bco9k` 499, `bco12k` 254).

**What the wyvern needed against the kit** (first values on): one heavy bite and piercing, as ring 7's kinds, and its poison, which no armour cuts (at `wy9`, trial 1: bite 67.5, sting 11.3, poison ticks 32.3 damage a battle). At 9 the wyverns' attacks go to the taunting fighter (83% of them). Pierce 7 first, 11 from trial 2.

**The policy snapshot:** re-recorded with the Wyvern Roost's lines only, at trial 3's tree and again at the final one. The test asserts the first 14,242 lines against stage 10's `b9cef6e1…28ac`, the first 16,403 against step 08's `08248429…ebc1`, every line after them beginning `wyvern_roost`; 17,051 lines, `8e432c09…4c60` (17,092 and `e72a3c03…ee28` at trial 3).

**Far-world pins re-pinned, the change proven confined** (digested JSON dumped before and after, diffed value by value): `blight.test.ts`'s two 30-day runs differ in two spawned events' names each (a Bandit Troop at 12 is a Wyvern Roost, a Bandit Troop at 9 a Wolf Pack: seven eligible kinds at 9 where six were, two at 12 where one was; counts, places, RNG and the blight's hash unchanged); `worldMap.test.ts`'s session differs in 30 values: the three renamed nests' id, name and encounter (9), seven far spawns' name and encounter (14) and their spawned events' names (7); `SESSION_TURN` unchanged.

**For stage 12, beside the step-down:** on the map only threats 9 and 12 occur among the roost's (`THREAT_RINGS`), so the step from 10 to 11 is reached only through the debug `fight` command, the simulator's `--threat`, tests and the policy snapshot. A ring-12 roost (three wyverns) pays the same experience as a ring-9 one (four), 5,400 each, and fewer hides (9 against 12), for a harder fight (399 wins against 312).

## Step 09 outcome

Step 09 (ring 9: wyverns): engineer opus, reviewer opus, verdict clean, 1 review round, no blocking finding. Commits `d901faf` (index trim), `2b35cb9`, `cecd65f` (final code), `818b7d0` (record); clean-tree gates at `cecd65f`: `npm test` runlog #84, `npm run build` #85, `npm run sprites:check` #86; the reviewer's `npm test` #89 at `818b7d0`; browser: the engineer's #87 (187 passed, 5 failed: timeouts and the known narration-fade error) and #88 (the five files, 103 passed), the reviewer's #90, 184 passed and 8 timeouts, all passing on the rerun #91. Cells wy9 312, wy12 399, both inside 300–475 (the reviewer's re-run at `818b7d0` byte-identical); 50-campaign hash identical; the roost's falling counts (4, 4, 3, 3) are the user's decision.
