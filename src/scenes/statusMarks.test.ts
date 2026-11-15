import { describe, expect, it } from 'vitest'
import { STATUS_MARK_PITCH_PX, statusMarkLayout } from './statusMarks.ts'

describe('statusMarkLayout', () => {
  it('centres the letters over the name, a pitch apart on screen', () => {
    expect(statusMarkLayout(1, 1)).toEqual({ scale: 1, xs: [0] })
    expect(statusMarkLayout(3, 1).xs).toEqual([-STATUS_MARK_PITCH_PX, 0, STATUS_MARK_PITCH_PX])
    expect(statusMarkLayout(0, 1).xs).toEqual([])
  })

  it('keeps the letters their own size on screen however far the board is scaled down', () => {
    for (const boardScale of [0.5, 0.72, 1]) {
      const { scale, xs } = statusMarkLayout(2, boardScale)
      expect(scale * boardScale).toBeCloseTo(1)
      expect((xs[1] - xs[0]) * boardScale).toBeCloseTo(STATUS_MARK_PITCH_PX)
    }
  })

  it('lets the letters grow with a board scaled up, as the plate does', () => {
    for (const boardScale of [1.34, 2]) {
      const { scale, xs } = statusMarkLayout(2, boardScale)
      expect(scale).toBe(1)
      expect(xs[1] - xs[0]).toBe(STATUS_MARK_PITCH_PX)
    }
  })

  it('falls back to the board’s own size before the board is laid out', () => {
    expect(statusMarkLayout(1, 0).scale).toBe(1)
  })
})
