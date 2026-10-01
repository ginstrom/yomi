import Phaser from 'phaser'

interface MenuData {
  canContinue?: boolean
}

const BUTTON_W = 220
const BUTTON_H = 52
const BUTTON_GAP = 20

export class MenuScene extends Phaser.Scene {
  private canContinue = false
  private bg!: Phaser.GameObjects.Rectangle
  private title!: Phaser.GameObjects.Text
  private buttons: Phaser.GameObjects.Container[] = []
  private hintText!: Phaser.GameObjects.Text

  constructor() {
    super('Menu')
  }

  create(data: MenuData): void {
    this.canContinue = data?.canContinue ?? false

    this.bg = this.add.rectangle(0, 0, 1, 1, 0x14100c, 1).setOrigin(0.5)
    this.title = this.add
      .text(0, 0, 'YOMI', { fontFamily: 'monospace', fontSize: '56px', color: '#e8c766', fontStyle: 'bold' })
      .setOrigin(0.5)

    const newButton = this.createButton('New', () => this.onNew(), true)
    const continueButton = this.createButton('Continue', () => this.onContinue(), this.canContinue)
    const optionsButton = this.createButton('Options', () => this.onOptions(), true)
    this.buttons = [newButton, continueButton, optionsButton]

    this.hintText = this.add
      .text(0, 0, '', { fontFamily: 'monospace', fontSize: '13px', color: '#8a7a5a' })
      .setOrigin(0.5)
      .setVisible(false)

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
      bg.on('pointerdown', () => onClick())
    }

    const container = this.add.container(0, 0, [bg, text])
    container.setSize(BUTTON_W, BUTTON_H)
    return container
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

    this.hintText.setPosition(centerX, startY + this.buttons.length * (BUTTON_H + BUTTON_GAP) + 6)
  }

  // ---- actions ---------------------------------------------------------------

  private onNew(): void {
    this.scene.stop()
    this.scene.start('Battle')
  }

  private onContinue(): void {
    if (!this.canContinue) return
    this.scene.stop()
    this.scene.resume('Battle')
  }

  private onOptions(): void {
    this.hintText.setText('Options coming soon...')
    this.hintText.setVisible(true)
    this.time.delayedCall(1500, () => this.hintText.setVisible(false))
  }

  private onEscape(): void {
    if (this.canContinue) this.onContinue()
  }
}
