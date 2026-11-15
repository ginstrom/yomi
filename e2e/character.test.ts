import { describe, expect, it } from 'vitest'
import { PERK_IDS } from '../src/character/perks.ts'
import { xpToNextLevel } from '../src/character/progression.ts'
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
    expect(panel).toMatchObject({ tab: 'character', skillPoints: 0, perkPoints: 0 })
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

  it('shows sockets and runes in a tooltip, and the wards of what is worn (ward)', async () => {
    const game = await games.open()
    const world = await game.newGame()
    await debugCommand(game, 'give iron_breastplate@3#rime1')
    await debugCommand(game, 'give iron_sword@3')
    await game.click(world.party[0])
    await game.waitForScenes(['Inventory'], ['World'])
    await game.press('i')
    let panel = await game.settled('Inventory', (p) => p.tab === 'inventory' && p.ground.length === 2)
    expect(panel.tooltip).toEqual([])

    // The breastplate's rune is a ward on the sheet, and its pip and rune icon loaded without a failed request.
    await game.click(panel.ground.find((slot) => slot.item === 'iron_breastplate@3#rime1')!)
    panel = await game.settled('Inventory', (p) => p.backpack.some((slot) => slot.item === 'iron_breastplate@3#rime1'))
    expect(panel.statLines.some((line) => line.startsWith('Wards:'))).toBe(false)
    await game.click(panel.backpack.find((slot) => slot.item === 'iron_breastplate@3#rime1')!)
    panel = await game.settled('Inventory', (p) => p.equipment.armor.item === 'iron_breastplate@3#rime1')
    await game.hover(panel.equipment.armor)
    panel = await game.settled('Inventory', (p) => p.tooltip.length > 0)
    expect(panel.tooltip).toContain('Frost ward 2')
    // The socket line names the rune; what it does is the ward line above, told once.
    expect(panel.tooltip).toContain('Sockets: 1 of 1 (Rime I)')
    expect(panel.tooltip.filter((line) => line.includes('Frost ward 2'))).toHaveLength(1)
    expect(panel.statLines).toEqual(expect.arrayContaining(['Wards:', '  frost 2']))

    // A socketed sword with nothing in it says so.
    const sword = panel.ground.find((slot) => slot.item === 'iron_sword@3')!
    await game.hover(sword)
    panel = await game.settled('Inventory', (p) => p.tooltip.includes('Sockets: 0 of 1'))
    await game.press('c')
    panel = await game.settled('Inventory', (p) => p.tab === 'character')
    expect(panel.statLines).toEqual(expect.arrayContaining(['Wards:', '  frost 2']))
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

  it('fits the Character tab’s stats in the panel with a weapon that pierces and runes, narrow and wide', async () => {
    const game = await games.open()
    const world = await game.newGame()
    // A runed hammer (piercing and two on-hit runes) and runed armour (two wards), on the mage, whose mana makes the longest stat column.
    const gear = ['steel_war_hammer@3#ember3.venom2', 'steel_breastplate@3#rime1.acid1']
    for (const id of gear) await debugCommand(game, `give ${id}`)
    await game.click(world.party[2])
    await game.waitFor('World', (w) => w.party[2].active)
    await game.click(world.party[2])
    await game.waitForScenes(['Inventory'], ['World'])
    await game.press('i')
    let panel = await game.settled('Inventory', (p) => p.tab === 'inventory' && gear.every((id) => p.ground.some((slot) => slot.item === id)))
    for (const id of gear) {
      await game.click(panel.ground.find((slot) => slot.item === id)!)
      panel = await game.settled('Inventory', (p) => p.backpack.some((slot) => slot.item === id))
      await game.click(panel.backpack.find((slot) => slot.item === id)!)
      panel = await game.settled('Inventory', (p) => Object.values(p.equipment).some((slot) => slot.item === id))
    }
    // The Inventory tab leaves the on-hit rows to the weapon's tooltip; the Character tab shows them.
    expect(panel.statLines).toEqual(expect.arrayContaining(['On a hit:', '  +3 fire, +2 poison,', 'Wards:', '  frost 2, acid 2']))
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

  it('shows on the Abilities tab the spell skill the caster’s gear leaves it', async () => {
    const game = await games.open()
    const world = await game.newGame()
    // The mage's breastplate takes 5 from its spells.
    await game.click(world.party[2])
    const marked = await game.waitFor('World', (w) => w.party[2].active)
    await game.click(marked.party[2])
    await game.waitForScenes(['Inventory'], ['World'])
    await game.press('b')
    const spells = await game.settled('Inventory', (p) => p.tab === 'abilities')
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

  it('lists only the perks a hero has taken, and shows them all in the four trees', async () => {
    const game = await games.open()
    await game.resize(840, 560)
    const world = await game.newGame()
    await game.click(world.party[0])
    await game.waitForScenes(['Inventory'], ['World'])
    await game.press('s')
    const aldric = await game.waitFor('Inventory', (p) => p.tab === 'skills')
    // The three perks a character is created with.
    expect(aldric.title).toBe('Level 1 \u00b7 Swordmaster')
    expect(aldric.takenPerks.map(({ perk }) => perk)).toEqual(['weapon_training', 'heavy_hand', 'toughness'])
    expect(aldric.mana).toBeNull()

    // The mage's spells are the Abilities tab's; its one passive is Destruction.
    await game.click(aldric.party[2])
    const delwyn = await game.waitFor('Inventory', (p) => p.party[2].active)
    expect(delwyn.takenPerks).toEqual([{ perk: 'destruction', ranks: 1 }])
    expect(delwyn.mana).toBe(28)
    expect(delwyn.attributes.intelligence).toBe(9)

    // The tree view opens on the tree of the mage's calling, Evoker (Magic Arrow and Destruction).
    await game.click(delwyn.treesButton)
    const tree = await game.waitFor('Inventory', (p) => p.tab === 'trees')
    expect(tree.tree).toBe('mage')
    const taken = (nodes: typeof tree.perks) => nodes.filter((node) => node.ranks > 0).map((node) => node.perk).sort()

    // Through the four trees, by tab and by key: every node once, none over another, all within the panel at 840×560.
    const seen: Record<string, typeof tree.perks> = {}
    for (const [i, id] of (['warrior', 'scout', 'mage', 'cleric'] as const).entries()) {
      if (i % 2 === 0) await game.click(tree.trees[id])
      else await game.press(String(i + 1))
      const shown = await game.waitFor('Inventory', (p) => p.tree === id)
      seen[id] = shown.perks
      const { panel } = shown.characterSheet
      const { width, height } = shown.nodeSize
      for (const node of shown.perks) {
        expect(node.x - width / 2).toBeGreaterThanOrEqual(panel.x)
        expect(node.x + width / 2).toBeLessThanOrEqual(panel.x + panel.width)
        expect(node.y - height / 2).toBeGreaterThanOrEqual(panel.y)
        expect(node.y + height / 2).toBeLessThanOrEqual(panel.y + panel.height)
      }
      for (const [j, one] of shown.perks.entries()) {
        for (const other of shown.perks.slice(j + 1)) {
          expect(Math.abs(one.x - other.x) >= width || Math.abs(one.y - other.y) >= height).toBe(true)
        }
      }
    }
    const all = Object.values(seen).flat().map((node) => node.perk)
    expect(all).toHaveLength(PERK_IDS.length)
    expect(new Set(all)).toEqual(new Set(PERK_IDS))
    expect(taken(seen.mage)).toEqual(['destruction', 'magic_arrow'])
    expect(taken(seen.cleric)).toEqual(['heal'])
    // The perk points of creation are spent, and the next comes at level 2.
    expect(Object.values(seen).flat().some((node) => node.canTake)).toBe(false)

    // A click on a node takes nothing without a perk point, and a portrait turns the tree to its hero.
    await game.press('1')
    const warrior = await game.waitFor('Inventory', (p) => p.tree === 'warrior')
    await game.click(warrior.perks.find((node) => node.perk === 'shield_wall')!)
    await game.click(warrior.party[0])
    const turned = await game.waitFor('Inventory', (p) => p.party[0].active)
    expect(turned).toMatchObject({ tab: 'trees', tree: 'warrior' })
    expect(taken(turned.perks)).toEqual(['heavy_hand', 'toughness', 'weapon_training'])

    await game.click(turned.back)
    await game.waitFor('Inventory', (p) => p.tab === 'skills')
    // The mage's abilities.
    await game.click(turned.party[2])
    await game.waitFor('Inventory', (p) => p.party[2].active)
    await game.press('b')
    const spells = await game.waitFor('Inventory', (p) => p.tab === 'abilities')
    expect(spells.spells.map(({ spell, castable }) => [spell, castable])).toEqual([
      ['magic_arrow', false],
      ['heal', true],
    ])
    expect(spells.abilities.map(({ name, kind }) => [name, kind])).toEqual([
      ['Magic Arrow', 'spell'],
      ['Heal', 'spell'],
    ])
    // Heal is cast on the world map from here, on a member picked by its portrait, for the mana carried.
    expect(spells.mana).toBe(28)
    await game.click(spells.spells[1])
    const choosing = await game.waitFor('Inventory', (p) => p.worldCast === 'heal')
    await game.click(choosing.party[0])
    const cast = await game.waitFor('Inventory', (p) => p.worldCast === null && p.mana === 25)
    expect(cast.party[2].active).toBe(true)
    // K opens nothing: it is no longer bound.
    await game.press('k')
    await game.press('s')
    await game.waitFor('Inventory', (p) => p.tab === 'skills')
    await game.press('p')
    await game.waitFor('Inventory', (p) => p.tab === 'trees')
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
    const tree = await game.waitFor('Inventory', (p) => p.tab === 'trees')
    expect(tree.tree).toBe('warrior')
    expect(tree.perks.length).toBeGreaterThan(0)
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

    // The second level's perk point still waits.
    expect(spent.perkPoints).toBe(1)
    await game.press('Escape')
    await game.waitForScenes(['World'])
    expect((await game.waitFor('World')).party[0].canAdvance).toBe(true)
  })

  it('prompts for points to spend, says when saving pays, and lists many passives without overlap', async () => {
    const game = await games.open()
    await game.resize(840, 560)
    await game.newGame()
    const xpTo = (level: number) => Array.from({ length: level - 1 }, (_, i) => xpToNextLevel(i + 1)).reduce((a, b) => a + b, 0)
    await debugCommand(game, `xp ${xpTo(10)} Aldric`)
    const world = await game.waitFor('World', (w) => w.party[0].level === 10)
    expect(world.message).toBe('Aldric has points to spend: click the portrait marked "+".')

    await game.click(world.party[0])
    await game.waitForScenes(['Inventory'], ['World'])
    const skills = await game.waitFor('Inventory', (p) => p.tab === 'skills')
    expect(skills.skillPointsLine).toBe(`${skills.skillPoints} skill points to spend`)
    expect(skills.perkPoints).toBe(9)

    // Shield Wall, Rooted and Iron Skin (Heavy Knight), and Armour Breaker: seven passives with the three of creation.
    await game.click(skills.treesButton)
    const tree = await game.waitFor('Inventory', (p) => p.tab === 'trees' && p.tree === 'warrior')
    // With the pointer on no node, the strip says what saving is for: here the calling's capstone, a goal while it asks Melee and depth too.
    expect(tree.treeStrip.at(-1)).toBe("Goal: Blademaster, your calling's capstone: 4 perk points, Melee 70%, 5 nodes in Swordmaster, level 12")
    for (const [perk, left] of [['shield_wall', 8], ['rooted', 6], ['iron_skin', 3], ['armor_breaker', 1]] as const) {
      await game.click((await game.probe('Inventory'))!.perks.find((n) => n.perk === perk)!)
      await game.waitFor('Inventory', (p) => p.perkPoints === left)
    }
    await game.click(tree.back)
    const listed = await game.waitFor('Inventory', (p) => p.tab === 'skills')
    expect(listed.takenPerks).toHaveLength(7)
    const rows = listed.passiveBounds
    expect(rows).toHaveLength(7)
    for (const [i, row] of rows.entries()) {
      const next = rows[i + 1]
      if (next) expect(row.y + row.height).toBeLessThanOrEqual(next.y)
      expect(row.y + row.height).toBeLessThan(listed.treesButton.y - 16)
    }

    // Melee raised past 80%, where a raise costs 2, and the points spent on Archery down to the last: Melee's "+" greys and says why.
    const spend = async (skill: 'melee' | 'archery') => {
      const before = (await game.probe('Inventory'))!
      await game.click(before.skills[skill])
      return game.waitFor('Inventory', (p) => p.skillPoints < before.skillPoints)
    }
    let now = listed
    while (now.skills.melee.level < 80) now = await spend('melee')
    while (now.skillPoints > 1) now = await spend('archery')
    expect(now.skills.melee.canRaise).toBe(false)
    await game.hover(now.skills.melee)
    expect((await game.waitFor('Inventory', (p) => p.raiseHint !== '')).raiseHint).toBe('Needs 2 skill points; you have 1')
    // Every skill point spent, the prompt on the map is gone; the perk point left is too few for any open node.
    await spend('archery')
    expect((await game.probe('Inventory'))!.skillPointsLine).toBe('Skill points: 0')
    await game.press('Escape')
    await game.waitForScenes(['World'])
    const after = await game.waitFor('World')
    expect(after.message).toBe(after.party[0].canAdvance ? 'Aldric has points to spend: click the portrait marked "+".' : '')
  })

  it('takes a tier-2 node from the tree with the perk points that the second and third levels bring', async () => {
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
    expect(skills.perkPoints).toBe(2)
    expect(skills.takenPerks).toHaveLength(3)
    await game.click(skills.treesButton)
    const tree = await game.waitFor('Inventory', (p) => p.tab === 'trees')
    const node = (perk: string) => tree.perks.find((n) => n.perk === perk)!
    expect(node('armor_breaker').canTake).toBe(true)
    // Iron Skin asks level 6 and three Heavy Knight nodes.
    expect(node('iron_skin').canTake).toBe(false)

    await game.click(node('armor_breaker'))
    const taken = await game.waitFor('Inventory', (p) => p.perkPoints === 0)
    expect(taken.perks.some((n) => n.canTake)).toBe(false)
    await game.click(taken.back)
    const back = await game.waitFor('Inventory', (p) => p.tab === 'skills')
    expect(back.takenPerks).toContainEqual({ perk: 'armor_breaker', ranks: 1 })
    expect(back.takenPerks).toHaveLength(4)
  })
  it('holds a tier-2 node back at level 2 with one perk point, showing its cost, and takes it a level later', async () => {
    const game = await games.open()
    await game.newGame()
    const xpTo = (level: number) => Array.from({ length: level - 1 }, (_, i) => xpToNextLevel(i + 1)).reduce((a, b) => a + b, 0)
    await debugCommand(game, `xp ${xpTo(2)} Aldric`)
    await game.waitFor('World', (w) => w.party[0].level === 2)
    await game.click((await game.probe('World'))!.party[0])
    await game.waitForScenes(['Inventory'], ['World'])
    const skills = await game.waitFor('Inventory', (p) => p.tab === 'skills')
    expect(skills.perkPoints).toBe(1)
    await game.click(skills.treesButton)
    const tree = await game.waitFor('Inventory', (p) => p.tab === 'trees' && p.tree === 'warrior')
    const node = (probe: typeof tree, perk: string) => probe.perks.find((n) => n.perk === perk)!
    // The costs are on the nodes: a first tier 1, a second 2, a capstone 4.
    expect(node(tree, 'toughness').cost).toBe(1)
    expect(node(tree, 'armor_breaker').cost).toBe(2)
    expect(tree.perks.filter((n) => n.cost === 4).length).toBeGreaterThan(0)
    expect(node(tree, 'armor_breaker').canTake).toBe(false)
    await game.click(node(tree, 'armor_breaker'))
    await game.settled('Inventory', (p) => p.tab === 'trees' && p.perkPoints === 1)
    expect((await game.probe('Inventory'))!.perks.find((n) => n.perk === 'armor_breaker')!.ranks).toBe(0)

    // The next level brings the second point. Esc steps back to the Skills tab, and again closes the panel.
    await game.press('Escape')
    await game.waitFor('Inventory', (p) => p.tab === 'skills')
    await game.press('Escape')
    await game.waitForScenes(['World'])
    await debugCommand(game, `xp ${xpTo(3) - xpTo(2)} Aldric`)
    await game.waitFor('World', (w) => w.party[0].level === 3)
    await game.click((await game.probe('World'))!.party[0])
    await game.waitForScenes(['Inventory'], ['World'])
    const again = await game.waitFor('Inventory', (p) => p.tab === 'skills')
    expect(again.perkPoints).toBe(2)
    await game.click(again.treesButton)
    const open = await game.waitFor('Inventory', (p) => p.tab === 'trees' && p.tree === 'warrior')
    expect(node(open, 'armor_breaker').canTake).toBe(true)
    await game.click(node(open, 'armor_breaker'))
    const taken = await game.waitFor('Inventory', (p) => p.perkPoints === 0)
    expect(node(taken, 'armor_breaker').ranks).toBe(1)
  })

  it('lists the spells and then the techniques on the Abilities tab, in rows that never overlap', async () => {
    const game = await games.open()
    await game.newGame()
    const xpTo = (level: number) => Array.from({ length: level - 1 }, (_, i) => xpToNextLevel(i + 1)).reduce((a, b) => a + b, 0)
    // Power Attack costs 2 perk points (level 3's), Flame Arrow and Heal All 2 each (level 5's 4).
    await debugCommand(game, `xp ${xpTo(3)} Aldric`)
    await debugCommand(game, `xp ${xpTo(5)} Delwyn`)
    const world = await game.waitFor('World', (w) => w.party[0].level === 3 && w.party[2].level === 5)

    // Aldric knows no active yet, but has mana all the same.
    await game.click(world.party[0])
    await game.waitForScenes(['Inventory'], ['World'])
    await game.press('b')
    const none = await game.waitFor('Inventory', (p) => p.tab === 'abilities')
    expect(none.abilities).toEqual([])
    expect(none.abilityManaLine).toMatch(/^Mana \d+ \/ [1-9]\d*: knows no ability$/)

    // Power Attack, a technique, joins the tab once taken.
    await game.press('s')
    const skills = await game.waitFor('Inventory', (p) => p.tab === 'skills')
    await game.click(skills.treesButton)
    const warrior = await game.waitFor('Inventory', (p) => p.tab === 'trees' && p.tree === 'warrior')
    await game.click(warrior.perks.find((node) => node.perk === 'power_attack')!)
    await game.waitFor('Inventory', (p) => p.perkPoints === 0)
    await game.press('b')
    const aldric = await game.waitFor('Inventory', (p) => p.tab === 'abilities' && p.abilities.length === 1)
    expect(aldric.abilities[0]).toMatchObject({ name: 'Power Attack', kind: 'at-will', mana: null })
    expect(aldric.abilityManaLine).toMatch(/^Mana \d+ \/ \d+$/)

    // Delwyn, an Evoker and Healer, with Flame Arrow and Heal All besides.
    await game.click(aldric.party[2])
    await game.waitFor('Inventory', (p) => p.party[2].active)
    await game.press('s')
    const mage = await game.waitFor('Inventory', (p) => p.tab === 'skills' && p.party[2].active)
    await game.click(mage.treesButton)
    const evoker = await game.waitFor('Inventory', (p) => p.tab === 'trees' && p.tree === 'mage')
    await game.click(evoker.perks.find((node) => node.perk === 'flame_arrow')!)
    await game.waitFor('Inventory', (p) => p.perkPoints === mage.perkPoints - 2)
    await game.press('4')
    const cleric = await game.waitFor('Inventory', (p) => p.tree === 'cleric')
    await game.click(cleric.perks.find((node) => node.perk === 'heal_all')!)
    await game.waitFor('Inventory', (p) => p.perkPoints === mage.perkPoints - 4)
    await game.press('b')
    const spells = await game.settled('Inventory', (p) => p.tab === 'abilities' && p.abilities.length === 4)
    expect(spells.abilities.map(({ name }) => name)).toEqual(['Magic Arrow', 'Flame Arrow', 'Heal', 'Heal All'])
    // Destruction's +2 is in the dice shown.
    expect(spells.abilities[0].description).toBe('1d10+2 to a foe within 5 hexes')
    expect(spells.abilityPager).toBeNull()
    const rows = spells.abilityRowBounds
    expect(rows).toHaveLength(4)
    const { panel } = spells.characterSheet
    for (const [i, a] of rows.entries()) {
      expect(a.x).toBeGreaterThanOrEqual(panel.x)
      expect(a.x + a.width).toBeLessThanOrEqual(panel.x + panel.width)
      for (const b of rows.slice(i + 1)) {
        const apart = a.x + a.width <= b.x || b.x + b.width <= a.x || a.y + a.height <= b.y || b.y + b.height <= a.y
        expect(apart).toBe(true)
      }
    }
  })

  it('opens the tree view on the calling of each hero it is turned to', async () => {
    const game = await games.open()
    const world = await game.newGame()
    await game.click(world.party[0])
    await game.waitForScenes(['Inventory'], ['World'])
    await game.press('p')
    const aldric = await game.waitFor('Inventory', (p) => p.tab === 'trees')
    expect(aldric.tree).toBe('warrior')
    // Brenna, a Ranger, from the Warrior tree.
    await game.click(aldric.party[1])
    const brenna = await game.waitFor('Inventory', (p) => p.party[1].active)
    expect(brenna).toMatchObject({ tab: 'trees', tree: 'scout' })
  })

  it("closes on Esc from every tab, a tab's key on its own tab leaving it open, and opens no menu", async () => {
    const game = await games.open()
    const world = await game.newGame()
    // The panel opens on the Character tab here, so C is pressed on the tab already shown.
    for (const key of ['s', 'c', 'b', 'i']) {
      await game.click(world.party[0])
      await game.waitForScenes(['Inventory'], ['World'])
      await game.press(key)
      await game.press(key)
      await game.settled('Inventory', (p) => p.tab === { s: 'skills', c: 'character', b: 'abilities', i: 'inventory' }[key])
      await game.press('Escape')
      await game.waitForScenes(['World'])
      // Long enough for a stray Esc to have opened the menu.
      await game.page.waitForTimeout(300)
      expect(await game.scenes()).toEqual({ running: ['World'], paused: [] })
    }
  })
})
