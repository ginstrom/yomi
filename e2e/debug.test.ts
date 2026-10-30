import { describe, expect, it } from 'vitest'
import { koboldScouts } from '../src/game/encounters.ts'
import { partyFighters, readyMadeParty } from '../src/game/party.ts'
import { useGames, type Game } from './driver.ts'

/** Types a line at the open console and presses Enter. */
async function command(game: Game, line: string): Promise<void> {
  await game.page.locator('#yomi-debug input').fill(line)
  await game.press('Enter')
}

describe('the debug console', () => {
  const games = useGames()

  it('opens with ~ over the world map, runs commands that change the map, and keeps keys from the game', async () => {
    const game = await games.open()
    await game.newGame()
    const console = game.page.locator('#yomi-debug')
    await game.press('Shift+Backquote')
    await expect.poll(() => console.isVisible()).toBe(true)

    await command(game, 'help')
    await expect.poll(() => console.textContent()).toContain('goto <col> <row>')
    await command(game, 'stock gold 30')
    await game.waitFor('World', (w) => w.world.stock.gold === 30)

    // C would open the character panel, were the console not taking every key.
    await game.press('KeyC')
    await game.waitForScenes(['World'])

    await game.press('Escape')
    await expect.poll(() => console.isVisible()).toBe(false)
    await game.press('Backquote')
    await expect.poll(() => console.isVisible()).toBe(true)
    await game.press('Shift+Backquote')
    await expect.poll(() => console.isVisible()).toBe(false)
  })

  it('reads a battle, and refuses to change the game there', async () => {
    const game = await games.open()
    await game.enterBattle()
    await game.press('Shift+Backquote')
    const output = game.page.locator('#yomi-debug .debug-output')
    await command(game, 'units')
    await expect.poll(() => output.textContent()).toContain('Round 1')
    await command(game, 'heal')
    await expect.poll(() => output.textContent()).toContain('only on the world map')
  })

  it('fights any encounter at any threat from the world map, clearing nothing and taking no loot', async () => {
    const game = await games.open()
    const before = await game.newGame()
    await game.press('Shift+Backquote')
    await command(game, 'fight kobold_scouts 2')
    await game.waitForScenes(['Battle'])
    await game.press('Escape')
    const battle = await game.waitFor('Battle', (b) => b.playerControl)
    const expected = koboldScouts(partyFighters(readyMadeParty()), 2).setup.units.filter((u) => u.side === 'enemy')
    const enemies = battle.state.units.filter((u) => u.side === 'enemy')
    expect(enemies.map((u) => [u.id, u.maxHp])).toEqual(expected.map((u) => [u.id, u.stats.maxHp]))

    const over = await game.fightBattle()
    expect(over.state.winner).toBe('player')
    expect(over.result.some((line) => /^\+\d+ XP/.test(line))).toBe(true)
    expect(over.result.some((line) => line.startsWith('Found:'))).toBe(false)

    await game.click(over.buttons.result)
    await game.waitForScenes(['World'])
    const after = await game.waitFor('World')
    expect(after.world.locations.map((l) => l.id)).toEqual(before.world.locations.map((l) => l.id))
    expect(after.world.blight).toEqual(before.world.blight)
  })
})
