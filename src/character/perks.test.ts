import { describe, expect, it } from 'vitest'
import { MONSTER_SPELL_IDS, SPELLS, SPELL_IDS } from '../combat/spells.ts'
import { createWarrior } from './character.ts'
import {
  PERKS,
  PERK_IDS,
  attributeLevel,
  attributesOf,
  availablePerks,
  cappedAttribute,
  describePerkRequirements,
  knownAbilities,
  knownSpells,
  missingRequirements,
  nodeKind,
  perkBonus,
  perkLevel,
  perkParent,
  perkRanks,
  perkTeaching,
  qualifiesFor,
  type Perk,
  type PerkId,
} from './perks.ts'
import type { AbilityId } from '../combat/abilities.ts'
import { takePerk } from './progression.ts'
import { SKILL_IDS, skillLevel } from './skills.ts'
import { PATHS } from './trees.ts'

/** The warrior: strength 7, perception 4, endurance 7, intelligence 4, agility 6, luck 7. */
const warriorAt = (level: number) => ({ ...createWarrior(), level })

describe('PERKS', () => {
  it('teaches every hero spell from exactly one node, and no monster spell', () => {
    for (const spell of SPELL_IDS) {
      const node = perkTeaching(spell)
      expect(node, spell).not.toBeNull()
      expect(PERK_IDS.filter((id) => (PERKS[id] as Perk).spell === spell)).toEqual([node])
    }
    for (const spell of MONSTER_SPELL_IDS) expect(PERK_IDS.some((id) => (PERKS[id] as Perk).spell === (spell as string))).toBe(false)
  })

  it('names each spell node by its spell, with its mana and AP', () => {
    for (const spell of SPELL_IDS) {
      const node: Perk = PERKS[perkTeaching(spell)!]
      expect(node.name).toBe(SPELLS[spell].name)
      expect(node.description).toBe(`${SPELLS[spell].description}; ${SPELLS[spell].manaCost} mana, ${SPELLS[spell].apCost} AP`)
      expect(node.effects).toEqual({})
    }
  })

  it('asks a node it requires only of its own path', () => {
    for (const id of PERK_IDS) {
      const parent = perkParent(id)
      if (parent) expect((PERKS[parent] as Perk).path).toBe((PERKS[id] as Perk).path)
    }
  })

  it('gives each node its tier’s level', () => {
    expect([perkLevel('dodger'), perkLevel('far_shot'), perkLevel('evasion'), perkLevel('deadeye')]).toEqual([1, 2, 6, 12])
  })
})

/**
 * Runs `fn` with `taught` standing in for the techniques no node teaches yet
 * (step 13 adds them): each node of `PERKS` named there teaches that ability
 * for the while, and is put back after.
 */
function teaching(taught: Partial<Record<PerkId, AbilityId>>, fn: () => void): void {
  const nodes = Object.keys(taught) as PerkId[]
  for (const node of nodes) (PERKS[node] as Perk).ability = taught[node]
  try {
    fn()
  } finally {
    for (const node of nodes) delete (PERKS[node] as Perk).ability
  }
}

describe('nodeKind', () => {
  it('is a spell for a node that teaches one, else a passive', () => {
    expect(nodeKind('magic_arrow')).toBe('spell')
    expect(nodeKind('curse')).toBe('spell')
    expect(nodeKind('dodger')).toBe('passive')
    expect(nodeKind('deadeye')).toBe('passive')
  })

  it('is a mana active for a node whose ability costs mana, and an at-will one for any other ability', () => {
    teaching({ dodger: 'sprint', keen_eye: 'pin' }, () => {
      expect(nodeKind('dodger')).toBe('at-will')
      expect(nodeKind('keen_eye')).toBe('mana')
    })
    expect(nodeKind('dodger')).toBe('passive')
  })
})

describe('knownAbilities', () => {
  it('teaches no node an ability yet', () => {
    expect(PERK_IDS.filter((id) => (PERKS[id] as Perk).ability !== undefined)).toEqual([])
    expect(knownAbilities({ ...createWarrior(), perks: { dodger: 1, toughness: 1 } })).toEqual([])
  })

  it('gives the abilities of the nodes held, in ABILITY_IDS order, once each', () => {
    teaching({ dodger: 'sprint', keen_eye: 'power_attack', toughness: 'sprint', heavy_hand: 'smite' }, () => {
      const hero = { ...createWarrior(), perks: { dodger: 1, keen_eye: 1, toughness: 1 } }
      expect(knownAbilities(hero)).toEqual(['power_attack', 'sprint'])
    })
  })
})

