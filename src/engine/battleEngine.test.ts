import { describe, expect, it } from 'vitest'
import { GOBLIN_STATS, type CombatantStats } from '../combat/combat.ts'
import {
  BattleEngine,
  LOG_SCHEMA_VERSION,
  formatEvent,
  type Action,
  type AttackEvent,
  type BattleEndEvent,
  type BattleStartEvent,
} from './battleEngine.ts'

function sequence(values: number[]): () => number {
  let i = 0
  return () => values[Math.min(i++, values.length - 1)]
}

const WARRIOR_STATS: CombatantStats = {
  name: 'Warrior',
  maxHp: 20,
  ac: 15,
  attackBonus: 4,
  damage: { count: 1, sides: 8, bonus: 2 },
}

const STATS = { player: WARRIOR_STATS, enemy: GOBLIN_STATS }
const NAMES = { player: WARRIOR_STATS.name, enemy: GOBLIN_STATS.name }
const ATTACK: Action = { type: 'attack' }
const END_TURN: Action = { type: 'end_turn' }

describe('BattleEngine', () => {
  it('starts in the player phase and logs a self-describing battle_start event', () => {
    const engine = new BattleEngine(STATS, { seed: 42, meta: { source: 'test' } })
    const state = engine.getState()
    expect(state.phase).toBe('player')
    expect(state.round).toBe(1)
    expect(state.player.hp).toBe(WARRIOR_STATS.maxHp)
    expect(state.enemy.hp).toBe(GOBLIN_STATS.maxHp)

    expect(engine.getLog()).toHaveLength(1)
    const start = engine.getLog()[0] as BattleStartEvent
    expect(start).toMatchObject({
      type: 'battle_start',
      schemaVersion: LOG_SCHEMA_VERSION,
      seed: 42,
      meta: { source: 'test' },
      player: { ...WARRIOR_STATS, side: 'player', hp: WARRIOR_STATS.maxHp },
      enemy: { ...GOBLIN_STATS, side: 'enemy', hp: GOBLIN_STATS.maxHp },
    })
  })

  it('always records a seed unless the caller injects its own RNG', () => {
    const seeded = new BattleEngine(STATS).getLog()[0] as BattleStartEvent
    expect(Number.isInteger(seeded.seed)).toBe(true)
    const injected = new BattleEngine(STATS, { rng: Math.random }).getLog()[0] as BattleStartEvent
    expect(injected.seed).toBeNull()
  })

  it('can start a unit wounded, capped at maxHp', () => {
    const engine = new BattleEngine(STATS, { startHp: { player: 7, enemy: 999 } })
    expect(engine.getState().player.hp).toBe(7)
    expect(engine.getState().enemy.hp).toBe(GOBLIN_STATS.maxHp)
  })

  it('offers attack and end_turn while the battle is running', () => {
    const engine = new BattleEngine(STATS)
    expect(engine.legalActions()).toEqual([ATTACK, END_TURN])
  })

  it('moves to the enemy phase after a player attack that does not end the battle', () => {
    const rng = sequence([0 /* d20 -> 1, fumble */])
    const engine = new BattleEngine(STATS, { rng })
    const events = engine.step(ATTACK)
    expect(events).toHaveLength(1)
    const [attack] = events as [AttackEvent]
    expect(attack).toMatchObject({ type: 'attack', attacker: 'player', fumble: true, damage: 0 })
    expect(engine.getState().phase).toBe('enemy')
  })

  it('acts for whichever side holds the phase, advancing the round after the enemy', () => {
    const rng = sequence([0, 0])
    const engine = new BattleEngine(STATS, { rng })
    engine.step(ATTACK)
    const [enemyAttack] = engine.step(ATTACK) as [AttackEvent]
    expect(enemyAttack.attacker).toBe('enemy')
    const state = engine.getState()
    expect(state.phase).toBe('player')
    expect(state.round).toBe(2)
  })

  it('lets either side end its turn without attacking', () => {
    const engine = new BattleEngine(STATS)
    expect(engine.step(END_TURN)).toEqual([expect.objectContaining({ type: 'end_turn', side: 'player' })])
    expect(engine.getState().phase).toBe('enemy')
    expect(engine.step(END_TURN)).toEqual([expect.objectContaining({ type: 'end_turn', side: 'enemy' })])
    expect(engine.getState()).toMatchObject({ phase: 'player', round: 2 })
    expect(engine.getState().enemy.hp).toBe(GOBLIN_STATS.maxHp)
  })

  it('ends the battle and records a winner when the defender is reduced to 0 hp', () => {
    const rng = sequence([0.99 /* d20 -> 20, crit */, 0.99 /* damage dice -> max */])
    const engine = new BattleEngine(STATS, { rng })
    const events = engine.step(ATTACK)
    expect(events).toHaveLength(2)
    const battleEnd = events[1] as BattleEndEvent
    expect(battleEnd).toMatchObject({ type: 'battle_end', winner: 'player', reason: 'defeat' })

    const state = engine.getState()
    expect(state.phase).toBe('over')
    expect(state.winner).toBe('player')
    expect(state.enemy.hp).toBe(0)
    expect(engine.legalActions()).toEqual([])
    expect(() => engine.step(ATTACK)).toThrow(/over/)
  })

  it('logs an abandoned battle with no winner, once', () => {
    const engine = new BattleEngine(STATS)
    expect(engine.abandon()).toEqual([
      expect.objectContaining({ type: 'battle_end', winner: null, reason: 'abandoned' }),
    ])
    expect(engine.getState().phase).toBe('over')
    expect(engine.abandon()).toEqual([])
  })

  it('does not overwrite a finished battle when abandoned', () => {
    const engine = new BattleEngine(STATS, { rng: sequence([0.99, 0.99]) })
    engine.step(ATTACK)
    expect(engine.abandon()).toEqual([])
    expect(engine.getState().winner).toBe('player')
  })

  it('replays identically from the logged seed and actions', () => {
    const actions: Action[] = [ATTACK, ATTACK, END_TURN, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK]
    const play = (seed: number) => {
      const engine = new BattleEngine(STATS, { seed })
      for (const action of actions) if (engine.legalActions().length) engine.step(action)
      return engine.getLog()
    }
    expect(play(1234)).toEqual(play(1234))
    expect(play(1234)).not.toEqual(play(4321))
  })

  it('assigns a strictly increasing seq to every event in the log', () => {
    const engine = new BattleEngine(STATS, { rng: sequence([0, 0, 0, 0]) })
    engine.step(ATTACK)
    engine.step(ATTACK)
    engine.abandon()
    const seqs = engine.getLog().map((e) => e.seq)
    expect(seqs).toEqual([...seqs].sort((a, b) => a - b))
    expect(new Set(seqs).size).toBe(seqs.length)
  })
})

describe('formatEvent', () => {
  it('describes a fumble', () => {
    const engine = new BattleEngine(STATS, { rng: sequence([0]) })
    const [attack] = engine.step(ATTACK)
    expect(formatEvent(attack, NAMES)).toBe('Warrior rolls 1 — fumbles the attack!')
  })

  it('describes a critical hit', () => {
    const engine = new BattleEngine(STATS, { rng: sequence([0.99, 0.99]) })
    const [attack] = engine.step(ATTACK)
    expect(formatEvent(attack, NAMES)).toContain('CRITICAL HIT!')
    expect(formatEvent(attack, NAMES)).toContain('HITS Goblin')
  })

  it('describes battle_end from the winning side', () => {
    const engine = new BattleEngine(STATS, { rng: sequence([0.99, 0.99]) })
    const events = engine.step(ATTACK)
    expect(formatEvent(events[events.length - 1], NAMES)).toBe('Goblin falls. Victory!')
  })

  it('describes an abandoned battle', () => {
    const [end] = new BattleEngine(STATS).abandon()
    expect(formatEvent(end, NAMES)).toBe('The battle is abandoned.')
  })
})
