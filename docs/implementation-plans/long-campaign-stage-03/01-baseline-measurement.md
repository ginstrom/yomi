# Step 01: Baseline measurement

[Plan index](index.md) · [Stage design](../../designs/long-campaign/stage-03-gear-families.md) (§6 Verification, "Simulator") · [Stages index](../../designs/long-campaign/index.md) ("The early-game guard")

**Difficulty:** routine. The step runs the simulator and records its output, so `model: "sonnet"` is enough for both the engineer and the reviewer. No code changes.

## 1. Objective

Measure the early-game guard and the reference cells on the tree as it stands, before any stage 3 code changes. Every later checkpoint of the stage compares against these figures:
- step 04 must leave the campaign summary identical to this step's, except for the mage's wand (correction 18). A scratch run with the wand skipped must be identical outright.
- step 05 must leave it identical to step 04's.
- steps 06 and 09 measure the guard, and step 10 judges it against this step's figure.
- step 10 runs simulator checks 2 and 3 with the new weapons (`steel_war_hammer`, `iron_spear`) against this step's `iron_sword` cells.
- step 09 (bandits in steel, Q2) compares the Bandit Camp cells with this step's.

## 2. Requirements and context

- **Why re-measure.** After stage 2 the guard was **248 of 500** (`--ready-level 7`), and the user accepted it. The stages index's convention is that the figure is re-measured at the start of each stage, because earlier work may have moved it. The pr-reviewer fixes on `armor-resistance` (`6ea3064..efe3888`) came after stage 2's last measurement.
- **The guard command** (exactly this, so later checkpoints can compare byte for byte):

  ```sh
  npm run simulate -- --campaign --ready-level 7 --battles 500 --seed 1
  ```

- **The reference cells,** all with `--battles 500 --seed 1`:

  | Cell | Flags | Used by |
  | --- | --- | --- |
  | Troll Lair, longsword | `--player-weapon iron_sword --encounter troll_lair --threat 5 --party-level 5` | check 2 (step 10), against `steel_war_hammer` |
  | Goblin Raid, longsword | `--player-weapon iron_sword --encounter goblin_raid --threat 3 --party-level 3` | check 3 (step 10), against `iron_spear`; `--party-level 3` by correction 19 |
  | Bandit Camp, threat 3 | `--encounter bandit_camp --threat 3 --party-level 3` | step 09 (Q2) |
  | Bandit Camp, threat 4 | `--encounter bandit_camp --threat 4 --party-level 4` | step 09 (Q2) |
  | Bandit Camp, threat 5 | `--encounter bandit_camp --threat 5 --party-level 5` | step 09 (Q2: steel at threat 5) |

  `iron_sword` is a legacy id that keeps its id in stage 3 (contract C1), so step 10 can run the same flag after the catalog lands.
- **Shared constraints (from the index):**
  - **Simulator.** Run it locally with Node 26 (`PATH=/opt/homebrew/opt/node@26/bin:$PATH npm run simulate -- <flags>`) or in podman with `make -s simulate ARGS="<flags>"`.
    - Give each run its own `--out` file under `logs/`. `logs/` is gitignored; never commit a log.
    - Run the commands one after another. Two `make simulate` runs at once both build the same image, and the loser prints nothing.
    - A 500-campaign run takes about a minute and writes about 70 MB.
  - **The gate.** `npm test` (or `make test`) passes before every commit.
  - **Commits.** One commit per step on `long-campaign-stage-03`, without pushing. Never switch branches, and never commit on `armor-resistance` or `encampment-gear-and-resistance`. The message ends with the repo's `Co-Authored-By` attribution line.

## 3. Dependencies and prerequisites

- **No step dependency.** This step runs first, on the tree at the plan's commit (code at `866f732`), before steps 04 to 10 change code.
  - Steps 02 and 03 (art only) may run alongside it. They change no code and cannot move the simulator.
  - If either has already committed, note it in the record.
