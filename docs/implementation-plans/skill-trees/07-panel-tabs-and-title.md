# Step 07: The Skills and Abilities tabs and the hero's title

[Plan index](index.md) · [Design](../../designs/skill-trees.md) (R11; §4.6, §4.7, §5.6 `InventoryScene`) · [Feature record](../../features/skill-trees.md)

**Difficulty:** sonnet / opus. The engineer may run as `model: "sonnet"`; leave the reviewer's model unset. The step follows fixed contracts and the panel's existing patterns: a pure helper with tests, a tab rename and regrouping in `InventoryScene`, wording, probes and e2e updates. No rule of play changes.

## 1. Objective

The character panel's tabs become **Character, Skills, Abilities, Inventory** (keys C, S, B, I):

- **Skills** lists the skills and the passives taken, with a **Skill Trees** button (P) that opens step 06's tree view; Esc in the tree view goes back to Skills. K is dropped.
- **Abilities** (renamed from Spells) lists the actives the hero knows, each with its kind, AP, mana and recharge, with the mana carried and the spell skill, and keeps the world map's heal Cast button.
- The class line under the hero's name becomes `heroTitle`: "Level 9 · Heavy Knight", or "Level 9 · Heavy Knight / Paladin".
- The panel and the victory screen's level-up line say when the next pick comes: "Next pick at level N".

The refactor guard stays green: nothing here changes what the simulator plays.

## 2. Requirements and context

