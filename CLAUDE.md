# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository. It is the map; the detail lives in a `CLAUDE.md` in each directory (see "Where the detail is"), which loads by itself when you work on files there.

## What this is

Yomi is a 2D turn-based fantasy tactics game: Phaser 4 + TypeScript, bundled with Vite. Battles are fought on a pointy-top hex grid, with action points, flanking, facing arcs and zones of control. Between battles the company's parties travel a world map, also of hexes, against a spreading blight, from a home encampment whose facilities (guild hall, shrine, trading post, workshop, infirmary) they build up.

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
| Retake the player's manual's screenshots (`docs/manual/`) | `npm run manual:screenshots` |
| Production build | `npm run build` |
| Headless battle simulator (flags: `scripts/CLAUDE.md`) | `npm run simulate -- --battles 2000 --seed 1` |
| Campaign simulator, the balance measure (about five minutes; run one at a time) | `npm run simulate -- --campaign --battles 500 --seed 1` |
| Build sprites from `art/` / check they are up to date | `npm run sprites` / `npm run sprites:check` |
| Build sound banks from `audio/` / check them (host only: uv and ffmpeg; not in `npm test`) | `npm run sounds` / `npm run sounds:check` |
| Narration job list / render changed lines (host only; see `audio/CLAUDE.md`) | `npm run narration:export` / `npm run narration` |

There is no linter; `tsc` is the lint step (`noUnusedLocals`, `noUnusedParameters`, `erasableSyntaxOnly`, `verbatimModuleSyntax`). `erasableSyntaxOnly` means no enums, namespaces or constructor parameter properties; use `import type` for type-only imports.

The `Makefile` runs the same things inside a podman container (`make run`, `make test`, `make test-browser ARGS="-t victorious"`, `make simulate ARGS="..."`, `make shell`), with `node_modules` in a named volume that reinstalls itself when `package-lock.json` changes. `vite.config.ts` polls for file changes because of that bind mount.

In dev builds `~` opens a debug console (`debugCommands.ts`; `help` lists the commands). `?seed=42` in the page's address fights every battle of the session with that seed, which replays a battle from the seed its `battle_start` logged. Both are described in `src/scenes/CLAUDE.md`.

## Committing

Commit finished work without being asked: once a change is complete and `npm test` passes, commit it on the current branch. Commits are free in this project's workflow, so there is no need to wait for a go-ahead. Do not push unless asked.

## Subagents

When spawning an agent, pick its model by the task. Pass `model: "sonnet"` for work that is not too complex: searching the code or finding where something lives, reading and summarising files or logs, running the tests or the simulator and reporting the result, and mechanical edits whose shape is already decided (a rename, a table entry, a doc update). Leave the model unset, so the agent inherits the session's, for work that needs judgement: designing or planning a feature, changing the engine's rules or the balance, debugging a failure whose cause is unknown, and reviewing code. When in doubt between the two, use the session's model.

## Architecture

The central rule: **game rules are Phaser-free and live outside the scenes.** The same `BattleEngine` drives the in-browser game and the headless simulator, so anything that changes a battle's outcome goes in the domain modules, with tests. Scenes are views: they turn input into calls on the domain and play back what it returns.

### Domain layer (plain TypeScript, runs in Node)

