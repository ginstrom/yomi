# Step 03: Trees, nodes and picks

[Plan index](index.md) · [Design](../../designs/skill-trees.md) (R1, R3, R4, R6, R10, R11; AC1, AC2, AC3; §4.1 to §4.4, §5.1, §5.6, §5.8) · [Feature record](../../features/skill-trees.md)

**Difficulty:** opus. Leave the engineer's and the reviewer's model unset. This is stage 1's largest step: it replaces the perk data every hero is built from, the pick economy, the plans the simulator and the bandits grow by, and the tree helper the scenes draw; every caller of the old perk API moves with it, and play changes everywhere.

## 1. Objective

The perk tree and the spell tree give way to four trees of three paths each:

- `src/character/trees.ts` (new): trees, paths, tiers, depth, the calling, the capstone.
- `PERKS` holds the 57 stage-1 nodes (C3), each of one rank, asked for by tier, depth, attributes, skills, `anySkill` and `requires`; a capstone only in the hero's calling and only one ever.
- Picks: three at creation, one at every even level, one pick buys one node. Spell picks and Spellcasting are gone.
- `autoAdvance` follows a plan (C5); the pre-rolls and the bandits are rebuilt on the trees.
- `src/scenes/perkTree.ts` is reworked to the tree layout (C9); the scenes are wired to it in an interim way (decision 3) until step 06 redraws the view.
- `SAVE_VERSION` 23.

Effects of the new `PerkEffects` keys are declared in the data but not yet derived: step 04 derives them (and gives every hero mana). The existing keys (attributes, skills, `maxHp`, `armorClass`, `actionPoints`, `critChance`, `meleeDamage`, `rangedDamage`, `armorPierce`, `range`, `skillPoints`, `maxMana`) keep working as today.

## 2. Requirements and context

- **R1:** four trees (Warrior, Scout, Mage, Cleric), three paths each, of single-rank nodes, replace the perk tree and the spell tree. Every node is a perk, as data.
- **R3:** tiers ask a level and a depth (nodes already held in the node's own path). T1 to T3 of every path are open to every hero. The capstone asks level 12 and depth 5, needs its path to be the hero's deepest (the calling), and a hero may take only one capstone.
- **R4:** three picks at creation, then one at every even level (5 by level 5, 8 by level 10, 13 by level 20). One pick buys one node the hero qualifies for. Spell picks and Spellcasting go away.
- **R6:** today's perks and spells fold into the paths under the same ids wherever they survive (design §4.3's "What happens to today's perks and spells").
- **R10 (part):** `autoAdvance` follows a plan per build; the ready-made party, the pre-rolls and the bandits' drafts are rebuilt on the trees.
- **R11 (part):** the tree helper; the drawn view is step 06.
- **AC1 (stage-1 subset):** a hero that takes both T1s of a path at creation and every later pick there reaches its T3 at level 6 and its capstone at level 12.
- **AC2 (with stage-1 stand-ins):** a capstone is open only in the calling; once one is held, no other is open, whatever the depths later.
- **AC3:** a level 1 draft spends exactly 3 picks; a character gains a pick on reaching each even level and none on odd levels (`gainXp`); there is no `spellPicks` field.
- **Design §4.1:** the calling is the path with the most nodes held; ties count as all tied paths. Derived, never stored. Taking a capstone closes every other capstone for good. Asks gate taking, not keeping (§4.7).
- **Design §4.2:** skill points (2 + ⌊INT/3⌋ a level, 10 at creation) unchanged. Only Gain Strength survives as an attribute node; five folded "Gain X" perks live on as +1 to their attribute inside Toughness, Far Shot, Skirmisher, Fortune and Lasting Magic.
- **Retired:** Spellcasting, Quick Study (`xpPercent` goes with it). Removed: `SPELL_TIERS`, `SPELLCASTING_SPELL_PICKS`, `spellPicks`, `isSpellPerk`, `SPELL_PERK_IDS`, `spellPerkOf`, `TRUNK_PERKS`, schools on perks, ranks above 1. A spell's `school` stays in `SPELLS` for its colour.

### Decisions from the index (unchanged)

