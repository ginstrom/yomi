import { describe, expect, it } from 'vitest'
import { ATTRIBUTE_IDS } from '../character/attributes.ts'
import { createWarrior } from '../character/character.ts'
import { PERKS, PERK_IDS, SPELL_PERK_IDS, TRUNK_PERKS, isSpellPerk, perkParent } from '../character/perks.ts'
import { newDraft, type CharacterDraft } from '../character/creation.ts'
import { draftNodeHint, nodeHint, nodeLabel, nodeState, perkTitle, perkTreeLayout } from './perkTree.ts'

/** The warrior: strength 7, perception 4, endurance 7, intelligence 4, agility 6, luck 7. */
const warriorAt = (level: number, perkPicks = 0) => ({ ...createWarrior(), level, perkPicks })

describe('perkTreeLayout', () => {
  const nodes = perkTreeLayout()
  const at = (perk: string) => nodes.find((node) => node.perk === perk)!

  it('places every perk but the spells once, no two on one cell', () => {
    expect(nodes.map((node) => node.perk).sort()).toEqual(PERK_IDS.filter((id) => !isSpellPerk(id)).sort())
    expect(new Set(nodes.map((node) => `${node.column},${node.row}`)).size).toBe(nodes.length)
  })

  it('puts the trunks down the first column in the order of the attributes', () => {
    const trunks = nodes.filter((node) => node.column === 0).sort((a, b) => a.row - b.row)
    expect(trunks.map((node) => node.perk)).toEqual(ATTRIBUTE_IDS.map((id) => TRUNK_PERKS[id]))
    expect(trunks.every((node) => node.from === null)).toBe(true)
  })

  it('puts a perk one column out from the node its line comes from, in its branch', () => {
    for (const node of nodes.filter((n) => n.from !== null)) {
      const from = at(node.from!)
      expect(node.column).toBe(from.column + 1)
      expect(PERKS[from.perk].branch).toBe(PERKS[node.perk].branch)
      expect(node.from).toBe(perkParent(node.perk) ?? TRUNK_PERKS[PERKS[node.perk].branch])
    }
  })

  it('gives each tip of a branch a row, and a perk the row of the first that grows from it', () => {
    expect(nodes.map((node) => [node.perk, node.column, node.row])).toEqual([
      ['gain_strength', 0, 0],
      ['heavy_hand', 1, 0],
      ['mighty_blow', 2, 0],
      ['weapon_training', 1, 1],
      ['weapon_mastery', 2, 1],
      ['armor_breaker', 1, 2],
      ['sunder', 2, 2],
      ['gain_perception', 0, 3],
      ['deadly_aim', 1, 3],
      ['far_shot', 2, 3],
      ['marksmanship', 1, 4],
      ['eagle_eye', 2, 4],
      ['gain_endurance', 0, 5],
      ['toughness', 1, 5],
      ['tireless', 2, 5],
      ['gain_intelligence', 0, 6],
      ['quick_study', 1, 6],
      ['scholar', 2, 6],
      ['spellcasting', 1, 7],
      ['deep_well', 2, 7],
      ['arcane_study', 1, 8],
      ['arcane_mastery', 2, 8],
      ['gain_agility', 0, 9],
      ['dodger', 1, 9],
      ['evasion', 2, 9],
      ['gain_luck', 0, 10],
      ['keen_eye', 1, 10],
      ['fortune', 2, 10],
    ])
  })
})

describe('perkTreeLayout of the spells (A2)', () => {
  const nodes = perkTreeLayout('spells')

  it('places every spell once, in three columns and nine rows, no two on one cell', () => {
    expect(nodes.map((node) => node.perk).sort()).toEqual([...SPELL_PERK_IDS].sort())
    expect(new Set(nodes.map((node) => `${node.column},${node.row}`)).size).toBe(nodes.length)
    expect(Math.max(...nodes.map((node) => node.column))).toBe(2)
    expect(Math.max(...nodes.map((node) => node.row))).toBe(8)
  })

  it('keeps each school’s rows together, offence, then healing, then support', () => {
    expect(nodes.map((node) => [node.perk, node.column, node.row])).toEqual([
      ['magic_arrow', 0, 0],
      ['flame_arrow', 1, 0],
      ['fireball', 2, 0],
      ['acid_arrow', 2, 1],
      ['sleep', 1, 2],
      ['death_cloud', 2, 2],
      ['frost_blast', 1, 3],
      ['heal', 0, 4],
      ['greater_heal', 1, 4],
      ['heal_all', 1, 5],
      ['greater_heal_all', 2, 5],
      ['shield', 0, 6],
      ['mirror_image', 1, 6],
      ['protect', 0, 7],
      ['haste', 1, 7],
      ['bless', 0, 8],
      ['bane', 1, 8],
    ])
  })

  it('speaks of spell picks on a spell’s node', () => {
    const mage = warriorAt(1)
    mage.trained.magic = 40
    mage.perks = { spellcasting: 1 }
    expect(nodeHint(mage, 'heal', true)).toBe('No spell to choose until level 2')
    mage.spellPicks = 1
    expect(nodeHint(mage, 'heal', true)).toBe('Click to take')
    expect(nodeHint(mage, 'heal', false)).toBe('Spells are chosen on the world map')
    expect(nodeHint(mage, 'fireball', true)).toBe('Not yet: Level 5, Magic 70%, Flame Arrow')
  })
})

