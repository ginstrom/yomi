# Step 01: The refactor guard

[Plan index](index.md) · [Stage design](../../designs/long-campaign/stage-05-company-of-one.md) (§5 "The refactor guard comes first", §6 Verification) · [Reference](../../designs/long-campaign/reference/multiple-parties.md) (A1, §7.1 "Refactor guard") · [Stages index](../../designs/long-campaign/index.md) ("The early-game guard")

**Difficulty:** routine. The step runs the simulator, records what it prints, exports one constant and adds one test whose fixture is copied from the unchanged tree. Use `model: "sonnet"` for both the engineer and the reviewer.

## 1. Objective

Fix what "no behaviour change" means for the whole stage, before any stage 5 code changes:
- **The 500-campaign figure.** Measure it on the tree as it stands. Step 10 must reproduce it line for line.
- **The 50-campaign check.** Record its printed summary and its log's SHA-256. Steps 02 to 09 each compare against them.
- **The guard test.** Add a 5-campaign test to `scripts/simulate.test.ts` (C1), whose fixture is this tree's output. It runs in `npm test` from now on, so every later step is checked by the gate itself.

## 2. Requirements and context

- **S5-R5:** no behaviour changes. A seeded simulator run gives an identical summary before and after (reference A1).
- **The design's words:** "Before any change, store the summary of `--campaign --battles 50 --seed 1` as a test fixture in `scripts/simulate.test.ts`, with a short run (about 5 campaigns) for test speed. After each step, the run must match exactly."
  - The plan takes the 5-campaign run as the in-test fixture.
  - The 50-campaign summary and log hash are recorded here, and each later step checks them by hand (index, "The refactor guard").
- **The early-game figure.** It was **230 of 500** after stage 4 (`npm run simulate -- --campaign --battles 500 --seed 1`). `--ready-level` defaults to 7, so the flag is not needed. The stages index's convention is to re-measure at the start of each stage.

### C1. The refactor guard (copied unchanged from the index)

- `scripts/simulate.ts` exports `CAMPAIGN_SEED_STEP` (existing constant, 1000, now exported).
- `scripts/simulate.test.ts` gains `describe('the refactor guard', …)` with one test. It:
  - builds `args = parseArgs(['--campaign', '--battles', '5', '--seed', '1'])`;
  - for `run` 0 to 4, calls `runCampaign(run, (1 + run * CAMPAIGN_SEED_STEP) >>> 0, args, firstBattleId)`, carrying `firstBattleId` forward by each campaign's battle count, as `main` does;
  - compares the list of `CampaignRecord`s with `GUARD_RECORDS`, a literal in the test file, using `toEqual`;
  - compares `sha256(lines.join('\n'))` with `GUARD_EVENTS_SHA256`, a string literal. `lines` is every battle's every event, in order, as `JSON.stringify(event)`, each event carrying its `battleId` as `main` writes it. Use `node:crypto`.
- The fixture is the output of the tree at `4a2b824`, taken before any change. It is never edited after step 01.

### Shared constraints (from the index)

- **Commands** (local Node 26: prefix `PATH=/opt/homebrew/opt/node@26/bin:$PATH`; or the podman `make` targets):
  - `npm test` (`tsc && vitest run`) is the gate before every commit (`make test` is the same in podman);
  - `npx vitest run scripts/simulate.test.ts -t "the refactor guard"` runs only this test;
  - `npm run simulate -- <flags>` (or `make -s simulate ARGS="<flags>"`). Give each run its own `--out` under `logs/`, which is gitignored, so never commit a log. Never run two `make simulate` at once: both build the same image, and the loser prints nothing.
- **The 50-campaign check.** Every step from 02 to 09 runs exactly:

  ```sh
  npm run simulate -- --campaign --battles 50 --seed 1 --out logs/guard-50.jsonl > logs/guard-50.txt
  shasum -a 256 logs/guard-50.jsonl
  ```

  - The printed summary must equal, line for line, the one recorded in this step's execution record.
  - The log's hash must equal this step's.
  - The summary's first line names the `--out` path, so always use this exact path.
