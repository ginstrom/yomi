# Encampment facilities: the workshop and the infirmary

## 1. Purpose and status

The encampment has two facilities, the guild hall and the shrine. The blight design left two more to this document ([blight.md](blight.md) §4.6, §9): the **workshop**, for crafting, and the **infirmary**, for recovery. This design adds both as encampment facilities, built and raised from the stock like the others.

- **The workshop** turns plain gear into specialised variants, each with a tradeoff. Its recipes spend the far materials that nothing buys today (copper, crystal), so pushing the blight back pays off in gear as well as influence.
- **The infirmary** makes a visit home worth more: wounds heal faster at the encampment, and at its top level its supplies quicken healing in the field too.

**Status: ready for planning.** The facility rules, recipe list and technical shape are settled enough to plan. Commerce and quests, which the earlier version of this document proposed, are open questions (§9) and are not part of the scope. Costs, recipe numbers and healing rates are starting points for the simulator, not decisions.

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
| Towns, trade, quests | Towns removed; trade and quests open (§9) |
| Workshop, infirmary | This design |

## 2. Requirements and scope

| ID | Requirement |
| --- | --- |
| R1 | The encampment screen shows the workshop and the infirmary as facilities, on the two free plots, each built and raised with the stock at the encampment, with its effect, next level and cost shown as for the guild hall and shrine. |
| R2 | The workshop, once built, opens a screen listing the recipes its level allows and the items the party could work. |
| R3 | A recipe turns one plain item into one variant for a cost in stock. It shows the item's stats before and after, with attack AP and the attacks a turn it buys, before the player confirms. |
| R4 | The workshop works items in the baggage and items worn or carried by party members. A worked item's variant takes its place: the same slot, backpack place or baggage place. Reserves' gear is not offered. |
| R5 | Enchanted items and variants cannot be worked. Working is permanent. |
| R6 | Each variant is better at something and worse at something else than its base. None is better in every stat. |
| R7 | The infirmary raises what a day's camping at the encampment heals, by level; at its top level it also raises what a day's camping heals elsewhere. |
| R8 | Every action validates before it changes anything; a refusal says why and changes nothing. |
| R9 | The rules stay Phaser-free, deterministic, and in the domain layer; the world map rolls nothing for them. |
| R10 | Facility levels and crafted items are saved and loaded. |
| R11 | The campaign simulator builds and uses both facilities, so balance runs measure them. |

**Non-goals:** making items from nothing; dismantling; random affixes; working enchanted items; reworking a variant; buying or selling (§9); quests (§9); resurrection, which the guild hall design reserves for very high levels; working an item away from the encampment.

## 3. Current system

Inspected facts:

- [`encampment.ts`](../../src/game/encampment.ts) lists the facilities (`FACILITIES`: `guild_hall`, `shrine`), each with its level, effect, cost and `improve`, and `improveFacility` dispatches to the facility's own module. `improveRefusal` refuses away from the encampment or without the stock. A facility with `opens: true` has a screen of its own.
- [`encampmentView.ts`](../../src/scenes/encampmentView.ts) draws each facility on a plot. `PLOTS` has four; two are free. Sprites are `camp_<facility>` with `level_N` frames ([`art/encampment/`](../../art/encampment/)).
- [`buildings.ts`](../../src/game/buildings.ts) has the stock's arithmetic (`canAfford`, `spend`, `describeCost`), `atEncampment`, and the shrine's levels in `WorldState.shrine`. [`guildHall.ts`](../../src/game/guildHall.ts) keeps its level in `WorldState.guildHall`.
- [`territory.ts`](../../src/game/territory.ts): the stock is `Partial<Record<Material, number>>` over gold, iron, timber, silver, stone, salt, copper, crystal and peat. The guild hall and watchtower spend gold and iron, the shrine gold and silver, the outpost gold and timber. **Stone, salt, copper, crystal and peat buy nothing.** Home is at (9, 19); the iron vein and timber stand are close, peat and silver middling, stone, salt and copper far, crystal beside the Source.
- [`camp.ts`](../../src/game/camp.ts): a day's camping (`campDay`) passes a world turn, heals every member `NATURAL_HEALING_PER_DAY` (1) and fills mana; `campUntilHealed` casts heals and camps until whole or interrupted. Allowed anywhere not among monsters, the encampment included. Heroes coming out of the reserves are already rested (`guildHall.ts`, `rested`).
- [`inventory.ts`](../../src/inventory/inventory.ts): items are catalog values with fixed `ItemStats`, found by id through `itemById` (`ITEMS_BY_ID`, over `WEAPONS`, `MAGIC_ITEMS`, the shield and the breastplate). With 8 AP, an attack cost of 4 or less buys two attacks a turn; armour piercing is the melee answer to armour. The plain gear: dagger (3 AP), shortsword (4), longsword (5, 1d8+3, pierces 15%), battle axe (6, 1d12+2, 25%), greatsword (7, two-handed), yew bow (4 AP, range 5, two-handed), oak shield (+10 AC), steel breastplate (+15 AC).
- [`save.ts`](../../src/game/save.ts) saves items by catalog id, so any item registered with `itemById` saves without a format change. `SAVE_VERSION` is 9; a new `WorldState` field breaks the format, which the project allows ([guild-hall-and-watchtowers.md](guild-hall-and-watchtowers.md) §6).
- Gear changes on the world map go through the Inventory scene, with the baggage as its ground (`WorldScene.ts`). The dead's gear lands in the baggage (`buryFallen`).
- The simulator (`scripts/simulate.ts`) fights with its parties' starting gear and never uses loot. It goes home on `hallErrand` and spends there in `visitGuildHall`. Its target is beating the Source about 2 times in 3; trips home from the eastern front run to some 65 days.

