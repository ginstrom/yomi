import { describe, expect, it } from 'vitest'
import { ATTRIBUTE_IDS } from './attributes.ts'
import { createWarrior } from './character.ts'
import {
  PERKS,
  PERK_IDS,
  availablePerks,
  describePerkRequirements,
  perkBonus,
  qualifiesFor,
  type Perk,
} from './perks.ts'
import { SKILL_IDS } from './skills.ts'

/** The warrior: strength 7, perception 4, endurance 7, intelligence 4, agility 6, luck 7. */
const warriorAt = (level: number) => ({ ...createWarrior(), level })

describe('PERKS', () => {
  it('gives every perk a name, a description, a rank to take and something it does', () => {
    for (const id of PERK_IDS) {
      const perk: Perk = PERKS[id]
      expect(perk.name.length * perk.description.length).toBeGreaterThan(0)
      expect(perk.ranks).toBeGreaterThanOrEqual(1)
      expect(Object.values(perk.effects).some((amount) => amount !== 0)).toBe(true)
    }
  })

  it('asks only for attributes and skills a character can have', () => {
    for (const id of PERK_IDS) {
      const perk: Perk = PERKS[id]
      for (const key of Object.keys(perk.attributes ?? {})) expect(ATTRIBUTE_IDS).toContain(key)
      for (const key of Object.keys(perk.skills ?? {})) expect(SKILL_IDS).toContain(key)
    }
  })
})

describe('qualifiesFor', () => {
  it('asks for the perk’s level', () => {
    expect(availablePerks(warriorAt(2))).toEqual([])
    expect(qualifiesFor(warriorAt(3), 'toughness')).toBe(true)
    expect(qualifiesFor(warriorAt(5), 'tireless')).toBe(false)
    expect(qualifiesFor(warriorAt(6), 'tireless')).toBe(true)
  })

  it('asks for the perk’s attributes', () => {
    const warrior = warriorAt(3)
    expect(availablePerks(warrior)).toEqual(['toughness', 'dodger', 'heavy_hand', 'keen_eye'])
    warrior.attributes.perception = 7
    expect(availablePerks(warrior)).toContain('far_shot')
  })

  it('asks for the perk’s skills', () => {
    const warrior = warriorAt(3)
    expect(qualifiesFor(warrior, 'healer')).toBe(false)
    warrior.trained.firstAid = 24
    expect(qualifiesFor(warrior, 'healer')).toBe(true)
  })

  it('offers a perk until every rank of it is taken', () => {
    const warrior = warriorAt(3)
    warrior.perks.toughness = PERKS.toughness.ranks - 1
    expect(qualifiesFor(warrior, 'toughness')).toBe(true)
    warrior.perks.toughness = PERKS.toughness.ranks
    expect(qualifiesFor(warrior, 'toughness')).toBe(false)
  })
})

describe('perkBonus', () => {
  it('adds up an effect over the ranks taken', () => {
    const warrior = createWarrior()
    expect(perkBonus(warrior, 'maxHp')).toBe(0)
    warrior.perks = { toughness: 2, dodger: 1 }
    expect(perkBonus(warrior, 'maxHp')).toBe(2 * PERKS.toughness.effects.maxHp)
    expect(perkBonus(warrior, 'armorClass')).toBe(PERKS.dodger.effects.armorClass)
    expect(perkBonus(warrior, 'critChance')).toBe(0)
  })
})

describe('describePerkRequirements', () => {
  it('lists the level, then attributes and skills', () => {
    expect(describePerkRequirements('toughness')).toBe('Level 3, Endurance 5')
    expect(describePerkRequirements('tireless')).toBe('Level 6, Endurance 6, Agility 6')
    expect(describePerkRequirements('healer')).toBe('Level 3, First Aid 50%')
  })
})
