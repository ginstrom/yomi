import { ATTRIBUTES, ATTRIBUTE_IDS, MAX_ATTRIBUTE, type AttributeId, type Attributes } from './attributes.ts'
import type { Character } from './character.ts'
import { SPELLS, SPELL_IDS, type SchoolId, type SpellId } from '../combat/spells.ts'
import { SKILLS, SKILL_IDS, skillLevel, type SkillId } from './skills.ts'

/**
 * Perks: a character picks `CREATION_PERK_PICKS` as it is created (creation.ts)
 * and one every `PERK_LEVEL_STEP` levels (progression.ts), from those it
 * qualifies for by level, attributes, skills and the perks it
 * already has. A perk is data: what it asks, where it sits in the perk tree,
 * what each rank of it adds (summed by `perkBonus` wherever the number it
 * changes is worked out) and the spell it teaches, if any.
 *
 * The tree has a branch for each attribute. A branch's trunk is the perk that
 * raises the attribute (`TRUNK_PERKS`); the others grow from it, and one
 * further out names the perk before it in `requires`. The trunk itself is not
 * asked for: it is how a character short of what a perk asks gets there.
 */

/**
 * What a rank of a perk adds. Each is read where its number is derived; see
 * `perkBonus`'s callers. An effect keyed by an attribute's id is what a rank
 * adds to that attribute (`attributeLevel`), and one keyed by a skill's id is
 * the percent it adds to that skill (`skillLevel`).
 */
export interface PerkEffects extends Partial<Attributes>, Partial<Record<SkillId, number>> {
  maxHp?: number
  armorClass?: number
  actionPoints?: number
  /** Percent added to the chance of a critical hit. */
  critChance?: number
  /** Damage added to a blow with a melee weapon or bare hands, and to a shot. */
  meleeDamage?: number
  rangedDamage?: number
  /** Percent of a foe's armour class a blow with a melee weapon or bare hands passes through. */
  armorPierce?: number
  /** Hexes added to the reach of a ranged weapon. */
  range?: number
  /** Percent added to experience earned. */
  xpPercent?: number
  /** Skill points added to what each new level brings. */
  skillPoints?: number
  /** Mana added to a caster's, as gear adds it. */
  maxMana?: number
}

export type PerkEffect = keyof PerkEffects

export interface Perk {
  name: string
  /** What a rank does, for the character sheet. */
  description: string
  /** How many times the perk can be taken. */
  ranks: number
  /** The level a character must have reached to take it. */
  level: number
  attributes?: Partial<Attributes>
  skills?: Partial<Record<SkillId, number>>
  /** Its branch of the perk tree. */
  branch: AttributeId
  /** The id of the perk it grows from, of which it asks a rank; one of its own branch. Read through `perkParent`. */
  requires?: string
  effects: PerkEffects
  /** The spell a rank of it teaches. */
  spell?: SpellId
  /**
   * Its school, which makes it a spell perk: it sits in the spell tree and not
   * the perk tree, and is bought with a spell pick if there is one.
   */
  school?: SchoolId
}

/** What a spell perk asks by its tier, besides the spell before it. */
export const SPELL_TIERS = {
  1: { level: 1, magic: 40 },
  2: { level: 3, magic: 55 },
  3: { level: 5, magic: 70 },
} as const

/**
 * The perk that teaches `spell`: a node of the spell tree, asking its tier's
 * level and Magic and a rank of `requires`, Spellcasting at a school's root.
 */
function spellPerk(spell: SpellId, tier: keyof typeof SPELL_TIERS, requires: string): Perk {
  const { name, description, school, manaCost, apCost } = SPELLS[spell]
  return {
    name,
    description: `${description}; ${manaCost} mana, ${apCost} AP`,
    ranks: 1,
    level: SPELL_TIERS[tier].level,
    skills: { magic: SPELL_TIERS[tier].magic },
    branch: 'intelligence',
    requires,
    effects: {},
    spell,
    school,
  }
}

/** What every perk that raises an attribute shares. */
const gain = (branch: AttributeId): Perk => ({
  name: `Gain ${ATTRIBUTES[branch].name}`,
  description: `+1 ${ATTRIBUTES[branch].name}`,
  ranks: 2,
  level: 3,
  branch,
  effects: { [branch]: 1 },
})

