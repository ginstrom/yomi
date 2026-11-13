# Step 01: Audio tool core

[Index](index.md) · [Design](../../designs/audio-pass.md) §5.1, §5.2, §5.5, §5.6 · [Brief](../../architecture/audio-pass.md) §3

## Objective

Create the host-only Python tool `tools/audio/` (uv project, package `yomi_audio`, CLI `yomi-audio`) that turns text recipes and committed sources into PCM: the DSP primitives and the recipe interpreter for the whole recipe format of design §5.6, loudness and true-peak measurement, the sources registry with `source add`, `impulse build`, and `sfx audition`. No bank is built yet (step 02) and nothing in the game changes. This step is the base every later audio step stands on, so its correctness and determinism matter more than its speed. **Judgement-heavy.**

## Requirements and context

- **R8** (part): sound effects are built from text recipes and committed sources, deterministically; each source carries provenance and an allow-listed licence (`CC0-1.0` or `own`). **R9** (part): every built sound can be measured against its group's loudness target and true-peak ceiling (enforced in step 02). **R15** (part): `audio/CLAUDE.md` exists with a pointer from the root `CLAUDE.md`.
- Settled decisions (feature record): D1 one Python (uv) tool in `tools/audio/` for SFX and later narration; D2 CC0 and own sources only, committed as trimmed excerpts with provenance; Pedalboard (GPL) not used, scipy for filters.
- House precedent: `art/` text sources + host-installed `sprite` tool + committed outputs + `npm run sprites:check` outside `npm test` (`art/CLAUDE.md`). Audio mirrors it; the tool never enters `npm test` or the podman image.
- Machine: Apple M5, macOS, `uv` 0.13, `ffmpeg` 9 (libopus, libmp3lame), no sox. Python 3.11 pinned in `tools/audio/.python-version`.

## Dependencies and prerequisites

- None (first step). Existing: `public/assets/audio/` (eight placeholder `sfx_*.wav`, two WAV stings, two themes) and its `README.md`, which says the WAVs were synthesised in-house (so later registrable as licence `own`, in step 02).
- Produces for later steps: the C2 commands `source add`, `impulse build`, `sfx audition`; the recipe interpreter (C5) and measurement used by step 02's `sfx build`/`sfx check`; the TOML readers for C3 and C4; the `tts` extra slot used by step 03.

## Contracts (copied from the index; do not change)

### C1. Layout (the parts this step creates)

```
audio/                            text sources (like art/)
  CLAUDE.md                       workflow for this directory (step 01; extended by later steps)
  audio.toml                      C3
  sources.toml                    C4
  sources/<collection>/*.flac     trimmed CC0 / own excerpts, mono, 48 kHz
  impulses/<name>.toml, .flac     impulse recipes and their rendered FLAC (licence "own")
  sfx/<bank>/<name>.toml          one recipe per cue: cue `<bank>.<name>` (C5)
  .audition/                      gitignored: audition WAVs, spectrograms and review sheets
tools/audio/                      the uv project (C2)
```

`.gitignore` gains `tools/audio/.venv/`, `audio/bakeoff/`, `audio/.audition/`, `audio/narration.jobs.json` (step 01).

### C2. The tool (`tools/audio/`)

