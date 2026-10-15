# The Guild Hall, Watchtowers and Fog of War

## 1. Purpose and status

The blight design left buildings open (its §9) and gave the encampment's stock nothing to buy. This design adds the first two buildings, one for each of the blight's loops:

- **The guild hall** at the encampment holds a **roster** of heroes beyond the party. The player recruits there, swaps members in and out, replaces the dead, and upgrades the hall to field a larger party (3, then 4, then 5).
- **Watchtowers** are built in the field by a party standing on clean land. A tower pushes back the blight and watches the land around it.
- Watching needs something to watch, so the world map gains **fog of war**. The party, the encampment, held sites and watchtowers see a radius around them; the rest is unexplored or remembered as it was last seen.

**Status: implemented, all four phases, and retuned through the Source's own encounter (see the closing notes).** The user set the scope: a guild hall with a roster, recruiting, swapping, replacing the dead and upgrades for party size; watchtowers built by an occupying party on blight-free land, giving influence and vision; and fog of war. The user then decided the four rule questions (§9). Costs, strengths and radii are starting points for the simulator, not decisions.

Related:
- [blight.md](blight.md): the stock, influence, held sites and the encampment. This design is its phase 4, in part: the guild hall is the "barracks" of its §4.6, and the watchtower is its first field building.
- [expeditions-and-encampment.md](expeditions-and-encampment.md) warned that reserves need deployment, XP, recovery and equipment settled together (§5.4 there). §4.2 settles them for the simplest case: one party, with the roster waiting at home.

## 2. Requirements

| ID | Requirement |
| --- | --- |
| R1 | **Guild hall:** the encampment has a guild hall from the start, at level 1. It is used while the party stands at Oakvale. |
| R2 | **Roster:** heroes not in the party wait at the guild hall as reserves. While at Oakvale, the player can move members between the party and the reserves. |
| R3 | **Recruiting:** the guild hall recruits new heroes into the reserves, from the pre-rolled characters or by character creation, for a price from the stock. |
| R4 | **The dead:** a member who falls in battle dies, won battle or lost, and leaves the company for good. The guild hall is where the player replaces them. |
| R5 | **Upgrades:** the guild hall can be raised to level 2 and level 3 for a price from the stock. Its level sets the party limit: 3, 4 and 5. |
| R6 | **Watchtowers:** a party standing on a level-0 hex may build a watchtower there for a price from the stock. The hex must hold no location or other tower. |
| R7 | **A tower's influence:** a watchtower is a clean source in the blight's contest. Blight takes it like a held site: it is lost at level 2. |
| R8 | **Fog of war:** each hex is unexplored, explored (remembered as last seen) or in sight. The map shows the blight and the monster locations only where they are in sight, and as remembered elsewhere. |
| R9 | **Vision:** the party, the encampment, held sites and watchtowers each see the hexes within a radius. A watchtower sees furthest. |
| R10 | **Determinism and code:** rules stay Phaser-free, vision draws no dice, and the simulator plays the new rules. |

**Non-goals:**
- Other improvements: shrine, infirmary, workshop and crafting.
- Multiple parties. The roster waits at home and does not act.
- Moving monsters, and line of sight on the world map. Vision is a radius; nothing blocks it.
- Gear for recruits beyond the starting kit that creation already gives.

## 3. Current system

- **Party limit:** `GameState.partyLimit` starts at `STARTING_PARTY_LIMIT` (3). Nothing raises it. `MAX_PARTY_SIZE` (6) is what `PARTY_START` has hexes for (`src/game/party.ts`).
- **The party screen** (`PartyScene`) builds a party of drafts up to the limit, from `PREROLLS` or `CreationScene`, which returns its draft to `Party` by scene data. A name must be unique in the party.
- **Falling:** a member who falls in a won battle gets back up at `REVIVED_HP` (`rewardVictory`). Only a party wipe kills, and it ends the game.
- **The stock:** held sites add to `WorldState.stock` every 5 days (`territory.ts`). Nothing spends it. Starting holdings pay about 4 gold and 2 iron every 5 days, and capturing further sites adds timber, stone and other materials.
- **Clean sources:** the encampment, held towns and resources, and the party (`blight.ts`, `sources`, `fields`). Held sites are lost at level 2 (`LOSS_LEVEL`).
- **The world map** shows everything. `routeTo` avoids every monster location and `isNotable` treats every spawn within `NOTICE_RADIUS` as notable.

