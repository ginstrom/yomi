# Step 21: Stage-3 nodes, plans and the policy's last steps

[Plan index](index.md) · [Design](../../designs/skill-trees.md) (R1, R3, R10; §4.3 the trees, §5.4 engine rules, §5.5 the AI; AC1, AC2, AC6) · [Feature record](../../features/skill-trees.md)

**Difficulty:** opus / opus. Leave the engineer's and the reviewer's model unset. This step finishes the node data (the last 20 nodes and the six partial nodes), which moves the whole simulator's play, and adds the policy's last five decisions, whose order and thresholds decide how the heroes use Revive, Purify, Mass Haste, Renew, Glacial Prison, Ice Lance and Holy Light.

## 1. Objective

- `PERKS` holds all **95 nodes** of design §4.3: the 20 stage-3 nodes enter, each wired to the trait, effect or spell steps 17 to 20 built.
- The six partial nodes of stage 1 (decision 1) are **completed**: their remaining effects or traits are added and their descriptions rewritten to say everything they now do.
- `AUTO_PLANS` holds every plan in full (C5), the stage-3 nodes inserted at their positions.
- The `aggressive` policy gains its last steps (C16, design §5.5): `reviveCast` (1), `purifyCast` (3), `supportCast` (6), `prisonCast` (8), and Ice Lance's and Holy Light's scoring in `strikeCast` (10). Each is tested on a staged state; monsters choose exactly as before.
- AC1 and AC2 are proved in full, and AC6 is checked: every row of design §5.4's table has its engine test.

Play moves (new nodes in the plans, completed passives), so the refactor guard is re-recorded in this step's commit (decision 2).

## 2. Requirements and context

- **R1:** four trees, each of three paths of 7 or 8 single-rank nodes, 95 in all, every node a perk as data.
- **R3:** tiers ask a level and a depth; T1 to T3 open to every hero; the capstone asks level 12 and depth 5, needs its path to be the hero's calling (deepest; ties count as all tied paths), and a hero may take only one capstone, for good.
- **R10:** the `aggressive` policy uses the hero actives; `autoAdvance` follows a plan per build.
- **AC1 (R1, R3):** `PERKS` holds the 95 nodes of §4.3, each of one rank. A hero that takes both T1s of a path at creation and every later pick there reaches its T3 at level 6 and its capstone at level 12.
- **AC2 (R3):** a level 14 hero with 5 nodes in Swordmaster and 6 in Assassin can take Deathblow and cannot take Blademaster. Once it has Deathblow, no other capstone is open, whatever its depths later.
- **AC6 (R8):** each mechanic of §5.4 has an engine test, and the replay tests still pass.
- **Design §6, monster behaviour:** monsters use no new field; their choices over today's encounters are unchanged by the new policy steps.

### Decisions from the index (unchanged)

1. **When a node enters `PERKS`.** A node joins `PERKS` in the first stage that can deliver its effect (table C3). Six passives enter in stage 1 with only their derived part and are completed later, because the v22 migration maps folded perks onto three of them and their derived part works at once: `iron_skin` (+2 resistance; free-attack bonus in stage 3), `battle_mage` (+6 mana; Strikes' elemental +2 in stage 2; mana on hit in stage 3), `skirmisher` (+1 Agility; +10 to hit after moving in stage 3), `fortune` (+10% critical, +1 Luck; critical damage in stage 3), `deadeye` (+10% Archery, Eagle Eye's effect; pierce and triple dice in stage 3) and `serenity` (friendly range +2; mana regained in stage 3). A node's `description` says only what works in its stage; the step that completes it rewrites the description. Some stage-1 nodes cannot be reached by depth until their path's later nodes arrive (Fortune, Iron Skin, Deadeye): that is expected.
2. **The refactor guard.** `scripts/simulate.test.ts`'s fixture moves whenever play moves. A step that changes what the simulator plays (data, plans, the economy, a spell's or node's numbers, the order of `ALL_SPELL_IDS`) re-records the fixture in its own commit and says why in the commit message. A step that only adds engine rules, statuses or policy branches that no simulated unit can yet reach **must keep the fixture green unchanged**; a mismatch there is a bug. Steps that must keep it green: 05, 06, 07, 09, 10, 11, 12, 14, 15, 17, 18, 19, 20, 22. Each stage's measurement step re-records it last.
4. **Plans.** `AUTO_PLANS` names fifteen plans (C5). The design's six are written out in full; the parity plans are their path's nodes in `PERKS` order. A plan lists only nodes present in `PERKS`, so stage 1 writes each plan without its later nodes and steps 13 and 21 insert them at the positions C5 gives. The Captain follows `knight` (Rooted before Taunt), not the design's §5.8 "Taunt (L2), Rooted (L4)"; the Cutthroat's plan takes Sprint before Tumble, since Tumble asks Rogue depth 3, which a Cutthroat cannot have at level 6 otherwise.

### Contracts (copied unchanged from the index)

#### C2. Nodes (step 03; consumed by every later step)

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

