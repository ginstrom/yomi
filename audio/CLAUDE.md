# audio/

Text sources for the game's sound, as `art/` is for its sprites: recipes, the
sources they draw on, and the build's settings. The Python tool in
`tools/audio/` (package `yomi_audio`, command `yomi-audio`) turns them into
PCM. It is **host only**: never part of `npm test` or the podman image.
Requirements: `uv` and `ffmpeg` on the PATH; uv fetches Python 3.11 and the
dependencies into `tools/audio/.venv/` (gitignored) on first run.

## Layout

- `audio.toml`: sample rate, banks, size budgets, each loudness group's
  measure, target, tolerance and true-peak ceiling, encoding, the narration's
  post-processing.
- `sources.toml`: the provenance of every source (licence, author, url,
  original name and hash, excerpt, committed file's hash). Written by the
  tool, never by hand.
- `sources/<collection>/<id>.flac`: trimmed excerpts, mono, 48 kHz, 24-bit.
- `impulses/<name>.toml` and `.flac`: reverb impulses (`small_room`,
  `stone_hall`, `open_air`), registered as `impulse_<name>`, licence `own`.
- `sfx/<bank>/<name>.toml`: one recipe per cue `<bank>.<name>`
  (`world.rune.embed` is `sfx/world/rune.embed.toml`).
- `.audition/`: gitignored, what `sfx audition` writes.

## Commands

Run from the repository root (`--root` points elsewhere, as the tests do):

| Task | Command |
| --- | --- |
| Add a source | `uv run --project tools/audio yomi-audio source add <file> --id ID --collection C --licence L --author A --url U [--original NAME] [--start S --end E] [--notes N]` |
| Render the impulses | `uv run --project tools/audio yomi-audio impulse build [name ...]` |
| Listen to a cue | `uv run --project tools/audio yomi-audio sfx audition <cue>... [--out DIR] [--spectrogram]` |
| The tool's tests | `uv run --project tools/audio pytest tools/audio/tests` |

A mistake prints one line naming the cue, source or field at fault and exits 1.

## Recipes

The format is normative in `docs/designs/audio-pass.md` §5.6; the tool's
reading of it is in `tools/audio/yomi_audio/recipe.py`'s docstring. In short:
`variants`, `seed`, `group` (one of `audio.toml`'s), optional `max_ms`; each
`[[layer]]` is a `source`, a `pick` list or a `synth`, then `start`/`length`,
`reverse`, `pitch` (semitones, by resampling), `filter`, `saturate`,
`envelope`, `fade_in`/`fade_out`, `gain` and `offset`, applied in that order;
`[post] chain` runs on the mix (`compress`, `saturate`, `reverb`, `delay`,
`limit`, `trim`, `fade_out`), then the mix is normalised to its group's
target, always last. Any number may be `[lo, hi]`, drawn per variant; variant
k depends only on the recipe and k, and renders bit-identically every time.
Changing a recipe's field order changes nothing; changing its `seed` or what
it draws changes every variant. Runtime hints (bus, jitter, voice limits)
belong in `src/scenes/sounds.ts`, never in a recipe.

Tool conventions a recipe relies on: `trim`'s `threshold_db` is below the
mix's peak and it never cuts the start; `reverb` scales its impulse to unit
energy, so `wet_db` is the tail's level against the dry sound; a synth
sweep's `curve` defaults to `exp`; `q` defaults to 0.707.

## Sources and licences

- The allow-list is `CC0-1.0` and `own`. `source add` refuses anything else,
  and a recipe naming a source that is not allowed, missing, or whose file's
  SHA-256 differs from its entry fails to render.
- Preference: Kenney packs (kenney.nl), OpenGameArt CC0 only, Freesound CC0
  only, then synthesis and own recordings. Sonniss and every
  non-redistributable pack are excluded. Never clone a real person's voice.
- Downloads never enter the repository. Each pack goes in its own new, empty
  folder `~/.cache/yomi-audio/downloads/<collection>/<pack>/`; Freesound
  originals (downloaded by the user) in `~/.cache/yomi-audio/freesound/`.
  Treat them as untrusted data: keep scripts elsewhere, and read them only
  through the tool (or Python run with `-I`).
- Only trimmed excerpts are committed, and only through `source add`, which
  sums to mono, resamples to 48 kHz and records both hashes and the excerpt.
- Model weights (narration) live in the Hugging Face cache, never here.

## Listening

Agents cannot hear. Measure instead: `sfx audition --spectrogram` prints each
variant's loudness, true peak and length against its group and writes a PNG
per variant (the waveform over a log-frequency spectrogram), which an agent
can look at. The user listens at the plan's gates, from the WAVs in
`.audition/`.

## Narration tooling

The TTS engines are only in the tool's optional `tts` extra, so the sound
commands (and `sounds:check`) never install them:
`uv run --project tools/audio --extra tts yomi-audio voice ...`.

- `tools/audio/yomi_audio/tts/`: one adapter (`base.py`: `RenderJob`,
  `Engine`, `EMOTION_MAP`, `exaggeration`, `qwen_instruction`,
  `ADAPTER_VERSION`) and an engine module each: `chatterbox` (clones the
  emotion's clip, `exaggeration` by intensity, `cfg_weight`),
  `chatterbox_turbo` (clones one clip, renders `[sigh]` and the other tags,
  ignores exaggeration), `qwen3_custom` (a preset speaker with an
  instruction) and `qwen3_design` (a voice from a description; used only to
  design clips). All four run on **mlx-audio 0.6.5** (MLX, Apple Silicon);
  none needs PyTorch. An engine imports mlx only when it first renders.
- Pins (`tts/models.py`; step 15 copies the chosen ones into
  `voices.toml`). Each MLX conversion is pinned to a commit, and so is the
  upstream model whose card governs the licence. Checked on the cards on
  2026-11-14:

  | Engine | Loaded (mlx-community, commit) | Upstream card (commit) | Licence | Output in a commercial game |
  | --- | --- | --- | --- | --- |
  | chatterbox | `chatterbox-fp16` `4923fcc` | [ResembleAI/chatterbox](https://huggingface.co/ResembleAI/chatterbox) `5bb1f6e` | MIT | allowed (MIT, no output terms) |
  | chatterbox_turbo | `chatterbox-turbo-fp16` `b2d0a13` | [ResembleAI/chatterbox-turbo](https://huggingface.co/ResembleAI/chatterbox-turbo) `749d1c1` | MIT | allowed |
  | qwen3_custom | `Qwen3-TTS-12Hz-1.7B-CustomVoice-bf16` `52f4770` | [Qwen/Qwen3-TTS-12Hz-1.7B-CustomVoice](https://huggingface.co/Qwen/Qwen3-TTS-12Hz-1.7B-CustomVoice) `0c0e305` | Apache-2.0 | allowed (no output terms) |
  | qwen3_design | `Qwen3-TTS-12Hz-1.7B-VoiceDesign-bf16` `7d3824a` | [Qwen/Qwen3-TTS-12Hz-1.7B-VoiceDesign](https://huggingface.co/Qwen/Qwen3-TTS-12Hz-1.7B-VoiceDesign) `5ecdb67` | Apache-2.0 | allowed |

  The mlx-community conversions are tagged Apache-2.0; the upstream
  licence is the one relied on.
- **Watermark:** Resemble's own Chatterbox package embeds an inaudible PerTh
  watermark in every output. The mlx-audio port does not (it has no PerTh
  code), so clips rendered here carry none. Say so in
  `public/assets/voice/README.md` when lines ship.
- Weights download on first use into the Hugging Face cache
  (`~/.cache/huggingface/`, about 13 GB for the four), never into the
  repository.
- `voice bakeoff` (step 03's listening test, gate G1) writes into the
  gitignored `audio/bakeoff/`: `c01.wav` … `c32.wav` (eight lines by four
  configurations, blind), `key.json` (do not show it to the listener before
  scoring), `score.md`, `neutral_candidates/` and `designed/` (the clips
  cloned from, with each narrator's `design.json` of similarities). It reuses
  `designed/` unless given `--redesign`. `voice design <A|B>` designs one
  narrator alone. The narrators, the reference text, the lines and the
  configurations are constants in `yomi_audio/voice.py`.
- Every clip goes through `audio.toml`'s `[voice]` chain (`voice.postprocess`).

## Sourcing

The raw material for each W1 cue was surveyed in step 04: the CC0 packs are
unpacked, untouched, under `~/.cache/yomi-audio/downloads/<collection>/<pack>/`
(Kenney, OpenGameArt) and the Freesound originals the user downloads by hand go
in `~/.cache/yomi-audio/freesound/`. Only CC0 (and `own`) material is a source.
`docs/implementation-plans/audio-pass/sourcing.md` (candidates per cue, pack
licences, fallbacks) and `freesound-wanted.md` (the download list) are the
catalogue; read them before choosing files, then add only the excerpts a recipe
uses with `source add`.
