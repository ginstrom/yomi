import { ATTRIBUTES, MAX_ATTRIBUTE } from '../character/attributes.ts'
import { deriveCombatStats, type Character } from '../character/character.ts'
import { ABILITIES, abilityApCost, type AbilityId } from '../combat/abilities.ts'
import type { CombatantStats } from '../combat/combat.ts'
import { SPELLS, spellApCost } from '../combat/spells.ts'
import { draftCharacter, perkPointsLeft, togglePerk, type CharacterDraft } from '../character/creation.ts'
import {
  PERKS,
  PERK_IDS,
  availablePerks,
  cappedAttribute,
  describePerkRequirements,
  missingRequirements,
  nodeKind,
  perkCost,
  perkParent,
  type NodeKind,
  perkRanks,
  qualifiesFor,
  type Perk,
  type PerkId,
} from '../character/perks.ts'
import { affordableAt, canAffordPerk, waitsOnlyForLevel } from '../character/progression.ts'
import type { Point } from './boardGeometry.ts'
import { PATHS, TIERS, TREES, TREE_IDS, calling, capstoneOf, pathDepth, pathsOf, treeNodes, type PathId, type Tier, type TreeId } from '../character/trees.ts'

/**
 * The skill trees as the character panel and creation draw them: where each
 * node sits and how it stands for a character. A tree has a column for each
 * of its three paths (`pathsOf`), row 0 for the path's heading and its nodes
 * from row 1 down in `PERKS` order, which is by tier. Each tier begins on the
 * same row in all three columns (a tier's rows are as many as the most any
 * of the tree's paths has of it), so the tier bands run straight across the
 * tree; a new node takes its place without a change here.
 */

/**
 * Where the view draws a tree, in its container's own pixels: three columns,
 * the path headings on row 0. Each column has its path's trunk down its left
 * gutter (`TRUNK_INSET` in), its nodes `NODE_INSET` in, and the lines from a
 * node required to the nodes requiring it in the lanes to their right; the
 * tier labels sit in the gutter left of the first column.
 */
export const TREE_X = 28
export const TREE_Y = 104
export const TREE_COLUMN_W = 224
export const TRUNK_INSET = 5
export const NODE_INSET = 12
export const TREE_ROW_H = 30
export const NODE_W = 196
export const NODE_H = 26
/** The px of a node's label area reserved at its right inner edge for the cost digit (or the mark); the label is centred in what is left. */
export const NODE_COST_W = 14
/** The coloured tab at a node's left edge, with its kind's glyph. */
export const KIND_TAB_W = 18
/** The rows the view keeps for a tree, the headings' included, so that the strip sits in one place under any. */
export const TREE_ROWS = 10
/** The strip under the tree: the node pointed at, what it asks and what a click would do. */
export const TREE_STRIP_Y = TREE_Y + TREE_ROWS * TREE_ROW_H + 4
/** How far the tree reaches across: the last column's nodes' right edge. */
export const TREE_W = TREE_X + 2 * TREE_COLUMN_W + NODE_INSET + NODE_W
/** The lanes of the lines from a node required, right of the nodes: the first this far out, each next one `LANE_PITCH` further. */
const LANE_GAP = 4
const LANE_PITCH = 5

/** The strip's lines hold this many characters: its width over the monospace 12px glyph's 7.2 px, less a little for safety. */
export const STRIP_CHARS = 90
/** The strip's first line, the node's summary, runs to at most this many lines, so that the strip stays inside the panel. */
export const STRIP_SUMMARY_LINES = 2
/** The strip's last line, what a click would do or what is missing ("Not yet: …"), runs to at most two lines, which the strip has room for under the longest node's summary and asks. */
export const STRIP_HINT_LINES = 2

/** The lines `text` wraps onto at `width` characters, breaking at spaces (a longer word has a line of its own). */
export function wrapLines(text: string, width: number = STRIP_CHARS): string[] {
  const lines: string[] = []
  let line = ''
  for (const word of text.split(' ')) {
    if (line !== '' && line.length + 1 + word.length > width) {
      lines.push(line)
      line = word
    } else {
      line = line === '' ? word : `${line} ${word}`
    }
  }
  lines.push(line)
  return lines
}

