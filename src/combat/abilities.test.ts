import { describe, expect, it } from 'vitest'
import { ABILITIES, ABILITY_IDS } from './abilities.ts'
import { GOBLIN_STATS, TROLL_STATS, foeAtLevel, sameCombatStats } from './combat.ts'

describe('abilities', () => {
  it.each(ABILITY_IDS)('gives %s exactly one of strikes and an area', (id) => {
    const ability = ABILITIES[id]
    expect(Number(ability.strikes !== undefined) + Number(ability.area !== undefined)).toBe(1)
    if (ability.strikes) expect(ability.strikes.length).toBeGreaterThan(0)
    expect(ability.apCost).toBeGreaterThan(0)
    expect(ability.recharge).toBeGreaterThanOrEqual(0)
    expect(ability.verb.length).toBeGreaterThan(0)
  })

  it('makes the Troll’s claws two claws of its weapon’s dice for its whole turn, with no recharge', () => {
    const claws = ABILITIES.troll_claws
    expect(claws).toMatchObject({ name: 'Claws', verb: 'claws', apCost: TROLL_STATS.actionPoints, recharge: 0 })
    expect(claws.strikes).toEqual([
      { name: 'Claw', verb: 'claws', damage: TROLL_STATS.damage },
      { name: 'Claw', verb: 'claws', damage: TROLL_STATS.damage },
    ])
  })

  it('makes the spider’s bite a bite and a venom bite that poisons, once a turn', () => {
    const bite = ABILITIES.spider_bite
    expect(bite).toMatchObject({ name: 'Bite', verb: 'bites', apCost: 4, recharge: 1 })
    expect(bite.strikes).toEqual([
      { name: 'Bite', verb: 'bites', damage: { count: 1, sides: 6, bonus: 2 } },
      { name: 'Venom Bite', verb: 'bites', damage: { count: 1, sides: 6, bonus: 2 }, status: { id: 'poisoned', turns: 3 } },
    ])
  })
})

describe('stat blocks with abilities', () => {
  it('gives the Troll its claws and nothing else new', () => {
    expect(TROLL_STATS.abilities).toEqual(['troll_claws'])
    expect(TROLL_STATS.abilityDamageBonus).toBeUndefined()
  })

  it('tells blocks apart by their abilities, in order, and their ability damage bonus', () => {
    const both = { ...GOBLIN_STATS, abilities: ['troll_claws', 'spider_bite'] as const }
    expect(sameCombatStats(both, { ...both })).toBe(true)
    expect(sameCombatStats(both, GOBLIN_STATS)).toBe(false)
    expect(sameCombatStats(both, { ...both, abilities: ['spider_bite', 'troll_claws'] })).toBe(false)
    expect(sameCombatStats(both, { ...both, abilities: ['troll_claws'] })).toBe(false)
    expect(sameCombatStats(GOBLIN_STATS, { ...GOBLIN_STATS, abilities: [] })).toBe(true)
    expect(sameCombatStats(both, { ...both, abilityDamageBonus: 1 })).toBe(false)
    expect(sameCombatStats(both, { ...both, abilityDamageBonus: 0 })).toBe(true)
  })

  it('has foeAtLevel add its damage step to a block with abilities, and leave one without as it was', () => {
    expect(foeAtLevel(TROLL_STATS, 4).abilityDamageBonus).toBe(1)
    expect(foeAtLevel(TROLL_STATS, 5).abilityDamageBonus).toBe(2)
    expect(foeAtLevel(TROLL_STATS, 1).abilityDamageBonus).toBe(0)
    expect(foeAtLevel({ ...TROLL_STATS, abilityDamageBonus: 2 }, 3).abilityDamageBonus).toBe(3)
    expect(foeAtLevel(GOBLIN_STATS, 5)).not.toHaveProperty('abilityDamageBonus')
  })
})
