import { ATTRIBUTES, ATTRIBUTE_IDS, type Attributes } from './attributes.ts'
import type { Character } from './character.ts'
import { SKILLS, SKILL_IDS, skillLevel, type SkillId } from './skills.ts'

/**
 * Perks: a character picks one every `PERK_LEVEL_STEP` levels (progression.ts)
 * from those it qualifies for by level, attributes and skills. A perk is
 * data: what it asks and what each rank of it adds, summed by `perkBonus`
 * wherever the number it changes is worked out.
 */

/** What a rank of a perk adds. Each is read where its number is derived; see `perkBonus`'s callers. */
export interface PerkEffects {
  maxHp?: number
  armorClass?: number
  actionPoints?: number
  /** Percent added to the chance of a critical hit. */
  critChance?: number
  /** Damage added to a blow with a melee weapon or bare hands, and to a shot. */
  meleeDamage?: number
  rangedDamage?: number
  /** Hexes added to the reach of a ranged weapon. */
  range?: number
  /** Percent added to experience earned. */
  xpPercent?: number
  /** Skill points added to what each new level brings. */
  skillPoints?: number
  /** Hit points added to what the character's First Aid tends after a battle. */
  firstAid?: number
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
  effects: PerkEffects
}

export const PERKS = {
  toughness: {
    name: 'Toughness',
    description: '+6 hit points',
    ranks: 2,
    level: 3,
    attributes: { endurance: 5 },
    effects: { maxHp: 6 },
  },
  dodger: {
    name: 'Dodger',
    description: '+5 armour class',
    ranks: 2,
    level: 3,
    attributes: { agility: 6 },
    effects: { armorClass: 5 },
  },
  heavy_hand: {
    name: 'Heavy Hand',
    description: '+1 damage with melee weapons and bare hands',
    ranks: 2,
    level: 3,
    attributes: { strength: 6 },
    effects: { meleeDamage: 1 },
  },
  deadly_aim: {
    name: 'Deadly Aim',
    description: '+1 damage with ranged weapons',
    ranks: 2,
    level: 3,
    attributes: { perception: 6 },
    effects: { rangedDamage: 1 },
  },
  keen_eye: {
    name: 'Keen Eye',
    description: '+5% chance of a critical hit',
    ranks: 2,
    level: 3,
    attributes: { luck: 6 },
    effects: { critChance: 5 },
  },
  far_shot: {
    name: 'Far Shot',
    description: 'Ranged weapons reach 2 hexes further',
    ranks: 1,
    level: 3,
    attributes: { perception: 7 },
    effects: { range: 2 },
  },
  quick_study: {
    name: 'Quick Study',
    description: '+10% experience',
    ranks: 2,
    level: 3,
    attributes: { intelligence: 5 },
    effects: { xpPercent: 10 },
  },
  scholar: {
    name: 'Scholar',
    description: '+2 skill points every level',
    ranks: 1,
    level: 3,
    attributes: { intelligence: 6 },
    effects: { skillPoints: 2 },
  },
  healer: {
    name: 'Healer',
    description: 'First Aid tends 3 more hit points',
    ranks: 2,
    level: 3,
    skills: { firstAid: 50 },
    effects: { firstAid: 3 },
  },
  tireless: {
    name: 'Tireless',
    description: '+1 action point every turn',
    ranks: 1,
    level: 6,
    attributes: { endurance: 6, agility: 6 },
    effects: { actionPoints: 1 },
  },
} satisfies Record<string, Perk>

export type PerkId = keyof typeof PERKS

export const PERK_IDS = Object.keys(PERKS) as PerkId[]

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

/** Whether the character meets what `perk` asks and has a rank of it still to take; having a pick to spend is another matter. */
export function qualifiesFor(character: Character, perk: PerkId): boolean {
  const { ranks, level, attributes = {}, skills = {} }: Perk = PERKS[perk]
  return (
    perkRanks(character, perk) < ranks &&
    character.level >= level &&
    ATTRIBUTE_IDS.every((id) => character.attributes[id] >= (attributes[id] ?? 0)) &&
    SKILL_IDS.every((id) => skillLevel(character, id) >= (skills[id] ?? 0))
  )
}

/** The perks the character could take now, in the order of `PERKS`. */
export function availablePerks(character: Character): PerkId[] {
  return PERK_IDS.filter((id) => qualifiesFor(character, id))
}

/** "Level 6, Agility 6, Melee Weapons 90%": what a perk asks, for the character sheet. */
export function describePerkRequirements(perk: PerkId): string {
  const { level, attributes = {}, skills = {} }: Perk = PERKS[perk]
  return [
    `Level ${level}`,
    ...ATTRIBUTE_IDS.filter((id) => attributes[id]).map((id) => `${ATTRIBUTES[id].name} ${attributes[id]}`),
    ...SKILL_IDS.filter((id) => skills[id]).map((id) => `${SKILLS[id].name} ${skills[id]}%`),
  ].join(', ')
}
