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

- [ ] The parity grid and the cells recorded before and after, in the execution record.
- [ ] The run log complete: every lever tried, its value, its figures, kept or reverted.
- [ ] Each kept change committed with its tests, the guard re-recorded and `CLAUDE.md` numbers fixed; `npm test` passes.
- [ ] Cells in band and parity holding, or the remaining gaps reported with a recommendation (and any pick-rate or foe-count question raised as a decision for the user).
- [ ] The index's step table shows step 24 `done (<commits>)`; the Measurements table's cell rows are left for step 25's final column (record this step's in the execution record).

## 7. Execution record

### Run log

| # | Lever | Value (from → to) | Cells / parity figures | One-party campaign | Kept or reverted |
| --- | --- | --- | --- | --- | --- |

