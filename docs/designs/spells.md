# Spells: offence, healing and support

## 1. Purpose and status

Yomi has one spell, Magic Arrow, and a caster is a weaker archer with a mana bar. This design makes magic a way of playing of its own: three schools of spells (offensive, healing and support), learned from a spell tree that grows out of one perk, **Spellcasting**; area spells that burn friend and foe alike; lasting effects in battle (sleep, poison, blessings, shields); healing in battle and, from what a caster has left over, between battles on the world map; and an enemy caster, the Goblin Shaman, that heals its side and curses the party.

**Status: ready for planning.** The four decisions in section 8 that shape the game were put to the user and answered (8.1 to 8.4). The rest are judgement calls recorded with their defaults; the spell numbers are first values for the retune (R16) to move.

It follows [`magic.md`](magic.md), which built Magic Arrow, mana, the perk tree and casting, and whose "What later spells will need" this design answers. Where that document and the code differ, the code is right.

## 2. Requirements and scope

### Functional requirements

| ID | Requirement |
| --- | --- |
| R1 | **Spellcasting** is a perk of the Intelligence branch. It teaches no spell; it makes a character a caster and opens the spell tree. Magic Arrow leaves the perk tree for the spell tree. |
| R2 | A **spell tree** holds seventeen spells in three schools (offensive, healing, support), each spell a perk that teaches it. A spell asks for the spell before it, or for Spellcasting at the root of a school. |
| R3 | A caster earns **spell picks**: two when it takes Spellcasting, and one with every level after. A spell pick buys only a spell; an ordinary perk pick may buy a spell too. |
| R4 | Spells may target a **foe**, an **ally** (the caster included), the **caster** alone, or an **area** of hexes, and may deal damage, restore hit points, or lay a **lasting effect**. |
| R5 | A **hostile** spell rolls to hit each unit it touches, as Magic Arrow does. An area spell that is hostile touches **everyone** in the area, the caster's own side and the caster included. A friendly spell never misses and touches only the caster's side. |
| R6 | **Lasting effects** (statuses) last a number of the affected unit's turns and change its armour class, chance to hit or action points, damage it at the start of its turns, put it to sleep, or absorb blows. |
| R7 | The player chooses **which spell** to cast in battle: the Cast button opens a list of the unit's spells; an area spell shows the hexes it would touch and the odds on each unit before it is cast. |
| R8 | A unit's nameplate shows its **statuses**; the log names each one laid, each one's damage, and each one's end. |
| R9 | **Mana carries between battles** on the character, like hit points: a battle still starts at full mana, and what a caster has left when it ends stays with it until the next battle or level. |
| R10 | On the world map, the character panel's new **Spells** tab lists a character's spells and casts its **healing spells** on party members, paid from the mana it carries. |
| R11 | Character creation shows the spell tree beside the perk tree, and a character created with Spellcasting spends its two spell picks there. The ready-made mage starts with Spellcasting, Magic Arrow and Heal. |
| R12 | The `aggressive` policy heals, protects itself, blesses, puts foes to sleep and throws area spells where they hurt no ally, so the game's enemy and the simulator's sides use the new spells. |
| R13 | A **Goblin Shaman** enemy (Magic Arrow, Heal, Bane) takes the field in Goblin Raid battles from threat 2. |
| R14 | `autoAdvance` spends spell picks, and a new `autoHeal` spends a party's leftover mana on its wounds after a won battle, so the campaign simulator plays casters as a player would. |
| R15 | The simulator reports hit points healed and statuses laid. |
| R16 | Scaling is retuned for healing and the shaman, and `CLAUDE.md`'s rules of scaling restated from the new runs. |

### Quality constraints

- Every rule lives in the Phaser-free domain modules with tests; `BattleScene`, `InventoryScene` and `CreationScene` decide no outcome.
- A battle replays exactly from its seed and actions. The order in which a cast and a status draw from the RNG is fixed (section 5.3).
- A unit with no statuses and a stat block with no `magic` behaves exactly as today.
- A spell is data: a new spell of an existing shape is one entry in `SPELLS` and one in the spell perks' table, and both trees draw it with no new code.
- A character stores only what it was born with, what it has learned and what it has left (`hp`, and now `mana`); everything else stays derived.
- `LOG_SCHEMA_VERSION` 15 → 16; `SAVE_VERSION` 2 → 3.

### Non-goals

- Raising the fallen, summoning, teleporting, walls or lingering clouds on the ground (a status is on a unit, never on a hex).
- Casting a spell other than a healing one outside battle.
- Line of sight, interrupting a cast, casting provoking a free attack, armour hampering a caster.
- Resistances or saving throws: every hostile spell is the caster's Magic against the target's armour class, as Magic Arrow is.
- Spell scrolls, wands that cast spells, items that teach spells.
- More than one enemy caster kind; a mage sprite for heroes (every hero is still the `warrior` body).
- Mana that regenerates with time on the world map (section 8.4).

### Acceptance criteria

