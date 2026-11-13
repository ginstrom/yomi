# Step 13: Stage-2 nodes and plans

[Plan index](index.md) · [Design](../../designs/skill-trees.md) (R1, R2, R10; §4.3 the trees, §5.1 data, §5.8 party, bandits and simulator) · [Feature record](../../features/skill-trees.md)

**Difficulty:** sonnet. Pass `model: "sonnet"` to the engineer; leave the reviewer's model unset. The engine (steps 09 to 11) and the policy (step 12) already handle every technique; this step is data entries in `PERKS`, plan lists in a fixed order, and tests that follow existing patterns. It moves play, so it re-records the refactor guard.

## 1. Objective

The 18 stage-2 nodes (the 17 techniques and Rooted) join `PERKS`, each linking the ability it teaches or the trait it switches on. Battle Mage gains its Strikes' elemental +2. `AUTO_PLANS` takes the new nodes at the positions C5 gives, so the ready-made party, the pre-rolls and the bandits (the Captain's Taunt, Rooted and Pin, the Brute's Power Attack and Cleave, the Cutthroat's Dirty Trick and Sprint) learn their techniques as they level. After this step the simulator's heroes and bandits use techniques in battle, and the tree view shows 75 nodes with no code change.

## 2. Requirements and context

- **R1:** four trees of 7 or 8 single-rank nodes; every node is a perk, as data. Stage 2 brings `PERKS` from 57 to 75 nodes.
- **R2:** a node is a passive, an at-will active or a mana active; `nodeKind` derives which.
- **R10:** `autoAdvance` follows a plan per build; the pre-rolls and the bandits' drafts are built on the trees, and "a bandit fights as a hero of that draft would" stays true.
- **AC1 (R1, R3), in part:** a hero that takes both T1s of a path at creation and every later pick there reaches its T3 at level 6. With the stage-2 nodes, Swordmaster, Heavy Knight and Ranger now have enough nodes below T3 for that (their capstones arrive in stage 3, step 21).
- **Quality constraint:** a node is data. A new node of an existing shape is one entry in `PERKS`; the tree view places it with no new code.

### The 18 stage-2 nodes (design §4.3)

Kind: A at-will active, M mana active, P passive. "Asks" is beyond the tier's level and depth (C1's `TIERS`: T1 level 1 depth 0, T2 level 2 depth 1, T3 level 6 depth 3). The ability's numbers are already in `ABILITIES` (steps 09 and 10); the node's `description` words them as design §4.3 does.

| Path | Node (id) | Tier | Kind | Asks | Links |
| --- | --- | --- | --- | --- | --- |
| swordmaster | Power Attack (`power_attack`) | 2 | A | Melee 40 | `ability: 'power_attack'` |
| swordmaster | Cleave (`cleave`) | 3 | A | Melee 55 | `ability: 'cleave'` |
| heavy_knight | Taunt (`taunt`) | 2 | A | Endurance 5 | `ability: 'taunt'` |
| heavy_knight | Rooted (`rooted`) | 2 | P | Endurance 6 | `trait: 'rooted'` |
| heavy_knight | Pin (`pin`) | 3 | M | Melee 55 | `ability: 'pin'` |
| spellsword | Flame Strike (`flame_strike`) | 1 | M | Melee 30 | `ability: 'flame_strike'` |
| spellsword | Frost Strike (`frost_strike`) | 2 | M | Melee 40 | `ability: 'frost_strike'` |
| spellsword | Thunder Strike (`thunder_strike`) | 3 | M | Melee 55 | `ability: 'thunder_strike'` |
| ranger | Aimed Shot (`aimed_shot`) | 2 | A | Archery 40 | `ability: 'aimed_shot'` |
| ranger | Hunter's Mark (`hunters_mark`) | 2 | A | Archery 40 | `ability: 'hunters_mark'` |
| ranger | Volley (`volley`) | 3 | A | Archery 55 | `ability: 'volley'` |
| ranger | Pinning Shot (`pinning_shot`) | 3 | M | Archery 55 | `ability: 'pinning_shot'` |
| rogue | Sprint (`sprint`) | 1 | A | Agility 5 | `ability: 'sprint'` |
| rogue | Dirty Trick (`dirty_trick`) | 2 | A | Melee 40 | `ability: 'dirty_trick'` |
| assassin | Venom Strike (`venom_strike`) | 2 | M | `anySkill`: Melee 40 or Archery 40 | `ability: 'venom_strike'` |
| assassin | Hamstring (`hamstring`) | 2 | A | `anySkill`: Melee 40 or Archery 40 | `ability: 'hamstring'` |
| paladin | Smite (`smite`) | 1 | M | Melee 30 | `ability: 'smite'` |
| paladin | Consecrate (`consecrate`) | 3 | M | Melee 55 | `ability: 'consecrate'` |

