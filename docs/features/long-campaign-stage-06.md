# Feature: long campaign, stage 6 (multiple parties)

**Slug:** long-campaign-stage-06
**Phase:** implementation (step 11)

## Request (user's words)

> Please merge then move on to step 6: The full review is saved at .git/pr-review/long-campaign-stage-05.md. Merging is up to you. Once it's in, stage 6 can start from the hazards listed in the feature record.

## Links

- Stages overview: `docs/designs/long-campaign/index.md`
- Design: `docs/designs/long-campaign/stage-06-multiple-parties.md` (status "ready for planning")
- Reference: `docs/designs/long-campaign/reference/multiple-parties.md` (all but §R10 road guards)
- Previous stage: `docs/features/long-campaign-stage-05.md` (hazards under Open questions and Verification), `.git/pr-review/long-campaign-stage-05.md`
- Plan: `docs/implementation-plans/long-campaign-stage-06/` (11 steps, 86ca66a)
- Branch: `long-campaign-stage-06`, off main (ab37e14)

## Path

Large/structural, but the stage design is the approved design (marked ready for planning). Straight to planning, as stages 2–5 did.

## Stage-5 hazards to start from

1. Saved battles carry no party id (a load fights the first party); BattleScene must take the expedition.
2. `advanceRefusal` stops the whole company while any party confronts (the stage design keeps this: "advance refuses while any party is confronting").
3. Simulator: one-day acts pass a day for the whole company while deciding for one party (collect acts as day orders in one passDay); `finishCampaign` reads `parties[0]`; `campDays` double-counts with two campers.
4. Simulator `carryOut` travel branch mirrors `worldMap.travel`'s start-up guards (dismissed CRISP item): a shared `startTravel` belongs here.
5. From the stage-5 overall review: placeKey leaves the party out; footer refusal wording with several parties; animating other parties' walks; fillText `{leader}` default; pouch company-wide; partyNoun.
6. Known pre-existing: a reload during the walk animation loses that turn's story moment; amber route can run under the party list at 840 wide.

## Decision log

