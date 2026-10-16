import { describe, expect, it } from 'vitest'
import { blightAt, boardIndex } from './blight.ts'
import { readyMadeParty } from './party.ts'
import { LOSS_LEVEL, YIELD_DAYS, daysToFall, siteYield, sites, updateTerritory } from './territory.ts'
import { ENCAMPMENT_ID, newWorld, passTurn, travel, type MonsterLocation, type QuietLocation, type WorldState } from './worldMap.ts'

const party = readyMadeParty()
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
    const world = newWorld(1)
    const goldSeam = site(world, 'gold_seam')
    const ironVein = site(world, 'iron_vein')
    setLevel(world, goldSeam, 0)
    setLevel(world, ironVein, LOSS_LEVEL)
    world.held = world.held.filter((id) => id !== 'gold_seam')
    if (!world.held.includes('iron_vein')) world.held.push('iron_vein')
    const events = updateTerritory(world, party)
    expect(events).toContainEqual({ type: 'site_captured', site: 'gold_seam', name: 'Gold Seam' })
    expect(events).toContainEqual({ type: 'site_lost', site: 'iron_vein', name: 'Iron Vein' })
    expect(world.held).toContain('gold_seam')
    expect(world.held).not.toContain('iron_vein')
  })

  it('come under threat once, with the days until they fall', () => {
    const world = newWorld(1)
    besiege(world, 'gold_seam')
    const days = daysToFall(world, party, site(world, 'gold_seam'))!
    expect(days).toBeGreaterThan(0)
    const first = passTurn(world, party)
    expect(first.find((e) => e.type === 'site_threatened')).toMatchObject({ site: 'gold_seam' })
    expect(passTurn(world, party).some((e) => e.type === 'site_threatened')).toBe(false)
    expect(world.threatened).toContain('gold_seam')
    // It falls about when it was told it would.
    let fell = 2
    while (world.held.includes('gold_seam')) {
      passTurn(world, party)
      fell++
    }
    expect(Math.abs(fell - days)).toBeLessThanOrEqual(1)
  })

  it('are not threatened where the clean side holds', () => {
    const world = newWorld(1)
    expect(daysToFall(world, party, site(world, ENCAMPMENT_ID))).toBeNull()
  })
})

describe('the encampment', () => {
  it('lost to the blight loses the game, and nothing more can be done', () => {
    const world = newWorld(1)
    setLevel(world, site(world, ENCAMPMENT_ID), LOSS_LEVEL)
    expect(updateTerritory(world, party)).toContainEqual({ type: 'encampment_lost', name: 'Oakvale' })
    expect(world.status).toBe('lost')
    const turn = world.turn
    expect(travel(world, { q: world.party.q + 2, r: world.party.r }, party).walked).toEqual([])
    expect(world.turn).toBe(turn)
  })
})

describe('yields', () => {
  it('come every YIELD_DAYS from each held site, half from a tainted one', () => {
    const world = newWorld(1)
    const ironVein = site(world, 'iron_vein')
    world.held = [ENCAMPMENT_ID, 'iron_vein']
    setLevel(world, ironVein, 1)
    world.turn = YIELD_DAYS - 1
    expect(updateTerritory(world, party).some((e) => e.type === 'yield')).toBe(false)
    world.turn = YIELD_DAYS
    const events = updateTerritory(world, party).filter((e) => e.type === 'yield')
    expect(events).toContainEqual({ type: 'yield', site: ENCAMPMENT_ID, name: 'Oakvale', ...siteYield(world, site(world, ENCAMPMENT_ID)) })
    expect(events).toContainEqual({ type: 'yield', site: 'iron_vein', name: 'Iron Vein', material: 'iron', amount: siteYield(world, ironVein).amount / 2 })
    // Every held site yields, the ones captured that day too, and the stock is what they yielded.
    expect(events.map((e) => e.site)).toEqual(sites(world).filter((l) => world.held.includes(l.id)).map((l) => l.id))
    expect(world.stock.iron).toBe(siteYield(world, ironVein).amount / 2)
    expect(world.stock.gold).toBe(events.filter((e) => e.type === 'yield' && e.material === 'gold').reduce((sum, e) => sum + (e.type === 'yield' ? e.amount : 0), 0))
  })
})
