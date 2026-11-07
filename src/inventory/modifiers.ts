import type { FamilyId } from './catalog.ts'
import { gradeNumeral, type Grade } from './grades.ts'
import type { Item, ItemStats } from './inventory.ts'

/**
 * The modifiers crafting puts on a plain item (docs/designs/expeditions-and-encampment.md
 * §4.3): each makes it better at one thing and worse at another, at a grade
 * of its own. An item carries one at most; working it again replaces it.
 */

export type ModifierId = 'balanced' | 'recurve' | 'bearded' | 'keen' | 'braced' | 'light' | 'long' | 'reinforced'

export interface Modifier {
  id: ModifierId
  name: string
  /** The families it can be put on, every tier of each. */
  fits: readonly FamilyId[]
  /** The workshop level that makes it: 0 for one made in the field. */
  unlock: number
  /** What it does to an item's stats at a grade. */
  apply: (stats: ItemStats, grade: Grade) => ItemStats
  /** Its better and worse sides at a grade, in words. */
  better: (grade: Grade) => string
  worse: (grade: Grade) => string
}

const addDamage = (stats: ItemStats, by: number): ItemStats =>
  stats.damage ? { ...stats, damage: { ...stats.damage, bonus: stats.damage.bonus + by } } : stats
const add = (stats: ItemStats, key: 'toHit' | 'critChance' | 'armorPierce' | 'acBonus' | 'resistance' | 'attackApCost' | 'attackRange', by: number): ItemStats => ({
  ...stats,
  [key]: (stats[key] ?? 0) + by,
})
/** A grade's step of a three-grade ladder. */
const step = (ladder: readonly [number, number, number], grade: Grade) => ladder[grade - 1]

export const MODIFIERS: Record<ModifierId, Modifier> = {
  balanced: {
    id: 'balanced',
    name: 'Balanced',
    fits: ['shortsword', 'longsword', 'greatsword', 'spear'],
    unlock: 0,
    apply: (s, g) => addDamage(add(s, 'toHit', 5 * g), -1),
    better: (g) => `to hit +${5 * g}%`,
    worse: () => 'damage −1',
  },
  recurve: {
    id: 'recurve',
    name: 'Recurve',
    fits: ['bow'],
    unlock: 0,
    apply: (s, g) => add(addDamage(s, g), 'attackRange', -1),
    better: (g) => `damage +${g}`,
    worse: () => 'range −1',
  },
  bearded: {
    id: 'bearded',
    name: 'Bearded',
    fits: ['battle_axe', 'mace'],
    unlock: 1,
    apply: (s, g) => addDamage(add(s, 'armorPierce', g), -2),
    better: (g) => `pierces ${g} more ${g === 1 ? 'point' : 'points'} of resistance`,
    worse: () => 'damage −2',
  },
  keen: {
    id: 'keen',
    name: 'Keen',
    fits: ['dagger', 'shortsword', 'longsword'],
    unlock: 1,
    apply: (s, g) => addDamage(add(s, 'critChance', 5 * g), -1),
    better: (g) => `critical +${5 * g}%`,
    worse: () => 'damage −1',
  },
  braced: {
    id: 'braced',
    name: 'Braced',
    fits: ['shield'],
    unlock: 1,
    apply: (s, g) => add(add(s, 'acBonus', step([3, 5, 7], g)), 'toHit', -5),
    better: (g) => `armour class +${step([3, 5, 7], g)}`,
    worse: () => 'to hit −5%',
  },
  light: {
    id: 'light',
    name: 'Light',
    fits: ['longsword', 'battle_axe'],
    unlock: 2,
    apply: (s, g) => addDamage(add(s, 'attackApCost', -1), -step([3, 2, 1], g)),
    better: () => 'attack AP −1',
    worse: (g) => `damage −${step([3, 2, 1], g)}`,
  },
  long: {
    id: 'long',
    name: 'Long',
    fits: ['bow', 'crossbow'],
    unlock: 2,
    apply: (s, g) => add(add(s, 'attackRange', g), 'toHit', -5),
    better: (g) => `range +${g}`,
    worse: () => 'to hit −5%',
  },
  reinforced: {
    id: 'reinforced',
    name: 'Reinforced',
    fits: ['breastplate', 'leather'],
    unlock: 2,
    apply: (s, g) => add(add(s, 'resistance', g), 'toHit', -5),
    better: (g) => `resistance +${g}`,
    worse: () => 'to hit −5%',
  },
}

export const MODIFIER_IDS = Object.keys(MODIFIERS) as ModifierId[]

export function isModifierId(id: string): id is ModifierId {
  return Object.hasOwn(MODIFIERS, id)
}

/** The modifiers that fit the items of `family`. */
export function modifiersFor(family: FamilyId): Modifier[] {
  return MODIFIER_IDS.map((id) => MODIFIERS[id]).filter((mod) => mod.fits.includes(family))
}

/**
 * `item` (plain or graded, never enchanted, its own modifier dropped) with
 * `mod` at `grade`: "Balanced Fine Iron Longsword (II)", id `<item>+<mod><grade>`.
 * `graded` is the item without a modifier, whose stats the modifier changes.
 */
export function modifiedItem(graded: Item, mod: ModifierId, grade: Grade): Item {
  const def = MODIFIERS[mod]
  return {
    ...graded,
    id: `${graded.id}+${mod}${grade}`,
    name: `${def.name} ${graded.name} (${gradeNumeral(grade)})`,
    stats: def.apply(graded.stats ?? {}, grade),
    base: graded.base ?? graded.id,
    grade: graded.grade ?? 1,
    mod: { id: mod, grade },
  }
}
