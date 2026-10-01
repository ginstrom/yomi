import Phaser from 'phaser'
import { GOBLIN_STATS, WARRIOR_STATS, type CombatantStats } from '../combat/combat.ts'
import { BattleEngine, formatEvent, type BattleEvent, type Side } from '../engine/battleEngine.ts'

interface Unit {
  stats: CombatantStats
  hp: number
  sprite: Phaser.GameObjects.Sprite
  shadow: Phaser.GameObjects.Ellipse
  hpBarBg: Phaser.GameObjects.Rectangle
  hpBarFill: Phaser.GameObjects.Rectangle
  hpText: Phaser.GameObjects.Text
  nameText: Phaser.GameObjects.Text
  col: number
  row: number
}

const GRID_COLS = 6
const GRID_ROWS = 4
const TILE_SIZE = 56
const FLOOR_SQUASH_Y = 0.6
const LOG_HISTORY = 50
const LOG_VISIBLE_LINES = 5
const LOG_LINE_H = 20
const LOG_BOX_PADDING = 10
const LOG_BOX_H = LOG_VISIBLE_LINES * LOG_LINE_H + LOG_BOX_PADDING * 2
const LOG_BOX_GAP = 14

export class BattleScene extends Phaser.Scene {
  private engine!: BattleEngine
  private names!: Record<Side, string>
  private warrior!: Unit
  private goblin!: Unit

  private floorLayer!: Phaser.GameObjects.Container
  private unitLayer!: Phaser.GameObjects.Container

  private roundText!: Phaser.GameObjects.Text
  private bannerText!: Phaser.GameObjects.Text
  private logBoxBg!: Phaser.GameObjects.Rectangle
  private logScrollTrack!: Phaser.GameObjects.Rectangle
  private logScrollThumb!: Phaser.GameObjects.Rectangle
  private logText!: Phaser.GameObjects.Text
  private logLines: string[] = []
  private logScrollLines = 0
  private logAutoScroll = true

  private attackButton!: Phaser.GameObjects.Container
  private endTurnButton!: Phaser.GameObjects.Container
  private menuButton!: Phaser.GameObjects.Container

  constructor() {
    super('Battle')
  }

  preload(): void {
    this.load.image('warrior', 'assets/sprites/warrior.png')
    this.load.image('goblin', 'assets/sprites/goblin.png')
    this.load.image('tile_light', 'assets/sprites/tile_light.png')
    this.load.image('tile_dark', 'assets/sprites/tile_dark.png')
  }

