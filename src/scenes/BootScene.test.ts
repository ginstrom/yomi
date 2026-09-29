import { describe, expect, it } from 'vitest'
import { BootScene } from './BootScene.ts'

describe('BootScene', () => {
  it('registers itself under the "Boot" scene key', () => {
    const scene = new BootScene()
    expect(scene.sys.settings.key).toBe('Boot')
  })
})
