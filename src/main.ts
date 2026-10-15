import Phaser from 'phaser'
import { BootScene } from './scenes/BootScene.ts'
import { MenuScene } from './scenes/MenuScene.ts'
import { PartyScene } from './scenes/PartyScene.ts'
import { CreationScene } from './scenes/CreationScene.ts'
import { WorldScene } from './scenes/WorldScene.ts'
import { BattleScene } from './scenes/BattleScene.ts'
import { InventoryScene } from './scenes/InventoryScene.ts'
import { GuildHallScene } from './scenes/GuildHallScene.ts'
import { SEED_KEY, seedFromUrl } from './scenes/seed.ts'
import { installTestHook } from './testHook.ts'

/**
 * The smallest the game gets: beside the party's column, the board and the
 * character panel fit at full size and nothing clips. In a smaller window the
 * page scrolls instead.
 */
const MIN_GAME_SIZE = { width: 840, height: 560 }

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  backgroundColor: '#1d1d1d',
  pixelArt: true,
  scale: {
    mode: Phaser.Scale.RESIZE,
    width: '100%',
    height: '100%',
    min: MIN_GAME_SIZE,
  },
  scene: [BootScene, MenuScene, PartyScene, CreationScene, WorldScene, BattleScene, InventoryScene, GuildHallScene],
})
game.registry.set(SEED_KEY, seedFromUrl(window.location.search))
// Dev builds only: the in-browser tests drive the game through this.
if (import.meta.env.DEV) installTestHook(game)
