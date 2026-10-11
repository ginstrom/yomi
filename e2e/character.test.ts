import { describe, expect, it } from 'vitest'
import { useGames } from './driver.ts'

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
    expect(Object.values(skills.skills).some((skill) => skill.canRaise)).toBe(false)
    expect(skills.perks.some((perk) => perk.canTake)).toBe(false)

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

  it('spends the skill points a victory brought, on the world map and not in battle', async () => {
    const game = await games.open()
    await game.enterBattle()

    // In battle the skills are only shown.
    await game.press('s')
    await game.waitForScenes(['Inventory'], ['Battle'])
    const shown = await game.waitFor('Inventory', (p) => p.tab === 'skills')
    expect(Object.values(shown.skills).some((skill) => skill.canRaise)).toBe(false)
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
