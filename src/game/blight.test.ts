import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { hexDistance, hexNeighbors, hexToOffset, offsetToHex, type Hex } from '../grid/hex.ts'
import { ENCOUNTER_BANDS } from './encounters.ts'
import { presences, type PartyPresence } from './expedition.ts'
import { newGame, type GameState } from './gameState.ts'
import {
  BLIGHT_PER_THREAT,
  BLIGHT_THREAT_CAP,
  CLEANSE_LEVELS,
  IMPROVEMENT_STRENGTH,
  PARTNER_STRENGTH,
  ROAD_STRENGTH,
  SITE_STRENGTH,
  MAX_BLIGHT,
  MAX_MONSTER_LOCATIONS,
  SHIFT_COST,
  SPAWN_CLEARANCE,
  SPAWN_COST,
  SPAWN_KINDS,
  advanceDay,
  blightAt,
  blightGrowth,
  boardHex,
  boardIndex,
  netInfluence,
  monsterStrength,
  partyStrength,
  siteStrength,
  SOURCE_STRENGTH,
  type WorldEvent,
} from './blight.ts'
import { readyMadeParty } from './party.ts'
import { YIELD_DAYS } from './territory.ts'
import { ABANDON_AFTER, roadTo, tradeDay, type TradeRoute } from './trade.ts'
import {
  EARLY_SHIFT,
  earlyHex,
  ENCAMPMENT_ID,
  SOURCE_ID,
  THREAT_RINGS,
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
  it('works the sources\u2019 fields out afresh whenever a source changes, as a world never memoised does', () => {
    const { game, world } = solo(1)
    const home = world.locations.find((l) => l.id === ENCAMPMENT_ID)!.position
    const probes = (w: WorldState) => [home, { q: home.q + 4, r: home.r }, { q: home.q + 9, r: home.r - 3 }, ...lairs(w).map((l) => ({ q: l.position.q + 1, r: l.position.r }))]
    const net = (w: WorldState) => probes(w).map((h) => netInfluence(w, presences(game.parties), h))
    const fresh = () => net(structuredClone(world))
    const changes: Array<() => void> = [
      () => world.towers.push({ id: 'tower_probe', position: { q: home.q + 4, r: home.r } }),
      () => (lairs(world)[0].threat += 1),
      () => (world.shrine += 1),
      () => world.held.push(world.locations.find((l) => l.kind === 'resource' && !world.held.includes(l.id))!.id),
      () => (world.improvements[world.held.at(-1)!] = 1),
      () => clearLocation(game, lairs(world)[1].id),
      // In place, as no rule does today: the memo must not hold the world's own hexes.
      () => ((lairs(world)[2].position as { q: number }).q += 1),
    ]
    for (const change of changes) {
      expect(net(world)).toEqual(fresh())
      change()
      expect(net(world)).toEqual(fresh())
    }
  })

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

describe('a nest\'s strength, capped (stage 9)', () => {
  const nest = (threat: number, source?: true): MonsterLocation => ({ id: 'n', kind: 'monsters', name: 'Nest', position: { q: 0, r: 0 }, encounter: 'goblin_raid', threat, loot: [], ...(source ? { source } : {}) })

  it('pushes with BLIGHT_PER_THREAT a threat up to BLIGHT_THREAT_CAP, and no harder beyond', () => {
    expect(BLIGHT_THREAT_CAP).toBe(5)
    for (const threat of [1, 3, 5]) expect(monsterStrength(nest(threat))).toBe(BLIGHT_PER_THREAT * threat)
    for (const threat of [7, 9, 12, 15, 18, 20]) expect(monsterStrength(nest(threat))).toBe(BLIGHT_PER_THREAT * 5)
  })

  it('leaves the Source at SOURCE_STRENGTH, whatever its threat', () => {
    for (const threat of [5, 20]) expect(monsterStrength(nest(threat, true))).toBe(SOURCE_STRENGTH)
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
    expect(MAX_MONSTER_LOCATIONS).toBe(60)
    expect(lairs(world).length).toBe(MAX_MONSTER_LOCATIONS)
  })

  /**
   * One forced spawn on each of 80 world seeds, with the land corrupted at the threats `holds` admits: one world
   * (a world and its first day are costly on the 140 × 72 board) copied for each seed, its world RNG set to the seed.
   */
  const forceSpawns = (holds: (threat: number) => boolean): MonsterLocation[] => {
    const { game, world } = solo(1)
    // Clean elsewhere, the Source's corruption included, so every spawn lies at a threat `holds` admits.
    world.blight.forEach((_, i) => {
      if (!holds(threatAt(boardHex(world.board, i)))) world.blight[i] = 0
    })
    corruptWhere(world, holds)
    const spawned: MonsterLocation[] = []
    for (let seed = 1; seed <= 80; seed++) {
      const copy = structuredClone(world)
      copy.rng = seed
      copy.spawnPressure = SPAWN_COST
      passTurn(copy, presences(game.parties))
      spawned.push(...spawns(copy))
    }
    return spawned
  }
  /** The home rings' (threats 1 to 5), and the outer rings' (7 and up), each worked out once for the tests below. */
  let home: MonsterLocation[] | undefined
  let outer: MonsterLocation[] | undefined
  const homeSpawns = () => (home ??= forceSpawns((threat) => threat <= 5))
  const outerSpawns = () => (outer ??= forceSpawns((threat) => threat >= 7))
  const holds = (l: MonsterLocation) => {
    const band = ENCOUNTER_BANDS[l.encounter]
    expect(l.threat, l.name).toBeGreaterThanOrEqual(band.min)
    expect(l.threat, l.name).toBeLessThanOrEqual(band.max)
  }

  // The first test works out both sets: a second or two alone, more on a busy machine.
  it('spawns only kinds whose encounter band holds the threat of where they lie', () => {
    for (const l of [...homeSpawns(), ...outerSpawns()]) holds(l)
  }, 30_000)

  it('spawns in the home rings only today\'s kinds, at every threat from 1 to 5', () => {
    const spawned = homeSpawns()
    expect(spawned.length).toBeGreaterThan(60)
    expect(new Set(spawned.map((l) => l.threat))).toEqual(new Set([1, 2, 3, 4, 5]))
    expect(new Set(spawned.map((l) => l.name))).toEqual(new Set(['Goblin Brood', 'Kobold Nest', 'Bandit Gang']))
  })

  it('spawns a Bandit Gang only from threat 3, and does spawn one there', () => {
    const gangs = [...homeSpawns(), ...outerSpawns()].filter((l) => l.name === 'Bandit Gang')
    expect(new Set(gangs.map((l) => l.threat))).toEqual(new Set([3, 4, 5, 7]))
    for (const l of gangs) expect(l.encounter).toBe('bandit_camp')
  })

  it('spawns in the outer rings, at each of their threats, the kinds whose band holds it and none before its fromThreat', () => {
    const spawned = outerSpawns()
    expect(spawned.length).toBeGreaterThan(60)
    expect(new Set(spawned.map((l) => l.threat))).toEqual(new Set([7, 9, 12, 15, 18]))
    for (const l of spawned) {
      const kind = SPAWN_KINDS.find((k) => k.name === l.name)!
      expect(l.encounter).toBe(kind.encounter)
      expect(l.threat).toBeGreaterThanOrEqual(kind.fromThreat ?? 1)
    }
    // Every new kind spawns somewhere out there.
    expect(new Set(spawned.map((l) => l.name))).toEqual(new Set(SPAWN_KINDS.slice(2).map((k) => k.name)))
  })

  it('has a kind for every ring\'s threat, and at threats 1 to 5 only today\'s three, in their order', () => {
    const eligible = (threat: number) =>
      SPAWN_KINDS.filter((k) => threat >= (k.fromThreat ?? 1) && threat >= ENCOUNTER_BANDS[k.encounter].min && threat <= ENCOUNTER_BANDS[k.encounter].max).map(
        (k) => k.name,
      )
    for (const { threat } of THREAT_RINGS) expect(eligible(threat).length, `threat ${threat}`).toBeGreaterThan(0)
    expect([1, 2, 3, 4, 5].map(eligible)).toEqual([
      ['Goblin Brood', 'Kobold Nest'],
      ['Goblin Brood', 'Kobold Nest'],
      ['Goblin Brood', 'Kobold Nest', 'Bandit Gang'],
      ['Goblin Brood', 'Kobold Nest', 'Bandit Gang'],
      ['Goblin Brood', 'Kobold Nest', 'Bandit Gang'],
    ])
    expect([7, 9, 12, 15, 18].map(eligible)).toEqual([
      ['Bandit Gang', 'Spider Brood', 'Salamander Spring', 'Wolf Pack', 'Worg Band', 'Ogre Camp'],
      ['Spider Brood', 'Salamander Spring', 'Bandit Troop', 'Wolf Pack', 'Worg Band', 'Ogre Camp', 'Wyvern Roost'],
      ['Bandit Troop', 'Wyvern Roost', 'Barrow', 'Basilisk Lair', 'Giant Steading'],
      ['Freebooter Band', 'Giant Steading', 'Golem Ruin', 'Blight Cult', 'Dragon Lair'],
      ['Freebooter Band', 'Blight Cult', 'Dragon Lair', 'Lich Court', 'Wyrm Lair'],
    ])
    // Ring 7's kinds (stage 11 step 08) come after the seven before them, each from threat 7.
    expect(SPAWN_KINDS.slice(7, 10).map((k) => [k.encounter, k.name, k.fromThreat])).toEqual([
      ['wolf_pack', 'Wolf Pack', 7],
      ['worg_riders', 'Worg Band', 7],
      ['ogre_camp', 'Ogre Camp', 7],
    ])
    // Ring 9's (step 09) after them.
    expect(SPAWN_KINDS.slice(10, 11).map((k) => [k.encounter, k.name, k.fromThreat])).toEqual([['wyvern_roost', 'Wyvern Roost', 7]])
    // Ring 12's (step 10) after it.
    expect(SPAWN_KINDS.slice(11, 14).map((k) => [k.encounter, k.name, k.fromThreat])).toEqual([
      ['barrow_wights', 'Barrow', 7],
      ['basilisk_lair', 'Basilisk Lair', 7],
      ['hill_giant_steading', 'Giant Steading', 7],
    ])
    // Ring 15's (step 11) after them.
    expect(SPAWN_KINDS.slice(14, 17).map((k) => [k.encounter, k.name, k.fromThreat])).toEqual([
      ['golem_ruin', 'Golem Ruin', 7],
      ['blight_cult', 'Blight Cult', 7],
      ['young_dragon', 'Dragon Lair', 7],
    ])
    // Ring 18's (step 12) after them.
    expect(SPAWN_KINDS.slice(17).map((k) => [k.encounter, k.name, k.fromThreat])).toEqual([
      ['blight_lich_court', 'Lich Court', 7],
      ['elder_wyrm', 'Wyrm Lair', 7],
    ])
    expect(SPAWN_KINDS.slice(0, 3).map((k) => [k.encounter, k.name, k.fromThreat])).toEqual([
      ['goblin_raid', 'Goblin Brood', undefined],
      ['kobold_scouts', 'Kobold Nest', undefined],
      ['bandit_camp', 'Bandit Gang', undefined],
    ])
  })

  it('spawns at threats 1 and 2 as recorded (before bandits, again on stage 9\'s board): the same places, kinds and loot', () => {
    // Captured from the code before the Bandit Gang joined SPAWN_KINDS: [col, row, threat, name, loot].
    // The loot was captured again when the Wand of Sparks left the enchanted items (stage 3):
    // the same draws, over eight items rather than nine.
    // Re-captured in stage 9 step 04 on the 140 × 72 board (the corrupted hexes, from which a spawn is drawn,
    // are listed by the board's index, so every place moved); the draws are the same code's.
    // Re-captured in stage 9 step 05: the outer rings' nests corrupt the far land, so the list a spawn is drawn
    // from is longer and more of the draws land in the far rings (threat 18 here); the draws are the same code's.
    const before: Record<number, [number, number, number, string, string[]][]> = {
      1: [
        [3, 42, 1, 'Goblin Brood', []],
        [9, 57, 2, 'Kobold Nest', ['Ring of Fortune']],
        [13, 45, 1, 'Goblin Brood', []],
      ],
      // Spawns at threat 18, on the far rings' corruption, come among these: the draws after them are unchanged all the same.
      2: [[8, 51, 2, 'Kobold Nest', ['Hawkeye Bow']]],
      3: [[19, 45, 2, 'Goblin Brood', ['Wand of Storms']]],
      4: [[15, 53, 2, 'Goblin Brood', ['Wand of Storms']]],
    }
    for (const [seed, expected] of Object.entries(before)) {
      const { game } = solo(Number(seed))
      // Captured before the trade partners (stage 8), so on a world without them.
      const world = (game.world = newWorld(Number(seed), undefined, []))
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
    const near = lairs(world).filter((l) => hexDistance(home, l.position) <= THREAT_RINGS[0].upTo)
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
  /** Stage 8's axial hex (q, r), moved with the home country (`EARLY_SHIFT`, stage 9). */
  const moved = (q: number, r: number): Hex => ({ q: q + EARLY_SHIFT.q, r: r + EARLY_SHIFT.r })
  const stands = moved(34, 19)
  const pinned = (): PartyPresence[] => [{ position: stands, levels: members.map((m) => m.level) }]
  /** A party of strength 8 standing on corrupted land beside the Source's corruption, on day 45 (growth 1.1). */
  const scene = (): WorldState => {
    // Pinned before the trade partners (stage 8), so on a world without them; since stage 9, with the Source
    // where it stood then relative to home (the simulator's NEAR_SOURCE).
    const world = newWorld(1, undefined, [], { position: earlyHex(58, 19), threat: 5 })
    world.turn = 45
    setLevel(world, stands, MAX_BLIGHT)
    return world
  }
  const sha = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex')

  it('gives the same net influence about the party', () => {
    const world = scene()
    const at = (q: number, r: number) => netInfluence(world, pinned(), moved(q, r))
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
    // Re-pinned in stage 9 step 04: on the 140 × 72 board the land past stage 8's edges changes level too
    // (663 events before, 962 now), spawn pressure grows by a 840th of the corrupted hexes (a 200th before), and
    // the land beyond 54 hexes of home is the threat 7 ring. The net influence and the cells below are unchanged.
    // Re-pinned in stage 9 step 05: the outer rings' nests push the far land (4970 events), and its corruption
    // grows the spawn pressure, so five spawns, not two, the first of them a threat-4 brood that pushes on
    // the party's neighbours (the cells below). The net influence is unchanged.
    // Re-pinned in stage 11 step 08: ring 7's three spawn kinds joined the eligible ones at threat 9 (six where three
    // were), so the same draw picks a Bandit Troop where it picked a Salamander Spring: the two spawned events' names
    // are all that differ (the events diffed before and after), and nothing else below.
    // Re-pinned in stage 11 step 09: the Wyvern Roost joined the eligible kinds at threats 9 and 12 (seven where six
    // were, two where one was), so the same draws pick a Wyvern Roost at 12 and a Wolf Pack at 9 where they picked
    // Bandit Troops: two spawned events' names are all that differ (the events diffed before and after).
    // Re-pinned in stage 11 step 10: ring 12's three kinds joined the eligible ones at threat 12 (five where two were),
    // so the same draw picks a Giant Steading where it picked a Wyvern Roost: that one spawned event's name is all that
    // differs (the events diffed before and after).
    expect(events.length).toBe(4970)
    expect(sha(events)).toBe('ada503dcc04d5c95511f49e3efb5d5f3db8a2a1ccbc2afa028ebb42183cf3ffb')
    expect(events.filter((e) => e.type === 'spawned')).toEqual([
      { type: 'spawned', location: 'spawn_1', name: 'Goblin Brood', at: moved(36, 24), threat: 4 },
      { type: 'spawned', location: 'spawn_2', name: 'Giant Steading', at: moved(48, 53), threat: 12 },
      { type: 'spawned', location: 'spawn_3', name: 'Bandit Troop', at: moved(62, 33), threat: 9 },
      { type: 'spawned', location: 'spawn_4', name: 'Wolf Pack', at: moved(76, 15), threat: 9 },
      { type: 'spawned', location: 'spawn_5', name: 'Freebooter Band', at: moved(122, 0), threat: 18 },
    ])
    expect(world.spawnPressure).toBe(0)
    expect(world.spawns).toBe(5)
    expect(world.rng).toBe(-1391553733)
    const cell = (q: number, r: number) => [world.blight[boardIndex(world.board, moved(q, r))], world.shift[boardIndex(world.board, moved(q, r))]]
    expect([cell(34, 19), cell(34, 18), cell(33, 19), cell(34, 20)]).toEqual([
      [0, 0],
      [2, -5.399999999999999],
      [1, -11],
      [3, 0],
    ])
    expect(sha([world.blight, world.shift, world.seen])).toBe('ac07a1b85c685de7ed6335ab05e2e96371efd551e128371c2f6a7be820390f60')
  })

  it('gives the same blight days alone', () => {
    const world = scene()
    world.spawnPressure = SPAWN_COST - 0.01
    const events: WorldEvent[] = []
    for (let d = 0; d < 30; d++) {
      world.turn++
      events.push(...advanceDay(world, pinned()))
    }
    // Re-pinned in stage 9 step 04, as above (645 events before); and in step 05, as above (944 before); and in stage 11
    // step 08, as above (the same two spawns' names, nothing else); and in its step 09, as above (two spawns' names);
    // and in its step 10, as above (one spawn's name).
    expect(events.length).toBe(4952)
    expect(sha(events)).toBe('a6ef271099c062ebe8ac3b6dcb20f2ec7b365d7b818a06f49a2b6bfac3032a1f')
    expect(world.spawnPressure).toBe(0)
    expect(world.rng).toBe(-1391553733)
    expect(sha([world.blight, world.shift])).toBe('5881e1d4ad46f156d049e79d5fc709be7538f52121269739fb76d142e590df53')
  })
})

describe('the rules over several parties', () => {
  /** Stage 8's axial hex (q, r), moved with the home country (`EARLY_SHIFT`, stage 9). */
  const moved = (q: number, r: number): Hex => ({ q: q + EARLY_SHIFT.q, r: r + EARLY_SHIFT.r })
  /** Two parties east of home: one of strength 8, one of strength 4, three hexes apart. */
  const a: PartyPresence = { position: moved(30, 19), levels: [3, 4, 5] }
  const b: PartyPresence = { position: moved(33, 19), levels: [2, 2] }
  const reach = (p: PartyPresence, h: Hex) => Math.max(0, partyStrength(p.levels) - hexDistance(p.position, h))

  it('adds every party’s reach to the clean side', () => {
    const world = newWorld(1)
    for (const h of [moved(31, 20), moved(36, 19), moved(28, 17), moved(45, 19)]) {
      const alone = netInfluence(world, [], h)
      expect(netInfluence(world, [a, b], h)).toBeCloseTo(alone - reach(a, h) - reach(b, h))
      expect(netInfluence(world, [a], h)).toBeCloseTo(alone - reach(a, h))
    }
    expect(reach(a, moved(31, 20))).toBeGreaterThan(0)
    expect(reach(b, moved(31, 20))).toBeGreaterThan(0)
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
    const a: PartyPresence = { position: earlyHex(20, 12), levels: [1] }
    const b: PartyPresence = { position: earlyHex(26, 12), levels: [1] }
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

describe('an improved site\'s strength (economy A1)', () => {
  it('is 3, 6, 6 and 10 by improvement level 0 to 3', () => {
    const { world } = solo(1)
    expect(IMPROVEMENT_STRENGTH).toEqual([0, 3, 3, 7])
    const strengths = [0, 1, 2, 3].map((level) => {
      if (level === 0) delete world.improvements.iron_vein
      else world.improvements.iron_vein = level as 1 | 2 | 3
      return siteStrength(world, 'iron_vein')
    })
    expect(strengths).toEqual([SITE_STRENGTH, 6, 6, 10])
  })

  it('moves the fields (their memo is keyed afresh) when a held site is improved', () => {
    const { world } = solo(1)
    const ironVein = world.locations.find((l) => l.id === 'iron_vein')!
    if (!world.held.includes('iron_vein')) world.held.push('iron_vein')
    const net = () => netInfluence(world, [], ironVein.position)
    const before = net()
    world.improvements.iron_vein = 1
    expect(net()).toBeCloseTo(before - 3)
    world.improvements.iron_vein = 3
    expect(net()).toBeCloseTo(before - 7)
    delete world.improvements.iron_vein
    expect(net()).toBeCloseTo(before)
  })
})

describe('a trade partner\'s strength (economy A4)', () => {
  /** The same world with and without its partners, on the same land. */
  function pair() {
    const withPartners = newWorld(1)
    const without = newWorld(1, undefined, [])
    without.blight = withPartners.blight.slice()
    without.shift = withPartners.shift.slice()
    return { withPartners, without }
  }
  const millbrook = (world: WorldState) => world.locations.find((l) => l.id === 'millbrook')!.position

  it('pushes back as a clean source of PARTNER_STRENGTH: 3 on its hex, 2 beside, 1 two out, none beyond', () => {
    const { withPartners, without } = pair()
    expect(PARTNER_STRENGTH).toBe(3)
    const at = millbrook(withPartners)
    const less = (h: Hex) => netInfluence(without, [], h) - netInfluence(withPartners, [], h)
    expect(less(at)).toBeCloseTo(3)
    for (const n of hexNeighbors(at)) expect(less(n)).toBeCloseTo(2)
    expect(less({ q: at.q + 2, r: at.r })).toBeCloseTo(1)
    expect(less({ q: at.q + 3, r: at.r })).toBeCloseTo(0)
  })

  it('pushes the same when silent, and is never held', () => {
    const { withPartners } = pair()
    const at = millbrook(withPartners)
    const before = [netInfluence(withPartners, [], at), netInfluence(withPartners, [], { q: at.q + 1, r: at.r })]
    withPartners.silent.push('millbrook')
    expect([netInfluence(withPartners, [], at), netInfluence(withPartners, [], { q: at.q + 1, r: at.r })]).toEqual(before)
    expect(withPartners.held).not.toContain('millbrook')
  })
})

describe('the roads\' strength (economy A8)', () => {
  /** A world with Millbrook's road open (pushed on directly), and the same land with no routes. */
  function roaded() {
    const world = newWorld(1)
    const road = roadTo(world, 'millbrook')!
    const route: TradeRoute = { id: 'route_millbrook', partner: 'millbrook', road, opened: world.turn, raidedDays: 0, raided: false }
    const bare = newWorld(1)
    bare.blight = world.blight.slice()
    bare.shift = world.shift.slice()
    world.routes.push(route)
    return { world, bare, road, route }
  }
  const everyHex = (world: WorldState) => world.blight.map((_, i) => boardHex(world.board, i))
  const nets = (world: WorldState) => everyHex(world).map((h) => netInfluence(world, [], h))

  it('pushes back as a clean source of ROAD_STRENGTH (1) on each road hex at Lodge 3, and nowhere else', () => {
    const { world, bare, road } = roaded()
    expect(ROAD_STRENGTH).toBe(1)
    world.lodge = 3
    const onRoad = new Set(road.map((h) => boardIndex(world.board, h)))
    everyHex(world).forEach((h, i) => {
      const less = netInfluence(bare, [], h) - netInfluence(world, [], h)
      expect(less).toBeCloseTo(onRoad.has(i) ? ROAD_STRENGTH : 0)
    })
  })

  it('changes nothing at Lodge 2 or below, or with no routes', () => {
    const { world, bare } = roaded()
    for (const lodge of [0, 1, 2]) {
      world.lodge = lodge
      expect(nets(world)).toEqual(nets(bare))
    }
    world.lodge = 3
    world.routes = []
    expect(nets(world)).toEqual(nets(bare))
  })

  it('is worked out again when the Lodge reaches 3, a route opens, and a route is abandoned', () => {
    const { world, bare, road, route } = roaded()
    const at = road[0]
    world.lodge = 2
    const before = netInfluence(world, [], at)
    world.lodge = 3
    expect(netInfluence(world, [], at)).toBeCloseTo(before - ROAD_STRENGTH)
    // A route opening on a world already read.
    world.routes = []
    expect(netInfluence(world, [], at)).toBeCloseTo(before)
    world.routes.push(route)
    expect(netInfluence(world, [], at)).toBeCloseTo(before - ROAD_STRENGTH)
    // Abandoned by tradeDay after ABANDON_AFTER raided days.
    world.silent.push('millbrook')
    route.raidedDays = ABANDON_AFTER - 1
    world.turn = YIELD_DAYS
    expect(tradeDay(world, []).some((e) => e.type === 'route_abandoned')).toBe(true)
    expect(world.routes).toEqual([])
    expect(netInfluence(world, [], at)).toBeCloseTo(netInfluence(bare, [], at))
  })

  it('keeps pushing while a raided route is still open, until it is abandoned', () => {
    const { world, bare, road, route } = roaded()
    world.lodge = 3
    route.raidedDays = ABANDON_AFTER - 2
    expect(netInfluence(bare, [], road[0]) - netInfluence(world, [], road[0])).toBeCloseTo(ROAD_STRENGTH)
  })

  it('pushes once per route, so two roads sharing a hex push twice there', () => {
    const { world, bare, road } = roaded()
    world.lodge = 3
    world.routes.push({ id: 'route_other', partner: 'other', road: [road[0]], opened: 0, raidedDays: 0, raided: false })
    expect(netInfluence(bare, [], road[0]) - netInfluence(world, [], road[0])).toBeCloseTo(2 * ROAD_STRENGTH)
    expect(netInfluence(bare, [], road[1]) - netInfluence(world, [], road[1])).toBeCloseTo(ROAD_STRENGTH)
  })
})
