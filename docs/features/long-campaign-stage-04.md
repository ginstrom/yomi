# Feature: long campaign, stage 4 (runes)

**Slug:** long-campaign-stage-04
**Phase:** 6. Report — done; ready for PR (not opened)

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
| 2026-11-07 | Accept: the simulator never fills a socket (guard 230 says nothing about runes); left for stage 12's policies | user | make the sim buy socketed gear | Tier 2 is a player's purchase |
| 2026-11-07 | Accept check 2: Ember III at Troll Lair t5/L5 wins 2/500 (Seared works; cell unwinnable for any weapon) | user | judge on another cell; strengthen Ember | Rune behaves as designed |
| 2026-11-07 | Fix now: socket hint, on-hit line on the character sheet, rune effects in pouch rows | user | list as known issues | Friction found by the simulated user and QA on the stage's own screens |
| 2026-11-07 | In battle, a gear change only caps hp at the new max (matching the engine); the share rule is outside battle only | orchestrator | share rule in battle too | Share rule in battle would heal mid-fight by putting Life armour on |
| 2026-11-07 | Step 11 reviewed by the overall review rather than a separate step review | orchestrator | separate step review | Step 11 is docs and measurement; the overall review covers it in full |
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
- Step 08 (4c55ee9, 12b061b, sonnet): pips, tooltips, wards line, +N element text, victory runes, step 05 follow-ups. Review round 1 (opus): blocking, Wards line overflowed the panel; fixed in f1e71e7 (wardsLines wraps), orchestrator viewed; re-review: clean (reviewer eyeballed wards+mana+piercing at 840 and 1280; browser timeouts under load passed alone).
- Step 10 (5e04803, opus): simulator rune loot, RUNE_ORDER/runecraftGear, all gear writes clamp; guard 230 (-3): runes found ~13/campaign but sockets almost never worn, so they sit in the pouch. Deviation: baggage sold once. Review (opus): clean, guard 230 reproduced; deviation accepted (second sale would be empty); nits to step 09.
- Step 09 (opus; cut off once by the 5-hour rate limit, resumed): cea4f9b (square brackets), d106d2c (06/10 review follow-ups), c68c69a (Runes tab, post Runes filter and sales, encampment lines), 9d9e045. Orchestrator viewed embed preview, fuse refusal, post runes. Review (opus): clean; 5 non-blocking fixed in 58805d7 (one on-hit line, field-embed test off the encampment, shared aRune, FUSE_COUNT, sim test); re-review running.
- Step 11 (9d1b7d2, opus): guard 230; check 2 ember1 0/500 (52.6 dmg), ember3 2/500 (58.9); docs, manual (Runes section, two new screenshots), stage notes; play script walked headless except the floating text at impact and the Seared nameplate letter.
- Overall review (opus) at 9d1b7d2: clean; npm test 1188, build, sprites:check, browser 89/89. Non-blocking: battle panel HP can disagree with the engine (character's share rule vs engine clamp on in-battle equip); CLAUDE.md comma; unticked checklists in 05, 06, 08, 10, 11; stages index row omits the Seared letter; "none → +1 fire".
- Simulated user (sonnet, hands-on) at 9d1b7d2: all 6 goals met (goal 1 partly from in-game). Friction: Runes tab's "nothing with a socket" dead end with no hint which gear has sockets; character sheet damage omits on-hit; pouch rows don't say what a rune does; stale last-action message; placeholder tutorial; workshop blurb wording. Evidence su-* in .git/pr-review/long-campaign-stage-04/evidence/.
- QA (sonnet) at 9d1b7d2: pass. Saw the floating "+3 fire" at impact and Seared's "F" on the troll (evidence 41, 42). Minor: tooltip repeats the rune line; character sheet damage omits on-hit; stale bottom message; tooltip covers figure at 840. Gaps: in-battle Life equip, Dawn/Salamander ward not driven in play.
- Fix round 1 (opus): 3d21e16 (battle panel caps hp), afa845c (stale message; no "none →"), c3c7e9f (socket line names runes), be3cb26 (socket hint, pouch hover), ca95bc6 (On a hit on the Character tab), f4be440 (docs, play script walked). Orchestrator viewed the hint, pouch hover, Character tab and runed tooltip. Re-review (opus): clean; npm test 1197, browser 89/89. CLAUDE.md grammar nit fixed by the orchestrator (the comma was already there).
- Known issues for the PR: a runed weapon's tooltip lists each on-hit effect on its own line (long with two runes, per C2); no On-a-hit line on the Inventory tab (tooltip has it); the simulator never fills a socket (accepted); Ember III doesn't win the Troll Lair t5 cell (accepted); tutorial still placeholder; world header's stock is stale under overlays (pre-existing); Dawn bane and a hero ward vs the Salamander checked in tests, not driven in play.
