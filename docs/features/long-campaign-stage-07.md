# Feature: long campaign, stage 7 (site improvements and markets)

**Slug:** long-campaign-stage-07
**Phase:** 4, implementation (step 01)

## Request (user's words)

> After that, stage 7 (site improvements and markets) is next on the roadmap.

## Links

- Stages overview: `docs/designs/long-campaign/index.md` (cross-stage rules: early-game guard re-measured at start, versions, docs, sprites, play script)
- Design: `docs/designs/long-campaign/stage-07-site-improvements-and-markets.md` (status "ready for planning")
- Reference: `docs/designs/long-campaign/reference/economy-and-trade-routes.md` §4.1, §4.2, §5.1, §5.2, §5.4
- Previous stage: `docs/features/long-campaign-stage-06.md` (known issues); auto-resolve and battle cost landed on main since
- Plan: `docs/implementation-plans/long-campaign-stage-07/` (7 steps, 3416f16)
- Branch: `long-campaign-stage-07`, off main (17cc2e3)

## Path

Large, but the stage design is the approved design. Straight to planning, as stages 2–6 did.

## Decision log

| Date | Decision | By | Alternatives | Reason |
|---|---|---|---|---|
| 2026-11-20 | Skip architecture and design; the stage design is the approved design | orchestrator | new design | Marked ready for planning; precedent stages 2–6 |
| 2026-11-20 | Accept the planner's departures (index decisions): party args, `improve` day action, event shapes, optional yield `source`, extra sprites, debug commands, Lodge 3 refusal | orchestrator | follow design to the letter | routine engineering choices following the code's conventions |
| 2026-11-20 | Own branch `long-campaign-stage-07` off main | orchestrator | commit on main | Precedent: one branch and PR per stage |

## Open questions

- Plan decision 8 (waiting check: idle-company twin compared on income per day, behind `--waiting` if >10% runtime), decision 6 (Improve button visible with reason when the Lodge is too low), decision 13 (hex info / 'Last yield' wording): defaults taken, asked of the user 2026-11-20. 8 blocks step 06; 6 and 13 block step 04.

## Tiers

- Planner: opus
- Steps (engineer / reviewer, planner's suggestions): 01 opus/opus; 02 sonnet/opus; 03 sonnet/opus; 04 sonnet/opus; 05 sonnet/opus; 06 opus/opus; 07 opus/opus; overall review opus
- Order: 01 → 02 → {04 → 05 on branch; 06 in a worktree, merged after 04}; 03 any time in a worktree, merged before 04; 07 last
