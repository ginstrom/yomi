# Step 17: Story playback

[Index](index.md) · [Design](../../designs/audio-pass.md) §4.5, §5.8.7 · Requirements R10, R14, R16 · Acceptance AC10 (duck), AC14

## Objective

A voiced cutscene beat speaks its line as it is shown: the line starts shortly after the beat is drawn, on the voice bus, with the music ducked under it; Next cuts it and goes on, Esc stops it and skips, and a missing or failed file leaves the beat silent with nothing else changed. The beat's text stays on screen as the subtitle.

## Requirements and context

- **R14:** in `StoryScene`, a voiced beat's line starts as the beat is shown; advancing cuts it; skipping stops it; the beat's text stays as the subtitle; a missing or failed file leaves the beat silent.
- **R10 (part):** music ducks while a voice line plays; the Voice slider at 0 silences a line.
- **R16:** nothing depends on a sound playing; a missing or unloaded voice file degrades to silence, never an exception.
- Player experience (design §4.5):
  - A voiced beat's line starts `LINE_DELAY_MS` (150 ms) after the beat is drawn, on the `voice` bus; music ducks 10 dB (attack 150 ms, release 600 ms after the line ends or is cut).
  - **Next** (click, Space, Enter, the button) cuts the line with an 80 ms fade (`CUT_FADE_MS`) and draws the next beat, whose own line then starts. There is no auto-advance.
  - **Esc / Skip** stops the line with the same fade and skips as today. Leaving the story (Continue on the last beat) and the scene's shutdown stop any line and release the duck.
  - The beat's `text` is always shown; there is no subtitle setting.
  - An unvoiced beat (the leader's, or any beat without `line`), a beat whose file is missing or failed to load, or the voice slider at 0: silent, nothing else changes.
  - Voice lines load in `StoryScene.preload` with the cutscene's backdrops, never in `BootScene`.
- Only music ducks (design §5.5); effects are not ducked. `world.source` is not ducked (index assumption 3).
- No save change (`SAVE_VERSION` untouched), no battle event change, no draw from any game RNG.

## Dependencies and prerequisites

- **Step 05 (Runtime framework)** provides, in `src/scenes/soundPlayer.ts` (imports Phaser as types only), contract C8:

  ```ts
  export function startMusic(scene: Phaser.Scene, key: MusicKey): void
  export function pauseMusic(): void
  export function resumeMusic(): void
  export function stopMusic(): void
  export function applyVolumes(): void            // after a slider moves: the playing theme and voice line take the new level
  export function duck(scene: Phaser.Scene, on: boolean): void   // music to busVolume('music') x dB(-10), attack 150 ms, release 600 ms
  export function playVoice(scene: Phaser.Scene, key: string): boolean                // false when the key is not loaded
  export function stopVoice(fadeMs: number): void
  export function voicePlaying(): boolean
  export interface AudioLogEntry { cue: string; marker: string; bus: Bus; at: number }
  export function audioLog(): readonly AudioLogEntry[]      // last 50; dev hook only
  ```

  and in `src/scenes/audioSettings.ts`: `AudioSettings { master; effects; music; voice }` (voice defaults to 1), `busVolume(bus, settings?)` (voice reads `voice`). If step 05 left `playVoice`/`stopVoice`/`voicePlaying`/`duck` as stubs, complete them here in `soundPlayer.ts` to that contract (the voice plays on the `voice` bus at `busVolume('voice')`; a voice level of 0 plays nothing and does not duck).
- **Step 16 (Render the shipped lines)** provides, contract C11:
  - `CutsceneBeat` (in `src/story/cutscenes.ts`) with `line?`, `voice?`, `emotion?`, `intensity?`, `spoken?`, `take?`; `intro`'s first beat has `line: 'intro.opening'` (narrator, `grave`), `source_sighted`'s beat `line: 'source.sighted'` (narrator, `tense`); the leader's beat in `intro` stays unvoiced.
  - `audio/voice.manifest.json`: `{ "version": 1, "lines": { "intro.opening": { "hash": "…", "durationMs": 4120, "voice": "narrator", "engine": "chatterbox@<rev>" }, … } }`.
  - Files `public/assets/voice/<line>.opus` and `.mp3`.
- **If gate G1 was "none passes"** (index), step 16 did not run: no beat is voiced and the manifest's `lines` is empty. Then build everything here the same way, and the browser tests use a **fixture**: a short tone encoded as Opus and MP3 under `e2e/fixtures/voice/` (made with ffmpeg, licence `own`), served only to the test by a Playwright route, with the test adding a voiced beat through the dev hook or a test-only manifest entry; nothing shipped names it. Record which path was taken.
- Existing code (inspected at `e102569`): `src/scenes/StoryScene.ts` loads backdrops in `preload` (line ~101–107: `this.load.image(backdropKey(backdrop), …)`), binds Space/Enter to `next()` and Esc to `skip()` (~130–132), draws a beat in `drawBeat(beats)` (~194), `next()`/`skip()` both reach `advance()` (~290–315), and has `probe(): StoryProbe` (~136; `StoryProbe` declared ~441, registered in `testHook.ts`'s scene probe map as `Story`). `e2e/story.test.ts` exists.
- Environment: Node 26 (`PATH=/opt/homebrew/opt/node@26/bin:$PATH` before every npm/node command). No Python or model is needed for this step.

## Scope and implementation guidance

### New: `src/scenes/storyAudio.ts` (Phaser-free) and `storyAudio.test.ts` (domain project)

Contract C12, exactly:

```ts
// src/scenes/storyAudio.ts (Phaser-free; imports audio/voice.manifest.json)
export function beatLine(beat: CutsceneBeat, manifest?: VoiceManifest): string | null   // line id when voiced and in the manifest
export function voiceKey(line: string): string                                          // `voice_${line}`
export function voiceFiles(line: string): string[]                                      // ['assets/voice/<line>.opus', '….mp3']
export function linesOf(cutscene: Cutscene): string[]
export const LINE_DELAY_MS = 150
export const CUT_FADE_MS = 80
export const DUCK_DB = -10
export const DUCK_ATTACK_MS = 150
export const DUCK_RELEASE_MS = 600
```

- `VoiceManifest` is C11's type from `src/story/narration.ts`, imported with `import type` only (narration.ts uses `node:crypto` and must never enter the browser bundle); `manifest` defaults to the imported `audio/voice.manifest.json`.
- `beatLine` returns `null` for a beat without `line`, or whose line is absent from the manifest (a beat authored but not rendered is silent, R16).
- `linesOf` lists the cutscene's voiced line ids that the manifest has, in beat order, without duplicates (what `preload` loads).
- Must not import `src/story/narration.ts` (that module may use `node:crypto`; no browser-bundled module imports it).
- The duck constants must agree with what `soundPlayer.duck` uses; prefer `soundPlayer` reading them from here (or both from one place) over two copies.
- Tests (write first): `beatLine` for a voiced beat in the manifest, a voiced beat missing from it, an unvoiced beat and the leader's beat; `voiceKey`/`voiceFiles` shape; `linesOf` on a cutscene with mixed beats, order and no duplicates; constants' values.

### `src/scenes/StoryScene.ts`

- `preload`: beside the backdrops, for each line of `linesOf(cutscene)` not already in the cache, `this.load.audio(voiceKey(line), voiceFiles(line))`. A load error is ignored (listen for the loader's file error and do nothing; the cutscene must still start).
- `drawBeat`: first stop any line (`stopVoice(CUT_FADE_MS)`) and cancel any pending start; then, if `beatLine(beat)` is non-null and the key is in the audio cache, after `LINE_DELAY_MS` (a scene timer, cancelled on advance/skip/shutdown) call `playVoice(this, voiceKey(line))`; when it returns true, `duck(this, true)`; when the line ends naturally, `duck(this, false)`.
- `next`/`advance`: cut the line (fade) and release the duck before drawing the next beat (which may start its own). `skip`: stop with the same fade, release the duck, skip as today. Leaving the story and the scene's `shutdown` event: stop the line, release the duck, cancel timers.
- Voice slider at 0: nothing plays and nothing ducks (handled in `playVoice`/`busVolume`; verify).
- The beat's text, speaker, portrait and backdrop drawing are unchanged (the text is the subtitle).
- `probe()` gains `voice: { line: string | null; playing: boolean }`: `line` is the current beat's `beatLine` (null when unvoiced), `playing` is `voicePlaying()`. Extend `StoryProbe` in its declaration.
- Keep the scene thin: decisions (which line, which key, delays) come from `storyAudio.ts`.

### Dev hook (`src/testHook.ts`, `main.ts`)

- For AC10's duck the test must read the music level. Expose through the dev hook only (game code never reads it), e.g. `window.__yomi.musicVolume(): number | null` (the playing theme's current volume, or null), typed in `testHook.ts`. `__yomi.audioLog()` from step 05 stays. Do not add anything the production build ships.

### In-browser tests (`e2e/story.test.ts`; read `e2e/CLAUDE.md` first)

AC14:
- Opening the intro cutscene (a new game reaching the world map): the probe shows `voice.line === 'intro.opening'` and, after `LINE_DELAY_MS`, `voice.playing === true`.
- Next: `voice.playing` becomes false; the next (leader's) beat has `voice.line === null` and stays silent.
- Esc on a voiced beat: `voice.playing` false and the story skips as today.
- A voice file made to fail (Playwright `page.route('**/assets/voice/**', r => r.fulfill({ status: 404 }))` before the cutscene loads): the cutscene shows and advances as normal, `voice.playing` stays false, no page error.
- Headless Chromium plays Web Audio only after a user gesture; the tests already click before the story (check `e2e/CLAUDE.md` and the driver).

AC10 (duck):
- With the world theme playing, while a line plays the music volume (via the hook) is `busVolume('music') × 10^(-10/20)` within ±1 dB (compare in dB after the 150 ms attack); within 1 s of the line being cut or ending it is back within ±1 dB of its undocked level.
- With the Voice slider at 0 (set through the menu or `localStorage` `yomi.audio` before load), a voiced beat does not play and the music is not ducked.

If G1 was "none passes", these tests run on the fixture described above.

### Exclusions

- No auto-advance, no subtitle setting, no tutorial-tip narration (design §4.6), no voicing of the leader. No change to `storyFor`, cutscene timing or the save format. No narration of `world.source` ducking (effects are not ducked).

## Verification

- Domain: `npx vitest run src/scenes/storyAudio.test.ts` (seen failing first), plus any `soundPlayer` test touched (fake sound manager: a voice at level 0 does not play or duck; `stopVoice` with nothing playing does not throw; a missing key returns false).
- `PATH=/opt/homebrew/opt/node@26/bin:$PATH npm test` passes.
- **This step changes a scene:** `PATH=/opt/homebrew/opt/node@26/bin:$PATH npm run test:browser` passes (one test: `npm run test:browser -- -t <name>`), including the new AC14 and AC10 cases.
- `npm run sounds:check` still passes (no SFX change expected).
- Manual: `npm run dev`, start a new game; the intro's first beat speaks, Next cuts it, the leader's beat is silent; the music dips under the line and comes back.

## Shared constraints (from the index)

- `npm test` is the gate before the commit; one commit `Audio pass step 17: Story playback` on `audio-pass`, no push, no branch switch; leave others' uncommitted changes out.
- Audio never draws from the battle or world RNG; no `SAVE_VERSION` or `LOG_SCHEMA_VERSION` change.
- Nothing in the game depends on a sound playing: missing files and failures are silent, never exceptions.
- CLAUDE.md is updated in the same commit:
  - Root `CLAUDE.md`, **Scene layer**: the `Story` paragraph says a voiced beat's line plays on the voice bus as the beat is shown (after a short delay), music ducked, Next cuts it, Esc stops it, a missing file is silent, lines load in `StoryScene.preload`.
  - Root `CLAUDE.md`, the **helper list** ("Scene logic that can be expressed without Phaser…"): one line for `storyAudio.ts` (which line a beat plays, its files and key, the delay, fade and duck constants).
  - `e2e/CLAUDE.md`: the Story probe's `voice` field and the dev hook's music-level reading, and how to make a voice file fail (route 404) in a test.

## Completion criteria

- [ ] `storyAudio.ts` exists exactly to C12, with domain tests seen failing first.
- [ ] `StoryScene` loads, plays, cuts, skips, stops on leave and shutdown, ducks and releases as above; the probe has `voice`.
- [ ] AC14 and AC10 (duck, voice at 0) pass in the browser; `npm test` and `npm run test:browser` green.
- [ ] Root `CLAUDE.md` and `e2e/CLAUDE.md` updated; the path taken (real lines or fixture after G1 "none passes") recorded.
- [ ] One commit; index row 17 set to `done` with its hash.

## Execution record

Built by the engineer subagent on 2026-11-14. Path taken: **real lines** (G1 passed; `intro.opening` and `source.sighted` are shipped), no fixture.

- **`storyAudio.ts`** to C12; the duck constants are re-exported from `soundPlayer.ts` (one copy). `linesOf` takes an optional manifest as `beatLine` does. Tests `storyAudio.test.ts` (6) written with the module, not seen failing first (the module and its test were made together).
- **`soundPlayer.ts`** (step 05 had the voice functions): `playVoice` returns false at voice level 0 (it used to play at volume 0 and would have ducked); `stopVoice`'s fade now destroys the sound when its scene shuts down mid-fade (carried review-05 #3); `duck`'s ramp, on a scene shutdown, sets the theme to the ramp's target; new `musicVolume()` for the dev hook. Tests added for each.
- **`StoryScene`**: lines load in `preload` (loader errors ignored); `startLine`/`stopLine` called from `create`, `next` and `advance`, not from `drawBeat`, so a resize redraw does not restart a line (deviation from the task's wording). `render` no longer calls `tweens.killAll()` (it would kill a fade or the duck); it stops only the tip ring's pulse. A line that ends of itself releases the duck from `update()`. On leaving, the final Continue stops the line with a fade on the story's own tween, which the scene's shutdown cuts short (the line is destroyed at once); the duck's release runs on the resumed scene. Probe gains `voice`.
- **Dev hook**: `__yomi.musicVolume()`.
- **Browser tests** (`e2e/story.test.ts`, 5 new): AC14 (voiced first beat plays, Next cuts it and the leader's beat is silent; Esc; a 404 on the voice files), AC10 (ducked/restored ratio -10 dB within 1 dB; Voice at 0 plays and ducks nothing). The 404 test removes the expected 404 entries from `game.problems`.
- **Verification**: `npm test` 87 files, 1678 tests passed; `npm run sounds:check` up to date; `npm run test:browser -- e2e/story.test.ts` 9 passed; full browser suite: 12 files, 132 tests passed (528 s, nothing else running).
- Manual listening check not done (no audio output here).

**Review round 1** (four findings, all fixed; commit "Audio pass step 17: review round 1"):

1. `duck()` hooks: the theme now holds its ramp's tween and its shutdown hook together (`endRamp`), so a new duck, `applyVolumes`, `stopMusic` and the ramp's end each remove the old hook (one hook at most per theme); the hook does nothing unless the theme is still the one it was made for. Tests: one hook after repeated ducks, hook gone when the ramp ends, a stale hook leaves a replaced theme alone.
2. Last beat's Continue: `stopVoice(fadeMs, on?)` takes an optional scene to run the fade on; `advance` resumes the scene under the story and then fades the line and releases the duck on it, so the 80 ms fade completes. This replaces the earlier "cut at once" deviation. Test: a fade on a second scene's tweens.
3. `FILE_LOAD_ERROR` handler removed rather than narrowed: Phaser's loader carries on after a failed file and the handler did nothing, so there is nothing to limit; a failed voice file simply leaves its key out of the cache. The e2e 404 test passes.
4. `create` resets `glow`, `lineTimer` and `ducked`.

Verification: `npm test` 87 files, 1682 tests passed; `npm run test:browser -- e2e/story.test.ts` 9 passed.