## 4. Proposed behaviour

### 4.1 The workshop

Built and raised at the encampment, no time passing, like the shrine. Levels (provisional costs, chosen so each level asks for land further out):

| Level | Cost | Brings |
| --- | --- | --- |
| 1 | 25 gold, 15 iron | Tier 1 recipes |
| 2 | 40 gold, 15 stone, 10 copper | Tier 2 recipes |
| 3 | 60 gold, 10 crystal | Tier 3 recipes |

The facility `opens`: its Enter button shows the workshop screen. The screen lists:

- **Items it could work:** each party member's worn and carried items with a recipe, by member, then baggage items with a recipe. (A new hero carries every plain weapon in their backpack, so the party starts with plenty to work.) An item with recipes only at a higher level is listed greyed, saying the level it needs.
- **For the chosen item, its recipes:** the variant's name, its cost, and its stats beside the item's own (`describeItemStats` for each). Where the attack AP differs or the attacks a turn change, say so: "2 attacks a turn → 1".
- **Work it:** confirms "This cannot be undone", spends the stock and puts the variant where the item was: the same member's same slot or backpack place, or the same baggage place. No time passes.

Refusals, each with its reason: not at the encampment; workshop not built or too low a level; not enough stock; the item has no such recipe; the selection is stale (§5.3).

### 4.2 The recipes

A variant keeps its base's slot, icon, two-handedness and the skill it strikes with. It changes two or three stats, one for the better and one for the worse, and the tradeoffs follow the weapon rules: whether an attack costs 4 AP or less, how much armour a blow pierces, range for the bow. No recipe moves the bow off 4 AP, which would cost it its second shot.

| Tier | Base | Variant | Change from the base | Cost |
| --- | --- | --- | --- | --- |
| 1 | Iron Longsword | Balanced Longsword | to hit +10; damage 1d8+3 → 1d8+1 | 10 gold, 5 iron |
| 1 | Iron Battle Axe | Bearded Axe | pierces 25% → 40%; damage 1d12+2 → 1d12 | 10 gold, 5 iron |
| 1 | Yew Bow | Recurve Bow | damage 1d6 → 1d6+1; range 5 → 4 | 10 gold, 5 timber |
| 2 | Iron Longsword | Light Longsword | 5 AP → 4; damage 1d8+3 → 1d6; pierces 15% → 5% | 15 gold, 5 copper |
| 2 | Oak Shield | Tower Shield | AC +10 → +15; to hit −5 | 15 gold, 5 copper, 5 stone |
| 2 | Iron Dagger | Stiletto | pierces 20% → 40%; damage 1d4 → 1d3 | 15 gold, 5 copper |
| 3 | Yew Bow | Longbow | range 5 → 7; to hit −5 | 20 gold, 5 crystal |
| 3 | Steel Breastplate | Crystal-set Breastplate | AC +15 → +20; to hit −5 | 20 gold, 5 crystal |
| 3 | Steel Greatsword | Runed Greatsword | critical +10; 7 AP → 8 | 20 gold, 5 crystal |

R6 holds by construction: each row has a gain and a loss. Whether each is worth having is the simulator's question (§7). Light Longsword is the one to watch: two blows a turn are worth more than their damage suggests.

### 4.3 The infirmary

Built and raised at the encampment, no time passing.

| Level | Cost | Effect |
| --- | --- | --- |
| 1 | 20 gold, 10 timber | A day camped at the encampment heals each member a third of their maximum hit points (rounded up), not 1. |
| 2 | 40 gold, 15 peat | At the encampment, a day heals every member fully. |
| 3 | 60 gold, 20 salt | Also, field dressings: a day camped anywhere else heals each member 3, not 1. |

The levels do different things rather than add percentages. Levels 1 and 2 make a trip home, already made for the guild hall and shrine, double as recovery. Level 3 is the one that changes the field, and it asks for salt from the far south. Camping still fills mana as before; casting heals (`autoHeal`) is unchanged. The infirmary cannot raise the dead.