export const PERKS = {
  toughness: {
    name: 'Toughness',
    description: '+6 hit points',
    ranks: 2,
    level: 1,
    attributes: { endurance: 5 },
    branch: 'endurance',
    effects: { maxHp: 6 },
  },
  dodger: {
    name: 'Dodger',
    description: '+5 armour class',
    ranks: 2,
    level: 1,
    attributes: { agility: 6 },
    branch: 'agility',
    effects: { armorClass: 5 },
  },
  heavy_hand: {
    name: 'Heavy Hand',
    description: '+1 damage with melee weapons and bare hands',
    ranks: 2,
    level: 1,
    attributes: { strength: 6 },
    branch: 'strength',
    effects: { meleeDamage: 1 },
  },
  deadly_aim: {
    name: 'Deadly Aim',
    description: '+1 damage with ranged weapons',
    ranks: 2,
    level: 1,
    attributes: { perception: 6 },
    branch: 'perception',
    effects: { rangedDamage: 1 },
  },
  keen_eye: {
    name: 'Keen Eye',
    description: '+5% chance of a critical hit',
    ranks: 2,
    level: 1,
    attributes: { luck: 6 },
    branch: 'luck',
    effects: { critChance: 5 },
  },
  far_shot: {
    name: 'Far Shot',
    description: 'Ranged weapons reach 2 hexes further',
    ranks: 1,
    level: 1,
    attributes: { perception: 7 },
    branch: 'perception',
    requires: 'deadly_aim',
    effects: { range: 2 },
  },
  quick_study: {
    name: 'Quick Study',
    description: '+10% experience',
    ranks: 2,
    level: 1,
    attributes: { intelligence: 5 },
    branch: 'intelligence',
    effects: { xpPercent: 10 },
  },
  scholar: {
    name: 'Scholar',
    description: '+2 skill points every level',
    ranks: 1,
    level: 1,
    attributes: { intelligence: 6 },
    branch: 'intelligence',
    requires: 'quick_study',
    effects: { skillPoints: 2 },
  },
  tireless: {
    name: 'Tireless',
    description: '+1 action point every turn',
    ranks: 1,
    level: 6,
    attributes: { endurance: 8, agility: 6 },
    branch: 'endurance',
    requires: 'toughness',
    effects: { actionPoints: 1 },
  },
  spellcasting: {
    name: 'Spellcasting',
    description: 'Opens the spell tree: 2 spells now and 1 every level',
    ranks: 1,
    level: 1,
    skills: { magic: 40 },
    branch: 'intelligence',
    effects: {},
  },
  weapon_training: {
    name: 'Weapon Training',
    description: '+5% Melee Weapons',
    ranks: 2,
    level: 1,
    attributes: { strength: 5 },
    branch: 'strength',
    effects: { melee: 5 },
  },
  armor_breaker: {
    name: 'Armour Breaker',
    description: 'Melee blows pierce 15% of a foe\'s armour',
    ranks: 2,
    level: 1,
    attributes: { strength: 6 },
    branch: 'strength',
    effects: { armorPierce: 15 },
  },
  marksmanship: {
    name: 'Marksmanship',
    description: '+5% Archery',
    ranks: 2,
    level: 1,
    attributes: { perception: 5 },
    branch: 'perception',
    effects: { archery: 5 },
  },
  arcane_study: {
    name: 'Arcane Study',
    description: '+5% Magic',
    ranks: 2,
    level: 1,
    attributes: { intelligence: 5 },
    branch: 'intelligence',
    effects: { magic: 5 },
  },
  // The far ends of the branches: level 6, and an attribute of 8, which a
  // character born short of it reaches with its branch's trunk at level 3.
  mighty_blow: {
    name: 'Mighty Blow',
    description: '+2 damage with melee weapons and bare hands',
    ranks: 1,
    level: 6,
    attributes: { strength: 8 },
    branch: 'strength',
    requires: 'heavy_hand',
    effects: { meleeDamage: 2 },
  },
  weapon_mastery: {
    name: 'Weapon Mastery',
    description: '+10% Melee Weapons',
    ranks: 1,
    level: 6,
    attributes: { strength: 8 },
    branch: 'strength',
    requires: 'weapon_training',
    effects: { melee: 10 },
  },
  sunder: {
    name: 'Sunder',
    description: 'Melee blows pierce 20% more of a foe\'s armour',
    ranks: 1,
    level: 6,
    attributes: { strength: 8 },
    branch: 'strength',
    requires: 'armor_breaker',
    effects: { armorPierce: 20 },
  },
  eagle_eye: {
    name: 'Eagle Eye',
    description: '+10% Archery',
    ranks: 1,
    level: 6,
    attributes: { perception: 8 },
    branch: 'perception',
    requires: 'marksmanship',
    effects: { archery: 10 },
  },
  deep_well: {
    name: 'Deep Well',
    description: '+6 mana',
    ranks: 1,
    level: 6,
    attributes: { intelligence: 8 },
    branch: 'intelligence',
    requires: 'spellcasting',
    effects: { maxMana: 6 },
  },
  arcane_mastery: {
    name: 'Arcane Mastery',
    description: '+10% Magic',
    ranks: 1,
    level: 6,
    attributes: { intelligence: 8 },
    branch: 'intelligence',
    requires: 'arcane_study',
    effects: { magic: 10 },
  },
  evasion: {
    name: 'Evasion',
    description: '+10 armour class',
    ranks: 1,
    level: 6,
    attributes: { agility: 8 },
    branch: 'agility',
    requires: 'dodger',
    effects: { armorClass: 10 },
  },
  fortune: {
    name: 'Fortune',
    description: '+10% chance of a critical hit',
    ranks: 1,
    level: 6,
    attributes: { luck: 8 },
    branch: 'luck',
    requires: 'keen_eye',
    effects: { critChance: 10 },
  },
  // Last, so that `autoAdvance` falls back on them last. They ask level 3: one
  // taken at creation would be an attribute point more than creation gives.
  gain_strength: gain('strength'),
  gain_perception: gain('perception'),
  gain_endurance: gain('endurance'),
  gain_intelligence: gain('intelligence'),
  gain_agility: gain('agility'),
  gain_luck: gain('luck'),
  // The spell tree: a perk for each spell, keyed by the spell's id, bought
  // with a spell pick first. After the attribute perks, so that `autoAdvance`'s
  // fallback to any perk never reaches them.
  magic_arrow: spellPerk('magic_arrow', 1, 'spellcasting'),
  flame_arrow: spellPerk('flame_arrow', 2, 'magic_arrow'),
  sleep: spellPerk('sleep', 2, 'magic_arrow'),
  frost_blast: spellPerk('frost_blast', 2, 'magic_arrow'),
  fireball: spellPerk('fireball', 3, 'flame_arrow'),
  acid_arrow: spellPerk('acid_arrow', 3, 'flame_arrow'),
  death_cloud: spellPerk('death_cloud', 3, 'sleep'),
  heal: spellPerk('heal', 1, 'spellcasting'),
  greater_heal: spellPerk('greater_heal', 2, 'heal'),
  heal_all: spellPerk('heal_all', 2, 'heal'),
  greater_heal_all: spellPerk('greater_heal_all', 3, 'heal_all'),
  shield: spellPerk('shield', 1, 'spellcasting'),
  protect: spellPerk('protect', 1, 'spellcasting'),
  bless: spellPerk('bless', 1, 'spellcasting'),
  mirror_image: spellPerk('mirror_image', 2, 'shield'),
  haste: spellPerk('haste', 2, 'protect'),
  bane: spellPerk('bane', 2, 'bless'),
} satisfies Record<string, Perk>

