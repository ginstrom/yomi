# The scene layer

Loaded when working in `src/scenes/`. Scenes are views: a scene turns input into calls on the domain modules and plays back what they return, and decides no outcome.

Full detail (each screen, every helper module, assets, sound, the debug console, seeds): `docs/reference/scenes.md`.

## Contracts

- **Scenes decide nothing.** `BattleScene` turns clicks into `Action`s, calls `engine.step` and plays back the returned events; `WorldScene` asks `routeTo` what a click would do. Anything that changes an outcome belongs in the domain modules, with tests.
- **Helper modules stay Phaser-free.** Scene logic that can be expressed without Phaser goes in a sibling helper module, so that its tests run in the `domain` project; new logic follows suit. Only the view helpers listed below may import Phaser, and they hold no logic of their own.
- **Redraw on the next tick.** A scene that redraws itself after a change (`Inventory`, `Party`, `Creation`) does so on the next tick, as the redraw destroys the button whose click handler asked for it; its new buttons take clicks only from the frame after.
- **Layout.** Scenes use Phaser's `RESIZE` scale mode, so each positions everything in a `layout()` method that reruns on resize. The game is held at a minimum of 840×560 (`MIN_GAME_SIZE` in `src/main.ts`), below which the page scrolls; screens must fit at that size. `World` and `Battle` lay out their map, board, log and buttons to the right of the party's column (`PARTY_PANEL_W`).
- **Scene data.** Every scene that acts for a party takes `party?: string` (its id), resolves it with `selectedParty(game, data.party)` (`homeParty` at the encampment's screens) and passes it on to the scene it starts; `Inventory` is handed the members themselves. Overlays (`Menu`, `Inventory`, `Story`, `Encampment` and those over it) pause the scene under them and resume it on close; `Menu` is told which scene to resume by `resume`.
- **Sound.** Every play goes through `soundPlayer.ts`; no scene calls `sound.play` or `sound.add`. Anything not loaded is silence, never an exception. An action that returns a refusal sounds through `refusalCue`, and a button through `buttonCue` (or the cue `addPanelButton` is given).
- **Gear changes** end with `clampHp` (`src/character/CLAUDE.md`), the cap rule in battle. In battle the panel edits the `Character` and `BattleScene` sends one `equip` action per changed member when it closes. Reference: "Changing gear".
- **Text input.** Every scene that types text wraps its `keydown` listener in `onceEachEvent` (`keyEvents.ts`), as Phaser hands a listener the same key again when two arrive within a frame.
- **Seeds.** Every battle is seeded (the page's `?seed=` or else at random), the enemy's RNG with the seed plus one, auto-resolve's player stream with the seed plus two. Sound variants use `Math.random`, never a game stream. The auto-resolve estimate reads the engine only through `snapshot()` and draws only from its samples' own seeds (`forecast.ts`). Reference: "Seeds".
- **Auto-resolve** estimates are worked in idle slices (`workFor` from `update`), never in a handler; tests wait on the probe's `forecast !== null`. Reference: "Auto-resolve".

## Probes

Every scene but `Boot` has a `probe()`: plain data telling where its controls are on screen and what state it shows, typed in `src/testHook.ts`. In dev builds `main.ts` installs the hook that puts the probes within the in-browser tests' reach as `window.__yomi`; a production build leaves it out. Game code must not read the hook or the probes. A control that a test needs to click goes in its scene's probe.

## Scene flow

`Boot` → `Menu` → `Party` ⇄ `Creation` → `World` ⇄ `Battle`, with the encampment's screens, `Exchange`, `Inventory`, `Story` and `Menu` as overlays. Who opens what and where each returns: reference, "Scene flow".

## If you add X, also update Y

- **A unit kind:** the foe-kind checklist in `src/game/CLAUDE.md`.
- **A weapon or shield icon, or an armour, head or cloak icon:** an entry in `GEAR_SPRITES` or `WORN_SPRITES` (`WORN_BACK_SPRITES` for a cape) in `unitLook.ts` and a sprite in `art/gear/`, or `unitLook.test.ts` fails; a weapon icon also needs `WEAPON_SOUNDS`. A blade or axe that swings goes in `SWUNG_GEAR`.
- **An item icon:** `assets/sprites/icon_<icon>.png` and its key in `ITEM_ICON_KEYS` (`itemIcons.ts`); a rune, `RUNE_ICON_KEYS` and `RUNE_COLOURS`.
- **An ability:** unless it is a technique of strikes, an entry in `ABILITY_SOUNDS` (coverage test); optionally a look in `ABILITY_LOOKS` or, for an elemental technique, `STRIKE_FLASHES` (`battleEffects.ts`). Its foe-panel description comes free from `foeInfo.ts`.
- **A spell:** a look in `SPELL_LOOKS` (a full record, so `tsc` asks for it).
- **A portrait preset:** an id in `PORTRAIT_IDS` and `art/portraits/` sprite (`portrait_<id>.png`, `portraitKey`).
- **A facility:** the checklist in `src/game/CLAUDE.md`; sprites `camp_<facility>/level_<n>` in `FACILITY_SPRITES`, and a seventh plot in `encampmentView.ts` (six now; the in-browser overlap test checks labels).
- **A location kind:** an atlas sprite with `idle` keyed in `LOCATION_SPRITES`.
- **A party banner:** `BANNER_SPRITES` in `partyList.ts`.
- **A sound effect:** a recipe in `audio/sfx/` built into the manifest (`npm run sounds`), then its cue in `CUES`. A button that closes or steps back belongs in `BACK_LABELS`.
- **A battle event that changes statuses on screen:** `changesStatusMarks` (`battleEffects.ts`).
- **A debug command:** an entry in `COMMANDS` (`debugCommands.ts`); commands that change the game run only on the world map. `~` opens the console in dev builds (reference: "Debug console").
- **A control a browser test clicks:** its scene's probe.

Each asset directory's `README.md` records provenance and licence; update it when files are added. Reference: "Assets the scenes load".

## Helper modules

Each scene's logic lives in a sibling module named for what it does (`attackPlan.ts`, `partyList.ts`, `perkTree.ts`, `sounds.ts`, …), with tests, importing no Phaser at runtime. Only these view helpers may import Phaser, and they hold no logic: `PartyColumn.ts`, `PartyListView.ts`, `UnitFigure.ts`, `PerkTreeView.ts`, `socketPips.ts`, `panelButton.ts`, `debugConsole.ts`, `manualOverlay.ts`, and `soundPlayer.ts` (the one player, tested over a fake sound manager). What each module covers: reference, "Helper modules in detail" and "Sound".
