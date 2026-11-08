import { describe, expect, it } from 'vitest'
import { maxHp, maxMana } from '../character/character.ts'
import { hexEquals, offsetToHex, type Hex } from '../grid/hex.ts'
import { itemById } from '../inventory/inventory.ts'
import { boardIndex } from './blight.ts'
import { campUntilHealed, partyWounded } from './camp.ts'
import { UNTIL_LIMIT, act, advance, advanceRefusal, orderAction, passDay, setOrder, startTravel, worldInterrupt, type DayReport } from './company.ts'
import { presences, type DayAction } from './expedition.ts'
import { newGame, type GameState } from './gameState.ts'
import type { ItemPlace } from './itemPlace.ts'
import { readyMadeParty } from './party.ts'
import { passTurn, routeTo, travel, type MonsterLocation, type WorldState } from './worldMap.ts'

/** A new game on world 1 with the ready-made three: the game, its world and its one party. */
function fresh() {
  const game = newGame(readyMadeParty(), null, 1)
  return { game, world: game.world, party: game.parties[0] }
}

/** A fresh game whose monsters are all known, so that no sighting cuts a walk short. */
function quiet() {
  const out = fresh()
  out.world.sighted = out.world.locations.filter((l) => l.kind === 'monsters').map((l) => l.id)
  return out
}

/** A nest of the goblins' encounter put down at `at`, known to the player. */
function nestAt(world: WorldState, id: string, at: Hex, threat = 1): MonsterLocation {
  const nest: MonsterLocation = { id, kind: 'monsters', name: 'Nest', position: at, encounter: 'goblin_raid', threat, loot: [] }
  world.locations.push(nest)
  world.sighted.push(id)
  return nest
}

/** A threat-5 nest beside the Gold Seam, which threatens it from the first day. */
function besiegeGoldSeam(world: WorldState): void {
  const seam = world.locations.find((l) => l.id === 'gold_seam')!.position
  nestAt(world, 'besiegers', { q: seam.q + 2, r: seam.r }, 5)
}

const NEAR = () => offsetToHex(3, 1)

