import Phaser from 'phaser'
import { describeCost } from '../game/buildings.ts'
import { facilities, improveFacility, type FacilityId, type FacilityView } from '../game/encampment.ts'
import type { GameState } from '../game/gameState.ts'
import { encampmentName } from '../game/worldMap.ts'
import type { ButtonProbe, EncampmentProbe } from '../testHook.ts'
import { soundVolume } from './audioSettings.ts'
import type { Point } from './boardGeometry.ts'
import { facilityFrame, facilityLabel, plotAt } from './encampmentView.ts'
import type { Rect } from './mapScroll.ts'
import { addPanelButton } from './panelButton.ts'
import { tellStory } from './StoryScene.ts'
import { SPRITE_ATLAS, spriteAnim, spriteFrame } from './unitLook.ts'

interface EncampmentData {
  game: GameState
  /** The facility to show the details of, as the guild hall hands back. */
  select?: FacilityId
}

/** Drawn in a frame of this size, centred over the map and scaled down (never up) to fit the window. */
const FRAME_W = 720
const FRAME_H = 500
const CENTRE_X = FRAME_W / 2
const TITLE_Y = 34
/** The picture of the encampment: grass, a clearing, a palisade behind and the facilities on their plots. */
const PICTURE: Rect = { x: CENTRE_X, y: 214, width: FRAME_W - 40, height: 260 }
const PICTURE_TOP = PICTURE.y - PICTURE.height / 2
const BUILDING_SCALE = 3
const BUILDING_SIZE = 48 * BUILDING_SCALE
const DECOR_SCALE = 2
const LABEL_DY = 6
/** The details of the facility clicked, under the picture. */
const DETAILS_Y = 378
const MESSAGE_Y = 446
const BUTTON_Y = 474
const BUTTON_W = 190
const buttonAt = (index: number, of: number): Rect => ({
  x: CENTRE_X + (index - (of - 1) / 2) * (BUTTON_W + 16),
  y: BUTTON_Y,
  width: BUTTON_W,
  height: 36,
})

const FONT = 'monospace'
const GOLD = '#e8c766'
const DIM = '#8a7a5a'
const TEXT = '#d8c9a3'
const REFUSED = '#ffb74d'
const GRASS = 0x3b4a22
const CLEARING = 0x6b5132
const STAKE = 0x5c3b20
const STAKE_EDGE = 0x14100c

/**
 * The encampment, an overlay over the paused world map while the party stands
 * there: a picture of the place, every facility on its plot (encampment.ts
 * says which; encampmentView.ts how each is drawn), built or not. A click on
 * one shows what it does and what its next level costs, with a button to buy
 * it, and for the guild hall one to go in. Leaving starts the world map again,
 * as the party may have changed under its column.
 */
export class EncampmentScene extends Phaser.Scene {
  private gameState!: GameState
  private selected: FacilityId | null = null
  private hovered: FacilityId | null = null
  private message = ''
  private bg!: Phaser.GameObjects.Rectangle
  private frame!: Phaser.GameObjects.Container
  private controls: Partial<Record<keyof EncampmentProbe['buttons'], { at: Rect; enabled: boolean }>> = {}

  constructor() {
    super('Encampment')
  }

