import Phaser from 'phaser'
import { loadAudioSettings } from './audioSettings.ts'
import { installLimiter } from './soundPlayer.ts'
import { BANKS, MUSIC_KEYS, bankFiles, musicFiles } from './sounds.ts'
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
    // Each bank of sound effects is an audio sprite: one file of every cue's variants, and its spritemap.
    for (const bank of BANKS) this.load.audioSprite(bank, bankFiles(bank).json, bankFiles(bank).audio)
    for (const key of MUSIC_KEYS) this.load.audio(key, musicFiles(key))
    // The animations name their texture by the atlas's file name, which is this key.
    this.load.atlas(SPRITE_ATLAS, `assets/sprites/${SPRITE_ATLAS}.png`, `assets/sprites/${SPRITE_ATLAS}.json`)
    this.load.animation('sprite_anims', `assets/sprites/${SPRITE_ATLAS}.anims.json`)
  }

  create(): void {
    // The master level is the sound manager's global volume, shared by every scene.
    this.sound.volume = loadAudioSettings().master
    // Before anything plays, so that no sound ever clips.
    installLimiter(this.game)
    this.scene.start('Menu')
  }
}