describe('passDay with one party', () => {
  it('passes one turn for an idle party, giving what passTurn alone gives, and leaves it where it is', () => {
    const { game, world, party } = fresh()
    const twin = structuredClone(game)
    const expected = passTurn(twin.world, presences(twin.parties))
    const report = passDay(game)!
    expect(report.events).toEqual(expected)
    expect(world.turn).toBe(2)
    expect(world).toEqual(twin.world)
    expect(party.position).toEqual(twin.parties[0].position)
    expect(report.partyEvents).toEqual([])
    expect(report.parties).toEqual([{ party: party.id, walked: null, rested: 0, cast: 0, made: null }])
  })

  it('walks a travel order a hex a day along its planned route, arriving idle', () => {
    const { game, party } = quiet()
    const to = NEAR()
    const route = routeTo(game.world, party, to)!
    expect(setOrder(game, party.id, { kind: 'travel', to })).toBeNull()
    const reports: DayReport[] = []
    for (let day = 0; day < route.length; day++) reports.push(passDay(game)!)
    expect(reports.map((r) => r.parties[0].walked)).toEqual(route)
    expect(reports.slice(0, -1).every((r) => r.partyEvents.length === 0)).toBe(true)
    expect(reports.at(-1)!.partyEvents).toEqual([{ type: 'arrived', party: party.id, at: to }])
    expect(reports.at(-1)!.interrupt).toEqual({ party: party.id, event: { type: 'arrived', party: party.id, at: to } })
    expect(party.position).toEqual(to)
    expect(party.order).toEqual({ kind: 'idle' })
    expect(party.confronting).toBeNull()
  })

  it('confronts the monsters a travel order arrives at', () => {
    const { game, world, party } = quiet()
    const at = { q: party.position.q + 1, r: party.position.r }
    nestAt(world, 'close_nest', at)
    setOrder(game, party.id, { kind: 'travel', to: at })
    const report = passDay(game)!
    expect(report.partyEvents).toEqual([
      { type: 'arrived', party: party.id, at },
      { type: 'confronting', party: party.id, location: 'close_nest' },
    ])
    expect(party.confronting).toBe('close_nest')
    expect(party.order).toEqual({ kind: 'idle' })
  })

  it('ends a travel order, without moving, where a nest has come onto the road', () => {
    const { game, world, party } = quiet()
    setOrder(game, party.id, { kind: 'travel', to: NEAR() })
    const route = party.order.kind === 'travel' ? [...party.order.route] : []
    nestAt(world, 'road_nest', route[1])
    const first = passDay(game)!
    expect(first.parties[0].walked).toEqual(route[0])
    expect(first.partyEvents).toEqual([{ type: 'order_done', party: party.id }])
    expect(party.order).toEqual({ kind: 'idle' })
    const second = passDay(game)!
    expect(second.parties[0].walked).toBeNull()
    expect(party.position).toEqual(route[0])
  })

  it('rests and heals a camping party each day, filling mana, and ends the order once whole', () => {
    const { game, party } = fresh()
    const [aldric, , delwyn] = party.members
    aldric.hp = maxHp(aldric) - 8
    delwyn.mana = 0
    expect(setOrder(game, party.id, { kind: 'camp' })).toBeNull()
    const first = passDay(game)!
    expect(first.parties[0]).toMatchObject({ rested: 1 })
    expect(first.parties[0].cast).toBeGreaterThan(0)
    expect(first.partyEvents).toEqual([])
    expect(party.order).toEqual({ kind: 'camp' })
    const reports = [first, ...advance(game, Infinity)]
    expect(partyWounded(party.members)).toBe(false)
    expect(reports.at(-1)!.partyEvents).toEqual([{ type: 'order_done', party: party.id }])
    expect(reports.reduce((sum, r) => sum + r.parties[0].rested + r.parties[0].cast, 0)).toBe(8)
    expect(party.order).toEqual({ kind: 'idle' })
    expect(delwyn.mana).toBeLessThanOrEqual(maxMana(delwyn))
  })

  it('fills every caster’s mana when it rests', () => {
    const { game, party } = fresh()
    const [aldric, , delwyn] = party.members
    aldric.hp = 1
    delwyn.hp = maxHp(delwyn) - 1
    delwyn.mana = 0
    setOrder(game, party.id, { kind: 'camp' })
    passDay(game)
    // Rested, filled, then the heals spent some of it.
    expect(delwyn.hp).toBe(maxHp(delwyn))
    expect(delwyn.mana).toBeLessThan(maxMana(delwyn))
    expect(delwyn.mana).toBeGreaterThanOrEqual(0)
  })

  it('ends a camp order when the game ends', () => {
    const { game, world, party } = fresh()
    party.members[0].hp = 1
    setOrder(game, party.id, { kind: 'camp' })
    let turn = world.turn
    Object.defineProperty(world, 'turn', {
      get: () => turn,
      set: (next: number) => {
        turn = next
        world.status = 'lost'
      },
    })
    const report = passDay(game)!
    expect(report.partyEvents).toEqual([{ type: 'order_done', party: party.id }])
    expect(party.order).toEqual({ kind: 'idle' })
  })
})

