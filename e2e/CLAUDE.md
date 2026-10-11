# In-browser tests

`npm run test:browser` runs these in headless Chromium with Playwright, under vitest (`vitest.browser.config.ts`). `globalSetup.ts` starts a Vite dev server for the run, on a port of its own, so a dev server already up is left alone. If Chromium is missing, `npx playwright install chromium` fetches it. `make test-browser` runs them in the podman container instead, whose image has Chromium built in (`Containerfile`).

## How a test drives the game

The page is one canvas, so there is nothing to select. A test reads a scene's probe (`src/testHook.ts`) for where things are on screen, and clicks there. All of that goes through `Game` in `driver.ts`:

- `useGames()` at the top of a `describe` launches the browser and returns `open()`. After each test it fails the test if the page logged a console error, threw, or had a request fail, which is how a missing asset or a broken layout shows up. Do not catch or filter those to make a test pass.
- `waitFor(scene, predicate)` polls a scene's probe until the predicate holds, and `waitForScenes(running, paused)` waits for a hand-over. Wait on state, never on time: there are no sleeps here.
- `click` and `press` wait two frames after the input, so its effect is visible to the next probe.
- Hexes are placed with `battleHexOnScreen` and `worldHexOnScreen`, from the probe's origin and scale; buttons and the party's portraits (`party` in the world's, the battle's and the panel's probes) carry their own position. Never hard-code a pixel coordinate.
- `newGame`, `travelTo`, `enterBattle`, `fightBattle` and `loseBattle` are the journeys most tests start with.

Games open with `?seed=` (`WINNING_SEED` unless told otherwise), so dice and enemy choices repeat from run to run, and at ten times life speed (`SPEED`), which the hook applies to every scene's timers and tweens. If a change to the rules makes `fightBattle` lose with that seed, pick another seed that wins; the test is about the hand-over after a victory, not about balance.

## What belongs here

A test here is for what only the running game shows: scenes handing over, overlays pausing and resuming what is under them, input reaching the engine, assets loading, layout after a resize. A rule of play is tested in the domain layer, where it runs in milliseconds.

When a test needs to see or click something no probe gives, add it to that scene's `probe()` and its type in `src/testHook.ts`, as plain JSON data. Do not reach into a scene's private fields from `page.evaluate`.
