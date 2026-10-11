import { describe, expect, it } from 'vitest'
import { EQUIPMENT_SLOT_ORDER, MAGIC_ITEMS, WEAPONS, describeItemStats } from './inventory.ts'

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
    expect(describeItemStats({ acBonus: 10, toHit: 5 })).toEqual(['Armor Class: +10', 'To Hit: +5%'])
    expect(describeItemStats({ skill: 'magic', maxMana: 6, spellSkill: 10, critChance: 5 })).toEqual([
      'Strikes with Magic',
      'Mana: +6',
      'Spell Skill: +10%',
      'Critical: +5%',
    ])
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

  it('keeps the magic items apart from the plain weapons, each with an id of its own', () => {
    expect(MAGIC_ITEMS).toHaveLength(9)
    expect(new Set([...WEAPONS, ...MAGIC_ITEMS].map((item) => item.id)).size).toBe(WEAPONS.length + 9)
    for (const item of MAGIC_ITEMS) expect(describeItemStats(item.stats).length).toBeGreaterThan(0)
    // A ring fits either ring slot; nothing gives hit points, which gear must not change.
    expect(MAGIC_ITEMS.filter((item) => item.ring).map((item) => item.slot)).toEqual(['ring1', 'ring1'])
    expect(MAGIC_ITEMS.filter((item) => item.stats?.skill === 'magic').map((item) => item.id)).toEqual([
      'spark_wand',
      'storm_wand',
    ])
    expect(new Set(MAGIC_ITEMS.map((item) => item.slot))).toEqual(new Set(['mainHand', 'ring1', 'neck', 'head', 'cloak']))
  })

  it('makes the bow the only weapon that strikes at range', () => {
    expect(WEAPONS.filter((w) => (w.stats?.attackRange ?? 1) > 1).map((w) => w.id)).toEqual(['yew_bow'])
  })
})