/** `text` cut to `maxLines` lines of `width` characters, with an ellipsis where it was cut. */
export function clampLines(text: string, maxLines: number = STRIP_SUMMARY_LINES, width: number = STRIP_CHARS): string {
  const lines = wrapLines(text, width)
  if (lines.length <= maxLines) return text
  const kept = lines.slice(0, maxLines)
  let last = kept[maxLines - 1]
  while (last.length + 1 > width) last = last.slice(0, last.lastIndexOf(' '))
  kept[maxLines - 1] = `${last}…`
  return kept.join(' ')
}

/** A node's top left corner and size, in the container's own pixels. */
export function nodeRect({ column, row }: Pick<TreeNode, 'column' | 'row'>): { x: number; y: number; width: number; height: number } {
  return { x: columnX(column) + NODE_INSET, y: TREE_Y + row * TREE_ROW_H, width: NODE_W, height: NODE_H }
}

/** A column's left edge, where its heading begins. */
export function columnX(column: number): number {
  return TREE_X + column * TREE_COLUMN_W
}

export interface TreeNode {
  perk: PerkId
  /** Its path's place within the tree, 0 to 2. */
  column: number
  /** 1 and down; row 0 is the path's heading. */
  row: number
  /** The node it requires (`perkParent`), whose line it hangs from; null for none. */
  from: PerkId | null
}

/** Every node of `tree`, a column a path, each tier from its band's first row (`tierRows`). */
export function treeLayout(tree: TreeId): TreeNode[] {
  const first = tierRows(tree)
  return pathsOf(tree).flatMap((path, column) => {
    const nodes = nodesOf(path)
    return nodes.map((perk) => {
      const { tier }: Perk = PERKS[perk]
      const before = nodes.filter((other) => (PERKS[other] as Perk).tier === tier && nodes.indexOf(other) < nodes.indexOf(perk)).length
      return { perk, column, row: first.get(tier)! + before, from: perkParent(perk) }
    })
  })
}

/** The first row of each tier present in `tree`: tier 1 from row 1, each next tier under the tallest column of the one before. */
function tierRows(tree: TreeId): Map<Tier, number> {
  const paths = pathsOf(tree).map(nodesOf)
  const rows = new Map<Tier, number>()
  let row = 1
  for (const tier of TIER_ORDER) {
    const tallest = Math.max(...paths.map((nodes) => nodes.filter((perk) => (PERKS[perk] as Perk).tier === tier).length))
    if (tallest === 0) continue
    rows.set(tier, row)
    row += tallest
  }
  return rows
}

/** `path`'s nodes in `PERKS` order. */
function nodesOf(path: PathId): PerkId[] {
  return PERK_IDS.filter((id) => (PERKS[id] as Perk).path === path)
}

const TIER_ORDER: readonly Tier[] = [1, 2, 3, 'capstone']

/**
 * The tiers present in `tree` with the row each begins on in every column,
 * for the bands the view draws: "L1", "L2", "L6", "L12".
 */
export function tierBands(tree: TreeId): { tier: Tier; label: 'L1' | 'L2' | 'L6' | 'L12'; firstRow: number }[] {
  return [...tierRows(tree)].map(([tier, firstRow]) => ({ tier, label: `L${TIERS[tier].level}` as 'L1' | 'L2' | 'L6' | 'L12', firstRow }))
}

/**
 * Each tier's band across the tree, in pixels: from just over its first row
 * to just over the next tier's (the last to just under the tree's last row),
 * for the view's shading, rule and label.
 */
export function bandRects(tree: TreeId): { tier: Tier; label: string; y: number; height: number }[] {
  const bands = tierBands(tree)
  const lastRow = Math.max(...treeLayout(tree).map((node) => node.row))
  const top = (row: number) => TREE_Y + row * TREE_ROW_H - (TREE_ROW_H - NODE_H) / 2
  return bands.map(({ tier, label, firstRow }, i) => {
    const y = top(firstRow)
    const end = i + 1 < bands.length ? top(bands[i + 1].firstRow) : top(lastRow + 1)
    return { tier, label, y, height: end - y }
  })
}

