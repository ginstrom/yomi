import { describe, expect, it } from 'vitest'
import { InventoryScene } from './InventoryScene.ts'

describe('InventoryScene', () => {
  it('registers itself under the "Inventory" scene key', () => {
    const scene = new InventoryScene()
    expect(scene.sys.settings.key).toBe('Inventory')
  })
})
