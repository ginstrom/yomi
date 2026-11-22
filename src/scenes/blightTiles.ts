import { offsetToHex, type BoardSize } from '../grid/hex.ts'
import { boardHexCenter, boardPixelSize, type BoardLayout } from './boardGeometry.ts'

/** The most pixels a side of one blight render texture may span: the 140 × 72 map is about 7,800 × 3,500, past what many GPUs allow in one texture. */
export const BLIGHT_TILE_PX = 2048

/** One render texture of the blight layer: its rectangle in map pixels, and the hexes (by `boardIndex`) whose marks reach it. */
export interface BlightTile {
  x: number
  y: number
  width: number
  height: number
  hexes: number[]
  /** The hexes whose level can change what the tile shows: `hexes` and their neighbours (a front line is drawn from either side of an edge). */
  watch: number[]
}

/**
 * The tiles covering a board's pixel area, row by row, each at most
 * `BLIGHT_TILE_PX` a side. A hex is listed in every tile its marks can reach
 * (its corners and the front line's 2 px stroke), so one on a seam is drawn
 * whole into each tile beside it and the seam shows nothing.
 */
export function blightTiles(board: BoardSize, layout: BoardLayout, tilePx: number = BLIGHT_TILE_PX): BlightTile[] {
  const map = boardPixelSize(board, layout)
  const width = Math.ceil(map.width)
  const height = Math.ceil(map.height)
  const tiles: BlightTile[] = []
  for (let y = 0; y < height; y += tilePx) {
    for (let x = 0; x < width; x += tilePx) {
      tiles.push({ x, y, width: Math.min(tilePx, width - x), height: Math.min(tilePx, height - y), hexes: [], watch: [] })
    }
  }
  const across = Math.ceil(width / tilePx)
  const place = (c: { x: number; y: number }, reachX: number, reachY: number, into: (tile: BlightTile) => number[], i: number): void => {
    const fromX = Math.max(0, Math.floor((c.x - reachX) / tilePx))
    const fromY = Math.max(0, Math.floor((c.y - reachY) / tilePx))
    const toX = Math.floor((c.x + reachX) / tilePx)
    const toY = Math.floor((c.y + reachY) / tilePx)
    for (let ty = fromY; ty <= toY; ty++) {
      for (let tx = fromX; tx <= toX; tx++) {
        const tile = tiles[ty * across + tx]
        if (tile) into(tile).push(i)
      }
    }
  }
  const reachX = (Math.sqrt(3) / 2) * layout.hexSize + 2
  const reachY = layout.hexSize * layout.squashY + 2
  // A neighbour's centre is at most two hexes' height or one and a half hexes' width from a hex's.
  const watchX = reachX + Math.sqrt(3) * layout.hexSize
  const watchY = reachY + 1.5 * layout.hexSize * layout.squashY
  for (let i = 0; i < board.cols * board.rows; i++) {
    const c = boardHexCenter(offsetToHex(i % board.cols, Math.floor(i / board.cols)), layout)
    place(c, reachX, reachY, (t) => t.hexes, i)
    place(c, watchX, watchY, (t) => t.watch, i)
  }
  return tiles
}
