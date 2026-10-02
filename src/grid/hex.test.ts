import { describe, expect, it } from 'vitest'
import {
  HEX_DIRECTIONS,
  HexBoard,
  hex,
  hexAdd,
  hexCorners,
  hexDistance,
  hexEquals,
  hexKey,
  hexLine,
  hexNeighbors,
  hexToOffset,
  hexToPixel,
  offsetToHex,
  pixelToHex,
  reachableHexes,
  type Hex,
} from './hex.ts'

describe('hex geometry', () => {
  it('lists the six neighbours with opposite directions three apart', () => {
    expect(hexNeighbors(hex(0, 0))).toHaveLength(6)
    for (let i = 0; i < 3; i++) {
      expect(hexAdd(HEX_DIRECTIONS[i], HEX_DIRECTIONS[i + 3])).toEqual(hex(0, 0))
    }
  })

  it('puts every neighbour at distance 1', () => {
    const origin = hex(2, -1)
    for (const n of hexNeighbors(origin)) expect(hexDistance(origin, n)).toBe(1)
  })

  it('measures distance in steps', () => {
    expect(hexDistance(hex(0, 0), hex(0, 0))).toBe(0)
    expect(hexDistance(hex(0, 0), hex(3, 0))).toBe(3)
    expect(hexDistance(hex(0, 0), hex(2, -3))).toBe(3)
    expect(hexDistance(hex(-1, 2), hex(2, -1))).toBe(3)
  })

  it('draws a contiguous line between two hexes', () => {
    const line = hexLine(hex(0, 0), hex(3, -2))
    expect(line[0]).toEqual(hex(0, 0))
    expect(line.at(-1)).toEqual(hex(3, -2))
    expect(line).toHaveLength(hexDistance(hex(0, 0), hex(3, -2)) + 1)
    for (let i = 1; i < line.length; i++) expect(hexDistance(line[i - 1], line[i])).toBe(1)
    expect(hexLine(hex(1, 1), hex(1, 1))).toEqual([hex(1, 1)])
  })

  it('keys and compares hexes by value', () => {
    expect(hexKey(hex(-2, 5))).toBe('-2,5')
    expect(hexEquals(hex(1, 2), hex(1, 2))).toBe(true)
    expect(hexEquals(hex(1, 2), hex(2, 1))).toBe(false)
  })
})

describe('offset coordinates and boards', () => {
  it('round-trips odd-r offset coordinates', () => {
    for (let row = 0; row < 5; row++) {
      for (let col = 0; col < 8; col++) expect(hexToOffset(offsetToHex(col, row))).toEqual({ col, row })
    }
  })

  it('builds a rectangular board and knows its edges', () => {
    const board = new HexBoard({ cols: 8, rows: 5 })
    expect(board.hexes).toHaveLength(40)
    expect(board.contains(offsetToHex(0, 0))).toBe(true)
    expect(board.contains(offsetToHex(7, 4))).toBe(true)
    expect(board.contains(offsetToHex(8, 0))).toBe(false)
    expect(board.contains(offsetToHex(0, 5))).toBe(false)
    expect(board.contains(hex(-1, 0))).toBe(false)
  })
})

describe('reachableHexes', () => {
  it('finds everything within range on open ground, with shortest paths', () => {
    const reach = reachableHexes(hex(0, 0), 2, () => true)
    expect(reach.size).toBe(18) // 6 at distance 1 + 12 at distance 2
    expect(reach.has(hexKey(hex(0, 0)))).toBe(false)
    const path = reach.get(hexKey(hex(2, 0)))!
    expect(path).toHaveLength(2)
    expect(path.at(-1)).toEqual(hex(2, 0))
  })

  it('routes around blocked hexes and stops at the step limit', () => {
    const wall = new Set([hexKey(hex(1, 0)), hexKey(hex(1, -1))])
    const reach = reachableHexes(hex(0, 0), 3, (h) => !wall.has(hexKey(h)))
    expect(reach.has(hexKey(hex(1, 0)))).toBe(false)
    // Straight east is 2 steps; around the wall it takes 3.
    expect(reach.get(hexKey(hex(2, 0)))).toHaveLength(3)
    expect(reachableHexes(hex(0, 0), 3, (h) => !wall.has(hexKey(h)) && h.q < 2).has(hexKey(hex(2, 0)))).toBe(false)
  })

  it('breaks ties between shortest paths by the lowest step penalty, never taking a longer path', () => {
    // hex(1,1) is two steps away, through either (1,0) or (0,1).
    expect(reachableHexes(hex(0, 0), 2, () => true).get(hexKey(hex(1, 1)))).toEqual([hex(1, 0), hex(1, 1)])
    const leavingCostly = (from: Hex) => (hexEquals(from, hex(1, 0)) ? 5 : 0)
    const reach = reachableHexes(hex(0, 0), 2, () => true, leavingCostly)
    expect(reach.get(hexKey(hex(1, 1)))).toEqual([hex(0, 1), hex(1, 1)])
    expect(reach.get(hexKey(hex(2, 0)))).toEqual([hex(1, 0), hex(2, 0)]) // the only shortest path
  })
})

describe('pixel conversion', () => {
  it('maps hex centres to pixels and back', () => {
    for (const h of new HexBoard({ cols: 8, rows: 5 }).hexes) {
      const { x, y } = hexToPixel(h, 30)
      expect(pixelToHex(x, y, 30)).toEqual(h)
      // A point well inside the hex still maps to it.
      expect(pixelToHex(x + 10, y - 8, 30)).toEqual(h)
    }
  })

  it('places pointy-top corners at the hex radius, with a vertex straight up', () => {
    const corners = hexCorners(10)
    expect(corners).toHaveLength(6)
    for (const c of corners) expect(Math.hypot(c.x, c.y)).toBeCloseTo(10)
    expect(corners.some((c) => Math.abs(c.x) < 1e-9 && c.y < 0)).toBe(true)
  })
})
