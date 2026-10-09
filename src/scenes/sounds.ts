import type { BattleEvent } from '../engine/battleEngine.ts'

/** Every sound the game plays; each is loaded from assets/audio/<key>.wav. */
export const SOUND_KEYS = [
  'sfx_melee_swing',
  'sfx_hit_impact',
  'sfx_crit_impact',
  'sfx_miss',
  'sfx_unit_death',
  'sfx_ui_click',
  'music_victory',
  'music_defeat',
] as const

export type SoundKey = (typeof SOUND_KEYS)[number]

/** A sound to start `delayMs` after its event is shown. */
export interface SoundCue {
  key: SoundKey
  delayMs: number
}

/** The impact lands just after the swing starts, so the two read as one blow. */
export const IMPACT_DELAY_MS = 90
/** The battle's last blow and fall are heard before the victory or defeat sting. */
export const STING_DELAY_MS = 450
/** The placeholder tones are harsh square waves; this keeps them from blaring. */
export const SOUND_VOLUME = 0.4

/** The sounds that go with a battle event, kept free of Phaser so it can be unit tested. */
export function eventSounds(event: BattleEvent): SoundCue[] {
  switch (event.type) {
    case 'attack': {
      const outcome: SoundKey = !event.hit ? 'sfx_miss' : event.critical ? 'sfx_crit_impact' : 'sfx_hit_impact'
      return [
        { key: 'sfx_melee_swing', delayMs: 0 },
        { key: outcome, delayMs: IMPACT_DELAY_MS },
      ]
    }
    case 'unit_down':
      return [{ key: 'sfx_unit_death', delayMs: 0 }]
    case 'battle_end':
      if (event.winner === 'player') return [{ key: 'music_victory', delayMs: STING_DELAY_MS }]
      if (event.winner === 'enemy') return [{ key: 'music_defeat', delayMs: STING_DELAY_MS }]
      return []
    default:
      return []
  }
}
