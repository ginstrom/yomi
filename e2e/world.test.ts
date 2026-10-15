import { describe, expect, it } from 'vitest'
import type { WorldState, WorldStatus } from '../src/game/worldMap.ts'
import { offsetToHex } from '../src/grid/hex.ts'
import type { WorldProbe } from '../src/testHook.ts'
import { RAIDERS, useGames, worldHexOnScreen, type Game } from './driver.ts'

describe('the world map', () => {
  const games = useGames()

  it('opens a new game on turn 1 and walks the party to a clicked hex, a turn a hex', async () => {
    const game = await games.open()
    const start = await game.newGame()
    expect(start.world.turn).toBe(1)
    expect(start.world.party).toEqual(offsetToHex(9, 19))
    expect(start.buttons.attack.visible).toBe(false)

    const arrived = await game.travelTo(offsetToHex(11, 19))
    expect(arrived.world.turn).toBe(3)
    expect(arrived.world.confronting).toBeNull()
  })

  it('opens on the home valley and the Source, the rest unexplored, and reveals land as the party travels', async () => {
    const game = await games.open()
    const start = await game.newGame()
    const index = (col: number, row: number) => row * start.world.board.cols + col
    expect(start.visible).toContain(index(9, 19))
    expect(start.world.seen[index(58, 19)]).toBeGreaterThanOrEqual(0)
    expect(start.world.seen[index(9, 28)]).toBe(-1)
    expect(start.world.sighted).toContain('blight_source')

    const south = await game.travelTo(offsetToHex(9, 25))
    expect(south.visible).toContain(index(9, 28))
    expect(south.world.seen[index(9, 28)]).toBeGreaterThanOrEqual(0)
  })

  it('holds the party among monsters until it answers them', async () => {
    const game = await games.open()
    await game.newGame()
    const among = await game.travelTo(RAIDERS.position)
    expect(among.world.confronting).toBe(RAIDERS.id)
    expect(among.message).toContain('Goblin Raiders')
    expect(among.buttons.attack.visible).toBe(true)

    // No walking away from them.
    await game.click(worldHexOnScreen(among, offsetToHex(11, 19)))
    const held = (await game.probe('World'))!
    expect(held.walking).toBe(false)
    expect(held.world.party).toEqual(RAIDERS.position)

    await game.click(among.buttons.wait)
    const waited = await game.waitFor('World', (w) => w.world.confronting === null)
    expect(waited.world.turn).toBe(among.world.turn + 1)
    await game.travelTo(offsetToHex(11, 19))
  })

  it('starts a battle when the party attacks', async () => {
    const game = await games.open()
    const battle = await game.enterBattle()
    expect(await game.scenes()).toEqual({ running: ['Battle'], paused: [] })
    expect(battle.state).toMatchObject({ round: 1, phase: 'player' })
    expect(battle.state.units.filter((u) => u.side === 'player')).toHaveLength(3)
    expect(battle.log[0]).toMatchObject({ type: 'battle_start', seed: 1 })
  })

  it('puts a beaten location’s loot in the baggage, from which a hero takes it and wears it', async () => {
    const game = await games.open()
    await game.enterBattle()
    const over = await game.fightBattle()
    expect(over.state.winner).toBe('player')
    expect(over.result.at(-1)).toBe('Found: Ring of Protection.')
    await game.click(over.buttons.result)
    await game.waitForScenes(['World'])

    const world = await game.waitFor('World')
    await game.click(world.party[0])
    await game.waitForScenes(['Inventory'], ['World'])
    await game.press('i')
    const before = await game.waitFor('Inventory', (p) => p.tab === 'inventory')
    expect(before.ground.map((slot) => slot.item)).toEqual(['ring_protection'])
    expect(before.equipment.ring1.item).toBeNull()

    // A click on an item in the baggage takes it, and a click on it in the backpack puts it on.
    await game.click(before.ground[0])
    const taken = await game.waitFor('Inventory', (p) => p.ground.length === 0)
    const ring = taken.backpack.find((slot) => slot.item === 'ring_protection')!
    expect(ring).toBeDefined()
    await game.click(ring)
    const worn = await game.waitFor('Inventory', (p) => p.equipment.ring1.item === 'ring_protection')
    expect(worn.armorClass).toBe(before.armorClass + 5)

    // Another hero takes over what the first puts back in the baggage.
    await game.page.mouse.click(worn.equipment.ring1.x, worn.equipment.ring1.y, { button: 'right' })
    const dropped = await game.waitFor('Inventory', (p) => p.ground.length === 1 && p.armorClass === before.armorClass)
    expect(dropped.equipment.ring1.item).toBeNull()
    await game.click(dropped.party[2])
    const other = await game.waitFor('Inventory', (p) => p.party[2].active)
    expect(other.ground.map((slot) => slot.item)).toEqual(['ring_protection'])

    await game.press('Escape')
    await game.waitForScenes(['World'])
  })

  it('camps only away from monsters, and camps until the party’s wounds are healed', async () => {
    const game = await games.open()
    const home = await game.newGame()
    expect(home.buttons.camp.visible).toBe(true)
    expect(home.buttons.campUntilHealed.enabled).toBe(false)
    await game.click(home.buttons.camp)
    const rested = await game.waitFor('World', (w) => w.world.turn === 2)
    expect(rested.message).toContain('You camp a day')

    const among = await game.travelTo(RAIDERS.position)
    expect(among.buttons.camp.visible).toBe(false)
    expect(among.buttons.campUntilHealed.visible).toBe(false)
    await game.click(among.buttons.wait)
    await game.waitFor('World', (w) => w.world.confronting === null)
    await game.travelTo(offsetToHex(11, 19))

    // Wounded as a battle leaves a party: planted in the save, and loaded.
    await game.page.evaluate(() => {
      const save = JSON.parse(localStorage.getItem('yomi.save.1')!)
      save.game.party[0].hp = 1
      save.game.party[1].hp = 2
      localStorage.setItem('yomi.save.1', JSON.stringify(save))
    })
    await game.click((await game.reload()).buttons.continue)
    await game.waitForScenes(['World'])
    const hurt = await game.settled('World', (w) => w.buttons.campUntilHealed.enabled)
    await game.click(hurt.buttons.campUntilHealed)
    const healed = await game.waitFor('World', (w) => !w.buttons.campUntilHealed.enabled)
    expect(healed.message).toMatch(/^Camped \d+ days?: \d+ hp healed \(\d+ by rest, \d+ by spells\)\.$/)
    expect(healed.world.turn).toBeGreaterThan(hurt.world.turn)
  })

  it('pauses under the menu on Esc and resumes where it was', async () => {
    const game = await games.open()
    await game.newGame()
    const before = await game.travelTo(offsetToHex(11, 19))

    await game.press('Escape')
    await game.waitForScenes(['Menu'], ['World'])
    const menu = await game.waitFor('Menu')
    expect(menu.buttons.continue.enabled).toBe(true)
    await game.click(menu.buttons.continue)
    await game.waitForScenes(['World'])
    expect((await game.probe('World'))!.world).toEqual(before.world)

    // Esc closes the menu as well as opening it.
    await game.press('Escape')
    await game.waitForScenes(['Menu'], ['World'])
    await game.press('Escape')
    await game.waitForScenes(['World'])
  })

  /** A new game saved in slot 1, its world's status changed there and the page reloaded on it, as the game would leave it. */
  /** The game in slot 1 with `changes` made to its world, reloaded and continued. */
  async function reloadedWith(game: Game, changes: Partial<WorldState>): Promise<WorldProbe> {
    await game.page.evaluate((changes) => {
      const saved = JSON.parse(localStorage.getItem('yomi.save.1')!)
      Object.assign(saved.game.world, changes)
      localStorage.setItem('yomi.save.1', JSON.stringify(saved))
    }, changes)
    const menu = await game.reload()
    await game.click(menu.buttons.continue)
    await game.waitForScenes(['World'])
    return game.settled('World')
  }

  async function reloadedAs(game: Game, status: WorldStatus): Promise<WorldProbe> {
    await game.newGame()
    return reloadedWith(game, { status })
  }

  it('builds a watchtower on clean land with the stock, and says what it costs without', async () => {
    const game = await games.open()
    await game.newGame()
    const there = await game.travelTo(offsetToHex(7, 17))
    expect(there.buttons.buildTower.visible).toBe(true)
    await game.click(there.buttons.buildTower)
    const poor = await game.waitFor('World', (w) => w.message.includes('costs'))
    expect(poor.world.towers).toEqual([])

    const rich = await reloadedWith(game, { stock: { iron: 10, gold: 5 } })
    await game.click(rich.buttons.buildTower)
    const built = await game.waitFor('World', (w) => w.world.towers.length === 1)
    expect(built.message).toContain('A watchtower rises')
    // Spent, though the day's yield may have come in since.
    expect(built.world.stock.iron).toBeLessThan(10)
    expect(built.world.turn).toBe(rich.world.turn + 1)
    expect(built.buttons.buildTower.visible).toBe(false)
  })

  it('shows the victory once the Source is beaten, to end on or go on in endless mode', async () => {
    const game = await games.open()
    const won = await reloadedAs(game, 'won')
    expect(won.outcome).toMatch(/^VICTORY!/)
    expect([won.buttons.end.visible, won.buttons.endless.visible, won.buttons.camp.visible]).toEqual([true, true, false])

    await game.click(won.buttons.endless)
    const endless = await game.waitFor('World', (w) => w.world.status === 'endless')
    expect(endless.outcome).toBe('')
    expect(endless.buttons.end.visible).toBe(false)
    // The game kept is the one that goes on.
    expect(await game.page.evaluate(() => JSON.parse(localStorage.getItem('yomi.save.1')!).game.world.status)).toBe('endless')
  })

  it('ends on the menu with the save kept, when the player ends a won game', async () => {
    const game = await games.open()
    const won = await reloadedAs(game, 'won')
    await game.click(won.buttons.end)
    await game.waitForScenes(['Menu'])
    expect(await game.page.evaluate(() => JSON.parse(localStorage.getItem('yomi.save.1')!).game.world.status)).toBe('won')
  })

  it('ends the playthrough when the encampment falls, freeing its slot', async () => {
    const game = await games.open()
    const lost = await reloadedAs(game, 'lost')
    expect(lost.outcome).toMatch(/^DEFEAT/)
    expect(lost.buttons.menu.visible).toBe(true)
    expect(await game.page.evaluate(() => localStorage.getItem('yomi.save.1'))).toBeNull()
    await game.click(lost.buttons.menu)
    await game.waitForScenes(['Menu'])
  })
})
