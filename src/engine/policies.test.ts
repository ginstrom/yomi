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
  return { state: engine.getState(), legal, rng: () => rngValue }
}

const choose = (engine: BattleEngine) =>
  POLICIES.aggressive({ state: engine.getState(), legal: engine.legalActions(), rng: () => 0 })

const ATTACK_E1: Action = { type: 'attack', unit: 'p1', target: 'e1' }
const END_TURN: Action = { type: 'end_turn' }

describe('policies', () => {
  it('aggressive attacks whenever attacking is legal, and otherwise ends the turn', () => {
    expect(POLICIES.aggressive(context([END_TURN, ATTACK_E1]))).toEqual(ATTACK_E1)
    expect(POLICIES.aggressive(context([END_TURN]))).toEqual(END_TURN)
  })

  it('aggressive attacks the foe it flanks most', () => {
    // p1 at (1,1) touches both e2 (2,0) and e1 (2,1); p3 at (3,1) touches e1
    // alone, so e1 is flanked though e2 comes first in the legal actions.
    const engine = new BattleEngine({
      board: { cols: 8, rows: 3 },
      units: [
        { id: 'p1', side: 'player', stats: GOBLIN_STATS, position: hex(1, 1) },
        { id: 'p3', side: 'player', stats: GOBLIN_STATS, position: hex(3, 1) },
        { id: 'e2', side: 'enemy', stats: GOBLIN_STATS, position: hex(2, 0) },
        { id: 'e1', side: 'enemy', stats: GOBLIN_STATS, position: hex(2, 1) },
      ],
    })
    expect(engine.legalActions('p1').filter((a) => a.type === 'attack')).toEqual([
      { type: 'attack', unit: 'p1', target: 'e2' },
      ATTACK_E1,
    ])
    expect(choose(engine)).toEqual(ATTACK_E1)
  })

  it('aggressive attacks a foe from behind before one it faces', () => {
    // Both touch p1 at (1,1); e1 at (2,1) faces west towards it, e2 at (2,0) faces away.
    const engine = new BattleEngine({
      board: { cols: 8, rows: 3 },
      units: [
        { id: 'p1', side: 'player', stats: GOBLIN_STATS, position: hex(1, 1) },
        { id: 'e1', side: 'enemy', stats: GOBLIN_STATS, position: hex(2, 1) },
        { id: 'e2', side: 'enemy', stats: GOBLIN_STATS, position: hex(2, 0), facing: 1 },
      ],
    })
    expect(choose(engine)).toEqual({ type: 'attack', unit: 'p1', target: 'e2' })
  })

  it('aggressive closes the distance, ends its turn when spent, and attacks next turn', () => {
    const engine = engineWith(hex(0, 1), hex(6, 1))
    // Speed 4, 3 AP: reaching the foe takes 2 AP, leaving too few to strike.
    expect(choose(engine)).toEqual({ type: 'move', unit: 'p1', to: hex(5, 1) })
    engine.step(choose(engine))
    expect(choose(engine)).toEqual(END_TURN)
    engine.step(END_TURN)
    expect(choose(engine)).toEqual({ type: 'attack', unit: 'e1', target: 'p1' })
  })

  it('aggressive prefers a hex it can still strike from', () => {
    const engine = engineWith(hex(0, 1), hex(5, 1))
    expect(choose(engine)).toEqual({ type: 'move', unit: 'p1', to: hex(4, 1) }) // 1 AP, 2 left
    engine.step(choose(engine))
    expect(choose(engine)).toEqual(ATTACK_E1)
  })

  it('random picks among legal actions using the supplied rng', () => {
    const legal: Action[] = [ATTACK_E1, END_TURN]
    expect(POLICIES.random(context(legal, 0))).toEqual(ATTACK_E1)
    expect(POLICIES.random(context(legal, 0.99))).toEqual(END_TURN)
  })

  it('recognises only registered policy names', () => {
    expect(isPolicyName('aggressive')).toBe(true)
    expect(isPolicyName('toString')).toBe(false)
  })
})
