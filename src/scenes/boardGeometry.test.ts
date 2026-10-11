import { describe, expect, it } from 'vitest'
import { HexBoard, hex } from '../grid/hex.ts'
import {
  WORLD_LAYOUT,
  boardHexAt,
  boardHexCenter,
  boardHexOnScreen,
  boardPixelSize,
  curvedArrow,
} from './boardGeometry.ts'

// The goblinRaid board.
const SIZE = { cols: 8, rows: 5 }
const ORIGIN = { x: 37, y: 112 }

describe('board geometry', () => {
  it.each([1, 0.6])('finds every hex at its own centre, drawn at scale %s', (scale) => {
    const board = new HexBoard(SIZE)
    for (const h of board.hexes) {
      expect(boardHexAt(boardHexOnScreen(h, ORIGIN, scale), ORIGIN, scale)).toEqual(h)
    }
  })

  it('finds every hex of the unsquashed world map at its own centre, and fits the map in the smallest window', () => {
    const size = { cols: 12, rows: 7 }
    for (const h of new HexBoard(size).hexes) {
      expect(boardHexAt(boardHexOnScreen(h, ORIGIN, 0.5, WORLD_LAYOUT), ORIGIN, 0.5, WORLD_LAYOUT)).toEqual(h)
    }
    const { width, height } = boardPixelSize(size, WORLD_LAYOUT)
    expect(width).toBeLessThan(760)
    expect(height).toBe(32 * 11)
  })

  it.each([1, 0.6])('answers an off-board hex for points beside the board, drawn at scale %s', (scale) => {
    const board = new HexBoard(SIZE)
    const { width, height } = boardPixelSize(SIZE)
    const middleY = ORIGIN.y + (height / 2) * scale
    const middleX = ORIGIN.x + (width / 2) * scale
    const offBoard = [
      { x: ORIGIN.x - 10 * scale, y: middleY },
      { x: ORIGIN.x + (width + 10) * scale, y: middleY },
      { x: middleX, y: ORIGIN.y - 10 * scale },
      { x: middleX, y: ORIGIN.y + (height + 10) * scale },
    ]
    for (const p of offBoard) expect(board.contains(boardHexAt(p, ORIGIN, scale))).toBe(false)
  })

  it('puts hex(0, 0) half a hex in from the top-left corner', () => {
    const c = boardHexCenter(hex(0, 0))
    expect(c.x).toBeCloseTo((Math.sqrt(3) / 2) * 40)
    expect(c.y).toBeCloseTo(40 * 0.6)
  })

  it('sizes the board to its hexes after the squash', () => {
    const { width, height } = boardPixelSize(SIZE)
    expect(width).toBeCloseTo(Math.sqrt(3) * 40 * 8.5)
    expect(height).toBeCloseTo(40 * 8 * 0.6)
  })
})

describe('curvedArrow', () => {
  it('starts at the start, ends in a head whose tip is the end, and bows upwards', () => {
    const { shaft, head } = curvedArrow({ x: 0, y: 100 }, { x: 200, y: 100 })
    expect(shaft[0]).toEqual({ x: 0, y: 100 })
    expect(head[0]).toEqual({ x: 200, y: 100 })
    expect(Math.min(...shaft.map((p) => p.y))).toBeLessThan(100)
  })

  it('stops the shaft at the base of the head', () => {
    const { shaft, head } = curvedArrow({ x: 0, y: 0 }, { x: 0, y: 120 }, 12)
    const last = shaft[shaft.length - 1]
    const baseMid = { x: (head[1].x + head[2].x) / 2, y: (head[1].y + head[2].y) / 2 }
    expect(last.x).toBeCloseTo(baseMid.x)
    expect(last.y).toBeCloseTo(baseMid.y)
    expect(Math.hypot(last.x - head[0].x, last.y - head[0].y)).toBeCloseTo(12)
  })
})
