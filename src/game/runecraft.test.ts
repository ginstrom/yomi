import { describe, expect, it } from 'vitest'
import { maxHp } from '../character/character.ts'
import { itemById } from '../inventory/inventory.ts'
import { newGame, type GameState } from './gameState.ts'
import type { ItemPlace } from './itemPlace.ts'
import {
  EXTRACT_LEVEL,
  FUSE_LEVELS,
  embed,
  embedRefusal,
  extract,
  extractRefusal,
  fuse,
  fuseRefusal,
  socketables,
} from './runecraft.ts'
import { monstersHere, passTurn, travel } from './worldMap.ts'

/** A new game at home with a level 1 workshop and gold to spare. */
function home(workshop = 1): GameState {
  const game = newGame(undefined, null, 1, 'Hearthold')
  game.world.workshop = workshop
  game.world.stock = { gold: 500 }
  return game
}
/** One step off the encampment: the field. */
const intoField = (game: GameState) => (game.world.party = { q: game.world.party.q + 1, r: game.world.party.r })

/** Puts `id` in the soldier's main hand and returns its place. */
function wield(game: GameState, id: string): ItemPlace {
  game.party[0].equipment.mainHand = itemById(id)!
  return { from: 'worn', member: 0, slot: 'mainHand', itemId: id }
}
/** Puts `id` on the soldier as armour and returns its place. */
function wear(game: GameState, id: string): ItemPlace {
  game.party[0].equipment.armor = itemById(id)!
  return { from: 'worn', member: 0, slot: 'armor', itemId: id }
}

/** Everything an action might change, to show a refusal changed none of it. */
const snapshot = (game: GameState) =>
  JSON.stringify({ stock: game.world.stock, runes: game.runes, turn: game.world.turn, equipment: game.party.map((m) => m.equipment), hp: game.party.map((m) => m.hp), baggage: game.baggage })

/** Expects `act` to be refused with a message matching `pattern`, and nothing changed. */
function refused(game: GameState, act: () => string | null | { refusal: string | null }, pattern: RegExp) {
  const before = snapshot(game)
  const result = act()
  const refusal = typeof result === 'object' && result !== null ? result.refusal : result
  expect(refusal).toMatch(pattern)
  expect(snapshot(game)).toBe(before)
}

