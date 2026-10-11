import Phaser from 'phaser'
import {
  deriveCombatStats,
  dropEquipped,
  dropFromBackpack,
  equipFromBackpack,
  isTwoHanded,
  pickUp,
  unequipToBackpack,
  type Character,
} from '../character/character.ts'
import { xpToNextLevel } from '../character/progression.ts'
import { formatDamage, type CombatantStats } from '../combat/combat.ts'
import type { GameState } from '../game/gameState.ts'
import { EQUIPMENT_SLOT_LABELS, describeItemStats, type EquipmentSlot, type Item } from '../inventory/inventory.ts'
import { ITEM_ICON_KEYS, ITEM_ICON_SCALE } from './itemIcons.ts'
import { soundVolume } from './audioSettings.ts'
import { isSecondaryClick } from './clicks.ts'
import { SlotScroll } from './slotScroll.ts'

type PanelTab = 'character' | 'inventory'

interface InventoryData {
  game: GameState
  tab?: PanelTab
  /**
   * What changing gear costs in action points, charged once by the battle when
   * the panel closes however many items were moved; 0 if already paid for.
   * Null or absent makes the panel view-only.
   */
  gearApCost?: number | null
  /** The pile on the hex the character stands on, which drops go onto and pick-ups come off. */
  ground?: Item[]
}

const PANEL_W = 720
const PANEL_H = 500
const SLOT_SIZE = 46
const DOLL_X = 190
const DOLL_Y = 210
const STATS_X = 440
/** The backpack sits under the paperdoll and the ground under the stats. */
const BACKPACK_COLS = 6
const GROUND_COLS = 5
const GROUND_ROWS = 2
const SLOT_GAP = 8
const SLOT_TITLE_Y = 367
const SLOT_GRID_Y = 404
const SCROLLBAR_W = 8
const TAB_W = 140
const TAB_H = 32

interface TabButton {
  bg: Phaser.GameObjects.Rectangle
  text: Phaser.GameObjects.Text
}

/** Centre of the `index`th slot of a grid whose first column is at `startX`. */
function slotPosition(startX: number, index: number, cols: number): { x: number; y: number } {
  return {
    x: startX + (index % cols) * (SLOT_SIZE + SLOT_GAP),
    y: SLOT_GRID_Y + Math.floor(index / cols) * (SLOT_SIZE + SLOT_GAP),
  }
}

export class InventoryScene extends Phaser.Scene {
  private activeTab: PanelTab = 'inventory'
  private character!: Character
  private stats!: CombatantStats
  private gearApCost: number | null = null
  private ground: Item[] = []
  /** Which rows of the ground pile the grid shows. */
  private groundScroll = new SlotScroll(GROUND_COLS, GROUND_ROWS)
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

  preload(): void {
    for (const key of Object.values(ITEM_ICON_KEYS)) this.load.image(key, `assets/sprites/${key}.png`)
  }

  create(data: InventoryData): void {
    this.character = data.game.player
    this.gearApCost = data.gearApCost ?? null
    this.ground = data.ground ?? []
    this.groundScroll = new SlotScroll(GROUND_COLS, GROUND_ROWS)
    // Right-clicking an item drops it.
    this.input.mouse?.disableContextMenu()

    this.dimBg = this.add.rectangle(0, 0, 1, 1, 0x000000, 0.6).setOrigin(0.5)
    this.panel = this.add.container(0, 0)

    this.buildFrame()
    this.buildTabs()

    this.characterContent = this.add.container(0, 0)
    this.inventoryContent = this.add.container(0, 0)
    this.panel.add([this.characterContent, this.inventoryContent])
    this.buildContent()

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
    this.input.on('wheel', (_pointer: Phaser.Input.Pointer, _objects: unknown, _dx: number, dy: number) =>
      this.onWheel(dy),
    )
  }

