import { describe, expect, it } from 'vitest'
import { hexDistance, offsetToHex, type Hex } from '../grid/hex.ts'
import { IMPROVEMENT_STRENGTH, SHRINE_STRENGTH, TOWER_STRENGTH, boardIndex, netInfluence } from './blight.ts'
import {
  IMPROVEMENT_COSTS,
  IMPROVEMENT_LODGE,
  LODGE_COSTS,
  LODGE_LEVEL_LIMIT,
  MAX_LODGE_LEVEL,
  MAX_SHRINE_LEVEL,
  OUTPOST_COST,
  ROADS_REFUSAL,
  SHRINE_COSTS,
  TOWER_COST,
  TOWER_SPACING,
  buildOutpost,
  buildTower,
  canAfford,
  canBuildOutpost,
  canBuildTower,
  describeCost,
  improveRefusal,
  improveSite,
  improveSiteRefusal,
  improvementSite,
  lodgeCost,
  nextImprovement,
  outpostSiteRefusal,
  raiseImprovement,
  raiseLodge,
  raiseShrine,
  shrineCost,
  spend,
} from './buildings.ts'
import { presences } from './expedition.ts'
import { newGame } from './gameState.ts'
import { readyMadeParty } from './party.ts'
import { IMPROVEMENT_YIELD, LOSS_LEVEL, YIELD_DAYS, siteYield, sites, updateTerritory } from './territory.ts'
import { TOWER_VISION, visibleHexes } from './vision.ts'
import { ENCAMPMENT_ID, isNotable, locationAt, passTurn, type MonsterLocation } from './worldMap.ts'

/** A new game on world 1: the game, its world and its one party, the ready-made three, at home. */
function solo() {
  const game = newGame(readyMadeParty(), null, 1)
  return { game, world: game.world, party: game.parties[0] }
}

/** A new game with the party on clean, empty land near home and the stock to build. */
function ready() {
  const it = solo()
  it.party.position = offsetToHex(7, 17)
  expect(locationAt(it.world, it.party.position)).toBeNull()
  expect(it.world.blight[boardIndex(it.world.board, it.party.position)]).toBe(0)
  it.world.stock = { gold: 6, iron: 12, timber: 4 }
  return it
}

describe('the stock', () => {
  it('affords a cost it holds all of, and spends it', () => {
    const stock = { iron: 10, gold: 8, timber: 3 }
    expect(canAfford(stock, TOWER_COST)).toBe(true)
    expect(canAfford({ iron: 10, gold: 4 }, TOWER_COST)).toBe(false)
    expect(canAfford({}, TOWER_COST)).toBe(false)
    spend(stock, TOWER_COST)
    expect(stock).toEqual({ iron: 0, gold: 3, timber: 3 })
    expect(describeCost(TOWER_COST)).toBe('10 iron, 5 gold')
  })
})