/** A line of the tree: one of a path's trunk, into a node's left edge, or from the node it requires into its right edge. */
export interface TreeLink {
  kind: 'trunk' | 'requires'
  /** The node the line leads from: the one above on the trunk (null for the stretch from the heading), or the one required. */
  from: PerkId | null
  /** The node the line leads into, whose standing sets its tone (`linkToneOf`). */
  to: PerkId
  points: Point[]
}

/**
 * The tree's lines. Each path has a trunk down its column's left gutter, from
 * under its heading through every node in turn, a short branch into each, so
 * that progression reads top to bottom; the stretch leading into a node is
 * that node's. A node that requires another (`perkParent`) hangs from it by a
 * bracket on the right. The brackets from one parent share a lane, and each
 * parent's brackets take the innermost lane free of every other parent's whose
 * rows they meet, the shortest span first, so that brackets nest and never cross.
 */
export function treeLinks(tree: TreeId): TreeLink[] {
  const nodes = treeLayout(tree)
  const middle = (node: TreeNode) => nodeRect(node).y + NODE_H / 2
  const links: TreeLink[] = []
  for (let column = 0; column < pathsOf(tree).length; column++) {
    const trunk = columnX(column) + TRUNK_INSET
    let from = TREE_Y + NODE_H
    let above: PerkId | null = null
    for (const node of nodes.filter((n) => n.column === column).sort((a, b) => a.row - b.row)) {
      const y = middle(node)
      links.push({ kind: 'trunk', from: above, to: node.perk, points: [{ x: trunk, y: from }, { x: trunk, y }, { x: nodeRect(node).x, y }] })
      from = y
      above = node.perk
    }
  }
  // Each parent's brackets as a group, with the rows they span together.
  const groups = new Map<PerkId, { column: number; children: TreeNode[]; top: number; bottom: number; lane: number }>()
  for (const node of nodes) {
    const parent = nodes.find((other) => other.perk === node.from)
    if (!parent) continue
    const group = groups.get(parent.perk) ?? { column: parent.column, children: [], top: parent.row, bottom: parent.row, lane: 0 }
    group.children.push(node)
    group.top = Math.min(group.top, node.row)
    group.bottom = Math.max(group.bottom, node.row)
    groups.set(parent.perk, group)
  }
  const placed: { column: number; top: number; bottom: number; lane: number }[] = []
  const bySpan = [...groups].sort(([, a], [, b]) => a.bottom - a.top - (b.bottom - b.top))
  for (const [parentId, group] of bySpan) {
    const met = placed.filter((other) => other.column === group.column && other.top <= group.bottom && group.top <= other.bottom)
    while (met.some((other) => other.lane === group.lane)) group.lane++
    placed.push(group)
    const parent = nodes.find((other) => other.perk === parentId)!
    for (const node of group.children) {
      const right = nodeRect(node).x + NODE_W
      const x = right + LANE_GAP + group.lane * LANE_PITCH
      links.push({
        kind: 'requires',
        from: parentId,
        to: node.perk,
        points: [{ x: right, y: middle(parent) }, { x, y: middle(parent) }, { x, y: middle(node) }, { x: right, y: middle(node) }],
      })
    }
  }
  return links
}

/** How bright a line into a node is drawn: 'lit' into one taken, 'open' into one the character could take, 'dim' into one closed. */
export type LinkTone = 'lit' | 'open' | 'dim'
export function linkTone(state: NodeState): LinkTone {
  return state === 'taken' ? 'lit' : state === 'open' ? 'open' : 'dim'
}

/**
 * A line's tone for a character, `stateOf` giving each node's standing: that
 * of the node it leads into, but a trunk stretch is lit only when the node
 * above it is lit too (else it is drawn as open), so that a node taken under
 * one not taken does not look hung from it.
 */
export function linkToneOf(link: Pick<TreeLink, 'kind' | 'from' | 'to'>, stateOf: (perk: PerkId) => NodeState): LinkTone {
  const tone = linkTone(stateOf(link.to))
  if (tone === 'lit' && link.kind === 'trunk' && link.from !== null && linkTone(stateOf(link.from)) !== 'lit') return 'open'
  return tone
}

