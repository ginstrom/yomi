import { hexDistance, hexEquals, type Hex } from '../grid/hex.ts'
import type { Character } from '../character/character.ts'
import type { Item } from '../inventory/inventory.ts'
import type { WorldEvent } from './blight.ts'
import { canBuildOutpost, canBuildTower, outpostSite, raiseOutpost, raiseTower } from './buildings.ts'
import { canCamp, partyWounded, rest } from './camp.ts'
import { applyCraft, craftRefusal, craftTier } from './crafting.ts'
import { MAX_PARTIES, PARTY_NAMES, newExpedition, partyId, presences, type DayAction, type Expedition, type Order, type PartyPresence } from './expedition.ts'
import { partyById, type GameState } from './gameState.ts'
import { MAX_RESERVES, homeParties, noPartyHome, maxParties, partyLimit, rested } from './guildHall.ts'
import { autoHeal, buryAll } from './party.ts'
import { applyEmbed, embedRefusal } from './runecraft.ts'
import { NOTICE_RADIUS, encampment, encampmentName, isNotable, locationAt, monstersHere, passTurn, routeTo, theName, worldActive, type MonsterLocation, type WorldState } from './worldMap.ts'

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
 * `startTravel`. Below the clock: the guild hall's company (forming,
 * renaming, disbanding, moving heroes), two parties' exchange in the field and
 * a party wiped out in battle.
 *
 * This module and the ones whose day-passing functions call it (worldMap.ts,
 * camp.ts, buildings.ts, crafting.ts, runecraft.ts) import one another, which
 * is safe while none calls another as its module loads. This module calls
 * only their time-free parts and refusals, never their conveniences.
 */

/** What happened to a party's order in a day. */
export type PartyEvent =
  | { type: 'arrived'; party: string; at: Hex } // a travel or home order reached `to`
  | { type: 'confronting'; party: string; location: string } // it stepped onto monsters
  | { type: 'order_done'; party: string } // a camp order healed everyone or could camp no more, a day action ended, a road was blocked, it stopped short of another party's monsters, the party it went to meet is gone
  | { type: 'met'; party: string; other: string } // a meet order (`party`'s) reached the party it went to meet (`other`)

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
export type OrderRequest =
  | { kind: 'idle' }
  | { kind: 'travel'; to: Hex }
  | { kind: 'home' }
  | { kind: 'camp' }
  | { kind: 'garrison' }
  | { kind: 'meet'; party: string }

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
  met: true,
}

export const isPartyEvent = (event: WorldEvent | PartyEvent): event is PartyEvent => event.type in PARTY_EVENT_TYPES

/** How a refusal or a message names a party: 'The party' while the company has one, else its name. */
export function partyNoun(game: GameState, party: Expedition): string {
  return game.parties.length === 1 ? 'The party' : party.name
}

/** Whether a day order lets a party confronting monsters pass the day: scouting or waiting does. */
function answersMonsters(order: Order): boolean {
  return order.kind === 'day' && (order.action.kind === 'scout' || order.action.kind === 'wait')
}

/** The first party, in list order, whose unanswered monsters stop the day with each party's order as `orderOf` gives it. */
function firstBlocking(game: GameState, orderOf: (party: Expedition) => Order): Expedition | null {
  return game.parties.find((party) => party.confronting !== null && !answersMonsters(orderOf(party))) ?? null
}

/** Why no day can pass with each party's order as `orderOf` gives it, or null when one can. */
function dayRefusal(game: GameState, orderOf: (party: Expedition) => Order): string | null {
  const { world } = game
  if (!worldActive(world)) return 'The game is over.'
  const party = firstBlocking(game, orderOf)
  if (!party) return null
  const name = world.locations.find((l) => l.id === party.confronting)?.name ?? 'monsters'
  return `${partyNoun(game, party)} stands before ${theName(name)}: scout, wait or attack.`
}

