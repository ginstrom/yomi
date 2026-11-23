import { describe, expect, it } from 'vitest'
import { HexBoard, hexAdd, hexDistance, hexEquals, hexKey, hexNeighbors, type Hex } from '../grid/hex.ts'
import { MAX_BLIGHT, boardIndex } from './blight.ts'
import type { PartyPresence } from './expedition.ts'
import { newGame, type GameState } from './gameState.ts'
import { readyMadeParty } from './party.ts'
import { LOSS_LEVEL, YIELD_DAYS, updateTerritory } from './territory.ts'
import {
  ABANDON_AFTER,
  GUARD_RADIUS,
  RAID_RADIUS,
  ROUTE_SLOTS,
  contactPartner,
  guarded,
  hexSecurity,
  isContacted,
  isSilent,
  openRoute,
  openRouteRefusal,
  partnerById,
  partnerDay,
  partners,
  raidCause,
  raiders,
  roadTo,
  routeCost,
  routeIncome,
  routeLimit,
  routeOf,
  routeSecurity,
  tradeDay,
  type TradeRoute,
} from './trade.ts'
import { earlyHex, ENCAMPMENT_ID, encampment, isNotable, newWorld, passTurn, type MonsterLocation, type WorldState } from './worldMap.ts'

const at = (world: WorldState, id: string): PartyPresence => ({ position: { ...partnerById(world, id)!.position }, levels: [1, 1, 1] })
const setLevel = (world: WorldState, id: string, level: number) => (world.blight[boardIndex(world.board, partnerById(world, id)!.position)] = level)

describe('the trade partners', () => {
  it('are read in locations order, by id', () => {
    const world = newWorld(1)
    expect(partners(world).map((p) => [p.id, p.good])).toEqual([
      ['millbrook', 'timber'], ['saltmere', 'salt'], ['stonehollow', 'mithril'], ['elder_glade', 'elderwood'], ['emberwatch', 'adamant'],
    ])
    expect(partnerById(world, 'saltmere')?.name).toBe('Saltmere')
    expect(partnerById(world, 'iron_vein')).toBeNull()
    expect(partnerById(world, 'nowhere')).toBeNull()
  })

  it('start uncontacted and, on tainted land, not silent', () => {
    const world = newWorld(1)
    for (const p of partners(world)) {
      expect(isContacted(world, p.id)).toBe(false)
      expect(isSilent(world, p.id)).toBe(false)
    }
  })
})

describe('contact (economy A4)', () => {
  it('comes on the day a party stands on the partner, once', () => {
    const game = newGame(readyMadeParty(), null, 1)
    const { world } = game
    game.parties[0].position = { ...partnerById(world, 'millbrook')!.position }
    const first = passTurn(world, [{ position: game.parties[0].position, levels: [1, 1, 1] }])
    expect(first.filter((e) => e.type === 'partner_contacted')).toEqual([
      { type: 'partner_contacted', partner: 'millbrook', name: 'Millbrook', home: 'Oakvale' },
    ])
    expect(isContacted(world, 'millbrook')).toBe(true)
    const second = passTurn(world, [{ position: game.parties[0].position, levels: [1, 1, 1] }])
    expect(second.some((e) => e.type === 'partner_contacted')).toBe(false)
  })

  it('names the encampment as the player called it', () => {
    const world = newWorld(1, 'Hearthold')
    expect(contactPartner(world, 'saltmere')).toEqual({ type: 'partner_contacted', partner: 'saltmere', name: 'Saltmere', home: 'Hearthold' })
  })

  it('is refused (null) for a location that is no partner, and for a partner contacted already', () => {
    const world = newWorld(1)
    expect(contactPartner(world, ENCAMPMENT_ID)).toBeNull()
    expect(contactPartner(world, 'nowhere')).toBeNull()
    expect(contactPartner(world, 'millbrook')).not.toBeNull()
    expect(contactPartner(world, 'millbrook')).toBeNull()
    expect(world.contacted).toEqual(['millbrook'])
  })

  it('keeps the order contacted', () => {
    const world = newWorld(1)
    contactPartner(world, 'saltmere')
    partnerDay(world, [at(world, 'millbrook')])
    expect(world.contacted).toEqual(['saltmere', 'millbrook'])
  })

  it('comes after the day\'s other territory events, in locations order', () => {
    const world = newWorld(1)
    world.turn = 5
    const events = updateTerritory(world, [at(world, 'saltmere'), at(world, 'millbrook')])
    const contacts = events.filter((e) => e.type === 'partner_contacted')
    expect(contacts.map((e) => e.type === 'partner_contacted' && e.partner)).toEqual(['millbrook', 'saltmere'])
    expect(events.slice(-2)).toEqual(contacts)
  })
})

