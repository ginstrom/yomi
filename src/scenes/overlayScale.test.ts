import { describe, expect, it } from 'vitest'
import { overlayScale } from './overlayScale.ts'

describe('overlayScale', () => {
  it('shrinks fractionally below 1, down to 0 below the margin', () => {
    expect(overlayScale(840, 400, 720, 500)).toBeCloseTo((400 - 32) / 500)
    expect(overlayScale(400, 1000, 720, 500)).toBeCloseTo((400 - 32) / 720)
    expect(overlayScale(20, 20, 720, 500)).toBe(0)
  })

  it('is 1 where the frame fits at 1 to under 2', () => {
    expect(overlayScale(1280, 800, 720, 500)).toBe(1)
    expect(overlayScale(840, 560, 720, 500)).toBe(1)
    expect(overlayScale(1280, 532 + 499, 720, 500)).toBe(1) // fit 1.99
  })

  it('steps in whole numbers from 2', () => {
    expect(overlayScale(1472, 1032, 720, 500)).toBe(2) // fit exactly 2
    expect(overlayScale(1920, 1080, 720, 500)).toBe(2)
    expect(overlayScale(2560, 1440, 720, 500)).toBe(2)
    expect(overlayScale(3840, 2160, 720, 500)).toBe(4)
  })

  it('differs by frame height in one window', () => {
    expect(overlayScale(1920, 1080, 720, 580)).toBe(1)
    expect(overlayScale(1920, 1080, 720, 520)).toBe(2)
  })

  it('takes the free width right of the party column for the inventory', () => {
    expect(overlayScale(1920 - 80, 1080, 720, 500)).toBe(2)
    expect(overlayScale(1280 - 80, 800, 720, 500)).toBe(1)
  })

  it('never exceeds the fit', () => {
    for (const [w, h] of [[900, 700], [1500, 1100], [1920, 1080], [2560, 1440], [3000, 1200], [5000, 3000]]) {
      const fit = Math.min((w - 32) / 720, (h - 32) / 500)
      expect(overlayScale(w, h, 720, 500)).toBeLessThanOrEqual(fit)
    }
  })
})
