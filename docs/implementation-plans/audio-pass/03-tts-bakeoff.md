# Step 03: TTS adapters and bake-off

[Index](index.md) · [Design](../../designs/audio-pass.md) §5.8.3, §5.8.4, §5.8.5 (adapter), §5.8.6 · [Brief](../../architecture/audio-pass.md) §4

## Objective

Put the narration engines behind one adapter in `tools/audio/`, design the two candidate narrators (A and B) from text descriptions, and render the listening test: 32 blind clips with a key, a scoring sheet and the neutral candidates, so the user can choose the engine configuration and the narrator (gate **G1**). Covers R13 and AC13's bake-off part. Nothing shipped is rendered in this step.

**Judgement-heavy:** model integration on Apple Silicon, licence checks, and choosing settings that give each configuration a fair hearing.

## Requirements and context

- **R13:** each voice is designed from a text description (Qwen3-TTS voice design) into reference clips per emotion; no real person's voice is cloned. A listening test on real lines gates adopting an engine.
- **D3 (feature record):** Chatterbox primary (cloning from clips made by Qwen3-TTS VoiceDesign), Qwen3-TTS CustomVoice fallback, behind an adapter; a listening test first.
- **Licences:** Chatterbox (Resemble AI) is stated MIT; Qwen3-TTS is Apache-2.0. Both must be **rechecked on each model card** at this step (licences have changed before); a model whose card does not plainly allow its generated audio in a commercial game is not used, and the step stops and reports. Chatterbox's output carries an inaudible PerTh watermark; note it.
- **Narrators** (design §5.8.2), each reading a fixed phonetically rich passage of about 9 s (`reference_text`, choose one and record it; the same text for both narrators and every emotion):
  - **A:** "A weathered storyteller in his fifties: low, warm, slightly gravelled, unhurried; neutral British accent; close and dry, no room."
  - **B:** "A woman in her forties: low, resonant, measured, a little husky; neutral British accent; close and dry."
- **Emotion mapping** (design §5.8.4), the adapter's `EMOTION_MAP`:

  | Emotion | Clip | Exaggeration (0 → 1) | cfg_weight | Qwen3 instruction |
  | --- | --- | --- | --- | --- |
  | `neutral` | neutral | 0.35 → 0.50 | 0.50 | "Speak calmly and evenly, as a storyteller." |
  | `warm` | warm | 0.40 → 0.60 | 0.50 | "Warm, gentle and reassuring." |
  | `grave` | grave | 0.40 → 0.65 | 0.45 | "Low, solemn and slow, with gravity." |
  | `tense` | tense | 0.50 → 0.80 | 0.40 | "Tense and urgent, hushed but quick." |
  | `afraid` | afraid | 0.60 → 0.90 | 0.35 | "Frightened, breath unsteady." |
  | `angry` | angry | 0.60 → 1.00 | 0.30 | "Angry and forceful, clipped." |
  | `sad` | sad | 0.40 → 0.70 | 0.45 | "Sorrowful and subdued, slow." |
  | `triumphant` | triumphant | 0.60 → 0.90 | 0.35 | "Triumphant and rousing, ringing." |
  | `whisper` | whisper | 0.30 → 0.50 | 0.50 | "Whispering, breathy and close." |

  Exaggeration is interpolated by `intensity` (default 0.5). The Qwen3 fallback words intensity into the instruction: "slightly" below 0.34, nothing to 0.67, "very" above. Nonverbal tags render only with `chatterbox_turbo`, which ignores exaggeration.
- **Bake-off lines** (design §5.8.6), in order, with their emotion:
  1. neutral: "Each day the blight creeps a little further from the east, and each day the land remembers less of what it was."
  2. warm: "Rest here a while. The fire is small, but it is ours, and it will see us through the night."
  3. grave: "Three were lost at the ford. Their names are written now in the guild hall's book, and nowhere else."
  4. tense: "Something moves beyond the ridge. Too many feet, too quiet, and coming this way."
  5. triumphant: "The Horror falls, and for the first time in a hundred days the wind from the east smells of rain."
  6. sad: "The watchtower stood for a season. Now only its stones remember the hands that raised them."
  7. whisper: "Listen. Under the wind... the Source is breathing."
  8. neutral (names and a question): "Who will hold the encampment when the hobgoblins come down past the Salamander Pool, and the kobolds crawl from their warrens?"
