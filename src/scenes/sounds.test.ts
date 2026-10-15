import { describe, expect, it } from 'vitest'
import type { AttackEvent, BattleEndEvent, CastEvent, Side } from '../engine/battleEngine.ts'
import type { SpellId } from '../combat/spells.ts'
import { IMPACT_DELAY_MS, STING_DELAY_MS, eventSounds } from './sounds.ts'

function attack(hit: boolean, critical = false): AttackEvent {
  return {
    type: 'attack', seq: 0, round: 1, attacker: 'goblin', defender: 'hero', opportunity: false,
    weapon: null, distance: 1, apCost: 2, apAfter: 0, toHit: 70, defenderAc: 15, armorPierce: 0,
    damageDice: { count: 1, sides: 6, bonus: 0 }, defenderHpBefore: 10,
    flankers: [], flankBonus: 0, arc: 'front', arcBonus: 0, attackerFacing: 3, helpless: false, image: false,
    attackRoll: 40, chance: 55, hit, critical, fumble: false, damage: hit ? 3 : 0, defenderHpAfter: 7,
  }
}

function cast(hit: boolean, critical = false, spell: SpellId = 'magic_arrow'): CastEvent {
  return {
    type: 'cast', seq: 0, round: 1, caster: 'hero', spell, target: 'goblin', at: { q: 4, r: 0 }, distance: 4,
    apCost: 4, apAfter: 4, manaCost: 3, manaAfter: 15, casterFacing: 0, skill: 76,
    outcomes: [
      {
        unit: 'goblin', attackRoll: 40, chance: 61, defenderAc: 15, hit, critical, fumble: false, image: false,
        damage: hit ? 5 : 0, healed: 0, hpBefore: 12, hpAfter: hit ? 7 : 12, status: null,
      },
    ],
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

  it('sounds a spell, then how it lands', () => {
    const spell = { key: 'sfx_spell_cast', delayMs: 0 }
    expect(eventSounds(cast(true))).toEqual([spell, { key: 'sfx_hit_impact', delayMs: IMPACT_DELAY_MS }])
    expect(eventSounds(cast(true, true))).toEqual([spell, { key: 'sfx_crit_impact', delayMs: IMPACT_DELAY_MS }])
    expect(eventSounds(cast(false))).toEqual([spell, { key: 'sfx_miss', delayMs: IMPACT_DELAY_MS }])
    expect(eventSounds(cast(true, false, 'heal'))).toEqual([spell, { key: 'sfx_heal', delayMs: IMPACT_DELAY_MS }])
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
