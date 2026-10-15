import type { BattleEvent, UnitId } from '../engine/battleEngine.ts'

/**
 * When the battle screen plays each engine event, kept free of Phaser so it
 * can be unit tested. Events play in log order: a move's walk takes time, a
 * free attack holds the walk for a pause before the mover goes on, and each
 * status's damage at a turn's start is given a moment of its own.
 */
export type Cue =
  | { kind: 'show'; event: BattleEvent }
  | { kind: 'face'; unit: UnitId; facing: number }

/** Cues that fire together, `at` ms after the action. */
export interface Beat {
  at: number
  cues: Cue[]
}

export interface EventTiming {
  moveStepMs: number
  opportunityPauseMs: number
  /** After a status's damage at a turn's start, so that each lands on its own before the side acts. */
  tickPauseMs?: number
}

/** Groups events into beats in increasing `at` order; `totalMs` is when the last one finishes. */
export function scheduleEvents(
  events: readonly BattleEvent[],
  timing: EventTiming,
): { beats: Beat[]; totalMs: number } {
  const beats: Beat[] = []
  let at = 0
  let prior: BattleEvent | undefined
  for (const event of events) {
    const cues: Cue[] = []
    // A move cut short by what follows ends turned the way the engine judged it,
    // which is towards the step about to be taken.
    if (prior?.type === 'move') cues.push({ kind: 'face', unit: prior.unit, facing: prior.facing })
    cues.push({ kind: 'show', event })
    const last = beats[beats.length - 1]
    if (last?.at === at) last.cues.push(...cues)
    else beats.push({ at, cues })
    prior = event
    if (event.type === 'move') at += event.path.length * timing.moveStepMs
    if (event.type === 'attack' && event.opportunity) at += timing.opportunityPauseMs
    if (event.type === 'status_tick') at += timing.tickPauseMs ?? 0
  }
  return { beats, totalMs: at }
}
