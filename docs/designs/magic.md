# Magic: spellcasting and magic items

## 1. Purpose and status

Yomi's heroes fight with blades, bows and fists, and eight of the eleven equipment slots have nothing to hold. This design adds magic in two halves:

- **Spellcasting**: a Sorcery skill, a mana pool, three spells cast in battle, and a mage in the starting party.
- **Magic items**: enchanted gear for the empty slots and the weapon hand, won as loot from monster locations and handed round the party on the world map.

**Status: ready for planning.** Nothing blocks implementation. Section 8 lists the product decisions I made without the user's word, each with the default this design assumes; the first three are worth confirming before planning.

## 2. Requirements and scope

### Functional requirements

| ID | Requirement |
| --- | --- |
| R1 | A fifth skill, **Sorcery**, is a percentage like the others: it starts from intelligence, can be tagged and is raised with skill points. |
| R2 | A character **knows** every spell whose Sorcery requirement it meets. Nothing about spells is stored on the character. |
| R3 | A character that knows a spell has **mana**: a maximum derived from intelligence, level, perks and gear. Every battle starts at the maximum; mana does not return during a battle. |
| R4 | In battle a unit can **cast** a spell it knows on a legal target for the spell's action points and mana. The engine resolves it, logs it as an event, and lists it in `legalActions`. |
| R5 | Three spells ship, one of each shape: **Firebolt** (damage to one foe), **Mend** (heals an ally) and **Fireburst** (damage to a foe and every unit beside it, friend or foe). |
| R6 | The `aggressive` policy casts, so the game's enemy AI and the simulator's sides use spells when their units have them. |
| R7 | The player casts from the battle screen: a Cast button, a choice of spell, then a target, with the odds shown and a way to back out. |
| R8 | The character panel gains a **Spells** tab listing every spell, which are known, and the character's mana. |
| R9 | A new game's party has a fourth hero, a mage, who knows Firebolt and Mend at level 1. |
| R10 | Two perks support casters: more mana, and more spell damage. |
| R11 | **Magic items** exist for the neck, head, cloak and ring slots and as enchanted weapons, including wands that strike with Sorcery. Items can add to mana, spell skill and critical chance as well as to what items add today. |
| R12 | Each monster location holds **loot**, which a victory there moves into the party's shared **baggage**. The victory screen names it. |
| R13 | On the world map the character panel can change gear for free, and its ground section shows the baggage, through which items pass between members. |
| R14 | The simulator reports casts and healing, and gains a `--campaign` mode that plays the whole map, which is how scaling is retuned. |
| R15 | Scaling is retuned for the party of four with magic, and `CLAUDE.md`'s rules of scaling are rewritten with the new numbers. |

### Quality constraints

- All rules live in the Phaser-free domain modules with tests; `BattleScene` decides no outcome.
- A battle still replays exactly from its seed and its actions. The order in which a spell draws from the RNG is fixed (section 5.3).
- `LOG_SCHEMA_VERSION` goes from 13 to 14.
- A unit without magic behaves exactly as today, so existing stat blocks and tests need no new fields.

### Non-goals

- Lasting effects (buffs, slows, damage over time). The engine keeps no per-unit state beyond what it has now, plus mana.
- Consumables: potions, scrolls, charges on wands. There is no "use item" action.
- Enemy casters. The engine and the policy support them; adding one is a stat block with a `magic` entry, a sprite and a `FOE_XP` value, left for later.
- Line of sight, spell interruption, free attacks provoked by casting, armour hampering a caster.
- Casting outside battle. Mend cannot be used on the world map.
- A mage sprite: every hero is still drawn as the `warrior` kind.
- Shops, random loot, item weight or value.

### Acceptance criteria

| ID | Criterion | Covers |
| --- | --- | --- |
| A1 | A character with Sorcery 76% knows Firebolt and Mend and not Fireburst; raised to 90% it knows all three, with no other change to it. | R1, R2 |
| A2 | The mage enters battle with 18 mana; a Firebolt leaves 15 and 4 fewer action points; the next battle starts at 18 again. | R3, R4 |
| A3 | A cast with too little mana or action points, out of range, or on an illegal target throws from `step` and is absent from `legalActions`. | R4 |
| A4 | Fireburst on a foe with an ally of the caster beside it rolls against that ally too, and can fell it. | R5 |
| A5 | Two engines given the same seed and the same actions, casts included, produce identical logs. | R4 |
| A6 | In a simulated battle the mage's side logs `cast` events, and the summary counts them. | R6, R14 |
| A7 | In the browser: select the mage, press Cast, pick Firebolt, click a foe; the log shows the cast and the Cast button shows 3 less mana. Esc backs out at each stage. | R7 |
| A8 | The Spells tab shows three rows for every member, two of them marked known for the mage. | R8, R9 |
| A9 | Winning at Goblin Raiders puts a Ring of Protection in the baggage and names it on the victory screen; on the world map a member takes it from the baggage and wears it, and its armour class rises by 5. | R11, R12, R13 |
| A10 | A second ring goes into the empty ring slot, not over the first. | R11 |
| A11 | `npm run simulate -- --campaign --battles 500 --seed 1` prints the share of campaigns that clear the map and the win rate at each threat. | R14 |
| A12 | That share is about 2 in 3 with the aggressive policy, and `CLAUDE.md` states the numbers that give it. | R15 |

