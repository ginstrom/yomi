import { SKILLS, type SkillId } from '../character/skills.ts'
import { ELEMENTS, formatDamage, type DamageRoll, type Element, type OnHit } from '../combat/combat.ts'
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
import {
  capitalised,
  isRuneKey,
  onHitParts,
  parseRuneKey,
  runeFits,
  runeLabel,
  runeStats,
  slotClass,
  socketsOf,
  type RuneKey,
} from './runes.ts'

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
  /** Points off each instance of damage of an element its wearer takes (runes). */
  wards?: Partial<Record<Element, number>>
  /** What the weapon does on a hit besides its dice; counted from the main hand only. */
  onHit?: readonly OnHit[]
  /** What the item adds to its wearer's maximum hit points (Life runes); see clampHp. */
  maxHp?: number
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
  /** The runes embedded, in socket order, filled sockets first (inventory/runes.ts). */
  runes?: readonly RuneKey[]
  /** On an enchanted item: its sockets (Emberblade, Wand of Storms, Hawkeye Bow 1; the rest none). Plain items' come from socketsOf. */
  sockets?: number
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
  for (const element of ELEMENTS) {
    const ward = stats.wards?.[element]
    if (ward) lines.push(`${capitalised(element)} ward ${ward}`)
  }
  if (stats.maxHp) lines.push(`Max HP: ${signed(stats.maxHp)}`)
  // A line an entry (a rune's each).
  for (const entry of stats.onHit ?? []) lines.push(`On a hit: ${onHitParts([entry]).join(', ')}`)
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
  sockets: 1,
}

export const EMBERBLADE: Item = {
  id: 'emberblade',
  name: 'Emberblade',
  slot: 'mainHand',
  description: 'Its edge glows like a banked fire.',
  stats: { damage: { count: 1, sides: 8, bonus: 4 }, attackApCost: 5, armorPierce: 1, toHit: 10 },
  icon: 'sword_ember',
  sockets: 1,
}

export const HAWK_BOW: Item = {
  id: 'hawk_bow',
  name: 'Hawkeye Bow',
  slot: 'mainHand',
  description: 'Its arrows seem to seek their mark.',
  stats: { damage: { count: 1, sides: 6, bonus: 2 }, attackApCost: 4, attackRange: 6, twoHanded: true, toHit: 10 },
  icon: 'bow_hawk',
  sockets: 1,
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
 * Runes come after it, `#<rune>(.<rune>)*` (`iron_sword@3#ember1`; an
 * enchanted item takes them too, `emberblade#dawn1`), split off by `itemById`
 * before this is matched.
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
 * or modifier on an enchanted item; or, with runes, an empty rune part, a rune
 * that does not parse or fit (`runeFits`), or more runes than its sockets.
 */
export function itemById(id: string): Item | undefined {
  const known = ITEMS_BY_ID.get(id) ?? BUILT.get(id)
  if (known) return known
  const hash = id.indexOf('#')
  if (hash >= 0) return runedById(id, id.slice(0, hash), id.slice(hash + 1).split('.'))
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

/** The item of `id`, `unrunedId` with `keys` embedded, built and remembered; under its canonical id too, for an alias. */
function runedById(id: string, unrunedId: string, keys: readonly string[]): Item | undefined {
  const unrunedItem = itemById(unrunedId)
  if (!unrunedItem || unrunedItem.runes || !keys.every(isRuneKey) || keys.length > socketsOf(unrunedItem)) return undefined
  if (!keys.every((key) => runeFits(parseRuneKey(key)!.id, unrunedItem))) return undefined
  const canonical = `${unrunedItem.id}#${keys.join('.')}`
  const item = BUILT.get(canonical) ?? runedItem(unrunedItem, keys as readonly RuneKey[])
  BUILT.set(canonical, item)
  BUILT.set(id, item)
  return item
}

/** `item` (unruned) with `runes` embedded: its stats folded rune by rune, its name and id telling them. */
function runedItem(item: Item, runes: readonly RuneKey[]): Item {
  const cls = slotClass(item.slot)
  const stats = runes.reduce((sum, key) => {
    const { id, rank } = parseRuneKey(key)!
    return addStats(sum, runeStats(id, rank, cls))
  }, item.stats ?? {})
  const runed: Item = {
    ...item,
    id: `${item.id}#${runes.join('.')}`,
    name: `${item.name} [${runes.map(runeLabel).join(', ')}]`,
    stats,
    runes,
  }
  if (item.family) runed.base = item.base ?? item.id
  return runed
}

type NumericStat = { [K in keyof ItemStats]-?: ItemStats[K] extends number | undefined ? K : never }[keyof ItemStats]

/**
 * `a` with `b` added: numbers add, a missing field counting 0; a damage roll's
 * bonus adds where `a` has a roll; wards add by element; on-hit entries
 * concatenate; any other field is `a`'s, else `b`'s.
 */
export function addStats(a: ItemStats, b: ItemStats): ItemStats {
  const sum: ItemStats = { ...a }
  for (const key of Object.keys(b) as (keyof ItemStats)[]) {
    if (key === 'damage') {
      if (a.damage && b.damage) sum.damage = { ...a.damage, bonus: a.damage.bonus + b.damage.bonus }
    } else if (key === 'wards') {
      const wards = { ...a.wards }
      for (const element of ELEMENTS) {
        const n = b.wards?.[element]
        if (n) wards[element] = (wards[element] ?? 0) + n
      }
      sum.wards = wards
    } else if (key === 'onHit') {
      sum.onHit = [...(a.onHit ?? []), ...(b.onHit ?? [])]
    } else if (typeof b[key] === 'number') {
      const field = key as NumericStat
      sum[field] = (a[field] ?? 0) + b[field]!
    } else if (sum[key] === undefined) {
      ;(sum as Record<string, unknown>)[key] = b[key]
    }
  }
  return sum
}

/** The item without its runes: itself if it has none. */
export function unruned(item: Item): Item {
  return item.runes?.length ? itemById(item.id.slice(0, item.id.indexOf('#')))! : item
}

/** `item` (runed or not) with exactly `runes`: the same object itemById gives for that id; undefined if they do not fit. */
export function withRunes(item: Item, runes: readonly RuneKey[]): Item | undefined {
  return itemById(`${unruned(item).id}${runeSuffix(runes)}`)
}

const runeSuffix = (runes: readonly RuneKey[] | undefined): string => (runes?.length ? `#${runes.join('.')}` : '')

/** The plain item `item` was made from, at its tier: itself if plain, null for an enchanted one. */
export function baseItem(item: Item): Item | null {
  return BASES_BY_ID.get(item.base ?? item.id) ?? null
}

/** `item` without its modifier: the plain item at its grade, with any runes it has. */
export function unmodified(item: Item): Item {
  const base = baseItem(item)
  if (!base || !item.mod) return item
  return craftedItem(base, item.grade ?? 1, undefined, item.runes)
}

/**
 * The item `base` would be at `grade`, with `mod` at `modGrade` if given and
 * `runes` embedded: the same object `itemById` gives.
 */
export function craftedItem(base: Item, grade: Grade, mod?: { id: ModifierId; grade: Grade }, runes?: readonly RuneKey[]): Item {
  const id = `${base.id}${grade > 1 ? `@${grade}` : ''}${mod ? `+${mod.id}${mod.grade}` : ''}${runeSuffix(runes)}`
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
