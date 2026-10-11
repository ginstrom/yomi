# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Yomi is a 2D turn-based fantasy tactics game: Phaser 4 + TypeScript, bundled with Vite. Battles are fought on a pointy-top hex grid, with action points, flanking, facing arcs and zones of control.

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
| Production build | `npm run build` |
| Headless battle simulator | `npm run simulate -- --battles 2000 --seed 1` |
| Build sprites from `art/` | `npm run sprites` |
| Check exported sprites are up to date | `npm run sprites:check` |

There is no linter; `tsc` is the lint step (`noUnusedLocals`, `noUnusedParameters`, `erasableSyntaxOnly`, `verbatimModuleSyntax`). `erasableSyntaxOnly` means no enums, namespaces or constructor parameter properties; use `import type` for type-only imports.

The `Makefile` runs the same things inside a podman container (`make run`, `make test`, `make simulate ARGS="..."`, `make shell`), with `node_modules` in a named volume that reinstalls itself when `package-lock.json` changes. `vite.config.ts` polls for file changes because of that bind mount.

Simulator flags: `--battles`, `--seed`, `--out` (default `logs/battles.jsonl`; `logs/` is gitignored), `--max-rounds`, `--player-policy`, `--enemy-policy` (`aggressive` or `random`). It writes every event as JSONL and prints a summary of win rate, rounds, hit rates and free attacks.

## Committing

Commit finished work without being asked: once a change is complete and `npm test` passes, commit it on the current branch. Commits are free in this project's workflow, so there is no need to wait for a go-ahead. Do not push unless asked.

## Architecture

The central rule: **game rules are Phaser-free and live outside the scenes.** The same `BattleEngine` drives the in-browser game and the headless simulator, so anything that changes a battle's outcome has to go in the domain modules, with tests.

### Domain layer (plain TypeScript, runs in Node)

- `src/grid/hex.ts`: axial `{q, r}` hex maths, odd-r offset conversion for the rectangular board, `HEX_DIRECTIONS` (opposite directions are 3 apart), and `reachableHexes`, the pathfinder that prefers routes provoking the fewest distinct foes.
- `src/combat/`: d20 attack resolution, damage rolls, monster stat blocks, and the seedable `mulberry32` RNG.
- `src/character/` and `src/inventory/`: the persistent `Character` and its equipment; `deriveCombatStats` turns a character into the `CombatantStats` the engine fights with.
- `src/engine/battleEngine.ts`: the battle state machine. Callers only ever:
  - ask `legalActions(unit?)`, `previewMove`, `previewAttack`, `getState()`
  - call `step(action)`, which returns the `BattleEvent[]` it produced
  
  Events are the engine's only output and are also the log format. **Bump `LOG_SCHEMA_VERSION` whenever an event's shape changes.** `battle_start` records the seed and policies so any battle can be replayed.
- `src/engine/policies.ts`: AI as pure functions `({ state, legal, rng }) => Action`, registered in `POLICIES`. The game's enemy and the simulator's two sides pick from the same registry.
- `src/game/encounters.ts`: battle setups, shared by the game and the simulator so balance runs fight the real encounter. It also maps unit ids to a `UnitKind`, which is how scenes pick a sprite; the engine knows only stats.
- `src/game/gameState.ts`: state that outlives a scene. It is created by the menu and passed through scene data, never held in a module global.

