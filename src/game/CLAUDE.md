# The game outside battle

Loaded when working in `src/game/`: encounters and bandits, the company and its day loop, the world map, the blight, the encampment and its facilities, and saving. This is the working guide; the full rules, with every constant, encounter, bandit role, facility level and price and the save migrations, are in `docs/reference/game.md`. The simulator is in `scripts/CLAUDE.md`; the balance figures are in `.claude/skills/yomi-balance/`.

## Contracts

- **The day loop is the only clock.** Every party has a standing `Order` (idle, travel, home, camp, garrison, meet, or a one-day `DayAction`), and time passes only through `company.ts`: `passDay` runs each party's order in list order, then `passTurn` once (the blight's day), then checks each order; `advance` passes days until an `Interrupt` (a notable world event, or a party's own: arrived, confronting, order done, met), the game ending or `UNTIL_LIMIT` days. An order outlasts an interrupt. A one-day action (scout, wait, a day's camp, a tower, an improvement, a field craft or embed) is `orderAction` then a day (`act`); `travel`, `campUntilHealed`, `campDay`, `buildTower` and the rest are conveniences that give an order and advance. Never pass time any other way.
- **Time-free parts and day-passing parts are separate.** Each module that does a thing in a day has a refusal (`craftRefusal`, `embedRefusal`, `canBuildTower`, …) and a time-free apply (`applyCraft`, `applyEmbed`, `raiseTower`, `raiseImprovement`, `rest`); `company.ts` calls only those. Anything at the encampment (the hall, the trading post, the workshop, the shrine, the Builders' Lodge) passes no time.
- **Actions return a refusal or null, and check before changing.** Every action returns why it was refused (a string) or null, and checks everything before it changes anything; a refused action leaves the game untouched. Its words are shown to the player.
- **The party is passed explicitly.** Functions take `(game, party)` (anything that passes a day) or `(world, party)` (read-only checks such as `monstersHere`, `routeTo`, `canCamp`, `restHealing`, `craftTier`). A reader resolves it with `partyById` or `selectedParty(game, id)`; a company-wide reader walks `game.parties`. The world's rules (`passTurn`, `isNotable`, blight, territory, vision) take the parties as `presences(game.parties)`, whose levels are their influence. Functions that list, buy or recruit take the acting party after `game`; the encampment acts for `homeParty(game, preferred?)`.
- **Import cycles are safe only while nothing calls across at load.** `blight.ts`, `territory.ts`, `worldMap.ts`, `trade.ts` and `buildings.ts` (for `ROAD_LODGE_LEVEL`) import one another, as do `company.ts`, `worldMap.ts`, `camp.ts`, `buildings.ts`, `crafting.ts`, `runecraft.ts` and `trade.ts`. Never call into one of them at module top level. `company.ts` imports `guildHall.ts`, which must never import it.
- **RNG streams.** The world RNG (its state saved in `WorldState`) draws spawns and nothing else; rune loot draws from `lootRng`, seeded from the battle's seed, so the battle's dice are untouched and a reloaded battle finds the same runes. Do not draw world or loot randomness from a battle's stream or `Math.random`. The auto-resolve estimate (`forecast.ts`) draws from neither (its own seeded streams: `docs/reference/game.md`, "The auto-resolve estimate").
- **Vision is knowledge only.** `vision.ts` says what the player has seen (`seen`, `sighted`); the rules run on the true state and the simulator ignores it. Every change to the land ends with `updateSight`.
- **Hit points follow gear.** A worn item replaced or removed (`ItemPlace`, runecraft's `replaceAt`) ends with `clampHp` on the wearer.
- **Balance.** Anything that changes a battle's outcome, a foe or an encounter moves balance: `.claude/skills/yomi-balance/`.
- **Saves.** Changing the shape of `GameState`, `Character`, `WorldState` or `BattleSnapshot`: raise `SAVE_VERSION`. Write a migration only when a design asks for one; otherwise older saves read as unreadable, which is fine in development. A migration ends with the same strict check as a current save and gets a captured fixture in `src/game/fixtures/`.
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
- `trade.ts`: trade partners, contact and silence (`partnerDay`); trade routes, their roads, security and guards, raids and abandonment (`tradeDay`, run daily by `territory.ts`).
- `vision.ts`: fog of war.
- `buildings.ts`: the stock's arithmetic, the watchtower and shrine, a held resource's improvements (outpost, works, fort) and the Builders' Lodge that allows them (at 3, roads push).
- `encampment.ts`: the facilities as the encampment screen shows them, and `improveFacility`.
- `guildHall.ts`: the hall's level and what it allows (party size, parties, company size), recruiting and the reserves, `homeParties` and `homeParty`.
- `tradingPost.ts`: buying and selling items, runes and materials.
- `crafting.ts`: modifiers on items, in the field or at the workshop.
- `runecraft.ts`: embedding, fusing and extracting runes.
- `infirmary.ts`: the infirmary and `restHealing`.
- `itemPlace.ts`: where an item acted on lies, refused as stale when it is no longer there.
- `loot.ts`: rune loot after a win (`takeRunes`).
- `forecast.ts`: the auto-resolve estimate and its words.
- `ground.ts`: the loose items on a battlefield, one pile per hex (the engine does not track them).
- `gameState.ts`: state that outlives a scene: the parties, the world, the rune pouch, the reserves, the story and the save slot.
- `save.ts`, `saveSlots.ts`: the save format and the three `localStorage` slots (through `src/storage.ts`).

## The rules

World map, blight and territory, scaling, encounters, bandits and saving each have a section in `docs/reference/game.md`; read it before changing one. Three easy to get wrong: the encampment's name is the player's (read through `encampmentName`, never assumed); a site lost razes its improvement; and the home country is stage 8's map moved by `EARLY_SHIFT`, so a test's fixed world hex is `earlyHex(col, row)` of stage 8's offset (threat comes from `THREAT_RINGS`). Scaling (stage 8): partners, clean from day one, reshuffle spawns: 239 → 233 (company 239 → 232).

## Adding content

Adding a facility, encounter, foe kind or one-day action: `.claude/skills/yomi-add-content/`.
