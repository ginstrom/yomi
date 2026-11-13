import { describe, expect, it } from 'vitest'
import { GOBLIN_STATS } from '../combat/combat.ts'
import { BattleEngine } from '../engine/battleEngine.ts'
import { hex } from '../grid/hex.ts'
import { describeStatuses, spellMenuRows, targetingHint } from './spellMenu.ts'

describe('spellMenuRows', () => {
  it('lists every spell the unit knows, enabled when a cast of it is legal now', () => {
    const mage = { ...GOBLIN_STATS, name: 'Mage', magic: { maxMana: 5, skill: 60, spells: ['magic_arrow' as const, 'fireball' as const, 'heal' as const] } }
    const engine = new BattleEngine({
      board: { cols: 8, rows: 3 },
      units: [
        { id: 'mage', side: 'player', stats: mage, position: hex(0, 1) },
        { id: 'goblin', side: 'enemy', stats: GOBLIN_STATS, position: hex(4, 1) },
      ],
    })
    const unit = engine.getState().units[0]
    expect(spellMenuRows(unit, engine.legalActions())).toEqual([
      { spell: 'magic_arrow', label: 'Magic Arrow  3 mana  4 AP', enabled: true },
      // Too dear for 5 mana.
      { spell: 'fireball', label: 'Fireball  10 mana  6 AP', enabled: false },
      { spell: 'heal', label: 'Heal  3 mana  4 AP', enabled: true },
    ])
    expect(spellMenuRows(engine.getState().units[1], engine.legalActions())).toEqual([])
  })
})

describe('targetingHint', () => {
  it('asks for what the spell is aimed at', () => {
    expect(targetingHint('fireball')).toBe('Fireball: choose where (10 mana, 6 AP). Esc or Cancel to go back.')
    expect(targetingHint('heal')).toBe('Heal: choose an ally (3 mana, 4 AP). Esc or Cancel to go back.')
    expect(targetingHint('bless')).toBe('Bless: click the caster (4 mana, 4 AP). Esc or Cancel to go back.')
    expect(targetingHint('sleep')).toBe('Sleep: choose a foe (5 mana, 4 AP). Esc or Cancel to go back.')
  })
})

describe('describeStatuses', () => {
  it('names each status and its turns left', () => {
    expect(describeStatuses([{ id: 'blessed', turnsLeft: 2 }, { id: 'shielded', turnsLeft: 1 }])).toBe('Blessed 2, Shielded 1')
    expect(describeStatuses([])).toBe('')
  })
})
