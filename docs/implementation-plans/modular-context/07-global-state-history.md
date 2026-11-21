# Step 07: the state/history split in the global skills

- **Index:** [index.md](index.md) (contracts C6, C7; "Global skills" constraint). **Design:** [`docs/designs/modular-context.md`](../../designs/modular-context.md) §5.3, §5.4, §8 (stage 2), R6, R11.
- **Suggested tier:** engineer opus, reviewer opus.
- **Tag [Q2]:** this step applies the default answer to the user's question 2: the orchestrator's move of per-step verification lines into `log.md` applies to **every project**.

## 1. Objective

Make the shared global skills write and read the new record and plan shape (design §5): a feature record holds State plus a decision log, and history goes to the plan's `log.md`. Apply exactly the four edits in design §5.3 to files in `/Users/ryan/.claude/skills/`, then record the restricted diff in this plan's `log.md`. The step's commit carries only `log.md` and `index.md`, because the global skills are not in git.

## 2. Requirements and context

- **R6:** a feature record's State is ≤ 3 KB, the plan index keeps the step table and statuses, and history goes to `log.md`, which the orchestrator never reads on resume. The global skills must write and read this shape.
- **R11:** every edit to a global skill is generic, backward compatible and small, with the exact text given below. Nothing else in the global skills changes in this step. Step 09 adds the role hooks and the AGENTS.md wording, and this step must not make any of those changes.
- **Backward compatibility (design §5.3):** a plan without `log.md` gets one on first use. An old record is trimmed by the existing resume rule. `pr-reviewer` still finds QA results in the record's State (the latest verdict with its SHA), so `pr-reviewer` is not edited.
- The global skills live at `/Users/ryan/.claude/skills/`, outside git. The backup is `/Users/ryan/.claude/skills-backup-2026-11-21/`. Never edit the backup.
- Shared constraints: commits go on the current branch (`long-campaign-stage-07`) and are never pushed. The message is `Modular context step 07: <title>`, with no attribution lines. Stage files by path. Node 26 runs with the prefix `PATH=/opt/homebrew/opt/node@26/bin:$PATH`.

## 3. Dependencies and prerequisites

- **Step 06 is done** (it is in the index as `done`). It produced `scripts/records.test.ts`, which enforces the State/record/index caps (C3), and a migrated `long-campaign-stage-07` record together with its `docs/implementation-plans/long-campaign-stage-07/log.md`. That migration is the worked example of the shape these edits describe. This step does not depend on any code from 06. It only needs 06's commit to be in place, so that `npm test` is green before you start.
- **Check before editing:** run `diff -ru /Users/ryan/.claude/skills-backup-2026-11-21 /Users/ryan/.claude/skills`. Within the backed-up directories (`architect`, `browser-qa`, `designer`, `orchestrator`, `plan-implementer`, `planner`, `pr-reviewer`, `qa`), it must show no differences. The backup lacks `browser-auth`, `linear`, `pr-creator`, `recursive-slack`, `simulated-user`, `synced`, `technical-report-writing` and `.trash`, so ignore their "Only in" lines. If another difference already exists, stop and report it, because someone else changed the skills.
- **[Q2] if the user answers "Yomi only":**
  - Do not make edit 1 (the orchestrator). The record/log rule then goes into `.claude/roles/orchestrator.md` in step 08 instead.
  - Whether edits 2–4 (planner, `implement-step.md`, `step-loop.md`) still apply globally is a separate decision, because they also change other projects' plans. Recommendation: ask the user. If there is no answer, keep edits 2–4, since they are additive and harmless where `log.md` is absent.
  - If this question is still open when the step starts, proceed on the default ("every project") and say so in the execution record.

## 4. Scope and implementation guidance

Edit these four files only. In each edit, the old text was inspected in the current files on 2026-11-21. Match it exactly. If the old text differs, stop and report.

### Edit 1: `/Users/ryan/.claude/skills/orchestrator/SKILL.md`

**1a. "The feature record" section.** The current section reads:

> Keep one file per feature at `docs/features/<slug>.md` (follow project conventions if they place such records elsewhere). Create it at intake and update it at every phase change, decision and escalation. It holds:
>
> - the request in the user's words, the slug, and the current phase
> - links to the architecture brief, design, plan index, and branch or worktree
> - a **decision log**: each decision, who made it (user or orchestrator), the alternatives, and the reason
> - open questions, and what each one blocks
> - the model tier chosen per role and step, with escalations
> - verification outcomes: one line per step (tier, verdict, rounds), and the QA and simulated-user verdicts with the head SHA they ran against
> - notes carried forward to a later step, removed once that step has used them
>
> You reread the record on every resume, so keep it an index, not a log. Findings, test counts, commit lists and fix narratives already live in the task files' execution records, the plan index and the review record; link to them instead of copying them. Replace a superseded entry rather than striking it through. When you resume a record that has grown into a log, trim it to this shape first and commit the trim on its own.
>
> Commit the record with the documents it describes. Before implementation starts, commit it yourself, or leave it to the first engineer, who carries plan-folder files into its commit (see `implement-step.md`).

The design says to "replace the bullet list and the two paragraphs after it ('You reread…', 'Commit the record…' stays)". That wording is ambiguous: only one paragraph after the list is replaced. It is resolved as follows:

- Keep the first sentence pair, and drop the lead-in "It holds:". The opening paragraph ends at "…decision and escalation."
- Replace the seven bullets and the "You reread the record…" paragraph with the two paragraphs below.
- Keep the "Commit the record…" paragraph unchanged, after the new text.

The new text, verbatim from design §5.3:

