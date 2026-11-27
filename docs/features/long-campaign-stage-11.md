# Feature: long campaign, stage 11 (the high roster)

## State

- Request (user's words):
  > Merge PR #12 (stage 10), then start stage 11, the high roster. [...] Its design, docs/designs/long-campaign/stage-11-high-roster.md, is marked "ready for planning". It covers ogres, wyverns, wights, basilisks, giants, golems, cultists, dragons, the lich, the elder wyrm, and the Source rebuilt at 20, each with a sprite. Stage 11 picks up two things stage 10 left for it. The trophies table is empty until then, and the Source Guardians stay capped at level 6 until then.
- Slug `long-campaign-stage-11` · Phase 4, implementation · Next action: step 11, ring 15, in review (cause of blight_cult 345 at threat 14, 99 at 15); then the engineer's one targeted cult trial, then 12 → … → 15.
- Branch: `long-campaign-stage-11`, off main at c138d83 (stage 10 merged as PR #12, e801f5c).
- Path: the stage design is the approved design; straight to planning, as stages 2–10.
- Links:
  - Design: `docs/designs/long-campaign/stage-11-high-roster.md` (status "ready for planning")
  - Previous stage: `docs/features/long-campaign-stage-10.md`
  - Plan: `docs/implementation-plans/long-campaign-stage-11/index.md` (15 steps, bb47278; trimmed 3e77176)
  - Plan log (history): `docs/implementation-plans/long-campaign-stage-11/log.md`
  - Status thread: C0CMCLX2G8G, ts "1795693090.979109", https://recursiveai.slack.com/archives/C0CMCLX2G8G/p1795693090979109
- Open questions: none. Plan Q1–Q10 answered 2026-11-26 (decision log): all planner defaults; step 01's engineer records them in the index.
- Tiers (engineer / reviewer): planner opus. 01 sonnet / sonnet; 04–07, 15 sonnet / opus; 02, 03, 08–14 opus / opus. No escalations.
- Done, each clean in 1 round: 01 (runlog #15), 02 (#22), 03 (#58), 08 (#69), 09 (#84), 10 (#94; browser by file #104–#126); cells in the plan log; sprites 04–07 merged. 50-check 1e85d023… (schema 27), unmoved. SAVE_VERSION 34.
- `throughResistance` on an area means cut by resistance less `armorPierce`; without it resistance is ignored (plan corrected d06bdb9). Follow-ups outside the stage: `stopVoice` fade race in `src/scenes/soundPlayer.ts`; battle e2e A9 fails in the full file (order-dependent, pre-existing). A closed lid hangs browser runs.
- Run npm with `PATH=/opt/homebrew/opt/node@26/bin:$PATH`. Sprite tool: `/Users/ryan/.local/bin/sprite`, never `npx sprite`.
- Checkpoints to the user: a threat that occurs on the map (7, 9, 12, 15, 18) outside 300–475 after three trials (band-end misses are recorded for stage 12, no stop); an ability that needs a new engine field; the guard or 50-check moving; an early figure further out than accepted.
- Carried from stage 10: trophies from kills (done through ring 9); Source Guardians at SOURCE_FOE_LEVEL 6 until step 13.
- Not this stage (stage 12, the retune): the accepted early figures (288/289), the long campaign's gear lag, the Source at 1/100, market income, the simulator's spend order.

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
| 2026-11-26 | Step 03 re-records `GUARD_EVENTS_SHA256` and 18 forecast digests for `LOG_SCHEMA_VERSION` 27; new 50-check reference 1e85d023… (equals 57fdea15… at schema 26) | orchestrator | keep version 26 (breaks the event-shape rule) | Only the version number in `battle_start` moved; play identical, shown with the version held at 26 |
| 2026-11-27 | Wyvern roost: one more trial (four wyverns at 9–10, three at 11–12, trial 3's block); if both ends aren't inside, keep trial 3 (wy9 498, wy12 399) | user | keep now; stronger wyvern 459/175; lesser third foe at 11–12 | No one block fits both ends: the kit row is the same at 9 and 12 |
| 2026-11-27 | Rings 12–18: when a band's two ends can't both land in 300–475 in three trials, tune the top end inside, let the bottom run easy, record both for stage 12, don't stop; a top-end miss still comes to the user | user | stop each time; read the top with a better kit | Same squeeze expected in every band |
| 2026-11-27 | Blight Cult at threat 15 (99 of 500, its nest's threat): wait for the reviewer's cause, then one targeted trial re-measuring 14, 15, 18; keep only if 15 lands inside without pushing 14 or 18 out, else revert and record 99 for stage 12 | user | four at 15–16 now; record 99 | Cliff unexplained: same foes and kit as at 14 (345) |
| 2026-11-27 | From here the threats that occur on the map (7, 9, 12, 15, 18) are tuned inside 300–475 first, band ends second; an in-play miss after three trials comes to the user, band-end misses are recorded | user | band ends only | Ring 15's nests sit mid-band (366, 99, 491 at 15) |
