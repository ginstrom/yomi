import Phaser from 'phaser'
import { loadAudioSettings } from './audioSettings.ts'
import { SOUND_KEYS, soundFiles } from './sounds.ts'
import { SPRITE_ATLAS } from './unitLook.ts'

export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot')
  }

  /**
   * Sounds load once here, as do the sprite atlas and its animations: Phaser's
   * caches and its animations are shared by every scene.
   */
  preload(): void {
    for (const key of SOUND_KEYS) this.load.audio(key, soundFiles(key))
    // The animations name their texture by the atlas's file name, which is this key.
    this.load.atlas(SPRITE_ATLAS, `assets/sprites/${SPRITE_ATLAS}.png`, `assets/sprites/${SPRITE_ATLAS}.json`)
    this.load.animation('sprite_anims', `assets/sprites/${SPRITE_ATLAS}.anims.json`)
  }

  create(): void {
    // The master level is the sound manager's global volume, shared by every scene.
    this.sound.volume = loadAudioSettings().master
    this.scene.start('Menu')
  }
}
