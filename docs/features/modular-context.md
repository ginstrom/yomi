# Feature: modular context and skills

## State

- Request (user's words): "Please examine your workflows. Can you selectively load context depending on what you are working on? For example, design vs asset creation, coding, planning, etc. Can some of this be offloaded to skills so the main orchestrator does not need to hold as much context? Please think about how to design your context/skill system to be more modular." Then, after the proposal: "please replace AGENTS.md with a simlink, and then go through the suggested order".
- Slug `modular-context` · Phase 4, implementation. Stages 1–3 (steps 01–09) are done and reviewed clean; step 09's outcome-line follow-up is in progress. · Next action: step 10 (stage 4) · Branch: `long-campaign-stage-07` (the current branch; project rule: commit on the current branch)
- Links: architecture none (the approved proposal is the architecture); design `docs/designs/modular-context.md` (makes the approved proposal of 2026-11-21 concrete; the verbatim proposal is in the plan's `log.md`); plan `docs/implementation-plans/modular-context/index.md` (13 steps, four stages; per-step tiers in its task table); plan log `docs/implementation-plans/modular-context/log.md`.
- Open questions: for the user, at the end of the feature: commit the global-skill edits in the dotfiles repository (uncommitted there, steps 07 and 09)? It blocks nothing here. The stage 7 PR question is in stage 7's record.
- Tiers: designer opus; planner opus; steps as the plan index's task table (opus for 01, 06, 07, 09; sonnet engineers elsewhere, reviewers at least the engineer's tier).
- Verification: per step, the plan's `log.md`. No feature-level gate (overall review, QA, simulated user, PR review) has run yet.
- Carried forward: none.

## Decision log

| Date | Decision | By | Alternatives | Reason |
|---|---|---|---|---|
| 2026-11-21 | AGENTS.md becomes a symlink to `CLAUDE.md`; done in `f0814da` | user | keep the copy | |
| 2026-11-21 | Path: medium, no architecture brief | orchestrator | architecture brief | The approved proposal is the architecture; the designer writes a design that makes it concrete |
| 2026-11-21 | Design gate: the design proceeds to planning unless it departs from the proposal or raises questions only the user can answer | orchestrator | ask the user to approve the design | The user approved the proposal and asked to go through the order |
| 2026-11-21 | Global skills: every file under `~/.claude/skills/` is a symlink into the dotfiles git repository; edit the targets, record with `git diff` there, and leave them uncommitted (the user's repository). A real copy is at `~/.claude/skills-backup-2026-11-21/`, since the first copy held only links. Edits stay generic and backward compatible | orchestrator | commit in dotfiles | Other projects use them; step 07 found the links |
| 2026-11-21 | Design written (`docs/designs/modular-context.md`); it follows the proposal, so no approval gate | orchestrator | | Per the design gate above |
| 2026-11-21 | Bands live in `.claude/skills/yomi-balance/bands.md` | user | `docs/reference/` | |
| 2026-11-21 | The global skills' state/history split applies to every project | user | opt-in through a role profile | |
| 2026-11-21 | Always-loaded cap 8,500 bytes | user | 7,500 | |
| 2026-11-21 | Plan accepted; its four open points settled in the index; `yomi-measure` runs in the foreground, without `Monitor` | orchestrator | background runs | Subagent rules forbid waiting on background jobs |
| 2026-11-21 | Repoint the header lines of `docs/reference/simulator.md` (step 02) and `docs/reference/game.md` (step 04) | orchestrator | leave them stale | An exception to "docs/reference stays": the lines were made wrong by the move |
| 2026-11-21 | Root `CLAUDE.md` accepted at 6,783 bytes, over the design's 6,500 target | orchestrator | trim further | The always-loaded total of 7,431 is under the 8,500 cap |
| 2026-11-21 | Wording fixes beyond design §5.3 and §4.7 in the global skills: who writes a step's outcome line in `log.md` (the engineer, told by the orchestrator), the plan folder's `log.md`, stalls in `log.md`, no `log.md` without a plan | orchestrator | leave the gaps | Step 07 and 09 reviews found the skills disagreeing |
