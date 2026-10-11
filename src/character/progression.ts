import type { Character } from './character.ts'

/**
 * Levels and the experience that buys them. A foe is worth a fixed amount of
 * experience, set by how strong it is (`FOE_XP`), while each level costs more
 * than the one before, so the first levels come quickly and later ones are
 * earned.
 *
 * The yardstick is the even foe: one about as strong as a hero of level L is
 * worth `EVEN_FOE_XP_PER_LEVEL * L`, and a weak one about half that. Level 2
 * costs a little less than one even foe, so a first win over something
 * slightly weaker is enough; after that level L + 1 costs L - 1 even foes:
 * one at level 2, two at level 3, three at level 4.
 */
export const EVEN_FOE_XP_PER_LEVEL = 100

/** What level 2 costs: a touch under one even foe. */
const FIRST_LEVEL_XP = 80

/** Hit points every level adds. */
export const LEVEL_UP_HP = 4
/** Every level that is a multiple of this adds `TO_HIT_PER_STEP` to the chance to hit. */
export const ATTACK_BONUS_LEVEL_STEP = 2
export const TO_HIT_PER_STEP = 5

/** The experience it takes to rise from `level` to the next. */
export function xpToNextLevel(level: number): number {
  return level <= 1 ? FIRST_LEVEL_XP : EVEN_FOE_XP_PER_LEVEL * level * (level - 1)
}

/** What a gain of experience came to. */
export interface XpGain {
  xp: number
  /** How many levels it bought; usually none. */
  levelsGained: number
  /** What those levels added to the character's base stats. */
  maxHpGained: number
  toHitGained: number
}

/**
 * Gives `character` experience, raising its level as often as the experience
 * pays for; what is left over counts towards the next. A level raises base
 * stats, and a character that levels up is restored to full hit points.
 */
export function gainXp(character: Character, xp: number): XpGain {
  const gain: XpGain = { xp, levelsGained: 0, maxHpGained: 0, toHitGained: 0 }
  character.xp += xp
  while (character.xp >= xpToNextLevel(character.level)) {
    character.xp -= xpToNextLevel(character.level)
    character.level += 1
    gain.levelsGained += 1
    gain.maxHpGained += LEVEL_UP_HP
    if (character.level % ATTACK_BONUS_LEVEL_STEP === 0) gain.toHitGained += TO_HIT_PER_STEP
  }
  character.base.maxHp += gain.maxHpGained
  character.base.toHit += gain.toHitGained
  if (gain.levelsGained > 0) character.hp = character.base.maxHp
  return gain
}
