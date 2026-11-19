import { readdirSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

// The CLAUDE.md files are loaded into Claude's context: the root one in every
// session, a directory's whenever work touches that directory. They are kept to
// working guides; the full detail lives in docs/reference/. When this fails,
// move detail there; do not raise the limits.
const ROOT_LIMIT_BYTES = 16_000
const DIRECTORY_LIMIT_BYTES = 12_000

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const SKIP = new Set(['node_modules', '.git', 'dist', 'logs', '.vitest'])

function claudeFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    if (entry.isDirectory()) return SKIP.has(entry.name) || entry.name.startsWith('.') ? [] : claudeFiles(join(dir, entry.name))
    return entry.name === 'CLAUDE.md' ? [join(dir, entry.name)] : []
  })
}

describe('CLAUDE.md files', () => {
  it('keeps the root file a map, under its size limit', () => {
    expect(readFileSync(join(ROOT, 'CLAUDE.md')).byteLength).toBeLessThan(ROOT_LIMIT_BYTES)
  })

  it('keeps each directory file a working guide, under its size limit', () => {
    const tooLarge = claudeFiles(ROOT)
      .filter(file => relative(ROOT, file) !== 'CLAUDE.md')
      .map(file => ({ file: relative(ROOT, file), bytes: readFileSync(file).byteLength }))
      .filter(({ bytes }) => bytes >= DIRECTORY_LIMIT_BYTES)
    expect(tooLarge).toEqual([])
  })
})
