import { describe, expect, it } from 'vitest'
import { MAX_BLIGHT, SHIFT_COST, blightAt, boardIndex, netInfluence, type WorldEvent } from './blight.ts'
import { passDay, setOrder } from './company.ts'
import { PARTY_NAMES, newExpedition, partyId, presences, type PartyPresence } from './expedition.ts'
import { newGame } from './gameState.ts'
import { readyMadeParty } from './party.ts'
import {
  LOSS_LEVEL,
  WORKS_NAMES,
  YIELD_DAYS,
  marketIncome,
  daysToFall,
  improvementName,
  lossLevel,
  siteImprovement,
  siteYield,
  sites,
  updateTerritory,
  withArticle,
  type ImprovementLevel,
  type Material,
} from './territory.ts'
import { roadTo } from './trade.ts'
import { ENCAMPMENT_ID, newWorld, passTurn, travel, type MonsterLocation, type QuietLocation, type WorldState } from './worldMap.ts'

/** A new game on world `seed`: its world and its one party, the ready-made three, at home. */
function solo(seed: number) {
  const game = newGame(readyMadeParty(), null, seed)
  return { game, world: game.world, party: game.parties[0] }
}
const site = (world: WorldState, id: string) => sites(world).find((l) => l.id === id)!
const setLevel = (world: WorldState, l: QuietLocation, level: number) => (world.blight[boardIndex(world.board, l.position)] = level)

/** A threat-5 nest put down two hexes from a site. */
function besiege(world: WorldState, id: string): void {
  const { position } = site(world, id)
  const nest: MonsterLocation = {
    id: 'besiegers', kind: 'monsters', name: 'Besiegers', position: { q: position.q + 2, r: position.r },
    encounter: 'goblin_raid', threat: 5, loot: [],
  }
  world.locations.push(nest)
}

describe('held sites', () => {
  it('start as the encampment and the clean sites about it', () => {
    const world = newWorld(1)
    expect(world.held).toContain(ENCAMPMENT_ID)
    for (const l of sites(world)) expect(world.held.includes(l.id)).toBe(l.id === ENCAMPMENT_ID || blightAt(world, l.position) === 0)
  })

  it('are captured when their land is clean and lost when it is blighted', () => {
    const { game, world } = solo(1)
    const goldSeam = site(world, 'gold_seam')
    const ironVein = site(world, 'iron_vein')
    setLevel(world, goldSeam, 0)
    setLevel(world, ironVein, LOSS_LEVEL)
    world.held = world.held.filter((id) => id !== 'gold_seam')
    if (!world.held.includes('iron_vein')) world.held.push('iron_vein')
    const events = updateTerritory(world, presences(game.parties))
    expect(events).toContainEqual({ type: 'site_captured', site: 'gold_seam', name: 'Gold Seam' })
    expect(events).toContainEqual({ type: 'site_lost', site: 'iron_vein', name: 'Iron Vein' })
    expect(world.held).toContain('gold_seam')
    expect(world.held).not.toContain('iron_vein')
  })

  it('come under threat once, with the days until they fall', () => {
    const { game, world } = solo(1)
    besiege(world, 'gold_seam')
    const days = daysToFall(world, presences(game.parties), site(world, 'gold_seam'))!
    expect(days).toBeGreaterThan(0)
    const first = passTurn(world, presences(game.parties))
    expect(first.find((e) => e.type === 'site_threatened')).toMatchObject({ site: 'gold_seam' })
    expect(passTurn(world, presences(game.parties)).some((e) => e.type === 'site_threatened')).toBe(false)
    expect(world.threatened).toContain('gold_seam')
    // It falls about when it was told it would.
    let fell = 2
    while (world.held.includes('gold_seam')) {
      passTurn(world, presences(game.parties))
      fell++
    }
    expect(Math.abs(fell - days)).toBeLessThanOrEqual(1)
  })

  it('are not threatened where the clean side holds', () => {
    const { game, world } = solo(1)
    expect(daysToFall(world, presences(game.parties), site(world, ENCAMPMENT_ID))).toBeNull()
  })
})

describe('the encampment', () => {
  it('lost to the blight loses the game, and nothing more can be done', () => {
    const { game, world, party } = solo(1)
    setLevel(world, site(world, ENCAMPMENT_ID), LOSS_LEVEL)
    expect(updateTerritory(world, presences(game.parties))).toContainEqual({ type: 'encampment_lost', name: 'Oakvale' })
    expect(world.status).toBe('lost')
    const turn = world.turn
    expect(travel(game, party, { q: party.position.q + 2, r: party.position.r }).walked).toEqual([])
    expect(world.turn).toBe(turn)
  })
})

