import { describe, expect, it } from 'vitest'
import { IRON_SWORD, OAK_SHIELD, YEW_BOW, itemById } from '../inventory/inventory.ts'
import { attacksPerTurn, compareLines, statLines, statSummary } from './gearCompare.ts'

describe('gear comparisons', () => {
  it('counts the attacks a turn an item gives', () => {
    expect(attacksPerTurn(IRON_SWORD.stats, 8)).toBe(1)
    expect(attacksPerTurn(YEW_BOW.stats, 8)).toBe(2)
    expect(attacksPerTurn(OAK_SHIELD.stats, 8)).toBeNull()
  })

  it('says a Light longsword strikes twice a turn where the plain one strikes once', () => {
    const lines = compareLines(IRON_SWORD, itemById('iron_sword+light1')!)
    expect(lines).toContain('Damage: 1d8+3 → 1d8')
    expect(lines).toContain('Attack: 5 AP, 1 attack a turn → 4 AP, 2 attacks a turn')
    expect(lines).toHaveLength(2)
  })

  it('names what a modifier adds and takes', () => {
    expect(compareLines(OAK_SHIELD, itemById('oak_shield+braced1')!)).toEqual(['Armor Class: +10 → +13', 'To Hit: none → −5%'])
    expect(statLines(IRON_SWORD)).toEqual(['Damage: 1d8+3', 'Attack: 5 AP, 1 attack a turn', 'Range: 1 hex', 'Pierces: 1 resistance'])
    expect(statSummary(itemById('yew_bow@3')!)).toBe('1d6+2, 4 AP, range 5, hit +5%')
  })
})
