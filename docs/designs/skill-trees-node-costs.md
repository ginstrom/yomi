# Skill trees amendment: nodes that cost perk points

Amends [`skill-trees.md`](skill-trees.md) §4.1, §4.2 (R3, R4), §4.4, §5.8, §5.9 and §7.2. Where the two disagree, this document wins. Feature record: [`docs/features/skill-trees.md`](../features/skill-trees.md).

## 1. Purpose and status

A simulated player found that late picks are too cheap. By level 12 a hero has 9 picks, a capstone needs 5 nodes in its path, and a Ranger simply took all 8 Ranger nodes. Nothing late in the game was a choice. The user asked, in their words:

> "How about a cost system for skills that grows with power. So you get 1 skill point per level up, and at first you are buying a skill per level. Then they go to 2 points, and 3, with progressivley more powerful but costly skills?"

The user also confirmed there is no respec.

This amendment replaces picks with **perk points**. A hero gets one point a level. A node costs 1, 2 or 3 points by its tier, and a capstone costs 4. The tiers, depth, calling and one-capstone rules stay as they are. Only the price of a node changes.

**Status: ready for planning, with three questions for the user (§8.1).** Each question has a recommended answer that the rest of this document assumes. Q1 (does a capstone cost 4 or 3?) changes the figures in §4.3. The other two change only words or a measurement level.

## 2. Requirements and scope

| ID | Requirement |
| --- | --- |
| N1 | A new currency, **perk points**, replaces picks. A hero has 3 at creation and gains 1 at every level up (levels 2, 3, 4, …). It is stored on the character as `perkPoints`. The game's existing **skill points** (Melee, Archery, Magic) are unchanged and stay a separate currency. |
| N2 | Each node costs perk points by its tier: T1 1, T2 2, T3 3, capstone 4. Taking a node spends its cost. A node can be taken only if the hero has the points and qualifies for it. |
| N3 | Tiers keep their level and depth asks. Depth stays a count of nodes held in the path. The calling and the one-capstone rule are unchanged. |
| N4 | Creation spends 3 perk points on tier-1 nodes. In practice creation plays exactly as it does today. |
| N5 | `autoAdvance` spends points by plan. When the next node it wants costs more than it holds, it saves. Plans are reordered to suit the costs. Bandits follow the same rules. |
| N6 | `SAVE_VERSION` rises to 26. Saves of version 23 to 25 (and 22 and 18, through the existing chain) load. Every held node is kept, and the hero gets the points it would have, less what its nodes cost, never fewer than 0. |
| N7 | The tree view shows each node's cost and the perk points the hero holds. The strip states the cost and why a node cannot be afforded. Creation, the Skills tab and the victory screen say "perk points", and never use "pick" or a bare "points". |
| N8 | The manual, `CLAUDE.md`, the e2e tests and the affected screenshots are brought up to date. |
| N9 | Balance is re-measured by the step 24 and 25 method. The cells, the level-4 parity check and the three campaigns land in their bands, or the user accepts the figure. |

**Non-goals.** Respec (the user said no). Per-node price exceptions (§5.1 says why none is needed). Changing the tiers' levels or depths. New nodes or changed node numbers.

## 3. Current system (inspected on `skill-trees`, b488b1c)

- `progression.ts`: `picksAt(level) = 3 + ⌊level/2⌋` (`CREATION_PICKS` 3, `PICK_LEVEL_STEP` 2). `levelUp` adds a pick at even levels. `hasPickFor` checks `perkPicks > 0`. `takePerk` spends one pick. `nextPerkLevel` gives the next even level. `canAdvance` is true when skill points wait, or when a pick waits and some node is available. `XpGain.perksGained`.
- `autoAdvance` takes the first node of the plan the hero qualifies for, else the first non-capstone node in `PERKS` order, while picks remain.
- `trees.ts`: `TIERS` = T1 (level 1, depth 0), T2 (2, 1), T3 (6, 3), capstone (12, 5). `pathDepth` counts nodes, `calling` picks the deepest path, and `capstoneOf` finds a held capstone.
- Paths hold 2 T1, 2 or 3 T2, 2 or 3 T3 and 1 capstone each (95 nodes in all; checked in the code).
- `creation.ts`: `CREATION_PERK_PICKS` 3, `perkPicksLeft = 3 − draft.perks.length`, and `draftCharacter` sets `perkPicks`. Only T1 nodes are open at level 1.
- `save.ts`: `SAVE_VERSION` 25. Versions 25, 24 and 23 load as they are, and 22 and 18 load through `migrateFrom22`, which sets `perkPicks = max(0, picksAt(level) − nodes)`.
- These places show picks to the player: `perkTree.ts` (`nodeHint`: "Click to take", "No pick until level N"), `InventoryScene.buildPerkStatus` ("Choose a node", "N to choose", "Next pick at level N"), `CreationScene` (`PERKS_RULE`, "Picks: N of 3"), `party.ts` `describeRewards` ("a pick", "next pick at level N"), `debugCommands.ts` ("N picks"), and `testHook.ts` (`perkPicks` in two probes).

