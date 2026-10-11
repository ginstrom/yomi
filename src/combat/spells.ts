import type { DamageRoll } from './combat.ts'

/**
 * Spells, as the engine casts them. A spell says what it costs and what it
 * does; which perk teaches it and what that perk asks is the perk's business
 * (character/perks.ts), so this layer knows nothing of characters.
 */
export const SPELL_IDS = ['magic_arrow'] as const

export type SpellId = (typeof SPELL_IDS)[number]

export interface Spell {
  name: string
  description: string
  manaCost: number
  apCost: number
  /** How many hexes away it can strike. */
  range: number
  /** What it does to the foe it strikes. */
  damage: DamageRoll
}

export const SPELLS: Record<SpellId, Spell> = {
  magic_arrow: {
    name: 'Magic Arrow',
    description: 'A bolt of force that flies true whichever way its target faces',
    manaCost: 3,
    apCost: 4,
    range: 5,
    damage: { count: 1, sides: 10, bonus: 0 },
  },
}