/** The node kinds in the order the legend names them, with its words for each. */
export const KIND_LEGEND: readonly { kind: NodeKind; label: string }[] = [
  { kind: 'passive', label: 'Passive' },
  { kind: 'at-will', label: 'At will' },
  { kind: 'mana', label: 'Mana' },
  { kind: 'spell', label: 'Spell' },
]
/** The legend's row, under the tree tabs and over the path headings, its words in 10 px monospace. */
export const LEGEND_Y = TREE_Y - 9
const LEGEND_CHAR_W = 6
const LEGEND_GLYPH_W = 10
const LEGEND_GAP = 14

/**
 * Each legend entry's left edge, the glyph's, and where its words begin, from
 * the tree's left edge under the tabs (creation's notes take the right).
 */
export function legendLayout(): { kind: NodeKind; label: string; x: number; textX: number; right: number }[] {
  const widths = KIND_LEGEND.map(({ label }) => LEGEND_GLYPH_W + 4 + label.length * LEGEND_CHAR_W)
  let x = TREE_X
  return KIND_LEGEND.map((entry, i) => {
    const at = { ...entry, x, textX: x + LEGEND_GLYPH_W + 4, right: x + widths[i] }
    x += widths[i] + LEGEND_GAP
    return at
  })
}

/**
 * 'taken', 'open' (it qualifies), 'locked' (a capstone closed by the calling
 * or by a capstone already held) or 'closed' (some other ask unmet).
 */
export type NodeState = 'taken' | 'open' | 'closed' | 'locked'

/** How `perk` stands for the character. */
export function nodeState(character: Character, perk: PerkId): NodeState {
  if (perkRanks(character, perk) > 0) return 'taken'
  if (qualifiesFor(character, perk)) return 'open'
  return lockWords(character, perk) ? 'locked' : 'closed'
}

