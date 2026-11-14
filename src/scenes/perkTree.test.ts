import { describe, expect, it } from 'vitest'
import { createWarrior, deriveCombatStats } from '../character/character.ts'
import { SPELLS, spellApCost } from '../combat/spells.ts'
import { PERKS, PERK_IDS, describePerkRequirements, perkParent, type Perk } from '../character/perks.ts'
import { newDraft, type CharacterDraft } from '../character/creation.ts'
import { TREE_IDS, pathsOf } from '../character/trees.ts'
import {
  KIND_LEGEND,
  LEGEND_Y,
  NODE_H,
  NODE_W,
  STRIP_CHARS,
  STRIP_HINT_LINES,
  TREE_COLUMN_W,
  TREE_ROWS,
  TREE_STRIP_Y,
  TREE_TAB_Y,
  TREE_W,
  TREE_X,
  TREE_Y,
  bandRects,
  clampLines,
  columnX,
  legendLayout,
  linkTone,
  linkToneOf,
  treeLinks,
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
const warriorAt = (level: number, perkPoints = 0) => ({ ...createWarrior(), level, perkPoints })

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
        expect(x).toBe(TREE_X + node.column * TREE_COLUMN_W + 12)
        expect(width).toBe(196)
        expect(x).toBeGreaterThanOrEqual(columnX(node.column) + 10)
        expect(x + width).toBeLessThanOrEqual(TREE_W)
        expect(y + height).toBeLessThan(TREE_STRIP_Y)
      }
    }
    expect(TREE_STRIP_Y + 64).toBeLessThanOrEqual(500)
    // Every line, the brackets' lanes right of the last column among them, stays inside the panel too.
    const xs = TREE_IDS.flatMap((tree) => treeLinks(tree).flatMap((link) => link.points.map((point) => point.x)))
    expect(Math.max(...xs)).toBeLessThan(720 - 8)
  })
})

describe('bandRects', () => {
  it('runs each tier band from over its first row to over the next, the last to under the last row, without gaps', () => {
    for (const tree of TREE_IDS) {
      const bands = bandRects(tree)
      expect(bands.map(({ label }) => label)).toEqual(tierBands(tree).map(({ label }) => label))
      bands.slice(1).forEach((band, i) => expect(band.y).toBe(bands[i].y + bands[i].height))
      for (const node of treeLayout(tree)) {
        const { y } = nodeRect(node)
        const band = bands.find((b) => b.tier === (PERKS[node.perk] as Perk).tier)!
        expect(y).toBeGreaterThanOrEqual(band.y)
        expect(y + NODE_H).toBeLessThanOrEqual(band.y + band.height)
      }
      const last = bands[bands.length - 1]
      expect(last.y + last.height).toBeLessThan(TREE_STRIP_Y)
    }
  })
})

