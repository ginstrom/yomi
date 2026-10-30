# Encampment facilities: the trading post, the workshop and the infirmary

## 1. Purpose and status

The encampment has two facilities, the guild hall and the shrine. The blight design left the rest of the encampment to this document ([blight.md](blight.md) §4.6, §9). This design adds three more, and with them a **gear ladder**: today the plain gear is one flat set, and better items come only as loot.

- **The trading post** sells gear for gold and buys whatever the party no longer needs. Its levels sell better grades of gear.
- **The workshop** modifies gear: each modifier trades one stat for another, and its grade rises with the workshop's level. A few modifiers can be made in the field, with no building at all.
- **The infirmary** heals faster at the encampment, and at its top level in the field too.

Together they make the blight's second loop ("develop the encampment → more power → tougher foes") a loop of buildings *and* gear: held land yields gold and materials, the buildings turn them into better gear, and better gear pushes into land that yields more. Gold becomes the contested resource, wanted by the guild hall, the shrine, recruits and gear at once.

**Status: implemented** (commit eee148b; the campaign retune after it). The rest of this section is the design as it was decided. The user chose commerce as a facility, crafting in tiers from the field up through the workshop's levels, and grades that raise what each tier can make; quests are dropped, the blight being enough to drive the game (§9). Costs, prices, stats and healing rates are starting points for the simulator, not decisions.

### History

This file first proposed an "expeditions and encampment" loop: a home camp at Oakvale, towns with trade, three quests, a workshop, and a regional stronghold. Most of it has since been built in other shapes:

| Proposed here | Where it went |
| --- | --- |
| Home encampment at Oakvale | The encampment, the only settlement, named by the player ([blight.md](blight.md), commit 391ca73) |
| Free Rest at home | The field camp, anywhere, at a cost in days (`src/game/camp.ts`) |
| Party capacity from a quest; barracks; reserves | The guild hall ([guild-hall-and-watchtowers.md](guild-hall-and-watchtowers.md)) |
| Scout lodge | Watchtowers and fog of war (same) |
| Named resource sites, announced threats, time pressure | The blight: capture by influence, "falls in Nd", the stock ([blight.md](blight.md)) |
| The regional stronghold | The Source and endless mode ([blight.md](blight.md) §4.10) |
| Town trade | The trading post (this design) |
| Quests | Dropped (§9) |
| Workshop, infirmary | This design |

## 2. Requirements and scope

| ID | Requirement |
| --- | --- |
| R1 | The encampment screen shows the trading post, the workshop and the infirmary as facilities, each with its level, effect, next level and cost, raised with the stock at the encampment as the guild hall and shrine are. |
| R2 | **Gear grades:** every plain item comes in three grades, plain, Fine and Masterwork. A higher grade is better in damage or armour and never changes attack AP or range. |
| R3 | **Buying:** the trading post sells plain items for gold, up to the grade its level allows, into the baggage. |
| R4 | **Selling:** the trading post buys items from the baggage and from party members' backpacks for gold, and surplus materials at a poor rate. It never sells materials. |
| R5 | **Modifiers:** an item can carry one modifier, which makes it better at one thing and worse at another. Working an item that has one replaces it. |
| R6 | **Crafting tiers:** a few modifiers can be made in the field, anywhere the party can camp; the workshop's levels unlock more, and the highest grade of each modifier the party can make equals the workshop's level (the field makes grade 1). |
| R7 | Every craft and trade shows the item's stats before and after (attack AP and attacks a turn included) or the gold it brings, and its cost, before the player confirms. |
| R8 | Enchanted items take no grade or modifier; they can be sold. |
| R9 | **The infirmary** raises what a day's camping heals at the encampment, by level, and at its top level elsewhere. |
| R10 | Every action validates before it changes anything; a refusal says why and changes nothing. |
| R11 | Rules stay Phaser-free and deterministic; nothing rolls dice. |
| R12 | Facility levels and graded or modified items are saved and loaded. |
| R13 | The campaign simulator trades, crafts and uses the infirmary, so balance runs measure the loop. |

**Non-goals:** quests; buying materials; random or rotating shop stock; random affixes; modifying enchanted items; more than one modifier on an item; dismantling; a crafting skill or crafting experience (§8); resurrection.

