import { ATTRIBUTES, ATTRIBUTE_IDS, MAX_ATTRIBUTE, type AttributeId, type Attributes } from './attributes.ts'
import type { Character } from './character.ts'
import { ABILITIES, ABILITY_IDS, type AbilityId } from '../combat/abilities.ts'
import { TRAIT_IDS, type OnHit, type TraitId } from '../combat/combat.ts'
import { SPELLS, SPELL_IDS, type HeroSpellId } from '../combat/spells.ts'
import { SKILL_IDS, skillLevel, type SkillId } from './skills.ts'
import { PATHS, TIERS, calling, capstoneOf, pathDepth, type PathId, type Tier } from './trees.ts'

/**
 * Perks: the nodes of the skill trees (trees.ts). A character picks
 * `CREATION_PERK_PICKS` as it is created (creation.ts) and one at every even
 * level (progression.ts), each buying one node it qualifies for. A node is
 * data: its path and tier, what it asks beyond its tier's level and depth
 * (attributes, skills, any one of several skills, a node of its own path it
 * `requires`), what it adds (summed by `perkBonus` wherever the number it
 * changes is worked out) and the spell it teaches, if any. Every node has one
 * rank. Asks gate taking a node, never keeping it.
 *
 * `PERKS` is ordered by tree, path (`PATH_IDS` order), then tier; the tree
 * view lays a path's nodes out in that order.
 */

/**
 * What a node adds. Each is read where its number is derived; see
 * `perkBonus`'s callers. An effect keyed by an attribute's id is what it adds
 * to that attribute (`attributeLevel`), and one keyed by a skill's id is the
 * percent it adds to that skill (`skillLevel`).
 */
export interface PerkEffects extends Partial<Attributes>, Partial<Record<SkillId, number>> {
  maxHp?: number
  armorClass?: number
  actionPoints?: number
  /** Percent added to the chance of a critical hit. */
  critChance?: number
  /** Damage added to a blow with a melee weapon or bare hands, and to a shot. */
  meleeDamage?: number
  rangedDamage?: number
  /** Points of a foe's resistance a blow with a melee weapon or bare hands passes through. */
  armorPierce?: number
  /** Hexes added to the reach of a ranged weapon. */
  range?: number
  /** Skill points added to what each new level brings. */
  skillPoints?: number
  /** Mana added to the character's, as gear adds it. */
  maxMana?: number
  /** Points taken off every weapon hit it takes (step 04 derives it). */
  resistance?: number
  /** Ward against every element (step 04). */
  wardAll?: number
  /** Ward against blight (step 04). */
  wardBlight?: number
  /** Armour class while a shield is in the off hand (step 04). */
  shieldAc?: number
  /** Damage added to each instance of its damaging spells (step 04). */
  spellDamage?: number
  /** Damage added to its fire spells (step 04). */
  fireSpellDamage?: number
  /** Damage added to its frost spells (step 04). */
  frostSpellDamage?: number
  /** Hit points added to what its heals restore (step 04). */
  healBonus?: number
  /** Turns added to the statuses its hostile spells lay (step 04). */
  hostileExtend?: number
  /** Turns added to the statuses its friendly spells lay (step 04). */
  friendlyExtend?: number
  /** Hexes added to the range of its friendly spells aimed at an ally or a point (step 04). */
  friendlyRange?: number
  /** Action points off every spell (step 04). */
  spellApDiscount?: number
  /** Action points off its healing spells (step 04). */
  healApDiscount?: number
  /** Elemental damage added to its Strikes (step 13). */
  imbueDamage?: number
  /** Mana a melee hit restores (step 21). */
  manaOnHit?: number
  /** Mana regained as its side's turn begins (step 21). */
  manaRegen?: number
  /** To hit and damage added to its free attacks (step 21). */
  opportunityToHit?: number
  opportunityDamage?: number
  /** To hit and damage added to its weapon attacks from a foe's rear arc (step 21). */
  rearToHit?: number
  rearDamage?: number
  /** To hit added to its attacks after it has moved this turn (step 21). */
  movedToHit?: number
  /** Damage added against a foe at half its hit points or less (step 21). */
  executeDamage?: number
  /** Damage added to its critical hits, after the dice are doubled (step 21). */
  critDamage?: number
}

export type PerkEffect = keyof PerkEffects

