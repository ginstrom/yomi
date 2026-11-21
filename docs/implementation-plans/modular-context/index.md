# Implementation plan: modular context and skills

- **Design:** [`docs/designs/modular-context.md`](../../designs/modular-context.md) (uncommitted when planned; base `f0814da`). **Feature record:** [`docs/features/modular-context.md`](../../features/modular-context.md). **History:** [`log.md`](log.md), which this index never copies.
- **What it is:** an instructions refactor in four stages. No game code, rule, constant or test of play changes. The only code is tests in `scripts/` and two code comments.
- This plan is written in the new shape (design §5): this file holds what decides the next step; per-step verification lines, measurements, size tables, findability results and global-skill diffs go in `log.md`.

## Decisions taken for the orchestrator

- **User questions (design §9): the user chose every default (2026-11-21).** The tags in the task table only mark which steps they touch.
  - **[Q1]** The bands live only in `.claude/skills/yomi-balance/bands.md`; `scripts/CLAUDE.md` keeps one contract line. Touches 02 (and the bands pointer in 05, 08).
  - **[Q2]** The global orchestrator's move of per-step verification lines into `log.md` applies to every project (design §5.3 as written). Touches 07, and 08 (if the answer is "Yomi only", the rule goes in `.claude/roles/orchestrator.md` instead of the global skill).
  - **[Q3]** The always-loaded cap is 8,500 bytes. Touches 01 (the constant) and 13 (the last stage adds four descriptions and must still fit).
- **The design's four stages are the step order.** Stage 1 = 01–05, stage 2 = 06–07, stage 3 = 08–09, stage 4 = 10–13. Every step ends with `npm test` passing and a commit.
- **Gaps the design leaves, settled here** (see "Open questions" for the ones the orchestrator should confirm):
  - The name-existence test skips placeholder spans and also searches `e2e/` for constants (C2).
  - `art/gear/*.sprite.toml` comments say "see art/CLAUDE.md". They are not edited (a source edit may make `sprites:check` stale); `art/CLAUDE.md` keeps a pointer line to the drawing rules instead (C4).
  - The one-line headers of `docs/reference/scenes.md`, `sprites.md` and `audio.md` that say the guide "holds the checklists" or "keeps the workflow" are repointed in the step that makes them wrong (04, 10, 11). Nothing else in `docs/reference/` changes.
  - The root `CLAUDE.md` Commands sentence ("Sprites, sounds, narration and the manual's screenshots have their own commands, in `art/`, `audio/` and `e2e/`'s guides") is repointed to the skills in step 13.

## Scope and shared constraints

- **In:** R1–R11 and the design's acceptance and §8 checks. **Out:** design non-goals (no rule, constant or play test changes; `docs/reference/` stays apart from the three header lines above; no migration of finished records or plans; no global-skill edits beyond §5.3 and §4.7; no `.claude/browser-qa/`).
- **Commands.** Default `node` on the host is 22; prefix `PATH=/opt/homebrew/opt/node@26/bin:$PATH` (or use `make test`).
  - `npm test` (`tsc && vitest run`) is the gate before every commit; `npx vitest run scripts/claudeMd.test.ts` and `npx vitest run scripts/records.test.ts` for the cap tests alone.
  - `npm run simulate -- …`: one run at a time, each with its own `--out logs/<label>-<measure>.jsonl > logs/<label>-<measure>.txt` (gitignored).
  - No scene or game code changes, so `npm run test:browser` is not required (run it only if a step touches `src/scenes/*.ts` beyond comments, which none should).
