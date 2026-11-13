import { describe, expect, it } from 'vitest'
import { createWarrior, deriveCombatStats } from '../character/character.ts'
import { SPELLS, spellApCost } from '../combat/spells.ts'
import { PERKS, PERK_IDS, describePerkRequirements, perkParent, type Perk } from '../character/perks.ts'
import { newDraft, type CharacterDraft } from '../character/creation.ts'
import { TREE_IDS, pathsOf } from '../character/trees.ts'
import {
  STRIP_CHARS,
  STRIP_HINT_LINES,
  TREE_ROWS,
  TREE_STRIP_Y,
  TREE_X,
  clampLines,
  costWords,
  draftNodeClickable,
  draftNodeHint,
  nodeHint,
  nodeLabel,
  nodeRect,
  nodeState,
  nodeSummary,
  openingTree,
  pathHeading,
  perkTitle,
  tierBands,
  treeForKey,
  treeLayout,
  treeTabLabel,
  treeTabRect,
  wrapLines,
} from './perkTree.ts'

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
        const own = nodes.filter((node) => node.column === column).sort((a, b) => a.row - b.row)
        expect(own.map((node) => node.perk)).toEqual(PERK_IDS.filter((id) => (PERKS[id] as Perk).path === path))
      })
      expect(nodes.every((node) => node.column >= 0 && node.column <= 2 && node.row >= 1 && node.row < TREE_ROWS)).toBe(true)
      expect(new Set(nodes.map((node) => `${node.column},${node.row}`)).size).toBe(nodes.length)
      for (const node of nodes) expect(node.from).toBe(perkParent(node.perk))
    }
  })

  it('begins each tier on the same row in every column, so the bands run straight across', () => {
    for (const tree of TREE_IDS) {
      const bands = tierBands(tree)
      for (const node of treeLayout(tree)) {
        const band = bands.findIndex(({ tier }) => tier === (PERKS[node.perk] as Perk).tier)
        expect(node.row).toBeGreaterThanOrEqual(bands[band].firstRow)
        if (band + 1 < bands.length) expect(node.row).toBeLessThan(bands[band + 1].firstRow)
      }
    }
  })

  it('places the Mage tree: Evoker, Cryomancer, Arcanist', () => {
    const mage = treeLayout('mage')
    const at = (perk: string) => mage.find((node) => node.perk === perk)
    expect(at('magic_arrow')).toEqual({ perk: 'magic_arrow', column: 0, row: 1, from: null })
    expect(at('flame_arrow')).toEqual({ perk: 'flame_arrow', column: 0, row: 3, from: 'magic_arrow' })
    expect(at('meteor')).toMatchObject({ column: 0, row: 8 })
    expect(at('frostbite')).toMatchObject({ column: 1, row: 1 })
    expect(at('ice_lance')).toMatchObject({ column: 1, row: 6 })
    expect(at('lingering_cold')).toMatchObject({ column: 1, row: 7 })
    expect(at('glacial_prison')).toMatchObject({ column: 1, row: 8 })
    expect(at('mass_haste')).toMatchObject({ column: 2, row: 8 })
  })

  it('leaves a row empty in a column short of a tier: the Scout tree', () => {
    const scout = treeLayout('scout')
    const at = (perk: string) => scout.find((node) => node.perk === perk)
    // Ranger has three tier-2 nodes, Rogue two and Assassin two; the tier-3 band starts at the sixth row, the capstones' at the ninth.
    expect(at('aimed_shot')).toMatchObject({ column: 0, row: 3 })
    expect(at('hunters_mark')).toMatchObject({ column: 0, row: 5 })
    expect(at('skirmisher')).toMatchObject({ column: 1, row: 3 })
    expect(at('dirty_trick')).toMatchObject({ column: 1, row: 4 })
    expect(at('tumble')).toMatchObject({ column: 1, row: 6 })
    expect(at('evasion')).toMatchObject({ column: 1, row: 7 })
    expect(at('fortune')).toMatchObject({ column: 2, row: 6 })
    expect(at('executioner')).toMatchObject({ column: 2, row: 8 })
    expect(at('deadeye')).toMatchObject({ column: 0, row: 9 })
    expect(at('deathblow')).toMatchObject({ column: 2, row: 9 })
  })

  it('fits every node within the 720 px panel, in rows above the strip', () => {
    for (const tree of TREE_IDS) {
      for (const node of treeLayout(tree)) {
        const { x, y, width, height } = nodeRect(node)
        expect(x).toBe(TREE_X + node.column * 226)
        expect(width).toBe(214)
        expect(x + width).toBeLessThanOrEqual(720)
        expect(y + height).toBeLessThan(TREE_STRIP_Y)
      }
    }
    expect(TREE_STRIP_Y + 64).toBeLessThanOrEqual(500)
  })
})

