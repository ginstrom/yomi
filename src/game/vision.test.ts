import { describe, expect, it } from 'vitest'
import { hexDistance, hexEquals, offsetToHex } from '../grid/hex.ts'
import { boardHex, boardIndex } from './blight.ts'
import { soloPresences, type PartyPresence } from './expedition.ts'
import { readyMadeParty } from './party.ts'
import { CAMP_VISION, PARTY_VISION, UNEXPLORED, knownBlightedShare, updateSight, visibleHexes } from './vision.ts'
import {
  ENCAMPMENT_ID,
  NOTICE_RADIUS,
  SOURCE_ID,
  clearLocation,
  isNotable,
  newWorld,
  passTurn,
  routeTo,
  travel,
  type MonsterLocation,
  type WorldState,
} from './worldMap.ts'

const party = readyMadeParty()
const at = (world: WorldState, id: string) => world.locations.find((l) => l.id === id)!.position
const seenAt = (world: WorldState, h: { q: number; r: number }) => world.seen[boardIndex(world.board, h)]

/** A threat-1 nest the player has not seen, put down at `col`, `row`. */
function hiddenNest(world: WorldState, col: number, row: number): MonsterLocation {
  const nest: MonsterLocation = {
    id: 'hidden',
    kind: 'monsters',
    name: 'Hidden Nest',
    position: offsetToHex(col, row),
    encounter: 'goblin_raid',
    threat: 1,
    loot: [],
  }
  world.locations.push(nest)
  return nest
}

describe('a new world', () => {
  const world = newWorld(1)

  it('knows the home valley and nothing beyond, not even the Source', () => {
    const home = at(world, ENCAMPMENT_ID)
    for (let i = 0; i < world.seen.length; i++) {
      if (hexDistance(home, boardHex(world.board, i)) <= CAMP_VISION) expect(world.seen[i]).toBe(world.blight[i])
    }
    expect(seenAt(world, at(world, SOURCE_ID))).toBe(UNEXPLORED)
    expect(world.sighted).not.toContain(SOURCE_ID)
    expect(world.sighted).toContain('goblin_raiders')
    expect(seenAt(world, offsetToHex(40, 2))).toBe(UNEXPLORED)
    expect(world.sighted).not.toContain('spider_nest')
  })

  it('counts the blighted share over the land explored only', () => {
    const explored = world.seen.filter((level) => level !== UNEXPLORED)
    expect(knownBlightedShare(world)).toBe(explored.filter((level) => level >= 2).length / explored.length)
  })
})

