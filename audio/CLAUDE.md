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
