# Feature: long campaign, stage 3 (gear families and the first two tiers)

**Slug:** long-campaign-stage-03
**Phase:** 6. Report — done; PR #4 open (stacked on #3)

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
| 2026-11-07 | Bandit steel from threat 6, not 5 (amends Q2 (a)) after step 09 took the threat-5 camp cell 469 -> 256 | user | keep steel at 5 and retune; accept 256 | Today's map tops out at 5; steel comes with the outer rings |
| 2026-11-07 | Accept and document the guard at 233 (from 248; the breastplate's spell skill -5 on the mage) | user | breastplate spell skill 0; retune the economy | Armour hampering casting is the point of weight |
| 2026-11-07 | Threats 6 and 7 camp cells (2 and 1 of 500) left for stage 9 | orchestrator | tune now | Off today's map; counts there are a first guess the stage-9 rings retune |
| 2026-11-07 | A click on a foe that no walk can reach with the attack's AP does nothing (was: walk as close as possible), plus a hint line and a panel warning when a weapon costs more AP than the hero has | user | silent; walk closer again | The old walk wasted the turn's attack (halberd, bow into melee) |
| 2026-11-07 | Accept design checks 2 and 3 as unmet (hammer: most damage, 0 wins for all; spear 443 vs 486, second rank not simulated) | user | tune the spear; tune both | Weapon balance revisited with runes and high tiers |
| 2026-11-07 | Simulated user's friction (robe warning, halberd AP visibility, two-click equip, steel-at-level-4 hint, placeholder tutorial) listed as known issues, not fixed | user | cheap text fixes; all but tutorial | Outside the stage's design |
| 2026-11-07 | Open stage 3 as PR #3 stacked on #2 | user | not yet | — |
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
- Step 07 (0ddaa77, ccebdb1, f5fe678): screens. Review round 1 (opus): blocking, crafting never showed the holder's strength shortfall (plan gap); fixed in ccebdb1 with the refusal-under-button layout; round 2 clean. Hand-off to step 10: manual.shots.ts can't reach iron_sword@2 on page 1 (click the Longsword family first); nit: an e2e test name says baggage but doesn't check it.
- Step 09 (0dc549b): bandits in tier 2 from threat 5, Crossbowman from threat 6, SAVE 17. Cells t3 429 (moved by steps 04/05), t4 473, t5 256 (from 469), t6 2, t7 1; guard 233. Review (sonnet) clean, t5 cell reproduced. User then chose steel from threat 6 (step 10).
- Step 10 (6dd07c3, f3d7c01): bandit steel from threat 6 (t5 cell 469), guard 233 documented, docs and manual with screenshots. Check 2 (hammer vs armoured troll: 0 wins for every weapon, hammer most damage) and check 3 (spear 443 vs longsword 486 at Goblin Raid t3) not met: for the user. Review (opus) clean, guard and cells reproduced; doc nits (manual image paragraph at ~484; crossbow takes timber; silver missing from CLAUDE.md's far materials) to fix in verification.
- Overall review (opus) at 16e495b: clean; npm test 1053, build, sprites:check, browser 81/81. Non-blocking: CLAUDE.md pointer to inventory.ts weapon note (now catalog.ts); ground pile icon untinted in battle; Crossbowman draft copied rather than spread; Kobold Diggers' fixed loot is still the (now plain) Wand of Sparks (note for the PR).
- QA (sonnet) at 16e495b: pass. Minor: character panel overflows with a Pierces row (pre-existing, now common); To Hit can show negative (floor not shown); spell-skill penalty only in tooltips; Bearded rows crushed in the workshop; modifier list briefly stale. Evidence qa-01..13 in .git/pr-review/long-campaign-stage-03/evidence/.
- Simulated user (sonnet, hands-on) at 16e495b: goals 1, 2, 4 met; 3 partly; 5 lost (level-1 party vs threat 5, not a balance signal). Found: clicking a foe in reach makes the unit walk and lose its attack (halberd, bow). Friction for the user to weigh: no warning the robe trades protection for mana; the halberd's 7 AP visible only in tooltips; two clicks to equip from the baggage; tutorial still placeholder; the trading post doesn't say when steel arrives.
- Fix round 1 (engineer opus): attack-click walk, panel overflow, spell skill on the Spells tab, workshop labels, typo, doc nits, ground tint, Crossbowman draft. Done: d16bcf9 + 19cb30d (planAttack no longer walks without its attack; the approach fallback dated from d0efd10, before stage 3; stage 3's 7 AP halberd and the bow's walk-to-adjacent made it bite), aa402c4 (panel layout), c853a59 (Spells tab spell skill), 86dfc3d (modifier buttons name only; detail in the preview), 5d478c6 (Crossbowman draft spread), 2fc0b21 (ground tint), 4c70df4 (docs), 78eb58a (manual screenshots). The "iten" typo is not in the repository (the text reads "an item"); the stale modifier list is the deliberate next-tick redraw, one frame. Checks: npm test 1060, build, sprites:check, browser 84/84.
- Fix round 1 re-review (opus) at HEAD: clean; npm test 1060, browser 84/84 (4 load timeouts on a concurrent run passed on rerun). Open for the user: a click on an unreachable foe is now silent (faded swords only), sharpest when a weapon costs more AP than the unit ever has; reviewer recommends a hint. Pre-existing: the battle hint line cut at 840 wide.
- Hint and warning (adcbca9, sonnet; review sonnet: blocking, hint stayed when moving onto a button; fixed 874789e). Orchestrator viewed both at 840x560.
- PR stack fixed: #2 had merged into encampment-gear-and-resistance after #1 went to main, so its work wasn't on main; reopened as #3 (armor-resistance -> main), user's choice.
- pr-reviewer at d9a464a: ready. CRISP-predicted nits fixed (e7ce4e9, 275a9f4, d9a464a; a broken intermediate commit squashed); two dismissed (simulator buys dearest, as designed; bandit gear ids, test-covered). Record .git/pr-review/long-campaign-stage-03.md.
- PR #4 https://github.com/ginstrom/yomi/pull/4 (long-campaign-stage-03 -> armor-resistance), ready for review.
