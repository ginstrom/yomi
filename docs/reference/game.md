# The game outside battle: reference

The full rules of `src/game/`: encounters and bandits, the company and its day loop, the world map, the blight, the encampment and its facilities, and saving. The working guide, with the contracts, is `src/game/CLAUDE.md`; the checklists are in `.claude/skills/yomi-add-content/`; this file holds the detail they leave out. The simulator and the balance figures are in `.claude/skills/yomi-balance/`.

## Encounters and foes

`encounters.ts` holds the battle setups, registered by id in `ENCOUNTERS`. A monster location on the world map names the `EncounterId` it leads to and the threat to fight it at, and the simulator fights `goblinRaid` unless told otherwise, so balance runs fight a battle the game has.

A setup is built for the party and the threat it is given: the threat decides how many of the encounter's foes take the field and their level (see Scaling). The party is a `Fighter` per member (stats and hit points left), lined up on the `PARTY_START` hexes, and member i's unit is named `heroId(i)`, which is how `BattleScene` finds the `Character` behind a unit. Each setup also maps unit ids to a `UnitKind`, which is how scenes pick a sprite and how `xpReward` prices the foes (`FOE_XP` times their level); the engine knows only stats.

A foe kind (`FoeKind`) is either a monster (`MonsterKind`), a stat block scaled from its native level (`FOE_NATIVE_LEVEL`), or a bandit (`BanditKind`, `bandits.ts`), built by hero rules. `foeStats(kind, level)` builds either.

Each encounter has a band of threats (`ENCOUNTER_BANDS`) and a foe count for each threat in it (`ENCOUNTER_COUNTS`); a threat outside the band is fought as the nearest in it. `encountersFor(threat)` lists the encounters whose band holds a threat. The blight's spawns draw from `SPAWN_KINDS` alone (see The blight). A location's threat comes from its ring (`THREAT_RINGS`, see Scaling), not from the counts.

The encounters worth knowing:

- Goblin Raid: its third foe is the Goblin Shaman (so it fights from threat 2) and its fourth the Kobold Sneak.
- Hobgoblin Warband (threat 2 on the map): the Hobgoblin Chief, resistance 4.
- Troll Lair (threat 5 only): the Armoured Troll (resistance 5, regeneration 2) beside a Troll (resistance 1, regeneration 3, `troll_claws` as one 8 AP routine standing still or one 4 AP claw after a move). The simulator's heroes never change weapons, so this is a report-only cell, won 0 or nearly 0 of 500 at threat 5, level 5.
- Bandit Camp (`bandit_camp`, threats 3 to 7): fields bandits, at four of the map's nests (the Bandit Camp, threat 3, the Bandit Hideout, threat 4, and the Wildland and Moorland Bandits, threat 7) and in the Bandit Gangs the blight spawns from threat 3.
- Bandit Company (`bandit_company`, threats 8 to 13, 4 foes: a Bandit Sergeant (a brute), a Crossbowman, a Hedge-Mage and an Archer; a Cutthroat waits for a count of 5) and Freebooter Host (`freebooter_host`, threats 14 to 20: a Freebooter Captain, a Brute, a Crossbowman and a Hedge-Mage, and an Archer from 17): the far rings' bandits (long-campaign stage 9): Bandit Companies at the fixed nests of the threat 9 and 12 rings, Freebooter Hosts at those of the threat 15 and 18 rings, and among the spawns from threat 7 (the Bandit Troop and the Freebooter Band).
- Spider Nest (`spider_nest`, threats 4 to 9; 3 foes at 4, a Giant Spider, a Kobold Sneak and a Brood Spider, and a Nest Spider too from 5): fights with abilities; the Giant Spider (native level 4) webs and bites. Today's map has it at threat 5 (the Spider Nest), 7 and 9 (the outer rings').
- Salamander Pool (`salamander_pool`, threats 5 to 9, 3 foes: a Salamander between two Kobolds; today's map has it at 5 (the Salamander Pool), 7 and 9 (the outer rings'): the Salamander (native level 5) spits fire and is warded against it (`wards.fire` 99), so Flame Arrow and Fireball deal it 0, though statuses land, and the policy's area rule counts only foes a spell can hurt.
- Source Guardians (`source_guardians`, threats 1 to 20; the map fights it at `SOURCE_THREAT`, 20, and the simulator's `--near-source` at 5): the Blight Horror, a boss whose claws pierce 2 points of resistance and which casts Death Cloud and Bane, with a Goblin Brute, a shaman and a Kobold Sneak; from threat 6 a Goblin Cutter too, so at `SOURCE_THREAT` (20, `worldMap.ts`) all five fight, raised to `SOURCE_FOE_LEVEL` (6) at most: a provisional block until stage 11 (stage 9 step 09: at level 20 they were barely hit (party hit rate about 0.28), and 7 and above won none of the levels tried).

The Salamander Pool and the Spider Nest spawn only from threat 7 (the Salamander Spring and the Spider Brood), though their bands reach lower: the home rings spawn as before stage 9.

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

Each item is named by catalog family in five ids, one a tier: iron, oak, yew (1), steel, ironwood (2), mithril, elderwood (3), adamant, wyrmwood (4), starmetal, heartwood (5). The gear is at `banditGear(threat)`, `{ tier, grade }`: tier 1 Fine at threats 3 and 5, tier 1 plain at 4, tier 2 Fine at 6 and 7, tier 2 Masterwork (grade 3) at 8, then by ring (long-campaign stage 10, at the expected kit's grades for those levels): tier 3 Fine at 9 to 11, tier 4 Fine at 12 to 17, tier 5 Masterwork from 18; the wand included, as it is a plain item. Mithril's and Starmetal's relief reach bandits through `deriveCombatStats`, as for heroes.

The camp's slots, in order, are the Captain, the Archer (from threat 5), the Hedge-Mage (from 4), the Crossbowman (from 6), the Brute and the Cutthroat, so each threat of today's map has its own second bandit (Brute at 3, Hedge-Mage at 4, Archer at 5). At 6 and 7 four take the field; the Brute and Cutthroat take the field there only once a count is raised to 5 or 6.

## Scaling

Monsters are the more dangerous the further from home they lie. A monster location's `threat` is its ring's (`threatAt`, `THREAT_RINGS` in `worldMap.ts`): by distance from the encampment, 1 up to 10 hexes, 2 to 21, 3 to 32, 4 to 43 and 5 to 54 (the home country's rings, 11 hexes wide as before stage 9), then 7 to 67, 9 to 80, 12 to 94, 15 to 108 and 18 to 122, and 18 beyond. The Source is fought at its own threat, `SOURCE_THREAT` (20). `WorldScene` tells the player the threat of the monsters it stands before.

Bands and counts (`ENCOUNTER_BANDS`, `ENCOUNTER_COUNTS`): the goblins', kobolds', hobgoblins' and trolls' four encounters cover threats 1 to 5 with 2, 3, 3, 3, 4 foes; the Bandit Camp 3 to 7 with 2, 2, 2 at threats 3 to 5 and 4, 4 at 6 and 7 (a first guess); the Source Guardians 1 to 20, today's 2, 3, 3, 3, 4 to 5 and then 5; the Spider Nest 4 to 9 with 3, then 4; the Salamander Pool 5 to 9 with 3; the Bandit Company 8 to 13 with 4; the Freebooter Host 14 to 20 with 4, 4, 4 and then 5 from 17. The counts past 5 are first values (stage 9), for the simulator to judge. A battle at threat T fields that many foes, all of level T (the Source's no higher than `SOURCE_FOE_LEVEL`), the first of the encounter's slots that take the field at T (`FoeSlot.fromThreat`).

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

- The encampment is the company's only settlement (`kind: 'encampment'`, `ENCAMPMENT_ID`), named by the player when the game begins (its location's `name`, read through `encampmentName`, never assumed to be Oakvale); every other quiet location is a resource.
- Five neutral **trade partners** (`kind: 'partner'`, `PARTNERS`, placed by `newWorld` after the resources and before the monsters) stand on the map: Millbrook (timber) in the threat 2 ring and Saltmere (salt) in the threat 3 ring, and the far partners of stage 9, Stonehollow (a mountain hold, mithril) in the threat 7 ring, Elder Glade (a forest people, elderwood) in the threat 12 ring and Emberwatch (a fortified pass, adamant) in the threat 15 ring. A party standing on one at the end of a day contacts it, for good (`partnerDay` in `trade.ts`, called by `updateTerritory` after the yields; `WorldState.contacted`, in contact order); a partner falls silent while its hex is at `LOSS_LEVEL` or worse and wakes when it is clean (`silent`, kept for every partner, `partner_silent` and `partner_restored` told only for contacted ones; `partner_silent` is notable). A partner is never held, never yields and is never lost.
- **Trade routes** (`trade.ts`; in full under "Trade partners and routes" below): from trading post level 4 (`ROUTE_SLOTS`: 1, 2 and 4 routes at levels 4 to 6) a party at the encampment opens a route to a contacted, unsilent partner (`openRouteRefusal`, `openRoute`; `routeCost`: 20 gold and one for every two hexes, and 10 timber). Its road (`roadTo`) is fixed when it opens: the shortest walk that keeps more than `RAID_RADIUS` (2) from every monster location, else one that keeps off them and their neighbours. Every yield day, after the partners' day (`tradeDay`), a route pays `floor(floor(1 + length / 10) × security)` gold, security being the mean over its hexes of 1 (clean, or tainted or blighted within `GUARD_RADIUS` 3 of a watchtower or a party), ½ (tainted) or 0, and every second yield day 1 of its partner's good at security ½ or more; nothing once the encampment is lost. A route is raided instead (`raidCause`: its partner silent, a road hex corrupted, or a nest within `RAID_RADIUS`), and abandoned after `ABANDON_AFTER` (6) raided yield days in a row; the first clear day restores it.
- The map (`WORLD_SIZE`, 140 × 72 since long-campaign stage 9) is several windows across. Home is at offset (9, 36), in the west. Stage 8's map (60 × 40) stands inside it moved by an axial translation, `EARLY_SHIFT` (q −9, r +17; on an odd-r board adding rows alone is not one), so every distance among home and stage 8's locations, and every threat they had, is kept: `earlyHex(col, row)` places stage 8's offset (an odd row keeps its column, an even one moves a column west; the row gains 17), and `newWorld` writes today's locations through it. The Source stands at `SOURCE_PLACE`, offset (131, 36), 122 hexes from home in the last ring, fought at `SOURCE_THREAT` (20), the last of the locations; `newWorld` takes another `SourcePlace` (the simulator's `--near-source` puts it at `earlyHex(58, 19)`, stage 8's place, at threat 5). The outer rings' locations (stage 9) stand at today's offsets (`offsetToHex`), listed below. `WorldScene` scrolls it to follow the party, or to where a drag pans it (a press that moves no more than `DRAG_THRESHOLD_PX` is a click to travel), until the next journey, Home or a click on the party's entry in the list down its right brings it back to the selected party (`centreOnSelected`).
- Time passes in turns, one per hex travelled, and every turn is the blight's day (`passTurn`). Journeys and camping pass their days through the day loop. An order outlasts an interrupt: a cut-short walk or camp is still the party's order, and the next day carries it on. Every one-day action is a one-day order through the same loop, after which the party is idle.
- A party may be sent home (from anywhere away from the encampment), set to garrison a held resource it stands on, or sent to meet another party (by a click on that party's hex); two parties sharing a hex may trade heroes and baggage (`exchange`, the `Exchange` scene).
- **The outer rings** (stage 9). `newWorld` lists the encampment, today's resources, the outer rings' seven (ring order), the partners (`PARTNERS` order), today's nests, the outer rings' 24 (ring order) and the Source last. Every outer nest is at `threatAt` of its hex, inside its encounter's band, at least `SPAWN_CLEARANCE` from every other nest; every partner at least `RAID_RADIUS` + 2 from every nest (so its strict road exists), every outer site at least 5 (so it can be held once cleaned); nothing but the Source within 4 of it. Each ring's nests spread north, east and south. By ring (offset; loot one of today's uniques each):
  - threat 7 (55 to 67 hexes): Wildland Bandits (55, 6) and Moorland Bandits (62, 52), Bandit Camps; Webwood Nest (62, 20) and Hollow Spiders (55, 67), Spider Nests; Ashen Pool (70, 36), a Salamander Pool. The Ironwood Grove (65, 44); Stonehollow (58, 13).
  - threat 9 (68 to 80): Ironhold Company (67, 4) and Grey Company (74, 54), Bandit Companies; Cinder Springs (74, 18) and Smoking Mere (66, 69), Salamander Pools; Deepweb Hollow (83, 36), a Spider Nest. The Mithril Lode (70, 10) and the Elder Grove (70, 62).
  - threat 12 (81 to 94): Bandit Companies at Ravenhill (80, 5), Stonegate (88, 20), Thornwall (96, 36), Marsh (88, 52) and Dustroad (80, 67). The Adamant Deep (93, 28); Elder Glade (85, 60).
  - threat 15 (95 to 108): Freebooter Hosts, the Red (95, 6) and Grey Freebooters (102, 20), Wolfhead (110, 36), Saltwind (102, 52) and Black Banner Host (95, 66). The Wyrmwood Thicket (107, 44); Emberwatch (97, 13).
  - threat 18 (109 to 122): Freebooter Hosts, the Iron Freebooters (110, 8), the Ashen Host (117, 22), the Last Host (117, 50) and the Blightmarch Freebooters (110, 64), about the Source. The Fallen Star (122, 30) and the Heartwood (114, 58).

  The outer sites start on blighted land, so none is held at the start. On `newWorld(1)` the strict road to each partner is a straight walk: Millbrook 14 hexes, Saltmere 30, Stonehollow 61, Elder Glade 88, Emberwatch 100.
- A journey is walked a hex and a turn at a time and stops where a notable event happens (`isNotable`: monsters sighted within `NOTICE_RADIUS` of some party's presence, the Source wherever it is sighted, a held site or tower newly under threat or lost, the encampment lost, a contacted trade partner fallen silent, a trade route raided (the day it turns raided) or abandoned; a spawn is told only when sighted) or where monsters stand on the road. Routes keep clear of every sighted monster location except one they end on, and go through the unexplored as through open land.
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

- for the blight: a monster location with `BLIGHT_PER_THREAT` × its threat up to `BLIGHT_THREAT_CAP` (5: the outer rings' nests push as a threat-5 nest does, stage 9), the Source with `SOURCE_STRENGTH`, each corrupted neighbour with `CREEP`, all times the blight's growth with time (`blightGrowth`: a tenth more every 30 days, to half again at day 151, worked out from the turn);
- against it: the encampment (`CAMP_STRENGTH`, more with its shrine), each held resource (more with an improvement), each trade partner (`PARTNER_STRENGTH`, 3, silent or not), each watchtower (`TOWER_STRENGTH`), each hex of each open route's road once the Builders' Lodge is at 3 (`ROAD_STRENGTH`, 1) and each party (each presence, in list order), with `PARTY_BASE` and half its levels together (`partyStrength`; nothing else of a party counts).

A monster location's hex stays blighted or worse until it is beaten. Each party's hex is neutral, so the blight never rises there nor creeps from it, but the parties' influence lowers it. The fixed sources' influence is worked out again only when a location or a held site changes (`fields`, a memo outside the state).

Corrupted land builds spawn pressure, and each `SPAWN_COST` of it puts a monster location on corrupted land clear of every party, the nests and the held sites (and `SPAWN_CLEARANCE` from towers), drawn with the world RNG, at the threat of where it lies (`threatAt`, never the blight or the date, so the home band's nests stay ones a weak party can beat). Its kind is drawn among the `SPAWN_KINDS` whose encounter band holds that threat and whose `fromThreat` (1 unless given) it reaches: a Goblin Brood and a Kobold Nest to threat 5, a Bandit Gang from 3 to 7, and from threat 7 the outer rings' four (a Spider Brood and a Salamander Spring at 7 and 9, a Bandit Troop at 9 and 12, a Freebooter Band at 15 and 18), which go after the first three so the home rings draw as before stage 9. Every ring's threat has a kind; with none, no spawn and the RNG untouched. Spawn pressure grows each day by the corrupted hexes over `SPAWN_DIVISOR` (840, stage 8's 200 scaled by the board's area, 140 × 72 over 60 × 40, for the same pressure per hex), times the growth, and no spawn comes while `MAX_MONSTER_LOCATIONS` (60) monster locations stand.

A won battle lowers the land within 1 + its threat by two levels (`cleanse`). The Source (`SOURCE_ID`) lies far in the east, 122 hexes out, where its push does not reach home. The constants were tuned with the campaign simulator, not by design.

### Territory

`territory.ts`. A resource is held while its land is clean enough: captured at level 0, lost at its `lossLevel` (`LOSS_LEVEL`, 2; a fort's `MAX_BLIGHT`, 3: only when corrupted), under threat (with the days until it falls, `daysToFall`) while the blight is gaining on it. Every `YIELD_DAYS` each held site adds its yield to the encampment's `stock`, half if tainted, which the buildings and the guild hall spend (`updateTerritory`, which then runs the partners' day and, on yield days, the trade routes'). A watchtower is lost, and warned of, as a held site is, at `LOSS_LEVEL`. A site lost razes its improvement, of whatever level (`site_lost` with `improvement`, the level razed).

### Trade partners and routes

`trade.ts` (long campaign stage 8). Its constants: `ROUTE_BASE` 1, `ROUTE_HEXES_PER_GOLD` 10, `ROUTE_COST_GOLD` 20, `ROUTE_HEXES_PER_COST_GOLD` 2, `ROUTE_TIMBER` 10, `ROUTE_SLOTS` `[0, 0, 0, 1, 2, 4]` (by trading post level), `GUARD_RADIUS` 3, `RAID_RADIUS` 2, `ABANDON_AFTER` 6; in `blight.ts`, `PARTNER_STRENGTH` 3 and `ROAD_STRENGTH` 1; in `buildings.ts`, `ROAD_LODGE_LEVEL` 3.

- **Partners.** `PARTNERS` (`worldMap.ts`): Millbrook at `earlyHex(18, 30)` (offset (17, 47)), good timber; Saltmere at `earlyHex(30, 38)` (offset (29, 55)), good salt; Stonehollow at offset (58, 13), good mithril; Elder Glade at (85, 60), elderwood; Emberwatch at (97, 13), adamant. `newWorld(seed, name, partners = PARTNERS)` places copies after the resources and before the monsters. `sites()` leaves them out: a partner is never held, never yields, never lost. Each is a clean source of `PARTNER_STRENGTH` whether silent or not, so silence never touches the fields memo.
- **Contact and silence** (`partnerDay(world, presences)`, called by `updateTerritory` every day after the yields): every presence standing on an uncontacted partner's hex contacts it (`contactPartner`, `WorldState.contacted` in contact order; `partner_contacted { partner, name, home }`, not notable). Then each partner at `LOSS_LEVEL` or worse falls silent and each silent one at 0 wakes (`WorldState.silent`, kept for every partner); `partner_silent` (notable) and `partner_restored` are emitted only for contacted partners.
- **Opening a route** (`openRouteRefusal(game, party, partnerId)`, then the time-free `openRoute`, which spends `routeCost`, pushes `{ id: 'route_<partner>', partner, road, opened, raidedDays: 0, raided: false }` to `WorldState.routes`, adds 1 to `routesOpened` and returns `route_opened { route, partner, name, length }`). The refusals, in order: "Routes are opened at <encampment>.", `No partner "<id>".`, "<name> has not been contacted: walk there first.", "<name> is silent while the blight holds its land.", "A route to <name> is already open.", "Routes need the Market (trading post level 4).", "The <post name> keeps <n> route(s) open at most." (`routeLimit`), "No safe road to <name>.", "The route costs <cost>, more than the stock holds." `routeCost(length)` is `ROUTE_COST_GOLD` + one gold for every `ROUTE_HEXES_PER_COST_GOLD` hexes, and `ROUTE_TIMBER` timber.
- **The road** (`roadTo`, fixed when the route opens): a breadth-first walk from the encampment (its hex excluded, the partner's included; length is the hex count) over the board with every hex within `RAID_RADIUS` of any monster location impassable, sighted or not (the rules use the true state), the partner's hex always passable; when that finds nothing, the looser walk that only keeps off every monster location and its neighbours. Deterministic, ties by neighbour order. A looser road, or a nest within 2 of the partner itself, can be raided the day it opens. On today's map Millbrook's road is 14 hexes (27 gold, 10 timber) and Saltmere's 30 (35 gold) while the home nests stand.
- **Security** (`hexSecurity`, `routeSecurity` the mean over the road): 1 for a clean hex or a guarded one (`guarded`: tainted or blighted, within `GUARD_RADIUS` of a standing watchtower or any presence), ½ tainted, 0 blighted unguarded or corrupted. Watchtowers still need clean land (`towerHexRefusal`, the place rules of `towerSiteRefusal` for any hex), so a tower guards a road stretch from clean land beside it.
- **Income** (`tradeDay(world, presences)`, every `YIELD_DAYS` after `partnerDay`; nothing once the encampment is lost): each route in order pays `routeIncome`, `floor(floor(ROUTE_BASE + length / ROUTE_HEXES_PER_GOLD) × security)` gold, and on a yield day whose `turn / YIELD_DAYS` is even, 1 of its partner's good while security is ½ or more; each payment is a `yield` with `source: 'route'` and `route`, `site` the partner's id (`YieldSource` is `'site' | 'market' | 'route'`). Previews (the Routes tab, the road's hover) count towers only, `routeIncome(world, road, [])`.
- **Raids** (`raidCause(world, { partner, road })`, the first that holds: the partner is silent; a road hex is corrupted; `raiders(world, road)[0]`, the monster locations within `RAID_RADIUS` of any road hex, nearest first). `tradeDay` checks every day: the day a route becomes raided it emits `route_raided { route, partner, name, cause, raider?, raiderName?, days: 0 }` (notable: it stops a journey, has the message line and the cue), yield day or not, and the day it stops being raided `route_restored` (not notable); once each, by the saved `TradeRoute.raided`. On yield days a raided route pays nothing, `raidedDays` rises and `route_raided` is emitted with that count (`days` 1, 2, …: not notable, no line); at `ABANDON_AFTER` raided yield days in a row (30 days) `route_abandoned` follows (notable) and the route is removed, freeing its slot. The count starts afresh the day the route is told safe (`route_restored` sets `raidedDays` to 0, the user's decision), so abandonment always needs six raided yield days in a row after the last "safe again"; a clear yield day pays as usual.
- **Roads in the blight.** From Builders' Lodge level 3 (`ROAD_LODGE_LEVEL`), each hex of each open road is a clean source of `ROAD_STRENGTH`, one per hex per route; an abandoned route's road stops at once.

## Buildings

`buildings.ts`: what the stock builds, and the stock's arithmetic (`canAfford`, `spend`).

- Watchtower: built where a party stands. `canBuildTower(world, party)` gives the reason it cannot (`towerHexRefusal(world, at)` the place rules alone, for any hex); `buildTower(game, party)` builds it as a one-day order, over `raiseTower`, which spends and raises it with no time passing. A tower is `WorldState.towers`, not a location: blight.ts counts it a clean source, vision.ts a watcher, and territory.ts loses it as a held site.
- Shrine: raised a level at a time by a party at the encampment (`atEncampment(world, party)`, `raiseShrine`, no time passing), each level adding `SHRINE_STRENGTH` to the encampment. It is `WorldState.shrine`.
- Improvements: a held resource (`improvementSite`; never the encampment) is raised a level at a time by the party standing on it (`improveSite`, a one-day order over `raiseImprovement`, which spends and raises with no time passing and returns `site_improved` with the level and its name). `WorldState.improvements` maps a site's id to its level (`siteImprovement`, 0 for none), read by blight.ts's `siteStrength` (`IMPROVEMENT_STRENGTH`) and territory.ts's `siteYield` (`IMPROVEMENT_YIELD`) and `lossLevel`:

  | Level | Name (`improvementName`) | Needs (`IMPROVEMENT_LODGE`) | Cost (`IMPROVEMENT_COSTS`) | Yield, on the site's 2 | Strength, on `SITE_STRENGTH` 3 | Lost at |
  | --- | --- | --- | --- | --- | --- | --- |
  | 1 | Outpost | — | 15 gold, 10 timber | +1 | +3 | 2 |
  | 2 | works, by material (`WORKS_NAMES`: Mine for iron, gold, silver, copper, crystal, mithril, adamant and starmetal; Lumber Camp for timber, ironwood, elderwood, wyrmwood and heartwood; Quarry, Saltworks, Peat Cuttings) | Lodge 1 | 30 gold, 15 stone | +3 | +3 | 2 |
  | 3 | Fort | Lodge 2 | 50 gold, 20 iron, 10 stone | +3 | +7 | 3 (corrupted) |

  `improveRefusal(world, party)` refuses in order: "Nothing can be built here now." (the game over, or among monsters), "Improvements go on a held resource.", "<site> is as strong as it gets." (a fort), "<A Mine> needs the Builders' Lodge." ("need" for a plural name: "Saltworks need …", "Peat Cuttings need …"; "… at level 2." for a fort), "<An Outpost> costs …, more than the stock holds." (`withArticle`); `improveSiteRefusal` is its first three.
- Builders' Lodge: `WorldState.lodge`, 0 to `MAX_LODGE_LEVEL` (3), raised a level at a time by a party at the encampment (`raiseLodge(game, party)`, no time passing; `lodgeCost`, `LODGE_COSTS`: 30 gold and 20 timber, 60 gold and 25 stone, 100 gold, 20 iron and 20 stone). Level 1 allows works, 2 forts; level 3 (`ROAD_LODGE_LEVEL`) makes every open trade route's road a clean source of `ROAD_STRENGTH` (1) in the blight's contest (blight.ts `sources`); at the top `raiseLodge` refuses "The Builders' Lodge is as great as it gets."

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

`tradingPost.ts` (`WorldState.tradingPost`, built from the start at 1, up to 6). Levels 1 to 3 sell tier 1 at grades up to the level; 4 adds tier 2 at every grade (`sells`), and 5 and 6 sell as 4 does. From `GOODS_LEVEL` 5 (the Market Hall) it also sells partners' goods into the stock at `GOOD_PRICE` 3 gold a unit, in any whole amount: `goodsForSale(world)` lists each contacted, not silent partner's good in `PARTNERS` order, Elder Glade's wyvern hide after its elderwood as the stand-in until stage 11 (`STAND_IN_GOODS`; basilisk and drake scale have no source yet). `buyGoodRefusal` checks, in order: away from the encampment; the post below 5; no listed partner sells it ("No partner sells <material> here."); an amount that is not a whole number of at least 1; the gold short. The simulator never buys goods. It never sells tier 3 and up (`buyPrice` null; 'The trading post does not sell that; the workshop forges it.'), and buys such an item for half its `forgedValue` (crafting.ts) and its runes. `TRADING_POST_COSTS` is 40 gold 15 stone, 80 gold 15 copper, 120 gold 20 silver, 160 gold 30 silver 20 stone, 220 gold 40 silver 10 crystal for levels 2 to 6. `tradingPostName` calls levels 1 to 3 the Trading Post, then the Market, Market Hall and Trading House. Levels 4 to 6 bring gold: `MARKET_INCOME` 2, 3 and 5 every `YIELD_DAYS`, added to the stock after the sites' yields as a `yield` event with `source: 'market'` (a site's yield has no source), halved and rounded down while the encampment's hex is tainted (`territory.ts`). `wares(world, filter)` lists what it sells, narrowed by slot or family.

- Buying plain items at a grade into the baggage, priced by family (`PRICES`) times the tier's and the grade's multipliers (`TIER_PRICE`, `GRADE_PRICE`).
- Selling from the baggage and backpacks (never what is worn) for half; a modifier adds nothing, an enchanted item sells for half its `VALUES`, a tier-3+ item for half its `forgedValue`, and an embedded rune adds half its price (`salePrice`). The post never sells a runed item.
- Runes (`runeWares`): Ember, Rime, Storm, Stone, Wind and Life at rank 1 from level 2 and rank 2 from level 4, `RUNE_PRICES` 15, 45, 135, 405 by rank. `buyRune` puts one in the pouch (`GameState.runes`); `sellRune` sells from it for a third.
- Materials sell two for a gold piece, the outer rings' seven and the trophies too; the post never sells materials.

### Builders' Lodge

`WorldState.lodge`, 0 (not built) to `MAX_LODGE_LEVEL` 3, raised by `raiseLodge` at the encampment (`LODGE_COSTS`, buildings.ts). It allows works (level 1) and forts (level 2). Level 3 (`ROAD_LODGE_LEVEL`) is roads: each hex of each open route's road is a clean source of `ROAD_STRENGTH` (1), one per hex per route, reaching only its own hex; raising the Lodge to 3 while routes are open starts them pushing the next day (the fields memo is keyed on the source list). A facility may carry a `refusal` checked before the stock (none does now).

### Crafting

`crafting.ts`: putting a modifier at a grade on an item where it lies (`craft`), replacing any it had. In the field (`craftTier` is `'field'` anywhere the party may camp, the encampment without a workshop included), the field modifiers at grade 1, in a day, a one-day order over `craftRefusal` and `applyCraft`, which take no time. At the workshop (`WorldState.workshop`), the modifiers its level unlocks up to the grade of its level (`highestGrade`, never above 3: levels 4 to 6 make grade 3), no time passing. A modifier's cost (`craftCost`) is gold 5, 10 or 20 by grade with 5 iron (timber for a wood family), copper or crystal; on a tier-3+ item, 5 of its tier's stock material in their place. `craftables` lists every item some modifier fits, and every tier-3+ plain item even where none does (it can be tempered; its refusal is then "No modifier fits it.").

The workshop has six levels (`WORKSHOP_COSTS`, `MAX_WORKSHOP_LEVEL` 6): 25 gold 15 iron, 40 gold 15 stone, 60 gold 10 crystal, 100 gold 20 mithril, 150 gold 20 adamant, 200 gold 10 starmetal.

**Forging** (stage 10): tiers 3 to 5, which the trading post never sells. Level 4 forges tier 3, 5 tier 4, 6 tier 5 (`FORGE_LEVEL`). `forgeCost(family, material)` is `FORGE_GOLD` 30, 50, 80 gold and `FORGE_MATERIAL` 8, 10, 12 of the catalog material's stock material (`MaterialDef.stock`: an ore or wood its own; Wyvern-hide, Basilisk-scale and Drake-scale the trophies `wyvern_hide`, `basilisk_scale`, `drake_scale`; the cloths Mithrilweave, Adamantweave and Starweave the tier's ore), the material doubled for a two-handed family and for plate. `forgeOptions(game, party, slot?)` lists, in `FAMILIES` then `MATERIALS` order, every family (of `slot`) in each tier-3+ material of its kind whose level the workshop has reached, with its cost and refusal. `forgeRefusal` checks, in order: away from the encampment ("The workshop is at …"); no such family or material ("The workshop forges no such thing."); a material of another kind ("A Longsword is not made of Elderwood."); tier 1 or 2 ("The trading post sells tiers 1 and 2."); the workshop below the tier's level ("Forging Mithril needs a level 4 workshop."); the stock short. `forge` spends the cost and puts the plain item in the party's baggage; no time passes.

**Tempering**: a tier-3+ plain item straight to Fine or Masterwork, from workshop level 3 (`TEMPER_LEVEL`), at `temperCost` gold tier × 10 × grade and 4 × grade of the tier's stock material. It keeps the modifier and runes (a Masterwork item gains a socket) and puts the item back where it lay (`replaceAt`, so `clampHp`). `temperRefusal` checks, in order: a stale place; away; the workshop below 3; an enchanted item; tier 1 or 2 ("The trading post sells the grades of tiers 1 and 2."); a grade not above the item's ("Mithril Longsword is Fine already."); the stock short.

A forged item is worth `forgedValue`: 1.5 × (its tier's forge gold + the temper gold of its grade), the material not counted; the post pays half, plus half its runes' prices.

### Runecraft

`runecraft.ts`: runes moved between the pouch and an item's sockets where it lies.

- `embed` fills the next empty socket, at the workshop of any level for any rank, or a rank-1 rune in the field (where the party may camp) for a day, a one-day order over `embedRefusal` and `applyEmbed`. 5 gold a rank.
- `fuse` makes three of a rune one of the next rank: to rank 2 from workshop level 1; rank 3 (Greater) from level 4 and rank 4 (Grand) from level 5 (`FUSE_LEVELS`), the refusal naming the level and checked before the count. 10 gold a rank of the new rune.
- `extract` takes a rune back intact from workshop level 2, the rest closing up. 10 gold a rank.

No time passes at the workshop. A change to a worn item keeps its wearer's share of hit points (`replaceAt` ends with `clampHp`).

### Infirmary

`infirmary.ts` (`WorldState.infirmary`) and `restHealing`, what a day's camping heals a member where the party stands, which `campDay` uses.

### Item places

`itemPlace.ts`: `ItemPlace`, where an item the trading post or crafting acts on lies (baggage, worn, backpack) in the party it names (`party`, an id), with the id expected there, so a place that no longer holds it, or whose party is unknown, is refused as stale (`placeKey` leaves the party out). Functions that list, buy or recruit take the acting party after `game`, and `allPlaces(game, party, worn?)` lists one party's places. A worn item replaced or removed through it ends with `clampHp` on the wearer, as a Life rune may move the maximum.

## Gear at the encampment

See `docs/designs/expeditions-and-encampment.md`. A plain item's grade comes from the trading post and its modifier from crafting. A grade adds damage (and at Masterwork, to hit) to a weapon, armour class to a shield or a small-slot item, and resistance to body armour. A modifier trades one stat for another (Bearded a point of piercing a grade, Reinforced a point of resistance); Light alone moves a weapon's AP (the longsword and axe to 4 and 5), and nothing moves the bow off 4 AP. A damage bonus a modifier lowers may go below 0, so a hit's damage is kept at 0 or more (`rollHitDamage`).

Gold is the contested resource: the guild hall, recruits, the shrine, gear and crafts all want it. The far materials (stone, copper, silver, crystal, peat, salt) buy the higher levels of the trading post, workshop and infirmary and the higher grades of craft. The outer rings' seven (stage 9: ironwood, mithril, elderwood, adamant, wyrmwood, starmetal, heartwood, each 2 a yield day from its site) forge tiers 3 to 5 and raise the workshop to levels 4 to 6 (stage 10), and sell at the trading post. The trophies (`wolfhide`, `wyvern_hide`, `basilisk_scale`, `drake_scale`, stage 10) are stock materials no site yields; they forge the hide tiers. Stock text names a material by `materialName` (`wyvern_hide` reads "wyvern hide"), as `describeCost` does.

## Loot

`loot.ts`: rune loot after a win (`takeRunes` into the pouch), drawn from a stream of its own seeded from the battle's seed (`lootRng`), so the battle's dice are untouched. It rolls by threat, each rune drawing its kind (a nest's leader favouring its element, `FAVOURED_RUNES`, at half) and then its rank: threats 1 to 3, a rune at half, rank 1; 4 to 8, one, rank 1 at 70% else 2; 9 to 13, one and a second at half (drawn first), each rank 2 at 60% else 3; 14 up to `SOURCE_THREAT` − 1, two, each rank 4 at 15%, 3 at 60%, else 2; `SOURCE_THREAT` (20) and above, three, each rank 3 at half, else 4. The rows go by threat, so the Source near home (threat 5) rolls threat 5's. `BattleScene.endBattle` calls `takeRunes` for a win at a monster location, and the simulator after each win; a debug `fight` rolls none.

Trophies: `TROPHIES` (encounters.ts) gives a foe kind's `Trophy` (a stock material and an amount). It is empty until stage 11 adds the kinds of gear §4.3 (wolves and worgs wolfhide 1 a foe, wyverns wyvern hide 3, basilisks basilisk scale 3, young dragons drake scale 6, elder wyrms drake scale 10). `trophiesFor(kinds, table?)` sums each foe's trophy (a hero, `'warrior'`, leaves none), and `takeTrophies(game, kinds, table?)` adds them to the stock and returns them; neither draws. Nothing calls `takeTrophies` yet (the victory screen and the simulator do from stage 10's later steps).

## The auto-resolve estimate

`forecast.ts`: sample battles played headless on seeds of their own, worked a step at a time, and the words that tell the estimate. It draws from neither the world RNG nor a battle's stream: each sample has its own engine and policy streams, seeded by hashing, with a salt, the battle's seed and log length (mid-battle) or the location, party and day (world map); nothing in it draws from the real battle, the world's RNG or `Math.random`.

Its cost is nearly all the engine and the `aggressive` policy (`legalActions`, and in it the pathfinder). `node scripts/forecastCost.ts [--samples N] [--runs N]` times an estimate (wall clock and CPU time, a sample, rounds a sample) for the ready-made party raised to 6, 12, 15 and 18 in a kit of tier 2 to 5, against bandit_company 9 and 12 and freebooter_host 15 and 18, and a mid-battle start. Long-campaign stage 10 step 07 made it about 6 times faster with every estimate and every battle byte-identical: `legalActions` reads the actor's stats once rather than per hex, a burst's touch is a distance, `reachable` finds the blocked hexes and the foes that could react once a search, `reachableHexes` keeps routes as links and numeric keys, and `autoPlay` gives policies `legalFor` so `aggressive` lists only the units it weighs (level 15, tier 4, against freebooter_host 15: about 3.0 s of CPU before, 0.45 s after, on a loaded machine; `docs/implementation-plans/long-campaign-stage-10/log.md`). `forecast.test.ts`'s estimate fixture, recorded before that change, holds the exact `Forecast` and a hash of every sample's log for 18 starts (levels 1 to 18, every encounter, mid-battle snapshots, one that stalls): a change that alters any estimate fails it. Seen in the dev build (step 11's play script, a threat 15 Freebooter Host at level 15, load average 5 to 7 on 10 cores): "Auto (…)" lasts 42 to 66 frames, which is 2.6 to 4.7 s of wall clock, because a frame costs about 60 ms while the estimate works (60 frames a second when it is done); step 07's "under 1 s" was a count of frames at 60 a second.

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

`SAVE_VERSION` is 31 (stage 10: the trophies among the stock's materials; no migration). Raise it whenever the shape of `GameState`, `Character`, `WorldState` or `BattleSnapshot` changes. Saves need not stay compatible while the game is in development: break the format whenever a change calls for it, and raise the version rather than work around old saves. A migration is written only when a design asks for one; otherwise older saves read as unreadable, which the menu lists and will not load. A migration ends with the same strict check as a current save and gets a captured fixture in `src/game/fixtures/`.

Version 31 (stage 10) adds the trophies to the stock's materials (`Material`); no migration. Version 30 (long campaign stage 9) is the 140 × 72 board, every location moved by `EARLY_SHIFT` and the Source far out at threat 20: a new map, so an older world cannot go on; no migration. Version 29 (stage 8's verification) adds a route's `raided` flag (a raid told the day it starts), with no migration. Version 28 (long campaign stage 8) adds the trade partners as locations and the world's `contacted`, `silent`, `routes` and `routesOpened`. By the user's decision it has no migration: every older save reads as unreadable, and with it went the chain that read versions 18 to 26 as 27 (`migrateFrom18`, `migrateFrom22`, `migrateFrom25`, `migrateFrom26`; the git history before stage 8 holds what each did). The captured fixtures in `src/game/fixtures/` (`save-v18.json`, `save-v22.json`, `save-v25.json`, `save-v26.json`, `save-v27.json`) stay, as tests that each older version is refused. The strict check asks every partner's `good` to be a material, `contacted` and `silent` to be distinct ids of partner locations, `routes` to be `TradeRoute`s to contacted partners, one at most to each (`id` `route_<partner>`, hexes for `road`, integer `opened`, `raidedDays` of 0 or more) and `routesOpened` an integer of 0 or more, as well as `improvements` an object whose levels are 1, 2 or 3 and whose ids name resource locations, and `lodge` an integer from 0 to `MAX_LODGE_LEVEL`.
