# Step 27: Baseline and the v25 fixture

[Plan index](index.md) (Stage 5) · [Amendment design](../../designs/skill-trees-node-costs.md) §5.4 (saves), §7.2 step 1 (baseline) · [Main design](../../designs/skill-trees.md) · [Feature record](../../features/skill-trees.md)

**Difficulty:** sonnet. Engineer `model: "sonnet"`, reviewer `model: "sonnet"`. No source or test file changes: the step runs the simulator on today's code and captures a save written by today's `serializeSave`. It is careful bookkeeping, and it must happen **before step 28 touches any code**, since every later figure is judged against it and the fixture must be written by version-25 code.

## 1. Objective

1. **Re-measure the balance** on the code at `6050923` (the same code as `b488b1c`): the three campaigns, every cell, and the path parity at levels 4, 8 and 14. Fill the **27 baseline** column of the index's Stage 5 Measurement table and put the parity tables in this file's execution record. Expected: step 25's finals for the cells and campaigns.
2. **Capture `src/game/fixtures/save-v25.json`**: a version-25 save string written by today's `serializeSave`, holding heroes the v26 migration (step 28) must treat differently: one over budget and one under budget under the new costs. Record exactly what it holds and the points each hero must get, so step 28 can assert NC6 from this record alone.

The commit holds the fixture, the index's figures and this file's record only.

## 2. Requirements and context

- **N6 / NC6:** "Saves of version 23 to 25 (and 22 and 18, through the existing chain) load. Every held node is kept, and the hero gets the points it would have, less what its nodes cost, never fewer than 0." "The v25, v22 and v18 fixtures load with every held node kept and `perkPoints = max(0, pointsAt(level) − nodesCost)`."
- **Design §5.4 Fixture:** "Capture `src/game/fixtures/save-v25.json` before the change, from a level-12 company (as step 01 captured v22). It should include one hero over budget and one under budget."
- **Design §7.2 step 1:** "Baseline on b488b1c (the code before this amendment). Re-run the cells and campaigns below, so that the comparison is like for like. Expected: step 25's finals."

### The new costs (C17, for computing the expected points; step 28 implements them)

```ts
// src/character/trees.ts
export const TIERS: Record<Tier, { level: number; depth: number; cost: number }>
  // 1: { level: 1, depth: 0, cost: 1 }, 2: { level: 2, depth: 1, cost: 2 },
  // 3: { level: 6, depth: 3, cost: 3 }, capstone: { level: 12, depth: 5, cost: 4 }
// src/character/perks.ts
export function perkCost(perk: PerkId): number                          // TIERS[PERKS[perk].tier].cost; no per-node override
export function nodesCost(character: Pick<Character, 'perks'>): number  // the sum of perkCost over the nodes held
// src/character/progression.ts
export function pointsAt(level: number): number       // CREATION_PERK_POINTS + (level − 1) × PERK_POINTS_PER_LEVEL: 3, 4, 6, 10, 14, 22 at 1, 2, 4, 8, 12, 20
```

The migration (C19): every hero of every party and the reserves keeps every node; `perkPoints = max(0, pointsAt(level) − nodesCost(hero))`; `perkPicks` is deleted.

### What the fixture must hold

- A **company at level 12**, as `raisedParty` (`scripts/simulate.ts`, `--party-level 12`) builds it: Aldric, Brenna and Delwyn on their default plans. Today's level-12 Brenna holds 9 nodes (3 T1, 3 T2, 2 T3 and Deadeye) costing 19 against `pointsAt(12)` = 14: **over budget**, she must get 0.
- An **under-budget hero**: a reserve (`game.reserves`) at a mid level holding few nodes, e.g. a level-6 pre-roll with its three creation T1s and its picks unspent (cost 3, `pointsAt(6)` = 8, so 5 points). It also proves the migration covers the reserves.
- Every hero's `perkPicks` as today's code leaves it (some above 0 is welcome: the migration must delete it).
- Optional: a second party (with `world.guildHall = 4`, so two parties are legal on load), as `save-v22.json` has.