## 4. Proposed behaviour

### 4.1 The currency and its rate (N1)

| | Today | New |
| --- | --- | --- |
| Name | pick | **perk point** |
| At creation | 3 picks | 3 perk points |
| Per level up | 1 at each even level | **1 at every level** |
| Held by level L | 3 + ⌊L/2⌋ | **L + 2** (`pointsAt(L) = 3 + (L − 1)`) |
| By level 4 / 8 / 12 / 20 | 5 / 7 / 9 / 13 | 6 / 10 / 14 / 22 |

Points left unspent stay on the hero, as picks do today. Saving points is the normal way to buy a higher tier. No node grants perk points. Scholar's "+2 skill points every level" is about skill points and does not change.

### 4.2 What a node costs (N2, N3)

| Tier | Level | Depth in its path | **Cost** |
| --- | --- | --- | --- |
| T1 | 1 | 0 | **1** |
| T2 | 2 | 1 | **2** |
| T3 | 6 | 3 | **3** |
| Capstone ★ | 12 | 5, and the path is the calling; no capstone held | **4** |

This follows the user's request. A T1 costs 1, so early on a level buys a node: there are 24 T1 nodes, two in each path. Going deeper costs 2 and then 3. A capstone costs 4, one more than T3. It is the most powerful node and the last step of "costly as it grows". With 3, a committed hero would have 2 points spare at level 12 and the problem would partly return (§8.1 Q1).

**Depth stays a count of nodes**, not points spent. The tier asks (1, 3, 5), the calling and the path headings ("Ranger 5") keep their meaning and their code. Counting points instead would make two T1s (2 points) equal one T2 for depth. It would also need new tier thresholds, and the calling's ties would read oddly. That buys nothing the costs do not already buy.

**Tier asks are unchanged.** A T2 can be taken at level 2 when a creation point was saved (2 T1s and 1 point banked). Otherwise the first T2 comes at level 3.

**The level-up rule for the "+" on a portrait** is unchanged in spirit. It shows while skill points wait or while some node the hero qualifies for is affordable (`canAdvance`). A hero saving 2 points for a T3 will usually still see the "+", because a T1 elsewhere is affordable. That is accepted: the "+" means "something can be bought", not "you should buy".

### 4.3 Target figures (why late choices get hard and mixing stays viable)

**A committed hero.** Both T1s of its path and one other T1 at creation, then every point into its path:

| Level | Points | Buys | Nodes held | Today |
| --- | --- | --- | --- | --- |
| 1 | 3 | 3 T1 | 3 | 3 |
| 3 | 5 | first T2 | 4 | 4 |
| 4 | 6 | (1 banked) | **4** | **5** |
| 6 | 8 | first T3 | 5 | 6 |
| 8 | 10 | second T2 | **6** | **7** |
| 12 | 14 | **capstone** (depth 5 reached at 8) | **7** | **9** |
| 16 | 18 | another T3 | 8 | 11 |
| 20 | 22 | remaining T2 or T3, or the start of a second path | **10** | **13** |

This hero reaches its first T3 at level 6 and its capstone at level 12, the same levels as today, with nothing to spare. Emptying an 8-node path costs 18 points: 2 + 6 + 6 + 4 for Ranger, Rogue and the others with 2/3/2, and slightly more for a 2/2/3 path. That takes until level **16 or 17**, against 10 to 12 today. So between levels 12 and 20 a hero is still choosing. A T3 costs three levels of income, and finishing the path competes with opening a second one.

**Why mixing stays viable.**