- **Determinism.** No step adds, drops or reorders a draw of the world RNG or a battle's RNG. This step changes no behaviour at all: exporting a constant and adding a test move nothing.
- **Commits.** One commit for this step, once `npm test` passes, on `long-campaign-stage-05`, without pushing. Never switch branches. The message ends with the repo's `Co-Authored-By` attribution line.

## 3. Dependencies and prerequisites

- **No step dependency.** This step runs first, on the tree at the plan's commit (code at `4a2b824`), before steps 02 to 10 change code.
- **Environment:** Node 26 at `/opt/homebrew/opt/node@26/bin`, or podman with the repo's image.
- **What later steps use:**
  - `GUARD_RECORDS` and `GUARD_EVENTS_SHA256` in `scripts/simulate.test.ts`. No later step may edit them;
  - the 50-campaign printed summary, verbatim, and the SHA-256 of `logs/guard-50.jsonl`, in this file's execution record;
  - the 500-campaign printed summary, verbatim, and its log's SHA-256, in this file's execution record. Step 10 compares against them;
  - the exported `CAMPAIGN_SEED_STEP`.

## 4. Scope and guidance

1. **Check that the tree has no code changes.** Run `git status`; only the plan's docs may differ. Record `git rev-parse --short HEAD`.
2. **Measure the 500-campaign figure, before touching code:**

   ```sh
   npm run simulate -- --campaign --battles 500 --seed 1 --out logs/s5-baseline-500.jsonl > logs/s5-baseline-500.txt
   shasum -a 256 logs/s5-baseline-500.jsonl
   ```

   - Expect "Beat the Source: 230 of 500". If it differs, record the figure and say so in your report; do not tune anything.
   - Paste the whole printed output and the hash into the execution record. A run takes about a minute and writes some 70 MB.
3. **Run the 50-campaign check** with the exact command in §2. At `4a2b824` the planner measured "Simulated 50 campaigns, 852 battles in all" and "Beat the Source: 23 of 50", in about 28 s. Paste the whole printed output (`logs/guard-50.txt`) verbatim and the hash into the execution record.
4. **Export `CAMPAIGN_SEED_STEP`** from `scripts/simulate.ts`. Change nothing else there.
5. **Produce the fixture** from the same code on the unchanged tree. For example, temporarily print `JSON.stringify(records)` and the hash from the test body, or from a scratch script outside the repository. Paste them into the test as `GUARD_RECORDS` (typed `CampaignRecord[]`) and `GUARD_EVENTS_SHA256`, then remove the temporary code.
   - Keep the literal readable: one record per entry, formatted as the file's other literals are.
   - Put a comment over the fixture saying what it is: the output at `4a2b824`, never to be edited. A mismatch means a step changed behaviour.
6. **Add the test** per C1, in `describe('the refactor guard', …)`.
   - It takes about 2 to 3 seconds. Raise that test's timeout if vitest's default is too short.
   - Do not touch the other tests in the file.

**Out of scope:** any change to the simulator's behaviour, to `runCampaign`, or to the summary's format.

## 5. Verification

- `npx vitest run scripts/simulate.test.ts -t "the refactor guard"` passes.
- **Check the test can fail.** Change one value in `GUARD_RECORDS` (say a `days`) and one character of `GUARD_EVENTS_SHA256`, and see each fail. Then restore both, and see the test pass again. Record this in the execution record.
- `npm test` passes.
- Run the 50-campaign check a second time and see the same summary and hash. This shows the run is deterministic on this machine.

## 6. Completion criteria

- [ ] The 500-campaign summary (expected 230 of 500) and its log's SHA-256 are recorded verbatim below.
- [ ] The 50-campaign summary and the SHA-256 of `logs/guard-50.jsonl` are recorded verbatim below.
- [ ] `CAMPAIGN_SEED_STEP` is exported, and the guard test (C1) with its fixture is in `scripts/simulate.test.ts`, passing, and was seen to fail on an altered fixture.
- [ ] `npm test` passes, and the step is committed as "Stage 5 step 01: the refactor guard", with no log committed.
- [ ] The index's task table shows step 01 as done, with its commit.

## Execution record
