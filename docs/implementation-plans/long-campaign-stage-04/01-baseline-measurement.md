# Step 01: Baseline measurement

[Plan index](index.md) · [Stage design](../../designs/long-campaign/stage-04-runes.md) (§6 Verification, "Simulator") · [Stages index](../../designs/long-campaign/index.md) ("The early-game guard")

**Difficulty:** routine. The step runs the simulator and records what it prints, so `model: "sonnet"` is enough for the engineer and the reviewer. It changes no code.

## 1. Objective

Measure the early-game guard and the Troll Lair reference cells on the tree as it stands, before any stage 4 code changes. Every later checkpoint compares against these figures:
- steps 03, 04, 05, 06 and 07 must leave the guard's summary **identical** to this step's. Until step 10, the simulator neither loots nor embeds runes, and no step changes a draw (index, "Determinism"; correction 2);
- step 10 measures the guard with runes in play, and step 11 judges it against this step's figure;
- step 11 runs check 2 (`'iron_sword@3#ember1'` and `'iron_sword@3#ember3'`) against this step's `'iron_sword@3'` cell. The `#` ids cannot be built until step 03 adds the grammar, so only the unruned cell is run here.

## 2. Requirements and context

- **Why re-measure.** After stage 3 the guard was **233 of 500** (`--ready-level 7`), and the user accepted that figure. The stages index's convention is to re-measure at the start of each stage, because earlier work may have moved it.
- **The guard command.** Run exactly this, so that later checkpoints can compare byte for byte:

  ```sh
  npm run simulate -- --campaign --ready-level 7 --battles 500 --seed 1
  ```

- **The reference cells.** Each runs with `--battles 500 --seed 1`:

  | Cell | Flags | Used by |
  | --- | --- | --- |
  | Troll Lair, Masterwork longsword | `--player-weapon 'iron_sword@3' --encounter troll_lair --threat 5 --party-level 5` | check 2 (step 11): the baseline for `'iron_sword@3#ember1'` and `'iron_sword@3#ember3'` |
  | Troll Lair, longsword | `--player-weapon iron_sword --encounter troll_lair --threat 5 --party-level 5` | continuity with stage 3's cell (0 wins at stage 3's step 01) |

  - The party level is 5, as in stage 3's Troll Lair cell (correction 17).
  - Quote any id that holds `@` or `#`, so that no shell reads the `#` (correction 17).
- **Shared constraints (from the index):**
  - **The simulator.** Run it locally with Node 26 (`PATH=/opt/homebrew/opt/node@26/bin:$PATH npm run simulate -- <flags>`), or in podman with `make -s simulate ARGS="<flags>"`.
    - Give each run its own `--out` file under `logs/`. `logs/` is gitignored, so never commit a log.
    - Run the commands one after another. Two `make simulate` runs at once both build the same image, and the loser prints nothing.
    - A 500-campaign run takes about a minute and writes about 70 MB.
  - **The gate.** `npm test` (or `make test`) passes before every commit.
  - **Commits.** One commit per step on `long-campaign-stage-04`, without pushing. Never switch branches. The message ends with the repo's `Co-Authored-By` attribution line.

## 3. Dependencies and prerequisites

- **No step dependency.** This step runs first, on the tree at the plan's commit (code at `7d32a0a`), before steps 03 to 11 change code.
  - Step 02 is art only and may run alongside this step. It changes no code and cannot move the simulator.
  - If step 02 has already committed, note it in the record.
- **Environment:** Node 26 at `/opt/homebrew/opt/node@26/bin`, or podman with the repo's image.
- **What later steps use:**
  - the full printed guard summary, kept word for word in this file's execution record;
  - the two cells' figures;
  - the baseline note in the index.

## 4. Scope and guidance

1. **Check that the tree has no code changes.** Run `git status`; only docs, or step 02's art, may differ. Record `git rev-parse --short HEAD`.
2. **Run the guard command** with `--out logs/s4-baseline-guard.jsonl`. Save the whole printed output in the scratchpad. Record:
   - the Source beaten, of 500 (the guard figure);
   - how the campaigns ended;
   - the average days, battles and heroes dead a campaign;
   - the gold spent on gear and taken from sales, the items crafted, and the trading post's, workshop's and infirmary's levels at the end;
   - the battles won at each threat;
   - the level lines.
3. **Run the two cells,** one after the other, with `--out logs/s4-baseline-troll5-mw.jsonl` and `--out logs/s4-baseline-troll5.jsonl`. Record for each:
   - the wins of 500;
   - the average rounds;
   - both sides' damage dealt;
   - the hit rates.
4. **Keep the full guard summary text.** Paste it into this file's execution record in a fenced block, so that steps 03 to 07 can diff against it without running this step again.
5. **Record in the index.** You may edit `index.md` for this and for the status:
   - add a short "Baseline (step 01)" note under the Execution order checkpoints, with the guard figure and the two cells;
   - set step 01's row to `done` with the commit.
6. **If the guard moved from 233,** update the figure in CLAUDE.md's rules of scaling, where it gives stage 3's figure. Add that at the start of stage 4 it is N of 500, from seed 1 at `--ready-level 7`, with the days and battles a campaign and the heroes dead. Change nothing else there. If it did not move, leave CLAUDE.md alone and say so in the record.
7. **Out of scope:**
   - any code change;
   - any tuning;
   - judging a move (step 11 does that against this baseline).

## 5. Verification

- The guard run and both cells finished, and each printed a summary. Note any run that printed nothing, which is usually a `make simulate` run that clashed with another, and run it again alone.
- The record holds the guard figure, the full summary in a fenced block, and the two cells' wins, rounds, damage and hit rates.
- `git status` shows no files under `logs/` staged.
- `npm test` passes before the commit. Nothing it runs has changed, but it is the gate.

## 6. Completion criteria

- [ ] The guard measured on the unchanged tree, with its full summary in this file's execution record.
- [ ] The two Troll Lair cells measured and recorded.
- [ ] The "Baseline (step 01)" note added to the index, and step 01's row set to `done` with the commit.
- [ ] CLAUDE.md updated only if the guard moved from 233, and the record says which.
- [ ] One commit on `long-campaign-stage-04` (this file, the index and any CLAUDE.md line), not pushed.

## Execution record
