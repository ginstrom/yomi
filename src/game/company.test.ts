import { describe, expect, it } from 'vitest'
import { maxHp, maxMana } from '../character/character.ts'
import { hexDistance, hexEquals, offsetToHex, type Hex } from '../grid/hex.ts'
import { itemById } from '../inventory/inventory.ts'
import { boardIndex } from './blight.ts'
import { campUntilHealed, partyWounded } from './camp.ts'
import { UNTIL_LIMIT, act, actionBlocked, defaultPartyName, disband, exchange, formParty, heroesLeft, wipeParty, type ExchangeMove, moveHero, renameParty, advance, advanceRefusal, blockingParty, orderAction, partyNoun, passDay, setOrder, startTravel, worldInterrupt, type DayReport } from './company.ts'
import { PARTY_NAMES, newExpedition, type Expedition, partyId, presences, type DayAction } from './expedition.ts'
import { MAX_RESERVES } from './guildHall.ts'
import { newGame, type GameState } from './gameState.ts'
import type { ItemPlace } from './itemPlace.ts'
import { readyMadeParty } from './party.ts'
import { parseSave, serializeSave } from './save.ts'
import { NOTICE_RADIUS, encampment, locationAt, passTurn, routeTo, travel, type MonsterLocation, type WorldState } from './worldMap.ts'

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

/** `it` with a second party, of fresh characters, standing at `at` (the first party's hex by default), idle. */
function withSecond<T extends ReturnType<typeof fresh>>(it: T, at: Hex = it.party.position) {
  const second = newExpedition(readyMadeParty(), at, partyId(2), PARTY_NAMES[1])
  it.game.parties.push(second)
  return { ...it, second }
}

/** The day reports of `n` passDays, each expected to pass. */
function days(game: GameState, n: number): DayReport[] {
  return Array.from({ length: n }, () => passDay(game)!)
}

describe('natural healing while idle', () => {
  it.each(['home', 'field', 'garrison'] as const)('heals each wounded member 1 HP per day at %s, capped at maximum, without camp benefits', (where) => {
    const { game, world, party } = where === 'garrison' ? onGoldSeam() : quiet()
    if (where === 'field') party.position = NEAR()
    if (where === 'garrison') expect(setOrder(game, party.id, { kind: 'garrison' })).toBeNull()
    world.infirmary = 3
    const [aldric, brenna, delwyn] = party.members
    aldric.hp = maxHp(aldric) - 3
    brenna.hp = maxHp(brenna) - 1
    delwyn.mana = 0
    const position = { ...party.position }
    const reports = days(game, 2)
    expect(party.members.map((m) => m.hp)).toEqual([maxHp(aldric) - 1, maxHp(brenna), maxHp(delwyn)])
    expect(delwyn.mana).toBe(0)
    expect(reports.map((r) => r.parties[0])).toEqual([
      { party: party.id, walked: null, rested: 2, cast: 0, made: null },
      { party: party.id, walked: null, rested: 1, cast: 0, made: null },
    ])
    expect(party.position).toEqual(position)
    expect(party.order).toEqual({ kind: where === 'garrison' ? 'garrison' : 'idle' })
    expect(reports.flatMap((r) => r.partyEvents)).toEqual([])
  })

  it('heals every idle party during thirty quiet days without interrupting on full health', () => {
    const { game, party, second } = withSecond(quiet())
    for (const p of game.parties) p.members[0].hp = 1
    const reports = advance(game)
    expect(reports).toHaveLength(UNTIL_LIMIT)
    expect(reports.every((r) => r.interrupt === null)).toBe(true)
    for (const p of [party, second]) {
      expect(p.members[0].hp).toBe(Math.min(maxHp(p.members[0]), 1 + UNTIL_LIMIT))
      expect(reports.reduce((sum, r) => sum + r.parties.find((d) => d.party === p.id)!.rested, 0)).toBe(p.members[0].hp - 1)
    }
  })

  it('heals an idle party when another party spends a day camping, without doubling the camper’s healing', () => {
    const { game, party, second } = withSecond(quiet())
    party.members[0].hp = second.members[0].hp = 1
    const report = act(game, party.id, { kind: 'camp' })
    if (typeof report === 'string') throw new Error(report)
    expect([party.members[0].hp, second.members[0].hp]).toEqual([2, 2])
    expect(report.parties.map((d) => d.rested)).toEqual([1, 1])
  })

  it('starts healing the day after arrival, with no natural healing while travelling', () => {
    const { game, party } = quiet()
    party.members[0].hp = 1
    const to = { q: party.position.q + 1, r: party.position.r }
    expect(setOrder(game, party.id, { kind: 'travel', to })).toBeNull()
    expect(passDay(game)!.parties[0]).toMatchObject({ walked: to, rested: 0 })
    expect(party.members[0].hp).toBe(1)
    expect(passDay(game)!.parties[0].rested).toBe(1)
    expect(party.members[0].hp).toBe(2)
  })

  it('does not heal while building, or among monsters even after scouting', () => {
    const building = onCleanLand()
    building.party.members[0].hp = 1
    const report = act(building.game, building.party.id, { kind: 'tower' })
    if (typeof report === 'string') throw new Error(report)
    expect(report.parties[0].rested).toBe(0)
    expect(building.party.members[0].hp).toBe(1)

    const { game, party, second } = withSecond(quiet())
    const nest = nestAt(game.world, 'nearby', { q: party.position.q + 1, r: party.position.r })
    second.position = nest.position
    second.members[0].hp = 1
    expect(second.confronting).toBeNull()
    expect(passDay(game)!.parties[1].rested).toBe(0)
    expect(second.members[0].hp).toBe(1)
    party.members[0].hp = 1
    second.confronting = nest.id
    const before = structuredClone(game)
    expect(passDay(game)).toBeNull()
    expect(game).toEqual(before)
  })
})

