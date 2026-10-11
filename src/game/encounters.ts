import { GOBLIN_STATS, KOBOLD_STATS, type CombatantStats } from '../combat/combat.ts'
import type { BattleSetup, UnitId } from '../engine/battleEngine.ts'
import { offsetToHex } from '../grid/hex.ts'

/** The id of the persistent player character's unit in every encounter. */
export const HERO_ID = 'hero'

/** What a unit is, for drawing it; the engine only knows its stats. */
export type UnitKind = 'warrior' | 'goblin' | 'kobold'

export interface Encounter {
  setup: BattleSetup
  kinds: Record<UnitId, UnitKind>
}

/**
 * A Goblin and a Kobold across the board from the hero. The simulator fights
 * this one, so balancing runs fight a battle the game has.
 */
export function goblinRaid(hero: CombatantStats, heroHp?: number): Encounter {
  return {
    setup: {
      board: { cols: 8, rows: 5 },
      units: [
        { id: HERO_ID, side: 'player', stats: hero, hp: heroHp, position: offsetToHex(1, 2) },
        { id: 'goblin', side: 'enemy', stats: GOBLIN_STATS, position: offsetToHex(6, 2) },
        { id: 'kobold', side: 'enemy', stats: KOBOLD_STATS, position: offsetToHex(7, 0) },
      ],
    },
    kinds: { [HERO_ID]: 'warrior', goblin: 'goblin', kobold: 'kobold' },
  }
}

/** Two Kobolds that come at the hero from both ends of the far side. */
export function koboldScouts(hero: CombatantStats, heroHp?: number): Encounter {
  return {
    setup: {
      board: { cols: 8, rows: 5 },
      units: [
        { id: HERO_ID, side: 'player', stats: hero, hp: heroHp, position: offsetToHex(1, 2) },
        { id: 'scout', side: 'enemy', stats: { ...KOBOLD_STATS, name: 'Kobold Scout' }, position: offsetToHex(6, 0) },
        { id: 'tracker', side: 'enemy', stats: { ...KOBOLD_STATS, name: 'Kobold Tracker' }, position: offsetToHex(6, 4) },
      ],
    },
    kinds: { [HERO_ID]: 'warrior', scout: 'kobold', tracker: 'kobold' },
  }
}

/** Every battle a monster location on the world map can lead to, by id. */
export const ENCOUNTERS = {
  goblin_raid: goblinRaid,
  kobold_scouts: koboldScouts,
} satisfies Record<string, (hero: CombatantStats, heroHp?: number) => Encounter>

export type EncounterId = keyof typeof ENCOUNTERS
