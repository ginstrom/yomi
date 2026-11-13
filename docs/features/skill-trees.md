# Feature: skill trees and progression

**Slug:** skill-trees
**Phase:** 4 — implementation (stage 1 done at fd6a630; stage 2 done at 82eb925; stage 3 from step 17)

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
| 2026-11-14 | Accept `UnitSnapshot.moved` optional (present only when true) instead of C12's boolean | orchestrator | always present, re-hash the guard | Keeps the guard's hash a regression check; readers use `moved === true` |
| 2026-11-14 | Bandit Captain gets Pin: move `heavy_hand` after `pin` in the `knight` plan (or give the Captain's draft Heavy Hand), in step 16 since it moves play | orchestrator | leave the Captain without Pin | The design's Captain is a Taunt-and-Pin knight; Aldric holds Heavy Hand already, so only bandits move |
| 2026-11-14 | Accept step 14's engine `previewAbility` (real odds for techniques), the probe renames, and an always-enabled Skills button; leave the rename-only commit a956def unsquashed | orchestrator | plain-attack odds; squash | Odds must be the engine's; history rewrite not worth it |
| 2026-11-14 | Policy fix in step 16: `techniqueScore` weighs a technique by the blows that fit in the AP left this turn (⌊AP/cost⌋), not the raw AP ratio, so Power Attack wins when only one blow fits either way. Step 16's engineer moves from sonnet to opus for it | orchestrator | keep the raw ratio; leave to stage 4 | Step 15 review: a 7 AP Power Attack lost to a 5 AP blow at 8 AP though only one fits; an AI correctness fix, not tuning |
| 2026-11-13 | Own branch `skill-trees` off main | orchestrator | commit on main | Precedent: one branch per feature |

## Open questions

(none)

## Model tiers

- Designer: opus; planner: opus
- Steps: engineer tier as in the plan index (sonnet: 01, 02, 07, 08, 13, 15, 16, 22, 23, 26; opus: the rest); reviewer at the same tier as the engineer; overall review opus
- Node 26: `PATH=$HOME/.nvm/versions/node/v26.13.0/bin:$PATH`

## Notes carried forward

- Step 01 baseline is the reference (SN5 441, SP5 445), not CLAUDE.md's older figures.


- To the stage-4 polish: nameplate status letters are ~7 px at 840×560 (step 14). And (from step 06 screenshots): the tree view works and fits at 840×560 but is plain: no lines between a node and what it requires, and the kind stripes are faint. Make it look like a tree before the feature is done.

- Done in step 13: `takenPerks()` keeps passives only; the strip's first line is cut to two lines (`clampLines`) and a test holds all nodes inside the panel. Step 21 adds nodes: the test covers them automatically.

- To step 16 (from step 08 review): CLAUDE.md's scaling paragraph — the stage-1 sentence splits stage 6's "In the run of 237…" narrative; move it after stage 6's text.
- To final QA: step 08's play check was scripted, not hand-played; do a hand-played browser pass with a hero built across two trees.

- Plan decision 2 (guard unchanged) allows a re-hash for a schema-only version bump (step 09 proved the log identical but for schemaVersion).



- To stage 4 tuning (from step 12): area techniques aren't AP-normalised (Volley at 6 AP weighed against one 4 AP shot; Consecrate likewise) — normalise if the simulator over-uses them; Hunter's Mark has no value check beyond affording mark-then-attack; `tauntUse` judges threat by a foe's current attack range.
- To step 21 (from step 11 review): only Taunt's no-roll area passes a `source` to `layStatus`; any other path that ever lays `taunted` would leave no source.

- To step 16: apply the Captain-Pin decision (knight plan order) and note it in step 13's task file; restore Rooted's description clause "or the end of its next turn".

- To step 22 (from step 14 review): foe hover panel shows no AP cost for Taunt, Sprint and Hunter's Mark (only for abilities with mana, weaponAp or needs) — show it for every hero technique; an un-elemental on-hit reads as a bare "+4" (Smite) — say "+4 holy" or "+4 on hit"; a skill-row hover overwrites the header hint and doesn't restore it.

- To stage 4 (from step 16): the `assassin` plan is unreachable for the ready-made heroes (Keen Eye asks Luck 6; they have 4 or less), so parity runs of it measure the fallback; Bandit Camp threat 4 at level 8 is won 500 of 500 by every plan, so parity needs a harder cell at level 8; at 8 AP with a 4 AP bow, Aimed Shot (6 AP) now gives way to two plain shots, as the blows-that-fit rule intends.

- To step 18 (from step 17 review): add draw-count asserts for Skirmisher, Executioner and Fortune (the three traits without one).
- To steps 21/22 (from step 17 review): Skirmisher's +10 isn't in walk-then-attack previews or the policy's scoring from the current hex (reads the unit's current `moved`); the tree strip labels a Spellsword Strike "(weapon + 1)" even for an Arcane Knight (weapon + 0).

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

