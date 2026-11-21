# In-browser tests: reference

The detail behind `e2e/CLAUDE.md`.

## Sound hooks

`window.__yomi.audioLog()` lists the last 50 sounds the player (`src/scenes/soundPlayer.ts`) played, oldest first, each `{ cue, marker, bus, at }`: assert on the cues a click or a battle event logs, not on what is heard. `__yomi.playCue(cue)` plays a cue through the player on the topmost running scene, and `__yomi.limiter()` gives the output limiter's settings and its gain reduction now (null without Web Audio). Headless Chromium starts Web Audio only after a first gesture, so click something before asserting on the limiter. `__yomi.musicVolume()` gives the playing theme's volume now (null with none), which a duck moves 10 dB. The Story probe's `voice` is `{ line, playing }`: the line the showing beat speaks (null when unvoiced) and whether one is sounding. To make a voice file fail, route it before the cutscene loads (`page.route('**/assets/voice/**', (r) => r.fulfill({ status: 404 }))`) and then drop the 404s from `game.problems`, as `story.test.ts` does.