## 4. Rules (provisional)

### 4.1 The guild hall

- **Where:** it stands at the encampment. The **Guild Hall** button shows in the world map's footer while the party stands on Oakvale's hex, next to Camp.
- **Levels:**

  | Level | Party limit | Upgrade cost |
  | --- | --- | --- |
  | 1 | 3 | (start) |
  | 2 | 4 | 30 gold, 15 iron |
  | 3 | 5 | 60 gold, 30 iron (built; 20 timber and 20 stone were proposed) |

  Level 3 asks for timber and stone, so it needs sites captured beyond the home valley (Timber Stand, Old Quarry): the second loop's "develop the encampment → more power".
- **Party limit is derived.** `partyLimit` leaves `GameState`. The limit is read from the hall's level, so no stored number can disagree with it. `MAX_PARTY_SIZE` stays 6 as the technical cap.
- **An upgrade** takes effect at once and costs no time.

### 4.2 The roster

- **Reserves:** `GameState.reserves`, the heroes at the guild hall who are not in the party, up to `MAX_RESERVES` (4).
- **Swapping** happens only at the guild hall. The player can move a member to the reserves, move a reserve into the party while it is under the limit, or exchange the two. The party may never be empty. Names stay unique across the whole company, party and reserves together.
- **Gear:** a hero keeps what they wear and carry. The baggage stays with the party.
- **Reserves rest.** A reserve joins the party with full hit points and mana. Waiting at home is resting, which needs no daily bookkeeping.
- **Experience:** reserves earn none. The party's rewards go to the party. Ways for reserves and raw recruits to grow are a later mechanic, out of scope here: stationing them at guard posts or watchtowers to gain levels slowly, training facilities at the encampment, or low-level scouting parties.

### 4.3 Recruiting

- **Who:** any pre-roll not already in the company, or a hero made in character creation, which returns to the guild hall rather than the party screen.
- **Price:** `RECRUIT_COST`, 10 gold.
- **Level:** recruits join the reserves at `min(guild hall level, the party's lowest level)`, so at most level 3. They come with that many levels of experience and their skill points, perks and spell picks unspent, so the player spends them in the character panel as for any level-up. A recruit hired late in a game is therefore green beside the veterans. That is intended: losing a raised hero should hurt, and training recruits up is a later mechanic (§4.2).
- **Room:** recruiting is refused when the reserves are full. The button says why.

### 4.4 Death

**Decided: permadeath.** A member who falls in a battle the party wins is **dead**, and no longer revives at 1 hit point (`REVIVED_HP` goes).

- What they wore and carried goes into the baggage, so gear is not lost.
- The party goes on smaller until the player recruits or swaps at the guild hall.
- The victory screen names the dead.
- A party wipe still ends the game, reserves or not. Forming a new party from the reserves waits for multiple parties.
- Resurrection will come later, as a very high-level spell.

This is the largest balance change here: today a fallen hero costs only hit points, and losing one raised to a high level is meant to hurt. It needs a campaign retune.

### 4.5 Watchtowers

- **Building:** the **Build Watchtower** button shows in the footer where the party may camp and the hex qualifies:
  - the hex is at level 0;
  - it holds no location and no tower;
  - no tower stands within `TOWER_SPACING` (4) hexes, so towers cannot be stacked into one wall;
  - the stock holds `TOWER_COST`: 10 iron and 5 gold as built. Timber and stone, the first proposal, proved too late to come by: the simulated campaigns held none at all, as only the home valley's gold and iron flow before the far sites are taken.
- **Time:** building takes one day, passed through `passTurn` like a day of camping.
- **Spending from afar:** the party spends the encampment's stock wherever it stands. Supply lines are abstracted.
- **Influence:** `TOWER_STRENGTH` (4) on the clean side, between a resource (3) and a town (5).
- **Loss:** a tower is lost at level 2, as a held site is. It is gone, and so is its vision. Its hex can be built on again once it is clean.
- **Warnings:** a tower is under threat on the same terms as a held site (`daysToFall`), and the same notable events apply to it.
- **State:** `WorldState.towers`, a list of `{ id, position }`. Towers are not locations: they hold no battle and take no part in routing.

