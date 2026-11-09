import { describe, expect, it } from 'vitest'
import type { WorldState, WorldStatus } from '../src/game/worldMap.ts'
import { hexDistance, offsetToHex, type Hex } from '../src/grid/hex.ts'
import { WORLD_LAYOUT, boardHexCenter, boardPixelSize, type Point } from '../src/scenes/boardGeometry.ts'
import { clampOrigin, mapOrigin, pannedOrigin } from '../src/scenes/mapScroll.ts'
import type { WorldProbe } from '../src/testHook.ts'
import { FIGURE_SPREAD } from '../src/scenes/partyList.ts'
import { RAIDERS, useGames, worldHexOnScreen, type Game } from './driver.ts'

describe('the world map', () => {
  const games = useGames()

  it('opens a new game on turn 1 and walks the party to a clicked hex, a turn a hex', async () => {
    const game = await games.open()
    const start = await game.newGame()
    expect(start.world.turn).toBe(1)
    expect(start.partyAt).toEqual(offsetToHex(9, 19))
    expect(start.buttons.attack.visible).toBe(false)

    const arrived = await game.travelTo(offsetToHex(11, 19))
    expect(arrived.world.turn).toBe(3)
    expect(arrived.confronting).toBeNull()
  })

  it('opens on the home valley, the rest unexplored and the Source unknown, and reveals land as the party travels', async () => {
    const game = await games.open()
    const start = await game.newGame()
    const index = (col: number, row: number) => row * start.world.board.cols + col
    expect(start.visible).toContain(index(9, 19))
    expect(start.world.seen[index(58, 19)]).toBe(-1)
    expect(start.world.seen[index(9, 28)]).toBe(-1)
    expect(start.world.sighted).not.toContain('blight_source')

    const south = await game.travelTo(offsetToHex(9, 23))
    expect(south.visible).toContain(index(9, 28))
    expect(south.world.seen[index(9, 28)]).toBeGreaterThanOrEqual(0)
  })

  it('tells of the hovered hex in the info panel', async () => {
    const game = await games.open()
    const start = await game.newGame()
    await game.hover(worldHexOnScreen(start, start.partyAt))
    const here = await game.waitFor('World', (w) => w.info !== '')
    expect(here.info).toContain('Your party:')
    await game.hover(worldHexOnScreen(start, RAIDERS.position))
    const raiders = await game.waitFor('World', (w) => w.info.startsWith('Goblin Raiders'))
    expect(raiders.info).toContain('threat 1')
    await game.hover({ x: 0, y: 0 })
    await game.waitFor('World', (w) => w.info === '')
  })

  /** A point inside the map's view, clear of the bars and buttons, to press on. */
  const midView = (w: WorldProbe): Point => ({ x: Math.round(w.view.x + w.view.width / 2), y: Math.round(w.view.y + w.view.height / 2) })
  const plus = (p: Point, dx: number, dy: number): Point => ({ x: p.x + dx, y: p.y + dy })
  /** Where the map sits when the view follows the party, as it does before any pan. */
  const following = (w: WorldProbe): Point =>
    mapOrigin(boardHexCenter(w.partyAt, WORLD_LAYOUT), boardPixelSize(w.world.board, WORLD_LAYOUT), w.view)

  /** Presses mid-view and drags the pointer by (dx, dy), letting go there; the map has moved with it. */
  async function pan(game: Game, start: WorldProbe, dx: number, dy: number): Promise<WorldProbe> {
    const press = midView(start)
    const expected = pannedOrigin(start.origin, press, plus(press, dx, dy), boardPixelSize(start.world.board, WORLD_LAYOUT), start.view)
    expect(expected).not.toEqual(start.origin)
    await game.holdDown(press)
    await game.hover(plus(press, dx / 2, dy / 2))
    await game.hover(plus(press, dx, dy))
    const dragging = await game.waitFor('World', (w) => w.origin.x === expected.x && w.origin.y === expected.y)
    // A drag shows no route and tells of no hex.
    expect(dragging.info).toBe('')
    await game.letGo()
    return game.waitFor('World')
  }

  it('pans the map under a drag, without moving the party or passing time', async () => {
    const game = await games.open()
    const start = await game.newGame()
    const panned = await pan(game, start, -40, -30)
    expect(panned.walking).toBe(false)
    expect(panned.partyAt).toEqual(start.partyAt)
    expect(panned.world.turn).toBe(start.world.turn)
  })

  it('stops the pan at the map edge', async () => {
    const game = await games.open()
    const start = await game.newGame()
    // The home valley is at the map's left edge: a drag back to the right goes no further than it.
    const left = await pan(game, start, -200, 0)
    expect(start.origin.x).toBe(start.view.x)
    const back = await pan(game, left, 400, 0)
    expect(back.origin.x).toBe(start.view.x)
  })

  it('still travels on a press that moves less than the drag threshold', async () => {
    const game = await games.open()
    const start = await game.newGame()
    const to = offsetToHex(11, 19)
    const at = worldHexOnScreen(start, to)
    await game.holdDown(at)
    await game.hover(plus(at, 3, 2))
    await game.letGo()
    const arrived = await game.waitFor('World', (w) => !w.walking && w.world.turn !== start.world.turn)
    expect(arrived.partyAt).toEqual(to)
  })

  it('travels to the hex under the pointer on a panned map, then follows the party again', async () => {
    const game = await games.open()
    const start = await game.newGame()
    const panned = await pan(game, start, -40, -30)
    const to = offsetToHex(11, 19)
    await game.click(worldHexOnScreen(panned, to))
    const arrived = await game.waitFor('World', (w) => !w.walking && w.world.turn !== start.world.turn)
    expect(arrived.partyAt).toEqual(to)
    expect(arrived.origin).toEqual(following(arrived))
  })

  it('recentres on the party on Home, moving no one and passing no time', async () => {
    const game = await games.open()
    const start = await game.newGame()

    // With no pan, Home changes nothing.
    await game.press('Home')
    expect((await game.waitFor('World')).origin).toEqual(start.origin)

    const panned = await pan(game, start, -40, -30)
    await game.press('Home')
    const home = await game.waitFor('World', (w) => w.origin.x === start.origin.x && w.origin.y === start.origin.y)
    expect(home.partyAt).toEqual(panned.partyAt)
    expect(home.world.turn).toBe(panned.world.turn)
    expect(home.walking).toBe(false)
  })

  it('does not travel on a press let go past the threshold, even with no move reported on the way', async () => {
    const game = await games.open()
    const start = await game.newGame()
    const at = worldHexOnScreen(start, offsetToHex(11, 19))
    await game.holdDown(at)
    // The release alone carries the new position, as a browser may send it after a fast flick.
    const cdp = await game.page.context().newCDPSession(game.page)
    await cdp.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: at.x + 40, y: at.y, button: 'left', clickCount: 1 })
    await game.frames()
    const after = await game.waitFor('World')
    expect(after.walking).toBe(false)
    expect(after.partyAt).toEqual(start.partyAt)
    expect(after.world.turn).toBe(start.world.turn)
  })

  it('ignores Home while the button is still down on a pan', async () => {
    const game = await games.open()
    const start = await game.newGame()
    const press = midView(start)
    await game.holdDown(press)
    await game.hover(plus(press, -40, -30))
    const dragging = await game.waitFor('World', (w) => w.origin.x !== start.origin.x || w.origin.y !== start.origin.y)
    await game.press('Home')
    expect((await game.waitFor('World')).origin).toEqual(dragging.origin)
    await game.letGo()
  })

  it('ends a pan whose release went unreported at the next move with no button held', async () => {
    const game = await games.open()
    const start = await game.newGame()
    const press = midView(start)
    await game.holdDown(press)
    await game.hover(plus(press, -40, -30))
    const dragging = await game.waitFor('World', (w) => w.origin.x !== start.origin.x || w.origin.y !== start.origin.y)
    // Let go off the window: the browser reports only a later move, with no button held.
    await game.page.evaluate(({ x, y }) => {
      document.querySelector('canvas')!.dispatchEvent(new MouseEvent('mousemove', { clientX: x, clientY: y, buttons: 0, bubbles: true }))
    }, plus(press, -60, -40))
    await game.frames()
    expect((await game.waitFor('World')).origin).toEqual(dragging.origin)
    // The pan is over, so Home recentres.
    await game.press('Home')
    await game.waitFor('World', (w) => w.origin.x === start.origin.x && w.origin.y === start.origin.y)
    await game.letGo()
  })

  it('keeps Home from scrolling the page when the window is below the game\'s minimum size', async () => {
    const game = await games.open()
    await game.newGame()
    await game.resize(800, 500)
    await game.page.evaluate(() => window.scrollTo(0, 40))
    const scrolled = await game.page.evaluate(() => window.scrollY)
    expect(scrolled).toBeGreaterThan(0)
    const before = await game.waitFor('World')
    await pan(game, before, -40, -30)
    await game.press('Home')
    await game.waitFor('World', (w) => w.origin.x === before.origin.x && w.origin.y === before.origin.y)
    expect(await game.page.evaluate(() => window.scrollY)).toBe(scrolled)
  })

  it('keeps a pan within the map when the window is resized', async () => {
    const game = await games.open()
    const start = await game.newGame()
    const map = boardPixelSize(start.world.board, WORLD_LAYOUT)
    // Panned to the map's right edge, then the window grows: that edge must still meet the view's, not leave a gap.
    const rightEdge = (w: WorldProbe): number => clampOrigin({ x: -1e6, y: w.origin.y }, map, w.view).x
    let panned = start
    while (panned.origin.x !== rightEdge(panned)) panned = await pan(game, panned, -500, 0)
    await game.resize(1600, 1000)
    const resized = await game.waitFor('World', (w) => w.view.width !== panned.view.width)
    expect(resized.origin).toEqual(clampOrigin(resized.origin, map, resized.view))
    expect(resized.origin.x).toBe(rightEdge(resized))
    expect(resized.origin.x).not.toBe(panned.origin.x)
  })

  it('ignores Home while the party walks', async () => {
    const game = await games.open()
    const start = await game.newGame()
    const to = offsetToHex(11, 19)
    // Slower than life, so the walk lasts long enough to press Home during it.
    await game.page.evaluate(() => {
      window.__yomi!.speed = 0.25
    })
    await game.click(worldHexOnScreen(start, to))
    expect((await game.probe('World'))!.walking).toBe(true)
    await game.press('Home')
    expect((await game.probe('World'))!.walking).toBe(true)
    const arrived = await game.waitFor('World', (w) => !w.walking && w.world.turn !== start.world.turn)
    expect(arrived.partyAt).toEqual(to)
    expect(arrived.origin).toEqual(following(arrived))
  })

  /** The list down the right: one entry, selected, inside the strip; the view and the info panel end left of it. */
  async function expectPartyListLaidOut(game: Game, w: WorldProbe): Promise<void> {
    const { width } = await game.canvasSize()
    expect(w.parties).toHaveLength(1)
    const [entry] = w.parties
    expect(entry).toMatchObject({ id: 'party_1', selected: true, members: w.party.length })
    expect(entry.x).toBeGreaterThan(width - 80)
    expect(entry.x).toBeLessThan(width)
    expect(entry.y).toBeGreaterThan(64)
    expect(w.selectedParty).toBe('party_1')
    expect(w.view.x + w.view.width).toBeLessThanOrEqual(width - 80)
    await game.hover(worldHexOnScreen(w, w.partyAt))
    const hovered = await game.waitFor('World', (p) => p.infoRect !== null)
    expect(hovered.infoRect!.x + hovered.infoRect!.width).toBeLessThanOrEqual(width - 80)
  }

  it('lists the party down the right, clear of the view and the info panel, in the least window too', async () => {
    const game = await games.open()
    const start = await game.newGame()
    await expectPartyListLaidOut(game, start)

    await game.resize(840, 560)
    const small = await game.waitFor('World', (w) => w.view.width !== start.view.width)
    await expectPartyListLaidOut(game, small)
    // The footer's buttons are as before, left of the strip.
    expect(small.buttons.camp.visible).toBe(true)
    expect(small.buttons.camp.x).toBeLessThan(840 - 80)
  })

  it('centres the view on the party when its entry is clicked, moving no one and passing no time', async () => {
    const game = await games.open()
    const start = await game.newGame()

    // With no pan, a click changes nothing.
    await game.click(start.parties[0])
    expect((await game.waitFor('World')).origin).toEqual(start.origin)

    const panned = await pan(game, start, -40, -30)
    await game.click(panned.parties[0])
    const centred = await game.waitFor('World', (w) => w.origin.x === start.origin.x && w.origin.y === start.origin.y)
    expect(centred.partyAt).toEqual(panned.partyAt)
    expect(centred.world.turn).toBe(panned.world.turn)
    expect(centred.selectedParty).toBe('party_1')
  })

  it('tells of the party in the info panel while its entry is hovered', async () => {
    const game = await games.open()
    const start = await game.newGame()
    await game.hover(start.parties[0])
    const hovered = await game.waitFor('World', (w) => w.info !== '')
    expect(hovered.info.startsWith('Your party')).toBe(true)
    expect(hovered.info).toContain('3 members')
    expect(hovered.info).toContain('Click to centre the view on it.')
    expect(hovered.infoRect).not.toBeNull()
  })

  it('forgets the hovered entry when the pointer leaves the game or the menu opens', async () => {
    const game = await games.open()
    const start = await game.newGame()
    await game.hover(start.parties[0])
    await game.waitFor('World', (w) => w.info.startsWith('Your party'))
    // Leaving the window, as the browser reports it.
    await game.page.evaluate(() => {
      document.querySelector('canvas')!.dispatchEvent(new MouseEvent('mouseout', { bubbles: true, relatedTarget: null }))
    })
    await game.frames()
    await game.waitFor('World', (w) => w.info === '')

    // Back over the entry from elsewhere, so it hears the pointer come.
    await game.hover({ x: start.parties[0].x - 120, y: start.parties[0].y })
    await game.hover(start.parties[0])
    await game.waitFor('World', (w) => w.info.startsWith('Your party'))
    await game.press('Escape')
    await game.waitForScenes(['Menu'], ['World'])
    expect((await game.probe('World'))!.info).toBe('')
    await game.press('Escape')
    await game.waitForScenes(['World'])
  })

  it('ignores a click on the party’s entry while the party walks', async () => {
    const game = await games.open()
    const start = await game.newGame()
    const to = offsetToHex(11, 19)
    await game.page.evaluate(() => {
      window.__yomi!.speed = 0.25
    })
    await game.click(worldHexOnScreen(start, to))
    expect((await game.probe('World'))!.walking).toBe(true)
    await game.click(start.parties[0])
    expect((await game.probe('World'))!.walking).toBe(true)
    const arrived = await game.waitFor('World', (w) => !w.walking && w.world.turn !== start.world.turn)
    expect(arrived.partyAt).toEqual(to)
    expect(arrived.origin).toEqual(following(arrived))
  })

  it('neither pans nor travels on a drag that starts on the party list', async () => {
    const game = await games.open()
    const start = await game.newGame()
    await game.drag(start.parties[0], midView(start))
    const after = await game.waitFor('World')
    expect(after.origin).toEqual(start.origin)
    expect(after.world.turn).toBe(start.world.turn)
    expect(after.walking).toBe(false)
    // A drag from the strip between entries is no map press either.
    await game.drag({ x: start.parties[0].x, y: start.parties[0].y + 120 }, midView(start))
    const between = await game.waitFor('World')
    expect(between.origin).toEqual(start.origin)
    expect(between.world.turn).toBe(start.world.turn)
  })

  it('marks the party’s entry while it stands before monsters, and names them on hover', async () => {
    const game = await games.open()
    await game.newGame()
    const among = await game.travelTo(RAIDERS.position)
    expect(among.parties[0].confronting).toBe(true)
    await game.hover(among.parties[0])
    const hovered = await game.waitFor('World', (w) => w.info.startsWith('Your party'))
    expect(hovered.info).toContain('Before the Goblin Raiders')
  })

  it('holds the party among monsters until it answers them', async () => {
    const game = await games.open()
    await game.newGame()
    const among = await game.travelTo(RAIDERS.position)
    expect(among.confronting).toBe(RAIDERS.id)
    expect(among.message).toContain('Goblin Raiders')
    expect(among.buttons.attack.visible).toBe(true)

    // No walking away from them.
    await game.click(worldHexOnScreen(among, offsetToHex(11, 19)))
    const held = (await game.probe('World'))!
    expect(held.walking).toBe(false)
    expect(held.partyAt).toEqual(RAIDERS.position)

    await game.click(among.buttons.wait)
    const waited = await game.waitFor('World', (w) => w.confronting === null)
    expect(waited.world.turn).toBe(among.world.turn + 1)
    await game.travelTo(offsetToHex(11, 19))
  })

  it('starts a battle when the party attacks', async () => {
    const game = await games.open()
    const battle = await game.enterBattle()
    expect(await game.scenes()).toEqual({ running: ['Battle'], paused: [] })
    expect(battle.state).toMatchObject({ round: 1, phase: 'player' })
    expect(battle.state.units.filter((u) => u.side === 'player')).toHaveLength(3)
    expect(battle.log[0]).toMatchObject({ type: 'battle_start', seed: 1, meta: { source: 'game', party: 'party_1' } })
  })

  it('puts a beaten location’s loot in the baggage, from which a hero takes it and wears it', async () => {
    const game = await games.open()
    await game.enterBattle()
    const over = await game.fightBattle()
    expect(over.state.winner).toBe('player')
    // The first nest's seed also rolls a rune, named after the item on the same line (steps 07 and 08).
    expect(over.result.at(-1)).toBe('Found: Ring of Protection and Lesser Life Rune.')
    await game.click(over.buttons.result)
    await game.waitForScenes(['World'])

    const world = await game.waitFor('World')
    await game.click(world.party[0])
    await game.waitForScenes(['Inventory'], ['World'])
    await game.press('i')
    const before = await game.waitFor('Inventory', (p) => p.tab === 'inventory')
    expect(before.ground.map((slot) => slot.item)).toEqual(['ring_protection'])
    expect(before.equipment.ring1.item).toBeNull()

    // A click on an item in the baggage takes it, and a click on it in the backpack puts it on.
    await game.click(before.ground[0])
    const taken = await game.waitFor('Inventory', (p) => p.ground.length === 0)
    const ring = taken.backpack.find((slot) => slot.item === 'ring_protection')!
    expect(ring).toBeDefined()
    await game.click(ring)
    const worn = await game.waitFor('Inventory', (p) => p.equipment.ring1.item === 'ring_protection')
    expect(worn.armorClass).toBe(before.armorClass + 5)

    // Another hero takes over what the first puts back in the baggage.
    await game.page.mouse.click(worn.equipment.ring1.x, worn.equipment.ring1.y, { button: 'right' })
    const dropped = await game.waitFor('Inventory', (p) => p.ground.length === 1 && p.armorClass === before.armorClass)
    expect(dropped.equipment.ring1.item).toBeNull()
    await game.click(dropped.party[2])
    const other = await game.waitFor('Inventory', (p) => p.party[2].active)
    expect(other.ground.map((slot) => slot.item)).toEqual(['ring_protection'])

    await game.press('Escape')
    await game.waitForScenes(['World'])
  })

  it('camps only away from monsters, and camps until the party’s wounds are healed', async () => {
    const game = await games.open()
    const home = await game.newGame()
    expect(home.buttons.camp.visible).toBe(true)
    expect(home.buttons.campUntilHealed.enabled).toBe(false)
    await game.click(home.buttons.camp)
    const rested = await game.waitFor('World', (w) => w.world.turn === 2)
    expect(rested.message).toContain('You camp a day')

    const among = await game.travelTo(RAIDERS.position)
    expect(among.buttons.camp.visible).toBe(false)
    expect(among.buttons.campUntilHealed.visible).toBe(false)
    await game.click(among.buttons.wait)
    await game.waitFor('World', (w) => w.confronting === null)
    await game.travelTo(offsetToHex(11, 19))

    // Wounded as a battle leaves a party: planted in the save, and loaded.
    await game.page.evaluate(() => {
      const save = JSON.parse(localStorage.getItem('yomi.save.1')!)
      save.game.parties[0].members[0].hp = 1
      save.game.parties[0].members[1].hp = 2
      localStorage.setItem('yomi.save.1', JSON.stringify(save))
    })
    await game.click((await game.reload()).buttons.continue)
    await game.waitForScenes(['World'])
    const hurt = await game.settled('World', (w) => w.buttons.campUntilHealed.enabled)
    await game.click(hurt.buttons.campUntilHealed)
    const healed = await game.waitFor('World', (w) => !w.buttons.campUntilHealed.enabled)
    expect(healed.message).toMatch(/^Camped \d+ days?: \d+ hp healed \(\d+ by rest, \d+ by spells\)\.$/)
    expect(healed.world.turn).toBeGreaterThan(hurt.world.turn)
  })

  describe('the time controls', () => {
    const order = (w: WorldProbe) => w.parties[0].order

    it('passes a day on Next day, the idle party staying idle', async () => {
      const game = await games.open()
      const home = await game.newGame()
      expect(order(home)).toBe('Idle')
      expect(home.buttons.nextDay.visible).toBe(true)
      expect(home.buttons.untilSomething.visible).toBe(true)
      await game.click(home.buttons.nextDay)
      const next = await game.waitFor('World', (w) => w.world.turn === home.world.turn + 1)
      expect(order(next)).toBe('Idle')
      expect(next.partyAt).toEqual(home.partyAt)
      expect(next.message).not.toBe('')
    })

    it('carries a walk cut short on, a hex a day, the line saying where', async () => {
      const game = await games.open()
      const home = await game.newGame()
      const far = offsetToHex(19, 19)
      await game.click(worldHexOnScreen(home, far))
      const stopped = await game.waitFor('World', (w) => !w.walking && w.world.turn > home.world.turn)
      expect(stopped.partyAt).not.toEqual(far)
      expect(order(stopped)).toMatch(/^Travelling/)
      await game.click(stopped.buttons.nextDay)
      const next = await game.waitFor('World', (w) => w.world.turn === stopped.world.turn + 1 && !w.walking)
      // Exactly one hex along the road: a neighbour of where it stood.
      expect(hexDistance(next.partyAt, stopped.partyAt)).toBe(1)
      expect(next.world.turn).toBe(stopped.world.turn + 1)
      expect(order(next)).toMatch(/^Travelling/)
    })

    it('passes days until something happens, or until thirty have passed quietly', async () => {
      const game = await games.open()
      const home = await game.newGame()
      await game.click(home.buttons.untilSomething)
      const after = await game.waitFor('World', (w) => w.world.turn > home.world.turn)
      expect(after.world.turn - home.world.turn).toBeLessThanOrEqual(30)
      // Either thirty quiet days, or something told: a lone first-day event has no "After" prefix.
      if (after.message.startsWith('30 days passed quietly.')) expect(after.world.turn - home.world.turn).toBe(30)
      else {
        expect(after.message).toMatch(/^(After \d+ days: )?\S/)
        expect(after.message).not.toMatch(/quiet day/i)
      }
    })

    it('shows Camping while a wounded party camps, and Idle once it is whole', async () => {
      const game = await games.open()
      await game.newGame()
      // A camp order planted in the save, with a wounded member, and loaded.
      await game.page.evaluate(() => {
        const save = JSON.parse(localStorage.getItem('yomi.save.1')!)
        save.game.parties[0].members[0].hp = 1
        save.game.parties[0].order = { kind: 'camp' }
        localStorage.setItem('yomi.save.1', JSON.stringify(save))
      })
      await game.click((await game.reload()).buttons.continue)
      await game.waitForScenes(['World'])
      const hurt = await game.settled('World', (w) => w.buttons.campUntilHealed.enabled)
      expect(order(hurt)).toBe('Camping')
      await game.click(hurt.buttons.nextDay)
      const healed = await game.waitFor('World', (w) => w.world.turn > hurt.world.turn && !w.buttons.campUntilHealed.enabled)
      expect(order(healed)).toBe('Idle')
    })

    it('hides both buttons while the party stands before monsters, and after it scouts them', async () => {
      const game = await games.open()
      await game.newGame()
      const among = await game.travelTo(RAIDERS.position)
      expect(among.buttons.nextDay.visible).toBe(false)
      expect(among.buttons.untilSomething.visible).toBe(false)
      expect(among.parties[0].order).toBe(`Before the Goblin Raiders`)
      // Scouting answers the monsters, but the party still stands among them: Scout, Wait and Attack are all the footer offers.
      await game.click(among.buttons.scout)
      const scouted = await game.waitFor('World', (w) => w.world.turn === among.world.turn + 1)
      expect(scouted.confronting).toBeNull()
      expect(scouted.buttons.attack.visible).toBe(true)
      expect(scouted.buttons.nextDay.visible).toBe(false)
      expect(scouted.buttons.untilSomething.visible).toBe(false)
    })

    /** Slows the game below life speed, so that a walk lasts long enough to be seen under way however slow the frames. */
    const slowly = (game: Game) => game.page.evaluate(() => (window.__yomi!.speed = 0.2))
    const savedTurn = (game: Game) => game.page.evaluate(() => JSON.parse(localStorage.getItem('yomi.save.1')!).game.world.turn as number)

    it('draws what is left of a walk cut short until it arrives, across a reload', async () => {
      const game = await games.open()
      const home = await game.newGame()
      const far = offsetToHex(19, 19)
      await game.click(worldHexOnScreen(home, far))
      await game.waitFor('World', (w) => !w.walking && w.world.turn > home.world.turn)
      // Off the map, nothing is hovered: the standing route is drawn, from where the party stands to where it was going.
      await game.hover({ x: 0, y: 0 })
      const stopped = await game.waitFor('World', (w) => w.standingRoute.length > 0)
      expect(order(stopped)).toMatch(/^Travelling/)
      expect(hexDistance(stopped.standingRoute[0], stopped.partyAt)).toBe(1)
      // A hovered hex draws its own route in its place, and the standing route comes back when the hover ends.
      await game.hover(worldHexOnScreen(stopped, home.partyAt))
      expect((await game.waitFor('World', (w) => w.standingRoute.length === 0)).walking).toBe(false)
      await game.hover({ x: 0, y: 0 })
      await game.waitFor('World', (w) => w.standingRoute.length === stopped.standingRoute.length)

      await game.click((await game.reload()).buttons.continue)
      await game.waitForScenes(['World'])
      const loaded = await game.settled('World')
      await game.hover({ x: 0, y: 0 })
      const reloaded = await game.waitFor('World', (w) => w.standingRoute.length > 0)
      expect(reloaded.standingRoute).toEqual(stopped.standingRoute)
      expect(loaded.partyAt).toEqual(stopped.partyAt)

      // Days pass until the walk is done; the order ends and its route with it.
      let world = reloaded
      while (order(world).startsWith('Travelling') && world.buttons.untilSomething.visible) {
        await game.click(world.buttons.untilSomething)
        world = await game.waitFor('World', (w) => !w.walking && w.world.turn > world.world.turn)
      }
      expect(world.standingRoute).toEqual([])
    })

    it('says the party is travelling while its walk plays, and has saved the days walked', async () => {
      const game = await games.open()
      const home = await game.newGame()
      await slowly(game)
      await game.click(worldHexOnScreen(home, offsetToHex(19, 19)))
      const walking = await game.waitFor('World', (w) => w.walking)
      expect(order(walking)).toMatch(/^Travelling/)
      expect(await savedTurn(game)).toBe(walking.world.turn)
      const stopped = await game.waitFor('World', (w) => !w.walking)
      expect(order(stopped)).toMatch(/^(Travelling|Idle$)/)
    })

    it('says the party is travelling while Next day and Until something happens play its walk, and saves before', async () => {
      const game = await games.open()
      const home = await game.newGame()
      const far = offsetToHex(19, 19)
      await game.click(worldHexOnScreen(home, far))
      const stopped = await game.waitFor('World', (w) => !w.walking && w.world.turn > home.world.turn)
      expect(order(stopped)).toMatch(/^Travelling/)
      await slowly(game)
      for (const button of ['nextDay', 'untilSomething'] as const) {
        const before = await game.waitFor('World', (w) => !w.walking)
        if (!order(before).startsWith('Travelling')) break
        await game.click(before.buttons[button])
        const walking = await game.waitFor('World', (w) => w.walking)
        expect(order(walking)).toMatch(/^Travelling/)
        expect(await savedTurn(game)).toBe(walking.world.turn)
        expect(walking.world.turn).toBeGreaterThan(before.world.turn)
      }
    })

    it('fits the footer and the order line in the least window', async () => {
      const game = await games.open()
      await game.newGame()
      await game.resize(840, 560)
      const small = await game.waitFor('World', (w) => w.view.width < 700)
      for (const button of [small.buttons.nextDay, small.buttons.untilSomething, small.buttons.camp, small.buttons.campUntilHealed, small.buttons.craft, small.buttons.enterEncampment]) {
        expect(button.visible).toBe(true)
        expect(button.x).toBeGreaterThan(80)
        expect(button.x).toBeLessThan(840 - 80)
        expect(button.y).toBeLessThan(560)
      }
      expect(small.buttons.nextDay.y).toBeLessThan(small.buttons.camp.y)
    })
  })

  it('pauses under the menu on Esc and resumes where it was', async () => {
    const game = await games.open()
    await game.newGame()
    const before = await game.travelTo(offsetToHex(11, 19))

    await game.press('Escape')
    await game.waitForScenes(['Menu'], ['World'])
    const menu = await game.waitFor('Menu')
    expect(menu.buttons.continue.enabled).toBe(true)
    await game.click(menu.buttons.continue)
    await game.waitForScenes(['World'])
    expect((await game.probe('World'))!.world).toEqual(before.world)

    // Esc closes the menu as well as opening it.
    await game.press('Escape')
    await game.waitForScenes(['Menu'], ['World'])
    await game.press('Escape')
    await game.waitForScenes(['World'])
  })

  /** A new game saved in slot 1, its world's status changed there and the page reloaded on it, as the game would leave it. */
  /** The game in slot 1 with `changes` made to its world, reloaded and continued. */
  async function reloadedWith(game: Game, changes: Partial<WorldState>): Promise<WorldProbe> {
    await game.page.evaluate((changes) => {
      const saved = JSON.parse(localStorage.getItem('yomi.save.1')!)
      Object.assign(saved.game.world, changes)
      localStorage.setItem('yomi.save.1', JSON.stringify(saved))
    }, changes)
    const menu = await game.reload()
    await game.click(menu.buttons.continue)
    await game.waitForScenes(['World'])
    return game.settled('World')
  }

  async function reloadedAs(game: Game, status: WorldStatus): Promise<WorldProbe> {
    await game.newGame()
    return reloadedWith(game, { status })
  }

  describe('a company of parties', () => {
    type Planted = { id: string; name: string; at: Hex; members?: number; order?: unknown; confronting?: string | null }
    /**
     * A new game whose slot is given more parties, each a copy of the first
     * (its heroes renamed), standing and ordered as told (with every monster
     * known, if `sightAll`), then reloaded and continued: a company as the
     * guild hall would form it.
     */
    async function company(game: Game, parties: Planted[], first: Partial<Planted> & { position?: Hex } = {}, sightAll = false): Promise<WorldProbe> {
      await game.newGame()
      await game.page.evaluate(
        ({ parties, first, sightAll }) => {
          const saved = JSON.parse(localStorage.getItem('yomi.save.1')!)
          const lead = saved.game.parties[0]
          Object.assign(lead, first)
          for (const planted of parties) {
            const party = JSON.parse(JSON.stringify(lead))
            party.members = party.members.slice(0, planted.members ?? party.members.length)
            for (const member of party.members) member.name = `${member.name}${planted.id.slice(-1)}`
            Object.assign(party, { id: planted.id, name: planted.name, position: planted.at, order: planted.order ?? { kind: 'idle' }, confronting: planted.confronting ?? null, baggage: [] })
            saved.game.parties.push(party)
          }
          saved.game.world.guildHall = 5
          // Every monster known, so that no sighting is what a day tells.
          if (sightAll) saved.game.world.sighted = saved.game.world.locations.filter((l: { kind: string }) => l.kind === 'monsters').map((l: { id: string }) => l.id)
          localStorage.setItem('yomi.save.1', JSON.stringify(saved))
        },
        { parties, first, sightAll },
      )
      const menu = await game.reload()
      await game.click(menu.buttons.continue)
      await game.waitForScenes(['World'])
      return game.settled('World', (w) => w.figures.length === parties.length + 1)
    }
    const at = (col: number, row: number) => offsetToHex(col, row)
    const walk = (...hexes: Hex[]) => ({ kind: 'travel', to: hexes.at(-1)!, route: hexes })
    /** A company whose second party stands before the Goblin Raiders, the first (at `first`'s hex, else at home) selected again after the load opened on the second. */
    async function blockedCompany(game: Game, first: { position?: Hex } = {}): Promise<WorldProbe> {
      const opened = await company(game, [{ id: 'party_2', name: 'Second Company', at: RAIDERS.position, confronting: RAIDERS.id }], first)
      expect(opened.selectedParty).toBe('party_2')
      await game.click(opened.parties[0])
      return game.waitFor('World', (w) => w.selectedParty === 'party_1')
    }
    const BLOCKED = 'Second Company stands before the Goblin Raiders: scout, wait or attack.'

    it('draws every party with its banner and lists each by its name', async () => {
      const game = await games.open()
      const world = await company(game, [
        { id: 'party_2', name: 'Second Company', at: at(9, 19) },
        { id: 'party_3', name: 'Third Company', at: at(11, 19), members: 1 },
      ])
      expect(world.parties.map((p) => [p.id, p.name, p.label, p.banner, p.members])).toEqual([
        ['party_1', 'First Company', 'First Co.', 1, 3],
        ['party_2', 'Second Company', 'Second Co.', 2, 3],
        ['party_3', 'Third Company', 'Third Co.', 3, 1],
      ])
      expect(world.figures.map((f) => f.id)).toEqual(['party_1', 'party_2', 'party_3'])
      // Two on one hex are drawn side by side.
      const [first, second, third] = world.figures
      expect(first.at).toEqual(second.at)
      expect(first.screen.y).toBe(second.screen.y)
      expect(second.screen.x - first.screen.x).toBe(FIGURE_SPREAD)
      expect(third.screen.x).toBe(worldHexOnScreen(world, third.at).x)
      await game.hover(worldHexOnScreen(world, at(9, 19)))
      const told = await game.waitFor('World', (w) => w.info.includes('Second Company:'))
      expect(told.info).toContain('First Company:')
    })

    it('moves every party on Until something happens, then selects the one whose arrival stopped the days and names it', async () => {
      const game = await games.open()
      const world = await company(
        game,
        [{ id: 'party_2', name: 'Second Company', at: at(9, 19), order: walk(at(10, 19), at(11, 19)) }],
        { order: walk(at(8, 19), at(7, 19), at(6, 19), at(5, 19)) },
      )
      expect(world.selectedParty).toBe('party_1')
      await game.click(world.buttons.untilSomething)
      const stopped = await game.waitFor('World', (w) => !w.walking && w.world.turn > world.world.turn)
      expect(stopped.selectedParty).toBe('party_2')
      expect(stopped.parties[1].selected).toBe(true)
      expect(stopped.message).toMatch(/^Second Company(, after 2 days)?: arrived/)
      expect(stopped.figures.find((f) => f.id === 'party_2')!.at).toEqual(at(11, 19))
      expect(stopped.figures.find((f) => f.id === 'party_1')!.at).toEqual(at(7, 19))
      expect(stopped.partyAt).toEqual(at(11, 19))
    })

    it('opens a load on the party that stands before monsters, naming it', async () => {
      const game = await games.open()
      const opened = await company(game, [{ id: 'party_2', name: 'Second Company', at: RAIDERS.position, confronting: RAIDERS.id }])
      expect(opened.selectedParty).toBe('party_2')
      expect(opened.message).toBe(`Second Company stands before the Goblin Raiders (threat 1).`)
      expect([opened.buttons.scout.visible, opened.buttons.wait.visible, opened.buttons.attack.visible]).toEqual([true, true, true])
    })

    it('refuses the days while another party stands before monsters, selecting it with Scout, Wait and Attack', async () => {
      const game = await games.open()
      const world = await blockedCompany(game)
      expect(world.parties[1].confronting).toBe(true)
      await game.click(world.buttons.nextDay)
      const refused = await game.waitFor('World', (w) => w.selectedParty === 'party_2')
      expect(refused.world.turn).toBe(world.world.turn)
      expect(refused.message).toBe('Second Company stands before the Goblin Raiders: scout, wait or attack.')
      expect([refused.buttons.scout.visible, refused.buttons.wait.visible, refused.buttons.attack.visible]).toEqual([true, true, true])
      expect(refused.buttons.nextDay.visible).toBe(false)
    })

    it('refuses a map click while another party stands before monsters, giving no order and selecting that party', async () => {
      const game = await games.open()
      const world = await blockedCompany(game)
      await game.click(worldHexOnScreen(world, at(9, 21)))
      const refused = await game.waitFor('World', (w) => w.selectedParty === 'party_2')
      expect(refused.message).toBe('Second Company stands before the Goblin Raiders: scout, wait or attack.')
      expect(refused.world.turn).toBe(world.world.turn)
      expect(refused.parties.map((p) => p.order)).toEqual(['Idle', 'Before the Goblin Raiders'])
      expect(refused.figures.map((f) => f.at)).toEqual(world.figures.map((f) => f.at))
      // Nothing was ordered, so nothing waits in the save either.
      const menu = await game.reload()
      await game.click(menu.buttons.continue)
      await game.waitForScenes(['World'])
      const reloaded = await game.settled('World', (w) => w.figures.length === 2)
      expect(reloaded.parties.map((p) => p.order)).toEqual(['Idle', 'Before the Goblin Raiders'])
    })

    it('refuses Return home, Camp and Craft while another party stands before monsters, selecting that party each time', async () => {
      const game = await games.open()
      const world = await blockedCompany(game, { position: at(9, 21) })
      for (const button of ['home', 'camp', 'craft'] as const) {
        const before = button === 'home' ? world : await blockedAgain(game)
        expect(before.buttons[button].visible).toBe(true)
        await game.click(before.buttons[button])
        const refused = await game.waitFor('World', (w) => w.selectedParty === 'party_2')
        expect(refused.message).toBe(BLOCKED)
        expect(refused.world.turn).toBe(world.world.turn)
        expect(refused.walking).toBe(false)
        expect(refused.parties.map((p) => p.order)).toEqual(['Idle', 'Before the Goblin Raiders'])
      }
      // Craft opened nothing over the map.
      await game.waitForScenes(['World'])
    })

    /** Selects the first party again, after a refusal selected the second. */
    async function blockedAgain(game: Game): Promise<WorldProbe> {
      const now = await game.waitFor('World')
      await game.click(now.parties[0])
      return game.waitFor('World', (w) => w.selectedParty === 'party_1')
    }

    it('tells another party’s arrival on the day a party waits before monsters, and selects it', async () => {
      const game = await games.open()
      const world = await company(game, [{ id: 'party_2', name: 'Second Company', at: at(9, 19), order: walk(at(10, 19)) }], {
        position: RAIDERS.position,
        confronting: RAIDERS.id,
      }, true)
      expect(world.selectedParty).toBe('party_1')
      await game.click(world.buttons.wait)
      const waited = await game.waitFor('World', (w) => w.world.turn > world.world.turn)
      expect(waited.message).toMatch(/^You wait a turn\. The Goblin Raiders do not stir\. Second Company: arrived/)
      expect(waited.selectedParty).toBe('party_2')
      expect(waited.figures.find((f) => f.id === 'party_2')!.at).toEqual(at(10, 19))
    })

    it('sends the selected party to meet another on a click on its hex, the two ending on one hex', async () => {
      const game = await games.open()
      const world = await company(game, [{ id: 'party_2', name: 'Second Company', at: at(11, 19) }])
      const there = worldHexOnScreen(world, at(11, 19))
      await game.hover(there)
      const hovering = await game.waitFor('World', (w) => w.hint.startsWith('Meet Second Company'))
      expect(hovering.info).toContain('Second Company:')
      await game.click(there)
      const met = await game.waitFor('World', (w) => !w.walking && w.world.turn > world.world.turn)
      expect(met.partyAt).toEqual(at(11, 19))
      expect(met.figures.map((f) => f.at)).toEqual([at(11, 19), at(11, 19)])
      expect(met.message).toBe('First Company: met Second Company.')
      expect(met.parties.map((p) => p.order)).toEqual(['Idle', 'Idle'])
    })
  })

  it('walks the party home on Home, and garrisons a held site on Garrison, passing no day', async () => {
    const game = await games.open()
    const start = await game.newGame()
    // One party: its entry is unnamed, as before there were several.
    expect([start.parties[0].name, start.parties[0].label]).toEqual(['Your party', ''])
    expect(start.buttons.home.visible).toBe(false)
    expect(start.buttons.garrison.visible).toBe(false)
    // Iron Vein, held from the start.
    const vein = await game.travelTo(offsetToHex(11, 21))
    expect(vein.buttons.home.visible).toBe(true)
    expect(vein.buttons.garrison.visible).toBe(true)
    await game.click(vein.buttons.garrison)
    const holding = await game.waitFor('World', (w) => w.parties[0].order.startsWith('Garrisoning'))
    expect(holding.parties[0].order).toBe('Garrisoning Iron Vein')
    expect(holding.world.turn).toBe(vein.world.turn)
    expect(holding.message).toBe('The party garrisons Iron Vein until given another order.')
    expect(holding.buttons.garrison.visible).toBe(false)

    await game.click(holding.buttons.home)
    const walking = await game.waitFor('World', (w) => w.walking)
    expect(walking.parties[0].order).toBe('Returning home')
    const home = await game.waitFor('World', (w) => !w.walking && w.partyAt.q === start.partyAt.q && w.partyAt.r === start.partyAt.r)
    expect(home.parties[0].order).toBe('Idle')
    expect(home.buttons.home.visible).toBe(false)
    expect(home.buttons.enterEncampment.visible).toBe(true)
  })

  it('builds a watchtower on clean land with the stock, and says what it costs without', async () => {
    const game = await games.open()
    await game.newGame()
    const there = await game.travelTo(offsetToHex(7, 17))
    expect(there.buttons.buildTower.visible).toBe(true)
    await game.click(there.buttons.buildTower)
    const poor = await game.waitFor('World', (w) => w.message.includes('costs'))
    expect(poor.world.towers).toEqual([])

    const rich = await reloadedWith(game, { stock: { iron: 10, gold: 5 } })
    await game.click(rich.buttons.buildTower)
    const built = await game.waitFor('World', (w) => w.world.towers.length === 1)
    expect(built.message).toContain('A watchtower rises')
    // Spent, though the day's yield may have come in since.
    expect(built.world.stock.iron).toBeLessThan(10)
    expect(built.world.turn).toBe(rich.world.turn + 1)
    expect(built.buttons.buildTower.visible).toBe(false)
  })

  it('builds an outpost on a held site with the stock, and marks the site', async () => {
    const game = await games.open()
    await game.newGame()
    await reloadedWith(game, { stock: { gold: 15, timber: 10 } })
    // Iron Vein, held from the start.
    const there = await game.travelTo(offsetToHex(11, 21))
    expect(there.buttons.buildOutpost.visible).toBe(true)
    expect(there.buttons.buildTower.visible).toBe(false)
    await game.click(there.buttons.buildOutpost)
    const built = await game.waitFor('World', (w) => w.world.outposts.length === 1)
    expect(built.world.outposts).toEqual(['iron_vein'])
    expect(built.message).toContain('An outpost stands at Iron Vein')
    expect(built.buttons.buildOutpost.visible).toBe(false)
  })

  it('shows the victory once the Source is beaten, to end on or go on in endless mode', async () => {
    const game = await games.open()
    const won = await reloadedAs(game, 'won')
    expect(won.outcome).toMatch(/^VICTORY!/)
    expect([won.buttons.end.visible, won.buttons.endless.visible, won.buttons.camp.visible]).toEqual([true, true, false])

    await game.click(won.buttons.endless)
    const endless = await game.waitFor('World', (w) => w.world.status === 'endless')
    expect(endless.outcome).toBe('')
    expect(endless.buttons.end.visible).toBe(false)
    // The game kept is the one that goes on.
    expect(await game.page.evaluate(() => JSON.parse(localStorage.getItem('yomi.save.1')!).game.world.status)).toBe('endless')
  })

  it('ends on the menu with the save kept, when the player ends a won game', async () => {
    const game = await games.open()
    const won = await reloadedAs(game, 'won')
    await game.click(won.buttons.end)
    await game.waitForScenes(['Menu'])
    expect(await game.page.evaluate(() => JSON.parse(localStorage.getItem('yomi.save.1')!).game.world.status)).toBe('won')
  })

  it('keeps the party list under the outcome screen, taking no hover or click', async () => {
    const game = await games.open()
    const lost = await reloadedAs(game, 'lost')
    expect(lost.parties).toHaveLength(1)
    // Hovered above the shade, the entry would hear it; under it, the shade takes it.
    await game.hover(lost.parties[0])
    await game.frames()
    expect((await game.waitFor('World')).parties[0].hovered).toBe(false)
    await game.click(lost.parties[0])
    const after = await game.waitFor('World')
    expect(after.info).toBe('')
    expect(after.origin).toEqual(lost.origin)
  })

  it('ends the playthrough when the encampment falls, freeing its slot', async () => {
    const game = await games.open()
    const lost = await reloadedAs(game, 'lost')
    expect(lost.outcome).toMatch(/^DEFEAT/)
    expect(lost.buttons.menu.visible).toBe(true)
    expect(await game.page.evaluate(() => localStorage.getItem('yomi.save.1'))).toBeNull()
    await game.click(lost.buttons.menu)
    await game.waitForScenes(['Menu'])
  })
})
