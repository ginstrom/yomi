import type { WorldEvent } from '../game/blight.ts'
import { isPartyEvent, type DayReport, type Interrupt, type PartyEvent } from '../game/company.ts'
import { midSentence, theName, type MonsterLocation, type WorldState } from '../game/worldMap.ts'

/** The world map's line for an event, or '' for one too small to tell (a hex's level changing). */
export function describeWorldEvent(event: WorldEvent): string {
  switch (event.type) {
    case 'sighted':
      return event.source
        ? `You have found the heart of the blight, ${midSentence(event.name)} (threat ${event.threat}). Destroy it to end the blight.`
        : `You sight a ${event.name} (threat ${event.threat}).`
    case 'site_threatened':
      return `${event.name} is under threat: the blight takes it in ${event.days} ${event.days === 1 ? 'day' : 'days'}.`
    case 'site_captured':
      return `${event.name} is cleansed, and now yours.`
    case 'site_lost':
      return event.outpost ? `${event.name} is lost to the blight, and its outpost razed.` : `${event.name} is lost to the blight.`
    case 'yield':
      return `${event.name} yields ${event.amount} ${event.material}.`
    case 'tower_built':
      return 'A watchtower rises over the land.'
    case 'outpost_built':
      return `An outpost stands at ${event.name}.`
    case 'tower_lost':
      return 'A watchtower is lost to the blight.'
    case 'encampment_lost':
      return `The blight has taken ${event.name}.`
    // Unseen: a spawn is told when it comes into sight.
    case 'spawned':
    case 'level_changed':
      return ''
  }
}

/**
 * What the message line says of the events of a journey or a stretch of
 * camping: the one that cut it short, or else the last that matters (yields
 * and the land's levels are left to the map and the header), with a count of
 * the rest.
 */
export function describeWorldEvents(events: readonly WorldEvent[], interruptedBy: WorldEvent | null = null): string {
  if (interruptedBy) return describeWorldEvent(interruptedBy)
  const told = events.filter((event) => describeWorldEvent(event) !== '' && event.type !== 'yield')
  const last = told.at(-1)
  if (!last) return ''
  const more = told.length - 1
  return more > 0 ? `${describeWorldEvent(last)} (${more} more ${more === 1 ? 'event' : 'events'} on the map.)` : describeWorldEvent(last)
}

/** The words for a party's own event (the day loop's). */
export function describePartyEvent(event: PartyEvent, world: WorldState): string {
  switch (event.type) {
    case 'arrived':
      return 'The party arrives.'
    case 'confronting': {
      const location = world.locations.find((l): l is MonsterLocation => l.id === event.location && l.kind === 'monsters')
      return location ? `You come upon ${theName(location.name)} (threat ${location.threat}).` : ''
    }
    case 'order_done':
      return 'The party has done what it was set to.'
  }
}

/** What stopped the days, in words; a party that arrived among monsters is told only of coming upon them. */
function describeInterrupt(interrupt: Interrupt, partyEvents: readonly PartyEvent[], world: WorldState): string {
  const { event } = interrupt
  if (!isPartyEvent(event)) return describeWorldEvent(event)
  const confronting = partyEvents.find((e) => e.type === 'confronting')
  return describePartyEvent(confronting ?? event, world)
}

/**
 * What the message line says of days passed (Next day, Until something
 * happens): the interrupt that stopped them, else the last event that matters
 * and, once `limit` days passed with nothing happening, that they passed quietly.
 */
export function describeDays(reports: readonly DayReport[], world: WorldState, limit: number): string {
  const last = reports.at(-1)
  const healed = reports.reduce((sum, report) => sum + report.parties.reduce((s, day) => s + day.rested + day.cast, 0), 0)
  const rest = healed > 0 ? ` Rest heals ${healed} hp.` : ''
  if (last?.interrupt) {
    const days = reports.length
    return `${days > 1 ? `After ${days} days: ` : ''}${describeInterrupt(last.interrupt, last.partyEvents, world)}${rest}`
  }
  if (reports.length >= limit && limit > 1) return `${limit} days passed quietly.${rest}`
  const told = describeWorldEvents(reports.flatMap((report) => report.events))
  return told ? `${told}${rest}` : `A quiet day.${rest}`
}
