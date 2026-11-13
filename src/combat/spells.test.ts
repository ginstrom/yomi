import { describe, expect, it } from 'vitest'
import { ELEMENTS, type CombatantStats } from './combat.ts'
import { ALL_SPELL_IDS, MONSTER_SPELL_IDS, SPELLS, SPELL_IDS, STATUSES, STATUS_IDS, spellApCost, spellRange, type SpellId } from './spells.ts'
import { effectiveStats } from '../engine/battleEngine.ts'

describe('spell ids', () => {
  it('keeps the monsters’ spells apart from the heroes’', () => {
    const heroes = new Set<string>(SPELL_IDS)
    expect(MONSTER_SPELL_IDS.filter((id) => heroes.has(id))).toEqual([])
    expect(MONSTER_SPELL_IDS).toEqual(['lightning_bolt', 'drain_life', 'dark_shield'])
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
      meteor: 'fire',
      frost_blast: 'frost',
      frostbite: 'frost',
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

describe('the stage-1 spells', () => {
  const row = (id: SpellId) => {
    const { school, target, shape, range, radius, manaCost, apCost, damage, heal, status, element, hostile } = SPELLS[id]
    return { school, target, shape, range, radius, manaCost, apCost, damage, heal, status, element, hostile }
  }
  const none = { shape: undefined, damage: undefined, heal: undefined, status: undefined, element: undefined, radius: undefined }

  it('hold the heroes’ 24 spells, Web and Curse among them, and leave the monsters three', () => {
    expect(SPELL_IDS).toHaveLength(24)
    expect(SPELL_IDS.slice(-7)).toEqual(['frostbite', 'meteor', 'mass_haste', 'lay_on_hands', 'ward', 'web', 'curse'])
    expect(MONSTER_SPELL_IDS).toEqual(['lightning_bolt', 'drain_life', 'dark_shield'])
    expect(new Set(ALL_SPELL_IDS).size).toBe(ALL_SPELL_IDS.length)
    expect(ALL_SPELL_IDS).toHaveLength(27)
  })

  it('are as design 4.3 has them', () => {
    expect(row('frostbite')).toEqual({ ...none, school: 'offence', target: 'foe', range: 5, manaCost: 3, apCost: 4, hostile: true,
      damage: { count: 1, sides: 6, bonus: 1 }, element: 'frost', status: { id: 'chilled', turns: 1 } })
    expect(row('meteor')).toEqual({ ...none, school: 'offence', target: 'area', range: 6, radius: 2, manaCost: 16, apCost: 7, hostile: true,
      damage: { count: 4, sides: 8, bonus: 0 }, element: 'fire', status: { id: 'seared', turns: 1 } })
    expect(row('mass_haste')).toEqual({ ...none, school: 'support', target: 'area', range: 0, radius: 2, manaCost: 12, apCost: 5, hostile: false,
      status: { id: 'hasted', turns: 2 } })
    expect(row('lay_on_hands')).toEqual({ ...none, school: 'healing', target: 'ally', range: 1, manaCost: 4, apCost: 3, hostile: false,
      heal: { count: 2, sides: 6, bonus: 2 } })
    expect(row('ward')).toEqual({ ...none, school: 'support', target: 'ally', range: 4, manaCost: 4, apCost: 3, hostile: false,
      status: { id: 'warded', turns: 3 } })
  })

  it('leave Web and Curse as the monsters had them', () => {
    expect(SPELLS.curse).toEqual({ name: 'Curse', school: 'offence', description: '-15 to hit and -5 AC to a foe within 5 hexes, for 3 turns',
      manaCost: 5, apCost: 4, range: 5, target: 'foe', hostile: true, status: { id: 'cursed', turns: 3 } })
    expect(SPELLS.web).toEqual({ name: 'Web', school: 'offence', description: '-4 AP for 2 turns to everyone within 1 hex of a point within 4 hexes',
      manaCost: 5, apCost: 4, range: 4, target: 'area', radius: 1, shape: 'burst', hostile: true, status: { id: 'webbed', turns: 2 } })
  })

  it('lay Warded, a ward of 4 against every element', () => {
    expect(STATUSES.warded).toMatchObject({ name: 'Warded', mark: 'G', wardAll: 4 })
  })
})

describe('a caster’s modifiers to a spell’s cost and reach', () => {
  const caster = (magic: Partial<NonNullable<CombatantStats['magic']>>) => ({
    magic: { maxMana: 20, skill: 60, spells: [], ...magic },
  })

  it('costs a spell its own action points without a discount, and for a unit with no magic', () => {
    expect(spellApCost({}, 'magic_arrow')).toBe(SPELLS.magic_arrow.apCost)
    expect(spellApCost(caster({}), 'heal')).toBe(SPELLS.heal.apCost)
  })

  it('takes the discount off every spell, and the heal discount off healing spells only', () => {
    expect(spellApCost(caster({ apDiscount: { all: 1 } }), 'magic_arrow')).toBe(SPELLS.magic_arrow.apCost - 1)
    expect(spellApCost(caster({ apDiscount: { heal: 1 } }), 'magic_arrow')).toBe(SPELLS.magic_arrow.apCost)
    expect(spellApCost(caster({ apDiscount: { heal: 1 } }), 'heal')).toBe(SPELLS.heal.apCost - 1)
    expect(spellApCost(caster({ apDiscount: { all: 1, heal: 1 } }), 'heal')).toBe(SPELLS.heal.apCost - 2)
  })

  it('never takes a spell below 2 action points, and leaves one of 2 or less as it is', () => {
    expect(SPELLS.lay_on_hands.apCost).toBe(3)
    expect(spellApCost(caster({ apDiscount: { all: 1, heal: 1 } }), 'lay_on_hands')).toBe(2)
    expect(spellApCost(caster({ apDiscount: { all: 5 } }), 'magic_arrow')).toBe(2)
    expect(SPELLS.shield.apCost).toBe(2)
    expect(spellApCost(caster({ apDiscount: { all: 1 } }), 'shield')).toBe(2)
  })

  it('reaches further with a friendly spell aimed at an ally or a point, never a hostile, self or caster-centred one', () => {
    const serene = caster({ friendlyRange: 2 })
    expect(spellRange(serene, 'heal')).toBe(SPELLS.heal.range + 2)
    expect(spellRange(serene, 'lay_on_hands')).toBe(SPELLS.lay_on_hands.range + 2)
    expect(spellRange(serene, 'heal_all')).toBe(0)
    expect(spellRange(serene, 'mass_haste')).toBe(0)
    expect(spellRange(serene, 'bless')).toBe(0)
    expect(spellRange(serene, 'shield')).toBe(0)
    expect(spellRange(serene, 'magic_arrow')).toBe(SPELLS.magic_arrow.range)
    expect(spellRange(serene, 'fireball')).toBe(SPELLS.fireball.range)
    expect(spellRange({}, 'heal')).toBe(SPELLS.heal.range)
  })
})

describe('the technique statuses', () => {
  it('lists marked, slowed, pinned, taunted and rooted after warded', () => {
    expect(STATUS_IDS.slice(STATUS_IDS.indexOf('warded'))).toEqual(['warded', 'marked', 'slowed', 'pinned', 'taunted', 'rooted'])
  })

  it('makes Marked 10 off armour class and Slowed 3 off action points', () => {
    expect(STATUSES.marked).toMatchObject({ name: 'Marked', adjective: 'marked', mark: 'Y', armorClass: -10 })
    expect(STATUSES.slowed).toMatchObject({ name: 'Slowed', adjective: 'slowed', mark: 'L', actionPoints: -3 })
    const stats: CombatantStats = { name: 'G', maxHp: 10, ac: 25, toHit: 50, critChance: 5, damage: { count: 1, sides: 6, bonus: 0 }, attackApCost: 4, attackRange: 1, actionPoints: 8 }
    expect(effectiveStats({ stats, statuses: [{ id: 'marked', turnsLeft: 2 }] }).ac).toBe(15)
  })

  it('makes Pinned immobile, and nothing else', () => {
    const { name, adjective, mark, colour, ...rule } = STATUSES.pinned
    expect({ name, adjective, mark }).toEqual({ name: 'Pinned', adjective: 'pinned', mark: 'N' })
    expect(colour).toBeGreaterThan(0)
    expect(rule).toEqual({ immobile: true })
  })

  it('gives Taunted a name, the mark T and a red, and no stat change: the engine applies its penalty by target', () => {
    const { name, adjective, mark, colour, ...rule } = STATUSES.taunted
    expect({ name, adjective, mark }).toEqual({ name: 'Taunted', adjective: 'taunted', mark: 'T' })
    expect(colour >> 16).toBeGreaterThan(0xc0)
    expect(rule).toEqual({})
  })

  it('makes Rooted 10 armour class and 2 resistance, marked R in a colour of its own', () => {
    const { name, adjective, mark, colour, ...rule } = STATUSES.rooted
    expect({ name, adjective, mark }).toEqual({ name: 'Rooted', adjective: 'rooted', mark: 'R' })
    expect(rule).toEqual({ armorClass: 10, resistance: 2 })
    expect(STATUS_IDS.filter((id) => id !== 'rooted').map((id) => STATUSES[id].colour)).not.toContain(colour)
  })

  it('gives every status its own mark', () => {
    const marks = STATUS_IDS.map((id) => STATUSES[id].mark)
    expect(new Set(marks).size).toBe(marks.length)
  })
})
