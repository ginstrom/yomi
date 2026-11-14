# Step 18: Final review and docs

[Index](index.md) · [Design](../../designs/audio-pass.md) §7 (verification), §7.2 (listening review) · Feature record: [`docs/features/audio-pass.md`](../../features/audio-pass.md)

## Objective

Prove the feature complete: every completion check passes on a clean tree, every acceptance criterion (AC1 to AC16) has evidence collected here, the placeholder sources are gone, the docs (READMEs, CLAUDE.md files, the manual) are true, and the user has done the final in-game listening review (gate **G11**).

## Requirements and context

- The design's acceptance criteria, restated (design §7.1):
  - **AC1** `grep` finds no `sound.play(` or `sfx_` key in `src/`; every play goes through `playCue` or the music/voice functions of `soundPlayer`. (R1)
  - **AC2** `eventSounds` unit tests cover each weapon class's release, hit and miss; metal sweetener on a breastplate wearer and not on a goblin; crit; up to two element sweeteners; image; each spell family and override; both area abilities; each tick element; regen; each death class plus the hero toll; one step per hex at the stated times; stings. (R2, R5)
  - **AC3** Every main-hand family icon in `FAMILIES` has a `WEAPON_SOUNDS` entry; every `FoeKind` a `FOE_SOUNDS`, `DEATH` and step entry; every spell id resolves through `spellSound` to existing cues. (R2)
  - **AC4** `worldSounds` plays at most two cues, in priority, 250 ms apart, nothing for `level_changed`, `spawned`, `order_done`. (R3)
  - **AC5** In the browser (audio log): an attack, a cast, a move, a fall and a battle end log the expected cues; a walk onto monsters logs `world.confront`; a buy `world.coins`; a refused buy `ui.error`; taking a node `ui.learn`. (R2 to R5)
  - **AC6** `pickVariant` never repeats the last marker (10 000 plays, 2- and 6-variant cues); shares within ±1 of n/v; jitter within range; the battle engine's RNG state and a replayed battle's event log are identical with sounds on. (R6)
  - **AC7** `maxVoices`/`minGapMs` drop excess plays; 20 `battle.hit.slash` in 1 s never clip (limiter installed). (R7)
  - **AC8** `sounds:check` passes clean; an edited, unbuilt recipe fails naming its cue; a `CC-BY-4.0` licence or a wrong SHA-256 fails the build; a recipe rendered twice gives identical PCM. (R8)
  - **AC9** Every variant within its group's loudness tolerance and under its peak ceiling; no two variants of a cue correlate above 0.95; shipped SFX at most 3 MB per format; `audio/sources` + `audio/voices` at most 15 MB; voice at most 4 MB per format. (R8, R9)
  - **AC10** Four sliders; `parseAudioSettings('{"master":0.5,"effects":1,"music":1}')` gives `voice: 1`; voice at 0 silences a line; music drops 10 dB (±1) under a line and returns within 1 s. (R10)
  - **AC11** Vitest refuses a duplicate line id, `line` without `voice`, a voiced `{leader}` beat, `{encampment}` in spoken text, an unknown tag, a tag for a non-tag engine, an emotion the voice lacks. (R11)
  - **AC12** Every voiced beat's `lineHash` equals the manifest's and its files exist; changing spoken text without rendering fails; `voice render` then renders exactly one line. (R12)
  - **AC13** The 32 bake-off clips and score sheet existed; the user's choice is in the feature record before any line was committed; each committed clip has a provenance entry naming VoiceDesign, its revision, description and seed; emotion clips' speaker similarity to neutral at least 0.75. (R13)
  - **AC14** Browser: the intro plays `intro.opening` (probe `voice.playing`), Next stops it, the leader's beat is silent, Esc stops it, a deleted voice file leaves the cutscene working and silent. (R14, R16)
  - **AC15** READMEs list every bank's sources by collection and author, the themes' measured loudness, the TTS models, revisions, licences and watermark; `audio/CLAUDE.md` exists; the root `CLAUDE.md` points to it and describes `sounds.ts`, `soundPlayer.ts`, `storyAudio.ts`, `narration.ts`, the npm scripts and the voice bus. (R15)
  - **AC16** Removing a bank's JSON or a marker at runtime (player over a fake sound manager) throws nothing. (R16)
