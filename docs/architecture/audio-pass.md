# Architecture brief: audio pass (SFX and narration)

**Status:** recommended, awaiting the user's decisions in the last section (D1 to D6). Feature record: `docs/features/audio-pass.md`.

## 1. Context and forces

Two parts, already shaped by the user (feature record, decision log):

1. **Sound effects to indie-game quality.** Built from CC0 recorded samples, layered, pitched and processed by a build script from checked-in text recipes, synthesis where it fits. Scope: replace the placeholders and add variety (weapon family, spell element, ability, footsteps, UI, world-map events), with random variation on each play.
2. **Narration** for cutscenes "and the like", pre-rendered offline by a local emotion-capable TTS model on the author's machine (Apple M5, 32 GB, macOS, Python 3.11 via pyenv, `uv`, `ffmpeg` 9 with libopus and libmp3lame, no sox). The audio is committed and the game only plays files.

Forces:

- **The repository is public** (`github.com/ginstrom/yomi`). Anything committed is redistributed, so raw sources must be licensed for redistribution, not just for use in a product.
- **Reproducibility like the sprites.** `art/` text sources plus a host-installed tool plus a manifest and a `--check` mode is the house pattern (`art/CLAUDE.md`). Generated outputs are committed and never hand-edited.
- **Phaser-free helpers.** What plays when is logic and belongs in `src/scenes/*.ts` helpers testable in the `domain` vitest project (`sounds.ts`, `battleEffects.ts` today); Phaser calls stay thin.
- **Replays and saves must not move.** Sound choice must never draw from the battle's seeded RNG (`mulberry32`), or a replayed battle would diverge.
- **`npm test` stays fast and runs in the podman image**, which has Node and Chromium but no Python, ffmpeg or model weights.
- **Load cost.** `BootScene` decodes every sound into Web Audio buffers at start. Going from 12 keys to a few hundred variants changes boot time and memory if loaded naively.
- **Licence of shipped speech.** The TTS model's licence must allow its generated audio in a commercial game.
- **Templated text.** Cutscene text and speakers contain `{leader}` and `{encampment}`, which are player-chosen at runtime (`fillText`), so they cannot be pre-rendered.

## 2. Current architecture (inspected)

- `public/assets/audio/`: 8 placeholder square-wave/sine WAVs (`sfx_*`), two WAV stings (`music_victory`, `music_defeat`) and two themes as Ogg Opus with an MP3 fallback. `README.md` records provenance; it says the WAVs are placeholders.
- `src/scenes/sounds.ts` (Phaser-free): `SOUND_KEYS` (a closed union `SoundKey`), `soundFiles(key)` (Opus+MP3 for themes, WAV otherwise), `eventSounds(event): SoundCue[]` mapping a `BattleEvent` to `{ key, delayMs }`, outcome cues timed by `impactMs` from `battleEffects.ts`. Constants `SOUND_VOLUME` 0.4, `MUSIC_VOLUME` 0.2.
- `src/scenes/audioSettings.ts` (Phaser-free): channels `master`, `effects`, `music`, saved to `localStorage` under `yomi.audio`; `soundVolume(key)` picks the channel by key prefix. Master is applied as `sound.volume` globally.
- `BootScene.preload` loads every `SOUND_KEYS` entry with `load.audio`.
- Playback: `BattleScene.playSound(key)` and the cue loop over `eventSounds` (`time.delayedCall` for delays); every other scene and `PartyColumn`, `PartyListView`, `panelButton` call `this.sound.play('sfx_ui_click', { volume: soundVolume(...) })` directly, about 25 call sites. `WorldScene` plays only the theme and UI clicks: no world-event sounds. `InventoryScene` plays `sfx_heal` for a world-map cast.
- Event data available for choosing sounds: `AttackEvent` carries `weapon` (a name, or null), `melee`, `distance`, `critical`, `hit`, `ability`/`strike` for routine strikes, `bonus[]` (rune on-hit elements); `CastEvent` names `spell` (whose `SPELLS[id].element` and `hostile` are known); `AbilityEvent` names its ability. `attackLook(event, heldIcon)` already shows the pattern of scene-supplied context: the scene knows the attacker's held `ItemIcon` and `UnitKind`, the event does not carry a weapon family.
- Story: `src/story/cutscenes.ts` (`CUTSCENES`, each with `beats: CutsceneBeat[]` of `text`, `speaker?`, `portrait?`, `backdrop?`), `tutorial.ts` (`TUTORIAL` tips: `id`, `title`, `text`), `story.ts` (`storyFor`, `fillText`). `StoryScene` loads a cutscene's backdrops lazily in its `preload`, shows a beat until click/Space/Enter, Esc skips; it has no audio. All content is placeholder.
- `MenuScene` has three sliders (`SLIDERS`: Master, Sound FX, Music).

