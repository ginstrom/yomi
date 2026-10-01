import type Phaser from 'phaser'
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

export type IconDrawer = (g: Phaser.GameObjects.Graphics, size: number) => void

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
  draw: IconDrawer
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

const drawSword: IconDrawer = (g, size) => {
  const c = size / 2
  g.fillStyle(0x8a5a2b, 1)
  g.fillRect(c - 8, size * 0.58, 16, 6)
  g.fillStyle(0xd9d9d9, 1)
  g.fillRect(c - 3, size * 0.06, 6, size * 0.54)
  g.fillStyle(0xf2f2f2, 1)
  g.fillTriangle(c - 3, size * 0.06, c + 3, size * 0.06, c, size * 0.0)
  g.fillStyle(0x5c3a1a, 1)
  g.fillRect(c - 2, size * 0.64, 4, size * 0.26)
  g.fillStyle(0xc9a227, 1)
  g.fillCircle(c, size * 0.93, 4)
}

const drawShield: IconDrawer = (g, size) => {
  const w = size * 0.56
  const left = (size - w) / 2
  const top = size * 0.1
  const midY = size * 0.56
  const bottom = size * 0.92
  g.fillStyle(0x7a5230, 1)
  g.beginPath()
  g.moveTo(left, top)
  g.lineTo(left + w, top)
  g.lineTo(left + w, midY)
  g.lineTo(size / 2, bottom)
  g.lineTo(left, midY)
  g.closePath()
  g.fillPath()
  g.lineStyle(2, 0xc9a227, 1)
  g.strokePath()
  g.fillStyle(0xc9a227, 1)
  g.fillCircle(size / 2, size * 0.4, 4)
}

const drawArmor: IconDrawer = (g, size) => {
  const c = size / 2
  g.fillStyle(0x616a73, 1)
  g.fillRoundedRect(c - 13, size * 0.18, 26, size * 0.56, 4)
  g.fillCircle(c - 15, size * 0.26, 6)
  g.fillCircle(c + 15, size * 0.26, 6)
  g.fillStyle(0x4a5158, 1)
  g.fillRoundedRect(c - 13, size * 0.18, 9, size * 0.56, 4)
  g.fillStyle(0x8a929a, 1)
  g.fillRect(c - 3, size * 0.2, 6, size * 0.5)
}

export const IRON_SWORD: Item = {
  id: 'iron_sword',
  name: 'Iron Longsword',
  slot: 'mainHand',
  description: 'A well-balanced blade.',
  stats: { damage: { count: 1, sides: 8, bonus: 2 } },
  draw: drawSword,
}

export const OAK_SHIELD: Item = {
  id: 'oak_shield',
  name: 'Oak Shield',
  slot: 'offHand',
  description: 'Iron-banded oak shield.',
  stats: { acBonus: 2 },
  draw: drawShield,
}

export const STEEL_ARMOR: Item = {
  id: 'steel_armor',
  name: 'Steel Breastplate',
  slot: 'armor',
  description: 'Sturdy plate armor.',
  stats: { baseAc: 13 },
  draw: drawArmor,
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
