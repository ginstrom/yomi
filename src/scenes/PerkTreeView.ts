import type Phaser from 'phaser'
import type { Character } from '../character/character.ts'
import { PERKS, describePerkRequirements, nodeKind, perkRanks, type Perk, type PerkId } from '../character/perks.ts'
import { PATHS, TREE_IDS, pathsOf, type TreeId } from '../character/trees.ts'
import type { Point } from './boardGeometry.ts'
import { addPanelButton } from './panelButton.ts'
import {
  clampLines,
  NODE_H,
  STRIP_HINT_LINES,
  NODE_W,
  TREE_STRIP_Y,
  TREE_W,
  TREE_X,
  nodeLabel,
  nodeRect,
  nodeState,
  nodeSummary,
  pathHeading,
  tierBands,
  treeLayout,
  treeTabLabel,
  treeTabRect,
  type TreeNode,
} from './perkTree.ts'

/** Every tree's nodes, laid out once. */
const LAYOUTS = Object.fromEntries(TREE_IDS.map((tree) => [tree, treeLayout(tree)])) as unknown as Record<TreeId, readonly TreeNode[]>

/** The edge on a node in its kind's colour: a passive dim gold, an at-will active amber, a spell or a mana active blue. */
const KIND_EDGE_W = 4
const KIND_COLOURS = { passive: 0x8a7a5a, 'at-will': 0xd09a3c, mana: 0x5a8ee0, spell: 0x5a8ee0 } as const
/** How wide the strip under the tree runs. */
const STRIP_W = TREE_W - TREE_X

const FONT = 'monospace'
const GOLD = '#e8c766'
const DIM = '#8a7a5a'
const TEXT = '#d8c9a3'
const GOLD_EDGE = 0xc9a227
/** A capstone closed to the character by its calling or another capstone. */
const LOCKED_EDGE = 0x9a4a32
const LOCKED = '#a0624e'

/** What a scene tells the tree it draws. */
export interface PerkTreeOptions {
  /** Which tree. */
  tree: TreeId
  /** The character whose nodes the tree shows. */
  character: Character
  /** Whether a click on the node would do anything now. */
  clickable(perk: PerkId): boolean
  /** Whether the node is edged in gold, as one a click would take; every clickable node by default. */
  marked?(perk: PerkId): boolean
  onClick(perk: PerkId): void
  /** A click on a tree's tab; the scene redraws the view on that tree. */
  onTree(tree: TreeId): void
  /** The strip's last line for the node pointed at: what a click would do, or why nothing. */
  hint(perk: PerkId): string
  /** What the strip says with the pointer on no node. */
  rule: string
}

/**
 * A skill tree's game objects: a tab for each of the four trees, each path's
 * heading with the nodes held in it (the calling's in gold), the tier bands,
 * every node (perkTree.ts) with a stripe of its kind's colour, a capstone in
 * a double gold frame, a line from the node it requires, and a strip under
 * it for the node pointed at. Like `PartyColumn` it imports Phaser and has no
 * logic of its own: the character panel and character creation both draw it,
 * and each decides what a click on a node or a tab does.
 */
export class PerkTreeView {
  /** Every node of a tree, by its centre in the container's own pixels, for a scene's probe. */
  static nodeCentres(tree: TreeId): Array<Point & { perk: PerkId }> {
    return LAYOUTS[tree].map((node) => {
      const { x, y } = nodeRect(node)
      return { perk: node.perk, x: x + NODE_W / 2, y: y + NODE_H / 2 }
    })
  }

  /** Each tree's tab, by its centre in the container's own pixels, for a scene's probe. */
  static tabCentres(): Record<TreeId, Point> {
    return Object.fromEntries(TREE_IDS.map((tree) => [tree, { x: treeTabRect(tree).x, y: treeTabRect(tree).y }])) as Record<TreeId, Point>
  }

  private readonly options: PerkTreeOptions
  private readonly strip: Phaser.GameObjects.Text[]