## 3. Current system

Inspected facts:

- [`encampment.ts`](../../src/game/encampment.ts) lists the facilities (`FACILITIES`: `guild_hall`, `shrine`), each with its level, effect, cost and `improve`; `improveFacility` dispatches to the facility's module, and `improveRefusal` refuses away from the encampment or without the stock. A facility with `opens: true` has a screen of its own, as the guild hall does.
- [`encampmentView.ts`](../../src/scenes/encampmentView.ts) draws each facility on a plot. `PLOTS` has four; two are free. Sprites are `camp_<facility>` with `level_N` frames ([`art/encampment/`](../../art/encampment/)).
- [`buildings.ts`](../../src/game/buildings.ts) has the stock's arithmetic (`canAfford`, `spend`, `describeCost`) and `atEncampment`. [`guildHall.ts`](../../src/game/guildHall.ts) keeps its level in `WorldState.guildHall`, starting at 1.
- [`territory.ts`](../../src/game/territory.ts): the stock holds gold, iron, timber, silver, stone, salt, copper, crystal and peat. The guild hall and watchtower spend gold and iron, the shrine gold and silver, the outpost gold and timber; **stone, salt, copper, crystal and peat buy nothing.** Gold comes from the encampment (2 every `YIELD_DAYS`) and the Gold Seam. Home is at (9, 19): iron and timber close, peat and silver middling, stone, salt and copper far, crystal beside the Source.
- [`camp.ts`](../../src/game/camp.ts): a day's camping passes a world turn, heals each member `NATURAL_HEALING_PER_DAY` (1) and fills mana; `campUntilHealed` casts heals and camps until whole or interrupted, anywhere but among monsters.
- [`inventory.ts`](../../src/inventory/inventory.ts): an `Item` is a constant with fixed `ItemStats`, found by id through `itemById` over `WEAPONS`, `MAGIC_ITEMS`, the shield and the breastplate. With 8 AP, an attack of 4 AP or less buys two a turn; armour piercing is melee's answer to armour. The plain gear: dagger (3 AP), shortsword (4), longsword (5, 1d8+3, pierces 15%), battle axe (6, 1d12+2, 25%), greatsword (7, two-handed), yew bow (4 AP, range 5), oak shield (+10 AC), steel breastplate (+15 AC). No item changes maximum hit points, which keeps `hp <= maxHp` true however gear changes.
- A new hero holds the weapon of their tagged skill, wears a steel breastplate and carries every other plain weapon in their backpack (`creation.ts`, `STARTING_KIT`). The dead's gear goes to the baggage (`buryFallen`); spawns drop an enchanted item half the time.
- [`save.ts`](../../src/game/save.ts) stores each item as its id and restores it through `itemById` as the same constant, so identity comparisons hold after a load. `SAVE_VERSION` is 9; the format may break whenever a change calls for it.
- The world map's character panel changes gear through the baggage (`WorldScene.ts`).
- The simulator (`scripts/simulate.ts`) fights with starting gear and never uses loot. It goes home on `hallErrand` and spends there in `visitGuildHall`. Its target is beating the Source about 2 times in 3; a trip home from the eastern front is some 65 days.

## 4. Proposed behaviour

### 4.1 The gear ladder

An item is a **base** (a plain item), at a **grade**, with at most one **modifier** at a grade of its own.

| Grade | Name | Weapons | Shield, armour |
| --- | --- | --- | --- |
| 1 | (plain) Iron Longsword | as today | as today |
| 2 | Fine Iron Longsword | damage +1 | AC +3 |
| 3 | Masterwork Iron Longsword | damage +2, to hit +5 | AC +6 |

A grade never changes attack AP, range, piercing or two-handedness, so every weapon keeps its place among the AP thresholds.

Grades come from the trading post. Modifiers come from crafting. Enchanted items stand outside the ladder: they keep their fixed stats, take no grade or modifier, and are valued for what they are.

### 4.2 The trading post

Built from the start at level 1, as the guild hall is, so trade is part of the loop from the first visit home. Raised at the encampment, no time passing.

