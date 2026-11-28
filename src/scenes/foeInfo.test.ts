import { describe, expect, it } from 'vitest'
import type { UnitSnapshot } from '../engine/battleEngine.ts'
import { banditGear, banditStats } from '../game/bandits.ts'
import { foeInfoLines } from './foeInfo.ts'

const unit = (extra: Partial<UnitSnapshot>) => ({ name: 'Giant Spider', recharging: {}, ...extra }) as UnitSnapshot
/** The ability's status line and the lines describing it, the title left off. */
const describe1 = (extra: Partial<UnitSnapshot>) => foeInfoLines(unit(extra)).slice(1)

describe('foeInfoLines', () => {
  it('is empty for a unit with no ability and no ward', () => {
    expect(foeInfoLines(unit({}))).toEqual([])
    expect(foeInfoLines(unit({ abilities: [], wards: { fire: 0 } }))).toEqual([])
  })

  it('opens with the foe\'s name, so the panel says whose it is', () => {
    expect(foeInfoLines(unit({ name: 'Brood Spider', abilities: ['spider_bite'] }))[0]).toBe('Brood Spider')
  })

  it('gives each ability as the player will find it on the foe\'s coming turns: ready, ready next turn, or in N turns', () => {
    // The counter falls as the foe's turn begins, so 1 is usable on its next turn.
    const spider = unit({ abilities: ['spider_bite', 'spider_web', 'fire_spit'], recharging: { spider_web: 3, fire_spit: 1, spider_bite: 0 } })
    const named = foeInfoLines(spider).filter((line) => !line.startsWith('  '))
    expect(named).toEqual(['Giant Spider', 'Bite: ready', 'Web: ready in 3 turns', 'Fire Spit: ready next turn'])
    expect(describe1({ abilities: ['fire_spit'], recharging: { fire_spit: 2 } })[0]).toBe('Fire Spit: ready in 2 turns')
  })

  describe('describes each ability from its data, under its name, indented', () => {
    it('Claws: the routine\'s strikes', () => {
      expect(describe1({ abilities: ['troll_claws'] })).toEqual(['Claws: ready', '  claw 1d4+2, claw 1d4+2'])
    })

    it('Bite: the strikes, and the status the second lays with what it does', () => {
      expect(describe1({ abilities: ['spider_bite'] })).toEqual([
        'Bite: ready',
        '  bite 1d6+2, venom bite 1d6+2',
        '  venom bite: poisoned 3 turns (1d6 poison a turn)',
      ])
    })

    it('Web: a burst at range, and the status it lays', () => {
      expect(describe1({ abilities: ['spider_web'] })).toEqual(['Web: ready', '  burst 1, range 4: webbed 2 turns (−4 AP)'])
    })

    it('Fire Spit: the cone, its dice and element, half on a miss, and the status it lays on each one it hits', () => {
      expect(describe1({ abilities: ['fire_spit'] })).toEqual([
        'Fire Spit: ready',
        '  cone 2: 4d6+2 fire, half on a miss',
        '  each one hit: seared 1 turn (no regeneration)',
      ])
    })

    it('Fire Breath: the status is laid on the ones it hits, not on the dragon', () => {
      expect(describe1({ abilities: ['dragon_breath'] })).toEqual([
        'Fire Breath: ready',
        '  cone 3: 6d6 fire, half on a miss',
        '  each one hit: seared 1 turn (no regeneration)',
      ])
    })

    it('Sweep and Rock: an area that armour cuts, so the line says so (not that it goes through armour)', () => {
      expect(describe1({ abilities: ['ogre_sweep'] })).toEqual(['Sweep: ready', '  burst 1, around itself, foes only: 2d8+2, cut by armour'])
      expect(describe1({ abilities: ['giant_rock'] })).toEqual(['Rock: ready', '  burst 0, range 4: 2d8+2, cut by armour'])
    })

    it('adds the foe\'s level to the dice (abilityDamageBonus), as the engine does', () => {
      expect(describe1({ abilities: ['troll_claws', 'fire_spit'], abilityDamageBonus: 2 })).toEqual([
        'Claws: ready',
        '  claw 1d4+4, claw 1d4+4',
        'Fire Spit: ready',
        '  cone 2: 4d6+4 fire, half on a miss',
        '  each one hit: seared 1 turn (no regeneration)',
      ])
    })
  })

  describe('lists a caster\'s spells, with the mana it has left, and under them each spell\'s reach and effect', () => {
    const caster = (spells: Parameters<typeof unit>[0]['magic'], mana: number, extra: Partial<UnitSnapshot> = {}) => unit({ name: 'Blight Cultist', magic: spells, mana, ...extra })

    it('the Blight Cultist: Heal, Curse and Lightning Bolt', () => {
      expect(foeInfoLines(caster({ maxMana: 16, skill: 95, spells: ['heal', 'curse', 'lightning_bolt'] }, 16))).toEqual([
        'Blight Cultist',
        'Spells: Heal, Curse, Lightning Bolt (16 mana)',
        '  heal: an ally within 4: +1d8+2',
        '  curse: a foe within 5: cursed 3 turns (−15 to hit, −5 AC)',
        '  lightning bolt: line 6: 4d6 lightning',
      ])
    })

    it('the Blight Lich: an area, a drain and a spell on itself, and its mana as it stands now', () => {
      const lich = caster({ maxMana: 30, skill: 100, spells: ['death_cloud', 'lightning_bolt', 'drain_life', 'dark_shield'] }, 22, { name: 'Blight Lich' })
      expect(foeInfoLines(lich)).toEqual([
        'Blight Lich',
        'Spells: Death Cloud, Lightning Bolt, Drain Life, Dark Shield (22 mana)',
        '  death cloud: burst 1, range 5: poisoned 3 turns (1d6 poison a turn)',
        '  lightning bolt: line 6: 4d6 lightning',
        '  drain life: a foe within 5: 3d6, half heals the caster',
        '  dark shield: itself: shielded 3 turns (+15 AC)',
      ])
    })

    it('adds the caster\'s spell power, heal bonus and longer statuses to what it shows', () => {
      const strong = caster({ maxMana: 20, skill: 90, spells: ['flame_arrow', 'heal', 'curse'], power: { all: 1, fire: 2 }, healBonus: 3, extend: { hostile: 1 } }, 20, { name: 'Hedge-Mage' })
      expect(foeInfoLines(strong).slice(2)).toEqual([
        '  flame arrow: a foe within 5: 2d8+3 fire, seared 2 turns (no regeneration)',
        '  heal: an ally within 4: +1d8+5',
        '  curse: a foe within 5: cursed 4 turns (−15 to hit, −5 AC)',
      ])
    })

    it('puts the spells after the abilities, before the wards', () => {
      const lines = foeInfoLines(caster({ maxMana: 6, skill: 90, spells: ['drain_life'] }, 6, { abilities: ['troll_claws'], wards: { fire: 10 } }))
      expect(lines.filter((line) => !line.startsWith('  '))).toEqual(['Blight Cultist', 'Claws: ready', 'Spells: Drain Life (6 mana)', 'Wards: fire 10'])
    })
  })

  it('ends with what an immune unit is immune to, by the name of each ticking status’s damage', () => {
    expect(foeInfoLines(unit({ name: 'Stone Golem', immune: true }))).toEqual(['Stone Golem', 'Immune to acid and poison'])
    expect(foeInfoLines(unit({ name: 'Stone Golem', immune: true, wards: { poison: 99 } }))).toEqual(['Stone Golem', 'Wards: poison 99', 'Immune to acid and poison'])
  })

  it('then lists the wards above 0 in element order', () => {
    const lines = foeInfoLines(unit({ name: 'Troll', abilities: ['troll_claws'], wards: { poison: 3, fire: 99, frost: 0 } }))
    expect(lines).toEqual(['Troll', 'Claws: ready', '  claw 1d4+2, claw 1d4+2', 'Wards: fire 99, poison 3'])
  })

  it('describes a technique: its cost for the weapon held and the weapon it needs, then its blow and what it adds', () => {
    const sword = { attackApCost: 5 }
    expect(describe1({ ...sword, abilities: ['power_attack'] })).toEqual([
      'Power Attack: ready', '  7 AP (weapon + 2), melee weapon', '  power attack: weapon blow, −10 to hit, +6 dmg',
    ])
    expect(describe1({ ...sword, abilities: ['pin'] })).toEqual([
      'Pin: ready', '  3 mana, 6 AP (weapon + 1), melee weapon', '  pin: weapon blow', '  pin: pinned 1 turn (cannot move)',
    ])
    expect(describe1({ ...sword, abilities: ['cleave'] })).toEqual([
      'Cleave: ready', '  7 AP (weapon + 2), melee weapon', '  cleave: weapon blow, −5 to hit', '  cleave: weapon blow, −5 to hit, at another foe in reach',
    ])
    expect(describe1({ ...sword, abilities: ['smite'] })[2]).toBe('  smite: weapon blow, +4 on hit, +6 on hit vs the regenerating and blightborn')
    expect(describe1({ attackApCost: 3, abilities: ['dirty_trick'] })).toEqual([
      'Dirty Trick: ready', '  4 AP (weapon + 1), melee weapon', '  dirty trick: weapon blow', '  dirty trick: baned 2 turns (−15 to hit)',
    ])
    expect(describe1({ ...sword, abilities: ['venom_strike'] })[1]).toBe('  2 mana, 6 AP (weapon + 1)')
    expect(describe1({ ...sword, abilities: ['venom_strike'] })[2]).toBe('  venom strike: weapon blow or shot')
    expect(describe1({ attackApCost: 4, abilities: ['volley'] })).toEqual([
      'Volley: ready', '  6 AP (weapon + 2), ranged weapon', '  burst 1, weapon range: weapon damage, cut by armour',
    ])
  })

  it('describes a status laid with no roll on itself or a foe, and an area round the user', () => {
    expect(describe1({ abilities: ['sprint'] })).toEqual(['Sprint: ready', '  0 AP', '  itself: hasted 1 turn (+3 AP)'])
    expect(describe1({ abilities: ['hunters_mark'] })).toEqual(['Hunter\'s Mark: ready', '  2 AP', '  a foe within weapon range: marked 2 turns (−10 AC)'])
    expect(describe1({ abilities: ['taunt'] })).toEqual([
      'Taunt: ready', '  3 AP', '  burst 2, around itself, foes only: taunted 1 turn (−25 to hit but at the taunter)',
    ])
    expect(describe1({ abilities: ['consecrate'] })).toEqual([
      'Consecrate: ready', '  5 mana, 5 AP',
      '  burst 1, around itself, foes only: 2d6, half on a miss, double dice vs the regenerating and blightborn',
    ])
  })
})

describe('a bandit that learned techniques', () => {
  const hover = (role: 'captain' | 'brute') => {
    const stats = banditStats(role, 8, banditGear(5))
    return foeInfoLines(unit({ ...stats, name: role, recharging: {} }))
  }

  it('describes the level-8 Captain\'s Taunt and Pin with their costs for his sword', () => {
    const lines = hover('captain')
    const at = (name: string) => lines.slice(lines.indexOf(name) + 1, lines.indexOf(name) + 3)
    expect(at('Taunt: ready')).toEqual(['  3 AP', '  burst 2, around itself, foes only: taunted 1 turn (−25 to hit but at the taunter)'])
    expect(at('Pin: ready').slice(0, 1)).toEqual(['  3 mana, 6 AP (weapon + 1), melee weapon'])
  })

  it('describes the level-8 Brute\'s Power Attack and Cleave with the AP of his axe', () => {
    const lines = hover('brute')
    const { attackApCost } = banditStats('brute', 8, banditGear(5))
    expect(lines).toEqual(expect.arrayContaining(['Power Attack: ready', `  ${attackApCost + 2} AP (weapon + 2), melee weapon`, 'Cleave: ready']))
  })
})
