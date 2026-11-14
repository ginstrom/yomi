import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type Phaser from 'phaser'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MUSIC_GAIN, busVolume } from './audioSettings.ts'

type Player = typeof import('./soundPlayer.ts')

const ROOT = join(import.meta.dirname, '../..')
const bankJson = (bank: string) => JSON.parse(readFileSync(join(ROOT, 'public/assets/audio/sfx', `${bank}.json`), 'utf8'))

interface FakeSound {
  key: string
  volume: number
  config: Record<string, unknown>
  isPlaying: boolean
  isPaused: boolean
  destroyed: boolean
  play(): boolean
  pause(): boolean
  resume(): boolean
  setVolume(volume: number): FakeSound
  destroy(): void
  once(event: string, fn: () => void): void
  complete?: () => void
}

function fakeSound(key: string, config: Record<string, unknown> = {}): FakeSound {
  const sound: FakeSound = {
    key,
    config,
    volume: (config.volume as number) ?? 1,
    isPlaying: false,
    isPaused: false,
    destroyed: false,
    play: () => ((sound.isPlaying = true), true),
    pause: () => ((sound.isPaused = true), (sound.isPlaying = false), true),
    resume: () => ((sound.isPaused = false), (sound.isPlaying = true), true),
    setVolume: (volume) => ((sound.volume = volume), sound),
    destroy: () => ((sound.destroyed = true), (sound.isPlaying = false)),
    once: (event, fn) => {
      if (event === 'complete') sound.complete = fn
    },
  }
  return sound
}

function fakeScene(json: Record<string, unknown> = { battle: bankJson('battle'), ui: bankJson('ui'), stings: bankJson('stings') }, audio = ['battle', 'ui', 'stings', 'music_battle', 'music_world_map', 'voice_intro.opening']) {
  const sprites: { key: string; marker: string; config: { volume: number; detune: number } }[] = []
  const added: FakeSound[] = []
  const delayed: { ms: number; fn: () => void }[] = []
  const tweens: { targets: unknown; volume: number; duration: number; onComplete?: () => void }[] = []
  const shutdown: (() => void)[] = []
  const ramps: { stopped: boolean }[] = []
  const scene = {
    events: {
      once: (_event: string, fn: () => void) => shutdown.push(fn),
      off: (_event: string, fn: () => void) => shutdown.splice(shutdown.indexOf(fn) >>> 0, 1),
    },
    sound: {
      playAudioSprite: (key: string, marker: string, config: { volume: number; detune: number }) => {
        sprites.push({ key, marker, config })
        return true
      },
      add: (key: string, config?: Record<string, unknown>) => {
        const sound = fakeSound(key, config)
        added.push(sound)
        return sound
      },
    },
    cache: {
      json: { get: (key: string) => json[key] },
      audio: { exists: (key: string) => audio.includes(key) },
    },
    time: { delayedCall: (ms: number, fn: () => void) => delayed.push({ ms, fn }) },
    tweens: {
      add: (config: { targets: unknown; volume: number; duration: number; onComplete?: () => void }) => {
        tweens.push(config)
        const tween = { stopped: false, stop: () => { tween.stopped = true } }
        ramps.push(tween)
        return tween
      },
    },
  }
  return { scene: scene as unknown as Phaser.Scene, sprites, added, delayed, tweens, shutdown, ramps }
}

let player: Player
let now = 0

