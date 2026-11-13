# Step 04: Mana for every hero and the derived passives

[Plan index](index.md) · [Design](../../designs/skill-trees.md) (R5, R8; §4.2 the economy, §5.1 `character.ts`, §5.4 "Spell modifiers") · [Feature record](../../features/skill-trees.md)

**Difficulty:** opus. Leave the engineer's and the reviewer's model unset. This step changes how every hero's numbers are derived and how the engine resolves a cast (damage, healing, status durations, range, AP). A slip changes the RNG's draws or a monster's casting, which the replay tests and the policy tests must catch.

## 1. Objective

Every hero has a mana pool, and the stage-1 passives whose effect is a derived number work in battle and on the world map:

- `maxMana` no longer asks that the hero knows a spell, and adds `MANA_PER_TREE_NODE` (2) for each node held in the Mage and Cleric trees.
- `deriveCombatStats` reads the new `PerkEffects` keys step 03 put in the data (`resistance`, `shieldAc`, `wardAll`, `wardBlight`) and the nodes' `meleeOnHit`, and emits the spell modifiers on `CombatantStats.magic` (C7).
- The engine applies those modifiers when a spell is cast, listed, touched and previewed: spell power by element before wards, the heal bonus, status extension, friendly range and AP discounts.
- `worldCasting.ts` adds the heal bonus to what a heal restores on the world map (Mending).

The policy works over `legalActions`, `castTouches` and `previewCast`, so it follows without a change of its own.

## 2. Requirements and context

