import { maxHp, maxMana } from '../character/character.ts'
import { hexDistance, hexEquals, type Hex } from '../grid/hex.ts'
import type { Item } from '../inventory/inventory.ts'
import type { WorldEvent } from './blight.ts'
import { canCamp, partyWounded } from './camp.ts'
import { presences, type Expedition, type Order, type PartyPresence } from './expedition.ts'
import { partyById, type GameState } from './gameState.ts'
import { restHealing } from './infirmary.ts'
import { autoHeal } from './party.ts'
import { NOTICE_RADIUS, isNotable, locationAt, monstersHere, passTurn, routeTo, worldActive, type WorldState } from './worldMap.ts'

/**
 * The company's one clock. Every day passes through `passDay`: each party
 * carries out a day of its standing order, in list order, then the world's
 * day passes once (`passTurn`) and each party's order is checked against what
 * the day brought. `advance` runs days until something happens. A journey
 * (`travel`) and camping until healed (`campUntilHealed`) are orders run this
 * way; an order outlasts an interrupt, so the next day carries it on.
 *
 * This module and the ones whose day-passing functions call it (worldMap.ts,
 * camp.ts) import one another, which is safe while none calls another as its
 * module loads.
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

const partyNoun = (game: GameState, party: Expedition): string => (game.parties.length === 1 ? 'The party' : party.name)

/** Whether a day order lets a party confronting monsters pass the day: scouting or waiting does. */
function answersMonsters(order: Order): boolean {
  return order.kind === 'day' && (order.action.kind === 'scout' || order.action.kind === 'wait')
}

/** Why no day can pass now, or null when one can. */
export function advanceRefusal(game: GameState): string | null {
  const { world } = game
  if (!worldActive(world)) return 'The game is over.'
  for (const party of game.parties) {
    if (party.confronting === null || answersMonsters(party.order)) continue
    const name = world.locations.find((l) => l.id === party.confronting)?.name ?? 'monsters'
    return `${partyNoun(game, party)} stands before the ${name}: scout, wait or attack.`
  }
  return null
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

const totalHp = (party: Expedition) => party.members.reduce((sum, member) => sum + member.hp, 0)

/** A party's day by its order, before the world's day. It reads and changes only that party (and the world, read-only). */
function partyDay(world: WorldState, party: Expedition): PartyDay {
  const day: PartyDay = { party: party.id, walked: null, rested: 0, cast: 0, made: null }
  const order = party.order
  switch (order.kind) {
    case 'idle':
      break
    case 'travel': {
      const [hex, ...rest] = order.route
      if (hex === undefined) break
      party.position = hex
      party.order = { ...order, route: rest }
      day.walked = hex
      break
    }
    case 'camp': {
      if (!canCamp(world, party)) break
      // restHealing reads where the party stands and the infirmary, never hit
      // points, and the world's day reads no hit points or mana, so resting
      // before the day comes to what resting after it would.
      const before = totalHp(party)
      const healing = party.members.map((member) => restHealing(world, party, member))
      for (const [i, member] of party.members.entries()) {
        member.hp = Math.min(maxHp(member), member.hp + healing[i])
        member.mana = maxMana(member)
      }
      day.rested = totalHp(party) - before
      day.cast = autoHeal(party.members)
      break
    }
    case 'day':
      // Step 07 runs the action here.
      break
  }
  return day
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
  return event !== undefined && (report.events as readonly unknown[]).includes(event) ? (event as WorldEvent) : null
}

/**
 * One day: each party's day by its order, in list order, then the world's day
 * once, then each party's order checked against it. Null, changing nothing,
 * when `advanceRefusal` says no day can pass.
 */
export function passDay(game: GameState): DayReport | null {
  if (advanceRefusal(game) !== null) return null
  const { world } = game
  const parties = game.parties.map((party) => partyDay(world, party))
  // Measured after the day's moves; the world's day moves no party.
  const present = presences(game.parties)
  const events = passTurn(world, present)
  const partyEvents = game.parties.flatMap((party) => afterDay(world, party))
  return { events, partyEvents, parties, interrupt: interruptOf(game, events, partyEvents, present) }
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
