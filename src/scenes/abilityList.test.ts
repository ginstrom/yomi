import { describe, expect, it } from 'vitest'
import { createWarrior, deriveCombatStats } from '../character/character.ts'
import { ABILITIES, abilityApCost } from '../combat/abilities.ts'
import { SPELLS } from '../combat/spells.ts'
import { ABILITY_LIST, ABILITY_ROWS_PER_PAGE, abilityCostLine, abilityPages, abilityRowPlace, abilityRowRect, abilityRows, shownDescription } from './abilityList.ts'

const caster = (...perks: string[]) => {
  const hero = createWarrior()
  hero.attributes.intelligence = 9
  hero.trained.magic = 100
  hero.perks = Object.fromEntries(perks.map((id) => [id, 1]))
  return hero
}

describe('abilityRows', () => {
  it('lists a hero with no active as no row', () => {
    expect(abilityRows(createWarrior())).toEqual([])
  })

  it('lists each spell known with its AP and mana', () => {
    expect(abilityRows(caster('magic_arrow', 'heal'))).toEqual([
      { spell: 'magic_arrow', ability: null, name: 'Magic Arrow', kind: 'spell', ap: SPELLS.magic_arrow.apCost, mana: SPELLS.magic_arrow.manaCost, recharge: null, description: SPELLS.magic_arrow.description },
      { spell: 'heal', ability: null, name: 'Heal', kind: 'spell', ap: SPELLS.heal.apCost, mana: SPELLS.heal.manaCost, recharge: null, description: SPELLS.heal.description },
    ])
  })

  it('shows the AP a discount leaves', () => {
    const plain = abilityRows(caster('heal'))[0].ap
    const swift = abilityRows(caster('heal', 'swift_hands'))[0].ap
    expect(swift).toBe(Math.max(2, plain - 1))
    expect(swift).toBeLessThan(plain)
  })

  it('lists each technique known after the spells, in ABILITY_IDS order, with its AP for the weapon held, mana and recharge', () => {
    const hero = caster('taunt', 'heal', 'power_attack', 'pin')
    const stats = deriveCombatStats(hero)
    expect(abilityRows(hero)).toEqual([
      expect.objectContaining({ spell: 'heal', ability: null }),
      { spell: null, ability: 'power_attack', name: 'Power Attack', kind: 'at-will', ap: abilityApCost(stats, 'power_attack'), mana: null, recharge: null, description: ABILITIES.power_attack.description },
      { spell: null, ability: 'taunt', name: 'Taunt', kind: 'at-will', ap: ABILITIES.taunt.apCost, mana: null, recharge: ABILITIES.taunt.recharge, description: ABILITIES.taunt.description },
      { spell: null, ability: 'pin', name: 'Pin', kind: 'mana', ap: abilityApCost(stats, 'pin'), mana: ABILITIES.pin.manaCost, recharge: ABILITIES.pin.recharge || null, description: ABILITIES.pin.description },
    ])
    // A weapon's technique costs the weapon's AP and its own.
    expect(abilityRows(hero)[1].ap).toBe(stats.attackApCost + ABILITIES.power_attack.weaponAp!)
  })

  it("shows a damaging spell's dice with the caster's spell power", () => {
    expect(abilityRows(caster('magic_arrow'))[0].description).toBe('1d10 to a foe within 5 hexes')
    expect(abilityRows(caster('magic_arrow', 'destruction'))[0].description).toBe('1d10+2 to a foe within 5 hexes')
  })
})

describe('shownDescription', () => {
  it('adds power to the first dice only, element by element', () => {
    expect(shownDescription('frostbite', { all: 2, frost: 1 })).toBe('1d6+4 frost to a foe within 5 hexes, chilled for 1 turn')
    // Ice Lance's power is added once, to its first dice.
    expect(shownDescription('ice_lance', { frost: 3 })).toBe('2d8+3 frost to a foe within 6 hexes, 2d8 more if it is chilled, slowed, webbed, asleep or frozen')
    // Fire power is no frost spell's.
    expect(shownDescription('frostbite', { fire: 3 })).toBe(SPELLS.frostbite.description)
    // A heal has no damage to add it to.
    expect(shownDescription('heal', { all: 2 })).toBe(SPELLS.heal.description)
  })
})

describe('the Abilities tab layout', () => {
  it('puts each row in its own place, a page holding ABILITY_ROWS_PER_PAGE, no two rows of a page sharing one', () => {
    const places = Array.from({ length: 2 * ABILITY_ROWS_PER_PAGE + 3 }, (_, i) => abilityRowPlace(i))
    for (const page of [0, 1, 2]) {
      const onPage = places.filter((place) => place.page === page)
      const keys = onPage.map(({ column, row }) => `${column}:${row}`)
      expect(new Set(keys).size).toBe(keys.length)
    }
    expect(places.filter((place) => place.page === 0)).toHaveLength(ABILITY_ROWS_PER_PAGE)
    expect(abilityPages(0)).toBe(1)
    expect(abilityPages(ABILITY_ROWS_PER_PAGE)).toBe(1)
    expect(abilityPages(ABILITY_ROWS_PER_PAGE + 1)).toBe(2)
  })

  it('never lets two rows of a page overlap, and keeps them inside the panel and above the footer', () => {
    const panelWidth = 720
    const rects = Array.from({ length: ABILITY_ROWS_PER_PAGE }, (_, i) => abilityRowRect(i, panelWidth))
    for (const [i, a] of rects.entries()) {
      expect(a.x).toBeGreaterThanOrEqual(0)
      expect(a.x + a.width).toBeLessThanOrEqual(panelWidth)
      expect(a.y + a.height).toBeLessThan(ABILITY_LIST.footerTop)
      for (const b of rects.slice(i + 1)) {
        const apart = a.x + a.width <= b.x || b.x + b.width <= a.x || a.y + a.height <= b.y || b.y + b.height <= a.y
        expect(apart).toBe(true)
      }
    }
    // The next page starts over at the top.
    expect(abilityRowRect(ABILITY_ROWS_PER_PAGE, panelWidth)).toEqual(rects[0])
  })
})

describe('abilityCostLine', () => {
  it('gives the kind and the costs that apply', () => {
    expect(abilityCostLine({ kind: 'spell', mana: 3, ap: 4, recharge: null })).toBe('spell, 3 mana, 4 AP')
    expect(abilityCostLine({ kind: 'at-will', mana: null, ap: 3, recharge: 2 })).toBe('at-will, 3 AP, recharge 2')
  })
})
