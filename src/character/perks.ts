import { ATTRIBUTES, ATTRIBUTE_IDS, MAX_ATTRIBUTE, type AttributeId, type Attributes } from './attributes.ts'
import type { Character } from './character.ts'
import { SPELL_IDS, type SpellId } from '../combat/spells.ts'
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
  magic_arrow: {
    name: 'Magic Arrow',
    description: 'Teaches Magic Arrow: 1d10 to a foe within 5 hexes, for 3 mana',
    ranks: 1,
    level: 1,
    skills: { magic: 50 },
    branch: 'intelligence',
    effects: {},
    spell: 'magic_arrow',
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
    requires: 'magic_arrow',
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
