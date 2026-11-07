import { ABILITIES, type Ability } from '../combat/abilities.ts'
import { ELEMENTS, formatDamage, type DamageRoll } from '../combat/combat.ts'
import { STATUSES, type StatusLaid } from '../combat/spells.ts'
import type { UnitSnapshot } from '../engine/battleEngine.ts'

/** Lines that describe an ability, under its name: indented by this, so the panel can tell them apart. */
export const DESCRIPTION_INDENT = '  '

/**
 * What hovering a foe tells: its name, as the panel's title; then for each
 * ability a line with its name and when it is ready ("Fire Spit: ready",
 * "Web: ready in 2 turns"), and under it what it does, worked out from its
 * data (`describeAbility`); then its wards ("Wards: fire 99"). [] for a unit
 * with neither abilities nor wards.
 *
 * The panel is read on the player's turn, and a recharge counter falls as the
 * foe's own turn begins, so a counter of N means the ability is usable on the
 * foe's Nth turn from now: 1 is "ready next turn".
 */
export function foeInfoLines(unit: UnitSnapshot): string[] {
  const lines = (unit.abilities ?? []).flatMap((id) => {
    const turns = unit.recharging[id] ?? 0
    const state = turns <= 0 ? 'ready' : turns === 1 ? 'ready next turn' : `ready in ${turns} turns`
    const described = describeAbility(ABILITIES[id], unit.abilityDamageBonus ?? 0).map((line) => DESCRIPTION_INDENT + line)
    return [`${ABILITIES[id].name}: ${state}`, ...described]
  })
  const wards = ELEMENTS.filter((e) => (unit.wards?.[e] ?? 0) > 0).map((e) => `${e} ${unit.wards![e]}`)
  if (wards.length > 0) lines.push(`Wards: ${wards.join(', ')}`)
  return lines.length > 0 ? [unit.name, ...lines] : []
}

/**
 * What an ability does, in a line or two, from its data alone: a routine's
 * strikes and their dice, then any status a strike lays; an area's shape and
 * reach, its dice and element, half on a miss, and the status it lays. The
 * dice carry `bonus`, the user's `abilityDamageBonus`, as the engine adds it.
 */
export function describeAbility(ability: Ability, bonus = 0): string[] {
  const dice = (roll: DamageRoll) => formatDamage({ ...roll, bonus: roll.bonus + bonus })
  if (ability.strikes) {
    const strikes = ability.strikes.map((s) => `${s.name.toLowerCase()} ${dice(s.damage)}`).join(', ')
    const laid = ability.strikes.filter((s) => s.status).map((s) => `${s.name.toLowerCase()}: ${statusPhrase(s.status!)}`)
    return [strikes, ...laid]
  }
  const area = ability.area!
  const shape = area.shape === 'burst' ? `burst ${area.radius ?? 0}, range ${area.range}` : `${area.shape} ${area.range}`
  if (!area.damage) return [area.status ? `${shape}: ${statusPhrase(area.status)}` : shape]
  const element = area.element ? ` ${area.element}` : ''
  const half = area.halfOnMiss ? ', half on a miss' : ''
  return [`${shape}: ${dice(area.damage)}${element}${half}`, ...(area.status ? [statusPhrase(area.status)] : [])]
}

/** "webbed 2 turns (−4 AP)": a status, how long, and what it does, from `STATUSES`. */
function statusPhrase(laid: StatusLaid): string {
  const rule = STATUSES[laid.id]
  const signed = (n: number) => (n < 0 ? `−${-n}` : `+${n}`)
  const effects = [
    ...(rule.sleep ? ['no AP, helpless'] : []),
    ...(rule.actionPoints ? [`${signed(rule.actionPoints)} AP`] : []),
    ...(rule.toHit ? [`${signed(rule.toHit)} to hit`] : []),
    ...(rule.armorClass ? [`${signed(rule.armorClass)} AC`] : []),
    ...(rule.resistance ? [`${signed(rule.resistance)} resistance`] : []),
    ...(rule.tick ? [`${formatDamage(rule.tick)} ${rule.tickName ?? rule.adjective} a turn`] : []),
    ...(rule.stopsRegeneration ? ['no regeneration'] : []),
    ...(rule.images ? ['images take hits'] : []),
  ]
  const turns = `${laid.turns} turn${laid.turns === 1 ? '' : 's'}`
  return `${rule.adjective} ${turns}${effects.length > 0 ? ` (${effects.join(', ')})` : ''}`
}
