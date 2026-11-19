import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

// The root CLAUDE.md is loaded into every session, so it is kept to a map.
// When this fails, move detail into a directory's CLAUDE.md; do not raise the limit.
const ROOT_LIMIT_BYTES = 16_000

describe('CLAUDE.md', () => {
  it('stays a map, under its size limit', () => {
    const size = readFileSync(new URL('../CLAUDE.md', import.meta.url)).byteLength
    expect(size).toBeLessThan(ROOT_LIMIT_BYTES)
  })
})
