# Step 24: Path parity and the cells

[Plan index](index.md) · [Design](../../designs/skill-trees.md) (R14, AC11; §7.2 balance method, §8.3 risks) · [Feature record](../../features/skill-trees.md)

**Difficulty:** opus. Leave the engineer's and the reviewer's model unset. This step judges balance: it chooses which lever to move, by how much, and whether a path's weakness is in its numbers or in how the policy plays it.

## 1. Objective

Stage 4 begins. Every path is made a real choice and every battle cell sits in its band:

- **Path parity:** for each role, every plan wins within ±50 of 500 (±10%) of that role's best plan at Bandit Camp threat 4, at party levels 4 and 8; capstones are checked the same way at level 12 against Spider Nest threat 5.
- **Cells:** the battle cells of the measurement procedure in their target bands.

Campaigns are run here only to confirm nothing collapsed. Tuning the campaign figures to their bands is step 25.

## 2. Requirements and context

- **R14:** balance is judged and retuned with the simulator, by the cells and campaign bands of design §7.2.
- **AC11 (R14), this step's share:** the cells land in their bands, or the user has accepted the figure.

### Design §7.2, restated

**1. Cells.** A party of the threat's own level (`--encounter --threat --party-level`), 500 battles from seed 1. Bands and commands are in the measurement procedure below. Fresh-party cells (level 1 at threats 1 to 3) must stay "nearly all, most and 7 in 10", as step 01 measured.

**2. Path parity.** The point is that every path is a real choice. For each role, run Bandit Camp threat 4 at levels 4 and 8 with each path's plan in that role's slot through `--plans`:

- melee: `swordmaster`, `knight`, `spellsword`, `assassin`, `paladin`
- archery: `ranger`, `rogue_archer`, `assassin`
- magic: `evoker`, `cryomancer`, `arcanist`, `healer`, `saint`

Target: every plan within ±10% (±50 of 500) of its role's best. A plan below that has its numbers raised; one above has them lowered. Capstones are checked the same way at level 12 against Spider Nest threat 5 (`spider_nest`, threat 5, `--party-level 12`), each plan of a role against that role's best.

Example (one parity run):

```sh
npm run simulate -- --battles 500 --seed 1 --encounter bandit_camp --threat 4 --party-level 8 \
  --plans melee=paladin --out logs/24-par-melee-paladin-8.jsonl > logs/24-par-melee-paladin-8.txt
```

Only the role under test is overridden; the other heroes keep `planFor`'s plan, so each role's plans are compared on the same party around them.

**4. The loop.**

1. Change one lever.
2. Run the cells it touches (seconds to minutes).
3. Once the cells sit in band, run the campaigns (here: only to check nothing collapsed; step 25 tunes them).
4. Log each run in the execution record: the lever, its value, the figures, and kept or reverted.

**The levers, in this order:**

1. Node numbers: technique bonuses, aura sizes, passive sizes, mana costs, recharges.
2. Tier levels and depths (`TIERS`).
3. `MANA_PER_TREE_NODE`.
4. Node sizes by kind: casters' passives first, if casters lag behind fighters in parity. **The pick rate (one pick at every even level, the user's decision Q1) is not a lever: do not change `PICK_LEVEL_STEP` or `CREATION_PERK_PICKS` without asking the user** (stop and report it as a decision with your recommendation).
5. Bandit plans and counts.
6. Foe counts and `FOE_HP_PER_LEVEL`, as `CLAUDE.md` advises, only if the first five cannot reach the band. **Do not move these in this step**: report the cells that only they could reach (decision below).

**Stop** when every cell is in band and parity holds, or after the user accepts a figure outside it.

### Design §8.3 risks, restated

- **The AI under-uses actives** (Taunt timing, Pin targets), so the simulator's heroes look weaker than the player's. The parity cells expose this. **A policy fix is preferred to inflating numbers**: before raising a path's numbers, read its battles' logs (techniques used, taunts, pins, mana spent; the summary lines of steps 15 and 23) and check the policy uses its actives sensibly. A policy fix is a change to `src/engine/policies.ts` with a staged-state test in `policies.test.ts`, and must leave monsters' choices unchanged (the existing policy tests).
- **Bandits with Taunt and Backstab may spike the threat 3 to 5 cells.** Their plans (lever 5) come before foe counts.

### Decisions from the index (unchanged)


