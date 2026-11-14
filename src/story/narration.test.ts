import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { resolve } from 'node:path'
import { parse } from 'smol-toml'
import { describe, expect, it } from 'vitest'
import { CUTSCENES, type Cutscene, type CutsceneBeat } from './cutscenes.ts'
import {
  EMOTIONS,
  NONVERBAL_TAGS,
  TAG_ENGINES,
  VOICE_DIR,
  buildJobs,
  canonicalJson,
  hashClips,
  lineHash,
  lineSeed,
  narrationProblems,
  readVoices,
  spokenText,
  staleLines,
  voicedLines,
  type VoiceManifest,
  type VoiceRegistry,
  type VoiceTable,
} from './narration.ts'

const root = resolve(import.meta.dirname, '../..')

const voices: VoiceRegistry = {
  adapter_version: 1,
  voices: {
    narrator: { engine: 'chatterbox', model: 'm', revision: 'r', emotions: ['neutral', 'grave', 'whisper'] },
    turbo_voice: { engine: 'chatterbox_turbo', model: 'm', revision: 'r', emotions: ['neutral', 'afraid'] },
  },
}

const turbo = 'turbo_voice' as never
const voiced = (line: string, extra: Partial<CutsceneBeat> = {}): CutsceneBeat => ({
  text: 'The wind rises.',
  line,
  voice: 'narrator',
  ...extra,
})
const scene = (...beats: CutsceneBeat[]): Cutscene => ({ when: () => false, beats })
const problems = (cutscenes: Record<string, Cutscene>) => narrationProblems(cutscenes, voices)