| ID | Criterion | Covers |
| --- | --- | --- |
| A1 | A level 1 character with Magic 40% and a pick can take Spellcasting; after it, it has two spell picks, knows no spell and has no mana; after a spell pick on Heal, it knows Heal and has mana. The perk tree has no Magic Arrow node and Deep Well asks for Spellcasting. | R1, R3 |
| A2 | The spell tree lays out all seventeen spells in three columns and nine rows, each school's rows together, and no spell perk appears in the perk tree. | R2 |
| A3 | A caster that levels gains a spell pick; one without Spellcasting gains none. Taking a spell spends a spell pick if it has one, else a perk pick; an ordinary perk never spends a spell pick. | R3 |
| A4 | A Fireball centred one hex from a goblin, with the caster's ally beside the goblin, rolls to hit both in roster order and can hurt both; a Fireball whose area holds no foe is not legal. | R4, R5 |
| A5 | Heal on an ally at 3/17 restores its dice, never above its maximum, rolls no chance to hit, and is not legal on a foe or a fallen ally. | R4, R5 |
| A6 | Sleep on a goblin: on its next turn it has 0 AP and holds no zone of control; a blow on it gains the helpless bonus, and any damage wakes it (`status_end`, `woke`). After two of its turns it wakes anyway. | R6 |
| A7 | Death Cloud's poison deals its dice at the start of each of the poisoned unit's next three turns, logged as `status_tick`, and can fell it, ending the battle at the start of a turn. | R6 |
| A8 | Mirror Image on a caster: the next three hits on it, attacks or hostile spells, strike an image and do nothing; the fourth hurts. | R6 |
| A9 | Two engines given the same seed and the same actions, area casts and ticking statuses included, produce identical logs; a snapshot taken with statuses in force restores to an engine that plays on identically. | R4–R6 |
| A10 | In the browser: select the mage, press Cast, pick Heal from the list, click a wounded ally; its hit point bar rises and the Cast button shows 3 less mana. Press Cast, pick an area spell; hovering a hex outlines its area and shows each touched unit's odds; Esc backs out of the list and out of targeting. | R7 |
| A11 | In the browser: after Bless, each blessed unit's plate shows the Bless mark; it goes when the status ends. | R8 |
| A12 | A mage ending a won battle with 7 of 22 mana has 7 on the world map, casts Heal on a wounded member from the Spells tab, has 4, and the member's hit points rose by Heal's average. The next battle starts at 22. A level fills mana. | R9, R10 |
| A13 | Creation: a draft that takes Spellcasting reads `Spells: 2 to choose`, its spell tree's tier 1 nodes open; removing Spellcasting drops the spells and says so. The ready-made mage knows Magic Arrow and Heal. | R11 |
| A14 | Policy: a caster with a heal and an ally below half its hit points heals before it strikes; a caster never casts a hostile area spell that touches an ally or itself; a Shaman with mana for one Heal keeps it rather than spend it on Magic Arrow. | R12 |
| A15 | A Goblin Raid at threat 1 has no shaman; at threat 2 the Goblin Shaman is among its three foes and casts in a simulated battle. | R13 |
| A16 | `npm run simulate -- --campaign --battles 500 --seed 1` prints healing and statuses, and the clear rate is about 2 in 3 with `CLAUDE.md` restating the numbers that give it. | R14–R16 |

## 3. Current system

Inspected facts:

- **Spells** ([`src/combat/spells.ts`](../../src/combat/spells.ts)): `SPELL_IDS = ['magic_arrow']`; `Spell` is `{ name, description, manaCost, apCost, range, damage }`.
- **Perks** ([`src/character/perks.ts`](../../src/character/perks.ts)): data with `branch`, optional `requires` (one parent) and optional `spell`. `magic_arrow` is a perk of the Intelligence branch asking Magic 50%; `deep_well` requires it. `knownSpells` filters `SPELL_IDS` by perks taken. Twenty-seven perks fill the tree's three columns and eleven rows exactly ([`PerkTreeView.ts`](../../src/scenes/PerkTreeView.ts): rows 31 px apart from y 100, strip under the last row; panel 720×500).
- **Tree layout** ([`src/scenes/perkTree.ts`](../../src/scenes/perkTree.ts)): `perkTreeLayout()` places every perk, a branch per attribute, trunk at column 0, a perk on the row of its first child. `PerkTreeView` computes its nodes once, at module load, from that layout.
- **Mana** ([`src/character/character.ts`](../../src/character/character.ts)): `maxMana` is 0 without a known spell, else `2 × int + (level − 1) × floor(int / 2)` plus gear and perks. Nothing stores mana; the engine starts each unit at `stats.magic.maxMana` and never restores it.
- **Engine** ([`src/engine/battleEngine.ts`](../../src/engine/battleEngine.ts)): `Action` `cast` is `{ unit, spell, target: UnitId }`; `canCast` asks a standing foe in range; `cast` pays, faces, calls `resolveAttack` with `spellcaster(stats, spell)` and records one flat `CastEvent`, then `fell`. `startTurn` returns nothing. `UnitRecord` has `mana` and no per-unit effects. `LOG_SCHEMA_VERSION` is 15.
- **Free attacks** (`reactorsAt`): every standing, ready unit with `attackRange` 1 adjacent to the hex left.
- **Policies** ([`src/engine/policies.ts`](../../src/engine/policies.ts)): `aggressive` = `weakestCast ?? bestBonusAttack ?? closingMove`; `reach` takes the first known spell it can afford.
- **Progression** ([`src/character/progression.ts`](../../src/character/progression.ts)): `levelUp` adds skill points, a perk pick every 3rd level and heals fully. `takePerk` spends a perk pick and adds any rise in `maxHp` to `hp`. `autoAdvance` takes `AUTO_PERKS` then any perk.
- **Creation** ([`src/character/creation.ts`](../../src/character/creation.ts)): `CharacterDraft.perks` in the order taken; `draftCharacter` replays them with `takePerk` from `CREATION_PERK_PICKS` (3); `pruneDraft` drops what no longer qualifies.
- **Prerolls** ([`src/game/party.ts`](../../src/game/party.ts)): the mage has `perks: ['magic_arrow', 'arcane_study', 'keen_eye']`, Intelligence 9, tagged Magic.
- **Encounters** ([`src/game/encounters.ts`](../../src/game/encounters.ts)): `FOES_AT_THREAT = [2, 3, 3, 3, 3]`; a setup fields the first N `FoeSlot`s; `UnitKind` is `warrior | goblin | kobold`; `FOE_XP` goblin 80, kobold 50. `foeAtLevel` ([`combat.ts`](../../src/combat/combat.ts)) adds 5 to-hit and 5 AC a level; it does not touch `magic`.
- **Battle screen** ([`src/scenes/BattleScene.ts`](../../src/scenes/BattleScene.ts)): `targeting: 'attack' | SpellId | null`; `onCast` takes the first castable spell; nameplates have name, hit point bar and AP pips.
- **Character panel** ([`src/scenes/InventoryScene.ts`](../../src/scenes/InventoryScene.ts)): tabs Character, Skills, Inventory, and the perk tree as a fourth view; P toggles it.
- **Simulator** ([`scripts/simulate.ts`](../../scripts/simulate.ts)): the campaign copies each member's hp back from the engine, then `rewardVictory` and `autoAdvance`.
- **Saves** ([`src/game/save.ts`](../../src/game/save.ts)): `SAVE_VERSION` 2; `Character` and `BattleSnapshot` are saved whole.

## 4. Proposed behaviour

### 4.1 Spellcasting and spell picks (R1, R3)

| Perk | Branch | Asks | Ranks | Does |
| --- | --- | --- | --- | --- |
| Spellcasting | Intelligence | level 1, Magic 40% | 1 | Opens the spell tree; 2 spell picks at once, and 1 with every level after |

Spellcasting takes Magic Arrow's place in the perk tree, so the tree keeps its eleven rows; Deep Well asks for Spellcasting where it asked for Magic Arrow.

