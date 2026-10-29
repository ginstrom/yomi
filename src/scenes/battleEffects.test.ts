import { describe, expect, it } from 'vitest'
import type { AttackEvent, BattleEvent, CastEvent } from '../engine/battleEngine.ts'
import {
  OUTLINE_CRITICAL,
  OUTLINE_HEALED,
  OUTLINE_HELPED,
  OUTLINE_HURT,
  OUTLINE_IMAGE,
  RELEASE_MS,
  SETTLE_MS,
  SWING_IMPACT_MS,
  attackLook,
  castOutline,
  flightMs,
  holdMs,
  impactMs,
} from './battleEffects.ts'

function attack(distance: number): AttackEvent {
  return {
    type: 'attack', seq: 0, round: 1, attacker: 'hero', defender: 'goblin', opportunity: false,
    weapon: null, distance, apCost: 4, apAfter: 4, toHit: 70, defenderAc: 15, armorPierce: 0,
    damageDice: { count: 1, sides: 6, bonus: 0 }, defenderHpBefore: 10,
    flankers: [], flankBonus: 0, arc: 'front', arcBonus: 0, attackerFacing: 0, helpless: false, image: false,
    attackRoll: 40, chance: 55, hit: true, critical: false, fumble: false, damage: 3, defenderHpAfter: 7,
  }
}

function cast(distance: number): CastEvent {
  return {
    type: 'cast', seq: 0, round: 1, caster: 'hero', spell: 'shield', target: 'hero', at: { q: 0, r: 0 }, distance,
    apCost: 4, apAfter: 4, manaCost: 3, manaAfter: 15, casterFacing: 0, skill: 76, outcomes: [],
  }
}

describe('attackLook', () => {
  it('swings a blow and shoots an arrow or, from a wand, a bolt', () => {
    expect(attackLook(attack(1), 'sword')).toBe('swing')
    expect(attackLook(attack(1))).toBe('swing')
    expect(attackLook(attack(4), 'bow')).toBe('arrow')
    expect(attackLook(attack(4), 'bow_hawk')).toBe('arrow')
    expect(attackLook(attack(3), 'wand_storm')).toBe('bolt')
  })
})

describe('impactMs and holdMs', () => {
  it('lands a blow after the swing and a missile after its flight, further for further', () => {
    expect(impactMs(attack(1))).toBe(SWING_IMPACT_MS)
    expect(impactMs(attack(4))).toBe(RELEASE_MS + flightMs(4))
    expect(flightMs(5)).toBeGreaterThan(flightMs(2))
    expect(impactMs(cast(3))).toBe(RELEASE_MS + flightMs(3))
    expect(impactMs(cast(0))).toBe(RELEASE_MS)
  })

  it('holds what follows an attack or a cast until it settles, and nothing else', () => {
    expect(holdMs(attack(1))).toBe(SWING_IMPACT_MS + SETTLE_MS)
    const end: BattleEvent = { type: 'end_turn', seq: 0, round: 1, side: 'player', unspentAp: {} }
    expect(holdMs(end)).toBe(0)
  })
})

describe('castOutline', () => {
  it('outlines a hurt, a critical, a heal, a help or an image struck, and nothing for a miss', () => {
    expect(castOutline('magic_arrow', { hit: true })).toBe(OUTLINE_HURT)
    expect(castOutline('fireball', { hit: true, critical: true })).toBe(OUTLINE_CRITICAL)
    expect(castOutline('fireball', { hit: false })).toBeNull()
    expect(castOutline('fireball', { hit: true, image: true })).toBe(OUTLINE_IMAGE)
    expect(castOutline('heal', { hit: true })).toBe(OUTLINE_HEALED)
    expect(castOutline('bless', { hit: true })).toBe(OUTLINE_HELPED)
  })
})
