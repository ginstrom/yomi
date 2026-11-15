# Feature: skill trees and progression

**Slug:** skill-trees
**Phase:** 4b — node-cost amendment: implementing steps 27–31 (tiers: 27 sonnet, 28 opus, 29 sonnet, 30 opus, 31 sonnet; reviewers at the same tier) (verification of the base feature done, fixes at dae81d1). Earlier: 4 — implemented (all 26 steps done; manual, screenshots and CLAUDE.md current)

## Request (user's words)

> I would like you to iterate on the game through dev, local testing, and browser testing until you get an awesome skill tree and progression for each of the classes. There should be consequential decisions when choosing new skills. For example, warriors should have paths of spellsword (add offensive skills), swordmaster (damage dealer), and heavy knight (defensive, skills like taunt to attract enemy attacks, rooted to increase defense when not moving, and pin to prevent enemies from movimg away). Some skills are passive and always on; some can be used at will; and some require mana to use (such as "pin" or offensive spells). We should have a mage and cleric class. Cleric tree would be healer, paladin, saint. The scout class could go into ranger, rogue, assassin. Make a well balanced skill progression that requires hard decisions and is fun to play, as well as balanced.

Intake clarification (2026-11-13), on how classes fit: "I actually like the ability to choose any direction you want, and even mix, so for example you could go down the warrior tree for a while and then start down the assassin tree. Maybe the name of the tree would be "warrior", "mage", "etc." like the skill tree in skyrim in flavor."

## Links

- Design: `docs/designs/skill-trees.md` (approved 2026-11-13; picks every other level, 95 nodes)
- Plan: `docs/implementation-plans/skill-trees/` (26 steps in 4 stages, 19030e8; all done)
- Branch: `skill-trees`, off main (d18abf4)

## Path

