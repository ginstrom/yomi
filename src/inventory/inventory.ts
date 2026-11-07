import { SKILLS, type SkillId } from '../character/skills.ts'
import { formatDamage, type DamageRoll } from '../combat/combat.ts'
import {
  FAMILIES,
  LEGACY_ALIASES,
  MATERIALS,
  gearClass,
  tierStats,
  type FamilyDef,
  type FamilyId,
  type MaterialDef,
  type Tier,
} from './catalog.ts'
import { gradedItem, isGrade, type Grade } from './grades.ts'
import { MODIFIERS, isModifierId, modifiedItem, type ModifierId } from './modifiers.ts'

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
  | 'wand_storm'
  | 'sword_ember'
  | 'bow_hawk'
  | 'ring_fortune'
  | 'rapier'
  | 'mace'
  | 'spear'
  | 'war_hammer'
  | 'halberd'
  | 'longbow'
  | 'crossbow'
  | 'staff'
  | 'buckler'
  | 'tower_shield'
  | 'robe'
  | 'leather'
  | 'plate'
  | 'cap'
  | 'helm'
  | 'gloves'
  | 'gauntlets'
  | 'boots'
  | 'greaves'

/** What an item contributes to its wearer's combat stats; see deriveCombatStats(). */
export interface ItemStats {
  /** Weapon damage; replaces the wielder's unarmed damage. */
  damage?: DamageRoll
  /** Action points an attack with this weapon costs; replaces the unarmed cost. */
  attackApCost?: number
  /** How many hexes away the weapon can strike; a melee weapon leaves it out and reaches 1. */
  attackRange?: number
  /** Points of a foe's resistance a melee weapon's blows pass through; nothing for a ranged one but with `rangedPierce`. */
  armorPierce?: number
  /** A melee weapon that strikes beyond the next hex (the spear, the halberd): melee for skill, strength, piercing and the engine. */
  reach?: true
  /** A ranged weapon whose `armorPierce` counts though it is shot (the crossbow). */
  rangedPierce?: true
  /** A main-hand weapon that takes both hands: whatever is in the off hand counts for nothing. */
  twoHanded?: boolean
  /** What the item adds to its wearer's armour class, in percent. */
  acBonus?: number
  /** What the item adds to its wearer's resistance: points off the damage of every weapon hit it takes. */
  resistance?: number
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
  /** The strength the item asks; each point its wearer lacks costs `SHORTFALL_TO_HIT` to hit. */
  strength?: number
  /** Action points it takes from its wearer every turn. */
  apPenalty?: number
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
  /** On a graded or modified item: the id of the plain item it was made from, and its grade (inventory/grades.ts). */
  base?: string
  grade?: Grade
  /** On a modified item: its modifier and the modifier's grade (inventory/modifiers.ts). */
  mod?: { id: ModifierId; grade: Grade }
  /** On a plain item and every graded or modified copy of it: its family, material and tier (inventory/catalog.ts). */
  family?: FamilyId
  material?: string
  tier?: Tier
}

export type Equipment = Partial<Record<EquipmentSlot, Item>>

/** What a wearer loses to hit for each point of strength an item asks beyond its own. */
export const SHORTFALL_TO_HIT = 5

/** Points of strength `stats` asks beyond `strength`. */
export function strengthShortfall(strength: number, stats: ItemStats | undefined): number {
  return Math.max(0, (stats?.strength ?? 0) - strength)
}

/**
 * Human-readable stat lines for tooltips, generated from the item's data; with
 * `wearerStrength`, the strength line tells what a shortfall costs.
 */
