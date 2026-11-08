import { describe, expect, it } from 'vitest'
import { IRON_SWORD, STORM_WAND, itemById } from '../inventory/inventory.ts'
import { spend } from './buildings.ts'
import { craft, craftTier, craftables, options, upgradeWorkshop } from './crafting.ts'
import { presences } from './expedition.ts'
import { newGame, type GameState } from './gameState.ts'
import { replaceAt, type ItemPlace } from './itemPlace.ts'
import { locationAt, monstersHere, passTurn, travel } from './worldMap.ts'

/** A new game at home, the stock full of everything crafting asks. */
function home() {
  const game = newGame(undefined, null, 1, 'Hearthold')
  game.world.stock = { gold: 500, iron: 100, timber: 100, stone: 100, copper: 100, crystal: 100 }
  return game
}
/** The soldier's longsword, as worn. */
const sword = (game: ReturnType<typeof newGame>): ItemPlace => ({ from: 'worn', party: 'party_1', member: 0, slot: 'mainHand', itemId: game.parties[0].members[0].equipment.mainHand!.id })
/** One step off the encampment: the field. */
const intoField = (game: ReturnType<typeof newGame>) => (game.parties[0].position = { q: game.parties[0].position.q + 1, r: game.parties[0].position.r })

describe('crafting', () => {
  it('crafts a Balanced longsword in the field: a day passes and the stock falls', () => {
    const game = home()
    intoField(game)
    expect(locationAt(game.world, game.parties[0].position)).toBeNull()
    expect(craftTier(game.world, game.parties[0])).toBe('field')
    expect(game.parties[0].members[0].equipment.mainHand).toBe(IRON_SWORD)
    const offered = options(game, sword(game))
    expect(offered.map((o) => `${o.modifier.id}${o.grade}`)).toEqual(['balanced1'])
    const turn = game.world.turn
    const result = craft(game, sword(game), 'balanced', 1)
    expect(result.refusal).toBeNull()
    expect(game.parties[0].members[0].equipment.mainHand).toBe(itemById('iron_sword+balanced1'))
    expect(game.world.turn).toBe(turn + 1)
    expect(game.world.stock).toMatchObject({ gold: 495, iron: 95 })
  })

  it('refuses a workshop modifier or a higher grade in the field', () => {
    const game = home()
    intoField(game)
    expect(craft(game, sword(game), 'keen', 1).refusal).toMatch(/level 1 workshop/)
    expect(craft(game, sword(game), 'balanced', 2).refusal).toMatch(/grade 1 only/)
    expect(craft(game, sword(game), 'recurve', 1).refusal).toMatch(/does not fit/)
    expect(game.parties[0].members[0].equipment.mainHand).toBe(IRON_SWORD)
    expect(game.world.stock.gold).toBe(500)
  })

  it('pays timber for a bow at grade 1', () => {
    const game = home()
    intoField(game)
    const bow = { from: 'worn' as const, party: 'party_1', member: 1, slot: 'mainHand' as const, itemId: 'yew_bow' }
    expect(options(game, bow)[0].cost).toEqual({ gold: 5, timber: 5 })
  })

  it('at a level 2 workshop replaces a modifier with a higher grade, then with another, in no time', () => {
    const game = home()
    game.parties[0].members[0].equipment.mainHand = itemById('iron_sword+balanced1')
    expect(upgradeWorkshop(game, game.parties[0])).toBeNull()
    expect(upgradeWorkshop(game, game.parties[0])).toBeNull()
    expect(craftTier(game.world, game.parties[0])).toBe(2)
    const turn = game.world.turn
    const ids = options(game, sword(game)).map((o) => `${o.modifier.id}${o.grade}`)
    expect(ids).toEqual(['balanced1', 'balanced2', 'keen1', 'keen2', 'light1', 'light2'])
    expect(craft(game, sword(game), 'balanced', 2).refusal).toBeNull()
    expect(game.parties[0].members[0].equipment.mainHand!.id).toBe('iron_sword+balanced2')
    expect(game.world.stock).toMatchObject({ copper: 95 })
    expect(craft(game, sword(game), 'light', 1).refusal).toBeNull()
    expect(game.parties[0].members[0].equipment.mainHand!.id).toBe('iron_sword+light1')
    expect(game.parties[0].members[0].equipment.mainHand!.stats!.attackApCost).toBe(4)
    expect(game.world.turn).toBe(turn)
  })

  it('keeps a grade under a modifier', () => {
    const game = home()
    game.parties[0].baggage.push(itemById('iron_breastplate@2')!)
    game.world.workshop = 2
    const place: ItemPlace = { from: 'baggage', party: 'party_1', index: 0, itemId: 'iron_breastplate@2' }
    expect(craft(game, place, 'reinforced', 1).refusal).toBeNull()
    expect(game.parties[0].baggage[0].id).toBe('iron_breastplate@2+reinforced1')
  })

  it('keeps the runes of a runed item, worn or in the baggage', () => {
    const game = home()
    game.world.workshop = 2
    game.parties[0].members[0].equipment.mainHand = itemById('iron_sword@3#ember1')
    expect(craftables(game, game.parties[0]).some(({ item }) => item.id === 'iron_sword@3#ember1')).toBe(true)
    expect(craft(game, sword(game), 'balanced', 2).refusal).toBeNull()
    expect(game.parties[0].members[0].equipment.mainHand).toBe(itemById('iron_sword@3+balanced2#ember1'))
    game.parties[0].baggage.push(itemById('steel_breastplate@3+reinforced1#stone1.life1')!)
    const place: ItemPlace = { from: 'baggage', party: 'party_1', index: 0, itemId: 'steel_breastplate@3+reinforced1#stone1.life1' }
    expect(craft(game, place, 'reinforced', 2).refusal).toBeNull()
    expect(game.parties[0].baggage[0]).toBe(itemById('steel_breastplate@3+reinforced2#stone1.life1'))
    expect(game.parties[0].baggage[0].runes).toEqual(['stone1', 'life1'])
  })

  it('never works an enchanted item, and lists it nowhere', () => {
    const game = home()
    game.parties[0].baggage.push(STORM_WAND)
    game.world.workshop = 3
    expect(craft(game, { from: 'baggage', party: 'party_1', index: 0, itemId: 'storm_wand' }, 'balanced', 1).refusal).toMatch(/enchanted/)
    expect(craftables(game, game.parties[0]).some(({ item }) => item === STORM_WAND)).toBe(false)
  })

  it('greys an item whose modifiers all need a workshop', () => {
    const game = home()
    intoField(game)
    const axe = craftables(game, game.parties[0]).find(({ item }) => item.id === 'iron_battle_axe')!
    expect(axe.refusal).toMatch(/level 1 workshop/)
    expect(craftables(game, game.parties[0]).find(({ item }) => item.id === 'iron_sword')!.refusal).toBeNull()
  })

  it('refuses without the stock, or a stale selection, changing nothing', () => {
    const game = home()
    intoField(game)
    game.world.stock = { gold: 4, iron: 100 }
    expect(craft(game, sword(game), 'balanced', 1).refusal).toMatch(/more than the stock/)
    expect(craft(game, { ...sword(game), itemId: 'iron_dagger' }, 'balanced', 1).refusal).toMatch(/no longer there/)
    expect(game.world.stock.gold).toBe(4)
  })

  it('is refused in the field among monsters', () => {
    const game = home()
    const raiders = game.world.locations.find((l) => l.id === 'goblin_raiders')!
    while (!monstersHere(game.world, game.parties[0])) travel(game, game.parties[0], raiders.position)
    expect(craft(game, sword(game), 'balanced', 1).refusal).toMatch(/Nothing can be crafted/)
    expect(options(game, sword(game))[0].refusal).toMatch(/Nothing can be crafted/)
  })
})

