/**
 * Pointy-top hex grid in axial coordinates, after
 * https://www.redblobgames.com/grids/hexagons/. `r` grows downward and `q`
 * to the east, so the two sides of a battle face each other along a row.
 * Phaser-free: the engine reasons in hexes, and only the scene maps them to
 * pixels.
 */
export interface Hex {
  readonly q: number
  readonly r: number
}

export const hex = (q: number, r: number): Hex => ({ q, r })

/**
 * The six neighbour offsets, counter-clockwise from east. Opposite
 * directions are three apart, which facing and flanking rules can rely on.
 */
export const HEX_DIRECTIONS: readonly Hex[] = [
  hex(1, 0), // east
  hex(1, -1), // north-east
  hex(0, -1), // north-west
  hex(-1, 0), // west
  hex(-1, 1), // south-west
  hex(0, 1), // south-east
]

/** The index into HEX_DIRECTIONS of the step from `from` to a neighbouring `to`, or null if they aren't neighbours. */
export function hexDirection(from: Hex, to: Hex): number | null {
  const i = HEX_DIRECTIONS.findIndex((d) => d.q === to.q - from.q && d.r === to.r - from.r)
  return i === -1 ? null : i
}

/** A stable string form, for use as a Map/Set key. */
export const hexKey = (h: Hex): string => `${h.q},${h.r}`

export const hexEquals = (a: Hex, b: Hex): boolean => a.q === b.q && a.r === b.r

export const hexAdd = (a: Hex, b: Hex): Hex => hex(a.q + b.q, a.r + b.r)

export function hexNeighbors(h: Hex): Hex[] {
  return HEX_DIRECTIONS.map((d) => hexAdd(h, d))
}

/** Number of steps between two hexes. */
export function hexDistance(a: Hex, b: Hex): number {
  const dq = a.q - b.q
  const dr = a.r - b.r
  return (Math.abs(dq) + Math.abs(dr) + Math.abs(dq + dr)) / 2
}

/** Rounds fractional axial coordinates to the hex that contains them. */
export function hexRound(q: number, r: number): Hex {
  const s = -q - r
  let rq = Math.round(q)
  let rr = Math.round(r)
  const rs = Math.round(s)
  const dq = Math.abs(rq - q)
  const dr = Math.abs(rr - r)
  const ds = Math.abs(rs - s)
  // Reset whichever coordinate rounded furthest, so q + r + s stays 0.
  if (dq > dr && dq > ds) rq = -rr - rs
  else if (dr > ds) rr = -rq - rs
  // `+ 0` turns a rounded -0 into 0 so results compare and key cleanly.
  return hex(rq + 0, rr + 0)
}

/** Every hex on the straight line from a to b, inclusive — the basis for line of sight. */
export function hexLine(a: Hex, b: Hex): Hex[] {
  const steps = hexDistance(a, b)
  if (steps === 0) return [a]
  // A tiny nudge keeps points that land exactly on an edge from rounding inconsistently.
  const EPS = 1e-6
  const line: Hex[] = []
  for (let i = 0; i <= steps; i++) {
    const t = i / steps
    line.push(hexRound(a.q + EPS + (b.q - a.q) * t, a.r + EPS + (b.r - a.r) * t))
  }
  return line
}

/** Board size in offset columns and rows; plain data so it can sit in a battle log. */
export interface BoardSize {
  cols: number
  rows: number
}

/**
 * "Odd-r" offset coordinates: every odd row is pushed half a hex east, which
 * makes a rectangular board. Handy for laying out a board by column and row.
 */
export function offsetToHex(col: number, row: number): Hex {
  return hex(col - (row - (row & 1)) / 2, row)
}

export function hexToOffset(h: Hex): { col: number; row: number } {
  return { col: h.q + (h.r - (h.r & 1)) / 2, row: h.r }
}

/** A rectangular (odd-r) board of hexes. */
export class HexBoard {
  readonly size: BoardSize
  readonly hexes: readonly Hex[]

  constructor(size: BoardSize) {
    this.size = size
    const hexes: Hex[] = []
    for (let row = 0; row < size.rows; row++) {
      for (let col = 0; col < size.cols; col++) hexes.push(offsetToHex(col, row))
    }
    this.hexes = hexes
  }

  contains(h: Hex): boolean {
    const { col, row } = hexToOffset(h)
    return row >= 0 && row < this.size.rows && col >= 0 && col < this.size.cols
  }
}

/**
 * Hexes reachable from `start` in at most `maxSteps` steps through passable
 * hexes, each with a shortest path (start excluded, destination included).
 * Among equally short paths, the one with the lowest total `stepPenalty`
 * wins (e.g. fewest provoked free attacks); earlier-found paths win ties.
 * The start itself is not in the result.
 */
export function reachableHexes(
  start: Hex,
  maxSteps: number,
  passable: (h: Hex) => boolean,
  stepPenalty: (from: Hex, to: Hex) => number = () => 0,
): Map<string, Hex[]> {
  type Entry = { hex: Hex; path: Hex[]; penalty: number }
  const paths = new Map<string, Hex[]>()
  const seen = new Set([hexKey(start)])
  let frontier: Entry[] = [{ hex: start, path: [], penalty: 0 }]
  // Breadth-first, one ring of path length at a time, so every path is shortest
  // and the penalty only has to break ties within a ring.
  for (let step = 0; step < maxSteps && frontier.length > 0; step++) {
    const next = new Map<string, Entry>()
    for (const { hex: from, path, penalty } of frontier) {
      for (const n of hexNeighbors(from)) {
        const key = hexKey(n)
        if (seen.has(key) || !passable(n)) continue
        const total = penalty + stepPenalty(from, n)
        const best = next.get(key)
        if (!best || total < best.penalty) next.set(key, { hex: n, path: [...path, n], penalty: total })
      }
    }
    for (const [key, entry] of next) {
      seen.add(key)
      paths.set(key, entry.path)
    }
    frontier = [...next.values()]
  }
  return paths
}

const SQRT3 = Math.sqrt(3)

/** Centre of a hex in pixels, for hexes of the given corner radius, with hex(0, 0) at the origin. */
export function hexToPixel(h: Hex, size: number): { x: number; y: number } {
  return { x: size * SQRT3 * (h.q + h.r / 2), y: size * 1.5 * h.r }
}

/** The hex containing a pixel position; the inverse of hexToPixel. */
export function pixelToHex(x: number, y: number, size: number): Hex {
  return hexRound(((SQRT3 / 3) * x - y / 3) / size, ((2 / 3) * y) / size)
}

/** Corner offsets from a hex's centre, starting at the upper-right corner, for drawing. */
export function hexCorners(size: number): { x: number; y: number }[] {
  return Array.from({ length: 6 }, (_, i) => {
    const angle = (Math.PI / 180) * (60 * i - 30)
    return { x: size * Math.cos(angle), y: size * Math.sin(angle) }
  })
}
