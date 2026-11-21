# The simulator and the balance

Loaded when working in `scripts/`. Read it before tuning: the bands below are the user's. The full detail (the campaign's policy errand by errand, guards and the hall, buying and runecraft, every statistic printed, `CampaignRecord`'s fields) is in `docs/reference/simulator.md`.

## Flags

Every flag in full: reference, "Flags and single battles". The ones most runs need:

- `--battles` (default 1000), `--seed`, `--out` (default `logs/battles.jsonl`, gitignored), `--player-policy` / `--enemy-policy` (`aggressive` or `random`), `--player-weapon <id>` (quote ids with `#`).
- One cell of scaling: `--encounter` (an `ENCOUNTERS` id), `--threat`, `--party-level`; refused with `--campaign`.
- `--plans role=plan[,...]` (roles `melee`, `archery`, `magic`; plans `PLAN_IDS`): the player's heroes only. Path parity: `--encounter bandit_camp --threat 4 --party-level 8 --plans melee=swordmaster,archery=ranger,magic=cryomancer`.
- `--campaign`, with `--ready-level` (default `SOURCE_READY_LEVEL`, 7), `--parties` (1 to 3, default 3; the refactor guard and the early-game figure use 1) and `--waiting` (runs each campaign's waiting twin and prints the waiting check).

## Campaigns

`--campaign` is how scaling is judged: a new ready-made party on a new world per campaign, on the company's day loop, sent by `nextTarget` through the nests to the Source, levelling by `autoAdvance` and running its errands at home. The errand-by-errand policy is in the reference ("Campaigns"). Run one at a time: 500 campaigns take about five minutes alone and log some 70 MB.

## Balance

The measure is the share of 500 campaigns from seed 1 that beat the Source without losing the encampment (ready-made party of three, growing by `AUTO_PLANS`), and single cells (a party of the threat's own level, 500 battles).

The bands, set by the user (the targets; keep them):

| Measure | Band | Now (seed 1: stage 7 where marked, else the skill trees' step 30) |
| --- | --- | --- |
| One party (`--parties 1`) | 215 to 250 | 239 (286 days, 19.5 battles, 1.1 dead; stage 7) |
| Default company | 220 to 260 | 239 (stage 7) |
| `--ready-level 10` | 370 to 420 | 434 (509 days), accepted up to 445 |
| Heroes dead a campaign | at most 2.0 | 1.1 (stage 7) |
| Days a campaign | 243 to 297 | 286 (stage 7) |
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

The skill trees' measurement history is the Measurements table of `docs/implementation-plans/skill-trees/index.md`.

## The refactor guard

`scripts/simulate.test.ts` holds a hash of the first 5 campaigns' events, so a change that moves play fails it; re-record it with the new figures.

## What a tuner needs to know

- A campaign is lost in a single battle at threat 5, mostly the Source's: the Blight Horror's hit points are the lever for it alone.
- Foe counts feed back through experience, so move them first and in small steps: a fifth foe at threat 5 is a cliff, and threat 5 must never give less experience than threat 4.
- `FOE_HP_PER_LEVEL` is the finer lever (now 1.15).
- Gear and several parties change little in the simulator; the game as played runs easier than the tuned figure.
- Retune when a hero's growth changes (creation budgets, skill or perk points, node costs, a node, spell, technique or mana), or the ready-made party, the party limit or healing does.