| Level | Cost | Sells |
| --- | --- | --- |
| 1 | (built) | plain items |
| 2 | 40 gold, 15 stone | and Fine items |
| 3 | 80 gold, 15 copper | and Masterwork items |

The facility `opens` its own screen, with two tabs:

- **Buy:** every plain base at every grade the level allows, with its price and its stats; a purchase goes into the baggage. Stock is unlimited.
- **Sell:** the items in the baggage and in the party's backpacks, each with what it fetches; and the stock's materials other than gold, which sell at a poor rate. Worn items are not offered, so nothing a hero fights with is sold by a slip: take it off first in the character panel.

Prices (provisional):

| Base | Plain price |
| --- | --- |
| Iron Dagger | 6 |
| Iron Shortsword | 8 |
| Iron Longsword, Yew Bow | 12 |
| Oak Shield | 10 |
| Iron Battle Axe | 14 |
| Steel Greatsword, Steel Breastplate | 20 |

- A Fine item costs 3 times the plain price and a Masterwork one 8 times.
- An item sells for half its base-and-grade price, rounded down. A modifier adds nothing to what it fetches, so crafting is never a way to make gold.
- Each enchanted item has a fixed value in the catalog (provisional 30 to 60), and sells for half of it. It is never bought.
- Materials sell at 1 gold for every 2, so a surplus of salt or peat is worth something but never a substitute for the land that yields gold.

Refusals: away from the encampment; a grade above the level; not enough gold; a stale selection (§5.3).

### 4.3 Crafting

A craft puts a modifier, at a grade, on an item that is not enchanted. An item already modified loses its modifier for the new one: a modifier can be replaced, by another or by a higher grade of itself, at the full cost of the new one. Nothing is refunded.

**Where it is done:**

- **In the field:** from the world map, anywhere the party may camp. Field crafting makes the field modifiers at grade 1, and takes a day (a world turn, through `passTurn`, which may raise events as camping does).
- **At the workshop:** at the encampment, no time passing. Its level decides which modifiers it makes and the highest grade: a workshop of level L makes every modifier unlocked at or below L, at any grade up to L.

| Workshop level | Cost | Unlocks | Highest grade |
| --- | --- | --- | --- |
| 0 (field) | | Balanced, Recurve | 1 |
| 1 | 25 gold, 15 iron | Bearded, Keen, Braced | 1 |
| 2 | 40 gold, 15 stone | Light, Long, Reinforced | 2 |
| 3 | 60 gold, 10 crystal | | 3 |

So level 1 widens what can be made, and levels 2 and 3 raise the bar on everything already known. That is the "crafting level": the workshop's own, and the materials it asks, not a new skill or experience track.

**The modifiers** (provisional; grade 1 / 2 / 3):

| Modifier | Fits | Better | Worse |
| --- | --- | --- | --- |
| Balanced | shortsword, longsword, greatsword | to hit +5 / +10 / +15 | damage −1 |
| Recurve | bow | damage +1 / +2 / +3 | range −1 |
| Bearded | battle axe | pierces +1 / +2 / +3 points of resistance | damage −2 |
| Keen | dagger, shortsword, longsword | critical +5 / +10 / +15 | damage −1 |
| Braced | shield | AC +3 / +5 / +7 | to hit −5 |
| Light | longsword, battle axe | attack AP −1 | damage −3 / −2 / −1 |
| Long | bow | range +1 / +2 / +3 | to hit −5 |
| Reinforced | breastplate | resistance +1 / +2 / +3 | to hit −5 |

- The worse side is the same at every grade, except Light's, whose grades shrink its cost instead, since its gain (a blow's AP) cannot grow. A Light Longsword strikes for 4 AP, twice a turn: the one to watch in balance runs.
- No modifier moves the bow off 4 AP, so it keeps its second shot.
- No modifier touches maximum hit points.

**What a craft costs:** gold and one material, by grade (provisional):

| Grade | Cost |
| --- | --- |
| 1 | 5 gold, and 5 iron (metal) or 5 timber (bow, shield) |
| 2 | 10 gold, 5 copper |
| 3 | 20 gold, 5 crystal |

**The crafting screen** is the same in the field and at the workshop, told which it is:

- **Items:** each party member's worn and carried items, then the baggage's, that some modifier fits. One whose modifiers all need a higher workshop level is greyed, saying the level.
- **For the chosen item:** each fitting modifier, at each grade allowed here, with its cost and the item's stats beside what they become, saying any change in attacks a turn ("2 attacks a turn → 1") and, when the item already has a modifier, which it replaces.
- **Work it:** confirms, spends the stock, and puts the new item where the old one was: the same slot, backpack place or baggage place. In the field it then passes the day.

Refusals: away from the encampment for a workshop craft, or among monsters for a field one; the modifier not unlocked or the grade too high here; not enough stock; an enchanted item, or one the modifier does not fit; a stale selection.

### 4.4 The infirmary

Built and raised at the encampment, no time passing.

| Level | Cost | Effect |
| --- | --- | --- |
| 1 | 20 gold, 10 timber | A day camped at the encampment heals each member a third of their maximum hit points (rounded up), not 1. |
| 2 | 40 gold, 15 peat | At the encampment, a day heals every member fully. |
| 3 | 60 gold, 20 salt | Also, field dressings: a day camped anywhere else heals each member 3, not 1. |

The levels do different things rather than add percentages. Levels 1 and 2 make a trip home, already made for the guild hall, trade and crafting, double as recovery; level 3 changes the field, and asks for salt from the far south. Camping still fills mana as before, and casting heals (`autoHeal`) is unchanged. The infirmary cannot raise the dead.

### 4.5 Materials after this design

Every material now buys something: iron and timber (field crafts, the workshop), stone (trading post 2, workshop 2), copper (trading post 3, grade 2 crafts), crystal (workshop 3, grade 3 crafts), peat and salt (the infirmary), silver (the shrine). The far land feeds the top of the ladder.

## 5. Technical design

### 5.1 The item model

An item's id says what it is: `<base>[@<grade>][+<modifier><grade>]`, such as `iron_sword`, `iron_sword@2`, `iron_sword+balanced1` and `iron_sword@3+light2`. A plain item's id is unchanged, so the ids in the code today are grade 1 with no modifier. Enchanted items have no `@` or `+`.

- **`src/inventory/inventory.ts`:** `Item` gains optional `base`, `grade` and `mod` (`{ id: ModifierId, grade }`), present on graded and modified items, which the trading post and the crafting screen read. `itemById` parses an id and builds the item from its base, grade and modifier, **memoised**, so the same id always gives the same object and identity comparisons hold after a load. An id that does not parse, a grade outside 1 to 3, a modifier that does not fit its base, or any `@` or `+` on an enchanted item gives `undefined`, which the save reader already treats as unreadable.
- **`src/inventory/grades.ts`** (proposed): the grades (name prefix and what each adds by item kind), and `gradedItem(base, grade)`.
- **`src/inventory/modifiers.ts`** (proposed): `MODIFIERS` (`ModifierId`, name, the bases it fits, its workshop unlock level, and its stat change at each grade), and `modifiedItem(item, mod, grade)`. A modified item's name puts the modifier first and its grade last: "Balanced Fine Iron Longsword (II)". Its icon, slot, skill and two-handedness are the base's.
- A test checks every base × grade × fitting modifier × grade: it builds, round-trips through its id, changes no maximum hit points, a grade changes neither AP nor range nor piercing, and each modifier is better than its unmodified item in one stat and worse in another.

### 5.2 State

`WorldState` gains `tradingPost: number` (1 to 3, starting at 1), `workshop: number` and `infirmary: number` (0 to 3, starting at 0). `SAVE_VERSION` goes to 10. Items need no new state: they are ids.

### 5.3 Domain modules (proposed)

All take the game and explicit inputs, return a refusal string or null as the guild hall's actions do, check everything before changing anything, and import no Phaser.

A selection names where an item is and which item it expects there: `ItemPlace = { from: 'baggage', index, itemId } | { from: 'worn', member, slot, itemId } | { from: 'backpack', member, index, itemId }`, `member` an index into the party. A place that no longer holds an item of `itemId` is refused as stale, rather than acting on whatever moved into it.

