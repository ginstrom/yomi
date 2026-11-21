import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterAll, describe, expect, it } from 'vitest'

// The CLAUDE.md files, the project skills and agents under .claude/ are loaded
// into Claude's context: the root CLAUDE.md and every skill's and agent's name
// and description in every session, a directory's CLAUDE.md whenever work
// touches that directory, a skill's or agent's body when it is used. The caps
// keep that loaded context small. They are kept to working guides; the full
// detail lives in docs/reference/. When a cap fails, move detail out; do not
// raise the limits.
const ROOT_LIMIT_BYTES = 16_000
const DIRECTORY_LIMIT_BYTES = 12_000
const SKILL_LIMIT_BYTES = 4_000
const SKILL_FILE_LIMIT_BYTES = 8_000
const AGENT_LIMIT_BYTES = 6_000
const DESCRIPTION_LIMIT_BYTES = 260
const ALWAYS_LOADED_LIMIT_BYTES = 8_500
// Constants a .claude/ file may name although no .ts file defines them.
const ABSENT_CONSTANTS = new Set<string>()

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const SKIP = new Set(['node_modules', '.git', 'dist', 'logs', '.vitest'])

function claudeFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    if (entry.isDirectory()) return SKIP.has(entry.name) || entry.name.startsWith('.') ? [] : claudeFiles(join(dir, entry.name))
    return entry.name === 'CLAUDE.md' ? [join(dir, entry.name)] : []
  })
}

type Offender = { file: string; problem: string }

// .claude/ is never walked itself: agent worktrees (.claude/worktrees/) are whole
// repository copies. Only these directories are read; a missing one is empty.
// (Step 08 of the modular-context plan adds .claude/roles/*.md here.)
function subdirectories(dir: string): string[] {
  if (!existsSync(dir)) return []
  return readdirSync(dir, { withFileTypes: true }).filter(entry => entry.isDirectory()).map(entry => join(dir, entry.name)).sort()
}

function markdownFiles(dir: string, recursive: boolean): string[] {
  if (!existsSync(dir)) return []
  return readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) return recursive && !SKIP.has(entry.name) ? markdownFiles(path, true) : []
    return entry.name.endsWith('.md') ? [path] : []
  }).sort()
}

const skillDirs = (root: string) => subdirectories(join(root, '.claude', 'skills'))
const agentFiles = (root: string) => markdownFiles(join(root, '.claude', 'agents'), false)
const projectFiles = (root: string) => [...skillDirs(root).flatMap(dir => markdownFiles(dir, true)), ...agentFiles(root)]

// What every session loads: each skill's frontmatter (in its SKILL.md) and each
// agent's, with the name it must carry.
function described(root: string): { file: string; expectedName: string }[] {
  return [
    ...skillDirs(root).map(dir => ({ file: join(dir, 'SKILL.md'), expectedName: relative(join(root, '.claude', 'skills'), dir) })),
    ...agentFiles(root).map(file => ({ file, expectedName: relative(join(root, '.claude', 'agents'), file).replace(/\.md$/, '') })),
  ]
}

// The block between a leading `---` line and the next, as `key: value` lines.
// A value is one line: `multiLine` names keys followed by a line that is
// neither another key nor the closing `---`.
function frontmatter(text: string): { fields: Map<string, string>; multiLine: Set<string> } | null {
  const lines = text.split('\n')
  if (lines[0]?.trim() !== '---') return null
  const end = lines.findIndex((line, i) => i > 0 && line.trim() === '---')
  if (end < 0) return null
  const fields = new Map<string, string>()
  const multiLine = new Set<string>()
  let last: string | null = null
  for (const line of lines.slice(1, end)) {
    const match = /^([A-Za-z][\w-]*):(.*)$/.exec(line)
    if (match) {
      last = match[1]
      fields.set(last, match[2].trim())
    } else if (last) multiLine.add(last)
  }
  return { fields, multiLine }
}

