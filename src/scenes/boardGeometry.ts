import { hexToPixel, pixelToHex, type BoardSize, type Hex } from '../grid/hex.ts'

export interface Point {
  x: number
  y: number
}

/** Corner radius of a hex in pixels, before the floor's vertical squash. */
export const HEX_SIZE = 40
export const FLOOR_SQUASH_Y = 0.6

/** How a board of hexes is drawn: the hexes' corner radius, and how far it is flattened to look like a floor. */
export interface BoardLayout {
  hexSize: number
  squashY: number
}

/** The battlefield, seen at an angle. */
export const BATTLE_LAYOUT: BoardLayout = { hexSize: HEX_SIZE, squashY: FLOOR_SQUASH_Y }
/** The world map, seen from above, with smaller hexes so more of them fit. */
export const WORLD_LAYOUT: BoardLayout = { hexSize: 32, squashY: 1 }

/** Board size in board-local pixels, after the squash and before any scale. */
export function boardPixelSize(
  { cols, rows }: BoardSize,
  { hexSize, squashY }: BoardLayout = BATTLE_LAYOUT,
): { width: number; height: number } {
  return {
    width: Math.sqrt(3) * hexSize * (cols + 0.5),
    height: hexSize * (1.5 * rows + 0.5) * squashY,
  }
}

/** Centre of a hex in board-local pixels, relative to the board's top-left corner. */
export function boardHexCenter(h: Hex, { hexSize, squashY }: BoardLayout = BATTLE_LAYOUT): Point {
  const { x, y } = hexToPixel(h, hexSize)
  // hex(0, 0) sits half a hex in from the board's left and top edges.
  return { x: x + (Math.sqrt(3) / 2) * hexSize, y: (y + hexSize) * squashY }
}

/**
 * The hex under a screen point, for a board drawn with its top-left corner at
 * `origin` and scaled by `scale`. The hex may lie off the board.
 */
export function boardHexAt(
  screen: Point,
  origin: Point,
  scale: number,
  { hexSize, squashY }: BoardLayout = BATTLE_LAYOUT,
): Hex {
  const localX = (screen.x - origin.x) / scale - (Math.sqrt(3) / 2) * hexSize
  const localY = (screen.y - origin.y) / scale / squashY - hexSize
  return pixelToHex(localX, localY, hexSize)
}

/** Centre of a hex on screen, for a board drawn as `boardHexAt` has it: the inverse of that function. */
export function boardHexOnScreen(h: Hex, origin: Point, scale: number, layout: BoardLayout = BATTLE_LAYOUT): Point {
  const { x, y } = boardHexCenter(h, layout)
  return { x: origin.x + x * scale, y: origin.y + y * scale }
}

/** A curved arrow's shaft, as points along it, and its head, as a triangle whose first point is the tip. */
export interface CurvedArrow {
  shaft: Point[]
  head: [Point, Point, Point]
}

/**
 * An arrow from `from` to `to` that bows upwards (or, between points on one
 * level, up from the line between them), ending in a head at `to`.
 */
export function curvedArrow(from: Point, to: Point, headLength = 12, segments = 16): CurvedArrow {
  const dx = to.x - from.x
  const dy = to.y - from.y
  const length = Math.hypot(dx, dy)
  // The normal that points up the screen, so arrows arc like a thrown ball.
  let nx = -dy / length
  let ny = dx / length
  if (ny > 0 || (ny === 0 && nx > 0)) {
    nx = -nx
    ny = -ny
  }
  const bow = length * 0.25
  const control = { x: (from.x + to.x) / 2 + nx * bow, y: (from.y + to.y) / 2 + ny * bow }
  const at = (t: number): Point => ({
    x: (1 - t) ** 2 * from.x + 2 * (1 - t) * t * control.x + t ** 2 * to.x,
    y: (1 - t) ** 2 * from.y + 2 * (1 - t) * t * control.y + t ** 2 * to.y,
  })
  // The head points along the curve's tangent at its end, which runs from the control point.
  const tx = to.x - control.x
  const ty = to.y - control.y
  const tl = Math.hypot(tx, ty)
  const ux = tx / tl
  const uy = ty / tl
  const base = { x: to.x - ux * headLength, y: to.y - uy * headLength }
  const half = headLength * 0.55
  const head: [Point, Point, Point] = [
    to,
    { x: base.x - uy * half, y: base.y + ux * half },
    { x: base.x + uy * half, y: base.y - ux * half },
  ]
  // The shaft stops where the head begins, so the head's tip stays sharp.
  const shaft: Point[] = []
  for (let i = 0; i <= segments; i++) {
    const p = at(i / segments)
    if (Math.hypot(p.x - to.x, p.y - to.y) < headLength) {
      shaft.push(base)
      break
    }
    shaft.push(p)
  }
  return { shaft, head }
}
