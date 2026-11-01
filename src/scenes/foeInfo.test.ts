import { describe, expect, it } from 'vitest'
import type { UnitSnapshot } from '../engine/battleEngine.ts'
import { foeInfoLines } from './foeInfo.ts'

const unit = (extra: Partial<UnitSnapshot>) => ({ recharging: {}, ...extra }) as UnitSnapshot

describe('foeInfoLines', () => {
  it('is empty for a unit with no ability and no ward', () => {
    expect(foeInfoLines(unit({}))).toEqual([])
    expect(foeInfoLines(unit({ abilities: [], wards: { fire: 0 } }))).toEqual([])
  })

  it('lists each ability as ready or recharging, a round singular', () => {
    const spider = unit({ abilities: ['spider_bite', 'spider_web', 'fire_spit'], recharging: { spider_web: 2, fire_spit: 1, spider_bite: 0 } })
    expect(foeInfoLines(spider)).toEqual(['Bite: ready', 'Web: recharging, 2 rounds', 'Fire Spit: recharging, 1 round'])
  })

  it('then lists the wards above 0 in element order', () => {
    const lines = foeInfoLines(unit({ abilities: ['troll_claws'], wards: { poison: 3, fire: 99, frost: 0 } }))
    expect(lines).toEqual(['Claws: ready', 'Wards: fire 99, poison 3'])
  })
})
