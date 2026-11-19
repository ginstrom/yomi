import { describe, expect, it } from 'vitest'
import { mulberry32 } from '../combat/rng.ts'
import { ENCOUNTERS } from '../game/encounters.ts'
import { partyFighters, readyMadeParty } from '../game/party.ts'
import { BattleEngine, type BattleEvent, type BattleSetup, type Side } from './battleEngine.ts'
import { AUTO_POLICY, AUTO_ROUND_LIMIT, ENEMY_POLICY, playOut, playStep, type PlayOutOptions } from './autoPlay.ts'
import { POLICIES } from './policies.ts'

const SEED = 7

function raidSetup(): BattleSetup {
  return ENCOUNTERS.goblin_raid(partyFighters(readyMadeParty()), 1).setup
}

function newEngine(setup = raidSetup(), seed = SEED): BattleEngine {
  return new BattleEngine(setup, { seed, meta: { source: 'test' } })
}

/** Options with a stream per side, seeded as the game seeds them. */
function options(lastRound = AUTO_ROUND_LIMIT, seed = SEED): PlayOutOptions {
  return {
    policies: { player: AUTO_POLICY, enemy: ENEMY_POLICY },
    rngs: { enemy: mulberry32(seed + 1), player: mulberry32(seed + 2) },
    lastRound,
  }
}

describe('autoPlay', () => {
  it('names the game policies and the round limit', () => {
    expect(AUTO_POLICY).toBe('aggressive')
    expect(ENEMY_POLICY).toBe('aggressive')
    expect(AUTO_ROUND_LIMIT).toBe(50)
  })

  it('plays a battle to its end, the events ending with battle_end', () => {
    const engine = newEngine()
    const { events, over } = playOut(engine, options())
    expect(over).toBe(true)
    expect(events.at(-1)?.type).toBe('battle_end')
    expect(engine.getState().phase).toBe('over')
  })

  it('gives the events a hand-stepped loop gives, and the tail of the log', () => {
    const engine = newEngine()
    const opts = options()
    const { events } = playOut(engine, opts)

    const byHand = newEngine()
    const rngs = options().rngs
    const expected: BattleEvent[] = []
    for (let state = byHand.getState(); state.phase !== 'over'; state = byHand.getState()) {
      const policy = POLICIES[state.phase === 'player' ? AUTO_POLICY : ENEMY_POLICY]
      expected.push(...byHand.step(policy({ state, legal: byHand.legalActions(), rng: rngs[state.phase] })))
    }
    expect(events).toEqual(expected)
    expect(engine.getLog().slice(-events.length)).toEqual(events)
    expect(engine.getLog()).toEqual(byHand.getLog())
  })

  it('gives the same log from the same seed', () => {
    const a = newEngine()
    const b = newEngine()
    playOut(a, options())
    playOut(b, options())
    expect(a.getLog()).toEqual(b.getLog())
  })

  it('playStep until false gives the log playOut gives', () => {
    const a = newEngine()
    const opts = options()
    let steps = 0
    while (playStep(a, opts)) steps++
    expect(steps).toBeGreaterThan(0)
    const b = newEngine()
    playOut(b, options())
    expect(a.getLog()).toEqual(b.getLog())
    expect(playStep(a, opts)).toBe(false)
  })

  it('carries on from a restored snapshot as the uninterrupted battle did', () => {
    const whole = newEngine()
    const wholeOpts = options()
    const first = newEngine()
    const firstOpts = options()
    for (let i = 0; i < 6; i++) {
      playStep(whole, wholeOpts)
      playStep(first, firstOpts)
    }
    // The resumed battle's streams are in the state the uninterrupted run's are in at that point.
    const resumed = BattleEngine.restore(first.snapshot())
    const rest = playOut(whole, wholeOpts)
    const resumedRest = playOut(resumed, firstOpts)
    expect(resumedRest.events).toEqual(rest.events)
    expect(resumedRest.over).toBe(true)
  })

  it('takes no step once the round is past lastRound', () => {
    const engine = newEngine()
    const before = engine.getLog().length
    expect(playStep(engine, options(0))).toBe(false)
    expect(engine.getLog().length).toBe(before)
    const { events, over } = playOut(engine, options(0))
    expect(events).toEqual([])
    expect(over).toBe(false)
  })

  it('stops unfinished past lastRound without abandoning the battle', () => {
    const engine = newEngine()
    const { over } = playOut(engine, options(1))
    const state = engine.getState()
    expect(over).toBe(false)
    expect(state.round).toBeGreaterThan(1)
    expect(state.phase).not.toBe('over')
    expect(state.winner).toBeNull()
    expect(engine.getLog().some((e) => e.type === 'battle_end')).toBe(false)
  })

  it('returns at once for a battle already over', () => {
    const setup = raidSetup()
    const down: BattleSetup = { ...setup, units: setup.units.map((u) => (u.side === 'player' ? { ...u, hp: 0 } : u)) }
    const engine = newEngine(down)
    expect(engine.getState().phase).toBe('over')
    const out = playOut(engine, options())
    expect(out).toEqual({ events: [], over: true })
  })

  it('hands each policy its own side stream', () => {
    for (const drawer of ['player', 'enemy'] as const) {
      const idle: Side = drawer === 'player' ? 'enemy' : 'player'
      const draws: Record<Side, number> = { player: 0, enemy: 0 }
      const counting = (side: Side) => () => {
        draws[side]++
        return 0.5
      }
      // 'random' draws from its stream and 'aggressive' does not, so only the drawing side's stream moves.
      const policies = { [drawer]: 'random', [idle]: 'aggressive' } as Record<Side, 'random' | 'aggressive'>
      playOut(newEngine(), { policies, rngs: { player: counting('player'), enemy: counting('enemy') }, lastRound: 3 })
      expect(draws[drawer]).toBeGreaterThan(0)
      expect(draws[idle]).toBe(0)
    }
  })
})
