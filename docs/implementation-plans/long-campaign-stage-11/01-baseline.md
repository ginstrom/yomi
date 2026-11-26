# Step 01: The stage's baseline

[Plan index](index.md) · [Stage design](../../designs/long-campaign/stage-11-high-roster.md) (§6 Verification) · [Stages index](../../designs/long-campaign/index.md) ("The early-game guard") · [Balance skill](../../../.claude/skills/yomi-balance/SKILL.md) (`bands.md`, `running.md`, `guards.md`) · [Stage 10's measuring step](../long-campaign-stage-10/10-measure.md) · [Plan log](log.md)

**Difficulty:** sonnet / sonnet. The engineer (`model: "sonnet"`) runs fixed measures through `yomi-measure` and records them; it changes no code and judges no balance beyond flagging moves. The reviewer (`model: "sonnet"`) checks each figure against the line `running.md` names in its log.

## 1. Objective

Measure the stage's starting point on the code as it stands (`1a008af`), before any stage-11 change:
- the 50-campaign check's hash, which steps 02, 03 and 08–13 compare against;
- the early figures `one`, `company` and `rl10` (500 campaigns each, with `--near-source`);
- the long baseline (`long`, 100 campaigns, `--log none`), against which step 14 records the new roster's Source share and battles to level for stage 12;
- the standard cells and the far cells (`bco9`, `bco12`, `fh15`, `fh18`, `sg20-18`, `sg20`), the bare-kit reference before the rings change.

Compare each with stage 10's final figures and say what moved. Change no code.

## 2. Requirements and context

- **Stages index, "The early-game guard":** every stage keeps the current campaign figure; it is re-measured at the start of each stage, because a previous stage may have moved it. From stage 9 on it is measured with `--ready-level 7 --near-source`.
- **Design §6, "After the last ring":** the long campaign (100 campaigns) against stage 10's numbers; the Source share and the battles to level are recorded for stage 12. This step supplies the baseline on today's code.
- **Code since stage 10's measuring step:** stage 10 was merged as PR #12 (`e801f5c`); `c138d83` and `1a008af` are feature-record commits. Check `git log c138d83..HEAD -- src scripts` is empty (if not, name the commits and measure on the head anyway).

### Stage 10's final figures (from `bands.md` and stage 10's step 10 record)

- Early (seed 1, 500, `--near-source`): `one` 288 of 500 (331 days, 18.8 battles, 1.2 heroes dead), `company` 289, `rl10` 409 (533 days, 34.0 battles). `one`, `company` and `one`'s days are out of band and **accepted by the user until stage 12**; `rl10` is in band (370–420).
- 50-campaign check: `57fdea1553a35b1af0e33b74a11ea9fe0a0e2f62ef9e5c80972af59276e53e75` (26 of 50).
- Long (100, seed 1, `--log none`): Source 1 of 100, fell 97; 1414 days; 42.3 battles; battles to level 5/10/15 6.8/28.4/55.9 in 84/53/16 campaigns (none to 20); 2271 gold on forging; run time 4:07 alone.
- Standard cells (= "Now" in `bands.md`): GR3 500, BC3 455, BC4 454, BC5 494, SN5 451, SP5 475, SG7 0, SG10 1; TL5 0 (report only).
- Far cells (report only): BCO9 2, BCO12 0, FH15 0, FH18 0, SG20-18 28, SG20 71.

### Decisions from the index this step relies on (unchanged)

15. **The refactor guard and the 50-campaign check stay identical through every step**: `--near-source` drops every fixed nest above threat 5, the near-home Source is unchanged (decision 3), and new `SPAWN_KINDS` are appended with `fromThreat: 7`. If a step moves either, it finds the cause; if the cause is only far spawns' kinds reaching the early campaign, it stops and brings it to the orchestrator (a re-record then needs approval and goes in that step). No step is planned to re-record the guard.
19. **Early measures with `--near-source`** (as stages 9 and 10): `one`, `company`, `rl10`, the refactor guard and the 50-campaign check. **Stage 12 owns** the accepted out-of-band figures (`one` 288, `company` 289, 331 days), the long campaign's gear lag and the Source at 1 of 100; this stage records the long run and does not tune it. Any figure further out than accepted goes to the orchestrator with options, never tuned away. The user's bands are never changed.

### Shared constraints (from the index, unchanged)

- **Commands** (local Node 26: prefix `PATH=/opt/homebrew/opt/node@26/bin:$PATH`; or the podman `make` targets):
  - `npm test` (`tsc && vitest run`) is the gate before every commit; `npx vitest run <file>` for one file; `npm run build` before a ring step's commit;
  - `npm run simulate -- <flags>`: each run its own `--out` under `logs/` (gitignored) or `--log none`. **Never run two simulations at once** (steps 01, 02, 03, 08–14 run them, in order). Measurements go through the `yomi-measure` agent. Long runs: 100 campaigns took 4 minutes alone in stage 10, up to 20 under load.
- **The 50-campaign check** before committing a domain or simulator step (02, 03, 08–13, 14 if anything changed), against the hash before the step (step 01's, `log.md`), recorded "identical" or the diff in `log.md`:

  ```sh
  npm run simulate -- --campaign --battles 50 --seed 1 --parties 1 --ready-level 7 --near-source --out logs/guard-50.jsonl > logs/guard-50.txt
  shasum -a 256 logs/guard-50.jsonl
  ```

- **The early-game figure.** Stage 10 ended at `one` 288 (331 days, 1.2 dead), `company` 289, `rl10` 409 (533 days), with `--near-source`; `one`, `company` and the days are accepted until stage 12 (`bands.md`). Step 01 re-measures them; step 14 measures again. A move of more than about 5 points is explained in the commit and in `src/game/CLAUDE.md`'s scaling line, or brought to the orchestrator.
- **Commits.** One commit per step once `npm test` passes (and the guard holds), on `long-campaign-stage-11`, without pushing; files staged by path. Messages "Stage 11 step NN: <title>". No attribution lines.

## 3. Dependencies and prerequisites

- None among the plan's steps: this step runs first, on `1a008af` (or the branch head if only plan or feature-record files changed since).
- **Measure names** (`.claude/skills/yomi-balance/bands.md`): `one` `--campaign --parties 1 --ready-level 7 --near-source`; `company` `--campaign --ready-level 7 --near-source`; `rl10` `--campaign --ready-level 10 --near-source` (may pass 9 minutes); `long` `--campaign --log none`, count 100; the cells by their codes' flags (`gr3`, `bc3`, `bc4`, `bc5`, `sn5`, `sp5`, `sg7`, `sg10`, report-only `tl5`; far `bco9`, `bco12`, `fh15`, `fh18`, `sg20-18`, `sg20`). If a name is missing or differs, stop and report: do not invent flags.
- **`yomi-measure`** (`.claude/agents/yomi-measure.md`), spawned per the engineer role: one spawn at a time, given the list of measures to run in order (it refuses to start beside another simulation). If the spawn is refused, a `general-purpose` agent briefed with that agent file's body.
- **Environment:** nothing else running simulations; note other heavy work (browser tests, builds, a sprite step in a worktree) beside the runs, as it inflates wall times.

## 4. Scope and guidance

### 4.1 Measure, in this order

Seed 1, one run at a time, label `s11-01`, logs under `logs/s11-01-*`:
1. **The 50-campaign check** (the command above, `--out logs/s11-01-guard-50.jsonl`), and its SHA-256. Compare with stage 10's `57fdea15…`: identical or not, and if not, the figure (Source wins of 50).
2. **`one`** (500): Source wins, days, battles, heroes dead, spawns, land blighted at the end, sites captured and lost, gold by source; wall time.
3. **`company`** (500): Source wins, days, battles, heroes dead, guard battles, promotions; wall time.
4. **`rl10`** (500): Source wins, days, battles, heroes dead; wall time.
5. **`long`** (100, `--log none`): outcomes (Source, fallen, encampment lost, out of days) and the Source share; days; battles; walking days; final levels (lowest, highest); battles to level 5, 10, 15 and 20 and the campaigns reaching each; deaths by level; the threat table (battles and win rate at each threat, to 20); spawns; the Kit lines (all and forge-ready); gold by source and on forging; trophies taken (expected 0: `TROPHIES` is empty); workshop and post levels at the end; **wall time**.
6. **The standard cells** `gr3`, `bc3`, `bc4`, `bc5`, `sn5`, `sp5`, `sg7`, `sg10`, `tl5`.
7. **The far cells** `bco9`, `bco12`, `fh15`, `fh18`, `sg20-18`, `sg20` (wins of 500, and hit rate and rounds where the summary gives them).

Read every figure from the line `running.md` ("Which line carries each figure") names.

### 4.2 Judge, without tuning

- Against stage 10's final figures (§2): each early figure's change, the long run's, each cell's.
- A move of **more than about 5 points** in `one`, `company` or `rl10`, a standard cell differing from "Now", the long run's Source share moving by more than about 5 of 100, or the 50-campaign hash differing: find the cause as far as the git log allows, and **bring it to the orchestrator** with the figures. Do not revert or change code.
- **Out of band beyond what was accepted** (`one` above 288 + 5 or below 215, `company` outside 220–289 + 5, `rl10` outside 370–420, heroes dead above 2.0, days beyond 331 + 5): bring it to the orchestrator with options. Never change a band.
- The long baseline and the far cells have no band: record them.

### 4.3 Record

- **`log.md`**: a "Step 01: the stage's baseline" heading with the date and code SHA; a table per run (measure, flags, Source wins or cell wins, days, battles, heroes dead, the other figures above, change from stage 10, wall time, log path); the long run's detail tables (battles to level, deaths by level, threat table, Kit lines, gold); the cells table; the 50-campaign SHA-256; what else ran beside each run.
- **The execution record** below: the summary, the judgments, any stop-and-report and its answer, and a short **"Baseline for stage 11"** list that later steps quote: the early figures; the 50-campaign hash (the reference for steps 02, 03 and 08–13); the long baseline's Source share, days, battles, battles to level 5/10/15/20 with campaigns reaching each, ring win rates, run time; the standard and far cells.
- **The index**: row 01's status and commit.

### 4.4 Exclusions

No code change, no tuning, no band or "Now" change, no other plan file than this one, `log.md` and the index's row 01.

## 5. Verification

- Every measure of §4.1 run once, through `yomi-measure`, one at a time; their `.txt` (and the guard's `.jsonl`) under `logs/s11-01-*`.
- Each recorded figure matches its log's line (the reviewer checks).
- `git diff --stat` shows only `docs/implementation-plans/long-campaign-stage-11/` files; `npm test` passes (run it as the gate).

## 6. Completion criteria

- [ ] The 50-campaign hash recorded and compared with stage 10's.
- [ ] `one`, `company`, `rl10` (500, `--near-source`) and `long` (100, `--log none`) measured and recorded in `log.md`, with wall times.
- [ ] The standard and far cells measured and recorded.
- [ ] Each compared with stage 10's final figures; any move over about 5 points, a differing hash or cell, or a figure out of band beyond what was accepted brought to the orchestrator.
- [ ] The "Baseline for stage 11" list in the execution record.
- [ ] One commit, "Stage 11 step 01: the stage's baseline", of this file, `log.md` and the index's row 01 only, files staged by path, no attribution lines; the index's row 01 updated with status and commit.

## 7. Execution record

**Summary (2026-11-26, code `36cf131`; no source change since stage 10's measuring step).** Every figure equals stage 10's final figure and the 50-campaign hash is identical; nothing moved, so nothing to bring to the orchestrator. `one` 288, `company` 289 and `one`'s 331 days stay out of band as accepted until stage 12; `rl10` 409 is in band; heroes dead 1.2. Full tables in [`log.md`](log.md). `yomi-measure`'s first pass failed on a driver-script slip and was rerun whole (no bearing on the figures). The `long` output has no trophy line. No code changed.

**Baseline for stage 11**
- 50-campaign hash (reference for steps 02, 03, 08-13): `57fdea1553a35b1af0e33b74a11ea9fe0a0e2f62ef9e5c80972af59276e53e75` (26 of 50).
- Early (500, `--near-source`): `one` 288 (331 days, 18.8 battles, 1.2 dead), `company` 289, `rl10` 409 (533 days, 34.0 battles).
- Long (100, `--log none`): Source 1 of 100 (1%), fell 97, out of days 2; 1414 days; 42.3 battles; battles to level 5/10/15/20 6.8/28.4/55.9/none in 84/53/16/0 campaigns; win rate by threat 7 0.939, 9 0.785, 12 0.367, 15 0.295; 2271 gold on forging; run time 166 s alone.
- Standard cells: GR3 500, BC3 455, BC4 454, BC5 494, SN5 451, SP5 475, SG7 0, SG10 1; TL5 0.
- Far cells: BCO9 2, BCO12 0, FH15 0, FH18 0, SG20-18 28, SG20 71.

**Review, round 1 (clean).** The sonnet reviewer confirmed every recorded figure against `logs/s11-01-*`; no findings, nothing fixed or disputed. The step's `npm test` gate is runlog #15 (exit 0, 2740 passed, clean head `d113dbf`, run by the reviewer with Node 26 on PATH); the engineer's own run #11 was on a dirty tree.
