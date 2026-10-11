import type { CombatantStats, DamageRoll } from '../combat/combat.ts'
import {
  BACKPACK_SIZE,
  IRON_SWORD,
  OAK_SHIELD,
  STEEL_ARMOR,
  WEAPONS,
  type Equipment,
  type EquipmentSlot,
  type Item,
} from '../inventory/inventory.ts'

/** Intrinsic stats before equipment. */
export interface BaseStats {
  maxHp: number
  attackBonus: number
  actionPoints: number
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
const UNARMED_ATTACK_AP_COST = 3
const MELEE_RANGE = 1

export function deriveCombatStats(character: Character): CombatantStats {
  // A two-handed weapon leaves no hand for a shield, whatever the off hand holds.
  const { offHand, ...rest } = character.equipment
  const worn = character.equipment.mainHand?.stats?.twoHanded ? rest : { ...rest, offHand }
  const items = Object.values(worn).filter((item): item is Item => item !== undefined)

  let baseAc = UNARMORED_AC
  let acBonus = 0
  let attackBonus = character.base.attackBonus
  let damage = UNARMED_DAMAGE
  let attackApCost = UNARMED_ATTACK_AP_COST
  let attackRange = MELEE_RANGE

  for (const { stats } of items) {
    if (!stats) continue
    if (stats.baseAc !== undefined) baseAc = Math.max(baseAc, stats.baseAc)
    if (stats.damage) damage = stats.damage
    if (stats.attackApCost !== undefined) attackApCost = stats.attackApCost
    if (stats.attackRange !== undefined) attackRange = stats.attackRange
    acBonus += stats.acBonus ?? 0
    attackBonus += stats.attackBonus ?? 0
  }

  return {
    name: character.name,
    maxHp: character.base.maxHp,
    ac: baseAc + acBonus,
    attackBonus,
    damage,
    attackApCost,
    attackRange,
    actionPoints: character.base.actionPoints,
  }
}

/**
 * Equips the backpack item at `index` in the slot it belongs to; whatever was
 * there takes its place in the backpack. Returns false if that space is empty.
 */
export function equipFromBackpack(character: Character, index: number): boolean {
  const item = character.backpack[index]
  if (!item) return false
  character.backpack[index] = character.equipment[item.slot] ?? null
  character.equipment[item.slot] = item
  return true
}

/**
 * Stows the item in `slot` in the first empty backpack space. Returns false
 * if the slot is empty or the backpack is full.
 */
export function unequipToBackpack(character: Character, slot: EquipmentSlot): boolean {
  const item = character.equipment[slot]
  const space = character.backpack.indexOf(null)
  if (!item || space === -1) return false
  character.backpack[space] = item
  delete character.equipment[slot]
  return true
}

/** The weapons the warrior carries but does not start with in hand. */
const SPARE_WEAPONS = WEAPONS.filter((weapon) => weapon !== IRON_SWORD)

export function createWarrior(): Character {
  const base: BaseStats = { maxHp: 20, attackBonus: 4, actionPoints: 8 }
  return {
    name: 'Warrior',
    className: 'Fighter',
    base,
    hp: base.maxHp,
    equipment: { armor: STEEL_ARMOR, mainHand: IRON_SWORD, offHand: OAK_SHIELD },
    backpack: Array.from({ length: BACKPACK_SIZE }, (_, i) => SPARE_WEAPONS[i] ?? null),
  }
}