describe('a company of two on the day loop', () => {
  it('walks both travel orders a hex a day, in list order, the world’s day once a day (A3)', () => {
    const { game, world, party, second } = withSecond(quiet())
    const [toA, toB] = [NEAR(), offsetToHex(1, 5)]
    const [routeA, routeB] = [routeTo(world, party, toA)!, routeTo(world, second, toB)!]
    expect(setOrder(game, party.id, { kind: 'travel', to: toA })).toBeNull()
    expect(setOrder(game, second.id, { kind: 'travel', to: toB })).toBeNull()
    const longest = Math.max(routeA.length, routeB.length)
    const reports = days(game, longest)
    expect(world.turn).toBe(1 + longest)
    expect(reports.map((r) => r.parties.map((d) => d.party))).toEqual(reports.map(() => [party.id, second.id]))
    expect(reports.slice(0, routeA.length).map((r) => r.parties[0].walked)).toEqual(routeA)
    expect(reports.slice(0, routeB.length).map((r) => r.parties[1].walked)).toEqual(routeB)
    expect(reports[routeA.length - 1].partyEvents).toContainEqual({ type: 'arrived', party: party.id, at: toA })
    expect(reports[routeB.length - 1].partyEvents).toContainEqual({ type: 'arrived', party: second.id, at: toB })
    expect([party.position, second.position]).toEqual([toA, toB])
  })

  it('passes the day for both when one takes a day’s action (A4)', () => {
    const { game, world, party, second } = withSecond(quiet())
    const route = routeTo(world, second, offsetToHex(1, 5))!
    setOrder(game, second.id, { kind: 'travel', to: offsetToHex(1, 5) })
    const report = act(game, party.id, { kind: 'camp' })
    if (typeof report === 'string') throw new Error(report)
    expect(world.turn).toBe(2)
    expect(report.parties[1].walked).toEqual(route[0])
    expect(second.position).toEqual(route[0])
    expect(party.order).toEqual({ kind: 'idle' })
    expect(second.order).toMatchObject({ kind: 'travel', route: route.slice(1) })
  })

  it('stops on a sighting near only the second party, naming it (A5)', () => {
    const { game, world } = quiet()
    const home = game.parties[0].position
    const far = world.locations.find((l) => l.kind === 'monsters' && hexDistance(l.position, home) > 3 * NOTICE_RADIUS)!
    world.sighted = world.sighted.filter((id) => id !== far.id)
    const beside = { q: far.position.q - 1, r: far.position.r }
    expect(locationAt(world, beside)).toBeNull()
    const { second } = withSecond({ game, world, party: game.parties[0] }, beside)
    const reports = advance(game)
    expect(reports).toHaveLength(1)
    expect(reports[0].interrupt).toMatchObject({ party: second.id, event: { type: 'sighted', location: far.id } })
  })

  it('stops on the second party’s arrival when nothing notable happens (A5)', () => {
    const { game, party, second } = withSecond(quiet())
    const to = { q: party.position.q + 1, r: party.position.r }
    setOrder(game, second.id, { kind: 'travel', to })
    const reports = advance(game)
    expect(reports).toHaveLength(1)
    expect(reports[0].interrupt).toEqual({ party: second.id, event: { type: 'arrived', party: second.id, at: to } })
  })

  it('refuses a day while either confronts monsters, naming it, and blockingParty finds it (A5)', () => {
    const { game, world, party, second } = withSecond(quiet())
    expect(blockingParty(game)).toBeNull()
    party.confronting = 'goblin_raiders'
    expect(passDay(game)).toBeNull()
    expect(advanceRefusal(game)).toBe('First Company stands before the Goblin Raiders: scout, wait or attack.')
    expect(blockingParty(game)).toBe(party)
    party.confronting = null
    second.confronting = 'goblin_raiders'
    expect(blockingParty(game)).toBe(second)
    expect(advanceRefusal(game)).toMatch(/^Second Company stands before/)
    second.order = { kind: 'day', action: { kind: 'wait' } }
    expect(blockingParty(game)).toBeNull()
    expect(advanceRefusal(game)).toBeNull()
    expect(world.turn).toBe(1)
  })

  it('names a party as “The party” alone and by its name in a company', () => {
    const { game, party } = quiet()
    expect(partyNoun(game, party)).toBe('The party')
    const { second } = withSecond({ game, world: game.world, party })
    expect([partyNoun(game, party), partyNoun(game, second)]).toEqual(['First Company', 'Second Company'])
  })
})

describe('the home order', () => {
  it('walks routeTo the encampment, arrives and goes idle', () => {
    const { game, world, party } = quiet()
    const home = encampment(world).position
    party.position = NEAR()
    const route = routeTo(world, party, home)!
    expect(setOrder(game, party.id, { kind: 'home' })).toBeNull()
    expect(party.order).toEqual({ kind: 'home', to: home, route })
    const reports = advance(game)
    expect(reports.map((r) => r.parties[0].walked)).toEqual(route)
    expect(reports.at(-1)!.interrupt).toEqual({ party: party.id, event: { type: 'arrived', party: party.id, at: home } })
    expect(party.position).toEqual(home)
    expect(party.order).toEqual({ kind: 'idle' })
  })

  it('is refused at home and while confronting', () => {
    const { game, party } = quiet()
    expect(setOrder(game, party.id, { kind: 'home' })).toBe('The party is already home.')
    const { second } = withSecond({ game, world: game.world, party })
    expect(setOrder(game, second.id, { kind: 'home' })).toBe('Second Company is already home.')
    party.position = NEAR()
    party.confronting = 'goblin_raiders'
    expect(setOrder(game, party.id, { kind: 'home' })).toMatch(/must first answer/)
    expect(party.order).toEqual({ kind: 'idle' })
  })
})

