import type { CombatantStats, DamageRoll } from '../combat/combat.ts'
import type { GearChange } from '../engine/battleEngine.ts'
import {
  BACKPACK_SIZE,
  EQUIPMENT_SLOT_ORDER,
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
 * One of the player's persistent characters. Combat stats are never stored here —
 * they're derived from base stats + equipment, so changing gear is the only
 * way to change them and every screen agrees on the numbers.
 */
export interface Character {
  name: string
  className: string
  level: number
  /** Experience earned towards the next level; see progression.ts. */
  xp: number
  base: BaseStats
  hp: number
  equipment: Equipment
  backpack: Array<Item | null>
}

const UNARMORED_AC = 10
const UNARMED_DAMAGE: DamageRoll = { count: 1, sides: 2, bonus: 0 }
const UNARMED_ATTACK_AP_COST = 3
const MELEE_RANGE = 1
const UNARMED_WEAPON = 'Fists'

export function deriveCombatStats(character: Character): CombatantStats {
  // A two-handed weapon leaves no hand for a shield. equipFromBackpack() keeps the
  // two apart, so this only matters for equipment put together some other way.
  const { offHand, ...rest } = character.equipment
  const worn = isTwoHanded(character.equipment.mainHand) ? rest : { ...rest, offHand }
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
    weapon: character.equipment.mainHand?.name ?? UNARMED_WEAPON,
    attackApCost,
    attackRange,
    actionPoints: character.base.actionPoints,
  }
}

/** Whether `item` is a weapon that takes both hands, leaving none for the off hand. */
export function isTwoHanded(item: Item | undefined): boolean {
  return item?.stats?.twoHanded === true
}

/**
 * Equips the backpack item at `index` in the slot it belongs to; whatever was
 * there takes its place in the backpack. A two-handed weapon and an off-hand
 * item cannot be held together, so equipping either also stows the other. If
 * both hands come off and the backpack has room for only one, the other-hand
 * item falls onto `ground`, the pile at the character's feet. Returns false if
 * that backpack space is empty.
 */
export function equipFromBackpack(character: Character, index: number, ground: Item[]): boolean {
  const { equipment, backpack } = character
  const item = backpack[index]
  if (!item) return false

  const replaced = equipment[item.slot] ?? null
  const otherHand: EquipmentSlot | null =
    item.slot === 'mainHand' && isTwoHanded(item)
      ? 'offHand'
      : item.slot === 'offHand' && isTwoHanded(equipment.mainHand)
        ? 'mainHand'
        : null
  const freed = (otherHand && equipment[otherHand]) ?? null

  // The item's own space takes one of the two; a second needs an empty space.
  backpack[index] = replaced ?? freed
  if (freed) {
    delete equipment[otherHand!]
    if (replaced) {
      const space = backpack.indexOf(null)
      if (space === -1) ground.push(freed)
      else backpack[space] = freed
    }
  }
  equipment[item.slot] = item
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

/** Drops the backpack item at `index` onto `ground`. Returns false if that space is empty. */
export function dropFromBackpack(character: Character, index: number, ground: Item[]): boolean {
  const item = character.backpack[index]
  if (!item) return false
  character.backpack[index] = null
  ground.push(item)
  return true
}

/** Drops the item in `slot` onto `ground`. Returns false if the slot is empty. */
export function dropEquipped(character: Character, slot: EquipmentSlot, ground: Item[]): boolean {
  const item = character.equipment[slot]
  if (!item) return false
  delete character.equipment[slot]
  ground.push(item)
  return true
}

/**
 * Picks up the item at `index` of `ground` into the first empty backpack
 * space. Returns false if nothing lies there or the backpack is full.
 */
export function pickUp(character: Character, ground: Item[], index: number): boolean {
  const item = ground[index]
  const space = character.backpack.indexOf(null)
  if (!item || space === -1) return false
  ground.splice(index, 1)
  character.backpack[space] = item
  return true
}

/** What differs between two sets of equipment, slot by slot in paperdoll order, for the battle log. */
export function gearChanges(before: Equipment, after: Equipment): GearChange[] {
  const named = (item: Item | undefined) => (item ? { id: item.id, name: item.name } : null)
  return EQUIPMENT_SLOT_ORDER.filter((slot) => before[slot]?.id !== after[slot]?.id).map((slot) => ({
    slot,
    from: named(before[slot]),
    to: named(after[slot]),
  }))
}

/** The weapons the warrior carries but does not start with in hand. */
const SPARE_WEAPONS = WEAPONS.filter((weapon) => weapon !== IRON_SWORD)

export function createWarrior(name = 'Warrior'): Character {
  const base: BaseStats = { maxHp: 20, attackBonus: 4, actionPoints: 8 }
  return {
    name,
    className: 'Fighter',
    level: 1,
    xp: 0,
    base,
    hp: base.maxHp,
    equipment: { armor: STEEL_ARMOR, mainHand: IRON_SWORD, offHand: OAK_SHIELD },
    backpack: Array.from({ length: BACKPACK_SIZE }, (_, i) => SPARE_WEAPONS[i] ?? null),
  }
}
