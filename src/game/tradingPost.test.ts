import { describe, expect, it } from 'vitest'
import { BASE_ITEMS, IRON_SWORD, SPARK_WAND, STORM_WAND, itemById } from '../inventory/inventory.ts'
import { newGame } from './gameState.ts'
import type { RuneKey } from '../inventory/runes.ts'
import { GOODS_LEVEL, GOOD_PRICE, MAX_TRADING_POST_LEVEL, TIER_TWO_LEVEL, TRADING_POST_COSTS, VALUES, buy, buyPrice, buyRefusal, buyGood, buyGoodRefusal, buyRune, goodsForSale, raiseTradingPost, runePrice, runeSalePrice, runeWares, salePrice, sell, sellMaterial, sellRune, sellables, sells, tradingPostName, wares } from './tradingPost.ts'

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
    expect(buy(game, game.parties[0], 'iron_sword')).toBeNull()
    expect(game.world.stock.gold).toBe(88)
    expect(game.parties[0].baggage).toEqual([IRON_SWORD])
    expect(buy(game, game.parties[0], 'iron_sword@2')).toMatch(/level 2 trading post/)
    expect(raiseTradingPost(game, game.parties[0])).toBeNull()
    expect(wares(game.world).some((item) => item.grade === 2)).toBe(true)
    game.world.stock.gold = 35
    expect(buy(game, game.parties[0], 'iron_sword@2')).toMatch(/costs 36 gold/)
    game.world.stock.gold = 36
    expect(buy(game, game.parties[0], 'iron_sword@2')).toBeNull()
    expect(game.world.stock.gold).toBe(0)
  })

  it('never sells a modified or enchanted item', () => {
    const game = home()
    expect(buy(game, game.parties[0], 'iron_sword+balanced1')).toMatch(/does not sell/)
    expect(buy(game, game.parties[0], 'storm_wand')).toMatch(/does not sell/)
    expect(game.world.stock.gold).toBe(100)
  })

  it('buys from the baggage and backpacks for half, never what is worn', () => {
    const game = home()
    game.parties[0].baggage.push(STORM_WAND)
    const offered = sellables(game, game.parties[0])
    expect(offered.some(({ place }) => place.from === 'worn')).toBe(false)
    const fromPack = offered.find(({ place }) => place.from === 'backpack')!
    const fromBaggage = offered.find(({ place }) => place.from === 'baggage')!
    expect(sell(game, fromPack.place)).toBeNull()
    expect(game.world.stock.gold).toBe(100 + fromPack.price)
    expect(sell(game, fromBaggage.place)).toBeNull()
    expect(game.world.stock.gold).toBe(100 + fromPack.price + 25)
    expect(game.parties[0].baggage).toEqual([])
    const worn = { from: 'worn' as const, party: 'party_1', member: 0, slot: 'mainHand' as const, itemId: game.parties[0].members[0].equipment.mainHand!.id }
    expect(sell(game, worn)).toMatch(/Take it off/)
  })

  it('refuses a stale selection, changing nothing', () => {
    const game = home()
    const { place } = sellables(game, game.parties[0])[0]
    expect(sell(game, place)).toBeNull()
    const gold = game.world.stock.gold
    expect(sell(game, place)).toMatch(/no longer there/)
    expect(game.world.stock.gold).toBe(gold)
  })

  it('buys materials in pairs, a gold piece a pair, and never gold', () => {
    const game = home()
    expect(sellMaterial(game, game.parties[0], 'salt', 4)).toBeNull()
    expect(game.world.stock).toMatchObject({ gold: 102, salt: 0 })
    expect(sellMaterial(game, game.parties[0], 'salt', 2)).toMatch(/only 0 salt/)
    expect(sellMaterial(game, game.parties[0], 'stone', 3)).toMatch(/lots of 2/)
    expect(sellMaterial(game, game.parties[0], 'gold', 2)).toMatch(/Gold/)
  })

  it('buys the outer rings\' materials (stage 9) as any other, in pairs', () => {
    const game = home()
    game.world.stock.mithril = 5
    expect(sellMaterial(game, game.parties[0], 'mithril', 3)).toMatch(/lots of 2/)
    expect(sellMaterial(game, game.parties[0], 'mithril', 4)).toBeNull()
    expect(game.world.stock).toMatchObject({ gold: 102, mithril: 1 })
  })

  it('is refused away from home', () => {
    const game = home()
    game.parties[0].position = { q: game.parties[0].position.q + 1, r: game.parties[0].position.r }
    expect(buy(game, game.parties[0], 'iron_sword')).toMatch(/at Hearthold/)
    expect(sell(game, sellables(game, game.parties[0])[0].place)).toMatch(/at Hearthold/)
    expect(sellMaterial(game, game.parties[0], 'salt', 2)).toMatch(/at Hearthold/)
    expect(raiseTradingPost(game, game.parties[0])).toMatch(/at Hearthold/)
    expect(game.world.stock.gold).toBe(100)
  })
})

