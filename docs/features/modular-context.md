# Feature: modular context and skills

**Request (user's words):** "Please examine your workflows. Can you selectively load context depending on what you are working on? For example, design vs asset creation, coding, planning, etc. Can some of this be offloaded to skills so the main orchestrator does not need to hold as much context? Please think about how to design your context/skill system to be more modular." Then, after the proposal: "please replace AGENTS.md with a simlink, and then go through the suggested order".

- **Slug:** `modular-context`
- **Phase:** 4, implementation (step 01 next)
- **Branch:** `long-campaign-stage-07` (the current branch; project rule: commit on the current branch)
- **Design:** `docs/designs/modular-context.md`
- **Plan:** `docs/implementation-plans/modular-context/index.md` (13 steps, four stages; per-step tiers in its task table)

## The approved proposal (from the conversation, 2026-11-21)

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

## Decision log

- **AGENTS.md** → symlink to `CLAUDE.md` (user). Done in `f0814da`.
- **Path: medium, no architecture brief** (orchestrator). The approved proposal is the architecture; the designer writes a design that makes it concrete.
- **Design gate** (orchestrator): the user approved the proposal and asked to go through the order, so the design proceeds to planning unless it departs from the proposal or raises questions only the user can answer.
- **Global skills (`~/.claude/skills/`) are not in git** (orchestrator): backed up to `~/.claude/skills-backup-2026-11-21/` before any edit. Edits there must stay generic and backward compatible for other projects.

- **Design written** (`docs/designs/modular-context.md`); it follows the proposal, so no approval gate (orchestrator, per the decision above).
- **Bands live in `.claude/skills/yomi-balance/bands.md`** (user, 2026-11-21; alternative: `docs/reference/`).
- **The global skills' state/history split applies to every project** (user; alternative: opt-in through a role profile).
- **Always-loaded cap 8,500 bytes** (user; alternative: 7,500).
- **Plan accepted**; its four open points settled in the index; `yomi-measure` runs in the foreground, without `Monitor` (orchestrator: subagent rules forbid waiting on background jobs).

## Open questions

None.

## Tiers

- Designer: opus. Planner: opus. Steps: as the plan index's task table (opus for 01, 06, 07, 09; sonnet engineers elsewhere, reviewers at least the engineer's tier).

## Verification

Not started.