export interface Perk {
  name: string
  /** What it does, for the character sheet: only what works in the game as it stands. */
  description: string
  /** Its path, and with it its tree. */
  path: PathId
  /** Its tier, which sets the level and the depth in its path it asks (`TIERS`). */
  tier: Tier
  attributes?: Partial<Attributes>
  skills?: Partial<Record<SkillId, number>>
  /** Skills of which any one suffices: "Melee 40% or Archery 40%". */
  anySkill?: Partial<Record<SkillId, number>>
  /** The id of a node of its own path it asks for. Read through `perkParent`. */
  requires?: string
  effects: PerkEffects
  /** Added to the hero's on-hit effects while its main hand is melee or bare (step 04 derives it). */
  meleeOnHit?: readonly OnHit[]
  /** The spell it teaches. */
  spell?: HeroSpellId
  /** The technique it teaches (abilities.ts). */
  ability?: AbilityId
  /** The rule it gives that the engine reads by name (`TRAIT_IDS`). */
  trait?: TraitId
}

/** The skills' names as the asks word them: "Melee 40%". */
const SKILL_SHORT: Record<SkillId, string> = { melee: 'Melee', archery: 'Archery', magic: 'Magic' }

/** A node that teaches `spell`, its description the spell's with its mana and AP. */
function spellNode(
  spell: HeroSpellId,
  path: PathId,
  tier: Tier,
  asks: Pick<Perk, 'skills' | 'anySkill' | 'requires'>,
): Perk {
  const { name, description, manaCost, apCost } = SPELLS[spell]
  return { name, description: `${description}; ${manaCost} mana, ${apCost} AP`, path, tier, ...asks, effects: {}, spell }
}

/** The cost of a technique as its node words it: "3 mana, weapon AP + 1, recharge 1". */
function techniqueCost(ability: AbilityId): string {
  const { apCost, weaponAp, manaCost, recharge } = ABILITIES[ability]
  const parts: string[] = []
  if (manaCost !== undefined) parts.push(`${manaCost} mana`)
  parts.push(weaponAp !== undefined ? `weapon AP + ${weaponAp}` : `${apCost} AP`)
  if (recharge > 0) parts.push(`recharge ${recharge}`)
  return parts.join(', ')
}

/** A node that teaches `ability`, its description the ability's with its cost. */
function techniqueNode(
  ability: AbilityId,
  path: PathId,
  tier: Tier,
  asks: Pick<Perk, 'attributes' | 'skills' | 'anySkill'>,
): Perk {
  const { name, description } = ABILITIES[ability]
  return { name, description: `${techniqueCost(ability)}. ${description}`, path, tier, ...asks, effects: {}, ability }
}

