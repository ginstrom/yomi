import type Phaser from 'phaser'

/** Emitted on the game's events by an overlay whose action changed the stock, so the map's header (visible behind the overlay, its scene paused) shows it at once. */
export const STOCK_CHANGED = 'stock-changed'

export const notifyStock = (scene: Phaser.Scene): void => {
  scene.game.events.emit(STOCK_CHANGED)
}
