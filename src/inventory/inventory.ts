import { SKILLS, type SkillId } from '../character/skills.ts'
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
export type ItemIcon =
  | 'sword'
  | 'shortsword'
  | 'greatsword'
  | 'dagger'
  | 'axe'
  | 'bow'
  | 'shield'
  | 'armor'
  | 'wand'
  | 'ring'
  | 'amulet'
  | 'circlet'
  | 'cloak'

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
  /** What the item adds to its wearer's armour class, in percent. */
  acBonus?: number
  /** What the item adds to its wearer's chance to hit, in percent. */
  toHit?: number
  /** The skill a weapon strikes with, when it is not the one its reach tells: a wand's is Magic. */
  skill?: SkillId
  /** What the item adds to the mana of a wearer who knows a spell. */
  maxMana?: number
  /** What the item adds to the chance of its wearer's spells striking, in percent. */
  spellSkill?: number
  /** What the item adds to its wearer's chance of a critical hit, in percent. */
  critChance?: number
}

export interface Item {
  id: string
  name: string
  slot: EquipmentSlot
  description: string
  stats?: ItemStats
  icon: ItemIcon
  /** A ring fits either ring slot, whichever its `slot` says; see equipFromBackpack(). */
  ring?: true
}

export type Equipment = Partial<Record<EquipmentSlot, Item>>

/** Human-readable stat lines for tooltips, generated from the item's data. */
export function describeItemStats(stats: ItemStats = {}): string[] {
  const lines: string[] = []
  if (stats.damage) lines.push(`Damage: ${formatDamage(stats.damage)}`)
  if (stats.attackApCost !== undefined) lines.push(`Attack Cost: ${stats.attackApCost} AP`)
  if (stats.attackRange !== undefined) lines.push(`Range: ${stats.attackRange} hexes`)
  if (stats.twoHanded) lines.push('Two-handed')
  if (stats.acBonus) lines.push(`Armor Class: +${stats.acBonus}`)
  if (stats.toHit) lines.push(`To Hit: +${stats.toHit}%`)
  if (stats.skill) lines.push(`Strikes with ${SKILLS[stats.skill].name}`)
  if (stats.maxMana) lines.push(`Mana: +${stats.maxMana}`)
  if (stats.spellSkill) lines.push(`Spell Skill: +${stats.spellSkill}%`)
  if (stats.critChance) lines.push(`Critical: +${stats.critChance}%`)
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

/** Every plain weapon, lightest first: what a new hero carries. The enchanted ones are in `MAGIC_ITEMS`. */
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
  stats: { acBonus: 10 },
  icon: 'shield',
}

export const STEEL_ARMOR: Item = {
  id: 'steel_armor',
  name: 'Steel Breastplate',
  slot: 'armor',
  description: 'Sturdy plate armor.',
  stats: { acBonus: 15 },
  icon: 'armor',
}

// Magic items are won as loot (game/worldMap.ts), so none is in `WEAPONS`. They
// are modest on purpose: the simulator's parties fight without them, so the
// game as played runs a little easier than the tuned figures.

/** A wand is a ranged weapon that strikes with Magic and costs no mana. */
export const SPARK_WAND: Item = {
  id: 'spark_wand',
  name: 'Wand of Sparks',
  slot: 'mainHand',
  description: 'Spits stinging sparks.',
  stats: { damage: { count: 1, sides: 6, bonus: 0 }, attackApCost: 5, attackRange: 4, skill: 'magic' },
  icon: 'wand',
}

export const STORM_WAND: Item = {
  id: 'storm_wand',
  name: 'Wand of Storms',
  slot: 'mainHand',
  description: 'Crackles with caught lightning.',
  stats: { damage: { count: 1, sides: 10, bonus: 1 }, attackApCost: 5, attackRange: 5, skill: 'magic' },
  icon: 'wand',
}

export const EMBERBLADE: Item = {
  id: 'emberblade',
  name: 'Emberblade',
  slot: 'mainHand',
  description: 'Its edge glows like a banked fire.',
  stats: { damage: { count: 1, sides: 8, bonus: 4 }, attackApCost: 5, toHit: 10 },
  icon: 'sword',
}

export const HAWK_BOW: Item = {
  id: 'hawk_bow',
  name: 'Hawkeye Bow',
  slot: 'mainHand',
  description: 'Its arrows seem to seek their mark.',
  stats: { damage: { count: 1, sides: 8, bonus: 2 }, attackApCost: 5, attackRange: 6, twoHanded: true, toHit: 10 },
  icon: 'bow',
}

export const RING_PROTECTION: Item = {
  id: 'ring_protection',
  name: 'Ring of Protection',
  slot: 'ring1',
  ring: true,
  description: 'Turns blows a little aside.',
  stats: { acBonus: 5 },
  icon: 'ring',
}

export const RING_FORTUNE: Item = {
  id: 'ring_fortune',
  name: 'Ring of Fortune',
  slot: 'ring1',
  ring: true,
  description: 'Luck runs with its wearer.',
  stats: { critChance: 5 },
  icon: 'ring',
}

export const AMULET_FOCUS: Item = {
  id: 'amulet_focus',
  name: 'Amulet of Focus',
  slot: 'neck',
  description: "Steadies a caster's aim.",
  stats: { spellSkill: 10 },
  icon: 'amulet',
}

export const SAGE_CIRCLET: Item = {
  id: 'sage_circlet',
  name: "Sage's Circlet",
  slot: 'head',
  description: 'A band of silver that deepens the well a caster draws on.',
  stats: { maxMana: 6 },
  icon: 'circlet',
}

export const SHADOW_CLOAK: Item = {
  id: 'shadow_cloak',
  name: 'Cloak of Shadows',
  slot: 'cloak',
  description: 'Hard to fix the eye on.',
  stats: { acBonus: 10 },
  icon: 'cloak',
}

/** Every enchanted item in the game. */
export const MAGIC_ITEMS: readonly Item[] = [
  SPARK_WAND,
  STORM_WAND,
  EMBERBLADE,
  HAWK_BOW,
  RING_PROTECTION,
  RING_FORTUNE,
  AMULET_FOCUS,
  SAGE_CIRCLET,
  SHADOW_CLOAK,
]

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
