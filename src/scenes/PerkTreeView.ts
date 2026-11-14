import type Phaser from 'phaser'
import type { Character } from '../character/character.ts'
import { PERKS, describePerkRequirements, nodeKind, type NodeKind, type Perk, type PerkId } from '../character/perks.ts'
import { PATHS, TREE_IDS, pathsOf, type TreeId } from '../character/trees.ts'
import type { Point } from './boardGeometry.ts'
import { addPanelButton } from './panelButton.ts'
import {
  KIND_TAB_W,
  LEGEND_Y,
  NODE_H,
  NODE_W,
  STRIP_HINT_LINES,
  TREE_STRIP_Y,
  TREE_W,
  TREE_X,
  bandRects,
  clampLines,
  columnX,
  legendLayout,
  linkToneOf,
  nodeLabel,
  nodeRect,
  nodeState,
  nodeSummary,
  pathHeading,
  treeLayout,
  treeLinks,
  treeTabLabel,
  treeTabRect,
  type LinkTone,
  type TreeNode,
} from './perkTree.ts'

/** Every tree's nodes, laid out once. */
const LAYOUTS = Object.fromEntries(TREE_IDS.map((tree) => [tree, treeLayout(tree)])) as unknown as Record<TreeId, readonly TreeNode[]>

/**
 * Each kind's colour and glyph, drawn dark on the coloured tab at a node's
 * left and again in the legend: a passive a dim gold disc, an at-will active
 * an amber blade (a triangle), a mana active a violet diamond, a spell a blue star.
 */