describe('setOrder', () => {
  it('refuses a party it does not know', () => {
    const { game } = fresh()
    expect(setOrder(game, 'party_9', { kind: 'idle' })).toMatch(/party_9/)
  })

  it('refuses travel with no route, or while confronting, or once the game is over', () => {
    const { game, world, party } = fresh()
    expect(setOrder(game, party.id, { kind: 'travel', to: offsetToHex(-1, 0) })).not.toBeNull()
    expect(setOrder(game, party.id, { kind: 'travel', to: party.position })).not.toBeNull()
    party.confronting = 'goblin_raiders'
    expect(setOrder(game, party.id, { kind: 'travel', to: NEAR() })).not.toBeNull()
    party.confronting = null
    world.status = 'lost'
    expect(setOrder(game, party.id, { kind: 'travel', to: NEAR() })).not.toBeNull()
    expect(party.order).toEqual({ kind: 'idle' })
  })

  it('refuses to camp where the party cannot', () => {
    const { game, world, party } = fresh()
    world.status = 'lost'
    expect(setOrder(game, party.id, { kind: 'camp' })).not.toBeNull()
    expect(party.order).toEqual({ kind: 'idle' })
  })

  it('always gives the idle order, replacing the one before', () => {
    const { game, party } = fresh()
    setOrder(game, party.id, { kind: 'camp' })
    expect(setOrder(game, party.id, { kind: 'idle' })).toBeNull()
    expect(party.order).toEqual({ kind: 'idle' })
  })

  it('plans the route routeTo gives, ending on the destination', () => {
    const { game, world, party } = fresh()
    const to = offsetToHex(30, 5)
    const route = routeTo(world, party, to)
    setOrder(game, party.id, { kind: 'travel', to })
    expect(party.order).toEqual({ kind: 'travel', to, route })
  })
})

describe('advance', () => {
  it('stops on the first notable event, naming the party a nearby sighting concerns', () => {
    const { game, party } = fresh()
    setOrder(game, party.id, { kind: 'travel', to: offsetToHex(40, 20) })
    const reports = advance(game)
    const last = reports.at(-1)!
    expect(reports.slice(0, -1).every((r) => r.interrupt === null)).toBe(true)
    expect(last.interrupt).toMatchObject({ party: party.id, event: { type: 'sighted' } })
    expect(last.events).toContain(last.interrupt!.event)
  })

  it('names no party for a site event', () => {
    const { game, world } = quiet()
    besiegeGoldSeam(world)
    const reports = advance(game)
    expect(reports).toHaveLength(1)
    expect(reports[0].interrupt).toMatchObject({ party: null, event: { type: 'site_threatened', site: 'gold_seam' } })
  })

  it('stops on an order ending', () => {
    const { game, party } = quiet()
    party.members[0].hp = maxHp(party.members[0]) - 2
    party.members.pop()
    setOrder(game, party.id, { kind: 'camp' })
    const reports = advance(game)
    expect(reports).toHaveLength(2)
    expect(reports[1].interrupt).toEqual({ party: party.id, event: { type: 'order_done', party: party.id } })
  })

  it('stops when the game stops', () => {
    const { game, world } = quiet()
    let turn = world.turn
    Object.defineProperty(world, 'turn', {
      get: () => turn,
      set: (next: number) => {
        turn = next
        if (next === 4) world.status = 'won'
      },
    })
    expect(advance(game)).toHaveLength(3)
    expect(advanceRefusal(game)).not.toBeNull()
    expect(advance(game)).toEqual([])
  })

  it('stops at its limit, UNTIL_LIMIT by default, for an idle party in a quiet land', () => {
    const { game, world } = quiet()
    // Nothing but the blight's own days in a land watched over everywhere.
    const reports = advance(game)
    expect(reports.every((r) => r.interrupt === null)).toBe(true)
    expect(reports).toHaveLength(UNTIL_LIMIT)
    expect(world.turn).toBe(1 + UNTIL_LIMIT)
    expect(advance(game, 3)).toHaveLength(3)
  })

  it('passes no day while the party is confronting, and says why', () => {
    const { game, world, party } = quiet()
    party.confronting = 'goblin_raiders'
    expect(advanceRefusal(game)).toMatch(/before the Goblin Raiders/)
    party.confronting = 'blight_source'
    expect(advanceRefusal(game)).toMatch(/before the Blight Source:/)
    party.confronting = 'goblin_raiders'
    expect(advance(game)).toEqual([])
    expect(passDay(game)).toBeNull()
    expect(world.turn).toBe(1)
  })
})