describe('yields', () => {
  it('come every YIELD_DAYS from each held site, half from a tainted one', () => {
    const { game, world } = solo(1)
    const ironVein = site(world, 'iron_vein')
    world.held = [ENCAMPMENT_ID, 'iron_vein']
    setLevel(world, ironVein, 1)
    world.turn = YIELD_DAYS - 1
    expect(updateTerritory(world, presences(game.parties)).some((e) => e.type === 'yield')).toBe(false)
    world.turn = YIELD_DAYS
    const events = updateTerritory(world, presences(game.parties)).filter((e) => e.type === 'yield')
    expect(events).toContainEqual({ type: 'yield', site: ENCAMPMENT_ID, name: 'Oakvale', ...siteYield(world, site(world, ENCAMPMENT_ID)) })
    expect(events).toContainEqual({ type: 'yield', site: 'iron_vein', name: 'Iron Vein', material: 'iron', amount: siteYield(world, ironVein).amount / 2 })
    // Every held site yields, the ones captured that day too, and the stock is what they yielded.
    expect(events.map((e) => e.site)).toEqual(sites(world).filter((l) => world.held.includes(l.id)).map((l) => l.id))
    expect(world.stock.iron).toBe(siteYield(world, ironVein).amount / 2)
    expect(world.stock.gold).toBe(events.filter((e) => e.type === 'yield' && e.material === 'gold').reduce((sum, e) => sum + (e.type === 'yield' ? e.amount : 0), 0))
  })
})

/** Today's days to fall, pinned before the world's rules took a list of parties (stage 5 step 02). Only `pinned` may change. */
describe('the outer rings\' sites (stage 9)', () => {
  const OUTER: Record<string, Material> = {
    ironwood_grove: 'ironwood', mithril_lode: 'mithril', elder_grove: 'elderwood', adamant_deep: 'adamant',
    wyrmwood_thicket: 'wyrmwood', fallen_star: 'starmetal', heartwood: 'heartwood',
  }

  it('are not held at the start: their land is blighted', () => {
    const { world } = solo(1)
    for (const id of Object.keys(OUTER)) expect(world.held, id).not.toContain(id)
  })

  it('each yield 2 of their material on a yield day while held on clean land', () => {
    for (const [id, material] of Object.entries(OUTER)) {
      const { game, world } = solo(1)
      const far = site(world, id)
      world.held = [ENCAMPMENT_ID, id]
      setLevel(world, far, 0)
      world.turn = YIELD_DAYS
      const events = updateTerritory(world, presences(game.parties)).filter((e) => e.type === 'yield' && e.site === id)
      expect(events, id).toEqual([{ type: 'yield', site: id, name: far.name, material, amount: 2 }])
      expect(world.stock[material], id).toBe(2)
    }
  })
})

describe('the days to fall with one party, pinned', () => {
  const members = [{ level: 3 }, { level: 4 }, { level: 5 }]
  const pinned = (at: PartyPresence['position']): PartyPresence[] => [{ position: at, levels: members.map((m) => m.level) }]

  it('counts the same days for a besieged site, the party’s reach included', () => {
    const fallsIn = (dq: number) => {
      const world = newWorld(1)
      besiege(world, 'gold_seam')
      const { position } = site(world, 'gold_seam')
      return daysToFall(world, pinned({ q: position.q + dq, r: position.r }), site(world, 'gold_seam'))
    }
    expect([-4, -5, -6, -7, -8].map(fallsIn)).toEqual([null, 120, 60, 40, 30])
  })
})

describe('the days to fall with presences', () => {
  it('match the pinned figures for a presence of one, and shorten for none', () => {
    const fallsIn = (dq: number, levels: number[] | null) => {
      const world = newWorld(1)
      besiege(world, 'gold_seam')
      const { position } = site(world, 'gold_seam')
      const presences = levels ? [{ position: { q: position.q + dq, r: position.r }, levels }] : []
      return daysToFall(world, presences, site(world, 'gold_seam'))
    }
    expect([-4, -5, -6, -7, -8].map((dq) => fallsIn(dq, [3, 4, 5]))).toEqual([null, 120, 60, 40, 30])
    expect(fallsIn(0, null)).toBe(30)
  })
})

