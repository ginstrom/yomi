import { describe, expect, it } from 'vitest'
import { mapOrigin, rectContains } from './mapScroll.ts'

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
