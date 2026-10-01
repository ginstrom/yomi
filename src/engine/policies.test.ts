import { describe, expect, it } from 'vitest'
import { GOBLIN_STATS } from '../combat/combat.ts'
import { BattleEngine, type Action } from './battleEngine.ts'
import { POLICIES, isPolicyName, type PolicyContext } from './policies.ts'

function context(legal: readonly Action[], rngValue = 0): PolicyContext {
  const engine = new BattleEngine({ player: GOBLIN_STATS, enemy: GOBLIN_STATS })
  return { state: engine.getState(), side: 'player', legal, rng: () => rngValue }
}

describe('policies', () => {
  it('aggressive attacks whenever attacking is legal', () => {
    expect(POLICIES.aggressive(context([{ type: 'end_turn' }, { type: 'attack' }]))).toEqual({ type: 'attack' })
    expect(POLICIES.aggressive(context([{ type: 'end_turn' }]))).toEqual({ type: 'end_turn' })
  })

  it('random picks among legal actions using the supplied rng', () => {
    const legal: Action[] = [{ type: 'attack' }, { type: 'end_turn' }]
    expect(POLICIES.random(context(legal, 0))).toEqual({ type: 'attack' })
    expect(POLICIES.random(context(legal, 0.99))).toEqual({ type: 'end_turn' })
  })

  it('recognises only registered policy names', () => {
    expect(isPolicyName('aggressive')).toBe(true)
    expect(isPolicyName('toString')).toBe(false)
  })
})
