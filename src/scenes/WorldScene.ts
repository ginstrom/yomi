import Phaser from 'phaser'
import { canAdvance } from '../character/progression.ts'
import { MAX_BLIGHT, blightAt, blightGrowth, boardHex, boardIndex } from '../game/blight.ts'
import { campDay, campUntilHealed, canCamp, describeCamp, partyWounded } from '../game/camp.ts'
import { newGame, type GameState } from '../game/gameState.ts'
import { SAVE_FAILED_MESSAGE, SAVE_WARNED_KEY, deleteSlot, saveGame } from '../game/saveSlots.ts'
import { daysToFall } from '../game/territory.ts'
import { UNEXPLORED, knownBlightedShare, visibleHexes } from '../game/vision.ts'
import {
  linger,
  locationAt,
  monstersHere,
  routeTo,
  travel,
  type Lingering,
  type LocationKind,
  type WorldLocation,
  type WorldState,
} from '../game/worldMap.ts'
import { HexBoard, hexCorners, hexEquals, hexNeighbors, type Hex } from '../grid/hex.ts'
import { buttonProbe, type WorldProbe } from '../testHook.ts'
import { soundVolume } from './audioSettings.ts'
import { WORLD_LAYOUT, boardHexAt, boardHexCenter, boardPixelSize } from './boardGeometry.ts'
import { CURSORS } from './cursors.ts'
import { mapOrigin, rectContains, type Rect } from './mapScroll.ts'
import { PartyColumn } from './PartyColumn.ts'
import { UnitFigure } from './UnitFigure.ts'
import { gearLayers, SPRITE_ATLAS, spriteAnim, spriteFrame } from './unitLook.ts'
import { HEADER_BOTTOM, PARTY_PANEL_W, portraitClick } from './partyPanel.ts'
import { describeWorldEvents } from './worldEvents.ts'

interface WorldData {
  game?: GameState
}

/** Each kind of location's sprite in the atlas (art/map/), which has an `idle` animation for each. */
const LOCATION_SPRITES: Record<LocationKind, string> = {
  monsters: 'map_monsters',
  town: 'map_town',
  resource: 'map_resource',
}
/** Map sprites are drawn on a 24px canvas and shown at 2x. */
const LOCATION_SCALE = 2
/** The party is its first member as the battlefield shows it, gear and all, but smaller. */
const PARTY_SPRITE = 'warrior'
const PARTY_SCALE = 2
/** Locations stir out of step: each starts this much after the one before it. */
const LOCATION_STAGGER_MS = 310
/** How far below a hex's centre the party's feet stand, and a location's name starts. */
const PARTY_FEET_Y = 20
const LABEL_Y = 14
/** A location's sprite sits a little above centre, leaving room for its name. */
const LOCATION_Y = -6

/** Grassland olives near art/palette.toml's, close enough in shade to read as one field. */
const GRASS_COLORS = [0x556b2b, 0x4d6127, 0x5e7530]
const GRASS_EDGE = 0x14100c
const ROUTE_COLOR = 0xffffff
const ROUTE_EDGE = 0x000000
const MONSTERS_OUTLINE = 0xe53935
const PARTY_OUTLINE = 0xffffff
const WALK_STEP_MS = 140

/** The blight's tint over the grass, by level: a sickly yellow-green, then violets darkening to corruption. */
const BLIGHT_TINTS = [0, 0xb8c040, 0x7a3f8a, 0x2e0f3a]
const BLIGHT_ALPHAS = [0, 0.3, 0.4, 0.6]
/** The specks that mark corrupted land. */
const CORRUPTION_SPECK = 0xb388c9
/** The faint line along the edge of clean land. */
const FRONT_COLOR = 0xe8f5e9
/** The ring inside the party's hex where it stands on blighted land, which it keeps neutral. */
const NEUTRAL_RING = 0x90caf9
/** Fog: land never seen, and the veil over land remembered but out of sight. */
const UNEXPLORED_COLOR = 0x0b0b0e
const FOG_VEIL_ALPHA = 0.45
/** A location out of sight is drawn as remembered, faded. */
const REMEMBERED_ALPHA = 0.5
/** The Source is a monster location drawn darker and larger. */
const SOURCE_TINT = 0x9c4dcc
const SOURCE_SCALE = 3

