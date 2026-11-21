import { HexBoard, hexDistance, hexEquals, hexKey, hexNeighbors, reachableHexes, type Hex } from '../grid/hex.ts'
import { MAX_BLIGHT, blightAt, type WorldEvent } from './blight.ts'
import { atEncampment, canAfford, describeCost, spend } from './buildings.ts'
import type { Expedition, PartyPresence } from './expedition.ts'
import type { GameState } from './gameState.ts'
import { LOSS_LEVEL, YIELD_DAYS, type Stock } from './territory.ts'
import { tradingPostName } from './tradingPost.ts'
import { encampment, encampmentName, type MonsterLocation, type PartnerLocation, type WorldState } from './worldMap.ts'

/**
 * Trade (docs/designs/long-campaign/stage-08-trade-routes.md): the trade
 * partners, neutral settlements on the map (`PartnerLocation`), and the
 * routes the trading post opens to them. A partner is
 * contacted by a party standing on its hex at the end of a day, for good; it
 * falls silent while its land is at `LOSS_LEVEL` or worse and wakes when the
 * land is clean. Every partner is a clean source of `PARTNER_STRENGTH`
 * (blight.ts), silent or not, and is never held, never yields and is never
 * lost. Phaser-free; `updateTerritory` calls `partnerDay` once a world turn
 * and `tradeDay` after it.
 *
 * A route (from trading post level 4, `ROUTE_SLOTS`) is a fixed road from the
 * encampment to a contacted partner (`roadTo`), paid for once (`routeCost`).
 * Every yield day it pays gold by its length and its security (`routeIncome`:
 * a hex is safe when clean or guarded by a watchtower or a party within
 * `GUARD_RADIUS`, half safe when tainted), and every second yield day its
 * partner's good, unless it is raided (`raidCause`: the partner silent, a road
 * hex corrupted, or a nest within `RAID_RADIUS`). Raided `ABANDON_AFTER` yield
 * days in a row, it is abandoned. Nothing here draws randomness.
 *
 * This module imports blight.ts, buildings.ts, territory.ts, tradingPost.ts
 * and worldMap.ts, and blight.ts and territory.ts import it back: safe while
 * nothing calls across as the modules load.
 */

/** An open trade route (stage 8 step 02): a fixed road from the encampment to a contacted partner. */
export interface TradeRoute {
  /** `route_<partner id>`. */
  id: string
  partner: string
  /** The road's hexes, the encampment's excluded and the partner's included; fixed when the route opened. */
  road: Hex[]
  /** The world turn it opened. */
  opened: number
  /** Raided yield days in a row. */
  raidedDays: number
}

/** The trade partners on the map, in locations order. */
export function partners(world: WorldState): PartnerLocation[] {
  return world.locations.filter((l): l is PartnerLocation => l.kind === 'partner')
}

export function partnerById(world: WorldState, id: string): PartnerLocation | null {
  return partners(world).find((p) => p.id === id) ?? null
}

export function isContacted(world: WorldState, id: string): boolean {
  return world.contacted.includes(id)
}

export function isSilent(world: WorldState, id: string): boolean {
  return world.silent.includes(id)
}

/** Contacts the partner: `partner_contacted`, or null when `id` is no partner or is contacted already. */
export function contactPartner(world: WorldState, id: string): WorldEvent | null {
  const partner = partnerById(world, id)
  if (!partner || isContacted(world, id)) return null
  world.contacted.push(id)
  return { type: 'partner_contacted', partner: id, name: partner.name, home: encampmentName(world) }
}

/**
 * The partners' day, after the territory's yields: first every partner with a
 * presence on its hex is contacted (in locations order), then each partner
 * whose hex has reached `LOSS_LEVEL` falls silent and each silent one whose
 * hex is clean wakes. Silence is kept for every partner, and told
 * (`partner_silent`, `partner_restored`) only for contacted ones.
 */
export function partnerDay(world: WorldState, presences: readonly PartyPresence[]): WorldEvent[] {
  const events: WorldEvent[] = []
  const all = partners(world)
  for (const partner of all) {
    if (!presences.some((p) => hexEquals(p.position, partner.position))) continue
    const contact = contactPartner(world, partner.id)
    if (contact) events.push(contact)
  }
  for (const partner of all) {
    const level = blightAt(world, partner.position)
    const told = isContacted(world, partner.id)
    if (!isSilent(world, partner.id) && level >= LOSS_LEVEL) {
      world.silent.push(partner.id)
      if (told) events.push({ type: 'partner_silent', partner: partner.id, name: partner.name })
    } else if (isSilent(world, partner.id) && level === 0) {
      world.silent = world.silent.filter((id) => id !== partner.id)
      if (told) events.push({ type: 'partner_restored', partner: partner.id, name: partner.name })
    }
  }
  return events
}

