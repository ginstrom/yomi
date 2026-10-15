import type { SpellId } from './spells.ts'

export interface DamageRoll {
  count: number
  sides: number
  bonus: number
}

export interface CombatantStats {
  name: string
  maxHp: number
  /** Armour class: the points it takes off an attacker's chance to hit, in percent. */
  ac: number
  /** The chance in percent of hitting a foe of armour class 0, before flanking and the like: a hero's skill with its weapon. */
  toHit: number
  /** The chance in percent that an attack is a critical hit; one that would not hit at all cannot be. */
  critChance: number
  /** The share in percent of a foe's armour class its weapon passes through, none when left out (`effectiveAc`). */
  armorPierce?: number
  damage: DamageRoll
  /** The weapon by name, for the log; left out for a unit that names none. */
  weapon?: string
  /** Action points one attack costs; set by the weapon. */
  attackApCost: number
  /** How many hexes away the unit can strike: 1 for a melee weapon, more for a ranged one. */
  attackRange: number
  /** Action points the unit gets at the start of each of its side's turns. */
  actionPoints: number
  /** What the unit casts with; left out for a unit that knows no spell. */
  magic?: {
    maxMana: number
    /** The chance in percent of a spell striking a foe of armour class 0. */
    skill: number
    /** In SPELL_IDS order. */
    spells: readonly SpellId[]
  }
}

function sameMagic(a: CombatantStats['magic'], b: CombatantStats['magic']): boolean {
  if (!a || !b) return a === b
  return (
    a.maxMana === b.maxMana &&
    a.skill === b.skill &&
    a.spells.length === b.spells.length &&
    a.spells.every((spell, i) => spell === b.spells[i])
  )
}

/** Whether two stat blocks are the same in every respect. */
export function sameCombatStats(a: CombatantStats, b: CombatantStats): boolean {
  return (
    a.name === b.name &&
    a.maxHp === b.maxHp &&
    a.ac === b.ac &&
    a.toHit === b.toHit &&
    a.critChance === b.critChance &&
    (a.armorPierce ?? 0) === (b.armorPierce ?? 0) &&
    a.damage.count === b.damage.count &&
    a.damage.sides === b.damage.sides &&
    a.damage.bonus === b.damage.bonus &&
    a.weapon === b.weapon &&
    a.attackApCost === b.attackApCost &&
    a.attackRange === b.attackRange &&
    a.actionPoints === b.actionPoints &&
    sameMagic(a.magic, b.magic)
  )
}

export interface AttackResult {
  /** 1 to 100; low is good. */
  attackRoll: number
  /** The chance in percent the roll had to come within. */
  chance: number
  hit: boolean
  critical: boolean
  fumble: boolean
  damage: number
}

export type RNG = () => number

export function rollDie(sides: number, rng: RNG = Math.random): number {
  return Math.floor(rng() * sides) + 1
}

export function rollDamage(roll: DamageRoll, rng: RNG = Math.random): number {
  let total = roll.bonus
  for (let i = 0; i < roll.count; i++) {
    total += rollDie(roll.sides, rng)
  }
  return total
}

/** However the numbers fall, an attack has at least this chance in percent of hitting, and at most the other. */
export const MIN_HIT_CHANCE = 5
export const MAX_HIT_CHANCE = 95

/**
 * The armour class that counts against the attacker: the defender's, less the
 * share of it the attacker's weapon pierces, rounded in the defender's favour.
 * A share and not a sum, so that piercing tells most against the heaviest
 * armour and is not merely a chance to hit by another name.
 */
export function effectiveAc(attacker: CombatantStats, defenderAc: number): number {
  const pierce = Math.min(100, Math.max(0, attacker.armorPierce ?? 0))
  return defenderAc - Math.floor((defenderAc * pierce) / 100)
}

/**
 * The chance in percent that an attack hits: the attacker's `toHit`, plus any
 * situational bonus (flanking, say), less the defender's armour class as the
 * attacker's weapon leaves it (`effectiveAc`), kept between `MIN_HIT_CHANCE`
 * and `MAX_HIT_CHANCE`.
 */
