import type Phaser from 'phaser'
import { soundVolume } from './audioSettings.ts'
import type { Rect } from './mapScroll.ts'

const FONT = 'monospace'

/** How a panel button is drawn. */
export interface PanelButtonLook {
  /** A disabled button is drawn faint and takes no clicks. */
  enabled?: boolean
  /** Gold-edged: the one to press next, or the one chosen. */
  marked?: boolean
  fontSize?: number
}

/**
 * A framed button in the party screen's and character creation's own style,
 * added to `container` and centred on `at`. Game objects only: what a click
 * does is its scene's to say.
 */
export function addPanelButton(
  scene: Phaser.Scene,
  container: Phaser.GameObjects.Container,
  at: Rect,
  label: string,
  onClick: () => void,
  { enabled = true, marked = false, fontSize = 14 }: PanelButtonLook = {},
): void {
  const edge = !enabled ? 0x3a3024 : marked ? 0xc9a227 : 0x6b5a3a
  const color = !enabled ? '#5a4f3c' : marked ? '#e8c766' : '#d8c9a3'
  const bg = scene.add.rectangle(at.x, at.y, at.width, at.height, 0x1b1712, 0.95).setStrokeStyle(2, edge)
  const text = scene.add.text(at.x, at.y, label, { fontFamily: FONT, fontSize: `${fontSize}px`, color }).setOrigin(0.5)
  // A label too long for its button shrinks to fit, as a save slot's line can be.
  text.setScale(Math.min(1, (at.width - 12) / text.width))
  container.add([bg, text])
  if (!enabled) return
  bg.setInteractive({ useHandCursor: true })
  bg.on('pointerover', () => bg.setFillStyle(0x3a2f1c, 0.95))
  bg.on('pointerout', () => bg.setFillStyle(0x1b1712, 0.95))
  bg.on('pointerdown', () => {
    scene.sound.play('sfx_ui_click', { volume: soundVolume('sfx_ui_click') })
    onClick()
  })
}
