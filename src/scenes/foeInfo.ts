import { ABILITIES, MONSTER_ABILITY_IDS, type Ability, type AbilityId, type Strike } from '../combat/abilities.ts'
import { ELEMENTS, formatDamage, type CombatantStats, type DamageRoll } from '../combat/combat.ts'
import { STATUSES, STATUS_IDS, refusesStatus, type StatusLaid } from '../combat/spells.ts'
import { TAUNT_PENALTY, type UnitSnapshot } from '../engine/battleEngine.ts'
import { costWords } from './perkTree.ts'

/** Lines that describe an ability, under its name: indented by this, so the panel can tell them apart. */
export const DESCRIPTION_INDENT = '  '

/**
 * What hovering a foe tells: its name, as the panel's title; then for each
 * ability a line with its name and when it is ready ("Fire Spit: ready",
 * "Web: ready in 2 turns"), and under it what it does, worked out from its
 * data (`describeAbility`); then its wards ("Wards: fire 99"); then what it
 * is immune to ("Immune to acid and poison": the statuses it refuses, by what
 * their ticks are called). [] for a unit with none of these.
 *
 * The panel is read on the player's turn, and a recharge counter falls as the
 * foe's own turn begins, so a counter of N means the ability is usable on the
 * foe's Nth turn from now: 1 is "ready next turn".
 */
export function foeInfoLines(unit: UnitSnapshot): string[] {
  const lines = (unit.abilities ?? []).flatMap((id) => {
    const turns = unit.recharging[id] ?? 0
    const state = turns <= 0 ? 'ready' : turns === 1 ? 'ready next turn' : `ready in ${turns} turns`
    const described = describeAbility(id, unit.abilityDamageBonus ?? 0, unit).map((line) => DESCRIPTION_INDENT + line)
    return [`${ABILITIES[id].name}: ${state}`, ...described]
  })
  const wards = ELEMENTS.filter((e) => (unit.wards?.[e] ?? 0) > 0).map((e) => `${e} ${unit.wards![e]}`)
  if (wards.length > 0) lines.push(`Wards: ${wards.join(', ')}`)
  const refused = STATUS_IDS.filter((id) => refusesStatus(unit, id)).map((id) => STATUSES[id].tickName ?? STATUSES[id].adjective)
  if (refused.length > 0) lines.push(`Immune to ${refused.join(' and ')}`)
  return lines.length > 0 ? [unit.name, ...lines] : []
}

/**
 * What an ability does, in a line or two, from its data alone: for a hero's
 * technique first what it costs the user (`stats`) and the weapon it needs
 * ("3 mana, 6 AP (weapon + 1), melee weapon"); then a routine's strikes and
 * their dice, or a weapon strike's blow and what it adds, then any status a
 * strike lays; a status laid on the user or a foe; an area's shape and
 * reach, its dice and element, half on a miss, and the status it lays. The
 * dice carry `bonus`, the user's `abilityDamageBonus`, as the engine adds it.
 */
export function describeAbility(id: AbilityId, bonus = 0, stats: Pick<CombatantStats, 'attackApCost'> = { attackApCost: 0 }): string[] {
  const ability = ABILITIES[id]
  const cost = isTechnique(id) ? [costLine(id, stats)] : []
  return [...cost, ...effectLines(ability, bonus)]
}

/** A hero's technique, which shows what it costs; a monster's ability does not. */
function isTechnique(id: AbilityId): boolean {
  return !MONSTER_ABILITY_IDS.includes(id)
}

function costLine(id: AbilityId, stats: Pick<CombatantStats, 'attackApCost'>): string {
  const needs = ABILITIES[id].needs
  return `${costWords(id, stats)}${needs ? `, ${needs} weapon` : ''}`
}

