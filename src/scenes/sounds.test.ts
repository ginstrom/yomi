import { describe, expect, it } from 'vitest'
import type { AbilityEvent, AttackEvent, BattleEndEvent, CastEvent, Side } from '../engine/battleEngine.ts'
import type { SpellId } from '../combat/spells.ts'
import { impactMs } from './battleEffects.ts'
import { STING_DELAY_MS, eventSounds } from './sounds.ts'

function attack(hit: boolean, critical = false): AttackEvent {
  return {
    type: 'attack', seq: 0, round: 1, attacker: 'goblin', defender: 'hero', opportunity: false,
    weapon: null, distance: 1, apCost: 2, apAfter: 0, toHit: 70, defenderAc: 15, defenderResistance: 0, armorPierce: 0,
    damageDice: { count: 1, sides: 6, bonus: 0 }, rolled: 3, defenderHpBefore: 10,
    flankers: [], flankBonus: 0, defenderTurned: false, defenderFacing: 0, arc: 'front', arcBonus: 0, attackerFacing: 3, helpless: false, image: false,
    attackRoll: 40, chance: 55, hit, critical, fumble: false, damage: hit ? 3 : 0, defenderHpAfter: 7,
  }
}

function cast(hit: boolean, critical = false, spell: SpellId = 'magic_arrow'): CastEvent {
  return {
    type: 'cast', seq: 0, round: 1, caster: 'hero', spell, target: 'goblin', at: { q: 4, r: 0 }, distance: 4,
    apCost: 4, apAfter: 4, manaCost: 3, manaAfter: 15, casterFacing: 0, skill: 76, drained: 0,
    outcomes: [
      {
        unit: 'goblin', attackRoll: 40, chance: 61, defenderAc: 15, hit, critical, fumble: false, image: false,
        damage: hit ? 5 : 0, warded: 0, half: false, healed: 0, hpBefore: 12, hpAfter: hit ? 7 : 12, status: null,
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
    expect(eventSounds(attack(true))).toEqual([swing, { key: 'sfx_hit_impact', delayMs: impactMs(attack(true)) }])
    expect(eventSounds(attack(true, true))).toEqual([swing, { key: 'sfx_crit_impact', delayMs: impactMs(attack(true, true)) }])
    expect(eventSounds(attack(false))).toEqual([swing, { key: 'sfx_miss', delayMs: impactMs(attack(false)) }])
  })

  it('sounds a spell, then how it lands', () => {
    const spell = { key: 'sfx_spell_cast', delayMs: 0 }
    expect(eventSounds(cast(true))).toEqual([spell, { key: 'sfx_hit_impact', delayMs: impactMs(cast(true)) }])
    expect(eventSounds(cast(true, true))).toEqual([spell, { key: 'sfx_crit_impact', delayMs: impactMs(cast(true, true)) }])
    expect(eventSounds(cast(false))).toEqual([spell, { key: 'sfx_miss', delayMs: impactMs(cast(false)) }])
    expect(eventSounds(cast(true, false, 'heal'))).toEqual([spell, { key: 'sfx_heal', delayMs: impactMs(cast(true, false, 'heal')) }])
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

describe('eventSounds for an area ability', () => {
  const ability = (hit: boolean, half: boolean, critical = false): AbilityEvent => ({
    type: 'ability', seq: 0, round: 1, unit: 'salamander', ability: 'fire_spit', at: { q: 2, r: 0 }, shape: 'cone',
    hexes: [], distance: 2, apCost: 4, apAfter: 4, facing: 0, skill: 70,
    outcomes: [
      {
        unit: 'hero', attackRoll: 40, chance: 61, defenderAc: 15, hit, critical, fumble: false, image: false,
        damage: hit ? 9 : half ? 4 : 0, warded: 0, half, healed: 0, hpBefore: 12, hpAfter: 5, status: null,
      },
    ],
  })

  it('casts, then lands as the best outcome does; a half-damage miss is still heard to strike', () => {
    const cue = { key: 'sfx_spell_cast', delayMs: 0 }
    expect(eventSounds(ability(true, false))).toEqual([cue, { key: 'sfx_hit_impact', delayMs: impactMs(ability(true, false)) }])
    expect(eventSounds(ability(true, false, true))[1].key).toBe('sfx_crit_impact')
    expect(eventSounds(ability(false, true))[1].key).toBe('sfx_hit_impact')
    expect(eventSounds(ability(false, false))[1].key).toBe('sfx_miss')
  })
})