export function describeItemStats(stats: ItemStats = {}, wearerStrength?: number): string[] {
  const lines: string[] = []
  if (stats.damage) lines.push(`Damage: ${formatDamage(stats.damage)}`)
  if (stats.attackApCost !== undefined) lines.push(`Attack Cost: ${stats.attackApCost} AP`)
  if (stats.attackRange !== undefined) lines.push(`${stats.reach ? 'Reach' : 'Range'}: ${stats.attackRange} hexes`)
  if (stats.armorPierce) lines.push(`Pierces ${stats.armorPierce} resistance${stats.rangedPierce ? ', even at range' : ''}`)
  if (stats.twoHanded) lines.push('Two-handed')
  if (stats.strength) {
    const short = wearerStrength === undefined ? 0 : strengthShortfall(wearerStrength, stats)
    lines.push(`Strength: ${stats.strength}${short > 0 ? ` (you have ${wearerStrength}): to hit ${signed(-SHORTFALL_TO_HIT * short)}%` : ''}`)
  }
  if (stats.apPenalty) lines.push(`Action Points: ${signed(-stats.apPenalty)}`)
  if (stats.acBonus) lines.push(`Armor Class: ${signed(stats.acBonus)}`)
  if (stats.resistance) lines.push(`Resistance: ${signed(stats.resistance)}`)
  if (stats.toHit) lines.push(`To Hit: ${signed(stats.toHit)}%`)
  if (stats.skill) lines.push(`Strikes with ${SKILLS[stats.skill].name}`)
  if (stats.maxMana) lines.push(`Mana: +${stats.maxMana}`)
  if (stats.spellSkill) lines.push(`Spell Skill: ${signed(stats.spellSkill)}%`)
  if (stats.critChance) lines.push(`Critical: ${signed(stats.critChance)}%`)
  return lines
}

const signed = (n: number): string => (n < 0 ? `−${-n}` : `+${n}`)

/** A plain item: `family` in `material`, at the material's tier. */
function plainItem(family: FamilyDef, material: MaterialDef): Item {
  const named = material.tier === 1 ? family.tier1 : undefined
  return {
    id: named?.id ?? `${material.id}_${family.id}`,
    name: named?.name ?? `${material.name} ${family.name}`,
    slot: family.slot,
    description: family.description,
    stats: tierStats(family.stats, gearClass(family.slot), material.tier),
    icon: family.icon,
    family: family.id,
    material: material.id,
    tier: material.tier,
  }
}

/**
 * Every plain item, which the trading post sells at a grade and crafting
 * modifies (docs/designs/long-campaign/stage-03-gear-families.md): each family
 * of the catalog in each material of its kind, in `FAMILIES` order, tier 1
 * before tier 2. Enchanted items stand outside the ladder.
 */
export const BASE_ITEMS: readonly Item[] = FAMILIES.flatMap((family) =>
  MATERIALS.filter((material) => material.kind === family.kind).map((material) => plainItem(family, material)),
)

const BASES_BY_ID: ReadonlyMap<string, Item> = new Map(BASE_ITEMS.map((item) => [item.id, item]))
const plain = (id: string): Item => BASES_BY_ID.get(id)!

export const IRON_DAGGER = plain('iron_dagger')
export const IRON_SHORTSWORD = plain('iron_shortsword')
export const IRON_SWORD = plain('iron_sword')
export const IRON_BATTLE_AXE = plain('iron_battle_axe')
export const IRON_GREATSWORD = plain('iron_greatsword')
export const YEW_BOW = plain('yew_bow')
export const OAK_SHIELD = plain('oak_shield')
export const IRON_BREASTPLATE = plain('iron_breastplate')
/** A wand is a ranged weapon that strikes with Magic and costs no mana. */
export const SPARK_WAND = plain('spark_wand')

/** The plain weapons a new hero carries, lightest first; `BASE_ITEMS` has every family. */
export const WEAPONS: readonly Item[] = [IRON_DAGGER, IRON_SHORTSWORD, IRON_SWORD, IRON_BATTLE_AXE, IRON_GREATSWORD, YEW_BOW]

// Magic items are won as loot (game/worldMap.ts), so none is in `WEAPONS`. They
// are modest on purpose: the simulator's parties fight without them, so the
// game as played runs a little easier than the tuned figures.

export const STORM_WAND: Item = {
  id: 'storm_wand',
  name: 'Wand of Storms',
  slot: 'mainHand',
  description: 'Crackles with caught lightning.',
  stats: { damage: { count: 1, sides: 10, bonus: 1 }, attackApCost: 5, attackRange: 5, skill: 'magic' },
  icon: 'wand_storm',
}