| Date | Decision | By | Alternatives | Reason |
|---|---|---|---|---|
| 2026-11-08 | Merged PR #6 (merge commit ab37e14) | orchestrator (user delegated) | — | Review verdict ready, mergeable, branch up to date |
| 2026-11-08 | Skip architecture and design; the stage design is the approved design | orchestrator | new design | Stage design marked ready for planning; precedent stages 2–5 |
| 2026-11-08 | Decision 7: last party wiped with reserves left → new party auto-formed at home | user | game over; wait for player | Recommended |
| 2026-11-08 | Decision 8: Exchange is its own overlay scene (faces + two baggage lists) | user | inside character panel | Recommended |
| 2026-11-08 | Decision 11: click on a party's hex = meet; only the selected party animates | user | animate all; click selects | Recommended |
| 2026-11-08 | Decision 16: guard policy reinforce > defend > train > garrison > home, never the Source | user | defend first | Recommended |
| 2026-11-09 | Drop the engineer-added guardWanted rule (vanguard walking home only to form a guard) | orchestrator (per user's 'keep only if it helps') | keep | Off: same wins (389 at ready-level 10; 239 vs 240 at 7, noise), 3.3 fewer vanguard walk-home days |
| 2026-11-09 | Company value: accept the policy; step 11 records that on today's map the vanguard is self-sufficient, measures without the guardWanted walk-home rule and keeps it only if it helps; revisit in stage 9 | user | dig for a better policy; tune the economy | 100 × ready-level 10: 3 parties 78 = 1 party 78; 0.1 promotions; vanguard walk-home 94 vs 65 days |
| 2026-11-09 | Amend decision 16: swap promotion — a full vanguard swaps its lowest hero for a guard hero 2+ levels above it | user | accept 0 promotions; cheaper hall 4 | Step 10 review: a vanguard is never short once a guard forms, so 0 promotions on today's map |
| 2026-11-08 | Accept planner decisions 1–6, 9, 10, 12–15, 17, 18 (see plan index); hazards placeKey/pouch/{leader}/other-party animation/pre-existing reload & 840 route deferred with reasons | orchestrator | — | Each follows the design or reference; none changes an approved document |
| 2026-11-08 | Own branch `long-campaign-stage-06` off main | orchestrator | commit on main | Precedent: one branch and PR per stage |

## Open questions

(none; decisions 7, 8, 11, 16 answered by the user as planned)

## Model tiers

- Planner: opus
- Steps (engineer / reviewer): 01 opus/opus; 02 sonnet/opus; 03 opus/opus; 04 sonnet/opus; 05 opus/opus; 06 sonnet/opus; 07 opus/opus; 08 sonnet/opus; 09 opus/opus; 10 opus/opus; 11 opus/opus (escalated: measurement judgment); overall review opus

## Verification

- Step 01 (d71a415, f5b9f3a, opus): startTravel/orderAction in company.ts; simulator acts as day orders; vanguard tracked; campDays once. Baselines 230/500 (sha d17e6dca…), 50: 23/50; guard + 50 hash identical; npm test 1359. Note: takeDays counts any made item as a field craft (fine until field embeds).
- Step 01 review (opus): clean; 50-campaign log identical on clean copies of b9682cd and f5b9f3a; npm test 1359. Nits: no two-party finishCampaign test (to step 09); duplicate 'Execution record' heading in 01's task file and a curly apostrophe in index row 01 (to step 02).
- Step 02 (8971db5, 1dbb25d, sonnet): SavedBattle.party, SAVE 21, parseSave validates, Menu load passes party; npm test 1362; browser 98/98; guard + 50 hash identical.
- Step 02 review (opus): clean. Nits: CLAUDE.md abbreviates the 50-campaign hash as ...2765 (full ends ...f52d76) — to step 11; two-party reload in the browser waits for step 03+.
- Step 03 (b425c77, 3a0e909, opus): home/garrison/meet orders, met event, stop short of another party's nest, partyNoun/blockingParty, SAVE 22; npm test 1385; guard + 50 hash identical. Simulator order type narrowed to idle/travel/camp (step 10 widens).
- Step 03 review (opus): clean; 2 edge cases fixed anyway (679043e: meet left on unconfronted monsters confronts; meet with no route ends idle); re-review clean; npm test 1387. Note to step 07: travel to a nest another party holds is accepted then stops short next day — refuse or warn up front.
- Step 04 (a36f444, b315625, sonnet): hall levels 4–5 (C4), formParty/renameParty/disband/moveHero, recruits at the hall's level, encampment acts for homeParty, SIM_HALL_CAP 3; npm test 1407; encampment e2e 12/12 (recruit-level expectation 1→2, the intended rule); 50-campaign hash unchanged (recruit rule moves nothing in 50).
- Step 04 review (opus): clean; hash verified. Nits fixed in 9b0d30b (manual recruit sentence, CLAUDE.md SIM_HALL_CAP, noPartyHome shared); accepted without re-review (docs + a moved helper). To step 07: drop encampmentView DRAWN_LEVELS cap once step 06's frames exist.
- Steps 05 (main tree) and 06 (worktree) run in parallel; 06 touches only art/ and sprites.
- Step 06 (e26c81f, sonnet, worktree branch long-campaign-stage-06-sprites): hall level_4/level_5, banners map_banner / _azure / _green with idle flutter; sprites:check 124; npm test 1407.
- Step 06 review (opus): changes needed — blank barracks wall and lost roof edge, levels 4/5 indistinguishable, weak flutter, missing hash. Fixed in 6ad9a75, 35d980a (outline, timber, windows; level 5 palisade + gate + banner; flutter a row). Orchestrator viewed new previews: reads well; accepted without a second review. Merge into the stage branch after step 05 commits.
- Step 05 (a9e8c0c, 916a518, opus): exchange, wipeParty/heroesLeft (decision 7), BattleScene defeat flow, debug hp; npm test 1423; browser 99/99; build; 50 hash identical.
- Step 05 review (opus): clean; 10 rule mutations all caught. Finding: C/I/S on the defeat screen after a wipe crashed the panel (members empty, index -1). Fixed 8f9697e (openPanel returns on phase over or index<0; e2e presses C/I/S). Side effect accepted: panel no longer opens on the victory screen (heroes viewable on the map). Accepted without re-review (guard + e2e that failed before).
- Step 06 merged into the stage branch (index-row conflict resolved; sprites:check, tsc ok).
- Step 09 runs in a worktree (branch long-campaign-stage-06-simrecord) in parallel with step 07 on the main tree.
- Step 09 (564772c, opus, worktree branch long-campaign-stage-06-simrecord): --parties (default 1), roles, C8 record fields, wipes via wipeParty, LOG_SCHEMA 24, two-party finishCampaign test; guard fixture re-recorded once (--parties 1); npm test 1433. BattleScene meta party line left for after step 07.
- Step 09 review (opus): clean; independently: 50-campaign log identical after normalising battle_start (hash 068016a8…), 300 campaign records identical minus new fields. Nits to step 10: socketsFilled counts 0 for a wiped party (count before wipe or document); deaths excludes wiped parties (decide for the summary); Vanguard levels line covers only campaigns ending with a vanguard (say so).
- Step 10 runs in the step-09 worktree in parallel with step 07.
- Step 07 (ad65dcb, d1332d4, opus): banners, every party drawn, Home/Garrison, meet by click, interrupt/refusal focus, walkTo/followOrder; carry-overs: setOrder refuses travel to a nest another party holds (refuse, not warn), hall level cap removed, defeat focuses parties[0]; npm test 1434; browser 104/104; build; 50 hash identical.
- Step 07 review (opus): clean; confirmed orchestrator's screenshot impressions. Fixing: shared-hex figures overlap (spread 14px), banner pole foot under the strip's hp bar, selected figure unmarked on a shared hex, Home button vs Home key (→ 'Return home'). Orchestrator amends decision 10: strip entries show a short party name when 2+ parties.
- Step 07 fix (58c042f): figures 30px apart, banners kept visible; banner inside the portrait; short names on the strip with 2+ parties; gold ring + pointer on the selected figure; 'Return home'. npm test 1435; world+battle e2e 59. Orchestrator viewed retaken 840 shot: reads well; accepted without re-review.
- Step 10 (4b23fac, 7e015f9, opus, worktree): guard policy; --parties default 3; --parties 1 hash 47043dc0… unchanged; npm test 1457. 500 × --parties 3: 240/500, hall ≥4 in 16, 0.0 promotions, 0.3 guard battles, 57.9 vanguard walk-home days. Unplanned rule: vanguard walks home to form a guard. Runtime ~7.5 min (contended). Under review: why 0 promotions.
- Step 10 review (opus): clean; 0 promotions by design (vanguard never short after hall-4 visit fills it; guards 3+ levels below). Timing alone: 100 campaigns 61 s (--parties 1) vs 63 s (3); CLAUDE.md's 'about a minute' for 500 is stale (~5 min) — to step 11. Unplanned guardWanted rule raises vanguard walk-home days (60.0 vs 58.2) — step 11 to report. Fixed in 4d642f6: defend test pins hardest push and nearest-to-fall; guard under GUARD_MIN_SIZE goes home to refill. npm test 1459; --parties 1 hash unchanged. Swap promotion (user) in progress.
- Step 08 (4df8911, 8cd619d, sonnet): Guild Hall columns, Form/Rename/Disband, Exchange overlay (footer + Inventory tab), 'For: <party>'; npm test 1448; browser 109/109 before a late tweak; 50 hash identical. Known: footer time row overflows at 840 when all five buttons show (two parties on a held site) — orchestrator considers blocking; manual guild-hall.png stale (step 11). Orchestrator viewed 840 shots of Guild Hall and Exchange: read well.
- Step 10 swap promotion (bec5c0f): tests first; --parties 1 hash unchanged; npm test 1462. 100 × ready-level 10 seed 1: Source 78 (3 parties) vs 78 (1); promotions 0.1; guard battles 5.9; wipes 0.3 vs 0.2; vanguard walk-home 93.9 vs 64.5; hall 4 in 64/100. Accepted without re-review (small, tests-first, pinned); overall review covers it.
- Step 08 review (opus): clean; footer fits at 840 in the busiest state (x 85–835; engineer had compared with the map's width). Nits fixed in 1659377 (busiest-footer e2e, rename field cleared on act/pick, hint, a real disband test); npm test 1448; encampment+exchange+world e2e 63.
- Merged steps 09–10 (simulator branch) into the stage branch (index rows conflict resolved); tsc ok; npm test 1487.
- Step 11 escalated to opus (engineer): it carries the guardWanted measurement and judgment the user asked for, plus step 09's BattleScene meta party line.
- Step 11 (501aba6, opus): BattleScene meta party; figures (500, seed 1): --parties 1 ready-7 230 (guard holds); 3 parties ready-7 239, hall 4 in 16; ready-10: 1 party 389, 3 parties 389, guard battles 4.9, promotions 0.0, vanguard walk-home 91.7 vs 64.7; guardWanted dropped; docs/CLAUDE.md/manual + all screenshots retaken; play script walked headless (threatened site never arose near home in 120 days; only scripted battles, so no auto-resolve feel); npm test 1487; browser 110; build; sprites:check. Bug found: a map click while another party confronts silently gives a travel order (no message, 'Idle', unsaved) — fixing before verification.
- Step 11 reviewed by the overall review (as in stage 5).