export type PerkId = keyof typeof PERKS

export const PERK_IDS = Object.keys(PERKS) as PerkId[]

/** The perk that raises each attribute, which stands as the trunk of its branch of the tree. */
export const TRUNK_PERKS: Record<AttributeId, PerkId> = {
  strength: 'gain_strength',
  perception: 'gain_perception',
  endurance: 'gain_endurance',
  intelligence: 'gain_intelligence',
  agility: 'gain_agility',
  luck: 'gain_luck',
}

/** How many ranks of `perk` the character has. */
export function perkRanks(character: Character, perk: PerkId): number {
  return character.perks[perk] ?? 0
}

/** What the character's perks add up to for one effect: each perk's share times its ranks. */
export function perkBonus(character: Character, effect: PerkEffect): number {
  let total = 0
  for (const id of PERK_IDS) total += perkRanks(character, id) * ((PERKS[id] as Perk).effects[effect] ?? 0)
  return total
}

/**
 * The character's attribute as it stands: what it was born with and what its
 * perks have added. This is the attribute everywhere; nothing else reads
 * `character.attributes`.
 */
export function attributeLevel(character: Character, id: AttributeId): number {
  return character.attributes[id] + perkBonus(character, id)
}

/** All six attributes as they stand (`attributeLevel`). */
export function attributesOf(character: Character): Attributes {
  return Object.fromEntries(ATTRIBUTE_IDS.map((id) => [id, attributeLevel(character, id)])) as Attributes
}

