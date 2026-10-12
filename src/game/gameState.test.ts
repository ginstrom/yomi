import { describe, expect, it } from 'vitest'
import { RING_PROTECTION } from '../inventory/inventory.ts'
import { newGame, takeLoot } from './gameState.ts'
import type { MonsterLocation } from './worldMap.ts'

describe('newGame', () => {
  it('starts with a party, a world and empty baggage, none of them shared with another game', () => {
    const game = newGame()
    expect(game.baggage).toEqual([])
    expect(game.party).toHaveLength(3)
    expect([game.partyLimit, game.slot]).toEqual([3, null])
    game.baggage.push(RING_PROTECTION)
    game.party.pop()
    expect(newGame()).toMatchObject({ baggage: [], party: { length: 3 } })
  })
})

describe('takeLoot', () => {
  const raiders = (game: ReturnType<typeof newGame>) =>
    game.world.locations.find((l) => l.id === 'goblin_raiders') as MonsterLocation

  it('moves a location’s loot into the baggage and tells what was found', () => {
    const game = newGame()
    expect(takeLoot(game, raiders(game))).toEqual([RING_PROTECTION])
    expect(game.baggage).toEqual([RING_PROTECTION])
    // It is found once.
    expect(takeLoot(game, raiders(game))).toEqual([])
    expect(game.baggage).toEqual([RING_PROTECTION])
  })

  it('leaves another game’s loot where it lies', () => {
    const game = newGame()
    takeLoot(game, raiders(game))
    expect(raiders(newGame()).loot).toEqual([RING_PROTECTION])
  })
})
