import { formatDamage, type DamageRoll } from '../combat/combat.ts'

export type EquipmentSlot =
  | 'head'
  | 'neck'
  | 'armor'
  | 'cloak'
  | 'mainHand'
  | 'offHand'
  | 'gloves'
  | 'belt'
  | 'boots'
  | 'ring1'
  | 'ring2'

export const EQUIPMENT_SLOT_LABELS: Record<EquipmentSlot, string> = {
  head: 'Head',
  neck: 'Neck',
  armor: 'Armor',
  cloak: 'Cloak',
  mainHand: 'Weapon',
  offHand: 'Shield',
  gloves: 'Gloves',
  belt: 'Belt',
  boots: 'Boots',
  ring1: 'Ring',
  ring2: 'Ring',
}

/** Identifies an item's artwork; scenes map it to a renderer (see scenes/itemIcons.ts). */
export type ItemIcon = 'sword' | 'shield' | 'armor'

/** What an item contributes to its wearer's combat stats; see deriveCombatStats(). */
export interface ItemStats {
  /** Weapon damage; replaces the wielder's unarmed damage. */
  damage?: DamageRoll
  /** Armor's base AC; replaces the unarmored AC of 10. */
  baseAc?: number
  /** Flat AC bonus, e.g. from a shield. */
  acBonus?: number
  attackBonus?: number
}

export interface Item {
  id: string
  name: string
  slot: EquipmentSlot
  description: string
  stats?: ItemStats
  icon: ItemIcon
}

export type Equipment = Partial<Record<EquipmentSlot, Item>>

/** Human-readable stat lines for tooltips, generated from the item's data. */
export function describeItemStats(stats: ItemStats = {}): string[] {
  const lines: string[] = []
  if (stats.damage) lines.push(`Damage: ${formatDamage(stats.damage)}`)
  if (stats.baseAc !== undefined) lines.push(`Armor Class: ${stats.baseAc}`)
  if (stats.acBonus) lines.push(`Armor Class: +${stats.acBonus}`)
  if (stats.attackBonus) lines.push(`Attack: +${stats.attackBonus}`)
  return lines
}

export const IRON_SWORD: Item = {
  id: 'iron_sword',
  name: 'Iron Longsword',
  slot: 'mainHand',
  description: 'A well-balanced blade.',
  stats: { damage: { count: 1, sides: 8, bonus: 2 } },
  icon: 'sword',
}

export const OAK_SHIELD: Item = {
  id: 'oak_shield',
  name: 'Oak Shield',
  slot: 'offHand',
  description: 'Iron-banded oak shield.',
  stats: { acBonus: 2 },
  icon: 'shield',
}

export const STEEL_ARMOR: Item = {
  id: 'steel_armor',
  name: 'Steel Breastplate',
  slot: 'armor',
  description: 'Sturdy plate armor.',
  stats: { baseAc: 13 },
  icon: 'armor',
}

export const EQUIPMENT_SLOT_ORDER: EquipmentSlot[] = [
  'head',
  'neck',
  'armor',
  'cloak',
  'mainHand',
  'offHand',
  'gloves',
  'belt',
  'boots',
  'ring1',
  'ring2',
]

export const BACKPACK_SIZE = 12