/** Whether `perk` is a spell perk: one of the spell tree, bought with a spell pick first. */
export function isSpellPerk(perk: PerkId): boolean {
  return (PERKS[perk] as Perk).school !== undefined
}

/** The spell perks, in the order of `PERKS`. */
export const SPELL_PERK_IDS: readonly PerkId[] = PERK_IDS.filter(isSpellPerk)

/** The perk that teaches `spell`. */
export function spellPerkOf(spell: SpellId): PerkId {
  return PERK_IDS.find((id) => (PERKS[id] as Perk).spell === spell)!
}

/** The perk `perk` grows from in the tree and asks a rank of, or null if it asks for none. */
export function perkParent(perk: PerkId): PerkId | null {
  return ((PERKS[perk] as Perk).requires as PerkId | undefined) ?? null
}

/** The spells the character knows, in `SPELL_IDS` order: those a perk it has a rank of teaches. */
export function knownSpells(character: Character): SpellId[] {
  return SPELL_IDS.filter((spell) =>
    PERK_IDS.some((id) => (PERKS[id] as Perk).spell === spell && perkRanks(character, id) > 0),
  )
}

/** The attribute a rank of `perk` would raise beyond `MAX_ATTRIBUTE`, if any: such a rank cannot be taken. */
export function cappedAttribute(character: Character, perk: PerkId): AttributeId | null {
  const { effects }: Perk = PERKS[perk]
  return ATTRIBUTE_IDS.find((id) => attributeLevel(character, id) + (effects[id] ?? 0) > MAX_ATTRIBUTE) ?? null
}

/**
 * What the character lacks of what `perk` asks, each worded as
 * `describePerkRequirements` words it; empty when it meets everything. Ranks
 * left to take, and an attribute too high to raise, are not its business.
 */
export function missingRequirements(character: Character, perk: PerkId): string[] {
  const { level, attributes = {}, skills = {} }: Perk = PERKS[perk]
  const parent = perkParent(perk)
  return [
    ...(character.level < level ? [`Level ${level}`] : []),
    ...ATTRIBUTE_IDS.filter((id) => attributeLevel(character, id) < (attributes[id] ?? 0)).map(
      (id) => `${ATTRIBUTES[id].name} ${attributes[id]}`,
    ),
    ...SKILL_IDS.filter((id) => skillLevel(character, id) < (skills[id] ?? 0)).map(
      (id) => `${SKILLS[id].name} ${skills[id]}%`,
    ),
    ...(parent && perkRanks(character, parent) < 1 ? [PERKS[parent].name] : []),
  ]
}

/** Whether the character meets what `perk` asks and has a rank of it still to take; having a pick to spend is another matter. */
export function qualifiesFor(character: Character, perk: PerkId): boolean {
  return (
    perkRanks(character, perk) < PERKS[perk].ranks &&
    cappedAttribute(character, perk) === null &&
    missingRequirements(character, perk).length === 0
  )
}

/** The perks the character could take now, in the order of `PERKS`. */
export function availablePerks(character: Character): PerkId[] {
  return PERK_IDS.filter((id) => qualifiesFor(character, id))
}

/** "Level 6, Endurance 6, Agility 6, Toughness": what a perk asks, for the character sheet, the perk before it last. */
export function describePerkRequirements(perk: PerkId): string {
  const { level, attributes = {}, skills = {} }: Perk = PERKS[perk]
  const parent = perkParent(perk)
  return [
    `Level ${level}`,
    ...ATTRIBUTE_IDS.filter((id) => attributes[id]).map((id) => `${ATTRIBUTES[id].name} ${attributes[id]}`),
    ...SKILL_IDS.filter((id) => skills[id]).map((id) => `${SKILLS[id].name} ${skills[id]}%`),
    ...(parent ? [PERKS[parent].name] : []),
  ].join(', ')
}
