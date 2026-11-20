import { describe, expect, it } from 'vitest'
import { LODGE_COSTS, ROADS_REFUSAL, SHRINE_COSTS } from './buildings.ts'
import { newExpedition } from './expedition.ts'
import { facilities, improveFacility, setFacilityLevel } from './encampment.ts'
import { newGame } from './gameState.ts'

/** A new game at home, with gold, iron and silver enough for anything. */
function rich() {
  const game = newGame(undefined, null, 1, 'Hearthold')
  game.world.stock = { gold: 500, iron: 500, silver: 500 }
  return game
}
const view = (game: ReturnType<typeof newGame>, id: string) => facilities(game, game.parties[0]).find((f) => f.id === id)!

describe('the encampment', () => {
  it('starts with the guild hall and trading post built, the rest empty plots', () => {
    const game = newGame(undefined, null, 1, 'Hearthold')
    expect(facilities(game, game.parties[0]).map((f) => [f.id, f.level])).toEqual([
      ['guild_hall', 1],
      ['shrine', 0],
      ['trading_post', 1],
      ['workshop', 0],
      ['infirmary', 0],
      ['builders_lodge', 0],
    ])
    expect(view(game, 'trading_post').opens).toBe(true)
    expect(view(game, 'workshop').opens).toBe(false)
    expect(view(game, 'infirmary').opens).toBe(false)
    const shrine = view(game, 'shrine')
    expect(shrine.action).toBe('Build')
    expect(shrine.effect).toMatch(/^Not built/)
    expect(shrine.about).toMatch(/Hearthold/)
    expect(shrine.refusal).toMatch(/costs 20 gold/)
    expect(view(game, 'guild_hall').opens).toBe(true)
  })

  it('builds and raises a facility for the stock, through its own rules', () => {
    const game = rich()
    expect(improveFacility(game, game.parties[0], 'shrine')).toBeNull()
    expect(game.world.shrine).toBe(1)
    expect(game.world.stock.gold).toBe(500 - SHRINE_COSTS[0].gold!)
    expect(view(game, 'shrine').action).toBe('Raise to level 2')
    expect(improveFacility(game, game.parties[0], 'guild_hall')).toBeNull()
    expect(game.world.guildHall).toBe(2)
  })

  it('builds and raises the trading post, workshop and infirmary for their shown costs', () => {
    const game = newGame(undefined, null, 1, 'Hearthold')
    game.world.stock = { gold: 1000, iron: 100, timber: 100, stone: 100, copper: 100, crystal: 100, peat: 100, salt: 100, silver: 100 }
    for (const id of ['trading_post', 'workshop', 'infirmary'] as const) {
      while (view(game, id).action) {
        const before = { ...game.world.stock }
        const { cost, level } = view(game, id)
        expect(improveFacility(game, game.parties[0], id)).toBeNull()
        expect(view(game, id).level).toBe(level + 1)
        for (const [material, amount] of Object.entries(cost!)) {
          expect(game.world.stock[material as keyof typeof before]).toBe(before[material as keyof typeof before]! - amount!)
        }
      }
    }
    expect([game.world.tradingPost, game.world.workshop, game.world.infirmary]).toEqual([6, 3, 3])
    expect(view(game, 'trading_post').maxLevel).toBe(6)
    expect(view(game, 'trading_post').effect).toContain('brings 5 gold every 5 days')
    expect(view(game, 'workshop').opens).toBe(true)
  })

  it('says what each level of the trading post and the workshop does for runes', () => {
    const game = newGame(undefined, null, 1, 'Hearthold')
    const effects = (id: 'trading_post' | 'workshop', levels: number[]) =>
      levels.map((level) => {
        setFacilityLevel(game, id, level)
        return view(game, id).effect
      })
    expect(effects('trading_post', [1, 2, 3, 4])).toEqual([
      'Sells plain gear.',
      'Sells plain and Fine gear, and Lesser runes.',
      'Sells plain, Fine and Masterwork gear, and Lesser runes.',
      "Sells plain, Fine and Masterwork gear, in iron and steel, and runes of the first two ranks; brings 2 gold every 5 days, half while Hearthold's land is tainted.",
    ])
    expect(effects('workshop', [1, 2, 3])).toEqual([
      'Makes the field modifiers, and Bearded, Keen and Braced, at grade 1. Sets runes, and fuses three Lesser runes into one.',
      'Makes Light, Long and Reinforced too, at up to grade 2. Takes runes out again, for a fee.',
      'Makes every modifier at up to grade 3.',
    ])
  })

  it('refuses a new facility without the stock, changing nothing', () => {
    const game = newGame(undefined, null, 1, 'Hearthold')
    expect(view(game, 'workshop').refusal).toMatch(/costs 25 gold, 15 iron/)
    expect(improveFacility(game, game.parties[0], 'workshop')).toMatch(/more than the stock/)
    expect(game.world.workshop).toBe(0)
  })

  it('offers nothing past the top level', () => {
    const game = rich()
    while (improveFacility(game, game.parties[0], 'shrine') === null);
    const shrine = view(game, 'shrine')
    expect([shrine.level, shrine.action, shrine.cost, shrine.next, shrine.refusal]).toEqual([shrine.maxLevel, null, null, null, null])
    expect(improveFacility(game, game.parties[0], 'shrine')).toMatch(/as great/)
  })

  it('is refused away from home', () => {
    const game = rich()
    game.parties[0].position = { q: game.parties[0].position.q + 1, r: game.parties[0].position.r }
    expect(view(game, 'shrine').refusal).toMatch(/No party is at Hearthold/)
    expect(improveFacility(game, game.parties[0], 'shrine')).toMatch(/at Hearthold/)
  })

  it('shows the guild hall to level 5 and what each level brings', () => {
    const game = rich()
    expect(view(game, 'guild_hall').maxLevel).toBe(5)
    setFacilityLevel(game, 'guild_hall', 4)
    expect(view(game, 'guild_hall').effect).toBe('A party of up to 5, 2 parties in the company; recruits join at level 4.')
    expect(view(game, 'guild_hall').next).toMatch(/3 parties/)
  })

  it('acts for the party at home when the selected one is away, and refuses with none at home', () => {
    const game = rich()
    const away = newExpedition([structuredClone(game.parties[0].members[0])], { q: game.parties[0].position.q + 3, r: game.parties[0].position.r }, 'party_2', 'Second Company')
    game.parties.push(away)
    expect(view(game, 'shrine').refusal).toBeNull()
    expect(improveFacility(game, away, 'shrine')).toBeNull()
    expect(game.world.shrine).toBe(1)
    game.parties[0].position = away.position
    expect(improveFacility(game, away, 'shrine')).toMatch(/No party is at Hearthold/)
    expect(facilities(game, away).find((f) => f.id === 'shrine')!.refusal).toMatch(/No party is at Hearthold/)
    expect(game.world.shrine).toBe(1)
  })
})

