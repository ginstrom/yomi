import { describe, expect, it } from 'vitest'
import { ABILITIES, ABILITY_IDS, abilityApCost, type Ability, type AbilityId } from './abilities.ts'
import { GOBLIN_STATS, TROLL_STATS, foeAtLevel, sameCombatStats, type CombatantStats } from './combat.ts'

const MONSTER_ABILITIES: AbilityId[] = ['troll_claws', 'spider_bite', 'spider_web', 'fire_spit']
const HERO_ABILITIES = ABILITY_IDS.filter((id) => !MONSTER_ABILITIES.includes(id))

describe('abilities', () => {
  it.each(ABILITY_IDS)('gives %s exactly one of strikes, an area, a status on itself and a status on a foe', (id) => {
    const ability = ABILITIES[id]
    const kinds = [ability.strikes, ability.area, ability.selfStatus, ability.foeStatus].filter((k) => k !== undefined)
    expect(kinds).toHaveLength(1)
    if (ability.strikes) expect(ability.strikes.length).toBeGreaterThan(0)
    expect(ability.apCost).toBeGreaterThanOrEqual(0)
    expect(ability.recharge).toBeGreaterThanOrEqual(0)
    expect(ability.verb.length).toBeGreaterThan(0)
    expect(ability.description.length).toBeGreaterThan(0)
  })

  it.each(ABILITY_IDS)('gives each strike of %s its own dice or the weapon’s, never both', (id) => {
    for (const strike of ABILITIES[id].strikes ?? []) {
      expect(Number(strike.damage !== undefined) + Number(strike.weapon === true)).toBe(1)
    }
  })

  it.each(MONSTER_ABILITIES)('leaves the monsters’ %s with none of the heroes’ fields, its AP its own', (id) => {
    const ability: Ability = ABILITIES[id]
    for (const key of ['manaCost', 'weaponAp', 'needs', 'selfStatus', 'foeStatus'] as const) expect(ability[key]).toBeUndefined()
    for (const strike of ability.strikes ?? []) {
      for (const key of ['weapon', 'toHit', 'damageBonus', 'onHit', 'spreads'] as const) expect(strike[key]).toBeUndefined()
    }
    expect(abilityApCost(TROLL_STATS, id)).toBe(ability.apCost)
    expect(ability.apCost).toBeGreaterThan(0)
  })

  it('lists the heroes’ techniques after the monsters’ abilities, in the plan’s order', () => {
    expect(HERO_ABILITIES).toEqual([
      'power_attack', 'cleave', 'pin', 'flame_strike', 'frost_strike', 'thunder_strike', 'aimed_shot', 'hunters_mark',
      'pinning_shot', 'sprint', 'dirty_trick', 'venom_strike', 'hamstring', 'smite',
    ])
  })

  /** Each technique as design §4.3 has it: mana, weapon AP added, recharge, needs, and its strikes or status. */
  const TECHNIQUES: Record<string, Partial<Ability>> = {
    power_attack: { weaponAp: 2, recharge: 0, needs: 'melee', strikes: [{ name: 'Power Attack', verb: 'power-attacks', weapon: true, toHit: -10, damageBonus: 6 }] },
    cleave: {
      weaponAp: 2, recharge: 2, needs: 'melee',
      strikes: [
        { name: 'Cleave', verb: 'cleaves', weapon: true, toHit: -5 },
        { name: 'Cleave', verb: 'cleaves', weapon: true, toHit: -5, spreads: true },
      ],
    },
    pin: { manaCost: 3, weaponAp: 1, recharge: 1, needs: 'melee', strikes: [{ name: 'Pin', verb: 'pins', weapon: true, status: { id: 'pinned', turns: 1 } }] },
    flame_strike: {
      manaCost: 3, weaponAp: 1, recharge: 0, needs: 'melee',
      strikes: [{ name: 'Flame Strike', verb: 'flame-strikes', weapon: true, onHit: [{ damage: 5, element: 'fire' }], status: { id: 'seared', turns: 1 } }],
    },
    frost_strike: {
      manaCost: 3, weaponAp: 1, recharge: 0, needs: 'melee',
      strikes: [{ name: 'Frost Strike', verb: 'frost-strikes', weapon: true, onHit: [{ damage: 4, element: 'frost' }], status: { id: 'chilled', turns: 1 } }],
    },
    thunder_strike: {
      manaCost: 4, weaponAp: 1, recharge: 0, needs: 'melee',
      strikes: [{ name: 'Thunder Strike', verb: 'thunder-strikes', weapon: true, toHit: 10, onHit: [{ damage: 7, element: 'lightning' }] }],
    },
    aimed_shot: { weaponAp: 2, recharge: 0, needs: 'ranged', strikes: [{ name: 'Aimed Shot', verb: 'takes aim at', weapon: true, toHit: 20, damageBonus: 3 }] },
    hunters_mark: { apCost: 2, recharge: 3, foeStatus: { status: { id: 'marked', turns: 2 }, range: 'weapon' } },
    pinning_shot: { manaCost: 3, weaponAp: 1, recharge: 1, needs: 'ranged', strikes: [{ name: 'Pinning Shot', verb: 'pins', weapon: true, status: { id: 'pinned', turns: 1 } }] },
    sprint: { apCost: 0, recharge: 3, selfStatus: { id: 'hasted', turns: 1 } },
    dirty_trick: { weaponAp: 1, recharge: 2, needs: 'melee', strikes: [{ name: 'Dirty Trick', verb: 'plays a dirty trick on', weapon: true, status: { id: 'baned', turns: 2 } }] },
    venom_strike: { manaCost: 2, weaponAp: 1, recharge: 0, strikes: [{ name: 'Venom Strike', verb: 'envenoms', weapon: true, status: { id: 'poisoned', turns: 3 } }] },
    hamstring: { weaponAp: 1, recharge: 2, strikes: [{ name: 'Hamstring', verb: 'hamstrings', weapon: true, status: { id: 'slowed', turns: 1 } }] },
    smite: {
      manaCost: 3, weaponAp: 1, recharge: 0, needs: 'melee',
      strikes: [{ name: 'Smite', verb: 'smites', weapon: true, onHit: [{ damage: 4 }, { damage: 6, bane: true }] }],
    },
  }

  it.each(Object.keys(TECHNIQUES))('gives %s its numbers', (id) => {
    expect(ABILITIES[id as AbilityId]).toMatchObject(TECHNIQUES[id])
  })

  it('leaves out what a technique does not have: no mana at will, no needs where any weapon serves', () => {
    for (const id of ['power_attack', 'cleave', 'aimed_shot', 'hunters_mark', 'sprint', 'dirty_trick', 'hamstring'] as const) {
      expect(ABILITIES[id].manaCost).toBeUndefined()
    }
    for (const id of ['hunters_mark', 'sprint', 'venom_strike', 'hamstring'] as const) expect(ABILITIES[id].needs).toBeUndefined()
  })

  it('prices a technique at the weapon’s attack AP plus its own, and a monster’s ability at its own', () => {
    const longsword: CombatantStats = { ...GOBLIN_STATS, attackApCost: 5 }
    const bow: CombatantStats = { ...GOBLIN_STATS, attackApCost: 4, attackRange: 5 }
    expect(abilityApCost(longsword, 'power_attack')).toBe(7)
    expect(abilityApCost(longsword, 'pin')).toBe(6)
    expect(abilityApCost(bow, 'aimed_shot')).toBe(6)
    expect(abilityApCost(bow, 'hunters_mark')).toBe(2)
    expect(abilityApCost(bow, 'sprint')).toBe(0)
    expect(abilityApCost(longsword, 'troll_claws')).toBe(8)
    expect(abilityApCost(bow, 'fire_spit')).toBe(4)
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

  it('lists the monsters’ area abilities after their routines, first of all', () => {
    expect(ABILITY_IDS.slice(0, 4)).toEqual(['troll_claws', 'spider_bite', 'spider_web', 'fire_spit'])
  })

  it('makes the spider’s web a burst that only webs, every third turn', () => {
    const web = ABILITIES.spider_web
    expect(web).toMatchObject({ name: 'Web', verb: 'spins a web', apCost: 4, recharge: 3 })
    expect(web.area).toEqual({ shape: 'burst', range: 4, radius: 1, status: { id: 'webbed', turns: 2 }, halfOnMiss: false })
  })

  it('makes fire spit a cone of fire that sears, half on a miss, every other turn', () => {
    const spit = ABILITIES.fire_spit
    expect(spit).toMatchObject({ name: 'Fire Spit', verb: 'spits fire', apCost: 4, recharge: 2 })
    expect(spit.area).toEqual({
      shape: 'cone', range: 2, damage: { count: 4, sides: 6, bonus: 2 }, element: 'fire', status: { id: 'seared', turns: 1 }, halfOnMiss: true,
    })
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

  it('tells blocks apart by their imbued damage, none and 0 alike', () => {
    expect(sameCombatStats(GOBLIN_STATS, { ...GOBLIN_STATS, imbueDamage: 2 })).toBe(false)
    expect(sameCombatStats(GOBLIN_STATS, { ...GOBLIN_STATS, imbueDamage: 0 })).toBe(true)
  })

  it('has foeAtLevel add its damage step to a block with abilities, and leave one without as it was', () => {
    expect(foeAtLevel(TROLL_STATS, 4).abilityDamageBonus).toBe(1)
    expect(foeAtLevel(TROLL_STATS, 5).abilityDamageBonus).toBe(2)
    expect(foeAtLevel(TROLL_STATS, 1).abilityDamageBonus).toBe(0)
    expect(foeAtLevel({ ...TROLL_STATS, abilityDamageBonus: 2 }, 3).abilityDamageBonus).toBe(3)
    expect(foeAtLevel(GOBLIN_STATS, 5)).not.toHaveProperty('abilityDamageBonus')
  })
})
