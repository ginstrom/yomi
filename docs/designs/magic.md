# Magic: spellcasting and magic items

## 1. Purpose and status

Yomi's heroes fight with blades, bows and fists, and eight of the eleven equipment slots have nothing to hold. This design adds magic in two halves, and trims the skill list to make room for it:

- **Skills**: Unarmed and First Aid go. The three skills are Melee Weapons, Archery and **Magic**.
- **Spellcasting**: spells are learned as perks. The first is **Magic Arrow**. A caster has mana, and a mage joins the starting party.
- **Magic items**: enchanted gear for the empty slots and the weapon hand, won as loot from monster locations and handed round the party on the world map.

**Status: ready for planning.** Nothing blocks implementation. Section 8 lists the decisions made here on judgement; the first three are worth confirming before planning.

Decisions the user made, which the design keeps as given: Unarmed and First Aid are removed; Magic is a skill; spells come through perks; the perks will later become a perk tree; the first spell perk is Magic Arrow.

## 2. Requirements and scope

### Functional requirements

| ID | Requirement |
| --- | --- |
| R1 | The **Unarmed** skill is removed. Bare hands strike with Melee Weapons and roll a fixed die. |
| R2 | The **First Aid** skill is removed, with everything that hangs on it: the tending after a victory, the Healer perk and the `firstAid` perk effect. |
| R3 | **Magic** is a skill like the others: it starts from intelligence, can be tagged and is raised with skill points. It is the chance of a spell striking. |
| R4 | A **spell is learned by taking its perk**. The Magic Arrow perk asks for Magic 50% and teaches Magic Arrow. A character knows exactly the spells its perks teach. |
| R5 | A character that knows a spell has **mana**: a maximum derived from intelligence, level and gear. Every battle starts at the maximum; mana does not return during a battle. |
| R6 | In battle a unit can **cast** a spell it knows on a foe in range for the spell's action points and mana. The engine resolves it, logs it as an event, and lists it in `legalActions`. |
| R7 | The `aggressive` policy casts, so the game's enemy AI and the simulator's sides use spells when their units have them. |
| R8 | The player casts from the battle screen: a Cast button, then a target, with the odds shown and a way to back out. |
| R9 | A new game's party has a fourth hero, a mage, who starts with the Magic Arrow perk. |
| R10 | **Magic items** exist for the neck, head, cloak and ring slots and as enchanted weapons, including wands that strike with Magic. Items can add to mana, spell skill and critical chance as well as to what items add today. |
| R11 | Each monster location holds **loot**, which a victory there moves into the party's shared **baggage**. The victory screen names it. |
| R12 | On the world map the character panel can change gear for free, and its ground section shows the baggage, through which items pass between members. |
| R13 | The simulator reports casts, and gains a `--campaign` mode that plays the whole map, which is how scaling is retuned. |
| R14 | Scaling is retuned for a party of four with magic and without First Aid, and `CLAUDE.md`'s rules of scaling are rewritten with the new numbers. |

### Quality constraints

- All rules live in the Phaser-free domain modules with tests; `BattleScene` decides no outcome.
- A battle still replays exactly from its seed and its actions.
- `LOG_SCHEMA_VERSION` goes from 13 to 14.
- A unit without magic behaves exactly as today, so existing stat blocks need no new fields.
- Teaching a spell is a property of a perk's data, so the coming perk tree adds spells by adding entries.

### Non-goals

- **The perk tree.** Perks stay a flat list with requirements. This design adds one spell perk and the way a perk teaches a spell; the tree, and the spells on it, come later.
- **Any spell but Magic Arrow.** That leaves out healing, area spells and lasting effects, and with them friendly fire and per-unit effect state in the engine. Section 6 says what each would need.
- **Choosing among several spells in battle.** With one spell in the game the Cast button needs no spell list; one comes with the second spell.
- **A replacement for First Aid.** After this change, wounds heal only on a new level.
- Consumables: potions, scrolls, charges on wands. There is no "use item" action.
- Enemy casters. The engine and the policy support them; adding one is a stat block with a `magic` entry, a sprite and a `FOE_XP` value.
- Line of sight, spell interruption, free attacks provoked by casting, armour hampering a caster.
- A mage sprite: every hero is still drawn as the `warrior` kind.
- Shops, random loot, item weight or value.

### Acceptance criteria

