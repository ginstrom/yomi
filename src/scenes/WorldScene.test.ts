import { describe, expect, it } from 'vitest'
import { WorldScene } from './WorldScene.ts'

describe('WorldScene', () => {
  it('registers itself under the "World" scene key', () => {
    const scene = new WorldScene()
    expect(scene.sys.settings.key).toBe('World')
  })
})
