import { describe, expect, it } from 'vitest'
import { blightAt, boardIndex } from './blight.ts'
import { presences, type PartyPresence } from './expedition.ts'
import { newGame } from './gameState.ts'
import { readyMadeParty } from './party.ts'
import { LOSS_LEVEL, YIELD_DAYS, daysToFall, siteYield, sites, updateTerritory } from './territory.ts'
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
