import { storage } from '../storage.ts'
import type { Bus, MusicKey } from './sounds.ts'

/** The player's volume levels, each from 0 (silent) to 1 (full). */
export interface AudioSettings {
  master: number
  effects: number
  music: number
  voice: number
}

export type AudioChannel = keyof AudioSettings

export const DEFAULT_AUDIO_SETTINGS: Readonly<AudioSettings> = { master: 1, effects: 1, music: 1, voice: 1 }

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
    voice: clampLevel(saved.voice, DEFAULT_AUDIO_SETTINGS.voice),
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
 * The music bus's base. The two themes are not re-encoded, and they measure
 * 2.5 LU apart (public/assets/audio/README.md), so each has its own gain in
 * `MUSIC_GAIN` instead and the bus itself sits at unity, which also leaves the
 * stings (on this bus, normalised to −18 LUFS-I by the build) as built.
 */
export const MUSIC_BASE = 1

/**
 * Each theme's gain, bringing it to −24 LUFS-I as played: 10^((−24 − measured)/20),
 * measured −14.2 LUFS-I for the battle theme and −11.7 for the world map's.
 * The player applies it on top of `busVolume('music')`.
 */
export const MUSIC_GAIN: Record<MusicKey, number> = {
  music_battle: 10 ** ((-24 + 14.2) / 20),
  music_world_map: 10 ** ((-24 + 11.7) / 20),
}

/** Each bus's level at full volume: the sound effects' banks are normalised by the build, so they play as built. */
export const BUS_BASE: Record<Bus, number> = { effects: 1, ui: 1, voice: 1, music: MUSIC_BASE }

/**
 * A bus's volume: Sound FX's level covers the effects and ui buses, the music
 * level the themes and the stings, the voice level narration. The master level
 * is applied separately, as the sound manager's global volume.
 */
export function busVolume(bus: Bus, settings: AudioSettings = current): number {
  const level = bus === 'effects' || bus === 'ui' ? settings.effects : bus === 'music' ? settings.music : settings.voice
  return level * BUS_BASE[bus]
}
