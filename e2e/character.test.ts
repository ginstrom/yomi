import { describe, expect, it } from 'vitest'
import { useGames } from './driver.ts'

describe('a hero’s panel', () => {
  const games = useGames()

  it('opens over the world map from the hero’s portrait, and closes back to it', async () => {
    const game = await games.open()
    const world = await game.newGame()
    expect(world.party.map((member) => [member.level, member.canAdvance])).toEqual(Array(4).fill([1, false]))
    expect(world.party.map((member) => member.active)).toEqual([true, false, false, false])

    // The first click marks the hero, and the second opens its panel.
    await game.click(world.party[1])
    const marked = await game.waitFor('World', (w) => w.party[1].active)
    expect(await game.scenes()).toEqual({ running: ['World'], paused: [] })
    await game.click(marked.party[1])
    await game.waitForScenes(['Inventory'], ['World'])
    // Nothing to spend yet, so it opens on the hero and not on the skills.
    const panel = await game.waitFor('Inventory')
    expect(panel).toMatchObject({ tab: 'character', skillPoints: 0, perkPicks: 0 })
    expect(panel.party.map((member) => member.active)).toEqual([false, true, false, false])

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
    expect(back.party.map((member) => member.active)).toEqual([false, false, true, false])
  })

  it('lists only the perks a hero has taken, and shows them all in the perk tree', async () => {
    const game = await games.open()
    const world = await game.newGame()
    await game.click(world.party[0])
    await game.waitForScenes(['Inventory'], ['World'])
    await game.press('s')
    const aldric = await game.waitFor('Inventory', (p) => p.tab === 'skills')
    expect(aldric.takenPerks).toEqual([])
    expect(aldric.mana).toBeNull()

    // The mage starts with the perk that teaches its spell, and so with mana.
    await game.click(aldric.party[3])
    const delwyn = await game.waitFor('Inventory', (p) => p.party[3].active)
    expect(delwyn.takenPerks).toEqual([{ perk: 'magic_arrow', ranks: 1 }])
    expect(delwyn.mana).toBe(18)
    expect(delwyn.attributes.intelligence).toBe(9)

    await game.click(delwyn.perkTreeButton)
    const tree = await game.waitFor('Inventory', (p) => p.tab === 'perkTree')
    expect(tree.perks).toHaveLength(16)
    expect(new Set(tree.perks.map((node) => `${node.x},${node.y}`)).size).toBe(16)
    // No pick comes before level 3.
    expect(tree.perks.some((node) => node.canTake)).toBe(false)
    expect(tree.perks.filter((node) => node.ranks > 0).map((node) => node.perk)).toEqual(['magic_arrow'])

    // A click on a node takes nothing without a pick, and a portrait turns the tree to its hero.
    await game.click(tree.perks.find((node) => node.perk === 'gain_luck')!)
    await game.click(tree.party[0])
    const turned = await game.waitFor('Inventory', (p) => p.party[0].active)
    expect(turned.tab).toBe('perkTree')
    expect(turned.perks.every((node) => node.ranks === 0)).toBe(true)

    await game.click(turned.back)
    await game.waitFor('Inventory', (p) => p.tab === 'skills')
    await game.press('p')
    await game.waitFor('Inventory', (p) => p.tab === 'perkTree')
    // Esc steps back from the tree, and only then closes the panel.
    await game.press('Escape')
    await game.waitFor('Inventory', (p) => p.tab === 'skills')
    expect(await game.scenes()).toEqual({ running: ['Inventory'], paused: ['World'] })
    await game.press('Escape')
    await game.waitForScenes(['World'])
    expect((await game.waitFor('World')).party.map((member) => member.canAdvance)).toEqual(Array(4).fill(false))
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
    expect(tree.perks).toHaveLength(16)
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
})
