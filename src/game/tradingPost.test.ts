import { describe, expect, it } from 'vitest'
import { BASE_ITEMS, IRON_SWORD, SPARK_WAND, STORM_WAND, itemById } from '../inventory/inventory.ts'
import { leader, newGame } from './gameState.ts'
import type { RuneKey } from '../inventory/runes.ts'
import { MAX_TRADING_POST_LEVEL, TIER_TWO_LEVEL, TRADING_POST_COSTS, VALUES, buy, buyPrice, buyRefusal, buyRune, raiseTradingPost, runePrice, runeSalePrice, runeWares, salePrice, sell, sellMaterial, sellRune, sellables, sells, wares } from './tradingPost.ts'

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
    expect(buyPrice(STORM_WAND)).toBeNull()
    expect(salePrice(STORM_WAND)).toBe(25)
    // The Wand of Sparks is plain: the wand family's tier 1, sold and bought as it was valued.
    expect(buyPrice(SPARK_WAND)).toBe(30)
    expect(salePrice(SPARK_WAND)).toBe(15)
  })

  it('sells plain items at level 1, and Fine ones from level 2', () => {
    const game = home()
    expect(wares(game.world).every((item) => !item.grade)).toBe(true)
    expect(buy(game, 'iron_sword')).toBeNull()
    expect(game.world.stock.gold).toBe(88)
    expect(leader(game).baggage).toEqual([IRON_SWORD])
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
    expect(buy(game, 'storm_wand')).toMatch(/does not sell/)
    expect(game.world.stock.gold).toBe(100)
  })

  it('buys from the baggage and backpacks for half, never what is worn', () => {
    const game = home()
    leader(game).baggage.push(STORM_WAND)
    const offered = sellables(game)
    expect(offered.some(({ place }) => place.from === 'worn')).toBe(false)
    const fromPack = offered.find(({ place }) => place.from === 'backpack')!
    const fromBaggage = offered.find(({ place }) => place.from === 'baggage')!
    expect(sell(game, fromPack.place)).toBeNull()
    expect(game.world.stock.gold).toBe(100 + fromPack.price)
    expect(sell(game, fromBaggage.place)).toBeNull()
    expect(game.world.stock.gold).toBe(100 + fromPack.price + 25)
    expect(leader(game).baggage).toEqual([])
    const worn = { from: 'worn' as const, member: 0, slot: 'mainHand' as const, itemId: leader(game).members[0].equipment.mainHand!.id }
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
    leader(game).position = { q: leader(game).position.q + 1, r: leader(game).position.r }
    expect(buy(game, 'iron_sword')).toMatch(/at Hearthold/)
    expect(sell(game, sellables(game)[0].place)).toMatch(/at Hearthold/)
    expect(sellMaterial(game, 'salt', 2)).toMatch(/at Hearthold/)
    expect(raiseTradingPost(game)).toMatch(/at Hearthold/)
    expect(game.world.stock.gold).toBe(100)
  })
})

describe('the price list', () => {
  it('prices every plain item with a finite, positive, whole number', () => {
    for (const item of BASE_ITEMS) {
      const price = buyPrice(item)
      expect(Number.isInteger(price), item.id).toBe(true)
      expect(price!, item.id).toBeGreaterThan(0)
    }
  })

  it('prices by family, tier and grade', () => {
    expect(buyPrice(itemById('steel_longsword')!)).toBe(30)
    expect(buyPrice(itemById('steel_longsword@3')!)).toBe(240)
    expect(buyPrice(itemById('steel_longsword@3')!)).toBe(240)
    expect(buyPrice(itemById('steel_armor')!)).toBe(20)
    expect(buyPrice(itemById('wolfhide_boots')!)).toBe(10)
  })

  it('lists tier 1 only below level 4, every family, at grades up to its level', () => {
    const game = home()
    for (const level of [1, 2, 3]) {
      game.world.tradingPost = level
      const listed = wares(game.world)
      expect(listed.every((item) => item.tier === 1)).toBe(true)
      expect(new Set(listed.map((item) => item.family)).size).toBe(28)
      expect(Math.max(...listed.map((item) => item.grade ?? 1))).toBe(level)
      expect(listed).toHaveLength(28 * level)
    }
  })

  it('refuses a tier-2 item below level 4, naming the level', () => {
    const game = home()
    game.world.tradingPost = 3
    expect(buy(game, 'steel_longsword')).toBe('A level 4 trading post sells that.')
    game.world.tradingPost = 2
    expect(buy(game, 'iron_sword@3')).toBe('A level 3 trading post sells that.')
    expect(game.world.stock.gold).toBe(100)
  })
})

