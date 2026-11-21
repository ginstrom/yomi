---
name: yomi-sprites
description: Draw or change a Yomi sprite with sprite-tool (units, gear, icons, map, camp, portraits, effects): guide, check, show, preview, build. Use before editing art/ or adding a sprite.
---

# Drawing a Yomi sprite

Sprites are text sources in `art/**/<id>.sprite.toml`, built by sprite-tool into `public/assets/sprites/`. Run every command from the repository root. What a sprite must satisfy (the contracts) is in `art/AGENTS.md`.

## The loop

1. `sprite guide --project art` prints the file format, the palette and the canvas classes.
2. Edit the `.sprite.toml` (or start one with `sprite new`).
3. `sprite check --project art` until it prints `ok`.
4. `sprite show <id> --project art` to read the result as text; `sprite preview <id> --grid --project art` for the colours, looking at the PNG it names.
5. `npm run sprites` to build, then `npm run sprites:check`; commit the source with everything the build wrote.

Before handing off, run the `yomi-asset-check` agent (`.Codex/agents/yomi-asset-check.md`).

## Files here

- [workflow.md](workflow.md): install and pin, `sprite new` for each kind, the manifest and `--adopt`, what to commit.
- [drawing.md](drawing.md): runs against grids, `outline = "auto"`, variants, the show/preview flags, movement, the gear sprite's rules.
- `docs/reference/sprites.md`: the canvases and scales of each kind, the build's two targets, the animation frames, the hero's layer regions and the battle effects' conventions. Read it before drawing a unit, gear or an effect.
- `docs/designs/sprite-drawing-guidance.md`: how to draw well.

Adding the sprite for new content (foe, portrait, location, facility, gear, item icon) is one line of that content's checklist: `.Codex/skills/yomi-add-content/`.