function effectLines(ability: Ability, bonus: number): string[] {
  const dice = (roll: DamageRoll) => formatDamage({ ...roll, bonus: roll.bonus + bonus })
  if (ability.strikes) {
    const laid = ability.strikes.filter((s) => s.status).map((s) => `${s.name.toLowerCase()}: ${statusPhrase(s.status!)}`)
    if (ability.strikes.some((s) => s.weapon)) return [...ability.strikes.map((s) => weaponStrike(s, ability)), ...laid]
    const strikes = ability.strikes.map((s) => `${s.name.toLowerCase()} ${dice(s.damage!)}`).join(', ')
    return [strikes, ...laid]
  }
  if (ability.selfStatus) return [`itself: ${statusPhrase(ability.selfStatus)}`]
  if (ability.foeStatus) {
    const { range, status } = ability.foeStatus
    return [`a foe within ${range === 'weapon' ? 'weapon range' : `${range} hexes`}: ${statusPhrase(status)}`]
  }
  const area = ability.area!
  const reach = area.centredOnSelf ? 'around itself' : area.weaponRange ? 'weapon range' : `range ${area.range}`
  const burst = area.shape === 'burst' ? `burst ${area.radius ?? 0}, ${reach}` : `${area.shape} ${area.range}`
  const shape = `${burst}${area.foesOnly ? ', foes only' : ''}`
  const harm = area.weaponDamage ? 'weapon damage' : area.damage ? dice(area.damage) : null
  if (harm === null) return [area.status ? `${shape}: ${statusPhrase(area.status)}` : shape]
  const notes = [
    ...(area.element ? [` ${area.element}`] : []),
    ...(area.throughResistance ? [', cut by armour'] : []),
    ...(area.halfOnMiss ? [', half on a miss'] : []),
    ...(area.bane ? [', double dice vs the regenerating and blightborn'] : []),
  ]
  return [`${shape}: ${harm}${notes.join('')}`, ...(area.status ? [statusPhrase(area.status)] : [])]
}

/** "power attack: weapon blow, −10 to hit, +6 dmg": a technique's strike with its own weapon, and what it adds. */
function weaponStrike(strike: Strike, ability: Ability): string {
  const blow = ability.needs === 'melee' ? 'weapon blow' : ability.needs === 'ranged' ? 'weapon shot' : 'weapon blow or shot'
  const signed = (n: number) => (n < 0 ? `−${-n}` : `+${n}`)
  const parts = [
    blow,
    ...(strike.toHit ? [`${signed(strike.toHit)} to hit`] : []),
    ...(strike.damageBonus ? [`+${strike.damageBonus} dmg`] : []),
    ...(strike.onHit ?? []).map((o) => `+${o.damage} ${o.element ?? 'on hit'}${o.bane ? ' vs the regenerating and blightborn' : ''}`),
    ...(strike.spreads ? ['at another foe in reach'] : []),
  ]
  return `${strike.name.toLowerCase()}: ${parts.join(', ')}`
}

/** "webbed 2 turns (−4 AP)": a status, how long, and what it does, from `STATUSES`. */
function statusPhrase(laid: StatusLaid): string {
  const rule = STATUSES[laid.id]
  const signed = (n: number) => (n < 0 ? `−${-n}` : `+${n}`)
  const effects = [
    ...(rule.helpless ? ['no AP, helpless'] : []),
    ...(rule.actionPoints ? [`${signed(rule.actionPoints)} AP`] : []),
    ...(rule.toHit ? [`${signed(rule.toHit)} to hit`] : []),
    // Taunted's penalty is the engine's, as it depends on whom the taunted strikes.
    ...(laid.id === 'taunted' ? [`−${TAUNT_PENALTY} to hit but at the taunter`] : []),
    ...(rule.armorClass ? [`${signed(rule.armorClass)} AC`] : []),
    ...(rule.resistance ? [`${signed(rule.resistance)} resistance`] : []),
    ...(rule.wardAll ? [`+${rule.wardAll} to every ward`] : []),
    ...(rule.immobile ? ['cannot move'] : []),
    ...(rule.tick ? [`${formatDamage(rule.tick)} ${rule.tickName ?? rule.adjective} a turn`] : []),
    ...(rule.stopsRegeneration ? ['no regeneration'] : []),
    ...(rule.images ? ['images take hits'] : []),
  ]
  const turns = `${laid.turns} turn${laid.turns === 1 ? '' : 's'}`
  return `${rule.adjective} ${turns}${effects.length > 0 ? ` (${effects.join(', ')})` : ''}`
}