describe('perkTeaching', () => {
  it('names the node of a spell', () => {
    expect([perkTeaching('heal'), perkTeaching('web'), perkTeaching('meteor')]).toEqual(['heal', 'web', 'meteor'])
  })
})

describe('qualifiesFor', () => {
  it('asks the tier’s level: a new character may take only the first tier’s nodes', () => {
    const offered = availablePerks(warriorAt(1))
    expect(offered.every((id) => (PERKS[id] as Perk).tier === 1)).toBe(true)
    // Strength 7, endurance 7, intelligence 4, agility 6, luck 7 and Melee Weapons 33.
    expect(offered).toEqual(['weapon_training', 'heavy_hand', 'toughness', 'shield_wall', 'arcane_blood', 'dodger', 'keen_eye', 'bless'])
    const swordsman = { ...warriorAt(1), perks: { weapon_training: 1 } }
    expect(missingRequirements(swordsman, 'armor_breaker')).toEqual(['Level 2'])
    expect(qualifiesFor({ ...swordsman, level: 2 }, 'armor_breaker')).toBe(true)
  })

  it('asks the tier’s depth: nodes already held in the node’s own path', () => {
    const warrior = warriorAt(2)
    expect(missingRequirements(warrior, 'armor_breaker')).toEqual(['1 node in Swordmaster'])
    // A node of another path does not count.
    warrior.perks = { toughness: 1 }
    expect(qualifiesFor(warrior, 'armor_breaker')).toBe(false)
    warrior.perks = { heavy_hand: 1 }
    expect(qualifiesFor(warrior, 'armor_breaker')).toBe(true)
    const knight = { ...warriorAt(6), perks: { toughness: 1, shield_wall: 1 } }
    expect(missingRequirements(knight, 'iron_skin')).toEqual(['3 nodes in Heavy Knight'])
  })

  it('asks the node’s attributes, counting what a node has raised', () => {
    const warrior = warriorAt(2)
    expect(missingRequirements(warrior, 'deadly_aim')).toEqual(['Perception 6'])
    warrior.attributes.perception = 5
    warrior.perks = { marksmanship: 1, far_shot: 1 }
    expect(qualifiesFor(warrior, 'deadly_aim')).toBe(true)
  })

  it('asks the node’s skills: Magic Arrow at Magic 40% and not at 39%', () => {
    const warrior = warriorAt(1)
    warrior.perkPicks = 1
    warrior.trained.magic = 31
    expect(skillLevel(warrior, 'magic')).toBe(39)
    expect(missingRequirements(warrior, 'magic_arrow')).toEqual(['Magic 40%'])
    expect(takePerk(warrior, 'magic_arrow')).toBe(false)
    warrior.trained.magic = 32
    expect(takePerk(warrior, 'magic_arrow')).toBe(true)
    expect(knownSpells(warrior)).toEqual(['magic_arrow'])
  })

  it('asks any one of several skills, worded "Melee 40% or Magic 40%"', () => {
    const archer = warriorAt(2)
    archer.tagged = ['archery']
    archer.perks = { bless: 1 }
    expect(skillLevel(archer, 'melee')).toBeLessThan(40)
    expect(missingRequirements(archer, 'lay_on_hands')).toEqual(['Melee 40% or Magic 40%'])
    expect(describePerkRequirements('lay_on_hands')).toBe('Level 2, Melee 40% or Magic 40%, 1 node in Paladin')
    archer.trained.magic = 32
    expect(qualifiesFor(archer, 'lay_on_hands')).toBe(true)
  })

  it('asks the node it requires, named, before the depth', () => {
    const mage = warriorAt(2)
    mage.trained.magic = 47
    mage.perks = { destruction: 1 }
    expect(missingRequirements(mage, 'flame_arrow')).toEqual(['Magic Arrow'])
    mage.perks = { magic_arrow: 1 }
    expect(qualifiesFor(mage, 'flame_arrow')).toBe(true)
    expect(describePerkRequirements('fireball')).toBe('Level 6, Magic 65%, Flame Arrow, 3 nodes in Evoker')
  })

  it('words the asks in order: level, attributes, skills, the node required, depth', () => {
    expect(missingRequirements(warriorAt(1), 'weapon_mastery')).toEqual(['Level 6', 'Strength 8', '3 nodes in Swordmaster'])
    expect(missingRequirements(warriorAt(1), 'fireball')).toEqual(['Level 6', 'Magic 65%', 'Flame Arrow', '3 nodes in Evoker'])
  })

  it('opens a capstone only in the calling and only while no capstone is held', () => {
    const archer = warriorAt(12)
    archer.trained.archery = 60
    archer.perks = { marksmanship: 1, deadly_aim: 1, dodger: 1, skirmisher: 1, evasion: 1, keen_eye: 1 }
    expect(missingRequirements(archer, 'deadeye')).toEqual(['5 nodes in Ranger', 'Ranger must be your deepest path'])
    expect(describePerkRequirements('deadeye')).toBe(
      'Level 12, Archery 70%, 5 nodes in Ranger, Ranger must be your deepest path, Only one capstone',
    )
    archer.perks = { meteor: 1 }
    expect(missingRequirements(archer, 'deadeye')).toContain('Only one capstone')
  })

  it('never offers a node held: every node has one rank', () => {
    const warrior = warriorAt(1)
    expect(qualifiesFor(warrior, 'toughness')).toBe(true)
    warrior.perks.toughness = 1
    expect(qualifiesFor(warrior, 'toughness')).toBe(false)
    expect(perkRanks(warrior, 'toughness')).toBe(1)
  })

  it('refuses Gain Strength to one whose Strength is above 8, as it would pass 10', () => {
    const warrior = { ...warriorAt(2), perks: { weapon_training: 1 } }
    warrior.attributes.strength = 8
    expect(cappedAttribute(warrior, 'gain_strength')).toBeNull()
    expect(qualifiesFor(warrior, 'gain_strength')).toBe(true)
    warrior.attributes.strength = 9
    expect(cappedAttribute(warrior, 'gain_strength')).toBe('strength')
    expect(qualifiesFor(warrior, 'gain_strength')).toBe(false)
    // A node that raises an attribute beside its own effect is never refused for it.
    warrior.attributes.endurance = 10
    expect(cappedAttribute(warrior, 'toughness')).toBeNull()
  })

  it('gates taking a node, never keeping it', () => {
    const warrior = warriorAt(1)
    warrior.perks = { deadly_aim: 1 }
    expect(qualifiesFor({ ...warrior, perks: {} }, 'deadly_aim')).toBe(false)
    // Held without its asks met, it still counts.
    expect(perkBonus(warrior, 'rangedDamage')).toBe(2)
  })
})

