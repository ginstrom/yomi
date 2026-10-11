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
  it('aggressive stops an archer as soon as its target is in range, then shoots', () => {
    const archer = { ...GOBLIN_STATS, attackApCost: 4, attackRange: 3 }
    const engine = new BattleEngine({
      board: { cols: 8, rows: 3 },
      units: [
        { id: 'p1', side: 'player', stats: archer, position: hex(0, 1) },
        { id: 'e1', side: 'enemy', stats: GOBLIN_STATS, position: hex(5, 1) },
      ],
    })
    expect(choose(engine)).toEqual({ type: 'move', unit: 'p1', to: hex(2, 1) })
    engine.step(choose(engine))
    expect(choose(engine)).toEqual(ATTACK_E1)
    engine.step(ATTACK_E1)
    // 2 AP left and the foe in range: it holds its ground rather than walking up.
    expect(choose(engine)).toEqual(END_TURN)
  })

  describe('aggressive with a caster', () => {
    // A wand that reaches 4 hexes for 5 AP, and Magic Arrow, which reaches 5 for 4 AP and 3 mana.
    const mage = (maxMana: number) => ({
      ...GOBLIN_STATS,
      attackApCost: 5,
      attackRange: 4,
      magic: { maxMana, skill: 70, spells: ['magic_arrow' as const] },
    })
    const facing = (maxMana: number, ...foes: Array<[id: string, at: Hex, hp?: number]>) =>
      new BattleEngine({
        board: { cols: 8, rows: 3 },
        units: [
          { id: 'p1', side: 'player', stats: mage(maxMana), position: hex(0, 1) },
          ...foes.map(([id, position, hp]) => ({ id, side: 'enemy' as const, stats: GOBLIN_STATS, position, hp })),
        ],
      })

    it('casts on the weakest foe in range before it would strike with its weapon', () => {
      const engine = facing(18, ['e1', hex(3, 1)], ['e2', hex(4, 1), 5], ['e3', hex(4, 0), 5])
      expect(engine.legalActions()).toContainEqual({ type: 'attack', unit: 'p1', target: 'e1' })
      expect(choose(engine)).toEqual({ type: 'cast', unit: 'p1', spell: 'magic_arrow', target: 'e2' })
    })

    it('stops at its spell’s range while it has the mana, and holds there', () => {
      const engine = facing(6, ['e1', hex(7, 1)])
      expect(choose(engine)).toEqual({ type: 'move', unit: 'p1', to: hex(2, 1) })
      engine.step(choose(engine))
      expect(choose(engine)).toEqual({ type: 'cast', unit: 'p1', spell: 'magic_arrow', target: 'e1' })
      engine.step(choose(engine))
      expect(choose(engine)).toEqual(END_TURN)
    })

    it('closes to its wand’s range once its mana is spent', () => {
      const engine = facing(2, ['e1', hex(7, 1)])
      expect(choose(engine)).toEqual({ type: 'move', unit: 'p1', to: hex(3, 1) })
      engine.step(choose(engine))
      expect(choose(engine)).toEqual(ATTACK_E1)
    })
  })

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
    const engine = engineWith(hex(0, 1), hex(4, 1))
    expect(choose(engine)).toEqual({ type: 'move', unit: 'p1', to: hex(3, 1) }) // 3 AP, 5 left
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
