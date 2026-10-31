import Phaser from 'phaser'
import type { PartyListProbe } from '../testHook.ts'
import { soundVolume } from './audioSettings.ts'
import {
  COLUMN_COLOR,
  COLUMN_EDGE,
  FRAME_ACTIVE_COLOR,
  FRAME_COLOR,
  FRAME_HOVER_COLOR,
  PORTRAIT_SCALE,
  hpBarColor,
  portraitKey,
} from './partyPanel.ts'
import { PARTY_LIST_W, partyEntryBarRect, partyEntryRect, type PartyListEntry } from './partyList.ts'

const CONFRONTING_COLOR = '#e53935'
const OUTLINED = { fontFamily: 'monospace', fontSize: '11px', stroke: '#000000', strokeThickness: 3 }

interface EntryTile {
  id: string
  image: Phaser.GameObjects.Image
  frame: Phaser.GameObjects.Rectangle
  /** A small figure of a person, drawn as shapes, beside the member count. */
  glyph: Phaser.GameObjects.Graphics
  count: Phaser.GameObjects.Text
  /** A red "!" while the party stands before monsters. */
  alert: Phaser.GameObjects.Text
  hpBack: Phaser.GameObjects.Rectangle
  hpFill: Phaser.GameObjects.Rectangle
}

/**
 * The world map's list of parties, in an opaque strip down its right side,
 * drawn where partyList.ts places each entry. It shows the entries as they are
 * when `refresh` is called and reports clicks and hovers by the party's id;
 * what they do is the scene's to decide.
 */
export class PartyListView {
  private readonly scene: Phaser.Scene
  private readonly onClick: (id: string) => void
  private readonly onHover: (id: string | null) => void
  private readonly bg: Phaser.GameObjects.Rectangle
  private readonly edge: Phaser.GameObjects.Rectangle
  /**
   * Holds every entry's objects, made with the strip, so that entries built
   * later stay at its place in the display list: under whatever the scene drew
   * after it, such as the world map's outcome screen.
   */
  private readonly entryLayer: Phaser.GameObjects.Container
  private tiles: EntryTile[] = []
  private entries: PartyListEntry[] = []
  private selected = ''
  private hovered: string | null = null
  private width = 0

  constructor(scene: Phaser.Scene, onClick: (id: string) => void, onHover: (id: string | null) => void) {
    this.scene = scene
    this.onClick = onClick
    this.onHover = onHover
    // Interactive with no handler, so a click between entries is not a click on the map under the strip.
    this.bg = scene.add.rectangle(0, 0, PARTY_LIST_W, 1, COLUMN_COLOR).setOrigin(0).setInteractive()
    this.edge = scene.add.rectangle(0, 0, 1, 1, COLUMN_EDGE).setOrigin(0)
    this.entryLayer = scene.add.container(0, 0)
  }

  /** The strip runs down the right of a window `width` wide, from `top` to `bottom`. */
  layout(width: number, top: number, bottom: number): void {
    this.width = width
    const height = Math.max(0, bottom - top)
    this.bg.setPosition(width - PARTY_LIST_W, top).setSize(PARTY_LIST_W, height)
    // The interactive area follows the new size.
    this.bg.input?.hitArea.setTo(0, 0, PARTY_LIST_W, height)
    this.edge.setPosition(width - PARTY_LIST_W, top).setSize(1, height)
    this.tiles.forEach((tile, index) => this.place(tile, index))
  }

  /** Redraws every entry as its party now stands, the `selected` one framed in gold. */
  refresh(entries: PartyListEntry[], selected: string): void {
    const ids = entries.map((entry) => entry.id).join('\n')
    if (ids !== this.tiles.map((tile) => tile.id).join('\n')) this.rebuild(entries)
    this.entries = entries
    this.selected = selected
    entries.forEach((entry, index) => {
      const tile = this.tiles[index]
      const bar = partyEntryBarRect(index, this.width)
      const ratio = entry.maxHp > 0 ? Phaser.Math.Clamp(entry.hp / entry.maxHp, 0, 1) : 0
      tile.image.setTexture(portraitKey(entry.members[0].portrait))
      tile.count.setText(`${entry.members.length}`)
      tile.alert.setVisible(entry.confronting !== null)
      tile.hpFill.setSize(bar.width * ratio, bar.height).setFillStyle(hpBarColor(ratio))
      this.strokeFrame(tile)
    })
  }

