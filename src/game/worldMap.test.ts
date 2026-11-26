import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { HexBoard, hexDistance, hexEquals, hexKey, hexToOffset, offsetToHex, type Hex } from '../grid/hex.ts'
import { campUntilHealed } from './camp.ts'
import { ENCOUNTERS, ENCOUNTER_BANDS, type EncounterId } from './encounters.ts'
import { SPAWN_CLEARANCE } from './blight.ts'
import type { Material } from './territory.ts'
import { RAID_RADIUS } from './trade.ts'
import { presences, type PartyPresence } from './expedition.ts'
import { newGame, type GameState } from './gameState.ts'
import { readyMadeParty } from './party.ts'
import {
  earlyHex,
  DEFAULT_ENCAMPMENT_NAME,
  PARTNERS,
  ENCAMPMENT_ID,
  NOTICE_RADIUS,
  SOURCE_ID,
  SOURCE_PLACE,
  EARLY_SHIFT,
  SOURCE_THREAT,
  THREAT_RINGS,
  clearLocation,
  encampment,
  encampmentName,
  isNotable,
  linger,
  locationAt,
  monstersHere,
  newWorld,
  passTurn,
  routeTo,
  followOrder,
  threatAt,
  travel,
  type WorldState,
} from './worldMap.ts'
import { newExpedition } from './expedition.ts'

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
    // Stage 8's locations, moved by EARLY_SHIFT, span 34 rows; the outer rings' reach nearer both edges.
    expect(Math.max(...rows) - Math.min(...rows)).toBeGreaterThan(30)
  })

  it('leaves room to walk around every monster location', () => {
    const lairs = monsters(world)
    for (const a of lairs) for (const b of lairs) if (a !== b) expect(hexDistance(a.position, b.position)).toBeGreaterThan(2)
  })

  it('shows monsters, resources and trade partners, and no settlement of the party\'s but the encampment', () => {
    expect(new Set(world.locations.map((l) => l.kind))).toEqual(new Set(['monsters', 'encampment', 'resource', 'partner']))
    expect(world.locations.filter((l) => l.kind === 'encampment').map((l) => l.id)).toEqual([ENCAMPMENT_ID])
  })

  it('puts the Source where it is told, at the threat it is told', () => {
    const position = earlyHex(40, 30)
    const placed = newWorld(1, undefined, PARTNERS, { position, threat: 9 })
    const source = placed.locations.find((l) => l.id === SOURCE_ID)
    expect(source).toMatchObject({ kind: 'monsters', name: 'The Blight Source', encounter: 'source_guardians', source: true, threat: 9 })
    expect(hexEquals(source!.position, position)).toBe(true)
    expect(placed.locations[placed.locations.length - 1]).toBe(source)
  })

  it('places the Source at SOURCE_PLACE by default, the same world as passing it', () => {
    const source = world.locations.find((l) => l.id === SOURCE_ID)
    expect(source).toMatchObject({ position: SOURCE_PLACE.position, threat: SOURCE_PLACE.threat })
    expect(newWorld(7, undefined, PARTNERS, SOURCE_PLACE)).toEqual(newWorld(7))
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

  it('has bandits at the Bandit Camp, threat 3, and the Bandit Hideout, threat 4, and two camps in the threat 7 ring', () => {
    const camps = monsters(world).filter((l) => l.encounter === 'bandit_camp')
    expect(camps.map((l) => [l.id, l.name, l.threat])).toEqual([
      ['bandit_camp', 'Bandit Camp', 3],
      ['bandit_hideout', 'Bandit Hideout', 4],
      ['wildland_bandits', 'Wildland Bandits', 7],
      ['moorland_bandits', 'Moorland Bandits', 7],
    ])
  })

  it('has the Salamander Pool and the Spider Nest at threat 5, where the Troll Den and the Goblin Pillagers were', () => {
    const at = (id: string) => monsters(world).find((l) => l.id === id)!
    expect([at('salamander_pool').position, at('salamander_pool').encounter, at('salamander_pool').threat]).toEqual([
      earlyHex(54, 28),
      'salamander_pool',
      5,
    ])
    expect([at('spider_nest').position, at('spider_nest').encounter, at('spider_nest').threat]).toEqual([earlyHex(57, 10), 'spider_nest', 5])
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
      'Wildland Bandits': ['Ring of Fortune'],
      'Greyfang Pack': ['Cloak of Shadows'],
      'Ashen Hill Ogres': ['Wand of Sparks'],
      'Moorland Bandits': ['Amulet of Focus'],
      'Hollow Riders': ['Hawkeye Bow'],
      'Ironhold Company': ['Ring of Protection'],
      'Cinder Roost': ['Emberblade'],
      'Deepcrag Roost': ["Sage's Circlet"],
      'Grey Company': ['Wand of Storms'],
      'Mere Ogres': ['Ring of Fortune'],
      'Ravenhill Company': ['Cloak of Shadows'],
      'Stonegate Company': ['Hawkeye Bow'],
      'Thornwall Company': ['Amulet of Focus'],
      'Marsh Company': ['Emberblade'],
      'Dustroad Company': ['Wand of Sparks'],
      'The Red Freebooters': ['Wand of Storms'],
      'The Grey Freebooters': ['Ring of Protection'],
      'Wolfhead Host': ["Sage's Circlet"],
      'Saltwind Host': ['Hawkeye Bow'],
      'Black Banner Host': ['Cloak of Shadows'],
      'The Iron Freebooters': ['Emberblade'],
      'The Ashen Host': ['Wand of Storms'],
      'The Last Host': ['Ring of Fortune'],
      'Blightmarch Freebooters': ['Amulet of Focus'],
      'The Blight Source': ['Wand of Storms'],
    })
    expect(monsters(newWorld(1))[0].loot).not.toBe(lairs[0].loot)
  })

  it('makes monsters the more dangerous the further from home they lie', () => {
    const byDistance = [...lairs(world)].sort((a, b) => hexDistance(party.position, a.position) - hexDistance(party.position, b.position))
    const threats = byDistance.map((l) => l.threat)
    expect(threats).toEqual([...threats].sort((a, b) => a - b))
    expect(threats[0]).toBe(1)
    // The outermost ring's, where stage 9 step 05 places the last nests.
    expect(threats.at(-1)).toBe(18)
    for (const l of lairs(world)) expect(l.threat).toBe(threatAt(l.position))
  })

  it('starts the party on turn 1, on the map and clear of monsters', () => {
    expect(world.turn).toBe(1)
    expect(new HexBoard(world.board).contains(party.position)).toBe(true)
    expect(monstersHere(world, party)).toBeNull()
    expect(party.confronting).toBeNull()
  })

  it('puts the Source in the far east, 122 hexes from home in the last ring, at SOURCE_THREAT, last of the locations', () => {
    const source = monsters(world).find((l) => l.kind === 'monsters' && l.source)!
    expect(source.id).toBe(SOURCE_ID)
    expect(source.threat).toBe(SOURCE_THREAT)
    expect(source.threat).toBe(20)
    expect(source.kind === 'monsters' && source.encounter).toBe('source_guardians')
    expect(source.position).toEqual(offsetToHex(131, 36))
    expect(hexDistance(encampment(world).position, source.position)).toBe(122)
    expect(hexDistance(encampment(world).position, source.position)).toBe(THREAT_RINGS.at(-1)!.upTo)
    expect(hexToOffset(source.position).col).toBeGreaterThan(world.board.cols - 10)
    expect(world.locations.at(-1)).toBe(source)
  })
})