## 3. Current system

Inspected facts, with the files they come from.

- **Skills** ([`src/character/skills.ts`](../../src/character/skills.ts)): four ids in `SKILL_IDS`; `SKILLS` gives each a base from attributes. `Character.trained` is a `Record<SkillId, number>`, filled in by hand in `createCharacter`.
- **Derived stats** ([`src/character/character.ts`](../../src/character/character.ts)): `deriveCombatStats` turns a character into `CombatantStats`. `weaponSkill` picks the skill from the weapon: none is Unarmed, a range above 1 is Archery, otherwise Melee. `maxHp` depends on attributes, level and perks, never on gear.
- **Perks** ([`src/character/perks.ts`](../../src/character/perks.ts)): data; `PerkEffects` keys are summed by `perkBonus`. Perks can ask for skill levels (`healer` does).
- **Items** ([`src/inventory/inventory.ts`](../../src/inventory/inventory.ts)): an `Item` has one `slot`. `ItemStats` covers damage, attack cost, range, two-handedness, `acBonus` and `toHit`. Only `mainHand`, `offHand` and `armor` have items. `WEAPONS` is "every weapon in the game": `createCharacter` puts every one a hero does not hold into its backpack, and the simulator's `--player-weapon` picks from it. `ring1` and `ring2` are separate slots.
- **Engine** ([`src/engine/battleEngine.ts`](../../src/engine/battleEngine.ts)): actions are `move`, `attack`, `equip`, `end_turn`. A unit record holds stats, hp, position, facing, ap and two flags. `equip` swaps the stat block and caps hp at the new maximum. `checkWinner` tests the player's side first. `LOG_SCHEMA_VERSION` is 13.
- **Attack resolution** ([`src/combat/combat.ts`](../../src/combat/combat.ts)): `resolveAttack(attacker, defenderAc, rng, bonus)` draws one roll to hit and, on a hit, the damage dice. `CombatantStats` already has one optional field (`weapon`); `sameCombatStats` compares field by field.
- **Policies** ([`src/engine/policies.ts`](../../src/engine/policies.ts)): `aggressive` attacks with the best bonus or closes on the nearest foe, judging reach by `attackRange` and `attackApCost`.
- **Party** ([`src/game/party.ts`](../../src/game/party.ts)): three `STARTING_HEROES`. Intelligence: Aldric 4, Brenna 7, Corwin 5. The `wizard` and `priestess` portraits exist and are unused.
- **Encounters and scaling** ([`src/game/encounters.ts`](../../src/game/encounters.ts), [`src/game/worldMap.ts`](../../src/game/worldMap.ts)): `FOES_AT_THREAT` is `[2, 3, 3, 3, 4]`, tuned for a party of three. Twelve monster locations: two at threat 1, four at 2, two each at 3, 4 and 5.
- **Game state** ([`src/game/gameState.ts`](../../src/game/gameState.ts)): `{ party, world }`.
- **Battle screen** ([`src/scenes/BattleScene.ts`](../../src/scenes/BattleScene.ts)): two buttons, Attack and End Turn. `targeting: boolean` is the pick-a-foe mode; Esc leaves it. `endBattle` calls `clearLocation` and `rewardVictory` and shows `describeRewards`' lines. Keys I, C, S open the panel.
- **Character panel** ([`src/scenes/InventoryScene.ts`](../../src/scenes/InventoryScene.ts)): three tabs. Gear can be changed only when a member's `gearApCost` is not null, which `WorldScene` never passes, so gear is view-only on the world map. The Ground section edits whatever `Item[]` the member's `ground` is. Ten perk rows of 38px fill the Skills tab to y = 484 of the panel's 500; three tabs of 140px sit clear of the "[ESC] Close" hint, a fourth would not.
- **Simulator** ([`scripts/simulate.ts`](../../scripts/simulate.ts)): fights one encounter many times. The campaign run used for both past retunes was a throwaway script and is not in the repository (project memory).

## 4. Proposed behaviour

### 4.1 Sorcery, known spells and mana (R1 to R3)

Sorcery starts at `20 + 4 × intelligence`. A tag adds 20 as for any skill.

| Spell | Sorcery | Mana | AP | Range | Target | Effect |
| --- | --- | --- | --- | --- | --- | --- |
| Firebolt | 50% | 3 | 4 | 5 | a foe | 1d10 damage |
| Mend | 65% | 4 | 4 | 3 | a wounded ally, or the caster | heals 1d6+2 |
| Fireburst | 90% | 7 | 6 | 4 | a foe | 1d8 damage to it and to every unit beside it |

