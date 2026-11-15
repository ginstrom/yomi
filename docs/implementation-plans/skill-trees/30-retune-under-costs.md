# Step 30: Re-tune under costs

[Plan index](index.md) (Stage 5) · [Amendment design](../../designs/skill-trees-node-costs.md) §6 (consequences), §7.2 (re-measurement), §8.3 (risks), N9, NC9 · [Main design](../../designs/skill-trees.md) · [Feature record](../../features/skill-trees.md) (decision log, Verification)

**Difficulty:** opus. Leave the engineer's and the reviewer's model unset. This step judges balance: which lever to move, how far, and when a figure is the user's to accept.

## 1. Objective

Measure the game under perk points, then bring the cells, the level-4 path parity and the three campaigns back into their bands by the design's levers, in order, or stop and report a figure for the user to accept. The level-8 parity and the level-14 capstone cell are measured and reported. A test fixes that every parity plan's hero holds its capstone at level 14. The guard is re-recorded with the final play; the feature record gains an "Amendment" table.

## 2. Requirements and context

- **N9:** "Balance is re-measured by the step 24 and 25 method. The cells, the level-4 parity check and the three campaigns land in their bands, or the user accepts the figure."
- **NC9 (this step's share):** "The cells, level-4 parity and the three campaigns are in their bands, or the user has accepted the figure."
- **Design §6, consequences:** heroes hold one node fewer from level 4 and two fewer at 12; Aldric's capstone moves from 12 to 15 and Delwyn's Meteor from 12 to 14; at the ready level of 7 the ready-made party lacks Pin, Far Shot and Heal All; bandits lose a node at level 4 only. Expect one party (243) and the company (243) to fall, perhaps below their bands; `--ready-level 10` (445, over its band by the user's acceptance) is expected to fall toward the band, which is welcome. **Lever direction**: follows the user's stage-4 decision ("keep skills punchy; tougher foes") in reverse: if heroes are now too weak, ease the foes rather than trimming or inflating nodes.

### Design §7.2, restated

Seed 1, 500 each, one run at a time, Node 26. Outputs `logs/30-<name>[-a|-b…].{jsonl,txt}`.

1. Baseline: done in step 27 (the index's 27 baseline column and step 27's parity tables).
2. **First measurement** with the economy and the plan reorders (steps 28 and 29's code), before any tuning: the cells, the parity at 4, 8 and 14, and the three campaigns. Fill the index's "30 first (untuned)" column.
3. **Cells**, a party of the threat's level:

| Cell | Encounter, threat, level | Band | Step 25 final |
| --- | --- | --- | --- |
| GR3 | `goblin_raid` 3, level 3 | ≥ 470 | 500 |
| BC3 | `bandit_camp` 3, level 3 | 400–470 | 455 |
| BC4 | `bandit_camp` 4, level 4 | 430–490 | 462 |
| BC5 | `bandit_camp` 5, level 5 | 420–490 | 484 |
| SN5 | `spider_nest` 5, level 5 | 410–480 | 448 |
| SP5 | `salamander_pool` 5, level 5 | 410–480 | 454 |
| TL5 | `troll_lair` 5, level 5 | report only | 0 |
| SG7 | `source_guardians` 5, level 7 | 0 ± 40 | 0 |
| SG10 | `source_guardians` 5, level 10 | above 2 | 5 |
| F1, F2, F3 | `goblin_raid` 1, 2, 3, level 1 | nearly all, most, 7 in 10 | 500, 500, 453 |

4. **Parity** (only the role under test overridden through `--plans`; the other heroes on `planFor`'s plans):

| Parity cell | Encounter, threat, level | Judged |
| --- | --- | --- |
| L4 | `bandit_camp` 4, level 4 | each plan within ±50 of its role's best (the gate; `rogue_archer` reported only) |
| L8 | `hobgoblin_warband` 5, level 8 | reported (the user accepts level-8 gaps as the AI's) |
| L14 (capstone) | `bandit_camp` 7, level 14 | target ±50 of the role's best; reported (decision 14) |

Plans: melee `knight`, `swordmaster`, `spellsword`, `assassin`, `paladin`; archery `ranger`, `rogue_archer`, `assassin`; magic `evoker`, `cryomancer`, `arcanist`, `healer`, `saint` (and `evoker_healer` for reference).

5. **Campaigns:**

| Run | Band | Step 25 final |
| --- | --- | --- |
| one party (`--parties 1`) | 215–250 | 243 |
| default company | 220–260 | 243 |
| `--ready-level 10` | 370–420 | 445 (accepted over) |
| deaths, one party | ≤ 2.0 | 1.0 |
| days, one party | 243–297 | 287 |

6. **The loop**: one lever at a time; run the cells it touches; once they sit in band, the campaigns. Log every run in the record (the lever, its value, the figures, kept or reverted). **The levers, in order:**
   1. **Plan order** (which nodes the simulated heroes and bandits save for; `AUTO_PLANS`). A reorder must keep or deliberately update the node-level tests of step 28.
   2. **Foes back toward step 24's starting point**: `banditGear` (Fine at threats 3 and 4 back to plain), then `FOE_HP_PER_LEVEL` (1.3 down toward 1.0, judged by F3 and SP5), then the Spider Nest's count (4 back to 3 at threat 5).
   3. **Tier levels** (`TIERS` levels and depths), only if the first two cannot reach the bands.

   **Costs and the point rate are not levers** (decision 16): if only they, creation points, or a T2 cost of 1 below level 6 could close the gap, stop and report it as a decision (design §8.3).
7. **Stop** when the cells, parity at level 4 and the campaigns are in band, or the user accepts a figure. The engineer does not ask the user: stop and report the figure, what was tried and a recommendation; the orchestrator asks and replies.

### Decisions (index and feature record)

- **14.** The level-14 capstone cell is reported against a ±50 target, not a gate; record every gap with its diagnosis (step 24's method: per-hero damage, falls and uses from the logs).
- **15.** Re-record the refactor guard (and the policy snapshot if it moved) last, with the final play, in its own commit.
- **16.** Costs and the rate are not levers.
- Feature record: parity at levels 8 and 12 accepted as limited by the three-hero party and the AI (level 4 is the test); `rogue_archer` stays a reported figure; `--ready-level 10` over its band was accepted at 445 (revisit in stage 9), so a figure inside 370–420 is welcome and one above 445 is a regression to report.
- **The foe yardstick:** `fighterGrowth` (`src/combat/combat.ts`) is a frozen yardstick. If its test (or `encounters.test.ts`'s stat-block test) fails only because the ready-made fighter now grows differently, re-measure the table from the new fighter and say so in the commit; never retune a monster to fit it.

### Contracts (copied unchanged from the index)

**C18. `autoAdvance` and the plans** (this step may move the plan orders, lever 1)

```ts
// src/character/progression.ts
export function autoAdvance(character: Character, plan: PlanId = planFor(character)): void
  // skill points as today; then repeat:
  //  1. target = the first node of the plan, not held, that the hero qualifies for, or would qualify for
  //     if only its level were higher (lacking nothing but the level; no attribute cap);
  //     with none, the first non-capstone node in PERKS order it qualifies for now; with none, stop
  //  2. if the target is short of the level or of points: stop (save; never fall through to a cheaper node)
  //  3. else take it and repeat
```

A node short of a depth, a skill, an attribute or a node it `requires` is skipped, as today. Plans reordered (in full; bold marks what moved):

- `knight`: weapon_training, toughness, rooted, taunt, pin, heavy_hand, iron_skin, **unbreakable, guardian**, shield_wall, power_attack, armor_breaker, weapon_mastery
- `ranger`: marksmanship, deadly_aim, aimed_shot, **volley, far_shot, deadeye**, hunters_mark, pinning_shot, dodger, sprint, skirmisher, tumble, evasion
- `evoker_healer`: magic_arrow, heal, destruction, flame_arrow, **fireball, heal_all, pyromancy, meteor, greater_heal, mending**, death_cloud, greater_heal_all, purify
- `swordmaster`, `rogue`, `cryomancer`, `bandit_mage` and the capstone-first path plans: unchanged

Node levels the tests fix (design §4.4):

| Hero or role | Levels |
| --- | --- |
| Aldric (`knight`) | Rooted 3, Taunt 5, Pin 8, Iron Skin 11, Unbreakable 15 |
| Brenna (`ranger`) | Aimed Shot 3, Volley 6, Far Shot 8, Deadeye 12 |
| Delwyn (`evoker_healer`) | Flame Arrow 3, Fireball 6, Heal All 8, Pyromancy 10, Meteor 14 |
| Captain | Rooted 3, Taunt 5, Pin 8 |
| Brute | Power Attack 3, Armour Breaker 5, Cleave 8 |
| Archer, Crossbowman | Aimed Shot 3, Volley 6 |
| Hedge-Mage | Flame Arrow 3, Destruction 4, Fireball 7 |

**C17 (fixed; not levers):** `TIERS` costs 1/2/3/4, `CREATION_PERK_POINTS` 3, `PERK_POINTS_PER_LEVEL` 1.

## 3. Dependencies

- **Step 27:** the baseline column of the index's Stage 5 Measurement table and the parity tables at 4, 8 and 14 in its record.
- **Step 28:** the economy, plans and save v26; its record lists which parity plans' heroes hold their capstone at 14.
- **Step 29:** the UI; no play change.
- Existing: `scripts/simulate.ts` (`--plans`, `--party-level`, `raisedParty`), `banditGear` (`src/game/bandits.ts`), `FOE_HP_PER_LEVEL` (`src/combat/`), `ENCOUNTER_COUNTS` (`src/game/encounters.ts`), steps 24 and 25's records (the method, the diagnosis scripts, the levers' past effects).

## 4. Scope and guidance

- **The capstone test** (design §7.2 step 5: "A unit test confirms it with `raisedParty`"): in `scripts/simulate.test.ts`, each parity plan's hero, raised to level 14 by `raisedParty` with that `--plans` entry, holds its path's capstone. A plan whose hero cannot hold it by its asks (for example archery `assassin`, Keen Eye asks Luck 6; see the feature record) is listed in the test as an explicit exception with the reason, and reported. Move plan order (lever 1) where a reachable capstone is missed.
- Read step 24's and 25's records before tuning: they list what each lever did and why parity gaps at 8 and 12 sit where they do.
- Lever 2 reverses step 24's changes one at a time; each is a constant or a table entry with tests that name it (update those tests and `CLAUDE.md`'s figures that state them).
- Do not change node numbers, costs, the rate or creation points.

### Docs

- Index: the "30 first (untuned)" and "30 final" columns; step status.
- Feature record (`docs/features/skill-trees.md`), Verification: a new "Amendment (steps 27 to 30)" table like stage 4's (figure, band, step 25 final, step 27 baseline, final, in or out), the parity tables at 4, 8 and 14, and a short "how it got there". Do not edit the decision log (the orchestrator's).
- `CLAUDE.md`: any constant or rule this step moves (`banditGear`, `FOE_HP_PER_LEVEL`, counts, plan orders and the bandit node levels) stated correctly; the full restatement of the scaling figures is step 31's.

### Shared constraints (from the index)

- **Environment.** Prefix every npm or node command with `PATH=$HOME/.nvm/versions/node/v26.13.0/bin:$PATH`.
- **The simulator.** A 500-campaign run takes about five minutes (`--ready-level 10` some 20) and writes some 70 MB. **One run at a time, never two at once**, each with its own `--out` under `logs/` and a `.txt` summary beside it; a suffix per attempt so no run overwrites one the log cites.
- **Determinism.** A lever changes numbers, never the order of draws.
- **Commits.** One commit per kept lever (with its figures in the message) or one at the end, on `skill-trees`, no push, no attribution lines, "Skill trees step 30: …"; the guard re-recorded last in its own commit. `npm test` before each.

## 5. Verification

- The first measurement and every kept lever's figures in the record's log table.
- Final: every cell in band (TL5 reported), level-4 parity within ±50 (`rogue_archer` reported), the three campaigns, deaths and days in band; or the figures outside them named with what was tried and a recommendation for the user.
- Level 8 and level 14 parity tables reported, with the capstone each hero holds at 14.
- `npm test` green with the guard re-recorded; `npm run build` passes.

## 6. Completion criteria

- [ ] Index Stage 5 Measurement columns "30 first" and "30 final" filled.
- [ ] Bands met, or the user has accepted each figure outside (via the orchestrator); the record says which.
- [ ] Capstone-at-14 test in `scripts/simulate.test.ts`, exceptions named.
- [ ] Guard re-recorded with the final play.
- [ ] Feature record's Amendment table and parity tables.
- [ ] Index step 30 status `done (<commits>)`.

## Execution record

**Step 30, 2026-11-15.** From `5010c11` (green). Node 26.13.0, seed 1, 500 each, one run at a time; summaries in `logs/30-<tag>-<name>.txt` (the `.jsonl` deleted after each run). The first measurement ran on a detached worktree of `5010c11`; every later run on the working tree.

### Run log

| # | Lever | Value (from → to) | Figures | Kept or reverted |
| --- | --- | --- | --- | --- |
| 0 | First measurement (`first`) | steps 28–29's code | GR3 500, BC3 455, **BC4 364**, BC5 486, SN5 410, SP5 466, TL5 0, SG7 0, **SG10 0**, F 500/500/453; **one party 172**, **company 177**, `--ready-level 10` 422; one party **302 days**, 1.1 dead | — |
| 1 | Plan order: knight Shield Wall and Unbreakable ahead of Iron Skin; swordmaster Blademaster ahead of Weapon Mastery | Unbreakable 15 → 13, Blademaster 15 → 12 | every parity plan holds its capstone at 14 but the two assassins (16, by their asks; tested) | kept |
| 2 | `banditGear` at threat 4 (`g4`) | Fine → plain iron | BC4 364 → 422; L4 magic: evoker 422, healer 476 | kept |
| 3 | `bandit_mage` Fireball ahead of Destruction (`m4`) | — | BC4 422 (Fireball waits on depth, so Destruction is still taken at 4) | reverted |
| 4 | knight Shield Wall at 4 (`sw4`) | Taunt 5 → 6, Pin 8 → 9 | BC4 424 (the Captain takes it too) | reverted |
| 5 | evoker_healer Mending at 4, Fireball 7, Meteor 13 (`md4`, `a`) | — | BC4 466 (Fine gear at 4: 423, so both levers are needed); one party 231 but **347 days**, camping 65.5 days a campaign (`autoHeal` casts no heal that would heal past a wound, and Mending's +4 makes more wounds too small to heal) | replaced |
| 6 | evoker_healer Mending 4, Heal All 6, Fireball 9 (`b`) | — | one party 211, 335 days (camping 54.5) | replaced |
| 7 | Delwyn's level-4 node, BC4 only (`x-*`) | Dodger / Arcane Study / Serenity / Arcane Blood | 427 / 448 / 473 / 454 | — |
| 8 | evoker_healer Serenity 4, Fireball 7, Meteor 13 (`s3`) | — | one party **342**, 314 days | replaced (far over) |
| 9 | evoker_healer Arcane Blood 4, Heal All 6, Fireball 9, Meteor 15 (`ab6`) | — | one party 180, **291 days** (camping 26.6) | kept |
| 10 | the same with Fireball 7, Heal All 9 (`ab7`) | — | one party 191, 310 days | reverted |
| 11 | `FOE_HP_PER_LEVEL` (`h10`) | 1.3 → 1.0 | SN5 453, SP5 484, F3 479, SG7 0, SG10 3; one party 278, 288 days | superseded |
| 12 | `FOE_HP_PER_LEVEL` (`h115`) | 1.3 → 1.15 | one party **234**, 286 days, 1.1 dead | kept (`def1bf3`) |

Not tried: the Spider Nest's count (SN5 sits in band at 451) and tier levels (the first two levers reached the campaign bands).

### Final (`def1bf3`; cells and level 4 `logs/30-final-*`, levels 8 and 14 and the company and `--ready-level 10` `logs/30-final2-*`, one party `logs/30-h115-one.txt`)

| Figure | Band | 27 baseline | 30 first | 30 final | |
| --- | --- | --- | --- | --- | --- |
| one party | 215–250 | 243 | 172 | 234 (286 days, 19.4 battles, 1.1 dead) | in |
| company | 220–260 | 243 | 177 | 236 (286 days, 1.1 dead) | in |
| `--ready-level 10` | 370–420 | 445 (accepted over) | 422 | 434 (509 days, 1.0 dead) | over, below the accepted 445 |
| deaths (one party) | ≤ 2.0 | 1.0 | 1.1 | 1.1 | in |
| days (one party) | 243–297 | 287 | 302 | 286 | in |
| GR3 / BC3 / BC4 / BC5 | ≥ 470 / 400–470 / 430–490 / 420–490 | 500 / 455 / 462 / 484 | 500 / 455 / 364 / 486 | 500 / 455 / 454 / 494 | in |
| SN5 / SP5 / TL5 | 410–480 / 410–480 / report | 448 / 454 / 0 | 410 / 466 / 0 | 451 / 475 / 0 | in |
| SG7 / SG10 | 0 ± 40 / above 2 | 0 / 5 | 0 / 0 | 0 / **1** | SG10 out |
| F1 / F2 / F3 | nearly all / most / 7 in 10 | 500 / 500 / 453 | 500 / 500 / 453 | 500 / 500 / 463 | in |

### Path parity, first measurement (`5010c11`; gap to the role's best; **bold** outside the level-4 gate)

| Role | Plan | L4 | gap | L8 | gap | L14 | gap |
| --- | --- | --- | --- | --- | --- | --- | --- |
| melee | knight | 364 | 0 | 120 | -108 | 497 | 0 |
| melee | swordmaster | 322 | -42 | 65 | -163 | 493 | -4 |
| melee | spellsword | 333 | -31 | 20 | -208 | 497 | 0 |
| melee | assassin | 347 | -17 | 45 | -183 | 495 | -2 |
| melee | paladin | 362 | -2 | 228 | 0 | 472 | -25 |
| archery | ranger | 364 | -27 | 120 | -35 | 497 | 0 |
| archery | rogue_archer | 343 | -48 (reported) | 95 | -60 | 474 | -23 |
| archery | assassin | 391 | 0 | 155 | 0 | 485 | -12 |
| magic | evoker | 364 | **-93** | 215 | -278 | 497 | 0 |
| magic | cryomancer | 409 | -48 | 61 | -432 | 384 | -113 |
| magic | arcanist | 398 | **-59** | 44 | -449 | 58 | -439 |
| magic | healer | 457 | 0 | 37 | -456 | 475 | -22 |
| magic | saint | 455 | -2 | 493 | 0 | 376 | -121 |
| magic | evoker_healer (reference) | 364 |  | 120 |  | 497 |  |

(At this code the knight and swordmaster heroes held no capstone at 14; their L14 figures are without one.)

### Path parity, final (the capstone each hero holds at 14, and the level it came at)

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

- **Level 4 (the gate):** every plan within ±50 of its role's best but the **evoker, −54** (422 to the healer's 476). At level 4 the evoker path has nothing to buy with Delwyn's fourth point: both its tier 1s are held from creation and its tier 2s cost 2, so the plan saves for Pyromancy (5) and fights with Flame Arrow alone, where the healer has Mending and Greater Heal. Lever 2 moved it from −93 to −54. `rogue_archer` is −13 (reported).
- **Level 8:** reported (accepted as the AI's and the party's). The default party wins 181 (step 27: 465), the Warband's five foes at threat 5 meeting heroes a node short of before.
- **Level 14 (capstone, ±50 target, reported):** every melee plan within 24. Outside: `rogue_archer` −75, cryomancer −59, saint −84, arcanist −444. Diagnosis (150 battles each, `scratchpad/hero.ts`, damage a battle): as an Evoker, Delwyn deals 167 of the party's 232 and the bandits all fall; as an Arcanist he deals 6 (Haste 1.1, Mass Haste 0.9, Magic Arrow 1.2 a battle), the party 145, and he falls in 99% of battles; as a Saint 14 (Curse 3.5, Bane 1.8, Protect 2.3, Heal 16 a battle) and falls in 57%; with `rogue_archer`, Brenna deals 65 to the ranger's ~140 (no offensive node; Sprint 0.05 a battle). The same pattern as step 24's: the mage carries the party's damage and the Rogue path has no offence for an archer. The two assassins hold no capstone at 14 (Deathblow at 16, by their asks: tested as exceptions) and still win 473 and 461.
- Aldric used Pin 0.00 times a battle in every level-14 cell (Taunt 1.1 to 2.6): noted, not in this step's scope.

### Tests

- `scripts/simulate.test.ts`: each parity plan's hero raised to 14 by `raisedParty` holds its capstone; the exceptions (both assassins at 16, Keen Eye and Fortune asking Luck 6 and 7 and the path's other five nodes 11 points; `evoker_healer` at 15) are tested at the level they come and not before. Before the plan reorders the knight and swordmaster cases fail (15).
- `progression.test.ts`: Aldric Rooted 3, Taunt 5, Pin 8, Shield Wall 9, Unbreakable 13, Iron Skin 16; Delwyn Flame Arrow 3, Arcane Blood 4, Heal All 6, Fireball 9, Pyromancy 11, Meteor 15; the saving test is now Delwyn keeping 2 points at 8 for Fireball rather than Mending; plans in full. Brenna and the bandits' node levels unchanged.
- `bandits.test.ts` (`banditGear` plain at 4), `encounters.test.ts` (the Hedge-Mage at 4 in plain gear), `combat.test.ts` (`foeAtLevel` at 1.15: a goblin 26 at level 2, 67 at 5). `encounters.test.ts`'s yardstick test held without change.
- Policy snapshot re-recorded (5648 → 5439 choices, `def1bf3`); the refactor guard re-recorded last (`ceed2f8`: source, source, source, source, fallen).
- `npm test`: 2061 passed. `npm run build`: passes (the usual chunk-size warning).

### Decisions needed

1. **SG10 at 1** (band "above 2"; step 01 2, step 27 5). The Source at level 10, three heroes against four foes, is a near-zero cell either way; `FOE_HP_PER_LEVEL` 1.0 gave 3 but the one-party campaign 278, over its band, and the Horror's 63 hit points are the user's. Recommend: accept.
2. **Level-4 parity: the evoker at −54**, 4 past the gate. The one lever left that reaches it is a plan change: give the evoker plan an off-path tier 1 at level 4 (Arcane Blood, as Delwyn's default now takes; Meteor would still come by 13), which makes that parity plan no longer its path alone. Recommend: accept the figure (the path has nothing to buy at level 4, and the next gear or hit point move would push the one-party campaign out of band); else take the plan change.
3. **Delwyn's default plan changed** (Arcane Blood 4, Heal All 6, Fireball 9, Meteor 15, from Fireball 6, Heal All 8, Meteor 14), so NC5's "Delwyn Meteor at 14" no longer holds and Aldric's Unbreakable is at 13, not 15. Both are lever 1's deliberate updates; the design's §4.4 table and the manual follow in step 31.

### For step 31

- CLAUDE.md now states `banditGear` (plain at threat 4), `FOE_HP_PER_LEVEL` 115% and the ready-made heroes' node levels; the bandits' node levels in CLAUDE.md's bandits line ("Rooted at 2, Taunt at 4 and Pin at 6" and the like) predate step 28 and are step 31's to restate.
- Serenity at level 4 alone took the one-party campaign from 180 to 342 (row 8): the Saint's tier 1 stands out if a later stage looks for outliers.
- `autoHeal` casts no heal larger than a wound, so a hero with a big heal bonus (Mending) leaves small wounds to camping: 65 days of camping a campaign against 26 (row 5). Not changed here (it is the game's rule for Camp until healed too).

### The user's decisions (2026-11-15, via the orchestrator)

- SG10 at 1 accepted ("Accept (Rec.)"); the Horror stays at 63 hit points.
- The evoker's level-4 parity at −54 accepted ("Accept (Rec.)"), recorded as a cost of the path's shape at level 4.
- The orchestrator accepted the node-level departures (Aldric's Unbreakable at 13, Delwyn's Meteor at 15) as deliberate plan-order changes. **Step 31** restates them in the design's §4.4 table, the manual and CLAUDE.md, and restates CLAUDE.md's stale bandit node levels (the bandits line still gives the pre-step-28 levels).

Every figure is now in band or accepted; step 30 is done.
