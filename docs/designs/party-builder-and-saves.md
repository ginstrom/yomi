# Party builder, character creation and save slots

## 1. Purpose and status

A new game drops the player onto the world map with four fixed heroes, and a closed tab loses the game. This design changes both ends of that:

- **Party builder**: New asks whether to take the **ready-made party** of three or to **create your own**, and either way leads to a **party screen** where characters are removed and created. The party's limit starts at 3.
- **Character creation**: attributes from 1 with points to place, skills that start low with points to place and one to tag, and three starting perks. New perks raise a skill, so a specialist starts near 60% in its skill.
- **Save slots**: three of them, written by the game itself after every turn on the world map and in battle. The menu gets **Continue** (the latest save) and **Load** (pick a slot).

**Status: ready for planning.** Nothing blocks it. Section 8 lists the assumptions made where the request left a choice open; the first three are worth a look before planning, as each changes what is built.

Decisions the user made, kept as given: the two ways to start; a ready-made party of three; a limit that starts at 3; one party screen after either choice, for removing and creating; creation that starts with attributes, all at 1, with a set number of points; low skills with a set number of points, so that the tag matters; about three starting perks; perks that raise skills; about 60% for a specialist; three slots, Continue and Load; a save after every world map turn and every battle turn.

## 2. Requirements and scope

### Functional requirements

| ID | Requirement |
| --- | --- |
| R1 | **New** opens a choice: the ready-made party, or create your own. Either leads to the party screen, the first with the ready-made three in it and the second with it empty. |
| R2 | The **ready-made party** has three characters, each one a legal creation under R5 to R8. |
| R3 | A game has a **party limit**, which starts at 3. The party screen shows that many places and no party grows past it. |
| R4 | On the **party screen** the player removes any character and creates one in any empty place, and begins the game once the party has at least one member. |
| R5 | **Creation: attributes.** All six start at 1 and the player places 29 points, none above 10. All must be placed. |
| R6 | **Creation: skills.** Skills start low, from attributes alone. The player tags one skill and has 10 skill points to place, which buy what they buy later: 1% a point, 2% in the tagged skill. |
| R7 | **Creation: perks.** The player has 3 perk picks, spent in the perk tree on any perk the character qualifies for at level 1. |
| R8 | **Creation: name and portrait.** The player names the character and picks one of the preset portraits. |
| R9 | **Skill perks**: one perk for each skill adds 5% to it a rank, two ranks each. A character that tags a skill, puts its 10 points in it and takes a rank starts at about 60%. |
| R10 | Skill points and perk picks not spent at creation stay on the character, to spend on the world map as those of a level are. |
| R11 | There are **three save slots**. A new game takes one, and the game writes to it by itself: after every turn on the world map and at the start of each of the player's turns in battle. There is no save button. |
| R12 | The menu's **Continue** loads the slot written last. **Load** lists the three slots and loads the one picked. A game saved in battle opens in that battle, as it stood at the start of the player's turn. |
| R13 | Scaling is **retuned** for the ready-made party of three under the new skill numbers, to the standing target: the aggressive policy clears the map about 2 times in 3. `CLAUDE.md`'s rules are rewritten with the new numbers. |

### Quality constraints

- Creation's rules, the save format and the slots are Phaser-free domain modules with tests. The scenes decide nothing.
- A character still stores only what it was born with and what it has learned. Creation adds no stored number: a created character is a level 1 `Character` like any other.
- Creation spends skill points and perk picks through the functions the world map uses (`raiseSkill`, `takePerk`), so a perk means the same at creation as at level 3.
- A battle restored from a save plays on exactly as the unsaved one would have: same dice, same enemy choices.
- A slot that cannot be read (damaged, or written by another version of the game) never breaks the menu: it is listed as unreadable and cannot be loaded.
- A browser that refuses storage still plays; the game is then not saved.

### Non-goals

- **Editing a character once created**, on the party screen or later. A character is removed and made again.
- **Recruiting after the game has begun**, and anything that **raises the party limit**. The limit is stored with the game so that something later can raise it.
- **Choosing starting gear.** A character's starting weapon follows its tagged skill (section 4.5).
- Traits, classes, a random-character button, and a seventh attribute.
- **A save button, more than one save of a playthrough, copying or deleting a slot** (a new game may overwrite one), and export to a file.
- **Migrating old saves.** A save of another version is unreadable. Migration comes with the first release that has players to keep.
- Saving in the middle of a turn, or while the enemy acts.

### Acceptance criteria

