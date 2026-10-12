import type { CombatantStats, DamageRoll } from '../combat/combat.ts'
import type { GearChange } from '../engine/battleEngine.ts'
import {
  BACKPACK_SIZE,
  EQUIPMENT_SLOT_ORDER,
  IRON_SWORD,
  OAK_SHIELD,
  SPARK_WAND,
  STEEL_ARMOR,
  WEAPONS,
  YEW_BOW,
  type Equipment,
  type EquipmentSlot,
  type Item,
  type ItemStats,
} from '../inventory/inventory.ts'
import type { Attributes } from './attributes.ts'
import { attributeLevel, attributesOf, knownSpells, perkBonus, type PerkId } from './perks.ts'
import type { PortraitId } from './portraits.ts'
import { SKILL_IDS, skillLevel, type SkillId } from './skills.ts'

/**
 * One of the player's persistent characters: what it was born with
 * (`attributes`, `tagged`), what it has learned (`level`, `trained`, `perks`)
 * and what it carries. Its numbers are never stored: hit points, action
 * points, mana and the stats it fights with are derived from those, so every
 * screen agrees on them. That goes for its attributes too: a perk that
 * raises one is added where the attribute is read (`attributeLevel`), never
 * written over the one it was born with.
 */
export interface Character {
  name: string
  /** The face shown for it in the party's column and on its panel. */
  portrait: PortraitId
  level: number
  /** Experience earned towards the next level; see progression.ts. */
  xp: number
  /** The attributes it was born with; read them through `attributeLevel`, which adds what its perks have. */
  attributes: Attributes
  /** The skills the character has a gift for; see skills.ts. */
  tagged: SkillId[]
  /** What skill points have added to each skill, in percent. */
  trained: Record<SkillId, number>
  /** Skill points earned by levelling and not yet spent. */
  skillPoints: number
  /** Ranks taken of each perk. */
  perks: Partial<Record<PerkId, number>>
  /** Perks earned by levelling and not yet chosen. */
  perkPicks: number
  hp: number
  equipment: Equipment
  backpack: Array<Item | null>
}

/** Hit points before attributes and levels add theirs. */
const BASE_HP = 10
/** Action points before agility adds its half. */
const BASE_ACTION_POINTS = 5
const UNARMED_ATTACK_AP_COST = 3
const MELEE_RANGE = 1
/** Mana a point of intelligence gives a caster at level 1. */
const MANA_PER_INTELLIGENCE = 2
const UNARMED_WEAPON = 'Fists'
/** What bare hands roll: a fallback, whatever the skill behind them. */
const UNARMED_DAMAGE: DamageRoll = { count: 1, sides: 4, bonus: 0 }

/** The hit points a new level adds: more for the hardy. */
export function hpPerLevel(character: Character): number {
  return 2 + Math.floor(attributeLevel(character, 'endurance') / 2)
}

export function maxHp(character: Character): number {
  const { strength, endurance } = attributesOf(character)
  return BASE_HP + strength + endurance + (character.level - 1) * hpPerLevel(character) + perkBonus(character, 'maxHp')
}

/**
 * The skill a character strikes with, holding `weapon` or nothing: its chance
 * to hit comes from that skill. A weapon may name its own, as a wand does;
 * otherwise a ranged one is shot with Archery and anything else, bare hands
 * included, is swung with Melee Weapons.
 */
export function weaponSkill(weapon: Item | undefined): SkillId {
  if (weapon?.stats?.skill) return weapon.stats.skill
  return (weapon?.stats?.attackRange ?? MELEE_RANGE) > MELEE_RANGE ? 'archery' : 'melee'
}

/** What the character's gear gives it: every item it wears but an off-hand one under a two-handed weapon. */
function wornStats(character: Character): ItemStats[] {
  // A two-handed weapon leaves no hand for a shield. equipFromBackpack() keeps the
  // two apart, so this only matters for equipment put together some other way.
  const { offHand, ...rest } = character.equipment
  const worn = isTwoHanded(character.equipment.mainHand) ? rest : { ...rest, offHand }
  return Object.values(worn).flatMap((item) => (item?.stats ? [item.stats] : []))
}

/**
 * The mana the character enters every battle with: none for one that knows no
 * spell, whatever it wears; otherwise twice its intelligence, half its
 * intelligence more for each level above the first, and what its gear adds.
 */
