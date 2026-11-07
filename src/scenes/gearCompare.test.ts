import { describe, expect, it } from 'vitest'
import { IRON_SWORD, OAK_SHIELD, YEW_BOW, itemById } from '../inventory/inventory.ts'
import { attacksPerTurn, compareLines, fieldCraftSummary, statLines, statSummary } from './gearCompare.ts'

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

  it('lists the field modifiers from the table', () => {
    expect(fieldCraftSummary()).toBe('In the field: Balanced and Recurve at grade I, a day each.')
  })

  it('tells the strength an item asks, and the shortfall of a known wearer', () => {
    const hammer = itemById('steel_war_hammer')!
    expect(statLines(hammer)).toContain('Strength: 6')
    expect(statLines(hammer, 8, 6)).toContain('Strength: 6')
    expect(statLines(hammer, 8, 9)).toContain('Strength: 6')
    expect(statLines(hammer, 8, 3)).toContain('Strength: 6 (you have 3): to hit −15%')
    expect(statSummary(hammer)).toContain('str 6')
  })

  it('shows weight, reach, ranged piercing and spell stats', () => {
    const plate = itemById('iron_plate')!
    expect(statLines(plate)).toEqual(expect.arrayContaining(['AP: −1', 'Spell Skill: −15%']))
    expect(statSummary(plate)).toBe('AC +6, resists 4, str 6, AP −1, spell −15%')
    const spear = itemById('iron_spear')!
    expect(statLines(spear)).toContain('Range: 2 hexes, reach')
    expect(statSummary(spear)).toContain('reach 2')
    expect(statLines(itemById('yew_crossbow')!)).toContain('Pierces: 2 resistance, even at range')
    const staff = itemById('ash_staff')!
    expect(statLines(staff)).toEqual(expect.arrayContaining(['Mana: +4', 'Spell Skill: +5%']))
    expect(statSummary(staff)).toContain('spell +5%, mana +4')
  })

  it('compares the strength a craft changes and leaves equal rows out', () => {
    const sword = itemById('steel_longsword')!
    const hammer = itemById('steel_war_hammer')!
    expect(compareLines(sword, hammer, 8, 3)).toContain('Strength: none → 6 (you have 3): to hit −15%')
    expect(compareLines(hammer, hammer, 8, 3)).toEqual([])
  })
})
