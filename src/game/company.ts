import { hexDistance, hexEquals, type Hex } from '../grid/hex.ts'
import type { Item } from '../inventory/inventory.ts'
import type { WorldEvent } from './blight.ts'
import { canBuildOutpost, canBuildTower, raiseOutpost, raiseTower } from './buildings.ts'
import { canCamp, partyWounded, rest } from './camp.ts'
import { applyCraft, craftRefusal, craftTier } from './crafting.ts'
import { presences, type DayAction, type Expedition, type Order, type PartyPresence } from './expedition.ts'
import { partyById, type GameState } from './gameState.ts'
import { autoHeal } from './party.ts'
import { applyEmbed, embedRefusal } from './runecraft.ts'
import { NOTICE_RADIUS, isNotable, locationAt, monstersHere, passTurn, routeTo, theName, worldActive, type WorldState } from './worldMap.ts'

/**
 * The company's one clock. Every day passes through `passDay`: each party
 * carries out a day of its standing order, in list order, then the world's
 * day passes once (`passTurn`) and each party's order is checked against what
 * the day brought. `advance` runs days until something happens. A journey
 * (`travel`) and camping until healed (`campUntilHealed`) are orders run this
 * way; an order outlasts an interrupt, so the next day carries it on. A
 * one-day action (scouting, waiting, a day's camp, a building, a field craft
 * or embed) is a day order, given (`orderAction`) for the next day to run, or
 * given and run at once (`act`); it ends idle. A journey starts with
 * `startTravel`.
 *
 * This module and the ones whose day-passing functions call it (worldMap.ts,
 * camp.ts, buildings.ts, crafting.ts, runecraft.ts) import one another, which
 * is safe while none calls another as its module loads. This module calls
 * only their time-free parts and refusals, never their conveniences.
 */

/** What happened to a party's order in a day. */
export type PartyEvent =
  | { type: 'arrived'; party: string; at: Hex } // a travel order reached `to`
  | { type: 'confronting'; party: string; location: string } // it stepped onto monsters
  | { type: 'order_done'; party: string } // a camp order healed everyone or could camp no more, a day action ended, a road was blocked

/** What stops `advance`, and the party it concerns, if any. */
export interface Interrupt {
  /** The party it concerns: a party event's; for `sighted`, the nearest party within NOTICE_RADIUS (or nearest, for the Source), first in list order on a tie; else null. */
  party: string | null
  event: WorldEvent | PartyEvent
}

/** What a day did for one party. */
export interface PartyDay {
  party: string
  /** The hex it stepped onto today, or null. */
  walked: Hex | null
  /** Hit points restored by rest today. */
  rested: number
  /** Hit points restored by its heals today (the camp order's autoHeal). */
  cast: number
  /** The item a day's craft or embed made, else null. */
  made: Item | null
}

/** What a day brought. */
export interface DayReport {
  /** The parties' own events (tower_built, outpost_built), in party order, then the world day's (passTurn's), in that order. */
  events: WorldEvent[]
  partyEvents: PartyEvent[]
  parties: PartyDay[]
  /** The first notable world event (isNotable over the presences, in `events` order), else the first party event; null if neither. */
  interrupt: Interrupt | null
}

/** An order as it is given; a travel order's route is planned from it. */
export type OrderRequest = { kind: 'idle' } | { kind: 'travel'; to: Hex } | { kind: 'camp' }

/** The days `advance` passes at most when nothing happens. */
export const UNTIL_LIMIT = 30

const IDLE: Order = { kind: 'idle' }

/**
 * The kinds of party event, each `true`. Keyed also by any kind a world event
 * shares with a party event, as `never`, so that a clash fails to compile and
 * the kind alone tells the two apart (`worldInterrupt`).
 */
const PARTY_EVENT_TYPES: Record<PartyEvent['type'], true> & Record<Extract<WorldEvent['type'], PartyEvent['type']>, never> = {
  arrived: true,
  confronting: true,
  order_done: true,
}

export const isPartyEvent = (event: WorldEvent | PartyEvent): event is PartyEvent => event.type in PARTY_EVENT_TYPES

const partyNoun = (game: GameState, party: Expedition): string => (game.parties.length === 1 ? 'The party' : party.name)

/** Whether a day order lets a party confronting monsters pass the day: scouting or waiting does. */
function answersMonsters(order: Order): boolean {
  return order.kind === 'day' && (order.action.kind === 'scout' || order.action.kind === 'wait')
}

/** Why no day can pass with each party's order as `orderOf` gives it, or null when one can. */
function dayRefusal(game: GameState, orderOf: (party: Expedition) => Order): string | null {
  const { world } = game
  if (!worldActive(world)) return 'The game is over.'
  for (const party of game.parties) {
    if (party.confronting === null || answersMonsters(orderOf(party))) continue
    const name = world.locations.find((l) => l.id === party.confronting)?.name ?? 'monsters'
    return `${partyNoun(game, party)} stands before ${theName(name)}: scout, wait or attack.`
  }
  return null
}

