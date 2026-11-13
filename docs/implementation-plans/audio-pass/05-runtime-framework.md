# Step 05: Runtime framework

[Index](index.md) · [Design](../../designs/audio-pass.md) §4.4, §4.7, §5.3, §5.4, §5.5 · [Architecture brief](../../architecture/audio-pass.md) §3.5

## Objective

Every sound the game plays becomes a **cue** from one cue table, played through one thin player on a declared bus, from the banks step 02 built over today's placeholders. Variant choice (shuffle bag), pitch and volume jitter, per-cue and global voice limits, a safety limiter, a Voice slider, music handled by the player (ready to duck), and a dev audio log for the in-browser tests all land now, before any real content, so that later content steps only replace recipes. The game sounds as today (more varied in pitch and timing), and no scene calls `sound.play` with a raw key.

Covers R1, R6 (picker), R7, R10 (slider and duck mechanism), R16; AC1, AC6 (picker part), AC7, AC10 (settings and duck), AC16.

## Requirements and context

- **R1:** every play is a cue from `CUES` on a bus (`effects`, `ui`, `music`, `voice`); no scene calls `sound.play`/`sound.add` with a raw key.
- **R6:** each cue has several variants; a play never repeats the variant just played (a one-variant cue excepted), adds a detune drawn uniformly from ±`detuneCents` and a volume offset from ±`volumeJitterDb`. Randomness comes from `Math.random` held by the player; the battle's `mulberry32` (and the world RNG) are never passed to or reachable from audio code.
- **Shuffle bag (design §4.4):** per cue, all markers in a random order, refilled when empty, never starting a new bag with the marker that ended the last one. Over n plays of a cue with v variants each marker is used `floor(n/v)` or `ceil(n/v)` times.
- **R7 limits:** a cue may declare `maxVoices` (simultaneous plays of that cue; a play beyond it is dropped) and `minGapMs` (a play within that time of the cue's last start is dropped). Defaults: steps `maxVoices` 3, every `impact`-group cue 3, `battle.element.*` 2. A global cap of `GLOBAL_VOICE_CAP` (24) effects-and-ui voices drops the newest beyond it. Music and voice buses are not counted.
- **Limiter:** with Web Audio, a `DynamicsCompressorNode` between Phaser's master gain and the destination (threshold −6 dBFS, knee 3, ratio 20, attack 3 ms, release 150 ms).
- **R10:** four sliders, Master, Sound FX, Music, Voice. Sound FX covers the `effects` and `ui` buses (D6). Releasing Master or Sound FX plays `ui.click` at the new level, as today; releasing Voice plays nothing. Saved settings without `voice` load it at 1. Music ducks −10 dB (attack 150 ms, release 600 ms) while a voice line plays (the mechanism lands now; step 17 drives it).
- **R16:** a missing bank, marker or voice key degrades to silence, never an exception.
- **Music level (design §5.5):** the themes are not re-encoded. Measure each theme's LUFS-I once and set `MUSIC_BASE = 10^((-24 - measured)/20)`: one value if the two themes are within 1 LU of each other, else a per-theme gain (`MUSIC_GAIN: Record<MusicKey, number>` in `audioSettings.ts`, applied by the player on top of `busVolume('music')`). Record the measurement in `public/assets/audio/README.md`. Today's `MUSIC_VOLUME` 0.2 is the reference to compare by ear (note the computed value beside it in the execution record).
- **No save or log change:** `SAVE_VERSION` and `LOG_SCHEMA_VERSION` untouched; `yomi.audio` in `localStorage` gains `voice`.

### Current system (inspected at `e102569`)

- `src/scenes/sounds.ts`: `SOUND_KEYS` (8 `sfx_*`, `music_victory`, `music_defeat`, `music_battle`, `music_world_map`), `SoundKey`, `soundFiles`, `SoundCue { key, delayMs }`, `STING_DELAY_MS` 450, `SOUND_VOLUME` 0.4, `MUSIC_VOLUME` 0.2, `eventSounds(event)`.
- `src/scenes/audioSettings.ts`: `AudioSettings { master, effects, music }`, `parseAudioSettings`, `loadAudioSettings`, `getAudioSettings`, `setAudioLevel`, `soundVolume(key)` (channel by key prefix). Master is applied as `sound.volume` (`BootScene.create`, `MenuScene` line ~328).
- `BootScene.preload` loads every `SOUND_KEYS` entry with `load.audio(key, soundFiles(key))`.
- Direct play sites (all `sound.play('sfx_ui_click', { volume: soundVolume('sfx_ui_click') })` unless noted):
  - `PartyScene.ts:259`
  - `PartyListView.ts:164`
  - `InventoryScene.ts:545, 800, 958, 1439, 1447`; `:983` plays `sfx_heal` for a world-map cast
  - `TradingPostScene.ts:363`
  - `BattleScene.ts`: `:503` `sound.add('music_battle', …)`, `:802` and `:1990` `playSound('sfx_ui_click')`, `:1373` the cue loop over `eventSounds(event)` (`time.delayedCall` for delays), `:2082` `playSound`, `:2088` music volume reapplied; `:1372` stops the theme on `battle_end`
  - `PartyColumn.ts:72`
  - `WorldScene.ts`: `:408` `sound.add('music_world_map', …)` (paused under the menu), `:747`, `:1482` music volume reapplied
  - `EncampmentScene.ts:213`
  - `MenuScene.ts:171`, `:337` (slider release), `:328` master volume
  - `GuildHallScene.ts:242, 302, 333`
  - `CraftingScene.ts:466`
  - `panelButton.ts:44`
  - `ExchangeScene.ts:169, 186, 223`
  Line numbers are approximate; grep `sound\.\(play\|add\)\|soundVolume\|playSound` to find them all.
- `src/testHook.ts` defines the `window.__yomi` hook, installed by `main.ts` in dev builds only.
- `tsconfig.json` has no `resolveJsonModule`.

## Dependencies and prerequisites

- **Step 02 (required):** `audio/sfx.manifest.json` with all 85 W1 cues of C7 and the four banks `public/assets/audio/sfx/{ui,battle,world,stings}.{opus,mp3,json}` committed, built over the placeholders. Check before starting: `npm run sounds:check` passes. If 02 is not done, stop.
- Node 26: prefix every npm/node command with `PATH=/opt/homebrew/opt/node@26/bin:$PATH`.
- `ffmpeg` (host) for the music measurement only.

## Contracts (copy of the index; do not change)

### C6. Bank shape (produced by step 02; consumed here)

Bank files `public/assets/audio/sfx/<bank>.opus`, `.mp3` and `<bank>.json` in Phaser's audio-sprite shape: `{ "resources": ["<bank>.opus", "<bank>.mp3"], "spritemap": { "<cue>#<k>": { "start": s, "end": s, "loop": false } } }` (seconds; k from 0). `audio/sfx.manifest.json`:

```json
{ "version": 1, "tool": "yomi-audio 0.1.0",
  "banks": { "battle": { "durationMs": 121400, "opus": { "bytes": 0, "sha256": "…" }, "mp3": { "bytes": 0, "sha256": "…" } } },
  "cues": { "battle.hit.slash": { "bank": "battle", "markers": ["battle.hit.slash#0", "…"], "durationsMs": [312, "…"], "inputs": "<sha256>" } } }
```

### C7. The W1 catalogue

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

(Cue id = `<bank>.<name>`.) A one-variant cue is exempt from "never repeat".

### C8. Runtime (`src/scenes/`)

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

Produced for later steps: everything in C8 marked step 05 (unmarked above); steps 06 and 07 extend `sounds.ts` only; step 17 uses `playVoice`, `stopVoice`, `voicePlaying`, `duck`.

## Scope and implementation guidance

1. **`tsconfig.json`:** add `"resolveJsonModule": true`. Confirm `tsc` and Vite both import `audio/sfx.manifest.json` (outside `include`; an import is enough). `CueId` must come out as a literal union (check with a deliberate bad id in a scratch test that `tsc` rejects, then remove it).
2. **`sounds.ts`:** replace `SOUND_KEYS`/`SoundKey`/`soundFiles`/`SOUND_VOLUME`/`MUSIC_VOLUME` with the C8 exports. Write `CUES` explicitly per cue or build it from the manifest with the defaults; either way `Record<CueId, CueSpec>` must make a missing or extra cue a type error. The impact group per cue is C7's table (keep a small `IMPACT_CUES` set or similar; the manifest has no group). `pickVariant` uses the shuffle bag, takes `random` (never a seeded battle stream), returns `detune` in cents and `volumeDb` in dB within ±range (0 when the range is 0). `admitPlay` records the play when it admits it (it is the only mutation point); entries end at `endsAtMs` (the player passes now + the marker's duration from `durationsMs`, plus the delay). Interim `eventSounds(event)` per the C8 note, returning `{ cue, delayMs }`; keep `impactMs` timing from `battleEffects.ts`.
3. **`audioSettings.ts`:** add `voice` (parse, default 1, clamp), `BUS_BASE`, `busVolume`, `MUSIC_BASE` (and `MUSIC_GAIN` only if the themes differ by more than 1 LU). Remove `soundVolume`. Measure: `ffmpeg -nostats -i public/assets/audio/music_battle.opus -filter_complex ebur128 -f null - 2>&1 | tail -12` (and the world theme); use the "Integrated loudness I:" value. Record both numbers, the formula and the resulting constant in `public/assets/audio/README.md`.
4. **`soundPlayer.ts`:** module state (variant state, limit state, the current theme, the current voice line, the log), keyed to the game's single sound manager. Import Phaser **as types only**, so `soundPlayer.test.ts` runs in the `domain` project against a fake scene/manager (an object with `sound.playAudioSprite`, `sound.add`, `sound.get`, `sound.game.cache.json`/`audio` lookups as needed, `time.delayedCall`, `tweens.add`). Check whether the bank and marker exist before playing (the bank's JSON in the cache, the marker in it); return quietly otherwise. Volume = `busVolume(bus) × 10^((gainDb + volumeDb)/20)`; `detune` from `pickVariant`. Delays through `scene.time.delayedCall`. Music: one registered theme; `startMusic` replaces `BattleScene`'s and `WorldScene`'s own handles (loop, `busVolume('music')` × any `MUSIC_GAIN`); `pauseMusic`/`resumeMusic` replace the menu pause behaviour; `stopMusic` on `battle_end` and scene shutdown. `duck` tweens the theme's volume to the ducked level and back (constants −10 dB, 150 ms, 600 ms; step 17 will import the same values from `storyAudio.ts`, so define them here and let step 17 re-export or reference them, without changing the numbers). `playVoice` plays a loaded key on the voice bus and returns false when it is not in the cache; `stopVoice(fadeMs)` fades and stops; `voicePlaying()`. Log every admitted play `{ cue, marker, bus, at }`, keeping the last 50.
5. **`installLimiter(game)`:** with `WebAudioSoundManager`, create a `DynamicsCompressorNode` with the C8 settings and insert it between the manager's master gain (`masterVolumeNode` or Phaser 4's equivalent: verify by reading `node_modules/phaser/src/sound/webaudio/WebAudioSoundManager.js`) and `context.destination`. With no Web Audio, or if the node cannot be reached, do nothing and record in the execution record that AC7 rests on loudness ceilings and voice limits (index assumption 4). Also verify Phaser 4's `playAudioSprite` accepts `detune` in its config; if not, apply detune on the returned sound (`setDetune`), and record which.
6. **`BootScene`:** preload banks with `load.audioSprite(bank, bankFiles(bank).json, bankFiles(bank).audio)` and themes with `load.audio(key, musicFiles(key))`; `create` calls `installLimiter(this.game)` before anything plays and keeps `sound.volume = loadAudioSettings().master`.
7. **Call sites:** every site in the inspected list goes through `playCue(scene, 'ui.click')`, keeping today's semantics exactly (step 07 picks back/tab/confirm/error); `InventoryScene`'s world-map cast plays `battle.impact.heal`. `BattleScene`: the cue loop becomes `playCues(this, eventSounds(event))`; `playSound` is deleted; music through `startMusic(this, 'music_battle')`/`stopMusic`. `WorldScene`: `startMusic(this, 'music_world_map')`, `pauseMusic`/`resumeMusic` where it paused and resumed under the menu; where the scenes reapplied the theme's volume after the menu, call `applyVolumes()`.
8. **`MenuScene`:** `SLIDERS` gains Voice (channel `voice`); releasing Master or Sound FX plays `ui.click` (through `playCue`) at the new level; releasing Voice plays nothing; any slider calls `applyVolumes()`; Master still sets `sound.volume`. Check the options view still fits at 840×560 with four rows; its probe lists the four sliders.
9. **Dev hook:** `testHook.ts` gains `audioLog(): AudioLogEntry[]` on `window.__yomi` (plain data, a copy); installed only through `main.ts`'s existing `import.meta.env.DEV` path.
10. **Delete** `public/assets/audio/sfx_*.wav`, `music_victory.wav`, `music_defeat.wav`. Their content lives on as step 02's `own` sources under `audio/sources/`. Update `public/assets/audio/README.md`: the WAV table goes; the themes stay; the banks are described (generated by `npm run sounds`, sources in `audio/sources.toml`); the music measurement is recorded.
11. **Exclusions:** no context-aware battle mapping (step 06), no world sounds or refined UI cues (step 07), no story playback (step 17), no recipe or bank changes (if a bank defect blocks this step, record it and fix it in step 02's files with a separate commit named for step 02's follow-up).

