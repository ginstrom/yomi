import { describe, expect, it } from 'vitest'
import { HexBoard, hexDistance, hexEquals, hexKey, hexToOffset, offsetToHex, type Hex } from '../grid/hex.ts'
import { ENCOUNTERS, MAX_THREAT } from './encounters.ts'
import { readyMadeParty } from './party.ts'
import {
  DEFAULT_ENCAMPMENT_NAME,
  ENCAMPMENT_ID,
  SOURCE_ID,
  THREAT_BAND,
  clearLocation,
  encampmentName,
  linger,
  locationAt,
  monstersHere,
  newWorld,
  routeTo,
  threatAt,
  travel,
  type WorldState,
} from './worldMap.ts'

const monsters = (world: WorldState) => world.locations.filter((l) => l.kind === 'monsters')
/** The monster locations other than the Source. */
const lairs = (world: WorldState) => monsters(world).filter((l) => l.kind === 'monsters' && !l.source)
const party = readyMadeParty()
/** Travels on to `to` however often a sighting stops the party, as a player clicks again. */
function journeyTo(world: WorldState, to: Hex): void {
  for (let tries = 0; tries < 10 && !hexEquals(world.party, to); tries++) travel(world, to, party)
}

describe('newWorld', () => {
  const world = newWorld(1)

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

  it('shows monsters and resources, and no settlement but the encampment', () => {
    expect(new Set(world.locations.map((l) => l.kind))).toEqual(new Set(['monsters', 'encampment', 'resource']))
    expect(world.locations.filter((l) => l.kind === 'encampment').map((l) => l.id)).toEqual([ENCAMPMENT_ID])
  })

  it('names the encampment as the player chose, or Oakvale by default', () => {
    expect(encampmentName(world)).toBe(DEFAULT_ENCAMPMENT_NAME)
    expect(encampmentName(newWorld(1, '  Hearthold '))).toBe('Hearthold')
    expect(encampmentName(newWorld(1, '   '))).toBe(DEFAULT_ENCAMPMENT_NAME)
  })

  it('gives every monster location a battle to fight', () => {
    for (const l of monsters(world)) expect(ENCOUNTERS[l.encounter]).toBeTypeOf('function')
  })

  it('gives every monster location loot of its own, which another world does not share', () => {
    const lairs = monsters(world)
    for (const l of lairs) expect(l.loot.length).toBeGreaterThan(0)
    expect(Object.fromEntries(lairs.map((l) => [l.name, l.loot.map((item) => item.name)]))).toEqual({
      'Goblin Raiders': ['Ring of Protection'],
      'Kobold Scouts': ['Amulet of Focus'],
      'Goblin Reavers': ['Ring of Fortune'],
      'Kobold Trappers': ["Sage's Circlet"],
      'Goblin Warband': ['Ring of Protection'],
      'Kobold Diggers': ['Wand of Sparks'],
      'Kobold Skulkers': ['Cloak of Shadows'],
      'Goblin Marauders': ['Emberblade'],
      'Kobold Lurkers': ['Hawkeye Bow'],
      'Goblin Outriders': ['Wand of Storms'],
      'Kobold Tunnellers': ["Sage's Circlet"],
      'Goblin Pillagers': ['Emberblade'],
      'The Blight Source': ['Wand of Storms'],
    })
    expect(monsters(newWorld(1))[0].loot).not.toBe(lairs[0].loot)
  })

  it('makes monsters the more dangerous the further from home they lie', () => {
    const byDistance = [...lairs(world)].sort((a, b) => hexDistance(world.party, a.position) - hexDistance(world.party, b.position))
    const threats = byDistance.map((l) => l.threat)
    expect(threats).toEqual([...threats].sort((a, b) => a - b))
    expect(threats[0]).toBe(1)
    expect(threats.at(-1)).toBe(MAX_THREAT)
    for (const l of monsters(world)) expect(l.threat).toBe(threatAt(l.position))
  })

  it('starts the party on turn 1, on the map and clear of monsters', () => {
    expect(world.turn).toBe(1)
    expect(new HexBoard(world.board).contains(world.party)).toBe(true)
    expect(monstersHere(world)).toBeNull()
    expect(world.confronting).toBeNull()
  })

  it('puts the Source in the far east, at the top threat', () => {
    const source = monsters(world).find((l) => l.kind === 'monsters' && l.source)!
    expect(source.id).toBe(SOURCE_ID)
    expect(source.threat).toBe(MAX_THREAT)
    expect(source.kind === 'monsters' && source.encounter).toBe('source_guardians')
    expect(hexToOffset(source.position).col).toBeGreaterThan(world.board.cols - 5)
  })
})