describe('a watchtower', () => {
  it('is built where the party stands, for the stock and a day', () => {
    const { game, world, party } = ready()
    expect(canBuildTower(world, party)).toBeNull()
    const events = buildTower(game, party)!
    expect(events[0]).toEqual({ type: 'tower_built', tower: 'tower_1', at: party.position })
    expect(world.towers).toEqual([{ id: 'tower_1', position: party.position }])
    expect(world.stock).toEqual({ gold: 1, iron: 2, timber: 4 })
    expect(world.turn).toBe(2)
  })

  it('is refused without the stock, on tainted land, on a location, beside another tower or among monsters', () => {
    const { game: poorGame, world: poor, party: poorParty } = ready()
    poor.stock = { iron: 9, gold: 5 }
    expect(canBuildTower(poor, poorParty)).toMatch(/costs 10 iron, 5 gold/)
    expect(buildTower(poorGame, poorParty)).toBeNull()
    expect(poor.turn).toBe(1)

    const { world: tainted, party: taintedParty } = ready()
    tainted.blight[boardIndex(tainted.board, taintedParty.position)] = 1
    expect(canBuildTower(tainted, taintedParty)).toMatch(/clean land/)

    const { world: onHome, party: onHomeParty } = ready()
    onHomeParty.position = offsetToHex(9, 19)
    expect(canBuildTower(onHome, onHomeParty)).toMatch(/encampment or a resource/)

    const { game: crowdedGame, world: crowded, party: crowdedParty } = ready()
    buildTower(crowdedGame, crowdedParty)
    expect(canBuildTower(crowded, crowdedParty)).toMatch(/already stands/)
    crowdedParty.position = offsetToHex(7 + TOWER_SPACING - 1, 17)
    crowded.stock = { ...TOWER_COST }
    expect(canBuildTower(crowded, crowdedParty)).toMatch(/apart/)

    const { world: among, party: amongParty } = ready()
    among.locations.push({ ...(among.locations.find((l) => l.kind === 'monsters') as MonsterLocation), id: 'here', position: amongParty.position })
    expect(canBuildTower(among, amongParty)).not.toBeNull()
  })

  it('pushes back the blight with TOWER_STRENGTH and sees TOWER_VISION hexes around', () => {
    const { game, world, party } = ready()
    const at = party.position
    const away = offsetToHex(30, 2)
    party.position = away
    const before = netInfluence(world, presences(game.parties), at)
    party.position = at
    buildTower(game, party)
    party.position = away
    expect(netInfluence(world, presences(game.parties), at)).toBeCloseTo(before - TOWER_STRENGTH * 1.0)
    const visible = visibleHexes(world, presences(game.parties))
    const edge: Hex = { q: at.q, r: at.r - TOWER_VISION }
    expect(hexDistance(at, edge)).toBe(TOWER_VISION)
    expect(visible.has(boardIndex(world.board, edge))).toBe(true)
  })

  it('warns as it comes under threat, and falls at LOSS_LEVEL, its sight with it', () => {
    const { game, world, party } = ready()
    const at = party.position
    buildTower(game, party)
    party.position = offsetToHex(30, 2)
    world.locations.push({
      id: 'besiegers',
      kind: 'monsters',
      name: 'Besiegers',
      position: { q: at.q + 2, r: at.r },
      encounter: 'goblin_raid',
      threat: 5,
      loot: [],
      // As strong as the Source, to outpush Oakvale nearby.
      source: true,
    })
    const warned = passTurn(world, presences(game.parties)).find((e) => e.type === 'site_threatened' && e.site === 'tower_1')
    expect(warned).toMatchObject({ site: 'tower_1', name: 'A watchtower' })
    expect(isNotable(world, warned!, presences(game.parties))).toBe(true)

    world.blight[boardIndex(world.board, at)] = LOSS_LEVEL
    const lost = passTurn(world, presences(game.parties)).find((e) => e.type === 'tower_lost')
    expect(lost).toEqual({ type: 'tower_lost', tower: 'tower_1', at })
    expect(isNotable(world, lost!, presences(game.parties))).toBe(true)
    expect(world.towers).toEqual([])
    expect(visibleHexes(world, presences(game.parties)).has(boardIndex(world.board, { q: at.q, r: at.r - TOWER_VISION }))).toBe(false)
  })
})