describe('the garrison order', () => {
  it('is given on a held resource and never ends, the party telling nothing of its own for 30 days', () => {
    const { game, party } = onGoldSeam()
    expect(setOrder(game, party.id, { kind: 'garrison' })).toBeNull()
    const reports = days(game, 30)
    expect(reports.every((r) => r.partyEvents.length === 0 && r.parties[0].walked === null)).toBe(true)
    expect(party.order).toEqual({ kind: 'garrison' })
  })

  it('is refused on the encampment, on an unheld site, off any site and while confronting', () => {
    const home = quiet()
    expect(setOrder(home.game, home.party.id, { kind: 'garrison' })).toMatch(/held resource/)
    const unheld = onGoldSeam()
    unheld.world.held = unheld.world.held.filter((id) => id !== 'gold_seam')
    expect(setOrder(unheld.game, unheld.party.id, { kind: 'garrison' })).toMatch(/held resource/)
    const off = onCleanLand()
    expect(setOrder(off.game, off.party.id, { kind: 'garrison' })).toMatch(/held resource/)
    const facing = onGoldSeam()
    facing.party.confronting = 'goblin_raiders'
    expect(setOrder(facing.game, facing.party.id, { kind: 'garrison' })).toMatch(/must first answer/)
    for (const { party } of [home, unheld, off, facing]) expect(party.order).toEqual({ kind: 'idle' })
  })
})

describe('the meet order', () => {
  it('closes a hex a day on a party standing still, ending with met and idle', () => {
    const { game, party, second } = withSecond(quiet(), offsetToHex(5, 4))
    const apart = hexDistance(party.position, second.position)
    expect(apart).toBeGreaterThan(2)
    expect(setOrder(game, party.id, { kind: 'meet', party: second.id })).toBeNull()
    expect(party.order).toEqual({ kind: 'meet', party: second.id })
    const reports = advance(game)
    expect(reports).toHaveLength(apart)
    reports.forEach((r, i) => expect(hexDistance(r.parties[0].walked!, second.position)).toBe(apart - i - 1))
    expect(reports.at(-1)!.interrupt).toEqual({ party: party.id, event: { type: 'met', party: party.id, other: second.id } })
    expect(party.position).toEqual(second.position)
    expect(party.order).toEqual({ kind: 'idle' })
    expect(party.confronting).toBeNull()
  })

  it('brings two parties meeting each other together', () => {
    const { game, party, second } = withSecond(quiet(), offsetToHex(5, 4))
    setOrder(game, party.id, { kind: 'meet', party: second.id })
    setOrder(game, second.id, { kind: 'meet', party: party.id })
    const apart = hexDistance(party.position, second.position)
    const reports = advance(game)
    expect(reports.length).toBeLessThan(apart)
    expect(party.position).toEqual(second.position)
    expect(reports.at(-1)!.partyEvents.filter((e) => e.type === 'met')).toEqual([
      { type: 'met', party: party.id, other: second.id },
      { type: 'met', party: second.id, other: party.id },
    ])
    expect([party.order, second.order]).toEqual([{ kind: 'idle' }, { kind: 'idle' }])
  })

  it('is refused for itself, an unknown party, the same hex and while confronting', () => {
    const { game, party, second } = withSecond(quiet())
    expect(setOrder(game, party.id, { kind: 'meet', party: party.id })).toMatch(/itself/)
    expect(setOrder(game, party.id, { kind: 'meet', party: 'party_9' })).toMatch(/party_9/)
    expect(setOrder(game, party.id, { kind: 'meet', party: second.id })).toBe('First Company and Second Company are already together.')
    second.position = offsetToHex(5, 4)
    party.confronting = 'goblin_raiders'
    expect(setOrder(game, party.id, { kind: 'meet', party: second.id })).toMatch(/must first answer/)
    expect(party.order).toEqual({ kind: 'idle' })
  })

  it('ends idle, with order_done, when the other party is gone', () => {
    const { game, party, second } = withSecond(quiet(), offsetToHex(5, 4))
    setOrder(game, party.id, { kind: 'meet', party: second.id })
    passDay(game)
    game.parties.splice(game.parties.indexOf(second), 1)
    const report = passDay(game)!
    expect(report.parties[0].walked).toBeNull()
    expect(report.partyEvents).toEqual([{ type: 'order_done', party: party.id }])
    expect(party.order).toEqual({ kind: 'idle' })
  })

  it('confronts the monsters the other party stands on, after met', () => {
    const { game, world, party, second } = withSecond(quiet())
    const at = { q: party.position.q + 2, r: party.position.r }
    nestAt(world, 'shared_nest', at)
    second.position = at // as after a wait there: on the nest, confronting nothing
    setOrder(game, party.id, { kind: 'meet', party: second.id })
    const reports = advance(game)
    expect(reports.at(-1)!.partyEvents).toEqual([
      { type: 'met', party: party.id, other: second.id },
      { type: 'confronting', party: party.id, location: 'shared_nest' },
    ])
    expect(party.confronting).toBe('shared_nest')
  })
})