- **Environment:** Node 26 at `/opt/homebrew/opt/node@26/bin`, or podman with the repo's image.
- **What later steps consume:**
  - the full printed guard summary, saved verbatim in this file's execution record;
  - the five cells' figures;
  - the baseline note in the index (§4).

## 4. Scope and guidance

1. **Check the tree is clean** of code changes: run `git status` (only docs, or art from steps 02 and 03, may differ). Record `git rev-parse --short HEAD`.
2. **Run the guard command** with `--out logs/s3-baseline-guard.jsonl`. Save its whole printed output in the scratchpad. Record:
   - the Source beaten, of 500 (the guard figure);
   - how the campaigns ended;
   - the average days, battles and heroes dead a campaign;
   - the gold spent on gear and taken from sales, the items crafted, and the trading post's and workshop's levels at the end;
   - the per-threat battles-won table;
   - the level lines.
3. **Run the five cells,** one after another, each with its own `--out` (for example `logs/s3-baseline-troll5.jsonl`, `logs/s3-baseline-raid3.jsonl`, and `logs/s3-baseline-camp3.jsonl` to `logs/s3-baseline-camp5.jsonl`). Record for each:
   - the wins of 500;
   - the average rounds;
   - both sides' damage dealt;
   - the hit rates.
4. **Keep the full guard summary text** for the later "identical" checks. Paste it into this file's execution record in a fenced block, so steps 04 and 05 can diff against it without running this step again.
5. **Record in the index.** Editing `index.md` is allowed for this and for status:
   - add a short "Baseline (step 01)" note under the Execution order checkpoints, with the guard figure and the five cells;
   - set step 01's row to `done` with the commit.
6. **If the guard moved from 248,** update the figure in CLAUDE.md's rules of scaling, where it gives stage 2's figure. Add that at the start of stage 3 it is N of 500, with the days and battles a campaign and the heroes dead, from seed 1 at `--ready-level 7`. Change nothing else there. If it did not move, leave CLAUDE.md alone and say so in the record.
7. **Out of scope:**
   - any code change;
   - any tuning;
   - judging a move (step 10 does that against this baseline).

## 5. Verification

- The guard command printed a full summary, not an empty output from a clashing run. If the output is empty, check that no other `make simulate` is running, and run it again.
- Each of the five cells printed a summary of 500 battles.
- `npm test` passes. Only docs changed, but it is the gate before the commit.

## 6. Completion criteria

- [ ] The guard figure and its summary are recorded in this file's execution record, with the full summary text verbatim.
- [ ] All five cells are recorded: wins of 500, rounds, damage and hit rates.
- [ ] The index's baseline note is added, and step 01's row is set to `done` with the commit.
- [ ] CLAUDE.md's rules of scaling are updated if the figure moved from 248, or the record says it did not move.
- [ ] `npm test` passes, and the step is committed on `long-campaign-stage-03` without pushing, with a message ending in the repo's `Co-Authored-By` attribution line.

## Execution record

Run at HEAD `11b1ca0` (tree clean, Node 26, `logs/` gitignored; steps 02 and 03 not yet committed). No code changed.

**Guard: 248 of 500** (`npm run simulate -- --campaign --ready-level 7 --battles 500 --seed 1`). Unmoved from stage 2's 248; CLAUDE.md left alone. Spawns (26.8) and sites captured (3.1) are the post-`55f4668` figures (field-craft days' events now tallied); outcomes unchanged.

Guard summary, verbatim:

