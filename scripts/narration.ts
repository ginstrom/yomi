// Writes audio/narration.jobs.json from the voiced cutscene beats (read by
// `yomi-audio voice render`). Host only; see audio/CLAUDE.md.
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { parse } from 'smol-toml'
import { CUTSCENES } from '../src/story/cutscenes.ts'
import { buildJobs, hashClips, readVoices } from '../src/story/narration.ts'

const audio = resolve(import.meta.dirname, '../audio')

try {
  const settings = parse(readFileSync(resolve(audio, 'audio.toml'), 'utf8')).voice as Record<string, unknown>
  const jobs = buildJobs(CUTSCENES, readVoices(), settings, (voice) => hashClips(voice, audio))
  writeFileSync(resolve(audio, 'narration.jobs.json'), `${JSON.stringify(jobs, null, 2)}\n`)
  console.log(`narration: wrote ${jobs.jobs.length} job(s) to audio/narration.jobs.json`)
} catch (error) {
  console.error(`narration: ${error instanceof Error ? error.message : String(error)}`)
  process.exit(1)
}
