import { describe, expect, it } from 'vitest'
import { TradingPostScene } from './TradingPostScene.ts'

describe('TradingPostScene', () => {
  it('registers itself under the "TradingPost" scene key', () => {
    const scene = new TradingPostScene()
    expect(scene.sys.settings.key).toBe('TradingPost')
  })
})
