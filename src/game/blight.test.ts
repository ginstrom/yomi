import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { hexDistance, hexNeighbors, hexToOffset, offsetToHex, type Hex } from '../grid/hex.ts'
import { ENCOUNTER_BANDS } from './encounters.ts'
import { presences, type PartyPresence } from './expedition.ts'
import { newGame, type GameState } from './gameState.ts'
import {
  CLEANSE_LEVELS,
  MAX_BLIGHT,
  MAX_MONSTER_LOCATIONS,
  SHIFT_COST,
  SPAWN_CLEARANCE,
  SPAWN_COST,
  advanceDay,
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

/** A new game on world `seed`: its world and its one party, the ready-made three, at home. */
function solo(seed: number) {
  const game = newGame(readyMadeParty(), null, seed)
  return { game, world: game.world, party: game.parties[0] }
}
const lairs = (world: WorldState) => world.locations.filter((l): l is MonsterLocation => l.kind === 'monsters')
const setLevel = (world: WorldState, h: Hex, level: number) => (world.blight[boardIndex(world.board, h)] = level)
const spawns = (world: WorldState) => lairs(world).filter((l) => l.id.startsWith('spawn_'))
/** Corrupts the land at the threats `holds` admits, two hexes clear of every location. */
const corruptWhere = (world: WorldState, holds: (threat: number) => boolean) =>
  world.blight.forEach((_, i) => {
    const h = boardHex(world.board, i)
    if (holds(threatAt(h)) && world.locations.every((l) => hexDistance(l.position, h) >= 2)) world.blight[i] = MAX_BLIGHT
  })
const days = (game: GameState, n: number): WorldEvent[] =>
  Array.from({ length: n }, () => passTurn(game.world, presences(game.parties))).flat()

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
    expect(partyStrength(readyMadeParty().map((m) => m.level))).toBe(3)
    expect(partyStrength([5, 5, 5])).toBe(9)
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
    const { game, world } = solo(1)
    const source = lairs(world).find((l) => l.id === SOURCE_ID)!
    const at = { q: source.position.q - 3, r: source.position.r }
    setLevel(world, at, 0)
    const net = netInfluence(world, presences(game.parties), at)
    expect(net).toBeGreaterThan(0)
    days(game, Math.ceil(SHIFT_COST / net) - 1)
    expect(blightAt(world, at)).toBe(0)
    days(game, 1)
    expect(blightAt(world, at)).toBe(1)
  })

  it('lowers a hex the clean side is winning, and leaves a quiet one be', () => {
    const { game, world } = solo(1)
    const home = world.locations.find((l) => l.id === ENCAMPMENT_ID)!.position
    const near = { q: home.q + 1, r: home.r }
    setLevel(world, near, 1)
    expect(netInfluence(world, presences(game.parties), near)).toBeLessThan(0)
    days(game, SHIFT_COST)
    expect(blightAt(world, near)).toBe(0)
  })

  it('keeps monsters’ hexes at blighted or worse, whatever stands against them', () => {
    const world = newWorld(1)
    const [raiders] = lairs(world)
    const strong: PartyPresence = { position: hexNeighbors(raiders.position)[0], levels: [30, 30, 30] }
    for (let d = 0; d < 60; d++) passTurn(world, [strong])
    expect(blightAt(world, raiders.position)).toBeGreaterThanOrEqual(2)
  })

  it('never raises the party’s own hex, which its influence slowly turns', () => {
    const { game, world, party } = solo(1)
    const source = lairs(world).find((l) => l.id === SOURCE_ID)!
    const camp = { q: source.position.q - 8, r: source.position.r }
    party.position = camp
    setLevel(world, camp, 1)
    for (const n of hexNeighbors(camp)) setLevel(world, n, 0)
    const events = days(game, SHIFT_COST)
    expect(events.some((e) => e.type === 'level_changed' && hexDistance(e.at, camp) === 1 && e.to > e.from)).toBe(true)
    expect(blightAt(world, camp)).toBe(0)
  })

  it('plays out the same from the same seed', () => {
    const a = solo(7).game
    const b = solo(7).game
    days(a, 120)
    days(b, 120)
    expect(a.world).toEqual(b.world)
  })
})