describe('travel', () => {
  it('walks a shortest route, a turn a hex', () => {
    const { game, world, party } = fresh()
    // Nothing left to sight on the way.
    world.sighted = monsters(world).map((l) => l.id)
    const from = party.position
    const to = earlyHex(3, 1)
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

describe('followOrder', () => {
  it('walks a home order to the encampment, the reports and the steps gathered as a journey', () => {
    const { game, world, party } = fresh()
    world.sighted = monsters(world).map((l) => l.id)
    const home = encampment(world).position
    party.position = offsetToHex(hexToOffset(home).col + 3, hexToOffset(home).row)
    const journey = followOrder(game, party, { kind: 'home' })
    if (typeof journey === 'string') throw new Error(journey)
    expect(party.position).toEqual(home)
    expect(journey.journey.walked.at(-1)).toEqual(home)
    expect(journey.reports).toHaveLength(journey.journey.walked.length)
    expect(journey.reports.at(-1)!.interrupt?.event.type).toBe('arrived')
    expect(followOrder(game, party, { kind: 'home' })).toBe('The party is already home.')
  })

  it('walks a meet order until the two parties stand together, within its limit', () => {
    const { game, world, party } = fresh()
    world.sighted = monsters(world).map((l) => l.id)
    const at = party.position
    const other = { ...newExpedition(readyMadeParty(), offsetToHex(hexToOffset(at).col + 4, hexToOffset(at).row)), id: 'party_2', name: 'Second Company' }
    game.parties.push(other)
    const short = followOrder(game, party, { kind: 'meet', party: other.id }, 2)
    if (typeof short === 'string') throw new Error(short)
    expect(short.journey.walked).toHaveLength(2)
    expect(party.order).toEqual({ kind: 'meet', party: other.id })
    const met = followOrder(game, party, { kind: 'meet', party: other.id })
    if (typeof met === 'string') throw new Error(met)
    expect(party.position).toEqual(other.position)
    expect(met.reports.at(-1)!.interrupt?.event).toEqual({ type: 'met', party: party.id, other: other.id })
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

describe('linger, as it is (characterization)', () => {
  /** The party walked into the first monsters, then moved on to the first day that brings an event. */
  function confronted(quiet: number) {
    const it = fresh()
    journeyTo(it.game, monsters(it.world)[0].position)
    for (let day = 0; day < quiet; day++) passTurn(it.world, presences(it.game.parties))
    return it
  }
  function eventfulTwins() {
    const scout = confronted(0)
    let quiet = 0
    while (passTurn(scout.world, presences(scout.game.parties)).length === 0) quiet++
    return [confronted(quiet), confronted(quiet)]
  }

  it.each(['scout', 'wait'] as const)('to %s frees the party and passes the day: the same events and game as by hand', (how) => {
    const [now, then] = eventfulTwins()
    expect(now.party.confronting).not.toBeNull()
    const turn = now.world.turn
    then.party.confronting = null
    const events = passTurn(then.world, presences(then.game.parties))
    expect(events.length).toBeGreaterThan(0)
    expect(linger(now.game, now.party, how)).toEqual(events)
    expect(now.world.turn).toBe(turn + 1)
    expect(now.party.confronting).toBeNull()
    expect(JSON.stringify(now.game)).toBe(JSON.stringify(then.game))
  })

  it.each(['lost', 'won'] as const)('is refused, changing nothing, once the game is %s', (status) => {
    const { game, world, party } = confronted(0)
    world.status = status
    const before = JSON.stringify(game)
    expect(linger(game, party, 'scout')).toBeNull()
    expect(JSON.stringify(game)).toBe(before)
  })
})

describe('threatAt', () => {
  const home = encampment(newWorld(1)).position
  /** The hex `d` hexes east of home, and the one `d` hexes north-west (another direction, the same distance). */
  const east = (d: number): Hex => ({ q: home.q + d, r: home.r })
  const northWest = (d: number): Hex => ({ q: home.q, r: home.r - d })

  it('is 1 at home, offset (9, 36)', () => {
    expect(home).toEqual(offsetToHex(9, 36))
    expect(threatAt(home)).toBe(1)
  })

  it('reads the ring table: each ring\'s threat at both of its edges', () => {
    expect(THREAT_RINGS).toEqual([
      { upTo: 10, threat: 1 },
      { upTo: 21, threat: 2 },
      { upTo: 32, threat: 3 },
      { upTo: 43, threat: 4 },
      { upTo: 54, threat: 5 },
      { upTo: 67, threat: 7 },
      { upTo: 80, threat: 9 },
      { upTo: 94, threat: 12 },
      { upTo: 108, threat: 15 },
      { upTo: 122, threat: 18 },
    ])
    const edges: [number, number][] = [
      [0, 1], [10, 1], [11, 2], [21, 2], [22, 3], [32, 3], [33, 4], [43, 4], [44, 5], [54, 5],
      [55, 7], [67, 7], [68, 9], [80, 9], [81, 12], [94, 12], [95, 15], [108, 15], [109, 18], [122, 18],
    ]
    for (const [d, threat] of edges) {
      expect(threatAt(east(d)), `${d} hexes east`).toBe(threat)
      expect(threatAt(northWest(d)), `${d} hexes north-west`).toBe(threat)
    }
  })

  it('is the last ring\'s threat beyond the table', () => {
    for (const d of [123, 130, 500]) expect(threatAt(east(d))).toBe(18)
  })
})

describe('the early shift (stage 9: today\'s locations moved by EARLY_SHIFT)', () => {
  /** Home and stage 8's locations at their stage-8 offsets, on its 60 × 40 board. */
  const STAGE_8: Record<string, [number, number]> = {
    encampment: [9, 19],
    iron_vein: [11, 21],
    gold_seam: [15, 16],
    goblin_raiders: [13, 18],
    kobold_scouts: [16, 21],
    timber_stand: [4, 28],
    peat_bog: [21, 4],
    silver_lode: [27, 14],
    old_quarry: [36, 26],
    salt_flats: [33, 36],
    copper_pit: [41, 10],
    crystal_cave: [56, 24],
    millbrook: [18, 30],
    saltmere: [30, 38],
    goblin_reavers: [12, 8],
    kobold_trappers: [8, 30],
    hobgoblin_warband: [24, 10],
    kobold_diggers: [22, 25],
    bandit_camp: [30, 22],
    goblin_marauders: [34, 17],
    troll_lair: [39, 31],
    bandit_hideout: [47, 13],
    salamander_pool: [54, 28],
    spider_nest: [57, 10],
  }
  const world = newWorld(1)
  const placed = (id: string) => world.locations.find((l) => l.id === id)!.position
  const old = (id: string) => offsetToHex(...STAGE_8[id])
  /** Stage 8's rule: 1 + a step every 11 hexes from home, up to 5. */
  const stage8Threat = (h: Hex) => Math.min(5, 1 + Math.floor(hexDistance(old('encampment'), h) / 11))

  it('places every location of stage 8\'s map, and none of its own in the home rings (the outer rings\' lie beyond them)', () => {
    const ids = world.locations.map((l) => l.id)
    for (const id of Object.keys(STAGE_8)) expect(ids, id).toContain(id)
    for (const l of world.locations) if (!(l.id in STAGE_8) && l.id !== SOURCE_ID) expect(hexDistance(placed('encampment'), l.position), l.id).toBeGreaterThan(54)
  })

  it('is a translation: an odd stage-8 row keeps its column, an even one moves a column west, every row gains 17', () => {
    expect(EARLY_SHIFT).toEqual({ q: -9, r: 17 })
    expect(earlyHex(9, 19)).toEqual(offsetToHex(9, 36))
    expect(earlyHex(18, 30)).toEqual(offsetToHex(17, 47))
    expect(earlyHex(30, 38)).toEqual(offsetToHex(29, 55))
    for (const [id, [col, row]] of Object.entries(STAGE_8)) {
      expect(hexToOffset(placed(id)), id).toEqual({ col: row % 2 === 1 ? col : col - 1, row: row + 17 })
    }
  })

  it('keeps every distance among home and stage 8\'s locations', () => {
    const ids = Object.keys(STAGE_8)
    for (const a of ids) for (const b of ids) expect(hexDistance(placed(a), placed(b)), `${a} to ${b}`).toBe(hexDistance(old(a), old(b)))
  })

  it('keeps every location\'s threat what stage 8 gave it', () => {
    for (const id of Object.keys(STAGE_8)) {
      expect(threatAt(placed(id)), id).toBe(stage8Threat(old(id)))
      const l = world.locations.find((m) => m.id === id)!
      if (l.kind === 'monsters') expect(l.threat, id).toBe(stage8Threat(old(id)))
    }
  })
})

describe('isNotable for trade routes', () => {
  const world = newWorld(1)
  const named = { route: 'route_millbrook', partner: 'millbrook', name: 'Millbrook' }

  it('stops a journey the day a road turns raided and on abandonment, not on the yield days\' counts, opening or restoring', () => {
    expect(isNotable(world, { type: 'route_raided', ...named, cause: 'raiders', raider: 'x', raiderName: 'X', days: 0 }, [])).toBe(true)
    expect(isNotable(world, { type: 'route_raided', ...named, cause: 'raiders', raider: 'x', raiderName: 'X', days: 1 }, [])).toBe(false)
    expect(isNotable(world, { type: 'route_raided', ...named, cause: 'silent', days: 2 }, [])).toBe(false)
    expect(isNotable(world, { type: 'route_abandoned', ...named }, [])).toBe(true)
    expect(isNotable(world, { type: 'route_opened', ...named, length: 14 }, [])).toBe(false)
    expect(isNotable(world, { type: 'route_restored', ...named }, [])).toBe(false)
  })
})

describe('isNotable over several parties', () => {
  const world = newWorld(1)
  const a: PartyPresence = { position: earlyHex(10, 10), levels: [1] }
  const b: PartyPresence = { position: earlyHex(40, 30), levels: [1] }
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
    const far = earlyHex(59, 0)
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
    expect(travel(game, party, earlyHex(3, 1))).toEqual({ walked: [], events: [], interruptedBy: null })
    party.confronting = null
    expect(structuredClone({ world, party })).toEqual(before)
  })

  it('changes nothing once the game is over', () => {
    const { game, world, party } = quiet()
    world.status = 'won'
    const before = structuredClone({ world, party })
    expect(travel(game, party, earlyHex(3, 1))).toEqual({ walked: [], events: [], interruptedBy: null })
    expect(structuredClone({ world, party })).toEqual(before)
  })

  it('stops on the first notable event of a day, short of the destination, confronting nothing', () => {
    const { game, world, party } = fresh()
    const to = earlyHex(40, 20)
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
    const open = earlyHex(3, 1)
    const walk = travel(other.game, other.party, open)
    expect(walk.walked.at(-1)).toEqual(open)
    expect(other.party.confronting).toBeNull()
  })

  it('stops short of a nest that came onto the road since the route was planned, passing no day for it', () => {
    const { game, world, party } = quiet()
    const to = earlyHex(3, 1)
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
    const to = earlyHex(3, 1)
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
    const to = earlyHex(3, 1)
    const route = routeTo(world, party, to)!
    nestAt(world, 'hidden_nest', route[0], false)
    const turn = world.turn
    expect(travel(game, party, to).walked).toEqual([])
    expect(party.confronting).toBe(goblins.id)
    expect(world.turn).toBe(turn)
  })

  it('stops after the day the game ends', () => {
    const { game, world, party } = quiet()
    const to = earlyHex(3, 1)
    onTurn(world, 3, () => (world.status = 'won'))
    const journey = travel(game, party, to)
    expect(journey.walked.length).toBe(2)
    expect(journey.interruptedBy).toBeNull()
    expect(world.turn).toBe(3)
  })
})

describe('the outer rings (stage 9 step 05: their nests, sites and far partners)', () => {
  const world = newWorld(1)
  const home = encampment(world).position
  const source = world.locations.find((l) => l.id === SOURCE_ID)!
  /** The outer rings' threats, and the encounters each ring's fixed nests must include. */
  const RINGS: Record<number, EncounterId[]> = {
    7: ['bandit_camp', 'wolf_pack', 'worg_riders', 'ogre_camp'],
    9: ['bandit_company', 'wyvern_roost', 'ogre_camp'],
    12: ['bandit_company'],
    15: ['freebooter_host'],
    18: ['freebooter_host'],
  }
  const SITES: Record<string, [string, Material, number]> = {
    ironwood_grove: ['Ironwood Grove', 'ironwood', 7],
    mithril_lode: ['Mithril Lode', 'mithril', 9],
    elder_grove: ['Elder Grove', 'elderwood', 9],
    adamant_deep: ['Adamant Deep', 'adamant', 12],
    wyrmwood_thicket: ['Wyrmwood Thicket', 'wyrmwood', 15],
    fallen_star: ['Fallen Star', 'starmetal', 18],
    heartwood: ['The Heartwood', 'heartwood', 18],
  }
  const FAR_PARTNERS: Record<string, [string, Material, number]> = {
    stonehollow: ['Stonehollow', 'mithril', 7],
    elder_glade: ['Elder Glade', 'elderwood', 12],
    emberwatch: ['Emberwatch', 'adamant', 15],
  }
  const nests = lairs(world)
  const at = (id: string) => world.locations.find((l) => l.id === id)!

  it('hold every fixed nest at its ring\'s threat, inside its encounter\'s band', () => {
    for (const l of nests) {
      if (l.kind !== 'monsters') continue
      expect(l.threat, l.id).toBe(threatAt(l.position))
      expect(l.threat, l.id).toBeGreaterThanOrEqual(ENCOUNTER_BANDS[l.encounter].min)
      expect(l.threat, l.id).toBeLessThanOrEqual(ENCOUNTER_BANDS[l.encounter].max)
    }
  })

  it('fill ring 7 with the wolves, the worg riders and the ogres, where its spiders and salamander were, and keep its two bandit camps (stage 11 step 08)', () => {
    const ring = nests.filter((l) => l.threat === 7).map((l) => [l.id, l.name, l.kind === 'monsters' && l.encounter, l.position, l.kind === 'monsters' && l.loot.map((item) => item.name)])
    expect(ring).toEqual([
      ['wildland_bandits', 'Wildland Bandits', 'bandit_camp', offsetToHex(55, 6), ['Ring of Fortune']],
      ['greyfang_pack', 'Greyfang Pack', 'wolf_pack', offsetToHex(62, 20), ['Cloak of Shadows']],
      ['ashen_ogres', 'Ashen Hill Ogres', 'ogre_camp', offsetToHex(70, 36), ['Wand of Sparks']],
      ['moorland_bandits', 'Moorland Bandits', 'bandit_camp', offsetToHex(62, 52), ['Amulet of Focus']],
      ['hollow_riders', 'Hollow Riders', 'worg_riders', offsetToHex(55, 67), ['Hawkeye Bow']],
    ])
    for (const gone of ['webwood_nest', 'ashen_pool', 'hollow_spiders']) expect(world.locations.map((l) => l.id)).not.toContain(gone)
  })

  it('fill ring 9 with two Wyvern Roosts and an Ogre Camp, where its salamanders and spiders were, and keep its two Bandit Companies (stage 11 step 09)', () => {
    const ring = nests.filter((l) => l.threat === 9).map((l) => [l.id, l.name, l.kind === 'monsters' && l.encounter, l.position, l.kind === 'monsters' && l.loot.map((item) => item.name)])
    expect(ring).toEqual([
      ['ironhold_company', 'Ironhold Company', 'bandit_company', offsetToHex(67, 4), ['Ring of Protection']],
      ['cinder_roost', 'Cinder Roost', 'wyvern_roost', offsetToHex(74, 18), ['Emberblade']],
      ['deepcrag_roost', 'Deepcrag Roost', 'wyvern_roost', offsetToHex(83, 36), ["Sage's Circlet"]],
      ['grey_company', 'Grey Company', 'bandit_company', offsetToHex(74, 54), ['Wand of Storms']],
      ['mere_ogres', 'Mere Ogres', 'ogre_camp', offsetToHex(66, 69), ['Ring of Fortune']],
    ])
    for (const gone of ['cinder_springs', 'deepweb_hollow', 'smoking_mere']) expect(world.locations.map((l) => l.id)).not.toContain(gone)
  })

  it('put 4 to 6 fixed nests in each outer ring, fighting the ring\'s encounters', () => {
    for (const [threat, required] of Object.entries(RINGS)) {
      const ring = nests.filter((l) => l.threat === Number(threat))
      expect(ring.length, `ring ${threat}`).toBeGreaterThanOrEqual(4)
      expect(ring.length, `ring ${threat}`).toBeLessThanOrEqual(6)
      const encounters = new Set(ring.map((l) => l.kind === 'monsters' && l.encounter))
      expect([...encounters].sort(), `ring ${threat}`).toEqual([...required].sort())
    }
    // Spread north, east and south: no ring's nests all on one side of home's row.
    for (const threat of Object.keys(RINGS)) {
      const rows = nests.filter((l) => l.threat === Number(threat)).map((l) => hexToOffset(l.position).row)
      expect(Math.min(...rows), `ring ${threat}`).toBeLessThan(hexToOffset(home).row - 10)
      expect(Math.max(...rows), `ring ${threat}`).toBeGreaterThan(hexToOffset(home).row + 10)
    }
  })

  it('place the seven resource sites and the three far partners, each in its ring', () => {
    for (const [id, [name, , threat]] of Object.entries(SITES)) {
      expect(at(id), id).toMatchObject({ kind: 'resource', name })
      expect(threatAt(at(id).position), id).toBe(threat)
    }
    for (const [id, [name, good, threat]] of Object.entries(FAR_PARTNERS)) {
      expect(at(id), id).toMatchObject({ kind: 'partner', name, good })
      expect(threatAt(at(id).position), id).toBe(threat)
    }
    expect(PARTNERS.map((p) => p.id)).toEqual(['millbrook', 'saltmere', 'stonehollow', 'elder_glade', 'emberwatch'])
  })

  it('keep the clearances: outer nests 4 from every nest, partners 4 and sites 5 from every nest, nothing but the Source within 4 of it', () => {
    const outerNests = nests.filter((l) => l.threat > 5)
    for (const a of outerNests) for (const b of nests) if (a !== b) expect(hexDistance(a.position, b.position), `${a.id} to ${b.id}`).toBeGreaterThanOrEqual(SPAWN_CLEARANCE)
    for (const p of world.locations.filter((l) => l.kind === 'partner')) {
      for (const n of nests) expect(hexDistance(p.position, n.position), `${p.id} to ${n.id}`).toBeGreaterThanOrEqual(RAID_RADIUS + 2)
    }
    for (const id of Object.keys(SITES)) for (const n of nests) expect(hexDistance(at(id).position, n.position), `${id} to ${n.id}`).toBeGreaterThanOrEqual(5)
    for (const l of world.locations) if (l !== source) expect(hexDistance(l.position, source.position), l.id).toBeGreaterThan(4)
  })

  it('stand in order: home, today\'s resources, the new ones, the partners, today\'s nests, the outer ones, the Source', () => {
    const ids = world.locations.map((l) => l.id)
    const index = (id: string) => ids.indexOf(id)
    expect(ids.filter((id) => id in SITES)).toEqual(Object.keys(SITES))
    expect(index('ironwood_grove')).toBe(index('crystal_cave') + 1)
    expect(ids.slice(index('heartwood') + 1, index('heartwood') + 6)).toEqual(PARTNERS.map((p) => p.id))
    expect(index('goblin_reavers')).toBe(index('emberwatch') + 1)
    const outer = nests.filter((l) => l.threat > 5)
    expect(index(outer[0].id)).toBe(index('spider_nest') + 1)
    expect(outer.map((l) => l.threat)).toEqual([...outer.map((l) => l.threat)].sort((a, b) => a - b))
    expect(ids.at(-1)).toBe(SOURCE_ID)
  })
})

describe('a seeded session of walks and camps (characterization)', () => {
  it('gives the same journeys, camps, world and party as before the day loop', () => {
    const { game, party } = fresh()
    // Recorded before the trade partners (stage 8), so on a world without them.
    const world = (game.world = newWorld(1, undefined, []))
    const results: unknown[] = []
    const wound = () => party.members.forEach((m, i) => (m.hp = Math.max(1, m.hp - 7 - 3 * i)))
    const targets = [earlyHex(30, 5), earlyHex(40, 20), earlyHex(20, 30), earlyHex(5, 35), earlyHex(13, 18)]
    for (const to of targets) {
      for (let click = 0; click < 6 && !hexEquals(party.position, to); click++) {
        if (party.confronting) results.push(['linger', linger(game, party, 'wait')])
        results.push(['travel', travel(game, party, to)])
        wound()
        // The reports, added after the day loop, are left out: what they hold is in the rest.
        const camped = campUntilHealed(game, party)
        results.push(['camp', camped && (({ reports: _reports, ...rest }) => rest)(camped)])
      }
    }
    // The order is left out: the day loop keeps one past an interrupt, as nothing did before it.
    const { order: _order, ...rest } = party
    // The world as it was before stage 7: its improvements as the outposts list (none here), and no Lodge.
    // And before stage 8: no contacts, silence or routes.
    const { improvements, lodge: _lodge, contacted: _contacted, silent: _silent, routes: _routes, routesOpened: _routesOpened, ...kept } = world
    const before = Object.fromEntries(Object.entries(kept).flatMap(([key, value]) => (key === 'shrine' ? [[key, value], ['outposts', Object.keys(improvements)]] : [[key, value]])))
    const digest = createHash('sha256').update(JSON.stringify({ results, world: before, party: rest })).digest('hex')
    expect(world.turn).toBe(SESSION_TURN)
    expect(digest).toBe(SESSION_SHA256)
  })
})

// Re-recorded in stage 9 step 04 (153 turns before): the 140 × 72 board, the locations and targets moved by EARLY_SHIFT,
// the Source 122 hexes out and the blight's spawn constants for the larger board.
// Re-recorded in stage 9 step 05 (150 turns before): the outer rings' nests blight the far land, which changes the spawns.
const SESSION_TURN = 146
// Re-recorded in skill trees step 03: the party's characters hold the trees' nodes (and no spell picks), and Aldric's Toughness changed his hit points.
// Re-recorded in skill trees step 04: every hero has mana (camping fills it), and the mage 2 more for each Mage and Cleric node.
// Re-recorded in skill trees step 28: the characters' `perkPicks` renamed `perkPoints`, nothing else (the old hash held with the name put back).
// Re-recorded in stage 9 step 04, as SESSION_TURN.
// Re-recorded in stage 9 step 05, as SESSION_TURN.
// Re-recorded in stage 11 step 08: ring 7's three nests renamed (id, name, encounter) and its three spawn kinds joined
// the eligible ones at threats 7 and 9, so ten far spawns are of another kind (name, encounter); nothing else differs
// (the digested JSON diffed before and after), and SESSION_TURN is unchanged.
// Re-recorded in stage 11 step 09: ring 9's three nests renamed (id, name, encounter) and the Wyvern Roost joined the
// eligible spawn kinds at threats 9 and 12, so seven far spawns are of another kind (name, encounter, and the spawned
// event's name); nothing else differs (30 values in the digested JSON, diffed before and after); SESSION_TURN unchanged.
const SESSION_SHA256 = 'c07df50d73359bd93d5cdd112e2d3ee268f0db59d094f75e3b2e603ddfed5910'

describe('the trade partners on a new world', () => {
  const kinds = (world: WorldState) => world.locations.map((l) => l.kind)

  it('are Millbrook (timber, threat 2) and Saltmere (salt, threat 3), where the stage puts them', () => {
    const world = newWorld(1)
    const millbrook = world.locations.find((l) => l.id === 'millbrook')!
    const saltmere = world.locations.find((l) => l.id === 'saltmere')!
    expect(millbrook).toMatchObject({ kind: 'partner', name: 'Millbrook', good: 'timber', position: earlyHex(18, 30) })
    expect(saltmere).toMatchObject({ kind: 'partner', name: 'Saltmere', good: 'salt', position: earlyHex(30, 38) })
    expect(threatAt(millbrook.position)).toBe(2)
    expect(threatAt(saltmere.position)).toBe(3)
    expect([world.contacted, world.silent, world.routes, world.routesOpened]).toEqual([[], [], [], 0])
  })

  it('stand after the resources and before the monsters', () => {
    const order = kinds(newWorld(1))
    const first = order.indexOf('partner')
    expect(order.slice(first, first + PARTNERS.length)).toEqual(PARTNERS.map(() => 'partner'))
    expect(order.lastIndexOf('resource')).toBeLessThan(first)
    expect(order.indexOf('monsters', order.lastIndexOf('resource'))).toBe(first + PARTNERS.length)
  })

  it('are copies: changing one world\'s partner leaves PARTNERS and other worlds alone', () => {
    const a = newWorld(1)
    const b = newWorld(1)
    const ofA = a.locations.find((l) => l.id === 'millbrook')!
    ;(ofA.position as { q: number }).q += 1
    ofA.name = 'Changed'
    expect(PARTNERS[0]).toEqual({ id: 'millbrook', kind: 'partner', name: 'Millbrook', position: earlyHex(18, 30), good: 'timber' })
    expect(b.locations.find((l) => l.id === 'millbrook')!.position).toEqual(earlyHex(18, 30))
  })

  it('can be left out, giving the world as it was before them', () => {
    const world = newWorld(1, undefined, [])
    expect(kinds(world)).not.toContain('partner')
    // Hashed from newWorld(1) as the code before stage 8 built it; hashed again in stage 9 step 04, whose board,
    // shift and Source changed the land (with partners and without: they push only when present); and in step 05,
    // whose outer rings' nests blight the far land.
    const digest = createHash('sha256').update(JSON.stringify([world.blight, world.shift, world.held, world.seen])).digest('hex')
    expect(digest).toBe('2b57fc0ce190b86ba6ec33088634f2a15fc28000a1ccf07da963476b866ea428')
  })
})
