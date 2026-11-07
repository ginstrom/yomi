import type { Item, ItemStats } from './inventory.ts'

/**
 * The grades of a plain item (docs/designs/expeditions-and-encampment.md
 * §4.1): plain, Fine and Masterwork, sold by the trading post. A grade adds
 * damage (and at the top, to hit) to a weapon, armour class to a shield and
 * resistance to armour; it never changes attack AP, range, piercing or two-handedness, so a
 * weapon keeps its place among the AP thresholds.
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
  /** What it adds to a shield's armour class, and to armour's resistance. */
  ac: number
  resistance: number
}

export const GRADE_DEFS: Record<Grade, GradeDef> = {
  1: { prefix: '', damage: 0, toHit: 0, ac: 0, resistance: 0 },
  2: { prefix: 'Fine ', damage: 1, toHit: 0, ac: 3, resistance: 1 },
  3: { prefix: 'Masterwork ', damage: 2, toHit: 5, ac: 6, resistance: 2 },
}

export function isGrade(n: number): n is Grade {
  return (GRADES as readonly number[]).includes(n)
}

/** Grade 2 as "II", for a modifier's grade in an item's name. */
export function gradeNumeral(grade: Grade): string {
  return ['I', 'II', 'III'][grade - 1]
}

/** What `grade` makes of a plain item's stats. */
export function gradedStats(stats: ItemStats, grade: Grade): ItemStats {
  const def = GRADE_DEFS[grade]
  const graded = { ...stats }
  if (stats.damage) {
    graded.damage = { ...stats.damage, bonus: stats.damage.bonus + def.damage }
    if (def.toHit) graded.toHit = (stats.toHit ?? 0) + def.toHit
  } else if (stats.resistance !== undefined && def.resistance) {
    graded.resistance = stats.resistance + def.resistance
  } else if (stats.acBonus !== undefined && def.ac) {
    graded.acBonus = stats.acBonus + def.ac
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
    stats: gradedStats(base.stats ?? {}, grade),
    base: base.id,
    grade,
  }
}
