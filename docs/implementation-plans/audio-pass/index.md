# Implementation plan: audio pass (sound effects and narration)

Replace the eight square-wave placeholders with a catalogue of layered, varied sound effects built by a checked-in Python tool from text recipes and committed CC0 or own sources; sound the world map, the encampment and the interface; and add a narration framework whose lines are pre-rendered offline by a local emotion-capable TTS model and played by `StoryScene`.

**Source design:** [`docs/designs/audio-pass.md`](../../designs/audio-pass.md) (`84f5f35`, approved by the user). Architecture brief: [`docs/architecture/audio-pass.md`](../../architecture/audio-pass.md) (`a82ae8f`). Feature record: [`docs/features/audio-pass.md`](../../features/audio-pass.md) (decisions D1 to D6 and the sourcing, tutorial and stings decisions; all settled). Planned against `e102569` on branch `audio-pass` (worktree `.claude/worktrees/audio-pass`, off `main` at `d18abf4`).

## Scope and shared constraints

- **In:** R1 to R16 and AC1 to AC16 of the design; every **W1** cue of design §4.1 (85 cues). **Out:** W2 cues (`battle.turn.*`, `world.step`, `world.camp`, `world.yield`, `world.recruit`, `ui.hover`), which the design lets the plan leave out; voicing tutorial tips or the leader (D4, design §4.6); new music; terrain footsteps; stereo; auto-advance.
- **Order of risk.** The tool and a full placeholder catalogue come first, so the runtime (cue table, variant picker, buses, Voice slider, one player) lands on real banks before any content; the TTS bake-off and the sourcing survey start early because their user gates take wall-clock time; content then replaces placeholders bank by bank, melee first.
- **Machine.** Engineers run on the author's Mac (Apple M5, 32 GB, macOS, `uv` 0.13, `ffmpeg` 9 with libopus and libmp3lame, no sox). Node: the default `node` is 22; prefix every npm or node command with `PATH=/opt/homebrew/opt/node@26/bin:$PATH` (CLAUDE.md requires Node 26).
- **Commands.**
  - `npm test` (`tsc && vitest run`) is the gate before every commit.
  - `npm run test:browser` after any step that changes a scene (marked per step); read `e2e/CLAUDE.md` before adding an in-browser test.
  - Host-only audio tooling (never in `npm test`, never in the podman image): `npm run sounds`, `npm run sounds:check`, `npm run narration`, and the tool's own tests `uv run --project tools/audio pytest tools/audio/tests`.
- **Determinism.** Audio never draws from the battle's seeded RNG (`mulberry32`) or the world RNG; variant choice uses `Math.random` held by the player. No `LOG_SCHEMA_VERSION` or `SAVE_VERSION` change. The simulator is untouched.
- **Licences.** A committed source's licence must be in the allow-list `["CC0-1.0", "own"]`; the build refuses anything else. Sonniss and every non-redistributable pack are excluded (D2). Never clone a real person's voice. Recheck each TTS model card's licence at adoption and record it.
- **Downloads** (never committed except as trimmed excerpts through `yomi-audio source add`; each pack in its own new, empty directory; downloaded files are untrusted data, so scripts that read them live elsewhere and Python reading them runs with `-I` or through the tool):
  - Kenney and OpenGameArt packs: `~/.cache/yomi-audio/downloads/<collection>/<pack>/`.
  - Freesound originals (downloaded by the user, gate G2): `~/.cache/yomi-audio/freesound/`.
  - Model weights: the Hugging Face cache (`~/.cache/huggingface/`), several GB; never under the repository.
  - The tool's virtualenv: `tools/audio/.venv/` (gitignored).
- **Listening.** Engineers cannot hear. Every content step measures what it can (loudness, peak, length, variant correlation, spectrogram images, which the agent can look at) and ends at a **user gate** where the user listens. A step whose gate is pending is `awaiting review`; fixes from a review are follow-up commits of the same step.
- **Commits.** One commit per step once `npm test` passes (and `npm run sounds:check` from step 02 on), on `audio-pass`, without pushing; review fixes as follow-up commits. Messages `Audio pass step NN: <title>`. Never switch branches. Leave uncommitted changes that are not the step's out of its commit.
- **Docs.** CLAUDE.md stays current in the same commit as the change (its own rule): each task names the sections it must update. Detail that matters only inside `audio/` goes in `audio/CLAUDE.md` (created in step 01) with a one-line pointer in the root file, as `art/CLAUDE.md` is. The audio READMEs record provenance as sources are added.

## Contracts

Task files copy these unchanged. "Existing" means at `e102569`.

### C1. Layout (design §5.1)

