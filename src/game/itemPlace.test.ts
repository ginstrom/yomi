import { describe, expect, it } from 'vitest'
import { maxHp } from '../character/character.ts'
import { itemById } from '../inventory/inventory.ts'
import { newGame } from './gameState.ts'
import { allPlaces, itemAt, removeAt, replaceAt, type ItemPlace } from './itemPlace.ts'

describe('worn changes keep hit points within the maximum', () => {
  const lifeArmour = 'steel_breastplate@3#life2.life2'
  function dressed() {
    const game = newGame(undefined, null, 1, 'Hearthold')
    const hero = game.parties[0].members[0]
    hero.equipment.armor = itemById(lifeArmour)!
    hero.hp = maxHp(hero)
    const place: ItemPlace = { from: 'worn', party: 'party_1', member: 0, slot: 'armor', itemId: lifeArmour }
    return { game, hero, place }
  }

  it('replaceAt with plain armour keeps a full hero full at the lower maximum', () => {
    const { game, hero, place } = dressed()
    replaceAt(game, place, itemById('steel_breastplate@3')!)
    expect(hero.hp).toBe(maxHp(hero))
  })

  it('removeAt keeps a full hero full at the lower maximum', () => {
    const { game, hero, place } = dressed()
    const runed = maxHp(hero)
    removeAt(game, place)
    expect(maxHp(hero)).toBe(runed - 16)
    expect(hero.hp).toBe(runed - 16)
  })
})

describe('a place names its party', () => {
  it('is stale when its party is unknown', () => {
    const game = newGame(undefined, null, 1, 'Hearthold')
    const sword = game.parties[0].members[0].equipment.mainHand!
    const place: ItemPlace = { from: 'worn', party: 'party_1', member: 0, slot: 'mainHand', itemId: sword.id }
    expect(itemAt(game, place)).toBe(sword)
    expect(itemAt(game, { ...place, party: 'party_9' })).toBeNull()
  })

  it('lists a party’s places, each carrying the party’s id', () => {
    const game = newGame(undefined, null, 1, 'Hearthold')
    const party = game.parties[0]
    party.baggage.push(itemById('yew_bow')!)
    const places = allPlaces(game, party)
    expect(places.length).toBeGreaterThan(3)
    expect(places.every(({ place }) => place.party === party.id)).toBe(true)
    expect(places.at(-1)!.place).toEqual({ from: 'baggage', party: 'party_1', index: 0, itemId: 'yew_bow' })
    expect(allPlaces(game, party, false).some(({ place }) => place.from === 'worn')).toBe(false)
  })
})
