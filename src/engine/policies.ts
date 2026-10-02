import type { RNG } from '../combat/combat.ts'
import { hexDistance, type Hex } from '../grid/hex.ts'
import {
  ATTACK_AP_COST,
  flankersOf,
  moveApCost,
  type Action,
  type BattleState,
  type UnitSnapshot,
} from './battleEngine.ts'

export interface PolicyContext {
  /** The policy chooses for the side whose turn it is (state.phase). */
  state: BattleState
  legal: readonly Action[]
  /** Kept separate from the engine's combat RNG so policy choices don't shift dice rolls. */
  rng: RNG
}

/**
 * Chooses the next action for the side whose turn it is; called repeatedly
 * until it returns end_turn. The enemy's in-game AI is a policy too, so
 * balancing runs and AI experiments can swap either side's behaviour.
 */
export type Policy = (ctx: PolicyContext) => Action

const END_TURN: Action = { type: 'end_turn' }

/**
 * Takes each unit in roster order and gives it the first useful thing to do;
 * ends the turn when no unit has one. A unit attacks the adjacent foe it
 * flanks most if it can afford to; otherwise it closes on the nearest foe,
 * preferring a hex next to one with AP left to strike, then the smallest gap,
 * then the cheapest move.
 */
const aggressive: Policy = ({ state, legal }) => {
  for (const self of state.units) {
    const own = legal.filter((a) => a.type !== 'end_turn' && a.unit === self.id)
    if (own.length === 0) continue
    const choice = mostFlankedAttack(state, self, own) ?? closingMove(state, self, own)
    if (choice) return choice
  }
  return END_TURN
}

function mostFlankedAttack(state: BattleState, self: UnitSnapshot, own: readonly Action[]): Action | null {
  let best: Action | null = null
  let mostFlankers = -1
  for (const action of own) {
    if (action.type !== 'attack') continue
    const target = state.units.find((u) => u.id === action.target)
    const flankers = target ? flankersOf(state.units, self, target).length : 0
    if (flankers > mostFlankers) {
      best = action
      mostFlankers = flankers
    }
  }
  return best
}

function closingMove(state: BattleState, self: UnitSnapshot, own: readonly Action[]): Action | null {
  const foes = state.units.filter((u) => u.side !== self.side && u.hp > 0)
  if (foes.length === 0) return null
  const gap = (h: Hex) => Math.min(...foes.map((f) => hexDistance(h, f.position)))
  const currentGap = gap(self.position)

  let best: Action | null = null
  let bestScore: number[] = []
  for (const action of own) {
    if (action.type !== 'move') continue
    const g = gap(action.to)
    if (g >= currentGap) continue
    // A lower bound: the real path may detour around units.
    const cost = moveApCost(hexDistance(self.position, action.to), self.speed)
    const canStrike = g === 1 && self.ap - cost >= ATTACK_AP_COST
    const score = [canStrike ? 0 : 1, g, cost]
    if (!best || lexLess(score, bestScore)) {
      best = action
      bestScore = score
    }
  }
  return best
}

function lexLess(a: readonly number[], b: readonly number[]): boolean {
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] < b[i]
  return false
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