Large/structural (hero abilities in the engine, new perk tree data, save format, AI policy, simulator retune, UI). No separate architecture brief: the engine already has monster abilities, statuses and a data-driven perk/spell system to extend, so the designer grounds the integration in its design (orchestrator's call).

## Decision log

| Date | Decision | By | Alternatives | Reason |
|---|---|---|---|---|
| 2026-11-15 | Step 30: SG10 at 1 accepted, against its floor of 2 ("Accept (Rec.)"); the Horror stays at 63 hit points | user | `FOE_HP_PER_LEVEL` 1.0 (SG10 3, but one party 278, over its band) | A near-zero cell either way; the Horror's hit points are the user's |
| 2026-11-15 | Step 30: the evoker's level-4 parity at −54 accepted ("Accept (Rec.)"), a cost of the path's shape at level 4 (both tier 1s held from creation, tier 2s cost 2, so the plan saves) | user | an off-path Arcane Blood at 4 in the evoker plan | The parity plan should measure the path alone |
| 2026-11-15 | Step 30's plan-order changes accepted as deliberate: Aldric's Unbreakable at 13 (design §4.4: 15) and Delwyn's Meteor at 15 (NC5: 14), with Arcane Blood 4, Heal All 6, Fireball 9; step 31 restates them, and CLAUDE.md's stale bandit node levels | orchestrator | keep the design's levels | Lever 1 of the step's levers; they bring the parity capstones to 14 and BC4 and the days into band |
| 2026-11-14 | Node-cost plan (steps 27–31, 9a0ef2f) accepted. The level-14 capstone check aims for ±50 of 500 and reports each gap rather than gating. Save migration is folded into step 28. | orchestrator | ±10% as a hard gate | the user already accepted parity at higher levels as limited by the party and the AI (step 24) |
| 2026-11-14 | Node-cost amendment approved (docs/designs/skill-trees-node-costs.md): capstone costs 4, the currency is "perk points", the capstone check is at level 14 | user | capstone 3; talent points; keep level 12 | the designer's recommendations, all taken |
| 2026-11-14 | Point-cost economy for nodes: "How about a cost system for skills that grows with power. So you get 1 skill point per level up, and at first you are buying a skill per level. Then they go to 2 points, and 3, with progressivley more powerful but costly skills?" | user | capstone confirmation only; capstone depth 6; slower pick rate; leave as is | the simulated player found picks after level 6 too cheap (a Ranger held all 8 Ranger nodes at 12). Design amendment, plan and re-tune follow. |
| 2026-11-14 | No respec | user | paid respec at the guild hall | permanence keeps choices hard |
| 2026-11-14 | A tab's key on its own tab does nothing; only Esc closes the panel (no more "press I again to close") | orchestrator | keep the toggle and fix Esc another way | the toggle let S close the panel and Esc then open the menu; one rule for all tabs |
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
| 2026-11-14 | Blademaster refunds only attacks and strike techniques, not area techniques (Volley, Consecrate); a routine felling on any strike refunds its whole cost | orchestrator | refund areas too (needs an AbilityEvent field) | Blademaster is the melee duellist's capstone; an area refund would be a balance outlier and a schema change |
| 2026-11-14 | A hit that deathblows a unit doesn't spend its Unbreakable save (judged on the hp the hit would leave) | orchestrator | spend the save anyway | Avoids "endures the blow. A deathblow!" and a wasted save that Revive would later expose |
| 2026-11-14 | Purify is a cleanse, not a heal: excluded from world-map healing, `autoHeal` and the policy's heal choices (its own `purifyCast` step uses it); a purified ally gets no AP back this turn | orchestrator | count it as a 1d6 heal; refund AP | A 1d6 heal at 4 mana would crowd out real heals; AP refund adds a rule for little play |
| 2026-11-14 | Stage 4 closes the gap (449 → 215–250) mostly with tougher foes: foe counts, hit points per level, bandit plans and gear; trim only outlier skills. Reverses design §7.2's lever order | user | weaker skills first; accept easier | Keep skills punchy so choices feel powerful |
| 2026-11-14 | Capstones checked at level 12 against Bandit Camp threat 7, each path's capstone within ±10% of the best | user | judgement only | Threat-5 cells are won ~100% at level 12 |
| 2026-11-14 | Parity at levels 8 and 12 accepted as limited by the three-hero simulated party and the AI; level-4 parity is the test | user | a four-hero parity party; a focus-fire policy step; raise the weak paths' numbers | Step 24: foes shoot the softest hero and the mage carries the party's damage |
| 2026-11-14 | Rogue for an archer accepted (a melee and skirmish path an archer mixes in on purpose); `rogue_archer` stays in the parity set as a reported figure only | user | buff Skirmisher for shots; drop the plan | Step 24: −109 at level 4 |
| 2026-11-14 | The policy's Bane fix (no recast where fewer than two units are not yet baned) kept for monsters too: the Goblin Shaman and the Blight Horror | orchestrator | heroes only | An AI fix that makes foes slightly better, in the direction of tougher foes |
| 2026-11-13 | Own branch `skill-trees` off main | orchestrator | commit on main | Precedent: one branch per feature |
| 2026-11-14 | "Back to 63 HP": the Blight Horror keeps 63 hit points and its claws at 2d6+2 (one party 243, company 243); `--ready-level 10` stays at 445, over its band, revisited in stage 9 when threats 6 and 7 come onto the map. Supersedes "Much harder Source" | user | the claws at 2d6+11 (`--ready-level 10` 419); the Horror at 130 hit points (407) | The harder Source's measured cost was one party 36 and company 34 of 500, not the estimated 100 |

## Open questions


(none)

## Model tiers

- Designer: opus; planner: opus
- Steps: engineer tier as in the plan index (sonnet: 01, 02, 07, 08, 13, 15, 16, 22, 23, 26; opus: the rest); reviewer at the same tier as the engineer; overall review opus
- Node 26: `PATH=$HOME/.nvm/versions/node/v26.13.0/bin:$PATH`

## Notes carried forward

- Verification-fix review (clean, dae81d1) left these for the next step that touches them:
  - CLAUDE.md:118 says the panel opens over Battle with "(C, S, B, I)"; it is "C, S, I; B within the panel".
  - skillMenu.test.ts:103 doesn't check the full order of reasons (weapon against recharge, mana against AP).
  - The InventoryScene probe gives cast buttons for spells on pages that aren't shown.
  - abilityList `footerTop` is used only by tests.

- Step 01 baseline is the reference (SN5 441, SP5 445), not CLAUDE.md's older figures.


- To the stage-4 polish: nameplate status letters are ~7 px at 840×560 (step 14). And (from step 06 screenshots): the tree view works and fits at 840×560 but is plain: no lines between a node and what it requires, and the kind stripes are faint. Make it look like a tree before the feature is done.

- Done in step 13: `takenPerks()` keeps passives only; the strip's first line is cut to two lines (`clampLines`) and a test holds all nodes inside the panel. Step 21 adds nodes: the test covers them automatically.

- To final QA: step 08's play check was scripted, not hand-played; do a hand-played browser pass with a hero built across two trees.

- Plan decision 2 (guard unchanged) allows a re-hash for a schema-only version bump (step 09 proved the log identical but for schemaVersion).



- To stage 4 tuning (from step 12): area techniques aren't AP-normalised (Volley at 6 AP weighed against one 4 AP shot; Consecrate likewise) — normalise if the simulator over-uses them; Hunter's Mark has no value check beyond affording mark-then-attack; `tauntUse` judges threat by a foe's current attack range.



- To stage 4 (from step 16): the `assassin` plan is unreachable for the ready-made heroes (Keen Eye asks Luck 6; they have 4 or less), so parity runs of it measure the fallback; Bandit Camp threat 4 at level 8 is won 500 of 500 by every plan, so parity needs a harder cell at level 8; at 8 AP with a 4 AP bow, Aimed Shot (6 AP) now gives way to two plain shots, as the blows-that-fit rule intends.






- To stage 4 (from step 21): Delwyn's capstone comes at 14, not 12: C5 gives him Arcane Study at creation where the design's build B has Destruction, shifting every pick a level — give him the design's build B picks (orchestrator decision); AC1's first tier-3 for Swordmaster and Ranger plans comes at 8; Swift Hands still discounts Purify.


- From step 24: cells in band with tougher foes (`FOE_HP_PER_LEVEL` 1.3, bandits Fine from threat 3, the Nest Spider); one party 268 of 500. Parity at levels 8 and 12 is far apart for reasons of the AI and the party's shape (the user accepted that; level 4 is the test). The Bane fix reaches the Goblin Shaman and the Blight Horror. The cryomancer plan puts Ice Lance before Web (level-12 cell 36 → 324). Step 25 inherits the campaign bands (268, 18 above).

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

### Stage 3 (step 23, 2026-11-14; seed 1, 500 each, recorded and not tuned)

| Figure | Step 01 | Stage 1 | Stage 2 | Stage 3 |
| --- | --- | --- | --- | --- |
| one party (`--parties 1`) | 230 | 425 | 449 | 449 |
| default company | 239 | 425 | 449 | 449 |
| `--ready-level 10` | 389 | 470 | 488 | 488 |
| deaths a campaign (one party) | 1.8 | 1.0 | 0.5 | 0.5 |
| days a campaign (one party) | 270 | 333 | 339 | 339 |
| GR3 / BC3 / BC4 / BC5 | 500 / 429 / 473 / 469 | 500 / 473 / 485 / 482 | 500 / 494 / 495 / 488 | 500 / 494 / 495 / 488 |
| SN5 / SP5 / TL5 | 441 / 445 / 0 | 498 / 492 / 0 | 500 / 495 / 8 | 500 / 495 / 8 |
| SG7 / SG10 | 0 / 2 | 4 / 199 | 0 / 422 | 0 / 386 |
| F1 / F2 / F3 | 500 / 499 / 441 | 500 / 500 / 493 | 500 / 500 / 493 | 500 / 500 / 493 |
| run time (one party) | 270 s | 329 s | 341 s | 272 s (company 270 s, `--ready-level 10` 580 s, `--ready-level 12` 883 s) |

No campaign fell under 150 of 500. The three campaigns, BC3, BC4, SN5 and SP5 stay above their bands (BC5 inside), as at stage 2, and SG10 is far above step 01's (386, from 422). The stage-3 nodes change almost nothing here, because the plans reach them late: a hero has 3 picks at creation and one every even level, so level 8 holds 7 nodes, and the tier-3 traits (Deathblow, Counter, Blademaster and the rest) and the capstones sit past the nodes a level-7 to level-10 hero has bought. The summary's trait lines (counters, deathblows, revives, Unbreakable saves) read 0.000 on every run.  The ready-made heroes' traits at level 12 are Rooted, Guardian, Unbreakable and Deadeye.

AC8, `--ready-level 12`, 500 campaigns (883 s): 473 beat the Source (94.6%), 12 fell, 15 ran out of days, in 736 days and 73.6 battles a campaign; the vanguard ends at levels 11.5 to 12.1. 449 of 500 campaigns (89.8%) end with a capstone in the vanguard: **Unbreakable 627** (Aldric and recruited knights), **Deadeye 452** (Brenna), **Meteor 0**. Delwyn does not reach Meteor by level 12: the `evoker_healer` plan lists it ninth, but his creation pick Arcane Study is not in the plan, so by level 12 (nine picks: three at creation, six at levels 2 to 12) he holds eight plan nodes and Arcane Study, and Meteor is his tenth pick, taken at level 14 (checked on a hero raised to 12 and to 14 with `raisedParty`). So Unbreakable and Deadeye are met and Meteor is not at level 12; stage 4 decides whether to move the plan (Meteor ahead of Mending or Pyromancy) or the level. Callings at the end: Heavy Knight 1443, Evoker 519, Ranger 504, Swordmaster 6.

The traits have not yet been in play in the simulator: Unbreakable is held in 2851 unit-starts of the `--ready-level 12` log and never saves a hero (0 `endured` events), because heroes holding it win 15 783 of 15 784 threat-5 battles; no hero in these logs holds Deathblow, Counter or Revive (the `traits` of every unit at `battle_start` are Rooted, Guardian, Unbreakable and Deadeye only). Stage 4's parity cells (a level above 8) are where the traits will first show.

Play check (a scripted browser run through the real game, a scratch test since removed): a saved game edited so Aldric holds the knight plan's nine nodes at level 12, debug `hp 1 Aldric`, `fight bandit_camp 5` and the driver's play. The Bandit Captain's hit on Aldric logged `defenderHpBefore: 1`, `defenderHpAfter: 1`, `endured: true`. Meteor was not cast by hand; the engine and the policy are covered by steps 20 and 21's tests.

### Stage 4 (steps 24 and 25, 2026-11-14; seed 1, 500 each; final)

| Figure | Band | Step 01 | Stage 3 | Final (step 25) | |
| --- | --- | --- | --- | --- | --- |
| one party (`--parties 1`) | 215–250 | 230 | 449 | 243 | in |
| default company | 220–260 | 239 | 449 | 243 | in |
| `--ready-level 10` | 370–420 | 389 | 488 | **445** | over: accepted by the user, 2026-11-14 ("Back to 63 HP (Rec.)"), to be revisited in stage 9 |
| deaths a campaign (one party) | ≤ 2.0 | 1.8 | 0.5 | 1.0 (company 1.1, rl10 1.0) | in |
| days a campaign (one party) | 243–297 | 270 | 339 | 287 (company 288, rl10 539) | in |
| GR3 / BC3 / BC4 / BC5 | ≥ 470 / 400–470 / 430–490 / 420–490 | 500 / 429 / 473 / 469 | 500 / 494 / 495 / 488 | 500 / 455 / 462 / 484 | in |
| SN5 / SP5 / TL5 | 410–480 / 410–480 / report | 441 / 445 / 0 | 500 / 495 / 8 | 448 / 454 / 0 | in |
| SG7 / SG10 | 0 ± 40 / above 2 | 0 / 2 | 0 / 386 | 0 / 5 | in |
| F1 / F2 / F3 | nearly all / most / 7 in 10 | 500 / 499 / 441 | 500 / 500 / 493 | 500 / 500 / 453 | in |
| run time | near 5 min | 270 s | 272 s | 438 s one party, 470 s company, with other work on the machine (4 min 42 s alone); `--ready-level 10` 1255 s | |

Path parity (step 24, unchanged by step 25, which touched only the Source): at Bandit Camp threat 4, level 4, every plan within ±50 of its role's best but the Scout's `rogue_archer` (−109) and `assassin` (−62); spread melee 443–475, archery 353–462, magic 472–489. Levels 8 and 12 are far apart (the user accepted that as the three-hero party and the AI's doing; details in step 24's record).

How it got there: step 24 made foes tougher (`FOE_HP_PER_LEVEL` 1.3, bandits in Fine iron from threat 3, a fourth foe at the Spider Nest) and fixed the policy, taking one party from 449 to 268. Step 25 raised the Blight Horror's hit points from 55 to 63, which put one party and the company at 243. `--ready-level 10` stayed at 445: parties of five at levels 10 and 11 never lose to the Source, and no foe on today's map, capped at threat 5, is a danger to them. A harder Source (the Horror's claws at 2d6+11) was tried at the user's first word and brought `--ready-level 10` to 419, but one party and the company fell to 36 and 34; the user then chose to keep the 63-hit-point Horror and revisit `--ready-level 10` in stage 9. Details in step 25's record.

Final gates (step 26): `npm test`, `npm run test:browser` and `npm run build` pass; the manual's section 11 holds all 95 nodes and 30 spells from the code; every screenshot retaken; the play walk (creation across two trees, a level-up pick, Sprint in battle, a capstone and the lock on the others) done in the browser. The figures above are the final ones; `--ready-level 10` (445) stays over its band by the user's decision.

### Amendment (steps 27 to 30, 2026-11-15; seed 1, 500 each)

| Figure | Band | Step 25 final | Step 27 baseline | Final (step 30) | |
| --- | --- | --- | --- | --- | --- |
| one party (`--parties 1`) | 215–250 | 243 | 243 | 234 | in |
| default company | 220–260 | 243 | 243 | 236 | in |
| `--ready-level 10` | 370–420 | 445 (accepted over) | 445 | 434 | over, below the accepted 445 |
| deaths a campaign (one party) | ≤ 2.0 | 1.0 | 1.0 | 1.1 | in |
| days a campaign (one party) | 243–297 | 287 | 287 | 286 | in |
| GR3 / BC3 / BC4 / BC5 | ≥ 470 / 400–470 / 430–490 / 420–490 | 500 / 455 / 462 / 484 | 500 / 455 / 462 / 484 | 500 / 455 / 454 / 494 | in |
| SN5 / SP5 / TL5 | 410–480 / 410–480 / report | 448 / 454 / 0 | 448 / 454 / 0 | 451 / 475 / 0 | in |
| SG7 / SG10 | 0 ± 40 / above 2 | 0 / 5 | 0 / 5 | 0 / **1** | SG10 out: for the user |
| F1 / F2 / F3 | nearly all / most / 7 in 10 | 500 / 500 / 453 | 500 / 500 / 453 | 500 / 500 / 463 | in |

Path parity (Bandit Camp threat 4 at level 4, the gate; Hobgoblin Warband threat 5 at 8 and Bandit Camp threat 7 at 14, reported), with the capstone each hero holds at 14:

| Role | Plan | L4 | gap | L8 | gap | L14 | gap | Capstone at 14 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| melee | knight | 454 | 0 | 181 | -98 | 493 | 0 | unbreakable (13) |
| melee | swordmaster | 418 | -36 | 63 | -216 | 471 | -22 | blademaster (12) |
| melee | spellsword | 431 | -23 | 45 | -234 | 481 | -12 | arcane_knight (14) |
| melee | assassin | 436 | -18 | 66 | -213 | 473 | -20 | none (Deathblow at 16) |
| melee | paladin | 445 | -9 | 279 | 0 | 469 | -24 | aegis (14) |
| archery | ranger | 454 | -6 | 181 | -20 | 493 | 0 | deadeye (12) |
| archery | rogue_archer | 447 | -13 (reported) | 119 | -82 | 418 | -75 | shadowdancer (14) |
| archery | assassin | 460 | 0 | 201 | 0 | 461 | -32 | none (Deathblow at 16) |
| magic | evoker | 422 | **-54** | 311 | -185 | 495 | 0 | meteor (12) |
| magic | cryomancer | 454 | -22 | 139 | -357 | 436 | -59 | glacial_prison (14) |
| magic | arcanist | 434 | -42 | 85 | -411 | 51 | -444 | mass_haste (14) |
| magic | healer | 476 | 0 | 85 | -411 | 480 | -15 | revive (13) |
| magic | saint | 471 | -5 | 496 | 0 | 411 | -84 | sanctuary (14) |
| magic | evoker_healer (reference) | 454 |  | 181 |  | 493 |  | none (Meteor at 15) |

Level 4: every plan within ±50 but the evoker (−54, for the user: the path has nothing to buy with a fourth point at level 4). Level 14: melee all within 24; `rogue_archer` −75, cryomancer −59, saint −84 and arcanist −444, the mage carrying the party's damage as in step 24. Both assassins hold no capstone at 14 (Deathblow at 16, by their asks).

How it got there: perk points first took one party to 172, the company to 177 and BC4 to 364 (step 30's first measurement, untuned). Step 30 moved plan orders (the knight's Unbreakable to 13 and the swordmaster's Blademaster to 12, so the parity heroes hold their capstones at 14; Delwyn's Arcane Blood at 4 and Heal All at 6, ahead of Fireball, for BC4 and the days spent camping), put bandits at threat 4 back in plain gear, and lowered `FOE_HP_PER_LEVEL` from 1.3 to 1.15. Details in step 30's record.
