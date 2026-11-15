import { maxHp, maxMana, weaponSkill, type Character } from './character.ts'
import { PERKS, PERK_IDS, attributeLevel, availablePerks, perkBonus, perkCost, perkLevel, qualifiesFor, type Perk, type PerkId } from './perks.ts'
import type { PathId } from './trees.ts'
import { SKILL_COST_TIERS, SKILL_IDS, raiseSkill, skillLevel, skillRaiseRefusal, type SkillId } from './skills.ts'

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
 * (`skillPointsPerLevel`) and a perk point (`PERK_POINTS_PER_LEVEL`) to spend
 * on the skill trees, where a node costs its tier's points (`perkCost`). Both
 * kinds of point wait on the character until its player spends them
 * (`raiseSkill`, `takePerk`), or `autoAdvance` does.
 */
export const EVEN_FOE_XP_PER_LEVEL = 100

/** What level 2 costs: a touch under one even foe. */
const FIRST_LEVEL_XP = 80

/** Skill points a level brings before intelligence adds a third of itself. */
const BASE_SKILL_POINTS = 2
/** The perk points every level up brings. */
export const PERK_POINTS_PER_LEVEL = 1
/** The perk points a new character has: creation.ts's `CREATION_PERK_POINTS`, kept here as creation.ts imports this module. */
const CREATION_POINTS = 3

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
 * The perk points a hero has had by `level`: the three of creation and one at
 * every level up (6 by level 4, 10 by 8, 14 by 12, 22 by 20).
 */
export function pointsAt(level: number): number {
  return CREATION_POINTS + (level - 1) * PERK_POINTS_PER_LEVEL
}

/** Whether the character has the perk points `perk` costs. */
export function canAffordPerk(character: Pick<Character, 'perkPoints'>, perk: PerkId): boolean {
  return character.perkPoints >= perkCost(perk)
}

/** The level by which saving alone affords `perk`: its level now if it can afford it already. */
export function affordableAt(character: Pick<Character, 'level' | 'perkPoints'>, perk: PerkId): number {
  return character.level + Math.max(0, Math.ceil((perkCost(perk) - character.perkPoints) / PERK_POINTS_PER_LEVEL))
}

/** Whether some skill would take a raise with the skill points the character has. */
export function canRaiseAnySkill(character: Character): boolean {
  return SKILL_IDS.some((skill) => skillRaiseRefusal(character, skill) === null)
}

/** Whether the character has skill points some skill can take (none past 100%), or the perk points for a node it could take now, waiting. */
export function canAdvance(character: Character): boolean {
  return canRaiseAnySkill(character) || availablePerks(character).some((perk) => canAffordPerk(character, perk))
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
  perkPointsGained: number
}

/**
 * Raises the character a level, whatever its experience: hit points, skill
 * points, a perk point, all its wounds healed and its mana full.
 */
export function levelUp(character: Character): void {
  character.level += 1
  character.skillPoints += skillPointsPerLevel(character)
  character.perkPoints += PERK_POINTS_PER_LEVEL
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
    perkPoints: character.perkPoints,
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
    perkPointsGained: character.perkPoints - before.perkPoints,
  }
}

/**
 * Spends `perk`'s cost in perk points on it. A node that adds hit points or
 * mana, itself or by an attribute it raises, adds as many to those the
 * character has left. Returns false if the character cannot afford it or does
 * not qualify.
 */
export function takePerk(character: Character, perk: PerkId): boolean {
  if (!canAffordPerk(character, perk) || !qualifiesFor(character, perk)) return false
  const before = { hp: maxHp(character), mana: maxMana(character) }
  character.perkPoints -= perkCost(perk)
  character.perks[perk] = 1
  character.hp += maxHp(character) - before.hp
  character.mana = Math.min(character.mana, before.mana) + maxMana(character) - before.mana
  return true
}

/**
 * The builds `autoAdvance` grows a hero by: a plan is the nodes it takes, most
 * wanted first. The design's six are written out (`knight`, `swordmaster`,
 * `ranger`, `rogue`, `evoker_healer`, `bandit_mage`); the others are a path's
 * nodes in `PERKS` order. A plan names only nodes in `PERKS`.
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

/**
 * A path's capstone, then its other nodes in `PERKS` order: the capstone is
 * taken as soon as it opens (level 12, depth 5), as a player of the path would,
 * rather than after every other node of the path.
 */
const pathPlan = (path: PathId): PerkId[] => {
  const nodes = PERK_IDS.filter((id) => (PERKS[id] as Perk).path === path)
  return [...nodes.filter((id) => (PERKS[id] as Perk).tier === 'capstone'), ...nodes.filter((id) => (PERKS[id] as Perk).tier !== 'capstone')]
}

