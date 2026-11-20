# Feature: long campaign, stage 7 (site improvements and markets)

**Slug:** long-campaign-stage-07
**Phase:** 4, implementation (step 04)

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
| 2026-11-20 | Plan decisions 8, 6, 13 as recommended: waiting check is an idle-company twin (behind `--waiting` if >10% runtime); Improve button visible with the reason when the Lodge is too low; hex info and unsaved 'Last yield' wording as written | user | literal 'gold per day at home'; hide button; save last yield | Recommended |
| 2026-11-20 | Accept the planner's departures (index decisions): party args, `improve` day action, event shapes, optional yield `source`, extra sprites, debug commands, Lodge 3 refusal | orchestrator | follow design to the letter | routine engineering choices following the code's conventions |
| 2026-11-20 | Own branch `long-campaign-stage-07` off main | orchestrator | commit on main | Precedent: one branch and PR per stage |

## Open questions

- None.

## Tiers

- Planner: opus
- Steps (engineer / reviewer, planner's suggestions): 01 opus/opus; 02 sonnet/opus; 03 sonnet/opus; 04 sonnet/opus; 05 sonnet/opus; 06 opus/opus; 07 opus/opus; overall review opus
- Order: 01 → 02 → {04 → 05 on branch; 06 in a worktree, merged after 04}; 03 any time in a worktree, merged before 04; 07 last

## Verification

- Baseline (step 01, seed 1, 500): `--parties 1` 234/500; default company 236/500; 50-campaign hash 5f92e363…
- 01 (494cddb + 88afcf7, opus): 50 hash unchanged; npm test 2353; world e2e 58; build. Review (opus): clean, 1 round; hash re-verified before/after; v26 fixture genuine; 15/16 mutations caught. Two test nits to step 02.
- 03 (a94e044, sonnet, worktree branch `long-campaign-stage-07-sprites` at .claude/worktrees/agent-adaf679f85afb4743): sprites:check 126; npm test. Review (opus): clean. Merged into the stage branch; worktree removed.
- 02 (0619dbf, sonnet): 50 hash unchanged (simulator capped at trading post 4); npm test 2367. Review (opus): clean, 1 round; nits: duplicated `wares` sentence in docs/reference/game.md (to step 04); market pays on the day the encampment falls (harmless, by design; note for stage 8).
- 04 (b20054e + bd9ba57, sonnet): Improve button, palisade, events, Last yield; compact label at 840 and a "Next:" hex line (reviewer: within user decisions 6/13). Review (opus): changes needed — label not re-chosen on resize (blocking); stale-visibility count; record misdescribes peat-label.png; no Outpost hexInfo test; refusal plural. Fixing (same engineer).
- 06 (560c660, opus, worktree branch `long-campaign-stage-07-sim`): improveErrand, Lodge/market raised, record fields, waiting twin behind `--waiting` (twin ≈ +20% per campaign, reviewer's stable measure). 50 (`--waiting`) hash 1ceefe63…, Source 23/50; guard re-recorded once (a179187a…). Review (opus): clean; guard change decomposed to the simulated economy (Lodge stock kept + Lodge raised); `--waiting` changes no play. At merge: delete `outpostSite`/`outpostSiteRefusal` + their test, CLAUDE.md/game.md wrapper sentences; fix the twin's cost to "about a fifth again"; index hash; fixture indent.

## Carried forward

- To step 04: empty encampmentView.test.ts's `pending` frame set (art merged); delete the duplicated `wares(world, filter)` sentence in docs/reference/game.md (Trading post paragraph).
- To step 05: drop the `.slice(0, 5)` in encampmentView.test.ts's plot test.

- Lodge level 3 sprite: milestone reads as a bottle, paving faint, level 2→3 jump weak at 1x. Level 3 is unreachable until stage 8 (`LODGE_LEVEL_LIMIT` 2); redraw in stage 8.
- `forecast.test.ts` "a level-1 party wins no fight with the Source at threat 5" times out (5 s) under full-suite load; passes alone.
- Sprite-tool pin drift: art/CLAUDE.md pins v0.6.0, host has 0.7.0 (no export changed).
