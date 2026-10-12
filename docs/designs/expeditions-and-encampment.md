# Expeditions and a growing encampment

## 1. Purpose and status

Yomi currently rewards battles with experience, levels, and equipment. This design adds a campaign loop that gives the player reasons to choose particular battles and makes their victories change the world:

**Choose a goal → prepare → venture out → fight and recover rewards → return → improve capabilities → attempt a harder goal.**

The long-term backbone is a growing player encampment. Town relationships and quests provide access to people and services; crafting provides deliberate equipment choices; territory eventually provides strategic commitments and resources. These systems should feed the tactical game and give the player visible ownership of their progress.

**Status: proposed design.** The initial scope is concrete enough for implementation planning, subject to the party-size and persistence decisions in section 9. The later expansions describe intended behavior, but require separate detailed designs before implementation. Costs, reward amounts, and encounter tuning below are provisional playtest values, not decisions explicitly made by the user.

The user requested a design following discussion of encampments, territory, town services, quests, crafting, and combinations of those ideas. This document records the recommended combination. It does not authorize implementation or replace the existing party-builder and saves design.

## 2. Requirements and scope

### Initial playable scope

| ID | Requirement |
| --- | --- |
| R1 | Start at one home encampment associated with Oakvale. Show camp services, available improvements, and the expedition journal. |
| R2 | Let the player choose and track a quest with its destination, objective, danger, and capability reward visible before departure. |
| R3 | Provide recovery at home so wounds create a decision about continuing an expedition or returning. |
| R4 | Provide basic trade in Oakvale and a second town: sell surplus equipment, buy ordinary equipment and common materials. |
| R5 | Provide three one-time regional quests whose rewards unlock a craftsman, a party-capacity improvement, and a town relationship respectively. |
| R6 | Let the player build an initial workshop and commission a small set of mutually exclusive equipment modifications. |
| R7 | Provide a regional stronghold as a campaign milestone. Defeating it visibly secures the home region and concludes the initial arc. |
| R8 | Apply battle, quest, and construction rewards once; prevent purchases, crafting, or construction from partially changing state when validation fails. |
| R9 | Show costs, prerequisites, effects, and reasons an action is unavailable. No service or upgrade should require guessing what it does. |
| R10 | Keep progression rules outside Phaser scenes and preserve deterministic battle behavior. |
| R11 | Represent campaign progress in game state and include it in persistence when save slots are available. |

The initial scope includes one camp, two functional towns, three quests, one workshop construction, basic trade, three weapon modification recipes, and one regional stronghold. Existing world exploration and ordinary monster battles remain available.

### Longer-term scope

- Improve an infirmary, barracks, and scout lodge; expand the workshop through expedition requirements.
- Recruit reserves and choose a deployed party from a larger roster.
- Secure specific resource sites and defend their benefits against visible threats.
- Add rescue, hold-position, ritual interruption, and escape objectives.
- Give further regions their own threats and conclusions.
- Add multiple independently controlled parties only when simultaneous objectives justify them.

### Non-goals for the initial scope

Hex-by-hex territorial ownership, passive resource generation, mandatory defense battles, reserve roster management, multiple parties, random item affixes, recipe discovery through grinding, consumables, item durability, a survival hunger system, and repeatable quests are outside the initial scope. Initial quests use the existing defeat-all-enemies battle objective; their narrative goals do not imply new tactical victory conditions.

## 3. Current system and dependencies

Inspected facts:

