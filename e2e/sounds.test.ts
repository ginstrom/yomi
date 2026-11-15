import { describe, expect, it } from 'vitest'
import { useGames, type Game } from './driver.ts'

const entries = (game: Game) => game.page.evaluate(() => window.__yomi!.audioLog())
const cues = async (game: Game) => (await entries(game)).map((entry) => entry.cue)

/** The cues `act` played: those logged after the last one before it, as the log keeps only its latest 50. */
async function played(game: Game, act: () => Promise<unknown>): Promise<string[]> {
  const last = (await entries(game)).at(-1)
  await act()
  const after = await entries(game)
  const from = last ? after.findLastIndex((e) => e.cue === last.cue && e.marker === last.marker && e.at === last.at) + 1 : 0
  return after.slice(from).map((entry) => entry.cue)
}

/** A new game with `plant` (dotted paths into the saved game) set, reloaded and continued on the map. */
async function plantedGame(game: Game, plant: Record<string, unknown>) {
  await game.newGame()
  await game.page.evaluate((plant) => {
    const saved = JSON.parse(localStorage.getItem('yomi.save.1')!)
    for (const [path, value] of Object.entries(plant)) {
      const keys = path.split('.')
      const last = keys.pop()!
      keys.reduce((node, key) => node[key], saved.game)[last] = value
    }
    localStorage.setItem('yomi.save.1', JSON.stringify(saved))
  }, plant)
  const menu = await game.reload()
  await game.click(menu.buttons.continue)
  await game.waitForScenes(['World'])
  return game.settled('World')
}

describe('world and interface sounds', () => {
  const games = useGames()

  it('sounds the monsters a walk comes upon', async () => {
    const game = await games.open()
    await game.enterBattle()
    expect(await cues(game)).toContain('world.confront')
  })

  it('sounds a buy as coins, and a refused one as an error and no coins', async () => {
    const game = await games.open()
    await plantedGame(game, { 'world.stock': { gold: 15, iron: 5 } })
    const home = await game.settled('World')
    await game.click(home.buttons.enterEncampment)
    await game.waitForScenes(['Encampment'], ['World'])
    const camp = await game.settled('Encampment')
    await game.click(camp.facilities.find((f) => f.id === 'trading_post')!)
    const shown = await game.settled('Encampment', (c) => c.selected === 'trading_post')
    await game.click(shown.buttons.open)
    await game.waitForScenes(['TradingPost'], ['World'])
    const post = await game.settled('TradingPost')
    await game.click(post.slotButtons.find((b) => b.slot === 'mainHand')!)
    await game.settled('TradingPost', (p) => p.filter.slot === 'mainHand')
    await game.click(post.rows.find((row) => row.id === 'iron_sword')!)
    const picked = await game.settled('TradingPost', (p) => p.selected === 'iron_sword')

    expect(await played(game, () => game.click(picked.buttons.confirm))).toEqual(['world.coins'])
    const bought = await game.settled('TradingPost', (p) => p.gold === 3)
    expect(bought.buttons.confirm.enabled).toBe(false)
    expect(await played(game, () => game.click(bought.buttons.confirm))).toEqual(['ui.error'])
    expect((await game.settled('TradingPost', (p) => p.message !== bought.message)).gold).toBe(3)

    expect(await played(game, () => game.click(bought.buttons.close))).toEqual(['ui.back'])
  })

  it('sounds a tab, a gear change, a node learnt and the panel closing', async () => {
    const game = await games.open()
    const world = await plantedGame(game, { 'parties.0.members.0.perkPoints': 1 })
    await game.click(world.party[0])
    await game.waitForScenes(['Inventory'], ['World'])
    const skills = await game.settled('Inventory', (p) => p.tab === 'skills')
    expect(skills.perkPoints).toBe(1)

    expect(await played(game, () => game.click(skills.treesButton))).toEqual(['ui.click'])
    const tree = await game.settled('Inventory', (p) => p.tab === 'trees')
    const other = tree.tree === 'scout' ? 'mage' : 'scout'
    expect(await played(game, () => game.click(tree.trees[other]))).toEqual(['ui.tab'])
    const turned = await game.settled('Inventory', (p) => p.tab === 'trees' && p.tree === other)
    const node = turned.perks.find((n) => n.canTake)!
    expect(await played(game, () => game.click(node))).toEqual(['ui.learn'])
    await game.waitFor('Inventory', (p) => p.perkPoints === 0)

    expect(await played(game, () => game.press('i'))).toEqual(['ui.tab'])
    const panel = await game.settled('Inventory', (p) => p.tab === 'inventory')
    expect(await played(game, () => game.drag(panel.equipment.mainHand, panel.grids.backpack))).toEqual(['ui.gear'])

    expect(await played(game, () => game.press('Escape'))).toEqual(['ui.back'])
    await game.waitForScenes(['World'])
  })
})