describe('stopping short of another party’s monsters', () => {
  it('lets the first in list order onto a nest both would step onto, the second staying a hex short, idle', () => {
    const { game, world, party, second } = withSecond(quiet())
    const at = { q: party.position.q + 2, r: party.position.r }
    nestAt(world, 'contested', at)
    party.position = { q: at.q - 1, r: at.r }
    second.position = { q: at.q + 1, r: at.r }
    setOrder(game, party.id, { kind: 'travel', to: at })
    setOrder(game, second.id, { kind: 'travel', to: at })
    const report = passDay(game)!
    expect(report.parties.map((d) => d.walked)).toEqual([at, null])
    expect(report.partyEvents).toEqual([
      { type: 'arrived', party: party.id, at },
      { type: 'confronting', party: party.id, location: 'contested' },
      { type: 'order_done', party: second.id },
    ])
    expect(second.position).toEqual({ q: at.q + 1, r: at.r })
    expect(second.order).toEqual({ kind: 'idle' })
    expect(second.confronting).toBeNull()
  })

  it('refuses a travel order to a nest another party already stands on, naming it, and changes nothing', () => {
    const { game, world, party, second } = withSecond(quiet())
    const at = { q: party.position.q + 2, r: party.position.r }
    nestAt(world, 'held_up', at)
    party.position = at
    second.position = { q: at.q + 2, r: at.r }
    expect(setOrder(game, second.id, { kind: 'travel', to: at })).toBe('First Company already stands before the Nest: meet it there instead.')
    expect(second.order).toEqual({ kind: 'idle' })
    expect(startTravel(game, second, at)).toBe('refused')
    // A meet goes there all the same, and confronts the nest too.
    expect(setOrder(game, second.id, { kind: 'meet', party: party.id })).toBeNull()
  })

  it('stops a travel order whose road another party’s nest has come onto, and a home order short of a nest another party stands on', () => {
    for (const kind of ['travel', 'home'] as const) {
      const { game, world, party, second } = withSecond(quiet())
      const home = encampment(world).position
      const at = { q: home.q + 1, r: home.r }
      party.position = at // as after a wait there
      second.position = { q: at.q + 1, r: at.r }
      // A travel order given before the nest was there, its road running through it; home's route runs through a nest only if it is not known.
      const request = kind === 'travel' ? { kind, to: home } : { kind }
      expect(setOrder(game, second.id, request)).toBeNull()
      nestAt(world, 'held_up', at)
      if (kind === 'home') world.sighted = world.sighted.filter((id) => id !== 'held_up')
      expect(second.order.kind === kind && second.order.route[0]).toEqual(at)
      const report = passDay(game)!
      expect(report.parties[1].walked).toBeNull()
      expect(report.partyEvents).toEqual([{ type: 'order_done', party: second.id }])
      expect(second.order).toEqual({ kind: 'idle' })
    }
  })
})

describe('a meet cut short', () => {
  it('confronts the monsters it steps onto though the other party has walked on', () => {
    const { game, world, party, second } = withSecond(quiet())
    const at = { q: party.position.q + 1, r: party.position.r }
    nestAt(world, 'left_behind', at)
    second.position = at // as after a wait there: on the nest, confronting nothing
    expect(setOrder(game, party.id, { kind: 'meet', party: second.id })).toBeNull()
    expect(setOrder(game, second.id, { kind: 'travel', to: { q: at.q + 3, r: at.r } })).toBeNull()
    const report = passDay(game)!
    expect(report.parties.map((d) => d.walked)).toEqual([at, { q: at.q + 1, r: at.r }])
    expect(report.partyEvents).toEqual([{ type: 'confronting', party: party.id, location: 'left_behind' }])
    expect(party.confronting).toBe('left_behind')
    expect(party.order).toEqual({ kind: 'idle' })
  })

  it('ends idle, with order_done, once no way to the other party is left', () => {
    const { game, world, party, second } = withSecond(quiet(), offsetToHex(5, 4))
    expect(setOrder(game, party.id, { kind: 'meet', party: second.id })).toBeNull()
    // Known nests on every hex around the other party close every way to it.
    const around = [[1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1]].map(([dq, dr]) => ({ q: second.position.q + dq, r: second.position.r + dr }))
    around.forEach((h, i) => nestAt(world, `ring_${i}`, h))
    expect(routeTo(world, party, second.position)).toBeNull()
    const before = party.position
    const report = passDay(game)!
    expect(report.parties[0].walked).toBeNull()
    expect(report.partyEvents).toEqual([{ type: 'order_done', party: party.id }])
    expect(party.position).toEqual(before)
    expect(party.order).toEqual({ kind: 'idle' })
  })
})

