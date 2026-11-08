import { describe, expect, it } from 'vitest'
import { hexDistance, offsetToHex, type Hex } from '../grid/hex.ts'
import { OUTPOST_STRENGTH, SHRINE_STRENGTH, TOWER_STRENGTH, boardIndex, netInfluence } from './blight.ts'
import {
  MAX_SHRINE_LEVEL,
  OUTPOST_COST,
  SHRINE_COSTS,
  TOWER_COST,
  TOWER_SPACING,
  buildOutpost,
  buildTower,
  canAfford,
  canBuildOutpost,
  canBuildTower,
  describeCost,
  raiseShrine,
  shrineCost,
  spend,
} from './buildings.ts'
import { presences } from './expedition.ts'
import { newGame } from './gameState.ts'
import { readyMadeParty } from './party.ts'
import { LOSS_LEVEL, OUTPOST_YIELD, YIELD_DAYS, siteYield, sites, updateTerritory } from './territory.ts'
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
    expect(events[0]).toEqual({ type: 'outpost_built', site: 'gold_seam', name: 'Gold Seam' })
    expect(world.outposts).toEqual(['gold_seam'])
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

  it('adds OUTPOST_STRENGTH to its site and OUTPOST_YIELD to what it yields', () => {
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
    expect(netInfluence(world, presences(game.parties), at)).toBeCloseTo(before - OUTPOST_STRENGTH)
    expect(siteYield(world, goldSeam).amount).toBe(yieldBefore + OUTPOST_YIELD)
    world.blight[boardIndex(world.board, at)] = 0
    world.stock = {}
    world.turn = YIELD_DAYS
    const yielded = updateTerritory(world, presences(game.parties)).find((e) => e.type === 'yield' && e.site === 'gold_seam')
    expect(yielded).toMatchObject({ amount: yieldBefore + OUTPOST_YIELD })
  })

  it('is razed when its site is lost', () => {
    const { game, world, party } = atStonebridge()
    buildOutpost(game, party)
    world.blight[boardIndex(world.board, party.position)] = LOSS_LEVEL
    const lost = updateTerritory(world, presences(game.parties)).find((e) => e.type === 'site_lost')
    expect(lost).toEqual({ type: 'site_lost', site: 'gold_seam', name: 'Gold Seam', outpost: true })
    expect(world.outposts).toEqual([])
  })
})
