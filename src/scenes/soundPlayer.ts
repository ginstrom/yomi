import type Phaser from 'phaser'
import { MUSIC_GAIN, busVolume } from './audioSettings.ts'
import {
  CUES,
  admitPlay,
  cueBank,
  cueDurationMs,
  cueMarkers,
  newLimitState,
  newVariantState,
  pickVariant,
  type Bus,
  type CueId,
  type MusicKey,
  type SoundCue,
} from './sounds.ts'

/**
 * The one player: every sound the game makes goes through here, a cue from
 * `sounds.ts`'s table on its bus, a theme, or a voice line. It imports Phaser's
 * types only, so it is tested over a fake sound manager. Its state (the shuffle
 * bags, the voices sounding, the theme, the line, the log) is the module's, as
 * the game has one sound manager. Anything missing (a bank, a marker, a theme or
 * a line not loaded) is silence, never an exception.
 */

type Sound = Phaser.Sound.WebAudioSound | Phaser.Sound.HTML5AudioSound | Phaser.Sound.NoAudioSound

/** Music under a voice line drops this far, this fast, and comes back this slowly. */
export const DUCK_DB = -10
export const DUCK_ATTACK_MS = 150
export const DUCK_RELEASE_MS = 600

/** The safety limiter on the game's output (`installLimiter`). */
export const LIMITER = { thresholdDb: -6, kneeDb: 3, ratio: 20, attackMs: 3, releaseMs: 150 } as const

export interface AudioLogEntry {
  cue: string
  marker: string
  bus: Bus
  at: number
}

const LOG_LENGTH = 50

const variants = newVariantState()
const limits = newLimitState()
const log: AudioLogEntry[] = []
interface Theme {
  key: MusicKey
  sound: Sound
  ducked: boolean
  /** The level the running ramp is heading for. */
  rampTarget: number | null
  tween: Phaser.Tweens.Tween | null
  /** Takes the shutdown hook off the scene the running ramp belongs to. */
  unhook: (() => void) | null
}

let theme: Theme | null = null
let voice: { sound: Sound; scene: Phaser.Scene } | null = null
let compressor: DynamicsCompressorNode | null = null

const dB = (db: number) => 10 ** (db / 20)

/** Stops the theme's ramp, if any, and the hook that would finish it on a scene's shutdown. */
function endRamp(held: Theme): void {
  held.tween?.stop()
  held.tween = null
  held.unhook?.()
  held.unhook = null
  held.rampTarget = null
}

function record(entry: AudioLogEntry): void {
  log.push(entry)
  if (log.length > LOG_LENGTH) log.splice(0, log.length - LOG_LENGTH)
}

function playNow(scene: Phaser.Scene, cue: CueId): void {
  const bank = cueBank(cue)
  const spritemap = (scene.cache.json.get(bank) as { spritemap?: Record<string, unknown> } | undefined)?.spritemap
  if (!spritemap || !scene.cache.audio.exists(bank)) return
  // A play that is dropped gives its variant back, so the bag and `last` move only for sounds heard.
  const held = variants.bags.get(cue)
  const before = held && { bag: [...held.bag], last: held.last }
  const giveBack = () => {
    if (before) variants.bags.set(cue, before)
    else variants.bags.delete(cue)
  }
  const { marker, detune, volumeDb } = pickVariant(variants, cue, Math.random)
  if (!spritemap[marker]) return giveBack()
  const now = performance.now()
  const k = cueMarkers(cue).indexOf(marker)
  if (!admitPlay(limits, cue, now, now + cueDurationMs(cue, k))) return giveBack()
  const spec = CUES[cue]
  const volume = busVolume(spec.bus) * dB((spec.gainDb ?? 0) + volumeDb)
  try {
    scene.sound.playAudioSprite(bank, marker, { volume, detune })
  } catch {
    return giveBack()
  }
  record({ cue, marker, bus: spec.bus, at: now })
}

/** Plays a variant of the cue, now or after `delayMs` on the scene's clock. */
export function playCue(scene: Phaser.Scene, cue: CueId, delayMs = 0): void {
  if (delayMs > 0) scene.time.delayedCall(delayMs, () => playNow(scene, cue))
  else playNow(scene, cue)
}

export function playCues(scene: Phaser.Scene, cues: readonly SoundCue[]): void {
  for (const { cue, delayMs } of cues) playCue(scene, cue, delayMs)
}

// ---- music ----------------------------------------------------------------

function themeVolume(key: MusicKey, ducked: boolean): number {
  return busVolume('music') * MUSIC_GAIN[key] * (ducked ? dB(DUCK_DB) : 1)
}

/** Loops a theme in place of any other. */
export function startMusic(scene: Phaser.Scene, key: MusicKey): void {
  stopMusic()
  if (!scene.cache.audio.exists(key)) return
  try {
    const music = scene.sound.add(key, { loop: true, volume: themeVolume(key, false) })
    music.play()
    theme = { key, sound: music, ducked: false, rampTarget: null, tween: null, unhook: null }
  } catch {
    theme = null
  }
}

/** Under the menu the theme waits. */
export function pauseMusic(): void {
  theme?.sound.pause()
}

