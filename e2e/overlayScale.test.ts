import { describe, expect, it } from 'vitest'
import { useGames } from './driver.ts'

// A frame grows in whole steps on a big window (src/scenes/overlayScale.ts); everything in it scales together.
describe('overlay frames on a large window', () => {
  const games = useGames()
  const BUILDING_1X = 96
  const INVENTORY_PANEL_1X = 720 // PANEL_W in src/scenes/InventoryScene.ts

  it('draws the encampment at 2x on 1920 by 1080, clicks still land, and goes back to 1x at 1280 by 800', async () => {
    const game = await games.open()
    await game.newGame()
    await game.resize(1920, 1080)
    await game.settled('World')
    await game.click((await game.waitFor('World')).buttons.enterEncampment)
    await game.waitForScenes(['Encampment'], ['World'])
    const camp = await game.settled('Encampment')
    const shrine = camp.facilities.find((f) => f.id === 'shrine')!
    expect(shrine.building.width).toBe(BUILDING_1X * 2)
    await game.click(shrine)
    const shown = await game.settled('Encampment', (c) => c.selected === 'shrine')
    expect(shown.buttons.improve.visible).toBe(true)

    await game.resize(1280, 800)
    const small = await game.settled('Encampment', (c) => c.facilities[0].building.width === BUILDING_1X)
    expect(small.facilities.every((f) => f.building.width === BUILDING_1X)).toBe(true)
  })

  it('drags gear in the inventory at 1920 by 1080', async () => {
    const game = await games.open()
    await game.resize(1920, 1080)
    const world = await game.newGame()
    await game.click(world.party[0])
    await game.waitForScenes(['Inventory'], ['World'])
    await game.press('i')
    const panel = await game.settled('Inventory', (p) => p.tab === 'inventory')
    expect(panel.characterSheet.panel.width).toBe(INVENTORY_PANEL_1X * 2)
    const weapon = panel.equipment.mainHand.item!
    expect(weapon).not.toBeNull()
    await game.drag(panel.equipment.mainHand, panel.grids.backpack)
    const stowed = await game.settled('Inventory', (p) => p.equipment.mainHand.item === null)
    expect(stowed.backpack.map((slot) => slot.item)).toContain(weapon)
  })
})
