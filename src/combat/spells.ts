import type { DamageRoll } from './combat.ts'

/**
 * Spells, as the engine casts them. A spell says what it costs, what it can
 * be aimed at and what it does; which perk teaches it and what that perk asks
 * is the perk's business (character/perks.ts), so this layer knows nothing of
 * characters.
 */

/** The three schools of magic, in the order the spell tree draws them. */
export const SCHOOL_IDS = ['offence', 'healing', 'support'] as const

export type SchoolId = (typeof SCHOOL_IDS)[number]

export const SCHOOLS: Record<SchoolId, { name: string; colour: number }> = {
  offence: { name: 'Offensive', colour: 0xd0503c },
  healing: { name: 'Healing', colour: 0x58b858 },
  support: { name: 'Support', colour: 0x5a8ee0 },
}

export const SPELL_IDS = [
  'magic_arrow',
  'flame_arrow',
  'sleep',
  'frost_blast',
  'fireball',
  'acid_arrow',
  'death_cloud',
  'heal',
  'greater_heal',
  'heal_all',
  'greater_heal_all',
  'shield',
  'protect',
  'bless',
  'mirror_image',
  'haste',
  'bane',
] as const

export type SpellId = (typeof SPELL_IDS)[number]

/**
 * What a spell is aimed at: a unit of the other side, a unit of the caster's
 * own (the caster included), the caster alone, or a hex at the centre of an
 * area. An area of range 0 is centred on the caster's own hex.
 */
export type SpellTarget = 'foe' | 'ally' | 'self' | 'area'

export const STATUS_IDS = [
  'asleep',
  'chilled',
  'corroded',
  'poisoned',
  'shielded',
  'protected',
  'blessed',
  'baned',
  'hasted',
  'mirrored',
] as const

export type StatusId = (typeof STATUS_IDS)[number]

/** A lasting effect a spell lays, for `turns` of the affected unit's turns. */
export interface StatusLaid {
  id: StatusId
  turns: number
  /** For Mirrored: how many images. */
  images?: number
}

export interface Spell {
  name: string
  school: SchoolId
  /** What it does, for the spell list and the spell tree. */
  description: string
  manaCost: number
  apCost: number
  /** Hexes from the caster to the target or the area's centre; 0 for a spell centred on the caster. */
  range: number
  target: SpellTarget
  /** For an area: how many hexes from its centre it reaches. */
  radius?: number
  /**
   * A hostile spell rolls to hit each unit it touches, and an area of it
   * touches everyone, the caster's side included. A friendly one never misses
   * and touches only the caster's side.
   */
  hostile: boolean
  damage?: DamageRoll
  heal?: DamageRoll
  status?: StatusLaid
}

const dice = (count: number, sides: number, bonus = 0): DamageRoll => ({ count, sides, bonus })

export const SPELLS: Record<SpellId, Spell> = {
  magic_arrow: {
    name: 'Magic Arrow',
    school: 'offence',
    description: '1d10 to a foe within 5 hexes',
    manaCost: 3,
    apCost: 4,
    range: 5,
    target: 'foe',
    hostile: true,
    damage: dice(1, 10),
  },
  flame_arrow: {
    name: 'Flame Arrow',
    school: 'offence',
    description: '2d8 to a foe within 5 hexes',
    manaCost: 5,
    apCost: 4,
    range: 5,
    target: 'foe',
    hostile: true,
    damage: dice(2, 8),
  },
  sleep: {
    name: 'Sleep',
    school: 'offence',
    description: 'A foe within 5 hexes sleeps for 2 turns, helpless, until it is hurt',
    manaCost: 5,
    apCost: 4,
    range: 5,
    target: 'foe',
    hostile: true,
    status: { id: 'asleep', turns: 2 },
  },
  frost_blast: {
    name: 'Frost Blast',
    school: 'offence',
    description: '1d8 and -3 AP for a turn to everyone within 1 hex of a point within 4 hexes',
    manaCost: 6,
    apCost: 5,
    range: 4,
    target: 'area',
    radius: 1,
    hostile: true,
    damage: dice(1, 8),
    status: { id: 'chilled', turns: 1 },
  },
  fireball: {
    name: 'Fireball',
    school: 'offence',
    description: '3d6 to everyone within 1 hex of a point within 6 hexes',
    manaCost: 10,
    apCost: 6,
    range: 6,
    target: 'area',
    radius: 1,
    hostile: true,
    damage: dice(3, 6),
  },
  acid_arrow: {
    name: 'Acid Arrow',
    school: 'offence',
    description: '1d8 to a foe within 5 hexes, and -5 AC and 1d4 a turn for 3 turns',
    manaCost: 7,
    apCost: 4,
    range: 5,
    target: 'foe',
    hostile: true,
    damage: dice(1, 8),
    status: { id: 'corroded', turns: 3 },
  },
  death_cloud: {
    name: 'Death Cloud',
    school: 'offence',
    description: 'Poisons everyone within 1 hex of a point within 5 hexes: 1d6 a turn for 3 turns',
    manaCost: 10,
    apCost: 6,
    range: 5,
    target: 'area',
    radius: 1,
    hostile: true,
    status: { id: 'poisoned', turns: 3 },
  },
  heal: {
    name: 'Heal',
    school: 'healing',
    description: 'Restores 1d8+2 hit points to an ally within 4 hexes',
    manaCost: 3,
    apCost: 4,
    range: 4,
    target: 'ally',
    hostile: false,
    heal: dice(1, 8, 2),
  },
  greater_heal: {
    name: 'Greater Heal',
    school: 'healing',
    description: 'Restores 2d8+4 hit points to an ally within 4 hexes',
    manaCost: 6,
    apCost: 4,
    range: 4,
    target: 'ally',
    hostile: false,
    heal: dice(2, 8, 4),
  },
  heal_all: {
    name: 'Heal All',
    school: 'healing',
    description: 'Restores 1d8 hit points to each ally within 2 hexes of the caster',
    manaCost: 8,
    apCost: 5,
    range: 0,
    target: 'area',
    radius: 2,
    hostile: false,
    heal: dice(1, 8),
  },
  greater_heal_all: {
    name: 'Greater Heal All',
    school: 'healing',
    description: 'Restores 2d8+2 hit points to each ally within 2 hexes of the caster',
    manaCost: 14,
    apCost: 6,
    range: 0,
    target: 'area',
    radius: 2,
    hostile: false,
    heal: dice(2, 8, 2),
  },
  shield: {
    name: 'Shield',
    school: 'support',
    description: '+15 AC to the caster for 3 turns',
    manaCost: 3,
    apCost: 2,
    range: 0,
    target: 'self',
    hostile: false,
    status: { id: 'shielded', turns: 3 },
  },
  protect: {
    name: 'Protect',
    school: 'support',
    description: '+10 AC to an ally within 4 hexes for 3 turns',
    manaCost: 3,
    apCost: 3,
    range: 4,
    target: 'ally',
    hostile: false,
    status: { id: 'protected', turns: 3 },
  },
  bless: {
    name: 'Bless',
    school: 'support',
    description: '+10 to hit for each ally within 2 hexes of the caster, for 3 turns',
    manaCost: 4,
    apCost: 4,
    range: 0,
    target: 'area',
    radius: 2,
    hostile: false,
    status: { id: 'blessed', turns: 3 },
  },
  mirror_image: {
    name: 'Mirror Image',
    school: 'support',
    description: '3 images of the caster take the next 3 hits on it, for 3 turns',
    manaCost: 6,
    apCost: 3,
    range: 0,
    target: 'self',
    hostile: false,
    status: { id: 'mirrored', turns: 3, images: 3 },
  },
  haste: {
    name: 'Haste',
    school: 'support',
    description: '+3 AP to an ally within 4 hexes for 2 turns',
    manaCost: 7,
    apCost: 4,
    range: 4,
    target: 'ally',
    hostile: false,
    status: { id: 'hasted', turns: 2 },
  },
  bane: {
    name: 'Bane',
    school: 'support',
    description: '-15 to hit for everyone within 1 hex of a point within 5 hexes, for 3 turns',
    manaCost: 5,
    apCost: 4,
    range: 5,
    target: 'area',
    radius: 1,
    hostile: true,
    status: { id: 'baned', turns: 3 },
  },
}

