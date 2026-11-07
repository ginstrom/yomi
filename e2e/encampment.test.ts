import { describe, expect, it } from 'vitest'
import type { EncampmentProbe, GuildHallProbe } from '../src/testHook.ts'
import { useGames, type Game } from './driver.ts'

/** A new game with gold and iron (or `stock`) planted in its stock, reloaded and continued at the encampment. */
async function richAtHome(game: Game, stock: Record<string, number> = { gold: 100, iron: 50 }, postLevel?: number) {
  await game.newGame()
  await game.page.evaluate(([stock, level]) => {
    const saved = JSON.parse(localStorage.getItem('yomi.save.1')!)
    saved.game.world.stock = stock
    if (level) saved.game.world.tradingPost = level
    localStorage.setItem('yomi.save.1', JSON.stringify(saved))
  }, [stock, postLevel] as const)
  const menu = await game.reload()
  await game.click(menu.buttons.continue)
  await game.waitForScenes(['World'])
  return game.settled('World')
}

/** From the map at home into the encampment. */
async function enter(game: Game): Promise<EncampmentProbe> {
  const home = await game.settled('World')
  expect(home.buttons.enterEncampment.visible).toBe(true)
  await game.click(home.buttons.enterEncampment)
  await game.waitForScenes(['Encampment'], ['World'])
  return game.settled('Encampment')
}

const facility = (camp: EncampmentProbe, id: string) => camp.facilities.find((f) => f.id === id)!
const names = (heroes: GuildHallProbe['party']) => heroes.map((hero) => hero.name)