describe('spawning', () => {
  it('puts a monster location on corrupted land, clear of the party and the rest, at the threat of where it lies', () => {
    const { game, world, party } = solo(1)
    world.spawnPressure = SPAWN_COST
    const spawned = days(game, 1).find((e) => e.type === 'spawned')
    expect(spawned).toBeDefined()
    const location = lairs(world).at(-1)!
    expect(spawned).toMatchObject({ location: location.id, threat: threatAt(location.position) })
    expect(blightAt(world, location.position)).toBe(MAX_BLIGHT)
    for (const other of [party.position, ...lairs(world).slice(0, -1).map((l) => l.position)]) {
      expect(hexDistance(other, location.position)).toBeGreaterThanOrEqual(SPAWN_CLEARANCE)
    }
    expect(world.spawnPressure).toBeLessThan(SPAWN_COST)
  })

  it('stops at MAX_MONSTER_LOCATIONS', () => {
    const { game, world } = solo(1)
    for (let i = 0; i < 200; i++) {
      world.spawnPressure = SPAWN_COST
      passTurn(world, presences(game.parties))
    }
    expect(lairs(world).length).toBe(MAX_MONSTER_LOCATIONS)
  })

  /**
   * One forced spawn on each of 80 fresh worlds with all land corrupted, worked out once for the two tests below
   * (a world and its first day are costly, and 200 worlds for each test ran past the timeout on a busy machine).
   * 80 seeds spawn at every threat from 1 to 5, and Bandit Gangs at 3, 4 and 5.
   */
  let forced: MonsterLocation[] | undefined
  const forcedSpawns = (): MonsterLocation[] => {
    if (!forced) {
      forced = []
      for (let seed = 1; seed <= 80; seed++) {
        const { game, world } = solo(seed)
        corruptWhere(world, () => true)
        world.spawnPressure = SPAWN_COST
        passTurn(world, presences(game.parties))
        forced.push(...spawns(world))
      }
    }
    return forced
  }

  it('spawns only kinds whose encounter band holds the threat of where they lie', () => {
    const spawned = forcedSpawns()
    expect(spawned.length).toBeGreaterThan(60)
    expect(new Set(spawned.map((l) => l.threat))).toEqual(new Set([1, 2, 3, 4, 5]))
    for (const l of spawned) {
      const band = ENCOUNTER_BANDS[l.encounter]
      expect(l.threat).toBeGreaterThanOrEqual(band.min)
      expect(l.threat).toBeLessThanOrEqual(band.max)
    }
  })

  it('spawns a Bandit Gang only from threat 3, and does spawn one there', () => {
    const gangs = forcedSpawns().filter((l) => l.name === 'Bandit Gang')
    expect(new Set(gangs.map((l) => l.threat))).toEqual(new Set([3, 4, 5]))
    for (const l of gangs) expect(l.encounter).toBe('bandit_camp')
  })

  it('spawns at threats 1 and 2 as before bandits: the same places, kinds and loot', () => {
    // Captured from the code before the Bandit Gang joined SPAWN_KINDS: [col, row, threat, name, loot].
    // The loot was captured again when the Wand of Sparks left the enchanted items (stage 3):
    // the same draws, over eight items rather than nine.
    const before: Record<number, [number, number, number, string, string[]][]> = {
      1: [
        [6, 25, 1, 'Goblin Brood', []],
        [2, 39, 2, 'Kobold Nest', ['Ring of Fortune']],
        [18, 28, 2, 'Goblin Brood', []],
      ],
      2: [
        [19, 29, 2, 'Goblin Brood', ['Ring of Fortune']],
        [21, 34, 2, 'Kobold Nest', ['Hawkeye Bow']],
        [12, 30, 2, 'Goblin Brood', []],
      ],
      // A spawn at threat 5 comes first here: the draws after it are unchanged all the same.
      3: [
        [23, 30, 2, 'Goblin Brood', ['Emberblade']],
        [17, 10, 2, 'Kobold Nest', ['Wand of Storms']],
      ],
      4: [
        [11, 36, 2, 'Goblin Brood', ['Wand of Storms']],
        [16, 9, 2, 'Kobold Nest', ['Cloak of Shadows']],
      ],
    }
    for (const [seed, expected] of Object.entries(before)) {
      const { game, world } = solo(Number(seed))
      for (let d = 0; d < 3; d++) {
        corruptWhere(world, (threat) => threat <= 2)
        world.spawnPressure = SPAWN_COST
        passTurn(world, presences(game.parties))
      }
      const low = spawns(world)
        .filter((l) => l.threat <= 2)
        .map((l) => {
          const { col, row } = hexToOffset(l.position)
          return [col, row, l.threat, l.name, l.loot.map((item) => item.name)]
        })
      expect(low).toEqual(expected)
    }
  })

  it('leaves a party that waits at home a threat-1 nest to fight, however long it waits', () => {
    const { game, world } = solo(3)
    days(game, 400)
    expect(world.status).toBe('playing')
    const home = world.locations.find((l) => l.id === ENCAMPMENT_ID)!.position
    const near = lairs(world).filter((l) => hexDistance(home, l.position) < THREAT_BAND)
    expect(near.length).toBeGreaterThan(0)
    expect(near.every((l) => l.threat === 1)).toBe(true)
  })
})

