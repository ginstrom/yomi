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

None yet.

## Model tiers

- Planner: opus
- Steps (engineer / reviewer): 01 sonnet/sonnet; 02 opus/opus; 03 sonnet/opus; 04 opus/opus; 05 sonnet/opus; 06 opus/opus; 07 opus/opus; 08 opus/opus; 09 sonnet/opus; 10 sonnet/opus; overall review opus

## Verification

- Step 01 (8477c15, 9660944, sonnet): guard test (5 campaigns, records + events SHA). Baselines: 500 campaigns 230/500, 9121 battles, log sha d17e6dca…; 50 campaigns 23/50, 852 battles, log sha 068016a8…
