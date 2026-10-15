import { describe, expect, it } from 'vitest'
import { GOBLIN_SHAMAN_STATS, GOBLIN_STATS, effectiveAc, foeAtLevel, formatDamage, hitChance, resolveAttack, rollDamage, rollDie, sameCombatStats, type CombatantStats } from './combat.ts'

const WARRIOR_STATS: CombatantStats = {
  name: 'Warrior',
  maxHp: 20,
  ac: 25,
  toHit: 75,
  critChance: 5,
  damage: { count: 1, sides: 8, bonus: 2 },
  attackApCost: 5,
  attackRange: 1,
  actionPoints: 8,
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

describe('effectiveAc', () => {
  it('takes the pierced share off the armour, rounded in the defender\'s favour, and never below nothing', () => {
    expect(effectiveAc(WARRIOR_STATS, 35)).toBe(35)
    expect(effectiveAc({ ...WARRIOR_STATS, armorPierce: 25 }, 35)).toBe(27)
    expect(effectiveAc({ ...WARRIOR_STATS, armorPierce: 25 }, 15)).toBe(12)
    expect(effectiveAc({ ...WARRIOR_STATS, armorPierce: 150 }, 35)).toBe(0)
  })

  it('tells most against the heaviest armour', () => {
    const axe = { ...WARRIOR_STATS, armorPierce: 25 }
    expect(hitChance(axe, 40) - hitChance(WARRIOR_STATS, 40)).toBeCloseTo(0.1)
    expect(hitChance(axe, 20) - hitChance(WARRIOR_STATS, 20)).toBeCloseTo(0.05)
  })
})

describe('resolveAttack', () => {
  it('always misses on a roll above 95, even against no armour at all', () => {
    const rng = sequence([0 /* roll -> 100 */])
    const result = resolveAttack({ ...WARRIOR_STATS, toHit: 200 }, 0, rng)
    expect(result).toMatchObject({ attackRoll: 100, chance: 95, fumble: true, hit: false, damage: 0 })
  })

  it('hits with the best rolls whatever the armour, and doubles the damage dice (not the bonus) on a critical', () => {
    const rng = sequence([0.999 /* roll -> 1 */, 0 /* damage die -> 1 */, 0.999 /* damage die -> 8 */])
    const result = resolveAttack(WARRIOR_STATS, 999, rng)
    expect(result).toMatchObject({ attackRoll: 1, chance: 5, critical: true, hit: true })
    expect(result.damage).toBe(1 + 8 + WARRIOR_STATS.damage.bonus)
  })

  it('hits when the roll is within the chance: to hit less armour class', () => {
    const hit = resolveAttack(WARRIOR_STATS, 25, sequence([0.5 /* roll -> 50 */, 0.5 /* damage die */]))
    expect(hit).toMatchObject({ attackRoll: 50, chance: 50, hit: true, critical: false })
    const miss = resolveAttack(WARRIOR_STATS, 25, sequence([0.49 /* roll -> 51 */]))
    expect(miss).toMatchObject({ attackRoll: 51, hit: false, fumble: false, damage: 0 })
  })

  it('adds a situational bonus to the chance', () => {
    const rng = sequence([0.45 /* roll -> 55 */, 0.5 /* damage die */])
    const result = resolveAttack(WARRIOR_STATS, 30, rng, 10)
    expect(result).toMatchObject({ chance: 55, hit: true })
  })

  it('is critical only within the attacker’s critical chance, and only on a hit', () => {
    const keen = { ...WARRIOR_STATS, critChance: 20 }
    expect(resolveAttack(keen, 15, sequence([0.8 /* roll -> 20 */, 0.5])).critical).toBe(true)
    expect(resolveAttack(keen, 15, sequence([0.79 /* roll -> 21 */, 0.5])).critical).toBe(false)
    // A 10% chance to hit: a roll of 15 is within the critical chance but misses.
    expect(resolveAttack(keen, 65, sequence([0.85 /* roll -> 15 */]))).toMatchObject({ hit: false, critical: false })
  })

  it('hitChance matches resolveAttack over every roll', () => {
    for (const [ac, bonus] of [[15, 0], [30, 10], [100, 0], [-40, 0], [25, -50]]) {
      let hits = 0
      for (let roll = 1; roll <= 100; roll++) {
        if (resolveAttack(WARRIOR_STATS, ac, sequence([(roll - 0.5) / 100, 0.5]), bonus).hit) hits++
      }
      expect(hitChance(WARRIOR_STATS, ac, bonus)).toBeCloseTo(hits / 100)
    }
    expect(hitChance(WARRIOR_STATS, 15)).toBeCloseTo(0.6)
  })
})

describe('formatDamage', () => {
  it('renders dice notation with signed bonuses', () => {
    expect(formatDamage({ count: 1, sides: 8, bonus: 2 })).toBe('1d8+2')
    expect(formatDamage({ count: 2, sides: 6, bonus: 0 })).toBe('2d6')
    expect(formatDamage({ count: 1, sides: 4, bonus: -1 })).toBe('1d4-1')
  })
})

describe('sameCombatStats', () => {
  it('compares every stat, damage dice included', () => {
    expect(sameCombatStats(WARRIOR_STATS, { ...WARRIOR_STATS, damage: { ...WARRIOR_STATS.damage } })).toBe(true)
    expect(sameCombatStats(WARRIOR_STATS, { ...WARRIOR_STATS, attackRange: 5 })).toBe(false)
    const magic = { maxMana: 18, skill: 76, spells: ['magic_arrow' as const] }
    const mage = { ...WARRIOR_STATS, magic }
    expect(sameCombatStats(mage, { ...WARRIOR_STATS, magic: { ...magic, spells: [...magic.spells] } })).toBe(true)
    expect(sameCombatStats(mage, WARRIOR_STATS)).toBe(false)
    expect(sameCombatStats(WARRIOR_STATS, mage)).toBe(false)
    expect(sameCombatStats(mage, { ...WARRIOR_STATS, magic: { ...magic, maxMana: 24 } })).toBe(false)
    expect(sameCombatStats(mage, { ...WARRIOR_STATS, magic: { ...magic, skill: 86 } })).toBe(false)
    expect(sameCombatStats(mage, { ...WARRIOR_STATS, magic: { ...magic, spells: [] } })).toBe(false)
    expect(sameCombatStats(WARRIOR_STATS, { ...WARRIOR_STATS, weapon: 'Iron Longsword' })).toBe(false)
    expect(sameCombatStats(WARRIOR_STATS, { ...WARRIOR_STATS, armorPierce: 0 })).toBe(true)
    expect(sameCombatStats(WARRIOR_STATS, { ...WARRIOR_STATS, armorPierce: 15 })).toBe(false)
    expect(sameCombatStats(WARRIOR_STATS, { ...WARRIOR_STATS, damage: { count: 1, sides: 8, bonus: 0 } })).toBe(false)
  })
})

describe('foeAtLevel', () => {
  it('leaves a level 1 monster as it is', () => {
    expect(foeAtLevel(GOBLIN_STATS, 1)).toEqual(GOBLIN_STATS)
    expect(foeAtLevel(GOBLIN_SHAMAN_STATS, 1)).toEqual(GOBLIN_SHAMAN_STATS)
  })

  it('adds mana and spell chance to a caster every level', () => {
    expect(foeAtLevel(GOBLIN_SHAMAN_STATS, 3).magic).toEqual({ ...GOBLIN_SHAMAN_STATS.magic, maxMana: 20, skill: 70 })
  })

  it('adds hit points, chance to hit and armour every level, and damage every second', () => {
    expect(foeAtLevel(GOBLIN_STATS, 2)).toEqual({ ...GOBLIN_STATS, maxHp: 20, ac: 20, toHit: 75 })
    expect(foeAtLevel(GOBLIN_STATS, 5)).toEqual({
      ...GOBLIN_STATS,
      maxHp: 46,
      ac: 35,
      toHit: 90,
      damage: { count: 1, sides: 6, bonus: 3 },
    })
  })
})
