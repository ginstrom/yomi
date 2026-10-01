import Phaser from 'phaser'
import { deriveCombatStats } from '../character/character.ts'
import {
  BattleEngine,
  formatEvent,
  type Action,
  type BattleEvent,
  type UnitId,
  type UnitSetup,
  type UnitSnapshot,
} from '../engine/battleEngine.ts'
import { POLICIES, type PolicyName } from '../engine/policies.ts'
import { HERO_ID, goblinEncounter } from '../game/encounters.ts'
import { newGame, type GameState } from '../game/gameState.ts'
import { HexBoard, hexCorners, hexEquals, hexToPixel, pixelToHex, type BoardSize, type Hex } from '../grid/hex.ts'
import { ScrollingLog } from './scrollingLog.ts'

interface BattleData {
  game?: GameState
}

interface Unit {
  /** Holds every part below, positioned at the unit's feet, so moving and depth-sorting move it all. */
  container: Phaser.GameObjects.Container
  sprite: Phaser.GameObjects.Sprite
  hpBarBg: Phaser.GameObjects.Rectangle
  hpBarFill: Phaser.GameObjects.Rectangle
  hpText: Phaser.GameObjects.Text
  nameText: Phaser.GameObjects.Text
}

/** Corner radius of a hex in pixels, before the floor's vertical squash. */
const HEX_SIZE = 40
const FLOOR_SQUASH_Y = 0.6
const FLOOR_COLORS = [0xe0a56a, 0xd09358, 0xc0844f]
const FLOOR_EDGE = 0x7a3b35
const MOVE_HIGHLIGHT = 0x1e88e5
const MOVE_OUTLINE = 0x90caf9
const ATTACK_HIGHLIGHT = 0xe53935
const ACTIVE_OUTLINE = 0xffee58
const MOVE_STEP_MS = 140
const LOG_HISTORY = 50
const LOG_VISIBLE_LINES = 5
const LOG_LINE_H = 20
const LOG_BOX_PADDING = 10
const LOG_BOX_H = LOG_VISIBLE_LINES * LOG_LINE_H + LOG_BOX_PADDING * 2
const LOG_BOX_GAP = 14
const ENEMY_POLICY: PolicyName = 'aggressive'

/** How to draw each unit, by id. */
const APPEARANCE: Record<UnitId, { textureKey: string; displayHeight: number }> = {
  [HERO_ID]: { textureKey: 'warrior', displayHeight: 84 },
  goblin: { textureKey: 'goblin', displayHeight: 68 },
}

export class BattleScene extends Phaser.Scene {
  private gameState!: GameState
  private engine!: BattleEngine
  private board!: HexBoard
  private names!: Record<UnitId, string>
  private logDumped = false
  /** True while the player may act; off during animations and the enemy's turn. */
  private playerControl = false
  private units!: Map<UnitId, Unit>

  private floorLayer!: Phaser.GameObjects.Container
  private highlights!: Phaser.GameObjects.Graphics
  private unitLayer!: Phaser.GameObjects.Container

  private roundText!: Phaser.GameObjects.Text
  private hintText!: Phaser.GameObjects.Text
  private bannerText!: Phaser.GameObjects.Text
  private logBoxBg!: Phaser.GameObjects.Rectangle
  private logScrollTrack!: Phaser.GameObjects.Rectangle
  private logScrollThumb!: Phaser.GameObjects.Rectangle
  private logText!: Phaser.GameObjects.Text
  private log!: ScrollingLog

  private attackButton!: Phaser.GameObjects.Container
  private endTurnButton!: Phaser.GameObjects.Container
  private menuButton!: Phaser.GameObjects.Container

  constructor() {
    super('Battle')
  }

  preload(): void {
    this.load.image('warrior', 'assets/sprites/warrior.png')
    this.load.image('goblin', 'assets/sprites/goblin.png')
  }

