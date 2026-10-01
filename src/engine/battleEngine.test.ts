import { describe, expect, it } from 'vitest'
import { GOBLIN_STATS, WARRIOR_STATS } from '../combat/combat.ts'
import { BattleEngine, formatEvent, type AttackEvent, type BattleEndEvent } from './battleEngine.ts'

function sequence(values: number[]): () => number {
  let i = 0
  return () => values[Math.min(i++, values.length - 1)]
}

const STATS = { player: WARRIOR_STATS, enemy: GOBLIN_STATS }
const NAMES = { player: WARRIOR_STATS.name, enemy: GOBLIN_STATS.name }

describe('BattleEngine', () => {
  it('starts in the player phase and logs a battle_start event', () => {
    const engine = new BattleEngine(STATS)
    const state = engine.getState()
    expect(state.phase).toBe('player')
    expect(state.round).toBe(1)
    expect(state.player.hp).toBe(WARRIOR_STATS.maxHp)
    expect(state.enemy.hp).toBe(GOBLIN_STATS.maxHp)
    expect(engine.getLog()).toHaveLength(1)
    expect(engine.getLog()[0].type).toBe('battle_start')
  })

  it('ignores actions that do not match the current phase', () => {
    const engine = new BattleEngine(STATS)
    expect(engine.enemyTurn()).toEqual([])
    expect(engine.getState().round).toBe(1)
    expect(engine.getState().phase).toBe('player')
  })

  it('moves to the enemy phase after a player attack that does not end the battle', () => {
    const rng = sequence([0 /* d20 -> 1, fumble */])
    const engine = new BattleEngine(STATS, rng)
    const events = engine.playerAttack()
    expect(events).toHaveLength(1)
    const [attack] = events as [AttackEvent]
    expect(attack.type).toBe('attack')
    expect(attack.fumble).toBe(true)
    expect(attack.damage).toBe(0)
    expect(engine.getState().phase).toBe('enemy')
  })

  it('advances the round and returns to the player phase after a resolved enemy turn', () => {
    const rng = sequence([0, 0])
    const engine = new BattleEngine(STATS, rng)
    engine.playerAttack()
    engine.enemyTurn()
    const state = engine.getState()
    expect(state.phase).toBe('player')
    expect(state.round).toBe(2)
  })

  it('ends the battle and records a winner when the defender is reduced to 0 hp', () => {
    const rng = sequence([0.99 /* d20 -> 20, crit */, 0.99 /* damage die -> max */])
    const engine = new BattleEngine(STATS, rng)
    const events = engine.playerAttack()
    expect(events).toHaveLength(2)
    const battleEnd = events[1] as BattleEndEvent
    expect(battleEnd.type).toBe('battle_end')
    expect(battleEnd.winner).toBe('player')

    const state = engine.getState()
    expect(state.phase).toBe('over')
    expect(state.winner).toBe('player')
    expect(state.enemy.hp).toBe(0)
  })

  it('records an end_turn event and skips straight to the enemy phase', () => {
    const engine = new BattleEngine(STATS)
    const events = engine.playerEndTurn()
    expect(events).toEqual([expect.objectContaining({ type: 'end_turn', side: 'player' })])
    expect(engine.getState().phase).toBe('enemy')
    expect(engine.getState().enemy.hp).toBe(GOBLIN_STATS.maxHp)
  })

  it('assigns a strictly increasing seq to every event in the log', () => {
    const rng = sequence([0, 0, 0, 0])
    const engine = new BattleEngine(STATS, rng)
    engine.playerAttack()
    engine.enemyTurn()
    const seqs = engine.getLog().map((e) => e.seq)
    expect(seqs).toEqual([...seqs].sort((a, b) => a - b))
    expect(new Set(seqs).size).toBe(seqs.length)
  })
})

describe('formatEvent', () => {
  it('describes a fumble', () => {
    const rng = sequence([0])
    const engine = new BattleEngine(STATS, rng)
    const [attack] = engine.playerAttack()
    expect(formatEvent(attack, NAMES)).toBe('Warrior rolls 1 — fumbles the attack!')
  })

  it('describes a critical hit', () => {
    const rng = sequence([0.99, 0.99])
    const engine = new BattleEngine(STATS, rng)
    const [attack] = engine.playerAttack()
    expect(formatEvent(attack, NAMES)).toContain('CRITICAL HIT!')
    expect(formatEvent(attack, NAMES)).toContain('HITS Goblin')
  })

  it('describes battle_end from the winning side', () => {
    const rng = sequence([0.99, 0.99])
    const engine = new BattleEngine(STATS, rng)
    const events = engine.playerAttack()
    const battleEnd = events[events.length - 1]
    expect(formatEvent(battleEnd, NAMES)).toBe('Goblin falls. Victory!')
  })
})
