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
| 2026-11-07 | D1: when a Life rune's max HP drops (gear off outside battle), keep the same share of HP, not clamp | user | clamp, lose the excess (planner default) | — ; step 04 amends the plan and implements it |
| 2026-11-07 | D1 applies both ways: max HP rising (Life gear put on) also keeps the share, so a swap is reversible | orchestrator | rise leaves hp unchanged (plan) | Taking Life gear off and on otherwise bled HP (20/40 -> 18/36 -> 18/40); symmetric reading of the user's 'keep the same share' |
| 2026-11-07 | Runed item names use square brackets, "Masterwork Iron Longsword [Ember I]", not ⟨ ⟩ (design §4, C2) | user | keep ⟨ ⟩; ‹ › | ⟨ ⟩ read as ( ) at the tooltip's 12px; step 09 makes the change |
| 2026-11-07 | D2 Source loot uses threat 5's row; D4 rank 3/4 prices 135/405; D3 simulator rune order Ember>Storm>Stone weapons, Stone>Life armour, workshop only | user | — | Defaults accepted |
| 2026-11-07 | Accept the planner's 19 corrections (index); D1-D4 defaults put to the user | orchestrator | — | Each settles a contradiction with the code or fills a gap |
| 2026-11-07 | Skip architecture and design; the stage design is the approved design | orchestrator | new design | Stage design marked ready for planning |

## Open questions

None.

## Model tiers

- Planner: opus
- Steps (engineer / reviewer): 01 sonnet/sonnet; 02 sonnet/opus; 03 opus/opus; 04 sonnet/opus; 05 opus/opus; 06 opus/opus; 07 sonnet/sonnet; 08 sonnet/opus; 09 opus/opus; 10 opus/opus; 11 opus/opus; overall review opus

## Verification

- Step 01 (6ad6ab4, sonnet): guard 233/500 unchanged from stage 3; Troll Lair t5/L5 iron_sword@3 0/500 (49.8 dmg), iron_sword 0/500 (42.3).
- Step 02 (7dab325, sonnet): ten rune icons, socket pips on a 6px pip canvas. Orchestrator viewed the preview: reads well.
- Step 01 review (sonnet): clean, guard and cell reproduced. Step 02 review (opus): clean; empty pip contrast and pip crowding noted for step 08.
- Step 03 (1e51399, opus): runes.ts, id grammar with runes, on-hit/wards/maxHp item stats, crafting keeps runes; guard identical (233). Plan amended for D1 (C3 now clampHp(character, maxBefore)).
- Step 03 review (opus): clean; guard reproduced; nits passed on.
- Step 04 (724a09a, sonnet): maxHp/wards/onHit derived, clampHp both ways, pouch saved, SAVE 18, debug give/runes; guard 233. Review (opus): clean; nits (rise test, CLAUDE.md wording, itemPlace not clamping) passed to step 06.
- Step 05 (9b46d64, opus): on-hit in the engine, Horror blightborn, LOG 23, policy and tally; guard 233. Review (opus): clean, guard reproduced; nameplate status redraw for on-hit statuses and duplicate status in the log line passed to step 08.
- Steps 06 (opus) and 07 (sonnet) started in parallel.
- Step 07 (2d7d130, sonnet): loot.ts, rune wares and prices. Review (sonnet): clean.
- Step 06 (b1eeef1, opus): runecraft.ts (embed/extract/fuse, costs 5/10/10 a rank), itemPlace worn paths clampHp, rise test. Review (opus) running.
- Step 06 review (opus): clean, guard reproduced; nits ("a Ember" article, weak field-day events test, CLAUDE.md runecraft clamp note) to step 09.
- Step 08 (4c55ee9, 12b061b, sonnet): pips, tooltips, wards line, +N element text, victory runes, step 05 follow-ups. Review round 1 (opus): blocking, Wards line overflowed the panel; fixed in f1e71e7 (wardsLines wraps), orchestrator viewed; re-review running.
- Step 10 (5e04803, opus): simulator rune loot, RUNE_ORDER/runecraftGear, all gear writes clamp; guard 230 (-3): runes found ~13/campaign but sockets almost never worn, so they sit in the pouch. Deviation: baggage sold once. Review (opus) running.