describe('the price list', () => {
  it('prices every plain item of tiers 1 and 2 with a finite, positive, whole number, and none above', () => {
    for (const item of BASE_ITEMS) {
      const price = buyPrice(item)
      if (item.tier! >= 3) {
        expect(price, item.id).toBeNull()
        continue
      }
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
    expect(buy(game, game.parties[0], 'steel_longsword')).toBe('A level 4 trading post sells that.')
    game.world.tradingPost = 2
    expect(buy(game, game.parties[0], 'iron_sword@3')).toBe('A level 3 trading post sells that.')
    expect(game.world.stock.gold).toBe(100)
  })
})

describe('trading post level 4', () => {
  it('costs 120 gold and 20 silver', () => {
    expect(TRADING_POST_COSTS[3]).toEqual({ gold: 120, silver: 20 })
    const game = home()
    game.world.tradingPost = 3
    game.world.stock = { gold: 130, silver: 25 }
    expect(raiseTradingPost(game, game.parties[0])).toBeNull()
    expect(game.world.stock).toMatchObject({ gold: 10, silver: 5 })
    expect(raiseTradingPost(game, game.parties[0])).toMatch(/costs/)
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
    expect(buy(game, game.parties[0], 'steel_longsword')).toBeNull()
    expect(game.world.stock.gold).toBe(70)
  })
})

describe('the trading post\'s runes', () => {
  const away = () => {
    const game = home()
    game.parties[0].position = { q: game.parties[0].position.q + 3, r: game.parties[0].position.r }
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
    expect(buyRune(game, game.parties[0], 'ember1')).toBeNull()
    expect(game.world.stock.gold).toBe(85)
    expect(game.runes).toEqual({ ember1: 1 })
    const stock = { ...game.world.stock }
    for (const key of ['venom1', 'dawn1', 'ember2', 'ember3'] as RuneKey[]) expect(buyRune(game, game.parties[0], key)).not.toBeNull()
    expect(buyRune(game, game.parties[0], 'ember2')).toMatch(/level 4/)
    game.world.tradingPost = 1
    expect(buyRune(game, game.parties[0], 'ember1')).toMatch(/level 2/)
    game.world.tradingPost = 2
    game.world.stock.gold = 14
    expect(buyRune(game, game.parties[0], 'rime1')).toMatch(/costs 15 gold/)
    expect(game.world.stock.gold).toBe(14)
    expect({ ...game.world.stock, gold: 85 }).toEqual(stock)
    expect(game.runes).toEqual({ ember1: 1 })
    const gone = away()
    gone.world.tradingPost = 2
    expect(buyRune(gone, gone.parties[0], 'ember1')).toMatch(/trading post is at/)
    expect(gone.runes).toEqual({})
  })

  it('sells any rune from the pouch', () => {
    const game = home()
    game.runes = { dawn3: 1 }
    expect(sellRune(game, game.parties[0], 'dawn3')).toBeNull()
    expect(game.world.stock.gold).toBe(145)
    expect(game.runes.dawn3 ?? 0).toBe(0)
    expect(sellRune(game, game.parties[0], 'dawn3')).toMatch(/holds no/)
    const gone = away()
    gone.runes = { ember1: 1 }
    expect(sellRune(gone, gone.parties[0], 'ember1')).toMatch(/trading post is at/)
    expect(gone.runes.ember1).toBe(1)
  })

  it('never sells a runed item, and prices one by its plain item and its runes', () => {
    const runed = itemById('iron_sword@3#ember1')!
    expect(runed).toBeDefined()
    for (let level = 1; level <= 4; level++) {
      const game = home()
      game.world.tradingPost = level
      expect(sells(game.world, runed)).toBe(false)
      expect(buyRefusal(game, game.parties[0], runed.id)).toMatch(/does not sell/)
      expect(wares(game.world).some((item) => item.runes?.length)).toBe(false)
    }
    expect(buyPrice(runed)).toBe(buyPrice(itemById('iron_sword@3')!))
    expect(salePrice(runed)).toBe(Math.floor((96 + 15) / 2))
    expect(salePrice(itemById('steel_longsword@3#ember1.rime2')!)).toBe(Math.floor((buyPrice(itemById('steel_longsword@3')!)! + 60) / 2))
    expect(salePrice(itemById('emberblade#dawn1')!)).toBe(Math.floor((VALUES.emberblade + 15) / 2))
  })
})