function oversizeFiles(root: string): Offender[] {
  const limitFor = (file: string) =>
    file.startsWith(join(root, '.claude', 'agents')) ? AGENT_LIMIT_BYTES
      : basename(file) === 'SKILL.md' && dirname(dirname(file)) === join(root, '.claude', 'skills') ? SKILL_LIMIT_BYTES
        : SKILL_FILE_LIMIT_BYTES
  return projectFiles(root)
    .map(file => ({ file, bytes: readFileSync(file).byteLength, limit: limitFor(file) }))
    .filter(({ bytes, limit }) => bytes >= limit)
    .map(({ file, bytes, limit }) => ({ file: relative(root, file), problem: `${bytes} bytes, limit ${limit}` }))
}

function frontmatterProblems(root: string): Offender[] {
  return described(root).flatMap(({ file, expectedName }): Offender[] => {
    const at = relative(root, file)
    if (!existsSync(file)) return [{ file: at, problem: 'missing' }]
    const front = frontmatter(readFileSync(file, 'utf8'))
    if (!front) return [{ file: at, problem: 'no frontmatter' }]
    const name = front.fields.get('name')
    const description = front.fields.get('description')
    const problems: string[] = []
    if (name !== expectedName) problems.push(`name ${JSON.stringify(name)}, expected ${JSON.stringify(expectedName)}`)
    if (!description) problems.push('no description')
    else if (front.multiLine.has('description')) problems.push('description runs past one line')
    else if (Buffer.byteLength(description) >= DESCRIPTION_LIMIT_BYTES) problems.push(`description ${Buffer.byteLength(description)} bytes, limit ${DESCRIPTION_LIMIT_BYTES}`)
    return problems.map(problem => ({ file: at, problem }))
  })
}

// The root CLAUDE.md plus every skill's and agent's name and description.
function alwaysLoadedBytes(root: string): number {
  return described(root).reduce((total, { file }) => {
    const fields = existsSync(file) ? frontmatter(readFileSync(file, 'utf8'))?.fields : undefined
    return total + Buffer.byteLength(fields?.get('name') ?? '') + Buffer.byteLength(fields?.get('description') ?? '')
  }, readFileSync(join(root, 'CLAUDE.md')).byteLength)
}

const CONSTANT = /^[A-Z][A-Z0-9]*(_[A-Z0-9]+)+$/
const PATH_PREFIXES = ['src/', 'scripts/', 'art/', 'audio/', 'e2e/', 'docs/', '.claude/']
const PLACEHOLDER = /[<>*{}…]/

function tsFiles(dir: string): string[] {
  if (!existsSync(dir)) return []
  return readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) return SKIP.has(entry.name) ? [] : tsFiles(path)
    return entry.name.endsWith('.ts') ? [path] : []
  })
}

