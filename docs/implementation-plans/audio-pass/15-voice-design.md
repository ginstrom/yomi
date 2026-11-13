# Step 15: Narrator voice design

[Index](index.md) · [Design](../../designs/audio-pass.md) §5.8.2 to §5.8.4 · Feature record: [`docs/features/audio-pass.md`](../../features/audio-pass.md)

## Objective

Design the chosen narrator's voice in full: from the neutral clip the user kept at gate G1, render emotion reference-clip candidates with Qwen3-TTS VoiceDesign, filter them by speaker similarity, and lay them out for the user to pick (gate G9). Finalise `audio/voices.toml` for the narrator. Covers R13 and part of AC13. The clips are **not** committed in this step: step 16 commits the user's picks.

**Do not run this step if G1's outcome was "none passes".** Then narration ships as framework only and the engine choice goes back to the user (design §5.8.6).

## Requirements and context

- R13: each voice is designed from a text description (Qwen3-TTS VoiceDesign) into reference clips per emotion; no real person's voice is cloned. The bake-off (step 03, gate G1) gated adopting an engine.
- AC13 (this step's part): `voice design` prints each emotion clip's speaker similarity to neutral; a clip below 0.75 is never offered. The provenance entry for each committed clip (design model, revision, description, seed) is written in step 16 from what this step records.
- **G1's outcome** is recorded in the feature record's decision log (by the orchestrator): the configuration chosen (a: Chatterbox with emotion clips and exaggeration; b: Chatterbox Turbo with tags; c: Qwen3-TTS CustomVoice with instructions), the narrator (A, the weathered male storyteller; B, the woman in her forties), and the neutral candidate kept (e.g. `B_2`, a file under `audio/bakeoff/neutral_candidates/`). Read it there before starting; if anything is missing, stop and report it as a blocker.
- Narrator descriptions (design §5.8.2):
  - A: "A weathered storyteller in his fifties: low, warm, slightly gravelled, unhurried; neutral British accent; close and dry, no room."
  - B: "A woman in her forties: low, resonant, measured, a little husky; neutral British accent; close and dry."
- The narrator declares the emotions `neutral`, `warm`, `grave`, `tense`, `sad`, `triumphant`, `whisper` (all but `afraid` and `angry`).
- Emotion instructions (design §5.8.4; also in step 03's `EMOTION_MAP`):

  | Emotion | Qwen3 instruction |
  | --- | --- |
  | `neutral` | "Speak calmly and evenly, as a storyteller." |
  | `warm` | "Warm, gentle and reassuring." |
  | `grave` | "Low, solemn and slow, with gravity." |
  | `tense` | "Tense and urgent, hushed but quick." |
  | `sad` | "Sorrowful and subdued, slow." |
  | `triumphant` | "Triumphant and rousing, ringing." |
  | `whisper` | "Whispering, breathy and close." |

- If configuration (c) (Qwen3-TTS CustomVoice alone) was chosen, the engine clones nothing: emotion clips are not needed for rendering. Still produce the neutral clip's record and the `[narrator.fallback]`/preset fields; render emotion candidates only if the user asked for them at G1, and say so in the execution record. Under (a) or (b) the clips are what Chatterbox clones from (`audio_prompt` = the line's emotion clip; Turbo uses the neutral clip only, so under (b) only `neutral` is required and the emotion candidates are optional).

## Shared constraints (from the index)

- Machine: Apple M5, macOS, `uv`, `ffmpeg` 9. Node commands need `PATH=/opt/homebrew/opt/node@26/bin:$PATH`.
- TTS dependencies live only in the `tts` extra: `uv run --project tools/audio --extra tts yomi-audio …`. `sounds:check` never installs them.
- **Model weights** stay in the Hugging Face cache (`~/.cache/huggingface/`), never under the repository. They were downloaded in step 03; nothing new should be needed unless G1 changes the model.
- Licences: never clone a real person's voice; voices come only from VoiceDesign descriptions. Recheck the chosen model card's licence at adoption and record it.
- Gitignored: `audio/bakeoff/`, `audio/.audition/`, `audio/narration.jobs.json`, `tools/audio/.venv/`.
- No battle or world RNG, no save or log schema change. No scene changes in this step.
- Commit: one commit, `Audio pass step 15: Narrator voice design`, on `audio-pass`, after `npm test` and `npm run sounds:check` pass; do not push.

## Dependencies and prerequisites

- **Step 03** (existing after it lands): the TTS adapters in `tools/audio/yomi_audio/tts/` per contract C10, including `qwen3_design.design(description, text, instruction, seed)`, `EMOTION_MAP`, and a minimal `yomi-audio voice design`; the narrators' bake-off material in `audio/bakeoff/` (`neutral_candidates/`, `designed/`, `key.json`).
- **Gate G1** answered and recorded (above).
- **Step 14**: the provisional `audio/voices.toml` and `src/story/narration.ts` (`readVoices`, `VoiceRegistry`, `EMOTIONS`) with its test that `VoiceId` and `Emotion` match `voices.toml`.

Contract C10 (copy of the index; do not change):

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

Contract C2 (command, from the index): `yomi-audio voice design <voice> [--emotions E,…] [--candidates N]`, 03 (minimal), 15 (full). Every command takes `--root <dir>` (default the repository's `audio/`) and exits non-zero with a message naming what is at fault.

Contract C4, a reference clip's source entry (written in step 16, recorded here):

```toml
[[source]]
id = "voice_narrator_grave"
file = "voices/narrator/grave.flac"
licence = "own"
author = "generated: Qwen3-TTS VoiceDesign (Apache-2.0)"
design = { model = "…", revision = "…", seed = 7, description_ref = "voices.toml#narrator", instruction = "…", text = "…" }
sha256 = "…"
```

Contract C11, `audio/voices.toml` (design §5.8.2):

```toml
adapter_version = 1

[narrator]
engine = "chatterbox"                # chatterbox | chatterbox_turbo | qwen3_custom
model = "ResembleAI/chatterbox"      # verified at adoption
revision = "<pinned HF commit>"
emotions = ["neutral", "warm", "grave", "tense", "sad", "triumphant", "whisper"]
params = { cfg_weight = 0.5, temperature = 0.8 }

[narrator.design]                    # how the reference clips were made
model = "Qwen/Qwen3-TTS-…-VoiceDesign"
revision = "<pinned HF commit>"
description = "…"
reference_text = "…"                  # a fixed phonetically rich passage of about 9 s, read for every emotion
seed = 7

[narrator.clips]
neutral = "voices/narrator/neutral.flac"
# … one per declared emotion (paths filled; files land in step 16)

[narrator.fallback]
engine = "qwen3_custom"
model = "Qwen/Qwen3-TTS-…-CustomVoice"
revision = "<pinned HF commit>"
preset = "<the preset nearest the design, chosen in the bake-off>"
```

`lineHash` (C11) includes the voice table and the SHA-256 of each clip; no beat is voiced yet (step 16 voices them), so changing `voices.toml` makes nothing stale. Step 14's tests must still pass: `readVoices` parses the file, and `VoiceId`/`Emotion` match it. A clip path named in `[narrator.clips]` whose file does not exist yet must not fail `npm test` while no beat is voiced; if step 14's test does fail on it, list only `neutral` (whose candidate file you copy only into the gitignored audition folder) and have step 16 add the rest, recording the deviation.

## Scope and implementation guidance

`tools/audio/yomi_audio/` (the voice-design command, proposed `voice/design.py` or extending step 03's module), `tools/audio/tests/`, `audio/voices.toml`, `audio/CLAUDE.md`.

1. **Neutral reference.** Take the kept candidate from G1 (e.g. `audio/bakeoff/neutral_candidates/B_2.wav`) and the seed it was rendered from (from `key.json` or step 03's record: seeds `seed`…`seed+3`). Process it as a reference clip: trim silence, mono, 48 kHz (or the engine's rate, recorded), normalise to −18 LUFS-I, and write it to `audio/.audition/15-voice/neutral.wav`. Record its seed; that seed becomes `[narrator.design].seed`.
2. **`voice design <voice>` in full** (design §5.8.3):
   - Reads the voice's table from `voices.toml` (description, `reference_text`, seed, declared emotions).
   - `--emotions` restricts the emotions (default: every declared one but `neutral`); `--candidates N` (default 4).
   - A neutral reference is required: either `--neutral <wav>` or the existing `voices/<voice>/neutral.flac`; without it the command refuses, naming the missing file.
   - For each emotion: N VoiceDesign renders of `reference_text` from the description plus the emotion's instruction (above), seeds `seed`…`seed+N-1`; each candidate post-processed as in 1.
   - **Speaker similarity** of each candidate to the neutral reference: cosine of Chatterbox's own voice-encoder embeddings. Candidates below **0.75** are discarded (logged, not written). The rest are written as `audio/.audition/15-voice/<emotion>_<k>.wav` (k = candidate index).
   - Writes `audio/.audition/15-voice/review.md`: a table per emotion of candidate, seed, similarity, loudness and length, and how to answer (one pick per emotion, or "none, redo with seed …"). Prints the same.
   - If an emotion has no candidate at or above 0.75, it says so and the step tries more seeds (`--candidates 8`) before reporting it in the gate.
   - Deterministic for a fixed seed and pinned revision as far as the model allows; record if it is not.
3. **Pin and recheck.** For the VoiceDesign model, the chosen engine's model (Chatterbox, Chatterbox Turbo or Qwen3 CustomVoice per G1) and the fallback: pin the Hugging Face commit revisions; read each model card's licence again and record model id, revision, licence and the date checked in the execution record (step 16 copies it into `public/assets/voice/README.md`). If a licence no longer allows generated audio in a commercial game, stop and report it as a blocker.
4. **Finalise `audio/voices.toml`** for the chosen narrator: its description (A or B), `reference_text`, design model and pinned revision, seed, the engine and model and pinned revision from G1 (configuration a → `chatterbox`; b → `chatterbox_turbo`; c → `qwen3_custom` with `preset`), `params`, the declared emotions, `[narrator.clips]` paths, and `[narrator.fallback]` (Qwen3 CustomVoice with the preset nearest the design, as noted in the bake-off). Keep `adapter_version` as step 03 set it.
5. **Tests** (pytest, no model needed: fake the design engine and the encoder): candidates below 0.75 are discarded; file naming and `review.md` content; `--emotions` and `--candidates` honoured; refusal without a neutral reference; the instruction appended per emotion matches `EMOTION_MAP`.
6. **`audio/CLAUDE.md`:** a "Designing a voice" section: the command, where candidates go, the 0.75 threshold, that the user picks by ear, and that a new fixed character is a new table in `voices.toml`, its clips and beats naming it (design §5.8.2).

Exclusions: no clip under `audio/voices/` is committed and no `sources.toml` entry is written (step 16 does both from G9's picks); no `voice render`; no beat gains `line`; no scene or runtime change.

## Verification

- `uv run --project tools/audio pytest tools/audio/tests`: the new tests pass (seen failing first).
- `uv run --project tools/audio --extra tts yomi-audio voice design narrator --neutral audio/.audition/15-voice/neutral.wav` runs on this machine and writes `audio/.audition/15-voice/<emotion>_<k>.wav` for six emotions with similarity ≥ 0.75, and `review.md`. Record the printed table in the execution record. Look at spectrograms or levels to catch empty or clipped renders before the gate.
- `PATH=/opt/homebrew/opt/node@26/bin:$PATH npm test` passes (step 14's voices tests read the final `voices.toml`).
- `npm run sounds:check` passes (unchanged SFX).
- `git status` shows no file under `audio/.audition/`, `audio/bakeoff/` or the HF cache staged.

## Completion criteria

- [ ] G1's outcome read from the feature record and restated in the execution record.
- [ ] `voice design` complete per design §5.8.3, with tests.
- [ ] Candidates and `review.md` in `audio/.audition/15-voice/`; every offered candidate ≥ 0.75 similarity.
- [ ] `audio/voices.toml` final for the chosen narrator, revisions pinned; licences rechecked and recorded.
- [ ] `audio/CLAUDE.md` updated; one commit; index status set to `awaiting review` with the hash.
- [ ] **Gate G9:** the user's pick per emotion (or a redo instruction) relayed and recorded here; then `done`. Step 16 needs: the picked file per emotion, its seed and similarity, and the pinned revisions and licences recorded above.

## Execution record
