import { describe, expect, it } from 'vitest'
import { SHRINE_COSTS } from './buildings.ts'
import { facilities, improveFacility } from './encampment.ts'
import { newGame } from './gameState.ts'

/** A new game at home, with gold, iron and silver enough for anything. */
function rich() {
  const game = newGame(undefined, null, 1, 'Hearthold')
  game.world.stock = { gold: 500, iron: 500, silver: 500 }
  return game
}
const view = (game: ReturnType<typeof newGame>, id: string) => facilities(game).find((f) => f.id === id)!

describe('the encampment', () => {
  it('starts with the guild hall built and the shrine an empty plot', () => {
    const game = newGame(undefined, null, 1, 'Hearthold')
    expect(facilities(game).map((f) => [f.id, f.level])).toEqual([
      ['guild_hall', 1],
      ['shrine', 0],
    ])
    const shrine = view(game, 'shrine')
    expect(shrine.action).toBe('Build')
    expect(shrine.effect).toMatch(/^Not built/)
    expect(shrine.about).toMatch(/Hearthold/)
    expect(shrine.refusal).toMatch(/costs 20 gold/)
    expect(view(game, 'guild_hall').opens).toBe(true)
  })

  it('builds and raises a facility for the stock, through its own rules', () => {
    const game = rich()
    expect(improveFacility(game, 'shrine')).toBeNull()
    expect(game.world.shrine).toBe(1)
    expect(game.world.stock.gold).toBe(500 - SHRINE_COSTS[0].gold!)
    expect(view(game, 'shrine').action).toBe('Raise to level 2')
    expect(improveFacility(game, 'guild_hall')).toBeNull()
    expect(game.world.guildHall).toBe(2)
  })

  it('offers nothing past the top level', () => {
    const game = rich()
    while (improveFacility(game, 'shrine') === null);
    const shrine = view(game, 'shrine')
    expect([shrine.level, shrine.action, shrine.cost, shrine.next, shrine.refusal]).toEqual([shrine.maxLevel, null, null, null, null])
    expect(improveFacility(game, 'shrine')).toMatch(/as great/)
  })

  it('is refused away from home', () => {
    const game = rich()
    game.world.party = { q: game.world.party.q + 1, r: game.world.party.r }
    expect(view(game, 'shrine').refusal).toMatch(/not at Hearthold/)
    expect(improveFacility(game, 'shrine')).toMatch(/at Hearthold/)
  })
})
