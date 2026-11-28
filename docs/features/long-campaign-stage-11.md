# Feature: long campaign, stage 11 (the high roster)

## State

- Request (user's words):
  > Merge PR #12 (stage 10), then start stage 11, the high roster. [...] Its design, docs/designs/long-campaign/stage-11-high-roster.md, is marked "ready for planning". It covers ogres, wyverns, wights, basilisks, giants, golems, cultists, dragons, the lich, the elder wyrm, and the Source rebuilt at 20, each with a sprite. Stage 11 picks up two things stage 10 left for it. The trophies table is empty until then, and the Source Guardians stay capped at level 6 until then.
- Slug `long-campaign-stage-11` · Phase 6, report · Next action: the user's go-ahead to push and open the PR (pr-reviewer, then pr-creator).
- Fixes re-review (opus) at 458d311: code correct (#253, build #254); blocker BW12 483 'accepted' without a decision (→ user: three trials); 3 cleanups done b72acd7–36d3573 (#255). QA re-check pass (5/5). BW tuning 6cda296 (bw11 425, bw12 473, bw14 341), review clean (#261); its doc nits 67d9b41; npm test #263 at 67d9b41, build #258, e2e battle #260, debug #259.
- Verification at 8248f10: overall review clean (#230, build #231); QA pass, 2 minor; simulated user (e2e driver) goals met. Fixes 1–9 a9f7eee–03321ae (opus engineer); retune kept lc18 439, lc20 309; cu18 500 after three trials, recorded for stage 12. Guard and 50-check unmoved.
- Branch `long-campaign-stage-11` off main c138d83. Path: stage design approved; straight to planning.
- Links: design `docs/designs/long-campaign/stage-11-high-roster.md`; plan `docs/implementation-plans/long-campaign-stage-11/index.md`; history `.../log.md`; status thread C0CMCLX2G8G, ts "1795693090.979109", https://recursiveai.slack.com/archives/C0CMCLX2G8G/p1795693090979109
- Open questions: none.
- Tiers (engineer / reviewer): planner opus. 01 sonnet / sonnet; 04–07, 15 sonnet / opus; 02, 03, 08–14 opus / opus; fixes opus. No escalations.
- Steps 01–15 done, each clean in 1 round (runlog IDs in log.md). 50-check 1e85d023… (schema 27). SAVE_VERSION 36.
- Follow-ups outside the stage: `stopVoice` fade race (`src/scenes/soundPlayer.ts`); battle e2e A9 order-dependent. A closed lid hangs browser runs.
- Run npm with `PATH=/opt/homebrew/opt/node@26/bin:$PATH`. Sprite tool: `/Users/ryan/.local/bin/sprite`.
- Checkpoints to the user: an in-play threat (7, 9, 12, 15, 18) outside 300–475 after three trials; the guard or 50-check moving.
- Stage 12 (the retune) owns: early figures (288/289), gear lag, the Source at 1/100, market income, spend order, recorded band misses.

## Decision log

| Date | Decision | By | Alternatives | Reason |
|---|---|---|---|---|
| 2026-11-26 | Merge PR #12, then start stage 11 | user | — | Stage 10 ready |
| 2026-11-26 | Skip architecture and design; the stage design is the approved design | orchestrator | new design | Marked ready for planning; precedent stages 2–10 (role notes) |
| 2026-11-26 | Own branch `long-campaign-stage-11` off main | orchestrator | — | One branch per stage (role notes) |
| 2026-11-26 | Plan Q4: "wins most but not all" is 300–475 of 500 at both band ends, report only, not a band; three tuning trials an encounter, then to the user | user | make it a band; record only | Planner default |
| 2026-11-26 | Plan Q3: the Source at 20 is a new `source_horror` with two Blight Cultists; the near-home Source keeps today's Horror | user | one Horror rebuilt everywhere | Early figures, guard and 50-check stay identical |
| 2026-11-26 | Plan Q5: new kinds judged against a kitted fighter table from `expectedKit`; today's kinds unchanged | user | today's bare table | Stage 12's measurement not ready |
| 2026-11-26 | Plan Q1, 2, 6–10: planner defaults stand (index decisions) | user | walk through each | Each follows a reference or the code |
| 2026-11-26 | Accept the planner's other decisions (index 11–20) and tiers | orchestrator | — | Routine engineering choices |
| 2026-11-26 | Kitted fighter's resistance (11 at level 10, 21 at 20, against gear §5.8's about 5 and 8): go on as is; new kinds get damage that tells through resistance and the cells decide | user | hide in the kit's small slots; pause the ring steps | Keeps the kit as stage 10's policy picks it |
| 2026-11-26 | Expected kit's rune order stays socket by socket: first weapon socket Ember, later Stone | user | every weapon socket Ember | Closest to §5.8's level-20 damage |
| 2026-11-26 | Hill giant is the ogre's height and ~2 px broader, not "visibly larger" | orchestrator | shrink the ogre | 32 px canvas; blue hide and mantle set it apart |
| 2026-11-26 | Step 03 re-records `GUARD_EVENTS_SHA256` and 18 forecast digests for `LOG_SCHEMA_VERSION` 27; new 50-check reference 1e85d023… (equals 57fdea15… at schema 26) | orchestrator | keep version 26 (breaks the event-shape rule) | Only the version number in `battle_start` moved; play identical, shown with the version held at 26 |
| 2026-11-27 | Wyvern roost: one more trial (four wyverns at 9–10, three at 11–12, trial 3's block); if both ends aren't inside, keep trial 3 (wy9 498, wy12 399) | user | keep now; stronger wyvern 459/175; lesser third foe at 11–12 | No one block fits both ends: the kit row is the same at 9 and 12 |
| 2026-11-27 | Rings 12–18: when a band's two ends can't both land in 300–475 in three trials, tune the top end inside, let the bottom run easy, record both for stage 12, don't stop; a top-end miss still comes to the user | user | stop each time; read the top with a better kit | Same squeeze expected in every band |
| 2026-11-27 | Blight Cult at threat 15 (99 of 500, its nest's threat): wait for the reviewer's cause, then one targeted trial re-measuring 14, 15, 18; keep only if 15 lands inside without pushing 14 or 18 out, else revert and record 99 for stage 12 | user | four at 15–16 now; record 99 | Cliff unexplained: same foes and kit as at 14 (345) |
| 2026-11-27 | From here the threats that occur on the map (7, 9, 12, 15, 18) are tuned inside 300–475 first, band ends second; an in-play miss after three trials comes to the user, band-end misses are recorded | user | band ends only | Ring 15's nests sit mid-band (366, 99, 491 at 15) |
| 2026-11-27 | Young Dragon lair at threat 15 (491, in-play, above the reading): record for stage 12, no more tries | user | weaker second minion; block between trials | One wyvern 491, two 64; a block change moves 18 out |
| 2026-11-27 | Session on Opus 5.5 after the Fable limit; "opus" tier spawns inherit it | user | wait a day | Model switched |
| 2026-11-27 | Elder Wyrm lair at threat 18 (in play) 482 after three trials: accept, record for stage 12 | user | a weaker third foe at 18–19 | 7 over; a stronger block pulls 20 down |
| 2026-11-28 | Early figures: accept rl10 371 (409 at step 01; band 370–420), one 287, company 288; cause the new ring-7/9 spawn kinds at threats 7 and 9. Update bands.md and src/game/CLAUDE.md | user | keep old spawn kinds under --near-source; change the kinds' fromThreat | It is what the game now does; stage 12 owns the gear lag |
| 2026-11-28 | Long run (Source 0 of 100, 739 days, campaigns end at rings 7–9): record for stage 12, carry on | user | stop before step 15 | Expected; stage 12's retune |
| 2026-11-28 | Verification: caster foes' hover lists their spells | user | leave for stage 12 | Players couldn't see what the lich court casts |
| 2026-11-28 | Keep the new back-rank placement and retune: lc18 inside 300–475 in up to three trials; cu18 top end if cu15 stays inside; lc20 recorded | user | keep and record; revert the placement | Readability fixed for good, a test guards it |
| 2026-11-28 | Barrow Wights at 12 (in play, 483): up to three tuning trials; if still out, record for stage 12 | user | record; accept | Same rule as other in-play threats |
