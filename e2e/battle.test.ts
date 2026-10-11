import { describe, expect, it } from 'vitest'
import { offsetToHex } from '../src/grid/hex.ts'
import type { BattleProbe } from '../src/testHook.ts'
import { RAIDERS, battleHexOnScreen, useGames } from './driver.ts'

/** The first party member's unit, which is the one selected as a battle opens. */
const hero = (battle: BattleProbe) => battle.state.units.find((u) => u.id === 'hero_1')!

describe('a battle', () => {
  const games = useGames()

  it('moves a hero to a clicked hex, and plays the enemy turn back when the turn ends', async () => {
    const game = await games.open()
    const start = await game.enterBattle()
    expect(start.selected).toBe('hero_1')

    const to = offsetToHex(3, 2)
    await game.click(battleHexOnScreen(start, to))
    const moved = await game.awaitTurn()
    expect(hero(moved)).toMatchObject({ position: to, ap: 6 })

    await game.click(moved.buttons.endTurn)
    const next = await game.waitFor('Battle', (b) => b.playerControl && b.state.round === 2)
    expect(next.log.filter((e) => e.type === 'end_turn')).toHaveLength(2)
    const foes = ['goblin', 'kobold']
    expect(next.log.some((e) => e.type === 'move' && foes.includes(e.unit))).toBe(true)
    expect(hero(next).ap).toBe(8)
  })

  it('tells the engine of gear changed in the inventory, for an action point', async () => {
    const game = await games.open()
    await game.enterBattle()

    await game.press('i')
    await game.waitForScenes(['Inventory'], ['Battle'])
    const panel = await game.waitFor('Inventory')
    expect(panel.tab).toBe('inventory')
    const weapon = panel.equipment.mainHand.item
    expect(weapon).not.toBeNull()

    // A click on a worn item stows it.
    await game.click(panel.equipment.mainHand)
    const stowed = await game.waitFor('Inventory', (p) => p.equipment.mainHand.item === null)
    expect(stowed.backpack.map((slot) => slot.item)).toContain(weapon)

    await game.press('Escape')
    await game.waitForScenes(['Battle'])
    const battle = await game.awaitTurn()
    expect(hero(battle).ap).toBe(7)
    expect(battle.log.at(-1)).toMatchObject({ type: 'equip', unit: 'hero_1', apCost: 1 })
  })

  it('pauses under the menu on Esc, resumes on Continue, and is dropped for a new game', async () => {
    const game = await games.open()
    const before = await game.enterBattle()

    await game.press('Escape')
    await game.waitForScenes(['Menu'], ['Battle'])
    await game.click((await game.waitFor('Menu')).buttons.continue)
    await game.waitForScenes(['Battle'])
    expect((await game.awaitTurn()).state).toEqual(before.state)

    await game.press('Escape')
    await game.waitForScenes(['Menu'], ['Battle'])
    await game.click((await game.waitFor('Menu')).buttons.new)
    await game.waitForScenes(['World'])
    const world = await game.waitFor('World')
    expect(world.world.turn).toBe(1)
    expect(world.world.locations.some((l) => l.id === RAIDERS.id)).toBe(true)
  })

  it('returns a victorious party to the world map, with the monsters gone', async () => {
    const game = await games.open()
    await game.enterBattle()
    const over = await game.fightBattle()
    expect(over.state.winner).toBe('player')
    expect(over.log.some((e) => e.type === 'attack')).toBe(true)

    await game.click(over.buttons.result)
    await game.waitForScenes(['World'])
    const world = await game.waitFor('World')
    expect(world.world.locations.some((l) => l.id === RAIDERS.id)).toBe(false)
    expect(world.world.confronting).toBeNull()
    expect(world.world.party).toEqual(RAIDERS.position)
    expect(world.buttons.attack.visible).toBe(false)
  })

  it('ends the game at the main menu when the party falls', async () => {
    const game = await games.open()
    await game.enterBattle()
    const over = await game.loseBattle()
    expect(over.state.winner).toBe('enemy')

    await game.click(over.buttons.result)
    await game.waitForScenes(['Menu'])
    expect((await game.waitFor('Menu')).buttons.continue.enabled).toBe(false)
  })

  it('lays itself out again when the window changes size, under an open inventory too', async () => {
    const game = await games.open()
    await game.enterBattle()
    await game.press('i')
    await game.waitForScenes(['Inventory'], ['Battle'])

    for (const [width, height] of [[1600, 900], [760, 560], [900, 1200]]) {
      await game.resize(width, height)
      expect(await game.canvasSize()).toEqual({ width, height })
      const panel = (await game.probe('Inventory'))!
      const battle = (await game.probe('Battle'))!
      for (const at of [panel.equipment.head, panel.equipment.belt, battle.buttons.attack, battle.buttons.endTurn]) {
        expect(at.x).toBeGreaterThan(0)
        expect(at.x).toBeLessThan(width)
        expect(at.y).toBeGreaterThan(0)
        expect(at.y).toBeLessThan(height)
      }
    }

    // Smaller than the game gets: the canvas keeps its least size and the page scrolls.
    await game.resize(500, 400)
    expect(await game.canvasSize()).toEqual({ width: 760, height: 560 })

    // Clicks still land on the hexes where they are now drawn.
    await game.resize(1000, 700)
    await game.press('Escape')
    await game.waitForScenes(['Battle'])
    const battle = await game.awaitTurn()
    const to = offsetToHex(3, 2)
    await game.click(battleHexOnScreen(battle, to))
    expect(hero(await game.awaitTurn())).toMatchObject({ position: to })
  })
})
