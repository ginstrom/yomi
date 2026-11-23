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

Step 05 workshop sprites: engineer sonnet, reviewer opus, clean, 1 review round, plus two look passes the orchestrator asked for (level 6 banner moved to the roof with a gold chevron, orange rim on the star-metal glow, level 4 bellows pipe); sprites:check pass, yomi-asset-check pass; no simulation.