Write it with a scratch script outside `src/` (for example in the scratchpad, or a scratch test removed before committing) that builds the `GameState` with today's modules (`newGame`, `raisedParty`/`readyMadeParty`, `autoAdvance`, `draftCharacter` with a pre-roll) and calls `serializeSave`. Read `save.test.ts`'s v22 fixture tests (`v22With`, "is the fixture the code before the skill trees wrote") and step 01's record for how `save-v22.json` was captured; follow the same way.

## 3. Dependencies

- Step 26 done (the feature as built). No code change has been made for the amendment; HEAD is `6050923` or a later docs-only commit. Check with `git diff --stat b488b1c HEAD -- src scripts` (expect nothing).

## 4. Scope

**In:** `src/game/fixtures/save-v25.json` (new); the index's Stage 5 Measurement table (27 baseline column) and this step's status; this file's execution record.

**Out:** any change to `src/` (but the new fixture), `scripts/`, tests, `CLAUDE.md` or the manual. Do not add the fixture's test: step 28 does, with the migration.

### Measurement

Shared constraints:

- **Environment.** The system Node is 22; Node 26 is at `~/.nvm/versions/node/v26.13.0/bin`. Prefix every npm or node command with `PATH=$HOME/.nvm/versions/node/v26.13.0/bin:$PATH`.
- **Run one simulation at a time, never two at once**, each with its own `--out` under `logs/` (gitignored) and its summary in a `.txt` beside it. A 500-campaign run takes about five minutes (`--ready-level 10` some 20); a cell seconds to a minute.

Runs, all `--seed 1`, 500 each:

```sh
P="PATH=$HOME/.nvm/versions/node/v26.13.0/bin:$PATH"
# campaigns
npm run simulate -- --campaign --battles 500 --seed 1 --parties 1 --out logs/27-one.jsonl > logs/27-one.txt
npm run simulate -- --campaign --battles 500 --seed 1 --out logs/27-company.jsonl > logs/27-company.txt
npm run simulate -- --campaign --battles 500 --seed 1 --ready-level 10 --out logs/27-rl10.jsonl > logs/27-rl10.txt
# cells: --encounter E --threat T --party-level L
npm run simulate -- --battles 500 --seed 1 --encounter bandit_camp --threat 3 --party-level 3 --out logs/27-bc3.jsonl > logs/27-bc3.txt
# parity: one role overridden
npm run simulate -- --battles 500 --seed 1 --encounter bandit_camp --threat 7 --party-level 14 \
  --plans melee=paladin --out logs/27-par14-melee-paladin.jsonl > logs/27-par14-melee-paladin.txt
```

| Cell | Encounter, threat, level | Band |
| --- | --- | --- |
| GR3 | `goblin_raid` 3, level 3 | ≥ 470 |
| BC3 | `bandit_camp` 3, level 3 | 400–470 |
| BC4 | `bandit_camp` 4, level 4 | 430–490 |
| BC5 | `bandit_camp` 5, level 5 | 420–490 |
| SN5 | `spider_nest` 5, level 5 | 410–480 |
| SP5 | `salamander_pool` 5, level 5 | 410–480 |
| TL5 | `troll_lair` 5, level 5 | report only |
| SG7 | `source_guardians` 5, level 7 | 0 ± 40 |
| SG10 | `source_guardians` 5, level 10 | above 2 |
| F1, F2, F3 | `goblin_raid` 1, 2, 3, level 1 | nearly all, most, 7 in 10 |

| Parity cell | Encounter, threat, level | Judged (in step 30) |
| --- | --- | --- |
| L4 | `bandit_camp` 4, level 4 | each plan within ±50 of its role's best (`rogue_archer` reported only) |
| L8 | `hobgoblin_warband` 5, level 8 | reported |
| L14 (capstone) | `bandit_camp` 7, level 14 | target ±50; reported |