describe('travel', () => {
  it('walks a shortest route, a turn a hex', () => {
    const world = newWorld(1)
    // Nothing left to sight on the way.
    world.sighted = monsters(world).map((l) => l.id)
    const from = world.party
    const to = offsetToHex(3, 1)
    const { walked, interruptedBy } = travel(world, to, party)
    expect(interruptedBy).toBeNull()
    expect(walked.length).toBe(hexDistance(from, to))
    expect(hexEquals(walked[walked.length - 1], to)).toBe(true)
    expect(world.party).toEqual(to)
    expect(world.turn).toBe(1 + walked.length)
  })

  it('goes nowhere off the map or to the hex the party stands on', () => {
    const world = newWorld(1)
    const before = structuredClone(world)
    expect(travel(world, offsetToHex(-1, 0), party).walked).toEqual([])
    expect(travel(world, world.party, party).walked).toEqual([])
    expect(world).toEqual(before)
  })

  it('routes around monsters that are not the destination', () => {
    const world = newWorld(1)
    const [goblins] = monsters(world)
    // Straight through the goblins' hex, along their row.
    world.party = { q: goblins.position.q - 2, r: goblins.position.r }
    const route = routeTo(world, { q: goblins.position.q + 2, r: goblins.position.r })!
    expect(route.some((h) => hexEquals(h, goblins.position))).toBe(false)
    expect(route.length).toBe(5)
  })

  it('passes over resources without stopping', () => {
    const world = newWorld(1)
    const resource = world.locations.find((l) => l.kind === 'resource')!
    journeyTo(world, resource.position)
    expect(world.confronting).toBeNull()
    expect(routeTo(world, offsetToHex(0, 0))).not.toBeNull()
  })
})

describe('a monster location', () => {
  function arrive(): { world: WorldState; id: string } {
    const world = newWorld(1)
    const [goblins] = monsters(world)
    journeyTo(world, goblins.position)
    return { world, id: goblins.id }
  }

  it('confronts the party when it arrives, holding it there', () => {
    const { world, id } = arrive()
    expect(monstersHere(world)?.id).toBe(id)
    expect(world.confronting).toBe(id)
    expect(routeTo(world, offsetToHex(0, 0))).toBeNull()
    expect(travel(world, offsetToHex(0, 0), party).walked).toEqual([])
  })

  it.each(['scout', 'wait'] as const)('lets the party %s for a turn, then move away or choose again', (how) => {
    const { world, id } = arrive()
    const turn = world.turn
    expect(linger(world, how, party)).not.toBeNull()
    expect(world.turn).toBe(turn + 1)
    // Still there to scout, wait at or attack...
    expect(monstersHere(world)?.id).toBe(id)
    expect(linger(world, how, party)).not.toBeNull()
    // ...and free to leave.
    expect(travel(world, offsetToHex(0, 0), party).walked.length).toBeGreaterThan(0)
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
    const world = newWorld(1)
    expect(linger(world, 'wait', party)).toBeNull()
    expect(world.turn).toBe(1)
  })
})

describe('threatAt', () => {
  const home = newWorld(1).party

  it('is 1 at home, a step higher each band out, and never past the top', () => {
    expect(threatAt(home)).toBe(1)
    expect(threatAt({ q: home.q + THREAT_BAND - 1, r: home.r })).toBe(1)
    expect(threatAt({ q: home.q + THREAT_BAND, r: home.r })).toBe(2)
    expect(threatAt({ q: home.q + THREAT_BAND * 2, r: home.r })).toBe(3)
    expect(threatAt({ q: home.q + THREAT_BAND * 50, r: home.r })).toBe(MAX_THREAT)
  })
})
