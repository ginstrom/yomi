# Log: long campaign, stage 7 (site improvements and markets)

Append-only history for [the plan](index.md) and [the feature record](../../features/long-campaign-stage-07.md). It holds the history moved from the feature record when the record took the State / Decision log shape (modular-context step 06, 2026-11-21): the lines below are verbatim. The orchestrator does not read this file on resume.

## Verification (moved from the feature record)

- Baseline (step 01, seed 1, 500): `--parties 1` 234/500; default company 236/500; 50-campaign hash 5f92e363…
- 01 (494cddb + 88afcf7, opus): 50 hash unchanged; npm test 2353; world e2e 58; build. Review (opus): clean, 1 round; hash re-verified before/after; v26 fixture genuine; 15/16 mutations caught. Two test nits to step 02.
- 03 (a94e044, sonnet, worktree branch `long-campaign-stage-07-sprites` at .claude/worktrees/agent-adaf679f85afb4743): sprites:check 126; npm test. Review (opus): clean. Merged into the stage branch; worktree removed.
- 02 (0619dbf, sonnet): 50 hash unchanged (simulator capped at trading post 4); npm test 2367. Review (opus): clean, 1 round; nits: duplicated `wares` sentence in docs/reference/game.md (to step 04); market pays on the day the encampment falls (harmless, by design; note for stage 8).
- 04 (b20054e + bd9ba57, sonnet): Improve button, palisade, events, Last yield; compact label at 840 and a "Next:" hex line (reviewer: within user decisions 6/13). Review (opus): changes needed — label not re-chosen on resize (blocking); stale-visibility count; record misdescribes peat-label.png; no Outpost hexInfo test; refusal plural. Fixed 6dba9b3; re-review clean (new e2e fails on the old code).
- 06 (560c660, opus, worktree branch `long-campaign-stage-07-sim`): improveErrand, Lodge/market raised, record fields, waiting twin behind `--waiting` (twin ≈ +20% per campaign, reviewer's stable measure). 50 (`--waiting`) hash 1ceefe63…, Source 23/50; guard re-recorded once (a179187a…). Review (opus): clean; guard change decomposed to the simulated economy (Lodge stock kept + Lodge raised); `--waiting` changes no play. Merged (95997c3) with clean-up f6c2416 (wrappers gone, twin cost corrected); npm test 2385; world e2e 60; worktree removed.
- 05 (b6c9bf2, sonnet): Lodge plot, post names, debug stock/blight/days, manual §9; encampment relaid in three columns at 2x (was 3x; six plots can't fit at 3x in the 720×500 frame, which never scales up). npm test 2391 (maxWorkers 3 under load); browser 168 (serial). Review (opus): clean, 1 round; layout judged a defensible fit (before-step screenshots already overlapped). Screenshots in scratchpad/review05/.
- 07 (458a72d + 35c5d06, opus): 500 × seed 1 without `--waiting`: `--parties 1` 239 (+5), company 239 (+3); move from the simulated party's spending (step 06), no rule change; no retune. Simulated party barely improves (0.55 outposts, 0.01 works, 0 forts) and never reaches market levels, so the figures don't exercise forts or market gold. Waiting check: 1.30/day campaigning vs 0.98 waiting; waiting never earned more (438 less, 62 equal). Play script walked headless (fort held at blight 2, razed at 3; market halved on taint; v26 save loads). npm test 2392; browser 171; build; sprites:check. Step 07 reviewed by the overall review.
- Overall review (opus) at 049dc22: changes needed. Blocking: WorldScene `lastYield` not reset in create(), so another game's "Last yield" shows after Continue/new game. Non-blocking: CLAUDE.md facility checklist; market pays on the fall day (recorded). npm test 2392, build, sprites:check, browser 171; 50-campaign spot check matches.
- QA (sonnet) at 049dc22: pass. Minor: Last yield line overlaps the header hint at 840; Lodge 3 reason not shown until reselected. Gap: fort days-to-corruption warning not reachable in play (unit tests only). Evidence qa-* in .git/pr-review/long-campaign-stage-07/evidence/.
- PR review at ae59b5f: npm test 2393, build, sprites:check, browser 176/176; browser review of the fix round passed (pr-* evidence); local CRISP: no critical, 4 of 5 observations fixed in e6d94ac (npm test 2394, build), 1 dismissed. Record: .git/pr-review/long-campaign-stage-07.md.
- Simulated user (sonnet, hands-on) at 049dc22: goals 1, 2, 4 met; 3 partly. Friction: market income invisible before level 4; Lodge 3 dead end; market income small (balance, for the user); blight tint near own sites hard to see (pre-existing). Its `pkill -f vite` likely killed the user's dev server on 5173. Evidence su-*.
- Fix round 1 (opus, step 07 engineer): lastYield reset + e2e; 840 overlap; Lodge 3 reason shown at once; market-income hint at post levels 1–3; checklist line. Not fixing: market income size and simulator spend order (user decisions); blight tint (pre-existing); Mine strength = Outpost (design: +3 at levels 1 and 2).
- Fix round 1 (6405b5c): all five fixed, each new test failed first. Re-review (opus): clean, ready for a PR; npm test 2393, build, sprites:check, browser 176/176; 840 status text legible. Nit left: `refreshHint`'s doc comment sits above `fitStatus` (WorldScene.ts ~l.1188).

## Tiers and order (moved from the feature record)

- Planner: opus
- Steps (engineer / reviewer, planner's suggestions): 01 opus/opus; 02 sonnet/opus; 03 sonnet/opus; 04 sonnet/opus; 05 sonnet/opus; 06 opus/opus; 07 opus/opus; overall review opus
- Order: 01 → 02 → {04 → 05 on branch; 06 in a worktree, merged after 04}; 03 any time in a worktree, merged before 04; 07 last

## Open questions, resolved

- Untracked AGENTS.md (a renamed copy of CLAUDE.md, not from this run; points at directory AGENTS.md files that don't exist): awaiting the user. Kept out of the PR.
- Resolved by `f0814da`: AGENTS.md is now a symlink to CLAUDE.md.

## Carried forward, used

- Step 07: status text given a dark outline; overlap not reproduced. Originally: in the screenshot retake, the world header's status block (moved to y 3) overlaps a map label showing through (e.g. "Gold Seam").
- Done in step 07 (from step 05 review): details wrap in attempts 2–3 should stay at `FRAME_W - 2 * left` (text touches the frame border); shorter trading-post "Next:" wording so shrink-to-fit isn't needed; duplicated JSDoc above `detailLines` (EncampmentScene.ts ~l.82); index row 05 hash b6c9bf2.

## Superseded State (modular-context step 06, review round 1)

The State's phase as first migrated, from the record's old wording; the range was corrected to `17cc2e3..a51ed58` (code through `e6d94ac`):

**Phase:** 6, done on branch (17cc2e3..6405b5c); not pushed