| ID | Criterion | Covers |
| --- | --- | --- |
| A1 | `SKILL_IDS` is `melee`, `archery`, `magic`. A character with nothing in hand hits with its Melee Weapons skill and rolls 1d4. | R1, R3 |
| A2 | A won battle restores no hit points except through a new level, and its reward lines mention no healer. No perk or perk effect names First Aid. | R2 |
| A3 | A level 3 character with Magic 50% and a perk pick can take Magic Arrow, and one with 49% cannot. Before taking it the character has no spells and no mana; after, it knows Magic Arrow and has mana. | R4, R5 |
| A4 | The mage enters battle with 18 mana; a Magic Arrow leaves 15 and 4 fewer action points; the next battle starts at 18 again. | R5, R6, R9 |
| A5 | A cast with too little mana or action points, out of range, on an ally or on a fallen foe throws from `step` and is absent from `legalActions`. | R6 |
| A6 | Two engines given the same seed and the same actions, casts included, produce identical logs. | R6 |
| A7 | In a simulated battle the mage logs `cast` events, and the summary counts them. | R7, R13 |
| A8 | In the browser: select the mage, press Cast, click a foe; the log shows the cast and the Cast button shows 3 less mana. Esc backs out of targeting. | R8 |
| A9 | Winning at Goblin Raiders puts a Ring of Protection in the baggage and names it on the victory screen; on the world map a member takes it from the baggage and wears it, and its armour class rises by 5. | R10, R11, R12 |
| A10 | A second ring goes into the empty ring slot, not over the first. | R10 |
| A11 | `npm run simulate -- --campaign --battles 500 --seed 1` prints the share of campaigns that clear the map and the win rate at each threat. | R13 |
| A12 | That share is about 2 in 3 with the aggressive policy, and `CLAUDE.md` states the numbers that give it. | R14 |

## 3. Current system

Inspected facts, with the files they come from.

- **Skills** ([`src/character/skills.ts`](../../src/character/skills.ts)): `SKILL_IDS` is `melee`, `archery`, `unarmed`, `firstAid`. `TAGGED_SKILLS` is 2. `Character.trained` is a `Record<SkillId, number>`, filled in by hand in `createCharacter`.
- **Unarmed** ([`src/character/character.ts`](../../src/character/character.ts)): `weaponSkill` returns `unarmed` for an empty hand, and `unarmedDamage` picks a die from `UNARMED_DICE` by the Unarmed skill (1d2 up to 1d8). A bare-handed attack costs 3 AP.
- **First Aid** ([`src/game/party.ts`](../../src/game/party.ts)): `rewardVictory` has the best healer standing restore `firstAidHp` to every member; `VictoryReward.healer` and `MemberReward.tended` report it and `describeRewards` prints it. The `healer` perk and the `firstAid` key of `PerkEffects` add to it ([`src/character/perks.ts`](../../src/character/perks.ts)). `autoAdvance` trains First Aid for a character tagged in it ([`src/character/progression.ts`](../../src/character/progression.ts)).
- **Perks**: data; numeric `PerkEffects` are summed by `perkBonus`. A perk can ask for a level, attributes and skills. A pick comes every third level (`PERK_LEVEL_STEP`), so the first at level 3. `Build` has no way to start a character with a perk. Ten perks fill the Skills tab's perk list to the bottom of the panel.
- **Starting heroes**: Aldric is tagged Melee and Unarmed, Brenna Archery and First Aid, Corwin Melee and Archery. Intelligence: 4, 7, 5. The `wizard` portrait exists and is unused.
- **Items** ([`src/inventory/inventory.ts`](../../src/inventory/inventory.ts)): an `Item` has one `slot`. `ItemStats` covers damage, attack cost, range, two-handedness, `acBonus` and `toHit`. Only `mainHand`, `offHand` and `armor` have items. `WEAPONS` is "every weapon in the game": `createCharacter` puts every one a hero does not hold into its backpack, and the simulator's `--player-weapon` picks from it. `ring1` and `ring2` are separate slots.
- **Engine** ([`src/engine/battleEngine.ts`](../../src/engine/battleEngine.ts)): actions are `move`, `attack`, `equip`, `end_turn`. `equip` swaps the stat block and caps hp at the new maximum. `LOG_SCHEMA_VERSION` is 13.
- **Attack resolution** ([`src/combat/combat.ts`](../../src/combat/combat.ts)): `resolveAttack(attacker, defenderAc, rng, bonus)` draws one roll to hit and, on a hit, the damage dice. `CombatantStats` already has one optional field (`weapon`); `sameCombatStats` compares field by field.
- **Policies** ([`src/engine/policies.ts`](../../src/engine/policies.ts)): `aggressive` attacks with the best bonus or closes on the nearest foe, judging reach by `attackRange` and `attackApCost`.
- **Encounters and scaling** ([`src/game/encounters.ts`](../../src/game/encounters.ts), [`src/game/worldMap.ts`](../../src/game/worldMap.ts)): `FOES_AT_THREAT` is `[2, 3, 3, 3, 4]`, tuned for a party of three that First Aid tends after each win. Twelve monster locations: two at threat 1, four at 2, two each at 3, 4 and 5.
- **Game state** ([`src/game/gameState.ts`](../../src/game/gameState.ts)): `{ party, world }`.
- **Battle screen** ([`src/scenes/BattleScene.ts`](../../src/scenes/BattleScene.ts)): two buttons, Attack and End Turn. `targeting: boolean` is the pick-a-foe mode; Esc leaves it. `endBattle` calls `clearLocation` and `rewardVictory` and shows `describeRewards`' lines.
- **Character panel** ([`src/scenes/InventoryScene.ts`](../../src/scenes/InventoryScene.ts)): gear can be changed only when a member's `gearApCost` is not null, which `WorldScene` never passes, so gear is view-only on the world map. The Ground section edits whatever `Item[]` the member's `ground` is.
- **Simulator** ([`scripts/simulate.ts`](../../scripts/simulate.ts)): fights one encounter many times. The campaign run used for both past retunes was a throwaway script and is not in the repository (project memory).

