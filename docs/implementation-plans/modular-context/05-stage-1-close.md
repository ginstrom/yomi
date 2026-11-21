# Step 05: stage 1 close (root "where a fact goes", findability, sizes)

- **Index:** [index.md](index.md). **Design:** [`docs/designs/modular-context.md`](../../designs/modular-context.md) §4.8, §7, §8. **Log:** [log.md](log.md).
- **Objective:** finish stage 1. The root `CLAUDE.md` states the new rule for where a fact goes and lists `.claude/`. The findability check shows that nothing was lost from the eight guides that stage 1 trimmed. The stage's before and after sizes are recorded.

## 1. Requirements and context

- **R5:** the root `CLAUDE.md`'s "Keeping these files current" states the new rule for where a fact goes (design §4.8).
- **R1 (stage 1 part):** every directory guide trimmed in stage 1 now holds contracts only. Each moved section has a named destination, and nothing was dropped except what design §4.1 says to drop.
- **R10:** the always-loaded cost (the root `CLAUDE.md` plus every project skill's and agent's `name` and `description`) grows by at most 2 KB. Before and after sizes are recorded. The test from step 01 enforces the cap of 8,500 bytes **[Q3]**.
- Design §8, stage 1 checks:
  - `npm test` passes;
  - the findability check covers combat, engine, character, inventory, game, story, scenes and scripts;
  - the §7 size table is filled in with actuals.
  - (The `yomi-measure` run was step 02's.)
- This is an instructions refactor: no game code, rule or constant changes.

## 2. Dependencies and prerequisites

Steps 01 to 04 are done. What exists by now, from those steps:

- `scripts/claudeMd.test.ts` with the C2 caps: `SKILL_LIMIT_BYTES`, `SKILL_FILE_LIMIT_BYTES`, `AGENT_LIMIT_BYTES`, `DESCRIPTION_LIMIT_BYTES`, `ALWAYS_LOADED_LIMIT_BYTES` = `8_500` and `ABSENT_CONSTANTS`, plus the name-existence test. `DIRECTORY_LIMIT_BYTES` is still `12_000`; step 13 lowers it.
- `.claude/skills/yomi-balance/`, with `SKILL.md`, `bands.md`, `running.md`, `levers.md` and `guards.md`.
- `.claude/agents/yomi-measure.md`.
- `.claude/skills/yomi-add-content/`, with `SKILL.md` and its 19 content files.
- The eight guides trimmed to contracts, with the C4 pointer lines.
- The root `CLAUDE.md` already has step 02's Balance contract ("tuned against the user's bands (`yomi-balance` skill)") and its Subagents line about `yomi-measure`.
- `log.md` holds the step 01 to 04 sections.

**Stage 1 base:** `f0814da`, the parent of step 01's first commit. Confirm it with `git log --reverse --format='%h %s' f0814da..HEAD | head -1`. If step 01's first commit's parent is a different SHA, use that SHA and record it in `log.md`.

## 3. Scope and implementation guidance

### 3.1 Root `CLAUDE.md` (C5, step 05 part)

- **"Docs" section:** add one bullet: "`.claude/`: project skills (`yomi-*`), agents and role profiles; `scripts/claudeMd.test.ts` caps them."
- **"Keeping these files current":** replace the four-bullet "Where a fact goes" list with this table, verbatim:

  | A fact | Goes in |
  | --- | --- |
  | commands, the map, contracts spanning directories | this file |
  | a rule that stops you breaking code in one directory | that directory's `CLAUDE.md`, one line a module |
  | how to do a kind of task: an "if you add X" list, a tool workflow, tuning | a project skill, `.claude/skills/yomi-<task>/`, one file per case |
  | what one role needs to know about Yomi | `.claude/roles/<role>.md` |
  | a delegated job with a fixed report | `.claude/agents/<name>.md` |
  | full rule text and detail | `docs/reference/<area>.md` |
  | a feature's state / its history | `docs/features/<slug>.md` State / the plan's `log.md` |
  | what a grep answers, what the code says | nowhere |

- **The two framing sentences:**
  - The first becomes: "Update the right file in the same commit as the change that makes it wrong; search the CLAUDE.md files and `.claude/` for every name renamed or deleted." It replaces "Update the right `CLAUDE.md` in the same commit…; search them for every name renamed or deleted. Where a fact goes:". A short lead-in such as "Where a fact goes:" may stay before the table.
  - The cap sentence stays. It also names the `.claude/` caps, for example: "`scripts/claudeMd.test.ts` caps this file at 16 KB, each directory's at 12 KB, and the skills, agents and always-loaded total under `.claude/`; when it fails, move detail out (into `docs/reference/` or a skill)." Step 13 changes "12 KB" to "8 KB", so leave the number at 12 here.
- **The "Docs" bullet for `docs/implementation-plans/`:** it says "step plans with completion logs, the record of past reasoning and balance history". This may stay. If you touch it, keep it short: "step plans (`index.md`) and their history (`log.md`)".
- **[Q1] consistency.** Read the rest of the root file for any text that still says the bands are in `scripts/CLAUDE.md`:
  - The Balance contract should already point to `yomi-balance` (step 02). Fix it if not.
  - The Architecture table's `scripts/` row ("the simulator and the balance bands") stays as the design says. Its guide now holds the contract that the bands are the user's and where they live.
  - Record what you checked in the execution record.
- **Size:** the root `CLAUDE.md` stays at or under 6,500 bytes (`wc -c CLAUDE.md`). If the table pushes it over, tighten your own new wording, not the design's table.

### 3.2 The findability check (scratch, never committed)

- Write the script outside the repository, for example in `/tmp` or your scratchpad. For each of the eight guides, take every backticked span and every bold lead phrase (`**…**`) from `git show <base>:<guide>`:
  - `src/combat/CLAUDE.md`
  - `src/engine/CLAUDE.md`
  - `src/character/CLAUDE.md`
  - `src/inventory/CLAUDE.md`
  - `src/game/CLAUDE.md`
  - `src/story/CLAUDE.md`
  - `src/scenes/CLAUDE.md`
  - `scripts/CLAUDE.md`
- Report each span or phrase that is not found verbatim in the union of:
  - the guide as it is now;
  - `.claude/skills/**`, `.claude/agents/**` and `.claude/roles/**`. Never read `.claude/worktrees/`.
  - `docs/reference/**`.
- Bold lead phrases often lose their bold, or change their trailing colon, when they move. Strip the `**` and a trailing `:` before searching, and say in `log.md` that you did.
- The list must be empty, or each entry must be justified in `log.md`. Known justified entries:
  - **"A control a browser test clicks:"** (scenes "If you add X"). It was dropped as a duplicate of Probes ("A control that a test needs to click goes in its scene's probe").
  - **Bold checklist headings** that became file names. For example, "A new spell" became `yomi-add-content/spell.md`, and "Any event shape change" became `battle-event.md`. Name the file each one became.
  - **Headings removed on purpose** ("Checklists", "If you add X, also update Y", "Changing hero growth means retuning", "Balance", "Flags", "Campaigns", "What a tuner needs to know"). Name the destination of each, from design §4.1.
- An entry with no justification is a real miss. Restore the fact to its destination (the guide, the skill file or the agent) in this step, then rerun the check.

### 3.3 Sizes (design §7) into `log.md`

Measure with `wc -c`. For descriptions, use the same byte sum the step 01 budget test uses: the bytes of `name` plus the bytes of `description`, for every skill and agent. Write one table:

| Measure | Before (`f0814da`) | After stage 1 |
| --- | --- | --- |
| root `CLAUDE.md` | 6,243 | actual |
| project skill descriptions | 0 | actual (2 skills now) |
| project agent descriptions | 0 | actual (1 agent now) |
| **always loaded** | **6,243** | actual, against 8,500 |
| `src/game/CLAUDE.md` | 8,308 | actual |
| `src/engine/CLAUDE.md` | 7,542 | actual |
| `src/scenes/CLAUDE.md` | 6,451 | actual |
| `src/character/CLAUDE.md` | 5,765 | actual |
| `scripts/CLAUDE.md` | 4,377 | actual |
| `src/inventory/CLAUDE.md` | 2,955 | actual |
| `src/combat/CLAUDE.md` | 2,582 | actual |
| `src/story/CLAUDE.md` | 1,617 | actual |
| `audio/`, `e2e/`, `art/` guides (stage 4) | 6,726 / 4,844 / 4,161 | unchanged |
| directory guides in total | 55,328 | actual |
| adding a spell: guides to read | engine + combat + scenes + character = 22,340 | engine + combat + `yomi-add-content/spell.md` = actual |

- **Every directory guide must be under 8,000 bytes.** Step 13 lowers `DIRECTORY_LIMIT_BYTES` to `8_000`. If any guide is at or over 8,000, report it, name the guide and its size, and say what further move from design §4.1 would bring it under. Make that move only if it is already listed in §4.1. Otherwise leave the guide as it is and report the finding.

### 3.4 Exclusions

- No edits to the `art/`, `audio/` or `e2e/` guides; they belong to stage 4.
- No edits to `docs/reference/`.
- No edits to the global skills.
- No change to the caps in `scripts/claudeMd.test.ts`.

## 4. Shared constraints (repeated from the index)

- **Node:** the host's default `node` is version 22. Prefix commands with `PATH=/opt/homebrew/opt/node@26/bin:$PATH`, or use `make test`.
- **Gate:** run `npm test` before you commit. To run the cap tests alone: `npx vitest run scripts/claudeMd.test.ts`.
- **Moving text:** move lines, don't rewrite them. Drop nothing that design §4.1 does not drop.
- **Commit:** on the current branch, never pushed. Use the message `Modular context step 05: stage 1 close`, with no attribution lines. Stage files by path.
- **Renames:** search the `CLAUDE.md` files and `.claude/` for every renamed name.
- **History goes in `log.md` (C7)**, never in the index.

## 5. Verification

1. `PATH=/opt/homebrew/opt/node@26/bin:$PATH npm test` passes. That includes the step 01 budget test (always loaded < 8,500) and the name-existence test.
2. `wc -c CLAUDE.md` is at or under 6,500.
3. `grep -n "scripts/CLAUDE.md" CLAUDE.md` shows no text that says the bands live there **[Q1]**.
4. The findability output is pasted or summarised in `log.md`: each guide, the count of spans checked, and each miss with its justification. No miss is left unjustified.
5. The §7 table is in `log.md`, filled with actuals.
6. `wc -c src/*/CLAUDE.md scripts/CLAUDE.md` shows every stage 1 guide under 8,000 bytes, or the step reports the exception.
7. **Reviewer:** walk the design §4.1 ledger rows for these eight guides, row by row, against `git diff f0814da..HEAD -- src scripts .claude CLAUDE.md`. Confirm that:
   - each "stays" row still holds its contract;
   - each "moves" row's text is in the named destination;
   - each "dropped" row is justified;
   - each pointer line matches C4.

## 6. Completion criteria

- [ ] The root `CLAUDE.md` has the §4.8 table, the two framing sentences, the `.claude/` line under Docs, and the cap sentence naming the `.claude/` caps. It is at or under 6,500 bytes.
- [ ] No text in the root file says the bands are anywhere other than `yomi-balance` **[Q1]**.
- [ ] The findability check has been run against the recorded base, and every miss is justified or restored. The result is in `log.md`.
- [ ] The stage 1 size table is in `log.md`, with the always-loaded total under 8,500.
- [ ] Every stage 1 directory guide is under 8,000 bytes, or the exception is reported.
- [ ] `npm test` passes. One commit has been made, and its hash is in the index's task table, with the step marked `done`.
- [ ] The step's section of `log.md` has been written (date, tiers, verdict, review rounds, commands and results).

## 7. Execution record

- Root `CLAUDE.md` edited as 3.1 says; 6,783 bytes, over the 6,500 guide by 283 (the verbatim table and Docs line cost about 700 bytes; my own wording is already tight). The always-loaded total is 7,431 against 8,500. [Q1] checked: no root text sends to `scripts/CLAUDE.md` for the bands.
- Findability, sizes and the pointer sweep are in `log.md` (Step 05). No miss was unjustified; no restore was needed. Deviation: the 6,500-byte root guide is exceeded, reported for the orchestrator.
- `npm test`: tsc clean; 97 files, 2407 tests passed.