export const PERKS = {
  // ---- Warrior: Swordmaster
  weapon_training: {
    name: 'Weapon Training',
    description: '+10% Melee Weapons',
    path: 'swordmaster',
    tier: 1,
    attributes: { strength: 5 },
    effects: { melee: 10 },
  },
  heavy_hand: {
    name: 'Heavy Hand',
    description: '+2 damage with melee weapons and bare hands',
    path: 'swordmaster',
    tier: 1,
    attributes: { strength: 6 },
    effects: { meleeDamage: 2 },
  },
  power_attack: techniqueNode('power_attack', 'swordmaster', 2, { skills: { melee: 40 } }),
  armor_breaker: {
    name: 'Armour Breaker',
    description: "Melee blows pierce 2 points of a foe's resistance",
    path: 'swordmaster',
    tier: 2,
    attributes: { strength: 6 },
    effects: { armorPierce: 2 },
  },
  gain_strength: {
    name: 'Gain Strength',
    description: '+2 Strength; not for one whose Strength is above 8',
    path: 'swordmaster',
    tier: 2,
    effects: { strength: 2 },
  },
  cleave: techniqueNode('cleave', 'swordmaster', 3, { skills: { melee: 55 } }),
  weapon_mastery: {
    name: 'Weapon Mastery',
    description: "+10% Melee Weapons, +2 melee damage, and melee blows pierce 1 more point of a foe's resistance",
    path: 'swordmaster',
    tier: 3,
    attributes: { strength: 8 },
    effects: { melee: 10, meleeDamage: 2, armorPierce: 1 },
  },
  blademaster: {
    name: 'Blademaster',
    description: 'Once a turn, a weapon blow or strike technique of its own that fells a foe gives back the action points it cost',
    path: 'swordmaster',
    tier: 'capstone',
    skills: { melee: 70 },
    effects: {},
    trait: 'blademaster',
  },
  // ---- Warrior: Heavy Knight
  toughness: {
    name: 'Toughness',
    description: '+8 hit points and +1 Endurance',
    path: 'heavy_knight',
    tier: 1,
    attributes: { endurance: 5 },
    effects: { maxHp: 8, endurance: 1 },
  },
  shield_wall: {
    name: 'Shield Wall',
    description: '+8 armour class while a shield is in the off hand',
    path: 'heavy_knight',
    tier: 1,
    effects: { shieldAc: 8 },
  },
  taunt: techniqueNode('taunt', 'heavy_knight', 2, { attributes: { endurance: 5 } }),
  rooted: {
    name: 'Rooted',
    description: 'At the end of its side\'s turn, if it has not moved, it is rooted: +10 armour class and +2 resistance until it moves or the end of its next turn',
    path: 'heavy_knight',
    tier: 2,
    attributes: { endurance: 6 },
    effects: {},
    trait: 'rooted',
  },
  pin: techniqueNode('pin', 'heavy_knight', 3, { skills: { melee: 55 } }),
  iron_skin: {
    name: 'Iron Skin',
    description: '+2 resistance; its free attacks get +15 to hit and +3 damage',
    path: 'heavy_knight',
    tier: 3,
    attributes: { endurance: 7 },
    effects: { resistance: 2, opportunityToHit: 15, opportunityDamage: 3 },
  },
  guardian: {
    name: 'Guardian',
    description: 'Allies beside it (not itself) get +5 armour class; two Guardians do not add up',
    path: 'heavy_knight',
    tier: 3,
    attributes: { endurance: 7 },
    effects: {},
    trait: 'guardian',
  },
  unbreakable: {
    name: 'Unbreakable',
    description: 'The first time each battle that damage would bring it to 0, it is left at 1 hit point and Shielded for 2 turns',
    path: 'heavy_knight',
    tier: 'capstone',
    attributes: { endurance: 8 },
    effects: {},
    trait: 'unbreakable',
  },
  // ---- Warrior: Spellsword
  arcane_blood: {
    name: 'Arcane Blood',
    description: '+10 mana',
    path: 'spellsword',
    tier: 1,
    // Intelligence 3, so a warrior of the usual 3 (Aldric, the Captain) can open the path and reach Arcane Knight.
    attributes: { intelligence: 3 },
    effects: { maxMana: 10 },
  },
  flame_strike: techniqueNode('flame_strike', 'spellsword', 1, { skills: { melee: 30 } }),
  frost_strike: techniqueNode('frost_strike', 'spellsword', 2, { skills: { melee: 40 } }),
  spell_ward: {
    name: 'Spell Ward',
    description: '+3 ward against every element',
    path: 'spellsword',
    tier: 2,
    effects: { wardAll: 3 },
  },
  thunder_strike: techniqueNode('thunder_strike', 'spellsword', 3, { skills: { melee: 55 } }),
  battle_mage: {
    name: 'Battle Mage',
    description: "+6 mana; each melee hit that strikes no image restores 1 mana; its Strikes' elemental damage +2",
    path: 'spellsword',
    tier: 3,
    attributes: { intelligence: 5 },
    effects: { maxMana: 6, imbueDamage: 2, manaOnHit: 1 },
  },
  arcane_knight: {
    name: 'Arcane Knight',
    description: 'Every melee hit adds 4 fire damage, as a rune does, and its Strikes cost only the weapon\'s AP',
    path: 'spellsword',
    tier: 'capstone',
    skills: { melee: 70 },
    effects: {},
    meleeOnHit: [{ damage: 4, element: 'fire' }],
    trait: 'arcane_knight',
  },
  // ---- Scout: Ranger
  marksmanship: {
    name: 'Marksmanship',
    description: '+10% Archery',
    path: 'ranger',
    tier: 1,
    attributes: { perception: 5 },
    effects: { archery: 10 },
  },
  deadly_aim: {
    name: 'Deadly Aim',
    description: '+2 damage with ranged weapons',
    path: 'ranger',
    tier: 1,
    attributes: { perception: 6 },
    effects: { rangedDamage: 2 },
  },
  aimed_shot: techniqueNode('aimed_shot', 'ranger', 2, { skills: { archery: 40 } }),
  far_shot: {
    name: 'Far Shot',
    description: 'Ranged weapons reach 2 hexes further; +1 Perception',
    path: 'ranger',
    tier: 2,
    attributes: { perception: 6 },
    effects: { range: 2, perception: 1 },
  },
  hunters_mark: techniqueNode('hunters_mark', 'ranger', 2, { skills: { archery: 40 } }),
  volley: techniqueNode('volley', 'ranger', 3, { skills: { archery: 55 } }),
  pinning_shot: techniqueNode('pinning_shot', 'ranger', 3, { skills: { archery: 55 } }),
  deadeye: {
    name: 'Deadeye',
    description: '+10% Archery; its shots pierce 3 points of resistance, and a critical shot rolls triple dice instead of double',
    path: 'ranger',
    tier: 'capstone',
    skills: { archery: 70 },
    effects: { archery: 10 },
    trait: 'deadeye',
  },
  // ---- Scout: Rogue
  dodger: {
    name: 'Dodger',
    description: '+10 armour class',
    path: 'rogue',
    tier: 1,
    attributes: { agility: 6 },
    effects: { armorClass: 10 },
  },
  sprint: techniqueNode('sprint', 'rogue', 1, { attributes: { agility: 5 } }),
  skirmisher: {
    name: 'Skirmisher',
    description: '+1 Agility; after it has moved this turn, its attacks get +10 to hit',
    path: 'rogue',
    tier: 2,
    attributes: { agility: 6 },
    effects: { agility: 1, movedToHit: 10 },
  },
  dirty_trick: techniqueNode('dirty_trick', 'rogue', 2, { skills: { melee: 40 } }),
  tumble: {
    name: 'Tumble',
    description: 'Its moves provoke no free attacks',
    path: 'rogue',
    tier: 3,
    attributes: { agility: 7 },
    effects: {},
    trait: 'tumble',
  },
  evasion: {
    name: 'Evasion',
    description: '+10 armour class and +1 action point every turn',
    path: 'rogue',
    tier: 3,
    attributes: { agility: 8 },
    effects: { armorClass: 10, actionPoints: 1 },
  },
  counter: {
    name: 'Counter',
    description: "Once per enemy turn, when a foe's melee blow misses it, it strikes back with a free attack, if it holds a melee weapon and the foe is in reach",
    path: 'rogue',
    tier: 3,
    skills: { melee: 55 },
    effects: {},
    trait: 'counter',
  },
  shadowdancer: {
    name: 'Shadowdancer',
    description: 'As its side\'s turn begins, it gains a mirror image for 2 turns, unless it has one already',
    path: 'rogue',
    tier: 'capstone',
    attributes: { agility: 8 },
    effects: {},
    trait: 'shadowdancer',
  },
  // ---- Scout: Assassin
  keen_eye: {
    name: 'Keen Eye',
    description: '+10% chance of a critical hit',
    path: 'assassin',
    tier: 1,
    attributes: { luck: 6 },
    effects: { critChance: 10 },
  },
  backstab: {
    name: 'Backstab',
    description: "+15 to hit and +4 damage on a weapon attack from a foe's rear arc",
    path: 'assassin',
    tier: 1,
    anySkill: { melee: 30, archery: 30 },
    effects: { rearToHit: 15, rearDamage: 4 },
  },
  venom_strike: techniqueNode('venom_strike', 'assassin', 2, { anySkill: { melee: 40, archery: 40 } }),
  hamstring: techniqueNode('hamstring', 'assassin', 2, { anySkill: { melee: 40, archery: 40 } }),
  fortune: {
    name: 'Fortune',
    description: '+10% chance of a critical hit and +1 Luck; its critical hits deal 4 more damage, after the dice are doubled',
    path: 'assassin',
    tier: 3,
    attributes: { luck: 7 },
    effects: { critChance: 10, luck: 1, critDamage: 4 },
  },
  ambush: {
    name: 'Ambush',
    description: 'Its first weapon attack of a battle (not a free one) gets +25 to hit, and a hit is critical',
    path: 'assassin',
    tier: 3,
    attributes: { agility: 6 },
    effects: {},
    trait: 'ambush',
  },
  executioner: {
    name: 'Executioner',
    description: '+5 damage against a foe at half its hit points or less',
    path: 'assassin',
    tier: 3,
    anySkill: { melee: 55, archery: 55 },
    effects: { executeDamage: 5 },
  },
  deathblow: {
    name: 'Deathblow',
    description: 'A weapon hit that leaves a foe at a quarter of its maximum hit points or less fells it, unless the foe is blightborn',
    path: 'assassin',
    tier: 'capstone',
    anySkill: { melee: 70, archery: 70 },
    effects: {},
    trait: 'deathblow',
  },
  // ---- Mage: Evoker
  magic_arrow: spellNode('magic_arrow', 'evoker', 1, { skills: { magic: 40 } }),
  destruction: {
    name: 'Destruction',
    description: '+2 damage to each instance of its damaging spells; +4 mana',
    path: 'evoker',
    tier: 1,
    attributes: { intelligence: 5 },
    effects: { spellDamage: 2, maxMana: 4 },
  },
  flame_arrow: spellNode('flame_arrow', 'evoker', 2, { skills: { magic: 55 }, requires: 'magic_arrow' }),
  pyromancy: {
    name: 'Pyromancy',
    description: '+3 damage to its fire spells',
    path: 'evoker',
    tier: 2,
    attributes: { intelligence: 6 },
    effects: { fireSpellDamage: 3 },
  },
  fireball: spellNode('fireball', 'evoker', 3, { skills: { magic: 65 }, requires: 'flame_arrow' }),
  acid_arrow: spellNode('acid_arrow', 'evoker', 3, { skills: { magic: 65 }, requires: 'flame_arrow' }),
  death_cloud: spellNode('death_cloud', 'evoker', 3, { skills: { magic: 70 } }),
  meteor: spellNode('meteor', 'evoker', 'capstone', { skills: { magic: 80 } }),
  // ---- Mage: Cryomancer
  frostbite: spellNode('frostbite', 'cryomancer', 1, { skills: { magic: 40 } }),
  numbing_cold: {
    name: 'Numbing Cold',
    description: '+3 damage to its frost spells',
    path: 'cryomancer',
    tier: 1,
    attributes: { intelligence: 5 },
    effects: { frostSpellDamage: 3 },
  },
  sleep: spellNode('sleep', 'cryomancer', 2, { skills: { magic: 55 } }),
  frost_blast: spellNode('frost_blast', 'cryomancer', 2, { skills: { magic: 55 }, requires: 'frostbite' }),
  web: spellNode('web', 'cryomancer', 3, { skills: { magic: 65 } }),
  ice_lance: spellNode('ice_lance', 'cryomancer', 3, { skills: { magic: 70 } }),
  lingering_cold: {
    name: 'Lingering Cold',
    description: 'Statuses its hostile spells lay last 1 turn longer; +10% Magic',
    path: 'cryomancer',
    tier: 3,
    attributes: { intelligence: 7 },
    effects: { hostileExtend: 1, magic: 10 },
  },
  glacial_prison: spellNode('glacial_prison', 'cryomancer', 'capstone', { skills: { magic: 80 } }),
  // ---- Mage: Arcanist
  shield: spellNode('shield', 'arcanist', 1, { skills: { magic: 40 } }),
  arcane_study: {
    name: 'Arcane Study',
    description: '+10% Magic',
    path: 'arcanist',
    tier: 1,
    attributes: { intelligence: 5 },
    effects: { magic: 10 },
  },
  mirror_image: spellNode('mirror_image', 'arcanist', 2, { skills: { magic: 55 } }),
  ward: spellNode('ward', 'arcanist', 2, { skills: { magic: 55 } }),
  haste: spellNode('haste', 'arcanist', 3, { skills: { magic: 65 } }),
  lasting_magic: {
    name: 'Lasting Magic',
    description: 'Statuses its friendly spells lay last 1 turn longer; +1 Intelligence',
    path: 'arcanist',
    tier: 3,
    attributes: { intelligence: 7 },
    effects: { friendlyExtend: 1, intelligence: 1 },
  },
  quickened_casting: {
    name: 'Quickened Casting',
    description: 'Its spells cost 1 AP less (never below 2); +8 mana',
    path: 'arcanist',
    tier: 3,
    skills: { magic: 70 },
    effects: { spellApDiscount: 1, maxMana: 8 },
  },
  mass_haste: spellNode('mass_haste', 'arcanist', 'capstone', { skills: { magic: 80 } }),
  // ---- Cleric: Healer
  heal: spellNode('heal', 'healer', 1, { skills: { magic: 40 } }),
  mending: {
    name: 'Mending',
    description: 'Its heals restore 4 more',
    path: 'healer',
    tier: 1,
    skills: { magic: 30 },
    effects: { healBonus: 4 },
  },
  greater_heal: spellNode('greater_heal', 'healer', 2, { skills: { magic: 55 }, requires: 'heal' }),
  heal_all: spellNode('heal_all', 'healer', 2, { skills: { magic: 55 }, requires: 'heal' }),
  greater_heal_all: spellNode('greater_heal_all', 'healer', 3, { skills: { magic: 65 }, requires: 'heal_all' }),
  purify: spellNode('purify', 'healer', 3, { skills: { magic: 55 } }),
  swift_hands: {
    name: 'Swift Hands',
    description: 'Its healing spells cost 1 AP less (never below 2); +8 mana',
    path: 'healer',
    tier: 3,
    skills: { magic: 60 },
    effects: { healApDiscount: 1, maxMana: 8 },
  },
  revive: spellNode('revive', 'healer', 'capstone', { skills: { magic: 75 } }),
  // ---- Cleric: Paladin
  bless: spellNode('bless', 'paladin', 1, { anySkill: { melee: 30, magic: 40 } }),
  smite: techniqueNode('smite', 'paladin', 1, { skills: { melee: 30 } }),
  lay_on_hands: spellNode('lay_on_hands', 'paladin', 2, { anySkill: { melee: 40, magic: 40 } }),
  blessed_armour: {
    name: 'Blessed Armour',
    description: '+1 resistance, +3 ward against blight, +6 mana',
    path: 'paladin',
    tier: 2,
    attributes: { endurance: 5 },
    effects: { resistance: 1, wardBlight: 3, maxMana: 6 },
  },
  aura_of_courage: {
    name: 'Aura of Courage',
    description: 'Allies within 2 hexes (not itself) get +5 to hit; two such auras do not add up',
    path: 'paladin',
    tier: 3,
    skills: { melee: 55 },
    effects: {},
    trait: 'courage',
  },
  consecrate: techniqueNode('consecrate', 'paladin', 3, { skills: { melee: 55 } }),
  sacred_weapon: {
    name: 'Sacred Weapon',
    description: '+10% Melee Weapons; every melee hit adds 2 damage, and 4 more as bane',
    path: 'paladin',
    tier: 3,
    skills: { melee: 60 },
    effects: { melee: 10 },
    meleeOnHit: [{ damage: 2 }, { damage: 4, bane: true }],
  },
  aegis: {
    name: 'Aegis',
    description: 'Allies within 2 hexes, itself included, get +2 resistance and +2 ward against every element; two such auras do not add up',
    path: 'paladin',
    tier: 'capstone',
    skills: { melee: 70 },
    effects: {},
    trait: 'aegis',
  },
  // ---- Cleric: Saint
  serenity: {
    name: 'Serenity',
    description: 'Regains 2 mana as its side\'s turn begins (never above its maximum); its friendly spells aimed at an ally or a point reach 2 hexes further',
    path: 'saint',
    tier: 1,
    attributes: { intelligence: 5 },
    effects: { friendlyRange: 2, manaRegen: 2 },
  },
  bane: spellNode('bane', 'saint', 1, { skills: { magic: 40 } }),
  protect: spellNode('protect', 'saint', 2, { skills: { magic: 55 } }),
  scholar: {
    name: 'Scholar',
    description: '+2 skill points every level',
    path: 'saint',
    tier: 2,
    attributes: { intelligence: 6 },
    effects: { skillPoints: 2 },
  },
  curse: spellNode('curse', 'saint', 3, { skills: { magic: 65 } }),
  renew: spellNode('renew', 'saint', 3, { skills: { magic: 65 } }),
  holy_light: spellNode('holy_light', 'saint', 3, { skills: { magic: 70 } }),
  sanctuary: {
    name: 'Sanctuary',
    description: 'As its side\'s turn begins, every ally within 2 hexes, itself included, regains 3 hit points',
    path: 'saint',
    tier: 'capstone',
    skills: { magic: 80 },
    effects: {},
    trait: 'sanctuary',
  },
} satisfies Record<string, Perk>

