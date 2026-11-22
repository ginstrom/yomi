# Feature: long campaign, stage 9 (the outer rings)

## State

- Request (user's words):
  > The next thing is stage 9 of the long campaign: the outer rings. Its design is docs/designs/long-campaign/stage-09-outer-rings.md and it is marked "ready for planning". [...] As with stages 2–8, the approved stage design goes straight to the planner. Start with the bookkeeping commit, then cut a long-campaign-stage-09 branch off main and run the orchestrator. Balance bands are mine to change: bring any out-of-band figures to me.
- Slug `long-campaign-stage-09` · Phase 3, planning · Next action: check the planner's index, assign tiers · Branch: `long-campaign-stage-09`, off main at 67e5f0d (PR #10 merged by the orchestrator at the user's word, f1bb2dd; bookkeeping 67e5f0d on main, not pushed).
- Path: Large, but the stage design is the approved design. Straight to planning, as stages 2–8 did.
- Links:
  - Stages overview: `docs/designs/long-campaign/index.md`
  - Design: `docs/designs/long-campaign/stage-09-outer-rings.md` (status "ready for planning")
  - Previous stage: `docs/features/long-campaign-stage-08.md`
  - Plan: `docs/implementation-plans/long-campaign-stage-09/index.md` (pending)
  - Plan log (history): `docs/implementation-plans/long-campaign-stage-09/log.md`
- Open questions: none yet.
- Tiers (engineer / reviewer): planner opus.
- Verification: none yet.
- Carried forward (from stage 8 and earlier, for this plan):
  - The Routes tab shows at most 4 rows, no paging; a test fails once PARTNERS exceeds 4 (stage 9 adds 3).
  - A route whose raid comes and goes between yield days is never abandoned (count resets when told safe); unmeasured.
  - The simulator never raided or abandoned a route (500 campaigns, `--trading-post 4`): RAID_RADIUS / ABANDON_AFTER unjudged; the bigger map may show.
  - From stage 6: at ready level 10 the company wins no more often than one party on today's map; stage 9 to look again.
  - `src/game/CLAUDE.md` is at its 8 KB cap: make room before adding a rule.
  - Waiting for stage 12, not this stage: market income, the simulator's spend order (works, forts, market levels), full-campaign route figures.
  - For the user, outside the stages: the world header doesn't refresh behind the trading post; world-blight.png shows no corrupted land.

## Decision log

| Date | Decision | By | Alternatives | Reason |
|---|---|---|---|---|
| 2026-11-22 | Skip architecture and design; the stage design is the approved design | user | new design | Marked ready for planning; precedent stages 2–8 |
| 2026-11-22 | Merge PR #10 before branching (it was still open) | user | branch off stage 8 | Stage 9 builds on stage 8 |
| 2026-11-22 | Own branch `long-campaign-stage-09` off main | user | — | One branch and PR per stage |