  /** Draws the tree into `container`, which the scene clears and redraws after each change to the character. */
  constructor(scene: Phaser.Scene, container: Phaser.GameObjects.Container, options: PerkTreeOptions) {
    this.options = options
    const { tree, character } = options
    const nodes = LAYOUTS[tree]

    for (const id of TREE_IDS) {
      addPanelButton(scene, container, treeTabRect(id), treeTabLabel(character, id), () => options.onTree(id), {
        marked: id === tree,
        fontSize: 13,
      })
    }

    // Row 0: each path's name and the nodes held in it, the calling in gold.
    pathsOf(tree).forEach((path, column) => {
      const { x, y } = nodeRect({ column, row: 0 })
      const heading = pathHeading(character, path)
      const colour = heading.calling ? GOLD : `#${PATHS[path].colour.toString(16).padStart(6, '0')}`
      container.add(scene.add.text(x + 2, y + 8, heading.text, { fontFamily: FONT, fontSize: '14px', color: colour }))
    })

    // The tier bands: a faint rule over each tier's first row, its level in the left gutter.
    const bands = scene.add.graphics()
    container.add(bands)
    for (const { label, firstRow } of tierBands(tree)) {
      const { y } = nodeRect({ column: 0, row: firstRow })
      bands.lineStyle(1, 0x4a3d28, 0.8)
      bands.lineBetween(2, y - 2, TREE_W, y - 2)
      container.add(scene.add.text(1, y + 1, label, { fontFamily: FONT, fontSize: '10px', color: DIM }))
    }

    const lines = scene.add.graphics()
    container.add(lines)
    for (const node of nodes) {
      const from = nodes.find((other) => other.perk === node.from)
      if (!from) continue
      const start = nodeRect(from)
      const end = nodeRect(node)
      const y0 = start.y + NODE_H / 2
      const y1 = end.y + NODE_H / 2
      // Down the column's left gutter, from the node required to the one that requires it.
      const gutter = start.x - 5
      lines.lineStyle(2, perkRanks(character, node.perk) > 0 ? GOLD_EDGE : 0x4a3d28, 1)
      lines.beginPath()
      lines.moveTo(start.x, y0)
      lines.lineTo(gutter, y0)
      lines.lineTo(gutter, y1)
      lines.lineTo(end.x, y1)
      lines.strokePath()
    }
    for (const node of nodes) this.buildNode(scene, container, node)

    const style = { fontFamily: FONT, fontSize: '12px', color: DIM }
    this.strip = [
      scene.add.text(TREE_X, TREE_STRIP_Y, '', { ...style, color: TEXT, wordWrap: { width: STRIP_W } }),
      scene.add.text(TREE_X, TREE_STRIP_Y, '', { ...style, wordWrap: { width: STRIP_W } }),
      scene.add.text(TREE_X, TREE_STRIP_Y, '', { ...style, color: GOLD, wordWrap: { width: STRIP_W } }),
    ]
    container.add(this.strip)
    this.describe(null)
  }

  private buildNode(scene: Phaser.Scene, container: Phaser.GameObjects.Container, node: TreeNode): void {
    const { character, clickable, onClick } = this.options
    const { x, y } = nodeRect(node)
    const id = node.perk
    const state = nodeState(character, id)
    const live = clickable(id)
    const marked = this.options.marked?.(id) ?? live
    const capstone = (PERKS[id] as Perk).tier === 'capstone'
    const faint = state === 'closed' || state === 'locked'
    const fill = state === 'taken' ? 0x3a2f1c : 0x1b1712
    const fillAlpha = faint ? 0.5 : 0.95
    const edge = marked ? GOLD_EDGE : state === 'taken' ? 0x8a6d2a : state === 'locked' ? LOCKED_EDGE : state === 'open' ? 0x6b5a3a : 0x3a3024
    const bg = scene.add
      .rectangle(x, y, NODE_W, NODE_H, fill, fillAlpha)
      .setOrigin(0)
      .setStrokeStyle(marked ? 2 : 1, edge)
    container.add(bg)
    if (capstone) {
      // A capstone's double gold frame: an inner one inside the node's own edge; a locked one's outer edge is rust.
      container.add(
        scene.add
          .rectangle(x + 3, y + 3, NODE_W - 6, NODE_H - 6)
          .setOrigin(0)
          .setStrokeStyle(1, GOLD_EDGE, faint ? 0.5 : 1),
      )
      if (!marked) bg.setStrokeStyle(state === 'locked' ? 2 : 1, state === 'locked' ? LOCKED_EDGE : GOLD_EDGE, faint ? 0.7 : 1)
    }
    container.add(
      scene.add.rectangle(x, y, KIND_EDGE_W, NODE_H, KIND_COLOURS[nodeKind(id)], faint ? 0.5 : 1).setOrigin(0),
    )
    const mark = state === 'taken' ? '  ✓' : state === 'locked' ? '  ✕' : ''
    const words = `${capstone ? '★ ' : ''}${nodeLabel(character, id)}${mark}`
    const label = scene.add
      .text(x + KIND_EDGE_W + (NODE_W - KIND_EDGE_W) / 2, y + NODE_H / 2, words, {
        fontFamily: FONT,
        fontSize: '13px',
        color: state === 'taken' ? GOLD : state === 'open' ? TEXT : state === 'locked' ? LOCKED : DIM,
        align: 'center',
      })
      .setOrigin(0.5)
    // A name too long for one line takes two, smaller.
    if (label.width > NODE_W - KIND_EDGE_W - 8) label.setFontSize(11).setWordWrapWidth(NODE_W - KIND_EDGE_W - 8)
    container.add(label)

    bg.setInteractive({ useHandCursor: live })
    bg.on('pointerover', () => {
      if (live) bg.setFillStyle(0x4a3c22, 0.95)
      this.describe(id)
    })
    bg.on('pointerout', () => {
      if (live) bg.setFillStyle(fill, fillAlpha)
      this.describe(null)
    })
    bg.on('pointerdown', () => {
      if (live) onClick(id)
    })
  }

  /** Fills the strip for the node pointed at, a line under another, or with the rule when there is none. */
  private describe(perk: PerkId | null): void {
    const [what, asks, hint] = this.strip
    if (perk === null) {
      what.setText(this.options.rule).setColor(DIM)
      asks.setText('')
      hint.setText('')
      return
    }
    what.setText(clampLines(nodeSummary(this.options.character, perk))).setColor(TEXT)
    asks.setText(`Asks: ${describePerkRequirements(perk)}`).setY(what.y + what.height + 2)
    hint.setText(clampLines(this.options.hint(perk), STRIP_HINT_LINES)).setY(asks.y + asks.height + 2)
  }
}