A character knows a spell from the moment its own Sorcery reaches the requirement: its attributes, tag and trained points, with nothing from gear. So of the present heroes Brenna (48%) is two skill points from Firebolt, and the others further.

Maximum mana is `2 × intelligence`, plus `floor(intelligence / 2)` for each level above the first, plus perks and gear. A character that knows no spell has no mana and the screens show none for it. Mana is a battle's budget: it starts full and is gone when spent. It is never stored on the character, in keeping with the rule that a character's numbers are derived.

These numbers are starting values. R15's retune may move them.

### 4.2 Casting in battle (R4, R5)

A unit may cast a spell when it is its side's turn, it stands, it knows the spell, and it has the action points and the mana. Legal targets, all standing and within the spell's range in hexes:

- Firebolt and Fireburst: any foe.
- Mend: any unit of the caster's side with fewer hit points than its maximum, the caster included (distance 0).

Casting pays the action points and the mana, turns the caster to face a target on another hex, and ends a paid-for change of gear exactly as an attack does. It provokes nothing.

A damaging spell is rolled like an attack, once for each unit it touches: the chance is the caster's spell skill less the unit's armour class, kept between 5 and 95; a roll within the caster's critical chance doubles the dice. Flanking and facing add nothing to a spell: it is the reliable strike, where a blade is the one that rewards position. Fireburst touches its target first and then every other standing unit adjacent to the target in roster order, whichever side it is on, the caster too if it stands there.

Mend always works: it rolls its dice and restores that much, up to the target's maximum. It cannot raise the fallen.

Units felled by a spell fall after the spell's event, in the order they were touched, and then the battle's end is judged once. A Fireburst that fells the last unit of both sides is a defeat, since the player's side is tested first.

### 4.3 The player's flow (R7)

1. With a unit selected, the **Cast** button sits between Attack and End Turn, reading `Cast (15)`: the unit's mana. It is hidden for a unit without magic and disabled when the unit can cast nothing now. Key: `M`.
2. Pressing it swaps the button row for one button per known spell, in the table's order, labelled with name and mana cost (`Firebolt 3`), plus **Cancel**. A spell the unit cannot cast now (too little mana or AP, or no target in range) is disabled. Keys `1` to `3` pick; Esc or Cancel returns to the usual row.
3. Picking a spell enters targeting for it. Only its legal targets are highlighted, red for a foe and green for an ally, each labelled with the chance to hit (Mend shows no label). The hint reads `Firebolt: choose a foe (4 AP, 3 mana). Esc to go back.` Hovering a Fireburst target outlines every hex the burst would touch, allies' included, each with its own chance.
4. A click on a legal target casts. Any other board click, Esc or Cancel goes back to the spell row.
5. Playback: a small coloured dot flies from caster to target (a tweened `Graphics` circle, no new sprite), each unit hurt flashes red as for a blow, a healed unit flashes green, and hit point bars follow. The log shows one line (section 5.3).

Clicking a foe outside these modes still means a weapon attack; spells are always cast through the button, so a mage in melee is never made to guess.

### 4.4 The Spells tab (R8)

A fourth tab, **Spells** (key `B`, for book, in the panel and in battle), shows the member's Sorcery, its mana (`Mana 15 / 18` in battle, `Mana 18` on the world map, `No mana` when it knows no spell) and a row for each spell in the style of a perk row: name, `3 mana · 4 AP · range 5`, the description, and `Sorcery 65%` at the right until the member knows it. Known spells are gold. The tab is read-only everywhere.

The Character tab's combat figures and the Inventory tab's stat lines gain a `Mana` line for a member with mana.

### 4.5 The mage (R9) and the perks (R10)

The fourth starting hero:

| Name | Portrait | S | P | E | I | A | L | Tagged | In hand |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Delwyn | `wizard` | 3 | 5 | 4 | 9 | 6 | 8 | Sorcery, First Aid | Wand of Sparks |

That gives 17 hit points, 8 action points, Sorcery 76%, 18 mana, and Firebolt and Mend from the start: two Firebolts a turn for three turns, then the wand. Like every hero Delwyn gets the steel breastplate and the spare weapons from `createCharacter`.

| Perk | Asks | Ranks | A rank adds |
| --- | --- | --- | --- |
| Wellspring | level 3, Sorcery 50% | 2 | +5 mana |
| Evoker | level 3, Sorcery 75% | 2 | +1 damage with spells and wands |

### 4.6 Magic items (R11)

