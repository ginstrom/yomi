export interface DamageRoll {
  count: number
  sides: number
  bonus: number
}

export interface CombatantStats {
  name: string
  maxHp: number
  ac: number
  attackBonus: number
  damage: DamageRoll
  /** Hexes the unit can move in one turn. */
  speed: number
}

export interface AttackResult {
  attackRoll: number
  totalToHit: number
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

/**
 * D20-style resolution: natural 1 always misses, natural 20 always hits
 * and doubles damage dice, otherwise attackRoll + attackBonus vs defenderAc.
 */
export function resolveAttack(
  attacker: CombatantStats,
  defenderAc: number,
  rng: RNG = Math.random,
): AttackResult {
  const attackRoll = rollDie(20, rng)
  const critical = attackRoll === 20
  const fumble = attackRoll === 1
  const totalToHit = attackRoll + attacker.attackBonus
  const hit = !fumble && (critical || totalToHit >= defenderAc)
  const damageRoll = critical ? { ...attacker.damage, count: attacker.damage.count * 2 } : attacker.damage
  const damage = hit ? rollDamage(damageRoll, rng) : 0

  return { attackRoll, totalToHit, hit, critical, fumble, damage }
}

/** "1d8+2" notation. */
export function formatDamage(roll: DamageRoll): string {
  const bonus = roll.bonus > 0 ? `+${roll.bonus}` : roll.bonus < 0 ? `${roll.bonus}` : ''
  return `${roll.count}d${roll.sides}${bonus}`
}

export const GOBLIN_STATS: CombatantStats = {
  name: 'Goblin',
  maxHp: 12,
  ac: 13,
  attackBonus: 3,
  damage: { count: 1, sides: 6, bonus: 1 },
  speed: 4,
}
