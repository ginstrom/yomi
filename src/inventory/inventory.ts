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
export type ItemIcon = 'sword' | 'shortsword' | 'greatsword' | 'dagger' | 'axe' | 'bow' | 'shield' | 'armor'

/** What an item contributes to its wearer's combat stats; see deriveCombatStats(). */
export interface ItemStats {
  /** Weapon damage; replaces the wielder's unarmed damage. */
  damage?: DamageRoll
  /** Action points an attack with this weapon costs; replaces the unarmed cost. */
  attackApCost?: number
  /** How many hexes away the weapon can strike; a melee weapon leaves it out and reaches 1. */
  attackRange?: number
  /** A main-hand weapon that takes both hands: whatever is in the off hand counts for nothing. */
  twoHanded?: boolean
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
  if (stats.attackApCost !== undefined) lines.push(`Attack Cost: ${stats.attackApCost} AP`)
  if (stats.attackRange !== undefined) lines.push(`Range: ${stats.attackRange} hexes`)
  if (stats.twoHanded) lines.push('Two-handed')
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
  stats: { damage: { count: 1, sides: 8, bonus: 2 }, attackApCost: 5 },
  icon: 'sword',
}

// Weapons trade damage against action points: with 8 AP a turn, a cost of 4 or
// less buys two attacks from a unit that stands still, and every point above
// that is a hex it cannot also walk. Two attacks a turn are worth more than
// their summed damage suggests, which is why the light weapons roll so low:
// `npm run simulate -- --player-weapon <id>` compares them.

export const IRON_DAGGER: Item = {
  id: 'iron_dagger',
  name: 'Iron Dagger',
  slot: 'mainHand',
  description: 'Short, light and quick.',
  stats: { damage: { count: 1, sides: 4, bonus: 0 }, attackApCost: 3 },
  icon: 'dagger',
}

export const IRON_SHORTSWORD: Item = {
  id: 'iron_shortsword',
  name: 'Iron Shortsword',
  slot: 'mainHand',
  description: 'A handy stabbing blade.',
  stats: { damage: { count: 1, sides: 3, bonus: 1 }, attackApCost: 4 },
  icon: 'shortsword',
}

export const IRON_BATTLE_AXE: Item = {
  id: 'iron_battle_axe',
  name: 'Iron Battle Axe',
  slot: 'mainHand',
  description: 'A heavy head on a long haft.',
  stats: { damage: { count: 1, sides: 10, bonus: 2 }, attackApCost: 6 },
  icon: 'axe',
}

export const STEEL_GREATSWORD: Item = {
  id: 'steel_greatsword',
  name: 'Steel Greatsword',
  slot: 'mainHand',
  description: 'A blade as tall as its wielder.',
  stats: { damage: { count: 2, sides: 6, bonus: 3 }, attackApCost: 7, twoHanded: true },
  icon: 'greatsword',
}

export const YEW_BOW: Item = {
  id: 'yew_bow',
  name: 'Yew Bow',
  slot: 'mainHand',
  description: 'Strikes from across the field.',
  stats: { damage: { count: 1, sides: 8, bonus: 0 }, attackApCost: 5, attackRange: 5, twoHanded: true },
  icon: 'bow',
}

/** Every weapon in the game, lightest first. */
export const WEAPONS: readonly Item[] = [
  IRON_DAGGER,
  IRON_SHORTSWORD,
  IRON_SWORD,
  IRON_BATTLE_AXE,
  STEEL_GREATSWORD,
  YEW_BOW,
]

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