- **`src/game/tradingPost.ts`:** levels and costs, `raiseTradingPost`; `PRICES` by base id and `VALUES` for enchanted items; `buyPrice(item)` and `salePrice(item)`; `wares(world)`, the items for sale; `buy(game, itemId)`; `sell(game, place)`, refusing a worn place; `sellMaterial(game, material, amount)`, in pairs, never gold.
- **`src/game/crafting.ts`:** workshop levels and costs, `upgradeWorkshop`; `craftTier(world)`, `'field'` or the workshop's level, given where the party stands (`atEncampment` with a workshop built is the workshop, else the field); `options(game, place)`, the modifiers and grades allowed here with their costs; `craft(game, place, modifierId, grade)`, which spends, replaces the item in its place, and in the field passes the day (`passTurn`), returning the day's events for the scene to report as camping does.
- **`src/game/infirmary.ts`:** levels and costs, `raiseInfirmary`, and `restHealing(world, member)`, what a day's camping heals that member where the party stands. `campDay` calls it instead of using `NATURAL_HEALING_PER_DAY` directly; at level 0 it returns that constant everywhere.
- **`encampment.ts`:** `FacilityId` gains `'trading_post'`, `'workshop'` and `'infirmary'`, with entries in `FACILITIES`: the trading post and workshop `opens: true`, the infirmary `opens: false`.

### 5.4 Scenes

- **Encampment:** three new sprites, `camp_trading_post`, `camp_workshop` and `camp_infirmary`, each with `level_1` to `level_3`. Five facilities need five plots: `PLOTS` gains one, and the clearing's layout is checked at the 840×560 minimum.
- **`TradingPostScene`** (proposed): opened from the encampment as `GuildHallScene` is, closing back to it; Buy and Sell tabs over `wares`, `buy`, `sell` and `sellMaterial`.
- **`CraftingScene`** (proposed): the screen of §4.3, over `options` and `craft`. Opened from the encampment's workshop, closing back to it, or from the world map's footer (a **Craft** button beside Camp, wherever camping is allowed), closing back to the map, which redraws and saves after a field craft as after camping.
- Both screens draw item icons by the base's icon (`itemIcons.ts`) and battle figures show gear by icon (`GEAR_SPRITES`), so no new item art is needed. A grade or modifier mark on the icon is optional polish.
- Both expose their controls through the scene probes and work at the minimum size.

### 5.5 The simulator

On a home visit, after the guild hall and recruits:

1. Sell the baggage (it fights without loot, so all of it is surplus) and surplus materials beyond what its next planned purchases need.
2. Raise the trading post, workshop and infirmary as the stock allows, in that order (provisional, to be tuned).
3. Buy the best grade it can afford of each member's weapon and armour, then craft the best modifier for each by a fixed preference per base, chosen by single-cell comparisons.
4. Raise the shrine with what is left.

In the field, after a win, it field-crafts its preferred grade 1 modifier on a member's weapon if the stock allows and the item has none. `campUntilHealed` uses `restHealing` through `campDay` with no new policy.

The summary adds the facilities' levels at the end, the gold spent on gear and taken from sales, the items crafted, and the field crafts' days. `--player-weapon` accepts any id `itemById` builds, so graded and modified weapons are compared battle by battle as the plain ones are.

### 5.6 Smaller changes