| Id | Name | Slot | Adds | Icon |
| --- | --- | --- | --- | --- |
| `spark_wand` | Wand of Sparks | weapon | 1d6, 5 AP, range 4, strikes with Sorcery | `wand` |
| `storm_wand` | Wand of Storms | weapon | 1d10+1, 5 AP, range 5, strikes with Sorcery | `wand` |
| `emberblade` | Emberblade | weapon | 1d8+4, 5 AP, +10% to hit | `sword` |
| `hawk_bow` | Hawkeye Bow | weapon, two-handed | 1d8+2, 5 AP, range 6, +10% to hit | `bow` |
| `ring_protection` | Ring of Protection | ring | +5 armour class | `ring` |
| `ring_fortune` | Ring of Fortune | ring | +5% critical chance | `ring` |
| `amulet_focus` | Amulet of Focus | neck | +10% spell skill | `amulet` |
| `sage_circlet` | Sage's Circlet | head | +6 mana | `circlet` |
| `shadow_cloak` | Cloak of Shadows | cloak | +10 armour class | `cloak` |

Rules that are new:

- A **wand** is a ranged weapon whose chance to hit is the wielder's Sorcery rather than Archery. It costs no mana, holds no zone of control (its range is above 1), gains nothing from strength, and takes the Evoker perk's damage rather than Deadly Aim's. Far Shot lengthens it, as it does any ranged weapon.
- A **ring** fits either ring slot: equipping one fills the first ring slot if it is empty, else the second if that is empty, else replaces the first. Two of the same ring both count.
- An item's **spell skill** adds to the chance of the wearer's spells striking. It does not teach a spell and does not help a wand.
- An item's **mana** raises the maximum. Putting one on mid-battle adds no mana to spend; taking one off caps what is left at the new maximum.
- No item changes maximum hit points. That keeps `character.hp <= maxHp(character)` true however gear is changed outside battle (section 4.7).

Magic items are not in `WEAPONS`, so a new hero's backpack does not fill with them.

### 4.7 Loot and the baggage (R12, R13)

Every monster location has fixed loot, better the further out:

| Location | Threat | Loot |
| --- | --- | --- |
| Goblin Raiders | 1 | Ring of Protection |
| Kobold Scouts | 1 | Amulet of Focus |
| Goblin Reavers | 2 | Ring of Fortune |
| Kobold Trappers | 2 | Sage's Circlet |
| Goblin Warband | 2 | Ring of Protection |
| Kobold Diggers | 2 | Wand of Sparks |
| Kobold Skulkers | 3 | Cloak of Shadows |
| Goblin Marauders | 3 | Emberblade |
| Kobold Lurkers | 4 | Hawkeye Bow |
| Goblin Outriders | 4 | Wand of Storms |
| Kobold Tunnellers | 5 | Sage's Circlet |
| Goblin Pillagers | 5 | Emberblade |

A victory moves the location's loot into the party's **baggage**, one shared pile with no limit that travels with the party. The victory screen adds a line after the rewards: `Found: Ring of Protection.`

On the world map the character panel's Inventory tab works as it does in battle, at no cost, with the baggage where the ground is: the section is titled `Baggage`, a click on an item there takes it into the open member's backpack, and a right- or Ctrl+click on a backpack or equipped item puts it in the baggage. So an item passes from one member to another through the baggage, and new loot is put on there. The hint reads `Click to equip, stow or take; right- or Ctrl+click to put in the baggage.` An item pushed out of a hand with no backpack space falls into the baggage, as it falls to the ground in battle.

In battle nothing changes: the ground is the hex's pile, and the baggage is out of reach.

### 4.8 The AI (R6)

`aggressive` gives each unit, in this order, the first thing that applies:

1. **Mend** the ally with the lowest hit points among its legal Mend targets, if that ally is at or below half its maximum.
2. **Fireburst** the legal target whose burst touches the most foes, if it touches at least two foes and no unit of the caster's own side.
3. **Firebolt** the legal target with the fewest hit points (first in roster order on a tie).
4. Otherwise as today: the weapon attack with the best bonus, or a closing move.

The closing move judges reach by the unit's best way to do harm from afar: if it has the mana for a damaging spell it knows, the range and AP cost of the one with the longest range; otherwise its weapon's, as now. So a mage stops at Firebolt's range and does not walk into the line. The policy stays general: steps 1 to 3 run over whatever cast actions `legalActions` lists, keyed on each spell's effect, not on spell ids.

`random` needs no change; casts are among the legal actions it draws from.

### 4.9 Simulator (R14) and retune (R15)

The summary gains `avgPlayerCasts`, `avgEnemyCasts` and `avgPlayerHealing` (hit points Mend restored, per battle). Damage a spell does to the other side counts in the existing damage figures; damage to the caster's own side is left out of them and reported as `avgFriendlyFire`. Hit and critical rates stay weapon attacks only.

`--player-weapon` accepts any weapon-slot item, magic ones included.

