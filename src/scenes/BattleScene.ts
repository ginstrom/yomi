import Phaser from 'phaser'
import { deriveCombatStats } from '../character/character.ts'
import {
  BattleEngine,
  formatEvent,
  type Action,
  type BattleEvent,
  type Phase,
  type UnitId,
  type UnitSetup,
  type UnitSnapshot,
} from '../engine/battleEngine.ts'
import { POLICIES, type PolicyName } from '../engine/policies.ts'
import { HERO_ID, goblinRaid, type UnitKind } from '../game/encounters.ts'
import { newGame, type GameState } from '../game/gameState.ts'
import { HexBoard, hexCorners, hexEquals, hexToPixel, pixelToHex, type BoardSize, type Hex } from '../grid/hex.ts'
import { ScrollingLog } from './scrollingLog.ts'

interface BattleData {
  game?: GameState
}

interface Unit {
  /** The unit's body and shadow, positioned at its feet and depth-sorted with the other units. */
  container: Phaser.GameObjects.Container
  sprite: Phaser.GameObjects.Sprite
  /**
   * Name, HP and AP, drawn over every unit in the lower half of the unit's own
   * hex. Plates sit the same way in every hex, so neighbours' plates never collide.
   */
  plate: Phaser.GameObjects.Container
  hpBarBg: Phaser.GameObjects.Rectangle
  hpBarFill: Phaser.GameObjects.Rectangle
  hpText: Phaser.GameObjects.Text
  /** One pip per action point, filled for those left; shown during the unit's side's turn. */
  apPips: Phaser.GameObjects.Graphics
}

/** Corner radius of a hex in pixels, before the floor's vertical squash. */
const HEX_SIZE = 40
const FLOOR_SQUASH_Y = 0.6
const FLOOR_COLORS = [0xe0a56a, 0xd09358, 0xc0844f]
const FLOOR_EDGE = 0x7a3b35
const MOVE_HIGHLIGHT = 0x1e88e5
const MOVE_OUTLINE = 0x90caf9
const ATTACK_HIGHLIGHT = 0xe53935
const PROVOKE_OUTLINE = 0xffa726
const ACTIVE_OUTLINE = 0xffee58
const AP_PIP_FULL = 0xffee58
const AP_PIP_SPENT = 0x424242
/** Move highlights fade as they cost more AP: 1 AP, 2 AP, 3+ AP. */
const MOVE_ALPHA_BY_COST = [0.6, 0.4, 0.25]
const MOVE_STEP_MS = 140
/** Pause after a free attack lands, before the mover walks on. */
const OPPORTUNITY_PAUSE_MS = 450
/** Nameplate rows, in pixels below a unit's feet: name, HP bar, then AP pips or a foe's hit chance. */
const PLATE_NAME_Y = -3
const PLATE_BAR_Y = 11
const PLATE_BAR_W = 52
const PLATE_BAR_H = 10
const PLATE_STATUS_Y = 27
const LOG_HISTORY = 50
const LOG_VISIBLE_LINES = 5
const LOG_LINE_H = 20
const LOG_BOX_PADDING = 10
const LOG_BOX_H = LOG_VISIBLE_LINES * LOG_LINE_H + LOG_BOX_PADDING * 2
const LOG_BOX_GAP = 14
const ENEMY_POLICY: PolicyName = 'aggressive'

/** How to draw each kind of unit; each texture is loaded from assets/sprites/<kind>.png. */
const APPEARANCE: Record<UnitKind, { displayHeight: number }> = {
  warrior: { displayHeight: 84 },
  goblin: { displayHeight: 68 },
  kobold: { displayHeight: 70 },
}

export class BattleScene extends Phaser.Scene {
  private gameState!: GameState
  private engine!: BattleEngine
  private board!: HexBoard
  private names!: Record<UnitId, string>
  private logDumped = false
  /** True while the player may act; off during animations and the enemy's turn. */
  private playerControl = false
  /** The player unit that board clicks and the Attack button act for. */
  private selected: UnitId | null = null
  /** The Attack button was pressed with several foes in reach: the next board click picks one. */
  private targeting = false
  private units!: Map<UnitId, Unit>