describe('the shrine', () => {
  it('is raised a level at a time at Oakvale, for the stock and no time, each level adding SHRINE_STRENGTH to the encampment', () => {
    const { game, world, party } = solo()
    const oakvale = world.locations.find((l) => l.id === ENCAMPMENT_ID)!.position
    world.stock = { gold: 1000, silver: 1000 }
    const away = offsetToHex(30, 2)
    party.position = away
    const before = netInfluence(world, presences(game.parties), oakvale)
    party.position = oakvale
    for (let level = 1; level <= MAX_SHRINE_LEVEL; level++) {
      expect(shrineCost(world)).toEqual(SHRINE_COSTS[level - 1])
      expect(raiseShrine(world, party)).toBeNull()
      expect(world.shrine).toBe(level)
    }
    expect(shrineCost(world)).toBeNull()
    expect(raiseShrine(world, party)).toMatch(/as great as it gets/)
    expect(world.turn).toBe(1)
    const spent = SHRINE_COSTS.reduce((sum, cost) => sum + (cost.gold ?? 0), 0)
    expect(world.stock.gold).toBe(1000 - spent)
    party.position = away
    expect(netInfluence(world, presences(game.parties), oakvale)).toBeCloseTo(before - SHRINE_STRENGTH * MAX_SHRINE_LEVEL)
  })

  it('is refused away from Oakvale or without the stock', () => {
    const { world, party } = solo()
    world.stock = { gold: 1000 }
    party.position = offsetToHex(7, 17)
    expect(raiseShrine(world, party)).toMatch(/at Oakvale/)
    party.position = world.locations.find((l) => l.id === ENCAMPMENT_ID)!.position
    world.stock = { gold: 19 }
    expect(raiseShrine(world, party)).toMatch(/costs 20 gold/)
    expect(world.shrine).toBe(0)
    expect(world.stock).toEqual({ gold: 19 })
  })
})

describe('an outpost', () => {
  /** A new world with the party at held Stonebridge and the stock to build. */
  function atStonebridge() {
    const it = solo()
    it.world.held = [...new Set([...it.world.held, 'gold_seam'])]
    it.party.position = it.world.locations.find((l) => l.id === 'gold_seam')!.position
    it.world.stock = { gold: 20, timber: 12 }
    return it
  }

  it('is built at the held site the party stands on, for the stock and a day', () => {
    const { game, world, party } = atStonebridge()
    expect(canBuildOutpost(world, party)).toBeNull()
    const events = buildOutpost(game, party)!
    expect(events[0]).toEqual({ type: 'site_improved', site: 'gold_seam', name: 'Gold Seam', level: 1, building: 'Outpost' })
    expect(world.improvements).toEqual({ gold_seam: 1 })
    expect(world.stock).toEqual({ gold: 5, timber: 2 })
    expect(world.turn).toBe(2)
    expect(canBuildOutpost(world, party)).toMatch(/already has an outpost/)
  })

  it('is refused off a held site, at Oakvale, or without the stock', () => {
    const { world: empty, party: emptyParty } = atStonebridge()
    emptyParty.position = offsetToHex(7, 17)
    expect(canBuildOutpost(empty, emptyParty)).toMatch(/held resource/)

    const { world: home, party: homeParty } = atStonebridge()
    homeParty.position = home.locations.find((l) => l.id === ENCAMPMENT_ID)!.position
    expect(canBuildOutpost(home, homeParty)).toMatch(/held resource/)

    const { world: unheld, party: unheldParty } = atStonebridge()
    unheld.held = unheld.held.filter((id) => id !== 'gold_seam')
    expect(canBuildOutpost(unheld, unheldParty)).toMatch(/held resource/)

    const { game: poorGame, world: poor, party: poorParty } = atStonebridge()
    poor.stock = { gold: 15, timber: 9 }
    expect(canBuildOutpost(poor, poorParty)).toBe(`An outpost costs ${describeCost(OUTPOST_COST)}, more than the stock holds.`)
    expect(buildOutpost(poorGame, poorParty)).toBeNull()
    expect(poor.turn).toBe(1)
  })

  it('adds IMPROVEMENT_STRENGTH[1] to its site and IMPROVEMENT_YIELD[1] to what it yields', () => {
    const { game, world, party } = atStonebridge()
    const at = party.position
    const away = offsetToHex(30, 2)
    party.position = away
    const before = netInfluence(world, presences(game.parties), at)
    const goldSeam = sites(world).find((l) => l.id === 'gold_seam')!
    const yieldBefore = siteYield(world, goldSeam).amount
    party.position = at
    buildOutpost(game, party)
    party.position = away
    expect(netInfluence(world, presences(game.parties), at)).toBeCloseTo(before - IMPROVEMENT_STRENGTH[1])
    expect(siteYield(world, goldSeam).amount).toBe(yieldBefore + IMPROVEMENT_YIELD[1])
    world.blight[boardIndex(world.board, at)] = 0
    world.stock = {}
    world.turn = YIELD_DAYS
    const yielded = updateTerritory(world, presences(game.parties)).find((e) => e.type === 'yield' && e.site === 'gold_seam')
    expect(yielded).toMatchObject({ amount: yieldBefore + IMPROVEMENT_YIELD[1] })
  })

  it('is razed when its site is lost', () => {
    const { game, world, party } = atStonebridge()
    buildOutpost(game, party)
    world.blight[boardIndex(world.board, party.position)] = LOSS_LEVEL
    const lost = updateTerritory(world, presences(game.parties)).find((e) => e.type === 'site_lost')
    expect(lost).toEqual({ type: 'site_lost', site: 'gold_seam', name: 'Gold Seam', improvement: 1 })
    expect(world.improvements).toEqual({})
  })
})