A **spell pick** is spent only on a spell. When a character takes a spell it spends a spell pick if it has one, and otherwise an ordinary perk pick; an ordinary perk always spends a perk pick. A level brings a spell pick only to a character that already has Spellcasting: a warrior who takes Spellcasting at level 6 gets its two then, and nothing for the levels before.

A character knows the spells it has taken. As now, it has mana only once it knows a spell.

With the ready-made mage (Intelligence 9, Magic 63%) and a campaign that ends near level 6, a dedicated caster learns about seven spells: enough to choose a school or two, never all seventeen.

### 4.2 The spells (R2, R4, R5)

Each spell asks for the one before it in its column of the tree, and a tier's level and Magic:

| Tier | Asks |
| --- | --- |
| 1 | level 1, Magic 40%, Spellcasting |
| 2 | level 3, Magic 55%, the tier 1 spell before it |
| 3 | level 5, Magic 70%, the tier 2 spell before it |

**Offensive** (hostile: each unit touched is rolled for, the caster's Magic against its armour class, kept between 5 and 95, a critical doubling the dice as for Magic Arrow)

| Spell | Tier, from | Mana | AP | Range | Target | Effect |
| --- | --- | --- | --- | --- | --- | --- |
| Magic Arrow | 1, Spellcasting | 3 | 4 | 5 | foe | 1d10 |
| Flame Arrow | 2, Magic Arrow | 5 | 4 | 5 | foe | 2d8 |
| Sleep | 2, Magic Arrow | 5 | 4 | 5 | foe | Asleep, 2 turns |
| Frost Blast | 2, Magic Arrow | 6 | 5 | 4 | area, radius 1 | 1d8 and Chilled, 1 turn |
| Fireball | 3, Flame Arrow | 10 | 6 | 6 | area, radius 1 | 3d6 |
| Acid Arrow | 3, Flame Arrow | 7 | 4 | 5 | foe | 1d8 and Corroded, 3 turns |
| Death Cloud | 3, Sleep | 10 | 6 | 5 | area, radius 1 | Poisoned, 3 turns |

**Healing** (friendly: never misses, touches only the caster's side, restores its dice up to each unit's maximum)

| Spell | Tier, from | Mana | AP | Range | Target | Restores |
| --- | --- | --- | --- | --- | --- | --- |
| Heal | 1, Spellcasting | 3 | 4 | 4 | ally | 1d8+2 |
| Greater Heal | 2, Heal | 6 | 4 | 4 | ally | 2d8+4 |
| Heal All | 2, Heal | 8 | 5 | caster, radius 2 | allies around the caster | 1d8 each |
| Greater Heal All | 3, Heal All | 14 | 6 | caster, radius 2 | allies around the caster | 2d8+2 each |

**Support** (Shield, Mirror Image, Protect, Haste and Bless are friendly; Bane is hostile)

| Spell | Tier, from | Mana | AP | Range | Target | Effect |
| --- | --- | --- | --- | --- | --- | --- |
| Shield | 1, Spellcasting | 3 | 2 | caster | the caster | Shielded, 3 turns |
| Protect | 1, Spellcasting | 3 | 3 | 4 | ally | Protected, 3 turns |
| Bless | 1, Spellcasting | 4 | 4 | caster, radius 2 | allies around the caster | Blessed, 3 turns |
| Mirror Image | 2, Shield | 6 | 3 | caster | the caster | Mirrored: 3 images, 3 turns |
| Haste | 2, Protect | 7 | 4 | 4 | ally | Hasted, 2 turns |
| Bane | 2, Bless | 5 | 4 | 5 | area, radius 1 | Baned, 3 turns |

"Ally" includes the caster. An **area** spell is aimed at a hex within its range and touches every standing unit within its radius of that hex; a spell whose area is "caster, radius 2" is centred on the caster's own hex. A hostile area spell touches everyone there, so a Fireball thrown into a melee hurts the party's fighters and can fell the caster. A friendly area spell touches only the caster's side. A hostile spell aimed at an area with no standing foe in it is not legal: the engine refuses to waste mana on an empty patch of floor.

The spell tree, as section 4.6 draws it:

```
 Offensive  [Magic Arrow ]─┬[Flame Arrow ]─┬[Fireball    ]
                           │               └[Acid Arrow  ]
                           ├[Sleep       ]──[Death Cloud ]
                           └[Frost Blast ]
 Healing    [Heal        ]─┬[Greater Heal]
                           └[Heal All    ]──[Greater Heal All]
 Support    [Shield      ]──[Mirror Image]
            [Protect     ]──[Haste       ]
            [Bless       ]──[Bane        ]
```

(The school names are drawn as a coloured edge on each node and named in the strip; there is no column for them.)

### 4.3 Lasting effects (R6)

| Status | Mark | Does |
| --- | --- | --- |
| Asleep | `Z` | Gets no AP at the start of its turns; holds no zone of control; attacks on it gain +20 (`HELPLESS_BONUS`). Any damage ends it. |
| Chilled | `C` | −3 AP at the start of its turns, never below 0. |
| Corroded | `A` | −5 armour class; 1d4 damage at the start of its turns. |
| Poisoned | `P` | 1d6 damage at the start of its turns. |
| Shielded | `S` | +15 armour class. |
| Protected | `D` | +10 armour class. |
| Blessed | `B` | +10 to its chance to hit, weapon and spell alike. |
| Baned | `X` | −15 to its chance to hit, weapon and spell alike. |
| Hasted | `H` | +3 AP at the start of its turns. |
| Mirrored | `M` | Each hit on it, by an attack or a hostile spell, strikes an image instead: no damage, no status, one image fewer. Ends when the images do. |

Rules common to all:

- **Duration** is counted in the affected unit's turns. A status ends after the end of the affected unit's side's turn on which its count reaches 0; a status laid during the affected unit's own side's turn counts that turn as its first. So Bless (3) cast on the party's turn lasts this turn and the next two; Sleep (2) cast on a goblin sleeps through the goblin's next two turns.
- **AP changes** (Asleep, Chilled, Hasted) apply at the start of each of the unit's turns, after its AP is refilled. Laid during the unit's own side's turn, they apply at once too: Haste on a fighter mid-turn gives it 3 AP now, and a hero caught in its own side's Frost Blast loses 3.
- **Damage at the start of a turn** (Corroded, Poisoned) is dealt to each affected unit of the side whose turn begins, in roster order, before anyone acts. It wakes a sleeper, ignores images, and may fell the unit and end the battle.
- **The same status laid again** does not stack: it takes the longer of the two durations, and Mirrored its images anew. Different statuses stack: Shielded and Protected together are +25 armour class.
- Armour class never goes below 0 by a status.
- A unit that falls loses its statuses. Statuses end with the battle; nothing carries to the world map.

### 4.4 The player's flow in battle (R7, R8)

1. **Cast** (M) opens a **spell list** above the button, one row per spell the unit knows, in `SPELL_IDS` order: name, mana and AP (`Fireball  10 mana  6 AP`). A row is greyed when the spell has no legal cast now; hovering a row shows its description in the hint line. A click or the row's number key (1–9) picks it; Esc, Cancel or a click elsewhere closes the list.
2. Picking a spell enters targeting for it, the Cast button reading Cancel, the hint `Fireball: choose where (10 mana, 6 AP). Esc or Cancel to go back.`
   - A spell aimed at a **unit** highlights its legal targets, each labelled with its chance (hostile) or nothing (friendly); a click on one casts.
   - An **area** spell highlights the legal centres; hovering one outlines every hex of its area and labels each unit it would touch with its chance, allies included, so friendly fire is seen before it is paid for. A click casts.
   - A spell centred on the **caster** (Shield, Bless, Heal All) highlights the caster and its area; a click on the caster casts. Like every spell, it always asks.
3. Playback: a dot flies from the caster to the target or centre; an area flashes; each unit hurt flashes red, each healed or helped flashes green, and its plate follows. An image struck flashes white. Start-of-turn damage flashes the unit red before the side acts.
4. **Statuses** show on the nameplate as a row of one-letter marks in the status's colour beside the hit point bar (section 4.3's Mark column). The selected unit's statuses and turns left are named in the hint line under its AP (`Blessed 2, Shielded 1`).

