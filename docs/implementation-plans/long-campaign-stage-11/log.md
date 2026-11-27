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

## Step 10: ring 12

2026-11-27. Code `5257f59` (first values), `65ac1c0` (tuned: the final code), `9f692dc` (reference docs). Cells: 500 battles from seed 1, `node scripts/simulate.ts --encounter E --threat T --party-level T --player-kit expected --battles 500 --seed 1 --out logs/s11-10-<label>.jsonl`, run by the engineer in the foreground one at a time (about 20 seconds each), read against 300–475 (report only). Logs (gitignored): `logs/s11-10-<cell>` the first values at `5257f59`, `-t1-`, `-t2-`, `-t3-` the trials on the dirty tree of each, `-final-` on the clean tree at `65ac1c0`.

**50-campaign check:** `1e85d023a1b58697ec36724720f6ad5ba8b4a5dc2362f4ff6b22605ce37ed216`, **identical**, at the first values and at the tuned tree (`logs/s11-10-guard-50.jsonl`). The refactor guard is unedited and green.

**Yardstick** (`foeYardstick(n, 'expected')`): at 11 armour class 44.4–64.4, to hit 80–100, hit points 57.3–114.6, damage a turn 9.5–15.8; at 12, 45.8–65.8, 80–100, 59.1–118.2, 10.1–16.8. Every block tried sits inside, no exception (the blocks: the execution record).

**Cells and trials** (wins of 500; player / enemy hit rate; rounds; damage dealt / taken a battle). Bold is outside the reading. The kit is tier 3 Fine with 2 runes of rank 2 at 11 and 12, tier 4 Fine with 3 at 14 and 15.

| Trial | Change | bw11 | bw14 | bl11 | bl14 | hg12 | hg15 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| First values (`5257f59`) | wights 3, 3, 4, 4 (70 hit points); lair 3, 3, 3, 4 (basilisk, ogre, basilisk, ogre); steading 3, 3, 4, 4 (giant, ogre, ogre, giant; the giant 115 hit points, Club 3d8+2, Rock 2d10+2) | **500** (0.60 / 0.46; 6.8; 241 / 49) | **297** (0.61 / 0.70; 11.1; 353 / 223) | 425 (0.67 / 0.56; 12.0; 376 / 135) | **0** (0.64 / 0.79; 10.8; 336 / 290) | **476** (0.69 / 0.61; 12.8; 452 / 133) | **19** (0.56 / 0.75; 13.3; 491 / 303) |
| 1 | counts: wights 4, 4, 4, 4; lair 3, 3, 3, 3; steading 3, 3, 3, 3 | **482** (0.63 / 0.59; 8.7; 315 / 104) | **297** (unchanged) | 425 (unchanged) | 304 (0.63 / 0.65; 14.5; 444 / 210) | **476** (unchanged) | **200** (0.56 / 0.72; 16.0; 494 / 255) |
| 2 | wights: the block, 66 hit points. Steading: slot order, the Giant Chief second (two giants and an ogre) | **485** (0.62 / 0.58; 8.2; 300 / 96) | 327 (0.60 / 0.69; 10.8; 344 / 209) | — | — | 455 (0.75 / 0.57; 11.0; 407 / 129) | **240** (0.60 / 0.68; 13.9; 455 / 246) |
| 3 | steading: the Hill Giant's block (100 hit points, Club 3d6+3, Rock 2d8+2) | — | — | — | — | **495** (0.73 / 0.54; 9.7; 383 / 86) | 400 (0.59 / 0.65; 13.5; 463 / 176) |
| **Final (`65ac1c0`)** | | **485** | 327 | 425 | 304 | **495** | 400 |

The final logs are byte-identical to their trials' for the wights and the lair; the steading's differ only in the ogre's name (the unused slots were dropped and the one ogre is the Ogre Thrall), with the same figures.

**Read against the standing rule.** All three top ends are inside (327, 304, 400), and the lair's bottom (425). Two bottoms run easy and are recorded for stage 12: **`bw11` 485** (trials used 2 of 3: the one lever left that hardens 11 without 14 is a fifth wight at 11 and 12, falling to four, as the roost; not taken, the bottom being 10 over) and **`hg12` 495** (trials 3 of 3: trial 3 overshot, `hg15` 400 where about 320 would have left `hg12` nearer 475; a block between trials 2 and 3, or a fourth foe at 12 and 13, is the option).

**What the party meets on the map** (`THREAT_RINGS`: only 12 and 15 of these bands): the barrow and the lair at 12 only (a nest each and spawns), the steading at 12 (a nest and spawns) and at 15 (spawns). Measured beside the cells on the final code: `bw12` **477** (0.65 / 0.65; 8.9; 325 / 121), `bl12` 445 (0.70 / 0.59; 13.0; 414 / 134), `hg12` **495**, `hg15` 400. So in play ring 12's three new nests are on the easy side of the reading (the Wyvern Roost at 12 is 399 and a Bandit Company in the kit 254), and threats 11, 13 and 14 are reached only through the debug `fight` command, the simulator, tests and the snapshot.

**Why the bands slope.** The kit steps up at 13, but not by as much as three levels of foe: at the top each line-up's enemy hit rate is 0.65 to 0.70 against 0.54 to 0.59 at the bottom. A fourth foe at the top is a cliff (the lair 0, the steading 19). And an Ogre raised from native 7 to 15 (195 hit points, 125 to hit) is tougher than a Hill Giant written at 12 inside the yardstick (115 hit points at first, 110 to hit at 15): two giants and an ogre were easier at 15 than a giant and two ogres (240 against 200). For stage 12: the Hill Giant is worth 200 XP a level and is now the weaker of the steading's two kinds.

**What each kind needed against the kit:** piercing (wight 8, basilisk 9, giant 9), and for the wight a spell no armour turns. The Rock keeps `throughResistance` and is cut by resistance less the giant's 9.

**The policy snapshot:** re-recorded with ring 12's lines only, at the first values and at the final code. The test asserts the first 14,242 lines against `b9cef6e1…28ac`, the first 16,403 against `08248429…ebc1`, the first 17,051 against step 09's `8e432c09…4c60`, every line after them beginning `barrow_wights`, `basilisk_lair` or `hill_giant_steading`; 19,649 lines, `96ec580b…9136` (19,591 and `2c883f09…0214` at the first values).