/** The first party whose confrontation makes `advanceRefusal` refuse, or null: the one the map should show. */
export function blockingParty(game: GameState): Expedition | null {
  return firstBlocking(game, (party) => party.order)
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
    case 'home': {
      if (!worldActive(world)) return 'The game is over.'
      if (party.confronting !== null) return `${partyNoun(game, party)} must first answer the monsters it faces.`
      const to = encampment(world).position
      if (hexEquals(party.position, to)) return `${partyNoun(game, party)} is already home.`
      const route = routeTo(world, party, to)
      if (!route) return 'There is no way home.'
      party.order = { kind: 'home', to, route }
      return null
    }
    case 'camp':
      if (!canCamp(world, party)) return `${partyNoun(game, party)} cannot camp here.`
      party.order = { kind: 'camp' }
      return null
    case 'garrison':
      if (!worldActive(world)) return 'The game is over.'
      if (party.confronting !== null) return `${partyNoun(game, party)} must first answer the monsters it faces.`
      if (!outpostSite(world, party)) return 'Only a held resource can be garrisoned.'
      party.order = { kind: 'garrison' }
      return null
    case 'meet': {
      if (!worldActive(world)) return 'The game is over.'
      if (request.party === party.id) return `${partyNoun(game, party)} cannot meet itself.`
      const other = partyById(game, request.party)
      if (!other) return `No party "${request.party}".`
      if (party.confronting !== null) return `${partyNoun(game, party)} must first answer the monsters it faces.`
      if (hexEquals(party.position, other.position)) return `${partyNoun(game, party)} and ${other.name} are already together.`
      if (!routeTo(world, party, other.position)) return `There is no way to ${other.name}.`
      party.order = { kind: 'meet', party: other.id }
      return null
    }
  }
}

/** A travel or home order: a walk along a route planned when it was given. */
type Walk = Extract<Order, { kind: 'travel' | 'home' }>

