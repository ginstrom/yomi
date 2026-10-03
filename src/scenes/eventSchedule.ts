import type { BattleEvent, UnitId } from '../engine/battleEngine.ts'

/**
 * When the battle screen plays each engine event, kept free of Phaser so it
 * can be unit tested. Events play in log order: a move's walk takes time, and
 * a free attack holds the walk for a pause before the mover goes on.
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
}

/** Groups events into beats in increasing `at` order; `totalMs` is when the last one finishes. */
export function scheduleEvents(
  events: readonly BattleEvent[],
  timing: EventTiming,
): { beats: Beat[]; totalMs: number } {
  const beats: Beat[] = []
  let at = 0
  for (const event of events) {
    const last = beats[beats.length - 1]
    if (last?.at === at) last.cues.push({ kind: 'show', event })
    else beats.push({ at, cues: [{ kind: 'show', event }] })
    if (event.type === 'move') at += event.path.length * timing.moveStepMs
    if (event.type === 'attack' && event.opportunity) at += timing.opportunityPauseMs
  }
  return { beats, totalMs: at }
}
