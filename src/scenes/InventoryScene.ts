import Phaser from 'phaser'
import { deriveCombatStats, type Character } from '../character/character.ts'
import { formatDamage, type CombatantStats } from '../combat/combat.ts'
import type { GameState } from '../game/gameState.ts'
import { EQUIPMENT_SLOT_LABELS, describeItemStats, type EquipmentSlot, type Item } from '../inventory/inventory.ts'
import { drawItemIcon } from './itemIcons.ts'

type PanelTab = 'character' | 'inventory'

interface InventoryData {
  game: GameState
  tab?: PanelTab
}

const PANEL_W = 720
const PANEL_H = 500
const SLOT_SIZE = 46
const DOLL_X = 190
const DOLL_Y = 210
const STATS_X = 440
const TAB_W = 140
const TAB_H = 32

interface TabButton {
  bg: Phaser.GameObjects.Rectangle
  text: Phaser.GameObjects.Text
}

export class InventoryScene extends Phaser.Scene {
  private activeTab: PanelTab = 'inventory'
  private character!: Character
  private stats!: CombatantStats
  private dimBg!: Phaser.GameObjects.Rectangle
  private panel!: Phaser.GameObjects.Container
  private characterContent!: Phaser.GameObjects.Container
  private inventoryContent!: Phaser.GameObjects.Container
  private tabButtons: Record<PanelTab, TabButton> = {} as Record<PanelTab, TabButton>
  private tooltip!: Phaser.GameObjects.Container
  private tooltipText!: Phaser.GameObjects.Text
  private tooltipBg!: Phaser.GameObjects.Rectangle

  constructor() {
    super('Inventory')
  }