**Far-world pins re-pinned, the change proven confined** (the digested JSON dumped before and after, diffed): `blight.test.ts`'s two 30-day runs differ in one spawned event's name each (a Wyvern Roost at 12 is a Giant Steading: five eligible kinds at 12 where two were; counts, places, RNG and the blight's hash unchanged); `worldMap.test.ts`'s session differs in 18 values: the three renamed nests' id, name and encounter (9), three far spawns' name and encounter (6) and their spawned events' names (3); `SESSION_TURN` unchanged.

**Follow-ups outside this stage (found in step 10's browser runs):** `e2e/battle.test.ts` A9 ("labels Auto with its estimate, keeps it while a hero is selected, and works it out again after each action", line 672: the forecast expected null while a move plays) is order-dependent: it fails in the full file and passes alone, at this step's head and at its parent `397f8f8` alike (runlog #105, #125, #127). And the e2e runs have no protection against a sleeping machine: with the lid closed on battery the laptop sleeps, Playwright's calls run past the 60 s test timeout, and a run hangs for as long as the sleep lasts (#97, 1h46m; `caffeinate -i` does not hold off a clamshell sleep).

## Step 10 outcome

Step 10 (ring 12: barrow wights, basilisks, hill giants): engineer opus, reviewer opus, verdict clean, 1 review round, no blocking finding. Commits `5257f59` (first values), `65ac1c0` (final code), `9f692dc` (reference docs), `7640200` and `6ca94b5` (records); clean-tree gates at `9f692dc`: `npm test` runlog #94, `npm run build` #95, `npm run sprites:check` #96; the reviewer's `npm test` #128 at `6ca94b5`, 2908 passed; browser, by file at `6ca94b5` (the reviewer's): #104, #106, #107, #110, #116 to #122 and #126 pass, `battle` #105 and #125 31 passed and 1 failed (A9, pre-existing and order-dependent: it fails the same at `397f8f8`, #127); the engineer's browser runs were void or partial (the machine slept). Cells bw11 485, bw14 327, bl11 425, bl14 304, hg12 495, hg15 400 (the reviewer's re-run of hg15 byte-identical): the three top ends inside 300–475, bw11 and hg12 above it under the user's standing rule, recorded for stage 12; 50-campaign hash identical; the line-ups (four wights; a lair and a steading of three) and the other departures of the execution record accepted.

## Step 11: ring 15

2026-11-27. Code `5c83ec8` (first values), `1b78a7e` (tuned: the final code), `eab9959` (docs). Cells: 500 battles from seed 1, `node scripts/simulate.ts --battles 500 --seed 1 --encounter E --threat T --party-level T --player-kit expected --out logs/s11-11-<label>.jsonl`, run by the engineer in the foreground one at a time, read against 300–475 (report only). Logs (gitignored): `logs/s11-11-<cell>` the first values at `5c83ec8`, `-t1-`, `-t2-`, `-t3-` the trials on the dirty tree of each, `-final-` on `1b78a7e`.

**50-campaign check:** `1e85d023a1b58697ec36724720f6ad5ba8b4a5dc2362f4ff6b22605ce37ed216`, **identical**, at the first values and at the tuned tree (`logs/s11-11-guard-50.jsonl`). The refactor guard is unedited and green.

**Yardstick** (`foeYardstick(n, 'expected')`): at 14 armour class 48.6–68.6, to hit 80–100, hit points 62.7–125.4, damage a turn 11.3–18.8; at 15, 50–70, 80–100, 64.5–129, 11.9–19.8. Every block tried sits inside, no exception (the blocks: the execution record).

**Cells and trials** (wins of 500; player / enemy hit rate; rounds; damage dealt / taken a battle). Bold is outside the reading. The kit is tier 4 Fine with 3 runes of rank 2 at 14 to 16, tier 5 Masterwork with 4 of rank 3 at 17 and 18.

| Trial | Change | go14 | go17 | cu14 | cu18 | yd15 | yd18 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| First values (`5c83ec8`) | ruin 3, 3, 3, 3 (golem, wight, golem); cult 4 at every threat (the cultist 66 hit points, 85 to hit, a Ritual Knife 1d6+3 piercing 4); lair 3 at every threat (the dragon 95 to hit, 8 AP) | **500** (0.68 / 0.45; 9.3; 353 / 77) | **500** (0.63 / 0.46; 10.2; 433 / 47) | **499** (0.60 / 0.54; 9.2; 366 / 91) | **499** (0.48 / 0.62; 13.1; 486 / 125) | **64** (0.62 / 0.75; 9.5; 234 / 303) | 427 (0.49 / 0.74; 14.4; 405 / 208) |
| 1 | counts: ruin 4, 4, 4, 4; cult 5 at every threat; lair 2, 2, 3, 3 | 468 (0.65 / 0.55; 13.6; 445 / 176) | **500** (0.62 / 0.56; 13.3; 555 / 118) | **499** (0.61 / 0.58; 12.3; 456 / 130) | **500** (0.50 / 0.67; 15.5; 611 / 154) | **498** (0.57 / 0.55; 10.0; 238 / 138) | 427 (unchanged, not run) |
| 2 | ruin: a fifth slot, the Stone Sentinel, at 17 (4, 4, 4, 5). Cult: the cultist's block (95 to hit, a Blight Dart 1d8+4 thrown 4 hexes, piercing 10). Lair: the dragon's block (100 to hit, 10 AP) | 468 (unchanged) | 438 (0.62 / 0.66; 15.4; 691 / 177) | 415 (0.56 / 0.53; 14.6; 438 / 238) | **483** (0.47 / 0.61; 18.7; 610 / 252) | **491** (0.57 / 0.54; 10.1; 238 / 153) | 396 (0.49 / 0.72; 14.7; 401 / 233) |
| 3 | cult: the cultist's block (76 hit points, 100 to hit). Lair: the dragon's block (129 hit points, armour class 66), **not kept** | — | — | 345 (0.58 / 0.56; 15.1; 449 / 265) | 471 (0.47 / 0.63; 20.2; 650 / 270) | **477** (0.56 / 0.53; 10.9; 241 / 194) | **290** (0.47 / 0.73; 14.8; 378 / 291) |
| **Final (`1b78a7e`)** | the ruin's and the lair's trial 2, the cult's trial 3 | 468 | 438 | 345 | 471 | **491** | 396 |

The final logs are byte-identical to their trials' (`cmp`): `go14` trial 1's, `go17`, `yd15`, `yd18` trial 2's, `cu14`, `cu18` trial 3's.

**Read against the standing rule.** Five of six are inside. **`yd15` 491** is above (trials 3 of 3): a dragon and one wyvern are an easy battle at 15 and a dragon and two are 64 wins, a cliff; a dragon strong enough to bring 15 inside (trial 3, 477) takes 18 under (290). The top end is inside, so trial 2's block is kept and the bottom runs easy. For stage 12: a block between trials 2 and 3, or a weaker third foe at 15 and 16 than a wyvern.

**What the party meets on the map** (`THREAT_RINGS`: 15 and 18 of these bands), measured beside the cells on the final code: `go15` 366 (0.60 / 0.63; 15.0; 452 / 264), **`cu15` 99** (0.53 / 0.63; 14.1; 367 / 337), `yd15` **491**, `cu18` 471, `yd18` 396. **The cult at 15 is far below the reading though both its cells are inside**: one level turns 345 into 99 with the kit unchanged (the reviewer's measure: every foe gains 5 armour class, to hit and spell skill, 3 mana and about 6% hit points from 14 to 15, the kit nothing; the two mana thresholds, the wights' third Drain Life and the cultists' extra Lightning Bolt, are 45 of the 246 lost wins, counterfactuals at 15 wight mana 113, cultist mana 123, both 144; the rest is the level's plain step in a five-foe fight). Its fixed nest, the Wolfhead Cult, is at 15. Settled by trial 4 below, the user's decision: four of the cult at 15 and 16, `cu15` 429.

**Why the bands slope the other way here.** The kit's row changes at 17, and by more than the foes grow over three levels: the same line-up is easier at 17 and 18 than at 14 and 15 (the ruin of four 468 at 14 and 500 at 17; the lair of three 64 at 15 and 427 at 18), where ring 12's bands, crossing the smaller step at 13, were harder at their tops.

**What each kind needed against the kit:** piercing for the golem (9) and the dragon (10); nothing for the breath, which has no `throughResistance` and so ignores resistance (a fire ward alone cuts it); and for the cultist a weapon, since `aggressive` throws the Bolt only down a line of two heroes (about one a battle) and otherwise heals and curses: a dart thrown 4 hexes, piercing 10.

**The policy snapshot:** re-recorded with ring 15's lines only, at the first values and at the final code. The test asserts the first 14,242 lines against `b9cef6e1…28ac`, the first 16,403 against `08248429…ebc1`, the first 17,051 against `8e432c09…4c60`, the first 19,649 against step 10's `96ec580b…9136`, every line after them beginning `golem_ruin`, `blight_cult` or `young_dragon`; 22,385 lines, `2177afc9…4dc5` (22,633 and `7aaae1d4…5acc` at the first values).

**Far-world pins.** `blight.test.ts`'s two 30-day runs did not move (no re-pin: the draws at 15 and 18 pick the same kinds among five and three as among two and one). `worldMap.test.ts`'s session re-pinned (`6d089a8e…a665`), the change proven confined (the digested JSON dumped before and after, diffed): 18 values, the three renamed nests' id, name and encounter (9), three far spawns' name and encounter (6: Freebooter Bands now two Dragon Lairs and a Golem Ruin) and their spawned events' names (3); `SESSION_TURN` unchanged.


**Trial 4, the cult at 15 and 16** (the user's decision; `3f4f90c`): `BLIGHT_CULT.counts` 5, 4, 4, 5, 5, the Cult Elder (the fifth slot) sitting out at 15 and 16. Cells on `3f4f90c`: `cu15` **429** (0.59 / 0.62; 11.7; 400 / 188), `cu14` 345 and `cu18` 471 (logs byte-identical to the final cells'). Kept. XP at 15: 6,300 (five were 7,800). Snapshot 22,394 lines, `aed88277…f007c`; the first 20,573 (through the Golem Ruin) and the last 736 (the Dragon Lair) as before. 50-campaign hash identical.

**Ring 15 in play** (the threats the map has; the final figures): `go15` 366, `cu15` 429, `yd15` **491**, `cu18` 471, `yd18` 396. `yd15` 491 is an in-play miss (the lair at 15 is a dragon and one wyvern), recorded for stage 12 with no more trials, by the user's decision. Not fixed, for stage 12 (the reviewer's notes): the expected-kit mage never casts Meteor at 15 or 18 (the simulator's policy); Pin nearly vanishes at 15 (1.98 a battle at 14, 0.05 at 15), untraced.

## Step 11 outcome

Step 11 (ring 15: golems, cultists, young dragons): engineer opus, reviewer opus, verdict clean, 1 review round, no finding. Commits `5c83ec8` (first values), `1b78a7e` (tuned), `eab9959` (docs), `37639ee` (record), `3f4f90c` (trial 4: the cult four at 15 and 16, kept), `4ccac5e` (its docs and the new standing rule). Gates at `4ccac5e`: `npm test` #152 (2963 passed), `npm run build` #153, browser `debug` #154 (5 passed), `world` #155 (66 passed); earlier at `eab9959` #132 to #148 (the execution record); the reviewer's #149 (battle, 31 passed and only the known A9) and #150 (`npm test`, 2963). Cells go14 468, go17 438, cu14 345, cu18 471, yd15 491, yd18 396; in play go15 366, cu15 429, yd15 491 (for stage 12), cu18 471, yd18 396; 50-campaign hash identical, the refactor guard unedited and green.

## Step 12: ring 18

2026-11-27. Code `adb0921` (first values), `921b3f7` (tuned: the final code). Cells: 500 battles from seed 1, `node scripts/simulate.ts --battles 500 --seed 1 --encounter E --threat T --party-level T --player-kit expected --out logs/s11-12-<label>.jsonl`, run by the engineer in the foreground one at a time (40 to 130 seconds each; up to 325 s while the machine slept), read against 300–475 (report only). Logs (gitignored): `logs/s11-12-<cell>` the first values at `adb0921`, `-t1-`, `-t2-`, `-t3-` the trials on the dirty tree of each, `-final-` on `921b3f7`.

**50-campaign check:** `1e85d023a1b58697ec36724720f6ad5ba8b4a5dc2362f4ff6b22605ce37ed216`, **identical**, at the first values (`logs/s11-12-guard-50.jsonl`) and at the tuned tree (`logs/s11-12-t3-guard-50.jsonl`). The refactor guard is unedited and green.

**Yardstick** (`foeYardstick(n, 'expected')`): at 17 armour class 54–74, to hit 80–100, hit points 72.9–145.8, damage a turn 13.1–21.8; at 18, 56–76, 80–100, 77.1–154.2, 13.7–22.8. The lich sits inside. The wyrm has two named exceptions at the final code: to hit 115, hit points 185.

**Cells and trials** (wins of 500; player / enemy hit rate; rounds; damage dealt / taken a battle). Bold is outside the reading. `lc18` is the in-play cell (the Ashen Court is at 18); `ew18` too (the Last Wyrm).

| Trial | Change | lc17 | lc18 (in play) | lc20 | ew18 (in play) | ew20 |
| --- | --- | --- | --- | --- | --- | --- |
| First values (`adb0921`) | court 3, 4, 4, 5; lair 2, 2, 3; the wyrm 150 hit points, armour class 66, 100 to hit, piercing 16 | **500** (0.54 / 0.43; 8.4; 376 / 74) | **499** (0.50 / 0.60; 14.3; 525 / 157) | **287** (0.41 / 0.73; 25.2; 637 / 421) | **499** (0.62 / 0.34; 10.0; 326 / 131) | **6** (0.58 / 0.66; 9.0; 271 / 406) |
| 1 | court: counts 4, 5, 5, 5. Lair: the wyrm's block (154 hit points, armour class 76, 115 to hit) and counts 2, 2, 2 (two levers: three at 20 were 6 wins with the weaker wyrm) | **499** (0.55 / 0.54; 11.9; 489 / 118) | 464 (0.48 / 0.62; 20.3; 660 / 277) | 287 (unchanged, not run) | **494** (0.59 / 0.41; 11.3; 336 / 189) | **477** (0.52 / 0.52; 14.8; 371 / 324) |
| 2 | court: counts 5, 5, 5, 4 (the Lich's Herald out at 20). Lair: the wyrm's piercing 21 | **497** (0.53 / 0.58; 16.9; 625 / 230) | 464 (unchanged) | 332 (0.41 / 0.75; 20.0; 533 / 307) | **485** (0.58 / 0.42; 11.4; 336 / 250) | 430 (0.52 / 0.54; 14.6; 362 / 425) |
| 3 | lair: the wyrm's 185 hit points | — | — | — | **482** (0.57 / 0.42; 12.3; 365 / 270) | 408 (0.52 / 0.54; 15.7; 390 / 469) |
| **Final (`921b3f7`)** | the court's trial 2, the lair's trial 3 | **497** | 464 | 332 | **482** | 408 |

The final logs are byte-identical to their trials' (`cmp`): `lc18` trial 1's, `lc17`, `lc20` trial 2's, `ew18`, `ew20` trial 3's.

**The user's decision (2026-11-27): `ew18` 482 accepted as it stands (trial 3)**, an in-play miss recorded for stage 12 beside `yd15` 491; no further trials.

**Read against the standing rule.** The court is inside at 18, where the map has it, and at 20; `lc17` 497 is a band-end miss (the bottom runs easy: the five slots are all fielded, so only the lich's block could move it, and that would move 18 and 20 too). **`ew18` 482 is an in-play miss after three trials: brought to the orchestrator.** The lair at two foes slopes gently (482 at 18, 408 at 20); a third foe is a cliff (6 wins at 20 with the first wyrm).

**What each kind needed against the kit** (fighter and archer resistance 21 from 17): the lich pierces 14 (its touch is a sideline: the policy has it cast Lightning Bolt about 3 times a battle and Dark Shield 2, Drain Life almost never and Death Cloud never at the first values); the wyrm pierces all 21 (at 16 its three strikes lost 5 each on the fighters). The breath carries no flag (only the heroes' fire wards cut it). The wyrm at 100 to hit and armour class 66 was weaker than the young dragon raised to 18 beside it (115, 73, 150 hit points).

**For stage 12:** `ew18` 482 (the Last Wyrm at 18, two foes; a third is a cliff); `lc17` 497 (a band end). The AI has the lich cast Lightning Bolt about 3 times a battle and Dark Shield 2, Drain Life almost never and Death Cloud never (`aggressive` in `lc18`'s first-value log: 1,496 bolts, 958 shields, 2 drains, no cloud in 500 battles), so its caster kit is mostly unused.

**The policy snapshot:** re-recorded with ring 18's lines only. The test keeps step 11's prefix checks and adds a fifth: the first 22,394 lines against `aed88277…f007c` (step 11's whole snapshot after trial 4), every line after them beginning `blight_lich_court` or `elder_wyrm`; 24,048 lines, `b41a6374…ee3c` (24,092 and `e078b975…c094` at the first values).

**Far-world pins.** `blight.test.ts`'s two runs did not move. `worldMap.test.ts`'s session re-pinned (`11812dc7…ced9`), proven confined (the digested JSON dumped at `6ee7d63` and at the first values, diffed): 18 values, the three renamed nests' id, name and encounter (9), three far spawns' name and encounter (6: two Dragon Lairs now Lich Courts, a Freebooter Band now a Blight Cult) and their spawned events' names (3); `SESSION_TURN` unchanged.

## Step 12 outcome

Step 12 (ring 18: the Blight Lich and the Elder Wyrm): engineer opus, reviewer opus, verdict clean, 1 review round, no finding. Commits `adb0921` (first values), `921b3f7` (tuned), `14fc294` (docs), `2ef2fb6` (gates record), `ad45e84` (`bands.md` under its limit), `8916789` (the user's decision), `6061296` (gates; awaiting review). Gates at `8916789`: `npm test` #165 (3006 passed), `npm run build` #179, `npm run sprites:check` #180, browser #166 to #178 (all passed but the known A9 in `battle`, #167); the reviewer's #181 (`npm test`, 3006) and `lc18` re-run at head (464, byte-identical). Cells lc17 497 (band end), lc18 464 (in play), lc20 332, ew18 482 (in play, accepted by the user for stage 12), ew20 408; 50-campaign hash identical, the refactor guard unedited and green. Not fixed, for stage 12: the Brood Drake slot defined but never fielded (a held lever); the lich's Death Cloud never cast and Drain Life almost never.

## Step 13: the Source at 20

2026-11-27. Code `0709692` (first values), `8c30db6` (trial 1: the final code). Cells: 500 battles from seed 1, `node scripts/simulate.ts --battles 500 --seed 1 --encounter source_guardians --threat 20 --party-level L [--player-kit expected] --out logs/s11-13-<label>.jsonl`, run by the engineer in the foreground one at a time (about 27 s each). Logs (gitignored): `logs/s11-13-sgk20` the first values, `-t1-` trial 1 on its dirty tree, `-final-` on `8c30db6`.

**50-campaign check:** `1e85d023a1b58697ec36724720f6ad5ba8b4a5dc2362f4ff6b22605ce37ed216`, **identical**, at the first values (`logs/s11-13-guard-50.jsonl`) and at `8c30db6` (`logs/s11-13-final-guard-50.jsonl`). The refactor guard is unedited and green. The near-home Source's setups (threats 0 to 5 and 3.7, parties of three and four) hash as at `2ca3559` (`baf63044…008a`, a new test in `encounters.test.ts`).

**Yardstick** (`foeYardstick(20, 'expected')`): armour class 60–80, to hit 80–100, hit points 85.5–171, damage a turn 14.9–24.8. The Horror at the final code: armour class 80, hit points 171, damage a turn 19 (Claws 1d10+4 at 4 AP; the routine 2 × 2d8 = 18), **to hit 125 (a named exception)**.

**Cells** (wins of 500; player / enemy hit rate; rounds; damage dealt / taken a battle). The Source is in play at 20 (`SOURCE_THREAT`).

| Trial | Change | sgk20 | sg20-18 (own kit) | sg20 (own kit) |
| --- | --- | --- | --- | --- |
| Step 02 (the old Source at 20: five foes held at level 6) | — | **500** | 28 (stage 10) | 71 (stage 10) |
| First values (`0709692`) | the Horror 171 hit points, armour class 80, 100 to hit, piercing 21, 10 AP; breath 8d6 radius 2, Corroded 3 turns; claws 2 × 2d8; two cultists at 20 | **495** (0.51 / 0.52; 14.4; 491 / 317) | — | — |
| 1 (`8c30db6`, final) | the Horror's to hit 125 (as the Elder Wyrm and Young Dragon raised to 20) | 445 (0.51 / 0.63; 14.9; 474 / 382) | 0 (0.47 / 0.93; 6.8; 56 / 431) | 0 (0.48 / 0.94; 7.3; 62 / 469) |

`sgk20` at `8c30db6` is byte-identical to trial 1's log (`cmp`). Trials used: 1 of 3. **Inside 300–475.**

**What the Horror needed against the kit** (fighter and archer resistance 21, armour class about 73): its claws pierce all 21; the breath ignores resistance (only a blight ward cuts it). What told was the chance to hit: at 100 it struck armour class 73 about one time in four, breath and claws alike (enemy hit rate 0.52 with the cultists' 130); at 125, 0.63 and 50 more losses. In 500 battles it breathed 1,505 times (3 a battle) and clawed 8,015.

**`sg20-18` and `sg20`** (report only, the ready-made party's own gear at 18 and 20) now fight `SOURCE_AT_20` and win none (stage 10: 28 and 71 against five foes held at level 6): the cultists at 20 hit them 93% of the time. For stage 12 and step 14's long campaign: a party reaching the Source without the expected kit loses there.

**The policy snapshot:** re-recorded with the `source_guardians` lines above threat 5 only. Step 12's 24,048 lines (`b41a6374…ee3c`) less their 4,301 far-Source lines are 19,747 lines (`a30c30ea…abed`), and the lines now less theirs are the same 19,747 in the same order (asserted). The first 4,218 lines (to `source_guardians 5`) hash `f1de7975…e871` as before; the Source at 20's 2,216 lines follow (`b66cf7d2…0f95`; 2,317 and `98b4cab4…c29a` at the first values); the 15,529 after them hash `8ad17fbb…3d1f` as before. 21,963 lines, `631a06bf…f88c`. The earlier rings' boundaries are kept as kind checks, 2,085 lines earlier.

**The estimate fixture** (`forecast.test.ts`): its three `source_guardians` entries (threats 10 and 20) re-recorded, nothing else: their `logs` digests, and the level-18 tier-5 tally 4 wins of 4 before, 0 now.

**Gates at `ca9685c`** (clean tree, the code `8c30db6`'s): `npm test` #185 (3025 passed), `npm run build` #186, `npm run sprites:check` #187; browser #188 to #200, all passed but the known A9 in `battle` (#189, line 672).

## Step 13 outcome

Step 13 (the Source at 20: the Blight Horror of native 20 and two cultists): engineer opus, reviewer opus, verdict clean, 1 review round, no blocking finding; one comment fixed after it (`sourceGuardians`: the shaman from threat 2). Commits `0709692` (first values), `8c30db6` (trial 1, the final code), `ca9685c` (docs, log, record), `4eeb66e` (gates; awaiting review), `a0b056e` (the comment), and this record. Gates at `ca9685c`: `npm test` #185 (3025 passed), `npm run build` #186, `npm run sprites:check` #187, browser #188 to #200 (all passed but the known A9 in `battle`, #189); the reviewer's #201 (`npm test`, 3025) and `sgk20` re-run at head (445, byte-identical); #202 after the comment (3025). Cells `sgk20` 445 (in play; first values 495, one trial), `sg20-18` 0, `sg20` 0; 50-campaign hash identical, the refactor guard unedited and green. For step 14 and stage 12: the ready-made party in its own gear now wins 0 of 500 at the Source (`sg20-18`, `sg20`; 28 and 71 before); every threat from 6 to 19 builds the Source at threat 20, so debug `fight` or simulator runs at those threats get threat-20 rewards (on the map the Source is only ever at 20).

## Step 14: measure and record

2026-11-27, code `2c1ec54` (clean tree; no `src`/`scripts` change in this step). Seed 1, label `s11-14`, logs `logs/s11-14-*` (gitignored), wall times in `logs/s11-14-times.txt`. Run by the engineer in the foreground, one at a time, under `caffeinate -i`; no sleep in `pmset` across any run. Beside the runs: the podman VM (about 55% CPU), WindowServer and a Codex app; load 2 to 4.6; no other simulation, build or test.

**50-campaign check:** `1e85d023a1b58697ec36724720f6ad5ba8b4a5dc2362f4ff6b22605ce37ed216`, **identical** (step 01's `57fdea15…` at schema 26); 26 of 50, 325 days, 18.9 battles (14 s).

### Early figures (`--near-source`, 500)

| Measure | Source wins | Days | Battles | Heroes dead | Other | Step 01 | Band | Wall | Log |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| one | **287** | 331 | 18.8 (9,417 in all) | 1.2 | 33.3 spawns | 288 (9,416) | 215–250; 288 accepted | 141 s | `s11-14-one.txt`, `-one-out.txt/.jsonl` |
| company | **288** | 334 | 18.9 | 1.2 | 0.0 guard battles, 0.0 promotions | 289 (9,460) | 220–260; 289 accepted | 152 s | `s11-14-company.txt` |
| rl10 | **371** | 541 | 35.0 (17,494) | 1.6 | 3.2 guard battles, 64.1 spawns | 409, 533 days, 34.0, 1.3 dead (16,998) | 370–420 | 361 s | `s11-14-rl10.txt/.jsonl` |

**Finding: the early figures moved, all for one cause (decision 15's named case): ring 7's and ring 9's new spawn kinds reach the early campaigns.** `spawn` picks `eligible[floor(rng() × eligible.length)]` over the `SPAWN_KINDS` whose `fromThreat` and `ENCOUNTER_BANDS` admit the threat. Step 08 (`b0fbe7d`) appended `wolf_pack` (band 6–9), `worg_riders` (7–9) and `ogre_camp` (7–10), all `fromThreat: 7`, and step 09 (`2b35cb9`) `wyvern_roost` (9–12): the list at threat 7 grew from 3 kinds to 6 and at 9 from 3 to 7 (`freebooter_host`'s band does not admit 9), so the same draw picks another kind. The near-home Source and the fixed nests are unchanged; the 50-campaign check never spawns at threat 7, so it held.

- `one`: in 500 campaigns two spawns are at threat 7 (campaigns 70 and 403, both `bandit_camp`, now `spider_nest`); campaign 70 then fights one more battle and its party falls. `one` at `b0fbe7d` (worktree) is 287 with the same battle list as at head (`diff` of every `battle_start`'s campaign, day, site, encounter, threat and levels): step 08 moved it.
- `company`: 289 → 288; step 01's run has three threat-7 spawns (campaigns 70, 316, 403, all `bandit_camp`); not re-logged, read as the same cause.
- `rl10`: battles at threats 7 and 9 are about 15% of the whole (2,632 of 16,998 at step 01, 2,739 of 17,494 now), and 1,354 of them are now the new kinds. Win rates by kind (step 01 → now):

| Kind | Threat 7 battles, won | Threat 9 battles, won |
| --- | --- | --- |
| bandit_camp | 838, 0.913 → 420, 0.902 | — |
| spider_nest | 768, 0.995 → 437, 0.993 | 85, 0.988 → 27, 0.926 |
| salamander_pool | 792, 0.996 → 433, 0.984 | 80, 1.000 → 28, 1.000 |
| bandit_company | — | 69, 0.986 → 40, 0.825 |
| ogre_camp (new) | 427, 0.960 | 34, 0.735 |
| wolf_pack (new) | 381, 0.963 | 27, 0.370 |
| worg_riders (new) | 427, 0.970 | 24, 0.250 |
| wyvern_roost (new) | — | 34, 0.912 |

Battles lost at threats 7 and 9: about 82 → 151; the Source wins fall by 38. The ring cells are tuned for a party in the expected kit; `rl10`'s parties wear their own (stage 12's gear lag), and `wolf_pack` and `worg_riders` at 9 beat them. `rl10` 371 is inside its band (370–420), by one. Brought to the orchestrator (task §4.1 item 1, decision 15); nothing tuned.

### The long campaign (100, `--campaign --log none`, ready level 18)

76 s alone (step 01 166 s, stage 10 4:07), load about 3; `logs/s11-14-long.txt`. Recorded for stage 12, not judged (decision 19).

| Figure | Now | Step 01 (= stage 10) |
| --- | --- | --- |
| Source; fell; encampment lost; out of days | **0**; 100; 0; 0 | 1; 97; 0; 2 |
| Days; battles | **739; 26.8** | 1414; 42.3 |
| Walking (home) | 676.7 (144.3) | 1255.2 (170.6) |
| Spawns; sites captured, lost; blighted | 42.6; 5.5, 0.7; 66% | 53.6; 7.4, 1.6; 64% |
| Parties wiped; heroes dead (battles won); recruits | 3.7; 3.2; 17.3 | 8.3; 3.7; — |
| Final levels (lowest, highest) | 4.9, 6.4 | 5.1, 6.2 |
| Battles to level 5 / 10 / 15 / 20 | 6.8 / 26.8 / 47.3 / — | 6.8 / 28.4 / 55.9 / — |
| Campaigns reaching 5 / 10 / 15 / 20 | 84 / **38** / **3** / 0 | 84 / 53 / 16 / 0 |
| Gold by source (sites, market, routes, sales) | 589, 128, 68, 634 | 1130, 721, 689, 2300 |
| Gold on gear; on forging and tempering | 304; **82** | 451; 2271 |
| Trading post, workshop, infirmary | 2.1, 1.5, 1.5 | 3.3, 2.3, 1.8 |
| Trade (partners; routes opened, raided, abandoned) | 0.89; 0.26, 0.09, 0.08 | 1.34; 1.30, 0.82, 0.80 |
| Tier-2 bought; runes found, bought, fused | 0.7; 20.1, 0.5, 1.5 | 2.0; 34.6, 9.6, 6.3 |
| Capstones | 2 of 100 (deadeye 2) | 6 of 100 |
| Trophies a campaign | not printed (no trophy line in the summary; no measure added) | not printed (`TROPHIES` empty then) |

Heroes died at level 2 (12), 3 (50), 4 (28), 5 (46), 6 (37), 7 (38), 8 (36), 9 (16), 10 (21), 11 (14), 12 (9), 13 (6), 14 (6), 15 (2) (step 01: … 12 (16), 13 (14), 14 (15), 15 (15), 16 (6), 17 (5), 19 (1)).

| Threat | Battles | Won | Win rate | Step 01 |
| --- | --- | --- | --- | --- |
| 1 | 200 | 200 | 1.000 | 200, 1.000 |
| 2 | 361 | 358 | 0.992 | 369, 0.992 |
| 3 | 248 | 235 | 0.948 | 287, 0.955 |
| 4 | 354 | 352 | 0.994 | 441, 0.998 |
| 5 | 442 | 441 | 0.998 | 489, 1.000 |
| 7 | 625 | 515 | **0.824** | 754, 0.939 |
| 9 | 406 | 185 | **0.456** | 767, 0.785 |
| 12 | 40 | 24 | 0.600 | 768, 0.367 |
| 15 | 3 | 0 | 0 | 156, 0.295 |
| 18 | — | — | — | 1, 0 |
| 20 | — | — | — | 1, 1.000 |

Kit lines (all / forge-ready), against `expectedKit`: at 5 (84): every role tier 1.0, 0.0 runes (expected tier 2, 1–2 runes) / none (0 of 84); at 10 (38): tier 1.0, 0.0 runes (expected 3, 2–3) / none (0 of 38); at 15 (3): tier 1.0, 0.0 runes (expected 4, 3–4) / none (0 of 3). Step 01 at 15 (16): fighter 1.5 / 0.3 runes, 8 of 16 forge-ready.

**Reading (no action):** the monsters of rings 7 and 9, tuned for the expected kit, meet parties in tier-1 gear with no runes: the win rate at 9 falls from 0.785 to 0.456 and at 7 from 0.939 to 0.824, and the campaigns end there, at half the days and battles. Ring 12 is fought in 40 battles (768 before), ring 15 in 3; rings 18 and the Source at 20 are not reached, so the rebuilt Source is untested by the long run. Forging gold falls from 2271 to 82: no campaign's workshop reaches level 4 at a level mark, so hide tiers 4 and 5 are not forged in play. Stage 12 owns this (the gear lag, decision 19).

### The cells (500 each, seed 1; `logs/s11-14-<code>.txt`, 3 to 30 s each)

**Standard cells, all equal to "Now":** GR3 500, BC3 455, BC4 454, BC5 494, SN5 451, SP5 475, SG7 0, SG10 1; report only TL5 0, F1 500, F2 500, F3 463; own-kit far cells BCO9 2, BCO12 0, FH15 0, FH18 0, SG20-18 0, SG20 0 (step 13's).

**C9 cells** (`--player-kit expected`, a party of the threat's level), against the figure their step recorded; reading 300–475:

| Ring step | Cells now (= the step's figure) | Inside 300–475 |
| --- | --- | --- |
| 02 (kitted bandits) | bco9k 499, bco12k 254, fh15k 477, fh18k 500 | none was required (yardstick cells) |
| 08 | wp6 418, wp9 358, wr7 463, wr9 326, oc7 405, oc10 308 | all |
| 09 | wy9 312, wy12 399 | both |
| 10 | bw11 485, bw14 327, bl11 425, bl14 304, hg12 495, hg15 400; in play bw12 477, bl12 445 | bw11 and hg12 above, recorded for stage 12 in step 10 under the standing rule |
| 11 | go14 468, go17 438, cu14 345, cu18 471, yd15 491, yd18 396; in play go15 366, cu15 429 | yd15 above (in play), recorded for stage 12 by the user's decision (step 11) |
| 12 | lc17 497, lc20 332, ew18 482, ew20 408; in play lc18 464 | lc17 above (band end, standing rule), ew18 (in play) accepted by the user (step 12) |
| 13 | sgk20 445 | yes |

No cell differs from its step's figure; no new cell outside the reading.

**The user's decision (2026-11-28, `docs/features/long-campaign-stage-11.md`'s decision log): (a) accepted.** `rl10` 371, `one` 287 and `company` 288 are recorded with the cause found (ring 7's and 9's spawn kinds at threats 7 and 9); `bands.md`'s early "Now" rows and `src/game/CLAUDE.md`'s scaling line now carry them. The long run (Source 0 of 100, 739 days, campaigns ending at rings 7 to 9) is recorded for stage 12; the stage carries on. **For stage 12:** the 50-campaign check never spawns at threat 7, so it cannot catch an early-campaign change from far spawn kinds; measure `one` and `rl10` whenever `SPAWN_KINDS` or an encounter's band changes.

## Step 14 outcome

Step 14 (measure and record): engineer opus, reviewer opus, verdict clean, 1 review round, no blocking finding; three wording points fixed in step 15's first docs commit (the spawn list at 9 grew 3 to 7, not 4 to 8; `bands.md`'s "Now" header and stage 9's acceptance line). Commits `05cf092`, `cad31fe`, `fb3fef3`, `5f1e040`, `6b4fce3`, `a6d4c34`, `504fec3`. Gate: `npm test` runlog #205 at `504fec3` (#204 void, run under load).

## Step 15: the play script

2026-11-28, at `af01b3f` (no `src`/`scripts` change in this step; no simulation run). Walked in the dev build: the in-browser harness's Vite dev server and headless Chromium (Playwright), driven by a throwaway script outside the repository, `?seed=42`, ten times life speed; `pmset` showed no sleep across any run, each run under `caffeinate -i`. For each fight: a new game; the debug console's `level <T> all auto`; the party's equipment planted in the save as `expectedGear(member, T, lead resistance)` gives it (the kit `--player-kit expected` uses; `give` and dressing three heroes by hand for 25 fights was the alternative); reload, Continue, `heal all`, `fight <encounter> <T>`, the lead foe hovered (its panel read), a screenshot, then Auto on the battle screen; the log read through `formatEvent`. No page logged an error, threw or failed a request (the harness fails a run on any).

| Fight | Result | Rounds | Heroes standing | Foe abilities and spells that fired | Statuses laid |
| --- | --- | --- | --- | --- | --- |
| `wolf_pack` 6 | won | 8 | 3 of 3 | plain bites | taunted 8, seared 5 |
| `wolf_pack` 9 | won | 20 | 1 of 3 | plain bites | taunted 14, seared 9 |
| `worg_riders` 7 | won | 10 | 3 of 3 | `worg_strikes` | taunted 5, seared 6 |
| `worg_riders` 9 | won | 14 | 2 of 3 | `worg_strikes` | taunted 9, seared 8, pinned 2 |
| `ogre_camp` 7 | won | 13 | 3 of 3 | `worg_strikes` | taunted 9, seared 6 |
| `ogre_camp` 10 | won | 12 | 3 of 3 | `ogre_sweep`, `worg_strikes` | taunted 12, seared 9 |
| `wyvern_roost` 9 | won | 6 | 2 of 3 | `wyvern_strikes` | taunted 8, seared 7, poisoned 10 |
| `wyvern_roost` 12 | won | 8 | 2 of 3 | `wyvern_strikes` | taunted 3, seared 5, poisoned 8 |
| `barrow_wights` 11 | won | 7 | 3 of 3 | `drain_life` | taunted 8, seared 7 |
| `barrow_wights` 14 | won | 10 | 2 of 3 | `drain_life` | taunted 8, marked 4, seared 6 |
| `basilisk_lair` 11 | lost | 13 | 0 of 3 | `basilisk_gaze` | taunted 6, seared 8, chilled 7 |
| `basilisk_lair` 14 | lost | 18 | 0 of 3 | `basilisk_gaze`, `ogre_sweep` | taunted 9, marked 6, seared 7, chilled 6 |
| `hill_giant_steading` 12 | won | 14 | 2 of 3 | `giant_rock` | taunted 6, seared 7, pinned 2 |
| `hill_giant_steading` 15 | won | 10 | 3 of 3 | `giant_rock` | taunted 6, marked 4, seared 10 |
| `golem_ruin` 14 | won | 14 | 3 of 3 | `drain_life` | taunted 8, marked 5, seared 6, pinned 1 |
| `golem_ruin` 17 | won | 20 | 1 of 3 | `drain_life` | taunted 11, marked 7, seared 23, pinned 1 |
| `blight_cult` 14 | won | 15 | 3 of 3 | `curse`, `drain_life`, `heal`, `lightning_bolt` | taunted 23, marked 5, seared 6, cursed 2 |
| `blight_cult` 18 | won | 19 | 2 of 3 | `curse`, `drain_life`, `heal`, `lightning_bolt` | taunted 33, marked 6, seared 16, cursed 6, pinned 1 |
| `young_dragon` 15 | won | 14 | 3 of 3 | `dragon_breath`, `dragon_strikes`, `wyvern_strikes` | taunted 4, marked 5, seared 4, poisoned 10, pinned 1 |
| `young_dragon` 18 | won | 16 | 2 of 3 | `dragon_breath`, `dragon_strikes`, `wyvern_strikes` | taunted 9, marked 6, seared 16, poisoned 20 |
| `blight_lich_court` 17 | won | 15 | 3 of 3 | `curse`, `dark_shield`, `drain_life`, `heal`, `lightning_bolt` | taunted 29, marked 5, seared 16, shielded 1, cursed 3 |
| `blight_lich_court` 20 | won | 23 | 1 of 3 | `curse`, `dark_shield`, `drain_life`, `heal`, `lightning_bolt` | taunted 8, marked 8, pinned 3, seared 18, shielded 2, cursed 3 |
| `elder_wyrm` 18 | won | 14 | 3 of 3 | `dragon_breath`, `dragon_strikes`, `wyrm_breath`, `wyrm_strikes` | taunted 8, marked 5, seared 13 |
| `elder_wyrm` 20 | lost | 20 | 0 of 3 | `dragon_breath`, `dragon_strikes`, `wyrm_breath`, `wyrm_strikes` | taunted 4, marked 7, pinned 3, seared 22 |
| `source_guardians` 20 | won | 19 | 2 of 3 | `blight_breath`, `curse`, `heal`, `horror_claws`, `lightning_bolt` | marked 7, pinned 3, seared 16, corroded 2, cursed 2, taunted 1 |

Checks, ring by ring:
- **Ring 7.** Wolves: at 6 the fighter's Taunt held all 15 wolf attacks on him; at 9 wolves reached the archer (8 attacks) and the mage (4). Spear and Bite is one action of two lines ("Worg Rider Chief spears Aldric … HITS Aldric for 5 dmg (armour stops 1)." then "Worg Rider Chief bites Aldric … MISSES Aldric."). Sweep: "Ogre Brute sweeps its club: MISSES Aldric; HITS Delwyn for 9 dmg." (at 10; three more in the Basilisk Lair at 14); at 7 both ogres stood beside the fighter alone and only clubbed him (the policy sweeps for two heroes or more). Hover: "Sweep: ready / burst 1, around itself, foes only: 2d8+2, through armour".
- **Ring 9.** "Wyvern Mate stings Aldric … HITS Aldric for 4 dmg, poisoned." (10 poisonings at 9, 8 at 12).
- **Ring 12.** "Barrow King casts Drain Life on Aldric … HITS Aldric for 11 dmg and drains 5."; "Basilisk fixes its gaze: MISSES Aldric." (chilled 7 times at 11); "Giant Chief hurls a rock: HITS Aldric for 8 dmg (armour stops 4)." (once a fight at each end).
- **Ring 15.** The golem's panel: "Stone Golem / Wards: poison 99 / Immune to acid and poison". With Venom runes in every weapon (a variant at 14): "Aldric pins Stone Warden … HITS Stone Warden for 26 dmg (armour stops 4), pinned, unaffected by the rest. CRITICAL HIT!" (one refusal; Acid Arrow was never cast by the auto-resolved mage). Cultists cast Lightning Bolt, Curse and Heal. Fire Breath on the front rank: "Young Dragon breathes fire: HITS Aldric for 24 dmg, seared." / "MISSES Aldric, 12 dmg (half)."; the same seed with a rank-2 Ember rune in each body armour: "HITS Aldric for 20 dmg (warded 4), seared." / "MISSES Aldric, 8 dmg (warded 4) (half)." — a sixth off a hit, a third off a miss (design §4: "a third").
- **Ring 18.** The lich cast Lightning Bolt, Dark Shield and (at 20) Drain Life, and regenerated ("Blight Lich regenerates 3.") only after "Blight Lich is no longer seared."; it never cast Death Cloud in either fight (its area needs two heroes and no ally in it). The Elder Wyrm breathed its cone of 4 (5 and 7 times) with Bite and Claws; regenerated 7 and 12 times.
- **The Source at 20.** "Blight Horror breathes the blight: HITS Aldric for 30 dmg, corroded." (3 breaths, 2 corrosions, no cultist in any breath's outcomes), "Blight Horror regenerates 2.", Claws 16 strikes. With Dawn runes (rank 3, three sockets) in every weapon: "HITS Blight Horror for 17 dmg +5 blight +5 blight +5 blight", won in 13 rounds against 19.
- **Sprites.** Every unit drawn, none a placeholder, each distinct beside the heroes (screenshots of each fight's first turn; the manual's new `battle-dragon.png`).
- **Trophies** (`goto <nest>`, Attack, Auto; party at the ring's level in the kit): Greyfang Pack "Trophies: 4 wolfhide."; Cinder Roost "Trophies: 12 wyvern hide."; Thornwall Lair "Trophies: 6 basilisk scale."; Saltwind Drake "Trophies: 6 drake scale, 3 wyvern hide."; Last Wyrm "Trophies: 16 drake scale." All five won.
- **Forging.** After the Last Wyrm (16 drake scale), `facility workshop 6`, `stock gold 500`, `goto encampment`, the workshop's Forge tab, Armour: "leather:drake 80 gold, 12 drake scale" open, forged: "The Drake-scale Leather is in the baggage." The Saltwind Drake's 6 is half of one.
- **The Market Hall's goods** (`facility trading_post 5`, `contact all`): Timber from Millbrook, Salt from Saltmere, Mithril from Stonehollow, Elderwood from Elder Glade, Adamant from Emberwatch: no wyvern hide.
- **Played turn by turn** (the harness's naive player, each hero at the nearest foe): the Worg Band at 7 was lost in 26 rounds; ability lines played back as in the auto-resolved log.

Findings (recorded, not tuned or fixed; for the orchestrator): the Ember ward against Fire Breath is a sixth to a third, not about a third; a Young Dragon's 6 drake scale is half a leather; the victory screen's "The Greyfang Pack are beaten." (also the Cinder Roost, Saltwind Drake, Last Wyrm) is plural for singular names (scene text, not this stage's code); the hover panel lists a caster foe's abilities and wards but not its spells, so wights, cultists and the lich show none; the lich never cast Death Cloud in two fights; the Basilisk Lair was lost at both ends (cells 425 and 304) and the Elder Wyrm at 20 (cell 408), one seeded battle each.
