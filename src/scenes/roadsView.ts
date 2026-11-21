import type { PartyPresence } from '../game/expedition.ts'
import { YIELD_DAYS } from '../game/territory.ts'
import {
  RAID_RADIUS,
  hexSecurity,
  isContacted,
  isSilent,
  raidCause,
  routeIncome,
  routeOf,
  routeSecurity,
  type RaidCause,
} from '../game/trade.ts'
import { encampment, encampmentName, theName, type MonsterLocation, type PartnerLocation, type WorldState } from '../game/worldMap.ts'
import { isPluralName } from '../game/territory.ts'
import { hexEquals, type Hex } from '../grid/hex.ts'

/** How safe a stretch of road is, for its colour. */
export type RoadShade = 'secure' | 'tainted' | 'raided'

/** The road overlay's colours: gold, amber and red. */
export const ROAD_COLORS: Record<RoadShade, number> = { secure: 0xffd54f, tainted: 0xffa726, raided: 0xe53935 }

/** One stretch of an open route: between two neighbouring hexes, from the encampment's on out. */
export interface RoadSegment {
  route: string
  from: Hex
  to: Hex
  shade: RoadShade
}

/**
 * Every open route's segments, from the encampment's hex along its road. A
 * route raided today (`raidCause`) is 'raided' throughout; otherwise each
 * segment is shaded by its far hex's security: 1 'secure', ½ 'tainted', 0
 * 'raided'.
 */
export function roadSegments(world: WorldState, presences: readonly PartyPresence[]): RoadSegment[] {
  const home = encampment(world).position
  return world.routes.flatMap((route) => {
    const raided = raidCause(world, route) !== null
    return route.road.map((to, i): RoadSegment => {
      const security = hexSecurity(world, to, presences)
      const shade: RoadShade = raided || security === 0 ? 'raided' : security === 0.5 ? 'tainted' : 'secure'
      return { route: route.id, from: i === 0 ? home : route.road[i - 1], to, shade }
    })
  })
}

/** Why a route is raided, in words that follow "Raided: ". */
export function raidWords(raid: { cause: RaidCause; raider?: MonsterLocation }, partner: PartnerLocation): string {
  if (raid.cause === 'silent') return `${partner.name} is silent`
  if (raid.cause === 'corrupted') return 'the blight has overrun it'
  const who = raid.raider ? theName(raid.raider.name) : 'a nest'
  return `${who} ${isPluralName(who) ? 'are' : 'is'} within ${RAID_RADIUS} hexes`
}

/**
 * The info panel's lines for a hex on an open road, a pair for each route
 * through it: its security and income (counting towers, not parties), and
 * the raid's cause while it is raided today. Empty off the roads.
 */
export function roadInfoLines(world: WorldState, _presences: readonly PartyPresence[], at: Hex): string[] {
  return world.routes.flatMap((route) => {
    if (!route.road.some((h) => hexEquals(h, at))) return []
    const partner = world.locations.find((l): l is PartnerLocation => l.kind === 'partner' && l.id === route.partner)
    if (!partner) return []
    const security = Math.round(routeSecurity(world, route.road, []) * 100)
    const lines = [`The ${partner.name} road: security ${security}%, about ${routeIncome(world, route.road, [])} gold every ${YIELD_DAYS} days.`]
    const raid = raidCause(world, route)
    if (raid) lines.push(`Raided: ${raidWords(raid, partner)}.`)
    return lines
  })
}

/** The info panel's lines for a trade partner. */
export function partnerInfoLines(world: WorldState, partner: PartnerLocation): string[] {
  const lines = [`Trade partner: ${partner.good}.`]
  lines.push(isContacted(world, partner.id) ? `Trades with ${encampmentName(world)}.` : 'Not yet contacted: walk here to trade.')
  if (isSilent(world, partner.id)) lines.push('Silent while the blight holds its land.')
  const route = routeOf(world, partner.id)
  if (route) lines.push(`Route open: security ${Math.round(routeSecurity(world, route.road, []) * 100)}%.`)
  return lines
}
