import type { CombatantStats, DamageRoll } from '../combat/combat.ts'
import {
  BACKPACK_SIZE,
  IRON_SWORD,
  OAK_SHIELD,
  STEEL_ARMOR,
  type Equipment,
  type Item,
} from '../inventory/inventory.ts'

/** Intrinsic stats before equipment. */
export interface BaseStats {
  maxHp: number
  attackBonus: number
}

/**
 * The player's persistent character. Combat stats are never stored here —
 * they're derived from base stats + equipment, so changing gear is the only
 * way to change them and every screen agrees on the numbers.
 */
export interface Character {
  name: string
  className: string
  base: BaseStats
  hp: number
  equipment: Equipment
  backpack: Array<Item | null>
}

const UNARMORED_AC = 10
const UNARMED_DAMAGE: DamageRoll = { count: 1, sides: 2, bonus: 0 }

export function deriveCombatStats(character: Character): CombatantStats {
  const items = Object.values(character.equipment).filter((item): item is Item => item !== undefined)

  let baseAc = UNARMORED_AC
  let acBonus = 0
  let attackBonus = character.base.attackBonus
  let damage = UNARMED_DAMAGE

  for (const { stats } of items) {
    if (!stats) continue
    if (stats.baseAc !== undefined) baseAc = Math.max(baseAc, stats.baseAc)
    if (stats.damage) damage = stats.damage
    acBonus += stats.acBonus ?? 0
    attackBonus += stats.attackBonus ?? 0
  }

  return {
    name: character.name,
    maxHp: character.base.maxHp,
    ac: baseAc + acBonus,
    attackBonus,
    damage,
  }
}

export function createWarrior(): Character {
  const base: BaseStats = { maxHp: 20, attackBonus: 4 }
  return {
    name: 'Warrior',
    className: 'Fighter',
    base,
    hp: base.maxHp,
    equipment: { armor: STEEL_ARMOR, mainHand: IRON_SWORD, offHand: OAK_SHIELD },
    backpack: new Array<Item | null>(BACKPACK_SIZE).fill(null),
  }
}