- **R5:** every hero has mana: from intelligence and level, plus 2 for each node in the Mage and Cleric trees, plus what nodes and gear add.
- **R8 (in part):** the derived passives work in the engine, and battles stay deterministic from their seed.
- **AC4:** Aldric (intelligence 3, no Mage or Cleric nodes) has 6 mana at level 1 and 10 at level 5. The ready-made Delwyn (intelligence 9; Magic Arrow, Heal, Arcane Study) has 24 at level 1 (18 + 3 nodes × 2).
- **Design table (§4.2):** Aldric 6 / 10 / 15 at levels 1 / 5 / 10; with Arcane Blood (+10) 16 / 20 / 25; Delwyn on build B 28 / 48 / 74 (Destruction's +4 included).
- **Quality constraint:** a unit whose stats carry none of the new fields behaves exactly as today. A passive that rolls nothing draws nothing.
- **Battle start is unchanged:** a battle starts at `magic.maxMana`; mana carried onto the world map, camping and levelling work as today. `magic` is emitted only for a hero that knows a spell (step 09 adds: or an ability with `manaCost`), so a warrior's pool exists on the character but brings no `magic` into battle yet.

The stage-1 nodes whose effects this step makes real (numbers from design §4.3):

| Node | Effect read here |
| --- | --- |
| shield_wall | +8 AC while a shield is in the off hand (`shieldAc: 8`) |
| iron_skin | +2 resistance (stage-1 part) |
| blessed_armour | +1 resistance, +3 ward against blight (`wardBlight: 3`), +6 mana |
| spell_ward | +3 ward against every element (`wardAll: 3`) |
| sacred_weapon | +10% Melee; `meleeOnHit` +2, and 4 more as bane |
| arcane_blood | +10 mana |
| battle_mage | +6 mana (stage-1 part) |
| destruction | +2 damage to each instance of its damaging spells (`spellDamage: 2`); +4 mana |
| pyromancy | +3 to its fire spells (`fireSpellDamage: 3`) |
| numbing_cold | +3 to its frost spells (`frostSpellDamage: 3`) |
| mending | its heals restore +4 (`healBonus: 4`), in battle and on the world map |
| lingering_cold | statuses its hostile spells lay last 1 turn longer (`hostileExtend: 1`); +10% Magic |
| lasting_magic | statuses its friendly spells lay last 1 turn longer (`friendlyExtend: 1`); +1 Intelligence |
| quickened_casting | its spells cost 1 AP less, never below 2 (`spellApDiscount: 1`); +8 mana |
| swift_hands | its healing spells cost 1 AP less, never below 2 (`healApDiscount: 1`); +8 mana |
| serenity | friendly spells aimed at an ally or a point reach 2 hexes further (`friendlyRange: 2`; stage-1 part) |

### Decisions from the index (unchanged)

- **1. When a node enters `PERKS`.** A node joins `PERKS` in the first stage that can deliver its effect (table C3). Six passives enter in stage 1 with only their derived part and are completed later, because the v22 migration maps folded perks onto three of them and their derived part works at once: `iron_skin` (+2 resistance; free-attack bonus in stage 3), `battle_mage` (+6 mana; Strikes' elemental +2 in stage 2; mana on hit in stage 3), `skirmisher` (+1 Agility; +10 to hit after moving in stage 3), `fortune` (+10% critical, +1 Luck; critical damage in stage 3), `deadeye` (+10% Archery, Eagle Eye's effect; pierce and triple dice in stage 3) and `serenity` (friendly range +2; mana regained in stage 3). A node's `description` says only what works in its stage; the step that completes it rewrites the description. Some stage-1 nodes cannot be reached by depth until their path's later nodes arrive (Fortune, Iron Skin, Deadeye): that is expected.
- **2. The refactor guard.** `scripts/simulate.test.ts`'s fixture moves whenever play moves. A step that changes what the simulator plays (data, plans, the economy, a spell's or node's numbers, the order of `ALL_SPELL_IDS`) re-records the fixture in its own commit and says why in the commit message. A step that only adds engine rules, statuses or policy branches that no simulated unit can yet reach **must keep the fixture green unchanged**; a mismatch there is a bug. Steps that must keep it green: 05, 06, 07, 09, 10, 11, 12, 14, 15, 17, 18, 19, 20, 22. Each stage's measurement step re-records it last.
- **7. Saves.** `SAVE_VERSION` 23 in stage 1 (step 03 raises it; step 05 adds `migrateFrom22`) … This step adds optional fields to `CombatantStats.magic` (in `BattleSnapshot` units' stats) under version 23; it does not raise the version again.

### Contracts (copied unchanged from the index)

**C1. Trees and paths (step 03; consumed here):**

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

**C2. Nodes (step 03; consumed here):**

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

**C7. Spell modifiers and mana (this step; consumed by 09, 14, 20, 21):**

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

### Shared constraints (from the index)

- **Environment.** The system Node is 22; Node 26 is at `~/.nvm/versions/node/v26.13.0/bin`. Prefix every npm or node command with `PATH=$HOME/.nvm/versions/node/v26.13.0/bin:$PATH`. Podman is also available for the `Makefile` targets (`make test`, `make simulate ARGS="..."`, `make test-browser`).
- **Commands:** `npm test` (`tsc && vitest run`) is the gate before the commit; `npx vitest run <file>` for one file; `npx vitest run --project domain`; `npm run test:browser` after any scene change.
- **The simulator.** Run one at a time, never two at once, each with its own `--out` under `logs/`. Measurement and tuning belong to steps 01, 08, 16, 23, 24 and 25 only: this step measures nothing.
- **Determinism.** A battle replays from its seed. New rolls draw from the RNG in the order design §5.4 fixes; a passive that rolls nothing draws nothing. A unit whose stats carry none of the new fields behaves exactly as today.
- **Domain first.** Every rule lives in the Phaser-free modules with tests; scenes decide nothing.
- **`tsc` is the linter:** `noUnusedLocals`, `noUnusedParameters`, `erasableSyntaxOnly`, `verbatimModuleSyntax` (`import type`), `.ts` extensions in imports.
- **Commits.** One commit for this step once `npm test` passes, on `skill-trees`, without pushing. Never switch branches. Message "Skill trees step 04: mana for every hero and the derived passives". No attribution lines.
- **Docs.** `CLAUDE.md` stays current: fix the lines this change makes wrong and search it for every name renamed or removed.

## 3. Dependencies and prerequisites

- **Step 03 (done first)** provides `trees.ts` (C1, `MANA_PER_TREE_NODE`, `treeNodes`), the new `Perk` and `PerkEffects` keys with the 57 stage-1 nodes and their effect values (C2, C3), and `SAVE_VERSION` 23. The new keys exist in the data but nothing reads them until this step.
- **Step 02 (done)** provides the stage-1 spells (Frostbite, Meteor, Mass Haste, Lay on Hands, Ward; Web and Curse as hero spells) and the `warded` status with `StatusRule.wardAll`.
- **Existing code at `50fb4cf`, for reference:**
  - `src/character/character.ts`: `maxMana` (line ~145) returns 0 for a hero that knows no spell, else 2 × INT + (level − 1) × ⌊INT/2⌋ + gear + perks; `deriveCombatStats` emits `magic: { maxMana, skill, spells }` only when `spells.length > 0`; `manaOf` clamps carried mana; on-hit entries come from the main hand's runes (`onHit`); wards summed over what is worn.
  - `src/combat/combat.ts`: `CombatantStats` (line ~29), `sameMagic` and `sameCombatStats` (which `equip` and the scenes use to tell stats apart), `OnHit`, `warded`, `baneApplies`.
  - `src/combat/spells.ts`: `Spell` (`apCost`, `range`, `target`, `hostile`, `damage`, `element`, `heal`, `status`), `SPELLS`, `ALL_SPELL_IDS`.
  - `src/engine/battleEngine.ts`: `spellcaster(effectiveStats(actor), spell)`; the cast path (around lines 1495 on) pays `apCost`/`manaCost`, rolls each touched unit in roster order (`rollToHit`, then dice on a hit), applies `warded`, heals, lays statuses; `legalActions` lists casts after attacks; `castTouches`, `previewCast`; `CastEvent.apCost` and `apAfter`.
  - `src/character/worldCasting.ts`: `worldSpells`, `castOnWorldMap` (restores the average of the spell's dice).
  - `src/engine/policies.ts`: works over `legalActions`, `castTouches`, `previewCast`.

## 4. Scope and implementation guidance

### 4.1 `character.ts`

- `maxMana(character)`: drop the "knows a spell" gate; `2 × INT + (level − 1) × ⌊INT / 2⌋ + MANA_PER_TREE_NODE × (treeNodes(character, 'mage') + treeNodes(character, 'cleric')) + perkBonus('maxMana') + gear's maxMana`, INT through `attributeLevel`. `manaOf` keeps clamping.
- `deriveCombatStats`:
  - `resistance += perkBonus('resistance')`;
  - `ac += perkBonus('shieldAc')` only while the off hand holds a shield (not with an empty off hand, not under a two-handed weapon);
  - each element's ward `+= perkBonus('wardAll')`, and `blight += perkBonus('wardBlight')`; leave `wards` out, as today, when every ward is 0;
  - the `meleeOnHit` of every held node appended to `onHit` while the main hand is a melee weapon (reach included) or bare; not for a ranged weapon or wand;
  - `magic` (still only for a hero that knows a spell) gains `power`, `healBonus`, `extend`, `friendlyRange`, `apDiscount` from the effects as C7 maps them, each key present only when non-zero and each sub-object only when one of its fields is.
- A hero holding none of these nodes derives exactly today's `CombatantStats` (deep-equal), its mana pool aside.

### 4.2 `combat.ts`

- `CombatantStats.magic` gains the C7 fields, documented.
- `sameMagic` (and so `sameCombatStats`) compares them too, so an `equip` after a gear change that moves only a modifier is still noticed.

### 4.3 `spells.ts`

- `spellApCost(stats, spell)`: `max(min(apCost, 2), apCost − (apDiscount.all ?? 0) − (spell has heal ? apDiscount.heal ?? 0 : 0))`. A spell already costing 2 or less keeps its cost.
- `spellRange(stats, spell)`: the spell's range, plus `friendlyRange` for a friendly spell whose target is `ally`, or `area` with range > 0. A range-0 spell centred on the caster (Heal All, Mass Haste, Bless) and a `self` spell keep range 0.

### 4.4 `battleEngine.ts`

- Every place the engine reads a spell's AP or range for a unit (`canCast`, `legalActions`, `castTouches`, `previewCast`, the cast itself, `CastEvent.apCost`) reads `spellApCost` / `spellRange` with the caster's effective stats.
- **Power:** on each damaging outcome of a spell (hit, critical, or half on a miss where it applies), add `power.all`, plus `power.fire` for a fire spell or `power.frost` for a frost spell, after the dice (and after a critical's doubling: the bonus is not doubled) and **before** `warded`. A status's tick is not a spell outcome and gets no power. Drain reads the damage actually dealt, as today.
- **Heal bonus:** each heal outcome of a spell with `heal` adds `healBonus`, then is capped at the maximum as today.
- **Extend:** a status a hostile spell lays lasts `extend.hostile` more turns; one a friendly spell lays, `extend.friendly` more. Only spells; an ability's or a weapon's statuses are untouched.
- **No new draws.** The bonuses are flat; the RNG is drawn exactly as before, in the same order. Monsters carry none of these fields, so their casts are unchanged.
- `LOG_SCHEMA_VERSION` stays 24: the events' shapes do not change (the numbers in `damage`, `healed`, `apCost` and a status's `turns` change).

### 4.5 `worldCasting.ts`

- `castOnWorldMap` restores the spell's average plus the caster's `healBonus` (from `deriveCombatStats(caster).magic?.healBonus` or `perkBonus(caster, 'healBonus')`), capped at the maximum. `worldSpells` lists Lay on Hands like any heal.

### 4.6 Docs

- `CLAUDE.md`: the rules of perks and spells line on `maxMana` ("one that knows none has none" is no longer true: every hero has mana, 2 a Mage or Cleric node); the rules of casting gain one sentence on the caster's modifiers (power before wards, heal bonus, extension, friendly range, AP discounts never below 2); the `character.ts` and `spells.ts` lines in the architecture where they name what is derived.

### 4.7 Exclusions

- No scene change: the battle's spell list still shows the spell's own AP until step 14's Skills menu reads `spellApCost`; that mismatch for a hero with Quickened Casting or Swift Hands is accepted until then (the engine is right).
- No ability or technique (step 09); no `imbueDamage`, `manaOnHit`, `manaRegen` or the stage-3 numbers (they stay unread).
- No save migration (step 05).

## 5. Verification

### Tests (in `npm test`)

- `character.test.ts`:
  - AC4: Aldric's draft (INT 3, no Mage or Cleric nodes) has `maxMana` 6 at level 1 and 10 at level 5; with Arcane Blood 16 at level 1; the ready-made Delwyn has 24 at level 1.
  - A warrior with no spell has mana but no `magic` in `deriveCombatStats`.
  - Shield Wall adds 8 AC with a shield in the off hand and nothing with an empty off hand or a two-handed weapon.
  - Iron Skin and Blessed Armour add to `resistance`; Spell Ward adds 3 to every element's ward; Blessed Armour 3 to blight.
  - Sacred Weapon's on-hit entries appear with a sword and not with a bow.
  - Destruction, Pyromancy, Numbing Cold, Mending, Lingering Cold, Lasting Magic, Quickened Casting, Swift Hands and Serenity each set their `magic` field; a caster with none of them derives exactly today's `magic` (no new keys).
- `spells.test.ts`: `spellApCost` (discount, heal-only discount, never below 2, a 2-AP spell unchanged); `spellRange` (ally, area > 0, range-0 and self unchanged; hostile unchanged).
- `combat.test.ts`: `sameCombatStats` tells apart two stats differing only in a magic modifier.
- `battleEngine.test.ts`, each with a scripted RNG, and each asserting the RNG was drawn the same number of times as without the modifier:
  - power: Magic Arrow with `power.all` 2 deals the dice + 2; Flame Arrow with `power.fire` 3 against a fire ward deals dice + 3 − ward; a frost bonus does not touch a fire spell; a critical doubles the dice and not the bonus;
  - heal bonus: Heal restores dice + bonus, capped;
  - extend: Sleep laid with `extend.hostile` 1 lasts one turn longer; Bless with `extend.friendly` 1 likewise; a monster's ability status unchanged;
  - friendly range: Heal at range + 2 is legal and listed, at range + 3 is not; Heal All's area is unchanged;
  - AP discount: the cast's `apCost` and `apAfter` show the discounted cost; a heal discount does not touch Magic Arrow;
  - a unit with none of the new fields: an existing cast test's events deep-equal today's.
- `worldCasting.test.ts`: Mending adds 4 to a heal on the world map, capped.
- `policies.test.ts`: the existing tests pass unchanged (monsters carry no modifier).
- **The refactor guard** moves (heroes' mana and casters' numbers change): re-record the fixture in this commit and say why in the message (decision 2).

### Commands

```sh
PATH=$HOME/.nvm/versions/node/v26.13.0/bin:$PATH npx vitest run src/character/character.test.ts src/combat src/engine src/character/worldCasting.test.ts
PATH=$HOME/.nvm/versions/node/v26.13.0/bin:$PATH npm test
```

`npm run test:browser` is not required (no scene changes); run it if any scene file had to change to compile, and record the result.

### Acceptance

- AC4 holds, by test.
- Every new rule of §4.4 has an engine test with a scripted RNG; replay and snapshot tests pass.
- A unit with none of the new fields behaves as today, by test.

## 6. Completion criteria

- [ ] `maxMana` for every hero (AC4); `deriveCombatStats` reads `resistance`, `shieldAc`, `wardAll`, `wardBlight`, `meleeOnHit` and emits C7's modifiers.
- [ ] `spellApCost` and `spellRange` exported and used by the engine everywhere a spell's AP or range is read.
- [ ] Power, heal bonus, extension, friendly range and AP discount applied in the engine, with tests; no RNG draw added, dropped or reordered.
- [ ] `castOnWorldMap` adds the heal bonus.
- [ ] `sameMagic` compares the new fields.
- [ ] Guard fixture re-recorded, the reason in the commit message.
- [ ] `CLAUDE.md` current.
- [ ] `npm test` passes; committed as "Skill trees step 04: mana for every hero and the derived passives".
- [ ] Index: step 04's status set to `done (<commit>)`.

## 7. Execution record

**Status:** done (24a2400).

**What was built.**
- `character.ts`: `maxMana` for every hero (2 × INT + (level − 1) × ⌊INT/2⌋ + `MANA_PER_TREE_NODE` × Mage and Cleric nodes + nodes' and gear's `maxMana`); `deriveCombatStats` adds `perkBonus('resistance')`, `shieldAc` while the off hand holds anything (every off-hand item is a shield, `gearClass`) under a one-handed weapon, `wardAll` to each element and `wardBlight` to blight, the nodes' `meleeOnHit` after the runes' on-hit entries with a melee weapon (reach included) or bare hands, and the C7 modifiers on `magic` (`spellModifiers`), each key and sub-object only when non-zero. `magic` is still emitted only for a hero that knows a spell.
- `combat.ts`: the C7 fields on `CombatantStats.magic`, documented; `sameMagic` compares them (a missing one as 0).
- `spells.ts`: `spellApCost` and `spellRange` as C7 specifies.
- `battleEngine.ts`: `canPayFor`, `canCast`, `previewCast` and `cast` read `spellApCost` / `spellRange` with the caster's effective stats; `cast` adds power by element to each damaging hostile outcome (passed to `strikeUnit` as `power`, after a critical's doubling and before the ward; areas of abilities pass none), the heal bonus before the cap, and the extension to the status laid. No draw added, dropped or reordered (each engine test counts draws with and without the modifier). `castTouches` is unchanged: every friendly area spell has range 0 and a burst, so `friendlyRange` never changes an area's shape; the legal-centre listing still uses the spell's own range (0 stays 0).
- `worldCasting.ts`: `worldHealing(spell, caster?)` adds the caster's `healBonus`; `castOnWorldMap` passes the caster.
- `CLAUDE.md`: the derived effects, every hero's mana, the caster's modifiers in the rules of casting, `spellApCost`/`spellRange`, Mending on the world map, wards from nodes.

**Tests changed on purpose (behaviour deliberately changed by every hero having mana):** `character.test.ts` (warrior mana 14 with the circlet, a caster's mana +2 for Magic Arrow, Lasting Magic +2 for its node), `creation.test.ts` and `party.test.ts` (Delwyn 24), `progression.test.ts` (Heal brings 2 mana to what a warrior has left), `camp.test.ts` (camping fills Aldric's mana; `MEMBERS` re-recorded `[[35, 6], [18, 8], [17, 24]]`), `worldMap.test.ts` (`SESSION_SHA256` re-recorded; `SESSION_TURN` unchanged at 153).

**Refactor guard re-recorded** (decision 2), in this step's commit, in the file's unquoted object style (step 03's review note): all five campaigns still beat the Source; events SHA-256 `8e01443a…5c94`. The cause: every hero's mana, the mage's 6 more, and the derived passives the ready-made party and recruits now hold.

**Commands and results.**
- `npx vitest run src/character src/combat src/engine` before the change: 13 files, 489 passed (baseline).
- Red runs: the new character tests (20 failed for the expected reasons), `sameCombatStats` (1), `spellApCost`/`spellRange` (4, not a function), the engine modifier tests (10 failed on the numbers, 5 passed that assert unchanged behaviour), `worldCasting` Mending (1).
- `npm test` (tsc + vitest): 85 files, 1574 tests passed.
- `npm run test:browser`: not run; no scene file changed.

**Deviations and notes for later steps.**
- `policies.ts`'s `reach` still reads a damaging spell's own `apCost` when judging how close to come; with Quickened Casting a caster may approach a hex less aggressively than it could. Left alone (the step names no policy change); step 12 or 14 may want `spellApCost` there.
- `autoHeal` (party.ts) chooses heals by `worldHealing(spell)` without the caster, so it does not count Mending when choosing; what is restored does count it.
- The battle's spell list still shows a spell's own AP (accepted until step 14, §4.7).
