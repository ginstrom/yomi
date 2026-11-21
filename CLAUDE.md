# CLAUDE.md

Yomi is a 2D turn-based fantasy tactics game: Phaser 4 + TypeScript, bundled with Vite. Battles are fought on a pointy-top hex grid (action points, flanking, facing arcs, zones of control). Between battles the company's parties travel a hex world map against a spreading blight, from a home encampment they build up.

This file is the map. A directory's `CLAUDE.md` loads when you work there; the exhaustive rules are in `docs/reference/`, which nothing loads by itself.

## Commands

Node 26+ (`scripts/*.ts` run on Node's native TypeScript; imports use explicit `.ts` extensions).

| Task | Command |
| --- | --- |
| Dev server (http://localhost:5173) | `npm run dev` |
| Typecheck + all tests | `npm test` (`tsc && vitest run`); `npm run typecheck` alone |
| One test file / by name | `npx vitest run src/grid/hex.test.ts` / `... -t "routes around zones"` |
| In-browser tests (headless Chromium) | `npm run test:browser` (`-- -t "victorious"` for one) |
| Production build | `npm run build` |
| Battle simulator / campaign balance measure (~5 min, one at a time) | `npm run simulate -- --battles 2000 --seed 1` / `npm run simulate -- --campaign --battles 500 --seed 1` |

Sprites: the `yomi-sprites` skill; sounds and narration: `yomi-sound`; the manual's screenshots: `yomi-manual`. There is no linter: `tsc` is the lint step (`noUnusedLocals`, `noUnusedParameters`, `erasableSyntaxOnly`: no enums, namespaces or parameter properties; `verbatimModuleSyntax`: `import type` for types). The `Makefile` runs the same in a podman container (`make test`, `make test-browser ARGS=...`, `make shell`). Dev builds: `~` opens a debug console, `?seed=42` fixes battle seeds (`src/scenes/CLAUDE.md`).

## Committing

Commit finished work without being asked: once a change is complete and `npm test` passes, commit it on the current branch. Do not push unless asked.

## Subagents

Pass `model: "sonnet"` for work that is not too complex: searching, reading and summarising, running tests or the simulator and reporting, mechanical edits whose shape is decided. Leave the model unset for work that needs judgement: designing, changing rules or balance, debugging an unknown cause, reviewing code. When in doubt, leave it unset. Simulator measurements: the `yomi-measure` agent; asset checks: `yomi-asset-check`.

## Architecture

**Game rules are Phaser-free and live outside the scenes.** The same `BattleEngine` drives the game and the headless simulator, so anything that changes an outcome goes in the domain modules, with tests. Scenes are views.

| Directory | What | Guide |
| --- | --- | --- |
| `src/grid/hex.ts` | axial hex maths, areas, the free-attack-avoiding pathfinder | — |
| `src/combat/` | attack resolution, stat blocks, foe scaling, spells, statuses, abilities, elements, the seedable `mulberry32` | yes |
| `src/engine/` | battle state machine, AI (`POLICIES`), headless loop (`autoPlay.ts`) | yes |
| `src/character/` | the persistent `Character`, creation, skill trees, progression | yes |
| `src/inventory/` | gear catalog, grades, modifiers, runes | yes |
| `src/game/` | everything outside battle: encounters, the day loop, world map, blight, encampment, `GameState`, saving | yes |
| `src/story/` | cutscenes and tutorial (change no rule) | yes |
| `src/scenes/` | Phaser scenes and their Phaser-free helpers | yes |
| `scripts/` | the simulator and balance bands | yes |
| `e2e/`, `art/`, `audio/` | in-browser tests, sprite and sound sources | yes |

Contracts that span directories (each guide has the detail):

- **The engine** is only asked (`legalActions`, `preview*`, `getState`) and stepped (`step(action)` → `BattleEvent[]`). Events are the log format: **bump `LOG_SCHEMA_VERSION` when an event's shape changes.**
- **Randomness.** Every battle is seeded and replayable from `battle_start`. Nothing outside the engine draws from a battle's stream (loot, the world and sound each have their own).
- **Derived, never stored.** Every number a character fights with is derived; a change to worn gear ends with `clampHp`.
- **Refusals.** An action on the game state returns why it was refused, or null, and checks everything before changing anything.
- **Saves.** Raise `SAVE_VERSION` when `GameState`, `Character`, `WorldState` or `BattleSnapshot` changes shape; no migration unless a design asks. Items save by id, so new items must be in `BASE_ITEMS` or `MAGIC_ITEMS`.
- **Balance.** Constants are tuned against the user's bands (`yomi-balance` skill); a change that moves play fails the refactor guard (`scripts/simulate.test.ts`).
- **Import cycles** (`skills`/`perks`/`trees`, `blight`/`territory`/`worldMap`, `company` and the day-passing modules) are safe only while nothing calls across at module load.

## Tests

Two vitest projects: `scenes` (jsdom smoke tests) is only `src/scenes/*Scene.test.ts`; every other `*.test.ts` under `src/` and `scripts/` is `domain` (Node). Deterministic tests pass a seeded `mulberry32` or scripted RNG. `e2e/` is a separate run; run it after changing a scene.

## Docs

- `docs/reference/<area>.md`: `battle`, `characters`, `game`, `scenes`, `simulator`, `audio`, `sprites`, `e2e`. Open the section you need when a guide points there.
- `docs/manual/README.md`: the player's manual; a change to a rule it states or a screen it shows updates it and retakes its screenshots.
- `.claude/`: project skills (`yomi-*`), agents and role profiles.
- `docs/designs/`: feature designs (may be ahead of the code). `docs/implementation-plans/`: step plans and their history (`log.md`).

## Keeping these files current

Update the right file in the commit that makes it wrong; search the CLAUDE.md files and `.claude/` for each renamed or deleted name. Where a fact goes:

| A fact | Goes in |
| --- | --- |
| commands, the map, contracts spanning directories | this file |
| a rule that stops you breaking one directory's code | that directory's `CLAUDE.md`, a line a module |
| how to do a kind of task (an "if you add X" list, a tool workflow, tuning) | a skill, `.claude/skills/yomi-<task>/`, a file per case |
| what one role needs to know about Yomi | `.claude/roles/<role>.md` |
| a delegated job with a fixed report | `.claude/agents/<name>.md` |
| full rule text and detail | `docs/reference/<area>.md` |
| a feature's state / its history | `docs/features/<slug>.md` State / the plan's `log.md` |
| what a grep answers, what the code says | nowhere |

`scripts/claudeMd.test.ts` caps this file at 16 KB, each directory's at 8 KB, and the `.claude/` skills, agents and always-loaded total; when it fails, move detail into `docs/reference/` or a skill.
