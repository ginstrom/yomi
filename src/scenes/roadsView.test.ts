import { describe, expect, it } from 'vitest'
import { boardIndex } from '../game/blight.ts'
import { newGame } from '../game/gameState.ts'
import { readyMadeParty } from '../game/party.ts'
import type { PartyPresence } from '../game/expedition.ts'
import { roadTo, type TradeRoute } from '../game/trade.ts'
import { encampment, type MonsterLocation, type PartnerLocation, type WorldState } from '../game/worldMap.ts'
import { offsetToHex, type Hex } from '../grid/hex.ts'
import { ROAD_COLORS, partnerInfoLines, raidWords, roadInfoLines, roadSegments } from './roadsView.ts'

/** A world with Millbrook contacted and a route open to it. */
function routed() {
  const world = newGame(readyMadeParty(), null, 1).world
  world.contacted.push('millbrook')
  const road = roadTo(world, 'millbrook')!
  const route: TradeRoute = { id: 'route_millbrook', partner: 'millbrook', road, opened: 1, raidedDays: 0 }
  world.routes.push(route)
  const partner = world.locations.find((l): l is PartnerLocation => l.id === 'millbrook')!
  return { world, road, route, partner }
}

function setBlight(world: WorldState, at: Hex, level: number) {
  world.blight[boardIndex(world.board, at)] = level
}

function clear(world: WorldState, road: Hex[]) {
  for (const h of road) setBlight(world, h, 0)
  // No nest near the road.
  world.locations = world.locations.filter((l) => l.kind !== 'monsters')
}

const nest = (at: Hex, name = 'Goblin Brood'): MonsterLocation => ({
  id: 'nest', kind: 'monsters', name, position: at, encounter: 'goblin_patrol' as never, threat: 2, loot: [],
})

describe('roadSegments', () => {
  it('starts at the encampment and follows the road, all secure on clean land', () => {
    const { world, road } = routed()
    clear(world, road)
    const segs = roadSegments(world, [])
    expect(segs).toHaveLength(road.length)
    expect(segs[0].from).toEqual(encampment(world).position)
    segs.forEach((s, i) => {
      expect(s.to).toEqual(road[i])
      if (i > 0) expect(s.from).toEqual(road[i - 1])
      expect(s.shade).toBe('secure')
      expect(s.route).toBe('route_millbrook')
    })
  })

  it('shades a tainted hex amber, and a guard turns it gold again', () => {
    const { world, road } = routed()
    clear(world, road)
    setBlight(world, road[3], 1)
    expect(roadSegments(world, []).map((s) => s.shade)[3]).toBe('tainted')
    expect(roadSegments(world, []).filter((s) => s.shade !== 'secure')).toHaveLength(1)
    world.towers.push({ id: 'tower_1', position: road[4] })
    expect(roadSegments(world, [])[3].shade).toBe('secure')
    world.towers.length = 0
    const presence = { position: road[2] } as PartyPresence
    expect(roadSegments(world, [presence])[3].shade).toBe('secure')
  })

  it('shades an unguarded blighted hex red for that segment only', () => {
    const { world, road } = routed()
    clear(world, road)
    setBlight(world, road[3], 2)
    const shades = roadSegments(world, []).map((s) => s.shade)
    expect(shades[3]).toBe('raided')
    expect(shades.filter((s) => s === 'raided')).toHaveLength(1)
  })

  it('turns the whole road red for a nest near, a corrupted hex or a silent partner', () => {
    const near = routed()
    clear(near.world, near.road)
    near.world.locations.push(nest(offsetToHexNear(near.road[5])))
    expect(new Set(roadSegments(near.world, []).map((s) => s.shade))).toEqual(new Set(['raided']))

    const corrupt = routed()
    clear(corrupt.world, corrupt.road)
    setBlight(corrupt.world, corrupt.road[2], 3)
    expect(new Set(roadSegments(corrupt.world, []).map((s) => s.shade))).toEqual(new Set(['raided']))

    const silent = routed()
    clear(silent.world, silent.road)
    silent.world.silent.push('millbrook')
    expect(new Set(roadSegments(silent.world, []).map((s) => s.shade))).toEqual(new Set(['raided']))
  })

  it('is empty with no route, and has three distinct colours', () => {
    expect(roadSegments(newGame(readyMadeParty(), null, 1).world, [])).toEqual([])
    expect(new Set(Object.values(ROAD_COLORS)).size).toBe(3)
  })
})

/** A hex one step off `h` (within raid range). */
function offsetToHexNear(h: Hex): Hex {
  return { q: h.q + 1, r: h.r }
}