describe('the guild hall’s company', () => {
  /** A hall of level 4 with a reserve and the ready-made three at home. */
  function hall(level = 4) {
    const { game, world, party } = fresh()
    world.guildHall = level
    game.reserves.push(structuredClone(party.members[0]))
    game.reserves[0].name = 'Reserve'
    game.reserves[0].hp = 1
    return { game, world, party }
  }

  /** Runs `act`, which must refuse, and checks that it changed nothing. */
  function refuses(game: GameState, act: () => string | null | object): string {
    const before = structuredClone(game)
    const result = act()
    expect(typeof result).toBe('string')
    expect(game).toEqual(before)
    return result as string
  }

  describe('formParty', () => {
    it('makes a party from a reserve, resting it, at the encampment, idle and with no baggage', () => {
      const { game, world } = hall()
      const made = formParty(game, defaultPartyName(game), { from: 'reserves', index: 0 })
      expect(typeof made).not.toBe('string')
      const second = made as Expedition
      expect([second.id, second.name]).toEqual(['party_2', 'Second Company'])
      expect(second.position).toEqual(encampment(world).position)
      expect(second.order).toEqual({ kind: 'idle' })
      expect(second.baggage).toEqual([])
      expect(second.members.map((m) => m.name)).toEqual(['Reserve'])
      expect(second.members[0].hp).toBe(maxHp(second.members[0]))
      expect(game.reserves).toEqual([])
      expect(game.parties).toHaveLength(2)
    })

    it('makes a party from a home party’s member', () => {
      const { game, party } = hall()
      const made = formParty(game, '  Scouts ', { from: 'party', party: party.id, index: 1 }) as Expedition
      expect(made.name).toBe('Scouts')
      expect(made.members.map((m) => m.name)).toEqual(['Brenna'])
      expect(party.members.map((m) => m.name)).toEqual(['Aldric', 'Delwyn'])
    })

    it('reuses the lowest free id after a disband', () => {
      const { game, party } = hall(5)
      formParty(game, 'B', { from: 'party', party: party.id, index: 1 })
      formParty(game, 'C', { from: 'party', party: party.id, index: 1 })
      expect(game.parties.map((p) => p.id)).toEqual(['party_1', 'party_2', 'party_3'])
      expect(disband(game, 'party_2')).toBeNull()
      expect(defaultPartyName(game)).toBe('Second Company')
      expect((formParty(game, 'D', { from: 'reserves', index: 0 }) as Expedition).id).toBe('party_2')
    })

    it('is refused over the hall’s parties, away from home, leaving a party empty, for a bad name or an unknown hero', () => {
      const { game, party } = hall(3)
      expect(refuses(game, () => formParty(game, 'Two', { from: 'reserves', index: 0 }))).toMatch(/level 3 allows 1 party/)
      game.world.guildHall = 4
      expect(refuses(game, () => formParty(game, 'Two', { from: 'reserves', index: 5 }))).toMatch(/no such hero/)
      expect(refuses(game, () => formParty(game, 'Two', { from: 'party', party: 'party_9', index: 0 }))).toMatch(/party_9/)
      expect(refuses(game, () => formParty(game, '   ', { from: 'reserves', index: 0 }))).toMatch(/needs a name/)
      expect(refuses(game, () => formParty(game, 'x'.repeat(17), { from: 'reserves', index: 0 }))).toMatch(/at most 16/)
      expect(refuses(game, () => formParty(game, 'first company', { from: 'reserves', index: 0 }))).toMatch(/already/)
      party.members.length = 1
      expect(refuses(game, () => formParty(game, 'Two', { from: 'party', party: party.id, index: 0 }))).toMatch(/cannot be left empty/)
      party.position = offsetToHex(11, 19)
      expect(refuses(game, () => formParty(game, 'Two', { from: 'reserves', index: 0 }))).toMatch(/No party is at/)
    })

    it('is refused for a third party at level 4, and a member of an away party', () => {
      const { game, party } = hall(4)
      formParty(game, 'B', { from: 'reserves', index: 0 })
      expect(refuses(game, () => formParty(game, 'C', { from: 'party', party: party.id, index: 0 }))).toMatch(/allows 2 parties/)
      game.world.guildHall = 5
      game.parties[1].position = offsetToHex(11, 19)
      expect(refuses(game, () => formParty(game, 'C', { from: 'party', party: 'party_2', index: 0 }))).toMatch(/not at/)
    })
  })

  describe('renameParty', () => {
    it('renames, trimmed, anywhere, and allows the party’s own name in another case', () => {
      const { game, party } = hall()
      party.position = offsetToHex(11, 19)
      expect(renameParty(game, party.id, ' Vanguard ')).toBeNull()
      expect(party.name).toBe('Vanguard')
      expect(renameParty(game, party.id, 'VANGUARD')).toBeNull()
      expect(party.name).toBe('VANGUARD')
    })

    it('refuses an empty, long or duplicate name and an unknown party', () => {
      const { game, party } = hall()
      formParty(game, 'Scouts', { from: 'reserves', index: 0 })
      expect(refuses(game, () => renameParty(game, party.id, ''))).toMatch(/needs a name/)
      expect(refuses(game, () => renameParty(game, party.id, 'y'.repeat(17)))).toMatch(/at most 16/)
      expect(refuses(game, () => renameParty(game, party.id, 'scouts'))).toMatch(/already/)
      expect(refuses(game, () => renameParty(game, 'party_9', 'Z'))).toMatch(/party_9/)
      expect(renameParty(game, party.id, 'y'.repeat(16))).toBeNull()
    })
  })

  describe('disband', () => {
    it('sends the members to the reserves and the baggage to the first other party at home', () => {
      const { game, party } = hall()
      party.baggage.push(itemById('iron_sword')!)
      const second = formParty(game, 'B', { from: 'party', party: party.id, index: 2 }) as Expedition
      second.baggage.push(itemById('oak_shield')!)
      expect(disband(game, second.id)).toBeNull()
      expect(game.parties.map((p) => p.id)).toEqual(['party_1'])
      expect(game.reserves.map((m) => m.name)).toEqual(['Reserve', 'Delwyn'])
      expect(party.baggage.map((i) => i.id)).toEqual(['iron_sword', 'oak_shield'])
    })

    it('is refused for the last party, away from home, with the reserves full or no other party at home', () => {
      const { game, party } = hall()
      expect(refuses(game, () => disband(game, party.id))).toMatch(/last party/)
      const second = formParty(game, 'B', { from: 'party', party: party.id, index: 2 }) as Expedition
      expect(refuses(game, () => disband(game, 'party_9'))).toMatch(/party_9/)
      second.position = offsetToHex(11, 19)
      expect(refuses(game, () => disband(game, second.id))).toMatch(/not at/)
      expect(refuses(game, () => disband(game, party.id))).toMatch(/another party at home/)
      second.position = { ...party.position }
      while (game.reserves.length < MAX_RESERVES) game.reserves.push(structuredClone(game.reserves[0]))
      expect(refuses(game, () => disband(game, second.id))).toMatch(/no more than 4/)
    })
  })

  describe('moveHero', () => {
    it('moves a hero between two home parties, to the reserves and out of them, to the target’s end', () => {
      const { game, party } = hall()
      const second = formParty(game, 'B', { from: 'party', party: party.id, index: 2 }) as Expedition
      expect(moveHero(game, { from: 'party', party: party.id, index: 0 }, { party: second.id })).toBeNull()
      expect(second.members.map((m) => m.name)).toEqual(['Delwyn', 'Aldric'])
      expect(moveHero(game, { from: 'party', party: second.id, index: 0 }, 'reserves')).toBeNull()
      expect(game.reserves.map((m) => m.name)).toEqual(['Reserve', 'Delwyn'])
      expect(moveHero(game, { from: 'reserves', index: 0 }, { party: party.id })).toBeNull()
      expect(party.members.map((m) => m.name)).toEqual(['Brenna', 'Reserve'])
      expect(party.members[1].hp).toBe(maxHp(party.members[1]))
      expect(party.members[1].mana).toBe(maxMana(party.members[1]))
    })

    it('is refused away from home, over the party limit or the reserves, emptying a party, or to where it is', () => {
      const { game, party } = hall()
      const second = formParty(game, 'B', { from: 'party', party: party.id, index: 2 }) as Expedition
      const from0 = { from: 'party', party: party.id, index: 0 } as const
      expect(refuses(game, () => moveHero(game, from0, { party: party.id }))).toMatch(/already there/)
      expect(refuses(game, () => moveHero(game, { from: 'reserves', index: 0 }, 'reserves'))).toMatch(/already there/)
      expect(refuses(game, () => moveHero(game, { from: 'party', party: second.id, index: 0 }, { party: party.id }))).toMatch(/cannot be left empty/)
      expect(refuses(game, () => moveHero(game, from0, { party: 'party_9' }))).toMatch(/party_9/)
      expect(refuses(game, () => moveHero(game, { from: 'party', party: party.id, index: 7 }, { party: second.id }))).toMatch(/no such hero/)
      while (game.reserves.length < MAX_RESERVES) game.reserves.push(structuredClone(game.reserves[0]))
      expect(refuses(game, () => moveHero(game, from0, 'reserves'))).toMatch(/no more than 4/)
      while (second.members.length < 5) second.members.push(structuredClone(party.members[0]))
      expect(refuses(game, () => moveHero(game, from0, { party: second.id }))).toMatch(/is full/)
      second.position = offsetToHex(11, 19)
      expect(refuses(game, () => moveHero(game, from0, { party: second.id }))).toMatch(/not at/)
      expect(refuses(game, () => moveHero(game, { from: 'party', party: second.id, index: 0 }, { party: party.id }))).toMatch(/not at/)
    })
  })
})

