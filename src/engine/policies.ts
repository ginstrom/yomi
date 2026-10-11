import type { RNG } from '../combat/combat.ts'
import { SPELLS } from '../combat/spells.ts'
import { hexDistance, type Hex } from '../grid/hex.ts'
import {
  ARC_BONUS,
  FLANK_BONUS_PER_ALLY,
  MOVE_AP_COST_PER_HEX,
  attackArc,
  flankersOf,
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
 * ends the turn when no unit has one. A unit that can cast does, on the foe
 * in range with the fewest hit points. Otherwise it attacks the foe in range
 * it has the biggest to-hit bonus against (flanking, side or rear) if it can
 * afford to; otherwise, if no foe is in reach, it closes on the nearest one,
 * preferring the cheapest move that leaves AP to strike from where it ends,
 * then the smallest gap, then the cheapest move. Its reach is that of a spell
 * it has the mana for, if it knows one, and else its weapon's: so a mage
 * holds off at its spell's range, and closes to its wand's when its mana is spent.
 */
const aggressive: Policy = ({ state, legal }) => {
  for (const self of state.units) {
    const own = legal.filter((a) => a.type !== 'end_turn' && a.unit === self.id)
    if (own.length === 0) continue
    const choice = weakestCast(state, own) ?? bestBonusAttack(state, self, own) ?? closingMove(state, self, own)
    if (choice) return choice
  }
  return END_TURN
}

/** A cast on the foe with the fewest hit points among those the unit can cast on; the first listed on a tie. */
function weakestCast(state: BattleState, own: readonly Action[]): Action | null {
  let best: Action | null = null
  let bestHp = Infinity
  for (const action of own) {
    if (action.type !== 'cast') continue
    const hp = state.units.find((u) => u.id === action.target)?.hp ?? Infinity
    if (hp < bestHp) {
      best = action
      bestHp = hp
    }
  }
  return best
}

/** How far the unit can do harm from, and for how many action points: by a spell it has the mana for, else by its weapon. */
function reach(self: UnitSnapshot): { range: number; apCost: number } {
  const spell = self.magic?.spells.map((id) => SPELLS[id]).find((known) => known.manaCost <= self.mana)
  return spell ? { range: spell.range, apCost: spell.apCost } : { range: self.attackRange, apCost: self.attackApCost }
}

function bestBonusAttack(state: BattleState, self: UnitSnapshot, own: readonly Action[]): Action | null {
  let best: Action | null = null
  let bestBonus = -1
  for (const action of own) {
    if (action.type !== 'attack') continue
    const target = state.units.find((u) => u.id === action.target)
    const bonus = target
      ? flankersOf(state.units, self, target).length * FLANK_BONUS_PER_ALLY +
        ARC_BONUS[attackArc(target, self.position)]
      : 0
    if (bonus > bestBonus) {
      best = action
      bestBonus = bonus
    }
  }
  return best
}

function closingMove(state: BattleState, self: UnitSnapshot, own: readonly Action[]): Action | null {
  const foes = state.units.filter((u) => u.side !== self.side && u.hp > 0)
  if (foes.length === 0) return null
  const gap = (h: Hex) => Math.min(...foes.map((f) => hexDistance(h, f.position)))
  const { range, apCost } = reach(self)
  const currentGap = gap(self.position)
  if (currentGap <= range) return null

  let best: Action | null = null
  let bestScore: number[] = []
  for (const action of own) {
    if (action.type !== 'move') continue
    const g = gap(action.to)
    if (g >= currentGap) continue
    // A lower bound: the real path may detour around units.
    const cost = hexDistance(self.position, action.to) * MOVE_AP_COST_PER_HEX
    const canStrike = g <= range && self.ap - cost >= apCost
    // An archer stops as soon as it is in range rather than walking up to its target.
    const score = canStrike ? [0, cost, g] : [1, g, cost]
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