describe('clearLocation', () => {
  it('cleanses the land within 1 + threat of a beaten location by two levels', () => {
    const { game, world } = solo(1)
    const lair = lairs(world).find((l) => l.threat === 3)!
    const before = world.blight.slice()
    clearLocation(game, lair.id)
    world.blight.forEach((level, i) => {
      const h = boardHex(world.board, i)
      const near = hexDistance(h, lair.position) <= 1 + lair.threat
      const pinned = lairs(world).some((l) => l.position.q === h.q && l.position.r === h.r)
      expect(level).toBe(near && !pinned ? Math.max(0, before[i] - CLEANSE_LEVELS) : before[i])
    })
  })

  it('wins the game when the Source is beaten', () => {
    const { game, world } = solo(1)
    clearLocation(game, lairs(world)[0].id)
    expect(world.status).toBe('playing')
    clearLocation(game, SOURCE_ID)
    expect(world.status).toBe('won')
    world.status = 'endless'
    expect(days(game, 1)).toBeDefined()
    expect(world.status).toBe('endless')
  })
})

describe('blightAt', () => {
  it('is 0 off the map', () => {
    expect(blightAt(newWorld(1), offsetToHex(-1, 0))).toBe(0)
  })
})

/**
 * Today's numbers, pinned from the code before the world's rules took a list of
 * parties (stage 5 step 02): a list of one must give them exactly. Only `pinned`,
 * which builds the rules' argument for the party, may change.
 */
describe('the numbers of one party, pinned', () => {
  const members = [{ level: 3 }, { level: 4 }, { level: 5 }]
  const stands = { q: 34, r: 19 }
  const pinned = (): PartyPresence[] => [{ position: stands, levels: members.map((m) => m.level) }]
  /** A party of strength 8 standing on corrupted land beside the Source's corruption, on day 45 (growth 1.1). */
  const scene = (): WorldState => {
    const world = newWorld(1)
    world.turn = 45
    setLevel(world, stands, MAX_BLIGHT)
    return world
  }
  const sha = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex')

  it('gives the same net influence about the party', () => {
    const world = scene()
    const at = (q: number, r: number) => netInfluence(world, pinned(), { q, r })
    expect(at(34, 19)).toBe(-8) // the party's hex, neutral
    expect([at(35, 19), at(35, 18), at(34, 18), at(33, 19), at(33, 20), at(34, 20)]).toEqual([
      4, 4, -1.5, -2.5999999999999996, -2.5999999999999996, 0.7000000000000011,
    ])
    expect(at(26, 19)).toBe(4.4) // at the party's reach
    expect(at(25, 19)).toBe(4.4) // beyond it
    expect(at(36, 17)).toBe(6.100000000000001) // beside corrupted land
  })

  it('gives the same days: events, levels, counters, spawns and the world RNG', () => {
    const world = scene()
    world.spawnPressure = SPAWN_COST - 0.01
    const events: WorldEvent[] = []
    for (let d = 0; d < 30; d++) events.push(...passTurn(world, pinned()))
    expect(events.length).toBe(663)
    expect(sha(events)).toBe('e4d8c398717c3c242985e77f3a7a49f62a7d75eb8794df86beebf0708355ab58')
    expect(events.filter((e) => e.type === 'spawned')).toEqual([
      { type: 'spawned', location: 'spawn_1', name: 'Goblin Brood', at: { q: 44, r: 23 }, threat: 5 },
      { type: 'spawned', location: 'spawn_2', name: 'Bandit Gang', at: { q: 35, r: 36 }, threat: 5 },
      { type: 'spawned', location: 'spawn_3', name: 'Kobold Nest', at: { q: 34, r: 28 }, threat: 4 },
    ])
    expect(world.spawnPressure).toBe(28.11)
    expect(world.spawns).toBe(3)
    expect(world.rng).toBe(1135788947)
    const cell = (q: number, r: number) => [world.blight[boardIndex(world.board, { q, r })], world.shift[boardIndex(world.board, { q, r })]]
    expect([cell(34, 19), cell(34, 18), cell(33, 19), cell(34, 20)]).toEqual([
      [0, 0],
      [2, -9.900000000000004],
      [1, -11],
      [2, 52.80000000000003],
    ])
    expect(sha([world.blight, world.shift, world.seen])).toBe('3a9e5cc9fe7b870e85a089bb1dcb5245203346687cd773a02c79fc2c292d9918')
  })

  it('gives the same blight days alone', () => {
    const world = scene()
    world.spawnPressure = SPAWN_COST - 0.01
    const events: WorldEvent[] = []
    for (let d = 0; d < 30; d++) {
      world.turn++
      events.push(...advanceDay(world, pinned()))
    }
    expect(events.length).toBe(645)
    expect(sha(events)).toBe('aa2219ab17b432b4186ad4d2eb48bb02530b00fdd8359716cfd1fa10512dc9ba')
    expect(world.spawnPressure).toBe(28.11)
    expect(world.rng).toBe(1135788947)
    expect(sha([world.blight, world.shift])).toBe('4666e8b2d21011b459a503b3c5bf8a65a5b5c5487c0abe39a6cc7d28e6a8bd8c')
  })
})