| ID | Criterion | Covers |
| --- | --- | --- |
| A1 | In the browser, New shows two choices. Ready-made opens the party screen with Aldric, Brenna and Delwyn; Create your own opens it with three empty places and Begin disabled. | R1, R3 |
| A2 | Each ready-made character is what `draftCharacter` makes of a draft with no problems: attributes summing to 35, one tag, 10 skill points and 3 picks spent. | R2 |
| A3 | Aldric starts with Melee Weapons 58%, Brenna with Archery 59%, Delwyn with Magic 63%, Magic Arrow and 18 mana. Aldric's Archery is 10%. | R6, R9 |
| A4 | On the party screen, Remove empties a place and Create fills one; with three members there is no Create. `joinParty` refuses a fourth member at a limit of 3. | R3, R4 |
| A5 | A draft with a point unplaced, an attribute of 0 or 11, no tag, more than 10 skill points or an empty name has a problem named for each, and Create is disabled until none is left. | R5, R6, R8 |
| A6 | At creation Toughness can be taken by a character with Endurance 5 and Gain Strength cannot (it asks level 3). Magic Arrow can be taken once Magic is 50% and not before. | R7 |
| A7 | Lowering an attribute or a skill, or changing the tag, so that a chosen perk no longer qualifies drops that perk and returns its pick, and the screen says which. | R7 |
| A8 | A character created with 4 skill points and 1 pick unspent enters the game with them, and the world map's panel lets them be spent. | R10 |
| A9 | `parseSave(serializeSave(file))` equals `file` for a game on the world map and for one in battle, with every item the same object as the one in `inventory.ts`. | R11 |
| A10 | In the browser: begin a game, travel three hexes, reload the page. Continue is enabled and opens the world map with the party on that hex at that turn. | R11, R12 |
| A11 | In the browser: enter a battle, play a turn, end it, wait for the player's next turn, reload the page, Continue. The battle is on screen in the same round with every unit where it stood, at the same hit points, action points and mana. | R11, R12 |
| A12 | Two engines, one run straight through and one snapshotted, restored from the snapshot's JSON and run on with the same actions, produce the same log. | R12 |
| A13 | With games in slots 1 and 2, Load lists both with their party and turn and slot 3 as empty; picking slot 1 loads that game, and Continue loads whichever was written last. | R12 |
| A14 | A slot holding `{`, or a save of another `SAVE_VERSION`, reads as unreadable, cannot be loaded and does not enable Continue. | R12 |
| A15 | With all three slots full, Begin asks which to overwrite; with one empty it takes the first empty one without asking. | R11 |
| A16 | `npm run simulate -- --campaign --battles 1000 --seed 1` with the ready-made party clears the map about 2 times in 3, and `CLAUDE.md` gives the numbers that do it. | R13 |

## 3. Current system

Inspected facts, with the files they come from.

- **Starting party** ([`src/game/party.ts`](../../src/game/party.ts)): `newParty()` builds four fixed heroes from `STARTING_HEROES`, each a `Build` (portrait, attributes, tag, hands, optional perks). `MAX_PARTY_SIZE` is 6 and `joinParty` checks only that. The simulator's player side is `newParty()` ([`scripts/simulate.ts`](../../scripts/simulate.ts)).
- **Characters** ([`src/character/character.ts`](../../src/character/character.ts)): `createCharacter(name, build)` makes a level 1 character with no skill points and no picks, in a steel breastplate, with every plain weapon it does not hold in its backpack. Perks a `Build` names are given whatever they ask.
- **Attributes** ([`src/character/attributes.ts`](../../src/character/attributes.ts)): 1 to 10, summing to `ATTRIBUTE_POINTS` (35) at birth.
- **Skills** ([`src/character/skills.ts`](../../src/character/skills.ts)): Melee Weapons starts at `30 + 2 × (strength + agility)`, Archery at `30 + 2 × (perception + agility)`, Magic at `20 + 4 × intelligence`; a tag adds 20 and doubles a point's worth. The four heroes start at 76 to 78% in their tagged skill and near 50% in the others, so a tag decides little. `skillLevel` adds attributes' share, the tag and `trained`; perks add nothing to a skill.
- **Perks** ([`src/character/perks.ts`](../../src/character/perks.ts)): sixteen. All ask level 3 or more except Magic Arrow (level 1, Magic 50%). `PerkEffects` has a key for each attribute, read by `attributeLevel`. A pick comes every third level; `takePerk` spends one on a perk the character `qualifiesFor`.
- **Perk tree** ([`src/scenes/perkTree.ts`](../../src/scenes/perkTree.ts), [`src/scenes/InventoryScene.ts`](../../src/scenes/InventoryScene.ts)): `perkTreeLayout` places a node for each perk from its `branch` and `requires`; today that is 7 rows. The panel draws them at 46px a row between y 100 and y 430, which is room for exactly 7. The drawing is private to `InventoryScene` (`buildPerkTree`, `buildTreeNode`).
- **Game state** ([`src/game/gameState.ts`](../../src/game/gameState.ts)): `{ party, world, baggage }`, made by `newGame()` and passed through scene data. `WorldScene` and `BattleScene` fall back on `newGame()` when started without one.
- **Menu** ([`src/scenes/MenuScene.ts`](../../src/scenes/MenuScene.ts)): New, Continue, Options. New starts `World` with `newGame()`, stopping the paused scene if the menu is an overlay. Continue only resumes the scene the menu was opened over, and is disabled on the title screen.
- **World map** ([`src/game/worldMap.ts`](../../src/game/worldMap.ts)): `WorldState` is plain data but for the `Item` objects in each monster location's `loot`. `travel`, `linger` and `clearLocation` are all that change it.
- **Battle** ([`src/engine/battleEngine.ts`](../../src/engine/battleEngine.ts), [`src/scenes/BattleScene.ts`](../../src/scenes/BattleScene.ts)): the engine keeps its state in private fields (`units`, `round`, `phase`, `winner`, `seq`, `events`) and its RNG in a closure with no way to read where it stands ([`src/combat/rng.ts`](../../src/combat/rng.ts)). The scene keeps, outside the engine, the `Ground`, the enemy policy's RNG (`Math.random` unless the page's address gives a seed) and `loggedEquipment`. Gear changed in battle edits the `Character`s at once; their hit points are written back only when the battle ends. Encounters are built without dice ([`src/game/encounters.ts`](../../src/game/encounters.ts)), so a location's `kinds` and `xpReward` can be had again from its id.
- **Items** ([`src/inventory/inventory.ts`](../../src/inventory/inventory.ts)): constants, compared by identity in places (`createCharacter`) and by `id` in others (`pileChanges`). `WEAPONS` and `MAGIC_ITEMS` list all but `OAK_SHIELD` and `STEEL_ARMOR`. There is no lookup by id.
- **Storage**: only the volume levels, in `localStorage` under `yomi.audio`, read through a `storage()` that survives a browser refusing it ([`src/scenes/audioSettings.ts`](../../src/scenes/audioSettings.ts)).
- **Tests**: every in-browser journey starts with `newGame()` in [`e2e/driver.ts`](../../e2e/driver.ts), which clicks New and waits for `World`. Each test opens a new browser context, so storage starts empty.
- **Balance**: `FOES_AT_THREAT` is 2, 3, 4, 4, 5, tuned for the party of four (`CLAUDE.md`, rules of scaling).