export type PerkId = keyof typeof PERKS

export const PERK_IDS = Object.keys(PERKS) as PerkId[]

/** The level `perk` asks: its tier's. */
export function perkLevel(perk: PerkId): number {
  return TIERS[(PERKS[perk] as Perk).tier].level
}

/** What a node gives: a spell, a technique used at will or for mana, or a passive effect. */
export type NodeKind = 'passive' | 'at-will' | 'mana' | 'spell'

/** What kind of node `perk` is, derived from its data. */
export function nodeKind(perk: PerkId): NodeKind {
  const node: Perk = PERKS[perk]
  if (node.spell) return 'spell'
  if (node.ability) return ABILITIES[node.ability].manaCost ? 'mana' : 'at-will'
  return 'passive'
}

/** The node that teaches `spell`, or null if none does. */
export function perkTeaching(spell: HeroSpellId): PerkId | null {
  return PERK_IDS.find((id) => (PERKS[id] as Perk).spell === spell) ?? null
}

/** How many ranks of `perk` the character has: 0 or 1, every node having one rank. */
export function perkRanks(character: Pick<Character, 'perks'>, perk: PerkId): number {
  return character.perks[perk] ?? 0
}

/** What the character's nodes add up to for one effect. */
export function perkBonus(character: Pick<Character, 'perks'>, effect: PerkEffect): number {
  let total = 0
  for (const id of PERK_IDS) total += perkRanks(character, id) * ((PERKS[id] as Perk).effects[effect] ?? 0)
  return total
}

