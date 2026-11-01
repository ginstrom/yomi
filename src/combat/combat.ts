import type { AbilityId } from './abilities.ts'
import type { SpellId } from './spells.ts'

/** The kinds of damage a ward can stand against; damage of none is a weapon's or Magic Arrow's. */
export const ELEMENTS = ['fire', 'frost', 'lightning', 'acid', 'poison', 'blight'] as const

export type Element = (typeof ELEMENTS)[number]

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
  /** Points of a foe's resistance its weapon passes through, none when left out (`effectiveResistance`). */
  armorPierce?: number
  /** Points taken off the damage of every weapon hit it takes, what it wears and its own hide together; none when left out (`damageThrough`). */
  resistance?: number
  /** Points taken off each instance of damage of an element; none when left out (`warded`). */
  wards?: Partial<Record<Element, number>>
  /** Hit points it regains as its side's turn begins, unless a status stops it (`StatusRule.stopsRegeneration`); none when left out. */
  regeneration?: number
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
    /** In `ALL_SPELL_IDS` order. */
    spells: readonly SpellId[]
  }
  /** What the unit can do besides its weapon and spells (abilities.ts), in ABILITY_IDS order; none when left out. */
  abilities?: readonly AbilityId[]
  /** Added to the damage bonus of every strike and area of its abilities (foeAtLevel's damage step); 0 when left out. */
  abilityDamageBonus?: number
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

function sameAbilities(a: CombatantStats['abilities'], b: CombatantStats['abilities']): boolean {
  const left = a ?? []
  const right = b ?? []
  return left.length === right.length && left.every((ability, i) => ability === right[i])
}

function sameWards(a: CombatantStats['wards'], b: CombatantStats['wards']): boolean {
  return ELEMENTS.every((element) => (a?.[element] ?? 0) === (b?.[element] ?? 0))
}

