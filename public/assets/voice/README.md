# Narration voice files

`<line>.opus` (mono, 32 kbps, Opus speech) and `<line>.mp3` (mono, VBR `-q:a 7`) for each voiced cutscene beat, loaded by the game as `voice_<line>`. They are generated, never edited by hand: give a beat in `src/story/cutscenes.ts` a `line`, `voice` and `emotion`, then run `npm run narration`, which renders only the lines whose inputs changed and records them in `audio/voice.manifest.json`. `npm test` fails while a voiced beat and the manifest disagree. See `audio/CLAUDE.md`.

## How they are made

- **Voice.** The narrator is designed from a text description by Qwen3-TTS VoiceDesign and clones no real person: "A weathered storyteller in his fifties: low, warm, slightly gravelled, unhurried; neutral British accent; close and dry, no room." Its one reference clip is `audio/voices/narrator/neutral.flac` (VoiceDesign seed 7, source `voice_narrator_neutral` in `audio/sources.toml`).
- **Engine.** Chatterbox Turbo clones that clip and speaks the line. Turbo ignores exaggeration, so a line's emotion comes from its wording and sound tags such as `[sigh]`, not from a setting. Words said differently from how they are spelled are respelled in the beat's `spoken`.
- **Post-processing** (`audio/audio.toml` `[voice]`): high-pass 70 Hz, trimmed with 120 ms before and 250 ms after, normalised to -18 LUFS-I, true peak at most -1.5 dBTP.

## Models, revisions and licences

Licences rechecked on the Hugging Face cards on 2026-11-14 (they were last checked then; recheck on any revision change).

| Role | Loaded (mlx-audio 0.6.5) | Revision | Upstream | Licence |
| --- | --- | --- | --- | --- |
| Narrator engine | `mlx-community/chatterbox-turbo-fp16` | `b2d0a13aa7cfff0a06d9acb247ae91c8f19a6d75` | `ResembleAI/chatterbox-turbo` | MIT |
| Clip design | `mlx-community/Qwen3-TTS-12Hz-1.7B-VoiceDesign-bf16` | `7d3824abff87e49756bb0f83fb5411de75d160c4` | `Qwen/Qwen3-TTS-12Hz-1.7B-VoiceDesign` | Apache-2.0 |
| Fallback engine (not used for shipped lines) | `mlx-community/Qwen3-TTS-12Hz-1.7B-CustomVoice-bf16` | `52f4770fd9726457eae3d3b6aa92047a25a10776` | `Qwen/Qwen3-TTS-12Hz-1.7B-CustomVoice` | Apache-2.0 |

The mlx-community conversions are tagged Apache-2.0 on their cards; the upstream model's licence is the one relied on. All allow generated audio in a commercial game. The original `chatterbox` package marks its output with Resemble AI's inaudible PerTh watermark; **the mlx port used here adds no watermark**. A render needs network the first time a model loads (weights go to `~/.cache/huggingface/`, never into the repository).

## Lines

| Line | Cutscene | Emotion | Spoken |
| --- | --- | --- | --- |
| `intro.opening` | `intro` | grave | "[sigh] The opening of the story goes here." |
| `source.sighted` | `source_sighted` | tense | "The Source of the blight comes into sight." |

Words checked for a spelling said differently (winds, wound, read, lead, live, close, tear, bow, row, bass): none occur.