## 5. Technical design

### 5.1 State

`WorldState` gains `workshop: number` and `infirmary: number`, each 0 (not built) to 3, set to 0 by `newWorld`. `SAVE_VERSION` goes to 10. Crafted items need no state: they are catalog items.

### 5.2 Domain modules (proposed)

- **`src/inventory/crafted.ts`** (proposed): the variant items (`CRAFTED_ITEMS`), defined by spreading their base (`{ ...IRON_SWORD, id: 'balanced_longsword', name: ..., description: ..., stats: { ...IRON_SWORD.stats, toHit: 10, damage: ... } }`). `ITEMS_BY_ID` includes them, so saves and `itemById` find them. They are not in `WEAPONS` (what a new hero carries) or `MAGIC_ITEMS` (loot).
- **`src/game/workshop.ts`** (proposed):
  - `WORKSHOP_LEVELS`, `MAX_WORKSHOP_LEVEL`, `workshopCost(world)`, `upgradeWorkshop(world)`: as the guild hall's.
  - `RECIPES: readonly Recipe[]`, where `Recipe = { id, base: string, result: string, tier: 1 | 2 | 3, cost: Stock }`. Module-load checks in a test: every `base` and `result` resolves through `itemById`, a result's slot equals its base's, no base is enchanted or crafted, and each result is better than its base in at least one stat and worse in one.
  - `recipesFor(item)`: the recipes whose base is the item.
  - `workable(game)`: what the screen lists, `WorkSource[]` with the item and whether the workshop's level allows its recipes.
  - `craft(game, source, recipeId)`: returns a refusal string or null, as `upgradeGuildHall` does. `source` is `{ from: 'baggage', index, itemId } | { from: 'worn', member, slot, itemId } | { from: 'backpack', member, index, itemId }`, where `member` is an index into the party. All checks before any change: at the encampment, the workshop's level ≥ the recipe's tier, the stock affords it, the source still holds an item of `itemId` (a stale selection is refused rather than working whatever moved into the place), and the recipe's base is that item. Then it spends and replaces the item in place.
- **`src/game/infirmary.ts`** (proposed): `INFIRMARY_LEVELS`, `infirmaryCost`, `raiseInfirmary`, and `restHealing(world, member): number`, what a day's camping heals that member where the party stands. `campDay` calls `restHealing` instead of using `NATURAL_HEALING_PER_DAY` directly; at level 0 it returns that constant everywhere, so camping is unchanged until the infirmary is built.
- **`encampment.ts`:** `FacilityId` gains `'workshop'` and `'infirmary'`, and `FACILITIES` an entry each: the workshop with `opens: true`, the infirmary with `opens: false`. Their `effect` lines come from the level tables.

None of this imports Phaser or rolls dice. `restHealing` is arithmetic over `maxHp`.

### 5.3 Scenes

- **Encampment:** two sprites, `camp_workshop` and `camp_infirmary`, with `level_1` to `level_3` frames, on the third and fourth plots. `npm run sprites` and `sprites:check` cover them.
- **Workshop screen** (proposed `WorkshopScene`, opened from the encampment as `GuildHallScene` is, and closing back to it): the list of workable items, the recipes of the chosen one with before-and-after stats, and the Work button with its confirmation. Its state is the domain's `workable` and `craft`; the screen decides nothing. Item icons come from `itemIcons.ts` by the base's icon. It works at the 840×560 minimum and exposes its controls through the scene probes, as the other overlays do.
- **Camping's message** (`describeCamp`) is unchanged; it already reports hit points by rest.

### 5.4 The simulator

- On a home visit (`visitGuildHall`), after the hall and before the shrine: build or raise the workshop if the stock affords it, then work each member's main-hand and shield and armour, best recipe first by a fixed preference list per base (chosen by the comparisons in §7), while the stock lasts. Then raise the infirmary if it affords it.
- `campUntilHealed` uses `restHealing` through `campDay`, so a party that camps at home heals at the infirmary's rate with no new policy.
- The summary adds the workshop's and infirmary's levels at the end, the items worked, and the days camped (already reported), so the effect on campaign length shows.

The simulator's `--player-weapon` takes any id `itemById` finds, so variants can be compared battle by battle like the plain weapons (CLAUDE.md lists the flag as taking ids from `WEAPONS` or `MAGIC_ITEMS`; extend it to `CRAFTED_ITEMS`).

### 5.5 Smaller changes

- `debugCommands.ts`: a command to set a facility's level, for testing.
- The player's manual (`docs/manual/README.md`): the encampment section gains the workshop and infirmary, with a screenshot of the workshop (`npm run manual:screenshots`).
- CLAUDE.md's architecture list gains `workshop.ts`, `infirmary.ts` and `crafted.ts`.

