import type Phaser from 'phaser'
import type { Character } from '../character/character.ts'
import { PERKS, describePerkRequirements, nodeKind, perkRanks, type Perk, type PerkId } from '../character/perks.ts'
import { PATHS, TREE_IDS, calling, pathDepth, pathsOf, type TreeId } from '../character/trees.ts'
import type { Point } from './boardGeometry.ts'
import { nodeLabel, nodeState, perkTitle, treeLayout, type TreeNode } from './perkTree.ts'

/** Every tree's nodes, laid out once. */
const TREES = Object.fromEntries(TREE_IDS.map((tree) => [tree, treeLayout(tree)])) as unknown as Record<TreeId, readonly TreeNode[]>

/** Where the tree is drawn in its container: a node for each perk, a row for each tip of a branch, and a strip under it. */
const TREE_X = 20
const TREE_Y = 100
const TREE_COLUMN_W = 172
const TREE_ROW_H = 31
const NODE_W = 160
const NODE_H = 27
/** The rows the panel keeps for a tree, so that the strip sits in one place under any. */
const NODE_ROWS = 11
/** The edge on a node in its kind's colour: a passive dim gold, a spell blue. */
const KIND_EDGE_W = 4
const KIND_COLOURS = { passive: 0x8a7a5a, 'at-will': 0xd09a3c, mana: 0x5a8ee0, spell: 0x5a8ee0 } as const
const TREE_STRIP_Y = TREE_Y + NODE_ROWS * TREE_ROW_H
/** How far the tree and its strip reach across; a panel may put something beside them. */
export const PERK_TREE_W = TREE_X + 2 * TREE_COLUMN_W + NODE_W

const FONT = 'monospace'
const GOLD = '#e8c766'
const DIM = '#8a7a5a'
const TEXT = '#d8c9a3'

/** A node's top left corner, in the container's own pixels. */
function nodeAt({ column, row }: Pick<TreeNode, 'column' | 'row'>): Point {
  return { x: TREE_X + column * TREE_COLUMN_W, y: TREE_Y + row * TREE_ROW_H }
}

/** What a scene tells the tree it draws. */
export interface PerkTreeOptions {
  /** Which tree: the Warrior tree by default. */
  tree?: TreeId
  /** The character whose perks the tree shows. */
  character: Character
  /** Whether a click on the perk's node would do anything now. */
  clickable(perk: PerkId): boolean
  /** Whether the node is edged in gold, as one a click would take a rank of; every clickable node by default. */
  marked?(perk: PerkId): boolean
  onClick(perk: PerkId): void
  /** The right-hand words of the strip for the node pointed at: what a click would do, or why nothing. */
  hint(perk: PerkId): string
  /** What the strip says with the pointer on no node. */
  rule: string
  /** How wide the strip's text may run; the tree's own width by default. */
  stripWidth?: number
}

/**
 * A skill tree's game objects: each path's heading, every node (perkTree.ts)
 * edged in its kind's colour, a line from the node it requires, and a strip
 * under it for the node pointed at. (Step 06 of the skill trees redraws it
 * with tabs for the four trees.) Like `PartyColumn` it imports Phaser and has no logic of its own:
 * the character panel and character creation both draw it, and each decides
 * what a click on a node does.
 */
export class PerkTreeView {
  /** Every node of a tree, by its centre in the container's own pixels, for a scene's probe. */
  static nodeCentres(tree: TreeId = 'warrior'): Array<Point & { perk: PerkId }> {
    return TREES[tree].map((node) => {
      const { x, y } = nodeAt(node)
      return { perk: node.perk, x: x + NODE_W / 2, y: y + NODE_H / 2 }
    })
  }

  private readonly options: PerkTreeOptions
  private readonly nodes: readonly TreeNode[]
  private readonly strip: Phaser.GameObjects.Text[]

