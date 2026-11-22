# Feature: long campaign, stage 9 (the outer rings)

## State

- Request (user's words):
  > The next thing is stage 9 of the long campaign: the outer rings. Its design is docs/designs/long-campaign/stage-09-outer-rings.md and it is marked "ready for planning". [...] As with stages 2–8, the approved stage design goes straight to the planner. Start with the bookkeeping commit, then cut a long-campaign-stage-09 branch off main and run the orchestrator. Balance bands are mine to change: bring any out-of-band figures to me.
- Slug `long-campaign-stage-09` · Phase 4, implementation · Next action: review step 08; then 07 (worktree) alongside 09. 01–06 done and reviewed clean · Branch: `long-campaign-stage-09`, off main at 67e5f0d (67e5f0d on main, not pushed).
- Path: Large, but the stage design is the approved design. Straight to planning, as stages 2–8 did.
- Links:
  - Stages overview: `docs/designs/long-campaign/index.md`
  - Design: `docs/designs/long-campaign/stage-09-outer-rings.md` (status "ready for planning")
  - Previous stage: `docs/features/long-campaign-stage-08.md`
  - Plan: `docs/implementation-plans/long-campaign-stage-09/index.md` (10 steps, 5664289)
  - Plan log (history): `docs/implementation-plans/long-campaign-stage-09/log.md`
- Open questions: none. For step 09 to bring to the user: `one` 288/500 at step 08 (band 215–250); the long run 0/100 beat the Source (make it winnable); the 50-check rose 22 → 28 at step 04 (+2 board, +4 SPAWN_DIVISOR 840); in the real long campaign the home country sees about half the spawns (outer corruption draws them out).
- Tiers (engineer / reviewer): planner opus; 01, 02, 04, 05, 08, 09 opus / opus; 03, 06, 07, 10 sonnet / opus (07 to opus if frame time is poor for an unknown cause). No escalations.
- Worktrees: 03 and 06 run in their own worktrees and leave index.md and log.md alone; the orchestrator merges them and the next engineer records their status and log lines.
- Verification: none yet (step verdicts in the plan's log.md). Baseline at 5664289: one 233, company 232, rl10 433; 50-check b50f7b50… (identical through step 02 with `--near-source`).
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