export const AUTO_PLANS: Record<PlanId, readonly PerkId[]> = {
  knight: [
    'weapon_training',
    'toughness',
    'rooted',
    'taunt',
    'pin',
    // Shield Wall, the path's cheap fifth node, and then Unbreakable ahead of Iron Skin and Guardian: the capstone at 13
    // rather than 15 under the tiers' costs (skill trees step 30; Guardian's 3 points at 12 would push it to 18).
    'shield_wall',
    'unbreakable',
    'heavy_hand',
    'iron_skin',
    'guardian',
    'power_attack',
    'armor_breaker',
    'weapon_mastery',
  ],
  // Blademaster ahead of Weapon Mastery: the path's fifth node is Cleave, so the capstone comes at 12 rather than 15
  // (skill trees step 30). Gain Strength is refused to Aldric (strength 9), as ever.
  swordmaster: ['weapon_training', 'heavy_hand', 'power_attack', 'armor_breaker', 'cleave', 'blademaster', 'gain_strength', 'weapon_mastery', 'toughness'],
  spellsword: pathPlan('spellsword'),
  ranger: [
    'marksmanship',
    'deadly_aim',
    'aimed_shot',
    // Volley, the path's first tier 3, ahead of Far Shot and Deadeye ahead of Hunter's Mark: Volley stays at 6 and
    // the capstone at 12 under the tiers' costs (skill trees step 28).
    'volley',
    'far_shot',
    'deadeye',
    'hunters_mark',
    'pinning_shot',
    'dodger',
    'sprint',
    'skirmisher',
    'tumble',
    'evasion',
  ],
  rogue: ['backstab', 'dirty_trick', 'sprint', 'tumble', 'evasion', 'counter', 'skirmisher', 'shadowdancer'],
  rogue_archer: pathPlan('rogue'),
  assassin: pathPlan('assassin'),
  evoker: pathPlan('evoker'),
  evoker_healer: [
    'magic_arrow',
    'heal',
    'destruction',
    'flame_arrow',
    // Arcane Blood's +10 mana at 4 and Heal All at 6, ahead of Fireball (9) and Meteor (15) (skill trees step 30): saving
    // for Fireball left a level-4 Delwyn nothing new (the Bandit Camp at threat 4, 422 of 500), and without Heal All
    // camping until healed took the one-party campaign to 302 days. Mending at 4 won the camp too but kept the party
    // camping longer (`autoHeal` casts no heal that would heal past a wound), and Serenity at 4 took the campaign to 342.
    'arcane_blood',
    'heal_all',
    'fireball',
    'pyromancy',
    'meteor',
    'greater_heal',
    'mending',
    'death_cloud',
    'greater_heal_all',
    'purify',
  ],
  // Ice Lance ahead of Web: with the capstone first, Web would come before Ice Lance and leave the cryomancer without it
  // when the capstone opens (skill trees step 24, under picks: 292 of 500 at Bandit Camp threat 7 with it, 31 without).
  cryomancer: ['glacial_prison', 'frostbite', 'numbing_cold', 'sleep', 'frost_blast', 'ice_lance', 'web', 'lingering_cold'],
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
 * Whether `perk` is not held and the character would qualify for it if only
 * its level were higher: nothing but the level lacking, no attribute capped.
 * No other ask reads the level, so raising it alone is the check.
 */
export function waitsOnlyForLevel(character: Character, perk: PerkId): boolean {
  return qualifiesFor({ ...character, level: Math.max(character.level, perkLevel(perk)) }, perk)
}

/**
 * Spends everything the character has waiting, the way a player of its build
 * would: skill points on the skill of the weapon in hand (a mage's wand makes
 * that Magic) and then on whatever is left to raise; then perk points, again
 * and again, on a target: the first node of `plan` it qualifies for, or would
 * if only its level were higher, else the first node in `PERKS` order it
 * qualifies for now that is no capstone. A target short of the level or of the
 * points stops it: the points are saved for it, never spent on a cheaper node
 * further down. A node short of anything else (depth, a skill, an attribute, a
 * node it requires) is skipped, as waiting alone will not open it. It is what
 * the simulator's parties and the bandits do with their levels, so balance
 * runs fight heroes that have grown.
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
  for (;;) {
    const target =
      AUTO_PLANS[plan].find((id) => waitsOnlyForLevel(character, id)) ?? fallback.find((id) => qualifiesFor(character, id))
    if (!target || !takePerk(character, target)) break
  }
}
