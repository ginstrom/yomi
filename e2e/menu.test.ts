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

  it('lays the manual over the game, and Back to game returns to the menu and the paused map', async () => {
    const game = await games.open()
    await game.newGame()
    await game.press('Escape')
    await game.waitForScenes(['Menu'], ['World'])
    const menu = await game.settled('Menu')
    await game.click(menu.buttons.manual)
    await game.waitFor('Menu', (m) => m.showingManual)
    const manual = game.page.locator('#yomi-manual')
    await manual.locator('h1', { hasText: "Player's Manual" }).waitFor()
    // Its screenshots load: an image that failed would fail the test as a failed request.
    await manual.locator('img').first().evaluate((img: HTMLImageElement) => img.decode())

    await manual.locator('.manual-back').click()
    await game.waitFor('Menu', (m) => !m.showingManual)
    expect(await manual.count()).toBe(0)
    expect(await game.scenes()).toEqual({ running: ['Menu'], paused: ['World'] })

    await game.click(menu.buttons.manual)
    await game.waitFor('Menu', (m) => m.showingManual)
    // Esc belongs to the manual while it is open: it must not reach the menu and resume the game.
    await game.page.keyboard.press('Escape')
    await game.waitFor('Menu', (m) => !m.showingManual)
    expect(await game.scenes()).toEqual({ running: ['Menu'], paused: ['World'] })
  })
})