/** The theme goes on, at the level the menu may have changed. */
export function resumeMusic(): void {
  if (!theme) return
  applyVolumes()
  if (theme.sound.isPaused) theme.sound.resume()
}

/** Stops the theme; given a key, only if that theme is the one playing, so a scene shutting down stops its own and not the next scene's. */
export function stopMusic(key?: MusicKey): void {
  if (!theme || (key !== undefined && theme.key !== key)) return
  endRamp(theme)
  theme.sound.destroy()
  theme = null
}

/** The playing theme's volume now (for the dev hook only; game code never reads it). */
export function musicVolume(): number | null {
  return theme ? theme.sound.volume : null
}

/** After a slider moves, the playing theme and voice line take the new level. */
export function applyVolumes(): void {
  if (theme) {
    const target = themeVolume(theme.key, theme.ducked)
    // A ramp already heading for this level (a duck's release, when a scene resumes) runs on; a moved slider ends it.
    if (theme.tween && theme.rampTarget === target) {
      // leave it
    } else {
      endRamp(theme)
      theme.sound.setVolume(target)
    }
  }
  if (voice) voice.sound.setVolume(busVolume('voice'))
}

/** Lowers the theme under a voice line (`DUCK_DB` over `DUCK_ATTACK_MS`), or brings it back (over `DUCK_RELEASE_MS`). */
export function duck(scene: Phaser.Scene, on: boolean): void {
  if (!theme) return
  const held = theme
  endRamp(held)
  held.ducked = on
  const target = themeVolume(held.key, on)
  held.rampTarget = target
  // A scene shut down mid-ramp takes its tweens with it: the theme goes to where the ramp was heading.
  const onShutdown = () => {
    if (theme !== held) return
    endRamp(held)
    held.sound.setVolume(target)
  }
  held.tween = scene.tweens.add({
    targets: held.sound,
    volume: target,
    duration: on ? DUCK_ATTACK_MS : DUCK_RELEASE_MS,
    onComplete: () => {
      held.tween = null
      held.rampTarget = null
      held.unhook?.()
      held.unhook = null
    },
  })
  scene.events.once('shutdown', onShutdown)
  held.unhook = () => scene.events.off('shutdown', onShutdown)
}

// ---- voice ----------------------------------------------------------------

/** Plays a loaded voice line on the voice bus, in place of any other; false when the key is not loaded. */
export function playVoice(scene: Phaser.Scene, key: string): boolean {
  if (!scene.cache.audio.exists(key)) return false
  // At level 0 nothing plays, so nothing ducks under it.
  if (busVolume('voice') <= 0) return false
  stopVoice(0)
  try {
    const clip = scene.sound.add(key, { volume: busVolume('voice') })
    const line = { sound: clip, scene }
    clip.once('complete', () => {
      if (voice === line) voice = null
      clip.destroy()
    })
    clip.play()
    voice = line
  } catch {
    return false
  }
  record({ cue: key, marker: key, bus: 'voice', at: performance.now() })
  return true
}

/** Stops the line, fading it out over `fadeMs` (at once for 0), on `on`'s clock where given, else on the scene that played it. */
export function stopVoice(fadeMs: number, on?: Phaser.Scene): void {
  if (!voice) return
  const { sound } = voice
  const scene = on ?? voice.scene
  voice = null
  if (fadeMs <= 0) {
    sound.destroy()
    return
  }
  // The fade is the scene's tween; a scene shut down mid-fade destroys the sound at once.
  let done = false
  const finish = () => {
    if (done) return
    done = true
    scene.events.off('shutdown', finish)
    sound.destroy()
  }
  scene.events.once('shutdown', finish)
  scene.tweens.add({ targets: sound, volume: 0, duration: fadeMs, onComplete: finish })
}

export function voicePlaying(): boolean {
  return voice !== null && voice.sound.isPlaying
}

// ---- output ---------------------------------------------------------------

/**
 * Puts a limiter (a fast, hard compressor) between the sound manager's master
 * gain and the speakers, so that many sounds at once never clip. Without Web
 * Audio it does nothing, and the loudness ceilings and voice limits stand alone.
 */
export function installLimiter(game: Phaser.Game): void {
  const manager = game.sound as unknown as { context?: AudioContext; masterVolumeNode?: GainNode }
  const { context, masterVolumeNode } = manager
  if (!context?.createDynamicsCompressor || !masterVolumeNode) return
  const node = context.createDynamicsCompressor()
  node.threshold.value = LIMITER.thresholdDb
  node.knee.value = LIMITER.kneeDb
  node.ratio.value = LIMITER.ratio
  node.attack.value = LIMITER.attackMs / 1000
  node.release.value = LIMITER.releaseMs / 1000
  masterVolumeNode.disconnect()
  masterVolumeNode.connect(node)
  node.connect(context.destination)
  compressor = node
}

/** The limiter installed, if any (for the dev hook). */
export function limiter(): DynamicsCompressorNode | null {
  return compressor
}

/** The last 50 plays, oldest first (for the dev hook only; game code never reads it). */
export function audioLog(): readonly AudioLogEntry[] {
  return log.map((entry) => ({ ...entry }))
}
