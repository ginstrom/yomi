/**
 * The six attributes of a character, each from `MIN_ATTRIBUTE` to
 * `MAX_ATTRIBUTE`, averaging a little over 5 at birth. The ones it is born with never
 * change, and perks add to them (`attributeLevel` in perks.ts); everything
 * else about a character is worked out from that sum (character.ts,
 * skills.ts), from its level and from what it has learned.
 */
export const ATTRIBUTE_IDS = ['strength', 'perception', 'endurance', 'intelligence', 'agility', 'luck'] as const

export type AttributeId = (typeof ATTRIBUTE_IDS)[number]
export type Attributes = Record<AttributeId, number>

export const MIN_ATTRIBUTE = 1
export const MAX_ATTRIBUTE = 10

/**
 * What a new character's attributes add up to: a little over 5 in each, and
 * one short of three at `MAX_ATTRIBUTE`. One attribute at 10 leaves two at 7
 * and the rest low; two at 10 leave the other four at 3 on average.
 */
export const ATTRIBUTE_POINTS = 32

export interface AttributeInfo {
  name: string
  /** What the attribute is good for, for the character sheet: short enough for one line of it. */
  description: string
}

export const ATTRIBUTES: Record<AttributeId, AttributeInfo> = {
  strength: { name: 'Strength', description: 'Hit points, melee damage and skills' },
  perception: { name: 'Perception', description: 'Archery' },
  endurance: { name: 'Endurance', description: 'Hit points, more with every level' },
  intelligence: { name: 'Intelligence', description: 'Skill points, mana and Magic' },
  agility: { name: 'Agility', description: 'Action points, armour, weapon skills' },
  luck: { name: 'Luck', description: 'Chance of a critical hit' },
}