## 4. Proposed behaviour

### 4.1 The three skills (R1 to R3)

| Skill | Starts at | Does |
| --- | --- | --- |
| Melee Weapons | `30 + 2 × (strength + agility)` | Chance to hit with a blade, an axe or bare hands |
| Archery | `30 + 2 × (perception + agility)` | Chance to hit with a bow |
| Magic | `20 + 4 × intelligence` | Chance of a spell or a wand striking; what spell perks ask for |

**Bare hands** strike with Melee Weapons, roll 1d4 and cost 3 action points. The die no longer grows with a skill.

**Tags.** With three skills, a character is tagged in one (`TAGGED_SKILLS` becomes 1): Aldric Melee, Brenna Archery, Corwin Melee, and the mage Magic. The tag still adds 20 and doubles what a skill point buys.

**After a victory** nobody tends wounds. A member who fell still gets back up at `REVIVED_HP`, and a new level still heals fully; nothing else restores hit points.

### 4.2 Spell perks, known spells and mana (R4, R5)

| Perk | Asks | Ranks | Teaches |
| --- | --- | --- | --- |
| Magic Arrow | level 1, Magic 50% | 1 | Magic Arrow |

| Spell | Mana | AP | Range | Target | Effect |
| --- | --- | --- | --- | --- | --- |
| Magic Arrow | 3 | 4 | 5 | a foe | 1d10 damage |

A character knows a spell when it has a rank of a perk that teaches it. The perk is taken like any other, with a pick, on the world map; its level requirement is 1 so that a starting character can be built with it, though a pick first comes at level 3. Of the present heroes, Brenna (Magic 48%, untagged) is two skill points from qualifying.

Maximum mana is `2 × intelligence`, plus `floor(intelligence / 2)` for each level above the first, plus gear. A character that knows no spell has no mana and the screens show none for it. Mana is a battle's budget: it starts full and is gone when spent. It is never stored on the character, in keeping with the rule that a character's numbers are derived.

These numbers are starting values. R14's retune may move them.

### 4.3 Casting in battle (R6)

A unit may cast a spell when it is its side's turn, it stands, it knows the spell, and it has the action points and the mana. A legal target is a standing foe within the spell's range in hexes.

Casting pays the action points and the mana, turns the caster to face its target, and ends a paid-for change of gear exactly as an attack does. It provokes nothing.

Magic Arrow is rolled like an attack: the chance is the caster's spell skill less the target's armour class, kept between 5 and 95; a roll within the caster's critical chance doubles the dice; a roll above 95 is a fumble. Flanking and facing add nothing to a spell: it is the reliable strike, where a blade is the one that rewards position.

### 4.4 The player's flow (R8)

1. With a unit selected, the **Cast** button sits between Attack and End Turn, reading `Cast (15)`: the unit's mana. It is hidden for a unit without magic and disabled when the unit can cast nothing now (too little mana or AP, or no foe in range). Key: `M`.
2. Pressing it enters targeting for the unit's spell, and the button reads Cancel. Only the spell's legal targets are highlighted, each labelled with the chance to hit. The hint reads `Magic Arrow: choose a foe (4 AP, 3 mana). Esc or Cancel to go back.`
3. A click on a legal target casts. Any other board click, Esc or Cancel goes back.
4. Playback: a small coloured dot flies from caster to target (a tweened `Graphics` circle, no new sprite), a unit hurt flashes red as for a blow, and its hit point bar follows. The log shows one line (section 5.3).

Unlike Attack, Cast always asks for the target, even when only one foe is in range: mana is too dear to spend on a slip. Clicking a foe outside targeting still means a weapon attack, so a mage is never made to guess which it will get.