- [`gameState.ts`](../../src/game/gameState.ts) stores the party, world, and shared baggage. It contains no gold, material stock, camp, quest, or regional-progress state. `takeLoot` moves a defeated location's fixed equipment rewards into baggage.
- [`worldMap.ts`](../../src/game/worldMap.ts) defines a 60×40 map. The party begins in Oakvale; towns and resource sites are visible but have no interaction. Threat increases with distance from home. Travel spends one turn per hex; scouting and waiting each spend one turn but have no further effect. Victory currently removes a monster location.
- [`party.ts`](../../src/game/party.ts) starts four heroes and caps a party at six. Every member receives the full battle XP reward. Fallen members revive at 1 HP after a victory unless leveling heals them.
- [`progression.ts`](../../src/character/progression.ts) heals a character fully when they level. There is no other current campaign recovery service.
- [`inventory.ts`](../../src/inventory/inventory.ts) defines equipment as catalog items with fixed stats. Items have no prices, materials, or mutable upgrade state. Shared catalog objects must not be edited to modify one owned item.
- [`character.ts`](../../src/character/character.ts) derives combat stats from character progression and equipment. Backpack and equipment operations pass `Item` values. Mana begins each battle at the derived maximum; this design adds HP recovery, not persistent mana recovery.
- [`BattleScene.ts`](../../src/scenes/BattleScene.ts) currently applies loot, clears the location, synchronizes HP, and awards XP at battle completion. [`encounters.ts`](../../src/game/encounters.ts) supports six starting positions and encounter threat scaling tuned for four initial heroes.
- [`WorldScene.ts`](../../src/scenes/WorldScene.ts) is the presentation layer for travel and encounter choices. Rules belong in the Phaser-free domain layer, as documented in [`CLAUDE.md`](../../CLAUDE.md).

Related design: [`party-builder-and-saves.md`](party-builder-and-saves.md) proposes a starting party of three, a dynamic party limit, character creation, and save slots. It is ahead of the inspected implementation. This design must support either baseline explicitly, rather than assuming those features already exist. The older [`magic.md`](magic.md) design contains historical descriptions of systems since changed; current code is authoritative for current behavior.

## 4. Player experience

### Home and expedition preparation

The home camp occupies the Oakvale location. Arriving there offers **Camp** and **Town** views of the same location; no second location is placed on the same hex. A new game opens the camp view, with the map reachable through Leave Camp.

The camp view shows the deployed party's health, services, workshop status, and journal. The player can inspect equipment and spend progression points through the existing character panel. The journal permits one tracked quest but any number of accepted quests. Tracking is a display preference, not an exclusive mission commitment.

An expedition is the player's journey between home visits. It is not a separate mode, generated dungeon, or mandatory sequence. Players can change goals, visit towns, and return early. Defeated locations remain defeated; returning does not reset monsters or reroll loot.

Initial recovery is a free, explicit **Rest** action at home, restoring every party member to their current maximum HP and consuming one world turn. It is available from the beginning so recovery cannot become a gold softlock. It gives no XP or materials. Repeating Rest produces no further benefit for a healthy party. Ordinary towns do not offer recovery in the initial scope, preserving home's role. Level-up healing remains in place initially and is evaluated during balancing.

This version makes returning a choice about travel time and convenience. Since it has no world deadlines yet, it does not claim to impose a strategic penalty for resting. Time pressure belongs to the later threat system.

### Town services and commerce

Oakvale offers ordinary equipment, common materials, and a buyer for surplus items. Stonebridge offers the same basic services; its specialist inventory becomes available through a quest. Other towns continue to be visible map locations with a clear “services unavailable in this version” state, rather than silently opening an empty shop.

Prices are fixed catalog data, shown before confirmation. Purchase places equipment directly into shared baggage; material purchases increase shared stock. Sales initially operate on baggage only. Equipped or backpack items must be transferred through the existing inventory panel first, avoiding hidden character-gear changes inside a shop.

Common stock is unlimited; rare components and special quest equipment are not sold. Ordinary equipment sells for at most half its purchase price, rounded down. Crafted variants sell for the base item's sale price, so crafting is not a gold-making cycle. Prices and recipe costs are nonnegative integer values; transactions require sufficient gold and valid quantities and never allow a negative balance.

No random price changes, merchant travel, buyback history, or item haggling are needed initially.

### Quest arc and visible rewards

Proposed initial content uses existing towns and nearby sites where possible. Names and exact coordinates may change for pacing; these reward relationships define the arc.

