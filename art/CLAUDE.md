# Sprites (sprite-tool)

Guidance for working in `art/`, the text sources of every sprite in the game. The root `CLAUDE.md` covers the rest of the project. `docs/reference/sprites.md` has the canvases and scales of each kind of sprite, the build's two targets, the animation frames, the hero's layer regions (fist box, grip point, face) and the battle effects' conventions: read it before drawing a unit, gear or an effect.

Drawing a sprite (the loop, runs, variants, anims, gear sprites' `over`/`like`/regions): `.claude/skills/yomi-sprites/`.

- Sources are text in `art/**/<id>.sprite.toml`; never edit an exported file by hand. `art/sprite-tool.toml` holds the canvas classes and the export target.
- Commit everything the build writes into `public/assets/sprites/`, `.sprite-tool-manifest.json` included, with the source. `npm run sprites:check` fails when they are stale.
- The tool only overwrites files listed in the manifest, and every PNG in `public/assets/sprites/` is on it. A PNG put there by hand stops the build for a sprite with the same id; `sprite build --adopt --project art` replaces one deliberately.
- A unit needs `idle` and `walk`; a map sprite has `idle`.
- A unit names the middle of its body `[points] chest`, where shots and spells are aimed and fly from; every unit kind needs one. In a file with a top-level `outline = "auto"`, put `[points]` below it, or TOML reads `outline` as a point.
- A new weapon, shield, armour, head or cloak icon needs a sprite and an entry in `GEAR_SPRITES` or `WORN_SPRITES` (`src/scenes/unitLook.ts`), or `unitLook.test.ts` fails.
- Adding sprites: record provenance and licence in `public/assets/sprites/README.md`.
- `art/units/warrior.sprite.toml.example` is the tool's sample sprite, renamed so it is not built. It is a format reference, not the game's warrior.
