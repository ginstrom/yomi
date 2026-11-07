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
| 2026-11-07 | Breastplate strength 4 -> 3 after step 05 measured the guard at 175 (231 at step 04, 248 at step 01) | user | breastplate no values; keep 175 and tune in step 10; accept 175 | Keeps weight on today's armour at no cost to the strength-3 heroes; spell skill -5 stays for step 10 to judge |
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
- Step 03 (2814cc1, daa9aa8, cab3a4d): 15 gear sprites on the body. Orchestrator viewed the loadouts. Review (opus) clean; leather and cap were weak reads at battle scale, polished by the same engineer in cab3a4d (oxblood leather with pauldrons, cap with a light crown and red brim), orchestrator viewed. Robe stops at the hips (layering rule).
- Step 04 (1945673, fd77db5): catalog, ids, renames, plain wand, SAVE 16. Guard 248 -> 231 under Q1 (b); scratch runs pin all of it on the breastplate's spell skill -5 on the mage (the wand moves nothing). Engineer amended step 05's checkpoint (strength 4 vs the archer's and mage's 3 will move it further). Review (opus) clean, guard reproduced; wording nits (index 398/457, task 04 §6) passed to step 05; step 10 must write 231 and its cause into CLAUDE.md.
- Step 05 (6514b5c, bb0a474): weight and reach, isMelee, LOG 22. Guard 231 -> 175, all from the breastplate's strength 4 (scratch run identical to 231). Review (opus) clean, guard and neutrality reproduced; non-blocking: the spear policy test passes without reach; the reach thrust test rolls only a miss; a bow at the next hex now plays as a shot. User chose breastplate strength 3 (follow-up, sonnet).
- Breastplate follow-up (7ed89c6, sonnet): strength 3, guard 231 identical to step 04; spear test now asserts melee at distance 2. Reviewed with step 06.
- Step 06 (2ea4b87): trading post level 4, filter, simulator buying. Guard 233 (+2: the 20 silver kept for level 4 shifts sales; reviewer's isolating run gives 231). Tier 2 never bought in the simulator (post ends at 1.1). Review (opus) clean; nits passed to step 07 (steel_longsword@3 = 240 assertion; index rows for step 05/Q1 and step 06's SHA).
- Steps 07 and 08 run in parallel (plan allows; separate files).
- Step 08 (a3b34ba, 718c776): bandit_crossbowman sprite. Orchestrator viewed it beside the bandits. Review (opus) clean; optional: the white string slightly outshines the bow-arm.
