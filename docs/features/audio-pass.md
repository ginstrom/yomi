# Feature: audio pass (SFX and narration)

**Request (user's words):** "separately from the ongoing skill tree work, I'd like you to improve the quality of the sound effects, to create indie game-quality SFX. If possible I'd also like a framework for narration of cutscenes and the like, maybe using a local version of a voice model, especially one that supports emotions and other effects."

- **Slug:** `audio-pass`
- **Phase:** 4, implementation. Resume point: step 15 awaits G9 (the user's listening to `audio/.audition/15-voice/neutral.wav`; recommendation "A_0 kept"); then 16, 17, 10–13, 18, verification. Done: 01–09, 14, 15 (`70a21c2`, pending G9). G2: the user asked the orchestrator to do the Freesound downloads via Claude in Chrome; waiting for the user to log into freesound.org in Chrome.
- **Branch / worktree:** `audio-pass`, from `main` at `d18abf4`, in `.claude/worktrees/audio-pass` (kept apart from `skill-trees`)
- **Architecture brief:** `docs/architecture/audio-pass.md` (`a82ae8f`)
- **Design:** `docs/designs/audio-pass.md` (`84f5f35`, approved by the user)
- **Plan:** `docs/implementation-plans/audio-pass/index.md` (`d842b3f`, 18 steps, gates G1–G11)

## Path

Large: new offline tooling (a sound build pipeline, a local TTS model), new asset sources and licences, new runtime hooks in the scenes and the story system. Architecture first, then design, plan, implement, verify.

## Decision log

| Decision | By | Alternatives | Reason |
| --- | --- | --- | --- |
| Work on its own branch from `main` in a worktree | orchestrator | on `skill-trees` | user asked for it separately from the skill-tree work |
| SFX from CC0 recorded samples, layered and processed by a build script from checked-in text recipes, synthesis where it fits | user | pure procedural synthesis; local generative model | closest to indie quality, reproducible, licence-clean |
| Scope: replace the placeholders and add variety (weapon families, spell elements, abilities, footsteps, UI, world-map events) with random variations | user | one-for-one replacement | |
| Narration pre-rendered offline by a local emotion-capable TTS model (MLX on the M5), audio committed; the game plays files | user | runtime TTS in the browser | |
| D1: one Python (uv) build tool in `tools/audio/` for SFX and narration | user | Node + ffmpeg filters | layering/synthesis and the voice models are Python |
| D2: CC0 sources only, committed as trimmed excerpts with provenance | user | local gitignored cache of Sonniss-style packs | repo is public; anyone can rebuild |
| D3: Chatterbox primary (voices from reference clips made by Qwen3-TTS voice design), Qwen3-TTS fallback, behind an adapter; a listening test first | user | Qwen3-TTS alone | emotion control, MIT/Apache licences, no real voice cloned |
| D4: the leader's lines stay unvoiced; narrator and fixed characters only | user | one generic voice; one voice per portrait | the leader is player-chosen |
| D5: keep the MP3 fallback beside Opus | orchestrator | Opus only | older Safari; matches the music |
| Design approved as written | user | changes first | |
| Sources: Kenney, OpenGameArt and synthesis first; any Freesound file the plan still needs is listed for the user to download by hand | user | API token; skip Freesound | Freesound downloads need a login |
| Tutorial tips unvoiced in v1 | user | voice them now | same mechanism can add them later |
| Stings from Kenney Music Jingles for now; narrator's gender chosen in the bake-off | orchestrator | | design defaults |
| Short cues (shorter than the 400 ms LUFS-M window, e.g. `ui.click`): normalisation gain is the lesser of the loudness-target gain and the gain that meets the group's true-peak ceiling, so the ceiling always holds; recipes may also lengthen or densify UI sounds | orchestrator | raise the `ui` ceiling; change the `ui` target | step 01 found `ui.click` as designed needs ~−0.3 dBTP to hit −26 LUFS-M; the ceiling is the safety rule, loudness the aim |
| Peak-limited cues have no loudness floor; content steps make UI and impact sounds denser instead of leaning on the cap. Banks start with 50 ms of silence before the first marker | orchestrator | a floor below target | step 02's recommendation; ceiling is the rule |
| G1: narration uses configuration (b), Chatterbox Turbo from narrator A's neutral clip `A_0`, with sound tags; the user liked c05, c07, c08 (b/A) and c02 (a/B), and did not fill the score sheet | user | (a) with narrator B; (b) with B | 3 of 4 favourites were b/A |
| Steps 15–16 adapt to G1: Turbo takes one reference clip and ignores exaggeration, so the narrator's voice is `A_0` alone and emotion comes from the line's wording and tags; per-emotion clip design (G9) is reduced to confirming `A_0`, unless the step finds emotion reference clips audibly help Turbo | orchestrator | design all seven emotion clips anyway | follows the user's pick; the plan was written before it |
| G3 passed: the user found all the melee audition audio acceptable and left the choice of versions to the orchestrator, with more feedback possible after playtesting | user | | |
| Batch gates G4–G8 no longer block: each content step still leaves an audition folder and review sheet, the orchestrator accepts on the measurements and review, and the user's playtest feedback comes back as follow-up fixes (G11 stays the final listening) | orchestrator | hold each batch for the user | follows the user's G3 answer |
| Order after 08: 09, then narration 14–17, then 10–13, giving the user time for the Freesound downloads (G2) | orchestrator | 09–13 first | 10–13 need G2 or its fallbacks |
| D6: add a `voice` volume slider; UI sounds stay under Sound FX with their own internal group | orchestrator | separate UI slider | brief's recommendation, splittable later |

## Open questions

(none)

## Tiers

- Architect: opus.
- Designer: opus.
- Planner: opus.
- Engineer and reviewer per step (reviewer matches): opus for 01, 02, 03, 05, 08–13, 15; sonnet for 04, 06, 07, 14, 16, 17, 18. Overall review opus.
- Run order: 01, 03, 04 (so gates G1 and G2 run on the user's time), then 02, 05, 06, 07, 08…; steps one at a time in this worktree.

## Verification

- 01: opus engineer, opus reviewer, clean in 1 round.
- 02: opus engineer, opus reviewer, clean in round 2 (round 1: incremental build skipped licence/SHA checks; fixed `87e09cb`).
- 04: sonnet engineer; awaiting gate G2 (28 Freesound files, list in `freesound-wanted.md`, given to the user 2026-11-14); sonnet reviewer clean in 1 round.
- 05: opus engineer, opus reviewer, clean in 1 round (two tidy-ups).
- 06: sonnet engineer, sonnet reviewer, clean in 1 round (two tidy-ups, `e846bd3`).
- 07: sonnet engineer, sonnet reviewer, clean in 1 round; accepted deviation: a world message sounds all its reports' events (two-cue cap), not only the told ones. Full browser suite only green file-by-file under load.
- 08: opus engineer, opus reviewer, clean in 1 round; G3 passed 2026-11-14 (all acceptable); record and index to be set `done` by the step 09 engineer. Non-blocking: `hit.crit` ~270 ms vs brief ~500 (likely deliberate, unrecorded), `swing.heavy` 548–621 ms vs ~450; let G3 decide.
- 09: opus engineer, opus reviewer, clean in round 3 (unused source; then `source remove` deleted used impulses; fixed `20df707`, `1f53d01`). Audition `audio/.audition/09-ui-stings/`; user to judge whether `ui.back` is softer than `ui.click`.
- 14: sonnet engineer, sonnet reviewer, clean in 1 round (tidy-ups: `lineSeed` literal test, lockfile order, smol-toml licence).
- 15: opus engineer, opus reviewer, clean in 1 round (three tidy-ups, `70a21c2`); G9 pending. Emotion clips tested: they lower speaker similarity (0.81–0.84 vs 0.92–0.96) and carry only pace.
- 03: opus engineer, opus reviewer, clean in 1 round; G1 passed 2026-11-14 (b/A, `A_0`); records updated by the step 07 engineer.

## Notes carried forward

- Step 02: also fix review-01 findings: check every source id a recipe names (not only those drawn), catch non-AudioError failures without tracebacks, stop reading pyloudnorm's private `_filters` (or comment/pin it).
- Step 02 (and 09): apply the short-cue normalisation rule above; `hit.slash` over stand-in sources peaked +4.4 dBTP, the same rule catches it.
- Step 16: the user heard "winds" (the road winds) read as wind-that-blows in every G9 clip but `grave_0` (a heteronym in the design's audition sentence only). Check every shipped line for heteronyms by ear-proxy (list them in the record) and respell them in the beat's `spoken` (e.g. "wynds") or reword; don't rely on the engine.
- Step 16: update design §5.8.3 item 3 and §5.8.4 (still say per-emotion `audio_prompt` / `chatterbox` with no tags; G1 overtook them). Only grave, whisper and triumphant were ever designed.
- Step 16: the mlx Chatterbox port adds no PerTh watermark; say so in the voice README. A render needs network on first model load.
- c22 (b) has a click near its end: re-take if that line ships.
- Steps 08–13: `sourcing.md` names some Kenney files loosely (`creak_001` is `creak1`; `knifeSlice`, `drawKnife`, `handleCoins` plain numbers; "Retro Electric Off" is `Retro Charge Electric Off 07_s05`), and a few Freesound cue lists differ between `sourcing.md` and `freesound-wanted.md` (review-04). Check names on disk.
- After G2: record the outcome in step 04's execution record and set it `done`.
- Step 17: `stopVoice`'s fade tweens on the starting scene; if it shuts down mid-fade the sound is never destroyed (review-05 #3) — destroy on shutdown or tween elsewhere.
- Step 17: reuse step 05's duck constants in `soundPlayer.ts`, don't define new ones.
- G11: music now plays at −24 LUFS (battle 4.0 dB, world 1.7 dB louder than before); judge by ear.
- Merging with `skill-trees`: a new main-hand weapon icon fails step 06's coverage test until it gets a `WEAPON_SOUNDS` entry (intended); new spells sound by element/school automatically.
- `yomi-audio source remove` exists since step 09.
- Browser tests' 60 s timeout is tight under load; run the full suite with nothing else running.
- Step 09: start `ui.click` from the fixed version in `tools/audio/tests/test_build.py` (the design's example fails the correlation and DC checks). 43 impact variants over 15 cues are peak-limited at −20.6 to −22.6 LUFS against −19 (steps 08, 10).
- Step 09: every Kenney jingle is ≤1.74 s; `stings.victory` (~3 s) and `stings.defeat` (~3.5 s) need chaining or synthesis.
- The worktree needed `npm ci` (done in step 01).

- Machine: Apple M5, 32 GB, ffmpeg and uv installed, no sox; 80 GB free disk.
