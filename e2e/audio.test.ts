import { describe, expect, it } from 'vitest'
import { useGames, type Game } from './driver.ts'

function audioLog(game: Game) {
  return game.page.evaluate(() => window.__yomi!.audioLog())
}

describe('sound', () => {
  const games = useGames()

  it('loads the banks and themes at boot, and a menu click plays ui.click', async () => {
    const game = await games.open()
    expect(await audioLog(game)).toEqual([])
    const menu = await game.settled('Menu')
    await game.click(menu.buttons.options)
    await game.waitFor('Menu', (m) => m.showingOptions)
    const log = await audioLog(game)
    expect(log.map((entry) => entry.cue)).toEqual(['ui.click'])
    expect(log[0]).toMatchObject({ bus: 'ui', marker: expect.stringMatching(/^ui\.click#\d$/) })
  })

  it('shows four sliders, and the voice level is kept', async () => {
    const game = await games.open()
    const menu = await game.settled('Menu')
    await game.click(menu.buttons.options)
    const options = await game.waitFor('Menu', (m) => m.showingOptions)
    expect(options.sliders.map((s) => s.label)).toEqual(['Master', 'Sound FX', 'Music', 'Voice'])
    expect(options.sliders.every((s) => s.visible)).toBe(true)
    // Every row and Back fit the window.
    expect(options.buttons.back.y).toBeLessThan((await game.canvasSize()).height)
    const voice = options.sliders[3]
    expect(voice.level).toBe(1)
    await game.click({ x: voice.left + (voice.right - voice.left) * 0.3, y: voice.y })
    const set = await game.waitFor('Menu', (m) => m.sliders[3].level !== 1)
    expect(set.sliders[3].level).toBeCloseTo(0.3, 1)
    // Letting go of Voice plays nothing (the one click is Options').
    expect((await audioLog(game)).map((entry) => entry.cue)).toEqual(['ui.click'])

    await game.reload()
    const again = await game.settled('Menu')
    await game.click(again.buttons.options)
    const reloaded = await game.waitFor('Menu', (m) => m.showingOptions)
    expect(reloaded.sliders[3].level).toBeCloseTo(0.3, 1)
  })

  it('fits the four sliders, the tutorial switch and Back over a game in the least window', async () => {
    const game = await games.open()
    await game.newGame()
    await game.press('Escape')
    await game.waitForScenes(['Menu'], ['World'])
    const menu = await game.settled('Menu')
    await game.click(menu.buttons.options)
    await game.resize(840, 560)
    const options = await game.waitFor('Menu', (m) => m.showingOptions && m.buttons.tutorial.visible)
    // Back is 52 high, centred on its y; the tutorial switch sits above it, under the last slider.
    expect(options.buttons.back.y + 26).toBeLessThanOrEqual(560)
    expect(options.buttons.tutorial.y - 26).toBeGreaterThan(options.sliders[3].y)
    expect(options.buttons.tutorial.y + 26).toBeLessThan(options.buttons.back.y - 26)
  })

  it('sounds a battle’s blows and its victory', async () => {
    const game = await games.open()
    await game.enterBattle()
    const battle = await game.fightBattle()
    expect(battle.state.phase).toBe('over')
    const cues = (await audioLog(game)).map((entry) => entry.cue)
    expect(cues).toContain('battle.swing.blade')
    expect(cues.some((cue) => ['battle.hit.slash', 'battle.hit.crit', 'battle.miss.swing'].includes(cue))).toBe(true)
    await game.page.waitForFunction(() => window.__yomi!.audioLog().some((entry) => entry.cue === 'stings.victory'))
  })

  it('AC7: limits a cue’s voices and puts a limiter on the output', async () => {
    const game = await games.open()
    const menu = await game.settled('Menu')
    // Web Audio plays only after a gesture.
    await game.click(menu.buttons.options)
    await game.waitFor('Menu', (m) => m.showingOptions)
    await game.page.evaluate(() => {
      for (let i = 0; i < 20; i++) window.__yomi!.playCue('battle.hit.slash')
    })
    const slashes = (await audioLog(game)).filter((entry) => entry.cue === 'battle.hit.slash')
    expect(slashes).toHaveLength(3)
    expect(await game.page.evaluate(() => window.__yomi!.limiter())).toMatchObject({
      threshold: -6,
      knee: 3,
      ratio: 20,
      attack: expect.closeTo(0.003, 4),
      release: expect.closeTo(0.15, 3),
    })
    // Three impacts at once, each peaking near −1 dBFS, are over the −6 dBFS threshold.
    await game.page.waitForFunction(() => (window.__yomi!.limiter()?.reduction ?? 0) < 0, undefined, { timeout: 5000 })
  })
})
