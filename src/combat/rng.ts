import type { RNG } from './combat.ts'

/** An RNG that can tell where its stream stands, so that a saved battle rolls on as the unsaved one would. */
export type SeededRng = RNG & {
  /** The generator's whole state: `mulberry32(rng.state())` carries on the same stream. */
  state(): number
}

/** Small, fast, seedable PRNG so battles can be reproduced from their seed. */
export function mulberry32(seed: number): SeededRng {
  let state = seed | 0
  const next = () => {
    state = (state + 0x6d2b79f5) | 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  return Object.assign(next, { state: () => state })
}

/** A fresh 32-bit seed for when the caller doesn't care which. */
export function randomSeed(): number {
  return Math.floor(Math.random() * 2 ** 32)
}