/** "path is Evoker", or "paths are Evoker, Arcanist and Healer" for a tie. */
function deepestWords(deepest: readonly PathId[]): string {
  const names = deepest.map((id) => PATHS[id].name)
  if (names.length === 1) return `path is ${names[0]}`
  return `paths are ${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
}

/** Why a capstone is locked, or null when it is not: another capstone held, or its path not the calling. */
function lockWords(character: Character, perk: PerkId): string | null {
  const { tier, path }: Perk = PERKS[perk]
  if (tier !== 'capstone') return null
  const held = capstoneOf(character)
  if (held) return `Closed: you hold ${PERKS[held].name}`
  const deepest = calling(character)
  if (deepest.length > 0 && !deepest.includes(path)) return `Closed: your deepest ${deepestWords(deepest)}`
  return null
}

/** "Toughness": a node by name. */
export function perkTitle(_character: Character, perk: PerkId): string {
  return PERKS[perk].name
}

/** What a node reads: its name. */
export function nodeLabel(character: Character, perk: PerkId): string {
  return perkTitle(character, perk)
}

/** "1 perk point", "3 perk points". */
const perkPointWords = (n: number) => `${n} ${n === 1 ? 'perk point' : 'perk points'}`

/**
 * The right-hand words of the strip under the tree for a node: what a click
 * on it would do, or why it would do nothing. `canAdvance` says whether perk
 * points can be spent here, which is on the world map and not in battle.
 */
export function nodeHint(character: Character, perk: PerkId, canAdvance: boolean): string {
  const state = nodeState(character, perk)
  if (state === 'taken') return 'Taken'
  if (state === 'locked') return lockWords(character, perk)!
  if (state === 'closed') {
    const capped = cappedAttribute(character, perk)
    const lacking = [...missingRequirements(character, perk), ...(capped ? [`${ATTRIBUTES[capped].name} would pass ${MAX_ATTRIBUTE}`] : [])]
    return `Not yet: ${lacking.join(', ')}`
  }
  if (!canAdvance) return 'Perk points are spent on the world map'
  const cost = perkCost(perk)
  if (canAffordPerk(character, perk)) return `Click to take (${cost} of your ${perkPointWords(character.perkPoints)})`
  return `Needs ${perkPointWords(cost)}; you have ${character.perkPoints} — affordable at level ${affordableAt(character, perk)}`
}

/**
 * When saving next pays for something, for the strip under the tree with the
 * pointer on no node: the cheapest open node the hero cannot yet afford (the
 * first in `PERKS` order on a tie), "Saving: Pin (3 perk points) is yours at
 * level 11"; else, while it holds no capstone, the capstone of its calling
 * (the first path of a tie): at its tier's level at the soonest when only the
 * level and the points wait (`waitsOnlyForLevel`), else as a goal with what
 * it still asks ("Goal: Blademaster, your calling's capstone: 4 perk points,
 * 5 nodes in Swordmaster, level 12"); else null.
 */
export function savingLine(character: Character): string | null {
  const dear = availablePerks(character).filter((perk) => !canAffordPerk(character, perk))
  if (dear.length > 0) {
    const next = dear.reduce((best, perk) => (affordableAt(character, perk) < affordableAt(character, best) ? perk : best))
    return `Saving: ${PERKS[next].name} (${perkPointWords(perkCost(next))}) is yours at level ${affordableAt(character, next)}`
  }
  const path = calling(character)[0]
  if (!path || capstoneOf(character)) return null
  const capstone = PERK_IDS.find((id) => (PERKS[id] as Perk).path === path && (PERKS[id] as Perk).tier === 'capstone')
  if (!capstone) return null
  const name = PERKS[capstone].name
  if (waitsOnlyForLevel(character, capstone)) {
    const level = Math.max(affordableAt(character, capstone), TIERS.capstone.level)
    return `Saving: ${name}, your calling's capstone (${perkPointWords(perkCost(capstone))}), is yours at level ${level}`
  }
  // It asks more than saving brings (depth, a skill, an attribute): a goal, with what is still lacking, the level last.
  const lacking = missingRequirements(character, capstone)
  const levelAsk = lacking.filter((ask) => ask.startsWith('Level '))
  const rest = lacking.filter((ask) => !ask.startsWith('Level '))
  const asks = [perkPointWords(perkCost(capstone)), ...rest, ...levelAsk.map((ask) => ask.toLowerCase())]
  return `Goal: ${name}, your calling's capstone: ${asks.join(', ')}`
}

/**
 * The same words for a node of the tree in character creation, where a click
 * takes a node or gives it back (`togglePerk`).
 */
export function draftNodeHint(draft: CharacterDraft, perk: PerkId): string {
  const change = togglePerk(draft, perk)
  if (change.draft !== draft) return change.draft.perks.length > draft.perks.length ? 'Click to take' : 'Click to give back'
  if (change.notes.length > 0) return change.notes[0]
  const character = draftCharacter(draft)
  return nodeState(character, perk) === 'open' ? 'No perk points left' : nodeHint(character, perk, true)
}

/** A path's heading over its column: its name and the nodes the character holds in it, and whether it is (one of) its calling. */
export function pathHeading(character: Pick<Character, 'perks'>, path: PathId): { text: string; calling: boolean } {
  return { text: `${PATHS[path].name}  ${pathDepth(character, path)}`, calling: calling(character).includes(path) }
}

/** What an ability costs, in the strip's words: "3 mana, 6 AP (weapon + 1)", the weapon-relative AP (`abilityApCost`) for the weapon held. */
export function costWords(ability: AbilityId, stats: Pick<CombatantStats, 'attackApCost' | 'traits'>): string {
  const { manaCost, weaponAp } = ABILITIES[ability]
  // The offset is the hero's own: an Arcane Knight's Spellsword Strikes cost the weapon's AP and no more.
  const cost = abilityApCost(stats, ability)
  const ap = `${cost} AP${weaponAp === undefined ? '' : ` (weapon + ${cost - stats.attackApCost})`}`
  return manaCost ? `${manaCost} mana, ${ap}` : ap
}

