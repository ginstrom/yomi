import Phaser from 'phaser'

export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot')
  }

  preload(): void {
    // Load assets here as the game grows.
  }

  create(): void {
    this.add
      .text(this.scale.width / 2, this.scale.height / 2, 'Yomi', {
        fontFamily: 'monospace',
        fontSize: '32px',
        color: '#ffffff',
      })
      .setOrigin(0.5)
  }
}
