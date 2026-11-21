import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterAll, describe, expect, it } from 'vitest'

// Feature records (docs/features/) and plan indexes are what the orchestrator
// re-reads on every resume. These caps keep them small: a record holds its
// State and the decisions in force; history belongs in the plan's log.md,
// which the orchestrator never reads on resume. When a cap fails, move history
// to the plan's log.md; do not raise the limit.
const STATE_LIMIT_BYTES = 3_000
const RECORD_LIMIT_BYTES = 8_000
const PLAN_INDEX_LIMIT_BYTES = 32_000
// Finished records and plans, written before the split. The lists only shrink.
const LEGACY_RECORDS = new Set([
  'audio-pass',
  'auto-resolve',
  'battle-cost',
  'long-campaign-stage-02',
  'long-campaign-stage-03',
  'long-campaign-stage-04',
  'long-campaign-stage-05',
  'long-campaign-stage-06',
  'party-list-and-gear-looks',
  'skill-trees',
  'ui-feedback-drag-pan-cursor',
])
const LEGACY_PLANS = new Set([
  'audio-pass',
  'auto-resolve',
  'battle-cost',
  'defect-fixes',
  'long-campaign-stage-01',
  'long-campaign-stage-02',
  'long-campaign-stage-03',
  'long-campaign-stage-04',
  'long-campaign-stage-05',
  'long-campaign-stage-06',
  'long-campaign-stage-07',
  'party-list-and-gear-looks',
  'skill-trees',
  'ui-feedback-drag-pan-cursor',
])

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const featuresDir = (root: string) => join(root, 'docs', 'features')
const plansDir = (root: string) => join(root, 'docs', 'implementation-plans')
const bytes = (text: string) => Buffer.byteLength(text, 'utf8')

// The State section: from the `## State` line up to the next line starting `## `.
function stateSection(text: string): string | undefined {
  const lines = text.split('\n')
  const start = lines.findIndex(line => line.trimEnd() === '## State')
  if (start < 0) return undefined
  const end = lines.findIndex((line, i) => i > start && line.startsWith('## '))
  return lines.slice(start, end < 0 ? undefined : end).join('\n')
}

function recordProblems(root: string, legacy: Set<string>): string[] {
  const dir = featuresDir(root)
  if (!existsSync(dir)) return []
  return readdirSync(dir).filter(name => name.endsWith('.md') && !legacy.has(name.slice(0, -3))).sort().flatMap(name => {
    const file = `docs/features/${name}`
    const text = readFileSync(join(dir, name), 'utf8')
    const lines = text.split('\n').map(line => line.trimEnd())
    const problems: string[] = []
    const state = stateSection(text)
    if (state === undefined) problems.push(`${file}: no "## State" heading`)
    if (!lines.includes('## Decision log')) problems.push(`${file}: no "## Decision log" heading`)
    if (state !== undefined && bytes(state) >= STATE_LIMIT_BYTES) problems.push(`${file}: State section is ${bytes(state)} bytes (limit ${STATE_LIMIT_BYTES})`)
    if (bytes(text) >= RECORD_LIMIT_BYTES) problems.push(`${file}: ${bytes(text)} bytes (limit ${RECORD_LIMIT_BYTES})`)
    return problems
  })
}

function planIndexProblems(root: string, legacy: Set<string>): string[] {
  const dir = plansDir(root)
  if (!existsSync(dir)) return []
  return readdirSync(dir, { withFileTypes: true })
    .filter(entry => entry.isDirectory() && !legacy.has(entry.name) && existsSync(join(dir, entry.name, 'index.md')))
    .map(entry => entry.name)
    .sort()
    .flatMap(name => {
      const size = bytes(readFileSync(join(dir, name, 'index.md'), 'utf8'))
      return size >= PLAN_INDEX_LIMIT_BYTES ? [`docs/implementation-plans/${name}/index.md: ${size} bytes (limit ${PLAN_INDEX_LIMIT_BYTES})`] : []
    })
}

function missingLegacy(root: string, records: Set<string>, plans: Set<string>): string[] {
  return [
    ...[...records].filter(slug => !existsSync(join(featuresDir(root), `${slug}.md`))).map(slug => `LEGACY_RECORDS: no docs/features/${slug}.md`),
    ...[...plans].filter(slug => !existsSync(join(plansDir(root), slug))).map(slug => `LEGACY_PLANS: no docs/implementation-plans/${slug}/`),
  ]
}