> It has two parts. **State**, at the top, kept under about 3 KB: the request in the user's words, the slug, the phase and the next action; links to the architecture brief, design, plan index, plan `log.md`, and branch or worktree; open questions and what each blocks; the tier per role and step, with escalations; the latest verdict of each verification gate with its head SHA; and notes carried forward, removed once used. **Decision log**, below it: one row per decision in force (the decision, who made it, the alternatives, the reason). Replace a superseded row.
>
> History goes in the plan's `log.md` (`docs/implementation-plans/<slug>/log.md`), not the record: each step's verification line (tier, verdict, rounds), review and QA outcomes, fix narratives, measurements. Append to it; don't read it on resume. Findings, test counts and commit lists already in task files and the review record are linked, not copied. When you resume a record that has grown into a log, move its history to `log.md`, trim it to this shape, and commit that on its own.

"It has two parts." may start a new paragraph after "…decision and escalation." or follow it in the same paragraph. Either is fine, as long as the result reads as one continuous section.

**1b. Phase 4 ("### 4. Implementation"):** change the sentence

> Record each escalation and each step's verdict in the feature record.

to

> Record each escalation in the feature record and each step's verdict in the plan's `log.md`.

Change nothing else in the orchestrator in this step. Phase 0, "Roles" and the AGENTS.md wording are step 09's.

### Edit 2: `/Users/ryan/.claude/skills/planner/SKILL.md`

**2a. "Create the plan folder", the folder sketch.** Add `log.md` after `index.md`:

```text
<feature-slug>/
  index.md
  log.md
  01-<step-slug>.md
  02-<step-slug>.md
  ...
```

**2b. "Write index.md".** Add this bullet to the "Include:" list, before the implementers' bullet:

> - Keep the index to what decides the next step. Anything that grows as steps finish (measurements, run histories, review summaries) goes in `log.md` in the plan folder, which the index links.

**2c. The implementers' bullet.** It currently reads:

> - A brief instruction for implementers: update the step's status and commits here, and record evidence, deviations and blockers in the task file's execution record. Keep the index short; every implementer reads it.

Extend it so that it reads:

> - A brief instruction for implementers: update the step's status and commits here, and record evidence, deviations and blockers in the task file's execution record, and anything the plan as a whole accumulates in `log.md`. Keep the index short; every implementer reads it.

Change nothing else in the planner. Its "Establish the source of truth" bullet (the AGENTS.md wording and the hook) is step 09's.

### Edit 3: `/Users/ryan/.claude/skills/plan-implementer/implement-step.md`, "## Complete"

The section has three bullets: "Run every verification check…", "Confirm each completion criterion…", and "Append an **Execution record**…". Add a fourth bullet after the third:

> - Put figures and histories the plan accumulates (measurements, run tables) in the plan's `log.md`, not the index; create it if absent.

Leave the "Report:" paragraph that follows unchanged.

### Edit 4: `/Users/ryan/.claude/skills/plan-implementer/step-loop.md`

**4a. "## Overall review", last sentence.** Change

> The outcome goes in the index's execution notes, committed by the engineer.

to

> The outcome goes in the plan's `log.md`, committed by the engineer.

**4b. "## Each step", item 6 ("Confirm").** It currently reads:

> 6. **Confirm.** The index marks the step `done`, the task file's execution record includes the review rounds, and the working tree is clean apart from changes that predate the run.

Add the outcome line to it:

> 6. **Confirm.** The index marks the step `done`, the task file's execution record includes the review rounds, and the step's outcome line is in `log.md`, and the working tree is clean apart from changes that predate the run.

Light rewording is allowed for grammar, such as joining the two "and"s with a comma. Keep the meaning.

### Exclusions

- No other global file changes, including `review-step.md`, `plan-implementer/SKILL.md`, `pr-reviewer`, `qa`, `designer` and `architect`. In particular, add no hook lines, no agent-types line and no AGENTS.md wording, because those are step 09's.
- No repository file changes except this plan's `log.md`, `index.md` and this task file's execution record.

## 5. Verification

1. **Restricted diff:**

   ```sh
   diff -ru /Users/ryan/.claude/skills-backup-2026-11-21 /Users/ryan/.claude/skills | grep -v '^Only in /Users/ryan/.claude/skills: '
   ```

   Expected: hunks only in `orchestrator/SKILL.md`, `planner/SKILL.md`, `plan-implementer/implement-step.md` and `plan-implementer/step-loop.md`, containing exactly the lines of edits 1–4. There must be no "Only in" line under a backed-up directory. Paste the full output into `log.md` under `## Step 07: the state/history split in the global skills`, in a fenced `diff` block.
2. **Read-through:** read the edited sections of each of the four files once. Check that "The feature record" reads as one coherent section (no orphaned "It holds:", and "Commit the record…" is still present), and that no sentence is duplicated.
3. **Tests:** run `PATH=/opt/homebrew/opt/node@26/bin:$PATH npm test`, which must pass. The repository's only changes are Markdown under `docs/implementation-plans/modular-context/`, so the tests confirm the plan index still fits `records.test.ts`'s 32,000-byte cap.

## 6. Completion criteria

- [ ] The pre-edit diff showed no difference within the backed-up directories, or the step stopped and reported.
- [ ] Edits 1a, 1b, 2a, 2b, 2c, 3, 4a and 4b are applied with the text above.
- [ ] The restricted diff shows only those lines, and it is pasted into `log.md` with the date, tiers, verdict and review rounds (C7).
- [ ] `npm test` passes.
- [ ] The index row for 07 is `done` with its commit, and the commit (`Modular context step 07: state/history split in the global skills`) contains only `docs/implementation-plans/modular-context/log.md`, `index.md` and this file's execution record.
- [ ] The execution record notes the [Q2] answer the step ran on.

## 7. Execution record
