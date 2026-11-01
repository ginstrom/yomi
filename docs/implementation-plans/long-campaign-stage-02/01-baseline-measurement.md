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