- T1s cost 1 everywhere. Opening a second path (both of its T1s) costs 2 points, the price of one T2. The cheap breadth the user values is still there.
- Depth counts nodes, so a hybrid is never shut out of a capstone. It only reaches it later. Build C (Swordmaster to Assassin) takes Deathblow at **15**, against 12 today.
- A build that never takes a capstone holds the most nodes. At level 20, 6 T1s, 5 T2s and 2 T3s cost exactly 22 points: 13 nodes, as many as today, but smaller ones. Depth pays in power and breadth pays in count. That is a real choice, not a trap.

**The design's example builds under costs** (each pick bought as soon as it can be afforded; §4.4 of the main design):

| Build | Capstone today | Capstone now | Why |
| --- | --- | --- | --- |
| A, Aldric, Heavy Knight (2 Swordmaster T1s at creation) | 12 | **15** | Two points went outside the path at creation |
| B, Delwyn, Evoker with Healer (with the plan of §4.4) | 12 | **14** | Heal at creation and Heal All at 8 are Healer nodes |
| C, Blade to Shadow | 12 | **15** | The hybrid's price |
| D, Battle Cleric (Bless, Smite, Toughness) | 12 | **12** | Committed plus one T1 |

### 4.4 Plans, the ready-made heroes and bandits (N5)

**`autoAdvance` rule.** Spend skill points as today. Then repeat:

1. Find the **target**: the first node of the plan, not yet held, that the hero qualifies for, or would qualify for if only the level were higher (`missingRequirements` lacking nothing but "Level N", and no attribute cap). If there is no such node, the target is the first non-capstone node in `PERKS` order that the hero qualifies for now.
2. If the target is short of the level or of points, **stop and save**. Do not fall through to a cheaper node.
3. Otherwise, take it and repeat.

Without the save in step 2, simulated heroes would spend every point on T1s and never reach a T3. A node short of a depth, a skill, an attribute or a node it requires is skipped, as today, because waiting alone will not open it. A node short only of the level is waited for. Otherwise a cheaper node at level 5 (Heal All, say) would eat the points saved for a T3 at level 6. A capstone-first plan (`pathPlan`) therefore saves for its capstone from the moment depth 5 and the calling are met, and takes it at the first level it can afford it.

**Default plans reordered** (first values, which the re-measurement may move). With costs, a path's first T3 at level 6 needs depth 3, so it must come before any second off-path node:

