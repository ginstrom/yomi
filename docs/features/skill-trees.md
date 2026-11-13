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

## Verification

(none yet)