describe('silence', () => {
  it('falls on a contacted partner at LOSS_LEVEL, holds at 1 and lifts at 0, told each way', () => {
    const world = newWorld(1)
    contactPartner(world, 'millbrook')
    setLevel(world, 'millbrook', LOSS_LEVEL)
    expect(partnerDay(world, [])).toEqual([{ type: 'partner_silent', partner: 'millbrook', name: 'Millbrook' }])
    expect(isSilent(world, 'millbrook')).toBe(true)
    expect(partnerDay(world, [])).toEqual([])
    setLevel(world, 'millbrook', 1)
    expect(partnerDay(world, [])).toEqual([])
    expect(isSilent(world, 'millbrook')).toBe(true)
    setLevel(world, 'millbrook', 0)
    expect(partnerDay(world, [])).toEqual([{ type: 'partner_restored', partner: 'millbrook', name: 'Millbrook' }])
    expect(isSilent(world, 'millbrook')).toBe(false)
  })

  it('is kept, untold, for a partner not contacted', () => {
    const world = newWorld(1)
    setLevel(world, 'saltmere', 3)
    expect(partnerDay(world, [])).toEqual([])
    expect(world.silent).toEqual(['saltmere'])
    setLevel(world, 'saltmere', 0)
    expect(partnerDay(world, [])).toEqual([])
    expect(world.silent).toEqual([])
  })

  it('is told after contact when a partner is contacted on the day it falls silent', () => {
    const world = newWorld(1)
    setLevel(world, 'millbrook', LOSS_LEVEL)
    expect(partnerDay(world, [at(world, 'millbrook')]).map((e) => e.type)).toEqual(['partner_contacted', 'partner_silent'])
  })

  it('stops a journey (notable); contact and waking do not', () => {
    const world = newWorld(1)
    expect(isNotable(world, { type: 'partner_silent', partner: 'millbrook', name: 'Millbrook' }, [])).toBe(true)
    expect(isNotable(world, { type: 'partner_contacted', partner: 'millbrook', name: 'Millbrook', home: 'Oakvale' }, [])).toBe(false)
    expect(isNotable(world, { type: 'partner_restored', partner: 'millbrook', name: 'Millbrook' }, [])).toBe(false)
  })
})

/** Sets a hex's blight level by hand. */
const setHex = (world: WorldState, h: Hex, level: number) => (world.blight[boardIndex(world.board, h)] = level)

/** Places a nest (a copy of the first monster location) on `h`. */
function nest(world: WorldState, h: Hex, id = `nest_${hexKey(h)}`): MonsterLocation {
  const template = world.locations.find((l): l is MonsterLocation => l.kind === 'monsters')!
  const placed: MonsterLocation = { ...template, id, name: `Nest ${id}`, position: { ...h }, source: undefined }
  delete placed.source
  world.locations.push(placed)
  return placed
}

/** Every monster location's hex. */
const nests = (world: WorldState) => world.locations.filter((l): l is MonsterLocation => l.kind === 'monsters')

/** The nearest any monster location stands to the road. */
const nearestNest = (world: WorldState, road: readonly Hex[]) =>
  Math.min(...nests(world).map((l) => Math.min(...road.map((h) => hexDistance(h, l.position)))))

/** A new game on world 1 with Millbrook contacted, the trading post at 4, the stock rich and the party at home. */
function trading(): { game: GameState; world: WorldState; party: GameState['parties'][number] } {
  const game = newGame(readyMadeParty(), null, 1)
  const { world } = game
  contactPartner(world, 'millbrook')
  world.tradingPost = 4
  world.stock = { gold: 100, timber: 20 }
  return { game, world, party: game.parties[0] }
}

/** A stand-in route to `partner`, with a road of its own. */
const fakeRoute = (partner: string, road: Hex[] = [earlyHex(1, 1)]): TradeRoute => ({ id: `route_${partner}`, partner, road, opened: 1, raidedDays: 0, raided: false })

/** The row of `lane`. */
const LANE = 36

/** A straight road of `length` hexes eastward along row `LANE` from column 2, away from home and every nest. */
function lane(world: WorldState, length: number): Hex[] {
  const road = Array.from({ length }, (_, i) => earlyHex(2 + i, LANE))
  for (const h of road) setHex(world, h, 0)
  return road
}