export function maxMana(character: Character): number {
  if (knownSpells(character).length === 0) return 0
  const intelligence = attributeLevel(character, 'intelligence')
  const gear = wornStats(character).reduce((total, stats) => total + (stats.maxMana ?? 0), 0)
  return MANA_PER_INTELLIGENCE * intelligence + (character.level - 1) * Math.floor(intelligence / 2) + gear
}

export function deriveCombatStats(character: Character): CombatantStats {
  const { strength, agility, luck } = attributesOf(character)
  const skill = weaponSkill(character.equipment.mainHand)

  let ac = agility + perkBonus(character, 'armorClass')
  let toHit = skillLevel(character, skill)
  let critChance = luck + perkBonus(character, 'critChance')
  let spellSkill = skillLevel(character, 'magic')
  let damage = UNARMED_DAMAGE
  let attackApCost = UNARMED_ATTACK_AP_COST
  let attackRange = MELEE_RANGE
  for (const stats of wornStats(character)) {
    if (stats.damage) damage = stats.damage
    if (stats.attackApCost !== undefined) attackApCost = stats.attackApCost
    if (stats.attackRange !== undefined) attackRange = stats.attackRange
    ac += stats.acBonus ?? 0
    toHit += stats.toHit ?? 0
    critChance += stats.critChance ?? 0
    spellSkill += stats.spellSkill ?? 0
  }
  // By its reach and not its skill: a wand is a ranged weapon that strikes with Magic.
  const ranged = attackRange > MELEE_RANGE
  // Strength tells in a blow, not in a shot.
  const might = ranged ? 0 : Math.max(0, Math.floor((strength - 5) / 2))
  const damageBonus = might + perkBonus(character, ranged ? 'rangedDamage' : 'meleeDamage')
  const spells = knownSpells(character)

  return {
    name: character.name,
    maxHp: maxHp(character),
    ac,
    toHit,
    critChance,
    damage: { ...damage, bonus: damage.bonus + damageBonus },
    weapon: character.equipment.mainHand?.name ?? UNARMED_WEAPON,
    attackApCost,
    attackRange: attackRange + (ranged ? perkBonus(character, 'range') : 0),
    actionPoints: BASE_ACTION_POINTS + Math.floor(agility / 2) + perkBonus(character, 'actionPoints'),
    ...(spells.length > 0 ? { magic: { maxMana: maxMana(character), skill: spellSkill, spells } } : {}),
  }
}

const RING_SLOTS: readonly EquipmentSlot[] = ['ring1', 'ring2']

/** Whether `item` is a weapon that takes both hands, leaving none for the off hand. */
export function isTwoHanded(item: Item | undefined): boolean {
  return item?.stats?.twoHanded === true
}

/**
 * Equips the backpack item at `index` in the slot it belongs to; whatever was
 * there takes its place in the backpack. A ring goes on the first ring slot
 * if that is empty, else the second if that is, else in place of the first.
 * A two-handed weapon and an off-hand
 * item cannot be held together, so equipping either also stows the other. If
 * both hands come off and the backpack has room for only one, the other-hand
 * item falls onto `ground`, the pile at the character's feet. Returns false if
 * that backpack space is empty.
 */
export function equipFromBackpack(character: Character, index: number, ground: Item[]): boolean {
  const { equipment, backpack } = character
  const item = backpack[index]
  if (!item) return false

  const slot: EquipmentSlot = item.ring ? (RING_SLOTS.find((ring) => !equipment[ring]) ?? RING_SLOTS[0]) : item.slot
  const replaced = equipment[slot] ?? null
  const otherHand: EquipmentSlot | null =
    slot === 'mainHand' && isTwoHanded(item)
      ? 'offHand'
      : slot === 'offHand' && isTwoHanded(equipment.mainHand)
        ? 'mainHand'
        : null
  const freed = (otherHand && equipment[otherHand]) ?? null

  // The item's own space takes one of the two; a second needs an empty space.
  backpack[index] = replaced ?? freed
  if (freed) {
    delete equipment[otherHand!]
    if (replaced) {
      const space = backpack.indexOf(null)
      if (space === -1) ground.push(freed)
      else backpack[space] = freed
    }
  }
  equipment[slot] = item
  return true
}

