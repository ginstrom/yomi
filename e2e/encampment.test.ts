import { describe, expect, it } from 'vitest'
import type { EncampmentProbe, GuildHallProbe } from '../src/testHook.ts'
import { PARTNERS } from '../src/game/worldMap.ts'
import { hexNeighbors, hexToOffset } from '../src/grid/hex.ts'
import { roadTo } from '../src/game/trade.ts'
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
    expect([hall.level, hall.partyLimit, hall.maxParties, hall.buttons.form.enabled]).toEqual([2, 4, 1, false])

    await game.click(hall.buttons.recruit)
    const offer = await game.settled('GuildHall', (h) => h.view === 'recruit')
    expect(offer.prerolls.map((p) => p.name)).toEqual(['Garrick'])
    await game.click(offer.prerolls[0])
    const hired = await game.settled('GuildHall', (h) => h.view === 'roster' && h.reserves.length === 1)
    expect(hired.reserves[0]).toMatchObject({ name: 'Garrick', level: 2 })

    // A reserve clicked, then the party's heading: it joins, while the party is under its limit.
    await game.click(hired.reserves[0])
    const picked = await game.settled('GuildHall', (h) => h.selected !== null)
    await game.click(picked.columns[0].header)
    const four = await game.settled('GuildHall', (h) => h.party.length === 4)
    expect(names(four.party)).toEqual(['Aldric', 'Brenna', 'Delwyn', 'Garrick'])

    // A member clicked, then the reserves' heading: it goes to the reserves.
    await game.click(four.party[0])
    const held = await game.settled('GuildHall', (h) => h.selected !== null)
    await game.click(held.columns[1].header)
    const three = await game.settled('GuildHall', (h) => h.reserves.length === 1)
    // A member clicked, then a reserve: the two change places.
    await game.click(three.party[0])
    await game.settled('GuildHall', (h) => h.selected?.party === 'party_1')
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

  it("builds the Builders' Lodge on its plot", async () => {
    const game = await games.open()
    await richAtHome(game, { gold: 100, timber: 50 })
    const camp = await enter(game)
    expect(facility(camp, 'builders_lodge')).toMatchObject({ level: 0, frame: 'camp_plot/base', labelText: "Builders' Lodge: empty plot" })
    await game.click(facility(camp, 'builders_lodge'))
    const plot = await game.settled('Encampment', (c) => c.selected === 'builders_lodge')
    expect(plot.buttons.improve.enabled).toBe(true)
    await game.click(plot.buttons.improve)
    const built = await game.settled('Encampment', (c) => facility(c, 'builders_lodge').level === 1)
    expect(facility(built, 'builders_lodge')).toMatchObject({ frame: 'camp_lodge/level_1', labelText: "Builders' Lodge 1/3" })
    expect(built.message).toBe("The Builders' Lodge is built.")
  })

  it('raises the Lodge to level 2 without a word about roads, and to level 3', async () => {
    const game = await games.open()
    await richAtHome(game, { gold: 500, iron: 50, stone: 50 }, undefined, { 'world.lodge': 1 })
    const camp = await enter(game)
    await game.click(facility(camp, 'builders_lodge'))
    const shown = await game.settled('Encampment', (c) => c.selected === 'builders_lodge')
    await game.click(shown.buttons.improve)
    const raised = await game.settled('Encampment', (c) => facility(c, 'builders_lodge').level === 2)
    expect(raised.message).toBe("The Builders' Lodge is raised to level 2.")
    expect(raised.buttons.improve.enabled).toBe(true)
    await game.click(raised.buttons.improve)
    const third = await game.settled('Encampment', (c) => facility(c, 'builders_lodge').level === 3)
    expect(third.message).toBe("The Builders' Lodge is raised to level 3.")
    expect(third.buttons.improve.enabled).toBe(false)
    expect(facility(third, 'builders_lodge').frame).toBe('camp_lodge/level_3')
    expect(third.details[0]).toBe("Builders' Lodge, level 3 of 3")
  })

  it('names the trading post by its level, with its market income, and raises it to the Trading House', async () => {
    const game = await games.open()
    await richAtHome(game, { gold: 500, silver: 50, crystal: 20 }, 5)
    const camp = await enter(game)
    expect(facility(camp, 'trading_post')).toMatchObject({ frame: 'camp_trading_post/level_5', labelText: 'Market Hall 5/6' })
    await game.click(facility(camp, 'trading_post'))
    const shown = await game.settled('Encampment', (c) => c.selected === 'trading_post')
    expect(shown.details[0]).toBe('Market Hall, level 5 of 6')
    expect(shown.details.join(' ')).toContain('3 gold every 5 days')
    await game.click(shown.buttons.improve)
    const raised = await game.settled('Encampment', (c) => facility(c, 'trading_post').level === 6)
    expect(facility(raised, 'trading_post')).toMatchObject({ frame: 'camp_trading_post/level_6', labelText: 'Trading House 6/6' })
    expect(raised.message).toBe('The Trading House is raised to level 6.')
  })

  // A long effect and a long "Next:" once set the details smaller, or dropped the flavour line, to clear the message line.
  for (const level of [1, 2, 3, 4, 5]) {
    it(`fits the trading post's details at level ${level} at full size, flavour line and all`, async () => {
      const game = await games.open()
      await richAtHome(game, { gold: 100 }, level)
      const camp = await enter(game)
      await game.click(facility(camp, 'trading_post'))
      const shown = await game.settled('Encampment', (c) => c.selected === 'trading_post')
      expect(shown.details[1]).toBe('Merchants sell plain gear and runes for gold and buy what the party no longer needs.')
      expect(shown.detailsSize).toBe(12)
    })
  }

  for (const [name, plant] of [
    ['bare plots', {}],
    ['every facility at its top', { 'world.guildHall': 5, 'world.shrine': 3, 'world.workshop': 3, 'world.infirmary': 3, 'world.lodge': 3, 'world.tradingPost': 6 }],
  ] as const) {
    it(`draws all six buildings and their labels inside the frame at 840 by 560, overlapping none (${name})`, async () => {
      const game = await games.open()
      await richAtHome(game, { gold: 100 }, undefined, plant)
      await game.resize(840, 560)
      const camp = await enter(game)
      expect(camp.facilities).toHaveLength(6)
      // The frame is 720 by 500, scaled down to fit and centred; the probe's boxes are on screen.
      const scale = Math.min(1, (840 - 32) / 720, (560 - 32) / 500)
      const frame = { x: 420, y: 280, width: 720 * scale, height: 500 * scale }
      const boxes = camp.facilities.flatMap((f) => [
        { what: `${f.id} building`, box: f.building, of: f.id },
        { what: `${f.id} label`, box: f.label, of: f.id },
      ])
      const edges = (b: { x: number; y: number; width: number; height: number }) => ({ l: b.x - b.width / 2, r: b.x + b.width / 2, t: b.y - b.height / 2, b: b.y + b.height / 2 })
      for (const { what, box } of boxes) {
        const e = edges(box)
        expect(box.width, what).toBeGreaterThan(0)
        expect(e.l, what).toBeGreaterThanOrEqual(frame.x - frame.width / 2)
        expect(e.r, what).toBeLessThanOrEqual(frame.x + frame.width / 2)
        expect(e.t, what).toBeGreaterThanOrEqual(frame.y - frame.height / 2)
        expect(e.b, what).toBeLessThanOrEqual(frame.y + frame.height / 2)
      }
      for (const a of boxes) {
        for (const b of boxes) {
          if (a.what >= b.what || a.of === b.of) continue
          const [p, q] = [edges(a.box), edges(b.box)]
          const apart = p.r <= q.l || q.r <= p.l || p.b <= q.t || q.b <= p.t
          expect(apart, `${a.what} overlaps ${b.what}`).toBe(true)
        }
      }
    })
  }

  it('forms, renames, fills and disbands a second party at hall level 4, and the map lists both', async () => {
    const game = await games.open()
    await richAtHome(game, { gold: 500, iron: 100, stone: 50, silver: 50 }, undefined, { 'world.guildHall': 4 })
    const camp = await enter(game)
    await game.click(facility(camp, 'guild_hall'))
    await game.click((await game.settled('Encampment', (c) => c.selected === 'guild_hall')).buttons.open)
    await game.waitForScenes(['GuildHall'], ['World'])
    const hall = await game.settled('GuildHall')
    expect([hall.level, hall.maxParties, hall.columns.map((c) => c.name)]).toEqual([4, 2, ['First Company', 'Reserves']])
    await game.click(hall.buttons.recruit)
    const offer = await game.settled('GuildHall', (h) => h.view === 'recruit')
    await game.click(offer.prerolls[0])
    const hired = await game.settled('GuildHall', (h) => h.view === 'roster' && h.reserves.length === 1)
    expect(hired.reserves[0]).toMatchObject({ name: 'Garrick', level: 4 })

    // The reserve forms a second party, standing in its own column.
    await game.click(hired.reserves[0])
    const picked = await game.settled('GuildHall', (h) => h.selected !== null)
    await game.click(picked.buttons.form)
    const formed = await game.settled('GuildHall', (h) => h.columns.length === 3)
    expect(formed.columns.map((c) => [c.party, c.name, c.faces.length])).toEqual([['party_1', 'First Company', 3], ['party_2', 'Second Company', 1], [null, 'Reserves', 0]])
    expect(formed.message).toContain('Second Company is formed')

    // Rename it by typing.
    await game.click(formed.columns[1].faces[0])
    const inSecond = await game.settled('GuildHall', (h) => h.selected?.party === 'party_2')
    await game.click(inSecond.buttons.rename)
    await game.settled('GuildHall', (h) => h.renaming !== null)
    // A chord types nothing; the first key typed replaces the old name.
    await game.press('Control+a')
    expect((await game.waitFor('GuildHall')).renaming).toBe('Second Company')
    for (const key of 'Scouts') await game.press(key)
    expect((await game.waitFor('GuildHall')).renaming).toBe('Scouts')
    await game.press('Enter')
    const renamed = await game.settled('GuildHall', (h) => h.columns[1].name === 'Scouts')
    expect(renamed.renaming).toBeNull()

    // A hero of the first party joins it by its heading.
    await game.click(renamed.columns[0].faces[0])
    const held = await game.settled('GuildHall', (h) => h.selected?.party === 'party_1')
    await game.click(held.columns[1].header)
    const moved = await game.settled('GuildHall', (h) => h.columns[1].faces.length === 2)
    expect(moved.columns[0].faces).toHaveLength(2)

    // No third party at level 4; the last party cannot be disbanded.
    await game.click(moved.columns[0].faces[0])
    const again = await game.settled('GuildHall', (h) => h.selected !== null)
    await game.click(again.buttons.form)
    const refused = await game.settled('GuildHall', (h) => h.message.includes('allows 2 parties'))
    expect(refused.columns).toHaveLength(3)

    await game.press('Escape')
    await game.waitForScenes(['Encampment'], ['World'])
    await game.click((await game.settled('Encampment')).buttons.leave)
    await game.waitForScenes(['World'])
    const map = await game.settled('World')
    expect(map.parties.map((p) => [p.name, p.members])).toEqual([['First Company', 2], ['Scouts', 2]])

    // Back in the hall, Disband sends the second party's heroes to the reserves.
    const camp2 = await enter(game)
    await game.click(facility(camp2, 'guild_hall'))
    await game.click((await game.settled('Encampment', (c) => c.selected === 'guild_hall')).buttons.open)
    await game.waitForScenes(['GuildHall'], ['World'])
    const hall2 = await game.settled('GuildHall', (h) => h.columns.length === 3)
    await game.click(hall2.columns[1].faces[0])
    const second = await game.settled('GuildHall', (h) => h.selected?.party === 'party_2')
    await game.click(second.buttons.disband)
    const disbanded = await game.settled('GuildHall', (h) => h.columns.length === 2)
    expect(disbanded.reserves).toHaveLength(2)
    expect(disbanded.message).toContain('Scouts is disbanded')
  })

  it('refuses a second party at hall level 3 and the last party disbanded', async () => {
    const game = await games.open()
    await richAtHome(game, { gold: 100 }, undefined, { 'world.guildHall': 3 })
    const camp = await enter(game)
    await game.click(facility(camp, 'guild_hall'))
    await game.click((await game.settled('Encampment', (c) => c.selected === 'guild_hall')).buttons.open)
    await game.waitForScenes(['GuildHall'], ['World'])
    const hall = await game.settled('GuildHall')
    await game.click(hall.party[0])
    const picked = await game.settled('GuildHall', (h) => h.selected !== null)
    await game.click(picked.buttons.form)
    const refused = await game.settled('GuildHall', (h) => h.message.includes('allows 1 party'))
    expect(refused.columns).toHaveLength(2)
    await game.click(refused.party[0])
    const again = await game.settled('GuildHall', (h) => h.selected !== null)
    await game.click(again.buttons.disband)
    await game.settled('GuildHall', (h) => h.message === 'The last party cannot be disbanded.')
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

  it('shows six facilities, the trading post built, and buys and sells there', async () => {
    const game = await games.open()
    await richAtHome(game, { gold: 100, salt: 4 })
    const camp = await enter(game)
    expect(camp.facilities.map((f) => [f.id, f.frame])).toEqual([
      ['guild_hall', 'camp_guild_hall/level_1'],
      ['shrine', 'camp_plot/base'],
      ['trading_post', 'camp_trading_post/level_1'],
      ['workshop', 'camp_plot/base'],
      ['infirmary', 'camp_plot/base'],
      ['builders_lodge', 'camp_plot/base'],
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

  it('opens a route from the trading post’s Routes tab, and shows it raided when a nest is placed beside the road', async () => {
    const game = await games.open()
    await game.newGame()
    const typed = async (line: string) => {
      await game.page.locator('#yomi-debug input').fill(line)
      await game.press('Enter')
    }
    await game.press('Shift+Backquote')
    await typed('contact all')
    await typed('facility trading_post 4')
    await typed('stock gold 100 timber 20')
    await game.waitFor('World', (w) => w.world.contacted.length === 2 && w.world.tradingPost === 4 && w.world.stock.gold === 100)
    await game.press('Escape')

    const goToTradingPost = async () => {
      const camp = await enter(game)
      await game.click(facility(camp, 'trading_post'))
      const shown = await game.settled('Encampment', (c) => c.selected === 'trading_post')
      await game.click(shown.buttons.open)
      await game.waitForScenes(['TradingPost'], ['World'])
      return game.settled('TradingPost')
    }
    const post = await goToTradingPost()
    await game.click(post.buttons.routesTab)
    const tab = await game.settled('TradingPost', (p) => p.tab === 'routes')
    expect(tab.routes.map((r) => [r.partner, r.status])).toEqual([['millbrook', 'closed'], ['saltmere', 'closed']])
    expect(tab.routes[0].line).toMatch(/^Open a route to Millbrook: \d+ hexes, about \d+ gold every 5 days and 1 timber every 10, costs \d+ gold, 10 timber$/)
    expect(tab.routes[0].open).toMatchObject({ visible: true, enabled: true })
    // The offer names the partner's good; the notes under the minimap give its condition (and why security is short, if it is).
    expect(tab.routes[0].line).toContain('and 1 timber every 10')
    expect(tab.routeNotes.at(-1)).toMatch(/^1 timber every 10 days while security is 50% or more/)
    // Every control lies inside the window: the frame is scaled to fit.
    for (const at of [tab.routes[0].open!, tab.buttons.buyTab, tab.buttons.sellTab, tab.buttons.routesTab, tab.buttons.close]) {
      expect(at.x).toBeGreaterThan(0)
      expect(at.x).toBeLessThan(1280)
      expect(at.y).toBeGreaterThan(0)
      expect(at.y).toBeLessThan(800)
    }
    const cost = Number(/costs (\d+) gold/.exec(tab.routes[0].line)![1])

    await game.click(tab.routes[0].open!)
    const opened = await game.settled('TradingPost', (p) => p.routes[0]?.status === 'open')
    expect(opened.message).toBe('A road is opened to Millbrook.')
    expect(opened.gold).toBe(100 - cost)
    expect(opened.routes[0].open).toBeNull()
    expect(opened.routes[0].line).toMatch(/^Millbrook road: security \d+%, about \d+ gold every 5 days$/)

    // The Market keeps one route: Saltmere's Open is faint but clickable, and says why, spending nothing.
    expect(opened.routes[1].open).toMatchObject({ visible: true, enabled: false })
    await game.click({ x: opened.routes[1].open!.x - 200, y: opened.routes[1].open!.y })
    const chosen = await game.settled('TradingPost', (p) => p.routes[1]?.selected === true)
    // Chosen but not yet clicked: the refusal shows under the minimap.
    expect(chosen.routeRefusal).toBe('The Market keeps 1 route open at most.')
    await game.click(opened.routes[1].open!)
    const refused = await game.settled('TradingPost', (p) => p.message === 'The Market keeps 1 route open at most.')
    // The refusal is told once: in the message, not again under the minimap.
    expect(refused.routeRefusal).toBeNull()
    expect(refused.gold).toBe(100 - cost)
    expect(refused.routes.map((r) => r.status)).toEqual(['open', 'closed'])

    await game.click(refused.buttons.close)
    await game.waitForScenes(['Encampment'], ['World'])
    await game.click((await game.settled('Encampment')).buttons.leave)
    await game.waitForScenes(['World'])
    const map = await game.settled('World')
    expect(map.world.routes).toHaveLength(1)
    // A nest two hexes from the road's far end: the partner's own neighbours' neighbours.
    const millbrook = PARTNERS.find((p) => p.id === 'millbrook')!.position
    const beside = hexNeighbors(hexNeighbors(millbrook)[0]).find((h) => !map.world.locations.some((l) => l.position.q === h.q && l.position.r === h.r))!
    const { col, row } = hexToOffset(beside)
    await game.press('Shift+Backquote')
    await typed(`spawn goblin_raid ${col} ${row}`)
    await game.waitFor('World', (w) => w.world.locations.some((l) => l.id.startsWith('spawn_') && l.position.q === beside.q && l.position.r === beside.r))
    await game.press('Escape')

    const again = await goToTradingPost()
    await game.click(again.buttons.routesTab)
    const raided = await game.settled('TradingPost', (p) => p.routes[0]?.status === 'raided')
    expect(raided.routes[0].line).toMatch(/pays nothing while raided$/)
  })

  it('pages the Routes tab once more than four partners are contacted, selecting the first row of the page turned to (stage 9 step 03)', async () => {
    const game = await games.open()
    await game.newGame()
    // Five partners before the far ones exist (step 05): three more, planted beside the world's own and contacted.
    const base = PARTNERS.find((p) => p.id === 'millbrook')!.position
    const extra = ['stonehollow', 'elder_glade', 'emberwatch'].map((id, i) => ({
      id,
      kind: 'partner',
      name: id,
      position: { q: base.q - 1 - i, r: base.r + 3 },
      good: 'stone',
    }))
    await game.page.evaluate((planted) => {
      const saved = JSON.parse(localStorage.getItem('yomi.save.1')!)
      const { world } = saved.game
      world.locations.push(...planted)
      world.contacted = ['millbrook', 'saltmere', ...planted.map((p) => p.id)]
      world.tradingPost = 4
      localStorage.setItem('yomi.save.1', JSON.stringify(saved))
    }, extra)
    await game.resize(840, 560)
    await game.click((await game.reload()).buttons.continue)
    await game.waitForScenes(['World'])
    const camp = await enter(game)
    await game.click(facility(camp, 'trading_post'))
    await game.click((await game.settled('Encampment', (c) => c.selected === 'trading_post')).buttons.open)
    await game.waitForScenes(['TradingPost'], ['World'])
    await game.click((await game.settled('TradingPost')).buttons.routesTab)
    const first = await game.settled('TradingPost', (p) => p.tab === 'routes' && p.routes.length > 0)
    expect(first.routes.map((r) => r.partner)).toEqual(['millbrook', 'saltmere', 'stonehollow', 'elder_glade'])
    expect(first.routes[0].selected).toBe(true)
    expect(first.buttons.prev.enabled).toBe(false)
    expect(first.buttons.next.enabled).toBe(true)
    // The pager sits under the four rows, clear of the message line and Close.
    expect(first.buttons.next.y).toBeGreaterThan(first.routes[3].open!.y)
    expect(first.buttons.next.y).toBeLessThan(first.routeStack?.messageTop ?? first.buttons.close.y)
    expect(first.buttons.next.y).toBeLessThan(first.buttons.close.y)

    await game.click(first.buttons.next)
    const second = await game.settled('TradingPost', (p) => p.routes[0]?.partner === 'emberwatch')
    expect(second.routes.map((r) => [r.partner, r.selected])).toEqual([['emberwatch', true]])
    expect(second.buttons.prev.enabled).toBe(true)
    expect(second.buttons.next.enabled).toBe(false)

    await game.click(second.buttons.prev)
    const back = await game.settled('TradingPost', (p) => p.routes.length === 4)
    expect(back.routes.map((r) => [r.partner, r.selected])).toEqual([['millbrook', true], ['saltmere', false], ['stonehollow', false], ['elder_glade', false]])
  })

  it('keeps the Routes tab\'s notes and refusal above the message line at 840 × 560, in the worst case (verification round 3)', async () => {
    const game = await games.open()
    const start = await game.newGame()
    const road = roadTo(start.world, 'saltmere')!
    const cols = start.world.board.cols
    const index = (i: number) => {
      const { col, row } = hexToOffset(road[i])
      return row * cols + col
    }
    // Saltmere's road: corrupted (explored) far out, blighted and tainted beyond it, so the offer is raided at once,
    // its security below 50% (the good's note "(not now)"), and with the stock spent on Millbrook's route, refused.
    const marks = [
      { index: index(15), level: 3 },
      ...[16, 17, 18, 19, 20, 21, 22, 23, 24, 25].map((i) => ({ index: index(i), level: 2 })),
      ...[8, 9, 10, 11, 12, 13, 14, 26, 27].map((i) => ({ index: index(i), level: 1 })),
    ]
    await game.page.evaluate((planted) => {
      const saved = JSON.parse(localStorage.getItem('yomi.save.1')!)
      const { world } = saved.game
      world.contacted = ['millbrook', 'saltmere']
      world.tradingPost = 5
      world.stock = { gold: 27, timber: 10 }
      for (const { index, level } of planted) {
        world.blight[index] = level
        world.seen[index] = level
      }
      localStorage.setItem('yomi.save.1', JSON.stringify(saved))
    }, marks)
    await game.resize(840, 560)
    await game.click((await game.reload()).buttons.continue)
    await game.waitForScenes(['World'])
    const camp = await enter(game)
    await game.click(facility(camp, 'trading_post'))
    await game.click((await game.settled('Encampment', (c) => c.selected === 'trading_post')).buttons.open)
    await game.waitForScenes(['TradingPost'], ['World'])
    await game.click((await game.settled('TradingPost')).buttons.routesTab)
    const tab = await game.settled('TradingPost', (p) => p.tab === 'routes' && p.routes.length === 2)
    await game.click(tab.routes[0].open!)
    const opened = await game.settled('TradingPost', (p) => p.routes[0]?.status === 'open' || p.routes[0]?.status === 'raided')
    expect(opened.message).toBe('A road is opened to Millbrook.')
    await game.click({ x: opened.routes[1].open!.x - 150, y: opened.routes[1].open!.y })
    const worst = await game.settled('TradingPost', (p) => p.routes[1]?.selected === true)
    expect(worst.routes[1].line).toMatch(/Raided at once\.$/)
    expect(worst.routeRefusal).toMatch(/more than the stock holds/)
    expect(worst.routeNotes[0]).toMatch(/^Raided at once: the blight has overrun it \d+ hexes out\.$/)
    expect(worst.routeStack).not.toBeNull()
    expect(worst.routeStack!.bottom).toBeLessThan(worst.routeStack!.messageTop)
  })
})