  create(data: BattleData): void {
    this.gameState = data?.game ?? newGame()
    const player = this.gameState.player
    const setup = goblinEncounter(deriveCombatStats(player), player.hp)
    this.engine = new BattleEngine(setup, { meta: { source: 'game', enemyPolicy: ENEMY_POLICY } })
    this.board = new HexBoard(setup.board)
    this.names = Object.fromEntries(setup.units.map((u) => [u.id, u.stats.name]))
    // Phaser reuses the scene instance on restart, so field initializers
    // don't run again — reset per-battle state explicitly.
    this.log = new ScrollingLog(LOG_HISTORY, LOG_VISIBLE_LINES)
    this.logDumped = false
    this.playerControl = false

    this.floorLayer = this.add.container(0, 0)
    this.buildFloor(setup.board)
    this.highlights = this.add.graphics()
    this.floorLayer.add(this.highlights)
    this.unitLayer = this.add.container(0, 0)
    this.units = new Map(setup.units.map((u) => [u.id, this.createUnit(u)]))

    this.roundText = this.add
      .text(20, 16, '', { fontFamily: 'monospace', fontSize: '20px', color: '#ffffff' })
      .setScrollFactor(0)
    this.hintText = this.add
      .text(20, 44, 'Click a blue hex to move, a red foe to attack.', {
        fontFamily: 'monospace',
        fontSize: '13px',
        color: '#9e9e9e',
      })
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
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => this.onBoardClick(pointer))

    this.bannerText = this.add
      .text(0, 0, '', {
        fontFamily: 'monospace',
        fontSize: '36px',
        color: '#ffee58',
        fontStyle: 'bold',
        // A backing keeps the banner legible wherever it lands over the board.
        backgroundColor: '#000000b3',
        padding: { x: 16, y: 8 },
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
      // Leaving mid-battle (e.g. "New" from the pause menu) still yields a complete log.
      this.engine.abandon()
      this.dumpLog()
    })

    this.input.keyboard?.on('keydown-I', () => this.openInventory())
    this.input.keyboard?.on('keydown-C', () => this.openCharacter())
    this.input.keyboard?.on('keydown-ESC', () => this.openMenu())

