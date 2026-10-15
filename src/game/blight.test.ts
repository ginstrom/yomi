import { describe, expect, it } from 'vitest'
import { hexDistance, hexNeighbors, offsetToHex, type Hex } from '../grid/hex.ts'
import {
  CLEANSE_LEVELS,
  MAX_BLIGHT,
  MAX_MONSTER_LOCATIONS,
  SHIFT_COST,
  SPAWN_CLEARANCE,
  SPAWN_COST,
  blightAt,
  blightGrowth,
  boardHex,
  boardIndex,
  netInfluence,
  partyStrength,
  type WorldEvent,
} from './blight.ts'
import { readyMadeParty } from './party.ts'
import {
  ENCAMPMENT_ID,
  SOURCE_ID,
  THREAT_BAND,
  clearLocation,
  newWorld,
  passTurn,
  threatAt,
  type MonsterLocation,
  type WorldState,
} from './worldMap.ts'

const party = readyMadeParty()
const lairs = (world: WorldState) => world.locations.filter((l): l is MonsterLocation => l.kind === 'monsters')
const setLevel = (world: WorldState, h: Hex, level: number) => (world.blight[boardIndex(world.board, h)] = level)
const days = (world: WorldState, n: number, who: readonly { level: number }[] = party): WorldEvent[] =>
  Array.from({ length: n }, () => passTurn(world, who)).flat()

describe('blightGrowth', () => {
  it('rises a tenth every 30 days, to half again at day 151, and no further', () => {
    expect(blightGrowth(1)).toBe(1)
    expect(blightGrowth(30)).toBe(1)
    expect(blightGrowth(31)).toBeCloseTo(1.1)
    expect(blightGrowth(151)).toBeCloseTo(1.5)
    expect(blightGrowth(10_000)).toBeCloseTo(1.5)
  })
})

describe('partyStrength', () => {
  it('is 2 and half the party’s levels together, rounded down', () => {
    expect(partyStrength(readyMadeParty())).toBe(3)
    expect(partyStrength([{ level: 5 }, { level: 5 }, { level: 5 }])).toBe(9)
  })
})

describe('boardIndex', () => {
  it('finds every hex its own place, and back', () => {
    const { board } = newWorld(1)
    for (const i of [0, 1, board.cols, board.cols * board.rows - 1]) expect(boardIndex(board, boardHex(board, i))).toBe(i)
  })
})

describe('a new world', () => {
  const world = newWorld(1)
  const home = world.locations.find((l) => l.id === ENCAMPMENT_ID)!.position

  it('starts with the land tainted, home clean and the east consumed', () => {
    expect(world.blight.every((level) => level >= 0 && level <= MAX_BLIGHT)).toBe(true)
    expect(blightAt(world, home)).toBe(0)
    expect(blightAt(world, lairs(world).find((l) => l.id === SOURCE_ID)!.position)).toBe(MAX_BLIGHT)
    expect(world.blight.filter((level) => level >= 1).length).toBeGreaterThan(world.blight.length / 2)
  })

  it('has monsters’ own hexes at blighted or worse', () => {
    for (const l of lairs(world)) expect(blightAt(world, l.position)).toBeGreaterThanOrEqual(2)
  })
})

