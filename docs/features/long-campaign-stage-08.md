# Feature: long campaign, stage 8 (trade partners and routes)

## State

- Request (user's words):
  > The next thing is stage 8 of the long campaign: trade partners and routes. Its design is docs/designs/long-campaign/stage-08-trade-routes.md and it is marked "ready for planning". [...] I'd start with the bookkeeping commit, then cut a long-campaign-stage-08 branch off main and run the orchestrator.
- Slug `long-campaign-stage-08` · Phase 3, planning · Next action: check the planner's index, assign tiers · Branch: `long-campaign-stage-08`, off main (after the bookkeeping commit for #8/#9).
- Path: Large, but the stage design is the approved design. Straight to planning, as stages 2–7 did.
- Links:
  - Stages overview: `docs/designs/long-campaign/index.md`
  - Design: `docs/designs/long-campaign/stage-08-trade-routes.md` (status "ready for planning")
  - Reference: `docs/designs/long-campaign/reference/economy-and-trade-routes.md` §4.3–§4.6, §5; `reference/multiple-parties.md` R10
  - Previous stage: `docs/features/long-campaign-stage-07.md` (carried-forward notes)
  - Plan: [`docs/implementation-plans/long-campaign-stage-08/index.md`](../implementation-plans/long-campaign-stage-08/index.md) (8 steps)
  - Plan log (history): `docs/implementation-plans/long-campaign-stage-08/log.md`
- Open questions: the plan's index, "Open questions" (none blocks a step; defaults taken).
- Tiers (engineer / reviewer): planner opus; steps as in the plan's task table (01, 02, 07, 08 opus / opus; 03–06 sonnet / opus).
- Verification: none yet.
- Carried forward:
  - From stage 7: the Lodge level 3 sprite (milestone reads as a bottle, paving faint, 2→3 jump weak at 1x) is to be redrawn now that level 3 becomes reachable.
  - From stage 7, not this stage: market income and the simulator's spend order (works, forts, market levels) wait for stage 12's retune.

## Decision log

| Date | Decision | By | Alternatives | Reason |
|---|---|---|---|---|
| 2026-11-21 | Skip architecture and design; the stage design is the approved design | orchestrator | new design | Marked ready for planning; precedent stages 2–7 |
| 2026-11-21 | Own branch `long-campaign-stage-08` off main | user | commit on main | Precedent: one branch and PR per stage |