## 4. Proposed behaviour

### 4.1 Flow

```
Menu ── New ──────▶ Party (choice) ──▶ Party (roster) ⇄ Creation
  │                                        │ Begin
  ├─ Continue / Load ──────────────────────┴──▶ World ⇄ Battle
```

- **New** starts the `Party` scene on its choice: **Ready-made party**, **Create your own**, **Back** (to the menu).
- Either choice shows the roster: one row for each place up to the party limit. A filled row shows the portrait, name, tagged skill with its percentage, and hit points, with a **Remove** button. An empty row is a **Create character** button. Below: **Begin** (enabled with one member or more) and **Back** (to the choice; the party made so far is dropped).
- **Create character** starts `Creation`. Its **Create** returns to the roster with the character added in the first empty place; its **Cancel** returns with nothing added. Removing closes the gap: the party stays in battle order, and a new character joins at the end.
- **Begin** takes a slot (section 4.7), makes the game, saves it and starts `World`.

### 4.2 Creation: attributes (R5)

The screen opens here. Six rows, each an attribute at 1 with − and + buttons and its one-line description; a counter shows the points left of 29. + is disabled at 10 or with no points left, − at 1. The attributes still add up to 35 (`ATTRIBUTE_POINTS`), as the four heroes' do today, so nothing derived from them shifts in scale.

A summary on the right, shown on every step, gives what the draft derives: hit points, action points, armour class, critical chance, mana and the three skills. It is the draft built into a `Character` (section 5.2), so it cannot disagree with the game.

### 4.3 Creation: skills (R6)

| Skill | Starts at (new) | Was |
| --- | --- | --- |
| Melee Weapons | `strength + agility` | `30 + 2 × (strength + agility)` |
| Archery | `perception + agility` | `30 + 2 × (perception + agility)` |
| Magic | `2 × intelligence` | `20 + 4 × intelligence` |

`TAG_BONUS` stays 20 and a tagged skill's point still buys 2%. The step shows the three skills, each with a **Tag** toggle (exactly one is tagged; tagging one untags the other) and − and + for the 10 points. A point costs 1, as no skill reaches `MASTERY_LEVEL` here.

What that gives a specialist with 7 and 8 in its skill's attributes: 15 from attributes, 20 from the tag, 20 from ten points, 5 from a rank of the skill's perk: **60%**. Without the tag the same character has 15 + 10 + 5 = 30%, and a skill it ignores sits near 10%, which the engine's floor makes a 5% chance against anything armoured. That is the weight the tag is asked to carry.

### 4.4 Creation: perks (R7, R9)

The step is the perk tree, drawn as the character panel draws it, with **3 picks**. A click on an open node takes a rank; a click on a taken one gives its last rank back, unless another chosen perk asks for it. The strip under the tree reads as it does on the world map.

Nothing about a perk is waived at creation: it must be open to a level 1 character. So the perks change:

| Perk | Change |
| --- | --- |
| Toughness, Dodger, Heavy Hand, Deadly Aim, Keen Eye, Quick Study | `level` 3 → 1 |
| Far Shot, Scholar | `level` 3 → 1; each still asks for the perk before it, so it costs two of the three picks |
| Tireless (level 6), the six Gain perks (level 3) | unchanged: not for a starting character |
| **Weapon Training** (new) | Strength branch, level 1, asks Strength 5; +5% Melee Weapons a rank, 2 ranks |
| **Marksmanship** (new) | Perception branch, level 1, asks Perception 5; +5% Archery a rank, 2 ranks |
| **Arcane Study** (new) | Intelligence branch, level 1, asks Intelligence 5; +5% Magic a rank, 2 ranks |

A skill perk's 5% is part of the skill everywhere, as a raised attribute is part of the attribute: it counts for the chance to hit and towards what another perk asks (Arcane Study can carry a mage to Magic Arrow's 50%).

The Gain perks stay at level 3 because a pick spent on one at creation would be a thirtieth attribute point, and R5 already says how many there are.

A change on an earlier step can undo a perk: lower Endurance to 4 and Toughness no longer qualifies. The draft then drops it, returns the pick and the screen says so ("Toughness dropped: it asks Endurance 5"). Steps are therefore free to revisit in any order, though Next and Back walk them in order.

### 4.5 Creation: name, portrait and gear (R8)

The last step. The eight portraits of `PORTRAIT_IDS` in a row, one picked (the first to begin with; two members may share a face). The name is typed: while this step shows, letter keys, space, hyphen and apostrophe add to it, Backspace removes, to at most 12 characters. It must not be empty or the name of another member, since the battle log tells units apart by name.

**Create** is on this step and is enabled when the draft has no problems; otherwise the first problem is shown beside it.

Starting gear is not chosen. A character holds the weapon of its tagged skill: Iron Longsword and Oak Shield for Melee Weapons, Yew Bow for Archery, Spark Wand for Magic. As today it wears a steel breastplate and carries every other plain weapon in its backpack, with the shield if its hands are full, so what it holds is a default and not a limit.

### 4.6 The ready-made party (R2)

Three of today's four, each the specialist of one skill. Corwin, the second swordsman, goes.

| | Aldric | Brenna | Delwyn |
| --- | --- | --- | --- |
| Portrait | knight | ranger | wizard |
| Str / Per / End / Int / Agi / Luck | 7 / 4 / 7 / 4 / 6 / 7 | 4 / 7 / 5 / 7 / 7 / 5 | 3 / 5 / 4 / 9 / 6 / 8 |
| Tag, with all 10 points | Melee Weapons | Archery | Magic |
| Perks | Weapon Training, Toughness, Heavy Hand | Marksmanship, Deadly Aim, Dodger | Magic Arrow, Arcane Study, Keen Eye |
| Tagged skill | 13 + 20 + 20 + 5 = **58%** | 14 + 20 + 20 + 5 = **59%** | 18 + 20 + 20 + 5 = **63%** |
| Was | 76% | 78% | 76% |

Their attributes are today's. They are written as drafts and built by the same function as a created character, so a test can hold them to the rules of creation (A2).

### 4.7 Slots and saving (R11)

Three slots, numbered 1 to 3. A playthrough lives in one slot from Begin to its end.

- **Begin** takes the first empty slot. If none is empty, the party screen shows the three slots and asks which to overwrite; Back returns to the roster.
- **On the world map** the game is saved when the scene opens (from the party screen, from a battle, from a load) and after everything that changes it: a journey, scouting or waiting, and the closing of the character panel.
- **In battle** it is saved each time the player's turn begins, the first turn included. At that moment nothing is animating and no unit is half-way through anything, so the save is a whole turn's starting point.
- **A victory** is saved as it happens, with its loot, experience and cleared location, before the player presses OK. A reload on the victory screen opens the world map with the win kept.
- **A defeat** takes the battle out of the slot and leaves the world map as it was saved before the attack. Continue then opens the map with the party standing before those monsters, as wounded as it arrived, free to scout or wait and walk away. (Assumption 1.)

If the browser refuses the write, play goes on and the world map's message line, or the battle log, says once: "The game could not be saved."

### 4.8 Continue and Load (R12)

The title menu is **New, Continue, Load, Options**.

- **Continue** loads the readable slot written last, and is disabled when there is none. Over a paused game (Esc) it resumes that game, as today: the paused game is the latest save, so the button means one thing.
- **Load** swaps the buttons for the three slots and Back, as Options does for the sliders. A row reads, for example:

  ```
  1  Aldric, Brenna, Delwyn    Level 2    Turn 14    12 Oct 21:40
  2  Mira                      Level 1    Turn 3     In battle: Goblin Raiders
  3  Empty
  ```

  A filled row loads its game; an empty or unreadable one ("Unreadable save") does nothing. Level is the party's highest.
- Loading stops whatever game was paused under the menu and starts `World`, or `Battle` when the slot holds a battle. Nothing is lost by it: the game left behind is already in its own slot.
- **New** from over a paused game likewise leaves that game in its slot.