Each goes into `PERKS` at its place in C3's order (by tree, path, then the listed order), not at the end. Their `effects` are `{}`.

**Battle Mage** (`battle_mage`, already in `PERKS` from stage 1 with `{ maxMana: 6 }`): its effects become `{ maxMana: 6, imbueDamage: 2 }` and its description "+6 mana; its Strikes' elemental damage +2". Mana on hit waits for step 21 (decision 1).

### Decisions from the index (unchanged)

1. **When a node enters `PERKS`.** A node joins `PERKS` in the first stage that can deliver its effect (table C3). Six passives enter in stage 1 with only their derived part and are completed later, because the v22 migration maps folded perks onto three of them and their derived part works at once: `iron_skin` (+2 resistance; free-attack bonus in stage 3), `battle_mage` (+6 mana; Strikes' elemental +2 in stage 2; mana on hit in stage 3), `skirmisher` (+1 Agility; +10 to hit after moving in stage 3), `fortune` (+10% critical, +1 Luck; critical damage in stage 3), `deadeye` (+10% Archery, Eagle Eye's effect; pierce and triple dice in stage 3) and `serenity` (friendly range +2; mana regained in stage 3). A node's `description` says only what works in its stage; the step that completes it rewrites the description. Some stage-1 nodes cannot be reached by depth until their path's later nodes arrive (Fortune, Iron Skin, Deadeye): that is expected.
2. **The refactor guard.** `scripts/simulate.test.ts`'s fixture moves whenever play moves. A step that changes what the simulator plays (data, plans, the economy, a spell's or node's numbers, the order of `ALL_SPELL_IDS`) re-records the fixture in its own commit and says why in the commit message. A step that only adds engine rules, statuses or policy branches that no simulated unit can yet reach **must keep the fixture green unchanged**; a mismatch there is a bug. Steps that must keep it green: 05, 06, 07, 09, 10, 11, 12, 14, 15, 17, 18, 19, 20, 22. Each stage's measurement step re-records it last.
4. **Plans.** `AUTO_PLANS` names fifteen plans (C5). The design's six are written out in full; the parity plans are their path's nodes in `PERKS` order. A plan lists only nodes present in `PERKS`, so stage 1 writes each plan without its later nodes and steps 13 and 21 insert them at the positions C5 gives. The Captain follows `knight` (Rooted before Taunt), not the design's §5.8 "Taunt (L2), Rooted (L4)"; the Cutthroat's plan takes Sprint before Tumble, since Tumble asks Rogue depth 3, which a Cutthroat cannot have at level 6 otherwise.

### Contracts (copied unchanged from the index)

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

**C3. The 95 nodes and their stage (steps 03, 13, 21)**

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

**C5. Plans (step 03; extended by 13 and 21; read by 15)**

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

### The plans after this step