```
audio/                            text sources (like art/)
  CLAUDE.md                       workflow for this directory (step 01; extended by later steps)
  audio.toml                      C3
  sources.toml                    C4
  sources/<collection>/*.flac     trimmed CC0 / own excerpts, mono, 48 kHz
  impulses/<name>.toml, .flac     impulse recipes and their rendered FLAC (licence "own")
  sfx/<bank>/<name>.toml          one recipe per cue: cue `<bank>.<name>` (C5)
  sfx.manifest.json               generated (C6)
  voices.toml                     the voice registry (C11)
  voices/<voice>/<emotion>.flac   reference clips (licence "own")
  voice.manifest.json             generated (C11)
  bakeoff/                        gitignored: the listening test (C10)
  .audition/                      gitignored: audition WAVs, spectrograms and review sheets
  narration.jobs.json             gitignored: the exporter's job list (C11)
tools/audio/                      the uv project (C2)
public/assets/audio/sfx/          generated: <bank>.opus, <bank>.mp3, <bank>.json
public/assets/audio/              music_battle.*, music_world_map.* (unchanged), README.md
public/assets/voice/              generated: <line>.opus, <line>.mp3, README.md
scripts/narration.ts              the exporter (C11)
docs/implementation-plans/audio-pass/sourcing.md, freesound-wanted.md   step 04's catalogue (per cue: candidate files in the download cache, gaps) and the user's download list; read by steps 08–13
src/scenes/sounds.ts              cue table, eventSounds, worldSounds, pickVariant (Phaser-free) (C8)
src/scenes/soundPlayer.ts         the one player; imports Phaser types only (C8)
src/scenes/audioSettings.ts       + voice, busVolume (C8)
src/scenes/storyAudio.ts          (C12)
src/story/narration.ts            (C11)
```

`.gitignore` gains `tools/audio/.venv/`, `audio/bakeoff/`, `audio/.audition/`, `audio/narration.jobs.json` (step 01).

### C2. The tool (`tools/audio/`)