describe('the road (economy A5, decision 6)', () => {
  it('reaches each of the five partners on a fresh world under the strict rule, with no raiders', () => {
    const world = newWorld(1)
    const lengths: Record<string, number> = {}
    for (const p of partners(world)) {
      contactPartner(world, p.id)
      const road = roadTo(world, p.id)
      expect(road, p.id).not.toBeNull()
      expect(raiders(world, road!), p.id).toEqual([])
      lengths[p.id] = road!.length
    }
    // The lengths on world 1, recorded in stage 9's plan log (step 05).
    expect(lengths).toEqual({ millbrook: 14, saltmere: 30, stonehollow: 61, elder_glade: 88, emberwatch: 100 })
  })

  it('is the same for the same world: twice, and for two worlds of one seed', () => {
    const a = newWorld(7)
    const b = newWorld(7)
    expect(roadTo(a, 'saltmere')).toEqual(roadTo(a, 'saltmere'))
    expect(roadTo(a, 'saltmere')).toEqual(roadTo(b, 'saltmere'))
    expect(roadTo(a, 'millbrook')).toEqual(roadTo(b, 'millbrook'))
  })

  it('leaves out the encampment, ends on the partner, and steps a hex at a time', () => {
    const world = newWorld(1)
    for (const id of ['millbrook', 'saltmere']) {
      const road = roadTo(world, id)!
      const home = encampment(world).position
      expect(road.some((h) => hexEquals(h, home))).toBe(false)
      expect(hexDistance(home, road[0])).toBe(1)
      expect(road.at(-1)).toEqual(partnerById(world, id)!.position)
      for (let i = 1; i < road.length; i++) expect(hexDistance(road[i - 1], road[i])).toBe(1)
      expect(new Set(road.map(hexKey)).size).toBe(road.length)
    }
  })

  it('keeps more than RAID_RADIUS from every nest, sighted or not, where it can', () => {
    const world = newWorld(1)
    const before = roadTo(world, 'millbrook')!
    expect(nearestNest(world, before)).toBeGreaterThan(RAID_RADIUS)
    // An unsighted nest three hexes from the middle of the road, beside it: the road bends round it.
    const middle = before[Math.floor(before.length / 2)]
    const spot = [...Array(4).keys()].map((k) => hexAdd(middle, { q: 0, r: 2 + k })).find((h) => nearestNest(world, [h]) > 3 && hexDistance(h, middle) === 2)
    expect(spot).toBeDefined()
    const placed = nest(world, spot!)
    expect(world.sighted).not.toContain(placed.id)
    const after = roadTo(world, 'millbrook')!
    expect(after).not.toEqual(before)
    expect(nearestNest(world, after)).toBeGreaterThan(RAID_RADIUS)
    expect(raidCause(world, { partner: 'millbrook', road: after })).toBeNull()
  })

  it('enters the partner\'s hex within RAID_RADIUS of a nest without falling back, clear of every nest on the way', () => {
    const world = newWorld(1)
    const millbrook = partnerById(world, 'millbrook')!.position
    const before = roadTo(world, 'millbrook')!
    // Two hexes from Millbrook and one from the road it took: the road must bend, but can stay clear.
    const spot = earlyHex(18, 28)
    expect(hexDistance(spot, millbrook)).toBe(RAID_RADIUS)
    expect(before.some((h) => hexEquals(h, spot))).toBe(false)
    expect(Math.min(...before.map((h) => hexDistance(h, spot)))).toBe(1)
    const placed = nest(world, spot)
    const road = roadTo(world, 'millbrook')!
    expect(road.at(-1)).toEqual(millbrook)
    expect(nearestNest(world, road.slice(0, -1))).toBeGreaterThan(RAID_RADIUS)
    // Only the partner itself stands in its reach, so the route is raided by it, as the Routes tab warns.
    expect(raidCause(world, { partner: 'millbrook', road })).toEqual({ cause: 'raiders', raider: placed })
  })

  it('falls back to avoiding only a nest and its neighbours when nests wall the clear road off, and is then raided', () => {
    const world = newWorld(1)
    const millbrook = partnerById(world, 'millbrook')!.position
    // A ring of nests three hexes round Millbrook with a gap three hexes wide where the road crossed:
    // the gap's middle is two from the nests at its ends, so only the looser rule passes it.
    const crossing = roadTo(world, 'millbrook')!.find((h) => hexDistance(h, millbrook) === 3)!
    const ring = new HexBoard(world.board).hexes.filter((h) => hexDistance(h, millbrook) === 3)
    for (const h of ring.filter((h) => hexDistance(h, crossing) > 1)) nest(world, h)
    const road = roadTo(world, 'millbrook')!
    expect(road).not.toBeNull()
    expect(road.at(-1)).toEqual(partnerById(world, 'millbrook')!.position)
    expect(nearestNest(world, road)).toBeLessThanOrEqual(RAID_RADIUS)
    expect(nearestNest(world, road)).toBeGreaterThan(1)
    expect(raidCause(world, { partner: 'millbrook', road })).toMatchObject({ cause: 'raiders' })
  })

  it('enters the partner\'s hex even beside a nest', () => {
    const world = newWorld(1)
    const millbrook = partnerById(world, 'millbrook')!.position
    nest(world, hexNeighbors(millbrook)[0])
    const road = roadTo(world, 'millbrook')!
    expect(road.at(-1)).toEqual(millbrook)
    expect(raidCause(world, { partner: 'millbrook', road })).toMatchObject({ cause: 'raiders' })
  })

  it('is null for no partner, and when nests wall the partner in; the route is then refused', () => {
    const { game, world, party } = trading()
    expect(roadTo(world, 'iron_vein')).toBeNull()
    expect(roadTo(world, 'nowhere')).toBeNull()
    const millbrook = partnerById(world, 'millbrook')!.position
    for (const h of hexNeighbors(millbrook)) nest(world, h)
    expect(roadTo(world, 'millbrook')).toBeNull()
    expect(openRouteRefusal(game, party, 'millbrook')).toBe('No safe road to Millbrook.')
  })
})

