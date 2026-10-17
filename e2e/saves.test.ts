import { describe, expect, it } from 'vitest'
import { offsetToHex } from '../src/grid/hex.ts'
import { RAIDERS, battleHexOnScreen, useGames, type Game } from './driver.ts'

/** From a game on the world map: Esc, New, the ready-made party and Begin, which is a second game in a slot of its own. */
async function anotherGame(game: Game): Promise<void> {
  await game.press('Escape')
  await game.waitForScenes(['Menu'], ['World'])
  await game.click((await game.settled('Menu')).buttons.new)
  await game.waitForScenes(['Party'])
  await game.beginReadyMade()
}

/** The Load list, from the main menu. */
async function openLoad(game: Game) {
  await game.click((await game.settled('Menu')).buttons.load)
  return game.waitFor('Menu', (m) => m.showingLoad)
}

describe('save slots', () => {
  const games = useGames()

  it('keeps a game on the world map through a reload, for Continue to open', async () => {
    const game = await games.open()
    // Nothing is saved yet, so there is nothing to continue.
    expect((await game.waitFor('Menu')).buttons.continue.enabled).toBe(false)
    await game.newGame()
    const to = offsetToHex(12, 19)
    const before = await game.travelTo(to)
    expect(before.world.turn).toBe(4)

    const menu = await game.reload()
    expect(menu.buttons.continue.enabled).toBe(true)
    await game.click(menu.buttons.continue)
    await game.waitForScenes(['World'])
    const after = await game.waitFor('World')
    expect(after.world).toEqual(before.world)
    expect(after.party).toEqual(before.party)
    // And it plays on.
    expect((await game.travelTo(offsetToHex(11, 19))).world.turn).toBe(5)
  })

  it('opens a game saved in battle in that battle, as it stood when the player’s turn began', async () => {
    const game = await games.open()
    const start = await game.enterBattle()
    await game.click(battleHexOnScreen(start, offsetToHex(5, 4)))
    await game.click((await game.awaitTurn()).buttons.endTurn)
    const saved = await game.waitFor('Battle', (b) => b.playerControl && b.state.round === 2)
    // What is done after the turn began is not kept: a reload rewinds to its start.
    await game.click(battleHexOnScreen(saved, offsetToHex(6, 4)))
    await game.waitFor('Battle', (b) => b.playerControl && b.log.length > saved.log.length)

    const menu = await game.reload()
    await game.click(menu.buttons.continue)
    await game.waitForScenes(['Battle'])
    const restored = await game.waitFor('Battle', (b) => b.playerControl)
    expect(restored.state).toEqual(saved.state)
    expect(restored.log).toEqual(saved.log)
    expect(restored.party).toEqual(saved.party)
    expect(restored.log.filter((e) => e.type === 'battle_start')).toHaveLength(1)

    // The battle plays on, and to an end that returns to the world map with the monsters gone.
    const over = await game.fightBattle()
    expect(over.state.winner).toBe('player')
    // The win is kept as it happens: a reload on the victory screen opens the world map.
    await game.click((await game.reload()).buttons.continue)
    await game.waitForScenes(['World'])
    const world = await game.waitFor('World')
    expect(world.world.locations.some((l) => l.id === RAIDERS.id)).toBe(false)
    expect(world.party.every((member) => member.level >= 2)).toBe(true)
  })

  it('lists the three slots under Load, loads the one picked, and continues the one written last', async () => {
    const game = await games.open()
    await game.newGame()
    await game.travelTo(offsetToHex(12, 19))
    // A second game takes the first empty slot without asking.
    await anotherGame(game)
    await game.travelTo(offsetToHex(10, 19))

    await game.reload()
    const load = await openLoad(game)
    expect(load.slots.map((slot) => slot.enabled)).toEqual([true, true, false])
    expect(load.slots[0].line).toMatch(/^1 {2}Aldric, Brenna, Delwyn {4}Level 1 {4}Turn 4 {4}\d+ \w+ \d\d:\d\d$/)
    expect(load.slots[1].line).toMatch(/^2 {2}Aldric, Brenna, Delwyn {4}Level 1 {4}Turn 2 /)
    expect(load.slots[2].line).toBe('3  Empty')
    // An empty slot does nothing.
    await game.click(load.slots[2])
    expect(await game.scenes()).toEqual({ running: ['Menu'], paused: [] })
    await game.click(load.buttons.back)

    // Continue is the game written last: the second.
    await game.click((await game.waitFor('Menu', (m) => !m.showingLoad)).buttons.continue)
    await game.waitForScenes(['World'])
    expect((await game.waitFor('World')).world.turn).toBe(2)

    // Load from over a paused game drops it, and opens the slot picked.
    await game.press('Escape')
    await game.waitForScenes(['Menu'], ['World'])
    await game.click((await openLoad(game)).slots[0])
    await game.waitForScenes(['World'])
    const first = await game.waitFor('World')
    expect(first.world).toMatchObject({ turn: 4, party: offsetToHex(12, 19) })
  })

  it('reads a damaged slot as unreadable, which neither loads nor enables Continue', async () => {
    const game = await games.open()
    await game.page.evaluate(() => localStorage.setItem('yomi.save.1', '{'))
    const menu = await game.reload()
    expect(menu.buttons.continue.enabled).toBe(false)
    const load = await openLoad(game)
    expect(load.slots[0]).toMatchObject({ line: '1  Unreadable save', enabled: false })
    await game.click(load.slots[0])
    expect(await game.scenes()).toEqual({ running: ['Menu'], paused: [] })
    // A new game leaves it alone and takes the next slot.
    await game.click(load.buttons.back)
    await game.newGame()
    expect(await game.page.evaluate(() => [localStorage.getItem('yomi.save.1'), localStorage.getItem('yomi.save.2') !== null])).toEqual(['{', true])
  })

  it('asks which slot to overwrite when all three are full', async () => {
    const game = await games.open()
    await game.newGame()
    await game.travelTo(offsetToHex(12, 19))
    await game.page.evaluate(() => {
      for (const slot of [2, 3]) localStorage.setItem(`yomi.save.${slot}`, localStorage.getItem('yomi.save.1')!)
    })

    await game.reload()
    const choice = await game.openPartyScreen()
    await game.click(choice.buttons.readyMade)
    await game.begin(await game.waitFor('Party', (p) => p.view === 'roster'))
    const prompt = await game.waitFor('Party', (p) => p.view === 'overwrite')
    expect(prompt.slots.map((slot) => slot.visible)).toEqual([true, true, true])
    expect(prompt.slots[1].line).toMatch(/^2 {2}Aldric, Brenna, Delwyn {4}Level 1 {4}Turn 4 /)
    // Back returns to the roster with the party as it was.
    await game.click(prompt.buttons.back)
    const back = await game.waitFor('Party', (p) => p.view === 'roster')
    expect(back.rows.map((row) => row.name)).toEqual(['Aldric', 'Brenna', 'Delwyn'])
    await game.begin(back)
    await game.click((await game.waitFor('Party', (p) => p.view === 'overwrite')).slots[1])
    expect((await game.enterWorld()).world.turn).toBe(1)

    await game.reload()
    const load = await openLoad(game)
    expect(load.slots.map((slot) => slot.line.match(/Turn \d+/)?.[0])).toEqual(['Turn 4', 'Turn 1', 'Turn 4'])
  })

  it('deletes the slot of a party that falls', async () => {
    const game = await games.open()
    await game.enterBattle()
    expect(await game.page.evaluate(() => localStorage.getItem('yomi.save.1') !== null)).toBe(true)
    const over = await game.loseBattle()
    expect(over.state.winner).toBe('enemy')
    // As the party falls, before the defeat screen is left.
    expect(await game.page.evaluate(() => localStorage.getItem('yomi.save.1'))).toBeNull()

    await game.click(over.buttons.result)
    await game.waitForScenes(['Menu'])
    const menu = await game.settled('Menu')
    expect(menu.buttons.continue.enabled).toBe(false)
    expect((await openLoad(game)).slots.map((slot) => slot.line)).toEqual(['1  Empty', '2  Empty', '3  Empty'])
    // Nor does a reload bring the game back.
    expect((await game.reload()).buttons.continue.enabled).toBe(false)
  })
})
