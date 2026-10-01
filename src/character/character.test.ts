import { describe, expect, it } from 'vitest'
import { BACKPACK_SIZE, IRON_SWORD, OAK_SHIELD, STEEL_ARMOR, type Item } from '../inventory/inventory.ts'
import { createWarrior, deriveCombatStats } from './character.ts'

describe('createWarrior', () => {
  it('starts at full HP with armor, sword and shield equipped and an empty backpack', () => {
    const warrior = createWarrior()
    expect(warrior.hp).toBe(warrior.base.maxHp)
    expect(warrior.equipment).toEqual({ armor: STEEL_ARMOR, mainHand: IRON_SWORD, offHand: OAK_SHIELD })
    expect(warrior.backpack).toHaveLength(BACKPACK_SIZE)
    expect(warrior.backpack.every((slot) => slot === null)).toBe(true)
  })

  it('returns independent characters so one playthrough cannot leak into the next', () => {
    const a = createWarrior()
    const b = createWarrior()
    a.hp = 1
    a.backpack[0] = IRON_SWORD
    delete a.equipment.offHand
    expect(b.hp).toBe(b.base.maxHp)
    expect(b.backpack[0]).toBeNull()
    expect(b.equipment.offHand).toBe(OAK_SHIELD)
  })
})

describe('deriveCombatStats', () => {
  it('derives the starting warrior stats from base stats and gear', () => {
    expect(deriveCombatStats(createWarrior())).toEqual({
      name: 'Warrior',
      maxHp: 20,
      ac: 15,
      attackBonus: 4,
      damage: { count: 1, sides: 8, bonus: 2 },
    })
  })

  it('falls back to unarmored AC and unarmed damage with nothing equipped', () => {
    const naked = { ...createWarrior(), equipment: {} }
    const stats = deriveCombatStats(naked)
    expect(stats.ac).toBe(10)
    expect(stats.damage).toEqual({ count: 1, sides: 2, bonus: 0 })
  })

  it('reflects equipment changes', () => {
    const warrior = createWarrior()
    delete warrior.equipment.offHand
    expect(deriveCombatStats(warrior).ac).toBe(13)

    const ring: Item = { ...STEEL_ARMOR, id: 'ring', slot: 'ring1', stats: { attackBonus: 1, acBonus: 1 } }
    warrior.equipment.ring1 = ring
    expect(deriveCombatStats(warrior)).toMatchObject({ ac: 14, attackBonus: 5 })
  })
})