- The listening criteria of design §7.2: nothing harsh or piercing; nothing much louder or quieter than its neighbours; no audible repetition in a run of footsteps or repeated attacks; impacts in time with the visuals (within one frame of `impactMs`); music audible but under the effects.
- If gate G1 was "none passes" (index, User gates), there are no voiced beats: AC12 and AC14 are then checked as the index describes (framework only, step 17's fixture test), and AC13 covers only the bake-off; say so in the record.

## Shared constraints (from the index)

- Node 26: prefix every npm or node command with `PATH=/opt/homebrew/opt/node@26/bin:$PATH`.
- `npm test` is the gate before every commit; `npm run test:browser` is run in this step regardless of whether a fix touches a scene. Host-only audio tooling (`npm run sounds`, `npm run sounds:check`, `npm run narration`, `uv run --project tools/audio pytest tools/audio/tests`) never runs in `npm test` or the podman image.
- Audio never draws from the battle's or the world's seeded RNG; no `LOG_SCHEMA_VERSION` or `SAVE_VERSION` change.
- Licence allow-list `["CC0-1.0", "own"]`; no non-redistributable source; model weights stay in the Hugging Face cache, never in the repository.
- Commits on `audio-pass`, no push, messages `Audio pass step 18: <title>`; fixes found by this review or by G11 are follow-up commits of this step. CLAUDE.md is updated in the same commit as the change that makes it wrong.

## Dependencies and prerequisites

- Every step 01 to 17 `done` (or, for 15 and 16, skipped by a "none passes" G1), with its gate recorded in the index.
- Existing artifacts this step reads, produced earlier: `tools/audio/` (C2), `audio/audio.toml` (C3), `audio/sources.toml` (C4), the recipes (C5), `audio/sfx.manifest.json` and the banks (C6), the 85 W1 cues (C7), `src/scenes/sounds.ts`, `soundPlayer.ts`, `audioSettings.ts` (C8), `src/story/narration.ts`, `audio/voices.toml`, `audio/voice.manifest.json`, `public/assets/voice/` (C11), `src/scenes/storyAudio.ts` (C12), the steps' execution records.
- Contracts relied on, unchanged from the index: C6's `sfx check` failure conditions and C3's budgets; C8's removed names (`soundVolume`, `SOUND_KEYS`, `SoundKey`, `soundFiles`, `SOUND_VOLUME`, `MUSIC_VOLUME`) and `window.__yomi.audioLog()`; C4's allow-list.

## Scope and implementation guidance

1. **Clean-tree run.** From a clean `git status`, run and record the output of:
   - `PATH=/opt/homebrew/opt/node@26/bin:$PATH npm test`
   - `PATH=/opt/homebrew/opt/node@26/bin:$PATH npm run test:browser`
   - `PATH=/opt/homebrew/opt/node@26/bin:$PATH npm run build`
   - `PATH=/opt/homebrew/opt/node@26/bin:$PATH npm run sounds:check`
   - `uv run --project tools/audio pytest tools/audio/tests`
2. **Acceptance evidence.** For each of AC1 to AC16, cite the step and test (file and test name) or measurement that proves it, from the steps' execution records. Re-run anything missing or not recorded, at least:
   - AC1: `grep -rn "sound\.play(\|sound\.add(\|sfx_" src/` (expect no game-code hits; tests and comments are reported if any).
   - AC9: the budgets as `sfx check` reports them (bytes per format, sources plus voices bytes, voice bytes per format) and the per-variant loudness and peak summary.
   - AC13: for each file under `audio/voices/`, its `sources.toml` entry has licence `own`, `design.model`, `design.revision`, `description_ref` and `seed`; the feature record's G1 entry predates the commit that first added a file under `public/assets/voice/` (`git log` dates).
   - AC15: the doc checks of item 4.
3. **Placeholders out.** Confirm no recipe under `audio/sfx/` names a placeholder source (the eight `sfx_*` and two stings' `own` entries step 02 added; `grep` the recipes for their ids). Then remove those FLACs and their `sources.toml` entries, rebuild if any input hash moves (`npm run sounds`), and confirm `sounds:check` passes. If any stays (for instance a placeholder deliberately kept as a synthesis layer), document which and why in `audio/CLAUDE.md` and the record. Confirm `public/assets/audio/` holds no `sfx_*.wav`, `music_victory.wav` or `music_defeat.wav`.
4. **Docs audit.**
   - `grep -rn "soundVolume\|SOUND_KEYS\|SoundKey\|soundFiles\|SOUND_VOLUME\|MUSIC_VOLUME\|sfx_\|music_victory\|music_defeat" CLAUDE.md audio/CLAUDE.md e2e/CLAUDE.md docs/manual public/assets src e2e scripts` and fix every stale line (design and plan documents under `docs/` are history and are left alone).
   - Root `CLAUDE.md`: the Commands table has `sounds`, `sounds:check`, `narration` (and `narration:export`); "Assets and docs" points to `audio/CLAUDE.md` in one line and says what `BootScene` loads (the four banks and two themes, no per-sound files); the scene helper list describes `sounds.ts`, `soundPlayer.ts`, `storyAudio.ts`, `audioSettings.ts` (the voice bus); the domain `src/story/` line describes `narration.ts` and a beat's voice fields; `Story`'s paragraph says a voiced beat plays its line. Apply the file's own "Keeping this file current" rules: one line per module, nothing a grep answers.
   - `audio/CLAUDE.md`: the workflow (sources, recipes, build, check, audition, review, narration, bake-off, voice design, render), the download locations, the licence rules.
   - `e2e/CLAUDE.md`: how a test reads `__yomi.audioLog()` and the story's `voice` probe.
   - `public/assets/audio/README.md`: every bank's sources by collection and author, the themes' measured LUFS-I and `MUSIC_BASE`, no mention of the deleted WAVs as current. `public/assets/voice/README.md`: the engine and model, pinned revisions, licences (rechecked), Chatterbox's watermark, the designed voice and its description.
   - The manual (`docs/manual/README.md`): the Options line names Master, Sound FX, Music and Voice. If a manual screenshot shows the Options view, retake the screenshots with `PATH=/opt/homebrew/opt/node@26/bin:$PATH npm run manual:screenshots` and commit the changed images.
5. **Gate G11 preparation.** Write the user's instructions into the record (and report them): start the dev server (`PATH=/opt/homebrew/opt/node@26/bin:$PATH npm run dev`, http://localhost:5173), begin a new game with the ready-made party, leave every slider at its default; play one short battle (attack a nearby threat-1 location, or the debug console `~` then `fight goblin_raid 1`) through to victory, using melee, a bow shot, a spell and a move; then a world-map session: walk until monsters are sighted, confront them, return home, enter the encampment, buy and sell at the trading post, try a refused buy, craft, embed a rune, take a skill-tree node; watch the intro and, if reached, the Source cutscene with narration. Judge by the five criteria of design §7.2 and reply "pass" or the cues to fix (cue ids from `__yomi.audioLog()` or a description of the moment).
6. **Fixes.** Each finding from items 1 to 4 or from G11 is fixed test-first where testable, as a follow-up commit of this step; a sound fix is a recipe change and `npm run sounds`; rerun the affected checks.
- **Exclusions:** no new cues, no W2 work, no new features; the feature record is updated by the orchestrator, not by this step.

## Verification

- The five commands of item 1 pass on a clean tree, output recorded.
- AC1 grep empty for game code; AC9 budgets under their limits with figures recorded; AC13 every clip's provenance complete.
- No placeholder source referenced or present (or each exception documented); `sounds:check` green after the removal.
- The removed-names grep over the docs and code returns nothing stale.
- `npm run test:browser` passes after any fix (scenes or not).
- G11: the user's verdict relayed by the orchestrator is "pass", or every cue named has been fixed and re-reviewed.

## Completion criteria

- [ ] All completion checks of the index pass on a clean tree, output in the record.
- [ ] AC1 to AC16 each cited with evidence in the record (or explained for a "none passes" G1).
- [ ] Placeholder sources removed (or documented exceptions); `public/assets/audio/` holds no placeholder WAV.
- [ ] Root `CLAUDE.md`, `audio/CLAUDE.md`, `e2e/CLAUDE.md`, both audio READMEs and the manual current; screenshots retaken if the Options view is shown.
- [ ] G11 instructions given; verdict recorded here; fixes committed.
- [ ] Index status `awaiting review` while G11 is pending, then `done` with the commit hashes.

## Execution record


Run 2026-11-14 on branch `audio-pass`.

**Clean-tree checks** (after the placeholder removal): `npm test` 87 files, 1682 tests passed; `npm run test:browser` 12 files, 132 tests passed (one run, 225 s, nothing else running); `npm run build` ok (chunk-size warning only); `npm run sounds:check` "85 cues and 4 banks up to date, within budget"; `uv run --project tools/audio pytest tools/audio/tests` 246 passed.

**Placeholders.** No recipe named one. Removed all ten `placeholder_*` sources with `yomi-audio source remove` (file, entry and the `audio/sources/placeholder/` directory); no input hash moved, so no rebuild. `public/assets/audio/` holds only the two themes, `README.md` and `sfx/`. Updated `audio/CLAUDE.md`, root `CLAUDE.md` and `public/assets/audio/README.md` (also fixed its repeated Freesound id: "685680 (`source`; also `rune.fuse`)").

**Unused Freesound downloads** (of the 28 at G2): 171844, 846337 (auditioned for step 12), 693428, 411122 and 259542 were never used; nothing in the repository, they live only in the download cache.

**Docs audit.** The removed-names grep finds only `sounds.test.ts`'s own guard (which asserts their absence) and the `sfx_bytes_per_format` budget key. The Commands table, scene helper list, `src/story/` line and Story paragraph, `e2e/CLAUDE.md` (`audioLog()`, `voice` probe) and the manual (Options line names the four sliders; no screenshot shows Options) are current. The heteronym rule in `audio/CLAUDE.md` is accurate; no shipped `spoken` text contains a listed heteronym except as the narrator's bake-off text.

**Acceptance evidence.**
- AC1: `grep -rn "sound\.play(\|sound\.add(\|sfx_" src/` finds only `soundPlayer.ts` (theme and voice `sound.add`) and the guard test `sounds.test.ts`.
- AC2 to AC7, AC10 to AC12, AC14, AC16: the tests named in steps 05 to 07, 14, 16 and 17 (`sounds.test.ts`, `soundPlayer.test.ts`, `audioSettings.test.ts`, `narration.test.ts`, `storyAudio.test.ts`, `e2e/audio.test.ts`, `e2e/story.test.ts`), all in the green runs above.
- AC8, AC9: `sfx check` clean; sizes: SFX opus 1,774,232 bytes in total (battle 1,187,332, world 405,708, stings 96,343, ui 84,849; limit 3 MB), mp3 1,583,600 (limit 3 MB); `audio/sources` 13,214,350 + `audio/voices` 927,070 = 14,141,420 (limit 15 MB, 0.86 MB spare after the removal); voice opus 21,470, mp3 37,480 (limit 4 MB). Loudness, peak and correlation are checked by `sfx check`.
- AC13: the bake-off clips and score sheet existed; G1 (feature record) predates the first file under `public/assets/voice/` (step 16, 2026-11-14, later commit). The one reference clip, `voice_narrator_neutral`, has licence `own`, `design.model` (Qwen3-TTS VoiceDesign), `design.revision`, `description_ref = "voices.toml#narrator"` and `seed = 7`. Per G1 there are no emotion clips, so the 0.75 similarity check does not apply.
- AC15: both READMEs and the CLAUDE.md files audited above.

**Not done here.** Fireball cannot reach its brief's about -18 LUFS-M, because the tool normalises to the group's target; `gainDb` is unchanged; an open question for after the playtest. G4 to G8 are non-blocking and come back from the user's playtest; G10 (`audio/.audition/16-render/`) awaits the user's listening.

### G11 listening package (the user's)
1. `PATH=/opt/homebrew/opt/node@26/bin:$PATH npm run dev`, open http://localhost:5173, begin a new game with the ready-made party, every slider at its default.
2. One short battle (a nearby threat-1 location, or `~` then `fight goblin_raid 1`) to victory: a melee blow, a bow shot, a spell, a move.
3. World map: walk until monsters are sighted, confront them, return home, enter the encampment, buy and sell at the trading post, try a refused buy, craft, embed a rune, take a skill-tree node; watch the intro and, if reached, the Source cutscene with narration.
4. Judge by design 7.2: nothing harsh or piercing; nothing much louder or quieter than its neighbours; no audible repetition in footsteps or repeated attacks; impacts in time with the visuals; music audible but under the effects. Reply "pass" or the cues to fix (ids from `__yomi.audioLog()` or the moment).
5. Fold in the pending listening: G10 (`audio/.audition/16-render/`), G4 to G8 from the playtest, and whether Fireball (`battle.impact.fireball`) is quiet.

Verdict: pending. Step `awaiting review`.

**G11 passed 2026-11-14** (user: "plays fine"). The same playtest closes G4 to G8 (the batch reviews of steps 09 to 13), and the fireball (`battle.impact.fireball`) is accepted as it is: `gainDb` unchanged.