  create(): void {
    this.engine = new BattleEngine({ player: WARRIOR_STATS, enemy: GOBLIN_STATS })
    this.names = { player: WARRIOR_STATS.name, enemy: GOBLIN_STATS.name }
    // Phaser reuses the scene instance on restart, so field initializers
    // don't run again — reset per-battle state explicitly.
    this.logLines = []
    this.logScrollLines = 0
    this.logAutoScroll = true

    this.floorLayer = this.add.container(0, 0)
    this.unitLayer = this.add.container(0, 0)
    this.buildFloor()

    this.warrior = this.createUnit(WARRIOR_STATS, 'warrior', 1, 2, false)
    this.goblin = this.createUnit(GOBLIN_STATS, 'goblin', GRID_COLS - 2, 2, true)
    this.refreshHpDisplay(this.warrior)
    this.refreshHpDisplay(this.goblin)

    this.roundText = this.add
      .text(20, 16, '', { fontFamily: 'monospace', fontSize: '20px', color: '#ffffff' })
      .setScrollFactor(0)

    this.logBoxBg = this.add
      .rectangle(0, 0, 10, LOG_BOX_H, 0x0d0d0d, 0.75)
      .setOrigin(0, 0)
      .setStrokeStyle(1, 0x3a3a3a)

    this.logText = this.add.text(0, 0, '', {
      fontFamily: 'monospace',
      fontSize: '14px',
      color: '#cfd8dc',
      lineSpacing: 4,
    })

    this.logScrollTrack = this.add
      .rectangle(0, 0, 4, 10, 0x2a2a2a)
      .setOrigin(0, 0)
      .setVisible(false)
      .setInteractive({ useHandCursor: true })
    this.logScrollThumb = this.add
      .rectangle(0, 0, 4, 10, 0x6b6b6b)
      .setOrigin(0, 0)
      .setVisible(false)
      .setInteractive({ useHandCursor: true })

    this.input.setDraggable(this.logScrollThumb)
    this.logScrollThumb.on('drag', (_pointer: Phaser.Input.Pointer, _dragX: number, dragY: number) =>
      this.onLogThumbDrag(dragY),
    )
    this.logScrollTrack.on('pointerdown', (pointer: Phaser.Input.Pointer) => this.onLogTrackClick(pointer))

    this.input.on(
      'wheel',
      (pointer: Phaser.Input.Pointer, _objects: unknown, _dx: number, dy: number) => this.onLogWheel(pointer, dy),
    )

    this.bannerText = this.add
      .text(0, 0, '', {
        fontFamily: 'monospace',
        fontSize: '36px',
        color: '#ffee58',
        fontStyle: 'bold',
      })
      .setOrigin(0.5)
      .setVisible(false)

    this.attackButton = this.createButton('Attack', () => this.onAttack())
    this.endTurnButton = this.createButton('End Turn', () => this.onEndTurn())
    this.menuButton = this.createButton('Back to Menu', () => this.onBackToMenu())
    this.menuButton.setVisible(false)

    this.layout()
    this.scale.on(Phaser.Scale.Events.RESIZE, this.layout, this)
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off(Phaser.Scale.Events.RESIZE, this.layout, this)
    })

    this.input.keyboard?.on('keydown-I', () => this.openInventory())
    this.input.keyboard?.on('keydown-C', () => this.openCharacter())
    this.input.keyboard?.on('keydown-ESC', () => this.openMenu())

    this.applyEvents(this.engine.getLog())
    this.updateRoundText()
  }

  private openInventory(): void {
    if (this.scene.isPaused()) return
    this.scene.launch('Inventory', { hp: this.warrior.hp, tab: 'inventory' })
    this.scene.pause()
  }

  private openCharacter(): void {
    if (this.scene.isPaused()) return
    this.scene.launch('Inventory', { hp: this.warrior.hp, tab: 'character' })
    this.scene.pause()
  }

  private openMenu(): void {
    if (this.scene.isPaused()) return
    if (this.engine.getState().phase === 'over') {
      this.scene.start('Menu', { canContinue: false })
      return
    }
    this.scene.launch('Menu', { canContinue: true })
    this.scene.bringToTop('Menu')
    this.scene.pause()
  }

  private onBackToMenu(): void {
    this.scene.start('Menu', { canContinue: false })
  }

  // ---- setup helpers -----------------------------------------------------

  private buildFloor(): void {
    for (let row = 0; row < GRID_ROWS; row++) {
      for (let col = 0; col < GRID_COLS; col++) {
        const key = (col + row) % 2 === 0 ? 'tile_light' : 'tile_dark'
        const tile = this.add.image(col * TILE_SIZE, row * TILE_SIZE, key)
        tile.setOrigin(0, 0)
        tile.setDisplaySize(TILE_SIZE, TILE_SIZE)
        this.floorLayer.add(tile)
      }
    }
    this.floorLayer.setScale(1, FLOOR_SQUASH_Y)
  }

  private createUnit(
    stats: CombatantStats,
    textureKey: string,
    col: number,
    row: number,
    flip: boolean,
  ): Unit {
    const displayHeight = textureKey === 'warrior' ? 84 : 68
    const sprite = this.add.sprite(0, 0, textureKey)
    const tex = this.textures.get(textureKey).getSourceImage()
    const aspect = tex.width / tex.height
    sprite.setDisplaySize(displayHeight * aspect, displayHeight)
    sprite.setOrigin(0.5, 1)
    sprite.setFlipX(flip)

    const shadow = this.add.ellipse(0, 0, displayHeight * 0.55, displayHeight * 0.18, 0x000000, 0.35)

    const barWidth = 64
    const hpBarBg = this.add.rectangle(0, 0, barWidth, 8, 0x212121).setOrigin(0.5, 1)
    const hpBarFill = this.add.rectangle(0, 0, barWidth, 8, 0x43a047).setOrigin(0.5, 1)
    const hpText = this.add
      .text(0, 0, '', { fontFamily: 'monospace', fontSize: '12px', color: '#ffffff' })
      .setOrigin(0.5, 1)
    const nameText = this.add
      .text(0, 0, stats.name, { fontFamily: 'monospace', fontSize: '13px', color: '#ffffff' })
      .setOrigin(0.5, 1)

    this.unitLayer.add([shadow, sprite, hpBarBg, hpBarFill, hpText, nameText])

    const unit: Unit = {
      stats,
      hp: stats.maxHp,
      sprite,
      shadow,
      hpBarBg,
      hpBarFill,
      hpText,
      nameText,
      col,
      row,
    }
    return unit
  }

  private createButton(label: string, onClick: () => void): Phaser.GameObjects.Container {
    const width = 140
    const height = 44
    const bg = this.add
      .rectangle(0, 0, width, height, 0x2b6cb0)
      .setStrokeStyle(2, 0x90cdf4)
      .setInteractive({ useHandCursor: true })
    const text = this.add
      .text(0, 0, label, { fontFamily: 'monospace', fontSize: '16px', color: '#ffffff' })
      .setOrigin(0.5)

    bg.on('pointerover', () => bg.setFillStyle(0x3182ce))
    bg.on('pointerout', () => bg.setFillStyle(0x2b6cb0))
    bg.on('pointerdown', () => {
      if (!bg.input?.enabled) return
      onClick()
    })

    const container = this.add.container(0, 0, [bg, text])
    container.setSize(width, height)
    container.setData('bg', bg)
    container.setData('text', text)
    return container
  }

  private setButtonEnabled(button: Phaser.GameObjects.Container, enabled: boolean): void {
    const bg = button.getData('bg') as Phaser.GameObjects.Rectangle
    const text = button.getData('text') as Phaser.GameObjects.Text
    bg.input!.enabled = enabled
    bg.setFillStyle(enabled ? 0x2b6cb0 : 0x424242)
    text.setAlpha(enabled ? 1 : 0.5)
  }

  // ---- layout -------------------------------------------------------------

  private layout(): void {
    const width = this.scale.width
    const height = this.scale.height

    const floorWidth = GRID_COLS * TILE_SIZE
    const floorHeight = GRID_ROWS * TILE_SIZE * FLOOR_SQUASH_Y
    const floorX = (width - floorWidth) / 2
    const floorY = Math.max(90, (height - floorHeight) / 2 - 20)

    this.floorLayer.setPosition(floorX, floorY)
    this.unitLayer.setPosition(floorX, floorY)

    this.positionUnit(this.warrior)
    this.positionUnit(this.goblin)

    this.bannerText.setPosition(width / 2, height / 2)

    const buttonY = height - 50
    this.attackButton.setPosition(width / 2 - 80, buttonY)
    this.endTurnButton.setPosition(width / 2 + 80, buttonY)
    this.menuButton.setPosition(width / 2, buttonY)

    const buttonTop = buttonY - 22
    const logBoxW = width - 40
    const logBoxX = 20
    const logBoxY = buttonTop - LOG_BOX_GAP - LOG_BOX_H

    this.logBoxBg.setPosition(logBoxX, logBoxY)
    this.logBoxBg.setSize(logBoxW, LOG_BOX_H)
    this.logText.setPosition(logBoxX + LOG_BOX_PADDING, logBoxY + LOG_BOX_PADDING)

    this.renderLog()
  }

  private tileCenter(col: number, row: number): { x: number; y: number } {
    return {
      x: col * TILE_SIZE + TILE_SIZE / 2,
      y: (row * TILE_SIZE + TILE_SIZE / 2) * FLOOR_SQUASH_Y,
    }
  }

  private positionUnit(unit: Unit): void {
    const { x, y } = this.tileCenter(unit.col, unit.row)
    unit.shadow.setPosition(x, y)
    unit.sprite.setPosition(x, y)
    unit.hpBarBg.setPosition(x, y - unit.sprite.displayHeight - 14)
    unit.hpBarFill.setPosition(unit.hpBarBg.x - unit.hpBarBg.displayWidth / 2, unit.hpBarBg.y)
    unit.hpBarFill.setOrigin(0, 1)
    unit.hpText.setPosition(x, unit.hpBarBg.y - 10)
    unit.nameText.setPosition(x, unit.hpText.y - 16)
  }

  private refreshHpDisplay(unit: Unit): void {
    const ratio = Phaser.Math.Clamp(unit.hp / unit.stats.maxHp, 0, 1)
    unit.hpBarFill.width = unit.hpBarBg.width * ratio
    unit.hpBarFill.setFillStyle(ratio > 0.5 ? 0x43a047 : ratio > 0.2 ? 0xfb8c00 : 0xe53935)
    unit.hpText.setText(`${Math.max(unit.hp, 0)} / ${unit.stats.maxHp}`)
  }

  private updateRoundText(): void {
    const state = this.engine.getState()
    if (state.phase === 'over') {
      this.roundText.setText(`Battle over — ${state.round} rounds fought`)
      return
    }
    this.roundText.setText(`Round ${state.round} — ${this.names[state.phase]}'s turn`)
  }

  private pushLog(line: string): void {
    this.logLines.push(line)
    if (this.logLines.length > LOG_HISTORY) this.logLines.shift()

    if (!this.logAutoScroll) {
      const maxScroll = Math.max(0, this.logLines.length - LOG_VISIBLE_LINES)
      this.logScrollLines = Math.min(this.logScrollLines + 1, maxScroll)
    }
    this.renderLog()
  }

  private renderLog(): void {
    const maxScroll = Math.max(0, this.logLines.length - LOG_VISIBLE_LINES)
    this.logScrollLines = Phaser.Math.Clamp(this.logScrollLines, 0, maxScroll)

    const start = Math.max(0, this.logLines.length - LOG_VISIBLE_LINES - this.logScrollLines)
    const visible = this.logLines.slice(start, start + LOG_VISIBLE_LINES)
    this.logText.setText(visible.join('\n'))

    this.updateLogScrollbar(maxScroll)
  }

  private onLogWheel(pointer: Phaser.Input.Pointer, deltaY: number): void {
    if (!this.logBoxBg.getBounds().contains(pointer.x, pointer.y)) return
    const maxScroll = Math.max(0, this.logLines.length - LOG_VISIBLE_LINES)
    if (maxScroll === 0) return

    const direction = deltaY > 0 ? -1 : 1
    this.logScrollLines = Phaser.Math.Clamp(this.logScrollLines + direction, 0, maxScroll)
    this.logAutoScroll = this.logScrollLines === 0
    this.renderLog()
  }

  private syncHitArea(shape: Phaser.GameObjects.Rectangle): void {
    // setInteractive() snapshots a hit-area rect at whatever size the object had
    // at that moment; it does not track later setSize() calls, so it must be
    // kept in sync manually whenever the visible rectangle is resized.
    const hitArea = shape.input?.hitArea as Phaser.Geom.Rectangle | undefined
    hitArea?.setSize(shape.width, shape.height)
  }

  private onLogThumbDrag(dragY: number): void {
    const maxScroll = Math.max(0, this.logLines.length - LOG_VISIBLE_LINES)
    if (maxScroll === 0) return

    const trackY = this.logScrollTrack.y
    const trackH = this.logScrollTrack.height
    const thumbH = this.logScrollThumb.height
    const travel = trackH - thumbH
    const clampedY = Phaser.Math.Clamp(dragY, trackY, trackY + travel)
    const scrollRatio = travel > 0 ? 1 - (clampedY - trackY) / travel : 0

    this.logScrollLines = Math.round(scrollRatio * maxScroll)
    this.logAutoScroll = this.logScrollLines === 0
    this.renderLog()
  }

  private onLogTrackClick(pointer: Phaser.Input.Pointer): void {
    const maxScroll = Math.max(0, this.logLines.length - LOG_VISIBLE_LINES)
    if (maxScroll === 0) return

    const direction = pointer.y < this.logScrollThumb.y ? 1 : -1
    this.logScrollLines = Phaser.Math.Clamp(this.logScrollLines + direction * LOG_VISIBLE_LINES, 0, maxScroll)
    this.logAutoScroll = this.logScrollLines === 0
    this.renderLog()
  }

  private updateLogScrollbar(maxScroll: number): void {
    const hasOverflow = maxScroll > 0
    this.logScrollTrack.setVisible(hasOverflow)
    this.logScrollThumb.setVisible(hasOverflow)
    if (!hasOverflow) return

    const barW = 8
    const trackX = this.logBoxBg.x + this.logBoxBg.width - barW - 4
    const trackY = this.logBoxBg.y + 4
    const trackH = LOG_BOX_H - 8
    this.logScrollTrack.setPosition(trackX, trackY)
    this.logScrollTrack.setSize(barW, trackH)
    this.syncHitArea(this.logScrollTrack)

    const visibleRatio = Math.min(1, LOG_VISIBLE_LINES / this.logLines.length)
    const thumbH = Math.max(16, trackH * visibleRatio)
    const scrollRatio = this.logScrollLines / maxScroll
    const thumbY = trackY + (trackH - thumbH) * (1 - scrollRatio)
    this.logScrollThumb.setPosition(trackX, thumbY)
    this.logScrollThumb.setSize(barW, thumbH)
    this.syncHitArea(this.logScrollThumb)
  }

  // ---- turn logic -----------------------------------------------------

  /** Renders engine events: log lines, HP bars and hit flashes all flow from here. */
  private applyEvents(events: readonly BattleEvent[]): void {
    for (const event of events) {
      this.pushLog(formatEvent(event, this.names))
      if (event.type === 'attack') {
        this.flashHit(event.defender === 'player' ? this.warrior : this.goblin, event.hit)
      }
    }
    this.syncUnitsFromEngine()
  }

  private syncUnitsFromEngine(): void {
    const state = this.engine.getState()
    this.warrior.hp = state.player.hp
    this.goblin.hp = state.enemy.hp
    this.refreshHpDisplay(this.warrior)
    this.refreshHpDisplay(this.goblin)
  }

  private onAttack(): void {
    if (this.engine.getState().phase !== 'player') return
    this.setButtonEnabled(this.attackButton, false)
    this.setButtonEnabled(this.endTurnButton, false)

    this.applyEvents(this.engine.playerAttack())

    if (this.engine.getState().phase === 'over') {
      this.endBattle()
      return
    }

    this.time.delayedCall(600, () => this.startEnemyTurn())
  }

  private onEndTurn(): void {
    if (this.engine.getState().phase !== 'player') return
    this.setButtonEnabled(this.attackButton, false)
    this.setButtonEnabled(this.endTurnButton, false)
    this.applyEvents(this.engine.playerEndTurn())
    this.time.delayedCall(300, () => this.startEnemyTurn())
  }

  private startEnemyTurn(): void {
    this.updateRoundText()

    this.time.delayedCall(500, () => {
      this.applyEvents(this.engine.enemyTurn())

      if (this.engine.getState().phase === 'over') {
        this.endBattle()
        return
      }

      this.updateRoundText()
      this.setButtonEnabled(this.attackButton, true)
      this.setButtonEnabled(this.endTurnButton, true)
    })
  }

  private flashHit(unit: Unit, hit: boolean): void {
    if (!hit) return
    unit.sprite.setTint(0xff8a80)
    this.time.delayedCall(150, () => unit.sprite.clearTint())
  }

  private endBattle(): void {
    const state = this.engine.getState()
    const playerWon = state.winner === 'player'
    this.attackButton.setVisible(false)
    this.endTurnButton.setVisible(false)
    this.menuButton.setVisible(true)
    this.bannerText.setText(playerWon ? 'VICTORY!' : 'DEFEAT')
    this.bannerText.setColor(playerWon ? '#66bb6a' : '#ef5350')
    this.bannerText.setVisible(true)
    this.updateRoundText()
    // Structured dump for balancing/AI tooling to scrape from devtools.
    console.info('[battle-log]', JSON.stringify(this.engine.getLog()))
  }
}
