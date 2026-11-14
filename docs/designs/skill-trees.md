# Skill trees: Warrior, Scout, Mage and Cleric

## 1. Purpose and status

A hero grows today through one perk tree, branched by attribute, and a spell tree that only a hero with Spellcasting can reach. Fighters get one perk every third level and almost all of it is small passive numbers. Casters get a spell every level. Nobody but a caster has anything to do in battle except move and attack. The choices are thin, and the two halves of the roster do not grow alike.

This design replaces both trees with **four skill trees in the spirit of Skyrim**: **Warrior**, **Scout**, **Mage** and **Cleric**. Each tree has three **paths**:

| Tree | Paths |
| --- | --- |
| Warrior | Swordmaster (damage), Heavy Knight (defence, holding the line), Spellsword (melee with magic) |
| Scout | Ranger (bows), Rogue (evasion and mobility), Assassin (criticals, poison, the kill) |
| Mage | Evoker (fire and areas), Cryomancer (frost and control), Arcanist (wards, haste, images, shields) |
| Cleric | Healer (healing), Paladin (holy melee and auras), Saint (blessings, curses, renewal) |

Every hero may take from every tree and mix them: a few levels of Warrior, then Assassin, is a legal and supported build. A path has three kinds of node: **passives** (always on), **at-will actives** (action points only) and **mana actives** (action points and mana). Every hero has a mana pool. Picks are few and weighty: three at creation, then one at every even level, each node worth about two of today's perks. A capstone only the deepest path may open, and one capstone per hero ever, make each choice cost something.

It also gives heroes their first **techniques**: weapon actives such as Power Attack, Aimed Shot and Pin. They run on the engine's monster abilities, extended. Heavy Knight's **Taunt**, **Rooted** and **Pin** bring new battle rules, and so do the other passives and capstones (section 5.4).

**Status: ready for planning.** The user approved the design and settled the five product questions (section 8.1). Picks come every other level, with fewer, bigger nodes; everything else is as recommended. The numbers are first values for the retune (R14) to move. The feature is large, so section 7.3 proposes four stages, each playable and tested on its own.

Decisions already taken, which this design keeps (from [`docs/features/skill-trees.md`](../features/skill-trees.md)):

- No class lock: four trees, each with three paths, open to every hero and mixable.
- The twelve paths named above.
- A soft lock: the early tiers of every path are open, going deep in one closes the other capstones, and a hero gets one capstone ever.
- Mana for every hero (its pool from intelligence and from tree investment). Techniques such as Pin cost mana.

## 2. Requirements and scope

### Functional requirements

| ID | Requirement |
| --- | --- |
| R1 | Four **trees** (Warrior, Scout, Mage, Cleric), each with three **paths** of 7 or 8 single-rank **nodes**, replace the perk tree and the spell tree. Every node is a perk, as data. |
| R2 | A node is a **passive**, an **at-will active** (AP, maybe a recharge) or a **mana active** (AP and mana, maybe a recharge). Spells are mana actives. |
| R3 | Nodes sit in **tiers** that ask a level and a **depth** (nodes already taken in the same path). T1 to T3 of every path are open to every hero. The **capstone** asks level 12 and depth 5, needs its path to be the hero's **deepest**, and a hero may take only one capstone. |
| R4 | **Picks**: three at creation, then one at every even level (5 by level 5, 8 by level 10, 13 by level 20). One pick buys one node the hero qualifies for; every node has one rank. The separate spell picks and the Spellcasting perk go away. |
| R5 | **Every hero has mana**: from intelligence and level, plus 2 for each node in the Mage and Cleric trees, plus what nodes and gear add. |
| R6 | Today's perks and spells are **folded into the paths**, under the same ids wherever they survive. Section 4.3 says what happens to each one. |
| R7 | **Taunt**, **Rooted** and **Pin** work in the engine as section 5.4 states. |
| R8 | The other new mechanics (techniques, traits, auras, capstones, new spells and statuses) work in the engine as section 5.4 states, and battles stay deterministic from their seed. |
| R9 | The player uses a hero's actives in battle from one **Skills** list (the old Cast button), which holds spells and techniques with their costs and recharge. |
| R10 | The `aggressive` policy uses hero actives, Taunt and Pin included. `autoAdvance` follows a **plan** per build. The ready-made party, the pre-rolls and the bandits' drafts are rebuilt on the trees. |
| R11 | The character panel and character creation show the trees: one tab per tree, three path columns each. The Skills and Spells tabs become Skills (passives) and Abilities (actives). |
| R12 | `SAVE_VERSION` is raised. Saves of version 22 (and 18, through the existing migration) load, converted to the new economy. |
| R13 | `LOG_SCHEMA_VERSION` is raised for every new or changed event. The simulator reports what heroes use. |
| R14 | Balance is judged and retuned with the simulator, by the cells and campaign bands of section 7.2, and `CLAUDE.md`'s rules of scaling are restated from the runs. |
| R15 | The manual, `CLAUDE.md` and the e2e tests are brought up to date, and the manual's screenshots are retaken. |

### Quality constraints

