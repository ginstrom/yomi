import { describe, expect, it } from 'vitest'
import { ELEMENTS } from './combat.ts'
import { ALL_SPELL_IDS, MONSTER_SPELL_IDS, SPELLS, SPELL_IDS, STATUSES, STATUS_IDS, type SpellId } from './spells.ts'

describe('spell ids', () => {
  it('keeps the monsters’ spells apart from the heroes’', () => {
    const heroes = new Set<string>(SPELL_IDS)
    expect(MONSTER_SPELL_IDS.filter((id) => heroes.has(id))).toEqual([])
    expect(MONSTER_SPELL_IDS).toEqual(['lightning_bolt', 'drain_life', 'curse', 'web', 'dark_shield'])
  })

  it('lists every spell, the heroes’ first', () => {
    expect(ALL_SPELL_IDS).toEqual([...SPELL_IDS, ...MONSTER_SPELL_IDS])
  })

  it('has an entry in SPELLS for every id, and no other', () => {
    expect(Object.keys(SPELLS).sort()).toEqual([...ALL_SPELL_IDS].sort())
  })

  it('has a rule in STATUSES for every status, Cursed and Webbed among them', () => {
    expect(STATUS_IDS).toContain('cursed')
    expect(STATUS_IDS).toContain('webbed')
    expect(Object.keys(STATUSES).sort()).toEqual([...STATUS_IDS].sort())
  })
})

describe('elements', () => {
  it('lists the six', () => {
    expect(ELEMENTS).toEqual(['fire', 'frost', 'lightning', 'acid', 'poison', 'blight'])
  })

  it('gives today’s spells theirs, and Magic Arrow none', () => {
    const elements = Object.fromEntries(ALL_SPELL_IDS.filter((id) => SPELLS[id].element).map((id) => [id, SPELLS[id].element]))
    expect(elements).toEqual({
      flame_arrow: 'fire',
      fireball: 'fire',
      frost_blast: 'frost',
      acid_arrow: 'acid',
      death_cloud: 'poison',
      lightning_bolt: 'lightning',
    })
  })

  it('gives each status that ticks the element of its tick', () => {
    const elements = Object.fromEntries(STATUS_IDS.filter((id) => STATUSES[id].element).map((id) => [id, STATUSES[id].element]))
    expect(elements).toEqual({ corroded: 'acid', poisoned: 'poison' })
  })
})

describe('the monster spells', () => {
  const row = (id: SpellId) => {
    const { school, target, shape, range, radius, manaCost, apCost, damage, status, element, drain, hostile } = SPELLS[id]
    return { school, target, shape, range, radius, manaCost, apCost, damage, status, element, drain, hostile }
  }

  it('are as the plan’s table has them', () => {
    expect(row('lightning_bolt')).toEqual({
      school: 'offence', target: 'area', shape: 'line', range: 6, radius: undefined, manaCost: 8, apCost: 5,
      damage: { count: 4, sides: 6, bonus: 0 }, status: undefined, element: 'lightning', drain: undefined, hostile: true,
    })
    expect(row('drain_life')).toEqual({
      school: 'offence', target: 'foe', shape: undefined, range: 5, radius: undefined, manaCost: 6, apCost: 4,
      damage: { count: 3, sides: 6, bonus: 0 }, status: undefined, element: undefined, drain: 0.5, hostile: true,
    })
    expect(row('curse')).toEqual({
      school: 'offence', target: 'foe', shape: undefined, range: 5, radius: undefined, manaCost: 5, apCost: 4,
      damage: undefined, status: { id: 'cursed', turns: 3 }, element: undefined, drain: undefined, hostile: true,
    })
    expect(row('web')).toEqual({
      school: 'offence', target: 'area', shape: 'burst', range: 4, radius: 1, manaCost: 5, apCost: 4,
      damage: undefined, status: { id: 'webbed', turns: 2 }, element: undefined, drain: undefined, hostile: true,
    })
    expect(row('dark_shield')).toEqual({
      school: 'support', target: 'self', shape: undefined, range: 0, radius: undefined, manaCost: 4, apCost: 2,
      damage: undefined, status: { id: 'shielded', turns: 3 }, element: undefined, drain: undefined, hostile: false,
    })
  })

  it('lay Cursed (-15 to hit, -5 AC) and Webbed (-4 AP)', () => {
    expect(STATUSES.cursed).toMatchObject({ name: 'Cursed', mark: 'K', toHit: -15, armorClass: -5 })
    expect(STATUSES.webbed).toMatchObject({ name: 'Webbed', mark: 'W', actionPoints: -4 })
  })
})