A battle that is loaded shows the board as the engine has it, the fallen as fallen, the ground's piles, the log refilled from the engine's events, and the player in control.

## 5. Technical design

Paths marked *(new)* are proposed.

### 5.1 Skills and perks

- [`skills.ts`](../../src/character/skills.ts): the three `base` formulas of section 4.3. `skillLevel` adds `perkBonus(character, skill)`.
- [`perks.ts`](../../src/character/perks.ts): `PerkEffects` gains a key for each skill id (`extends Partial<Attributes>, Partial<Record<SkillId, number>>`), read only by `skillLevel`. Three entries and eight changed `level`s, per section 4.4. The new entries go before the Gain perks, which stay last for `autoAdvance`. `skills.ts` already imports `perks.ts` for `attributesOf`; the call is made inside a function, so the cycle stays safe.
- [`progression.ts`](../../src/character/progression.ts): `AUTO_PERKS` gains the three skill perks after the combat ones. `autoAdvance` is otherwise unchanged; it now also has something to do for a created character with points left.
- **Perk tree**: the three perks make it 10 rows (Strength 2, Perception 2, Endurance 1, Intelligence 3, Agility 1, Luck 1), and the panel holds 7. `TREE_ROW_H` goes from 46 to 33 and `NODE_H` from 36 to 28, which fits 10 in the same 330px. The tree's game objects move out of `InventoryScene` into `src/scenes/PerkTreeView.ts` *(new)*: like `PartyColumn`, a helper that imports Phaser, has no logic of its own, and is shared by the two scenes that draw the tree. It is given a character, whether a click may take a perk, and a callback for a click on a node.

### 5.2 Creation rules: `src/character/creation.ts` *(new)*

```ts
export const CREATION_ATTRIBUTE_POINTS = ATTRIBUTE_POINTS - ATTRIBUTE_IDS.length * MIN_ATTRIBUTE // 29
export const CREATION_SKILL_POINTS = 10
export const CREATION_PERK_PICKS = 3
export const MAX_NAME_LENGTH = 12

/** What the player has chosen so far. Plain data; the scene holds one and replaces it on every change. */
export interface CharacterDraft {
  name: string
  portrait: PortraitId
  attributes: Attributes
  tagged: SkillId | null
  /** Skill points placed in each skill, not percent: a change of tag changes what they are worth. */
  raises: Record<SkillId, number>
  /** Perks chosen, a rank an entry, in the order taken. */
  perks: PerkId[]
}

export function newDraft(): CharacterDraft                       // all attributes 1, nothing chosen
export function attributePointsLeft(draft: CharacterDraft): number
export function skillPointsLeft(draft: CharacterDraft): number
export function perkPicksLeft(draft: CharacterDraft): number
/** Every reason the draft cannot become a character, in step order; empty when it can. */
export function draftProblems(draft: CharacterDraft, takenNames: readonly string[]): string[]
/** The character the draft makes. Total: an unfinished draft makes an unfinished character, for the summary. */
export function draftCharacter(draft: CharacterDraft): Character
/** The draft without the perks that no longer qualify, and the ids dropped. */
export function pruneDraft(draft: CharacterDraft): { draft: CharacterDraft; dropped: PerkId[] }
```

`draftCharacter` is the one place a draft becomes numbers:

1. `createCharacter(name, build)` with the draft's portrait and attributes, its tag (none if not yet chosen), no perks, and the hands of `STARTING_KIT[tagged]` (the melee kit while there is no tag).
2. `skillPoints = CREATION_SKILL_POINTS`, then `raiseSkill` once for each point in `raises`.
3. `perkPicks = CREATION_PERK_PICKS`, then `takePerk` for each of `perks` in order; one that is refused is skipped.
4. `hp = maxHp`.

What is left in `skillPoints` and `perkPicks` is what the character keeps (R10). Because the steps are `raiseSkill` and `takePerk`, creation has no rules of its own about what a point or a perk does.

`pruneDraft` runs step 3 and reports the skipped. The scene calls it after every change and shows `dropped`. Taking a perk back is removing its last entry from `perks` and pruning; if that would drop another, the scene refuses the click instead ("Far Shot asks for it").

`draftProblems` checks: attribute points left over or overspent; an attribute outside 1 to 10; no tag; more skill points placed than there are; more perks than picks; a name that is empty after trimming, too long, or in `takenNames`. Unspent skill points and picks are not problems.

`Build.tagged` is already a list, so no tag is `[]`. `STARTING_KIT: Record<SkillId, { mainHand: Item; offHand?: Item }>` lives beside `createCharacter` in `character.ts`.

### 5.3 Party and game state

