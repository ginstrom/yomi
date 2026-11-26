# Feature: long campaign, stage 11 (the high roster)

## State

- Request (user's words):
  > Merge PR #12 (stage 10), then start stage 11, the high roster. [...] Its design, docs/designs/long-campaign/stage-11-high-roster.md, is marked "ready for planning". It covers ogres, wyverns, wights, basilisks, giants, golems, cultists, dragons, the lich, the elder wyrm, and the Source rebuilt at 20, each with a sprite. Stage 11 picks up two things stage 10 left for it. The trophies table is empty until then, and the Source Guardians stay capped at level 6 until then.
- Slug `long-campaign-stage-11` · Phase 3, planning · Next action: orchestrator brings Q1–Q10 (plan index) to the user, then implements from step 01.
- Branch: `long-campaign-stage-11`, off main at c138d83 (stage 10 merged as PR #12, e801f5c).
- Path: Large, but the stage design is the approved design. Straight to planning, as stages 2–10 did.
- Links:
  - Stages overview: `docs/designs/long-campaign/index.md`
  - Design: `docs/designs/long-campaign/stage-11-high-roster.md` (status "ready for planning")
  - Previous stage: `docs/features/long-campaign-stage-10.md`
  - Plan: `docs/implementation-plans/long-campaign-stage-11/index.md` (15 steps; Q1–Q10 open, each with a default)
  - Status thread: C0CMCLX2G8G, ts "1795693090.979109", https://recursiveai.slack.com/archives/C0CMCLX2G8G/p1795693090979109
- Open questions: none yet.
- Tiers: planner opus.
- Carried from stage 10: trophies table empty until now (Elder Glade's wyvern-hide stand-in to be removed); Source Guardians at SOURCE_FOE_LEVEL 6 until now. Early figures, refactor guard and 50-check ran with `--near-source` in stages 9–10.
- Not this stage (stage 12, the retune): the accepted early figures (288/289), the long campaign's gear lag, the Source falling to 1/100, market income, the simulator's spend order and targeting.

## Decision log

| Date | Decision | By | Alternatives | Reason |
|---|---|---|---|---|
| 2026-11-26 | Merge PR #12, then start stage 11 | user | — | Stage 10 ready |
| 2026-11-26 | Skip architecture and design; the stage design is the approved design | orchestrator | new design | Marked ready for planning; precedent stages 2–10 (role notes) |
| 2026-11-26 | Own branch `long-campaign-stage-11` off main | orchestrator | — | One branch per stage (role notes) |
