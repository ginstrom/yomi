import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { parse } from 'smol-toml'
import type { Cutscene, CutsceneBeat } from './cutscenes.ts'

/**
 * The rules for voiced cutscene beats, shared by the exporter
 * (`scripts/narration.ts`) and the tests. Only those import this module, never
 * a scene: it reads files and hashes, which the game's bundle must not.
 */

export type VoiceId = 'narrator'
export type Emotion = 'neutral' | 'warm' | 'grave' | 'tense' | 'afraid' | 'angry' | 'sad' | 'triumphant' | 'whisper'

export const EMOTIONS: readonly Emotion[] = ['neutral', 'warm', 'grave', 'tense', 'afraid', 'angry', 'sad', 'triumphant', 'whisper']
export const NONVERBAL_TAGS: readonly string[] = ['[sigh]', '[laugh]', '[chuckle]', '[gasp]', '[cough]']
/** Engines that read a nonverbal tag in the spoken text. */
export const TAG_ENGINES: readonly string[] = ['chatterbox_turbo']

export interface VoiceTable {
  engine: string
  model: string
  revision: string
  emotions: Emotion[]
  params?: Record<string, unknown>
  clips?: Partial<Record<Emotion, string>>
  [k: string]: unknown
}

export interface VoiceRegistry {
  adapter_version: number
  voices: Record<string, VoiceTable>
}

export interface VoiceManifest {
  version: 1
  lines: Record<string, { hash: string; durationMs: number; voice: string; engine: string }>
}

export interface VoicedLine {
  cutscene: string
  index: number
  beat: CutsceneBeat
}

const REPO_ROOT = resolve(import.meta.dirname, '../..')
export const VOICE_DIR = 'public/assets/voice'

export function readVoices(path = resolve(REPO_ROOT, 'audio/voices.toml')): VoiceRegistry {
  const { adapter_version, ...rest } = parse(readFileSync(path, 'utf8'))
  const voices: Record<string, VoiceTable> = {}
  for (const [id, table] of Object.entries(rest)) voices[id] = table as VoiceTable
  return { adapter_version: adapter_version as number, voices }
}

export function spokenText(beat: CutsceneBeat): string {
  return beat.spoken ?? beat.text
}

export function lineSeed(line: string, take: number): number {
  return createHash('sha256').update(`${line}#${take}`).digest().readUInt32BE(0)
}