The log lines:

- `Delwyn casts Fireball: Goblin hit for 11; Kobold missed; Aldric hit for 9.`
- `Delwyn casts Heal on Aldric: +7 (12/19).`
- `Delwyn casts Sleep on Goblin: rolls 34 (needs 51 or less) — Goblin falls asleep.`
- `Delwyn casts Bless: Aldric, Brenna and Delwyn are blessed.`
- `Goblin takes 4 from poison.` / `Goblin wakes.` / `Aldric is no longer blessed.` / `Goblin strikes an image of Delwyn.`

### 4.5 Mana between battles and casting on the world map (R9, R10)

A character now carries its **mana** as it carries its hit points:

- A battle begins at full mana, as now, whatever the character carried in.
- When a battle is won, each member keeps the mana its unit has left.
- A level fills it, as it heals.
- Taking a perk or spell that raises the maximum raises the mana carried by as much, as `takePerk` does for hit points.
- What a character carries is read as at most its present maximum, so taking off a circlet never leaves more mana than the maximum.

So a battle gives a caster one full mana bar to spend on the fight or to keep for afterwards, and no more: waiting on the world map restores nothing. A healer who wins a battle cheaply can patch the party up on the road; one who spent everything cannot.

The character panel gains a **Spells** tab (B), between Skills and Inventory, shown for every member:

- At the top: `Mana 7 / 22` (or `No mana: knows no spell`), and on the right the spell picks as the Skills tab shows perk picks: `Choose 2 spells` in gold when they can be spent here, `2 to choose` in battle, `Next spell at level 5`, or `Spells come with Spellcasting`.
- A row per spell known: name, cost (`3 mana, 4 AP`), range and area, and the description. On the world map a healing spell's row has a **Cast** button, enabled when the character has the mana.
- At the bottom, the **Spell Tree** button, outlined in gold when a spell pick waits and can be spent here.

Casting on the world map: Cast on Heal or Greater Heal asks for a member (`Heal: choose who (3 mana). Esc to go back.`), the party's portraits beside the panel becoming the targets; a click heals that member. Heal All and Greater Heal All heal the whole party at once, with no target to choose. Out of battle a heal restores the **average of its dice, rounded down** (Heal 6, Greater Heal 13, Heal All 4, Greater Heal All 11), so the world map needs no dice and a reload changes nothing. Range and area do not apply. The panel's hit point and mana figures follow at once, and the game is saved when the panel closes, as it is after every change made there.

In battle the Spells tab only shows; casting is done with the Cast button.

The Skills tab no longer lists spell perks among the perks taken; it lists Spellcasting like any perk.

### 4.6 The spell tree view (R2, R11)

The Spell Tree button (or `K` anywhere in the panel) swaps the panel's content for the spell tree, as the Perk Tree button does for the perk tree; Back, `K` again or Esc returns to the Spells tab. The view is the perk tree's: same node sizes, lines, states (taken, open, closed) and strip. Each node has a 4 px edge on its left in its school's colour (offensive red, healing green, support blue). The strip reads `Fireball (Offensive): 3d6 to everyone within 1 hex of a point within 6 hexes; 10 mana, 6 AP`, `Asks: Level 5, Magic 70%, Flame Arrow`, and on the right `Click to take`, `Taken`, `Not yet: …`, `No spell to choose until level N`, or in battle `Spells are chosen on the world map`. With the pointer on no node: `A caster learns a spell with every level. A line from a spell means it must be learned first.`

A click on an open node, on the world map with a spell pick or a perk pick waiting, takes it.

**Creation** (R11): the perks step gains a **Perks / Spells** switch over the tree. Its counter reads `Perks: 1 of 3` and, once Spellcasting is in the draft, `Spells: 2 of 2` beside it. A spell is taken from the draft's spell picks first, then from its perk picks. Removing Spellcasting from the draft drops its spells, and the screen names them, through `pruneDraft` as for any perk.

The ready-made mage is rebuilt as the draft `perks: ['spellcasting', 'arcane_study', 'keen_eye', 'magic_arrow', 'heal']`: three picks, then the two spell picks Spellcasting brought.

### 4.7 The AI (R12, R13)

`aggressive` gives each unit the first of these that applies, in roster order as now. "Touches" means a unit the cast would touch; "ally" includes the unit itself.

1. **Heal**, when some ally the unit can heal has at most half its hit points: the heal cast that restores the most, counting for each ally touched the lesser of the spell's average and what it has lost; ties to the cheaper, then the first listed.
2. **Guard itself**, when a standing foe is adjacent: Mirror Image if it is not Mirrored, else Shield if it is not Shielded.
3. **Area**: the hostile area cast that touches the most foes, at least two, and no ally; ties to the first listed.
4. **Bless**, when it would touch at least two allies not Blessed.
5. **Sleep** the foe in range with the most hit points that is not asleep, while at least two foes stand.
6. **Strike** with the damaging single-target spell of the highest average damage it can afford, on the foe with the fewest hit points.
7. Its weapon, then a closing move, as now.

