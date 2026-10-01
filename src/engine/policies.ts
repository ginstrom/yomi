import type { RNG } from '../combat/combat.ts'
import { hexDistance, type Hex } from '../grid/hex.ts'
import type { Action, BattleState, UnitId } from './battleEngine.ts'

export interface PolicyContext {
  state: BattleState
  /** The unit this policy is choosing for (always the active unit). */
  unit: UnitId
  legal: readonly Action[]
  /** Kept separate from the engine's combat RNG so policy choices don't shift dice rolls. */
  rng: RNG
}

/**
 * Chooses an action for one unit. The enemy's in-game AI is a policy too,
 * so balancing runs and AI experiments can swap either side's behaviour.
 */
export type Policy = (ctx: PolicyContext) => Action

/**
 * Attacks the first adjacent foe if it can; otherwise moves to whichever
 * reachable hex is closest to a standing foe, and ends the turn once it can
 * get no closer.
 */
const aggressive: Policy = ({ state, unit, legal }) => {
  const attack = legal.find((a) => a.type === 'attack')
  if (attack) return attack

  const self = state.units.find((u) => u.id === unit)
  const foes = state.units.filter((u) => u.side !== self?.side && u.hp > 0)
  if (!self || foes.length === 0) return { type: 'end_turn' }
  const gap = (h: Hex) => Math.min(...foes.map((f) => hexDistance(h, f.position)))

  let best: Action = { type: 'end_turn' }
  let bestGap = gap(self.position)
  for (const action of legal) {
    if (action.type !== 'move') continue
    const g = gap(action.to)
    if (g < bestGap) {
      best = action
      bestGap = g
    }
  }
  return best
}

export const POLICIES = {
  /** Closes in and attacks. Current in-game enemy behaviour. */
  aggressive,
  /** Uniformly random legal action; a baseline for comparing smarter agents. */
  random: ({ legal, rng }) => legal[Math.floor(rng() * legal.length)],
} satisfies Record<string, Policy>

export type PolicyName = keyof typeof POLICIES

export function isPolicyName(name: string): name is PolicyName {
  return Object.hasOwn(POLICIES, name)
}
