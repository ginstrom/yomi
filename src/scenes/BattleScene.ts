import Phaser from 'phaser'
import {
  GOBLIN_STATS,
  WARRIOR_STATS,
  resolveAttack,
  type AttackResult,
  type CombatantStats,
} from '../combat/combat.ts'

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

type Phase = 'player' | 'enemy' | 'over'

const GRID_COLS = 6
const GRID_ROWS = 4
const TILE_SIZE = 56
const FLOOR_SQUASH_Y = 0.6
const LOG_LINES = 5

export class BattleScene extends Phaser.Scene {
  private phase: Phase = 'player'
  private round = 1
  private warrior!: Unit
  private goblin!: Unit

  private floorLayer!: Phaser.GameObjects.Container
  private unitLayer!: Phaser.GameObjects.Container

  private roundText!: Phaser.GameObjects.Text
  private bannerText!: Phaser.GameObjects.Text
  private logText!: Phaser.GameObjects.Text
  private logLines: string[] = []

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
    this.phase = 'player'
    this.round = 1

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

    this.logText = this.add.text(20, 0, '', {
      fontFamily: 'monospace',
      fontSize: '14px',
      color: '#cfd8dc',
      lineSpacing: 4,
    })

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
    this.scale.on(Phaser.Scale.Events.RESIZE, () => this.layout())

    this.input.keyboard?.on('keydown-I', () => this.openInventory())
    this.input.keyboard?.on('keydown-C', () => this.openCharacter())
    this.input.keyboard?.on('keydown-ESC', () => this.openMenu())

    this.pushLog('The goblin blocks the warrior\'s path. Battle begins!')
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
    if (this.phase === 'over') {
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

    this.logText.setPosition(20, height - 130)
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
    if (this.phase === 'over') {
      this.roundText.setText(`Battle over — ${this.round} rounds fought`)
      return
    }
    this.roundText.setText(`Round ${this.round} — ${this.phase === 'player' ? "Warrior's" : "Goblin's"} turn`)
  }

  private pushLog(line: string): void {
    this.logLines.push(line)
    if (this.logLines.length > LOG_LINES) this.logLines.shift()
    this.logText.setText(this.logLines.join('\n'))
  }

  private describeAttack(attackerName: string, defenderName: string, result: AttackResult): string {
    if (result.fumble) return `${attackerName} rolls 1 — fumbles the attack!`
    if (result.hit) {
      const crit = result.critical ? ' CRITICAL HIT!' : ''
      return `${attackerName} rolls ${result.attackRoll} (${result.totalToHit} to hit) — HITS ${defenderName} for ${result.damage} dmg.${crit}`
    }
    return `${attackerName} rolls ${result.attackRoll} (${result.totalToHit} to hit) — MISSES ${defenderName}.`
  }

  // ---- turn logic -----------------------------------------------------

  private onAttack(): void {
    if (this.phase !== 'player') return
    this.setButtonEnabled(this.attackButton, false)
    this.setButtonEnabled(this.endTurnButton, false)

    const result = resolveAttack(this.warrior.stats, this.goblin.stats.ac)
    this.goblin.hp = Math.max(this.goblin.hp - result.damage, 0)
    this.refreshHpDisplay(this.goblin)
    this.pushLog(this.describeAttack('Warrior', 'Goblin', result))
    this.flashHit(this.goblin, result)

    if (this.goblin.hp <= 0) {
      this.endBattle(true)
      return
    }

    this.time.delayedCall(600, () => this.startEnemyTurn())
  }

  private onEndTurn(): void {
    if (this.phase !== 'player') return
    this.setButtonEnabled(this.attackButton, false)
    this.setButtonEnabled(this.endTurnButton, false)
    this.pushLog('Warrior holds position and ends the turn.')
    this.time.delayedCall(300, () => this.startEnemyTurn())
  }

  private startEnemyTurn(): void {
    this.phase = 'enemy'
    this.updateRoundText()

    this.time.delayedCall(500, () => {
      const result = resolveAttack(this.goblin.stats, this.warrior.stats.ac)
      this.warrior.hp = Math.max(this.warrior.hp - result.damage, 0)
      this.refreshHpDisplay(this.warrior)
      this.pushLog(this.describeAttack('Goblin', 'Warrior', result))
      this.flashHit(this.warrior, result)

      if (this.warrior.hp <= 0) {
        this.endBattle(false)
        return
      }

      this.round += 1
      this.phase = 'player'
      this.updateRoundText()
      this.setButtonEnabled(this.attackButton, true)
      this.setButtonEnabled(this.endTurnButton, true)
    })
  }

  private flashHit(unit: Unit, result: AttackResult): void {
    if (!result.hit) return
    unit.sprite.setTint(0xff8a80)
    this.time.delayedCall(150, () => unit.sprite.clearTint())
  }

  private endBattle(playerWon: boolean): void {
    this.phase = 'over'
    this.attackButton.setVisible(false)
    this.endTurnButton.setVisible(false)
    this.menuButton.setVisible(true)
    this.bannerText.setText(playerWon ? 'VICTORY!' : 'DEFEAT')
    this.bannerText.setColor(playerWon ? '#66bb6a' : '#ef5350')
    this.bannerText.setVisible(true)
    this.pushLog(playerWon ? 'The goblin falls. Victory!' : 'The warrior falls. Defeat...')
    this.updateRoundText()
  }
}
