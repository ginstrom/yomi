import { maxHp, maxMana } from '../character/character.ts'
import type { WorldEvent } from './blight.ts'
import { autoHeal, type Party } from './party.ts'
import { isNotable, monstersHere, passTurn, worldActive, type WorldState } from './worldMap.ts'

/**
 * Camping on the world map: the party rests where it stands, a day at a
 * time. A day is a world turn, as a hex of travel is; it fills every
 * caster's mana and heals every member `NATURAL_HEALING_PER_DAY`. Camping
 * until healed casts the party's heals as a careful player would (`autoHeal`)
 * and camps another day while anyone is still wounded, so that mana is spent
 * on wounds before each night refills it, unless a notable event on the map
 * (`isNotable`) breaks camp first.
 */

/** What a day's rest heals each member, besides what a caster's refilled mana can heal. */
export const NATURAL_HEALING_PER_DAY = 1

/** What came of camping: the days it took, the hit points restored by rest and by spells, what happened on the map meanwhile, and the event that broke camp if one did. */
export interface CampResult {
  days: number
  rested: number
  cast: number
  events: WorldEvent[]
  interruptedBy: WorldEvent | null
}

/** A day's rest: the hit points it restored, and what happened on the map that day. */
export interface CampDay {
  healed: number
  events: WorldEvent[]
}

/** Whether the party may camp where it stands: anywhere but among monsters, while the game goes on. */
export function canCamp(world: WorldState): boolean {
  return worldActive(world) && world.confronting === null && monstersHere(world) === null
}

/** Whether some member has lost hit points. */
export function partyWounded(party: Party): boolean {
  return party.some((member) => member.hp < maxHp(member))
}

const totalHp = (party: Party) => party.reduce((sum, member) => sum + member.hp, 0)

/**
 * Camps one day: a world turn passes (`passTurn`), every member heals
 * `NATURAL_HEALING_PER_DAY` up to its maximum and every caster's mana is
 * full. Returns the hit points restored and the day's events, or null,
 * changing nothing, where the party cannot camp.
 */
export function campDay(world: WorldState, party: Party): CampDay | null {
  if (!canCamp(world)) return null
  const before = totalHp(party)
  const events = passTurn(world, party)
  for (const member of party) {
    member.hp = Math.min(maxHp(member), member.hp + NATURAL_HEALING_PER_DAY)
    member.mana = maxMana(member)
  }
  return { healed: totalHp(party) - before, events }
}

/**
 * Heals the whole party: casts its heals with the mana it has (`autoHeal`),
 * then while anyone is wounded camps a day and casts again, until a notable
 * event breaks camp or the game ends. A party already whole camps no day.
 * Returns null, changing nothing, where the party cannot camp.
 */
export function campUntilHealed(world: WorldState, party: Party): CampResult | null {
  if (!canCamp(world)) return null
  const result: CampResult = { days: 0, rested: 0, cast: autoHeal(party), events: [], interruptedBy: null }
  // Ends: each day heals every wounded member at least a hit point.
  while (partyWounded(party) && canCamp(world)) {
    const day = campDay(world, party)!
    result.rested += day.healed
    result.events.push(...day.events)
    result.days += 1
    result.cast += autoHeal(party)
    result.interruptedBy = day.events.find((event) => isNotable(world, event)) ?? null
    if (result.interruptedBy) break
  }
  return result
}

/** The world map's line for what camping did. */
export function describeCamp({ days, rested, cast }: Pick<CampResult, 'days' | 'rested' | 'cast'>): string {
  if (days === 0) return cast > 0 ? `Your casters heal ${cast} hp, and no one is wounded.` : 'No one is wounded.'
  const spells = cast > 0 ? `, ${cast} by spells` : ''
  return `Camped ${days} ${days === 1 ? 'day' : 'days'}: ${rested + cast} hp healed (${rested} by rest${spells}).`
}
