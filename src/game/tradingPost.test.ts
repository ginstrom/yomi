import { describe, expect, it } from 'vitest'
import { BASE_ITEMS, IRON_SWORD, SPARK_WAND, itemById } from '../inventory/inventory.ts'
import { newGame } from './gameState.ts'
import { buy, buyPrice, raiseTradingPost, salePrice, sell, sellMaterial, sellables, wares } from './tradingPost.ts'

/** A new game at home, with 100 gold. */
function home() {
  const game = newGame(undefined, null, 1, 'Hearthold')
  game.world.stock = { gold: 100, stone: 50, copper: 50, salt: 4 }
  return game
}

describe('the trading post', () => {
  it('prices a grade at 3 and 8 times the plain price, and pays half, a modifier adding nothing', () => {
    expect(buyPrice(IRON_SWORD)).toBe(12)
    expect(buyPrice(itemById('iron_sword@2')!)).toBe(36)
    expect(buyPrice(itemById('iron_sword@3')!)).toBe(96)
    expect(salePrice(itemById('iron_sword@2')!)).toBe(18)
    expect(salePrice(itemById('iron_sword+balanced1')!)).toBe(6)
    expect(buyPrice(SPARK_WAND)).toBeNull()
    expect(salePrice(SPARK_WAND)).toBe(15)
  })

  it('sells plain items at level 1, and Fine ones from level 2', () => {
    const game = home()
    expect(wares(game.world).every((item) => !item.grade)).toBe(true)
    expect(buy(game, 'iron_sword')).toBeNull()
    expect(game.world.stock.gold).toBe(88)
    expect(game.baggage).toEqual([IRON_SWORD])
    expect(buy(game, 'iron_sword@2')).toMatch(/level 2 trading post/)
    expect(raiseTradingPost(game)).toBeNull()
    expect(wares(game.world).some((item) => item.grade === 2)).toBe(true)
    game.world.stock.gold = 35
    expect(buy(game, 'iron_sword@2')).toMatch(/costs 36 gold/)
    game.world.stock.gold = 36
    expect(buy(game, 'iron_sword@2')).toBeNull()
    expect(game.world.stock.gold).toBe(0)
  })

  it('never sells a modified or enchanted item', () => {
    const game = home()
    expect(buy(game, 'iron_sword+balanced1')).toMatch(/does not sell/)
    expect(buy(game, 'spark_wand')).toMatch(/does not sell/)
    expect(game.world.stock.gold).toBe(100)
  })

  it('buys from the baggage and backpacks for half, never what is worn', () => {
    const game = home()
    game.baggage.push(SPARK_WAND)
    const offered = sellables(game)
    expect(offered.some(({ place }) => place.from === 'worn')).toBe(false)
    const fromPack = offered.find(({ place }) => place.from === 'backpack')!
    const fromBaggage = offered.find(({ place }) => place.from === 'baggage')!
    expect(sell(game, fromPack.place)).toBeNull()
    expect(game.world.stock.gold).toBe(100 + fromPack.price)
    expect(sell(game, fromBaggage.place)).toBeNull()
    expect(game.world.stock.gold).toBe(100 + fromPack.price + 15)
    expect(game.baggage).toEqual([])
    const worn = { from: 'worn' as const, member: 0, slot: 'mainHand' as const, itemId: game.party[0].equipment.mainHand!.id }
    expect(sell(game, worn)).toMatch(/Take it off/)
  })

  it('refuses a stale selection, changing nothing', () => {
    const game = home()
    const { place } = sellables(game)[0]
    expect(sell(game, place)).toBeNull()
    const gold = game.world.stock.gold
    expect(sell(game, place)).toMatch(/no longer there/)
    expect(game.world.stock.gold).toBe(gold)
  })

  it('buys materials in pairs, a gold piece a pair, and never gold', () => {
    const game = home()
    expect(sellMaterial(game, 'salt', 4)).toBeNull()
    expect(game.world.stock).toMatchObject({ gold: 102, salt: 0 })
    expect(sellMaterial(game, 'salt', 2)).toMatch(/only 0 salt/)
    expect(sellMaterial(game, 'stone', 3)).toMatch(/lots of 2/)
    expect(sellMaterial(game, 'gold', 2)).toMatch(/Gold/)
  })

  it('is refused away from home', () => {
    const game = home()
    game.world.party = { q: game.world.party.q + 1, r: game.world.party.r }
    expect(buy(game, 'iron_sword')).toMatch(/at Hearthold/)
    expect(sell(game, sellables(game)[0].place)).toMatch(/at Hearthold/)
    expect(sellMaterial(game, 'salt', 2)).toMatch(/at Hearthold/)
    expect(raiseTradingPost(game)).toMatch(/at Hearthold/)
    expect(game.world.stock.gold).toBe(100)
  })
})

describe('the price list', () => {
  it('prices every plain item with a finite, positive number', () => {
    for (const item of BASE_ITEMS) {
      const price = buyPrice(item)
      expect(Number.isFinite(price), item.id).toBe(true)
      expect(price!, item.id).toBeGreaterThan(0)
    }
  })
})