/**
 * Stows the item in `slot` in the first empty backpack space. Returns false
 * if the slot is empty or the backpack is full.
 */
export function unequipToBackpack(character: Character, slot: EquipmentSlot): boolean {
  const item = character.equipment[slot]
  const space = character.backpack.indexOf(null)
  if (!item || space === -1) return false
  character.backpack[space] = item
  delete character.equipment[slot]
  return true
}

/** Drops the backpack item at `index` onto `ground`. Returns false if that space is empty. */
export function dropFromBackpack(character: Character, index: number, ground: Item[]): boolean {
  const item = character.backpack[index]
  if (!item) return false
  character.backpack[index] = null
  ground.push(item)
  return true
}

/** Drops the item in `slot` onto `ground`. Returns false if the slot is empty. */
export function dropEquipped(character: Character, slot: EquipmentSlot, ground: Item[]): boolean {
  const item = character.equipment[slot]
  if (!item) return false
  delete character.equipment[slot]
  ground.push(item)
  return true
}

/**
 * Picks up the item at `index` of `ground` into the first empty backpack
 * space. Returns false if nothing lies there or the backpack is full.
 */
export function pickUp(character: Character, ground: Item[], index: number): boolean {
  const item = ground[index]
  const space = character.backpack.indexOf(null)
  if (!item || space === -1) return false
  ground.splice(index, 1)
  character.backpack[space] = item
  return true
}

/** What differs between two sets of equipment, slot by slot in paperdoll order, for the battle log. */
export function gearChanges(before: Equipment, after: Equipment): GearChange[] {
  const named = (item: Item | undefined) => (item ? { id: item.id, name: item.name } : null)
  return EQUIPMENT_SLOT_ORDER.filter((slot) => before[slot]?.id !== after[slot]?.id).map((slot) => ({
    slot,
    from: named(before[slot]),
    to: named(after[slot]),
  }))
}

/** What a new character is made from: who it is, and what it holds in each hand to begin with. */
export interface Build {
  portrait: PortraitId
  attributes: Attributes
  tagged: SkillId[]
  mainHand: Item
  offHand?: Item
}

/**
 * What a created character holds to begin with: the weapon of its tagged
 * skill. Starting gear is not chosen; the other plain weapons are in its
 * backpack (`createCharacter`), so this is a default and not a limit.
 */
export const STARTING_KIT: Record<SkillId, { mainHand: Item; offHand?: Item }> = {
  melee: { mainHand: IRON_SWORD, offHand: OAK_SHIELD },
  archery: { mainHand: YEW_BOW },
  magic: { mainHand: SPARK_WAND },
}

/** A soldier: strong, hardy and lucky, with a sword and a shield. */
export const WARRIOR_BUILD: Build = {
  portrait: 'knight',
  attributes: { strength: 7, perception: 4, endurance: 7, intelligence: 4, agility: 6, luck: 7 },
  tagged: ['melee'],
  ...STARTING_KIT.melee,
}

/**
 * A level 1 character at full hit points, in a steel breastplate, with every
 * plain weapon it does not hold in its backpack, and the shield too if its
 * hands are full. It has no perks and nothing to spend: creation.ts gives a
 * created character those.
 */
export function createCharacter(name: string, build: Build): Character {
  const spare = [...WEAPONS.filter((weapon) => weapon !== build.mainHand), ...(build.offHand ? [] : [OAK_SHIELD])]
  const character: Character = {
    name,
    portrait: build.portrait,
    level: 1,
    xp: 0,
    attributes: { ...build.attributes },
    tagged: [...build.tagged],
    trained: Object.fromEntries(SKILL_IDS.map((id) => [id, 0])) as Record<SkillId, number>,
    skillPoints: 0,
    perks: {},
    perkPicks: 0,
    hp: 0,
    equipment: { armor: STEEL_ARMOR, mainHand: build.mainHand, ...(build.offHand ? { offHand: build.offHand } : {}) },
    backpack: Array.from({ length: BACKPACK_SIZE }, (_, i) => spare[i] ?? null),
  }
  character.hp = maxHp(character)
  return character
}

export function createWarrior(name = 'Warrior'): Character {
  return createCharacter(name, WARRIOR_BUILD)
}
