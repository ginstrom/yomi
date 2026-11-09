import type { WorldEvent } from '../game/blight.ts'
import { isPartyEvent, worldInterrupt, type DayReport, type Interrupt, type PartyEvent } from '../game/company.ts'
import type { Expedition } from '../game/expedition.ts'
import { partyById, type GameState } from '../game/gameState.ts'
import { midSentence, monstersHere, theName, type MonsterLocation } from '../game/worldMap.ts'
import { knownLocationAt } from './partyList.ts'

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

/** The name a message leads with for party `id`: its own while the company has two parties or more, else null (nor for no party, or one gone). */
function speaker(game: GameState, id: string | null): string | null {
  if (id === null || game.parties.length < 2) return null
  return partyById(game, id)?.name ?? null
}

/** `text` led by the name of the party it concerns, where the company has more than one; `after` the days it took, if more than one. */
function spoken(game: GameState, id: string | null, text: string, days = 1): string {
  const name = speaker(game, id)
  const after = days > 1 ? `after ${days} days` : ''
  if (name === null) return after ? `After ${days} days: ${text}` : text
  return after ? `${name}, ${after}: ${text}` : `${name}: ${text}`
}

/**
 * The words for a party's own event (the day loop's). With one party the
 * message speaks to the player ("The party arrives."); with more, it leads
 * with the party's name ("Second Company: arrived at Kobold Scouts.").
 */
export function describePartyEvent(event: PartyEvent, game: GameState): string {
  const { world } = game
  const name = speaker(game, event.party)
  switch (event.type) {
    case 'arrived': {
      if (name === null) return 'The party arrives.'
      const place = knownLocationAt(world, event.at)
      return `${name}: arrived${place ? ` at ${midSentence(place.name)}` : ''}.`
    }
    case 'confronting': {
      const location = world.locations.find((l): l is MonsterLocation => l.id === event.location && l.kind === 'monsters')
      if (!location) return ''
      const met = `${theName(location.name)} (threat ${location.threat})`
      return name === null ? `You come upon ${met}.` : `${name}: came upon ${met}.`
    }
    case 'order_done':
      return name === null ? 'The party has done what it was set to.' : `${name}: has done what it was set to.`
    case 'met': {
      const other = partyById(game, event.other)?.name
      return name === null || !other ? 'The parties meet.' : `${name}: met ${other}.`
    }
  }
}

/** What stopped the days, in words, without the party's name; a party that arrived among monsters is told only of coming upon them. */
function describeInterrupt(interrupt: Interrupt, partyEvents: readonly PartyEvent[], game: GameState): string {
  const { event } = interrupt
  if (!isPartyEvent(event)) return describeWorldEvent(event)
  const confronting = partyEvents.find((e) => e.type === 'confronting' && e.party === event.party)
  // The party's words, without the name they lead with: `spoken` puts it back with the days.
  const told = describePartyEvent(confronting ?? event, game)
  const name = speaker(game, event.party)
  return name !== null && told.startsWith(`${name}: `) ? told.slice(name.length + 2) : told
}

/**
 * What the message line says of days passed (Next day, Until something
 * happens): the interrupt that stopped them, led by the name of the party it
 * concerns where there are several, else the last event that matters and,
 * once `limit` days passed with nothing happening, that they passed quietly.
 */
export function describeDays(reports: readonly DayReport[], game: GameState, limit: number): string {
  const last = reports.at(-1)
  const healed = reports.reduce((sum, report) => sum + report.parties.reduce((s, day) => s + day.rested + day.cast, 0), 0)
  const rest = healed > 0 ? ` Rest heals ${healed} hp.` : ''
  if (last?.interrupt) {
    return `${spoken(game, last.interrupt.party, describeInterrupt(last.interrupt, last.partyEvents, game), reports.length)}${rest}`
  }
  if (reports.length >= limit && limit > 1) return `${limit} days passed quietly.${rest}`
  const told = describeWorldEvents(reports.flatMap((report) => report.events))
  return told ? `${told}${rest}` : `A quiet day.${rest}`
}

/**
 * What the message line says after the selected party's walk (a click on the
 * map, Home or a meet) and the days it took: an interrupt of another party's
 * as `describeDays` tells it; else a journey cut short by what stopped it,
 * monsters come upon, a meeting, or the last event that matters; led by the
 * party's name where there are several.
 */
export function describeWalk(game: GameState, party: Expedition, reports: readonly DayReport[]): string {
  const last = reports.at(-1)
  const interrupt = last?.interrupt ?? null
  if (interrupt && interrupt.party !== null && interrupt.party !== party.id) return describeDays(reports, game, Infinity)
  const stoppedBy = last ? worldInterrupt(last) : null
  if (stoppedBy) return spoken(game, interrupt?.party ?? null, `Your journey stops. ${describeWorldEvent(stoppedBy)}`)
  const here = monstersHere(game.world, party)
  if (here) return describePartyEvent({ type: 'confronting', party: party.id, location: here.id }, game)
  if (interrupt && isPartyEvent(interrupt.event) && interrupt.event.type !== 'arrived') return describePartyEvent(interrupt.event, game)
  return describeWorldEvents(reports.flatMap((report) => report.events))
}

/**
 * What else the days the selected party spent on its own one-day action or
 * camp (Scout, Wait, Camp, a building) brought, to follow that action's own
 * words: a notable world event that stopped them, else the first event of
 * another party's (arrived, came upon monsters, met, its order done, a walk
 * stopped short), each as `describeDays` tells it, led by the party's name
 * where there are several; else the days' world events that matter. `party`
 * is the party the map should select and centre, as for an interrupt, or null.
 */
export function describeOthers(game: GameState, party: Expedition, reports: readonly DayReport[]): { text: string; party: string | null } {
  const last = reports.at(-1)
  const interrupt = last?.interrupt ?? null
  if (last && interrupt && !isPartyEvent(interrupt.event)) {
    return { text: spoken(game, interrupt.party, describeInterrupt(interrupt, last.partyEvents, game)), party: interrupt.party }
  }
  const theirs = last?.partyEvents.find((event) => event.party !== party.id)
  if (last && theirs) {
    return { text: spoken(game, theirs.party, describeInterrupt({ party: theirs.party, event: theirs }, last.partyEvents, game)), party: theirs.party }
  }
  return { text: describeWorldEvents(reports.flatMap((report) => report.events)), party: null }
}

/** The map's opening words for a party standing before monsters: "You stand before …" with one party, else led by the party's name. */
export function describeStanding(game: GameState, party: Expedition, here: MonsterLocation): string {
  const met = `${theName(here.name)} (threat ${here.threat})`
  return speaker(game, party.id) === null ? `You stand before ${met}.` : `${party.name} stands before ${met}.`
}
