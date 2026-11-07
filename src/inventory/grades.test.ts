import { describe, expect, it } from 'vitest'
import { createWarrior, maxHp } from '../character/character.ts'
import { GRADES, gradedStats } from './grades.ts'
import { BASE_ITEMS, IRON_SWORD, MAGIC_ITEMS, baseItem, craftedItem, itemById, unmodified, type ItemStats } from './inventory.ts'
import { modifiersFor } from './modifiers.ts'

const avg = (s: ItemStats) => (s.damage ? (s.damage.count * (s.damage.sides + 1)) / 2 + s.damage.bonus : 0)
/** Each number an item is judged by, larger meaning better. */
const merits = (s: ItemStats) => ({
  damage: avg(s),
  toHit: s.toHit ?? 0,
  crit: s.critChance ?? 0,
  pierce: s.armorPierce ?? 0,
  ac: s.acBonus ?? 0,
  resistance: s.resistance ?? 0,
  ap: -(s.attackApCost ?? 0),
  range: s.attackRange ?? 0,
})

describe('the gear ladder', () => {
  it('keeps the plain ids as they are, grade 1 and unmodified', () => {
    expect(itemById('iron_sword')).toBe(IRON_SWORD)
    expect(itemById('iron_sword@1')).toBeUndefined()
  })

  it('builds Fine and Masterwork longswords with more damage and the same AP and range', () => {
    const fine = itemById('iron_sword@2')!
    const masterwork = itemById('iron_sword@3')!
    expect(fine.name).toBe('Fine Iron Longsword')
    expect(masterwork.name).toBe('Masterwork Iron Longsword')
    expect(fine.stats!.damage!.bonus).toBe(4)
    expect(masterwork.stats!.damage!.bonus).toBe(5)
    expect(masterwork.stats!.toHit).toBe(5)
    for (const item of [fine, masterwork]) {
      expect(item.stats!.attackApCost).toBe(5)
      expect(item.stats!.attackRange).toBeUndefined()
      expect(item.stats!.armorPierce).toBe(1)
    }
    expect(itemById('oak_shield@3')!.stats!.acBonus).toBe(16)
    // Armour's grade adds to what it stops, not to its armour class.
    expect(itemById('iron_breastplate@3')!.stats).toMatchObject({ acBonus: 10, resistance: 4 })
  })

  it('names a modified item with its modifier first and its grade last', () => {
    expect(itemById('iron_sword@2+balanced2')!.name).toBe('Balanced Fine Iron Longsword (II)')
    expect(itemById('iron_sword@3+light2')!.stats!.attackApCost).toBe(4)
  })

  it('refuses ids that are not items', () => {
    for (const id of ['iron_sword@4', 'iron_sword+balanced4', 'iron_sword+recurve1', 'storm_wand@2', 'spark_wand+keen1', 'nothing@2', 'iron_sword+balanced', 'Iron_sword']) {
      expect(itemById(id), id).toBeUndefined()
    }
  })

  it('builds every grade of every base with every fitting modifier, each one object, round-tripping its id', () => {
    const hero = createWarrior()
    const hp = maxHp(hero)
    for (const base of BASE_ITEMS) {
      for (const grade of GRADES) {
        const graded = craftedItem(base, grade)
        expect(itemById(graded.id)).toBe(graded)
        expect(baseItem(graded)).toBe(base)
        const plain = base.stats!
        expect(graded.stats!.attackApCost).toBe(plain.attackApCost)
        expect(graded.stats!.attackRange).toBe(plain.attackRange)
        expect(graded.stats!.armorPierce).toBe(plain.armorPierce)
        expect(graded.stats!.twoHanded).toBe(plain.twoHanded)
        for (const mod of modifiersFor(base.family!)) {
          for (const modGrade of GRADES) {
            const made = craftedItem(base, grade, { id: mod.id, grade: modGrade })
            expect(itemById(made.id)).toBe(made)
            expect(unmodified(made)).toBe(graded)
            expect([made.icon, made.slot]).toEqual([base.icon, base.slot])
            const before = merits(graded.stats!)
            const after = merits(made.stats!)
            const keys = Object.keys(before) as (keyof typeof before)[]
            expect(keys.some((k) => after[k] > before[k]), made.id).toBe(true)
            expect(keys.some((k) => after[k] < before[k]), made.id).toBe(true)
            hero.equipment[made.slot] = made
            expect(maxHp(hero)).toBe(hp)
          }
        }
      }
    }
  })

  it('grades by gear class: a weapon damage, a shield armour class, body armour resistance, a small slot armour class', () => {
    expect(gradedStats({ damage: { count: 1, sides: 6, bonus: 0 } }, 2, 'weapon')).toEqual({ damage: { count: 1, sides: 6, bonus: 1 } })
    expect(gradedStats({ damage: { count: 1, sides: 6, bonus: 0 } }, 3, 'weapon')).toEqual({ damage: { count: 1, sides: 6, bonus: 2 }, toHit: 5 })
    // The tower shield and the helm have resistance, but a shield and a small slot grade armour class.
    expect(itemById('iron_tower_shield@2')!.stats).toMatchObject({ acBonus: 19, resistance: 1 })
    expect(itemById('iron_tower_shield@3')!.stats).toMatchObject({ acBonus: 22, resistance: 1 })
    expect(itemById('iron_helm@2')!.stats).toMatchObject({ acBonus: 3, resistance: 1 })
    expect(itemById('iron_helm@3')!.stats).toMatchObject({ acBonus: 4, resistance: 1 })
    // The robe has no resistance, and gains it from 0.
    expect(itemById('linen_robe@2')!.stats).toEqual({ maxMana: 6, spellSkill: 5, resistance: 1 })
    expect(itemById('linen_robe@3')!.stats).toEqual({ maxMana: 6, spellSkill: 5, resistance: 2 })
    // Gloves and a cap: armour class +1 and +2, from 0 for the gloves.
    expect(itemById('leather_gloves@2')!.stats).toEqual({ toHit: 2, acBonus: 1 })
    expect(itemById('leather_gloves@3')!.stats).toEqual({ toHit: 2, acBonus: 2 })
    expect(itemById('leather_cap@3')!.stats).toEqual({ acBonus: 5 })
    // A grade never touches a weight.
    expect(itemById('iron_plate@3')!.stats).toMatchObject({ strength: 6, apPenalty: 1, spellSkill: -15, resistance: 6 })
  })

  it('leaves enchanted items outside the ladder', () => {
    for (const item of MAGIC_ITEMS) expect(baseItem(item)).toBeNull()
  })
})
