import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { HexBoard, hexDistance, hexEquals, hexKey, hexToOffset, offsetToHex, type Hex } from '../grid/hex.ts'
import { campUntilHealed } from './camp.ts'
import { ENCOUNTERS, ENCOUNTER_BANDS, MAX_THREAT } from './encounters.ts'
import type { PartyPresence } from './expedition.ts'
import { newGame, type GameState } from './gameState.ts'
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
  return { game, world: game.world, party: game.parties[0] }
}
/** Travels on to `to` however often a sighting stops the party, as a player clicks again. */
function journeyTo(game: GameState, to: Hex): void {
  const party = game.parties[0]
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

/**
 * Calls `then` as the world's turn is counted to `turn` (in `passTurn`, before
 * that day's blight), which lets a test change the world in the middle of a walk.
 */
function onTurn(world: WorldState, turn: number, then: () => void): void {
  let value = world.turn
  Object.defineProperty(world, 'turn', {
    configurable: true,
    enumerable: true,
    get: () => value,
    set: (next: number) => {
      value = next
      if (next === turn) then()
    },
  })
}

/** A nest of the goblins' encounter put down at `at`, known to the player when `known`. */
function nestAt(world: WorldState, id: string, at: Hex, known: boolean, threat = 1): void {
  world.locations.push({ id, kind: 'monsters', name: 'Nest', position: at, encounter: 'goblin_raid', threat, loot: [] })
  if (known) world.sighted.push(id)
}

describe('travel, as it is (characterization)', () => {
  /** A fresh game whose monsters are all known, so that no sighting cuts a walk short. */
  function quiet() {
    const { game, world, party } = fresh()
    world.sighted = monsters(world).map((l) => l.id)
    return { game, world, party }
  }

  it('changes nothing with no route: off the map, the hex it stands on, or while confronting', () => {
    const { game, world, party } = fresh()
    const before = structuredClone({ world, party })
    for (const to of [offsetToHex(-1, 0), party.position]) {
      expect(travel(game, party, to)).toEqual({ walked: [], events: [], interruptedBy: null })
    }
    party.confronting = 'goblin_raiders'
    expect(travel(game, party, offsetToHex(3, 1))).toEqual({ walked: [], events: [], interruptedBy: null })
    party.confronting = null
    expect(structuredClone({ world, party })).toEqual(before)
  })

  it('changes nothing once the game is over', () => {
    const { game, world, party } = quiet()
    world.status = 'won'
    const before = structuredClone({ world, party })
    expect(travel(game, party, offsetToHex(3, 1))).toEqual({ walked: [], events: [], interruptedBy: null })
    expect(structuredClone({ world, party })).toEqual(before)
  })

  it('stops on the first notable event of a day, short of the destination, confronting nothing', () => {
    const { game, world, party } = fresh()
    const to = offsetToHex(40, 20)
    const route = routeTo(world, party, to)!
    const journey = travel(game, party, to)
    expect(journey.interruptedBy).not.toBeNull()
    expect(journey.interruptedBy!.type).toBe('sighted')
    expect(journey.walked).toEqual(route.slice(0, journey.walked.length))
    expect(journey.walked.length).toBeLessThan(route.length)
    expect(party.position).toEqual(journey.walked.at(-1))
    expect(party.confronting).toBeNull()
    expect(world.turn).toBe(1 + journey.walked.length)
    // The first notable event of the last day: nothing notable came before it.
    const present = [{ position: party.position, levels: party.members.map((m) => m.level) }]
    const notable = journey.events.filter((event) => isNotable(world, event, present))
    expect(notable[0]).toBe(journey.interruptedBy)
  })

  it('confronts the monsters it arrives at, even when a notable event cuts the arrival day short', () => {
    const { game, world, party } = quiet()
    const at = { q: party.position.q + 1, r: party.position.r }
    expect(locationAt(world, at)).toBeNull()
    nestAt(world, 'close_nest', at, true)
    // A threat-5 nest beside the Gold Seam threatens it from the first day.
    const seam = world.locations.find((l) => l.id === 'gold_seam')!.position
    nestAt(world, 'besiegers', { q: seam.q + 2, r: seam.r }, true, 5)
    const journey = travel(game, party, at)
    expect(journey.walked).toEqual([at])
    expect(journey.interruptedBy).toMatchObject({ type: 'site_threatened', site: 'gold_seam' })
    expect(party.confronting).toBe('close_nest')
    expect(world.turn).toBe(2)
  })

  it('arrives at monsters confronting them, and on open land confronting nothing', () => {
    const { game, world, party } = quiet()
    const at = { q: party.position.q + 2, r: party.position.r }
    nestAt(world, 'close_nest', at, true)
    const journey = travel(game, party, at)
    expect(journey.interruptedBy).toBeNull()
    expect(journey.walked.at(-1)).toEqual(at)
    expect(party.confronting).toBe('close_nest')
    expect(world.turn).toBe(1 + journey.walked.length)

    const other = quiet()
    const open = offsetToHex(3, 1)
    const walk = travel(other.game, other.party, open)
    expect(walk.walked.at(-1)).toEqual(open)
    expect(other.party.confronting).toBeNull()
  })

  it('stops short of a nest that came onto the road since the route was planned, passing no day for it', () => {
    const { game, world, party } = quiet()
    const to = offsetToHex(3, 1)
    const route = routeTo(world, party, to)!
    expect(route.length).toBeGreaterThan(3)
    // As the first day is counted, a nest comes down on the road's second hex.
    onTurn(world, 2, () => nestAt(world, 'road_nest', route[1], true))
    const journey = travel(game, party, to)
    expect(journey.walked).toEqual([route[0]])
    expect(journey.interruptedBy).toBeNull()
    expect(party.position).toEqual(route[0])
    expect(party.confronting).toBeNull()
    expect(world.turn).toBe(2)
  })

  it('walks nowhere when the road is blocked at its first hex, confronting what stands where it is', () => {
    const { game, world, party } = quiet()
    const to = offsetToHex(3, 1)
    const route = routeTo(world, party, to)!
    // A nest the player has not seen, which the route does not avoid.
    nestAt(world, 'hidden_nest', route[0], false)
    expect(travel(game, party, to)).toEqual({ walked: [], events: [], interruptedBy: null })
    expect(party.confronting).toBeNull()
    expect(world.turn).toBe(1)
  })

  it('confronts again, walking nowhere, the monsters it lingered at when its road is blocked at once', () => {
    const { game, world, party } = quiet()
    const [goblins] = lairs(world)
    journeyTo(game, goblins.position)
    expect(linger(game, party, 'wait')).not.toBeNull()
    expect(party.confronting).toBeNull()
    const to = offsetToHex(3, 1)
    const route = routeTo(world, party, to)!
    nestAt(world, 'hidden_nest', route[0], false)
    const turn = world.turn
    expect(travel(game, party, to).walked).toEqual([])
    expect(party.confronting).toBe(goblins.id)
    expect(world.turn).toBe(turn)
  })

  it('stops after the day the game ends', () => {
    const { game, world, party } = quiet()
    const to = offsetToHex(3, 1)
    onTurn(world, 3, () => (world.status = 'won'))
    const journey = travel(game, party, to)
    expect(journey.walked.length).toBe(2)
    expect(journey.interruptedBy).toBeNull()
    expect(world.turn).toBe(3)
  })
})

describe('a seeded session of walks and camps (characterization)', () => {
  it('gives the same journeys, camps, world and party as before the day loop', () => {
    const { game, world, party } = fresh()
    const results: unknown[] = []
    const wound = () => party.members.forEach((m, i) => (m.hp = Math.max(1, m.hp - 7 - 3 * i)))
    const targets = [offsetToHex(30, 5), offsetToHex(40, 20), offsetToHex(20, 30), offsetToHex(5, 35), offsetToHex(13, 18)]
    for (const to of targets) {
      for (let click = 0; click < 6 && !hexEquals(party.position, to); click++) {
        if (party.confronting) results.push(['linger', linger(game, party, 'wait')])
        results.push(['travel', travel(game, party, to)])
        wound()
        results.push(['camp', campUntilHealed(game, party)])
      }
    }
    // The order is left out: the day loop keeps one past an interrupt, as nothing did before it.
    const { order: _order, ...rest } = party
    const digest = createHash('sha256').update(JSON.stringify({ results, world, party: rest })).digest('hex')
    expect(world.turn).toBe(SESSION_TURN)
    expect(digest).toBe(SESSION_SHA256)
  })
})

const SESSION_TURN = 153
const SESSION_SHA256 = '6cd5821ddc5fc57c6924324bf9709e39cbccd3e2b7c42325214133ad3171604e'