  /** Draws both tabs from the character as it now stands; rerun after each change of gear. */
  private buildContent(): void {
    this.stats = deriveCombatStats(this.character)
    this.characterContent.removeAll(true)
    this.inventoryContent.removeAll(true)
    this.buildCharacterTab()
    this.buildPaperdoll()
    this.buildStats()
    this.buildGearHint()
    this.buildBackpack()
    this.buildGround()
    this.buildTooltip()
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
    bg.on('pointerdown', () => {
      this.sound.play('sfx_ui_click', { volume: soundVolume('sfx_ui_click') })
      this.showTab(tab)
    })
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
    const { level, xp } = this.character
    const title = this.add
      .text(PANEL_W / 2, 70, this.character.name, { fontFamily: 'monospace', fontSize: '26px', color: '#e8c766' })
      .setOrigin(0.5)
    const subtitle = this.add
      .text(PANEL_W / 2, 98, this.classLine(), { fontFamily: 'monospace', fontSize: '14px', color: '#8a7a5a' })
      .setOrigin(0.5)
    this.characterContent.add([title, subtitle])

    const portraitX = 190
    const portraitY = 260
    const portraitBg = this.add
      .rectangle(portraitX, portraitY, 170, 230, 0x14100c, 0.8)
      .setStrokeStyle(2, 0x6b5a3a)
    const portrait = this.add.image(portraitX, portraitY + 100, 'warrior').setOrigin(0.5, 1)
    // A whole-number scale keeps the sprite's pixels square.
    const portraitScale = Math.floor(Math.min(160 / portrait.width, 200 / portrait.height))
    portrait.setScale(portraitScale)
    this.characterContent.add([portraitBg, portrait])

    const lines = [`Experience:    ${xp} / ${xpToNextLevel(level)}`, ``, ...this.statLines()]
    // Top-aligned with the portrait frame, so the block ends clear of the badges below.
    const statsBlock = this.add.text(360, portraitY - 115, lines.join('\n'), {
      fontFamily: 'monospace',
      fontSize: '15px',
      color: '#d8c9a3',
      lineSpacing: 14,
    })
    this.characterContent.add(statsBlock)

    this.buildCharacterBadges(440)
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
    const dollScale = Math.floor(Math.min(140 / doll.width, 180 / doll.height))
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
    const { equipment } = this.character
    // A two-handed weapon fills the off hand too, shown there as a ghost of the weapon.
    const ghost = slot === 'offHand' && !equipment.offHand && isTwoHanded(equipment.mainHand)
    const heldIn: EquipmentSlot = ghost ? 'mainHand' : slot
    const item = equipment[heldIn]
    const bg = this.add.rectangle(x, y, SLOT_SIZE, SLOT_SIZE, 0x1b1712, 0.9).setStrokeStyle(2, 0x6b5a3a)
    this.inventoryContent.add(bg)

    if (item) {
      const icon = this.add.image(x, y, ITEM_ICON_KEYS[item.icon]).setScale(ITEM_ICON_SCALE)
      if (ghost) icon.setAlpha(0.35)
      this.inventoryContent.add(icon)

      bg.setInteractive({ useHandCursor: true })
      bg.on('pointerover', () => {
        bg.setStrokeStyle(2, 0xc9a227)
        this.showTooltip(item, x, y - SLOT_SIZE / 2 - 10)
      })
      bg.on('pointerout', () => {
        bg.setStrokeStyle(2, 0x6b5a3a)
        this.hideTooltip()
      })
      bg.on('pointerdown', (pointer: Phaser.Input.Pointer) =>
        this.changeGear(() =>
          isSecondaryClick(pointer)
            ? dropEquipped(this.character, heldIn, this.ground)
            : unequipToBackpack(this.character, heldIn),
        ),
      )
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
      .text(STATS_X, 94, this.classLine(), { fontFamily: 'monospace', fontSize: '13px', color: '#8a7a5a' })
      .setOrigin(0, 0.5)

    const statsBody = this.add.text(STATS_X, 130, this.statLines().join('\n'), {
      fontFamily: 'monospace',
      fontSize: '14px',
      color: '#d8c9a3',
      lineSpacing: 12,
    })

    this.inventoryContent.add([nameText, classText, statsBody])
  }

  private buildGearHint(): void {
    const hint =
      this.gearApCost === null
        ? 'Gear can be changed only on your turn, with an action point to spare.'
        : this.gearApCost === 0
          ? 'Click to equip, stow or pick up; right- or Ctrl+click to drop. Free until you next move or attack.'
          : `Click to equip, stow or pick up; right- or Ctrl+click to drop. Costs ${this.gearApCost} AP on closing, however many changes.`
    this.inventoryContent.add(
      this.add.text(STATS_X, 300, hint, {
        fontFamily: 'monospace',
        fontSize: '12px',
        color: '#8a7a5a',
        wordWrap: { width: PANEL_W - STATS_X - 20 },
      }),
    )
  }

  /** "Level 2 Fighter", under the character's name. */
  private classLine(): string {
    return `Level ${this.character.level} ${this.character.className}`
  }

  private statLines(): string[] {
    return [
      `Hit Points:    ${this.character.hp} / ${this.stats.maxHp}`,
      `Armor Class:   ${this.stats.ac}`,
      `Attack Bonus:  +${this.stats.attackBonus}`,
      `Damage:        ${formatDamage(this.stats.damage)}`,
      `Attack Cost:   ${this.stats.attackApCost} AP`,
      `Action Points: ${this.stats.actionPoints}`,
    ]
  }

  private buildBackpack(): void {
    const startX = this.buildSlotGrid('Backpack', DOLL_X, BACKPACK_COLS)
    this.character.backpack.forEach((item, i) => {
      const { x, y } = slotPosition(startX, i, BACKPACK_COLS)
      this.createItemSlot(x, y, item, (pointer) =>
        isSecondaryClick(pointer)
          ? dropFromBackpack(this.character, i, this.ground)
          : equipFromBackpack(this.character, i, this.ground),
      )
    })
  }

  /** What lies on the character's hex, oldest first. A pile deeper than the grid scrolls. */
  private buildGround(): void {
    this.groundScroll.setCount(this.ground.length)
    const scrolls = this.groundScroll.maxRow > 0
    const title = scrolls ? `Ground (${this.ground.length})` : 'Ground'
    const gridW = GROUND_COLS * SLOT_SIZE + (GROUND_COLS - 1) * SLOT_GAP
    const startX = this.buildSlotGrid(title, STATS_X + gridW / 2, GROUND_COLS)
    const first = this.groundScroll.firstIndex
    for (let i = 0; i < GROUND_COLS * GROUND_ROWS; i++) {
      const { x, y } = slotPosition(startX, i, GROUND_COLS)
      const index = first + i
      this.createItemSlot(x, y, this.ground[index] ?? null, () => pickUp(this.character, this.ground, index))
    }
    this.buildGroundScrollbar(STATS_X + gridW + 4)
  }

  /** The bar beside the ground grid, drawn only when the pile is deeper than the grid. */
  private buildGroundScrollbar(x: number): void {
    const trackY = SLOT_GRID_Y - SLOT_SIZE / 2
    const trackH = GROUND_ROWS * SLOT_SIZE + (GROUND_ROWS - 1) * SLOT_GAP
    const thumb = this.groundScroll.thumb(trackH, 16)
    if (!thumb) return

    const track = this.add.rectangle(x, trackY, SCROLLBAR_W, trackH, 0x14100c, 0.9).setOrigin(0)
    const bar = this.add.rectangle(x, trackY + thumb.y, SCROLLBAR_W, thumb.height, 0x6b5a3a).setOrigin(0)
    track.setInteractive({ useHandCursor: true })
    // A click on the track above or below the thumb scrolls that way.
    track.on('pointerdown', (_pointer: Phaser.Input.Pointer, _localX: number, localY: number) =>
      this.scrollGround(localY < thumb.y ? -1 : 1),
    )
    this.inventoryContent.add([track, bar])
  }

  /** Titles a grid of slots centred on `centerX`; returns the x of its first column. */
  private buildSlotGrid(title: string, centerX: number, cols: number): number {
    this.inventoryContent.add(
      this.add
        .text(centerX, SLOT_TITLE_Y, title, { fontFamily: 'monospace', fontSize: '14px', color: '#8a7a5a' })
        .setOrigin(0.5),
    )
    return centerX - ((cols - 1) * (SLOT_SIZE + SLOT_GAP)) / 2
  }

  /** A backpack or ground space; clicking the item in it makes the change `onClick` returns the success of. */
  private createItemSlot(
    x: number,
    y: number,
    item: Item | null,
    onClick: (pointer: Phaser.Input.Pointer) => boolean,
  ): void {
    const bg = this.add.rectangle(x, y, SLOT_SIZE, SLOT_SIZE, 0x1b1712, 0.9).setStrokeStyle(2, 0x4a3d28)
    this.inventoryContent.add(bg)

    if (item) {
      this.inventoryContent.add(this.add.image(x, y, ITEM_ICON_KEYS[item.icon]).setScale(ITEM_ICON_SCALE))

      bg.setInteractive({ useHandCursor: true })
      bg.on('pointerover', () => {
        bg.setStrokeStyle(2, 0xc9a227)
        this.showTooltip(item, x, y - SLOT_SIZE / 2 - 10)
      })
      bg.on('pointerout', () => {
        bg.setStrokeStyle(2, 0x4a3d28)
        this.hideTooltip()
      })
      bg.on('pointerdown', (pointer: Phaser.Input.Pointer) => this.changeGear(() => onClick(pointer)))
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
    // Kept inside the panel: the slots at its edges are narrower than their tooltips.
    const reach = this.tooltipBg.width / 2 + 4
    this.tooltip.setPosition(Phaser.Math.Clamp(x, reach, PANEL_W - reach), y)
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
    // Scaled down (never up) to fit, keeping 16 px clear on each side; slot hit areas and
    // tooltips scale with the panel. At MIN_GAME_SIZE (main.ts) it fits unscaled.
    const scale = Math.max(0, Math.min(1, (width - 32) / PANEL_W, (height - 32) / PANEL_H))
    this.panel.setScale(scale)
    this.panel.setPosition((width - PANEL_W * scale) / 2, (height - PANEL_H * scale) / 2)
  }

  // ---- actions -------------------------------------------------------------

  /** Applies a change of gear, if the battle allows one now, and redraws the panel to match. */
  private changeGear(change: () => boolean): void {
    const onGround = this.ground.length
    if (this.gearApCost === null || !change()) return
    // A dropped item lands at the end of the pile: bring it into view.
    if (this.ground.length > onGround) {
      this.groundScroll.setCount(this.ground.length)
      this.groundScroll.scrollToEnd()
    }
    this.sound.play('sfx_ui_click', { volume: soundVolume('sfx_ui_click') })
    // Next tick: the redraw destroys the slot whose click handler this runs in.
    this.time.delayedCall(0, () => this.buildContent())
  }

  private onWheel(deltaY: number): void {
    if (this.activeTab === 'inventory' && this.groundScroll.wheel(deltaY)) this.buildContent()
  }

  private scrollGround(rows: number): void {
    if (!this.groundScroll.scrollBy(rows)) return
    // Next tick: the redraw destroys the track whose click handler this runs in.
    this.time.delayedCall(0, () => this.buildContent())
  }

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