describe('nodeState', () => {
  it('is open for a perk the character qualifies for, closed for one it does not, taken with every rank', () => {
    const warrior = warriorAt(3)
    expect(nodeState(warrior, 'toughness')).toBe('open')
    expect(nodeState(warrior, 'deadly_aim')).toBe('closed')
    expect(nodeState(warrior, 'tireless')).toBe('closed')
    warrior.perks.toughness = 1
    expect(nodeState(warrior, 'toughness')).toBe('open')
    warrior.perks.toughness = 2
    expect(nodeState(warrior, 'toughness')).toBe('taken')
    // A new character's picks are for the perks of level 1: the trunks open at level 3.
    expect(PERK_IDS.filter((id) => nodeState(warriorAt(1), id) !== 'closed')).toEqual([
      'toughness',
      'dodger',
      'heavy_hand',
      'keen_eye',
      'weapon_training',
      'armor_breaker',
    ])
  })
})

describe('nodeLabel', () => {
  it('names a perk, with its ranks when it has more than one', () => {
    const warrior = warriorAt(3)
    warrior.perks.toughness = 1
    expect(nodeLabel(warrior, 'toughness')).toBe('Toughness 1/2')
    expect(nodeLabel(warrior, 'heavy_hand')).toBe('Heavy Hand 0/2')
    expect(nodeLabel(warrior, 'far_shot')).toBe('Far Shot')
    expect(perkTitle(warrior, 'gain_strength')).toBe('Gain Strength 0/2')
  })

  it('shows a trunk as its attribute and the value it stands at, with the ranks once one is taken', () => {
    const warrior = warriorAt(3)
    expect(nodeLabel(warrior, 'gain_strength')).toBe('Strength 7')
    warrior.perks.gain_strength = 1
    expect(nodeLabel(warrior, 'gain_strength')).toBe('Strength 8 1/2')
  })
})

describe('nodeHint', () => {
  it('offers an open perk for a click where a pick can be spent', () => {
    expect(nodeHint(warriorAt(3, 1), 'toughness', true)).toBe('Click to take')
    expect(nodeHint(warriorAt(3, 1), 'toughness', false)).toBe('Perks are chosen on the world map')
    expect(nodeHint(warriorAt(3), 'toughness', true)).toBe('No perk to choose until level 6')
    expect(nodeHint(warriorAt(3), 'toughness', false)).toBe('Perks are chosen on the world map')
  })

  it('names only what a closed perk still lacks', () => {
    const hero = warriorAt(6, 1)
    hero.attributes.endurance = 8
    expect(nodeHint(hero, 'tireless', true)).toBe('Not yet: Toughness')
    hero.attributes.agility = 5
    expect(nodeHint(hero, 'tireless', false)).toBe('Not yet: Agility 6, Toughness')
    expect(nodeHint(warriorAt(1), 'gain_strength', true)).toBe('Not yet: Level 3')
    hero.attributes.luck = 10
    expect(nodeHint(hero, 'gain_luck', true)).toBe('Not yet: Luck is as high as it goes')
  })

  it('says a perk with every rank is taken', () => {
    const warrior = warriorAt(3, 1)
    warrior.perks.toughness = 2
    expect(nodeHint(warrior, 'toughness', true)).toBe('Taken')
    expect(nodeHint(warrior, 'toughness', false)).toBe('Taken')
  })
})

describe('draftNodeHint', () => {
  const draft = (perks: CharacterDraft['perks']): CharacterDraft => ({
    ...newDraft(),
    attributes: { strength: 4, perception: 7, endurance: 5, intelligence: 7, agility: 7, luck: 5 },
    tagged: 'archery',
    perks,
  })

  it('offers a rank to take while a pick is left, and the last rank back when none is', () => {
    expect(draftNodeHint(draft([]), 'toughness')).toBe('Click to take')
    expect(draftNodeHint(draft(['toughness']), 'toughness')).toBe('Click to take')
    expect(draftNodeHint(draft(['toughness', 'toughness']), 'toughness')).toBe('Click to give back')
    expect(draftNodeHint(draft(['toughness', 'dodger', 'deadly_aim']), 'dodger')).toBe('Click to give back')
    expect(draftNodeHint(draft(['toughness', 'dodger', 'deadly_aim']), 'marksmanship')).toBe('No picks left')
  })

  it('says why a click would do nothing', () => {
    expect(draftNodeHint(draft([]), 'heavy_hand')).toBe('Not yet: Strength 6')
    expect(draftNodeHint(draft([]), 'gain_luck')).toBe('Not yet: Level 3')
    expect(draftNodeHint(draft(['deadly_aim', 'far_shot', 'dodger']), 'deadly_aim')).toBe('Far Shot asks for Deadly Aim')
  })
})