With every stage-1 and stage-2 node present and no stage-3 node yet, the design plans read (C5's order, stage-3 ids left out):

- `knight`: weapon_training, heavy_hand, toughness, rooted, taunt, pin, iron_skin, shield_wall, power_attack, armor_breaker, weapon_mastery
- `swordmaster`: weapon_training, heavy_hand, power_attack, armor_breaker, cleave, gain_strength, weapon_mastery, toughness
- `ranger`: marksmanship, deadly_aim, aimed_shot, far_shot, volley, hunters_mark, pinning_shot, deadeye, dodger, sprint, skirmisher, evasion
- `rogue`: dirty_trick, sprint, evasion, skirmisher
- `evoker_healer` and `bandit_mage`: unchanged from stage 1 (no stage-2 node in them)
- the path plans (`spellsword`, `assassin`, `evoker`, `cryomancer`, `arcanist`, `healer`, `paladin`, `saint`, `rogue_archer`): their path's nodes in `PERKS` order. If step 03 derives them from `PERKS` (a filter by path), they take the new nodes with no edit; if it wrote them out, insert the new ids at their `PERKS` positions.

### Shared constraints (from the index)

- **Environment.** The system Node is 22; Node 26 is at `~/.nvm/versions/node/v26.13.0/bin`. Prefix every npm or node command with `PATH=$HOME/.nvm/versions/node/v26.13.0/bin:$PATH`. Podman is also available for the `Makefile` targets (`make test`, `make simulate ARGS="..."`, `make test-browser`).
- **Commands:** `npm test` (`tsc && vitest run`) is the gate before the commit; `npx vitest run <file>` for one file; `npx vitest run --project domain`; `npm run test:browser` (or `-- -t <name>`) after any change an in-browser test sees; read `e2e/CLAUDE.md` before changing an in-browser test.
- **The simulator.** Measurement is step 16's, not this step's. If you run it at all, one run at a time, with its own `--out` under `logs/`.
- **The refactor guard** (`scripts/simulate.test.ts`, `describe('the refactor guard')`: 5 campaigns from seed 1, `--parties 1`). This step moves play (decision 2): re-record the fixture (`GUARD_RECORDS` and `GUARD_EVENTS_SHA256`) in this step's commit, and say in the message that the stage-2 nodes and plans moved it.
- **Determinism.** A battle replays from its seed. This step adds no rule and no draw; the engine already resolves every technique.
- **A node is data.** Each new node is one entry in `PERKS`; the ability it teaches is already in `ABILITIES`. The tree view (`perkTree.ts`, `PerkTreeView.ts`) must place the 18 with no code change.
- **`tsc` is the linter**: `noUnusedLocals`, `noUnusedParameters`, `erasableSyntaxOnly`, `verbatimModuleSyntax` (`import type`), `.ts` extensions in imports.
- **Commits.** One commit for this step once `npm test` passes, on `skill-trees`, without pushing. Never switch branches. Message "Skill trees step 13: stage-2 nodes and plans". No attribution lines.
- **Docs.** `CLAUDE.md` stays current: fix the lines this change makes wrong and search it for every name renamed or removed.

## 3. Dependencies and prerequisites

- **Step 03** (done): `trees.ts` (C1), the new `Perk` (C2) with `ability?` and `trait?` fields, `PERKS` with the 57 stage-1 nodes, `AUTO_PLANS`, `planFor`, `autoAdvance(character, plan)` (C5), the pre-rolls and bandit drafts on the trees.
- **Step 04** (done): `deriveCombatStats` reads the new effects; `magic` is emitted for a hero that knows a spell.
- **Step 09** (done): the 14 strike and status techniques in `ABILITIES` with design §4.3's numbers; `Ability.manaCost`, `weaponAp`, `needs`, `selfStatus`, `foeStatus`; `knownAbilities(character)`; `deriveCombatStats` emits `abilities: knownAbilities(character)` when there are any and `magic` for a hero that knows an ability with a `manaCost`; `CombatantStats.imbueDamage`, added to each elemental on-hit entry of a Strike.
- **Step 10** (done): Volley, Consecrate and Taunt's area in `ABILITIES`.
- **Step 11** (done): `TraitId` (`TRAIT_IDS`, C12) with `'rooted'`; `traitsOf(character)`; `CombatantStats.traits`, which `deriveCombatStats` emits; the Rooted, Taunt and Pin rules.
- **Step 12** (done): the policy uses techniques, taunts, marks and sprints.
- **Check before relying on it:** that `deriveCombatStats` emits `traits` from `traitsOf` and `imbueDamage` from `perkBonus(character, 'imbueDamage')`. If step 09 or 11 left either out because no node carried it yet, add it here, with a `character.test.ts` case.

## 4. Scope and implementation guidance

### 4.1 `src/character/perks.ts`

- Add the 18 nodes of section 2's table, each at its place in C3's order. Name, `path`, `tier`, asks (`attributes`, `skills` or `anySkill`), `effects: {}`, and `ability` or (Rooted) `trait: 'rooted'`. Their descriptions word what the node does, as design §4.3's Effect column does, including cost and AP for an active ("3 mana, weapon AP + 1, recharge 1, melee weapon only. A weapon blow; a hit that leaves the foe standing pins it for 1 turn."). If step 09 gave `ABILITIES` a `description` worded for the battle, the node may build its description from it, as stage 1's spell nodes do from `SPELLS`.
- Battle Mage: effects `{ maxMana: 6, imbueDamage: 2 }`, description "+6 mana; its Strikes' elemental damage +2".
- `nodeKind` needs no change: the techniques with a `manaCost` (pin, flame_strike, frost_strike, thunder_strike, pinning_shot, venom_strike, smite, consecrate) are `'mana'`, the rest `'at-will'`, Rooted `'passive'`.

### 4.2 `src/character/progression.ts`

- `AUTO_PLANS`: the lists in "The plans after this step", in that order.
- Nothing else changes: `autoAdvance`, `planFor` and the fallback are step 03's.

### 4.3 `src/game/party.ts` and `src/game/bandits.ts`

- No draft changes (every creation pick in C5 is a stage-1 node). The bandits now learn their techniques through their plans: the Captain (`knight`) Rooted at 2, Taunt at 4, Pin at 6; the Brute (`swordmaster`) Power Attack at 2, Armour Breaker at 4, Cleave at 6; the Cutthroat (`rogue`) Dirty Trick at 2, Sprint at 4; the Archer and Crossbowman (`ranger`) Aimed Shot at 2, Far Shot at 4, Volley at 6. Each only where its asks hold at that level (skills grow with `autoAdvance`'s points; a node it does not yet qualify for is passed over for the plan's next). `banditStats` is cached: make sure the cache is keyed so that it builds afresh in tests (it is built per run already; nothing persists between runs).
- The test that a hero built as a bandit (`banditDraft`, the same gear, levels and `autoAdvance`) has the same stats must still pass: both go through the same plan.

### 4.4 `src/scenes/` (no code change expected)

- The tree view places the new nodes from `PERKS`. Heavy Knight, Ranger and Swordmaster now hold 7 nodes each and the Rogue, Assassin, Spellsword and Paladin columns grow; check in `perkTree.test.ts` that no two nodes share a cell and every node fits (the test from step 06 should already say so for any count). If a test fixes the stage-1 count (57, or a per-tree count), update it to the new one (75; Warrior 7+7+6 = 20 with the stage-3 nodes still absent, Scout 7+5+4 = 16, Mage 21, Cleric 7+6+5 = 18); do not change layout code. If a column overflows, stop and report it: step 06 promised any count up to 8 a path.
- `foeInfo.ts` describes abilities from their data (step 14 teaches it the new fields). Here, only check that a bandit's techniques appear in its hover lines without throwing: add a case to `src/scenes/foeInfo.test.ts` (create it if it does not exist) for a level-6 Captain, whose stats carry `taunt` and `pin`. If `foeInfo` cannot word `weaponAp` or `manaCost` yet, assert only that a line names each ability; step 14 words the costs.

### 4.5 `e2e/`

- `e2e/character.test.ts`'s tree test (rewritten by step 06) counts nodes per tree. Update its expected counts to stage 2's. Change nothing else in `e2e/`.

### 4.6 `scripts/simulate.test.ts`

- Re-record the refactor guard's fixture (decision 2). The other simulator tests that assert on what a level-N hero holds may need their expectations moved; move them only where the new plans explain it, and say which in the execution record.

### 4.7 `CLAUDE.md`

- The `bandits.ts` line: each role's plan and what its bandits now use (the Captain taunts, roots and pins; the Brute power-attacks and cleaves; the Cutthroat uses Dirty Trick and Sprint; the Archer aims, marks and volleys at the levels the threat calls for).
- The `progression.ts` line or the rules of progression: the plans now hold the stage-2 nodes.
- Search for any count of nodes ("57") and update it.

### 4.8 Exclusions

- No engine, policy or scene logic (steps 09 to 12, 14). If a technique misbehaves once heroes and bandits hold it, report it as a defect of the step that built it rather than patching around it here, unless the fix is a data error in this step.
- No stage-3 node (step 21). No tuning of any number (stage 4).
- The Skills menu in battle is step 14's: until then, a player's hero can learn a technique on the world map, but the battle screen's Cast button lists only spells. That is expected between steps.

## 5. Verification

### Tests (in `npm test`)

- `src/character/perks.test.ts`:
  - `PERKS` holds 75 nodes; each of the 18 is in its path at its C3 position, with the tier, asks and `ability`/`trait` of section 2's table.
  - `nodeKind`: `power_attack`, `cleave`, `taunt`, `aimed_shot`, `hunters_mark`, `volley`, `sprint`, `dirty_trick`, `hamstring` are `'at-will'`; `pin`, `flame_strike`, `frost_strike`, `thunder_strike`, `pinning_shot`, `venom_strike`, `smite`, `consecrate` are `'mana'`; `rooted` is `'passive'`.
  - `anySkill`: Venom Strike is open to a level-2 hero with one Assassin node and Archery 40% but no Melee, and to one with Melee 40% but no Archery; `missingRequirements` says "Melee 40% or Archery 40%" to one with neither.
  - `knownAbilities` lists a hero's techniques in `ABILITY_IDS` order; `traitsOf` lists `rooted` for a hero with Rooted.
- `src/character/trees.test.ts` (AC1, in part): a hero that takes both T1s of Swordmaster at creation and then Power Attack (2), Armour Breaker (4) reaches Cleave at level 6; likewise Heavy Knight (Toughness, Shield Wall; Taunt, Rooted; Pin at 6) and Ranger (Marksmanship, Deadly Aim; Aimed Shot, Far Shot; Volley at 6). Give each the attributes and skills its asks need.
- `src/character/progression.test.ts`: `autoAdvance` follows each plan level by level, from the draft through level 7 (the highest a bandit reaches), asserting the node taken at each even level:
  - `knight` from Aldric's draft: Rooted (2), Taunt (4), Pin (6) when his Melee is then 55% or more, else the next node of the plan he qualifies for.
  - `ranger` from Brenna's: Aimed Shot (2), Far Shot (4), Volley (6).
  - `swordmaster` from the Brute's: Power Attack (2), Armour Breaker (4), Cleave (6).
  - `rogue` from the Cutthroat's: Dirty Trick (2), Sprint (4), then Evasion (6) if its Agility is 8, else Skirmisher.
  - Work out each expectation from the drafts' real attributes and skills, and write it as such; where a draft does not qualify at the level the design's table names, the test states the plan's actual next node.
  - Every pick is spent at every level (`perkPicks === 0`).
- `src/character/character.test.ts`: a hero with Battle Mage has `imbueDamage: 2` in its stats; a hero with Pin has `magic` (with the mana its nodes and intelligence give) even with no spell; a hero with Rooted has `traits: ['rooted']`.
- `src/game/bandits.test.ts`: the hero-built-as-a-bandit test still passes for every role at levels 3 to 7; a level-6 Captain's stats list `taunt` and `pin` in `abilities` and `rooted` in `traits`.
- `src/scenes/perkTree.test.ts`: no two nodes share a cell and every node fits, with 75 nodes; counts per tree as in 4.4.
- `src/scenes/foeInfo.test.ts`: a level-6 Captain's hover lines name Taunt and Pin.
- `scripts/simulate.test.ts`: the guard passes against the re-recorded fixture.

### Commands

```sh
PATH=$HOME/.nvm/versions/node/v26.13.0/bin:$PATH npx vitest run src/character src/game/bandits.test.ts src/scenes/perkTree.test.ts src/scenes/foeInfo.test.ts
PATH=$HOME/.nvm/versions/node/v26.13.0/bin:$PATH npm test
PATH=$HOME/.nvm/versions/node/v26.13.0/bin:$PATH npm run test:browser
```

`npm run test:browser` must run: no scene code changes, but the in-browser tree test's counts do, and the battle tests now meet bandits that use techniques. Every in-browser test passes. If `fightBattle` loses with the winning seed because bandits or foes now fight differently, pick another seed that wins, as `e2e/CLAUDE.md` says.

### Acceptance checks

- `PERKS` has 75 nodes, in C3's order.
- The new node in the world-map tree view: open the character panel's tree view (`npm run dev`, P on the Skills tab) and see Power Attack, Taunt, Rooted and Pin under their paths with no overlap at 840×560.
- A short simulator run (`npm run simulate -- --battles 20 --seed 1 --encounter bandit_camp --threat 5 --party-level 6 --out logs/13-smoke.jsonl`) completes, and its log shows `ability` actions with hero ability ids for both sides.

## 6. Completion criteria

- [x] The 18 stage-2 nodes in `PERKS` at their C3 positions, with section 2's asks and links; Battle Mage's imbue and description.
- [x] `AUTO_PLANS` as in "The plans after this step"; the path plans hold their new nodes.
- [x] The tests of section 5 written and passing; `npm test` green with the guard fixture re-recorded.
- [x] `npm run test:browser` passes.
- [x] `CLAUDE.md` updated (4.7).
- [x] One commit, "Skill trees step 13: stage-2 nodes and plans", whose message says the guard was re-recorded because the stage-2 nodes and plans move play.
- [x] The index's step table shows step 13 `done (<commit>)`; the execution record below filled in.

## 7. Execution record

Commits: nodes and plans (see the index), then the guard re-record in its own commit, as decision 2 asks.

- Added the 18 nodes to `PERKS` through `techniqueNode` (description = cost words + `ABILITIES` description) and an inline Rooted; Battle Mage `imbueDamage: 2`. `AUTO_PLANS` knight, swordmaster, ranger and rogue take the new nodes; the path plans derive from `PERKS`.
- Carried-forward items done: `InventoryScene.takenPerks()` now keeps `nodeKind === 'passive'`; the tree strip's first line is cut to two lines by `clampLines` (perkTree.ts, 90 characters a line for the 12 px monospace strip), with a test over all 75 nodes that summary + asks + hint stay inside the 500 px panel by that estimate.
- `deriveCombatStats` already emitted `traits` and `imbueDamage`; no change.
- Re-recorded: `GUARD_RECORDS` and `GUARD_EVENTS_SHA256` (`15ec0921...c7571a`) in scripts/simulate.test.ts, and also the "choices of today's encounters" snapshot in src/engine/policies.test.ts (4790 lines, hash `176ecb43...` to 4646 lines, `5754c569...`): the ready-made party and the bandits now hold techniques, so both moved with the plans.
- Tests moved: perks.test (the "no ability/trait yet" tests became the node table; the level-1 offer list gained Flame Strike, Sprint and Smite), progression.test (plan sequences per draft), trees.test (75 nodes), perkTree.test (layout rows, counts 19/17/22/17 against the plan's 20/16/21/18, which assumed other splits), character.test (Battle Mage's imbue is real), bandits.test and foeInfo.test (new cases). No e2e count needed changing.
- **Deviation / finding:** the Captain (`knight` plan, draft Weapon Training + Toughness + Dodger) takes Heavy Hand at 2 (the plan lists it before Rooted and he lacks it), Rooted at 4, Taunt at 6 and no Pin by level 7. The task's "level-6 Captain has taunt and pin" does not hold; tests state the actual. Recommended fix (step 16 or 24, a plan-order change that moves play): move `heavy_hand` after `pin` in `knight`, or give the Captain's draft Heavy Hand. Aldric already holds it, so he is unaffected either way.
- Per-draft picks (levels 2/4/6): Aldric rooted, taunt, pin; Brenna and the Archer aimed_shot, far_shot, volley; Brute power_attack, armor_breaker, cleave; Cutthroat dirty_trick, sprint, evasion.
- Verification: `npm test` 1804 passed. `npm run test:browser` 115 passed on the second run; the first run (machine load average 18 to 34) had 17 timeouts and one race, none in the second. Smoke: `--battles 20 --encounter bandit_camp --threat 5 --party-level 6` logged aimed_shot 157, volley 31, taunt 13.

