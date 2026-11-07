# Step 01: Baseline measurement

[Plan index](index.md) · [Stage design](../../designs/long-campaign/stage-02-special-attacks-and-elements.md) (§6 Verification, "Simulator") · [Stages index](../../designs/long-campaign/index.md) ("The early-game guard")

**Difficulty:** routine. Running the simulator and recording its output; `model: "sonnet"` is enough. No code changes.

## 1. Objective

Measure the early-game guard and the Troll Lair cells on the tree as it stands, before any stage 2 code changes. Every later checkpoint of the stage compares against these figures:
- steps 02 and 03 must leave the campaign summary identical to this step's;
- step 04 must leave the Troll Lair cells within noise of this step's;
- step 09 judges the guard after the new nests against this step's figure.

## 2. Requirements and context

- **Why re-measure.** After stage 1 the guard was **238 of 500** (`--ready-level 7`), accepted by the user ("a real player can just choose to grind more"). Two later commits changed battle rules since:
  - `fdc0593`: free attacks only for leaving a foe's side; a defender turns once a turn to meet a side or rear blow;
  - `51cecb5`: shots give a defender no turn; only a melee blow on the side or rear does.

  The stages index's convention is that the figure is re-measured at the start of each stage, because earlier work may have moved it.
- **The guard command** (exactly this, so later checkpoints can compare byte for byte):

  ```sh
  make -s simulate ARGS="--campaign --ready-level 7 --battles 500 --seed 1"
  ```

  `--ready-level 7` is the default (`SOURCE_READY_LEVEL`), but it is written out so the command matches CLAUDE.md and the stage 1 records.
- **The Troll Lair cells** (design §6, simulator check 3, "unchanged within noise, after the routine change"; step 04 changes the Troll):

  ```sh
  make -s simulate ARGS="--encounter troll_lair --threat 4 --party-level 4 --battles 500 --seed 1"
  make -s simulate ARGS="--encounter troll_lair --threat 5 --party-level 5 --battles 500 --seed 1"
  ```

- **Shared constraints (from the index):**
  - The simulator runs only in podman, through `make -s simulate ARGS="..."`. Local Node 22 cannot run `scripts/simulate.ts`.
  - Never run two `make simulate` commands at the same time: both build the same image, and the loser prints nothing. Run them one after another (from a script in the scratchpad if looping).
  - Logs go under `logs/` (gitignored). A 500-campaign run takes about a minute and writes about 70 MB. Do not commit logs.
  - `make test` (podman, Node 26) is the gate before every commit.
  - One commit per step, on the current branch (`armor-resistance`), without pushing; the message ends with the repo's `Co-Authored-By` attribution line.

## 3. Dependencies and prerequisites

- **No step dependency.** This step runs first, on the tree at the plan's commit (code at `51cecb5`), before any of steps 02 to 09 change code. Step 07 (sprites) touches no code and does not affect the simulator, but run this step before it anyway so the order is plain.
- **Environment:** podman with the repo's image (`make` targets). Nothing else.
- **Produces for later steps:** the full printed campaign summary (saved verbatim) and the two cells' figures, recorded in this file's execution record and summarised in the index (see §4). Steps 02, 03 and 05 diff their summaries against the saved text; step 04 compares the cells; step 09 compares the guard.

## 4. Scope and guidance

1. **Check the tree is clean** of code changes (`git status`; only docs may differ). Record `git rev-parse --short HEAD`.
2. **Run the guard command** and save its whole printed output to the scratchpad. Record:
   - Source beaten, of 500 (the guard figure);
   - how the campaigns ended (Source beaten, party fallen, encampment lost, out of days);
   - average days and battles a campaign, heroes dead a campaign;
   - the per-threat battles-won table;
   - the level lines (lowest and highest final level, levels heroes died at, battles to levels 5, 10, 15, 20).
