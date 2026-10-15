import { maxHp, maxMana } from '../character/character.ts'
import { autoHeal, type Party } from './party.ts'
import { monstersHere, type WorldState } from './worldMap.ts'

/**
 * Camping on the world map: the party rests where it stands, a day at a
 * time. A day is a world turn, as a hex of travel is; it fills every
 * caster's mana and heals every member `NATURAL_HEALING_PER_DAY`. Camping
 * until healed casts the party's heals as a careful player would (`autoHeal`)
 * and camps another day while anyone is still wounded, so that mana is spent
 * on wounds before each night refills it.
 */

/** What a day's rest heals each member, besides what a caster's refilled mana can heal. */
export const NATURAL_HEALING_PER_DAY = 1

/** What came of camping: the days it took and the hit points restored by rest and by spells. */
export interface CampResult {
  days: number
  rested: number
  cast: number
}

/** Whether the party may camp where it stands: anywhere but among monsters. */
export function canCamp(world: WorldState): boolean {
  return world.confronting === null && monstersHere(world) === null
}

/** Whether some member has lost hit points. */
export function partyWounded(party: Party): boolean {
  return party.some((member) => member.hp < maxHp(member))
}

const totalHp = (party: Party) => party.reduce((sum, member) => sum + member.hp, 0)

/**
 * Camps one day: a world turn passes, every member heals
 * `NATURAL_HEALING_PER_DAY` up to its maximum and every caster's mana is
 * full. Returns the hit points restored, or null, changing nothing, where the
 * party cannot camp.
 */
export function campDay(world: WorldState, party: Party): number | null {
  if (!canCamp(world)) return null
  const before = totalHp(party)
  world.turn += 1
  for (const member of party) {
    member.hp = Math.min(maxHp(member), member.hp + NATURAL_HEALING_PER_DAY)
    member.mana = maxMana(member)
  }
  return totalHp(party) - before
}

/**
 * Heals the whole party: casts its heals with the mana it has (`autoHeal`),
 * then while anyone is wounded camps a day and casts again. A party already
 * whole camps no day. Returns null, changing nothing, where the party cannot
 * camp.
 */
export function campUntilHealed(world: WorldState, party: Party): CampResult | null {
  if (!canCamp(world)) return null
  const result: CampResult = { days: 0, rested: 0, cast: autoHeal(party) }
  // Ends: each day heals every wounded member at least a hit point.
  while (partyWounded(party)) {
    result.rested += campDay(world, party)!
    result.days += 1
    result.cast += autoHeal(party)
  }
  return result
}

/** The world map's line for what camping did. */
export function describeCamp({ days, rested, cast }: CampResult): string {
  if (days === 0) return cast > 0 ? `Your casters heal ${cast} hp, and no one is wounded.` : 'No one is wounded.'
  const spells = cast > 0 ? `, ${cast} by spells` : ''
  return `Camped ${days} ${days === 1 ? 'day' : 'days'}: ${rested + cast} hp healed (${rested} by rest${spells}).`
}