/**
 * The strip's first line for a node: "Fireball (Evoker, spell): 5 mana, 6 AP. A ball of fire…",
 * a capstone's kind followed by ", capstone". A spell's cost is the character's own
 * (`spellApCost`), and an ability's is its weapon's where the ability counts from it.
 */
export function nodeSummary(character: Character, perk: PerkId): string {
  const node: Perk = PERKS[perk]
  const kind = `${nodeKind(perk)}${node.tier === 'capstone' ? ', capstone' : ''}`
  const title = `${node.name} (${PATHS[node.path].name}, ${kind})`
  const stats = deriveCombatStats(character)
  if (node.spell) {
    const { manaCost, description } = SPELLS[node.spell]
    return `${title}: ${manaCost} mana, ${spellApCost(stats, node.spell)} AP. ${description}`
  }
  if (node.ability) {
    return `${title}: ${costWords(node.ability, stats)}. ${ABILITIES[node.ability].description}`
  }
  return `${title}: ${node.description}`
}

export type CostTone = 'gold' | 'dim'

/**
 * The tone of the cost digit in a node's slot: null for a node taken (the
 * view draws a check) or a capstone locked (a cross); gold while it is open,
 * affordable and perk points can be spent here; dim otherwise.
 */
export function costTone(character: Character, perk: PerkId, canAdvance: boolean): CostTone | null {
  const state = nodeState(character, perk)
  if (state === 'taken' || state === 'locked') return null
  return state === 'open' && canAdvance && canAffordPerk(character, perk) ? 'gold' : 'dim'
}

/** The same for a node of the tree in creation, where the points left are the draft's. */
export function draftCostTone(draft: CharacterDraft, perk: PerkId): CostTone | null {
  const character = draftCharacter(draft)
  const state = nodeState(character, perk)
  if (state === 'taken' || state === 'locked') return null
  return state === 'open' && perkPointsLeft(draft) >= perkCost(perk) ? 'gold' : 'dim'
}

/** The strip's asks line: "Costs 3 perk points. Asks: Level 6, Melee 55%, 3 nodes in Heavy Knight". */
export function nodeAsks(perk: PerkId): string {
  const asks = describePerkRequirements(perk)
  return `Costs ${perkPointWords(perkCost(perk))}.${asks ? ` Asks: ${asks}` : ''}`
}

/** Whether a click on `perk` in creation does anything: only a tier-1 node, taken or given back (`togglePerk`). */
export function draftNodeClickable(draft: CharacterDraft, perk: PerkId): boolean {
  return (PERKS[perk] as Perk).tier === 1 && togglePerk(draft, perk).draft !== draft
}

/** The tree tabs over the tree, Warrior to Cleric, left to right: each one's centre and size. */
export const TREE_TAB_Y = 75
const TREE_TAB_W = 82
const TREE_TAB_PITCH = 88
export function treeTabRect(tree: TreeId): { x: number; y: number; width: number; height: number } {
  return { x: TREE_X + TREE_TAB_W / 2 + TREE_IDS.indexOf(tree) * TREE_TAB_PITCH, y: TREE_TAB_Y, width: TREE_TAB_W, height: 22 }
}

/** A tree tab's words: the tree, and the nodes held in it once there are any. */
export function treeTabLabel(character: Pick<Character, 'perks'>, tree: TreeId): string {
  const held = treeNodes(character, tree)
  return held > 0 ? `${TREES[tree].name} ${held}` : TREES[tree].name
}

/** The tree a key of 1 to 4 shows, or null for any other key. */
export function treeForKey(key: string): TreeId | null {
  const index = Number(key) - 1
  return Number.isInteger(index) && index >= 0 && index < TREE_IDS.length ? TREE_IDS[index] : null
}

/**
 * The tree the panel's tree view opens on: that of the character's calling,
 * its deepest path; on a tie, the tied path whose tree holds the most of its
 * nodes, then the first; with no node, the Warrior tree.
 */
export function openingTree(character: Pick<Character, 'perks'>): TreeId {
  const trees = calling(character).map((path) => PATHS[path].tree)
  if (trees.length === 0) return 'warrior'
  return trees.reduce((best, tree) => (treeNodes(character, tree) > treeNodes(character, best) ? tree : best))
}