type Glyph = 'disc' | 'blade' | 'diamond' | 'star'
const KIND_LOOKS: Record<NodeKind, { colour: number; glyph: Glyph }> = {
  passive: { colour: 0xa8946a, glyph: 'disc' },
  'at-will': { colour: 0xe09a36, glyph: 'blade' },
  mana: { colour: 0xb07ae8, glyph: 'diamond' },
  spell: { colour: 0x4f9ae8, glyph: 'star' },
}
/** The lines into a node by how it stands: gold into one taken, tan into one open, a dark line into one closed. */
const LINK_LOOKS: Record<LinkTone, { colour: number; width: number; alpha: number }> = {
  lit: { colour: 0xe0b83a, width: 2.5, alpha: 1 },
  open: { colour: 0xa8916a, width: 2, alpha: 1 },
  dim: { colour: 0x4a3d2a, width: 1.5, alpha: 1 },
}
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
/** A tier band's shading, every other band, and its rule and label. */
const BAND_FILL = 0xffe6b0
const BAND_RULE = 0x5a4a30

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
 * heading with the nodes held in it (the calling's in gold), a legend of the
 * node kinds, the tier bands with their levels, each path's trunk and the
 * brackets from a node required (`treeLinks`, brighter into nodes taken or
 * open), every node (perkTree.ts) with a tab in its kind's colour and glyph,
 * a capstone haloed in a double gold frame, and a strip under it for the
 * node pointed at. Like `PartyColumn` it imports Phaser and has no
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

    // The legend of the node kinds, under the tabs.
    const legend = scene.add.graphics()
    container.add(legend)
    for (const { kind, label, x, textX } of legendLayout()) {
      drawKindTab(legend, kind, x, LEGEND_Y - 5, 10, 10, 1)
      container.add(scene.add.text(textX, LEGEND_Y, label, { fontFamily: FONT, fontSize: '10px', color: DIM }).setOrigin(0, 0.5))
    }

    // Row 0: each path's name and the nodes held in it, the calling in gold, over its trunk.
    pathsOf(tree).forEach((path, column) => {
      const { y } = nodeRect({ column, row: 0 })
      const heading = pathHeading(character, path)
      const colour = heading.calling ? GOLD : `#${PATHS[path].colour.toString(16).padStart(6, '0')}`
      container.add(scene.add.text(columnX(column), y + 6, heading.text, { fontFamily: FONT, fontSize: '14px', color: colour }))
    })

    // The tier bands: every other one faintly shaded, a rule over each, its level in a tag in the left gutter.
    const bands = scene.add.graphics()
    container.add(bands)
    bandRects(tree).forEach(({ label, y, height }, i) => {
      if (i % 2 === 1) bands.fillStyle(BAND_FILL, 0.035).fillRect(TREE_X - 24, y, TREE_W - TREE_X + 30, height)
      bands.lineStyle(1, BAND_RULE, 0.9).lineBetween(TREE_X - 24, y, TREE_W + 6, y)
      bands.fillStyle(0x16120d, 1).fillRoundedRect(3, y + 3, TREE_X - 6, 15, 3)
      bands.lineStyle(1, BAND_RULE, 1).strokeRoundedRect(3, y + 3, TREE_X - 6, 15, 3)
      container.add(
        scene.add
          .text(3 + (TREE_X - 6) / 2, y + 11, label, { fontFamily: FONT, fontSize: '10px', fontStyle: 'bold', color: GOLD })
          .setOrigin(0.5),
      )
    })

    // The trunks and brackets, dim lines first so that the bright ones run over them where they meet.
    const lines = scene.add.graphics()
    container.add(lines)
    const links = treeLinks(tree).map((link) => ({ ...link, tone: linkToneOf(link, (perk) => nodeState(character, perk)) }))
    const order: LinkTone[] = ['dim', 'open', 'lit']
    for (const tone of order) {
      for (const { points, kind } of links.filter((link) => link.tone === tone)) {
        const look = LINK_LOOKS[tone]
        lines.lineStyle(look.width, look.colour, look.alpha)
        lines.strokePoints(points as Phaser.Math.Vector2[], false)
        // A bracket ends in an arrowhead into the node that requires; a trunk in a knot at its branch.
        const end = points[points.length - 1]
        lines.fillStyle(look.colour, look.alpha)
        if (kind === 'requires') lines.fillTriangle(end.x, end.y, end.x + 5, end.y - 3.5, end.x + 5, end.y + 3.5)
        else lines.fillCircle(points[1].x, points[1].y, tone === 'dim' ? 2 : 2.5)
      }
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
    const fill = state === 'taken' ? 0x3a2f1c : capstone ? 0x2a2214 : 0x1b1712
    const fillAlpha = faint ? 0.6 : 0.95
    const edge = marked ? GOLD_EDGE : state === 'taken' ? 0x8a6d2a : state === 'locked' ? LOCKED_EDGE : state === 'open' ? 0x7a6844 : 0x3a3024
    if (capstone) {
      // A capstone's halo, outside its own edge: gold, or rust for one locked.
      const halo = state === 'locked' ? LOCKED_EDGE : GOLD_EDGE
      container.add(scene.add.rectangle(x - 3, y - 3, NODE_W + 6, NODE_H + 6, halo, faint ? 0.06 : 0.14).setOrigin(0).setStrokeStyle(1, halo, faint ? 0.45 : 0.8))
    }
    const bg = scene.add
      .rectangle(x, y, NODE_W, NODE_H, fill, fillAlpha)
      .setOrigin(0)
      .setStrokeStyle(marked ? 2 : 1, edge)
    container.add(bg)
    if (capstone) {
      // The double gold frame: an inner one inside the node's own edge; a locked one's outer edge is rust.
      container.add(
        scene.add
          .rectangle(x + KIND_TAB_W + 2, y + 3, NODE_W - KIND_TAB_W - 5, NODE_H - 6)
          .setOrigin(0)
          .setStrokeStyle(1, GOLD_EDGE, faint ? 0.5 : 1),
      )
      if (!marked) bg.setStrokeStyle(2, state === 'locked' ? LOCKED_EDGE : GOLD_EDGE, faint ? 0.7 : 1)
    }
    const tab = scene.add.graphics()
    drawKindTab(tab, nodeKind(id), x, y, KIND_TAB_W, NODE_H, faint ? 0.6 : 1)
    container.add(tab)
    const mark = state === 'taken' ? '  ✓' : state === 'locked' ? '  ✕' : ''
    const words = capstone ? `★ ${nodeLabel(character, id)} ★${mark}` : `${nodeLabel(character, id)}${mark}`
    const colour = state === 'taken' ? GOLD : state === 'open' ? TEXT : state === 'locked' ? LOCKED : capstone ? '#a89060' : DIM
    const label = scene.add
      .text(x + KIND_TAB_W + (NODE_W - KIND_TAB_W) / 2, y + NODE_H / 2, words, {
        fontFamily: FONT,
        fontSize: '13px',
        fontStyle: state === 'taken' || capstone ? 'bold' : '',
        color: colour,
        align: 'center',
      })
      .setOrigin(0.5)
    // A name too long for one line takes two, smaller.
    if (label.width > NODE_W - KIND_TAB_W - 8) label.setFontSize(11).setWordWrapWidth(NODE_W - KIND_TAB_W - 8)
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

/** A kind's tab: a block of its colour with its glyph drawn dark in the middle, at `alpha` (faint for a closed node). */
function drawKindTab(g: Phaser.GameObjects.Graphics, kind: NodeKind, x: number, y: number, width: number, height: number, alpha: number): void {
  const { colour, glyph } = KIND_LOOKS[kind]
  g.fillStyle(colour, alpha * 0.9).fillRect(x, y, width, height)
  const cx = x + width / 2
  const cy = y + height / 2
  const r = Math.min(width, height) / 2 - (width > 12 ? 2 : 1.5)
  g.fillStyle(0x15110c, 0.9)
  if (glyph === 'disc') g.fillCircle(cx, cy, r * 0.8)
  else if (glyph === 'blade') g.fillTriangle(cx - r * 0.7, cy - r, cx - r * 0.7, cy + r, cx + r, cy)
  else if (glyph === 'diamond') g.fillPoints([{ x: cx, y: cy - r }, { x: cx + r * 0.8, y: cy }, { x: cx, y: cy + r }, { x: cx - r * 0.8, y: cy }] as Phaser.Math.Vector2[], true)
  else {
    const star = Array.from({ length: 8 }, (_, i) => {
      const angle = (i * Math.PI) / 4 - Math.PI / 2
      const reach = i % 2 === 0 ? r * 1.05 : r * 0.42
      return { x: cx + Math.cos(angle) * reach, y: cy + Math.sin(angle) * reach }
    })
    g.fillPoints(star as Phaser.Math.Vector2[], true)
  }
}
