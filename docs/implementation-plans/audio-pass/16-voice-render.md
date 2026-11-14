# Step 16: Render the shipped lines

[Index](index.md) · [Design](../../designs/audio-pass.md) §5.8.2, §5.8.5, §6, §7.1 (AC12, AC13, AC15)

## Objective

Turn the narrator chosen at G1 and the clips picked at G9 into committed reference clips and a final `audio/voices.toml`; build `yomi-audio voice render`; voice the two placeholder narration beats; render them with `npm run narration`; and make the vitest staleness test hold real lines. Ends at gate **G10**, where the user listens to the two shipped lines.

## Requirements and context

- **R12:** narration is rendered offline through the engine adapter, **only for lines whose inputs changed**; `npm test` fails when a voiced line is stale. **R13:** each voice comes from voice design; no real person's voice is cloned; the adopted engine is the one the user chose at G1. **R15:** provenance and licences are documented (`public/assets/voice/README.md`). **R11** rules (step 14's `narrationProblems`) must keep passing with the new voiced beats.
- **AC12:** every voiced beat's `lineHash` equals the manifest's and its files exist; changing a voiced beat's spoken text without rendering fails the test; `voice render` after that change renders exactly one line.
- **AC13 (this step's part):** each committed clip has a provenance entry naming VoiceDesign, its revision, description and seed; the emotion clips' speaker similarity to neutral is at least 0.75 (as printed by step 15's `voice design`).
- **v1 content (design §5.8.1):** `intro`'s first beat gets `line: 'intro.opening'`, `voice: 'narrator'`, `emotion: 'grave'`; `source_sighted`'s beat gets `line: 'source.sighted'`, `voice: 'narrator'`, `emotion: 'tense'`. Each gets a `spoken` that omits "[Placeholder]" (the displayed `text` keeps it). The `{leader}` beat stays unvoiced (D4). No nonverbal tags (the v1 narrator uses `chatterbox`, or the engine G1 chose; tags only with `chatterbox_turbo`).
- **Not in this step:** playback in `StoryScene` (step 17); tutorial tips (not voiced in v1).

## Dependencies and prerequisites

- **Step 15 done and gate G9 answered**: the user's pick of one candidate per emotion from `audio/.audition/15-voice/` (relayed in step 15's execution record and the feature record). G1's choice (configuration, narrator A or B, the neutral candidate kept) is in the feature record's decision log.
- **Step 14 (existing by then):** `CutsceneBeat` fields, `src/story/narration.ts`, `scripts/narration.ts` (`npm run narration:export`), the provisional `audio/voices.toml`, `audio/voice.manifest.json` = `{ "version": 1, "lines": {} }`, and the rules and staleness tests in vitest.
- **Step 03 (existing by then):** the engine adapters under `tools/audio/yomi_audio/tts/` (C10) with pinned model revisions; **step 01/02:** loudness, true-peak and ffmpeg encode helpers in the tool, `audio.toml` (C3).
- Environment: the Mac (M5, uv, ffmpeg with libopus and libmp3lame). Model weights in the Hugging Face cache (`~/.cache/huggingface/`), already downloaded in step 03; never under the repository. TTS dependencies only through the `tts` extra.

### Contracts consumed and produced (copied from the index; do not change)

C2, the npm script this step adds:

```json
"narration": "node scripts/narration.ts && uv run --project tools/audio --extra tts yomi-audio voice render"
```

`yomi-audio voice render` (C2 table, step 16): takes `--root <dir>` (default the repository's `audio/`), exits non-zero naming the line at fault.

C3, the parts this step reads:

```toml
[budgets]
voice_bytes_per_format = 4_000_000

[encode.voice] opus_kbps = 32; mp3_q = 7      # Opus application "voip"/speech

[voice]                                       # post-processing of every rendered line; part of each line's hash
highpass_hz = 70
trim_db = -50
keep_before_ms = 120
keep_after_ms = 250
target_lufs_i = -18
peak_dbtp = -1.5
```

C4, a reference clip's source entry:

```toml
[[source]]
id = "voice_narrator_grave"                   # [a-z0-9_]+, unique
file = "voices/narrator/grave.flac"
licence = "own"                               # allow-list: "CC0-1.0", "own"
author = "generated: Qwen3-TTS VoiceDesign (Apache-2.0)"
sha256 = "…"                                  # of the committed FLAC
retrieved = "2026-11-20"
notes = "…"
design = { model = "…", revision = "…", seed = 7, description_ref = "voices.toml#narrator", instruction = "…", text = "…" }
```

C10 (existing from step 03):

```python
@dataclass(frozen=True)
class RenderJob:
    text: str; emotion: str; intensity: float; seed: int
    voice: dict; reference_clip: Path | None; instruction: str | None
class Engine(Protocol):
    name: str
    def render(self, job: RenderJob) -> tuple[np.ndarray, int]: ...
    def fingerprint(self) -> dict: ...
EMOTION_MAP   # design §5.8.4: clip, exaggeration (lo, hi), cfg_weight, instruction
```

C11 (from step 14; this step produces real content for it):

- `lineHash` = SHA-256 hex of canonical JSON (keys sorted at every level) of `{ spoken, emotion (default 'neutral'), intensity (default 0.5), take (default 0), voice: <the table>, clips: <SHA-256 of each of the voice's clips, by emotion>, adapter_version, voice_settings: audio.toml [voice] }`. `lineSeed(line, take)` = first 32 bits of SHA-256(`${line}#${take}`).
- `audio/narration.jobs.json` (gitignored): `{ "adapter_version": n, "voice_settings": {…}, "jobs": [ { "line", "spoken", "voice": "<id>", "voiceTable": {…}, "emotion", "intensity", "take", "seed", "hash" } ] }`.
- `audio/voice.manifest.json` (committed): `{ "version": 1, "lines": { "intro.opening": { "hash": "…", "durationMs": 4120, "voice": "narrator", "engine": "chatterbox@<rev>" } } }`.
- `audio/voices.toml` per design §5.8.2: `adapter_version`; `[narrator]` (`engine`, `model`, `revision`, `emotions`, `params`); `[narrator.design]` (`model`, `revision`, `description`, `reference_text`, `seed`); `[narrator.clips]` (one path per declared emotion); `[narrator.fallback]` (`engine = "qwen3_custom"`, `model`, `revision`, `preset`).
- Voice files `public/assets/voice/<line>.opus` and `.mp3`, loaded (by step 17) as `voice_<line>`.

## Scope and implementation guidance

1. **Commit the clips.** Copy the G9 picks (and G1's neutral) into `audio/voices/narrator/<emotion>.flac` (mono, 48 kHz FLAC, normalised to −18 LUFS-I as step 15 prepared them), one per emotion the narrator declares (design: all but `afraid` and `angry`; follow `voices.toml`). Append a C4 entry for each with licence `own`, author naming VoiceDesign and its licence, and the `design` block (model, pinned revision, seed, `description_ref`, the emotion's instruction, the reference text). Use `yomi-audio source add` or the step-15 command's provenance writer, whichever exists; the build's allow-list and hash checks must accept them.
2. **Complete `audio/voices.toml`.** Step 15 already finalised it from G1 (narrator description, adopted `engine`, `model` and pinned `revision` replacing step 14's `"unpinned"`, `[narrator.design]`, `[narrator.fallback]`). Here fill `[narrator.clips]` with one path per declared emotion for the clips committed in item 1, keep `emotions` matching the clips, and check every revision is pinned (none `"unpinned"`). If the vitest check of `VoiceId`/`Emotion` against `voices.toml` needs a change, change only `voices.toml` content, not the C11 types.
3. **`yomi-audio voice render`** (`tools/audio/yomi_audio/`), per design §5.8.5:
   - Read `audio/narration.jobs.json`; refuse (non-zero, clear message) when its `adapter_version` differs from `voices.toml`'s or from the adapter's own version.
   - For each job whose `hash` differs from `audio/voice.manifest.json` (or has no entry, or whose files are missing): build a `RenderJob` (`text` = `spoken`, `seed` from the job, `reference_clip` = the voice's clip for the emotion for chatterbox engines, `instruction` from `EMOTION_MAP` with the intensity wording for qwen3 engines), render through the engine named by the voice table.
   - Post-process with the `[voice]` table: high-pass at `highpass_hz`; trim silence below `trim_db` keeping `keep_before_ms` before and `keep_after_ms` after; normalise to `target_lufs_i`; fail if true peak (4x oversampled) exceeds `peak_dbtp`.
   - Encode `public/assets/voice/<line>.opus` (mono, 32 kbps, speech/`voip` application) and `<line>.mp3` (mono VBR `-q:a 7`) with ffmpeg.
   - Delete `public/assets/voice/` files of lines no longer in the jobs, and their manifest entries; leave `README.md` alone.
   - Write the manifest (`hash`, `durationMs` of the processed PCM, `voice`, `engine` = `<engine>@<revision>`), keys sorted, so unchanged lines leave it byte-identical.
   - Print which lines were rendered, skipped and deleted.
   - Fail when the voice files exceed `voice_bytes_per_format` (per format). Step 02's `sfx check` budget for `audio/sources` + `audio/voices` (15 MB together) must still pass with the clips.
4. **pytest** (`tools/audio/tests/`), on a fixture project under the tests with a **fake engine** (registered for the test; returns a deterministic tone from the seed and text length; no model, fast): first render renders all lines and writes the manifest; a second render renders none; changing one job's spoken text and hash renders exactly that one (AC12); a job removed deletes its files and manifest entry; an adapter-version mismatch is refused and writes nothing; post-processing hits −18 LUFS-I ±1 and the peak ceiling. No test downloads weights or imports the `tts` extra.
5. **npm script** `narration` exactly as C2. Keep step 14's `narration:export`.
6. **Voice the beats** in `src/story/cutscenes.ts`: add `line`, `voice`, `emotion` and a `spoken` without "[Placeholder]" to `intro`'s first beat and `source_sighted`'s beat (as above). The spoken wording is placeholder narration too; keep it a short sentence of the same meaning (e.g. "The opening of the story goes here." and "The Source of the blight comes into sight."). Leave the `{leader}` beat untouched.
7. **Render:** run `PATH=/opt/homebrew/opt/node@26/bin:$PATH npm run narration`; commit `public/assets/voice/intro.opening.*`, `source.sighted.*` and the manifest. Run it a second time and confirm it renders nothing.
8. **Vitest:** step 14's staleness test (every voiced beat's `lineHash` equals the manifest's and its `.opus` and `.mp3` exist) now covers two real lines; it must pass. Add, if step 14 did not, a test that a voiced beat with an edited `spoken` (built in the test, not on disk) hashes differently from its manifest entry, so a stale line is caught. Add a size test: the files under `public/assets/voice/` stay within 4 MB per format.
9. **`public/assets/voice/README.md`** (new): what the files are and how they are made (`npm run narration`); the engine and model ids with pinned revisions; each model card's licence **rechecked now** (Chatterbox MIT, Qwen3-TTS Apache-2.0, or what the card says today), with the date checked; that the voice is designed from a text description by Qwen3-TTS VoiceDesign (the description quoted) and clones no real person; that Chatterbox output carries Resemble AI's inaudible PerTh watermark; a table of lines (id, cutscene, emotion).

Exclusions: no change to `StoryScene` or any scene; no tutorial tips; no new voice besides the narrator; no change to the C11 types or hash rule.

## Shared constraints (from the index)

- Node 26: prefix npm/node commands with `PATH=/opt/homebrew/opt/node@26/bin:$PATH`.
- `npm test` passes before the commit; `npm run sounds:check` passes (the source budget now includes the clips); `uv run --project tools/audio pytest tools/audio/tests` passes. No scene changes, so `npm run test:browser` is not required.
- Weights stay in `~/.cache/huggingface/`; `audio/narration.jobs.json`, `audio/.audition/`, `audio/bakeoff/` and `tools/audio/.venv/` stay gitignored. Only allow-listed licences (`CC0-1.0`, `own`) in `sources.toml`.
- Audio never touches the battle or world RNG; no `SAVE_VERSION` or `LOG_SCHEMA_VERSION` change.
- One commit `Audio pass step 16: Render the shipped lines` on `audio-pass`, no push; a re-take after G10 is a follow-up commit of this step.

## Docs to update (same commit)

- Root `CLAUDE.md`: Commands table gains `npm run narration` (exports the jobs and renders changed lines; host only, needs uv, ffmpeg and model weights); Assets and docs gains a line on `public/assets/voice/` (generated, committed, its README) and `audio/voice.manifest.json`; the `src/story/` line mentions the voiced beats only if step 14's wording is now wrong.
- `audio/CLAUDE.md`: a render section (how to voice a beat, run `npm run narration`, re-take with `take`, what the staleness test means, where weights live).

## Verification

- `uv run --project tools/audio pytest tools/audio/tests`: the render tests above pass.
- `npm run narration` renders 2 lines; run again: 0 rendered. Record both outputs.
- Measure each shipped line (the tool's loudness print): −18 ±1 LUFS-I, true peak ≤ −1.5 dBTP; record durations and file sizes.
- `PATH=/opt/homebrew/opt/node@26/bin:$PATH npm test`: staleness, rules and size tests pass. Temporarily edit one voiced beat's `spoken`, confirm `npm test` fails naming that line and that `npm run narration` then renders exactly one line; revert both (or keep nothing from the experiment).
- `npm run sounds:check` passes.

### Gate G10 (user)

The orchestrator asks the user to listen to `public/assets/voice/intro.opening.opus` and `source.sighted.opus` (any player; the MP3s too if wanted). The step needs back: **OK**, or per line what is wrong. A flawed take (artifact, mispronunciation, wrong emotion) is fixed by bumping that beat's `take` (a new seed) and re-running `npm run narration`, at most three takes per line (design §5.8.6); then ask again. Step 17 may proceed before G10 is answered; this step is `done` only after it.

## Completion criteria

- [ ] Clips committed with C4 provenance entries (licence `own`, design block); `voices.toml` final with pinned revisions.
- [ ] `yomi-audio voice render` as above; pytest green including AC12's "exactly one line".
- [ ] `npm run narration` script; two lines rendered and committed with the manifest; a second run renders nothing.
- [ ] Vitest staleness and size tests green; `npm test` and `npm run sounds:check` pass.
- [ ] `public/assets/voice/README.md`, root `CLAUDE.md` and `audio/CLAUDE.md` updated.
- [ ] G10 answered OK (takes recorded); index status and commit hashes updated (`awaiting review` while G10 is pending).

## Execution record


Built by the engineer subagent on 2026-11-14, adapted to G1 and G9 (Chatterbox Turbo, `A_0` alone, sound tags allowed).

- **Clip.** `audio/voices/narrator/neutral.flac` (mono 48 kHz 24-bit FLAC, -18.0 LUFS-I, 927 KB) from `audio/.audition/15-voice/neutral.wav`; `sources.toml` entry `voice_narrator_neutral` (licence `own`, author "generated: Qwen3-TTS VoiceDesign (Apache-2.0)", `design` block with the pinned VoiceDesign revision, seed 7, `description_ref = "voices.toml#narrator"` and the reference text; no instruction, as neutral has none). Written with `upsert_entry` (`source add` writes under `sources/<collection>/` only). No emotion clips: none were adopted (G9), so the plan's similarity-0.75 clause has nothing to apply to. `voices.toml` was already final (pinned, none `unpinned`); only the clips comment changed.
- **`voice render`** (`tools/audio/yomi_audio/render.py`, `cli.py`): as the plan's item 3; the engine is built lazily so a run with nothing to render or a refusal loads no model; an error is rewrapped to name the line; the voice budget is checked per format after encoding. Tests `tests/test_voice_render.py` (fake engine, 9, written before the module): render all and manifest, second run renders none and leaves the manifest byte-identical, one changed line renders exactly one (AC12), a missing file re-renders, a removed line deletes files and entry but not `README.md`, adapter-version mismatch refused with nothing written, loudness and peak after encoding, an engine failure naming the line, the CLI refusing a missing jobs file.
- **Beats.** `intro.opening` (grave): spoken `[sigh] The opening of the story goes here.`; `source.sighted` (tense): `The Source of the blight comes into sight.` The `{leader}` beat is unvoiced. The `[sigh]` is the narrator's only emotional device on Turbo; the tense line has no tag (judge at G10).
- **Words spelled alike, said differently.** Checked both spoken texts for winds, wound, read, lead, live, close, tear, bow, row, bass, minute, sow, does and similar: none occur ("goes", "opening", "Source", "blight", "sight" are not heteronyms), so nothing was respelled. The clip's own reference text still holds "winds", a design-time sentence only.
- **c22.** No shipped line uses bake-off clip c22's text; no re-take needed.
- **Render.** `npm run narration`: `rendered intro.opening: 2.71 s, -18.0 LUFS-I, -1.70 dBTP`, `rendered source.sighted: 2.76 s, -18.0 LUFS-I, -1.57 dBTP`, `rendered 2, skipped 0, deleted 0` (about 20 s with the model cached). Second run: `rendered 0, skipped 2, deleted 0`. Files: `intro.opening.opus` 10,671 B and `.mp3` 18,068 B; `source.sighted.opus` 10,799 B and `.mp3` 19,412 B (budget 4,000,000 per format). The Opus files decode to -18.6 and -18.7 LUFS-I (voip codec), within 1 LU.
- **Experiment.** Editing `source.sighted`'s `spoken` made `npm test` fail naming `source.sighted` and `npm run narration` rendered exactly one line; reverted, and the files and manifest restored byte for byte (a further run rendered 0).
- **Vitest.** `narration.test.ts`: the real-content test now hashes with the real clip hashes and `audio.toml`'s `[voice]` (it passed before only because no beat was voiced); added: an edited real beat is stale, and the voice files stay within the per-format budget.
- **Docs.** Design §5.8.3 item 3 and §5.8.4 and the adapter bullet of §5.8.5 now say what G1 and G9 built; `public/assets/voice/README.md` (models, revisions, licences rechecked 2026-11-14, PerTh note: the mlx port adds none, network on first load, the lines table); root `CLAUDE.md` (Commands row, assets paragraph) and `audio/CLAUDE.md` (a render section and the heteronym rule).
- **Verification.** `uv run --project tools/audio pytest tools/audio/tests`: 246 passed. `npm test`: 86 files, 1668 tests passed. `npm run sounds:check`: 85 cues and 4 banks up to date, within budget.
- **G10 (awaiting the user).** Listen to `audio/.audition/16-render/intro.opening.opus` and `source.sighted.opus` (the MP3s beside them). Judge pronunciation and whether the grave line's `[sigh]` and the tense line carry their emotion; a flaw is fixed by bumping `take` (at most three) and running `npm run narration`.