describe('craft, as it is (characterization)', () => {
  /** Two games in the field, built alike, each moved on to the first day that brings an event. */
  function eventfulTwins(): [GameState, GameState] {
    const field = () => {
      const game = home()
      intoField(game)
      return game
    }
    const scout = field()
    let quiet = 0
    while (passTurn(scout.world, presences(scout.parties)).length === 0) quiet++
    const make = () => {
      const game = field()
      for (let day = 0; day < quiet; day++) passTurn(game.world, presences(game.parties))
      return game
    }
    return [make(), make()]
  }

  it('in the field spends, replaces the item and then passes the day: the same result, events and game as by hand', () => {
    const [now, then] = eventfulTwins()
    const turn = now.world.turn
    const option = options(then, sword(then)).find((o) => o.modifier.id === 'balanced' && o.grade === 1)!
    spend(then.world.stock, option.cost)
    replaceAt(then, sword(then), option.result)
    const events = passTurn(then.world, presences(then.parties))
    expect(events.length).toBeGreaterThan(0)
    expect(craft(now, sword(now), 'balanced', 1)).toEqual({ refusal: null, item: itemById('iron_sword+balanced1'), events })
    expect(now.world.turn).toBe(turn + 1)
    expect(now.parties[0].confronting).toBeNull()
    expect(JSON.stringify(now)).toBe(JSON.stringify(then))
  })

  it('at a workshop passes no day and returns no events', () => {
    const game = home()
    game.world.workshop = 1
    const turn = game.world.turn
    expect(craft(game, sword(game), 'keen', 1)).toEqual({ refusal: null, item: itemById('iron_sword+keen1'), events: [] })
    expect(game.world.turn).toBe(turn)
  })

  it.each(['lost', 'won'] as const)('is refused, changing nothing, once the game is %s, in the field or at the workshop', (status) => {
    for (const workshop of [0, 1]) {
      const game = home()
      game.world.workshop = workshop
      if (workshop === 0) intoField(game)
      game.world.status = status
      const before = JSON.stringify(game)
      expect(craft(game, sword(game), 'balanced', 1)).toEqual({ refusal: 'Nothing can be crafted here now.' })
      expect(JSON.stringify(game)).toBe(before)
    }
  })

  it('is refused, changing nothing, without the stock or for a stale place', () => {
    const poor = home()
    intoField(poor)
    poor.world.stock = { gold: 4, iron: 100 }
    const stale = home()
    intoField(stale)
    for (const [game, place, pattern] of [
      [poor, sword(poor), /more than the stock/],
      [stale, { ...sword(stale), itemId: 'iron_dagger' }, /no longer there/],
    ] as const) {
      const before = JSON.stringify(game)
      expect(craft(game, place, 'balanced', 1).refusal).toMatch(pattern)
      expect(JSON.stringify(game)).toBe(before)
    }
  })
})