describe('roadSegments draw order (verification round 1)', () => {
  it('lists a raided route first, so a paying road is drawn over a shared stretch', () => {
    const { world, road } = routed()
    clear(world, road)
    world.contacted.push('saltmere')
    const salt = roadTo(world, 'saltmere')!
    clear(world, salt)
    world.routes.push({ id: 'route_saltmere', partner: 'saltmere', road: salt, opened: 1, raidedDays: 0 })
    // The second route, Saltmere's, is raided (silent); Millbrook's pays.
    world.silent.push('saltmere')
    const segs = roadSegments(world, [])
    const lastRaided = segs.map((s) => s.route).lastIndexOf('route_saltmere')
    const firstPaying = segs.map((s) => s.route).indexOf('route_millbrook')
    expect(lastRaided).toBeLessThan(firstPaying)
    expect(segs.filter((s) => s.route === 'route_saltmere').every((s) => s.shade === 'raided')).toBe(true)
    // With nothing raided, the routes keep their order.
    world.silent.length = 0
    expect(roadSegments(world, [])[0].route).toBe('route_millbrook')
  })
})

describe('roadInfoLines', () => {
  it('tells security and income from towers only, and nothing off the road', () => {
    const { world, road } = routed()
    clear(world, road)
    setBlight(world, road[0], 1)
    const lines = roadInfoLines(world, [], road[1])
    expect(lines).toHaveLength(1)
    expect(lines[0]).toMatch(/^The Millbrook road: security \d+%, about \d+ gold every 5 days\.$/)
    const guard = { position: road[0] } as PartyPresence
    expect(roadInfoLines(world, [guard], road[1])).toEqual(lines)
    expect(roadInfoLines(world, [], offsetToHex(0, 0))).toEqual([])
  })

  it('says 100% on a clean road', () => {
    const { world, road } = routed()
    clear(world, road)
    expect(roadInfoLines(world, [], road[0])[0]).toContain('security 100%')
  })

  it('tells the raid and its cause', () => {
    const { world, road } = routed()
    clear(world, road)
    world.locations.push(nest(offsetToHexNear(road[5])))
    world.sighted.push('nest')
    expect(roadInfoLines(world, [], road[0])).toEqual([
      expect.stringMatching(/^The Millbrook road: security \d+%, pays nothing while raided\.$/),
      'Raided: the Goblin Brood is within 2 hexes.',
    ])
    world.silent.push('millbrook')
    expect(roadInfoLines(world, [], road[0]).at(-1)).toBe('Raided: Millbrook is silent.')
  })
})

describe('roadInfoLines and an unsighted raider (verification round 1)', () => {
  it('tells the raid without naming a nest the player has not sighted', () => {
    const { world, road } = routed()
    clear(world, road)
    world.locations.push(nest(offsetToHexNear(road[5])))
    const lines = roadInfoLines(world, [], road[0])
    expect(lines.at(-1)).toBe('Raided: raiders are within 2 hexes.')
    expect(lines.join(' ')).not.toContain('Goblin Brood')
  })
})

describe('raidWords', () => {
  const { partner } = routed()
  it('words each cause, with a plural nest name', () => {
    expect(raidWords({ cause: 'raiders', raider: nest({ q: 0, r: 0 }) }, partner)).toBe('the Goblin Brood is within 2 hexes')
    expect(raidWords({ cause: 'raiders', raider: nest({ q: 0, r: 0 }, 'Goblin Raiders') }, partner)).toBe('the Goblin Raiders are within 2 hexes')
    expect(raidWords({ cause: 'corrupted' }, partner)).toBe('the blight has overrun it')
    expect(raidWords({ cause: 'silent' }, partner)).toBe('Millbrook is silent')
  })
})

describe('partnerInfoLines', () => {
  it('tells uncontacted, contacted, silent and routed partners', () => {
    const world = newGame(readyMadeParty(), null, 1).world
    const partner = world.locations.find((l): l is PartnerLocation => l.id === 'millbrook')!
    expect(partnerInfoLines(world, partner)).toEqual(['Trade partner: timber.', 'Not yet contacted: walk here to trade.'])
    world.contacted.push('millbrook')
    const home = encampment(world).name
    expect(partnerInfoLines(world, partner)).toEqual(['Trade partner: timber.', `Trades with ${home}.`])
    world.silent.push('millbrook')
    expect(partnerInfoLines(world, partner)).toContain('Silent while the blight holds its land.')
    world.silent.length = 0
    // An uncontacted partner's silence is told only while in sight.
    world.contacted.length = 0
    world.silent.push('millbrook')
    expect(partnerInfoLines(world, partner, false)).not.toContain('Silent while the blight holds its land.')
    expect(partnerInfoLines(world, partner, true)).toContain('Silent while the blight holds its land.')
    world.contacted.push('millbrook')
    expect(partnerInfoLines(world, partner, false)).toContain('Silent while the blight holds its land.')
    world.silent.length = 0
    const road = roadTo(world, 'millbrook')!
    clear(world, road)
    world.routes.push({ id: 'route_millbrook', partner: 'millbrook', road, opened: 1, raidedDays: 0 })
    expect(partnerInfoLines(world, partner).at(-1)).toBe('Route open: security 100%.')
  })
})