2. **The refactor guard.** `scripts/simulate.test.ts`'s fixture moves whenever play moves. A step that changes what the simulator plays (data, plans, the economy, a spell's or node's numbers, the order of `ALL_SPELL_IDS`) re-records the fixture in its own commit and says why in the commit message. A step that only adds engine rules, statuses or policy branches that no simulated unit can yet reach **must keep the fixture green unchanged**; a mismatch there is a bug. Steps that must keep it green: 05, 06, 07, 09, 10, 11, 12, 14, 15, 17, 18, 19, 20, 22. Each stage's measurement step re-records it last.

6. **Measurement between stages** records figures and does not tune. Tuning is stage 4's: this step and step 25.

Step-specific decisions:

- Campaign runs here only confirm no collapse (one party not under 150 of 500 after a kept change); their bands are step 25's.
- A cell that only foe counts or `FOE_HP_PER_LEVEL` could bring into band is reported, with the levers tried, not tuned here.

### Contracts (copied unchanged from the index)

**C5. Plans:**


```ts
// src/character/progression.ts
export const PLAN_IDS = ['knight', 'swordmaster', 'spellsword', 'ranger', 'rogue', 'rogue_archer', 'assassin',
  'evoker', 'evoker_healer', 'cryomancer', 'arcanist', 'healer', 'paladin', 'saint', 'bandit_mage'] as const
export type PlanId = (typeof PLAN_IDS)[number]
export const AUTO_PLANS: Record<PlanId, readonly PerkId[]>
export function planFor(character: Character): PlanId   // tagged melee → knight, archery → ranger, magic → evoker_healer
export function autoAdvance(character: Character, plan: PlanId = planFor(character)): void
  // skill points as today; then, while a pick is left: the first node of the plan it qualifies for,
  // else the first qualifying non-capstone node in PERKS order; stops when none qualifies
```

The full lists, in order (a stage writes only the ids present in `PERKS`, keeping this order):

