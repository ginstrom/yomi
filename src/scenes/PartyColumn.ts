import Phaser from 'phaser'
import { maxHp, type Character } from '../character/character.ts'
import { PORTRAIT_IDS } from '../character/portraits.ts'
import { canAdvance } from '../character/progression.ts'
import type { PortraitProbe } from '../testHook.ts'
import { soundVolume } from './audioSettings.ts'
import {
  HEADER_BOTTOM,
  PARTY_PANEL_W,
  PORTRAIT_SCALE,
  portraitBarRect,
  portraitKey,
  portraitRect,
} from './partyPanel.ts'

const COLUMN_COLOR = 0x17130f
const COLUMN_EDGE = 0x4a3d28
const FRAME_COLOR = 0x6b5a3a
const FRAME_HOVER_COLOR = 0xd8c9a3
const FRAME_ACTIVE_COLOR = 0xe8c766
const ADVANCE_COLOR = '#9ccc65'
/** How faint the portrait of a member who has fallen is. */
const FALLEN_ALPHA = 0.3

interface Tile {
  frame: Phaser.GameObjects.Rectangle
  image: Phaser.GameObjects.Image
  level: Phaser.GameObjects.Text
  /** A "+" on a member with skill points or a perk to spend. */
  advance: Phaser.GameObjects.Text
  hpFill: Phaser.GameObjects.Rectangle
}

/**
 * The party's portraits down the left of a scene, drawn where partyPanel.ts
 * places them. It shows the characters as they are when `refresh` is called
 * and reports clicks by the member's index; what a click does is its scene's
 * to decide.
 */
export class PartyColumn {
  private readonly party: readonly Character[]
  private readonly bg: Phaser.GameObjects.Rectangle
  private readonly edge: Phaser.GameObjects.Rectangle
  private readonly tiles: Tile[]
  private active: number | null = null
  private hovered: number | null = null

  /** Queues every portrait's texture; call from a scene's preload(). */
  static preload(scene: Phaser.Scene): void {
    for (const id of PORTRAIT_IDS) scene.load.image(portraitKey(id), `assets/sprites/${portraitKey(id)}.png`)
  }

  constructor(scene: Phaser.Scene, party: readonly Character[], onClick: (index: number) => void) {
    this.party = party
    // Interactive with no handler, so a click between portraits is not a click on what lies under the column.
    this.bg = scene.add.rectangle(0, HEADER_BOTTOM, PARTY_PANEL_W, 1, COLUMN_COLOR).setOrigin(0).setInteractive()
    this.edge = scene.add.rectangle(PARTY_PANEL_W - 1, HEADER_BOTTOM, 1, 1, COLUMN_EDGE).setOrigin(0)
    this.tiles = party.map((member, index) => {
      const at = portraitRect(index)
      const bar = portraitBarRect(index)
      const centreX = at.x + at.width / 2
      const image = scene.add.image(centreX, at.y + at.height / 2, portraitKey(member.portrait)).setScale(PORTRAIT_SCALE)
      const frame = scene.add
        .rectangle(centreX, at.y + at.height / 2, at.width, at.height)
        .setInteractive({ useHandCursor: true })
      frame.on('pointerover', () => this.setHovered(index))
      frame.on('pointerout', () => this.setHovered(null))
      frame.on('pointerdown', () => {
        scene.sound.play('sfx_ui_click', { volume: soundVolume('sfx_ui_click') })
        onClick(index)
      })
      const outlined = { fontFamily: 'monospace', fontSize: '11px', stroke: '#000000', strokeThickness: 3 }
      const level = scene.add.text(at.x + 3, at.y + 1, '', { ...outlined, color: '#ffffff' })
      const advance = scene.add
        .text(at.x + at.width - 3, at.y - 1, '+', { ...outlined, fontSize: '15px', color: ADVANCE_COLOR })
        .setOrigin(1, 0)
      scene.add
        .text(centreX, at.y + at.height - 1, member.name, { ...outlined, fontSize: '10px', color: '#ffffff' })
        .setOrigin(0.5, 1)
      scene.add.rectangle(bar.x, bar.y, bar.width, bar.height, 0x212121).setOrigin(0).setStrokeStyle(1, 0x000000)
      const hpFill = scene.add.rectangle(bar.x, bar.y, bar.width, bar.height, 0x43a047).setOrigin(0)
      return { frame, image, level, advance, hpFill }
    })
    this.refresh(null)
  }

  /** The column reaches from the header to the bottom of a window `height` tall. */
  layout(height: number): void {
    const columnHeight = Math.max(0, height - HEADER_BOTTOM)
    this.bg.setSize(PARTY_PANEL_W, columnHeight)
    this.edge.setSize(1, columnHeight)
  }

  /** Redraws every portrait from its character as it now stands, marking the `active` member. */
  refresh(active: number | null): void {
    this.active = active
    this.party.forEach((member, index) => {
      const { image, level, advance, hpFill } = this.tiles[index]
      const bar = portraitBarRect(index)
      const ratio = Phaser.Math.Clamp(member.hp / maxHp(member), 0, 1)
      image.setAlpha(member.hp > 0 ? 1 : FALLEN_ALPHA)
      level.setText(`${member.level}`)
      advance.setVisible(canAdvance(member))
      // setSize, not a bare width assignment, so the shape's geometry and path follow.
      hpFill.setSize(bar.width * ratio, bar.height)
      hpFill.setFillStyle(ratio > 0.5 ? 0x43a047 : ratio > 0.2 ? 0xfb8c00 : 0xe53935)
      this.strokeFrame(index)
    })
  }

  /** Where each portrait is on screen and what it shows, for the scene's probe. */
  probe(): PortraitProbe[] {
    return this.party.map((member, index) => {
      const { x, y, width, height } = portraitRect(index)
      return {
        x: x + width / 2,
        y: y + height / 2,
        name: member.name,
        level: member.level,
        canAdvance: canAdvance(member),
        active: index === this.active,
      }
    })
  }

  private setHovered(index: number | null): void {
    const was = this.hovered
    this.hovered = index
    for (const changed of [was, index]) if (changed !== null) this.strokeFrame(changed)
  }

  private strokeFrame(index: number): void {
    const active = index === this.active
    const color = active ? FRAME_ACTIVE_COLOR : index === this.hovered ? FRAME_HOVER_COLOR : FRAME_COLOR
    this.tiles[index].frame.setStrokeStyle(active ? 3 : 2, color)
  }
}
