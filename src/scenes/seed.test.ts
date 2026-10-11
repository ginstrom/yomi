import { describe, expect, it } from 'vitest'
import { seedFromUrl } from './seed.ts'

describe('seedFromUrl', () => {
  it('reads a whole number from the query', () => {
    expect(seedFromUrl('?seed=42')).toBe(42)
    expect(seedFromUrl('?debug=1&seed=7')).toBe(7)
    expect(seedFromUrl('?seed=0')).toBe(0)
  })

  it('is null when there is no seed, or it is not a whole number', () => {
    expect(seedFromUrl('')).toBeNull()
    expect(seedFromUrl('?seed=')).toBeNull()
    expect(seedFromUrl('?seed=abc')).toBeNull()
    expect(seedFromUrl('?seed=-3')).toBeNull()
    expect(seedFromUrl('?seed=1.5')).toBeNull()
  })

  it('keeps a large seed within 32 bits', () => {
    expect(seedFromUrl('?seed=4294967297')).toBe(1)
  })
})
