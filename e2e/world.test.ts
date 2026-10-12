import { describe, expect, it } from 'vitest'
import { offsetToHex } from '../src/grid/hex.ts'
import { RAIDERS, useGames, worldHexOnScreen } from './driver.ts'

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
})