/** Damage of `element` after `stats`' ward against it: max(0, damage − ward); damage of no element is unchanged. */
export function warded(damage: number, element: Element | undefined, stats: CombatantStats): number {
  const ward = element ? (stats.wards?.[element] ?? 0) : 0
  return ward > 0 ? Math.max(0, damage - ward) : damage
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
    (a.resistance ?? 0) === (b.resistance ?? 0) &&
    (a.regeneration ?? 0) === (b.regeneration ?? 0) &&
    sameWards(a.wards, b.wards) &&
    a.damage.count === b.damage.count &&
    a.damage.sides === b.damage.sides &&
    a.damage.bonus === b.damage.bonus &&
    a.weapon === b.weapon &&
    a.attackApCost === b.attackApCost &&
    a.attackRange === b.attackRange &&
    a.actionPoints === b.actionPoints &&
    sameMagic(a.magic, b.magic) &&
    sameAbilities(a.abilities, b.abilities) &&
    (a.abilityDamageBonus ?? 0) === (b.abilityDamageBonus ?? 0)
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
 * The chance in percent that an attack hits: the attacker's `toHit`, plus any
 * situational bonus (flanking, say), less the defender's armour class, kept
 * between `MIN_HIT_CHANCE` and `MAX_HIT_CHANCE`. Armour class is what turns a
 * blow aside; what the blow then does against armour is resistance's
 * business (`damageThrough`), and no weapon pierces armour class.
 */
export function hitPercent(attacker: CombatantStats, defenderAc: number, situationalBonus = 0): number {
  return Math.min(MAX_HIT_CHANCE, Math.max(MIN_HIT_CHANCE, attacker.toHit + situationalBonus - defenderAc))
}

/** A weapon hit that does any harm does at least this much, however heavy the armour. */
export const MIN_HIT_DAMAGE = 1

/**
 * The defender's resistance that counts against the attacker: what is left of
 * it once the attacker's weapon has pierced its points, never below 0.
 */
export function effectiveResistance(attacker: CombatantStats, defenderResistance: number): number {
  return Math.max(0, defenderResistance - Math.max(0, attacker.armorPierce ?? 0))
}

/**
 * What a weapon hit that rolled `rolled` does through `resistance` (already
 * pierced): the roll less the resistance, but at least `MIN_HIT_DAMAGE`
 * unless the roll itself came to nothing. A flat cut and not a share, so that
 * armour tells most against the weapons that hit often and lightly, and the
 * heavy ones, which also pierce more, are its answer.
 */
export function damageThrough(rolled: number, resistance: number): number {
  return rolled <= 0 ? 0 : Math.max(MIN_HIT_DAMAGE, rolled - Math.max(0, resistance))
}

/**
 * Percentile resolution: a roll of 1 to 100 hits when it is no higher than
 * the chance to hit (`hitPercent`), and a hit is critical, doubling the
 * damage dice, when the roll is also within the attacker's `critChance`. A
 * hit's damage comes through the defender's resistance (`damageThrough`). A
 * roll above `MAX_HIT_CHANCE` always misses and is a fumble. The roll counts
 * down from the top of `rng`'s range, so a high `rng()` is a lucky one.
 */
export function resolveAttack(
  attacker: CombatantStats,
  defenderAc: number,
  rng: RNG = Math.random,
  situationalBonus = 0,
  defenderResistance = 0,
): AttackResult {
  const roll = rollToHit(attacker, defenderAc, rng, situationalBonus)
  if (!roll.hit) return { ...roll, damage: 0 }
  const rolled = rollHitDamage(attacker.damage, roll.critical, rng)
  return { ...roll, damage: damageThrough(rolled, effectiveResistance(attacker, defenderResistance)) }
}

/**
 * The first half of `resolveAttack`: the roll to hit, without the damage. The
 * engine rolls the two apart where a hit may do no harm (it strikes a mirror
 * image), so that no dice are drawn for it.
 */
export function rollToHit(
  attacker: CombatantStats,
  defenderAc: number,
  rng: RNG = Math.random,
  situationalBonus = 0,
): Omit<AttackResult, 'damage'> {
  const attackRoll = 101 - rollDie(100, rng)
  const chance = hitPercent(attacker, defenderAc, situationalBonus)
  const fumble = attackRoll > MAX_HIT_CHANCE
  const hit = attackRoll <= chance
  const critical = hit && attackRoll <= attacker.critChance
  return { attackRoll, chance, hit, critical, fumble }
}

/** The second half of `resolveAttack`: the damage of a hit, a critical doubling the dice; never below 0, as a modifier may lower a weapon's bonus. */
export function rollHitDamage(dice: DamageRoll, critical: boolean, rng: RNG = Math.random): number {
  return Math.max(0, rollDamage(critical ? { ...dice, count: dice.count * 2 } : dice, rng))
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

/** A goblin in a leather jerkin, which turns a little of a blow. */
export const GOBLIN_STATS: CombatantStats = {
  name: 'Goblin',
  maxHp: 12,
  ac: 15,
  resistance: 1,
  toHit: 70,
  critChance: 5,
  damage: { count: 1, sides: 6, bonus: 1 },
  attackApCost: 5,
  attackRange: 1,
  actionPoints: 8,
}

/** A fragile skirmisher: harder to hit than a Goblin, but light on hit points and damage, and nothing on it stops a blow. */
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

/**
 * A goblin caster that keeps to the back: frail and a poor fighter, it heals
 * its side, curses the party with Bane and throws Magic Arrows.
 */
export const GOBLIN_SHAMAN_STATS: CombatantStats = {
  name: 'Goblin Shaman',
  maxHp: 10,
  ac: 10,
  toHit: 50,
  critChance: 5,
  damage: { count: 1, sides: 4, bonus: 0 },
  weapon: 'Staff',
  attackApCost: 4,
  attackRange: 1,
  actionPoints: 8,
  magic: { maxMana: 14, skill: 60, spells: ['magic_arrow', 'heal', 'bane'] },
}

/**
 * What guards the blight's Source: a hulk of corrupted flesh that tears with
 * its claws, through some of any armour, and breathes the blight out as
 * Death Cloud and Bane. Fought only at the top threat, so its level 1 block
 * is a sketch for `foeAtLevel` to raise.
 */
export const BLIGHT_HORROR_STATS: CombatantStats = {
  name: 'Blight Horror',
  maxHp: 55,
  ac: 15,
  toHit: 70,
  critChance: 5,
  armorPierce: 2,
  damage: { count: 2, sides: 6, bonus: 2 },
  weapon: 'Claws',
  attackApCost: 4,
  attackRange: 1,
  actionPoints: 8,
  magic: { maxMana: 16, skill: 60, spells: ['death_cloud', 'bane'] },
}

/**
 * A goblin war leader in a coat of mail: slow to dodge, but the mail stops
 * most of what a dagger or a shortsword does, and its morning star bites
 * through a little armour. A foe for the heavy weapons and the spells.
 */
export const HOBGOBLIN_CHIEF_STATS: CombatantStats = {
  name: 'Hobgoblin Chief',
  maxHp: 16,
  ac: 10,
  resistance: 4,
  toHit: 70,
  critChance: 5,
  armorPierce: 1,
  damage: { count: 1, sides: 8, bonus: 2 },
  weapon: 'Morning Star',
  attackApCost: 5,
  attackRange: 1,
  actionPoints: 8,
}

/**
 * A gangling brute that rakes twice a turn with its claws, both at once
 * standing still (`troll_claws`) or one after a move, and knits its
 * wounds back together as its turn begins, unless acid or fire has caught it
 * (`STATUSES`, `stopsRegeneration`). Its hide is thick, but no armour.
 */
export const TROLL_STATS: CombatantStats = {
  name: 'Troll',
  maxHp: 16,
  ac: 10,
  resistance: 1,
  regeneration: 3,
  toHit: 65,
  critChance: 5,
  damage: { count: 1, sides: 4, bonus: 2 },
  weapon: 'Claws',
  attackApCost: 4,
  attackRange: 1,
  actionPoints: 8,
  abilities: ['troll_claws'],
}

/**
 * A troll grown over with plates of bone: easy to hit and hard to hurt, so
 * that the light blades and the bow scarcely scratch it while it regenerates
 * as a troll does, and so heavy that it swings once a turn, not twice.
 * Fielded only at the higher threats (`FoeSlot.fromThreat`).
 */
export const ARMORED_TROLL_STATS: CombatantStats = {
  name: 'Armoured Troll',
  maxHp: 18,
  ac: 5,
  resistance: 5,
  regeneration: 2,
  toHit: 65,
  critChance: 5,
  armorPierce: 1,
  damage: { count: 2, sides: 6, bonus: 2 },
  weapon: 'Claws',
  attackApCost: 5,
  attackRange: 1,
  actionPoints: 8,
}

/** What each level above the first adds to a monster: this share of its level 1 hit points... */
export const FOE_HP_PER_LEVEL = 0.7
/** ...this many points to its chance to hit and to its armour class... */
export const FOE_TO_HIT_PER_LEVEL = 5
export const FOE_AC_PER_LEVEL = 5
/** ...and 1 to its damage every this many levels... */
export const FOE_DAMAGE_LEVEL_STEP = 2
/** ...and to a caster this much mana, besides `FOE_TO_HIT_PER_LEVEL` to its spells' chance. */
export const FOE_MANA_PER_LEVEL = 3

/**
 * A monster's stat block at `level`, from its level 1 block. A monster grows
 * about as fast as a hero who puts every skill point into one weapon, until
 * the hero's points come dearer from 80% (skills.ts), and faster than one
 * who does not, and its armour grows where a hero's does not
 * (character.ts, progression.ts): the lands further out are meant to be
 * harder for the party that has earned its way there, not merely to keep
 * pace with it. Its resistance and regeneration are its kind's at any
 * level: how heavily a monster is armoured is what sets the weapons to fight
 * it with, and a regeneration that grew with its hit points outpaced what a
 * party deals in a round. A kind with a `native` level above 1 has its block
 * written for that level: it is that block at `native` (a lower level is
 * taken as `native`), and grows from there by the same steps. A kind with
 * abilities gains the damage step on them too (`abilityDamageBonus`).
 */
export function foeAtLevel(base: CombatantStats, level: number, native = 1): CombatantStats {
  const at = Math.max(level, native)
  const above = at - native
  return {
    ...base,
    maxHp: Math.round((base.maxHp * (1 + FOE_HP_PER_LEVEL * (at - 1))) / (1 + FOE_HP_PER_LEVEL * (native - 1))),
    ac: base.ac + FOE_AC_PER_LEVEL * above,
    toHit: base.toHit + FOE_TO_HIT_PER_LEVEL * above,
    damage: { ...base.damage, bonus: base.damage.bonus + Math.floor(above / FOE_DAMAGE_LEVEL_STEP) },
    ...(base.magic
      ? {
          magic: {
            ...base.magic,
            maxMana: base.magic.maxMana + FOE_MANA_PER_LEVEL * above,
            skill: base.magic.skill + FOE_TO_HIT_PER_LEVEL * above,
          },
        }
      : {}),
    ...(base.abilities ? { abilityDamageBonus: (base.abilityDamageBonus ?? 0) + Math.floor(above / FOE_DAMAGE_LEVEL_STEP) } : {}),
  }
}

/** The measured growth of the ready-made fighter (campaign reference §3) at the levels it was measured: [level, hero hit, hit points, mean damage a turn]. */
const FIGHTER_GROWTH: ReadonlyArray<readonly [number, number, number, number]> = [
  [1, 60, 32, 10.5],
  [5, 82, 58, 10.5],
  [10, 104, 83, 12.5],
  [15, 114, 108, 12.5],
  [20, 124, 133, 13.5],
]

/** The fighter's `column` at `level`: linear between the levels measured, held at the first and the last outside them. */
function fighterGrowth(level: number, column: 1 | 2 | 3): number {
  const last = FIGHTER_GROWTH[FIGHTER_GROWTH.length - 1]
  if (level <= FIGHTER_GROWTH[0][0]) return FIGHTER_GROWTH[0][column]
  if (level >= last[0]) return last[column]
  const next = FIGHTER_GROWTH.findIndex((row) => row[0] >= level)
  const from = FIGHTER_GROWTH[next - 1]
  const to = FIGHTER_GROWTH[next]
  return from[column] + ((to[column] - from[column]) * (level - from[0])) / (to[0] - from[0])
}

/** The ranges a foe of a level should sit in, as [low, high]; see `foeYardstick`. */
export interface FoeYardstick {
  ac: readonly [number, number]
  toHit: readonly [number, number]
  maxHp: readonly [number, number]
  /** Mean damage a turn: attacks a turn (floor(actionPoints / attackApCost), at least 1) times the mean of its damage roll. */
  meanDamage: readonly [number, number]
}

/**
 * What a foe of `level` should look like against the ready-made fighter's
 * growth: armour class 35 to 55 below the hero's chance to hit, a chance to
 * hit of 80 to 100, hit points 3 to 6 of the fighter's blows, and a turn's
 * damage a sixth to a tenth of the fighter's hit points. A yardstick for
 * a new kind, not a rule: a kind outside it should say why.
 */
export function foeYardstick(level: number): FoeYardstick {
  const hit = fighterGrowth(level, 1)
  const hp = fighterGrowth(level, 2)
  const damage = fighterGrowth(level, 3)
  return {
    ac: [hit - 55, hit - 35],
    toHit: [80, 100],
    maxHp: [3 * damage, 6 * damage],
    meanDamage: [hp / 10, hp / 6],
  }
}