/**
 * The character's attribute as it stands: what it was born with and what its
 * nodes have added, never past `MAX_ATTRIBUTE`. This is the attribute
 * everywhere; nothing else reads `character.attributes`.
 */
export function attributeLevel(character: Character, id: AttributeId): number {
  return Math.min(MAX_ATTRIBUTE, character.attributes[id] + perkBonus(character, id))
}

/** All six attributes as they stand (`attributeLevel`). */
export function attributesOf(character: Character): Attributes {
  return Object.fromEntries(ATTRIBUTE_IDS.map((id) => [id, attributeLevel(character, id)])) as Attributes
}

/** The node `perk` asks for, or null if it asks for none. */
export function perkParent(perk: PerkId): PerkId | null {
  return ((PERKS[perk] as Perk).requires as PerkId | undefined) ?? null
}

/** The spells the character knows, in `SPELL_IDS` order: those a node it holds teaches. */
export function knownSpells(character: Character): HeroSpellId[] {
  return SPELL_IDS.filter((spell) => {
    const node = perkTeaching(spell)
    return node !== null && perkRanks(character, node) > 0
  })
}

/** The techniques the character knows, in `ABILITY_IDS` order: those a node it holds teaches. */
export function knownAbilities(character: Pick<Character, 'perks'>): AbilityId[] {
  const taught = new Set(PERK_IDS.filter((id) => perkRanks(character, id) > 0).map((id) => (PERKS[id] as Perk).ability))
  return ABILITY_IDS.filter((ability) => taught.has(ability))
}

