# Log: modular context and skills

Append-only history for [the plan](index.md): one `## Step NN: <title>` section per step (date, tiers, verdict, review rounds, commands and results, figures), plus the size tables, findability results and global-skill diffs. The orchestrator does not read this file on resume.

## Step 01: caps and checks for .claude/

- 2026-11-21. Engineer opus; reviewer opus. Verdict: clean; review rounds: 1. Follow-up asked by the orchestrator: indented fences (below).
- `npx vitest run scripts/claudeMd.test.ts`: baseline 2 passed; stubbed helpers 7 of 8 fixture tests failed as expected, the eighth red by mutation; temporary bad `.claude/skills/tmp-bad/SKILL.md` failed the three live checks; final 14 passed.
- `npm test`: tsc clean, 97 test files, 2,406 tests passed.
- `git check-ignore -v .claude/worktrees/x` → `.gitignore:36:.claude/worktrees/`.
- Always-loaded total today: 6,243 bytes (root `CLAUDE.md` alone; no skills or agents), limit 8,500.
- Follow-up, indented fences: `backtickedSpans` now treats a ```` ``` ```` line with leading spaces or tabs (a fence inside a list item) as a fence. New fixture test `skips spans in a fence indented inside a list item`: red first (reported `INDENTED_FENCED` and `src/indented.ts` from inside the fence), then green; `npx vitest run scripts/claudeMd.test.ts` 15 passed.

## Step 02: the yomi-balance skill and yomi-measure agent

- 2026-11-21. Engineer opus (as briefed); reviewer opus. Verdict: changes needed in round 1, fixed in the follow-up commit; review rounds: 1.
- New files (bytes): `.claude/skills/yomi-balance/` SKILL 1,663, bands 3,817, running 2,902, levers 1,231, guards 1,252; `.claude/agents/yomi-measure.md` 2,154. Root `CLAUDE.md` 6,294; `scripts/CLAUDE.md` 895 (was 4,377). Always-loaded total checked by `scripts/claudeMd.test.ts`.
- Fallback used: `subagent_type: "yomi-measure"` was refused (agent type created this session), so a `general-purpose` agent at `model: "sonnet"` was briefed with the agent file's body.
- `yomi-measure` run, `one`, seed 1, `--battles 50`, label `mc02` (20 s, head 698b662 plus this step's uncommitted edits; logs `logs/mc02-one.jsonl` and `.txt`):

| Measure | Command flags | Figure | Band | In band | Change from Now |
| --- | --- | --- | --- | --- | --- |
| One party, wins | `--campaign --parties 1 --battles 50 --seed 1` | 23 of 50 | 215 to 250 of 500 | not comparable (about 230 per 500) | 23 against 239 (-216 raw; not comparable) |
| Heroes dead a campaign | same | 1.1 | at most 2.0 | yes | 0.0 |
| Days a campaign | same | 294 | 243 to 297 | yes | +8 |
| Battles a campaign | same | 19.7 | none | n/a | +0.2 vs 19.5 |

- A 50-battle cell run by the engineer after it (`bc4`, `logs/mc02-bc4.txt`): `playerWins` 44 of 50; used to write `running.md`.
- Not edited, noted: `docs/reference/simulator.md` line 3 still says `scripts/CLAUDE.md` holds "the balance bands and current figures" (out of scope: no `docs/reference/` change).
- Review round 1 (opus): changes needed. Fixed: `parity-L8` is `--encounter hobgoblin_warband --threat 5 --party-level 8 --plans <role>=<plan>`; `docs/reference/simulator.md` line 3 repointed to `bands.md` (orchestrator's exception to the no-`docs/reference/` rule); `standard` lists its cells explicitly without `tl5`; checklist ticked; this record corrected.
- Review round 2 (opus): changes needed. Fixed: `parity-L14` spelled out in full as `--encounter bandit_camp --threat 7 --party-level 14 --plans <role>=<plan>`, since "the same with" now read as the Warband row above it.

## Step 03: yomi-add-content, the battle content

- Date 2026-11-21. Tiers: engineer sonnet, reviewer sonnet. Verdict: clean (review sonnet, 1 round; three accuracy nits fixed in a follow-up commit: SKILL.md guides sentence, element.md catches, battle-event.md catch scope). Rounds: 1.
- Files: `.claude/skills/yomi-add-content/` `SKILL.md` 1,576 bytes (cap 4,000); `spell.md` 1,330; `status.md` 929; `ability.md` 1,219; `trait.md` 1,165; `element.md` 478; `skill-node.md` 1,007; `battle-event.md` 985 (cap 8,000 each).
- Guides after: `src/engine/CLAUDE.md` 5,246; `src/combat/CLAUDE.md` 2,576; `src/character/CLAUDE.md` 5,485; `src/scenes/CLAUDE.md` 6,011. Root 6,294.
- `npm test`: tsc clean; 97 files, 2407 tests passed.
- Moved-line self-check (scratch script: every backticked span and bold lead of `git show HEAD:<guide>` for the four guides, looked up verbatim in the new guide or the content files). Missing: the bold leads `A new spell`, `A new status`, `A new ability`, `A new trait`, `A new element`, `Any event shape change` (engine) and `An ability:`, `A spell:`, `A battle event that changes statuses on screen:` (scenes). Justified: they are headings of moved items, replaced by each content file's title; every backticked span of those items is present in the content files.

## Step 04: yomi-add-content, the world content files

- Date 2026-11-21. Tiers: engineer sonnet, reviewer sonnet. Review rounds: 1 (sonnet; changes needed, fixed in a follow-up commit: `docs/reference/game.md` line 3 repointed and six overclaimed catch lines reworded).
- Files: twelve new content files in `.claude/skills/yomi-add-content/` (350 to 1,122 bytes each); `SKILL.md` 2,344 bytes (cap 4,000).
- Guides after: `src/game/CLAUDE.md` 7,554; `src/scenes/CLAUDE.md` 4,837; `src/inventory/CLAUDE.md` 2,925; `src/story/CLAUDE.md` 1,223.
- `npm test`: tsc clean; 97 files, 2407 tests passed. Ledger, dropped duplicate and deviations: the execution record of `04-add-content-world.md`.

## Step 05: stage 1 close

- Date 2026-11-21. Tiers: engineer sonnet, reviewer opus; verdict clean, 1 round. Base `f0814da` confirmed (the parent of step 01's first commit `07cdd3c`).
- Root `CLAUDE.md`: the design §4.8 table, the two framing sentences, the `.claude/` line under Docs, and the cap sentence naming the `.claude/` caps. It is 6,783 bytes, 283 over the plan's 6,500 guide: the verbatim table and Docs line cost about 700 bytes, my own wording was tightened as far as it goes, and the always-loaded cap (8,500) still holds with room. [Q1] check: the root file has no text naming `scripts/CLAUDE.md` as the bands' home; Balance names `yomi-balance`, and the Architecture row `scripts/` stays as designed.
- Findability check (scratch script outside the repository, `scratchpad/find.py`). For each of the eight guides: every backticked span and every `**bold**` lead of `git show f0814da:<guide>`, with `**` and a trailing `:` stripped for bold leads, looked up verbatim in the union of the guide now, `.claude/skills|agents|roles/**` and `docs/reference/**`.

| Guide | Spans | Bold leads | Missing |
| --- | --- | --- | --- |
| `src/combat` | 39 | 0 | 0 |
| `src/engine` | 104 | 14 | 6 |
| `src/character` | 70 | 0 | 0 |
| `src/inventory` | 36 | 0 | 0 |
| `src/game` | 122 | 15 | 4 |
| `src/story` | 28 | 0 | 0 |
| `src/scenes` | 103 | 23 | 10 |
| `scripts` | 38 | 0 | 0 |

- Missing, all justified:
  - Checklist headings that became file names (`yomi-add-content/`): `A new spell` is `spell.md`; `A new status` is `status.md`; `A new ability` is `ability.md`; `A new trait` is `trait.md`; `A new element` is `element.md`; `Any event shape change` is `battle-event.md`; `A new encounter` is `encounter.md`; `A new facility` is `facility.md`; `A new foe kind` is `foe.md`; `A new one-day action` is `day-action.md`; scenes `A unit kind` is `foe.md`; `A weapon or shield icon, or an armour, head or cloak icon` is `gear-icon.md`; `An item icon` is `item.md` (its rune half went to `rune.md`); `A portrait preset` is `portrait.md`; `A location kind` is `location-kind.md`; `A party banner` is `party-banner.md`; `A debug command` is `debug-command.md`; `A battle event that changes statuses on screen` is `battle-event.md`.
  - `A control a browser test clicks`: dropped as a duplicate of the scenes guide's Probes line.
  - Span `npm run sounds` (scenes "A sound effect"): the item is now a pointer in the scenes guide to `audio/CLAUDE.md`, "Which sound plays when" (heading confirmed), which holds `npm run sounds` (lines 29, 42, 52, 77).
- Pointer sweep (CLAUDE.md files, `.claude/`, `docs/reference/`): every quoted heading a pointer names exists (`audio/CLAUDE.md` "Which sound plays when" and "Narration", `src/character/CLAUDE.md` "Perk points", `src/inventory/CLAUDE.md` "One id is one object"); no remaining text sends to a guide for a checklist or the bands that it no longer holds. `docs/reference/audio.md` line 4 mentions "the checklists" of the audio guide, which stage 4 has not touched. No fixes were needed in files this stage touched.
- Sizes (design §7), `wc -c`; descriptions are the bytes of `name` plus `description` as step 01's test sums them:

| Measure | Before (`f0814da`) | After stage 1 |
| --- | --- | --- |
| root `CLAUDE.md` | 6,243 | 6,783 |
| project skill descriptions | 0 | 470 (2 skills) |
| project agent descriptions | 0 | 178 (1 agent) |
| **always loaded** | **6,243** | **7,431** (cap 8,500; +1,188) |
| `src/game/CLAUDE.md` | 8,308 | 7,554 |
| `src/engine/CLAUDE.md` | 7,542 | 5,246 |
| `src/scenes/CLAUDE.md` | 6,451 | 4,837 |
| `src/character/CLAUDE.md` | 5,765 | 5,485 |
| `scripts/CLAUDE.md` | 4,377 | 895 |
| `src/inventory/CLAUDE.md` | 2,955 | 2,925 |
| `src/combat/CLAUDE.md` | 2,582 | 2,576 |
| `src/story/CLAUDE.md` | 1,617 | 1,223 |
| `audio/`, `e2e/`, `art/` guides (stage 4) | 6,726 / 4,844 / 4,161 | unchanged |
| directory guides in total | 55,328 | 30,741 for the eight, plus 15,731 for the three stage 4 guides = 46,472 |
| adding a spell: guides to read | engine + combat + scenes + character = 22,340 | engine + combat + `yomi-add-content/spell.md` = 9,152 |

- Every stage 1 guide is under 8,000 bytes (the largest is `src/game/CLAUDE.md`, 7,554).

## Moved from the feature record (step 06)

The feature record took the State / Decision log shape in step 06. These lines are its former text, verbatim: the approved proposal (the design now holds it), the header bullets and the bulleted decision log (now the State bullets and the Decision log table), and the Verification section.

### The approved proposal (from the conversation, 2026-11-21)

Where each fact goes:

1. **Directory `CLAUDE.md`: contracts only** (the rules that stop you breaking code in that directory). Procedures and cross-directory checklists move out.
2. **Project skills (`.claude/skills/`), one per kind of task.** Each is a short index pointing at one supporting file per case:
   - `yomi-add-content`: one file per content type (spell, ability, status, trait, element, foe, encounter, facility, gear icon, location kind, one-day action, …), each listing every place to touch across all directories;
   - `yomi-balance`: the bands, the levers, running and reading the simulator, when to re-record the refactor guard and the policy snapshot;
   - `yomi-sprites`, `yomi-sound` (narration included): the asset workflows; `art/` and `audio/` keep only their contracts;
   - `yomi-manual`: when the player's manual changes, and retaking its screenshots.
3. **Project role profiles (`.claude/roles/<role>.md`)**: what a designer, planner, engineer, reviewer or QA needs to know about Yomi. The global role skills get one generic line: read `.claude/roles/<role>.md` if it exists (the pattern `browser-qa`'s profile already uses).
4. **Project subagent types (`.claude/agents/`)**: `yomi-measure` (sonnet; runs the campaign and cell simulations and returns one table against the bands) and `yomi-asset-check` (runs `sprites:check` and `sounds:check`).
5. **State/history split for the orchestrator**: feature records get a state section capped at about 3 KB; plan `index.md` keeps the step table and statuses, while completion logs and measurement history go to `log.md`, which the orchestrator never reads; a size-cap test keeps it so.

Order: (1) `yomi-add-content`, `yomi-balance`, `yomi-measure`, with the directory guides trimmed to match; (2) the state/history split and its size-cap test; (3) role profiles plus the hook in the global skills; (4) `yomi-sprites`, `yomi-sound`, `yomi-manual`.

### Header bullets, as they stood

- **Slug:** `modular-context`
- **Phase:** 4, implementation (steps 01–02 done; step 03 next)
- **Branch:** `long-campaign-stage-07` (the current branch; project rule: commit on the current branch)
- **Design:** `docs/designs/modular-context.md`
- **Plan:** `docs/implementation-plans/modular-context/index.md` (13 steps, four stages; per-step tiers in its task table)

### Decision log, bulleted, as it stood

- **AGENTS.md** → symlink to `CLAUDE.md` (user). Done in `f0814da`.
- **Path: medium, no architecture brief** (orchestrator). The approved proposal is the architecture; the designer writes a design that makes it concrete.
- **Design gate** (orchestrator): the user approved the proposal and asked to go through the order, so the design proceeds to planning unless it departs from the proposal or raises questions only the user can answer.
- **Global skills (`~/.claude/skills/`) are not in git** (orchestrator): backed up to `~/.claude/skills-backup-2026-11-21/` before any edit. Edits there must stay generic and backward compatible for other projects.
- **Design written** (`docs/designs/modular-context.md`); it follows the proposal, so no approval gate (orchestrator, per the decision above).
- **Bands live in `.claude/skills/yomi-balance/bands.md`** (user, 2026-11-21; alternative: `docs/reference/`).
- **The global skills' state/history split applies to every project** (user; alternative: opt-in through a role profile).
- **Always-loaded cap 8,500 bytes** (user; alternative: 7,500).
- **Plan accepted**; its four open points settled in the index; `yomi-measure` runs in the foreground, without `Monitor` (orchestrator: subagent rules forbid waiting on background jobs).

### Verification

Per step: the plan's `log.md`. Step 02 took three review rounds (parity cells); the third was checked by the orchestrator (`a1584bc`, `npm test` 2,407 passed).

## Step 06: records test and the stage 7 record's migration

- 2026-11-21. Engineer opus; reviewer opus. Verdict: pending review; review rounds: 0.
- `npx vitest run scripts/records.test.ts`: with the three check functions stubbed to return `[]`, the 5 fixture tests that expect a problem failed (the empty-tree and in-shape fixtures passed, as they should). With the checks written, one fixture failed on my own arithmetic (the State section counts the blank line before the next `## ` heading), fixed in the fixture. The real-repository test then failed only on the old records: `long-campaign-stage-07.md: no "## State" heading`, `long-campaign-stage-07.md: 8683 bytes (limit 8000)`, `modular-context.md: no "## State" heading`. After the migration: 10 passed.
- `npm test`: tsc clean, 98 test files, 2,417 tests passed (baseline 97 files, 2,407).
- Sizes after the migration (`wc -c`; the State section is measured from `## State` up to the next `## ` line):

| File | Whole | State |
| --- | --- | --- |
| `docs/features/long-campaign-stage-07.md` (was 8,683, no State) | 4,013 | 2,640 |
| `docs/features/modular-context.md` (was 4,568, no State) | 3,475 | 1,472 |
| `docs/implementation-plans/modular-context/index.md` | 22,617 | — |
| `docs/implementation-plans/long-campaign-stage-07/log.md` (new) | 6,298 | — |
| `docs/implementation-plans/long-campaign-stage-07/index.md` (unchanged, legacy) | 28,281 | — |

- Line-set check (scratch script `scratchpad/lineset.py`, outside the repository): each non-blank, trimmed line of `git show HEAD:<record>` looked up as a substring of a trimmed line of the new record or log.
  - `python3 -I lineset.py HEAD:docs/features/long-campaign-stage-07.md docs/features/long-campaign-stage-07.md docs/implementation-plans/long-campaign-stage-07/log.md`: 52 lines checked, 6 not found, all justified:
    - `**Slug:** long-campaign-stage-07` and `**Phase:** 6, done on branch (17cc2e3..6405b5c); not pushed`: folded into the State bullet "Slug `long-campaign-stage-07` · Phase 6, done on branch (17cc2e3..6405b5c); not pushed · …".
    - ``- Branch: `long-campaign-stage-07`, off main (17cc2e3)``: the same State bullet ends "Branch: `long-campaign-stage-07`, off main (17cc2e3)".
    - Headings `## Request (user's words)`, `## Links`, `## Path`: now the State bullets "Request (user's words):", "Links:", "Path:" (the request quote, every link line and the Path sentence are verbatim).
  - The same check on this feature's record (`HEAD:docs/features/modular-context.md` against the new record and this log): 35 lines checked, 5 not found, all reformatting: the `**Request (user's words):**` line is the State bullet "Request (user's words): …" with the quote verbatim; `## Open questions` / `None.` is "Open questions: none."; `## Tiers` and its line are the State bullet "Tiers: designer opus; planner opus; steps as the plan index's task table (…)", the parenthesis verbatim. The bulleted decision log, the header bullets, the proposal and the Verification section are also kept verbatim under "Moved from the feature record (step 06)" above.
- Stage 7 record: State holds the request, slug, phase, next action (push and open a PR, the user's decision), branch, Path, links (with the new `log.md`), the resolved AGENTS.md question, compact tiers, the latest verdict of each gate, and the live carried-forward notes. Added as one carried-forward line, from verification lines now in the log: the market pays on the fall day, the fort warning reached only in unit tests, and the blight tint (stage 8 notes). The `refreshHint` nit is not carried: `e6d94ac` fixed it. No decision was superseded, so every Decision log row stays.
- This feature's record was reshaped (it had no `## State`): State from the orchestrator's brief; the decision bullets became the table, plus the two rows the brief added (the `docs/reference/` header exception and root `CLAUDE.md` at 6,783 bytes).
- Review round 1 (opus): changes needed, all fixed in one follow-up commit:
  1. Stage 7 State: range corrected to `17cc2e3..a51ed58` (code through `e6d94ac`); the branch also carries `06085b3`, `f0814da` and the unfinished modular-context work; the PR review ran at `ae59b5f` and must be re-run at the pushed head; open question for the user (the stage 7 PR waits for modular-context, includes it, or goes from a branch cut at `a51ed58`; blocks the push; the orchestrator recommends the cut); next action "the user answers the open question below; then re-run the PR review and push". The superseded Phase line is kept verbatim in the stage 7 `log.md` ("Superseded State"). To stay under the State cap, three of my own lines were tightened (plan log label, tiers, the resolved AGENTS.md question).
  2. The carried-forward line is labelled "Noted, not fixed:"; the blight tint is its own "Pre-existing:" item.
  3. This feature's State has a "Next action: step 06 review fixes, then step 07" field; Links say the design makes the proposal concrete and the verbatim proposal is in this `log.md`. Line 3 of `docs/designs/modular-context.md` repointed to match (authorized by the orchestrator for that line).
  - Sizes after round 1: `long-campaign-stage-07.md` 4,350 bytes, State 2,977; `modular-context.md` 3,553, State 1,550; stage 7 `log.md` 6,563. Line-set check rerun against the pre-step records: stage 7 5 not found (the four folded lines minus Phase, now in the stage 7 log; the three headings), this record 2 (the reformatted Request and Tiers lines); all justified as above.

## Step 07: the state/history split in the global skills

- 2026-11-21. Engineer opus; reviewer opus. Verdict: pending review; review rounds: 0. Ran on **[Q2]**'s default: the edits apply to every project.
- Blocker found and settled before any edit: every file under `/Users/ryan/.claude/skills/` is a symlink into the dotfiles git repository (`/Users/ryan/personal/dotfiles/home/.claude/skills/`), and the first backup held only links (17 links, 0 files), so it protected nothing and `diff -ru` against it could never show a change. The orchestrator replaced it with a dereferenced copy (0 links) and recorded the rule in the index (`690aa7b`). The edits were made at the dotfiles target paths and are left **uncommitted** in the dotfiles repository (committing it is the user's call); that repository's other uncommitted files (`README.md`, `home/.claude/settings.json`, `home/.codex/config.toml`, `home/.gemini/`) were not touched.
- Pre-edit: `diff -ru /Users/ryan/.claude/skills-backup-2026-11-21 /Users/ryan/.claude/skills` against the new backup printed only the expected "Only in" lines (`.trash`, `browser-auth`, `linear`, `pr-creator`, `recursive-slack`, `simulated-user`, `synced`, `technical-report-writing`); `git -C /Users/ryan/personal/dotfiles status --short -- home/.claude/skills` was empty. All eight old texts matched the task file.
- Edits 1a, 1b, 2a, 2b, 2c, 3, 4a, 4b applied. 1a: "It has two parts." starts a new paragraph after "…decision and escalation."; "It holds:" dropped; "Commit the record…" kept. 4b: the two "and"s joined with a comma.
- `git -C /Users/ryan/personal/dotfiles diff --stat -- home/.claude/skills`: 4 files changed, 10 insertions(+), 13 deletions(-) (`orchestrator/SKILL.md`, `plan-implementer/implement-step.md`, `plan-implementer/step-loop.md`, `planner/SKILL.md`).
- Second check: `diff -ru` against the new backup, restricted (`| grep -v '^Only in /Users/ryan/.claude/skills: '`), shows the same four files and no "Only in" line under a backed-up directory; its `+`/`-` lines are byte-identical to the git diff's (`cmp` of the extracted change lines).
- `npm test`: tsc clean, 98 test files, 2,417 tests passed (baseline the same).
- The record, `git -C /Users/ryan/personal/dotfiles diff -- home/.claude/skills`:

```diff
diff --git a/home/.claude/skills/orchestrator/SKILL.md b/home/.claude/skills/orchestrator/SKILL.md
index 3c285a9..43e1685 100644
--- a/home/.claude/skills/orchestrator/SKILL.md
+++ b/home/.claude/skills/orchestrator/SKILL.md
@@ -48,17 +48,11 @@ Rules:
 
 ## The feature record
 
-Keep one file per feature at `docs/features/<slug>.md` (follow project conventions if they place such records elsewhere). Create it at intake and update it at every phase change, decision and escalation. It holds:
+Keep one file per feature at `docs/features/<slug>.md` (follow project conventions if they place such records elsewhere). Create it at intake and update it at every phase change, decision and escalation.
 
-- the request in the user's words, the slug, and the current phase
-- links to the architecture brief, design, plan index, and branch or worktree
-- a **decision log**: each decision, who made it (user or orchestrator), the alternatives, and the reason
-- open questions, and what each one blocks
-- the model tier chosen per role and step, with escalations
-- verification outcomes: one line per step (tier, verdict, rounds), and the QA and simulated-user verdicts with the head SHA they ran against
-- notes carried forward to a later step, removed once that step has used them
+It has two parts. **State**, at the top, kept under about 3 KB: the request in the user's words, the slug, the phase and the next action; links to the architecture brief, design, plan index, plan `log.md`, and branch or worktree; open questions and what each blocks; the tier per role and step, with escalations; the latest verdict of each verification gate with its head SHA; and notes carried forward, removed once used. **Decision log**, below it: one row per decision in force (the decision, who made it, the alternatives, the reason). Replace a superseded row.
 
-You reread the record on every resume, so keep it an index, not a log. Findings, test counts, commit lists and fix narratives already live in the task files' execution records, the plan index and the review record; link to them instead of copying them. Replace a superseded entry rather than striking it through. When you resume a record that has grown into a log, trim it to this shape first and commit the trim on its own.
+History goes in the plan's `log.md` (`docs/implementation-plans/<slug>/log.md`), not the record: each step's verification line (tier, verdict, rounds), review and QA outcomes, fix narratives, measurements. Append to it; don't read it on resume. Findings, test counts and commit lists already in task files and the review record are linked, not copied. When you resume a record that has grown into a log, move its history to `log.md`, trim it to this shape, and commit that on its own.
 
 Commit the record with the documents it describes. Before implementation starts, commit it yourself, or leave it to the first engineer, who carries plan-folder files into its commit (see `implement-step.md`).
 
@@ -96,7 +90,7 @@ Tell the user the plan's size and order in a few lines. Stop and ask only if the
 
 Before the first step, settle the branch: on the default branch, ask whether to create a feature branch or worktree, unless project instructions already decide.
 
-Read `plan-implementer/step-loop.md` and run every step through it, with one override: each engineer and reviewer runs at the tier you assigned the step, and escalations go up from there. Record each escalation and each step's verdict in the feature record.
+Read `plan-implementer/step-loop.md` and run every step through it, with one override: each engineer and reviewer runs at the tier you assigned the step, and escalations go up from there. Record each escalation in the feature record and each step's verdict in the plan's `log.md`.
 
 If the user says the token budget is running short, offer cheaper tiers or deferrals, don't start a step the remaining budget may not cover, and stop only at a committed step boundary with the resume point in the feature record.
 
diff --git a/home/.claude/skills/plan-implementer/implement-step.md b/home/.claude/skills/plan-implementer/implement-step.md
index dde40fc..3fdffb3 100644
--- a/home/.claude/skills/plan-implementer/implement-step.md
+++ b/home/.claude/skills/plan-implementer/implement-step.md
@@ -36,6 +36,7 @@ Commit only on green, following the repository's message conventions and attribu
 - Run every verification check in the task file, plus the wider test suite and the project's lint, type-check and build. Fix what the step broke.
 - Confirm each completion criterion with evidence. If one can't be met, leave the step `in progress`, record why, and report.
 - Append an **Execution record** to your task file: commands run and results, budgets spent, deviations and their reasons, and what later steps need to know. If a deviation changes a contract a later task relies on, update the index and that task file. In the index, set the step `done` with its commits, and unblock steps this work resolved. Include these updates in the step's final commit.
+- Put figures and histories the plan accumulates (measurements, run tables) in the plan's `log.md`, not the index; create it if absent.
 
 Report: what now works; commits with hashes and subjects; each verification command and its actual result; budgets spent against caps; deviations, out-of-scope problems and decisions needed, with recommendations. Don't start the next step.
 
diff --git a/home/.claude/skills/plan-implementer/step-loop.md b/home/.claude/skills/plan-implementer/step-loop.md
index 67dad1f..17ebaf7 100644
--- a/home/.claude/skills/plan-implementer/step-loop.md
+++ b/home/.claude/skills/plan-implementer/step-loop.md
@@ -13,8 +13,8 @@ Steps run one at a time in the index's execution order. Run a parallel group the
 3. **Decisions.** If it stopped on a question, settle it from the plan, design and repository, or take it to the user. Reply with SendMessage so its context stays intact. A blocker no one can resolve now ends the run: have it recorded in the index, then report.
 4. **Review.** Brief a fresh reviewer with the repository path, plan path, step ID and the step's commit range. Don't pass along the engineer's account of its work.
 5. **Iterate.** Relay blocking findings to the same engineer, then its new commits and any disputes to the same reviewer. Judge disputes against the plan and design; only the ones neither settles go to the user. After two rounds without a clean verdict, replace the engineer with a fresh one a tier up, briefed with the open findings. After a third, stop and report.
-6. **Confirm.** The index marks the step `done`, the task file's execution record includes the review rounds, and the working tree is clean apart from changes that predate the run.
+6. **Confirm.** The index marks the step `done`, the task file's execution record includes the review rounds, the step's outcome line is in `log.md`, and the working tree is clean apart from changes that predate the run.
 
 ## Overall review
 
-After the last step in scope, brief a fresh reviewer with the base commit, `HEAD`, the plan path and the steps covered, and say it is the overall review. Send its findings to the last engineer via SendMessage (or a fresh one briefed with the findings) and iterate under the same rules. The outcome goes in the index's execution notes, committed by the engineer.
+After the last step in scope, brief a fresh reviewer with the base commit, `HEAD`, the plan path and the steps covered, and say it is the overall review. Send its findings to the last engineer via SendMessage (or a fresh one briefed with the findings) and iterate under the same rules. The outcome goes in the plan's `log.md`, committed by the engineer.
diff --git a/home/.claude/skills/planner/SKILL.md b/home/.claude/skills/planner/SKILL.md
index 7f1d8cb..fa7ed4b 100644
--- a/home/.claude/skills/planner/SKILL.md
+++ b/home/.claude/skills/planner/SKILL.md
@@ -24,6 +24,7 @@ Store the entire plan in that dedicated folder:
 ```text
 <feature-slug>/
   index.md
+  log.md
   01-<step-slug>.md
   02-<step-slug>.md
   ...
@@ -56,7 +57,8 @@ Include:
 - Execution order, any safe parallel groups, and integration checkpoints where needed. The index is the canonical record of overall task status and coordination.
 - A requirement-to-task mapping using the design's requirement IDs. If the design lacks IDs, assign local mapping labels without modifying its meaning.
 - Overall completion criteria, cross-task validation, and unresolved questions or blockers.
-- A brief instruction for implementers: update the step's status and commits here, and record evidence, deviations and blockers in the task file's execution record. Keep the index short; every implementer reads it.
+- Keep the index to what decides the next step. Anything that grows as steps finish (measurements, run histories, review summaries) goes in `log.md` in the plan folder, which the index links.
+- A brief instruction for implementers: update the step's status and commits here, and record evidence, deviations and blockers in the task file's execution record, and anything the plan as a whole accumulates in `log.md`. Keep the index short; every implementer reads it.
 
 ## Write each task file
 
```