export const EMBERBLADE: Item = {
  id: 'emberblade',
  name: 'Emberblade',
  slot: 'mainHand',
  description: 'Its edge glows like a banked fire.',
  stats: { damage: { count: 1, sides: 8, bonus: 4 }, attackApCost: 5, armorPierce: 1, toHit: 10 },
  icon: 'sword_ember',
}

export const HAWK_BOW: Item = {
  id: 'hawk_bow',
  name: 'Hawkeye Bow',
  slot: 'mainHand',
  description: 'Its arrows seem to seek their mark.',
  stats: { damage: { count: 1, sides: 6, bonus: 2 }, attackApCost: 4, attackRange: 6, twoHanded: true, toHit: 10 },
  icon: 'bow_hawk',
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
  icon: 'ring_fortune',
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
  STORM_WAND,
  EMBERBLADE,
  HAWK_BOW,
  RING_PROTECTION,
  RING_FORTUNE,
  AMULET_FOCUS,
  SAGE_CIRCLET,
  SHADOW_CLOAK,
]

const ITEMS_BY_ID: ReadonlyMap<string, Item> = new Map([...BASE_ITEMS, ...MAGIC_ITEMS].map((item) => [item.id, item]))

/** Graded, modified and aliased items as built, by id, so that one id is always one object. */
const BUILT = new Map<string, Item>()

/**
 * `<plain>[@<grade>][+<modifier><grade>]`, where a plain id is `<material>_<family>`,
 * a family's own tier-1 id (`iron_sword`, `oak_shield`) or a legacy alias
 * (`LEGACY_ALIASES`); a grade of 1 is never written, so each item has one id.
 */
const ID_GRAMMAR = /^([a-z_]+)(?:@([23]))?(?:\+([a-z]+)([123]))?$/

/**
 * The item with this id: a plain or enchanted item, or a graded or modified
 * plain item built from its id (`steel_longsword@2+balanced1`) and remembered,
 * so that the same id always gives the same object and identity comparisons
 * hold after a load (game/save.ts). A legacy alias gives the same object as
 * its canonical id, which that object carries. Undefined for an id that is not
 * an item: one that does not parse, a material or family that does not exist
 * or do not go together, a modifier that does not fit its family, or a grade
 * or modifier on an enchanted item.
 */
export function itemById(id: string): Item | undefined {
  const known = ITEMS_BY_ID.get(id) ?? BUILT.get(id)
  if (known) return known
  const match = ID_GRAMMAR.exec(id)
  if (!match) return undefined
  const [, baseId, gradeText, modId, modGradeText] = match
  if (Object.hasOwn(LEGACY_ALIASES, baseId)) {
    const item = itemById(id.replace(baseId, LEGACY_ALIASES[baseId]))
    if (item) BUILT.set(id, item)
    return item
  }
  const base = BASES_BY_ID.get(baseId)
  if (!base) return undefined
  const grade = Number(gradeText ?? 1)
  if (!isGrade(grade)) return undefined
  let item = gradedItem(base, grade)
  if (modId !== undefined) {
    const modGrade = Number(modGradeText)
    if (!isModifierId(modId) || !isGrade(modGrade) || !MODIFIERS[modId].fits.includes(base.family!)) return undefined
    item = modifiedItem(item, modId, modGrade)
  }
  BUILT.set(id, item)
  return item
}

/** The plain item `item` was made from, at its tier: itself if plain, null for an enchanted one. */
export function baseItem(item: Item): Item | null {
  return BASES_BY_ID.get(item.base ?? item.id) ?? null
}

/** `item` without its modifier: the plain item at its grade. */
export function unmodified(item: Item): Item {
  const base = baseItem(item)
  if (!base || !item.mod) return item
  return craftedItem(base, item.grade ?? 1)
}

/** The item `base` would be at `grade`, with `mod` at `modGrade` if given: the same object `itemById` gives. */
export function craftedItem(base: Item, grade: Grade, mod?: { id: ModifierId; grade: Grade }): Item {
  const id = `${base.id}${grade > 1 ? `@${grade}` : ''}${mod ? `+${mod.id}${mod.grade}` : ''}`
  return itemById(id)!
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
