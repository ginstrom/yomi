import { describe, expect, it } from 'vitest'
import { EQUIPMENT_SLOT_ORDER, describeItemStats } from './inventory.ts'

describe('inventory', () => {
  it('defines all eleven paperdoll slots exactly once', () => {
    expect(EQUIPMENT_SLOT_ORDER).toHaveLength(11)
    expect(new Set(EQUIPMENT_SLOT_ORDER).size).toBe(11)
  })

  it('describes item stats from data rather than hand-written text', () => {
    expect(describeItemStats({ damage: { count: 1, sides: 8, bonus: 2 } })).toEqual(['Damage: 1d8+2'])
    expect(describeItemStats({ baseAc: 13 })).toEqual(['Armor Class: 13'])
    expect(describeItemStats({ acBonus: 2, attackBonus: 1 })).toEqual(['Armor Class: +2', 'Attack: +1'])
    expect(describeItemStats()).toEqual([])
  })
})
