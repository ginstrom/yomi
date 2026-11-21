# audio/

Text sources for the game's sound, as `art/` is for its sprites: recipes, the
sources they draw on, and the build's settings. The Python tool in
`tools/audio/` (package `yomi_audio`, command `yomi-audio`) turns them into
PCM. It is **host only**: never part of `npm test` or the podman image.
It needs `uv` and `ffmpeg` on the PATH.

`docs/reference/audio.md` has the full detail: the recipe format and the
tool's conventions, what the build and `sfx check` verify, the sound-design
lessons ("Sound design without ears": read it before writing a recipe), the
narration engines and their pinned licences, and voice design.

## Layout

- `audio.toml`: sample rate, banks, budgets, loudness groups, encoding, the
  narration's `[voice]` chain.
- `sources.toml`: the provenance of every source. Written by the tool, never
  by hand.
- `sources/<collection>/<id>.flac`: trimmed excerpts. `impulses/`: reverb
  impulses (`impulse_<name>`, licence `own`).
- `sfx/<bank>/<name>.toml`: one recipe per cue `<bank>.<name>`
  (`world.rune.embed` is `sfx/world/rune.embed.toml`).
- `voices.toml` and `voices/<voice>/`: the voice registry and its clips.
- Generated, never edited by hand: `sfx.manifest.json`,
  `public/assets/audio/sfx/*` (`<bank>.opus`, `.mp3`, `.json`),
  `voice.manifest.json` and `public/assets/voice/<line>.opus`/`.mp3`. A merge
  conflict in them is resolved by taking either side and rerunning
  `npm run sounds` (or `npm run narration`).
- Gitignored: `.audition/`, `bakeoff/`, `narration.jobs.json`.

## Commands

Run from the repository root (`--root` points elsewhere, as the tests do):

| Task | Command |
| --- | --- |
| Add a source | `uv run --project tools/audio yomi-audio source add <file> --id ID --collection C --licence L --author A --url U [--original NAME] [--start S --end E] [--notes N]` |
| Remove a source no recipe names (file and entry) | `uv run --project tools/audio yomi-audio source remove <id>` |
| Render the impulses | `uv run --project tools/audio yomi-audio impulse build [name ...]` |
| Listen to a cue | `uv run --project tools/audio yomi-audio sfx audition <cue>... [--out DIR] [--spectrogram]` |
| Build the banks (`npm run sounds`) | `uv run --project tools/audio yomi-audio sfx build [--bank B] [--cue C]` |
| Check the banks (`npm run sounds:check`) | `uv run --project tools/audio yomi-audio sfx check` |
| Render the narration lines whose inputs changed (`npm run narration`, which exports the jobs first; needs `--extra tts`) | `uv run --project tools/audio --extra tts yomi-audio voice render` |
| Design a voice's emotion clips | `uv run --project tools/audio --extra tts yomi-audio voice design <voice> [--emotions E,...] [--candidates N]` |
| The tool's tests | `uv run --project tools/audio pytest tools/audio/tests` |

A mistake prints one line naming the cue, source or field at fault and exits 1.

## Recipes and the build

The format is normative in `docs/designs/audio-pass.md` §5.6, the tool's reading of it in `tools/audio/yomi_audio/recipe.py`; conventions and what the build fails on are in the reference ("Recipes", "Building and checking"). Runtime hints (bus, jitter, voice limits, extra gain) belong in `CUES` in `src/scenes/sounds.ts`, never in a recipe. A cue too short to reach its loudness target is reported *peak-limited*: make it denser, longer or compressed, not louder. `npm run sounds` is incremental by inputs hash; `npm run sounds:check` writes nothing and never re-encodes.

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
  Check an excerpt's onset first (some originals open with silence); leave
  `--start`/`--end` off to keep a short file whole.
- The catalogue of candidates per cue, pack licences and fallbacks is
  `docs/implementation-plans/audio-pass/sourcing.md` (and
  `freesound-wanted.md`, the download list): read it before choosing files.

## Which sound plays when

The tables mapping game events to cues are in `src/scenes/sounds.ts` (`eventSounds`, `worldSounds`, `CUES`, `buttonCue`; not copied here, so they cannot go stale). `src/scenes/sounds.test.ts` fails when an event kind or an ability would sound nothing without an entry saying so. A new sound: a recipe in `sfx/<bank>/`, `npm run sounds`, an entry in `CUES`, and the event table that plays it; commit the recipe, any new source and the generated files together.

## Listening

Agents cannot hear. Measure instead: `sfx audition --spectrogram` prints each
variant's loudness, true peak and length against its group and writes a
spectrogram PNG per variant to look at. The user listens, from the WAVs in
`.audition/`.

## Narration

The TTS engines are only in the tool's optional `tts` extra (mlx-audio, Apple Silicon); weights download into `~/.cache/huggingface/` (about 13 GB), never into the repository.

A line is voiced by fields on a cutscene beat in `src/story/cutscenes.ts`: `line` (unique id), `voice`, and optionally `emotion`, `intensity`, `spoken` (what is said when the shown text cannot be, nonverbal tags included; never displayed) and `take` (bump to re-render with a new seed, at most three). `narrationProblems` in `src/story/narration.ts` enforces the rules (no leader and no `{…}` template spoken, known tags only for a tag engine, …). Then `npm run narration` (`PATH=/opt/homebrew/opt/node@26/bin:$PATH` for node) renders only the changed lines. `npm test` fails while a voiced beat's hash differs from `audio/voice.manifest.json` or its files are missing, so edit, render, commit both.

**Heteronyms** ("the road winds") are not left to the engine: check each shipped line's `spoken` for winds, wound, read, lead, live, close, tear, bow, row, bass, and reword it there. A respelling is a guess until rendered and auditioned.

A new voice, and the model pins and their licences: reference, "Designing a voice" and "Narration engines".
