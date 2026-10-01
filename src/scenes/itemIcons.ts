import type Phaser from 'phaser'
import type { ItemIcon } from '../inventory/inventory.ts'

type IconDrawer = (g: Phaser.GameObjects.Graphics, size: number) => void

const drawSword: IconDrawer = (g, size) => {
  const c = size / 2
  g.fillStyle(0x8a5a2b, 1)
  g.fillRect(c - 8, size * 0.58, 16, 6)
  g.fillStyle(0xd9d9d9, 1)
  g.fillRect(c - 3, size * 0.06, 6, size * 0.54)
  g.fillStyle(0xf2f2f2, 1)
  g.fillTriangle(c - 3, size * 0.06, c + 3, size * 0.06, c, size * 0.0)
  g.fillStyle(0x5c3a1a, 1)
  g.fillRect(c - 2, size * 0.64, 4, size * 0.26)
  g.fillStyle(0xc9a227, 1)
  g.fillCircle(c, size * 0.93, 4)
}

const drawShield: IconDrawer = (g, size) => {
  const w = size * 0.56
  const left = (size - w) / 2
  const top = size * 0.1
  const midY = size * 0.56
  const bottom = size * 0.92
  g.fillStyle(0x7a5230, 1)
  g.beginPath()
  g.moveTo(left, top)
  g.lineTo(left + w, top)
  g.lineTo(left + w, midY)
  g.lineTo(size / 2, bottom)
  g.lineTo(left, midY)
  g.closePath()
  g.fillPath()
  g.lineStyle(2, 0xc9a227, 1)
  g.strokePath()
  g.fillStyle(0xc9a227, 1)
  g.fillCircle(size / 2, size * 0.4, 4)
}

const drawArmor: IconDrawer = (g, size) => {
  const c = size / 2
  g.fillStyle(0x616a73, 1)
  g.fillRoundedRect(c - 13, size * 0.18, 26, size * 0.56, 4)
  g.fillCircle(c - 15, size * 0.26, 6)
  g.fillCircle(c + 15, size * 0.26, 6)
  g.fillStyle(0x4a5158, 1)
  g.fillRoundedRect(c - 13, size * 0.18, 9, size * 0.56, 4)
  g.fillStyle(0x8a929a, 1)
  g.fillRect(c - 3, size * 0.2, 6, size * 0.5)
}

const ICON_DRAWERS: Record<ItemIcon, IconDrawer> = {
  sword: drawSword,
  shield: drawShield,
  armor: drawArmor,
}

/** Draws an item's icon into a size×size box with its top-left at the graphics origin. */
export function drawItemIcon(g: Phaser.GameObjects.Graphics, icon: ItemIcon, size: number): void {
  ICON_DRAWERS[icon](g, size)
}
