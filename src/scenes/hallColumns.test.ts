import { describe, expect, it } from 'vitest'
import { formParty } from '../game/company.ts'
import { newGame, type GameState } from '../game/gameState.ts'
import { hallAct, hallColumns } from './hallColumns.ts'

function hall(level = 4): GameState {
  const game = newGame(undefined, null, 1, 'Hearthold')
  game.world.guildHall = level
  return game
}

describe('the hall columns', () => {
  it('lists each party at home, then the reserves', () => {
    const game = hall()
    expect(hallColumns(game).map((c) => [c.party, c.name, c.heroes.length])).toEqual([['party_1', 'First Company', 3], [null, 'Reserves', 0]])
    formParty(game, 'Second Company', { from: 'party', party: 'party_1', index: 0 })
    expect(hallColumns(game).map((c) => c.party)).toEqual(['party_1', 'party_2', null])
  })
  it('moves a hero to a header, passing the refusal through', () => {
    const game = hall()
    expect(hallAct(game, { party: 'party_1', index: 0 }, { party: null })).toBeNull()
    expect(game.reserves).toHaveLength(1)
    expect(hallAct(game, { party: null, index: 0 }, { party: 'party_1' })).toBeNull()
    const first = game.parties[0]
    for (let i = 0; i < 2; i++) hallAct(game, { party: 'party_1', index: 0 }, { party: null })
    expect(first.members).toHaveLength(1)
    expect(hallAct(game, { party: 'party_1', index: 0 }, { party: null })).toMatch(/empty/)
  })
  it('swaps with a hero clicked in another column, reserves or party', () => {
    const game = hall()
    hallAct(game, { party: 'party_1', index: 0 }, { party: null })
    const [reserve] = game.reserves
    const [, b] = game.parties[0].members
    formParty(game, 'Second Company', { from: 'party', party: 'party_1', index: 1 })
    const second = game.parties[1]
    expect(hallAct(game, { party: null, index: 0 }, { party: 'party_2', index: 0 })).toBeNull()
    expect(second.members[0]).toBe(reserve)
    expect(game.reserves[0]).toBe(b)
    const [mine] = game.parties[0].members
    expect(hallAct(game, { party: 'party_1', index: 0 }, { party: 'party_2', index: 0 })).toBeNull()
    expect(second.members[0]).toBe(mine)
  })
  it('does nothing in the same column', () => {
    expect(hallAct(hall(), { party: 'party_1', index: 0 }, { party: 'party_1', index: 1 })).toBeNull()
  })
})