describe('orders past an interrupt', () => {
  it('keep travelling: the order holds the rest of the route, and the next day walks on', () => {
    const { game, party } = fresh()
    const to = offsetToHex(40, 20)
    setOrder(game, party.id, { kind: 'travel', to })
    const planned = party.order.kind === 'travel' ? [...party.order.route] : []
    const walked = advance(game).length
    expect(walked).toBeLessThan(planned.length)
    expect(party.order).toEqual({ kind: 'travel', to, route: planned.slice(walked) })
    const next = passDay(game)!
    expect(next.parties[0].walked).toEqual(planned[walked])
  })

  it('keep camping after a site event breaks camp', () => {
    const { game, world, party } = quiet()
    party.members[0].hp = 1
    party.members.pop()
    besiegeGoldSeam(world)
    setOrder(game, party.id, { kind: 'camp' })
    expect(advance(game)).toHaveLength(1)
    expect(party.order).toEqual({ kind: 'camp' })
    expect(passDay(game)!.parties[0].rested).toBe(1)
  })
})

describe('travel on the loop', () => {
  it('gives the journey the loop walks, a day a hex', () => {
    const a = fresh()
    const b = fresh()
    const to = offsetToHex(40, 20)
    const journey = travel(a.game, a.party, to)
    setOrder(b.game, b.party.id, { kind: 'travel', to })
    const reports = advance(b.game, Infinity)
    expect(journey.walked).toEqual(reports.map((r) => r.parties[0].walked))
    expect(journey.events).toEqual(reports.flatMap((r) => r.events))
    expect(journey.interruptedBy).toEqual(reports.at(-1)!.interrupt!.event)
    expect(a.world).toEqual(b.world)
    expect(hexEquals(a.party.position, b.party.position)).toBe(true)
  })
})

/** A party in a quiet land given a standing travel order, so that a refusal can be seen to leave it. */
function withStandingOrder(it: ReturnType<typeof fresh>) {
  const to = offsetToHex(40, 20)
  it.party.order = { kind: 'travel', to, route: routeTo(it.world, it.party, to) ?? [] }
  return it
}

/** On clean, empty land near home, with the stock for a watchtower. */
function onCleanLand() {
  const it = quiet()
  it.party.position = offsetToHex(7, 17)
  expect(it.world.blight[boardIndex(it.world.board, it.party.position)]).toBe(0)
  it.world.stock = { gold: 6, iron: 12 }
  return it
}

/** On the held Gold Seam, with the stock for an outpost. */
function onGoldSeam() {
  const it = quiet()
  it.world.held = [...new Set([...it.world.held, 'gold_seam'])]
  it.party.position = it.world.locations.find((l) => l.id === 'gold_seam')!.position
  it.world.stock = { gold: 20, timber: 12 }
  return it
}

/** A step off the encampment (the field), a Masterwork sword in the soldier's hand, a Lesser Stone Rune and gold and iron to work with. */
function inTheField() {
  const it = quiet()
  it.party.position = { q: it.party.position.q + 1, r: it.party.position.r }
  it.world.stock = { gold: 50, iron: 50 }
  it.game.runes = { stone1: 1 }
  it.party.members[0].equipment.mainHand = itemById('iron_sword@3')!
  const place: ItemPlace = { from: 'worn', party: it.party.id, member: 0, slot: 'mainHand', itemId: 'iron_sword@3' }
  return { ...it, place }
}

/** Standing before a nest beside it, confronting it. */
function confronting() {
  const it = quiet()
  const at = { q: it.party.position.q + 1, r: it.party.position.r }
  nestAt(it.world, 'close_nest', at)
  travel(it.game, it.party, at)
  expect(it.party.confronting).toBe('close_nest')
  return it
}

/** Expects `act` to pass one day, ending the day order idle with order_done, and returns its report. */
function actedDay(game: GameState, action: DayAction): DayReport {
  const party = game.parties[0]
  const turn = game.world.turn
  const report = act(game, party.id, action)
  if (typeof report === 'string') throw new Error(`refused: ${report}`)
  expect(game.world.turn).toBe(turn + 1)
  expect(party.order).toEqual({ kind: 'idle' })
  expect(report.partyEvents).toEqual([{ type: 'order_done', party: party.id }])
  return report
}

