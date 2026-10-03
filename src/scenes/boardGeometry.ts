import { hexToPixel, pixelToHex, type BoardSize, type Hex } from '../grid/hex.ts'

export interface Point {
  x: number
  y: number
}

/** Corner radius of a hex in pixels, before the floor's vertical squash. */
export const HEX_SIZE = 40
export const FLOOR_SQUASH_Y = 0.6

/** Board size in board-local pixels, after the squash and before any scale. */
export function boardPixelSize({ cols, rows }: BoardSize): { width: number; height: number } {
  return {
    width: Math.sqrt(3) * HEX_SIZE * (cols + 0.5),
    height: HEX_SIZE * (1.5 * rows + 0.5) * FLOOR_SQUASH_Y,
  }
}

/** Centre of a hex in board-local pixels, relative to the board's top-left corner. */
export function boardHexCenter(h: Hex): Point {
  const { x, y } = hexToPixel(h, HEX_SIZE)
  // hex(0, 0) sits half a hex in from the board's left and top edges.
  return { x: x + (Math.sqrt(3) / 2) * HEX_SIZE, y: (y + HEX_SIZE) * FLOOR_SQUASH_Y }
}

/**
 * The hex under a screen point, for a board drawn with its top-left corner at
 * `origin` and scaled by `scale`. The hex may lie off the board.
 */
export function boardHexAt(screen: Point, origin: Point, scale: number): Hex {
  const localX = (screen.x - origin.x) / scale - (Math.sqrt(3) / 2) * HEX_SIZE
  const localY = (screen.y - origin.y) / scale / FLOOR_SQUASH_Y - HEX_SIZE
  return pixelToHex(localX, localY, HEX_SIZE)
}
