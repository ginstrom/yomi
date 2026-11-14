import { describe, expect, it } from 'vitest'
import type { Cutscene, CutsceneBeat } from '../story/cutscenes.ts'
import type { VoiceManifest } from '../story/narration.ts'
import * as player from './soundPlayer.ts'
import { CUT_FADE_MS, DUCK_ATTACK_MS, DUCK_DB, DUCK_RELEASE_MS, LINE_DELAY_MS, beatLine, linesOf, voiceFiles, voiceKey } from './storyAudio.ts'

const entry = { hash: 'x', durationMs: 1000, voice: 'narrator', engine: 'test' }
const manifest: VoiceManifest = { version: 1, lines: { 'a.one': entry, 'a.two': entry } }
const voiced = (line: string): CutsceneBeat => ({ text: line, line, voice: 'narrator' })
const leader: CutsceneBeat = { speaker: '{leader}', portrait: 'leader', text: 'Hello' }

describe('beatLine', () => {
  it('names the line of a voiced beat the manifest has', () => {
    expect(beatLine(voiced('a.one'), manifest)).toBe('a.one')
  })
  it('is null for a voiced beat not rendered, an unvoiced beat and the leader', () => {
    expect(beatLine(voiced('a.missing'), manifest)).toBeNull()
    expect(beatLine({ text: 'plain' }, manifest)).toBeNull()
    expect(beatLine(leader, manifest)).toBeNull()
  })
  it('reads the shipped manifest by default', () => {
    expect(beatLine(voiced('intro.opening'))).toBe('intro.opening')
  })
})

describe('keys and files', () => {
  it('shapes the cache key and the two files', () => {
    expect(voiceKey('intro.opening')).toBe('voice_intro.opening')
    expect(voiceFiles('intro.opening')).toEqual(['assets/voice/intro.opening.opus', 'assets/voice/intro.opening.mp3'])
  })
})

describe('linesOf', () => {
  it('lists the voiced lines in the manifest in beat order, once each', () => {
    const scene: Cutscene = {
      when: () => true,
      beats: [leader, voiced('a.two'), voiced('a.missing'), voiced('a.one'), voiced('a.two')],
    }
    expect(linesOf(scene, manifest)).toEqual(['a.two', 'a.one'])
  })
})

describe('constants', () => {
  it('holds the design values, one copy with the player', () => {
    expect([LINE_DELAY_MS, CUT_FADE_MS, DUCK_DB, DUCK_ATTACK_MS, DUCK_RELEASE_MS]).toEqual([150, 80, -10, 150, 600])
    expect([DUCK_DB, DUCK_ATTACK_MS, DUCK_RELEASE_MS]).toEqual([player.DUCK_DB, player.DUCK_ATTACK_MS, player.DUCK_RELEASE_MS])
  })
})