/** The bars behind the header and the buttons: the map shows through them, dimmed. */
const BAR_COLOR = 0x1d1d1d
const BAR_ALPHA = 0.8
const BUTTON_W = 140
const BUTTON_H = 44
/** Between two buttons of a row. */
const BUTTON_GAP = 20
/** Wide enough for "Camp until healed". */
const WIDE_BUTTON_W = 200

export class WorldScene extends Phaser.Scene {
  private gameState!: GameState
  private board!: HexBoard
  /** True while the party walks; clicks wait for it to arrive. */
  private walking = false
  /** The map hex under the pointer, or null when it is off the map or over a button. */
  private hovered: Hex | null = null

  /** The whole map, most of it off screen; `follow` scrolls it to keep the party in view. */
  private mapLayer!: Phaser.GameObjects.Container
  /** The part of the screen between the bars and right of the party's column, where the map is in plain sight and takes clicks. */
  private view: Rect = { x: 0, y: 0, width: 0, height: 0 }
  private headerBar!: Phaser.GameObjects.Rectangle
  private footerBar!: Phaser.GameObjects.Rectangle
  /** The route a click on the hovered hex would walk. */
  private hoverMarks!: Phaser.GameObjects.Graphics
  private partyMark!: Phaser.GameObjects.Graphics
  private party!: UnitFigure

  private turnText!: Phaser.GameObjects.Text
  private hintText!: Phaser.GameObjects.Text
  /** The party's portraits down the left. */
  private column!: PartyColumn
  /** The party member marked in the column, whose panel C or a click on its portrait opens. */
  private active = 0
  /** What last happened, above the buttons. */
  private messageText!: Phaser.GameObjects.Text
  /** Scout, Wait and Attack, shown while the party stands among monsters. */
  private buttons: Phaser.GameObjects.Container[] = []
  /** Camp and Camp until healed, shown wherever else the party stands still. */
  private campButtons: Phaser.GameObjects.Container[] = []

  /**
   * The blight's tint, corruption's specks and the front line, drawn in
   * `blightMarks` (off the display list) and from there into `blightLayer`
   * once each time the land changes: a Graphics of the whole map would be
   * worked out again every frame.
   */
  private blightMarks!: Phaser.GameObjects.Graphics
  private blightLayer!: Phaser.GameObjects.RenderTexture
  /** The locations' sprites, under the party, and their names and badges, over it; the sprites are rebuilt when a location comes or goes. */
  private siteSprites!: Phaser.GameObjects.Container
  private siteLabels!: Phaser.GameObjects.Container
  /** The ids of the locations drawn, and the levels of the land, to tell when they must be drawn again. */
  private drawnLocations = ''
  private drawnBlight = ''
  /** The hexes in sight as of the last refresh, by `boardIndex`. */
  private visible = new Set<number>()
  /** The share of the land blighted, the blight's growth and the stock, at the header's right. */
  private statusText!: Phaser.GameObjects.Text
  /** The screen over the map when the game is won or lost, and its buttons: End and Continue, or Main Menu. */
  private outcomeShade!: Phaser.GameObjects.Rectangle
  private outcomeText!: Phaser.GameObjects.Text
  private endButton!: Phaser.GameObjects.Container
  private endlessButton!: Phaser.GameObjects.Container
  private menuButton!: Phaser.GameObjects.Container

  constructor() {
    super('World')
  }

  private get world(): WorldState {
    return this.gameState.world
  }

  preload(): void {
    PartyColumn.preload(this)
  }