describe('treeLinks', () => {
  const inside = (p: { x: number; y: number }, r: ReturnType<typeof nodeRect>) => p.x > r.x && p.x < r.x + r.width && p.y > r.y && p.y < r.y + r.height

  it('runs a trunk down each column, under the heading and into every node of the path in turn', () => {
    for (const tree of TREE_IDS) {
      const nodes = treeLayout(tree)
      const trunks = treeLinks(tree).filter((link) => link.kind === 'trunk')
      expect(trunks.map((link) => link.to).sort()).toEqual(nodes.map((node) => node.perk).sort())
      for (const link of trunks) {
        const node = nodes.find((n) => n.perk === link.to)!
        const rect = nodeRect(node)
        const [start, bend, end] = link.points
        // Down the gutter, then right into the node's left edge at its middle.
        expect(start.x).toBe(bend.x)
        expect(bend.x).toBeGreaterThan(columnX(node.column))
        expect(bend.x).toBeLessThan(rect.x)
        expect(end).toEqual({ x: rect.x, y: rect.y + NODE_H / 2 })
        expect(start.y).toBeGreaterThanOrEqual(TREE_Y + 20)
      }
      // Each stretch begins where the one before it in the column ended.
      for (let column = 0; column < 3; column++) {
        const stretch = trunks.filter((link) => nodes.find((n) => n.perk === link.to)!.column === column)
        stretch.slice(1).forEach((link, i) => expect(link.points[0].y).toBe(stretch[i].points[1].y))
      }
    }
  })

  it('hangs a node from the node it requires by a bracket on the right, crossing no node', () => {
    const links = treeLinks('mage').filter((link) => link.kind === 'requires')
    expect(links.map((link) => link.to).sort()).toEqual(['acid_arrow', 'fireball', 'flame_arrow', 'frost_blast'])
    for (const tree of TREE_IDS) {
      const nodes = treeLayout(tree)
      for (const link of treeLinks(tree).filter((l) => l.kind === 'requires')) {
        const node = nodes.find((n) => n.perk === link.to)!
        const parent = nodes.find((n) => n.perk === perkParent(link.to))!
        const [start, , , end] = link.points
        expect(start).toEqual({ x: nodeRect(parent).x + NODE_W, y: nodeRect(parent).y + NODE_H / 2 })
        expect(end).toEqual({ x: nodeRect(node).x + NODE_W, y: nodeRect(node).y + NODE_H / 2 })
        // The lane lies between this column's nodes and the next column's trunk.
        const lane = link.points[1].x
        expect(lane).toBeGreaterThan(nodeRect(node).x + NODE_W)
        expect(lane).toBeLessThan(columnX(node.column + 1) + 5 - 4)
        for (const other of nodes) for (const point of link.points) expect(inside(point, nodeRect(other))).toBe(false)
      }
    }
  })

  it('nests brackets whose rows meet, the shorter span inside, so that none crosses another', () => {
    for (const tree of TREE_IDS) {
      const links = treeLinks(tree).filter((link) => link.kind === 'requires')
      const span = (link: (typeof links)[number]) => [Math.min(link.points[0].y, link.points[3].y), Math.max(link.points[0].y, link.points[3].y)]
      for (const a of links) {
        for (const b of links) {
          // Only two parents' brackets in one column.
          if (a.from === b.from || a.points[0].x !== b.points[0].x) continue
          const [aTop, aBottom] = span(a)
          const [bTop, bBottom] = span(b)
          if (aTop > bBottom || bTop > aBottom) continue
          expect(a.points[1].x).not.toBe(b.points[1].x)
        }
      }
    }
    // Magic Arrow's bracket (rows 1 to 3) lies inside Flame Arrow's (rows 3 to 6).
    const mage = treeLinks('mage').filter((link) => link.kind === 'requires')
    const lane = (perk: string) => mage.find((link) => link.to === perk)!.points[1].x
    expect(lane('flame_arrow')).toBeLessThan(lane('fireball'))
    // Heal All's short bracket to Greater Heal All lies inside Heal's, which reaches down to Heal All.
    const cleric = treeLinks('cleric').filter((link) => link.kind === 'requires')
    const clericLane = (perk: string) => cleric.find((link) => link.to === perk)!.points[1].x
    expect(clericLane('greater_heal_all')).toBeLessThan(clericLane('heal_all'))
  })

  it("lets no two brackets cross: no bracket's arm runs through another's upright", () => {
    type Segment = { a: { x: number; y: number }; b: { x: number; y: number } }
    const segments = (points: readonly { x: number; y: number }[]): Segment[] => points.slice(1).map((b, i) => ({ a: points[i], b }))
    const between = (v: number, p: number, q: number) => Math.min(p, q) < v && v < Math.max(p, q)
    let pairs = 0
    for (const tree of TREE_IDS) {
      const links = treeLinks(tree).filter((link) => link.kind === 'requires')
      for (const one of links) {
        for (const other of links) {
          if (one.from === other.from) continue
          pairs++
          for (const arm of segments(one.points).filter((s) => s.a.y === s.b.y)) {
            for (const upright of segments(other.points).filter((s) => s.a.x === s.b.x)) {
              const crosses = between(upright.a.x, arm.a.x, arm.b.x) && between(arm.a.y, upright.a.y, upright.b.y)
              expect(crosses, `${tree}: ${one.from}→${one.to} crosses ${other.from}→${other.to}`).toBe(false)
            }
          }
        }
      }
    }
    // Brackets of different parents there are, so the check checked something.
    expect(pairs).toBeGreaterThan(0)
  })

  it('gives brackets of different parents whose rows meet lanes of their own', () => {
    // Heal's bracket reaches down to Heal All, from which Greater Heal All hangs.
    const links = treeLinks('cleric').filter((link) => link.kind === 'requires')
    const lane = (perk: string) => links.find((link) => link.to === perk)!.points[1].x
    expect(lane('greater_heal')).toBe(lane('heal_all'))
    expect(lane('greater_heal_all')).not.toBe(lane('heal_all'))
  })
})

describe('linkTone', () => {
  it('lights a line into a node taken, brightens one into a node open, and dims the rest', () => {
    expect(linkTone('taken')).toBe('lit')
    expect(linkTone('open')).toBe('open')
    expect(linkTone('closed')).toBe('dim')
    expect(linkTone('locked')).toBe('dim')
  })
})

