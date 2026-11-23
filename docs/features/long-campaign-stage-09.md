# Feature: long campaign, stage 9 (the outer rings)

## State

- Request (user's words):
  > The next thing is stage 9 of the long campaign: the outer rings. Its design is docs/designs/long-campaign/stage-09-outer-rings.md and it is marked "ready for planning". [...] As with stages 2–8, the approved stage design goes straight to the planner. Start with the bookkeeping commit, then cut a long-campaign-stage-09 branch off main and run the orchestrator. Balance bands are mine to change: bring any out-of-band figures to me.
- Slug `long-campaign-stage-09` · Phase 6, done · PR #11 open (https://github.com/ginstrom/yomi/pull/11) · Next action: the user merges it · Branch: `long-campaign-stage-09`, off main at 67e5f0d; pushed.
- Path: Large, but the stage design is the approved design. Straight to planning, as stages 2–8 did.
- Links:
  - Stages overview: `docs/designs/long-campaign/index.md`
  - Design: `docs/designs/long-campaign/stage-09-outer-rings.md` (status "ready for planning")
  - Previous stage: `docs/features/long-campaign-stage-08.md`
  - Plan: `docs/implementation-plans/long-campaign-stage-09/index.md` (10 steps, 5664289)
  - Plan log (history): `docs/implementation-plans/long-campaign-stage-09/log.md`
- Open questions: for the user at the report: in the real long campaign the home country sees about half the spawns (8.3 a campaign over 1272–1602 days vs 14.5 over 325 near the Source); proposed: defer to stage 12's spawn retune.
- Tiers (engineer / reviewer): planner opus; 01, 02, 04, 05, 08, 09 opus / opus; 03, 06, 07, 10 sonnet / opus (07 to opus if frame time is poor for an unknown cause). No escalations.
- Worktrees: 03 and 06 run in their own worktrees and leave index.md and log.md alone; the orchestrator merges them and the next engineer records their status and log lines.
- Verification: overall review (opus) clean at 296dc0c, ready for a PR (npm test 2632, build, e2e after reruns, 50-check 57fdea15…). QA (sonnet) re-check: pass at 296dc0c; its encampment stock defect fixed in a125235 (not re-reviewed). Simulated user: goals 1, 2, 4 met; 3, 5, 6 partly. Evidence: `.git/pr-review/long-campaign-stage-09/evidence/`. pr-reviewer: ready at a225599 (5 CRISP findings fixed in d593b34, 6dbaa99, 6b51b72, 76b0cf5, a225599; 2 simulator findings dismissed); record `.git/pr-review/long-campaign-stage-09.md`.
- Carried forward (from stage 8 and earlier, for this plan):
  - The Routes tab shows at most 4 rows, no paging; a test fails once PARTNERS exceeds 4 (stage 9 adds 3).
  - A route whose raid comes and goes between yield days is never abandoned (count resets when told safe); unmeasured.
  - The simulator never raided or abandoned a route (500 campaigns, `--trading-post 4`): RAID_RADIUS / ABANDON_AFTER unjudged; the bigger map may show.
  - From stage 6: at ready level 10 the company wins no more often than one party on today's map; stage 9 to look again.
  - `src/game/CLAUDE.md` is at its 8 KB cap: make room before adding a rule.
  - Waiting for stage 12, not this stage: market income, the simulator's spend order (works, forts, market levels), full-campaign route figures.

## Decision log

| Date | Decision | By | Alternatives | Reason |
|---|---|---|---|---|
| 2026-11-22 | Skip architecture and design; the stage design is the approved design | user | new design | Marked ready for planning; precedent stages 2–8 |
| 2026-11-22 | Merge PR #10 before branching (it was still open) | user | branch off stage 8 | Stage 9 builds on stage 8 |
| 2026-11-22 | Own branch `long-campaign-stage-09` off main | user | — | One branch and PR per stage |
| 2026-11-22 | Early figures, refactor guard and 50-check run with a simulator-only `--near-source` (Source at its stage-8 spot, threat 5); band values unchanged | user | redefine the early bands; drop early figures to stage 12 | Plan question 1; keeps the bands' meaning |
| 2026-11-22 | Accept the plan's readings: axial shift (q −9, r +17); new spawn kinds only from threat 7; Masterwork steel from threat 8; the rune loot rows; three partner sprites (step 06) | user | literal +17 rows; drop step 06 | Recommended; the literal shift changes early distances |
| 2026-11-22 | Accept the planner's other departures (index decisions) and tiers | orchestrator | — | Routine engineering choices |
| 2026-11-22 | Under `--near-source`, the simulator's world leaves out the fixed nests above threat 5 (fix B); far sites and partners stay | user | accept the new meaning; only filter nextTarget (fix A) | Outer corruption halved home spawns, so the early check no longer measured the early game |
| 2026-11-23 | Runtime gate failed (long 100 ≈ 20 min, 500 ≈ 101 min; day cost 3×): make only byte-identical speed-ups; step 09 uses 100-campaign long runs | user | add the blight's far-hex skip (design change); go on as is | Recommended; keeps every result |
| 2026-11-23 | Accept one 288, company 289, one's days 331 (out of band) until stage 12; SPAWN_DIVISOR stays 840 | user | divisor 300 or 400 | Design's per-hex rule; noisy response; stage 12 retunes |
| 2026-11-23 | Step 09 may tune the Source Guardians' block at threats 6–20 only (threats 1–5 unchanged) until winnable | user | defer to stage 11 | The count alone can't: 0 wins at 5, 4, 3 guards (foe scaling) |
| 2026-11-23 | The company's long-campaign policy skew (replacements sent far above their level) waits for stage 12 | user | fix in stage 9 | Stage 12 retunes the simulator's policies |
| 2026-11-23 | Open the stage 9 PR (#11, ready) before stage 10, which branches off main after it merges | user | branch stage 10 off stage 9 | One PR per stage off main |