describe('a garrisoned site', () => {
  /** A game on world 1 with the Gold Seam besieged and a second party, of fresh characters, standing on it. */
  function besiegedWithGuard() {
    const { game, world } = solo(1)
    besiege(world, 'gold_seam')
    const seam = site(world, 'gold_seam')
    setLevel(world, seam, 0)
    world.held = [...new Set([...world.held, 'gold_seam'])]
    game.parties.push(newExpedition(readyMadeParty(), seam.position, partyId(2), PARTY_NAMES[1]))
    return { game, world, seam }
  }

  it('holds for 30 days under a siege that takes it in fewer without a party there', () => {
    const unguarded = besiegedWithGuard()
    unguarded.game.parties.pop()
    for (let day = 0; day < 30; day++) passDay(unguarded.game)
    expect(unguarded.world.held).not.toContain('gold_seam')

    const { game, world, seam } = besiegedWithGuard()
    expect(setOrder(game, partyId(2), { kind: 'garrison' })).toBeNull()
    for (let day = 0; day < 30; day++) {
      expect(passDay(game)).not.toBeNull()
      expect(blightAt(world, seam.position)).toBe(0)
    }
    expect(world.held).toContain('gold_seam')
    expect(game.parties[1].order).toEqual({ kind: 'garrison' })
    expect(game.parties[1].position).toEqual(seam.position)
  })
})

