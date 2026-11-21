# Adding a portrait preset

Touch every line, then run `npm test`.

- `src/character/portraits.ts` → `PORTRAIT_IDS`: an id.
- `art/portraits/portrait_<id>.sprite.toml` → the sprite, built to `portrait_<id>.png`; `portraitKey` (`src/scenes/partyPanel.ts`) names it. How to draw it: `art/CLAUDE.md`.

## Tests that catch a miss

- `src/scenes/partyPanel.test.ts` (one distinct key per id).
- The sprite's existence: not enforced; check by hand.