- [`party.ts`](../../src/game/party.ts): `STARTING_HEROES` becomes `READY_MADE: readonly CharacterDraft[]` (section 4.6) and `newParty()` becomes `readyMadeParty()`, mapping `draftCharacter` over it. `STARTING_PARTY_LIMIT = 3`. `joinParty(party, character, limit)` refuses at `limit`; `MAX_PARTY_SIZE` (6) stays as the most a limit can ever be, which is what `PARTY_START` has hexes for. `removeMember(party, index)` splices.
- [`gameState.ts`](../../src/game/gameState.ts): `GameState` gains `partyLimit: number` and `slot: SlotId | null`. `newGame(party = readyMadeParty(), slot = null)`. A game with no slot is never saved: that is the simulator's, the tests', and a scene started without data.
- [`scripts/simulate.ts`](../../scripts/simulate.ts) calls `readyMadeParty()`; no flag changes.

### 5.4 Save format: `src/game/save.ts` *(new)*

Phaser-free and storage-free: it turns a game into a string and back.

```ts
export const SAVE_VERSION = 1

/** One slot's contents. */
export interface SaveFile {
  /** The game as it last stood on the world map. */
  world: GameState
  /** The battle being fought, if any, with the game as it stands inside it. */
  battle: SavedBattle | null
  /** When it was written, in milliseconds since the epoch: what Continue goes by. */
  savedAt: number
}

export interface SavedBattle {
  /** The monster location's id in `game.world`. */
  location: string
  /** The party mid-battle: gear changed since the attack is here and not in `SaveFile.world`. */
  game: GameState
  engine: BattleSnapshot
  /** Where the enemy policy's RNG stands. */
  enemyRng: number
  ground: GroundPile[]
}

export function serializeSave(file: SaveFile): string
/** Null for anything that is not a save of this version, or names an item or perk the game does not have. */
export function parseSave(raw: string | null): SaveFile | null
/** What the Load list shows of a slot. */
export function saveSummary(file: SaveFile): { names: string[]; level: number; turn: number; battle: string | null; savedAt: number }
```

- The string is JSON of `{ version, ...file }` with one substitution: every `Item` is written as its `id`. Items appear in a character's `equipment` and `backpack`, in `baggage`, in a monster location's `loot` and in the ground's piles. `parseSave` turns each id back into the constant through `itemById`, so identity comparisons hold after a load and an item's tuning reaches old saves.
- [`inventory.ts`](../../src/inventory/inventory.ts) gains `itemById(id): Item | undefined`, over `WEAPONS`, `MAGIC_ITEMS`, `OAK_SHIELD` and `STEEL_ARMOR`. A test checks that every item a new game can hold (kits, backpacks, loot) is found.
- Everything else in `GameState` is already plain data and is written as it is. `parseSave` checks the version, the top-level shape, every item id and every perk and skill id; it does not otherwise audit numbers it wrote itself.
- Two copies of the game while a battle is on are a few kilobytes and are what lets a defeat fall back to the map (section 4.7) though battle gear changes edit characters in place.

### 5.5 Slots: `src/game/saveSlots.ts` *(new)*

```ts
export const SLOT_IDS = [1, 2, 3] as const
export type SlotId = (typeof SLOT_IDS)[number]

export function readSlot(slot: SlotId): SaveFile | null | 'unreadable'   // null: empty
export function writeSlot(slot: SlotId, file: SaveFile): boolean          // false: the browser refused
export function latestSlot(): SlotId | null                               // the readable slot with the greatest savedAt
export function firstEmptySlot(): SlotId | null
```

Keys are `yomi.save.1` to `yomi.save.3` in `localStorage`, reached through the same guarded `storage()` as the audio settings; that function moves to a small shared module, `src/storage.ts` *(new)*, which both import. Tests run against a stand-in `Storage` set on `globalThis`.

Two helpers keep the scenes from assembling files:

```ts
/** Saves the game as it stands on the world map; drops any battle from the slot. */
export function saveWorld(game: GameState): boolean
/** Saves a battle at the start of the player's turn, keeping the slot's world map save. */
export function saveBattle(game: GameState, battle: Omit<SavedBattle, 'game'>): boolean
/** A lost battle: the slot goes back to its world map save. */
export function dropBattle(slot: SlotId): boolean
```

Each returns true and does nothing when `game.slot` is null. `saveBattle` reads the slot for its `world` part; if that is missing it writes the game as both.

### 5.6 The engine and its dice

- [`rng.ts`](../../src/combat/rng.ts): `mulberry32` returns a `SeededRng`, an `RNG` with a `state(): number` method. The generator's whole state is one integer, and `mulberry32(rng.state())` carries on the same stream, which a test pins.
- [`battleEngine.ts`](../../src/engine/battleEngine.ts):

  ```ts
  export interface BattleSnapshot {
    board: BoardSize
    units: UnitRecord[]        // exported for this; stats included
    round: number
    phase: Phase
    winner: Side | null
    seq: number
    events: BattleEvent[]
    rng: number
  }
  snapshot(): BattleSnapshot                       // a deep copy; throws for an engine given its own `rng`
  static restore(snapshot: BattleSnapshot): BattleEngine
  ```

  `restore` builds the engine without running the constructor's start of battle: no `battle_start` is recorded and no turn is started. The events are unchanged in shape, so `LOG_SCHEMA_VERSION` stays 14; a restored battle's log is the same log, carried on.
