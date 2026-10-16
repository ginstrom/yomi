import type { WorldEvent } from '../game/blight.ts'

/** The world map's line for an event, or '' for one too small to tell (a hex's level changing). */
export function describeWorldEvent(event: WorldEvent): string {
  switch (event.type) {
    case 'sighted':
      return `You sight a ${event.name} (threat ${event.threat}).`
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