describe('narrationProblems (AC11)', () => {
  it('accepts a well-formed voiced beat', () => {
    expect(problems({ a: scene(voiced('a.one'), voiced('a.two', { emotion: 'grave', intensity: 1, take: 2 })) })).toEqual([])
  })

  it('accepts the real cutscenes against the real registry', () => {
    expect(narrationProblems(CUTSCENES, readVoices())).toEqual([])
  })

  it('refuses a duplicate line id across cutscenes', () => {
    const found = problems({ a: scene(voiced('same.line')), b: scene(voiced('same.line')) })
    expect(found.some((p) => p.includes('same.line') && /duplicate/i.test(p))).toBe(true)
  })

  it('refuses a malformed line id', () => {
    const found = problems({ a: scene(voiced('Intro Opening')) })
    expect(found.some((p) => p.includes('Intro Opening'))).toBe(true)
  })

  it('refuses a line without a voice', () => {
    const found = problems({ a: scene({ text: 'x', line: 'a.novoice' }) })
    expect(found.some((p) => p.includes('a.novoice') && /voice/.test(p))).toBe(true)
  })

  it('refuses a voice without a line', () => {
    const found = problems({ a: scene({ text: 'x', voice: 'narrator' }) })
    expect(found.length).toBe(1)
    expect(found[0]).toMatch(/voice/)
  })

  it('refuses another voiced field without a line', () => {
    expect(problems({ a: scene({ text: 'x', emotion: 'grave' }) }).length).toBe(1)
  })

  it('refuses an unknown voice', () => {
    const found = problems({ a: scene(voiced('a.unknown', { voice: 'elder' as never })) })
    expect(found.some((p) => p.includes('a.unknown') && p.includes('elder'))).toBe(true)
  })

  it('refuses to voice a {leader} speaker', () => {
    const found = problems({ a: scene(voiced('a.leader', { speaker: '{leader}' })) })
    expect(found.some((p) => p.includes('a.leader') && /leader/.test(p))).toBe(true)
  })

  it('refuses to voice a beat with the leader portrait', () => {
    const found = problems({ a: scene(voiced('a.face', { portrait: 'leader' })) })
    expect(found.some((p) => p.includes('a.face') && /leader/.test(p))).toBe(true)
  })

  it('refuses spoken text with {encampment}', () => {
    const found = problems({ a: scene(voiced('a.camp', { spoken: 'Welcome to {encampment}.' })) })
    expect(found.some((p) => p.includes('a.camp') && /\{/.test(p))).toBe(true)
  })

  it('refuses shown text with a template when nothing else is spoken', () => {
    const found = problems({ a: scene(voiced('a.shown', { text: 'Defend {encampment}.' })) })
    expect(found.some((p) => p.includes('a.shown'))).toBe(true)
  })

  it('refuses an unknown tag', () => {
    const found = problems({ a: scene(voiced('a.yawn', { voice: turbo, spoken: 'Well. [yawn] Go on.' })) })
    expect(found.some((p) => p.includes('a.yawn') && p.includes('[yawn]'))).toBe(true)
  })

  it('refuses a known tag for an engine that cannot speak tags', () => {
    const found = problems({ a: scene(voiced('a.sigh', { spoken: 'Well. [sigh] Go on.' })) })
    expect(found.some((p) => p.includes('a.sigh') && p.includes('[sigh]'))).toBe(true)
  })

  it('accepts a known tag for a tag engine', () => {
    expect(problems({ a: scene(voiced('a.sigh', { voice: turbo, spoken: 'Well. [sigh] Go on.' })) })).toEqual([])
  })

  it('refuses an emotion the voice lacks', () => {
    const found = problems({ a: scene(voiced('a.angry', { emotion: 'angry' })) })
    expect(found.some((p) => p.includes('a.angry') && p.includes('angry'))).toBe(true)
  })

  it.each([1.5, -0.1])('refuses an intensity of %s', (intensity) => {
    const found = problems({ a: scene(voiced('a.loud', { intensity })) })
    expect(found.some((p) => p.includes('a.loud') && /intensity/.test(p))).toBe(true)
  })

  it.each([-1, 1.5])('refuses a take of %s', (take) => {
    const found = problems({ a: scene(voiced('a.take', { take })) })
    expect(found.some((p) => p.includes('a.take') && /take/.test(p))).toBe(true)
  })

  it('refuses spoken text that is only tags', () => {
    const found = problems({ a: scene(voiced('a.empty', { voice: turbo, spoken: ' [sigh] ' })) })
    expect(found.some((p) => p.includes('a.empty') && /empty/.test(p))).toBe(true)
  })

  it('names the cutscene and beat index', () => {
    const found = problems({ tale: scene(voiced('t.ok'), voiced('t.bad', { emotion: 'angry' })) })
    expect(found[0]).toContain('tale')
    expect(found[0]).toContain('beat 1')
  })
})

describe('the real registry', () => {
  const registry = readVoices()

  it('has exactly the narrator voice', () => {
    expect(Object.keys(registry.voices)).toEqual(['narrator'])
  })

  it('lists only known emotions and a positive integer adapter version', () => {
    for (const voice of Object.values(registry.voices)) {
      for (const emotion of voice.emotions) expect(EMOTIONS).toContain(emotion)
    }
    expect(Number.isInteger(registry.adapter_version) && registry.adapter_version > 0).toBe(true)
  })

  it('narrator is Chatterbox Turbo, a tag engine', () => {
    expect(registry.voices.narrator?.engine).toBe('chatterbox_turbo')
    expect(TAG_ENGINES).toContain('chatterbox_turbo')
  })

  it('exports the vocabulary of the contract', () => {
    expect(EMOTIONS).toHaveLength(9)
    expect(NONVERBAL_TAGS).toEqual(['[sigh]', '[laugh]', '[chuckle]', '[gasp]', '[cough]'])
  })
})

describe('helpers', () => {
  const table: VoiceTable = { engine: 'chatterbox', model: 'm', revision: 'r', emotions: ['neutral'], params: { a: 1, b: { c: 2, d: 3 } } }
  const settings = { highpass_hz: 70 }
  const hash = (beat: CutsceneBeat, voice = table, clips: Record<string, string> = {}, adapter = 1, vs: Record<string, unknown> = settings) =>
    lineHash(beat, voice, clips, adapter, vs)

  it('spokenText prefers spoken', () => {
    expect(spokenText({ text: 'shown', spoken: 'said' })).toBe('said')
    expect(spokenText({ text: 'shown' })).toBe('shown')
  })

  it('lineSeed is the first 32 bits of SHA-256 of "line#take" (a contract with the Python render)', () => {
    expect(lineSeed('a.b', 0)).toBe(783809183)
    expect(lineSeed('a.b', 3)).toBe(3110204851)
  })

  it('lineSeed is deterministic, 32 bits and differs between takes', () => {
    expect(lineSeed('a.b', 0)).toBe(lineSeed('a.b', 0))
    expect(lineSeed('a.b', 0)).not.toBe(lineSeed('a.b', 1))
    const seed = lineSeed('a.b', 3)
    expect(Number.isInteger(seed) && seed >= 0 && seed < 2 ** 32).toBe(true)
  })

  it('canonicalJson ignores key order at every depth but keeps arrays', () => {
    expect(canonicalJson({ b: 1, a: { y: 1, x: [2, 1] } })).toBe(canonicalJson({ a: { x: [2, 1], y: 1 }, b: 1 }))
    expect(canonicalJson({ a: 1, b: [2, 1] })).toBe('{"a":1,"b":[2,1]}')
    expect(canonicalJson({ a: [2, 1] })).not.toBe(canonicalJson({ a: [1, 2] }))
  })

  it('lineHash is stable across key order of the voice table', () => {
    const shuffled: VoiceTable = { emotions: ['neutral'], revision: 'r', params: { b: { d: 3, c: 2 }, a: 1 }, model: 'm', engine: 'chatterbox' }
    expect(hash(voiced('x'), shuffled)).toBe(hash(voiced('x')))
    expect(hash(voiced('x'))).toMatch(/^[0-9a-f]{64}$/)
  })

  it('lineHash applies defaults', () => {
    expect(hash(voiced('x', { emotion: 'neutral', intensity: 0.5, take: 0 }))).toBe(hash(voiced('x')))
  })

  it('lineHash changes with each input', () => {
    const base = hash(voiced('x'))
    expect(hash(voiced('x', { spoken: 'other' }))).not.toBe(base)
    expect(hash(voiced('x', { emotion: 'grave' }))).not.toBe(base)
    expect(hash(voiced('x', { intensity: 0.9 }))).not.toBe(base)
    expect(hash(voiced('x', { take: 1 }))).not.toBe(base)
    expect(hash(voiced('x'), { ...table, revision: 'r2' })).not.toBe(base)
    expect(hash(voiced('x'), table, { neutral: 'abc' })).not.toBe(base)
    expect(hash(voiced('x'), table, {}, 2)).not.toBe(base)
    expect(hash(voiced('x'), table, {}, 1, { highpass_hz: 80 })).not.toBe(base)
  })
})

describe('staleLines (AC12)', () => {
  const cutscenes = { a: scene(voiced('a.one', { spoken: 'Hello.' })) }
  const lines = voicedLines(cutscenes)
  const hashOf = (line: (typeof lines)[number]) => lineHash(line.beat, voices.voices.narrator!, {}, 1, {})
  const entry = (hash: string) => ({ hash, durationMs: 1000, voice: 'narrator', engine: 'chatterbox@r' })
  const manifest = (lineHashes: Record<string, string>): VoiceManifest => ({
    version: 1,
    lines: Object.fromEntries(Object.entries(lineHashes).map(([id, h]) => [id, entry(h)])),
  })
  const files = () => true

  it('voicedLines lists voiced beats in order', () => {
    const two = voicedLines({ a: scene({ text: 'x' }, voiced('a.1')), b: scene(voiced('b.1'), voiced('b.2')) })
    expect(two.map((l) => [l.cutscene, l.index, l.beat.line])).toEqual([['a', 1, 'a.1'], ['b', 0, 'b.1'], ['b', 1, 'b.2']])
  })

  it('passes when the hash matches and the files exist', () => {
    expect(staleLines(lines, manifest({ 'a.one': hashOf(lines[0]!) }), hashOf, files)).toEqual([])
  })

  it('reports a line missing from the manifest', () => {
    expect(staleLines(lines, manifest({}), hashOf, files)).toEqual(['a.one'])
  })

  it('reports a wrong hash', () => {
    expect(staleLines(lines, manifest({ 'a.one': 'nope' }), hashOf, files)).toEqual(['a.one'])
  })

  it('reports a missing file of either format', () => {
    const m = manifest({ 'a.one': hashOf(lines[0]!) })
    expect(staleLines(lines, m, hashOf, (p) => !p.endsWith('.mp3'))).toEqual(['a.one'])
    expect(staleLines(lines, m, hashOf, (p) => !p.endsWith('.opus'))).toEqual(['a.one'])
  })

  it('goes stale when the spoken text changes after rendering', () => {
    const m = manifest({ 'a.one': hashOf(lines[0]!) })
    const edited = voicedLines({ a: scene(voiced('a.one', { spoken: 'Hello again.' })) })
    expect(staleLines(edited, m, hashOf, files)).toEqual(['a.one'])
  })

  describe('the shipped lines', () => {
    const registry = readVoices()
    const manifestFile = JSON.parse(readFileSync(resolve(root, 'audio/voice.manifest.json'), 'utf8')) as VoiceManifest
    const settings = parse(readFileSync(resolve(root, 'audio/audio.toml'), 'utf8')).voice as Record<string, unknown>
    const real = voicedLines(CUTSCENES)
    const realHash = (line: (typeof real)[number]) => {
      const voice = registry.voices[line.beat.voice!]!
      return lineHash(line.beat, voice, hashClips(voice, resolve(root, 'audio')), registry.adapter_version, settings)
    }
    const onDisk = (p: string) => existsSync(resolve(root, p))

    it('are voiced and fresh against the committed manifest and files', () => {
      expect(real.map((l) => l.beat.line)).toEqual(['intro.opening', 'source.sighted'])
      expect(staleLines(real, manifestFile, realHash, onDisk)).toEqual([])
    })

    it('go stale when a beat is edited without rendering', () => {
      const edited = voicedLines({ intro: scene({ ...real[0]!.beat, spoken: `${spokenText(real[0]!.beat)} More.` }) })
      expect(staleLines(edited, manifestFile, realHash, onDisk)).toEqual(['intro.opening'])
    })

    it('keep the voice files within the budget per format', () => {
      const budget = (parse(readFileSync(resolve(root, 'audio/audio.toml'), 'utf8')).budgets as Record<string, number>).voice_bytes_per_format
      const dir = resolve(root, VOICE_DIR)
      for (const ext of ['.opus', '.mp3']) {
        const bytes = readdirSync(dir).filter((f) => f.endsWith(ext)).reduce((sum, f) => sum + statSync(resolve(dir, f)).size, 0)
        expect(bytes).toBeLessThanOrEqual(budget)
      }
    })
  })
})

describe('buildJobs', () => {
  const cutscenes = { a: scene(voiced('a.one', { spoken: 'Hello.', emotion: 'grave' }), voiced('a.two')) }

  it('builds the jobs file in the contract shape', () => {
    const settings = { highpass_hz: 70 }
    const jobs = buildJobs(cutscenes, voices, settings, () => ({ neutral: 'c0ffee' }))
    const narrator = voices.voices.narrator!
    expect(jobs.adapter_version).toBe(1)
    expect(jobs.voice_settings).toEqual(settings)
    expect(jobs.jobs).toHaveLength(2)
    expect(jobs.jobs[0]).toEqual({
      line: 'a.one',
      spoken: 'Hello.',
      voice: 'narrator',
      voiceTable: narrator,
      emotion: 'grave',
      intensity: 0.5,
      take: 0,
      seed: lineSeed('a.one', 0),
      hash: lineHash(cutscenes.a.beats[0]!, narrator, { neutral: 'c0ffee' }, 1, settings),
    })
    expect(jobs.jobs[1]).toMatchObject({ line: 'a.two', spoken: 'The wind rises.', emotion: 'neutral' })
  })

  it('writes an empty list for no voiced lines', () => {
    expect(buildJobs({ a: scene({ text: 'x' }) }, voices, {}, () => ({})).jobs).toEqual([])
  })

  it('refuses when the rules are broken, naming every problem', () => {
    const bad = { a: scene(voiced('a.x', { emotion: 'angry' }), voiced('a.y', { speaker: '{leader}' })) }
    expect(() => buildJobs(bad, voices, {}, () => ({}))).toThrow(/a\.x[\s\S]*a\.y/)
  })
})