    this.applyEvents(this.engine.getLog())
    // A side can enter already fallen (e.g. a hero carried over at 0 hp).
    this.continueBattle()
  }

  private openInventory(): void {
    if (this.scene.isPaused()) return
    this.scene.launch('Inventory', { game: this.gameState, tab: 'inventory' })
    this.scene.pause()
  }

  private openCharacter(): void {
    if (this.scene.isPaused()) return
    this.scene.launch('Inventory', { game: this.gameState, tab: 'character' })
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

  // ---- board geometry ------------------------------------------------------

  /** Board size in pixels, after the squash. */
  private boardPixelSize(): { width: number; height: number } {
    const { cols, rows } = this.board.size
    return {
      width: Math.sqrt(3) * HEX_SIZE * (cols + 0.5),
      height: HEX_SIZE * (1.5 * rows + 0.5) * FLOOR_SQUASH_Y,
    }
  }

  /** Centre of a hex relative to the board's top-left corner. */
  private hexCenter(h: Hex): { x: number; y: number } {
    const { x, y } = hexToPixel(h, HEX_SIZE)
    // hex(0, 0) sits half a hex in from the board's left and top edges.
    return { x: x + (Math.sqrt(3) / 2) * HEX_SIZE, y: (y + HEX_SIZE) * FLOOR_SQUASH_Y }
  }

  /** The board hex under a screen position, or null when off the board. */
  private hexAt(screenX: number, screenY: number): Hex | null {
    const localX = screenX - this.floorLayer.x - (Math.sqrt(3) / 2) * HEX_SIZE
    const localY = (screenY - this.floorLayer.y) / FLOOR_SQUASH_Y - HEX_SIZE
    const h = pixelToHex(localX, localY, HEX_SIZE)
    return this.board.contains(h) ? h : null
  }

  private hexPolygon(h: Hex): Phaser.Math.Vector2[] {
    const c = this.hexCenter(h)
    return hexCorners(HEX_SIZE).map((p) => new Phaser.Math.Vector2(c.x + p.x, c.y + p.y * FLOOR_SQUASH_Y))
  }

  // ---- setup helpers -----------------------------------------------------

  private buildFloor(size: BoardSize): void {
    const floor = this.add.graphics()
    for (const h of new HexBoard(size).hexes) {
      // A three-colouring: no two neighbouring hexes share a shade.
      const shade = (((h.q - h.r) % 3) + 3) % 3
      const polygon = this.hexPolygon(h)
      floor.fillStyle(FLOOR_COLORS[shade], 1)
      floor.fillPoints(polygon, true)
      floor.lineStyle(1, FLOOR_EDGE, 0.6)
      floor.strokePoints(polygon, true)
    }
    this.floorLayer.add(floor)
  }

  private createUnit({ id, side, stats }: UnitSetup): Unit {
    const { textureKey, displayHeight } = APPEARANCE[id]
    const sprite = this.add.sprite(0, 0, textureKey)
    const tex = this.textures.get(textureKey).getSourceImage()
    const aspect = tex.width / tex.height
    sprite.setDisplaySize(displayHeight * aspect, displayHeight)
    sprite.setOrigin(0.5, 1)
    // Sprites face right; enemies start on the right and face left.
    sprite.setFlipX(side === 'enemy')

    const shadow = this.add.ellipse(0, 0, displayHeight * 0.55, displayHeight * 0.18, 0x000000, 0.35)

    // Narrower than a hex, so neighbours' bars don't run together.
    const barWidth = 52
    const barY = -displayHeight - 14
    const hpBarBg = this.add.rectangle(0, barY, barWidth, 8, 0x212121).setOrigin(0.5, 1)
    const hpBarFill = this.add.rectangle(-barWidth / 2, barY, barWidth, 8, 0x43a047).setOrigin(0, 1)
    const hpText = this.add
      .text(0, barY - 10, '', { fontFamily: 'monospace', fontSize: '12px', color: '#ffffff' })
      .setOrigin(0.5, 1)
    const nameText = this.add
      .text(0, barY - 26, stats.name, { fontFamily: 'monospace', fontSize: '13px', color: '#ffffff' })
      .setOrigin(0.5, 1)

    const container = this.add.container(0, 0, [shadow, sprite, hpBarBg, hpBarFill, hpText, nameText])
    this.unitLayer.add(container)
    return { container, sprite, hpBarBg, hpBarFill, hpText, nameText }
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

    const board = this.boardPixelSize()
    const floorX = (width - board.width) / 2
    const floorY = Math.max(90, (height - board.height) / 2 - 20)

    this.floorLayer.setPosition(floorX, floorY)
    this.unitLayer.setPosition(floorX, floorY)
    for (const snapshot of this.engine.getState().units) this.placeUnit(snapshot.id, snapshot.position)
    this.positionBanner()

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

  /** Centres the banner between the header text and the tallest unit's name label. */
  private positionBanner(): void {
    const unitsTop =
      this.unitLayer.y +
      Math.min(...[...this.units.values()].map((u) => u.container.y + u.nameText.y - u.nameText.height))
    const headerBottom = this.hintText.y + this.hintText.height
    const y = Math.max(headerBottom + this.bannerText.height / 2, (headerBottom + unitsTop) / 2)
    this.bannerText.setPosition(this.scale.width / 2, y)
  }

  private placeUnit(id: UnitId, at: Hex): void {
    const { x, y } = this.hexCenter(at)
    this.units.get(id)!.container.setPosition(x, y)
    this.sortUnits()
  }

  /** Units lower on screen draw in front. */
  private sortUnits(): void {
    this.unitLayer.sort('y')
  }

  private refreshHpDisplay(unit: Unit, snapshot: UnitSnapshot): void {
    const ratio = Phaser.Math.Clamp(snapshot.hp / snapshot.maxHp, 0, 1)
    // setSize, not a bare width assignment, so the shape's geometry and path follow.
    unit.hpBarFill.setSize(unit.hpBarBg.width * ratio, unit.hpBarBg.height)
    unit.hpBarFill.setFillStyle(ratio > 0.5 ? 0x43a047 : ratio > 0.2 ? 0xfb8c00 : 0xe53935)
    unit.hpText.setText(`${snapshot.hp} / ${snapshot.maxHp}`)
  }

  private updateRoundText(): void {
    const state = this.engine.getState()
    if (state.phase === 'over') {
      this.roundText.setText(`Battle over — ${state.round} rounds fought`)
      return
    }
    this.roundText.setText(`Round ${state.round} — ${this.names[state.active!]}'s turn`)
  }

  /** Marks where the active player unit can move and whom it can attack. */
  private refreshHighlights(): void {
    this.highlights.clear()
    this.hintText.setVisible(this.playerControl)
    if (!this.playerControl) return

    const state = this.engine.getState()
    const positionOf = (id: UnitId) => state.units.find((u) => u.id === id)!.position
    for (const action of this.engine.legalActions()) {
      if (action.type === 'move') {
        const polygon = this.hexPolygon(action.to)
        this.highlights.fillStyle(MOVE_HIGHLIGHT, 0.55)
        this.highlights.fillPoints(polygon, true)
        this.highlights.lineStyle(1, MOVE_OUTLINE, 0.9)
        this.highlights.strokePoints(polygon, true)
      } else if (action.type === 'attack') {
        this.highlights.fillStyle(ATTACK_HIGHLIGHT, 0.5)
        this.highlights.fillPoints(this.hexPolygon(positionOf(action.target)), true)
      }
    }
    this.highlights.lineStyle(2, ACTIVE_OUTLINE, 1)
    this.highlights.strokePoints(this.hexPolygon(positionOf(state.active!)), true)
  }

  // ---- battle log ---------------------------------------------------------

  private pushLog(line: string): void {
    this.log.push(line)
    this.renderLog()
  }

  private renderLog(): void {
    this.logText.setText(this.log.visibleLines().join('\n'))
    this.updateLogScrollbar()
  }

  private onLogWheel(pointer: Phaser.Input.Pointer, deltaY: number): void {
    if (!this.logBoxBg.getBounds().contains(pointer.x, pointer.y)) return
    this.log.scrollBy(deltaY > 0 ? -1 : 1)
    this.renderLog()
  }

  private onLogThumbDrag(dragY: number): void {
    const trackY = this.logScrollTrack.y
    const travel = this.logScrollTrack.height - this.logScrollThumb.height
    if (travel <= 0) return
    const clampedY = Phaser.Math.Clamp(dragY, trackY, trackY + travel)
    this.log.scrollToRatio(1 - (clampedY - trackY) / travel)
    this.renderLog()
  }

  private onLogTrackClick(pointer: Phaser.Input.Pointer): void {
    const direction = pointer.y < this.logScrollThumb.y ? 1 : -1
    this.log.scrollBy(direction * LOG_VISIBLE_LINES)
    this.renderLog()
  }

  private updateLogScrollbar(): void {
    const barW = 8
    const trackX = this.logBoxBg.x + this.logBoxBg.width - barW - 4
    const trackY = this.logBoxBg.y + 4
    const trackH = LOG_BOX_H - 8
    const thumb = this.log.thumb(trackH, 16)

    this.logScrollTrack.setVisible(thumb !== null)
    this.logScrollThumb.setVisible(thumb !== null)
    if (!thumb) return

    this.logScrollTrack.setPosition(trackX, trackY)
    // Rectangle.setSize also resizes a default (non-custom) hit area.
    this.logScrollTrack.setSize(barW, trackH)
    this.logScrollThumb.setPosition(trackX, trackY + thumb.y)
    this.logScrollThumb.setSize(barW, thumb.height)
  }

  // ---- turn logic -----------------------------------------------------

  /**
   * Renders engine events: log lines, HP bars, hit flashes and movement all
   * flow from here. Returns how long the animations take, in ms.
   */
  private applyEvents(events: readonly BattleEvent[]): number {
    let animationMs = 0
    for (const event of events) {
      this.pushLog(formatEvent(event, this.names))
      if (event.type === 'move') animationMs = Math.max(animationMs, this.animateMove(event.unit, event.path))
      if (event.type === 'attack') this.flashHit(this.units.get(event.defender)!, event.hit)
      if (event.type === 'unit_down') this.units.get(event.unit)!.sprite.setAlpha(0.4)
    }
    this.syncUnitsFromEngine()
    return animationMs
  }

  private animateMove(id: UnitId, path: readonly Hex[]): number {
    const container = this.units.get(id)!.container
    this.tweens.chain({
      targets: container,
      tweens: path.map((h) => ({ ...this.hexCenter(h), duration: MOVE_STEP_MS, onUpdate: () => this.sortUnits() })),
    })
    return path.length * MOVE_STEP_MS
  }

  /** The engine owns HP during battle; write it back to the persistent character. */
  private syncUnitsFromEngine(): void {
    for (const snapshot of this.engine.getState().units) {
      if (snapshot.id === HERO_ID) this.gameState.player.hp = snapshot.hp
      this.refreshHpDisplay(this.units.get(snapshot.id)!, snapshot)
    }
  }

  private setPlayerControl(enabled: boolean): void {
    this.playerControl = enabled
    const canAttack = enabled && this.engine.legalActions().some((a) => a.type === 'attack')
    this.setButtonEnabled(this.attackButton, canAttack)
    this.setButtonEnabled(this.endTurnButton, enabled)
    this.refreshHighlights()
    this.updateRoundText()
  }

  private onBoardClick(pointer: Phaser.Input.Pointer): void {
    if (!this.playerControl) return
    const clicked = this.hexAt(pointer.x, pointer.y)
    if (!clicked) return
    const state = this.engine.getState()
    const action = this.engine.legalActions().find(
      (a) =>
        (a.type === 'move' && hexEquals(a.to, clicked)) ||
        (a.type === 'attack' && hexEquals(state.units.find((u) => u.id === a.target)!.position, clicked)),
    )
    if (action) this.playerAct(action)
  }

  private onAttack(): void {
    // Attacks the first adjacent foe; clicking a foe on the board picks one.
    const attack = this.engine.legalActions().find((a) => a.type === 'attack')
    if (this.playerControl && attack) this.playerAct(attack)
  }

  private onEndTurn(): void {
    if (this.playerControl) this.playerAct({ type: 'end_turn' })
  }

  private playerAct(action: Action): void {
    this.setPlayerControl(false)
    const animationMs = this.applyEvents(this.engine.step(action))
    const pause = action.type === 'attack' ? 600 : action.type === 'end_turn' ? 300 : 0
    this.time.delayedCall(animationMs + pause, () => this.continueBattle())
  }

  /** Hands control to whoever acts next: the battle's end, an enemy, or a player unit. */
  private continueBattle(): void {
    const phase = this.engine.getState().phase
    if (phase === 'over') this.endBattle()
    else if (phase === 'enemy') this.runEnemyAction()
    else this.setPlayerControl(true)
  }

  /** Plays one enemy action, then continues; an enemy turn may be a move and then an attack. */
  private runEnemyAction(): void {
    this.updateRoundText()
    this.time.delayedCall(400, () => {
      const state = this.engine.getState()
      const action = POLICIES[ENEMY_POLICY]({
        state,
        unit: state.active!,
        legal: this.engine.legalActions(),
        rng: Math.random,
      })
      const animationMs = this.applyEvents(this.engine.step(action))
      this.time.delayedCall(animationMs + 200, () => this.continueBattle())
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
    this.setPlayerControl(false)
    this.attackButton.setVisible(false)
    this.endTurnButton.setVisible(false)
    this.menuButton.setVisible(true)
    this.bannerText.setText(playerWon ? 'VICTORY!' : 'DEFEAT')
    this.bannerText.setColor(playerWon ? '#66bb6a' : '#ef5350')
    this.bannerText.setVisible(true)
    this.positionBanner()
    this.updateRoundText()
    this.dumpLog()
  }

  /** Structured dump for balancing/AI tooling to scrape from devtools; once per battle. */
  private dumpLog(): void {
    if (this.logDumped) return
    this.logDumped = true
    console.info('[battle-log]', JSON.stringify(this.engine.getLog()))
  }
}