/** A route's gold a yield day before security: `ROUTE_BASE` + one for every `ROUTE_HEXES_PER_GOLD` hexes of road. */
export const ROUTE_BASE = 1
export const ROUTE_HEXES_PER_GOLD = 10
/** A route costs `ROUTE_COST_GOLD` + floor(length / `ROUTE_HEXES_PER_COST_GOLD`) gold and `ROUTE_TIMBER` timber. */
export const ROUTE_COST_GOLD = 20
export const ROUTE_HEXES_PER_COST_GOLD = 2
export const ROUTE_TIMBER = 10
/** Open routes allowed, by trading post level - 1. */
export const ROUTE_SLOTS: readonly number[] = [0, 0, 0, 1, 2, 4]
/** A watchtower or a party guards the tainted and blighted road hexes this near it. */
export const GUARD_RADIUS = 3
/** A monster location this near any hex of a road raids it. */
export const RAID_RADIUS = 2
/** Raided yield days in a row (30 days) before a route is abandoned. */
export const ABANDON_AFTER = 6

export type RaidCause = 'silent' | 'corrupted' | 'raiders'

/** How many routes the trading post keeps open at most. */
export function routeLimit(world: WorldState): number {
  return ROUTE_SLOTS[world.tradingPost - 1] ?? 0
}

/** The open route to the partner, or null. */
export function routeOf(world: WorldState, partnerId: string): TradeRoute | null {
  return world.routes.find((route) => route.partner === partnerId) ?? null
}

/**
 * The road a route to the partner would take, the encampment's hex excluded
 * and the partner's included, or null when `partnerId` is no partner or no
 * road reaches it. The road keeps more than `RAID_RADIUS` from every monster
 * location (sighted or not: the rules run on the true state) where it can;
 * where it cannot, it only keeps off every monster location and its
 * neighbours. The partner's own hex is always passable. Each search is
 * breadth-first, so the road is shortest and the same for the same world.
 */
export function roadTo(world: WorldState, partnerId: string): Hex[] | null {
  const partner = partnerById(world, partnerId)
  if (!partner) return null
  const board = new HexBoard(world.board)
  const nests = world.locations.filter((l) => l.kind === 'monsters').map((l) => l.position)
  const search = (blocked: ReadonlySet<string>) => {
    const passable = (h: Hex) => board.contains(h) && (hexEquals(h, partner.position) || !blocked.has(hexKey(h)))
    return reachableHexes(encampment(world).position, board.hexes.length, passable).get(hexKey(partner.position)) ?? null
  }
  const clear = new Set(board.hexes.filter((h) => nests.some((n) => hexDistance(h, n) <= RAID_RADIUS)).map(hexKey))
  const looser = new Set(nests.flatMap((n) => [n, ...hexNeighbors(n)]).map(hexKey))
  return search(clear) ?? search(looser)
}

/** What opening a route along a road of `length` hexes costs. */
export function routeCost(length: number): Stock {
  return { gold: ROUTE_COST_GOLD + Math.floor(length / ROUTE_HEXES_PER_COST_GOLD), timber: ROUTE_TIMBER }
}

/** Why the party cannot open a route to the partner now, or null when it can. Changes nothing. */
export function openRouteRefusal(game: GameState, party: Expedition, partnerId: string): string | null {
  const { world } = game
  if (!atEncampment(world, party)) return `Routes are opened at ${encampmentName(world)}.`
  const partner = partnerById(world, partnerId)
  if (!partner) return `No partner "${partnerId}".`
  if (!isContacted(world, partnerId)) return `${partner.name} has not been contacted: walk there first.`
  if (isSilent(world, partnerId)) return `${partner.name} is silent while the blight holds its land.`
  if (routeOf(world, partnerId)) return `A route to ${partner.name} is already open.`
  const limit = routeLimit(world)
  if (limit === 0) return `Routes need the ${tradingPostName(4)} (trading post level 4).`
  if (world.routes.length >= limit) return `The ${tradingPostName(world.tradingPost)} keeps ${limit} route${limit === 1 ? '' : 's'} open at most.`
  const road = roadTo(world, partnerId)
  if (!road) return `No safe road to ${partner.name}.`
  const cost = routeCost(road.length)
  if (!canAfford(world.stock, cost)) return `The route costs ${describeCost(cost)}, more than the stock holds.`
  return null
}

/**
 * Opens the route to the partner with no time passing: the stock pays its
 * cost and the route joins `world.routes` with today's road. Assumes
 * `openRouteRefusal` said null. Returns the `route_opened` event.
 */
export function openRoute(game: GameState, _party: Expedition, partnerId: string): WorldEvent {
  const { world } = game
  const partner = partnerById(world, partnerId)!
  const road = roadTo(world, partnerId)!
  spend(world.stock, routeCost(road.length))
  const route: TradeRoute = { id: `route_${partnerId}`, partner: partnerId, road, opened: world.turn, raidedDays: 0 }
  world.routes.push(route)
  world.routesOpened += 1
  return { type: 'route_opened', route: route.id, partner: partnerId, name: partner.name, length: road.length }
}

