import Phaser from 'phaser'
import { BootScene } from './scenes/BootScene.ts'
import { BattleScene } from './scenes/BattleScene.ts'
import { InventoryScene } from './scenes/InventoryScene.ts'

new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  backgroundColor: '#1d1d1d',
  pixelArt: true,
  scale: {
    mode: Phaser.Scale.RESIZE,
    width: '100%',
    height: '100%',
  },
  scene: [BootScene, BattleScene, InventoryScene],
})
