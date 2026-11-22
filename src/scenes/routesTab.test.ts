import { describe, expect, it } from 'vitest'
import { boardIndex } from '../game/blight.ts'
import { newGame, type GameState } from '../game/gameState.ts'
import { readyMadeParty } from '../game/party.ts'
import { YIELD_DAYS } from '../game/territory.ts'
import { RAID_RADIUS, contactPartner, partnerById, raiders, roadTo, routeCost, routeIncome, routeSecurity, type TradeRoute } from '../game/trade.ts'
import { encampment, type MonsterLocation, type WorldState } from '../game/worldMap.ts'
import { hexDistance, hexEquals, hexNeighbors, type Hex } from '../grid/hex.ts'
import { boardHexCenter, WORLD_LAYOUT } from './boardGeometry.ts'
import { PARTNERS } from '../game/worldMap.ts'
import { ROUTE_ROWS, minimapBoard, minimapPoints, routeNotes, routeOffer, routeRows, routeState, type RouteRow } from './routesTab.ts'
import { UNEXPLORED } from '../game/vision.ts'

/** A new game with Millbrook contacted, the trading post at 4, the stock rich and the party at home. */
function trading(): { game: GameState; world: WorldState; party: GameState['parties'][number] } {
  const game = newGame(readyMadeParty(), null, 1)
  const { world } = game
  contactPartner(world, 'millbrook')
  world.tradingPost = 4
  world.stock = { gold: 100, timber: 20 }
  return { game, world, party: game.parties[0] }
}

function nest(world: WorldState, at: Hex, sighted: boolean, id = 'test_nest'): MonsterLocation {
  const template = world.locations.find((l): l is MonsterLocation => l.kind === 'monsters')!
  const placed: MonsterLocation = { ...template, id, name: 'Goblin Brood', position: { ...at }, source: undefined }
  delete placed.source
  world.locations.push(placed)
  if (sighted) world.sighted.push(id)
  return placed
}

/** A hex exactly `RAID_RADIUS` from Millbrook, so a nest there raids any road that reaches it. */
function twoFrom(world: WorldState): Hex {
  const millbrook = partnerById(world, 'millbrook')!.position
  return hexNeighbors(millbrook).flatMap(hexNeighbors).find((h) => hexDistance(h, millbrook) === RAID_RADIUS)!
}

function clean(world: WorldState, road: readonly Hex[]) {
  for (const h of road) world.blight[boardIndex(world.board, h)] = 0
}

