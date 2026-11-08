import { describe, expect, it } from 'vitest'
import type { EncampmentProbe, GuildHallProbe } from '../src/testHook.ts'
import { useGames, type Game } from './driver.ts'

/** A new game with gold and iron (or `stock`) planted in its stock, reloaded and continued at the encampment. */
async function richAtHome(game: Game, stock: Record<string, number> = { gold: 100, iron: 50 }, postLevel?: number, plant: Record<string, unknown> = {}) {
  await game.newGame()
  await game.page.evaluate(([stock, level, plant]) => {
    const saved = JSON.parse(localStorage.getItem('yomi.save.1')!)
    saved.game.world.stock = stock
    if (level) saved.game.world.tradingPost = level
    // `plant` sets values in the saved game by dotted path: 'world.workshop', 'parties.0.members.1.equipment.mainHand'.
    for (const [path, value] of Object.entries(plant)) {
      const keys = path.split('.')
      const last = keys.pop()!
      keys.reduce((node, key) => node[key], saved.game)[last] = value
    }
    localStorage.setItem('yomi.save.1', JSON.stringify(saved))
  }, [stock, postLevel, plant] as const)
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
    // A level 1 post sells no runes.
    await game.click(post.runesButton)
    expect((await game.settled('TradingPost', (p) => p.filter.slot === 'runes')).rows).toEqual([])
    await game.click(post.slotButtons.find((b) => b.slot === 'mainHand')!)
    await game.settled('TradingPost', (p) => p.filter.slot === 'mainHand')

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

  it('buys Lesser runes under the post\'s Runes filter and sells one from the pouch', async () => {
    const game = await games.open()
    await richAtHome(game, { gold: 100 }, 2)
    const camp = await enter(game)
    await game.click(facility(camp, 'trading_post'))
    const shown = await game.settled('Encampment', (c) => c.selected === 'trading_post')
    await game.click(shown.buttons.open)
    await game.waitForScenes(['TradingPost'], ['World'])
    const post = await game.settled('TradingPost')
    await game.click(post.runesButton)
    const runes = await game.settled('TradingPost', (p) => p.filter.slot === 'runes')
    expect(runes.familyButtons).toEqual([])
    expect(runes.rows.map((row) => [row.id, row.kind, row.price])).toEqual(
      ['ember1', 'rime1', 'storm1', 'stone1', 'wind1', 'life1'].map((key) => [`rune:${key}`, 'rune', 15]),
    )
    await game.click(runes.rows.find((row) => row.id === 'rune:ember1')!)
    const ember = await game.settled('TradingPost', (p) => p.selected === 'rune:ember1')
    expect(ember.details).toEqual([
      'In a weapon: On a hit, +1 fire',
      'In armour: Fire ward 2',
      'In a shield: Fire ward 2',
      'Set in a socketed item: tier-2 or Masterwork gear.',
      'Costs 15 gold.',
    ])
    await game.click(ember.buttons.confirm)
    await game.settled('TradingPost', (p) => p.gold === 85)
    await game.click(ember.buttons.confirm)
    const bought = await game.settled('TradingPost', (p) => p.gold === 70)
    expect(bought.message).toBe('Bought the Lesser Ember Rune for 15 gold. It is in the rune pouch.')

    await game.click(bought.buttons.sellTab)
    let selling = await game.settled('TradingPost', (p) => p.tab === 'sell')
    expect(selling.runesButton.visible).toBe(false)
    // The pouch's runes come last, after the packs and the materials.
    expect(selling.rows.at(-1)!.id).toBe('rune:ember1')
    const shownRows = (p: typeof selling) => p.rows.filter((r) => r.visible).map((r) => r.id).join()
    while (!selling.rows.at(-1)!.visible) {
      const before = shownRows(selling)
      await game.click(selling.buttons.next)
      selling = await game.settled('TradingPost', (p) => shownRows(p) !== before)
    }
    const row = selling.rows.find((r) => r.id === 'rune:ember1')!
    expect([row.kind, row.price]).toEqual(['rune', 5])
    await game.click(row)
    const toSell = await game.settled('TradingPost', (p) => p.selected === 'rune:ember1')
    expect(toSell.details.at(-1)).toBe('Fetches 5 gold each.')
    await game.click(toSell.buttons.confirm)
    const sold = await game.settled('TradingPost', (p) => p.gold === 75)
    expect(sold.message).toBe('Sold the Lesser Ember Rune for 5 gold.')
    // One is left, and the line with it.
    expect(sold.selected).toBe('rune:ember1')
  })

  it('embeds, extracts and fuses runes on the workshop\'s Runes tab, a refusal naming the level it needs', async () => {
    const game = await games.open()
    await richAtHome(game, { gold: 100 }, undefined, {
      'world.workshop': 2,
      'parties.0.members.0.equipment.mainHand': 'iron_sword@3',
      runes: { ember1: 1, storm1: 3 },
    })
    const camp = await enter(game)
    await game.click(facility(camp, 'workshop'))
    const shown = await game.settled('Encampment', (c) => c.selected === 'workshop')
    await game.click(shown.buttons.open)
    await game.waitForScenes(['Crafting'], ['World'])
    const bench = await game.settled('Crafting')
    expect(bench.tab).toBe('modify')
    await game.click(bench.buttons.runesTab)
    const runes = await game.settled('Crafting', (c) => c.tab === 'runes')
    expect(runes.items.map((item) => [item.id, item.itemId])).toEqual([['worn:0:mainHand', 'iron_sword@3']])
    expect(runes.pouch.map((p) => [p.key, p.count])).toEqual([['ember1', 1], ['storm1', 3]])
    expect(runes.itemsHint).toBe('')
    // Hovering a pouch row tells what the rune does in each place and where it goes.
    await game.hover(runes.pouch[0].row)
    const hovered = await game.settled('Crafting', (c) => c.tooltip.length > 0)
    expect(hovered.tooltip).toEqual([
      'Lesser Ember Rune',
      'In a weapon: On a hit, +1 fire',
      'In armour: Fire ward 2',
      'In a shield: Fire ward 2',
      'Set in a socketed item: tier-2 or Masterwork gear.',
    ])
    // No item is selected yet, so Embed is greyed; Fuse needs none.
    expect(runes.pouch[0].embed.enabled).toBe(false)
    expect(runes.pouch[1].fuse.enabled).toBe(true)

    await game.click(runes.items[0])
    const sword = await game.settled('Crafting', (c) => c.selected === 'worn:0:mainHand')
    expect(sword.sockets).toMatchObject([{ index: 0, rune: null, visible: false }])
    await game.click(sword.pouch.find((p) => p.key === 'ember1')!.embed)
    const embedding = await game.settled('Crafting', (c) => c.chosen === 'embed:ember1')
    expect(embedding.preview).toEqual([
      'Set a Lesser Ember Rune in the Masterwork Iron Longsword.',
      'Makes the Masterwork Iron Longsword [Ember I].',
      'On a hit: +1 fire',
      'Costs 5 gold.',
    ])
    await game.click(embedding.buttons.confirm)
    const embedded = await game.settled('Crafting', (c) => c.items[0].itemId === 'iron_sword@3#ember1')
    expect(embedded.message).toBe('Set the Lesser Ember Rune: the Masterwork Iron Longsword [Ember I].')
    expect(embedded.selected).toBe('worn:0:mainHand')
    expect(embedded.sockets).toMatchObject([{ index: 0, rune: 'ember1', visible: true, enabled: true }])
    expect(embedded.pouch.map((p) => p.key)).toEqual(['storm1'])

    await game.click(embedded.sockets[0])
    const extracting = await game.settled('Crafting', (c) => c.chosen === 'extract:0')
    expect(extracting.preview.at(-1)).toBe('Costs 10 gold.')
    await game.click(extracting.buttons.confirm)
    const extracted = await game.settled('Crafting', (c) => c.items[0].itemId === 'iron_sword@3')
    expect(extracted.message).toBe('Took the Lesser Ember Rune out of the Masterwork Iron Longsword; it is back in the pouch.')
    expect(extracted.pouch.map((p) => [p.key, p.count])).toEqual([['ember1', 1], ['storm1', 3]])

    await game.click(extracted.pouch.find((p) => p.key === 'storm1')!.fuse)
    const fusing = await game.settled('Crafting', (c) => c.chosen === 'fuse:storm1')
    // The last action's message goes once another is previewed.
    expect(fusing.message).toBe('')
    expect(fusing.preview).toEqual(['3 × Lesser Storm Rune → Storm Rune', 'Costs 20 gold.'])
    await game.click(fusing.buttons.confirm)
    const fused = await game.settled('Crafting', (c) => c.pouch.some((p) => p.key === 'storm2'))
    expect(fused.message).toBe('Fused three Lesser Storm Runes into one Storm Rune.')
    // A greyed Fuse still shows why: the next rank needs a workshop stage 10 adds.
    const storm = fused.pouch.find((p) => p.key === 'storm2')!
    expect(storm.fuse.enabled).toBe(false)
    await game.click(storm.fuse)
    const refused = await game.settled('Crafting', (c) => c.chosen === 'fuse:storm2')
    expect(refused.message).toBe('')
    expect(refused.preview.at(-1)).toMatch(/^Fusing to a Greater Storm Rune needs a level 4 workshop\.$/)
    expect(refused.buttons.confirm.enabled).toBe(false)

    await game.click(refused.buttons.close)
    await game.waitForScenes(['Encampment'], ['World'])
    await game.click((await game.settled('Encampment')).buttons.leave)
    await game.waitForScenes(['World'])
    const world = (await game.settled('World')).world
    expect(world.turn).toBe(1)
    expect(world.stock.gold).toBe(100 - 5 - 10 - 20)
  })

  it('embeds a Lesser rune in the field from the map\'s Craft button, a day passing', async () => {
    const game = await games.open()
    const home = await richAtHome(game, { gold: 20 }, undefined, { 'parties.0.members.0.equipment.mainHand': 'iron_sword@3', runes: { ember1: 1 } })
    // A hex off the encampment, out in the field proper.
    const { q, r } = home.partyAt
    await game.travelTo({ q: q + 1, r })
    const away = await game.settled('World', (w) => !w.walking)
    expect(away.world.turn).toBe(2)
    expect(away.buttons.enterEncampment.visible).toBe(false)
    await game.click(away.buttons.craft)
    await game.waitForScenes(['Crafting'], ['World'])
    const bench = await game.settled('Crafting')
    expect(bench.tier).toBe('field')
    await game.click(bench.buttons.runesTab)
    const runes = await game.settled('Crafting', (c) => c.tab === 'runes')
    await game.click(runes.items.find((item) => item.id === 'worn:0:mainHand')!)
    const sword = await game.settled('Crafting', (c) => c.selected === 'worn:0:mainHand')
    await game.click(sword.pouch[0].embed)
    const chosen = await game.settled('Crafting', (c) => c.chosen === 'embed:ember1')
    expect(chosen.preview.at(-1)).toBe('Costs 5 gold and a day.')
    await game.click(chosen.buttons.confirm)
    await game.waitForScenes(['World'])
    await game.skipStory()
    const after = await game.settled('World', (w) => w.message.includes('[Ember I]'))
    expect(after.message).toMatch(/^A day's work makes the Masterwork Iron Longsword \[Ember I\]\./)
    expect(after.world.turn).toBe(3)
    expect(after.world.stock.gold).toBe(15)
  })

  it('shows a hero\'s strength shortfall when crafting on what they carry, and none for the baggage', async () => {
    const game = await games.open()
    await richAtHome(game, { gold: 200, iron: 50, stone: 20, copper: 10 }, undefined, {
      'world.workshop': 2,
      'parties.0.members.1.equipment.mainHand': 'iron_greatsword',
      'parties.0.baggage': ['iron_greatsword'],
    })
    const camp = await enter(game)
    await game.click(facility(camp, 'workshop'))
    const shown = await game.settled('Encampment', (c) => c.selected === 'workshop')
    await game.click(shown.buttons.open)
    await game.waitForScenes(['Crafting'], ['World'])
    const bench = await game.settled('Crafting')
    await game.click(bench.items.find((item) => item.id === 'worn:1:mainHand')!)
    await game.settled('Crafting', (c) => c.selected === 'worn:1:mainHand')
    const options = (await game.settled('Crafting')).options
    await game.click(options.find((o) => o.id === 'balanced1')!)
    const chosen = await game.settled('Crafting', (c) => c.chosen === 'balanced1')
    expect(chosen.preview.some((line) => /^Strength: \d+ \(you have \d+\): to hit −\d+%$/.test(line))).toBe(true)

    // The same greatsword in the baggage has no holder, so no shortfall.
    // The baggage comes last, on a later page of the list.
    let page = chosen
    while (!page.items.find((item) => item.id === 'baggage:0')!.visible) {
      const before = page.items.filter((item) => item.visible).map((item) => item.id).join()
      await game.click(page.buttons.next)
      page = await game.settled('Crafting', (c) => c.items.filter((item) => item.visible).map((item) => item.id).join() !== before)
    }
    await game.click(page.items.find((item) => item.id === 'baggage:0')!)
    await game.settled('Crafting', (c) => c.selected === 'baggage:0')
    await game.click((await game.settled('Crafting')).options.find((o) => o.id === 'balanced1')!)
    const loose = await game.settled('Crafting', (c) => c.selected === 'baggage:0' && c.chosen === 'balanced1')
    expect(loose.preview[0]).toBe('Balanced I: to hit +5%, damage −1.')
    expect(loose.preview[1]).toBe('Makes the Balanced Iron Greatsword (I).')
    expect(loose.preview.some((line) => line.includes('you have'))).toBe(false)
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
    // Each button names its modifier and grade, short enough to read; the preview says what it does.
    expect(sword.options.map((o) => o.label)).toEqual(['Balanced I', 'Balanced II', 'Keen I', 'Keen II', 'Light I', 'Light II'])
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
    const opened = await game.settled('Crafting')
    expect(opened.tier).toBe('field')
    // A new party has nothing with a socket: the Runes tab says which gear has them.
    await game.click(opened.buttons.runesTab)
    const runes = await game.settled('Crafting', (c) => c.tab === 'runes')
    expect(runes.items).toEqual([])
    expect(runes.itemsHint).toMatch(/^Nothing the party has takes a rune\. Sockets come on steel, ironwood, wolfhide and silk gear, on Masterwork gear/)
    await game.click(runes.buttons.modifyTab)
    const bench = await game.settled('Crafting', (c) => c.tab === 'modify')
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
