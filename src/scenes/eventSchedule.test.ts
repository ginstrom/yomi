import { describe, expect, it } from 'vitest'
import type { AttackEvent, BattleEvent, EndTurnEvent, MoveEvent } from '../engine/battleEngine.ts'
import type { Hex } from '../grid/hex.ts'
import { scheduleEvents } from './eventSchedule.ts'

const TIMING = { moveStepMs: 140, opportunityPauseMs: 450 }

let seq = 0

function hexes(...qs: number[]): Hex[] {
  return qs.map((q) => ({ q, r: 0 }))
}

function move(from: number, ...steps: number[]): MoveEvent {
  const path = hexes(...steps)
  const to = path.length > 0 ? path[path.length - 1] : { q: from, r: 0 }
  return {
    type: 'move', seq: seq++, round: 1, unit: 'hero', from: { q: from, r: 0 }, to, path,
    destination: { q: 9, r: 0 }, apCost: 0, apAfter: 0, facing: 0,
  }
}

function attack(opportunity: boolean): AttackEvent {
  return {
    type: 'attack', seq: seq++, round: 1, attacker: 'goblin', defender: 'hero', opportunity,
    weapon: null, distance: 1, apCost: 0, apAfter: 0, toHit: 70, defenderAc: 15, armorPierce: 0,
    damageDice: { count: 1, sides: 6, bonus: 0 }, defenderHpBefore: 10,
    flankers: [], flankBonus: 0, arc: 'front', arcBonus: 0, attackerFacing: 3,
    attackRoll: 40, chance: 55, hit: true, critical: false, fumble: false, damage: 3, defenderHpAfter: 7,
  }
}

function endTurn(): EndTurnEvent {
  return { type: 'end_turn', seq: seq++, round: 1, side: 'player', unspentAp: {} }
}

const show = (event: BattleEvent) => ({ kind: 'show', event })
const face = (facing: number) => ({ kind: 'face', unit: 'hero', facing })

describe('scheduleEvents', () => {
  it('shows a plain move at once and waits for its walk', () => {
    const walk = move(0, 1, 2, 3)
    expect(scheduleEvents([walk], TIMING)).toEqual({
      beats: [{ at: 0, cues: [show(walk)] }],
      totalMs: 3 * 140,
    })
  })

  it('pauses the walk where a free attack lands', () => {
    const first = move(0, 1, 2)
    const strike = attack(true)
    const rest = move(2, 3, 4, 5)
    expect(scheduleEvents([first, strike, rest], TIMING)).toEqual({
      beats: [
        { at: 0, cues: [show(first)] },
        { at: 2 * 140, cues: [face(0), show(strike)] },
        { at: 2 * 140 + 450, cues: [show(rest)] },
      ],
      totalMs: 5 * 140 + 450,
    })
  })

  it('shares a beat between an empty move and the attack that strikes before its first step', () => {
    const still = move(0)
    const strike = attack(true)
    expect(scheduleEvents([still, strike], TIMING)).toEqual({
      beats: [{ at: 0, cues: [show(still), face(0), show(strike)] }],
      totalMs: 450,
    })
  })

  it('turns the mover before each free attack that interrupts it', () => {
    const still = { ...move(1), facing: 3 }
    const first = attack(true)
    const step = { ...move(1, 0), facing: 4 }
    const second = attack(true)
    const last = { ...move(0, -1), facing: 4 }
    expect(scheduleEvents([still, first, step, second, last], TIMING)).toEqual({
      beats: [
        { at: 0, cues: [show(still), face(3), show(first)] },
        { at: 450, cues: [show(step)] },
        { at: 590, cues: [face(4), show(second)] },
        { at: 1040, cues: [show(last)] },
      ],
      totalMs: 2 * 140 + 2 * 450,
    })
  })

  it('takes no time for an ordinary attack or the end of a turn', () => {
    const strike = attack(false)
    const end = endTurn()
    expect(scheduleEvents([strike, end], TIMING)).toEqual({
      beats: [{ at: 0, cues: [show(strike), show(end)] }],
      totalMs: 0,
    })
  })
})
