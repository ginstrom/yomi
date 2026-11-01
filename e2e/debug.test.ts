import { describe, expect, it } from 'vitest'
import { koboldScouts } from '../src/game/encounters.ts'
import { partyFighters, readyMadeParty } from '../src/game/party.ts'
import { battleHexOnScreen, useGames, type Game } from './driver.ts'

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
    // Never saved mid-battle: the slot still holds the world map's save, with no battle in it.
    const saved = await game.page.evaluate(() => localStorage.getItem('yomi.save.1'))
    expect(saved).not.toBeNull()
    expect(JSON.parse(saved!).battle).toBeNull()

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

  it('shows a foe with abilities its ability list on hover, and nothing over a hero, through the foe\'s turn', async () => {
    const game = await games.open()
    await game.newGame()
    await game.press('Shift+Backquote')
    await command(game, 'fight troll_lair 4')
    await game.waitForScenes(['Battle'])
    await game.press('Escape')
    const battle = await game.waitFor('Battle', (b) => b.playerControl)
    const troll = battle.state.units.find((u) => u.side === 'enemy' && u.abilities?.includes('troll_claws'))!
    const hero = battle.state.units.find((u) => u.side === 'player')!

    await game.hover(battleHexOnScreen(battle, troll.position))
    await game.waitFor('Battle', (b) => b.foeInfo.length === 1)
    expect((await game.waitFor('Battle')).foeInfo).toEqual(['Claws: ready'])
    await game.hover(battleHexOnScreen(battle, hero.position))
    await game.waitFor('Battle', (b) => b.foeInfo.length === 0)

    // The foe's turn plays whatever the troll does (a move, or a routine of two claws) without a console error.
    await game.click(battle.buttons.endTurn)
    await game.waitFor('Battle', (b) => b.playerControl && b.state.round >= 2)
  })
})
