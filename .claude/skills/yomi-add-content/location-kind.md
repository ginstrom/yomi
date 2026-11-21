# Adding a world map location kind

Touch every line, then run `npm test`.

- `src/scenes/WorldScene.ts` → `LOCATION_SPRITES`: an atlas sprite `map_<kind>` with `idle`. How to draw it: `.claude/skills/yomi-sprites/`.

## Tests that catch a miss

- `tsc` (`LOCATION_SPRITES` is a full `Record` of `LocationKind`).
- The sprite's `idle` frame is not enforced; check by hand.
