# Feature: modular context and skills

## State

- Request (user's words): "Please examine your workflows. Can you selectively load context depending on what you are working on? For example, design vs asset creation, coding, planning, etc. Can some of this be offloaded to skills so the main orchestrator does not need to hold as much context? Please think about how to design your context/skill system to be more modular." Then, after the proposal: "please replace AGENTS.md with a simlink, and then go through the suggested order".
- Slug `modular-context` · Phase 4, implementation. Phase 6, done on branch (`f0814da..` this commit); not pushed. · Next action: the user approves pushing; then pr-creator for both PRs · Branch: `modular-context` (split off 2026-11-21: holds everything after `a51ed58`, incl. `06085b3`, `f0814da`, the stage 7 loose ends and `overlay-frame-scaling`; PR base `long-campaign-stage-07`)
- Links: architecture none (the approved proposal is the architecture); design `docs/designs/modular-context.md` (makes the approved proposal of 2026-11-21 concrete; the verbatim proposal is in the plan's `log.md`); plan `docs/implementation-plans/modular-context/index.md` (13 steps, four stages; per-step tiers in its task table); plan log `docs/implementation-plans/modular-context/log.md`.
- Open questions: none. Global-skill edits committed in dotfiles as `16f02ab` (its `main`, not pushed; only `home/.claude/skills`).
- Tiers: designer opus; planner opus; steps as the plan index's task table (opus for 01, 06, 07, 09; sonnet engineers elsewhere, reviewers at least the engineer's tier).
- Verification: per step, the plan's `log.md`. Overall review (opus): changes needed, 1 blocking (the QA profile's never-kill rule); fixed in `cd0b29b`; re-review clean (98 files, 2,419 tests; build passed). QA and simulated user: not run (an instructions refactor; the step 09 smoke check and step 13 trigger check exercise what agents read and pick). PR review (as the `modular-context` branch, base `long-campaign-stage-07`): ready at `9177dd6`; record `.git/pr-review/modular-context.md`.
- Carried forward: none.

## Decision log

| Date | Decision | By | Alternatives | Reason |
|---|---|---|---|---|
| 2026-11-21 | AGENTS.md becomes a symlink to `CLAUDE.md`; done in `f0814da` | user | keep the copy | |
| 2026-11-21 | Path: medium, no architecture brief | orchestrator | architecture brief | The approved proposal is the architecture; the designer writes a design that makes it concrete |
| 2026-11-21 | Design gate: the design proceeds to planning unless it departs from the proposal or raises questions only the user can answer | orchestrator | ask the user to approve the design | The user approved the proposal and asked to go through the order |
| 2026-11-21 | Ship: PR review, then a PR stacked on the stage 7 PR (cut at `a51ed58`); the dotfiles skill edits are committed (`16f02ab`), not pushed | user | merge into local main; one combined PR | |
| 2026-11-21 | Global skills: every file under `~/.claude/skills/` is a symlink into the dotfiles git repository; edit the targets, record with `git diff` there, and leave them uncommitted (the user's repository). A real copy is at `~/.claude/skills-backup-2026-11-21/`, since the first copy held only links. Edits stay generic and backward compatible | orchestrator | commit in dotfiles | Other projects use them; step 07 found the links |
| 2026-11-21 | Design written (`docs/designs/modular-context.md`); it follows the proposal, so no approval gate | orchestrator | | Per the design gate above |
| 2026-11-21 | Bands live in `.claude/skills/yomi-balance/bands.md` | user | `docs/reference/` | |
| 2026-11-21 | The global skills' state/history split applies to every project | user | opt-in through a role profile | |
| 2026-11-21 | Always-loaded cap 8,500 bytes | user | 7,500 | |
| 2026-11-21 | Plan accepted; its four open points settled in the index; `yomi-measure` runs in the foreground, without `Monitor` | orchestrator | background runs | Subagent rules forbid waiting on background jobs |
| 2026-11-21 | Repoint the header lines of `docs/reference/simulator.md` (step 02) and `docs/reference/game.md` (step 04) | orchestrator | leave them stale | An exception to "docs/reference stays": the lines were made wrong by the move |
| 2026-11-21 | Root `CLAUDE.md` may exceed the design's 6,500-byte target (6,632 at `cd0b29b`; always-loaded 8,052) | orchestrator | trim by rewording | The target is not a cap; step 13's rewording trims changed meaning and were restored |
| 2026-11-21 | Wording fixes beyond design §5.3 and §4.7 in the global skills: who writes a step's outcome line in `log.md` (the engineer, told by the orchestrator), the plan folder's `log.md`, stalls in `log.md`, no `log.md` without a plan | orchestrator | leave the gaps | Step 07 and 09 reviews found the skills disagreeing |
| 2026-11-21 | Pointer repairs outside the plan's file scope: `tools/audio/yomi_audio/tts/models.py:6` (comment) and `docs/features/audio-pass.md` (legacy record) | orchestrator | leave stale | The moves made them wrong; recorded in the plan's `log.md` (step 11) |
| 2026-11-21 | No QA or simulated-user pass | orchestrator | run them | Nothing user-facing changed; agent behaviour was checked by the smoke and trigger checks |
