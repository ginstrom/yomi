import { describe, expect, it } from 'vitest'
import { createWarrior } from '../character/character.ts'
import { SPELLS } from '../combat/spells.ts'
import { abilityRows } from './abilityList.ts'

const caster = (...perks: string[]) => {
  const hero = createWarrior()
  hero.attributes.intelligence = 9
  hero.trained.magic = 100
  hero.perks = Object.fromEntries(perks.map((id) => [id, 1]))
  return hero
}

describe('abilityRows', () => {
  it('lists a hero with no active as no row', () => {
    expect(abilityRows(createWarrior())).toEqual([])
  })

  it('lists each spell known with its AP and mana', () => {
    expect(abilityRows(caster('magic_arrow', 'heal'))).toEqual([
      { spell: 'magic_arrow', name: 'Magic Arrow', kind: 'spell', ap: SPELLS.magic_arrow.apCost, mana: SPELLS.magic_arrow.manaCost, recharge: null },
      { spell: 'heal', name: 'Heal', kind: 'spell', ap: SPELLS.heal.apCost, mana: SPELLS.heal.manaCost, recharge: null },
    ])
  })

  it('shows the AP a discount leaves', () => {
    const plain = abilityRows(caster('heal'))[0].ap
    const swift = abilityRows(caster('heal', 'swift_hands'))[0].ap
    expect(swift).toBe(Math.max(2, plain - 1))
    expect(swift).toBeLessThan(plain)
  })
})
