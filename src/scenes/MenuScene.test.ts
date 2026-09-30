import { describe, expect, it } from 'vitest'
import { MenuScene } from './MenuScene.ts'

describe('MenuScene', () => {
  it('registers itself under the "Menu" scene key', () => {
    const scene = new MenuScene()
    expect(scene.sys.settings.key).toBe('Menu')
  })
})