describe('trading post level 4', () => {
  it('costs 120 gold and 20 silver, and is the last level', () => {
    expect(TRADING_POST_COSTS[3]).toEqual({ gold: 120, silver: 20 })
    expect(MAX_TRADING_POST_LEVEL).toBe(4)
    const game = home()
    game.world.tradingPost = 3
    game.world.stock = { gold: 130, silver: 25 }
    expect(raiseTradingPost(game)).toBeNull()
    expect(game.world.stock).toMatchObject({ gold: 10, silver: 5 })
    expect(raiseTradingPost(game)).toBe('The trading post is as great as it gets.')
    game.world.tradingPost = 3
    expect(raiseTradingPost(game)).toMatch(/costs/)
  })

  it('sells tier 1 up to grade 3 and tier 2 at every grade from level 4', () => {
    const game = home()
    const tierOne = (grade: number) => itemById(grade === 1 ? 'iron_sword' : `iron_sword@${grade}`)!
    const tierTwo = (grade: number) => itemById(grade === 1 ? 'steel_longsword' : `steel_longsword@${grade}`)!
    for (const level of [1, 2, 3, 4]) {
      game.world.tradingPost = level
      for (const grade of [1, 2, 3]) {
        expect(sells(game.world, tierOne(grade)), `iron ${grade} at ${level}`).toBe(grade <= level)
        expect(sells(game.world, tierTwo(grade)), `steel ${grade} at ${level}`).toBe(level >= TIER_TWO_LEVEL)
      }
    }
    expect(sells(game.world, itemById('iron_sword+balanced1')!)).toBe(false)
    expect(sells(game.world, STORM_WAND)).toBe(false)
  })

  it('lists 56 bases at three grades, tier 1 first and grades ascending', () => {
    const game = home()
    game.world.tradingPost = 4
    const listed = wares(game.world)
    expect(listed).toHaveLength(168)
    expect(listed.slice(0, 84).every((item) => item.tier === 1)).toBe(true)
    expect(listed.slice(84).every((item) => item.tier === 2)).toBe(true)
    const key = (item: (typeof listed)[number]) => (item.tier! - 1) * 3 + (item.grade ?? 1)
    expect(listed.map(key)).toEqual([...listed.map(key)].sort((a, b) => a - b))
  })

  it('narrows by slot and by family', () => {
    const game = home()
    game.world.tradingPost = 4
    const heads = wares(game.world, { slot: 'head' })
    expect(new Set(heads.map((item) => item.family))).toEqual(new Set(['cap', 'helm']))
    expect(new Set(heads.map((item) => item.tier))).toEqual(new Set([1, 2]))
    expect(wares(game.world, { family: 'longsword' }).map((item) => item.id)).toEqual([
      'iron_sword', 'iron_sword@2', 'iron_sword@3', 'steel_longsword', 'steel_longsword@2', 'steel_longsword@3',
    ])
  })

  it('prices tier 2 by the 2.5 multiplier', () => {
    expect(buyPrice(itemById('steel_longsword')!)).toBe(30)
    expect(buyPrice(itemById('steel_longsword@3')!)).toBe(240)
    expect(buyPrice(itemById('ironwood_shield')!)).toBe(25)
    expect(buyPrice(itemById('silk_robe')!)).toBe(25)
  })

  it('sells tier 2 into the baggage', () => {
    const game = home()
    game.world.tradingPost = 4
    expect(buy(game, 'steel_longsword')).toBeNull()
    expect(game.world.stock.gold).toBe(70)
  })
})

