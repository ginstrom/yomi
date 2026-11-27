# The bands

The user sets the bands; only the user changes a band. A measuring step updates "Now".

The measure is the share of 500 campaigns from seed 1 that beat the Source without losing the encampment (ready-made party of three, growing by `AUTO_PLANS`), and single cells (a party of the threat's own level, 500 battles).

The bands, set by the user (the targets; keep them):

| Measure | Band | Now (seed 1: stage 10, 8 or 7 where marked, else the skill trees' step 30) |
| --- | --- | --- |
| One party (`--parties 1`) | 215 to 250 | 288 (331 days, 18.8 battles, 1.2 dead; stage 10, = stage 9), accepted until stage 12 |
| Default company | 220 to 260 | 289 (stage 10, = stage 9), accepted until stage 12 |
| `--ready-level 10` | 370 to 420 | 409 (533 days, 34.0 battles; stage 10; stage 8's 433 was accepted up to 445) |
| Heroes dead a campaign | at most 2.0 | 1.2 (stage 10) |
| Days a campaign | 243 to 297 | 331 (stage 10), accepted until stage 12 |
| GR3 | at least 470 | 500 |
| BC3 | 400 to 470 | 455 |
| BC4 | 430 to 490 | 454 |
| BC5 | 420 to 490 | 494 |
| SN5, SP5 | 410 to 480 | 451, 475 |
| SG7 | 0 within 40 | 0 |
| SG10 | above 2 | 1, accepted |

Accepted out of band (the user, stage 9 step 09): `one` 288, `company` 289 and `one`'s 331 days, with `SPAWN_DIVISOR` kept at 840; stage 12's retune takes them up. Evidence (500 `one` campaigns): divisor 400 gave 244 wins and 303 days, 300 gave 248 and 298 (stage 9's `log.md`, "Step 09").

The waiting check (`--waiting`, stage 7's design): income a day campaigning must stay above the waiting twin's, or idling at home pays; stage 7 measured 1.3 against 1.0 a day (one party and the company alike), the twin never ahead in any campaign. The careful simulated party rarely builds past an outpost or raises the post past 2, so works, forts and market gold barely show in these figures.

Also: TL5 0 (report-only), F1 to F3 500, 500, 463. Far cells, report only (stage 10, bandits in tiers 3 to 5): BCO9 2, BCO12 0, FH15 0, FH18 0. The long campaign (100, `--log none`; stage 10): Source 1, fell 97, 1414 days, 42.3 battles (stage 9's step 01 baseline 15, 1272, 46.4); its kit lags `expectedKit` (accepted until stage 12). Stage 11's ring cells (report only, the expected kit, the plan's reading 300 to 475, not a band; step 08): WP6 418, WP9 358, WR7 463, WR9 326, OC7 405, OC10 308; step 09: WY9 312, WY12 399; step 10: BW11 485, BW14 327, BL11 425, BL14 304, HG12 495, HG15 400; step 11: GO14 468, GO17 438, CU14 345, CU18 471, YD15 491, YD18 396; step 12: LC17 497, LC20 332, EW18 482, EW20 408; step 13: SGK20 445, SG20-18 0, SG20 0. In play: BW12 477, BL12 445, GO15 366, CU15 429, YD15 491, LC18 464, EW18 482; the misses and why: the stage 11 plan's `log.md`. Capstones barely show at level 7 or 10; `--ready-level 12` is where they do.

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
| BC7 | `bandit_camp` 7, L7 | report only |
| SN7, SN9 | `spider_nest` 7, 9, L7, L9 | report only |
| SP7, SP9 | `salamander_pool` 7, 9, L7, L9 | report only |
| BCO9, BCO12 | `bandit_company` 9, 12, L9, L12 | report only |
| FH15, FH18 | `freebooter_host` 15, 18, L15, L18 | report only |
| SG20-18, SG20 | `source_guardians` 20, L18, L20 | report only |
| BCO9K, BCO12K, FH15K, FH18K, SGK20 | BCO9, BCO12, FH15, FH18, SG20 with `--player-kit expected` | report only |
| WP6, WP9 | `wolf_pack` 6, 9, L6, L9, with `--player-kit expected` | report only (working reading 300 to 475) |
| WR7, WR9 | `worg_riders` 7, 9, L7, L9, with `--player-kit expected` | report only (300 to 475) |
| OC7, OC10 | `ogre_camp` 7, 10, L7, L10, with `--player-kit expected` | report only (300 to 475) |
| WY9, WY12 | `wyvern_roost` 9, 12, L9, L12, with `--player-kit expected` | report only (300 to 475) |
| BW11, BW14; BL11, BL14; HG12, HG15 | `barrow_wights`, `basilisk_lair` 11, 14; `hill_giant_steading` 12, 15; party of the threat's level, with `--player-kit expected` | report only (300 to 475) |
| GO14, GO17; CU14, CU18; YD15, YD18 | `golem_ruin` 14, 17; `blight_cult` 14, 18; `young_dragon` 15, 18; party of the threat's level, with `--player-kit expected` | report only (300 to 475) |
| LC17, LC20; EW18, EW20 | `blight_lich_court` 17, 20; `elder_wyrm` 18, 20; party of the threat's level, with `--player-kit expected` | report only (300 to 475) |

## Measure names for `yomi-measure`

Each runs from the seed and count the brief gives (default seed 1, 500). The bands table gives the band.

| Name | Flags |
| --- | --- |
| `one` | `--campaign --parties 1 --ready-level 7 --near-source` |
| `company` | `--campaign --ready-level 7 --near-source` |
| `rl10` | `--campaign --ready-level 10 --near-source` (may pass 9 minutes) |
| `rl10-one` | `--campaign --parties 1 --ready-level 10 --near-source` (report only) |
| `rl12` | `--campaign --ready-level 12 --near-source` (report only; may pass 9 minutes) |
| `long` | `--campaign --log none`, count 100 unless the brief says otherwise (report only; the long campaign, ready level 18) |
| `long-one` | `long` with `--parties 1` (report only) |
| `long-tp4` | `long` with `--trading-post 4` (report only) |
| `gr3`, `bc3`, `bc4`, `bc5`, `sn5`, `sp5`, `tl5`, `sg7`, `sg10`, `f1`, `f2`, `f3` | the cell code's `--encounter`, `--threat`, `--party-level` |
| `bc7`, `sn7`, `sn9`, `sp7`, `sp9`, `bco9`, `bco12`, `fh15`, `fh18`, `sg20-18`, `sg20` | the cell code's flags (report only) |
| `bco9k`, `bco12k`, `fh15k`, `fh18k`, `sgk20` | `bco9`, `bco12`, `fh15`, `fh18`, `sg20` with `--player-kit expected` (report only) |
| `wp6`, `wp9`, `wr7`, `wr9`, `oc7`, `oc10`, `wy9`, `wy12`, `bw11`, `bw14`, `bl11`, `bl14`, `hg12`, `hg15`, `go14`, `go17`, `cu14`, `cu18`, `yd15`, `yd18`, `lc17`, `lc20`, `ew18`, `ew20` | the cell code's `--encounter`, `--threat`, `--party-level`, with `--player-kit expected` (report only; stage 11's rings 7, 9, 12, 15 and 18) |
| `parity-L4` | `--encounter bandit_camp --threat 4 --party-level 4 --plans <role>=<plan>`, one run per plan of `AUTO_PLANS`, in its role's slot (`melee`, `archery` or `magic`) |
| `parity-L8` | `--encounter hobgoblin_warband --threat 5 --party-level 8 --plans <role>=<plan>`, one run per plan (reported, not gated) |
| `parity-L14` | `--encounter bandit_camp --threat 7 --party-level 14 --plans <role>=<plan>`, one run per plan (reported, not gated) |
| `standard` | every row of the bands table: `one`, `company`, `rl10`, then the cells `gr3`, `bc3`, `bc4`, `bc5`, `sn5`, `sp5`, `sg7`, `sg10` (`tl5` is report-only, not a band row) |

The early measures (`one`, `company`, `rl10`, `rl10-one`, `rl12`) run with `--near-source`, the Source where it stood before stage 9 at threat 5 and no fixed nest above threat 5, so they keep their meaning as the map grows (stage 9's plan, decision 2). `--waiting` or `--plans` may be added by the brief. Heroes dead and days a campaign come from the `one` run.

## History

The skill trees' measurement history is the Measurements table of `docs/implementation-plans/skill-trees/index.md`; each plan's `log.md` or execution record has its own runs.