- **Configurations:** (a) Chatterbox cloning narrator A's emotion clip for the line's emotion, with that emotion's exaggeration and cfg_weight; (b) Chatterbox Turbo cloning A's neutral clip, lines 3, 6 and 7 carrying `[sigh]` (placed where natural, e.g. at the start); (c) Qwen3-TTS CustomVoice, the preset nearest narrator A (chosen by the engineer, recorded) with the line's instruction; (d) narrator B on configuration (a). 4 × 8 = **32 clips**.
- **The gate** (design §5.8.6): a configuration is adoptable when its mean naturalness is at least 4.0, its mean emotion fit at least 3.5, every clip is the same voice, and every artifact is fixed by at most three takes. The user chooses; only then are shipped lines rendered (steps 15 and 16).

## Dependencies and prerequisites

- **Step 01** (done before this one) provides the uv project `tools/audio/` (package `yomi_audio`, CLI `yomi-audio`, `--root`), the DSP and loudness code (LUFS-I, true peak at 4x), `audio/audio.toml` with its `[voice]` table (C3), `audio/CLAUDE.md`, and the `.gitignore` entries for `audio/bakeoff/` and `audio/.audition/`. Reuse its loudness and filter code; do not duplicate it.
- Not needed: steps 02, 04 onwards. Step 14 (the Node-side voice registry) is independent; this step does **not** write `audio/voices.toml`.
- Environment: Apple M5, macOS, `uv`, `ffmpeg`; network for model downloads (several GB) into the Hugging Face cache `~/.cache/huggingface/`, **never under the repository**. Node commands prefixed `PATH=/opt/homebrew/opt/node@26/bin:$PATH`.

## Contracts (copied from the index; do not change)

