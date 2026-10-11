import { describe, expect, it } from 'vitest'
import { HexBoard, hexDistance, hexEquals, hexKey, hexToOffset, offsetToHex } from '../grid/hex.ts'
import { ENCOUNTERS } from './encounters.ts'
import { clearLocation, linger, locationAt, monstersHere, newWorld, routeTo, travel, type WorldState } from './worldMap.ts'

const monsters = (world: WorldState) => world.locations.filter((l) => l.kind === 'monsters')

describe('newWorld', () => {
  const world = newWorld()

  it('puts every location on its own hex of the map', () => {
    const board = new HexBoard(world.board)
    for (const l of world.locations) expect(board.contains(l.position)).toBe(true)
    expect(new Set(world.locations.map((l) => hexKey(l.position))).size).toBe(world.locations.length)
    expect(new Set(world.locations.map((l) => l.id)).size).toBe(world.locations.length)
  })

  it('is larger than a window shows, with locations out to every side', () => {
    expect(world.board.cols).toBeGreaterThanOrEqual(48)
    expect(world.board.rows).toBeGreaterThanOrEqual(30)
    const cols = world.locations.map((l) => hexToOffset(l.position).col)
    const rows = world.locations.map((l) => hexToOffset(l.position).row)
    expect(Math.max(...cols) - Math.min(...cols)).toBeGreaterThan(world.board.cols / 2)
    expect(Math.max(...rows) - Math.min(...rows)).toBeGreaterThan(world.board.rows / 2)
  })

  it('leaves room to walk around every monster location', () => {
    const lairs = monsters(world)
    for (const a of lairs) for (const b of lairs) if (a !== b) expect(hexDistance(a.position, b.position)).toBeGreaterThan(2)
  })

  it('shows monsters, towns and resources', () => {
    expect(new Set(world.locations.map((l) => l.kind))).toEqual(new Set(['monsters', 'town', 'resource']))
  })

  it('gives every monster location a battle to fight', () => {
    for (const l of monsters(world)) expect(ENCOUNTERS[l.encounter]).toBeTypeOf('function')
  })

  it('starts the party on turn 1, on the map and clear of monsters', () => {
    expect(world.turn).toBe(1)
    expect(new HexBoard(world.board).contains(world.party)).toBe(true)
    expect(monstersHere(world)).toBeNull()
    expect(world.confronting).toBeNull()
  })
})

describe('travel', () => {
  it('walks a shortest route, a turn a hex', () => {
    const world = newWorld()
    const from = world.party
    const to = offsetToHex(3, 1)
    const walked = travel(world, to)
    expect(walked.length).toBe(hexDistance(from, to))
    expect(hexEquals(walked[walked.length - 1], to)).toBe(true)
    expect(world.party).toEqual(to)
    expect(world.turn).toBe(1 + walked.length)
  })

  it('goes nowhere off the map or to the hex the party stands on', () => {
    const world = newWorld()
    const before = structuredClone(world)
    expect(travel(world, offsetToHex(-1, 0))).toEqual([])
    expect(travel(world, world.party)).toEqual([])
    expect(world).toEqual(before)
  })

  it('routes around monsters that are not the destination', () => {
    const world = newWorld()
    const [goblins] = monsters(world)
    // Straight through the goblins' hex, along their row.
    world.party = { q: goblins.position.q - 2, r: goblins.position.r }
    const route = routeTo(world, { q: goblins.position.q + 2, r: goblins.position.r })!
    expect(route.some((h) => hexEquals(h, goblins.position))).toBe(false)
    expect(route.length).toBe(5)
  })

  it('passes over towns and resources without stopping', () => {
    const world = newWorld()
    const town = world.locations.find((l) => l.kind === 'town')!
    travel(world, town.position)
    expect(world.confronting).toBeNull()
    expect(routeTo(world, offsetToHex(0, 0))).not.toBeNull()
  })
})

describe('a monster location', () => {
  function arrive(): { world: WorldState; id: string } {
    const world = newWorld()
    const [goblins] = monsters(world)
    travel(world, goblins.position)
    return { world, id: goblins.id }
  }

  it('confronts the party when it arrives, holding it there', () => {
    const { world, id } = arrive()
    expect(monstersHere(world)?.id).toBe(id)
    expect(world.confronting).toBe(id)
    expect(routeTo(world, offsetToHex(0, 0))).toBeNull()
    expect(travel(world, offsetToHex(0, 0))).toEqual([])
  })

  it.each(['scout', 'wait'] as const)('lets the party %s for a turn, then move away or choose again', (how) => {
    const { world, id } = arrive()
    const turn = world.turn
    expect(linger(world, how)).toBe(true)
    expect(world.turn).toBe(turn + 1)
    // Still there to scout, wait at or attack...
    expect(monstersHere(world)?.id).toBe(id)
    expect(linger(world, how)).toBe(true)
    // ...and free to leave.
    expect(travel(world, offsetToHex(0, 0)).length).toBeGreaterThan(0)
    expect(monstersHere(world)).toBeNull()
  })

  it('is gone from the map once cleared, freeing the party', () => {
    const { world, id } = arrive()
    const at = world.party
    clearLocation(world, id)
    expect(locationAt(world, at)).toBeNull()
    expect(world.confronting).toBeNull()
    expect(routeTo(world, offsetToHex(0, 0))).not.toBeNull()
  })
})

describe('linger', () => {
  it('does nothing away from monsters', () => {
    const world = newWorld()
    expect(linger(world, 'wait')).toBe(false)
    expect(world.turn).toBe(1)
  })
})