describe('opening a route (economy A5)', () => {
  it('costs ROUTE_COST_GOLD and a gold for every two hexes, and ROUTE_TIMBER timber', () => {
    expect(routeCost(14)).toEqual({ gold: 27, timber: 10 })
    expect(routeCost(26)).toEqual({ gold: 33, timber: 10 })
    expect(routeCost(15)).toEqual({ gold: 27, timber: 10 })
  })

  it('has slots by trading post level: none to 3, then 1, 2 and 4', () => {
    const world = newWorld(1)
    expect([1, 2, 3, 4, 5, 6].map((level) => ((world.tradingPost = level), routeLimit(world)))).toEqual([0, 0, 0, 1, 2, 4])
    expect(ROUTE_SLOTS).toEqual([0, 0, 0, 1, 2, 4])
  })

  it('spends the cost, holds the road the refusal checked, counts it and returns route_opened', () => {
    const { game, world, party } = trading()
    world.turn = 9
    expect(openRouteRefusal(game, party, 'millbrook')).toBeNull()
    const road = roadTo(world, 'millbrook')!
    expect(road).toHaveLength(14)
    const event = openRoute(game, party, 'millbrook')
    expect(event).toEqual({ type: 'route_opened', route: 'route_millbrook', partner: 'millbrook', name: 'Millbrook', length: 14 })
    expect(world.stock).toEqual({ gold: 73, timber: 10 })
    expect(world.routes).toEqual([{ id: 'route_millbrook', partner: 'millbrook', road, opened: 9, raidedDays: 0, raided: false }])
    expect(routeOf(world, 'millbrook')).toBe(world.routes[0])
    expect(routeOf(world, 'saltmere')).toBeNull()
    expect(world.routesOpened).toBe(1)
    expect(isNotable(world, event, [])).toBe(false)
  })

  describe('is refused, in order, and changes nothing', () => {
    const refused = (setup: (it: ReturnType<typeof trading>) => string, words: string) => () => {
      const it = trading()
      const partner = setup(it)
      const before = structuredClone(it.game)
      expect(openRouteRefusal(it.game, it.party, partner)).toBe(words)
      expect(it.game).toEqual(before)
    }
    it('away from the encampment', refused(({ party }) => ((party.position = earlyHex(7, 17)), 'millbrook'), 'Routes are opened at Oakvale.'))
    it('confronting monsters at home', refused(({ party }) => ((party.confronting = 'goblin_raiders'), 'millbrook'), 'Routes are opened at Oakvale.'))
    it('for no partner', refused(() => 'iron_vein', 'No partner "iron_vein".'))
    it('to a partner not contacted', refused(() => 'saltmere', 'Saltmere has not been contacted: walk there first.'))
    it('to a partner both uncontacted and silent, as uncontacted', refused(({ world }) => (world.silent.push('saltmere'), 'saltmere'), 'Saltmere has not been contacted: walk there first.'))
    it('to a silent partner', refused(({ world }) => (world.silent.push('millbrook'), 'millbrook'), 'Millbrook is silent while the blight holds its land.'))
    it('when the route is open already', refused(({ world }) => (world.routes.push(fakeRoute('millbrook')), 'millbrook'), 'A route to Millbrook is already open.'))
    it('below trading post level 4', refused(({ world }) => ((world.tradingPost = 3), 'millbrook'), 'Routes need the Market (trading post level 4).'))
    it('with the one slot of the Market full', refused(({ world }) => (world.routes.push(fakeRoute('elsewhere')), 'millbrook'), 'The Market keeps 1 route open at most.'))
    it('with the two slots of the Market Hall full', refused(({ world }) => {
      world.tradingPost = 5
      world.routes.push(fakeRoute('a'), fakeRoute('b'))
      return 'millbrook'
    }, 'The Market Hall keeps 2 routes open at most.'))
    it('with the four slots of the Trading House full', refused(({ world }) => {
      world.tradingPost = 6
      world.routes.push(fakeRoute('a'), fakeRoute('b'), fakeRoute('c'), fakeRoute('d'))
      return 'millbrook'
    }, 'The Trading House keeps 4 routes open at most.'))
    it('with no road', refused(({ world }) => {
      for (const h of hexNeighbors(partnerById(world, 'millbrook')!.position)) nest(world, h)
      return 'millbrook'
    }, 'No safe road to Millbrook.'))
    it('short of gold', refused(({ world }) => ((world.stock = { gold: 26, timber: 10 }), 'millbrook'), 'The route costs 27 gold, 10 timber, more than the stock holds.'))
    it('short of timber', refused(({ world }) => ((world.stock = { gold: 27, timber: 9 }), 'millbrook'), 'The route costs 27 gold, 10 timber, more than the stock holds.'))
  })

  it('opens with a free slot beside another route', () => {
    const { game, world, party } = trading()
    world.tradingPost = 5
    world.routes.push(fakeRoute('elsewhere'))
    expect(openRouteRefusal(game, party, 'millbrook')).toBeNull()
  })
})

