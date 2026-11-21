# Sprite workflow

Commands are run from the repository root.

## Install

Sprites are made with [sprite-tool](https://github.com/ginstrom/sprite-tool) (`uv tool install git+https://github.com/ginstrom/sprite-tool@v0.7.0`; add `--force` to upgrade a copy already installed), which is installed on the host and is not in the podman image. The pin is `v0.7.0`. Run `sprite guide --project art` before drawing or changing a sprite: it prints the file format, the palette and the canvas classes.

## Starting a sprite

- Sources are text in `art/**/<id>.sprite.toml`; `art/sprite-tool.toml` holds the canvas classes and the export target.
- A unit: `sprite new <kind> --canvas unit --project art --dir units`, where the id is the `UnitKind` (and so the name the atlas shows it by).
- An icon started as runs: `sprite new icon_<id> --canvas icon --project art --dir icons --runs`.

## The manifest

The tool only overwrites files listed in the manifest, and every PNG in `public/assets/sprites/` is on it. A PNG put there by hand stops the build for a sprite with the same id; replacing one deliberately takes a one-off `sprite build --adopt --project art`, plus an update to the sprites `README.md` (`public/assets/sprites/README.md`).

## What to commit

Commit everything the build writes into `public/assets/sprites/`, `.sprite-tool-manifest.json` included, with the source; never edit an exported file by hand. `npm run sprites:check` fails when they are stale. Record provenance and licence of a new sprite in `public/assets/sprites/README.md`.
