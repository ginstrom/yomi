import { describe, expect, it } from 'vitest'
import { RING_PROTECTION } from '../inventory/inventory.ts'
import { readyMadeParty } from './party.ts'
import { leader, newGame, partyById, takeLoot } from './gameState.ts'
import type { MonsterLocation } from './worldMap.ts'

describe('newGame', () => {
  it('starts with a party, a world and empty baggage, none of them shared with another game', () => {
    const game = newGame()
    expect(leader(game).baggage).toEqual([])
    expect(leader(game).members).toHaveLength(3)
    expect([game.reserves, game.slot]).toEqual([[], null])
    leader(game).baggage.push(RING_PROTECTION)
    leader(game).members.pop()
    expect(leader(newGame())).toMatchObject({ baggage: [], members: { length: 3 } })
  })
})

describe('the company', () => {
  it('is one idle party, party_1 “First Company”, holding the given members', () => {
    const members = readyMadeParty()
    const game = newGame(members)
    expect(game.parties).toHaveLength(1)
    expect(game.parties[0]).toEqual({ id: 'party_1', name: 'First Company', members, baggage: [], order: { kind: 'idle' } })
    expect(leader(game)).toBe(game.parties[0])
  })

  it('finds a party by id', () => {
    const game = newGame()
    expect(partyById(game, 'party_1')).toBe(leader(game))
    expect(partyById(game, 'party_9')).toBeUndefined()
  })
})

describe('takeLoot', () => {
  const raiders = (game: ReturnType<typeof newGame>) =>
    game.world.locations.find((l) => l.id === 'goblin_raiders') as MonsterLocation

  it('moves a location’s loot into the baggage and tells what was found', () => {
    const game = newGame()
    expect(takeLoot(game, raiders(game))).toEqual([RING_PROTECTION])
    expect(leader(game).baggage).toEqual([RING_PROTECTION])
    // It is found once.
    expect(takeLoot(game, raiders(game))).toEqual([])
    expect(leader(game).baggage).toEqual([RING_PROTECTION])
  })

  it('leaves another game’s loot where it lies', () => {
    const game = newGame()
    takeLoot(game, raiders(game))
    expect(raiders(newGame()).loot).toEqual([RING_PROTECTION])
  })
})