describe('security and income (economy A6, company A8)', () => {
  it('pays ROUTE_BASE and a gold every ten hexes on a clean road', () => {
    const world = newWorld(1)
    expect(routeIncome(world, lane(world, 14), [])).toBe(2)
    expect(routeIncome(world, lane(world, 30), [])).toBe(4)
    expect(routeIncome(world, lane(world, 9), [])).toBe(1)
    expect(routeSecurity(world, lane(world, 14), [])).toBe(1)
  })

  it('counts a tainted hex a half and a blighted or corrupted one nothing', () => {
    const world = newWorld(1)
    const road = lane(world, 14)
    for (const h of road.slice(0, 7)) setHex(world, h, 1)
    expect(routeSecurity(world, road, [])).toBe(0.75)
    expect(routeIncome(world, road, [])).toBe(1)
    setHex(world, road[0], 2)
    setHex(world, road[1], MAX_BLIGHT)
    expect([0, 1, 2].map((i) => hexSecurity(world, road[i], []))).toEqual([0, 0, 0.5])
    expect(routeSecurity(world, road, [])).toBeCloseTo((5 * 0.5 + 7) / 14)
    expect(routeSecurity(world, [], [])).toBe(0)
  })

  it('counts tainted and blighted hexes within GUARD_RADIUS of a watchtower as safe, not one further', () => {
    const world = newWorld(1)
    const [tainted, blighted] = lane(world, 2)
    setHex(world, tainted, 1)
    setHex(world, blighted, 2)
    const near = earlyHex(3, LANE - GUARD_RADIUS)
    expect(hexDistance(near, tainted)).toBeGreaterThanOrEqual(GUARD_RADIUS)
    expect(hexDistance(near, blighted)).toBe(GUARD_RADIUS)
    world.towers = [{ id: 'tower_1', position: near }]
    expect(guarded(world, blighted, [])).toBe(true)
    expect(hexSecurity(world, blighted, [])).toBe(1)
    world.towers = [{ id: 'tower_1', position: earlyHex(3, LANE - GUARD_RADIUS - 1) }]
    expect(hexDistance(world.towers[0].position, blighted)).toBe(GUARD_RADIUS + 1)
    expect(guarded(world, blighted, [])).toBe(false)
    expect(hexSecurity(world, blighted, [])).toBe(0)
    // The tainted hex the same way: safe with the tower 3 away, half safe with it 4 away.
    world.towers = [{ id: 'tower_1', position: earlyHex(2, LANE - GUARD_RADIUS) }]
    expect(hexDistance(world.towers[0].position, tainted)).toBe(GUARD_RADIUS)
    expect(guarded(world, tainted, [])).toBe(true)
    expect(hexSecurity(world, tainted, [])).toBe(1)
    world.towers = [{ id: 'tower_1', position: earlyHex(2, LANE - GUARD_RADIUS - 1) }]
    expect(hexDistance(world.towers[0].position, tainted)).toBe(GUARD_RADIUS + 1)
    expect(guarded(world, tainted, [])).toBe(false)
    expect(hexSecurity(world, tainted, [])).toBe(0.5)
  })

  it('counts them safe within GUARD_RADIUS of a party, not without it (company A8)', () => {
    const world = newWorld(1)
    const road = lane(world, 4)
    for (const h of road) setHex(world, h, 2)
    // The first hex tainted, the rest blighted.
    setHex(world, road[0], 1)
    expect(routeSecurity(world, road, [])).toBe(0.5 / road.length)
    const party: PartyPresence = { position: earlyHex(2, LANE - GUARD_RADIUS), levels: [1, 1, 1] }
    expect(hexDistance(party.position, road[0])).toBe(GUARD_RADIUS)
    expect(guarded(world, road[0], [party])).toBe(true)
    expect(hexSecurity(world, road[0], [party])).toBe(1)
    const safe = road.filter((h) => hexDistance(h, party.position) <= GUARD_RADIUS).length
    expect(safe).toBeGreaterThan(1)
    expect(safe).toBeLessThan(road.length)
    expect(routeSecurity(world, road, [party])).toBe(safe / road.length)
  })

  it('never counts a clean or a corrupted hex as guarded', () => {
    const world = newWorld(1)
    const [clean, corrupted] = lane(world, 2)
    setHex(world, corrupted, MAX_BLIGHT)
    const party: PartyPresence = { position: corrupted, levels: [1, 1, 1] }
    world.towers = [{ id: 'tower_1', position: earlyHex(2, LANE - 1) }]
    expect(guarded(world, clean, [party])).toBe(false)
    expect(guarded(world, corrupted, [party])).toBe(false)
    expect(hexSecurity(world, corrupted, [party])).toBe(0)
  })
})