#### C3. The 95 nodes and their stage (steps 03, 13, 21)

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

#### C5. Plans (step 03; extended by 13 and 21; read by 15)

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

#### C12. Taunt, Rooted and Pin (step 11)

```ts
// src/engine/battleEngine.ts
export const TAUNT_PENALTY = 25
// UnitRecord, UnitSnapshot gain moved: boolean  (false as its side's turn begins; true after its first step)
export interface StatusLaidEvent extends EventBase { type: 'status_laid'; unit: UnitId; status: StatusId; turns: number; cause: 'rooted' | 'shadowdancer' }
// AttackEvent, CastOutcome gain tauntPenalty?: number   (25 when applied)
// StatusEndEvent.reason gains 'source_fell' | 'moved' (step 20: 'cleansed')
// src/combat/combat.ts
export const TRAIT_IDS = ['rooted', 'tumble', 'counter', 'ambush', 'deathblow', 'blademaster', 'deadeye',
  'unbreakable', 'shadowdancer', 'guardian', 'courage', 'aegis', 'sanctuary', 'arcane_knight'] as const
export type TraitId = (typeof TRAIT_IDS)[number]
// CombatantStats gains traits?: readonly TraitId[]  (TRAIT_IDS order; only when non-empty)
// src/game/save.ts: SAVE_VERSION = 24; version 23 loads as is; BattleEngine.restore defaults `moved` to false
```

Rules: design §5.4's Taunt, Rooted and Pin rows and §4.7's edge cases.

#### C13. Stage-3 engine (steps 17–20; consumed by 21–23)

```ts
// CombatantStats gains (only when non-zero): opportunity?: { toHit: number; damage: number }; rear?: { toHit: number; damage: number };
//   movedToHit?: number; execute?: number; critDamage?: number; manaOnHit?: number; manaRegen?: number
// UnitRecord, UnitSnapshot gain attackedYet: boolean, endured: boolean, refunded: boolean,
//   fallenThisBattle: boolean, usedOnce: SpellId[]   (step 17 adds all five; restore defaults false / [])
// AttackEvent gains counter?: true, ambush?: true, deathblow?: true, apRefunded?: number, manaRestored?: number, endured?: true
// CastOutcome gains revived?: true, endured?: true; StatusTickEvent gains endured?: true
export interface RestoreEvent extends EventBase { type: 'restore'; unit: UnitId; hp?: number; mana?: number; cause: 'renewing' | 'sanctuary' | 'serenity'; source?: UnitId }
  // source: the Sanctuary unit whose aura healed (for "Sera's sanctuary restores 3 to Aldric.")
export interface AuraBonus { ac: number; toHit: number; resistance: number; wardAll: number }
export function auraBonus(units: readonly UnitSnapshot[], unit: UnitSnapshot): AuraBonus
  // best of each aura kind from standing allies in radius: guardian (+5 AC, radius 1, not itself), courage (+5 to hit, 2, not itself),
  // aegis (+2 resistance, +2 wardAll, 2, itself included); two of a kind do not stack
export function statsIn(units: readonly UnitSnapshot[], unit: UnitSnapshot): CombatantStats
  // effectiveStats plus auraBonus; the engine reads the same through its records, and every roll, preview and the policy use it
// LOG_SCHEMA_VERSION = 26 and SAVE_VERSION = 25 (step 17); version 24 loads as is
// Spell gains (step 20): bane?: true; bonusVs?: { statuses: StatusId[]; damage: DamageRoll }; cleanse?: true;
//   oncePerBattle?: true; SpellTarget gains 'fallen'
```

Rules: design §5.4's table, one row per mechanic.

#### C16. The policy (steps 12 and 21)

Design §5.5's order. Step 12 adds `tauntUse` (5), `markUse` (9), technique scoring in `bestStrike` (11), `sprintUse` (13) and the taunted-unit rule. Step 21 adds `reviveCast` (1), `purifyCast` (3), `supportCast` (6), `prisonCast` (8), and Ice Lance's and Holy Light's scoring in `strikeCast` (10).

```ts
// src/engine/policies.ts
export const STATUS_VALUE: Partial<Record<StatusId, number>>   // chilled 3, slowed 3, pinned 3, poisoned 7, baned 4; seared = the target's regeneration
export const MANA_WEIGHT = 0.5
```


### The 20 stage-3 nodes (design §4.3, restated)

Kinds: P passive, S spell. Every node has one rank. "Asks" is beyond its tier's level and depth (C1's `TIERS`: T1 level 1 depth 0; T2 level 2 depth 1; T3 level 6 depth 3; ★ level 12 depth 5, calling path, no other capstone). The engine side of each (trait, effect key, spell field) was built by the step named; this step adds only the `PERKS` entry and, for a spell, wires `spell`.