- **R11:** the character panel shows the trees; the Skills and Spells tabs become Skills (passives) and Abilities (actives).
- **R15:** the manual, `CLAUDE.md` and the e2e tests are brought up to date.
- **Design §5.6, `InventoryScene` (restated):**
  - The tabs become Character, Skills, Abilities and Inventory (C, S, B, I).
  - The Skills tab lists skills and the passives taken, with a **Skill Trees** button (P). The tree view's Esc goes back to Skills. K is dropped.
  - The Abilities tab lists known actives with kind, AP (as `abilityApCost` or `spellApCost` gives them now), mana and recharge. It shows the mana carried and the spell skill, and keeps the world-map heal Cast button (`worldCasting.ts` is unchanged; Mending's `healBonus` is added in `worldHealing`, which step 04 did).
  - The class line under the name becomes `heroTitle`: "Level 9 · Heavy Knight", or "Level 9 · Heavy Knight / Paladin" when the second-deepest path holds 3 nodes or more.
  - `PanelTab` loses `'spellTree'`, and `'perkTree'` is renamed `'trees'`.
- **Design §4.6 (restated):** on the world map, the Skills tab lists skills and the passives taken; its Skill Trees button (P) opens the tree view. The Abilities tab (B, renamed from Spells) lists the actives known, each with its kind, cost and recharge, and the mana carried. Heals keep their Cast button there.
- **Design §4.7 (restated):** an odd level brings no pick. The level-up line on the victory screen and the panel say "Next pick at level N".
- **AC9 (partly; the tree view itself is step 06):** the tree view is reached from the Skills tab and lays out with no overlap at 840×560.

### Decisions from the index (unchanged)

- **2. The refactor guard.** `scripts/simulate.test.ts`'s fixture moves whenever play moves. A step that changes what the simulator plays (data, plans, the economy, a spell's or node's numbers, the order of `ALL_SPELL_IDS`) re-records the fixture in its own commit and says why in the commit message. A step that only adds engine rules, statuses or policy branches that no simulated unit can yet reach **must keep the fixture green unchanged**; a mismatch there is a bug. Steps that must keep it green: 05, 06, 07, 09, 10, 11, 12, 14, 15, 17, 18, 19, 20, 22. Each stage's measurement step re-records it last.
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

**C7. Spell modifiers and mana (step 04; consumed by 09, 14, 20, 21)**

```ts
// src/combat/combat.ts: CombatantStats.magic gains
magic?: {
  maxMana: number; skill: number; spells: readonly SpellId[]
  power?: { all?: number; fire?: number; frost?: number }   // added to each damaging outcome of its spells, by element, before wards
  healBonus?: number                                         // added to what its heals restore
  extend?: { hostile?: number; friendly?: number }           // turns added to statuses its hostile / friendly spells lay
  friendlyRange?: number                                     // added to the range of a friendly spell aimed at an ally or an area of range > 0
  apDiscount?: { all?: number; heal?: number }               // off a spell's AP (heal: spells with `heal`)
}
// src/combat/spells.ts
export function spellApCost(stats: Pick<CombatantStats, 'magic'>, spell: SpellId): number   // max(min(apCost, 2), apCost − all − heal)
export function spellRange(stats: Pick<CombatantStats, 'magic'>, spell: SpellId): number
// src/character/character.ts
// maxMana = 2 × INT + (level − 1) × ⌊INT / 2⌋ + MANA_PER_TREE_NODE × (nodes in the Mage and Cleric trees) + perks' maxMana + gear's maxMana
//   (for every hero; INT through attributeLevel)
// magic is emitted for a hero that knows a spell (step 09: or an ability with manaCost); each modifier only when non-zero
```

`magic.power` from effects: `all` = spellDamage, `fire` = fireSpellDamage, `frost` = frostSpellDamage. `healBonus` = healBonus. `extend` = hostileExtend / friendlyExtend. `friendlyRange` = friendlyRange. `apDiscount.all` = spellApDiscount, `.heal` = healApDiscount. `deriveCombatStats` also adds `resistance += perkBonus('resistance')`, `ac += perkBonus('shieldAc')` while the off hand holds a shield, `wards[e] += wardAll` for each element and `wards.blight += wardBlight`, and the nodes' `meleeOnHit` to `onHit` while the main hand is melee or bare.

**C10. The hero's title (this step)**

```ts
// src/character/trees.ts
export function heroTitle(character: Character): string
  // "Level 9 · Heavy Knight"; "Level 9 · Heavy Knight / Paladin" when the second-deepest path holds 3 nodes or more;
  // "Level 1" with no nodes. Ties for deepest: PATH_IDS order.
```

**C4 (step 03, consumed here):** `nextPerkLevel(character)` is the next even level above the character's level; `hasPickFor(character, perk) = character.perkPicks > 0`; `XpGain.spellsGained`, `hasSpellcasting` and `nextSpellLevel` are removed.

### Shared constraints (from the index)

- **Environment.** The system Node is 22; Node 26 is at `~/.nvm/versions/node/v26.13.0/bin`. Prefix every npm or node command with `PATH=$HOME/.nvm/versions/node/v26.13.0/bin:$PATH`. Podman is also available for the `Makefile` targets (`make test`, `make test-browser`).
- **Commands:** `npm test` (`tsc && vitest run`) is the gate before the commit; `npx vitest run <file>` for one file; `npm run test:browser` (or `-- -t <name>`) after any scene change; read `e2e/CLAUDE.md` before adding or changing an in-browser test.
- **The refactor guard** must stay green, unchanged (decision 2). Do not edit its fixture.
- **Domain first.** The title and any wording rule live in Phaser-free modules with tests; scenes decide nothing; Phaser-free helpers in `src/scenes/` stay free of runtime Phaser imports.
- **`tsc` is the linter**: `noUnusedLocals`, `noUnusedParameters`, `erasableSyntaxOnly`, `verbatimModuleSyntax` (`import type`), `.ts` extensions in imports.
- **Commits.** One commit for this step once `npm test` passes, on `skill-trees`, without pushing. Never switch branches. Message "Skill trees step 07: the Skills and Abilities tabs and the hero's title". No attribution lines.
- **Docs.** `CLAUDE.md` stays current: fix the lines this change makes wrong (the `Inventory` paragraph of the scene layer: its tabs, P and K, the Spells tab and Spell Tree; the hint that the Skills tab lists "only the perks a character has taken, spells aside") and search it for every name renamed or removed (`spellTree`, `perkTree`, `Spells tab`, `Spell Tree`, `Perk Tree`). Update the manual's section 4 ("The character panel") text for the tabs; step 26 retakes the screenshots.

## 3. Dependencies and prerequisites

- **Step 03 (done)**: C1, C2, C4; `perkTree.ts` reworked (C9). `describeRewards` (`src/game/party.ts`) no longer reads `spellsGained`.
- **Step 04 (done)**: C7 (`spellApCost`, every hero's `maxMana`, `magic` modifiers).
- **Step 06 (done)**: the four-tab tree view drawn in the panel (`PerkTreeView`), opened today as the panel's `'perkTree'` tab, with keys 1 to 4 switching trees while it is open.
- **Existing code at `50fb4cf`, for reference** (step 03 and 06 may have moved lines):
  - `src/scenes/InventoryScene.ts`: `type PanelTab = InventoryProbe['tab']`; `MainTab` excludes `'perkTree' | 'spellTree'`; `TREE_OF` maps a tree tab back to its main tab; keys `B` (`spells`), `P` (perk tree toggle), `K` (spell tree toggle); the Skills tab's Perk Tree button (`TREE_BUTTON`); the Spells tab with its Spell Tree button (`SPELL_TREE_BUTTON`), "Next spell at level …" and the world-map Cast (`worldCast`); `classLine()` drawn under the name on the Character tab and the stats column; "Next at level ${nextPerkLevel(...)}".
  - `src/testHook.ts`: `InventoryProbe.tab: 'character' | 'skills' | 'spells' | 'inventory' | 'perkTree' | 'spellTree'`.
  - `src/game/party.ts`: `describeRewards` writes "<name> reaches level N: +H max HP, S skill points, a perk, wounds healed".
  - `e2e/character.test.ts`: "shows on the Spells tab the spell skill the caster's gear leaves it"; "lists only the perks a hero has taken, and shows them all in the perk tree" (with the world-map heal Cast, `worldCast`); "takes a perk from the tree with the pick that the third level brings".
- **Abilities (techniques)** arrive in stage 2 (`knownAbilities`, step 09; nodes, step 13). This step builds the Abilities list so that an ability row renders like a spell row; until then only spells appear.

## 4. Scope and implementation guidance

### 4.1 `src/character/trees.ts`: `heroTitle`

Add `heroTitle` exactly as C10. "Level N" alone with no nodes; the deepest path by `pathDepth`, ties in `PATH_IDS` order; the second-deepest (a different path, again by depth then `PATH_IDS` order) is added as " / <Path>" only when it holds 3 nodes or more. Use `PATHS[path].name`. The separator is " · " (a middle dot with spaces).

### 4.2 A Phaser-free helper for the Abilities list

Put the rows the Abilities tab shows in a Phaser-free helper (for example `src/scenes/abilityList.ts`, or a function in an existing helper such as `perkTree.ts`), tested in the domain project:

- one row per active known: spells (`knownSpells`) then abilities (`knownAbilities` once it exists; until step 09 an empty list), each with its name, kind (`nodeKind` of the node teaching it: "spell", "mana", "at-will"), AP (`spellApCost` over the hero's derived stats for a spell; for an ability, `abilityApCost` once step 09 adds it), mana cost (none for an at-will) and recharge (abilities only; "—" or nothing for a spell);
- whether a heal can be cast on the world map comes from `worldSpells` as today.

Name the helper in `CLAUDE.md`'s list of scene helpers.

### 4.3 `InventoryScene`

- Tabs Character, Skills, Abilities, Inventory, keys C, S, B, I. `PanelTab` (through `InventoryProbe['tab']`) becomes `'character' | 'skills' | 'abilities' | 'inventory' | 'trees'`; `'spellTree'` is gone and `'perkTree'` is `'trees'`. `TREE_OF` maps only `trees → skills`.
- **Skills**: the skills as today, then the passives taken (`nodeKind === 'passive'`), with a **Skill Trees** button (P toggles it as P did the perk tree). The line under them reads "N picks" when picks wait, else "Next pick at level ${nextPerkLevel(character)}". Esc in the tree view goes back to Skills. Remove the K binding and the separate spell-tree content.
- **Abilities**: the rows of §4.2, the mana carried (`manaOf` / `maxMana`) and the spell skill (gear included, as the Spells tab showed it), and the heal Cast button on the world map (`castOnWorldMap`, `worldCast` probe), unchanged in behaviour. The Spell Tree button and "Next spell at level …" go.
- Replace `classLine()` with `heroTitle(character)` wherever it is drawn.
- In battle the panel keeps showing these tabs read-only, as today.

### 4.4 The victory screen's line

`describeRewards` (`src/game/party.ts`): on a level gained, the line says ", a pick" when the new level brought one; otherwise it ends with "next pick at level N" (`nextPerkLevel`). Example: "Aldric reaches level 3: +5 max HP, 3 skill points, wounds healed; next pick at level 4". Update its unit test.

### 4.5 Probes, e2e, manual

- `src/testHook.ts`: `InventoryProbe.tab` as §4.3; the Skill Trees button and the Abilities tab's button in the probe where the old Perk Tree / Spells controls were; the ability rows (name, kind, AP, mana) if a test reads them.
- `e2e/character.test.ts`: the Spells-tab test becomes the Abilities tab's ("shows on the Abilities tab the spell skill the caster's gear leaves it"); the world-map Cast test opens Abilities; the perk-tree tests open the trees from Skills with P and the Skill Trees button and come back with Esc; K is no longer pressed anywhere. Wait on probe state, never on time.
- `docs/manual/README.md`, section 4: the four tabs, Skill Trees (P), Abilities (B) with the heal Cast, the title line, "Next pick at level N". Screenshots wait for step 26.

### 4.6 Exclusions

- No change to the tree view's drawing (step 06), the battle's Skills menu (step 14) or creation.
- No rule of play; `worldCasting.ts` unchanged.

## 5. Verification

### Tests (in `npm test`)

- `src/character/trees.test.ts` (`heroTitle`): no nodes → "Level 1"; one path deepest → "Level 9 · Heavy Knight"; second path at 3 nodes → "… / Paladin"; second path at 2 nodes → no second name; a tie for deepest resolved in `PATH_IDS` order.
- The Abilities-row helper: a caster with Magic Arrow and Heal lists both as spells with `spellApCost` AP (one with Swift Hands or Quickened Casting shows the discounted AP) and mana; a hero with no actives lists none.
- `src/game/party.test.ts` (`describeRewards`): an even level says "a pick"; an odd level says "next pick at level N".
- The scene smoke test `src/scenes/InventoryScene.test.ts` (if present) still passes.

### Commands

```sh
PATH=$HOME/.nvm/versions/node/v26.13.0/bin:$PATH npm test
PATH=$HOME/.nvm/versions/node/v26.13.0/bin:$PATH npm run test:browser   # this step changes a scene: required
```

### Acceptance checks

- The panel shows Character, Skills, Abilities, Inventory; C, S, B, I switch them; P opens and closes the trees from anywhere in the panel, Esc in the trees returns to Skills; K does nothing.
- The Character tab's line under the name is `heroTitle`.
- On the world map, a wounded party's healer casts Heal from the Abilities tab as before.
- `npm run test:browser` passes in full (any test step 03 listed as failing for the interim view was restored by step 06; none fails here).
- The refactor guard is green and its fixture unchanged.

## 6. Completion criteria

- [ ] `heroTitle` in `trees.ts` with tests; the Abilities-row helper with tests; `describeRewards` updated with tests.
- [ ] `InventoryScene` tabs, keys, buttons and title as §4.3; `PanelTab` without `'spellTree'`, with `'trees'`.
- [ ] `testHook.ts` and `e2e/character.test.ts` updated; `npm test` and `npm run test:browser` pass.
- [ ] Guard fixture untouched and green.
- [ ] `CLAUDE.md` (Inventory paragraph, helper list) and the manual's section 4 updated; no stale `spellTree`, `perkTree`, "Spells tab" or "Spell Tree" left.
- [ ] One commit "Skill trees step 07: the Skills and Abilities tabs and the hero's title"; step 07's status in [the index](index.md) set to `done (<commit>)`.

## 7. Execution record
