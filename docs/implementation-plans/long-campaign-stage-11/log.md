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
