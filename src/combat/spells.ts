import type { AreaShape } from '../grid/hex.ts'
import type { CombatantStats, DamageRoll, Element } from './combat.ts'

/**
 * Spells, as the engine casts them. A spell says what it costs, what it can
 * be aimed at and what it does; which perk teaches it and what that perk asks
 * is the perk's business (character/perks.ts), so this layer knows nothing of
 * characters.
 */

/** The three schools of magic, a spell's family. */
export const SCHOOL_IDS = ['offence', 'healing', 'support'] as const

export type SchoolId = (typeof SCHOOL_IDS)[number]

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
  'frostbite',
  'meteor',
  'mass_haste',
  'lay_on_hands',
  'ward',
  'web',
  'curse',
  'ice_lance',
  'glacial_prison',
  'purify',
  'revive',
  'renew',
  'holy_light',
] as const

/** The heroes' spells: the skill trees' nodes and casting on the world map read these (Web and Curse, monsters' too, are among them). */
export type HeroSpellId = (typeof SPELL_IDS)[number]

/** Spells only monsters cast: no perk teaches them, so no hero can learn one. */
export const MONSTER_SPELL_IDS = ['lightning_bolt', 'drain_life', 'dark_shield'] as const

export type MonsterSpellId = (typeof MONSTER_SPELL_IDS)[number]

export type SpellId = HeroSpellId | MonsterSpellId

/** Every spell, the heroes' first: the order a stat block's `magic.spells` keeps. */
export const ALL_SPELL_IDS: readonly SpellId[] = [...SPELL_IDS, ...MONSTER_SPELL_IDS]

/**
 * What a spell is aimed at: a unit of the other side, a unit of the caster's
 * own (the caster included), the caster alone, a hex at the centre of an
 * area, or an ally that fell this battle, at 0 hit points on a hex no
 * standing unit holds (Revive). An area of range 0 is centred on the
 * caster's own hex.
 */
