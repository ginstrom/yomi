# Step 28: Perk points: the economy, plans and save v26

[Plan index](index.md) (Stage 5) · [Amendment design](../../designs/skill-trees-node-costs.md) §4.1–4.5, §4.7, §5.1–5.4, §7.1, §7.3 · [Main design](../../designs/skill-trees.md) · [Feature record](../../features/skill-trees.md)

**Difficulty:** opus. Leave the engineer's and the reviewer's model unset. This step changes the progression economy every hero and bandit grows by, the simulator's spending rule, and the save format with a migration.

## 1. Objective

Picks give way to **perk points**: 3 at creation and 1 at every level up; a node costs its tier's points (T1 1, T2 2, T3 3, capstone 4). `autoAdvance` saves for the plan's next node instead of spending on cheaper ones; three plans are reordered for the costs. `SAVE_VERSION` rises to 26 with `migrateFrom25`, which keeps every node and recomputes the points. The refactor guard is re-recorded. The scenes change only where the renames force them (decision 13).

## 2. Requirements and context

| ID | Requirement (design §2) |
| --- | --- |
| N1 | Perk points replace picks: 3 at creation, 1 at every level up (2, 3, 4, …), stored as `perkPoints`. Skill points (Melee, Archery, Magic) are unchanged and separate. |
| N2 | A node costs by its tier: T1 1, T2 2, T3 3, capstone 4. Taking it spends its cost; only with the points and the asks met. |
| N3 | Tiers keep their level and depth asks; depth counts nodes held; the calling and the one-capstone rule are unchanged. |
| N4 | Creation spends 3 points on T1 nodes and plays exactly as today. |
| N5 | `autoAdvance` spends by plan and saves when the next node costs more than it holds; plans reordered; bandits follow the same rules. |
| N6 | `SAVE_VERSION` 26; versions 23–25 (and 22, 18 through the chain) load; every node kept; points = `max(0, pointsAt(level) − nodesCost)`. |

Acceptance criteria this step meets: **NC1** (`pointsAt(4, 8, 12, 20)` = 6, 10, 14, 22; a new hero has 3; each level adds exactly 1), **NC2** (T1/T2/T3/capstone spend 1/2/3/4; an unaffordable node cannot be taken by `takePerk` or `autoAdvance`), **NC3** (a hero with both T1s of a path and one other T1 at creation, then every point in the path, takes the T3 at level 6 and the capstone at 12, not earlier; a level-14 hero holding 5 Swordmaster and 6 Assassin nodes, given 4 points, can take Deathblow and not Blademaster), **NC5** (`autoAdvance` never spends below the cost of the plan's next open node; Brenna Deadeye at 12, Delwyn Meteor at 14, Aldric Unbreakable at 15; the bandit-built hero and the bandit still have equal stats), **NC6** (the v25, v22 and v18 fixtures load with every node kept and the points by the rule; `SAVE_VERSION` 26), and **NC4**'s rules (the words are step 29's).

Edge cases (design §4.7): a node the hero qualifies for but cannot afford is open; a capstone whose path stops being the calling while the hero saves closes, the points kept; a migrated hero whose nodes cost more than its level gives has 0 points until its level catches up, its nodes never taken; asks gate taking, never keeping. Points left unspent stay on the hero; no node grants perk points; Scholar's "+2 skill points every level" is about skill points.

### Decisions (index, stage 5)

- **11.** `canAffordPerk`, not the design's `canAfford` (`buildings.ts` has a `canAfford`).
- **12.** `migrateFrom22` stops computing picks (it imports `picksAt`, which goes); `migrateFrom25`, run after it, sets the points and deletes `perkPicks`.
- **13.** This step changes a scene file only where `tsc` forces it, and on a line it must touch writes design §4.6's final words: `nodeHint` and `draftNodeHint` (C17's hints), `InventoryScene.buildPerkStatus`'s text (`Perk points: N`, keeping today's colour rule of points > 0 until step 29), `debugCommands.ts` (`N perk points`). `party.ts`'s victory line is domain and is done here in full. Creation's header and rule line, the tree help text, the probe field names and e2e wording are step 29's: keep `CreationProbe.perkPicks` and `InventoryProbe.perkPicks` as names, now read from `perkPoints`.
- **15.** This step changes play, so it re-records the refactor guard (`scripts/simulate.test.ts`, `describe('the refactor guard')`) and, if it moves, the encounters' choice snapshot in `src/engine/policies.test.ts`, in their own commit, saying why.
- **16.** Costs and the rate are not levers.

