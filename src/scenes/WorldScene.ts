import Phaser from 'phaser'
import { canAdvance } from '../character/progression.ts'
import { newGame, type GameState } from '../game/gameState.ts'
import {
  linger,
  locationAt,
  monstersHere,
  routeTo,
  travel,
  type Lingering,
  type LocationKind,
  type WorldState,
} from '../game/worldMap.ts'
import { HexBoard, hexCorners, hexEquals, type Hex } from '../grid/hex.ts'
import { buttonProbe, type WorldProbe } from '../testHook.ts'
import { soundVolume } from './audioSettings.ts'
import { WORLD_LAYOUT, boardHexAt, boardHexCenter, boardPixelSize } from './boardGeometry.ts'
import { CURSORS } from './cursors.ts'
import { mapOrigin, rectContains, type Rect } from './mapScroll.ts'
import { PartyColumn } from './PartyColumn.ts'
import { HEADER_BOTTOM, PARTY_PANEL_W, portraitClick } from './partyPanel.ts'

interface WorldData {
  game?: GameState
}

/** Each kind of location's texture, loaded from assets/sprites/<key>.png. */
const LOCATION_SPRITES: Record<LocationKind, string> = {
  monsters: 'map_monsters',
  town: 'map_town',
  resource: 'map_resource',
}
/** Map sprites are drawn on a 24px canvas and shown at 2x. */
const LOCATION_SCALE = 2
/** The party is the warrior's battle sprite, shown smaller than on the battlefield. */
const PARTY_SPRITE = 'warrior'
const PARTY_SCALE = 2
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

