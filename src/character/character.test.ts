import { describe, expect, it } from 'vitest'
import {
  BACKPACK_SIZE,
  IRON_DAGGER,
  IRON_SWORD,
  OAK_SHIELD,
  STEEL_ARMOR,
  STEEL_GREATSWORD,
  WEAPONS,
  YEW_BOW,
  type Item,
} from '../inventory/inventory.ts'
import { createWarrior, deriveCombatStats } from './character.ts'

describe('createWarrior', () => {
  it('starts at full HP with armor, sword and shield equipped and the other weapons in the backpack', () => {
    const warrior = createWarrior()
    expect(warrior.hp).toBe(warrior.base.maxHp)
    expect(warrior.equipment).toEqual({ armor: STEEL_ARMOR, mainHand: IRON_SWORD, offHand: OAK_SHIELD })
    expect(warrior.backpack).toHaveLength(BACKPACK_SIZE)
    const carried = warrior.backpack.filter((slot) => slot !== null)
    expect(carried).toEqual(WEAPONS.filter((weapon) => weapon !== IRON_SWORD))
  })

  it('returns independent characters so one playthrough cannot leak into the next', () => {
    const a = createWarrior()
    const b = createWarrior()
    a.hp = 1
    a.backpack[0] = null
    delete a.equipment.offHand
    expect(b.hp).toBe(b.base.maxHp)
    expect(b.backpack[0]).toBe(IRON_DAGGER)
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
      attackApCost: 5,
      attackRange: 1,
      actionPoints: 8,
    })
  })

  it('falls back to unarmored AC and an unarmed attack with nothing equipped', () => {
    const naked = { ...createWarrior(), equipment: {} }
    const stats = deriveCombatStats(naked)
    expect(stats.ac).toBe(10)
    expect(stats.damage).toEqual({ count: 1, sides: 2, bonus: 0 })
    expect(stats.attackApCost).toBe(3)
  })

  it('takes the attack cost from the weapon in hand', () => {
    const warrior = createWarrior()
    warrior.equipment.mainHand = { ...IRON_SWORD, id: 'dagger', stats: { ...IRON_SWORD.stats, attackApCost: 2 } }
    expect(deriveCombatStats(warrior).attackApCost).toBe(2)
  })

  it('takes the reach of a ranged weapon, and 1 hex otherwise', () => {
    const warrior = createWarrior()
    expect(deriveCombatStats({ ...warrior, equipment: {} }).attackRange).toBe(1)
    warrior.equipment.mainHand = YEW_BOW
    expect(deriveCombatStats(warrior)).toMatchObject({ attackRange: 5, damage: YEW_BOW.stats!.damage })
  })

  it('gets nothing from a shield while wielding a two-handed weapon', () => {
    const warrior = createWarrior()
    warrior.equipment.mainHand = STEEL_GREATSWORD
    expect(deriveCombatStats(warrior).ac).toBe(13)
    warrior.equipment.mainHand = IRON_DAGGER
    expect(deriveCombatStats(warrior).ac).toBe(15)
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
