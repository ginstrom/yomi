import { describe, expect, it } from 'vitest'
import { offsetToHex, type Hex } from '../src/grid/hex.ts'
import { useGames, type Game } from './driver.ts'

/**
 * A new game whose slot gets a second party, `members` strong, standing on the
 * first party's hex (or on `apart`), with items in the first party's baggage,
 * reloaded and continued.
 */
async function twoParties(game: Game, { members = 1, apart = false, away: awayFromHome = false, at }: { members?: number; apart?: boolean; away?: boolean; at?: Hex } = {}) {
  await game.newGame()
  await game.page.evaluate(
    ([members, apart, away, awayFromHome, at]) => {
      const saved = JSON.parse(localStorage.getItem('yomi.save.1')!)
      const lead = saved.game.parties[0]
      lead.baggage = ['iron_sword', 'oak_shield']
      const second = JSON.parse(JSON.stringify(lead))
      second.members = second.members.slice(0, members as number)
      for (const member of second.members) member.name = `${member.name}2`
      Object.assign(second, { id: 'party_2', name: 'Second Company', order: { kind: 'idle' }, confronting: null, baggage: [] })
      if (apart) second.position = away
      if (awayFromHome) lead.position = second.position = at ?? away
      saved.game.parties.push(second)
      saved.game.world.guildHall = 4
      localStorage.setItem('yomi.save.1', JSON.stringify(saved))
    },
    [members, apart, offsetToHex(7, 19), awayFromHome, at ?? null] as const,
  )
  const menu = await game.reload()
  await game.click(menu.buttons.continue)
  await game.waitForScenes(['World'])
  return game.settled('World', (w) => w.figures.length === 2)
}

describe('exchange', () => {
  const games = useGames()

  it('trades heroes and baggage between two parties on one hex, from the footer and from the character panel', async () => {
    const game = await games.open()
    const world = await twoParties(game)
    expect(world.buttons.exchange.visible).toBe(true)
    await game.click(world.buttons.exchange)
    await game.waitForScenes(['Exchange'], ['World'])
    const open = await game.settled('Exchange')
    expect(open.parties).toEqual(['party_1', 'party_2'])
    expect(open.rows.map((row) => row.length)).toEqual([3, 1])
    expect(open.baggageCounts).toEqual([2, 0])

    // A click on an item passes it across.
    await game.click(open.baggage[0][0])
    const passed = await game.settled('Exchange', (x) => x.baggageCounts[1] === 1)
    expect(passed.baggageCounts).toEqual([1, 1])
    expect(passed.baggage[1][0].id).toBe('iron_sword')

    // A hero picked and one of the other row clicked: the two change places.
    const [lead] = open.rows[0]
    await game.click(lead)
    const picked = await game.settled('Exchange', (x) => x.selected !== null)
    await game.click(picked.rows[1][0])
    const swapped = await game.settled('Exchange', (x) => x.rows[1][0].name === lead.name)
    expect(swapped.rows[0][0].name).toBe(open.rows[1][0].name)

    // The party's only hero cannot leave it empty; another can move across by the heading.
    await game.click(swapped.rows[1][0])
    const only = await game.settled('Exchange', (x) => x.selected?.row === 1)
    await game.click(only.headers[0])
    const refused = await game.settled('Exchange', (x) => x.message.includes('empty'))
    expect(refused.rows.map((row) => row.length)).toEqual([3, 1])
    await game.click(refused.rows[0][1])
    const again = await game.settled('Exchange', (x) => x.selected?.row === 0)
    await game.click(again.headers[1])
    const moved = await game.settled('Exchange', (x) => x.rows[1].length === 2)
    expect(moved.rows.map((row) => row.length)).toEqual([2, 2])

    await game.click(moved.buttons.close)
    await game.waitForScenes(['World'])
    const back = await game.settled('World')
    expect(back.parties.map((p) => p.members)).toEqual([2, 2])
    expect(back.party).toHaveLength(2)

    // The character panel offers it too, on its Inventory tab, and Esc closes the exchange.
    await game.press('KeyC')
    await game.waitForScenes(['Inventory'], ['World'])
    await game.press('KeyI')
    const panel = await game.settled('Inventory', (p) => p.tab === 'inventory' && p.exchangeButton.visible)
    await game.click(panel.exchangeButton)
    await game.waitForScenes(['Exchange'], ['World'])
    expect((await game.settled('Exchange')).baggageCounts).toEqual([1, 1])
    await game.press('Escape')
    await game.waitForScenes(['World'])
  })

  it('fits the footer beside Return home in the least window', async () => {
    const game = await games.open()
    await twoParties(game, { away: true })
    await game.resize(840, 560)
    const small = await game.waitFor('World', (w) => w.view.width < 700 && w.buttons.exchange.visible)
    for (const button of [small.buttons.nextDay, small.buttons.untilSomething, small.buttons.home, small.buttons.exchange]) {
      expect(button.visible).toBe(true)
      expect(button.x).toBeGreaterThan(80)
      expect(button.x).toBeLessThan(840 - 80)
      expect(button.y).toBeLessThan(560)
    }
    expect(small.buttons.exchange.x).toBeGreaterThan(small.buttons.home.x)
  })

  it('fits all five time buttons in the least window with two parties on a held site', async () => {
    const game = await games.open()
    await twoParties(game, { away: true, at: offsetToHex(11, 21) })
    await game.resize(840, 560)
    const busy = await game.waitFor('World', (w) => w.view.width < 700 && w.buttons.exchange.visible && w.buttons.garrison.visible)
    // A footer button is as wide as its label needs, but for 96px (WorldScene's footerWidth).
    const width = (label: string) => Math.max(96, label.length * 10 + 24)
    const shown: Array<[string, { x: number; visible: boolean }]> = [
      ['Next day', busy.buttons.nextDay],
      ['Until something happens', busy.buttons.untilSomething],
      ['Return home', busy.buttons.home],
      ['Garrison', busy.buttons.garrison],
      ['Exchange', busy.buttons.exchange],
    ]
    for (const [label, button] of shown) {
      expect(button.visible).toBe(true)
      expect(button.x - width(label) / 2).toBeGreaterThanOrEqual(80)
      expect(button.x + width(label) / 2).toBeLessThanOrEqual(840)
    }
  })

  it('offers no exchange while the parties stand apart', async () => {
    const game = await games.open()
    const world = await twoParties(game, { apart: true })
    expect(world.buttons.exchange.visible).toBe(false)
    await game.press('KeyC')
    await game.waitForScenes(['Inventory'], ['World'])
    await game.press('KeyI')
    const panel = await game.settled('Inventory', (p) => p.tab === 'inventory')
    expect(panel.exchangeButton.visible).toBe(false)
  })
})
