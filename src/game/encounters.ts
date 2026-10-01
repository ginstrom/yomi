import { GOBLIN_STATS, type CombatantStats } from '../combat/combat.ts'
import type { BattleSetup } from '../engine/battleEngine.ts'
import { offsetToHex } from '../grid/hex.ts'

/** The id of the persistent player character's unit in every encounter. */
export const HERO_ID = 'hero'

/**
 * The one encounter so far: a Goblin across the board from the hero. Shared
 * by the game and the simulator so balancing runs fight the same battle.
 */
export function goblinEncounter(hero: CombatantStats, heroHp?: number): BattleSetup {
  return {
    board: { cols: 8, rows: 5 },
    units: [
      { id: HERO_ID, side: 'player', stats: hero, hp: heroHp, position: offsetToHex(1, 2) },
      { id: 'goblin', side: 'enemy', stats: GOBLIN_STATS, position: offsetToHex(6, 2) },
    ],
  }
}