  create(data: EncampmentData): void {
    this.gameState = data.game
    this.selected = data.select ?? null
    this.hovered = null
    this.message = ''
    this.bg = this.add.rectangle(0, 0, 1, 1, 0x000000, 0.7).setOrigin(0).setInteractive()
    this.frame = this.add.container(0, 0)
    this.render()
    this.layout()
    this.scale.on(Phaser.Scale.Events.RESIZE, this.layout, this)
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.scale.off(Phaser.Scale.Events.RESIZE, this.layout, this))
    this.input.keyboard?.on('keydown-ESC', () => (this.selected ? this.select(null) : this.leave()))
    const leave = this.controls.leave?.at
    tellStory(this, this.gameState, { kind: 'encampment_opened' }, leave ? { 'encampment.leave': this.onScreen(leave) } : {})
  }

  /** Where a point of the frame is on screen. */
  private onScreen(at: Point): Point {
    const { x, y, scale } = this.frame
    return { x: x + at.x * scale, y: y + at.y * scale }
  }

  /** What the in-browser tests see of the encampment; see testHook.ts. */
  probe(): EncampmentProbe {
    const onScreen = (at: Point) => this.onScreen(at)
    const control = (key: keyof EncampmentProbe['buttons']): ButtonProbe => {
      const shown = this.controls[key]
      return { ...onScreen(shown?.at ?? { x: 0, y: 0 }), visible: !!shown, enabled: !!shown?.enabled }
    }
    return {
      name: encampmentName(this.gameState.world),
      selected: this.selected,
      message: this.message,
      facilities: facilities(this.gameState).map((facility, index) => ({
        ...onScreen(this.buildingCentre(index)),
        visible: true,
        enabled: true,
        id: facility.id,
        level: facility.level,
        frame: facilityFrame(facility),
      })),
      buttons: { improve: control('improve'), open: control('open'), leave: control('leave') },
    }
  }

  // ---- build -----------------------------------------------------------------

  private render(): void {
    this.frame.removeAll(true)
    this.controls = {}
    const { world } = this.gameState
    const stock = Object.entries(world.stock)
      .filter(([, amount]) => amount)
      .map(([material, amount]) => `${amount} ${material}`)
      .join(', ')
    this.frame.add([
      this.add.rectangle(CENTRE_X, FRAME_H / 2, FRAME_W, FRAME_H, 0x241d15, 0.98).setStrokeStyle(3, 0xc9a227),
      this.add.text(CENTRE_X, TITLE_Y, encampmentName(world), { fontFamily: FONT, fontSize: '28px', color: GOLD, fontStyle: 'bold' }).setOrigin(0.5),
      this.add.text(CENTRE_X, TITLE_Y + 28, `Your encampment.  Stock: ${stock || 'nothing'}`, { fontFamily: FONT, fontSize: '13px', color: DIM }).setOrigin(0.5),
    ])
    this.drawGrounds()
    const all = facilities(this.gameState)
    all.forEach((facility, index) => this.drawFacility(facility, index))
    this.drawDetails(all.find((f) => f.id === this.selected) ?? null)
    this.frame.add(
      this.add
        .text(CENTRE_X, MESSAGE_Y, this.message, { fontFamily: FONT, fontSize: '13px', color: TEXT, align: 'center', wordWrap: { width: FRAME_W - 40 } })
        .setOrigin(0.5),
    )
  }

  /** The grass, the clearing, a palisade along the back, two tents and the campfire: the encampment's look, which nothing changes. */
  private drawGrounds(): void {
    const { x, y, width, height } = PICTURE
    this.frame.add([
      this.add.rectangle(x, y, width, height, GRASS).setStrokeStyle(2, 0x14100c),
      this.add.ellipse(x, y + 62, width - 80, 150, CLEARING, 0.85),
    ])
    const stakes = this.add.graphics()
    for (let sx = x - width / 2 + 8; sx < x + width / 2 - 8; sx += 14) {
      stakes.fillStyle(STAKE_EDGE).fillRect(sx - 1, PICTURE_TOP + 8, 12, 46)
      stakes.fillStyle(STAKE).fillRect(sx, PICTURE_TOP + 12, 10, 41)
      stakes.fillStyle(STAKE_EDGE).fillTriangle(sx - 1, PICTURE_TOP + 9, sx + 11, PICTURE_TOP + 9, sx + 5, PICTURE_TOP + 2)
    }
    stakes.fillStyle(0x8a6038).fillRect(x - width / 2 + 4, PICTURE_TOP + 22, width - 8, 3)
    this.frame.add(stakes)
    const decor = (sprite: string, at: Point) =>
      this.add
        .sprite(at.x, at.y, SPRITE_ATLAS, spriteFrame(sprite, 'base'))
        .setOrigin(0.5, 1)
        .setScale(DECOR_SCALE)
    this.frame.add([decor('camp_tent', { x: 330, y: 214 }), decor('camp_tent', { x: 390, y: 206 })])
    this.frame.add(decor('camp_fire', { x: CENTRE_X + 4, y: 296 }).play(spriteAnim('camp_fire', 'idle')))
  }

  /** A facility's building on its plot, or the empty plot, with its name under it; a click shows its details. */
  private drawFacility(facility: FacilityView, index: number): void {
    const at = plotAt(index)
    const marked = this.selected === facility.id
    const building = this.add
      .sprite(at.x, at.y, SPRITE_ATLAS, facilityFrame(facility))
      .setOrigin(0.5, 1)
      .setScale(BUILDING_SCALE)
      .setInteractive({ useHandCursor: true, pixelPerfect: false })
    const edge = this.add
      .rectangle(at.x, at.y - BUILDING_SIZE / 2, BUILDING_SIZE, BUILDING_SIZE)
      .setStrokeStyle(2, 0xe8c766)
      .setVisible(marked || this.hovered === facility.id)
    building.on('pointerover', () => {
      this.hovered = facility.id
      edge.setVisible(true)
    })
    building.on('pointerout', () => {
      if (this.hovered === facility.id) this.hovered = null
      edge.setVisible(marked)
    })
    building.on('pointerdown', () => {
      this.sound.play('sfx_ui_click', { volume: soundVolume('sfx_ui_click') })
      // Next tick: the redraw destroys the sprite whose handler this runs in.
      this.time.delayedCall(0, () => this.select(facility.id))
    })
    this.frame.add([
      building,
      edge,
      this.add
        .text(at.x, at.y + LABEL_DY, facilityLabel(facility), {
          fontFamily: FONT,
          fontSize: '14px',
          color: marked ? GOLD : facility.level > 0 ? TEXT : DIM,
          backgroundColor: '#14100ccc',
          padding: { x: 6, y: 2 },
        })
        .setOrigin(0.5, 0),
    ])
  }

  /** What the facility clicked does and costs, and the buttons for it; a hint while none is. */
  private drawDetails(facility: FacilityView | null): void {
    const leaveAt = (of: number) => buttonAt(of - 1, of)
    if (!facility) {
      this.frame.add(
        this.add.text(CENTRE_X, DETAILS_Y + 24, 'Click a building or a plot to see what it does.', { fontFamily: FONT, fontSize: '14px', color: DIM }).setOrigin(0.5),
      )
      this.button('leave', leaveAt(1), 'Leave', () => this.leave())
      return
    }
    const level = facility.level > 0 ? `level ${facility.level} of ${facility.maxLevel}` : 'not built'
    const next = facility.next && facility.cost ? `Next: ${facility.next}  Cost: ${describeCost(facility.cost) || 'nothing'}.` : 'It is as great as it gets.'
    const left = 40
    this.frame.add([
      this.add.text(left, DETAILS_Y - 16, `${facility.name}, ${level}`, { fontFamily: FONT, fontSize: '16px', color: GOLD }),
      this.add.text(left, DETAILS_Y + 6, facility.about, { fontFamily: FONT, fontSize: '12px', color: DIM, wordWrap: { width: FRAME_W - 2 * left } }),
      this.add.text(left, DETAILS_Y + 24, facility.effect, { fontFamily: FONT, fontSize: '12px', color: TEXT, wordWrap: { width: FRAME_W - 2 * left } }),
      this.add.text(left, DETAILS_Y + 42, next, { fontFamily: FONT, fontSize: '12px', color: facility.refusal ? REFUSED : TEXT, wordWrap: { width: FRAME_W - 2 * left } }),
    ])
    const of = 2 + (facility.opens ? 1 : 0)
    let slot = 0
    if (facility.action) {
      this.button('improve', buttonAt(slot++, of), facility.action, () => this.improve(facility), facility.refusal === null)
    } else {
      this.button('improve', buttonAt(slot++, of), 'Fully built', () => {}, false)
    }
    if (facility.opens) this.button('open', buttonAt(slot++, of), `Enter the ${facility.name}`, () => this.openFacility(facility.id))
    this.button('leave', leaveAt(of), 'Leave', () => this.leave())
  }

  private button(key: keyof EncampmentProbe['buttons'], at: Rect, label: string, onClick: () => void, enabled = true): void {
    this.controls[key] = { at, enabled }
    // Next tick: the redraw a click leads to destroys the button whose handler this runs in.
    addPanelButton(this, this.frame, at, label, () => this.time.delayedCall(0, onClick), { enabled })
  }

  /** Where a facility's building is centred, in the frame. */
  private buildingCentre(index: number): Point {
    const at = plotAt(index)
    return { x: at.x, y: at.y - BUILDING_SIZE / 2 }
  }

  private layout(): void {
    const { width, height } = this.scale
    this.bg.setSize(width, height)
    const scale = Math.max(0, Math.min(1, (width - 32) / FRAME_W, (height - 32) / FRAME_H))
    this.frame.setScale(scale).setPosition((width - FRAME_W * scale) / 2, (height - FRAME_H * scale) / 2)
  }

  // ---- actions ---------------------------------------------------------------

  private select(id: FacilityId | null): void {
    this.selected = id
    this.message = ''
    this.render()
  }

  /** Builds or raises the facility, and says what came of it. */
  private improve(facility: FacilityView): void {
    const refusal = improveFacility(this.gameState, facility.id)
    this.message = refusal ?? (facility.level === 0 ? `The ${facility.name} is built.` : `The ${facility.name} is raised to level ${facility.level + 1}.`)
    this.render()
  }

  /** The guild hall's own screen, which comes back here when it closes. */
  private openFacility(id: FacilityId): void {
    if (id !== 'guild_hall') return
    this.scene.start('GuildHall', { game: this.gameState })
    this.scene.bringToTop('GuildHall')
  }

  /** Back to the map, started again: the party under its column may have changed, and the map saves as it opens. */
  private leave(): void {
    this.scene.start('World', { game: this.gameState })
  }
}