export function hitPercent(attacker: CombatantStats, defenderAc: number, situationalBonus = 0): number {
  const ac = effectiveAc(attacker, defenderAc)
  return Math.min(MAX_HIT_CHANCE, Math.max(MIN_HIT_CHANCE, attacker.toHit + situationalBonus - ac))
}

/**
 * Percentile resolution: a roll of 1 to 100 hits when it is no higher than
 * the chance to hit (`hitPercent`), and a hit is critical, doubling the
 * damage dice, when the roll is also within the attacker's `critChance`. A
 * roll above `MAX_HIT_CHANCE` always misses and is a fumble. The roll counts
 * down from the top of `rng`'s range, so a high `rng()` is a lucky one.
 */
export function resolveAttack(
  attacker: CombatantStats,
  defenderAc: number,
  rng: RNG = Math.random,
  situationalBonus = 0,
): AttackResult {
  const attackRoll = 101 - rollDie(100, rng)
  const chance = hitPercent(attacker, defenderAc, situationalBonus)
  const fumble = attackRoll > MAX_HIT_CHANCE
  const hit = attackRoll <= chance
  const critical = hit && attackRoll <= attacker.critChance
  const damageRoll = critical ? { ...attacker.damage, count: attacker.damage.count * 2 } : attacker.damage
  const damage = hit ? rollDamage(damageRoll, rng) : 0

  return { attackRoll, chance, hit, critical, fumble, damage }
}

/** Probability that resolveAttack hits, from 0.05 to 0.95. */
export function hitChance(attacker: CombatantStats, defenderAc: number, situationalBonus = 0): number {
  return hitPercent(attacker, defenderAc, situationalBonus) / 100
}

/** "1d8+2" notation. */
export function formatDamage(roll: DamageRoll): string {
  const bonus = roll.bonus > 0 ? `+${roll.bonus}` : roll.bonus < 0 ? `${roll.bonus}` : ''
  return `${roll.count}d${roll.sides}${bonus}`
}

export const GOBLIN_STATS: CombatantStats = {
  name: 'Goblin',
  maxHp: 12,
  ac: 15,
  toHit: 70,
  critChance: 5,
  damage: { count: 1, sides: 6, bonus: 1 },
  attackApCost: 5,
  attackRange: 1,
  actionPoints: 8,
}

/** A fragile skirmisher: harder to hit than a Goblin, but light on hit points and damage. */
export const KOBOLD_STATS: CombatantStats = {
  name: 'Kobold',
  maxHp: 7,
  ac: 20,
  toHit: 65,
  critChance: 5,
  damage: { count: 1, sides: 4, bonus: 1 },
  attackApCost: 5,
  attackRange: 1,
  actionPoints: 8,
}

/** What each level above the first adds to a monster: this share of its level 1 hit points... */
export const FOE_HP_PER_LEVEL = 0.6
/** ...this many points to its chance to hit and to its armour class... */
export const FOE_TO_HIT_PER_LEVEL = 5
export const FOE_AC_PER_LEVEL = 5
/** ...and 1 to its damage every this many levels. */
export const FOE_DAMAGE_LEVEL_STEP = 2

/**
 * A monster's stat block at `level`, from its level 1 block. A monster grows
 * about as fast as a hero who puts every skill point into one weapon, until
 * the hero's points come dearer from 80% (skills.ts), and faster than one
 * who does not, and its armour grows where a hero's does not
 * (character.ts, progression.ts): the lands further out are meant to be
 * harder for the party that has earned its way there, not merely to keep
 * pace with it.
 */
export function foeAtLevel(base: CombatantStats, level: number): CombatantStats {
  const above = Math.max(0, level - 1)
  return {
    ...base,
    maxHp: Math.round(base.maxHp * (1 + FOE_HP_PER_LEVEL * above)),
    ac: base.ac + FOE_AC_PER_LEVEL * above,
    toHit: base.toHit + FOE_TO_HIT_PER_LEVEL * above,
    damage: { ...base.damage, bonus: base.damage.bonus + Math.floor(above / FOE_DAMAGE_LEVEL_STEP) },
  }
}