## 3. SFX pipeline

### 3.1 Tooling language

| Option | How | For | Against |
| --- | --- | --- | --- |
| A. Node script driving ffmpeg filtergraphs | `scripts/sounds.ts` turns recipes into `ffmpeg` invocations (`adelay`, `amix`, `asetrate`, `highpass`, `afir` for convolution reverb, `acompressor`, `loudnorm`, `aevalsrc`/`anoisesrc` for synthesis) | One language with the rest of `scripts/`; ffmpeg already needed for encoding | Filtergraphs are a poor language for layering, envelopes and synthesis; hard to unit test; debugging is string assembly |
| B. **Python project under uv** (`tools/audio/`, numpy + scipy + soundfile, optional pedalboard), ffmpeg only for final encode | Recipes interpreted by a small DSP library of ours; `uv run` with a committed `uv.lock` | Real DSP (resample, filters, envelopes, convolution, noise synthesis) in a few lines; same toolchain the TTS worker needs anyway; testable with pytest | A second language in the repo; not in the podman image |
| C. A DAW or external tool (e.g. sfxr-like, Reaper projects) | Hand-made | Fast for one-offs | Not text recipes, not reproducible: contradicts the user's decision |

**Recommendation: B.** The narration worker must be Python (every candidate model is Python), so one `uv` project serves both and keeps Node free of DSP. It follows the sprite precedent exactly: a host-only tool, invoked through npm scripts (`npm run sounds` = `uv run --project tools/audio yomi-audio sfx build`, `npm run sounds:check`), outputs and manifest committed. Pedalboard is GPL-3.0; as a build-time tool it does not affect the shipped audio, but to keep it simple prefer scipy for filters and only reach for pedalboard if a needed effect (good reverb, compressor) is too costly to write. Pin Python 3.11 in `.python-version` inside `tools/audio/`.

### 3.2 Sources: committed or fetched

| Option | For | Against |
| --- | --- | --- |
| Commit trimmed CC0 excerpts under `audio/sources/` with a provenance file | Builds are reproducible from a clone; CC0 allows redistribution | Repo grows (budget below) |
| Fetch by manifest (URL + SHA-256) into a gitignored cache | Small repo | Freesound needs an API key and login for originals; Kenney packs are zips; links rot; the build stops being reproducible |
| Non-CC0 royalty-free packs (Sonniss GDC bundles) in a local cache, outputs committed | Large high-quality library | The Sonniss licence allows use in products but not redistribution of the raw files: in a **public** repo they must never be committed, so anyone else cannot rebuild |

**Recommendation:** commit only redistributable sources (CC0: Kenney, Freesound CC0, OpenGameArt CC0, our own recordings and synthesis), trimmed to the part used, mono, as FLAC (lossless, about half of WAV), under a source budget of about 15 MB. Each source has an entry in `audio/sources.toml`: id, file, original URL, author, licence (must be in an allow-list: `CC0-1.0`, `own`), original file name and SHA-256 of the committed excerpt. The build refuses a recipe that names a source without an allowed licence. Sonniss and other non-redistributable packs are left out of v1 (decision D2); if wanted later, they live in a gitignored `audio/sources-local/` with checksum entries flagged `redistributable = false`, and only the derived outputs are committed.

