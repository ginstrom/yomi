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
import { readyMadeParty } from './party.ts'
import { LOSS_LEVEL, OUTPOST_YIELD, YIELD_DAYS, siteYield, sites, updateTerritory } from './territory.ts'
import { TOWER_VISION, visibleHexes } from './vision.ts'
import { ENCAMPMENT_ID, isNotable, locationAt, newWorld, passTurn, type MonsterLocation, type WorldState } from './worldMap.ts'

const party = readyMadeParty()

/** A new world with the party on clean, empty land near home and the stock to build. */
function ready(): WorldState {
  const world = newWorld(1)
  world.party = offsetToHex(7, 17)
  expect(locationAt(world, world.party)).toBeNull()
  expect(world.blight[boardIndex(world.board, world.party)]).toBe(0)
  world.stock = { gold: 6, iron: 12, timber: 4 }
  return world
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
    const world = ready()
    expect(canBuildTower(world)).toBeNull()
    const events = buildTower(world, party)!
    expect(events[0]).toEqual({ type: 'tower_built', tower: 'tower_1', at: world.party })
    expect(world.towers).toEqual([{ id: 'tower_1', position: world.party }])
    expect(world.stock).toEqual({ gold: 1, iron: 2, timber: 4 })
    expect(world.turn).toBe(2)
  })

  it('is refused without the stock, on tainted land, on a location, beside another tower or among monsters', () => {
    const poor = ready()
    poor.stock = { iron: 9, gold: 5 }
    expect(canBuildTower(poor)).toMatch(/costs 10 iron, 5 gold/)
    expect(buildTower(poor, party)).toBeNull()
    expect(poor.turn).toBe(1)

    const tainted = ready()
    tainted.blight[boardIndex(tainted.board, tainted.party)] = 1
    expect(canBuildTower(tainted)).toMatch(/clean land/)

    const onTown = ready()
    onTown.party = offsetToHex(9, 19)
    expect(canBuildTower(onTown)).toMatch(/town or a resource/)

    const crowded = ready()
    buildTower(crowded, party)
    expect(canBuildTower(crowded)).toMatch(/already stands/)
    crowded.party = offsetToHex(7 + TOWER_SPACING - 1, 17)
    crowded.stock = { ...TOWER_COST }
    expect(canBuildTower(crowded)).toMatch(/apart/)

    const among = ready()
    among.locations.push({ ...(among.locations.find((l) => l.kind === 'monsters') as MonsterLocation), id: 'here', position: among.party })
    expect(canBuildTower(among)).not.toBeNull()
  })

  it('pushes back the blight with TOWER_STRENGTH and sees TOWER_VISION hexes around', () => {
    const world = ready()
    const at = world.party
    const away = offsetToHex(30, 2)
    world.party = away
    const before = netInfluence(world, party, at)
    world.party = at
    buildTower(world, party)
    world.party = away
    expect(netInfluence(world, party, at)).toBeCloseTo(before - TOWER_STRENGTH * 1.0)
    const visible = visibleHexes(world)
    const edge: Hex = { q: at.q, r: at.r - TOWER_VISION }
    expect(hexDistance(at, edge)).toBe(TOWER_VISION)
    expect(visible.has(boardIndex(world.board, edge))).toBe(true)
  })

  it('warns as it comes under threat, and falls at LOSS_LEVEL, its sight with it', () => {
    const world = ready()
    const at = world.party
    buildTower(world, party)
    world.party = offsetToHex(30, 2)
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
    const warned = passTurn(world, party).find((e) => e.type === 'site_threatened' && e.site === 'tower_1')
    expect(warned).toMatchObject({ site: 'tower_1', name: 'A watchtower' })
    expect(isNotable(world, warned!)).toBe(true)

    world.blight[boardIndex(world.board, at)] = LOSS_LEVEL
    const lost = passTurn(world, party).find((e) => e.type === 'tower_lost')
    expect(lost).toEqual({ type: 'tower_lost', tower: 'tower_1', at })
    expect(isNotable(world, lost!)).toBe(true)
    expect(world.towers).toEqual([])
    expect(visibleHexes(world).has(boardIndex(world.board, { q: at.q, r: at.r - TOWER_VISION }))).toBe(false)
  })
})