describe('embed', () => {
  it('fills the next socket at a level 1 workshop, a rank 1 and then a rank 2 rune, in no time', () => {
    const game = home()
    game.runes = { ember1: 2, storm2: 1 }
    const turn = game.world.turn
    let place = wield(game, 'steel_longsword@3')
    const first = embed(game, place, 'ember1')
    expect(first.refusal).toBeNull()
    expect(game.party[0].equipment.mainHand).toBe(itemById('steel_longsword@3#ember1'))
    expect(game.world.stock.gold).toBe(495)
    expect(game.runes).toEqual({ ember1: 1, storm2: 1 })
    place = { ...place, itemId: 'steel_longsword@3#ember1' }
    const second = embed(game, place, 'storm2')
    expect(second.refusal).toBeNull()
    if (second.refusal === null) {
      expect(second.item).toBe(itemById('steel_longsword@3#ember1.storm2'))
      expect(second.events).toEqual([])
    }
    expect(game.party[0].equipment.mainHand).toBe(itemById('steel_longsword@3#ember1.storm2'))
    expect(game.world.stock.gold).toBe(485)
    expect(game.runes).toEqual({ ember1: 1 })
    expect(game.world.turn).toBe(turn)
  })

  it('makes iron_sword@3#ember1 of a Masterwork iron sword in the baggage', () => {
    const game = home()
    game.runes = { ember1: 1 }
    game.baggage.push(itemById('iron_sword@3')!)
    const result = embed(game, { from: 'baggage', index: 0, itemId: 'iron_sword@3' }, 'ember1')
    expect(result.refusal).toBeNull()
    expect(game.baggage[0]).toBe(itemById('iron_sword@3#ember1'))
    expect(game.baggage[0].id).toBe('iron_sword@3#ember1')
    expect(game.runes).toEqual({})
  })

  it('in the field, or at home without a workshop, takes a day for a Lesser rune and returns its events', () => {
    for (const where of ['field', 'no workshop'] as const) {
      const game = home(where === 'field' ? 1 : 0)
      if (where === 'field') intoField(game)
      game.runes = { stone1: 1 }
      const place = wield(game, 'iron_sword@3')
      const turn = game.world.turn
      const result = embed(game, place, 'stone1')
      expect(result.refusal).toBeNull()
      expect(game.world.turn).toBe(turn + 1)
      expect(game.party[0].equipment.mainHand!.id).toBe('iron_sword@3#stone1')
      expect(game.world.stock.gold).toBe(495)
    }
  })

  it('returns the events of the day it passes, as passTurn gives them', () => {
    // The first day in the field that brings an event, found on a scout game,
    // so that the embed's own day is one with something to return.
    const scout = home()
    intoField(scout)
    let quiet = 0
    while (passTurn(scout.world, scout.party).length === 0) quiet++
    const game = home()
    intoField(game)
    const twin = home()
    intoField(twin)
    for (let day = 0; day < quiet; day++) {
      passTurn(game.world, game.party)
      passTurn(twin.world, twin.party)
    }
    game.runes = { stone1: 1 }
    const place = wield(game, 'iron_sword@3')
    const expected = passTurn(twin.world, twin.party)
    expect(expected.length).toBeGreaterThan(0)
    const result = embed(game, place, 'stone1')
    expect(result.refusal).toBeNull()
    if (result.refusal === null) expect(result.events).toEqual(expected)
  })

  it('names a rune with the right article in its refusals', () => {
    const game = home(0)
    intoField(game)
    game.runes = { ember2: 1, acid1: 3 }
    const place = wield(game, 'iron_sword@3')
    refused(game, () => embed(game, place, 'ember2'), /; an Ember Rune needs the workshop/)
    refused(game, () => fuse(game, 'acid1'), /^Fusing to an Acid Rune needs a level 1 workshop/)
  })

  it('refuses a rune above rank 1 in the field, and anywhere among monsters', () => {
    const game = home()
    intoField(game)
    game.runes = { ember2: 1, ember1: 1 }
    const place = wield(game, 'iron_sword@3')
    refused(game, () => embed(game, place, 'ember2'), /Lesser.*workshop/)
    const among = home(0)
    among.runes = { ember1: 1 }
    const amongPlace = wield(among, 'iron_sword@3')
    const raiders = among.world.locations.find((l) => l.id === 'goblin_raiders')!
    while (!monstersHere(among.world)) travel(among.world, raiders.position, among.party)
    refused(among, () => embed(among, amongPlace, 'ember1'), /Nothing can be embedded/)
  })

  it('refuses, changing nothing: stale, no sockets, full, not held, Mind in a longsword, unaffordable', () => {
    const game = home()
    game.runes = { ember1: 3, mind1: 1 }
    const sword = wield(game, 'iron_sword@3')
    refused(game, () => embed(game, { ...sword, itemId: 'iron_dagger' }, 'ember1'), /no longer there/)
    const plain = wield(game, 'iron_sword')
    refused(game, () => embed(game, plain, 'ember1'), /no sockets/)
    const full = wield(game, 'iron_sword@3#ember1')
    refused(game, () => embed(game, full, 'ember1'), /full.*extract one first/)
    const longsword = wield(game, 'steel_longsword@3')
    refused(game, () => embed(game, longsword, 'storm1'), /pouch holds no Lesser Storm Rune/)
    refused(game, () => embed(game, longsword, 'mind1'), /wand or a staff/)
    game.world.stock = { gold: 4 }
    refused(game, () => embed(game, longsword, 'ember1'), /costs 5 gold/)
    expect(embedRefusal(game, longsword, 'ember1')).toMatch(/more than the stock/)
  })
})

describe('extract', () => {
  it('takes a rune back intact at a level 2 workshop, the rest closing up, for 10 gold a rank', () => {
    const game = home(EXTRACT_LEVEL)
    const place = wield(game, 'steel_longsword@3#ember2.storm1')
    const turn = game.world.turn
    const result = extract(game, place, 0)
    expect(result.refusal).toBeNull()
    expect(game.party[0].equipment.mainHand).toBe(itemById('steel_longsword@3#storm1'))
    expect(game.runes).toEqual({ ember2: 1 })
    expect(game.world.stock.gold).toBe(480)
    expect(game.world.turn).toBe(turn)
    if (result.refusal === null) expect(result.events).toEqual([])
    const last = extract(game, { ...place, itemId: 'steel_longsword@3#storm1' }, 0)
    expect(last.refusal).toBeNull()
    expect(game.party[0].equipment.mainHand).toBe(itemById('steel_longsword@3'))
    expect(game.runes).toEqual({ ember2: 1, storm1: 1 })
    expect(game.world.stock.gold).toBe(470)
  })

  it('refuses, changing nothing: at level 1, in the field, no rune there, unaffordable, stale', () => {
    const low = home(1)
    const lowPlace = wield(low, 'steel_longsword@3#ember1')
    refused(low, () => extract(low, lowPlace, 0), /level 2 workshop/)
    const field = home(2)
    intoField(field)
    const fieldPlace = wield(field, 'steel_longsword@3#ember1')
    refused(field, () => extract(field, fieldPlace, 0), /level 2 workshop.*Hearthold/)
    const game = home(2)
    const place = wield(game, 'steel_longsword@3#ember1')
    refused(game, () => extract(game, place, 1), /no rune there/)
    refused(game, () => extract(game, { ...place, itemId: 'steel_longsword@3' }, 0), /no longer there/)
    game.world.stock = { gold: 9 }
    refused(game, () => extract(game, place, 0), /costs 10 gold/)
    expect(extractRefusal(game, place, 0)).toMatch(/more than the stock/)
  })
})