| Plan | New order (head) | Hero | Effect |
| --- | --- | --- | --- |
| `knight` | rooted, taunt, pin, heavy_hand, iron_skin, **unbreakable**, guardian, shield_wall, … | Aldric: Rooted 3, Taunt 5, Pin 8, Iron Skin 11, Unbreakable 15 | Unbreakable moves ahead of Guardian. Otherwise Guardian's 3 points at 12 would push the capstone to 18. *(Amended by step 30, accepted: Aldric takes Unbreakable at 13, Shield Wall at 9 and Iron Skin at 16.)* |
| `ranger` | aimed_shot, **volley**, far_shot, **deadeye**, hunters_mark, pinning_shot, dodger, … | Brenna: Aimed Shot 3, Volley 6, Far Shot 8, Deadeye 12 | Volley moves ahead of Far Shot. The first T3 stays at 6, and the capstone at 12. |
| `evoker_healer` | flame_arrow, **fireball**, heal_all, pyromancy, meteor, greater_heal, mending, death_cloud, greater_heal_all, purify | Delwyn: Flame Arrow 3, Fireball 6, Heal All 8, Pyromancy 10, Meteor 14 | Fireball stays at 6, as today. Heal All moves from 4 to 8, and Meteor from 12 to 14. *(Amended by step 30, accepted: Delwyn takes Arcane Blood 4, Heal All 6, Fireball 9, Pyromancy 11 and Meteor 15; Aldric's Unbreakable comes at 13, Shield Wall at 9, Iron Skin at 16.)* |
| `swordmaster`, `rogue`, `cryomancer`, `bandit_mage`, path plans | unchanged | | Already ordered by depth. Capstone-first plans are unaffected. |

At the campaign's ready level of 7, each ready-made hero has one node fewer than today:

| Hero | Missing at level 7 |
| --- | --- |
| Aldric | Pin (now at 8) |
| Brenna | Far Shot (now at 8) |
| Delwyn | Heal All (now at 8) |

**Bandits** grow by the same `autoAdvance`, so "a bandit fights as a hero of that draft would" still holds. On today's map (bandit levels 3 to 5), each role has the same nodes as today at levels 3 and 5, and one node fewer at level 4. The plan tests fix the exact levels:

| Role | Today | Now |
| --- | --- | --- |
| Captain | Rooted 2, Taunt 4, Pin 6 | Rooted 3, Taunt 5, Pin 8 |
| Brute | Power Attack 2, Armour Breaker 4, Cleave 6 | 3, 5, 8 |
| Archer, Crossbowman | Aimed Shot 2, Volley 6 | Aimed Shot 3, Volley 6 (the `ranger` plan's new order, §5.3) |
| Hedge-Mage | Flame Arrow 2, Destruction 4, Fireball 6 | 3, 4, 7 |

### 4.5 Creation (N4)

Creation gives 3 perk points, and only T1 nodes (cost 1) are open, so it plays exactly as today. Three nodes can be taken, or fewer, with the rest kept for later. The changes are in the words:

- The header reads `Perk points: N of 3` (was `Picks: N of 3`).
- The rule line reads: *"3 perk points. One more with every level. A node costs 1 to 4 by its tier. Any path, any tree; only your deepest path may open its capstone."* It must fit the strip at 840×560 as today's does. If it does not, drop "Any path, any tree; ".
- A refusal reads "no perk point is left".

### 4.6 UI (N7)

The two currencies are told apart by always naming them in full. The words are **Skill points** (the skills' + buttons) and **Perk points** (the trees). The game never shows "points" or "pick" on its own. A node's cost is also drawn in the node itself, a different place from the skill rows.

- **Tree view, each node.** The node's cost is a digit at its right inner edge. It reserves `NODE_COST_W` (14 px) of the label area, and the label is centred in what is left. The digit is gold while the node is open and affordable, and dim otherwise. A taken node shows ✓ in its place, and a locked capstone ✕. Long names already shrink and wrap (`PerkTreeView`). A test holds every node's label and cost inside `NODE_W` at 840×560.
- **Tree view, header.** `buildPerkStatus` shows `Perk points: N`. It is gold when some open node is affordable on the world map, and dim otherwise or in battle. "Next pick at level N" goes away, because every level brings a point.
- **Strip.**
  - The asks line becomes `Costs 3 perk points. Asks: Level 6, Melee 55%, 3 nodes in Heavy Knight` (`describePerkRequirements`, with the cost in front).
  - For an open node, the hint (`nodeHint`) reads `Click to take (3 of your 4 perk points)` when affordable. Otherwise it reads `Needs 3 perk points; you have 1 (level 9)`. That level is `level + cost − points`, the level at which saving alone affords it.
  - In battle the hint stays `Picks are spent on the world map`, reworded to `Perk points are spent on the world map`.
  - Creation's `draftNodeHint` "No picks left" becomes "No perk points left".
- **Skills tab.** `Skill points: N` stays over the skills column. The perk status beside it reads `Perk points: N`.
- **Victory screen** (`describeRewards`): `Aldric reaches level 5: +6 max HP, 3 skill points, 1 perk point, wounds healed`. "Next pick at level N" is dropped.
- **Debug console** (`party`): `N perk points`.
- **Test hook**: `perkPicks` becomes `perkPoints` in both probes.

### 4.7 Edge cases

- A node the hero qualifies for but cannot afford shows as open (pale lines). Its digit is dim and its hint says how many points it needs. A click does nothing.
- A capstone whose path stops being the calling while the hero saves for it closes, as today. The saved points stay.
- A migrated hero whose nodes cost more than its level gives (§5.4) has 0 points until its level catches up. Its nodes are never taken away.
- Gear or attributes that later fail a node's asks change nothing, as today. Asks gate taking, never keeping.

## 5. Technical design

### 5.1 Data (`src/character/trees.ts`)

`TIERS` gains `cost`:

```ts
export const TIERS: Record<Tier, { level: number; depth: number; cost: number }> = {
  1: { level: 1, depth: 0, cost: 1 },
  2: { level: 2, depth: 1, cost: 2 },
  3: { level: 6, depth: 3, cost: 3 },
  capstone: { level: 12, depth: 5, cost: 4 },
}
```

There is no per-node `cost` field. No node clearly needs an exception:

- The T1 power outliers (Weapon Training, Arcane Blood) must cost 1 for creation to keep working.
- Gain Strength and Scholar are T2s of ordinary size.

If a later tune finds an outlier, an optional `Perk.cost` overriding the tier's is the escape hatch. It is one field read in `perkCost`, and nothing else would change.

### 5.2 Progression (`src/character/progression.ts`, `perks.ts`, `character.ts`)

| Today | New |
| --- | --- |
| `Character.perkPicks` | `Character.perkPoints` |
| `CREATION_PICKS`, `PICK_LEVEL_STEP` | `CREATION_PERK_POINTS` (3, owned by `creation.ts` as today's constant is), `PERK_POINTS_PER_LEVEL` (1) |
| `picksAt(level)` | `pointsAt(level) = CREATION_PERK_POINTS + (level − 1) × PERK_POINTS_PER_LEVEL` |
| | `perkCost(perk) = TIERS[tier].cost` (perks.ts) and `nodesCost(character)`, the sum over the nodes held |
| `hasPickFor(character, perk)` | `canAfford(character, perk): perkPoints ≥ perkCost(perk)` |
| `nextPerkLevel` | removed. `affordableAt(character, perk) = level + max(0, perkCost − perkPoints)` serves the hint. |
| `levelUp`: a pick at even levels | `perkPoints += PERK_POINTS_PER_LEVEL` every level |
| `takePerk`: `perkPicks -= 1` | `perkPoints -= perkCost(perk)`. It refuses when the hero cannot afford the node or does not qualify. |
| `canAdvance`: picks and any available node | skill points, or any available node that `canAfford` |
| `XpGain.perksGained` | `perkPointsGained` |
| `autoAdvance` | the save rule of §4.4 |

**Invariant** (tested): for a hero that was never migrated, `perkPoints + nodesCost(hero) === pointsAt(level)`.

### 5.3 Plans and bandits

- `AUTO_PLANS`: the three reorders of §4.4.
- The Archer and Crossbowman use `ranger`, so its new order gives them Aimed Shot at 3 and Volley at 6, as today, and Far Shot at 8 instead of 4. Volley at 6 matters only at threats 6 and 7, which are off today's map.
- `bandits.ts` changes nothing but its comments. The same-stats test still holds.
- `CLAUDE.md`'s bandit lines ("Rooted at 2, Taunt at 4 and Pin at 6", "Flame Arrow at level 2, Destruction at 4, Fireball at 6, Heal at 8 and Heal All at 10" and the rest) are restated from the plan tests.

### 5.4 Saves (`src/game/save.ts`)

`SAVE_VERSION` rises from 25 to **26**, because `Character` renames and redefines a field.

**`migrateFrom25`** handles saves of versions 23, 24 and 25, and runs after `migrateFrom22` for versions 22 and 18. For every hero in every party and in the reserves:

1. Keep every held node. There is no refund: a refund would be a forced respec, which the user ruled out, and a grandfathered capstone would then be lost.
2. `perkPoints = max(0, pointsAt(level) − nodesCost(hero))`.
3. Delete `perkPicks`.

`migrateFrom22` is left as it is (it writes `perkPicks`). The chain then recomputes the points. A saved battle needs nothing, because `UnitRecord` does not change and units fight with the stats they were saved with. `parseSave` accepts `[26, 25, 24, 23, 22, 18]`, and the rest of the save is checked as strictly as a current save.

Example: today's level-12 Brenna holds 9 nodes (3 T1, 3 T2, 2 T3, Deadeye) costing 19 points, against 14. She keeps all 9 and gets 0 points until level 17.

**Fixture.** Capture `src/game/fixtures/save-v25.json` before the change, from a level-12 company (as step 01 captured v22). It should include one hero over budget and one under budget. The comment over `SAVE_VERSION` and the save rules in `CLAUDE.md` gain the version-26 line.

### 5.5 Scenes

- `perkTree.ts` (Phaser-free, tested):
  - `nodeHint`, `draftNodeHint` and the new `costTone(character, perk)` (gold, dim or none for taken or locked);
  - the cost in the asks line, done in `describePerkRequirements` or in a `nodeAsks` wrapper (the planner's choice);
  - `NODE_COST_W`.
- `PerkTreeView.ts`: draws the digit.
- `InventoryScene.buildPerkStatus`, `CreationScene` (the header, `PERKS_RULE`), `party.ts` (`describeRewards`), `debugCommands.ts` and `testHook.ts`: the words of §4.6.

### 5.6 Files affected (proposed)

| Area | Files |
| --- | --- |
| Domain | `src/character/trees.ts`, `perks.ts`, `progression.ts`, `creation.ts`, `character.ts` |
| Game | `src/game/save.ts`, `fixtures/save-v25.json` (new), `party.ts`, `bandits.ts` (comments only) |
| Scenes | `perkTree.ts`, `PerkTreeView.ts`, `InventoryScene.ts`, `CreationScene.ts`, `debugCommands.ts`, `src/testHook.ts` |
| Simulator | `scripts/simulate.test.ts` (guard re-recorded); `simulate.ts` has no reference to picks |
| Docs and tests | the main design's link, `docs/manual/README.md` and its images, `CLAUDE.md`, `e2e/character.test.ts`, `e2e/party.test.ts`, `e2e/battle.test.ts` (wherever picks are asserted), `e2e/manual.shots.ts` |

### 5.7 The manual (N8)

- Chapter 3's "Picks, perks and spells" becomes "Perk points, perks and spells". It gets the new rule line, and one sentence: a node costs its tier's points (1, 2, 3, a capstone 4), and unspent points are kept.
- Each new level brings "1 **perk point**", and the "Next pick at level N" clause is removed.
- "Building a hero" gains the cost table (tier, level, depth, cost) and a sentence:

  > "Points you save buy deeper nodes; a hero who stays in one path reaches its tier 3 at level 6 and its capstone at 12, and one who mixes paths holds more nodes but reaches a capstone later."

- The tree-view paragraph says what the digit on a node means.
- Retake `creation-perks.png`, `creation-spells.png`, `panel-level-up.png` and every image of the tree view.

## 6. Consequences

- **Balance moves down.**
  - Heroes hold one node fewer from level 4, and two fewer at 12.
  - Their second and third T3s and some capstones come later: Aldric's capstone moves from 12 to 15, and Delwyn's Meteor from 12 to 14.
  - At the ready level of 7, the ready-made party lacks Pin, Far Shot and Heal All.
  - Bandits lose a node at level 4 only.
  - Expect the one-party campaign (243 now) and the company (243) to fall, perhaps below their bands (215–250, 220–260). The size of the fall is unknown until measured. No prototype was run.
- **Lever direction** follows the user's stage-4 decision ("keep skills punchy; tougher foes"), applied in reverse. If heroes are now too weak, ease the foes rather than trimming or inflating nodes. The costs (1/2/3/4) and the rate (3 + 1 a level) are the user's decision and are not levers without asking.
- **`--ready-level 10`** (445, over its band by the user's acceptance) is expected to fall toward the band. That is welcome.
- **Guard and policy snapshot.** The guard fixture and the policy snapshot are re-recorded. Bandits and heroes hold different nodes, so their choices change.
- **No engine, event or log-schema change.** `LOG_SCHEMA_VERSION` stays at 26.
- **Rollback.** Saves move forward only, as ever.

## 7. Verification

### 7.1 Tests

- **`progression.test.ts`:**
  - `pointsAt` gives 3, 4, 6, 10, 14 and 22 at levels 1, 2, 4, 8, 12 and 20.
  - `levelUp` adds 1 every level.
  - `takePerk` spends the tier's cost and refuses when the hero cannot afford the node.
  - The invariant of §5.2.
  - `autoAdvance` saves for a target that is short of the level or of points, rather than falling through. Delwyn does not buy Heal All at level 5 while saving for Fireball.
  - The ready-made heroes' node levels of §4.4: Brenna holds Deadeye at 12, Delwyn Meteor at 14 and Aldric Unbreakable at 15, each raised by `raisedParty`.
  - Each bandit role's nodes at levels 3, 4 and 5.
- **`trees.test.ts`** (replaces AC1): a hero with both T1s of a path and one other T1 at creation reaches the path's T3 at level 6 and its capstone at level 12 when it spends every point in the path, and not at 11. AC2 (Deathblow and Blademaster at level 14) still holds with a hero that has the points.
- **`creation.test.ts`:**
  - A draft spends at most 3 perk points.
  - The pre-rolls are legal.
  - `perkPointsLeft` is right.
  - The refusal words.
- **`save.test.ts`:**
  - `save-v25.json` loads with every node kept and points by §5.4: the over-budget hero has 0, and the under-budget hero has `pointsAt − nodesCost`.
  - `save-v22.json` and `save-v18.json` load through the chain with the same rule.
  - A v26 round trip.
- **`perkTree.test.ts`:**
  - Every node's label and cost digit fit within `NODE_W`.
  - The hint wording, affordable or short ("level N").
  - `costTone`.
  - The asks line's cost.
- **`party.test.ts`**: the victory line.
- **Browser** (`npm run test:browser`):
  - Creation shows "Perk points: 3 of 3".
  - On the world map, a level-2 hero with 1 point cannot take a T2. The hint says it needs 2, and the hero takes it after the next level.
  - The tree shows the cost digits.
  - Existing tests that assert picks are reworded.

### 7.2 Re-measurement (N9), by the step 24 and 25 method

Seed 1, 500 each, one run at a time, with Node 26 (`PATH=$HOME/.nvm/versions/node/v26.13.0/bin:$PATH`). Outputs go to `logs/<step>-<name>.{jsonl,txt}`, with the commands of step 24's measurement procedure.

1. **Baseline** on b488b1c (the code before this amendment). Re-run the cells and campaigns below, so that the comparison is like for like. Expected: step 25's finals.
2. **First measurement** with the economy and the plan reorders, before any tuning.
3. **Cells**, a party of the threat's level:

| Cell | Band | Step 25 final |
| --- | --- | --- |
| GR3 | ≥ 470 | 500 |
| BC3 | 400–470 | 455 |
| BC4 | 430–490 | 462 |
| BC5 | 420–490 | 484 |
| SN5 | 410–480 | 448 |
| SP5 | 410–480 | 454 |
| TL5 | report only | 0 |
| SG7 | 0 ± 40 | 0 |
| SG10 | above 2 | 5 |
| F1, F2, F3 | nearly all, most, 7 in 10 | 500, 500, 453 |

4. **Parity at level 4** (the user's test): Bandit Camp threat 4, each plan in its role's slot through `--plans`, each within ±50 of its role's best. `rogue_archer` is reported only, as the user decided.
5. **Capstone cell**: Bandit Camp threat 7, each path's capstone plan, reported against the role's best, at **level 14**. That is the lowest level at which every parity plan's hero holds its capstone under costs (§8.1 Q3). A unit test confirms it with `raisedParty`.
6. **Campaigns:**

| Run | Band | Step 25 final |
| --- | --- | --- |
| one party (`--parties 1`) | 215–250 | 243 |
| default company | 220–260 | 243 |
| `--ready-level 10` | 370–420 | 445 (accepted over) |
| deaths, one party | ≤ 2.0 | 1.0 |
| days, one party | 243–297 | 287 |

7. **The loop**: one lever at a time, the cells it touches, then the campaigns. Log each run (the lever, its value, the figures, kept or reverted). The levers, in order:
   1. **Plan order** (which nodes the simulated heroes and bandits save for).
   2. **Foes back toward step 24's starting point**: `banditGear` (Fine at threats 3 and 4 back to plain), then `FOE_HP_PER_LEVEL` (1.3 down toward 1.0, judged by F3 and SP5), then the Spider Nest's count.
   3. **Tier levels** (`TIERS` levels and depths), only if the first two cannot reach the bands.

   Costs and the point rate are **not** levers: report a decision if only they could close the gap.
8. **Stop** when the cells, parity at level 4 and the campaigns are in band, or the user accepts a figure. `CLAUDE.md`'s rules of scaling, progression and perks are then restated with the new figures, and the feature record's verification section gains an "Amendment" table like stage 4's.

### 7.3 Acceptance criteria

| ID | Criterion |
| --- | --- |
| NC1 (N1) | A new hero has 3 perk points. Each level adds exactly 1. `pointsAt(4, 8, 12, 20)` = 6, 10, 14, 22. |
| NC2 (N2) | Taking a T1, T2, T3 or capstone spends 1, 2, 3 or 4. A node the hero cannot afford cannot be taken by click, `takePerk` or `autoAdvance`. |
| NC3 (N3) | A hero with both T1s of a path and one other T1 at creation, then every point in that path, takes the T3 at level 6 and the capstone at level 12, and not earlier. A level-14 hero holding 5 Swordmaster and 6 Assassin nodes, and given 4 points, can take Deathblow and not Blademaster. |
| NC4 (N4) | Creation shows "Perk points: 3 of 3", allows three T1s and plays as before. The pre-rolls are legal. |
| NC5 (N5) | `autoAdvance` never spends below the cost of the plan's next open node. Brenna holds Deadeye at 12, Delwyn Meteor at 14 and Aldric Unbreakable at 15. The bandit-built hero and the bandit still have equal stats. *(Amended by step 30, accepted by the user: Delwyn's Meteor at 15 and Aldric's Unbreakable at 13, deliberate plan-order changes; Brenna's Deadeye stays at 12.)* |
| NC6 (N6) | The v25, v22 and v18 fixtures load with every held node kept and `perkPoints = max(0, pointsAt(level) − nodesCost)`. `SAVE_VERSION` is 26. |
| NC7 (N7) | In the browser at 840×560, every node shows its cost inside its frame. The status reads "Perk points: N". An unaffordable open node's hint names the points it needs and the level. No screen says "pick". |
| NC8 (N8) | The manual describes perk points and costs, and its screenshots are retaken. `CLAUDE.md` is current, with no `picksAt`, `perkPicks` or "pick at every even level" left. |
| NC9 (N9) | The cells, level-4 parity and the three campaigns are in their bands, or the user has accepted the figure. `npm test`, `npm run test:browser` and `npm run build` pass. |

## 8. Open questions and assumptions

### 8.1 For the user (each with a recommendation the document assumes)

| # | Question | Options | Recommendation |
| --- | --- | --- | --- |
| Q1 | What does a capstone cost? | (a) 4; (b) 3, the highest of the user's "1, 2, 3" | **(a) 4.** With 4, a committed hero (plus one off-path T1) takes its capstone at exactly level 12 with nothing spare. With 3 it has 2 points spare at 12, enough for a T2 on top, and the "everything by 12" problem partly returns. Mixing at 3 would bring build C's capstone to 14 instead of 15. |
| Q2 | What is the new currency called? | (a) **perk points**; (b) talent points; (c) tree points | **(a).** The nodes are "perks" in the manual ("Picks, perks and spells") and in the code (`perks`, `takePerk`). "Talent" would be a third word for the same thing. The UI always writes "Perk points" and "Skill points" in full (§4.6). |
| Q3 | At which level is the capstone parity cell judged? | (a) level 14, where every parity plan holds its capstone; (b) level 12, as decided before costs; (c) drop it | **(a).** At 12 under costs, only plans whose hero's creation picks lie in the path hold their capstone. The others would measure a capstone they lack. |

### 8.2 Assumptions (settled here)

- **Creation keeps 3** (perk points, all spent on T1s). Read literally, "1 skill point per level up" covers level-ups, not creation, so creation plays as today.
- **A point comes at every level up, level 2 included.** The user said so.
- **Held nodes are kept on migration, with no refund.** This follows the no-respec decision and the precedent of `migrateFrom22`.
- **`autoAdvance` saves for the plan's next open node.** Without that, simulated heroes would never buy a T3 and the simulator would misjudge the economy.
- **No per-node cost exceptions** (§5.1).
- **The "+" on a portrait shows whenever something is affordable**, even while a player saves (§4.2).
- **Lever direction under weakness**: ease foes before touching nodes, following the user's stage-4 decision. Costs and the rate are not levers.

### 8.3 Risks

- **The campaign may fall well below its band.** One fewer node at levels 4 to 11 is a smaller change than stage 1's (which added picks), but the size is unmeasured. If easing the foes back to step 24's start (plain bandit gear at threats 3 and 4, `FOE_HP_PER_LEVEL` 1.0) does not reach the band, the remaining choices are the user's:
  - accept the figure;
  - creation points 4;
  - T2 at a cost of 1 below level 6.
- **Plan order now matters more** (a capstone can move by 3 levels). Plans are tested to their node levels, so a reorder is a deliberate, visible change.
- **The "+" may read as a nag** for players who save points. A later polish could show it only when an affordable node lies in a path the hero has entered.
