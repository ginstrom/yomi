import { describe, expect, it } from 'vitest'
import { RAIDERS, useGames, type Game } from './driver.ts'

describe('cutscenes and the tutorial', () => {
  const games = useGames()

  /** From the main menu: the ready-made party, begun with the tutorial ticked, up to the intro over the paused map. */
  async function beginWithTutorial(game: Awaited<ReturnType<typeof games.open>>) {
    const choice = await game.openPartyScreen()
    await game.click(choice.buttons.readyMade)
    const roster = await game.settled('Party', (p) => p.view === 'roster')
    expect(roster.tutorial).toBe(true)
    await game.begin(roster, { tutorial: true })
    await game.waitForScenes(['Story'], ['World'])
    return game.settled('Story')
  }

  it('plays the intro over the paused map as a new game begins, a beat a click, then the tutorial\'s first tips', async () => {
    const game = await games.open()
    const intro = await beginWithTutorial(game)
    expect(intro).toMatchObject({ kind: 'cutscene', id: 'intro', beat: 0 })
    expect(intro.beats).toBeGreaterThan(1)

    await game.click(intro.buttons.next)
    const second = await game.settled('Story', (s) => s.beat === 1)
    // The leader speaks it, by name.
    expect(second.speaker).toBe('Aldric')
    for (let beat = 1; beat < intro.beats; beat++) {
      await game.click((await game.settled('Story', (s) => s.beat === beat)).buttons.next)
    }

    const tip = await game.settled('Story', (s) => s.kind === 'tip')
    expect(tip.id).toBe('world_travel')
    await game.press('Enter')
    const pointing = await game.settled('Story', (s) => s.id === 'world_party')
    expect(pointing.anchor).not.toBeNull()
    await game.click(pointing.buttons.next)
    await game.waitForScenes(['World'])

    // Shown once, and saved so: the map opening again from the slot brings nothing back.
    const menu = await game.reload()
    await game.click(menu.buttons.continue)
    await game.waitForScenes(['World'])
    await game.frames(4)
    expect(await game.scenes()).toEqual({ running: ['World'], paused: [] })
  })

  it('turns the tutorial off from a tip, and back on from the menu\'s options', async () => {
    const game = await games.open()
    await beginWithTutorial(game)
    await game.press('Escape')
    const tip = await game.settled('Story', (s) => s.kind === 'tip')
    await game.click(tip.buttons.tutorialOff)
    // The tip after it is dropped with it.
    await game.waitForScenes(['World'])

    await game.press('Escape')
    await game.waitForScenes(['Menu'], ['World'])
    await game.click((await game.settled('Menu')).buttons.options)
    const options = await game.settled('Menu', (m) => m.showingOptions)
    expect(options.tutorial).toBe(false)
    expect(options.buttons.tutorial.visible).toBe(true)
    await game.click(options.buttons.tutorial)
    await game.waitFor('Menu', (m) => m.tutorial === true)
    await game.press('Escape')
    await game.press('Escape')
    await game.waitForScenes(['World'])

    // On again, the tutorial goes on from where it was: the next tip waits for monsters.
    await game.travelTo(RAIDERS.position)
    const monsters = await game.settled('Story', (s) => s.kind === 'tip')
    expect(monsters.id).toBe('world_monsters')
    await game.skipStory()
    await game.waitForScenes(['World'])
  })

  it('tells the tutorial over a battle as the player\'s first turn begins, and the battle goes on after', async () => {
    const game = await games.open()
    await beginWithTutorial(game)
    await game.skipStory()
    const near = await game.travelTo(RAIDERS.position)
    await game.skipStory()
    await game.click(near.buttons.attack)
    await game.waitForScenes(['Story'], ['Battle'])
    expect(await game.settled('Story')).toMatchObject({ kind: 'tip', id: 'battle_start' })
    await game.skipStory()
    await game.waitForScenes(['Battle'])
    expect((await game.waitFor('Battle')).playerControl).toBe(true)
  })

  it('offers no tutorial switch in the options without a game under the menu', async () => {
    const game = await games.open()
    await game.click((await game.settled('Menu')).buttons.options)
    const options = await game.settled('Menu', (m) => m.showingOptions)
    expect(options.tutorial).toBeNull()
    expect(options.buttons.tutorial.visible).toBe(false)
  })

  describe('the voice', () => {
    const musicVolume = (game: Game) => game.page.evaluate(() => window.__yomi!.musicVolume())

    /** The music's volume once it has stopped moving (a duck's ramp done). */
    async function settledMusic(game: Game): Promise<number> {
      let last = -1
      for (let tries = 0; tries < 200; tries++) {
        const now = await musicVolume(game)
        if (now !== null && Math.abs(now - last) < 1e-4) return now
        last = now ?? -1
        await game.frames(3)
      }
      throw new Error('the music never settled')
    }

    const db = (ratio: number) => 20 * Math.log10(ratio)

    it('speaks the intro\'s first beat, which Next cuts, and leaves the leader\'s beat silent', async () => {
      const game = await games.open()
      const intro = await beginWithTutorial(game)
      expect(intro.voice.line).toBe('intro.opening')
      await game.waitFor('Story', (s) => s.voice.playing)
      await game.click(intro.buttons.next)
      const second = await game.waitFor('Story', (s) => s.beat === 1)
      expect(second.voice.line).toBeNull()
      expect(second.voice.playing).toBe(false)
      await game.frames(20)
      expect((await game.waitFor('Story')).voice.playing).toBe(false)
      const log = await game.page.evaluate(() => window.__yomi!.audioLog())
      expect(log.filter((entry) => entry.bus === 'voice').map((entry) => entry.cue)).toEqual(['voice_intro.opening'])
    })

    it('stops the line on Esc and skips as before', async () => {
      const game = await games.open()
      await beginWithTutorial(game)
      await game.waitFor('Story', (s) => s.voice.playing)
      await game.press('Escape')
      const tip = await game.settled('Story', (s) => s.kind === 'tip')
      expect(tip.voice).toEqual({ line: null, playing: false })
    })

    it('shows and advances a cutscene whose voice files fail to load, silently', async () => {
      const game = await games.open()
      await game.page.route('**/assets/voice/**', (route) => route.fulfill({ status: 404 }))
      const intro = await beginWithTutorial(game)
      expect(intro.voice.line).toBe('intro.opening')
      await game.frames(30)
      expect((await game.waitFor('Story')).voice.playing).toBe(false)
      await game.click(intro.buttons.next)
      expect(await game.settled('Story', (s) => s.beat === 1)).toMatchObject({ speaker: 'Aldric' })
      // The failed loads are the point of the test, not a problem with the game.
      game.problems.splice(0, game.problems.length, ...game.problems.filter((p) => !p.includes('/assets/voice/') && !p.includes('status of 404')))
    })

    it('AC10: ducks the music 10 dB under a line and brings it back when the line is cut', async () => {
      const game = await games.open()
      const intro = await beginWithTutorial(game)
      await game.waitFor('Story', (s) => s.voice.playing)
      const ducked = await settledMusic(game)
      await game.click(intro.buttons.next)
      await game.waitFor('Story', (s) => s.beat === 1)
      const restored = await settledMusic(game)
      expect(Math.abs(db(ducked / restored) - -10)).toBeLessThan(1)
    })

    it('AC10: with the Voice slider at 0 the line does not play and the music is not ducked', async () => {
      const game = await games.open()
      await game.page.evaluate(() => localStorage.setItem('yomi.audio', JSON.stringify({ voice: 0 })))
      await game.reload()
      const intro = await beginWithTutorial(game)
      expect(intro.voice.line).toBe('intro.opening')
      const before = await settledMusic(game)
      await game.frames(30)
      expect((await game.waitFor('Story')).voice.playing).toBe(false)
      expect(await settledMusic(game)).toBeCloseTo(before, 4)
      expect((await game.page.evaluate(() => window.__yomi!.audioLog())).filter((entry) => entry.bus === 'voice')).toEqual([])
    })
  })
})
