import { describe, expect, it } from 'vitest'
import { perkCost, type PerkId } from '../src/character/perks.ts'
import { xpToNextLevel } from '../src/character/progression.ts'
import { hexDistance, offsetToHex } from '../src/grid/hex.ts'
import { itemById } from '../src/inventory/inventory.ts'
import { autoResolvedLine } from '../src/scenes/battleSetup.ts'
import { GEAR_SPRITES } from '../src/scenes/unitLook.ts'
import type { BattleProbe } from '../src/testHook.ts'
import { RAIDERS, battleHexOnScreen, useGames, type Game } from './driver.ts'

/** The first party member's unit, which is the one selected as a battle opens. */
const hero = (battle: BattleProbe) => battle.state.units.find((u) => u.id === 'hero_1')!

/** Types a line at the debug console, opening it first, and closes it again. */
async function debugCommand(game: Game, line: string): Promise<void> {
  await game.press('Shift+Backquote')
  await game.page.locator('#yomi-debug input').fill(line)
  await game.press('Enter')
  await game.press('Escape')
}

/**
 * From a new game: Aldric raised to `level` by the debug console and given
 * `nodes` from the Warrior tree's Heavy Knight path in the character panel,
 * then a debug fight with the goblins of Goblin Raid, up to the player's first turn.
 */
async function aldricFights(game: Game, level: number, nodes: PerkId[]): Promise<BattleProbe> {
  await game.newGame()
  let xp = 0
  for (let l = 1; l < level; l++) xp += xpToNextLevel(l)
  await debugCommand(game, `xp ${xp} Aldric`)
  const world = await game.waitFor('World', (w) => w.party[0].level === level)
  await game.click(world.party[0])
  await game.waitForScenes(['Inventory'], ['World'])
  const skills = await game.waitFor('Inventory', (p) => p.tab === 'skills')
  await game.click(skills.treesButton)
  // Each node spends its tier's perk points.
  const spentBefore = (i: number) => nodes.slice(0, i).reduce((sum, perk) => sum + perkCost(perk), 0)
  for (const [i, perk] of nodes.entries()) {
    const tree = await game.waitFor('Inventory', (p) => p.tab === 'trees' && p.tree === 'warrior' && p.perkPoints === skills.perkPoints - spentBefore(i))
    await game.click(tree.perks.find((n) => n.perk === perk)!)
  }
  await game.waitFor('Inventory', (p) => p.perkPoints === skills.perkPoints - spentBefore(nodes.length))
  await game.press('Escape')
  await game.press('Escape')
  await game.waitForScenes(['World'])
  await game.press('Shift+Backquote')
  await game.page.locator('#yomi-debug input').fill('fight goblin_raid 1')
  await game.press('Enter')
  await game.waitForScenes(['Battle'])
  await game.press('Escape')
  return game.waitFor('Battle', (b) => b.playerControl)
}

/**
 * Ends turns, Aldric standing his ground, until his Skills list offers `ability`,
 * and returns the battle with the list open; null if Aldric fell or the battle ended first.
 */