// Inline backticked spans outside fenced code blocks.
function backtickedSpans(text: string): string[] {
  const prose = text.split(/^```.*$/m).filter((_, i) => i % 2 === 0).join('\n')
  return [...prose.matchAll(/`([^`\n]+)`/g)].map(match => match[1])
}

function staleNames(root: string, absent: ReadonlySet<string>): Offender[] {
  const files = projectFiles(root)
  if (files.length === 0) return []
  const words = new Set(['src', 'scripts', 'e2e'].flatMap(dir => tsFiles(join(root, dir)))
    .flatMap(file => readFileSync(file, 'utf8').match(/\b[A-Z][A-Z0-9_]*\b/g) ?? []))
  return files.flatMap(file => backtickedSpans(readFileSync(file, 'utf8'))
    .filter(span => !PLACEHOLDER.test(span))
    .filter(span => {
      if (CONSTANT.test(span)) return !words.has(span) && !absent.has(span)
      if (PATH_PREFIXES.some(prefix => span.startsWith(prefix)) && !span.includes(' '))
        return !existsSync(join(root, span.replace(/#[^#/]*$/, '').replace(/:\d+(-\d+)?$/, '')))
      return false
    })
    .map(span => ({ file: relative(root, file), problem: span })))
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

describe('.claude/ skills and agents', () => {
  it('keeps each skill, skill file and agent under its size limit', () => {
    expect(oversizeFiles(ROOT)).toEqual([])
  })

  it('gives each skill and agent a matching name and a short one-line description', () => {
    expect(frontmatterProblems(ROOT)).toEqual([])
  })

  const total = alwaysLoadedBytes(ROOT)
  it(`keeps the always-loaded context under ${ALWAYS_LOADED_LIMIT_BYTES} bytes (now ${total})`, () => {
    expect(total, `root CLAUDE.md + skill and agent names and descriptions: ${total} bytes`).toBeLessThan(ALWAYS_LOADED_LIMIT_BYTES)
  })

  it('names only constants and paths that exist', () => {
    expect(staleNames(ROOT, ABSENT_CONSTANTS)).toEqual([])
  })
})

describe('the .claude/ checks, on a fixture tree', () => {
  const roots: string[] = []
  afterAll(() => roots.forEach(root => rmSync(root, { recursive: true, force: true })))

  function fixture(files: Record<string, string>): string {
    const root = mkdtempSync(join(tmpdir(), 'claude-md-'))
    roots.push(root)
    const all: Record<string, string> = { 'CLAUDE.md': '# Root\n', 'src/a.ts': 'export const KNOWN_LIMIT = 1\n', ...files }
    for (const [path, text] of Object.entries(all)) {
      mkdirSync(dirname(join(root, path)), { recursive: true })
      writeFileSync(join(root, path), text)
    }
    return root
  }
  const skill = (name: string, description: string, body = '') => `---\nname: ${name}\ndescription: ${description}\n---\n${body}`
  const pad = (bytes: number) => 'x'.repeat(bytes)

  it('passes a tree with no .claude/ directory', () => {
    const root = fixture({})
    expect(existsSync(join(root, '.claude'))).toBe(false)
    expect(oversizeFiles(root)).toEqual([])
    expect(frontmatterProblems(root)).toEqual([])
    expect(staleNames(root, new Set())).toEqual([])
    expect(alwaysLoadedBytes(root)).toBe(7)
  })

  it('reports an oversize SKILL.md, supporting file and agent', () => {
    const root = fixture({
      '.claude/skills/big/SKILL.md': skill('big', 'Big.', pad(SKILL_LIMIT_BYTES)),
      '.claude/skills/big/more/notes.md': pad(SKILL_FILE_LIMIT_BYTES),
      '.claude/skills/big/fine.md': pad(SKILL_FILE_LIMIT_BYTES - 1),
      '.claude/agents/huge.md': skill('huge', 'Huge.', pad(AGENT_LIMIT_BYTES)),
    })
    expect(oversizeFiles(root).map(({ file }) => file).sort()).toEqual([
      '.claude/agents/huge.md',
      '.claude/skills/big/SKILL.md',
      '.claude/skills/big/more/notes.md',
    ])
  })

  it('never reads .claude/ outside skills and agents', () => {
    const root = fixture({ '.claude/worktrees/agent-1/.claude/skills/x/SKILL.md': skill('y', 'Y.', pad(SKILL_LIMIT_BYTES) + '`src/missing.ts`') })
    expect(oversizeFiles(root)).toEqual([])
    expect(frontmatterProblems(root)).toEqual([])
    expect(staleNames(root, new Set())).toEqual([])
  })

  it('reports a name that differs from its directory or file', () => {
    const root = fixture({
      '.claude/skills/good/SKILL.md': skill('good', 'Good.'),
      '.claude/skills/wrong/SKILL.md': skill('other', 'Wrong.'),
      '.claude/agents/agent-x.md': skill('agent-y', 'Wrong.'),
    })
    expect(frontmatterProblems(root).map(({ file }) => file).sort()).toEqual(['.claude/agents/agent-x.md', '.claude/skills/wrong/SKILL.md'])
  })

  it('reports missing frontmatter, name or description', () => {
    const root = fixture({
      '.claude/skills/bare/SKILL.md': '# No frontmatter\n',
      '.claude/skills/nameless/SKILL.md': '---\ndescription: D.\n---\n',
      '.claude/skills/undescribed/SKILL.md': '---\nname: undescribed\n---\n',
      '.claude/skills/nofile/notes.md': 'No SKILL.md.\n',
    })
    expect(frontmatterProblems(root).map(({ file }) => file).sort()).toEqual([
      '.claude/skills/bare/SKILL.md',
      '.claude/skills/nameless/SKILL.md',
      '.claude/skills/nofile/SKILL.md',
      '.claude/skills/undescribed/SKILL.md',
    ])
  })

  it('reports a multi-line description and one of 260 bytes or more', () => {
    const root = fixture({
      '.claude/skills/multi/SKILL.md': '---\nname: multi\ndescription: First line,\n  and a second.\n---\n',
      '.claude/skills/long/SKILL.md': skill('long', pad(DESCRIPTION_LIMIT_BYTES)),
      '.claude/skills/fits/SKILL.md': skill('fits', pad(DESCRIPTION_LIMIT_BYTES - 1)),
      '.claude/agents/tooled.md': '---\nname: tooled\ndescription: Fine.\ntools: Bash, Read\nmodel: haiku\n---\nBody.\n',
    })
    expect(frontmatterProblems(root).map(({ file }) => file).sort()).toEqual(['.claude/skills/long/SKILL.md', '.claude/skills/multi/SKILL.md'])
  })

  it('counts the root file and every name and description in the budget', () => {
    const root = fixture({
      'CLAUDE.md': pad(ALWAYS_LOADED_LIMIT_BYTES - 20),
      '.claude/skills/ab/SKILL.md': skill('ab', 'cdefgh', pad(5000)),
      '.claude/agents/ij.md': skill('ij', 'klmnopqrst'),
    })
    expect(alwaysLoadedBytes(root)).toBe(ALWAYS_LOADED_LIMIT_BYTES - 20 + 2 + 6 + 2 + 10)
    expect(alwaysLoadedBytes(root)).toBeGreaterThanOrEqual(ALWAYS_LOADED_LIMIT_BYTES)
  })

  it('reports an unknown constant and a missing path, and skips placeholders', () => {
    const root = fixture({
      'src/b.ts': 'const OTHER_THING = 2\n',
      'docs/x.md': '# X\n',
      '.claude/skills/names/SKILL.md': skill('names', 'Names.', [
        'Known: `KNOWN_LIMIT`, `OTHER_THING`, `ALLOWED_NAME`, `KNOWN`, `src/a.ts:12`, `docs/x.md#heading`, `src/a.ts:3#x`.',
        'Placeholders: `src/<dir>/CLAUDE.md`, `logs/<label>.txt`, `src/*.ts`, `docs/{a,b}.md`, `src/…`.',
        'Not paths: `npm run simulate -- --out logs/x`, `src/missing.ts later`, `lib/nothing.ts`.',
        'Stale: `UNKNOWN_LIMIT`, `src/missing.ts`, `docs/gone.md:4`.',
        '```',
        '`FENCED_ONLY` `src/fenced.ts`',
        '```',
      ].join('\n')),
      '.claude/agents/runner.md': skill('runner', 'Runner.', 'See `e2e/nothing.ts`.'),
      'e2e/c.ts': 'NOT_NAMED_HERE\n',
    })
    expect(staleNames(root, new Set(['ALLOWED_NAME']))).toEqual([
      { file: '.claude/skills/names/SKILL.md', problem: 'UNKNOWN_LIMIT' },
      { file: '.claude/skills/names/SKILL.md', problem: 'src/missing.ts' },
      { file: '.claude/skills/names/SKILL.md', problem: 'docs/gone.md:4' },
      { file: '.claude/agents/runner.md', problem: 'e2e/nothing.ts' },
    ])
  })
})