describe('the trading post as a market', () => {
  it('is named by its level, and its effect at 4 to 6 says the income', () => {
    const game = newGame(undefined, null, 1, 'Hearthold')
    const at = (level: number) => {
      setFacilityLevel(game, 'trading_post', level)
      return view(game, 'trading_post')
    }
    expect([1, 2, 3, 4, 5, 6].map((level) => at(level).name)).toEqual(['Trading Post', 'Trading Post', 'Trading Post', 'Market', 'Market Hall', 'Trading House'])
    expect(at(5).effect).toContain('brings 3 gold every 5 days')
    expect(at(3).effect).not.toContain('gold every')
    expect(at(4).next).toContain('3 gold every 5 days')
    expect(at(6).next).toBeNull()
  })
})

describe('the Builders\' Lodge', () => {
  it('is the sixth facility, built and raised to 2 for its costs, then refused for roads', () => {
    const game = rich()
    game.world.stock = { gold: 500, timber: 50, stone: 50, iron: 50 }
    const lodge = () => view(game, 'builders_lodge')
    expect(facilities(game, game.parties[0])[5].id).toBe('builders_lodge')
    expect(lodge()).toMatchObject({ name: "Builders' Lodge", level: 0, maxLevel: 3, action: 'Build', cost: LODGE_COSTS[0], refusal: null })
    expect(improveFacility(game, game.parties[0], 'builders_lodge')).toBeNull()
    expect(game.world.lodge).toBe(1)
    expect(game.world.stock).toMatchObject({ gold: 470, timber: 30 })
    expect(lodge().cost).toEqual(LODGE_COSTS[1])
    expect(improveFacility(game, game.parties[0], 'builders_lodge')).toBeNull()
    expect(game.world.lodge).toBe(2)
    expect(lodge().refusal).toBe(ROADS_REFUSAL)
    expect(improveFacility(game, game.parties[0], 'builders_lodge')).toBe(ROADS_REFUSAL)
    expect(game.world.lodge).toBe(2)
  })

  it('refuses for the stock when it is short', () => {
    const game = newGame(undefined, null, 1, 'Hearthold')
    game.world.stock = { gold: 5 }
    expect(view(game, 'builders_lodge').refusal).toMatch(/costs 30 gold, 20 timber, more than the stock holds/)
    expect(improveFacility(game, game.parties[0], 'builders_lodge')).toMatch(/more than the stock holds/)
  })

  it('has its level set by setFacilityLevel', () => {
    const game = newGame(undefined, null, 1, 'Hearthold')
    setFacilityLevel(game, 'builders_lodge', 2)
    expect(game.world.lodge).toBe(2)
  })
})
