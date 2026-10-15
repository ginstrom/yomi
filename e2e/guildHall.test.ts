import { describe, expect, it } from 'vitest'
import type { GuildHallProbe } from '../src/testHook.ts'
import { useGames, type Game } from './driver.ts'

/** A new game with gold and iron planted in its stock, reloaded and continued at Oakvale. */
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

const names = (heroes: GuildHallProbe['party']) => heroes.map((hero) => hero.name)

describe('the guild hall', () => {
  const games = useGames()

  it('opens over the map at Oakvale, upgrades, recruits and swaps, and gives the map back the new party', async () => {
    const game = await games.open()
    const home = await richAtHome(game)
    expect(home.buttons.guildHall.visible).toBe(true)
    await game.click(home.buttons.guildHall)
    await game.waitForScenes(['GuildHall'], ['World'])
    const hall = await game.settled('GuildHall')
    expect([hall.level, hall.partyLimit, hall.buttons.toParty.enabled]).toEqual([1, 3, false])

    await game.click(hall.buttons.upgrade)
    const raised = await game.settled('GuildHall', (h) => h.level === 2)
    expect(raised.partyLimit).toBe(4)
    expect(raised.message).toBe('The guild hall is raised to level 2.')

    await game.click(raised.buttons.recruit)
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

    await game.click(swapped.buttons.close)
    await game.waitForScenes(['World'])
    const back = await game.settled('World')
    expect(back.party.map((member) => member.name)).toEqual(['Aldric', 'Delwyn', 'Garrick'])
    expect(back.world.stock).toMatchObject({ gold: 60, iron: 35 })
  })

  it('raises the shrine for the stock, beside the hall’s upgrade', async () => {
    const game = await games.open()
    const home = await richAtHome(game)
    await game.click(home.buttons.guildHall)
    await game.waitForScenes(['GuildHall'], ['World'])
    const hall = await game.settled('GuildHall')
    expect([hall.shrine, hall.buttons.shrine.enabled]).toEqual([0, true])
    await game.click(hall.buttons.shrine)
    const raised = await game.settled('GuildHall', (h) => h.shrine === 1)
    expect(raised.message).toContain('raised to level 1')
    // The second level wants silver, which the stock has none of.
    expect(raised.buttons.shrine.enabled).toBe(false)
    await game.click(raised.buttons.close)
    await game.waitForScenes(['World'])
    expect((await game.settled('World')).world.stock).toMatchObject({ gold: 80, iron: 50 })
  })

  it('leads to character creation for a recruit and back again', async () => {
    const game = await games.open()
    const home = await richAtHome(game)
    await game.click(home.buttons.guildHall)
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