export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`
  if (value !== null && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`).join(',')}}`
  }
  return JSON.stringify(value)
}

export function lineHash(
  beat: CutsceneBeat,
  voice: VoiceTable,
  clipHashes: Record<string, string>,
  adapterVersion: number,
  voiceSettings: Record<string, unknown>,
): string {
  const inputs = {
    spoken: spokenText(beat),
    emotion: beat.emotion ?? 'neutral',
    intensity: beat.intensity ?? 0.5,
    take: beat.take ?? 0,
    voice,
    clips: clipHashes,
    adapter_version: adapterVersion,
    voice_settings: voiceSettings,
  }
  return createHash('sha256').update(canonicalJson(inputs)).digest('hex')
}

export function voicedLines(cutscenes: Record<string, Cutscene>): VoicedLine[] {
  const lines: VoicedLine[] = []
  for (const [cutscene, { beats }] of Object.entries(cutscenes)) {
    beats.forEach((beat, index) => {
      if (beat.line !== undefined) lines.push({ cutscene, index, beat })
    })
  }
  return lines
}

export function narrationProblems(cutscenes: Record<string, Cutscene>, registry: VoiceRegistry): string[] {
  const found: string[] = []
  const seen = new Set<string>()
  for (const [cutscene, { beats }] of Object.entries(cutscenes)) {
    beats.forEach((beat, index) => {
      const where = `${cutscene} beat ${index}`
      if (beat.line === undefined) {
        const stray = (['voice', 'emotion', 'intensity', 'spoken', 'take'] as const).filter((k) => beat[k] !== undefined)
        if (stray.length > 0) found.push(`${where}: ${stray.join(', ')} without a line id`)
        return
      }
      const id = beat.line
      const at = `${where} (line ${id})`
      if (!/^[a-z0-9_.]+$/.test(id)) found.push(`${at}: line id must match [a-z0-9_.]+`)
      if (seen.has(id)) found.push(`${at}: duplicate line id`)
      seen.add(id)
      if (beat.speaker?.includes('{leader}') || beat.portrait === 'leader') found.push(`${at}: the leader is never voiced`)
      const spoken = spokenText(beat)
      if (/[{}]/.test(spoken)) found.push(`${at}: spoken text must hold no { } template`)
      const tags = spoken.match(/\[[^\]]*\]/g) ?? []
      const voice = beat.voice === undefined ? undefined : registry.voices[beat.voice]
      if (beat.voice === undefined) found.push(`${at}: a line needs a voice`)
      else if (voice === undefined) found.push(`${at}: unknown voice ${beat.voice}`)
      for (const tag of tags) {
        if (!NONVERBAL_TAGS.includes(tag)) found.push(`${at}: unknown tag ${tag}`)
        else if (voice !== undefined && !TAG_ENGINES.includes(voice.engine)) found.push(`${at}: tag ${tag} needs a tag engine, not ${voice.engine}`)
      }
      const emotion = beat.emotion ?? 'neutral'
      if (voice !== undefined && !voice.emotions.includes(emotion)) found.push(`${at}: voice ${beat.voice} has no emotion ${emotion}`)
      if (beat.intensity !== undefined && !(beat.intensity >= 0 && beat.intensity <= 1)) found.push(`${at}: intensity must be within 0 to 1`)
      if (beat.take !== undefined && !(Number.isInteger(beat.take) && beat.take >= 0)) found.push(`${at}: take must be a non-negative integer`)
      if (spoken.replace(/\[[^\]]*\]/g, '').trim() === '') found.push(`${at}: spoken text is empty`)
    })
  }
  return found
}

export function staleLines(
  lines: readonly VoicedLine[],
  manifest: VoiceManifest,
  hashOf: (line: VoicedLine) => string,
  fileExists: (path: string) => boolean,
): string[] {
  const stale: string[] = []
  for (const line of lines) {
    const id = line.beat.line!
    const entry = manifest.lines[id]
    const files = ['opus', 'mp3'].every((ext) => fileExists(`${VOICE_DIR}/${id}.${ext}`))
    if (entry === undefined || entry.hash !== hashOf(line) || !files) stale.push(id)
  }
  return stale
}

export interface NarrationJob {
  line: string
  spoken: string
  voice: string
  voiceTable: VoiceTable
  emotion: Emotion
  intensity: number
  take: number
  seed: number
  hash: string
}

export interface NarrationJobs {
  adapter_version: number
  voice_settings: Record<string, unknown>
  jobs: NarrationJob[]
}

/** SHA-256 of each of a voice's reference clips, by emotion; throws naming a clip that is missing. */
export function hashClips(voice: VoiceTable, audioRoot = resolve(REPO_ROOT, 'audio')): Record<string, string> {
  const hashes: Record<string, string> = {}
  for (const [emotion, file] of Object.entries(voice.clips ?? {})) {
    const path = resolve(audioRoot, file)
    if (!existsSync(path)) throw new Error(`reference clip for ${emotion} is missing: ${file}`)
    hashes[emotion] = createHash('sha256').update(readFileSync(path)).digest('hex')
  }
  return hashes
}

/** The exporter's job list; throws with every message when the rules are broken. */
export function buildJobs(
  cutscenes: Record<string, Cutscene>,
  registry: VoiceRegistry,
  voiceSettings: Record<string, unknown>,
  clipHashesOf: (voice: VoiceTable) => Record<string, string>,
): NarrationJobs {
  const problems = narrationProblems(cutscenes, registry)
  if (problems.length > 0) throw new Error(problems.join('\n'))
  const jobs = voicedLines(cutscenes).map(({ beat }): NarrationJob => {
    const voiceTable = registry.voices[beat.voice!]!
    const take = beat.take ?? 0
    return {
      line: beat.line!,
      spoken: spokenText(beat),
      voice: beat.voice!,
      voiceTable,
      emotion: beat.emotion ?? 'neutral',
      intensity: beat.intensity ?? 0.5,
      take,
      seed: lineSeed(beat.line!, take),
      hash: lineHash(beat, voiceTable, clipHashesOf(voiceTable), registry.adapter_version, voiceSettings),
    }
  })
  return { adapter_version: registry.adapter_version, voice_settings: voiceSettings, jobs }
}
