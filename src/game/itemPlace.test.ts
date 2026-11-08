import { describe, expect, it } from 'vitest'
import { maxHp } from '../character/character.ts'
import { itemById } from '../inventory/inventory.ts'
import { leader, newGame } from './gameState.ts'
import { removeAt, replaceAt, type ItemPlace } from './itemPlace.ts'

describe('worn changes keep hit points within the maximum', () => {
  const lifeArmour = 'steel_breastplate@3#life2.life2'
  function dressed() {
    const game = newGame(undefined, null, 1, 'Hearthold')
    const hero = leader(game).members[0]
    hero.equipment.armor = itemById(lifeArmour)!
    hero.hp = maxHp(hero)
    const place: ItemPlace = { from: 'worn', member: 0, slot: 'armor', itemId: lifeArmour }
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
