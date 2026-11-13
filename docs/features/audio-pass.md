# Feature: audio pass (SFX and narration)

**Request (user's words):** "separately from the ongoing skill tree work, I'd like you to improve the quality of the sound effects, to create indie game-quality SFX. If possible I'd also like a framework for narration of cutscenes and the like, maybe using a local version of a voice model, especially one that supports emotions and other effects."

- **Slug:** `audio-pass`
- **Phase:** 2, design
- **Branch / worktree:** `audio-pass`, from `main` at `d18abf4`, in `.claude/worktrees/audio-pass` (kept apart from `skill-trees`)
- **Architecture brief:** `docs/architecture/audio-pass.md` (`a82ae8f`)
- **Design:** `docs/designs/audio-pass.md` (pending)
- **Plan:** `docs/implementation-plans/audio-pass/index.md` (pending)

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
| D6: add a `voice` volume slider; UI sounds stay under Sound FX with their own internal group | orchestrator | separate UI slider | brief's recommendation, splittable later |

## Open questions

- Whether tutorial tips are narrated too (design).

## Tiers

- Architect: opus.
- Designer: opus.

## Verification

(none yet)

## Notes carried forward

- Machine: Apple M5, 32 GB, ffmpeg and uv installed, no sox; 80 GB free disk.
