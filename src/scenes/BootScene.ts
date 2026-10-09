import Phaser from 'phaser'
import { SOUND_KEYS } from './sounds.ts'

export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot')
  }

  /** Sounds load once here; Phaser's sound cache is shared by every scene. */
  preload(): void {
    for (const key of SOUND_KEYS) this.load.audio(key, `assets/audio/${key}.wav`)
  }

  create(): void {
    this.scene.start('Menu', { canContinue: false })
  }
}