3. **Run the two Troll Lair cells**, one after the other. Record for each: wins of 500, average rounds, both sides' damage dealt and hit rates.
4. **Keep the full guard summary text** for the later "identical" checks: paste it into this file's execution record in a fenced block (it is short), so steps 02, 03 and 05 can diff against it without re-running this step.
5. **Record in the index** (an edit to `index.md` is allowed for this and for status): add a short "Baseline (step 01)" note under the Execution order checkpoints, with the guard figure and the two cells, and set step 01's row to `done` with the commit.
6. **If the guard moved from 238** (the commits above make that likely), update the figure in CLAUDE.md's rules of scaling, in the sentence that gives 238 of 500: add that after `fdc0593` and `51cecb5` it is N of 500 (with days and battles a campaign and heroes dead), from seed 1, `--ready-level 7`. Change nothing else there. If it did not move, leave CLAUDE.md alone and say so in the record.
7. **Out of scope:** any code change, any tuning, judging the move (step 09 does that against this baseline; the user already accepted the stage 1 level).

## 5. Verification

- The guard command printed a full summary (not an empty output from a clashing run). If output is empty, check no other `make simulate` is running and run again.
- Both cells printed a summary of 500 battles.
- `make test` passes (only docs changed, but it is the gate before the commit).

## 6. Completion criteria

- [ ] The guard figure and its summary recorded in this file's execution record, the full summary text included verbatim.
- [ ] Both Troll Lair cells recorded (wins of 500, rounds, damage, hit rates).
- [ ] The index's baseline note added and step 01's row set to `done` with the commit.
- [ ] CLAUDE.md's rules of scaling updated if the figure moved from 238, or the record says it did not.
- [ ] `make test` passes; committed on the current branch, without pushing, the message ending with the repo's `Co-Authored-By` attribution line.

## Execution record

Measured on tree at `0c7cf2e` (code at `51cecb5`; only docs differed from it, no code changes), in podman, one command after another. The podman build lines before each summary are omitted below.

**Guard:** `make -s simulate ARGS="--campaign --ready-level 7 --battles 500 --seed 1"`: **Source beaten 243 of 500** (48.6%), party fell 257, encampment lost 0, out of days 0. A campaign: 281 days, 19.0 battles, 1.8 heroes dead. It moved from 238 (+5), so CLAUDE.md's rules of scaling now says so (`fdc0593` and `51cecb5`: 243 of 500).

Full summary, verbatim, for the later "identical" checks:

```
Simulated 500 campaigns, 9482 battles in all (seed 1, player aggressive vs enemy aggressive) -> logs/battles.jsonl
Beat the Source: 243 of 500 (48.6%); party fell: 257 (51.4%); encampment lost: 0 (0.0%); out of days: 0
A campaign: 281 days, 19.0 battles, 26.1 spawns, 3.1 sites captured and 0.1 lost, 38% of the land blighted at the end
Watchtowers: 1.8 built a campaign, 0.0 lost
Shrine: level 1.0 at the end; outposts: 0.5 built a campaign
Trading post, workshop, infirmary: levels 1.2, 0.7, 0.5 at the end; 7 gold on gear and 63 from sales, 4.7 items crafted (2.7 days in the field) a campaign
Guild hall: level 2.4 at the end, 2.2 recruits and 1.8 heroes dead a campaign
Hit points healed between battles: 129.9 a campaign, in 22.2 days of camping
Levels at the end: lowest 6.7, highest 7.4 on average (ready level 7); heroes died at level 2 (44), 3 (175), 4 (33), 5 (100), 6 (36), 7 (254), 8 (222), 9 (31), 10 (1)
Battles to level 5: 6.8 (427 campaigns); 10: 33.5 (2 campaigns); 15: — (0 campaigns); 20: — (0 campaigns)
┌─────────┬────────┬─────────┬──────┬─────────┐
│ (index) │ threat │ battles │ won  │ winRate │
├─────────┼────────┼─────────┼──────┼─────────┤
│ 0       │ 1      │ 1009    │ 1009 │ 1       │
│ 1       │ 2      │ 1795    │ 1777 │ 0.99    │
│ 2       │ 3      │ 2079    │ 2025 │ 0.974   │
│ 3       │ 4      │ 3076    │ 3053 │ 0.993   │
│ 4       │ 5      │ 1523    │ 1361 │ 0.894   │
└─────────┴────────┴─────────┴──────┴─────────┘
┌───────────────────────┬─────────────────────┐
│ (index)               │ Values              │
├───────────────────────┼─────────────────────┤
│ battles               │ 9482                │
│ playerWins            │ 9225                │
│ enemyWins             │ 257                 │
│ unresolved            │ 0                   │
│ avgRounds             │ 4.892216831892006   │
│ avgPlayerDamageDealt  │ 99.84950432398229   │
│ avgEnemyDamageDealt   │ 27.72569078253533   │
│ playerHitRate         │ 0.6709713604157497  │
│ enemyHitRate          │ 0.6002209021968993  │
│ playerCritRate        │ 0.04398171155948713 │
│ enemyCritRate         │ 0.04859848331784324 │
│ avgOpportunityAttacks │ 0                   │
│ avgSideAttacks        │ 1.1010335372284328  │
│ avgRearAttacks        │ 0.1468044716304577  │
│ avgPlayerCasts        │ 4.682029107783168   │
│ avgEnemyCasts         │ 2.111790761442734   │
│ avgPlayerHealing      │ 2.4655136047247415  │
│ avgEnemyHealing       │ 6.6378401181185405  │
│ avgPlayerStatuses     │ 3.16062012233706    │
│ avgEnemyStatuses      │ 0.7160936511284539  │
└───────────────────────┴─────────────────────┘
```

