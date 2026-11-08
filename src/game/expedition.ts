import type { Hex } from '../grid/hex.ts'
import type { WorldState } from './worldMap.ts'

/**
 * The company's parties as the world's rules see them. The blight, sight,
 * territory and `passTurn` take a list of presences, one a party, and work
 * over all of them; with a list of one they give what the single party did.
 */

/** A party as the world's rules see it: where it stands, and its members' levels. */
export interface PartyPresence {
  position: Hex
  levels: readonly number[]
}

/** The one party of today's game as a list of one presence, standing where `world.party` says. Transitional: step 04 of stage 5 removes it. */
export function soloPresences(world: WorldState, party: readonly { level: number }[]): PartyPresence[] {
  return [{ position: world.party, levels: party.map((m) => m.level) }]
}