describe('the encampment', () => {
  const games = useGames()

  it('opens over the map at home, shows each facility built or as a plot, and builds the shrine there', async () => {
    const game = await games.open()
    await richAtHome(game)
    const camp = await enter(game)
    expect(camp.name).toBe('Oakvale')
    expect(facility(camp, 'guild_hall')).toMatchObject({ level: 1, frame: 'camp_guild_hall/level_1' })
    expect(facility(camp, 'shrine')).toMatchObject({ level: 0, frame: 'camp_plot/base' })
    expect(camp.buttons.improve.visible).toBe(false)

    // The empty plot tells what would stand there, and builds it for the stock.
    await game.click(facility(camp, 'shrine'))
    const plot = await game.settled('Encampment', (c) => c.selected === 'shrine')
    expect(plot.buttons.improve.enabled).toBe(true)
    expect(plot.buttons.open.visible).toBe(false)
    await game.click(plot.buttons.improve)
    const built = await game.settled('Encampment', (c) => facility(c, 'shrine').level === 1)
    expect(facility(built, 'shrine').frame).toBe('camp_shrine/level_1')
    expect(built.message).toBe('The Shrine is built.')
    // The second level wants silver, which the stock has none of.
    expect(built.buttons.improve.enabled).toBe(false)

    await game.click(built.buttons.leave)
    await game.waitForScenes(['World'])
    expect((await game.settled('World')).world).toMatchObject({ shrine: 1, stock: { gold: 80, iron: 50 } })
  })

  it('raises the guild hall, goes in to recruit and swap, and gives the map back the new party', async () => {
    const game = await games.open()
    await richAtHome(game)
    const camp = await enter(game)
    await game.click(facility(camp, 'guild_hall'))
    const shown = await game.settled('Encampment', (c) => c.selected === 'guild_hall')
    await game.click(shown.buttons.improve)
    const raised = await game.settled('Encampment', (c) => facility(c, 'guild_hall').level === 2)
    expect(facility(raised, 'guild_hall').frame).toBe('camp_guild_hall/level_2')
    expect(raised.message).toBe('The Guild Hall is raised to level 2.')

    await game.click(raised.buttons.open)
    await game.waitForScenes(['GuildHall'], ['World'])
    const hall = await game.settled('GuildHall')
    expect([hall.level, hall.partyLimit, hall.buttons.toParty.enabled]).toEqual([2, 4, false])

    await game.click(hall.buttons.recruit)
    const offer = await game.settled('GuildHall', (h) => h.view === 'recruit')
    expect(offer.prerolls.map((p) => p.name)).toEqual(['Garrick'])
    await game.click(offer.prerolls[0])
    const hired = await game.settled('GuildHall', (h) => h.view === 'roster' && h.reserves.length === 1)
    expect(hired.reserves[0]).toMatchObject({ name: 'Garrick', level: 1 })

    // A reserve clicked, then To party, while the party is under its limit.
    await game.click(hired.reserves[0])
    const picked = await game.settled('GuildHall', (h) => h.selected !== null)
    await game.click(picked.buttons.toParty)
    const four = await game.settled('GuildHall', (h) => h.party.length === 4)
    expect(names(four.party)).toEqual(['Aldric', 'Brenna', 'Delwyn', 'Garrick'])

    // A member clicked, then a reserve: the two change places.
    await game.click(four.party[0])
    await game.click((await game.settled('GuildHall', (h) => h.selected !== null)).buttons.toReserves)
    const three = await game.settled('GuildHall', (h) => h.reserves.length === 1)
    await game.click(three.party[0])
    await game.settled('GuildHall', (h) => h.selected?.row === 'party')
    await game.click(three.reserves[0])
    const swapped = await game.settled('GuildHall', (h) => h.reserves[0]?.name === 'Brenna')
    expect(names(swapped.party)).toEqual(['Aldric', 'Delwyn', 'Garrick'])

    // Closing the hall goes back to the encampment, and leaving that to the map.
    await game.click(swapped.buttons.close)
    await game.waitForScenes(['Encampment'], ['World'])
    const again = await game.settled('Encampment')
    expect(again.selected).toBe('guild_hall')
    await game.click(again.buttons.leave)
    await game.waitForScenes(['World'])
    const back = await game.settled('World')
    expect(back.party.map((member) => member.name)).toEqual(['Aldric', 'Delwyn', 'Garrick'])
    expect(back.world.stock).toMatchObject({ gold: 60, iron: 35 })
  })

  it('leads through the guild hall to character creation for a recruit and back again', async () => {
    const game = await games.open()
    await richAtHome(game)
    const camp = await enter(game)
    await game.click(facility(camp, 'guild_hall'))
    await game.click((await game.settled('Encampment', (c) => c.selected === 'guild_hall')).buttons.open)
    const hall = await game.settled('GuildHall')
    await game.click(hall.buttons.recruit)
    const offer = await game.settled('GuildHall', (h) => h.view === 'recruit')
    await game.click(offer.buttons.create)
    await game.waitForScenes(['Creation'], ['World'])
    const creation = await game.settled('Creation')
    expect(creation.editing).toBe(false)
    await game.press('Escape')
    await game.waitForScenes(['GuildHall'], ['World'])
    expect((await game.settled('GuildHall')).reserves).toEqual([])
  })

  it('shows five plots, the trading post built, and buys and sells there', async () => {
    const game = await games.open()
    await richAtHome(game, { gold: 100, salt: 4 })
    const camp = await enter(game)
    expect(camp.facilities.map((f) => [f.id, f.frame])).toEqual([
      ['guild_hall', 'camp_guild_hall/level_1'],
      ['shrine', 'camp_plot/base'],
      ['trading_post', 'camp_trading_post/level_1'],
      ['workshop', 'camp_plot/base'],
      ['infirmary', 'camp_plot/base'],
    ])
    await game.click(facility(camp, 'trading_post'))
    const shown = await game.settled('Encampment', (c) => c.selected === 'trading_post')
    await game.click(shown.buttons.open)
    await game.waitForScenes(['TradingPost'], ['World'])
    const post = await game.settled('TradingPost')
    expect(post.rows.some((row) => row.id.includes('@'))).toBe(false)

    const sword = post.rows.find((row) => row.id === 'iron_sword')!
    await game.click(sword)
    const picked = await game.settled('TradingPost', (p) => p.selected === 'iron_sword')
    expect(picked.details).toContain('Attack: 5 AP, 1 attack a turn')
    await game.click(picked.buttons.confirm)
    const bought = await game.settled('TradingPost', (p) => p.gold === 88)
    expect(bought.message).toBe('Bought the Iron Longsword for 12 gold. It is in the baggage.')

    await game.click(bought.buttons.sellTab)
    const selling = await game.settled('TradingPost', (p) => p.tab === 'sell')
    expect(selling.rows.some((row) => row.id.startsWith('worn'))).toBe(false)
    await game.click(selling.rows.find((row) => row.id === 'baggage:0')!)
    const toSell = await game.settled('TradingPost', (p) => p.selected === 'baggage:0')
    await game.click(toSell.buttons.confirm)
    const sold = await game.settled('TradingPost', (p) => p.gold === 94)
    // The materials come last, on the last page.
    await game.click(sold.buttons.next)
    const last = await game.settled('TradingPost', (p) => p.rows.find((row) => row.id === 'material:salt')!.visible)
    await game.click(last.rows.find((row) => row.id === 'material:salt')!)
    const salt = await game.settled('TradingPost', (p) => p.selected === 'material:salt')
    await game.click(salt.buttons.confirmAll)
    const done = await game.settled('TradingPost', (p) => p.gold === 96)

    await game.click(done.buttons.close)
    await game.waitForScenes(['Encampment'], ['World'])
    expect((await game.settled('Encampment')).selected).toBe('trading_post')
  })

  it('filters the trading post’s wares by slot and family, and buys a steel hammer and a steel helm', async () => {
    const game = await games.open()
    await richAtHome(game, { gold: 600 }, 4)
    const camp = await enter(game)
    await game.click(facility(camp, 'trading_post'))
    const shown = await game.settled('Encampment', (c) => c.selected === 'trading_post')
    await game.click(shown.buttons.open)
    await game.waitForScenes(['TradingPost'], ['World'])
    const post = await game.settled('TradingPost')
    expect(post.filter).toEqual({ slot: 'mainHand', family: null })
    expect(post.slotButtons.map((b) => b.slot)).toEqual(['mainHand', 'offHand', 'armor', 'head', 'gloves', 'boots'])
    expect(post.familyButtons[0].family).toBeNull()
    expect(post.familyButtons).toHaveLength(16)

    await game.click(post.familyButtons.find((b) => b.family === 'war_hammer')!)
    const hammers = await game.settled('TradingPost', (p) => p.filter.family === 'war_hammer')
    expect(hammers.rows.length).toBeGreaterThan(0)
    expect(hammers.rows.every((row) => row.id.endsWith('war_hammer') || row.id.includes('war_hammer@'))).toBe(true)
    const steel = hammers.rows.find((row) => row.id === 'steel_war_hammer')!
    await game.click(steel)
    const picked = await game.settled('TradingPost', (p) => p.selected === 'steel_war_hammer')
    expect(picked.details).toContain('Strength: 6')
    await game.click(picked.buttons.confirm)
    const bought = await game.settled('TradingPost', (p) => p.message.startsWith('Bought the Steel War Hammer'))

    await game.click(bought.slotButtons.find((b) => b.slot === 'head')!)
    const heads = await game.settled('TradingPost', (p) => p.filter.slot === 'head')
    expect(heads.filter.family).toBeNull()
    expect(heads.rows.length).toBeGreaterThan(0)
    await game.click(heads.rows.find((row) => row.id === 'steel_helm')!)
    const helm = await game.settled('TradingPost', (p) => p.selected === 'steel_helm')
    await game.click(helm.buttons.confirm)
    await game.settled('TradingPost', (p) => p.message.startsWith('Bought the Steel Helm'))

    await game.click(bought.buttons.sellTab)
    const selling = await game.settled('TradingPost', (p) => p.tab === 'sell')
    expect(selling.slotButtons).toEqual([])
    expect(selling.rows.map((row) => row.id)).toEqual(expect.arrayContaining(['baggage:0', 'baggage:1']))
  })

  it('builds the workshop and works the soldier’s sword there, in no time', async () => {
    const game = await games.open()
    await richAtHome(game, { gold: 200, iron: 50, stone: 20, copper: 10 })
    const camp = await enter(game)
    await game.click(facility(camp, 'workshop'))
    let shown = await game.settled('Encampment', (c) => c.selected === 'workshop')
    await game.click(shown.buttons.improve)
    shown = await game.settled('Encampment', (c) => facility(c, 'workshop').level === 1)
    await game.click(shown.buttons.improve)
    shown = await game.settled('Encampment', (c) => facility(c, 'workshop').level === 2)
    expect(facility(shown, 'workshop').frame).toBe('camp_workshop/level_2')
    await game.click(shown.buttons.open)
    await game.waitForScenes(['Crafting'], ['World'])
    const bench = await game.settled('Crafting')
    expect(bench.tier).toBe(2)
    await game.click(bench.items.find((item) => item.id === 'worn:0:mainHand')!)
    const sword = await game.settled('Crafting', (c) => c.selected === 'worn:0:mainHand')
    expect(sword.options.map((o) => o.id)).toEqual(['balanced1', 'balanced2', 'keen1', 'keen2', 'light1', 'light2'])
    await game.click(sword.options.find((o) => o.id === 'light1')!)
    const light = await game.settled('Crafting', (c) => c.chosen === 'light1')
    expect(light.preview).toContain('Attack: 5 AP, 1 attack a turn → 4 AP, 2 attacks a turn')
    await game.click(light.buttons.work)
    const made = await game.settled('Crafting', (c) => c.message.startsWith('Made'))
    expect(made.items.find((item) => item.id === 'worn:0:mainHand')!.itemId).toBe('iron_sword+light1')

    await game.click(made.buttons.close)
    await game.waitForScenes(['Encampment'], ['World'])
    const back = await game.settled('Encampment')
    await game.click(back.buttons.leave)
    await game.waitForScenes(['World'])
    const world = (await game.settled('World')).world
    expect(world.turn).toBe(1)
    expect(world.stock).toMatchObject({ gold: 200 - 25 - 40 - 5, iron: 50 - 15 - 5 })
  })

  it('crafts in the field from the map’s Craft button, a day passing', async () => {
    const game = await games.open()
    const home = await richAtHome(game, { gold: 20, iron: 20 })
    expect(home.buttons.craft.visible).toBe(true)
    await game.click(home.buttons.craft)
    await game.waitForScenes(['Crafting'], ['World'])
    const bench = await game.settled('Crafting')
    expect(bench.tier).toBe('field')
    await game.click(bench.items.find((item) => item.id === 'worn:0:mainHand')!)
    const sword = await game.settled('Crafting', (c) => c.selected === 'worn:0:mainHand')
    expect(sword.options.map((o) => o.id)).toEqual(['balanced1'])
    await game.click(sword.options[0])
    const chosen = await game.settled('Crafting', (c) => c.chosen === 'balanced1')
    await game.click(chosen.buttons.work)
    await game.waitForScenes(['World'])
    await game.skipStory()
    const after = await game.settled('World', (w) => w.message.includes('Balanced'))
    expect(after.world.turn).toBe(2)
    expect(after.world.stock).toMatchObject({ gold: 15, iron: 15 })
  })
})