/** Why no day can pass now, or null when one can. */
export function advanceRefusal(game: GameState): string | null {
  return dayRefusal(game, (party) => party.order)
}

/** Gives party `id` an order, replacing the one it had. Returns the refusal, or null. */
export function setOrder(game: GameState, id: string, request: OrderRequest): string | null {
  const party = partyById(game, id)
  if (!party) return `No party "${id}".`
  const { world } = game
  switch (request.kind) {
    case 'idle':
      party.order = IDLE
      return null
    case 'travel': {
      if (!worldActive(world)) return 'The game is over.'
      if (party.confronting !== null) return `${partyNoun(game, party)} must first answer the monsters it faces.`
      const route = routeTo(world, party, request.to)
      if (!route) return 'There is no way there.'
      party.order = { kind: 'travel', to: request.to, route }
      return null
    }
    case 'camp':
      if (!canCamp(world, party)) return `${partyNoun(game, party)} cannot camp here.`
      party.order = { kind: 'camp' }
      return null
  }
}

/** Whether a travel order's next hex, short of its destination, holds monsters: a nest come onto the road since it was planned. */
export function roadBlocked(world: WorldState, order: Extract<Order, { kind: 'travel' }>): boolean {
  const next = order.route[0]
  return next !== undefined && !hexEquals(next, order.to) && locationAt(world, next)?.kind === 'monsters'
}

/** How `startTravel` went: refused (nothing changed), blocked at its first hex, or started. */
export type TravelStart = 'started' | 'blocked' | 'refused'

/**
 * Starts party `party`'s travel order to `to`, passing no day: 'refused'
 * where `setOrder` says no (nothing changed); 'blocked' where a nest stands on
 * the route's first hex short of `to` (the loop checks the road only after a
 * day), leaving the party idle and confronting whatever stands where it is;
 * else 'started', the order standing for the loop to walk.
 */
export function startTravel(game: GameState, party: Expedition, to: Hex): TravelStart {
  if (setOrder(game, party.id, { kind: 'travel', to }) !== null) return 'refused'
  if (party.order.kind === 'travel' && roadBlocked(game.world, party.order)) {
    party.order = IDLE
    party.confronting = monstersHere(game.world, party)?.id ?? null
    return 'blocked'
  }
  return 'started'
}

/** Why `party` cannot take the one-day action now, or null when it can; the game's own refusal to pass a day aside. */
function actionRefusal(game: GameState, party: Expedition, action: DayAction): string | null {
  const { world } = game
  switch (action.kind) {
    case 'scout':
    case 'wait':
      if (!worldActive(world)) return 'The game is over.'
      return monstersHere(world, party) ? null : 'There are no monsters here to scout or wait at.'
    case 'camp':
      return canCamp(world, party) ? null : `${partyNoun(game, party)} cannot camp here.`
    case 'tower':
      return canBuildTower(world, party)
    case 'outpost':
      return canBuildOutpost(world, party)
    case 'craft':
    case 'embed': {
      if (action.place.party !== party.id) return `That item is not ${partyNoun(game, party)}'s.`
      if (craftTier(world, party) !== 'field') return 'At the workshop that is done at once, not as a day’s work.'
      return action.kind === 'craft'
        ? craftRefusal(game, action.place, action.modifier, action.grade)
        : embedRefusal(game, action.place, action.rune)
    }
  }
}

/** What a party's day did, and the event of anything it built (which comes before the world's day). */
interface PartyDayDone {
  day: PartyDay
  built: WorldEvent | null
}

/** A day order's action, run with no time passing, if it can still be taken. */
function runAction(game: GameState, party: Expedition, action: DayAction, done: PartyDayDone): void {
  // Checked again at run time, as the order may have been given on an earlier day: a refused action does nothing, but the day still passes.
  if (actionRefusal(game, party, action) !== null) return
  const { world } = game
  switch (action.kind) {
    case 'scout':
    case 'wait':
      party.confronting = null
      break
    case 'camp':
      done.day.rested = rest(world, party)
      break
    case 'tower':
      done.built = raiseTower(world, party)
      break
    case 'outpost':
      done.built = raiseOutpost(world, party)
      break
    case 'craft':
      done.day.made = applyCraft(game, action.place, action.modifier, action.grade)
      break
    case 'embed':
      done.day.made = applyEmbed(game, action.place, action.rune)
      break
  }
}

/** A party's day by its order, before the world's day. It changes only that party, and what its own action spends and builds. */
function partyDay(game: GameState, party: Expedition): PartyDayDone {
  const { world } = game
  const done: PartyDayDone = { day: { party: party.id, walked: null, rested: 0, cast: 0, made: null }, built: null }
  const order = party.order
  switch (order.kind) {
    case 'idle':
      break
    case 'travel': {
      const [hex, ...remaining] = order.route
      if (hex === undefined) break
      party.position = hex
      party.order = { ...order, route: remaining }
      done.day.walked = hex
      break
    }
    case 'camp':
      if (!canCamp(world, party)) break
      done.day.rested = rest(world, party)
      done.day.cast = autoHeal(party.members)
      break
    case 'day':
      // The order stays until after the world's day, which ends it (afterDay).
      runAction(game, party, order.action, done)
      break
  }
  return done
}