```

Simulated 500 campaigns, 9338 battles in all (seed 1, player aggressive vs enemy aggressive) -> logs/s3-baseline-guard.jsonl
Beat the Source: 248 of 500 (49.6%); party fell: 252 (50.4%); encampment lost: 0 (0.0%); out of days: 0
A campaign: 274 days, 18.7 battles, 26.8 spawns, 3.1 sites captured and 0.1 lost, 38% of the land blighted at the end
Watchtowers: 1.8 built a campaign, 0.0 lost
Shrine: level 1.0 at the end; outposts: 0.5 built a campaign
Trading post, workshop, infirmary: levels 1.1, 0.7, 0.4 at the end; 2 gold on gear and 50 from sales, 4.4 items crafted (2.6 days in the field) a campaign
Guild hall: level 2.4 at the end, 2.1 recruits and 1.7 heroes dead a campaign
Hit points healed between battles: 131.2 a campaign, in 21.9 days of camping
Levels at the end: lowest 6.8, highest 7.3 on average (ready level 7); heroes died at level 2 (44), 3 (175), 4 (32), 5 (96), 6 (15), 7 (250), 8 (221), 9 (29)
Battles to level 5: 6.8 (427 campaigns); 10: — (0 campaigns); 15: — (0 campaigns); 20: — (0 campaigns)
┌─────────┬────────┬─────────┬──────┬─────────┐
│ (index) │ threat │ battles │ won  │ winRate │
├─────────┼────────┼─────────┼──────┼─────────┤
│ 0       │ 1      │ 1010    │ 1010 │ 1       │
│ 1       │ 2      │ 1789    │ 1771 │ 0.99    │
│ 2       │ 3      │ 2016    │ 1962 │ 0.973   │
│ 3       │ 4      │ 2950    │ 2927 │ 0.992   │
│ 4       │ 5      │ 1573    │ 1416 │ 0.9     │
└─────────┴────────┴─────────┴──────┴─────────┘
┌───────────────────────┬──────────────────────┐
│ (index)               │ Values               │
├───────────────────────┼──────────────────────┤
│ battles               │ 9338                 │
│ playerWins            │ 9086                 │
│ enemyWins             │ 252                  │
│ unresolved            │ 0                    │
│ avgRounds             │ 4.859605911330049    │
│ avgPlayerDamageDealt  │ 98.36945812807882    │
│ avgEnemyDamageDealt   │ 27.845148854144355   │
│ playerHitRate         │ 0.6679363083401567   │
│ enemyHitRate          │ 0.598630852555467    │
│ playerCritRate        │ 0.043828225523453036 │
│ enemyCritRate         │ 0.04870370879498529  │
│ avgOpportunityAttacks │ 0                    │
│ avgSideAttacks        │ 1.1152281002355966   │
│ avgRearAttacks        │ 0.1507817519811523   │
│ avgPlayerCasts        │ 4.686763760976654    │
│ avgEnemyCasts         │ 2.1052687941743415   │
│ avgPlayerAreaAttacks  │ 0                    │
│ avgEnemyAreaAttacks   │ 0.027200685371599913 │
│ avgPlayerHealing      │ 2.4565217391304346   │
│ avgEnemyHealing       │ 6.544977511244378    │
│ avgPlayerStatuses     │ 3.1138359391732706   │
│ avgEnemyStatuses      │ 0.7514457057185693   │
└───────────────────────┴──────────────────────┘
```

Reference cells (`--battles 500 --seed 1`, each in `logs/s3-baseline-<name>.jsonl`):

| Cell | Wins of 500 | Avg rounds | Player dmg | Enemy dmg | Player hit | Enemy hit |
| --- | --- | --- | --- | --- | --- | --- |
| troll5 (iron_sword, troll_lair, threat 5, level 5) | 0 | 7.154 | 44.834 | 147.954 | 0.2007 | 0.8005 |
| raid3 (iron_sword, goblin_raid, threat 3, level 3) | 487 | 11.794 | 96.99 | 44.82 | 0.2833 | 0.5192 |
| camp3 (bandit_camp, threat 3, level 3) | 444 | 9.96 | 97.87 | 62.05 | 0.5653 | 0.5115 |
| camp4 (bandit_camp, threat 4, level 4) | 473 | 9.466 | 106.27 | 64.792 | 0.6170 | 0.6054 |
| camp5 (bandit_camp, threat 5, level 5) | 470 | 8.394 | 102.5 | 65.144 | 0.5961 | 0.6259 |

Note: troll5 is 0 of 500 with the longsword in every hand (the war hammer in step 10 is judged against that; the player's hit rate is only 20% there).
