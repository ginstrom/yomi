import { maxHp, weaponSkill, type Character } from './character.ts'
import { PERK_IDS, attributeLevel, availablePerks, perkBonus, qualifiesFor, type PerkId } from './perks.ts'
import { SKILL_COST_TIERS, SKILL_IDS, raiseSkill, skillLevel, type SkillId } from './skills.ts'

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
 *
 * A level brings hit points (`hpPerLevel`), skill points to spend on skills
 * (`skillPointsPerLevel`) and, every `PERK_LEVEL_STEP` levels, a perk to
 * choose. The points and the pick wait on the character until its player
 * spends them (`raiseSkill`, `takePerk`), or `autoAdvance` does.
 */
export const EVEN_FOE_XP_PER_LEVEL = 100

/** What level 2 costs: a touch under one even foe. */
const FIRST_LEVEL_XP = 80

/** Skill points a level brings before intelligence adds a third of itself. */
const BASE_SKILL_POINTS = 2
/** Every level that is a multiple of this brings a perk. */
export const PERK_LEVEL_STEP = 3

/** The experience it takes to rise from `level` to the next. */
export function xpToNextLevel(level: number): number {
  return level <= 1 ? FIRST_LEVEL_XP : EVEN_FOE_XP_PER_LEVEL * level * (level - 1)
}

/**
 * The skill points each new level brings the character: more for the clever,
 * though not many more (2 at intelligence 1 or 2, 5 at 9 or 10), as a tagged
 * skill doubles what each buys.
 */
export function skillPointsPerLevel(character: Character): number {
  return BASE_SKILL_POINTS + Math.floor(attributeLevel(character, 'intelligence') / 3) + perkBonus(character, 'skillPoints')
}

/** The level the character's next perk comes at. */
export function nextPerkLevel(character: Character): number {
  return (Math.floor(character.level / PERK_LEVEL_STEP) + 1) * PERK_LEVEL_STEP
}

/** Whether the character has skill points or a perk waiting to be spent. */
export function canAdvance(character: Character): boolean {
  return character.skillPoints > 0 || (character.perkPicks > 0 && availablePerks(character).length > 0)
}

/** What a gain of experience came to. */
export interface XpGain {
  /** The experience earned, after what the character's perks add to it. */
  xp: number
  /** How many levels it bought; usually none. */
  levelsGained: number
  /** What those levels brought. */
  maxHpGained: number
  skillPointsGained: number
  perksGained: number
}

/**
 * Raises the character a level, whatever its experience: hit points, skill
 * points, a perk pick at every `PERK_LEVEL_STEP`th level, and all its wounds
 * healed.
 */
export function levelUp(character: Character): void {
  character.level += 1
  character.skillPoints += skillPointsPerLevel(character)
  if (character.level % PERK_LEVEL_STEP === 0) character.perkPicks += 1
  character.hp = maxHp(character)
}

/**
 * Gives `character` experience, raising its level as often as the experience
 * pays for; what is left over counts towards the next.
 */
export function gainXp(character: Character, xp: number): XpGain {
  const earned = Math.round(xp * (1 + perkBonus(character, 'xpPercent') / 100))
  const before = { maxHp: maxHp(character), level: character.level, points: character.skillPoints, picks: character.perkPicks }
  character.xp += earned
  while (character.xp >= xpToNextLevel(character.level)) {
    character.xp -= xpToNextLevel(character.level)
    levelUp(character)
  }
  return {
    xp: earned,
    levelsGained: character.level - before.level,
    maxHpGained: maxHp(character) - before.maxHp,
    skillPointsGained: character.skillPoints - before.points,
    perksGained: character.perkPicks - before.picks,
  }
}

/**
 * Spends a perk pick on a rank of `perk`. A perk that adds hit points, itself
 * or by an attribute it raises, adds as many to those the character has
 * left. Returns false if the character has no pick or does not qualify.
 */
export function takePerk(character: Character, perk: PerkId): boolean {
  if (character.perkPicks < 1 || !qualifiesFor(character, perk)) return false
  const hpBefore = maxHp(character)
  character.perkPicks -= 1
  character.perks[perk] = (character.perks[perk] ?? 0) + 1
  character.hp += maxHp(character) - hpBefore
  return true
}

/**
 * The perks `autoAdvance` takes, most wanted first; it takes any other only
 * when none of these is on offer, in the order of `PERKS`, where the perks
 * that raise an attribute come last. A perk at the end of a branch is not on offer
 * until the one before it is taken.
 */
const AUTO_PERKS: readonly PerkId[] = [
  'weapon_mastery',
  'eagle_eye',
  'arcane_mastery',
  'tireless',
  'mighty_blow',
  'sunder',
  'evasion',
  'toughness',
  'dodger',
  'heavy_hand',
  'armor_breaker',
  'deadly_aim',
  'keen_eye',
  'weapon_training',
  'marksmanship',
  'arcane_study',
]

/**
 * Spends everything the character has waiting, the way a plain fighter
 * would: skill points on the skill of the weapon in hand (a mage's wand
 * makes that Magic) and then on whatever is left to raise; perk picks on
 * combat perks first. It is what the simulator's parties do with their
 * levels, so balance runs fight heroes that have grown.
 */
export function autoAdvance(character: Character): void {
  const weapon = weaponSkill(character.equipment.mainHand)
  const order: Array<[SkillId, number]> = [
    [weapon, SKILL_COST_TIERS[0].level],
    [weapon, Infinity],
    ...SKILL_IDS.map((skill): [SkillId, number] => [skill, Infinity]),
  ]
  for (const [skill, upTo] of order) {
    while (skillLevel(character, skill) < upTo && raiseSkill(character, skill));
  }
  while (character.perkPicks > 0) {
    const perk = [...AUTO_PERKS, ...PERK_IDS].find((id) => qualifiesFor(character, id))
    if (!perk || !takePerk(character, perk)) break
  }
}
