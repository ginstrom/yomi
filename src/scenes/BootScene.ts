import Phaser from 'phaser'
import { loadAudioSettings } from './audioSettings.ts'
import { SOUND_KEYS, soundFiles } from './sounds.ts'

export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot')
  }

  /** Sounds load once here; Phaser's sound cache is shared by every scene. */
  preload(): void {
    for (const key of SOUND_KEYS) this.load.audio(key, soundFiles(key))
  }

  create(): void {
    // The master level is the sound manager's global volume, shared by every scene.
    this.sound.volume = loadAudioSettings().master
    this.scene.start('Menu')
  }
}