`--campaign` changes what one of `--battles` is: a whole campaign. A new party fights the monster locations of a new world nearest first (by hex distance from where it stands, which is the last location beaten, starting at home; first in the world's list on a tie), each at its own threat, carrying its hit points, taking `rewardVictory` after each win and then `autoAdvance` for every member, until it clears the map or loses. Loot is not used: the simulator's heroes keep their starting gear. `--encounter`, `--threat` and `--party-level` are refused with `--campaign`. Every battle's events go to `--out` as now, each `battle_start` carrying `meta.campaign` (its number) and `meta.location`. The summary prints the share of campaigns that cleared the map, the mean number of locations cleared, and a table by threat of battles fought and the share won.

The retune keeps the standing target: the aggressive policy clears the map about 2 times in 3. The levers, in the order to try them, are `FOES_AT_THREAT` (a fourth hero most likely wants one more foe at some threats, and `GOBLIN_RAID` and `KOBOLD_SCOUTS` then need a fifth `FoeSlot` each, on hexes off `PARTY_START`), the per-level growth in `foeAtLevel`, and last the spell and mana numbers of section 4.1. Single cells are checked with `--encounter --threat --party-level` as before, and the sentences in `CLAUDE.md` about what a fresh party and an even-level party win are restated from those runs.

## 5. Technical design

All paths marked *new* are proposed.

### 5.1 Data: spells, skill, perks, items

**`src/combat/spells.ts`** (*new*, lowest layer, imports only `DamageRoll`):

```ts
export const SPELL_IDS = ['firebolt', 'mend', 'fireburst'] as const
export type SpellId = (typeof SPELL_IDS)[number]

export type SpellEffect =
  | { kind: 'damage'; dice: DamageRoll; /** 0 strikes the target alone; 1 also every unit beside it. */ radius: 0 | 1 }
  | { kind: 'heal'; dice: DamageRoll }

export interface Spell {
  name: string
  description: string
  /** The Sorcery, in percent, a character needs to know it. */
  skill: number
  manaCost: number
  apCost: number
  range: number
  effect: SpellEffect
}

export const SPELLS: Record<SpellId, Spell>
```

A damaging spell targets a foe and a healing one an ally; that follows from `effect.kind`, so there is no separate target field. The requirement is a plain number so that `combat/` does not import `character/`.

**`CombatantStats`** gains one optional field. Absent means the unit cannot cast, which is every existing stat block:

```ts
/** What the unit casts with; left out for a unit that knows no spell. */
magic?: {
  maxMana: number
  /** The chance in percent of a spell striking a foe of armour class 0. */
  skill: number
  /** Added to the damage of each spell that does any. */
  damageBonus: number
  /** In SPELL_IDS order. */
  spells: readonly SpellId[]
}
```

`sameCombatStats` compares it: both absent, or all four parts equal.

**`skills.ts`**: `'sorcery'` joins `SKILL_IDS` with `base: ({ intelligence }) => 20 + 4 * intelligence`. `createCharacter` builds `trained` from `SKILL_IDS` instead of naming each skill.

**`character.ts`**:

- `knownSpells(character): SpellId[]`: the `SPELL_IDS` whose `skill` is at most `skillLevel(character, 'sorcery')`.
- `maxMana(character): number`: 0 when `knownSpells` is empty, else `2 × int + (level − 1) × floor(int / 2) + perkBonus('maxMana')` plus the `maxMana` of worn items. "Worn" is the same set `deriveCombatStats` already computes (an off-hand item under a two-handed weapon counts for nothing).
- `weaponSkill(weapon)` returns `weapon.stats.skill` when the item names one, before its present rules.
- `deriveCombatStats`: `ranged` becomes "the weapon's range is above 1" (today it is "the skill is Archery"); the damage bonus is `spellDamage` for a Sorcery weapon, `rangedDamage` for another ranged one, else might and `meleeDamage`; `critChance` adds worn items' `critChance`; and `magic` is set when the character knows a spell: `{ maxMana: maxMana(c), skill: skillLevel(c, 'sorcery') + worn items' spellSkill, damageBonus: perkBonus(c, 'spellDamage'), spells: knownSpells(c) }`.
- `equipFromBackpack`: for an item whose `ring` flag is set (below), the slot is chosen as section 4.6 says; everything else is unchanged.

**`perks.ts`**: `PerkEffects` gains `maxMana` and `spellDamage`; `PERKS` gains `wellspring` and `evoker` (section 4.5). `AUTO_PERKS` becomes `tireless, evoker, wellspring, toughness, …`: only a caster qualifies for the two, so other builds are unaffected.

**`progression.ts`**: `autoAdvance` needs no change beyond `AUTO_PERKS`; the mage's weapon skill is Sorcery because it holds a wand.

**`inventory.ts`**:

- `ItemStats` gains `skill?: SkillId` (the skill a weapon strikes with), `maxMana?`, `spellSkill?`, `critChance?`. `describeItemStats` gets a line for each (`Strikes with Sorcery`, `Mana: +6`, `Spell Skill: +10%`, `Critical: +5%`). `inventory.ts` imports `SkillId` as a type only; `skills.ts` does not import `inventory.ts`, so no cycle.
- `Item` gains `ring?: true`. Ring items have `slot: 'ring1'` and the flag.
- `ItemIcon` gains `'wand' | 'ring' | 'amulet' | 'circlet' | 'cloak'`.
- The nine items of section 4.6 as constants, and `MAGIC_ITEMS: readonly Item[]` listing them. `WEAPONS` is unchanged.

**`attributes.ts`**: intelligence's description becomes `Skill points, mana, Sorcery, First Aid`.

**`party.ts`**: Delwyn joins `STARTING_HEROES`.

### 5.2 World state, loot and baggage

- `MonsterLocation` gains `loot: Item[]`; the `monsters(...)` helper in `worldMap.ts` takes it as a last argument and `newWorld` passes the table of section 4.7.
- `GameState` gains `baggage: Item[]`, empty in `newGame`.
- `gameState.ts` gains `takeLoot(game: GameState, location: MonsterLocation): Item[]`, which appends the location's loot to the baggage and returns it. `BattleScene.endBattle` calls it before `clearLocation` on a victory and appends `Found: <names>.` to the result lines when it returned anything. The names are joined as the log joins them (`A, B and C`).

### 5.3 Engine

**Action**

```ts
| { type: 'cast'; unit: UnitId; spell: SpellId; target: UnitId }
```

Every spell targets a unit, Fireburst included, so there is one shape and `legalActions` stays small.

**State**: `UnitRecord` and `UnitSnapshot` gain `mana: number`, set at construction to `stats.magic?.maxMana ?? 0`. `equip` sets `mana = min(mana, newStats.magic?.maxMana ?? 0)`. `startTurn` does not touch it.

**`legalActions`**: for each unit that can act, moves, then attacks (when it has the AP, as now), then for each spell in `stats.magic.spells` whose AP and mana it has, a cast on each legal target in roster order. The present early `continue` when AP is short of an attack must not skip the casts.

**`previewCast(unit, spell, target): CastPreview | null`**: null if the cast is not legal now; otherwise

```ts
interface CastPreview {
  apCost: number
  manaCost: number
  /** Every unit the spell would touch, target first; a damaging spell gives each its chance to be hit, 0.05 to 0.95. */
  affected: Array<{ unit: UnitId; hitChance?: number }>
}
```

**`step`** for a cast, in order: validate (the same test `legalActions` uses; otherwise throw `"<unit> cannot cast <spell> on <target>"`); subtract AP and mana; clear `gearChangePaid`; face the target if it is on another hex; resolve; record the `cast` event; then for each touched unit now at 0 hit points, in touched order, zero its AP and record `unit_down`; then `checkWinner` once.

**Resolution and RNG order.** For damage, for each touched unit in order (target, then the others adjacent to it in roster order): one call to `resolveAttack({ ...caster.stats, toHit: magic.skill, damage: { ...dice, bonus: dice.bonus + magic.damageBonus } }, unit.stats.ac, rng)`, with no situational bonus. That draws the roll to hit and then, on a hit, the dice, exactly as a weapon attack does, so a unit's draws are finished before the next unit's begin. For healing: one `rollDamage(dice, rng)`.

**Event**

```ts
export interface CastEvent extends EventBase {
  type: 'cast'
  caster: UnitId
  spell: SpellId
  target: UnitId
  distance: number
  apCost: number
  apAfter: number
  manaCost: number
  manaAfter: number
  casterFacing: number
  /** The caster's spell skill, before the target's armour. */
  skill: number
  /** Every unit touched, target first. */
  results: CastResult[]
}

