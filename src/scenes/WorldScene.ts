import Phaser from 'phaser'
import { xpToNextLevel } from '../character/progression.ts'
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
import { soundVolume } from './audioSettings.ts'
import { WORLD_LAYOUT, boardHexAt, boardHexCenter, boardPixelSize } from './boardGeometry.ts'
import { CURSORS } from './cursors.ts'

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
/** The party is the hero's battle sprite, shown smaller than on the battlefield. */
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

/** Below the turn and hint lines; the map keeps clear of them. */
const HEADER_BOTTOM = 64
const MAP_MARGIN_X = 16
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

  private mapLayer!: Phaser.GameObjects.Container
  /** The route a click on the hovered hex would walk. */
  private hoverMarks!: Phaser.GameObjects.Graphics
  private partyMark!: Phaser.GameObjects.Graphics
  private party!: Phaser.GameObjects.Image

  private turnText!: Phaser.GameObjects.Text
  private hintText!: Phaser.GameObjects.Text
  /** The hero's level, experience and hit points, at the top right. */
  private partyText!: Phaser.GameObjects.Text
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
    for (const key of Object.values(LOCATION_SPRITES)) this.load.image(key, `assets/sprites/${key}.png`)
  }

  create(data: WorldData): void {
    this.gameState = data?.game ?? newGame()
    this.board = new HexBoard(this.world.board)
    // Phaser reuses the scene instance on restart, so field initializers don't run again.
    this.walking = false
    this.hovered = null

    this.mapLayer = this.add.container(0, 0)
    this.buildTerrain()
    this.hoverMarks = this.add.graphics()
    this.partyMark = this.add.graphics()
    this.mapLayer.add([this.hoverMarks, this.partyMark])
    this.buildLocations()

    this.turnText = this.add.text(20, 16, '', { fontFamily: 'monospace', fontSize: '20px', color: '#ffffff' })
    this.hintText = this.add.text(20, 44, '', { fontFamily: 'monospace', fontSize: '13px', color: '#9e9e9e' })
    this.partyText = this.add
      .text(0, 20, '', { fontFamily: 'monospace', fontSize: '15px', color: '#e8c766' })
      .setOrigin(1, 0)
    this.messageText = this.add
      .text(0, 0, '', { fontFamily: 'monospace', fontSize: '15px', color: '#cfd8dc' })
      .setOrigin(0.5)

    this.buttons = [
      this.createButton('Scout', () => this.onLinger('scout')),
      this.createButton('Wait', () => this.onLinger('wait')),
      this.createButton('Attack', () => this.onAttack()),
    ]

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

    this.layout()
    this.scale.on(Phaser.Scale.Events.RESIZE, this.layout, this)
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off(Phaser.Scale.Events.RESIZE, this.layout, this)
      this.input.setDefaultCursor('default')
    })

    const here = monstersHere(this.world)
    this.messageText.setText(here ? `You stand before the ${here.name}.` : '')
    this.refresh()
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

  /** Header at the top, message and buttons at the bottom, and the map centred between, scaled down (never up) to fit. */
  private layout(): void {
    const { width, height } = this.scale
    this.partyText.setX(width - 20)
    const buttonY = height - 50
    this.buttons.forEach((button, i) => button.setPosition(width / 2 + (i - 1) * BUTTON_SPACING, buttonY))
    const messageY = buttonY - BUTTON_H / 2 - 26
    this.messageText.setPosition(width / 2, messageY)

    const map = boardPixelSize(this.world.board, WORLD_LAYOUT)
    const freeW = width - 2 * MAP_MARGIN_X
    const freeH = messageY - 20 - HEADER_BOTTOM
    const scale = Math.max(0, Math.min(1, freeW / map.width, freeH / map.height))
    this.mapLayer
      .setPosition(MAP_MARGIN_X + (freeW - map.width * scale) / 2, HEADER_BOTTOM + (freeH - map.height * scale) / 2)
      .setScale(scale)
  }

  /** The map hex under a screen position, or null when off the map. */
  private hexAt(screenX: number, screenY: number): Hex | null {
    const origin = { x: this.mapLayer.x, y: this.mapLayer.y }
    const h = boardHexAt({ x: screenX, y: screenY }, origin, this.mapLayer.scale, WORLD_LAYOUT)
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

    const { name, level, xp, hp, base } = this.gameState.player
    this.turnText.setText(`Turn ${world.turn}`)
    this.partyText.setText(`${name}  Level ${level}  XP ${xp}/${xpToNextLevel(level)}  HP ${hp}/${base.maxHp}`)
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
    const here = monstersHere(this.world)
    if (here) this.messageText.setText(`You come upon the ${here.name}.`)
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

  private openMenu(): void {
    if (this.scene.isPaused()) return
    this.scene.launch('Menu', { resume: 'World' })
    this.scene.bringToTop('Menu')
    this.scene.pause()
  }
}
