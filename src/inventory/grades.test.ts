import { describe, expect, it } from 'vitest'
import { createWarrior, maxHp } from '../character/character.ts'
import { GRADES } from './grades.ts'
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
      expect(item.stats!.armorPierce).toBe(15)
    }
    expect(itemById('oak_shield@3')!.stats!.acBonus).toBe(16)
  })

  it('names a modified item with its modifier first and its grade last', () => {
    expect(itemById('iron_sword@2+balanced2')!.name).toBe('Balanced Fine Iron Longsword (II)')
    expect(itemById('iron_sword@3+light2')!.stats!.attackApCost).toBe(4)
  })

  it('refuses ids that are not items', () => {
    for (const id of ['iron_sword@4', 'iron_sword+balanced4', 'iron_sword+recurve1', 'spark_wand@2', 'spark_wand+keen1', 'nothing@2', 'iron_sword+balanced', 'Iron_sword']) {
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
        for (const mod of modifiersFor(base.id)) {
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

  it('leaves enchanted items outside the ladder', () => {
    for (const item of MAGIC_ITEMS) expect(baseItem(item)).toBeNull()
  })
})
