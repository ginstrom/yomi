import { describe, expect, it } from 'vitest'
import type { CreationProbe, CreationStep } from '../src/testHook.ts'
import { useGames, type Game } from './driver.ts'

/** Clicks a control of creation `times` over, waiting for the screen to redraw after each. */
async function clickTimes(game: Game, at: (creation: CreationProbe) => { x: number; y: number }, times: number): Promise<void> {
  for (let i = 0; i < times; i++) await game.click(at((await game.probe('Creation'))!))
}

async function toStep(game: Game, step: CreationStep): Promise<CreationProbe> {
  const creation = (await game.probe('Creation'))!
  await game.click(creation.buttons.next)
  return game.waitFor('Creation', (c) => c.step === step)
}

describe('the party screen', () => {
  const games = useGames()

  it('offers the ready-made party of three, or three empty places and no way to begin', async () => {
    const game = await games.open()
    const choice = await game.openPartyScreen()
    expect(choice.buttons.readyMade.visible && choice.buttons.createOwn.visible).toBe(true)
    expect(choice.buttons.begin.visible).toBe(false)

    // The ready-made three are shown under their button, and a hover tells of one.
    expect(choice.readyMade.map((member) => member.name)).toEqual(['Aldric', 'Brenna', 'Delwyn'])
    expect(choice.readyMade.map((member) => member.role)).toEqual(['Melee fighter', 'Archer', 'Mage'])
    expect(choice.readyMade.every((member) => member.visible)).toBe(true)
    expect(choice.info).toEqual([])
    await game.hover(choice.readyMade[2])
    const told = await game.waitFor('Party', (p) => p.info.length > 0)
    expect(told.info[0]).toBe('Delwyn')
    expect(told.info.join(' ')).toContain('Magic Arrow')
    await game.hover(choice.buttons.createOwn)
    await game.waitFor('Party', (p) => p.info.length === 0)

    await game.click(choice.buttons.readyMade)
    const ready = await game.waitFor('Party', (p) => p.view === 'roster')
    expect(ready.rows.map((row) => row.name)).toEqual(['Aldric', 'Brenna', 'Delwyn'])
    expect(ready.rows.every((row) => row.edit.visible && row.remove.visible && !row.create.visible)).toBe(true)
    expect(ready.buttons.begin.enabled).toBe(true)

    // Back drops the party made so far.
    await game.click(ready.buttons.back)
    const again = await game.waitFor('Party', (p) => p.view === 'choice')
    await game.click(again.buttons.createOwn)
    const own = await game.waitFor('Party', (p) => p.view === 'roster')
    expect(own.rows.map((row) => row.name)).toEqual([null, null, null])
    expect(own.rows.every((row) => row.create.visible && !row.edit.visible)).toBe(true)
    expect(own.buttons.begin).toMatchObject({ visible: true, enabled: false })

    await game.click(own.buttons.back)
    await game.click((await game.waitFor('Party', (p) => p.view === 'choice')).buttons.back)
    await game.waitForScenes(['Menu'])
  })

  it('fills empty places with pre-rolled characters, each at most once', async () => {
    const game = await games.open()
    const choice = await game.openPartyScreen()
    await game.click(choice.buttons.createOwn)
    const roster = await game.waitFor('Party', (p) => p.view === 'roster')
    expect(roster.rows.every((row) => row.preroll.visible)).toBe(true)

    await game.click(roster.rows[0].preroll)
    const prerolls = await game.settled('Party', (p) => p.view === 'prerolls')
    expect(prerolls.prerolls.map((p) => [p.name, p.role])).toEqual([
      ['Aldric', 'Melee fighter'],
      ['Brenna', 'Archer'],
      ['Delwyn', 'Mage'],
      ['Garrick', 'Balanced warrior'],
    ])
    expect(prerolls.prerolls.every((p) => p.enabled)).toBe(true)
    await game.hover(prerolls.prerolls[3])
    expect((await game.waitFor('Party', (p) => p.info.length > 0)).info[0]).toBe('Garrick')
    await game.click(prerolls.prerolls[3])
    const one = await game.settled('Party', (p) => p.view === 'roster')
    expect(one.rows.map((row) => row.name)).toEqual(['Garrick', null, null])
    expect(one.rows.map((row) => row.preroll.visible)).toEqual([false, true, true])

    // One already in the party is shown, but cannot be chosen again; Back returns to the roster as it was.
    await game.click(one.rows[1].preroll)
    const again = await game.settled('Party', (p) => p.view === 'prerolls')
    expect(again.prerolls.map((p) => p.enabled)).toEqual([true, true, true, false])
    await game.click(again.buttons.back)
    const back = await game.settled('Party', (p) => p.view === 'roster')
    expect(back.rows.map((row) => row.name)).toEqual(['Garrick', null, null])

    await game.click(back.rows[1].preroll)
    await game.click((await game.settled('Party', (p) => p.view === 'prerolls')).prerolls[1])
    const two = await game.settled('Party', (p) => p.view === 'roster')
    expect(two.rows.map((row) => row.name)).toEqual(['Garrick', 'Brenna', null])
    await game.begin(two)
    expect((await game.enterWorld()).party.map((member) => member.name)).toEqual(['Garrick', 'Brenna'])
  })

  it('repeats a plus or minus held down, until it is let go or has nothing left to do', async () => {
    const game = await games.open()
    const choice = await game.openPartyScreen()
    await game.click(choice.buttons.createOwn)
    const roster = await game.waitFor('Party', (p) => p.view === 'roster')
    await game.click(roster.rows[0].create)
    await game.waitForScenes(['Creation'])
    const start = await game.settled('Creation')

    // Held, the plus goes on to the most an attribute can be, and stops there.
    await game.holdDown(start.attributes.strength.plus)
    const full = await game.waitFor('Creation', (c) => c.attributes.strength.value === 10)
    expect(full.attributes.strength.plus.enabled).toBe(false)
    await game.letGo()

    // A click is one step and no more.
    await game.click(full.attributes.strength.minus)
    await game.frames(30)
    expect((await game.probe('Creation'))!.attributes.strength.value).toBe(9)

    // Let go, a held minus stops where it is.
    await game.holdDown(full.attributes.strength.minus)
    await game.waitFor('Creation', (c) => c.attributes.strength.value < 8)
    await game.letGo()
    const stopped = (await game.probe('Creation'))!.attributes.strength.value
    await game.frames(30)
    expect((await game.probe('Creation'))!.attributes.strength.value).toBe(stopped)
  })

  it('removes a member and creates one in its place through all four steps, who then begins the game', async () => {
    const game = await games.open()
    const choice = await game.openPartyScreen()
    await game.click(choice.buttons.readyMade)
    const ready = await game.waitFor('Party', (p) => p.view === 'roster')
    await game.click(ready.rows[1].remove)
    const two = await game.waitFor('Party', (p) => p.rows[2].name === null)
    // Removing closes the gap, and only the empty place has a Create.
    expect(two.rows.map((row) => row.name)).toEqual(['Aldric', 'Delwyn', null])
    expect(two.rows.map((row) => row.create.visible)).toEqual([false, false, true])

    // Typing on the roster names the encampment, which creation leaves as it was.
    expect(two.encampmentName).toBe('Oakvale')
    for (let i = 0; i < 'Oakvale'.length; i++) await game.press('Backspace')
    for (const key of 'Hearthold') await game.press(key)
    await game.waitFor('Party', (p) => p.encampmentName === 'Hearthold')

    await game.click(two.rows[2].create)
    await game.waitForScenes(['Creation'])
    const start = await game.settled('Creation')
    expect(start).toMatchObject({ step: 'attributes', editing: false, attributePoints: 26, skillPoints: 10, perkPicks: 3 })
    expect(Object.values(start.attributes).map((a) => a.value)).toEqual([1, 1, 1, 1, 1, 1])
    expect(start.attributes.strength.minus.enabled).toBe(false)

    // Strength 6, perception 3, endurance 5, intelligence 4, agility 7, luck 7.
    const spread = { strength: 5, perception: 2, endurance: 4, intelligence: 3, agility: 6, luck: 6 } as const
    for (const [id, points] of Object.entries(spread) as Array<[keyof typeof spread, number]>) {
      await clickTimes(game, (c) => c.attributes[id].plus, points)
    }
    const placed = await game.waitFor('Creation', (c) => c.attributePoints === 0)
    expect(placed.attributes.luck.plus.enabled).toBe(false)

    const skills = await toStep(game, 'skills')
    expect(skills.skills.melee).toMatchObject({ level: 13, tagged: false })
    await game.click(skills.skills.melee.tag)
    await game.waitFor('Creation', (c) => c.skills.melee.tagged)
    // Six of the ten points, each worth 2% in the tagged skill; four are kept.
    await clickTimes(game, (c) => c.skills.melee.plus, 6)
    const trained = await game.waitFor('Creation', (c) => c.skillPoints === 4)
    expect(trained.skills.melee).toMatchObject({ level: 13 + 20 + 12, placed: 6 })

    const perks = await toStep(game, 'perks')
    const node = (creation: CreationProbe, perk: string) => creation.perks.find((n) => n.perk === perk)!
    expect(node(perks, 'toughness').canClick).toBe(true)
    // The perks that raise an attribute ask level 3, and Spellcasting a Magic this character lacks.
    expect(node(perks, 'gain_strength').canClick).toBe(false)
    expect(node(perks, 'spellcasting').canClick).toBe(false)
    // The switch shows the spell tree, of which nothing is open without Spellcasting.
    await game.click(perks.treeSwitch.spells)
    const spellTree = await game.waitFor('Creation', (c) => c.tree === 'spells')
    expect(spellTree.perks).toHaveLength(17)
    expect(spellTree.perks.some((n) => n.canClick)).toBe(false)
    await game.click(spellTree.treeSwitch.perks)
    await game.waitFor('Creation', (c) => c.tree === 'perks')
    await game.click(node(perks, 'toughness'))
    await game.waitFor('Creation', (c) => c.perkPicks === 2)
    await game.click(node(perks, 'weapon_training'))
    const picked = await game.waitFor('Creation', (c) => c.perkPicks === 1)
    expect(picked.draft.perks).toEqual(['toughness', 'weapon_training'])
    // A second rank, and with every rank taken a click gives the last back.
    await game.click(node(picked, 'weapon_training'))
    await game.waitFor('Creation', (c) => c.perkPicks === 0)
    await game.click(node(picked, 'weapon_training'))
    await game.waitFor('Creation', (c) => c.perkPicks === 1)

    const naming = await toStep(game, 'name')
    expect(naming.buttons.create).toMatchObject({ visible: true, enabled: false })
    expect(naming.problem).toBe('Give the character a name')
    await game.click(naming.portraits.find((face) => face.portrait === 'dwarf')!)
    await game.waitFor('Creation', (c) => c.draft.portrait === 'dwarf')
    // A name another member has is refused, and Backspace takes letters back.
    for (const key of 'Aldric') await game.press(key)
    expect((await game.waitFor('Creation', (c) => c.draft.name === 'Aldric')).problem).toBe('Another member is called Aldric')
    for (let i = 0; i < 6; i++) await game.press('Backspace')
    for (const key of 'Mira') await game.press(key)
    const named = await game.waitFor('Creation', (c) => c.draft.name === 'Mira')
    expect(named).toMatchObject({ problem: '', buttons: { create: { enabled: true } } })

    await game.click(named.buttons.create)
    await game.waitForScenes(['Party'])
    const roster = await game.settled('Party', (p) => p.view === 'roster')
    expect(roster.rows.map((row) => row.name)).toEqual(['Aldric', 'Delwyn', 'Mira'])
    expect(roster.encampmentName).toBe('Hearthold')
    // With three members there is no Create.
    expect(roster.rows.some((row) => row.create.visible)).toBe(false)

    await game.begin(roster)
    const world = await game.enterWorld()
    expect(world.party.map((member) => member.name)).toEqual(['Aldric', 'Delwyn', 'Mira'])
    expect(world.world.locations.find((l) => l.kind === 'encampment')?.name).toBe('Hearthold')
    expect(world.buttons.enterEncampment.visible).toBe(true)
    // What creation left unspent is the character's to spend on the world map.
    expect(world.party[2]).toMatchObject({ level: 1, canAdvance: true })
    await game.click(world.party[2])
    await game.waitForScenes(['Inventory'], ['World'])
    const panel = await game.waitFor('Inventory', (p) => p.party[2].active)
    expect(panel).toMatchObject({ tab: 'skills', skillPoints: 4, perkPicks: 1 })
    // 45 from creation's points and tag, and a rank of Weapon Training.
    expect(panel.skills.melee).toMatchObject({ level: 50, canRaise: true })
    await game.click(panel.skills.melee)
    expect((await game.waitFor('Inventory', (p) => p.skillPoints === 3)).skills.melee.level).toBe(52)
  })

  it('edits a ready-made member in place, and a created one the same way', async () => {
    const game = await games.open()
    const choice = await game.openPartyScreen()
    await game.click(choice.buttons.readyMade)
    const ready = await game.waitFor('Party', (p) => p.view === 'roster')
    await game.click(ready.rows[0].edit)
    await game.waitForScenes(['Creation'])
    const aldric = await game.settled('Creation')
    // Everything as it was chosen.
    expect(aldric).toMatchObject({ step: 'attributes', editing: true, attributePoints: 0, skillPoints: 0, perkPicks: 0 })
    expect(aldric.draft).toMatchObject({
      name: 'Aldric',
      portrait: 'knight',
      tagged: 'melee',
      attributes: { strength: 9, luck: 4 },
      raises: { melee: 10 },
      perks: ['weapon_training', 'toughness', 'heavy_hand'],
    })

    await clickTimes(game, (c) => c.attributes.strength.minus, 3)
    await game.waitFor('Creation', (c) => c.attributePoints === 3)
    await clickTimes(game, (c) => c.attributes.luck.plus, 3)
    const changed = await game.waitFor('Creation', (c) => c.attributePoints === 0)
    expect(changed.draft.attributes).toMatchObject({ strength: 6, luck: 7 })
    expect(changed.notes).toEqual([])

    // One more point off Strength and Heavy Hand, which asks 6, is dropped, and the screen says so.
    await game.click(changed.attributes.strength.minus)
    const dropped = await game.waitFor('Creation', (c) => c.perkPicks === 1)
    expect(dropped.notes).toEqual(['Heavy Hand dropped: it asks Strength 6'])
    await game.click(dropped.attributes.strength.plus)
    await game.waitFor('Creation', (c) => c.attributePoints === 0)

    // The steps are free to open in any order; its own name is no clash.
    await game.click(dropped.steps.name)
    const naming = await game.waitFor('Creation', (c) => c.step === 'name')
    expect(naming).toMatchObject({ problem: '', buttons: { create: { visible: true, enabled: true } } })
    await game.click(naming.buttons.create)
    await game.waitForScenes(['Party'])
    const roster = await game.settled('Party', (p) => p.view === 'roster')
    // The same Aldric in the same place, and no member added.
    expect(roster.rows.map((row) => row.name)).toEqual(['Aldric', 'Brenna', 'Delwyn'])

    await game.click(roster.rows[0].edit)
    await game.waitForScenes(['Creation'])
    const again = await game.settled('Creation')
    expect(again.draft).toMatchObject({ attributes: { strength: 6, luck: 7 }, perks: ['weapon_training', 'toughness'] })
    expect(again.perkPicks).toBe(1)
    // Cancel leaves the member as it was.
    await game.click(again.attributes.endurance.minus)
    await game.waitFor('Creation', (c) => c.attributePoints === 1)
    await game.click(again.buttons.cancel)
    await game.waitForScenes(['Party'])
    await game.click((await game.settled('Party', (p) => p.view === 'roster')).rows[0].edit)
    await game.waitForScenes(['Creation'])
    expect((await game.settled('Creation')).draft.attributes.endurance).toBe(7)
  })

  it('fits the least window, the party screen and creation alike', async () => {
    const game = await games.open()
    await game.resize(840, 560)
    const choice = await game.openPartyScreen()
    await game.click(choice.buttons.createOwn)
    const roster = await game.waitFor('Party', (p) => p.view === 'roster')
    for (const { x, y } of [roster.rows[0].create, roster.rows[2].preroll, roster.buttons.begin, roster.buttons.back]) {
      expect(x > 0 && x < 840 && y > 0 && y < 560).toBe(true)
    }
    await game.click(roster.rows[0].create)
    await game.waitForScenes(['Creation'])
    const creation = await game.settled('Creation')
    for (const { x, y } of [creation.buttons.cancel, creation.buttons.next, creation.steps.attributes, creation.attributes.luck.plus]) {
      expect(x > 0 && x < 840 && y > 0 && y < 560).toBe(true)
    }
  })
})
