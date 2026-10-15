import { storage } from '../storage.ts'
import { MUSIC_VOLUME, SOUND_VOLUME, type SoundKey } from './sounds.ts'

/** The player's volume levels, each from 0 (silent) to 1 (full). */
export interface AudioSettings {
  master: number
  effects: number
  music: number
}

export type AudioChannel = keyof AudioSettings

export const DEFAULT_AUDIO_SETTINGS: Readonly<AudioSettings> = { master: 1, effects: 1, music: 1 }

const STORAGE_KEY = 'yomi.audio'

let current: AudioSettings = { ...DEFAULT_AUDIO_SETTINGS }

function clampLevel(value: unknown, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback
  return Math.min(1, Math.max(0, value))
}

/** Reads saved settings, falling back to the defaults for anything missing or malformed. */
export function parseAudioSettings(raw: string | null): AudioSettings {
  let saved: Partial<Record<AudioChannel, unknown>> = {}
  try {
    const parsed: unknown = raw ? JSON.parse(raw) : {}
    if (parsed && typeof parsed === 'object') saved = parsed
  } catch {
    // A corrupt entry just means the defaults.
  }
  return {
    master: clampLevel(saved.master, DEFAULT_AUDIO_SETTINGS.master),
    effects: clampLevel(saved.effects, DEFAULT_AUDIO_SETTINGS.effects),
    music: clampLevel(saved.music, DEFAULT_AUDIO_SETTINGS.music),
  }
}

/** Loads the saved settings into the current ones. */
export function loadAudioSettings(): AudioSettings {
  let raw: string | null = null
  try {
    raw = storage()?.getItem(STORAGE_KEY) ?? null
  } catch {
    // Fall through to the defaults.
  }
  current = parseAudioSettings(raw)
  return getAudioSettings()
}

export function getAudioSettings(): AudioSettings {
  return { ...current }
}

/** Sets one channel's level, saves the settings and returns them. */
export function setAudioLevel(channel: AudioChannel, level: number): AudioSettings {
  current = { ...current, [channel]: clampLevel(level, current[channel]) }
  try {
    storage()?.setItem(STORAGE_KEY, JSON.stringify(current))
  } catch {
    // Unsaved settings still apply for this session.
  }
  return getAudioSettings()
}

/**
 * The volume to play a sound at: the music channel covers the battle and world
 * map themes and the victory and defeat stings, the effects channel everything
 * else. The master level is applied separately, as the sound manager's global volume.
 */
export function soundVolume(key: SoundKey, settings: AudioSettings = current): number {
  const base = key === 'music_battle' || key === 'music_world_map' ? MUSIC_VOLUME : SOUND_VOLUME
  return base * (key.startsWith('music_') ? settings.music : settings.effects)
}