| Quest | Objective | Reward and consequence |
| --- | --- | --- |
| The Missing Smith | Defeat the raiders holding Oakvale's smith. | The smith returns to camp; workshop construction becomes available. A one-time iron reward covers the first modification's material requirement. |
| A Company Charter | Defeat a hostile patrol and recover the charter. | Returning it to Oakvale raises deployed party capacity by one and supplies a named recruit who fills the new place. |
| The Stonebridge Road | Defeat the force blocking the road. | Stonebridge unlocks specialist trade, including a bow modification and access to additional ordinary gear. |

All three are available from home early, with objective and reward previews. The first two should be viable with the baseline starting party; the road quest can be a somewhat harder alternative. These are one-time battles with fixed rewards, not repeated collection errands.

Quest states are `available → active → objectiveComplete → claimed`. Accepting a quest costs nothing. Its world objective exists before acceptance: winning the relevant battle records the objective even if the player has not accepted it yet. Acceptance subsequently shows it as complete. Claiming requires visiting the named quest giver and atomically grants all rewards. No reward is lost because the player explored in a different order.

The initial recruit is a fixed legal character build added directly to the active party when the charter reward is claimed. There is no reserve roster yet. The capacity increase must fit the six-position technical maximum. Claiming validates space before granting anything; an incompatibility leaves the quest complete and reports the reason. If the party-builder design lands first, its creation and party-limit rules supply this integration.

### Camp improvements

Workshop construction requires the returned smith, a small gold payment, and common materials. Its preview shows the complete cost and recipes it enables. Construction completes immediately at home and consumes one world turn; timed building queues add little value at this scale.

The first quest rewards and gold from nearby battles must cover construction and one useful modification without requiring the player to sell starting gear. Quest services unlock access; the player still chooses how to spend the resulting resources.

Later improvement roles:

| Improvement | Intended choice it creates |
| --- | --- |
| Infirmary | Recover more efficiently under future time pressure; do not gate basic recovery behind it. |
| Workshop | Unlock equipment specializations and advanced recipes through materials plus a specific expedition achievement. |
| Barracks | Recruit reserves and eventually expand deployed capacity, within encounter limits. |
| Scout lodge | Reveal enemy composition and regional opportunities before committing to an expedition. |

Advanced upgrades should combine common costs with a distinct adventure prerequisite, such as retrieving a forge component. Avoid a long ladder of identical buildings that only add small percentage bonuses.

### Equipment modifications

The first workshop modifies ordinary equipment already in baggage. It does not manufacture arbitrary gear from scratch. Buying a base item and then specializing it provides enough crafting choice for the initial scope.

Proposed starter recipes:

| Base item | Variant | Effect compared with base | Access |
| --- | --- | --- | --- |
| Iron Longsword | Balanced Longsword | +5 percentage points to hit; −1 damage bonus | Workshop |
| Iron Longsword | Weighted Longsword | +2 damage bonus; +1 attack AP cost | Workshop |
| Yew Bow | Long-range Bow | +1 range; +1 attack AP cost | Workshop plus Stonebridge relationship |

Recipes show full resulting stats beside current stats, especially attack AP cost: small changes can alter attacks per turn. Exact effects require simulation and playtesting. The variants should have useful roles, rather than one universally strongest option.

Each recipe consumes gold and common material stock, then replaces exactly one selected baggage entry with its variant. A modification is permanent in the initial scope; the confirmation says so. Variants cannot be modified again and enchanted loot cannot receive these modifications. Players may obtain another base item to choose a different specialization. Unique loot retains distinct effects and remains worth finding.

Use catalog variants with their own item IDs for this small recipe set. Do not mutate an `Item.stats` object or introduce arbitrary per-instance affixes yet. Two identical swords can be modified independently by their baggage positions even though they share a base catalog definition.

### Regional milestone

A stronghold is visible as a longer-term objective with a recommended danger level. Its encounter is fixed by authored content, not increased automatically to match player level or party size. The three quests provide recommended preparation; the stronghold is not mechanically locked behind completing them all.

