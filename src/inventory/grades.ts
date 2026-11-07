import { gearClass, type GearClass } from './catalog.ts'
import type { Item, ItemStats } from './inventory.ts'

/**
 * The grades of a plain item (docs/designs/expeditions-and-encampment.md
 * §4.1): plain, Fine and Masterwork, sold by the trading post. A grade adds
 * by the item's gear class (catalog.ts): damage (and at the top, to hit) to a
 * weapon, armour class to a shield or a small-slot item (head, gloves, boots),
 * and resistance to body armour, the robe included; it never changes attack
 * AP, range, piercing, two-handedness, strength or a penalty, so a weapon
 * keeps its place among the AP thresholds.
 */

export type Grade = 1 | 2 | 3
export const GRADES: readonly Grade[] = [1, 2, 3]
export const MAX_GRADE: Grade = 3

interface GradeDef {
  /** Put before the item's name: nothing for a plain item. */
  prefix: string
  /** What it adds to a weapon's damage bonus, and to its chance to hit. */
  damage: number
  toHit: number
  /** What it adds to a shield's armour class, and to body armour's resistance. */
  ac: number
  resistance: number
  /** What it adds to a small-slot item's armour class. */
  small: number
}

export const GRADE_DEFS: Record<Grade, GradeDef> = {
  1: { prefix: '', damage: 0, toHit: 0, ac: 0, resistance: 0, small: 0 },
  2: { prefix: 'Fine ', damage: 1, toHit: 0, ac: 3, resistance: 1, small: 1 },
  3: { prefix: 'Masterwork ', damage: 2, toHit: 5, ac: 6, resistance: 2, small: 2 },
}

export function isGrade(n: number): n is Grade {
  return (GRADES as readonly number[]).includes(n)
}

/** Grade 2 as "II", for a modifier's grade in an item's name. */
export function gradeNumeral(grade: Grade): string {
  return ['I', 'II', 'III'][grade - 1]
}

/** What `grade` makes of the stats of a plain item of gear class `cls`. */
export function gradedStats(stats: ItemStats, grade: Grade, cls: GearClass): ItemStats {
  const def = GRADE_DEFS[grade]
  const graded = { ...stats }
  if (grade === 1) return graded
  if (cls === 'weapon') {
    if (stats.damage) graded.damage = { ...stats.damage, bonus: stats.damage.bonus + def.damage }
    if (def.toHit) graded.toHit = (stats.toHit ?? 0) + def.toHit
  } else if (cls === 'armour') {
    graded.resistance = (stats.resistance ?? 0) + def.resistance
  } else {
    graded.acBonus = (stats.acBonus ?? 0) + (cls === 'shield' ? def.ac : def.small)
  }
  return graded
}

/** The plain item `base` at `grade`: grade 1 is `base` itself. Its id is `<base>@<grade>`. */
export function gradedItem(base: Item, grade: Grade): Item {
  if (grade === 1) return base
  return {
    ...base,
    id: `${base.id}@${grade}`,
    name: `${GRADE_DEFS[grade].prefix}${base.name}`,
    stats: gradedStats(base.stats ?? {}, grade, gearClass(base.slot)),
    base: base.id,
    grade,
  }
}
