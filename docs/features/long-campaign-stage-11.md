# Feature: long campaign, stage 11 (the high roster)

## State

- Request (user's words):
  > Merge PR #12 (stage 10), then start stage 11, the high roster. [...] Its design, docs/designs/long-campaign/stage-11-high-roster.md, is marked "ready for planning". It covers ogres, wyverns, wights, basilisks, giants, golems, cultists, dragons, the lich, the elder wyrm, and the Source rebuilt at 20, each with a sprite. Stage 11 picks up two things stage 10 left for it. The trophies table is empty until then, and the Source Guardians stay capped at level 6 until then.
- Slug `long-campaign-stage-11` · Phase 4, implementation · Next action: step 01 (baseline) and sprite step 04 in a worktree; order 01 → 02 → 03 → 08 → 09 → 10 → 11 → 12 → 13 → 14 → 15, sprites 04–07 beside (04 before 08, 05 before 09, 06 before 11, 07 before 12).
- Branch: `long-campaign-stage-11`, off main at c138d83 (stage 10 merged as PR #12, e801f5c).
- Path: Large, but the stage design is the approved design. Straight to planning, as stages 2–10 did.
- Links:
  - Stages overview: `docs/designs/long-campaign/index.md`
  - Design: `docs/designs/long-campaign/stage-11-high-roster.md` (status "ready for planning")
  - Previous stage: `docs/features/long-campaign-stage-10.md`
  - Plan: `docs/implementation-plans/long-campaign-stage-11/index.md` (15 steps, bb47278; trimmed 3e77176)
  - Plan log (history): `docs/implementation-plans/long-campaign-stage-11/log.md`
  - Status thread: C0CMCLX2G8G, ts "1795693090.979109", https://recursiveai.slack.com/archives/C0CMCLX2G8G/p1795693090979109
- Open questions: none. Plan Q1–Q10 answered 2026-11-26 (decision log): all planner defaults; step 01's engineer records them in the index.
- Tiers (engineer / reviewer): planner opus. 01 sonnet / sonnet; 04–07, 15 sonnet / opus; 02, 03, 08–14 opus / opus. No escalations.
- Checkpoints to the user: a cell outside 300–475 after three trials; an ability that needs a new engine field; the guard or 50-check moving; an early figure further out than accepted.
- Carried from stage 10: trophies table empty until now (Elder Glade's wyvern-hide stand-in to be removed); Source Guardians at SOURCE_FOE_LEVEL 6 until now. Early figures, refactor guard and 50-check ran with `--near-source` in stages 9–10.
- Not this stage (stage 12, the retune): the accepted early figures (288/289), the long campaign's gear lag, the Source falling to 1/100, market income, the simulator's spend order and targeting.

## Decision log

| Date | Decision | By | Alternatives | Reason |
|---|---|---|---|---|
| 2026-11-26 | Merge PR #12, then start stage 11 | user | — | Stage 10 ready |
| 2026-11-26 | Skip architecture and design; the stage design is the approved design | orchestrator | new design | Marked ready for planning; precedent stages 2–10 (role notes) |
| 2026-11-26 | Own branch `long-campaign-stage-11` off main | orchestrator | — | One branch per stage (role notes) |
| 2026-11-26 | Plan Q4: "wins most but not all" is 300–475 of 500 at both band ends, report only, not a band; three tuning trials an encounter, then to the user | user | make it a band; record only | Planner default |
| 2026-11-26 | Plan Q3: the Source at 20 is a new `source_horror` with two Blight Cultists; the near-home Source keeps today's Horror | user | one Horror rebuilt everywhere | Early figures, guard and 50-check stay identical |
| 2026-11-26 | Plan Q5: new kinds judged against a kitted fighter table from `expectedKit`; today's kinds unchanged | user | today's bare table | Stage 12's measurement not ready |
| 2026-11-26 | Plan Q1, 2, 6–10: planner defaults (line-ups and counts per C5; nests keep position and loot, about a third bandits; favoured runes; Blight Breath blight, Corroded, foes only; Worg Riders 7–9; 13 sprites; expected kit at the low end) | user | walk through each | Each follows a reference or the code |
| 2026-11-26 | Accept the planner's other decisions (index 11–20) and tiers | orchestrator | — | Routine engineering choices |