| Path | Node (id) | Tier | Kind | Asks | Effect | `PERKS` fields | Engine from |
| --- | --- | --- | --- | --- | --- | --- | --- |
| swordmaster | Blademaster (`blademaster`) | ★ | P | Melee 70 | Once a turn, a weapon blow or technique of its own that fells a foe gives back that action's AP | `trait: 'blademaster'` | 18 |
| heavy_knight | Guardian (`guardian`) | 3 | P | END 7 | Aura: allies beside it (not itself) get +5 AC; two Guardians do not stack | `trait: 'guardian'` | 19 |
| heavy_knight | Unbreakable (`unbreakable`) | ★ | P | END 8 | The first time each battle that damage would bring it to 0, it is left at 1 hit point and Shielded for 2 turns | `trait: 'unbreakable'` | 18 |
| spellsword | Arcane Knight (`arcane_knight`) | ★ | P | Melee 70 | Every melee hit adds +4 fire, as a rune does, and its Strikes cost wAP+0 | `trait: 'arcane_knight'`, `meleeOnHit: [{ damage: 4, element: 'fire' }]` | 17 (trait), 04 (meleeOnHit) |
| rogue | Tumble (`tumble`) | 3 | P | AGI 7 | Its moves provoke no free attacks | `trait: 'tumble'` | 17 |
| rogue | Counter (`counter`) | 3 | P | Melee 55 | Once per enemy turn, when a foe's melee blow misses it, it strikes back with a free attack if it holds a melee weapon and the foe is in reach | `trait: 'counter'` | 17 |
| rogue | Shadowdancer (`shadowdancer`) | ★ | P | AGI 8 | As its side's turn begins, it gains a mirror image (Mirrored, 1 image, 2 turns) unless it already has one or more | `trait: 'shadowdancer'` | 19 |
| assassin | Backstab (`backstab`) | 1 | P | Melee 30 or Archery 30 (`anySkill`) | +15 to hit and +4 damage on a weapon attack from a foe's rear arc | `effects: { rearToHit: 15, rearDamage: 4 }` | 17 |
| assassin | Ambush (`ambush`) | 3 | P | AGI 6 | Its first weapon attack of a battle (not a free one) gets +25 to hit, and a hit is critical | `trait: 'ambush'` | 17 |
| assassin | Executioner (`executioner`) | 3 | P | Melee 55 or Archery 55 (`anySkill`) | +5 damage against a foe at half its hit points or less | `effects: { executeDamage: 5 }` | 17 |
| assassin | Deathblow (`deathblow`) | ★ | P | Melee 70 or Archery 70 (`anySkill`) | A weapon hit that leaves a foe at a quarter of its maximum hit points or less fells it, except a `blightborn` foe | `trait: 'deathblow'` | 18 |
| cryomancer | Ice Lance (`ice_lance`) | 3 | S | Magic 70 | 2d8 frost to a foe within 6, and 2d8 more if it is Chilled, Slowed, Webbed, Asleep or Frozen; 7 mana, 4 AP | `spell: 'ice_lance'` | 20 |
| cryomancer | Glacial Prison (`glacial_prison`) | ★ | S | Magic 80 | A foe within 5 is Frozen for 2 turns; 12 mana, 5 AP | `spell: 'glacial_prison'` | 20 |
| healer | Purify (`purify`) | 3 | S | Magic 55 | Ends every hostile status on an ally within 4 and heals it 1d6; 4 mana, 3 AP | `spell: 'purify'` | 20 |
| healer | Revive (`revive`) | ★ | S | Magic 75 | An ally within 2 that fell this battle, on a free hex, stands again at a quarter of its maximum hit points (at least 1); 20 mana, 6 AP, once per battle | `spell: 'revive'` | 20 |
| paladin | Aura of Courage (`aura_of_courage`) | 3 | P | Melee 55 | Aura: allies within 2 hexes (not itself) get +5 to hit | `trait: 'courage'` | 19 |
| paladin | Aegis (`aegis`) | ★ | P | Melee 70 | Aura: allies within 2 hexes, itself included, get +2 resistance and +2 ward against every element | `trait: 'aegis'` | 19 |
| saint | Renew (`renew`) | 3 | S | Magic 65 | Every ally within 2 hexes of the caster is Renewing (regains 3 hit points as its turn begins) for 3 turns; 10 mana, 5 AP | `spell: 'renew'` | 20 |
| saint | Holy Light (`holy_light`) | 3 | S | Magic 70 | 3d6 to a foe within 5, double the dice as bane; 7 mana, 4 AP | `spell: 'holy_light'` | 20 |
| saint | Sanctuary (`sanctuary`) | ★ | P | Magic 80 | Aura: as its side's turn begins, every ally within 2 hexes, itself included, regains 3 hit points | `trait: 'sanctuary'` | 19 |

Each entry goes at its place in C3's `PERKS` order (by tree, path, then the order given in C3). A spell node's name and description come from `SPELLS` as the existing spell nodes' do (the spell's description with its mana and AP).

### The partial nodes completed (decision 1, C3)

