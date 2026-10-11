import { describe, expect, it } from 'vitest'
import { EQUIPMENT_SLOT_ORDER, WEAPONS, describeItemStats } from './inventory.ts'

describe('inventory', () => {
  it('defines all eleven paperdoll slots exactly once', () => {
    expect(EQUIPMENT_SLOT_ORDER).toHaveLength(11)
    expect(new Set(EQUIPMENT_SLOT_ORDER).size).toBe(11)
  })

  it('describes item stats from data rather than hand-written text', () => {
    expect(describeItemStats({ damage: { count: 1, sides: 8, bonus: 2 } })).toEqual(['Damage: 1d8+2'])
    expect(describeItemStats({ damage: { count: 1, sides: 4, bonus: 0 }, attackApCost: 3 })).toEqual([
      'Damage: 1d4',
      'Attack Cost: 3 AP',
    ])
    expect(
      describeItemStats({ damage: { count: 1, sides: 8, bonus: 0 }, attackApCost: 5, attackRange: 5, twoHanded: true }),
    ).toEqual(['Damage: 1d8', 'Attack Cost: 5 AP', 'Range: 5 hexes', 'Two-handed'])
    expect(describeItemStats({ baseAc: 13 })).toEqual(['Armor Class: 13'])
    expect(describeItemStats({ acBonus: 2, attackBonus: 1 })).toEqual(['Armor Class: +2', 'Attack: +1'])
    expect(describeItemStats()).toEqual([])
  })

  it('lists weapons with unique ids, each a main-hand item with damage and an attack cost', () => {
    expect(new Set(WEAPONS.map((w) => w.id)).size).toBe(WEAPONS.length)
    for (const weapon of WEAPONS) {
      expect(weapon.slot).toBe('mainHand')
      expect(weapon.stats?.damage).toBeDefined()
      expect(weapon.stats?.attackApCost).toBeGreaterThan(0)
    }
  })

  it('makes the bow the only weapon that strikes at range', () => {
    expect(WEAPONS.filter((w) => (w.stats?.attackRange ?? 1) > 1).map((w) => w.id)).toEqual(['yew_bow'])
  })
})