### Contracts (copied unchanged from the index)

**C17. Perk points**

```ts
// src/character/trees.ts
export const TIERS: Record<Tier, { level: number; depth: number; cost: number }>
  // 1: { level: 1, depth: 0, cost: 1 }, 2: { level: 2, depth: 1, cost: 2 },
  // 3: { level: 6, depth: 3, cost: 3 }, capstone: { level: 12, depth: 5, cost: 4 }
// src/character/perks.ts
export function perkCost(perk: PerkId): number                          // TIERS[PERKS[perk].tier].cost; no per-node override
export function nodesCost(character: Pick<Character, 'perks'>): number  // the sum of perkCost over the nodes held
// src/character/character.ts
// Character.perkPicks is renamed Character.perkPoints: number   (perk points earned and not yet spent)
// src/character/creation.ts
export const CREATION_PERK_POINTS = 3                 // replaces CREATION_PERK_PICKS
export function perkPointsLeft(draft: CharacterDraft): number   // replaces perkPicksLeft: CREATION_PERK_POINTS less the cost of draft.perks
// draftCharacter sets perkPoints; a refusal for want of points reads "no perk point is left"
// src/character/progression.ts
export const PERK_POINTS_PER_LEVEL = 1
export function pointsAt(level: number): number       // CREATION_PERK_POINTS + (level − 1) × PERK_POINTS_PER_LEVEL: 3, 4, 6, 10, 14, 22 at 1, 2, 4, 8, 12, 20
export function canAffordPerk(character: Pick<Character, 'perkPoints'>, perk: PerkId): boolean        // perkPoints ≥ perkCost(perk)
export function affordableAt(character: Pick<Character, 'level' | 'perkPoints'>, perk: PerkId): number  // level + max(0, perkCost(perk) − perkPoints)
// levelUp: perkPoints += PERK_POINTS_PER_LEVEL at every level
// takePerk(character, perk): false unless canAffordPerk and qualifiesFor; else spends perkCost(perk)
// canAdvance: skillPoints > 0, or some node of availablePerks(character) that canAffordPerk
// XpGain.perksGained is renamed perkPointsGained
// removed: PICK_LEVEL_STEP, CREATION_PICKS, picksAt, nextPerkLevel, hasPickFor
// qualifiesFor, availablePerks, missingRequirements, describePerkRequirements: unchanged (asks only, never points)
```

Invariant (tested): for a hero never migrated, `perkPoints + nodesCost(hero) === pointsAt(level)`.

Strip hints (`src/scenes/perkTree.ts`, written in step 28; lock and "Not yet" words unchanged):

- `nodeHint`, open and `canAdvance` false: `Perk points are spent on the world map`
- open and affordable: `Click to take (3 of your 4 perk points)`
- open and short: `Needs 3 perk points; you have 1 (level 9)`, the level being `affordableAt`
- singular where the number is 1: `1 perk point`
- `draftNodeHint`, open with none left: `No perk points left`

**C18. `autoAdvance` and the plans**

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

**C19. Save v26**

```ts
// src/game/save.ts
export const SAVE_VERSION = 26
function migrateFrom25(game: Record<string, unknown>): void
  // versions 25, 24, 23; and 22 and 18 after migrateFrom22. Every hero of every party and the reserves:
  // every node kept (no refund); perkPoints = max(0, pointsAt(level) − nodesCost(hero)); perkPicks deleted
// parseSave accepts [26, 25, 24, 23, 22, 18]; characterOf also checks perkPoints is an integer ≥ 0
// migrateFrom22 no longer writes perkPicks (decision 12); a saved battle needs nothing (UnitRecord unchanged)
// fixture: src/game/fixtures/save-v25.json (step 27), its heroes and expected points in step 27's record
```

## 3. Dependencies

