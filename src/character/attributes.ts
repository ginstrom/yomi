/**
 * The six attributes a character is born with, each from `MIN_ATTRIBUTE` to
 * `MAX_ATTRIBUTE` with 5 the common run. They never change; everything else
 * about a character is worked out from them (character.ts, skills.ts), from
 * its level and from what it has learned.
 */
export const ATTRIBUTE_IDS = ['strength', 'perception', 'endurance', 'intelligence', 'agility', 'luck'] as const

export type AttributeId = (typeof ATTRIBUTE_IDS)[number]
export type Attributes = Record<AttributeId, number>

export const MIN_ATTRIBUTE = 1
export const MAX_ATTRIBUTE = 10

/** What a new character's attributes add up to: 5 in each and 5 more to place. */
export const ATTRIBUTE_POINTS = 35

export interface AttributeInfo {
  name: string
  /** What the attribute is good for, for the character sheet: short enough for one line of it. */
  description: string
}

export const ATTRIBUTES: Record<AttributeId, AttributeInfo> = {
  strength: { name: 'Strength', description: 'Hit points, melee damage and skills' },
  perception: { name: 'Perception', description: 'Archery and First Aid' },
  endurance: { name: 'Endurance', description: 'Hit points, more with every level' },
  intelligence: { name: 'Intelligence', description: 'Skill points, First Aid' },
  agility: { name: 'Agility', description: 'Action points, armour, weapon skills' },
  luck: { name: 'Luck', description: 'Chance of a critical hit' },
}
