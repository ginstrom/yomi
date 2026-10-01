import type { RNG } from '../combat/combat.ts'
import type { Action, BattleState, Side } from './battleEngine.ts'

export interface PolicyContext {
  state: BattleState
  /** The side this policy is choosing for (always the side whose phase it is). */
  side: Side
  legal: readonly Action[]
  /** Kept separate from the engine's combat RNG so policy choices don't shift dice rolls. */
  rng: RNG
}

/**
 * Chooses an action for one side. The enemy's in-game AI is a policy too,
 * so balancing runs and AI experiments can swap either side's behaviour.
 */
export type Policy = (ctx: PolicyContext) => Action

const hasAction = (legal: readonly Action[], type: Action['type']) => legal.some((a) => a.type === type)

export const POLICIES = {
  /** Attacks whenever it can. Current in-game enemy behaviour. */
  aggressive: ({ legal }) => (hasAction(legal, 'attack') ? { type: 'attack' } : legal[0]),
  /** Uniformly random legal action; a baseline for comparing smarter agents. */
  random: ({ legal, rng }) => legal[Math.floor(rng() * legal.length)],
} satisfies Record<string, Policy>

export type PolicyName = keyof typeof POLICIES

export function isPolicyName(name: string): name is PolicyName {
  return Object.hasOwn(POLICIES, name)
}