  create(data: WorldData): void {
    this.gameState = data?.game ?? newGame()
    this.board = new HexBoard(this.world.board)
    // Phaser reuses the scene instance on restart, so field initializers don't run again.
    this.walking = false
    this.hovered = null
    // The first member with something to spend, so one click on its portrait opens its panel.
    this.active = Math.max(0, this.gameState.party.findIndex(canAdvance))

    this.mapLayer = this.add.container(0, 0)
    this.buildTerrain()
    this.blightMarks = this.make.graphics({}, false)
    const map = boardPixelSize(this.world.board, WORLD_LAYOUT)
    this.blightLayer = this.add.renderTexture(0, 0, Math.ceil(map.width), Math.ceil(map.height)).setOrigin(0)
    this.hoverMarks = this.add.graphics()
    this.partyMark = this.add.graphics()
    this.siteSprites = this.add.container(0, 0)
    this.siteLabels = this.add.container(0, 0)
    this.drawnLocations = ''
    this.drawnBlight = ''
    this.visible = new Set()
    this.party = new UnitFigure(this, PARTY_SPRITE, PARTY_SCALE).play('idle')
    this.refreshPartyGear()
    this.mapLayer.add([this.blightLayer, this.hoverMarks, this.partyMark, this.siteSprites, this.party, this.siteLabels])

    this.headerBar = this.add.rectangle(0, 0, 0, 0, BAR_COLOR, BAR_ALPHA).setOrigin(0)
    this.footerBar = this.add.rectangle(0, 0, 0, 0, BAR_COLOR, BAR_ALPHA).setOrigin(0)
    this.turnText = this.add.text(20, 16, '', { fontFamily: 'monospace', fontSize: '20px', color: '#ffffff' })
    this.statusText = this.add
      .text(0, 16, '', { fontFamily: 'monospace', fontSize: '13px', color: '#ce93d8', align: 'right' })
      .setOrigin(1, 0)
    this.hintText = this.add.text(20, 44, '', { fontFamily: 'monospace', fontSize: '13px', color: '#9e9e9e' })
    this.messageText = this.add
      .text(0, 0, '', { fontFamily: 'monospace', fontSize: '15px', color: '#cfd8dc' })
      .setOrigin(0.5)

    this.buttons = [
      this.createButton('Scout', () => this.onLinger('scout')),
      this.createButton('Wait', () => this.onLinger('wait')),
      this.createButton('Attack', () => this.onAttack()),
    ]
    this.campButtons = [
      this.createButton('Camp', () => this.onCamp()),
      this.createButton('Camp until healed', () => this.onCampUntilHealed(), WIDE_BUTTON_W),
    ]
    this.column = new PartyColumn(this, this.gameState.party, (index) => this.onPortrait(index))

    this.outcomeShade = this.add.rectangle(0, 0, 0, 0, 0x000000, 0.75).setOrigin(0).setInteractive()
    this.outcomeText = this.add
      .text(0, 0, '', { fontFamily: 'monospace', fontSize: '18px', color: '#ffffff', align: 'center', lineSpacing: 8 })
      .setOrigin(0.5)
    this.endButton = this.createButton('End', () => this.onEnd())
    this.endlessButton = this.createButton('Continue', () => this.onEndless())
    this.menuButton = this.createButton('Main Menu', () => this.scene.start('Menu'))

    // Phaser passes the interactive objects under the pointer; a click on a button is not a map click.
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer, over: Phaser.GameObjects.GameObject[]) => {
      if (over.length === 0) this.onMapClick(pointer)
    })
    this.input.on('pointermove', (pointer: Phaser.Input.Pointer, over: Phaser.GameObjects.GameObject[]) =>
      this.setHovered(over.length > 0 ? null : this.hexAt(pointer.x, pointer.y)),
    )
    this.input.on(Phaser.Input.Events.GAME_OUT, () => this.setHovered(null))
    // A paused map (menu open) mustn't leave its cursor on the overlay.
    this.events.on(Phaser.Scenes.Events.PAUSE, () => this.setHovered(null))
    this.input.keyboard?.on('keydown-ESC', () => this.openMenu())
    this.input.keyboard?.on('keydown-C', () => this.openPanel(this.active))
    // Back from a member's panel, where skill points and perks may have been spent, and
    // which tells the member it last showed. The menu resumes the map too, and tells nothing.
    this.events.on(Phaser.Scenes.Events.RESUME, (_sys: Phaser.Scenes.Systems, data?: { member?: number }) => {
      this.active = data?.member ?? this.active
      this.refreshPartyGear()
      this.refresh()
      this.save()
    })

    this.scale.on(Phaser.Scale.Events.RESIZE, this.layout, this)
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off(Phaser.Scale.Events.RESIZE, this.layout, this)
      this.input.setDefaultCursor('default')
    })

    const here = monstersHere(this.world)
    this.messageText.setText(
      this.world.status === 'won'
        ? ''
        : here
        ? `You stand before the ${here.name} (threat ${here.threat}).`
        : this.gameState.party.some(canAdvance)
          ? 'Your heroes have grown: click the portrait of one marked "+" to spend its skill points and perks.'
          : '',
    )
    this.refresh()
    // After the first refresh: the view centres on where the party stands.
    this.layout()
    // However the map was come to (a new game, a battle won, a load), the slot now holds it.
    this.save()
    this.checkOutcome()
  }

  update(): void {
    if (this.walking) this.follow()
  }

  /** What the in-browser tests see of the world map; see testHook.ts. */
  probe(): WorldProbe {
    const [scout, wait, attack] = this.buttons.map((button) => buttonProbe(button))
    const camp = buttonProbe(this.campButtons[0])
    const campUntilHealed = buttonProbe(this.campButtons[1], partyWounded(this.gameState.party))
    return {
      world: this.world,
      walking: this.walking,
      origin: { x: this.mapLayer.x, y: this.mapLayer.y },
      view: this.view,
      message: this.messageText.text,
      outcome: this.outcomeText.visible ? this.outcomeText.text : '',
      visible: [...this.visible].sort((a, b) => a - b),
      buttons: {
        scout,
        wait,
        attack,
        camp,
        campUntilHealed,
        end: buttonProbe(this.endButton),
        endless: buttonProbe(this.endlessButton),
        menu: buttonProbe(this.menuButton),
      },
      party: this.column.probe(),
    }
  }

  // ---- build ---------------------------------------------------------------

  private hexPolygon(h: Hex): Phaser.Math.Vector2[] {
    const c = boardHexCenter(h, WORLD_LAYOUT)
    return hexCorners(WORLD_LAYOUT.hexSize).map((p) => new Phaser.Math.Vector2(c.x + p.x, c.y + p.y))
  }

  private buildTerrain(): void {
    const terrain = this.add.graphics()
    for (const h of this.board.hexes) {
      // A three-colouring: no two neighbouring hexes share a shade.
      const shade = (((h.q - h.r) % 3) + 3) % 3
      const polygon = this.hexPolygon(h)
      terrain.fillStyle(GRASS_COLORS[shade], 1)
      terrain.fillPoints(polygon, true)
      terrain.lineStyle(1, GRASS_EDGE, 0.5)
      terrain.strokePoints(polygon, true)
    }
    this.mapLayer.add(terrain)
  }

  /**
   * How the player knows a location: 'hidden' (monsters not sighted, or a
   * town or resource on land never explored), 'remembered' (known but out of
   * sight) or 'seen'.
   */
  private knowledgeOf(location: WorldLocation): 'hidden' | 'remembered' | 'seen' {
    const i = boardIndex(this.world.board, location.position)
    const known = location.kind === 'monsters' ? this.world.sighted.includes(location.id) : this.world.seen[i] !== UNEXPLORED
    if (!known) return 'hidden'
    return this.visible.has(i) ? 'seen' : 'remembered'
  }

  /** Every known location's sprite, under the party, faded where out of sight; drawn again only when that changes. */
  private refreshLocations(): void {
    const key = this.world.locations.map((l) => `${l.id}:${this.knowledgeOf(l)}`).join()
    if (key === this.drawnLocations) return
    this.drawnLocations = key
    this.siteSprites.removeAll(true)
    for (const [i, location] of this.world.locations.entries()) {
      const knowledge = this.knowledgeOf(location)
      if (knowledge === 'hidden') continue
      const { x, y } = boardHexCenter(location.position, WORLD_LAYOUT)
      const sprite = LOCATION_SPRITES[location.kind]
      const source = location.kind === 'monsters' && location.source
      const figure = this.add
        .sprite(x, y + LOCATION_Y, SPRITE_ATLAS, spriteFrame(sprite, 'base'))
        .setScale(source ? SOURCE_SCALE : LOCATION_SCALE)
        .play({ key: spriteAnim(sprite, 'idle'), delay: (i * LOCATION_STAGGER_MS) % 1000 })
      if (source) figure.setTint(SOURCE_TINT)
      if (knowledge === 'remembered') figure.setAlpha(REMEMBERED_ALPHA)
      this.siteSprites.add(figure)
    }
  }

  /** Every known location's name over the party, so none is hidden: a held site's starred, and a threatened one's with the days until it falls. */
  private refreshLabels(): void {
    this.siteLabels.removeAll(true)
    for (const location of this.world.locations) {
      const knowledge = this.knowledgeOf(location)
      if (knowledge === 'hidden') continue
      const { x, y } = boardHexCenter(location.position, WORLD_LAYOUT)
      const held = this.world.held.includes(location.id)
      const days =
        location.kind !== 'monsters' && this.world.threatened.includes(location.id)
          ? daysToFall(this.world, this.gameState.party, location)
          : null
      const lines = [held ? `${location.name} *` : location.name]
      if (days !== null) lines.push(`falls in ${days}d`)
      this.siteLabels.add(
        this.add
          .text(x, y + LABEL_Y, lines.join('\n'), {
            fontFamily: 'monospace',
            fontSize: '11px',
            color: labelColor(location, held, days !== null),
            stroke: '#000000',
            strokeThickness: 3,
            align: 'center',
          })
          .setOrigin(0.5, 0)
          .setAlpha(knowledge === 'remembered' ? REMEMBERED_ALPHA + 0.25 : 1),
      )
    }
  }

  /**
   * The land as the player knows it (`seen`): black where never explored;
   * elsewhere each hex's tint for its level as last seen, specks on corrupted
   * land and a faint line along every edge between clean land and blighted,
   * under a veil where out of sight.
   */
  private refreshBlight(): void {
    const { board, seen } = this.world
    const drawn = `${seen.join('')}|${[...this.visible].join()}`
    if (drawn === this.drawnBlight) return
    this.drawnBlight = drawn
    const g = this.blightMarks.clear()
    const size = WORLD_LAYOUT.hexSize
    for (let i = 0; i < seen.length; i++) {
      const level = seen[i]
      const h = boardHex(board, i)
      const c = boardHexCenter(h, WORLD_LAYOUT)
      if (level === UNEXPLORED) {
        g.fillStyle(UNEXPLORED_COLOR, 1).fillPoints(this.hexPolygon(h), true)
        continue
      }
      if (!this.visible.has(i)) g.fillStyle(0x000000, FOG_VEIL_ALPHA).fillPoints(this.hexPolygon(h), true)
      if (level > 0) {
        g.fillStyle(BLIGHT_TINTS[level], BLIGHT_ALPHAS[level]).fillPoints(this.hexPolygon(h), true)
        if (level === MAX_BLIGHT) {
          g.fillStyle(CORRUPTION_SPECK, 0.7)
          g.fillCircle(c.x - size * 0.35, c.y + size * 0.15, 1.5)
          g.fillCircle(c.x + size * 0.25, c.y - size * 0.3, 1.5)
          g.fillCircle(c.x + size * 0.1, c.y + size * 0.4, 1.5)
        }
        continue
      }
      // The edge two hexes share is a side's length, square across the line between their centres.
      g.lineStyle(2, FRONT_COLOR, 0.35)
      for (const n of hexNeighbors(h)) {
        if (!this.board.contains(n) || seen[boardIndex(board, n)] <= 0) continue
        const d = boardHexCenter(n, WORLD_LAYOUT)
        const mx = (c.x + d.x) / 2
        const my = (c.y + d.y) / 2
        const length = Math.hypot(d.x - c.x, d.y - c.y)
        const px = (-(d.y - c.y) / length) * (size / 2)
        const py = ((d.x - c.x) / length) * (size / 2)
        g.lineBetween(mx - px, my - py, mx + px, my + py)
      }
    }
    this.blightLayer.clear().draw(g).render()
    g.clear()
  }

  /** Shows the party's figure holding what its first member does now. */
  private refreshPartyGear(): void {
    this.party.setGear(gearLayers(this.gameState.party[0]?.equipment ?? {}))
  }

  private createButton(label: string, onClick: () => void, width = BUTTON_W): Phaser.GameObjects.Container {
    const bg = this.add
      .rectangle(0, 0, width, BUTTON_H, 0x2b6cb0)
      .setStrokeStyle(2, 0x90cdf4)
      .setInteractive({ useHandCursor: true })
    const text = this.add
      .text(0, 0, label, { fontFamily: 'monospace', fontSize: '16px', color: '#ffffff' })
      .setOrigin(0.5)
    bg.on('pointerover', () => bg.setFillStyle(0x3182ce))
    bg.on('pointerout', () => bg.setFillStyle(0x2b6cb0))
    bg.on('pointerdown', () => {
      this.sound.play('sfx_ui_click', { volume: soundVolume('sfx_ui_click') })
      onClick()
    })
    return this.add.container(0, 0, [bg, text]).setSize(width, BUTTON_H)
  }

  // ---- layout ---------------------------------------------------------------

  /**
   * Header bar at the top, the party's column down the left, message and
   * buttons in a bar at the bottom, and the map filling the window behind them.
   */
  private layout(): void {
    const { width, height } = this.scale
    const centreX = PARTY_PANEL_W + (width - PARTY_PANEL_W) / 2
    const buttonY = height - 50
    for (const row of [this.buttons, this.campButtons]) {
      // A row centred under the map, its buttons BUTTON_GAP apart.
      let x = centreX - (row.reduce((sum, button) => sum + button.width, 0) + (row.length - 1) * BUTTON_GAP) / 2
      for (const button of row) {
        button.setPosition(x + button.width / 2, buttonY)
        x += button.width + BUTTON_GAP
      }
    }
    const messageY = buttonY - BUTTON_H / 2 - 26
    this.messageText.setPosition(centreX, messageY)
    this.statusText.setPosition(width - 20, 16)
    this.outcomeShade.setSize(width, height)
    const middleY = height / 2
    this.outcomeText.setPosition(centreX, middleY - 40)
    this.endButton.setPosition(centreX - (BUTTON_W + BUTTON_GAP) / 2, middleY + 50)
    this.endlessButton.setPosition(centreX + (BUTTON_W + BUTTON_GAP) / 2, middleY + 50)
    this.menuButton.setPosition(centreX, middleY + 50)

    const footerTop = messageY - 20
    this.headerBar.setSize(width, HEADER_BOTTOM)
    this.footerBar.setPosition(PARTY_PANEL_W, footerTop).setSize(width - PARTY_PANEL_W, height - footerTop)
    this.column.layout(height)
    this.view = {
      x: PARTY_PANEL_W,
      y: HEADER_BOTTOM,
      width: Math.max(0, width - PARTY_PANEL_W),
      height: Math.max(0, footerTop - HEADER_BOTTOM),
    }
    this.follow()
  }

  /**
   * Scrolls the map to keep the party mid-view, as far as the map's edges
   * allow. The edges stop at the view's, not the window's, so the party is
   * never left standing under a bar.
   */
  private follow(): void {
    const map = boardPixelSize(this.world.board, WORLD_LAYOUT)
    const { x, y } = mapOrigin({ x: this.party.x, y: this.party.y - PARTY_FEET_Y }, map, this.view)
    this.mapLayer.setPosition(x, y)
  }

  /** The map hex under a screen position, or null when off the map or under a bar. */
  private hexAt(screenX: number, screenY: number): Hex | null {
    const screen = { x: screenX, y: screenY }
    if (!rectContains(this.view, screen)) return null
    const h = boardHexAt(screen, { x: this.mapLayer.x, y: this.mapLayer.y }, 1, WORLD_LAYOUT)
    return this.board.contains(h) ? h : null
  }

  // ---- display ---------------------------------------------------------------

  /** Redraws everything that follows the world's state: the party, the header and which buttons show. */
  private refresh(): void {
    const world = this.world
    const here = monstersHere(world)
    const { x, y } = boardHexCenter(world.party, WORLD_LAYOUT)
    this.party.setPosition(x, y + PARTY_FEET_Y)
    this.partyMark.clear().lineStyle(3, PARTY_OUTLINE, 1).strokePoints(this.hexPolygon(world.party), true)
    this.visible = visibleHexes(world)
    // Blighted land the party stands on is neutral while it stays.
    if (blightAt(world, world.party) > 0) {
      const c = boardHexCenter(world.party, WORLD_LAYOUT)
      this.partyMark.lineStyle(2, NEUTRAL_RING, 0.9).strokeCircle(c.x, c.y, WORLD_LAYOUT.hexSize * 0.6)
    }
    this.refreshBlight()
    this.refreshLocations()
    this.refreshLabels()

    this.turnText.setText(`Turn ${world.turn}`)
    const growth = Math.round((blightGrowth(world.turn) - 1) * 100)
    const stock = Object.entries(world.stock)
      .map(([material, amount]) => `${material} ${amount}`)
      .join(', ')
    this.statusText.setText(
      [
        `Blighted ${Math.round(knownBlightedShare(world) * 100)}% of the land known${growth > 0 ? `, blight +${growth}%` : ''}${world.status === 'endless' ? ' (endless)' : ''}`,
        `Stock: ${stock || 'nothing yet'}`,
      ].join('\n'),
    )
    this.column.refresh(this.active)
    this.hintText.setText(
      world.confronting !== null
        ? 'Monsters! Scout them, wait, or attack.'
        : here
          ? 'Scout, wait or attack, or click a hex to move away.'
          : 'Click a hex to travel there, or camp. Each hex, or day of camping, takes a turn.',
    )
    for (const button of this.buttons) button.setVisible(here !== null && !this.walking && world.status !== 'lost')
    for (const button of this.campButtons) button.setVisible(canCamp(world) && !this.walking)
    const over = world.status === 'won' || world.status === 'lost'
    this.outcomeShade.setVisible(over)
    this.outcomeText.setVisible(over).setText(
      world.status === 'won'
        ? 'VICTORY!\n\nThe Source is destroyed, and the blight has lost its heart.\nEnd the game here, or go on against what is left of it.'
        : 'DEFEAT\n\nThe blight has taken Oakvale. The journey ends here.',
    )
    this.endButton.setVisible(world.status === 'won')
    this.endlessButton.setVisible(world.status === 'won')
    this.menuButton.setVisible(world.status === 'lost')
    this.refreshHover()
  }

  private setHovered(at: Hex | null): void {
    const same = at === null || this.hovered === null ? at === this.hovered : hexEquals(at, this.hovered)
    this.hovered = at
    if (!same) this.refreshHover()
  }

  /** Draws the route a click on the hovered hex would walk, red-ringed where it ends among monsters. */
  private refreshHover(): void {
    const g = this.hoverMarks.clear()
    const route = this.hovered && !this.walking ? routeTo(this.world, this.hovered) : null
    if (!route) {
      this.input.setDefaultCursor(CURSORS.move)
      return
    }
    const to = route[route.length - 1]
    const there = locationAt(this.world, to)
    const toMonsters = there?.kind === 'monsters' && this.world.sighted.includes(there.id)
    this.input.setDefaultCursor(toMonsters ? CURSORS.attack : CURSORS.select)

    const points = [this.world.party, ...route].map((h) => {
      const c = boardHexCenter(h, WORLD_LAYOUT)
      return new Phaser.Math.Vector2(c.x, c.y)
    })
    // A dark edge under the line keeps it visible over every shade of grass.
    g.lineStyle(7, ROUTE_EDGE, 0.5).strokePoints(points, false)
    g.lineStyle(3, ROUTE_COLOR, 1).strokePoints(points, false)
    g.lineStyle(3, toMonsters ? MONSTERS_OUTLINE : ROUTE_COLOR, 1).strokePoints(this.hexPolygon(to), true)
  }

  // ---- actions ---------------------------------------------------------------

  private onMapClick(pointer: Phaser.Input.Pointer): void {
    if (this.walking || this.outcomeShade.visible) return
    const clicked = this.hexAt(pointer.x, pointer.y)
    if (!clicked) return
    const journey = travel(this.world, clicked, this.gameState.party)
    const route = journey.walked
    if (route.length === 0) return

    this.walking = true
    this.messageText.setText('')
    // The journey is made as far as the world goes; the walk only shows it.
    this.save()
    this.refreshWalking()
    this.party.play('walk')
    this.tweens.chain({
      targets: this.party,
      tweens: route.map((h) => {
        const { x, y } = boardHexCenter(h, WORLD_LAYOUT)
        // The party sprite is drawn facing right.
        return { x, y: y + PARTY_FEET_Y, duration: WALK_STEP_MS, onStart: () => this.party.faceLeft(x < this.party.x) }
      }),
      onComplete: () => {
        this.party.play('idle')
        this.arrive(describeWorldEvents(journey.events, journey.interruptedBy), journey.interruptedBy !== null)
      },
    })
  }

  /** While the party walks, nothing else can be done and its hex is not yet where it stands. */
  private refreshWalking(): void {
    this.partyMark.clear()
    for (const button of [...this.buttons, ...this.campButtons]) button.setVisible(false)
    this.refreshHover()
  }

  /** The walk is over: `told` is what happened on the way, and `stopped` whether that cut the journey short. */
  private arrive(told: string, stopped: boolean): void {
    this.walking = false
    this.follow()
    // The map has scrolled under the pointer, which is over another hex now.
    const pointer = this.input.activePointer
    this.hovered = this.hexAt(pointer.x, pointer.y)
    const here = monstersHere(this.world)
    this.messageText.setText(
      stopped ? `Your journey stops. ${told}` : here ? `You come upon the ${here.name} (threat ${here.threat}).` : told,
    )
    this.refresh()
    this.checkOutcome()
  }

  /** Scouting and waiting each pass a turn among the monsters; nothing comes of either yet. */
  private onLinger(how: Lingering): void {
    const here = monstersHere(this.world)
    const events = here ? linger(this.world, how, this.gameState.party) : null
    if (!here || !events) return
    this.messageText.setText(
      describeWorldEvents(events) ||
        (how === 'scout'
          ? `You scout the ${here.name}, but learn nothing new.`
          : `You wait a turn. The ${here.name} do not stir.`),
    )
    this.refresh()
    this.save()
    this.checkOutcome()
  }

  /** A day's rest where the party stands: a hit point each, and every caster's mana back. */
  private onCamp(): void {
    const day = campDay(this.world, this.gameState.party)
    if (day === null) return
    const told = describeWorldEvents(day.events)
    this.messageText.setText(
      `You camp a day. Mana is restored${day.healed > 0 ? ` and rest heals ${day.healed} hp` : ''}.${told ? ` ${told}` : ''}`,
    )
    this.refresh()
    this.save()
    this.checkOutcome()
  }

  /** Days of rest, with the casters healing what they can each day, until no one is wounded. */
  private onCampUntilHealed(): void {
    const result = campUntilHealed(this.world, this.gameState.party)
    if (result === null) return
    const told = describeWorldEvents(result.events, result.interruptedBy)
    const days = `${result.days} ${result.days === 1 ? 'day' : 'days'}`
    this.messageText.setText(
      result.interruptedBy ? `Camp is broken after ${days}. ${told}` : `${describeCamp(result)}${told ? ` ${told}` : ''}`,
    )
    this.refresh()
    this.save()
    this.checkOutcome()
  }

  /**
   * After anything that passes time: a lost encampment ends the playthrough,
   * as a party's fall in battle does (permadeath), and frees its slot. The
   * screen over the map says so (`refresh`), as it asks what next after a victory.
   */
  private checkOutcome(): void {
    if (this.world.status !== 'lost' || this.gameState.slot === null) return
    deleteSlot(this.gameState.slot)
    this.gameState.slot = null
  }

  /** The game is won and the player stops here: the save is kept, a finished game, and the menu shown. */
  private onEnd(): void {
    this.save()
    this.scene.start('Menu')
  }

  /** The game is won and the player goes on: the nests left keep pushing and spawning. */
  private onEndless(): void {
    this.world.status = 'endless'
    this.messageText.setText('The Source is gone, but the blight lingers. The hunt goes on.')
    this.refresh()
    this.save()
  }

  /**
   * Writes the game to its slot, as the map does after everything that changes
   * it. If the browser refuses, play goes on and the message line says so, once.
   */
  private save(): void {
    if (saveGame(this.gameState) || this.registry.get(SAVE_WARNED_KEY)) return
    this.registry.set(SAVE_WARNED_KEY, true)
    this.messageText.setText(SAVE_FAILED_MESSAGE)
  }

  private onAttack(): void {
    const here = monstersHere(this.world)
    if (here) this.scene.start('Battle', { game: this.gameState, location: here.id })
  }

  /** A click on a portrait marks that member, and a click on the one marked opens its panel. */
  private onPortrait(index: number): void {
    if (portraitClick(index, this.active) === 'open') {
      this.openPanel(index)
      return
    }
    this.active = index
    this.refresh()
  }

  /**
   * Opens a party member's panel over the map, where its skill points and
   * perks are spent, on the skills if it has any to spend. Not while the
   * party walks.
   */
  private openPanel(index: number): void {
    if (this.scene.isPaused() || this.walking) return
    const party = this.gameState.party
    const character = party[index]
    if (!character) return
    const tab = canAdvance(character) ? 'skills' : 'character'
    // Gear is changed freely here, and the ground is the party's baggage, through which items
    // pass between members. The panel edits the characters and the baggage in place.
    const members = party.map((member) => ({ character: member, gearApCost: 0, ground: this.gameState.baggage }))
    this.scene.launch('Inventory', { members, index, tab, canAdvance: true, resume: 'World', groundTitle: 'Baggage' })
    this.scene.bringToTop('Inventory')
    this.scene.pause()
  }

  private openMenu(): void {
    if (this.scene.isPaused()) return
    this.scene.launch('Menu', { resume: 'World' })
    this.scene.bringToTop('Menu')
    this.scene.pause()
  }
}

/** A location's name colour: monsters reddish, the Source violet, held sites green, threatened ones orange. */
function labelColor(location: WorldLocation, held: boolean, threatened: boolean): string {
  if (location.kind === 'monsters') return location.source ? '#ce93d8' : '#ffab91'
  if (threatened) return '#ffb74d'
  return held ? '#a5d6a7' : '#ffffff'
}
