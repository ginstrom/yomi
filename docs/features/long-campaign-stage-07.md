# Feature: long campaign, stage 7 (site improvements and markets)

## State

- Request (user's words):
  > After that, stage 7 (site improvements and markets) is next on the roadmap.
- Slug `long-campaign-stage-07` · Phase 6, done on branch (17cc2e3..a51ed58; code through `e6d94ac`); not pushed · Next action: loose ends below in progress; then the PR review at a stage 7 branch cut at `a51ed58`, and the PR · Branch: `long-campaign-stage-07`, off main (17cc2e3). The branch also carries `06085b3`, `f0814da` and the unfinished modular-context work.
- Path: Large, but the stage design is the approved design. Straight to planning, as stages 2–6 did.
- Links:
  - Stages overview: `docs/designs/long-campaign/index.md` (cross-stage rules: early-game guard re-measured at start, versions, docs, sprites, play script)
  - Design: `docs/designs/long-campaign/stage-07-site-improvements-and-markets.md` (status "ready for planning")
  - Reference: `docs/designs/long-campaign/reference/economy-and-trade-routes.md` §4.1, §4.2, §5.1, §5.2, §5.4
  - Previous stage: `docs/features/long-campaign-stage-06.md` (known issues); auto-resolve and battle cost landed on main since
  - Plan: `docs/implementation-plans/long-campaign-stage-07/` (7 steps, 3416f16)
  - Plan log (history): `docs/implementation-plans/long-campaign-stage-07/log.md`
- Open questions:
  - Resolved: AGENTS.md, by `f0814da` (now a symlink to CLAUDE.md).
- Tiers (engineer / reviewer): planner opus; steps 01, 06, 07 opus/opus, 02–05 sonnet/opus; overall review opus.
- Verification (latest verdict of each gate):
  - Overall review: changes needed at 049dc22; after fix round 1 (6405b5c) the re-review is clean, ready for a PR.
  - QA (sonnet) at 049dc22: pass.
  - Simulated user (sonnet) at 049dc22: goals 1, 2, 4 met; 3 partly.
  - PR review at ae59b5f: no critical; 4 of 5 observations fixed in e6d94ac (npm test 2394, build), 1 dismissed. Record: `.git/pr-review/long-campaign-stage-07.md`. Re-run it at whatever head is pushed.
- Carried forward:
  - For the user: the simulator never builds works/forts or market levels (spend order is the lever). Possible follow-up: let overlay frames scale above 1 on large windows (encampment buildings stay 96 px at 1280).
  - Lodge level 3 sprite: milestone reads as a bottle, paving faint, level 2→3 jump weak at 1x. Level 3 is unreachable until stage 8 (`LODGE_LEVEL_LIMIT` 2); redraw in stage 8.
  - Noted, not fixed: the market pays on the day the encampment falls (harmless, by design); the fort days-to-corruption warning is reached only in unit tests.
  - Pre-existing: blight tint near own sites is hard to see.
  - `forecast.test.ts` "a level-1 party wins no fight with the Source at threat 5" times out (5 s) under full-suite load; passes alone.
  - Sprite-tool pin drift: yomi-sprites skill (workflow.md) pins v0.6.0, host has 0.7.0 (no export changed).

## Decision log

| Date | Decision | By | Alternatives | Reason |
|---|---|---|---|---|
| 2026-11-20 | Skip architecture and design; the stage design is the approved design | orchestrator | new design | Marked ready for planning; precedent stages 2–6 |
| 2026-11-20 | Plan decisions 8, 6, 13 as recommended: waiting check is an idle-company twin (behind `--waiting` if >10% runtime); Improve button visible with the reason when the Lodge is too low; hex info and unsaved 'Last yield' wording as written | user | literal 'gold per day at home'; hide button; save last yield | Recommended |
| 2026-11-20 | Accept the planner's departures (index decisions): party args, `improve` day action, event shapes, optional yield `source`, extra sprites, debug commands, Lodge 3 refusal | orchestrator | follow design to the letter | routine engineering choices following the code's conventions |
| 2026-11-21 | Two stacked PRs: stage 7 from a branch cut at `a51ed58`, modular-context on top. Loose ends done now: forecast test timeout, sprite-tool pin, overlay frames above 1x (short design `overlay-frame-scaling`) | user | one combined PR; stage 7 only | Recommended |
| 2026-11-20 | Own branch `long-campaign-stage-07` off main | orchestrator | commit on main | Precedent: one branch and PR per stage |
| 2026-11-20 | Push and open a PR | user | wait | Stage done |
| 2026-11-20 | Keep market income as it is; revisit in stage 12's retune | user | raise it now | |
| 2026-11-20 | Simulator spend order (works, forts, market levels) waits for stage 12's retune | user | change it now | |
