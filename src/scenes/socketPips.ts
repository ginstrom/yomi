import type Phaser from 'phaser'
import type { Item } from '../inventory/inventory.ts'
import { RUNE_COLOURS, SOCKET_PIP_KEYS, pipOffsets, socketPips } from './itemIcons.ts'

/**
 * Draws `item`'s socket pips in a row under the icon centred at (x, y), each filled one tinted in
 * its rune's colour. Returns the images, for the caller to add to its container; none for an
 * item with no sockets. Where the pips sit is `pipOffsets`'s.
 */
export function createPips(scene: Phaser.Scene, item: Item, x: number, y: number, scale: number): Phaser.GameObjects.Image[] {
  const pips = socketPips(item)
  const offsets = pipOffsets(pips.length, scale)
  return pips.map((rune, i) => {
    const image = scene.add.image(x + offsets[i].x, y + offsets[i].y, rune ? SOCKET_PIP_KEYS.filled : SOCKET_PIP_KEYS.empty)
    image.setScale(scale)
    if (rune) image.setTint(RUNE_COLOURS[rune])
    return image
  })
}