describe('raids (economy A6)', () => {
  /** A route to Millbrook along a lane, its partner contacted. */
  function laneRoute() {
    const world = newWorld(1)
    contactPartner(world, 'millbrook')
    return { world, road: lane(world, 10) }
  }

  it('come from a nest within RAID_RADIUS of a road hex, not one further', () => {
    const { world, road } = laneRoute()
    expect(raidCause(world, { partner: 'millbrook', road })).toBeNull()
    const far = nest(world, earlyHex(6, LANE - RAID_RADIUS - 1))
    expect(raiders(world, road)).toEqual([])
    world.locations = world.locations.filter((l) => l !== far)
    const near = nest(world, earlyHex(6, LANE - RAID_RADIUS))
    expect(raidCause(world, { partner: 'millbrook', road })).toEqual({ cause: 'raiders', raider: near })
  })

  it('name the nearest raider first, ties in locations order', () => {
    const { world, road } = laneRoute()
    const first = nest(world, earlyHex(3, LANE - 2), 'first')
    const nearest = nest(world, earlyHex(8, LANE - 1), 'nearest')
    const tied = nest(world, earlyHex(6, LANE - 2), 'tied')
    expect(raiders(world, road).map((l) => l.id)).toEqual([nearest.id, first.id, tied.id])
  })

  it('by silence beat corruption, which beats raiders', () => {
    const { world, road } = laneRoute()
    nest(world, earlyHex(5, LANE - 1))
    expect(raidCause(world, { partner: 'millbrook', road })?.cause).toBe('raiders')
    setHex(world, road[3], MAX_BLIGHT)
    expect(raidCause(world, { partner: 'millbrook', road })).toEqual({ cause: 'corrupted' })
    world.silent.push('millbrook')
    expect(raidCause(world, { partner: 'millbrook', road })).toEqual({ cause: 'silent' })
  })
})