/** What a status does while it lasts. */
export interface StatusRule {
  name: string
  /** As the log says it: "is blessed", "is no longer blessed". */
  adjective: string
  /** One letter for the nameplate, and its colour. */
  mark: string
  colour: number
  /** Added to its armour class; armour never goes below 0 by a status. */
  armorClass?: number
  /** Added to its chance to hit, weapon and spell alike. */
  toHit?: number
  /** Added to its AP at the start of its turns (and at once if laid on its own turn); never below 0. */
  actionPoints?: number
  /** Dealt at the start of its turns, and what the log says it is from. */
  tick?: DamageRoll
  tickName?: string
  /** No AP, no zone of control, `HELPLESS_BONUS` to attacks on it, ended by damage. */
  sleep?: true
  /** Each hit on it strikes an image instead, while images are left. */
  images?: true
}

export const STATUSES: Record<StatusId, StatusRule> = {
  asleep: { name: 'Asleep', adjective: 'asleep', mark: 'Z', colour: 0xb0a0ff, sleep: true },
  chilled: { name: 'Chilled', adjective: 'chilled', mark: 'C', colour: 0x8fd8ff, actionPoints: -3 },
  corroded: { name: 'Corroded', adjective: 'corroded', mark: 'A', colour: 0xb8d040, armorClass: -5, tick: dice(1, 4), tickName: 'acid' },
  poisoned: { name: 'Poisoned', adjective: 'poisoned', mark: 'P', colour: 0x60c040, tick: dice(1, 6), tickName: 'poison' },
  shielded: { name: 'Shielded', adjective: 'shielded', mark: 'S', colour: 0x80b0ff, armorClass: 15 },
  protected: { name: 'Protected', adjective: 'protected', mark: 'D', colour: 0x6090e0, armorClass: 10 },
  blessed: { name: 'Blessed', adjective: 'blessed', mark: 'B', colour: 0xffe070, toHit: 10 },
  baned: { name: 'Baned', adjective: 'baned', mark: 'X', colour: 0xc060c0, toHit: -15 },
  hasted: { name: 'Hasted', adjective: 'hasted', mark: 'H', colour: 0xffa040, actionPoints: 3 },
  mirrored: { name: 'Mirrored', adjective: 'mirrored', mark: 'M', colour: 0xe0e0ff, images: true },
}

/** What an attack on a sleeping unit adds to its chance to hit, in percent. */
export const HELPLESS_BONUS = 20

/** A status in force on a unit. */
export interface ActiveStatus {
  id: StatusId
  /** Of the unit's own turns, this one included if it is under way. */
  turnsLeft: number
  /** For Mirrored: images left. */
  images?: number
}

/** The average of a roll, rounded down: what a heal restores out of battle. */
export function averageRoll(roll: DamageRoll): number {
  return Math.floor((roll.count * (roll.sides + 1)) / 2 + roll.bonus)
}

/** Whether `spell` restores hit points. */
export function isHealing(spell: SpellId): boolean {
  return SPELLS[spell].heal !== undefined
}
