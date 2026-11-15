import { describe, expect, it } from 'vitest'
import type { AbilityEvent, AttackEvent, BattleEvent, CastEvent } from '../engine/battleEngine.ts'
import {
  ABILITY_LOOKS,
  bonusElement,
  bonusText,
  changesStatusMarks,
  AREA_SWEEP_MS,
  OUTLINE_CRITICAL,
  OUTLINE_HEALED,
  OUTLINE_HELPED,
  OUTLINE_HURT,
  OUTLINE_IMAGE,
  RELEASE_MS,
  SETTLE_MS,
  SWING_IMPACT_MS,
  SPELL_LOOKS,
  abilityLook,
  areaOutline,
  attackLook,
  attackerNotes,
  castOutline,
  defenderNotes,
  restoreFloats,
  flightMs,
  holdMs,
  impactMs,
  strikeFlash,
} from './battleEffects.ts'

/** An attack from `distance` hexes: a blow from the next hex, a shot from further, unless told. */
function attack(distance: number, melee = distance <= 1): AttackEvent {
  return {
    type: 'attack', seq: 0, round: 1, attacker: 'hero', defender: 'goblin', opportunity: false,
    weapon: null, distance, melee, apCost: 4, apAfter: 4, toHit: 70, defenderAc: 15, defenderResistance: 0, armorPierce: 0,
    damageDice: { count: 1, sides: 6, bonus: 0 }, rolled: 3, defenderHpBefore: 10,
    flankers: [], flankBonus: 0, defenderTurned: false, defenderFacing: 0, arc: 'front', arcBonus: 0, attackerFacing: 0, helpless: false, image: false,
    attackRoll: 40, chance: 55, hit: true, critical: false, fumble: false, damage: 3, defenderHpAfter: 7, bonus: [],
  }
}

function cast(distance: number): CastEvent {
  return {
    type: 'cast', seq: 0, round: 1, caster: 'hero', spell: 'shield', target: 'hero', at: { q: 0, r: 0 }, distance,
    apCost: 4, apAfter: 4, manaCost: 3, manaAfter: 15, casterFacing: 0, skill: 76, outcomes: [], drained: 0,
  }
}

function ability(shape: 'burst' | 'cone' | 'line', distance: number): AbilityEvent {
  return {
    type: 'ability', seq: 0, round: 1, unit: 'salamander', ability: 'fire_spit', at: { q: 2, r: 0 }, shape, hexes: [],
    distance, apCost: 4, apAfter: 4, facing: 0, skill: 70, outcomes: [],
  }
}

const struck = { hit: false, critical: false, image: false, half: false, damage: 0 }

describe('attackLook', () => {
  it('swings a blow and shoots an arrow or, from a wand, a bolt', () => {
    expect(attackLook(attack(1), 'sword')).toBe('swing')
    expect(attackLook(attack(1))).toBe('swing')
    expect(attackLook(attack(4), 'bow')).toBe('arrow')
    expect(attackLook(attack(4), 'bow_hawk')).toBe('arrow')
    expect(attackLook(attack(3), 'wand_storm')).toBe('bolt')
  })

  it('plays a technique’s strike with its weapon’s look, as a plain blow or shot', () => {
    expect(attackLook({ ...attack(1), ability: 'power_attack', strike: 'Power Attack' }, 'sword')).toBe('swing')
    expect(attackLook({ ...attack(4), ability: 'aimed_shot', strike: 'Aimed Shot' }, 'bow')).toBe('arrow')
    expect(attackLook({ ...attack(3), ability: 'venom_strike', strike: 'Venom Strike' }, 'wand')).toBe('bolt')
  })

  it('swings a reach weapon’s blow from two hexes, and shoots from the next hex', () => {
    expect(attackLook(attack(2, true), 'spear')).toBe('swing')
    expect(attackLook(attack(1, false), 'bow')).toBe('arrow')
    expect(attackLook(attack(1, false), 'wand')).toBe('bolt')
  })
})