/** Whether a walk's next hex, short of its destination, holds monsters: a nest come onto the road since it was planned. */
export function roadBlocked(world: WorldState, order: Walk): boolean {
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
  /** Its walk ended this day: a travel or home order stopped short of monsters another party stands on, or a meet found no way to the other party (told after the world's day, as `order_done`). */
  stoppedShort: boolean
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

/** Whether `at` is a monster location on which a party other than `party` stands. */
function othersMonsters(game: GameState, party: Expedition, at: Hex): boolean {
  return locationAt(game.world, at)?.kind === 'monsters' && game.parties.some((p) => p !== party && hexEquals(p.position, at))
}

/** A party's day by its order, before the world's day. It changes only that party, and what its own action spends and builds. */
function partyDay(game: GameState, party: Expedition): PartyDayDone {
  const { world } = game
  const done: PartyDayDone = { day: { party: party.id, walked: null, rested: 0, cast: 0, made: null }, built: null, stoppedShort: false }
  const order = party.order
  switch (order.kind) {
    case 'idle':
    case 'garrison':
      break
    case 'travel':
    case 'home': {
      const [hex, ...remaining] = order.route
      if (hex === undefined) break
      if (othersMonsters(game, party, hex)) {
        // The earlier party in the list has the monsters; this one waits a hex short (stage 6, design §4.4).
        party.order = IDLE
        done.stoppedShort = true
        break
      }
      party.position = hex
      party.order = { ...order, route: remaining }
      done.day.walked = hex
      break
    }
    case 'meet': {
      const other = partyById(game, order.party)
      if (!other || hexEquals(party.position, other.position)) break
      const route = routeTo(world, party, other.position)
      if (!route) {
        // No way left to the other party: the meet ends, as a blocked road ends a walk.
        party.order = IDLE
        done.stoppedShort = true
        break
      }
      const [hex] = route
      if (hex === undefined) break
      party.position = hex
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

/** A party's order checked against what the day brought: whether it arrived, met, was blocked or is done. */
function afterDay(game: GameState, party: Expedition, done: PartyDayDone): PartyEvent[] {
  const { world } = game
  if (done.stoppedShort) return [{ type: 'order_done', party: party.id }]
  const order = party.order
  switch (order.kind) {
    case 'idle':
    case 'garrison':
      return []
    case 'travel':
    case 'home': {
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
    case 'meet': {
      const other = partyById(game, order.party)
      if (!other) {
        party.order = IDLE
        return [{ type: 'order_done', party: party.id }]
      }
      const here = monstersHere(world, party)
      if (!hexEquals(party.position, other.position)) {
        if (!here) return []
        // It stepped onto the monsters the other party stood on as that party walked away: they are its to answer now.
        party.confronting = here.id
        party.order = IDLE
        return [{ type: 'confronting', party: party.id, location: here.id }]
      }
      const events: PartyEvent[] = [{ type: 'met', party: party.id, other: other.id }]
      if (here) {
        party.confronting = here.id
        events.push({ type: 'confronting', party: party.id, location: here.id })
      }
      party.order = IDLE
      return events
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
  const partyEvents = game.parties.flatMap((party, i) => afterDay(game, party, done[i]))
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

// The guild hall's company: forming, renaming and disbanding parties and moving
// heroes between them and the reserves. Each needs the parties it touches at
// home, checks everything first and changes nothing when it refuses.

/** A hero of a party, or of the reserves, by its place in the list. */
export type HeroRef = { from: 'party'; party: string; index: number } | { from: 'reserves'; index: number }

const MAX_NAME_LENGTH = 16

/** The default name of the next party formed: the one for the lowest free number. */
export function defaultPartyName(game: GameState): string {
  return PARTY_NAMES[lowestFreeNumber(game) - 1]
}

function lowestFreeNumber(game: GameState): number {
  for (let n = 1; n <= MAX_PARTIES; n++) if (!game.parties.some((p) => p.id === partyId(n))) return n
  return MAX_PARTIES + 1
}

/** Why `name` cannot name a party (other than `except`), or null when it can. */
function nameRefusal(game: GameState, name: string, except?: string): string | null {
  const trimmed = name.trim()
  if (trimmed.length === 0) return 'A party needs a name.'
  if (trimmed.length > MAX_NAME_LENGTH) return `A party's name is at most ${MAX_NAME_LENGTH} letters.`
  if (game.parties.some((p) => p.id !== except && p.name.toLowerCase() === trimmed.toLowerCase())) return `${trimmed} is already a party's name.`
  return null
}

interface Located {
  hero: Character
  /** The list it stands in, and so the party it leaves (null for the reserves). */
  list: Character[]
  party: Expedition | null
}

/** Where `ref` stands, or why it cannot be reached: a party must be at home, the reserves always are. */
function locate(game: GameState, ref: HeroRef): string | Located {
  let list: Character[]
  let party: Expedition | null = null
  if (ref.from === 'reserves') list = game.reserves
  else {
    party = partyById(game, ref.party) ?? null
    if (!party) return `No party "${ref.party}".`
    if (!homeParties(game).includes(party)) return `${partyNoun(game, party)} is not at ${encampmentName(game.world)}.`
    list = party.members
  }
  const hero = list[ref.index]
  if (!hero) return 'There is no such hero.'
  return { hero, list, party }
}

/** Why a hero cannot leave its party: the party is never left empty. */
const leavingRefusal = (game: GameState, from: Located): string | null =>
  from.party && from.party.members.length <= 1 ? `${partyNoun(game, from.party)} cannot be left empty.` : null

/**
 * Forms a party named `name` from `hero`, standing at the encampment, idle,
 * with no baggage, under the lowest free id. Returns it, or why not.
 */
export function formParty(game: GameState, name: string, hero: HeroRef): string | Expedition {
  if (homeParties(game).length === 0) return noPartyHome(game)
  const { world } = game
  if (game.parties.length >= maxParties(world)) return `The guild hall's level ${world.guildHall} allows ${maxParties(world)} ${maxParties(world) === 1 ? 'party' : 'parties'}.`
  const from = locate(game, hero)
  if (typeof from === 'string') return from
  const refusal = leavingRefusal(game, from) ?? nameRefusal(game, name)
  if (refusal) return refusal
  const [member] = from.list.splice(hero.index, 1)
  const party = newExpedition([from.party ? member : rested(member)], { ...encampment(world).position }, partyId(lowestFreeNumber(game)), name.trim())
  game.parties.push(party)
  return party
}

/** Renames party `id`; allowed wherever the party is, as a name is not a hall action. */
export function renameParty(game: GameState, id: string, name: string): string | null {
  const party = partyById(game, id)
  if (!party) return `No party "${id}".`
  const refusal = nameRefusal(game, name, id)
  if (refusal) return refusal
  party.name = name.trim()
  return null
}

/** Disbands party `id`: its members go to the reserves, its baggage to the first other party at home. Never the last party. */
export function disband(game: GameState, id: string): string | null {
  const party = partyById(game, id)
  if (!party) return `No party "${id}".`
  const home = homeParties(game)
  if (!home.includes(party)) return `${partyNoun(game, party)} is not at ${encampmentName(game.world)}.`
  if (game.parties.length <= 1) return 'The last party cannot be disbanded.'
  const heir = home.find((p) => p !== party)
  if (!heir) return 'Its baggage needs another party at home to take it.'
  if (game.reserves.length + party.members.length > MAX_RESERVES) return `The guild hall keeps no more than ${MAX_RESERVES} heroes in reserve.`
  game.reserves.push(...party.members)
  heir.baggage.push(...party.baggage)
  game.parties.splice(game.parties.indexOf(party), 1)
  return null
}

/** Moves `hero` to the end of party `to.party`, or to the reserves. Both ends must be at home. */
export function moveHero(game: GameState, hero: HeroRef, to: { party: string } | 'reserves'): string | null {
  const from = locate(game, hero)
  if (typeof from === 'string') return from
  let target: Expedition | null = null
  if (to !== 'reserves') {
    target = partyById(game, to.party) ?? null
    if (!target) return `No party "${to.party}".`
    if (!homeParties(game).includes(target)) return `${partyNoun(game, target)} is not at ${encampmentName(game.world)}.`
  }
  if (from.party === target) return 'The hero is already there.'
  const refusal = leavingRefusal(game, from)
  if (refusal) return refusal
  if (target) {
    if (target.members.length >= partyLimit(game.world)) return `${partyNoun(game, target)} is full: the guild hall's level ${game.world.guildHall} allows ${partyLimit(game.world)}.`
  } else if (game.reserves.length >= MAX_RESERVES) return `The guild hall keeps no more than ${MAX_RESERVES} heroes in reserve.`
  const [member] = from.list.splice(hero.index, 1)
  if (target) target.members.push(from.party ? member : rested(member))
  else game.reserves.push(member)
  return null
}

// Two parties in the field: an exchange of heroes and baggage on a shared hex.

/** One change an exchange makes between parties A and B. */
export type ExchangeMove =
  | { kind: 'member'; from: string; index: number } // member `index` of party `from` joins the other party, at its end
  | { kind: 'swap'; a: number; b: number } // member a of party A and member b of party B trade places
  | { kind: 'item'; from: string; index: number } // baggage item `index` of party `from` goes to the other's baggage

/** The two lists an exchange changes for one party. */
interface Side {
  members: Character[]
  baggage: Item[]
}

/** Applies `move` to the two sides, or returns why it cannot be made as they stand. */
function exchangeMove(game: GameState, parties: [Expedition, Expedition], sides: [Side, Side], move: ExchangeMove): string | null {
  if (move.kind === 'swap') {
    const [a, b] = sides
    if (!a.members[move.a] || !b.members[move.b]) return 'There is no such hero.'
    ;[a.members[move.a], b.members[move.b]] = [b.members[move.b], a.members[move.a]]
    return null
  }
  const i = parties.findIndex((party) => party.id === move.from)
  if (i < 0) return `Party "${move.from}" is not in this exchange.`
  const [from, to] = [sides[i], sides[1 - i]]
  if (move.kind === 'item') {
    if (!from.baggage[move.index]) return 'There is no such item.'
    to.baggage.push(...from.baggage.splice(move.index, 1))
    return null
  }
  if (!from.members[move.index]) return 'There is no such hero.'
  if (from.members.length <= 1) return `${partyNoun(game, parties[i])} cannot be left empty.`
  const limit = partyLimit(game.world)
  if (to.members.length >= limit) return `${partyNoun(game, parties[1 - i])} is full: the guild hall's level ${game.world.guildHall} allows ${limit}.`
  to.members.push(...from.members.splice(move.index, 1))
  return null
}

/**
 * Exchanges heroes and baggage between parties `a` and `b`, standing on one
 * hex, by `moves` in order, each move's indices read as the earlier moves left
 * the lists. A hero keeps what it wears and carries and its wounds. Refused,
 * changing nothing, on different hexes, while either faces monsters the other
 * does not, or where any move cannot be made (no such hero or item, a party
 * left empty, one over the party limit). No move names a reserve: a reserve
 * joins or leaves a party only at the guild hall (`moveHero`).
 */
export function exchange(game: GameState, a: string, b: string, moves: readonly ExchangeMove[]): string | null {
  const first = partyById(game, a)
  if (!first) return `No party "${a}".`
  const second = partyById(game, b)
  if (!second) return `No party "${b}".`
  if (first === second) return `${partyNoun(game, first)} cannot exchange with itself.`
  if (!hexEquals(first.position, second.position)) return `${partyNoun(game, first)} and ${partyNoun(game, second)} are not on the same hex.`
  if (first.confronting !== second.confronting) {
    const facing = first.confronting !== null ? first : second
    return `${partyNoun(game, facing)} must first answer the monsters it faces.`
  }
  const parties: [Expedition, Expedition] = [first, second]
  const sides = parties.map((party) => ({ members: [...party.members], baggage: [...party.baggage] })) as [Side, Side]
  for (const move of moves) {
    const refusal = exchangeMove(game, parties, sides, move)
    if (refusal) return refusal
  }
  for (const [i, party] of parties.entries()) {
    party.members.splice(0, party.members.length, ...sides[i].members)
    party.baggage.splice(0, party.baggage.length, ...sides[i].baggage)
  }
  return null
}

// A party wiped out in battle.

/** What a wipe did: the dead, what they left, whether the game is lost, and the party the reserves formed, if any. */
export interface Wipe {
  /** The party's members, in battle order: dead, their gear gone to `left`. */
  dead: Character[]
  /** Everything they wore and carried and the party's baggage: the location's loot now, or lost in a fight with no location. */
  left: Item[]
  /** No hero is left in any party or the reserves. */
  lost: boolean
  /** The party the reserves formed at the encampment, when the last party fell with reserves left; else null. */
  reformed: Expedition | null
}

/** Every hero the company has: each party's members and the reserves. */
export function heroesLeft(game: GameState): number {
  return game.parties.reduce((sum, party) => sum + party.members.length, 0) + game.reserves.length
}

/**
 * Party `id`, beaten in battle at `location` (null for a fight with no
 * location), is gone: its members are dead, what they wore and carried goes
 * with its baggage onto the location's loot (lost with no location), and it
 * leaves the company. The location is otherwise untouched. If it was the last
 * party and reserves are left, they form a party at once at the encampment
 * (up to the party limit, rested, idle, with no baggage), so the company is
 * never without one while it has a hero. Changes no world status: whoever
 * called it ends the game when `lost`.
 */
export function wipeParty(game: GameState, id: string, location: MonsterLocation | null): Wipe {
  const party = partyById(game, id)
  if (!party) throw new Error(`No party "${id}".`)
  const left = party.baggage
  const dead = buryAll(party.members, left)
  party.baggage = []
  location?.loot.push(...left)
  game.parties.splice(game.parties.indexOf(party), 1)
  let reformed: Expedition | null = null
  if (game.parties.length === 0 && game.reserves.length > 0) {
    const members = game.reserves.splice(0, partyLimit(game.world)).map(rested)
    reformed = newExpedition(members, { ...encampment(game.world).position }, partyId(lowestFreeNumber(game)), defaultPartyName(game))
    game.parties.push(reformed)
  }
  return { dead, left, lost: heroesLeft(game) === 0, reformed }
}
