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

## Recipes

The format is normative in `docs/designs/audio-pass.md` §5.6; the tool's
reading of it is in `tools/audio/yomi_audio/recipe.py`'s docstring. Each
`[[layer]]` is a `source`, a `pick` list or a `synth` with its processing;
`[post] chain` runs on the mix; normalisation to the group's target is always
last, and never past the group's true-peak ceiling, so a very short cue lands
under target and is reported *peak-limited* (make it denser, longer or
compressed, not louder). Any number may be `[lo, hi]`, drawn per variant;
rendering is deterministic. Runtime hints (bus, jitter, voice limits, extra
gain) belong in `CUES` in `src/scenes/sounds.ts`, never in a recipe.

## Building and checking

`npm run sounds` is incremental: only the banks with a changed cue (by its
inputs hash: recipe, sources, `audio.toml`, the tool's version, `uv.lock`)
are rendered and reassembled. Every build first re-verifies every source's
licence and hash. These fail the build, all reported in one run with nothing
written: loudness off target (unless peak-limited), true peak over the
ceiling, length over `max_ms`, DC offset over 0.5% (high-pass low sines and
sources), two variants correlating above 0.95, and a source unregistered,
not allowed or with a changed hash. The budgets in `audio.toml [budgets]`
(banks and voice files per format, sources) are checked by `sfx check`, the
first two also by the build. `npm run sounds:check` writes nothing and never
re-encodes: the manifest's record of the encoded bytes is the reference.

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

The tables that map a game event to a cue live in `src/scenes/sounds.ts`: `eventSounds` (battle events) over `WEAPON_SOUNDS`, `FOE_SOUNDS`, `SPELL_SOUND_OVERRIDES` and `spellSound`, `ABILITY_SOUNDS`, `DEATH`; `worldSounds` over `WORLD_SOUND_KINDS`; and `CUES`, every cue with its bus, gain and voice limits. `buttonCue` picks the interface cues. Not copied here, so it cannot go stale. A cue's variants are the markers of its bank in `audio/sfx.manifest.json` (`<cue>#0`, `<cue>#1`, ...). `src/scenes/sounds.test.ts` fails when an event kind or an ability would sound nothing without an entry saying so.

A new sound: a recipe in `sfx/<bank>/`, `npm run sounds`, an entry in `CUES`, and the event table that plays it; commit the recipe, any new source and the generated files together.

## Listening

Agents cannot hear. Measure instead: `sfx audition --spectrogram` prints each
variant's loudness, true peak and length against its group and writes a
spectrogram PNG per variant to look at. The user listens, from the WAVs in
`.audition/`.

## Narration

The TTS engines are only in the tool's optional `tts` extra (mlx-audio, Apple
Silicon), so the sound commands and `sounds:check` never install them.
Weights download into `~/.cache/huggingface/` on first use (about 13 GB,
needs network), never into the repository.

A line is voiced by fields on a cutscene beat in `src/story/cutscenes.ts`: `line` (id, `[a-z0-9_.]+`, unique), `voice`, and optionally `emotion`, `intensity` (0 to 1), `spoken` (what is said when the shown text cannot be; a voiced beat keeps its shown `text` as it is and puts the spoken wording here; never displayed, so nonverbal tags like `[sigh]` go only here) and `take` (bump to re-render with a new seed). The rules (`narrationProblems` in `src/story/narration.ts`, enforced by vitest): no duplicate ids, a voice for every line, no leader (speaker or portrait) and no `{…}` template in what is spoken, only known tags and only for a tag engine (`chatterbox_turbo`), an emotion the voice lists, intensity and take in range, nothing empty. Tutorial tips are not voiced.

To voice a beat, give it those fields, then run `npm run narration` from the repository root (`PATH=/opt/homebrew/opt/node@26/bin:$PATH` for node): it exports the jobs and renders only the lines whose inputs changed into `public/assets/voice/`, recording them in `audio/voice.manifest.json`. A flawed line is re-taken by bumping its beat's `take` (a new seed; at most three takes). `npm test` fails while any voiced beat's hash differs from the manifest's or its files are missing, so edit, render, commit both.

**Words spelled alike and said differently** ("the road winds" read as the wind that blows) are not left to the engine: check each shipped line's `spoken` for heteronyms (winds, wound, read, lead, live, close, tear, bow, row, bass) and reword it there. Rewording is the safe choice: a respelling ("wynds") is a guess until heard, so if you respell, render the line and audition it before shipping.

A new fixed character is a new table in `voices.toml` (engine, pinned model, emotions, `design`, `clips`, `fallback`), its clips (designed with `voice design` and picked by ear, then committed with a `sources.toml` entry, licence `own`), and beats naming it; `VoiceId` in `src/story/narration.ts` grows with it. Model pins live in `tools/audio/yomi_audio/tts/models.py` and `voices.toml`, held equal by a pytest; a new model's licence must allow its output in a commercial game.