describe('the shrine', () => {
  it('is raised a level at a time at Oakvale, for the stock and no time, each level adding SHRINE_STRENGTH to the encampment', () => {
    const world = newWorld(1)
    const oakvale = world.locations.find((l) => l.id === ENCAMPMENT_ID)!.position
    world.stock = { gold: 1000, silver: 1000 }
    const away = offsetToHex(30, 2)
    world.party = away
    const before = netInfluence(world, party, oakvale)
    world.party = oakvale
    for (let level = 1; level <= MAX_SHRINE_LEVEL; level++) {
      expect(shrineCost(world)).toEqual(SHRINE_COSTS[level - 1])
      expect(raiseShrine(world)).toBeNull()
      expect(world.shrine).toBe(level)
    }
    expect(shrineCost(world)).toBeNull()
    expect(raiseShrine(world)).toMatch(/as great as it gets/)
    expect(world.turn).toBe(1)
    const spent = SHRINE_COSTS.reduce((sum, cost) => sum + (cost.gold ?? 0), 0)
    expect(world.stock.gold).toBe(1000 - spent)
    world.party = away
    expect(netInfluence(world, party, oakvale)).toBeCloseTo(before - SHRINE_STRENGTH * MAX_SHRINE_LEVEL)
  })

  it('is refused away from Oakvale or without the stock', () => {
    const world = newWorld(1)
    world.stock = { gold: 1000 }
    world.party = offsetToHex(7, 17)
    expect(raiseShrine(world)).toMatch(/at Oakvale/)
    world.party = world.locations.find((l) => l.id === ENCAMPMENT_ID)!.position
    world.stock = { gold: 19 }
    expect(raiseShrine(world)).toMatch(/costs 20 gold/)
    expect(world.shrine).toBe(0)
    expect(world.stock).toEqual({ gold: 19 })
  })
})

describe('an outpost', () => {
  /** A new world with the party at held Stonebridge and the stock to build. */
  function atStonebridge(): WorldState {
    const world = newWorld(1)
    world.held = [...new Set([...world.held, 'stonebridge'])]
    world.party = world.locations.find((l) => l.id === 'stonebridge')!.position
    world.stock = { gold: 20, timber: 12 }
    return world
  }

  it('is built at the held site the party stands on, for the stock and a day', () => {
    const world = atStonebridge()
    expect(canBuildOutpost(world)).toBeNull()
    const events = buildOutpost(world, party)!
    expect(events[0]).toEqual({ type: 'outpost_built', site: 'stonebridge', name: 'Stonebridge' })
    expect(world.outposts).toEqual(['stonebridge'])
    expect(world.stock).toEqual({ gold: 5, timber: 2 })
    expect(world.turn).toBe(2)
    expect(canBuildOutpost(world)).toMatch(/already has an outpost/)
  })

  it('is refused off a held site, at Oakvale, or without the stock', () => {
    const empty = atStonebridge()
    empty.party = offsetToHex(7, 17)
    expect(canBuildOutpost(empty)).toMatch(/held town or resource/)

    const home = atStonebridge()
    home.party = home.locations.find((l) => l.id === ENCAMPMENT_ID)!.position
    expect(canBuildOutpost(home)).toMatch(/held town or resource/)

    const unheld = atStonebridge()
    unheld.held = unheld.held.filter((id) => id !== 'stonebridge')
    expect(canBuildOutpost(unheld)).toMatch(/held town or resource/)

    const poor = atStonebridge()
    poor.stock = { gold: 15, timber: 9 }
    expect(canBuildOutpost(poor)).toBe(`An outpost costs ${describeCost(OUTPOST_COST)}, more than the stock holds.`)
    expect(buildOutpost(poor, party)).toBeNull()
    expect(poor.turn).toBe(1)
  })

  it('adds OUTPOST_STRENGTH to its site and OUTPOST_YIELD to what it yields', () => {
    const world = atStonebridge()
    const at = world.party
    const away = offsetToHex(30, 2)
    world.party = away
    const before = netInfluence(world, party, at)
    const stonebridge = sites(world).find((l) => l.id === 'stonebridge')!
    const yieldBefore = siteYield(world, stonebridge).amount
    world.party = at
    buildOutpost(world, party)
    world.party = away
    expect(netInfluence(world, party, at)).toBeCloseTo(before - OUTPOST_STRENGTH)
    expect(siteYield(world, stonebridge).amount).toBe(yieldBefore + OUTPOST_YIELD)
    world.blight[boardIndex(world.board, at)] = 0
    world.stock = {}
    world.turn = YIELD_DAYS
    const yielded = updateTerritory(world, party).find((e) => e.type === 'yield' && e.site === 'stonebridge')
    expect(yielded).toMatchObject({ amount: yieldBefore + OUTPOST_YIELD })
  })

  it('is razed when its site is lost', () => {
    const world = atStonebridge()
    buildOutpost(world, party)
    world.blight[boardIndex(world.board, world.party)] = LOSS_LEVEL
    const lost = updateTerritory(world, party).find((e) => e.type === 'site_lost')
    expect(lost).toEqual({ type: 'site_lost', site: 'stonebridge', name: 'Stonebridge', outpost: true })
    expect(world.outposts).toEqual([])
  })
})
