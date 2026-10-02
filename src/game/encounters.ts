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
 * The one encounter so far: a Goblin and a Kobold across the board from the
 * hero. Shared by the game and the simulator so balancing runs fight the
 * same battle.
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