beforeEach(async () => {
  vi.resetModules()
  player = await import('./soundPlayer.ts')
  now = 0
  vi.spyOn(performance, 'now').mockImplementation(() => now)
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('playCue', () => {
  it('plays a variant of the cue from its bank on its bus, jittered', () => {
    const { scene, sprites } = fakeScene()
    player.playCue(scene, 'battle.hit.slash')
    expect(sprites).toHaveLength(1)
    const [{ key, marker, config }] = sprites
    expect(key).toBe('battle')
    expect(marker).toMatch(/^battle\.hit\.slash#[0-5]$/)
    expect(Math.abs(config.detune)).toBeLessThanOrEqual(40)
    const db = 20 * Math.log10(config.volume / busVolume('effects'))
    expect(Math.abs(db)).toBeLessThanOrEqual(1.5 + 1e-9)
    expect(player.audioLog()).toEqual([{ cue: 'battle.hit.slash', marker, bus: 'effects', at: 0 }])
  })

  it('is silent, never throwing, when the bank, its audio or the marker is missing', () => {
    const noJson = fakeScene({})
    expect(() => player.playCue(noJson.scene, 'ui.click')).not.toThrow()
    const noAudio = fakeScene({ ui: bankJson('ui') }, [])
    expect(() => player.playCue(noAudio.scene, 'ui.click')).not.toThrow()
    const noMarker = fakeScene({ ui: { resources: [], spritemap: {} } })
    expect(() => player.playCue(noMarker.scene, 'ui.click')).not.toThrow()
    for (const { sprites } of [noJson, noAudio, noMarker]) expect(sprites).toEqual([])
    expect(player.audioLog()).toEqual([])
  })

  it('plays a delayed cue through the scene’s clock', () => {
    const { scene, sprites, delayed } = fakeScene()
    player.playCues(scene, [
      { cue: 'battle.swing.blade', delayMs: 0 },
      { cue: 'battle.hit.slash', delayMs: 180 },
    ])
    expect(sprites.map((s) => s.marker.split('#')[0])).toEqual(['battle.swing.blade'])
    expect(delayed.map((d) => d.ms)).toEqual([180])
    delayed[0].fn()
    expect(sprites.map((s) => s.marker.split('#')[0])).toEqual(['battle.swing.blade', 'battle.hit.slash'])
  })

  it('drops plays beyond the cue’s voices, and admits again once one ends', () => {
    const { scene, sprites } = fakeScene()
    for (let i = 0; i < 20; i++) player.playCue(scene, 'battle.hit.slash')
    expect(sprites).toHaveLength(3)
    now = 1000
    player.playCue(scene, 'battle.hit.slash')
    expect(sprites).toHaveLength(4)
  })

  it('logs the last 50 plays', () => {
    const { scene } = fakeScene()
    for (let i = 0; i < 60; i++) {
      now = i * 1000
      player.playCue(scene, 'ui.click')
    }
    const log = player.audioLog()
    expect(log).toHaveLength(50)
    expect(log[0].at).toBe(10_000)
    expect(log[49].at).toBe(59_000)
  })
})

describe('music', () => {
  it('loops one theme at its level, and replaces it with the next', () => {
    const { scene, added } = fakeScene()
    player.startMusic(scene, 'music_world_map')
    expect(added[0].key).toBe('music_world_map')
    expect(added[0].config.loop).toBe(true)
    expect(added[0].volume).toBeCloseTo(busVolume('music') * MUSIC_GAIN.music_world_map)
    expect(added[0].isPlaying).toBe(true)
    player.startMusic(scene, 'music_battle')
    expect(added[0].destroyed).toBe(true)
    expect(added[1].volume).toBeCloseTo(busVolume('music') * MUSIC_GAIN.music_battle)
  })

  it('pauses and resumes the theme; stopping another scene’s theme leaves it playing', () => {
    const { scene, added } = fakeScene()
    player.startMusic(scene, 'music_battle')
    player.pauseMusic()
    expect(added[0].isPaused).toBe(true)
    player.resumeMusic()
    expect(added[0].isPlaying).toBe(true)
    player.stopMusic('music_world_map')
    expect(added[0].destroyed).toBe(false)
    player.stopMusic()
    expect(added[0].destroyed).toBe(true)
    expect(() => player.pauseMusic()).not.toThrow()
  })

  it('stays silent for a theme not loaded', () => {
    const { scene, added } = fakeScene({}, [])
    expect(() => player.startMusic(scene, 'music_battle')).not.toThrow()
    expect(added).toEqual([])
  })

  it('ducks 10 dB in 150 ms and comes back in 600 ms', () => {
    const { scene, added, tweens } = fakeScene()
    player.startMusic(scene, 'music_battle')
    const level = busVolume('music') * MUSIC_GAIN.music_battle
    player.duck(scene, true)
    expect(tweens[0].targets).toBe(added[0])
    expect(20 * Math.log10(tweens[0].volume / level)).toBeCloseTo(-10, 0)
    expect(tweens[0].duration).toBe(150)
    player.duck(scene, false)
    expect(tweens[1].volume).toBeCloseTo(level)
    expect(tweens[1].duration).toBe(600)
  })
})

describe('voice', () => {
  it('returns false for a line not loaded, and plays one that is', () => {
    const { scene, added } = fakeScene()
    expect(player.playVoice(scene, 'voice_missing')).toBe(false)
    expect(player.voicePlaying()).toBe(false)
    expect(player.playVoice(scene, 'voice_intro.opening')).toBe(true)
    expect(added[0].volume).toBeCloseTo(busVolume('voice'))
    expect(player.voicePlaying()).toBe(true)
    player.stopVoice(0)
    expect(added[0].destroyed).toBe(true)
    expect(player.voicePlaying()).toBe(false)
  })

  it('fades a line out before stopping it, and forgets one that ended', () => {
    const { scene, added, tweens } = fakeScene()
    player.playVoice(scene, 'voice_intro.opening')
    player.stopVoice(80)
    expect(tweens[0]).toMatchObject({ targets: added[0], volume: 0, duration: 80 })
    tweens[0].onComplete?.()
    expect(added[0].destroyed).toBe(true)
    player.playVoice(scene, 'voice_intro.opening')
    added[1].complete?.()
    expect(player.voicePlaying()).toBe(false)
  })
})

describe('voice edge cases', () => {
  it('plays nothing at voice level 0, so nothing ducks under it', async () => {
    const settings = await import('./audioSettings.ts')
    settings.setAudioLevel('voice', 0)
    const { scene, added } = fakeScene()
    expect(player.playVoice(scene, 'voice_intro.opening')).toBe(false)
    expect(added).toEqual([])
    expect(player.voicePlaying()).toBe(false)
  })

  it('stops with nothing playing without throwing', () => {
    expect(() => player.stopVoice(80)).not.toThrow()
    expect(() => player.stopVoice(0)).not.toThrow()
  })

  it('destroys a fading line when its scene shuts down mid-fade', () => {
    const { scene, added, shutdown } = fakeScene()
    player.playVoice(scene, 'voice_intro.opening')
    player.stopVoice(80)
    expect(added[0].destroyed).toBe(false)
    shutdown.forEach((fn) => fn())
    expect(added[0].destroyed).toBe(true)
  })

  it('takes the theme to its ducked level when its scene shuts down mid-duck', () => {
    const { scene, added, shutdown } = fakeScene()
    player.startMusic(scene, 'music_battle')
    player.duck(scene, true)
    shutdown.forEach((fn) => fn())
    expect(added[0].volume).toBeCloseTo(busVolume('music') * MUSIC_GAIN.music_battle * 10 ** (-10 / 20))
  })
})

describe('review round 1', () => {
  it('keeps one shutdown hook for the theme’s ramp however often it ducks', () => {
    const { scene, shutdown } = fakeScene()
    player.startMusic(scene, 'music_battle')
    player.duck(scene, true)
    player.duck(scene, false)
    player.duck(scene, true)
    expect(shutdown).toHaveLength(1)
  })

  it('drops the ramp’s hook when the ramp ends', () => {
    const { scene, tweens, shutdown } = fakeScene()
    player.startMusic(scene, 'music_battle')
    player.duck(scene, true)
    tweens[0].onComplete?.()
    expect(shutdown).toHaveLength(0)
  })

  it('leaves a replaced theme alone when the old ramp’s scene shuts down', () => {
    const { scene, added, shutdown } = fakeScene()
    player.startMusic(scene, 'music_battle')
    player.duck(scene, true)
    const stale = [...shutdown]
    player.stopMusic()
    player.startMusic(scene, 'music_world_map')
    const level = added[1].volume
    stale.forEach((fn) => fn())
    expect(added[1].volume).toBe(level)
    expect(shutdown).toHaveLength(0)
  })

  it('fades a line on the scene it is given, which can outlive the one that played it', () => {
    const first = fakeScene()
    const second = fakeScene()
    player.playVoice(first.scene, 'voice_intro.opening')
    player.stopVoice(80, second.scene)
    expect(first.tweens).toHaveLength(0)
    expect(second.tweens[0]).toMatchObject({ targets: first.added[0], volume: 0, duration: 80 })
  })
})

describe('installLimiter', () => {
  it('puts a compressor between the master gain and the destination', () => {
    const param = () => ({ value: 0 })
    const compressor = { threshold: param(), knee: param(), ratio: param(), attack: param(), release: param(), connect: vi.fn() }
    const destination = {}
    const master = { disconnect: vi.fn(), connect: vi.fn() }
    const game = { sound: { context: { destination, createDynamicsCompressor: () => compressor }, masterVolumeNode: master } }
    player.installLimiter(game as unknown as Phaser.Game)
    expect(master.disconnect).toHaveBeenCalled()
    expect(master.connect).toHaveBeenCalledWith(compressor)
    expect(compressor.connect).toHaveBeenCalledWith(destination)
    expect(compressor.threshold.value).toBe(-6)
    expect(compressor.knee.value).toBe(3)
    expect(compressor.ratio.value).toBe(20)
    expect(compressor.attack.value).toBeCloseTo(0.003)
    expect(compressor.release.value).toBeCloseTo(0.15)
    expect(player.limiter()).toBe(compressor)
  })

  it('does nothing without Web Audio', () => {
    expect(() => player.installLimiter({ sound: {} } as unknown as Phaser.Game)).not.toThrow()
    expect(player.limiter()).toBeNull()
  })
})

describe('overall review fixes', () => {
  it('lets the duck’s release run on when the scene resumes the music', () => {
    const { scene, ramps } = fakeScene()
    player.startMusic(scene, 'music_battle')
    player.duck(scene, true)
    player.duck(scene, false)
    player.resumeMusic()
    expect(ramps[1].stopped).toBe(false)
  })

  it('still ends a ramp, at the new level, when a slider moves the level it heads for', async () => {
    const { scene, ramps, added } = fakeScene()
    const settings = await import('./audioSettings.ts')
    player.startMusic(scene, 'music_battle')
    player.duck(scene, true)
    settings.setAudioLevel('music', 0.5)
    player.applyVolumes()
    expect(ramps[0].stopped).toBe(true)
    expect(added[0].volume).toBeCloseTo(settings.busVolume('music') * settings.MUSIC_GAIN.music_battle * 10 ** (-10 / 20))
  })

  it('does not spend a variant on a play the voice limits refuse', () => {
    const { scene, sprites } = fakeScene()
    const cue = 'battle.hit.slash'
    for (let i = 0; i < 40; i++) player.playCue(scene, cue)
    now += 100000
    for (let i = 0; i < 40; i++) player.playCue(scene, cue)
    // three voices at most each time: the six that sounded are one bag, every variant once
    expect(sprites).toHaveLength(6)
    expect(new Set(sprites.map((s) => s.marker)).size).toBe(6)
  })
})
