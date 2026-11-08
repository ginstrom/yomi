# Feature: long campaign, stage 6 (multiple parties)

**Slug:** long-campaign-stage-06
**Phase:** implementation (step 03)

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
| 2026-11-08 | Accept planner decisions 1–6, 9, 10, 12–15, 17, 18 (see plan index); hazards placeKey/pouch/{leader}/other-party animation/pre-existing reload & 840 route deferred with reasons | orchestrator | — | Each follows the design or reference; none changes an approved document |
| 2026-11-08 | Own branch `long-campaign-stage-06` off main | orchestrator | commit on main | Precedent: one branch and PR per stage |

## Open questions

(none; decisions 7, 8, 11, 16 answered by the user as planned)

## Model tiers

- Planner: opus
- Steps (engineer / reviewer): 01 opus/opus; 02 sonnet/opus; 03 opus/opus; 04 sonnet/opus; 05 opus/opus; 06 sonnet/opus; 07 opus/opus; 08 sonnet/opus; 09 opus/opus; 10 opus/opus; 11 sonnet/opus; overall review opus

## Verification

- Step 01 (d71a415, f5b9f3a, opus): startTravel/orderAction in company.ts; simulator acts as day orders; vanguard tracked; campDays once. Baselines 230/500 (sha d17e6dca…), 50: 23/50; guard + 50 hash identical; npm test 1359. Note: takeDays counts any made item as a field craft (fine until field embeds).
- Step 01 review (opus): clean; 50-campaign log identical on clean copies of b9682cd and f5b9f3a; npm test 1359. Nits: no two-party finishCampaign test (to step 09); duplicate 'Execution record' heading in 01's task file and a curly apostrophe in index row 01 (to step 02).
- Step 02 (8971db5, 1dbb25d, sonnet): SavedBattle.party, SAVE 21, parseSave validates, Menu load passes party; npm test 1362; browser 98/98; guard + 50 hash identical.
- Step 02 review (opus): clean. Nits: CLAUDE.md abbreviates the 50-campaign hash as ...2765 (full ends ...f52d76) — to step 11; two-party reload in the browser waits for step 03+.

