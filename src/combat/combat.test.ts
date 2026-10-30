import { describe, expect, it } from 'vitest'
import { GOBLIN_SHAMAN_STATS, GOBLIN_STATS, TROLL_STATS, damageThrough, effectiveResistance, foeAtLevel, foeYardstick, formatDamage, hitChance, resolveAttack, rollDamage, rollDie, sameCombatStats, type CombatantStats } from './combat.ts'

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

describe('effectiveResistance', () => {
  it('takes the pierced points off the resistance, never below nothing', () => {
    expect(effectiveResistance(WARRIOR_STATS, 4)).toBe(4)
    expect(effectiveResistance({ ...WARRIOR_STATS, armorPierce: 2 }, 4)).toBe(2)
    expect(effectiveResistance({ ...WARRIOR_STATS, armorPierce: 6 }, 4)).toBe(0)
  })

  it('leaves the chance to hit alone: piercing is no chance to hit by another name', () => {
    expect(hitChance({ ...WARRIOR_STATS, armorPierce: 3 }, 40)).toBe(hitChance(WARRIOR_STATS, 40))
  })
})

describe('damageThrough', () => {
  it('takes the resistance off the roll, but a hit that rolled anything does at least 1', () => {
    expect(damageThrough(7, 0)).toBe(7)
    expect(damageThrough(7, 3)).toBe(4)
    expect(damageThrough(2, 3)).toBe(1)
    expect(damageThrough(0, 3)).toBe(0)
  })

  it('tells most against many light hits', () => {
    // Two dagger blows of 3 against one greatsword blow of 10, through 3 points of armour.
    const light = 2 * damageThrough(3, 3)
    const heavy = damageThrough(10, 3)
    expect(light).toBeLessThan(heavy / 3)
    expect(2 * damageThrough(3, 0)).toBeLessThan(damageThrough(10, 0))
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

  it('takes the defender\'s resistance, less what the weapon pierces, off the damage of a hit', () => {
    const rolls = () => sequence([0.5 /* roll -> 50 */, 0.5 /* damage die -> 5 */])
    expect(resolveAttack(WARRIOR_STATS, 0, rolls()).damage).toBe(7)
    expect(resolveAttack(WARRIOR_STATS, 0, rolls(), 0, 4).damage).toBe(3)
    expect(resolveAttack({ ...WARRIOR_STATS, armorPierce: 1 }, 0, rolls(), 0, 4).damage).toBe(4)
    expect(resolveAttack(WARRIOR_STATS, 0, rolls(), 0, 20).damage).toBe(1)
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
    expect(sameCombatStats(WARRIOR_STATS, { ...WARRIOR_STATS, armorPierce: 2 })).toBe(false)
    expect(sameCombatStats(WARRIOR_STATS, { ...WARRIOR_STATS, resistance: 0 })).toBe(true)
    expect(sameCombatStats(WARRIOR_STATS, { ...WARRIOR_STATS, resistance: 2 })).toBe(false)
    expect(sameCombatStats(WARRIOR_STATS, { ...WARRIOR_STATS, regeneration: 2 })).toBe(false)
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

  it('keeps its kind\'s resistance and regeneration at every level', () => {
    expect(foeAtLevel(GOBLIN_STATS, 5).resistance).toBe(GOBLIN_STATS.resistance)
    expect(foeAtLevel(TROLL_STATS, 4).regeneration).toBe(TROLL_STATS.regeneration)
    expect(foeAtLevel(GOBLIN_STATS, 4).regeneration).toBeUndefined()
  })

  it('is the same with a native level of 1 as without one', () => {
    for (let level = 0; level <= 6; level++) {
      expect(foeAtLevel(GOBLIN_STATS, level, 1)).toEqual(foeAtLevel(GOBLIN_STATS, level))
      expect(foeAtLevel(GOBLIN_SHAMAN_STATS, level, 1)).toEqual(foeAtLevel(GOBLIN_SHAMAN_STATS, level))
    }
  })

  it('leaves a monster as it is at its native level, and treats a lower level as the native one', () => {
    expect(foeAtLevel(TROLL_STATS, 15, 15)).toEqual(TROLL_STATS)
    expect(foeAtLevel(TROLL_STATS, 9, 15)).toEqual(TROLL_STATS)
    expect(foeAtLevel(GOBLIN_SHAMAN_STATS, 3, 8)).toEqual(GOBLIN_SHAMAN_STATS)
  })

  it('adds to a monster the steps of the levels above its native one', () => {
    const base = { ...GOBLIN_STATS, maxHp: 60 }
    expect(foeAtLevel(base, 16, 15)).toEqual({ ...base, maxHp: 64, ac: base.ac + 5, toHit: base.toHit + 5 })
    expect(foeAtLevel(base, 17, 15)).toEqual({
      ...base,
      maxHp: Math.round((60 * (1 + 0.7 * 16)) / (1 + 0.7 * 14)),
      ac: base.ac + 10,
      toHit: base.toHit + 10,
      damage: { ...base.damage, bonus: base.damage.bonus + 1 },
    })
  })

  it('adds mana and spell chance to a caster from its native level up', () => {
    expect(foeAtLevel(GOBLIN_SHAMAN_STATS, 7, 5).magic).toEqual({
      ...GOBLIN_SHAMAN_STATS.magic,
      maxMana: GOBLIN_SHAMAN_STATS.magic!.maxMana + 6,
      skill: GOBLIN_SHAMAN_STATS.magic!.skill + 10,
    })
  })
})

describe('foeYardstick', () => {
  it('is the ready-made fighter\'s growth at level 1', () => {
    const y = foeYardstick(1)
    expect(y.ac).toEqual([5, 25])
    expect(y.toHit).toEqual([80, 100])
    expect(y.maxHp[0]).toBeCloseTo(31.5)
    expect(y.maxHp[1]).toBeCloseTo(63)
    expect(y.meanDamage[0]).toBeCloseTo(3.2)
    expect(y.meanDamage[1]).toBeCloseTo(32 / 6)
  })

  it('interpolates linearly between the levels measured', () => {
    // Level 7 is two fifths of the way from 5 to 10: hit 90.8, fighter 68 HP, 11.3 damage.
    const y = foeYardstick(7)
    expect(y.ac[0]).toBeCloseTo(35.8)
    expect(y.ac[1]).toBeCloseTo(55.8)
    expect(y.toHit).toEqual([80, 100])
    expect(y.maxHp[0]).toBeCloseTo(33.9)
    expect(y.maxHp[1]).toBeCloseTo(67.8)
    expect(y.meanDamage[0]).toBeCloseTo(6.8)
    expect(y.meanDamage[1]).toBeCloseTo(68 / 6)
  })

  it('holds the level 20 figures past level 20', () => {
    expect(foeYardstick(25)).toEqual(foeYardstick(20))
    expect(foeYardstick(20).ac).toEqual([69, 89])
    expect(foeYardstick(20).meanDamage[0]).toBeCloseTo(13.3)
  })
})