1. **When a node enters `PERKS`.** A node joins `PERKS` in the first stage that can deliver its effect (table C3). Six passives enter in stage 1 with only their derived part and are completed later, because the v22 migration maps folded perks onto three of them and their derived part works at once: `iron_skin` (+2 resistance; free-attack bonus in stage 3), `battle_mage` (+6 mana; Strikes' elemental +2 in stage 2; mana on hit in stage 3), `skirmisher` (+1 Agility; +10 to hit after moving in stage 3), `fortune` (+10% critical, +1 Luck; critical damage in stage 3), `deadeye` (+10% Archery, Eagle Eye's effect; pierce and triple dice in stage 3) and `serenity` (friendly range +2; mana regained in stage 3). A node's `description` says only what works in its stage; the step that completes it rewrites the description. Some stage-1 nodes cannot be reached by depth until their path's later nodes arrive (Fortune, Iron Skin, Deadeye): that is expected.
2. **The refactor guard.** `scripts/simulate.test.ts`'s fixture moves whenever play moves. A step that changes what the simulator plays (data, plans, the economy, a spell's or node's numbers, the order of `ALL_SPELL_IDS`) re-records the fixture in its own commit and says why in the commit message. A step that only adds engine rules, statuses or policy branches that no simulated unit can yet reach **must keep the fixture green unchanged**; a mismatch there is a bug. Steps that must keep it green: 05, 06, 07, 09, 10, 11, 12, 14, 15, 17, 18, 19, 20, 22. Each stage's measurement step re-records it last.
3. **Between steps of a stage the game may be rough, never broken.** Step 03 changes the tree data before step 06 redraws the tree view: until 06, the panel's and creation's old two-way switch shows the Warrior tree ("Perks") and the Mage tree ("Spells") laid out by the new helper. In-browser tests that fail only because of that interim view are listed in step 03's record and restored by step 06; no other in-browser test may fail at any step.
4. **Plans.** `AUTO_PLANS` names fifteen plans (C5). The design's six are written out in full; the parity plans are their path's nodes in `PERKS` order. A plan lists only nodes present in `PERKS`, so stage 1 writes each plan without its later nodes and steps 13 and 21 insert them at the positions C5 gives. The Captain follows `knight` (Rooted before Taunt), not the design's §5.8 "Taunt (L2), Rooted (L4)"; the Cutthroat's plan takes Sprint before Tumble, since Tumble asks Rogue depth 3, which a Cutthroat cannot have at level 6 otherwise.
7. **Saves.** `SAVE_VERSION` 23 in stage 1 (step 03 raises it; step 05 adds `migrateFrom22`), 24 in stage 2 (step 11), 25 in stage 3 (step 17). Versions 23 and 24 load into the current version with no game migration: `BattleEngine.restore` fills the new `UnitRecord` fields with their defaults. Version 18 goes through `migrateFrom18` then `migrateFrom22`. Between steps 03 and 05, version-22 saves read as unreadable, and so does the version-18 fixture (its migration yields version 22's shape): step 03 changes that test to expect unreadable, and step 05 restores it.

### Contracts (copied unchanged from the index)

**C1. Trees and paths (this step produces):**

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

**C2. Nodes (this step produces):**

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

In this step, `ability` and `trait` are not yet on `Perk` (their types arrive in steps 09 and 11; add the fields then), `knownAbilities` and `traitsOf` are not yet written, and `nodeKind` returns only `'spell'` or `'passive'` until step 09 adds abilities. Write `nodeKind` so the later branches slot in.

**C3. The 95 nodes and their stage (this step writes the stage-1 ones):**

`PERKS` is ordered by tree, path (PATH_IDS order), then the order below (by tier). "1p" enters in stage 1 partly (decision 1). Numbers, asks and effects: design §4.3.

| Path | Nodes in `PERKS` order (tier, stage) |
| --- | --- |
| swordmaster | weapon_training (1, 1), heavy_hand (1, 1), power_attack (2, 2), armor_breaker (2, 1), gain_strength (2, 1), cleave (3, 2), weapon_mastery (3, 1), blademaster (★, 3) |
| heavy_knight | toughness (1, 1), shield_wall (1, 1), taunt (2, 2), rooted (2, 2), pin (3, 2), iron_skin (3, 1p), guardian (3, 3), unbreakable (★, 3) |
| spellsword | arcane_blood (1, 1), flame_strike (1, 2), frost_strike (2, 2), spell_ward (2, 1), thunder_strike (3, 2), battle_mage (3, 1p), arcane_knight (★, 3) |
| ranger | marksmanship (1, 1), deadly_aim (1, 1), aimed_shot (2, 2), far_shot (2, 1), hunters_mark (2, 2), volley (3, 2), pinning_shot (3, 2), deadeye (★, 1p) |
| rogue | dodger (1, 1), sprint (1, 2), skirmisher (2, 1p), dirty_trick (2, 2), tumble (3, 3), evasion (3, 1), counter (3, 3), shadowdancer (★, 3) |
| assassin | keen_eye (1, 1), backstab (1, 3), venom_strike (2, 2), hamstring (2, 2), fortune (3, 1p), ambush (3, 3), executioner (3, 3), deathblow (★, 3) |
| evoker | magic_arrow (1, 1), destruction (1, 1), flame_arrow (2, 1), pyromancy (2, 1), fireball (3, 1), acid_arrow (3, 1), death_cloud (3, 1), meteor (★, 1) |
| cryomancer | frostbite (1, 1), numbing_cold (1, 1), sleep (2, 1), frost_blast (2, 1), web (3, 1), ice_lance (3, 3), lingering_cold (3, 1), glacial_prison (★, 3) |
| arcanist | shield (1, 1), arcane_study (1, 1), mirror_image (2, 1), ward (2, 1), haste (3, 1), lasting_magic (3, 1), quickened_casting (3, 1), mass_haste (★, 1) |
| healer | heal (1, 1), mending (1, 1), greater_heal (2, 1), heal_all (2, 1), greater_heal_all (3, 1), purify (3, 3), swift_hands (3, 1), revive (★, 3) |
| paladin | bless (1, 1), smite (1, 2), lay_on_hands (2, 1), blessed_armour (2, 1), aura_of_courage (3, 3), consecrate (3, 2), sacred_weapon (3, 1), aegis (★, 3) |
| saint | serenity (1, 1p), bane (1, 1), protect (2, 1), scholar (2, 1), curse (3, 1), renew (3, 3), holy_light (3, 3), sanctuary (★, 3) |

Stage 1: 57 nodes. Stage 2 adds 18 (the 17 techniques and `rooted`). Stage 3 adds 20. `requires` (same path): flame_arrow → magic_arrow; fireball, acid_arrow → flame_arrow; frost_blast → frostbite; greater_heal, heal_all → heal; greater_heal_all → heal_all.

Stage-1 effects of the partial nodes: iron_skin `{ resistance: 2 }`; battle_mage `{ maxMana: 6 }`; skirmisher `{ agility: 1 }`; fortune `{ critChance: 10, luck: 1 }`; deadeye `{ archery: 10 }`; serenity `{ friendlyRange: 2 }`. Later: battle_mage `imbueDamage: 2` (13), `manaOnHit: 1` (21); iron_skin `opportunityToHit: 15, opportunityDamage: 3` (21); skirmisher `movedToHit: 10` (21); fortune `critDamage: 4` (21); deadeye trait `deadeye` (21); serenity `manaRegen: 2` (21).

**C4. The economy (this step produces):**

```ts
// src/character/progression.ts
export const PICK_LEVEL_STEP = 2                  // replaces PERK_LEVEL_STEP
export function picksAt(level: number): number    // 3 + ⌊level / 2⌋: every pick a hero has had by `level`
export function nextPerkLevel(character: Character): number   // the next even level above its level
// levelUp: perkPicks += 1 when the new level is even; skill points and hit points as today
// takePerk(character, perk): spends one perk pick, nothing else
// removed: PERK_LEVEL_STEP, SPELLCASTING_SPELL_PICKS, hasSpellcasting, nextSpellLevel, XpGain.spellsGained, AUTO_PERKS, AUTO_SPELLS
// hasPickFor(character, perk) = character.perkPicks > 0; canAdvance loses the spell branch
// src/character/character.ts: Character.spellPicks removed
// src/character/creation.ts: CREATION_PERK_PICKS = 3 (unchanged); spellPicksLeft and draftCasts removed
// src/game/save.ts: SAVE_VERSION = 23
```

**C5. Plans (this step produces; extended by 13 and 21; read by 15):**

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

- `knight`: weapon_training, heavy_hand, toughness, rooted, taunt, pin, iron_skin, guardian, unbreakable, shield_wall, power_attack, armor_breaker, weapon_mastery
- `swordmaster`: weapon_training, heavy_hand, power_attack, armor_breaker, cleave, gain_strength, weapon_mastery, blademaster, toughness
- `ranger`: marksmanship, deadly_aim, aimed_shot, far_shot, volley, hunters_mark, pinning_shot, deadeye, dodger, sprint, skirmisher, tumble, evasion
- `rogue` (the Cutthroat's): backstab, dirty_trick, sprint, tumble, evasion, counter, skirmisher, shadowdancer
- `evoker_healer`: magic_arrow, heal, destruction, flame_arrow, heal_all, fireball, pyromancy, mending, meteor, greater_heal, death_cloud, greater_heal_all, purify
- `bandit_mage`: flame_arrow, destruction, fireball, heal, heal_all
- `spellsword`, `assassin`, `evoker`, `cryomancer`, `arcanist`, `healer`, `paladin`, `saint`: their path's nodes in `PERKS` order
- `rogue_archer`: the rogue path's nodes in `PERKS` order (the melee-only ones are skipped by their asks)

Pre-rolls and bandits (design §5.8): Aldric weapon_training, heavy_hand, toughness (`knight`); Brenna marksmanship, deadly_aim, dodger (`ranger`); Delwyn magic_arrow, heal, arcane_study (`evoker_healer`); Garrick weapon_training, marksmanship, dodger (`knight`). Archer and Crossbowman marksmanship, deadly_aim, dodger (`ranger`); Cutthroat weapon_training, dodger, toughness (`rogue`); Brute weapon_training, heavy_hand, toughness (`swordmaster`); Hedge-Mage magic_arrow, shield, arcane_study (`bandit_mage`); Captain weapon_training, toughness, dodger (`knight`). The remaining pre-rolls are rebuilt on T1 nodes of their role, held legal by the existing test.

Stage-1 contents of the six written-out plans (C5's lists filtered to the 57 stage-1 nodes, order kept):

- `knight`: weapon_training, heavy_hand, toughness, iron_skin, shield_wall, armor_breaker, weapon_mastery
- `swordmaster`: weapon_training, heavy_hand, armor_breaker, gain_strength, weapon_mastery, toughness
- `ranger`: marksmanship, deadly_aim, far_shot, deadeye, dodger, skirmisher, evasion
- `rogue`: evasion, skirmisher
- `evoker_healer`: magic_arrow, heal, destruction, flame_arrow, heal_all, fireball, pyromancy, mending, meteor, greater_heal, death_cloud, greater_heal_all
- `bandit_mage`: flame_arrow, destruction, fireball, heal, heal_all

Derive the parity plans from `PERKS` (a filter by `path`) rather than writing them out, so steps 13 and 21 need not touch them.

**C9. The tree-view helper (this step produces; consumed by 06, 07):**

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

### The 57 stage-1 nodes (design §4.3, restated)

Kind: P passive, S spell. Every node has one rank. "Asks" is beyond the tier's level and depth (T1: level 1, depth 0; T2: level 2, depth 1; T3: level 6, depth 3; ★: level 12, depth 5, the calling, no capstone held). A spell node's `description` is today's spell description with its mana and AP, as `spellPerk` built it.

| Path | Node (tier) | Kind | Asks | `effects` / what it teaches |
| --- | --- | --- | --- | --- |
| swordmaster | weapon_training (1) | P | STR 5 | `{ melee: 10 }` |
| | heavy_hand (1) | P | STR 6 | `{ meleeDamage: 2 }` |
| | armor_breaker (2) | P | STR 6 | `{ armorPierce: 2 }` |
| | gain_strength (2) | P | — | `{ strength: 2 }` (never past 10, as `cappedAttribute` says) |
| | weapon_mastery (3) | P | STR 8 | `{ melee: 10, meleeDamage: 2, armorPierce: 1 }` |
| heavy_knight | toughness (1) | P | END 5 | `{ maxHp: 8, endurance: 1 }` |
| | shield_wall (1) | P | — | `{ shieldAc: 8 }` (+8 AC while a shield is in the off hand; derived in step 04) |
| | iron_skin (3, 1p) | P | END 7 | `{ resistance: 2 }` |
| spellsword | arcane_blood (1) | P | INT 4 | `{ maxMana: 10 }` |
| | spell_ward (2) | P | — | `{ wardAll: 3 }` |
| | battle_mage (3, 1p) | P | INT 5 | `{ maxMana: 6 }` |
| ranger | marksmanship (1) | P | PER 5 | `{ archery: 10 }` |
| | deadly_aim (1) | P | PER 6 | `{ rangedDamage: 2 }` |
| | far_shot (2) | P | PER 6 | `{ range: 2, perception: 1 }` |
| | deadeye (★, 1p) | P | Archery 70 | `{ archery: 10 }` |
| rogue | dodger (1) | P | AGI 6 | `{ armorClass: 10 }` |
| | skirmisher (2, 1p) | P | AGI 6 | `{ agility: 1 }` |
| | evasion (3) | P | AGI 8 | `{ armorClass: 10, actionPoints: 1 }` |
| assassin | keen_eye (1) | P | LCK 6 | `{ critChance: 10 }` |
| | fortune (3, 1p) | P | LCK 7 | `{ critChance: 10, luck: 1 }` |
| evoker | magic_arrow (1) | S | Magic 40 | `magic_arrow` |
| | destruction (1) | P | INT 5 | `{ spellDamage: 2, maxMana: 4 }` |
| | flame_arrow (2) | S | Magic 55, requires magic_arrow | `flame_arrow` |
| | pyromancy (2) | P | INT 6 | `{ fireSpellDamage: 3 }` |
| | fireball (3) | S | Magic 65, requires flame_arrow | `fireball` |
| | acid_arrow (3) | S | Magic 65, requires flame_arrow | `acid_arrow` |
| | death_cloud (3) | S | Magic 70 | `death_cloud` |
| | meteor (★) | S | Magic 80 | `meteor` (step 02's spell) |
| cryomancer | frostbite (1) | S | Magic 40 | `frostbite` |
| | numbing_cold (1) | P | INT 5 | `{ frostSpellDamage: 3 }` |
| | sleep (2) | S | Magic 55 | `sleep` |
| | frost_blast (2) | S | Magic 55, requires frostbite | `frost_blast` |
| | web (3) | S | Magic 65 | `web` |
| | lingering_cold (3) | P | INT 7 | `{ hostileExtend: 1, magic: 10 }` |
| arcanist | shield (1) | S | Magic 40 | `shield` |
| | arcane_study (1) | P | INT 5 | `{ magic: 10 }` |
| | mirror_image (2) | S | Magic 55 | `mirror_image` (no longer asks Shield) |
| | ward (2) | S | Magic 55 | `ward` |
| | haste (3) | S | Magic 65 | `haste` |
| | lasting_magic (3) | P | INT 7 | `{ friendlyExtend: 1, intelligence: 1 }` |
| | quickened_casting (3) | P | Magic 70 | `{ spellApDiscount: 1, maxMana: 8 }` |
| | mass_haste (★) | S | Magic 80 | `mass_haste` |
| healer | heal (1) | S | Magic 40 | `heal` |
| | mending (1) | P | Magic 30 | `{ healBonus: 4 }` |
| | greater_heal (2) | S | Magic 55, requires heal | `greater_heal` |
| | heal_all (2) | S | Magic 55, requires heal | `heal_all` |
| | greater_heal_all (3) | S | Magic 65, requires heal_all | `greater_heal_all` |
| | swift_hands (3) | P | Magic 60 | `{ healApDiscount: 1, maxMana: 8 }` |
| paladin | bless (1) | S | anySkill Melee 30 or Magic 40 | `bless` |
| | lay_on_hands (2) | S | anySkill Melee 40 or Magic 40 | `lay_on_hands` |
| | blessed_armour (2) | P | END 5 | `{ resistance: 1, wardBlight: 3, maxMana: 6 }` |
| | sacred_weapon (3) | P | Melee 60 | `{ melee: 10 }`; `meleeOnHit: [{ damage: 2 }, { damage: 4, bane: true }]` |
| saint | serenity (1, 1p) | P | INT 5 | `{ friendlyRange: 2 }` |
| | bane (1) | S | Magic 40 | `bane` |
| | protect (2) | S | Magic 55 | `protect` |
| | scholar (2) | P | INT 6 | `{ skillPoints: 2 }` |
| | curse (3) | S | Magic 65 | `curse` (step 02 made it a hero spell) |

`meleeOnHit` and the new keys are carried as data now; step 04 derives them. Write the descriptions as the player reads them ("+10% Melee", "+8 AC while a shield is in the off hand"); a partial node's says only its stage-1 effect.

### Shared constraints (from the index)

- **Environment.** The system Node is 22; Node 26 is at `~/.nvm/versions/node/v26.13.0/bin`. Prefix every npm or node command with `PATH=$HOME/.nvm/versions/node/v26.13.0/bin:$PATH`. Podman is also available for the `Makefile` targets (`make test`, `make simulate ARGS="..."`, `make test-browser`).
- **Commands:**
  - `npm test` (`tsc && vitest run`) is the gate before the commit;
  - `npx vitest run <file>` for one file; `npx vitest run --project domain`;
  - `npm run test:browser` (or `-- -t <name>`) after any scene change; read `e2e/CLAUDE.md` before touching an in-browser test.
- **The simulator.** Run one at a time, never two at once, each with its own `--out` under `logs/`. No measurement in this step (step 08 measures).
- **The refactor guard.** This step changes play: re-record the fixture (`GUARD_RECORDS`, `GUARD_EVENTS_SHA256` in `scripts/simulate.test.ts`, `--parties 1`, 5 campaigns from seed 1) in this commit, and say in the commit message that the trees, the pick economy and the plans changed play.
- **Determinism.** A battle replays from its seed. Nothing here adds a draw to the RNG.
- **Domain first.** Every rule lives in the Phaser-free modules with tests; scenes decide nothing; `perkTree.ts` stays free of runtime Phaser imports.
- **A node is data.** A new node of an existing shape is one entry in `PERKS`; the tree helper places it with no new code.
- **`tsc` is the linter**: `noUnusedLocals`, `noUnusedParameters`, `erasableSyntaxOnly`, `verbatimModuleSyntax`, `.ts` extensions in imports.
- **Commits.** One commit for this step once `npm test` passes, on `skill-trees`, without pushing. Never switch branches. Message "Skill trees step 03: trees, nodes and picks". No attribution lines.
- **Docs.** `CLAUDE.md` stays current: fix the lines this change makes wrong and search it for every name renamed or removed.

## 3. Dependencies and prerequisites

- **Step 01 (done):** baseline figures recorded in the index; `src/game/fixtures/save-v22.json` committed (unused by this step; step 05 loads it).
- **Step 02 (done):** `SPELL_IDS` holds `frostbite`, `meteor`, `mass_haste`, `lay_on_hands`, `ward`, `web` and `curse` (web and curse left `MONSTER_SPELL_IDS`, so `HeroSpellId` includes them); `STATUS_IDS` holds `warded` with `StatusRule.wardAll`. Every spell node of the table above names a `HeroSpellId` that exists.
- **Existing code at `50fb4cf`, for reference:**
  - `src/character/perks.ts`: `PERKS` (45 perks: toughness, dodger, heavy_hand, deadly_aim, keen_eye, far_shot, quick_study, scholar, tireless, spellcasting, weapon_training, armor_breaker, marksmanship, arcane_study, mighty_blow, weapon_mastery, sunder, eagle_eye, deep_well, arcane_mastery, evasion, fortune, gain_* ×6, then the 17 spell perks by `spellPerk`); `Perk` with `ranks`, `level`, `branch`, `school`, `requires`; `SPELL_TIERS`; `TRUNK_PERKS`; `perkRanks`, `perkBonus`, `attributeLevel`, `attributesOf`, `isSpellPerk`, `SPELL_PERK_IDS`, `spellPerkOf`, `perkParent`, `knownSpells`, `cappedAttribute`, `missingRequirements`, `qualifiesFor`, `availablePerks`, `describePerkRequirements`. `skills.ts` and `perks.ts` import each other.
  - `src/character/progression.ts`: `PERK_LEVEL_STEP` 3, `SPELLCASTING_SPELL_PICKS`, `hasSpellcasting`, `nextSpellLevel`, `nextPerkLevel`, `hasPickFor`, `canAdvance`, `XpGain.spellsGained`, `levelUp`, `gainXp`, `takePerk` (spell picks first; Spellcasting adds its picks), `AUTO_PERKS`, `AUTO_SPELLS`, `autoAdvance(character)`.
  - `src/character/creation.ts`: `CREATION_PERK_PICKS` 3, `picksLeft`, `spellPicksLeft`, `draftCasts`, `togglePerk`, `pruneDraft`, `draftCharacter` (spends with `raiseSkill` and `takePerk`, so a draft's perk order matters for skill asks).
  - `src/character/character.ts`: `Character.spellPicks`; `maxMana` (0 unless a spell is known; leave its formula to step 04, changing only what this step's removals force).
  - `src/game/party.ts`: `PREROLLS`, `READY_MADE`, `readyMadeParty`; `src/game/bandits.ts`: role drafts, `banditStats` (cached) calling `autoAdvance`, and the test that a hero built from `banditDraft` has the bandit's stats.
  - `src/scenes/perkTree.ts`: `TreeKind`, `perkTreeLayout`, node states and hints for a character and a draft; `PerkTreeView.ts` draws them; `InventoryScene` (P perk tree, K spell tree, `PanelTab` `'perkTree' | 'spellTree'`) and `CreationScene` (`TREE_SWITCH`) switch between the two; `draftInfo.ts`, `debugCommands.ts` (lists `spellPicks`) and `src/testHook.ts` read the old API.
  - `src/game/save.ts`: `SAVE_VERSION` 22, `migrateFrom18`, the fixture `src/game/fixtures/save-v18.json` (holds `spellPicks` and old perk ids).
  - Files that import the removed names (grep at `50fb4cf`): `e2e/character.test.ts`, `e2e/manual.shots.ts`, `e2e/party.test.ts`, `src/character/{character,creation,perks,progression}.ts` and their tests, `src/game/party.ts`, `party.test.ts`, `save-v18.json`, `src/scenes/{CreationScene,debugCommands,draftInfo,InventoryScene,perkTree,PerkTreeView}.ts`, `perkTree.test.ts`, `src/testHook.ts`.

## 4. Scope and implementation guidance

### 4.1 `src/character/trees.ts` (new)

C1 as written. Path colours: pick three per tree that read on the panel's dark background; step 06 uses them for headings. `calling` counts nodes per path with `pathDepth` and returns every path at the maximum, in `PATH_IDS` order. `capstoneOf` returns the first held node whose tier is `'capstone'`.

### 4.2 `src/character/perks.ts`

- Replace `Perk` with C2's shape (without `ability` and `trait` for now). Drop `ranks`, `level`, `branch`, `school`, `SPELL_TIERS`, `spellPerk`, `gain`, `TRUNK_PERKS`, `isSpellPerk`, `SPELL_PERK_IDS`, `spellPerkOf`; add `perkLevel`, `NodeKind`, `nodeKind`, `perkTeaching`.
- Add the new `PerkEffects` keys with one-line doc comments naming the step that derives them; remove `xpPercent` and its reader (grep for it).
- `PERKS` = the 57 nodes, in C3's order. A helper for spell nodes (taking the spell id, path, tier, asks and `requires`) is fine; it must not call into `trees.ts` at load.
- `perkRanks` returns 0 or 1. `missingRequirements` per C2's wording and order; `qualifiesFor` false for a held node; `availablePerks` unchanged in kind. Depth uses `pathDepth` on the node's own path. The capstone checks use `calling` and `capstoneOf`.
- `perkParent` returns `requires` or null. `cappedAttribute` still refuses an attribute node that would pass 10 (Gain Strength's +2: refuse when the attribute is above 8, or take the cap; say which in the description and test it).

### 4.3 `src/character/progression.ts`

- C4: `PICK_LEVEL_STEP` 2, `picksAt`, `levelUp` gives a pick at each even level, `nextPerkLevel` the next even level, `takePerk` spends one perk pick only, `hasPickFor`/`canAdvance` lose the spell branch, `XpGain.spellsGained` removed.
- C5: `PLAN_IDS`, `AUTO_PLANS` (stage-1 contents above; parity plans derived from `PERKS` by path), `planFor`, `autoAdvance(character, plan)`. The fallback never takes a capstone.

### 4.4 `src/character/creation.ts` and `character.ts`

- Creation: `picksLeft` counts perk picks only; remove `spellPicksLeft` and `draftCasts`; `togglePerk` and `pruneDraft` unchanged in kind (a T1 node only at level 1, by its asks).
- `Character.spellPicks` removed everywhere; `maxMana` changes only as the removals force (step 04 rewrites it).

### 4.5 Pre-rolls and bandits

- `src/game/party.ts`: the ready-made three and Garrick as C5 says; the other pre-rolls on T1 nodes of their role. Order each draft's picks so its skill asks are met as `draftCharacter` spends them (Delwyn: `arcane_study` before the spells if his Magic needs it). Keep each pre-roll's attributes, tag and skill points unless a pick forces a change, and say so in the record.
- `src/game/bandits.ts`: role drafts as C5 says; `banditStats` passes the role's plan to `autoAdvance` (Archer and Crossbowman `ranger`, Cutthroat `rogue`, Brute `swordmaster`, Hedge-Mage `bandit_mage`, Captain `knight`); `banditDraft` heroes built the same way stay equal to bandits (the existing test).
- `scripts/simulate.ts`: compile against the new API (`autoAdvance` with its default plan; no `spellPicks`). No new flags (step 15).

### 4.6 `src/scenes/perkTree.ts` and the interim wiring (decision 3)

- Rework `perkTree.ts` to C9: `treeLayout(tree)` (row 0 the heading row, nodes from row 1 in `PERKS` order within their path's column), `nodeState` with `'locked'` for a capstone closed by the calling rule or a held capstone, `nodeHint` with the lock words, `draftNodeHint`, `tierBands` (the first row of each tier present in the tree).
- Interim: `PerkTreeView`, `InventoryScene` and `CreationScene` call `treeLayout('warrior')` where they drew the perk tree and `treeLayout('mage')` where they drew the spell tree; the switches keep their labels. Remove K's and the spell tree's use of spell picks. `draftInfo.ts` and `debugCommands.ts` drop `spellPicks` and the removed names. `src/testHook.ts` types follow. Do not redesign the view: step 06 does.

### 4.7 `src/game/save.ts`

- `SAVE_VERSION` 23; `Character` validation without `spellPicks`, perk ids checked against the new `PERKS`. Version 22 and version 18 files read as unreadable until step 05 (decision 7). The existing test that the v18 fixture loads is changed to expect `null`, with a comment naming step 05, which restores it.

### 4.8 Exclusions

- No new `PerkEffects` reader (step 04), no mana for all (04), no migration (05), no new view (06), no tabs or title (07), no abilities or traits (09 on), no measurement (08).

## 5. Verification

### Tests (in `npm test`)

- `src/character/trees.test.ts` (new):
  - every path has its stage-1 nodes, each of one rank, tiers in order, at most one capstone; `PERKS` has 57 nodes in C3's order;
  - `pathDepth`, `treeNodes`; `calling` with no nodes (`[]`), one deepest, and a tie (both paths); `capstoneOf`;
  - **AC1 (stage-1 subset):** an Evoker who takes both Evoker T1s at creation and each even-level pick in Evoker (by `takePerk` after `gainXp`, Magic raised enough) takes a T3 at level 6 and Meteor at level 12, and not before; the same for Arcanist and Mass Haste.
  - **AC2 (stand-ins):** a level 14 character holding 5 Evoker and 6 Arcanist nodes (set directly), with the asks met, qualifies for Mass Haste and not Meteor; with Mass Haste taken, Meteor stays closed even after Evoker becomes deeper; a 5–5 tie opens both until one is taken.
- `src/character/perks.test.ts` (rewritten): tier level and depth asks; `anySkill` wording "Melee 40% or Archery 40%"; capstone words; `nodeKind` (`spell` for magic_arrow, `passive` for dodger); `perkTeaching`; `requires`; Gain Strength's cap; asks gate taking, not keeping.
- `src/character/progression.test.ts` (rewritten): **AC3**: picks at levels 2, 4, 6 and none at 3, 5 through `gainXp`; `picksAt(1)` 3, `(5)` 5, `(10)` 8, `(20)` 13; `takePerk` spends one pick; no `spellPicks` on a character; `autoAdvance` follows each written plan and spends every pick it can, never a capstone by fallback; `planFor` by tag.
- `src/character/creation.test.ts`: a level 1 draft spends exactly 3 picks; only T1 nodes can be taken; the pre-rolls are legal.
- `src/game/party.test.ts`, `src/game/bandits` tests: the ready-made party's picks as C5; bandit drafts legal; a hero built as a bandit has the bandit's stats.
- `src/scenes/perkTree.test.ts` (rewritten): `treeLayout` for each tree: columns 0–2 by path, row 0 free, no two nodes share a cell, `from` = `requires`; `nodeState` `'locked'` with each lock hint; `tierBands`.
- `scripts/simulate.test.ts`: the guard fixture re-recorded (decision 2); the rest green.

### Commands

```sh
export PATH=$HOME/.nvm/versions/node/v26.13.0/bin:$PATH
npx vitest run src/character src/scenes/perkTree.test.ts
npm test
npm run test:browser
```

This step changes scenes (interim wiring), so run `npm run test:browser`. Failures are allowed only where the interim view (decision 3) is the cause, expected in `e2e/character.test.ts` ("lists only the perks a hero has taken, and shows them all in the perk tree", "takes a perk from the tree with the pick that the third level brings", which now needs the second level's pick) and `e2e/party.test.ts`'s creation through all four steps if it clicks perks by name. Update a test to the interim view where that is a small change; list every test still failing, with its reason, in the execution record for step 06 to restore. Any other failure is this step's bug.

### Acceptance

- AC1 (stage-1 subset), AC2 (stand-ins) and AC3 by the tests above.
- The game starts with the ready-made party, a hero levels to 2 and takes a node from the interim view, and a battle is won (by hand or the in-browser tests).

## 6. Completion criteria

- [x] `trees.ts`, the new `Perk`, the 57 nodes, the economy and the plans as C1 to C5; `perkTree.ts` as C9.
- [x] Every removed name is gone from `src/`, `scripts/` and `e2e/` (grep), and from `CLAUDE.md`.
- [x] Pre-rolls, ready-made party and bandit drafts rebuilt and legal; bandit-equals-hero test green.
- [x] `SAVE_VERSION` 23; the v18 test temporarily expects unreadable, naming step 05.
- [x] Guard fixture re-recorded; `npm test` passes.
- [x] `npm run test:browser` run; interim failures listed in the record.
- [x] `CLAUDE.md` updated: the `src/character/` lines on perks, `progression.ts` and `creation.ts`, the rules of creation, of perks and spells, and of progression (picks every even level, the trees, the calling and capstone, no spell picks or Spellcasting, plans), the save version in the rules of saving.
- [x] Committed as "Skill trees step 03: trees, nodes and picks"; this step's status and commit set in the [index](index.md).

## 7. Execution record

**Done.** Commands (Node 26): `npx vitest run src/character src/scenes/perkTree.test.ts` green (173 + 12); `npm test` 85 files, 1534 tests green; `npm run build` green; `npm run test:browser`: after the interim updates below, a full run gave 113 of 115, the two failures 60 s timeouts ("drags gear between the equipment, the backpack and the baggage", "forms, renames, fills and disbands a second party at hall level 4") with the machine at a load average of 25 to 31; both pass when run alone (`-t`), and neither touches perks. Every other test passed in the full run. No simulator measurement (step 08's).

**What was built.** `src/character/trees.ts` (C1, path colours chosen for the dark panel); `perks.ts` rewritten to C2 with the 57 stage-1 nodes in C3's order (a `spellNode` helper, no call into trees.ts at load); `progression.ts` to C4/C5 (`PICK_LEVEL_STEP`, `picksAt`, `PLAN_IDS`, `AUTO_PLANS`, `planFor`, `autoAdvance(character, plan)`); `creation.ts` (`perkPicksLeft` counts nodes; `spellPicksLeft`, `draftCasts` gone); `Character.spellPicks` gone; pre-rolls and bandit drafts as C5 (`BANDIT_PLAN` exported from bandits.ts so the hero-equals-bandit test builds the same way); `perkTree.ts` to C9; `SAVE_VERSION` 23 (characters' perks must be known ids at rank 1).

**Decisions and deviations.**
- `nodeHint` keeps its existing third argument `canAdvance` (C9: "existing exports keep their callers' shapes").
- Attributes: `attributeLevel` now stops at 10. `cappedAttribute` refuses only a node whose every effect is an attribute (Gain Strength, refused above Strength 8, as its description says); Toughness, Far Shot, Skirmisher, Fortune and Lasting Magic are never refused for their +1, the attribute just stops at 10 (tested). Refusing Toughness to an END 10 hero would have been absurd.
- Skill asks are worded with short names ("Melee 40%", "Archery", "Magic") per C2, in both `missingRequirements` and `describePerkRequirements`; depth "1 node in X" / "N nodes in X".
- `nodeState` 'locked' only when a capstone is closed by a held capstone or by a calling that exists and excludes its path; a hero with no node at all sees a capstone 'closed'.
- `XpGain.xp` keeps `Math.round(xp)` (no `xpPercent`).
- Pre-rolls: picks as C5; attributes, tags and skill points unchanged (Aldric's order now weapon_training, heavy_hand, toughness; Delwyn magic_arrow, heal, arcane_study; Garrick weapon_training, marksmanship, dodger). Bandits: Brute's armor_breaker → toughness, Hedge-Mage magic_arrow, shield, arcane_study; others unchanged.
- Characterization fixtures that hash or read the ready-made party moved with Aldric's Toughness (+8 HP, +1 END) and the character shape: `src/game/camp.test.ts` RESULT/MEMBERS and `src/game/worldMap.test.ts` SESSION_SHA256 re-recorded, each with a comment.
- The refactor guard re-recorded (commit message says why). All five guard campaigns now reach the Source (one did before): the trees' single-rank nodes are worth two old ranks and picks come at even levels. Step 08 measures; flagging that play moved notably.
- Interim view (decision 3): `PerkTreeView` draws `treeLayout('warrior')` for the perk tree and `treeLayout('mage')` for the spell tree, row 0 a path heading (name, depth, calling in gold), a kind-coloured edge, "* " before a capstone, `requires` lines down the column's left gutter; the strip stays at 11 rows. Creation keeps the Perks/Spells switch mapped to those two trees. The Scout and Cleric trees cannot be clicked in the UI until step 06 (Brenna's and Delwyn's Ranger/Rogue/Healer nodes still show in the Skills tab list and Spells tab).
- `docs/manual/README.md` still describes Spellcasting and the old perks; the plan gives manual text to step 08.

**In-browser tests changed to the interim view** (none left failing for step 06 to restore): `e2e/party.test.ts` (creation's perks step: tier-2 nodes closed, Mage tree of 22 nodes with none open, a node of one rank given back and retaken; Mira's Melee 55/57; Aldric's pick order); `e2e/character.test.ts` (taken perks in PERKS order, Delwyn's one passive, Warrior tree 11 nodes, Mage tree 22 with arcane_study and magic_arrow, battle tree 11; the level-2 pick still waiting after the skill points are spent; the node-taking test now takes Armour Breaker with the level-2 pick); `e2e/world.test.ts` (two time-control tests plant Aldric at 4 hp, as he now has 35). Step 06 will need to rewrite these again for the four tabs.

**For later steps.** `BANDIT_PLAN` in bandits.ts; `TreeSwitch` in CreationScene is the interim 'perks' | 'spells' switch; `KIND_COLOURS` in PerkTreeView already has at-will and mana entries. v22 and v18 saves read as unreadable until step 05 (save.test.ts tests say so and name step 05).

