import Phaser from 'phaser'
import type { GameState } from '../game/gameState.ts'
import { SLOT_IDS, describeSlot, latestSlot, readSlot, type SlotId } from '../game/saveSlots.ts'
import { buttonProbe, type MenuProbe } from '../testHook.ts'
import { setTutorial } from '../story/story.ts'
import { getAudioSettings, setAudioLevel, soundVolume, type AudioChannel } from './audioSettings.ts'

interface MenuData {
  /** The paused scene the menu was opened over, which Continue goes back to. */
  resume?: 'World' | 'Battle'
  /** The game paused under the menu, whose tutorial the options turn on and off. */
  game?: GameState
}

/** What the menu shows: its main buttons, the volume controls, or the save slots to load from. */
type MenuView = 'main' | 'options' | 'load'

const BUTTON_W = 220
const BUTTON_H = 52
const BUTTON_GAP = 16
/** A save slot's row in the Load list: wide enough for its party, level, turn and date. */
const SLOT_W = 620
const SLOT_H = 44
const SLOT_GAP = 14

const SLIDER_W = 200
const SLIDER_H = 10
const SLIDER_ROW_GAP = 48
const SLIDER_LABEL_W = 130
const SLIDER_VALUE_W = 56

const SLIDERS: { channel: AudioChannel; label: string }[] = [
  { channel: 'master', label: 'Master' },
  { channel: 'effects', label: 'Sound FX' },
  { channel: 'music', label: 'Music' },
]

/** A volume control: a track to click or drag along, its filled part and a readout. */
interface Slider {
  channel: AudioChannel
  label: Phaser.GameObjects.Text
  track: Phaser.GameObjects.Rectangle
  fill: Phaser.GameObjects.Rectangle
  knob: Phaser.GameObjects.Rectangle
  value: Phaser.GameObjects.Text
}

export class MenuScene extends Phaser.Scene {
  private resumeKey: MenuData['resume']
  private gameState: GameState | undefined
  /** The options' switch for the paused game's tutorial, shown only over a game. */
  private tutorialButton!: Phaser.GameObjects.Container
  private bg!: Phaser.GameObjects.Rectangle
  private title!: Phaser.GameObjects.Text
  private buttons: Phaser.GameObjects.Container[] = []
  private optionsTitle!: Phaser.GameObjects.Text
  private sliders: Slider[] = []
  private backButton!: Phaser.GameObjects.Container
  private loadTitle!: Phaser.GameObjects.Text
  /** A row for each save slot, with what it was drawn from. */
  private slots: Array<{ button: Phaser.GameObjects.Container; line: string; loadable: boolean }> = []
  /** The slider being dragged, if any. */
  private dragging: Slider | null = null
  private view: MenuView = 'main'
  /** Whether Continue has anything to go to: a paused game, or a slot that can be loaded. */
  private canContinue = false
  /** Whether the manual is over the menu, or on its way: the menu then takes no clicks or keys. */
  private manualOpen = false

  constructor() {
    super('Menu')
  }

