# Adding a party banner

Touch every line, then run `npm test`.

- `src/scenes/partyList.ts` → `BANNER_SPRITES`: a number and its atlas sprite (`map_banner`, `map_banner_azure`, …). How to draw it: `art/CLAUDE.md`.

## Tests that catch a miss

- `src/scenes/partyList.test.ts` hard-codes the three banners that exist, so a new one is not enforced; check by hand.
- The sprite's existence in the atlas: not enforced; check by hand.
