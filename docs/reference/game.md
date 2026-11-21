# The game outside battle: reference

The full rules of `src/game/`: encounters and bandits, the company and its day loop, the world map, the blight, the encampment and its facilities, and saving. The working guide, with the contracts, is `src/game/CLAUDE.md`; the checklists are in `.claude/skills/yomi-add-content/`; this file holds the detail they leave out. The simulator and the balance figures are in `.claude/skills/yomi-balance/`.

## Encounters and foes

`encounters.ts` holds the battle setups, registered by id in `ENCOUNTERS`. A monster location on the world map names the `EncounterId` it leads to and the threat to fight it at, and the simulator fights `goblinRaid` unless told otherwise, so balance runs fight a battle the game has.

A setup is built for the party and the threat it is given: the threat decides how many of the encounter's foes take the field and their level (see Scaling). The party is a `Fighter` per member (stats and hit points left), lined up on the `PARTY_START` hexes, and member i's unit is named `heroId(i)`, which is how `BattleScene` finds the `Character` behind a unit. Each setup also maps unit ids to a `UnitKind`, which is how scenes pick a sprite and how `xpReward` prices the foes (`FOE_XP` times their level); the engine knows only stats.

A foe kind (`FoeKind`) is either a monster (`MonsterKind`), a stat block scaled from its native level (`FOE_NATIVE_LEVEL`), or a bandit (`BanditKind`, `bandits.ts`), built by hero rules. `foeStats(kind, level)` builds either.

Each encounter has a band of threats (`ENCOUNTER_BANDS`) and a foe count for each threat in it (`ENCOUNTER_COUNTS`); a threat outside the band is fought as the nearest in it. `encountersFor(threat)` lists the encounters whose band holds a threat. The blight's spawns draw from `SPAWN_KINDS` alone, so the newer nests do not spawn. `MAX_THREAT` (5) is today's map's highest threat and `threatAt`'s cap; it is not tied to the counts.

The encounters worth knowing:

- Goblin Raid: its third foe is the Goblin Shaman (so it fights from threat 2) and its fourth the Kobold Sneak.
- Hobgoblin Warband (threat 2 on the map): the Hobgoblin Chief, resistance 4.
- Troll Lair (threat 5 only): the Armoured Troll (resistance 5, regeneration 2) beside a Troll (resistance 1, regeneration 3, `troll_claws` as one 8 AP routine standing still or one 4 AP claw after a move). The simulator's heroes never change weapons, so this is a report-only cell, won 0 or nearly 0 of 500 at threat 5, level 5.
- Bandit Camp (`bandit_camp`, threats 3 to 7): fields bandits, at two of the map's nests (the Bandit Camp, threat 3, and the Bandit Hideout, threat 4) and in the Bandit Gangs the blight spawns from threat 3.
- Spider Nest (`spider_nest`, threat 5 only, 4 foes: a Giant Spider, a Kobold Sneak, a Brood Spider and a Nest Spider): fights with abilities; the Giant Spider (native level 4) webs and bites.
- Salamander Pool (`salamander_pool`, threat 5 only, 3 foes: a Salamander between two Kobolds): the Salamander (native level 5) spits fire and is warded against it (`wards.fire` 99), so Flame Arrow and Fireball deal it 0, though statuses land, and the policy's area rule counts only foes a spell can hurt.
- Source Guardians (`source_guardians`, threat 5): the Blight Horror, a boss whose claws pierce 2 points of resistance and which casts Death Cloud and Bane, with a Goblin Brute, a shaman and a Kobold Sneak.

The Salamander Pool and the Spider Nest are not among the spawns.

## Bandits

`bandits.ts` builds bandits, humanoid foes, by hero rules (`banditStats(role, level, gear)`, cached): a role's draft made a character, dressed in its role's gear at the grade the threat calls for, levelled and spent by `autoAdvance`, its stats `deriveCombatStats`'s, so a bandit of level L fights as a hero of that draft and gear would. A hero built the same way (`banditDraft`, the same gear, levels and `autoAdvance`) has the same stats, which a test holds it to.

Each of the six roles (`BanditRole`; `BANDIT_ROLE` maps the kinds to them) has a fixed, legal `CharacterDraft` and its gear:

| Role | Gear | Techniques by level (`BANDIT_PLAN`) |
| --- | --- | --- |
| Cutthroat | iron dagger | Backstab 2, Dirty Trick 4, Sprint 5 |
| Archer | yew bow | Aimed Shot 3, Volley 6, Far Shot 8 |
| Brute | battle axe, breastplate | Power Attack 3, Armour Breaker 5, Cleave 8 |
| Hedge-Mage | Wand of Sparks | draft: Magic Arrow, Shield, Arcane Study; plan `bandit_mage`: Flame Arrow 3, Destruction 4, Fireball 7, Heal 8, Heal All 10 (so on today's map it never heals) |
| Captain | sword, oak shield, breastplate | plan `knight` (Heavy Hand after Pin): Rooted 3, Taunt 5, Pin 8 |
| Crossbowman | crossbow (the Archer's draft) | as the Archer |

Each technique level is held in `progression.test.ts`.

Each item is named by catalog family in two ids, tier 1 (iron, oak, yew) and tier 2 (steel, ironwood). The gear is at `banditGear(threat)`, `{ tier, grade }`: tier 1 Fine at threats 3 and 5, tier 1 plain at 4, tier 2 Fine from 6, the wand included, as it is a plain item.

The camp's slots, in order, are the Captain, the Archer (from threat 5), the Hedge-Mage (from 4), the Crossbowman (from 6), the Brute and the Cutthroat, so each threat of today's map has its own second bandit (Brute at 3, Hedge-Mage at 4, Archer at 5). At 6 and 7 four take the field; the Brute and Cutthroat take the field there only once a count is raised to 5 or 6.

## Scaling

Monsters are the more dangerous the further from home they lie. A monster location's `threat` is 1 within `THREAT_BAND` (11) hexes of the encampment and one more for each band beyond, up to `MAX_THREAT` (5) (`threatAt`), and `WorldScene` tells the player the threat of the monsters it stands before.

Bands and counts (`ENCOUNTER_BANDS`, `ENCOUNTER_COUNTS`): the monsters' five encounters cover threats 1 to 5 with 2, 3, 3, 3, 4 foes; the Bandit Camp 3 to 7 with 2, 2, 2 at threats 3 to 5 and 4, 4 at 6 and 7 (a first guess); the Spider Nest 5 only. A battle at threat T fields that many foes, all of level T, the first of the encounter's slots that take the field at T (`FoeSlot.fromThreat`).

A monster kind has a native level (`FOE_NATIVE_LEVEL`: 1 but for the Giant Spider's 4 and the Salamander's 5), its stat block written for that level. A level above it adds (`foeAtLevel`) 115% of its level-1 hit points (`FOE_HP_PER_LEVEL`), 5 to chance to hit and to armour class, 1 damage every second level, and to a caster 3 mana and 5 to its spells' chance; resistance and regeneration are the kind's at every level. `foeYardstick(level)` gives the ranges a foe of a level should sit in, which a test holds each kind to at its native level.

## The party

`party.ts`: the `Party`, the player's characters in battle order. `PREROLLS` are the pre-rolled characters a place can be filled with, each a draft and a short role shown under its portrait; the first three are the ready-made party (`READY_MADE`, `readyMadeParty`), a soldier, an archer and a mage. The party screen's limit is `STARTING_PARTY_LIMIT` (3), and no party may pass `MAX_PARTY_SIZE` (6, what `PARTY_START` has hexes for). `rewardVictory` is what a won battle brings: experience for the living, while the fallen are dead (`buryFallen`, their gear into the baggage). `autoHeal` spends a party's mana on its wounds as a careful player would from the Abilities tab, which camping until healed does.

## Parties and the company

`expedition.ts`: the `Expedition` is a party of the company: id, name, members, baggage, the hex it stands on (`position`), the monster location it walked into and has not answered (`confronting`) and a standing `Order`. Ids are `partyId(n)`, `party_1` to `party_3` (`MAX_PARTIES`), with default names `PARTY_NAMES` by number; the first's stored name is "First Company" while the map shows "Your party". `PartyPresence` is a party as the world's rules see it, its hex and its members' levels (`presenceOf`; `presences(game.parties)`, the company's in list order).

### Orders and the day loop

`company.ts` is the company's one clock. Each party has a standing `Order`:

- idle;
- travel, keeping the route planned when it was given;
- home, a travel order to the encampment;
- camp;
- garrison, on a held resource, never ending by itself; it holds the site only as any party's presence does (its hex is neutral and its levels push the blight back);
- meet, a hex a day toward another party's current hex, re-planned daily, ending with `met` on a shared hex and confronting any monsters there, or confronting monsters it stepped onto as the other walked off, or idle with `order_done` once that party is gone or no way to it is left;
- a one-day action (`DayAction`).

`setOrder` refuses a travel order to a monster location another party already stands on (a meet joins it there instead). A travel or home order stops a hex short, idle with `order_done`, of a monster location another party stands on, so of two parties reaching one nest on a day the earlier in the list confronts it.

`passDay` runs every party's day by its order, in list order, then `passTurn` once, then checks each order against the day. Idle and garrisoned parties away from monsters heal each living member `NATURAL_HEALING_PER_DAY` (1) a day, capped at maximum hit points, without mana or the infirmary's bonus. `advance` passes days until an `Interrupt` (the first notable world event, else a party's own event: arrived, confronting, order done, met), the game ending, or `UNTIL_LIMIT` (30) days.

`travel` (worldMap.ts, over `startTravel`, which gives the travel order and handles a refused one or a nest on its first hex, passing no day) and `campUntilHealed` (camp.ts) are conveniences that give an order and advance. `orderAction` gives a party a one-day action (scout, wait, a day's camp, a tower, an improvement, a field craft or embed) as a `day` order for the next day to run, refusing, changing nothing, what the action's own check or `advanceRefusal` refuses. `blockingParty` is the party whose monsters a refusal is for, and `partyNoun` how a refusal names a party ("The party" alone, else its name). `act` is `orderAction` then the day passed; `linger`, `campDay`, `buildTower`, `improveSite` and the field `craft` and `embed` are conveniences over it.

### Company actions

The guild hall's company actions, each needing the parties it touches at home:

- `formParty`: a party from a hero of a home party or the reserves, under the lowest free id and a name of 1 to 16 letters unique among the parties, within `maxParties`;
- `renameParty`: anywhere;
- `disband`: members to the reserves, baggage to the first other party at home, never the last party;
- `moveHero`: between home parties and the reserves.

Two parties' business in the field:

- `exchange`: members, swaps and baggage items between two parties on one hex, all its moves checked first, refused while either faces monsters the other does not; no reserve is reachable through it.
- `wipeParty`: a party beaten in battle. Its heroes are dead, what they wore and carried and its baggage are put on the location's loot (or lost, with no location), and the party is gone. The last party wiped with reserves left is replaced at once by one formed from them at the encampment (up to the party limit, the lowest free id and its default name). The game is `lost` when `heroesLeft` (every party's members and the reserves) is 0.

## The world map

`worldMap.ts` holds `WorldState`: the board, the turn count, the locations (each monster location with its fixed `loot`), the blight's levels and counters, what the player has seen of them (`seen`, `sighted`), the held sites, the stock, the world RNG's state and the game's `status`. Where a party stands and what it confronts are its expedition's. The functions that change it: `passTurn`, through which every turn passes; `travel(game, party, to)` (`walkTo` gives its days' reports too, and `followOrder` walks a home or meet order the same way); `linger(game, party, how)`; `clearLocation(game, id)`, which frees every party confronting it. `WorldScene` asks `routeTo` what a click would do and must not decide it.

- The encampment is the only settlement (`kind: 'encampment'`, `ENCAMPMENT_ID`), named by the player when the game begins (its location's `name`, read through `encampmentName`, never assumed to be Oakvale); every other quiet location is a resource.
- The map (`WORLD_SIZE`) is several windows across. `WorldScene` scrolls it to follow the party, or to where a drag pans it (a press that moves no more than `DRAG_THRESHOLD_PX` is a click to travel), until the next journey, Home or a click on the party's entry in the list down its right brings it back to the selected party (`centreOnSelected`).
- Time passes in turns, one per hex travelled, and every turn is the blight's day (`passTurn`). Journeys and camping pass their days through the day loop. An order outlasts an interrupt: a cut-short walk or camp is still the party's order, and the next day carries it on. Every one-day action is a one-day order through the same loop, after which the party is idle.
- A party may be sent home (from anywhere away from the encampment), set to garrison a held resource it stands on, or sent to meet another party (by a click on that party's hex); two parties sharing a hex may trade heroes and baggage (`exchange`, the `Exchange` scene).
- A journey is walked a hex and a turn at a time and stops where a notable event happens (`isNotable`: monsters sighted within `NOTICE_RADIUS` of some party's presence, the Source wherever it is sighted, a held site or tower newly under threat or lost, the encampment lost; a spawn is told only when sighted) or where monsters stand on the road. Routes keep clear of every sighted monster location except one they end on, and go through the unexplored as through open land.
- Walking into monsters sets the party's `confronting`, and it cannot travel on until it scouts, waits (a turn each, and neither does more yet) or attacks.
- On a held resource the party may build its next improvement (`improveSite`, a day, `IMPROVEMENT_COSTS`, the Lodge allowing). Anywhere but among monsters it may build a watchtower on clean land off every location, `TOWER_SPACING` (4) hexes from any other, for `TOWER_COST` from the stock wherever the party is, in a day (`buildTower`).
- Camping (`camp.ts`) is a turn a day. Each day heals every member `NATURAL_HEALING_PER_DAY` (1), or more with the infirmary (`restHealing`: a third, then all of it at the encampment, then 3 a day elsewhere), and fills every caster's mana. Camping until healed casts the party's heals with the mana it has (`autoHeal`), then camps a day and casts again while anyone is wounded, unless a notable event breaks camp. `rest` is a day's healing with no time passing, which both camp orders use.
- A won battle takes its location off the map, cleanses the land around it and puts its loot in the baggage (`BattleScene.endBattle` calls `takeLoot` and `clearLocation`, and the victory screen names what was found).
- The game ends only when the encampment falls (`status` 'lost', permadeath as a defeat that leaves no hero is) or the Source is beaten ('won'), after which the player ends the game, keeping the save, or goes on in 'endless' mode.

### Fog of war

`vision.ts` (`docs/designs/guild-hall-and-watchtowers.md`). Each party, the encampment, each held site and each watchtower see every hex within a radius (`PARTY_VISION` 5, `CAMP_VISION` 6, a resource 2, a tower 8; nothing blocks sight). A hex once seen is remembered at the level it last had in sight (`WorldState.seen`, -1 never seen) and a monster location once seen stays known (`sighted`). The Source is unknown at the start, found only by exploring, and its sighting (`source` on the `sighted` event) is notable however far off. `updateSight`, which every change to the land ends with, remembers what is in sight and tells of monsters newly sighted.

## The blight

`blight.ts`, `docs/designs/blight.md`. Every hex has a level, 0 (clean) to 3 (corrupted), kept densely in `WorldState.blight` by `boardIndex`. Each day each hex's `shift` counter moves by its net influence, blight less clean, and its level moves by one when the counter reaches `SHIFT_COST` either way (`advanceDay`).

Each source pushes with its strength less a point a hex of distance:

- for the blight: a monster location with `BLIGHT_PER_THREAT` × its threat, the Source with `SOURCE_STRENGTH`, each corrupted neighbour with `CREEP`, all times the blight's growth with time (`blightGrowth`: a tenth more every 30 days, to half again at day 151, worked out from the turn);
- against it: the encampment (`CAMP_STRENGTH`, more with its shrine), each held resource (more with an improvement), each watchtower (`TOWER_STRENGTH`) and each party (each presence, in list order), with `PARTY_BASE` and half its levels together (`partyStrength`; nothing else of a party counts).

A monster location's hex stays blighted or worse until it is beaten. Each party's hex is neutral, so the blight never rises there nor creeps from it, but the parties' influence lowers it. The fixed sources' influence is worked out again only when a location or a held site changes (`fields`, a memo outside the state).

Corrupted land builds spawn pressure, and each `SPAWN_COST` of it puts a monster location on corrupted land clear of every party, the nests and the held sites (and `SPAWN_CLEARANCE` from towers), drawn with the world RNG, at the threat of where it lies (`threatAt`, never the blight or the date, so the home band's nests stay ones a weak party can beat). Its kind is drawn among those whose encounter band holds that threat (a Goblin Brood, a Kobold Nest, and from threat 3 a Bandit Gang), up to `MAX_MONSTER_LOCATIONS`.

A won battle lowers the land within 1 + its threat by two levels (`cleanse`). The Source (`SOURCE_ID`) lies far in the east. The constants were tuned with the campaign simulator, not by design.

### Territory

`territory.ts`. A resource is held while its land is clean enough: captured at level 0, lost at its `lossLevel` (`LOSS_LEVEL`, 2; a fort's `MAX_BLIGHT`, 3: only when corrupted), under threat (with the days until it falls, `daysToFall`) while the blight is gaining on it. Every `YIELD_DAYS` each held site adds its yield to the encampment's `stock`, half if tainted, which the buildings and the guild hall spend (`updateTerritory`). A watchtower is lost, and warned of, as a held site is, at `LOSS_LEVEL`. A site lost razes its improvement, of whatever level (`site_lost` with `improvement`, the level razed).

## Buildings

`buildings.ts`: what the stock builds, and the stock's arithmetic (`canAfford`, `spend`).

- Watchtower: built where a party stands. `canBuildTower(world, party)` gives the reason it cannot; `buildTower(game, party)` builds it as a one-day order, over `raiseTower`, which spends and raises it with no time passing. A tower is `WorldState.towers`, not a location: blight.ts counts it a clean source, vision.ts a watcher, and territory.ts loses it as a held site.
- Shrine: raised a level at a time by a party at the encampment (`atEncampment(world, party)`, `raiseShrine`, no time passing), each level adding `SHRINE_STRENGTH` to the encampment. It is `WorldState.shrine`.
- Improvements: a held resource (`improvementSite`; never the encampment) is raised a level at a time by the party standing on it (`improveSite`, a one-day order over `raiseImprovement`, which spends and raises with no time passing and returns `site_improved` with the level and its name). `WorldState.improvements` maps a site's id to its level (`siteImprovement`, 0 for none), read by blight.ts's `siteStrength` (`IMPROVEMENT_STRENGTH`) and territory.ts's `siteYield` (`IMPROVEMENT_YIELD`) and `lossLevel`:

  | Level | Name (`improvementName`) | Needs (`IMPROVEMENT_LODGE`) | Cost (`IMPROVEMENT_COSTS`) | Yield, on the site's 2 | Strength, on `SITE_STRENGTH` 3 | Lost at |
  | --- | --- | --- | --- | --- | --- | --- |
  | 1 | Outpost | — | 15 gold, 10 timber | +1 | +3 | 2 |
  | 2 | works, by material (`WORKS_NAMES`: Mine for iron, gold, silver, copper and crystal; Lumber Camp, Quarry, Saltworks, Peat Cuttings) | Lodge 1 | 30 gold, 15 stone | +3 | +3 | 2 |
  | 3 | Fort | Lodge 2 | 50 gold, 20 iron, 10 stone | +3 | +7 | 3 (corrupted) |

  `improveRefusal(world, party)` refuses in order: "Nothing can be built here now." (the game over, or among monsters), "Improvements go on a held resource.", "<site> is as strong as it gets." (a fort), "<A Mine> needs the Builders' Lodge." ("need" for a plural name: "Saltworks need …", "Peat Cuttings need …"; "… at level 2." for a fort), "<An Outpost> costs …, more than the stock holds." (`withArticle`); `improveSiteRefusal` is its first three.
- Builders' Lodge: `WorldState.lodge`, 0 to `MAX_LODGE_LEVEL` (3), raised a level at a time by a party at the encampment (`raiseLodge(game, party)`, no time passing; `lodgeCost`, `LODGE_COSTS`: 30 gold and 20 timber, 60 gold and 25 stone, 100 gold, 20 iron and 20 stone). Level 1 allows works, 2 forts; `raiseLodge` builds no higher than `LODGE_LEVEL_LIMIT` (2), refusing with `ROADS_REFUSAL` ("Roads come with trade routes.") until stage 8's roads.

## The encampment's facilities

`encampment.ts` lists every facility (`FACILITIES`: the guild hall, the shrine, the trading post, the workshop, the infirmary, the Builders' Lodge), built or not, its level, what it does and what its next level costs; `improveFacility` calls the facility's own module for the party at home (`homeParty`), refusing with none at home.

### Guild hall

`guildHall.ts`. `atGuildHall(world, party)` is a party standing there and facing no monsters. Its level is `WorldState.guildHall`, and `GUILD_HALL_LEVELS` sets, by level 1 to 5:

| Level | Party limit (`partyLimit`) | Parties (`maxParties`) | Company (`companyLimit`) |
| --- | --- | --- | --- |
| 1 | 3 | 1 | 7 |
| 2 | 4 | 1 | 8 |
| 3 | 5 | 1 | 9 |
| 4 (the Barracks) | 5 | 2 | 14 |
| 5 | 5 | 3 | 18 |

The party limit is derived, never stored. The company limit counts parties and reserves together and `recruitRefusal` checks it. The hall recruits into the reserves (from a pre-roll or a created draft, at `recruitLevel`: the hall's level, with the levels' points unspent) and moves heroes between the party and the reserves. `homeParties` lists the parties at the encampment and `homeParty(game, preferred?)` picks the one the encampment acts for: the preferred (the scene's selected party) if it is at home, else the first at home.

### Trading post

`tradingPost.ts` (`WorldState.tradingPost`, built from the start at 1, up to 6). Levels 1 to 3 sell tier 1 at grades up to the level; 4 adds tier 2 at every grade (`sells`), and 5 and 6 sell as 4 does. `TRADING_POST_COSTS` is 40 gold 15 stone, 80 gold 15 copper, 120 gold 20 silver, 160 gold 30 silver 20 stone, 220 gold 40 silver 10 crystal for levels 2 to 6. `tradingPostName` calls levels 1 to 3 the Trading Post, then the Market, Market Hall and Trading House. Levels 4 to 6 bring gold: `MARKET_INCOME` 2, 3 and 5 every `YIELD_DAYS`, added to the stock after the sites' yields as a `yield` event with `source: 'market'` (a site's yield has no source), halved and rounded down while the encampment's hex is tainted (`territory.ts`). `wares(world, filter)` lists what it sells, narrowed by slot or family.

- Buying plain items at a grade into the baggage, priced by family (`PRICES`) times the tier's and the grade's multipliers (`TIER_PRICE`, `GRADE_PRICE`).
- Selling from the baggage and backpacks (never what is worn) for half; a modifier adds nothing, an enchanted item sells for half its `VALUES`, and an embedded rune adds half its price (`salePrice`). The post never sells a runed item.
- Runes (`runeWares`): Ember, Rime, Storm, Stone, Wind and Life at rank 1 from level 2 and rank 2 from level 4, `RUNE_PRICES` 15, 45, 135, 405 by rank. `buyRune` puts one in the pouch (`GameState.runes`); `sellRune` sells from it for a third.
- Materials sell two for a gold piece; the post never sells materials.

### Builders' Lodge

`WorldState.lodge`, 0 (not built) to `MAX_LODGE_LEVEL` 3, raised by `raiseLodge` at the encampment (`LODGE_COSTS`, buildings.ts). It allows works (level 1) and forts (level 2). Level 3, roads, is in the cost table but `raiseLodge` refuses at `LODGE_LEVEL_LIMIT` (2) with "Roads come with trade routes." until stage 8; the debug console may still set 3. A facility may carry a `refusal` checked before the stock, which is how the encampment screen shows that line.

### Crafting

`crafting.ts`: putting a modifier at a grade on an item where it lies (`craft`), replacing any it had. In the field (`craftTier` is `'field'` anywhere the party may camp, the encampment without a workshop included), the field modifiers at grade 1, in a day, a one-day order over `craftRefusal` and `applyCraft`, which take no time. At the workshop (`WorldState.workshop`), the modifiers its level unlocks up to the grade of its level, no time passing.

### Runecraft

`runecraft.ts`: runes moved between the pouch and an item's sockets where it lies.

- `embed` fills the next empty socket, at the workshop of any level for any rank, or a rank-1 rune in the field (where the party may camp) for a day, a one-day order over `embedRefusal` and `applyEmbed`. 5 gold a rank.
- `fuse` makes three of a rune one of the next rank: to rank 2 from workshop level 1; ranks 3 and 4 ask levels 4 and 5 (`FUSE_LEVELS`), beyond `MAX_WORKSHOP_LEVEL`, so they are refused for now, the refusal naming the level and checked before the count. 10 gold a rank of the new rune.
- `extract` takes a rune back intact from workshop level 2, the rest closing up. 10 gold a rank.

No time passes at the workshop. A change to a worn item keeps its wearer's share of hit points (`replaceAt` ends with `clampHp`).

### Infirmary

`infirmary.ts` (`WorldState.infirmary`) and `restHealing`, what a day's camping heals a member where the party stands, which `campDay` uses.

### Item places

`itemPlace.ts`: `ItemPlace`, where an item the trading post or crafting acts on lies (baggage, worn, backpack) in the party it names (`party`, an id), with the id expected there, so a place that no longer holds it, or whose party is unknown, is refused as stale (`placeKey` leaves the party out). Functions that list, buy or recruit take the acting party after `game`, and `allPlaces(game, party, worn?)` lists one party's places. A worn item replaced or removed through it ends with `clampHp` on the wearer, as a Life rune may move the maximum.

## Gear at the encampment

See `docs/designs/expeditions-and-encampment.md`. A plain item's grade comes from the trading post and its modifier from crafting. A grade adds damage (and at Masterwork, to hit) to a weapon, armour class to a shield or a small-slot item, and resistance to body armour. A modifier trades one stat for another (Bearded a point of piercing a grade, Reinforced a point of resistance); Light alone moves a weapon's AP (the longsword and axe to 4 and 5), and nothing moves the bow off 4 AP. A damage bonus a modifier lowers may go below 0, so a hit's damage is kept at 0 or more (`rollHitDamage`).

Gold is the contested resource: the guild hall, recruits, the shrine, gear and crafts all want it. The far materials (stone, copper, silver, crystal, peat, salt) buy the higher levels of the trading post, workshop and infirmary and the higher grades of craft.

## Loot

`loot.ts`: rune loot after a win (`takeRunes` into the pouch), drawn from a stream of its own seeded from the battle's seed (`lootRng`), so the battle's dice are untouched. It rolls by threat, a nest's leader favouring its element (`FAVOURED_RUNES`); the rows past threat 7 and the Source's own are not written yet (the Source rolls threat 5's). `BattleScene.endBattle` calls `takeRunes` for a win at a monster location, and the simulator after each win; a debug `fight` rolls none.

## Ground

`ground.ts`: `Ground`, the loose items lying on a battlefield, one pile per hex, and `pileChanges`, which tells what a visit to the inventory dropped and picked up. `BattleScene` holds one `Ground` per battle; the engine does not track it; `fromPiles` puts a saved battle's back.

## Game state

`gameState.ts`: state that outlives a scene.

- `parties`: one to `MAX_PARTIES` (3) `Expedition`s, never none while a hero lives, each with its `members` (the `Party`), its `baggage` (a shared pile of items with no limit, into which `takeLoot(party, location)` moves a beaten location's loot), `position`, `confronting` and `order`.
- the `WorldState`, of a random world seed unless `newGame` is given one;
- the rune pouch `runes` (`Pouch`, saved, validated on load);
- the `reserves` waiting at the guild hall;
- the `story` (`src/story/`);
- the save `slot` it lives in. A game with no slot (`newGame()`'s default) is never saved: the simulator's, a test's.

A reader takes the party it acts for explicitly, from `partyById` or `selectedParty(game, id)` (the scenes' choice from their scene data, falling back to the first); a company-wide reader works over `game.parties`. The state is created by the party screen or read from a slot, and passed through scene data, never held in a module global.

## Saving

`save.ts` is the save format (a `SaveFile` to a string and back, storage-free); `saveSlots.ts` the three slots in `localStorage` (`yomi.save.1` to `3`), reached through `src/storage.ts`, the guarded `localStorage` the audio settings share.

### When the game saves

A playthrough lives in one slot from Begin to its end, written by the game itself (`saveGame`); there is no save button and only one save of a playthrough.

- `WorldScene` saves as it opens and after everything that changes the game: a journey, as it is begun; Next day and Until something happens likewise, before their walk plays; scouting, waiting or camping; the closing of the character panel.
- `BattleScene` saves each time the player's turn begins, the first included, with the battle: the party fighting (`SavedBattle.party`, an expedition id that `parseSave` checks against the game's parties and a load passes to `Battle`, so a reload fights that party and not the first), the engine's snapshot, where the enemy's RNG stands and the ground's piles. A reload therefore rewinds to the start of the turn, with the same dice.
- A victory is saved as it happens, before the victory screen is left.
- A defeat that leaves no hero in any party or the reserves deletes the slot (permadeath) and clears the game's `slot` so that nothing writes it back; so does the encampment's fall, on the world map. A defeat with heroes left elsewhere is saved as it happens, with no battle, the wiped party gone.
- A loaded battle builds its encounter again from the location, for the units' kinds and the experience it is worth, and takes everything else from the save.
- A browser that refuses storage still plays; the scene says once that the game could not be saved.

### Items in a save

In the saved string every `Item` is its id, put back by `itemById` as the constant or the graded, modified or runed item it builds and remembers, so identity comparisons hold after a load and an item's tuning reaches old saves. A new base or enchanted item must be in `BASE_ITEMS` or `MAGIC_ITEMS` or a game holding it cannot be loaded.

### Versions and migrations

`SAVE_VERSION` is 27. Raise it whenever the shape of `GameState`, `Character`, `WorldState` or `BattleSnapshot` changes. Saves need not stay compatible while the game is in development: break the format whenever a change calls for it, and raise the version rather than work around old saves. A migration is written only when a design asks for one; otherwise older saves read as unreadable, which the menu lists and will not load.

The migrations, each followed by a check as strict as a current save's, with captured fixtures in `src/game/fixtures/` (`save-v18.json`, `save-v22.json`, `save-v25.json`, `save-v26.json`):

- `migrateFrom18` (stage 5's design): a version-18 save, with one `party` and one `baggage` and the world holding the party's hex and confrontation, becomes version 22's shape (with the home, garrison and meet orders, a meet naming a party of the save) as a company of one, its battle if any naming `party_1`. Versions 19, 20 and 21 read as unreadable.
- `migrateFrom22` (the skill trees' design): for every hero of every party and the reserves, `spellcasting`, `quick_study` and unknown perk ids are dropped, the folded perks (`FOLDED`) are mapped onto their node, every node is held at one rank and kept even where its asks would now refuse it, `spellPicks` is deleted and mana is clamped to the new maximum; a saved battle is kept as it was.
- Version 23 has characters holding the trees' nodes at one rank and no `spellPicks`; version 24 adds `UnitRecord.moved` to a saved battle; version 25 the fields `attackedYet`, `endured`, `refunded`, `fallenThisBattle` and `usedOnce` (`BattleEngine.restore` takes what a unit lacks of them up as false or `[]`; a `UnitSnapshot` carries each only when set, as it does `moved`).
- `migrateFrom25` (the node-cost design), which every save of version 25 or older goes through: every hero of every party and the reserves keeps every node, with no refund, and has `max(0, pointsAt(level) − nodesCost(hero))` perk points, `perkPicks` deleted. `characterOf` asks `perkPoints` to be an integer of 0 or more.

- `migrateFrom26` (long campaign stage 7), which every older readable save goes through last: each id in the world's `outposts` becomes a level-1 entry of `improvements`, `outposts` is deleted, `lodge` is 0, and a party's day order of the `outpost` action becomes `improve`. The check asks `improvements` to be an object whose levels are 1, 2 or 3 and whose ids name resource locations, and `lodge` an integer from 0 to `MAX_LODGE_LEVEL`.

The chains: a version-26 save loads through `migrateFrom26` alone; a version-23, 24 or 25 save through `migrateFrom25` then `migrateFrom26`; a version-22 save through `migrateFrom22`, `migrateFrom25` and `migrateFrom26`; a version-18 save through `migrateFrom18` and then the rest.