  create(data: InventoryData): void {
    this.character = data.game.player
    this.stats = deriveCombatStats(this.character)

    this.dimBg = this.add.rectangle(0, 0, 1, 1, 0x000000, 0.6).setOrigin(0.5)
    this.panel = this.add.container(0, 0)

    this.buildFrame()
    this.buildTabs()

    this.characterContent = this.add.container(0, 0)
    this.panel.add(this.characterContent)
    this.buildCharacterTab()

    this.inventoryContent = this.add.container(0, 0)
    this.panel.add(this.inventoryContent)
    this.buildPaperdoll()
    this.buildStats()
    this.buildBackpack()
    this.buildTooltip()

    this.showTab(data?.tab ?? 'inventory')

    this.layout()
    this.scale.on(Phaser.Scale.Events.RESIZE, this.layout, this)
    // Phaser doesn't call a shutdown() method on scenes; it only emits SHUTDOWN.
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off(Phaser.Scale.Events.RESIZE, this.layout, this)
    })

    this.input.keyboard?.on('keydown-I', () => this.onPressI())
    this.input.keyboard?.on('keydown-C', () => this.onPressC())
    this.input.keyboard?.on('keydown-ESC', () => this.close())
  }

  // ---- build: frame & tabs -------------------------------------------------

  private buildFrame(): void {
    const panelBg = this.add
      .rectangle(PANEL_W / 2, PANEL_H / 2, PANEL_W, PANEL_H, 0x241d15, 0.98)
      .setStrokeStyle(3, 0xc9a227)
    const hint = this.add
      .text(PANEL_W - 16, 26, '[ESC] Close', { fontFamily: 'monospace', fontSize: '12px', color: '#8a7a5a' })
      .setOrigin(1, 0.5)
    this.panel.add([panelBg, hint])
  }

  private buildTabs(): void {
    const y = 26
    const centerX = PANEL_W / 2
    this.tabButtons.character = this.createTabButton('Character', centerX - TAB_W / 2 - 6, y, 'character')
    this.tabButtons.inventory = this.createTabButton('Inventory', centerX + TAB_W / 2 + 6, y, 'inventory')
  }

  private createTabButton(label: string, x: number, y: number, tab: PanelTab): TabButton {
    const bg = this.add.rectangle(x, y, TAB_W, TAB_H, 0x1b1712, 0.95).setStrokeStyle(2, 0x6b5a3a)
    bg.setInteractive({ useHandCursor: true })
    bg.on('pointerdown', () => this.showTab(tab))
    const text = this.add
      .text(x, y, label, { fontFamily: 'monospace', fontSize: '15px', color: '#8a7a5a' })
      .setOrigin(0.5)
    this.panel.add([bg, text])
    return { bg, text }
  }

  private showTab(tab: PanelTab): void {
    this.activeTab = tab
    this.characterContent.setVisible(tab === 'character')
    this.inventoryContent.setVisible(tab === 'inventory')
    if (tab !== 'inventory') this.hideTooltip()

    for (const key of Object.keys(this.tabButtons) as PanelTab[]) {
      const active = key === tab
      const button = this.tabButtons[key]
      button.bg.setStrokeStyle(2, active ? 0xc9a227 : 0x6b5a3a)
      button.text.setColor(active ? '#e8c766' : '#8a7a5a')
    }
  }

  // ---- build: character tab -------------------------------------------------

  private buildCharacterTab(): void {
    const title = this.add
      .text(PANEL_W / 2, 70, this.character.name, { fontFamily: 'monospace', fontSize: '26px', color: '#e8c766' })
      .setOrigin(0.5)
    const subtitle = this.add
      .text(PANEL_W / 2, 98, this.character.className, { fontFamily: 'monospace', fontSize: '14px', color: '#8a7a5a' })
      .setOrigin(0.5)
    this.characterContent.add([title, subtitle])

    const portraitX = 190
    const portraitY = 260
    const portraitBg = this.add
      .rectangle(portraitX, portraitY, 170, 230, 0x14100c, 0.8)
      .setStrokeStyle(2, 0x6b5a3a)
    const portrait = this.add.image(portraitX, portraitY + 100, 'warrior').setOrigin(0.5, 1)
    const portraitScale = Math.min(130 / portrait.width, 200 / portrait.height)
    portrait.setScale(portraitScale)
    this.characterContent.add([portraitBg, portrait])

    const lines = [`Class:         ${this.character.className}`, ``, ...this.statLines()]
    const statsBlock = this.add.text(360, 170, lines.join('\n'), {
      fontFamily: 'monospace',
      fontSize: '15px',
      color: '#d8c9a3',
      lineSpacing: 14,
    })
    this.characterContent.add(statsBlock)

    this.buildCharacterBadges(430)
  }

  private buildCharacterBadges(y: number): void {
    const badges: Array<{ label: string; value: string }> = [
      { label: 'AC', value: `${this.stats.ac}` },
      { label: 'HP', value: `${this.character.hp}/${this.stats.maxHp}` },
      { label: 'ATK', value: `+${this.stats.attackBonus}` },
    ]
    const badgeW = 90
    const badgeH = 56
    const gap = 14
    const centerX = PANEL_W / 2
    const totalW = badges.length * badgeW + (badges.length - 1) * gap
    const startX = centerX - totalW / 2 + badgeW / 2

    badges.forEach((badge, i) => {
      const x = startX + i * (badgeW + gap)
      const bg = this.add.rectangle(x, y, badgeW, badgeH, 0x1b1712, 0.9).setStrokeStyle(2, 0x6b5a3a)
      const label = this.add
        .text(x, y - 14, badge.label, { fontFamily: 'monospace', fontSize: '11px', color: '#8a7a5a' })
        .setOrigin(0.5)
      const value = this.add
        .text(x, y + 10, badge.value, { fontFamily: 'monospace', fontSize: '16px', color: '#e8c766' })
        .setOrigin(0.5)
      this.characterContent.add([bg, label, value])
    })
  }

  // ---- build: inventory tab -------------------------------------------------

  private buildPaperdoll(): void {
    const dollBoxBg = this.add
      .rectangle(DOLL_X, DOLL_Y, 150, 210, 0x14100c, 0.8)
      .setStrokeStyle(2, 0x4a3d28)
    this.inventoryContent.add(dollBoxBg)

    const doll = this.add.image(DOLL_X, DOLL_Y + 95, 'warrior').setOrigin(0.5, 1)
    const dollScale = Math.min(110 / doll.width, 180 / doll.height)
    doll.setScale(dollScale)
    this.inventoryContent.add(doll)

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
    const item = this.character.equipment[slot]
    const bg = this.add.rectangle(x, y, SLOT_SIZE, SLOT_SIZE, 0x1b1712, 0.9).setStrokeStyle(2, 0x6b5a3a)
    this.inventoryContent.add(bg)

    if (item) {
      const g = this.add.graphics({ x: x - SLOT_SIZE / 2, y: y - SLOT_SIZE / 2 })
      drawItemIcon(g, item.icon, SLOT_SIZE)
      this.inventoryContent.add(g)

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
      this.inventoryContent.add(label)
    }
  }

  private buildStats(): void {
    const nameText = this.add
      .text(STATS_X, 70, this.character.name, { fontFamily: 'monospace', fontSize: '20px', color: '#e8c766' })
      .setOrigin(0, 0.5)
    const classText = this.add
      .text(STATS_X, 94, this.character.className, { fontFamily: 'monospace', fontSize: '13px', color: '#8a7a5a' })
      .setOrigin(0, 0.5)

    const statsBody = this.add.text(STATS_X, 130, this.statLines().join('\n'), {
      fontFamily: 'monospace',
      fontSize: '14px',
      color: '#d8c9a3',
      lineSpacing: 12,
    })

    this.inventoryContent.add([nameText, classText, statsBody])
  }

  private statLines(): string[] {
    return [
      `Hit Points:    ${this.character.hp} / ${this.stats.maxHp}`,
      `Armor Class:   ${this.stats.ac}`,
      `Attack Bonus:  +${this.stats.attackBonus}`,
      `Damage:        ${formatDamage(this.stats.damage)}`,
      `Speed:         ${this.stats.speed}`,
      `Action Points: ${this.stats.actionPoints}`,
    ]
  }

  private buildBackpack(): void {
    const title = this.add
      .text(PANEL_W / 2, 360, 'Backpack', { fontFamily: 'monospace', fontSize: '14px', color: '#8a7a5a' })
      .setOrigin(0.5)
    this.inventoryContent.add(title)

    const cols = 6
    const gap = 8
    const totalW = cols * SLOT_SIZE + (cols - 1) * gap
    const startX = PANEL_W / 2 - totalW / 2 + SLOT_SIZE / 2
    const startY = 400

    this.character.backpack.forEach((item, i) => {
      const col = i % cols
      const row = Math.floor(i / cols)
      const x = startX + col * (SLOT_SIZE + gap)
      const y = startY + row * (SLOT_SIZE + gap)
      this.createBackpackSlot(x, y, item)
    })
  }

  private createBackpackSlot(x: number, y: number, item: Item | null): void {
    const bg = this.add.rectangle(x, y, SLOT_SIZE, SLOT_SIZE, 0x1b1712, 0.9).setStrokeStyle(2, 0x4a3d28)
    this.inventoryContent.add(bg)

    if (item) {
      const g = this.add.graphics({ x: x - SLOT_SIZE / 2, y: y - SLOT_SIZE / 2 })
      drawItemIcon(g, item.icon, SLOT_SIZE)
      this.inventoryContent.add(g)

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
    this.inventoryContent.add(this.tooltip)
  }

  private showTooltip(item: Item, x: number, y: number): void {
    this.tooltipText.setText([item.name, item.description, ...describeItemStats(item.stats)].join('\n'))
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

  private onPressI(): void {
    if (this.activeTab === 'inventory') {
      this.close()
    } else {
      this.showTab('inventory')
    }
  }

  private onPressC(): void {
    if (this.activeTab === 'character') {
      this.close()
    } else {
      this.showTab('character')
    }
  }

  private close(): void {
    this.scene.stop()
    this.scene.resume('Battle')
  }
}