- Every rule lives in the Phaser-free domain modules (`src/character/`, `src/combat/`, `src/engine/`), with tests. The scenes decide nothing.
- A node is data. A new node of an existing shape is one entry in `PERKS`. If it teaches something, it adds one entry in `SPELLS` or `ABILITIES` too. The tree view places it with no new code.
- A character stores what it was born with, what it learned (`perks`) and what it has left. Everything else is derived, its calling (deepest path) included.
- A battle replays from its seed. New rolls draw from the RNG in the order section 5.4 fixes. A passive that rolls nothing draws nothing.
- A unit whose stats carry none of the new fields behaves exactly as today. Monsters change only where a status or spell moves (web and curse becoming heroes' spells as well).

### Non-goals

- Respec. No way to take a pick back once the game has begun (Q4).
- Classes, class names or a class chosen at creation.
- Stealth, line of sight, terrain or forced movement (knockback, pulls). Nothing in the trees needs them.
- New sprites per ability. Techniques reuse the weapon's swing or shot, and status-only actives reuse a spell flash (section 5.7).
- Retuning the monsters' stat blocks by hand. The levers are in section 7.2.

### Acceptance criteria

| ID | Criterion |
| --- | --- |
| AC1 (R1, R3) | `PERKS` holds the 95 nodes of section 4, each of one rank. A hero that takes both T1s of a path at creation and every later pick there reaches its T3 at level 6 and its capstone at level 12. |
| AC2 (R3) | A level 14 hero with 5 nodes in Swordmaster and 6 in Assassin can take Deathblow and cannot take Blademaster. Once it has Deathblow, no other capstone is open, whatever its depths later. |
| AC3 (R4) | A level 1 draft spends exactly 3 picks. A character gains a pick on reaching each even level, and none on odd levels (`gainXp`). There is no `spellPicks` field. |
| AC4 (R5) | Aldric (intelligence 3, no Mage or Cleric nodes) has 6 mana at level 1 and 10 at level 5. The ready-made Delwyn (intelligence 9; Magic Arrow, Heal, Arcane Study) has 24 at level 1. *Amended in skill trees step 24 (build B): Delwyn takes Magic Arrow, Heal and Destruction and has 28 (Destruction's +4).* |
| AC5 (R7) | Engine tests show four things. Taunted foes take −25 to hit against anyone but the taunter, and the policy attacks the taunter. A Rooted unit gains +10 AC and +2 resistance until it moves. A pinned foe has no legal move on its next turn. Pin spends 3 mana and the weapon's AP + 1. |
| AC6 (R8) | Each mechanic of section 5.4 has an engine test, and the replay tests still pass. |
| AC7 (R9) | In the browser, a level 4 Aldric who took Rooted and Taunt opens Skills (M), sees Taunt with its AP, uses Taunt, and the foes' nameplates show **T**. |
| AC8 (R10) | `npm run simulate` runs with the new trees. The summary lists techniques used per side, and the ready-made heroes reach their capstones in `--ready-level 12` campaigns. |
| AC9 (R11) | The tree view shows four tree tabs and three path columns with no overlap at 840×560. A node's strip shows its kind, cost, effect, what it asks and why it is closed. |
| AC10 (R12) | `save-v18.json` and a captured v22 save load. A level 6 fighter from v22 keeps its perks, mapped to the new nodes (5.9), and receives `3 + ⌊6/2⌋ − nodes` picks, never fewer than 0. |
| AC11 (R14) | The campaign guard and the cells land in the bands of section 7.2, or the user has accepted the figure. |

## 3. Current system

Inspected in the code on branch `skill-trees` (off `d18abf4`).

- **Perks** ([`src/character/perks.ts`](../../src/character/perks.ts)). `PERKS` is a table of 45 perks. A perk has a `branch` (an attribute), an optional `requires` parent, `level`, `attributes` and `skills` asks, `ranks`, `effects` (`PerkEffects`: attributes, skills, `maxHp`, `armorClass`, `actionPoints`, `critChance`, `meleeDamage`, `rangedDamage`, `armorPierce`, `range`, `xpPercent`, `skillPoints`, `maxMana`), and for a spell perk a `spell` and `school`. `perkBonus` sums the effects. The six "Gain X" perks are the trunks. The spell perks are built by `spellPerk` with `SPELL_TIERS` (level 1, 3, 5; Magic 40, 55, 70).
- **Picks** ([`src/character/progression.ts`](../../src/character/progression.ts)). `levelUp` gives skill points (2 + intelligence / 3), a perk pick every third level (`PERK_LEVEL_STEP`), and a spell pick every level to a hero with Spellcasting, which itself brings 2 (`SPELLCASTING_SPELL_PICKS`). `takePerk` pays with a spell pick first for spells. `autoAdvance` raises the held weapon's skill, then takes `AUTO_PERKS` and `AUTO_SPELLS` in order.
- **Creation** ([`src/character/creation.ts`](../../src/character/creation.ts)): 3 perk picks (`CREATION_PERK_PICKS`), 10 skill points, `togglePerk`, `pruneDraft`.
- **Mana** ([`src/character/character.ts`](../../src/character/character.ts)). `maxMana` is 0 for a hero that knows no spell. Otherwise it is 2 × intelligence + (level − 1) × ⌊intelligence/2⌋ + gear + perks. `deriveCombatStats` emits `magic` only for a hero that knows a spell.
- **Spells and statuses** ([`src/combat/spells.ts`](../../src/combat/spells.ts)). There are 17 hero spells (`SPELL_IDS`) and 5 monster spells. There are 13 statuses, each a fixed rule (AC, resistance, to hit, AP, tick, sleep, images, stops regeneration).
- **Abilities** ([`src/combat/abilities.ts`](../../src/combat/abilities.ts)) are monster-only. An ability is a routine of fixed-dice strikes at a foe in attack range, or an area. It has an AP cost, a `recharge`, and no mana. `CombatantStats.abilities` lists them. The engine's `legalActions`, `canUse`, `routine` and `areaAttack` handle them, and `UnitRecord.recharging` counts down.
- **Engine** ([`src/engine/battleEngine.ts`](../../src/engine/battleEngine.ts)). `reactorsAt` decides free attacks. `effectiveStats` adds statuses. Statuses count down at the end of their side's turn and tick as it starts. A cast rolls to hit with the spell skill, an attack or ability strike with `toHit`. `LOG_SCHEMA_VERSION` is 24.
- **Policy** ([`src/engine/policies.ts`](../../src/engine/policies.ts)). `aggressive` runs a fixed priority: heal, guard, area, bless, sleep, curse, strike spell, best strike (routine or attack, by expected harm), status area, closing move.
- **Ready-made party and pre-rolls** ([`src/game/party.ts`](../../src/game/party.ts)): Aldric (Weapon Training, Toughness, Heavy Hand), Brenna (Marksmanship, Deadly Aim, Dodger), Delwyn (Spellcasting, Arcane Study, Keen Eye, Magic Arrow, Heal), Garrick (Weapon Training, Marksmanship ×2). The bandit drafts in [`src/game/bandits.ts`](../../src/game/bandits.ts) are built from the same perk ids, and `autoAdvance` grows them.
- **UI.** [`perkTree.ts`](../../src/scenes/perkTree.ts) and [`PerkTreeView.ts`](../../src/scenes/PerkTreeView.ts) lay out a 3-column by 11-row tree in the 720×500 character panel (tree from y = 100, 31 px rows, strip under it). `InventoryScene` has the Character, Skills, Spells and Inventory tabs, with P for the perk tree and K for the spell tree. `CreationScene`'s perks step switches between Perks and Spells. [`spellMenu.ts`](../../src/scenes/spellMenu.ts) lists a unit's spells for the battle's Cast button (M).
- **Saves.** `SAVE_VERSION` is 22, with `migrateFrom18` for stage-5 saves ([`src/game/save.ts`](../../src/game/save.ts)).
- **Balance figures** (`CLAUDE.md`, seed 1, 500 campaigns). One party (`--parties 1`) wins 230. The default company wins 239. At `--ready-level 10` both win 389. The guard fixture in `scripts/simulate.test.ts` hashes the first 5 campaigns' events.
- **Not run.** This machine runs Node 22 and the simulator needs Node 26. No fresh baseline was taken, so the figures above are `CLAUDE.md`'s. Stage 1 starts by re-measuring them in the container (`make simulate`).

## 4. Proposed behaviour

### 4.1 Tiers, depth, the calling and the capstone (R3)

Each node has a **tier**. The tier sets the level the node asks and the **depth** it asks: nodes already held in the node's own path. Every node has one rank, so depth counts nodes.

| Tier | Level | Depth in its path | Notes |
| --- | --- | --- | --- |
| T1 | 1 | 0 | Open at creation |
| T2 | 2 | 1 | Open from the first level-up |
| T3 | 6 | 3 | |
| Capstone ★ | 12 | 5 | Its path must be the hero's **calling**, and the hero must hold no capstone |

A node may also ask attributes (as today's perks do), skills, any one of several skills (`anySkill`, for example "Melee 40% or Archery 40%"), or a `requires` parent in the same path (Flame Arrow asks Magic Arrow).

**The calling** is the path in which the hero holds the most nodes. Ties count as all of the tied paths. It is derived, never stored, and shown on the character sheet ("Level 9 · Heavy Knight"). A capstone is open only in a calling path, so going deep in one path closes the other capstones, as the user decided. Taking a capstone closes every other capstone for good, even if another path later becomes deeper. A hero never holds two capstones.

T1 to T3 nodes of every path stay open to every hero.

**Reaching a capstone:**

- A committed hero (two T1s in its path at creation, then each even-level pick in the path) has depth 3 by level 4. Its T3s come at levels 6, 8 and 10, and the capstone at **level 12**, at depth 5 or 6.
- A hybrid that puts 5 of its first 8 picks into one path still takes that path's capstone at **level 12** (build C, section 4.4). One that splits more evenly takes it at **14 or 16**.
- A hero that never commits gets no capstone, and spends 13 picks by level 20 across the T1 to T3 nodes of two or three paths.

### 4.2 The economy (R4, R5)

| | Today | New |
| --- | --- | --- |
| Picks at creation | 3 perk picks (+2 spell picks with Spellcasting) | 3 picks |
| Picks per level | a perk pick every 3rd level; a spell pick every level for casters | **1 pick at every even level** (2, 4, 6, …) |
| Picks by level 5 / 10 / 20 | fighter 4 / 6 / 9; caster about 4+6 / 6+11 / 9+21 | **5 / 8 / 13**, alike for everyone |
| Node ranks | many perks of 2 ranks | every node 1 rank, sized as about two of today's |
| Skill points | 2 + ⌊INT/3⌋ a level, 10 at creation | unchanged |
| Mana | 0 unless a spell is known | everyone (below) |

`PICK_LEVEL_STEP = 2` (`levelUp` gives a pick when the new level is even). An odd level brings hit points and skill points as today; the even ones also bring a pick. The odd-level alternative (picks at 3, 5, 7, …) was rejected for two reasons. It leaves level 2 bare, after the first won battle. And it puts the capstone at 13, out of step with the threat bands.

**Mana for every hero:**

`maxMana = 2 × INT + (level − 1) × ⌊INT/2⌋ + MANA_PER_TREE_NODE (2) × nodes in the Mage and Cleric trees + nodes' maxMana + gear's maxMana`

| Hero | Level 1 | Level 5 | Level 10 |
| --- | --- | --- | --- |
| Aldric (INT 3, warrior, no Mage or Cleric nodes) | 6 | 10 | 15 |
| Aldric with Arcane Blood (+10) | 16 | 20 | 25 |
| Delwyn, ready-made (INT 9; Magic Arrow, Heal, Arcane Study) | 24 | | |
| Delwyn on build B (section 4.4; Destruction's +4 included) | 28 | 48 | 74 |

A battle still starts at `magic.maxMana`. Mana carried onto the world map, camping and levelling work as today. `CombatantStats.magic` is emitted for any hero that knows a spell or a mana technique (section 5.3).

**Skills still gate.** Melee Weapons, Archery and Magic stay. Techniques ask their weapon skill: T1 30%, T2 40%, T3 55%, capstone 70%. Spells ask Magic: T1 40%, T2 55%, T3 65 to 70%, capstone 75 to 80%. Paladin nodes ask Melee instead, which is how a warrior becomes a holy knight without studying Magic. Healing and support spells never miss, so Magic is only their gate. A hostile spell rolls with the spell skill, so a fighter who learns Magic Arrow without training Magic hits at 5 to 15%. That cost is visible and intended.

**Attributes.** Only Gain Strength survives as an attribute node, +2 Strength at T2 in Swordmaster. The other five "Gain X" perks fold into meatier nodes that raise their attribute by 1 alongside their own effect: Toughness (Endurance), Far Shot (Perception), Skirmisher (Agility), Fortune (Luck) and Lasting Magic (Intelligence). The attribute gates are lowered to match. No node asks more than 8, and the T3 gates sit at 7 or 8, so a hero born at 7 reaches them through its path.

**A level 1 character's creation.** Creation offers the T1 nodes of all twelve paths (24 nodes, two per path). Three picks among them make the hero's start: both T1s of one path and one elsewhere, or three paths' worth. Some typical starts:

- Soldier: Weapon Training, Heavy Hand, Toughness
- Knight: Toughness, Shield Wall, Weapon Training
- Archer: Marksmanship, Deadly Aim, Dodger
- Pyromancer: Magic Arrow, Destruction, Heal
- Battle-cleric: Bless, Smite, Toughness
- Duellist: Weapon Training, Backstab, Dodger

### 4.3 The trees in full (R1, R2, R6)

Column key:

- **Kind**: P passive, A at-will active, M mana active, S spell (a mana active cast with the spell skill).
- **Asks**: beyond the tier's level and depth. Every node has one rank.
- **wAP+n**: the hero's weapon attack cost plus n.
- **"Weapon blow"**: an attack with the hero's weapon (its dice, damage bonus, piercing and on-hit runes), rolled with its `toHit` and the attack's flanking and arc bonuses, as a plain attack is.
- **Bane**: extra damage only against a unit with regeneration or `blightborn`, as the Dawn rune's (`baneApplies`).

Statuses new to this design are in **bold** (section 5.2). An id marked † keeps today's perk or spell id. "(was …)" names the perks folded into a node.

#### Warrior: Swordmaster (8 nodes)

| Tier | Node (id) | Kind | Asks | Effect |
| --- | --- | --- | --- | --- |
| T1 | Weapon Training (`weapon_training`†) | P | STR 5 | +10% Melee |
| T1 | Heavy Hand (`heavy_hand`†) | P | STR 6 | +2 melee damage |
| T2 | Power Attack (`power_attack`) | A | Melee 40 | Weapon blow, wAP+2, −10 to hit, +6 damage (not doubled by a critical) |
| T2 | Armour Breaker (`armor_breaker`†) | P | STR 6 | Melee blows pierce +2 resistance |
| T2 | Gain Strength (`gain_strength`†) | P | | +2 Strength (never past 10) |
| T3 | Cleave (`cleave`) | A | Melee 55 | wAP+2, recharge 2. Two weapon blows at −5 each. The second goes to another foe in reach if there is one, else the same foe. |
| T3 | Weapon Mastery (`weapon_mastery`†; was Mighty Blow, Sunder) | P | STR 8 | +10% Melee, +2 melee damage, melee blows pierce +1 resistance |
| ★ | **Blademaster** (`blademaster`) | P | Melee 70 | Once a turn, a weapon blow or technique of its own that fells a foe gives back that action's AP |

#### Warrior: Heavy Knight (8 nodes)

| Tier | Node (id) | Kind | Asks | Effect |
| --- | --- | --- | --- | --- |
| T1 | Toughness (`toughness`†; was Gain Endurance) | P | END 5 | +8 hit points and +1 Endurance |
| T1 | Shield Wall (`shield_wall`) | P | | +8 AC while a shield is in the off hand |
| T2 | **Taunt** (`taunt`) | A | END 5 | 3 AP, recharge 2, needs no roll. Every foe within 2 hexes is **Taunted** for 1 turn. |
| T2 | **Rooted** (`rooted`) | P | END 6 | At the end of its side's turn, if it has not moved this turn, it is **Rooted** (+10 AC, +2 resistance) until it next moves or the end of its next turn |
| T3 | **Pin** (`pin`) | M | Melee 55 | 3 mana, wAP+1, recharge 1, melee weapon only. A weapon blow; a hit that leaves the foe standing **Pins** it for 1 turn. |
| T3 | Iron Skin (`iron_skin`; was Riposte) | P | END 7 | +2 resistance, and its free attacks get +15 to hit and +3 damage |
| T3 | Guardian (`guardian`) | P | END 7 | Aura: allies beside it (not itself) get +5 AC. Two Guardians do not stack. |
| ★ | **Unbreakable** (`unbreakable`) | P | END 8 | The first time each battle that damage would bring it to 0, it is left at 1 hit point and Shielded for 2 turns |

#### Warrior: Spellsword (7 nodes)

| Tier | Node (id) | Kind | Asks | Effect |
| --- | --- | --- | --- | --- |
| T1 | Arcane Blood (`arcane_blood`) | P | INT 4 | +10 mana |
| T1 | Flame Strike (`flame_strike`) | M | Melee 30 | 3 mana, wAP+1, melee. A weapon blow that adds +5 fire on a hit and lays Seared for 1 turn. |
| T2 | Frost Strike (`frost_strike`) | M | Melee 40 | 3 mana, wAP+1, melee. A weapon blow that adds +4 frost on a hit and lays Chilled for 1 turn. |
| T2 | Spell Ward (`spell_ward`) | P | | +3 ward against every element |
| T3 | Thunder Strike (`thunder_strike`) | M | Melee 55 | 4 mana, wAP+1, melee. A weapon blow at +10 to hit that adds +7 lightning on a hit. |
| T3 | Battle Mage (`battle_mage`; was Mana Leech, Elemental Fury) | P | INT 5 | +6 mana; each melee hit that strikes no image restores 1 mana; its Strikes' elemental damage +2 |
| ★ | **Arcane Knight** (`arcane_knight`) | P | Melee 70 | Every melee hit adds +4 fire, as a rune does, and its Strikes cost wAP+0 |

#### Scout: Ranger (8 nodes)

| Tier | Node (id) | Kind | Asks | Effect |
| --- | --- | --- | --- | --- |
| T1 | Marksmanship (`marksmanship`†) | P | PER 5 | +10% Archery |
| T1 | Deadly Aim (`deadly_aim`†) | P | PER 6 | +2 ranged damage |
| T2 | Aimed Shot (`aimed_shot`) | A | Archery 40 | Ranged weapon only. A weapon shot, wAP+2, +20 to hit, +3 damage. |
| T2 | Far Shot (`far_shot`†; was Gain Perception) | P | PER 6 | Ranged weapons reach 2 hexes further; +1 Perception |
| T2 | **Hunter's Mark** (`hunters_mark`) | A | Archery 40 | 2 AP, recharge 3, needs no roll. A foe within the weapon's range is **Marked** for 2 turns (−10 AC). |
| T3 | Volley (`volley`) | A | Archery 55 | Ranged weapon only, wAP+2, recharge 2. Aimed at a hex within the weapon's range, it hits everyone within 1 hex of it (allies too) with the weapon's dice and bonus. Each unit is rolled with `toHit` and the damage goes through resistance as a shot's does. |
| T3 | Pinning Shot (`pinning_shot`) | M | Archery 55 | 3 mana, wAP+1, recharge 1, ranged weapon only. A weapon shot; a hit that leaves the foe standing **Pins** it for 1 turn. |
| ★ | **Deadeye** (`deadeye`; was Eagle Eye) | P | Archery 70 | +10% Archery; its shots pierce 3 points of resistance; a critical shot rolls triple dice instead of double |

#### Scout: Rogue (8 nodes)

| Tier | Node (id) | Kind | Asks | Effect |
| --- | --- | --- | --- | --- |
| T1 | Dodger (`dodger`†) | P | AGI 6 | +10 AC |
| T1 | Sprint (`sprint`) | A | AGI 5 | 0 AP, recharge 3. Hasted (+3 AP) for this turn. |
| T2 | Skirmisher (`skirmisher`; was Gain Agility) | P | AGI 6 | +1 Agility; after it has moved this turn, its attacks get +10 to hit |
| T2 | Dirty Trick (`dirty_trick`) | A | Melee 40 | wAP+1, recharge 2, melee. A weapon blow; a hit lays Baned (−15 to hit) for 2 turns. |
| T3 | Tumble (`tumble`) | P | AGI 7 | Its moves provoke no free attacks |
| T3 | Evasion (`evasion`†; was Tireless) | P | AGI 8 | +10 AC and +1 AP every turn |
| T3 | Counter (`counter`) | P | Melee 55 | Once per enemy turn, when a foe's melee blow misses it, it strikes back with a free attack if it holds a melee weapon and the foe is in reach |
| ★ | **Shadowdancer** (`shadowdancer`) | P | AGI 8 | As its side's turn begins, it gains a mirror image (Mirrored, 1 image, for 2 turns) unless it already has one or more |

#### Scout: Assassin (8 nodes)

| Tier | Node (id) | Kind | Asks | Effect |
| --- | --- | --- | --- | --- |
| T1 | Keen Eye (`keen_eye`†) | P | LCK 6 | +10% critical chance |
| T1 | Backstab (`backstab`) | P | Melee 30 or Archery 30 | +15 to hit and +4 damage on a weapon attack from a foe's rear arc |
| T2 | Venom Strike (`venom_strike`) | M | Melee 40 or Archery 40 | 2 mana, wAP+1. A weapon blow or shot; a hit lays Poisoned for 3 turns. |
| T2 | Hamstring (`hamstring`) | A | Melee 40 or Archery 40 | wAP+1, recharge 2. A weapon blow or shot; a hit lays **Slowed** (−3 AP) for 1 turn. |
| T3 | Fortune (`fortune`†; was Gain Luck, Lethality) | P | LCK 7 | +10% critical chance and +1 Luck; its critical hits deal +4 damage, after the dice are doubled |
| T3 | Ambush (`ambush`) | P | AGI 6 | Its first weapon attack of a battle (not a free one) gets +25 to hit, and a hit is critical |
| T3 | Executioner (`executioner`) | P | Melee 55 or Archery 55 | +5 damage against a foe at half its hit points or less |
| ★ | **Deathblow** (`deathblow`) | P | Melee 70 or Archery 70 | A weapon hit that leaves a foe at a quarter of its maximum hit points or less fells it, except a `blightborn` foe |

#### Mage: Evoker (8 nodes)

| Tier | Node (id) | Kind | Asks | Effect |
| --- | --- | --- | --- | --- |
| T1 | Magic Arrow (`magic_arrow`†) | S | Magic 40 | As today: 1d10, range 5, 3 mana, 4 AP |
| T1 | Destruction (`destruction`; was Deep Well) | P | INT 5 | +2 damage to each instance of its damaging spells; +4 mana |
| T2 | Flame Arrow (`flame_arrow`†) | S | Magic 55, Magic Arrow | As today |
| T2 | Pyromancy (`pyromancy`) | P | INT 6 | +3 damage to its fire spells |
| T3 | Fireball (`fireball`†) | S | Magic 65, Flame Arrow | As today |
| T3 | Acid Arrow (`acid_arrow`†) | S | Magic 65, Flame Arrow | As today |
| T3 | Death Cloud (`death_cloud`†) | S | Magic 70 | As today |
| ★ | **Meteor** (`meteor`) | S | Magic 80 | 4d8 fire to everyone within 2 hexes of a point within 6, with Seared for 1 turn; 16 mana, 7 AP |

#### Mage: Cryomancer (8 nodes)

| Tier | Node (id) | Kind | Asks | Effect |
| --- | --- | --- | --- | --- |
| T1 | Frostbite (`frostbite`) | S | Magic 40 | 1d6+1 frost to a foe within 5, with Chilled (−3 AP) for 1 turn; 3 mana, 4 AP |
| T1 | Numbing Cold (`numbing_cold`) | P | INT 5 | +3 damage to its frost spells |
| T2 | Sleep (`sleep`†) | S | Magic 55 | As today |
| T2 | Frost Blast (`frost_blast`†) | S | Magic 55, Frostbite | As today |
| T3 | Web (`web`, moved from the monsters' list) | S | Magic 65 | As the monsters' Web: −4 AP for 2 turns within 1 hex of a point within 4; 5 mana, 4 AP |
| T3 | Ice Lance (`ice_lance`) | S | Magic 70 | 2d8 frost to a foe within 6, and 2d8 more if it is Chilled, Slowed, Webbed, Asleep or Frozen; 7 mana, 4 AP |
| T3 | Lingering Cold (`lingering_cold`; was Arcane Mastery) | P | INT 7 | Statuses its hostile spells lay last 1 turn longer; +10% Magic |
| ★ | **Glacial Prison** (`glacial_prison`) | S | Magic 80 | A foe within 5 is **Frozen** for 2 turns; 12 mana, 5 AP |

#### Mage: Arcanist (8 nodes)

| Tier | Node (id) | Kind | Asks | Effect |
| --- | --- | --- | --- | --- |
| T1 | Shield (`shield`†) | S | Magic 40 | As today: +15 AC to itself for 3 turns |
| T1 | Arcane Study (`arcane_study`†) | P | INT 5 | +10% Magic |
| T2 | Mirror Image (`mirror_image`†) | S | Magic 55 | As today (it no longer asks Shield) |
| T2 | Ward (`ward`) | S | Magic 55 | An ally within 4 is **Warded** (+4 ward against every element) for 3 turns; 4 mana, 3 AP |
| T3 | Haste (`haste`†) | S | Magic 65 | As today |
| T3 | Lasting Magic (`lasting_magic`; was Gain Intelligence) | P | INT 7 | Statuses its friendly spells lay last 1 turn longer; +1 Intelligence |
| T3 | Quickened Casting (`quickened_casting`; was Mana Font) | P | Magic 70 | Its spells cost 1 AP less (never below 2); +8 mana |
| ★ | **Mass Haste** (`mass_haste`) | S | Magic 80 | Every ally within 2 hexes of the caster, itself included, is Hasted for 2 turns; 12 mana, 5 AP |

#### Cleric: Healer (8 nodes)

| Tier | Node (id) | Kind | Asks | Effect |
| --- | --- | --- | --- | --- |
| T1 | Heal (`heal`†) | S | Magic 40 | As today |
| T1 | Mending (`mending`) | P | Magic 30 | Its heals restore +4 (in battle and on the world map) |
| T2 | Greater Heal (`greater_heal`†) | S | Magic 55, Heal | As today |
| T2 | Heal All (`heal_all`†) | S | Magic 55, Heal | As today |
| T3 | Greater Heal All (`greater_heal_all`†) | S | Magic 65, Heal All | As today |
| T3 | Purify (`purify`) | S | Magic 55 | Ends every hostile status on an ally within 4 and heals it 1d6; 4 mana, 3 AP |
| T3 | Swift Hands (`swift_hands`; was Font of Life) | P | Magic 60 | Its healing spells cost 1 AP less (never below 2); +8 mana |
| ★ | **Revive** (`revive`) | S | Magic 75 | An ally within 2 that fell this battle, on a free hex, stands again at a quarter of its maximum hit points (at least 1); 20 mana, 6 AP, once per battle |

#### Cleric: Paladin (8 nodes)

| Tier | Node (id) | Kind | Asks | Effect |
| --- | --- | --- | --- | --- |
| T1 | Bless (`bless`†) | S | Melee 30 or Magic 40 | As today |
| T1 | Smite (`smite`) | M | Melee 30 | 3 mana, wAP+1, melee. A weapon blow that adds +4 damage on a hit, and 6 more as bane. |
| T2 | Lay on Hands (`lay_on_hands`) | S | Melee 40 or Magic 40 | Heals an ally within 1 (itself included) 2d6+2; 4 mana, 3 AP |
| T2 | Blessed Armour (`blessed_armour`; was Devotion) | P | END 5 | +1 resistance, +3 ward against blight, +6 mana |
| T3 | Aura of Courage (`aura_of_courage`) | P | Melee 55 | Aura: allies within 2 hexes (not itself) get +5 to hit |
| T3 | Consecrate (`consecrate`) | M | Melee 55 | 5 mana, 5 AP, recharge 2. Every **foe** within 1 hex of it takes 2d6, rolled with its `toHit` against AC: half on a miss, double the dice as bane, resistance ignored as an area's is. |
| T3 | Sacred Weapon (`sacred_weapon`; was Divine Favour) | P | Melee 60 | +10% Melee; every melee hit adds +2, and 4 more as bane |
| ★ | **Aegis** (`aegis`) | P | Melee 70 | Aura: allies within 2 hexes, itself included, get +2 resistance and +2 ward against every element |

#### Cleric: Saint (8 nodes)

| Tier | Node (id) | Kind | Asks | Effect |
| --- | --- | --- | --- | --- |
| T1 | Serenity (`serenity`; was Beacon) | P | INT 5 | Regains 2 mana as its side's turn begins (never above the maximum); its friendly spells aimed at an ally or a point reach 2 hexes further |
| T1 | Bane (`bane`†) | S | Magic 40 | As today |
| T2 | Protect (`protect`†) | S | Magic 55 | As today |
| T2 | Scholar (`scholar`†) | P | INT 6 | +2 skill points every level |
| T3 | Curse (`curse`, moved from the monsters' list) | S | Magic 65 | As the monsters' Curse: −15 to hit and −5 AC for 3 turns |
| T3 | Renew (`renew`) | S | Magic 65 | Every ally within 2 hexes of the caster is **Renewing** (regains 3 hit points as its turn begins) for 3 turns; 10 mana, 5 AP |
| T3 | Holy Light (`holy_light`) | S | Magic 70 | 3d6 to a foe within 5, double the dice as bane; 7 mana, 4 AP |
| ★ | **Sanctuary** (`sanctuary`) | P | Magic 80 | Aura: as its side's turn begins, every ally within 2 hexes, itself included, regains 3 hit points |

**Totals.** 95 nodes: 11 paths of 8 and Spellsword of 7. That is 48 passives (8 of them capstones), 17 techniques (9 at-will, 8 mana) and 30 spells (17 kept, 2 moved from the monsters' list, 11 new; 4 of them capstones). Every path has 2 T1s, 2 or 3 T2s, 2 or 3 T3s and a capstone. A committed hero empties its path by about level 14 and spends the rest elsewhere.

**What happens to today's perks and spells:**

| Today | Becomes |
| --- | --- |
| All 17 spells | Nodes under the same ids: offence in Evoker and Cryomancer, healing in Healer, Shield, Mirror Image and Haste in Arcanist, Protect and Bane in Saint, Bless in Paladin |
| Toughness, Dodger, Heavy Hand, Deadly Aim, Keen Eye, Weapon Training, Armour Breaker, Marksmanship, Arcane Study (2 ranks today) | One rank each, worth both of today's ranks (+10% where it was +5%, +2 where it was +1, Toughness +8 HP with +1 Endurance) |
| Far Shot, Weapon Mastery, Evasion, Fortune, Scholar | Kept under their ids, enlarged by the perks folded into them (the tables above) |
| Gain Strength | Kept, +2 Strength in one node (T2 Swordmaster) |
| Mighty Blow, Sunder → Weapon Mastery; Gain Endurance → Toughness; Gain Perception → Far Shot; Eagle Eye → Deadeye; Gain Agility → Skirmisher; Tireless → Evasion; Gain Luck → Fortune; Deep Well → Destruction; Arcane Mastery → Lingering Cold; Gain Intelligence → Lasting Magic | **Folded**: their effect lives on in the node named, and the old id is mapped to it on migration (5.9) |
| Spellcasting | **Retired.** Every hero may learn spells; the Magic asks are the gate. |
| Quick Study (+10% experience) | **Retired.** Every member earns the whole reward, so it only spreads a party's levels apart, and the simulator never takes it. |
| Monster spells Web and Curse | Become hero spells too (same ids, same numbers; the spider and goblin stat blocks still name them) |
| `SPELL_TIERS`, `SPELLCASTING_SPELL_PICKS`, `spellPicks`, `isSpellPerk`, schools on perks, perk ranks above 1 | Removed. A spell's `school` stays in `SPELLS` for its colour. |

### 4.4 Example builds (R4)

Each pick below is the level it was taken at. All four builds follow the rules above. Their asks were checked against tier, depth and attributes. A hero holds 5 picks at level 5, 8 at level 10 and 13 at level 20.

**A. "The Bulwark": Aldric, pure Heavy Knight** (STR 9, PER 3, END 7, INT 3, AGI 6, LCK 4; tagged Melee)

| Level | Picks so far |
| --- | --- |
| 1 | Weapon Training, Heavy Hand, Toughness (END 8 with it) |
| 5 (5 picks) | + Rooted (L2), Taunt (L4) |
| 10 (8) | + Pin (L6; depth 3), Iron Skin (L8), Guardian (L10) |
| 20 (13) | + **Unbreakable** (L12; depth 6), Shield Wall (L14), Power Attack (L16), Armour Breaker (L18), Weapon Mastery (L20; Swordmaster depth 4) |

Choice points:

- At level 2, Rooted holds the line and Power Attack ends fights. There is room for only one before level 4.
- Pin's 3 mana is half of a 6-mana pool, so every Pin is a choice.
- At level 8, Iron Skin over a second Swordmaster node keeps Heavy Knight the calling.

**B. "Flame and Mercy": Delwyn, Evoker with Healer** (INT 9; tagged Magic)

| Level | Picks so far |
| --- | --- |
| 1 | Magic Arrow, Heal, Destruction |
| 5 (5) | + Flame Arrow (L2), Heal All (L4) |
| 10 (8) | + Fireball (L6; Evoker depth 3), Pyromancy (L8), Mending (L10) |
| 20 (13) | + **Meteor** (L12; Evoker depth 5), Greater Heal (L14), Death Cloud (L16), Greater Heal All (L18; Healer depth 4), Purify (L20) |

Choice points: every caster pick is a spell or a passive, never both. At level 4, a second heal and at level 8 more fire damage each cost a spell. At level 12 the fork is Meteor or Revive. Revive needs Healer deeper than Evoker, which here means giving up Pyromancy and Fireball's follow-ups. Today a level 10 mage holds about 17 perks and spells; here it holds 8, though each counts for about two of today's (section 6).

**C. "Blade to Shadow": a Warrior who turns Assassin** (the user's example; STR 7, PER 2, END 5, INT 3, AGI 8, LCK 7; tagged Melee)

| Level | Picks so far |
| --- | --- |
| 1 | Weapon Training, Heavy Hand, Backstab |
| 5 (5) | + Power Attack (L2), Keen Eye (L4) |
| 10 (8) | + Venom Strike (L6), Fortune (L8; Assassin depth 3), Ambush (L10) |
| 20 (13) | + **Deathblow** (L12; Assassin depth 5 against Swordmaster 3), Executioner (L14), Armour Breaker (L16), Cleave (L18), Hamstring (L20) |

Choice points: Swordmaster gave the early power. The turn to Assassin at level 4 still reaches Deathblow at 12, but with nothing to spare. One more Swordmaster pick at level 6 or 8 would push it to 14. Once Assassin is deeper, Blademaster is closed for good, though Cleave (T3) stays open.

**D. "Battle Cleric": Paladin with Heavy Knight** (STR 7, PER 3, END 6, INT 6, AGI 5, LCK 5; tagged Melee)

| Level | Picks so far |
| --- | --- |
| 1 | Bless, Smite, Toughness (Heal is out of reach: Magic 12%) |
| 5 (5) | + Lay on Hands (L2), Blessed Armour (L4) |
| 10 (8) | + Aura of Courage (L6; Paladin depth 4), Sacred Weapon (L8), Rooted (L10) |
| 20 (13) | + **Aegis** (L12; Paladin depth 6), Consecrate (L14), Taunt (L16), Weapon Training (L18), Pin (L20; Heavy Knight depth 3) |

Choice points: with no ranged heal, Lay on Hands (range 1) makes the cleric stand by whoever is hurt. Mana is shared between Smite, Consecrate and the heal. Rooted at level 10 is a defensive pick taken instead of Consecrate's damage.

### 4.5 Taunt, Rooted and Pin in play (R7)

- **Taunt.** The Heavy Knight steps between the foes and the archer and spends 3 AP. Each foe within 2 hexes is Taunted (letter **T**) through its next turn. Its attacks, techniques and hostile spells on anyone but the knight take −25 to hit. The AI turns on the knight. Taunt is ready again two rounds later.
- **Rooted.** A knight that ends its turn where it stood gains Rooted (**R**): +10 AC and +2 resistance through the enemy's turn. Stepping off the hex ends it at once. Free attacks it suffers while walking do not keep it.
- **Pin.** A melee blow that also costs 3 mana. On a hit the foe is Pinned (**N**) through its next turn: it cannot move, though it can still attack, cast or use abilities from where it stands. Pinning Shot does the same at range.

### 4.6 Choosing and using skills (R9, R11)

**At creation**, the perks step shows the tree view with four tree tabs. Only T1 nodes can be clicked (level 1). A click takes a rank and clicking again gives it back, as today. The rule line reads: "3 picks. One more comes with every even level. Any path, any tree; only your deepest path may open its capstone."

**On the world map**, the character panel's Skills tab lists skills and the passives taken. Its **Skill Trees** button (P) opens the tree view. The Abilities tab (B, renamed from Spells) lists the actives known, each with its kind, cost and recharge, and the mana carried. Heals keep their Cast button there.

**In battle**, the **Skills** button (M, formerly Cast) shows for any unit with an active. It lists spells, then techniques, each greyed when the engine lists no legal use now:

```
Taunt          3 AP   (ready in 1)
Pin            3 mana  6 AP
Power Attack   7 AP
Magic Arrow    3 mana  4 AP
```

Then the hero aims. A strike or a foe status asks for a foe. An area asks for a hex, with its outline and odds. A self status (Sprint) asks for a click on the caster, as Shield does today. Taunt is an area centred on the user and is aimed at the user's hex.

### 4.7 Edge cases

- A hero without a melee weapon sees melee techniques greyed, and the hint says "Needs a melee weapon". A ranged technique wants a ranged weapon.
- Taunt's source falls: Taunted ends on every foe it taunted (reason `source_fell`).
- Taunt on a foe already Taunted by another unit: the newer taunter replaces the old (`source` overwritten, the longer duration kept).
- A Pinned foe with a free attack still makes it. Pinned stops moves, not reactions.
- Unbreakable and a status tick: it applies to ticks as well. Unbreakable and Deathblow: Deathblow fells the unit outright and is not "damage", so Unbreakable does not save it. That edge matters only if a hero ever faces a hero.
- Revive on a hex now taken by another unit: the cast is illegal. A unit revived this battle may fall and be revived again only by another caster, since the spell is once per battle per caster.
- Capstones and later depth: a hero with Deathblow that later puts more nodes into Ranger than Assassin keeps Deathblow, and Deadeye stays closed.
- An odd level brings no pick. The level-up line on the victory screen and the panel say "Next pick at level N".
- Gear that lowers a skill below a node's ask after it was taken changes nothing. Asks gate taking, not keeping, as today.

## 5. Technical design

### 5.1 Data: trees, paths and perks (`src/character/`)

**Proposed `src/character/trees.ts`** holds the trees, the paths and the tiers:

```ts
export const TREE_IDS = ['warrior', 'scout', 'mage', 'cleric'] as const
export const PATH_IDS = ['swordmaster', 'heavy_knight', 'spellsword', 'ranger', 'rogue', 'assassin',
  'evoker', 'cryomancer', 'arcanist', 'healer', 'paladin', 'saint'] as const
export const PATHS: Record<PathId, { name: string; tree: TreeId; colour: number }>
export const TIERS = { 1: { level: 1, depth: 0 }, 2: { level: 2, depth: 1 }, 3: { level: 6, depth: 3 },
  capstone: { level: 12, depth: 5 } } as const
export const MANA_PER_TREE_NODE = 2 // nodes in the Mage and Cleric trees
export function pathDepth(character, path): number   // nodes held in the path
export function calling(character): PathId[]   // the deepest path(s); [] with no nodes
export function capstoneOf(character): PerkId | null
```

**`Perk` in `perks.ts` changes.** The fields `branch`, `school` and `level` go; level comes from the tier. New fields:

```ts
path: PathId
tier: 1 | 2 | 3 | 'capstone'
anySkill?: Partial<Record<SkillId, number>>   // one of these suffices
ability?: AbilityId                              // the technique a rank teaches
trait?: TraitId                                  // the engine rule it switches on
```

`effects` keeps every existing key and gains these, each summed by `perkBonus`:

- `resistance`, `wardAll`, `shieldAc`
- `spellDamage`, `fireSpellDamage`, `frostSpellDamage`, `healBonus`
- `hostileExtend`, `friendlyExtend`, `friendlyRange`, `spellApDiscount`, `healApDiscount`
- `imbueDamage`, `manaOnHit`, `manaRegen`
- `opportunityToHit`, `opportunityDamage`
- `rearToHit`, `rearDamage`, `movedToHit`
- `executeDamage`, `critDamage`

`xpPercent` goes with Quick Study. `Perk.ranks` goes: every node has one rank, and `perks` stays a `Partial<Record<PerkId, number>>` holding 1, so the save shape of a character's perks is unchanged in kind.

- `PERKS` is reordered by tree, path, then tier. The layout follows that order (5.6).
- `missingRequirements` adds: the tier's level (replacing `level`); "N nodes in <Path>" for depth; `anySkill` worded "Melee 40% or Archery 40%"; for a capstone, "<Path> must be your deepest path" and "Only one capstone" (`capstoneOf` non-null). `describePerkRequirements` words them the same way.
- **Node kind** is derived, never stored: `nodeKind(perk)` returns `'spell'` if it has a `spell`, `'mana'` if its ability has a `manaCost`, `'at-will'` if it has an `ability`, else `'passive'`.
- `knownSpells` is unchanged. A new `knownAbilities(character)` lists the abilities its perks teach, in `ABILITY_IDS` order. `traitsOf(character)` lists its traits.
- `isSpellPerk`, `SPELL_PERK_IDS`, `spellPerkOf` (it becomes `perkTeaching(spell)`) and `TRUNK_PERKS` are removed. Callers move to `nodeKind` and `PATHS`.

**`progression.ts`.**

- `levelUp` gives `perkPicks += 1` when the new level is even (`PICK_LEVEL_STEP = 2`, replacing `PERK_LEVEL_STEP = 3`). `picksAt(level) = 3 + ⌊level / 2⌋` is the total a hero has had by a level, which the migration and tests use. `SPELLCASTING_SPELL_PICKS`, `hasSpellcasting` and `nextSpellLevel` are removed. `nextPerkLevel` gives the next even level. `XpGain.spellsGained` is removed.
- `takePerk` spends a perk pick and nothing else.
- `autoAdvance(character, plan = planFor(character))`. A plan is an ordered list of perk ids (`AUTO_PLANS`). It takes the first node of the list it qualifies for, repeatedly, then falls back to any qualifying non-capstone node in `PERKS` order, so no pick is ever left unspent. `planFor` picks by the tagged skill: melee `knight`, archery `ranger`, magic `evoker_healer`. Bandits pass their role's plan explicitly (5.8). Skill-point spending is unchanged.

**`creation.ts`.** `CREATION_PERK_PICKS` stays 3. `picksLeft` loses the spell branch, and `spellPicksLeft` and `draftCasts` go. `togglePerk` and `pruneDraft` are unchanged in kind.

**`character.ts`.**

- `Character.spellPicks` is removed.
- `maxMana` drops the "knows a spell" gate and adds `MANA_PER_TREE_NODE` × nodes in the Mage and Cleric trees.
- `deriveCombatStats` adds:
  - `resistance += perkBonus('resistance')`
  - `ac += perkBonus('shieldAc')` while the off hand holds a shield
  - `wards[e] += perkBonus('wardAll')` for every element, plus Blessed Armour's blight ward (a `wards` effect keyed by element: `wardBlight`)
  - `abilities: knownAbilities(character)` when there are any
  - `traits` when there are any
  - `magic`, emitted when the hero knows a spell or an ability with a `manaCost`, gaining `power`, `healBonus`, `extend`, `friendlyRange` and `apDiscount` from the effects above
  - the trait numbers the engine reads: `opportunity`, `rear`, `movedToHit`, `execute`, `critDamage`, `manaOnHit`, `manaRegen`, `imbueDamage`, each emitted only when non-zero
- `hpPerLevel` and `maxHp` are unchanged. Toughness's `maxHp` stays a perk effect.

### 5.2 Spells and statuses (`src/combat/spells.ts`)

- `SPELL_IDS` gains `frostbite`, `ice_lance`, `glacial_prison`, `ward`, `mass_haste`, `meteor`, `purify`, `revive`, `lay_on_hands`, `renew` and `holy_light`. It also takes `web` and `curse`, which leave `MONSTER_SPELL_IDS` and keep their ids, so stat blocks still name them. `SchoolId` stays for colours, and new spells get a school (offence, healing or support).
- `Spell` gains these optional fields:
  - `bane: true`: doubles the damage dice against `baneApplies` (Holy Light)
  - `bonusVs: { statuses: StatusId[]; damage: DamageRoll }` (Ice Lance)
  - `cleanse: true`: ends every status whose rule is `hostile` (Purify)
  - `oncePerBattle: true` (Revive)
  - `target: 'fallen'`, a new `SpellTarget`: an ally at 0 hit points that fell this battle, within range, whose hex no standing unit holds (Revive)
- `StatusRule` gains these optional fields:
  - `hostile: true`, set on every hostile status: asleep, chilled, corroded, poisoned, baned, seared, cursed, webbed and the new taunted, pinned, marked, slowed, frozen
  - `immobile: true`: no move is legal
  - `wardAll: number`
  - `regen: number`: heals as its side's turn begins, unless a status with `stopsRegeneration` is on it
  - `helpless: true`, which today's `sleep: true` is split into, alongside `wakesOnDamage: true`. Asleep is helpless and wakes on damage. Frozen is helpless and does not wake.
- `ActiveStatus` gains `source?: UnitId` (Taunted).

New statuses:

| Id | Name | Mark | Rule |
| --- | --- | --- | --- |
| `taunted` | Taunted | T | hostile. −25 to hit (`TAUNT_PENALTY`) on any hostile roll at a unit other than its `source` |
| `pinned` | Pinned | N | hostile, immobile |
| `rooted` | Rooted | R | +10 AC, +2 resistance |
| `marked` | Marked | Y | hostile, −10 AC |
| `slowed` | Slowed | L | hostile, −3 AP |
| `frozen` | Frozen | I | hostile, helpless, does not wake on damage |
| `warded` | Warded | G | +4 ward against every element |
| `renewing` | Renewing | U | regen 3 |

### 5.3 Abilities for heroes (`src/combat/abilities.ts`)

`Ability` gains these optional fields (monsters' abilities set none, so they behave as today):

```ts
manaCost?: number                       // paid as a spell's is; canUse checks mana
weaponAp?: number                       // AP = attackApCost + weaponAp (apCost then ignored)
needs?: 'melee' | 'ranged'              // isMelee(stats) must match
selfStatus?: StatusLaid                 // Sprint: target is the user
foeStatus?: { status: StatusLaid; range: number | 'weapon' }   // Hunter's Mark: no roll
```

`Strike` gains:

```ts
weapon?: true          // use the unit's weapon dice, damage bonus, pierce and onHit
toHit?: number         // added to the roll's chance
damageBonus?: number   // added after dice, not doubled by a critical
onHit?: readonly OnHit[]  // added to the weapon's for this strike; imbueDamage adds to entries with an element
spreads?: true         // Cleave's second strike goes to a different foe in reach when one stands
```

`AreaAttack` gains:

```ts
weaponDamage?: true    // the unit's weapon dice and damage bonus (Volley)
weaponRange?: true     // range is the unit's attackRange (Volley)
throughResistance?: true // each hit's damage goes through resistance as a shot's (Volley)
foesOnly?: true        // touches only foes (Taunt, Consecrate)
auto?: true            // no roll: lays the status on every foe touched (Taunt)
bane?: true            // doubles the dice against baneApplies (Consecrate)
centredOnSelf?: true   // aimed only at the user's hex (Taunt, Consecrate); range 0
```

The hero abilities are `power_attack`, `cleave`, `taunt`, `pin`, `flame_strike`, `frost_strike`, `thunder_strike`, `aimed_shot`, `hunters_mark`, `volley`, `pinning_shot`, `sprint`, `dirty_trick`, `venom_strike`, `hamstring`, `smite` and `consecrate`. They are added to `ABILITY_IDS` after the monsters' four, with numbers as in section 4.3.

`abilityApCost(stats, ability)` and `spellApCost(stats, spell)` (the latter applying `magic.apDiscount`, never below 2) are exported helpers. The engine, the policy and the menus all use them.

### 5.4 Engine rules (`src/engine/battleEngine.ts`)

`UnitRecord` (and `UnitSnapshot`) gain these fields, all with defaults a restored older snapshot fills in:

- `moved: boolean`: false as its side's turn begins, true once it takes a step
- `attackedYet: boolean`: Ambush
- `endured: boolean`: Unbreakable has been spent
- `refunded: boolean`: Blademaster this turn; false as its side's turn begins
- `fallenThisBattle: boolean`: set by `fell`, read by Revive
- `usedOnce: SpellId[]`: once-per-battle spells

**RNG order.** Every new roll draws as an existing one does. A technique strike is `attack()` with modifiers: one roll to hit, then the dice on a hit. Volley and Consecrate resolve as `areaAttack` in roster order. Cleave's strikes go in order, each choosing its target before rolling. Every passive below draws nothing.

| Mechanic | Rule |
| --- | --- |
| **Hero ability use** | `canUse` adds: `needs` matches `isMelee`; `mana ≥ manaCost`; AP ≥ `abilityApCost`. `legalActions` lists `selfStatus` abilities with the user's own id as target, `foeStatus` abilities at each standing foe within range, and `centredOnSelf` areas at the user's hex only. A mana ability's cost is taken as the action begins, and the recharge is set as today. |
| **Technique strike** (`weapon: true`) | Resolved through `attack()` with the strike's `toHit`, `damageBonus`, extra `onHit` (fire, frost or lightning flat damage, warded; a bane entry only where it applies) and `status`. Flanking, arc, Backstab, Skirmisher, Executioner and Fortune's critical damage apply as to a plain attack. The defender turns to face a melee technique as for any blow. `AttackEvent` carries `ability` and `strike` as routines do. |
| **Taunt** | An `auto` `foesOnly` area: lays `taunted` with `source = user` on every foe touched; logged as one `AbilityEvent` whose outcomes are status-only. Every hostile roll (weapon attack, strike, hostile spell or area, per target) by a unit with `taunted` against a unit other than its `source` subtracts `TAUNT_PENALTY` (25), recorded as `tauntPenalty` on the `AttackEvent` and `CastOutcome`. When the source falls, `taunted` ends on every unit it taunted (`status_end` reason `source_fell`). |
| **Rooted** | On `end_turn` for side S, *before* `countDownStatuses`, every standing unit of S with trait `rooted` and `moved === false` gets `rooted` laid for 2 turns (so 1 is left after the count-down, through the enemy's turn), logged by a new `StatusLaidEvent { unit, status, cause: 'rooted' }`. The first step of any move ends `rooted` (`status_end` reason `moved`), before free attacks on that step are rolled. |
| **Pin** | A technique strike laying `pinned` (1 turn) on a hit that leaves the foe standing. `reachable` returns no hexes for a unit with an `immobile` status, so it has no legal move. Its free attacks, attacks and casts are untouched. |
| **Iron Skin (free attacks)** | Free attacks (`opportunity`) by a unit with `opportunity` add its to-hit and damage bonus. |
| **Counter** | After any melee attack by a unit of the side in turn that *misses* a defender (not of that side) with trait `counter`, with `reactionReady`, a melee weapon, and the attacker within its `attackRange`: the defender spends `reactionReady` and makes a free attack (`AttackEvent.counter: true`, `opportunity: true`). No counter comes off a counter, because only the side not in turn counters. |
| **Tumble** | `reactorsAt` returns none for a mover with trait `tumble`. |
| **Skirmisher** | A weapon attack or technique strike by a unit with `moved` adds `movedToHit`. |
| **Backstab** | A weapon attack whose `arc` is `rear` adds `rear.toHit`, and `rear.damage` to a hit. |
| **Ambush** | The first attack or technique strike a unit with trait `ambush` makes in its own turn (not a free attack) adds +25 to hit, and a hit is critical (`AttackEvent.ambush: true`). It sets `attackedYet`. |
| **Executioner / Fortune** | +`execute` damage when the defender's hp ≤ ⌊maxHp / 2⌋ before the blow; +`critDamage` on a critical, after the doubling. |
| **Deathblow** | After a weapon hit's damage, if the defender stands, is not `blightborn`, and hp ≤ ⌊maxHp / 4⌋: hp → 0 (`AttackEvent.deathblow: true`), then `fell`. |
| **Blademaster** | When a unit with trait `blademaster` fells a foe with its own attack action or technique (not a free attack) and `refunded` is false: it regains that action's AP and sets `refunded` (`AttackEvent.apRefunded`). |
| **Deadeye** | A ranged weapon attack by a unit with trait `deadeye` adds 3 to its pierce (beyond `rangedPierce`), and a critical rolls triple dice (`critMultiplier` 3 in the damage roll). |
| **Unbreakable** | Every damage application (attack, strike, cast outcome, area, status tick) goes through a new `applyDamage(unit, n)`. If the unit has trait `unbreakable`, `endured` is false, hp > 0 and hp − n ≤ 0, then hp → 1, `endured` → true, and `shielded` is laid for 2 turns. The event carries `endured: true`. |
| **Auras** (Guardian, Aura of Courage, Aegis) | A pure `auraBonus(units, unit)`: for each aura kind, the best one from any standing ally whose distance is within its radius (Guardian 1 and Courage 2, others only; Aegis 2, self included). Added to `effectiveStats` wherever a roll or damage is resolved, through a new `statsIn(units, unit)`, which previews and the policy also use. |
| **Sanctuary / Renewing / Serenity** | As side S's turn begins, after ticks and regeneration: units with `renewing` heal `regen`; every unit of S within 2 hexes of a standing Sanctuary unit of S heals 3 (one Sanctuary at most per unit); units with `manaRegen` regain mana. Each is logged by a new `RestoreEvent { unit, hp?, mana?, cause }`. |
| **Shadowdancer** | As its side's turn begins, a unit with trait `shadowdancer` whose `mirrored` images are below 1 gets `mirrored` laid for 2 turns with 1 image (`StatusLaidEvent`, cause `shadowdancer`). |
| **Battle Mage (mana on hit)** | A melee hit that strikes no image restores `manaOnHit`, recorded as `AttackEvent.manaRestored`. |
| **Spell modifiers** | `magic.power` adds to each damaging outcome of a spell by element (`any`, fire, frost) before wards. `healBonus` adds to heals. `extend` adds turns to statuses its hostile or friendly spells lay. `friendlyRange` adds to the range of a friendly spell aimed at an ally or a point. `apDiscount` lowers AP. All are read by `previewCast` as well. |
| **Revive** | `canCast` for target `fallen`: an ally with `fallenThisBattle`, hp 0, within range, its hex free, and the spell not in `usedOnce`. On cast: hp = max(1, ⌊maxHp / 4⌋), statuses cleared, ap 0, `reactionReady` false, `fallenThisBattle` kept. Logged as a `CastEvent` outcome with `revived: true`. `checkWinner` is unchanged: a battle ends the moment a side is down, so Revive can only bring back an ally while another still stands. |
| **Frozen** | Helpless as Asleep: no AP, no zone of control, `HELPLESS_BONUS` against it. Damage does not wake it. |
| **Purify** | Ends each `hostile` status on the target (`status_end` reason `cleansed`), then heals. |
| **Ice Lance / Holy Light** | `bonusVs` adds its dice when the target has one of the statuses before the roll. `bane` doubles the dice count against `baneApplies`. |

`LOG_SCHEMA_VERSION` rises once per stage that changes events: 25 in stage 2 (ability events for heroes, `StatusLaidEvent`, the taunt and pin fields) and 26 in stage 3 (`RestoreEvent`, the trait fields, `revived`, `endured`). `formatEvent` gains short lines:

- "Aldric taunts 2 foes."
- "Aldric holds his ground (rooted)."
- "Goblin is pinned."
- "Brenna strikes back."
- "Mira endures the blow."
- "Sera's sanctuary restores 3 to Aldric."

### 5.5 The AI (`src/engine/policies.ts`)

`aggressive` keeps its order and gains steps (new ones in **bold**). Everything works over `legalActions`, `castTouches` and `areaTouches` as today. Monsters, which have none of the new actives, choose as before, except where a moved spell (web, curse) changes their list order (section 6).

1. **reviveCast**: Revive on a fallen ally whenever legal.
2. healCast (Lay on Hands is a heal; `healBonus` is counted in what a heal restores).
3. **purifyCast**: Purify on an ally that is Asleep, Frozen, Poisoned, Corroded or Pinned.
4. guardCast.
5. **tauntUse**: Taunt when the user is at half its hit points or more and either two or more untaunted foes stand within its radius, or one does that is within its attack range of an ally (not the user) whose hit-point share is below the user's.
6. **supportCast**: Mass Haste in its side's first two rounds when it would touch two or more allies not Hasted. Renew when two or more allies in its radius are at 75% or less and none is Renewing.
7. areaCast (Meteor counts as a hostile area spell).
8. blessCast, then **prisonCast** (Glacial Prison on the healthiest foe not Frozen or Asleep while two stand), sleepCast, curseCast.
9. **markUse**: Hunter's Mark on the unmarked foe in range with the most hit points, when the user has the AP to mark and then attack.
10. strikeCast (Frostbite, Ice Lance with its bonus when the target qualifies, Holy Light with bane counted).
11. bestStrike, extended. A **technique** (an ability with `weaponAp`) scores `(expected harm + status value − 0.5 × manaCost) × attackApCost / its AP cost`, so it is weighed against a plain attack on equal AP. Expected harm counts its strikes' to-hit, damage and on-hit. Status values (`STATUS_VALUE`) are seared (the target's regeneration), chilled or slowed 3, pinned 3, poisoned 7, baned 4, each × the chance to hit and only if the target lacks it. Volley and Consecrate are scored by `areaHarm`, with weapon dice, resistance and bane, less 0.5 × mana. A mana technique is never chosen if it would dip below the heal reserve. Monster routines and areas score exactly as today.
12. statusArea.
13. **sprintUse**: Sprint when no foe is within reach and the closing move cannot end with AP to strike, but could with +3 AP.
14. closingMove.

**Taunted units:** for a unit with `taunted` whose source stands, every step above that has a hostile candidate on the source keeps only those candidates. closingMove closes on the source rather than the nearest foe.

### 5.6 Scenes and helpers (`src/scenes/`)

**Tree layout (`perkTree.ts`, reworked).** `TreeKind` becomes `TreeId`. `treeLayout(tree)` gives each path a column, in `PATHS` order within the tree. Row 0 is the path's heading. Nodes take rows 1 to 8 in `PERKS` order, which is by tier, so the capstone is last. Tier bands are drawn as faint rules between rows, labelled "L1", "L2", "L6" and "L12" in the left gutter, and two rows of the eleven are left free for the bigger nodes' two-line labels. `TreeNode` keeps `{ perk, column, row, from }`, where `from` is the node's `requires` parent if it has one. `nodeState` adds `'locked'` for a capstone closed by the calling rule or by another capstone. `nodeHint` gains the lock words ("Closed: your deepest path is Assassin", "Closed: you hold Deathblow"). `draftNodeHint` is unchanged in kind.

**`PerkTreeView.ts`** is drawn inside the 720×500 panel, at the same y as today:

```
y 75   [Warrior][Scout][Mage][Cleric]        5 picks          [Back]
y 100  Swordmaster  6        Heavy Knight  2       Spellsword  0      <- headings; calling in gold
y 131  |Weapon Training  |  |Toughness       |   |Arcane Blood    |
 ...   (rows of 31 px; 8 node rows)
y 441  strip: "Pin (Heavy Knight, mana): 3 mana, weapon AP+1 ... "
       "Asks: Level 6, Melee 55%, 3 nodes in Heavy Knight"      "Click to take"
```

- Three columns, each 226 px wide with nodes 214 px wide (`TREE_X` 20).
- A node's left edge stripe shows its kind: passive dim gold `0x8a7a5a`, at-will amber `0xd09a3c`, mana and spell blue `0x5a8ee0`.
- A capstone has a double gold frame and a ★ before its name.
- A `requires` line is drawn down the column's left gutter.
- The tree tabs are `PanelButton`-styled; keys 1 to 4 switch trees while the view is open.
- `PerkTreeView.nodeCentres(tree)` keeps its shape for the probes.

The strip has three lines:

1. Title, path and kind, then the effect. For an active the effect includes its cost and AP: wAP is shown as the number for the current weapon, for example "6 AP (weapon + 1)".
2. "Asks: …".
3. The hint.

**`InventoryScene`.**

- The tabs become Character, Skills, Abilities and Inventory (C, S, B, I).
- The Skills tab lists skills and the passives taken, with a **Skill Trees** button (P). The tree view's Esc goes back to Skills. K is dropped.
- The Abilities tab lists known actives with kind, AP (as `abilityApCost` or `spellApCost` gives them now), mana and recharge. It shows the mana carried and the spell skill, and keeps the world-map heal Cast button (`worldCasting.ts` is unchanged; Mending's `healBonus` is added in `worldHealing`).
- The class line under the name becomes `heroTitle`: "Level 9 · Heavy Knight", or "Level 9 · Heavy Knight / Paladin" when the second-deepest path holds 3 nodes or more.
- `PanelTab` loses `'spellTree'`, and `'perkTree'` is renamed `'trees'`.

**`CreationScene`.** The perks step draws the tree view with its four tabs in place of the Perks/Spells switch (`TREE_SWITCH` goes). Its probe lists `trees` buttons.

**Battle.** `spellMenu.ts` becomes the skills menu. It is renamed `skillMenu.ts`, and its rows are `{ kind: 'spell' | 'ability', id, label, enabled, readyIn? }`, built from `unit.magic.spells` and `unit.abilities` and enabled when `legal` holds a matching action. `targetingHint` covers abilities: "Pin: choose a foe (3 mana, 6 AP)…", "Taunt: click Aldric (3 AP)…", "Volley: choose where (6 AP)…". `BattleScene`'s Cast button is labelled Skills, keeps M, and shows when `magic` or `abilities` is non-empty. Its probe keeps `castButton` and the rows gain `kind`.

**`battleEffects.ts`.**

- A technique strike plays its weapon's `attackLook`.
- `ABILITY_LOOKS` gains entries for Volley (arrows to each hex), Consecrate (a gold burst on the user), Taunt (a red ring on the user) and Hunter's Mark, Sprint and the strikes' on-hit flash, which reuse the existing fire, frost and lightning looks.
- `changesStatusMarks` covers `status_laid` and `restore`.
- A `restore` event floats "+3" in green, as a heal does.

**`foeInfo.ts`** already describes abilities from their data. It learns the new fields (mana, wAP, `needs`), which bandits now carry. `debugCommands.ts` drops `spellPicks` from the party listing.

### 5.7 Assets

There are no new sprites. The eight new statuses need only marks and colours (5.2). The manual gets a table per tree in place of section 11's perk table.

### 5.8 Party, bandits and simulator

The **pre-rolls** (`party.ts`) are rebuilt on the trees:

| Hero | Creation picks | Plan |
| --- | --- | --- |
| Aldric | Weapon Training, Heavy Hand, Toughness | `knight` (build A) |
| Brenna | Marksmanship, Deadly Aim, Dodger | `ranger`: Aimed Shot (L2), Far Shot (L4), Volley (L6), Hunter's Mark (L8), Pinning Shot (L10), Deadeye (L12), then Rogue T1–T3 |
| Delwyn | Magic Arrow, Heal, Arcane Study (amended in step 24 to build B: Magic Arrow, Heal, Destruction) | `evoker_healer` (build B) |
| Garrick | Weapon Training, Marksmanship, Dodger (Marksmanship has one rank now) | `knight` (his tag is Melee) |

**The bandits' drafts** (`bandits.ts`):

| Role | Creation picks | Plan |
| --- | --- | --- |
| Archer | Marksmanship, Deadly Aim, Dodger | `ranger` |
| Cutthroat | Weapon Training, Dodger, Toughness | `rogue`: Backstab (L2), Dirty Trick (L4), Tumble (L6)… |
| Brute | Weapon Training, Heavy Hand, Toughness (Armour Breaker is T2 now) | `swordmaster`: Power Attack (L2), Armour Breaker (L4), Cleave (L6)… |
| Hedge-Mage | Magic Arrow, Shield, Arcane Study | `bandit_mage`: Flame Arrow (L2), Destruction (L4), Fireball (L6), Heal (L8), Heal All (L10) |
| Captain | Weapon Training, Toughness, Dodger | `knight`: Taunt (L2), Rooted (L4), Pin (L6) |
| Crossbowman | as the Archer | `ranger` |

The Hedge-Mage changes from today. With a pick every other level it learns Flame Arrow at 2 and Fireball at 6 (threat 6, where it first takes the field in tier-2 gear), and Heal only at 8. On today's map (threats up to 5) it never heals, where today it heals from level 2. That makes the threat 4 and 5 camps a little easier, and the bandit cells will show by how much. `CLAUDE.md`'s bandit lines change with it. The test that a hero built the same way has the same stats as a bandit still holds.

**Simulator** (`scripts/simulate.ts`):

- `autoAdvance` gets the plan.
- The summary gains per side: techniques used (by id), taunts, pins, counters, deathblows, revives, Unbreakable saves, and mana spent on techniques.
- Per campaign it reports the callings and capstones reached (the share of campaigns whose vanguard holds a capstone at the end).
- New flag `--plans role=plan,...` (for example `--plans melee=swordmaster,archery=ranger,magic=cryomancer`) overrides `planFor` for the player's side, for the path-parity cells of section 7.2. `CLAUDE.md`'s simulator-flags paragraph gains it.

### 5.9 Saves (`src/game/save.ts`)

`SAVE_VERSION` rises from 22 to 23 in stage 1, because `Character` loses `spellPicks` and perk ids change. Stages 2 and 3 raise it again (24, 25) for `UnitRecord`'s new fields.

**Migration (`migrateFrom22`, chained after `migrateFrom18`)** for every character in parties and reserves:

1. Drop retired perk ids (`spellcasting`, `quick_study`) and any unknown id.
2. Map each folded id to the node it went into (`FOLDED`: `mighty_blow` and `sunder` → `weapon_mastery`; `gain_endurance` → `toughness`; `gain_perception` → `far_shot`; `eagle_eye` → `deadeye`; `gain_agility` → `skirmisher`; `tireless` → `evasion`; `gain_luck` → `fortune`; `deep_well` → `destruction`; `arcane_mastery` → `lingering_cold`; `gain_intelligence` → `lasting_magic`).
3. Collapse every kept or mapped node to rank 1, so a second rank and duplicates from folding become one node. Keep them even where the new asks would refuse them (grandfathered). One case is a capstone, Deadeye from Eagle Eye: it is kept, and it counts as the hero's one capstone.
4. Recompute picks from level: `perkPicks = max(0, picksAt(level) − nodes held)`, where `picksAt(level) = 3 + ⌊level / 2⌋`. Delete `spellPicks`.
5. Clamp `mana` to the new `maxMana`.

A migrated hero thus has exactly the picks a new hero of its level would have, less what its nodes already account for. A caster of today, holding far more perks and spells than 3 + ⌊level/2⌋, keeps them all and receives no picks until its level catches up.

A saved battle of version 22 to 24 restores with the new `UnitRecord` fields at their defaults (false, `[]`). Its units' stats are as saved, so a battle in progress finishes under the stats it began with.

This is a migration the design asks for, as the project's rule requires. It is small and keeps stage 5's v18 fixture loading. A new fixture, `src/game/fixtures/save-v22.json`, is captured from a level 6 company before the change. The alternative, breaking v18 and v22 saves, is cheaper by about a day. It is rejected because the v18 path was an explicit earlier decision.

### 5.10 Files affected (proposed)

| Area | Files |
| --- | --- |
| Domain | `src/character/trees.ts` (new), `perks.ts`, `progression.ts`, `creation.ts`, `character.ts`, `worldCasting.ts`; `src/combat/spells.ts`, `abilities.ts`, `combat.ts` (`CombatantStats` traits and numbers, damage roll crit multiplier); `src/engine/battleEngine.ts`, `policies.ts` |
| Game | `src/game/party.ts`, `bandits.ts`, `save.ts`, `fixtures/save-v22.json` (new) |
| Scenes | `perkTree.ts`, `PerkTreeView.ts`, `InventoryScene.ts`, `CreationScene.ts`, `spellMenu.ts` → `skillMenu.ts`, `BattleScene.ts`, `battleEffects.ts`, `foeInfo.ts`, `draftInfo.ts`, `debugCommands.ts`, `src/testHook.ts` |
| Simulator | `scripts/simulate.ts`, `scripts/simulate.test.ts` (fixture re-recorded) |
| Docs and tests | `docs/manual/README.md` and its images, `CLAUDE.md`, `e2e/character.test.ts`, `e2e/battle.test.ts`, `e2e/party.test.ts`, `e2e/manual.shots.ts` |

## 6. Consequences

- **Balance moves, and on purpose.** At level 10 a fighter goes from 6 perks to 8 picks, each about twice a perk's size and some of them actives. A caster goes from about 17 perks and spells to 8 picks, with mana worth 2 a Mage or Cleric node to soften it. Casters are the likelier to fall behind at first. Every hero has mana, and bandits gain Taunt, Pin, Cleave and Backstab. The campaign guard will move. Stage 1 is expected to move it (casters lose picks, fighters gain them) before any active exists. Section 7.2 sets the bands and levers, and the user accepts the final figure as before (Q5).
- **Monster behaviour.** Web and Curse join `SPELL_IDS`, which moves them earlier in `ALL_SPELL_IDS`. A stat block's `magic.spells` order, and so the policy's iteration order over them, can change for the spider and goblin casters. The refactor guard is re-recorded in stage 1 in any case. Monsters otherwise use no new field.
- **Fog-free rules.** Taunt and auras read positions only, never sight, as the engine already does.
- **The foe yardstick** (`fighterGrowth` in `combat.ts`) is a measured table of the old fighter. It stays frozen as a yardstick. If the yardstick test fails only because the ready-made fighter now grows differently, the table is re-measured in stage 4, not the monsters.
- **Performance.** `legalActions` lists `foeStatus` and `centredOnSelf` actions cheaply. Volley lists hexes within weapon range as areas do today. Auras add a scan of allies per roll (six units at most). The 500-campaign run should stay near five minutes; stage 4 records it.
- **Permadeath is softened** by Revive and Unbreakable. Both are capstones at level 12, once a battle (Q3).
- **Rollback.** Each stage is its own merge. Stage 1 is the only one that changes the save shape for characters. A rollback after it would need a reverse migration, which is not offered: saves move forward only, as ever.

## 7. Verification

### 7.1 Tests

- **Domain** (`npm test`, project `domain`):
  - `trees.test.ts`: every path has 7 or 8 single-rank nodes, two T1s, one capstone, and depth reachable as AC1 says; calling ties; one capstone; capstone lock.
  - `perks.test.ts`: asks, `anySkill` and kind derivation.
  - `progression.test.ts`: a pick at each even level and none at odd ones (`picksAt`); `autoAdvance` follows each plan and spends every pick.
  - `creation.test.ts`: the pre-rolls are legal.
  - `character.test.ts`: mana per AC4; shield wall only with a shield; derived trait numbers.
- **Engine** (`battleEngine.test.ts`, with scripted RNG): one test per row of section 5.4's table. Replay and snapshot round-trip with every new `UnitRecord` field set.
- **Policy** (`policies.test.ts`): each new step chooses as section 5.5 says in a staged state; taunted units turn on the source; monsters' choices are unchanged in today's encounters, in a snapshot of choices over the existing policy tests.
- **Saves:** v18 and v22 fixtures load and match AC10. A v23 save of a battle restores into v25.
- **Scenes:** `perkTree.test.ts` (no two nodes share a cell; every node fits within 720 px; lock hints), `skillMenu.test.ts`, `foeInfo.test.ts` for bandit abilities, and `*Scene.test.ts` smoke tests.
- **Browser** (`npm run test:browser`):
  - creation picks across two tree tabs;
  - the panel's tree view (tabs 1 to 4, taking a node on the world map, a capstone's lock hint);
  - a battle with Taunt (AC7) and Pin on a scripted seed;
  - the Abilities tab's Cast.
  - `e2e/character.test.ts`'s perk-tree test is rewritten: 95 nodes, distinct centres per tree.
- **Simulator:** `scripts/simulate.test.ts`'s guard fixture is re-recorded at the end of each stage, with the campaign figures in the commit.

### 7.2 Balance method (R14)

All runs use seed 1 and 500 battles or campaigns, inside the container (`make simulate`, Node 26). One run at a time.

**0. Baseline (before stage 1).** Re-measure on `main`:

- the one-party guard (`--campaign --parties 1`, `CLAUDE.md`: 230);
- the default company (239);
- `--ready-level 10` (389);
- the cells below.

These are the reference figures.

**1. Cells** (a party of the threat's own level, `--encounter --threat --party-level`):

| Cell | Today (from `CLAUDE.md`) | Target band |
| --- | --- | --- |
| Goblin Raid, threat 3, level 3 | 500 (Goblin Raid 500 / 500 / 358 at the bands quoted) | ≥ 470 |
| Bandit Camp, threat 3, level 3 | 429 | 400–470 |
| Bandit Camp, threat 4, level 4 | 473 | 430–490 |
| Bandit Camp, threat 5, level 5 | 469 | 420–490 |
| Spider Nest, threat 5, level 5 | 451 | 410–480 |
| Salamander Pool, threat 5, level 5 | 456 | 410–480 |
| Troll Lair, threat 5, level 5 | about 0 in today's weapon cells (the party loses it whatever it holds) | report only; a rise is welcome |
| Source guardians, threat 5, level 7 and level 10 | (measure at baseline) | within ±40 of baseline at level 7; higher at level 10 |

Fresh-party cells (level 1 at threats 1 to 3) must stay "nearly all, most and 7 in 10" as `CLAUDE.md` records.

**2. Path parity.** The point is that every path is a real choice. For each role, run Bandit Camp threat 4 at levels 4 and 8 with each path's plan in that role's slot through `--plans`:

- melee: swordmaster, knight, spellsword, assassin, paladin
- archery: ranger, rogue-archer, assassin
- magic: evoker, cryomancer, arcanist, healer, saint

Target: every plan within ±10% (±50 of 500) of its role's best. A plan below that has its numbers raised; one above has them lowered. Capstones are checked the same way at level 12 against Spider Nest threat 5.

**3. Campaign bands:**

| Run | Today | Band (Q5) |
| --- | --- | --- |
| `--campaign --parties 1` | 230 / 500 | 215–250 |
| `--campaign` (default company) | 239 | 220–260 |
| `--campaign --ready-level 10` | 389 | 370–420 |
| Heroes dead per campaign (one party) | 1.8 | ≤ 2.0 |
| Days per campaign | 270 | ±10% |

**4. The loop.**

1. Change one lever.
2. Run the cells it touches (seconds to minutes).
3. Once the cells sit in band, run the three campaigns.
4. Log each run in the plan's completion log: the lever, its value, the figures, and kept or reverted.

The levers, in this order:

1. Node numbers: technique bonuses, aura sizes, passive sizes, mana costs, recharges.
2. Tier levels and depths.
3. `MANA_PER_TREE_NODE`.
4. Node sizes by kind: casters' passives first, if casters lag behind fighters in parity. The pick rate is fixed by the user's decision (Q1) and is not a lever without asking.
5. Bandit plans and counts.
6. Foe counts and `FOE_HP_PER_LEVEL`, as `CLAUDE.md` advises, only if the first five cannot reach the band.

Stop when every cell and campaign figure is in band and parity holds, or after the user accepts a figure outside it. `CLAUDE.md`'s rules of scaling are then restated with the new figures.

### 7.3 Staging

Each stage merges on its own, leaves the game playable, passes `npm test` and `npm run test:browser`, re-records the guard, and records its campaign figures.

1. **Stage 1: Trees, picks and passives.**
   - `trees.ts` and the new `Perk` shape, with tiers, depth, calling and capstone lock.
   - A pick at every even level, single-rank nodes, mana for all, and spell picks and Spellcasting retired.
   - Every passive whose effect is a derived number: today's, plus resistance, wardAll, shieldAc, spell damage, heal bonus, mana, extend, friendly range and AP discounts.
   - Every spell needing no new engine rule: today's 17, Web and Curse moved, Frostbite, Meteor, Mass Haste, Lay on Hands, Ward (new status `warded`).
   - The four-tab tree view, creation, the panel tabs and `heroTitle`.
   - Pre-rolls, bandits and `autoAdvance` plans; save v23 and the migration; manual and `CLAUDE.md`.
   - Nodes of later stages are left out of `PERKS` until their stage, and the view handles any count.
   - Baseline and first campaign measurement.
2. **Stage 2: Hero techniques.**
   - The `Ability` and `Strike` extensions; all 17 techniques, including Taunt, Pin and Pinning Shot; the status `slowed` for Hamstring.
   - Rooted (`StatusLaidEvent`, `moved`); the statuses taunted, pinned and marked.
   - The Skills menu, the effects and the policy's technique steps; `--plans` and the new summary lines.
   - `LOG_SCHEMA_VERSION` 25 and `SAVE_VERSION` 24. Measure.
3. **Stage 3: Traits, auras, capstones and the special spells.**
   - The traits: Iron Skin's free-attack bonus, Counter, Tumble, Skirmisher, Backstab, Ambush, Executioner, Fortune's critical damage, Battle Mage's mana on hit, Serenity, Guardian, Courage, Aegis, Sanctuary, Unbreakable, Blademaster, Deadeye, Shadowdancer, Deathblow, Arcane Knight.
   - The special spells: Purify, Revive, Renew, Holy Light, Ice Lance, Glacial Prison (status `frozen`, `renewing`).
   - The policy's remaining steps.
   - `LOG_SCHEMA_VERSION` 26 and `SAVE_VERSION` 25. Measure.
4. **Stage 4: Balance.** The loop of section 7.2 to the bands, path parity, manual screenshots retaken, and `CLAUDE.md`'s scaling restated.

## 8. Open questions and assumptions

### 8.1 Decided by the user (approved with the design)

| # | Question | Options offered | Decision |
| --- | --- | --- | --- |
| Q1 | How fast do picks come? | (a) 1 a level; (b) 1 every other level, with nodes twice as big; (c) 1 a level up to 10, then every other level | **Decided: (b)**, against the recommended (a). Three at creation, then one at every even level (5 / 8 / 13 picks by levels 5 / 10 / 20). Fewer, bigger nodes: 7 or 8 a path, each of one rank. The designer chose even levels over odd ones (section 4.2). |
| Q2 | How strict is the soft lock? | (a) Capstone only in your deepest path; one capstone ever (derived, no stored choice); (b) a stored "calling" fixed by the first deep node | **Decided: (a).** T1 to T3 open to all; the capstone only in the calling path; one ever. |
| Q3 | Revive and Unbreakable soften permadeath. Allowed? | (a) Yes, as level 12 capstones, once a battle; (b) Revive only; (c) neither | **Decided: (a).** |
| Q4 | Respec? | (a) None; (b) a paid respec at the shrine (gold, a day) | **Decided: (a)**, none for now. (b) can come later without changing the data. |
| Q5 | Acceptable guard band? | The bands of section 7.2 | **Decided:** one party 215–250 of 500, company 220–260, ready level 10 370–420, as the stage 4 stop rule. As before, the user may accept a figure outside the band on review. |

### 8.2 Engineering assumptions (settled here)

- **Techniques are abilities and magic is spells.** A mana technique rolls with the weapon (`toHit`), not with Magic, so the Spellsword, Paladin and Assassin need no Magic. Spells roll with the spell skill as today.
- **Volley touches allies**, as every hostile area does. The policy's `areaHarm` already avoids them.
- **Taunt cannot be resisted.** Its counters are its recharge and its radius. A per-level resist would need a stat monsters lack.
- **Tie depths both count as the calling.** A hero tied 5–5 may take either capstone, then is locked.
- **Picks at even levels** rather than odd ones: level 2, right after the first wins, brings a choice, and the capstone falls at 12. With odd levels it would fall at 13.
- **Grandfathered perks on migration** keep their nodes even where the new asks would refuse them. A folded perk maps to its node, and a second rank or a duplicate collapses into one node. Negative pick balances clamp to 0.
- **`fighterGrowth` stays frozen** unless the yardstick test fails for that reason alone (section 6).
- **Bandits use the same trees and plans.** That keeps "a bandit fights as a hero of that draft would" true, and makes the bandit cells the main early check of balance.
- **No baseline was run here** (Node 22 on this machine). Stage 1 begins by re-measuring the figures `CLAUDE.md` records.

### 8.3 Risks

- **Scope.** About 40 new engine rules. Staging keeps each merge reviewable, and each rule is one row of section 5.4's table with its own test.
- **The AI under-uses actives** (Taunt timing, Pin targets), so the simulator's heroes look weaker than the player's. The path-parity cells expose this. A policy fix is preferred to inflating numbers.
- **Bandits with Taunt and Backstab may spike the threat 3 to 5 cells.** Their plans are a lever (5.8) before foe counts.