describe('fuse', () => {
  it('makes three Lesser Storm Runes one Storm Rune at a level 1 workshop, for 20 gold', () => {
    const game = home(1)
    game.runes = { storm1: 3 }
    const turn = game.world.turn
    expect(fuse(game, 'storm1')).toBeNull()
    expect(game.runes).toEqual({ storm2: 1 })
    expect('storm1' in game.runes).toBe(false)
    expect(game.world.stock.gold).toBe(480)
    expect(game.world.turn).toBe(turn)
  })

  it('refuses, changing nothing: two only, in the field, unaffordable, from rank 4', () => {
    const game = home(1)
    game.runes = { storm1: 2, stone4: 3 }
    refused(game, () => fuse(game, 'storm1'), /3 of the Lesser Storm Rune; the pouch holds 2/)
    refused(game, () => fuse(game, 'stone4'), /highest/)
    const field = home(1)
    intoField(field)
    field.runes = { storm1: 3 }
    refused(field, () => fuse(field, 'storm1'), new RegExp(`level ${FUSE_LEVELS[2]} workshop`))
    const poor = home(1)
    poor.runes = { storm1: 3 }
    poor.world.stock = { gold: 19 }
    refused(poor, () => fuse(poor, 'storm1'), /costs 20 gold/)
  })

  it('names the level 4 workshop for a Greater rune before counting the runes', () => {
    const game = home(3)
    game.runes = { storm2: 1 }
    expect(fuseRefusal(game, 'storm2')).toMatch(/Greater Storm Rune needs a level 4 workshop/)
    refused(game, () => fuse(game, 'storm2'), /level 4/)
  })
})

describe('hit points', () => {
  it('a Life rune embedded in worn armour raises a full hero to the new maximum, and extracted takes it back down', () => {
    const game = home(EXTRACT_LEVEL)
    const hero = game.party[0]
    game.runes = { life1: 1 }
    const place = wear(game, 'steel_breastplate')
    const plain = maxHp(hero)
    hero.hp = plain
    expect(embed(game, place, 'life1').refusal).toBeNull()
    expect(maxHp(hero)).toBe(plain + 4)
    expect(hero.hp).toBe(plain + 4)
    expect(extract(game, { ...place, itemId: 'steel_breastplate#life1' }, 0).refusal).toBeNull()
    expect(maxHp(hero)).toBe(plain)
    expect(hero.hp).toBe(plain)
  })

  it('keeps a wounded hero at its share through the change', () => {
    const game = home(EXTRACT_LEVEL)
    const hero = game.party[0]
    const place = wear(game, 'steel_breastplate@3#life2.life2')
    const runed = maxHp(hero)
    hero.hp = Math.round(runed / 2)
    expect(extract(game, place, 0).refusal).toBeNull()
    expect(hero.hp).toBe(Math.round((Math.round(runed / 2) * (runed - 8)) / runed))
    expect(hero.hp).toBeLessThanOrEqual(maxHp(hero))
  })
})

describe('socketables', () => {
  it('lists the items with sockets in allPlaces order, with their sockets, and leaves out the rest', () => {
    const game = home()
    wield(game, 'steel_longsword@3#ember1')
    game.party[1].equipment.armor = itemById('steel_breastplate')!
    game.baggage.push(itemById('iron_sword')!, itemById('iron_sword@3')!)
    const listed = socketables(game).map(({ place, item, sockets }) => [place.from, item.id, sockets])
    expect(listed).toEqual([
      ['worn', 'steel_longsword@3#ember1', 2],
      ['worn', 'steel_breastplate', 1],
      ['baggage', 'iron_sword@3', 1],
    ])
  })
})