## Verification

Write tests first and see them fail.

- **Domain (`npx vitest run --project domain`):**
  - `sounds.test.ts` (rewritten): every `CueId` has markers in the manifest and each marker exists in its bank's `public/assets/audio/sfx/<bank>.json` spritemap; every bank file in the manifest exists on disk; `CUES` defaults (buses by prefix, detune and jitter values, `maxVoices` per C8); interim `eventSounds` cues and delays for an attack hit, crit and miss, a friendly and a hostile cast, an ability, a tick, regeneration, a fall, both battle ends.
  - **AC6 (picker):** 10 000 plays of a 2-variant and a 6-variant cue never return the marker just played; each marker's count within ±1 of n/v at every bag boundary (and overall within `floor(n/v)`..`ceil(n/v)` at multiples of v); detune and `volumeDb` within the cue's ranges and 0 for stings; a one-variant cue returns its marker every time. A test that `sounds.ts` and `soundPlayer.ts` never import `mulberry32` or `src/engine` RNG (a source-text check is acceptable).
  - `admitPlay`: `maxVoices` drops the fourth concurrent step and admits it after one ends; `minGapMs` drops a play within the gap; the global cap drops the 25th concurrent effects/ui play; music- and voice-bus cues are not counted.
  - `audioSettings.test.ts` **AC10:** `parseAudioSettings('{"master":0.5,"effects":1,"music":1}')` gives `voice: 1`; corrupt and out-of-range values clamp; `busVolume` reads the right channel per bus and multiplies `BUS_BASE`.
  - `soundPlayer.test.ts` over a fake manager **AC16:** a missing bank JSON and a missing marker produce no exception and no play; `playVoice` of an unloaded key returns false; a delayed cue goes through `delayedCall`; limits drop excess plays; `duck(true)` targets `busVolume('music') × 10^(-10/20)` (±1 dB) with 150 ms, `duck(false)` returns with 600 ms; the log keeps the last 50.
  - **AC1:** a test that reads every `src/**/*.ts` (not tests) and finds no `sound.play(`, no `sound.add(` outside `soundPlayer.ts`, and no `sfx_`.
