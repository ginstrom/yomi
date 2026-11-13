import { maxHp, maxMana, weaponSkill, type Character } from './character.ts'
import { PERKS, PERK_IDS, attributeLevel, availablePerks, perkBonus, qualifiesFor, type Perk, type PerkId } from './perks.ts'
import type { PathId } from './trees.ts'
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
 * (`skillPointsPerLevel`) and, at every even level (`PICK_LEVEL_STEP`), a
 * pick to spend on a node of the skill trees. The points and the pick wait on the character until its player
 * spends them (`raiseSkill`, `takePerk`), or `autoAdvance` does.
 */
export const EVEN_FOE_XP_PER_LEVEL = 100

/** What level 2 costs: a touch under one even foe. */
const FIRST_LEVEL_XP = 80

/** Skill points a level brings before intelligence adds a third of itself. */
const BASE_SKILL_POINTS = 2
/** Every level that is a multiple of this brings a pick. */
export const PICK_LEVEL_STEP = 2
/** The picks a new character has (creation.ts's `CREATION_PERK_PICKS`). */
const CREATION_PICKS = 3

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

/**
 * The picks a hero has had by `level`: the three of creation and one at every
 * even level (5 by level 5, 8 by level 10, 13 by level 20).
 */
export function picksAt(level: number): number {
  return CREATION_PICKS + Math.floor(level / PICK_LEVEL_STEP)
}

/** The level the character's next pick comes at: the next even level. */
export function nextPerkLevel(character: Character): number {
  return (Math.floor(character.level / PICK_LEVEL_STEP) + 1) * PICK_LEVEL_STEP
}

/** Whether the character has a pick it could spend on `perk` now. */
export function hasPickFor(character: Character, _perk: PerkId): boolean {
  return character.perkPicks > 0
}

/** Whether the character has skill points, or a pick and a node it could spend it on, waiting. */
export function canAdvance(character: Character): boolean {
  return character.skillPoints > 0 || (character.perkPicks > 0 && availablePerks(character).length > 0)
}

/** What a gain of experience came to. */
export interface XpGain {
  /** The experience earned. */
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
 * points, a pick at every even level, all its wounds healed and its mana full.
 */
export function levelUp(character: Character): void {
  character.level += 1
  character.skillPoints += skillPointsPerLevel(character)
  if (character.level % PICK_LEVEL_STEP === 0) character.perkPicks += 1
  character.hp = maxHp(character)
  character.mana = maxMana(character)
}

/**
 * Gives `character` experience, raising its level as often as the experience
 * pays for; what is left over counts towards the next.
 */
export function gainXp(character: Character, xp: number): XpGain {
  const earned = Math.round(xp)
  const before = {
    maxHp: maxHp(character),
    level: character.level,
    points: character.skillPoints,
    picks: character.perkPicks,
  }
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
 * Spends a pick on `perk`. A node that adds hit points or mana, itself or by
 * an attribute it raises, adds as many to those the character has left.
 * Returns false if the character has no pick or does not qualify.
 */
export function takePerk(character: Character, perk: PerkId): boolean {
  if (!hasPickFor(character, perk) || !qualifiesFor(character, perk)) return false
  const before = { hp: maxHp(character), mana: maxMana(character) }
  character.perkPicks -= 1
  character.perks[perk] = 1
  character.hp += maxHp(character) - before.hp
  character.mana = Math.min(character.mana, before.mana) + maxMana(character) - before.mana
  return true
}

/**
 * The builds `autoAdvance` grows a hero by: a plan is the nodes it takes, most
 * wanted first. The design's six are written out (`knight`, `swordmaster`,
 * `ranger`, `rogue`, `evoker_healer`, `bandit_mage`); the others are a path's
 * nodes in `PERKS` order. A plan names only nodes in `PERKS`; the later
 * stages' nodes take their places as they arrive.
 */
export const PLAN_IDS = [
  'knight',
  'swordmaster',
  'spellsword',
  'ranger',
  'rogue',
  'rogue_archer',
  'assassin',
  'evoker',
  'evoker_healer',
  'cryomancer',
  'arcanist',
  'healer',
  'paladin',
  'saint',
  'bandit_mage',
] as const

export type PlanId = (typeof PLAN_IDS)[number]

/** A path's nodes in `PERKS` order. */
const pathPlan = (path: PathId): PerkId[] => PERK_IDS.filter((id) => (PERKS[id] as Perk).path === path)

export const AUTO_PLANS: Record<PlanId, readonly PerkId[]> = {
  knight: ['weapon_training', 'heavy_hand', 'toughness', 'iron_skin', 'shield_wall', 'armor_breaker', 'weapon_mastery'],
  swordmaster: ['weapon_training', 'heavy_hand', 'armor_breaker', 'gain_strength', 'weapon_mastery', 'toughness'],
  spellsword: pathPlan('spellsword'),
  ranger: ['marksmanship', 'deadly_aim', 'far_shot', 'deadeye', 'dodger', 'skirmisher', 'evasion'],
  rogue: ['evasion', 'skirmisher'],
  rogue_archer: pathPlan('rogue'),
  assassin: pathPlan('assassin'),
  evoker: pathPlan('evoker'),
  evoker_healer: [
    'magic_arrow',
    'heal',
    'destruction',
    'flame_arrow',
    'heal_all',
    'fireball',
    'pyromancy',
    'mending',
    'meteor',
    'greater_heal',
    'death_cloud',
    'greater_heal_all',
  ],
  cryomancer: pathPlan('cryomancer'),
  arcanist: pathPlan('arcanist'),
  healer: pathPlan('healer'),
  paladin: pathPlan('paladin'),
  saint: pathPlan('saint'),
  bandit_mage: ['flame_arrow', 'destruction', 'fireball', 'heal', 'heal_all'],
}

/** The plan a hero grows by when none is named: by its tagged skill, Melee `knight`, Archery `ranger`, Magic `evoker_healer`. */
export function planFor(character: Character): PlanId {
  const tag = character.tagged[0]
  return tag === 'archery' ? 'ranger' : tag === 'magic' ? 'evoker_healer' : 'knight'
}

/**
 * Spends everything the character has waiting, the way a player of its build
 * would: skill points on the skill of the weapon in hand (a mage's wand makes
 * that Magic) and then on whatever is left to raise; then each pick on the
 * first node of `plan` it qualifies for, else on the first node in `PERKS`
 * order it qualifies for that is no capstone, until no pick or no such node is
 * left. It is what the simulator's parties and the bandits do with their
 * levels, so balance runs fight heroes that have grown.
 */
export function autoAdvance(character: Character, plan: PlanId = planFor(character)): void {
  const weapon = weaponSkill(character.equipment.mainHand)
  const order: Array<[SkillId, number]> = [
    [weapon, SKILL_COST_TIERS[0].level],
    [weapon, Infinity],
    ...SKILL_IDS.map((skill): [SkillId, number] => [skill, Infinity]),
  ]
  for (const [skill, upTo] of order) {
    while (skillLevel(character, skill) < upTo && raiseSkill(character, skill));
  }
  const fallback = PERK_IDS.filter((id) => (PERKS[id] as Perk).tier !== 'capstone')
  while (character.perkPicks > 0) {
    const perk = [...AUTO_PLANS[plan], ...fallback].find((id) => qualifiesFor(character, id))
    if (!perk || !takePerk(character, perk)) break
  }
}