describe('exchange (A7)', () => {
  /** Two parties of the ready-made three on one hex in the field, at a hall of `level`; the second's names marked so the two can be told apart. */
  function together(level = 2) {
    const it = withSecond(quiet(), offsetToHex(11, 19))
    it.party.position = offsetToHex(11, 19)
    it.world.guildHall = level
    for (const member of it.second.members) member.name = `${member.name}2`
    return it
  }

  /** Runs `exchange`, which must refuse, and checks that it changed nothing. */
  function refused(game: GameState, a: string, b: string, moves: ExchangeMove[], pattern: RegExp): void {
    const before = structuredClone(game)
    const result = exchange(game, a, b, moves)
    expect(result).toMatch(pattern)
    expect(game).toEqual(before)
  }

  const names = (party: Expedition) => party.members.map((m) => m.name)

  it('moves a member to the other party’s end, with what it wears, carries and its wounds', () => {
    const { game, party, second } = together()
    const brenna = party.members[1]
    brenna.hp = 3
    const worn = { ...brenna.equipment }
    expect(exchange(game, party.id, second.id, [{ kind: 'member', from: party.id, index: 1 }])).toBeNull()
    expect(names(party)).toEqual(['Aldric', 'Delwyn'])
    expect(names(second)).toEqual(['Aldric2', 'Brenna2', 'Delwyn2', 'Brenna'])
    expect(second.members[3]).toBe(brenna)
    expect(brenna.hp).toBe(3)
    expect(brenna.equipment).toEqual(worn)
  })

  it('swaps two members, each taking the other’s place in the battle order', () => {
    const { game, party, second } = together(1)
    expect(exchange(game, party.id, second.id, [{ kind: 'swap', a: 0, b: 2 }])).toBeNull()
    expect(names(party)).toEqual(['Delwyn2', 'Brenna', 'Delwyn'])
    expect(names(second)).toEqual(['Aldric2', 'Brenna2', 'Aldric'])
  })

  it('moves baggage items either way, to the end of the other’s baggage', () => {
    const { game, party, second } = together()
    party.baggage.push(itemById('iron_sword')!, itemById('yew_bow')!)
    second.baggage.push(itemById('oak_shield')!)
    expect(exchange(game, second.id, party.id, [
      { kind: 'item', from: party.id, index: 1 },
      { kind: 'item', from: second.id, index: 0 },
    ])).toBeNull()
    expect(party.baggage.map((i) => i.id)).toEqual(['iron_sword', 'oak_shield'])
    expect(second.baggage.map((i) => i.id)).toEqual(['yew_bow'])
  })

  it('reads each move’s indices as the earlier moves left the lists', () => {
    const { game, party, second } = together(3)
    expect(exchange(game, party.id, second.id, [
      { kind: 'member', from: party.id, index: 0 },
      { kind: 'member', from: second.id, index: 3 },
      { kind: 'swap', a: 2, b: 0 },
    ])).toBeNull()
    expect(names(party)).toEqual(['Brenna', 'Delwyn', 'Aldric2'])
    expect(names(second)).toEqual(['Aldric', 'Brenna2', 'Delwyn2'])
  })

  it('is allowed when both confront the same monsters', () => {
    const { game, world, party, second } = together()
    nestAt(world, 'shared', party.position)
    party.confronting = second.confronting = 'shared'
    expect(exchange(game, party.id, second.id, [{ kind: 'member', from: second.id, index: 0 }])).toBeNull()
    expect(party.members).toHaveLength(4)
  })

  it('is refused on different hexes, for unknown or the same party, and while one confronts monsters', () => {
    const { game, world, party, second } = together()
    const move: ExchangeMove[] = [{ kind: 'item', from: party.id, index: 0 }]
    party.baggage.push(itemById('iron_sword')!)
    refused(game, party.id, 'party_9', move, /party_9/)
    refused(game, party.id, party.id, move, /itself/)
    second.position = offsetToHex(12, 19)
    refused(game, party.id, second.id, move, /First Company and Second Company are not on the same hex/)
    second.position = { ...party.position }
    nestAt(world, 'shared', party.position)
    party.confronting = 'shared'
    refused(game, party.id, second.id, move, /First Company must first answer/)
    nestAt(world, 'other', offsetToHex(30, 30))
    second.confronting = 'other'
    refused(game, party.id, second.id, move, /must first answer/)
  })

  it('refuses the whole list, earlier valid moves included, for a bad index, an emptied party or one over the limit', () => {
    const { game, party, second } = together(1)
    party.baggage.push(itemById('iron_sword')!)
    const item = { kind: 'item', from: party.id, index: 0 } as const
    refused(game, party.id, second.id, [item, { kind: 'item', from: party.id, index: 0 }], /no such item/i)
    refused(game, party.id, second.id, [item, { kind: 'member', from: party.id, index: 5 }], /no such hero/i)
    refused(game, party.id, second.id, [item, { kind: 'swap', a: 0, b: 3 }], /no such hero/i)
    refused(game, party.id, second.id, [item, { kind: 'member', from: 'party_9', index: 0 }], /party_9/)
    refused(game, party.id, second.id, [item, { kind: 'member', from: party.id, index: 0 }], /Second Company is full/)
    game.world.guildHall = 3
    refused(game, party.id, second.id, [
      item,
      { kind: 'member', from: party.id, index: 0 },
      { kind: 'member', from: party.id, index: 0 },
      { kind: 'member', from: party.id, index: 0 },
    ], /First Company cannot be left empty/)
  })

  it('reaches no reserve: the guild hall will not move one to a party away from home', () => {
    const { game, party } = together()
    game.reserves.push(structuredClone(party.members[0]))
    const before = structuredClone(game)
    expect(moveHero(game, { from: 'reserves', index: 0 }, { party: party.id })).toMatch(/not at/)
    expect(game).toEqual(before)
  })
})