/** The traits the character's nodes give it, in `TRAIT_IDS` order, once each. */
export function traitsOf(character: Pick<Character, 'perks'>): TraitId[] {
  const given = new Set(PERK_IDS.filter((id) => perkRanks(character, id) > 0).map((id) => (PERKS[id] as Perk).trait))
  return TRAIT_IDS.filter((trait) => given.has(trait))
}

/**
 * The attribute a node that only raises attributes (Gain Strength) would
 * take past `MAX_ATTRIBUTE`, if any: such a node cannot be taken. A node that
 * raises one beside its own effect (Toughness) is never refused for it; the
 * attribute just stops at the maximum.
 */
export function cappedAttribute(character: Character, perk: PerkId): AttributeId | null {
  const { effects }: Perk = PERKS[perk]
  const keys = Object.keys(effects)
  const onlyAttributes = keys.length > 0 && keys.every((key) => (ATTRIBUTE_IDS as readonly string[]).includes(key))
  if (!onlyAttributes) return null
  return ATTRIBUTE_IDS.find((id) => character.attributes[id] + perkBonus(character, id) + (effects[id] ?? 0) > MAX_ATTRIBUTE) ?? null
}

const skillWords = (skills: Partial<Record<SkillId, number>>, id: SkillId) => `${SKILL_SHORT[id]} ${skills[id]}%`

