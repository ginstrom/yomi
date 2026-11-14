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
