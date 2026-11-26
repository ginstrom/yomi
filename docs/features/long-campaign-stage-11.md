# Feature: long campaign, stage 11 (the high roster)

## State

- Request (user's words):
  > Merge PR #12 (stage 10), then start stage 11, the high roster. [...] Its design, docs/designs/long-campaign/stage-11-high-roster.md, is marked "ready for planning". It covers ogres, wyverns, wights, basilisks, giants, golems, cultists, dragons, the lich, the elder wyrm, and the Source rebuilt at 20, each with a sprite. Stage 11 picks up two things stage 10 left for it. The trophies table is empty until then, and the Source Guardians stay capped at level 6 until then.
- Slug `long-campaign-stage-11` · Phase 4, implementation · Next action: step 03 (engineer running), then 08 → … → 15. Sprites: 06 closing on branch `long-campaign-stage-11-sprites-06` (worktree `/Users/ryan/personal/yomi-s11-sprites`), merge it, then 07 from its tip (07 before 12).
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
- Done: 01 clean, 1 round (runlog #15; baseline identical to stage 10, 50-check 57fdea15…); 02 clean, 1 round (#22 at 67a6f0d; guard and 50-check unmoved); 04 clean, 2 rounds, merged 259b398; 05 clean, 2 rounds (#18, #20), merged 2cd7aca; 06 review clean, 1 round.
- Run npm with `PATH=/opt/homebrew/opt/node@26/bin:$PATH` (default node is 22). Sprite tool is `/Users/ryan/.local/bin/sprite`, never `npx sprite`.
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
| 2026-11-26 | Kitted fighter's resistance (11 at level 10, 21 at 20, against gear §5.8's about 5 and 8): go on as is; new kinds get damage that tells through resistance and the cells decide | user | hide in the kit's small slots; pause the ring steps | Keeps the kit as stage 10's policy picks it |
| 2026-11-26 | Expected kit's rune order stays socket by socket: first weapon socket Ember, later Stone | user | every weapon socket Ember | Closest to §5.8's level-20 damage |
| 2026-11-26 | Hill giant is the ogre's height and ~2 px broader, not "visibly larger" | orchestrator | shrink the ogre | 32 px canvas; blue hide and mantle set it apart |
