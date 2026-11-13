# Step 06: The tree view in the panel and in creation

[Plan index](index.md) · [Design](../../designs/skill-trees.md) (R11, AC9; §4.6, §5.6) · [Feature record](../../features/skill-trees.md)

**Difficulty:** opus. Leave the engineer's and the reviewer's model unset. This step lays out a new view in a fixed 720×500 panel and in creation, with layout judgement (two-line labels, the strip, no overlap at 840×560), and restores the in-browser tests step 03 left failing.

## 1. Objective

The tree view shows the four skill trees, one tab each (Warrior, Scout, Mage, Cleric), three path columns per tree, with tier bands, a stripe for each node's kind, a capstone's double gold frame and star, `requires` lines, path headings with their depth (the calling's in gold), and a three-line strip for the hovered node. It is drawn by the character panel on the world map (P from the Skills tab) and by creation's perks step, which loses its Perks/Spells switch for the four tabs and lets only T1 nodes be clicked. The view draws whatever nodes `PERKS` holds (57 now, 95 by step 21) with no change to its code. The in-browser tests are green again, rewritten for the four tabs (AC9).

Play is unchanged: the refactor guard stays green.

## 2. Requirements and context

- **R11:** the character panel and character creation show the trees: one tab per tree, three path columns each. (The Skills/Abilities tab rename and the hero's title are step 07's.)
- **AC9 (R11):** the tree view shows four tree tabs and three path columns with no overlap at 840×560. A node's strip shows its kind, cost, effect, what it asks and why it is closed.
- **Design §4.6, creation:** the perks step shows the tree view with four tree tabs. Only T1 nodes can be clicked (level 1). A click takes a node and clicking again gives it back, as today. The rule line reads exactly: **"3 picks. One more comes with every level. Any path, any tree; only your deepest path may open its capstone."**
- **Design §4.6, world map:** the Skills tab's tree button (P) opens the tree view; a click on an open node takes it (spending a pick); Esc steps back to the Skills tab.
- **Design §4.7:** "An odd level brings no pick" — the view's pick counter shows the picks left; "Next pick at level N" is step 07's text on the tabs, but the view's hint for a hero with no pick may use `nextPerkLevel`.

### Layout (design §5.6, restated)

Drawn inside the 720×500 panel at the same y as today's perk tree:

```
y 75   [Warrior][Scout][Mage][Cleric]        5 picks          [Back]
y 100  Swordmaster  6        Heavy Knight  2       Spellsword  0      <- headings; calling in gold
y 131  |Weapon Training  |  |Toughness       |   |Arcane Blood    |
 ...   (rows of 31 px; 8 node rows)
y 441  strip: "Pin (Heavy Knight, mana): 3 mana, weapon AP+1 ... "
       "Asks: Level 6, Melee 55%, 3 nodes in Heavy Knight"      "Click to take"
```

- Three columns, each **226 px** wide, with nodes **214 px** wide, from `TREE_X` **20**. Rows of 31 px (`TREE_ROW_H`, existing). Row 0 of `treeLayout` is the path's heading (y 100); node rows from y 131.
- **Headings:** the path's name and the hero's depth in it (`pathDepth`); a calling path's heading (`calling`) is drawn in gold. In creation the depth is the draft's.
- **Tier bands:** faint rules between rows where the tier changes, labelled "L1", "L2", "L6" and "L12" in the left gutter (`tierBands(tree)`). Of the panel's eleven rows, two are left free for the bigger nodes' two-line labels.
- **Kind stripe** on a node's left edge (`nodeKind`): passive dim gold `0x8a7a5a`, at-will amber `0xd09a3c`, mana and spell blue `0x5a8ee0`.
- **Capstone:** a double gold frame and a ★ before its name.
- **`requires` line:** drawn down the column's left gutter from the parent node to the child (`TreeNode.from`).
- **Tree tabs:** `PanelButton`-styled, at y 75 left; the picks counter beside them; Back at the right. Keys **1 to 4** switch trees while the view is open.
- **Strip, three lines:**
  1. Title, path and kind, then the effect. For an active the effect includes its cost and AP; a weapon-relative cost (wAP) is shown as the number for the current weapon, for example "6 AP (weapon + 1)". (No actives exist before step 13; build the wording from the node's spell or ability data so it needs no change then. A spell shows its mana and `spellApCost`.)
  2. "Asks: …" (`describePerkRequirements` / `missingRequirements` words).
  3. The hint (`nodeHint` / `draftNodeHint`: "Click to take", "Closed: your deepest path is Assassin", "Closed: you hold Deathblow", …).
- `PerkTreeView.nodeCentres(tree)` keeps its shape (`Array<Point & { perk: PerkId }>`) for the probes, now taking a `TreeId`.

### Decisions from the index (unchanged)

- **3. Between steps of a stage the game may be rough, never broken.** Step 03 changes the tree data before step 06 redraws the tree view: until 06, the panel's and creation's old two-way switch shows the Warrior tree ("Perks") and the Mage tree ("Spells") laid out by the new helper. In-browser tests that fail only because of that interim view are listed in step 03's record and restored by step 06; no other in-browser test may fail at any step.

### Contracts (copied unchanged from the index)

**C1. Trees and paths (step 03; consumed by 04–07, 13, 21, 23)**

```ts
// src/character/trees.ts (new)
export const TREE_IDS = ['warrior', 'scout', 'mage', 'cleric'] as const
export type TreeId = (typeof TREE_IDS)[number]
export const PATH_IDS = ['swordmaster', 'heavy_knight', 'spellsword', 'ranger', 'rogue', 'assassin',
  'evoker', 'cryomancer', 'arcanist', 'healer', 'paladin', 'saint'] as const
export type PathId = (typeof PATH_IDS)[number]
export interface PathInfo { name: string; tree: TreeId; colour: number }
export const PATHS: Record<PathId, PathInfo>          // names: 'Swordmaster', 'Heavy Knight', ...; three per tree in PATH_IDS order
export const TREES: Record<TreeId, { name: string }>  // 'Warrior', 'Scout', 'Mage', 'Cleric'
export type Tier = 1 | 2 | 3 | 'capstone'
export const TIERS: Record<Tier, { level: number; depth: number }>
  // 1: { level: 1, depth: 0 }, 2: { level: 2, depth: 1 }, 3: { level: 6, depth: 3 }, capstone: { level: 12, depth: 5 }
export const MANA_PER_TREE_NODE = 2                  // a node in the Mage or Cleric tree
export function pathsOf(tree: TreeId): PathId[]
export function pathDepth(character: Pick<Character, 'perks'>, path: PathId): number   // nodes held in the path
export function calling(character: Pick<Character, 'perks'>): PathId[]                // the deepest path(s), ties all; [] with no nodes
export function capstoneOf(character: Pick<Character, 'perks'>): PerkId | null
export function treeNodes(character: Pick<Character, 'perks'>, tree: TreeId): number  // nodes held in the tree's paths
```

`trees.ts` and `perks.ts` import each other; neither calls the other as its module loads.

**C2. Nodes (step 03; consumed by every later step)**

```ts
// src/character/perks.ts
export interface Perk {
  name: string
  description: string          // what works in its stage (decision 1)
  path: PathId
  tier: Tier
  attributes?: Partial<Attributes>
  skills?: Partial<Record<SkillId, number>>
  anySkill?: Partial<Record<SkillId, number>>   // any one suffices: "Melee 40% or Archery 40%"
  requires?: PerkId                              // a node of its own path
  effects: PerkEffects
  meleeOnHit?: readonly OnHit[]                  // added to CombatantStats.onHit while the main hand is melee or bare (Sacred Weapon, Arcane Knight)
  spell?: HeroSpellId
  ability?: AbilityId          // step 13 on
  trait?: TraitId              // step 11 on
}
// PerkEffects keeps every existing key but xpPercent, and gains:
//   resistance, wardAll, wardBlight, shieldAc,
//   spellDamage, fireSpellDamage, frostSpellDamage, healBonus,
//   hostileExtend, friendlyExtend, friendlyRange, spellApDiscount, healApDiscount,
//   imbueDamage, manaOnHit, manaRegen,
//   opportunityToHit, opportunityDamage, rearToHit, rearDamage, movedToHit,
//   executeDamage, critDamage
export function perkLevel(perk: PerkId): number                 // TIERS[PERKS[perk].tier].level
export type NodeKind = 'passive' | 'at-will' | 'mana' | 'spell'
export function nodeKind(perk: PerkId): NodeKind                // spell if `spell`; mana if its ability has manaCost; at-will if `ability`; else passive
export function perkTeaching(spell: HeroSpellId): PerkId | null // replaces spellPerkOf
export function knownSpells(character: Character): HeroSpellId[]       // unchanged
export function knownAbilities(character: Character): AbilityId[]      // step 09 on; ABILITY_IDS order
export function traitsOf(character: Character): TraitId[]              // step 11 on; TRAIT_IDS order
// unchanged in kind: perkRanks (0 or 1), perkBonus, attributeLevel, attributesOf, perkParent,
//   cappedAttribute, missingRequirements, qualifiesFor, availablePerks, describePerkRequirements
// removed: SPELL_TIERS, spellPerk, gain, TRUNK_PERKS, isSpellPerk, SPELL_PERK_IDS, spellPerkOf, Perk.ranks/level/branch/school
```

`missingRequirements(character, perk)` words, in this order: "Level N"; attributes ("Strength 6"); skills ("Melee 40%"); `anySkill` ("Melee 40% or Archery 40%"); `requires` ("Magic Arrow"); depth ("3 nodes in Heavy Knight", only when the tier's depth > 0); for a capstone "Heavy Knight must be your deepest path" and "Only one capstone" (`capstoneOf` non-null). A held node is not qualified for (one rank). `describePerkRequirements` words the same asks for a node out of context.

**C9. The tree-view helper (step 03; consumed by 06, 07)**

```ts
// src/scenes/perkTree.ts
export interface TreeNode { perk: PerkId; column: number; row: number; from: PerkId | null }
  // column: the path's index within its tree (0–2); row 0 is the path's heading, nodes from row 1 in PERKS order; from: `requires`
export function treeLayout(tree: TreeId): TreeNode[]
export type NodeState = 'taken' | 'open' | 'closed' | 'locked'   // locked: a capstone closed by the calling rule or another capstone
export function nodeState(character: Character, perk: PerkId): NodeState
export function nodeHint(character: Character, perk: PerkId): string   // lock words: "Closed: your deepest path is Assassin", "Closed: you hold Deathblow"
export function draftNodeHint(draft: CharacterDraft, perk: PerkId): string
export function tierBands(tree: TreeId): { tier: Tier; label: 'L1' | 'L2' | 'L6' | 'L12'; firstRow: number }[]
```

Existing exports of the same names keep their callers' shapes where they exist; `perkTreeLayout(kind)` and `TreeKind` are removed.

### Shared constraints (from the index)

- **Environment.** The system Node is 22; Node 26 is at `~/.nvm/versions/node/v26.13.0/bin`. Prefix every npm or node command with `PATH=$HOME/.nvm/versions/node/v26.13.0/bin:$PATH`. Podman is also available for the `Makefile` targets (`make test`, `make test-browser`).
- **Commands:** `npm test` (`tsc && vitest run`) is the gate before the commit; `npx vitest run <file>` for one file; `npm run test:browser` (or `-- -t <name>`) after this step's scene changes — read `e2e/CLAUDE.md` before changing an in-browser test.
- **The refactor guard** (`scripts/simulate.test.ts`, `describe('the refactor guard')`). This step changes no play: **keep the fixture green unchanged** (decision 2). A mismatch is a bug.
- **Domain first.** Scenes decide nothing; what a node shows and whether it can be taken come from `perkTree.ts`, `perks.ts` and `trees.ts`. Phaser-free helpers in `src/scenes/` stay free of runtime Phaser imports. A control a test needs goes in the scene's probe (`src/testHook.ts`), as plain data; game code never reads the hook.
- **A node is data.** The view places any node `PERKS` holds with no new code: no list of node ids in the view.
- **`tsc` is the linter** (`noUnusedLocals`, `noUnusedParameters`, `erasableSyntaxOnly`, `verbatimModuleSyntax`, `.ts` extensions).
- **A scene that redraws itself** (`Inventory`, `Creation`) does so on the next tick; its new buttons take clicks only from the frame after.
- **Commits.** One commit for this step once `npm test` and `npm run test:browser` pass, on `skill-trees`, without pushing. Never switch branches. Message "Skill trees step 06: the tree view in the panel and in creation". No attribution lines.
- **Docs.** `CLAUDE.md` stays current: fix the lines this change makes wrong (the `PerkTreeView.ts` and `perkTree.ts` lines, the scene layer's description of `Creation`'s perks step and the panel's perk/spell tree, "The perk tree has room for 3 columns and 11 rows… every place a perk could hang is taken"), and search it for every name renamed or removed (`TreeKind`, `perkTreeLayout`, `TREE_SWITCH`, "spell tree"). Update the manual's text for the screens this step changes (`docs/manual/README.md` §2 "Creating a character", the perks step; §4 "The character panel", the tree view). Screenshots are retaken in step 26.

## 3. Dependencies and prerequisites

- **Step 03 (done first)** provides C1, C2 and C9: `trees.ts`, the new `Perk`, the 57 stage-1 nodes, and `perkTree.ts`'s `treeLayout`, `nodeState` (with `'locked'`), `nodeHint`, `draftNodeHint`, `tierBands`. It also wired the old two-way switch to the Warrior and Mage trees (decision 3) and **listed in its execution record the in-browser tests that fail because of the interim view**: read that list first; this step makes every one of them pass again.
- **Step 04 (done before, by table order)** provides `spellApCost` (C7) for the strip's spell AP; use it if present.
- **Existing code at `50fb4cf`, for reference** (step 03 may have changed some):
  - `src/scenes/PerkTreeView.ts`: `TREE_X` 20, `TREE_ROW_H` 31, `TREE_STRIP_Y`, `PERK_TREE_W`, `PerkTreeOptions`, `PerkTreeView` with `static nodeCentres(tree)`; a precomputed `TREES` record of both layouts; a three-text strip.
  - `src/scenes/InventoryScene.ts`: `PanelTab` (`'character' | 'skills' | 'spells' | 'inventory' | 'perkTree' | 'spellTree'`), `TREE_OF`, `treeContent`, `spellTreeContent`, keys P and K, `TREE_BUTTON` ("Perk Tree") on the Skills tab and `SPELL_TREE_BUTTON` ("Spell Tree") on the Spells tab, probe `perkTreeButton`, `spellTreeButton`, `perks`.
  - `src/scenes/CreationScene.ts`: `TREE_SWITCH: Record<TreeKind, Rect>`, `this.tree`, `showTree`, probe `tree`, `treeSwitch: { perks, spells }`, `perks` (node centres).
  - `src/testHook.ts`: `CreationProbe.tree`, `treeSwitch`; `InventoryProbe.tab`, `perkTreeButton`, `spellTreeButton`, `perks`.
  - `e2e/character.test.ts`: "lists only the perks a hero has taken, and shows them all in the perk tree" (line ~321), "takes a perk from the tree with the pick that the third level brings" (~446, which step 03 should already have moved to the pick at level 2); `e2e/party.test.ts`: "removes a member and creates one in its place through all four steps…" (~125), "fits the least window…" (~286); `e2e/manual.shots.ts` (screens of the trees).

## 4. Scope and implementation guidance

### 4.1 `perkTree.ts` (helper, Phaser-free)

Add only what the view needs and C9 lacks, with tests in `src/scenes/perkTree.test.ts`, for example:
- the heading of a column: the path, its depth for a character or a draft, and whether it is a calling;
- the strip's first line for a node: "Title (Path, kind): effect", with an active's cost and AP (a spell's mana and `spellApCost`; a weapon-relative ability as "N AP (weapon + n)" from the character's current weapon, written now from `Ability.weaponAp` if present so step 13 needs no change);
- whether a node can be clicked in creation (T1 only, and the draft's own rule of give-back).
Keep C9's exported names and shapes; anything new is additive.

### 4.2 `PerkTreeView.ts`

- Replace the two precomputed layouts with one per `TreeId` (`treeLayout`), computed on demand or for all four.
- Draw: headings (row 0), tier band rules and gutter labels (`tierBands`), node frames with the kind stripe, capstones' double gold frame and ★, `requires` lines in the left gutter, the three-line strip.
- Tree tabs (`PanelButton` style) and keys 1–4 belong to the view or are passed in by its owner; one implementation serves both the panel and creation.
- `static nodeCentres(tree: TreeId)` keeps its return shape.
- No node id appears in the view's code; any number of nodes per column up to the rows available is placed, the bigger labels wrapping to two lines.

### 4.3 `InventoryScene.ts` (the panel, world map and battle)

- P on the Skills tab opens the four-tab view (on the Warrior tab, or the tree of the hero's calling); Esc or Back returns to the Skills tab; keys 1–4 switch trees while it is open.
- The panel tab rename (Spells → Abilities, `perkTree` → `trees`, K dropped) is **step 07's**. Here keep `PanelTab` as it is and make both `perkTree` and `spellTree` show the one four-tab view (`spellTree` opening on the Mage tab), so step 07 only renames. Remove the separate spell-tree drawing (`spellTreeContent`'s tree).
- In battle the view is shown only, as today (nodes not takeable).

### 4.4 `CreationScene.ts` (perks step)

- `TREE_SWITCH` and the Perks/Spells switch go; the four tree tabs and keys 1–4 take their place.
- The rule line reads "3 picks. One more comes with every level. Any path, any tree; only your deepest path may open its capstone."
- Only T1 nodes respond to a click; a click takes a node and a second click gives it back (`togglePerk`, `pruneDraft` unchanged in kind); the strip says why another node is closed.

### 4.5 `src/testHook.ts`

- `CreationProbe`: `tree: TreeId`; `trees: Record<TreeId, ButtonProbe>` replaces `treeSwitch`; `perks` lists the nodes of the tree shown.
- `InventoryProbe`: add `trees: Record<TreeId, ButtonProbe>` and the tree shown (`tree: TreeId`); `perks` lists the nodes of the tree shown; keep `perkTreeButton` (step 07 renames it).

### 4.6 In-browser tests

- **Restore** every test step 03 listed as failing.
- `e2e/character.test.ts`: rewrite "lists only the perks a hero has taken, and shows them all in the perk tree": switching through the four tabs (by click and by keys 1–4), every node of `PERKS` appears exactly once across the four trees (57 at this step; write the count from `PERK_IDS.length` so steps 13 and 21 need no edit), centres are distinct within each tree, and at **840×560** no two nodes' rectangles overlap and every node lies within the panel (AC9). Take a node on the world map with a pick.
- `e2e/party.test.ts`: creation picks across two tree tabs (for example Weapon Training on Warrior, then Keen Eye on Scout), a T2 node refusing a click, and a pick given back; the least-window test fits the four tabs.
- `e2e/manual.shots.ts`: point its tree shots at the new probes so step 26 can run it (no need to retake screenshots now).

### 4.7 Exclusions

- The panel tab rename, `heroTitle`, "Next pick at level N" (step 07).
- Actives' rows and the battle's Skills menu (step 14).
- No change to rules, data or `PERKS`.

## 5. Verification

### Tests (in `npm test`)

- `src/scenes/perkTree.test.ts`: for each `TreeId`, no two nodes share a (column, row); every node's rectangle (`TREE_X` + column × 226, width 214) ends within 720 px; headings at row 0; tier bands labelled L1/L2/L6/L12 in tier order; the strip's first line for a passive, a spell (mana, AP) and a capstone; the lock hints for a capstone closed by the calling rule and by another capstone; creation clicks only on T1.
- `src/scenes/*Scene.test.ts` smoke tests (`InventoryScene`, `CreationScene`) still pass.
- The refactor guard green, unchanged.

### In-browser (`npm run test:browser`)

- All in-browser tests pass, including those step 03 listed and the rewritten ones of §4.6.

### Commands

```sh
export PATH=$HOME/.nvm/versions/node/v26.13.0/bin:$PATH
npx vitest run src/scenes/perkTree.test.ts
npm test
npm run test:browser
```

### Acceptance

- AC9: four tree tabs, three path columns, no overlap at 840×560; the strip shows kind, cost, effect, asks and why a node is closed.
- Creation: only T1 nodes clickable; the rule line as quoted; picks across tabs.
- World map: P opens the view; a node is taken with a pick; Esc returns to Skills.

## 6. Completion criteria

- [x] `PerkTreeView` draws the four-tab view for any node count; the panel and creation use it.
- [x] `TREE_SWITCH` gone; creation's rule line and T1-only clicks.
- [x] Probes updated in `src/testHook.ts`.
- [x] `perkTree.test.ts` covers the layout, strip and hints; `npm test` passes; guard green and unchanged.
- [x] `npm run test:browser` passes, step 03's interim failures restored.
- [x] `CLAUDE.md` and the manual's §2 and §4 text updated.
- [x] Committed as "Skill trees step 06: the tree view in the panel and in creation"; the index's row set to `done (<commit>)`.

## 7. Execution record


**Done.** Commands (Node 26): `npx vitest run src/scenes/perkTree.test.ts` 24 green; `npm test` 85 files, 1602 tests green (the refactor guard green and unchanged); `npm run build` green; `npm run test:browser` full run 113 of 115, the two failures being stale mana figures (below), fixed and then `npm run test:browser -- e2e/battle.test.ts e2e/character.test.ts e2e/party.test.ts` 30 of 30. No simulator run.

**What was built.** `perkTree.ts`: the view's geometry (`TREE_X` 20, columns 226, nodes 214×27, rows 31, `TREE_ROWS` 10, `TREE_STRIP_Y` 414, `nodeRect`), the tree tabs (`treeTabRect`, `treeTabLabel` with the nodes held in the tree, `treeForKey` for 1–4, `openingTree`: the calling's tree, else Warrior), `pathHeading`, `nodeSummary` (strip line 1; a spell's mana and `spellApCost`; an ability's cost through `costWords`, "3 mana, 6 AP (weapon + 1)", read from `Perk.ability` / `Ability.manaCost` / `weaponAp` when present, so step 13 needs no change) and `draftNodeClickable` (tier 1 only). `PerkTreeView` draws the four tabs (`addPanelButton`), headings, tier bands, kind stripes, capstone double frame and ★, a taken node gold with ✓, a locked capstone in rust with ✕, `requires` lines and a three-line strip (each line placed under the one before, line 1 may wrap). `InventoryScene`: `perkTree` and `spellTree` both show the one view (P on the calling's tree, K on Mage), 1–4 switch, Back/Esc return to the tab it came from; the Skills tab's button reads "Skill Trees". `CreationScene`: `TREE_SWITCH` gone; tabs and 1–4; the rule line as quoted; the summary column gives way to the full-width tree on the perks step (picks and notes beside the tabs). Probes: `CreationProbe.tree: TreeId`, `trees`; `InventoryProbe.tree`, `trees`, `nodeSize`; `spellNodes` removed (`perks` is the shown tree's).

**Deviations.**
- **`treeLayout` aligns tiers across columns** (C9 said only "nodes from row 1 in PERKS order"): each tier starts on the same row in all three columns (a tier's rows = the most any path has of it), still in PERKS order within a column. With unaligned rows a single `tierBands` row per tier could not mark the bands (the Scout tree's L6 fell on Skirmisher's T2 row). Shapes unchanged; rows have gaps. At 95 nodes the Warrior and Scout trees need 9 node rows (T1 2, T2 3, T3 3, ★ 1), so the view keeps 10 rows (heading + 9) and the strip starts at y 414, not 441; one row fewer than the design's "two left free", and names fit one line at 214 px (a longer one wraps at 11 px). Step 03's row test rewritten for this.
- **Stale e2e mana figures from step 04** (Delwyn now 24 mana, AC4): `e2e/battle.test.ts` (24/21/18) and `e2e/character.test.ts` (24, 21 after a heal) still said 18/15/12 and failed in the full run; updated here.
- Creation's perks step no longer shows the summary (HP, mana, skills) — the tree takes the whole width.

**Screenshots** (840×560 and 1280×800, scratchpad, not committed): `/private/tmp/claude-501/-Users-ryan-personal-yomi/d27ee47a-1631-4550-8a30-1ea2385e2b8a/scratchpad/shots/` panel-warrior-840.png, panel-warrior-hover-840.png, panel-scout-840.png (locked Deadeye), panel-mage-840.png (requires lines, Fireball strip), panel-cleric-840.png, creation-warrior-840.png, creation-warrior-hover-840.png, creation-scout-840.png, and the same at 1280. Checked: labels fit, no overlap, tabs/headings/bands/states/capstones read.

**For later steps.** Step 07 renames `perkTree`/`spellTree` and drops K; `openTree`/`showTree` in InventoryScene. `manual.shots.ts` points at `trees.mage`; screenshots not retaken (step 26).