The Character tab's combat figures and the Inventory tab's stat lines gain a `Mana` line for a member with mana: `Mana 15 / 18` in battle, `Mana 18` on the world map. The Magic Arrow perk appears in the Skills tab's perk list like any perk; there is no separate list of spells.

### 4.5 The mage (R9)

| Name | Portrait | S | P | E | I | A | L | Tagged | Perk | In hand |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Delwyn | `wizard` | 3 | 5 | 4 | 9 | 6 | 8 | Magic | Magic Arrow | Wand of Sparks |

That gives 17 hit points, 8 action points, Magic 76% and 18 mana: two Magic Arrows a turn for three turns, then the wand. Like every hero Delwyn gets the steel breastplate and the spare weapons from `createCharacter`.

### 4.6 Magic items (R10)

| Id | Name | Slot | Adds | Icon |
| --- | --- | --- | --- | --- |
| `spark_wand` | Wand of Sparks | weapon | 1d6, 5 AP, range 4, strikes with Magic | `wand` |
| `storm_wand` | Wand of Storms | weapon | 1d10+1, 5 AP, range 5, strikes with Magic | `wand` |
| `emberblade` | Emberblade | weapon | 1d8+4, 5 AP, +10% to hit | `sword` |
| `hawk_bow` | Hawkeye Bow | weapon, two-handed | 1d8+2, 5 AP, range 6, +10% to hit | `bow` |
| `ring_protection` | Ring of Protection | ring | +5 armour class | `ring` |
| `ring_fortune` | Ring of Fortune | ring | +5% critical chance | `ring` |
| `amulet_focus` | Amulet of Focus | neck | +10% spell skill | `amulet` |
| `sage_circlet` | Sage's Circlet | head | +6 mana | `circlet` |
| `shadow_cloak` | Cloak of Shadows | cloak | +10 armour class | `cloak` |

Rules that are new:

- A **wand** is a ranged weapon whose chance to hit is the wielder's Magic rather than Archery. In every other respect it is a ranged weapon: it costs no mana, holds no zone of control, gains nothing from strength, and takes the Deadly Aim and Far Shot perks as a bow does.
- A **ring** fits either ring slot: equipping one fills the first ring slot if it is empty, else the second if that is empty, else replaces the first. Two of the same ring both count.
- An item's **spell skill** adds to the chance of the wearer's spells striking. It does not count towards what a spell perk asks and does not help a wand.
- An item's **mana** raises the maximum of a wearer who knows a spell, and does nothing for one who does not. Putting one on mid-battle adds no mana to spend; taking one off caps what is left at the new maximum.
- No item changes maximum hit points. That keeps `character.hp <= maxHp(character)` true however gear is changed outside battle (section 4.7).

Magic items are not in `WEAPONS`, so a new hero's backpack does not fill with them.

### 4.7 Loot and the baggage (R11, R12)

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

### 4.8 The AI (R7)

`aggressive` gives each unit the first of these that applies:

1. **Cast** a damaging spell on the legal target with the fewest hit points (first in roster order on a tie).
2. Otherwise as today: the weapon attack with the best bonus, or a closing move.

The closing move judges reach by the unit's best way to do harm from afar: if it has the mana for a spell it knows, that spell's range and AP cost; otherwise its weapon's, as now. So a mage stops at Magic Arrow's range and does not walk into the line, and one out of mana closes to its wand's range. Step 1 runs over whatever cast actions `legalActions` lists, not over spell ids.

`random` needs no change; casts are among the legal actions it draws from.

### 4.9 Simulator (R13) and retune (R14)

The summary gains `avgPlayerCasts` and `avgEnemyCasts`. A spell's damage counts in the existing damage figures. Hit and critical rates stay weapon attacks only.

`--player-weapon` accepts any weapon-slot item, magic ones included.

