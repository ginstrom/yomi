import { describe, expect, it } from 'vitest'
import { BattleScene } from './BattleScene.ts'

describe('BattleScene', () => {
  it('registers itself under the "Battle" scene key', () => {
    const scene = new BattleScene()
    expect(scene.sys.settings.key).toBe('Battle')
  })
})
