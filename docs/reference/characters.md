# Characters, gear and progression: reference

The full rules of `src/character/` and `src/inventory/`. The working guides are `src/character/CLAUDE.md` and `src/inventory/CLAUDE.md`; this file holds the numbers and the detail behind them. Characters follow Fallout 1 and 2; the skill trees' design is `docs/designs/skill-trees.md`, and the node costs' `docs/designs/skill-trees-node-costs.md`.

## The character

A `Character` stores only what it was born with (`attributes`, `tagged` skills), what it has learned (`level`, `trained` skill points, `perks`, the unspent `perkPoints`), what it has left (`hp`, and `mana`, read through `manaOf`) and what it carries. Every number it fights with is derived from those, never stored: `maxHp`, `maxMana`, `attributeLevel`, `skillLevel` and `deriveCombatStats`, which turns a character into the `CombatantStats` the engine fights with. A character's `portrait` (`PORTRAIT_IDS` in `portraits.ts`) is only looks.

### Attributes

A character has six attributes from 1 to 10 (`ATTRIBUTE_IDS`), adding up to `ATTRIBUTE_POINTS` (32) at birth, which is one short of three at 10: one at 10 leaves two at 7 and the rest low, and two at 10 leave the others near 3. Perks raise them from there, never past 10, and the sum is the attribute everywhere (`attributeLevel`, in `perks.ts`).

The attributes give:

- hit points: 10 + strength + endurance, and 2 + half its endurance a level;
- action points: 5 + half its agility;
- armour class: agility, plus armour, shield and enchanted gear (its resistance is only what its armour stops);
- critical chance: luck;
- a little melee damage: strength;
- where each skill starts (below).

A raise changes at once everything the attribute feeds, hit points of past levels included (they are derived), but not skill points already handed out (they are banked).

### Skills

There are three skills, each a percentage (`SKILLS`): Melee Weapons, Archery and Magic. They start low, from attributes alone (strength + agility, perception + agility, twice intelligence), so that the rest is the character's choices.

- One skill is tagged, which adds `TAG_BONUS` (20) and doubles what a skill point buys.
- A raise costs 2 points from 80% and 3 from 90% (`SKILL_COST_TIERS`).
- Skill points raise no skill past `MAX_SKILL` (100%), `skillRaiseRefusal` saying why, though a node's 10% may carry it past.
- `skillLevel` is the skill everywhere, the perks' share included.
- An untagged, untrained skill sits near 10%, which the engine's floor makes a 5% chance against anything armoured.

A weapon skill is the chance to hit with that kind of weapon before the foe's armour (`weaponSkill`): Melee Weapons for melee, bare hands included (which roll a fixed 1d4); Archery for a weapon that reaches further than a hex and has no reach; or the skill the weapon names, which for a wand and a staff is Magic. A wand is in every other respect a ranged weapon: no mana, no zone of control, nothing from strength, and the archer's perks apply. Magic is also the chance of a spell striking, and what spell nodes ask for. There are no classes: every path of the skill trees is open to every hero.

### Gear weight

Gear has weight (`deriveCombatStats`):

- Each worn item that asks more strength (`ItemStats.strength`, read against `attributeLevel`, so Gain Strength helps) than the wearer has costs `SHORTFALL_TO_HIT` (5) to hit a point short, item by item and added up (`strengthShortfall`; an off-hand item under a two-handed weapon counts for nothing), against weapon attacks only.
- An item's `apPenalty` comes off action points every turn (plate and the tower shield 1 each).
- Heavy gear's negative `spellSkill` lowers spells (plate −15; the breastplate, helm and gauntlets −5), which is how weight tells against a caster.

