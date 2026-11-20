# The game outside battle

Loaded when working in `src/game/`: encounters and bandits, the company and its day loop, the world map, the blight, the encampment and its facilities, and saving. This is the working guide; the full rules, with every constant, encounter, bandit role, facility level and price and the save migrations, are in `docs/reference/game.md`. The simulator and the balance figures are in `scripts/CLAUDE.md`.

## Contracts

- **The day loop is the only clock.** Every party has a standing `Order` (idle, travel, home, camp, garrison, meet, or a one-day `DayAction`), and time passes only through `company.ts`: `passDay` runs each party's order in list order, then `passTurn` once (the blight's day), then checks each order; `advance` passes days until an `Interrupt` (a notable world event, or a party's own: arrived, confronting, order done, met), the game ending or `UNTIL_LIMIT` days. An order outlasts an interrupt. A one-day action (scout, wait, a day's camp, a tower, an improvement, a field craft or embed) is `orderAction` then a day (`act`); `travel`, `campUntilHealed`, `campDay`, `buildTower` and the rest are conveniences that give an order and advance. Never pass time any other way.
- **Time-free parts and day-passing parts are separate.** Each module that does a thing in a day has a refusal (`craftRefusal`, `embedRefusal`, `canBuildTower`, …) and a time-free apply (`applyCraft`, `applyEmbed`, `raiseTower`, `raiseImprovement`, `rest`); `company.ts` calls only those. Anything at the encampment (the hall, the trading post, the workshop, the shrine, the Builders' Lodge) passes no time.
- **Actions return a refusal or null, and check before changing.** Every action returns why it was refused (a string) or null, and checks everything before it changes anything; a refused action leaves the game untouched. Its words are shown to the player.
- **The party is passed explicitly.** Functions take `(game, party)` (anything that passes a day) or `(world, party)` (read-only checks such as `monstersHere`, `routeTo`, `canCamp`, `restHealing`, `craftTier`). A reader resolves it with `partyById` or `selectedParty(game, id)`; a company-wide reader walks `game.parties`. The world's rules (`passTurn`, `isNotable`, blight, territory, vision) take the parties as `presences(game.parties)`, whose levels are their influence. Functions that list, buy or recruit take the acting party after `game`; the encampment acts for `homeParty(game, preferred?)`.
- **Import cycles are safe only while nothing calls across at load.** `blight.ts`, `territory.ts` and `worldMap.ts` import one another, as do `company.ts`, `worldMap.ts`, `camp.ts`, `buildings.ts`, `crafting.ts` and `runecraft.ts`. Never call into one of them at module top level. `company.ts` imports `guildHall.ts`, which must never import it.
- **RNG streams.** The world RNG (its state saved in `WorldState`) draws spawns and nothing else; rune loot draws from `lootRng`, seeded from the battle's seed, so the battle's dice are untouched and a reloaded battle finds the same runes. Do not draw world or loot randomness from a battle's stream or `Math.random`. The auto-resolve estimate (`forecast.ts`) draws from neither: each sample has its own engine and policy streams, seeded by hashing, with a salt, the battle's seed and log length (mid-battle) or the location, party and day (world map); nothing in it draws from the real battle, the world's RNG or `Math.random`.
- **Vision is knowledge only.** `vision.ts` says what the player has seen (`seen`, `sighted`); the rules run on the true state and the simulator ignores it. Every change to the land ends with `updateSight`.
- **Scenes do not decide.** `WorldScene` asks `routeTo` what a click would do.
- **Hit points follow gear.** A worn item replaced or removed (through `ItemPlace`, runecraft's `replaceAt`) ends with `clampHp` on the wearer, as a Life rune moves the maximum.
- **The game state lives in scene data**, never in a module global. A game with no `slot` (`newGame()`'s default) is never saved.

## The modules

- `encounters.ts`: battle setups by id (`ENCOUNTERS`), built for a party and a threat; foe kinds, bands and counts, `xpReward`; a hero's unit is `heroId(i)`.
- `bandits.ts`: bandits, foes built by hero rules from a fixed draft per role, dressed by `banditGear(threat)` and levelled by `autoAdvance`.
- `party.ts`: the `Party`, the pre-rolls and the ready-made party, `rewardVictory` (experience, the fallen buried) and `autoHeal`.
- `expedition.ts`: the `Expedition` (a party of the company: members, baggage, position, confronting, order), party ids and names, and `PartyPresence`.
- `company.ts`: the day loop and orders, the hall's company actions (`formParty`, `renameParty`, `disband`, `moveHero`), and `exchange` and `wipeParty` in the field.
- `worldMap.ts`: `WorldState` and what changes it (`passTurn`, `travel`, `walkTo`, `followOrder`, `linger`, `clearLocation`), routing and `isNotable`.
- `camp.ts`: camping, a day's rest and camping until healed.
- `blight.ts`: each hex's level, the day's contest of influence, growth with time, spawning and cleansing; the `WorldEvent`s a turn returns.
- `territory.ts`: resources and the encampment held and lost, warnings of a site under threat, yields to the stock, the market's gold among them (`MARKET_INCOME`).
- `vision.ts`: fog of war.
- `buildings.ts`: the stock's arithmetic, the watchtower and shrine, a held resource's improvements (outpost, works, fort) and the Builders' Lodge that allows them; the outpost wrappers the world map uses (`outpostSite`, `outpostSiteRefusal`) stand until it moves off them.
- `encampment.ts`: the facilities as the encampment screen shows them, and `improveFacility`.
- `guildHall.ts`: the hall's level and what it allows (party size, parties, company size), recruiting and the reserves, `homeParties` and `homeParty`.
- `tradingPost.ts`: buying and selling items, runes and materials; levels 4 to 6 are the Market, Market Hall and Trading House, whose gold `territory.ts` yields.
- `crafting.ts`: modifiers on items, in the field or at the workshop.
- `runecraft.ts`: embedding, fusing and extracting runes.
- `infirmary.ts`: the infirmary and `restHealing`.
- `itemPlace.ts`: where an item acted on lies, refused as stale when it is no longer there.
- `loot.ts`: rune loot after a win (`takeRunes`).
- `forecast.ts`: the auto-resolve estimate: sample battles played headless on seeds of their own, worked a step at a time, and its words.
- `ground.ts`: the loose items on a battlefield, one pile per hex (the engine does not track them).
- `gameState.ts`: state that outlives a scene: the parties, the world, the rune pouch, the reserves, the story and the save slot.
- `save.ts`, `saveSlots.ts`: the save format and the three `localStorage` slots (through `src/storage.ts`).

## The rules in short

Each has a full section in `docs/reference/game.md`.

- **World map** (reference: "The world map"). The encampment is the only settlement, named by the player (read through `encampmentName`, never assumed); every other quiet location is a resource. A turn is a hex walked and the blight's day. A walk stops at a notable event or monsters on the road; walking into monsters sets `confronting`, and the party must scout, wait or attack. The game ends when the encampment falls ('lost') or the Source is beaten ('won', then optionally 'endless').
- **Blight** (reference: "The blight", "Territory"). Every hex has a level 0 to 3, moved by a counter of net influence: monster locations, the Source and corrupted neighbours push up, growing with time; the encampment, held sites, towers and parties push down. Party hexes are neutral. Corrupted land builds spawn pressure, and spawns take the threat of where they lie. A won battle cleanses around it. Resources are captured at 0 and lost at `lossLevel` (`LOSS_LEVEL`, or level 3 for a fort); a site lost razes its improvement.
- **Scaling** (reference: "Scaling", "Encounters and foes", "Bandits"). Threat rises a step every `THREAT_BAND` hexes from the encampment, up to `MAX_THREAT`. A battle at threat T fields the encounter's count for T, all at level T; a threat outside an encounter's band is fought as the nearest in it. Monsters scale from their native level by `foeAtLevel`; bandits are built as heroes of that level.
- **Saving** (reference: "Saving"). There is no save button: the scenes save after every change and at each player turn in battle (rewinding a reload to that turn, with the same dice). A defeat that leaves no hero anywhere, or the encampment's fall, deletes the slot (permadeath). Items are saved as their ids and rebuilt by `itemById`.

## Checklists

- **Changing the shape** of `GameState`, `Character`, `WorldState` or `BattleSnapshot`: raise `SAVE_VERSION`. Write a migration only when a design asks for one; otherwise older saves read as unreadable, which is fine in development. A migration ends with the same strict check as a current save and gets a captured fixture in `src/game/fixtures/`.
- **A new base or enchanted item**: it must be in `BASE_ITEMS` or `MAGIC_ITEMS`, or a game holding it cannot be loaded.
- **A new facility**: an entry in `FACILITIES` (`encampment.ts`), a sprite and a plot (`encampmentView.ts`), and a scene in `EncampmentScene`'s `OPENS` if it has a screen of its own.
- **A new encounter**: an entry in `ENCOUNTERS`, its band in `ENCOUNTER_BANDS` and counts in `ENCOUNTER_COUNTS`; add it to `SPAWN_KINDS` only if the blight should spawn it.
- **A new foe kind**: a sprite of that name with `idle` and `walk` animations, an experience value in `FOE_XP`, a native level in `FOE_NATIVE_LEVEL` if not 1, a sound in `FOE_SOUNDS`, and a stat block within `foeYardstick` at its native level (a test checks), each field outside it a named exception.
- **A new one-day action**: a refusal and a time-free apply in its module, a `DayAction` case (`expedition.ts`) that `company.ts` runs, and a convenience over `act`.
- **Anything that changes a battle's outcome, a foe or an encounter**: re-run the balance cells and campaigns as `scripts/CLAUDE.md` describes.