Two rules hold throughout: a caster that knows a heal never spends mana on a step from 2 to 6 that would leave it less than its cheapest heal costs (the reserve), and Protect and Haste are never cast by the AI. `reach` judges how close to come by the first damaging spell the unit knows and can afford above its reserve, else its weapon.

**The Goblin Shaman** (`shaman`):

| Hit points | AC | To hit | Damage | Attack | AP | Mana | Magic | Spells | XP at level 1 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 10 | 10 | 50 | 1d4 (staff), 4 AP, reach 1 | | 8 | 14 | 60 | Magic Arrow, Heal, Bane | 90 |

`foeAtLevel` adds to `magic` as to the rest: +5 Magic and +3 mana a level. It takes the third place in Goblin Raid's slots, so it appears from threat 2 (where three foes take the field) and never at threat 1; Goblin Cutter moves to the fourth. With its reserve it keeps a Heal for its side and throws Magic Arrows and Bane from behind them.

### 4.8 Advancing and healing in the simulator (R14, R15)

`autoAdvance` spends spell picks after perk picks, taking the first open spell of `AUTO_SPELLS`: Heal, Magic Arrow, Flame Arrow, Heal All, Fireball, Greater Heal, Bless, Greater Heal All, Acid Arrow, Bane, Frost Blast, Sleep, Death Cloud, Shield, Mirror Image, Protect, Haste. It never takes Spellcasting for a character that does not have it.

`autoHeal(party)` (*new*, `src/game/party.ts`) is what the campaign does after `rewardVictory` and `autoAdvance`: each member that knows a healing spell, in party order, casts as section 4.5 allows while it has the mana and some member has lost at least the average of its cheapest heal: a group heal when two or more members have lost at least its average, else its strongest single heal it can afford on the member who has lost most.

The summary adds `avgPlayerHealing` and `avgEnemyHealing` (hit points restored in battle), statuses laid by each side, and, for a campaign, hit points restored between battles.

### 4.9 Retune (R16)

Healing returns and a third foe grows dangerous at threat 2, so the numbers in `CLAUDE.md` are stale. Target as before: the aggressive policy clears the map about 2 times in 3 (`--campaign --battles 500 --seed 1`). Levers in order: the shaman's place in the slots (threat 3 rather than 2, by moving it to a later slot with a fourth foe count), `FOES_AT_THREAT`, then heal amounts and mana costs. Single cells by `--encounter goblin_raid --threat T --party-level L`. Restate the paragraph's figures from the new runs.

## 5. Technical design

All *new* paths are proposed.

### 5.1 Spells and statuses: `src/combat/spells.ts`

```ts
export const SCHOOL_IDS = ['offence', 'healing', 'support'] as const
export type SchoolId = (typeof SCHOOL_IDS)[number]

export const SPELL_IDS = [
  'magic_arrow', 'flame_arrow', 'sleep', 'frost_blast', 'fireball', 'acid_arrow', 'death_cloud',
  'heal', 'greater_heal', 'heal_all', 'greater_heal_all',
  'shield', 'protect', 'bless', 'mirror_image', 'haste', 'bane',
] as const

/** What the player picks when casting: a unit (foe or ally), the caster itself, or a hex at the centre of an area. */
export type SpellTarget = 'foe' | 'ally' | 'self' | 'area'

export interface Spell {
  name: string
  school: SchoolId
  description: string
  manaCost: number
  apCost: number
  /** Hexes from the caster to the target or the area's centre; 0 for a spell centred on the caster. */
  range: number
  target: SpellTarget
  /** For an area: hexes from its centre it reaches. */
  radius?: number
  /** Rolls to hit each unit it touches, and in an area touches everyone; else never misses and touches only the caster's side. */
  hostile: boolean
  damage?: DamageRoll
  heal?: DamageRoll
  status?: { id: StatusId; turns: number; images?: number }
}

export const STATUS_IDS = ['asleep', 'chilled', 'corroded', 'poisoned', 'shielded', 'protected', 'blessed', 'baned', 'hasted', 'mirrored'] as const
export type StatusId = (typeof STATUS_IDS)[number]

export interface StatusRule {
  name: string
  /** One letter for the nameplate, and its colour. */
  mark: string
  colour: number
  armorClass?: number
  toHit?: number
  /** Added to the unit's AP at the start of its turns (and at once if laid on its own turn); never below 0. */
  actionPoints?: number
  /** Dealt at the start of its turns. */
  tick?: DamageRoll
  /** No AP, no zone of control, HELPLESS_BONUS to attacks on it, ended by damage. */
  sleep?: true
  /** Each hit on it strikes an image instead (images held on the unit's status). */
  images?: true
}

export const STATUSES: Record<StatusId, StatusRule>
export const HELPLESS_BONUS = 20

/** A status in force on a unit. */
export interface ActiveStatus { id: StatusId; turnsLeft: number; images?: number }

/** The average of a roll, rounded down: what a heal restores out of battle. */
export function averageRoll(roll: DamageRoll): number
```

`spells.ts` still imports nothing from `character/`. `HELPLESS_BONUS` sits with the statuses; `combat.ts` imports nothing new.

### 5.2 Perks, characters and progression

**`perks.ts`**

- `spellcasting`: `{ name: 'Spellcasting', description: 'Opens the spell tree: 2 spells now and 1 every level', ranks: 1, level: 1, skills: { magic: 40 }, branch: 'intelligence', effects: {} }`, in `magic_arrow`'s place. `deep_well.requires` becomes `'spellcasting'`.
- `Perk` gains `school?: SchoolId`. A perk with a `school` is a **spell perk**: it sits in the spell tree, not the perk tree, and is bought with a spell pick first. Its `branch` is `'intelligence'`.
- A helper `spellPerk(spell: SpellId, tier: 1 | 2 | 3, requires: string): Perk` builds each from `SPELLS` (name, description, school, `spell`) and section 4.2's tier table. The seventeen spell perks come after the attribute perks in `PERKS`, so `autoAdvance`'s fallback to "any perk" never reaches them, and are keyed by their spell's id.
- `isSpellPerk(perk): boolean`; `SPELL_PERK_IDS`; `knownSpells` unchanged.
- Spellcasting itself has no `school`; it is an ordinary perk in the perk tree.

