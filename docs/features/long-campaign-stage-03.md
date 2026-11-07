# Feature: long campaign, stage 3 (gear families and the first two tiers)

**Slug:** long-campaign-stage-03
**Phase:** 4. Implementation

## Request (user's words)

> Stage 3: gear families (Recommended)  — chosen 2026-11-07 as the stage after stage 2

## Links

- Stages overview: `docs/designs/long-campaign/index.md`
- Design: `docs/designs/long-campaign/stage-03-gear-families.md` (status "ready for planning", written with the user)
- Plan: `docs/implementation-plans/long-campaign-stage-03/` (10 steps, 11b1ca0)
- Branch: `long-campaign-stage-03`, off `armor-resistance` (3f9744e), which is PR B of two stacked PRs

## Path

Large, but the architecture and design are done (the stage design cuts from reference/gear-and-runes.md). Straight to planning, as stage 2 did.

## Decision log

| Date | Decision | By | Alternatives | Reason |
|---|---|---|---|---|
| 2026-11-07 | Stage 3 next | user | stage 5 | Index order |
| 2026-11-07 | Own branch off armor-resistance | orchestrator | commit on armor-resistance | armor-resistance is under review as PR B; keep it fixed |
| 2026-11-07 | Q1: legacy breastplate, axe and greatsword take the reference's strength/spell-skill values (b) | user | (c) axe and greatsword only; (a) none | — (orchestrator recommended (c); the guard will fall, step 10 judges it) |
| 2026-11-07 | Q2: Crossbowman from threat 6, steel from threat 5 (a) | user | Archer's place at 5; steel only; defer | Builds the role without reshaping today's threat-5 fight |
| 2026-11-07 | Accept the planner's renames (Iron Greatsword/Breastplate, cloth robe ladder, Leather Armor/Wolfhide) and the plain Wand of Sparks | user | keep the wand enchanted; other names | Follow the design's naming rule |
| 2026-11-07 | Accept the planner's other corrections (21, index) | orchestrator | — | Each resolves a contradiction with the code or CLAUDE.md |
| 2026-11-07 | Skip architecture and design; the stage design is the approved design | orchestrator | new design | Stage design marked ready for planning |

## Open questions

None yet.

## Model tiers

- Planner: opus
- Steps (engineer / reviewer): 01 sonnet/sonnet; 02 opus/opus; 03 opus/opus; 04 opus/opus; 05 opus/opus; 06 sonnet/opus; 07 sonnet/opus; 08 opus/opus; 09 sonnet/sonnet; 10 opus/opus; overall review opus

## Verification

- Step 01 (864d9f0): guard 248/500 unchanged; Troll Lair longsword t5/L5 0/500; Goblin Raid longsword t3/L3 487; Bandit Camp t3/t4/t5 444/473/470.
- Step 01 review (sonnet): clean; reviewer reproduced the guard and two cells.
- Step 02 (d6212f2): 19 family icons and trading post level 4. Orchestrator viewed the previews. Review (opus) clean; non-blocking: longbow could use the full height; greaves and cap are the weakest reads; keep tier tints pale.
