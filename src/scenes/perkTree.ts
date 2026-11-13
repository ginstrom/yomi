import { ATTRIBUTES, MAX_ATTRIBUTE } from '../character/attributes.ts'
import { deriveCombatStats, type Character } from '../character/character.ts'
import { ABILITIES, type Ability, type AbilityId } from '../combat/abilities.ts'
import { SPELLS, spellApCost } from '../combat/spells.ts'
import { draftCharacter, togglePerk, type CharacterDraft } from '../character/creation.ts'
import {
  PERKS,
  PERK_IDS,
  cappedAttribute,
  missingRequirements,
  nodeKind,
  perkParent,
  perkRanks,
  qualifiesFor,
  type Perk,
  type PerkId,
} from '../character/perks.ts'
import { hasPickFor, nextPerkLevel } from '../character/progression.ts'
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

/** Where the view draws a tree, in its container's own pixels: three columns of nodes, the path headings on row 0. */
export const TREE_X = 20
export const TREE_Y = 100
export const TREE_COLUMN_W = 226
export const TREE_ROW_H = 31
export const NODE_W = 214
export const NODE_H = 27
/** The rows the view keeps for a tree, the headings' included, so that the strip sits in one place under any. */
export const TREE_ROWS = 10
/** The strip under the tree: the node pointed at, what it asks and what a click would do. */
export const TREE_STRIP_Y = TREE_Y + TREE_ROWS * TREE_ROW_H + 4
/** How far the tree reaches across. */
export const TREE_W = TREE_X + 2 * TREE_COLUMN_W + NODE_W

/** A node's top left corner and size, in the container's own pixels. */
export function nodeRect({ column, row }: Pick<TreeNode, 'column' | 'row'>): { x: number; y: number; width: number; height: number } {
  return { x: TREE_X + column * TREE_COLUMN_W, y: TREE_Y + row * TREE_ROW_H, width: NODE_W, height: NODE_H }
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

/** Why a capstone is locked, or null when it is not: another capstone held, or its path not the calling. */
function lockWords(character: Character, perk: PerkId): string | null {
  const { tier, path }: Perk = PERKS[perk]
  if (tier !== 'capstone') return null
  const held = capstoneOf(character)
  if (held) return `Closed: you hold ${PERKS[held].name}`
  const deepest = calling(character)
  if (deepest.length > 0 && !deepest.includes(path)) return `Closed: your deepest path is ${deepest.map((id) => PATHS[id].name).join(' and ')}`
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

/**
 * The right-hand words of the strip under the tree for a node: what a click
 * on it would do, or why it would do nothing. `canAdvance` says whether picks
 * can be spent here, which is on the world map and not in battle.
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
  if (!canAdvance) return 'Picks are spent on the world map'
  if (hasPickFor(character, perk)) return 'Click to take'
  return `No pick until level ${nextPerkLevel(character)}`
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
  return nodeState(character, perk) === 'open' ? 'No picks left' : nodeHint(character, perk, true)
}

/** A path's heading over its column: its name and the nodes the character holds in it, and whether it is (one of) its calling. */
export function pathHeading(character: Pick<Character, 'perks'>, path: PathId): { text: string; calling: boolean } {
  return { text: `${PATHS[path].name}  ${pathDepth(character, path)}`, calling: calling(character).includes(path) }
}

/** What an active costs, in the strip's words: "3 mana, 6 AP (weapon + 1)", the weapon-relative AP worked out for the weapon held. */
export function costWords(cost: { manaCost?: number; apCost: number; weaponAp?: number }, attackApCost: number): string {
  const ap = cost.weaponAp === undefined ? `${cost.apCost} AP` : `${attackApCost + cost.weaponAp} AP (weapon + ${cost.weaponAp})`
  return cost.manaCost ? `${cost.manaCost} mana, ${ap}` : ap
}

/**
 * The strip's first line for a node: "Fireball (Evoker, spell): 5 mana, 6 AP. A ball of fire…",
 * a capstone's kind followed by ", capstone". A spell's cost is the character's own
 * (`spellApCost`), and an ability's is its weapon's where the ability counts from it.
 */
export function nodeSummary(character: Character, perk: PerkId): string {
  const node: Perk & { ability?: AbilityId } = PERKS[perk]
  const kind = `${nodeKind(perk)}${node.tier === 'capstone' ? ', capstone' : ''}`
  const title = `${node.name} (${PATHS[node.path].name}, ${kind})`
  const stats = deriveCombatStats(character)
  if (node.spell) {
    const { manaCost, description } = SPELLS[node.spell]
    return `${title}: ${manaCost} mana, ${spellApCost(stats, node.spell)} AP. ${description}`
  }
  if (node.ability) {
    const ability: Ability & { manaCost?: number; weaponAp?: number } = ABILITIES[node.ability]
    return `${title}: ${costWords(ability, stats.attackApCost)}. ${ability.description}`
  }
  return `${title}: ${node.description}`
}

/** Whether a click on `perk` in creation does anything: only a tier-1 node, taken or given back (`togglePerk`). */
export function draftNodeClickable(draft: CharacterDraft, perk: PerkId): boolean {
  return (PERKS[perk] as Perk).tier === 1 && togglePerk(draft, perk).draft !== draft
}

/** The tree tabs over the tree, Warrior to Cleric, left to right: each one's centre and size. */
export const TREE_TAB_Y = TREE_Y - 25
const TREE_TAB_W = 82
const TREE_TAB_PITCH = 88
export function treeTabRect(tree: TreeId): { x: number; y: number; width: number; height: number } {
  return { x: TREE_X + TREE_TAB_W / 2 + TREE_IDS.indexOf(tree) * TREE_TAB_PITCH, y: TREE_TAB_Y, width: TREE_TAB_W, height: 24 }
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

/** The tree the panel's tree view opens on: that of the character's calling (the first, on a tie), else the Warrior tree. */
export function openingTree(character: Pick<Character, 'perks'>): TreeId {
  const [path] = calling(character)
  return path ? PATHS[path].tree : 'warrior'
}