- A snapshot may be taken at any time, but the game only takes one in the player's phase with nothing pending (section 4.7).

### 5.7 Scenes

- **`MenuScene`**: buttons New, Continue, Load, Options; a third view (the slot list) beside the main buttons and the options. `onNew` starts `Party`. Continue resumes the paused scene if there is one, else loads `latestSlot()`. Loading a `SaveFile`: stop the paused scene if any; with `battle`, `scene.start('Battle', { game: battle.game, location: battle.location, saved: battle })`, else `scene.start('World', { game: world })`. The loaded `GameState` carries its `slot`.
- **`PartyScene`** *(new, `src/scenes/PartyScene.ts`, key `Party`)*: the choice, the roster and the overwrite prompt, three views of one scene. Its data is `{ party?: Party }`: absent shows the choice, present shows the roster, which is how `Creation` returns to it. It holds the party being built and nothing else; `joinParty` and `removeMember` do the work.
- **`CreationScene`** *(new, `src/scenes/CreationScene.ts`, key `Creation`)*: data `{ party: Party }`. Holds a `CharacterDraft` and the step shown; every control calls a function of `creation.ts` and redraws from `draftCharacter(draft)`. The perk step is a `PerkTreeView` over that character. Create and Cancel both `scene.start('Party', { party })`. The panel is 720×500, centred, as the character panel is, so it fits the 840×560 minimum.
- **`WorldScene`**: calls `saveWorld(this.gameState)` at the end of `create`, after `travel` and `linger`, and on the resume that follows the character panel. A false return sets the message line once.
- **`BattleScene`**:
  - Every battle is seeded: the page's seed if it gives one, else `randomSeed()`, to the engine and, plus one, to the enemy's RNG. `Math.random` is no longer a battle's source of anything, so every battle can be saved, and replayed from its log.
  - `create` with `saved` takes the engine from `BattleEngine.restore(saved.engine)`, the enemy RNG from `mulberry32(saved.enemyRng)` and the ground from `saved.ground`; it still builds the encounter from the location for `kinds` and `xpReward`, and discards that encounter's setup. Units are drawn from `engine.getState()`, the log is refilled by `formatEvent` over `engine.getLog()`, and `loggedEquipment` is taken from the characters.
  - Where the scene hands control to the player at the start of a player phase, it calls `saveBattle`. `Ground` gains `fromPiles(piles)` to go with `piles()`.
  - `endBattle`: on a win, after the loot, the cleared location and the reward, `saveWorld(this.gameState)`; on a loss, `dropBattle(slot)`.
