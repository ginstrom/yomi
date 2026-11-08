# Feature: long campaign, stage 5 (a company of one)

**Slug:** long-campaign-stage-05
**Phase:** PR open — https://github.com/ginstrom/yomi/pull/6 (ready for review)

## Request (user's words)

> please do stage 5 of the long campaign, "A company of one" (docs/designs/long-campaign/stage-05-company-of-one.md).
> ... It's mostly a refactor that's meant to change no behaviour. It lays the groundwork for stage 6's multiple parties ... The guard: the first step stores a fixture of a seeded --campaign simulator summary. The simulator must give the exact same summary after every step.

## Links

- Stages overview: `docs/designs/long-campaign/index.md`
- Design: `docs/designs/long-campaign/stage-05-company-of-one.md` (status "ready for planning")
- Reference: `docs/designs/long-campaign/reference/multiple-parties.md` §4.2, §5.1–5.3, §7.3 steps 1–2
- Plan: `docs/implementation-plans/long-campaign-stage-05/` (10 steps, e58c806)
- Branch: `long-campaign-stage-05`, off main (76cc1ec)

## Path

Large/structural refactor, but architecture and design are done (the stage design cuts from reference/multiple-parties.md). Straight to planning, as stages 2–4 did.

## Decision log

| Date | Decision | By | Alternatives | Reason |
|---|---|---|---|---|
| 2026-11-08 | Until something happens stops after 30 quiet days | user | no cap | Planner default (D9) |
| 2026-11-08 | Orders persist after an interrupt; Next day resumes | user | drop to Idle | Planner default (D10); closest to stage 6 |
| 2026-11-08 | Order line in the right-hand party list | user | left portrait column | Planner default (D11) |
| 2026-11-08 | Map keeps showing "Your party" while one party; stored name "First Company" | user | show "First Company" | Keeps party-list design Q2 |
| 2026-11-08 | Keep a standing travel order's route and destination marker drawn on the map | user | Continue button; leave as is | Makes resuming a cut-short walk visible (simulated-user friction) |
| 2026-11-08 | Defer 'until affordable' / 'wait N days' to a later stage's time controls | user | add now; stop on stock milestones | Stage 5 stays a refactor |
| 2026-11-08 | Hide the time buttons on any monster hex (after Scout too); Wait is the time control there | orchestrator | show them once not confronting (as built) | Matches the old footer, which offered only Scout/Wait/Attack among monsters |
| 2026-11-08 | Step 10 reviewed by the overall review rather than a separate step review | orchestrator | separate review | Step 10 is docs and measurement; the overall review covers it |
| 2026-11-08 | Accept planner decisions 1,2,4–8,12,13: saves 19 then 20 with one migration from 18; CLAUDE.md save rule rewritten; travel order stores its route; orders idle/travel/camp/day action; conveniences keep names (safe import cycles); DayReport richer; pouch company-wide; item place keys unchanged; leader() removed by step 05 | orchestrator | — | Each keeps the guard exact or defers to stage 6 |
| 2026-11-08 | Stripped the planner's Co-Authored-By trailer from the plan commit | orchestrator | — | Session rule: no attribution lines |
| 2026-11-08 | Stage 5 next | user | stage 7 | Stage 6 depends on it; tree is quiet |
| 2026-11-08 | Skip architecture and design; the stage design is the approved design | orchestrator | new design | Stage design marked ready for planning |
| 2026-11-08 | Own branch `long-campaign-stage-05` off main | orchestrator | commit on main | Precedent of stages 1–4 (one branch and PR per stage) |

## Open questions

- For stage 6 (not blocking): saved battles must record which party is fighting.
- For stage 6 (not blocking): advanceRefusal stops the whole company while any party is confronting (per C6); revisit with several parties.
- For stage 6 (not blocking): the simulator runs a one-day act while deciding for its party, so with two parties it would pass a day for both; collect acts as day orders in one passDay.

## Model tiers

- Planner: opus
- Steps (engineer / reviewer): 01 sonnet/sonnet; 02 opus/opus; 03 sonnet/opus; 04 opus/opus; 05 sonnet/opus; 06 opus/opus; 07 opus/opus; 08 opus/opus; 09 sonnet/opus; 10 sonnet/opus; overall review opus

## Verification

