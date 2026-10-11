# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Yomi is a 2D turn-based fantasy tactics game: Phaser 4 + TypeScript, bundled with Vite. Battles are fought on a pointy-top hex grid, with action points, flanking, facing arcs and zones of control. Between battles the party travels a world map, also of hexes, from one point of interest to the next.

## Commands

Node 26+ is required: `scripts/*.ts` run on Node's native TypeScript support (no build step, no ts-node), and imports use explicit `.ts` extensions everywhere.

| Task | Command |
| --- | --- |
| Dev server (http://localhost:5173) | `npm run dev` |
| Typecheck only | `npm run typecheck` |
| Typecheck + all tests | `npm test` (`tsc && vitest run`) |
| One test file | `npx vitest run src/grid/hex.test.ts` |
| One test by name | `npx vitest run src/engine/battleEngine.test.ts -t "routes around zones"` |
| One vitest project | `npx vitest run --project domain` (or `scenes`) |
| In-browser tests (headless Chromium) | `npm run test:browser` |
| One in-browser test by name | `npm run test:browser -- -t "victorious"` |
| Production build | `npm run build` |
| Headless battle simulator | `npm run simulate -- --battles 2000 --seed 1` |
| Build sprites from `art/` | `npm run sprites` |
| Check exported sprites are up to date | `npm run sprites:check` |

There is no linter; `tsc` is the lint step (`noUnusedLocals`, `noUnusedParameters`, `erasableSyntaxOnly`, `verbatimModuleSyntax`). `erasableSyntaxOnly` means no enums, namespaces or constructor parameter properties; use `import type` for type-only imports.

The `Makefile` runs the same things inside a podman container (`make run`, `make test`, `make test-browser ARGS="-t victorious"`, `make simulate ARGS="..."`, `make shell`), with `node_modules` in a named volume that reinstalls itself when `package-lock.json` changes. `vite.config.ts` polls for file changes because of that bind mount.

Simulator flags: `--battles`, `--seed`, `--out` (default `logs/battles.jsonl`; `logs/` is gitignored), `--max-rounds`, `--player-policy`, `--enemy-policy` (`aggressive` or `random`), `--player-weapon` (an item id from `WEAPONS` in `src/inventory/inventory.ts`, e.g. `yew_bow`, put in every party member's hand; the way to compare weapon balance, between weapons of one skill, as the heroes are not all trained in the same), `--encounter` (an id from `ENCOUNTERS`, default `goblin_raid`), `--threat` (how dangerous to make it, default 1) and `--party-level` (the level every member is raised to, at full hit points and with its skill points and perks spent by `autoAdvance`, default 1); the last three are the way to check scaling. The player's side is a new game's party. It writes every event as JSONL and prints a summary of win rate, rounds, hit rates and free attacks.

The game takes a seed from the page's address, as in `http://localhost:5173/?seed=42` (`seed.ts`; `main.ts` puts it in the game's registry). Every battle of that session is then fought with it, the enemy's choices included, so the same actions play out the same way: use it to replay a battle from the seed its `battle_start` logged.

## Committing

Commit finished work without being asked: once a change is complete and `npm test` passes, commit it on the current branch. Commits are free in this project's workflow, so there is no need to wait for a go-ahead. Do not push unless asked.

## Architecture

The central rule: **game rules are Phaser-free and live outside the scenes.** The same `BattleEngine` drives the in-browser game and the headless simulator, so anything that changes a battle's outcome has to go in the domain modules, with tests.

### Domain layer (plain TypeScript, runs in Node)

- `src/grid/hex.ts`: axial `{q, r}` hex maths, odd-r offset conversion for the rectangular board, `HEX_DIRECTIONS` (opposite directions are 3 apart), and `reachableHexes`, the pathfinder that prefers routes provoking the fewest distinct foes.
- `src/combat/`: percentile attack resolution (a roll of 1 to 100 hits when within the attacker's `toHit`, plus bonuses, less the defender's armour class, the chance kept between 5 and 95; a hit is critical when the roll is also within `critChance`), damage rolls, monster stat blocks and what a level adds to them (`foeAtLevel`), and the seedable `mulberry32` RNG.
- `src/character/` and `src/inventory/`: a persistent `Character` and its equipment. A character stores only what it was born with (`attributes`, `tagged` skills), what it has learned (`level`, `trained` skill points, `perks`) and what it carries; every number it fights with is derived from those, never stored: `maxHp`, and `deriveCombatStats`, which turns a character into the `CombatantStats` the engine fights with. `attributes.ts`, `skills.ts` and `perks.ts` are the three tables, with the rules for raising a skill and qualifying for a perk. `portraits.ts` lists the preset faces (`PORTRAIT_IDS`); a character's `portrait` is only looks. See the rules of characters below.
- `src/character/progression.ts`: levels and experience: what each level costs (`xpToNextLevel`), what `gainXp` does to a character, and the spending of what a level brings (`takePerk`, and `autoAdvance` for the simulator). See the rules below.
- `src/engine/battleEngine.ts`: the battle state machine. Callers only ever:
  - ask `legalActions(unit?)`, `previewMove`, `previewAttack`, `getState()`
  - call `step(action)`, which returns the `BattleEvent[]` it produced
  
  Events are the engine's only output and are also the log format. **Bump `LOG_SCHEMA_VERSION` whenever an event's shape changes.** Events record more than the player is shown (AP spent and left, the numbers behind each roll, the items behind a gear change); `formatEvent` renders the short on-screen line, so add detail to the event and keep the line simple. `battle_start` records the seed and policies so any battle can be replayed.
- `src/engine/policies.ts`: AI as pure functions `({ state, legal, rng }) => Action`, registered in `POLICIES`. The game's enemy and the simulator's two sides pick from the same registry.
- `src/game/encounters.ts`: battle setups, registered by id in `ENCOUNTERS`. A monster location on the world map names the `EncounterId` it leads to and the threat to fight it at, and the simulator fights `goblinRaid` unless told otherwise, so balance runs fight a battle the game has. A setup is built for the party and the threat it is given: the threat decides how many of the encounter's foes take the field and their level (see the rules of scaling below). The party is (a `Fighter` per member: stats and hit points left), lined up on the `PARTY_START` hexes and member i's unit is named `heroId(i)`, which is how `BattleScene` finds the `Character` behind a unit. Each setup also maps unit ids to a `UnitKind`, which is how scenes pick a sprite and how `xpReward` prices the foes (`FOE_XP` times their level); the engine knows only stats.
- `src/game/party.ts`: the `Party`, the player's characters in battle order: at most `MAX_PARTY_SIZE` (6), three level 1 heroes of different builds in a new game (`newParty`), and what a won battle brings them (`rewardVictory`): experience, and the healer's tending.
- `src/game/ground.ts`: `Ground`, the loose items lying on a battlefield, one pile per hex, and `pileChanges`, which tells what a visit to the inventory dropped and picked up. `BattleScene` holds one `Ground` per battle; the engine does not track it.
- `src/game/worldMap.ts`: the world map's state and rules, Phaser-free like the battle's: `WorldState` (the board, the party's hex, the turn count, the locations) and the functions that change it (`travel`, `linger`, `clearLocation`). `WorldScene` asks `routeTo` what a click would do and must not decide it. See the rules below.
- `src/game/gameState.ts`: state that outlives a scene, which is the player's `Party` and the `WorldState`. It is created by the menu and passed through scene data, never held in a module global.

Rules of the battle system worth knowing before touching the engine: a side's units act in any order and the turn ends manually; units get 8 AP a turn by default, a move costs 1 AP per hex (`MOVE_AP_COST_PER_HEX`) and an attack costs the unit's `attackApCost` and reaches foes within its `attackRange`, both of which come from its weapon (`ItemStats`; the longsword costs 5 and reaches 1 hex, the bow reaches 5); nothing blocks a shot, as there is no line of sight yet; a two-handed weapon and an off-hand item cannot be held together, so equipping either stows the other (`equipFromBackpack`), or drops it on the ground when the backpack has no room, and the inventory shows the weapon ghosted in the off-hand slot; leaving a hex adjacent to a ready foe with a melee weapon provokes one free attack (one per unit per enemy turn, decided in `reactorsAt`; ranged weapons hold no zone of control); bonuses to the chance to hit, in percent, stack from flanking (`FLANK_BONUS_PER_ALLY`) and from the arc struck (`ARC_BONUS`, judged at range by the neighbouring hex the shot comes in over); facing is automatic, set by moving and attacking.

Gear can be changed mid-battle. The inventory opens for the selected unit (I or C) and edits its `Character` directly (`equipFromBackpack`, `unequipToBackpack`), and when it closes `BattleScene` sends the engine an `equip` action carrying the newly derived stats, one for each member whose gear was changed while the panel was open (its portraits turn it from member to member), since the engine knows stats and not items; the action also lists the items changed (`gearChanges`), which the engine only copies into the `equip` event. Items can be dropped on that unit's hex and picked up from it the same way: the inventory's Ground section edits that hex's pile (`dropFromBackpack`, `dropEquipped`, `pickUp`; right-click or Ctrl+click drops, a click on a ground item picks it up into the backpack, and a pile deeper than the grid scrolls with the wheel), and the same `equip` action lists what was `dropped` and `pickedUp`, again only for the log. Equipping, stowing, dropping and picking up share one cost: a change costs `EQUIP_AP_COST` (1 AP), paid once: further changes are free until the unit moves or attacks or its turn ends (`equipCost`). `legalActions` never lists `equip`, so the AI policies do not change gear.

Rules of the world map: the map (`WORLD_SIZE`) is several windows across, and `WorldScene` scrolls it to follow the party, so far lands come into view only by travelling (nothing is hidden by rule: there is no fog of war yet, and no way to pan the view); time passes in turns, one per hex travelled; routes keep clear of every monster location except one they end on; walking into monsters sets `confronting`, and the party cannot travel on until it scouts, waits (a turn each, and neither does more yet) or attacks; a won battle takes its location off the map. Towns and resources are only shown for now.

Rules of scaling: monsters are the more dangerous the further from the party's home they lie. A monster location's `threat` is 1 within `THREAT_BAND` (11) hexes of Oakvale and one more for each band beyond, up to `MAX_THREAT` (5) (`threatAt`), and `WorldScene` tells the player the threat of the monsters it stands before. A battle at threat T fields `FOES_AT_THREAT[T - 1]` foes (2, 3, 3, 3, 4), all of level T, and a level adds to a monster two fifths of its level 1 hit points, 5 to its chance to hit and to its armour class, and 1 damage every second level (`foeAtLevel`). The numbers come from simulator runs of a party that fights the map nearest first, carries its wounds and spends its levels with `autoAdvance`. As tuned, the aggressive policy finishes the map about 2 times in 3, losing nearly always at threat 5; a fresh level 1 party wins nearly every battle at threat 2, about 7 in 10 at threat 3 and 4 in 10 at threat 4, and none at threat 5, while a party of the threat's own level wins them all up to threat 4. Retune them when a hero's growth changes (skill points a level, a perk, a new skill) or there is more healing than First Aid.

Rules of characters, which follow Fallout 1 and 2: a character has six attributes from 1 to 10 (`ATTRIBUTE_IDS`), adding up to `ATTRIBUTE_POINTS`, which never change. They give it hit points (10 + strength + endurance, and 2 + half its endurance a level), action points (5 + half its agility), armour class (agility, plus armour and shield), its critical chance (luck) and a little melee damage (strength), and they set where each skill starts. A skill is a percentage (`SKILLS`); two are tagged, which adds `TAG_BONUS` and doubles what a skill point buys, and from `MASTERY_LEVEL` a raise costs double. A weapon skill is the chance to hit with that kind of weapon before the foe's armour (`weaponSkill`: Melee Weapons, Archery, or Unarmed with nothing in hand, where the skill also sets the damage die). First Aid works after a victory: the best healer still standing restores `firstAidHp` to every member. A perk (`PERKS`) is data: what it asks (level, attributes, skills), how many ranks it has and what a rank adds (`PerkEffects`), which `perkBonus` sums wherever that number is derived, so a new perk whose effect is already a key needs only an entry, and a new kind of effect needs a key and a reader. There are no classes and no character creation yet: a new game's three heroes are fixed builds (`STARTING_HEROES`), each with a portrait picked for it, and attributes do not rise.

Rules of progression: winning a battle earns the experience its foes are worth together (`xpReward`), a foe of level L being worth L times what its kind is worth at level 1, awarded by `BattleScene` when the battle ends (`rewardVictory`); the engine and the simulator know nothing of it. Every party member earns the whole reward, the fallen too, so the yardstick below holds for each hero whatever the party's size. A member who fell in a won battle gets back up at `REVIVED_HP` (1); a battle is lost only when every member has fallen, and that ends the game. A foe's worth is fixed by its kind and level, while each level costs more than the last, so early levels come fast and later ones slowly. The yardstick is the even foe, worth `EVEN_FOE_XP_PER_LEVEL` × the hero's level, with a weak foe at half that: level 2 costs a little under one even foe, and after that leaving level L costs L − 1 of them. Price a new monster against that yardstick. A level brings hit points, skill points (2 + half the hero's intelligence) and, every `PERK_LEVEL_STEP`th level, a perk to pick, and it heals the hero fully. The points and the pick wait on the character until the player spends them, which is done on the world map and not in battle: stats changed mid-battle would have to reach the engine as an `equip` action does.

### Scene layer (`src/scenes/`)

Scenes are `Boot` → `Menu` → `World` ⇄ `Battle`. New on the menu starts `World` with a fresh `GameState`. Attacking a monster location starts `Battle` with that location's id; a victory clears the location and returns to `World`, and a defeat goes back to `Menu`. `Inventory` is the character panel, an overlay showing one party member at a time in three tabs (Character, Skills, Inventory): over `Battle` (C, S, I), where gear can be changed but skill points and perks are only shown, and over `World` (C), where it is the other way round. It is handed the whole party (`PanelMember`s: each character, and in battle what its gear may do) and the member to open on, and when it closes it tells the scene under it which member it last showed, as the data of the resume.

The party's portraits run down the left of `World`, `Battle` and `Inventory` alike (`PartyColumn`, placed by `partyPanel.ts`), so they seem to stay put under the panel. One member is the active one, marked in gold: in battle the selected unit, on the world map only the member a panel opens for. A click on a portrait makes its member active and a click on the active member's opens its panel (`portraitClick`); in battle a member that cannot be selected (spent, fallen, or during the enemy's turn) has its panel opened at once. A click on a portrait beside the open panel turns the panel to that member. `Menu` is an overlay over `World` or `Battle` (Esc). Both are told which scene to resume by their `resume` scene data; overlays pause the scene under them and resume it on close.

`BattleScene` is a view over the engine: it turns clicks into `Action`s, calls `engine.step`, and plays back the returned events. It must not decide outcomes. Scenes use Phaser's `RESIZE` scale mode, so each one positions everything in a `layout()` method that reruns on resize; the game is held at a minimum of 840×560 (`MIN_GAME_SIZE` in `src/main.ts`), below which the page scrolls. `World` and `Battle` lay their map, board, log and buttons out to the right of the party's column (`PARTY_PANEL_W`).

Scene logic that can be expressed without Phaser is pulled into sibling helper modules, and new logic should follow suit: `eventSchedule.ts` (timing of event playback), `boardGeometry.ts` (hex ↔ screen, for a `BoardLayout`: the battlefield's is squashed to look like a floor, the world map's is flat with smaller hexes), `attackPlan.ts` (what clicking a foe does), `scrollingLog.ts`, `slotScroll.ts` (which rows of the ground pile the inventory shows), `mapScroll.ts` (where the world map sits on screen for the party to be in view), `partyPanel.ts` (where the party's portraits sit and what a click on one does), `clicks.ts` (what counts as a right-click), `sounds.ts` (which sounds an event triggers), `audioSettings.ts` (volume levels, saved to `localStorage`), `cursors.ts` (the pointer cursors, as inline SVG), `seed.ts` (the seed in the page's address). `PartyColumn.ts` is the one helper that does import Phaser: the game objects of the party's column, shared by the three scenes that show it, with no logic of its own.

Every scene but `Boot` has a `probe()`: plain data telling where its controls are on screen and what state it shows, typed in `src/testHook.ts`. In dev builds `main.ts` installs the hook that puts the probes within the in-browser tests' reach as `window.__yomi`; a production build leaves it out. Game code must not read the hook or the probes. A control that a test needs to click goes in its scene's probe.

### Tests

`vitest.config.ts` defines two projects, and where a test file lives decides how it runs:

- `domain` (Node environment): every `*.test.ts` under `src/` and `scripts/` except the ones below. Helper modules in `src/scenes/` must stay free of runtime Phaser imports for their tests to run here.
- `scenes` (jsdom + canvas mock, shared module graph): only `src/scenes/*Scene.test.ts`. These are smoke tests; real behaviour is tested through the helper modules and the engine.

Tests that need determinism pass a seeded `mulberry32` or a scripted RNG into the engine.

The in-browser tests in `e2e/` are a separate run (`npm run test:browser`, with its own `vitest.browser.config.ts`) and not part of `npm test`: they take seconds each and need Playwright's Chromium, which the podman image carries for `make test-browser`. They play the real game served by a Vite dev server and check what the others cannot: the scenes handing over to each other, overlays pausing and resuming, assets loading, layout on resize. Run them after a change to a scene. `e2e/CLAUDE.md` says how they work and how to add one.

### Assets and docs

Sprites in `public/assets/sprites/` are generated from `art/` (see Sprites) and audio in `public/assets/audio/` is placeholder; each directory's `README.md` records provenance and licence and should be updated when files are added. `BootScene` preloads every sound in `SOUND_KEYS` (`sounds.ts`); `BattleScene` loads one sprite per `UnitKind` from `assets/sprites/<kind>.png`, keyed by its `APPEARANCE` table, so a new unit kind needs an entry there, a matching PNG and an experience value in `FOE_XP`. `InventoryScene` loads one icon per `ItemIcon` from `assets/sprites/icon_<icon>.png`, keyed by `ITEM_ICON_KEYS` (`itemIcons.ts`). `WorldScene` loads one sprite per `LocationKind`, keyed by `LOCATION_SPRITES`, and shows the party as the warrior's battle sprite. Every scene with a `PartyColumn` loads one portrait per `PortraitId` from `assets/sprites/portrait_<id>.png` (`portraitKey`), so a new preset needs an id in `PORTRAIT_IDS` and a matching sprite in `art/portraits/`.

`docs/implementation-plans/` holds step-by-step plans with completion logs, which are useful for the reasoning behind past fixes.

### Sprites

Sprites are generated from text sources in `art/` with sprite-tool. `art/CLAUDE.md` has the workflow, and loads by itself when you work on files there; read it before drawing or changing a sprite. Never edit an exported PNG by hand: change the source and run `npm run sprites`.

## Keeping this file current

This file is the project's code map, and it is only worth loading if it is true. Update it in the same commit as the change that makes it wrong or incomplete; do not leave it for a later pass.

A change needs an edit here when it:

- adds, removes or renames a scene, or changes how scenes hand over to each other
- adds a domain module, or a helper module in `src/scenes/`
- adds or changes a command, npm script or simulator flag
- adds or changes a rule of play that someone would need to know before touching the code that enforces it
- adds a table that maps ids to assets (like `APPEARANCE` or `ITEM_ICON_KEYS`), or changes which scene loads what
- changes how tests are split between the vitest projects
- makes a "not yet" statement here false (for example "there is no line of sight yet")

Before committing, search this file for every name the change renamed or deleted, and fix or remove the lines that mention it.

What belongs here is what the code does not say for itself: where a kind of logic goes, the contract between modules, the rules that span files, and the reason behind a constraint. Give a module one line on what it is responsible for, not a list of its exports. Leave out anything a grep answers, and do not grow a file-by-file inventory.

Keep this file to what most tasks need. Detail that matters only inside one directory goes in a `CLAUDE.md` in that directory, as `art/CLAUDE.md` does for sprites, with a one-line pointer here.
