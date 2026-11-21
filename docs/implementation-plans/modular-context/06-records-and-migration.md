# Step 06: records test and the stage 7 record's migration

- **Plan:** [index.md](index.md) (contracts C3, C7; shared constraints). **Design:** [`docs/designs/modular-context.md`](../../designs/modular-context.md) §5.1, §5.2, §5.4, §6 (`records.test.ts`), §8 stage 2.
- **Stage:** 2 (state and history), first of two steps. **Tier:** engineer opus, reviewer opus.

## 1. Objective

Feature records and plan indexes get the state/history split, enforced by a new test. Unfinished records are kept to a small State section and a Decision log, and their history moves to the plan's `log.md`. At the end, `scripts/records.test.ts` passes. The stage 7 record is migrated with no line lost, and this feature's record is in the new shape.

## 2. Requirements and context

- **R6:** a feature record's State section is ≤ 3 KB. The plan index keeps the step table and statuses. History goes to `log.md`, which the orchestrator never reads on resume.
- **R7 (this step's part):** the size caps for records and plan indexes are enforced by a test.
- **Record shape** (design §5.1), `docs/features/<slug>.md`:

  ```markdown
  # Feature: <name>

  ## State
  - Request (user's words): …
  - Slug · Phase · Next action · Branch
  - Links: architecture, design, plan index, plan log
  - Open questions: each with what it blocks
  - Tiers: per role and step; escalations
  - Verification: the latest verdict of each gate (overall review, QA, simulated user, PR review) with its head SHA
  - Carried forward: notes for a later step or stage; removed once used

  ## Decision log
  | Date | Decision | By | Alternatives | Reason |   (one row per decision in force; a superseded row is replaced)
  ```

  - State must be under 3,000 bytes and the whole file under 8,000 bytes.
  - The orchestrator reads the whole record, because decisions in force are state.
  - Everything else goes to the plan's `log.md`: per-step verification lines, review rounds, fix narratives, measurements, superseded decisions.
- **Plan folder shape** (design §5.2):

  | File | Holds | Read by |
  | --- | --- | --- |
  | `index.md` (under 32,000 bytes) | title, links, decisions, shared constraints, contracts, the step table with statuses and commits, order, requirement map, completion criteria, open questions, the note for implementers, and a link to `log.md`. No table that grows as steps finish. | orchestrator, plan-implementer, engineers, reviewers |
  | `NN-*.md` | unchanged, including each step's execution record | that step's engineer and reviewer |
  | `log.md` (uncapped, append-only) | one section per step (date, tier, verdict, review rounds, commands and figures), the measurement tables, the overall-review and QA outcomes, and the feature record's moved history | humans, and a role whose brief names it; never the orchestrator on resume |

- **Migration** (design §5.4):

  | Record or plan | Action |
  | --- | --- |
  | `modular-context` record and plan | in the new shape from the start. The plan is already in it. The record must be too (see §4.3). |
  | `long-campaign-stage-07` record (unfinished: not merged) | migrated here as the worked example. Its index (28 KB, all live) stays as it is. |
  | the other 11 records and 13 plans (done or merged) | none. They are listed as legacy in the test. |

- **No game code, rule, constant or play test changes.** The only code in this step is the new test file.

## 3. Dependencies and prerequisites

- **Step 05 done** (stage 1 closed). This step relies on nothing stage 1 produced, except that `npm test` is green at its head and the plan's `log.md` exists (`docs/implementation-plans/modular-context/log.md`, created with the plan).
- **Existing:** 13 records in `docs/features/` and 14 plan folders in `docs/implementation-plans/`, plus this plan (`modular-context/`), which is not legacy. The vitest `domain` project includes `scripts/**/*.test.ts` (`vitest.config.ts`), and `tsc` covers `scripts/`.
- **Commands:** the default host `node` is 22, so prefix `PATH=/opt/homebrew/opt/node@26/bin:$PATH` (or use `make test`).
- **Not blocked** by the open questions. Step 07 (the global skill edits, [Q2]) follows this step and does not affect it.

## 4. Scope and implementation guidance

### 4.1 `scripts/records.test.ts` (new; contract C3, unchanged)

| Constant | Value |
| --- | --- |
| `STATE_LIMIT_BYTES` | `3_000` (the State section, from `## State` to the next line starting `## `) |
| `RECORD_LIMIT_BYTES` | `8_000` (the whole record) |
| `PLAN_INDEX_LIMIT_BYTES` | `32_000` (each `docs/implementation-plans/*/index.md`) |
| `LEGACY_RECORDS` | `audio-pass`, `auto-resolve`, `battle-cost`, `long-campaign-stage-02` … `-06`, `party-list-and-gear-looks`, `skill-trees`, `ui-feedback-drag-pan-cursor` (the 11 done records) |
| `LEGACY_PLANS` | the 14 existing plan folders: `audio-pass`, `auto-resolve`, `battle-cost`, `defect-fixes`, `long-campaign-stage-01` … `-07`, `party-list-and-gear-looks`, `skill-trees`, `ui-feedback-drag-pan-cursor` |

Write the legacy slugs out in full in the test (`long-campaign-stage-02`, `-03`, `-04`, `-05`, `-06`; plans `-01` to `-07`). Tests:

- Each `docs/features/*.md` whose slug is not in `LEGACY_RECORDS` has a `## State` heading and a `## Decision log` heading. Its State section is under `STATE_LIMIT_BYTES` and the whole file is under `RECORD_LIMIT_BYTES`.
- Each `docs/implementation-plans/*/index.md` whose folder is not in `LEGACY_PLANS` is under `PLAN_INDEX_LIMIT_BYTES`.
- Every slug in `LEGACY_RECORDS` names an existing `docs/features/<slug>.md`, and every slug in `LEGACY_PLANS` names an existing plan folder, so the lists can only shrink.
- After this step, the non-legacy items are the `modular-context` and `long-campaign-stage-07` records, and `modular-context/index.md`.
- Failures name the offending files with their byte counts.
- Top comment: these caps keep what the orchestrator re-reads small. When one fails, move history to the plan's `log.md`; do not raise the limit.
- **Red first:** write the checks as small functions over a directory, such as `recordProblems(dir)` and `planIndexProblems(dir)`. Unit-test each one against a scratch directory made with `mkdtempSync(join(tmpdir(), …))`, holding a record without `## State`, one with a State over 3,000 bytes, one over 8,000 bytes, a 32,001-byte index and a legacy slug that doesn't exist. Watch each fail for the right reason. Then add the real-repository assertions. Those fail on the stage 7 record (8,683 bytes, no `## State`) and possibly on this feature's record until §4.2 and §4.3 are done.
- Keep it Phaser-free, with Node `fs` only and no new dependency. Use `import type` for types (`verbatimModuleSyntax`) and no enums.

### 4.2 Migrate `docs/features/long-campaign-stage-07.md`

The current record (8,683 bytes) has these sections: title, Slug/Phase lines, Request (user's words), Links, Path, Decision log (table), Open questions, Tiers, Verification, Carried forward.

- **New record** has `## State` (under 3,000 bytes) and `## Decision log`:
  - State holds the request in the user's words, the slug, the phase (6, done on branch `17cc2e3..6405b5c`, not pushed, or the record's current wording), the next action and the branch.
  - Links: stages overview, design, reference, previous stage, plan index, and the new plan `log.md`. The Path line ("stage design is the approved design; straight to planning") goes in as one short line or as its Decision log row.
  - Open questions: the AGENTS.md question, marked resolved by `f0814da` (AGENTS.md is now a symlink to CLAUDE.md).
  - Tiers: a compact line per role and step.
  - Verification: only the latest verdict of each gate with its head SHA (overall review, QA, simulated user, PR review, and the fix round's re-review if that is the latest review verdict).
  - Carried forward: keep only the notes still live for stage 8 or later. These include the simulator's spend order and the follow-ups for the user, the Lodge level 3 sprite to redraw in stage 8, the `forecast.test.ts` timeout under full-suite load, and the sprite-tool pin drift (v0.6.0 pinned, host 0.7.0). Use judgement on wording.
  - The Decision log table stays, one row per decision in force.
- **New `docs/implementation-plans/long-campaign-stage-07/log.md`** (append-only, contract C7 shape). Its header says it holds the history moved from the feature record. Move into it:
  - every per-step Verification line (baseline, 01–07, the overall review, QA, PR review, the simulated user, the fix rounds);
  - the "done in step 07" carried-forward notes and any note already used;
  - any superseded decision.
  Move the lines verbatim. You may group them under headings, such as `## Verification (moved from the feature record)` and `## Carried forward, used`.
- `docs/implementation-plans/long-campaign-stage-07/index.md` is **not changed** (it stays in `LEGACY_PLANS`).
- **Line-set check** (scratch script outside the repository, never committed):
  1. Take every non-blank line of `git show HEAD:docs/features/long-campaign-stage-07.md`. Trim surrounding whitespace.
  2. Report each line that does not appear verbatim as a line, or as a substring of a line, in the new record or in the new `log.md`.
  The list must be empty, or each entry is justified. Acceptable justifications: a reformatted heading or the `**Slug:**`/`**Phase:**` lines folded into one State bullet, with the old text quoted and where it went. Record the command and its result in this plan's `log.md`.

### 4.3 `docs/features/modular-context.md`

This is the orchestrator's record. It is untracked until step 01 commits it, and the orchestrator may already have reshaped it. Check it against §5.1 and C3.

- If it already has `## State` and `## Decision log` within the limits, leave it alone.
- Otherwise reshape it to §5.1:
  - Turn the bulleted decision log into the table.
  - Keep the request and the approved proposal's essentials within the limits. The proposal may be cut to one line linking the design, which now holds it.
  - Move anything that is history (verification lines, superseded entries) to `docs/implementation-plans/modular-context/log.md`.
  - Say so in your report, so the orchestrator knows its record changed.

### 4.4 Out of scope

- No edits to the 11 legacy records, the 14 plans' indexes or task files (apart from creating stage 7's `log.md`), or the global skills. The global skills are step 07's.
- `scripts/claudeMd.test.ts` is not changed in this step.

## 5. Verification

- `PATH=/opt/homebrew/opt/node@26/bin:$PATH npx vitest run scripts/records.test.ts`:
  - the fixture tests fail before the checks are written (red), then pass;
  - the real-repository assertions fail on the old stage 7 record and pass after the migration.
- `wc -c docs/features/long-campaign-stage-07.md docs/features/modular-context.md docs/implementation-plans/modular-context/index.md` must show each under its limit. Also measure each record's State section and record its bytes in `log.md`.
- The line-set check prints nothing, or only justified entries.
- `PATH=/opt/homebrew/opt/node@26/bin:$PATH npm test` passes.
- `git diff --stat` touches only `scripts/records.test.ts`, `docs/features/long-campaign-stage-07.md`, `docs/implementation-plans/long-campaign-stage-07/log.md`, this plan's `index.md`, `log.md` and this task file, and `docs/features/modular-context.md` if it was reshaped.

## 6. Completion criteria

- [x] `scripts/records.test.ts` exists with the C3 constants and legacy lists exactly as above. Each check was seen failing first.
- [x] The stage 7 record has State under 3,000 bytes and the whole file under 8,000. It has `## State` and `## Decision log`. Its history is in `docs/implementation-plans/long-campaign-stage-07/log.md`. Its index is unchanged.
- [x] The line-set check result is in this plan's `log.md`.
- [x] `docs/features/modular-context.md` passes the test. The report says whether this step reshaped it.
- [x] `npm test` is green, committed as `Modular context step 06: records test and the stage 7 record's migration` (no attribution lines, files staged by path, not pushed).
- [x] Index: step 06 `done` with its commit. `log.md`: a `## Step 06` section (date, tiers, verdict, review rounds, commands and results, the record sizes).

## 7. Execution record

- 2026-11-21, engineer opus. Baseline `npm test`: 97 files, 2,407 passed.
- `scripts/records.test.ts` written with the C3 constants and legacy lists in full. Red: with the checks stubbed, the 5 fixture tests that expect problems failed. Real-repository check failed on the old stage 7 record (no State, 8,683 bytes) and on `modular-context.md` (no State). Green after the migration: 10 passed. `npm test`: 98 files, 2,417 passed.
- Stage 7 record migrated: 4,013 bytes, State 2,640. History moved verbatim to the new `docs/implementation-plans/long-campaign-stage-07/log.md` (6,298 bytes); its index is unchanged. The line-set check found 6 lines (folded Slug/Phase/Branch lines, three headings), all justified in this plan's `log.md`.
- `docs/features/modular-context.md` **was reshaped** (it had no `## State`): 3,475 bytes, State 1,472. Its proposal, header bullets, bulleted decision log and Verification text moved verbatim to this plan's `log.md`.
- Deviations: none from the task. Noted: the stage 7 record names a next action (push and open a PR), taken from its in-force user decision; the branch now also carries the modular-context commits.
- For later steps: step 07's global edits make every new record follow this shape; `records.test.ts` enforces it only for records and plans not in its legacy lists.