Plans: melee `knight`, `swordmaster`, `spellsword`, `assassin`, `paladin`; archery `ranger`, `rogue_archer`, `assassin`; magic `evoker`, `cryomancer`, `arcanist`, `healer`, `saint`, and `evoker_healer` for reference (14 runs a level, 42 in all).

Level 14 has not been measured before (step 24's capstone cell was level 12): it is today's figure at the level stage 5 judges, for a like-for-like comparison in step 30.

## 5. Verification

- `git diff --stat HEAD~1 -- src scripts` after the commit shows only `src/game/fixtures/save-v25.json`.
- `npm test` passes (nothing reads the fixture yet).
- The fixture parses with today's `parseSave` (check in the scratch script) and its `version` is 25.
- Every run's `.txt` exists under `logs/` and its figure is in the tables.

## 6. Completion criteria

- [ ] `save-v25.json` committed; the record lists each hero (party or reserve, name, level, nodes held by tier, `nodesCost` under C17, `pointsAt(level)`, expected `perkPoints`), with at least one over budget (expect 0) and one under budget (expect a positive number).
- [ ] Index Stage 5 Measurement table: the 27 baseline column filled; differences from step 25's finals explained or flagged.
- [ ] Parity tables at levels 4, 8 and 14 in the record, with each plan's gap to its role's best and, at 14, the capstone each hero holds (or "none").
- [ ] Index step 27 status `done (<commit>)`. Commit "Skill trees step 27: baseline and the v25 fixture" on `skill-trees`, no push, no attribution lines.

## Execution record

**Step 27, 2026-11-14.** Code at `6050923` (`git diff --stat b488b1c HEAD -- src scripts` empty; the working tree held only the untracked `.claude/` and `.vitest/`). Node 26.13.0, seed 1, 500 each, one run at a time, summaries in `logs/27-*.txt` (the `.jsonl` logs were deleted after each run, to save disk; `logs/` is gitignored).

### Baseline

Every figure equals step 25's final, to the battle: the code is unchanged and the runs are deterministic.

| Figure | 25 final | 27 baseline |
| --- | --- | --- |
| one party (`--parties 1`) | 243 of 500 | 243 of 500 (48.6%), 287 days, 19.8 battles, 1.0 heroes dead a campaign; 375 s |
| default company | 243 | 243 of 500, 288 days, 19.9 battles, 1.1 dead; 292 s |
| `--ready-level 10` | 445 | 445 of 500 (89.0%), 539 days, 46.2 battles, 1.0 dead; 822 s |
| GR3 / BC3 / BC4 / BC5 | 500 / 455 / 462 / 484 | 500 / 455 / 462 / 484 |
| SN5 / SP5 / TL5 | 448 / 454 / 0 | 448 / 454 / 0 |
| SG7 / SG10 | 0 / 5 | 0 / 5 |
| F1 / F2 / F3 | 500 / 500 / 453 | 500 / 500 / 453 |

### Path parity (wins of 500, only the named role's plan overridden)

Gap is to the role's best of the plans judged (`evoker_healer` is reference only; `rogue_archer` is reported only at level 4). The capstone is what that role's hero holds at level 14 (Aldric, Brenna or Delwyn raised by `autoAdvance` on the plan; the other two heroes on their defaults).

| Role | Plan | L4 (`bandit_camp` 4) | gap | L8 (`hobgoblin_warband` 5) | gap | L14 (`bandit_camp` 7) | gap | Capstone at 14 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| melee | knight | 462 | -13 | 465 | 0 | 497 | -3 | unbreakable |
| melee | swordmaster | 444 | -31 | 240 | -225 | 496 | -4 | blademaster |
| melee | spellsword | 451 | -24 | 114 | -351 | 499 | -1 | arcane_knight |
| melee | assassin | 443 | -32 | 200 | -265 | 500 | 0 | deathblow |
| melee | paladin | 475 | 0 | 401 | -64 | 445 | -55 | aegis |
| archery | ranger | 462 | 0 | 465 | 0 | 497 | -1 | deadeye |
| archery | rogue_archer | 353 | -109 (reported) | 444 | -21 | 487 | -11 | shadowdancer |
| archery | assassin | 400 | -62 | 465 | 0 | 498 | 0 | deathblow |
| magic | evoker | 475 | -14 | 465 | -35 | 493 | 0 | meteor |
| magic | cryomancer | 472 | -17 | 306 | -194 | 464 | -29 | glacial_prison |
| magic | arcanist | 475 | -14 | 295 | -205 | 181 | -312 | mass_haste |
| magic | healer | 487 | -2 | 248 | -252 | 425 | -68 | revive |
| magic | saint | 489 | 0 | 500 | 0 | 286 | -207 | sanctuary |
| magic | evoker_healer (reference) | 462 | | 465 | | 497 | | meteor |

Every plan holds 10 nodes at level 14 (and a capstone), under today's picks. Level 4: the archery assassin (-62) is outside the ±50 gate (it was within step 24's accepted figures only as reported by that step; this is the unchanged baseline, so step 30 judges against it). Levels 8 and 14: large gaps for the spellsword, swordmaster, assassin and the mage plans, as step 24's record reported; level 14 is new and is reported, not a gate (decision 14).

