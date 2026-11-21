# Step 09: role hooks in the global skills

- **Plan:** [index.md](index.md) · **Design:** [`docs/designs/modular-context.md`](../../designs/modular-context.md) §4.7, §8 (stage 3) · **History:** [log.md](log.md)
- **Stage:** 3 (closes it). **Suggested tier:** engineer opus, reviewer opus.

## 1. Objective

Make every global role skill read the project's role profile when it exists. To do that, add one generic hook sentence to eight global skill files, one agent-types line to the orchestrator, and change the "CLAUDE.md and AGENTS.md" wording so a linked pair is read once. Then show with a smoke check that a fresh engineer subagent picks up `.claude/roles/engineer.md` and the skill file its task names. Nothing in the repository changes except `log.md` and this plan's index.

## 2. Requirements and context

- **R8:** role profiles in `.claude/roles/` (written in step 08), and one generic hook line in each global role skill.
- **R11:** every edit to a global skill is generic, backward compatible and small, and uses exactly the text below. The edits must make sense in any project. If `.claude/roles/<role>.md` is absent, the hook does nothing.
- The global skills live in `/Users/ryan/.claude/skills/` and are **not in git**. A backup of them is at `/Users/ryan/.claude/skills-backup-2026-11-21/`. Step 07 already made the design §5.3 edits (the feature record's State and Decision log, `log.md` in the planner, implement-step and step-loop). Leave those edits as they are.
- **Acceptance (design §2, §8 stage 3):** the restricted diff against the backup shows only the §5.3 lines (from step 07) and this step's lines; `npm test` passes; the smoke check passes.

### 2.1 The hook sentence (exact)

The same sentence goes in every file, with `<role>` replaced as the table says:

> Also read `.claude/roles/<role>.md` at the project root if it exists: the project's notes for this role.

| Global file (under `/Users/ryan/.claude/skills/`) | Where | `<role>` |
| --- | --- | --- |
| `orchestrator/SKILL.md` | Phase 0 ("### 0. Intake"): in the "Otherwise read the request…" bullet, and in the resume bullet ("With a slug or no argument, resume: …") | `orchestrator` |
| `architect/SKILL.md` | "Ground the brief", first bullet | `architect` |
| `designer/SKILL.md` | "Ground the design", first bullet | `designer` |
| `planner/SKILL.md` | "Establish the source of truth", first bullet | `planner` |
| `plan-implementer/implement-step.md` | "Start", first bullet | `engineer` |
| `plan-implementer/review-step.md` | "Sources" (the paragraph under it) | `reviewer` |
| `qa/SKILL.md` | "Prepare", first bullet | `qa` |
| `pr-reviewer/SKILL.md` | "Establish the scope", the "Read applicable CLAUDE.md…" bullet | `pr-reviewer` |

Add the sentence at the end of the named bullet or paragraph. In the orchestrator it goes in both bullets, so a resumed run reads the profile as well. Do not change `browser-qa`, which already reads its own profile (`.claude/browser-qa/`). There is no `architect.md` profile (design assumption 7); the hook is still added, for uniformity, and does nothing while the file is absent.

### 2.2 The agent-types line (exact)

In `orchestrator/SKILL.md`, section "## Roles", add this as its own sentence or paragraph directly after the sentence "Spawn workers as `general-purpose` agents and set `model` on every spawn.":

> If the project defines agent types in `.claude/agents/` for a job (such as measurements), use them for it.

### 2.3 The AGENTS.md wording

Replace the phrase in each listed file so that it reads **"applicable CLAUDE.md or AGENTS.md instructions (once if one links to the other)"**, with the word "instructions" appearing **once**. The replacement takes in any "instructions" already in the sentence. The phrases below are as they appeared when this plan was written; check them again before editing.

| File | Current phrase | Note |
| --- | --- | --- |
| `architect/SKILL.md` (line 13) | "applicable CLAUDE.md and AGENTS.md instructions" | |
| `designer/SKILL.md` | "applicable CLAUDE.md (and AGENTS.md) instructions" | |
| `planner/SKILL.md` | "applicable CLAUDE.md (and AGENTS.md) instructions" | |
| `qa/SKILL.md` | "applicable CLAUDE.md and AGENTS.md instructions" | |
| `pr-reviewer/SKILL.md` | "Read applicable CLAUDE.md and AGENTS.md instructions" | keep "Read" |
| `orchestrator/SKILL.md`, Phase 0 | "applicable CLAUDE.md and AGENTS.md" | no "instructions" now; add it once |
| `plan-implementer/SKILL.md` | "applicable CLAUDE.md or AGENTS.md" | add "instructions" once |
| `plan-implementer/implement-step.md` | "applicable CLAUDE.md or AGENTS.md" | add "instructions" once |
| `plan-implementer/review-step.md` | "applicable CLAUDE.md or AGENTS.md" | add "instructions" once |

Other mentions of AGENTS.md **stay unchanged**: `pr-reviewer/run-checks.md`, `pr-reviewer/crisp-check.md`, `browser-qa/SKILL.md` and `linear/SKILL.md`.

## 3. Dependencies and prerequisites

- **Step 07 (done before this):** the design §5.3 edits are in the global skills, and its restricted diff is in `log.md`. This step's diff therefore contains both sets of edits.
- **Step 08 (done before this):** `.claude/roles/orchestrator.md`, `designer.md`, `planner.md`, `engineer.md`, `reviewer.md`, `qa.md` and `pr-reviewer.md` exist, and `scripts/claudeMd.test.ts` caps each at `ROLE_LIMIT_BYTES` (`4_000`). The smoke check needs `.claude/roles/engineer.md` to exist and to tell the engineer to read the skill files its task names.
- **Steps 03–04:** `.claude/skills/yomi-add-content/spell.md` exists. The smoke check uses it.
- **Before you edit:** check that the backup holds every directory you will edit: `orchestrator`, `architect`, `designer`, `planner`, `plan-implementer`, `qa` and `pr-reviewer`. The backup has no `browser-auth`, `linear`, `pr-creator`, `recursive-slack`, `simulated-user`, `synced`, `technical-report-writing` or `.trash`, and you must not edit any of those.

## 4. Scope and implementation guidance

- **Edit:** only the nine global files named in §2.1–§2.3. Make them with Edit (exact string replacement), not sed, so that each change is the exact text.
- **Repository:** change only `docs/implementation-plans/modular-context/log.md` (append this step's section) and `index.md` (status and commit). Do not edit any `.claude/` file, `CLAUDE.md` or code.
- **Keep it generic.** Nothing Yomi-specific goes into a global file: no `yomi-` names and no Yomi paths.
- **Do not** add the hook to `plan-implementer/SKILL.md` or `step-loop.md`, which are not in the table. Only the AGENTS.md phrase changes in `plan-implementer/SKILL.md`.
- Where a bullet gets both the AGENTS.md change and the hook (architect, designer, planner, qa, pr-reviewer, orchestrator Phase 0, implement-step, review-step), the bullet must still read as one coherent instruction.

## 5. Verification

1. **Restricted diff.** Run:
   ```sh
   diff -ru /Users/ryan/.claude/skills-backup-2026-11-21 /Users/ryan/.claude/skills | grep -v '^Only in /Users/ryan/.claude/skills: '
   ```
   It must show only:
   - the design §5.3 lines from step 07;
   - the hook sentence nine times (eight files, two places in the orchestrator);
   - the agent-types line;
   - the nine AGENTS.md phrase changes.

   Paste the full output into `log.md` under this step's section, as a fenced block.
2. **Check the phrase.** `grep -rn "AGENTS.md" /Users/ryan/.claude/skills/{orchestrator,architect,designer,planner,plan-implementer,qa,pr-reviewer}` shows the new phrase in the nine places, with no "instructions instructions" anywhere. The unchanged mentions in `run-checks.md` and `crisp-check.md` are still there as they were.
3. **Smoke check** (design §8, stage 3). Spawn one fresh `general-purpose` subagent with `model: "sonnet"`. **Your brief must authorize this spawn.** If it does not, stop before this check and report; the orchestrator then runs it and records the result in `log.md`. Brief it as an engineer:
   - give it the paths of `/Users/ryan/.claude/skills/orchestrator/subagent-rules.md` and `/Users/ryan/.claude/skills/plan-implementer/implement-step.md`;
   - give it a made-up step inline: "add a Frost Lance spell; skill file: `.claude/skills/yomi-add-content/spell.md`";
   - tell it to do only the "Start" reading, to write nothing, and to list every file it read.

   It passes if its list includes `.claude/roles/engineer.md` and `.claude/skills/yomi-add-content/spell.md`. Record the brief, the list it returned and the verdict in `log.md`. If it fails, report it with the subagent's list. Do not reword the hook to force a pass without the orchestrator's agreement.
4. **Tests.** Run `PATH=/opt/homebrew/opt/node@26/bin:$PATH npm test`. It must pass; nothing in the repository's code changed.

## 6. Completion criteria

- [ ] The hook sentence is in all eight files (two places in the orchestrator), with the right `<role>` in each.
- [ ] The agent-types line is in orchestrator "Roles".
- [ ] The AGENTS.md phrase reads "applicable CLAUDE.md or AGENTS.md instructions (once if one links to the other)" in the nine files, with "instructions" once.
- [ ] The restricted diff contains only §5.3, §4.7, the agent-types line and the AGENTS.md lines, and is pasted into `log.md`.
- [ ] The smoke check passed and is recorded in `log.md`, or the orchestrator has run it because the spawn was not authorized.
- [ ] `npm test` passes.
- [ ] The step is `done` in the index with its commit. The commit is `Modular context step 09: role hooks in the global skills`, with no attribution lines, and contains only `log.md` and `index.md`, staged by path.

## 7. Execution record
