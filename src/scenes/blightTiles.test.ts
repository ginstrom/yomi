import { describe, expect, it } from 'vitest'
import { WORLD_SIZE } from '../game/worldMap.ts'
import { offsetToHex } from '../grid/hex.ts'
import { BLIGHT_TILE_PX, blightTiles } from './blightTiles.ts'
import { WORLD_LAYOUT, boardHexCenter, boardPixelSize } from './boardGeometry.ts'

describe('blightTiles', () => {
  const map = boardPixelSize(WORLD_SIZE, WORLD_LAYOUT)
  const tiles = blightTiles(WORLD_SIZE, WORLD_LAYOUT)

  it('covers the map in tiles no larger than BLIGHT_TILE_PX a side, with no gap or overlap', () => {
    expect(BLIGHT_TILE_PX).toBe(2048)
    for (const t of tiles) {
      expect(t.width).toBeLessThanOrEqual(BLIGHT_TILE_PX)
      expect(t.height).toBeLessThanOrEqual(BLIGHT_TILE_PX)
    }
    const area = tiles.reduce((sum, t) => sum + t.width * t.height, 0)
    expect(area).toBe(Math.ceil(map.width) * Math.ceil(map.height))
    expect(Math.max(...tiles.map((t) => t.x + t.width))).toBe(Math.ceil(map.width))
    expect(Math.max(...tiles.map((t) => t.y + t.height))).toBe(Math.ceil(map.height))
    expect(tiles).toHaveLength(Math.ceil(map.width / BLIGHT_TILE_PX) * Math.ceil(map.height / BLIGHT_TILE_PX))
  })

  it('lists every hex in at least one tile, and a hex on a seam in each tile it overlaps', () => {
    const count = new Map<number, number>()
    for (const t of tiles) for (const i of t.hexes) count.set(i, (count.get(i) ?? 0) + 1)
    expect(count.size).toBe(WORLD_SIZE.cols * WORLD_SIZE.rows)
    // The hex of row 10 nearest the first vertical seam is in the tiles on both sides.
    const row = 10
    const cols = [...Array(WORLD_SIZE.cols).keys()]
    const col = cols.reduce((best, c) => (Math.abs(boardHexCenter(offsetToHex(c, row), WORLD_LAYOUT).x - BLIGHT_TILE_PX) < Math.abs(boardHexCenter(offsetToHex(best, row), WORLD_LAYOUT).x - BLIGHT_TILE_PX) ? c : best), 0)
    const i = row * WORLD_SIZE.cols + col
    const holding = tiles.filter((t) => t.hexes.includes(i) && t.y === 0)
    expect(holding.map((t) => t.x).sort((a, b) => a - b)).toEqual([0, BLIGHT_TILE_PX])
  })

  it('watches every hex and neighbour of a tile’s hexes', () => {
    for (const t of tiles) {
      const watched = new Set(t.watch)
      for (const i of t.hexes) expect(watched.has(i)).toBe(true)
    }
    const t = tiles[0]
    const edge = t.hexes.find((i) => boardHexCenter(offsetToHex(i % WORLD_SIZE.cols, Math.floor(i / WORLD_SIZE.cols)), WORLD_LAYOUT).x > BLIGHT_TILE_PX - 20)!
    const east = edge + 1
    expect(t.watch).toContain(east)
  })

  it('draws a small board as one tile', () => {
    expect(blightTiles({ cols: 10, rows: 10 }, WORLD_LAYOUT)).toHaveLength(1)
  })
})