**`character.ts`**

- `Character` gains `spellPicks: number` and `mana: number`. `createCharacter`/`draftCharacter` set `mana` to `maxMana` once its perks are taken.
- `manaOf(character): number` = `min(character.mana, maxMana(character))`, the one reader of `character.mana`.

**`progression.ts`**

- `SPELLCASTING_SPELL_PICKS = 2`; `hasSpellcasting(c)`.
- `levelUp`: `spellPicks += 1` when the character has Spellcasting; `mana = maxMana`.
- `takePerk(character, perk)`: a spell perk spends a spell pick if `spellPicks > 0`, else a perk pick; others a perk pick. Taking `spellcasting` adds `SPELLCASTING_SPELL_PICKS`. Any rise in `maxMana` is added to `mana`, as one in `maxHp` is to `hp`.
- `canAdvance` counts spell picks with a spell open. `nextSpellLevel(c)` = `c.level + 1`.
- `autoAdvance`: after perk picks, spell picks by `AUTO_SPELLS` (section 4.8); `spellcasting` is not added to `AUTO_PERKS`.

**`creation.ts`**: `takePerks` replays the draft through `takePerk` as now; Spellcasting's picks arrive when it is replayed, so a draft lists Spellcasting before its spells. `spellPicksLeft(draft)` (from `draftCharacter`'s `spellPicks`); `draftProblems` adds `Too many spells chosen` when a spell would have spent a fourth perk pick. `togglePerk` works unchanged on spell perks. Starting a character with Spellcasting and unspent spell picks leaves them on the character, like unspent perk picks.

**`worldCasting.ts`** (*new*, `src/character/`): Phaser-free casting out of battle.

```ts
/** The healing spells the character can cast now out of battle, with whether it has the mana. */
export function worldSpells(caster: Character): Array<{ spell: SpellId; affordable: boolean }>
/** Casts a healing spell out of battle: pays its mana and restores `averageRoll(heal)` to the target, or to every member for a spell centred on the caster. Returns false, changing nothing, if it cannot. */
export function castOnWorldMap(caster: Character, spell: SpellId, party: readonly Character[], target?: Character): boolean
```

**`party.ts`**: the mage preroll's draft as section 4.6; `autoHeal(party)` (section 4.8) built on `castOnWorldMap`.

### 5.3 Engine

**Actions**

```ts
| { type: 'cast'; unit: UnitId; spell: SpellId; target: UnitId }   // foe, ally, self
| { type: 'cast'; unit: UnitId; spell: SpellId; at: Hex }          // area
```

A self spell's target is the caster. A spell centred on the caster (range 0, an area) is cast `at` the caster's hex.

**State**: `UnitRecord` and `UnitSnapshot` gain `statuses: ActiveStatus[]` (empty at the start).

**Effective numbers.** One private function, `effective(unit)`, gives the stats every rule reads: `ac` plus the statuses' `armorClass` (never below 0), `toHit` and `magic.skill` plus their `toHit`. `attack`, `cast`, `previewAttack` and `previewCast` use it for both sides; events record the effective numbers.

**Legality** (`canCast(actor, spell, target)`, the same test for `legalActions`, `previewCast` and `step`): the actor knows the spell, has the AP and mana, and

- `foe`: a standing unit of the other side within range;
- `ally`: a standing unit of its own side within range, itself included;
- `self`: the target is itself;
- `area`: the centre is on the board within range (or is its own hex for range 0); a hostile area holds at least one standing foe.

`legalActions` lists, per spell in `SPELL_IDS` order, unit targets in roster order, then area centres in board order (row, then column, of offset coordinates), after the unit's attacks as now.

**Who a cast touches** (`touched(actor, spell, target)`, roster order): the target for a unit spell; for an area, every standing unit within `radius` of the centre, everyone if hostile, the caster's side only if not.

**Resolving a cast**, in order: pay AP and mana; clear `gearChangePaid`; face the target or centre (not for a centre on its own hex); then for each touched unit in roster order:

- hostile: one roll to hit with `resolveAttack(spellcaster(effective(actor), spell), effective(unit).ac, rng)`; on a hit, if the unit is Mirrored, one image goes and nothing else happens (no dice drawn); otherwise the damage dice (if any) as `resolveAttack` draws them, then the status (no roll);
- friendly: the heal dice (if any), restored up to the unit's maximum; then the status.

Then one `cast` event; then for each unit hurt and still standing that was asleep, a `status_end` (`woke`); then a `unit_down` for each touched unit that fell, in roster order, its statuses cleared; then `checkWinner` once. Since the player's side is checked first, a cast that fells the last of both sides is a defeat.

Laying a status: replace any of the same id with the longer duration (and fresh images); if the unit's side is the one whose turn it is, apply its AP change at once (Asleep sets AP to 0); Asleep clears `reactionReady`.

**Attacks**: an attack on a Mirrored unit that hits strikes an image (no damage dice drawn); on an asleep defender it adds `HELPLESS_BONUS`; damage wakes a sleeper (`status_end`). Free attacks follow the same rules. `reactorsAt` excludes the asleep.

**Turns**: `startTurn(side)` now returns events. After refilling AP it applies each standing unit's AP statuses (Asleep last, to 0), sets the other side's `reactionReady` to standing and not asleep, then deals tick damage to the side's units in roster order (`status_tick`, a wake, `unit_down`, `battle_end` as they fall). `step(end_turn)` first counts down the ending side's statuses (`status_end`, `expired`, for each that reaches 0), records `end_turn`, then returns `startTurn`'s events after it. The constructor's first `startTurn` has nothing to tick.

**Events** (`LOG_SCHEMA_VERSION` 16):

```ts
export interface CastOutcome {
  unit: UnitId
  /** For a hostile spell: the roll, as an attack records it. */
  attackRoll: number | null
  chance: number | null
  defenderAc: number | null
  hit: boolean
  critical: boolean
  fumble: boolean
  /** A hit that struck an image instead. */
  image: boolean
  damage: number
  healed: number
  hpBefore: number
  hpAfter: number
  status: ActiveStatus | null
}

export interface CastEvent extends EventBase {
  type: 'cast'
  caster: UnitId
  spell: SpellId
  /** The unit aimed at, or null for an area. */
  target: UnitId | null
  at: Hex
  distance: number
  apCost: number
  apAfter: number
  manaCost: number
  manaAfter: number
  casterFacing: number
  skill: number
  outcomes: CastOutcome[]
}

export interface StatusTickEvent extends EventBase { type: 'status_tick'; unit: UnitId; status: StatusId; damage: number; hpBefore: number; hpAfter: number }
export interface StatusEndEvent extends EventBase { type: 'status_end'; unit: UnitId; status: StatusId; reason: 'expired' | 'woke' | 'spent' }
```

