import type { Expedition } from '../game/expedition.ts'
import type { GameState } from '../game/gameState.ts'
import { describeCost } from '../game/buildings.ts'
import { YIELD_DAYS, type Material } from '../game/territory.ts'
import type { Stock } from '../game/territory.ts'
import { isSilent, openRouteRefusal, partnerById, raidCause, raiders, roadTo, routeCost, routeIncome, routeOf, routeSecurity } from '../game/trade.ts'
import type { PartnerLocation, WorldState } from '../game/worldMap.ts'
import type { BoardSize, Hex } from '../grid/hex.ts'
import { WORLD_LAYOUT, boardHexCenter, boardPixelSize, type Point } from './boardGeometry.ts'
import { raidWords } from './roadsView.ts'

/** How many partners' rows the Routes tab draws; more partners need paging. */
export const ROUTE_ROWS = 4

/** Where a partner's route stands: open and paying, open but raided today, or not yet opened. */
export type RouteStatus = 'open' | 'raided' | 'closed'

/** One contacted partner's line in the trading post's Routes tab. */
export interface RouteRow {
  partner: string
  name: string
  good: Material
  silent: boolean
  status: RouteStatus
  /** The open route's road, or `roadTo`'s preview for a closed one (null when none). */
  road: Hex[] | null
  length: number | null
  /** `routeIncome` with no parties: towers guard, the party at home does not (decision 8). */
  income: number | null
  security: number | null
  /** `routeCost(length)`, for a closed row with a road. */
  cost: Stock | null
  raidedDays: number
  /** Why a closed route cannot be opened now, or null. */
  refusal: string | null
  /** For a closed row with a road: what would raid it today that the player knows of, in words. Never a nest not yet sighted. */
  raid: string | null
}

/**
 * What would raid the previewed road today, told only as far as the player
 * knows: a nest not yet sighted is not named (the road may still be raided
 * the day it opens, and the event then says so).
 */
function previewRaid(world: WorldState, partner: PartnerLocation, road: Hex[]): string | null {
  const cause = raidCause(world, { partner: partner.id, road })
  if (!cause) return null
  if (cause.cause !== 'raiders') return raidWords(cause, partner)
  const known = raiders(world, road).find((nest) => world.sighted.includes(nest.id))
  return known ? raidWords({ cause: 'raiders', raider: known }, partner) : null
}

/** A row for each contacted partner, in the order contacted. */
export function routeRows(game: GameState, party: Expedition): RouteRow[] {
  const { world } = game
  return world.contacted.flatMap((id): RouteRow[] => {
    const partner = partnerById(world, id)
    if (!partner) return []
    const base = { partner: id, name: partner.name, good: partner.good, silent: isSilent(world, id) }
    const route = routeOf(world, id)
    if (route) {
      return [
        {
          ...base,
          status: raidCause(world, route) ? 'raided' : 'open',
          road: route.road,
          length: route.road.length,
          income: routeIncome(world, route.road, []),
          security: routeSecurity(world, route.road, []),
          cost: null,
          raidedDays: route.raidedDays,
          refusal: null,
          raid: null,
        },
      ]
    }
    const road = roadTo(world, id)
    return [
      {
        ...base,
        status: 'closed',
        road,
        length: road?.length ?? null,
        income: road ? routeIncome(world, road, []) : null,
        security: road ? routeSecurity(world, road, []) : null,
        cost: road ? routeCost(road.length) : null,
        raidedDays: 0,
        refusal: openRouteRefusal(game, party, id),
        raid: road ? previewRaid(world, partner, road) : null,
      },
    ]
  })
}

const everyDays = (gold: number) => `about ${gold} gold every ${YIELD_DAYS} days`

/** A closed row's offer, or, with no road, the refusal that stands in. */
export function routeOffer(row: RouteRow): string {
  if (row.length === null || row.cost === null) return row.refusal ?? `No safe road to ${row.name}.`
  const offer = `Open a route to ${row.name}: ${row.length} hexes, ${everyDays(row.income ?? 0)}, costs ${describeCost(row.cost)}`
  return row.raid ? `${offer}. Raided at once: ${row.raid}` : offer
}

/** An open route's line: its security, what it pays, and how long it has been raided. */
export function routeState(row: RouteRow): string {
  const security = Math.round((row.security ?? 0) * 100)
  const pays = row.status === 'raided' ? 'pays nothing while raided' : everyDays(row.income ?? 0)
  const raided = row.raidedDays > 0 ? `; raided ${row.raidedDays} yield ${row.raidedDays === 1 ? 'day' : 'days'}` : ''
  return `${row.name} road: security ${security}%, ${pays}${raided}`
}

export interface MinimapRect {
  x: number
  y: number
  width: number
  height: number
}

/** The board's outline within `rect`: as large as fits with the world map's aspect, and centred. */
export function minimapBoard(board: BoardSize, rect: MinimapRect): MinimapRect & { scale: number } {
  const size = boardPixelSize(board, WORLD_LAYOUT)
  const scale = Math.min(rect.width / size.width, rect.height / size.height)
  const width = size.width * scale
  const height = size.height * scale
  return { x: rect.x + (rect.width - width) / 2, y: rect.y + (rect.height - height) / 2, width, height, scale }
}

/** The encampment's hex and then the road's, as points on the board's outline in `rect` (`minimapBoard`). */
export function minimapPoints(board: BoardSize, road: readonly Hex[], from: Hex, rect: MinimapRect): Point[] {
  const fitted = minimapBoard(board, rect)
  return [from, ...road].map((h) => {
    const c = boardHexCenter(h, WORLD_LAYOUT)
    return { x: fitted.x + c.x * fitted.scale, y: fitted.y + c.y * fitted.scale }
  })
}
