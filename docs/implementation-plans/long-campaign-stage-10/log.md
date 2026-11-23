# Log: long campaign, stage 10 (forging and the high tiers)

Append-only history for [the plan](index.md) and [the feature record](../../features/long-campaign-stage-10.md): baselines and measurements, run histories, timings, review summaries, and anything else the plan accumulates as steps finish. The orchestrator does not read this file on resume.

## Step 01: the stage's baseline

2026-11-23, code `f3a1102` (no `src/` or `scripts/` change since; `f2b7193` and later are docs). Seed 1, label `s10-01`, logs under `logs/s10-01-*` (gitignored). Run one at a time through `yomi-measure`; nothing else ran beside them except the orchestrating session idling. Every figure is identical to stage 9's final figures.

| Measure | Flags | Source wins | Days | Battles | Heroes dead | Stage 9 | Wall time |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 50-campaign check | `--campaign --battles 50 --parties 1 --ready-level 7 --near-source` | 26 of 50 | | | | hash identical | 19 s |
| `one` | `--campaign --battles 500 --parties 1 --ready-level 7 --near-source` | 288 of 500 (212 fell) | 331 | 18.8 | 1.2 | 288 / 331 | 6:10 |
| `company` | `--campaign --battles 500 --ready-level 7 --near-source` | 289 of 500 (211 fell) | 334 | 18.9 | 1.2 | 289 | 5:11 |
| `rl10` | `--campaign --battles 500 --ready-level 10 --near-source` | 409 of 500 (91 fell) | 530 | 33.9 | 1.3 | 409 / 530 | 9:42 |
| `long` | `--campaign --battles 100 --log none` | 15 of 100 (85 fell) | 1272 | 46.4 | 3.3 | 15 / 1272 / 46.4 | 3:50 |

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

Outcome (step 01): engineer sonnet, no review round recorded here (orchestrator's).