- **Step 27** (done): `src/game/fixtures/save-v25.json`, a version-25 save from today's code, and its record in [27-baseline-and-v25-fixture.md](27-baseline-and-v25-fixture.md)'s execution record: each hero's level, nodes, `nodesCost` and expected `perkPoints` (one over budget at 0, one under budget above 0). Assert against those figures.
- Existing (at `6050923`): `TIERS` (level, depth) in `trees.ts`; `picksAt`, `PICK_LEVEL_STEP`, private `CREATION_PICKS`, `nextPerkLevel`, `hasPickFor`, `canAdvance`, `levelUp`, `gainXp`/`XpGain.perksGained`, `takePerk`, `AUTO_PLANS`, `pathPlan`, `autoAdvance` in `progression.ts`; `CREATION_PERK_PICKS`, `perkPicksLeft`, `draftCharacter` (sets `perkPicks`) and the refusal "no pick is left" in `creation.ts`; `Character.perkPicks` in `character.ts` (also set to 0 near line 454); `migrateFrom18`, `migrateFrom22` (writes `perkPicks` from `picksAt`), `characterOf`, `parseSave` accepting `[SAVE_VERSION, 24, 23, 22, 18]` in `save.ts`; `describeRewards` in `party.ts` (", a pick", "; next pick at level N").

## 4. Scope and guidance

### Domain (`src/character/`)

- `trees.ts`: `TIERS` gains `cost` (C17). Update its doc comment.
- `perks.ts`: `perkCost`, `nodesCost`; the module comment's "picks" wording (line ~10).
- `character.ts`: `perkPoints` replaces `perkPicks` (field, doc comment, the default near line 454).
- `progression.ts`: C17 and C18. `pointsAt` needs `CREATION_PERK_POINTS`; today the module keeps a private copy (`CREATION_PICKS`) rather than import `creation.ts` — keep that pattern (a private constant) or import, as the import graph allows, and test that they agree. For `autoAdvance`'s "would qualify but for the level", prefer a structural check over parsing `missingRequirements`' words: e.g. `qualifiesFor({ ...character, level: Math.max(character.level, perkLevel(perk)) }, perk)` with `cappedAttribute` null; check it is sound for nodes whose asks read derived numbers. Keep the doc comment over `autoAdvance` true. Reorder `knight`, `ranger` and `evoker_healer` (C18), keeping the comments that explain each plan's order.
- `creation.ts`: `CREATION_PERK_POINTS`, `perkPointsLeft`, `draftCharacter`, `draftProblems` ("Too many perks chosen" stays), the refusal "no perk point is left", comments.

### Game (`src/game/`)

