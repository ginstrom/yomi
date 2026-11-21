# Feature: long campaign, stage 8 (trade partners and routes)

## State

- Request (user's words):
  > The next thing is stage 8 of the long campaign: trade partners and routes. Its design is docs/designs/long-campaign/stage-08-trade-routes.md and it is marked "ready for planning". [...] I'd start with the bookkeeping commit, then cut a long-campaign-stage-08 branch off main and run the orchestrator.
- Slug `long-campaign-stage-08` · Phase 4, implementation (01–04 done; 05 review clean, follow-ups running; 07 in worktree `long-campaign-stage-08-sim`) · Next action: step 06 after 05; merge 07 after its review · Branch: `long-campaign-stage-08`, off main (after the bookkeeping commit for #8/#9).
- Path: Large, but the stage design is the approved design. Straight to planning, as stages 2–7 did.
- Links:
  - Stages overview: `docs/designs/long-campaign/index.md`
  - Design: `docs/designs/long-campaign/stage-08-trade-routes.md` (status "ready for planning")
  - Reference: `docs/designs/long-campaign/reference/economy-and-trade-routes.md` §4.3–§4.6, §5; `reference/multiple-parties.md` R10
  - Previous stage: `docs/features/long-campaign-stage-07.md` (carried-forward notes)
  - Plan: [`docs/implementation-plans/long-campaign-stage-08/index.md`](../implementation-plans/long-campaign-stage-08/index.md) (8 steps)
  - Plan log (history): `docs/implementation-plans/long-campaign-stage-08/log.md`
- Open questions: none (the road's raid range settled by the user, 2026-11-21).
- Tiers (engineer / reviewer): planner opus; steps as in the plan's task table (01, 02, 07, 08 opus / opus; 03–06 sonnet / opus).
- Verification: none yet.
- Carried forward:
  - Step 08: screenshots must show an amber road stretch and a road over blight tints (step 05 review). Index decision 13 and C5 raided-road wording to update from steps 07/05 reports.
  - Accepted, not fixed: a road's shape (avoiding unsighted nests, decision 6) can hint at nests in the fog; the Routes preview's security, income and corruption cause use the true blight, not `seen` (follows C6 and decision 8).
  - Stage 9: the Routes tab shows at most 4 rows with no paging (a test trips when PARTNERS exceeds it).
  - Full in-browser suite stalled for the step 01 reviewer (~34 min, killed); run it in verification.
  - From stage 7: the Lodge level 3 sprite (milestone reads as a bottle, paving faint, 2→3 jump weak at 1x) is to be redrawn now that level 3 becomes reachable.
  - From stage 7, not this stage: market income and the simulator's spend order (works, forts, market levels) wait for stage 12's retune.

## Decision log

| Date | Decision | By | Alternatives | Reason |
|---|---|---|---|---|
| 2026-11-21 | Skip architecture and design; the stage design is the approved design | orchestrator | new design | Marked ready for planning; precedent stages 2–7 |
| 2026-11-21 | Own branch `long-campaign-stage-08` off main | user | commit on main | Precedent: one branch and PR per stage |
| 2026-11-21 | No save migration: SAVE_VERSION 27 → 28, old saves unreadable (plan decision 15 revised) | user | `migrateFrom27` | User's choice; root CLAUDE.md: no migration unless a design asks |
| 2026-11-21 | The road prefers paths more than RAID_RADIUS from every nest, falling back to avoiding nests and their neighbours | user | keep the design's rule, warn in the preview | No route raided on the day it opens |
| 2026-11-21 | Plan decisions 5 (raid told once, abandon on sixth raided yield day), 9 (towers within 3 hexes of a tainted road hex), 12 (simulator Lodge 3 once a route is open) stand | user | change them | Recommended |
| 2026-11-21 | Accept the planner's other departures (index decisions) and tiers (01, 02, 07, 08 opus/opus; 03–06 sonnet/opus) | orchestrator | follow the design to the letter | Routine engineering choices |
| 2026-11-22 | The simulator's contact detour runs only once the trading post allows routes (level 4); decision 13 revised | user | accept the out-of-band move (304/500); detour only near the path | As planned, one party went 239 → 304 (band 215–250) from the detour alone; gated, the 50-check returns to baseline |
| 2026-11-22 | Step 05 follow-ups: grey a partner only when contacted or in sight; a raided road's hover says it pays nothing | orchestrator | as contracted | Decision 3 (silence told only for contacted); a raided route pays nothing |