describe('the rules over several parties', () => {
  /** Two parties east of home: one of strength 8, one of strength 4, three hexes apart. */
  const a: PartyPresence = { position: { q: 30, r: 19 }, levels: [3, 4, 5] }
  const b: PartyPresence = { position: { q: 33, r: 19 }, levels: [2, 2] }
  const reach = (p: PartyPresence, h: Hex) => Math.max(0, partyStrength(p.levels) - hexDistance(p.position, h))

  it('adds every party’s reach to the clean side', () => {
    const world = newWorld(1)
    for (const h of [{ q: 31, r: 20 }, { q: 36, r: 19 }, { q: 28, r: 17 }, { q: 45, r: 19 }]) {
      const alone = netInfluence(world, [], h)
      expect(netInfluence(world, [a, b], h)).toBeCloseTo(alone - reach(a, h) - reach(b, h))
      expect(netInfluence(world, [a], h)).toBeCloseTo(alone - reach(a, h))
    }
    expect(reach(a, { q: 31, r: 20 })).toBeGreaterThan(0)
    expect(reach(b, { q: 31, r: 20 })).toBeGreaterThan(0)
  })

  it('makes every party’s hex neutral, and lets no corruption creep from either', () => {
    const world = newWorld(1)
    const source = lairs(world).find((l) => l.id === SOURCE_ID)!
    // Deep in the Source's corruption, where the blight wins every other hex.
    const near: PartyPresence = { position: { q: source.position.q - 3, r: source.position.r }, levels: [1] }
    const far: PartyPresence = { position: { q: source.position.q - 3, r: source.position.r + 2 }, levels: [1] }
    const between = { q: source.position.q - 3, r: source.position.r + 1 }
    for (const p of [near, far]) {
      setLevel(world, p.position, MAX_BLIGHT)
      expect(netInfluence(world, [near, far], p.position)).toBeLessThan(0)
    }
    // Without `far` in the list, its hex is the blight's.
    expect(netInfluence(world, [near], far.position)).toBeGreaterThan(0)
    // `between` neighbours both: with both parties there, neither corrupted hex creeps onto it.
    const withBoth = netInfluence(world, [near, far], between)
    setLevel(world, near.position, 2)
    setLevel(world, far.position, 2)
    expect(netInfluence(world, [near, far], between)).toBeCloseTo(withBoth)
    setLevel(world, near.position, MAX_BLIGHT)
    setLevel(world, far.position, MAX_BLIGHT)
    expect(netInfluence(world, [near], between)).toBeGreaterThan(netInfluence(world, [near, far], between) + reach(far, between))
    // And the days bear it out: neither party's hex rises, though the land about them is the blight's.
    setLevel(world, near.position, 1)
    setLevel(world, far.position, 1)
    for (let d = 0; d < SHIFT_COST; d++) passTurn(world, [near, far])
    expect(blightAt(world, near.position)).toBeLessThanOrEqual(1)
    expect(blightAt(world, far.position)).toBeLessThanOrEqual(1)
  })

  it('spawns clear of every party', () => {
    /** Corrupts the land within 6 of `a` and cleans the rest, and forces a spawn: the nest must land 4 to 6 from `a`, and only the rule keeps it from `b`. */
    const a: PartyPresence = { position: offsetToHex(20, 12), levels: [1] }
    const b: PartyPresence = { position: offsetToHex(26, 12), levels: [1] }
    const nestsBeside = (parties: PartyPresence[]) =>
      Array.from({ length: 20 }, (_, k) => {
        const world = newWorld(k + 1)
        world.blight.forEach((_, i) => {
          const h = boardHex(world.board, i)
          const near = hexDistance(a.position, h) <= 6 && world.locations.every((l) => hexDistance(l.position, h) >= 2)
          world.blight[i] = near ? MAX_BLIGHT : 0
        })
        world.spawnPressure = SPAWN_COST
        passTurn(world, parties)
        return spawns(world)
      }).flat()
    const both = nestsBeside([a, b])
    expect(both.length).toBeGreaterThan(10)
    for (const nest of both) for (const p of [a, b]) expect(hexDistance(p.position, nest.position)).toBeGreaterThanOrEqual(SPAWN_CLEARANCE)
    // Without `b` in the list, some nest lands too near it: the test can tell.
    expect(nestsBeside([a]).some((nest) => hexDistance(b.position, nest.position) < SPAWN_CLEARANCE)).toBe(true)
  })
})
