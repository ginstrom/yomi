# Step 01: The stage's baseline

[Plan index](index.md) · [Stage design](../../designs/long-campaign/stage-10-forging-and-high-tiers.md) (§6 Simulator, §7 Risks) · [Stages index](../../designs/long-campaign/index.md) ("The early-game guard") · [Balance skill](../../../.claude/skills/yomi-balance/SKILL.md) (`bands.md`, `running.md`, `guards.md`) · [Stage 9's measuring step](../long-campaign-stage-09/09-measure.md) · [Plan log](log.md)

**Difficulty:** sonnet / sonnet. The engineer (`model: "sonnet"`) runs fixed measures through `yomi-measure` and records them; it changes no code and judges no balance beyond flagging moves. The reviewer (`model: "sonnet"`) checks each figure against the line `running.md` names in its log.

## 1. Objective

Measure the stage's starting point on the code as it stands (`f3a1102`), before any stage-10 change:
- the early figures `one`, `company` and `rl10` (500 campaigns each, with `--near-source`);
- the 50-campaign check's hash, which step 02 compares against;
- the long baseline (`long`, 100 campaigns, `--log none`): the kit-free figures stage 10's gear is judged against in step 10.

Compare each with stage 9's final figures and say what moved since. Change no code.

## 2. Requirements and context

- **Stages index, "The early-game guard":** every stage keeps the current campaign figure; it is re-measured at the start of each stage, because a previous stage's retune may have moved it. From stage 9 on it is measured with `--ready-level 7 --near-source`.
- **Design §6 Simulator:** (1) the early-game guard; (2) the long campaign (100 campaigns): gear tiers at levels 5, 10, 15 and 20 against the expected kit, and "compare the Source share and the battles to level with stage 9's baseline". This step supplies the baseline those comparisons start from on today's code.
- **Code moved after stage 9's measuring step** (`f1e50ed`): `git log --oneline f1e50ed..HEAD -- src scripts` lists, among scene-only commits, `6b51b72` "World map: build the Source at its own position, no stale coordinates" and `76b0cf5` "Debug spawn: reuse the computed threat". Whether these move play is what this step finds out.

### Stage 9's final figures (from `bands.md` and stage 9's step 09 record)

- Early (seed 1, 500, `--near-source`): `one` 288 of 500 (331 days, 18.8 battles, 1.2 heroes dead), `company` 289, `rl10` 409 (530 days). `one`, `company` and `one`'s days are out of band and **accepted by the user until stage 12**; `rl10` is in band (370–420).
- Long (100, seed 1, `--log none`, `SOURCE_FOE_LEVEL` 6): 15 of 100 beat the Source, 85 fell; 1272 days, 46.4 battles; levels 5/10/15/20 reached after 6.8/28.5/54.3/— battles in 84/55/44/0 campaigns; win rate by ring 7 0.956, 9 0.828, 12 0.601, 15 0.868, 18 0.75 (4 fought), 20 0.833; run time about 10 minutes (step 08: 10:21).
- 50-campaign check: `57fdea1553a35b1af0e33b74a11ea9fe0a0e2f62ef9e5c80972af59276e53e75` (stage 9 step 09).

### Shared constraints (from the index, unchanged)

- **Commands** (local Node 26: prefix `PATH=/opt/homebrew/opt/node@26/bin:$PATH`; or the podman `make` targets):
  - `npm test` (`tsc && vitest run`) is the gate before every commit; `npx vitest run <file>` for one file;
  - `npm run simulate -- <flags>`: each run its own `--out` under `logs/` (gitignored) or `--log none`. **Never run two simulations at once** (steps 01, 02, 03, 04, 07, 09 and 10 run them, in that order). Measurements go through the `yomi-measure` agent where a step says so. Long runs: 100 campaigns take about 10 minutes alone, up to 20 under load.
- **The 50-campaign check** before committing a domain or simulator step (02, 03, 04, 07, 09, 10 if it retunes), against a hash taken before the step (step 01's for step 02), recorded as "identical" or the diff in `log.md`:

  ```sh
  npm run simulate -- --campaign --battles 50 --seed 1 --parties 1 --ready-level 7 --near-source --out logs/guard-50.jsonl > logs/guard-50.txt
  shasum -a 256 logs/guard-50.jsonl
  ```

- **The early-game figure.** Stage 9 ended at `one` 288 (days 331), `company` 289, `rl10` 409, accepted by the user until stage 12 (`bands.md`). **Step 01 re-measures `one`, `company`, `rl10` and the long baseline before any change** (code moved after stage 9's measuring step). Steps 09 and 10 measure again with `--near-source`. A move of more than about 5 points from step 01's figure is explained in the commit and in `src/game/CLAUDE.md`'s scaling line, or retuned; **any figure out of the user's bands, or further out than accepted, is brought to the orchestrator with options, never tuned away silently.** The user's bands (`.claude/skills/yomi-balance/bands.md`) are never changed; only "Now".
- **Commits.** One commit per step once `npm test` passes (and the guard holds as above), on `long-campaign-stage-10`, without pushing; files staged by path. Messages "Stage 10 step NN: <title>". No attribution lines.

## 3. Dependencies and prerequisites

- None among the plan's steps: this step runs first, on `f3a1102` (or the stage branch's head if only plan or feature-record files changed since; check `git log f3a1102..HEAD -- src scripts` is empty, else name the commits and measure on the head anyway).
- **Measure names** (`.claude/skills/yomi-balance/bands.md`): `one` `--campaign --parties 1 --ready-level 7 --near-source`; `company` `--campaign --ready-level 7 --near-source`; `rl10` `--campaign --ready-level 10 --near-source` (may pass 9 minutes); `long` `--campaign --log none`, count 100. If a name is missing or differs, stop and report: do not invent flags.
- **`yomi-measure`** (`.claude/agents/yomi-measure.md`), spawned per the engineer role: one spawn at a time, given the list of measures to run in order (it refuses to start beside another simulation). If the spawn is refused, a `general-purpose` agent briefed with that agent file's body.
- **Environment:** nothing else running simulations; note any other heavy work (browser tests, builds) beside the runs, as it inflates wall times.

## 4. Scope and guidance

### 4.1 Measure, in this order

Seed 1, one run at a time, label `s10-01`, logs under `logs/s10-01-*`:
1. **The 50-campaign check** (the index's command; `--out logs/s10-01-guard-50.jsonl`), and its SHA-256. Compare with stage 9's `57fdea15…`: identical or not, and if not, the figure (Source wins of 50).
2. **`one`** (500): Source wins, days, battles, heroes dead, spawns, land blighted at the end, sites captured and lost, gold by source; wall time.
3. **`company`** (500): Source wins, days, battles, heroes dead, guard battles, promotions; wall time.
4. **`rl10`** (500): Source wins, days, battles, heroes dead; wall time.
5. **`long`** (100, `--log none`): outcomes (Source, fallen, encampment lost, out of days) and the Source share; days; battles; walking days (`vanguardWalkDays`, `vanguardWalkHomeDays`); final levels (lowest, highest); battles to level 5, 10, 15 and 20 and the campaigns reaching each; deaths by level; the threat table (battles and win rate at each threat, to 20); spawns; sites captured, lost and held; gold by source and gold on gear and runes; trading post, workshop and infirmary levels at the end; tier-two items bought; runes found, bought, fused and sockets filled; **wall time**.

Read every figure from the line `running.md` ("Which line carries each figure") names.

### 4.2 Judge, without tuning

- Against stage 9's final figures (§2): each early figure's change, and the long run's.
- A move of **more than about 5 points** in `one`, `company` or `rl10`, or in the long run's Source share by more than about 5 of 100, or the 50-campaign hash differing: find the cause as far as the git log allows (the commits since `f1e50ed` over `src/` and `scripts/`; for example `6b51b72`), and **bring it to the orchestrator** with the figures. Do not revert or change code.
- **Out of band beyond what was accepted** (`one` above 288 + 5 or below 215, `company` outside 220–289 + 5, `rl10` outside 370–420, heroes dead above 2.0, days beyond 331 + 5): bring it to the orchestrator with options. Never change a band.
- The long baseline has no band: record it.

### 4.3 Record

- **`log.md`**: a "Step 01: the stage's baseline" heading with the date and code SHA; a table per run (measure, flags, Source wins, days, battles, heroes dead, the other figures above, change from stage 9, wall time, log path); the long run's detail tables (battles to level, deaths by level, threat table, gear and runes); the 50-campaign SHA-256; what else ran beside each run.
- **The execution record** below: the summary, the judgments, any stop-and-report and its answer, and a short **"Baseline for stage 10"** list that later steps quote: the early figures; the 50-campaign hash (step 02's reference); the long baseline's Source share, days, battles, battles to level 5/10/15/20, ring win rates, run time, and the kit-free gear figures (workshop level, tier-two items bought, sockets filled) that step 10 compares the gear policy against.
- **The index**: row 01's status and commit.

### 4.4 Exclusions

No code change, no tuning, no band or "Now" change (step 10 updates "Now"), no other plan file than this one, `log.md` and the index's row 01.

## 5. Verification

- Every measure of §4.1 run once, through `yomi-measure`, one at a time; their `.txt` (and the guard's `.jsonl`) under `logs/s10-01-*`.
- Each recorded figure matches its log's line (the reviewer checks).
- `git diff --stat` shows only `docs/implementation-plans/long-campaign-stage-10/` files; `npm test` passes (no code changed, so it shows nothing new; run it as the gate).

## 6. Completion criteria

- [ ] The 50-campaign hash recorded, and compared with stage 9's.
- [ ] `one`, `company`, `rl10` (500, `--near-source`) and `long` (100, `--log none`) measured and recorded in `log.md`, with wall times.
- [ ] Each compared with stage 9's final figures; any move over about 5 points, a differing hash, or a figure out of band beyond what was accepted brought to the orchestrator.
- [ ] The "Baseline for stage 10" list in the execution record.
- [ ] One commit, "Stage 10 step 01: the stage's baseline", of this file, `log.md` and the index's row 01 only, files staged by path, no attribution lines; the index's row 01 updated with status and commit.

## 7. Execution record

Measured 2026-11-23 on `f3a1102` through `yomi-measure` (seed 1, label `s10-01`); tables in [log.md](log.md). No code changed; no stop-and-report.

**Judgments.** Every figure equals stage 9's final: the 50-campaign hash is identical, `one` 288 (331 days, 1.2 dead), `company` 289, `rl10` 409 (530 days), long 15 of 100. So `6b51b72` and `76b0cf5` moved no play. No move over 5 points. Out-of-band figures (`one`, `company`, days) are the ones the user accepted until stage 12; `rl10` is in band; heroes dead 1.2-1.3 is under 2.0.

**Baseline for stage 10**
- Early (500, `--near-source`): `one` 288 / 331 days / 18.8 battles / 1.2 dead; `company` 289; `rl10` 409 / 530 days.
- 50-campaign hash (step 02's reference): `57fdea1553a35b1af0e33b74a11ea9fe0a0e2f62ef9e5c80972af59276e53e75` (26 of 50).
- Long (100, `--log none`): Source 15 of 100 (85 fell); 1272 days; 46.4 battles; battles to level 5/10/15/20 6.8/28.5/54.3/none in 84/55/44/0 campaigns; ring win rates 7 0.956, 9 0.828, 12 0.601, 15 0.868, 18 0.75 (4 fought), 20 0.833; wall time 3:48 alone (faster than the ~10 min the plan assumed).
- Kit-free gear figures: workshop level 1.8 at the end; tier-2 items bought 4.3 a campaign; sockets filled 1.7 at the end (runes 44.6 found, 3.4 bought, 2.4 fused); 2234 gold on gear.
- Wall times: guard-50 ~1 min, `one` 4:19, `company` 5:07, `rl10` 9:41.
