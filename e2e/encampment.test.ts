import { describe, expect, it } from 'vitest'
import type { EncampmentProbe, GuildHallProbe } from '../src/testHook.ts'
import { useGames, type Game } from './driver.ts'

/** A new game with gold and iron planted in its stock, reloaded and continued at the encampment. */
async function richAtHome(game: Game) {
  await game.newGame()
  await game.page.evaluate(() => {
    const saved = JSON.parse(localStorage.getItem('yomi.save.1')!)
    saved.game.world.stock = { gold: 100, iron: 50 }
    localStorage.setItem('yomi.save.1', JSON.stringify(saved))
  })
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
})