### 4.6 Fog of war

- **Three states per hex:**
  - **Unexplored:** never seen. Drawn black.
  - **Explored:** seen before, not now. Drawn dimmed, with its blight level and its monster locations **as last seen**.
  - **In sight:** shown as it is.
- **State:**
  - `WorldState.seen`: a dense array by `boardIndex`, holding −1 for unexplored and otherwise the blight level last seen. One array serves as both the explored map and the memory.
  - `WorldState.sighted`: the ids of the monster locations the player has seen.
  - What is in sight is derived each turn and not stored.
- **Vision radii** (hex distance, with nothing blocking):

  | Source | Radius |
  | --- | --- |
  | The party | `PARTY_VISION` 5 |
  | The encampment | `CAMP_VISION` 6 |
  | A held town | `TOWN_VISION` 3 |
  | A held resource | `SITE_VISION` 2 |
  | A watchtower | `TOWER_VISION` 8 |

- **Updating:** after each turn (`passTurn`) and after each step of a journey, every hex in sight copies its level into `seen`, and every monster location in sight joins `sighted`.
- **What the player learns:**
  - A nest that spawns out of sight is not told. It is told when it comes into sight, as a new `sighted` event.
  - A sighting is notable, and stops travel and camping, when it lies within `NOTICE_RADIUS` of the party, as a spawn is today.
  - The player always learns of their own held sites and towers: under threat, lost, captured, as today.
- **The Source** is marked from the start: the party was sent to destroy it. Its hex is explored and it is in `sighted`, though the land between is not (decided).
- **Routing:**
  - `routeTo` avoids only the monster locations in `sighted`, so a route may be planned through the unknown.
  - The party sees at least 5 hexes ahead, so a nest on the road comes into sight before the party reaches it. The journey stops there, as `travel` already does for a nest on the road.
  - Clicking an unexplored hex is allowed: that is how the player explores.
- **The rules themselves are unchanged:**
  - Influence, spawning and the contest work on the true state, whatever the player sees.
  - The probe and the save carry both the true state and the player's knowledge.
  - The simulator stays omniscient: fog is knowledge, and its policy needs none.

### 4.7 The map

- **Fog:** drawn into the blight's render texture, black for unexplored and a dim veil for explored but out of sight, so it costs nothing per frame.
- **Remembered land:** in explored hexes, the tint is drawn from `seen`, not from the true levels.
- **Sprites:**
  - Monster locations show only if sighted, and are dimmed when out of sight.
  - Towns and resources show once explored.
  - A watchtower uses a new atlas sprite, `map_watchtower`, drawn in `art/map/` like the other location sprites.
- **Header:** the blighted share counts explored hexes only, so it reports what the player knows.

### 4.8 Scenes

- **`GuildHall`:** a new overlay over `World`, opened from the footer's Guild Hall button. It shows:
  - the party and the reserves, as portraits with names and levels;
  - the hall's level, the next upgrade's cost and an Upgrade button;
  - the stock;
  - Recruit, which opens the pre-rolls not in the company, as the party screen's row of faces, or Create;
  - Swap: a click on a member and then a reserve exchanges them, and a member clicked alone moves to the reserves.

  Every control calls a function of the proposed `src/game/guildHall.ts`. Its `probe()` gives every control.
- **`Creation`:** gains a `returnTo` in its scene data (`'Party'` or `'GuildHall'`), so the same four steps make a recruit. A recruit's name must be unique across the company.
- **`World`:**
  - **Footer:** the Guild Hall and Build Watchtower buttons.
  - **Map:** the fog drawing and the tower sprites.
  - **Probe:** the guild hall's button, the tower button, and what is in sight.

## 5. Technical shape

### 5.1 Domain modules (proposed, Phaser-free)

- **`src/game/guildHall.ts`:**
  - the hall's levels, limits and costs, and `partyLimit(world)`;
  - `upgradeGuildHall`, `recruit` (from a pre-roll or a draft), `toReserves`, `toParty` and `swap`, each validating and returning a reason when it refuses;
  - `bury`, the death rule's handling of a fallen member (§4.4).
- **`src/game/buildings.ts`:**
  - watchtowers: `canBuildTower` (with a reason), `buildTower` (spends the stock and passes a turn), loss with the land, and the tower as a clean source;
  - `canAfford` and `spend`, the stock's arithmetic, shared with the guild hall.
