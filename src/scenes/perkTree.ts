import { ATTRIBUTES, ATTRIBUTE_IDS } from '../character/attributes.ts'
import type { Character } from '../character/character.ts'
import {
  PERKS,
  PERK_IDS,
  TRUNK_PERKS,
  attributeLevel,
  cappedAttribute,
  missingRequirements,
  perkParent,
  perkRanks,
  qualifiesFor,
  type PerkId,
} from '../character/perks.ts'
import { nextPerkLevel } from '../character/progression.ts'

/**
 * The perk tree as the character panel draws it: where each perk's node sits
 * and how it stands for a character. The tree grows from left to right, a
 * branch for each attribute, and is built from the perks' own data (`branch`,
 * `requires`), so a new perk takes its place without a change here.
 */

export interface TreeNode {
  perk: PerkId
  /** Steps out from the trunk: 0 for the trunk perk itself. */
  column: number
  row: number
  /** The node its line comes from: its `perkParent`, or its branch's trunk; null for a trunk. */
  from: PerkId | null
}

/**
 * Every perk's place: branches in `ATTRIBUTE_IDS` order, each tip of a branch
 * on a row of its own, and a perk with others growing from it on the row of
 * the first of them. Within a branch the perks follow the order of `PERKS`.
 */
export function perkTreeLayout(): TreeNode[] {
  const nodes: TreeNode[] = []
  let nextRow = 0
  const place = (perk: PerkId, column: number, from: PerkId | null, children: (of: PerkId) => PerkId[]): number => {
    const node: TreeNode = { perk, column, row: 0, from }
    nodes.push(node)
    const rows = children(perk).map((child) => place(child, column + 1, perk, children))
    node.row = rows[0] ?? nextRow++
    return node.row
  }
  for (const attribute of ATTRIBUTE_IDS) {
    const trunk = TRUNK_PERKS[attribute]
    const branch = PERK_IDS.filter((id) => PERKS[id].branch === attribute && id !== trunk)
    // The trunk is not asked for by the perks that grow from it; its line only shows the way in.
    place(trunk, 0, null, (of) => branch.filter((id) => (perkParent(id) ?? trunk) === of))
  }
  return nodes
}

export type NodeState = 'taken' | 'open' | 'closed'

/** How `perk` stands for the character: taken with every rank, open with a rank left that it qualifies for, else closed. */
export function nodeState(character: Character, perk: PerkId): NodeState {
  if (perkRanks(character, perk) >= PERKS[perk].ranks) return 'taken'
  return qualifiesFor(character, perk) ? 'open' : 'closed'
}

/** " 1/2" for a perk of several ranks, and nothing for a perk of one. */
function rankCount(character: Character, perk: PerkId): string {
  const { ranks } = PERKS[perk]
  return ranks > 1 ? ` ${perkRanks(character, perk)}/${ranks}` : ''
}

/** "Toughness 1/2", "Far Shot": a perk by name, with its ranks when it has more than one. */
export function perkTitle(character: Character, perk: PerkId): string {
  return `${PERKS[perk].name}${rankCount(character, perk)}`
}

/**
 * What a node reads: the perk's title, or for a trunk the attribute it raises
 * and its present value, with the ranks once one is taken ("Strength 8 1/2").
 */
export function nodeLabel(character: Character, perk: PerkId): string {
  const { branch } = PERKS[perk]
  if (TRUNK_PERKS[branch] !== perk) return perkTitle(character, perk)
  const ranks = perkRanks(character, perk) > 0 ? rankCount(character, perk) : ''
  return `${ATTRIBUTES[branch].name} ${attributeLevel(character, branch)}${ranks}`
}

/**
 * The right-hand words of the strip under the tree for a node: what a click
 * on it would do, or why it would do nothing. `canAdvance` says whether perks
 * can be chosen here, which is on the world map and not in battle.
 */
export function nodeHint(character: Character, perk: PerkId, canAdvance: boolean): string {
  const state = nodeState(character, perk)
  if (state === 'taken') return 'Taken'
  if (state === 'closed') {
    const capped = cappedAttribute(character, perk)
    const lacking = [...missingRequirements(character, perk), ...(capped ? [`${ATTRIBUTES[capped].name} is as high as it goes`] : [])]
    return `Not yet: ${lacking.join(', ')}`
  }
  if (!canAdvance) return 'Perks are chosen on the world map'
  return character.perkPicks > 0 ? 'Click to take' : `No perk to choose until level ${nextPerkLevel(character)}`
}
