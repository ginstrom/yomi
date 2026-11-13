# Feature: skill trees and progression

**Slug:** skill-trees
**Phase:** 4 — implementation

## Request (user's words)

> I would like you to iterate on the game through dev, local testing, and browser testing until you get an awesome skill tree and progression for each of the classes. There should be consequential decisions when choosing new skills. For example, warriors should have paths of spellsword (add offensive skills), swordmaster (damage dealer), and heavy knight (defensive, skills like taunt to attract enemy attacks, rooted to increase defense when not moving, and pin to prevent enemies from movimg away). Some skills are passive and always on; some can be used at will; and some require mana to use (such as "pin" or offensive spells). We should have a mage and cleric class. Cleric tree would be healer, paladin, saint. The scout class could go into ranger, rogue, assassin. Make a well balanced skill progression that requires hard decisions and is fun to play, as well as balanced.

Intake clarification (2026-11-13), on how classes fit: "I actually like the ability to choose any direction you want, and even mix, so for example you could go down the warrior tree for a while and then start down the assassin tree. Maybe the name of the tree would be "warrior", "mage", "etc." like the skill tree in skyrim in flavor."

## Links

- Design: `docs/designs/skill-trees.md` (approved 2026-11-13; picks every other level, 95 nodes)
- Plan: `docs/implementation-plans/skill-trees/` (26 steps in 4 stages, 19030e8)
- Branch: `skill-trees`, off main (d18abf4)

## Path

Large/structural (hero abilities in the engine, new perk tree data, save format, AI policy, simulator retune, UI). No separate architecture brief: the engine already has monster abilities, statuses and a data-driven perk/spell system to extend, so the designer grounds the integration in its design (orchestrator's call).

## Decision log

| Date | Decision | By | Alternatives | Reason |
|---|---|---|---|---|
| 2026-11-13 | No class lock: four Skyrim-style trees (Warrior, Scout, Mage, Cleric), each of three paths, open to every hero and mixable | user | class picked at creation; class as starting kit; full replacement | Intake answer above |
| 2026-11-13 | Paths: Warrior = Spellsword, Swordmaster, Heavy Knight; Cleric = Healer, Paladin, Saint; Scout = Ranger, Rogue, Assassin; Mage = Evoker (fire/area), Cryomancer (frost/control), Arcanist (buffs/wards) | user | elemental/necro/illusion; designer proposes | Request + recommended |
| 2026-11-13 | Soft lock: early ranks of every path open; going deep closes other capstones; one capstone ever | user | hard lock at level 3; fully open | Recommended |
| 2026-11-13 | Mana for every hero (pool by tree investment/intelligence); techniques like Pin cost mana | user | separate stamina | Recommended |
| 2026-11-13 | Design approved, with one change: picks 1 every OTHER level, with fewer and bigger nodes (revised: 3 + 1 at each even level; tiers L1/L2/L6/capstone L12; 95 nodes) | user | 1 per level | Gate answer |
| 2026-11-13 | Soft lock = capstone only in the calling path, one ever; tiers 1–4 open to all | user | tier 4 fixes a path | Recommended |
| 2026-11-13 | Revive and Unbreakable both kept, once per battle | user | one; neither | Recommended |
| 2026-11-13 | No respec for now | orchestrator (stated in the approval question; the user approved) | paid respec at the shrine | Keeps choices consequential |
| 2026-11-13 | Guard bands, out of 500 from seed 1: one party 215–250, company 220–260, ready level 10 370–420 | orchestrator (the designer's recommendation) | — | Brackets today's 230/239/389 |
| 2026-11-13 | Creation's rule line says "every even level", amending the design's quoted "every level" | orchestrator | keep the quote | The quote contradicts the user's pick-rate decision |
| 2026-11-13 | Accept step 06's tier-aligned rows (one more row than the design) and creation's perks step without the summary column (revisit at polish) | orchestrator | — | Recorded deviations, tested; layout needs it |
| 2026-11-13 | Own branch `skill-trees` off main | orchestrator | commit on main | Precedent: one branch per feature |

## Open questions

(none)

## Model tiers

- Designer: opus; planner: opus
- Steps: engineer tier as in the plan index (sonnet: 01, 02, 07, 08, 13, 15, 16, 22, 23, 26; opus: the rest); reviewer at the same tier as the engineer; overall review opus
- Node 26: `PATH=$HOME/.nvm/versions/node/v26.13.0/bin:$PATH`

## Notes carried forward

- To step 12/14 (from step 04): the policy's `reach` uses a spell's own AP cost, not `spellApCost` (Quickened Casting); `autoHeal` picks heals without counting Mending; the battle spell list shows the base AP cost until step 14.
- Step 01 baseline is the reference (SN5 441, SP5 445), not CLAUDE.md's older figures.

- To steps 11 and 17 (from step 05): when raising SAVE_VERSION, add the previous version (23, then 24) to parseSave's accepted list `[SAVE_VERSION, 22, 18]`; no game migration needed.

- To the stage-4 polish (orchestrator, from step 06 screenshots): the tree view works and fits at 840×560 but is plain: no lines between a node and what it requires, and the kind stripes are faint. Make it look like a tree before the feature is done.

- To step 13 (from step 07 review): `InventoryScene.takenPerks()` filters `nodeKind !== 'spell'`; make it `=== 'passive'` before techniques land, or they show under Passives too.
- To steps 13 and 21 (from step 06 review): the tree strip's line 1 wraps freely and is near the panel's bottom (y 493 of 500 for Meteor); cap it at two lines or test the longest strip once wordier technique text lands.

## Verification

### Stage 1 (step 08, 2026-11-13; seed 1, 500 each, recorded and not tuned)

| Figure | Step 01 baseline | Stage 1 |
| --- | --- | --- |
| one party (`--parties 1`) | 230 | 425 |
| default company | 239 | 425 |
| `--ready-level 10` | 389 | 470 |
| deaths a campaign (one party) | 1.8 | 1.0 |
| days a campaign (one party) | 270 | 333 |
| GR3 / BC3 / BC4 / BC5 | 500 / 429 / 473 / 469 | 500 / 473 / 485 / 482 |
| SN5 / SP5 / TL5 | 441 / 445 / 0 | 498 / 492 / 0 |
| SG7 / SG10 | 0 / 2 | 4 / 199 |
| F1 / F2 / F3 | 500 / 499 / 441 | 500 / 500 / 493 |
| 500-campaign run time (one party) | 270 s | 329 s (company 352 s, `--ready-level 10` 663 s) |

No campaign fell under 150 of 500. Every campaign figure is well above its band (215–250, 220–260, 370–420), the cells BC3, SN5 and SP5 above theirs (BC4 and BC5 inside), and SG10 far above step 01's; stage 4 (steps 24, 25) tunes. The guard fixture needed no re-recording (it passed unchanged after steps 03 and 04's).