/** A party's order checked against what the day brought: whether it arrived, was blocked or is done. */
function afterDay(world: WorldState, party: Expedition): PartyEvent[] {
  const order = party.order
  switch (order.kind) {
    case 'idle':
      return []
    case 'travel': {
      if (hexEquals(party.position, order.to)) {
        const events: PartyEvent[] = [{ type: 'arrived', party: party.id, at: order.to }]
        const here = monstersHere(world, party)
        if (here) {
          party.confronting = here.id
          events.push({ type: 'confronting', party: party.id, location: here.id })
        }
        party.order = IDLE
        return events
      }
      if (roadBlocked(world, order)) {
        party.order = IDLE
        return [{ type: 'order_done', party: party.id }]
      }
      return []
    }
    case 'camp':
      if (partyWounded(party.members) && canCamp(world, party)) return []
      party.order = IDLE
      return [{ type: 'order_done', party: party.id }]
    case 'day':
      party.order = IDLE
      return [{ type: 'order_done', party: party.id }]
  }
}

/** The party a sighting concerns: the nearest within NOTICE_RADIUS (any distance for the Source), the first on a tie. */
function sightingParty(parties: readonly Expedition[], present: readonly PartyPresence[], at: Hex, source: boolean): string | null {
  let best: string | null = null
  let nearest = Infinity
  for (const [i, p] of present.entries()) {
    const d = hexDistance(p.position, at)
    if ((source || d <= NOTICE_RADIUS) && d < nearest) {
      nearest = d
      best = parties[i].id
    }
  }
  return best
}

function interruptOf(game: GameState, events: WorldEvent[], partyEvents: PartyEvent[], present: readonly PartyPresence[]): Interrupt | null {
  const notable = events.find((event) => isNotable(game.world, event, present))
  if (notable) {
    const party = notable.type === 'sighted' ? sightingParty(game.parties, present, notable.at, notable.source === true) : null
    return { party, event: notable }
  }
  const first = partyEvents[0]
  return first ? { party: first.party, event: first } : null
}

/** The interrupt's event when it is a world event (what a journey or a camp is "interrupted by"), else null. */
export function worldInterrupt(report: DayReport): WorldEvent | null {
  const event = report.interrupt?.event
  return event === undefined || isPartyEvent(event) ? null : event
}

/**
 * One day: each party's day by its order, in list order, then the world's day
 * once, then each party's order checked against it. Null, changing nothing,
 * when `advanceRefusal` says no day can pass.
 */
export function passDay(game: GameState): DayReport | null {
  if (advanceRefusal(game) !== null) return null
  const { world } = game
  const done = game.parties.map((party) => partyDay(game, party))
  // Measured after the day's moves and buildings; the world's day moves no party.
  const present = presences(game.parties)
  const events = done.flatMap(({ built }) => (built ? [built] : []))
  events.push(...passTurn(world, present))
  const partyEvents = game.parties.flatMap((party) => afterDay(world, party))
  return { events, partyEvents, parties: done.map(({ day }) => day), interrupt: interruptOf(game, events, partyEvents, present) }
}

/**
 * Gives party `id` the one-day action as its order, `{ kind: 'day', action }`,
 * for the next day to run, passing no day: refused, changing nothing (its
 * standing order included), where the action cannot be taken or no day could
 * pass with it (`advanceRefusal`, which a party's own scout or wait answers
 * when it confronts monsters). Workshop work takes no day, and so is refused.
 */
export function orderAction(game: GameState, id: string, action: DayAction): string | null {
  const party = partyById(game, id)
  if (!party) return `No party "${id}".`
  const order: Order = { kind: 'day', action }
  const refusal = actionRefusal(game, party, action) ?? dayRefusal(game, (p) => (p === party ? order : p.order))
  if (refusal) return refusal
  party.order = order
  return null
}

/**
 * Party `id`'s one-day action, given (`orderAction`) and run at once: one day
 * passes, after which the party is idle. Refused, changing nothing, as
 * `orderAction` is.
 */
export function act(game: GameState, id: string, action: DayAction): string | DayReport {
  return orderAction(game, id, action) ?? passDay(game)!
}

/** Days until a report has an interrupt, the game stops being active, `advanceRefusal` says no, or `limit` days pass. */
export function advance(game: GameState, limit: number = UNTIL_LIMIT): DayReport[] {
  const reports: DayReport[] = []
  while (reports.length < limit) {
    const report = passDay(game)
    if (!report) break
    reports.push(report)
    if (report.interrupt || !worldActive(game.world)) break
  }
  return reports
}