Victory awards a distinct item, marks the home region secured, changes the map marker, and shows a regional conclusion naming the player's accomplishments. Claiming a journal reward twice cannot duplicate the item. The player may keep exploring afterward; subsequent regions are future content.

The initial boss can use an authored composition of existing enemy kinds. A boss sprite, unique abilities, and new battle objectives are optional later work, not hidden dependencies of this design.

## 5. Territory and later tactical variety

Territory begins with named sites, not every world hex. An iron mine supplies metal; a watchtower supplies information; a reopened road improves access. Capturing a site should change what the player can prepare or where they can travel.

Do not add automatic resources for every elapsed world turn. Travel already spends many turns, and waiting would otherwise become a wealth generator. A proposed later rule is a bounded delivery after a completed expedition objective, with a visible stock cap. Its exact production trigger, collection location, and costs need a territory design before implementation.

Protection uses announced threats with enough time to choose a response. The map shows target, arrival time, consequence, and route. Travel must process scheduled events across every crossed turn, including a multi-hex move, rather than skipping directly to the final turn. Players can invest in guards or intercept attackers. A lost site suspends its benefit and can be reclaimed; it does not erase unrelated character progress. Limit simultaneous threats so expansion does not accumulate recurring chores.

New battle objectives should make party preparation matter:

- Rescue: reach and protect a captive, then extract.
- Hold: keep control of a position for a defined number of rounds.
- Interrupt: stop a ritual before a visible deadline.
- Escape: carry recovered supplies to an exit while under pursuit.

These require explicit engine victory/failure rules, objective state, AI behavior, event logging, and replay support. Narrative quest completion must not be inferred from animation timing. Each objective type needs a separate design.

A reserve roster should precede multiple parties. Stable character identity, deployment, XP rules for reserves, recovery, and equipment ownership need to be settled together. Multiple parties are justified only when the world supplies competing tasks worth assigning them to; they require a time model that prevents one party acting indefinitely while others are frozen.

## 6. Technical design for the initial scope

### State and responsibilities

Extend [`GameState`](../../src/game/gameState.ts) with a campaign state. Proposed shape:

```ts
interface CampaignState {
  gold: number
  materials: Partial<Record<MaterialId, number>>
  camp: { workshopBuilt: boolean }
  quests: Record<QuestId, QuestState>
  trackedQuest: QuestId | null
  resolvedObjectives: string[]
  claimedBattleRewards: string[]
  townRelations: Partial<Record<TownId, 'trusted'>>
  securedRegions: RegionId[]
  partyLimit: number
}
```

Use closed string unions for authored IDs. `QuestState` records acceptance and claiming; objective completion is derived from recorded objective IDs so clearing a map location does not destroy quest evidence. Array entries are unique. Static quest text, costs, recipes, stock, and reward definitions live in catalogs, not saved state. Initial material IDs should be limited to `iron` and `timber`; special components arrive only with content that uses them.

If the party-builder design has introduced a game-level party limit, reuse that field rather than adding another authoritative copy. Initialize it to the chosen baseline size, and cap upgrades at the encounter layout's six-member limit. Display the gameplay limit separately from the technical maximum.

Proposed new domain files, with names adjustable to repository conventions:

- `src/game/campaign.ts`: campaign initialization, objective evidence, and regional progress.
- `src/game/quests.ts`: quest catalog, availability, acceptance, tracking, and atomic reward claiming.
- `src/game/camp.ts`: recovery, construction prerequisites, and service availability.
- `src/game/economy.ts`: prices, town stock, purchase/sale validation, and resource transactions.
- `src/inventory/recipes.ts`: catalog recipes and equipment replacement.
- `src/game/battleRewards.ts`: apply a completed world's battle outcome once, coordinating XP, loot, currency, objective evidence, and location changes.

These modules take game state and explicit inputs. They do not import Phaser, read wall-clock time, or consult scene globals. Commands return a typed success result or a specific failure reason, such as insufficient gold, missing prerequisite, invalid selection, or already claimed. Failure leaves all state unchanged.

### Rewards and transaction invariants