**Troll Lair threat 4, party level 4** (`--encounter troll_lair --threat 4 --party-level 4 --battles 500 --seed 1`): wins **218 of 500**, average rounds 15.482; player damage dealt 146.212, hit rate 0.5908; enemy damage dealt 103.3, hit rate 0.6776.

**Troll Lair threat 5, party level 5** (`--encounter troll_lair --threat 5 --party-level 5 --battles 500 --seed 1`): wins **0 of 500**, average rounds 7.48; player damage dealt 102.866, hit rate 0.5944; enemy damage dealt 147.002, hit rate 0.8023.

Full cell output:

```
Simulated 500 battles of troll_lair at threat 4, party level 4 (seed 1, player aggressive vs enemy aggressive) -> logs/battles.jsonl
┌───────────────────────┬─────────────────────┐
│ (index)               │ Values              │
├───────────────────────┼─────────────────────┤
│ battles               │ 500                 │
│ playerWins            │ 218                 │
│ enemyWins             │ 282                 │
│ unresolved            │ 0                   │
│ avgRounds             │ 15.482              │
│ avgPlayerDamageDealt  │ 146.212             │
│ avgEnemyDamageDealt   │ 103.3               │
│ playerHitRate         │ 0.5907841401481619  │
│ enemyHitRate          │ 0.6776235695154614  │
│ playerCritRate        │ 0.05003960303778596 │
│ enemyCritRate         │ 0.04957389822254687 │
│ avgOpportunityAttacks │ 0                   │
│ avgSideAttacks        │ 5.066               │
│ avgRearAttacks        │ 2.808               │
│ avgPlayerCasts        │ 6.032               │
│ avgEnemyCasts         │ 0                   │
│ avgPlayerHealing      │ 6.596               │
│ avgEnemyHealing       │ 0                   │
│ avgPlayerStatuses     │ 2.566               │
│ avgEnemyStatuses      │ 0                   │
└───────────────────────┴─────────────────────┘

Simulated 500 battles of troll_lair at threat 5, party level 5 (seed 1, player aggressive vs enemy aggressive) -> logs/battles.jsonl
┌───────────────────────┬─────────────────────┐
│ (index)               │ Values              │
├───────────────────────┼─────────────────────┤
│ battles               │ 500                 │
│ playerWins            │ 0                   │
│ enemyWins             │ 500                 │
│ unresolved            │ 0                   │
│ avgRounds             │ 7.48                │
│ avgPlayerDamageDealt  │ 102.866             │
│ avgEnemyDamageDealt   │ 147.002             │
│ playerHitRate         │ 0.594391947411668   │
│ enemyHitRate          │ 0.8022888214466363  │
│ playerCritRate        │ 0.04909613804437141 │
│ enemyCritRate         │ 0.04590288315629742 │
│ avgOpportunityAttacks │ 0                   │
│ avgSideAttacks        │ 7.714               │
│ avgRearAttacks        │ 0.354               │
│ avgPlayerCasts        │ 3.946               │
│ avgEnemyCasts         │ 0                   │
│ avgPlayerHealing      │ 6.2                 │
│ avgEnemyHealing       │ 0                   │
│ avgPlayerStatuses     │ 4.23                │
│ avgEnemyStatuses      │ 0                   │
└───────────────────────┴─────────────────────┘
```

`make test`: 68 files, 821 tests passed.
