import { chromium, type Browser, type BrowserContext, type Page } from 'playwright'
import { afterAll, afterEach, beforeAll, expect, inject } from 'vitest'
import { hexDistance, offsetToHex, type Hex } from '../src/grid/hex.ts'
import { BATTLE_LAYOUT, WORLD_LAYOUT, boardHexOnScreen, type Point } from '../src/scenes/boardGeometry.ts'
import type { BattleProbe, MenuProbe, PartyProbe, Probes, WorldProbe } from '../src/testHook.ts'

export const VIEWPORT = { width: 1280, height: 800 }
/** A seed with which `winBattle` beats the Goblin Raiders. */
export const WINNING_SEED = 1
/** How much faster than life the game runs under test. */
const SPEED = 10
const WAIT_MS = 20_000

/** The Goblin Raiders, four hexes from where a new game's party starts. */
export const RAIDERS = { id: 'goblin_raiders', position: offsetToHex(13, 18) }

/**
 * Launches a browser for a test file and hands out games in it. After each
 * test, every game opened must have run without a console error, an uncaught
 * exception or a failed request, which is how a missing asset shows up.
 */
export function useGames(): { open(options?: { seed?: number }): Promise<Game> } {
  let browser: Browser
  let opened: Game[] = []
  beforeAll(async () => {
    browser = await chromium.launch()
  })
  afterAll(() => browser.close())
  afterEach(async () => {
    const games = opened
    opened = []
    const problems = games.flatMap((game) => game.problems)
    await Promise.all(games.map((game) => game.close()))
    expect(problems).toEqual([])
  })
  return {
    async open({ seed = WINNING_SEED } = {}) {
      const game = await Game.open(browser, seed)
      opened.push(game)
      return game
    },
  }
}

/** One page running the game, driven as a player would: by clicks and keys at places the scenes' probes give. */
export class Game {
  readonly problems: string[] = []
  private readonly context: BrowserContext
  readonly page: Page

  private constructor(context: BrowserContext, page: Page) {
    this.context = context
    this.page = page
    page.on('console', (message) => {
      if (message.type() === 'error') this.problems.push(`console error: ${message.text()}`)
    })
    page.on('pageerror', (error) => this.problems.push(`uncaught: ${error.message}`))
    page.on('requestfailed', (request) => this.problems.push(`request failed: ${request.url()}`))
    page.on('response', (response) => {
      if (response.status() >= 400) this.problems.push(`${response.status()}: ${response.url()}`)
    })
  }

  /** Loads the game and waits for the main menu. */
  static async open(browser: Browser, seed: number): Promise<Game> {
    const context = await browser.newContext({ viewport: VIEWPORT })
    const game = new Game(context, await context.newPage())
    await game.page.goto(`${inject('baseUrl')}?seed=${seed}`)
    await game.page.waitForFunction(() => window.__yomi?.running().includes('Menu'))
    await game.page.evaluate((speed) => {
      window.__yomi!.speed = speed
    }, SPEED)
    return game
  }

  close(): Promise<void> {
    return this.context.close()
  }

  // ---- seeing ---------------------------------------------------------------

  probe<K extends keyof Probes>(key: K): Promise<Probes[K] | null> {
    return this.page.evaluate((k) => window.__yomi!.probe(k), key) as Promise<Probes[K] | null>
  }

  /** The scene's probe, once the scene is up and `ready` holds of it. */
  async waitFor<K extends keyof Probes>(key: K, ready: (probe: Probes[K]) => boolean = () => true): Promise<Probes[K]> {
    const deadline = Date.now() + WAIT_MS
    for (;;) {
      const probe = await this.probe(key)
      if (probe && ready(probe)) return probe
      if (Date.now() > deadline) {
        throw new Error(`Timed out waiting for ${key}: ${ready}\nlast saw ${JSON.stringify(probe)?.slice(0, 2000)}`)
      }
      await this.frames(1)
    }
  }