| Node | Stage-1 effects (existing) | Added now | Description afterwards (wording is the engineer's; it says everything) |
| --- | --- | --- | --- |
| `iron_skin` (heavy_knight, T3, END 7) | `{ resistance: 2 }` | `opportunityToHit: 15, opportunityDamage: 3` | +2 resistance; its free attacks get +15 to hit and +3 damage |
| `battle_mage` (spellsword, T3, INT 5) | `{ maxMana: 6, imbueDamage: 2 }` (13 added imbue) | `manaOnHit: 1` | +6 mana; each melee hit that strikes no image restores 1 mana; its Strikes' elemental damage +2 |
| `skirmisher` (rogue, T2, AGI 6) | `{ agility: 1 }` | `movedToHit: 10` | +1 Agility; after it has moved this turn, its attacks get +10 to hit |
| `fortune` (assassin, T3, LCK 7) | `{ critChance: 10, luck: 1 }` | `critDamage: 4` | +10% critical chance and +1 Luck; its critical hits deal +4 damage, after the dice are doubled |
| `deadeye` (ranger, ★, Archery 70) | `{ archery: 10 }` | `trait: 'deadeye'` | +10% Archery; its shots pierce 3 points of resistance; a critical shot rolls triple dice instead of double |
| `serenity` (saint, T1, INT 5) | `{ friendlyRange: 2 }` | `manaRegen: 2` | Regains 2 mana as its side's turn begins (never above the maximum); its friendly spells aimed at an ally or a point reach 2 hexes further |

`deriveCombatStats` already emits the matching `CombatantStats` fields (`opportunity`, `manaOnHit`, `movedToHit`, `critDamage`, `manaRegen`, `traits`) from steps 17 to 19; if one is still missing for a node's key, add it there with a test, emitted only when non-zero.

### The policy's new steps (design §5.5, restated)

`aggressive` keeps its order (C16); the full order after this step is:

1. **reviveCast**: Revive on a fallen ally whenever legal.
2. healCast (Lay on Hands is a heal; `healBonus` is counted in what a heal restores).
3. **purifyCast**: Purify on an ally that is Asleep, Frozen, Poisoned, Corroded or Pinned.
4. guardCast.
5. tauntUse (step 12).
6. **supportCast**: Mass Haste in its side's first two rounds when it would touch two or more allies not Hasted. Renew when two or more allies in its radius are at 75% or less and none is Renewing.
7. areaCast (Meteor counts as a hostile area spell).
8. blessCast, then **prisonCast** (Glacial Prison on the healthiest foe not Frozen or Asleep while two stand), sleepCast, curseCast.
9. markUse (step 12).
10. strikeCast, extended: Frostbite as before; **Ice Lance** scored with its `bonusVs` dice added when the target has one of its statuses (Chilled, Slowed, Webbed, Asleep, Frozen) before the cast; **Holy Light** scored with its dice doubled where `baneApplies` holds for the target.
11. bestStrike (step 12's technique scoring).
12. statusArea.
13. sprintUse (step 12).
14. closingMove.

Taunted units (step 12's rule) apply to the new hostile steps too: `prisonCast` and the extended `strikeCast` keep only candidates on the taunter while its source stands. Everything works over `legalActions`, `castTouches` and the engine's previews, as today; Revive's candidates are the `cast` actions `legalActions` lists for target `'fallen'`. Expected damage reads `statsIn` (C13) where the step-12 code reads stats, so auras count.

Thresholds and tie-breaks the design leaves open: "healthiest" is the most hit points (lowest id on a tie, as the existing steps break ties); "first two rounds" is `state.round <= 2`; Renew's "in its radius" is within the spell's radius of the caster (it is centred on the caster). Name these as constants where the existing policy names its own.

### Shared constraints (from the index)

- **In:** design §2 R1 to R15 and AC1 to AC11, §7's tests, balance method and staging.
- **Out (design non-goals):** respec, classes, stealth, line of sight, terrain, forced movement, new sprites per ability, hand-retuning monster stat blocks.
- **Environment.** The system Node is 22; Node 26 is at `~/.nvm/versions/node/v26.13.0/bin`. Prefix every npm or node command with `PATH=$HOME/.nvm/versions/node/v26.13.0/bin:$PATH`. Podman is also available for the `Makefile` targets (`make test`, `make simulate ARGS="..."`, `make test-browser`).
- **Commands:**
  - `npm test` (`tsc && vitest run`) is the gate before every commit;
  - `npx vitest run <file>` for one file; `npx vitest run --project domain`;
  - `npm run test:browser` (or `-- -t <name>`) after any scene change; read `e2e/CLAUDE.md` before adding an in-browser test;
  - `npm run build` at each stage's end.
- **The simulator.** A 500-campaign run takes about five minutes (`--ready-level 10` longer) and writes some 70 MB. **Run one at a time, never two at once**, each with its own `--out` under `logs/` (gitignored). Measurement and tuning belong to steps 01, 08, 16, 23, 24 and 25 only.
- **The refactor guard** (`scripts/simulate.test.ts`, `describe('the refactor guard')`: 5 campaigns from seed 1, `--parties 1`, each `CampaignRecord` and a SHA-256 of every event). Decision 2 says which steps keep it green and which re-record it.
- **Determinism.** A battle replays from its seed. New rolls draw from the RNG in the order design §5.4 fixes; a passive that rolls nothing draws nothing. A unit whose stats carry none of the new fields behaves exactly as today.
- **Domain first.** Every rule lives in the Phaser-free modules (`src/character/`, `src/combat/`, `src/engine/`, `src/game/`) with tests; scenes decide nothing; Phaser-free helpers in `src/scenes/` stay free of runtime Phaser imports.
- **A node is data.** A new node of an existing shape is one entry in `PERKS`, plus one in `SPELLS` or `ABILITIES` if it teaches something; the tree view places it with no new code.
- **`tsc` is the linter**: `noUnusedLocals`, `noUnusedParameters`, `erasableSyntaxOnly` (no enums, namespaces or parameter properties), `verbatimModuleSyntax` (`import type`), `.ts` extensions in imports.
- **Commits.** One commit per step once `npm test` passes, on `skill-trees`, without pushing. Never switch branches. Message "Skill trees step NN: <title>". No attribution lines.
- **Docs.** `CLAUDE.md` stays current in every step: fix the lines the change makes wrong and search it for every name renamed or removed. Scene steps update the manual's text for their screens. Step 26 retakes the screenshots.

## 3. Dependencies and prerequisites

- **Steps 01 to 20 done.** In particular:
  - **Step 03** built `trees.ts` (C1), the `Perk` shape and node API (C2), the requirement rules (tier, depth, `anySkill`, calling, capstone lock) and `AUTO_PLANS` (C5) with the stage-1 nodes; **step 13** added the 18 stage-2 nodes and `battle_mage`'s `imbueDamage`.
  - **Step 11** added `TRAIT_IDS`, `CombatantStats.traits`, `Perk.trait` and `traitsOf` (C12).
  - **Steps 17 to 19** built every trait and effect this step's nodes switch on, and the `CombatantStats` fields of C13; **step 20** built the six spells (`ice_lance`, `glacial_prison`, `purify`, `revive`, `renew`, `holy_light`, now in `SPELL_IDS`), the statuses `frozen` and `renewing`, `StatusRule.hostile`/`helpless`/`wakesOnDamage`, and `Spell.bane`, `bonusVs`, `cleanse`, `oncePerBattle` and target `'fallen'`.
  - **Step 12** built the policy's technique steps, `STATUS_VALUE`, `MANA_WEIGHT` and the taunted-unit rule (C16).
- Until this step no hero can learn a stage-3 node, which is why steps 17 to 20 kept the guard green. The engine tests of those steps built units' stats directly.
- Existing at `50fb4cf`, for reference: `src/engine/policies.ts` (`aggressive`, its named steps `healCast`, `guardCast`, `areaCast`, `blessCast`, `sleepCast`, `curseCast`, `strikeCast`, `bestStrike`, `statusArea`, `closingMove`), `src/engine/policies.test.ts` (staged states built with the engine), `src/character/perks.test.ts`, `src/character/progression.test.ts`.

## 4. Scope and implementation guidance

### 4.1 `src/character/perks.ts`

- Add the 20 entries of §2's table at their C3 positions. `PERKS` must then hold 95 entries in exactly C3's order.
- Complete the six partial nodes as §2's second table says, rewriting each `description`.
- No other node's numbers change in this step (balance is stage 4's).

### 4.2 `src/character/progression.ts`

- Write every plan of C5 in full by inserting the stage-3 nodes at the positions C5's lists give: `knight` gains guardian and unbreakable (after iron_skin); `swordmaster` gains blademaster (after weapon_mastery); `ranger` gains tumble (after skirmisher); `rogue` gains backstab (first), tumble, counter and shadowdancer; `evoker_healer` gains purify (last). The other written-out plan, `bandit_mage`, has no stage-3 node. The path plans (`spellsword`, `assassin`, `evoker`, `cryomancer`, `arcanist`, `healer`, `paladin`, `saint`, `rogue_archer`) remain their path's nodes in `PERKS` order; if they are derived from `PERKS` they need no edit, else add the new nodes.
- `autoAdvance`'s fallback skips capstones as before, so a hero takes a capstone only through its plan.

### 4.3 `src/engine/policies.ts`

- Add `reviveCast`, `purifyCast`, `supportCast` and `prisonCast` at their places in §2's order, and extend `strikeCast` for Ice Lance and Holy Light.
- Mana: a caster that knows a heal keeps the mana for its cheapest heal, as today; Revive is exempt (it is the reason to keep mana), the other new casts are not.
- Monster stat blocks name none of the new spells, so these steps never fire for monsters; the existing monster-choice tests must pass unchanged.

### 4.4 Docs

- `CLAUDE.md`: the `perks.ts` and trees lines (all 95 nodes; no node now partial), the `aggressive` policy's paragraph in `policies.ts`'s line (the new steps in their order), and `progression.ts`'s plans. Search for every name this step's change makes untrue (for example any "stage 3 adds" or "partial" wording left by earlier steps).
- The manual's text is step 23's; the screenshots are step 26's.

### 4.5 Exclusions

- No engine rule changes (steps 17 to 20 own them); a bug found there is fixed with a test and recorded as a deviation.
- No scene changes (step 22), no simulator summary lines (step 23), no tuning (stage 4).

## 5. Verification

### Tests (in `npm test`)

- `src/character/trees.test.ts` / `perks.test.ts`, **AC1 in full:**
  - `PERK_IDS.length === 95`; the ids, in order, are C3's table read row by row.
  - every path has 7 or 8 nodes (Spellsword 7, the rest 8), exactly two T1s and exactly one capstone, and every node has one rank (taking it twice is refused);
  - for each path, a hero built test-first (both T1s of the path at creation, attributes and skills high enough for every ask, each even-level pick spent in the path through `takePerk`) can take a T3 of the path at level 6 and cannot at level 5, and takes the capstone at level 12 and not at level 10. Where a path's T2 and T3 asks need `requires` (Evoker, Cryomancer, Healer), the picks follow them.
  - `nodeKind` of every stage-3 node: the eleven traits and effect nodes `'passive'`, the six spells `'spell'`.
- **AC2 exactly:** a level 14 hero with 5 Swordmaster nodes (weapon_training, heavy_hand, power_attack, armor_breaker, gain_strength) and 6 Assassin nodes (keen_eye, backstab, venom_strike, hamstring, fortune, executioner) and the skills both capstones ask (Melee 70): `qualifiesFor(deathblow)` is true and `qualifiesFor(blademaster)` false, with `missingRequirements(blademaster)` containing "Swordmaster must be your deepest path". After `takePerk(deathblow)`, raise it so that Swordmaster becomes deeper (give it cleave, weapon_mastery and a level that allows them): Blademaster stays closed ("Only one capstone"), as does every other capstone (check all twelve).
- **The completed partial nodes:** `deriveCombatStats` of a hero holding each gives its full numbers (`opportunity` `{ toHit: 15, damage: 3 }`, `manaOnHit` 1, `movedToHit` 10, `critDamage` 4, `traits` including `deadeye`, `manaRegen` 2), and Arcane Knight gives `onHit` with `{ damage: 4, element: 'fire' }` only while the main hand is melee or bare.
- `progression.test.ts`: each of C5's lists is `AUTO_PLANS[plan]` exactly (the six written-out plans); `autoAdvance` of Aldric (`knight`), Brenna (`ranger`) and Delwyn (`evoker_healer`) to level 12 takes Unbreakable, Deadeye and Meteor respectively, and spends every pick to level 20.
- `policies.test.ts`, one staged state each (engine-built, as the existing tests are):
  - **reviveCast:** a Revive caster with a fallen ally in range on a free hex revives it, before healing a wounded ally; with the spell in `usedOnce`, it does not.
  - **purifyCast:** an ally Poisoned (and one each for Asleep, Frozen, Corroded, Pinned) is purified; an ally only Blessed is not.
  - **supportCast:** Mass Haste in round 1 when two allies not Hasted are within 2 hexes; not in round 3; not when only one would be touched. Renew when two allies within its radius are at 75% or less and none is Renewing; not when one already is.
  - **prisonCast:** Glacial Prison on the healthiest of two standing foes not Frozen or Asleep; not on the last foe standing; a Frozen foe is skipped.
  - **strikeCast:** Ice Lance picks the Chilled foe over an equal unchilled one; Holy Light picks the regenerating (bane) foe over an equal plain one.
  - **Taunted:** a taunted caster with Glacial Prison and Ice Lance aims them only at the taunter.
  - **Monsters unchanged:** the existing snapshot of monster choices over today's encounters still passes.
- **AC6 check:** list each row of design §5.4's table (hero ability use, technique strike, Taunt, Rooted, Pin, Iron Skin, Counter, Tumble, Skirmisher, Backstab, Ambush, Executioner/Fortune, Deathblow, Blademaster, Deadeye, Unbreakable, Auras, Sanctuary/Renewing/Serenity, Shadowdancer, Battle Mage, Spell modifiers, Revive, Frozen, Purify, Ice Lance/Holy Light) with the name of the `battleEngine.test.ts` test that covers it, in the execution record. A row with no test gets one now. The replay and snapshot round-trip tests pass.
- **The refactor guard** fails before the re-record (play moved); re-record its fixture (`GUARD_RECORDS`, `GUARD_EVENTS_SHA256`) and state in the commit message that stage-3 nodes enter the plans and the partial nodes complete.

### Commands

```sh
export PATH=$HOME/.nvm/versions/node/v26.13.0/bin:$PATH
npx vitest run src/character/perks.test.ts src/character/trees.test.ts src/character/progression.test.ts
npx vitest run src/engine/policies.test.ts src/engine/battleEngine.test.ts
npx vitest run scripts/simulate.test.ts      # re-record the guard, then green
npm test
```

No scene changes, so `npm run test:browser` is not required; run it if a scene smoke test or a probe type moved (it should not).

### Acceptance

- AC1 and AC2 tests pass as written above; the AC6 table is in the execution record with no gaps.
- A 5-campaign smoke run (`npm run simulate -- --campaign --battles 5 --seed 1 --parties 1 --out logs/21-smoke.jsonl`) finishes; no 500-campaign measurement here (step 23's).

## 6. Completion criteria

- [x] `PERKS` holds the 95 nodes in C3's order; the six partial nodes are complete with rewritten descriptions.
- [x] `AUTO_PLANS` matches C5 in full.
- [x] `reviveCast`, `purifyCast`, `supportCast`, `prisonCast` and the extended `strikeCast` are in `aggressive` in §2's order, each with its staged test; monsters' choices unchanged.
- [x] AC1, AC2 tests pass; AC6 table recorded.
- [x] The guard re-recorded, with the reason in the commit message; `npm test` passes.
- [x] `CLAUDE.md` updated (perks, trees, plans, policy).
- [x] One commit, "Skill trees step 21: stage-3 nodes, plans and the policy's last steps", on `skill-trees`, not pushed, no attribution lines.
- [x] This step's row in [index.md](index.md) set to `done (<commit>)`.

## 7. Execution record

**Engineer, 2026-11-14.** Four commits on `skill-trees`, not pushed:

- `edcc04b` Skill trees step 21: the policy's last steps (`reviveCast`, `purifyCast`, `supportCast`, `prisonCast`, `strikeCast`'s Ice Lance and Holy Light; `isHealing` leaves out cleanses; Sleep and Prison skip a helpless foe; spell wards through `statsIn`; Deathblow in a blow's expected harm). Guard and policy snapshot green unchanged.
- `77f858f` Skill trees step 21: stage-3 nodes and plans (the 20 nodes, the six partial nodes completed, C5's plans in full; AC1, AC2 tests; the tree strip's hint cut to one line; CLAUDE.md). The guard alone failed here, as decision 2 expects.
- `27f6d66` Skill trees step 21: re-record the refactor guard (the events' hash only: the five records are unchanged).
- the record commit (this file, the index row).

The step was split into those commits, not one, to follow step 13's precedent for the guard and the brief's "re-record in its own commit"; the first commit proves the policy steps change no current choice (monsters' included) before any data moved.

**Commands and results** (Node 26):

- Baseline `npm test`: 86 files, 1946 tests passed.
- New policy tests red first (16 failing, for the expected reasons once a board-placement slip in the test was fixed), then green; `supportCast` and Deathblow re-checked red by switching the code off.
- `npx vitest run src/character/perks.test.ts src/character/trees.test.ts src/character/progression.test.ts`: green (36, 34, 30 tests).
- `npx vitest run src/engine/policies.test.ts src/engine/battleEngine.test.ts`: green (policies 90).
- `npx vitest run scripts/simulate.test.ts`: failed on the guard after `77f858f` (records equal, hash moved), green after `27f6d66`.
- `npm test` after the last code commit: 86 files, 1989 tests passed.
- Smoke run `npm run simulate -- --campaign --battles 5 --seed 1 --parties 1 --out logs/21-smoke.jsonl`: finished, 115 battles, 115 won (summary in `logs/21-smoke.txt`).
- `npm run test:browser` (run since `PerkTreeView.ts` changed): 10 files, 117 tests passed.

**AC6: design 5.4's rows and the `battleEngine.test.ts` tests that cover them** (no gaps; none added):

| Row | Test (describe › it) |
| --- | --- |
| Hero ability use | BattleEngine hero techniques › "asks for the weapon a technique needs…", "asks for the mana a technique costs", "asks for the weapon's attack AP plus the technique's" |
| Technique strike | a technique strike › "is a weapon blow with its own chance: Power Attack at −10, +6 on a hit…" |
| Taunt | BattleEngine area techniques › Taunt › "lays Taunted for a turn on every foe within 2 hexes and no one else…"; Taunted › "takes TAUNT_PENALTY off a taunted unit's attack…" |
| Rooted | Rooted › "is laid for 2 turns, before the count-down, on a unit with the trait that ends its turn unmoved" |
| Pin | Pinned › "leaves a foe hit by Pin no legal move on its next turn, though it still attacks…" |
| Iron Skin | Iron Skin (free attacks) › "adds its to-hit and damage to a free attack, and nothing to its own-turn attack" |
| Counter | Counter › "strikes back once, free, at a melee attacker of the side in turn that misses it" |
| Tumble | Tumble › "provokes no free attack, and previewMove lists none" |
| Skirmisher | Skirmisher › "adds its bonus to an attack after a step this turn, and not without one" |
| Backstab | Backstab › "adds its to-hit and damage to a blow from the rear" |
| Ambush | Ambush › "adds AMBUSH_BONUS to the first own-turn attack and makes its hit critical, once" |
| Executioner / Fortune | Executioner › "adds its damage against a foe at half its hit points or less before the blow"; Fortune › "adds its damage to a critical after the dice are doubled…" |
| Deathblow | Deathblow › "fells a foe a hit leaves at a quarter of its maximum or less" |
| Blademaster | Blademaster › "gives back a felling attack's AP once a turn…" |
| Deadeye | Deadeye › "rolls triple dice on a ranged critical, double on a melee one"; "pierces 3 more points of resistance with its shots…" |
| Unbreakable | Unbreakable › "leaves a lethal blow's target at 1, Shielded for 2 turns, once a battle" |
| Auras | auraBonus › Guardian, Aura of Courage, Aegis tests; "a foe beside a Guardian is struck against 5 more armour class…" |
| Sanctuary / Renewing / Serenity | Renewing; Sanctuary › "heals the holder and its side within 2 by 3…"; Serenity › "restores its manaRegen, never above the maximum…"; "runs ticks, regeneration, Renewing, Sanctuary, Serenity and Shadowdancer in that order" |
| Shadowdancer | Shadowdancer › "lays one image for 2 turns as its side's turn begins…" |
| Battle Mage | Battle Mage (mana on hit) › "restores its mana on a melee hit, up to the maximum, recorded as manaRestored" |
| Spell modifiers | BattleEngine a caster's spell modifiers › "adds to Magic Arrow's dice, drawing nothing more", heal bonus, extension tests |
| Revive | Revive › "targets an ally that fell this battle, within 2 on a free hex, and stands it up at a quarter of its maximum" |
| Frozen | Frozen and Glacial Prison › "lays Frozen for 2 turns on a hit…", "gives a frozen unit no AP…", "holds no zone of control while frozen" |
| Purify | Purify › "ends every hostile status on the ally in the order laid, keeps the friendly ones, then heals…" |
| Ice Lance / Holy Light | Ice Lance › "draws its own 2d8 alone against an unaffected foe"…; Holy Light › "draws 6d6 against a regenerating or blightborn foe and 3d6 against any other" |

The replay and snapshot round-trip tests pass in the full run.

**Deviations and decisions**

1. **Delwyn takes Meteor at level 14, not 12.** C5's `evoker_healer` puts Mending before Meteor, so level 12's pick goes to Mending (Evoker depth is 5 at 10). The test asserts what C5 makes: Aldric Unbreakable and Brenna Deadeye at 12, Delwyn Meteor at 14 (not at 12). Moving Meteor before Mending in the plan would give 12; that is a play change for stage 4 to weigh, not made here.
2. **AC1 at level 6.** Swordmaster and Ranger have three T2s, and a pick follows `PERKS` order, so level 6's pick takes the third T2 and the first T3 comes at 8. The test asserts that a T3 is open at 6 and not at 5 for every path ("can take"), and that the first T3 is taken at 6 in every path but those two (8 there).
3. **The tree strip's hint is cut to one line** (`STRIP_HINT_LINES`, `perkTree.ts`; `PerkTreeView.describe`). The long capstone asks ("Heavy Knight must be your deepest path", "Melee 70% or Archery 70%") made Unbreakable, Blademaster and Deathblow six lines, past the 500 px panel (the existing strip test failed at 504). The Asks line above still says everything; a closed capstone's hint ends in "…". Step 22 should look at it in the browser.
4. **The policy-choices snapshot did not move** (4655 lines, same hash): its heroes stop at level 7, short of every stage-3 node, and the bandits it fields take none (the Cutthroat, whose plan now opens with Backstab, never takes the field at threats 3 to 7). So no re-record; "monsters unchanged" holds by the unchanged hash.
5. **The guard's records did not move**; only the events' hash did (`4aed0810...` to `b840633a...`).
6. **Purify and the heal reserve.** As the decision has it, `isHealing` now leaves out a spell with `cleanse`, so Purify is not in `worldSpells`, `castOnWorldMap`, `autoHeal`, `healCast` or `manaReserve`; `purifyCast` keeps the heal reserve like any non-heal cast. `spellApCost` still discounts Purify for Swift Hands (it reads `heal`, not `isHealing`): a healing-school spell, left as it is.
7. **Carried-forward notes addressed:** `UNTAUGHT` removed; `sleepCast` and `prisonCast` share `disableCast`, skipping a foe `isHelpless` (asleep or frozen); spell and area ward scoring read `statsIn`; Deathblow counted in `expectedHarm` (a hit that would leave the foe within it is worth all the foe has left). Skirmisher: `bestStrike` scores only attacks from the current hex, with the unit's current `moved`, which is right there; the walk-then-attack preview is a scene matter (step 22's note). Nothing new lays `taunted`.

**For later steps:** step 22 has the strip hint (3) to check visually; step 23 measures with the stage-3 plans in (the guard's five campaigns are unchanged, so expect small moves); stage 4 may move Meteor before Mending in `evoker_healer` (1).