- **Moving text.** Gathered lines are moved, not rewritten; trim only to fit the new format (`file` → `symbol`: what to add). A line may be added only after confirming it in the code. Nothing is dropped except what design §4.1 says is dropped. Every guide that loses a checklist gains its pointer line (C4).
- **Findability check** (design §8), for every guide a stage trims: a scratch script outside the repository (never committed) takes every backticked span and every bold lead phrase (`**…**`) from `git show <stage-base>:<guide>` and reports each not found verbatim in the union of the new guide, `.claude/skills/**`, `.claude/agents/**`, `.claude/roles/**` (never `.claude/worktrees/`) and `docs/reference/**`. The list must be empty or each entry justified in `log.md`. Stage bases: stage 1 = `f0814da` (the parent of step 01's first commit, if HEAD has not moved); stage 4 = the parent of step 10's first commit. The step that runs it records the base SHA it used.
- **Global skills** (`/Users/ryan/.claude/skills/`) are outside git; backup at `/Users/ryan/.claude/skills-backup-2026-11-21/`. Only steps 07 and 09 edit them, only with the exact text in C6, and paste `diff -ru /Users/ryan/.claude/skills-backup-2026-11-21 /Users/ryan/.claude/skills` (restricted to the backed-up directories: the backup lacks `browser-auth`, `linear`, `pr-creator`, `recursive-slack`, `simulated-user`, `synced`, `technical-report-writing` and `.trash`, so ignore their "Only in" lines) into `log.md`.
- **Subagent spawns.** Steps 02, 09, 12 and 13 each need one verification spawn (a `yomi-measure` run, a sonnet smoke check, a `yomi-asset-check` run, a haiku trigger check). The engineer's brief must authorize it; otherwise the engineer stops before that check and the orchestrator runs it and records the result in `log.md`. An agent type or skill created during a session may not be listed until a new session starts: if `subagent_type: "yomi-measure"` (or `yomi-asset-check`) is refused, spawn a `general-purpose` agent at the agent file's `model`, briefed with the agent file's body, and say so in `log.md`.
- **Uncommitted files.** The design, the feature record and this plan folder are untracked; step 01 carries them into its commit. Leave any other uncommitted change alone.
- **Commits.** On the current branch (`long-campaign-stage-07`), never pushed. Message `Modular context step NN: <title>`, no attribution lines. Stage files by path.
- **Renames.** Search the `CLAUDE.md` files and `.claude/` for every name a step renames or moves.

## Contracts

### C1. Files under `.claude/` (all proposed)

- `.gitignore` gains `.claude/worktrees/` (step 01, before anything under `.claude/` is committed).
- Skills, each a directory with `SKILL.md` (frontmatter `name`, `description`) and supporting `.md` files:
  - `yomi-balance/`: `SKILL.md`, `bands.md`, `running.md`, `levers.md`, `guards.md` (step 02).
  - `yomi-add-content/`: `SKILL.md`, `spell.md`, `status.md`, `ability.md`, `trait.md`, `element.md`, `skill-node.md`, `battle-event.md` (step 03); `foe.md`, `encounter.md`, `facility.md`, `location-kind.md`, `day-action.md`, `item.md`, `rune.md`, `gear-icon.md`, `portrait.md`, `party-banner.md`, `debug-command.md`, `story.md` (step 04).
  - `yomi-sprites/`: `SKILL.md`, `workflow.md`, `drawing.md` (step 10).
  - `yomi-sound/`: `SKILL.md`, `commands.md`, `new-cue.md`, `sourcing.md`, `narration.md` (step 11).
  - `yomi-manual/`: `SKILL.md`, `screenshots.md` (step 12).
- Agents: `.claude/agents/yomi-measure.md` (step 02), `.claude/agents/yomi-asset-check.md` (step 12).
- Role profiles: `.claude/roles/orchestrator.md`, `designer.md`, `planner.md`, `engineer.md`, `reviewer.md`, `qa.md`, `pr-reviewer.md` (step 08). No `architect.md`.
- Frontmatter `name` and `description` are exactly design §4.2–§4.6 (copy the YAML verbatim). `yomi-measure`'s `tools` are the design's `Bash, Read, Grep, Glob`; it runs simulations in the foreground (see Open questions); `yomi-asset-check` is `tools: Bash, Read`, `model: haiku`.
- Measure names `yomi-measure` accepts, defined in `bands.md`: `one`, `company`, `rl10`, `rl12`, the cell codes (`gr3`, `bc3`, `bc4`, `bc5`, `sn5`, `sp5`, `tl5`, `sg7`, `sg10`, `f1`, `f2`, `f3`), `parity-L4`, `parity-L8`, `parity-L14`, and `standard` (every row of the bands table). Logs: `logs/<label>-<measure>.jsonl` and `.txt`.

### C2. `scripts/claudeMd.test.ts` (extended in 01, 08 and 13)

Constants at the top, with the existing comment extended (the caps keep loaded context small; move detail rather than raise a cap):

| Constant | Value | Applies to | Step |
| --- | --- | --- | --- |
| `ROOT_LIMIT_BYTES` | `16_000` | root `CLAUDE.md` (existing) | — |
| `DIRECTORY_LIMIT_BYTES` | `12_000`, lowered to `8_000` | each directory `CLAUDE.md` (existing) | 13 |
| `SKILL_LIMIT_BYTES` | `4_000` | each `.claude/skills/*/SKILL.md` | 01 |
| `SKILL_FILE_LIMIT_BYTES` | `8_000` | every other `.md` in a skill directory | 01 |
| `AGENT_LIMIT_BYTES` | `6_000` | each `.claude/agents/*.md` | 01 |
| `ROLE_LIMIT_BYTES` | `4_000` | each `.claude/roles/*.md` | 08 |
| `DESCRIPTION_LIMIT_BYTES` | `260` | each skill's and agent's `description` | 01 |
| `ALWAYS_LOADED_LIMIT_BYTES` | `8_500` **[Q3]** | root `CLAUDE.md` bytes + Σ over skills and agents of (bytes of `name` + bytes of `description`) | 01 |
| `ABSENT_CONSTANTS` | `new Set<string>()` | allow-list for the name-existence test | 01 |

All limits are strict (`<`). Rules:

- **Scope.** Read only `.claude/skills/*/` (recursively, `.md` files), `.claude/agents/*.md` and `.claude/roles/*.md`. Never walk `.claude/` itself (agent worktrees live in `.claude/worktrees/`). A missing directory is an empty list, so every test passes before any file exists. The existing `claudeFiles` walk keeps skipping dot-directories.
- **Frontmatter.** The block between a leading `---` line and the next `---` line, parsed as `key: value` lines (no YAML dependency). `name` equals the skill's directory name or the agent's file name without `.md`. `description` is a single line: the line after it is another `key:` line or the closing `---`.
- **Name-existence.** In every file read above, each backticked span is checked:
  - an UPPER_SNAKE constant (`/^[A-Z][A-Z0-9]*(_[A-Z0-9]+)+$/`) must occur as a word in a `.ts` file under `src/`, `scripts/` or `e2e/`, or be in `ABSENT_CONSTANTS`;
  - a repository path (starts with `src/`, `scripts/`, `art/`, `audio/`, `e2e/`, `docs/` or `.claude/`; contains no space) must exist, after stripping a trailing `:<line>` and a trailing `#<anchor>`. Spans containing `<`, `>`, `*`, `{`, `}` or `…` are placeholders and are skipped.
- Failures list the offending files (and spans), not just a count.

### C3. `scripts/records.test.ts` (new in 06)

| Constant | Value |
| --- | --- |
| `STATE_LIMIT_BYTES` | `3_000` (the State section, from `## State` to the next line starting `## `) |
| `RECORD_LIMIT_BYTES` | `8_000` (the whole record) |
| `PLAN_INDEX_LIMIT_BYTES` | `32_000` (each `docs/implementation-plans/*/index.md`) |
| `LEGACY_RECORDS` | `audio-pass`, `auto-resolve`, `battle-cost`, `long-campaign-stage-02` … `-06`, `party-list-and-gear-looks`, `skill-trees`, `ui-feedback-drag-pan-cursor` (the 11 done records) |
| `LEGACY_PLANS` | the 14 existing plan folders: `audio-pass`, `auto-resolve`, `battle-cost`, `defect-fixes`, `long-campaign-stage-01` … `-07`, `party-list-and-gear-looks`, `skill-trees`, `ui-feedback-drag-pan-cursor` |

Each `docs/features/*.md` not in `LEGACY_RECORDS` has `## State` and `## Decision log` and meets both limits; each plan index not in `LEGACY_PLANS` meets its limit; every legacy slug names an existing file or folder. Non-legacy after step 06: the `modular-context` and `long-campaign-stage-07` records, and this plan's index.

### C4. Pointer and contract lines (exact wording; minor grammar fits allowed)

| Where | Line | Step |
| --- | --- | --- |
| `src/engine/CLAUDE.md`, replacing "Checklists" | "Adding a spell, status, ability, trait, element or battle event: `.claude/skills/yomi-add-content/`." | 03 |
| `src/engine/CLAUDE.md`, The AI, replacing the snapshot paragraph | "`policies.test.ts` holds a snapshot of today's encounters' choices: re-record it only when the change is meant (`.claude/skills/yomi-balance/guards.md`)." | 02 |
| `src/combat/CLAUDE.md`, When you add data, bullet 1 | "Adding a spell, status, ability, trait or element: `.claude/skills/yomi-add-content/`." (bullets 2 and 3 stay) | 03 |
| `src/character/CLAUDE.md`, Nodes are data | "A new node: `.claude/skills/yomi-add-content/skill-node.md`." | 03 |
| `src/character/CLAUDE.md`, replacing "Changing hero growth means retuning" | "A change to hero growth moves balance: `.claude/skills/yomi-balance/` (`levers.md`, \"When to retune\")." | 02 |
| `src/inventory/CLAUDE.md`, Equipping, last sentence | "A new gear icon: `.claude/skills/yomi-add-content/gear-icon.md`." | 04 |
| `src/game/CLAUDE.md`, Contracts | the save-shape checklist item becomes a contract bullet; and "**Balance.** Anything that changes a battle's outcome, a foe or an encounter moves balance: `.claude/skills/yomi-balance/`." | 02 (balance), 04 (save shape) |
| `src/game/CLAUDE.md`, replacing the remaining Checklists | "Adding a facility, encounter, foe kind or one-day action: `.claude/skills/yomi-add-content/`." | 04 |
| `src/scenes/CLAUDE.md`, replacing "If you add X, also update Y" | "Adding content (a unit kind, a gear, item or rune icon, an ability, spell, portrait, facility, location kind, party banner, battle event or debug command): `.claude/skills/yomi-add-content/`. A sound effect: `audio/CLAUDE.md`, \"Which sound plays when\"." plus the contract line "Each asset directory's `README.md` records provenance and licence; update it when files are added." | 03 (ability, spell, battle-event items out), 04 (the rest) |
| same, sound-effect sentence | becomes "A sound effect: `.claude/skills/yomi-sound/new-cue.md`." | 11 |
| `src/story/CLAUDE.md` | "Writing a cutscene, tip, story moment or tutorial anchor: `.claude/skills/yomi-add-content/story.md`." | 04 |
| `scripts/CLAUDE.md` | "The bands are the user's; never change them. They are in `.claude/skills/yomi-balance/bands.md`." **[Q1]**; "Run one simulation at a time; its output goes under `logs/`."; the refactor guard as a contract: "`scripts/simulate.test.ts` holds a hash of the first 5 campaigns' events, so a change that moves play fails it; re-record it only when play is meant to move (`.claude/skills/yomi-balance/guards.md`)." | 02 |
| `art/CLAUDE.md` | "Drawing a sprite (the loop, runs, variants, anims, gear sprites' `over`/`like`/regions): `.claude/skills/yomi-sprites/`." | 10 |
| `audio/CLAUDE.md` | "Commands, a new cue, sourcing and narration: `.claude/skills/yomi-sound/`." | 11 |
| `e2e/CLAUDE.md`, last paragraph | "`manual.shots.ts` is not a test; see `.claude/skills/yomi-manual/`." | 12 |
| `src/game/encounters.ts:194`, `scripts/simulate.ts:12` | "see the rules of scaling in CLAUDE.md" → "see `.claude/skills/yomi-balance/levers.md`" | 02 |
| `yomi-add-content` files that name `art/CLAUDE.md` / `audio/CLAUDE.md` for a sprite or sound | repointed to `.claude/skills/yomi-sprites/` / `.claude/skills/yomi-sound/` (`new-cue.md`, `narration.md`) | 10, 11 |

### C5. Root `CLAUDE.md` changes

- 02: Balance contract → "**Balance.** Constants are tuned against the user's bands (`yomi-balance` skill); a change that moves play fails the refactor guard (`scripts/simulate.test.ts`)." Subagents gains "Simulator measurements: the `yomi-measure` agent; asset checks: `yomi-asset-check`." (the `yomi-asset-check` half lands in 12, when it exists).
- 05: Docs gains "`.claude/`: project skills (`yomi-*`), agents and role profiles; `scripts/claudeMd.test.ts` caps them." "Keeping these files current": the "Where a fact goes" list becomes the design §4.8 table verbatim; the framing sentence becomes "Update the right file in the same commit as the change that makes it wrong; search the CLAUDE.md files and `.claude/` for every name renamed or deleted."; the cap sentence names the `.claude/` caps.
- 13: the Commands sentence about sprites, sounds, narration and screenshots points to `yomi-sprites`, `yomi-sound` and `yomi-manual`; the cap sentence says 8 KB for directory guides.
- Root stays ≤ 6,500 bytes (design §7 target); the budget test enforces the total.

### C6. Global skill edits (exact text in the design; copied into the steps)

- Step 07 **[Q2]**: design §5.3 items 1–4 (orchestrator "The feature record" and Phase 4; planner folder sketch, "Write index.md" bullet, implementers' bullet; `implement-step.md` "Complete"; `step-loop.md` "Overall review" and "Confirm").
- Step 09: the hook sentence "Also read `.claude/roles/<role>.md` at the project root if it exists: the project's notes for this role." in the eight places of design §4.7; the agent-types line in orchestrator "Roles"; the AGENTS.md phrase in designer, planner, architect, qa, pr-reviewer `SKILL.md`, orchestrator Phase 0, plan-implementer `SKILL.md`, `implement-step.md` and `review-step.md`, written so that "instructions" appears once (the replacement absorbs an existing "instructions").

### C7. `log.md`

Append-only, one `## Step NN: <title>` section per step: date, engineer and reviewer tiers, verdict, review rounds, commands run with results, figures. Stage-close steps add the size table (design §7, before and after), the findability result and, for 07 and 09, the global diff. The orchestrator never reads it on resume.

## Tasks

| Step | File | Outcome | Depends on | Tier (eng / rev) | Status | Commits |
| --- | --- | --- | --- | --- | --- | --- |
| 01 | [01-claude-dir-caps.md](01-claude-dir-caps.md) | `.claude/worktrees/` ignored; cap, frontmatter, budget and name-existence tests for `.claude/` **[Q3]** | — | opus / opus | done | 07cdd3c |
| 02 | [02-yomi-balance.md](02-yomi-balance.md) | `yomi-balance` skill, `yomi-measure` agent, balance text out of scripts/character/engine/game guides, root Balance and Subagents lines, two code comments; one `yomi-measure` run **[Q1]** | 01 | sonnet / opus | done | 05aeac2 |
| 03 | [03-add-content-battle.md](03-add-content-battle.md) | `yomi-add-content` index and its seven battle files; engine checklists, combat bullet 1, character node line, three scenes items moved | 02 | sonnet / sonnet | done | 27254d2 |
| 04 | [04-add-content-world.md](04-add-content-world.md) | the other twelve content files; game, scenes, inventory and story checklists moved; scenes reference header | 03 | sonnet / sonnet | done | see log |
| 05 | [05-stage-1-close.md](05-stage-1-close.md) | root "Keeping these files current" table and Docs line; findability check of eight guides; stage 1 sizes | 04 | sonnet / opus | pending | |
| 06 | [06-records-and-migration.md](06-records-and-migration.md) | `records.test.ts`; stage 7 record migrated (history to its `log.md`); this feature's record in shape | 05 | opus / opus | pending | |
| 07 | [07-global-state-history.md](07-global-state-history.md) | the design §5.3 global edits, diff in `log.md` **[Q2]** | 06 | opus / opus | pending | |
| 08 | [08-role-profiles.md](08-role-profiles.md) | seven role profiles and their cap **[Q2]** | 07 | sonnet / opus | pending | |
| 09 | [09-global-role-hooks.md](09-global-role-hooks.md) | the hook lines, agent-types line and AGENTS.md phrase in the global skills; smoke check | 08 | opus / opus | pending | |
| 10 | [10-yomi-sprites.md](10-yomi-sprites.md) | `yomi-sprites` skill; `art/CLAUDE.md` to contracts; content files repointed | 09 | sonnet / sonnet | pending | |
| 11 | [11-yomi-sound.md](11-yomi-sound.md) | `yomi-sound` skill; `audio/CLAUDE.md` to contracts; sound and narration pointers repointed | 10 | sonnet / sonnet | pending | |
| 12 | [12-yomi-manual-and-asset-check.md](12-yomi-manual-and-asset-check.md) | `yomi-manual` skill, `e2e/CLAUDE.md` screenshot paragraph, `yomi-asset-check` agent and its run | 11 | sonnet / sonnet | pending | |
| 13 | [13-stage-4-close.md](13-stage-4-close.md) | directory cap to 8,000; root Commands and cap lines; findability of art/audio/e2e; trigger check; final sizes **[Q3]** | 12 | sonnet / opus | pending | |

## Execution order

Strictly sequential, 01 → 13: every step edits a shared file (`scripts/claudeMd.test.ts`, root `CLAUDE.md`, the `yomi-add-content` files or `log.md`). Integration checkpoints are the stage closes: 05, 07, 09, 13. Steps 07 and 09 change files outside git; their commit carries only `log.md`, the index and their own task file.

## Requirement map

| Req | Steps |
| --- | --- |
| R1 contracts-only guides | 02, 03, 04 (findability 05); 10, 11, 12 (findability 13) |
| R2 `yomi-add-content` | 03, 04 (repointed 10, 11) |
| R3 `yomi-balance` | 02 |
| R4 `yomi-measure` | 02 |
| R5 root "where a fact goes" | 05 |
| R6 state/history split | 06, 07 |
| R7 size-cap tests | 01, 06, 08, 13 |
| R8 role profiles and hook | 08, 09 |
| R9 sprites, sound, manual, asset check | 10, 11, 12 |
| R10 always-loaded ≤ +2 KB, sizes recorded | 01 (test), 05 and 13 (recorded) |
| R11 global edits generic and exact | 07, 09 |

## Completion criteria

- `npm test` passes at every step's commit; each step's commit hash is in the table.
- Both findability checks (05, 13) list no unjustified missing fact; the reviewer walks the design §4.1 ledger row by row.
- The always-loaded total is under 8,500 bytes and enforced; before and after sizes are in `log.md`.
- The restricted global diff shows only design §5.3 and §4.7 lines.
- `yomi-measure` and `yomi-asset-check` have each been run once, with results in `log.md`; the stage 3 smoke check and stage 4 trigger check results are in `log.md`.

## Open questions

- **[Q1], [Q2], [Q3]**: answered, defaults.
- **For the orchestrator: settled.** (b), (c) and (d) as planned. (a) is changed: `yomi-measure` runs each simulation in the foreground with Bash's 600 s timeout (a 500-campaign run takes about 5 minutes), so it needs no `Monitor`; its `tools` stay the design's `Bash, Read, Grep, Glob`. A run expected past 9 minutes (`rl10`, `rl12`, counts above 500) is started detached (`nohup … &`, PID noted) and waited on in the foreground with `caffeinate -w <PID>` at a 590,000 ms timeout, repeated until the process is gone; the agent never ends its turn while a run is alive. (b) the engineer profile's spawn grant (design §4.7) is a profile, not the role file or brief that `subagent-rules.md` names, so `orchestrator.md` also tells the orchestrator to grant it in engineer briefs (step 08); (c) the name-existence test's placeholder rule and `e2e/` search (C2); (d) the reference header lines and the `art/CLAUDE.md` pointer kept for the sprite-source comments.

## For implementers

Read this index and your task file only. Set your step `in progress`, then `done` with its commits, here. Record evidence, deviations and blockers in your task file's execution record, and your step's outcome section (C7) in `log.md`. Measurements, size tables, findability output and global diffs go in `log.md`, never in this index.