describe('the routes\' yield day (economy A6)', () => {
  /** A world with one open route to Millbrook along a clean lane of 14 hexes. */
  function open(): { world: WorldState; route: TradeRoute } {
    const world = newWorld(1)
    contactPartner(world, 'millbrook')
    const route: TradeRoute = { id: 'route_millbrook', partner: 'millbrook', road: lane(world, 14), opened: 1, raidedDays: 0, raided: false }
    world.routes.push(route)
    world.stock = {}
    return { world, route }
  }
  const day = (world: WorldState, turn: number, presences: readonly PartyPresence[] = []) => ((world.turn = turn), tradeDay(world, presences))
  const goldYield = { type: 'yield', site: 'millbrook', name: 'Millbrook', material: 'gold', amount: 2, source: 'route', route: 'route_millbrook' }
  const timberYield = { ...goldYield, material: 'timber', amount: 1 }

  it('does nothing on other days', () => {
    const { world } = open()
    for (const turn of [1, 4, 6, 9]) expect(day(world, turn)).toEqual([])
    expect(world.stock).toEqual({})
  })

  it('pays gold every yield day, and the partner\'s good every second one', () => {
    const { world } = open()
    expect(day(world, YIELD_DAYS)).toEqual([goldYield])
    expect(day(world, 2 * YIELD_DAYS)).toEqual([goldYield, timberYield])
    expect(day(world, 3 * YIELD_DAYS)).toEqual([goldYield])
    expect(world.stock).toEqual({ gold: 6, timber: 1 })
  })

  it('pays the good at security ½ exactly', () => {
    const { world, route } = open()
    for (const h of route.road) setHex(world, h, 1)
    expect(routeSecurity(world, route.road, [])).toBe(0.5)
    expect(day(world, 2 * YIELD_DAYS)).toEqual([{ ...goldYield, amount: 1 }, timberYield])
  })

  it('pays no good below security ½, and no gold when its income is 0', () => {
    const { world, route } = open()
    for (const h of route.road.slice(0, 8)) setHex(world, h, 2)
    expect(routeSecurity(world, route.road, [])).toBeLessThan(0.5)
    expect(day(world, 2 * YIELD_DAYS)).toEqual([])
    // A party guarding the stretch makes all of it but its last hex safe again: 13 of 14, floor(2 × 13/14) gold.
    const guard: PartyPresence = { position: route.road[3], levels: [1, 1, 1] }
    expect(route.road.filter((h) => guarded(world, h, [guard]))).toHaveLength(7)
    expect(day(world, 2 * YIELD_DAYS, [guard])).toEqual([{ ...goldYield, amount: 1 }, timberYield])
  })

  const named = { route: 'route_millbrook', partner: 'millbrook', name: 'Millbrook' }
  const raidedBy = { type: 'route_raided', ...named, cause: 'raiders', raider: 'raider', raiderName: 'Nest raider' }

  it('pays nothing raided, counting the run on yield days; the notice comes once, the day it starts', () => {
    const { world, route } = open()
    const raider = nest(world, earlyHex(5, LANE - 1), 'raider')
    // A raid that starts on a yield day: the notice (days 0), then the yield day's count.
    const first = day(world, 5)
    expect(first).toEqual([{ ...raidedBy, days: 0 }, { ...raidedBy, days: 1 }])
    expect(isNotable(world, first[0], [])).toBe(true)
    expect(isNotable(world, first[1], [])).toBe(false)
    for (const turn of [6, 7, 8, 9]) expect(day(world, turn)).toEqual([])
    const second = day(world, 10)
    expect(second).toMatchObject([{ type: 'route_raided', days: 2 }])
    expect(isNotable(world, second[0], [])).toBe(false)
    expect(world.stock).toEqual({})
    expect(route.raidedDays).toBe(2)
    world.locations = world.locations.filter((l) => l !== raider)
    // Restored the day it clears, a yield day here; it pays at once.
    expect(day(world, 15)).toEqual([{ type: 'route_restored', ...named }, goldYield])
    expect(route.raidedDays).toBe(0)
    expect(day(world, 20)).toEqual([goldYield, timberYield])
  })

  it('tells a raid the day the road turns red, between yield days, and its end the day it clears (verification round 2)', () => {
    const { world, route } = open()
    expect(day(world, 2)).toEqual([])
    const raider = nest(world, earlyHex(5, LANE - 1), 'raider')
    const told = day(world, 3)
    expect(told).toEqual([{ ...raidedBy, days: 0 }])
    expect(isNotable(world, told[0], [])).toBe(true)
    expect(route.raided).toBe(true)
    expect(route.raidedDays).toBe(0)
    expect(day(world, 4)).toEqual([])
    expect(day(world, 5)).toEqual([{ ...raidedBy, days: 1 }])
    expect(route.raidedDays).toBe(1)
    world.locations = world.locations.filter((l) => l !== raider)
    const cleared = day(world, 7)
    expect(cleared).toEqual([{ type: 'route_restored', ...named }])
    expect(isNotable(world, cleared[0], [])).toBe(false)
    expect(route.raided).toBe(false)
    expect(day(world, 8)).toEqual([])
    // Told safe, the count starts afresh at once (verification round 3).
    expect(route.raidedDays).toBe(0)
    expect(day(world, 10)).toEqual([goldYield, timberYield])
    expect(route.raidedDays).toBe(0)
    // A raid that starts and ends between yield days is told and its end told, and never counted.
    const again = nest(world, earlyHex(5, LANE - 1), 'raider')
    expect(day(world, 11)).toEqual([{ ...raidedBy, days: 0 }])
    world.locations = world.locations.filter((l) => l !== again)
    expect(day(world, 12)).toEqual([{ type: 'route_restored', ...named }])
    expect(day(world, 15)).toEqual([goldYield])
  })

  it('starts the count afresh once the road is told safe: no abandonment from an older run (verification round 3, the user\'s decision)', () => {
    const { world, route } = open()
    nest(world, earlyHex(5, LANE - 1), 'raider')
    for (const turn of [5, 10, 15, 20, 25]) day(world, turn)
    expect(route.raidedDays).toBe(5)
    world.locations = world.locations.filter((l) => l.id !== 'raider')
    expect(day(world, 26)).toEqual([{ type: 'route_restored', ...named }])
    expect(route.raidedDays).toBe(0)
    nest(world, earlyHex(5, LANE - 1), 'raider')
    expect(day(world, 29)).toEqual([{ ...raidedBy, days: 0 }])
    const thirty = day(world, 30)
    expect(thirty).toEqual([{ ...raidedBy, days: 1 }])
    expect(world.routes).toEqual([route])
  })

  it('tells silence and corruption without a raider', () => {
    const { world, route } = open()
    setHex(world, route.road[2], MAX_BLIGHT)
    const corrupted = day(world, 5)
    expect(corrupted).toMatchObject([{ type: 'route_raided', cause: 'corrupted', days: 0 }, { type: 'route_raided', cause: 'corrupted', days: 1 }])
    expect('raider' in corrupted[0]).toBe(false)
    world.silent.push('millbrook')
    const silent = day(world, 10)
    // Still raided, by another cause now: no new notice.
    expect(silent).toMatchObject([{ type: 'route_raided', cause: 'silent', days: 2 }])
    expect('raider' in silent[0] || 'raiderName' in silent[0]).toBe(false)
  })

  it('abandons a route raided ABANDON_AFTER yield days in a row, freeing its slot', () => {
    const game = newGame(readyMadeParty(), null, 1)
    const { world } = game
    const { route } = (() => {
      contactPartner(world, 'millbrook')
      world.tradingPost = 4
      world.stock = { gold: 100, timber: 20 }
      openRoute(game, game.parties[0], 'millbrook')
      return { route: world.routes[0] }
    })()
    world.silent.push('millbrook')
    for (let k = 1; k < ABANDON_AFTER; k++) {
      const told = day(world, k * YIELD_DAYS)
      expect(told.at(-1)).toMatchObject({ type: 'route_raided', cause: 'silent', days: k })
      expect(told).toHaveLength(k === 1 ? 2 : 1)
    }
    expect(world.routes).toEqual([route])
    const last = day(world, ABANDON_AFTER * YIELD_DAYS)
    expect(last).toEqual([
      { type: 'route_raided', route: 'route_millbrook', partner: 'millbrook', name: 'Millbrook', cause: 'silent', days: ABANDON_AFTER },
      { type: 'route_abandoned', route: 'route_millbrook', partner: 'millbrook', name: 'Millbrook' },
    ])
    expect(isNotable(world, last[1], [])).toBe(true)
    expect(world.routes).toEqual([])
    world.silent = []
    expect(openRouteRefusal(game, game.parties[0], 'millbrook')).toBeNull()
  })

  it('reopens an abandoned route on a road computed afresh', () => {
    const { game, world, party } = trading()
    openRoute(game, party, 'millbrook')
    const old = world.routes[0].road
    world.routes = []
    const middle = old[Math.floor(old.length / 2)]
    nest(world, hexAdd(middle, { q: 0, r: 2 }))
    world.stock = { gold: 100, timber: 20 }
    openRoute(game, party, 'millbrook')
    expect(world.routes[0].road).not.toEqual(old)
    expect(world.routes[0].road).toEqual(roadTo(world, 'millbrook'))
    expect(world.routesOpened).toBe(2)
  })

  it('does nothing once the encampment is lost', () => {
    const { world, route } = open()
    world.status = 'lost'
    nest(world, route.road[0])
    expect(day(world, 5)).toEqual([])
    expect(route.raidedDays).toBe(0)
  })
})
