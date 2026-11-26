import { ABILITIES, abilityApCost, type Ability, type AbilityId, type Strike } from '../combat/abilities.ts'
import { baneApplies, damageThrough, effectiveResistance, hitChance, warded, type CombatantStats, type DamageRoll, type RNG } from '../combat/combat.ts'
import { HELPLESS_BONUS, SPELLS, STATUSES, isHealing, spellApCost, spellPower, type SpellId, type StatusId } from '../combat/spells.ts'
import { hexDistance, type Hex } from '../grid/hex.ts'
import {
  ARC_BONUS,
  FLANK_BONUS_PER_ALLY,
  MOVE_AP_COST_PER_HEX,
  arcStruck,
  abilityTouches,
  castTouches,
  deathblows,
  flankersOf,
  hasStatus,
  isHelpless,
  isMelee,
  resistanceLeft,
  statsIn,
  tauntPenalty,
  traitDamage,
  traitToHit,
  type Action,
  type BattleState,
  type CastAim,
  type UnitId,
  type UnitSnapshot,
} from './battleEngine.ts'

/**
 * What a technique's status is worth, in hit points, laid on a foe that
 * lacks it, times the chance it lands. Seared is worth the target's own
 * regeneration, which it stops, and is not listed.
 */
export const STATUS_VALUE: Partial<Record<StatusId, number>> = { chilled: 3, slowed: 3, pinned: 3, poisoned: 7, baned: 4 }

/** What a point of mana spent on a technique costs its score, in hit points. */
export const MANA_WEIGHT = 0.5

/** The statuses `purifyCast` lifts from an ally: the ones that keep it from fighting or wear it down. */
export const PURIFY_STATUSES: readonly StatusId[] = ['asleep', 'frozen', 'poisoned', 'corroded', 'pinned']

/** Mass Haste is cast in its side's first this many rounds only. */
export const MASS_HASTE_ROUNDS = 2

/** Renew is cast when two allies or more within its radius are at this share of their hit points or less. */
export const RENEW_SHARE = 0.75

