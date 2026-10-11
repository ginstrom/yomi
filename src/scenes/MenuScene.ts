import Phaser from 'phaser'
import { newGame } from '../game/gameState.ts'
import { getAudioSettings, setAudioLevel, soundVolume, type AudioChannel } from './audioSettings.ts'

interface MenuData {
  /** The paused scene the menu was opened over, which Continue goes back to. */
  resume?: 'World' | 'Battle'
}

const BUTTON_W = 220
const BUTTON_H = 52
const BUTTON_GAP = 20

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
  private bg!: Phaser.GameObjects.Rectangle
  private title!: Phaser.GameObjects.Text
  private buttons: Phaser.GameObjects.Container[] = []
  private optionsTitle!: Phaser.GameObjects.Text
  private sliders: Slider[] = []
  private backButton!: Phaser.GameObjects.Container
  /** The slider being dragged, if any. */
  private dragging: Slider | null = null
  private showingOptions = false

  constructor() {
    super('Menu')
  }

  create(data: MenuData): void {
    this.resumeKey = data?.resume

    this.bg = this.add.rectangle(0, 0, 1, 1, 0x14100c, 1).setOrigin(0.5)
    this.title = this.add
      .text(0, 0, 'YOMI', { fontFamily: 'monospace', fontSize: '56px', color: '#e8c766', fontStyle: 'bold' })
      .setOrigin(0.5)

    const newButton = this.createButton('New', () => this.onNew(), true)
    const continueButton = this.createButton('Continue', () => this.onContinue(), this.resumeKey !== undefined)
    const optionsButton = this.createButton('Options', () => this.onOptions(), true)
    this.buttons = [newButton, continueButton, optionsButton]

    this.optionsTitle = this.add
      .text(0, 0, 'Options', { fontFamily: 'monospace', fontSize: '24px', color: '#e8c766', fontStyle: 'bold' })
      .setOrigin(0.5)
    this.sliders = SLIDERS.map(({ channel, label }) => this.createSlider(channel, label))
    this.backButton = this.createButton('Back', () => this.showOptions(false), true)
    this.showOptions(false)

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

  // ---- build ---------------------------------------------------------------

  private createButton(label: string, onClick: () => void, enabled: boolean): Phaser.GameObjects.Container {
    const bg = this.add
      .rectangle(0, 0, BUTTON_W, BUTTON_H, enabled ? 0x2b6cb0 : 0x2a2a2a)
      .setStrokeStyle(2, enabled ? 0x90cdf4 : 0x4a4a4a)
    const text = this.add
      .text(0, 0, label, {
        fontFamily: 'monospace',
        fontSize: '18px',
        color: enabled ? '#ffffff' : '#707070',
      })
      .setOrigin(0.5)

    if (enabled) {
      bg.setInteractive({ useHandCursor: true })
      bg.on('pointerover', () => bg.setFillStyle(0x3182ce))
      bg.on('pointerout', () => bg.setFillStyle(0x2b6cb0))
      bg.on('pointerdown', () => {
        this.sound.play('sfx_ui_click', { volume: soundVolume('sfx_ui_click') })
        onClick()
      })
    }

    const container = this.add.container(0, 0, [bg, text])
    container.setSize(BUTTON_W, BUTTON_H)
    return container
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

    this.buttons.forEach((button, i) => {
      button.setPosition(centerX, startY + i * (BUTTON_H + BUTTON_GAP))
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
    this.backButton.setPosition(centerX, slidersY + this.sliders.length * SLIDER_ROW_GAP + 30)
  }

  private drawSlider(slider: Slider): void {
    const level = getAudioSettings()[slider.channel]
    slider.fill.setSize(SLIDER_W * level, SLIDER_H)
    slider.knob.setPosition(slider.track.x + SLIDER_W * level, slider.track.y)
    slider.value.setText(`${Math.round(level * 100)}%`)
  }

  // ---- actions ---------------------------------------------------------------

  /** A new game starts on the world map; the game the menu was opened over is dropped. */
  private onNew(): void {
    if (this.resumeKey) this.scene.stop(this.resumeKey)
    this.scene.start('World', { game: newGame() })
  }

  private onContinue(): void {
    if (!this.resumeKey) return
    this.scene.stop()
    this.scene.resume(this.resumeKey)
  }

  private onOptions(): void {
    this.showOptions(true)
  }

  /** Swaps the main buttons for the volume controls, or back. */
  private showOptions(show: boolean): void {
    this.showingOptions = show
    this.endDrag()
    for (const button of this.buttons) button.setVisible(!show)
    this.optionsTitle.setVisible(show)
    for (const { label, track, fill, knob, value } of this.sliders) {
      for (const part of [label, track, fill, knob, value]) part.setVisible(show)
    }
    this.backButton.setVisible(show)
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
    if (this.showingOptions) this.showOptions(false)
    else this.onContinue()
  }
}