- `src/grid/hex.ts`: axial hex maths, offset conversion, area shapes (`areaOf`) and the pathfinder that avoids provoking free attacks (`reachableHexes`).
- `src/combat/`: attack resolution, damage and resistance, monster stat blocks and their scaling by level, spells, statuses, abilities, elements and wards, and the seedable `mulberry32` RNG.
- `src/character/`: the persistent `Character` (attributes, skills, the skill trees' nodes, levels and experience), character creation, `autoAdvance`'s plans, and healing cast on the world map.
- `src/inventory/`: the gear catalog, items with their grades, modifiers and runes, and equipping.
- `src/engine/battleEngine.ts`: the battle state machine; `src/engine/policies.ts`: the AI, as pure functions in `POLICIES`, shared by the game's enemy and both sides of the simulator. `src/engine/autoPlay.ts`: the headless loop (`playStep`, `playOut`) that plays a battle with a policy on each side, shared by the simulator and auto-resolve, with `AUTO_POLICY`, `ENEMY_POLICY` and `AUTO_ROUND_LIMIT`.
- `src/game/`: everything outside battle: encounters and bandits, the party and the company of parties with its day loop (`company.ts`), the world map, the blight and territory, fog of war, camping, the encampment's buildings and facilities, loot, the auto-resolve estimate, the `GameState`, and saving.
- `src/story/`: cutscenes and the tutorial, which change no rule.

Contracts that span the code:

- **The engine.** Callers only ask (`legalActions`, the `preview*` functions, `getState`) and call `step(action)`, which returns the `BattleEvent[]` it produced. Events are the engine's only output and the log format: **bump `LOG_SCHEMA_VERSION` whenever an event's shape changes.** `snapshot()` and `BattleEngine.restore` save and resume a battle.
- **Randomness.** Every battle is seeded and `battle_start` logs the seed and policies, so any battle can be replayed. Nothing outside the engine may draw from a battle's stream: rune loot has its own stream seeded from the battle's seed, the world has its own saved RNG, and sound variation uses `Math.random`.
- **Derived, never stored.** A character stores only what it was born with, has learned, has left and carries; every number it fights with (`maxHp`, `maxMana`, `deriveCombatStats`, `attributeLevel`, `skillLevel`) is derived. A change to what a character wears ends with `clampHp`.
- **Refusals.** An action on the game state returns why it was refused, or null, and checks everything before changing anything.
- **Saves.** Raise `SAVE_VERSION` whenever the shape of `GameState`, `Character`, `WorldState` or `BattleSnapshot` changes; saves need not stay compatible, and a migration is written only when a design asks for one. Items are saved by id, so a new base or enchanted item must be in `BASE_ITEMS` or `MAGIC_ITEMS`.
- **Balance.** The constants are tuned with the campaign simulator against bands the user set (`scripts/CLAUDE.md`). Retune when a hero's growth, the ready-made party, the party limit or healing changes, and expect the refactor guard (`scripts/simulate.test.ts`) to fail on any change that moves play.
- **Import cycles.** Several modules import one another (`skills.ts`/`perks.ts`/`trees.ts`; `blight.ts`/`territory.ts`/`worldMap.ts`; `company.ts` and the modules that pass days), which is safe only while none calls another as its module loads.

### Scene layer (`src/scenes/`)

Scenes are `Boot` → `Menu` → `Party` ⇄ `Creation` → `World` ⇄ `Battle`, with `Encampment`, `GuildHall`, `TradingPost`, `Crafting`, `Exchange`, `Inventory` (the character panel) and `Story` as overlays. Scene logic that can be expressed without Phaser goes in a sibling helper module with tests, and those modules must not import Phaser at runtime. Every scene but `Boot` has a `probe()` for the in-browser tests; game code never reads it. Scenes use the `RESIZE` scale mode and lay out in `layout()`; the game is held at a minimum of 840×560.

## Where the detail is

| File | Read it before touching |
| --- | --- |
| `src/engine/CLAUDE.md` | the engine, the AI, the rules of battle and casting |
| `src/combat/CLAUDE.md` | stat blocks, spells, statuses, abilities, foe scaling |
| `src/character/CLAUDE.md` | characters, creation, the skill trees, progression, items and runes |
| `src/game/CLAUDE.md` | encounters, the company and orders, the world map, the blight, the encampment, saving, scaling |
| `src/story/CLAUDE.md` | cutscenes and the tutorial |
| `src/scenes/CLAUDE.md` | any scene or helper module, the battle screen, the character panel, assets loaded, the debug console |
| `scripts/CLAUDE.md` | the simulator's flags, campaigns, the balance bands and tuning |
| `e2e/CLAUDE.md` | the in-browser tests |
| `art/CLAUDE.md` | sprites (generated from `art/` with sprite-tool; never edit an exported PNG, run `npm run sprites`) |
| `audio/CLAUDE.md` | sound effects and narration (generated from `audio/`; never edit the banks or manifests by hand) |

Each directory's `CLAUDE.md` is a working guide: contracts, checklists and one line a module. The exhaustive rules (every constant, status, UI behaviour, policy step and printed statistic) are in `docs/reference/` (`battle.md`, `characters.md`, `game.md`, `scenes.md`, `simulator.md`, `audio.md`, `sprites.md`), which nothing loads by itself: open the section you need when the guide points there.

## Tests

`vitest.config.ts` defines two projects, and where a test file lives decides how it runs:

- `domain` (Node environment): every `*.test.ts` under `src/` and `scripts/` except the ones below.
- `scenes` (jsdom + canvas mock, shared module graph): only `src/scenes/*Scene.test.ts`. These are smoke tests; real behaviour is tested through the helper modules and the engine.

Tests that need determinism pass a seeded `mulberry32` or a scripted RNG into the engine. The in-browser tests in `e2e/` (`npm run test:browser`) are a separate run, not part of `npm test`, that plays the real game in Chromium; run them after a change to a scene.

## Docs

`docs/manual/README.md` is the player's manual, shown from the game's menu, its screenshots taken by `e2e/manual.shots.ts` (`npm run manual:screenshots`); a change to a rule it states or a screen it shows should update it and retake them. `docs/designs/` holds feature designs, which may be ahead of the code. `docs/implementation-plans/` holds step-by-step plans with completion logs, the record of past reasoning and of the balance's history.

## Keeping these files current

The `CLAUDE.md` files are the project's code map, worth loading only while they are true. Update the right one in the same commit as the change that makes it wrong or incomplete; search them for every name the change renamed or deleted.

Where a fact goes:

- **This file**: what most tasks need: commands, the module map (one line a module), the contracts that span directories, where the detail is. A new rule of play or a new module's detail does not go here.
- **A directory's `CLAUDE.md`**: the contracts, gotchas and "if you add X, also update Y" checklists for that directory, and one line a module on what it is responsible for, not a list of its exports.
- **`docs/reference/<area>.md`**: the full rule text and detail a task in that area may need to look up. A new rule's detail goes here, with a line in the directory's guide only if getting it wrong would cause a bug.
- **Nowhere**: what a grep answers, what the code says for itself, and history (which step changed a number, measurements of past runs). History belongs in `docs/implementation-plans/`.

`scripts/claudeMd.test.ts` holds this file under 16 KB and each directory's `CLAUDE.md` under 12 KB. When it fails, move detail into `docs/reference/` rather than raising the limit.
