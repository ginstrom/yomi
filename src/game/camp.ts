import { maxHp, maxMana } from '../character/character.ts'
import type { WorldEvent } from './blight.ts'
import { act, advance, setOrder, worldInterrupt } from './company.ts'
import type { Expedition } from './expedition.ts'
import type { GameState } from './gameState.ts'
import { restHealing } from './infirmary.ts'
import { autoHeal, type Party } from './party.ts'
import { monstersHere, worldActive, type WorldState } from './worldMap.ts'

/**
 * Camping on the world map: the party rests where it stands, a day at a
 * time. A day is a world turn, as a hex of travel is; it fills every
 * caster's mana and heals every member what the infirmary says
 * (`restHealing`: `NATURAL_HEALING_PER_DAY` without one). Camping
 * until healed casts the party's heals as a careful player would (`autoHeal`)
 * and camps another day while anyone is still wounded, so that mana is spent
 * on wounds before each night refills it, unless a notable event on the map
 * (`isNotable`) breaks camp first.
 */

/** What a day's rest heals each member without an infirmary, besides what a caster's refilled mana can heal. */
export { NATURAL_HEALING_PER_DAY } from './infirmary.ts'

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
export function canCamp(world: WorldState, party: Expedition): boolean {
  return worldActive(world) && party.confronting === null && monstersHere(world, party) === null
}

/** Whether some member has lost hit points. */
export function partyWounded(party: Party): boolean {
  return party.some((member) => member.hp < maxHp(member))
}

const totalHp = (party: Party) => party.reduce((sum, member) => sum + member.hp, 0)

/**
 * A day's rest, with no time passing: every member heals `restHealing` (judged
 * where the party stands) up to its maximum and every caster's mana is
 * filled. Returns the hit points restored. The day loop (company.ts) rests a
 * party before the world's day, which reads no hit points or mana, so that
 * resting before it comes to what resting after it would.
 */
export function rest(world: WorldState, party: Expedition): number {
  const members = party.members
  const before = totalHp(members)
  const healing = members.map((member) => restHealing(world, party, member))
  for (const [i, member] of members.entries()) {
    member.hp = Math.min(maxHp(member), member.hp + healing[i])
    member.mana = maxMana(member)
  }
  return totalHp(members) - before
}

/**
 * Camps one day, a one-day order on the day loop (`act`): the party rests
 * (`rest`) and a world turn passes. Returns the hit points restored and the
 * day's events, or null, changing nothing, where the party cannot camp.
 */
export function campDay(game: GameState, party: Expedition): CampDay | null {
  if (!canCamp(game.world, party)) return null
  const report = act(game, party.id, { kind: 'camp' })
  if (typeof report === 'string') return null
  const day = report.parties.find((d) => d.party === party.id)
  return { healed: day?.rested ?? 0, events: report.events }
}

/**
 * Heals the whole party: casts its heals with the mana it has (`autoHeal`),
 * then while anyone is wounded camps a day and casts again, until a notable
 * event breaks camp or the game ends. A party already whole camps no day.
 * Returns null, changing nothing, where the party cannot camp. The days are
 * a camp order run on the day loop (company.ts); broken off, the order stands.
 */
export function campUntilHealed(game: GameState, party: Expedition): CampResult | null {
  if (!canCamp(game.world, party)) return null
  const members = party.members
  const result: CampResult = { days: 0, rested: 0, cast: autoHeal(members), events: [], interruptedBy: null }
  if (!partyWounded(members)) {
    // As every convenience gives its own order, this one leaves none standing.
    setOrder(game, party.id, { kind: 'idle' })
    return result
  }
  setOrder(game, party.id, { kind: 'camp' })
  // Ends: each day heals every wounded member at least a hit point.
  for (const report of advance(game, Infinity)) {
    const day = report.parties.find((d) => d.party === party.id)
    result.days += 1
    result.rested += day?.rested ?? 0
    result.cast += day?.cast ?? 0
    result.events.push(...report.events)
    result.interruptedBy = worldInterrupt(report)
  }
  return result
}

/** The world map's line for what camping did. */
export function describeCamp({ days, rested, cast }: Pick<CampResult, 'days' | 'rested' | 'cast'>): string {
  if (days === 0) return cast > 0 ? `Your casters heal ${cast} hp, and no one is wounded.` : 'No one is wounded.'
  const spells = cast > 0 ? `, ${cast} by spells` : ''
  return `Camped ${days} ${days === 1 ? 'day' : 'days'}: ${rested + cast} hp healed (${rested} by rest${spells}).`
}