  /**
   * The probe of a scene that has just started, once its buttons take clicks: a scene's
   * game objects become interactive on the frame after they are made, so a click sent the
   * moment the scene is up would miss them.
   */
  async settled<K extends keyof Probes>(key: K, ready: (probe: Probes[K]) => boolean = () => true): Promise<Probes[K]> {
    await this.waitFor(key, ready)
    await this.frames()
    return this.waitFor(key, ready)
  }

  scenes(): Promise<{ running: string[]; paused: string[] }> {
    return this.page.evaluate(() => ({ running: window.__yomi!.running(), paused: window.__yomi!.paused() }))
  }

  /** Waits until exactly these scenes are running, and these paused under them. */
  async waitForScenes(running: string[], paused: string[] = []): Promise<void> {
    await expect.poll(() => this.scenes(), { timeout: WAIT_MS }).toEqual({ running, paused })
  }

  canvasSize(): Promise<{ width: number; height: number }> {
    return this.page.evaluate(() => {
      const { width, height } = document.querySelector('canvas')!.getBoundingClientRect()
      return { width, height }
    })
  }

  // ---- doing ----------------------------------------------------------------

  /** Lets the game step, so that input just sent has taken effect. */
  async frames(count = 2): Promise<void> {
    const from = await this.page.evaluate(() => window.__yomi!.frame())
    await this.page.waitForFunction((frame) => window.__yomi!.frame() >= frame, from + count)
  }

  async click(at: Point): Promise<void> {
    await this.page.mouse.click(at.x, at.y)
    await this.frames()
  }

  /** Moves the pointer there without pressing, as a hover does. */
  async hover(at: Point): Promise<void> {
    await this.page.mouse.move(at.x, at.y)
    await this.frames()
  }

  /** Presses the mouse button there and keeps it down; `letGo` ends it. */
  async holdDown(at: Point): Promise<void> {
    await this.page.mouse.move(at.x, at.y)
    await this.page.mouse.down()
    await this.frames()
  }

  async letGo(): Promise<void> {
    await this.page.mouse.up()
    await this.frames()
  }

  async press(key: string): Promise<void> {
    await this.page.keyboard.press(key)
    await this.frames()
  }

  async resize(width: number, height: number): Promise<void> {
    await this.page.setViewportSize({ width, height })
    await this.frames()
  }

  // ---- journeys ---------------------------------------------------------------

  /** From the main menu: New, which opens the party screen on its choice. */
  async openPartyScreen(): Promise<PartyProbe> {
    const menu = await this.waitFor('Menu')
    await this.click(menu.buttons.new)
    await this.waitForScenes(['Party'])
    return this.settled('Party', (p) => p.view === 'choice')
  }

  /** From the party screen's choice: takes the ready-made party and begins, which opens the world map. */
  async beginReadyMade(): Promise<WorldProbe> {
    const choice = await this.settled('Party', (p) => p.view === 'choice')
    await this.click(choice.buttons.readyMade)
    await this.begin(await this.waitFor('Party', (p) => p.view === 'roster'))
    return this.enterWorld()
  }

  /**
   * From the roster: ticks or unticks the tutorial as asked (off unless told,
   * so that its tips do not get in the way) and clicks Begin, which opens the
   * world map, or the prompt for a slot to overwrite.
   */
  async begin(roster: PartyProbe, { tutorial = false } = {}): Promise<void> {
    if (roster.tutorial !== tutorial) {
      await this.click(roster.buttons.tutorial)
      roster = await this.settled('Party', (p) => p.view === 'roster' && p.tutorial === tutorial)
    }
    await this.click(roster.buttons.begin)
  }

  /** Once a new game has begun: skips the story told over the map as it opens (the intro), and waits for the map. */
  async enterWorld(): Promise<WorldProbe> {
    await expect
      .poll(async () => (await this.scenes()).running.some((key) => key === 'Story' || key === 'World'), { timeout: WAIT_MS })
      .toBe(true)
    await this.skipStory()
    await this.waitForScenes(['World'])
    return this.waitFor('World')
  }

  /** Skips whatever the story is showing, item by item, until the scene under it resumes. */
  async skipStory(): Promise<void> {
    while ((await this.scenes()).running.includes('Story')) {
      await this.settled('Story')
      await this.press('Escape')
    }
  }

