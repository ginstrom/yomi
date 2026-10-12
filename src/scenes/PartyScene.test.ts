import { describe, expect, it } from 'vitest'
import { PartyScene } from './PartyScene.ts'

describe('PartyScene', () => {
  it('registers itself under the "Party" scene key', () => {
    const scene = new PartyScene()
    expect(scene.sys.settings.key).toBe('Party')
  })
})
