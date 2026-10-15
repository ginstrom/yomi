import type { DamageRoll, RNG } from '../combat/combat.ts'
import { SPELLS, isHealing, type SpellId } from '../combat/spells.ts'
import { hexDistance, type Hex } from '../grid/hex.ts'
import {
  ARC_BONUS,
  FLANK_BONUS_PER_ALLY,
  MOVE_AP_COST_PER_HEX,
  attackArc,
  castTouches,
  flankersOf,
  hasStatus,
  type Action,
  type BattleState,
  type CastAim,
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
 * ends the turn when no unit has one. A caster first heals an ally at half
 * its hit points or less; guards itself with Mirror Image or Shield when a
 * foe stands beside it; throws a hostile area spell where it touches two
 * foes or more and no ally; blesses two allies or more; puts the
 * healthiest foe to sleep while two stand; strikes the weakest foe with its
 * hardest-hitting spell. A caster that knows a heal keeps the mana for its
 * cheapest, spending it only on healing. Protect and Haste it never casts.
 * Otherwise a unit attacks the foe in range it has the biggest to-hit bonus
 * against (flanking, side or rear) if it can afford to; otherwise, if no foe
 * is in reach, it closes on the nearest one, preferring the cheapest move
 * that leaves AP to strike from where it ends, then the smallest gap, then
 * the cheapest move. Its reach is that of a damaging spell of one foe it has
 * the mana for, if it knows one, and else its weapon's: so a mage holds off at its
 * spell's range, and closes to its wand's when its mana is spent.
 */
const aggressive: Policy = ({ state, legal }) => {
  for (const self of state.units) {
    const own = legal.filter((a) => a.type !== 'end_turn' && a.unit === self.id)
    if (own.length === 0) continue
    const casts = castsOf(state, self, own)
    const choice =
      healCast(casts) ??
      guardCast(state, self, casts) ??
      areaCast(casts) ??
      blessCast(casts) ??
      sleepCast(state, casts) ??
      strikeCast(casts) ??
      bestBonusAttack(state, self, own) ??
      closingMove(state, self, own)
    if (choice) return choice
  }
  return END_TURN
}

type CastAction = Extract<Action, { type: 'cast' }>

/** A legal cast and what it would touch, as the engine reckons it. */
interface CastOption {
  action: CastAction
  spell: SpellId
  foes: UnitSnapshot[]
  allies: UnitSnapshot[]
  /** It leaves the caster the mana for its cheapest heal, or it is a heal. */
  withinReserve: boolean
}

function aimOf(action: CastAction): CastAim {
  return 'at' in action ? { at: action.at } : { target: action.target }
}

/** The mana a caster that knows a heal keeps for its cheapest: 0 for one that knows none. */
function manaReserve(self: UnitSnapshot): number {
  const heals = (self.magic?.spells ?? []).filter(isHealing).map((id) => SPELLS[id].manaCost)
  return heals.length > 0 ? Math.min(...heals) : 0
}

function castsOf(state: BattleState, self: UnitSnapshot, own: readonly Action[]): CastOption[] {
  const reserve = manaReserve(self)
  return own.flatMap((action): CastOption[] => {
    if (action.type !== 'cast') return []
    const touched = castTouches(state.units, self, action.spell, aimOf(action))
    return [
      {
        action,
        spell: action.spell,
        foes: touched.filter((u) => u.side !== self.side),
        allies: touched.filter((u) => u.side === self.side),
        withinReserve: isHealing(action.spell) || self.mana - SPELLS[action.spell].manaCost >= reserve,
      },
    ]
  })
}

/** The average of a roll, unrounded. */
function mean(roll: DamageRoll | undefined): number {
  return roll ? (roll.count * (roll.sides + 1)) / 2 + roll.bonus : 0
}

/** The first of `options` with the highest score, or null if none scores above `floor`. */
function best<T>(options: readonly T[], score: (option: T) => number, floor = 0): T | null {
  let chosen: T | null = null
  let top = floor
  for (const option of options) {
    const value = score(option)
    if (value > top) {
      chosen = option
      top = value
    }
  }
  return chosen
}

/**
 * When an ally it can heal is down to half its hit points or less, the heal
 * that restores the most, counting for each ally the lesser of the spell's
 * average and what it has lost; the cheaper on a tie.
 */
function healCast(casts: readonly CastOption[]): Action | null {
  const heals = casts.filter((c) => isHealing(c.spell) && c.allies.some((u) => u.hp * 2 <= u.maxHp))
  const restored = (c: CastOption) => c.allies.reduce((sum, u) => sum + Math.min(mean(SPELLS[c.spell].heal), u.maxHp - u.hp), 0)
  // The mana cost a hair off the score, so that the cheaper wins a tie.
  return best(heals, (c) => restored(c) - SPELLS[c.spell].manaCost / 1000)?.action ?? null
}

/** With a foe beside it, Mirror Image if it has none, else Shield if it has none. */
function guardCast(state: BattleState, self: UnitSnapshot, casts: readonly CastOption[]): Action | null {
  const pressed = state.units.some((u) => u.side !== self.side && u.hp > 0 && hexDistance(u.position, self.position) === 1)
  if (!pressed) return null
  const guard = (spell: SpellId) => casts.find((c) => c.spell === spell && c.withinReserve)?.action ?? null
  return (!hasStatus(self, 'mirrored') ? guard('mirror_image') : null) ?? (!hasStatus(self, 'shielded') ? guard('shield') : null)
}

/** The hostile area cast that touches the most foes, two at least, and no ally, the caster included. */
function areaCast(casts: readonly CastOption[]): Action | null {
  const areas = casts.filter((c) => SPELLS[c.spell].target === 'area' && SPELLS[c.spell].hostile && c.withinReserve && c.allies.length === 0)
  return best(areas, (c) => c.foes.length, 1)?.action ?? null
}

/** Bless, when it would touch two allies or more not already blessed. */
function blessCast(casts: readonly CastOption[]): Action | null {
  const bless = casts.find((c) => c.spell === 'bless' && c.withinReserve)
  return bless && bless.allies.filter((u) => !hasStatus(u, 'blessed')).length >= 2 ? bless.action : null
}

/** Sleep on the foe in range with the most hit points that is not asleep, while two foes or more stand. */
function sleepCast(state: BattleState, casts: readonly CastOption[]): Action | null {
  const sleeper = casts[0] && state.units.find((u) => u.id === casts[0].action.unit)
  if (!sleeper || state.units.filter((u) => u.side !== sleeper.side && u.hp > 0).length < 2) return null
  const sleeps = casts.filter((c) => c.spell === 'sleep' && c.withinReserve && c.foes.length === 1 && !hasStatus(c.foes[0], 'asleep'))
  return best(sleeps, (c) => c.foes[0].hp)?.action ?? null
}

/** The damaging spell of a single foe with the highest average damage, on the foe with the fewest hit points. */
function strikeCast(casts: readonly CastOption[]): Action | null {
  const strikes = casts.filter((c) => SPELLS[c.spell].target === 'foe' && SPELLS[c.spell].damage && c.withinReserve && c.foes.length === 1)
  // Damage first, then the weaker foe: hit points are below 1000.
  return best(strikes, (c) => mean(SPELLS[c.spell].damage) * 1000 - c.foes[0].hp, -Infinity)?.action ?? null
}

/**
 * How far the unit can do harm from, and for how many action points: by a
 * damaging spell of a single foe it has the mana for above its reserve, else
 * by its weapon. Not by an area spell, which it may not throw at all.
 */
function reach(self: UnitSnapshot): { range: number; apCost: number } {
  const reserve = manaReserve(self)
  const spell = self.magic?.spells
    .map((id) => SPELLS[id])
    .find((known) => known.damage && known.target === 'foe' && self.mana - known.manaCost >= reserve)
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
