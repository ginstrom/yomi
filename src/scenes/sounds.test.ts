import { describe, expect, it } from 'vitest'
import type { AttackEvent, BattleEndEvent, Side } from '../engine/battleEngine.ts'
import { IMPACT_DELAY_MS, STING_DELAY_MS, eventSounds } from './sounds.ts'

function attack(hit: boolean, critical = false): AttackEvent {
  return {
    type: 'attack', seq: 0, round: 1, attacker: 'goblin', defender: 'hero', opportunity: false,
    weapon: null, distance: 1, apCost: 2, apAfter: 0, attackBonus: 2, defenderAc: 12,
    damageDice: { count: 1, sides: 6, bonus: 0 }, defenderHpBefore: 10,
    flankers: [], flankBonus: 0, arc: 'front', arcBonus: 0, attackerFacing: 3,
    attackRoll: 10, totalToHit: 12, hit, critical, fumble: false, damage: hit ? 3 : 0, defenderHpAfter: 7,
  }
}

function battleEnd(winner: Side | null): BattleEndEvent {
  return { type: 'battle_end', seq: 0, round: 3, winner, reason: winner ? 'defeat' : 'abandoned', survivors: {} }
}

describe('eventSounds', () => {
  it('swings, then lands a hit, a critical or a miss', () => {
    const swing = { key: 'sfx_melee_swing', delayMs: 0 }
    expect(eventSounds(attack(true))).toEqual([swing, { key: 'sfx_hit_impact', delayMs: IMPACT_DELAY_MS }])
    expect(eventSounds(attack(true, true))).toEqual([swing, { key: 'sfx_crit_impact', delayMs: IMPACT_DELAY_MS }])
    expect(eventSounds(attack(false))).toEqual([swing, { key: 'sfx_miss', delayMs: IMPACT_DELAY_MS }])
  })

  it('marks a fallen unit', () => {
    expect(eventSounds({ type: 'unit_down', seq: 0, round: 1, unit: 'goblin' })).toEqual([
      { key: 'sfx_unit_death', delayMs: 0 },
    ])
  })

  it('plays a sting for victory or defeat, and nothing for an abandoned battle', () => {
    expect(eventSounds(battleEnd('player'))).toEqual([{ key: 'music_victory', delayMs: STING_DELAY_MS }])
    expect(eventSounds(battleEnd('enemy'))).toEqual([{ key: 'music_defeat', delayMs: STING_DELAY_MS }])
    expect(eventSounds(battleEnd(null))).toEqual([])
  })

  it('stays quiet for moves and turn changes', () => {
    expect(eventSounds({ type: 'end_turn', seq: 0, round: 1, side: 'player', unspentAp: {} })).toEqual([])
  })
})