  create(data: MenuData): void {
    this.resumeKey = data?.resume
    this.gameState = data?.game

    this.bg = this.add.rectangle(0, 0, 1, 1, 0x14100c, 1).setOrigin(0.5)
    this.title = this.add
      .text(0, 0, 'YOMI', { fontFamily: 'monospace', fontSize: '56px', color: '#e8c766', fontStyle: 'bold' })
      .setOrigin(0.5)

    this.canContinue = this.resumeKey !== undefined || latestSlot() !== null
    const newButton = this.createButton('New', () => this.onNew(), true)
    const continueButton = this.createButton('Continue', () => this.onContinue(), this.canContinue)
    const loadButton = this.createButton('Load', () => this.show('load'), true)
    const optionsButton = this.createButton('Options', () => this.show('options'), true)
    const manualButton = this.createButton('Manual', () => this.openManual(), true)
    this.buttons = [newButton, continueButton, loadButton, optionsButton, manualButton]

    this.optionsTitle = this.add
      .text(0, 0, 'Options', { fontFamily: 'monospace', fontSize: '24px', color: '#e8c766', fontStyle: 'bold' })
      .setOrigin(0.5)
    this.sliders = SLIDERS.map(({ channel, label }) => this.createSlider(channel, label))
    this.tutorialButton = this.createTutorialButton()
    this.loadTitle = this.add
      .text(0, 0, 'Load', { fontFamily: 'monospace', fontSize: '24px', color: '#e8c766', fontStyle: 'bold' })
      .setOrigin(0.5)
    this.slots = SLOT_IDS.map((slot) => {
      const { line, loadable } = describeSlot(slot)
      return { button: this.createButton(line, () => this.loadSlot(slot), loadable, SLOT_W, SLOT_H), line, loadable }
    })
    this.backButton = this.createButton('Back', () => this.show('main'), true)
    this.show('main')

    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (this.dragging && pointer.isDown) this.setFromPointer(this.dragging, pointer)
    })
    this.input.on('pointerup', () => this.endDrag())
    this.input.on(Phaser.Input.Events.GAME_OUT, () => this.endDrag())

    this.layout()
    this.scale.on(Phaser.Scale.Events.RESIZE, this.layout, this)
    // Phaser doesn't call a shutdown() method on scenes; it only emits SHUTDOWN.
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off(Phaser.Scale.Events.RESIZE, this.layout, this)
    })

    this.input.keyboard?.on('keydown-ESC', () => this.onEscape())
  }

  /** What the in-browser tests see of the menu; see testHook.ts. */
  probe(): MenuProbe {
    const [newButton, continueButton, loadButton, optionsButton, manualButton] = this.buttons
    return {
      showingOptions: this.view === 'options',
      showingLoad: this.view === 'load',
      showingManual: this.manualOpen,
      tutorial: this.gameState?.story.tutorial ?? null,
      buttons: {
        new: buttonProbe(newButton),
        continue: buttonProbe(continueButton, this.canContinue),
        load: buttonProbe(loadButton),
        options: buttonProbe(optionsButton),
        manual: buttonProbe(manualButton),
        back: buttonProbe(this.backButton),
        tutorial: buttonProbe(this.tutorialButton),
      },
      slots: this.slots.map(({ button, line, loadable }) => ({ ...buttonProbe(button, loadable), line })),
    }
  }

  // ---- build ---------------------------------------------------------------

  private createButton(
    label: string,
    onClick: () => void,
    enabled: boolean,
    width = BUTTON_W,
    height = BUTTON_H,
  ): Phaser.GameObjects.Container {
    const bg = this.add
      .rectangle(0, 0, width, height, enabled ? 0x2b6cb0 : 0x2a2a2a)
      .setStrokeStyle(2, enabled ? 0x90cdf4 : 0x4a4a4a)
    const text = this.add
      .text(0, 0, label, {
        fontFamily: 'monospace',
        fontSize: width === BUTTON_W ? '18px' : '14px',
        color: enabled ? '#ffffff' : '#707070',
      })
      .setOrigin(0.5)
    // A slot's line can run long (three long names, a battle's name): it shrinks to fit its row.
    text.setScale(Math.min(1, (width - 24) / text.width))

    if (enabled) {
      bg.setInteractive({ useHandCursor: true })
      bg.on('pointerover', () => bg.setFillStyle(0x3182ce))
      bg.on('pointerout', () => bg.setFillStyle(0x2b6cb0))
      bg.on('pointerdown', () => {
        if (this.manualOpen) return
        this.sound.play('sfx_ui_click', { volume: soundVolume('sfx_ui_click') })
        onClick()
      })
    }

    const container = this.add.container(0, 0, [bg, text])
    container.setSize(width, height)
    return container
  }

  /** "Tutorial: On" or "Off", for the game under the menu; it saves with the game as the game goes on. */
  private createTutorialButton(): Phaser.GameObjects.Container {
    const label = () => `Tutorial: ${this.gameState?.story.tutorial ? 'On' : 'Off'}`
    const button = this.createButton(label(), () => {
      if (!this.gameState) return
      setTutorial(this.gameState, !this.gameState.story.tutorial)
      ;(button.list[1] as Phaser.GameObjects.Text).setText(label())
    }, true)
    return button
  }

  private createSlider(channel: AudioChannel, labelText: string): Slider {
    const label = this.add
      .text(0, 0, labelText, { fontFamily: 'monospace', fontSize: '16px', color: '#ffffff' })
      .setOrigin(0, 0.5)
    // The track's hit area is taller than it looks, so it's easy to grab.
    const track = this.add.rectangle(0, 0, SLIDER_W, SLIDER_H, 0x2a2a2a).setStrokeStyle(1, 0x4a4a4a).setOrigin(0, 0.5)
    track.setInteractive({
      hitArea: new Phaser.Geom.Rectangle(0, -10, SLIDER_W, SLIDER_H + 20),
      hitAreaCallback: Phaser.Geom.Rectangle.Contains,
      useHandCursor: true,
    })
    const fill = this.add.rectangle(0, 0, 0, SLIDER_H, 0x2b6cb0).setOrigin(0, 0.5)
    const knob = this.add.rectangle(0, 0, 10, 22, 0x90cdf4).setStrokeStyle(1, 0xffffff)
    const value = this.add
      .text(0, 0, '', { fontFamily: 'monospace', fontSize: '16px', color: '#e8c766' })
      .setOrigin(1, 0.5)

    const slider: Slider = { channel, label, track, fill, knob, value }
    track.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      this.dragging = slider
      this.setFromPointer(slider, pointer)
    })
    return slider
  }

  // ---- layout ---------------------------------------------------------------

  private layout(): void {
    const { width, height } = this.scale
    this.bg.setSize(width, height)
    this.bg.setPosition(width / 2, height / 2)

    const centerX = width / 2
    const startY = height / 2 - 20
    this.title.setPosition(centerX, startY - 160)

    // The main buttons start a little above the rest, so that all five fit the smallest window.
    this.buttons.forEach((button, i) => {
      button.setPosition(centerX, startY - 80 + i * (BUTTON_H + BUTTON_GAP))
    })

    const rowW = SLIDER_LABEL_W + SLIDER_W + SLIDER_VALUE_W
    const left = centerX - rowW / 2
    const slidersY = startY - 20
    this.optionsTitle.setPosition(centerX, slidersY - 60)
    this.sliders.forEach((slider, i) => {
      const y = slidersY + i * SLIDER_ROW_GAP
      slider.label.setPosition(left, y)
      slider.track.setPosition(left + SLIDER_LABEL_W, y)
      slider.fill.setPosition(left + SLIDER_LABEL_W, y)
      slider.value.setPosition(left + rowW, y)
      this.drawSlider(slider)
    })

    // Back sits under whichever of the two it steps back from.
    this.loadTitle.setPosition(centerX, slidersY - 60)
    this.slots.forEach(({ button }, i) => button.setPosition(centerX, slidersY + i * (SLOT_H + SLOT_GAP)))
    const slidersEnd = slidersY + this.sliders.length * SLIDER_ROW_GAP + 10
    this.tutorialButton.setPosition(centerX, slidersEnd)
    const tutorialRoom = this.gameState ? BUTTON_H + BUTTON_GAP : 0
    const under = this.view === 'load' ? this.slots.length * (SLOT_H + SLOT_GAP) + 16 : this.sliders.length * SLIDER_ROW_GAP + 30 + tutorialRoom
    this.backButton.setPosition(centerX, slidersY + under)
  }

  private drawSlider(slider: Slider): void {
    const level = getAudioSettings()[slider.channel]
    slider.fill.setSize(SLIDER_W * level, SLIDER_H)
    slider.knob.setPosition(slider.track.x + SLIDER_W * level, slider.track.y)
    slider.value.setText(`${Math.round(level * 100)}%`)
  }

  // ---- actions ---------------------------------------------------------------

  /** A new game starts on the party screen; the game the menu was opened over stays in its slot. */
  private onNew(): void {
    if (this.resumeKey) this.scene.stop(this.resumeKey)
    this.scene.start('Party')
  }

  /** Back to the paused game, which is the latest save; with none paused, the slot written last. */
  private onContinue(): void {
    if (this.resumeKey) {
      this.scene.stop()
      this.scene.resume(this.resumeKey)
      return
    }
    const slot = latestSlot()
    if (slot !== null) this.loadSlot(slot)
  }

  /**
   * Loads a slot's game: on the world map, or in the battle it was saved in.
   * The game paused under the menu, if any, is dropped; it is in its own slot.
   */
  private loadSlot(slot: SlotId): void {
    const file = readSlot(slot)
    if (file === null || file === 'unreadable') return
    if (this.resumeKey) this.scene.stop(this.resumeKey)
    if (file.battle) this.scene.start('Battle', { game: file.game, location: file.battle.location, saved: file.battle })
    else this.scene.start('World', { game: file.game })
  }

  /**
   * Lays the player's manual over the menu, as a page of its own whose Back to game link
   * (or Esc) returns here, to the menu as it was and the game paused under it.
   */
  private openManual(): void {
    this.manualOpen = true
    this.input.keyboard?.resetKeys()
    void import('./manualOverlay.ts').then(({ openManual }) =>
      openManual(() => {
        this.manualOpen = false
      }),
    )
  }

  /** Swaps the main buttons for the volume controls or the save slots, or back. */
  private show(view: MenuView): void {
    this.view = view
    this.endDrag()
    for (const button of this.buttons) button.setVisible(view === 'main')
    this.optionsTitle.setVisible(view === 'options')
    for (const { label, track, fill, knob, value } of this.sliders) {
      for (const part of [label, track, fill, knob, value]) part.setVisible(view === 'options')
    }
    this.tutorialButton.setVisible(view === 'options' && this.gameState !== undefined)
    this.loadTitle.setVisible(view === 'load')
    for (const { button } of this.slots) button.setVisible(view === 'load')
    this.backButton.setVisible(view !== 'main')
    this.layout()
  }

  private setFromPointer(slider: Slider, pointer: Phaser.Input.Pointer): void {
    // Whole percents, so the readout matches what's saved.
    const level = Math.round(Phaser.Math.Clamp((pointer.x - slider.track.x) / SLIDER_W, 0, 1) * 100) / 100
    const settings = setAudioLevel(slider.channel, level)
    if (slider.channel === 'master') this.sound.volume = settings.master
    this.drawSlider(slider)
  }

  /** Letting go of the effects or master slider plays a click at the new level. */
  private endDrag(): void {
    const released = this.dragging
    this.dragging = null
    if (released && released.channel !== 'music') {
      this.sound.play('sfx_ui_click', { volume: soundVolume('sfx_ui_click') })
    }
  }

  private onEscape(): void {
    if (this.manualOpen) return
    if (this.view !== 'main') this.show('main')
    else if (this.resumeKey) this.onContinue()
  }
}