describe('act with one party', () => {
  it.each(['scout', 'wait'] as const)('lets a confronting party %s for a day, freeing it', (kind) => {
    const { game, party } = confronting()
    const twin = structuredClone(game)
    twin.parties[0].confronting = null
    const expected = passTurn(twin.world, presences(twin.parties))
    const report = actedDay(game, { kind })
    expect(report.events).toEqual(expected)
    expect(report.parties).toEqual([{ party: party.id, walked: null, rested: 0, cast: 0, made: null }])
    expect(party.confronting).toBeNull()
    expect(game.world).toEqual(twin.world)
  })

  it('camps a day: rests each member, fills the mana, casts nothing', () => {
    const { game, party } = quiet()
    party.members[0].hp = 5
    party.members[2].hp = 3
    party.members[2].mana = 0
    const report = actedDay(game, { kind: 'camp' })
    expect(report.parties[0]).toMatchObject({ rested: 2, cast: 0, made: null })
    expect(party.members.map((m) => m.hp)).toEqual([6, maxHp(party.members[1]), 4])
    expect(party.members[2].mana).toBe(maxMana(party.members[2]))
  })

  it('builds a watchtower, its event before the day’s', () => {
    const { game, world, party } = onCleanLand()
    const report = actedDay(game, { kind: 'tower' })
    expect(report.events[0]).toEqual({ type: 'tower_built', tower: 'tower_1', at: party.position })
    expect(report.events.slice(1).some((e) => e.type === 'tower_built')).toBe(false)
    expect(world.towers).toEqual([{ id: 'tower_1', position: party.position }])
    expect(world.stock).toEqual({ gold: 1, iron: 2 })
  })

  it('builds an outpost, its event before the day’s', () => {
    const { game, world } = onGoldSeam()
    const report = actedDay(game, { kind: 'outpost' })
    expect(report.events[0]).toEqual({ type: 'outpost_built', site: 'gold_seam', name: 'Gold Seam' })
    expect(world.outposts).toEqual(['gold_seam'])
    expect(world.stock).toEqual({ gold: 5, timber: 2 })
  })

  it('crafts in the field, recording the item it made', () => {
    const { game, party, place } = inTheField()
    const report = actedDay(game, { kind: 'craft', place, modifier: 'balanced', grade: 1 })
    const made = itemById('iron_sword@3+balanced1')
    expect(report.parties[0].made).toBe(made)
    expect(party.members[0].equipment.mainHand).toBe(made)
    expect(game.world.stock).toEqual({ gold: 45, iron: 45 })
  })

  it('embeds a Lesser rune in the field, recording the item it made', () => {
    const { game, party, place } = inTheField()
    const report = actedDay(game, { kind: 'embed', place, rune: 'stone1' })
    const made = itemById('iron_sword@3#stone1')
    expect(report.parties[0].made).toBe(made)
    expect(party.members[0].equipment.mainHand).toBe(made)
    expect(game.runes).toEqual({})
    expect(game.world.stock.gold).toBe(45)
  })
})