describe('improvements (economy A1)', () => {
  /** Iron Vein held, at `level` of improvement (0 for none), its hex clean and the turn a yield day. */
  function improvedIronVein(level: 0 | ImprovementLevel) {
    const { game, world } = solo(1)
    world.held = [ENCAMPMENT_ID, 'iron_vein']
    if (level !== 0) world.improvements.iron_vein = level
    setLevel(world, site(world, 'iron_vein'), 0)
    world.turn = YIELD_DAYS
    return { game, world }
  }
  const ironYield = (level: 0 | ImprovementLevel, blight: number) => {
    const { game, world } = improvedIronVein(level)
    setLevel(world, site(world, 'iron_vein'), blight)
    return updateTerritory(world, presences(game.parties)).find((e) => e.type === 'yield' && e.site === 'iron_vein')
  }

  it('yield 2, 3, 5 and 5 iron by level 0 to 3, half (rounded down) on tainted land', () => {
    const levels = [0, 1, 2, 3] as const
    expect(levels.map((level) => {
      const { world } = improvedIronVein(level)
      return siteYield(world, site(world, 'iron_vein')).amount
    })).toEqual([2, 3, 5, 5])
    expect(levels.map((level) => ironYield(level, 0))).toEqual(
      [2, 3, 5, 5].map((amount) => ({ type: 'yield', site: 'iron_vein', name: 'Iron Vein', material: 'iron', amount })),
    )
    expect(levels.map((level) => { const e = ironYield(level, 1); return e?.type === 'yield' ? e.amount : null })).toEqual([1, 1, 2, 2])
  })

  it('read the level, 0 for none', () => {
    const { world } = improvedIronVein(2)
    expect(siteImprovement(world, 'iron_vein')).toBe(2)
    expect(siteImprovement(world, 'gold_seam')).toBe(0)
    expect(siteImprovement(world, ENCAMPMENT_ID)).toBe(0)
  })

  it('lose a fort only when corrupted, and everything else at LOSS_LEVEL', () => {
    const { world } = improvedIronVein(3)
    expect(lossLevel(world, 'iron_vein')).toBe(MAX_BLIGHT)
    for (const level of [1, 2] as const) {
      world.improvements.iron_vein = level
      expect(lossLevel(world, 'iron_vein')).toBe(LOSS_LEVEL)
    }
    expect(lossLevel(world, 'gold_seam')).toBe(LOSS_LEVEL)
    expect(lossLevel(world, ENCAMPMENT_ID)).toBe(LOSS_LEVEL)
    expect(lossLevel(world, 'tower_1')).toBe(LOSS_LEVEL)
  })

  it('hold a fort at blight level 2 and lose it at 3; lose works at 2', () => {
    const fort = improvedIronVein(3)
    fort.world.turn = 1
    setLevel(fort.world, site(fort.world, 'iron_vein'), 2)
    expect(updateTerritory(fort.world, presences(fort.game.parties)).some((e) => e.type === 'site_lost')).toBe(false)
    expect(fort.world.held).toContain('iron_vein')
    setLevel(fort.world, site(fort.world, 'iron_vein'), 3)
    expect(updateTerritory(fort.world, presences(fort.game.parties))).toContainEqual({ type: 'site_lost', site: 'iron_vein', name: 'Iron Vein', improvement: 3 })
    expect(fort.world.held).not.toContain('iron_vein')

    const works = improvedIronVein(2)
    works.world.turn = 1
    setLevel(works.world, site(works.world, 'iron_vein'), 2)
    expect(updateTerritory(works.world, presences(works.game.parties))).toContainEqual({ type: 'site_lost', site: 'iron_vein', name: 'Iron Vein', improvement: 2 })
  })

  it('are razed with their site, of every level, and say so in site_lost', () => {
    for (const level of [1, 2, 3] as const) {
      const { game, world } = improvedIronVein(level)
      world.turn = 1
      setLevel(world, site(world, 'iron_vein'), MAX_BLIGHT)
      expect(updateTerritory(world, presences(game.parties))).toContainEqual({ type: 'site_lost', site: 'iron_vein', name: 'Iron Vein', improvement: level })
      expect(world.improvements).toEqual({})
      expect(siteYield(world, site(world, 'iron_vein')).amount).toBe(2)
    }
  })

  it('count a fort\'s days to fall to level 3, others\' to LOSS_LEVEL', () => {
    for (const [level, loss] of [[1, LOSS_LEVEL], [2, LOSS_LEVEL], [3, MAX_BLIGHT]] as const) {
      const { world } = improvedIronVein(level)
      // Two threat-5 nests at its side and no party about: the blight gains even on a fort.
      besiege(world, 'iron_vein')
      const ironVein = site(world, 'iron_vein')
      const second = { ...(world.locations.at(-1) as MonsterLocation), id: 'besiegers_2', position: { q: ironVein.position.q - 2, r: ironVein.position.r } }
      world.locations.push(second)
      setLevel(world, ironVein, 1)
      const net = netInfluence(world, [], ironVein.position)
      expect(net, `level ${level}`).toBeGreaterThan(0)
      const shift = world.shift[boardIndex(world.board, ironVein.position)]
      const expected = Math.ceil((SHIFT_COST - shift) / net) + (loss - 2) * Math.ceil(SHIFT_COST / net)
      expect(daysToFall(world, [], ironVein), `level ${level}`).toBe(expected)
      // At level 2 a works has fallen; a fort still stands its last level.
      setLevel(world, ironVein, 2)
      expect(daysToFall(world, [], ironVein) === 0, `level ${level} at 2`).toBe(level !== 3)
    }
  })

  it('are named Outpost, the works by material, and Fort', () => {
    const { world } = solo(1)
    const materials: Record<string, Material> = {
      iron_vein: 'iron', gold_seam: 'gold', timber_stand: 'timber', peat_bog: 'peat', silver_lode: 'silver',
      old_quarry: 'stone', salt_flats: 'salt', copper_pit: 'copper', crystal_cave: 'crystal',
      ironwood_grove: 'ironwood', mithril_lode: 'mithril', elder_grove: 'elderwood', adamant_deep: 'adamant',
      wyrmwood_thicket: 'wyrmwood', fallen_star: 'starmetal', heartwood: 'heartwood',
    }
    const resources = sites(world).filter((l) => l.kind === 'resource')
    expect(resources.map((l) => l.id).sort()).toEqual(Object.keys(materials).sort())
    for (const resource of resources) {
      expect(improvementName(resource, 1)).toBe('Outpost')
      expect(improvementName(resource, 2)).toBe(WORKS_NAMES[materials[resource.id]])
      expect(improvementName(resource, 3)).toBe('Fort')
    }
    expect(WORKS_NAMES).toEqual({
      iron: 'Mine', gold: 'Mine', silver: 'Mine', copper: 'Mine', crystal: 'Mine',
      timber: 'Lumber Camp', stone: 'Quarry', salt: 'Saltworks', peat: 'Peat Cuttings',
      mithril: 'Mine', adamant: 'Mine', starmetal: 'Mine',
      ironwood: 'Lumber Camp', elderwood: 'Lumber Camp', wyrmwood: 'Lumber Camp', heartwood: 'Lumber Camp',
    })
  })

  it('take their article, a plural name none', () => {
    expect(['Outpost', 'Mine', 'Lumber Camp', 'Quarry', 'Saltworks', 'Peat Cuttings', 'Fort'].map(withArticle)).toEqual([
      'an Outpost', 'a Mine', 'a Lumber Camp', 'a Quarry', 'Saltworks', 'Peat Cuttings', 'a Fort',
    ])
  })
})