- **Browser (`npm run test:browser`; read `e2e/CLAUDE.md` first):** the four banks and both themes load at boot (no loader error; `audioLog` callable); the options view shows four sliders (Master, Sound FX, Music, Voice) and Voice persists; a menu click logs `ui.click`; an attack in a battle logs `battle.swing.blade` and an outcome cue; **AC7:** 20 `battle.hit.slash` plays within 1 s through the player (via a dev-only hook call or the debug path you add to `testHook.ts`) log at most `maxVoices` concurrent, and either the limiter node is present with reduction engaged or a captured `AudioContext` output has no sample above 0 dBFS. Headless Chromium plays Web Audio only after a first user gesture; click first.
- `npm test`, `npm run test:browser`, `npm run build`, `npm run sounds:check` pass.
- **By ear (optional, user):** the battle and world themes sit under the effects at default levels, comparable to today's `MUSIC_VOLUME` 0.2; note any concern for gate G11.

## Docs to update in this commit

- Root `CLAUDE.md`: the scene layer's helper list (`sounds.ts` now the cue table, `pickVariant`, limits; `soundPlayer.ts` the one player, Phaser types only, music, ducking, limiter, audio log; `audioSettings.ts` with the voice bus and `busVolume`); "Assets and docs" (`BootScene` preloads the four SFX banks as audio sprites and the two themes; `SOUND_KEYS` gone; a new sound is a recipe plus a `CUES` entry); the scene-layer sentence on the menu's sliders if any. Search it for `SOUND_KEYS`, `SoundKey`, `soundVolume`, `soundFiles`, `SOUND_VOLUME`, `MUSIC_VOLUME`, `sfx_`, `music_victory`, `music_defeat`, `playSound` and fix every line.
- `e2e/CLAUDE.md`: `__yomi.audioLog()` and how to assert on sounds.
- `docs/manual/README.md`: the Options line names Voice ("master channel, sound effects, music and voice"). Screenshots are retaken in step 18.
- `public/assets/audio/README.md` as in scope item 10.

## Completion criteria

- [ ] C8's step-05 contracts exist exactly as written; tests seen failing first.
- [ ] AC1, AC6 (picker), AC7 (or the documented fallback), AC10 (settings, duck mechanism), AC16 evidenced.
- [ ] Placeholder WAVs deleted; README records the music measurement and `MUSIC_BASE`.
- [ ] `npm test`, `npm run test:browser`, `npm run build`, `npm run sounds:check` pass.
- [ ] CLAUDE.md, `e2e/CLAUDE.md` and the manual's Options line updated.
- [ ] One commit `Audio pass step 05: Runtime framework` on `audio-pass` (not pushed); index status and hash updated.

## Execution record