  private floorLayer!: Phaser.GameObjects.Container
  private highlights!: Phaser.GameObjects.Graphics
  private unitLayer!: Phaser.GameObjects.Container
  /** Units' nameplates, drawn above every unit so none is hidden behind a sprite. */
  private plateLayer!: Phaser.GameObjects.Container
  /** Hit-chance labels on attackable foes, drawn above the nameplates. */
  private labelLayer!: Phaser.GameObjects.Container

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
    for (const kind of Object.keys(APPEARANCE)) this.load.image(kind, `assets/sprites/${kind}.png`)
  }

  create(data: BattleData): void {
    this.gameState = data?.game ?? newGame()
    const player = this.gameState.player
    const { setup, kinds } = goblinRaid(deriveCombatStats(player), player.hp)
    this.engine = new BattleEngine(setup, { meta: { source: 'game', enemyPolicy: ENEMY_POLICY } })
    this.board = new HexBoard(setup.board)
    this.names = Object.fromEntries(setup.units.map((u) => [u.id, u.stats.name]))
    // Phaser reuses the scene instance on restart, so field initializers
    // don't run again — reset per-battle state explicitly.
    this.log = new ScrollingLog(LOG_HISTORY, LOG_VISIBLE_LINES)
    this.logDumped = false
    this.playerControl = false
    this.selected = null
    this.targeting = false

    this.floorLayer = this.add.container(0, 0)
    this.buildFloor(setup.board)
    this.highlights = this.add.graphics()
    this.floorLayer.add(this.highlights)
    this.unitLayer = this.add.container(0, 0)
    this.plateLayer = this.add.container(0, 0)
    this.units = new Map(setup.units.map((u) => [u.id, this.createUnit(u, kinds[u.id])]))
    this.labelLayer = this.add.container(0, 0)

    this.roundText = this.add
      .text(20, 16, '', { fontFamily: 'monospace', fontSize: '20px', color: '#ffffff' })
      .setScrollFactor(0)
    this.hintText = this.add
      .text(20, 44, '', {
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
    this.input.keyboard?.on('keydown-ESC', () => (this.targeting ? this.setTargeting(false) : this.openMenu()))

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

  private createUnit({ side, stats }: UnitSetup, kind: UnitKind): Unit {
    const { displayHeight } = APPEARANCE[kind]
    const sprite = this.add.sprite(0, 0, kind)
    const tex = this.textures.get(kind).getSourceImage()
    const aspect = tex.width / tex.height
    sprite.setDisplaySize(displayHeight * aspect, displayHeight)
    sprite.setOrigin(0.5, 1)
    // Sprites face right; enemies start on the right and face left.
    sprite.setFlipX(side === 'enemy')

    const shadow = this.add.ellipse(0, 0, displayHeight * 0.55, displayHeight * 0.18, 0x000000, 0.35)
    const container = this.add.container(0, 0, [shadow, sprite])
    this.unitLayer.add(container)

    // An outline keeps plate text legible over the floor, highlights and other units.
    const outlined = { fontFamily: 'monospace', color: '#ffffff', stroke: '#000000', strokeThickness: 3 }
    const nameText = this.add.text(0, PLATE_NAME_Y, stats.name, { ...outlined, fontSize: '12px' }).setOrigin(0.5, 0)
    const hpBarBg = this.add
      .rectangle(0, PLATE_BAR_Y, PLATE_BAR_W, PLATE_BAR_H, 0x212121)
      .setOrigin(0.5, 0)
      .setStrokeStyle(1, 0x000000)
    const hpBarFill = this.add
      .rectangle(-PLATE_BAR_W / 2, PLATE_BAR_Y, PLATE_BAR_W, PLATE_BAR_H, 0x43a047)
      .setOrigin(0, 0)
    const hpText = this.add
      .text(0, PLATE_BAR_Y + PLATE_BAR_H / 2, '', { ...outlined, fontSize: '10px', strokeThickness: 2 })
      .setOrigin(0.5)
    const apPips = this.add.graphics()
    const plate = this.add.container(0, 0, [nameText, hpBarBg, hpBarFill, hpText, apPips])
    this.plateLayer.add(plate)

    return { container, sprite, plate, hpBarBg, hpBarFill, hpText, apPips }
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

  private setButtonLabel(button: Phaser.GameObjects.Container, label: string): void {
    ;(button.getData('text') as Phaser.GameObjects.Text).setText(label)
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
    this.plateLayer.setPosition(floorX, floorY)
    this.labelLayer.setPosition(floorX, floorY)
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

  /** Centres the banner between the header text and the top of the tallest unit. */
  private positionBanner(): void {
    const unitsTop =
      this.unitLayer.y + Math.min(...[...this.units.values()].map((u) => u.container.y - u.sprite.displayHeight))
    const headerBottom = this.hintText.y + this.hintText.height
    const y = Math.max(headerBottom + this.bannerText.height / 2, (headerBottom + unitsTop) / 2)
    this.bannerText.setPosition(this.scale.width / 2, y)
  }

  private placeUnit(id: UnitId, at: Hex): void {
    const { x, y } = this.hexCenter(at)
    const unit = this.units.get(id)!
    unit.container.setPosition(x, y)
    unit.plate.setPosition(x, y)
    this.sortUnits()
  }

  /** Units lower on screen draw in front. */
  private sortUnits(): void {
    this.unitLayer.sort('y')
  }

  private refreshHpDisplay(unit: Unit, hp: number, maxHp: number): void {
    const ratio = Phaser.Math.Clamp(hp / maxHp, 0, 1)
    // setSize, not a bare width assignment, so the shape's geometry and path follow.
    unit.hpBarFill.setSize(unit.hpBarBg.width * ratio, unit.hpBarBg.height)
    unit.hpBarFill.setFillStyle(ratio > 0.5 ? 0x43a047 : ratio > 0.2 ? 0xfb8c00 : 0xe53935)
    unit.hpText.setText(`${hp} / ${maxHp}`)
  }

  private refreshApPips(unit: Unit, snapshot: UnitSnapshot, phase: Phase): void {
    const pips = unit.apPips
    pips.clear()
    if (snapshot.side !== phase || snapshot.hp <= 0) return
    const spacing = 10
    for (let i = 0; i < snapshot.actionPoints; i++) {
      const x = (i - (snapshot.actionPoints - 1) / 2) * spacing
      pips.fillStyle(i < snapshot.ap ? AP_PIP_FULL : AP_PIP_SPENT, 1)
      pips.fillCircle(x, PLATE_STATUS_Y, 3.5)
      pips.lineStyle(1, 0x000000, 0.8)
      pips.strokeCircle(x, PLATE_STATUS_Y, 3.5)
    }
  }

  private updateRoundText(): void {
    const state = this.engine.getState()
    if (state.phase === 'over') {
      this.roundText.setText(`Battle over — ${state.round} rounds fought`)
      return
    }
    this.roundText.setText(`Round ${state.round} — ${state.phase === 'player' ? 'your turn' : "enemy's turn"}`)
  }

  /** Player units that still have something to do this turn, in roster order. */
  private actableUnits(): UnitId[] {
    const ids = new Set<UnitId>()
    for (const action of this.engine.legalActions()) if (action.type !== 'end_turn') ids.add(action.unit)
    return [...ids]
  }

  /** Keeps the selection on a unit that can still act, moving it on when the current one is spent. */
  private ensureSelection(): void {
    const actable = this.actableUnits()
    if (this.selected === null || !actable.includes(this.selected)) this.selected = actable[0] ?? null
  }

  /** The selected unit's legal attacks, in roster order of their targets. */
  private selectedAttacks(): Extract<Action, { type: 'attack' }>[] {
    if (this.selected === null) return []
    return this.engine.legalActions(this.selected).filter((a) => a.type === 'attack')
  }

  /**
   * Marks where the selected unit can move (fainter for more AP, orange-edged
   * where the move provokes a free attack) and whom it can attack, with the
   * odds of hitting each. While picking a target, only the targets show.
   */
  private refreshHighlights(): void {
    this.highlights.clear()
    this.labelLayer.removeAll(true)
    this.hintText.setVisible(this.playerControl)
    if (!this.playerControl) return

    const state = this.engine.getState()
    const positionOf = (id: UnitId) => state.units.find((u) => u.id === id)!.position
    const actable = this.actableUnits()
    this.hintText.setText(
      this.targeting
        ? 'Choose a foe to attack (2 AP). Esc or Cancel to go back.'
        : actable.length === 0
          ? 'No action points left. Press End Turn.'
          : 'Blue: move (fainter costs more AP), orange edge provokes a free attack. Red: attack (2 AP).',
    )

    for (const id of this.targeting ? [] : actable) {
      if (id === this.selected) continue
      this.highlights.lineStyle(2, 0xffffff, 0.5)
      this.highlights.strokePoints(this.hexPolygon(positionOf(id)), true)
    }
    if (this.selected === null) return

    for (const action of this.engine.legalActions(this.selected)) {
      if (action.type === 'move' && !this.targeting) {
        const preview = this.engine.previewMove(action.unit, action.to)!
        const polygon = this.hexPolygon(action.to)
        const alpha = MOVE_ALPHA_BY_COST[Math.min(preview.apCost, MOVE_ALPHA_BY_COST.length) - 1]
        this.highlights.fillStyle(MOVE_HIGHLIGHT, alpha)
        this.highlights.fillPoints(polygon, true)
        if (preview.provokes.length > 0) this.highlights.lineStyle(2, PROVOKE_OUTLINE, 1)
        else this.highlights.lineStyle(1, MOVE_OUTLINE, 0.9)
        this.highlights.strokePoints(polygon, true)
      } else if (action.type === 'attack') {
        const polygon = this.hexPolygon(positionOf(action.target))
        this.highlights.fillStyle(ATTACK_HIGHLIGHT, this.targeting ? 0.7 : 0.5)
        this.highlights.fillPoints(polygon, true)
        if (this.targeting) {
          this.highlights.lineStyle(2, 0xffffff, 0.9)
          this.highlights.strokePoints(polygon, true)
        }
        this.addHitChanceLabel(action.unit, action.target, positionOf(action.target))
      }
    }
    this.highlights.lineStyle(2, ACTIVE_OUTLINE, 1)
    this.highlights.strokePoints(this.hexPolygon(positionOf(this.selected)), true)
  }

  /** "60%" on a foe's nameplate when the selected unit can attack it, with "+2" when flanking helps. */
  private addHitChanceLabel(attacker: UnitId, target: UnitId, at: Hex): void {
    const preview = this.engine.previewAttack(attacker, target)
    if (!preview) return
    const percent = Math.round(preview.hitChance * 100)
    const flank = preview.flankBonus > 0 ? ` +${preview.flankBonus}` : ''
    const { x, y } = this.hexCenter(at)
    const label = this.add
      .text(x, y + PLATE_STATUS_Y, `${percent}%${flank}`, {
        fontFamily: 'monospace',
        fontSize: '11px',
        color: '#ffffff',
        backgroundColor: '#000000b3',
        padding: { x: 3, y: 0 },
      })
      .setOrigin(0.5)
    this.labelLayer.add(label)
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
   * Renders engine events one after another — a move's walk, then any free
   * attack that interrupts it, then the rest of the walk — so log lines, HP
   * bars and hit flashes land when they happen. Returns the total time, in ms.
   */
  private applyEvents(events: readonly BattleEvent[]): number {
    let at = 0
    for (const event of events) {
      if (at === 0) this.showEvent(event)
      else this.time.delayedCall(at, () => this.showEvent(event))
      if (event.type === 'move') at += event.path.length * MOVE_STEP_MS
      if (event.type === 'attack' && event.opportunity) at += OPPORTUNITY_PAUSE_MS
    }
    // AP is spent the moment the action is taken; HP follows the animation.
    this.refreshAllApPips()
    if (at === 0) this.syncUnitsFromEngine()
    else this.time.delayedCall(at, () => this.syncUnitsFromEngine())
    return at
  }

  private showEvent(event: BattleEvent): void {
    this.pushLog(formatEvent(event, this.names))
    if (event.type === 'move') this.animateMove(event.unit, event.path)
    if (event.type === 'attack') {
      const defender = this.units.get(event.defender)!
      this.flashHit(defender, event.hit)
      const maxHp = this.engine.getState().units.find((u) => u.id === event.defender)!.maxHp
      this.refreshHpDisplay(defender, event.defenderHpAfter, maxHp)
    }
    if (event.type === 'unit_down') {
      // Others may stand on a fallen unit's hex, so its plate goes rather than collide with theirs.
      const unit = this.units.get(event.unit)!
      unit.sprite.setAlpha(0.4)
      unit.plate.setVisible(false)
    }
  }

  private animateMove(id: UnitId, path: readonly Hex[]): void {
    if (path.length === 0) return
    const { container, plate } = this.units.get(id)!
    this.tweens.chain({
      targets: [container, plate],
      tweens: path.map((h) => ({ ...this.hexCenter(h), duration: MOVE_STEP_MS, onUpdate: () => this.sortUnits() })),
    })
  }

  /** The engine owns HP during battle; write it back to the persistent character. */
  private syncUnitsFromEngine(): void {
    for (const snapshot of this.engine.getState().units) {
      if (snapshot.id === HERO_ID) this.gameState.player.hp = snapshot.hp
      this.refreshHpDisplay(this.units.get(snapshot.id)!, snapshot.hp, snapshot.maxHp)
    }
    this.refreshAllApPips()
  }

  private refreshAllApPips(): void {
    const state = this.engine.getState()
    for (const snapshot of state.units) this.refreshApPips(this.units.get(snapshot.id)!, snapshot, state.phase)
  }

  private setPlayerControl(enabled: boolean): void {
    this.playerControl = enabled
    if (enabled) this.ensureSelection()
    const attacks = enabled ? this.selectedAttacks().length : 0
    if (attacks < 2) this.targeting = false
    this.setButtonEnabled(this.attackButton, attacks > 0)
    this.setButtonLabel(this.attackButton, this.targeting ? 'Cancel' : 'Attack')
    this.setButtonEnabled(this.endTurnButton, enabled)
    this.refreshHighlights()
    this.updateRoundText()
  }

  private setTargeting(on: boolean): void {
    this.targeting = on
    this.setPlayerControl(this.playerControl)
  }

  private onBoardClick(pointer: Phaser.Input.Pointer): void {
    if (!this.playerControl) return
    const clicked = this.hexAt(pointer.x, pointer.y)
    if (!clicked) return
    const state = this.engine.getState()
    const unitAt = state.units.find((u) => u.hp > 0 && hexEquals(u.position, clicked))
    if (this.targeting) {
      // Only a target counts; any other board click backs out of picking one.
      const attack = this.selectedAttacks().find((a) => a.target === unitAt?.id)
      if (attack) this.playerAct(attack)
      else this.setTargeting(false)
      return
    }
    const action =
      this.selected === null
        ? undefined
        : this.engine
            .legalActions(this.selected)
            .find(
              (a) =>
                (a.type === 'move' && hexEquals(a.to, clicked)) || (a.type === 'attack' && a.target === unitAt?.id),
            )
    if (action) {
      this.playerAct(action)
    } else if (unitAt && this.actableUnits().includes(unitAt.id)) {
      this.selected = unitAt.id
      this.setPlayerControl(true)
    }
  }

  /** Attacks the only foe in reach, or asks which one when there are several; pressed again, cancels. */
  private onAttack(): void {
    if (!this.playerControl) return
    if (this.targeting) {
      this.setTargeting(false)
      return
    }
    const attacks = this.selectedAttacks()
    if (attacks.length === 1) this.playerAct(attacks[0])
    else if (attacks.length > 1) this.setTargeting(true)
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

  /** Plays one enemy action, then continues; the enemy's turn runs until its policy ends it. */
  private runEnemyAction(): void {
    this.updateRoundText()
    this.time.delayedCall(400, () => {
      const action = POLICIES[ENEMY_POLICY]({
        state: this.engine.getState(),
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
