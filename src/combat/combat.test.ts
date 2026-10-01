import { describe, expect, it } from 'vitest'
import { GOBLIN_STATS, formatDamage, resolveAttack, rollDamage, rollDie, type CombatantStats } from './combat.ts'

const WARRIOR_STATS: CombatantStats = {
  name: 'Warrior',
  maxHp: 20,
  ac: 15,
  attackBonus: 4,
  damage: { count: 1, sides: 8, bonus: 2 },
}

function sequence(values: number[]): () => number {
  let i = 0
  return () => values[Math.min(i++, values.length - 1)]
}

describe('rollDie', () => {
  it('maps rng in [0,1) to an integer in [1, sides]', () => {
    expect(rollDie(20, () => 0)).toBe(1)
    expect(rollDie(20, () => 0.999)).toBe(20)
    expect(rollDie(6, () => 0.5)).toBe(4)
  })
})

describe('rollDamage', () => {
  it('sums dice plus the flat bonus', () => {
    const rng = sequence([0, 0.999])
    const total = rollDamage({ count: 2, sides: 6, bonus: 3 }, rng)
    expect(total).toBe(1 + 6 + 3)
  })
})

describe('resolveAttack', () => {
  it('always misses on a natural 1, even against a very low AC', () => {
    const rng = sequence([0 /* d20 -> 1 */])
    const result = resolveAttack(WARRIOR_STATS, 1, rng)
    expect(result.attackRoll).toBe(1)
    expect(result.fumble).toBe(true)
    expect(result.hit).toBe(false)
    expect(result.damage).toBe(0)
  })

  it('always hits and doubles the damage dice (not the bonus) on a natural 20', () => {
    const rng = sequence([0.999 /* d20 -> 20 */, 0 /* damage die -> 1 */, 0.999 /* damage die -> 8 */])
    const result = resolveAttack(WARRIOR_STATS, 999, rng)
    expect(result.attackRoll).toBe(20)
    expect(result.critical).toBe(true)
    expect(result.hit).toBe(true)
    expect(result.damage).toBe(1 + 8 + WARRIOR_STATS.damage.bonus)
  })

  it('hits when total-to-hit meets or beats defender AC', () => {
    const rng = sequence([0.5 /* d20 -> 11 */, 0.5 /* damage die */])
    const result = resolveAttack(WARRIOR_STATS, 15, rng)
    expect(result.totalToHit).toBe(11 + WARRIOR_STATS.attackBonus)
    expect(result.hit).toBe(true)
  })

  it('misses when total-to-hit is below defender AC', () => {
    const rng = sequence([0.05 /* d20 -> 2 */])
    const result = resolveAttack(GOBLIN_STATS, 25, rng)
    expect(result.hit).toBe(false)
    expect(result.damage).toBe(0)
  })
})

describe('formatDamage', () => {
  it('renders dice notation with signed bonuses', () => {
    expect(formatDamage({ count: 1, sides: 8, bonus: 2 })).toBe('1d8+2')
    expect(formatDamage({ count: 2, sides: 6, bonus: 0 })).toBe('2d6')
    expect(formatDamage({ count: 1, sides: 4, bonus: -1 })).toBe('1d4-1')
  })
})