describe('routeRows', () => {
  it('lists the contacted partners only, in the order contacted', () => {
    const { game, world, party } = trading()
    expect(routeRows(game, party).map((r) => r.partner)).toEqual(['millbrook'])
    contactPartner(world, 'saltmere')
    expect(routeRows(game, party).map((r) => r.partner)).toEqual(['millbrook', 'saltmere'])
    world.contacted.reverse()
    expect(routeRows(game, party).map((r) => r.partner)).toEqual(['saltmere', 'millbrook'])
    world.contacted = []
    expect(routeRows(game, party)).toEqual([])
  })

  it('previews a closed row from roadTo, with the formulas for income and cost', () => {
    const { game, world, party } = trading()
    const road = roadTo(world, 'millbrook')!
    const [row] = routeRows(game, party)
    expect(row).toMatchObject({ partner: 'millbrook', name: 'Millbrook', good: 'timber', silent: false, status: 'closed', raidedDays: 0, refusal: null })
    expect(row.road).toEqual(road)
    expect(row.length).toBe(road.length)
    expect(row.income).toBe(routeIncome(world, road, []))
    expect(row.security).toBe(routeSecurity(world, road, []))
    expect(row.cost).toEqual(routeCost(road.length))
  })

  it('counts towers, not the party at home, in the preview (decision 8)', () => {
    const { game, world, party } = trading()
    const road = roadTo(world, 'millbrook')!
    for (const h of road) world.blight[boardIndex(world.board, h)] = 2
    party.position = { ...road[2] }
    const before = routeRows(game, party)[0]
    expect(before.security).toBe(0)
    world.towers.push({ id: 'tower_1', position: { ...road[2] } })
    expect(routeRows(game, party)[0].security).toBeGreaterThan(0)
  })

  it('carries the refusals: below post 4, at full slots, with no road, and with the stock short', () => {
    const { game, world, party } = trading()
    world.tradingPost = 3
    expect(routeRows(game, party)[0].refusal).toBe('Routes need the Market (trading post level 4).')
    world.tradingPost = 4
    world.routes.push({ id: 'route_saltmere', partner: 'saltmere', road: [{ q: 1, r: 1 }], opened: 1, raidedDays: 0, raided: false })
    expect(routeRows(game, party)[0].refusal).toMatch(/keeps 1 route open at most/)
    world.routes.length = 0
    world.stock = { gold: 5 }
    expect(routeRows(game, party)[0].refusal).toMatch(/^The route costs \d+ gold, 10 timber, more than the stock holds\.$/)
    world.stock = { gold: 100, timber: 20 }
    for (const h of hexNeighbors(partnerById(world, 'millbrook')!.position)) nest(world, h, true, `wall_${h.q}_${h.r}`)
    const [walled] = routeRows(game, party)
    expect(walled).toMatchObject({ status: 'closed', road: null, length: null, income: null, security: null, cost: null, raid: null, refusal: 'No safe road to Millbrook.' })
    expect(routeOffer(walled)).toBe('No safe road to Millbrook.')
  })

  it('shows an open route by its own road: open, or raided when a raid cause holds today', () => {
    const { game, world, party } = trading()
    const road = roadTo(world, 'millbrook')!
    clean(world, road)
    const route: TradeRoute = { id: 'route_millbrook', partner: 'millbrook', road, opened: 1, raidedDays: 0, raided: false }
    world.routes.push(route)
    const [open] = routeRows(game, party)
    expect(open).toMatchObject({ status: 'open', cost: null, refusal: null, raid: null, raidedDays: 0 })
    expect(open.road).toBe(road)
    expect(open.income).toBe(routeIncome(world, road, []))
    nest(world, road[road.length - 2], true)
    route.raidedDays = 2
    expect(routeRows(game, party)[0]).toMatchObject({ status: 'raided', raidedDays: 2, refusal: null, raid: null })
  })

  it('names a sighted nest within reach of the preview, and tells of "Raided at once" in the offer', () => {
    const { game, world, party } = trading()
    nest(world, twoFrom(world), true)
    const [row] = routeRows(game, party)
    expect(row.raid).toBe(`the Goblin Brood is within ${RAID_RADIUS} hexes`)
    // The row says so briefly; the notes under the minimap say why.
    expect(routeOffer(row)).toMatch(/, costs [^.]*\. Raided at once\.$/)
    expect(routeNotes(row)[0]).toBe('Raided at once: the Goblin Brood is within 2 hexes.')
  })

  it('names no nest the player has not sighted', () => {
    const { game, world, party } = trading()
    const hidden = nest(world, twoFrom(world), false)
    expect(raiders(world, roadTo(world, 'millbrook')!)).toContain(hidden)
    const [row] = routeRows(game, party)
    expect(row.raid).toBeNull()
    expect(routeOffer(row)).not.toMatch(/Raided|Goblin/)
  })

  it('names a sighted nest even when an unsighted one is nearer the road', () => {
    const { game, world, party } = trading()
    const millbrook = partnerById(world, 'millbrook')!.position
    nest(world, twoFrom(world), false, 'hidden')
    const second = hexNeighbors(millbrook).flatMap(hexNeighbors).find((h) => hexDistance(h, millbrook) === 2 && !hexEquals(h, twoFrom(world)))!
    const seen = nest(world, second, true, 'seen')
    seen.name = 'Kobold Nest'
    const road = roadTo(world, 'millbrook')!
    expect(raiders(world, road).length).toBe(2)
    expect(routeRows(game, party)[0].raid).toBe(`the Kobold Nest is within ${RAID_RADIUS} hexes`)
  })

  it('counts the road\'s unsafe hexes, a watchtower\'s guard making them safe (verification round 2)', () => {
    const { game, world, party } = trading()
    const road = roadTo(world, 'millbrook')!
    clean(world, road)
    world.blight[boardIndex(world.board, road[6])] = 1
    world.blight[boardIndex(world.board, road[7])] = 1
    world.blight[boardIndex(world.board, road[9])] = 2
    expect(routeRows(game, party)[0].weak).toEqual({ tainted: 2, blighted: 1, corrupted: 0 })
    world.towers.push({ id: 'tower_1', position: road[8] })
    expect(routeRows(game, party)[0].weak).toEqual({ tainted: 0, blighted: 0, corrupted: 0 })
  })

  it('says where the blight has overrun a previewed road, only where the player has explored (verification round 2)', () => {
    const { game, world, party } = trading()
    const road = roadTo(world, 'millbrook')!
    clean(world, road)
    const at = boardIndex(world.board, road[5])
    world.blight[at] = 3
    world.seen[at] = 3
    expect(routeRows(game, party)[0].raid).toBe('the blight has overrun it 6 hexes out')
    world.seen[at] = UNEXPLORED
    expect(routeRows(game, party)[0].raid).toBe('the blight has overrun it')
  })

  it('says a silent partner is silent', () => {
    const { game, world, party } = trading()
    world.silent.push('millbrook')
    const [row] = routeRows(game, party)
    expect(row.silent).toBe(true)
    expect(row.refusal).toBe('Millbrook is silent while the blight holds its land.')
  })
})