`--campaign` changes what one of `--battles` is: a whole campaign. A new party fights the monster locations of a new world nearest first (by hex distance from where it stands, which is the last location beaten, starting at home; first in the world's list on a tie), each at its own threat, carrying its hit points, taking `rewardVictory` after each win and then `autoAdvance` for every member, until it clears the map or loses. Loot is not used: the simulator's heroes keep their starting gear. `--encounter`, `--threat` and `--party-level` are refused with `--campaign`. Every battle's events go to `--out` as now, each `battle_start` carrying `meta.campaign` (its number) and `meta.location`. The summary prints the share of campaigns that cleared the map, the mean number of locations cleared, and a table by threat of battles fought and the share won.

The retune keeps the standing target: the aggressive policy clears the map about 2 times in 3. Two changes pull against each other: a fourth hero makes each battle easier, and the loss of First Aid makes a run of battles harder, since wounds now last until the next level. The levers, in the order to try them, are `FOES_AT_THREAT` (should a threat want a fifth foe, `GOBLIN_RAID` and `KOBOLD_SCOUTS` need a fifth `FoeSlot` each, on hexes off `PARTY_START`), the per-level growth in `foeAtLevel`, and last the spell and mana numbers of section 4.2. Single cells are checked with `--encounter --threat --party-level` as before, and the sentences in `CLAUDE.md` about what a fresh party and an even-level party win are restated from those runs.

## 5. Technical design

All paths marked *new* are proposed.

### 5.1 Data: skills, spells, perks, items

**`skills.ts`**: `SKILL_IDS` becomes `['melee', 'archery', 'magic']`; `unarmed` and `firstAid` leave `SKILLS`; `magic` joins with `base: ({ intelligence }) => 20 + 4 * intelligence`. `TAGGED_SKILLS` becomes 1. Melee's description becomes `Chance to hit with a blade, an axe or bare hands`.

**`src/combat/spells.ts`** (*new*, lowest layer, imports only `DamageRoll`):

```ts
export const SPELL_IDS = ['magic_arrow'] as const
export type SpellId = (typeof SPELL_IDS)[number]

export interface Spell {
  name: string
  description: string
  manaCost: number
  apCost: number
  range: number
  /** What it does to the foe it strikes. */
  damage: DamageRoll
}

export const SPELLS: Record<SpellId, Spell>
```

A spell does not name the perk that teaches it or the skill it asks for: the perk does, so `combat/` does not import `character/`.

**`CombatantStats`** gains one optional field. Absent means the unit cannot cast, which is every existing stat block:

```ts
/** What the unit casts with; left out for a unit that knows no spell. */
magic?: {
  maxMana: number
  /** The chance in percent of a spell striking a foe of armour class 0. */
  skill: number
  /** In SPELL_IDS order. */
  spells: readonly SpellId[]
}
```

`sameCombatStats` compares it: both absent, or all three parts equal.

**`perks.ts`**:

- `Perk` gains `spell?: SpellId`: the spell a rank of it teaches. It sits beside `effects`, not in it, because `perkBonus` sums numbers.
- `PERKS` gains `magic_arrow: { name: 'Magic Arrow', description: 'Teaches Magic Arrow: 1d10 to a foe within 5 hexes, for 3 mana', ranks: 1, level: 1, skills: { magic: 50 }, effects: {}, spell: 'magic_arrow' }`.
- `healer` leaves `PERKS` and `firstAid` leaves `PerkEffects`. `heavy_hand`'s description keeps "and bare hands". The list stays at ten perks, so the Skills tab's layout does not change.
- `knownSpells(character): SpellId[]`: the `SPELL_IDS` taught by a perk the character has a rank of. It lives here, beside `perkBonus`, as the other way a perk's data is read.

**`character.ts`**:

- `Build` gains `perks?: PerkId[]`, each given at rank 1 by `createCharacter` without spending a pick or checking what the perk asks. `createCharacter` builds `trained` from `SKILL_IDS` instead of naming each skill.
- `UNARMED_DICE` and `unarmedDamage` go; bare hands roll a constant `{ count: 1, sides: 4, bonus: 0 }`.
- `weaponSkill(weapon)`: `weapon.stats.skill` when the item names one; else `archery` for a range above 1; else `melee`, the empty hand included.
- `maxMana(character): number`: 0 when `knownSpells` is empty, else `2 × int + (level − 1) × floor(int / 2)` plus the `maxMana` of worn items. "Worn" is the set `deriveCombatStats` already computes (an off-hand item under a two-handed weapon counts for nothing).
- `deriveCombatStats`: `ranged` becomes "the weapon's range is above 1" (today it is "the skill is Archery"), so a wand gets no might and takes `rangedDamage` and `range`; `critChance` adds worn items' `critChance`; and `magic` is set when the character knows a spell: `{ maxMana: maxMana(c), skill: skillLevel(c, 'magic') + worn items' spellSkill, spells: knownSpells(c) }`.
- `equipFromBackpack`: for an item whose `ring` flag is set (below), the slot is chosen as section 4.6 says; everything else is unchanged.
- `WARRIOR_BUILD.tagged` becomes `['melee']`.

**`progression.ts`**: `autoAdvance` loses its First Aid step: the weapon's skill to mastery, then the weapon again, then whatever is left to raise. The mage's weapon skill is Magic because it holds a wand. `AUTO_PERKS` is unchanged; Magic Arrow is reached through the fallback to any perk on offer.

**`party.ts`**: `FIRST_AID_PER_HP` and `firstAidHp` go. `rewardVictory` awards experience and stands the fallen up, and nothing more; `VictoryReward` loses `healer` and `MemberReward` loses `tended`; `describeRewards` loses its last line. Tags become Brenna `['archery']` and Corwin `['melee']`. Delwyn joins `STARTING_HEROES` with `perks: ['magic_arrow']`.

**`attributes.ts`** descriptions: perception `Archery`; intelligence `Skill points, mana and Magic`.

**`inventory.ts`**:

- `ItemStats` gains `skill?: SkillId` (the skill a weapon strikes with), `maxMana?`, `spellSkill?`, `critChance?`. `describeItemStats` gets a line for each (`Strikes with Magic`, `Mana: +6`, `Spell Skill: +10%`, `Critical: +5%`). `inventory.ts` imports `SkillId` as a type only; `skills.ts` does not import `inventory.ts`, so no cycle.
- `Item` gains `ring?: true`. Ring items have `slot: 'ring1'` and the flag.
- `ItemIcon` gains `'wand' | 'ring' | 'amulet' | 'circlet' | 'cloak'`.
- The nine items of section 4.6 as constants, and `MAGIC_ITEMS: readonly Item[]` listing them. `WEAPONS` is unchanged.

### 5.2 World state, loot and baggage

- `MonsterLocation` gains `loot: Item[]`; the `monsters(...)` helper in `worldMap.ts` takes it as a last argument and `newWorld` passes the table of section 4.7.
- `GameState` gains `baggage: Item[]`, empty in `newGame`.
- `gameState.ts` gains `takeLoot(game: GameState, location: MonsterLocation): Item[]`, which appends the location's loot to the baggage and returns it. `BattleScene.endBattle` calls it before `clearLocation` on a victory and appends `Found: <names>.` to the result lines when it returned anything. The names are joined as the log joins them (`A, B and C`).

### 5.3 Engine

**Action**

```ts
| { type: 'cast'; unit: UnitId; spell: SpellId; target: UnitId }
```

**State**: `UnitRecord` and `UnitSnapshot` gain `mana: number`, set at construction to `stats.magic?.maxMana ?? 0`. `equip` sets `mana = min(mana, newStats.magic?.maxMana ?? 0)`. `startTurn` does not touch it.

**`legalActions`**: for each unit that can act, moves, then attacks (when it has the AP, as now), then for each spell in `stats.magic.spells` whose AP and mana it has, a cast on each standing foe within the spell's range, in roster order. The present early `continue` when AP is short of an attack must not skip the casts.

**`previewCast(unit, spell, target): CastPreview | null`**: null if the cast is not legal now; otherwise `{ apCost, manaCost, hitChance }`, the last from 0.05 to 0.95.

**`step`** for a cast, in order: validate with the same test `legalActions` uses, else throw `"<unit> cannot cast <spell> on <target>"`; subtract AP and mana; clear `gearChangePaid`; face the target; resolve; record the `cast` event; then, if the target fell, zero its AP, record `unit_down` and `checkWinner`, as an attack does.

**Resolution**: one call to `resolveAttack({ ...caster.stats, toHit: magic.skill, damage: spell.damage }, target.stats.ac, rng)` with no situational bonus. It draws from the RNG exactly as a weapon attack does: the roll to hit, then the dice on a hit.

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
  attackRoll: number
  chance: number
  defenderAc: number
  hit: boolean
  critical: boolean
  fumble: boolean
  damageDice: DamageRoll
  damage: number
  targetHpBefore: number
  targetHpAfter: number
}
```

