# Feature: long campaign, stage 5 (a company of one)

**Slug:** long-campaign-stage-05
**Phase:** 4. Implementation

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
| 2026-11-08 | Accept planner decisions 1,2,4–8,12,13: saves 19 then 20 with one migration from 18; CLAUDE.md save rule rewritten; travel order stores its route; orders idle/travel/camp/day action; conveniences keep names (safe import cycles); DayReport richer; pouch company-wide; item place keys unchanged; leader() removed by step 05 | orchestrator | — | Each keeps the guard exact or defers to stage 6 |
| 2026-11-08 | Stripped the planner's Co-Authored-By trailer from the plan commit | orchestrator | — | Session rule: no attribution lines |
| 2026-11-08 | Stage 5 next | user | stage 7 | Stage 6 depends on it; tree is quiet |
| 2026-11-08 | Skip architecture and design; the stage design is the approved design | orchestrator | new design | Stage design marked ready for planning |
| 2026-11-08 | Own branch `long-campaign-stage-05` off main | orchestrator | commit on main | Precedent of stages 1–4 (one branch and PR per stage) |

## Open questions

- For stage 6 (not blocking): saved battles must record which party is fighting.

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
