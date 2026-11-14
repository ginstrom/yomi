import { describe, expect, it } from 'vitest'
import { BUS_BASE, DEFAULT_AUDIO_SETTINGS, MUSIC_BASE, MUSIC_GAIN, busVolume, parseAudioSettings } from './audioSettings.ts'

describe('parseAudioSettings', () => {
  it('defaults when nothing is saved or the entry is corrupt', () => {
    expect(parseAudioSettings(null)).toEqual(DEFAULT_AUDIO_SETTINGS)
    expect(parseAudioSettings('not json')).toEqual(DEFAULT_AUDIO_SETTINGS)
    expect(parseAudioSettings('42')).toEqual(DEFAULT_AUDIO_SETTINGS)
    expect(DEFAULT_AUDIO_SETTINGS).toEqual({ master: 1, effects: 1, music: 1, voice: 1 })
  })

  it('loads settings saved before the voice channel with voice at full', () => {
    expect(parseAudioSettings('{"master":0.5,"effects":1,"music":1}')).toEqual({ master: 0.5, effects: 1, music: 1, voice: 1 })
  })

  it('keeps saved levels, clamping them and filling in any that are missing or malformed', () => {
    expect(parseAudioSettings('{"master":0.5,"effects":2,"music":"loud","voice":0.3}')).toEqual({
      master: 0.5,
      effects: 1,
      music: DEFAULT_AUDIO_SETTINGS.music,
      voice: 0.3,
    })
    expect(parseAudioSettings('{"music":-1}').music).toBe(0)
    expect(parseAudioSettings('{"voice":7}').voice).toBe(1)
    expect(parseAudioSettings('{"voice":null}').voice).toBe(1)
  })
})

describe('busVolume', () => {
  const settings = { master: 0.3, effects: 0.5, music: 0.25, voice: 0.8 }

  it('puts the effects and ui buses on the Sound FX level', () => {
    expect(busVolume('effects', settings)).toBeCloseTo(0.5 * BUS_BASE.effects)
    expect(busVolume('ui', settings)).toBeCloseTo(0.5 * BUS_BASE.ui)
  })

  it('puts the music bus on the music level and the voice bus on the voice level', () => {
    expect(busVolume('music', settings)).toBeCloseTo(0.25 * BUS_BASE.music)
    expect(busVolume('voice', settings)).toBeCloseTo(0.8 * BUS_BASE.voice)
  })

  it('bases every bus at unity but music, and brings each theme to −24 LUFS', () => {
    expect(BUS_BASE).toEqual({ effects: 1, ui: 1, voice: 1, music: MUSIC_BASE })
    // Measured LUFS-I (public/assets/audio/README.md): battle −14.2, world map −11.7.
    expect(20 * Math.log10(MUSIC_BASE * MUSIC_GAIN.music_battle)).toBeCloseTo(-24 + 14.2, 1)
    expect(20 * Math.log10(MUSIC_BASE * MUSIC_GAIN.music_world_map)).toBeCloseTo(-24 + 11.7, 1)
  })
})