describe('impactMs and holdMs', () => {
  it('lands a blow after the swing and a missile after its flight, further for further', () => {
    expect(impactMs(attack(1))).toBe(SWING_IMPACT_MS)
    expect(impactMs(attack(4))).toBe(RELEASE_MS + flightMs(4))
    expect(impactMs(attack(2, true))).toBe(SWING_IMPACT_MS)
    expect(impactMs(attack(1, false))).toBe(RELEASE_MS + flightMs(1))
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

describe('an area ability', () => {
  it('lands a burst aimed away after its missile flies, and a cone or line after a sweep', () => {
    expect(impactMs(ability('burst', 3))).toBe(RELEASE_MS + flightMs(3))
    expect(impactMs(ability('burst', 0))).toBe(RELEASE_MS)
    expect(impactMs(ability('cone', 2))).toBe(RELEASE_MS + AREA_SWEEP_MS)
    expect(impactMs(ability('line', 4))).toBe(RELEASE_MS + AREA_SWEEP_MS)
    expect(holdMs(ability('cone', 2))).toBe(RELEASE_MS + AREA_SWEEP_MS + SETTLE_MS)
  })

  it('has a look for each area ability, and a fallback', () => {
    expect(ABILITY_LOOKS.fire_spit?.impact).toBe('burst')
    expect(abilityLook('spider_web')).toBe(ABILITY_LOOKS.spider_web)
    expect(abilityLook('troll_claws').missile).toBe('orb')
  })

  it('has a look for each hero technique that is not a blow: Volley’s arrows, Consecrate’s gold burst, Taunt’s red ring on the user', () => {
    for (const id of ['volley', 'consecrate', 'taunt', 'hunters_mark', 'sprint'] as const) expect(ABILITY_LOOKS[id]).toBeDefined()
    expect(ABILITY_LOOKS.volley).toMatchObject({ arrows: true })
    expect(ABILITY_LOOKS.consecrate).toMatchObject({ impact: 'burst', colour: SPELL_LOOKS.bless.colour })
    expect(ABILITY_LOOKS.taunt).toMatchObject({ impact: 'ring', onUser: true })
    expect(ABILITY_LOOKS.sprint).toEqual(SPELL_LOOKS.haste)
  })

  it('outlines a hit, a critical, half damage and an image, and nothing for a clean miss', () => {
    expect(areaOutline({ ...struck, hit: true, damage: 9 })).toBe(OUTLINE_HURT)
    expect(areaOutline({ ...struck, hit: true, critical: true, damage: 9 })).toBe(OUTLINE_CRITICAL)
    expect(areaOutline({ ...struck, half: true, damage: 4 })).toBe(OUTLINE_HURT)
    expect(areaOutline(struck)).toBeNull()
    expect(areaOutline({ ...struck, hit: true, image: true })).toBe(OUTLINE_IMAGE)
  })
})

describe('an attack\'s on-hit damage', () => {
  const hit = (bonus: AttackEvent['bonus']): AttackEvent => ({ ...attack(1), hit: true, bonus })

  it('reads "+3 fire", several joined by a space, and nothing when none came through', () => {
    expect(bonusText(hit([{ element: 'fire', rolled: 3, damage: 3 }]))).toBe('+3 fire')
    expect(bonusText(hit([{ element: 'fire', rolled: 1, damage: 1 }, { element: 'blight', bane: true, rolled: 2, damage: 2 }]))).toBe('+1 fire +2 blight')
    expect(bonusText(hit([{ element: 'fire', rolled: 2, damage: 0 }]))).toBeNull()
    expect(bonusText(hit([{ element: 'fire', rolled: 2, damage: 0 }, { element: 'frost', rolled: 1, damage: 1 }]))).toBe('+1 frost')
    expect(bonusText(hit([{ rolled: 2, damage: 2 }]))).toBe('+2')
    expect(bonusText(hit([]))).toBeNull()
  })

  it('colours it by the first element that came through', () => {
    expect(bonusElement(hit([{ element: 'fire', rolled: 2, damage: 0 }, { element: 'frost', rolled: 1, damage: 1 }]))).toBe('frost')
    expect(bonusElement(hit([]))).toBeUndefined()
  })
})

describe('a technique strike\'s flash', () => {
  const strike = (ability: AttackEvent['ability'], extra: Partial<AttackEvent> = {}): AttackEvent => ({ ...attack(1), ability, strike: 'x', ...extra })

  it('lights an elemental strike that hits with its element\'s spell look, and Smite in gold', () => {
    expect(strikeFlash(strike('flame_strike'))).toBe(SPELL_LOOKS.fireball)
    expect(strikeFlash(strike('frost_strike'))).toBe(SPELL_LOOKS.frost_blast)
    expect(strikeFlash(strike('thunder_strike'))).toBe(SPELL_LOOKS.lightning_bolt)
    expect(strikeFlash(strike('smite'))).toBe(SPELL_LOOKS.bless)
  })

  it('shows nothing on a miss, an image, a plain blow or a strike without one', () => {
    expect(strikeFlash(strike('flame_strike', { hit: false }))).toBeNull()
    expect(strikeFlash(strike('flame_strike', { image: true }))).toBeNull()
    expect(strikeFlash(attack(1))).toBeNull()
    expect(strikeFlash(strike('power_attack'))).toBeNull()
  })
})

describe('the nameplates\' status letters', () => {
  it('are drawn again for a status laid by an attack, its own or a rune\'s', () => {
    const base = attack(1)
    expect(changesStatusMarks({ ...base, status: { id: 'webbed', turnsLeft: 2 } })).toBe(true)
    expect(changesStatusMarks({ ...base, onHitStatuses: [{ id: 'seared', turnsLeft: 1 }] })).toBe(true)
    expect(changesStatusMarks({ ...base, onHitStatuses: [] })).toBe(false)
    expect(changesStatusMarks(base)).toBe(false)
  })

  it('are drawn again after every cast, ability, status laid (Rooted), status\'s end or tick and fall, and not for a move', () => {
    for (const type of ['cast', 'ability', 'status_laid', 'restore', 'status_end', 'status_tick', 'unit_down'] as const) {
      expect(changesStatusMarks({ type } as BattleEvent)).toBe(true)
    }
    expect(changesStatusMarks({ type: 'move' } as BattleEvent)).toBe(false)
  })
})

describe('the stage-3 events', () => {
  const restore = (extra: object) => ({ type: 'restore', seq: 0, round: 1, unit: 'hero', cause: 'renewing', ...extra }) as Extract<BattleEvent, { type: 'restore' }>

  it('floats a restore\'s hit points as "+N" and its mana as "+N mana", one each', () => {
    expect(restoreFloats(restore({ hp: 3 }))).toEqual([{ text: '+3', kind: 'heal' }])
    expect(restoreFloats(restore({ mana: 2, cause: 'serenity' }))).toEqual([{ text: '+2 mana', kind: 'mana' }])
    expect(restoreFloats(restore({ hp: 3, mana: 2 }))).toHaveLength(2)
    expect(restoreFloats(restore({ hp: 0 }))).toEqual([])
  })

  it('notes an ambush and refunded AP over the attacker and a deathblow over the defender', () => {
    const base = attack(1)
    expect(attackerNotes(base)).toEqual([])
    expect(attackerNotes({ ...base, ambush: true, apRefunded: 4 })).toEqual([
      { text: 'Ambush', kind: 'note' },
      { text: '+4 AP', kind: 'note' },
    ])
    expect(defenderNotes(base)).toEqual([])
    expect(defenderNotes({ ...base, deathblow: true })).toEqual([{ text: 'Deathblow', kind: 'note' }])
  })

  it('gives each of the six special spells a look of its own, not its kin\'s', () => {
    const six = ['ice_lance', 'glacial_prison', 'purify', 'revive', 'renew', 'holy_light'] as const
    expect(new Set(six.map((id) => SPELL_LOOKS[id].colour)).size).toBe(6)
    for (const id of six) {
      expect(SPELL_LOOKS[id]).not.toBe(SPELL_LOOKS.heal)
      expect(SPELL_LOOKS[id]).not.toBe(SPELL_LOOKS.frost_blast)
    }
  })
})