`AttackEvent` gains `helpless: boolean` (the bonus is in `chance`) and `image: boolean`; a struck image's last image yields `status_end` `spent`. `CastPreview` becomes `{ apCost, manaCost, outcomes: Array<{ unit: UnitId; hitChance: number | null }> }`, and `previewCast(unit, spell, target: UnitId | Hex)`.

`formatEvent` renders section 4.4's lines.

### 5.4 Policies

Section 4.7, as small helpers over `legal` and `state` in `policies.ts`: `healCast`, `guardCast`, `areaCast`, `blessCast`, `sleepCast`, `strikeCast`, each returning an action or null, chained before `bestBonusAttack`. "What a cast touches" for the AI is computed from `SPELLS` and positions in a pure helper exported from `battleEngine.ts` (`castArea(units, caster, spell, target)`), the same one the engine uses, so the two cannot disagree. `random` is unchanged.

### 5.5 Encounters and monsters

- `UnitKind` gains `'shaman'`; `FOE_XP.shaman = 90`.
- `GOBLIN_SHAMAN_STATS` in `combat.ts` with `magic: { maxMana: 14, skill: 60, spells: ['magic_arrow', 'heal', 'bane'] }`.
- `foeAtLevel` adds `FOE_TO_HIT_PER_LEVEL` to `magic.skill` and `FOE_MANA_PER_LEVEL` (3) to `magic.maxMana` per level above the first.
- `GOBLIN_RAID`'s third slot becomes `{ id: 'shaman', kind: 'shaman', name: 'Goblin Shaman', at: [7, 2] }` (a back hex off `PARTY_START`); Goblin Cutter moves down.
- A `shaman` sprite in `art/` with `idle` and `walk`, by the workflow in [`art/CLAUDE.md`](../../art/CLAUDE.md); the sprites README updated.

### 5.6 Scenes

**`BattleScene`**

- `targeting` stays `'attack' | SpellId | null`; a new `spellMenu: boolean` for the open list. `onCast` opens the list; picking a row sets `targeting`.
- The list's rows and their state come from a new Phaser-free helper **`spellMenu.ts`** (*new*, `src/scenes/`): `spellMenuRows(engine state, unit, legal): Array<{ spell, label, enabled }>`.
- `boardIntent` gains area centres and self casts; `refreshHighlights` draws legal targets, and on hover of an area centre the area's hexes and `previewCast`'s per-unit chances. Which hexes an area covers comes from the engine's `castArea`.
- `showEvent` for `cast` (per outcome), `status_tick`, `status_end`; `eventSchedule.ts` gives `status_tick` the hurt flash's time.
- Nameplates: a status row (marks) beside the hit point bar, redrawn from the unit's `statuses` after every event.
- After a won battle, `endBattle` copies each member's `mana` back from the engine, beside `hp`.
- `BattleProbe` gains `spellMenu: Array<Point & { spell: SpellId; enabled: boolean }> | null` and, per unit, `statuses: StatusId[]`.

**`InventoryScene`**

- `PanelTab` gains `'spells'` and `'spellTree'`; `TABS` gains Spells (key `B`). `K` toggles the spell tree; Esc from it returns to Spells.
- `buildSpells` draws section 4.5's tab; world-map casting sets a `worldCast: SpellId | null` mode in which a portrait click calls `castOnWorldMap` (a group heal calls it at once) and redraws.
- The Skills tab's perk list skips spell perks.
- `InventoryProbe` gains `mana`, `spells: Array<Point & { spell: SpellId; castable: boolean }>`, `spellTreeButton`, and `tab` gains the two new views.

**`perkTree.ts`**: `perkTreeLayout(tree: 'perks' | 'spells')`. For `'perks'` as today, skipping spell perks. For `'spells'`: column 0 holds the spell perks whose parent is not a spell perk, in `SCHOOL_IDS` then `PERKS` order; children follow depth first as now. `nodeHint` speaks of spell picks for a spell perk (`No spell to choose until level N`, `Spells come with Spellcasting`, `Spells are chosen on the world map`). `nodeLabel` is unchanged for spells.

**`PerkTreeView.ts`**: `PerkTreeOptions` gains `tree: 'perks' | 'spells'`; nodes come from that layout (both computed once at module load), and `NODE_ROWS` is the larger of the two so the strip sits in one place. A spell node gets its school's colour edge.

**`CreationScene`**: the perks step's Perks / Spells switch and spell counter (section 4.6); `CreationProbe` gains the switch's centre and `spellPicksLeft`.