describe('feature records and plan indexes', () => {
  it('gives each unfinished record a small State section and a Decision log', () => {
    expect(recordProblems(ROOT, LEGACY_RECORDS)).toEqual([])
  })

  it(`keeps each new plan index under ${PLAN_INDEX_LIMIT_BYTES} bytes`, () => {
    expect(planIndexProblems(ROOT, LEGACY_PLANS)).toEqual([])
  })

  it('lists only legacy records and plans that exist', () => {
    expect(missingLegacy(ROOT, LEGACY_RECORDS, LEGACY_PLANS)).toEqual([])
  })
})

describe('the record checks, on a fixture tree', () => {
  const roots: string[] = []
  afterAll(() => roots.forEach(root => rmSync(root, { recursive: true, force: true })))

  function fixture(files: Record<string, string>): string {
    const root = mkdtempSync(join(tmpdir(), 'records-'))
    roots.push(root)
    for (const [path, text] of Object.entries(files)) {
      mkdirSync(dirname(join(root, path)), { recursive: true })
      writeFileSync(join(root, path), text)
    }
    return root
  }
  const pad = (n: number) => 'x'.repeat(n)
  const record = (state: string, rest = '') => `# Feature: f\n\n## State\n\n${state}\n\n## Decision log\n\n${rest}\n`

  it('passes a tree with no records or plans', () => {
    const root = fixture({})
    expect(recordProblems(root, new Set())).toEqual([])
    expect(planIndexProblems(root, new Set())).toEqual([])
    expect(missingLegacy(root, new Set(), new Set())).toEqual([])
  })

  it('passes a record in shape and skips legacy records', () => {
    const root = fixture({
      'docs/features/good.md': record('- Slug: good', '| Date | Decision |'),
      'docs/features/old.md': '# Feature: old\n\nno sections\n',
    })
    expect(recordProblems(root, new Set(['old']))).toEqual([])
  })

  it('reports a record without a State or a Decision log heading', () => {
    const root = fixture({
      'docs/features/nostate.md': '# Feature: f\n\n## Decision log\n',
      'docs/features/nolog.md': '# Feature: f\n\n## State\n\n- x\n',
    })
    expect(recordProblems(root, new Set())).toEqual([
      'docs/features/nolog.md: no "## Decision log" heading',
      'docs/features/nostate.md: no "## State" heading',
    ])
  })

  it('measures the State section up to the next "## " heading', () => {
    // The section is "## State\n\n" (10 bytes), the padding and the "\n" of the
    // blank line before "## Decision log"; the Decision log's padding is not counted.
    const root = fixture({
      'docs/features/big.md': record(pad(2_989), pad(4_000)),
      'docs/features/fits.md': record(pad(2_988), pad(4_000)),
    })
    expect(recordProblems(root, new Set())).toEqual([
      'docs/features/big.md: State section is 3000 bytes (limit 3000)',
    ])
  })

  it('reports a whole record of 8,000 bytes or more', () => {
    const fits = record('- x', '')
    const root = fixture({
      'docs/features/long.md': record('- x', pad(8_000 - bytes(fits))),
      'docs/features/fits.md': record('- x', pad(7_999 - bytes(fits))),
    })
    expect(recordProblems(root, new Set())).toEqual(['docs/features/long.md: 8000 bytes (limit 8000)'])
  })

  it('reports a new plan index of 32,000 bytes or more and skips legacy plans', () => {
    const root = fixture({
      'docs/implementation-plans/big/index.md': pad(32_001),
      'docs/implementation-plans/fits/index.md': pad(31_999),
      'docs/implementation-plans/old/index.md': pad(40_000),
    })
    expect(planIndexProblems(root, new Set(['old']))).toEqual([
      'docs/implementation-plans/big/index.md: 32001 bytes (limit 32000)',
    ])
  })

  it('reports a legacy slug that names no record or plan', () => {
    const root = fixture({ 'docs/features/kept.md': '# kept\n', 'docs/implementation-plans/kept/index.md': '# kept\n' })
    expect(missingLegacy(root, new Set(['kept', 'gone']), new Set(['kept', 'lost']))).toEqual([
      'LEGACY_RECORDS: no docs/features/gone.md',
      'LEGACY_PLANS: no docs/implementation-plans/lost/',
    ])
  })
})