C2 (excerpt): TTS dependencies only in the optional extra `tts` (`uv run --project tools/audio --extra tts …`), so `sounds:check` never installs torch or mlx. Every command takes `--root <dir>` (default the repository's `audio/`) and exits non-zero with a message naming what is at fault. Commands this step adds: `yomi-audio voice bakeoff` (the listening test, C10) and `yomi-audio voice design <voice> [--emotions E,…] [--candidates N]` (minimal here, full in step 15). Pedalboard (GPL) is not used.

C10:

```python
# tools/audio/yomi_audio/tts/base.py
@dataclass(frozen=True)
class RenderJob:
    text: str                       # spoken text, tags included where allowed
    emotion: str
    intensity: float                # 0..1
    seed: int
    voice: dict                     # the voice's resolved table from voices.toml (engine, model, revision, params, ...)
    reference_clip: Path | None     # chatterbox engines: the emotion's clip
    instruction: str | None         # qwen3 engines
class Engine(Protocol):
    name: str
    def render(self, job: RenderJob) -> tuple[np.ndarray, int]: ...   # mono float32 PCM, sample rate
    def fingerprint(self) -> dict: ...                                 # engine, model repo, pinned revision, quantisation, adapter version
# engines, one module each: chatterbox, chatterbox_turbo, qwen3_custom, qwen3_design
# qwen3_design also: design(description: str, text: str, instruction: str | None, seed: int) -> tuple[np.ndarray, int]
EMOTION_MAP   # design §5.8.4 table: clip, exaggeration (lo, hi), cfg_weight, instruction
```

- `yomi-audio voice bakeoff` writes into `audio/bakeoff/`: 32 blind clips `<label>.wav` (labels `c01`…`c32`, shuffled), `key.json` (label → line number, configuration a/b/c, narrator A/B), `score.md` (a row per clip: naturalness 1–5, emotion fit 1–5, same voice as its line 1 y/n, artifact y/n and note), `neutral_candidates/A_0.wav`…`A_3.wav`, `B_0.wav`…`B_3.wav`, and `designed/` (the clips the configurations cloned from). Lines, configurations and the gate: design §5.8.6.

Note on `key.json`: configuration (d) is "configuration a, narrator B", so its entries read `{ "line": n, "configuration": "a", "narrator": "B" }`.

C3 `[voice]` (post-processing every rendered clip, bake-off included): high-pass 70 Hz; trim silence below −50 dB keeping 120 ms before and 250 ms after; normalise to −18 LUFS-I with true peak at most −1.5 dBTP.

## Scope and implementation guidance

Proposed paths (none exist yet):

- `tools/audio/pyproject.toml`: add `[project.optional-dependencies] tts = [...]` (mlx-audio, and the Chatterbox and Qwen3-TTS packages or torch as needed), locked in `uv.lock`. The base install must stay free of them: verify `uv run --project tools/audio yomi-audio --help` and the step-01 pytest run without the extra.
- `tools/audio/yomi_audio/tts/base.py`: `RenderJob`, `Engine`, `EMOTION_MAP`, the intensity interpolation and the Qwen3 intensity wording as pure functions; `ADAPTER_VERSION = 1`.
- `tools/audio/yomi_audio/tts/{chatterbox,chatterbox_turbo,qwen3_custom,qwen3_design}.py`: one engine each, importing heavy packages **inside** the module's load/render path so that `base.py` and the CLI import without the extra. Prefer mlx-audio (it lists `chatterbox-fp16` and Qwen3-TTS); fall back to the PyTorch package on MPS for a model mlx-audio lacks (likely Chatterbox Turbo). Record which backend each engine uses.
- `tools/audio/yomi_audio/tts/models.py` (or similar): the **pinned model config** for the bake-off: repo ids and Hugging Face commit hashes for Chatterbox, Chatterbox Turbo, Qwen3-TTS CustomVoice (1.7B) and Qwen3-TTS VoiceDesign, plus quantisation. These pins live in code until step 15 copies the chosen ones into `audio/voices.toml`.
- `tools/audio/yomi_audio/tts/similarity.py`: speaker similarity as the cosine between Chatterbox's voice-encoder embeddings.
- `tools/audio/yomi_audio/voice.py` (or under `cli.py`): the `voice design` and `voice bakeoff` commands; reuse step 01's loudness, filters and WAV writing for the `[voice]` post-processing.
- Minimal `voice design <voice>` for the bake-off (narrators `A` and `B` are defined in the bake-off config, not `voices.toml`):
  1. Neutral: VoiceDesign renders `reference_text` from the description with seeds `seed`…`seed+3` (N = 4, `--candidates`), post-processed; written as the neutral candidates. For the bake-off, candidate 0 is the neutral clip used.
  2. Emotions: for each emotion needed by the lines (neutral, warm, grave, tense, triumphant, sad, whisper), VoiceDesign renders the same text from the same description and seed with the emotion's instruction appended, N = 4; similarity of each to the neutral clip is measured; candidates below 0.75 are discarded; the one of highest similarity is kept **automatically** (step 15 replaces this with the user's pick). If none reaches 0.75, keep the best, flag it in the output and in `score.md`'s header.
  3. Print each candidate's similarity; write the kept clips to `audio/bakeoff/designed/<narrator>/<emotion>.wav`.
- `voice bakeoff`: designs A and B (above) unless `designed/` already holds them (`--redesign` to force), renders the 32 clips with seeds fixed per line and configuration, post-processes, shuffles labels with a fixed seed, writes C10's files. `score.md` opens with how to score (the four measures and the gate's thresholds) and a table `| Label | Naturalness 1–5 | Emotion fit 1–5 | Same voice as line 1 (y/n) | Artifact (y/n, note) |` with an empty row per label; `key.json` is not opened by the user until scoring is done (say so at the top of `score.md`).
- `audio/CLAUDE.md`: add a "Narration tooling" section: the `tts` extra, the engines and backends, where weights live (`~/.cache/huggingface/`, never committed), the pinned models with their licences as checked (date, card URL), the watermark, and how to run `voice bakeoff`.
- Exclusions: no `audio/voices.toml` (step 14 writes it; step 15 finalises it), no committed clips, no `voice render`, no game or `src/` change.

