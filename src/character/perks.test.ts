import { describe, expect, it } from 'vitest'
import { MONSTER_SPELL_IDS, SPELLS, SPELL_IDS } from '../combat/spells.ts'
import { createWarrior, deriveCombatStats } from './character.ts'
import { SPARK_WAND, YEW_BOW } from '../inventory/inventory.ts'
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
  traitsOf,
  qualifiesFor,
  type Perk,
  type PerkId,
} from './perks.ts'
import { ABILITIES, type AbilityId } from '../combat/abilities.ts'
import type { TraitId } from '../combat/combat.ts'
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
  it('teaches the 17 techniques, each from its place in its path, with the tier and asks of the plan', () => {
    const table: Array<[PerkId, string, Perk['tier'], Partial<Pick<Perk, 'attributes' | 'skills' | 'anySkill'>>]> = [
      ['power_attack', 'swordmaster', 2, { skills: { melee: 40 } }],
      ['cleave', 'swordmaster', 3, { skills: { melee: 55 } }],
      ['taunt', 'heavy_knight', 2, { attributes: { endurance: 5 } }],
      ['pin', 'heavy_knight', 3, { skills: { melee: 55 } }],
      ['flame_strike', 'spellsword', 1, { skills: { melee: 30 } }],
      ['frost_strike', 'spellsword', 2, { skills: { melee: 40 } }],
      ['thunder_strike', 'spellsword', 3, { skills: { melee: 55 } }],
      ['aimed_shot', 'ranger', 2, { skills: { archery: 40 } }],
      ['hunters_mark', 'ranger', 2, { skills: { archery: 40 } }],
      ['volley', 'ranger', 3, { skills: { archery: 55 } }],
      ['pinning_shot', 'ranger', 3, { skills: { archery: 55 } }],
      ['sprint', 'rogue', 1, { attributes: { agility: 5 } }],
      ['dirty_trick', 'rogue', 2, { skills: { melee: 40 } }],
      ['venom_strike', 'assassin', 2, { anySkill: { melee: 40, archery: 40 } }],
      ['hamstring', 'assassin', 2, { anySkill: { melee: 40, archery: 40 } }],
      ['smite', 'paladin', 1, { skills: { melee: 30 } }],
      ['consecrate', 'paladin', 3, { skills: { melee: 55 } }],
    ]
    expect(PERK_IDS).toHaveLength(95)
    for (const [id, path, tier, asks] of table) {
      const node = PERKS[id] as Perk
      expect(node).toMatchObject({ path, tier, ability: id, effects: {}, ...asks })
      expect(node.description.length).toBeGreaterThan(0)
    }
    expect(PERK_IDS.filter((id) => (PERKS[id] as Perk).ability !== undefined)).toHaveLength(17)
    expect(knownAbilities({ ...createWarrior(), perks: { dodger: 1, toughness: 1 } })).toEqual([])
  })

  it('sets the nodes in their paths in the plan\'s order', () => {
    const path = (p: string) => PERK_IDS.filter((id) => (PERKS[id] as Perk).path === p)
    expect(path('swordmaster')).toEqual(['weapon_training', 'heavy_hand', 'power_attack', 'armor_breaker', 'gain_strength', 'cleave', 'weapon_mastery', 'blademaster'])
    expect(path('heavy_knight')).toEqual(['toughness', 'shield_wall', 'taunt', 'rooted', 'pin', 'iron_skin', 'guardian', 'unbreakable'])
    expect(path('spellsword')).toEqual(['arcane_blood', 'flame_strike', 'frost_strike', 'spell_ward', 'thunder_strike', 'battle_mage', 'arcane_knight'])
    expect(path('ranger')).toEqual(['marksmanship', 'deadly_aim', 'aimed_shot', 'far_shot', 'hunters_mark', 'volley', 'pinning_shot', 'deadeye'])
    expect(path('rogue')).toEqual(['dodger', 'sprint', 'skirmisher', 'dirty_trick', 'tumble', 'evasion', 'counter', 'shadowdancer'])
    expect(path('assassin')).toEqual(['keen_eye', 'backstab', 'venom_strike', 'hamstring', 'fortune', 'ambush', 'executioner', 'deathblow'])
    expect(path('paladin')).toEqual(['bless', 'smite', 'lay_on_hands', 'blessed_armour', 'aura_of_courage', 'consecrate', 'sacred_weapon', 'aegis'])
  })

  it('words a technique with its cost', () => {
    expect(PERKS.pin.description).toBe(`3 mana, weapon AP + 1, recharge 1. ${ABILITIES.pin.description}`)
    expect(PERKS.taunt.description).toMatch(/^3 AP, recharge 2\. /)
  })

  it('lists a hero\'s techniques in ABILITY_IDS order', () => {
    const hero = { ...createWarrior(), perks: { sprint: 1, power_attack: 1, smite: 1 } }
    expect(knownAbilities(hero)).toEqual(['power_attack', 'sprint', 'smite'])
  })

  it('gives the abilities of the nodes held, in ABILITY_IDS order, once each', () => {
    teaching({ dodger: 'sprint', keen_eye: 'power_attack', toughness: 'sprint', heavy_hand: 'smite' }, () => {
      const hero = { ...createWarrior(), perks: { dodger: 1, keen_eye: 1, toughness: 1 } }
      expect(knownAbilities(hero)).toEqual(['power_attack', 'sprint'])
    })
  })
})

