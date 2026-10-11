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