A world encounter's authored reward definition includes gold and material amounts alongside current equipment loot. Quest rewards live in the quest catalog. Equipment loot, gold, materials, objective recording, XP, and location resolution form one domain operation keyed by a stable location ID. Repeating that outcome returns “already applied.” The scene copies final HP before calling the outcome operation. Existing battle inventory transfers are not reset by this operation.

All validation precedes mutation. Commands validate integer amounts and current inventory selections. A sale or modification request includes the baggage index and expected item ID; a stale selection fails instead of acting on a shifted entry. Shop transactions occur only at a town with that service; camp transactions and recovery occur only at home. None is permitted during a battle.

Equipment purchases and variants produce catalog `Item` values compatible with current character and inventory code. Modification recipes reference registered result item IDs; derive combat stats through existing readers. No engine event change is necessary merely to obtain a new catalog weapon. If future objectives change event shapes, increment `LOG_SCHEMA_VERSION`.

### Map and scene integration

Keep Oakvale's map kind `town`; camp access is a property of its stable ID. Town arrival offers an interaction button instead of automatically interrupting every route. Add a proposed `CampScene`/`TownScene` or shared location-service overlay, with resize behavior and controls exposed through the project's scene probes. The UI choice can share rendering, but service rules stay in domain modules.

The world journal shows accepted quests, completed objectives awaiting turn-in, and the stronghold milestone. Tracking highlights a destination on the map without changing route rules. A service panel shows costs, before/after equipment stats, and unavailable reasons. Purchase, sell, construction, modification, and reward claim confirmations summarize their exact effects. Basic recovery needs only its labeled action and result message.

Ordinary defeated monster sites may still be removed. The stronghold retains a resolved marker. Do not leave a resolved marker as an active `monsters` location: current confrontation and pathfinding treat that kind as hostile. Add an explicit non-hostile resolved location variant or replace it with a non-hostile point of interest; sprite mapping and location unions must handle it.

### Persistence

Current inspected game state is passed between scenes and has no campaign save implementation. Save slots are a dependency for a campaign intended for sustained play. When available, save every successful service transaction, quest change, rest, construction, and battle outcome, alongside existing world and battle save points.

Save campaign IDs and balances, plus owned equipment by catalog ID. Register variant IDs with the serializer. Do not serialize derived combat stats as campaign character data. Follow the save design's versioning policy when state shape changes; do not claim compatibility with older files without a migration. A write failure must leave the current in-memory result intact and show the existing save-failure message rather than charging or granting rewards again.

## 7. Consequences and balancing

Recovery changes campaign balance substantially. The current campaign simulator carries wounds and ignores loot; its clearance rate cannot establish balance for a campaign with rest, shops, recipes, and capacity upgrades. Preserve that scenario as a baseline and add explicit campaign policies for visiting home and choosing quest rewards when implementing this feature.

Evaluate early quests with both a fresh party and a partially wounded party; compare equipment variants with the simulator's weapon options; evaluate the stronghold with plausible preparation paths. Party-size upgrades add actions as well as HP and may be much stronger than individual equipment improvements. Reward the expansion as a milestone and author later challenges around its availability. Do not automatically increase every enemy count after the player unlocks it, which would hide the reward's benefit.

The initial economy has finite encounter income and repeatable common purchases. Free recovery and guaranteed construction funding prevent essential services from being blocked by poor spending. Optional purchases may still delay optional crafting. Avoid extra material types until they create a distinct decision.

Recovery weakens attrition as the only campaign limit. That is intentional: goals, stronger regions, and eventually visible threats provide direction. If returning home becomes tedious, shorten initial routes or add an earned travel improvement; do not add mandatory upkeep solely to punish recovery.

## 8. Verification and acceptance

