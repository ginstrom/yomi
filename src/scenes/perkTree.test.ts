import { describe, expect, it } from 'vitest'
import { ATTRIBUTE_IDS } from '../character/attributes.ts'
import { createWarrior } from '../character/character.ts'
import { PERKS, PERK_IDS, TRUNK_PERKS, perkParent } from '../character/perks.ts'
import { nodeHint, nodeLabel, nodeState, perkTitle, perkTreeLayout } from './perkTree.ts'

/** The warrior: strength 7, perception 4, endurance 7, intelligence 4, agility 6, luck 7. */
const warriorAt = (level: number, perkPicks = 0) => ({ ...createWarrior(), level, perkPicks })

describe('perkTreeLayout', () => {
  const nodes = perkTreeLayout()
  const at = (perk: string) => nodes.find((node) => node.perk === perk)!

  it('places every perk once, no two on one cell', () => {
    expect(nodes.map((node) => node.perk).sort()).toEqual([...PERK_IDS].sort())
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
      ['gain_perception', 0, 1],
      ['deadly_aim', 1, 1],
      ['far_shot', 2, 1],
      ['gain_endurance', 0, 2],
      ['toughness', 1, 2],
      ['tireless', 2, 2],
      ['gain_intelligence', 0, 3],
      ['quick_study', 1, 3],
      ['scholar', 2, 3],
      ['magic_arrow', 1, 4],
      ['gain_agility', 0, 5],
      ['dodger', 1, 5],
      ['gain_luck', 0, 6],
      ['keen_eye', 1, 6],
    ])
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
    // Before a pick ever comes, nothing but a spell it has the skill for is open.
    expect(PERK_IDS.filter((id) => nodeState(warriorAt(1), id) !== 'closed')).toEqual([])
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
    expect(nodeHint(hero, 'tireless', true)).toBe('Not yet: Toughness')
    hero.attributes.agility = 5
    expect(nodeHint(hero, 'tireless', false)).toBe('Not yet: Agility 6, Toughness')
    expect(nodeHint(warriorAt(1), 'toughness', true)).toBe('Not yet: Level 3')
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
