import type { RNG } from '../combat/combat.ts'
import type { BattleEngine, BattleEvent, Side } from './battleEngine.ts'
import { POLICIES, type PolicyName } from './policies.ts'

/** The policy the player's side is played by when a battle is auto-resolved. */
export const AUTO_POLICY: PolicyName = 'aggressive'
/** The policy the game's enemy plays. */
export const ENEMY_POLICY: PolicyName = 'aggressive'
/** Rounds auto-resolve plays before handing an unfinished battle back to the player. */
export const AUTO_ROUND_LIMIT = 50

export interface PlayOutOptions {
  policies: Record<Side, PolicyName>
  /** Each side's policy stream; the simulator passes one stream for both. */
  rngs: Record<Side, RNG>
  /** No step is taken once the round is past this one. */
  lastRound: number
}
export interface PlayOut {
  /** Every event the steps produced, in order. */
  events: BattleEvent[]
  /** True when the battle ended; false when it stopped past `lastRound`. */
  over: boolean
}

/** One step's events, or null when no step is due. */
function stepOnce(engine: BattleEngine, { policies, rngs, lastRound }: PlayOutOptions): BattleEvent[] | null {
  const state = engine.getState()
  if (state.phase === 'over' || state.round > lastRound) return null
  return engine.step(POLICIES[policies[state.phase]]({ state, legal: engine.legalActions(), rng: rngs[state.phase] }))
}

/**
 * One step: false (and nothing done) when the phase is 'over' or the round is
 * past `lastRound`; else steps the side's policy and returns true. Never
 * abandons, and draws nothing itself: only the policy draws, from its side's stream.
 */
export function playStep(engine: BattleEngine, options: PlayOutOptions): boolean {
  return stepOnce(engine, options) !== null
}

/** Steps `engine` with each side's policy until the battle is over or the round passes `lastRound`. */
export function playOut(engine: BattleEngine, options: PlayOutOptions): PlayOut {
  const events: BattleEvent[] = []
  for (let step = stepOnce(engine, options); step !== null; step = stepOnce(engine, options)) events.push(...step)
  return { events, over: engine.getState().phase === 'over' }
}

/** The `lastRound` that plays AUTO_ROUND_LIMIT rounds from `startRound`, it included. */
export function autoLastRound(startRound: number): number {
  return startRound + AUTO_ROUND_LIMIT - 1
}