### The fixture

`src/game/fixtures/save-v25.json` (23 233 bytes, one JSON object, as `save-v22.json`), written by today's `serializeSave` (`SAVE_VERSION` 25; `parseSave` loads it) through the scratchpad script `capture-v25.ts` (not committed). World seed 1234, encampment "Oakvale", `world.guildHall = 4`, no battle, `savedAt` 1700000000000. Heroes built with today's modules: Aldric, Brenna and Delwyn (the ready-made party) raised to level 12 with `levelUp` and `autoAdvance` on their default plans; Garrick (a pre-roll) in `party_2` ("Second Company") raised to 8 the same way; Wren (Delwyn's draft renamed) in the reserves at level 6 with `levelUp` only, so her three creation nodes are held and her picks unspent. Costs under C17 (T1 1, T2 2, T3 3, capstone 4), `pointsAt(level) = 3 + (level - 1)`:

| Where | Hero | Level | Nodes held (T1 / T2 / T3 / capstone) | nodesCost | pointsAt | Expected `perkPoints` | `perkPicks` in the file |
| --- | --- | --- | --- | --- | --- | --- | --- |
| party_1 | Aldric | 12 | 3 / 2 / 3 / 1 (9 nodes: weapon_training, heavy_hand, toughness, rooted, taunt, pin, iron_skin, guardian, unbreakable) | 20 | 14 | 0 (over budget) | 0 |
| party_1 | Brenna | 12 | 3 / 3 / 2 / 1 (marksmanship, deadly_aim, dodger, aimed_shot, far_shot, volley, hunters_mark, pinning_shot, deadeye) | 19 | 14 | 0 (over budget) | 0 |
| party_1 | Delwyn | 12 | 4 / 3 / 1 / 1 (magic_arrow, heal, destruction, flame_arrow, heal_all, fireball, pyromancy, mending, meteor) | 17 | 14 | 0 (over budget) | 0 |
| party_2 | Garrick | 8 | 4 / 2 / 1 / 0 (weapon_training, marksmanship, dodger, toughness, rooted, taunt, pin) | 11 | 10 | 0 (over budget) | 0 |
| reserve | Wren | 6 | 3 / 0 / 0 / 0 (magic_arrow, heal, destruction) | 3 | 8 | 5 (under budget) | 3 |

Every node is kept by the migration. `perkPicks` must be deleted and `perkPoints` set as in the table (Wren the only positive one, and the only hero with picks left, which proves the reserves are migrated and `perkPicks` dropped). Mana, hit points and equipment are as `autoAdvance` and `levelUp` left them; the fixture was not edited by hand.

### Verification

- `git diff --stat HEAD -- src scripts` before the commit: only the untracked fixture. `npm test`: see the commit.
- Mistake worth a line: the first parity pass in the driver script passed the wrong argument as the encounter, so its 42 runs failed at once; they were rerun by a second script (`par27.sh`) after the campaigns, and the tables above are from that rerun.