- **`src/game/vision.ts`:**
  - `visibleHexes(world, party)`, the union of the radii;
  - `updateSight(world)`, which copies into `seen` and `sighted` and returns `sighted` events;
  - `known(world)`, the remembered view the scene draws.

### 5.2 Changes to existing code

- **`WorldState`:**
  - gains `guildHall` (1 to 3), `towers`, `seen` and `sighted`;
  - `WorldEvent` gains `sighted`, `tower_built` and `tower_lost`.
- **`GameState`:**
  - gains `reserves`;
  - loses `partyLimit`, which is now derived. `joinParty` and `PartyScene` read the starting limit.
- **`blight.ts`:** towers join the clean sources in `sources` (and so the memoised field key).
- **`territory.ts`:**
  - towers are lost at `LOSS_LEVEL` and warned of like sites;
  - the encampment's stock gains `canAfford` and `spend`.
- **`worldMap.ts`:**
  - `passTurn` ends with `updateSight`;
  - `isNotable` adds `sighted` within `NOTICE_RADIUS`, and drops `spawned`, which is not seen;
  - `routeTo` avoids only sighted monster locations.
- **`party.ts`:** `rewardVictory` buries the fallen instead of reviving them, if §9 question 1 is confirmed.
- **Saves:** `SAVE_VERSION` goes to 5.

### 5.3 The simulator

- **The guild hall.** The careful party goes home to upgrade once the stock affords the next level and no held site is threatened, and also whenever it has lost a member. On the visit it recruits pre-rolls (at `min(hall level, lowest level)`) to fill every empty place, spending their points with `autoAdvance`.
- **Watchtowers.** It builds one wherever it camps on qualifying land and can afford it.
- **New metrics:** deaths, recruits, the hall's level at the end, and towers built and lost.
- **Retuning.** The death rule and parties of 4 and 5 both move the balance. The blight's target still holds: beat the Source about 2 times in 3 without losing the encampment. `FOES_AT_THREAT` should not grow with the party limit, which would hide the reward (the expeditions design's §8 says the same). Check the Source's encounter against a party of 5.

## 6. Consequences

- **Saves:** the format breaks again, which the project allows.
- **Balance:**
  - Death makes a lost hero a real cost, and the roster the answer to it. Without the roster, the death rule would be too harsh.
  - A party of 5 is much stronger than 3, as the expeditions design warned: more actions and more targets for the foes. Upgrades should be priced as milestones.
- **Performance:** vision is a union of a dozen radii, at most a few hundred hexes each, once a turn. It is cheap beside the blight's day.
- **Tests:** the domain modules carry the rules. Browser tests cover the guild hall overlay handing back to the map, recruiting through creation and back, and the fog drawn on a new game.

## 7. Phasing

1. **Fog of war and vision:** without towers, but with the encampment, held sites and the party.
2. **Watchtowers.**
3. **The guild hall:** roster, swapping, recruiting, upgrades and the derived limit.
4. **The death rule**, with the campaign retune. It comes last so the roster exists before death can bite.

Each phase is playable on its own.

Implementation notes, phase 1: `seen` and `sighted` are seeded by `seedSight` in `newWorld`. `updateSight` also runs in `clearLocation`, so the land a battle cleansed is seen at once, and a beaten location leaves `sighted`. A sighted nest's event is `{ type: 'sighted', location, name, at, threat }`; `spawned` is still returned, for the simulator's tally, but the map says nothing of it. The scene's `known(world)` was not needed: it draws `seen` with `visibleHexes` for the veil.

Implementation notes, phase 2: a tower's id is `tower_N`, from `WorldState.towersBuilt`. Its warning is a `site_threatened` event named "A watchtower", and its id joins `threatened`. The footer's Build Watchtower shows wherever the land would take a tower, and a click without the stock says the cost, rather than the button hiding. Spawns keep clear of towers as of held sites. The simulator builds where it stops after each win: 2.4 towers a campaign over 100 campaigns from seed 1, none lost. **The guild hall's level 3 cost (timber and stone) has the same problem** and needs settling in phase 3.