/** Two games built alike by `setup`, each moved on to the first day that brings an event. */
function eventfulTwins<T extends ReturnType<typeof solo>>(setup: () => T): [T, T] {
  const scout = setup()
  let quiet = 0
  while (passTurn(scout.world, presences(scout.game.parties)).length === 0) quiet++
  const make = () => {
    const it = setup()
    for (let day = 0; day < quiet; day++) passTurn(it.world, presences(it.game.parties))
    return it
  }
  return [make(), make()]
}

/** Expects `build` to be refused with null, changing nothing in the game. */
function refusedUnchanged(game: ReturnType<typeof solo>['game'], build: () => unknown) {
  const before = JSON.stringify(game)
  expect(build()).toBeNull()
  expect(JSON.stringify(game)).toBe(before)
}

describe('building, as it is (characterization)', () => {
  /** A held Gold Seam to stand on, with the stock for an outpost. */
  function atGoldSeam() {
    const it = solo()
    it.world.held = [...new Set([...it.world.held, 'gold_seam'])]
    it.party.position = it.world.locations.find((l) => l.id === 'gold_seam')!.position
    it.world.stock = { gold: 20, timber: 12 }
    return it
  }

  it('a watchtower is spent for, stands, and then the day passes: the same events and game as by hand', () => {
    const [now, then] = eventfulTwins(ready)
    const turn = now.world.turn
    spend(then.world.stock, TOWER_COST)
    then.world.towersBuilt += 1
    then.world.towers.push({ id: 'tower_1', position: then.party.position })
    const day = passTurn(then.world, presences(then.game.parties))
    expect(day.length).toBeGreaterThan(0)
    expect(buildTower(now.game, now.party)).toEqual([{ type: 'tower_built', tower: 'tower_1', at: now.party.position }, ...day])
    expect(now.world.turn).toBe(turn + 1)
    expect(now.party.confronting).toBeNull()
    expect(JSON.stringify(now.game)).toBe(JSON.stringify(then.game))
  })

  it('an outpost is spent for, stands, and then the day passes: the same events and game as by hand', () => {
    const [now, then] = eventfulTwins(atGoldSeam)
    const turn = now.world.turn
    spend(then.world.stock, OUTPOST_COST)
    then.world.improvements.gold_seam = 1
    const day = passTurn(then.world, presences(then.game.parties))
    expect(day.length).toBeGreaterThan(0)
    expect(buildOutpost(now.game, now.party)).toEqual([{ type: 'site_improved', site: 'gold_seam', name: 'Gold Seam', level: 1, building: 'Outpost' }, ...day])
    expect(now.world.turn).toBe(turn + 1)
    expect(now.party.confronting).toBeNull()
    expect(JSON.stringify(now.game)).toBe(JSON.stringify(then.game))
  })

  it.each(['lost', 'won'] as const)('both are refused, changing nothing, once the game is %s', (status) => {
    const tower = ready()
    tower.world.status = status
    refusedUnchanged(tower.game, () => buildTower(tower.game, tower.party))
    const outpost = atGoldSeam()
    outpost.world.status = status
    refusedUnchanged(outpost.game, () => buildOutpost(outpost.game, outpost.party))
  })

  it('both are refused, changing nothing, without the stock, on the wrong land or among monsters', () => {
    const poorTower = ready()
    poorTower.world.stock = { iron: 9, gold: 5 }
    refusedUnchanged(poorTower.game, () => buildTower(poorTower.game, poorTower.party))
    const tainted = ready()
    tainted.world.blight[boardIndex(tainted.world.board, tainted.party.position)] = 1
    refusedUnchanged(tainted.game, () => buildTower(tainted.game, tainted.party))
    const poorOutpost = atGoldSeam()
    poorOutpost.world.stock = { gold: 15, timber: 9 }
    refusedUnchanged(poorOutpost.game, () => buildOutpost(poorOutpost.game, poorOutpost.party))
    const offSite = atGoldSeam()
    offSite.party.position = offsetToHex(7, 17)
    refusedUnchanged(offSite.game, () => buildOutpost(offSite.game, offSite.party))
    const among = ready()
    const nest = among.world.locations.find((l) => l.kind === 'monsters') as MonsterLocation
    among.world.locations.push({ ...nest, id: 'here', position: among.party.position })
    refusedUnchanged(among.game, () => buildTower(among.game, among.party))
    refusedUnchanged(among.game, () => buildOutpost(among.game, among.party))
  })
})

