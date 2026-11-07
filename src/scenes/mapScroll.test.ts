import { describe, expect, it } from 'vitest'
import { clampOrigin, DRAG_THRESHOLD_PX, mapOrigin, pannedOrigin, pressMoved, rectContains } from './mapScroll.ts'

const view = { x: 0, y: 60, width: 800, height: 400 }
const map = { width: 3000, height: 2000 }

describe('mapOrigin', () => {
  it('puts the focus in the middle of the view', () => {
    expect(mapOrigin({ x: 1500, y: 1000 }, map, view)).toEqual({ x: 400 - 1500, y: 260 - 1000 })
  })

  it('stops at the map edges rather than scroll past them', () => {
    expect(mapOrigin({ x: 10, y: 10 }, map, view)).toEqual({ x: 0, y: 60 })
    expect(mapOrigin({ x: 2990, y: 1990 }, map, view)).toEqual({ x: 800 - 3000, y: 460 - 2000 })
  })

  it('centres a map smaller than the view, whatever the focus', () => {
    expect(mapOrigin({ x: 0, y: 0 }, { width: 600, height: 300 }, view)).toEqual({ x: 100, y: 110 })
  })

  it('scrolls one axis while the other fits', () => {
    expect(mapOrigin({ x: 1500, y: 0 }, { width: 3000, height: 300 }, view)).toEqual({ x: -1100, y: 110 })
  })

  it('lands on whole pixels', () => {
    const origin = mapOrigin({ x: 1500.4, y: 1000.6 }, map, { ...view, width: 801 })
    expect(Number.isInteger(origin.x) && Number.isInteger(origin.y)).toBe(true)
  })
})

describe('rectContains', () => {
  it('takes in the top-left edge and leaves out the bottom-right', () => {
    expect(rectContains(view, { x: 0, y: 60 })).toBe(true)
    expect(rectContains(view, { x: 799, y: 459 })).toBe(true)
    expect(rectContains(view, { x: 800, y: 100 })).toBe(false)
    expect(rectContains(view, { x: 100, y: 59 })).toBe(false)
  })
})

describe('pressMoved', () => {
  const press = { x: 100, y: 100 }

  it('is a click within the threshold and a drag beyond it', () => {
    expect(DRAG_THRESHOLD_PX).toBe(6)
    expect(pressMoved(press, { x: 105, y: 100 })).toBe(false)
    expect(pressMoved(press, { x: 100, y: 93 })).toBe(true)
  })

  it('measures the straight-line distance, and only more than the threshold counts', () => {
    expect(pressMoved(press, { x: 104, y: 104 })).toBe(false) // about 5.7 px
    expect(pressMoved(press, { x: 105, y: 105 })).toBe(true) // about 7.1 px
    expect(pressMoved(press, { x: 106, y: 100 })).toBe(false)
  })

  it('takes another threshold when given one', () => {
    expect(pressMoved(press, { x: 103, y: 100 }, 2)).toBe(true)
  })
})

describe('pannedOrigin', () => {
  const originAtPress = { x: -1100, y: -740 }
  const press = { x: 400, y: 300 }

  it('moves the map with the pointer', () => {
    expect(pannedOrigin(originAtPress, press, { x: 440, y: 270 }, map, view)).toEqual({ x: -1060, y: -770 })
  })

  it('stops at each edge of the map', () => {
    expect(pannedOrigin(originAtPress, press, { x: 400 + 5000, y: 300 }, map, view).x).toBe(0)
    expect(pannedOrigin(originAtPress, press, { x: 400 - 5000, y: 300 }, map, view).x).toBe(800 - 3000)
    expect(pannedOrigin(originAtPress, press, { x: 400, y: 300 + 5000 }, map, view).y).toBe(60)
    expect(pannedOrigin(originAtPress, press, { x: 400, y: 300 - 5000 }, map, view).y).toBe(460 - 2000)
  })

  it('keeps a map smaller than the view centred along that axis', () => {
    const narrow = { width: 3000, height: 300 }
    expect(pannedOrigin({ x: -1100, y: 110 }, press, { x: 450, y: 380 }, narrow, view)).toEqual({ x: -1050, y: 110 })
  })

  it('lands on whole pixels', () => {
    const origin = pannedOrigin(originAtPress, press, { x: 410.4, y: 299.6 }, map, view)
    expect(Number.isInteger(origin.x) && Number.isInteger(origin.y)).toBe(true)
  })
})

describe('clampOrigin', () => {
  it('leaves an origin inside the bounds as it is', () => {
    expect(clampOrigin({ x: -1100, y: -740 }, map, view)).toEqual({ x: -1100, y: -740 })
  })

  it('pulls an origin past an edge back to it', () => {
    expect(clampOrigin({ x: 300, y: -9000 }, map, view)).toEqual({ x: 0, y: 460 - 2000 })
  })

  it('centres a map smaller than the view', () => {
    expect(clampOrigin({ x: 40, y: -500 }, { width: 600, height: 300 }, view)).toEqual({ x: 100, y: 110 })
  })

  it('gives what mapOrigin gives for a focus mid-view', () => {
    const focus = { x: 1234, y: 567 }
    const unclamped = { x: view.x + view.width / 2 - focus.x, y: view.y + view.height / 2 - focus.y }
    expect(clampOrigin(unclamped, map, view)).toEqual(mapOrigin(focus, map, view))
  })

  it('is dropped by recentring: mapOrigin of the party ignores where the view was panned', () => {
    const party = { x: 1500, y: 1000 }
    const panned = pannedOrigin(mapOrigin(party, map, view), { x: 400, y: 300 }, { x: 600, y: 100 }, map, view)
    expect(panned).not.toEqual(mapOrigin(party, map, view))
    expect(mapOrigin(party, map, view)).toEqual({ x: 400 - 1500, y: 260 - 1000 })
  })
})