describe('sight', () => {
  it('reveals the land within sight of the party as it travels', () => {
    const world = newWorld(1)
    const far = offsetToHex(9, 31)
    expect(seenAt(world, far)).toBe(UNEXPLORED)
    for (let tries = 0; tries < 10 && !hexEquals(world.party, far); tries++) travel(world, far, party)
    for (const i of visibleHexes(world, soloPresences(world, party))) expect(world.seen[i]).toBe(world.blight[i])
    for (let i = 0; i < world.seen.length; i++) {
      if (hexDistance(far, boardHex(world.board, i)) <= PARTY_VISION) expect(visibleHexes(world, soloPresences(world, party)).has(i)).toBe(true)
    }
  })

  it('remembers land out of sight as it was last seen, while the blight changes underneath', () => {
    const world = newWorld(1)
    const source = boardIndex(world.board, at(world, SOURCE_ID))
    const neighbour = source - 1
    world.seen[neighbour] = 0
    world.blight[neighbour] = 3
    passTurn(world, soloPresences(world, party))
    expect(world.seen[neighbour]).toBe(0)
  })

  it('tells of a nest only when it comes into sight, and stops a journey for it nearby', () => {
    const world = newWorld(1)
    world.sighted = world.locations.filter((l) => l.kind === 'monsters').map((l) => l.id)
    const nest = hiddenNest(world, 9, 29)
    expect(updateSight(world, soloPresences(world, party))).toEqual([])
    const journey = travel(world, offsetToHex(9, 34), party)
    expect(journey.interruptedBy).toMatchObject({ type: 'sighted', location: nest.id })
    expect(hexDistance(world.party, nest.position)).toBe(PARTY_VISION)
    expect(world.sighted).toContain(nest.id)
    expect(isNotable(world, journey.interruptedBy!, soloPresences(world, party))).toBe(true)
    expect(isNotable(world, { type: 'sighted', location: 'x', name: 'x', at: offsetToHex(50, 2), threat: 1 }, soloPresences(world, party))).toBe(false)
    expect(isNotable(world, { type: 'spawned', location: 'x', name: 'x', at: world.party, threat: 1 }, soloPresences(world, party))).toBe(false)
    expect(NOTICE_RADIUS).toBeGreaterThanOrEqual(PARTY_VISION)
  })

  it('finds the Source by exploring, and stops for it however far off it is sighted', () => {
    const world = newWorld(1)
    const source = at(world, SOURCE_ID)
    world.party = { q: source.q - PARTY_VISION, r: source.r }
    const events = updateSight(world, soloPresences(world, party))
    const found = events.find((e) => e.type === 'sighted' && e.location === SOURCE_ID)
    expect(found).toMatchObject({ type: 'sighted', source: true })
    expect(world.sighted).toContain(SOURCE_ID)
    world.party = offsetToHex(9, 19)
    expect(hexDistance(world.party, source)).toBeGreaterThan(NOTICE_RADIUS)
    expect(isNotable(world, found!, soloPresences(world, party))).toBe(true)
  })

  it('routes through an unsighted nest, and around it once sighted', () => {
    const world = newWorld(1)
    world.party = offsetToHex(30, 2)
    const nest = hiddenNest(world, 32, 2)
    const to = offsetToHex(34, 2)
    expect(routeTo(world, to)!.some((h) => hexEquals(h, nest.position))).toBe(true)
    world.sighted.push(nest.id)
    expect(routeTo(world, to)!.some((h) => hexEquals(h, nest.position))).toBe(false)
  })

  it('forgets a beaten location, and sees the land its fall cleansed', () => {
    const world = newWorld(1)
    clearLocation(world, 'goblin_raiders', soloPresences(world, party))
    expect(world.sighted).not.toContain('goblin_raiders')
    for (const i of visibleHexes(world, soloPresences(world, party))) expect(world.seen[i]).toBe(world.blight[i])
  })

  it('plays out the same from the same seed', () => {
    const a = newWorld(5)
    const b = newWorld(5)
    for (const world of [a, b]) {
      for (let tries = 0; tries < 10 && !hexEquals(world.party, offsetToHex(30, 20)); tries++) travel(world, offsetToHex(30, 20), party)
    }
    expect(a.seen).toEqual(b.seen)
    expect(a.sighted).toEqual(b.sighted)
  })
})

/** Today's sight, pinned before the world's rules took a list of parties (stage 5 step 02). Only the parties' argument may change. */
describe('the sight of one party, pinned', () => {
  it('sees the same hexes and sights the same nest', () => {
    const world = newWorld(1)
    world.party = { q: 20, r: 12 }
    const visible = visibleHexes(world, soloPresences(world, party))
    expect(visible.size).toBe(230)
    const has = (q: number, r: number) => visible.has(boardIndex(world.board, { q, r }))
    expect([has(20, 12), has(25, 12), has(26, 12), has(20, 7), has(20, 6)]).toEqual([true, true, false, true, false])
    expect(updateSight(world, soloPresences(world, party))).toEqual([
      { type: 'sighted', location: 'hobgoblin_warband', name: 'Hobgoblin Warband', at: { q: 19, r: 10 }, threat: 2 },
    ])
  })
})

describe('the sight of several parties', () => {
  it('is the union of what each sees', () => {
    const world = newWorld(1)
    const a: PartyPresence = { position: offsetToHex(20, 12), levels: [1] }
    const b: PartyPresence = { position: offsetToHex(40, 30), levels: [] }
    const both = visibleHexes(world, [a, b])
    const union = new Set([...visibleHexes(world, [a]), ...visibleHexes(world, [b])])
    expect(both).toEqual(union)
    for (const p of [a, b]) expect(both.has(boardIndex(world.board, { q: p.position.q + PARTY_VISION, r: p.position.r }))).toBe(true)
    expect(visibleHexes(world, [a]).has(boardIndex(world.board, b.position))).toBe(false)
  })

  it('sights what either party comes within sight of', () => {
    const world = newWorld(1)
    world.sighted = world.locations.filter((l) => l.kind === 'monsters').map((l) => l.id)
    const nest = hiddenNest(world, 40, 30)
    const home: PartyPresence = { position: offsetToHex(9, 19), levels: [] }
    expect(updateSight(world, [home])).toEqual([])
    const events = updateSight(world, [home, { position: offsetToHex(42, 30), levels: [] }])
    expect(events).toEqual([{ type: 'sighted', location: nest.id, name: nest.name, at: nest.position, threat: 1 }])
  })
})
