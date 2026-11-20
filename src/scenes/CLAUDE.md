# The scene layer

Loaded when working in `src/scenes/`. Scenes are views: a scene turns input into calls on the domain modules and plays back what they return, and decides no outcome.

Full detail (each screen's buttons, tabs and hovers, every helper's exports, asset loading, the debug console): `docs/reference/scenes.md`.

## Contracts

- **Scenes decide nothing.** `BattleScene` turns clicks into `Action`s, calls `engine.step` and plays back the returned events; `WorldScene` asks `routeTo` what a click would do. Anything that changes an outcome belongs in the domain modules, with tests.
- **Helper modules stay Phaser-free.** Scene logic that can be expressed without Phaser goes in a sibling helper module, so that its tests run in the `domain` project; new logic follows suit. Only the view helpers listed below may import Phaser, and they hold no logic of their own.
- **Redraw on the next tick.** A scene that redraws itself after a change (`Inventory`, `Party`, `Creation`) does so on the next tick, as the redraw destroys the button whose click handler asked for it; its new buttons take clicks only from the frame after.
- **Layout.** Scenes use Phaser's `RESIZE` scale mode, so each positions everything in a `layout()` method that reruns on resize. The game is held at a minimum of 840×560 (`MIN_GAME_SIZE` in `src/main.ts`), below which the page scrolls; screens must fit at that size. `World` and `Battle` lay out their map, board, log and buttons to the right of the party's column (`PARTY_PANEL_W`).
- **Scene data.** Every scene that acts for a party takes `party?: string` (its id), resolves it with `selectedParty(game, data.party)` (`homeParty` at the encampment's screens) and passes it on to the scene it starts; `Inventory` is handed the members themselves. Overlays (`Menu`, `Inventory`, `Story`, `Encampment` and those over it) pause the scene under them and resume it on close; `Menu` is told which scene to resume by `resume`.
- **Sound.** Every play goes through `soundPlayer.ts`; no scene calls `sound.play` or `sound.add`. Anything not loaded is silence, never an exception. An action that returns a refusal sounds through `refusalCue`, and a button through `buttonCue` (or the cue `addPanelButton` is given).
- **Gear changes and hit points.** Every change to what a character wears ends with `clampHp(character, maxBefore)`: the share rule outside battle, the cap rule (`HpRule` 'cap') in battle, where the engine's `equip` only lowers hit points. `equipFromBackpack`, `unequipToBackpack` and `dropEquipped` apply the rule they are given; a new way of changing gear must too. In battle the panel edits the `Character` and `BattleScene` sends one `equip` action per changed member when it closes; on the world map nothing is sent. Reference: "Changing gear".
- **Text input.** Every scene that types text wraps its `keydown` listener in `onceEachEvent` (`keyEvents.ts`), as Phaser hands a listener the same key again when two arrive within a frame.
- **Seeds.** Every battle is seeded (the page's `?seed=` or else at random), the enemy's RNG with the seed plus one (auto-resolve's player policy stream with the seed plus two), so that any battle can be saved and replayed from its log. Sound variants use `Math.random`, never a game stream. The auto-resolve estimates (battle and world map) read the engine only through `snapshot()` and draws only from its samples' own seeds (`forecast.ts`); the world map's reads nothing of the page's seed or the world's RNG.
- **Auto-resolve.** The battle screen's fourth button, Auto (enabled with End Turn, no key), and the world footer's Auto-resolve (shown by Attack's rule) both carry the estimate in their labels and, on hover, the whole of it: in the hint line in battle, in a tooltip above the button on the world map. The estimate is worked in idle slices (`workFor` from `update`), never in a handler; it restarts when the battle moved (battle) or its key changes (world). Tests and screenshots wait on the probe's `forecast !== null`. Details in `docs/reference/scenes.md`.

## Probes

Every scene but `Boot` has a `probe()`: plain data telling where its controls are on screen and what state it shows, typed in `src/testHook.ts`. In dev builds `main.ts` installs the hook that puts the probes within the in-browser tests' reach as `window.__yomi`; a production build leaves it out. Game code must not read the hook or the probes. A control that a test needs to click goes in its scene's probe.

## Scene flow

`Boot` → `Menu` → `Party` ⇄ `Creation` → `World` ⇄ `Battle`. Over `World`: `Encampment` ⇄ `GuildHall` (⇄ `Creation`), `TradingPost` and `Crafting` (each back to `Encampment` on close), `Crafting` alone from the map's Craft button (`resume: 'World'`), `Exchange` (resumes `World` with `{ exchanged: true }`) and `Inventory` (the character panel, also over `Battle`). `Story` plays over `World`, `Battle` or `Encampment` at the moments they raise; `Menu` over `World` or `Battle` (Esc). A battle won returns to `World`; one lost wipes the party and returns to `World`, or to `Menu` when no hero is left. Reference: "Scene flow" and a section per scene.

## If you add X, also update Y

- **A unit kind:** an atlas sprite named for the `UnitKind` with `idle` and `walk` animations, an experience value in `FOE_XP`, and an entry in `FOE_SOUNDS` (`sounds.ts`; a coverage test fails without it).
- **A weapon or shield icon, or an armour, head or cloak icon:** an entry in `GEAR_SPRITES` or `WORN_SPRITES` (`WORN_BACK_SPRITES` for a cape) in `unitLook.ts` and a sprite in `art/gear/`, or `unitLook.test.ts` fails; a weapon icon also needs `WEAPON_SOUNDS`. A blade or axe that swings goes in `SWUNG_GEAR`.
- **An item icon:** `assets/sprites/icon_<icon>.png` and its key in `ITEM_ICON_KEYS` (`itemIcons.ts`); a rune, `RUNE_ICON_KEYS` and `RUNE_COLOURS`.
- **An ability:** unless it is a technique of strikes, an entry in `ABILITY_SOUNDS` (coverage test); optionally a look in `ABILITY_LOOKS` or, for an elemental technique, `STRIKE_FLASHES` (`battleEffects.ts`). Its foe-panel description comes free from `foeInfo.ts`.
- **A spell:** a look in `SPELL_LOOKS` (a full record, so `tsc` asks for it).
- **A portrait preset:** an id in `PORTRAIT_IDS` and `art/portraits/` sprite (`portrait_<id>.png`, `portraitKey`).
- **A facility:** an entry in `FACILITIES` (encampment.ts), sprites `camp_<facility>/level_<n>` in `FACILITY_SPRITES`, a plot in `encampmentView.ts`, and a scene in `EncampmentScene`'s `OPENS` if it has a screen of its own.
- **A location kind:** an atlas sprite with `idle` keyed in `LOCATION_SPRITES`.
- **A party banner:** `BANNER_SPRITES` in `partyList.ts`.
- **A sound effect:** a recipe in `audio/sfx/` built into the manifest (`npm run sounds`), then its cue in `CUES`. A button that closes or steps back belongs in `BACK_LABELS`.
- **A battle event that changes statuses on screen:** `changesStatusMarks` (`battleEffects.ts`).
- **A debug command:** an entry in `COMMANDS` (`debugCommands.ts`). Commands that change the game run only on the world map; `~` opens the console in dev builds (reference: "Debug console").
- **A control a browser test clicks:** its scene's probe.

Each asset directory's `README.md` records provenance and licence; update it when files are added. Reference: "Assets the scenes load".

## Helper modules

Pure (no runtime Phaser import):

- `eventSchedule.ts`: timing of event playback.
- `battleEffects.ts`: how blows, shots, spells and area abilities look and when they land; floating text; which events redraw status letters.
- `boardGeometry.ts`: hex ↔ screen for the battlefield and the world map.
- `attackPlan.ts`: what clicking a foe does, and the hint when it does nothing.
- `battleCost.ts`: the victory screen's cost line: hit points lost per hero, net, measured before the reward heals.
- `battleSetup.ts`: which encounter and threat a `Battle` asks for, the log's seed, the "Found:" line, auto-resolve's lines.
- `storyAudio.ts`: which line a cutscene beat speaks, its files, delay, fade and duck.
- `scrollingLog.ts`: the battle log.
- `slotScroll.ts`: which rows of the ground pile the inventory shows.
- `gearDrag.ts`: where a dragged item may be dropped and what change of gear a drop makes.
- `mapScroll.ts`: where the world map sits on screen, and when a press is a drag.
- `abilityList.ts`: the Abilities tab's rows and where each sits.
- `partyPanel.ts`: where the party's portraits sit and what a click on one does.
- `draftInfo.ts`: the lines a hover shows of a draft.
- `encampmentView.ts`: where the encampment draws each facility (six plots at 2x: a new facility needs a seventh and room for its label, which the in-browser overlap test checks); the "For: <name>" line.
- `hallColumns.ts`: the Guild Hall's columns and what a click does with a picked hero.
- `exchangeView.ts`: the Exchange scene's partners, moves and baggage lines.
- `gearCompare.ts`: the words for an item's stats and what a craft or gear change does.
- `runecraftView.ts`: the crafting screen's Runes tab in words, and where sockets come from.
- `worldEvents.ts`: the world map's words for turns, days and walks, the yield summary, and the prompt to spend points.
- `improveButton.ts`: the Improve button's label (full and compact).
- `skillsTab.ts`: the Skills tab in plain data.
- `hexInfo.ts`: what the info panel tells of the hovered hex, within the fog.
- `partyList.ts`: the world map's party list, figures, banners, meet target and order words.
- `perkTree.ts`: the skill-tree view's layout, lines, words and node states.
- `skillMenu.ts`: the battle's Skills list, why a row is greyed, and the words of aiming.
- `statusMarks.ts`: where nameplate status letters sit and how they stay legible.
- `foeInfo.ts`: the battle's foe hover panel.
- `clicks.ts`: what counts as a right-click.
- `keyEvents.ts`: `onceEachEvent`.
- `sounds.ts`: the cue table and which cues battle, world and interface events play.
- `audioSettings.ts`: volume levels and bus gains.
- `cursors.ts`: the pointer cursors.
- `seed.ts`: the seed in the page's address.
- `debugCommands.ts`: the debug console's commands (`stock` takes several pairs, `blight` sets a hex's level, `days` ends with the yields by source).
- `unitLook.ts`: atlas frame names and which sprites dress a hero.
- `itemIcons.ts`: item, rune and pip icon keys and tints.
- `manualHtml.ts`: the manual as HTML.

Phaser game objects or Phaser types only, no logic of their own: `PartyColumn.ts`, `PartyListView.ts`, `UnitFigure.ts`, `PerkTreeView.ts`, `socketPips.ts`, `panelButton.ts`, `debugConsole.ts`, `manualOverlay.ts`, and `soundPlayer.ts` (the one player, tested over a fake sound manager).

Reference: "Helper modules in detail" and "Sound".