describe('routeOffer and routeState', () => {
  const closed = (over: Partial<RouteRow> = {}): RouteRow => ({
    partner: 'millbrook', name: 'Millbrook', good: 'timber', silent: false, status: 'closed', road: [], length: 14, income: 2, security: 1,
    cost: { gold: 27, timber: 10 }, raidedDays: 0, refusal: null, raid: null, weak: { tainted: 0, blighted: 0, corrupted: 0 }, ...over,
  })

  it('words the offer with the figures, the partner\'s good and the cost (verification round 2)', () => {
    expect(routeOffer(closed())).toBe(`Open a route to Millbrook: 14 hexes, about 2 gold every ${YIELD_DAYS} days and 1 timber every ${2 * YIELD_DAYS}, costs 27 gold, 10 timber`)
  })

  it('ends with "Raided at once." and leaves the cause to the notes, so the row fits at 840 × 560 (verification round 2)', () => {
    const raided = closed({ raid: 'the Goblin Raiders are within 2 hexes' })
    expect(routeOffer(raided)).toBe(
      `Open a route to Millbrook: 14 hexes, about 2 gold every ${YIELD_DAYS} days and 1 timber every ${2 * YIELD_DAYS}, costs 27 gold, 10 timber. Raided at once.`,
    )
    expect(routeNotes(raided)[0]).toBe('Raided at once: the Goblin Raiders are within 2 hexes.')
  })

  it('explains security below 100% and the good\'s condition in the notes (verification round 2)', () => {
    expect(routeNotes(closed())).toEqual([`1 timber every ${2 * YIELD_DAYS} days while security is 50% or more.`])
    expect(routeNotes(closed({ security: 12 / 14, weak: { tainted: 2, blighted: 0, corrupted: 0 } }))).toEqual([
      'Security 86%: 2 of 14 hexes tainted.',
      `1 timber every ${2 * YIELD_DAYS} days while security is 50% or more.`,
    ])
    expect(routeNotes(closed({ security: 0.4, weak: { tainted: 3, blighted: 2, corrupted: 1 } }))[0]).toBe('Security 40%: 3 of 14 hexes tainted, 2 blighted, 1 corrupted.')
    expect(routeNotes(closed({ security: 0.4, weak: { tainted: 3, blighted: 2, corrupted: 1 } }))[1]).toBe(`1 timber every ${2 * YIELD_DAYS} days while security is 50% or more (not now).`)
    expect(routeNotes(closed({ length: null, road: null, security: null }))).toEqual([])
  })

  it('states an open route: security as a whole percentage, income, raided days', () => {
    const open = closed({ status: 'open', security: 0.75, cost: null })
    expect(routeState(open)).toBe(`Millbrook road: security 75%, about 2 gold every ${YIELD_DAYS} days`)
    expect(routeState({ ...open, status: 'raided', raidedDays: 2 })).toBe('Millbrook road: security 75%, pays nothing while raided; raided 2 yield days')
    expect(routeState({ ...open, status: 'raided', raidedDays: 1 })).toBe('Millbrook road: security 75%, pays nothing while raided; raided 1 yield day')
    expect(routeState({ ...open, status: 'raided', raidedDays: 0 })).toBe('Millbrook road: security 75%, pays nothing while raided')
    expect(routeState({ ...open, security: 2 / 3 })).toMatch(/security 67%/)
  })
})

describe('minimapPoints', () => {
  const rect = { x: 10, y: 20, width: 200, height: 150 }

  it('starts at the encampment and keeps every point inside the rect', () => {
    const { world } = trading()
    const road = roadTo(world, 'millbrook')!
    const from = encampment(world).position
    const points = minimapPoints(world.board, road, from, rect)
    expect(points).toHaveLength(road.length + 1)
    for (const p of points) {
      expect(p.x).toBeGreaterThanOrEqual(rect.x)
      expect(p.x).toBeLessThanOrEqual(rect.x + rect.width)
      expect(p.y).toBeGreaterThanOrEqual(rect.y)
      expect(p.y).toBeLessThanOrEqual(rect.y + rect.height)
    }
  })

  it("keeps the board's aspect: distances scale alike in x and y", () => {
    const { world } = trading()
    const road = roadTo(world, 'millbrook')!
    const from = encampment(world).position
    const [a, b] = minimapPoints(world.board, road, from, rect)
    const ca = boardHexCenter(from, WORLD_LAYOUT)
    const cb = boardHexCenter(road[0], WORLD_LAYOUT)
    const dx = cb.x - ca.x
    const dy = cb.y - ca.y
    if (dx !== 0 && dy !== 0) expect((b.x - a.x) / dx).toBeCloseTo((b.y - a.y) / dy, 6)
    else if (dx !== 0) expect(b.y - a.y).toBeCloseTo(0, 6)
  })

  it('fits the board outline in the rect, centred', () => {
    const { world } = trading()
    const b = minimapBoard(world.board, rect)
    expect(b.x).toBeGreaterThanOrEqual(rect.x)
    expect(b.y).toBeGreaterThanOrEqual(rect.y)
    expect(b.x + b.width).toBeLessThanOrEqual(rect.x + rect.width + 1e-9)
    expect(b.y + b.height).toBeLessThanOrEqual(rect.y + rect.height + 1e-9)
    expect(b.x - rect.x).toBeCloseTo(rect.x + rect.width - (b.x + b.width), 6)
    expect(b.y - rect.y).toBeCloseTo(rect.y + rect.height - (b.y + b.height), 6)
  })
})

describe('the Routes tab', () => {
  it('has a row for every partner there is; more partners need paging', () => {
    expect(PARTNERS.length).toBeLessThanOrEqual(ROUTE_ROWS)
  })
})
