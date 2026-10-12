import { describe, expect, it } from 'vitest'
import { CreationScene } from './CreationScene.ts'

describe('CreationScene', () => {
  it('registers itself under the "Creation" scene key', () => {
    const scene = new CreationScene()
    expect(scene.sys.settings.key).toBe('Creation')
  })
})