/** The bars behind the header and the buttons: the map shows through them, dimmed. */
const BAR_COLOR = 0x1d1d1d
const BAR_ALPHA = 0.8
const BUTTON_W = 140
const BUTTON_H = 44
const BUTTON_SPACING = 160

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
  private party!: Phaser.GameObjects.Image

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

  constructor() {
    super('World')
  }

  private get world(): WorldState {
    return this.gameState.world
  }

  preload(): void {
    this.load.image(PARTY_SPRITE, `assets/sprites/${PARTY_SPRITE}.png`)
    PartyColumn.preload(this)
    for (const key of Object.values(LOCATION_SPRITES)) this.load.image(key, `assets/sprites/${key}.png`)
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
    this.hoverMarks = this.add.graphics()
    this.partyMark = this.add.graphics()
    this.mapLayer.add([this.hoverMarks, this.partyMark])
    this.buildLocations()

    this.headerBar = this.add.rectangle(0, 0, 0, 0, BAR_COLOR, BAR_ALPHA).setOrigin(0)
    this.footerBar = this.add.rectangle(0, 0, 0, 0, BAR_COLOR, BAR_ALPHA).setOrigin(0)
    this.turnText = this.add.text(20, 16, '', { fontFamily: 'monospace', fontSize: '20px', color: '#ffffff' })
    this.hintText = this.add.text(20, 44, '', { fontFamily: 'monospace', fontSize: '13px', color: '#9e9e9e' })
    this.messageText = this.add
      .text(0, 0, '', { fontFamily: 'monospace', fontSize: '15px', color: '#cfd8dc' })
      .setOrigin(0.5)

    this.buttons = [
      this.createButton('Scout', () => this.onLinger('scout')),
      this.createButton('Wait', () => this.onLinger('wait')),
      this.createButton('Attack', () => this.onAttack()),
    ]
    this.column = new PartyColumn(this, this.gameState.party, (index) => this.onPortrait(index))

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
      this.refresh()
    })

    this.scale.on(Phaser.Scale.Events.RESIZE, this.layout, this)
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off(Phaser.Scale.Events.RESIZE, this.layout, this)
      this.input.setDefaultCursor('default')
    })

    const here = monstersHere(this.world)
    this.messageText.setText(
      here
        ? `You stand before the ${here.name} (threat ${here.threat}).`
        : this.gameState.party.some(canAdvance)
          ? 'Your heroes have grown: click the portrait of one marked "+" to spend its skill points.'
          : '',
    )
    this.refresh()
    // After the first refresh: the view centres on where the party stands.
    this.layout()
  }

  update(): void {
    if (this.walking) this.follow()
  }

  /** What the in-browser tests see of the world map; see testHook.ts. */
  probe(): WorldProbe {
    const [scout, wait, attack] = this.buttons.map((button) => buttonProbe(button))
    return {
      world: this.world,
      walking: this.walking,
      origin: { x: this.mapLayer.x, y: this.mapLayer.y },
      view: this.view,
      message: this.messageText.text,
      buttons: { scout, wait, attack },
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

  /** Every location's sprite, then the party, then the names over them all so none is hidden. */
  private buildLocations(): void {
    const labels: Phaser.GameObjects.Text[] = []
    for (const location of this.world.locations) {
      const { x, y } = boardHexCenter(location.position, WORLD_LAYOUT)
      this.mapLayer.add(
        this.add.image(x, y + LOCATION_Y, LOCATION_SPRITES[location.kind]).setScale(LOCATION_SCALE),
      )
      labels.push(
        this.add
          .text(x, y + LABEL_Y, location.name, {
            fontFamily: 'monospace',
            fontSize: '11px',
            color: location.kind === 'monsters' ? '#ffab91' : '#ffffff',
            stroke: '#000000',
            strokeThickness: 3,
          })
          .setOrigin(0.5, 0),
      )
    }
    this.party = this.add.image(0, 0, PARTY_SPRITE).setScale(PARTY_SCALE).setOrigin(0.5, 1)
    this.mapLayer.add(this.party)
    this.mapLayer.add(labels)
  }

  private createButton(label: string, onClick: () => void): Phaser.GameObjects.Container {
    const bg = this.add
      .rectangle(0, 0, BUTTON_W, BUTTON_H, 0x2b6cb0)
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
    return this.add.container(0, 0, [bg, text]).setSize(BUTTON_W, BUTTON_H)
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
    this.buttons.forEach((button, i) => button.setPosition(centreX + (i - 1) * BUTTON_SPACING, buttonY))
    const messageY = buttonY - BUTTON_H / 2 - 26
    this.messageText.setPosition(centreX, messageY)

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

    this.turnText.setText(`Turn ${world.turn}`)
    this.column.refresh(this.active)
    this.hintText.setText(
      world.confronting !== null
        ? 'Monsters! Scout them, wait, or attack.'
        : here
          ? 'Scout, wait or attack, or click a hex to move away.'
          : 'Click a hex to travel there. Each hex takes a turn.',
    )
    for (const button of this.buttons) button.setVisible(here !== null && !this.walking)
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
    const toMonsters = locationAt(this.world, to)?.kind === 'monsters'
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
    if (this.walking) return
    const clicked = this.hexAt(pointer.x, pointer.y)
    if (!clicked) return
    const route = travel(this.world, clicked)
    if (route.length === 0) return

    this.walking = true
    this.messageText.setText('')
    this.refreshWalking()
    this.tweens.chain({
      targets: this.party,
      tweens: route.map((h) => {
        const { x, y } = boardHexCenter(h, WORLD_LAYOUT)
        // The party sprite is drawn facing right.
        return { x, y: y + PARTY_FEET_Y, duration: WALK_STEP_MS, onStart: () => this.party.setFlipX(x < this.party.x) }
      }),
      onComplete: () => this.arrive(),
    })
  }

  /** While the party walks, nothing else can be done and its hex is not yet where it stands. */
  private refreshWalking(): void {
    this.partyMark.clear()
    for (const button of this.buttons) button.setVisible(false)
    this.refreshHover()
  }

  private arrive(): void {
    this.walking = false
    this.follow()
    // The map has scrolled under the pointer, which is over another hex now.
    const pointer = this.input.activePointer
    this.hovered = this.hexAt(pointer.x, pointer.y)
    const here = monstersHere(this.world)
    if (here) this.messageText.setText(`You come upon the ${here.name} (threat ${here.threat}).`)
    this.refresh()
  }

  /** Scouting and waiting each pass a turn among the monsters; nothing comes of either yet. */
  private onLinger(how: Lingering): void {
    const here = monstersHere(this.world)
    if (!here || !linger(this.world, how)) return
    this.messageText.setText(
      how === 'scout'
        ? `You scout the ${here.name}, but learn nothing new.`
        : `You wait a turn. The ${here.name} do not stir.`,
    )
    this.refresh()
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
    const members = party.map((member) => ({ character: member }))
    this.scene.launch('Inventory', { members, index, tab, canAdvance: true, resume: 'World' })
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