describe('improvements (economy A1, A2)', () => {
  const RICH = { gold: 500, timber: 100, stone: 100, iron: 100 }
  /** The party on held Gold Seam (a gold resource: its works a Mine), the stock rich and the Lodge at `lodge`. */
  function atGoldSeam(lodge = 0) {
    const it = solo()
    it.world.held = [...new Set([...it.world.held, 'gold_seam'])]
    it.party.position = it.world.locations.find((l) => l.id === 'gold_seam')!.position
    it.world.stock = { ...RICH }
    it.world.lodge = lodge
    return it
  }
  const goldSeam = (it: ReturnType<typeof solo>) => sites(it.world).find((l) => l.id === 'gold_seam')!

  it('cost, need and are named, level by level, and end at the fort', () => {
    const it = atGoldSeam()
    expect(IMPROVEMENT_COSTS).toEqual([{ gold: 15, timber: 10 }, { gold: 30, stone: 15 }, { gold: 50, iron: 20, stone: 10 }])
    expect(OUTPOST_COST).toEqual(IMPROVEMENT_COSTS[0])
    expect(nextImprovement(it.world, goldSeam(it))).toEqual({ level: 1, name: 'Outpost', cost: IMPROVEMENT_COSTS[0], lodge: 0 })
    it.world.improvements.gold_seam = 1
    expect(nextImprovement(it.world, goldSeam(it))).toEqual({ level: 2, name: 'Mine', cost: IMPROVEMENT_COSTS[1], lodge: 1 })
    it.world.improvements.gold_seam = 2
    expect(nextImprovement(it.world, goldSeam(it))).toEqual({ level: 3, name: 'Fort', cost: IMPROVEMENT_COSTS[2], lodge: 2 })
    it.world.improvements.gold_seam = 3
    expect(nextImprovement(it.world, goldSeam(it))).toBeNull()
    expect(IMPROVEMENT_LODGE).toEqual([0, 1, 2])
  })

  it('go only on a held resource the party stands on, never the encampment', () => {
    const it = atGoldSeam()
    expect(improvementSite(it.world, it.party)?.id).toBe('gold_seam')
    it.party.position = it.world.locations.find((l) => l.id === ENCAMPMENT_ID)!.position
    expect(improvementSite(it.world, it.party)).toBeNull()
  })

  it('are refused in order: the place, the level, the Lodge, the stock', () => {
    const off = atGoldSeam()
    off.party.position = offsetToHex(7, 17)
    expect(improveRefusal(off.world, off.party)).toBe('Improvements go on a held resource.')
    const home = atGoldSeam()
    home.party.position = home.world.locations.find((l) => l.id === ENCAMPMENT_ID)!.position
    expect(improveRefusal(home.world, home.party)).toBe('Improvements go on a held resource.')
    const unheld = atGoldSeam()
    unheld.world.held = unheld.world.held.filter((id) => id !== 'gold_seam')
    expect(improveRefusal(unheld.world, unheld.party)).toBe('Improvements go on a held resource.')
    // A site and a nest never share a hex: among monsters is on the nest's.
    const among = atGoldSeam()
    among.party.position = among.world.locations.find((l) => l.kind === 'monsters')!.position
    expect(improveRefusal(among.world, among.party)).toBe('Nothing can be built here now.')
    const over = atGoldSeam(2)
    over.world.status = 'won'
    expect(improveRefusal(over.world, over.party)).toBe('Nothing can be built here now.')
    const fort = atGoldSeam(2)
    fort.world.improvements.gold_seam = 3
    expect(improveRefusal(fort.world, fort.party)).toBe('Gold Seam is as strong as it gets.')
    expect(improveSiteRefusal(fort.world, fort.party)).toBe('Gold Seam is as strong as it gets.')
    const noLodge = atGoldSeam(0)
    noLodge.world.improvements.gold_seam = 1
    expect(improveSiteRefusal(noLodge.world, noLodge.party)).toBeNull()
    expect(improveRefusal(noLodge.world, noLodge.party)).toBe("A Mine needs the Builders' Lodge.")
    const lowLodge = atGoldSeam(1)
    lowLodge.world.improvements.gold_seam = 2
    expect(improveRefusal(lowLodge.world, lowLodge.party)).toBe("A Fort needs the Builders' Lodge at level 2.")
    // The Lodge is told before the stock.
    lowLodge.world.stock = {}
    expect(improveRefusal(lowLodge.world, lowLodge.party)).toBe("A Fort needs the Builders' Lodge at level 2.")
    const poor = atGoldSeam(0)
    poor.world.stock = { gold: 15, timber: 9 }
    expect(improveRefusal(poor.world, poor.party)).toBe('An Outpost costs 15 gold, 10 timber, more than the stock holds.')
    const poorWorks = atGoldSeam(1)
    poorWorks.world.improvements.gold_seam = 1
    poorWorks.world.stock = { gold: 30, stone: 14 }
    expect(improveRefusal(poorWorks.world, poorWorks.party)).toBe('A Mine costs 30 gold, 15 stone, more than the stock holds.')
  })

  it('are raised a level at a time, the stock paying, 1 to 2 to 3', () => {
    const it = atGoldSeam(2)
    const events = [1, 2, 3].map(() => {
      expect(improveRefusal(it.world, it.party)).toBeNull()
      return raiseImprovement(it.world, it.party)
    })
    expect(events).toEqual([
      { type: 'site_improved', site: 'gold_seam', name: 'Gold Seam', level: 1, building: 'Outpost' },
      { type: 'site_improved', site: 'gold_seam', name: 'Gold Seam', level: 2, building: 'Mine' },
      { type: 'site_improved', site: 'gold_seam', name: 'Gold Seam', level: 3, building: 'Fort' },
    ])
    expect(it.world.improvements).toEqual({ gold_seam: 3 })
    expect(it.world.stock).toEqual({ gold: 500 - 15 - 30 - 50, timber: 90, stone: 75, iron: 80 })
    expect(it.world.turn).toBe(1)
    expect(improveRefusal(it.world, it.party)).toBe('Gold Seam is as strong as it gets.')
  })

  it('take a day on the day loop (improveSite), and nothing when refused', () => {
    const it = atGoldSeam(1)
    it.world.improvements.gold_seam = 1
    const events = improveSite(it.game, it.party)!
    expect(events[0]).toEqual({ type: 'site_improved', site: 'gold_seam', name: 'Gold Seam', level: 2, building: 'Mine' })
    expect(it.world.improvements.gold_seam).toBe(2)
    expect(it.world.turn).toBe(2)
    refusedUnchanged(it.game, () => improveSite(it.game, it.party))
  })

  it('a works or fort lifts its site as the table says', () => {
    const it = atGoldSeam(2)
    const at = it.party.position
    it.party.position = offsetToHex(30, 2)
    const net = () => netInfluence(it.world, presences(it.game.parties), at)
    const before = net()
    it.world.improvements.gold_seam = 2
    expect(net()).toBeCloseTo(before - 3)
    expect(siteYield(it.world, goldSeam(it)).amount).toBe(5)
    it.world.improvements.gold_seam = 3
    expect(net()).toBeCloseTo(before - 7)
    expect(siteYield(it.world, goldSeam(it)).amount).toBe(5)
  })

  it('keep the outpost wrappers as they were: any improvement is "already has an outpost"', () => {
    const it = atGoldSeam(2)
    it.world.improvements.gold_seam = 2
    expect(outpostSiteRefusal(it.world, it.party)).toBe('Gold Seam already has an outpost.')
    expect(canBuildOutpost(it.world, it.party)).toBe('Gold Seam already has an outpost.')
    refusedUnchanged(it.game, () => buildOutpost(it.game, it.party))
    const off = atGoldSeam()
    off.party.position = offsetToHex(7, 17)
    expect(outpostSiteRefusal(off.world, off.party)).toBe('An outpost goes on a held resource.')
  })
})

