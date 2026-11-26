import { describe, expect, it } from 'vitest'
import {
  HEX_DIRECTIONS,
  areaOf,
  HexBoard,
  hex,
  hexAdd,
  hexCorners,
  hexDirection,
  hexDistance,
  hexEquals,
  hexKey,
  hexDirectionTowards,
  hexLine,
  hexNeighbors,
  hexToOffset,
  hexToPixel,
  offsetToHex,
  pixelToHex,
  reachableHexes,
  shortestPath,
  type Hex,
} from './hex.ts'
import { mulberry32 } from '../combat/rng.ts'

describe('hex geometry', () => {
  it('lists the six neighbours with opposite directions three apart', () => {
    expect(hexNeighbors(hex(0, 0))).toHaveLength(6)
    for (let i = 0; i < 3; i++) {
      expect(hexAdd(HEX_DIRECTIONS[i], HEX_DIRECTIONS[i + 3])).toEqual(hex(0, 0))
    }
  })

  it('names the direction from a hex to each neighbour, and nothing further', () => {
    const origin = hex(2, -1)
    hexNeighbors(origin).forEach((n, i) => expect(hexDirection(origin, n)).toBe(i))
    expect(hexDirection(origin, origin)).toBeNull()
    expect(hexDirection(origin, hex(4, -1))).toBeNull()
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

  it('finds the direction towards a hex at any distance', () => {
    const from = hex(2, 2)
    HEX_DIRECTIONS.forEach((d, i) => {
      expect(hexDirectionTowards(from, hexAdd(from, d))).toBe(i)
      expect(hexDirectionTowards(from, hex(from.q + 3 * d.q, from.r + 3 * d.r))).toBe(i)
    })
    // Mostly east, a little north.
    expect(hexDirectionTowards(from, hex(6, 1))).toBe(0)
    expect(hexDirectionTowards(from, from)).toBeNull()
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

describe('shortestPath', () => {
  it("gives the path reachableHexes gives, on boards with random walls", () => {
    const board = new HexBoard({ cols: 18, rows: 12 })
    for (let seed = 1; seed <= 300; seed++) {
      const rng = mulberry32(seed)
      const wall = new Set(board.hexes.filter(() => rng() < 0.3).map(hexKey))
      const start = board.hexes[Math.floor(rng() * board.hexes.length)]
      const goal = board.hexes[Math.floor(rng() * board.hexes.length)]
      const passable = (h: Hex) => board.contains(h) && (hexEquals(h, goal) || !wall.has(hexKey(h)))
      const expected = reachableHexes(start, board.hexes.length, passable).get(hexKey(goal)) ?? null
      expect(shortestPath(start, goal, passable)).toEqual(expected)
    }
  })

  it('is null at the start itself and for a goal walled off', () => {
    expect(shortestPath(hex(0, 0), hex(0, 0), () => true)).toBeNull()
    const board = new HexBoard({ cols: 5, rows: 5 })
    expect(shortestPath(offsetToHex(0, 0), offsetToHex(4, 4), (h) => board.contains(h) && hexToOffset(h).col !== 2)).toBeNull()
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

  it('breaks ties between shortest paths by the fewest provokers, never taking a longer path', () => {
    // hex(1,1) is two steps away, through either (1,0) or (0,1).
    expect(reachableHexes(hex(0, 0), 2, () => true).get(hexKey(hex(1, 1)))).toEqual([hex(1, 0), hex(1, 1)])
    const leavingCostly = (from: Hex) => (hexEquals(from, hex(1, 0)) ? ['a'] : [])
    const reach = reachableHexes(hex(0, 0), 2, () => true, leavingCostly)
    expect(reach.get(hexKey(hex(1, 1)))).toEqual([hex(0, 1), hex(1, 1)])
    expect(reach.get(hexKey(hex(2, 0)))).toEqual([hex(1, 0), hex(2, 0)]) // the only shortest path
  })

  it('asks about each step, so leaving a hex one way may provoke and another way not', () => {
    // From (0,0), only the step east provokes; (1,1) is still two steps away either way.
    const eastward = (from: Hex, to: Hex) => (hexEquals(from, hex(0, 0)) && hexEquals(to, hex(1, 0)) ? ['a'] : [])
    const reach = reachableHexes(hex(0, 0), 2, () => true, eastward)
    expect(reach.get(hexKey(hex(1, 1)))).toEqual([hex(0, 1), hex(1, 1)])
  })

  it('prefers one provoker met three times over two provokers met once each', () => {
    // To (1,3): east first, then along a's edge; or south along b and c, then east.
    const foes = new Map([
      [hexKey(hex(1, 0)), ['a']],
      [hexKey(hex(1, 1)), ['a']],
      [hexKey(hex(1, 2)), ['a']],
      [hexKey(hex(0, 1)), ['b']],
      [hexKey(hex(0, 2)), ['c']],
    ])
    const reach = reachableHexes(hex(0, 0), 4, () => true, (from) => foes.get(hexKey(from)) ?? [])
    expect(reach.get(hexKey(hex(1, 3)))).toEqual([hex(1, 0), hex(1, 1), hex(1, 2), hex(1, 3)])
  })

  it('keeps routes whose provokers cannot be compared until a later step decides', () => {
    // (1,1) is reached first having provoked y, or second having provoked x; leaving it provokes x.
    const foes = new Map([
      [hexKey(hex(1, 0)), ['y']],
      [hexKey(hex(0, 1)), ['x']],
      [hexKey(hex(1, 1)), ['x']],
    ])
    const open = (h: Hex) => !hexEquals(h, hex(0, 2))
    const reach = reachableHexes(hex(0, 0), 3, open, (from) => foes.get(hexKey(from)) ?? [])
    expect(reach.get(hexKey(hex(1, 2)))).toEqual([hex(0, 1), hex(1, 1), hex(1, 2)])
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

describe('areaOf', () => {
  const o = hex(0, 0)
  const hs = (...pairs: [number, number][]): Hex[] => pairs.map(([q, r]) => hex(q, r))
  const coneCases: [number, Hex[]][] = [
    [0, hs([1, 0], [1, 1], [2, -1], [2, 0])],
    [1, hs([1, -1], [1, -2], [2, -2], [2, -1])],
    [2, hs([0, -1], [-1, -1], [0, -2], [1, -2])],
    [3, hs([-1, 0], [-2, 0], [-2, 1], [-1, -1])],
    [4, hs([-1, 1], [-2, 1], [-2, 2], [-1, 2])],
    [5, hs([0, 1], [-1, 2], [0, 2], [1, 1])],
  ]

  it.each(coneCases)('a cone of range 2 aimed at direction %i', (i, expected) => {
    expect(areaOf('cone', o, HEX_DIRECTIONS[i], 2)).toEqual(expected)
  })

  const lineCases: [number, Hex[]][] = [
    [0, hs([1, 0], [2, 0], [3, 0])],
    [1, hs([1, -1], [2, -2], [3, -3])],
    [2, hs([0, -1], [0, -2], [0, -3])],
    [3, hs([-1, 0], [-2, 0], [-3, 0])],
    [4, hs([-1, 1], [-2, 2], [-3, 3])],
    [5, hs([0, 1], [0, 2], [0, 3])],
  ]

  it.each(lineCases)('a line of range 3 aimed at direction %i', (i, expected) => {
    expect(areaOf('line', o, HEX_DIRECTIONS[i], 3)).toEqual(expected)
  })

  it('cuts a line aimed beyond its range to the range', () => {
    expect(areaOf('line', o, hex(5, 0), 3)).toEqual(hs([1, 0], [2, 0], [3, 0]))
  })

  it('runs a line past an aim short of its range', () => {
    expect(areaOf('line', o, hex(1, 0), 3)).toEqual(hs([1, 0], [2, 0], [3, 0]))
  })

  it('draws an off-axis line through the aim', () => {
    expect(areaOf('line', o, hex(2, -1), 6)).toEqual(hs([1, 0], [2, -1], [3, -1], [4, -2], [5, -2], [6, -3]))
  })

  it('measures a line from an origin that is not (0, 0)', () => {
    expect(areaOf('line', hex(3, 2), hex(3, 3), 2)).toEqual(hs([3, 3], [3, 4]))
  })

  it('takes a cone aimed between two directions from both', () => {
    expect(areaOf('cone', o, hex(2, -1), 2)).toEqual(hs([1, -1], [1, 0], [2, -2], [2, -1], [2, 0]))
  })

  it('widens a cone with its range', () => {
    expect(areaOf('cone', o, hex(1, 0), 3)).toEqual(hs([1, 0], [1, 1], [2, -1], [2, 0], [2, 1], [3, -1], [3, 0]))
  })

  it('is empty for a cone or line aimed at the origin', () => {
    expect(areaOf('cone', o, o, 3)).toEqual([])
    expect(areaOf('line', o, o, 3)).toEqual([])
  })

  it('keeps a burst as the hexes within the radius of the aim, whatever the origin', () => {
    for (const [radius, count] of [[0, 1], [1, 7], [2, 19]] as const) {
      const aim = hex(3, -2)
      const area = areaOf('burst', hex(-4, 5), aim, 6, radius)
      expect(area).toHaveLength(count)
      expect(area.every((h) => hexDistance(h, aim) <= radius)).toBe(true)
    }
    expect(areaOf('burst', o, hex(1, 1), 4, 1)[0]).toEqual(hex(0, 1))
  })

  it('bursts at the hex two steps out in each direction', () => {
    for (const d of HEX_DIRECTIONS) {
      const aim = hexAdd(d, d)
      const area = areaOf('burst', o, aim, 2, 1)
      expect(area).toHaveLength(7)
      expect(area).toContainEqual(aim)
      for (const n of hexNeighbors(aim)) expect(area).toContainEqual(n)
    }
  })

  it('drops off-board hexes of a cone or line cut by a small board', () => {
    const board = new HexBoard({ cols: 5, rows: 5 })
    const corner = offsetToHex(0, 0)
    const cone = areaOf('cone', corner, hexAdd(corner, HEX_DIRECTIONS[3]), 2).filter((h) => board.contains(h))
    expect(cone).toEqual([])
    const line = areaOf('line', corner, hexAdd(corner, HEX_DIRECTIONS[0]), 6).filter((h) => board.contains(h))
    expect(line).toEqual([hex(1, 0), hex(2, 0), hex(3, 0), hex(4, 0)])
    expect(line[0]).toEqual(hex(1, 0))
  })
})

/**
 * `reachableHexes` as it stood before long-campaign stage 10 step 07 made it
 * faster (2cdd885), copied unchanged: the reference the faster one must match
 * hex for hex, path for path and in the map's order, ties included.
 */
function reachableHexesBefore(
  start: Hex,
  maxSteps: number,
  passable: (h: Hex) => boolean,
  provokers: (from: Hex, to: Hex) => readonly string[] = () => [],
): Map<string, Hex[]> {
  type Entry = { hex: Hex; path: Hex[]; provoked: ReadonlySet<string> }
  const isSubset = (a: ReadonlySet<string>, b: ReadonlySet<string>) => [...a].every((id) => b.has(id))
  const paths = new Map<string, Hex[]>()
  const seen = new Set([hexKey(start)])
  let frontier: Entry[] = [{ hex: start, path: [], provoked: new Set() }]
  for (let step = 0; step < maxSteps && frontier.length > 0; step++) {
    const next = new Map<string, Entry[]>()
    for (const { hex: from, path, provoked } of frontier) {
      for (const n of hexNeighbors(from)) {
        const key = hexKey(n)
        if (seen.has(key) || !passable(n)) continue
        const leaving = new Set([...provoked, ...provokers(from, n)])
        const kept = next.get(key) ?? []
        if (kept.some((e) => isSubset(e.provoked, leaving))) continue
        const better = kept.filter((e) => !isSubset(leaving, e.provoked))
        next.set(key, [...better, { hex: n, path: [...path, n], provoked: leaving }])
      }
    }
    for (const [key, kept] of next) {
      seen.add(key)
      const best = kept.reduce((a, b) => (b.provoked.size < a.provoked.size ? b : a))
      paths.set(key, best.path)
    }
    frontier = [...next.values()].flat()
  }
  return paths
}

describe('reachableHexes against its version before stage 10 step 07', () => {
  const board = new HexBoard({ cols: 14, rows: 10 })

  /** Random walls and foes on the board, seeded; a start on an open hex. */
  function field(seed: number) {
    const rng = mulberry32(seed)
    const wall = new Set(board.hexes.filter(() => rng() < 0.15).map(hexKey))
    const open = board.hexes.filter((h) => !wall.has(hexKey(h)))
    const start = open[Math.floor(rng() * open.length)]
    const foes = Array.from({ length: 1 + Math.floor(rng() * 6) }, (_, i) => ({ id: `f${i}`, at: open[Math.floor(rng() * open.length)] }))
    const passable = (h: Hex) => board.contains(h) && !wall.has(hexKey(h)) && !foes.some((f) => hexEquals(f.at, h))
    return { rng, start, foes, passable }
  }

  it('gives the same paths in the same order with zones of control (foes provoked on leaving their side)', () => {
    for (let seed = 1; seed <= 400; seed++) {
      const { start, foes, passable } = field(seed)
      const zones = (from: Hex, to: Hex) => foes.filter((f) => hexDistance(f.at, from) === 1 && hexDistance(f.at, to) > 1).map((f) => f.id)
      for (const steps of [3, 6, 10]) {
        expect([...reachableHexes(start, steps, passable, zones)]).toEqual([...reachableHexesBefore(start, steps, passable, zones)])
      }
    }
  })

  it('gives the same paths in the same order where routes tie: overlapping, repeated and unordered ids on many steps', () => {
    let ties = 0
    for (let seed = 1; seed <= 400; seed++) {
      const { rng, start, passable } = field(seed)
      // Each step provokes a fixed, seeded handful of a few ids (some twice, in any order), so many
      // routes reach a hex with sets of the same size that are not subsets of each other.
      const ids = ['a', 'b', 'c', 'd']
      const salt = Math.floor(rng() * 1e9)
      const provokers = (from: Hex, to: Hex) => {
        const pick = mulberry32((hexIndexOf(from) * 31 + hexIndexOf(to) * 7 + salt) >>> 0)
        return ids.filter(() => pick() < 0.3).concat(pick() < 0.2 ? ['a'] : [])
      }
      for (const steps of [4, 8]) {
        const expected = reachableHexesBefore(start, steps, passable, provokers)
        expect([...reachableHexes(start, steps, passable, provokers)]).toEqual([...expected])
        ties += countTies(start, steps, passable, provokers)
      }
    }
    // The ties are there to be broken: hexes reached by two or more kept routes of the fewest provoked.
    expect(ties).toBeGreaterThan(1000)
  })

  it('gives the same as before with no provokers (the world map and the default)', () => {
    for (let seed = 1; seed <= 100; seed++) {
      const { start, passable } = field(seed)
      expect([...reachableHexes(start, 12, passable)]).toEqual([...reachableHexesBefore(start, 12, passable)])
    }
  })
})

function hexIndexOf(h: Hex): number {
  return (h.q + 100) * 1000 + (h.r + 100)
}

/** Hexes where, in the version before, two or more kept routes share the fewest provoked ids (a tie the reduce breaks). */
function countTies(start: Hex, maxSteps: number, passable: (h: Hex) => boolean, provokers: (from: Hex, to: Hex) => readonly string[]): number {
  type Entry = { hex: Hex; provoked: ReadonlySet<string> }
  const isSubset = (a: ReadonlySet<string>, b: ReadonlySet<string>) => [...a].every((id) => b.has(id))
  const seen = new Set([hexKey(start)])
  let frontier: Entry[] = [{ hex: start, provoked: new Set() }]
  let ties = 0
  for (let step = 0; step < maxSteps && frontier.length > 0; step++) {
    const next = new Map<string, Entry[]>()
    for (const { hex: from, provoked } of frontier) {
      for (const n of hexNeighbors(from)) {
        const key = hexKey(n)
        if (seen.has(key) || !passable(n)) continue
        const leaving = new Set([...provoked, ...provokers(from, n)])
        const kept = next.get(key) ?? []
        if (kept.some((e) => isSubset(e.provoked, leaving))) continue
        next.set(key, [...kept.filter((e) => !isSubset(leaving, e.provoked)), { hex: n, provoked: leaving }])
      }
    }
    for (const [key, kept] of next) {
      seen.add(key)
      const fewest = Math.min(...kept.map((e) => e.provoked.size))
      if (kept.filter((e) => e.provoked.size === fewest).length > 1) ties++
    }
    frontier = [...next.values()].flat()
  }
  return ties
}