describe('traitsOf', () => {
  /** Lends nodes a trait for the while, as step 13's nodes will have it. */
  const giving = (given: Partial<Record<PerkId, TraitId>>, fn: () => void): void => {
    const nodes = Object.keys(given) as PerkId[]
    for (const node of nodes) (PERKS[node] as Perk).trait = given[node]
    try {
      fn()
    } finally {
      for (const node of nodes) delete (PERKS[node] as Perk).trait
    }
  }

  it('gives each trait to the one node of design 4.3 that teaches it', () => {
    const traits = Object.fromEntries(PERK_IDS.flatMap((id) => ((PERKS[id] as Perk).trait ? [[id, (PERKS[id] as Perk).trait]] : [])))
    expect(traits).toEqual({
      blademaster: 'blademaster',
      rooted: 'rooted',
      guardian: 'guardian',
      unbreakable: 'unbreakable',
      arcane_knight: 'arcane_knight',
      deadeye: 'deadeye',
      tumble: 'tumble',
      counter: 'counter',
      shadowdancer: 'shadowdancer',
      ambush: 'ambush',
      deathblow: 'deathblow',
      aura_of_courage: 'courage',
      aegis: 'aegis',
      sanctuary: 'sanctuary',
    })
    expect(traitsOf({ ...createWarrior(), perks: { toughness: 1 } })).toEqual([])
    expect(traitsOf({ ...createWarrior(), perks: { rooted: 1 } })).toEqual(['rooted'])
  })

  it('says Rooted lasts until the unit moves or the end of its next turn, as the engine lays it', () => {
    expect(PERKS.rooted.description).toMatch(/until it moves or the end of its next turn$/)
  })

  it('gives the traits of the nodes held, in TRAIT_IDS order, once each', () => {
    giving({ dodger: 'tumble', toughness: 'rooted', shield_wall: 'rooted', keen_eye: 'counter' }, () => {
      expect(traitsOf({ ...createWarrior(), perks: { dodger: 1, toughness: 1, shield_wall: 1 } })).toEqual(['rooted', 'tumble'])
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
    expect(offered).toEqual(['weapon_training', 'heavy_hand', 'toughness', 'shield_wall', 'arcane_blood', 'flame_strike', 'dodger', 'sprint', 'keen_eye', 'backstab', 'bless', 'smite'])
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

describe('the stage-3 nodes (skill trees step 21)', () => {
  const table: Array<[PerkId, Perk['path'], Perk['tier'], Partial<Perk>]> = [
    ['blademaster', 'swordmaster', 'capstone', { skills: { melee: 70 }, trait: 'blademaster' }],
    ['guardian', 'heavy_knight', 3, { attributes: { endurance: 7 }, trait: 'guardian' }],
    ['unbreakable', 'heavy_knight', 'capstone', { attributes: { endurance: 8 }, trait: 'unbreakable' }],
    ['arcane_knight', 'spellsword', 'capstone', { skills: { melee: 70 }, trait: 'arcane_knight', meleeOnHit: [{ damage: 4, element: 'fire' }] }],
    ['tumble', 'rogue', 3, { attributes: { agility: 7 }, trait: 'tumble' }],
    ['counter', 'rogue', 3, { skills: { melee: 55 }, trait: 'counter' }],
    ['shadowdancer', 'rogue', 'capstone', { attributes: { agility: 8 }, trait: 'shadowdancer' }],
    ['backstab', 'assassin', 1, { anySkill: { melee: 30, archery: 30 }, effects: { rearToHit: 15, rearDamage: 4 } }],
    ['ambush', 'assassin', 3, { attributes: { agility: 6 }, trait: 'ambush' }],
    ['executioner', 'assassin', 3, { anySkill: { melee: 55, archery: 55 }, effects: { executeDamage: 5 } }],
    ['deathblow', 'assassin', 'capstone', { anySkill: { melee: 70, archery: 70 }, trait: 'deathblow' }],
    ['ice_lance', 'cryomancer', 3, { skills: { magic: 70 }, spell: 'ice_lance' }],
    ['glacial_prison', 'cryomancer', 'capstone', { skills: { magic: 80 }, spell: 'glacial_prison' }],
    ['purify', 'healer', 3, { skills: { magic: 55 }, spell: 'purify' }],
    ['revive', 'healer', 'capstone', { skills: { magic: 75 }, spell: 'revive' }],
    ['aura_of_courage', 'paladin', 3, { skills: { melee: 55 }, trait: 'courage' }],
    ['aegis', 'paladin', 'capstone', { skills: { melee: 70 }, trait: 'aegis' }],
    ['renew', 'saint', 3, { skills: { magic: 65 }, spell: 'renew' }],
    ['holy_light', 'saint', 3, { skills: { magic: 70 }, spell: 'holy_light' }],
    ['sanctuary', 'saint', 'capstone', { skills: { magic: 80 }, trait: 'sanctuary' }],
  ]

  it('are the twenty of design 4.3, with their tiers, asks and what they switch on', () => {
    expect(table).toHaveLength(20)
    for (const [id, path, tier, fields] of table) {
      const node = PERKS[id] as Perk
      expect(node, id).toMatchObject({ path, tier, ...fields })
      expect(node.requires, id).toBeUndefined()
      expect(node.description.length, id).toBeGreaterThan(0)
    }
  })

  it('are passives but for the six spells', () => {
    for (const [id, , , fields] of table) expect(nodeKind(id), id).toBe(fields.spell ? 'spell' : 'passive')
    expect(table.filter(([id]) => nodeKind(id) === 'spell')).toHaveLength(6)
  })
})

describe('the partial nodes, completed (step 21)', () => {
  const holding = (...nodes: PerkId[]) => ({ ...createWarrior(), perks: Object.fromEntries(nodes.map((id) => [id, 1])) })

  it('give their full numbers in combat', () => {
    expect(deriveCombatStats(holding('iron_skin')).opportunity).toEqual({ toHit: 15, damage: 3 })
    expect(deriveCombatStats(holding('battle_mage')).manaOnHit).toBe(1)
    expect(deriveCombatStats(holding('skirmisher')).movedToHit).toBe(10)
    expect(deriveCombatStats(holding('fortune')).critDamage).toBe(4)
    expect(deriveCombatStats(holding('deadeye')).traits).toContain('deadeye')
    expect(deriveCombatStats(holding('serenity')).manaRegen).toBe(2)
  })

  it('keep their stage-1 effects', () => {
    expect(PERKS.iron_skin.effects).toMatchObject({ resistance: 2 })
    expect(PERKS.battle_mage.effects).toMatchObject({ maxMana: 6, imbueDamage: 2 })
    expect(PERKS.skirmisher.effects).toMatchObject({ agility: 1 })
    expect(PERKS.fortune.effects).toMatchObject({ critChance: 10, luck: 1 })
    expect(PERKS.deadeye.effects).toEqual({ archery: 10 })
    expect(PERKS.serenity.effects).toMatchObject({ friendlyRange: 2 })
  })

  it('say everything they now do', () => {
    expect(PERKS.iron_skin.description).toMatch(/free attacks get \+15 to hit and \+3 damage/)
    expect(PERKS.battle_mage.description).toMatch(/restores 1 mana/)
    expect(PERKS.skirmisher.description).toMatch(/\+10 to hit/)
    expect(PERKS.fortune.description).toMatch(/critical hits deal 4 more damage/)
    expect(PERKS.deadeye.description).toMatch(/pierce 3 points of resistance.*triple dice/)
    expect(PERKS.serenity.description).toMatch(/Regains 2 mana/)
  })

  it('give Arcane Knight its 4 fire on a hit only while the main hand is melee or bare', () => {
    const knight = holding('arcane_knight')
    expect(deriveCombatStats(knight).onHit).toEqual([{ damage: 4, element: 'fire' }])
    expect(deriveCombatStats(knight).traits).toEqual(['arcane_knight'])
    delete knight.equipment.mainHand
    expect(deriveCombatStats(knight).onHit).toEqual([{ damage: 4, element: 'fire' }])
    delete knight.equipment.offHand
    knight.equipment.mainHand = YEW_BOW
    expect(deriveCombatStats(knight).onHit).toBeUndefined()
    knight.equipment.mainHand = SPARK_WAND
    expect(deriveCombatStats(knight).onHit).toBeUndefined()
  })
})

describe('the paths', () => {
  it('give every node a path there is', () => {
    for (const id of PERK_IDS) expect(PATHS[(PERKS[id] as Perk).path]).toBeDefined()
  })
})
