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