**`sounds.ts`**: `sfx_heal` (a placeholder tone, the audio README's table updated) for a heal or a friendly status; hostile outcomes cue as attacks do.

### 5.7 Saving

`Character.spellPicks`, `Character.mana` and `UnitRecord.statuses` change the saved shapes: `SAVE_VERSION` 3. Older saves read as unreadable, as the project's rules allow.

### 5.8 Documentation

`CLAUDE.md` in the same commits as the code: the rules of casting rewritten (targets, hostile and friendly, areas and friendly fire, statuses and their timing, the spell list in battle); the rules of perks (Spellcasting, spell picks, the spell tree and spell perks); mana carried on the character in place of "it is not stored on the character" and "never comes back"; the world map's healing; the Spells tab; the Goblin Shaman and `FOE_XP`; `worldCasting.ts` and `spellMenu.ts` among the modules; the simulator's new summary lines; the rules of scaling; and the "there is no healing skill or spell yet" and "a second spell needs a way to choose" sentences, which this makes false. The roadmap memory's "still ahead" list loses enemy casters, the second spell and healing.

## 6. Consequences

- **Healing changes the campaign more than anything else here.** Wounds were the campaign's hard limit; a healer with leftover mana now restores some of them after every win. The retune is mandatory and is judged by campaign runs; the simulator's `autoHeal` makes those runs fair to the healer.
- **Friendly fire** makes area spells a skill to use well; a careless Fireball can lose a battle, and the AI is held to never touching its own side so that it cannot.
- **The shaman** adds the first back-row foe, which is what the archer's role was waiting for (roadmap memory), and an enemy that undoes the party's damage. It may need moving to threat 3 in the retune.
- **Mana as carried state** reverses a stated rule of `magic.md`; it is still a battle's budget, refilled as each battle begins, so no campaign-long mana economy appears.
- **Spell picks every level** make the caster grow faster in options than anyone else, paid for by a creation pick on Spellcasting, by mana, and by the caster's frailty. If it proves too strong, the lever is picks every second level.
- **Log consumers** handle schema 16: `cast` events with `outcomes`, `status_tick`, `status_end`, damage and deaths with no `attack` before them, and turn starts that produce events.
- **Legal actions grow**: an area spell lists a centre for each hex in range whose area holds a foe (some 30 for a Fireball against five foes). The simulator's speed should be checked; the random policy draws more casts.
- **The perk tree** keeps its eleven rows; the spell tree uses nine of the same view's eleven. A spell that starts a new tip takes one of the two left.
- **Existing tests** of Magic Arrow as a perk of the Intelligence branch, of `CastEvent`'s flat shape, of the mage preroll's perks, and of the panel's three tabs are rewritten.

### Choices and their alternatives

- *A separate spell tree, not more perks in the perk tree.* The perk tree is full (every place taken), and spells are a pool of their own with their own currency. The alternative was scrolling the one tree.
- *Spell picks, chosen by the user over ordinary picks or skill points*, so a caster learns enough spells to choose among.
- *Hostile spells roll against armour class.* One rule for every hostile spell, the one Magic Arrow already uses; saving throws would be a second system.
- *Friendly fire in every hostile area*, chosen by the user; and friendly spells never touch foes, so a Heal All in a melee does not heal the enemy.
- *Statuses on units, not on hexes.* Death Cloud poisons whom it catches instead of lingering on the floor, which keeps the engine free of ground state.
- *Out-of-battle heals restore the dice's average*, so the world map stays free of an RNG and a reload cannot be used to reroll a heal.
- *Mana refills when a battle begins, not with time*, so waiting on the world map is not free healing (section 8.4).
- *Greater Heal All asks only for Heal All.* The tree's `requires` names one perk; the user's sketch suggests both heals before it, which a second requirement could add (8.6).

## 7. Verification

Domain tests (`npx vitest run --project domain`), with seeded or scripted RNGs:

- `spells`: every spell's target and radius agree (area ⇔ radius); hostile ⇔ `damage` or a debuff; `averageRoll`.
- `perks`: Spellcasting's place and requirements; every spell perk has a school, tier requirements per section 4.2, and a parent that is Spellcasting or a spell perk of its school; `knownSpells` (A1).
- `progression`: spell picks from Spellcasting and levels, spent first on spells, never on perks (A3); mana filled by a level and raised by a perk; `autoAdvance` spends spell picks by `AUTO_SPELLS`.
- `creation`: a draft with Spellcasting and two spells; prune on removing Spellcasting; every preroll still valid; the mage knows Magic Arrow and Heal (A13).
- `worldCasting`: Heal on a member, Heal All on the party, refusal without mana, at most the maximum, `manaOf` capping (A12).
- `party`: `autoHeal` spends leftover mana as section 4.8 says.
- `perkTree`: both layouts, no perk in both, spells in nine rows and three columns (A2); `nodeHint` for spell nodes.
- `battleEngine`: cast legality for each target kind (A4, A5); area touched sets with allies and caster; RNG order per outcome; mirrored hits draw no dice (A8); sleep: AP, ZoC, helpless bonus, waking, expiry (A6); ticks at turn start, felling and ending the battle at a turn's start (A7); durations counted in the affected unit's turns, refreshing, stacking of different statuses; AP statuses applied at once on one's own turn; mutual destruction is a defeat; `previewCast` agreeing with `step`; snapshot/restore with statuses and replay identity (A9); `formatEvent` lines.
- `policies`: each step of section 4.7 in isolation, the reserve, and never an area cast touching an ally (A14).
- `encounters`: shaman absent at threat 1, present at 2 (A15); `foeAtLevel` on `magic`.
- `spellMenu`: rows enabled and disabled.
- `simulate`: new summary fields from a hand-built log; a seeded campaign runs to an end with heals between battles (A16).

Scene smoke tests: `Battle`, `Inventory` and `Creation` still start.

In-browser tests (`npm run test:browser`, per [`e2e/CLAUDE.md`](../../e2e/CLAUDE.md)): Heal through the spell list (A10); an area spell's preview labels (A10); a Bless mark on the plates (A11); the Spells tab and Spell Tree view open, Back and Esc return (A13's panel half); creation's Perks / Spells switch with Spellcasting taken. Casting on the world map after a won battle (A12) needs a member wounded and a mage with mana left, which a seeded win provides.

Balance: the campaign and single-cell runs of section 4.9 (A16).

## 8. Open questions and assumptions

Answered by the user, 2026-10-15:

1. **Spells are bought with spell picks**: one each level for a caster, two with Spellcasting, and ordinary perk picks can buy spells too.
2. **Area spells hurt everyone in the area**, the caster's side included.
3. **One enemy caster kind** comes with this work: the Goblin Shaman.
4. **Healing spells can be cast on the world map.** The user did not say from what budget. Assumed: from the mana a caster carries out of its last battle, with battles refilling it and nothing else but a level, because waiting costs nothing on today's world map and mana that came back with time would make wounds free to heal. The alternative, mana regained per turn travelled, becomes sound once time has a cost (the encampment design's later threat system), and only `levelUp` and a world-turn hook would change. This is the assumption to confirm first.

Judgement calls, not blocking:

5. **The spell list, numbers and tree shape** of section 4.2 fill out the user's sketch: Flame Arrow leads to Fireball and Acid Arrow, Sleep to Death Cloud, Frost Blast is a tip; Shield, Protect and Bless each lead to one more (Mirror Image, Haste, Bane). All costs and dice are first values for the retune.
6. **Greater Heal All asks only for Heal All.** The sketch reads as if it needs Greater Heal too; that would need `requires` to take a list.
7. **Hostile spells, debuffs included, roll against armour class**; no saving throws.
8. **The AI never casts Protect or Haste**, which need judging which ally matters most; the player's casters use them.
9. **The shaman appears from threat 2.** The retune may move it to threat 3.
10. **Keys**: B for the Spells tab, K for the spell tree; M stays Cast.
11. **Out of battle a heal restores its average**, rounded down.
12. **Risk:** `legalActions` with area centres for several casters may slow the simulator; if it does, list only centres on or next to a foe, which covers every useful radius-1 cast.
