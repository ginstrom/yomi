import { ABILITIES, type AbilityId } from '../combat/abilities.ts'
import { damageThrough, effectiveResistance, hitChance, warded, type DamageRoll, type RNG } from '../combat/combat.ts'
import { HELPLESS_BONUS, SPELLS, isHealing, type SpellId } from '../combat/spells.ts'
import { hexDistance, type Hex } from '../grid/hex.ts'
import {
  ARC_BONUS,
  FLANK_BONUS_PER_ALLY,
  MOVE_AP_COST_PER_HEX,
  arcStruck,
  castTouches,
  effectiveStats,
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
 * its hit points or less; guards itself with Mirror Image or Shield (Dark
 * Shield after Shield) when a foe stands beside it; throws a hostile area
 * spell where it touches two foes or more and no ally (the Web spell where
 * it touches one foe or more not yet webbed and no ally); blesses two allies
 * or more; puts the healthiest foe to sleep while two stand; curses the
 * healthiest foe not yet cursed while two stand; strikes the weakest foe
 * with its hardest-hitting spell, reckoning its damage after the foe's ward
 * against the spell's element. A caster that knows a heal keeps the mana for its
 * cheapest, spending it only on healing. Protect and Haste it never casts.
 * Otherwise a unit makes the strike that would do the most harm, if it can
 * afford one: a plain attack or a routine of strikes (`bestStrike`), each
 * strike the chance to hit (flanking, side and rear included) times the
 * damage of a hit through the foe's resistance, so that it leaves the
 * heavily armoured to weapons that pierce them; otherwise, if no foe
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
      curseCast(state, casts) ??
      strikeCast(casts) ??
      bestStrike(state, self, own) ??
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

/** With a foe beside it, Mirror Image if it has none, else Shield, else Dark Shield, if it is not shielded. */
function guardCast(state: BattleState, self: UnitSnapshot, casts: readonly CastOption[]): Action | null {
  const pressed = state.units.some((u) => u.side !== self.side && u.hp > 0 && hexDistance(u.position, self.position) === 1)
  if (!pressed) return null
  const guard = (spell: SpellId) => casts.find((c) => c.spell === spell && c.withinReserve)?.action ?? null
  return (!hasStatus(self, 'mirrored') ? guard('mirror_image') : null) ?? (!hasStatus(self, 'shielded') ? (guard('shield') ?? guard('dark_shield')) : null)
}

/**
 * The hostile area cast that touches no ally, the caster included, and the
 * most foes: two at least, or for the Web spell one at least not already
 * webbed, counting only those.
 */
function areaCast(casts: readonly CastOption[]): Action | null {
  const areas = casts.filter((c) => SPELLS[c.spell].target === 'area' && SPELLS[c.spell].hostile && c.withinReserve && c.allies.length === 0)
  const foesTouched = (c: CastOption) =>
    c.spell === 'web' ? c.foes.filter((u) => !hasStatus(u, 'webbed')).length : c.foes.length >= 2 ? c.foes.length : 0
  return best(areas, foesTouched)?.action ?? null
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

/** Curse on the foe in range with the most hit points that is not cursed, while two foes or more stand. */
function curseCast(state: BattleState, casts: readonly CastOption[]): Action | null {
  const caster = casts[0] && state.units.find((u) => u.id === casts[0].action.unit)
  if (!caster || state.units.filter((u) => u.side !== caster.side && u.hp > 0).length < 2) return null
  const curses = casts.filter((c) => c.spell === 'curse' && c.withinReserve && c.foes.length === 1 && !hasStatus(c.foes[0], 'cursed'))
  return best(curses, (c) => c.foes[0].hp)?.action ?? null
}

/**
 * The damaging spell of a single foe with the highest average damage after
 * the foe's ward against its element, on the foe with the fewest hit points.
 */
function strikeCast(casts: readonly CastOption[]): Action | null {
  const strikes = casts.filter((c) => SPELLS[c.spell].target === 'foe' && SPELLS[c.spell].damage && c.withinReserve && c.foes.length === 1)
  const damage = (c: CastOption) => warded(mean(SPELLS[c.spell].damage), SPELLS[c.spell].element, c.foes[0])
  // Damage first, then the weaker foe: hit points are below 1000.
  return best(strikes, (c) => damage(c) * 1000 - c.foes[0].hp, -Infinity)?.action ?? null
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

/**
 * The harm an attack would do on average: its chance to hit times the
 * average hit of `dice` (the unit's weapon's unless given) through the
 * target's resistance, near enough.
 */
function expectedHarm(state: BattleState, self: UnitSnapshot, target: UnitSnapshot, dice?: DamageRoll): number {
  const attacker = effectiveStats({ stats: self, statuses: self.statuses })
  const defender = effectiveStats({ stats: target, statuses: target.statuses })
  const bonus =
    flankersOf(state.units, self, target).length * FLANK_BONUS_PER_ALLY +
    ARC_BONUS[arcStruck(target, self.position, self.attackRange)] +
    (hasStatus(target, 'asleep') ? HELPLESS_BONUS : 0)
  const { count, sides, bonus: flat } = dice ?? attacker.damage
  const averageHit = damageThrough(count * ((sides + 1) / 2) + flat, effectiveResistance(attacker, defender.resistance ?? 0))
  return hitChance(attacker, defender.ac, bonus) * averageHit
}

/**
 * The best strike: of the legal plain attacks and routines, the one that
 * would do the most harm, a routine scoring the sum of its strikes' (each
 * with its own dice and the unit's `abilityDamageBonus`) against its first
 * target. A routine wins a tie with a plain attack.
 */
function bestStrike(state: BattleState, self: UnitSnapshot, own: readonly Action[]): Action | null {
  let best: Action | null = null
  let bestHarm = -1
  let bestIsRoutine = false
  for (const action of own) {
    if (action.type !== 'attack' && action.type !== 'ability') continue
    const target = state.units.find((u) => u.id === action.target)
    if (!target) continue
    const routine = action.type === 'ability'
    const harm = routine ? routineHarm(state, self, target, action.ability) : expectedHarm(state, self, target)
    if (harm > bestHarm || (routine && !bestIsRoutine && harm === bestHarm)) {
      best = action
      bestHarm = harm
      bestIsRoutine = routine
    }
  }
  return best
}

/** The summed expected harm of a routine's strikes on `target`. */
function routineHarm(state: BattleState, self: UnitSnapshot, target: UnitSnapshot, ability: AbilityId): number {
  const bonus = self.abilityDamageBonus ?? 0
  return (ABILITIES[ability].strikes ?? []).reduce(
    (sum, strike) => sum + expectedHarm(state, self, target, { ...strike.damage, bonus: strike.damage.bonus + bonus }),
    0,
  )
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
