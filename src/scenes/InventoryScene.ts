import Phaser from 'phaser'
import { WARRIOR_STATS } from '../combat/combat.ts'
import {
  EQUIPMENT_SLOT_LABELS,
  PLAYER_BACKPACK,
  PLAYER_EQUIPMENT,
  type EquipmentSlot,
  type Item,
} from '../inventory/inventory.ts'

interface InventoryData {
  hp?: number
}

const PANEL_W = 720
const PANEL_H = 500
const SLOT_SIZE = 46
const DOLL_X = 190
const DOLL_Y = 210
const STATS_X = 440

export class InventoryScene extends Phaser.Scene {
  private dimBg!: Phaser.GameObjects.Rectangle
  private panel!: Phaser.GameObjects.Container
  private tooltip!: Phaser.GameObjects.Container
  private tooltipText!: Phaser.GameObjects.Text
  private tooltipBg!: Phaser.GameObjects.Rectangle

  constructor() {
    super('Inventory')
  }

  create(data: InventoryData): void {
    this.dimBg = this.add.rectangle(0, 0, 1, 1, 0x000000, 0.6).setOrigin(0.5)
    this.panel = this.add.container(0, 0)

    this.buildFrame()
    this.buildPaperdoll()
    this.buildStats(data)
    this.buildBackpack()
    this.buildTooltip()

    this.layout()
    this.scale.on(Phaser.Scale.Events.RESIZE, this.layout, this)

    this.input.keyboard?.on('keydown-I', () => this.close())
    this.input.keyboard?.on('keydown-ESC', () => this.close())
  }

  shutdown(): void {
    this.scale.off(Phaser.Scale.Events.RESIZE, this.layout, this)
  }

  // ---- build -------------------------------------------------------------

  private buildFrame(): void {
    const panelBg = this.add
      .rectangle(PANEL_W / 2, PANEL_H / 2, PANEL_W, PANEL_H, 0x241d15, 0.98)
      .setStrokeStyle(3, 0xc9a227)
    const title = this.add
      .text(PANEL_W / 2, 26, 'Inventory', { fontFamily: 'monospace', fontSize: '22px', color: '#e8c766' })
      .setOrigin(0.5)
    const hint = this.add
      .text(PANEL_W - 16, 26, '[I] Close', { fontFamily: 'monospace', fontSize: '12px', color: '#8a7a5a' })
      .setOrigin(1, 0.5)
    this.panel.add([panelBg, title, hint])
  }

  private buildPaperdoll(): void {
    const dollBoxBg = this.add
      .rectangle(DOLL_X, DOLL_Y, 150, 210, 0x14100c, 0.8)
      .setStrokeStyle(2, 0x4a3d28)
    this.panel.add(dollBoxBg)

    const doll = this.add.image(DOLL_X, DOLL_Y + 95, 'warrior').setOrigin(0.5, 1)
    const dollScale = Math.min(110 / doll.width, 180 / doll.height)
    doll.setScale(dollScale)
    this.panel.add(doll)

    const leftX = DOLL_X - 115
    const rightX = DOLL_X + 115
    const rowYs = [90, 150, 210, 270]

    this.createSlot(leftX, rowYs[0], 'head')
    this.createSlot(leftX, rowYs[1], 'armor')
    this.createSlot(leftX, rowYs[2], 'mainHand')
    this.createSlot(leftX, rowYs[3], 'gloves')

    this.createSlot(rightX, rowYs[0], 'neck')
    this.createSlot(rightX, rowYs[1], 'cloak')
    this.createSlot(rightX, rowYs[2], 'offHand')
    this.createSlot(rightX, rowYs[3], 'belt')

    this.createSlot(DOLL_X - 60, 330, 'boots')
    this.createSlot(DOLL_X, 330, 'ring1')
    this.createSlot(DOLL_X + 60, 330, 'ring2')
  }

  private createSlot(x: number, y: number, slot: EquipmentSlot): void {
    const item = PLAYER_EQUIPMENT[slot]
    const bg = this.add.rectangle(x, y, SLOT_SIZE, SLOT_SIZE, 0x1b1712, 0.9).setStrokeStyle(2, 0x6b5a3a)
    this.panel.add(bg)

    if (item) {
      const g = this.add.graphics({ x: x - SLOT_SIZE / 2, y: y - SLOT_SIZE / 2 })
      item.draw(g, SLOT_SIZE)
      this.panel.add(g)

      bg.setInteractive({ useHandCursor: true })
      bg.on('pointerover', () => {
        bg.setStrokeStyle(2, 0xc9a227)
        this.showTooltip(item, x, y - SLOT_SIZE / 2 - 10)
      })
      bg.on('pointerout', () => {
        bg.setStrokeStyle(2, 0x6b5a3a)
        this.hideTooltip()
      })
    } else {
      const label = this.add
        .text(x, y, EQUIPMENT_SLOT_LABELS[slot], {
          fontFamily: 'monospace',
          fontSize: '9px',
          color: '#665a44',
        })
        .setOrigin(0.5)
      this.panel.add(label)
    }
  }