| ID | Observable scenario | Covers |
| --- | --- | --- |
| A1 | New game opens Oakvale's camp; leaving and returning preserves workshop, journal, resources, and party health. | R1, R11 |
| A2 | Track a quest and see its destination, danger, objective, and reward on the journal/map; switching tracking does not abandon another quest. | R2, R9 |
| A3 | Rest with wounded members: HP becomes derived maximum, the world advances one turn, and gold, XP, and materials do not change. | R3 |
| A4 | Buy equipment and materials, then sell a baggage item: exact displayed balances and inventory changes occur; insufficient funds and stale selections change nothing. | R4, R8, R9 |
| A5 | Complete each regional objective before and after accepting its quest. Both orders permit a single turn-in with the specified unlock and reward. | R5, R8 |
| A6 | Claim the charter: deployed capacity rises by one and the named recruit joins once; party size and limit remain within supported encounter positions. | R5, R8 |
| A7 | Return the smith, construct the workshop, and modify one of two identical swords. Only the selected sword changes; costs match the preview; repeating construction or modifying a variant fails without cost. | R6, R8, R9 |
| A8 | Stonebridge's special recipe is unavailable before its quest reward and available afterward. The resulting bow shows its range/AP tradeoff in equipment and battle. | R4, R5, R6 |
| A9 | Defeat the stronghold: region is secured, distinct loot is awarded once, and its marker becomes non-hostile. The player can continue exploring. | R7, R8 |
| A10 | Replay the same battle seed and actions with the same prepared party: battle outcomes and logs agree. Campaign service actions do not depend on Phaser or wall-clock time. | R10 |
| A11 | With save slots integrated, reload after reward claim, trade, modification, construction, and rest: progress and balances agree, without duplicated rewards. | R11 |

Implementation verification should use domain tests for transaction failure atomicity, reward idempotency, quest ordering, limits, and catalog validity. Scene smoke tests verify service views start correctly; browser scenarios verify travel-to-service transitions, journal tracking, previews, and the minimum 840×560 layout. Use existing scene probes rather than reading UI internals.

Run `npm test` for implementation, and `npm run test:browser` after scene changes. Run proportionate simulator comparisons for recipes, party expansion, and revised campaign recovery. The design itself changes no runtime behavior and needs document/link review rather than new game tests.

Playtesting should establish whether the player can name a next goal, whether rewards change preparation choices, whether returning home has a tolerable travel cost, and whether the stronghold feels like a payoff. Win rate alone cannot answer those questions.

## 9. Assumptions, decisions to confirm, and risks

The following are proposed defaults, not explicit user requirements:

1. **Home at Oakvale:** camp and town share a map location. This gives the existing starting location a purpose without adding a second nearby travel stop.
2. **Free recovery:** home restores HP for one world turn; leveling still heals. This is the simplest recovery baseline to evaluate before introducing time pressure.
3. **Initial crafting uses fixed catalog variants:** no per-item mutable upgrade state, enchanted-item modifications, or dismantling system yet.
4. **Narrative quests use ordinary battles initially:** tactical rescue, defense, and escape objectives need additional engine design.
5. **Existing total-party defeat behavior is retained unless the save design lands:** there is no new injury, retreat, or resurrection economy in this scope. The save design's proposed pre-battle rollback would take precedence once implemented.

Two integration decisions must be explicit before implementation planning is finalized:

- **Starting party baseline:** if this feature precedes the party-builder design, use four starting heroes and a charter upgrade from four to five. If it follows that design, use three and upgrade to four. Do not silently remove an existing starter or rebalance for the wrong baseline. A later barracks upgrade may reach six; it is outside this initial scope.
- **Persistence sequence:** recommended release order is party-builder/save slots first, then this campaign. A standalone prototype may proceed without saves, but a complete campaign release requires persistence. Determine which version is being planned and use one authoritative party-limit field.

Prices, recipe effects, encounter compositions, starting gold, and reward quantities require tuning. These do not block structural design: the catalogs must satisfy the guaranteed-funding rule for workshop construction and a first modification. Exact amounts should be selected and documented during implementation balance work.

Territory production, defense scheduling, reserves, multiple parties, and new tactical objectives remain future designs. Their unresolved details do not block the initial scope and must not be treated as implicit implementation requirements.