- Step 01 (8477c15, 9660944, sonnet): guard test (5 campaigns, records + events SHA). Baselines: 500 campaigns 230/500, 9121 battles, log sha d17e6dca…; 50 campaigns 23/50, 852 battles, log sha 068016a8…
- Step 01 review (sonnet): clean; 50-campaign baseline reproduced; guard shown to fail on a changed record or hash.
- Step 02 (f4b1af0, b8ac7a2, opus): expedition.ts PartyPresence/soloPresences; blight, vision, territory, passTurn, isNotable, clearLocation over presences; guard + 50-campaign hash identical; npm test 1217, browser 89/89.
- Step 02 review (opus): clean; pinned numbers reproduced on the pre-change tree; nits (redundant assertion in blight.test, `_world` on isNotable) passed to step 04.
- Step 03 (d343bdf, sonnet): Expedition/Order types, GameState.parties, leader(), partyById; SAVE 19 with migrateFrom18 and v18 fixture; CLAUDE.md save rule rewritten; guard + 50-campaign hash identical; npm test 1224; browser: encampment.test raw-save paths fixed and that file rerun 11/11 (full suite not rerun).
- Step 03 review (opus): clean; fixture reproduced from the pre-change tree; full browser 89/89; nits (double import in itemPlace.ts, temporary story↔gameState cycle until leader goes) to step 04/05.
- Step 04 (5f0e851, a199d5a, opus): Expedition gets position and confronting; presences(); C4 signatures (+raiseShrine, hexInfo); SAVE 20 migrating from 18; probe partyAt/confronting; guard + hash identical; npm test 1230; browser 89/89 (one saves.test fix). `_world` on isNotable kept (plan contract) — orchestrator: leave to stage 6.
- Orchestrator removed the plan's Co-Authored-By instruction from the remaining task files (session rule).
- Step 04 review (opus): clean; hash + summary identical, npm test 1230, browser 89/89. Nit: a results line in 04's §5 duplicated from §7 (to step 05).
- Step 05 (b3de3e1, cd16acc, sonnet): item places name the party; selectedParty; scenes carry `party`; debug @<party>, `party` lists the company; leader deleted, story cycle gone; guard + hash identical; npm test 1240; browser 89/89. Note for stage 6: a saved battle carries no party id (loads fight the first party).
- Step 05 review (opus): clean; hash + 47-line summary identical; npm test 1240; browser 89/89; hand-offs, rewards and @-parsing checked. Nits to step 06: bare `@` selects the first party; simulator visitGuildHall names should use company(game).
- Step 06 (4f3a336, 82f31b1, opus): company.ts (setOrder, advanceRefusal, passDay, advance, UNTIL_LIMIT 30); travel and campUntilHealed on the loop; characterization tests first (incl. a hashed 26-walk session); debug days runs passDay; step 05 nits fixed; guard + hash identical; npm test 1277; browser 89/89. Debug goto leaves a stale travel order — to step 07.
- Step 06 review (opus): clean; characterization tests pass on the pre-change tree; hash identical; npm test 1277; browser 89/89. To step 07: CLAUDE.md expedition.ts line stale; campUntilHealed early return keeps an old order; worldInterrupt uses object identity. Accepted: a blocked road makes a travel order idle even on an interrupt day (road is blocked; correction 10 is about orders that can go on).
- Step 07 (8811e0f, aeaf9fb, opus): act() for scout/wait/camp day/tower/outpost/field craft/field embed; time-free parts (rest, raiseTower, raiseOutpost, applyCraft, applyEmbed); step 06 follow-ups folded; twin-game characterization tests; guard + hash identical; npm test 1315; browser 89/89. One-day actions replace a standing order (party ends idle), per correction 10.
- Step 07 review (opus): clean; twin tests pass on the pre-change tree and fail on injected reorderings; hash + summary identical; npm test 1315; browser 89/89. To step 09: craft refusal uses party.name not partyNoun; comment the run-time re-check in runAction; triple refusal check (optional).
- Steps 08 (main tree) and 09 (separate worktree, merged after) run in parallel.
- Step 08 (7491dd8, 1316fed, opus): runCampaign on the loop (per-party plans, decide/carryOut, advance); company.ts untouched; guard + hash + summary identical; npm test 1321.
- Step 08 review (opus): clean; every phase traced against the old runCampaign; hash + summary identical. To step 10: comment carryOut's travel branch as a mirror of worldMap.travel (and the refused-setOrder confronting gap). Stage-6 notes: campDays double-count with two campers; finishCampaign reads parties[0].
- Step 09 (1bd8749, sonnet, worktree; merged 44eb32e): order line in the party list (Travelling to…/Camping/Idle, full text in hover and probe), Next day and Until something happens (30-day cap), footer now two rows (map 52px shorter), ENTRY_PITCH 104; step 07 nits (partyNoun, runAction comment) done; guard hash identical; npm test 1332; browser 95/95. Orchestrator viewed 840×560 and 1280 screenshots: fits; at 840 the order line shows just "Travelling".
- Step 09 review (opus): clean on the merged tree; npm test 1338; browser 95/95; hash identical; all states screenshotted. To step 10: weak e2e assertions (until-something-happens regex, Camping never asserted, one-hex check); header hint doesn't mention the new buttons; manual screenshots.
- Step 10 (4ec97a2, 24b36f3, sonnet): 500 campaigns 230/500, 9121 battles, log sha d17e6dca… identical; 50 identical; npm test 1338; browser 95/95; e2e assertions strengthened; header hint updated; manual section + new world-travelling shot, all 20 shots retaken; play script walked headless (v18 load, walk stop, battle, 5 Next days with yields, watchtower one day, 30 quiet days) except Camping during a real camp-until-healed.
- Step 10 reviewed by the overall review (as in stage 4).
- Overall review (opus) at 3486667: clean; npm test 1338, build, sprites:check, guard hash identical; browser 90/95 under load 37–40, the 5 rerun alone and passing. Non-blocking: manual shot taken conditionally; manual sentence wrong for camping; saved orders' route/action not validated; time buttons save after the animation (a journey saves first); index row 03 missing hash. Stage-6 hazard list recorded in its report (saved battles, placeKey, footer refusal with several parties, animation of other parties, simulator act/finishCampaign/campDays, fillText default, carryOut mirror, pouch, partyNoun).
- Simulated user (sonnet, hands-on) at 3486667: all 5 goals met (goal 2's healing untestable: level-ups heal). Friction: Until something happens overshoots a stock target (no 'until affordable'/'wait N'); a cut-short walk has no visible 'continue', route line vanishes; order shows Idle while the walk animates; placeholder intro replays on the v18 fixture (fixture artifact: its story.played is empty — not a defect). Evidence su-01..36.
- QA (sonnet) at 3486667: pass. Minor: time buttons show on a monster hex after Scout (30 quiet days on a nest); "Before the The Blight Source". Endless mode, reload mid-order, debug console, 840×560 all pass. Evidence qa-*.
- Fix round 1 (a9706a1, opus): order line shows the travel order during playback; article-aware names (theName); time buttons hidden on monster hexes; time buttons save before playback, journeys too; parseSave validates order route/action; manual shot asserted; manual sentence; index 03 hash. npm test 1344; browser 97/97; guard hash identical. Follow-up sent: keep route drawn (user), theName in two WorldScene messages.
- Fix round 2 (f039a0b, opus): standing travel route drawn in amber (probe standingRoute; survives reload; hover replaces it); theName/theNameCapital moved to worldMap.ts and used for every 'the <location>' line; world-travelling shot retaken (orchestrator viewed: route reads clearly). npm test 1345; browser 98/98; guard hash identical. Left: 'You sight a Kobold Scouts' article (pre-existing).
- Re-review of fix rounds (opus) at f039a0b: clean; npm test 1345, browser 98/98 first run, build, guard hash identical; fixes 1, 3, A, 2 seen in the real game (evidence fix-*). Non-blocking, accepted as known issues: a reload during the walk animation loses that turn's story moment (pre-existing for hex clicks; could skip the source_sighted cutscene); amber route can run under the party list at 840 wide; order line reads Idle after Scout at a lair (pre-existing).
- Known issues for the PR: the above three; 'You sight a Kobold Scouts' article (pre-existing); 'until affordable'/'wait N days' deferred (user); stage-6 hazards listed above and in the overall review.
- PR review (2026-11-08): checks pass at f4be587 (npm test 1345, build, sprites:check, browser 97/98 with one load-timing flake passing alone twice). Local CRISP: 0 critical, 6 observations; 4 fixed (90dd69b, 4a4bdb4, cbf2f32, cb67220; sonnet), 2 dismissed (simulator travel mirror, convention params). Verdict ready. Record: .git/pr-review/long-campaign-stage-05.md