describe('perkBonus', () => {
  it('adds up an effect over the nodes held', () => {
    const warrior = createWarrior()
    expect(perkBonus(warrior, 'maxHp')).toBe(0)
    warrior.perks = { toughness: 1, dodger: 1, evasion: 1 }
    expect(perkBonus(warrior, 'maxHp')).toBe(8)
    expect(perkBonus(warrior, 'armorClass')).toBe(20)
    expect(perkBonus(warrior, 'critChance')).toBe(0)
  })
})

describe('a skill node', () => {
  it('adds 10% to its skill and to no other', () => {
    const warrior = createWarrior()
    const before = SKILL_IDS.map((id) => skillLevel(warrior, id))
    warrior.perks = { weapon_training: 1, marksmanship: 1 }
    expect(SKILL_IDS.map((id) => skillLevel(warrior, id))).toEqual([before[0] + 10, before[1] + 10, before[2]])
    for (const id of ['weapon_training', 'marksmanship', 'arcane_study'] as const) {
      expect(PERKS[id]).toMatchObject({ tier: 1, effects: { [SKILL_IDS[['weapon_training', 'marksmanship', 'arcane_study'].indexOf(id)]]: 10 } })
    }
  })
})

describe('attributeLevel', () => {
  it('is what the character was born with and what its nodes add, never past 10', () => {
    const warrior = createWarrior()
    expect(attributesOf(warrior)).toEqual(warrior.attributes)
    warrior.perks = { toughness: 1, fortune: 1 }
    expect(attributeLevel(warrior, 'endurance')).toBe(8)
    expect(attributesOf(warrior)).toEqual({ ...warrior.attributes, endurance: 8, luck: 8 })
    expect(warrior.attributes.endurance).toBe(7)
    warrior.attributes.endurance = 10
    expect(attributeLevel(warrior, 'endurance')).toBe(10)
  })
})

describe('the paths', () => {
  it('give every node a path there is', () => {
    for (const id of PERK_IDS) expect(PATHS[(PERKS[id] as Perk).path]).toBeDefined()
  })
})
