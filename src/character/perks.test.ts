import { describe, expect, it } from 'vitest'
import { SPELL_IDS } from '../combat/spells.ts'
import { ATTRIBUTE_IDS } from './attributes.ts'
import { createWarrior } from './character.ts'
import {
  PERKS,
  PERK_IDS,
  TRUNK_PERKS,
  attributeLevel,
  attributesOf,
  availablePerks,
  cappedAttribute,
  describePerkRequirements,
  knownSpells,
  missingRequirements,
  perkBonus,
  perkParent,
  qualifiesFor,
  type Perk,
} from './perks.ts'
import { takePerk } from './progression.ts'
import { SKILL_IDS, skillLevel } from './skills.ts'

/** The warrior: strength 7, perception 4, endurance 7, intelligence 4, agility 6, luck 7. */
const warriorAt = (level: number) => ({ ...createWarrior(), level })

describe('PERKS', () => {
  it('gives every perk a name, a description, a rank to take and something it does', () => {
    expect(PERK_IDS).toHaveLength(16)
    for (const id of PERK_IDS) {
      const perk: Perk = PERKS[id]
      expect(perk.name.length * perk.description.length).toBeGreaterThan(0)
      expect(perk.ranks).toBeGreaterThanOrEqual(1)
      expect(perk.spell !== undefined || Object.values(perk.effects).some((amount) => amount !== 0)).toBe(true)
    }
  })

  it('asks only for attributes and skills a character can have, and teaches only spells there are', () => {
    for (const id of PERK_IDS) {
      const perk: Perk = PERKS[id]
      for (const key of Object.keys(perk.attributes ?? {})) expect(ATTRIBUTE_IDS).toContain(key)
      for (const key of Object.keys(perk.skills ?? {})) expect(SKILL_IDS).toContain(key)
      if (perk.spell) expect(SPELL_IDS).toContain(perk.spell)
    }
    expect(JSON.stringify(PERKS)).not.toMatch(/first aid|firstAid|healer/i)
  })
})

describe('the perk tree', () => {
  it('has a branch for each attribute, with the perk that raises it as its trunk', () => {
    for (const id of ATTRIBUTE_IDS) {
      const trunk: Perk = PERKS[TRUNK_PERKS[id]]
      expect(trunk).toMatchObject({ branch: id, ranks: 2, level: 3, effects: { [id]: 1 } })
      expect(trunk.requires).toBeUndefined()
    }
    expect(new Set(Object.values(TRUNK_PERKS)).size).toBe(ATTRIBUTE_IDS.length)
  })

  it('grows a perk only from a perk of its own branch', () => {
    for (const id of PERK_IDS) {
      const parent = perkParent(id)
      if (parent === null) continue
      expect(PERK_IDS).toContain(parent)
      expect(PERKS[parent].branch).toBe(PERKS[id].branch)
    }
    expect(PERK_IDS.map((id) => [id, perkParent(id)]).filter(([, parent]) => parent)).toEqual([
      ['far_shot', 'deadly_aim'],
      ['scholar', 'quick_study'],
      ['tireless', 'toughness'],
    ])
  })

  it('has every perk but the trunks ask for its branch’s attribute or skill, or for a perk of its branch', () => {
    const trunks = Object.values(TRUNK_PERKS)
    for (const id of PERK_IDS.filter((perk) => !trunks.includes(perk))) {
      const perk: Perk = PERKS[id]
      // Magic is the one skill that starts from intelligence alone.
      const asksSkill = perk.branch === 'intelligence' && perk.skills?.magic !== undefined
      expect(perk.attributes?.[perk.branch] !== undefined || asksSkill || perkParent(id) !== null).toBe(true)
    }
  })
})

