import { describe, expect, it } from 'vitest'
import { createWarrior } from '../character/character.ts'
import { PERKS, PERK_IDS, perkParent, type Perk } from '../character/perks.ts'
import { newDraft, type CharacterDraft } from '../character/creation.ts'
import { TREE_IDS, pathsOf } from '../character/trees.ts'
import { draftNodeHint, nodeHint, nodeLabel, nodeState, perkTitle, tierBands, treeLayout } from './perkTree.ts'

/** The warrior: strength 7, perception 4, endurance 7, intelligence 4, agility 6, luck 7. */
const warriorAt = (level: number, perkPicks = 0) => ({ ...createWarrior(), level, perkPicks })

describe('treeLayout', () => {
  it('lays every node out once, in the tree of its path', () => {
    const all = TREE_IDS.flatMap((tree) => treeLayout(tree).map((node) => node.perk))
    expect([...all].sort()).toEqual([...PERK_IDS].sort())
    for (const tree of TREE_IDS) {
      for (const node of treeLayout(tree)) expect(pathsOf(tree)).toContain((PERKS[node.perk] as Perk).path)
    }
  })

  it('gives each path a column, 0 to 2, row 0 free for its heading, nodes from row 1 in PERKS order', () => {
    for (const tree of TREE_IDS) {
      const nodes = treeLayout(tree)
      pathsOf(tree).forEach((path, column) => {
        const own = nodes.filter((node) => node.column === column)
        expect(own.map((node) => node.perk)).toEqual(PERK_IDS.filter((id) => (PERKS[id] as Perk).path === path))
        expect(own.map((node) => node.row)).toEqual(own.map((_, i) => i + 1))
      })
      expect(nodes.every((node) => node.column >= 0 && node.column <= 2 && node.row >= 1)).toBe(true)
      expect(new Set(nodes.map((node) => `${node.column},${node.row}`)).size).toBe(nodes.length)
      for (const node of nodes) expect(node.from).toBe(perkParent(node.perk))
    }
  })

  it('places the Mage tree: Evoker, Cryomancer, Arcanist', () => {
    const mage = treeLayout('mage')
    const at = (perk: string) => mage.find((node) => node.perk === perk)
    expect(at('magic_arrow')).toEqual({ perk: 'magic_arrow', column: 0, row: 1, from: null })
    expect(at('flame_arrow')).toEqual({ perk: 'flame_arrow', column: 0, row: 3, from: 'magic_arrow' })
    expect(at('meteor')).toMatchObject({ column: 0, row: 8 })
    expect(at('frostbite')).toMatchObject({ column: 1, row: 1 })
    expect(at('mass_haste')).toMatchObject({ column: 2, row: 8 })
  })
})

describe('tierBands', () => {
  it('gives the first row of each tier present in the tree', () => {
    expect(tierBands('mage')).toEqual([
      { tier: 1, label: 'L1', firstRow: 1 },
      { tier: 2, label: 'L2', firstRow: 3 },
      { tier: 3, label: 'L6', firstRow: 5 },
      { tier: 'capstone', label: 'L12', firstRow: 8 },
    ])
    // The Warrior tree has no capstone yet; Spellsword's tier 2 is on its second row.
    expect(tierBands('warrior')).toEqual([
      { tier: 1, label: 'L1', firstRow: 1 },
      { tier: 2, label: 'L2', firstRow: 2 },
      { tier: 3, label: 'L6', firstRow: 3 },
    ])
  })
})

describe('nodeState', () => {
  it('is open for a node the character qualifies for, closed for one it does not, taken once held', () => {
    const warrior = warriorAt(1)
    expect(nodeState(warrior, 'toughness')).toBe('open')
    expect(nodeState(warrior, 'deadly_aim')).toBe('closed')
    expect(nodeState(warrior, 'evasion')).toBe('closed')
    warrior.perks.toughness = 1
    expect(nodeState(warrior, 'toughness')).toBe('taken')
  })

  it('is locked for a capstone outside the calling, or with a capstone held', () => {
    const mage = warriorAt(12)
    mage.trained.magic = 100
    mage.perks = { magic_arrow: 1, destruction: 1, shield: 1 }
    expect(nodeState(mage, 'mass_haste')).toBe('locked')
    expect(nodeHint(mage, 'mass_haste', true)).toBe('Closed: your deepest path is Evoker')
    // Meteor is closed by its depth, not locked.
    expect(nodeState(mage, 'meteor')).toBe('closed')
    mage.perks = { meteor: 1, shield: 1, arcane_study: 1, mirror_image: 1, ward: 1, haste: 1, lasting_magic: 1 }
    expect(nodeState(mage, 'mass_haste')).toBe('locked')
    expect(nodeHint(mage, 'mass_haste', true)).toBe('Closed: you hold Meteor')
    // A capstone with no node held at all is closed, not locked.
    expect(nodeState(warriorAt(12), 'meteor')).toBe('closed')
  })
})

describe('nodeLabel', () => {
  it('names a node', () => {
    const warrior = warriorAt(3)
    expect(nodeLabel(warrior, 'toughness')).toBe('Toughness')
    expect(perkTitle(warrior, 'gain_strength')).toBe('Gain Strength')
  })
})

describe('nodeHint', () => {
  it('offers an open node for a click where a pick can be spent', () => {
    expect(nodeHint(warriorAt(3, 1), 'toughness', true)).toBe('Click to take')
    expect(nodeHint(warriorAt(3, 1), 'toughness', false)).toBe('Picks are spent on the world map')
    expect(nodeHint(warriorAt(3), 'toughness', true)).toBe('No pick until level 4')
    expect(nodeHint(warriorAt(3), 'magic_arrow', true)).toBe('Not yet: Magic 40%')
  })

  it('names only what a closed node still lacks', () => {
    const hero = warriorAt(1, 1)
    expect(nodeHint(hero, 'iron_skin', true)).toBe('Not yet: Level 6, 3 nodes in Heavy Knight')
    expect(nodeHint(hero, 'fireball', true)).toBe('Not yet: Level 6, Magic 65%, Flame Arrow, 3 nodes in Evoker')
    const strong = { ...warriorAt(2, 1), perks: { weapon_training: 1 } }
    strong.attributes.strength = 9
    expect(nodeHint(strong, 'gain_strength', true)).toBe('Not yet: Strength would pass 10')
  })

  it('says a node held is taken', () => {
    const warrior = warriorAt(3, 1)
    warrior.perks.toughness = 1
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

  it('offers a node to take while a pick is left, and a node held back on a click', () => {
    expect(draftNodeHint(draft([]), 'toughness')).toBe('Click to take')
    expect(draftNodeHint(draft(['toughness']), 'toughness')).toBe('Click to give back')
    expect(draftNodeHint(draft(['toughness', 'dodger', 'deadly_aim']), 'dodger')).toBe('Click to give back')
    expect(draftNodeHint(draft(['toughness', 'dodger', 'deadly_aim']), 'marksmanship')).toBe('No picks left')
  })

  it('says why a click would do nothing', () => {
    expect(draftNodeHint(draft([]), 'heavy_hand')).toBe('Not yet: Strength 6')
    expect(draftNodeHint(draft([]), 'far_shot')).toBe('Not yet: Level 2, 1 node in Ranger')
  })
})