- `party.ts` `describeRewards`: `Aldric reaches level 5: +6 max HP, 3 skill points, 1 perk point, wounds healed` (design §4.6); "next pick at level N" dropped. Update `party.test.ts`.
- `bandits.ts`: comments only (the node levels of C18's table). The same-stats test must still hold.
- `save.ts`: C19. Update the comment over `SAVE_VERSION` with the version-26 line. `heroOf` keeps clamping mana only for 22 and 18 (mana does not change here).

### Scenes, only what `tsc` forces (decision 13)

- `perkTree.ts`: `nodeHint` and `draftNodeHint` with C17's hint words (they used `hasPickFor` and `nextPerkLevel`). Update `perkTree.test.ts` for them.
- `InventoryScene.ts`: `canTakeNode` (line ~708) uses `canAffordPerk`; `pickWaits` and the probe read `perkPoints`; `buildPerkStatus`'s text becomes `Perk points: N` (no "Choose a node", "N to choose" or "Next pick at level N"), its colour rule as today.
- `CreationScene.ts`: the renamed imports only; words unchanged.
- `debugCommands.ts`: `N perk points`.
- `src/testHook.ts`: unchanged (the probe names are step 29's).

### Tests (design §7.1)

- `progression.test.ts`: `pointsAt` at 1, 2, 4, 8, 12, 20 (3, 4, 6, 10, 14, 22); `levelUp` adds 1 every level; `takePerk` spends the tier's cost and refuses an unaffordable node; the invariant; `autoAdvance` saves rather than falling through (Delwyn does not buy Heal All at level 5 while saving for Fireball); the ready-made heroes' and each bandit role's node levels (C18's table), raised level by level as the simulator does (`raisedParty` in `scripts/simulate.ts`, or the same `gainXp`/`autoAdvance` loop in the test); each bandit role's nodes at levels 3, 4 and 5. Replace the tests of `picksAt`, `nextPerkLevel`, `hasPickFor` and the even-level pick.
- `trees.test.ts` (replaces AC1's test): NC3's two cases.
- `creation.test.ts`: at most 3 perk points spent; the pre-rolls legal; `perkPointsLeft`; the refusal words.
- `character.test.ts`, `perks.test.ts`: the rename.
- `save.test.ts`: `save-v25.json` loads, every node kept, points as step 27's record says (over-budget 0, under-budget `pointsAt − nodesCost`), `perkPicks` gone; `save-v22.json` and `save-v18.json` load through the chain with the same rule (rewrite their pick assertions); a v26 round trip; a save whose `perkPoints` is missing or negative is unreadable; versions other than 26, 25, 24, 23, 22, 18 unreadable.
- `party.test.ts`: the victory line.
- Report in the record (not a test yet; step 30 adds it) which parity plans' heroes hold their capstone at level 14 under the new rules (`--party-level 14` `raisedParty` with each `--plans` entry of the index's parity list). A plan that does not is step 30's to fix by plan order.

### Guard and snapshots

After the tests pass, re-record the refactor guard (and the policy snapshot if it moved) in a separate commit, "Skill trees step 28: re-record the guard for perk points", saying why. Step 29 must then keep them green unchanged.

### Docs

- `CLAUDE.md`, the lines this step makes wrong: the rules of progression (a pick at every even level, `PICK_LEVEL_STEP`, `picksAt`), the rules of perks and spells ("one pick buys one", "a spell is a node bought with a pick"), the rules of creation ("spends 3 picks"), the rules of saving (version 26, `migrateFrom25`; the v22 line's `perkPicks`/`picksAt`), the bandit plan lines ("Rooted at 2, Taunt at 4 and Pin at 6", "Flame Arrow at level 2, Destruction at 4, Fireball at 6, Heal at 8 and Heal All at 10", the Brute's, Cutthroat's and Archer's), restated from the plan tests, and `autoAdvance`'s rule. Search `CLAUDE.md` for every name removed or renamed (`picksAt`, `perkPicks`, `PICK_LEVEL_STEP`, `nextPerkLevel`, `hasPickFor`, `perksGained`, `CREATION_PERK_PICKS`, `perkPicksLeft`) and fix each line. The scaling figures are step 30's and 31's; leave them.
- The manual is step 31's.

### Shared constraints (from the index)

- **Environment.** Prefix every npm or node command with `PATH=$HOME/.nvm/versions/node/v26.13.0/bin:$PATH` (Node 26; the system Node is 22).
- **Commands:** `npm test` (`tsc && vitest run`) before every commit; `npx vitest run <file>` for one file; `npm run test:browser` after the scene edits (read `e2e/CLAUDE.md` first).
- **Domain first.** Rules live in the Phaser-free modules with tests; scenes decide nothing; helpers in `src/scenes/` stay free of runtime Phaser imports.
- **`tsc` is the linter**: `noUnusedLocals`, `noUnusedParameters`, `erasableSyntaxOnly`, `verbatimModuleSyntax`, `.ts` extensions.
- **Determinism.** No engine, event or log-schema change: `LOG_SCHEMA_VERSION` stays 26.
- **Simulator.** No 500-run measurement here (step 30's). Single short runs to check the capstone levels are fine; one at a time, outputs under `logs/28-*`.
- **Commits.** On `skill-trees`, no push, no attribution lines: "Skill trees step 28: perk points, plans and save v26", then the guard commit.

## 5. Verification

- `npm test` green, including the new tests and the re-recorded guard.
- `npm run test:browser` green. If an in-browser test fails only on words this step changed (the victory line, the Skills tab's status, a hint), update its assertion here; list each in the record.
- `npm run build` passes.
- `grep -rn -E "perkPicks|picksAt|PICK_LEVEL_STEP|nextPerkLevel|hasPickFor|perksGained|CREATION_PERK_PICKS|perkPicksLeft" src scripts CLAUDE.md` finds only the probe field `perkPicks` in `testHook.ts`, `InventoryScene.ts`, `CreationScene.ts` and `e2e/` (step 29 renames it), and `save.ts`'s deletion of the old field.

## 6. Completion criteria

- [ ] C17, C18 and C19 implemented as written; decisions 11, 12, 13 followed.
- [ ] NC1, NC2, NC3, NC5, NC6 and NC4's rules covered by tests; the node levels of C18's table hold.
- [ ] The v25 fixture's heroes get the points step 27's record says.
- [ ] Guard (and policy snapshot if moved) re-recorded in its own commit.
- [ ] `CLAUDE.md` current for every rule and name this step changed.
- [ ] Record: the parity plans' capstone holding at level 14; e2e assertions changed; deviations.
- [ ] Index step 28 status `done (<commits>)`.

## Execution record

**Step 28, 2026-11-14.** From `19b7dcc` (green: 2042 tests). Node 26.13.0.

### What changed

- C17: `TIERS.cost` (1/2/3/4); `perkCost`, `nodesCost` (perks.ts); `Character.perkPoints`; `CREATION_PERK_POINTS`, `perkPointsLeft`, refusal "no perk point is left" (creation.ts); `PERK_POINTS_PER_LEVEL`, `pointsAt`, `canAffordPerk`, `affordableAt`, `XpGain.perkPointsGained`, `levelUp` +1 every level, `takePerk` spends the cost, `canAdvance` asks an affordable available node (progression.ts). progression.ts keeps a private `CREATION_POINTS` (creation.ts imports progression.ts); a test holds `pointsAt(1) === CREATION_PERK_POINTS`. Removed: `PICK_LEVEL_STEP`, `CREATION_PICKS`, `picksAt`, `nextPerkLevel`, `hasPickFor`.
- C18: `autoAdvance` targets the first plan node it qualifies for at a raised level (`qualifiesFor({ ...character, level: max(level, perkLevel) })`, sound as no other ask reads the level, and `qualifiesFor` already checks `cappedAttribute`), else the first non-capstone node it qualifies for now, and stops while `takePerk` refuses it. Plans reordered as C18. Every node level of C18's table holds (`progression.test.ts`, stepwise as `raisedParty`; and `bandits.test.ts` through `banditStats`, which levels at once and then spends once: same nodes). Cutthroat: Backstab 2, Dirty Trick 4, Sprint 5.
- C19: `SAVE_VERSION` 26; `migrateFrom25` (every hero of every party and the reserves) after `migrateFrom22` for 22 and 18 and alone for 23–25; `migrateFrom22` writes no points; `characterOf` asks `perkPoints` to be an integer ≥ 0; `parseSave` accepts 26, 25, 24, 23, 22, 18.
- party.ts: `Aldric reaches level 5: +N max HP, N skill points, 1 perk point, wounds healed` ("2 perk points" for two levels at once).
- Scenes (decision 13): `nodeHint` / `draftNodeHint` with C17's words; `InventoryScene` `canTake` by `canAffordPerk`, `buildPerkStatus` `Perk points: N` (gold while > 0), probes' `perkPicks` read `perkPoints`; `CreationScene` renamed imports only (its header "Picks: N of 3" and `PERKS_RULE` "One more comes with every even level" are now untrue until step 29 rewrites them, as decision 13 says; the tree help text in `InventoryScene` likewise); `debugCommands` `N perk points`.
- CLAUDE.md: the rules of progression, perks, creation and saving, the bandits' node levels, the Skills tab's status, the progression module line.

### Capstone at level 14 by parity plan (`raisedParty`'s loop: `levelUp` then `autoAdvance` a level at a time, the role's hero Aldric/Brenna/Delwyn)

| Role | Plan | Capstone level | Held at 14 |
| --- | --- | --- | --- |
| melee | knight | 15 (Unbreakable) | no |
| melee | swordmaster | 15 (Blademaster) | no |
| melee | spellsword | 14 (Arcane Knight) | yes |
| melee | assassin | 16 (Deathblow) | no |
| melee | paladin | 14 (Aegis) | yes |
| archery | ranger | 12 (Deadeye) | yes |
| archery | rogue_archer | 14 (Shadowdancer) | yes |
| archery | assassin | 16 (Deathblow) | no |
| magic | evoker | 12 (Meteor) | yes |
| magic | cryomancer | 14 (Glacial Prison) | yes |
| magic | arcanist | 14 (Mass Haste) | yes |
| magic | healer | 13 (Revive) | yes |
| magic | saint | 14 (Sanctuary) | yes |
| magic | evoker_healer (reference) | 14 (Meteor) | yes |

Not by 14: knight and swordmaster (15), both assassins (16): step 30's to fix by plan order. (The `rogue` plan, not a parity plan, takes Shadowdancer at 15 from Brenna.)

### Tests

- New or rewritten: `progression.test.ts` (NC1 `pointsAt`, a point a level, NC2 costs and refusals, `canAffordPerk`/`affordableAt`, the invariant for the ready-made heroes and every bandit role to 20, saving (Delwyn keeps Heal All for after Fireball), C18's node levels, bandit nodes at 3/4/5, NC5's stop rule over every plan, plans in full, capstone-first plans); `trees.test.ts` (NC3 for all 12 paths: T2 3, T3 6, second T2 8, capstone 12, 1 banked at 4 and 0 at 12; the level-14 duellist with 4 points takes Deathblow, not Blademaster, and not with 3); `creation.test.ts`, `party.test.ts`, `character.test.ts`, `perks.test.ts`, `perkTree.test.ts` (hints), `bandits.test.ts` (new levels; the crossbow's range 5 at 6 and 7 at 8, Far Shot now at 8); `save.test.ts` (v25 fixture: every node kept, Aldric/Brenna/Delwyn/Garrick 0 and Wren 5, as step 27 recorded; v22: Aldric 3, Delwyn 0, Brenna 0, Garrick 1; v18: 0, 0, 0; v26 round trip; missing, negative, fractional, string or old-named points unreadable; versions 17, 19, 20, 21, 27 unreadable).
- `scripts/simulate.test.ts`: two tests that asserted `!canAdvance` of a hero `autoAdvance` had spent now assert `spentByPlan` (no skill point left and `autoAdvance` would take nothing more), since a saving hero may still afford a tier-1 node elsewhere (design §4.2 accepts the "+" then).
- `worldMap.test.ts`'s characterization hash re-recorded for the field rename alone (the old hash holds with `perkPoints` written back as `perkPicks`).
- Guard (`924a808`): records and hash re-recorded; the five campaigns now end source, fallen, source, source, fallen (3 of 5 beat the Source, as before). Policy snapshot: 5433 → 5648 choices, new hash.
- `npm test`: 2043 passed. `npm run build`: passes. `npm run test:browser`: 10 files, 121 passed.

### e2e assertions changed (economy, not words)

- `e2e/battle.test.ts` `aldricFights`: waits on the points spent by cost (`perkCost`); Taunt test at level 5 (was 4), Pin test at level 8 (was 6).
- `e2e/character.test.ts`: the three-battle journey's level-3 hero has 2 perk points (was 1 pick), Armour Breaker spends both; the Abilities test raises Aldric to 3 (Power Attack's 2) and Delwyn to 5 (Flame Arrow and Heal All, 4), its waits by 2 and 4.

### Grep

`grep -rn -E "perkPicks|picksAt|PICK_LEVEL_STEP|nextPerkLevel|hasPickFor|perksGained|CREATION_PERK_PICKS|perkPicksLeft" src scripts CLAUDE.md` finds the probe field (`testHook.ts`, `InventoryScene.ts`, `CreationScene.ts`), `save.ts`'s migration of the old field and its comments, CLAUDE.md's description of that migration, test assertions that the old field is gone (`save.test.ts`, `progression.test.ts`) or planted in old saves, and the characterization comment in `worldMap.test.ts`; `e2e/` keeps the probe name.

### Deviations

- None from the contracts. Words decision 13 leaves for step 29 (creation's header and rule line, the tree help text) are untrue for now.
