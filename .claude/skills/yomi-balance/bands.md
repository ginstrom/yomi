# The bands

The user sets the bands; only the user changes a band. A measuring step updates "Now".

The measure is the share of 500 campaigns from seed 1 that beat the Source without losing the encampment (ready-made party of three, growing by `AUTO_PLANS`), and single cells (a party of the threat's own level, 500 battles).

The bands, set by the user (the targets; keep them):

| Measure | Band | Now (seed 1: stage 8 or 7 where marked, else the skill trees' step 30) |
| --- | --- | --- |
| One party (`--parties 1`) | 215 to 250 | 233 (284 days, 19.3 battles, 1.2 dead; stage 8) |
| Default company | 220 to 260 | 232 (stage 8) |
| `--ready-level 10` | 370 to 420 | 433 (509 days; stage 8), accepted up to 445 |
| Heroes dead a campaign | at most 2.0 | 1.2 (stage 8) |
| Days a campaign | 243 to 297 | 284 (stage 8) |
| GR3 | at least 470 | 500 |
| BC3 | 400 to 470 | 455 |
| BC4 | 430 to 490 | 454 |
| BC5 | 420 to 490 | 494 |
| SN5, SP5 | 410 to 480 | 451, 475 |
| SG7 | 0 within 40 | 0 |
| SG10 | above 2 | 1, accepted |

The waiting check (`--waiting`, stage 7's design): income a day campaigning must stay above the waiting twin's, or idling at home pays; stage 7 measured 1.3 against 1.0 a day (one party and the company alike), the twin never ahead in any campaign. The careful simulated party rarely builds past an outpost or raises the post past 2, so works, forts and market gold barely show in these figures.

Also: TL5 0 (report-only), F1 to F3 500, 500, 463. Capstones barely show at level 7 or 10; `--ready-level 12` is where they do.

Path parity: every plan of `AUTO_PLANS` within 50 of its role's best at Bandit Camp threat 4, level 4. All hold but the evoker, 54 behind the healer (accepted). At levels 8 (Hobgoblin Warband) and 14 (Bandit Camp threat 7) gaps are reported, not gated; at 14 `rogue_archer` 75, cryomancer 59, saint 84 and arcanist 444 behind were accepted by the user.

## Cell codes

A cell is `--encounter E --threat T --party-level L`, 500 battles from seed 1 (`running.md`).

| Code | Encounter, threat, party level | Band |
| --- | --- | --- |
| GR3 | `goblin_raid` 3, L3 | at least 470 |
| BC3 | `bandit_camp` 3, L3 | 400 to 470 |
| BC4 | `bandit_camp` 4, L4 | 430 to 490 |
| BC5 | `bandit_camp` 5, L5 | 420 to 490 |
| SN5 | `spider_nest` 5, L5 | 410 to 480 |
| SP5 | `salamander_pool` 5, L5 | 410 to 480 |
| TL5 | `troll_lair` 5, L5 | report only |
| SG7 | `source_guardians` 5, L7 | 0 within 40 |
| SG10 | `source_guardians` 5, L10 | above 2 |
| F1, F2, F3 | `goblin_raid` 1, 2, 3, L1 | report only (500, 500, 463) |

## Measure names for `yomi-measure`

Each runs from the seed and count the brief gives (default seed 1, 500). The bands table gives the band.

| Name | Flags |
| --- | --- |
| `one` | `--campaign --parties 1` |
| `company` | `--campaign` |
| `rl10` | `--campaign --ready-level 10` (may pass 9 minutes) |
| `rl12` | `--campaign --ready-level 12` (report only; may pass 9 minutes) |
| `gr3`, `bc3`, `bc4`, `bc5`, `sn5`, `sp5`, `tl5`, `sg7`, `sg10`, `f1`, `f2`, `f3` | the cell code's `--encounter`, `--threat`, `--party-level` |
| `parity-L4` | `--encounter bandit_camp --threat 4 --party-level 4 --plans <role>=<plan>`, one run per plan of `AUTO_PLANS`, in its role's slot (`melee`, `archery` or `magic`) |
| `parity-L8` | `--encounter hobgoblin_warband --threat 5 --party-level 8 --plans <role>=<plan>`, one run per plan (reported, not gated) |
| `parity-L14` | `--encounter bandit_camp --threat 7 --party-level 14 --plans <role>=<plan>`, one run per plan (reported, not gated) |
| `standard` | every row of the bands table: `one`, `company`, `rl10`, then the cells `gr3`, `bc3`, `bc4`, `bc5`, `sn5`, `sp5`, `sg7`, `sg10` (`tl5` is report-only, not a band row) |

`--waiting` or `--plans` may be added by the brief. Heroes dead and days a campaign come from the `one` run.

## History

The skill trees' measurement history is the Measurements table of `docs/implementation-plans/skill-trees/index.md`; each plan's `log.md` or execution record has its own runs.