## Verification

- Tests first: `uv run --project tools/audio pytest tools/audio/tests` with **fake engines only** (no weights, no network): `EMOTION_MAP` matches the table; intensity interpolation of exaggeration at 0, 0.5, 1; Qwen3 intensity wording at 0.2, 0.5, 0.8; `voice design`'s selection (discards below 0.75, keeps the highest, flags when none passes) over a fake encoder; `voice bakeoff` over fake engines writes exactly 32 `c01`…`c32` WAVs, a `key.json` mapping each label to one of the 32 (line, configuration, narrator) triples once, lines 3, 6, 7 of configuration (b) carry `[sigh]` and no other job does, `score.md` with 32 rows, 8 neutral candidates and `designed/`; every written clip meets the `[voice]` loudness and peak (−18 ± 1 LUFS-I, ≤ −1.5 dBTP); label shuffling is deterministic.
- Base install unaffected: the pytest run above and `uv run --project tools/audio yomi-audio sfx audition --help` work without `--extra tts`.
- The real run: `uv run --project tools/audio --extra tts yomi-audio voice bakeoff`. Record wall time, peak memory if notable, every clip's LUFS-I and true peak, the similarity table, and the model pins. Look at a spectrogram of a few clips to catch silence, clipping or truncation (the agent cannot listen).
- `git status` shows nothing under `audio/bakeoff/` and no weights in the repository; `du -sh ~/.cache/huggingface` recorded.
- `PATH=/opt/homebrew/opt/node@26/bin:$PATH npm test` still passes (nothing in `src/` changes). No scene changes, so `npm run test:browser` is not required.

## Completion criteria

- [ ] Each model card's licence rechecked and recorded (URL, date, licence, commercial use of output); revisions pinned in code and in `audio/CLAUDE.md`.
- [ ] C10 exists as written; the `tts` extra keeps the base install light.
- [ ] `audio/bakeoff/` holds the 32 clips, `key.json`, `score.md`, `neutral_candidates/` (8) and `designed/`, all post-processed to the `[voice]` targets.
- [ ] pytest and `npm test` pass; one commit `Audio pass step 03: TTS adapters and bake-off` (code, lock, `audio/CLAUDE.md`; no clips).
- [ ] Index status set to `awaiting review` with the commit hash, and the step handed to gate **G1**:
  - **The user** listens to the 32 blind clips in `audio/bakeoff/` and fills `score.md`, then listens to `neutral_candidates/`.
  - **Needs back:** the filled score sheet; the configuration chosen (a, b or c) and the narrator (A or B), or "none passes"; the neutral candidate kept for that narrator (e.g. `B_2`).
  - The orchestrator records the choice in the feature record's decision log. If "none passes", steps 15 and 16 are not run and the engine choice returns to the user.
