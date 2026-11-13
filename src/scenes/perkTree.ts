import { ATTRIBUTES, MAX_ATTRIBUTE } from '../character/attributes.ts'
import type { Character } from '../character/character.ts'
import { draftCharacter, togglePerk, type CharacterDraft } from '../character/creation.ts'
import {
  PERKS,
  PERK_IDS,
  cappedAttribute,
  missingRequirements,
  perkParent,
  perkRanks,
  qualifiesFor,
  type Perk,
  type PerkId,
} from '../character/perks.ts'
import { hasPickFor, nextPerkLevel } from '../character/progression.ts'
import { PATHS, TIERS, calling, capstoneOf, pathsOf, type PathId, type Tier, type TreeId } from '../character/trees.ts'

/**
 * The skill trees as the character panel and creation draw them: where each
 * node sits and how it stands for a character. A tree has a column for each
 * of its three paths (`pathsOf`), row 0 for the path's heading and its nodes
 * from row 1 down in `PERKS` order, which is by tier, so a new node takes its
 * place without a change here.
 */

export interface TreeNode {
  perk: PerkId
  /** Its path's place within the tree, 0 to 2. */
  column: number
  /** 1 and down; row 0 is the path's heading. */
  row: number
  /** The node it requires (`perkParent`), whose line it hangs from; null for none. */
  from: PerkId | null
}

/** Every node of `tree`, a column a path. */
export function treeLayout(tree: TreeId): TreeNode[] {
  return pathsOf(tree).flatMap((path, column) =>
    nodesOf(path).map((perk, i) => ({ perk, column, row: i + 1, from: perkParent(perk) })),
  )
}

/** `path`'s nodes in `PERKS` order. */
function nodesOf(path: PathId): PerkId[] {
  return PERK_IDS.filter((id) => (PERKS[id] as Perk).path === path)
}

const TIER_ORDER: readonly Tier[] = [1, 2, 3, 'capstone']

/**
 * The tiers present in `tree` with the first row any of its paths has a node
 * of that tier on, for the bands the view draws: "L1", "L2", "L6", "L12".
 */
export function tierBands(tree: TreeId): { tier: Tier; label: 'L1' | 'L2' | 'L6' | 'L12'; firstRow: number }[] {
  const nodes = treeLayout(tree)
  return TIER_ORDER.flatMap((tier) => {
    const rows = nodes.filter((node) => (PERKS[node.perk] as Perk).tier === tier).map((node) => node.row)
    if (rows.length === 0) return []
    return [{ tier, label: `L${TIERS[tier].level}` as 'L1' | 'L2' | 'L6' | 'L12', firstRow: Math.min(...rows) }]
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