describe('market income (economy A3)', () => {
  /** The encampment held alone with Iron Vein, the post at `level`, the encampment's hex at `blight`, on a yield day. */
  function marketDay(level: number, blight = 0, turn = YIELD_DAYS) {
    const { game, world } = solo(1)
    world.held = [ENCAMPMENT_ID, 'iron_vein']
    world.tradingPost = level
    setLevel(world, site(world, ENCAMPMENT_ID), blight)
    world.turn = turn
    const gold = world.stock.gold ?? 0
    const events = updateTerritory(world, presences(game.parties)).filter((e) => e.type === 'yield')
    return { world, events, gained: (world.stock.gold ?? 0) - gold }
  }
  const market = (events: ReturnType<typeof marketDay>['events']) => events.filter((e) => e.type === 'yield' && e.source === 'market')

  it('brings nothing below trading post level 4', () => {
    for (const level of [1, 2, 3]) expect(market(marketDay(level).events), `${level}`).toEqual([])
  })

  it('brings 2, 3 and 5 gold at levels 4 to 6, after the sites\' yields, marked as the market\'s', () => {
    for (const [level, amount] of [[4, 2], [5, 3], [6, 5]] as const) {
      const { world, events, gained } = marketDay(level)
      expect(market(events), `${level}`).toEqual([{ type: 'yield', site: ENCAMPMENT_ID, name: 'Oakvale', material: 'gold', amount, source: 'market' }])
      expect(events[events.length - 1].type === 'yield' && events[events.length - 1].source, `${level}`).toBe('market')
      expect(gained).toBe(events.reduce((sum, e) => sum + (e.type === 'yield' && e.material === 'gold' ? e.amount : 0), 0))
      expect(marketIncome(world)).toBe(amount)
    }
  })

  it('is halved, rounded down, while the encampment\'s hex is tainted: 1, 1 and 2', () => {
    expect([4, 5, 6].map((level) => { const [e] = market(marketDay(level, 1).events); return e.type === 'yield' ? e.amount : null })).toEqual([1, 1, 2])
  })

  it('leaves a site\'s yield without a source, and comes on yield days only', () => {
    const { events } = marketDay(4)
    expect(events.filter((e) => e.type === 'yield' && e.site === 'iron_vein').every((e) => !('source' in e))).toBe(true)
    expect(marketDay(6, 0, YIELD_DAYS - 1).events).toEqual([])
  })
})

describe('trade partners in the territory', () => {
  it('are no sites: never held at the start, captured, lost or yielding, whatever their land', () => {
    const { world } = solo(1)
    expect(sites(world).map((s) => s.id)).not.toContain('millbrook')
    expect(sites(world).every((s) => s.kind === 'encampment' || s.kind === 'resource')).toBe(true)
    expect(world.held).not.toContain('millbrook')
    expect(world.held).not.toContain('saltmere')
    const millbrook = world.locations.find((l) => l.id === 'millbrook')!
    const at = boardIndex(world.board, millbrook.position)
    for (const level of [0, 3, 0]) {
      world.blight[at] = level
      world.turn = YIELD_DAYS * level + YIELD_DAYS
      const events = updateTerritory(world, [])
      expect(events.filter((e) => 'site' in e && e.site === 'millbrook')).toEqual([])
      expect(world.held).not.toContain('millbrook')
    }
  })
})

describe('trade routes in the territory', () => {
  /** World 1 at the Market with Millbrook contacted and a route open to it, on its road as `roadTo` gives it. */
  function routed() {
    const { world } = solo(1)
    world.tradingPost = 4
    world.contacted.push('millbrook')
    world.routes.push({ id: 'route_millbrook', partner: 'millbrook', road: roadTo(world, 'millbrook')!, opened: 1, raidedDays: 0, raided: false })
    return world
  }
  const kinds = (events: readonly WorldEvent[]) => events.map((e) => (e.type === 'yield' ? `yield:${e.source ?? 'site'}` : e.type))

  it('yield on yield days after the sites\', the market\'s and the partners\' events', () => {
    const world = routed()
    world.turn = 2 * YIELD_DAYS
    const saltmere = world.locations.find((l) => l.id === 'saltmere')!
    const types = kinds(updateTerritory(world, [{ position: { ...saltmere.position }, levels: [1, 1, 1] }]))
    expect(types.slice(-3)).toEqual(['partner_contacted', 'yield:route', 'yield:route'])
    expect(types.lastIndexOf('yield:site')).toBeLessThan(types.indexOf('yield:market'))
    expect(types.indexOf('yield:market')).toBeLessThan(types.indexOf('partner_contacted'))
  })

  it('leave a world with no routes yielding exactly as before', () => {
    const plain = solo(1).world
    const routes = routed()
    routes.routes = []
    plain.tradingPost = routes.tradingPost
    plain.contacted = [...routes.contacted]
    plain.turn = routes.turn = 2 * YIELD_DAYS
    const events = updateTerritory(routes, [])
    expect(events).toEqual(updateTerritory(plain, []))
    expect(kinds(events).at(-1)).toBe('yield:market')
    expect(routes.stock).toEqual(plain.stock)
  })
})
