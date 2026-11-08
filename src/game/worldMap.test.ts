import { describe, expect, it } from 'vitest'
import { HexBoard, hexDistance, hexEquals, hexKey, hexToOffset, offsetToHex, type Hex } from '../grid/hex.ts'
import { ENCOUNTERS, ENCOUNTER_BANDS, MAX_THREAT } from './encounters.ts'
import type { PartyPresence } from './expedition.ts'
import { leader, newGame, type GameState } from './gameState.ts'
import { readyMadeParty } from './party.ts'
import {
  DEFAULT_ENCAMPMENT_NAME,
  ENCAMPMENT_ID,
  NOTICE_RADIUS,
  SOURCE_ID,
  THREAT_BAND,
  clearLocation,
  encampment,
  encampmentName,
  isNotable,
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
/** A new game on world 1: the game, its world and its one party. */
function fresh() {
  const game = newGame(readyMadeParty(), null, 1)
  return { game, world: game.world, party: leader(game) }
}
/** Travels on to `to` however often a sighting stops the party, as a player clicks again. */
function journeyTo(game: GameState, to: Hex): void {
  const party = leader(game)
  for (let tries = 0; tries < 10 && !hexEquals(party.position, to); tries++) travel(game, party, to)
}

describe('newWorld', () => {
  const { world, party } = fresh()

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

  it('sets every monster location at a threat its encounter band holds', () => {
    for (const l of monsters(world)) {
      const band = ENCOUNTER_BANDS[l.encounter]
      expect(l.threat, l.name).toBeGreaterThanOrEqual(band.min)
      expect(l.threat, l.name).toBeLessThanOrEqual(band.max)
    }
  })

  it('has bandits at the Bandit Camp, threat 3, and the Bandit Hideout, threat 4', () => {
    const camps = monsters(world).filter((l) => l.encounter === 'bandit_camp')
    expect(camps.map((l) => [l.id, l.name, l.threat])).toEqual([
      ['bandit_camp', 'Bandit Camp', 3],
      ['bandit_hideout', 'Bandit Hideout', 4],
    ])
  })

  it('has the Salamander Pool and the Spider Nest at threat 5, where the Troll Den and the Goblin Pillagers were', () => {
    const at = (id: string) => monsters(world).find((l) => l.id === id)!
    expect([at('salamander_pool').position, at('salamander_pool').encounter, at('salamander_pool').threat]).toEqual([
      offsetToHex(54, 28),
      'salamander_pool',
      5,
    ])
    expect([at('spider_nest').position, at('spider_nest').encounter, at('spider_nest').threat]).toEqual([offsetToHex(57, 10), 'spider_nest', 5])
    expect(world.locations.map((l) => l.id)).not.toContain('troll_den')
    expect(world.locations.map((l) => l.id)).not.toContain('goblin_pillagers')
  })

  it('gives every monster location loot of its own, which another world does not share', () => {
    const lairs = monsters(world)
    for (const l of lairs) expect(l.loot.length).toBeGreaterThan(0)
    expect(Object.fromEntries(lairs.map((l) => [l.name, l.loot.map((item) => item.name)]))).toEqual({
      'Goblin Raiders': ['Ring of Protection'],
      'Kobold Scouts': ['Amulet of Focus'],
      'Goblin Reavers': ['Ring of Fortune'],
      'Kobold Trappers': ["Sage's Circlet"],
      'Hobgoblin Warband': ['Ring of Protection'],
      'Kobold Diggers': ['Wand of Sparks'],
      'Bandit Camp': ['Cloak of Shadows'],
      'Goblin Marauders': ['Emberblade'],
      'Troll Lair': ['Hawkeye Bow'],
      'Bandit Hideout': ['Wand of Storms'],
      'Salamander Pool': ["Sage's Circlet"],
      'Spider Nest': ['Emberblade'],
      'The Blight Source': ['Wand of Storms'],
    })
    expect(monsters(newWorld(1))[0].loot).not.toBe(lairs[0].loot)
  })

  it('makes monsters the more dangerous the further from home they lie', () => {
    const byDistance = [...lairs(world)].sort((a, b) => hexDistance(party.position, a.position) - hexDistance(party.position, b.position))
    const threats = byDistance.map((l) => l.threat)
    expect(threats).toEqual([...threats].sort((a, b) => a - b))
    expect(threats[0]).toBe(1)
    expect(threats.at(-1)).toBe(MAX_THREAT)
    for (const l of monsters(world)) expect(l.threat).toBe(threatAt(l.position))
  })

  it('starts the party on turn 1, on the map and clear of monsters', () => {
    expect(world.turn).toBe(1)
    expect(new HexBoard(world.board).contains(party.position)).toBe(true)
    expect(monstersHere(world, party)).toBeNull()
    expect(party.confronting).toBeNull()
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
    const { game, world, party } = fresh()
    // Nothing left to sight on the way.
    world.sighted = monsters(world).map((l) => l.id)
    const from = party.position
    const to = offsetToHex(3, 1)
    const { walked, interruptedBy } = travel(game, party, to)
    expect(interruptedBy).toBeNull()
    expect(walked.length).toBe(hexDistance(from, to))
    expect(hexEquals(walked[walked.length - 1], to)).toBe(true)
    expect(party.position).toEqual(to)
    expect(world.turn).toBe(1 + walked.length)
  })

  it('goes nowhere off the map or to the hex the party stands on', () => {
    const { game, world, party } = fresh()
    const before = structuredClone(world)
    expect(travel(game, party, offsetToHex(-1, 0)).walked).toEqual([])
    expect(travel(game, party, party.position).walked).toEqual([])
    expect(world).toEqual(before)
  })

  it('routes around monsters that are not the destination', () => {
    const { world, party } = fresh()
    const [goblins] = monsters(world)
    // Straight through the goblins' hex, along their row.
    party.position = { q: goblins.position.q - 2, r: goblins.position.r }
    const route = routeTo(world, party, { q: goblins.position.q + 2, r: goblins.position.r })!
    expect(route.some((h) => hexEquals(h, goblins.position))).toBe(false)
    expect(route.length).toBe(5)
  })

  it('passes over resources without stopping', () => {
    const { game, world, party } = fresh()
    const resource = world.locations.find((l) => l.kind === 'resource')!
    journeyTo(game, resource.position)
    expect(party.confronting).toBeNull()
    expect(routeTo(world, party, offsetToHex(0, 0))).not.toBeNull()
  })
})

describe('a monster location', () => {
  function arrive() {
    const { game, world, party } = fresh()
    const [goblins] = monsters(world)
    journeyTo(game, goblins.position)
    return { game, world, party, id: goblins.id }
  }

  it('confronts the party when it arrives, holding it there', () => {
    const { game, world, party, id } = arrive()
    expect(monstersHere(world, party)?.id).toBe(id)
    expect(party.confronting).toBe(id)
    expect(routeTo(world, party, offsetToHex(0, 0))).toBeNull()
    expect(travel(game, party, offsetToHex(0, 0)).walked).toEqual([])
  })

  it.each(['scout', 'wait'] as const)('lets the party %s for a turn, then move away or choose again', (how) => {
    const { game, world, party, id } = arrive()
    const turn = world.turn
    expect(linger(game, party, how)).not.toBeNull()
    expect(world.turn).toBe(turn + 1)
    // Still there to scout, wait at or attack...
    expect(monstersHere(world, party)?.id).toBe(id)
    expect(linger(game, party, how)).not.toBeNull()
    // ...and free to leave.
    expect(travel(game, party, offsetToHex(0, 0)).walked.length).toBeGreaterThan(0)
    expect(monstersHere(world, party)).toBeNull()
  })

  it('is gone from the map once cleared, freeing the party', () => {
    const { game, world, party, id } = arrive()
    const at = party.position
    clearLocation(game, id)
    expect(locationAt(world, at)).toBeNull()
    expect(party.confronting).toBeNull()
    expect(routeTo(world, party, offsetToHex(0, 0))).not.toBeNull()
  })

  it('once cleared frees every party that faced it, and only those', () => {
    const { game, party, id } = arrive()
    const facing = { ...structuredClone(party), id: 'party_2' }
    const elsewhere = { ...structuredClone(party), id: 'party_3', confronting: 'kobold_scouts' }
    game.parties.push(facing, elsewhere)
    clearLocation(game, id)
    expect(game.parties.map((p) => p.confronting)).toEqual([null, null, 'kobold_scouts'])
  })

  it('confronts only the party that walks into it', () => {
    const { game, world, party } = fresh()
    const other = { ...structuredClone(party), id: 'party_2' }
    game.parties.push(other)
    const [goblins] = monsters(world)
    journeyTo(game, goblins.position)
    expect([party.confronting, other.confronting]).toEqual([goblins.id, null])
    expect(other.position).toEqual(encampment(world).position)
  })
})

describe('linger', () => {
  it('does nothing away from monsters', () => {
    const { game, world, party } = fresh()
    expect(linger(game, party, 'wait')).toBeNull()
    expect(world.turn).toBe(1)
  })
})

describe('threatAt', () => {
  const home = encampment(newWorld(1)).position

  it('is 1 at home, a step higher each band out, and never past the top', () => {
    expect(threatAt(home)).toBe(1)
    expect(threatAt({ q: home.q + THREAT_BAND - 1, r: home.r })).toBe(1)
    expect(threatAt({ q: home.q + THREAT_BAND, r: home.r })).toBe(2)
    expect(threatAt({ q: home.q + THREAT_BAND * 2, r: home.r })).toBe(3)
    expect(threatAt({ q: home.q + THREAT_BAND * 50, r: home.r })).toBe(MAX_THREAT)
  })
})

describe('isNotable over several parties', () => {
  const world = newWorld(1)
  const a: PartyPresence = { position: offsetToHex(10, 10), levels: [1] }
  const b: PartyPresence = { position: offsetToHex(40, 30), levels: [1] }
  const sightedAt = (at: Hex, source?: true) => ({ type: 'sighted' as const, location: 'x', name: 'x', at, threat: 1, ...(source ? { source } : {}) })

  it('counts a sighting within NOTICE_RADIUS of either party', () => {
    for (const p of [a, b]) {
      const edge = { q: p.position.q + NOTICE_RADIUS, r: p.position.r }
      expect(isNotable(world, sightedAt(edge), [a, b])).toBe(true)
      expect(isNotable(world, sightedAt({ q: edge.q + 1, r: edge.r }), [a, b])).toBe(false)
    }
    expect(isNotable(world, sightedAt({ q: b.position.q + 1, r: b.position.r }), [a])).toBe(false)
  })

  it('counts the Source from anywhere, and with no party at all', () => {
    const far = offsetToHex(59, 0)
    expect(hexDistance(far, a.position)).toBeGreaterThan(NOTICE_RADIUS)
    expect(isNotable(world, sightedAt(far, true), [a, b])).toBe(true)
    expect(isNotable(world, sightedAt(far, true), [])).toBe(true)
    expect(isNotable(world, sightedAt(a.position), [])).toBe(false)
  })
})