describe('wipeParty (A9)', () => {
  /** The second party standing on a nest in the field, fallen to the last hero, its baggage holding a sword. */
  function beaten() {
    const it = withSecond(quiet(), offsetToHex(11, 19))
    const nest = nestAt(it.world, 'wiper', it.second.position)
    it.second.confronting = nest.id
    it.second.baggage.push(itemById('iron_sword')!)
    for (const member of it.second.members) member.hp = 0
    return { ...it, nest }
  }

  /** Every item a party's members wear and carry, then its baggage's: what a wipe leaves. */
  const belongings = (party: Expedition): string[] => [
    ...party.members.flatMap((m) => [...Object.values(m.equipment), ...m.backpack.filter((i) => i !== null)].map((i) => i!.id)),
    ...party.baggage.map((i) => i.id),
  ]

  it('removes the party, its heroes dead and what they had left as the location’s loot', () => {
    const { game, second, nest } = beaten()
    nest.loot.push(itemById('oak_shield')!)
    const members = [...second.members]
    const had = belongings(second)
    const wipe = wipeParty(game, second.id, nest)
    expect(game.parties.map((p) => p.id)).toEqual(['party_1'])
    expect(wipe.dead).toEqual(members)
    expect(wipe.left.map((i) => i.id).sort()).toEqual([...had].sort())
    expect(nest.loot.map((i) => i.id).sort()).toEqual(['oak_shield', ...had].sort())
    expect(members.every((m) => Object.keys(m.equipment).length === 0 && m.backpack.every((i) => i === null))).toBe(true)
    expect(wipe.lost).toBe(false)
    expect(wipe.reformed).toBeNull()
    expect(heroesLeft(game)).toBe(3)
  })

  it('leaves the location on the map and another party confronting it', () => {
    const { game, world, party, second, nest } = beaten()
    party.position = { ...second.position }
    party.confronting = nest.id
    const status = world.status
    wipeParty(game, second.id, nest)
    expect(world.locations).toContain(nest)
    expect(party.confronting).toBe(nest.id)
    expect(world.status).toBe(status)
  })

  it('loses the items of a fight with no location', () => {
    const { game, second, nest } = beaten()
    const wipe = wipeParty(game, second.id, null)
    expect(wipe.left.length).toBeGreaterThan(0)
    expect(nest.loot).toEqual([])
    expect(game.parties).toHaveLength(1)
  })

  it('is not lost while a reserve lives, forming a party of the reserves at the encampment', () => {
    const { game, world, party } = fresh()
    const nest = nestAt(world, 'wiper', offsetToHex(11, 19))
    party.position = nest.position
    world.guildHall = 1
    for (let i = 0; i < 4; i++) {
      const reserve = structuredClone(party.members[i % 3])
      reserve.name = `Reserve${i}`
      reserve.hp = 1
      game.reserves.push(reserve)
    }
    const wipe = wipeParty(game, party.id, nest)
    expect(wipe.lost).toBe(false)
    const reformed = wipe.reformed!
    expect(game.parties).toEqual([reformed])
    expect([reformed.id, reformed.name]).toEqual(['party_1', 'First Company'])
    expect(reformed.position).toEqual(encampment(world).position)
    expect(reformed.order).toEqual({ kind: 'idle' })
    expect(reformed.confronting).toBeNull()
    expect(reformed.baggage).toEqual([])
    expect(reformed.members.map((m) => m.name)).toEqual(['Reserve0', 'Reserve1', 'Reserve2'])
    expect(reformed.members.every((m) => m.hp === maxHp(m) && m.mana === maxMana(m))).toBe(true)
    expect(game.reserves.map((m) => m.name)).toEqual(['Reserve3'])
    expect(heroesLeft(game)).toBe(4)
  })

  it('reforms under the lowest free id when the last party standing was another', () => {
    const { game, second, nest } = beaten()
    game.parties.splice(0, 1)
    game.reserves.push(structuredClone(second.members[0]))
    game.reserves[0].hp = 1
    const wipe = wipeParty(game, second.id, nest)
    expect(wipe.reformed?.id).toBe('party_1')
    expect(wipe.reformed?.name).toBe('First Company')
  })

  it('is lost when the last party falls with no reserves', () => {
    const { game, world, party } = fresh()
    const nest = nestAt(world, 'wiper', offsetToHex(11, 19))
    const wipe = wipeParty(game, party.id, nest)
    expect(wipe.lost).toBe(true)
    expect(wipe.reformed).toBeNull()
    expect(game.parties).toEqual([])
    expect(heroesLeft(game)).toBe(0)
    expect(world.status).toBe('playing')
  })
})

