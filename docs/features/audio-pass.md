# Feature: audio pass (SFX and narration)

**Request (user's words):** "separately from the ongoing skill tree work, I'd like you to improve the quality of the sound effects, to create indie game-quality SFX. If possible I'd also like a framework for narration of cutscenes and the like, maybe using a local version of a voice model, especially one that supports emotions and other effects."

- **Slug:** `audio-pass`
- **Phase:** 4, implementation
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
- 03: opus engineer, opus reviewer, clean in 1 round; awaiting gate G1 (bake-off clips in `audio/bakeoff/`, given to the user 2026-11-14).

## Notes carried forward

- Step 02: also fix review-01 findings: check every source id a recipe names (not only those drawn), catch non-AudioError failures without tracebacks, stop reading pyloudnorm's private `_filters` (or comment/pin it).
- Step 02 (and 09): apply the short-cue normalisation rule above; `hit.slash` over stand-in sources peaked +4.4 dBTP, the same rule catches it.
- Step 15: `voice design` with a subset of emotions rewrites `design.json` but `bakeoff` reuses stale clips (review-03 #3); also tidy `cli.py` `--candidates` default (#2) and the WAV count in 03's record (#1: ten placeholders).
- Step 16: the mlx Chatterbox port adds no PerTh watermark; say so in the voice README. A render needs network on first model load.
- After G1: copy the outcome and per-configuration means into step 03's execution record and set it `done`.
- Steps 08–13: `sourcing.md` names some Kenney files loosely (`creak_001` is `creak1`; `knifeSlice`, `drawKnife`, `handleCoins` plain numbers; "Retro Electric Off" is `Retro Charge Electric Off 07_s05`), and a few Freesound cue lists differ between `sourcing.md` and `freesound-wanted.md` (review-04). Check names on disk.
- After G2: record the outcome in step 04's execution record and set it `done`.
- Step 17: `stopVoice`'s fade tweens on the starting scene; if it shuts down mid-fade the sound is never destroyed (review-05 #3) — destroy on shutdown or tween elsewhere.
- Step 17: reuse step 05's duck constants in `soundPlayer.ts`, don't define new ones.
- G11: music now plays at −24 LUFS (battle 4.0 dB, world 1.7 dB louder than before); judge by ear.
- Browser tests' 60 s timeout is tight under load; run the full suite with nothing else running.
- Step 09: start `ui.click` from the fixed version in `tools/audio/tests/test_build.py` (the design's example fails the correlation and DC checks). 43 impact variants over 15 cues are peak-limited at −20.6 to −22.6 LUFS against −19 (steps 08, 10).
- Step 09: every Kenney jingle is ≤1.74 s; `stings.victory` (~3 s) and `stings.defeat` (~3.5 s) need chaining or synthesis.
- The worktree needed `npm ci` (done in step 01).

- Machine: Apple M5, 32 GB, ffmpeg and uv installed, no sox; 80 GB free disk.