/** "3 nodes in Heavy Knight". */
const depthWords = (depth: number, path: PathId) => `${depth} ${depth === 1 ? 'node' : 'nodes'} in ${PATHS[path].name}`

const callingWords = (path: PathId) => `${PATHS[path].name} must be your deepest path`

const ONE_CAPSTONE = 'Only one capstone'

/**
 * What the character lacks of what `perk` asks, each worded as
 * `describePerkRequirements` words it, in its order: the level, attributes,
 * skills, any one of several skills, the node it requires, the depth in its
 * path and, for a capstone, the calling and the one capstone. Empty when it
 * meets everything; whether it holds the node already is not its business.
 */
export function missingRequirements(character: Character, perk: PerkId): string[] {
  const { path, tier, attributes = {}, skills = {}, anySkill = {} }: Perk = PERKS[perk]
  const parent = perkParent(perk)
  const { level, depth } = TIERS[tier]
  const anyOf = SKILL_IDS.filter((id) => anySkill[id] !== undefined)
  const anyMet = anyOf.some((id) => skillLevel(character, id) >= anySkill[id]!)
  return [
    ...(character.level < level ? [`Level ${level}`] : []),
    ...ATTRIBUTE_IDS.filter((id) => attributeLevel(character, id) < (attributes[id] ?? 0)).map(
      (id) => `${ATTRIBUTES[id].name} ${attributes[id]}`,
    ),
    ...SKILL_IDS.filter((id) => skillLevel(character, id) < (skills[id] ?? 0)).map((id) => skillWords(skills, id)),
    ...(anyOf.length > 0 && !anyMet ? [anyOf.map((id) => skillWords(anySkill, id)).join(' or ')] : []),
    ...(parent && perkRanks(character, parent) < 1 ? [PERKS[parent].name] : []),
    ...(pathDepth(character, path) < depth ? [depthWords(depth, path)] : []),
    ...(tier === 'capstone' && !calling(character).includes(path) ? [callingWords(path)] : []),
    ...(tier === 'capstone' && capstoneOf(character) !== null ? [ONE_CAPSTONE] : []),
  ]
}