  /** From the main menu: a new game with the ready-made party, which opens on the world map. */
  async newGame(): Promise<WorldProbe> {
    await this.openPartyScreen()
    return this.beginReadyMade()
  }

  /** Loads the page again, as a closed and reopened tab would, and waits for the main menu. The context keeps its storage. */
  async reload(): Promise<MenuProbe> {
    await this.page.reload()
    await this.page.waitForFunction(() => window.__yomi?.running().includes('Menu'))
    await this.page.evaluate((speed) => {
      window.__yomi!.speed = speed
    }, SPEED)
    return this.waitFor('Menu')
  }

  /**
   * Clicks a hex of the world map and waits for the party to arrive there,
   * clicking again, as a player would, whenever something sighted on the way
   * stops it short.
   */
  async travelTo(to: Hex): Promise<WorldProbe> {
    const arrived = (w: WorldProbe) => w.world.party.q === to.q && w.world.party.r === to.r
    let world = await this.waitFor('World', (w) => !w.walking)
    for (let tries = 0; tries < 5 && !arrived(world); tries++) {
      const turn = world.world.turn
      await this.click(worldHexOnScreen(world, to))
      world = await this.waitFor('World', (w) => !w.walking && (arrived(w) || w.world.turn !== turn))
    }
    if (!arrived(world)) throw new Error(`the party did not reach ${to.q},${to.r}: ${world.message}`)
    return world
  }

  /** From the main menu: a new game, a walk to the Goblin Raiders and an attack, up to the player's first turn. */
  async enterBattle(): Promise<BattleProbe> {
    await this.newGame()
    const world = await this.travelTo(RAIDERS.position)
    await this.click(world.buttons.attack)
    await this.waitForScenes(['Battle'])
    return this.waitFor('Battle', (b) => b.playerControl)
  }

  /** The battle once it is the player's to act in again, or over with its result screen up. */
  awaitTurn(): Promise<BattleProbe> {
    return this.waitFor('Battle', (b) => b.playerControl || b.buttons.result.visible)
  }

  /**
   * Fights the battle out as a simple player would: each hero in turn goes for
   * the nearest foe for as long as that does anything, then the turn ends.
   */
  async fightBattle(): Promise<BattleProbe> {
    let spent = new Set<string>()
    for (;;) {
      const battle = await this.awaitTurn()
      if (battle.state.phase === 'over') return battle
      const living = battle.state.units.filter((u) => u.hp > 0)
      const hero = living.find((u) => u.side === 'player' && u.ap > 0 && !spent.has(u.id))
      if (!hero) {
        await this.click(battle.buttons.endTurn)
        spent = new Set()
        continue
      }
      if (battle.selected !== hero.id) {
        await this.click(battleHexOnScreen(battle, hero.position))
        // A hero with nothing left to do cannot be selected.
        if ((await this.probe('Battle'))!.selected !== hero.id) spent.add(hero.id)
        continue
      }
      const foes = living.filter((u) => u.side === 'enemy')
      const distance = (h: Hex) => hexDistance(hero.position, h)
      const nearest = foes.reduce((a, b) => (distance(b.position) < distance(a.position) ? b : a))
      await this.click(battleHexOnScreen(battle, nearest.position))
      const after = (await this.probe('Battle'))!
      const apNow = after.state.units.find((u) => u.id === hero.id)!.ap
      if (after.playerControl && apNow === hero.ap) spent.add(hero.id)
    }
  }

  /** Ends turn after turn without a blow struck, until the party has fallen. */
  async loseBattle(): Promise<BattleProbe> {
    for (;;) {
      const battle = await this.awaitTurn()
      if (battle.state.phase === 'over') return battle
      await this.click(battle.buttons.endTurn)
    }
  }
}

export function worldHexOnScreen(world: WorldProbe, h: Hex): Point {
  return boardHexOnScreen(h, world.origin, 1, WORLD_LAYOUT)
}

export function battleHexOnScreen(battle: BattleProbe, h: Hex): Point {
  return boardHexOnScreen(h, battle.origin, battle.scale, BATTLE_LAYOUT)
}
