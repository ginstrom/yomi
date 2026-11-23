import { describe, expect, it } from 'vitest'
import { newGame } from '../game/gameState.ts'
import { GOODS_LEVEL } from '../game/tradingPost.ts'
import { buyLabel, goodRows } from './goodsView.ts'

describe('the Goods rows', () => {
  it('are empty below the Market Hall and with no partner contacted', () => {
    const game = newGame(undefined, null, 1, 'Hearthold')
    game.world.tradingPost = GOODS_LEVEL
    expect(goodRows(game.world)).toEqual([])
    game.world.tradingPost = GOODS_LEVEL - 1
    expect(goodRows(game.world)).toEqual([])
  })

  it('read "Mithril, from Stonehollow: 3 gold a unit" once the partner is contacted', () => {
    const game = newGame(undefined, null, 1, 'Hearthold')
    game.world.tradingPost = GOODS_LEVEL
    game.world.contacted = ['stonehollow']
    const rows = goodRows(game.world)
    expect(rows.map((r) => r.label)).toContain('Mithril, from Stonehollow: 3 gold a unit')
    expect(rows[0].id).toBe('good:stonehollow:mithril')
  })

  it('words the buy buttons', () => {
    expect(buyLabel(5)).toBe('Buy 5 for 15 gold')
  })
})