describe('the contest', () => {
  it('raises a hex the blight is winning by a level once its counter reaches SHIFT_COST', () => {
    const world = newWorld(1)
    const source = lairs(world).find((l) => l.id === SOURCE_ID)!
    const at = { q: source.position.q - 3, r: source.position.r }
    setLevel(world, at, 0)
    const net = netInfluence(world, party, at)
    expect(net).toBeGreaterThan(0)
    days(world, Math.ceil(SHIFT_COST / net) - 1)
    expect(blightAt(world, at)).toBe(0)
    days(world, 1)
    expect(blightAt(world, at)).toBe(1)
  })

  it('lowers a hex the clean side is winning, and leaves a quiet one be', () => {
    const world = newWorld(1)
    const home = world.locations.find((l) => l.id === ENCAMPMENT_ID)!.position
    const near = { q: home.q + 1, r: home.r }
    setLevel(world, near, 1)
    expect(netInfluence(world, party, near)).toBeLessThan(0)
    days(world, SHIFT_COST)
    expect(blightAt(world, near)).toBe(0)
  })

  it('keeps monsters’ hexes at blighted or worse, whatever stands against them', () => {
    const world = newWorld(1)
    const [raiders] = lairs(world)
    world.party = hexNeighbors(raiders.position)[0]
    days(world, 60, [{ level: 30 }, { level: 30 }, { level: 30 }])
    expect(blightAt(world, raiders.position)).toBeGreaterThanOrEqual(2)
  })

  it('never raises the party’s own hex, which its influence slowly turns', () => {
    const world = newWorld(1)
    const source = lairs(world).find((l) => l.id === SOURCE_ID)!
    const camp = { q: source.position.q - 8, r: source.position.r }
    world.party = camp
    setLevel(world, camp, 1)
    for (const n of hexNeighbors(camp)) setLevel(world, n, 0)
    const events = days(world, SHIFT_COST)
    expect(events.some((e) => e.type === 'level_changed' && hexDistance(e.at, camp) === 1 && e.to > e.from)).toBe(true)
    expect(blightAt(world, camp)).toBe(0)
  })

  it('plays out the same from the same seed', () => {
    const a = newWorld(7)
    const b = newWorld(7)
    days(a, 120)
    days(b, 120)
    expect(a).toEqual(b)
  })
})

describe('spawning', () => {
  it('puts a monster location on corrupted land, clear of the party and the rest, at the threat of where it lies', () => {
    const world = newWorld(1)
    world.spawnPressure = SPAWN_COST
    const spawned = days(world, 1).find((e) => e.type === 'spawned')
    expect(spawned).toBeDefined()
    const location = lairs(world).at(-1)!
    expect(spawned).toMatchObject({ location: location.id, threat: threatAt(location.position) })
    expect(blightAt(world, location.position)).toBe(MAX_BLIGHT)
    for (const other of [world.party, ...lairs(world).slice(0, -1).map((l) => l.position)]) {
      expect(hexDistance(other, location.position)).toBeGreaterThanOrEqual(SPAWN_CLEARANCE)
    }
    expect(world.spawnPressure).toBeLessThan(SPAWN_COST)
  })

  it('stops at MAX_MONSTER_LOCATIONS', () => {
    const world = newWorld(1)
    for (let i = 0; i < 200; i++) {
      world.spawnPressure = SPAWN_COST
      passTurn(world, party)
    }
    expect(lairs(world).length).toBe(MAX_MONSTER_LOCATIONS)
  })

  it('leaves a party that waits at home a threat-1 nest to fight, however long it waits', () => {
    const world = newWorld(3)
    days(world, 400)
    expect(world.status).toBe('playing')
    const home = world.locations.find((l) => l.id === ENCAMPMENT_ID)!.position
    const near = lairs(world).filter((l) => hexDistance(home, l.position) < THREAT_BAND)
    expect(near.length).toBeGreaterThan(0)
    expect(near.every((l) => l.threat === 1)).toBe(true)
  })
})

describe('clearLocation', () => {
  it('cleanses the land within 1 + threat of a beaten location by two levels', () => {
    const world = newWorld(1)
    const lair = lairs(world).find((l) => l.threat === 3)!
    const before = world.blight.slice()
    clearLocation(world, lair.id)
    world.blight.forEach((level, i) => {
      const h = boardHex(world.board, i)
      const near = hexDistance(h, lair.position) <= 1 + lair.threat
      const pinned = lairs(world).some((l) => l.position.q === h.q && l.position.r === h.r)
      expect(level).toBe(near && !pinned ? Math.max(0, before[i] - CLEANSE_LEVELS) : before[i])
    })
  })

  it('wins the game when the Source is beaten', () => {
    const world = newWorld(1)
    clearLocation(world, lairs(world)[0].id)
    expect(world.status).toBe('playing')
    clearLocation(world, SOURCE_ID)
    expect(world.status).toBe('won')
    world.status = 'endless'
    expect(days(world, 1)).toBeDefined()
    expect(world.status).toBe('endless')
  })
})

describe('blightAt', () => {
  it('is 0 off the map', () => {
    expect(blightAt(newWorld(1), offsetToHex(-1, 0))).toBe(0)
  })
})