describe('act refused', () => {
  /** Expects `act` refused with a message matching `pattern`, the game unchanged, its standing order included. */
  function refused(game: GameState, party: string, action: DayAction, pattern: RegExp) {
    const before = JSON.stringify(game)
    expect(act(game, party, action)).toMatch(pattern)
    expect(JSON.stringify(game)).toBe(before)
  }

  it('for a party it does not know', () => {
    const { game } = withStandingOrder(quiet())
    refused(game, 'party_9', { kind: 'camp' }, /No party "party_9"/)
  })

  it.each(['scout', 'wait'] as const)('to %s away from monsters, or once the game is over', (kind) => {
    const { game, party } = withStandingOrder(quiet())
    refused(game, party.id, { kind }, /no monsters here/i)
    const over = confronting()
    over.world.status = 'lost'
    refused(over.game, over.party.id, { kind }, /game is over/)
  })

  it('to camp among monsters, or once the game is over', () => {
    const among = confronting()
    refused(among.game, among.party.id, { kind: 'camp' }, /cannot camp here/)
    const over = withStandingOrder(quiet())
    over.world.status = 'won'
    refused(over.game, over.party.id, { kind: 'camp' }, /cannot camp here/)
  })

  it('to build without the stock or on the wrong land', () => {
    const poor = withStandingOrder(onCleanLand())
    poor.world.stock = { gold: 5, iron: 9 }
    refused(poor.game, poor.party.id, { kind: 'tower' }, /more than the stock holds/)
    const site = withStandingOrder(onGoldSeam())
    refused(site.game, site.party.id, { kind: 'tower' }, /cannot stand on the encampment or a resource/)
    const land = withStandingOrder(onCleanLand())
    land.world.stock = { gold: 20, timber: 12 }
    refused(land.game, land.party.id, { kind: 'outpost' }, /held resource/)
  })

  it('to craft or embed at the workshop, which is no day’s work, or for a stale place', () => {
    const home = withStandingOrder(quiet())
    home.world.workshop = 1
    home.world.stock = { gold: 50, iron: 50 }
    home.game.runes = { stone1: 1 }
    home.party.members[0].equipment.mainHand = itemById('iron_sword@3')!
    const place: ItemPlace = { from: 'worn', party: home.party.id, member: 0, slot: 'mainHand', itemId: 'iron_sword@3' }
    refused(home.game, home.party.id, { kind: 'craft', place, modifier: 'balanced', grade: 1 }, /workshop/)
    refused(home.game, home.party.id, { kind: 'embed', place, rune: 'stone1' }, /workshop/)
    const field = inTheField()
    withStandingOrder(field)
    const stale = { ...field.place, itemId: 'iron_dagger' }
    refused(field.game, field.party.id, { kind: 'craft', place: stale, modifier: 'balanced', grade: 1 }, /no longer there/)
    refused(field.game, field.party.id, { kind: 'embed', place: stale, rune: 'stone1' }, /no longer there/)
    refused(field.game, field.party.id, { kind: 'embed', place: field.place, rune: 'ember1' }, /pouch holds no/)
  })

  it('while another party confronts monsters, for any action but its own scout or wait', () => {
    const { game, party } = withStandingOrder(quiet())
    game.parties.push({ ...structuredClone(party), id: 'party_2', confronting: 'goblin_raiders', order: { kind: 'idle' } })
    refused(game, party.id, { kind: 'camp' }, /Goblin Raiders/)
  })

  it('leaves passDay refused while confronting with any order but a scout or wait', () => {
    const { game, party } = confronting()
    party.order = { kind: 'day', action: { kind: 'camp' } }
    expect(passDay(game)).toBeNull()
    party.order = { kind: 'camp' }
    expect(advance(game)).toEqual([])
    expect(game.world.turn).toBe(2)
  })
})

describe('startTravel', () => {
  it('changes nothing for a refused order', () => {
    const { game, party } = withStandingOrder(confronting())
    const before = JSON.stringify(game)
    expect(startTravel(game, party, NEAR())).toBe('refused')
    expect(JSON.stringify(game)).toBe(before)
  })

  it('leaves the party idle, confronting what stands where it is, when a nest blocks the first hex', () => {
    const { game, world, party } = quiet()
    const route = routeTo(world, party, NEAR())!
    // A nest the player has not seen, which the route does not avoid.
    world.locations.push({ id: 'hidden_nest', kind: 'monsters', name: 'Nest', position: route[0], encounter: 'goblin_raid', threat: 1, loot: [] })
    expect(startTravel(game, party, NEAR())).toBe('blocked')
    expect(party.order).toEqual({ kind: 'idle' })
    expect(party.confronting).toBeNull()
    expect(world.turn).toBe(1)
  })

  it('confronts again the monsters it lingered at when the first hex is blocked', () => {
    const { game, world, party } = confronting()
    act(game, party.id, { kind: 'wait' })
    expect(party.confronting).toBeNull()
    const route = routeTo(world, party, NEAR())!
    world.locations.push({ id: 'hidden_nest', kind: 'monsters', name: 'Nest', position: route[0], encounter: 'goblin_raid', threat: 1, loot: [] })
    expect(startTravel(game, party, NEAR())).toBe('blocked')
    expect(party.confronting).toBe('close_nest')
  })

  it('gives the travel order and passes no day when the road is open', () => {
    const { game, world, party } = quiet()
    const route = routeTo(world, party, NEAR())!
    expect(startTravel(game, party, NEAR())).toBe('started')
    expect(party.order).toEqual({ kind: 'travel', to: NEAR(), route })
    expect(world.turn).toBe(1)
  })
})