- uv project, Python 3.11 (`tools/audio/.python-version`), package `yomi_audio`, console script `yomi-audio`, `pyproject.toml` and `uv.lock` committed. Base dependencies: numpy, scipy, soundfile, pyloudnorm; dev group: pytest (and matplotlib for spectrograms if wanted). TTS dependencies only in the optional extra `tts` (`uv run --project tools/audio --extra tts …`), so `sounds:check` never installs torch or mlx. ffmpeg is called as a subprocess for encoding only. Pedalboard (GPL) is not used.
- Every command takes `--root <dir>` (default: the repository's `audio/`; the tests use fixture projects) and exits non-zero with a message naming the cue, source or line at fault.

| Command | Step | Does |
| --- | --- | --- |
| `yomi-audio source add <file> --id ID --collection C --licence L --author A --url U [--original NAME] [--start S --end E] [--notes N]` | 01 | trims, sums to mono, resamples to 48 kHz, writes `audio/sources/<C>/<ID>.flac`, appends a C4 entry with both hashes; refuses a licence outside the allow-list |
| `yomi-audio impulse build` | 01 | renders `audio/impulses/<name>.toml` to `<name>.flac` (`small_room`, `stone_hall`, `open_air`) |
| `yomi-audio sfx audition <cue>… [--out DIR] [--spectrogram]` | 01 | renders variants as 48 kHz WAV (default `audio/.audition/<cue>/`), prints each variant's loudness, peak and length |

(The other C2 commands, `sfx build`, `sfx check`, `voice …`, belong to steps 02, 03, 15, 16; leave room for them in the CLI's structure.)

### C3. `audio/audio.toml`

```toml
sample_rate = 48000
gap_ms = 50                                   # silence between markers in a bank
banks = ["ui", "battle", "world", "stings"]

[budgets]
sfx_bytes_per_format = 3_000_000              # all banks, per format
sources_bytes = 15_000_000                    # audio/sources + audio/voices together
voice_bytes_per_format = 4_000_000

# measure: "momentary_max" (LUFS-M max, 400 ms window, padded to 400 ms) or "integrated" (LUFS-I)
[groups.ui]        measure = "momentary_max"; target = -26; tolerance = 1.0; peak = -6.0
[groups.step]      measure = "momentary_max"; target = -30; tolerance = 1.5; peak = -10.0
[groups.release]   measure = "momentary_max"; target = -22; tolerance = 1.0; peak = -3.0
[groups.impact]    measure = "momentary_max"; target = -19; tolerance = 1.0; peak = -1.0
[groups.sweetener] measure = "momentary_max"; target = -24; tolerance = 1.5; peak = -3.0
[groups.death]     measure = "momentary_max"; target = -20; tolerance = 1.0; peak = -1.0
[groups.world]     measure = "momentary_max"; target = -22; tolerance = 1.0; peak = -2.0
[groups.sting]     measure = "integrated";    target = -18; tolerance = 1.0; peak = -1.0

[encode.sfx]   opus_kbps = 64; mp3_q = 5      # mono 48 kHz, Opus VBR, MP3 VBR -q:a
[encode.voice] opus_kbps = 32; mp3_q = 7      # Opus application "voip"/speech

[voice]                                       # post-processing of every rendered line; part of each line's hash
highpass_hz = 70
trim_db = -50
keep_before_ms = 120
keep_after_ms = 250
target_lufs_i = -18
peak_dbtp = -1.5
```

(The one-line inline-table style above is shorthand; write valid TOML, e.g. `[groups.ui]` then one key a line.) True peak is measured at 4x oversampling.

### C4. `audio/sources.toml` entries

```toml
[[source]]
id = "kenney_impact_plate_heavy_2"            # [a-z0-9_]+, unique
file = "sources/kenney_impact/kenney_impact_plate_heavy_2.flac"
licence = "CC0-1.0"                           # allow-list: "CC0-1.0", "own"
author = "Kenney (kenney.nl)"
url = "https://kenney.nl/assets/impact-sounds"  # the page the licence is stated on
original = "Audio/impactPlate_heavy_002.ogg"  # path or name in the pack or site
original_sha256 = "…"                         # optional, of the downloaded original
excerpt = { start = 0.0, end = 0.62 }         # optional, seconds of the original kept
sha256 = "…"                                  # of the committed FLAC
retrieved = "2026-11-20"
notes = "mono sum, trimmed"
# reference clips only:
design = { model = "…", revision = "…", seed = 7, description_ref = "voices.toml#narrator", instruction = "…", text = "…" }
```

The build refuses a recipe naming a source that is missing, whose file's SHA-256 differs, or whose licence is not allowed.

### C5. Recipes (design §5.6, normative there)

TOML, one cue per file at `audio/sfx/<bank>/<name>.toml` for cue `<bank>.<name>` (so `world.rune.embed` is `audio/sfx/world/rune.embed.toml`). Top level `variants`, `seed`, `group` (a C3 group), optional `max_ms`; `[[layer]]` (`source` | `pick` | `synth`; `gain`, `offset`, `pitch`, `start`, `length`, `reverse`, `fade_in`, `fade_out`, `envelope`, `filter`, `saturate`, `chance`); `[post] chain` (`compress`, `saturate`, `reverb`, `delay`, `limit`, `trim`, `fade_out`), loudness normalisation to the group always last. Any numeric field may be `[lo, hi]`, drawn per variant from numpy `default_rng([seed, k])`. Synth kinds `sine|triangle|saw|square|noise|fm|crackle|impulse`; filters `highpass|lowpass|bandpass|peak|lowshelf|highshelf` (`hz_end` sweeps). Runtime hints (bus, jitter, limits) never go in recipes.

## The recipe format in full (design §5.6, restated)

- **Variation:** any numeric field may be `[lo, hi]` (uniform per variant). `pick = [ids…]` chooses a source per variant from a deterministic shuffle of the list, without repeats until the list is used up. `chance = 0.5` includes the layer in a variant with that probability.
- **Layer fields:** `source` or `pick` or `synth`; `gain` (dB), `offset` (ms), `pitch` (semitones, by resampling, so it changes length), `start`/`length` (ms, trims the source), `reverse`, `fade_in`/`fade_out` (ms), `envelope` (points `[[ms, dB], …]`, linear in dB between points), `filter` (a list), `saturate` (drive dB).
- **Synthesis** (`synth = { kind = …, … }`): `sine|triangle|saw|square` (`hz`, `hz_end`, `curve` `lin|exp`); `noise` (`color` `white|pink|brown`); `fm` (`carrier_hz`, `ratio`, `index`, `index_end`); `crackle` (`density` clicks a second, `click_ms`); `impulse` (a single click). Each needs `length`. Fields inside `synth` may also be ranges (the design's examples use `hz = [160, 200]`, `density = [35, 60]`).
- **Filters:** `highpass`, `lowpass`, `bandpass` (`hz`, `q`), with optional `hz_end` to sweep over the layer; `peak` (`hz`, `gain_db`, `q`); `lowshelf`, `highshelf` (`hz`, `gain_db`).
- **Post chain:** `compress` (`threshold_db`, `ratio`, `attack_ms`, `release_ms`), `saturate`, `reverb` (`impulse`, `wet_db`, `predelay_ms`, by convolution), `delay` (`ms`, `feedback`, `wet_db`), `limit` (`ceiling_db`), `trim` (`threshold_db`, `keep_tail_ms`), `fade_out` (`ms`). Loudness normalisation to the group target is always last.
- **Determinism:** per variant `k`, seed numpy's generator from `(seed, k)` (`np.random.default_rng([seed, k])`); draws happen in a fixed order (layers in file order, fields in a fixed order) so variant `k` is fixed. Same inputs and same lock give bit-identical float PCM. Avoid anything order- or thread-dependent (no multithreaded FFT reductions whose summation order can vary; scipy's `fftconvolve`/`oaconvolve` are fine).
- The design's three worked examples (`hit.slash`, `impact.fireball`, `ui/click`, design §5.6) must parse and render; use them (with synthetic stand-in sources) as test fixtures.

**Impulses:** `audio/impulses/<name>.toml` is a short recipe of exponentially decaying filtered noise (decay time, filter, length, a seed); `impulse build` renders each to `<name>.flac` (48 kHz mono, peak-normalised), registered in `sources.toml` with licence `own` (or tracked the same way, hashed), so a recipe's `reverb = { impulse = "small_room" }` resolves and its hash feeds the cue's inputs in step 02. Ship `small_room` (≈0.3 s), `stone_hall` (≈1.8 s), `open_air` (≈0.8 s, sparse, bright-damped).

## Scope and implementation guidance

New (proposed paths; routine layout choices are the implementer's):

- `tools/audio/pyproject.toml`, `uv.lock`, `.python-version` (3.11), `yomi_audio/` with modules for: CLI (`argparse` subcommands `source`, `impulse`, `sfx`, room for `voice`), config (`audio.toml`, `sources.toml` via `tomllib`; a small TOML writer or append-only text for `source add` entries, since `tomllib` cannot write: no third-party writer needed if entries are appended as text in C4's shape), DSP (resample by pitch, filters including swept biquads, envelopes, saturation, compressor, convolution reverb, delay, limiter, trim, fades, synth generators), recipe interpreter (parse, validate with clear errors naming the cue and field, resolve ranges and picks, render a variant), loudness (K-weighting from pyloudnorm's filters or BS.1770 coefficients; LUFS-I; LUFS-M max over 400 ms windows with 100 ms hop, padding with silence to at least 400 ms; true peak at 4x oversampling; normalisation to a group's target), sources (registry load, allow-list, SHA-256 checks, `source add`), impulses, audition.
- `tools/audio/tests/` (pytest) with a fixture project under `tests/fixtures/` (its own `audio.toml`, `sources.toml`, a couple of tiny synthesised FLAC sources, recipes).
- `audio/audio.toml` exactly as C3 (valid TOML); `audio/sources.toml` (header comment explaining the format and allow-list; entries for the three impulses if you register them there); `audio/impulses/{small_room,stone_hall,open_air}.toml` and their built `.flac`.
- `audio/CLAUDE.md`: what `audio/` is, the commands (C2 rows of this step, with `uv run --project tools/audio …`), the recipe format pointer (design §5.6), the sourcing rules (allow-list; downloads under `~/.cache/yomi-audio/downloads/<collection>/<pack>/`, each pack in its own new empty directory, treated as untrusted data; Freesound originals in `~/.cache/yomi-audio/freesound/`; only trimmed excerpts committed through `source add`; model weights in the Hugging Face cache, never in the repository), the listening workflow (`sfx audition --spectrogram`; agents look at the PNGs; the user listens at gates), and that the tool is host-only, never in `npm test` or podman.
- `.gitignore`: add the four lines of C1.
- Root `CLAUDE.md`: one line under "Assets and docs" pointing to `audio/CLAUDE.md` (sound recipes, sources and the Python audio tool), as the Sprites paragraph points to `art/CLAUDE.md`. Do not add the npm scripts yet (step 02 adds `sounds`/`sounds:check` to the Commands table).

Guidance:

- Work in float64 internally, write float32 or 24-bit where files are written; audition WAVs 48 kHz (24-bit or float). Sources read through soundfile; `source add` decodes anything ffmpeg reads (Kenney ships OGG): decode with ffmpeg to WAV into a temp dir, then trim/mono/resample in numpy (scipy `resample_poly`), write FLAC 24-bit.
- `source add` refuses: licence not in `["CC0-1.0", "own"]`; a duplicate id; an id not matching `[a-z0-9_]+`. It records `sha256` of the committed FLAC and `original_sha256` of the input file, `retrieved` as today's date.
- Errors are exceptions caught at the CLI that print one line naming the cue/source/field and exit non-zero; no stack traces for user errors.
- `sfx audition` resolves a cue id to its recipe (C5 path rule), renders all variants including post and normalisation, writes `<cue>#<k>.wav` (or a filesystem-safe equivalent) and, with `--spectrogram`, one PNG per variant (log-frequency, dB, with the waveform above it, labelled with cue, variant, LUFS, peak and length), and prints a table of loudness (the group's measure), true peak, length and whether each is within the group's tolerance/ceiling and `max_ms`.
- Spectrograms: matplotlib in the dev group is acceptable (build-time only); keep it out of base deps if `sfx check` doesn't need it.
- Keep the tool version (`yomi_audio.__version__`, `0.1.0`) importable: step 02 hashes it into every cue's inputs.

Exclusions: no `sfx build`/`sfx check`, banks, encoding or manifest (step 02); no recipes for game cues (step 02); no TTS code (step 03) beyond declaring the empty `tts` extra; no npm scripts; no change under `src/`, `e2e/` or `public/`. **No scene changes**, so `npm run test:browser` is not required.

## Verification

- Tool tests (host): `uv run --project tools/audio pytest tools/audio/tests` passes, covering at least:
  - Recipe parsing: the design's three examples parse; an unknown field, a missing `length` on a synth, an unknown group or filter type each fail with a message naming the cue and field.
  - Variation: a `[lo, hi]` field gives values within range and different values across variants; `pick` uses every listed source before repeating; `chance` 0 and 1 behave; variant `k` is the same whatever the variant count's order of rendering.
  - Determinism: rendering a recipe twice (fresh processes or fresh interpreter state) gives byte-identical PCM (compare SHA-256 of the float arrays).
  - Licence refusal: `source add --licence CC-BY-4.0` exits non-zero and writes nothing; a recipe naming a source whose registry licence is not allowed, whose file is missing, or whose SHA-256 differs fails to render.
  - Loudness: a 1 kHz sine at known level measures within 0.2 LU of its expected LUFS (BS.1770 reference: a 0 dBFS 997 Hz full-scale sine ≈ −3.01 LUFS); normalising to −19 LUFS-M max lands within 0.1 LU; true peak of an inter-sample-peak test signal exceeds its sample peak; a short click is padded before measuring.
  - DSP units: filters attenuate out of band; pitch +12 halves length; envelope endpoints hit their dB; limiter output never exceeds its ceiling (sample peak); trim keeps the tail asked for.
- CLI by hand, recorded in the execution record:
  - `uv run --project tools/audio yomi-audio impulse build` writes three FLACs.
  - `uv run --project tools/audio yomi-audio sfx audition <cue> --root tools/audio/tests/fixtures/<project> --spectrogram` prints the table and writes WAVs and PNGs; look at one PNG and say what it shows.
  - `uv run --project tools/audio yomi-audio source add <a synthesised wav> --id test_tone --collection test --licence own --author me --url local` into a fixture copy (not the real `audio/`), then refusal with `--licence CC-BY-4.0`.
- `PATH=/opt/homebrew/opt/node@26/bin:$PATH npm test` still passes (nothing in it changes; confirms the repo is intact).
- `git status` shows no `.venv`, `.audition` or other ignored output staged.

## Completion criteria

- [ ] `tools/audio/` uv project with `pyproject.toml`, `uv.lock`, `.python-version` committed; `tts` extra declared (empty or placeholder); base deps only numpy, scipy, soundfile, pyloudnorm.
- [ ] `source add`, `impulse build`, `sfx audition` work as C2 says; `--root` honoured.
- [ ] The full recipe format of design §5.6 is interpreted; the three design examples render.
- [ ] pytest green, including determinism, licence refusal, loudness and variation tests (seen failing first where test-first applies).
- [ ] `audio/audio.toml` (C3), `audio/sources.toml`, three impulses, `audio/CLAUDE.md` exist; `.gitignore` has the four lines; root `CLAUDE.md` has the pointer line.
- [ ] `npm test` passes (Node 26). One commit, `Audio pass step 01: audio tool core`, on `audio-pass`, not pushed, with only this step's files.
- [ ] The index's step 01 row set to `done` with the commit hash; evidence in the execution record below.

## Execution record

### Run 1 (2026-11-13/14)

**Commit:** `dfa31ee` (Audio pass step 01: audio tool core).

**Environment.** The worktree had no `node_modules` of its own, so the baseline `npm test` failed 11 scene files (Vite refused `/@fs/…/yomi/node_modules/vitest-canvas-mock`, outside the worktree). `npm ci` in the worktree (gitignored, no tracked change) fixed it: baseline 84 files, 1510 tests green.

**Built** (`tools/audio/`, Python 3.11.15 via uv 0.13.6; numpy 2.4.6, scipy 1.17.1, soundfile 0.14.0, pyloudnorm in the lock; dev: pytest, matplotlib; `tts` extra declared empty):
- `loudness.py`: K-weighting from pyloudnorm's filters; LUFS-M max over 400 ms windows, 100 ms hop, with 400 ms of silence padded on both sides (so a short click is measured whole, wherever it falls); LUFS-I by pyloudnorm, padded to 400 ms; true peak at 4x (`resample_poly`); `normalise` refuses silence naming the cue and variant.
- `dsp.py`: RBJ biquads (six types), swept filters (geometric, coefficients every 32 samples, state carried), pitch by `resample_poly`, envelopes (linear in dB, ends held), fades, tanh saturation (full scale stays full scale), peak compressor, look-ahead brickwall limiter, tail trim, convolution reverb, feedback delay.
- `synth.py`: sine/triangle/saw/square (PolyBLEP for saw and square; `curve` lin/exp, default exp), noise white/pink/brown, fm, crackle, impulse.
- `recipe.py`: validation naming cue, layer, filter/post index and field; resolution in fixed schema order (file key order does not matter); `pick` from per-round shuffles seeded by (seed, layer, round), independent of k's neighbours; noise from its own stream (seed, k, layer); `Recipe.source_ids()` lists the sources and `impulse_<name>` ids a recipe touches (for step 02's input hash).
- `sources.py`: registry (verifies licence, existence, SHA-256 on use), `source add` (all checks before any write; ffmpeg decode to a temp WAV, trim, mean to mono, resample, FLAC 24-bit, append the C4 entry), `upsert_entry` for the impulses.
- `impulses.py`: `impulses/<name>.toml` (`seed`, `length` ms, `rt60` s, `density`, `filter`) to FLAC, peak −1 dBFS, registered as `impulse_<name>` (licence `own`); rebuilding leaves files and entries byte-identical.
- `audition.py`: WAVs `<cue>.v<k>.wav` (float32), optional PNG per variant, the measurement table.
- `cli.py`: `source add`, `impulse build [names]`, `sfx audition`, each with `--root`; `AudioError` prints one line, exit 1.
- Fixture project `tests/fixtures/project/`: C3 `audio.toml`, the design's three example recipes verbatim, eight synthesised stand-ins under the example's source ids, two short impulses; `tests/make_fixture.py` regenerates them.
- Repository: `audio/audio.toml` (C3, valid TOML), `audio/sources.toml` (header plus the three impulse entries), `audio/impulses/{small_room,stone_hall,open_air}.{toml,flac}` (28 KB, 147 KB, 48 KB), `audio/CLAUDE.md`, the root `CLAUDE.md` "Sound" pointer under "Assets and docs", `.gitignore` (the four C1 lines plus `tools/audio/**/__pycache__/`, `tools/audio/.pytest_cache/` and the fixture's `.audition/`).

**Verification.**
- `uv run --project tools/audio pytest tools/audio/tests`: 117 passed. Each module's tests were written against a stub and seen failing (`NotImplementedError`) first; the render tests went in after the interpreter, so two of them were checked by mutation: unseeding the noise stream fails `test_rendering_is_bit_identical_across_processes`, and removing the licence check fails `test_a_source_with_a_disallowed_licence_fails_to_render`.
- `yomi-audio impulse build`: wrote the three FLACs; a second run printed `unchanged` for each.
- `yomi-audio sfx audition battle.impact.fireball battle.hit.slash ui.click --root tools/audio/tests/fixtures/project --spectrogram --out <scratch>`: printed the tables, wrote 13 WAVs and 13 PNGs. In `battle.impact.fireball.v0.png`, a sub boom below 100 Hz holds strongly through ~0.25 s, a broadband burst opens up to ~20 kHz over the first 0.3 s, and the crackle shows as thin vertical streaks from 0.35 to 0.75 s.
- `yomi-audio source add tone.ogg --id test_tone2 --collection test --licence own --author me --url local --start 0.1 --end 0.6 --root <fixture copy>`: added it with both hashes and the excerpt; `--licence CC-BY-4.0`: `yomi-audio: source test_cc: licence CC-BY-4.0 is not allowed (allowed: CC0-1.0, own)`, exit 1, nothing written. (A first try without `--root` wrote into the real `audio/`; I deleted that file and its entry, so they are not in the commit.)
- `PATH=/opt/homebrew/opt/node@26/bin:$PATH npm test`: 84 files, 1510 tests passed.
- `git status --ignored`: `.venv`, `.pytest_cache` and `__pycache__` are ignored, not staged.

**For later steps.**
- Step 02's checks will fail the design examples as written: `ui.click` (a 40 ms click normalised to −26 LUFS-M max) peaks at about −0.3 dBTP against the `ui` ceiling of −6. A click much shorter than the 400 ms window needs a large gain to reach a momentary target, so the real `ui` recipes need either longer or denser sounds, or a target and ceiling that suit short clicks. Over the stand-ins, `hit.slash` variants 2, 3 and 5 peak at +3.5 to +4.4 dBTP against −1 (the thud stand-ins are low and K-weighting discounts them); real sources will differ. Step 02 and step 09 should expect this; the measurement is right.
- `Recipe.source_ids()`, `yomi_audio.__version__`, `sources.sha256_file` and `config.load_config` are what step 02's input hash needs. A recipe names an impulse by its name; the registry id is `impulse_<name>`.
- Audition file names are `<cue>.v<k>.wav` (the safe form of `<cue>#<k>`).
- Budgets: no paid calls; downloads were only the PyPI dependencies into `tools/audio/.venv/`, plus `npm ci` into the worktree's `node_modules`.

### Review round 1

Reviewer (opus): clean, nothing blocking, nothing fixed or disputed. Three non-blocking findings are carried to step 02 rather than fixed here:

1. A source named only by a layer that a variant leaves out (by `chance`), or only by a `pick` entry no variant uses, is never checked against the registry, since checks run when a variant renders. Step 02's build should verify every id in `Recipe.source_ids()` up front.
2. An error other than `AudioError` prints a traceback: for example a corrupt FLAC read by soundfile, or an `--end` past the file in `source add` beyond the cases already caught. Step 02 should wrap these so the CLI prints one line naming the source.
3. `loudness.py` reads pyloudnorm's private `meter._filters` for the K-weighting coefficients. It is pinned by `uv.lock`, but an upgrade could break it. Step 02 could compute the BS.1770 coefficients itself.
