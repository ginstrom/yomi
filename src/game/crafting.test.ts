import { describe, expect, it } from 'vitest'
import { IRON_SWORD, STORM_WAND, itemById } from '../inventory/inventory.ts'
import { craft, craftTier, craftables, options, upgradeWorkshop } from './crafting.ts'
import { newGame } from './gameState.ts'
import type { ItemPlace } from './itemPlace.ts'
import { locationAt, monstersHere, travel } from './worldMap.ts'

/** A new game at home, the stock full of everything crafting asks. */
function home() {
  const game = newGame(undefined, null, 1, 'Hearthold')
  game.world.stock = { gold: 500, iron: 100, timber: 100, stone: 100, copper: 100, crystal: 100 }
  return game
}
/** The soldier's longsword, as worn. */
const sword = (game: ReturnType<typeof newGame>): ItemPlace => ({ from: 'worn', member: 0, slot: 'mainHand', itemId: game.party[0].equipment.mainHand!.id })
/** One step off the encampment: the field. */
const intoField = (game: ReturnType<typeof newGame>) => (game.world.party = { q: game.world.party.q + 1, r: game.world.party.r })

describe('crafting', () => {
  it('crafts a Balanced longsword in the field: a day passes and the stock falls', () => {
    const game = home()
    intoField(game)
    expect(locationAt(game.world, game.world.party)).toBeNull()
    expect(craftTier(game.world)).toBe('field')
    expect(game.party[0].equipment.mainHand).toBe(IRON_SWORD)
    const offered = options(game, sword(game))
    expect(offered.map((o) => `${o.modifier.id}${o.grade}`)).toEqual(['balanced1'])
    const turn = game.world.turn
    const result = craft(game, sword(game), 'balanced', 1)
    expect(result.refusal).toBeNull()
    expect(game.party[0].equipment.mainHand).toBe(itemById('iron_sword+balanced1'))
    expect(game.world.turn).toBe(turn + 1)
    expect(game.world.stock).toMatchObject({ gold: 495, iron: 95 })
  })

  it('refuses a workshop modifier or a higher grade in the field', () => {
    const game = home()
    intoField(game)
    expect(craft(game, sword(game), 'keen', 1).refusal).toMatch(/level 1 workshop/)
    expect(craft(game, sword(game), 'balanced', 2).refusal).toMatch(/grade 1 only/)
    expect(craft(game, sword(game), 'recurve', 1).refusal).toMatch(/does not fit/)
    expect(game.party[0].equipment.mainHand).toBe(IRON_SWORD)
    expect(game.world.stock.gold).toBe(500)
  })

  it('pays timber for a bow at grade 1', () => {
    const game = home()
    intoField(game)
    const bow = { from: 'worn' as const, member: 1, slot: 'mainHand' as const, itemId: 'yew_bow' }
    expect(options(game, bow)[0].cost).toEqual({ gold: 5, timber: 5 })
  })

  it('at a level 2 workshop replaces a modifier with a higher grade, then with another, in no time', () => {
    const game = home()
    game.party[0].equipment.mainHand = itemById('iron_sword+balanced1')
    expect(upgradeWorkshop(game)).toBeNull()
    expect(upgradeWorkshop(game)).toBeNull()
    expect(craftTier(game.world)).toBe(2)
    const turn = game.world.turn
    const ids = options(game, sword(game)).map((o) => `${o.modifier.id}${o.grade}`)
    expect(ids).toEqual(['balanced1', 'balanced2', 'keen1', 'keen2', 'light1', 'light2'])
    expect(craft(game, sword(game), 'balanced', 2).refusal).toBeNull()
    expect(game.party[0].equipment.mainHand!.id).toBe('iron_sword+balanced2')
    expect(game.world.stock).toMatchObject({ copper: 95 })
    expect(craft(game, sword(game), 'light', 1).refusal).toBeNull()
    expect(game.party[0].equipment.mainHand!.id).toBe('iron_sword+light1')
    expect(game.party[0].equipment.mainHand!.stats!.attackApCost).toBe(4)
    expect(game.world.turn).toBe(turn)
  })

  it('keeps a grade under a modifier', () => {
    const game = home()
    game.baggage.push(itemById('iron_breastplate@2')!)
    game.world.workshop = 2
    const place: ItemPlace = { from: 'baggage', index: 0, itemId: 'iron_breastplate@2' }
    expect(craft(game, place, 'reinforced', 1).refusal).toBeNull()
    expect(game.baggage[0].id).toBe('iron_breastplate@2+reinforced1')
  })

  it('never works an enchanted item, and lists it nowhere', () => {
    const game = home()
    game.baggage.push(STORM_WAND)
    game.world.workshop = 3
    expect(craft(game, { from: 'baggage', index: 0, itemId: 'storm_wand' }, 'balanced', 1).refusal).toMatch(/enchanted/)
    expect(craftables(game).some(({ item }) => item === STORM_WAND)).toBe(false)
  })

  it('greys an item whose modifiers all need a workshop', () => {
    const game = home()
    intoField(game)
    const axe = craftables(game).find(({ item }) => item.id === 'iron_battle_axe')!
    expect(axe.refusal).toMatch(/level 1 workshop/)
    expect(craftables(game).find(({ item }) => item.id === 'iron_sword')!.refusal).toBeNull()
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
    while (!monstersHere(game.world)) travel(game.world, raiders.position, game.party)
    expect(craft(game, sword(game), 'balanced', 1).refusal).toMatch(/Nothing can be crafted/)
    expect(options(game, sword(game))[0].refusal).toMatch(/Nothing can be crafted/)
  })
})