  /** Draws the tree into `container`, which the scene clears and redraws after each change to the character. */
  constructor(scene: Phaser.Scene, container: Phaser.GameObjects.Container, options: PerkTreeOptions) {
    this.options = options
    const tree = options.tree ?? 'warrior'
    this.nodes = TREES[tree]
    const { character } = options

    // Row 0: each path's name and the nodes held in it, the calling in gold.
    const deepest = calling(character)
    pathsOf(tree).forEach((path, column) => {
      const { x, y } = nodeAt({ column, row: 0 })
      const heading = `${PATHS[path].name}  ${pathDepth(character, path)}`
      const colour = deepest.includes(path) ? GOLD : `#${PATHS[path].colour.toString(16).padStart(6, '0')}`
      container.add(scene.add.text(x, y + 6, heading, { fontFamily: FONT, fontSize: '13px', color: colour }))
    })

    const lines = scene.add.graphics()
    container.add(lines)
    for (const node of this.nodes) {
      const from = this.nodes.find((other) => other.perk === node.from)
      if (!from) continue
      const start = nodeAt(from)
      const end = nodeAt(node)
      const y0 = start.y + NODE_H / 2
      const y1 = end.y + NODE_H / 2
      // Down the column's left gutter, from the node required to the one that requires it.
      const gutter = start.x - 5
      const walked = perkRanks(character, node.perk) > 0
      lines.lineStyle(2, walked ? 0xc9a227 : 0x4a3d28, 1)
      lines.beginPath()
      lines.moveTo(start.x, y0)
      lines.lineTo(gutter, y0)
      lines.lineTo(gutter, y1)
      lines.lineTo(end.x, y1)
      lines.strokePath()
    }
    for (const node of this.nodes) this.buildNode(scene, container, node)

    const style = { fontFamily: FONT, fontSize: '12px', color: DIM }
    const width = options.stripWidth ?? PERK_TREE_W - TREE_X
    this.strip = [
      scene.add.text(TREE_X, TREE_STRIP_Y, '', { ...style, color: TEXT, wordWrap: { width } }),
      scene.add.text(TREE_X, TREE_STRIP_Y + 34, '', style),
      scene.add.text(TREE_X + width, TREE_STRIP_Y + 34, '', { ...style, color: GOLD }).setOrigin(1, 0),
    ]
    container.add(this.strip)
    this.describe(null)
  }

  private buildNode(scene: Phaser.Scene, container: Phaser.GameObjects.Container, node: TreeNode): void {
    const { character, clickable, onClick } = this.options
    const { x, y } = nodeAt(node)
    const id = node.perk
    const state = nodeState(character, id)
    const live = clickable(id)
    const marked = this.options.marked?.(id) ?? live
    const started = perkRanks(character, id) > 0
    const bg = scene.add
      .rectangle(x, y, NODE_W, NODE_H, 0x1b1712, state === 'closed' || state === 'locked' ? 0.5 : 0.95)
      .setOrigin(0)
      .setStrokeStyle(marked ? 2 : 1, marked ? 0xc9a227 : state === 'open' ? 0x6b5a3a : 0x4a3d28)
    const label = scene.add
      .text(x + NODE_W / 2, y + NODE_H / 2, nodeLabel(character, id), {
        fontFamily: FONT,
        fontSize: '13px',
        color: started ? GOLD : state === 'open' ? TEXT : DIM,
      })
      .setOrigin(0.5)
    container.add([bg, label])
    const edge = scene.add.rectangle(x, y, KIND_EDGE_W, NODE_H, KIND_COLOURS[nodeKind(id)], state === 'closed' ? 0.5 : 1)
    container.add(edge.setOrigin(0))
    if ((PERKS[id] as Perk).tier === 'capstone') label.setText(`* ${label.text}`)

    bg.setInteractive({ useHandCursor: live })
    bg.on('pointerover', () => {
      if (live) bg.setFillStyle(0x3a2f1c, 0.95)
      this.describe(id)
    })
    bg.on('pointerout', () => {
      if (live) bg.setFillStyle(0x1b1712, state === 'closed' || state === 'locked' ? 0.5 : 0.95)
      this.describe(null)
    })
    bg.on('pointerdown', () => {
      if (live) onClick(id)
    })
  }

  /** Fills the strip for the node pointed at, or with the rule when there is none. */
  private describe(perk: PerkId | null): void {
    const [what, asks, hint] = this.strip
    if (perk === null) {
      what.setText(this.options.rule).setColor(DIM)
      asks.setText('')
      hint.setText('')
      return
    }
    const { path } = PERKS[perk] as Perk
    const title = `${perkTitle(this.options.character, perk)} (${PATHS[path].name}, ${nodeKind(perk)})`
    what.setText(`${title}: ${PERKS[perk].description}`).setColor(TEXT)
    asks.setText(`Asks: ${describePerkRequirements(perk)}`)
    hint.setText(this.options.hint(perk))
  }
}
