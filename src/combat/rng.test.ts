import { describe, expect, it } from 'vitest'
import { mulberry32, randomSeed } from './rng.ts'

describe('mulberry32', () => {
  it('is deterministic for a given seed and stays within [0, 1)', () => {
    const a = mulberry32(7)
    const b = mulberry32(7)
    for (let i = 0; i < 1000; i++) {
      const value = a()
      expect(value).toBe(b())
      expect(value).toBeGreaterThanOrEqual(0)
      expect(value).toBeLessThan(1)
    }
  })

  it('produces different streams for different seeds', () => {
    expect(mulberry32(1)()).not.toBe(mulberry32(2)())
  })
})

describe('randomSeed', () => {
  it('returns an unsigned 32-bit integer', () => {
    const seed = randomSeed()
    expect(Number.isInteger(seed)).toBe(true)
    expect(seed).toBeGreaterThanOrEqual(0)
    expect(seed).toBeLessThan(2 ** 32)
  })
})
