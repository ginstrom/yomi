import { describe, expect, it } from 'vitest'
import type { Side } from '../src/engine/battleEngine.ts'
import { summarize, type LoggedEvent } from './simulate.ts'

function battle(battleId: number, rounds: number, winner: Side | null): LoggedEvent[] {
  return [
    {
      type: 'battle_start',
      battleId,
      seq: 0,
      round: 1,
      schemaVersion: 0,
      seed: null,
      meta: {},
      board: { cols: 1, rows: 1 },
      units: [],
    },
    {
      type: 'battle_end',
      battleId,
      seq: 1,
      round: rounds,
      winner,
      reason: winner ? 'defeat' : 'abandoned',
    },
  ]
}

describe('summarize', () => {
  it('averages rounds over decided battles only', () => {
    const events = [...battle(0, 3, 'player'), ...battle(1, 5, 'enemy'), ...battle(2, 200, null)]
    const summary = summarize(events, 3)
    expect(summary.playerWins).toBe(1)
    expect(summary.enemyWins).toBe(1)
    expect(summary.unresolved).toBe(1)
    expect(summary.avgRounds).toBe(4)
  })

  it('reports 0 average rounds when no battle was decided', () => {
    expect(summarize(battle(0, 200, null), 1).avgRounds).toBe(0)
  })
})
