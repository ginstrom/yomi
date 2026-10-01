import type { RNG } from './combat.ts'

/** Small, fast, seedable PRNG so battles can be reproduced from their seed. */
export function mulberry32(seed: number): RNG {
  let state = seed
  return () => {
    state |= 0
    state = (state + 0x6d2b79f5) | 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** A fresh 32-bit seed for when the caller doesn't care which. */
export function randomSeed(): number {
  return Math.floor(Math.random() * 2 ** 32)
}