describe('orderAction', () => {
  it('refuses what act refuses, with the same words, changing nothing', () => {
    const cases: Array<[ReturnType<typeof quiet>, string, DayAction]> = [
      [withStandingOrder(quiet()), 'party_9', { kind: 'camp' }],
      [withStandingOrder(quiet()), 'party_1', { kind: 'scout' }],
      [confronting(), 'party_1', { kind: 'camp' }],
      [withStandingOrder(onCleanLand()), 'party_1', { kind: 'outpost' }],
    ]
    for (const [it, id, action] of cases) {
      const twin = structuredClone(it.game)
      const before = JSON.stringify(it.game)
      const refusal = orderAction(it.game, id, action)
      expect(refusal).toBe(act(twin, id, action))
      expect(refusal).not.toBeNull()
      expect(JSON.stringify(it.game)).toBe(before)
    }
  })

  it('gives the day order and leaves the day to passDay, which does what act does', () => {
    const a = onCleanLand()
    const b = onCleanLand()
    expect(orderAction(a.game, a.party.id, { kind: 'tower' })).toBeNull()
    expect(a.party.order).toEqual({ kind: 'day', action: { kind: 'tower' } })
    expect(a.world.turn).toBe(1)
    expect(a.world.towers).toEqual([])
    const report = passDay(a.game)!
    expect(report).toEqual(act(b.game, b.party.id, { kind: 'tower' }))
    expect(a.game).toEqual(b.game)
  })

  it('lets two parties each take a day’s action, both done in one day', () => {
    const { game, world, party } = onCleanLand()
    const second = { ...structuredClone(party), id: 'party_2', name: 'Second Company', position: offsetToHex(3, 1) }
    second.members.forEach((m) => (m.hp = 1))
    game.parties.push(second)
    expect(orderAction(game, party.id, { kind: 'tower' })).toBeNull()
    expect(orderAction(game, 'party_2', { kind: 'camp' })).toBeNull()
    const report = passDay(game)!
    expect(world.turn).toBe(2)
    expect(world.towers).toEqual([{ id: 'tower_1', position: party.position }])
    expect(report.parties[1].rested).toBeGreaterThan(0)
    expect(report.partyEvents).toEqual([
      { type: 'order_done', party: party.id },
      { type: 'order_done', party: 'party_2' },
    ])
    expect(game.parties.map((p) => p.order)).toEqual([{ kind: 'idle' }, { kind: 'idle' }])
  })
})

describe('worldInterrupt', () => {
  it('tells a world event from a party event by its kind, not by which array holds it', () => {
    const { game } = quiet()
    const report = passDay(game)!
    const event = { type: 'site_threatened', site: 'gold_seam', name: 'Gold Seam', days: 3 } as const
    expect(worldInterrupt({ ...report, interrupt: { party: null, event: { ...event } } })).toEqual(event)
    expect(worldInterrupt({ ...report, interrupt: { party: 'party_1', event: { type: 'order_done', party: 'party_1' } } })).toBeNull()
    expect(worldInterrupt({ ...report, interrupt: null })).toBeNull()
  })
})

describe('campUntilHealed for a party already whole', () => {
  it('camps no day and leaves the party idle, its old order gone', () => {
    const { game, world, party } = withStandingOrder(quiet())
    expect(campUntilHealed(game, party)).toMatchObject({ days: 0, rested: 0 })
    expect(party.order).toEqual({ kind: 'idle' })
    expect(world.turn).toBe(1)
  })
})