## 6. Consequences

- **Saves:** version 10; older saves are refused, as before.
- **Balance:** the workshop makes the party stronger, and the infirmary shortens or removes healing stops (days the blight would otherwise have) — both push toward the Source sooner. The 2-in-3 target is then restored by the Source's encounter, as with the guild hall, not by the nests' foe counts (`FOES_AT_THREAT`).
- **Going home costs days.** Both facilities only work at home (the infirmary's level 3 aside). That is deliberate: they give the existing trips home more to do, rather than adding trips. If the simulator shows extra trips for crafting alone, consider letting the workshop work the items of a hero who is at home in the reserves, or an order waiting to be fetched (§9).
- **Material use:** after this, every material buys something: stone and copper (workshop 2), crystal (workshop 3), peat and salt (infirmary). The far land then matters to the second loop.

## 7. Phasing and verification

Phases, each playable:

1. **The infirmary:** state, levels, `restHealing`, the facility entry and sprite, the simulator's use of it. Smallest, and it tests the facility plumbing.
2. **The workshop and tier 1:** state, `crafted.ts`, recipes, `craft`, the workshop screen, the simulator's policy.
3. **Tiers 2 and 3** with their variants, then the campaign retune.

Before each recipe is kept, compare it with its base at one cell of scaling: `npm run simulate -- --player-weapon <id> --encounter goblin_raid --threat 3 --party-level 5` against the base's run. Then judge the whole by campaign runs (`npm run simulate -- --campaign --battles 500 --seed 1`) against the current figures (about 69% beat the Source in some 314 days).

| Scenario | Requirements |
| --- | --- |
| At the encampment, build the infirmary and the workshop: the stock falls by the shown cost, each appears on its plot at level 1, and raising each to 3 shows the next effect and cost at every step. Away from home, or without the stock, each is refused with its reason. | R1, R8 |
| Camp a wounded party at the encampment at infirmary levels 0, 1, 2: a day heals 1, a third, then all; at level 3, a day camped elsewhere heals 3. Mana refills in every case. | R7, R9 |
| Open the workshop: worn and baggage items with recipes are listed; those whose recipes need a higher level are greyed with the level. Enchanted items and variants do not appear. | R2, R4, R5 |
| Work one of two longswords in the baggage, a member's worn bow and a dagger in a backpack: only the chosen item changes, in its own place; the member's derived stats change accordingly; the stock falls by the shown cost. | R3, R4, R8 |
| A selection made stale (the baggage reordered, the member's slot emptied) is refused and nothing changes. | R8 |
| Each recipe's preview shows before-and-after stats and any change in attacks a turn; the catalog test confirms every variant is better and worse than its base somewhere. | R3, R6 |
| Save and load after building, raising and working: levels and items are as they were. | R10 |
| The simulator's campaign summary reports workshop and infirmary levels and items worked. | R11 |

Tests: domain tests for the level tables, `restHealing`, `craft`'s refusals and atomicity, and the catalog checks; a save round trip; a scene test that the workshop screen starts and closes back to the encampment; browser tests for entering the workshop from the encampment and working an item. Run `npm test`, and `npm run test:browser` after the scene changes.

## 8. Assumptions

1. **Variants are catalog items**, not per-item state: no mutable stats, no affixes. Two identical swords are worked independently by where each lies.
2. **The party's worn and carried gear can be worked directly**, not only the baggage, since trips home are long and moving gear to the baggage first adds nothing.
3. **Working takes no time**, like raising the shrine; building takes none either. The days are in getting home.
4. **Reserves' gear is not offered**, to keep the screen to the party and the baggage. The reserves can be swapped in first.
5. **The level 3 infirmary is the only effect away from home.**

## 9. Open questions

None blocks the scope above.

1. **Commerce.** The towns that would have held shops are gone. If wanted, it is a facility, a trading post: selling turns the baggage's surplus (the dead's gear, loot no one uses) into gold, which the stock now has uses for. Buying is less clear, since held land supplies the stock; buying plain gear would feed the workshop. To decide: whether to have it, and whether it sells only or buys too.
2. **Quests.** With no towns there are no quest givers, and most nests are spawned rather than placed. If wanted, quests would be authored objectives on fixed nests or sites, delivered by the story system (`src/story/`, a `StoryMoment` and a cutscene) and rewarded from the stock or with a recipe. The blight already gives the player goals; quests would need to give something it does not, such as unlocking a recipe or a facility level. To decide: whether to have them.
3. **Working away from home.** If the simulator shows trips made for crafting alone, an outpost could take orders to be fetched, or the workshop could work the gear of heroes in the reserves.
4. **Making plain items**, for recruits or to feed the workshop, waits on commerce: buying them would do the same job.
