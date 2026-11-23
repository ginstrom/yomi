# Running the simulator

Every flag in full: `docs/reference/simulator.md`, "Flags and single battles". The host's default `node` is 22: prefix every command with `PATH=/opt/homebrew/opt/node@26/bin:$PATH`.

## Flags

The ones most runs need:

- `--battles` (default 1000), `--seed`, `--out` (default `logs/battles.jsonl`, gitignored), `--log jsonl|none` (`none` writes no `.jsonl`, `--out` ignored; every printed figure is the same), `--player-policy` / `--enemy-policy` (`aggressive` or `random`), `--player-weapon <id>` (quote ids with `#`).
- One cell of scaling: `--encounter` (an `ENCOUNTERS` id), `--threat`, `--party-level`; refused with `--campaign`.
- `--plans role=plan[,...]` (roles `melee`, `archery`, `magic`; plans `PLAN_IDS`): the player's heroes only. Path parity: `--encounter bandit_camp --threat 4 --party-level 4 --plans melee=swordmaster,archery=ranger,magic=cryomancer`.
- `--campaign`, with `--ready-level` (default `SOURCE_READY_LEVEL`, 18: the long campaign), `--parties` (1 to 3, default 3; the refactor guard and the early-game figure use 1), `--near-source` (the Source where it stood before stage 9, at threat 5), `--waiting` (runs each campaign's waiting twin and prints the waiting check) and `--trading-post N` (starts the post at level N, for measuring routes only; no band is read with it). A campaign is called off after `MAX_CAMPAIGN_DAYS` (6000).
- The early-game figure, its bands and the refactor guard run with `--ready-level 7 --near-source` (`rl10` with `--ready-level 10 --near-source`); the measure names in `bands.md` carry the flags.

## Campaigns

`--campaign` is how scaling is judged: a new ready-made party on a new world per campaign, on the company's day loop, sent by `nextTarget` through the nests to the Source, levelling by `autoAdvance` and running its errands at home. The errand-by-errand policy is in the reference ("Campaigns").

## One run at a time

Never two simulations at once: on the stage-9 map, 500 early campaigns (`one`) take about 8 minutes alone and 100 long campaigns about 10 (stage 9 step 08); 500 early campaigns log some 300 MB (the 50-campaign check writes about 31 MB). Give each its own output under `logs/` (gitignored):

```sh
PATH=/opt/homebrew/opt/node@26/bin:$PATH npm run simulate -- --campaign --battles 500 --seed 1 --parties 1 --ready-level 7 --near-source --out logs/<label>-one.jsonl > logs/<label>-one.txt
PATH=/opt/homebrew/opt/node@26/bin:$PATH npm run simulate -- --battles 500 --seed 1 --encounter bandit_camp --threat 4 --party-level 4 --out logs/<label>-bc4.jsonl > logs/<label>-bc4.txt
```

A run passing 9 minutes (`--ready-level 10` or 12, counts above 500, the long campaign) is started detached and waited on; see the `yomi-measure` agent. A long run with `--log none` leaves only its `.txt`.

## Which line carries each figure

In the `.txt` (the `> yomi@0.0.0 simulate` header, then):

- The header line `Simulated N campaigns, M battles in all (...)` (a cell: `Simulated N battles of <encounter> at threat T, party level L (...)`).
- Wins of the Source: `Beat the Source: 230 of 500 (46.0%); party fell: ...; encampment lost: ...; out of days: ...`. The first number is the campaign figure.
- Days and battles: `A campaign: 270 days, 18.2 battles, ...` (the first two figures).
- Heroes dead a campaign: the `Guild hall: level ... recruits and 1.8 heroes dead in battles won (a wiped party's not counted) a campaign` line; `heroes died at level ...` ends the `Levels at the end` line.
- Routes and walking: the `Trade:` line (partners, routes opened, raided, abandoned; raids told, flickers, routes raided 6+ yield days and kept) and the `Walking:` line (the vanguard's walked days a campaign, and those walking home).
- The waiting check (`--waiting`): `Waiting check: income X a day campaigning, Y waiting at home: waiting earns less`.
- A cell's wins: the `playerWins` row of the second table (`Values` column), of 500.
