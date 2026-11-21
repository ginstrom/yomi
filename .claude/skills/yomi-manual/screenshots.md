# Retaking the manual's screenshots

`manual.shots.ts` is not a test: it plays the game to each screen the player's manual (`docs/manual/`) shows and saves a screenshot. Retake them with `npm run manual:screenshots`, which runs under its own config, `vitest.manual.config.ts`. That config plays `e2e/manual.shots.ts`, so neither test run picks the file up. The screenshots are taken from the running game; run it again after changing how a screen looks, then check the manual still reads true.

## Adding a shot

Add a shot with `shot(game, name)` in a new or an existing `it` of `e2e/manual.shots.ts`. The helper waits 4 frames, then writes `docs/manual/images/<name>.png`. Then embed it in `docs/manual/README.md` as `![alt text](images/<name>.png)`.

## Checking

- Look at every changed PNG: a screen that moved, a missing asset or a layout break shows there.
- Commit the images together with the text.