describe('qualifiesFor', () => {
  it('asks for the perk’s level', () => {
    expect(availablePerks(warriorAt(2))).toEqual([])
    expect(qualifiesFor(warriorAt(3), 'toughness')).toBe(true)
  })

  it('asks for the perk’s attributes', () => {
    const warrior = warriorAt(3)
    expect(availablePerks(warrior)).toEqual(['toughness', 'dodger', 'heavy_hand', 'keen_eye', ...Object.values(TRUNK_PERKS)])
    expect(qualifiesFor(warrior, 'deadly_aim')).toBe(false)
    warrior.attributes.perception = 6
    expect(qualifiesFor(warrior, 'deadly_aim')).toBe(true)
  })

  it('asks for the perk’s skills: Magic Arrow at Magic 50% and not at 49%', () => {
    const warrior = warriorAt(3)
    warrior.perkPicks = 1
    warrior.trained.magic = 13
    expect(skillLevel(warrior, 'magic')).toBe(49)
    expect(qualifiesFor(warrior, 'magic_arrow')).toBe(false)
    expect(takePerk(warrior, 'magic_arrow')).toBe(false)
    expect(knownSpells(warrior)).toEqual([])
    warrior.trained.magic = 14
    expect(takePerk(warrior, 'magic_arrow')).toBe(true)
    expect(knownSpells(warrior)).toEqual(['magic_arrow'])
  })

  it('asks for a rank of the perk it grows from', () => {
    const hero = warriorAt(6)
    hero.attributes = { ...hero.attributes, endurance: 6, agility: 6 }
    hero.perkPicks = 2
    expect(qualifiesFor(hero, 'tireless')).toBe(false)
    expect(takePerk(hero, 'tireless')).toBe(false)
    expect(takePerk(hero, 'toughness')).toBe(true)
    expect(takePerk(hero, 'tireless')).toBe(true)
    // The trunk is not asked for: strength 7 takes Heavy Hand without Gain Strength.
    expect(qualifiesFor(hero, 'heavy_hand')).toBe(true)
  })

  it('counts an attribute a perk has raised', () => {
    const warrior = warriorAt(3)
    warrior.attributes.perception = 5
    expect(qualifiesFor(warrior, 'deadly_aim')).toBe(false)
    warrior.perks.gain_perception = 1
    expect(qualifiesFor(warrior, 'deadly_aim')).toBe(true)
  })

  it('refuses a rank that would raise an attribute past the highest there is', () => {
    const warrior = warriorAt(3)
    warrior.attributes.intelligence = 9
    expect(qualifiesFor(warrior, 'gain_intelligence')).toBe(true)
    warrior.perks.gain_intelligence = 1
    expect(cappedAttribute(warrior, 'gain_intelligence')).toBe('intelligence')
    expect(qualifiesFor(warrior, 'gain_intelligence')).toBe(false)
    warrior.attributes.luck = 10
    warrior.perks = {}
    expect(qualifiesFor(warrior, 'gain_luck')).toBe(false)
    expect(cappedAttribute(warrior, 'keen_eye')).toBeNull()
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

describe('attributeLevel', () => {
  it('is what the character was born with and what its perks add', () => {
    const warrior = createWarrior()
    expect(attributesOf(warrior)).toEqual(warrior.attributes)
    warrior.perks = { gain_endurance: 2, gain_luck: 1 }
    expect(attributeLevel(warrior, 'endurance')).toBe(9)
    expect(attributesOf(warrior)).toEqual({ ...warrior.attributes, endurance: 9, luck: 8 })
    expect(warrior.attributes.endurance).toBe(7)
  })
})

describe('knownSpells', () => {
  it('is the spells a character’s perks teach', () => {
    const warrior = createWarrior()
    expect(knownSpells(warrior)).toEqual([])
    warrior.perks = { toughness: 1, magic_arrow: 1 }
    expect(knownSpells(warrior)).toEqual(['magic_arrow'])
  })
})

describe('describePerkRequirements', () => {
  it('lists the level, then attributes and skills, then the perk before it', () => {
    expect(describePerkRequirements('toughness')).toBe('Level 3, Endurance 5')
    expect(describePerkRequirements('tireless')).toBe('Level 6, Endurance 6, Agility 6, Toughness')
    expect(describePerkRequirements('magic_arrow')).toBe('Level 1, Magic 50%')
    expect(describePerkRequirements('gain_luck')).toBe('Level 3')
  })
})

describe('missingRequirements', () => {
  it('names exactly what the character lacks', () => {
    const hero = warriorAt(5)
    hero.attributes.agility = 5
    expect(missingRequirements(hero, 'tireless')).toEqual(['Level 6', 'Agility 6', 'Toughness'])
    hero.level = 6
    hero.perks.toughness = 1
    expect(missingRequirements(hero, 'tireless')).toEqual(['Agility 6'])
    expect(missingRequirements(hero, 'magic_arrow')).toEqual(['Magic 50%'])
    expect(missingRequirements(hero, 'heavy_hand')).toEqual([])
    // Ranks left are not its business.
    hero.perks.toughness = 2
    expect(missingRequirements(hero, 'toughness')).toEqual([])
  })
})
