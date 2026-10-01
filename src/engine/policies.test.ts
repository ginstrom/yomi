import { describe, expect, it } from 'vitest'
import { GOBLIN_STATS } from '../combat/combat.ts'
import { hex, type Hex } from '../grid/hex.ts'
import { BattleEngine, type Action } from './battleEngine.ts'
import { POLICIES, isPolicyName, type PolicyContext } from './policies.ts'

function engineWith(playerAt: Hex, enemyAt: Hex): BattleEngine {
  return new BattleEngine({
    board: { cols: 8, rows: 3 },
    units: [
      { id: 'p1', side: 'player', stats: GOBLIN_STATS, position: playerAt },
      { id: 'e1', side: 'enemy', stats: GOBLIN_STATS, position: enemyAt },
    ],
  })
}

function context(legal: readonly Action[], rngValue = 0): PolicyContext {
  const engine = engineWith(hex(0, 1), hex(1, 1))
  return { state: engine.getState(), unit: 'p1', legal, rng: () => rngValue }
}

describe('policies', () => {
  it('aggressive attacks whenever attacking is legal', () => {
    expect(POLICIES.aggressive(context([{ type: 'end_turn' }, { type: 'attack', target: 'e1' }]))).toEqual({
      type: 'attack',
      target: 'e1',
    })
    expect(POLICIES.aggressive(context([{ type: 'end_turn' }]))).toEqual({ type: 'end_turn' })
  })

  it('aggressive closes the distance, then attacks', () => {
    const engine = engineWith(hex(0, 1), hex(6, 1))
    const choose = () =>
      POLICIES.aggressive({ state: engine.getState(), unit: 'p1', legal: engine.legalActions(), rng: () => 0 })

    const move = choose()
    expect(move).toEqual({ type: 'move', to: hex(4, 1) }) // full speed of 4, straight at the foe
    engine.step(move)
    expect(choose()).toEqual({ type: 'end_turn' }) // still 2 away, and already moved

    engine.step({ type: 'end_turn' })
    engine.step({ type: 'end_turn' }) // enemy holds
    engine.step(choose()) // moves next to the enemy
    expect(choose()).toEqual({ type: 'attack', target: 'e1' })
  })

  it('random picks among legal actions using the supplied rng', () => {
    const legal: Action[] = [{ type: 'attack', target: 'e1' }, { type: 'end_turn' }]
    expect(POLICIES.random(context(legal, 0))).toEqual({ type: 'attack', target: 'e1' })
    expect(POLICIES.random(context(legal, 0.99))).toEqual({ type: 'end_turn' })
  })

  it('recognises only registered policy names', () => {
    expect(isPolicyName('aggressive')).toBe(true)
    expect(isPolicyName('toString')).toBe(false)
  })
})