describe('linkToneOf', () => {
  const states = (taken: string[], open: string[] = []) => (perk: string) => (taken.includes(perk) ? 'taken' : open.includes(perk) ? 'open' : 'closed') as 'taken' | 'open' | 'closed'
  const trunkInto = (perk: string) => treeLinks('warrior').find((link) => link.kind === 'trunk' && link.to === perk)!

  it('lights a trunk stretch only when the nodes at both ends are taken', () => {
    // Shield Wall under Toughness: taken under one not taken, the stretch between is no lit line.
    expect(trunkInto('shield_wall').from).toBe('toughness')
    expect(linkToneOf(trunkInto('shield_wall'), states(['shield_wall'], ['toughness']))).toBe('open')
    expect(linkToneOf(trunkInto('shield_wall'), states(['shield_wall']))).toBe('open')
    expect(linkToneOf(trunkInto('shield_wall'), states(['shield_wall', 'toughness']))).toBe('lit')
    // The stretch from the heading into the first node is lit by that node alone.
    expect(trunkInto('toughness').from).toBeNull()
    expect(linkToneOf(trunkInto('toughness'), states(['toughness']))).toBe('lit')
  })

  it('tones every other line by the node it leads into', () => {
    expect(linkToneOf(trunkInto('shield_wall'), states([], ['shield_wall']))).toBe('open')
    expect(linkToneOf(trunkInto('shield_wall'), states(['toughness']))).toBe('dim')
    const bracket = treeLinks('mage').find((link) => link.kind === 'requires' && link.to === 'flame_arrow')!
    expect(bracket.from).toBe('magic_arrow')
    expect(linkToneOf(bracket, states(['flame_arrow']))).toBe('lit')
  })
})

describe('legendLayout', () => {
  it('names the four kinds in a row between the tabs and the headings, inside the tree', () => {
    const entries = legendLayout()
    expect(entries.map(({ kind }) => kind)).toEqual(KIND_LEGEND.map(({ kind }) => kind))
    expect(new Set(entries.map(({ kind }) => kind)).size).toBe(4)
    entries.slice(1).forEach((entry, i) => expect(entry.x).toBeGreaterThan(entries[i].right))
    expect(entries[0].x).toBe(TREE_X)
    expect(entries[entries.length - 1].right).toBeLessThan(TREE_W / 2)
    expect(LEGEND_Y - 5).toBeGreaterThanOrEqual(TREE_TAB_Y + 11 + 3)
    expect(LEGEND_Y + 5).toBeLessThanOrEqual(TREE_Y + 6)
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
  it('offers an open node it can afford for a click where perk points can be spent', () => {
    expect(nodeHint(warriorAt(3, 1), 'toughness', true)).toBe('Click to take (1 of your 1 perk point)')
    expect(nodeHint(warriorAt(3, 4), 'toughness', true)).toBe('Click to take (1 of your 4 perk points)')
    expect(nodeHint({ ...warriorAt(3, 4), perks: { toughness: 1 } }, 'taunt', true)).toBe('Click to take (2 of your 4 perk points)')
    expect(nodeHint(warriorAt(3, 1), 'toughness', false)).toBe('Perk points are spent on the world map')
    expect(nodeHint(warriorAt(3), 'magic_arrow', true)).toBe('Not yet: Magic 40%')
  })

  it('says how many perk points an open node needs and the level saving alone reaches it', () => {
    expect(nodeHint(warriorAt(3), 'toughness', true)).toBe('Needs 1 perk point; you have 0 (level 4)')
    const knight = { ...warriorAt(9, 1), perks: { toughness: 1, rooted: 1, taunt: 1 } }
    knight.trained.melee = 40
    expect(nodeHint(knight, 'pin', true)).toBe('Needs 3 perk points; you have 1 (level 11)')
    expect(nodeHint(knight, 'pin', false)).toBe('Perk points are spent on the world map')
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

  it('offers a node to take while a perk point is left, and a node held back on a click', () => {
    expect(draftNodeHint(draft([]), 'toughness')).toBe('Click to take')
    expect(draftNodeHint(draft(['toughness']), 'toughness')).toBe('Click to give back')
    expect(draftNodeHint(draft(['toughness', 'dodger', 'deadly_aim']), 'dodger')).toBe('Click to give back')
    expect(draftNodeHint(draft(['toughness', 'dodger', 'deadly_aim']), 'marksmanship')).toBe('No perk points left')
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

  it('on a tie between deepest paths, open on the tree that holds the most nodes', () => {
    // Swordmaster, Ranger and Rogue one node each: the Scout tree holds two.
    expect(openingTree({ perks: { weapon_training: 1, marksmanship: 1, dodger: 1 } })).toBe('scout')
    // Swordmaster 2 and Ranger 2, with a Rogue node: Scout again, though Swordmaster comes first.
    expect(openingTree({ perks: { weapon_training: 1, power_attack: 1, marksmanship: 1, deadly_aim: 1, dodger: 1 } })).toBe('scout')
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

  it('wraps a long "Not yet:" onto a second line rather than cutting it', () => {
    expect(STRIP_HINT_LINES).toBe(2)
    const hint = nodeHint({ ...warriorAt(1), perkPoints: 1 }, 'blademaster', true)
    expect(wrapLines(hint).length).toBe(2)
    expect(clampLines(hint, STRIP_HINT_LINES)).toBe(hint)
  })

  it('stays inside the 500 px panel for the longest node: summary, asks and hint', () => {
    const hero = { ...warriorAt(1), perkPoints: 1 }
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