`LOG_SCHEMA_VERSION` becomes 14: a new event type, and `mana` and `magic` in unit snapshots.

**`formatEvent`**: `Delwyn casts Magic Arrow: rolls 34 (needs 61 or less) — HITS Goblin for 7 dmg.`, with `CRITICAL HIT!`, `MISSES Goblin.` and the fumble wording as for an attack.

### 5.4 Policies

As section 4.8. `policies.ts` imports `SPELLS` for ranges and costs.

### 5.5 Scenes

**`BattleScene`**

- `targeting: boolean` becomes `targeting: 'attack' | SpellId | null`. `setPlayerControl` clears it whenever control is lost or the action it was for is no longer legal, as it clears the flag now.
- A Cast button; the three buttons sit at `centreX − 160`, `centreX`, `centreX + 160`, and must fit at the minimum 840×560 window: shrink the button width if they do not. While a spell is being targeted the Cast button reads Cancel, as Attack does in its own mode.
- `onCast` picks the first spell in the unit's `magic.spells` that has a legal cast and sets `targeting` to it. `boardIntent` gains a `cast` kind for a legal target while a spell is targeted; `refreshHighlights` draws those targets and their odds from `previewCast`.
- `showEvent` handles `cast`: face the caster, fly the dot, flash the target and refresh its bar. `playerAct` pauses 600 ms after a cast, as after an attack.
- Keys: `M` is the Cast button.
- `openPanel` passes each member's current `mana` from the engine's snapshot.

