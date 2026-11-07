import { describe, expect, it } from 'vitest'
import { offsetToHex } from '../src/grid/hex.ts'
import { useGames, type Game } from './driver.ts'

/** Types a line at the debug console, opening it first, and closes it again. */
async function debugCommand(game: Game, line: string): Promise<void> {
  await game.press('Shift+Backquote')
  await game.page.locator('#yomi-debug input').fill(line)
  await game.press('Enter')
  await game.press('Escape')
}

describe('a hero’s panel', () => {
  const games = useGames()

  it('opens over the world map from the hero’s portrait, and closes back to it', async () => {
    const game = await games.open()
    const world = await game.newGame()
    expect(world.party.map((member) => [member.level, member.canAdvance])).toEqual(Array(3).fill([1, false]))
    expect(world.party.map((member) => member.active)).toEqual([true, false, false])

    // The first click marks the hero, and the second opens its panel.
    await game.click(world.party[1])
    const marked = await game.waitFor('World', (w) => w.party[1].active)
    expect(await game.scenes()).toEqual({ running: ['World'], paused: [] })
    await game.click(marked.party[1])
    await game.waitForScenes(['Inventory'], ['World'])
    // Nothing to spend yet, so it opens on the hero and not on the skills.
    const panel = await game.waitFor('Inventory')
    expect(panel).toMatchObject({ tab: 'character', skillPoints: 0, perkPicks: 0 })
    expect(panel.party.map((member) => member.active)).toEqual([false, true, false])

    await game.press('s')
    const skills = await game.waitFor('Inventory', (p) => p.tab === 'skills')
    expect(Object.keys(skills.skills)).toEqual(['melee', 'archery', 'magic'])
    expect(Object.values(skills.skills).some((skill) => skill.canRaise)).toBe(false)

    // A portrait beside the panel turns it to that hero, on the tab it is showing.
    await game.click(skills.party[2])
    const turned = await game.waitFor('Inventory', (p) => p.party[2].active)
    expect(turned.tab).toBe('skills')
    expect(turned.equipment.mainHand.item).not.toBe(skills.equipment.mainHand.item)

    await game.press('Escape')
    await game.waitForScenes(['World'])
    const back = (await game.probe('World'))!
    expect(back.world).toEqual(world.world)
    // The hero the panel last showed is the one marked on the map.
    expect(back.party.map((member) => member.active)).toEqual([false, false, true])
  })

  it('drags gear between the equipment, the backpack and the baggage', async () => {
    const game = await games.open()
    const world = await game.newGame()
    await game.click(world.party[0])
    await game.waitForScenes(['Inventory'], ['World'])
    await game.press('i')
    const panel = await game.settled('Inventory', (p) => p.tab === 'inventory')
    const weapon = panel.equipment.mainHand.item!
    expect(weapon).not.toBeNull()
    expect(panel.ground).toEqual([])
    const carried = (p: typeof panel) => p.backpack.map((slot) => slot.item)

    // The weapon in hand dragged anywhere on the backpack is stowed, and dragged back onto its slot is worn again.
    await game.drag(panel.equipment.mainHand, panel.grids.backpack)
    const stowed = await game.settled('Inventory', (p) => p.equipment.mainHand.item === null)
    expect(carried(stowed)).toContain(weapon)
    await game.drag(stowed.backpack.find((slot) => slot.item === weapon)!, stowed.equipment.mainHand)
    const worn = await game.settled('Inventory', (p) => p.equipment.mainHand.item === weapon)
    expect(carried(worn)).toEqual(carried(panel))

    // A backpack item dragged onto the baggage goes there, and dragged back comes back.
    const spare = worn.backpack[0]
    await game.drag(spare, worn.grids.ground)
    const dropped = await game.settled('Inventory', (p) => p.ground.length === 1)
    expect(dropped.ground[0].item).toBe(spare.item)
    expect(carried(dropped)).not.toContain(spare.item)
    await game.drag(dropped.ground[0], dropped.grids.backpack)
    const back = await game.settled('Inventory', (p) => p.ground.length === 0)
    expect(carried(back)).toContain(spare.item)

    // A drop on a slot the item does not fit, or a release where it was picked up, changes nothing.
    const gear = (p: typeof panel) => ({ equipment: p.equipment, backpack: p.backpack, ground: p.ground })
    await game.drag(back.backpack[0], back.equipment.head)
    await game.frames()
    expect(gear((await game.probe('Inventory'))!)).toEqual(gear(back))

    // A press that hardly moves is still a click: it stows the weapon on release.
    const at = back.equipment.mainHand
    await game.holdDown(at)
    await game.hover({ x: at.x + 3, y: at.y + 2 })
    expect((await game.probe('Inventory'))!.equipment.mainHand.item).toBe(weapon)
    await game.letGo()
    const clicked = await game.waitFor('Inventory', (p) => p.equipment.mainHand.item === null)
    expect(carried(clicked)).toContain(weapon)

    // Esc lets go of a drag without closing the panel or moving anything.
    const settled = await game.settled('Inventory')
    const item = settled.backpack[0]
    await game.holdDown(item)
    await game.hover(settled.grids.ground)
    await game.press('Escape')
    await game.letGo()
    expect(await game.scenes()).toEqual({ running: ['Inventory'], paused: ['World'] })
    expect(gear((await game.probe('Inventory'))!)).toEqual(gear(settled))

    // A drag whose release the browser never reported (let go off the window) ends at the next move
    // with no button held, so a release reported late drops nothing.
    await game.holdDown(item)
    await game.hover(settled.grids.ground)
    await game.page.evaluate(({ x, y }) => {
      document.querySelector('canvas')!.dispatchEvent(new MouseEvent('mousemove', { clientX: x, clientY: y, buttons: 0, bubbles: true }))
    }, settled.grids.ground)
    await game.letGo()
    await game.frames()
    expect(gear((await game.probe('Inventory'))!)).toEqual(gear(settled))
  })

  it('dresses the doll and the map’s figure in the breastplate, and undresses them when it comes off (AC5)', async () => {
    const game = await games.open()
    const world = await game.newGame()
    expect(world.partyLook).toContain('gear_breastplate')
    await game.click(world.party[0])
    await game.waitForScenes(['Inventory'], ['World'])
    await game.press('i')
    const panel = await game.settled('Inventory', (p) => p.tab === 'inventory')
    expect(panel.doll).toContain('gear_breastplate')

    // Off at once on the doll, and off the map's figure once the panel closes.
    await game.click(panel.equipment.armor)
    const stowed = await game.settled('Inventory', (p) => p.equipment.armor.item === null)
    expect(stowed.doll).not.toContain('gear_breastplate')
    expect(stowed.doll).toContain('warrior')
    await game.press('Escape')
    await game.waitForScenes(['World'])
    expect((await game.probe('World'))!.partyLook).not.toContain('gear_breastplate')

    // Worn again from the backpack, it is back on both.
    await game.click((await game.probe('World'))!.party[0])
    await game.waitForScenes(['Inventory'], ['World'])
    await game.press('i')
    const reopened = await game.settled('Inventory', (p) => p.tab === 'inventory')
    await game.click(reopened.backpack.find((slot) => slot.item === panel.equipment.armor.item)!)
    const worn = await game.settled('Inventory', (p) => p.equipment.armor.item !== null)
    expect(worn.doll).toContain('gear_breastplate')
    await game.press('Escape')
    await game.waitForScenes(['World'])
    expect((await game.probe('World'))!.partyLook).toContain('gear_breastplate')
  })

  it('lays a cloak, a breastplate, a circlet, a sword and a shield in their order (AC6)', async () => {
    const game = await games.open()
    const world = await game.newGame()
    await debugCommand(game, 'give shadow_cloak')
    await debugCommand(game, 'give sage_circlet')
    await game.click(world.party[0])
    await game.waitForScenes(['Inventory'], ['World'])
    await game.press('i')
    let panel = await game.settled('Inventory', (p) => p.tab === 'inventory' && p.ground.length === 2)

    // Each from the baggage into the backpack, and from there onto the hero.
    for (const id of ['shadow_cloak', 'sage_circlet']) {
      await game.click(panel.ground.find((slot) => slot.item === id)!)
      panel = await game.settled('Inventory', (p) => p.backpack.some((slot) => slot.item === id))
      await game.click(panel.backpack.find((slot) => slot.item === id)!)
      panel = await game.settled('Inventory', (p) => Object.values(p.equipment).some((slot) => slot.item === id))
    }
    expect(panel.doll).toEqual([
      'gear_cloak_back',
      'warrior',
      'gear_breastplate',
      'gear_cloak',
      'gear_circlet',
      'gear_sword',
      'gear_shield',
    ])
    await game.press('Escape')
    await game.waitForScenes(['World'])
    expect((await game.probe('World'))!.partyLook).toEqual(panel.doll)
  })

  it('fits the Character tab’s stats in the panel with a weapon that pierces, narrow and wide', async () => {
    const game = await games.open()
    const world = await game.newGame()
    await debugCommand(game, 'give steel_war_hammer')
    // The mage, whose mana makes the longest stat column.
    await game.click(world.party[2])
    await game.waitFor('World', (w) => w.party[2].active)
    await game.click(world.party[2])
    await game.waitForScenes(['Inventory'], ['World'])
    await game.press('i')
    let panel = await game.settled('Inventory', (p) => p.tab === 'inventory' && p.ground.some((slot) => slot.item === 'steel_war_hammer'))
    await game.click(panel.ground.find((slot) => slot.item === 'steel_war_hammer')!)
    panel = await game.settled('Inventory', (p) => p.backpack.some((slot) => slot.item === 'steel_war_hammer'))
    await game.click(panel.backpack.find((slot) => slot.item === 'steel_war_hammer')!)
    await game.settled('Inventory', (p) => p.equipment.mainHand.item === 'steel_war_hammer')
    await game.press('c')
    for (const [width, height] of [
      [840, 560],
      [1400, 800],
    ]) {
      await game.resize(width, height)
      const { characterSheet: sheet } = await game.settled('Inventory', (p) => p.tab === 'character')
      // The stat column, its Pierces line the longest, ends inside the panel's border with room to spare, and
      // clear of the badges (a gap of 8 of the panel's pixels either way, the border being drawn over its edge).
      const margin = (8 * sheet.panel.width) / 720
      expect(sheet.stats.x + sheet.stats.width).toBeLessThanOrEqual(sheet.panel.x + sheet.panel.width - margin)
      expect(sheet.stats.y + sheet.stats.height).toBeLessThanOrEqual(sheet.panel.y + sheet.panel.height - margin)
      const apart =
        sheet.stats.x >= sheet.badges.x + sheet.badges.width + margin ||
        sheet.badges.x >= sheet.stats.x + sheet.stats.width + margin ||
        sheet.badges.y >= sheet.stats.y + sheet.stats.height + margin
      expect(apart).toBe(true)
    }
  })

  it('shows on the Spells tab the spell skill the caster’s gear leaves it', async () => {
    const game = await games.open()
    const world = await game.newGame()
    // The mage's breastplate takes 5 from its spells.
    await game.click(world.party[2])
    const marked = await game.waitFor('World', (w) => w.party[2].active)
    await game.click(marked.party[2])
    await game.waitForScenes(['Inventory'], ['World'])
    await game.press('b')
    const spells = await game.settled('Inventory', (p) => p.tab === 'spells')
    expect(spells.equipment.armor.item).toBe('iron_breastplate')
    expect(spells.spellSkill).toBe(spells.skills.magic.level - 5)
  })

  it('warns on the Character tab when the weapon held costs more AP than the armour leaves a turn', async () => {
    const game = await games.open()
    // Aldric with agility 4 (7 AP a turn): a 7 AP halberd fits, until plate takes a point.
    const choice = await game.openPartyScreen()
    await game.click(choice.buttons.readyMade)
    const ready = await game.waitFor('Party', (p) => p.view === 'roster')
    await game.click(ready.rows[0].edit)
    await game.waitForScenes(['Creation'])
    const clicks = async (attribute: 'agility' | 'strength' | 'luck', side: 'plus' | 'minus', times: number) => {
      for (let i = 0; i < times; i++) await game.click((await game.probe('Creation'))!.attributes[attribute][side])
    }
    await game.settled('Creation')
    await clicks('agility', 'minus', 2)
    await game.waitFor('Creation', (c) => c.attributePoints === 2)
    await clicks('strength', 'plus', 1)
    await clicks('luck', 'plus', 1)
    const edited = await game.waitFor('Creation', (c) => c.attributePoints === 0)
    await game.click(edited.steps.name)
    await game.click((await game.waitFor('Creation', (c) => c.step === 'name')).buttons.create)
    await game.waitForScenes(['Party'])
    await game.begin(await game.settled('Party', (p) => p.view === 'roster'))
    const world = await game.enterWorld()
    await debugCommand(game, 'give iron_plate')
    await debugCommand(game, 'give steel_halberd')
    await game.click(world.party[0])
    await game.waitFor('World', (w) => w.party[0].active)
    await game.click(world.party[0])
    await game.waitForScenes(['Inventory'], ['World'])
    await game.press('i')
    let panel = await game.settled('Inventory', (p) => p.tab === 'inventory' && p.ground.some((slot) => slot.item === 'iron_plate'))
    expect(panel.attackWarning).toBeNull()
    for (const item of ['steel_halberd', 'iron_plate']) {
      panel = await game.settled('Inventory', (p) => p.ground.some((slot) => slot.item === item))
      await game.click(panel.ground.find((slot) => slot.item === item)!)
      panel = await game.settled('Inventory', (p) => p.backpack.some((slot) => slot.item === item))
      await game.click(panel.backpack.find((slot) => slot.item === item)!)
      await game.settled('Inventory', (p) => Object.values(p.equipment).some((slot) => slot.item === item))
      // With the halberd alone the 7 AP blow fits the 7 AP turn.
      if (item === 'steel_halberd') expect((await game.probe('Inventory'))!.attackWarning).toBeNull()
    }
    await game.press('c')
    for (const [width, height] of [
      [840, 560],
      [1400, 800],
    ]) {
      await game.resize(width, height)
      const warned = await game.settled('Inventory', (p) => p.tab === 'character' && p.attackWarning !== null)
      expect(warned.attackWarning).toBe('Attack costs 7 AP, you have 6: cannot attack')
    }
  })

  it('lists only the perks a hero has taken, and shows them all in the perk tree', async () => {
    const game = await games.open()
    const world = await game.newGame()
    await game.click(world.party[0])
    await game.waitForScenes(['Inventory'], ['World'])
    await game.press('s')
    const aldric = await game.waitFor('Inventory', (p) => p.tab === 'skills')
    // The three perks a character is created with.
    expect(aldric.takenPerks.map(({ perk }) => perk)).toEqual(['toughness', 'heavy_hand', 'weapon_training'])
    expect(aldric.mana).toBeNull()

    // The mage's include Spellcasting, which opened its spells; the spells are the Spells tab's.
    await game.click(aldric.party[2])
    const delwyn = await game.waitFor('Inventory', (p) => p.party[2].active)
    expect(delwyn.takenPerks).toEqual([
      { perk: 'keen_eye', ranks: 1 },
      { perk: 'spellcasting', ranks: 1 },
      { perk: 'arcane_study', ranks: 1 },
    ])
    expect(delwyn.mana).toBe(18)
    expect(delwyn.attributes.intelligence).toBe(9)

    await game.click(delwyn.perkTreeButton)
    const tree = await game.waitFor('Inventory', (p) => p.tab === 'perkTree')
    expect(tree.perks).toHaveLength(28)
    expect(new Set(tree.perks.map((node) => `${node.x},${node.y}`)).size).toBe(28)
    // The picks of creation are spent, and the next comes at level 3.
    expect(tree.perks.some((node) => node.canTake)).toBe(false)
    const taken = (nodes: typeof tree.perks) => nodes.filter((node) => node.ranks > 0).map((node) => node.perk).sort()
    expect(taken(tree.perks)).toEqual(['arcane_study', 'keen_eye', 'spellcasting'])

    // A click on a node takes nothing without a pick, and a portrait turns the tree to its hero.
    await game.click(tree.perks.find((node) => node.perk === 'gain_luck')!)
    await game.click(tree.party[0])
    const turned = await game.waitFor('Inventory', (p) => p.party[0].active)
    expect(turned.tab).toBe('perkTree')
    expect(taken(turned.perks)).toEqual(['heavy_hand', 'toughness', 'weapon_training'])

    await game.click(turned.back)
    await game.waitFor('Inventory', (p) => p.tab === 'skills')
    // The mage's spells, and the spell tree, all seventeen of it, with Magic Arrow and Heal learned.
    await game.click(turned.party[2])
    await game.waitFor('Inventory', (p) => p.party[2].active)
    await game.press('b')
    const spells = await game.waitFor('Inventory', (p) => p.tab === 'spells')
    expect(spells.spells.map(({ spell, castable }) => [spell, castable])).toEqual([
      ['magic_arrow', false],
      ['heal', true],
    ])
    // Heal is cast on the world map from here, on a member picked by its portrait, for the mana carried.
    expect(spells.mana).toBe(18)
    await game.click(spells.spells[1])
    const choosing = await game.waitFor('Inventory', (p) => p.worldCast === 'heal')
    await game.click(choosing.party[0])
    const cast = await game.waitFor('Inventory', (p) => p.worldCast === null && p.mana === 15)
    expect(cast.party[2].active).toBe(true)
    await game.press('k')
    const spellTree = await game.waitFor('Inventory', (p) => p.tab === 'spellTree')
    expect(spellTree.spellNodes).toHaveLength(17)
    expect(taken(spellTree.spellNodes)).toEqual(['heal', 'magic_arrow'])
    await game.press('Escape')
    await game.waitFor('Inventory', (p) => p.tab === 'spells')
    await game.press('s')
    await game.waitFor('Inventory', (p) => p.tab === 'skills')
    await game.press('p')
    await game.waitFor('Inventory', (p) => p.tab === 'perkTree')
    // Esc steps back from the tree, and only then closes the panel.
    await game.press('Escape')
    await game.waitFor('Inventory', (p) => p.tab === 'skills')
    expect(await game.scenes()).toEqual({ running: ['Inventory'], paused: ['World'] })
    await game.press('Escape')
    await game.waitForScenes(['World'])
    expect((await game.waitFor('World')).party.map((member) => member.canAdvance)).toEqual(Array(3).fill(false))
  })

  it('spends the skill points a victory brought, on the world map and not in battle', async () => {
    const game = await games.open()
    await game.enterBattle()

    // In battle the skills are only shown.
    await game.press('s')
    await game.waitForScenes(['Inventory'], ['Battle'])
    const shown = await game.waitFor('Inventory', (p) => p.tab === 'skills')
    expect(Object.values(shown.skills).some((skill) => skill.canRaise)).toBe(false)
    // The perk tree opens in battle too, where nothing can be taken from it.
    await game.press('p')
    const tree = await game.waitFor('Inventory', (p) => p.tab === 'perkTree')
    expect(tree.perks).toHaveLength(28)
    expect(tree.perks.some((node) => node.canTake)).toBe(false)
    await game.press('Escape')
    await game.waitFor('Inventory', (p) => p.tab === 'skills')
    await game.press('Escape')
    await game.waitForScenes(['Battle'])

    const over = await game.fightBattle()
    expect(over.state.winner).toBe('player')
    await game.click(over.buttons.result)
    await game.waitForScenes(['World'])
    const world = await game.waitFor('World')
    expect(world.party[0]).toMatchObject({ level: 2, canAdvance: true })

    await game.click(world.party[0])
    await game.waitForScenes(['Inventory'], ['World'])
    const before = await game.waitFor('Inventory')
    expect(before.tab).toBe('skills')
    expect(before.skillPoints).toBeGreaterThan(0)
    expect(before.skills.archery.canRaise).toBe(true)

    await game.click(before.skills.archery)
    const raised = await game.waitFor('Inventory', (p) => p.skillPoints === before.skillPoints - 1)
    expect(raised.skills.archery.level).toBe(before.skills.archery.level + 1)

    // To the last point, after which there is nothing left to click.
    for (let left = raised.skillPoints; left > 0; left--) {
      await game.click(raised.skills.archery)
      await game.waitFor('Inventory', (p) => p.skillPoints === left - 1)
    }
    const spent = (await game.probe('Inventory'))!
    expect(spent.skills.archery).toMatchObject({ level: before.skills.archery.level + before.skillPoints, canRaise: false })

    await game.press('Escape')
    await game.waitForScenes(['World'])
    expect((await game.waitFor('World')).party[0].canAdvance).toBe(false)
  })

  it('takes a perk from the tree with the pick that the third level brings', async () => {
    // A seed with which the simple player of `fightBattle` wins all three battles, unlevelled as it goes.
    const game = await games.open({ seed: 2 })
    await game.enterBattle()
    const win = async () => {
      const over = await game.fightBattle()
      expect(over.state.winner).toBe('player')
      await game.click(over.buttons.result)
      await game.waitForScenes(['World'])
    }
    await win()
    // The Kobold Scouts next, then by way of open country to the Goblin Reavers, who are worth the third level.
    for (const hops of [[[16, 21]], [[14, 16], [13, 12], [12, 8]]]) {
      let world = await game.waitFor('World')
      for (const [col, row] of hops) world = await game.travelTo(offsetToHex(col, row))
      await game.click(world.buttons.attack)
      await game.waitForScenes(['Battle'])
      await game.waitFor('Battle', (b) => b.playerControl)
      await win()
    }
    const world = await game.waitFor('World')
    expect(world.party[0]).toMatchObject({ level: 3, canAdvance: true })

    await game.click(world.party[0])
    await game.waitForScenes(['Inventory'], ['World'])
    const skills = await game.waitFor('Inventory', (p) => p.tab === 'skills')
    expect(skills.perkPicks).toBe(1)
    expect(skills.takenPerks).toHaveLength(3)
    await game.click(skills.perkTreeButton)
    const tree = await game.waitFor('Inventory', (p) => p.tab === 'perkTree')
    const node = (perk: string) => tree.perks.find((n) => n.perk === perk)!
    expect(node('gain_endurance').canTake).toBe(true)
    // Tireless grows from Toughness, and asks for level 6 besides.
    expect(node('tireless').canTake).toBe(false)

    await game.click(node('gain_endurance'))
    const taken = await game.waitFor('Inventory', (p) => p.perkPicks === 0)
    expect(taken.attributes.endurance).toBe(tree.attributes.endurance + 1)
    expect(taken.perks.some((n) => n.canTake)).toBe(false)
    await game.click(taken.back)
    const back = await game.waitFor('Inventory', (p) => p.tab === 'skills')
    expect(back.takenPerks).toContainEqual({ perk: 'gain_endurance', ranks: 1 })
    expect(back.takenPerks).toHaveLength(4)
  })
})