describe('the Builders\' Lodge (economy A2)', () => {
  /** The party at home, the stock rich. */
  function atHome() {
    const it = solo()
    it.world.stock = { gold: 500, timber: 100, stone: 100, iron: 100 }
    return it
  }

  it('costs each level, to MAX_LODGE_LEVEL', () => {
    const { world } = atHome()
    expect(LODGE_COSTS).toEqual([{ gold: 30, timber: 20 }, { gold: 60, stone: 25 }, { gold: 100, iron: 20, stone: 20 }])
    expect(MAX_LODGE_LEVEL).toBe(3)
    expect(LODGE_LEVEL_LIMIT).toBe(2)
    expect([0, 1, 2, 3].map((lodge) => ((world.lodge = lodge), lodgeCost(world)))).toEqual([...LODGE_COSTS, null])
  })

  it('is raised at home to level 1 and 2, the stock paying, and no further until roads', () => {
    const { game, world, party } = atHome()
    expect(raiseLodge(game, party)).toBeNull()
    expect(world.lodge).toBe(1)
    expect(world.stock).toEqual({ gold: 470, timber: 80, stone: 100, iron: 100 })
    expect(raiseLodge(game, party)).toBeNull()
    expect(world.lodge).toBe(2)
    expect(world.stock).toEqual({ gold: 410, timber: 80, stone: 75, iron: 100 })
    expect(raiseLodge(game, party)).toBe(ROADS_REFUSAL)
    expect(ROADS_REFUSAL).toBe('Roads come with trade routes.')
    expect(world.lodge).toBe(2)
    expect(world.stock).toEqual({ gold: 410, timber: 80, stone: 75, iron: 100 })
    // Set to 3 (as the debug console may), it is refused the same.
    world.lodge = 3
    expect(raiseLodge(game, party)).toBe(ROADS_REFUSAL)
  })

  it('is refused away from home or without the stock, changing nothing', () => {
    const away = atHome()
    away.party.position = offsetToHex(7, 17)
    expect(raiseLodge(away.game, away.party)).toBe(`The Builders' Lodge is at ${away.world.locations.find((l) => l.id === ENCAMPMENT_ID)!.name}.`)
    expect(away.world.lodge).toBe(0)
    const poor = atHome()
    poor.world.stock = { gold: 30, timber: 19 }
    const before = JSON.stringify(poor.game)
    expect(raiseLodge(poor.game, poor.party)).toBe('The next level costs 30 gold, 20 timber, more than the stock holds.')
    expect(JSON.stringify(poor.game)).toBe(before)
  })
})