### 3.3 Recipe format and layout (proposed)

Mirror `art/`:

```
audio/                       text sources, like art/
  sources.toml               provenance of every raw source (above)
  sources/*.flac             trimmed CC0 excerpts
  impulses/*.flac            room impulse responses (CC0 or synthesized)
  sfx/<bank>/<cue>.toml      one recipe per cue
  audio.toml                 project settings: sample rate, loudness targets per bus, encode settings, bank list
tools/audio/                 the uv project: recipe interpreter, DSP, TTS adapters, CLI `yomi-audio`
public/assets/audio/sfx/     generated: one audio sprite per bank (.opus, .mp3, .json) + manifest
```

A recipe is TOML (the house format for `art/`), declaring a cue and how its N variants are made:

- `variants = 6`, `seed = 1` (the variant generator's seed, so variant k is fixed).
- `[[layer]]` entries: a `source` (from `sources.toml`) or a `synth` (noise/sine/sweep with envelope), each with offset, gain, pitch range and filter settings; per-variant randomization is declared as ranges (`pitch = [-2, 2]` semitones, `pick = ["swing_a", "swing_b"]`), drawn from the recipe seed.
- `[post]`: chain (filters, compressor, reverb by impulse, fade, trim silence), loudness target (LUFS) and peak ceiling.
- Runtime hints stay out of the recipe: the recipe describes what a variant sounds like; jitter at play time, bus and cooldown live in the TypeScript cue table (3.5), because the game owns them and tests read them.

Determinism: the interpreter seeds numpy's generator from the recipe seed and the variant index; same inputs and same tool lock give the same PCM. Encoded Opus bytes depend on the libopus build, so the check does not compare encoded bytes.

### 3.4 Output format, packing, size, check

- **Format:** Ogg Opus with an MP3 fallback, as the themes already do (`soundFiles`). Opus mono at 48 kHz, about 64 kbps for SFX. Drop the MP3 fallback only if the user drops browsers without Ogg Opus decoding (older Safari) (decision D5).
- **Packing: one audio sprite per bank** (`ui`, `battle`, `world`, plus the stings), built by the tool: all variants of the bank's cues concatenated with short silence, and a JSON of `{ variantKey: { start, end } }` in Phaser's audio-sprite shape. Phaser loads them with `load.audioSprite` and plays a variant with `sound.playAudioSprite(bank, marker, config)`. This turns a few hundred files into 4 loads and 4 decodes. Alternative: one file per variant with `load.audio` (simplest, but hundreds of requests and decodes at boot). Recommendation: sprites.
- **Budget:** shipped SFX at most 3 MB total encoded per format; committed sources at most 15 MB. The check enforces both.
- **Manifest** `public/assets/audio/sfx/manifest.json`, written by the build: per cue, its variant keys and the SHA-256 of its inputs (recipe text, every source and impulse file it touches, `audio.toml`, the tool version from `uv.lock`); per bank, the hash of the encoded files and duration.
- **`npm run sounds:check`** (host, needs uv): rebuilds PCM in memory for each cue whose input hash changed, and fails when the manifest's input hashes do not match the sources (a recipe changed but was not rebuilt) or an output listed in the manifest is missing or altered. Like `sprites:check`, it is not part of `npm test`.

### 3.5 Runtime (proposed)

Keep the Phaser-free split:

- **`sounds.ts` becomes the cue table.** `SoundKey` is replaced by a `CueId` union (`'attack.swing.blade'`, `'hit.blunt'`, `'cast.fire'`, `'step.grass'`, `'ui.click'`, `'world.spawn'`, and so on). Each `Cue` declares its bank, its variant markers (generated: imported from the manifest JSON so the type and the files cannot drift; a vitest test asserts every cue's markers exist in the manifest), its bus (`effects`, `ui`, `music`, `voice`), base volume, pitch jitter (cents) and volume jitter, and an optional cooldown/voice limit (so a Fireball touching five units does not stack five impacts at once).
- **`eventSounds(event, context)`** keeps its shape, returning `{ cue, delayMs }[]`, with a `context` the scene supplies (as `attackLook` takes `heldIcon`): the attacker's held icon or weapon family, both units' `UnitKind`, the defender's armour material if any. The mapping from family/icon to a sound class (`blade`, `blunt`, `bow`, `crossbow`, `wand`, `claw`) is a table in the helper, keyed by `ItemIcon` and `UnitKind` like `GEAR_SPRITES`. Spell sounds key off `SPELLS[id].element` and school with a per-spell override; abilities by `AbilityId`; runes' `bonus[]` elements add a layer cue. Footsteps come from the existing move playback (one cue per step, by the hex's terrain once the board has terrain; one surface now). New world-map hooks are a sibling `worldSounds(events: WorldEvent[])` mapping `WorldEvent`s (`sighted`, `spawned`, `site_threatened`, `site_lost`, `tower_built`, `encampment_lost`) and the party's own interrupts (arrived, confronting) to cues, called where `WorldScene` already describes days (`describeDays`).
- **`pickVariant(cue, rng, last)`**: a pure function choosing a marker with no immediate repeat, and the jitter. The `rng` is `Math.random` (or a scene-local stream), **never** the battle's seeded RNG: audio is presentation and must not move replays.
- **`audioSettings.ts`** gains a `voice` channel (and `ui` if the user wants it apart from effects); `soundVolume` becomes `busVolume(bus, settings)` driven by the cue's declared bus rather than key prefixes. `parseAudioSettings` already tolerates missing fields, so old saved settings load with defaults. `MenuScene.SLIDERS` gains the new rows.
- **One thin Phaser player** (proposed `soundPlayer.ts`, like `PartyColumn.ts`: game objects only, no logic): `playCue(scene, cueId)` calls `pickVariant`, then `playAudioSprite` with `detune` and volume; the ~25 direct `this.sound.play('sfx_ui_click', …)` sites move to it. It also ducks the music bus while a voice line plays.

## 4. Narration

### 4.1 Model choice

Researched November 2026; licence notes are from model cards and secondary roundups and should be rechecked against each model card before shipping (see sources).

| Model | Licence (shipped audio) | Size | Emotion / nonverbal | Voice consistency | Apple Silicon |
| --- | --- | --- | --- | --- | --- |
| **Chatterbox** (Resemble AI; original, Multilingual, Turbo) | MIT, commercial use stated as allowed; outputs carry an inaudible PerTh watermark | 500M (original), 350M (Turbo) | Original: `exaggeration` and `cfg_weight` sliders. Turbo: inline `[laugh]`, `[sigh]`, `[gasp]`, `[chuckle]`, `[cough]`, but ignores `exaggeration` | Zero-shot clone from a 5 to 10 s reference clip, stable across lines | mlx-audio supports `chatterbox-fp16`; PyTorch MPS for Turbo; about real time on an M4 GPU |
| **Qwen3-TTS** (Alibaba) | Apache-2.0 | 0.6B, 1.7B | Natural-language instruction (`instruct`, 1.7B CustomVoice) on 9 preset voices; VoiceDesign makes a voice from a text description | Presets are stable; Base clones from 3 s with transcript but takes no instruction | Native in mlx-audio |
| Orpheus TTS | Apache-2.0 card on a Llama 3.2 3B base: Meta's terms apply | 3B | `<laugh>`, `<sigh>`, `<groan>` | Preset voices; cloning immature | No confirmed MLX path |
| Dia / Dia2 | Apache-2.0 | 1 to 2B | `(laughs)`, `(sighs)`, multi-speaker dialogue | Voice drifts between runs without an audio prompt | GPU-oriented, no MLX |
| IndexTTS-2 / 2.5 | Bilibili model licence: commercial use needs contact or thresholds | 0.8B | Best-in-class: 8-dim emotion vector, emotion clip or text | Strong cloning | GPU-oriented; about 0.1x real time on M4 |
| Sesame CSM-1B | Apache-2.0 | 1B | Contextual prosody, no explicit control | Clones | In mlx-audio |
| Higgs Audio v2/v3 | Boson community licence (Llama-derived), commercial terms limited | 3 to 4B | Inline control tokens | Clones | In mlx-audio |
| Kokoro-82M | Apache-2.0 | 82M | None (speed only) | 54 presets | Fast; baseline only |

**Recommendation.**

- **Primary: Chatterbox** (original or Multilingual model, through mlx-audio where it supports it, else its PyTorch/MPS package), cloning each voice from committed reference clips. Emotion is set two ways, both declared per line: the `exaggeration` level, and an **emotion-specific reference clip** per voice (a voice has `neutral`, `angry`, `afraid`, `sad`, `whisper` clips, and a line's emotion picks the clip). MIT licence, good cloning, works on this machine. Nonverbal tags use Turbo when a line contains them (same voices, same clips), behind the same adapter.
- **Fallback: Qwen3-TTS 1.7B CustomVoice** (Apache-2.0, native MLX): preset voices with natural-language emotion instructions. It is also the recommended **source of the reference clips**: VoiceDesign makes each character's voice from a text description, so no real person's voice is cloned and the clips are licence-clean (Apache output), recorded once and committed.
- Rejected: IndexTTS-2 (best emotion, but its licence does not plainly allow a commercial game and it is slow on Apple Silicon), Orpheus and Higgs (Llama-derived terms), Dia (voice drift), Kokoro (no emotion).

Because model quality on these specific lines is the open question, the first plan step should be a **bake-off**: the same 6 to 8 lines rendered by Chatterbox (with emotion clips and exaggeration), Chatterbox Turbo (tags) and Qwen3-TTS CustomVoice (instructions), for the user to listen to (decision D3).

### 4.2 Adapter

A narrow Python interface in `tools/audio/` (proposed):

```
render(job) -> WAV PCM
job = { text, voice: { engine, model, revision, reference_clips, preset, params }, emotion, tags_allowed, seed }
```

Each engine is one module implementing `render` and `fingerprint()` (engine name, model repo id and **pinned Hugging Face revision hash**, quantization, the adapter's own version). The CLI reads a job list, renders, normalizes loudness (dialogue target, for example -18 LUFS), trims, encodes with ffmpeg and writes the manifest. Swapping models means a new adapter module and a change to `voices.toml`; nothing in the game changes. Weights download to the Hugging Face cache outside the repo (several GB; the machine has 80 GB free).

### 4.3 Data model

**Where lines are authored.** Options: (a) extend `CutsceneBeat` in `cutscenes.ts` with an optional `voice` block; (b) a separate script file (TOML/YAML) keyed by beat ids. **Recommendation: (a)**, one source of truth beside the text it voices. Proposed fields on a beat:

- `line`: a stable line id, required when voiced, unique across the game (`intro.opening`); index-based ids would re-key on every inserted beat.
- `voice`: a voice id from `audio/voices.toml` (`narrator`, `elder`, ...), decoupled from the displayed `speaker` (which may be `{leader}`).
- `emotion`: one of a closed set per voice (`neutral` default), plus optional `intensity` (0 to 1, mapped to `exaggeration` or the instruction's wording by the adapter).
- `spoken`: optional spoken text, for when the displayed text cannot be spoken as written. **A voiced line must not contain `{…}` templates** in what is spoken, since player-chosen names cannot be pre-rendered: `spoken` gives a template-free wording ("our camp") or the beat stays unvoiced. A vitest test enforces this.
- Inline nonverbal tags (`[sigh]`) live only in `spoken`/`text` of a voiced line and are stripped by `fillText` for display.

`audio/voices.toml` maps voice id to engine, model, revision, reference clips per emotion (`audio/voices/<voice>/<emotion>.flac`, with their own provenance entries) or preset name and default parameters.

**Export and cache.** A Node script (`scripts/narration.ts`, running on native TS, importing `CUTSCENES` and `TUTORIAL` directly) writes the job list `audio/narration.jobs.json`, and computes each line's **input hash**: SHA-256 of canonical JSON of the spoken text, emotion, intensity, the resolved voice entry, the reference clips' hashes and the engine fingerprint. Python renders only the lines whose hash differs from the manifest (`public/assets/voice/manifest.json`: `lineId → { file, hash, durationMs }`) and deletes files of lines no longer in the script. Keeping the hash in Node means the vitest check computes it the same way, with no cross-language hash to keep in step.

**Where audio lives.** `public/assets/voice/<lineId>.opus` (+ `.mp3` per D5), mono speech Opus around 32 kbps, about 4 KB a second: a hundred lines of 5 s is 2 MB. Committed.

### 4.4 Playback in `StoryScene`

- `StoryScene.preload` already loads a cutscene's backdrops lazily; it loads the voiced beats' files the same way (keys `voice_<lineId>`), from the manifest. Narration is not loaded in `BootScene`.
- When a beat is drawn, its line plays on the `voice` bus and music is ducked. Next (click, Space, Enter) stops the line and advances, so a reader is never held; Esc stops it and skips. No auto-advance by default; the manifest's `durationMs` allows an optional auto-advance setting later. A missing file or a failed load just shows the beat silent (narration is never required to play the game).
- The pure parts (which line a beat plays, whether it is voiced, duck levels) go in a Phaser-free helper (proposed `storyAudio.ts`) with tests; `StoryScene` only plays.
- **Tutorial tips** fit the same mechanism: a tip gains the same optional `line`/`voice`/`emotion`/`spoken`, the exporter reads `TUTORIAL` too, and `StoryScene` plays it when the tip shows. Whether tips are voiced at all is a design decision already on the feature record; the architecture supports it at no extra cost. Other later uses ("and the like": barks, the victory screen, a hero's battle cry) reuse the voice manifest and the `voice` bus; they need only a line id and a hook.

## 5. Testing: inside and outside `npm test`

Inside `npm test` (`domain` project, fast, no Python):

- `eventSounds`, `worldSounds`, `pickVariant` (no immediate repeat, jitter within range, no draw from a passed battle RNG) and the bus volumes.
- Every `CueId` resolves to markers present in the SFX manifest, and every manifest file exists on disk.
- Every voiced beat and tip has a line id, ids are unique, spoken text has no templates, and its current input hash (computed in TS) equals the manifest's: an edited line that was not re-rendered fails the test, the analogue of a stale sprite.
- Size budgets on the committed outputs.

Outside `npm test` (host only, documented in a new `audio/CLAUDE.md` like `art/CLAUDE.md`, with a one-line pointer in the root `CLAUDE.md`):

- `npm run sounds` / `npm run sounds:check` (uv, numpy, ffmpeg).
- `npm run narration` (export jobs, then `uv run` the TTS render; minutes, model weights).
- pytest for the recipe interpreter and DSP in `tools/audio/` (fast; can run on the host; not in the podman image).
- The in-browser tests (`npm run test:browser`) can check that audio sprites load and a cutscene with a voiced beat advances; they need no model.

## 6. Cross-cutting

- **Licensing and provenance:** allow-listed licences per source in `sources.toml` and per reference clip; `public/assets/audio/README.md` and a new `public/assets/voice/README.md` list provenance and the TTS model and licence (as the sprites' README does). Never clone a real person's voice; voices come from VoiceDesign or from recordings by consenting people.
- **Failure modes:** a missing variant or voice file degrades to silence, never an exception; the build fails loudly on an unlicensed source, a missing source, a budget overrun or clipping.
- **Performance:** four audio sprites decoded at boot (a few MB of PCM in memory); voice lines loaded per cutscene; a per-cue voice limit avoids stacking.
- **Podman:** nothing new in the image; the Python toolchain is host-only, as sprite-tool is.

## 7. Evolution

- Migration: the placeholder WAVs and `SoundKey` are replaced in one pass, the cue table first with the placeholders mapped onto it (so the runtime change lands before any new audio), then recipes replace them bank by bank. The themes stay as they are (they are not generated); they join the cue table as `music` bus entries loaded with `load.audio`.
- Settings: `yomi.audio` gains fields; old values load with defaults for the new channels. No save-file change (`SAVE_VERSION` untouched): `StoryState` is not affected.
- A new sound later is a recipe plus a cue entry; a new voiced line is fields on a beat plus `npm run narration`; a new TTS model is an adapter module.

## 8. Risks and open decisions

Risks:

- **Recorded-sample quality** depends on finding good CC0 material; Kenney's packs are clean but generic. Early detection: the first bank (melee) reviewed by ear before the rest.
- **TTS quality and consistency** on short fantasy lines (names, archaic wording) is unknown until the bake-off; voices may drift between renders. Pinned revisions, fixed seeds and reference clips limit drift; regenerating only changed lines limits churn.
- **Chatterbox Turbo vs exaggeration split**: tags and the intensity slider are in different models; if mixing them in one voice sounds inconsistent, choose one control per voice.
- **Licence drift**: model licences have changed before; the brief's licence column must be rechecked on the model cards at adoption.

Decisions for the user (each with a recommendation):

- **D1. SFX tooling language.** Python under uv (`tools/audio/`) shared with the TTS worker *(recommended)*, or Node + ffmpeg filtergraphs.
- **D2. Non-CC0 packs (Sonniss GDC).** Leave them out, CC0 and own synthesis only, so a clone can rebuild everything *(recommended)*; or allow them in a gitignored local cache with only derived outputs committed (the public repo forbids committing them).
- **D3. TTS model.** Chatterbox primary with per-emotion reference clips made by Qwen3-TTS VoiceDesign, Qwen3-TTS CustomVoice as fallback, confirmed by a bake-off on real lines *(recommended)*; or skip the bake-off and take Qwen3-TTS alone (simpler, native MLX, instruction emotion, no tags, 9 preset voices).
- **D4. The leader's lines.** The speaker `{leader}` is any player character. Voice them with one generic leader voice, or one voice per portrait (8 presets, so 8x the lines), or leave them unvoiced. Recommended: unvoiced for now, narrator and fixed NPCs voiced; revisit when real story content is written.
- **D5. MP3 fallback.** Keep Opus + MP3 as the themes do *(recommended, small cost)*, or Opus only (drops older Safari).
- **D6. Buses.** Add `voice` *(required)*; add a separate `ui` slider or keep UI under Sound FX *(recommended: keep under Sound FX, with its own bus internally so it can be split later)*.

Not blocking the design: the cue catalogue itself (which weapon classes, elements and world events get sounds) and whether tutorial tips are voiced are design questions.

## Sources

- [mlx-audio (GitHub)](https://github.com/Blaizzy/mlx-audio), [mlx-audio on PyPI](https://pypi.org/project/mlx-audio/), [mlx-audio Chatterbox docs](https://blaizzy.github.io/mlx-audio/models/tts/chatterbox/), [mlx-audio Qwen3-TTS docs](https://blaizzy.github.io/mlx-audio/models/tts/qwen3-tts/)
- [Chatterbox (Resemble AI)](https://www.resemble.ai/learn/models/chatterbox), [Chatterbox Turbo](https://resemble.ai/chatterbox-turbo), [Turbo source on Hugging Face](https://huggingface.co/spaces/ResembleAI/chatterbox-turbo-demo/blob/main/chatterbox/tts_turbo.py)
- [Qwen3-TTS (GitHub)](https://github.com/QwenLM/Qwen3-TTS), [Qwen3-TTS model overview](https://www.mintlify.com/QwenLM/Qwen3-TTS/concepts/models), [Qwen3-TTS voice design](https://www.mintlify.com/QwenLM/Qwen3-TTS/guides/voice-design)
- [Best Local TTS Models in 2026 (yaps.ai, 10 Oct 2026)](https://www.yaps.ai/blog/best-local-tts-models), [Best Local TTS for Mac 2026](https://www.promptquorum.com/power-local-llm/best-local-tts-mac)
- [IndexTTS2 (tts.ai listing)](https://tts.ai/voices/indextts2/)