**`eventSchedule.ts`**: unchanged; a cast takes no scheduled time, like an attack.

**`sounds.ts`**: `SOUND_KEYS` gains `sfx_spell_cast`. A cast cues it at 0 and, at `IMPACT_DELAY_MS`, the same outcome sound an attack would. The file is a placeholder tone made as the audio README describes, and the README's table gains its row.

**`InventoryScene`**

- `PanelMember` gains `mana?: number` (what is left, in battle). `InventoryData` gains `groundTitle?: string`, default `'Ground'`.
- The stat lines and the Character tab show mana as section 4.4 says. The Skills tab needs no layout change: three skill rows where there were four, ten perk rows as before.
- The gear hint has a third wording for the world map (section 4.7), chosen by `resumeKey`.

**`WorldScene.openPanel`** passes `{ character, gearApCost: 0, ground: gameState.baggage }` for every member and `groundTitle: 'Baggage'`. Nothing is needed on close: the characters and the baggage were edited in place.

**`itemIcons.ts`**: five new keys. **`art/icons/`**: five new sources, `icon_wand`, `icon_ring`, `icon_amulet`, `icon_circlet`, `icon_cloak`, drawn by the workflow in [`art/CLAUDE.md`](../../art/CLAUDE.md), with the sprites README updated.

**`testHook.ts`**

- `BattleProbe.buttons` gains `cast`; `BattleProbe` gains `casting: SpellId | null`.
- `InventoryProbe` gains `mana: number | null` and `ground: Array<Point & { item: string }>` (the items the ground grid shows now), which a test needs in order to take loot from the baggage. Its `skills` record follows `SkillId` and so loses two entries and gains one.

### 5.6 Documentation

`CLAUDE.md` in the same commits as the changes that make it wrong: the three skills and the single tag; every mention of Unarmed, First Aid, the healer's tending and `firstAidHp`; how a perk teaches a spell; the rules of casting and mana; wands and rings; loot and the baggage; `GameState`; the party of four; gear on the world map; `spells.ts`; the simulator flags; the rules of scaling; and `LOG_SCHEMA_VERSION`. The roadmap memory's "gear changes on the world map" is no longer left out.

## 6. Consequences

- **Healing.** With First Aid gone, a party's wounds last until a level heals them. Hit points become the campaign's hard limit, and the order in which the player takes on locations matters more. This is the largest change to how the game plays, larger than Magic Arrow, and the retune must be judged by campaign runs, not single battles.
- **Balance.** The present numbers were tuned for three heroes with First Aid. They will be wrong in both directions until R14 is done, so the retune belongs at the end of the same piece of work. Loot is outside the simulator, so the played game will run a little easier than the tuned figure; the items are modest on purpose.
- **Unarmed builds end.** Bare hands become a fallback at 1d4, where a trained Unarmed skill reached 1d8. Aldric loses his second tag and Brenna hers; neither changes how they fight with what they hold.
- **Log consumers** must handle schema 14: a `cast` event, and damage and deaths that no `attack` event precedes.
- **Existing tests** of Unarmed dice, First Aid, the Healer perk, the healer's reward line, three heroes and two tags will be deleted or rewritten; stat blocks built by hand in tests need nothing, since `magic` is optional.
- **Party size**: `PARTY_START` already has six hexes and `MAX_PARTY_SIZE` is 6, so a fourth hero needs no board change.
- **No saved games exist**, so nothing migrates.

### What later spells will need

Recorded so the perk tree can be planned against it; none of it is built here.

- *Another damaging spell on one foe*: a `SPELLS` entry and a perk. The battle screen then needs a way to choose among a unit's spells; the Cast button taking the first castable one is the assumption that breaks.
- *A healing spell*: `Spell` needs an effect other than `damage`, cast legality needs ally targets, and `CastEvent` needs a result that is not a roll to hit.
- *An area spell*: one cast touches several units, so the event carries a list of results and the order of RNG draws across them must be fixed. It is also the first way to hurt one's own side.
- *A lasting effect*: per-unit state in the engine with a duration, and a mark for it on the unit's plate.

### Choices and their alternatives