The iron breastplate every hero starts in asks strength 3 (the user's decision: 4 cost the strength-3 ready-made archer and mage 5 to hit, and the guard 56 campaigns), so those two lose nothing to it, and a wearer of strength 2 loses 5.

Runes and nodes (Spell Ward, Blessed Armour) give a hero wards (`CombatantStats.wards`, summed over everything worn and the nodes held), which take their points off each hit and tick of their element as a monster's do.

### Hit points and worn gear

Only a Life rune's `maxHp` changes maximum hit points (in armour or a shield; in a weapon Life heals on a hit), and `maxHp` adds the worn items'. Every change to what a character wears therefore ends with `clampHp(character, maxBefore, rule)`, the maximum read before the change:

- `'share'` (outside battle, the default): the hero keeps the same share of its hit points, `min(max, max(1, round(hp × max / maxBefore)))`, never above the new maximum and never to 0 from a positive value, so taking Life gear off and putting it back leaves `hp` where it was, within rounding, and a full hero stays full. A hero at 0 stays at 0.
- `'cap'` (in battle): hit points are only lowered to the new maximum, as the engine's `equip` does, so Life armour put on mid-fight heals nothing. `BattleScene` hands the character panel this rule as each member's `hpRule`.

`equipFromBackpack`, `unequipToBackpack` and `dropEquipped` take the rule; a new way of changing what a character wears must too.

### Mana and casting

Every hero has mana (`maxMana`): twice its intelligence, half its intelligence more a level, `MANA_PER_TREE_NODE` (2) for each node it holds in the Mage and Cleric trees, and what its gear and nodes add. Only a hero that knows a spell, or a technique that costs mana, brings `magic` into battle (its `spells` then maybe empty). A character knows exactly the spells its nodes teach (`knownSpells`). `deriveCombatStats` also gives a hero its `abilities` and `imbueDamage` (the `imbueDamage` effect) when it has any. An item's `spellSkill` helps spells strike but counts neither towards what a node asks nor for a wand.

Out of battle the only casting is healing on the world map (`worldCasting.ts`): `worldSpells` lists the heals a character can cast now, and `castOnWorldMap` casts one, paid from the mana it carries and restoring the average of the spell's dice plus the caster's heal bonus (Mending; `worldHealing`), so the world map rolls nothing.

## Creation

`creation.ts`; the screens call its functions and decide nothing. A `CharacterDraft` is what the player chose (attributes, tag, skill points placed, perks in the order taken, name, portrait) and `draftCharacter` the level 1 `Character` it makes.

- All six attributes start at 1 and the player places 26 points (`CREATION_ATTRIBUTE_POINTS`, so they add up to `ATTRIBUTE_POINTS`), all of them, none above 10.
- The player tags one skill and places 10 skill points (`CREATION_SKILL_POINTS`).
- The player spends 3 perk points (`CREATION_PERK_POINTS`) on nodes of the first tier (the only one open at level 1, each costing 1; `perkPointsLeft`).
- The player gives a name (at most 12 letters, unique in the party, as the battle log tells units apart by name) and one of the preset portraits.

Creation has no rules of its own about what a point or a perk does: `draftCharacter` spends them with `raiseSkill` and `takePerk`, so nothing a perk asks is waived, and a perk must be open to a level 1 character. Skill points and perk points left unspent stay on the character, to spend on the world map as those of a level are. A change that leaves a chosen perk unqualified drops it and returns its point (`pruneDraft`), and the screen says which.

Starting gear is not chosen: a character holds the weapon of its tagged skill (`STARTING_KIT`), wears an iron breastplate (whose spell skill −5 a caster pays) and carries every other plain weapon.

A specialist (its skill tagged, all 10 points in it, its skill node's 10%) starts near 65% when its skill's attributes come to about 15 (strength 9 and agility 6, say), which is the trade-off: a 60% start leaves less for the rest. The prerolls, the ready-made three among them, are drafts like any other, held to the same rules by a test. The party being built is a list of drafts, which is what lets a character be edited until the game begins; the drafts are not kept after that.

## Perks: the skill trees

A perk (`PERKS`) is a node of the skill trees (`trees.ts`): four trees (Warrior, Scout, Mage, Cleric) of three paths each (`PATHS`, `PATH_IDS`). Every node is data:

- its `path` and `tier`;
- what it asks beyond its tier: attributes, skills, `anySkill` (any one of several, worded "Melee 40% or Magic 40%") and a node of its own path that it `requires`;
- what it adds (`PerkEffects`, which `perkBonus` sums wherever that number is derived), its `meleeOnHit`, and the `spell` it teaches, if any (`perkTeaching`), or the `ability`, or the `trait`.

`PERKS` is ordered by tree, path and tier, which is the order the tree view lays a path's nodes out in; a new node of an existing shape is one entry there. `nodeKind` tells a spell, a technique used at will or for mana (`Perk.ability`, by its `manaCost`) and a passive apart.

### Tiers, costs, depth and capstones

Every node has one rank (`perks` holds 1) and costs its tier's perk points (`perkCost`, from `TIERS`' `cost`; no node is priced on its own). `nodesCost` sums the nodes held; `canAffordPerk` checks; `takePerk` spends.

| Tier | Level | Depth (nodes held in the path) | Cost |
| --- | --- | --- | --- |
| 1 | 1 | 0 | 1 |
| 2 | 2 | 1 | 2 |
| 3 | 6 | 3 | 3 |
| Capstone | 12 | 5 | 4 |

Depth counts nodes, not points. A capstone also asks that its path be the hero's calling, the path or paths it holds most nodes in (`calling`, derived, never stored, ties all counting), and that the hero hold no capstone (`capstoneOf`): taking one closes every other for good. Asks gate taking a node, never keeping it.

`missingRequirements` words what is lacking, in one order: level, attributes, skills, any skill, the node required, "3 nodes in Heavy Knight", "Heavy Knight must be your deepest path", "Only one capstone". `describePerkRequirements` says the same out of context.

### What the nodes hold

All 95 nodes of the design are in, each with its whole effect: 7 or 8 a path (Spellsword 7), two of tier 1 and one capstone in each.

- 17 techniques, each a node that teaches an `ability`, worded from `ABILITIES` with its cost.
- 14 nodes that switch on a `trait` (`TRAIT_IDS`, which the engine reads by name): Rooted, the auras Guardian, Aura of Courage (`courage`) and Aegis, Tumble, Counter, Ambush, Deathblow, Blademaster, Deadeye, Unbreakable, Shadowdancer, Sanctuary and Arcane Knight.
- Spells: a spell is a node bought with perk points like any other, its Magic ask the gate (40% at tier 1, 55% at 2, 65 to 70% at 3, 80% for a capstone). There are no spell picks and no Spellcasting perk.
- Effects, all derived in `deriveCombatStats`: resistance, every ward and blight's, a shield's armour class (Shield Wall's only with a shield held under a one-handed weapon), spell power, heal bonus, extended statuses, friendly range, AP discounts (the spell modifiers on `magic`), the nodes' `meleeOnHit` (after the runes', with a melee weapon or bare hands), the stage-3 numbers `opportunity` to `manaRegen`, and the nodes' `traits`.
- The skill nodes (Weapon Training, Marksmanship, Arcane Study) add 10%, keyed by skill id and read by `skillLevel`, so they count towards what another node asks.
- Attributes: only Gain Strength raises an attribute alone (+2, refused above 8 by `cappedAttribute`); Toughness, Far Shot, Skirmisher, Fortune and Lasting Magic each add 1 to theirs beside their own effect, the attribute stopping at 10.

The trees are drawn by one view (`PerkTreeView`), with a tab for each tree (or keys 1 to 4), in the character panel and in creation alike. A node is chosen from the trees and nowhere else.

## Progression

`progression.ts`.

### Experience

Winning a battle earns the experience its foes are worth together (`xpReward`), a foe of level L being worth L times what its kind is worth at level 1, awarded by `BattleScene` when the battle ends (`rewardVictory`); the engine and the simulator know nothing of it. Every living party member earns the whole reward, so the yardstick below holds for each hero whatever the party's size. Reserves earn nothing.

A foe's worth is fixed by its kind and level, while each level costs more than the last (`xpToNextLevel`, `gainXp`), so early levels come fast and later ones slowly. The yardstick is the even foe, worth `EVEN_FOE_XP_PER_LEVEL` × the hero's level, with a weak foe at half that: level 2 costs a little under one even foe, and after that leaving level L costs L − 1 of them. Price a new monster against that yardstick.

### Death, wounds and healing

A member who fell in a won battle is dead (permadeath): out of the party for good, what they wore and carried put in the baggage, and named on the victory screen; the party fights on smaller until the guild hall fills the place. A battle is lost only when every member has fallen, and it wipes the party out (`wipeParty`): its heroes are dead, what they wore and carried and its baggage lie at the location as its loot, and the party is gone. The game ends only when no hero is left in any party or the reserves, and the last party wiped with reserves left is replaced at once by one formed from them at the encampment (up to the party limit, the lowest free id and its default name).

Wounds are carried from battle to battle. A new level heals fully; otherwise hit points come back by healing spells, in battle or on the world map, and by camping, a hit point a day. Mana spent on the world map is refilled by a day of camping, but not by waiting or travel.

### What a level brings

A level brings hit points, skill points (2 + a third of the hero's intelligence, so 2 to 5, kept few because a tagged skill doubles them) and a perk point (`PERK_POINTS_PER_LEVEL`, 1, at every level); it heals the hero fully and fills its mana. `pointsAt(level)` is the three of creation and one a level: 6 by level 4, 10 by 8, 14 by 12, 22 by 20. For a hero never migrated, `perkPoints + nodesCost` is always `pointsAt(level)`. `affordableAt` says the level at which a node becomes affordable.

A hero that stays in one path takes its first tier 3 at level 6 and its capstone at 12 with nothing to spare; one who mixes paths holds more nodes but reaches a capstone later.

The skill points and perk points wait on the character until the player spends them, which is done on the world map and not in battle: stats changed mid-battle would have to reach the engine as an `equip` action does.

### autoAdvance

`autoAdvance` spends a simulated hero's points, or a bandit's, by a plan (`AUTO_PLANS`):

- `planFor` picks by the tagged skill: Melee `knight`, Archery `ranger`, Magic `evoker_healer`. A bandit's role names its own (`BANDIT_PLAN`).
- A parity plan, a path's nodes, names its capstone first, so that it is saved for and taken as soon as it is afforded, the rest in `PERKS` order, but for the cryomancer's, which takes Ice Lance before Web.
- Again and again it picks a target: the first node of the plan it qualifies for, or would if only its level were higher; else the first in `PERKS` order it qualifies for now that is no capstone. It stops, saving its points, while the target is short of the level or of points, never spending them on a cheaper node further down. A node short of depth, a skill, an attribute or the node it requires is skipped, as waiting will not open it.

The ready-made heroes come to:

- Aldric: Rooted 3, Taunt 5, Pin 8, Shield Wall 9, Unbreakable 13.
- Brenna: Aimed Shot 3, Volley 6, Far Shot 8, Deadeye 12.
- Delwyn: Flame Arrow 3, Arcane Blood 4, Heal All 6, Fireball 9, Pyromancy 11, Meteor 15.

## The gear catalog

`catalog.ts` is the catalog of plain gear.

- The families (`FAMILIES`, 28): weapons, shields, body armour and the head, gloves and boots slots, each with its slot, material kind, icon and tier-1 stats, among them what it asks of strength (`strength`), what it takes in action points (`apPenalty`), a reach weapon's `reach` and the crossbow's `rangedPierce`, which `deriveCombatStats` derives.
- The materials (`MATERIALS`), tiers 1 to 5 of each kind, tiers 1 and 2 first: metal iron, steel, Mithril, Adamant, Starmetal; wood yew, ironwood, Elderwood, Wyrmwood, Heartwood; hide leather, wolfhide, Wyvern-hide, Basilisk-scale, Drake-scale (ids `wyvern`, `basilisk`, `drake`: no material id holds an underscore); cloth linen, silk, Mithrilweave, Adamantweave, Starweave (woven from the metal's ore). A tier-3+ material names the stock material forging spends (`stock`: `mithril`, …, `wyvern_hide`, `basilisk_scale`, `drake_scale`; the weaves their ore).
- What a tier adds over tier 1 by gear class (`TIER_BONUS`, `gearClass`: weapon, shield, armour, small), folded by `tierStats`:

  | Class | 2 | 3 | 4 | 5 |
  | --- | --- | --- | --- | --- |
  | weapon | damage +2 | damage +4, to hit +5 | damage +6, to hit +5, pierce +1 | damage +8, to hit +10, pierce +1 |
  | shield | AC +2 | AC +4 | AC +6, resistance +1 | AC +8, resistance +1 |
  | armour | AC +2, resistance +1 | AC +4, resistance +1 | AC +6, resistance +2 | AC +8, resistance +3 |
  | small | AC +1 | AC +1 | AC +2 | AC +3 |

  A small-slot family with resistance at tier 1 (helm, gauntlets, greaves) also gains `SMALL_RESISTANCE` (1, 1, 2 at tiers 3, 4, 5). A tier never changes attack AP, range, two-handedness or a penalty; piercing only by the weapon's +1 at tiers 4 and 5, which tells only in a melee weapon or the crossbow: a shot pierces only with `rangedPierce` (`deriveCombatStats`), so a bow, longbow or wand carries the point and gains nothing from it.
- Mithril and Starmetal ask 1 and 2 less strength of their families (`strengthRelief`, never below 0) and halve a spell-skill penalty toward 0 (`casterFriendly`, `Math.trunc`: −5 → −2, −15 → −7); Adamant neither.
- The legacy ids (`LEGACY_ALIASES`).

## Items

`inventory.ts` has the items:

- `BASE_ITEMS`, the plain items the trading post and crafting work with, generated as every family in each material of its kind, in `MATERIALS` order (tiers 1 and 2 first): 140, the Wand of Sparks among them as the wand's tier 1. Names are "<Material> <Family>" ("Mithril Longsword", "Drake-scale Leather", "Starweave Robe"), a family's `tier1` name only at tier 1. The trading post sells tiers 1 and 2 only; tiers 3 to 5 are forged at the workshop;
- `WEAPONS`, the six plain weapons a new hero carries;
- `MAGIC_ITEMS`, the enchanted ones won as loot.

### Ids

A plain item's id is `<material>_<family>` (`steel_longsword`), or for a tier 1 that has its own, the family's `tier1` id (`iron_sword`, `oak_shield`, `spark_wand`, `ash_staff`, `leather_armor`). The tier-1 greatsword and breastplate are `iron_greatsword` and `iron_breastplate`, `steel_greatsword` being tier 2's, and `steel_armor` is an alias of `iron_breastplate`, which builds the same object carrying the canonical id.

A graded, modified or runed item is named `<plain>[@<grade>][+<modifier><grade>][#<rune>(.<rune>)*]`, as in `iron_sword@2+light1` or `steel_longsword@3#ember2.storm1`. Grade 1 is never written, so each item has one id. An enchanted item takes the `#` part only (`emberblade#dawn1`). `itemById` builds an item from its id and remembers it, so one id is always one object; it refuses an id with more runes than the item's sockets or a rune that does not fit.

Every plain item, graded, modified or runed, carries its `family`, `material` and `tier`; a runed plain item gets `base`, and any runed item its `runes` (in socket order, filled sockets first; `unruned`, `withRunes`, and `craftedItem`, which keeps them).

### Grades and modifiers

A plain item comes in three grades (`grades.ts`) and may carry one modifier (`modifiers.ts`, `MODIFIERS`: the families it fits, the workshop level that unlocks it, its stat change at each grade).

- A grade adds by gear class: damage to a weapon (and at Masterwork, to hit), armour class to a shield or a small-slot item, resistance to body armour. It never changes attack AP, range, piercing, strength or a penalty (a tier touches piercing at 4 and 5, and strength and spell skill through Mithril's and Starmetal's relief).
- No tier, grade or modifier touches maximum hit points (a Life rune does).
- Enchanted items take no grade or modifier.

### Runes and sockets

`runes.ts` has the runes: ten kinds (`RUNES`) at four ranks, each doing one thing in a weapon (the main hand), another in armour (every other slot) and another in a shield (`slotClass`), folded into a runed item's stats (`addStats`).

- Sockets (`socketsOf`, `SOCKETS_BY_TIER`): 0 at tier 1, 1 at tiers 2 and 3, 2 at tiers 4 and 5, one more at Masterwork, at most 3; a small-slot item at most 1; the Emberblade, the Wand of Storms and the Hawkeye Bow 1 of their own.
- Fitting (`runeFits`): Mind goes in a weapon only if it strikes with Magic; Acid only in a melee weapon or the crossbow, whose piercing it adds to. `runeFitsOnly` says where a rune fits, for the refusal.
- A rune adds the `ItemStats` fields `wards` (by element), `onHit` (a weapon's flat on-hit damage, status or healing; `OnHit` in `combat.ts`) and `maxHp`, besides the older fields. `deriveCombatStats` and `maxHp` derive them: wards summed over everything worn, `onHit` from the main hand only, the worn items' `maxHp` added. The engine resolves them.
- `runes.ts` also has the pouch's helpers and the one phrasing of on-hit effects (`onHitParts`, long, or short for the character panel's narrow column), which every screen that tells them uses.