/** Whether the character could take `perk` now: it does not hold it, may raise what it raises, and meets every ask. Having a pick is another matter. */
export function qualifiesFor(character: Character, perk: PerkId): boolean {
  return (
    perkRanks(character, perk) < 1 &&
    cappedAttribute(character, perk) === null &&
    missingRequirements(character, perk).length === 0
  )
}

/** The nodes the character could take now, in the order of `PERKS`. */
export function availablePerks(character: Character): PerkId[] {
  return PERK_IDS.filter((id) => qualifiesFor(character, id))
}

/** "Level 6, Melee 55%, 3 nodes in Heavy Knight": what a node asks, out of context, in `missingRequirements`'s words and order. */
export function describePerkRequirements(perk: PerkId): string {
  const { path, tier, attributes = {}, skills = {}, anySkill = {} }: Perk = PERKS[perk]
  const parent = perkParent(perk)
  const { level, depth } = TIERS[tier]
  const anyOf = SKILL_IDS.filter((id) => anySkill[id] !== undefined)
  return [
    `Level ${level}`,
    ...ATTRIBUTE_IDS.filter((id) => attributes[id]).map((id) => `${ATTRIBUTES[id].name} ${attributes[id]}`),
    ...SKILL_IDS.filter((id) => skills[id]).map((id) => skillWords(skills, id)),
    ...(anyOf.length > 0 ? [anyOf.map((id) => skillWords(anySkill, id)).join(' or ')] : []),
    ...(parent ? [PERKS[parent].name] : []),
    ...(depth > 0 ? [depthWords(depth, path)] : []),
    ...(tier === 'capstone' ? [callingWords(path), ONE_CAPSTONE] : []),
  ].join(', ')
}