Implementation notes, phase 3: level 3 costs 60 gold and 30 iron, for the watchtower's reason, so the "develop the far land" loop does not gate it yet. The scene is `GuildHallScene`. Swapping is a click on a hero and then on one of the other row; To reserves and To party move the one picked. Closing the hall restarts `World`, whose party column is built once. The simulator renames a pre-roll already in the company ("Aldric 2"), as there are only four. Over 100 campaigns from seed 1 its parties reach a hall of level 2.8 and 1.8 recruits; 90 beat the Source, but in 303 days rather than 147, as the Source waits for the recruits to reach `SOURCE_READY_LEVEL`. Phase 4's retune should look at that rule too.

Implementation notes, phase 4: `rewardVictory(party, xp, baggage)` buries the fallen (`buryFallen` in party.ts, not guildHall.ts, as the party's rules live there) before it hands out experience, and its `dead` go on the victory screen. The battle's party column is a copy, so the dead stay in it, faded, under the result screen. 500 campaigns from seed 1 beat the Source 453 times (91%), in 306 days and 20.5 battles, with 0.3 heroes dead a campaign. The long campaigns are the hall trips: the party works far to the east and the hall is in the west, so each upgrade is a 65-day round trip, and the trips wait on iron, which towers spend too. Using the party's average level, not its lowest, for the simulator's choice of nests and readiness for the Source changed nothing (177 of 200 either way). Gold piles up past 300 with nothing to buy, and timber and silver do arrive once the far sites are taken, so the costs deserve another look. Not retuned: the nests are won at 100% up to threat 4 by an overlevelled party, and the Source, still Goblin Raid at threat 5, is the place to put the difficulty back, against a party of five.

Closing notes: the retune was done in the blight's Source encounter (`source_guardians`, [blight.md](blight.md) §10), tuned by the Blight Horror's hit points against the party of five that reaches it. With the shrine and outposts as well, 500 campaigns from seed 1 beat the Source 344 times (69%, the two-in-three target) and the encampment never falls, in 314 days and 20.7 battles; the hall ends at level 2.8 with 2.1 recruits and 1.6 heroes dead a campaign (most of them at the Source), 3 watchtowers are built and none lost, and nests up to threat 4 are won all but 3 times in 8,562. The shrine now spends the gold that piled up, and the outpost the timber. Left as they are: the hall's level 3 asks gold and iron, not the timber and stone first proposed, so the far land does not gate it; and `SOURCE_READY_LEVEL` (7) still makes the simulated party wait for its recruits before the Source, which is the simulator's choice and not a rule of the game.

## 8. Verification

| Scenario | Requirements |
| --- | --- |
| A new game shows the home valley and the Source's hex; the rest is black. Travelling reveals hexes, and the land behind the party stays as last seen while the blight changes underneath. | R8, R9 |
| A nest spawns out of sight and is not told; it is told when it comes into sight, and stops a journey if within `NOTICE_RADIUS`. | R8, R9 |
| Build a tower on clean land with the stock: the stock falls, a day passes, the tower pushes back the blight and widens what is seen. It is refused on tainted land, on a location, near another tower, or without the stock, each with its reason. | R6, R7, R9 |
| A besieged tower warns, then is lost at level 2, taking its vision with it. | R7 |
| At Oakvale: upgrade the hall to level 2 and fill a fourth place from the reserves; recruit through Create and through a pre-roll; swap a member for a reserve. Upgrades and recruits are refused without the stock, and a full company or a duplicate name is refused. | R1–R3, R5 |
| A member falls in a won battle: they are gone, their gear is in the baggage, and the party fights on smaller until a recruit or reserve replaces them. | R4 |
| The same seed and choices give the same world, sight included. | R10 |

## 9. Decisions made

1. **Death:** permadeath. Losing party members should hurt, especially after raising them up. Resurrection comes later, at very high levels.
2. **A recruit's level:** `min(guild hall level, the party's lowest level)`. Training scrub recruits up is a later mechanic: stationing them in guard posts or watchtowers to grow levels passively, training facilities in the encampment, special low-level scouting parties.
3. **A wipe with reserves at home:** it ends the game for now. Forming a new party comes with multiple parties.
4. **Fog:** as proposed. Unexplored hexes are black, explored ones show the blight as last seen, and the Source is known from the start.

Costs, strengths, radii, `TOWER_SPACING` and `MAX_RESERVES` remain starting points for the simulator.
