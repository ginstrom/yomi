import { describe, expect, it } from 'vitest'
import { CraftingScene } from './CraftingScene.ts'

describe('CraftingScene', () => {
  it('registers itself under the "Crafting" scene key', () => {
    const scene = new CraftingScene()
    expect(scene.sys.settings.key).toBe('Crafting')
  })
})