  /** Where each entry is on screen and what it shows, for the scene's probe. */
  probe(): PartyListProbe[] {
    return this.entries.map((entry, index) => {
      const { x, y, width, height } = partyEntryRect(index, this.width)
      return {
        x: x + width / 2,
        y: y + height / 2,
        id: entry.id,
        members: entry.members.length,
        selected: entry.id === this.selected,
        confronting: entry.confronting !== null,
        hovered: entry.id === this.hovered,
      }
    })
  }

  private rebuild(entries: PartyListEntry[]): void {
    for (const tile of this.tiles) {
      for (const object of [tile.image, tile.frame, tile.glyph, tile.count, tile.alert, tile.hpBack, tile.hpFill]) object.destroy()
    }
    if (this.hovered !== null && !entries.some((entry) => entry.id === this.hovered)) {
      this.hovered = null
      this.onHover(null)
    }
    const scene = this.scene
    this.tiles = entries.map((entry) => {
      const image = scene.add.image(0, 0, portraitKey(entry.members[0].portrait)).setScale(PORTRAIT_SCALE)
      const frame = scene.add.rectangle(0, 0, 1, 1).setInteractive({ useHandCursor: true })
      const glyph = scene.add.graphics()
      const count = scene.add.text(0, 0, '', { ...OUTLINED, color: '#ffffff' })
      const alert = scene.add
        .text(0, 0, '!', { ...OUTLINED, fontSize: '15px', color: CONFRONTING_COLOR })
        .setOrigin(1, 0)
      const hpBack = scene.add.rectangle(0, 0, 1, 1, 0x212121).setOrigin(0).setStrokeStyle(1, 0x000000)
      const hpFill = scene.add.rectangle(0, 0, 1, 1, 0x43a047).setOrigin(0)
      const tile: EntryTile = { id: entry.id, image, frame, glyph, count, alert, hpBack, hpFill }
      this.entryLayer.add([image, frame, glyph, count, alert, hpBack, hpFill])
      frame.on('pointerover', () => this.setHovered(tile.id))
      frame.on('pointerout', () => this.setHovered(null))
      frame.on('pointerdown', () => {
        scene.sound.play('sfx_ui_click', { volume: soundVolume('sfx_ui_click') })
        this.onClick(tile.id)
      })
      return tile
    })
    this.tiles.forEach((tile, index) => this.place(tile, index))
  }

  private place(tile: EntryTile, index: number): void {
    const at = partyEntryRect(index, this.width)
    const bar = partyEntryBarRect(index, this.width)
    const centreX = at.x + at.width / 2
    const centreY = at.y + at.height / 2
    tile.image.setPosition(centreX, centreY)
    tile.frame.setPosition(centreX, centreY).setSize(at.width, at.height)
    tile.frame.input?.hitArea.setTo(0, 0, at.width, at.height)
    // The person: a head over shoulders, outlined in black like the text beside it.
    const gx = at.x + 6
    const gy = at.y + 4
    tile.glyph
      .clear()
      .fillStyle(0x000000, 1)
      .fillCircle(gx, gy + 2, 3.5)
      .fillRect(gx - 4.5, gy + 5, 9, 7)
      .fillStyle(0xffffff, 1)
      .fillCircle(gx, gy + 2, 2)
      .fillRect(gx - 3, gy + 6, 6, 5)
    tile.count.setPosition(at.x + 12, at.y + 1)
    tile.alert.setPosition(at.x + at.width - 3, at.y - 1)
    tile.hpBack.setPosition(bar.x, bar.y).setSize(bar.width, bar.height)
    tile.hpFill.setPosition(bar.x, bar.y)
    const entry = this.entries[index]
    if (entry) {
      const ratio = entry.maxHp > 0 ? Phaser.Math.Clamp(entry.hp / entry.maxHp, 0, 1) : 0
      tile.hpFill.setSize(bar.width * ratio, bar.height)
    }
  }

  /** Forgets the hovered entry without telling the scene, for a pointer that left with no `pointerout`. */
  clearHover(): void {
    this.hovered = null
    for (const tile of this.tiles) this.strokeFrame(tile)
  }

  private setHovered(id: string | null): void {
    this.hovered = id
    for (const tile of this.tiles) this.strokeFrame(tile)
    this.onHover(id)
  }

  private strokeFrame(tile: EntryTile): void {
    const selected = tile.id === this.selected
    const color = selected ? FRAME_ACTIVE_COLOR : tile.id === this.hovered ? FRAME_HOVER_COLOR : FRAME_COLOR
    tile.frame.setStrokeStyle(selected ? 3 : 2, color)
  }
}