- `knight`: weapon_training, toughness, rooted, taunt, pin, heavy_hand, iron_skin, guardian, unbreakable, shield_wall, power_attack, armor_breaker, weapon_mastery
- `swordmaster`: weapon_training, heavy_hand, power_attack, armor_breaker, cleave, gain_strength, weapon_mastery, blademaster, toughness
- `ranger`: marksmanship, deadly_aim, aimed_shot, far_shot, volley, hunters_mark, pinning_shot, deadeye, dodger, sprint, skirmisher, tumble, evasion
- `rogue` (the Cutthroat's): backstab, dirty_trick, sprint, tumble, evasion, counter, skirmisher, shadowdancer
- `evoker_healer`: magic_arrow, heal, destruction, flame_arrow, heal_all, fireball, pyromancy, mending, meteor, greater_heal, death_cloud, greater_heal_all, purify
- `bandit_mage`: flame_arrow, destruction, fireball, heal, heal_all
- `spellsword`, `assassin`, `evoker`, `cryomancer`, `arcanist`, `healer`, `paladin`, `saint`: their path's nodes in `PERKS` order
- `rogue_archer`: the rogue path's nodes in `PERKS` order (the melee-only ones are skipped by their asks)

Pre-rolls and bandits (design §5.8): Aldric weapon_training, heavy_hand, toughness (`knight`); Brenna marksmanship, deadly_aim, dodger (`ranger`); Delwyn magic_arrow, heal, arcane_study (`evoker_healer`); Garrick weapon_training, marksmanship, dodger (`knight`). Archer and Crossbowman marksmanship, deadly_aim, dodger (`ranger`); Cutthroat weapon_training, dodger, toughness (`rogue`); Brute weapon_training, heavy_hand, toughness (`swordmaster`); Hedge-Mage magic_arrow, shield, arcane_study (`bandit_mage`); Captain weapon_training, toughness, dodger (`knight`). The remaining pre-rolls are rebuilt on T1 nodes of their role, held legal by the existing test.


**C15. The simulator:**


```ts
// scripts/simulate.ts
// CliArgs gains plans: Partial<Record<SkillId, PlanId>>  (--plans melee=swordmaster,archery=ranger,magic=cryomancer;
//   unknown role or plan refused; the player's side only; replaces planFor for a hero tagged in that skill;
//   applies to single-battle cells (--encounter --threat --party-level) and to campaigns alike)
// The summary gains per side: techniques used by ability id, taunts laid, pins laid, mana spent on techniques (step 15);
//   counters, deathblows, revives, Unbreakable saves (step 23)
// CampaignRecord gains callings: Partial<Record<PathId, number>> and capstones: Partial<Record<PerkId, number>>
//   (the vanguard's heroes at the end) and the summary the share of campaigns whose vanguard holds a capstone (step 23)
```


### Measurement procedure (copied unchanged from the index)


All from seed 1, 500 battles or campaigns, one run at a time. Put each run's output under `logs/<step>-<name>.jsonl` and its summary in a `.txt` beside it.

```sh
P="PATH=$HOME/.nvm/versions/node/v26.13.0/bin:$PATH"
# campaigns
npm run simulate -- --campaign --battles 500 --seed 1 --parties 1 --out logs/NN-one.jsonl > logs/NN-one.txt
npm run simulate -- --campaign --battles 500 --seed 1 --out logs/NN-company.jsonl > logs/NN-company.txt
npm run simulate -- --campaign --battles 500 --seed 1 --ready-level 10 --out logs/NN-rl10.jsonl > logs/NN-rl10.txt
# cells: --encounter E --threat T --party-level L
npm run simulate -- --battles 500 --seed 1 --encounter bandit_camp --threat 3 --party-level 3 --out logs/NN-bc3.jsonl > logs/NN-bc3.txt
```

| Cell | Encounter, threat, level | Target band (design §7.2) |
| --- | --- | --- |
| GR3 | `goblin_raid` 3, level 3 | ≥ 470 |
| BC3 | `bandit_camp` 3, level 3 | 400–470 |
| BC4 | `bandit_camp` 4, level 4 | 430–490 |
| BC5 | `bandit_camp` 5, level 5 | 420–490 |
| SN5 | `spider_nest` 5, level 5 | 410–480 |
| SP5 | `salamander_pool` 5, level 5 | 410–480 |
| TL5 | `troll_lair` 5, level 5 | report only |
| SG7 | `source_guardians` 5, level 7 | within ±40 of step 01 |
| SG10 | `source_guardians` 5, level 10 | above step 01's |
| F1, F2, F3 | `goblin_raid` 1, 2, 3, level 1 | "nearly all, most, 7 in 10" (step 01's figures) |

| Campaign | Band (feature record) |
| --- | --- |
| `--parties 1` | 215–250 of 500 |
| default company | 220–260 |
| `--ready-level 10` | 370–420 |
| heroes dead a campaign (one party) | ≤ 2.0 |
| days a campaign (one party) | step 01's ±10% |

Each measurement step writes its figures into the **Measurements** table below and its own execution record.

### Shared constraints (from the index)

- **Environment.** The system Node is 22; Node 26 is at `~/.nvm/versions/node/v26.13.0/bin`. Prefix every npm or node command with `PATH=$HOME/.nvm/versions/node/v26.13.0/bin:$PATH`. Podman is also available for the `Makefile` targets (`make test`, `make simulate ARGS="..."`, `make test-browser`).
- **The simulator.** A 500-campaign run takes about five minutes (`--ready-level 10` longer) and writes some 70 MB. **Run one at a time, never two at once**, each with its own `--out` under `logs/` (gitignored).
- **Determinism.** A battle replays from its seed. New rolls draw from the RNG in the order design §5.4 fixes; a passive that rolls nothing draws nothing.
- **Domain first.** Every rule lives in the Phaser-free modules with tests; a node is data.
- **`tsc` is the linter** (`noUnusedLocals`, `noUnusedParameters`, `erasableSyntaxOnly`, `verbatimModuleSyntax`, `.ts` extensions).
- **Commits.** One commit per kept lever (or a few related ones) once `npm test` passes, on `skill-trees`, without pushing. Never switch branches. Messages "Skill trees step 24: <lever and value>". No attribution lines.
- **Docs.** `CLAUDE.md` stays current: every number it states that a kept change moves (a node's effect, a cell's figure, a bandit plan) is fixed in the same commit. The full restatement of the rules of scaling is step 26's.

## 3. Dependencies and prerequisites

- **Steps 01–23 done.** All 95 nodes are in `PERKS` (C3); `AUTO_PLANS` holds the fifteen plans in full (C5); `--plans` works (step 15); the summary reports techniques, taunts, pins, mana on techniques (step 15), counters, deathblows, revives, Unbreakable saves, callings and capstones (step 23).
- **Reference figures:** step 01's baseline and step 23's stage-3 figures in the index's Measurements table.
- **Files that hold the levers (existing by then):** `src/character/perks.ts` (`PERKS`), `src/character/trees.ts` (`TIERS`, `MANA_PER_TREE_NODE`), `src/combat/abilities.ts` (`ABILITIES`), `src/combat/spells.ts` (`SPELLS`, `STATUSES`), `src/engine/battleEngine.ts` (`TAUNT_PENALTY`), `src/engine/policies.ts` (`STATUS_VALUE`, `MANA_WEIGHT`, the steps), `src/character/progression.ts` (`AUTO_PLANS`), `src/game/bandits.ts` (bandit drafts and plans), `src/game/encounters.ts` (counts; not moved here).

## 4. Scope and implementation guidance

### 4.1 Measure where it stands

1. Run the cells (GR3, BC3–5, SN5, SP5, TL5, SG7, SG10, F1–F3).
2. Run the parity grid: Bandit Camp threat 4 at levels 4 and 8, every plan of every role (13 plans × 2 levels = 26 runs), then Spider Nest threat 5 at level 12 for the same plans (13 runs). Each battle cell run takes seconds to a minute.
3. Tabulate: for each role and level, the best plan and every plan's distance from it.

### 4.2 Diagnose before tuning

For a plan out of band, read its summary's technique and status lines and a few battles' events. Ask first whether the policy uses its actives (a Paladin that never Smites, a Knight that Taunts with no ally in danger, a Cryomancer whose Ice Lance never meets its bonus). Fix the policy if so (§8.3), with a test; otherwise move its numbers.

### 4.3 Tune by the loop

One lever at a time, in the levers' order. Re-run only the cells and parity rows it touches, then the full cell set before keeping it. Each kept change:

- updates the data (and node descriptions, which state the numbers);
- updates or adds the tests that pin the changed numbers (`perks.test.ts`, `abilities.test.ts`, `spells.test.ts`, `policies.test.ts` as fits);
- re-records the refactor guard fixture in `scripts/simulate.test.ts` (play changes, decision 2), saying why in the commit;
- fixes the numbers `CLAUDE.md` and the manual's text state for it;
- passes `npm test`;
- is checked by one `--campaign --parties 1` run for collapse (under 150 of 500: revert or report).

Reverted levers stay in the run log.

### 4.4 Exclusions

- Campaign band tuning (step 25). Foe counts and `FOE_HP_PER_LEVEL` (report instead). The pick rate (ask the user). Manual screenshots and the restated rules of scaling (step 26). Monster stat blocks by hand (design non-goal).

## 5. Verification

### Tests (in `npm test`)

- Every changed number pinned by an existing or new test; every policy fix by a staged-state test in `policies.test.ts`, with the monsters' choices unchanged.
- The refactor guard green with its re-recorded fixture.

### Commands

```sh
export PATH=$HOME/.nvm/versions/node/v26.13.0/bin:$PATH
npm test
npm run simulate -- --battles 500 --seed 1 --encounter bandit_camp --threat 4 --party-level 4 --plans magic=saint --out logs/24-par-magic-saint-4.jsonl > logs/24-par-magic-saint-4.txt
npm run simulate -- --campaign --battles 500 --seed 1 --parties 1 --out logs/24-one.jsonl > logs/24-one.txt
```

### Acceptance

- Every cell in its band (TL5 report only), or the cells that cannot be reached without foe counts listed with the levers tried.
- Every plan within ±50 of its role's best at Bandit Camp threat 4, levels 4 and 8, and at Spider Nest threat 5, level 12; or the gaps listed with what was tried.
- No kept change took the one-party campaign under 150 of 500.

## 6. Completion criteria

- [x] The parity grid and the cells recorded before and after, in the execution record.
- [x] The run log complete: every lever tried, its value, its figures, kept or reverted.
- [x] Each kept change committed with its tests, the guard re-recorded and `CLAUDE.md` numbers fixed; `npm test` passes.
- [x] Cells in band and parity holding, or the remaining gaps reported with a recommendation (and any pick-rate or foe-count question raised as a decision for the user).
- [x] The index's step table shows step 24 `done (<commits>)`; the Measurements table's cell rows are left for step 25's final column (record this step's in the execution record).

## 7. Execution record

### Run log

| # | Lever | Value (from → to) | Cells / parity figures | One-party campaign | Kept or reverted |
| --- | --- | --- | --- | --- | --- |

| 0 | Baseline (step 23's code, re-measured) | — | GR3 500, BC3 494, BC4 495, BC5 488, SN5 500, SP5 495, TL5 8, SG7 0, SG10 386, F1/F2/F3 500/500/493; parity BC4 L4 and BC7 L12 below | 449 (step 23) | — |
| 1 | Parity plans name the capstone first (`pathPlan`); Delwyn's creation picks build B (Destruction for Arcane Study); Arcane Blood asks INT 3 | INT 4 → 3 | every plan's hero holds its capstone at 12 (was: knight, swordmaster, ranger, rogue_archer, assassin only); BC7 L12 spellsword 464 → 490, paladin 231 → 273, knight 436 → 472, evoker 400 → 448, cryomancer 292 → 31 (Glacial Prison takes Ice Lance's pick) | — | kept (9016146) |
| 2 | Policy: Haste on the first ally not hasted, Protect on a pressed ally, Bane not recast on baned foes | none → cast | BC7 L12 arcanist 18 → 36, saint 30 → 79 (with 1); cells: BC3 495, BC4 490, BC5 484, SP5 493, SG10 424, F3 495 | — | kept (9016146) |
| 3 | `FOE_HP_PER_LEVEL` | 0.7 → 1.0 | GR3 500, SN5 500, SP5 479, F2 500, F3 479 | — | superseded by 5 |
| 4 | `FOE_HP_PER_LEVEL` | 0.7 → 1.5 | GR3 500, SN5 500, SP5 429, F2 500, F3 425 | — | reverted (F3, SP5 low end) |
| 5 | `FOE_HP_PER_LEVEL` | 0.7 → 1.3 | GR3 500, SN5 500, SP5 454, F2 500, F3 453; TL5 0, SG7 0, SG10 15 | 268 (with 7, 9) | kept (3af5c59) |
| 6 | Bandit Camp counts at threats 3 to 5 | 2, 2, 2 → 3, 3, 3 | BC3 322, BC4 253, BC5 269 | — | reverted (far below every band) |
| 7 | `banditGear`: Fine iron from threat 3, Fine steel from 5 | plain → Fine at 3, 4; Fine iron → Fine steel at 5 | BC3 455, BC4 462, BC5 372 | — | 3 and 4 kept; 5 reverted |
| 8 | `banditGear` at threat 5: Masterwork iron | Fine → Masterwork | BC5 404 | — | reverted (below 420); threat 5 stays Fine iron, 484 |
| 9 | Spider Nest count | 3 → 4: a Kobold Lurker | SN5 485 | — | replaced by 10 |
| 10 | Spider Nest count | 3 → 4: a third Giant Spider, the Nest Spider | SN5 448 | 268 (with 5, 7) | kept (3af5c59) |
| 11 | Level-8 parity cell (default plans) | BC4 → ? | BC4 L8 500, BC5 L8 500, SN5 L8 500, GR5 L8 500, SP5 L8 500, BC6 L8 74, BC7 L8 22, TL5 L8 39, Hobgoblin Warband 5 L8 465 | — | Hobgoblin Warband threat 5 chosen |
| 12 | Policy: no Sleep on a foe beside one of the caster's side | — | HW5 L8 cryomancer 160 → 231 (Sleep 9.6 → 2.6 a battle) | — | kept (53cdeb0) |
| 13 | Policy: `strikeCast` counts the caster's spell power by element | — | HW5 L8 cryomancer 231 → 306 (Frostbite 13.7 a battle where Magic Arrow was 13.9); BC7 L12 cryomancer 36 | guard unchanged | kept (53cdeb0) |

### Cells, before and after (seed 1, 500 battles, a party of the threat's level; `logs/24-base-*.txt`, `logs/24-final-*.txt`)

| Cell | Band | Before (step 23's code) | After | In band |
| --- | --- | --- | --- | --- |
| GR3 | ≥ 470 | 500 | 500 | yes |
| BC3 | 400–470 | 494 | 455 | yes |
| BC4 | 430–490 | 495 | 462 | yes |
| BC5 | 420–490 | 488 | 484 | yes (Masterwork iron gave 404, steel 372) |
| SN5 | 410–480 | 500 | 448 | yes |
| SP5 | 410–480 | 495 | 454 | yes |
| TL5 | report only | 8 | 0 | — |
| SG7 | step 01's 0 ± 40 | 0 | 0 | yes |
| SG10 | above step 01's 2 | 386 | 15 | yes, but a cliff: see below |
| F1 / F2 / F3 | nearly all / most / 7 in 10 (step 01: 500 / 499 / 441) | 500 / 500 / 493 | 500 / 500 / 453 | yes |

### Path parity, after (wins of 500; gap to the role's best; **bold** more than 50 below)

Level 4 is Bandit Camp threat 4 (the plan's cell). Level 8 is **Hobgoblin Warband threat 5**: Bandit Camp threat 4 at level 8 is won 500 of 500 by every plan, and so are BC5, SN5, SP5 and Goblin Raid 5 at level 8, while BC6 (four bandits in Fine steel) is a cliff at 74 and BC7 22 and Troll Lair 5 39; the Warband (an armoured Chief, a shaman, goblins and a sneak, 465 on the default plans) is the one cell at level 8 that is neither. Level 12 is Bandit Camp threat 7 (the user's capstone cell). `evoker_healer` (the default, not a parity plan) is shown for reference; the magic role's best is taken over the five parity plans.

| Role | Plan | L4 | gap | L8 | gap | L12 (capstone) | gap |
| --- | --- | --- | --- | --- | --- | --- | --- |
| melee | knight | 462 | −13 | 465 | 0 | 472 (Unbreakable) | −20 |
| melee | swordmaster | 444 | −31 | 240 | **−225** | 276 (Blademaster) | **−216** |
| melee | spellsword | 451 | −24 | 114 | **−351** | 490 (Arcane Knight) | −2 |
| melee | assassin | 443 | −32 | 200 | **−265** | 492 (Deathblow) | 0 |
| melee | paladin | 475 | 0 | 401 | **−64** | 273 (Aegis) | **−219** |
| archery | ranger | 462 | 0 | 465 | 0 | 472 (Deadeye) | 0 |
| archery | rogue_archer | 353 | **−109** | 444 | −21 | 380 (Shadowdancer) | **−92** |
| archery | assassin | 400 | **−62** | 465 | 0 | 434 (Deathblow) | −38 |
| magic | evoker | 475 | −14 | 465 | −35 | 448 (Meteor) | 0 |
| magic | cryomancer | 472 | −17 | 306 | **−194** | 324 (Glacial Prison, with Ice Lance; review fix) | **−124** |
| magic | arcanist | 475 | −14 | 295 | **−205** | 36 (Mass Haste) | **−412** |
| magic | healer | 487 | −2 | 248 | **−252** | 241 (Revive) | **−207** |
| magic | saint | 489 | 0 | 500 | 0 | 79 (Sanctuary) | **−369** |
| (magic) | evoker_healer | 462 | | 465 | | 472 (Meteor) | |

Before (step 23's code, logs `24-base-*`): level 4 knight 495, swordmaster 489, spellsword 490, assassin 490, paladin 494; ranger 495, rogue_archer 430, assassin 457; evoker 495, cryomancer 478, arcanist 482, healer 497, saint 494 (only rogue_archer outside, at −65). Level 12: knight 436, swordmaster 276, spellsword 464, assassin 469, paladin 231; ranger 436, rogue_archer 232, assassin 368; evoker 400, cryomancer 292, arcanist 18, healer 278, saint 30, with only five plans holding their capstone.

### Why the gaps are where they are (diagnosis from the logs; `scratchpad/hero.ts` counts each hero's damage, falls and uses)

- **Melee at levels 8 and 12: the policy's foes shoot the softest hero.** The `aggressive` policy strikes whoever it expects to hurt most. With a Knight, Taunt (3.1 a battle at level 8) draws the foes onto him and the mage lives (falls in 14% of Warband battles). A Swordmaster, Spellsword or Assassin has no Taunt: at level 8 the melee hero falls in 78–97% of battles and the mage in 59–84%. At level 12 against four bandits the effect turns on the hero's armour instead: the Swordmaster's fallback pick Shield Wall (+8 AC; Gain Strength is refused at Strength 9) and the Paladin's resistance make Aldric the worse target, so the four ranged bandits shoot Delwyn (who falls in 78–81% of battles and casts Meteor 0.1 times a battle instead of 0.9), while the Assassin and Spellsword Aldric draws the fire and Delwyn kills them. So raising those paths' numbers would not close the gap, and defensive numbers widen it. This is the AI's targeting and a party with one front-liner, not the paths.
- **Magic at levels 8 and 12: the party's damage is the mage's.** In the capstone cell Delwyn deals 120–130 of the party's ~210 damage a battle as an Evoker. A Cryomancer, Arcanist or Saint deals 0–5 (Web, Glacial Prison, Mass Haste, Haste, Curse, Bane, Protect), the bandits are not killed, and the mage falls in every battle. The control spells are cast (after the policy fixes) but four ranged bandits in steel are a damage race. At level 8, where the foes close in, the Saint's Curse, Bane and Protect win 500 and the Cryomancer and Arcanist sit near 300. The Cryomancer's capstone Glacial Prison took the pick that was Ice Lance's at level 12 (292 before the capstone came first, 31–36 after), a regression of the plan order that review round 1 fixed: the cryomancer plan now puts Ice Lance ahead of Web, so Delwyn holds both at 12 and wins 324.
- **Archery at levels 4 and 12: the Rogue path has no offence for an archer.** `rogue_archer` takes Sprint and Skirmisher at levels 2 and 4 instead of Aimed Shot and Far Shot; Skirmisher's +10 needs a move before the shot, and the policy's archer stands and shoots. Dodger, Tumble, Evasion and Shadowdancer are defensive, and Counter is melee only.

### Stage-4 notes, settled

- **Delwyn** takes the design's build B (Magic Arrow, Heal, Destruction): he holds Meteor at level 12 (test in `progression.test.ts`), so AC8 at `--ready-level 12` can now be met; step 25's or 26's `--ready-level 12` run will show it.
- **The `assassin` plan** is reachable now: since stage 3 the path holds Backstab (Melee 30 or Archery 30), so the plan skips Keen Eye (Luck 6) and both Aldric and Brenna take Backstab, Venom Strike, Hamstring, Ambush, Executioner and Deathblow at 12. No other parity hero is needed.
- **A harder level-8 cell:** Hobgoblin Warband threat 5 (above).
- **Area techniques (Volley, Consecrate) not AP-normalised:** left as they are. Volley is used 1.2 a battle in the one-party campaign and 3.5–4.8 at level 12 with a recharge of 2, that is whenever it is ready, but a 6 AP Volley with Hunter's Mark's 2 AP is a full turn and touches two or three foes, against two 4 AP shots at one; the Ranger is not above its role in any cell, so there is nothing to trim.
- **Swift Hands discounting Purify:** left. The Healer is not above its role in any cell (it is far below at 8 and 12), so the 1 AP off Purify does not matter to parity.

### Campaign check (no collapse)

One party, `--campaign --battles 500 --seed 1 --parties 1` (`logs/24-final-one.txt`): **268 of 500** beat the Source (from 449), 232 fell, 0 encampments lost, in **287 days** (step 01's 270 ± 10%: in) and 19.8 battles, **0.9 heroes dead** a campaign (≤ 2.0: in). Won by threat: 1 100%, 2 99.5%, 3 98.0%, 4 99.9%, 5 89.5%. Heroes died most at level 3 (202, the Fine-geared Bandit Camp) and 7 (97). The same figure was measured after rows 5, 7 and 10 (`logs/24-foes1-one.txt`); the last two policy fixes do not touch the default party (the guard did not move). No vanguard holds a capstone at the ready level of 7.

### For step 25

- The one-party campaign is 268, 18 above the band's top (215–250). The levers I left for it, nearest first: the Blight Horror's hit points (the lever for the Source's battle alone; with `FOE_HP_PER_LEVEL` 1.3 the Horror at level 5 already has 1.3× the hit points it had, SG10 fell from 424 to 15, so the Source is now hard and the next move may be to lower its base again if the company or `--ready-level 10` drop out of band); `banditGear` at threat 5 (Masterwork iron took BC5 to 404, below its band, so only a half step is left there: a Masterwork weapon alone, say); `FOE_HP_PER_LEVEL` 1.3 → 1.4 (F3 and SP5 have about 10 to spare above their bands' floors); a monster count at threat 5 (`TODAY`'s 4). The default company and `--ready-level 10` were not run here.
- SG10 (15) is above step 01's 2, as the band asks, but far under stage 3's 386: the Source's guardians, three heroes against four foes at level 5, are now as hard as they were before the trees.

### Decisions needed (for the orchestrator; I recommend the first option of each)

1. **Parity at levels 8 and 12.** Eleven plan-cells are more than 50 below their role's best (table above). The cause is the AI and the party's shape, not the paths' numbers: foes shoot the softest hero, the ready-made party has one front-liner, and the mage is its damage. Raising the weak paths' numbers would turn control and support casters into damage casters, which is a skill losing what makes it distinct, so I stopped. Options: (a) accept parity at level 4 (all but the two Scout plans inside) and record 8 and 12 as cell-bound, judging the support paths in a party built to carry them later; (b) judge parity in a four-hero party (a second fighter or Garrick) so that one plan does not carry a whole role; (c) a policy step for focus fire (foes weighing a taunter, a Guardian or a healer, heroes guarding the mage) before any numbers move; (d) raise the outliers' numbers anyway (Glacial Prison without a roll, Ice Lance before the capstone, Haste and Curse larger), knowing the cells reward damage.
2. **Rogue for an archer** (`rogue_archer` 353 at level 4, −109): the path has no offence for a bow. Options: (a) accept, as the Rogue is a melee path whose T1 nodes an archer can still take; (b) give Skirmisher's +10 to a shot without the move, or let the policy shoot after a step; (c) drop `rogue_archer` from the parity set.
3. **The cliff at threat 6.** BC6 at level 8 is 74 and BC7 22 (four bandits in Fine steel). Off today's map, so not this step's; stage 9 will need counts there.

### Execution record

Commits: 9016146 (plans, Delwyn's build B, Arcane Blood, Haste, Protect, Bane), 3af5c59 (`FOE_HP_PER_LEVEL` 1.3, bandits Fine from threat 3, the Nest Spider), 53cdeb0 (Sleep and spell power in the policy), and this record's commit. The guard was re-recorded in 9016146 and 3af5c59 and the policy snapshot in both (4655 → 4795 lines in 9016146, 4795 → 5430 in 3af5c59, with their hashes), each saying why; in 53cdeb0 both stayed green. 9016146's snapshot re-record also covers a monster change: the Goblin Shaman and the Blight Horror no longer recast Bane on units already baned. 9016146 alone fails the in-browser test A10 (`e2e/battle.test.ts`, Delwyn's mana 24 → 28), fixed in af6f22d; no history rewritten.

In-browser: `e2e/character.test.ts` passed; `e2e/battle.test.ts`'s A10 cast test needed Delwyn's mana moved (28, 25, 22) and then passed; the full suite then passed, 118 of 118 in 10 files.

Commands: `npm test` (2011 passed at the end; one run under heavy load timed out two slow tests, which passed alone and on the rerun); the cells, the three parity grids and the one-party campaign as above (each run alone; a scratch runner, `cells.sh`, ran them in sequence); `npm run test:browser -- e2e/character.test.ts e2e/battle.test.ts` for the Delwyn changes (result below). Not run: the default company and `--ready-level 10` campaigns (step 25's), `npm run build`.

Deviations: foe counts, `FOE_HP_PER_LEVEL` and bandit gear moved here, against the task file's §2 decision, by the user's stage-4 decision (tougher foes first). Capstones checked at Bandit Camp threat 7, not Spider Nest threat 5 (user's decision). The level-8 parity cell is the Hobgoblin Warband threat 5. Arcane Blood's ask lowered to Intelligence 3 (so Aldric can reach Arcane Knight; otherwise the Spellsword path was capped at depth 4 for him). The policy's Bane change also applies to the monsters that cast Bane, the Goblin Shaman and the Blight Horror: they no longer recast it where it would touch fewer than two units not already baned (kept by the orchestrator as a fix in the direction of tougher foes; CLAUDE.md's policy line says so).

### Review round 1 (2026-11-14)

Decisions recorded: **the user** accepts parity at levels 8 and 12 as limited by the three-hero simulated party and the AI, level-4 parity being the test; and accepts the Rogue for an archer (a melee and skirmish path an archer takes on purpose), `rogue_archer` kept in the parity set as a reported figure only. **The orchestrator** keeps the Bane fix for monsters too.

- **Found:** the capstone-first order cost the cryomancer Ice Lance at 12 (292 → 31). **Fixed:** the cryomancer plan names Ice Lance before Web; BC7 L12 cryomancer 36 → **324** (`logs/24-fix-c12-cryomancer.txt`). Tests: the plan's order, and Delwyn on the cryomancer plan holding Ice Lance and Glacial Prison at 12 (red without the fix). The arcanist and saint have no such pattern: both rose with capstone-first (18 → 36, 30 → 79). The healer lost Swift Hands to Revive at 12 (278 → 241), which is the capstone taking the last tier-3 pick, not a lost damage spell; left.
- **Found:** no test of Arcane Blood's new ask, nor of the Spellsword reaching Arcane Knight. **Fixed:** Intelligence 3 qualifies and 2 does not (`perks.test.ts`); Aldric on the spellsword plan holds Arcane Blood and Arcane Knight at 12 (`progression.test.ts`).
- **Found:** the Delwyn contract stale. **Fixed:** annotated as amended in step 24 (build B) in the index's C5, the design's AC4 (mana 24 → 28) and its §5.8 table.
- **Found:** CLAUDE.md's rules of scaling kept the old cell figures and "the gear is already plain below threat 5"; its policy line said monsters choose exactly as before step 12. **Fixed:** the Spider Nest 448, Salamander Pool 454 and Bandit Camp 455, 462, 484 noted where the older figures stand, the gear sentence put in the past with Fine iron from threat 3, and the policy line names the Bane exception.
- **Found:** the snapshot's line count misstated, and A10 failing at 9016146 unrecorded. **Fixed** in the execution record above.

The guard and the policy snapshot are unchanged by the fix (no default plan or bandit follows the cryomancer plan).
