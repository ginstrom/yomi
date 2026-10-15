import { describe, expect, it } from 'vitest'
import { hexDistance, offsetToHex, type Hex } from '../grid/hex.ts'
import { TOWER_STRENGTH, boardIndex, netInfluence } from './blight.ts'
import { TOWER_COST, TOWER_SPACING, buildTower, canAfford, canBuildTower, describeCost, spend } from './buildings.ts'
import { readyMadeParty } from './party.ts'
import { LOSS_LEVEL } from './territory.ts'
import { TOWER_VISION, visibleHexes } from './vision.ts'
import { isNotable, locationAt, newWorld, passTurn, type MonsterLocation, type WorldState } from './worldMap.ts'

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
