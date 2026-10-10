import { describe, expect, it } from 'vitest'
import { DEFAULT_AUDIO_SETTINGS, parseAudioSettings, soundVolume } from './audioSettings.ts'
import { MUSIC_VOLUME, SOUND_VOLUME } from './sounds.ts'

describe('parseAudioSettings', () => {
  it('defaults when nothing is saved or the entry is corrupt', () => {
    expect(parseAudioSettings(null)).toEqual(DEFAULT_AUDIO_SETTINGS)
    expect(parseAudioSettings('not json')).toEqual(DEFAULT_AUDIO_SETTINGS)
    expect(parseAudioSettings('42')).toEqual(DEFAULT_AUDIO_SETTINGS)
  })

  it('keeps saved levels, clamping them and filling in any that are missing or malformed', () => {
    expect(parseAudioSettings('{"master":0.5,"effects":2,"music":"loud"}')).toEqual({
      master: 0.5,
      effects: 1,
      music: DEFAULT_AUDIO_SETTINGS.music,
    })
    expect(parseAudioSettings('{"music":-1}').music).toBe(0)
  })
})

describe('soundVolume', () => {
  const settings = { master: 0.3, effects: 0.5, music: 0.25 }

  it('scales effects by the effects level', () => {
    expect(soundVolume('sfx_hit_impact', settings)).toBeCloseTo(SOUND_VOLUME * 0.5)
  })

  it('puts the battle theme and the stings on the music level', () => {
    expect(soundVolume('music_battle', settings)).toBeCloseTo(MUSIC_VOLUME * 0.25)
    expect(soundVolume('music_victory', settings)).toBeCloseTo(SOUND_VOLUME * 0.25)
  })
})
