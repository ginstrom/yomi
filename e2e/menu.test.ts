import { describe, expect, it } from 'vitest'
import { VIEWPORT, useGames } from './driver.ts'

describe('the main menu', () => {
  const games = useGames()

  it('is what the game boots to, filling the window, with no game to continue', async () => {
    const game = await games.open()
    expect(await game.scenes()).toEqual({ running: ['Menu'], paused: [] })
    expect(await game.canvasSize()).toEqual(VIEWPORT)
    const menu = await game.waitFor('Menu')
    expect(menu.buttons.new).toMatchObject({ visible: true, enabled: true })
    expect(menu.buttons.continue).toMatchObject({ visible: true, enabled: false })
  })

  it('swaps its buttons for the options and back', async () => {
    const game = await games.open()
    const menu = await game.waitFor('Menu')
    await game.click(menu.buttons.options)
    const options = await game.waitFor('Menu', (m) => m.showingOptions)
    expect(options.buttons.new.visible).toBe(false)
    await game.click(options.buttons.back)
    const back = await game.waitFor('Menu', (m) => !m.showingOptions)
    expect(back.buttons.new.visible).toBe(true)
  })
})
