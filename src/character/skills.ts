import type { Attributes } from './attributes.ts'
import type { Character } from './character.ts'

/**
 * Skills, each a percentage. A skill starts from the character's attributes,
 * a tagged one `TAG_BONUS` higher, and is raised with the skill points every
 * level brings (progression.ts). A weapon skill is the wielder's chance to
 * hit with that kind of weapon, before the foe's armour (character.ts).
 */
export const SKILL_IDS = ['melee', 'archery', 'unarmed', 'firstAid'] as const

export type SkillId = (typeof SKILL_IDS)[number]

export interface SkillInfo {
  name: string
  /** What the skill does, for the character sheet. */
  description: string
  /** Where the skill starts, from the character's attributes. */
  base(attributes: Attributes): number
}

export const SKILLS: Record<SkillId, SkillInfo> = {
  melee: {
    name: 'Melee Weapons',
    description: 'Chance to hit with a blade or an axe',
    base: ({ strength, agility }) => 30 + 2 * (strength + agility),
  },
  archery: {
    name: 'Archery',
    description: 'Chance to hit with a bow',
    base: ({ perception, agility }) => 30 + 2 * (perception + agility),
  },
  unarmed: {
    name: 'Unarmed',
    description: 'Chance to hit with bare hands, which also strike harder at 55%, 75% and 100%',
    base: ({ strength, agility }) => 40 + 2 * (strength + agility),
  },
  firstAid: {
    name: 'First Aid',
    description: 'After a victory the best healer standing tends everyone: 1 hit point per 10%',
    base: ({ perception, intelligence }) => 10 + 2 * (perception + intelligence),
  },
}

/** How many skills a character is tagged in: the ones it has a gift for. */
export const TAGGED_SKILLS = 2
/** What a tag adds to a skill from the start. */
export const TAG_BONUS = 20
/** What a skill point adds to a skill, and to a tagged one. */
export const SKILL_STEP = 1
export const TAGGED_SKILL_STEP = 2
/** No skill is raised beyond this. */
export const MAX_SKILL = 150
/** From this level on, mastery comes dearer: a raise costs `MASTERY_COST` points instead of 1. */
export const MASTERY_LEVEL = 100
export const MASTERY_COST = 2

export function isTagged(character: Character, skill: SkillId): boolean {
  return character.tagged.includes(skill)
}

/** The character's level in `skill`, in percent: its attributes' share, its tag's and what it has trained. */
export function skillLevel(character: Character, skill: SkillId): number {
  const tag = isTagged(character, skill) ? TAG_BONUS : 0
  return SKILLS[skill].base(character.attributes) + tag + character.trained[skill]
}

/** How many skill points the next raise of `skill` costs the character, or null if it is as high as it goes. */
export function skillRaiseCost(character: Character, skill: SkillId): number | null {
  const level = skillLevel(character, skill)
  if (level >= MAX_SKILL) return null
  return level >= MASTERY_LEVEL ? MASTERY_COST : 1
}

/**
 * Spends skill points on one raise of `skill`: `SKILL_STEP` percent, or
 * `TAGGED_SKILL_STEP` for a tagged skill. Returns false if the character has
 * not the points or the skill is at `MAX_SKILL`.
 */
export function raiseSkill(character: Character, skill: SkillId): boolean {
  const cost = skillRaiseCost(character, skill)
  if (cost === null || character.skillPoints < cost) return false
  const step = isTagged(character, skill) ? TAGGED_SKILL_STEP : SKILL_STEP
  character.skillPoints -= cost
  character.trained[skill] += Math.min(step, MAX_SKILL - skillLevel(character, skill))
  return true
}