export type SpellTarget = 'foe' | 'ally' | 'self' | 'area' | 'fallen'

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
  'seared',
  'cursed',
  'webbed',
  'warded',
  'marked',
  'slowed',
  'pinned',
  'taunted',
  'rooted',
  'renewing',
  'frozen',
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
  /** What it does, for the Abilities tab, the Skills list and the skill trees' strip. */
  description: string
  manaCost: number
  apCost: number
  /** Hexes from the caster to the target or the area's centre; 0 for a spell centred on the caster. */
  range: number
  target: SpellTarget
  /** For an area: how many hexes from its centre it reaches. */
  radius?: number
  /** For an area: its shape; a burst when left out. A cone or line is aimed 1 to `range` hexes from the caster and reaches `range`. */
  shape?: AreaShape
  /**
   * A hostile spell rolls to hit each unit it touches, and an area of it
   * touches everyone, the caster's side included. A friendly one never misses
   * and touches only the caster's side.
   */
  hostile: boolean
  damage?: DamageRoll
  /** What its damage is, for a ward against it; none when left out. */
  element?: Element
  /** The share of the damage it deals, to all it touches, that heals the caster. */
  drain?: number
  heal?: DamageRoll
  status?: StatusLaid
  /** Its damage dice count doubles against a unit `baneApplies` to (Holy Light). */
  bane?: true
  /** More dice on a hit, rolled after its own and doubled with them on a critical, against a unit with one of `statuses` before the roll (Ice Lance). */
  bonusVs?: { statuses: readonly StatusId[]; damage: DamageRoll }
  /** It ends every `hostile` status on its target before it heals (Purify). */
  cleanse?: true
  /** A caster may cast it once a battle (Revive). */
  oncePerBattle?: true
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
    description: '2d8 to a foe within 5 hexes, and no regeneration next turn',
    manaCost: 5,
    apCost: 4,
    range: 5,
    target: 'foe',
    hostile: true,
    damage: dice(2, 8),
    element: 'fire',
    status: { id: 'seared', turns: 1 },
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
    element: 'frost',
    status: { id: 'chilled', turns: 1 },
  },
  fireball: {
    name: 'Fireball',
    school: 'offence',
    description: '3d6 to everyone within 1 hex of a point within 6 hexes, and no regeneration next turn',
    manaCost: 10,
    apCost: 6,
    range: 6,
    target: 'area',
    radius: 1,
    hostile: true,
    damage: dice(3, 6),
    element: 'fire',
    status: { id: 'seared', turns: 1 },
  },
  acid_arrow: {
    name: 'Acid Arrow',
    school: 'offence',
    description: '1d8 to a foe within 5 hexes, and -5 AC, -2 resistance, 1d4 a turn and no regeneration for 3 turns',
    manaCost: 7,
    apCost: 4,
    range: 5,
    target: 'foe',
    hostile: true,
    damage: dice(1, 8),
    element: 'acid',
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
    element: 'poison',
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
  frostbite: {
    name: 'Frostbite',
    school: 'offence',
    description: '1d6+1 frost to a foe within 5 hexes, chilled for 1 turn',
    manaCost: 3,
    apCost: 4,
    range: 5,
    target: 'foe',
    hostile: true,
    damage: dice(1, 6, 1),
    element: 'frost',
    status: { id: 'chilled', turns: 1 },
  },
  meteor: {
    name: 'Meteor',
    school: 'offence',
    description: '4d8 to everyone within 2 hexes of a point within 6 hexes, and no regeneration next turn',
    manaCost: 16,
    apCost: 7,
    range: 6,
    target: 'area',
    radius: 2,
    hostile: true,
    damage: dice(4, 8),
    element: 'fire',
    status: { id: 'seared', turns: 1 },
  },
  mass_haste: {
    name: 'Mass Haste',
    school: 'support',
    description: '+3 AP for 2 turns to each ally within 2 hexes of the caster',
    manaCost: 12,
    apCost: 5,
    range: 0,
    target: 'area',
    radius: 2,
    hostile: false,
    status: { id: 'hasted', turns: 2 },
  },
  lay_on_hands: {
    name: 'Lay on Hands',
    school: 'healing',
    description: 'Restores 2d6+2 hit points to an ally within 1 hex',
    manaCost: 4,
    apCost: 3,
    range: 1,
    target: 'ally',
    hostile: false,
    heal: dice(2, 6, 2),
  },
  ward: {
    name: 'Ward',
    school: 'support',
    description: '+4 ward against every element to an ally within 4 hexes for 3 turns',
    manaCost: 4,
    apCost: 3,
    range: 4,
    target: 'ally',
    hostile: false,
    status: { id: 'warded', turns: 3 },
  },
  ice_lance: {
    name: 'Ice Lance',
    school: 'offence',
    description: '2d8 frost to a foe within 6 hexes, 2d8 more if it is chilled, slowed, webbed, asleep or frozen',
    manaCost: 7,
    apCost: 4,
    range: 6,
    target: 'foe',
    hostile: true,
    damage: dice(2, 8),
    element: 'frost',
    bonusVs: { statuses: ['chilled', 'slowed', 'webbed', 'asleep', 'frozen'], damage: dice(2, 8) },
  },
  glacial_prison: {
    name: 'Glacial Prison',
    school: 'offence',
    description: 'A foe within 5 hexes is frozen for 2 turns, helpless, even when hurt',
    manaCost: 12,
    apCost: 5,
    range: 5,
    target: 'foe',
    hostile: true,
    status: { id: 'frozen', turns: 2 },
  },
  purify: {
    name: 'Purify',
    school: 'healing',
    description: 'Ends every hostile status on an ally within 4 hexes and restores 1d6 hit points',
    manaCost: 4,
    apCost: 3,
    range: 4,
    target: 'ally',
    hostile: false,
    heal: dice(1, 6),
    cleanse: true,
  },
  revive: {
    name: 'Revive',
    school: 'healing',
    description: 'An ally within 2 hexes that fell this battle, on a free hex, stands again at a quarter of its hit points; once a battle',
    manaCost: 20,
    apCost: 6,
    range: 2,
    target: 'fallen',
    hostile: false,
    oncePerBattle: true,
  },
  renew: {
    name: 'Renew',
    school: 'support',
    description: 'Each ally within 2 hexes of the caster regains 3 hit points as its turn begins, for 3 turns',
    manaCost: 10,
    apCost: 5,
    range: 0,
    target: 'area',
    radius: 2,
    hostile: false,
    status: { id: 'renewing', turns: 3 },
  },
  holy_light: {
    name: 'Holy Light',
    school: 'offence',
    description: '3d6 to a foe within 5 hexes, double the dice against the regenerating and the blightborn',
    manaCost: 7,
    apCost: 4,
    range: 5,
    target: 'foe',
    hostile: true,
    damage: dice(3, 6),
    bane: true,
  },
  lightning_bolt: {
    name: 'Lightning Bolt',
    school: 'offence',
    description: '4d6 to everyone in a line 6 hexes long from the caster',
    manaCost: 8,
    apCost: 5,
    range: 6,
    target: 'area',
    shape: 'line',
    hostile: true,
    damage: dice(4, 6),
    element: 'lightning',
  },
  drain_life: {
    name: 'Drain Life',
    school: 'offence',
    description: '3d6 to a foe within 5 hexes, half of it healing the caster',
    manaCost: 6,
    apCost: 4,
    range: 5,
    target: 'foe',
    hostile: true,
    damage: dice(3, 6),
    drain: 0.5,
  },
  curse: {
    name: 'Curse',
    school: 'offence',
    description: '-15 to hit and -5 AC to a foe within 5 hexes, for 3 turns',
    manaCost: 5,
    apCost: 4,
    range: 5,
    target: 'foe',
    hostile: true,
    status: { id: 'cursed', turns: 3 },
  },
  web: {
    name: 'Web',
    school: 'offence',
    description: '-4 AP for 2 turns to everyone within 1 hex of a point within 4 hexes',
    manaCost: 5,
    apCost: 4,
    range: 4,
    target: 'area',
    radius: 1,
    shape: 'burst',
    hostile: true,
    status: { id: 'webbed', turns: 2 },
  },
  dark_shield: {
    name: 'Dark Shield',
    school: 'support',
    description: '+15 AC to the caster for 3 turns',
    manaCost: 4,
    apCost: 2,
    range: 0,
    target: 'self',
    hostile: false,
    status: { id: 'shielded', turns: 3 },
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
  /** Added to its resistance, which never goes below 0 by a status. */
  resistance?: number
  /** It regains no hit points by regeneration while this lasts. */
  stopsRegeneration?: true
  /** Added to its chance to hit, weapon and spell alike. */
  toHit?: number
  /** Added to its AP at the start of its turns (and at once if laid on its own turn); never below 0. */
  actionPoints?: number
  /** Dealt at the start of its turns, and what the log says it is from. */
  tick?: DamageRoll
  tickName?: string
  /** What its tick's damage is, for a ward against it; none when left out. */
  element?: Element
  /** No AP, no zone of control, `HELPLESS_BONUS` to attacks on it (Asleep, Frozen). */
  helpless?: true
  /** Damage that leaves it standing ends it (Asleep). */
  wakesOnDamage?: true
  /** Laid by a foe to its harm: what Purify ends. */
  hostile?: true
  /** Each hit on it strikes an image instead, while images are left. */
  images?: true
  /** Added to its ward against every element. */
  wardAll?: number
  /** It cannot move (Pinned); it still attacks, casts, uses abilities and makes free attacks. */
  immobile?: true
  /** Hit points it regains as its side's turn begins, after regeneration, unless a status that `stopsRegeneration` is on it (a `restore` event). */
  regen?: number
}

export const STATUSES: Record<StatusId, StatusRule> = {
  asleep: { name: 'Asleep', adjective: 'asleep', mark: 'Z', colour: 0xb0a0ff, helpless: true, wakesOnDamage: true, hostile: true },
  chilled: { name: 'Chilled', adjective: 'chilled', mark: 'C', colour: 0x8fd8ff, actionPoints: -3, hostile: true },
  corroded: { name: 'Corroded', adjective: 'corroded', mark: 'A', colour: 0xb8d040, armorClass: -5, resistance: -2, tick: dice(1, 4), tickName: 'acid', element: 'acid', stopsRegeneration: true, hostile: true },
  poisoned: { name: 'Poisoned', adjective: 'poisoned', mark: 'P', colour: 0x60c040, tick: dice(1, 6), tickName: 'poison', element: 'poison', hostile: true },
  shielded: { name: 'Shielded', adjective: 'shielded', mark: 'S', colour: 0x80b0ff, armorClass: 15 },
  protected: { name: 'Protected', adjective: 'protected', mark: 'D', colour: 0x6090e0, armorClass: 10 },
  blessed: { name: 'Blessed', adjective: 'blessed', mark: 'B', colour: 0xffe070, toHit: 10 },
  baned: { name: 'Baned', adjective: 'baned', mark: 'X', colour: 0xc060c0, toHit: -15, hostile: true },
  hasted: { name: 'Hasted', adjective: 'hasted', mark: 'H', colour: 0xffa040, actionPoints: 3 },
  mirrored: { name: 'Mirrored', adjective: 'mirrored', mark: 'M', colour: 0xe0e0ff, images: true },
  seared: { name: 'Seared', adjective: 'seared', mark: 'F', colour: 0xff7030, stopsRegeneration: true, hostile: true },
  cursed: { name: 'Cursed', adjective: 'cursed', mark: 'K', colour: 0x8a3cb8, toHit: -15, armorClass: -5, hostile: true },
  webbed: { name: 'Webbed', adjective: 'webbed', mark: 'W', colour: 0xc8c8c0, actionPoints: -4, hostile: true },
  warded: { name: 'Warded', adjective: 'warded', mark: 'G', colour: 0xa890e8, wardAll: 4 },
  marked: { name: 'Marked', adjective: 'marked', mark: 'Y', colour: 0xe8c040, armorClass: -10, hostile: true },
  slowed: { name: 'Slowed', adjective: 'slowed', mark: 'L', colour: 0x7a9ab0, actionPoints: -3, hostile: true },
  pinned: { name: 'Pinned', adjective: 'pinned', mark: 'N', colour: 0xb08050, immobile: true, hostile: true },
  // −`TAUNT_PENALTY` to hit at any unit but its `source`: the engine applies it, as it depends on the target.
  taunted: { name: 'Taunted', adjective: 'taunted', mark: 'T', colour: 0xe04848, hostile: true },
  // Laid by the engine on a unit with the trait `rooted` that ends its side's turn unmoved; its first step ends it.
  rooted: { name: 'Rooted', adjective: 'rooted', mark: 'R', colour: 0x4fb09a, armorClass: 10, resistance: 2 },
  // Laid by Renew; healed by the engine as its side's turn begins.
  renewing: { name: 'Renewing', adjective: 'renewing', mark: 'U', colour: 0x5ad06a, regen: 3 },
  // Laid by Glacial Prison: helpless as Asleep, but damage does not end it.
  frozen: { name: 'Frozen', adjective: 'frozen', mark: 'I', colour: 0x9ee8ff, helpless: true, hostile: true },
}

/** What an attack on a helpless unit (Asleep, Frozen) adds to its chance to hit, in percent. */
export const HELPLESS_BONUS = 20

/** A status in force on a unit. */
export interface ActiveStatus {
  id: StatusId
  /** Of the unit's own turns, this one included if it is under way. */
  turnsLeft: number
  /** For Mirrored: images left. */
  images?: number
  /** For Taunted: the unit that laid it (a `UnitId`), the one it may strike at no penalty. No other status carries one. */
  source?: string
}

/** The average of a roll, rounded down: what a heal restores out of battle. */
export function averageRoll(roll: DamageRoll): number {
  return Math.floor((roll.count * (roll.sides + 1)) / 2 + roll.bonus)
}

/**
 * Whether `spell` is a heal: it restores hit points and is no cleanse. Purify
 * restores 1d6 too, but it is cast for what it ends, so the world map, the
 * party's camping (`autoHeal`) and the policy's heal choices and reserve
 * leave it out (the policy has a step of its own for it).
 */
export function isHealing(spell: SpellId): boolean {
  const { heal, cleanse } = SPELLS[spell]
  return heal !== undefined && cleanse !== true
}

/**
 * The action points `spell` costs a caster of `stats`: its own, less the
 * caster's discount on every spell and, for a spell that heals, on healing
 * spells; never below 2, and a spell of 2 or less keeps its cost.
 */
export function spellApCost(stats: Pick<CombatantStats, 'magic'>, spell: SpellId): number {
  const { apCost, heal } = SPELLS[spell]
  const discount = stats.magic?.apDiscount
  const off = (discount?.all ?? 0) + (heal ? (discount?.heal ?? 0) : 0)
  return Math.max(Math.min(apCost, 2), apCost - off)
}

/**
 * The power a caster of `stats` adds to each damaging outcome of `spell`:
 * its `all`, and its `fire` or `frost` for a spell of that element.
 */
export function spellPower(stats: Pick<CombatantStats, 'magic'>, spell: SpellId): number {
  const power = stats.magic?.power
  const { element } = SPELLS[spell]
  return (power?.all ?? 0) + (element === 'fire' ? (power?.fire ?? 0) : element === 'frost' ? (power?.frost ?? 0) : 0)
}

/**
 * How far `spell` reaches for a caster of `stats`: its own range, plus the
 * caster's friendly range for a friendly spell aimed at an ally (a fallen
 * one included) or at an area of range above 0. A spell on the caster alone
 * or centred on it keeps 0.
 */
export function spellRange(stats: Pick<CombatantStats, 'magic'>, spell: SpellId): number {
  const { range, hostile, target } = SPELLS[spell]
  const reaches = !hostile && (target === 'ally' || target === 'fallen' || (target === 'area' && range > 0))
  return range + (reaches ? (stats.magic?.friendlyRange ?? 0) : 0)
}

/**
 * Whether `status` is never laid on a unit of `stats`: the unit is `immune`
 * and the status's rule has a `tick`. The engine reads it wherever a status
 * is laid and the policy wherever it values laying one, so they agree.
 */
export function refusesStatus(stats: Pick<CombatantStats, 'immune'>, status: StatusId): boolean {
  return stats.immune === true && STATUSES[status].tick !== undefined
}