describe('a removed party leaves no meet order naming it', () => {
  /** Whether `game` survives a save and a load. */
  const roundTrips = (game: GameState) => parseSave(serializeSave({ game, battle: null, savedAt: 1 })) !== null

  it('wipeParty turns another party’s meet on it to idle, and the save still reads', () => {
    const { game, world, party, second } = withSecond(quiet(), offsetToHex(11, 19))
    const nest = nestAt(world, 'wiper', second.position)
    second.confronting = nest.id
    expect(setOrder(game, party.id, { kind: 'meet', party: second.id })).toBeNull()
    wipeParty(game, second.id, nest)
    expect(party.order).toEqual({ kind: 'idle' })
    expect(roundTrips(game)).toBe(true)
  })

  it('disband turns another party’s meet on it to idle, and the save still reads', () => {
    const { game, second } = withSecond(quiet())
    game.world.guildHall = 5
    const third = newExpedition(readyMadeParty(), offsetToHex(5, 4), partyId(3), PARTY_NAMES[2])
    game.parties.push(third)
    expect(setOrder(game, third.id, { kind: 'meet', party: second.id })).toBeNull()
    expect(disband(game, second.id)).toBeNull()
    expect(third.order).toEqual({ kind: 'idle' })
    expect(roundTrips(game)).toBe(true)
  })

  it('leaves other orders alone', () => {
    const { game, party, second } = withSecond(quiet())
    game.world.guildHall = 5
    const third = newExpedition(readyMadeParty(), offsetToHex(5, 4), partyId(3), PARTY_NAMES[2])
    game.parties.push(third)
    expect(setOrder(game, party.id, { kind: 'meet', party: third.id })).toBeNull()
    expect(disband(game, second.id)).toBeNull()
    expect(party.order).toEqual({ kind: 'meet', party: third.id })
  })
})

describe('actionBlocked', () => {
  it('names the other party whose monsters stop a day the action would pass, and none where the action answers its own', () => {
    const { game, world, party, second } = withSecond(quiet(), offsetToHex(11, 19))
    const nest = nestAt(world, 'blocker', second.position)
    expect(actionBlocked(game, party.id, { kind: 'camp' })).toBeNull()
    second.confronting = nest.id
    expect(actionBlocked(game, party.id, { kind: 'camp' })).toEqual({ refusal: advanceRefusal(game), party: second })
    expect(actionBlocked(game, second.id, { kind: 'wait' })).toBeNull()
    party.position = { ...second.position }
    party.confronting = nest.id
    const blocked = actionBlocked(game, party.id, { kind: 'scout' })
    expect(blocked).toEqual({ refusal: orderAction(game, party.id, { kind: 'scout' }), party: second })
    expect(blocked!.refusal).toMatch(/^Second Company stands before/)
    world.status = 'lost'
    expect(actionBlocked(game, party.id, { kind: 'scout' })).toEqual({ refusal: 'The game is over.', party: null })
  })
})