/** Whether the hex is tainted or blighted (level 1 or 2) and within `GUARD_RADIUS` of a standing watchtower or a party. */
export function guarded(world: WorldState, at: Hex, presences: readonly PartyPresence[]): boolean {
  const level = blightAt(world, at)
  if (level < 1 || level > 2) return false
  const guards = [...world.towers.map((t) => t.position), ...presences.map((p) => p.position)]
  return guards.some((g) => hexDistance(g, at) <= GUARD_RADIUS)
}

/** How safe a road hex is: 1 clean or guarded, ½ tainted, 0 blighted (unguarded) or corrupted. */
export function hexSecurity(world: WorldState, at: Hex, presences: readonly PartyPresence[]): 0 | 0.5 | 1 {
  const level = blightAt(world, at)
  if (level === 0 || guarded(world, at, presences)) return 1
  return level === 1 ? 0.5 : 0
}

/** A road's security, the mean of its hexes' (`hexSecurity`), 0 to 1. */
export function routeSecurity(world: WorldState, road: readonly Hex[], presences: readonly PartyPresence[]): number {
  if (road.length === 0) return 0
  return road.reduce((sum, at) => sum + hexSecurity(world, at, presences), 0) / road.length
}

/** The gold a road pays a yield day when not raided: its length's worth, scaled by its security, rounded down. */
export function routeIncome(world: WorldState, road: readonly Hex[], presences: readonly PartyPresence[]): number {
  return Math.floor(Math.floor(ROUTE_BASE + road.length / ROUTE_HEXES_PER_GOLD) * routeSecurity(world, road, presences))
}

/** The monster locations within `RAID_RADIUS` of any hex of the road, nearest to it first, ties in locations order. */
export function raiders(world: WorldState, road: readonly Hex[]): MonsterLocation[] {
  const near = (l: MonsterLocation) => Math.min(...road.map((h) => hexDistance(h, l.position)))
  return world.locations
    .filter((l): l is MonsterLocation => l.kind === 'monsters')
    .map((l) => ({ l, d: near(l) }))
    .filter(({ d }) => d <= RAID_RADIUS)
    .sort((a, b) => a.d - b.d)
    .map(({ l }) => l)
}

/** Why the route is raided today, the first that holds: its partner silent, a road hex corrupted, raiders near; or null. */
export function raidCause(world: WorldState, route: Pick<TradeRoute, 'partner' | 'road'>): { cause: RaidCause; raider?: MonsterLocation } | null {
  if (isSilent(world, route.partner)) return { cause: 'silent' }
  if (route.road.some((h) => blightAt(world, h) >= MAX_BLIGHT)) return { cause: 'corrupted' }
  const raider = raiders(world, route.road)[0]
  return raider ? { cause: 'raiders', raider } : null
}

/**
 * The routes' yield day, after the partners' day: each route in order is
 * raided (counting its run, and abandoned at `ABANDON_AFTER`) or pays its
 * gold, and on every second yield day 1 of its partner's good when its
 * security is at least ½; the first clear day after a raid restores it.
 * Nothing on other days, nor once the encampment is lost.
 */
export function tradeDay(world: WorldState, presences: readonly PartyPresence[]): WorldEvent[] {
  if (world.status === 'lost' || world.turn % YIELD_DAYS !== 0) return []
  const events: WorldEvent[] = []
  for (const route of [...world.routes]) {
    const partner = partnerById(world, route.partner)!
    const named = { route: route.id, partner: partner.id, name: partner.name }
    const raid = raidCause(world, route)
    if (raid) {
      route.raidedDays += 1
      const raider = raid.raider ? { raider: raid.raider.id, raiderName: raid.raider.name } : {}
      events.push({ type: 'route_raided', ...named, cause: raid.cause, ...raider, days: route.raidedDays })
      if (route.raidedDays >= ABANDON_AFTER) {
        world.routes = world.routes.filter((r) => r !== route)
        events.push({ type: 'route_abandoned', ...named })
      }
      continue
    }
    if (route.raidedDays > 0) {
      route.raidedDays = 0
      events.push({ type: 'route_restored', ...named })
    }
    const pay = (material: PartnerLocation['good'], amount: number) => {
      world.stock[material] = (world.stock[material] ?? 0) + amount
      events.push({ type: 'yield', site: partner.id, name: partner.name, material, amount, source: 'route', route: route.id })
    }
    const gold = routeIncome(world, route.road, presences)
    if (gold > 0) pay('gold', gold)
    if ((world.turn / YIELD_DAYS) % 2 === 0 && routeSecurity(world, route.road, presences) >= 0.5) pay(partner.good, 1)
  }
  return events
}