- *A perk names the spell it teaches (`Perk.spell`), not a numeric effect.* It keeps `perkBonus` a sum of numbers and makes "which spells does this character know" one filter over its perks, which is the shape a perk tree will want.
- *Magic is both the gate to spell perks and the chance to hit.* Otherwise the skill would do nothing once the perk was taken, and a point in it would be a point wasted.
- *Spells ignore flanking and facing.* It keeps a clear difference between a caster and an archer.
- *One tag, not two of three.* Tagging two of three skills is hardly a choice, and it would force a second tag on heroes with no use for one.
- *The baggage, not loot into backpacks.* Backpacks are nearly full of spare weapons, members could not hand items to each other outside battle, and the panel's ground section already does everything a shared pile needs.
- *`CastEvent` is flat, with one target's result.* It mirrors `AttackEvent` and is all Magic Arrow needs. An area spell will change its shape and bump the schema again, which is cheap here.

## 7. Verification

Domain tests (`npx vitest run --project domain`), with seeded or scripted RNGs:

- `skills`, `character`: the three skills and Magic's base and tag (A1); bare hands strike with Melee at 1d4; `weaponSkill` for an empty hand, a sword, a bow and a wand; a wand takes Deadly Aim and Far Shot and nothing from strength; `maxMana` by intelligence, level and the circlet, and 0 without a spell, circlet or not; `deriveCombatStats` sets and omits `magic`; items' critical chance and spell skill; `sameCombatStats` with and without `magic`; a `Build` with `perks` starts with them.
- `perks`, `progression`: Magic Arrow qualifies at Magic 50% and not at 49%; `takePerk` then makes `knownSpells` return it (A3); `autoAdvance` no longer trains a skill that does not exist.
- `character` (equipping): a ring into an empty first slot, then the second, then replacing the first (A10).
- `party`: four heroes and Delwyn's derived numbers; `rewardVictory` restores nothing but through a level and a revival, and `describeRewards` has no healer's line (A2).
- `battleEngine`: cast legality in every direction (A5); AP and mana paid and carried (A4); a hit, a miss, a critical and a fumble from scripted rolls; the target felled and the battle won by a cast; `equip` capping mana; `previewCast` agreeing with what `step` then does; two engines with one seed giving one log (A6); `formatEvent`'s line.
- `policies`: a caster with mana casts on the weakest foe in range before it would strike with its weapon; with mana it stops at Magic Arrow's range, and without it closes to its wand's.
- `gameState`, `worldMap`: every monster location has loot; `takeLoot` moves it.
- `sounds`: cues for a cast that hits, misses and is critical.
- `simulate`: the new summary fields from a hand-built log; a campaign with a fixed seed runs to an end, reports per-threat rows and refuses `--threat` (A7, A11).

Scene smoke tests (`--project scenes`): `Battle` and `Inventory` still start.

In-browser tests (`npm run test:browser`), following [`e2e/CLAUDE.md`](../../e2e/CLAUDE.md):

- Battle: cast Magic Arrow through the Cast button and a foe; the probe's log ends in a `cast` event and the mage's `mana` fell by 3; Esc leaves targeting (A8). The three buttons fit at 840×560.
- Panel: the Skills tab shows three skills, and Magic Arrow among the perks, taken for Delwyn.
- World: win the nearest battle (with a seed that wins), open the panel, take the ring from the baggage, equip it, and see the armour class rise by 5 (A9).

Balance: the campaign run and the single-cell runs of section 4.9, their results written into `CLAUDE.md` (A12).

## 8. Open questions and assumptions

None of these blocks planning. Each is a decision made here on judgement, with the default the design assumes.

1. **Nothing replaces First Aid's healing.** Assumed: removing the skill removes the tending after a victory, and wounds heal only on a level. The alternatives are to keep a flat tending that needs no skill, or to wait for a healing spell on the perk tree. This shapes the whole campaign, so it is the one to confirm first.
2. **One tag a character.** Assumed, now that there are three skills. Keeping two would mean choosing second tags for Aldric, Brenna and the mage.
3. **A fourth starting hero.** Assumed: Delwyn joins the three, starting with the Magic Arrow perk, since a pick does not otherwise come before level 3 and no present hero has Magic 50%. The alternative is to rebuild Corwin as the mage.
4. **Bare hands roll 1d4.** Assumed; any fixed die serves, as bare hands are now only a fallback.
5. **Mana refills every battle.** Assumed, as it stores nothing. The alternative is a pool that carries like hit points and comes back with travel or levels.
6. **Magic Arrow rolls to hit.** Assumed, so that the Magic skill matters after the perk is taken. An arrow that never misses is the classic alternative, and would leave the skill as only a gate.
7. **Spell, mana and item numbers** are first values, to be moved by the retune.
8. **Emberblade and the Hawkeye Bow reuse the plain sword and bow icons.** Assumed, to hold the art to five new icons; the tooltip tells them apart.
9. **Risk: retune effort.** A fourth hero and the loss of healing may not be answered by foe counts alone, since `FOES_AT_THREAT` moves in whole foes. `foeAtLevel`'s growth is the finer lever.