describe('tierBands', () => {
  it('gives the first row of each tier present in the tree, in tier order', () => {
    expect(tierBands('mage')).toEqual([
      { tier: 1, label: 'L1', firstRow: 1 },
      { tier: 2, label: 'L2', firstRow: 3 },
      { tier: 3, label: 'L6', firstRow: 5 },
      { tier: 'capstone', label: 'L12', firstRow: 8 },
    ])
    // Swordmaster's three tier-2 nodes make the band three rows, and Heavy Knight's three tier-3 nodes that band three.
    expect(tierBands('warrior')).toEqual([
      { tier: 1, label: 'L1', firstRow: 1 },
      { tier: 2, label: 'L2', firstRow: 3 },
      { tier: 3, label: 'L6', firstRow: 6 },
      { tier: 'capstone', label: 'L12', firstRow: 9 },
    ])
    for (const tree of TREE_IDS) {
      const labels = tierBands(tree).map(({ label }) => label)
      expect(labels).toEqual(['L1', 'L2', 'L6', 'L12'].filter((label) => labels.includes(label as 'L1')))
    }
  })
})

describe('pathHeading', () => {
  it('names the path with the nodes held in it, the calling marked', () => {
    const hero = { ...warriorAt(2), perks: { weapon_training: 1, heavy_hand: 1, toughness: 1 } }
    expect(pathHeading(hero, 'swordmaster')).toEqual({ text: 'Swordmaster  2', calling: true })
    expect(pathHeading(hero, 'heavy_knight')).toEqual({ text: 'Heavy Knight  1', calling: false })
    expect(pathHeading(warriorAt(1), 'spellsword')).toEqual({ text: 'Spellsword  0', calling: false })
  })
})

describe('nodeSummary', () => {
  it('gives a passive its path, kind and effect', () => {
    expect(nodeSummary(warriorAt(1), 'toughness')).toBe(`Toughness (Heavy Knight, passive): ${PERKS.toughness.description}`)
  })

  it('gives a spell its mana and the AP it costs the character', () => {
    const { manaCost, apCost, description } = SPELLS.heal
    expect(nodeSummary(warriorAt(1), 'heal')).toBe(`Heal (Healer, spell): ${manaCost} mana, ${apCost} AP. ${description}`)
    // Swift Hands takes AP off a heal.
    const quick = { ...warriorAt(6), perks: { heal: 1, swift_hands: 1 } }
    expect(nodeSummary(quick, 'heal')).toContain(`${manaCost} mana, ${spellApCost(deriveCombatStats(quick), 'heal')} AP.`)
    expect(spellApCost(deriveCombatStats(quick), 'heal')).toBeLessThan(apCost)
  })

  it('marks a capstone', () => {
    expect(nodeSummary(warriorAt(1), 'meteor')).toMatch(/^Meteor \(Evoker, spell, capstone\): \d+ mana, \d+ AP\. /)
    expect(nodeSummary(warriorAt(1), 'deadeye')).toBe(`Deadeye (Ranger, passive, capstone): ${PERKS.deadeye.description}`)
  })
})

describe('costWords', () => {
  it('words an active\'s cost, a weapon-relative AP worked out for the weapon held', () => {
    expect(costWords('taunt', { attackApCost: 5 })).toBe('3 AP')
    expect(costWords('pin', { attackApCost: 5 })).toBe('3 mana, 6 AP (weapon + 1)')
    expect(costWords('pin', { attackApCost: 3 })).toBe('3 mana, 4 AP (weapon + 1)')
    expect(costWords('power_attack', { attackApCost: 4 })).toBe('6 AP (weapon + 2)')
  })

  it("words an Arcane Knight's Spellsword Strike at the weapon's own cost", () => {
    expect(costWords('flame_strike', { attackApCost: 4 })).toBe('3 mana, 5 AP (weapon + 1)')
    expect(costWords('flame_strike', { attackApCost: 4, traits: ['arcane_knight'] })).toBe('3 mana, 4 AP (weapon + 0)')
  })
})

