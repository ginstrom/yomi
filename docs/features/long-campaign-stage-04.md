# Feature: long campaign, stage 4 (runes)

**Slug:** long-campaign-stage-04
**Phase:** 4. Implementation

## Request (user's words)

> long-campaign-stage-03 -- previous work looks good

Then, asked for the next stage: "Stage 4: runes (Recommended)".

## Links

- Stages overview: `docs/designs/long-campaign/index.md`
- Design: `docs/designs/long-campaign/stage-04-runes.md` (status "ready for planning", written with the user)
- Reference: `docs/designs/long-campaign/reference/gear-and-runes.md` §4.4–4.6, §5.2, §5.3, §5.6–5.8
- Plan: `docs/implementation-plans/long-campaign-stage-04/` (11 steps, 0c307a4)
- Branch: `long-campaign-stage-04`, off `long-campaign-stage-03` (6351b34, PR #4, stacked on #3)

## Path

Large, but the architecture and design are done (the stage design cuts from reference/gear-and-runes.md). Straight to planning, as stages 2 and 3 did.

## Decision log

| Date | Decision | By | Alternatives | Reason |
|---|---|---|---|---|
| 2026-11-07 | Stage 4 next | user | stage 5; wait for merges | Index order; depends on 2 and 3, both done |
| 2026-11-07 | Own branch off long-campaign-stage-03 | orchestrator | commit on stage-03 | Stage 3 is under review as PR #4; keep it fixed |
| 2026-11-07 | Accept the planner's 19 corrections (index); D1-D4 defaults put to the user | orchestrator | — | Each settles a contradiction with the code or fills a gap |
| 2026-11-07 | Skip architecture and design; the stage design is the approved design | orchestrator | new design | Stage design marked ready for planning |

## Open questions

- D1-D4 (plan index): asked of the user; D1 blocks step 04, D2 step 07, D3 step 10, D4 step 07.

## Model tiers

- Planner: opus
- Steps (engineer / reviewer): 01 sonnet/sonnet; 02 sonnet/opus; 03 opus/opus; 04 sonnet/opus; 05 opus/opus; 06 opus/opus; 07 sonnet/sonnet; 08 sonnet/opus; 09 opus/opus; 10 opus/opus; 11 opus/opus; overall review opus

## Verification

(none yet)