### Stage 2 (step 16, 2026-11-14; seed 1, 500 each, recorded and not tuned)

Measured after step 16's two play changes: `techniqueScore` weighs a technique by the blows that fit in the AP left this turn, and the `knight` plan takes Heavy Hand after Pin (the bandit Captain pins at level 6).

| Figure | Step 01 | Stage 1 | Stage 2 |
| --- | --- | --- | --- |
| one party (`--parties 1`) | 230 | 425 | 449 |
| default company | 239 | 425 | 449 |
| `--ready-level 10` | 389 | 470 | 488 |
| deaths a campaign (one party) | 1.8 | 1.0 | 0.5 |
| days a campaign (one party) | 270 | 333 | 339 |
| GR3 / BC3 / BC4 / BC5 | 500 / 429 / 473 / 469 | 500 / 473 / 485 / 482 | 500 / 494 / 495 / 488 |
| SN5 / SP5 / TL5 | 441 / 445 / 0 | 498 / 492 / 0 | 500 / 495 / 8 |
| SG7 / SG10 | 0 / 2 | 4 / 199 | 0 / 422 |
| F1 / F2 / F3 | 500 / 499 / 441 | 500 / 500 / 493 | 500 / 500 / 493 |
| run time (one party) | 270 s | 329 s | 341 s (company 282 s, `--ready-level 10` 592 s) |

No campaign fell under 150 of 500. All three campaigns sit far above their bands (215–250, 220–260, 370–420); BC3, BC4, SN5 and SP5 are above theirs, BC5 inside, SG10 far above step 01's. Stage 4 tunes.

Techniques a battle, one-party campaign: heroes Taunt 2.18, Aimed Shot 1.66, Pin 1.34, Volley 1.02, Hunter's Mark 0.35 (5.11 taunts and 0.75 pins laid, 4.0 mana on techniques); foes Taunt 0.17, Aimed Shot 0.08 (0.43 taunts laid, no pin, no mana). BC4: heroes Aimed Shot 3.21, Taunt 1.70 (3.25 taunts laid); foes Taunt 0.06. Bandits reach level 6, where the Captain pins and the Brute cleaves, only at threats 6 and 7, off today's map.

Path parity, first look (Bandit Camp threat 4, 500 battles, each plan in its role's slot; the other two heroes on their default plans). At level 4: melee knight 495, paladin 494, spellsword 490, swordmaster 489, assassin 489; archery ranger 495, assassin 444 (−51), rogue_archer 428 (−67); magic healer 497, evoker 495, arcanist 482, cryomancer 478, saint 479. At level 8 all 13 plans win 500 of 500, so that cell no longer tells plans apart. Flagged (more than 50 below the role's best): archery `assassin` and `rogue_archer` at level 4. Why: the assassin path opens with Keen Eye (Luck 6) and the ready-made heroes have Luck 4 or less, so the `assassin` plan takes no assassin node and falls back to `PERKS` order (Aldric then follows the swordmaster's nodes, so melee `assassin` equals `swordmaster`; Brenna takes Toughness and Shield Wall); `rogue_archer` gives Brenna Sprint and Skirmisher, never Aimed Shot. Healer, saint, assassin and rogue run without their stage-3 nodes. Details in step 16's execution record.