describe('trading post levels 5 and 6', () => {
  it('cost what the table says, and 6 is the last level', () => {
    expect(MAX_TRADING_POST_LEVEL).toBe(6)
    expect(TRADING_POST_COSTS[4]).toEqual({ gold: 160, silver: 30, stone: 20 })
    expect(TRADING_POST_COSTS[5]).toEqual({ gold: 220, silver: 40, crystal: 10 })
    const game = home()
    game.world.tradingPost = 4
    game.world.stock = { gold: 400, silver: 100, stone: 30, crystal: 10 }
    expect(raiseTradingPost(game, game.parties[0])).toBeNull()
    expect(game.world.stock).toEqual({ gold: 240, silver: 70, stone: 10, crystal: 10 })
    expect(raiseTradingPost(game, game.parties[0])).toBeNull()
    expect(game.world.tradingPost).toBe(6)
    expect(game.world.stock).toMatchObject({ gold: 20, silver: 30, crystal: 0 })
    expect(raiseTradingPost(game, game.parties[0])).toBe('The trading post is as great as it gets.')
  })

  it('sell as level 4 does', () => {
    const game = home()
    game.world.tradingPost = 4
    const at4 = wares(game.world).map((i) => i.id)
    const runes4 = runeWares(game.world)
    for (const level of [5, 6]) {
      game.world.tradingPost = level
      expect(wares(game.world).map((i) => i.id)).toEqual(at4)
      expect(runeWares(game.world)).toEqual(runes4)
    }
  })

  it('never sell tier 3 and up (long-campaign stage 10: the workshop forges it)', () => {
    const game = home()
    game.world.tradingPost = 6
    game.world.stock.gold = 10_000
    expect(wares(game.world).every((item) => item.tier! <= 2)).toBe(true)
    for (const id of ['mithril_longsword', 'adamant_breastplate@2', 'starweave_robe@3', 'drake_leather', 'elderwood_bow']) {
      const item = itemById(id)!
      expect(sells(game.world, item), id).toBe(false)
      expect(buyPrice(item), id).toBeNull()
      expect(buyRefusal(game, game.parties[0], id), id).toBe('The trading post does not sell that; the workshop forges it.')
    }
    expect(buy(game, game.parties[0], 'mithril_longsword')).toBe('The trading post does not sell that; the workshop forges it.')
    expect(game.world.stock.gold).toBe(10_000)
    expect(game.parties[0].baggage).toEqual([])
  })

  it('buys a forged item for half its forged worth and its runes; tiers 1 and 2 as before', () => {
    expect(salePrice(itemById('mithril_longsword')!)).toBe(22)
    expect(salePrice(itemById('mithril_longsword#ember1')!)).toBe(Math.floor((45 + 15) / 2))
    expect(salePrice(itemById('mithril_longsword@3+balanced2')!)).toBe(90)
    expect(salePrice(itemById('mithril_longsword@2#ember2')!)).toBe(Math.floor((135 + 45) / 2))
    expect(salePrice(itemById('starmetal_plate@3')!)).toBe(Math.floor(345 / 2))
    expect(salePrice(itemById('steel_longsword@3')!)).toBe(buyPrice(itemById('steel_longsword@3')!)! / 2)
    expect(salePrice(itemById('iron_sword@2')!)).toBe(18)
  })

  it('are named Trading Post, Market, Market Hall and Trading House', () => {
    expect([1, 2, 3, 4, 5, 6].map(tradingPostName)).toEqual(['Trading Post', 'Trading Post', 'Trading Post', 'Market', 'Market Hall', 'Trading House'])
  })
})