- uv project, Python 3.11 (`tools/audio/.python-version`), package `yomi_audio`, console script `yomi-audio`, `pyproject.toml` and `uv.lock` committed. Base dependencies: numpy, scipy, soundfile, pyloudnorm; dev group: pytest (and matplotlib for spectrograms if wanted). TTS dependencies only in the optional extra `tts` (`uv run --project tools/audio --extra tts …`), so `sounds:check` never installs torch or mlx. ffmpeg is called as a subprocess for encoding only. Pedalboard (GPL) is not used.
- Every command takes `--root <dir>` (default: the repository's `audio/`; the tests use fixture projects) and exits non-zero with a message naming the cue, source or line at fault.

| Command | Step | Does |
| --- | --- | --- |
| `yomi-audio source add <file> --id ID --collection C --licence L --author A --url U [--original NAME] [--start S --end E] [--notes N]` | 01 | trims, sums to mono, resamples to 48 kHz, writes `audio/sources/<C>/<ID>.flac`, appends a C4 entry with both hashes; refuses a licence outside the allow-list |
| `yomi-audio source remove <id>` | 09 | deletes a source's file and entry; refuses an unknown id or one a recipe names |
| `yomi-audio impulse build` | 01 | renders `audio/impulses/<name>.toml` to `<name>.flac` (`small_room`, `stone_hall`, `open_air`) |
| `yomi-audio sfx audition <cue>… [--out DIR] [--spectrogram]` | 01 | renders variants as 48 kHz WAV (default `audio/.audition/<cue>/`), prints each variant's loudness, peak and length |
| `yomi-audio sfx build [--bank B] [--cue C]` | 02 | renders changed cues, checks them (C6), reassembles touched banks, encodes, writes C6 files |
| `yomi-audio sfx check` | 02 | writes nothing; fails on stale or missing outputs and budget overruns (C6) |
| `yomi-audio voice bakeoff` | 03 | the listening test (C10) |
| `yomi-audio voice design <voice> [--emotions E,…] [--candidates N]` | 03 (minimal), 15 (full) | C10 |
| `yomi-audio voice render` | 16 | C11 |

- npm scripts (host only): `"sounds": "uv run --project tools/audio yomi-audio sfx build"`, `"sounds:check": "uv run --project tools/audio yomi-audio sfx check"` (step 02); `"narration": "node scripts/narration.ts && uv run --project tools/audio --extra tts yomi-audio voice render"` (step 16; step 14 adds the exporter alone as `"narration:export": "node scripts/narration.ts"`).

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

### C4. `audio/sources.toml` entries (design §5.2)

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

### C6. Banks, manifest and check

- Bank files `public/assets/audio/sfx/<bank>.opus`, `.mp3` and `<bank>.json` in Phaser's audio-sprite shape: `{ "resources": ["<bank>.opus", "<bank>.mp3"], "spritemap": { "<cue>#<k>": { "start": s, "end": s, "loop": false } } }` (seconds; k from 0; variants concatenated in cue then variant order with `gap_ms` of silence).
- `audio/sfx.manifest.json`:

  ```json
  { "version": 1, "tool": "yomi-audio 0.1.0",
    "banks": { "battle": { "durationMs": 121400, "opus": { "bytes": 0, "sha256": "…" }, "mp3": { "bytes": 0, "sha256": "…" } } },
    "cues": { "battle.hit.slash": { "bank": "battle", "markers": ["battle.hit.slash#0", "…"], "durationsMs": [312, "…"], "inputs": "<sha256>" } } }
  ```

  `inputs` hashes the recipe text, every source and impulse file it touches, `audio.toml`, and the tool's version and `uv.lock`.
- Build checks, each failing the build: loudness within the group's tolerance; true peak under its ceiling; length within `max_ms`; DC offset at most 0.5%; no two variants of a cue with peak normalised cross-correlation above 0.95; every source allowed and its hash matching.
- `sfx check` fails when a cue's input hash differs from the manifest, a recipe has no manifest entry or the reverse, a bank file is missing or its hash differs, or a budget (C3) is exceeded. Encoded bytes are compared only against the manifest's own record, never re-encoded.

### C7. The W1 catalogue (design §4.1; ids, groups and variant counts)

Every step that writes recipes uses exactly these 85 ids. Variant counts are the design's; a content step may change a count (the runtime reads markers from the manifest) and says so.

| Bank | Group | Cues (variants) |
| --- | --- | --- |
| battle | release | `swing.light` 5, `swing.blade` 5, `swing.heavy` 5, `swing.thrust` 4, `swing.claw` 4, `swing.bite` 3, `shot.bow` 5, `shot.crossbow` 4, `shot.wand` 5, `cast.arcane` 3, `cast.fire` 3, `cast.frost` 3, `cast.storm` 3, `cast.venom` 3, `cast.shadow` 3, `cast.holy` 3, `cast.ward` 3, `ability.spit` 3, `ability.web` 3 |
| battle | impact | `hit.slash` 6, `hit.crush` 6, `hit.pierce` 6, `hit.claw` 5, `hit.magic` 4, `miss.swing` 4, `miss.shot` 4, `miss.magic` 3, `hit.image` 3, `impact.arcane` 4, `impact.fire` 4, `impact.fireball` 3, `impact.frost` 4, `impact.lightning` 3, `impact.acid` 4, `impact.poison` 3, `impact.shadow` 4, `impact.hex` 3, `impact.web` 3, `impact.heal` 3, `impact.buff` 3 |
| battle | sweetener | `armor.metal` 5, `hit.crit` 4, `element.fire` 2, `element.frost` 2, `element.lightning` 2, `element.acid` 2, `element.poison` 2, `element.blight` 2, `heal.small` 3, `regen` 3, `death.hero` 2 |
| battle | death | `death.human` 4, `death.goblinoid` 4, `death.brute` 3, `death.spider` 2, `death.salamander` 2, `death.horror` 1 |
| battle | step | `step.armored` 8, `step.light` 8, `step.heavy` 6, `step.skitter` 4 |
| world | world | `confront` 2, `sighted` 2, `source` 1, `threatened` 2, `captured` 2, `lost` 2, `build` 3, `arrive` 3, `upgrade` 2, `coins` 4, `craft` 3, `rune.embed` 3, `rune.fuse` 2, `rune.extract` 2 |
| ui | ui | `click` 4, `confirm` 3, `back` 3, `tab` 4, `error` 3, `learn` 2, `gear` 6 |
| stings | sting | `victory` 1, `defeat` 1, `level_up` 1 |

(Cue id = `<bank>.<name>`, e.g. `battle.swing.light`, `stings.level_up`.) A one-variant cue is exempt from the correlation check and from "never repeat" (it can only repeat).

### C8. Runtime (`src/scenes/`, step 05 unless marked)

```ts
// sounds.ts (Phaser-free)
import manifest from '../../audio/sfx.manifest.json'          // tsconfig gains "resolveJsonModule": true
export type CueId = keyof typeof manifest.cues
export type BankId = 'ui' | 'battle' | 'world' | 'stings'
export const BANKS: readonly BankId[]
export type Bus = 'effects' | 'ui' | 'music' | 'voice'
export interface CueSpec { bus: Bus; gainDb?: number; detuneCents?: number; volumeJitterDb?: number; maxVoices?: number; minGapMs?: number }
export const CUES: Record<CueId, CueSpec>       // a cue in the manifest without an entry, or the reverse, is a type error
export function cueBank(cue: CueId): BankId
export function cueMarkers(cue: CueId): readonly string[]
export function bankFiles(bank: BankId): { json: string; audio: string[] }   // 'assets/audio/sfx/<bank>.json', ['….opus', '….mp3']
export type MusicKey = 'music_battle' | 'music_world_map'
export const MUSIC_KEYS: readonly MusicKey[]
export function musicFiles(key: MusicKey): string[]                          // ['assets/audio/<key>.opus', '….mp3']
export interface SoundCue { cue: CueId; delayMs: number }
export const STING_DELAY_MS = 450
export interface VariantState { /* shuffle bags and last markers, per cue */ }
export function newVariantState(): VariantState
export function pickVariant(state: VariantState, cue: CueId, random: () => number): { marker: string; detune: number; volumeDb: number }
export interface LimitState { /* active plays and last start per cue, global count */ }
export function newLimitState(): LimitState
export function admitPlay(state: LimitState, cue: CueId, nowMs: number, endsAtMs: number): boolean   // maxVoices, minGapMs, the global cap
export const GLOBAL_VOICE_CAP = 24                                            // effects and ui buses together
// step 06:
export interface SoundContext { kind(unit: UnitId): UnitKind | null; held(unit: UnitId): ItemIcon | null; body(unit: UnitId): ItemIcon | null }
export function eventSounds(event: BattleEvent, context?: SoundContext): SoundCue[]
export interface AttackSound { release: CueId; hit: CueId; miss: CueId }
export const WEAPON_SOUNDS: Partial<Record<ItemIcon, AttackSound>>
export const FOE_SOUNDS: Record<FoeKind, AttackSound>
export function spellSound(id: SpellId): { cast: CueId; impact: CueId }
export const ABILITY_SOUNDS: Partial<Record<AbilityId, { release: CueId; impact: CueId }>>
export const DEATH: Record<UnitKind, CueId>
// step 06 may add beside these (no other step consumes them): STEP (the step table, resolved with the body icon), cueDurationMs(cue, k = 0), levelUpDelayMs(), a bare-hands AttackSound constant
// step 07:
export function worldSounds(events: readonly (WorldEvent | PartyEvent)[]): SoundCue[]   // at most two, by priority, 250 ms apart
export const WORLD_SOUND_GAP_MS = 250
```

`CUES` defaults (design §5.3, §4.4): bus `effects` for `battle.*` and `world.*`, `ui` for `ui.*`, `music` for `stings.*`; `detuneCents` 40 (steps 100, ui 20, stings and `world.source` 0); `volumeJitterDb` 1.5 (ui 0.5, stings 0); `maxVoices` 3 for steps and for every `impact`-group cue, 2 for `battle.element.*`. In step 05 `eventSounds(event)` keeps today's mapping onto new ids (attack: `battle.swing.blade` then `battle.hit.slash`/`battle.hit.crit`/`battle.miss.swing`; cast and ability: `battle.cast.arcane` then `battle.impact.heal` (friendly) or the hit/crit/miss cues; `status_tick` `battle.hit.slash`; `regenerate` `battle.regen`; `unit_down` `battle.death.human`; `battle_end` `stings.victory`/`stings.defeat` at `STING_DELAY_MS`); step 06 replaces it with the full mapping.

```ts
// audioSettings.ts (Phaser-free)
export interface AudioSettings { master: number; effects: number; music: number; voice: number }   // voice defaults to 1
export type AudioChannel = keyof AudioSettings
export const MUSIC_BASE: number                 // 10^((-24 - measuredLUFS)/20), measured in step 05 (or per theme, MUSIC_GAIN)
export const BUS_BASE: Record<Bus, number>      // effects 1, ui 1, voice 1, music MUSIC_BASE
export function busVolume(bus: Bus, settings?: AudioSettings): number   // ui and effects read `effects`; music `music`; voice `voice`
// removed: soundVolume, SOUND_KEYS, SoundKey, soundFiles, SOUND_VOLUME, MUSIC_VOLUME
```

```ts
// soundPlayer.ts (imports Phaser as types only, so its logic is tested in the domain project over a fake manager)
export function playCue(scene: Phaser.Scene, cue: CueId, delayMs?: number): void   // missing bank or marker: silent, no throw
export function playCues(scene: Phaser.Scene, cues: readonly SoundCue[]): void
export function startMusic(scene: Phaser.Scene, key: MusicKey): void
export function pauseMusic(): void
export function resumeMusic(): void
export function stopMusic(): void
export function applyVolumes(): void            // after a slider moves: the playing theme and voice line take the new level
export function duck(scene: Phaser.Scene, on: boolean): void   // music to busVolume('music') x dB(-10), attack 150 ms, release 600 ms
export function playVoice(scene: Phaser.Scene, key: string): boolean                // step 17 uses it; false when the key is not loaded
export function stopVoice(fadeMs: number): void
export function voicePlaying(): boolean
export function installLimiter(game: Phaser.Game): void   // DynamicsCompressor: threshold -6 dBFS, knee 3, ratio 20, attack 3 ms, release 150 ms
export interface AudioLogEntry { cue: string; marker: string; bus: Bus; at: number }
export function audioLog(): readonly AudioLogEntry[]      // last 50; dev hook only
```

- `BootScene.preload` loads each bank with `load.audioSprite(bank, json, audio)` and each theme with `load.audio(key, musicFiles(key))`; `BootScene.create` calls `installLimiter`.
- `src/testHook.ts`/`main.ts` (dev only) expose `window.__yomi.audioLog()`; game code never reads it.
- No scene calls `sound.play`/`sound.add` directly after step 05 (AC1: `grep` finds no `sound.play(` and no `sfx_` in `src/`).
- `MenuScene` shows four sliders: Master, Sound FX, Music, Voice.

### C9. When sounds play (design §4.2, §4.3, §5.3)

Step 06 implements §5.3 (battle) and the level-up sting (§4.3: `stings.level_up` 150 ms after the victory sting's marker ends, when any member's `levelsGained > 0`). Step 07 implements §4.2 (world) and §4.3 (interface: `ui.click`, `ui.back`, `ui.tab`, `ui.confirm`, `ui.error` on every refusal, success sounds `world.upgrade`, `world.coins`, `world.craft`, `world.rune.*`, `ui.learn`, `ui.gear`, `battle.impact.heal` for a world-map heal). `MOVE_STEP_MS` (140) moves from `BattleScene.ts` to `battleEffects.ts` (step 06).

### C10. TTS adapter and bake-off (step 03; used by 15 and 16)

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

### C11. Narration data (steps 14 and 16)

```ts
// src/story/cutscenes.ts: CutsceneBeat gains (design §5.8.1)
line?: string; voice?: VoiceId; emotion?: Emotion; intensity?: number; spoken?: string; take?: number
// src/story/narration.ts (Phaser-free; may import node:crypto and node:fs: only tests and scripts import it, never a scene)
export type VoiceId = 'narrator'
export type Emotion = 'neutral' | 'warm' | 'grave' | 'tense' | 'afraid' | 'angry' | 'sad' | 'triumphant' | 'whisper'
export const EMOTIONS: readonly Emotion[]
export const NONVERBAL_TAGS: readonly string[]          // '[sigh]', '[laugh]', '[chuckle]', '[gasp]', '[cough]'
export const TAG_ENGINES: readonly string[]             // ['chatterbox_turbo']
export interface VoiceTable { engine: string; model: string; revision: string; emotions: Emotion[]; params?: Record<string, unknown>; clips?: Partial<Record<Emotion, string>>; [k: string]: unknown }
export interface VoiceRegistry { adapter_version: number; voices: Record<string, VoiceTable> }
export function readVoices(path?: string): VoiceRegistry                    // smol-toml
export function spokenText(beat: CutsceneBeat): string                      // beat.spoken ?? beat.text
export function lineSeed(line: string, take: number): number                // first 32 bits of SHA-256(`${line}#${take}`)
export function lineHash(beat: CutsceneBeat, voice: VoiceTable, clipHashes: Record<string, string>, adapterVersion: number, voiceSettings: Record<string, unknown>): string
export interface VoicedLine { cutscene: string; index: number; beat: CutsceneBeat }
export function voicedLines(cutscenes: Record<string, Cutscene>): VoicedLine[]
export function narrationProblems(cutscenes: Record<string, Cutscene>, voices: VoiceRegistry): string[]   // design §5.8.1 rules; [] when clean
export function staleLines(lines: readonly VoicedLine[], manifest: VoiceManifest, hashOf: (line: VoicedLine) => string, fileExists: (path: string) => boolean): string[]   // AC12 check: ids of voiced lines missing from the manifest, with another hash, or without both files; [] when fresh
export interface VoiceManifest { version: 1; lines: Record<string, { hash: string; durationMs: number; voice: string; engine: string }> }   // storyAudio.ts takes it with `import type` only
```

- `lineHash` = SHA-256 hex of canonical JSON (keys sorted at every level) of `{ spoken, emotion (default 'neutral'), intensity (default 0.5), take (default 0), voice: <the table>, clips: <SHA-256 of each of the voice's clips, by emotion>, adapter_version, voice_settings: audio.toml [voice] }`.
- `audio/narration.jobs.json` (gitignored), written by `scripts/narration.ts`: `{ "adapter_version": n, "voice_settings": {…}, "jobs": [ { "line", "spoken", "voice": "<id>", "voiceTable": {…}, "emotion", "intensity", "take", "seed", "hash" } ] }`.
- `audio/voice.manifest.json` (committed; `{ "version": 1, "lines": {} }` from step 14): `{ "version": 1, "lines": { "intro.opening": { "hash": "…", "durationMs": 4120, "voice": "narrator", "engine": "chatterbox@<rev>" } } }`.
- `audio/voices.toml`: design §5.8.2 (`adapter_version`; `[narrator]` with `engine`, `model`, `revision`, `emotions`, `params`; `[narrator.design]`; `[narrator.clips]`; `[narrator.fallback]`). Step 14 writes it provisionally (narrator A's description, engine `chatterbox`, revision `"unpinned"`, no clips); step 15 finalises it from gate G1.
- Voice files `public/assets/voice/<line>.opus` and `.mp3`, loaded as `voice_<line>`.

### C12. Story playback (step 17)

```ts
// src/scenes/storyAudio.ts (Phaser-free; imports audio/voice.manifest.json)
export function beatLine(beat: CutsceneBeat, manifest?: VoiceManifest): string | null   // line id when voiced and in the manifest
export function voiceKey(line: string): string                                          // `voice_${line}`
export function voiceFiles(line: string): string[]                                      // ['assets/voice/<line>.opus', '….mp3']
export function linesOf(cutscene: Cutscene): string[]
export const LINE_DELAY_MS = 150
export const CUT_FADE_MS = 80
export const DUCK_DB = -10
export const DUCK_ATTACK_MS = 150
export const DUCK_RELEASE_MS = 600
```

`StoryScene`'s probe gains `voice: { line: string | null; playing: boolean }`.

## Steps

| Step | Task | Outcome | Depends on | Scenes | Gate | Status |
| --- | --- | --- | --- | --- | --- | --- |
| 01 | [Audio tool core](01-audio-tool-core.md) | uv project; DSP, recipe interpreter, loudness, sources registry and `source add`, impulses, `sfx audition`; pytest; `audio/CLAUDE.md` | — | no | — | done (`dfa31ee`) |
| 02 | [Banks, check and placeholder catalogue](02-banks-check-placeholders.md) | `sfx build`/`sfx check`, budgets, `npm run sounds(:check)`; all 85 W1 cues as recipes over today's placeholders; banks and manifest committed | 01 | no | — | done (`dc54377`, review fixes `87e09cb`) |
| 03 | [TTS adapters and bake-off](03-tts-bakeoff.md) | Engine adapters (C10); narrators A and B designed; 32 blind clips, key, score sheet, neutral candidates | 01 | no | **G1** | done (G1 passed: configuration (b), Chatterbox Turbo, narrator A, neutral clip `A_0`; `667efdd`) |
| 04 | [Sourcing survey and Freesound list](04-sourcing-survey.md) | Kenney and OpenGameArt CC0 packs downloaded; `sourcing.md` (candidates per cue) and `freesound-wanted.md` committed in this folder | 01 | no | **G2** | done (G2 passed 2026-11-14; `2de63b8`) |
| 05 | [Runtime framework](05-runtime-framework.md) | Cue table, `pickVariant`, limits, buses, Voice slider, `soundPlayer`, limiter, audio log, banks at boot, every call site moved, placeholders deleted, music level measured | 02 | **yes** | — | done (`edab9c4`) |
| 06 | [Battle sound mapping](06-battle-sound-mapping.md) | `eventSounds` with `SoundContext` and the tables of §5.3; level-up sting; coverage tests; replay unchanged | 05 | **yes** | — | done |
| 07 | [World and interface sounds](07-world-interface-sounds.md) | `worldSounds`; world-map hooks; back, tab, confirm, error, learn, gear and success sounds in every screen | 06 | **yes** | — | done |
| 08 | [Content: melee](08-content-melee.md) | 13 melee cues from real sources | 02, 04 | no | **G3** | done (G3 passed, all acceptable; `6ff2d6f`) |
| 09 | [Content: interface and stings](09-content-ui-stings.md) | `ui` and `stings` banks | 08 (G3) | no | **G4** | done (`f135fc0`; G4 non-blocking, audition in `audio/.audition/09-ui-stings/` for the user's playtest) |
| 10 | [Content: shots, magic hits and sweeteners](10-content-ranged-sweeteners.md) | 15 battle cues | 08 (G3), G2 | no | **G5** | done (`525eef1`, review fixes `Audio pass step 10: review round 1`; G5 non-blocking, audition in `audio/.audition/10-ranged-sweeteners/` for the user's playtest) |
| 11 | [Content: spells and abilities](11-content-spells.md) | 22 battle cues | 10 | no | **G6** | done (`953a9b8`; G6 non-blocking, audition in `audio/.audition/11-spells/` for the user's playtest) |
| 12 | [Content: falls and footsteps](12-content-falls-steps.md) | 11 battle cues | 11 | no | **G7** | done (`f09845b`; G7 non-blocking, audition in `audio/.audition/12-falls-steps/` for the user's playtest) |
| 13 | [Content: world](13-content-world.md) | `world` bank (14 cues) | 08 (G3), G2 | no | **G8** | done (`2f482fb`; G8 non-blocking, audition in `audio/.audition/13-world/` for the user's playtest) |
| 14 | [Narration data model and exporter](14-narration-data.md) | Beat fields, `narration.ts`, rules and staleness tests, provisional `voices.toml`, `smol-toml`, `scripts/narration.ts` | 01 | no | — | done (`a58449b`) |
| 15 | [Narrator voice design](15-voice-design.md) | `voice design` in full for the chosen narrator; emotion candidates for the user | 03 (G1), 14 | no | **G9** | done (G9 passed 2026-11-14, `A_0` kept; `df250f3`, `70a21c2`) |
| 16 | [Render the shipped lines](16-voice-render.md) | Clips committed; `voices.toml` final; `voice render`; `intro.opening` and `source.sighted` voiced; voice README | 15 (G9) | no | **G10** | awaiting review (G10; `Audio pass step 16: Render the shipped lines`) |
| 17 | [Story playback](17-story-playback.md) | `storyAudio.ts`; `StoryScene` plays, cuts, skips, ducks; probe; AC14 | 05, 16 | **yes** | — | done (`3467f57`) |
| 18 | [Final review and docs](18-final-review.md) | Full verification (AC1–AC16), README and CLAUDE.md audit, manual, the in-game listening review | all | **yes** | **G11** | pending |

## Execution order and parallel work

- **Track A (SFX):** 01 → 02 → 05 → 06 → 07. **Track B (content):** 04 (after 01) → 08 (after 02 and 04) → G3 → 09, 10 → 11 → 12, 13. **Track C (narration):** 03 (after 01) → G1; 14 (any time after 01) → 15 (after G1) → G9 → 16 → G10 → 17 (also after 05).
- Start 03 and 04 straight after 01 so the user's gates G1 and G2 run while 02 and 05–07 are built.
- One worktree: engineers run one at a time. While a step waits at its gate (`awaiting review`), the next step of another track may run; a content step may start while the previous content step's gate is pending, **except** that no content step after 08 starts before G3 (melee sets the style).
- Content steps touch only `audio/`, `public/assets/audio/sfx/`, `audio/sfx.manifest.json` and the audio README. Two content steps never run at once (the manifest and bank files would conflict); after a rebase or merge of a generated file, rerun `npm run sounds` rather than hand-merge.
- `sounds.ts` is edited by 05, 06, 07 in that order only; `CUES` and the manifest's cue set are fixed by 02 and 05.
- **Checkpoints:** after 02, `npm run sounds:check` passes on a clean tree; after 07, the game sounds every hook (with placeholder-built banks where content is not yet in); after 13, every W1 cue is real content; after 17, narration plays end to end.

## User gates

The orchestrator brings each gate to the user, records the outcome in the feature record (`docs/features/audio-pass.md`, decision log or verification) and in this table's Status, and passes it to the next step.

| Gate | After | The user | The plan needs back | Blocks |
| --- | --- | --- | --- | --- |
| G1 Bake-off | 03 | Listens to the 32 blind clips in `audio/bakeoff/`, fills `score.md`; listens to `neutral_candidates/` | The filled score sheet; the configuration chosen (a, b or c) and the narrator (A or B), or "none passes"; the neutral candidate kept for that narrator (e.g. `B_2`) | 15 |
| G2 Freesound | 04 | Logs in to freesound.org and downloads the originals named in `freesound-wanted.md` (written by step 04 in this folder) into `~/.cache/yomi-audio/freesound/` (original file names); may skip any | "done", with any skipped ids; or "skip all" (those cues then fall back to Kenney, OpenGameArt and synthesis, and the step says so) | 10, 11, 12, 13 (not 08, 09) |
| G3 Melee review | 08 | Listens to `audio/.audition/08-melee/` (WAV per variant, `review.md`) and, if step 06 is done, a battle in the dev server (`npm run dev`, debug console `fight`) | Per cue: OK, or what is wrong ("too bright", "repeats") | 09–13 |
| G4–G8 Batch reviews | 09–13 | The same for that batch (`audio/.audition/<NN>-<batch>/`) | Per cue: OK or a note | that step's `done` |
| G9 Clip picks | 15 | Listens to `audio/.audition/15-voice/<emotion>_<k>.wav` (similarity printed in `review.md`) | One candidate per emotion (or "none, redo with seed …") | 16 |
| G10 Shipped lines | 16 | Listens to `public/assets/voice/*.opus` | OK, or bump a line's `take` | 16's `done` (17 may proceed) |
| G11 Final listening | 18 | Plays one short battle and one world-map session at default levels, judged by design §7.2 | Pass, or the cues to fix | 18's `done` |

If G1 is "none passes", steps 15 and 16 are not run: narration ships as framework only (no voiced beats), step 17 is tested with a fixture voice file in the browser test only, and the engine choice returns to the user (design §5.8.6).

## Requirement map

| Requirement | Acceptance | Steps |
| --- | --- | --- |
| R1 one cue table, one player, buses | AC1 | 02 (cue set), 05 |
| R2 battle sounds by weapon, outcome, armour, element, ability, tick, regen, fall, steps | AC2, AC3, AC5 | 06; content 08, 10, 11, 12 |
| R3 world-map sounds | AC4, AC5 | 07; content 13 |
| R4 encampment and interface sounds | AC5 | 07; content 09, 13 |
| R5 stings | AC2, AC5 | 06 (level-up), 09 |
| R6 variants, no repeat, jitter, no battle RNG | AC6 | 05 (picker), 06 (replay test) |
| R7 limits and limiter | AC7 | 05 |
| R8 build from recipes and sources, provenance, check | AC8, AC9 | 01, 02; every content step |
| R9 loudness targets and ceilings | AC9 | 01 (measure), 02 (enforce) |
| R10 Voice slider, defaults, music ducking | AC10 | 05 (slider, duck), 17 (duck under a line) |
| R11 beat fields and rules | AC11 | 14 |
| R12 offline render, only changed lines, staleness test | AC12 | 14 (test), 16 (render) |
| R13 designed voices, bake-off gate | AC13 | 03, 15, 16 |
| R14 StoryScene playback | AC14 | 17 |
| R15 provenance docs, `audio/CLAUDE.md`, root pointer | AC15 | 01, 02, every content step, 16, 18 |
| R16 degrade to silence | AC16, AC14 | 05, 17 |

## Completion criteria

- `npm test`, `npm run test:browser`, `npm run build`, `npm run sounds:check` and `uv run --project tools/audio pytest tools/audio/tests` pass on a clean tree.
- AC1 to AC16 each have their evidence in a step's execution record (step 18 collects them).
- Every W1 cue is built from real content (no recipe names a placeholder source); the placeholder WAVs are gone from `public/assets/audio/` and their `own` source entries are removed or no longer referenced (step 18 decides and documents).
- Gates G1 to G11 are recorded in the feature record.
- CLAUDE.md (root and `audio/`), `public/assets/audio/README.md`, `public/assets/voice/README.md` and the manual's Options line are current.

## Assumptions and open questions

None blocks a step. Defaults taken (from the design's §8 and from planning):

1. **W2 cues are left out** (design §2.3); the cue set is the 85 of C7.
2. **The neutral clip is chosen at G1** (from four candidates per narrator) rather than in a separate gate, so step 15 only designs the emotion clips against it.
3. **`world.source` is not ducked** under the Source cutscene's narration: design §5.5 ducks only music, which wins over §4.1.5's "ducked under its narration".
4. **Phaser 4 support** for `playAudioSprite` with `detune` and a reachable master gain node is verified in step 05; if the limiter cannot be inserted, step 05 drops it and records that AC7 rests on the loudness ceilings and voice limits (design §8 assumption).
5. **Placeholder recipes** in step 02 derive every cue from the eight existing WAVs and the two stings (licence `own`, as their README states), varied by pitch and filters so the correlation check passes; content steps replace them.
6. **Model ids and revisions** are pinned in step 03 after rechecking each model card's licence; if mlx-audio lacks Chatterbox, the PyTorch MPS package is used.

## For implementers

Set your step to `in progress` here when you start, `awaiting review` when it waits at its gate, and `done` with the commit hashes when finished. Record evidence (commands and their output, measurements, the gate's outcome as relayed to you), deviations and blockers in your task file's "Execution record". Keep this index short; every implementer reads it.