- `debugCommands.ts`: setting a facility's level, and giving an item by any id (which graded and modified ids then reach).
- The player's manual: the three facilities, field crafting, and screenshots of the trading post and crafting screens (`npm run manual:screenshots`).
- CLAUDE.md: the new modules, the item id grammar and its memoisation (the saving rules' "a new item must be in `WEAPONS` or `MAGIC_ITEMS`" becomes "a new base or enchanted item"), the facilities, and the `--player-weapon` flag.

## 6. Consequences

- **Saves:** version 10; older saves are refused, as before.
- **Balance:** the party fights with better gear than the simulator has ever given it, and the infirmary saves healing days. Restore the 2-in-3 target at the Source's encounter, as the guild hall's retune did; do not raise `FOES_AT_THREAT` to hide what the encampment bought.
- **Gold competes.** Gear, the hall, recruits and the shrine all want it. If the simulator leaves the shrine or hall unbuilt, look at gear prices first, then at sales.
- **Going home.** Grades and the best crafts need the encampment, which gives trips home more to do rather than adding trips; field crafting covers the cheap end anywhere, at a day each.
- **Item ids:** generated ids are a grammar in one place (`itemById`). The catalog grows to every combination without hand-written entries; the test in §5.1 keeps them all valid.

## 7. Phasing and verification

Phases, each playable:

1. **The item model and the trading post:** id grammar, grades, prices, selling, buying at all three levels, the facility and its screen, the simulator's trading.
2. **Crafting:** modifiers, field crafting, the workshop and its levels, the crafting screen, the simulator's crafting.
3. **The infirmary:** independent of the others, it can move earlier.
4. **The campaign retune**, at the Source.

Before a grade or modifier's numbers are kept, compare it with its unmodified item at one cell of scaling, as `npm run simulate -- --player-weapon iron_sword+balanced1 --encounter goblin_raid --threat 3 --party-level 5` against `iron_sword`. Judge the whole by campaign runs (`npm run simulate -- --campaign --battles 500 --seed 1`) against the current figures (about 69% beat the Source, in some 314 days).

| Scenario | Requirements |
| --- | --- |
| A new game's encampment shows the trading post at level 1 and the workshop and infirmary as empty plots. Each is built or raised for its shown cost; away from home or without the stock it is refused with its reason. | R1, R10 |
| `itemById` builds every valid graded and modified id, gives the same object twice, and refuses invalid ones; a Fine and a Masterwork longsword have its AP and range, and more damage. | R2, R12 |
| Buy a plain longsword at level 1: the gold falls by its price and it is in the baggage; Fine items are offered only from level 2. Sell a baggage item and a backpack item for half their price, and 4 salt for 2 gold; a worn item is not offered. A stale selection changes nothing. | R3, R4, R7, R10 |
| Sell a Balanced longsword: it fetches the unmodified price. Sell an enchanted item: it fetches half its value; it cannot be crafted. | R4, R8 |
| In the field, craft a Balanced longsword: a day passes and the stock falls; a workshop modifier or grade 2 is not offered. At a level 2 workshop, replace its modifier with Balanced II, then Light I; the preview shows "1 attack a turn → 2". | R5, R6, R7 |
| Camp a wounded party at the encampment at infirmary levels 0, 1, 2 (a day heals 1, a third, all), and elsewhere at level 3 (3 a day). Mana refills in every case. | R9, R11 |
| Save and load after trading, crafting and raising each facility: levels, stock and items are as they were. | R12 |
| The simulator's campaign summary reports facility levels, trade and crafts. | R13 |

Tests: domain tests for the id grammar and catalog checks, prices, every action's refusals and atomicity, field crafting's day, and `restHealing`; a save round trip with graded and modified items; scene smoke tests that the new screens start and close back where they came from; browser tests for buying and selling, crafting at the workshop and in the field, and the encampment's five plots. Run `npm test`, and `npm run test:browser` after the scene changes.

## 8. Decisions and assumptions

Decided by the user:

1. **Commerce** is in scope, as a facility, to make gear and buildings one loop.
2. **Quests** are dropped: more complexity than they are worth, with the blight driving the game.
3. **Crafting comes in tiers:** some with no building, more as the workshop rises, and higher levels raise the bar of what each tier makes.

Assumptions:

1. **The crafting level is the workshop's level.** A crafting skill on characters would mean a fourth skill, new creation budgets, a reworked (full) perk tree and a retune, and a crafter's death would take the crafting with them. Crafting experience would reward crafting junk to level up. Both are left out.
2. **Materials are never sold to the party**, so the far land stays the only way to the top of the ladder.
3. **Worn items cannot be sold**, but can be crafted, since a craft improves what the hero fights with and a sale takes it away.
4. **One modifier an item**, replaceable without refund.
5. **Field crafting costs a day**, the workshop's crafts none: the days are in getting home.
6. **The trading post starts built**, so selling is open from the first trip home.

## 9. Open questions

None blocks planning.

1. **Making plain items in the workshop** rather than buying them: left out, since the trading post supplies them.
2. **A fourth grade, or enchanting**, beyond Masterwork: later, if the ladder runs out before the Source.
3. **Crafting away from home at an outpost:** only if the simulator shows trips made for crafting alone.