- **Probes** ([`src/testHook.ts`](../../src/testHook.ts)): `MenuProbe` gains `buttons.load`, `showingLoad` and `slots` (a button and its summary line each); `PartyProbe` (view, a row for each place with its name and its Remove or Create button, Begin, Back, the two choices, the overwrite slots) and `CreationProbe` (step, the draft, points left of each kind, every ± and Tag button, the tree's nodes, the portraits, Next, Back, Create, Cancel, the problem shown) join `Probes`.

### 5.8 Retune (R13)

The party is a quarter smaller and hits about 18 points less often at level 1, with three perks each to set against that; a level's skill points close the gap in two or three levels. The retune is a campaign run, as `CLAUDE.md` says, in this order:

1. Run `--campaign --battles 1000 --seed 1` with nothing else changed, for the starting figure.
2. Move `FOES_AT_THREAT` first. The last party of three fought 2, 3, 3, 3, 4, which is the place to start.
3. Only if no row of foe counts lands near 2 in 3, move what a level adds to a monster (`foeAtLevel`).
4. Check the single cells `CLAUDE.md` quotes (`--encounter --threat --party-level`) and rewrite its paragraph with what was found, including the fresh party's rate at each threat.

The creation budgets (29, 10, 3) and the skill formulas are the design's and are not levers of the retune. If threat 1 stops being winnable by a fresh party, that is a finding to bring back, not something to fix by raising skills.

### 5.9 `CLAUDE.md`

In the same commits as the code: the scene flow (`Boot` → `Menu` → `Party` ⇄ `Creation` → `World` ⇄ `Battle`, and Continue and Load); the new modules (`creation.ts`, `save.ts`, `saveSlots.ts`, `storage.ts`, `PerkTreeView.ts`); the rules of characters (the skill formulas, three starting perks, skill perks, "no character creation yet" removed, `STARTING_HEROES` replaced); the party of three and its limit; a paragraph of rules of saving (when, what a slot holds, what defeat does, items by id, `SAVE_VERSION` to be raised when the shape of `GameState`, `Character` or `BattleSnapshot` changes); the simulator's "new game's party" reworded; the rules of scaling rewritten. `e2e/CLAUDE.md` gets the new journeys.

## 6. Consequences

- **A reload rewinds to the start of the turn.** The dice are saved where they stood, so the same actions give the same results, but a player may reload and try other actions. Saving after each of the player's actions as well would close that; it is one more call to `saveBattle` and is left out because a turn was what was asked for.
- **Saves break when the saved shapes change.** Until there is migration, a change to `GameState`, `Character`, `WorldState` or `BattleSnapshot` must raise `SAVE_VERSION`, and the saves before it read as unreadable. Rules and item numbers can change freely: characters store no derived number and items are saved by id. A battle in progress does hold derived stats (the engine's stat blocks), which stay as they were until that battle ends.
- **The world is saved whole**, locations and all, not as a list of what was cleared, so a later change to `newWorld()` reaches only new games.
- **Size**: a world map save is a few kilobytes. A battle adds the engine's event log, some tens of kilobytes late in a long fight, written once a turn. Three slots stay far inside `localStorage`'s five megabytes.
- **Early perks are stronger perks.** A level 1 character with Toughness or Dodger is sturdier than today's, and the first picks no longer wait for level 3. The retune absorbs it; level 3's pick now more often goes to a second rank or a Gain perk.
- **Low untagged skills** make a hero's off-weapons nearly useless at first (10% before armour). That is intended by the request; it also means the spare weapons in a new character's backpack matter less than they did.
- **Tests that name the four heroes or their numbers change**: `party.test.ts`, `character.test.ts`, `skills.test.ts`, `perks.test.ts`, `perkTree.test.ts` (10 rows), the simulator's tests, and the in-browser tests that count on `WINNING_SEED` winning at the Goblin Raiders, which must be checked again with the new party.
- **Seeding every battle** changes nothing a player sees and makes every battle's log replayable, which it was only with a seed in the address.

## 7. Verification

Domain tests (Node):

- `creation.test.ts`: the budgets; each problem of A5; `draftCharacter` leaves unspent points and picks on the character (A8); a tag change re-prices `raises`; `pruneDraft` drops and reports (A7); perks at creation obey level and requirements (A6).
- `skills.test.ts`, `perks.test.ts`: the new bases; a skill perk adds to `skillLevel` and counts towards Magic Arrow's 50%.
- `party.test.ts`: the ready-made three are problem-free drafts with the numbers of A3; `joinParty` at the limit (A4).
- `save.test.ts`: round trips on the map and in battle with item identity (A9); unreadable input of every kind (A14); `itemById` covers a new game.
- `saveSlots.test.ts`, with a stand-in storage: empty, written, latest, first empty, a storage that throws; `saveBattle` keeps the world part and `dropBattle` restores it.
- `rng.test.ts`: `mulberry32(rng.state())` continues the stream.
- `battleEngine.test.ts`: A12, with the snapshot passed through `JSON.stringify`; a restored engine records no second `battle_start`; `snapshot` throws for a scripted RNG.

Scene smoke tests (`scenes` project): `PartyScene.test.ts` and `CreationScene.test.ts`, as the others.

In-browser tests (`npm run test:browser`):

- `driver.newGame()` goes New → Ready-made → Begin, so the existing journeys stand.
- `party.test.ts` *(new)*: A1; remove a ready-made member and create one in its place through all four steps, then Begin and find it in the party's column (A4); Create disabled until the draft is whole (A5).
- `saves.test.ts` *(new)*: A10, A11, A13 and A15, using `page.reload()`, which keeps the context's storage; A14 by writing a bad value into `localStorage` before the menu opens.

Balance: A16, with the campaign's printed summary pasted into the plan's completion log.

## 8. Assumptions and open questions

None blocks planning. The first three are the ones where another answer changes the build.

1. **Defeat sends the slot back to the world map before the attack.** The alternatives: delete the slot (a lost party is lost, as "the journey ends here" says today), or leave the save at the start of the last turn (which can leave a slot that loads straight into a lost battle). The first needs no second copy of the game in `SaveFile`; the choice made is the forgiving one.
2. **Corwin is the hero dropped**, leaving one specialist for each skill, and the ready-made heroes keep today's attributes.
3. **Starting gear follows the tag** and is not chosen.
4. **The numbers**: 29 attribute points (the present total of 35), 10 skill points, 3 picks, bases of `strength + agility`, `perception + agility` and `2 × intelligence`, a tag still worth 20, skill perks of 5% and two ranks. They give 58 to 63% for the ready-made three; each is a constant.
5. **Unspent creation points carry into the game** instead of being required or lost.
6. **A new game takes the first empty slot** and asks only when all three are full.
7. **A party may begin with fewer than three**, down to one.
8. **Created characters cannot be edited**, only removed and made again.
9. **The battle save is once a turn**, not after each action (section 6).
10. **Names** are typed on the keyboard, 12 characters at most, unique in the party.

Risks: the perk tree at 33px a row has not been drawn, and if node labels crowd, the tree needs the scrolling the magic design put off. The retune may show that three level 1 heroes at 60% cannot open the campaign against two goblins, in which case the budgets of assumption 4 are what to revisit.