async function waitToUse(game: Game, ability: string): Promise<BattleProbe | null> {
  for (let round = 0; round < 6; round++) {
    let battle = await game.awaitTurn()
    if (battle.buttons.result.visible || hero(battle).hp <= 0) return null
    if (battle.selected !== 'hero_1') {
      await game.click(battle.party[0])
      battle = await game.waitFor('Battle', (b) => b.selected === 'hero_1')
    }
    await game.press('m')
    const open = await game.waitFor('Battle', (b) => b.skillMenu !== null)
    if (open.skillMenu!.find((row) => row.id === ability)?.enabled) return open
    await game.press('Escape')
    await game.waitFor('Battle', (b) => b.skillMenu === null)
    await game.click(open.buttons.endTurn)
    await game.waitFor('Battle', (b) => !b.playerControl || b.state.round > open.state.round)
  }
  return null
}

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

  it('does not walk a hero towards a foe it cannot strike this turn, and strikes one it can', async () => {
    const game = await games.open()
    const start = await game.enterBattle()
    const self = hero(start)
    const foes = start.state.units.filter((u) => u.side === 'enemy')
    const nearest = foes.reduce((a, b) => (hexDistance(self.position, b.position) < hexDistance(self.position, a.position) ? b : a))
    // Out of reach this turn: the walk beside it would leave too few AP for the blow.
    expect(hexDistance(self.position, nearest.position) - self.attackRange).toBeGreaterThan(self.ap - self.attackApCost)
    await game.click(battleHexOnScreen(start, nearest.position))
    await game.frames(4)
    const after = (await game.probe('Battle'))!
    expect(after.playerControl).toBe(true)
    expect(hero(after)).toMatchObject({ position: self.position, ap: self.ap })
    expect(after.log.length).toBe(start.log.length)

    // Hovering the foe says why, and moving off it takes the hint away.
    await game.hover(battleHexOnScreen(start, nearest.position))
    const warned = await game.settled('Battle', (b) => b.hint.startsWith('Too few AP'))
    expect(warned.hint).toBe('Too few AP to reach and strike')
    // Straight onto a button, too.
    await game.hover(warned.buttons.endTurn)
    expect((await game.settled('Battle', (b) => !b.hint.startsWith('Too few AP'))).hint).toContain('Click a foe to attack')
    await game.hover(battleHexOnScreen(start, nearest.position))
    await game.settled('Battle', (b) => b.hint.startsWith('Too few AP'))
    await game.hover(battleHexOnScreen(start, self.position))
    expect((await game.settled('Battle', (b) => !b.hint.startsWith('Too few AP'))).hint).toContain('Click a foe to attack')

    // Once the foe is within a walk that leaves the AP for it, the click walks and strikes.
    await game.click(after.buttons.endTurn)
    let turn = await game.waitFor('Battle', (b) => b.playerControl && b.state.round === 2)
    const near = (b: BattleProbe) => {
      const me = hero(b)
      return b.state.units
        .filter((u) => u.side === 'enemy' && u.hp > 0)
        .find((u) => hexDistance(me.position, u.position) - me.attackRange <= me.ap - me.attackApCost)
    }
    while (!near(turn)) {
      await game.click(turn.buttons.endTurn)
      turn = await game.waitFor('Battle', (b) => b.playerControl && b.state.round === turn.state.round + 1)
    }
    const foe = near(turn)!
    await game.click(battleHexOnScreen(turn, foe.position))
    const struck = await game.waitFor('Battle', (b) => b.log.length > turn.log.length && b.log.some((e, i) => i >= turn.log.length && e.type === 'attack'))
    expect(struck.log.slice(turn.log.length).find((e) => e.type === 'attack')).toMatchObject({ attacker: 'hero_1', defender: foe.id })
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
    // The hero's figure is dressed again as the panel closes, the weapon gone and the breastplate kept.
    expect(battle.looks.hero_1).not.toContain(GEAR_SPRITES[itemById(weapon!)!.icon])
    expect(battle.looks.hero_1).toContain('gear_breastplate')
  })

  it('draws each hero in what it wears and holds, and a foe as its body alone', async () => {
    const game = await games.open()
    const battle = await game.enterBattle()
    const heroes = battle.state.units.filter((u) => u.side === 'player')
    expect(Object.keys(battle.looks).sort()).toEqual(heroes.map((u) => u.id).sort())
    // The ready-made soldier: the body, the breastplate over it, then its sword and shield.
    expect(battle.looks.hero_1).toEqual(['warrior', 'gear_breastplate', 'gear_sword', 'gear_shield'])
    for (const foe of battle.state.units.filter((u) => u.side === 'enemy')) expect(battle.looks[foe.id]).toBeUndefined()
  })

  it('charges one action point for gear dragged in the inventory, however many moves', async () => {
    const game = await games.open()
    await game.enterBattle()

    await game.press('i')
    await game.waitForScenes(['Inventory'], ['Battle'])
    const panel = await game.settled('Inventory')
    expect(panel.equipment.offHand.item).not.toBeNull()
    await game.drag(panel.equipment.mainHand, panel.grids.backpack)
    const stowed = await game.settled('Inventory', (p) => p.equipment.mainHand.item === null)
    await game.drag(stowed.equipment.offHand, stowed.grids.backpack)
    await game.waitFor('Inventory', (p) => p.equipment.offHand.item === null)

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

  it('casts a spell picked from the Skills button’s list, on a foe and then on the caster, and backs out on Esc (A10)', async () => {
    const game = await games.open()
    const start = await game.enterBattle()
    const mage = (battle: BattleProbe) => battle.state.units.find((u) => u.id === 'hero_3')!
    // Only a unit with a spell or an ability has the button.
    expect(start.buttons.cast.visible).toBe(false)

    await game.click(start.party[2])
    const selected = await game.waitFor('Battle', (b) => b.selected === 'hero_3')
    expect(mage(selected)).toMatchObject({ mana: 28, ap: 8 })
    // Heal can always be cast on the caster itself; no foe is within Magic Arrow's range yet.
    expect(selected.buttons.cast).toMatchObject({ visible: true, enabled: true })
    await game.click(selected.buttons.cast)
    const list = await game.waitFor('Battle', (b) => b.skillMenu !== null)
    expect(list.skillMenu!.map(({ kind, id, enabled }) => [kind, id, enabled])).toEqual([
      ['spell', 'magic_arrow', false],
      ['spell', 'heal', true],
    ])
    await game.press('Escape')
    await game.waitFor('Battle', (b) => b.skillMenu === null)
    expect(await game.scenes()).toEqual({ running: ['Battle'], paused: [] })

    await game.click(battleHexOnScreen(selected, offsetToHex(5, 5)))
    const near = await game.waitFor('Battle', (b) => b.playerControl && mage(b).ap === 5)

    await game.press('m')
    const opened = await game.waitFor('Battle', (b) => b.skillMenu !== null)
    expect(opened.skillMenu![0]).toMatchObject({ kind: 'spell', id: 'magic_arrow', enabled: true })
    await game.click(opened.skillMenu![0])
    expect((await game.waitFor('Battle', (b) => b.aiming !== null)).aiming).toEqual({ kind: 'spell', id: 'magic_arrow' })
    await game.press('Escape')
    await game.waitFor('Battle', (b) => b.aiming === null)
    expect(near.aiming).toBeNull()

    await game.press('m')
    await game.waitFor('Battle', (b) => b.skillMenu !== null)
    await game.press('1')
    const picking = await game.waitFor('Battle', (b) => b.aiming?.id === 'magic_arrow')
    const foe = picking.state.units.find((u) => u.id === 'goblin')!
    await game.click(battleHexOnScreen(picking, foe.position))
    const after = await game.waitFor('Battle', (b) => b.log.some((e) => e.type === 'cast') && (b.playerControl || b.buttons.result.visible))
    expect(after.log.filter((e) => e.type === 'cast')).toMatchObject([
      { caster: 'hero_3', spell: 'magic_arrow', target: 'goblin', manaCost: 3, manaAfter: 25, apAfter: 1, outcomes: [{ unit: 'goblin' }] },
    ])
    expect(mage(after)).toMatchObject({ mana: 25, ap: 1 })
    expect(after.aiming).toBeNull()

    // The panel shows what mana is left.
    await game.press('c')
    await game.waitForScenes(['Inventory'], ['Battle'])
    expect((await game.waitFor('Inventory', (p) => p.party[2].active)).mana).toBe(25)
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
    await game.waitFor('Battle', (b) => b.skillMenu !== null)
    await game.press('2')
    const healing = await game.waitFor('Battle', (b) => b.aiming?.id === 'heal')
    await game.click(battleHexOnScreen(healing, mage(healing).position))
    const healed = await game.waitFor('Battle', (b) => b.log.some((e) => e.type === 'cast' && e.spell === 'heal'))
    const heal = healed.log.find((e) => e.type === 'cast' && e.spell === 'heal')!
    expect(heal).toMatchObject({ caster: 'hero_3', manaCost: 3, manaAfter: 22, outcomes: [{ unit: 'hero_3', attackRoll: null }] })
  })

  it('taunts from the Skills list: a level 5 Aldric with Rooted and Taunt marks the foes T, and stands rooted (AC7)', async () => {
    const game = await games.open()
    // Rooted and Taunt cost 2 perk points each: level 5's 4 beyond creation's.
    const start = await aldricFights(game, 5, ['rooted', 'taunt'])
    expect(start.selected).toBe('hero_1')
    // Aldric has an ability, so the button shows; it opens on a list whose Taunt waits for a foe within 2 hexes.
    expect(start.buttons.cast).toMatchObject({ visible: true, enabled: true })
    await game.press('m')
    const list = await game.waitFor('Battle', (b) => b.skillMenu !== null)
    expect(list.skillMenu!.map(({ kind, id, label, enabled }) => ({ kind, id, label, enabled }))).toEqual([
      { kind: 'ability', id: 'taunt', label: 'Taunt  3 AP', enabled: false },
    ])
    await game.press('Escape')
    await game.waitFor('Battle', (b) => b.skillMenu === null)

    const open = await waitToUse(game, 'taunt')
    expect(open).not.toBeNull()
    // Unmoved through the turns it waited, Aldric stands rooted.
    expect(open!.marks.hero_1).toContain('R')
    await game.click(open!.skillMenu!.find((row) => row.id === 'taunt')!)
    const aiming = await game.waitFor('Battle', (b) => b.aiming !== null)
    expect(aiming.aiming).toEqual({ kind: 'ability', id: 'taunt' })
    expect(aiming.hint).toBe('Taunt: click Aldric (3 AP). Esc or Cancel to go back.')
    await game.click(battleHexOnScreen(aiming, hero(aiming).position))
    const taunted = await game.waitFor('Battle', (b) => b.playerControl && b.log.some((e) => e.type === 'ability' && e.ability === 'taunt'))
    const foes = taunted.state.units.filter((u) => u.side === 'enemy' && u.statuses.some((st) => st.id === 'taunted'))
    expect(foes.length).toBeGreaterThan(0)
    for (const foe of foes) expect(taunted.marks[foe.id]).toContain('T')
    expect(taunted.aiming).toBeNull()
  })

  it('pins a foe with Pin from the Skills list: its nameplate shows N', async () => {
    const game = await games.open()
    // Rooted, Taunt and Pin cost 2, 2 and 3 perk points: level 8's 7 beyond creation's.
    await aldricFights(game, 8, ['rooted', 'taunt', 'pin'])
    const open = await waitToUse(game, 'pin')
    expect(open).not.toBeNull()
    expect(open!.skillMenu!.find((row) => row.id === 'pin')).toMatchObject({ kind: 'ability', label: 'Pin  3 mana  6 AP' })
    await game.press(String(open!.skillMenu!.findIndex((row) => row.id === 'pin') + 1))
    const aiming = await game.waitFor('Battle', (b) => b.aiming?.id === 'pin')
    expect(aiming.hint).toBe('Pin: choose a foe (3 mana, 6 AP). Esc or Cancel to go back.')
    const self = hero(aiming)
    const foe = aiming.state.units.find((u) => u.side === 'enemy' && u.hp > 0 && hexDistance(u.position, self.position) <= self.attackRange)!
    await game.click(battleHexOnScreen(aiming, foe.position))
    const after = await game.waitFor('Battle', (b) => b.playerControl && b.log.some((e) => e.type === 'attack' && e.ability === 'pin'))
    const pin = after.log.find((e) => e.type === 'attack' && e.ability === 'pin')!
    expect(pin).toMatchObject({ attacker: 'hero_1', defender: foe.id, hit: true, manaCost: 3 })
    expect(after.state.units.find((u) => u.id === foe.id)!.statuses.map((st) => st.id)).toContain('pinned')
    expect(after.marks[foe.id]).toContain('N')
  })

  it('revives a fallen ally from the Skills list: aimed at its hex, it stands up again at a quarter of its hit points (step 22)', async () => {
    const game = await games.open()
    await game.newGame()
    // Delwyn (hero_3) learns Revive, which no pick of a new game reaches, in a planted save; at level 6 his mana holds its 20.
    await game.page.evaluate(() => {
      const saved = JSON.parse(localStorage.getItem('yomi.save.1')!)
      const delwyn = saved.game.parties[0].members[2]
      delwyn.level = 6
      delwyn.perks = { ...delwyn.perks, heal: 1, purify: 1, revive: 1 }
      delwyn.mana = 99
      localStorage.setItem('yomi.save.1', JSON.stringify(saved))
    })
    const menu = await game.reload()
    await game.click(menu.buttons.continue)
    await game.waitForScenes(['World'])
    await game.settled('World')
    await game.press('Shift+Backquote')
    for (const line of ['hp 1 Aldric', 'fight goblin_raid 1']) {
      await game.page.locator('#yomi-debug input').fill(line)
      await game.press('Enter')
    }
    await game.waitForScenes(['Battle'])
    await game.press('Escape')
    // Ends turns until the wounded Aldric has fallen and Delwyn can cast Revive.
    let open: BattleProbe | null = null
    for (let round = 0; round < 6 && open === null; round++) {
      const battle = await game.awaitTurn()
      expect(battle.buttons.result.visible).toBe(false)
      const fallen = battle.state.units.find((u) => u.side === 'player' && u.hp <= 0)
      if (fallen) {
        await game.click(battle.party[2])
        await game.waitFor('Battle', (b) => b.selected === 'hero_3')
        await game.press('m')
        const list = await game.waitFor('Battle', (b) => b.skillMenu !== null)
        if (list.skillMenu!.find((row) => row.id === 'revive')?.enabled) {
          open = list
          break
        }
        await game.press('Escape')
        await game.waitFor('Battle', (b) => b.skillMenu === null)
      }
      await game.click(battle.buttons.endTurn)
      await game.waitFor('Battle', (b) => !b.playerControl || b.state.round > battle.state.round)
    }
    expect(open).not.toBeNull()
    const down = open!.state.units.find((u) => u.side === 'player' && u.hp <= 0)!
    expect(open!.figureAlpha[down.id]).toBeLessThan(1)
    await game.click(open!.skillMenu!.find((row) => row.id === 'revive')!)
    const aiming = await game.waitFor('Battle', (b) => b.aiming?.id === 'revive')
    expect(aiming.hint).toBe('Revive: choose a fallen ally (20 mana, 6 AP). Esc or Cancel to go back.')
    await game.click(battleHexOnScreen(aiming, down.position))
    const after = await game.waitFor('Battle', (b) => b.playerControl && b.log.some((e) => e.type === 'cast' && e.spell === 'revive'))
    const standing = after.state.units.find((u) => u.id === down.id)!
    expect(standing.hp).toBe(Math.floor(standing.maxHp / 4))
    expect(after.figureAlpha[down.id]).toBe(1)
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
    expect(world.confronting).toBeNull()
    expect(world.partyAt).toEqual(RAIDERS.position)
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

  it('goes on at the world map when a party falls while another lives, its baggage left at the nest (A9)', async () => {
    const game = await games.open()
    await game.newGame()
    // A second party at home beside the first, carrying a sword in its baggage.
    await game.page.evaluate(() => {
      const saved = JSON.parse(localStorage.getItem('yomi.save.1')!)
      const first = saved.game.parties[0]
      const second = JSON.parse(JSON.stringify(first))
      second.id = 'party_2'
      second.name = 'Second Company'
      for (const member of second.members) member.name = `${member.name}2`
      second.baggage = ['iron_sword']
      saved.game.parties.push(second)
      localStorage.setItem('yomi.save.1', JSON.stringify(saved))
    })
    const menu = await game.reload()
    await game.click(menu.buttons.continue)
    await game.waitForScenes(['World'])
    await game.settled('World')
    await game.press('Shift+Backquote')
    for (const line of ['hp 1 all @second', `goto ${RAIDERS.id} @second`]) {
      await game.page.locator('#yomi-debug input').fill(line)
      await game.press('Enter')
    }
    await game.press('Shift+Backquote')
    const world = await game.waitFor('World', (w) => w.parties.length === 2 && w.parties[1].confronting)
    await game.click(world.parties[1])
    const selected = await game.waitFor('World', (w) => w.selectedParty === 'party_2' && w.buttons.attack.visible)
    await game.click(selected.buttons.attack)
    await game.waitForScenes(['Battle'])
    await game.waitFor('Battle', (b) => b.playerControl)

    const over = await game.loseBattle()
    expect(over.state.winner).toBe('enemy')
    expect(over.result).toEqual(['The Second Company has fallen. Its baggage lies at the Goblin Raiders.'])
    const saved = await game.page.evaluate(() => JSON.parse(localStorage.getItem('yomi.save.1')!))
    expect(saved.battle).toBeNull()
    expect(saved.game.parties.map((p: { id: string }) => p.id)).toEqual(['party_1'])
    // The fallen party's panel has no one left to show: C, I and S do nothing on the result screen.
    for (const key of ['KeyC', 'KeyI', 'KeyS']) await game.press(key)
    await game.waitForScenes(['Battle'])

    await game.click(over.buttons.result)
    await game.waitForScenes(['World'])
    const after = await game.waitFor('World')
    expect(after.selectedParty).toBe('party_1')
    expect(after.parties.map((p) => p.id)).toEqual(['party_1'])
    // Only the first party is drawn, and the view follows it, its figure mid-view at home.
    expect(after.figures.map((f) => f.id)).toEqual(['party_1'])
    const { screen } = after.figures[0]
    expect(screen.x).toBeGreaterThan(after.view.x)
    expect(screen.x).toBeLessThan(after.view.x + after.view.width)
    expect(screen.y).toBeGreaterThan(after.view.y)
    expect(screen.y).toBeLessThan(after.view.y + after.view.height)
    expect(after.buttons.enterEncampment.visible).toBe(true)
    const raiders = after.world.locations.find((l) => l.id === RAIDERS.id)
    expect(raiders?.kind === 'monsters' && raiders.loot.map((item) => item.id)).toContain('iron_sword')
    // The slot is still the playthrough's, and loads.
    const again = await game.reload()
    expect(again.buttons.continue.enabled).toBe(true)
    await game.click(again.buttons.continue)
    await game.waitForScenes(['World'])
    expect((await game.waitFor('World')).parties.map((p) => p.id)).toEqual(['party_1'])
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

describe('auto-resolve on the battle screen', () => {
  const games = useGames()

  it('resolves the rest of a battle at once from a played move, to the played battle’s result and save (A2)', async () => {
    const game = await games.open()
    const start = await game.enterBattle()
    expect(start.buttons.auto).toMatchObject({ visible: true, enabled: true })
    await game.click(battleHexOnScreen(start, offsetToHex(5, 4)))
    const moved = await game.awaitTurn()
    expect(hero(moved).position).toEqual(offsetToHex(5, 4))

    await game.click(moved.buttons.auto)
    const over = await game.waitFor('Battle', (b) => b.buttons.result.visible)
    expect(over.state.phase).toBe('over')
    expect(over.state.winner).toBe('player')
    expect(over.log.at(-1)?.type).toBe('battle_end')
    const rounds = over.state.round - moved.state.round + 1
    expect(over.result[0]).toBe('The Goblin Raiders are beaten.')
    expect(over.result[1]).toBe(autoResolvedLine(rounds))
    for (const button of [over.buttons.auto, over.buttons.attack, over.buttons.endTurn]) expect(button.visible).toBe(false)
    // Nothing is played back, but the end sounds as a played battle's: the victory sting, then the level-up's.
    const heard = () => game.page.evaluate(() => window.__yomi!.audioLog().map((entry) => entry.cue))
    await game.page.waitForFunction(() => window.__yomi!.audioLog().some((entry) => entry.cue === 'stings.level_up'))
    const all = await heard()
    // What was heard from the press of Auto on.
    const cues = all.slice(all.lastIndexOf('ui.click'))
    expect(cues.indexOf('stings.victory')).toBeGreaterThan(-1)
    expect(cues.indexOf('stings.level_up')).toBeGreaterThan(cues.indexOf('stings.victory'))
    expect(cues.filter((cue) => cue.startsWith('battle.'))).toEqual([])

    // Settled as a played victory: no battle saved, the raiders gone, the experience won kept.
    const saved = await game.page.evaluate(() => JSON.parse(localStorage.getItem('yomi.save.1')!))
    expect(saved.battle).toBeNull()
    expect(saved.game.world.locations.some((l: { id: string }) => l.id === RAIDERS.id)).toBe(false)
    const members = saved.game.parties[0].members as Array<{ level: number; xp: number }>
    expect(members.map((m) => m.level)).toEqual(over.party.map((p) => p.level))
    expect(members.every((m) => m.level > 1 || m.xp > 0)).toBe(true)
  })

  it('is greyed while the enemy plays, and enabled again when control returns', async () => {
    const game = await games.open()
    const start = await game.enterBattle()
    await game.click(start.buttons.endTurn)
    const enemy = await game.waitFor('Battle', (b) => !b.playerControl)
    expect(enemy.buttons.auto).toMatchObject({ visible: true, enabled: false })
    const back = await game.waitFor('Battle', (b) => b.playerControl && b.state.round === 2)
    expect(back.buttons.auto.enabled).toBe(true)
  })

  it('resolves a battle taken up from a save', async () => {
    const game = await games.open()
    await game.enterBattle()
    const menu = await game.reload()
    await game.click(menu.buttons.continue)
    await game.waitForScenes(['Battle'])
    const restored = await game.waitFor('Battle', (b) => b.playerControl)
    await game.frames()
    await game.click(restored.buttons.auto)
    const over = await game.waitFor('Battle', (b) => b.buttons.result.visible)
    expect(over.log.at(-1)?.type).toBe('battle_end')
    expect(over.result[1]).toBe(autoResolvedLine(over.state.round - restored.state.round + 1))
  })
})

describe('auto-resolve from the world map', () => {
  const games = useGames()

  /** From a new game: the party before the raiders, the footer's Auto-resolve button up. */
  async function atRaiders(game: Game) {
    await game.newGame()
    const world = await game.travelTo(RAIDERS.position)
    expect(world.buttons.autoResolve).toMatchObject({ visible: true, enabled: true })
    expect(world.buttons.attack.visible).toBe(true)
    return world
  }

  /** The debug console's lines, typed in the world map. */
  async function debugLines(game: Game, lines: string[]): Promise<void> {
    await game.press('Shift+Backquote')
    for (const line of lines) {
      await game.page.locator('#yomi-debug input').fill(line)
      await game.press('Enter')
    }
    await game.press('Shift+Backquote')
  }

  it('fights the battle at once and settles it as a played victory (A1)', async () => {
    const game = await games.open()
    const world = await atRaiders(game)
    await game.click(world.buttons.autoResolve)
    await game.waitForScenes(['Battle'])
    // Never the player's turn: the result is up before control is given.
    const over = await game.waitFor('Battle', (b) => b.buttons.result.visible || b.playerControl)
    expect(over.buttons.result.visible).toBe(true)
    expect(over.playerControl).toBe(false)
    expect(over.state.winner).toBe('player')
    expect(over.log.at(-1)?.type).toBe('battle_end')
    expect(over.result[0]).toBe('The Goblin Raiders are beaten.')
    expect(over.result[1]).toMatch(/^Auto-resolved in \d+ rounds?\.$/)
    expect(over.buttons.auto.visible).toBe(false)
    const found = over.result.at(-1)!.match(/^Found: (.*)\.$/)

    await game.click(over.buttons.result)
    await game.waitForScenes(['World'])
    const after = await game.waitFor('World')
    expect(after.world.locations.some((l) => l.id === RAIDERS.id)).toBe(false)
    expect(after.confronting).toBeNull()
    const saved = await game.page.evaluate(() => JSON.parse(localStorage.getItem('yomi.save.1')!))
    expect(saved.battle).toBeNull()
    const members = saved.game.parties[0].members as Array<{ level: number; xp: number }>
    expect(members.every((m) => m.level > 1 || m.xp > 0)).toBe(true)
    if (found) expect(saved.game.parties[0].baggage.length).toBeGreaterThan(0)
  })

  it('plays the same battle twice from the same seed, with the auto policy in its meta (A3)', async () => {
    const logs = []
    for (let i = 0; i < 2; i++) {
      const game = await games.open({ seed: 7 })
      const world = await atRaiders(game)
      await game.click(world.buttons.autoResolve)
      await game.waitForScenes(['Battle'])
      const over = await game.waitFor('Battle', (b) => b.buttons.result.visible)
      expect(over.log[0]).toMatchObject({ type: 'battle_start', seed: 7, meta: { source: 'game', party: 'party_1', playerPolicy: 'aggressive' } })
      logs.push(over.log)
    }
    expect(logs[1]).toEqual(logs[0])
  })

  it('leaves the policy out of the meta of a battle that Attack starts', async () => {
    const game = await games.open()
    const battle = await game.enterBattle()
    expect((battle.log[0] as { meta: Record<string, unknown> }).meta).not.toHaveProperty('playerPolicy')
  })

  it('ends the game at the main menu when the last party falls, as a played defeat does (A6)', async () => {
    const game = await games.open()
    await game.newGame()
    // A lone hero on one hit point, certain to fall to the raiders.
    await game.page.evaluate(() => {
      const saved = JSON.parse(localStorage.getItem('yomi.save.1')!)
      saved.game.parties[0].members = saved.game.parties[0].members.slice(0, 1)
      saved.game.parties[0].members[0].hp = 1
      localStorage.setItem('yomi.save.1', JSON.stringify(saved))
    })
    const menu = await game.reload()
    await game.click(menu.buttons.continue)
    await game.waitForScenes(['World'])
    await game.settled('World')
    const world = await game.travelTo(RAIDERS.position)
    await game.click(world.buttons.autoResolve)
    await game.waitForScenes(['Battle'])
    const over = await game.waitFor('Battle', (b) => b.buttons.result.visible)
    expect(over.state.winner).toBe('enemy')
    expect(over.result.some((line) => /^Auto-resolved in \d+ rounds?\.$/.test(line))).toBe(true)
    await game.click(over.buttons.result)
    await game.waitForScenes(['Menu'])
    expect((await game.waitFor('Menu')).buttons.continue.enabled).toBe(false)
  })

  it('wipes a lesser party that falls while another lives, its baggage left at the nest (A6, R3)', async () => {
    const game = await games.open()
    await game.newGame()
    await game.page.evaluate(() => {
      const saved = JSON.parse(localStorage.getItem('yomi.save.1')!)
      const first = saved.game.parties[0]
      const second = JSON.parse(JSON.stringify(first))
      second.id = 'party_2'
      second.name = 'Second Company'
      second.members = second.members.slice(0, 1)
      for (const member of second.members) member.name = `${member.name}2`
      second.baggage = ['iron_sword']
      saved.game.parties.push(second)
      localStorage.setItem('yomi.save.1', JSON.stringify(saved))
    })
    const menu = await game.reload()
    await game.click(menu.buttons.continue)
    await game.waitForScenes(['World'])
    await game.settled('World')
    await debugLines(game, ['hp 1 all @second', `goto ${RAIDERS.id} @second`])
    const world = await game.waitFor('World', (w) => w.parties.length === 2 && w.parties[1].confronting)
    await game.click(world.parties[1])
    const selected = await game.waitFor('World', (w) => w.selectedParty === 'party_2' && w.buttons.autoResolve.visible)
    await game.click(selected.buttons.autoResolve)
    await game.waitForScenes(['Battle'])
    const over = await game.waitFor('Battle', (b) => b.buttons.result.visible)
    expect(over.log[0]).toMatchObject({ meta: { party: 'party_2', playerPolicy: 'aggressive' } })
    expect(over.state.winner).toBe('enemy')
    expect(over.result[0]).toBe('The Second Company has fallen. Its baggage lies at the Goblin Raiders.')
    const saved = await game.page.evaluate(() => JSON.parse(localStorage.getItem('yomi.save.1')!))
    expect(saved.game.parties.map((p: { id: string }) => p.id)).toEqual(['party_1'])
    await game.click(over.buttons.result)
    await game.waitForScenes(['World'])
    const after = await game.waitFor('World')
    expect(after.selectedParty).toBe('party_1')
    const raiders = after.world.locations.find((l) => l.id === RAIDERS.id)
    expect(raiders?.kind === 'monsters' && raiders.loot.map((item) => item.id)).toContain('iron_sword')
  })
})

describe('a battle’s sounds', () => {
  const games = useGames()
  const cues = (game: Game) => game.page.evaluate(() => window.__yomi!.audioLog().map((entry) => entry.cue))
  /** Waits until the sound log holds a cue that satisfies `want`, then returns the log. */
  async function heard(game: Game, want: string): Promise<string[]> {
    await game.page.waitForFunction((pattern) => window.__yomi!.audioLog().some((entry) => new RegExp(pattern).test(entry.cue)), want)
    return cues(game)
  }

  it('steps once for each hex walked, in the mover’s class', async () => {
    const game = await games.open()
    const start = await game.enterBattle()
    await game.click(battleHexOnScreen(start, offsetToHex(5, 4)))
    const moved = await game.awaitTurn()
    const walk = moved.log.find((e) => e.type === 'move' && e.unit === 'hero_1')
    expect(walk?.type === 'move' && walk.path.length).toBeGreaterThan(1)
    const steps = walk?.type === 'move' ? walk.path.length : 0
    await game.page.waitForFunction((n) => window.__yomi!.audioLog().filter((e) => e.cue.startsWith('battle.step.')).length >= n, steps)
    // The ready-made soldier wears a breastplate.
    expect((await cues(game)).filter((cue) => cue.startsWith('battle.step.'))).toEqual(Array(steps).fill('battle.step.armored'))
  })

  it('swings with the sword and lands, then casts a spell and lands that', async () => {
    const game = await games.open()
    let turn = await game.enterBattle()
    const near = (b: BattleProbe) => {
      const me = hero(b)
      return b.state.units
        .filter((u) => u.side === 'enemy' && u.hp > 0)
        .find((u) => hexDistance(me.position, u.position) - me.attackRange <= me.ap - me.attackApCost)
    }
    while (!near(turn)) {
      const round = turn.state.round
      await game.click(turn.buttons.endTurn)
      turn = await game.waitFor('Battle', (b) => b.playerControl && b.state.round === round + 1)
    }
    await game.click(battleHexOnScreen(turn, near(turn)!.position))
    const outcome = /^battle\.(hit\.(slash|pierce|crush|crit)|miss\.swing)$/
    const log = await heard(game, outcome.source)
    expect(log).toContain('battle.swing.blade')
    expect(log.indexOf('battle.swing.blade')).toBeLessThan(log.findIndex((cue) => outcome.test(cue)))
  })

  it('casts with the mage’s spell cue and its outcome', async () => {
    const game = await games.open()
    const start = await game.enterBattle()
    await game.click(start.party[2])
    const selected = await game.waitFor('Battle', (b) => b.selected === 'hero_3')
    await game.click(battleHexOnScreen(selected, offsetToHex(5, 5)))
    await game.waitFor('Battle', (b) => b.playerControl && b.state.units.find((u) => u.id === 'hero_3')!.ap === 5)
    await game.press('m')
    await game.waitFor('Battle', (b) => b.skillMenu !== null)
    await game.press('1')
    const picking = await game.waitFor('Battle', (b) => b.aiming?.kind === 'spell' && b.aiming.id === 'magic_arrow')
    await game.click(battleHexOnScreen(picking, picking.state.units.find((u) => u.id === 'goblin')!.position))
    const log = await heard(game, '^battle\\.(impact\\.arcane|miss\\.magic|hit\\.image)$')
    expect(log).toContain('battle.cast.arcane')
  })

  it('tolls a fall and sounds the victory sting, and the level-up after it when a hero levelled', async () => {
    const game = await games.open()
    await game.enterBattle()
    const over = await game.fightBattle()
    expect(over.state.winner).toBe('player')
    const log = await heard(game, '^stings\\.victory$')
    expect(log.some((cue) => cue.startsWith('battle.death.'))).toBe(true)
    expect(over.result.some((line) => line.includes('reaches level'))).toBe(true)
    const after = await heard(game, '^stings\\.level_up$')
    expect(after.indexOf('stings.level_up')).toBeGreaterThan(after.indexOf('stings.victory'))
  })
})