describe('draftNodeClickable', () => {
  const draft = (perks: CharacterDraft['perks']): CharacterDraft => ({
    ...newDraft(),
    attributes: { strength: 4, perception: 7, endurance: 5, intelligence: 7, agility: 7, luck: 5 },
    tagged: 'archery',
    perks,
  })

  it('answers a click on a tier-1 node only, to take it or give it back', () => {
    expect(draftNodeClickable(draft([]), 'toughness')).toBe(true)
    expect(draftNodeClickable(draft(['toughness']), 'toughness')).toBe(true)
    expect(draftNodeClickable(draft([]), 'far_shot')).toBe(false)
    expect(draftNodeClickable(draft([]), 'heavy_hand')).toBe(false)
    expect(draftNodeClickable(draft(['toughness', 'dodger', 'deadly_aim']), 'marksmanship')).toBe(false)
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
    // A tie for deepest names every path.
    mage.perks = { magic_arrow: 1, shield: 1, heal: 1 }
    expect(nodeHint(mage, 'deadeye', true)).toBe('Closed: your deepest paths are Evoker, Arcanist and Healer')
    mage.perks = { magic_arrow: 1, destruction: 1, shield: 1 }
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

describe('the tree tabs', () => {
  it('sit left to right over the tree, apart, each labelled with the nodes held in its tree', () => {
    const rects = TREE_IDS.map(treeTabRect)
    rects.slice(1).forEach((rect, i) => expect(rect.x - rect.width / 2).toBeGreaterThan(rects[i].x + rects[i].width / 2))
    expect(rects[0].x - rects[0].width / 2).toBe(TREE_X)
    const hero = { ...warriorAt(2), perks: { weapon_training: 1, toughness: 1, heal: 1 } }
    expect(TREE_IDS.map((tree) => treeTabLabel(hero, tree))).toEqual(['Warrior 2', 'Scout', 'Mage', 'Cleric 1'])
  })

  it('answer the keys 1 to 4', () => {
    expect(['1', '2', '3', '4'].map(treeForKey)).toEqual([...TREE_IDS])
    expect(['0', '5', 'a', ''].map(treeForKey)).toEqual([null, null, null, null])
  })

  it('open on the tree of the calling, else the Warrior tree', () => {
    expect(openingTree(warriorAt(1))).toBe('warrior')
    expect(openingTree({ perks: { heal: 1, bless: 1, mending: 1, dodger: 1 } })).toBe('cleric')
    expect(openingTree({ perks: { dodger: 1, heal: 1 } })).toBe('scout')
  })
})

describe('the 95 nodes', () => {
  it('place one to a cell, per tree as the plan counts them', () => {
    const counts = Object.fromEntries(TREE_IDS.map((tree) => [tree, treeLayout(tree).length]))
    expect(counts).toEqual({ warrior: 23, scout: 24, mage: 24, cleric: 24 })
    expect(Object.values(counts).reduce((a, b) => a + b, 0)).toBe(PERK_IDS.length)
  })
})

describe('the strip', () => {
  it('cuts a long summary to two lines with an ellipsis, and leaves a short one alone', () => {
    expect(clampLines('Short words')).toBe('Short words')
    const long = 'word '.repeat(80).trim()
    const clamped = clampLines(long)
    expect(clamped.endsWith('…')).toBe(true)
    expect(wrapLines(clamped)).toHaveLength(2)
  })

  it('stays inside the 500 px panel for the longest node: summary, asks and hint', () => {
    const hero = { ...warriorAt(1), perkPicks: 1 }
    let longest = 0
    for (const id of PERK_IDS) {
      const summary = clampLines(nodeSummary(hero, id))
      const lines =
        wrapLines(summary).length +
        wrapLines(`Asks: ${describePerkRequirements(id)}`).length +
        wrapLines(clampLines(nodeHint(hero, id, true), STRIP_HINT_LINES)).length
      longest = Math.max(longest, lines)
    }
    expect(STRIP_CHARS).toBeLessThanOrEqual(92)
    // A 12 px monospace line is about 15 px.
    expect(TREE_STRIP_Y + longest * 15).toBeLessThanOrEqual(500)
  })
})
