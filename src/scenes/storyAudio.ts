import voiceManifest from '../../audio/voice.manifest.json'
import type { Cutscene, CutsceneBeat } from '../story/cutscenes.ts'
import type { VoiceManifest } from '../story/narration.ts'

/**
 * What a cutscene's voice does, apart from Phaser: which line a beat speaks,
 * where its files are and under what key they load, and the timings. The
 * manifest is the record of what was rendered; a beat whose line is not in it
 * is silent. The duck's numbers are the player's own (soundPlayer.ts).
 */

export { DUCK_ATTACK_MS, DUCK_DB, DUCK_RELEASE_MS } from './soundPlayer.ts'

/** A voiced beat's line starts this long after the beat is drawn. */
export const LINE_DELAY_MS = 150
/** Next and Esc fade the line out over this long. */
export const CUT_FADE_MS = 80

/** The line a beat speaks: its id when it is voiced and rendered, else null. */
export function beatLine(beat: CutsceneBeat, manifest: VoiceManifest = voiceManifest as VoiceManifest): string | null {
  return beat.line !== undefined && beat.line in manifest.lines ? beat.line : null
}

/** The sound cache key of a line. */
export const voiceKey = (line: string): string => `voice_${line}`

/** The files of a line, under `public/`, in the order the loader tries them. */
export const voiceFiles = (line: string): string[] => [`assets/voice/${line}.opus`, `assets/voice/${line}.mp3`]

/** The cutscene's rendered lines in beat order, each once: what to load. */
export function linesOf(cutscene: Cutscene, manifest: VoiceManifest = voiceManifest as VoiceManifest): string[] {
  const lines: string[] = []
  for (const beat of cutscene.beats) {
    const line = beatLine(beat, manifest)
    if (line !== null && !lines.includes(line)) lines.push(line)
  }
  return lines
}