describe('partners\' goods at the Market Hall', () => {
  const ALL = ['millbrook', 'saltmere', 'stonehollow', 'elder_glade', 'emberwatch']
  function market(level = GOODS_LEVEL, contacted: string[] = ALL) {
    const game = home()
    game.world.tradingPost = level
    game.world.contacted = [...contacted]
    game.world.silent = []
    return game
  }

  it('are sold from level 5 at 3 gold a unit', () => {
    expect(GOODS_LEVEL).toBe(5)
    expect(GOOD_PRICE).toBe(3)
  })

  it('list nothing below level 5, and the level refusal', () => {
    const game = market(4)
    expect(goodsForSale(game.world)).toEqual([])
    expect(buyGoodRefusal(game, game.parties[0], 'mithril', 1)).toBe("A level 5 trading post sells partners' goods.")
  })

  it('list nothing with no partner contacted, else each good in partner order with the stand-in', () => {
    expect(goodsForSale(market(5, []).world)).toEqual([])
    expect(goodsForSale(market().world).map((o) => `${o.partner}:${o.material}`)).toEqual([
      'millbrook:timber', 'saltmere:salt', 'stonehollow:mithril', 'elder_glade:elderwood', 'elder_glade:wyvern_hide', 'emberwatch:adamant',
    ])
    expect(goodsForSale(market().world)[2]).toEqual({ partner: 'stonehollow', name: 'Stonehollow', material: 'mithril' })
  })

  it('drop a silent partner and take it back when it wakes', () => {
    const game = market()
    game.world.silent = ['stonehollow']
    expect(goodsForSale(game.world).some((o) => o.material === 'mithril')).toBe(false)
    game.world.silent = []
    expect(goodsForSale(game.world).some((o) => o.material === 'mithril')).toBe(true)
  })

  it('refuse in order', () => {
    const game = market()
    const party = game.parties[0]
    game.world.stock.gold = 2
    expect(buyGoodRefusal(game, party, 'starmetal', 0)).toBe('No partner sells starmetal here.')
    game.world.silent = ['stonehollow']
    expect(buyGoodRefusal(game, party, 'mithril', 1)).toBe('No partner sells mithril here.')
    game.world.silent = []
    for (const amount of [0, -1, 1.5]) expect(buyGoodRefusal(game, party, 'mithril', amount), String(amount)).toBe('Buy a whole number of at least 1.')
    expect(buyGoodRefusal(game, party, 'mithril', 1)).toBe('It costs 3 gold, more than the stock holds.')
    game.world.stock.gold = 3
    expect(buyGoodRefusal(game, party, 'mithril', 1)).toBeNull()
    expect(buyGoodRefusal(game, party, 'mithril', 2)).toBe('It costs 6 gold, more than the stock holds.')
    game.world.tradingPost = 4
    expect(buyGoodRefusal(game, party, 'mithril', 1)).toBe("A level 5 trading post sells partners' goods.")
    party.position = { q: 40, r: 40 }
    expect(buyGoodRefusal(game, party, 'mithril', 1)).toMatch(/^The trading post is at /)
  })

  it('sell Stonehollow\'s mithril at 3 gold a unit, and the wyvern hide stand-in', () => {
    const game = market()
    game.world.stock = { gold: 10 }
    expect(buyGood(game, game.parties[0], 'mithril', 3)).toBeNull()
    expect(game.world.stock).toMatchObject({ gold: 1, mithril: 3 })
    game.world.stock = { gold: 10 }
    expect(buyGood(game, game.parties[0], 'wyvern_hide', 2)).toBeNull()
    expect(game.world.stock).toMatchObject({ gold: 4, wyvern_hide: 2 })
  })

  it('leave the stock untouched when refused', () => {
    const game = market()
    game.world.stock = { gold: 2, stone: 5 }
    const before = structuredClone(game.world.stock)
    expect(buyGood(game, game.parties[0], 'mithril', 1)).not.toBeNull()
    expect(game.world.stock).toEqual(before)
  })
})
