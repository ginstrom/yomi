# The simulator and the balance

Loaded when working in `scripts/`. Read it before tuning: the bands below are the user's. The full detail (the campaign's policy errand by errand, guards and the hall, buying and runecraft, every statistic printed, `CampaignRecord`'s fields) is in `docs/reference/simulator.md`.

## Flags

- `--battles` how many battles (or campaigns), default 1000; `--seed`; `--out`, default `logs/battles.jsonl` (gitignored); `--max-rounds`, default 200.
- `--player-policy`, `--enemy-policy`: `aggressive` (default) or `random`.
- `--player-weapon <id>`: any weapon id `itemById` builds (`yew_bow`, `iron_sword@2`, `iron_sword+light1`, `'iron_sword@3#ember1'`, quoted for the `#`), put in every hero's hand; compares weapons within one skill.
- `--encounter` (an `ENCOUNTERS` id, default `goblin_raid`), `--threat` (default 1), `--party-level` (default 1, members raised at full HP and spent by `autoAdvance`): one cell of scaling. Refused with `--campaign`.
- `--plans role=plan[,...]`: roles `melee`, `archery`, `magic`, plans `PLAN_IDS`; the player's heroes follow it in place of `planFor`'s, in battles and campaigns; never the enemy's. The path-parity cells run as `--encounter bandit_camp --threat 4 --party-level 8 --plans melee=swordmaster,archery=ranger,magic=cryomancer`.
- `--campaign`: each battle is a whole campaign (below).
- `--ready-level` (campaign only): the level every member needs before marching on the Source, default `SOURCE_READY_LEVEL` (7).
- `--parties` (campaign only): 1 to `MAX_PARTIES` (3), default 3; a vanguard and home guards. The refactor guard and the early-game figure use 1.
- `--waiting` (campaign only): runs each campaign's waiting twin (the same world with the company idle at home) and prints the waiting check; it costs about a third again of the run's time.

Every event is written as JSONL; a summary of win rate, rounds, hit rates, spells, techniques, traits and more is printed.

## Campaigns

`--campaign` is how scaling is judged. A new ready-made party sets out on a new world (seeded per campaign) with the blight spreading, walking a day a hex on the company's day loop (`company.ts`) to where `nextTarget` sends it: the nest pushing hardest on a threatened held site, else the nearest nest no higher in threat than its lowest level, and the Source once all are at the ready level. It carries its wounds and mana between battles, levels by `rewardVictory` and `autoAdvance`, camps until healed, takes rune loot (not item loot), raises held resources a level after a win (`improveErrand`: a fort first where a site falls in under `FORT_FIRST_DAYS`), and runs its errands at the hall and facilities (the trading post to 6, the Builders' Lodge last, to `LODGE_LEVEL_LIMIT`). A campaign ends when the Source is beaten, no hero is left, the encampment falls or `MAX_CAMPAIGN_DAYS` pass. Run one at a time: `npm run simulate -- --campaign --battles 500 --seed 1` takes about five minutes alone (longer beside other work) and logs some 70 MB.

## Balance

The measure is the share of 500 campaigns from seed 1 that beat the Source without losing the encampment (ready-made party of three, growing by `AUTO_PLANS`), and single cells (a party of the threat's own level, 500 battles).

The bands, set by the user (the targets; keep them):

| Measure | Band | Now (step 30, seed 1) |
| --- | --- | --- |
| One party (`--parties 1`) | 215 to 250 | 234 (286 days, 19.4 battles, 1.1 dead) |
| Default company | 220 to 260 | 236 |
| `--ready-level 10` | 370 to 420 | 434 (509 days), accepted up to 445 |
| Heroes dead a campaign | at most 2.0 | 1.1 |
| Days a campaign | 243 to 297 | 286 |
| GR3 | at least 470 | 500 |
| BC3 | 400 to 470 | 455 |
| BC4 | 430 to 490 | 454 |
| BC5 | 420 to 490 | 494 |
| SN5, SP5 | 410 to 480 | 451, 475 |
| SG7 | 0 within 40 | 0 |
| SG10 | above 2 | 1, accepted |

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
