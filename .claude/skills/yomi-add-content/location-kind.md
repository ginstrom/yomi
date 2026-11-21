# Adding a world map location kind

Touch every line, then run `npm test`.

- `src/scenes/WorldScene.ts` → `LOCATION_SPRITES`: an atlas sprite `map_<kind>` with `idle`. How to draw it: `.claude/skills/yomi-sprites/`.
- Every switch on a location's `kind` that reads "not monsters" as "a site": `territory.ts` `sites()`, `buildings.ts` `improvementSite`, `blight.ts` `sources()`, `hexInfo.ts`, `WorldScene` `refreshLabels` and `labelColor`, `save.ts`'s strict check (and `locationOf`, for fields holding items). Grep for `kind === 'monsters'` and `kind !== 'monsters'`.

## Tests that catch a miss

- `tsc` (`LOCATION_SPRITES` is a full `Record` of `LocationKind`).
- The sprite's `idle` frame is not enforced; check by hand.
- The other `kind` switches: `tsc` catches only those that pass the location on as a `QuietLocation` (`improvementName`, `siteYield`); the rest are not enforced; check by hand.