Rules of the battle system worth knowing before touching the engine: a side's units act in any order and the turn ends manually; units get 8 AP a turn by default, a move costs 1 AP per hex (`MOVE_AP_COST_PER_HEX`) and an attack costs the unit's `attackApCost`, which comes from its weapon (`ItemStats.attackApCost`; the longsword's is 5); leaving a hex adjacent to a ready foe provokes one free attack (one per unit per enemy turn, decided in `reactorsAt`); to-hit bonuses stack from flanking (`FLANK_BONUS_PER_ALLY`) and from the arc struck (`ARC_BONUS`); facing is automatic, set by moving and attacking.

### Scene layer (`src/scenes/`)

Scenes are `Boot` → `Menu` → `Battle`, with `Inventory` and the in-battle `Menu` launched as overlays that pause `Battle` and resume it on close.

`BattleScene` is a view over the engine: it turns clicks into `Action`s, calls `engine.step`, and plays back the returned events. It must not decide outcomes. Scenes use Phaser's `RESIZE` scale mode, so each one positions everything in a `layout()` method that reruns on resize; the game is held at a minimum of 760×560 (`MIN_GAME_SIZE` in `src/main.ts`), below which the page scrolls.

Scene logic that can be expressed without Phaser is pulled into sibling helper modules, and new logic should follow suit: `eventSchedule.ts` (timing of event playback), `boardGeometry.ts` (hex ↔ screen), `attackPlan.ts` (what clicking a foe does), `scrollingLog.ts`, `sounds.ts` (which sounds an event triggers), `audioSettings.ts` (volume levels, saved to `localStorage`).

### Tests

`vitest.config.ts` defines two projects, and where a test file lives decides how it runs:

- `domain` (Node environment): every `*.test.ts` under `src/` and `scripts/` except the ones below. Helper modules in `src/scenes/` must stay free of runtime Phaser imports for their tests to run here.
- `scenes` (jsdom + canvas mock, shared module graph): only `src/scenes/*Scene.test.ts`. These are smoke tests; real behaviour is tested through the helper modules and the engine.

Tests that need determinism pass a seeded `mulberry32` or a scripted RNG into the engine.

### Assets and docs

Sprites in `public/assets/sprites/` are generated from `art/` (see below) and audio in `public/assets/audio/` is placeholder; each directory's `README.md` records provenance and licence and should be updated when files are added. `BootScene` preloads every sound in `SOUND_KEYS` (`sounds.ts`); `BattleScene` loads one sprite per `UnitKind` from `assets/sprites/<kind>.png`, keyed by its `APPEARANCE` table, so a new unit kind needs an entry there and a matching PNG. `InventoryScene` loads one icon per `ItemIcon` from `assets/sprites/icon_<icon>.png`, keyed by `ITEM_ICON_KEYS` (`itemIcons.ts`).

### Sprites (sprite-tool)

Sprites are made with [sprite-tool](https://github.com/ginstrom/sprite-tool) (`uv tool install git+https://github.com/ginstrom/sprite-tool@v0.3.0`), which is installed on the host and is not in the podman image. Run `sprite guide --project art` before drawing or changing one: it prints the file format, the palette and the canvas classes.

- Sources are text grids in `art/**/<id>.sprite.toml`; `art/sprite-tool.toml` holds the canvas classes and the export target. Create one with `sprite new <kind> --canvas unit --project art --dir units`, where the id is the `UnitKind`.
- Loop: `sprite check --project art` until it prints `ok`, `sprite preview <id> --grid --project art` and look at the PNG it names, then `npm run sprites`.
- The build writes loose PNGs (`<id>.png`, the first frame) into `public/assets/sprites/`, which is what `BattleScene` loads, plus `sprites.json`, a per-sprite metadata index (size, anchor, bounds, display scale) that nothing loads yet. Commit the exported files, `sprites.json` and `.sprite-tool-manifest.json` with the source; never edit an exported PNG by hand.
- The tool only overwrites files listed in the manifest, and every PNG in `public/assets/sprites/` is now on it. A PNG put there by hand stops the build for a sprite with the same id; replacing one deliberately takes a one-off `sprite build --adopt --project art`, plus an update to the sprites `README.md`.
- All sprites share `art/palette.toml`, a muted Baldur's Gate-style palette. Units are drawn on the 32px `unit` canvas and shown at 3x, so creature size is drawn into the sprite; item icons use the 20px `icon` canvas at 2x.
- `art/units/warrior.sprite.toml.example` is the tool's sample sprite, renamed so it is not built. It is a format reference, not the game's warrior.

`docs/implementation-plans/` holds step-by-step plans with completion logs, which are useful for the reasoning behind past fixes.
