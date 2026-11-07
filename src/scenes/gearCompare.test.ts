import { describe, expect, it } from 'vitest'
import { IRON_SWORD, OAK_SHIELD, YEW_BOW, itemById } from '../inventory/inventory.ts'
import { attackCostWarning, attacksPerTurn, compareLines, fieldCraftSummary, statLines, statSummary, WARDS_ROW_CHARS, WARDS_WIDE_ROW_CHARS, wardsLines } from './gearCompare.ts'

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
    expect(compareLines(hammer, hammer, 8, 6)).toEqual([])
  })

  it('tells what runes add: wards, maximum hit points and what a hit does', () => {
    const sword = itemById('iron_sword@3')!
    expect(compareLines(sword, itemById('iron_sword@3#ember1')!)).toEqual(['On a hit: none → +1 fire'])
    expect(compareLines(sword, itemById('iron_sword@3#ember3')!)).toEqual(['On a hit: none → +3 fire, lays Seared'])
    expect(statLines(itemById('steel_longsword@3#ember1.life1')!)).toEqual(expect.arrayContaining(['On a hit: +1 fire', 'On a hit (2): heals 1']))
    expect(compareLines(itemById('steel_longsword@3#venom2')!, itemById('steel_longsword@3#venom2.ember1')!)).toEqual(['On a hit (2): none → +1 fire'])
    expect(statLines(itemById('steel_longsword@3#venom2')!)).toContain('On a hit: +2 poison, lays Poisoned on a critical')
    const plate = itemById('iron_breastplate@3')!
    expect(compareLines(plate, itemById('iron_breastplate@3#rime1')!)).toEqual(['Wards: none → frost 2'])
    expect(compareLines(plate, itemById('iron_breastplate@3#life1')!)).toEqual(['Max HP: none → +4'])
    expect(statSummary(itemById('iron_breastplate@3#rime1')!)).toContain('frost ward 2')
  })

  it('keeps the holder\'s strength shortfall in a comparison though the craft leaves it alone', () => {
    const greatsword = itemById('iron_greatsword')!
    const balanced = itemById('iron_greatsword+balanced1')!
    expect(compareLines(greatsword, balanced, 8, 3)).toContain('Strength: 6 (you have 3): to hit −15%')
    expect(compareLines(greatsword, balanced, 8, 6).join('\n')).not.toContain('Strength')
    expect(compareLines(greatsword, balanced).join('\n')).not.toContain('Strength')
  })
})

describe('attackCostWarning', () => {
  it('warns when the attack costs more AP than a turn gives', () => {
    expect(attackCostWarning(7, 6)).toBe('Attack costs 7 AP, you have 6: cannot attack')
  })
  it('is silent when the attack fits the turn', () => {
    expect(attackCostWarning(7, 7)).toBeNull()
    expect(attackCostWarning(5, 8)).toBeNull()
  })
})

describe('the wards lines', () => {
  it('lists the wards above 0 in element order, and is empty with none', () => {
    expect(wardsLines({ frost: 4, fire: 2, acid: 0 })).toEqual(['Wards:', '  fire 2, frost 4'])
    expect(wardsLines({ fire: 0 })).toEqual([])
    expect(wardsLines(undefined)).toEqual([])
  })

  it('wraps onto indented rows that fit the column, up to all six elements', () => {
    const all = wardsLines({ fire: 3, frost: 3, lightning: 3, acid: 3, poison: 3, blight: 3 })
    expect(all.join(' ').replace(/,/g, '').replace(/ +/g, ' ')).toBe('Wards: fire 3 frost 3 lightning 3 acid 3 poison 3 blight 3')
    for (const line of all.slice(1)) expect(line.length - 2).toBeLessThanOrEqual(WARDS_ROW_CHARS)
    expect(all.length).toBeLessThanOrEqual(5)
    const wide = wardsLines({ fire: 3, frost: 3, lightning: 3, acid: 3, poison: 3, blight: 3 }, WARDS_WIDE_ROW_CHARS)
    for (const line of wide.slice(1)) expect(line.length - 2).toBeLessThanOrEqual(WARDS_WIDE_ROW_CHARS)
    expect(wide.length).toBe(3)
    const three = wardsLines({ fire: 2, frost: 2, lightning: 2 })
    expect(three).toEqual(['Wards:', '  fire 2, frost 2,', '  lightning 2'])
  })
})
