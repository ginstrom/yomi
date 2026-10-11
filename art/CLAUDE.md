# Sprites (sprite-tool)

Guidance for working in `art/`, the text sources of every sprite in the game. The root `CLAUDE.md` covers the rest of the project. Commands here are run from the repository root.

Sprites are made with [sprite-tool](https://github.com/ginstrom/sprite-tool) (`uv tool install git+https://github.com/ginstrom/sprite-tool@v0.3.0`), which is installed on the host and is not in the podman image. Run `sprite guide --project art` before drawing or changing one: it prints the file format, the palette and the canvas classes.

- Sources are text grids in `art/**/<id>.sprite.toml`; `art/sprite-tool.toml` holds the canvas classes and the export target. Create one with `sprite new <kind> --canvas unit --project art --dir units`, where the id is the `UnitKind`.
- Loop: `sprite check --project art` until it prints `ok`, `sprite preview <id> --grid --project art` and look at the PNG it names, then `npm run sprites`.
- The build writes loose PNGs (`<id>.png`, the first frame) into `public/assets/sprites/`, which is what the scenes load, plus `sprites.json`, a per-sprite metadata index (size, anchor, bounds, display scale) that nothing loads yet. Commit the exported files, `sprites.json` and `.sprite-tool-manifest.json` with the source; never edit an exported PNG by hand.
- The tool only overwrites files listed in the manifest, and every PNG in `public/assets/sprites/` is now on it. A PNG put there by hand stops the build for a sprite with the same id; replacing one deliberately takes a one-off `sprite build --adopt --project art`, plus an update to the sprites `README.md`.
- All sprites share `palette.toml`, a muted Baldur's Gate-style palette. Units are drawn on the 32px `unit` canvas and shown at 3x, so creature size is drawn into the sprite; item icons use the 20px `icon` canvas at 2x, and the world map's points of interest (`map/map_<kind>.sprite.toml`, one per `LocationKind`) use the 24px `map` canvas at 2x. Portraits (`portraits/portrait_<id>.sprite.toml`, one per `PortraitId` in `src/character/portraits.ts`) use the 32px `portrait` canvas at 2x in the party's column and 4x on the character panel; it has no outline rule, as a portrait fills its canvas edge to edge: a head and shoulders facing the viewer, outlined in `k`, over a dark ground with a lighter disc behind the head.
- `art/units/warrior.sprite.toml.example` is the tool's sample sprite, renamed so it is not built. It is a format reference, not the game's warrior.

When a canvas class, a sprite directory or a step of this workflow changes, update this file in the same commit.