  private buildStats(data: InventoryData): void {
    const hp = data.hp ?? WARRIOR_STATS.maxHp

    const nameText = this.add
      .text(STATS_X, 70, WARRIOR_STATS.name, { fontFamily: 'monospace', fontSize: '20px', color: '#e8c766' })
      .setOrigin(0, 0.5)
    const classText = this.add
      .text(STATS_X, 94, 'Fighter', { fontFamily: 'monospace', fontSize: '13px', color: '#8a7a5a' })
      .setOrigin(0, 0.5)

    const lines = [
      `Armor Class:   ${WARRIOR_STATS.ac}`,
      `Hit Points:    ${hp} / ${WARRIOR_STATS.maxHp}`,
      `Attack Bonus:  +${WARRIOR_STATS.attackBonus}`,
      `Damage:        1d${WARRIOR_STATS.damage.sides}+${WARRIOR_STATS.damage.bonus}`,
    ]
    const statsBody = this.add.text(STATS_X, 130, lines.join('\n'), {
      fontFamily: 'monospace',
      fontSize: '14px',
      color: '#d8c9a3',
      lineSpacing: 12,
    })

    this.panel.add([nameText, classText, statsBody])
  }

  private buildBackpack(): void {
    const title = this.add
      .text(PANEL_W / 2, 360, 'Backpack', { fontFamily: 'monospace', fontSize: '14px', color: '#8a7a5a' })
      .setOrigin(0.5)
    this.panel.add(title)

    const cols = 6
    const gap = 8
    const totalW = cols * SLOT_SIZE + (cols - 1) * gap
    const startX = PANEL_W / 2 - totalW / 2 + SLOT_SIZE / 2
    const startY = 400

    PLAYER_BACKPACK.forEach((item, i) => {
      const col = i % cols
      const row = Math.floor(i / cols)
      const x = startX + col * (SLOT_SIZE + gap)
      const y = startY + row * (SLOT_SIZE + gap)
      this.createBackpackSlot(x, y, item)
    })
  }

  private createBackpackSlot(x: number, y: number, item: Item | null): void {
    const bg = this.add.rectangle(x, y, SLOT_SIZE, SLOT_SIZE, 0x1b1712, 0.9).setStrokeStyle(2, 0x4a3d28)
    this.panel.add(bg)

    if (item) {
      const g = this.add.graphics({ x: x - SLOT_SIZE / 2, y: y - SLOT_SIZE / 2 })
      item.draw(g, SLOT_SIZE)
      this.panel.add(g)

      bg.setInteractive({ useHandCursor: true })
      bg.on('pointerover', () => {
        bg.setStrokeStyle(2, 0xc9a227)
        this.showTooltip(item, x, y - SLOT_SIZE / 2 - 10)
      })
      bg.on('pointerout', () => {
        bg.setStrokeStyle(2, 0x4a3d28)
        this.hideTooltip()
      })
    }
  }

  private buildTooltip(): void {
    this.tooltipText = this.add.text(0, 0, '', {
      fontFamily: 'monospace',
      fontSize: '12px',
      color: '#ffffff',
    })
    this.tooltipBg = this.add.rectangle(0, 0, 10, 10, 0x000000, 0.85).setStrokeStyle(1, 0xc9a227)
    this.tooltip = this.add.container(0, 0, [this.tooltipBg, this.tooltipText]).setVisible(false)
    this.panel.add(this.tooltip)
  }

  private showTooltip(item: Item, x: number, y: number): void {
    this.tooltipText.setText(`${item.name}\n${item.description}`)
    this.tooltipText.setPosition(-this.tooltipText.width / 2, -this.tooltipText.height - 6)
    this.tooltipBg.setSize(this.tooltipText.width + 16, this.tooltipText.height + 12)
    this.tooltipBg.setPosition(0, -this.tooltipText.height / 2 - 6)
    this.tooltip.setPosition(x, y)
    this.tooltip.setVisible(true)
  }

  private hideTooltip(): void {
    this.tooltip.setVisible(false)
  }

  // ---- layout -------------------------------------------------------------

  private layout(): void {
    const { width, height } = this.scale
    this.dimBg.setSize(width, height)
    this.dimBg.setPosition(width / 2, height / 2)
    this.panel.setPosition((width - PANEL_W) / 2, (height - PANEL_H) / 2)
  }

  // ---- actions -------------------------------------------------------------

  private close(): void {
    this.scene.stop()
    this.scene.resume('Battle')
  }
}
