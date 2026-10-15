import type { Attributes } from './attributes.ts'
import type { Character } from './character.ts'
import { attributesOf, perkBonus } from './perks.ts'

/**
 * Skills, each a percentage. A skill starts low, from the character's
 * attributes alone, a tagged one `TAG_BONUS` higher, and is raised with the
 * skill points of creation (creation.ts) and of every level (progression.ts),
 * and by the perk that trains it. A weapon skill is the wielder's chance to
 * hit with that kind of weapon, before the foe's armour (character.ts), and
 * Magic is the chance of a spell or a wand striking.
 */
export const SKILL_IDS = ['melee', 'archery', 'magic'] as const

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
    description: 'Chance to hit with a blade, an axe or bare hands',
    base: ({ strength, agility }) => strength + agility,
  },
  archery: {
    name: 'Archery',
    description: 'Chance to hit with a bow',
    base: ({ perception, agility }) => perception + agility,
  },
  magic: {
    name: 'Magic',
    description: 'Chance of a spell or a wand striking, and what spell perks ask for',
    base: ({ intelligence }) => 2 * intelligence,
  },
}

/** How many skills a character is tagged in: the one it has a gift for. */
export const TAGGED_SKILLS = 1
/** What a tag adds to a skill from the start. */
export const TAG_BONUS = 20
/** What a skill point adds to a skill, and to a tagged one. */
export const SKILL_STEP = 1
export const TAGGED_SKILL_STEP = 2
/** No skill is raised beyond this. */
export const MAX_SKILL = 150
/**
 * What a raise costs as a skill nears mastery: from each `level` on, `cost`
 * skill points instead of 1, the dearest that applies. Ascending by level.
 */
export const SKILL_COST_TIERS: readonly { level: number; cost: number }[] = [
  { level: 80, cost: 2 },
  { level: 90, cost: 3 },
]

export function isTagged(character: Character, skill: SkillId): boolean {
  return character.tagged.includes(skill)
}

/**
 * The character's level in `skill`, in percent: its attributes' share, its
 * tag's, what it has trained and what its perks add. This is the skill
 * everywhere, for a chance to hit as for what a perk asks.
 */
export function skillLevel(character: Character, skill: SkillId): number {
  const tag = isTagged(character, skill) ? TAG_BONUS : 0
  return SKILLS[skill].base(attributesOf(character)) + tag + character.trained[skill] + perkBonus(character, skill)
}

/** How many skill points the next raise of `skill` costs the character, or null if it is as high as it goes. */
export function skillRaiseCost(character: Character, skill: SkillId): number | null {
  const level = skillLevel(character, skill)
  if (level >= MAX_SKILL) return null
  return SKILL_COST_TIERS.findLast((tier) => level >= tier.level)?.cost ?? 1
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
