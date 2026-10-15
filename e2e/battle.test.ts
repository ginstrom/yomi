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

    const to = offsetToHex(5, 4)
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

  it('selects a hero by its portrait, and opens the hero’s panel on a second click', async () => {
    const game = await games.open()
    const start = await game.enterBattle()
    expect(start.party.map((member) => member.active)).toEqual([true, false, false])

    await game.click(start.party[1])
    const selected = await game.waitFor('Battle', (b) => b.selected === 'hero_2')
    expect(selected.party.map((member) => member.active)).toEqual([false, true, false])
    expect(await game.scenes()).toEqual({ running: ['Battle'], paused: [] })

    await game.click(selected.party[1])
    await game.waitForScenes(['Inventory'], ['Battle'])
    const panel = await game.waitFor('Inventory')
    expect(panel.tab).toBe('character')
    expect(panel.party.map((member) => member.active)).toEqual([false, true, false])
  })

  it('turns the open panel to another hero by its portrait, each paying for its own change of gear', async () => {
    const game = await games.open()
    await game.enterBattle()
    await game.press('i')
    await game.waitForScenes(['Inventory'], ['Battle'])
    const first = await game.waitFor('Inventory')
    await game.click(first.equipment.mainHand)
    await game.waitFor('Inventory', (p) => p.equipment.mainHand.item === null)

    await game.click(first.party[2])
    const third = await game.waitFor('Inventory', (p) => p.party[2].active)
    // Still on the inventory, and showing the third hero's own gear.
    expect(third.tab).toBe('inventory')
    expect(third.equipment.mainHand.item).not.toBeNull()
    await game.click(third.equipment.mainHand)
    await game.waitFor('Inventory', (p) => p.party[2].active && p.equipment.mainHand.item === null)

    await game.press('Escape')
    await game.waitForScenes(['Battle'])
    const battle = await game.awaitTurn()
    // The hero last shown is the one selected.
    expect(battle.selected).toBe('hero_3')
    const equips = battle.log.filter((e) => e.type === 'equip')
    expect(equips.map((e) => [e.unit, e.apCost])).toEqual([['hero_1', 1], ['hero_3', 1]])
  })

  it('casts a spell picked from the Cast button’s list, on a foe and then on the caster, and backs out on Esc (A10)', async () => {
    const game = await games.open()
    const start = await game.enterBattle()
    const mage = (battle: BattleProbe) => battle.state.units.find((u) => u.id === 'hero_3')!
    // Only a unit with magic has the button.
    expect(start.buttons.cast.visible).toBe(false)

    await game.click(start.party[2])
    const selected = await game.waitFor('Battle', (b) => b.selected === 'hero_3')
    expect(mage(selected)).toMatchObject({ mana: 18, ap: 8 })
    // Heal can always be cast on the caster itself; no foe is within Magic Arrow's range yet.
    expect(selected.buttons.cast).toMatchObject({ visible: true, enabled: true })
    await game.click(selected.buttons.cast)
    const list = await game.waitFor('Battle', (b) => b.spellMenu !== null)
    expect(list.spellMenu!.map(({ spell, enabled }) => [spell, enabled])).toEqual([
      ['magic_arrow', false],
      ['heal', true],
    ])
    await game.press('Escape')
    await game.waitFor('Battle', (b) => b.spellMenu === null)
    expect(await game.scenes()).toEqual({ running: ['Battle'], paused: [] })

    await game.click(battleHexOnScreen(selected, offsetToHex(5, 5)))
    const near = await game.waitFor('Battle', (b) => b.playerControl && mage(b).ap === 5)

    await game.press('m')
    const opened = await game.waitFor('Battle', (b) => b.spellMenu !== null)
    expect(opened.spellMenu![0]).toMatchObject({ spell: 'magic_arrow', enabled: true })
    await game.click(opened.spellMenu![0])
    expect((await game.waitFor('Battle', (b) => b.casting !== null)).casting).toBe('magic_arrow')
    await game.press('Escape')
    await game.waitFor('Battle', (b) => b.casting === null)
    expect(near.casting).toBeNull()

    await game.press('m')
    await game.waitFor('Battle', (b) => b.spellMenu !== null)
    await game.press('1')
    const picking = await game.waitFor('Battle', (b) => b.casting === 'magic_arrow')
    const foe = picking.state.units.find((u) => u.id === 'goblin')!
    await game.click(battleHexOnScreen(picking, foe.position))
    const after = await game.waitFor('Battle', (b) => b.log.some((e) => e.type === 'cast') && (b.playerControl || b.buttons.result.visible))
    expect(after.log.filter((e) => e.type === 'cast')).toMatchObject([
      { caster: 'hero_3', spell: 'magic_arrow', target: 'goblin', manaCost: 3, manaAfter: 15, apAfter: 1, outcomes: [{ unit: 'goblin' }] },
    ])
    expect(mage(after)).toMatchObject({ mana: 15, ap: 1 })
    expect(after.casting).toBeNull()

    // The panel shows what mana is left.
    await game.press('c')
    await game.waitForScenes(['Inventory'], ['Battle'])
    expect((await game.waitFor('Inventory', (p) => p.party[2].active)).mana).toBe(15)
    await game.press('Escape')
    await game.waitForScenes(['Battle'])

    // Next turn the mage heals itself: the spell list's second row, then a click on the caster.
    await game.click(after.buttons.endTurn)
    const next = await game.awaitTurn()
    if (next.buttons.result.visible || mage(next).hp <= 0) return
    // A click on the selected member's portrait would open its panel instead.
    if (next.selected !== 'hero_3') await game.click(next.party[2])
    await game.waitFor('Battle', (b) => b.selected === 'hero_3')
    await game.press('m')
    await game.waitFor('Battle', (b) => b.spellMenu !== null)
    await game.press('2')
    const healing = await game.waitFor('Battle', (b) => b.casting === 'heal')
    await game.click(battleHexOnScreen(healing, mage(healing).position))
    const healed = await game.waitFor('Battle', (b) => b.log.some((e) => e.type === 'cast' && e.spell === 'heal'))
    const heal = healed.log.find((e) => e.type === 'cast' && e.spell === 'heal')!
    expect(heal).toMatchObject({ caster: 'hero_3', manaCost: 3, manaAfter: 12, outcomes: [{ unit: 'hero_3', attackRoll: null }] })
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
    // New leads to the party screen, and the battle is gone from under the menu.
    await game.waitForScenes(['Party'])
    const world = await game.beginReadyMade()
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

    for (const [width, height] of [[1600, 900], [840, 560], [900, 1200]]) {
      await game.resize(width, height)
      expect(await game.canvasSize()).toEqual({ width, height })
      const panel = (await game.probe('Inventory'))!
      const battle = (await game.probe('Battle'))!
      const portraits = [...panel.party, ...battle.party]
      const buttons = [battle.buttons.attack, battle.buttons.cast, battle.buttons.endTurn]
      // The three buttons keep clear of each other, at the least window too.
      expect(buttons[1].x - buttons[0].x).toBeGreaterThanOrEqual(150)
      expect(buttons[2].x - buttons[1].x).toBeGreaterThanOrEqual(150)
      for (const at of [panel.equipment.head, panel.equipment.belt, ...buttons, ...portraits]) {
        expect(at.x).toBeGreaterThan(0)
        expect(at.x).toBeLessThan(width)
        expect(at.y).toBeGreaterThan(0)
        expect(at.y).toBeLessThan(height)
      }
    }

    // Smaller than the game gets: the canvas keeps its least size and the page scrolls.
    await game.resize(500, 400)
    expect(await game.canvasSize()).toEqual({ width: 840, height: 560 })

    // Clicks still land on the hexes where they are now drawn.
    await game.resize(1000, 700)
    await game.press('Escape')
    await game.waitForScenes(['Battle'])
    const battle = await game.awaitTurn()
    const to = offsetToHex(5, 4)
    await game.click(battleHexOnScreen(battle, to))
    expect(hero(await game.awaitTurn())).toMatchObject({ position: to })
  })
})
