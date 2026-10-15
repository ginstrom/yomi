import { describe, it } from 'vitest'
import type { CreationStep } from '../src/testHook.ts'
import { WORLD_SIZE } from '../src/game/worldMap.ts'
import { hexDistance, offsetToHex, type Hex } from '../src/grid/hex.ts'
import { RAIDERS, battleHexOnScreen, worldHexOnScreen, useGames, type Game } from './driver.ts'

/**
 * Not a test: plays the game to the screens the manual shows and saves a
 * screenshot of each in docs/manual/images/. Run with `npm run manual:screenshots`
 * after a change to how a screen looks, and check the manual still reads true.
 */

const DIR = 'docs/manual/images'

async function shot(game: Game, name: string): Promise<void> {
  await game.frames(4)
  await game.page.screenshot({ path: `${DIR}/${name}.png` })
}

describe('the manual’s screenshots', () => {
  const games = useGames()

  it('menu, party screen and character creation', async () => {
    const game = await games.open()
    await game.waitFor('Menu')
    await shot(game, 'menu')

    const choice = await game.openPartyScreen()
    await game.hover(choice.readyMade[2])
    await game.waitFor('Party', (p) => p.info.length > 0)
    await shot(game, 'party-choice')

    await game.click(choice.buttons.readyMade)
    const roster = await game.settled('Party', (p) => p.view === 'roster')
    await game.hover({ x: 0, y: 0 })
    await shot(game, 'party-roster')

    await game.click(roster.rows[0].remove)
    const gap = await game.settled('Party', (p) => p.view === 'roster' && p.rows[0].name !== 'Aldric')
    const empty = gap.rows.find((row) => row.preroll.visible)!
    await game.click(empty.preroll)
    await game.settled('Party', (p) => p.view === 'prerolls')
    await shot(game, 'party-prerolls')
    await game.press('Escape')

    // Creation, through editing the mage, whose every step is filled.
    const back = await game.settled('Party', (p) => p.view === 'roster')
    const mage = back.rows.find((row) => row.name === 'Delwyn')!
    await game.click(mage.edit)
    await game.waitForScenes(['Creation'])
    let creation = await game.settled('Creation')
    for (const step of ['attributes', 'skills', 'perks', 'name'] as CreationStep[]) {
      await game.click(creation.steps[step])
      creation = await game.settled('Creation', (c) => c.step === step)
      await shot(game, `creation-${step}`)
      if (step === 'perks') {
        await game.click(creation.treeSwitch.spells)
        creation = await game.settled('Creation', (c) => c.tree === 'spells')
        await shot(game, 'creation-spells')
      }
    }
  })

  it('the world map, the character panel and a battle', async () => {
    const game = await games.open()
    const world = await game.newGame()
    await game.hover(worldHexOnScreen(world, RAIDERS.position))
    await shot(game, 'world-start')

    await game.press('c')
    await game.waitForScenes(['Inventory'], ['World'])
    await game.settled('Inventory')
    await shot(game, 'panel-character')
    for (const [key, tab, name] of [
      ['s', 'skills', 'panel-skills'],
      ['p', 'perkTree', 'panel-perk-tree'],
      ['i', 'inventory', 'panel-inventory'],
    ] as const) {
      await game.press(key)
      await game.settled('Inventory', (p) => p.tab === tab)
      await shot(game, name)
    }
    const panel = (await game.probe('Inventory'))!
    await game.click(panel.party[2])
    await game.settled('Inventory', (p) => p.party[2].active)
    await game.press('b')
    await game.settled('Inventory', (p) => p.tab === 'spells')
    await shot(game, 'panel-spells-mage')
    await game.press('Escape')
    await game.waitForScenes(['World'])

    const near = await game.travelTo(RAIDERS.position)
    await game.hover({ x: 0, y: 0 })
    await shot(game, 'world-confront')

    await game.click(near.buttons.attack)
    await game.waitForScenes(['Battle'])
    const battle = await game.waitFor('Battle', (b) => b.playerControl)
    await game.hover({ x: 0, y: 0 })
    await shot(game, 'battle-start')

    const hero = battle.state.units.find((u) => u.id === 'hero_1')!
    const foes = battle.state.units.filter((u) => u.side === 'enemy')
    const nearest = foes.reduce((a, b) => (hexDistance(hero.position, b.position) < hexDistance(hero.position, a.position) ? b : a))
    await game.hover(battleHexOnScreen(battle, offsetToHex(3, 2)))
    await shot(game, 'battle-move')
    await game.hover(battleHexOnScreen(battle, nearest.position))
    await shot(game, 'battle-attack')

    // The mage steps two hexes forward, to bring a foe within Magic Arrow's reach.
    await game.click(battle.party[2])
    await game.waitFor('Battle', (b) => b.selected === 'hero_3')
    const mage = battle.state.units.find((u) => u.id === 'hero_3')!
    await game.click(battleHexOnScreen(battle, { q: mage.position.q + 2, r: mage.position.r }))
    const stepped = await game.waitFor('Battle', (b) => b.playerControl && b.state.units.find((u) => u.id === 'hero_3')!.ap === 6)
    await game.press('m')
    const menu = await game.waitFor('Battle', (b) => b.spellMenu !== null)
    await shot(game, 'battle-spell-menu')
    await game.click(menu.spellMenu!.find((row) => row.spell === 'magic_arrow')!)
    await game.waitFor('Battle', (b) => b.casting === 'magic_arrow')
    const target = stepped.state.units.filter((u) => u.side === 'enemy').find((u) => hexDistance(stepped.state.units.find((m) => m.id === 'hero_3')!.position, u.position) <= 5)!
    await game.hover(battleHexOnScreen(battle, target.position))
    await shot(game, 'battle-targeting')
    await game.press('Escape')
    await game.waitFor('Battle', (b) => b.casting === null)

    const over = await game.fightBattle()
    await game.waitFor('Battle', (b) => b.buttons.result.visible)
    await shot(game, 'battle-victory')
    await game.click(over.buttons.result)
    await game.waitForScenes(['World'])
    await game.settled('World')
    await game.hover({ x: 0, y: 0 })
    await shot(game, 'world-after-victory')
    await game.press('c')
    await game.waitForScenes(['Inventory'], ['World'])
    const grown = await game.settled('Inventory')
    if (grown.tab !== 'skills') await game.press('s')
    await game.settled('Inventory', (p) => p.tab === 'skills')
    await shot(game, 'panel-level-up')
  })

  it('the guild hall and the blight', async () => {
    const game = await games.open()
    await game.newGame()
    await game.page.evaluate(() => {
      const saved = JSON.parse(localStorage.getItem('yomi.save.1')!)
      saved.game.world.stock = { gold: 100, iron: 50 }
      localStorage.setItem('yomi.save.1', JSON.stringify(saved))
    })
    const menu = await game.reload()
    await game.click(menu.buttons.continue)
    await game.waitForScenes(['World'])
    const home = await game.settled('World')
    await game.click(home.buttons.guildHall)
    await game.waitForScenes(['GuildHall'], ['World'])
    const hall = await game.settled('GuildHall')
    await shot(game, 'guild-hall')
    await game.click(hall.buttons.upgrade)
    const raised = await game.settled('GuildHall', (h) => h.level === 2)
    await game.click(raised.buttons.recruit)
    await game.settled('GuildHall', (h) => h.view === 'recruit')
    await shot(game, 'guild-hall-recruit')
    await game.press('Escape')
    await game.press('Escape')
    await game.waitForScenes(['World'])

    // Days pass in camp while the blight spreads from the nests.
    for (let day = 0; day < 60; day++) {
      const world = await game.settled('World', (w) => !w.walking && w.outcome === '')
      if (!world.buttons.camp.visible) break
      await game.click(world.buttons.camp)
      await game.waitFor('World', (w) => w.world.turn > world.world.turn)
    }

    // Then a walk to the edge of the nearest corrupted land, to see it.
    const camped = await game.settled('World')
    const { party, blight } = camped.world
    const hexAt = (i: number) => offsetToHex(i % WORLD_SIZE.cols, Math.floor(i / WORLD_SIZE.cols))
    const byDistance = (from: Hex) => (a: number, b: number) => hexDistance(from, hexAt(a)) - hexDistance(from, hexAt(b))
    const corrupted = blight.map((_, i) => i).filter((i) => blight[i] === 3).sort(byDistance(party))[0]
    const clean = blight
      .map((_, i) => i)
      .filter((i) => blight[i] === 0 && hexDistance(hexAt(i), hexAt(corrupted)) === 4)
      .sort(byDistance(party))[0]
    try {
      await game.travelTo(hexAt(clean))
    } catch {
      // Stopped short by monsters on the road: the view is as good from there.
    }
    await game.hover({ x: 0, y: 0 })
    await shot(game, 'world-blight')
  })
})