describe('the trading post\'s runes', () => {
  const away = () => {
    const game = home()
    leader(game).position = { q: leader(game).position.q + 3, r: leader(game).position.r }
    return game
  }

  it('sells six kinds at rank 1 from level 2 and at rank 2 from level 4', () => {
    const game = home()
    const six = ['ember', 'rime', 'storm', 'stone', 'wind', 'life']
    expect(runeWares(game.world)).toEqual([])
    game.world.tradingPost = 2
    expect(runeWares(game.world)).toEqual(six.map((k) => `${k}1`))
    game.world.tradingPost = 3
    expect(runeWares(game.world)).toHaveLength(6)
    game.world.tradingPost = 4
    expect(runeWares(game.world)).toEqual([...six.map((k) => `${k}1`), ...six.map((k) => `${k}2`)])
  })

  it('prices runes by rank and pays a third', () => {
    expect([1, 2, 3, 4].map((r) => runePrice(`dawn${r}` as RuneKey))).toEqual([15, 45, 135, 405])
    expect([1, 2, 3, 4].map((r) => runeSalePrice(`ember${r}` as RuneKey))).toEqual([5, 15, 45, 135])
  })

  it('buys into the pouch, and refuses without changing anything', () => {
    const game = home()
    game.world.tradingPost = 2
    expect(buyRune(game, 'ember1')).toBeNull()
    expect(game.world.stock.gold).toBe(85)
    expect(game.runes).toEqual({ ember1: 1 })
    const stock = { ...game.world.stock }
    for (const key of ['venom1', 'dawn1', 'ember2', 'ember3'] as RuneKey[]) expect(buyRune(game, key)).not.toBeNull()
    expect(buyRune(game, 'ember2')).toMatch(/level 4/)
    game.world.tradingPost = 1
    expect(buyRune(game, 'ember1')).toMatch(/level 2/)
    game.world.tradingPost = 2
    game.world.stock.gold = 14
    expect(buyRune(game, 'rime1')).toMatch(/costs 15 gold/)
    expect(game.world.stock.gold).toBe(14)
    expect({ ...game.world.stock, gold: 85 }).toEqual(stock)
    expect(game.runes).toEqual({ ember1: 1 })
    const gone = away()
    gone.world.tradingPost = 2
    expect(buyRune(gone, 'ember1')).toMatch(/trading post is at/)
    expect(gone.runes).toEqual({})
  })

  it('sells any rune from the pouch', () => {
    const game = home()
    game.runes = { dawn3: 1 }
    expect(sellRune(game, 'dawn3')).toBeNull()
    expect(game.world.stock.gold).toBe(145)
    expect(game.runes.dawn3 ?? 0).toBe(0)
    expect(sellRune(game, 'dawn3')).toMatch(/holds no/)
    const gone = away()
    gone.runes = { ember1: 1 }
    expect(sellRune(gone, 'ember1')).toMatch(/trading post is at/)
    expect(gone.runes.ember1).toBe(1)
  })

  it('never sells a runed item, and prices one by its plain item and its runes', () => {
    const runed = itemById('iron_sword@3#ember1')!
    expect(runed).toBeDefined()
    for (let level = 1; level <= 4; level++) {
      const game = home()
      game.world.tradingPost = level
      expect(sells(game.world, runed)).toBe(false)
      expect(buyRefusal(game, runed.id)).toMatch(/does not sell/)
      expect(wares(game.world).some((item) => item.runes?.length)).toBe(false)
    }
    expect(buyPrice(runed)).toBe(buyPrice(itemById('iron_sword@3')!))
    expect(salePrice(runed)).toBe(Math.floor((96 + 15) / 2))
    expect(salePrice(itemById('steel_longsword@3#ember1.rime2')!)).toBe(Math.floor((buyPrice(itemById('steel_longsword@3')!)! + 60) / 2))
    expect(salePrice(itemById('emberblade#dawn1')!)).toBe(Math.floor((VALUES.emberblade + 15) / 2))
  })
})