- [ ] After G1: the outcome copied into the execution record (with the gate's computed means per configuration from `score.md` and `key.json`), and the index status set to `done`.

## Execution record

### Run 1 (2026-11-14): built, rendered, handed to G1

Run before step 02 by the orchestrator's order (it depends only on 01).

**Licences, rechecked on each card on 2026-11-14** (the cards' YAML `license` and text; nothing restricts generated audio):

| Model (upstream card) | Commit | Licence | Output in a commercial game |
| --- | --- | --- | --- |
| [ResembleAI/chatterbox](https://huggingface.co/ResembleAI/chatterbox) | `5bb1f6ee58e50c3b8d408bc82a6d3740c2db6e18` | MIT | allowed; card only asks "don't use this model to do bad things" |
| [ResembleAI/chatterbox-turbo](https://huggingface.co/ResembleAI/chatterbox-turbo) | `749d1c1a46eb10492095d68fbcf55691ccf137cd` | MIT | allowed |
| [Qwen/Qwen3-TTS-12Hz-1.7B-CustomVoice](https://huggingface.co/Qwen/Qwen3-TTS-12Hz-1.7B-CustomVoice) | `0c0e3051f131929182e2c023b9537f8b1c68adfe` | Apache-2.0 | allowed |
| [Qwen/Qwen3-TTS-12Hz-1.7B-VoiceDesign](https://huggingface.co/Qwen/Qwen3-TTS-12Hz-1.7B-VoiceDesign) | `5ecdb67327fd37bb2e042aab12ff7391903235d3` | Apache-2.0 | allowed |

Loaded (all through **mlx-audio 0.6.5**, MLX on Apple Silicon; no PyTorch needed, as mlx-audio has Chatterbox Turbo too): `mlx-community/chatterbox-fp16` `4923fcca…`, `mlx-community/chatterbox-turbo-fp16` `b2d0a13a…`, `mlx-community/Qwen3-TTS-12Hz-1.7B-CustomVoice-bf16` `52f4770f…`, `mlx-community/Qwen3-TTS-12Hz-1.7B-VoiceDesign-bf16` `7d3824ab…` (full hashes in `tools/audio/yomi_audio/tts/models.py`; the conversions' cards say Apache-2.0, the upstream licence is the one relied on). The PyTorch `chatterbox-tts` package was not usable anyway: it pins `numpy<2` on Python 3.11 against the tool's `numpy>=2`.

**Watermark:** the cards say every Chatterbox output carries Resemble's PerTh watermark. That is done by Resemble's own package; the mlx-audio port has no PerTh code, so these clips carry **no** watermark. Recorded in `audio/CLAUDE.md`; step 16 says so in `public/assets/voice/README.md`.

**Built** (test-first, fake engines only): `tools/audio/yomi_audio/tts/` (`base.py` with C10 as written, `ADAPTER_VERSION = 1`, `EMOTION_MAP`, `exaggeration`, `qwen_instruction`; `chatterbox.py`, `chatterbox_turbo.py`, `qwen3_custom.py`, `qwen3_design.py` with `design(...)`; `models.py` pins; `similarity.py`, cosine over Chatterbox's voice-encoder embedding, 256-d; `_mlx.py`, the shared lazy loader), `tools/audio/yomi_audio/voice.py` (`postprocess`, `select_candidate`, `design_voice`, `bakeoff`), CLI `voice design <A|B> [--emotions] [--candidates]` and `voice bakeoff [--redesign]`, extra `tts = ["mlx-audio==0.6.5"]` in the lock. Tests: `tests/test_tts_base.py` (16), `tests/test_voice.py` (15).

**Choices** (routine, recorded):

- `reference_text`: "The old road winds north past the quiet village and over the bridge. Judge for yourself whether the thick smoke rising there means a hearth, or a warning." Read slowly by the storyteller voices it runs 9.0 to 12.2 s after trimming (Chatterbox Turbo needs more than 5 s of reference; Chatterbox uses the first 10 s).
- Narrator design seed 7 (candidates 7 to 10). Neutral is candidate 0 of the description alone (design §5.8.3), so the neutral emotion is not designed separately; the six other emotions append their instruction to the description. Bake-off render seeds: first 32 bits of SHA-256 of `bakeoff:<configuration>:<narrator>:<line>`. Label shuffle seed 20261114.
- Configuration (c)'s preset: **Ryan**, the English-native male speaker ("dynamic male voice with strong rhythmic drive"); Uncle_Fu ("seasoned, low, mellow") is nearer A's timbre but Chinese-native, Aiden is "sunny American".
- `[sigh]` opens lines 3, 6 and 7 of configuration (b).
- Qwen3 intensity wording: "Slightly so. " or "Very much so. " before the instruction (below 0.34, above 0.67). The bake-off uses intensity 0.5, so no wording.
- Post-processing (`[voice]`): resample to 48 kHz, 70 Hz high-pass (4th order), normalise, trim below −50 dBFS (5 ms hold) keeping 120 ms before and 250 ms after (padding with silence where the source had less), normalise to −18 LUFS-I, then limit at the ceiling less 0.5 dB and renormalise (up to six times), lowering the clip as a last resort. Clips written as 48 kHz 24-bit WAV.
- `key.json` is flat, label → `{line, configuration, narrator, emotion, text, seed, engine fingerprint, adapter_version}`; (d) is `configuration "a", narrator "B"` as the task notes.
- `score.md`: "Same voice as line 1" cannot be judged blind (the listener does not know the sets), so the sheet asks for it in a second pass after opening `key.json`; naturalness, emotion fit and artifacts are scored blind first. The real run's `score.md` was regenerated with this wording by the same function (`_score_sheet`) after the run, without re-rendering the clips.

**The real run:** `uv run --project tools/audio --extra tts yomi-audio voice bakeoff`: exit 0, **24.6 min wall** (1476 s; 646 s user), peak RSS **8.0 GB**. Weights downloaded first into `~/.cache/huggingface/` (`du -sh`: **13 G**). Loading a model still contacts the Hub (an "unauthenticated requests" warning), so a render wants the network on its first load.

Speaker similarity of each emotion candidate to the neutral clip (kept one starred; threshold 0.75; none flagged):

| Narrator | warm | grave | tense | triumphant | sad | whisper |
| --- | --- | --- | --- | --- | --- | --- |
| A | **0.885**, 0.799, 0.802, 0.794 | 0.807, **0.867**, 0.828, 0.825 | **0.832**, 0.792, 0.811, 0.795 | 0.799, **0.872**, 0.842, 0.872 | 0.863, **0.870**, 0.847, 0.826 | 0.814, 0.848, **0.919**, 0.851 |
| B | 0.840, **0.905**, 0.864, 0.849 | **0.899**, 0.885, 0.872, 0.890 | **0.901**, 0.869, 0.886, 0.862 | 0.880, **0.898**, 0.860, 0.867 | 0.852, 0.864, **0.894**, 0.880 | 0.832, 0.863, **0.905**, 0.879 |

(A smoke test before the run measured a Chatterbox clone of a designed clip at 0.95 against it, and a Qwen3 preset voice at 0.70: the encoder separates voices.)

Measurements (`loudness.integrated`, `true_peak_db` at 4x), every file in `audio/bakeoff/`: all 32 clips **−18.00 LUFS-I**, true peak **−4.21 to −1.56 dBTP**, 3.3 to 9.7 s; the 8 neutral candidates −18.00 LUFS-I, −2.36 to −1.50 dBTP, 9.96 to 12.20 s; the 14 designed clips −18.00 LUFS-I, −3.15 to −1.57 dBTP, 8.9 to 12.2 s. All within the `[voice]` targets. Per-label figures are kept out of this record so that it does not unblind the test.

Spectrograms looked at (smoke design clip, five bake-off clips): speech throughout, a low fundamental near 100 Hz for A, no clipping, nothing truncated. Noted, unattributed here so as not to unblind: one clip reads a short line in 9.7 s with long pauses between phrases (speech, not junk); one has a narrow broadband tick just before its end; the whisper-clip clone of one set comes out voiced rather than whispered. The listener judges them.

**Verification:**

- `uv run --project tools/audio pytest tools/audio/tests`: 148 passed (117 before the step).
- Base install without the extra, in a fresh environment (`UV_PROJECT_ENVIRONMENT=<scratch>`): 22 packages, `mlx` and `torch` not installed, `yomi-audio sfx audition --help` works, pytest 148 passed. `test_engines_import_without_the_tts_extra` holds that the engines and CLI import without loading mlx.
- `PATH=/opt/homebrew/opt/node@26/bin:$PATH npm test`: 84 files, 1510 tests passed. No `src/` change, so no browser run.
- `git status`: nothing under `audio/bakeoff/` (ignored by `.gitignore:28`); `git ls-files` holds no weights and no WAV but the eight existing placeholders.

**For later steps:** step 15 reads `voice.py`'s `NARRATORS`, `REFERENCE_TEXT` and `design_voice`, and replaces the automatic pick with the user's; the pins to copy into `voices.toml` are in `tts/models.py` (use the mlx-community repo and revision as `model`/`revision`, the engine fingerprint carries the upstream). Step 16's `voice render` can reuse `postprocess` and the engines as they are. `ADAPTER_VERSION` is 1.

**Status:** awaiting review at gate **G1**.
