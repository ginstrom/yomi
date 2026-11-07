import { describe, expect, it } from 'vitest'
import type { UnitSnapshot } from '../engine/battleEngine.ts'
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

    it('Fire Spit: the cone, its dice and element, half on a miss, and the status it lays', () => {
      expect(describe1({ abilities: ['fire_spit'] })).toEqual([
        'Fire Spit: ready',
        '  cone 2: 4d6+2 fire, half on a miss',
        '  seared 1 turn (no regeneration)',
      ])
    })

    it('adds the foe\'s level to the dice (abilityDamageBonus), as the engine does', () => {
      expect(describe1({ abilities: ['troll_claws', 'fire_spit'], abilityDamageBonus: 2 })).toEqual([
        'Claws: ready',
        '  claw 1d4+4, claw 1d4+4',
        'Fire Spit: ready',
        '  cone 2: 4d6+4 fire, half on a miss',
        '  seared 1 turn (no regeneration)',
      ])
    })
  })

  it('then lists the wards above 0 in element order', () => {
    const lines = foeInfoLines(unit({ name: 'Troll', abilities: ['troll_claws'], wards: { poison: 3, fire: 99, frost: 0 } }))
    expect(lines).toEqual(['Troll', 'Claws: ready', '  claw 1d4+2, claw 1d4+2', 'Wards: fire 99, poison 3'])
  })
})