export interface PolicyContext {
  /** The policy chooses for the side whose turn it is (state.phase). */
  state: BattleState
  legal: readonly Action[]
  /**
   * The legal actions of one unit, end_turn left out: `legal`'s for that unit, in
   * order, found without listing every unit's (`legalActions(unit)`). A policy that
   * weighs one unit at a time reads this when given it, so that `legal` (a getter in
   * `autoPlay`) need never be listed whole.
   */
  legalFor?: (unit: UnitId) => readonly Action[]
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
 * ends the turn when no unit has one. A caster first revives a fallen ally
 * (`reviveCast`), then heals an ally at half its hit points or less, then
 * purifies an ally asleep, frozen, poisoned, corroded or pinned
 * (`purifyCast`); guards itself with Mirror Image or Shield (Dark
 * Shield after Shield) when a foe stands beside it; throws a hostile area
 * spell where it touches two foes or more and no ally (the Web spell where
 * it touches one foe or more not yet webbed and no ally); blesses two allies
 * or more; puts the healthiest foe not asleep or frozen to sleep while two stand; curses the
 * healthiest foe not yet cursed while two stand; strikes the weakest foe
 * with its hardest-hitting spell, reckoning its damage after the foe's ward
 * against the spell's element, Ice Lance's bonus dice and Holy Light's bane
 * counted. A caster that knows a heal keeps the mana for its
 * cheapest, spending it only on healing (a mana technique too). Protect and
 * Haste it never casts. A hero Taunts (`tauntUse`, after the guard), hastes or renews the
 * side (`supportCast`, after Taunt: Mass Haste in the first two rounds,
 * Renew for two allies worn to three quarters), freezes the healthiest foe
 * not helpless while two stand (`prisonCast`, after Bless) and
 * marks with Hunter's Mark (`markUse`, before the strike spell) when they pay.
 * Otherwise a unit makes the strike that would do the most harm, if it can
 * afford one: a plain attack or a routine of strikes (`bestStrike`), each
 * strike the chance to hit (flanking, side and rear included) times the
 * damage of a hit through the foe's resistance, so that it leaves the
 * heavily armoured to weapons that pierce them, or a technique scoring
 * higher by the blows that fit this turn (`techniqueScore`), or an area ability with
 * damage whose net harm (to foes, less to its own side) is above 0 and
 * above that strike's; otherwise an area ability that only lays a status
 * (Web), where it touches a foe without it and none of its own side;
 * otherwise Sprint where only its action points let the closing move end
 * in reach with AP to strike (`sprintUse`);
 * otherwise, if no foe is in reach, it closes on the nearest one, preferring the cheapest move
 * that leaves AP to strike from where it ends, then the smallest gap, then
 * the cheapest move. Its reach is that of a damaging spell of one foe it has
 * the mana for, if it knows one, and else its weapon's: so a mage holds off at its
 * spell's range, and closes to its wand's when its mana is spent. A unit
 * Taunted by a foe that stands narrows each step with a candidate on that
 * foe to those, and closes on it rather than the nearest.
 */
const aggressive: Policy = (context) => {
  const { state } = context
  for (const self of state.units) {
    const own = context.legalFor ? context.legalFor(self.id) : context.legal.filter((a) => a.type !== 'end_turn' && a.unit === self.id)
    if (own.length === 0) continue
    const source = tauntSource(state, self)
    const casts = castsOf(state, self, own)
    const choice =
      reviveCast(casts) ??
      healCast(casts, self.magic?.healBonus ?? 0) ??
      purifyCast(casts) ??
      guardCast(state, self, casts) ??
      tauntUse(state, self, own, source) ??
      supportCast(state, casts) ??
      areaCast(state, casts, source) ??
      blessCast(casts) ??
      prisonCast(state, self, casts, source) ??
      sleepCast(state, self, casts, source) ??
      curseCast(state, self, casts, source) ??
      markUse(state, self, own, source) ??
      strikeCast(state, self, casts, source) ??
      bestStrike(state, self, own, source) ??
      statusArea(state, self, own, source) ??
      sprintUse(state, self, own, source) ??
      closingMove(state, self, own, source)
    if (choice) return choice
  }
  return END_TURN
}

/**
 * The foe that Taunted `self`, while it stands: every step with a hostile
 * candidate on it keeps only those, and the unit closes on it. Null for a
 * unit not taunted, or whose taunter has fallen.
 */
function tauntSource(state: BattleState, self: UnitSnapshot): UnitId | null {
  const id = self.statuses.find((s) => s.id === 'taunted')?.source
  return id !== undefined && state.units.some((u) => u.id === id && u.hp > 0) ? id : null
}

/** Whether a cast option touches `source`. */
const castOn = (source: UnitId | null) => (c: CastOption) => c.foes.some((u) => u.id === source)

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

/**
 * The first of `options` with the highest score, or null if none scores
 * above `floor`. With `onSource` (a taunted unit's), the first of the
 * highest of those it holds for, if any of them scores above `floor`.
 */
function best<T>(options: readonly T[], score: (option: T) => number, floor = 0, onSource?: (option: T) => boolean): T | null {
  let chosen: T | null = null
  let top = floor
  let focused: T | null = null
  let focusedTop = floor
  for (const option of options) {
    const value = score(option)
    if (value > top) {
      chosen = option
      top = value
    }
    if (onSource?.(option) && value > focusedTop) {
      focused = option
      focusedTop = value
    }
  }
  return focused ?? chosen
}

/** Revive on a fallen ally, whenever it is legal (once a battle); the first in roster order. No heal reserve holds it back: Revive is what the mana is kept for. */
function reviveCast(casts: readonly CastOption[]): Action | null {
  return casts.find((c) => c.spell === 'revive' && c.allies.length === 1)?.action ?? null
}

/**
 * Purify on an ally under one of `PURIFY_STATUSES`, the one under the most
 * of them, the first in roster order on a tie. It is a cleanse, not a heal
 * (`isHealing`): a wounded ally with none of them is not purified.
 */
function purifyCast(casts: readonly CastOption[]): Action | null {
  const purifies = casts.filter((c) => c.spell === 'purify' && c.withinReserve && c.allies.length === 1)
  const lifted = (c: CastOption) => c.allies[0].statuses.filter((s) => PURIFY_STATUSES.includes(s.id)).length
  return best(purifies, lifted)?.action ?? null
}

/**
 * Mass Haste in its side's first `MASS_HASTE_ROUNDS` rounds where it would
 * touch two allies or more not hasted (the caster counts); else Renew where
 * two allies or more it would touch are at `RENEW_SHARE` of their hit points
 * or less and none of those it would touch is renewing; else Haste on the
 * first ally in roster order, not itself, that is not hasted; else Protect
 * on the ally with a foe beside it, not protected, the most hurt by share.
 */
function supportCast(state: BattleState, casts: readonly CastOption[]): Action | null {
  const usable = (spell: SpellId) => casts.filter((c) => c.spell === spell && c.withinReserve)
  if (state.round <= MASS_HASTE_ROUNDS) {
    const haste = usable('mass_haste').find((c) => c.allies.filter((u) => !hasStatus(u, 'hasted')).length >= 2)
    if (haste) return haste.action
  }
  const renew = usable('renew').find(
    (c) => c.allies.filter((u) => u.hp <= u.maxHp * RENEW_SHARE).length >= 2 && !c.allies.some((u) => hasStatus(u, 'renewing')),
  )
  if (renew) return renew.action
  const caster = casts[0]?.action.unit
  const haste = usable('haste').find((c) => c.allies.length === 1 && c.allies[0].id !== caster && !hasStatus(c.allies[0], 'hasted'))
  if (haste) return haste.action
  const pressed = (u: UnitSnapshot) => state.units.some((f) => f.side !== u.side && f.hp > 0 && hexDistance(f.position, u.position) === 1)
  const protects = usable('protect').filter((c) => c.allies.length === 1 && pressed(c.allies[0]) && !hasStatus(c.allies[0], 'protected'))
  return best(protects, (c) => 1 - c.allies[0].hp / c.allies[0].maxHp, -Infinity)?.action ?? null
}

/**
 * When an ally it can heal is down to half its hit points or less, the heal
 * that restores the most, counting for each ally the lesser of the spell's
 * average and what it has lost; the cheaper on a tie.
 */
function healCast(casts: readonly CastOption[], healBonus: number): Action | null {
  const heals = casts.filter((c) => isHealing(c.spell) && c.allies.some((u) => u.hp * 2 <= u.maxHp))
  // The healer's bonus (Mending) is added before the cap, as the engine does.
  const restored = (c: CastOption) =>
    c.allies.reduce((sum, u) => sum + Math.min(mean(SPELLS[c.spell].heal) + healBonus, u.maxHp - u.hp), 0)
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
 * webbed, counting only those; a status-only spell (Bane) counts only the
 * foes not already under its status. A spell with damage counts only the foes its
 * average damage gets through the ward of (a foe warded against all of it
 * is no reason to throw it).
 */
function areaCast(state: BattleState, casts: readonly CastOption[], source: UnitId | null): Action | null {
  const areas = casts.filter((c) => SPELLS[c.spell].target === 'area' && SPELLS[c.spell].hostile && c.withinReserve && c.allies.length === 0)
  const hurt = (c: CastOption) => {
    const { damage, element } = SPELLS[c.spell]
    return damage ? c.foes.filter((u) => warded(mean(damage), element, statsIn(state.units, u)) > 0) : c.foes
  }
  const foesTouched = (c: CastOption) => {
    if (c.spell === 'web') return c.foes.filter((u) => !hasStatus(u, 'webbed')).length
    // A spell that only lays a status (Bane) counts the foes not under it yet.
    const { damage, status } = SPELLS[c.spell]
    const counted = !damage && status ? c.foes.filter((u) => !hasStatus(u, status.id)).length : hurt(c).length
    return counted >= 2 ? counted : 0
  }
  return best(areas, foesTouched, 0, castOn(source))?.action ?? null
}

/** Bless, when it would touch two allies or more not already blessed. */
function blessCast(casts: readonly CastOption[]): Action | null {
  const bless = casts.find((c) => c.spell === 'bless' && c.withinReserve)
  return bless && bless.allies.filter((u) => !hasStatus(u, 'blessed')).length >= 2 ? bless.action : null
}

/**
 * `spell` (Sleep, Glacial Prison) on the foe in range with the most hit points
 * that is not already helpless (asleep or frozen), while two foes or more stand.
 */
function disableCast(state: BattleState, self: UnitSnapshot, casts: readonly CastOption[], source: UnitId | null, spell: SpellId): Action | null {
  if (state.units.filter((u) => u.side !== self.side && u.hp > 0).length < 2) return null
  const disables = casts.filter((c) => c.spell === spell && c.withinReserve && c.foes.length === 1 && !isHelpless(c.foes[0]))
  return best(disables, (c) => c.foes[0].hp, 0, castOn(source))?.action ?? null
}

/** Glacial Prison on the healthiest foe in range not asleep or frozen, while two foes or more stand. */
function prisonCast(state: BattleState, self: UnitSnapshot, casts: readonly CastOption[], source: UnitId | null): Action | null {
  return disableCast(state, self, casts, source, 'glacial_prison')
}

/**
 * Sleep on the healthiest foe in range not asleep or frozen, while two foes or more stand, and not
 * on a foe with a unit of its own side beside it, whose blows would wake it at once (a sleeper
 * draws `HELPLESS_BONUS`, so its side's strikes go to it first).
 */
function sleepCast(state: BattleState, self: UnitSnapshot, casts: readonly CastOption[], source: UnitId | null): Action | null {
  const engaged = (foe: UnitSnapshot) => state.units.some((u) => u.side === self.side && u.hp > 0 && hexDistance(u.position, foe.position) === 1)
  return disableCast(state, self, casts.filter((c) => c.spell !== 'sleep' || !engaged(c.foes[0] ?? self)), source, 'sleep')
}

/** Curse on the foe in range with the most hit points that is not cursed, while two foes or more stand. */
function curseCast(state: BattleState, self: UnitSnapshot, casts: readonly CastOption[], source: UnitId | null): Action | null {
  if (state.units.filter((u) => u.side !== self.side && u.hp > 0).length < 2) return null
  const curses = casts.filter((c) => c.spell === 'curse' && c.withinReserve && c.foes.length === 1 && !hasStatus(c.foes[0], 'cursed'))
  return best(curses, (c) => c.foes[0].hp, 0, castOn(source))?.action ?? null
}

/**
 * The damaging spell of a single foe with the highest average damage after
 * the foe's ward against its element (its statuses and auras counted), on the
 * foe with the fewest hit points, the caster's spell power by element added. A `bane` spell's dice (Holy Light) count
 * double where the bane applies, and a spell's `bonusVs` dice (Ice Lance) are
 * added against a foe under one of their statuses, as the engine rolls them.
 */
function strikeCast(state: BattleState, self: UnitSnapshot, casts: readonly CastOption[], source: UnitId | null): Action | null {
  const strikes = casts.filter((c) => SPELLS[c.spell].target === 'foe' && SPELLS[c.spell].damage && c.withinReserve && c.foes.length === 1)
  const damage = (c: CastOption) => {
    const { damage: dice, element, bane, bonusVs } = SPELLS[c.spell]
    const foe = c.foes[0]
    const defender = statsIn(state.units, foe)
    const base = bane && dice && baneApplies(defender) ? mean({ ...dice, count: dice.count * 2 }) : mean(dice)
    const bonus = bonusVs && bonusVs.statuses.some((id) => hasStatus(foe, id)) ? mean(bonusVs.damage) : 0
    // The caster's spell power (Destruction, Pyromancy, Numbing Cold), added before the ward as the engine adds it.
    const added = spellPower(self, c.spell)
    return warded(base + bonus + added, element, defender)
  }
  // Damage first, then the weaker foe: hit points are below 1000.
  return best(strikes, (c) => damage(c) * 1000 - c.foes[0].hp, -Infinity, castOn(source))?.action ?? null
}

/**
 * How far the unit can do harm from, and for how many action points: by a
 * damaging spell of a single foe it has the mana for above its reserve, at
 * what the spell costs it (`spellApCost`), else by its weapon. Not by an
 * area spell, which it may not throw at all.
 */
function reach(self: UnitSnapshot): { range: number; apCost: number } {
  const reserve = manaReserve(self)
  const spell = self.magic?.spells.find((id) => {
    const known = SPELLS[id]
    return known.damage && known.target === 'foe' && self.mana - known.manaCost >= reserve
  })
  return spell ? { range: SPELLS[spell].range, apCost: spellApCost(self, spell) } : { range: self.attackRange, apCost: self.attackApCost }
}

/**
 * The situational bonus to `self`'s blow at `target`, less a technique
 * strike's own `toHit`: flanking, the arc, a helpless target and `self`'s traits
 * (`traitToHit`, as `previewAttack` has them), less Taunted's penalty.
 */
function blowBonus(state: BattleState, self: UnitSnapshot, target: UnitSnapshot): number {
  const arc = arcStruck(target, self.position, isMelee(self))
  return (
    flankersOf(state.units, self, target).length * FLANK_BONUS_PER_ALLY +
    ARC_BONUS[arc] +
    (isHelpless(target) ? HELPLESS_BONUS : 0) +
    traitToHit(self, { arc, free: false, moved: self.moved === true, attackedYet: self.attackedYet === true }) -
    tauntPenalty(self, target)
  )
}

/** The chance of `self`'s blow at `target` landing, with a technique strike's `toHit`. */
function blowChance(state: BattleState, self: UnitSnapshot, target: UnitSnapshot, strike?: Strike): number {
  const attacker = statsIn(state.units, self)
  const defender = statsIn(state.units, target)
  return hitChance(attacker, defender.ac, blowBonus(state, self, target) + (strike?.toHit ?? 0))
}

/**
 * The harm an attack would do on average: its chance to hit times the
 * average hit of `dice` (the unit's weapon's unless given) through the
 * target's resistance, near enough, and its weapon's on-hit damage through
 * the target's wards. A technique's weapon `strike` adds its `toHit` to the
 * chance, its `damageBonus` to the hit and its own on-hit entries (each with
 * an element raised by the unit's `imbueDamage`) to the weapon's. The unit's
 * traits add what they would to a hit that is no critical (`traitDamage`) and
 * pierce as they would (`resistanceLeft`). A hit that would leave the foe
 * within the attacker's Deathblow (`deathblows`) is worth all the foe has left.
 */
function expectedHarm(state: BattleState, self: UnitSnapshot, target: UnitSnapshot, dice?: DamageRoll, strike?: Strike): number {
  const attacker = statsIn(state.units, self)
  const defender = statsIn(state.units, target)
  const { count, sides, bonus: flat } = dice ?? attacker.damage
  const arc = arcStruck(target, self.position, isMelee(self))
  const traits = traitDamage(attacker, { arc, free: false }, false, { hp: target.hp, maxHp: defender.maxHp })
  const averageHit = damageThrough(count * ((sides + 1) / 2) + flat + (strike?.damageBonus ?? 0) + traits, resistanceLeft(attacker, defender.resistance ?? 0))
  const imbue = self.imbueDamage ?? 0
  const added = (strike?.onHit ?? []).map((entry) => (entry.element && imbue !== 0 ? { ...entry, damage: entry.damage + imbue } : entry))
  const hit = averageHit + onHitDamage([...(attacker.onHit ?? []), ...added], defender)
  // A hit that would leave the foe within Deathblow's reach fells it: it is worth what the foe has left.
  const dealt = target.hp - hit > 0 && deathblows(attacker, defender, target.hp - hit) ? target.hp : hit
  return blowChance(state, self, target, strike) * dealt
}

/** On-hit damage (runes, a technique's) against `defender`: each entry through its ward, a bane only where it applies. */
function onHitDamage(entries: CombatantStats['onHit'], defender: CombatantStats): number {
  let total = 0
  for (const entry of entries ?? []) {
    if (entry.damage > 0 && (!entry.bane || baneApplies(defender))) total += warded(entry.damage, entry.element, defender)
  }
  return total
}

type AbilityAction = Extract<Action, { type: 'ability' }>
type AreaAction = Extract<AbilityAction, { at: Hex }>
type AimedAbility = Extract<AbilityAction, { target: UnitId }>

const isArea = (action: Action): action is AreaAction => action.type === 'ability' && 'at' in action
const isAimed = (action: Action): action is AimedAbility => action.type === 'ability' && 'target' in action

/** Taunt, by its data: an area with no roll, of foes only, about the user, laying Taunted. */
const isTaunt = ({ area }: Ability) => area?.auto === true && area.foesOnly === true && area.centredOnSelf === true && area.status?.id === 'taunted'
/** Hunter's Mark, by its data: Marked laid on a foe with no roll. */
const isMark = ({ foeStatus }: Ability) => foeStatus?.status.id === 'marked'
/** Sprint, by its data: Hasted laid on the user. */
const isSprint = ({ selfStatus }: Ability) => selfStatus?.id === 'hasted'
/** An area ability scored by its harm: dice of its own (a monster's, Consecrate) or the weapon's (Volley). */
const damagingArea = ({ area }: Ability) => area !== undefined && (area.damage !== undefined || area.weaponDamage === true)

/** Whether the unit can pay an ability's mana and keep its heal reserve. */
function affordable(self: UnitSnapshot, ability: AbilityId): boolean {
  const cost = ABILITIES[ability].manaCost ?? 0
  return cost === 0 || self.mana - cost >= manaReserve(self)
}

/**
 * Taunt, when the user stands at half its hit points or more and it would
 * lay Taunted on two foes or more not yet taunted, or on one that stands
 * within its own reach of an ally (not the user) worse hurt, by share of
 * hit points, than the user.
 */
function tauntUse(state: BattleState, self: UnitSnapshot, own: readonly Action[], source: UnitId | null): Action | null {
  if (self.hp * 2 < self.maxHp) return null
  const taunts = own.filter(isArea).filter((a) => isTaunt(ABILITIES[a.ability]))
  if (taunts.length === 0) return null
  const share = self.hp / self.maxHp
  const weaker = state.units.filter((u) => u.side === self.side && u.id !== self.id && u.hp > 0 && u.hp / u.maxHp < share)
  const fresh = (a: AreaAction) => abilityTouches(state.units, self, a.ability, a.at, self.attackRange).filter((u) => !hasStatus(u, 'taunted'))
  const worth = (a: AreaAction) => {
    const foes = fresh(a)
    return foes.length >= 2 || foes.some((f) => weaker.some((ally) => hexDistance(f.position, ally.position) <= f.attackRange))
  }
  return best(taunts, (a) => (worth(a) ? 1 : 0), 0, (a) => touchesSource(state, self, a, source))
}

/** Whether an area ability touches `source`. */
function touchesSource(state: BattleState, self: UnitSnapshot, action: AreaAction, source: UnitId | null): boolean {
  return source !== null && abilityTouches(state.units, self, action.ability, action.at, self.attackRange).some((u) => u.id === source)
}

/**
 * Hunter's Mark on the foe not yet marked with the most hit points, the
 * first in roster order on a tie, when the user has the AP to mark it and
 * then attack.
 */
function markUse(state: BattleState, self: UnitSnapshot, own: readonly Action[], source: UnitId | null): Action | null {
  const marks = own
    .filter(isAimed)
    .filter((a) => isMark(ABILITIES[a.ability]) && affordable(self, a.ability) && self.ap - abilityApCost(self, a.ability) >= self.attackApCost)
  const target = (a: AimedAbility) => state.units.find((u) => u.id === a.target)
  const fresh = marks.filter((a) => {
    const foe = target(a)
    return foe !== undefined && !hasStatus(foe, 'marked')
  })
  const rank = (a: AimedAbility) => state.units.findIndex((u) => u.id === a.target)
  const ordered = [...fresh].sort((a, b) => rank(a) - rank(b))
  return best(ordered, (a) => target(a)!.hp, 0, (a) => a.target === source)
}

/** What laying `status` on `target` is worth: `STATUS_VALUE`'s, or for Seared the target's regeneration. */
function statusWorth(status: StatusId, target: UnitSnapshot): number {
  return status === 'seared' ? (target.regeneration ?? 0) : (STATUS_VALUE[status] ?? 0)
}

/**
 * The standing foe other than `besides` within the unit's attack range
 * nearest it, the lowest id on a tie, as the engine sends a strike that
 * `spreads`; null if none.
 */
function nextFoe(state: BattleState, self: UnitSnapshot, besides: UnitSnapshot): UnitSnapshot | null {
  let nearest: UnitSnapshot | null = null
  let gap = Infinity
  for (const u of state.units) {
    if (u.id === besides.id || u.side === self.side || u.hp <= 0) continue
    const d = hexDistance(self.position, u.position)
    if (d > self.attackRange) continue
    if (d < gap || (d === gap && nearest !== null && u.id < nearest.id)) {
      nearest = u
      gap = d
    }
  }
  return nearest
}

/**
 * A technique's score against `target`, in a plain attack's units: over
 * its strikes (a strike that `spreads` scored on the foe it would go to),
 * the expected harm, plus each status it lays on a hit worth `statusWorth`
 * times the strike's chance, where the foe lacks it, less `MANA_WEIGHT` a
 * point of mana; all times the uses that fit in the AP the unit has left
 * this turn (once with a recharge, and no more than its mana pays for
 * above the heal reserve),
 * over the plain blows that fit (at least one). So a 7 AP Power Attack and
 * a 5 AP blow at 8 AP are weighed one against one.
 */
export function techniqueScore(state: BattleState, self: UnitSnapshot, ability: AbilityId, target: UnitSnapshot): number {
  const known = ABILITIES[ability]
  let foe = target
  let total = 0
  for (const strike of known.strikes ?? []) {
    if (strike.spreads) foe = nextFoe(state, self, foe) ?? foe
    const dice = strike.damage && { ...strike.damage, bonus: strike.damage.bonus + (self.abilityDamageBonus ?? 0) }
    total += expectedHarm(state, self, foe, dice, strike)
    if (strike.status && !hasStatus(foe, strike.status.id)) total += statusWorth(strike.status.id, foe) * blowChance(state, self, foe, strike)
  }
  return ((total - MANA_WEIGHT * (known.manaCost ?? 0)) * usesThisTurn(self, ability)) / Math.max(1, Math.floor(self.ap / self.attackApCost))
}

/** How many times `ability` could be used with the AP the unit has left this turn: once with a recharge, and no more than its mana pays for above the heal reserve (`affordable`); at least once. */
function usesThisTurn(self: UnitSnapshot, ability: AbilityId): number {
  const known = ABILITIES[ability]
  let uses = Math.floor(self.ap / abilityApCost(self, ability))
  if (known.recharge > 0) uses = Math.min(uses, 1)
  if (known.manaCost) uses = Math.min(uses, Math.floor((self.mana - manaReserve(self)) / known.manaCost))
  return Math.max(1, uses)
}

/** One way to strike a foe and what it is worth: a plain attack, a routine (a monster's) or a technique. */
interface StrikeOption {
  action: Action
  target: UnitId
  score: number
  kind: 'attack' | 'routine' | 'technique'
}

/**
 * The best strike: of the legal plain attacks and routines, the one that
 * would do the most harm, a routine scoring the sum of its strikes' (each
 * with its own dice and the unit's `abilityDamageBonus`) against its first
 * target, a routine winning a tie with a plain attack; then a technique in
 * its place if its score (`techniqueScore`) is strictly higher, the first of
 * the highest; then an area ability with damage in its place if its net
 * harm (`areaHarm`, less `MANA_WEIGHT` a point of mana) is above 0 and
 * above the strike's, the first of the highest. A mana technique that would
 * dip below the heal reserve is not weighed. A taunted unit weighs only
 * what it would strike its taunter with, if it can strike it at all.
 */
function bestStrike(state: BattleState, self: UnitSnapshot, own: readonly Action[], source: UnitId | null): Action | null {
  const strikes: StrikeOption[] = []
  for (const action of own) {
    if (action.type !== 'attack' && !isAimed(action)) continue
    const target = state.units.find((u) => u.id === action.target)
    if (!target) continue
    if (action.type === 'attack') {
      strikes.push({ action, target: target.id, score: expectedHarm(state, self, target), kind: 'attack' })
      continue
    }
    const ability = ABILITIES[action.ability]
    if (!ability.strikes) continue
    if (ability.weaponAp === undefined) {
      strikes.push({ action, target: target.id, score: routineHarm(state, self, target, action.ability), kind: 'routine' })
    } else if (affordable(self, action.ability)) {
      strikes.push({ action, target: target.id, score: techniqueScore(state, self, action.ability, target), kind: 'technique' })
    }
  }
  const areas = own
    .filter(isArea)
    .filter((a) => damagingArea(ABILITIES[a.ability]) && affordable(self, a.ability))
    .map((action) => ({ action, score: areaHarm(state, self, action) - MANA_WEIGHT * (ABILITIES[action.ability].manaCost ?? 0) }))
  if (source !== null) {
    const onStrikes = strikes.filter((s) => s.target === source)
    const onAreas = areas.filter((a) => a.score > 0 && touchesSource(state, self, a.action, source))
    if (onStrikes.length > 0 || onAreas.length > 0) return pickStrike(onStrikes, onAreas)
  }
  return pickStrike(strikes, areas)
}

function pickStrike(strikes: readonly StrikeOption[], areas: readonly { action: AreaAction; score: number }[]): Action | null {
  let chosen: Action | null = null
  let bestHarm = -1
  let bestIsRoutine = false
  for (const { action, score, kind } of strikes) {
    if (kind === 'technique') continue
    const routine = kind === 'routine'
    if (score > bestHarm || (routine && !bestIsRoutine && score === bestHarm)) {
      chosen = action
      bestHarm = score
      bestIsRoutine = routine
    }
  }
  for (const { action, score, kind } of strikes) {
    if (kind === 'technique' && score > bestHarm) {
      chosen = action
      bestHarm = score
    }
  }
  return best(areas, (a) => a.score, Math.max(0, bestHarm))?.action ?? chosen
}

/**
 * An area ability's net harm: over each unit it would touch, its chance to
 * hit (less Taunted's penalty) times the mean of the dice after the unit's
 * ward, plus with `halfOnMiss` its chance to miss times half that mean,
 * rounded down, after the ward; added for a foe and taken off for a unit of
 * its own side, itself included. The dice are its own with the unit's
 * `abilityDamageBonus`, or the weapon's (`weaponDamage`), their count
 * doubled against a unit a `bane` area's bane applies to, and with
 * `throughResistance` each mean goes through the unit's resistance first.
 */
function areaHarm(state: BattleState, self: UnitSnapshot, action: AreaAction): number {
  const area = ABILITIES[action.ability].area!
  const attacker = statsIn(state.units, self)
  const dice = area.weaponDamage ? attacker.damage : area.damage
  const extra = area.weaponDamage ? 0 : (self.abilityDamageBonus ?? 0)
  const plain = mean(dice) + extra
  return abilityTouches(state.units, self, action.ability, action.at, self.attackRange).reduce((sum, unit) => {
    const defender = statsIn(state.units, unit)
    const chance = hitChance(attacker, defender.ac, -tauntPenalty(self, unit))
    const average = area.bane && dice && baneApplies(defender) ? mean({ ...dice, count: dice.count * 2 }) + extra : plain
    const through = (x: number) => (area.throughResistance ? damageThrough(x, effectiveResistance(attacker, defender.resistance ?? 0)) : x)
    const missed = area.halfOnMiss ? (1 - chance) * warded(through(Math.floor(average / 2)), area.element, unit) : 0
    const harm = chance * warded(through(average), area.element, unit) + missed
    return unit.side === self.side ? sum - harm : sum + harm
  }, 0)
}

/**
 * An area ability that only lays a status (Web), where it touches a foe
 * not already under it and no unit of its own side: the aim touching the
 * most such foes, the first on a tie. Not one with no roll (Taunt), which
 * has a step of its own.
 */
function statusArea(state: BattleState, self: UnitSnapshot, own: readonly Action[], source: UnitId | null): Action | null {
  const areas = own.filter(isArea).filter((a) => {
    const area = ABILITIES[a.ability].area!
    return !area.damage && !area.weaponDamage && !area.auto && area.status
  })
  const fresh = (action: AreaAction) => {
    const area = ABILITIES[action.ability].area!
    const touched = abilityTouches(state.units, self, action.ability, action.at, self.attackRange)
    if (touched.some((u) => u.side === self.side)) return 0
    return touched.filter((u) => !hasStatus(u, area.status!.id)).length
  }
  return best(areas, fresh, 0, (a) => touchesSource(state, self, a, source))
}

/** The summed expected harm of a routine's strikes on `target`. */
function routineHarm(state: BattleState, self: UnitSnapshot, target: UnitSnapshot, ability: AbilityId): number {
  const bonus = self.abilityDamageBonus ?? 0
  return (ABILITIES[ability].strikes ?? []).reduce(
    // Only monsters' routines reach here, and their strikes all have their own dice.
    (sum, strike) => sum + expectedHarm(state, self, target, { ...strike.damage!, bonus: strike.damage!.bonus + bonus }),
    0,
  )
}

/** The foes the unit closes on: its taunter alone while it stands, else every standing foe. */
function goals(state: BattleState, self: UnitSnapshot, source: UnitId | null): UnitSnapshot[] {
  return state.units.filter((u) => (source !== null ? u.id === source : u.side !== self.side && u.hp > 0))
}

/**
 * Sprint, when no foe is within the unit's reach and no move would leave it
 * the AP to strike from where it ends, but one would with the action points
 * Sprint's status adds.
 */
function sprintUse(state: BattleState, self: UnitSnapshot, own: readonly Action[], source: UnitId | null): Action | null {
  const sprint = own.filter(isAimed).find((a) => isSprint(ABILITIES[a.ability]) && affordable(self, a.ability))
  if (!sprint) return null
  const foes = goals(state, self, source)
  if (foes.length === 0) return null
  const gap = (h: Hex) => Math.min(...foes.map((f) => hexDistance(h, f.position)))
  const { range, apCost } = reach(self)
  if (gap(self.position) <= range) return null
  const extra = STATUSES[ABILITIES[sprint.ability].selfStatus!.id].actionPoints ?? 0
  const strikesFrom = (ap: number) =>
    own.some((a) => a.type === 'move' && gap(a.to) <= range && ap - hexDistance(self.position, a.to) * MOVE_AP_COST_PER_HEX >= apCost)
  return !strikesFrom(self.ap) && strikesFrom(self.ap + extra) ? sprint : null
}

function closingMove(state: BattleState, self: UnitSnapshot, own: readonly Action[], source: UnitId | null): Action | null {
  const foes = goals(state, self, source)
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