export type CastResult =
  | {
      kind: 'damage'; unit: UnitId
      attackRoll: number; chance: number; defenderAc: number
      hit: boolean; critical: boolean; fumble: boolean
      damageDice: DamageRoll; damage: number
      hpBefore: number; hpAfter: number
    }
  | { kind: 'heal'; unit: UnitId; dice: DamageRoll; rolled: number; hpBefore: number; hpAfter: number }
```

`LOG_SCHEMA_VERSION` becomes 14: a new event type, and `mana` and `magic` in every unit snapshot.

**`formatEvent`**, one line per cast:

- One unit hurt: `Delwyn casts Firebolt: rolls 34 (needs 61 or less) — HITS Goblin for 7 dmg.` with `CRITICAL HIT!`, `MISSES Goblin.` and the fumble wording as for an attack.
- Several: `Delwyn casts Fireburst: Goblin 7 dmg, Kobold missed, Aldric 3 dmg.`
- Healing: `Delwyn casts Mend on Aldric: +6 HP.`, the figure being `hpAfter − hpBefore`; `on herself`-style wording is avoided by `Delwyn casts Mend: +6 HP.` when caster and target are the same.

### 5.4 Policies

As section 4.8. `policies.ts` imports `SPELLS` to read effects, ranges and costs. The burst's touched units are worked out from the state by a small exported helper in `battleEngine.ts`, `burstUnits(units, target)` (the target, then the standing units adjacent to it in roster order), which the engine's own resolution and `previewCast` also use, so the three cannot disagree.

### 5.5 Scenes

**`src/scenes/spellMenu.ts`** (*new*, Phaser-free): `spellChoices(engine, unit)` returns, for each spell the unit knows, `{ spell, label, enabled, targets: UnitId[] }`, from `legalActions(unit)`; and `castHint(spell)` returns the hint line. `BattleScene` builds its spell buttons from it.

**`BattleScene`**

- `targeting: boolean` becomes a mode: `'none' | 'attack' | 'spells' | { spell: SpellId }`. `setPlayerControl` resets it to `'none'` whenever the selected unit changes or control is lost, as it resets `targeting` now.
- A Cast button; the three buttons sit at `centreX − 160`, `centreX`, `centreX + 160`. In `'spells'` mode they are hidden and the spell buttons and Cancel take the row at the same spacing. Up to four buttons must fit at the minimum 840×560 window: shrink the button width if they do not.
- `boardIntent` gains a `cast` kind for a legal target while a spell is chosen; `refreshHighlights` and `refreshHover` draw what section 4.3 describes, from `previewCast`.
- `showEvent` handles `cast`: face the caster, fly the dot, flash and refresh each result's unit. `playerAct` pauses 600 ms after a cast, as after an attack.
- Keys: `M` casts, `1` to `3` pick a spell in `'spells'` mode, `B` opens the panel on Spells, and Esc steps back one mode before it opens the menu.
- `openPanel` passes each member's current `mana` from the engine's snapshot.

**`eventSchedule.ts`**: unchanged; a cast takes no scheduled time, like an attack.

**`sounds.ts`**: `SOUND_KEYS` gains `sfx_spell_cast` and `sfx_spell_heal`. A damaging cast cues `sfx_spell_cast` at 0 and, at `IMPACT_DELAY_MS`, the critical impact if any result is critical, else the hit impact if any hit, else the miss. A heal cues `sfx_spell_heal`. Both files are placeholder tones made as the audio README describes, and the README's table gains their rows.

**`InventoryScene`**

- `TABS` gains `['spells', 'Spells']`; `TAB_W` drops to 120 so four tabs clear the close hint. `PERK_ROW_H` drops to 32 so twelve perks end at y = 488; check both lines of a row still read at that height, and if not, scroll the perk list with a `SlotScroll` as the ground pile does.
- `PanelMember` gains `mana?: number` (what is left, in battle). `InventoryData` gains `groundTitle?: string`, default `'Ground'`.
- The gear hint has a third wording for the world map (section 4.7), chosen by `resumeKey`.

**`WorldScene.openPanel`** passes `{ character, gearApCost: 0, ground: gameState.baggage }` for every member and `groundTitle: 'Baggage'`. Nothing is needed on close: the characters and the baggage were edited in place.

**`itemIcons.ts`**: five new keys. **`art/icons/`**: five new sources, `icon_wand`, `icon_ring`, `icon_amulet`, `icon_circlet`, `icon_cloak`, drawn by the workflow in [`art/CLAUDE.md`](../../art/CLAUDE.md), with the sprites README updated.

**`testHook.ts`**

- `BattleProbe.buttons` gains `cast`; `BattleProbe` gains `spells: Array<ButtonProbe & { spell: SpellId }>` (the spell row, empty outside `'spells'` mode) and `casting: SpellId | null`.
- `InventoryProbe.tab` gains `'spells'`; `InventoryProbe` gains `spells: Array<{ spell: SpellId; known: boolean }>`, `mana: number | null` and `ground: Array<Point & { item: string }>` (the items the ground grid shows now), which a test needs in order to take loot from the baggage.

### 5.6 Documentation

`CLAUDE.md` in the same commits as the changes that make it wrong: the simulator flags; `spells.ts` and `spellMenu.ts`; the rules of casting, mana, known spells, wands and rings; loot and the baggage; `GameState`; the party of four; the panel's four tabs and gear on the world map (the roadmap memory's "gear changes on the world map" is no longer left out); the rules of scaling; and `LOG_SCHEMA_VERSION`.

## 6. Consequences

- **Balance.** A fourth hero, burst damage and in-battle healing each make the party stronger, and `CLAUDE.md` already says to retune when there is more healing than First Aid. The present numbers will be too easy until R15 is done, so the retune belongs at the end of the same piece of work, not after it. Loot is outside the simulator, so the played game will run a little easier than the tuned figure; the items are modest on purpose.
- **Stalling to heal.** Because mana is a battle's budget and hit points carry over, a player can keep a last weak foe alive and spend the rest of the mage's mana on Mend. It is bounded (18 mana is four Mends, about 22 hit points) and costs turns under attack. Accepted; a mana pool that carried between battles would remove it at the price of a stored number and a rule for getting mana back.
- **Friendly fire** is the first way a player can fell its own unit. The hover outline in section 4.3 is what makes that a choice and not an accident.
- **Log consumers** must handle schema 14: a `cast` event, and damage and deaths that no `attack` event precedes.
- **Existing tests** that count three heroes, list four skills or three tabs, or assume ten perks will need updating; stat blocks built by hand in tests need nothing, since `magic` is optional.
- **Party of three assumptions**: `PARTY_START` already has six hexes and `MAX_PARTY_SIZE` is 6, so a fourth hero needs no board change. A fifth foe slot does need hexes chosen.
- **No saved games exist**, so nothing migrates.

### Choices and their alternatives

- *Spells known by skill threshold, not learned from books or perks.* It stores nothing, follows the Unarmed die's precedent, and makes Sorcery points worth spending for any hero. The cost is that every caster of equal skill has the same spells; schools or spellbooks can come later as a second gate on `knownSpells`.
- *One skill, not one per school.* Three spells do not carry two skills.
- *Spells ignore flanking and facing.* It keeps a clear difference between a caster and an archer, and keeps Fireburst from needing an arc for each unit it touches.
- *Fireburst targets a unit, not a hex.* One action shape, a short `legalActions`, and the existing click-a-foe targeting. The cost is that a burst cannot be centred on an empty hex between two foes.
- *The baggage, not loot into backpacks.* Backpacks are nearly full of spare weapons, members could not hand items to each other outside battle, and the panel's ground section already does everything a shared pile needs.

## 7. Verification

Domain tests (`npx vitest run --project domain`), with seeded or scripted RNGs:

- `skills`, `character`: Sorcery's base and tag; `knownSpells` at 49, 50, 65 and 90 (A1); `maxMana` by intelligence, level, Wellspring and the circlet, and 0 without a spell; `deriveCombatStats` sets and omits `magic`; a wand's chance to hit is Sorcery, takes Evoker and not Deadly Aim, gains nothing from strength; items' critical chance and spell skill; `sameCombatStats` with and without `magic`.
- `character` (equipping): a ring into an empty first slot, then the second, then replacing the first (A10).
- `battleEngine`: cast legality in every direction (A3); AP and mana paid and carried (A2); Firebolt hit, miss, critical and fumble from scripted rolls; Mend capped at the maximum and refused on the unhurt and the fallen; Fireburst's touched units and their order, an ally felled, both sides' last units felled together (A4); `equip` capping mana; `previewCast` agreeing with what `step` then does; two engines with one seed giving one log (A5); `formatEvent`'s three lines.
- `policies`: each of the four steps of section 4.8 chosen in a state built for it; a mage with mana stops at Firebolt's range, and one without it closes to its wand's.
- `party`, `gameState`, `worldMap`: four heroes, Delwyn's derived numbers; every monster location has loot; `takeLoot` moves it.
- `spellMenu`, `sounds`: choices enabled and disabled by mana, AP and targets; cues for a hit, a miss, a critical and a heal.
- `simulate`: the new summary fields from a hand-built log; a campaign with a fixed seed runs to an end, reports per-threat rows and refuses `--threat` (A6, A11).

Scene smoke tests (`--project scenes`): `Battle` and `Inventory` still start with the new buttons and tab.

In-browser tests (`npm run test:browser`), following [`e2e/CLAUDE.md`](../../e2e/CLAUDE.md):

- Battle: cast Firebolt through the Cast button and a foe; the probe's log ends in a `cast` event and the mage's `mana` fell by 3; Esc from targeting returns to the spell row and again to the usual buttons (A7).
- Panel: the Spells tab opens by its tab and by `B`, with two spells known for Delwyn (A8); the perk list and the four tabs fit at 840×560.
- World: win the nearest battle (with a seed that wins), open the panel, take the ring from the baggage, equip it, and see the armour class rise by 5 (A9).

Balance: the campaign run and the single-cell runs of section 4.9, their results written into `CLAUDE.md` (A12).

## 8. Open questions and assumptions

None of these blocks planning. Each is a decision made here on judgement, with the default the design assumes.

1. **A fourth starting hero.** Assumed: Delwyn joins the three. Without a caster at the start, magic would be invisible until Brenna is trained into it. The alternative that avoids a larger party is to rebuild Corwin as the mage; R15's retune is needed either way, but would be smaller.
2. **Mana refills every battle.** Assumed, for the reasons in sections 4.1 and 6. The alternative is a pool that carries like hit points and comes back with travel or levels.
3. **No consumables and no enemy casters in this pass.** Assumed. Both are natural next steps, and the second is nearly free once this lands.
4. **Spell and item numbers** are first values, to be moved by the retune.
5. **Emberblade and the Hawkeye Bow reuse the plain sword and bow icons.** Assumed, to hold the art to five new icons; the tooltip tells them apart.
6. **Risk: panel room.** The Skills tab's perk list and the tab row are both at their limit (section 5.5). The fallbacks are given there, and the in-browser check at 840×560 is what decides.
7. **Risk: retune effort.** A fourth hero may not be answered by foe counts alone, since `FOES_AT_THREAT` moves in whole foes. `foeAtLevel`'s growth is the finer lever.
